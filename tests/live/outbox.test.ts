import { describe, expect, it } from 'vitest'
import { createLiveOutbox } from '../../app/utils/live/outbox'
const scope = { room: 'TEST', roundId: 1, playerId: 'player1', sessionId: 'session1' }
const event = (sequence: number, at = 1000) => ({ type: 'gameplay' as const, protocolVersion: 1, roundId: 1, sessionId: 'session1', sequence, at, levelId: 1, action: 'direction' as const, direction: 'right' as const })
function storage() { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v) }, removeItem: (k: string) => { map.delete(k) } } }
describe('Live persisted outbox', () => {
  it('replays distinct immutable inputs in order and trims only the acknowledged prefix', () => {
    const store = storage(); const box = createLiveOutbox(scope, store)
    const first = event(1); box.enqueue(first); first.at = 5000
    box.enqueue(event(2, 1100)); box.enqueue(event(3, 1200))
    const reloaded = createLiveOutbox(scope, store)
    expect(reloaded.pending().map(e => e.at)).toEqual([1000, 1100, 1200])
    reloaded.acknowledge(2)
    expect(createLiveOutbox(scope, store).pending()).toEqual([event(3, 1200)])
    const copy = reloaded.pending(); copy[0]!.at = 9999
    expect(reloaded.pending()[0]!.at).toBe(1200)
  })
  it('isolates rounds and sessions and rejects gaps/conflicting payloads', () => {
    const store = storage(); const box = createLiveOutbox(scope, store)
    box.enqueue(event(1))
    expect(createLiveOutbox({ ...scope, roundId: 2 }, store).pending()).toEqual([])
    expect(() => box.enqueue(event(1, 1001))).toThrow()
    expect(() => box.enqueue(event(3))).toThrow()
  })
  it('does not publish an event if persistence fails', () => {
    const box = createLiveOutbox(scope, { ...storage(), setItem() { throw Error('quota') } })
    expect(() => box.enqueue(event(1))).toThrow('quota')
    expect(box.pending()).toEqual([])
  })
})
