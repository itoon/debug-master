import type { GameplayEventMsg } from './protocol'
export type OutboxScope = { room: string; roundId: number; playerId: string; sessionId: string }
export type OutboxStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export interface LiveOutbox {
  enqueue(event: GameplayEventMsg): void
  acknowledge(sequence: number): void
  pending(): GameplayEventMsg[]
  clear(): void
}
/** Write before publishing in memory. Copies prevent callers mutating retry identities. */
export function createLiveOutbox(scope: OutboxScope, storage: OutboxStorage = localStorage): LiveOutbox {
  const key = `debug-master:live-outbox:${JSON.stringify([scope.room.toUpperCase(), scope.roundId, scope.playerId, scope.sessionId])}`
  const raw = storage.getItem(key)
  let events: GameplayEventMsg[] = raw ? JSON.parse(raw) : []
  if (!Array.isArray(events) || events.some((e, i) => e.type !== 'gameplay' || e.roundId !== scope.roundId || e.sessionId !== scope.sessionId || !Number.isSafeInteger(e.sequence) || !Number.isSafeInteger(e.at) || (i > 0 && e.sequence !== events[i - 1]!.sequence + 1))) throw Error('Invalid saved Live inputs')
  const copy = (value: GameplayEventMsg[]) => value.map(e => ({ ...e }))
  const write = (next: GameplayEventMsg[]) => { storage.setItem(key, JSON.stringify(next)); events = copy(next) }
  return {
    enqueue(event) {
      if (event.roundId !== scope.roundId || event.sessionId !== scope.sessionId) throw Error('Wrong Live session')
      const existing = events.find(e => e.sequence === event.sequence)
      if (existing) { if (JSON.stringify(existing) !== JSON.stringify(event)) throw Error('Conflicting Live input'); return }
      if (events.length && event.sequence !== events.at(-1)!.sequence + 1) throw Error('Live input gap')
      write([...events, { ...event }])
    },
    acknowledge(sequence) { const next = events.filter(e => e.sequence > sequence); if (next.length !== events.length) write(next) },
    pending: () => copy(events),
    clear() { storage.removeItem(key); events = [] },
  }
}
