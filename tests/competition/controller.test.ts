import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { useCompetitionSession } from '../../app/composables/useCompetitionSession'
import { applySessionOperation } from '../../app/utils/competition/session'
import type { CompetitionSession, SessionOperation } from '../../app/types/competition'
import type { CompetitionSessionStore } from '../../app/storage/contracts'
import { START, level, newSession } from './fixtures'

function repository() {
  let stored: CompetitionSession | undefined
  let fail = false
  const store: CompetitionSessionStore = {
    list: () => stored ? [stored] : [], get: () => stored,
    create: async session => { if (fail) throw Error('quota'); stored = session },
    apply: async (_id, op) => { if (fail) throw Error('quota'); const result = applySessionOperation(stored!, op); stored = result.session; return result.receipt },
    removeMany: async () => {}, subscribe: () => () => {},
  }
  return { store, fail: (value: boolean) => { fail = value }, external: async (op: SessionOperation) => store.apply('session-1', op) }
}
async function entered(extra = {}) {
  const repo = repository(), controller = useCompetitionSession(repo.store)
  await controller.start(newSession(extra))
  await controller.apply({ type: 'enter-level', level, levelIndex: 0, at: START })
  return { ...repo, controller }
}
const record = (session: CompetitionSession) => Object.values(session.levels)[0]!
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(START) })
afterEach(() => vi.useRealTimers())

describe('competition browser controller', () => {
  it('wrong_then_retry_preserves_time_and_stars', async () => {
    const { controller: c } = await entered()
    await c.apply({ type: 'wrong-input', at: START + 1000 })
    await c.apply({ type: 'reset-attempt', at: START + 2000 })
    await c.apply({ type: 'correct-input', complete: true, at: START + 10250 })
    expect(record(c.session.value!)).toMatchObject({ mistakes: 1, firstReadyAt: START, stars: 2, timeSpentSeconds: 10.25, completed: true })
  })
  it('reset_preserves_scoring_window', async () => {
    const { controller: c } = await entered()
    await c.apply({ type: 'correct-input', at: START + 1000 })
    await c.apply({ type: 'reset-attempt', at: START + 6000 })
    expect(record(c.session.value!)).toMatchObject({ firstReadyAt: START, attemptCursor: 0 })
  })
  it('final_input_time_precedes_animation', async () => {
    const { controller: c } = await entered({ timeLimitSec: 1 })
    vi.setSystemTime(START + 999)
    const accepted = c.apply({ type: 'correct-input', complete: true, at: Date.now() })
    expect(record(c.session.value!).submittedAt).toBe(START + 999)
    vi.setSystemTime(START + 1079)
    await accepted
    await c.finish(Date.now())
    expect(record(c.session.value!).submittedAt).toBe(START + 999)
    expect(c.session.value!.totalScore).toBeGreaterThan(0)
  })
  it('completion_and_timeout_callback_orders_match', async () => {
    for (const finishFirst of [true, false]) {
      const { controller: c } = await entered({ timeLimitSec: 1 })
      const completed = c.apply({ type: 'correct-input', complete: true, at: START + 999 })
      const finish = finishFirst ? c.finish(START + 1000) : completed.then(() => c.finish(START + 1000))
      await completed; await finish
      expect(c.session.value!.levelsCompleted).toBe(1)
      expect(record(c.session.value!).submittedAt).toBe(START + 999)
    }
    const { controller: late } = await entered({ timeLimitSec: 1 })
    await late.apply({ type: 'correct-input', complete: true, at: START + 1001 })
    expect(late.session.value!.totalScore).toBe(0)
    expect(late.session.value!.status).toBe('finished')
  })
  it('expired_resume_finalizes_stored_total', async () => {
    const { controller: c, store } = await entered({ timeLimitSec: 1 })
    await c.apply({ type: 'correct-input', complete: true, at: START + 500 })
    const total = c.session.value!.totalScore
    vi.setSystemTime(START + 5000)
    const resumed = useCompetitionSession(store)
    await resumed.resume('session-1')
    expect(resumed.session.value).toMatchObject({ status: 'finished', totalScore: total, deadline: START + 1000 })
  })
  it('reload_does_not_extend_deadline', async () => {
    const { store } = await entered()
    vi.setSystemTime(START + 10000)
    const c = useCompetitionSession(store)
    await c.resume('session-1')
    expect(c.session.value!.deadline).toBe(START + 300000)
  })
  it('failed_write_blocks_next_input_and_retry_is_idempotent', async () => {
    const { controller: c, fail, store } = await entered({ mode: 'dead', checkpoint: { levelIndex: 0, combo: 0, bestCombo: 0, inputs: 0, hearts: 5, deadSeed: 42 } })
    fail(true)
    const saved = c.apply({ type: 'wrong-input', at: START + 1000 })
    await Promise.resolve(); await Promise.resolve()
    const id = c.pendingOperation.value!.id
    expect(c.saveError.value).toBeTruthy()
    await c.apply({ type: 'wrong-input', at: START + 2000 })
    expect(c.pendingOperation.value!.id).toBe(id)
    fail(false)
    await c.retry(); await saved; await c.retry()
    expect(store.get('session-1')!.checkpoint.hearts).toBe(4)
    expect(record(store.get('session-1')!).mistakes).toBe(1)
  })
  it('queued_completion_and_finish_survive_failed_write', async () => {
    const { controller: c, fail, store } = await entered()
    fail(true)
    const completed = c.apply({ type: 'correct-input', complete: true, at: START + 999 })
    const finished = c.finish(START + 1000)
    await Promise.resolve(); await Promise.resolve()
    expect(c.saveError.value).toBeTruthy()
    fail(false); await c.retry(); await completed; await finished
    expect(store.get('session-1')).toMatchObject({ status: 'finished', levelsCompleted: 1 })
  })
  it('stale_tab_resyncs_before_next_input', async () => {
    const { controller: c, external } = await entered()
    await external({ type: 'wrong-input', id: 'other-tab', at: START + 1000, expectedRevision: 1 })
    await c.apply({ type: 'correct-input', at: START + 2000 })
    expect(c.session.value!.revision).toBe(2)
    expect(record(c.session.value!)).toMatchObject({ mistakes: 1, attemptCursor: 0 })
    expect(c.busy.value).toBe(false)
    await c.apply({ type: 'correct-input', at: START + 2001 })
    expect(record(c.session.value!).attemptCursor).toBe(1)
  })
  it('abandon_settles_pending_continuations_and_retry_cannot_resume_them', async () => {
    const { controller: c, fail, store } = await entered()
    fail(true)
    const pending = c.apply({ type: 'correct-input', complete: true, at: START + 1000 })
    const finish = c.finish(START + 2000)
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    c.abandon()
    expect(await pending).toBeUndefined()
    expect(await finish).toBeUndefined()
    fail(false); await c.retry()
    expect(store.get('session-1')).toMatchObject({ status: 'active', levelsCompleted: 0 })
    expect(c.session.value).toBeUndefined()
  })
  it('empty_retry_does_not_stall_later_writes', async () => {
    const { controller: c } = await entered()
    await c.retry()
    await c.apply({ type: 'wrong-input', at: START + 1000 })
    expect(record(c.session.value!).mistakes).toBe(1)
    expect(c.busy.value).toBe(false)
  })
  it('stale_revision_during_write_discards_queued_board_evidence', async () => {
    const { controller: c, external } = await entered()
    const pending = c.apply({ type: 'correct-input', complete: true, at: START + 2000 })
    await external({ type: 'wrong-input', id: 'racing-tab', at: START + 1000, expectedRevision: 1 })
    expect(await pending).toBeUndefined()
    expect(c.session.value).toMatchObject({ revision: 2, levelsCompleted: 0, checkpoint: { combo: 0 } })
    expect(record(c.session.value!)).toMatchObject({ mistakes: 1, attemptCursor: 0 })
    expect(c.busy.value).toBe(false)
  })

})
