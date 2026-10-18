import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CompetitionSessionRepository } from '../../app/storage/CompetitionSessionRepository'
import { createLocalRepositories, LocalStorageAdapter } from '../../app/storage/LocalStorageAdapter'
import { competitionLevelKey, createCompetitionSession } from '../../app/utils/competition/session'
import { START, level, newSession, operation } from './fixtures'

const KEY = 'codeventure:debug-master:home-v2:v1:sessions'

class MemoryStorage {
  values = new Map<string, string>()
  failWrites = false
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('Storage quota exceeded')
    this.values.set(key, value)
  }
  removeItem(key: string) { this.values.delete(key) }
}

let storage: MemoryStorage
beforeEach(() => {
  storage = new MemoryStorage()
  const events = new EventTarget()
  vi.stubGlobal('window', Object.assign(events, { localStorage: storage }))
  const queues = new Map<string, Promise<unknown>>()
  vi.stubGlobal('navigator', { locks: { request: <T>(key: string, run: () => T) => {
    const next = (queues.get(key) ?? Promise.resolve()).then(run)
    queues.set(key, next.catch(() => undefined))
    return next
  } } })
})
afterEach(() => vi.unstubAllGlobals())

function repository() { return new CompetitionSessionRepository(new LocalStorageAdapter()) }
async function entered(id = 'session-1') {
  const sessions = repository()
  await sessions.create(createCompetitionSession(newSession({ id, mode: 'dead', checkpoint: { levelIndex: 0, combo: 0, bestCombo: 0, inputs: 0, hearts: 5, deadSeed: 42 } })))
  await sessions.apply(id, operation('enter-level', 0, 0, { level, levelIndex: 2 }))
  return sessions
}

// These cases catch lost updates, replayed awards, corrupt restores, and duplicate score storage.
describe('competition session storage', () => {
  it('checkpoint_survives_new_repository_instance', async () => {
    const sessions = await entered()
    await sessions.apply('session-1', operation('wrong-input', 1, 1))
    await sessions.apply('session-1', operation('correct-input', 2, 2))
    await sessions.apply('session-1', operation('complete-level', 3, 10.25))
    const restored = repository().get('session-1')!
    expect(restored).toMatchObject({ totalScore: 1148, startedAt: START, updatedAt: START + 10250, deadline: START + 300000, revision: 4, levelsCompleted: 1, checkpoint: { levelIndex: 2, levelKey: '["set-a",1,null]', inputs: 2, combo: 1, bestCombo: 1, hearts: 4, deadSeed: 42 } })
    expect(restored.levels[competitionLevelKey(level)]).toMatchObject({ firstReadyAt: START, mistakes: 1, attemptCursor: 1, bestPoints: 1148 })
    expect(Object.isFrozen(restored.config)).toBe(true)
  })

  it('retry_operation_does_not_double_award', async () => {
    const sessions = await entered()
    const op = operation('complete-level', 1, 10)
    const first = await sessions.apply('session-1', op)
    await sessions.apply('session-1', operation('correct-input', 2, 11))
    const retry = await repository().apply('session-1', JSON.parse(JSON.stringify(op)))
    expect(first.delta).toBe(1537)
    expect(retry).toMatchObject({ delta: 0, revision: 3, totalScore: 1537, levelsCompleted: 1, session: { totalScore: 1537, revision: 3 } })
    await expect(sessions.apply('session-1', { ...op, at: op.at + 1 })).rejects.toThrow(/conflict/i)
    expect(storage.getItem(KEY)).not.toContain('"session":')
  })

  it('stale_revision_cannot_overwrite', async () => {
    const sessions = await entered()
    await sessions.apply('session-1', operation('wrong-input', 1, 1))
    await expect(repository().apply('session-1', operation('correct-input', 1, 2, { id: 'stale' }))).rejects.toThrow(/revision/i)
    expect(sessions.get('session-1')).toMatchObject({ revision: 2, checkpoint: { hearts: 4 } })
    expect(sessions.get('session-1')!.levels[competitionLevelKey(level)]!.mistakes).toBe(1)
  })

  it('separate_sessions_survive_interleaved_writes', async () => {
    const a = repository(), b = repository()
    await Promise.all([a.create(createCompetitionSession(newSession({ id: 'a' }))), b.create(createCompetitionSession(newSession({ id: 'b' })))])
    await Promise.all([a.apply('a', operation('enter-level', 0, 0, { level, levelIndex: 0 })), b.apply('b', operation('enter-level', 0, 0, { level, levelIndex: 0 }))])
    await Promise.all([a.apply('a', operation('complete-level', 1, 10)), b.apply('b', operation('wrong-input', 1, 2))])
    expect(a.list().map(session => [session.id, session.revision, session.totalScore])).toEqual([['a', 2, 1537], ['b', 2, 0]])
  })

  it('active_session_is_not_a_score_row', async () => {
    const { sessions, scores } = createLocalRepositories()
    await sessions.create(createCompetitionSession(newSession()))
    await sessions.apply('session-1', operation('enter-level', 0, 0, { level, levelIndex: 0 }))
    await sessions.apply('session-1', operation('complete-level', 1, 10))
    expect(scores.list()).toEqual([])
    await sessions.apply('session-1', operation('finish', 2, 20))
    expect(scores.list()).toMatchObject([{ id: 'session-1', score: 1537, createdAt: new Date(START).toISOString(), updatedAt: new Date(START + 20000).toISOString(), difficulty: 1, scoringStrategy: 'BEST' }])
    const board = { challengeId: 'A' as const, setId: 'set-a', mode: 'ranking' as const, timeLimitSec: 300, difficulty: 1, scoringStrategy: 'BEST' as const }
    expect(scores.today(board, new Date(START))).toHaveLength(1)
    expect(scores.rank('session-1', board, new Date(START))).toBe(1)
    expect(scores.today(board, new Date(START + 86400000))).toEqual([])
    expect(storage.values.has('codeventure:debug-master:home-v2:v1:scores')).toBe(false)
  })

  it('delete_updates_session_source', async () => {
    const { sessions, scores } = createLocalRepositories()
    for (const id of ['a', 'b', 'keep']) {
      await sessions.create(createCompetitionSession(newSession({ id })))
      await sessions.apply(id, operation('finish', 0, 1))
    }
    await scores.remove('a')
    expect(sessions.get('a')).toBeUndefined()
    await scores.removeMany(['b', 'missing'])
    expect(repository().list().map(session => session.id)).toEqual(['keep'])
    await sessions.removeMany(['keep'])
    expect(scores.list()).toEqual([])
  })

  it('subscription_tracks_session_writes', async () => {
    const { sessions, scores } = createLocalRepositories()
    let sessionEvents = 0, scoreEvents = 0
    const unsubscribeSession = sessions.subscribe(() => sessionEvents++)
    const unsubscribeScore = scores.subscribe(() => scoreEvents++)
    await sessions.create(createCompetitionSession(newSession()))
    const op = operation('finish', 0, 1)
    await sessions.apply('session-1', op)
    await sessions.apply('session-1', op)
    expect([sessionEvents, scoreEvents]).toEqual([2, 2])
    const external = new Event('storage')
    Object.defineProperty(external, 'key', { value: KEY })
    window.dispatchEvent(external)
    expect([sessionEvents, scoreEvents]).toEqual([3, 3])
    unsubscribeSession(); unsubscribeScore()
    await sessions.removeMany(['session-1'])
    expect([sessionEvents, scoreEvents]).toEqual([3, 3])
  })

  it.each([
    { status: 'bad' }, { totalScore: -1 }, { revision: 0.5 }, { deadline: null },
    { checkpoint: { levelIndex: 0 } }, { levels: [] }, { config: { difficulty: 0, scoringStrategy: 'BEST' } }, { language: 'javascript' },
    { levelsCompleted: 1 }, { totalScore: 12 },
    { operations: { op: { fingerprint: 'x', candidatePoints: 0, storedLevelPoints: 0, stars: 0, session: {} } } },
  ])('malformed_session_reports_load_error: %o', override => {
    storage.setItem(KEY, JSON.stringify({ schemaVersion: 1, data: [{ ...createCompetitionSession(newSession()), ...override }] }))
    expect(() => repository().list()).toThrow(/schema/i)
  })

  it('failed_write_returns_no_receipt_and_same_operation_can_retry', async () => {
    const sessions = await entered()
    const op = operation('complete-level', 1, 10)
    storage.failWrites = true
    await expect(sessions.apply('session-1', op)).rejects.toThrow(/quota/i)
    expect(sessions.get('session-1')).toMatchObject({ revision: 1, totalScore: 0 })
    storage.failWrites = false
    expect(await sessions.apply('session-1', op)).toMatchObject({ operationId: op.id, delta: 1537, revision: 2 })
    expect(await sessions.apply('session-1', op)).toMatchObject({ delta: 0, totalScore: 1537, revision: 2 })
  })

  it('rejects_missing_sessions_and_duplicate_creation_without_overwriting', async () => {
    const sessions = await entered()
    await expect(sessions.apply('missing', operation('finish', 0, 1))).rejects.toThrow(/session/i)
    await expect(sessions.create(createCompetitionSession(newSession()))).rejects.toThrow(/exists/i)
    expect(sessions.get('session-1')!.revision).toBe(1)
  })

  it('transitional_save_only_finalizes_existing_canonical_sessions', async () => {
    const { sessions, scores } = createLocalRepositories()
    const active = createCompetitionSession(newSession())
    await sessions.create(active)
    await sessions.apply(active.id, operation('enter-level', 0, 0, { level, levelIndex: 0 }))
    await sessions.apply(active.id, operation('complete-level', 1, 10))
    const score = { id: active.id, score: 999999, createdAt: new Date(START).toISOString(), elapsedMs: 20000 } as Parameters<typeof scores.save>[0]
    await scores.save(score)
    expect(scores.list()[0]).toMatchObject({ score: 1537, elapsedMs: 20000 })
    await scores.save(score)
    expect(scores.list()).toHaveLength(1)
    await expect(scores.save({ ...score, id: 'missing' })).rejects.toThrow(/session/i)
  })

  it('restores_both_supported_display_languages', async () => {
    const sessions = repository()
    await sessions.create(createCompetitionSession(newSession({ language: 'js' })))
    expect(repository().get('session-1')!.language).toBe('js')
  })

  it('fails_closed_when_web_locks_are_unavailable', async () => {
    vi.stubGlobal('navigator', {})
    await expect(repository().create(createCompetitionSession(newSession()))).rejects.toThrow(/Web Locks/)
    expect(repository().list()).toEqual([])
  })

  it('rejects_invalid_creation_before_persisting', async () => {
    const sessions = repository()
    const invalid = { ...createCompetitionSession(newSession()), totalScore: 123 }
    await expect(sessions.create(invalid)).rejects.toThrow(/schema/i)
    expect(sessions.list()).toEqual([])
  })

  it('keeps_player_and_mode_settings_operational', async () => {
    const { players, modes, sessions } = createLocalRepositories()
    await players.save({ id: 'player', nickname: 'Player', age: 8 })
    await players.clearIfPlayer('other')
    await modes.save(['A', 'B'])
    await sessions.create(createCompetitionSession(newSession()))
    expect(modes.enabledIds()).toEqual(['A', 'B'])
    await players.clearIfPlayer('player')
    await modes.reset()
    expect(modes.enabledIds()).toBeUndefined()
    expect(sessions.list()).toHaveLength(1)
  })
})
