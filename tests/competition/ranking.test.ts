import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, h, ref } from 'vue'
import type { Score } from '../../app/types/debug-game'
import type { RankingBoard } from '../../app/utils/ranking'
import { bestPlayerScore, latestPlayerScore, compareCompetitionScores, selectPlayerSessions, todayRanking } from '../../app/utils/ranking'
import { useScoreBoard } from '../../app/composables/useScoreBoard'
import { createLocalRepositories } from '../../app/storage/LocalStorageAdapter'
import { createCompetitionSession } from '../../app/utils/competition/session'
import { newSession } from './fixtures'

const now = new Date('2026-10-18T04:00:00Z')
const board: RankingBoard = { challengeId: 'A', setId: 'set-a', mode: 'ranking', timeLimitSec: 300, difficulty: 1, scoringStrategy: 'BEST' }
const latestBoard: RankingBoard = { ...board, scoringStrategy: 'LATEST' }
function score(id: string, overrides: Partial<Score> = {}): Score {
  return { id, playerId: 'alice', name: 'Alice', challengeId: 'A', setId: 'set-a', setTitle: 'Set A', mode: 'ranking', language: 'python', debug: false,
    score: 100, levelsCompleted: 2, levelReached: 3, bestCombo: 0, inputs: 0, elapsedMs: 10000,
    createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:01:00Z', difficulty: 1, scoringStrategy: 'BEST', timeLimitSec: 300, ...overrides }
}
afterEach(() => vi.unstubAllGlobals())

describe('competition board selection', () => {
  it('BEST chooses score then completed levels then earliest update then ID', () => {
    const rows = [score('fewer', { levelsCompleted: 1, updatedAt: '2026-10-18T00:00:01Z' }), score('later', { updatedAt: '2026-10-18T00:02:00Z' }), score('b'), score('a'), score('lower', { score: 99, levelsCompleted: 9 })]
    expect(selectPlayerSessions(rows, 'BEST').map(row => row.id)).toEqual(['a'])
    expect(selectPlayerSessions([...rows].reverse(), 'BEST').map(row => row.id)).toEqual(['a'])
  })

  it('LATEST selects a lower run and then zero before board exclusion', () => {
    const rows = [score('old', { scoringStrategy: 'LATEST', score: 900 }), score('lower', { scoringStrategy: 'LATEST', score: 20, updatedAt: '2026-10-18T01:00:00Z' })]
    expect(selectPlayerSessions(rows, 'LATEST').map(row => row.id)).toEqual(['lower'])
    rows.push(score('zero', { scoringStrategy: 'LATEST', score: 0, updatedAt: '2026-10-18T02:00:00Z' }))
    expect(selectPlayerSessions(rows, 'LATEST').map(row => row.id)).toEqual(['zero'])
    expect(todayRanking(rows, latestBoard, now)).toEqual([])
    expect(latestPlayerScore(rows, latestBoard, 'alice')?.id).toBe('zero')
    expect(bestPlayerScore(rows, latestBoard, 'alice')?.id).toBe('old')
  })

  it.each(['BEST', 'LATEST'] as const)('%s orders players by score, levels, strategy timestamp direction, then ID', strategy => {
    const rows = [score('earlier', { playerId: 'a', scoringStrategy: strategy, updatedAt: '2026-10-18T00:00:01Z', elapsedMs: 999999 }),
      score('later', { playerId: 'b', scoringStrategy: strategy, updatedAt: '2026-10-18T00:02:00Z', elapsedMs: 1 }),
      score('fewer', { playerId: 'c', scoringStrategy: strategy, levelsCompleted: 1, updatedAt: '2026-10-18T00:00:00Z' }),
      score('low', { playerId: 'd', scoringStrategy: strategy, score: 99, levelsCompleted: 9 })]
    expect(todayRanking(rows, { ...board, scoringStrategy: strategy }, now).map(row => row.id)).toEqual(strategy === 'BEST' ? ['earlier', 'later', 'fewer', 'low'] : ['later', 'earlier', 'fewer', 'low'])
    expect(compareCompetitionScores(score('a'), score('b'), strategy)).toBeLessThan(0)
  })

  it('selects one session per player before limiting, including non-challenge boards', () => {
    const rows = [score('best', { score: 900, challengeId: undefined }), score('repeat', { score: 800, challengeId: undefined }), score('bob', { score: 700, playerId: 'bob', challengeId: undefined })]
    expect(todayRanking(rows, { ...board, challengeId: undefined }, now, 2).map(row => row.id)).toEqual(['best', 'bob'])
  })

  it('isolates Bangkok calendar day, numeric difficulty and board settings', () => {
    const rows = [score('before-midnight', { createdAt: '2026-10-17T16:59:59.999Z' }), score('midnight', { createdAt: '2026-10-17T17:00:00.000Z' }),
      score('next-midnight', { createdAt: '2026-10-18T17:00:00Z' }), score('harder', { difficulty: 2, score: 999 }),
      score('other-set', { setId: 'other', score: 999 }),
      score('other-challenge', { challengeId: 'B', score: 999 }), score('other-mode', { mode: 'timer', score: 999 }), score('other-time', { timeLimitSec: 60, score: 999 })]
    expect(todayRanking(rows, board, now).map(row => row.id)).toEqual(['midnight'])
    expect(todayRanking(rows, { ...board, difficulty: 2 }, now).map(row => row.id)).toEqual(['harder'])
    expect(bestPlayerScore(rows, board, 'nobody')).toBeUndefined()
  })

  it('changing board policy selects across sessions with mixed frozen strategies', () => {
    const rows = [score('alice-best-era', { score: 900 }),
      score('alice-latest-era', { score: 20, scoringStrategy: 'LATEST', updatedAt: '2026-10-18T01:00:00Z' }),
      score('bob-best-era', { playerId: 'bob', score: 800 })]
    expect(todayRanking(rows, board, now).map(row => row.id)).toEqual(['alice-best-era', 'bob-best-era'])
    expect(todayRanking(rows, latestBoard, now).map(row => row.id)).toEqual(['bob-best-era', 'alice-latest-era'])
  })

  it.each([board, latestBoard])('profile history spans frozen strategies under $scoringStrategy policy', activeBoard => {
    const rows = [score('best-era', { score: 900 }),
      score('latest-era', { score: 20, scoringStrategy: 'LATEST', updatedAt: '2026-10-18T01:00:00Z' })]
    expect(bestPlayerScore(rows, activeBoard, 'alice')?.id).toBe('best-era')
    expect(latestPlayerScore(rows, activeBoard, 'alice')?.id).toBe('latest-era')
  })

  it('switching to LATEST retains BEST-era history and selects its latest zero', () => {
    const rows = [score('old-best', { score: 900 }),
      score('latest-zero', { score: 0, updatedAt: '2026-10-18T01:00:00Z' }),
      score('bob-best', { playerId: 'bob', score: 800 })]
    expect(todayRanking(rows, latestBoard, now).map(row => row.id)).toEqual(['bob-best'])
    expect(bestPlayerScore(rows, latestBoard, 'alice')?.id).toBe('old-best')
    expect(latestPlayerScore(rows, latestBoard, 'alice')?.id).toBe('latest-zero')
  })

  it('profile latest uses update time even when a different session started later', () => {
    const rows = [score('updated-last', { createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T03:00:00Z' }), score('started-last', { createdAt: '2026-10-18T02:00:00Z', updatedAt: '2026-10-18T02:01:00Z' })]
    expect(latestPlayerScore(rows, board, 'alice')?.id).toBe('updated-last')
  })

  it('LATEST excludes the selected zero before applying the board limit', () => {
    const rows = [score('old', { scoringStrategy: 'LATEST', score: 999 }), score('zero', { scoringStrategy: 'LATEST', score: 0, updatedAt: '2026-10-18T01:00:00Z' }), score('bob', { scoringStrategy: 'LATEST', playerId: 'bob', score: 10 })]
    expect(todayRanking(rows, latestBoard, now, 1).map(row => row.id)).toEqual(['bob'])
  })

  it('LATEST resolves equal update timestamps by stable ID independently of score', () => {
    expect(selectPlayerSessions([score('z', { score: 900 }), score('a', { score: 0 })], 'LATEST').map(row => row.id)).toEqual(['a'])
  })
})

describe('selected result rank and highlight', () => {
  async function repository(strategy: 'BEST' | 'LATEST', zero = false) {
    const values = new Map<string, string>()
    vi.stubGlobal('window', Object.assign(new EventTarget(), { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } }))
    vi.stubGlobal('navigator', { locks: { request: (_key: string, run: () => unknown) => Promise.resolve(run()) } })
    const repositories = createLocalRepositories()
    const start = Date.parse('2026-10-18T00:00:00Z')
    for (const [id, seconds, completed] of [['best', 10, true], ['current', 60, !zero]] as const) {
      await repositories.sessions.create(createCompetitionSession(newSession({ id, startedAt: start, config: { difficulty: 1, scoringStrategy: strategy } })))
      if (completed) {
        await repositories.sessions.apply(id, { id: 'enter', type: 'enter-level', at: start, expectedRevision: 0, level: { setId: 'set-a', levelId: 1 }, levelIndex: 0 })
        await repositories.sessions.apply(id, { id: 'complete', type: 'complete-level', at: start + (id === 'best' ? 5000 : 10000), expectedRevision: 1 })
      }
      await repositories.sessions.apply(id, { id: 'finish', type: 'finish', at: start + seconds * 1000, expectedRevision: completed ? 2 : 0 })
    }
    return repositories
  }

  it('unselected current session cannot borrow the selected player rank', async () => {
    const { scores } = await repository('BEST')
    expect(scores.rank('best', board, now)).toBe(1)
    expect(scores.rank('current', board, now)).toBeUndefined()
    expect(bestPlayerScore(scores.list(), board, 'player-1')?.id).toBe('best')
    expect(latestPlayerScore(scores.list(), board, 'player-1')?.id).toBe('current')
  })

  it.each([
    { strategy: 'BEST' as const, zero: false, expectedRank: undefined, expectedScore: 1537 },
    { strategy: 'LATEST' as const, zero: false, expectedRank: 1, expectedScore: 1537 },
    { strategy: 'LATEST' as const, zero: true, expectedRank: undefined, expectedScore: 0 },
  ])('$strategy keeps current Your Score with matching rank and highlight (zero=$zero)', async ({ strategy, zero, expectedRank, expectedScore }) => {
    const { scores } = await repository(strategy, zero)
    const activeBoard = { ...board, scoringStrategy: strategy }
    const result = scores.list().find(row => row.id === 'current')!
    expect(scores.rank('current', activeBoard, now)).toBe(expectedRank)
    // Mount the real composable with a renderer that needs no browser DOM.
    const renderer = createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null, insert() {}, remove() {}, patchProp() {} })
    let state!: ReturnType<typeof useScoreBoard>
    vi.useFakeTimers()
    vi.setSystemTime(now)
    const app = renderer.createApp({ setup() { state = useScoreBoard(scores, ref(activeBoard), Infinity); return () => h('div') } })
    app.mount({})
    try {
      expect(result).toMatchObject({ id: 'current', score: expectedScore })
      expect(state.rankOf(result.id)).toBe(expectedRank)
      expect(state.selectedSession(result.id)?.id).toBe(expectedRank ? 'current' : undefined)
      expect(state.selectedSession(result.id)?.score).toBe(expectedRank ? expectedScore : undefined)
    } finally { app.unmount(); vi.useRealTimers() }
  })
})
