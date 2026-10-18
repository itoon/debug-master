import { afterEach, describe, expect, it, vi } from 'vitest'
import { SESSION_MAX_AGE_MS, clearLiveSession, loadLiveSession, saveLiveSession } from '../../app/utils/live/session'

class MemStorage {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
}

const session = { pid: 'pid-abc123', room: 'CODI-1', nickname: 'มิ้นท์', age: 9, avatarId: 'codi_default.svg', savedAt: 1_000_000 }

describe('live session', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('round-trips for the same device id and room within 16 minutes', () => {
    vi.stubGlobal('localStorage', new MemStorage())
    saveLiveSession(session)
    expect(loadLiveSession('pid-abc123', 'codi-1', 1_000_000 + SESSION_MAX_AGE_MS)).toEqual(session)
    expect(SESSION_MAX_AGE_MS).toBe(16 * 60 * 1000)
  })

  it('ignores another device id, another room, or an expired session', () => {
    vi.stubGlobal('localStorage', new MemStorage())
    saveLiveSession(session)
    expect(loadLiveSession('pid-other1', 'CODI-1', 1_000_000)).toBeNull()
    expect(loadLiveSession('pid-abc123', 'CODI-2', 1_000_000)).toBeNull()
    expect(loadLiveSession('pid-abc123', 'CODI-1', 1_000_001 + SESSION_MAX_AGE_MS)).toBeNull()
  })

  it('rejects malformed data and is cleared', () => {
    const store = new MemStorage()
    vi.stubGlobal('localStorage', store)
    store.setItem('debug-master:live-session', '{nope')
    expect(loadLiveSession('pid-abc123', 'CODI-1', 1_000_000)).toBeNull()
    store.setItem('debug-master:live-session', JSON.stringify({ ...session, age: '9' }))
    expect(loadLiveSession('pid-abc123', 'CODI-1', 1_000_000)).toBeNull()
    saveLiveSession(session)
    clearLiveSession()
    expect(loadLiveSession('pid-abc123', 'CODI-1', 1_000_000)).toBeNull()
  })

  it('never throws when storage is blocked', () => {
    const boom = () => {
      throw new Error('blocked')
    }
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom })
    expect(() => saveLiveSession(session)).not.toThrow()
    expect(() => clearLiveSession()).not.toThrow()
    expect(loadLiveSession('pid-abc123', 'CODI-1', 1_000_000)).toBeNull()
  })
})

import { createLiveReplay } from '../../app/utils/live/session'
import { createCompetitionSession } from '../../app/utils/competition/session'
import { newSession, START } from '../competition/fixtures'
import type { GameplayEventMsg, ScoringMsg } from '../../app/utils/live/protocol'

function replayHarness(store = new MemStorage()) {
  const sent: GameplayEventMsg[] = []; const statuses: string[] = []
  const replay = createLiveReplay({ room: 'TEST', playerId: () => 'player-1', storage: store,
    send: e => sent.push(e), changed: (_session, _message, status) => statuses.push(status) })
  const canonical = createCompetitionSession(newSession())
  const snapshot = (sequence = 0, extra: Partial<ScoringMsg> = {}): ScoringMsg => ({ type: 'scoring', protocolVersion: 1, roundId: 1,
    session: canonical, acknowledgedSequence: sequence, nextExpectedSequence: sequence + 1, ...extra })
  return { replay, sent, statuses, snapshot, store }
}
describe('Live private reconciliation', () => {
  const direction = { action: 'direction' as const, levelId: 1, direction: 'right' as const }
  it('blocks new input before private reconciliation and while awaiting acceptance', () => {
    const h = replayHarness()
    expect(h.replay.enqueue(direction, START)).toBe(false)
    h.replay.accept(h.snapshot())
    expect(h.replay.enqueue(direction, START + 100)).toBe(true)
    expect(h.replay.enqueue(direction, START + 200)).toBe(false)
    h.replay.accept(h.snapshot(1))
    expect(h.replay.enqueue(direction, START + 200)).toBe(true)
    expect(h.sent.map(e => e.sequence)).toEqual([1, 2])
  })
  it('replays the immutable lost-ack suffix after restart only after hello/private state', () => {
    const first = replayHarness(); first.replay.accept(first.snapshot()); first.replay.enqueue(direction, START + 500)
    const restart = replayHarness(first.store)
    expect(restart.sent).toEqual([])
    expect(restart.replay.enqueue(direction, START + 999)).toBe(false)
    restart.replay.accept(restart.snapshot())
    expect(restart.sent).toEqual(first.sent)
    restart.replay.accept(restart.snapshot(1))
    expect(restart.replay.enqueue(direction, START + 400)).toBe(true)
    expect(restart.sent[1]!.at).toBe(START + 500) // clock offset moved backwards
  })
  it('trims accepted events without depending on bounded server receipts', () => {
    const h = replayHarness(); h.replay.accept(h.snapshot()); h.replay.enqueue(direction, START + 100)
    h.replay.disconnected()
    h.replay.accept(h.snapshot(70)) // Server restart retained accepted sequence, omitted old receipt.
    expect(h.sent).toHaveLength(1)
    expect(h.replay.enqueue(direction, START + 200)).toBe(true)
    expect(h.sent[1]!.sequence).toBe(71)
  })
  it('stops rejected late suffixes without endless resync and isolates a new round', () => {
    const h = replayHarness(); h.replay.accept(h.snapshot()); h.replay.enqueue(direction, START + 100)
    h.replay.accept(h.snapshot(0, { error: 'round_closed' }))
    expect(h.statuses.at(-1)).toBe('closed'); expect(h.sent).toHaveLength(1)
    expect(h.replay.enqueue(direction, START + 200)).toBe(false)
    h.replay.invalidate()
    h.replay.accept(h.snapshot(0, { roundId: 2, session: { ...h.snapshot().session!, id: 'new-session' } }))
    expect(h.replay.enqueue(direction, START + 300)).toBe(true)
    expect(h.sent[1]).toMatchObject({ roundId: 2, sessionId: 'new-session', sequence: 1 })
  })
  it('never sends an input when outbox persistence fails', () => {
    const store = new MemStorage(); const h = replayHarness(store); h.replay.accept(h.snapshot())
    store.setItem = () => { throw Error('quota') }
    expect(h.replay.enqueue(direction, START)).toBe(false)
    expect(h.statuses.at(-1)).toBe('storage-error'); expect(h.sent).toEqual([])
  })
})
