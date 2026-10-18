import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('cloudflare:workers', () => ({ DurableObject: class { constructor(public ctx: unknown, public env: unknown) {} } }))
import { LiveRoom } from '../src/live-room'
import { advanceClock, applyHostCommand, createRoom, joinPlayer, type StoredRoom } from '../src/room-logic'
import { LIVE_PROTOCOL_VERSION, type GameplayEventMsg } from '../../app/utils/live/protocol'
import { gameplayMoves } from '../src/scoring'

const pid = 'secret-player'
function harness(saved?: StoredRoom) {
  const history: string[] = []
  const messages: any[] = []
  let stored = saved ? structuredClone(saved) : createRoom('TEST-1', 0)
  if (!saved) {
    joinPlayer(stored, { type: 'hello', pid, name: 'P', avatarId: 'codi_default.svg', age: 9 }, new Set([pid]), 0)
    applyHostCommand(stored, { type: 'start' }, new Set([pid]), 0)
    advanceClock(stored, 3000)
  }
  let attachment = { role: 'player', pid, seen: 4000 }
  const ws = { readyState: 1, deserializeAttachment: () => attachment, serializeAttachment: (a: any) => { attachment = a }, send: (raw: string) => { const msg = JSON.parse(raw); messages.push(msg); history.push(msg.type === 'scoring' ? `ack:${msg.acknowledgedSequence}` : msg.type) }, close: vi.fn() }
  const screenMessages: any[] = []
  const screen = { ...ws, deserializeAttachment: () => ({ role: 'screen', seen: 4000 }), send: (raw: string) => screenMessages.push(JSON.parse(raw)) }
  let initialize: Promise<unknown> = Promise.resolve()
  const storage = {
    get: vi.fn(async () => structuredClone(stored)), getAlarm: vi.fn(async () => null),
    put: vi.fn(async (_key: string, value: StoredRoom) => { stored = structuredClone(value); history.push(`persist:${stored.players[pid].scoring!.lastSequence}`) }),
    setAlarm: vi.fn(async () => undefined), deleteAlarm: vi.fn(async () => undefined), deleteAll: vi.fn(),
  }
  const ctx = { storage, blockConcurrencyWhile: (fn: () => Promise<unknown>) => { initialize = fn(); return initialize }, setWebSocketAutoResponse: vi.fn(), getWebSockets: (tag?: string) => tag === 'player' ? [ws] : tag === 'screen' ? [screen] : tag === 'host' ? [] : [ws, screen], getWebSocketAutoResponseTimestamp: () => null }
  const live = new LiveRoom(ctx as never, {} as never)
  const event = (changes: Partial<GameplayEventMsg> = {}): GameplayEventMsg => ({ type: 'gameplay', protocolVersion: LIVE_PROTOCOL_VERSION, roundId: stored.roundId, sessionId: stored.players[pid].scoring!.session.id, sequence: stored.players[pid].scoring!.lastSequence + 1, levelId: 1, at: 4000, action: 'ready', ...changes })
  return { live, storage, ws, history, messages, screenMessages, ready: initialize, event, saved: () => structuredClone(stored), send: (msg: GameplayEventMsg) => live.webSocketMessage(ws as never, JSON.stringify(msg)) }
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
function clock() {
  vi.stubGlobal('WebSocket', { OPEN: 1 })
  vi.stubGlobal('WebSocketRequestResponsePair', class {})
  vi.spyOn(Date, 'now').mockReturnValue(10_000)
}

describe('durable private scoring acknowledgements', () => {
  it('persists before an accepted ack and sends private resume on reconnect', async () => {
    clock()
    const h = harness(); await h.ready
    await h.send(h.event())
    expect(h.history.indexOf('persist:1')).toBeLessThan(h.history.indexOf('ack:1'))
    expect(h.screenMessages.every(m => m.type === 'state')).toBe(true)
    expect(JSON.stringify(h.screenMessages)).not.toContain('checkpoint')
    expect(JSON.stringify(h.screenMessages)).not.toContain(pid)
    const reconnect = harness(h.saved()); await reconnect.ready
    await reconnect.live.webSocketMessage(reconnect.ws as never, JSON.stringify({ type: 'hello', pid, name: 'P', avatarId: 'codi_default.svg', age: 9 }))
    expect(reconnect.messages.find(m => m.type === 'scoring')).toMatchObject({ acknowledgedSequence: 1, session: { checkpoint: { levelIndex: 0 } } })
  })
  it('initializes and persists countdown sessions before private start notification', async () => {
    clock()
    const lobby = createRoom('TEST-1', 0)
    joinPlayer(lobby, { type: 'hello', pid, name: 'P', avatarId: 'codi_default.svg', age: 9 }, new Set([pid]), 0)
    const h = harness(lobby); await h.ready
    const host = { ...h.ws, deserializeAttachment: () => ({ role: 'host', host: true, seen: 4000 }), serializeAttachment: vi.fn(), send: vi.fn() }
    await h.live.webSocketMessage(host as never, JSON.stringify({ type: 'start' }))
    expect(h.saved()).toMatchObject({ phase: 'countdown', startAt: 13_000 })
    expect(h.messages.find(m => m.type === 'scoring')).toMatchObject({ acknowledgedSequence: 0, session: { startedAt: 13_000, levels: {} } })
    expect(h.history.indexOf('persist:0')).toBeLessThan(h.history.indexOf('ack:0'))
    expect(h.screenMessages.every(m => m.type === 'state')).toBe(true)
    expect(host.send).not.toHaveBeenCalled()
  })
  it('notifies incompatible protocols to reload without changing scoring', async () => {
    clock()
    const h = harness(); await h.ready
    await h.send(h.event({ protocolVersion: LIVE_PROTOCOL_VERSION + 1 }))
    expect(h.messages).toContainEqual({ type: 'reload', reason: 'unsupported_protocol' })
    expect(h.saved().players[pid].scoring!.lastSequence).toBe(0)
    expect(h.storage.put).not.toHaveBeenCalled()
    h.messages.length = 0
    await h.live.webSocketMessage(h.ws as never, JSON.stringify({ type: 'progress', roundId: 1, score: 1_000_000 }))
    expect(h.messages).toEqual([{ type: 'reload', reason: 'unsupported_protocol' }])
    expect(h.storage.put).not.toHaveBeenCalled()
  })
  it('failed completion write cannot acknowledge or publish points; duplicate retry persists and survives restart', async () => {
    clock()
    const h = harness(); await h.ready
    await h.send(h.event())
    const moves = gameplayMoves(h.saved().round!.setId, 1)
    for (const [i, direction] of moves.slice(0, -1).entries()) await h.send(h.event({ action: 'direction', direction, at: 4100 + i * 100 }))
    const final = h.event({ action: 'direction', direction: moves.at(-1), at: 5000 })
    h.storage.put.mockRejectedValueOnce(new Error('storage offline'))
    await expect(h.send(final)).rejects.toThrow('storage offline')
    expect(h.saved().players[pid].score).toBe(0)
    expect(h.messages.filter(m => m.type === 'scoring').at(-1).acknowledgedSequence).toBe(final.sequence - 1)
    await h.live.webSocketMessage(h.ws as never, JSON.stringify({ type: 'hello', pid, name: 'P', avatarId: 'codi_default.svg', age: 9 }))
    expect(h.messages.filter(m => m.type === 'scoring').at(-1).session.totalScore).toBe(0)
    await h.send(final)
    expect(h.saved().players[pid].score).toBeGreaterThan(0)
    const restart = harness(h.saved()); await restart.ready
    await restart.send(final)
    const ack = restart.messages.find(m => m.type === 'scoring')
    expect(ack).toMatchObject({ acknowledgedSequence: final.sequence, session: { totalScore: h.saved().players[pid].score } })
    expect(restart.storage.put).not.toHaveBeenCalled()
  })
  it('validates timestamps against socket arrival even while another write delays processing', async () => {
    clock()
    const h = harness(); await h.ready
    let release!: () => void
    const original = h.storage.put.getMockImplementation()!
    h.storage.put.mockImplementationOnce(async (...args) => { await new Promise<void>(resolve => { release = resolve }); return original(...args) })
    const first = h.send(h.event())
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    const future = h.send(h.event({ sequence: 2, action: 'direction', direction: 'right', at: 10_001 }))
    vi.mocked(Date.now).mockReturnValue(20_000)
    release(); await Promise.all([first, future])
    expect(h.messages.filter(m => m.type === 'scoring').at(-1)).toMatchObject({ error: 'invalid_time', acknowledgedSequence: 1 })
    expect(h.saved().players[pid].scoring!.lastSequence).toBe(1)
  })
  it('concurrent handlers cannot reveal or acknowledge a candidate before storage resolves', async () => {
    clock()
    const h = harness(); await h.ready
    let release!: () => void
    const original = h.storage.put.getMockImplementation()!
    h.storage.put.mockImplementationOnce(async (...args) => { await new Promise<void>(resolve => { release = resolve }); return original(...args) })
    const pending = h.send(h.event())
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    const concurrent = h.live.webSocketMessage(h.ws as never, JSON.stringify({ type: 'hello', pid, name: 'P', avatarId: 'codi_default.svg', age: 9 }))
    await Promise.resolve()
    expect(h.messages).toEqual([])
    release(); await Promise.all([pending, concurrent])
    expect(h.history.indexOf('persist:1')).toBeLessThan(h.history.indexOf('ack:1'))
  })
})
