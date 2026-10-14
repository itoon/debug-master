// Server-clock helpers for the Live Race Room. Keep this file free of imports so it stays portable.
// All timestamps are epoch ms; `offset` = serverNow - receivedAt, so `serverTime = now + offset`.

/** Offset between the server clock and this device's clock, measured when a state message arrives. */
export function clockOffset(serverNow: number, receivedAt: number): number {
  return serverNow - receivedAt
}

/** Current time on the server's clock. */
export function serverTime(offset: number, now: number = Date.now()): number {
  return now + offset
}

/** Whole seconds left until `endAt` (rounded up, never negative); 0 when there is no end. */
export function remainingSec(endAt: number | null, offset: number, now: number = Date.now()): number {
  if (endAt == null) return 0
  return Math.max(0, Math.ceil((endAt - serverTime(offset, now)) / 1000))
}

/** Whole seconds left until `startAt` (rounded up, never negative); 0 when there is no start. */
export function countdownSec(startAt: number | null, offset: number, now: number = Date.now()): number {
  if (startAt == null) return 0
  return Math.max(0, Math.ceil((startAt - serverTime(offset, now)) / 1000))
}
