import { describe, expect, it } from 'vitest'
import type { CompetitionSession, SessionOperation } from '../../app/types/competition'
import { applySessionOperation, competitionLevelKey, createCompetitionSession, toScore } from '../../app/utils/competition/session'
import { START, level, newSession, operation } from './fixtures'

function apply(session: CompetitionSession, type: SessionOperation['type'], seconds: number, payload: Record<string, unknown> = {}) {
  return applySessionOperation(session, operation(type, session.revision, seconds, payload))
}

function entered() {
  return apply(createCompetitionSession(newSession()), 'enter-level', 0, { level, levelIndex: 0 }).session
}

describe('competition session', () => {
  it('counts mistakes across resets and scores the immutable fractional submission time', () => {
    let session = entered()
    session = apply(session, 'correct-input', 2).session
    session = apply(session, 'wrong-input', 4).session
    const readyAt = session.levels[competitionLevelKey(level)]!.firstReadyAt
    session = apply(session, 'reset-attempt', 6).session
    expect(session.levels[competitionLevelKey(level)]).toMatchObject({ firstReadyAt: readyAt, mistakes: 1, attemptCursor: 0 })
    const result = apply(session, 'complete-level', 10.25)
    expect(result.receipt).toMatchObject({ stars: 2, candidatePoints: 1148, delta: 1148, totalScore: 1148, levelsCompleted: 1 })
    expect(result.session.levels[competitionLevelKey(level)]).toMatchObject({ firstReadyAt: START, mistakes: 1, timeSpentSeconds: 10.25, stars: 2 })
    expect(session.totalScore).toBe(0)
  })

  it('credits only improvements and counts a level once', () => {
    let session = entered()
    const deltas: number[] = []
    for (const [index, points] of [1000, 1200, 900, 0].entries()) {
      const result = apply(session, 'complete-level', index + 1, { candidate: { correct: points !== 0, points } })
      deltas.push(result.receipt.delta)
      session = result.session
    }
    expect(deltas).toEqual([1000, 200, 0, 0])
    expect(session.totalScore).toBe(1200)
    expect(session.levelsCompleted).toBe(1)
    expect(session.levels[competitionLevelKey(level)]).toMatchObject({ bestPoints: 1200, timeSpentSeconds: 2, stars: 3 })
    expect(session.updatedAt).toBe(START + 4000)
  })

  it('deduplicates before stale revision checks and rejects conflicting duplicates', () => {
    const session = entered()
    const op = operation('complete-level', session.revision, 10)
    const first = applySessionOperation(session, op)
    const duplicate = applySessionOperation(first.session, JSON.parse(JSON.stringify(op)))
    expect(duplicate.changed).toBe(false)
    expect(duplicate.session).toEqual(first.session)
    expect(duplicate.receipt).toMatchObject({ delta: 0, revision: first.session.revision, totalScore: first.session.totalScore, session: first.session })
    expect(() => applySessionOperation(first.session, { ...op, at: op.at + 1 })).toThrow(/conflict/i)
  })

  it('returns current canonical state on retry after later operations', () => {
    const session = entered()
    const op = operation('correct-input', session.revision, 1)
    const first = applySessionOperation(session, op)
    const later = apply(first.session, 'wrong-input', 2).session
    const duplicate = applySessionOperation(later, op)
    expect(duplicate.session).toBe(later)
    expect(duplicate.receipt).toMatchObject({ revision: later.revision, session: later, delta: 0 })
  })

  it('preserves ready time and mistakes when revisiting a level', () => {
    let session = apply(entered(), 'wrong-input', 1).session
    session = apply(session, 'enter-level', 2, { level, levelIndex: 0 }).session
    expect(session.levels[competitionLevelKey(level)]).toMatchObject({ firstReadyAt: START, mistakes: 1 })
  })

  it('uses distinct keys for different sets and generated seeds including zero', () => {
    const refs = [level, { ...level, setId: 'set-b' }, { ...level, seed: 0 }, { ...level, seed: 1 }, { ...level, seed: '1' }]
    let session = createCompetitionSession(newSession())
    for (const [index, ref] of refs.entries()) {
      session = apply(session, 'enter-level', index * 2, { level: ref, levelIndex: index }).session
      session = apply(session, 'complete-level', index * 2 + 1).session
    }
    expect(Object.keys(session.levels)).toHaveLength(5)
    expect(session.levelsCompleted).toBe(5)
  })

  it('copies config and checkpoint so callers cannot change frozen session settings', () => {
    const input = newSession({ config: { difficulty: 2, scoringStrategy: 'LATEST' }, checkpoint: { levelIndex: 0, combo: 0, bestCombo: 0, inputs: 0, deadSeed: 12, hearts: 5 } })
    const session = createCompetitionSession(input)
    input.config!.difficulty = 9
    input.timeLimitSec = 10
    input.setId = 'other'
    input.checkpoint!.hearts = 0
    expect(session).toMatchObject({ config: { difficulty: 2, scoringStrategy: 'LATEST' }, timeLimitSec: 300, setId: 'set-a', deadline: START + 300000, checkpoint: { hearts: 5 } })
    expect(createCompetitionSession(newSession()).config).toEqual({ difficulty: 1, scoringStrategy: 'BEST' })
    expect(JSON.parse(JSON.stringify(session))).toEqual(session)
    expect(() => { (session.config as { difficulty: number }).difficulty = 99 }).toThrow()
  })

  it('updates input stats and retains the Dead Mode checkpoint', () => {
    let session = createCompetitionSession(newSession({ mode: 'dead', timeLimitSec: undefined, checkpoint: { levelIndex: 0, combo: 0, bestCombo: 0, inputs: 0, hearts: 5, deadSeed: 12 } }))
    session = apply(session, 'enter-level', 0, { level, levelIndex: 0 }).session
    session = apply(session, 'correct-input', 1).session
    session = apply(session, 'correct-input', 2).session
    expect(session.checkpoint).toMatchObject({ combo: 2, bestCombo: 2, inputs: 2, hearts: 5 })
    session = apply(session, 'wrong-input', 3).session
    expect(session.checkpoint).toMatchObject({ combo: 0, bestCombo: 2, inputs: 3, hearts: 4, deadSeed: 12 })
    const duplicate = applySessionOperation(session, operation('wrong-input', session.revision - 1, 3))
    expect(duplicate.session.checkpoint.hearts).toBe(4)
  })

  it('rejects backward times, stale revisions, invalid candidates and input without a level', () => {
    const session = apply(entered(), 'correct-input', 4).session
    expect(() => apply(session, 'wrong-input', 3)).toThrow(/time/i)
    expect(() => applySessionOperation(session, operation('wrong-input', 0, 5, { id: 'stale-operation' }))).toThrow(/revision/i)
    expect(() => apply(session, 'complete-level', 5, { candidate: { correct: true, points: -1 } })).toThrow()
    expect(() => apply(session, 'complete-level', 5, { candidate: { correct: false, points: 99 } })).toThrow()
    expect(() => apply(createCompetitionSession(newSession()), 'correct-input', 1)).toThrow(/level/i)
  })

  it('rejects events after deadline and allows finalization at deadline', () => {
    const session = entered()
    expect(() => apply(session, 'complete-level', 301)).toThrow(/deadline/i)
    expect(apply(session, 'finish', 300).session.status).toBe('finished')
  })

  it('finalizes once and projects finalized results with stable timestamps', () => {
    const active = apply(entered(), 'complete-level', 10).session
    expect(() => toScore(active)).toThrow(/finished/i)
    const final = apply(active, 'finish', 20)
    expect(final.session).toMatchObject({ status: 'finished', finishedAt: START + 20000, updatedAt: START + 20000 })
    expect(apply(final.session, 'finish', 30)).toMatchObject({ changed: false, session: final.session })
    expect(() => apply(final.session, 'correct-input', 30)).toThrow(/finished/i)
    expect(toScore(final.session)).toMatchObject({ id: 'session-1', createdAt: new Date(START).toISOString(), updatedAt: new Date(START + 20000).toISOString(), score: 1537, levelsCompleted: 1, elapsedMs: 20000, difficulty: 1, scoringStrategy: 'BEST', playerId: 'player-1', timeLimitSec: 300 })
  })

  it.each([
    { config: { difficulty: 0 } }, { config: { difficulty: null } },
    { config: { scoringStrategy: 'OTHER' } }, { config: { scoringStrategy: null } },
    { startedAt: NaN }, { timeLimitSec: -1 }, { deadline: null },
    { checkpoint: { deadSeed: NaN } },
  ])('rejects invalid configuration %o', (override) => {
    expect(() => createCompetitionSession(newSession(override as never))).toThrow()
  })

  it('rejects counter, candidate and session-total overflow without mutating the canonical session', () => {
    const session = entered()
    session.checkpoint.inputs = Number.MAX_SAFE_INTEGER
    expect(() => apply(session, 'correct-input', 1)).toThrow()
    expect(session.checkpoint.inputs).toBe(Number.MAX_SAFE_INTEGER)
    expect(() => apply(session, 'complete-level', 1, { candidate: { correct: true, points: Number.MAX_SAFE_INTEGER + 1 } })).toThrow()
    session.totalScore = Number.MAX_SAFE_INTEGER
    expect(() => apply(session, 'complete-level', 1)).toThrow()
  })

  it('rejects malformed validated candidates rather than silently replacing their fields', () => {
    const session = entered()
    for (const candidate of [{ correct: true }, { points: 100 }, { correct: null, points: 100 }, null]) {
      expect(() => apply(session, 'complete-level', 1, { candidate })).toThrow()
    }
  })

  it('keeps opaque operation IDs safe through JSON persistence', () => {
    const session = entered()
    const op = operation('complete-level', session.revision, 1, { id: '__proto__' })
    const first = applySessionOperation(session, op)
    const restored = JSON.parse(JSON.stringify(first.session)) as CompetitionSession
    expect(applySessionOperation(restored, op)).toMatchObject({ changed: false, session: restored })
  })
})
