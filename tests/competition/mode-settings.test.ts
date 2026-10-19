import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enabledModesFor } from '../../app/data/home-config'
import type { ScoringStrategy } from '../../app/types/competition'
import { createLocalRepositories } from '../../app/storage/LocalStorageAdapter'
import { createCompetitionSession } from '../../app/utils/competition/session'
import { START, level, newSession, operation } from './fixtures'

const PREFIX = 'codeventure:debug-master:home-v2:v1:'
let values: Map<string, string>
let failWrites: boolean
beforeEach(() => {
  values = new Map()
  failWrites = false
  vi.stubGlobal('window', Object.assign(new EventTarget(), { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failWrites) throw new Error('Storage quota exceeded')
      values.set(key, value)
    },
    removeItem: (key: string) => values.delete(key),
  } }))
  const queues = new Map<string, Promise<unknown>>()
  vi.stubGlobal('navigator', { locks: { request: <T>(key: string, run: () => T) => {
    const next = (queues.get(key) ?? Promise.resolve()).then(run)
    queues.set(key, next.catch(() => undefined))
    return next
  } } })
})
afterEach(() => vi.unstubAllGlobals())

describe('per-mode scoring settings', () => {
  it('restores independent strategies without changing enabled modes or global defaults', async () => {
    const { modes } = createLocalRepositories()
    await modes.save(['A', 'C'])
    await modes.setScoringStrategy('A', 'LATEST')
    const restored = createLocalRepositories().modes
    expect(enabledModesFor(restored.enabledIds(), restored.scoringStrategies()).map(mode => [mode.id, mode.scoringStrategy]))
      .toEqual([['A', 'LATEST'], ['C', 'BEST']])
    expect(enabledModesFor(undefined).map(mode => mode.scoringStrategy)).toEqual(['BEST', 'BEST', 'BEST'])
    await restored.save(['A', 'B', 'C'])
    expect(restored.scoringStrategies()).toEqual({ A: 'LATEST' })
  })

  it('preserves concurrent updates to different modes', async () => {
    const a = createLocalRepositories().modes, b = createLocalRepositories().modes
    await Promise.all([a.setScoringStrategy('A', 'LATEST'), b.setScoringStrategy('B', 'LATEST')])
    expect(createLocalRepositories().modes.scoringStrategies()).toEqual({ A: 'LATEST', B: 'LATEST' })
  })

  it('does not change a running session when a later round uses the new strategy', async () => {
    const { modes } = createLocalRepositories()
    const firstMode = enabledModesFor(undefined, modes.scoringStrategies())[0]!
    const running = createCompetitionSession(newSession({ config: firstMode }))
    await modes.setScoringStrategy('A', 'LATEST')
    const nextMode = enabledModesFor(undefined, modes.scoringStrategies())[0]!
    const next = createCompetitionSession(newSession({ id: 'next', config: nextMode }))
    expect(running.config).toEqual({ difficulty: 1, scoringStrategy: 'BEST' })
    expect(next.config).toEqual({ difficulty: 1, scoringStrategy: 'LATEST' })
  })

  it('uses the saved strategy to select an actual finished session for the board', async () => {
    const { modes, sessions, scores } = createLocalRepositories()
    for (const [id, seconds] of [['best', 10], ['latest', 30]] as const) {
      const start = START + (id === 'latest' ? 60000 : 0)
      await sessions.create(createCompetitionSession(newSession({ id, startedAt: start })))
      await sessions.apply(id, { ...operation('enter-level', 0, 0, { level, levelIndex: 0 }), at: start })
      await sessions.apply(id, { ...operation('complete-level', 1, seconds), at: start + seconds * 1000 })
      await sessions.apply(id, { ...operation('finish', 2, seconds + 1), at: start + (seconds + 1) * 1000 })
    }
    const board = { challengeId: 'A' as const, setId: 'set-a', mode: 'ranking' as const, timeLimitSec: 300, difficulty: 1 }
    const strategy = () => enabledModesFor(undefined, createLocalRepositories().modes.scoringStrategies())[0]!.scoringStrategy
    expect(scores.today({ ...board, scoringStrategy: strategy() }, new Date(START)).map(row => row.id)).toEqual(['best'])
    await modes.setScoringStrategy('A', 'LATEST')
    expect(scores.today({ ...board, scoringStrategy: strategy() }, new Date(START)).map(row => row.id)).toEqual(['latest'])
  })

  it('rejects invalid settings and preserves the last persisted choice on write failure', async () => {
    const { modes } = createLocalRepositories()
    await modes.setScoringStrategy('A', 'LATEST')
    await expect(modes.setScoringStrategy('A', 'other' as ScoringStrategy)).rejects.toThrow()
    await expect(modes.setScoringStrategy('D' as 'A', 'BEST')).rejects.toThrow()
    failWrites = true
    await expect(modes.setScoringStrategy('A', 'BEST')).rejects.toThrow('Storage quota exceeded')
    expect(createLocalRepositories().modes.scoringStrategies()).toEqual({ A: 'LATEST' })
  })

  it('refreshes subscribers for local and cross-tab strategy changes', async () => {
    const { modes } = createLocalRepositories()
    const observed: unknown[] = []
    const unsubscribe = modes.subscribe(() => observed.push(modes.scoringStrategies()))
    await modes.setScoringStrategy('A', 'LATEST')
    values.set(PREFIX + 'mode-scoring', JSON.stringify({ schemaVersion: 1, data: { A: 'BEST' } }))
    const event = new Event('storage')
    Object.defineProperty(event, 'key', { value: PREFIX + 'mode-scoring' })
    window.dispatchEvent(event)
    expect(observed).toEqual([{ A: 'LATEST' }, { A: 'BEST' }])
    unsubscribe()
  })

  it('restores defaults for both visibility and strategy', async () => {
    const { modes } = createLocalRepositories()
    await modes.save(['C'])
    await modes.setScoringStrategy('C', 'LATEST')
    await modes.reset()
    expect(modes.enabledIds()).toBeUndefined()
    expect(modes.scoringStrategies()).toEqual({})
    expect(enabledModesFor(modes.enabledIds(), modes.scoringStrategies()).map(mode => [mode.id, mode.scoringStrategy]))
      .toEqual([['A', 'BEST'], ['B', 'BEST'], ['C', 'BEST']])
  })

  it('reports malformed persisted strategy data rather than silently accepting it', () => {
    values.set(PREFIX + 'mode-scoring', JSON.stringify({ schemaVersion: 1, data: { A: 'other' } }))
    expect(() => createLocalRepositories().modes.scoringStrategies()).toThrow(/schema/)
  })
})
