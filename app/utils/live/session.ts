// The live player on this device, remembered across a reload. Framework-free: no Vue imports.
// Every localStorage access is wrapped in try/catch (private mode / blocked storage).
import { PID_RE, normalizeRoomCode } from './protocol'

const SESSION_KEY = 'debug-master:live-session'
/** Longest round (15 min) plus a little: an older session is never resumed. */
export const SESSION_MAX_AGE_MS = 16 * 60 * 1000

export interface LiveSession {
  pid: string
  room: string
  nickname: string
  age?: number
  avatarId: string
  savedAt: number
}

export function saveLiveSession(session: LiveSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* storage blocked: a reload just shows the form again */
  }
}

export function clearLiveSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

/** The saved session for this device id and room, if well-formed and at most SESSION_MAX_AGE_MS old. */
export function loadLiveSession(pid: string, room: string, now: number): LiveSession | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  let s: Partial<LiveSession>
  try {
    s = JSON.parse(raw) as Partial<LiveSession>
  } catch {
    return null
  }
  if (!s || typeof s !== 'object') return null
  if (typeof s.pid !== 'string' || !PID_RE.test(s.pid) || s.pid !== pid) return null
  if (typeof s.room !== 'string' || normalizeRoomCode(s.room) !== normalizeRoomCode(room)) return null
  if (typeof s.nickname !== 'string' || !s.nickname.trim()) return null
  if (s.age !== undefined && (typeof s.age !== 'number' || !Number.isInteger(s.age))) return null
  if (typeof s.avatarId !== 'string') return null
  if (typeof s.savedAt !== 'number' || !Number.isFinite(s.savedAt)) return null
  if (s.savedAt > now + 60_000 || now - s.savedAt > SESSION_MAX_AGE_MS) return null
  return { pid: s.pid, room: s.room, nickname: s.nickname, age: s.age, avatarId: s.avatarId, savedAt: s.savedAt }
}

// Ordered scoring transport. The socket never queues gameplay: this durable outbox owns replay.
import type { CompetitionSession } from '../../types/competition'
import { LIVE_PROTOCOL_VERSION } from './protocol'
import type { GameplayEventMsg, ScoringMsg } from './protocol'
import { createLiveOutbox } from './outbox'
import type { LiveOutbox, OutboxStorage } from './outbox'
export type LiveSyncStatus = 'resync' | 'ready' | 'pending' | 'offline' | 'storage-error' | 'reload-required' | 'closed'
export type GameplayInput = Pick<GameplayEventMsg, 'levelId' | 'action' | 'direction'>
export function createLiveReplay(opts: {
  room: string; playerId: () => string; storage?: OutboxStorage
  send(event: GameplayEventMsg): void
  changed(session: CompetitionSession | null, message: ScoringMsg | null, status: LiveSyncStatus): void
}) {
  let box: LiveOutbox | null = null
  let session: CompetitionSession | null = null
  let roundId = -1, acknowledged = 0, lastAt = 0, sent = 0
  let online = true, recovering = true, halted = false
  let status: LiveSyncStatus = 'resync'
  const notify = (next: LiveSyncStatus, message: ScoringMsg | null = null) => {
    status = next
    opts.changed(session, message, next)
  }
  const flush = (message: ScoringMsg | null = null) => {
    const pending = box?.pending() ?? []
    if (pending.length && pending[0]!.sequence !== acknowledged + 1) {
      halted = true; notify('reload-required', message); return
    }
    if (!online) { notify(recovering ? 'resync' : 'offline', message); return }
    if (!pending.length) recovering = false
    notify(recovering ? 'resync' : pending.length ? 'pending' : 'ready', message)
    // Each accepted local input is sent once per connection/recovery. Partial ACKs only trim.
    for (const event of pending) {
      if (event.sequence <= sent) continue
      try { opts.send(event); sent = event.sequence }
      catch { online = false; sent = 0; notify('offline'); return }
    }
  }
  return {
    pending: () => box?.pending() ?? [],
    disconnected() {
      online = false; sent = 0
      if (!halted) notify(session && !recovering ? 'offline' : 'resync')
    },
    connecting() {
      online = true; sent = 0; recovering = true
      if (!halted) notify('resync')
    },
    accept(message: ScoringMsg) {
      if (halted) return
      if (message.protocolVersion !== LIVE_PROTOCOL_VERSION) { halted = true; notify('reload-required'); return }
      try {
        const incoming = message.session
        if (!incoming) { session = null; box = null; recovering = true; notify('resync', message); return }
        if (incoming.id !== session?.id || roundId !== message.roundId) {
          session = incoming; roundId = message.roundId; sent = 0; lastAt = incoming.updatedAt
          box = createLiveOutbox({ room: opts.room, roundId, playerId: opts.playerId(), sessionId: incoming.id }, opts.storage)
        }
        online = true
        session = incoming
        acknowledged = message.acknowledgedSequence
        sent = Math.max(sent, acknowledged)
        lastAt = Math.max(lastAt, incoming.updatedAt, ...box!.pending().map(e => e.at))
        box!.acknowledge(acknowledged)
        if (message.nextExpectedSequence !== acknowledged + 1) { halted = true; notify('reload-required', message); return }
        if (message.error && message.error !== 'sequence_gap') {
          box!.clear(); halted = true
          notify(message.error === 'round_closed' ? 'closed' : 'reload-required', message)
          return
        }
        if (message.error === 'sequence_gap') { sent = acknowledged; recovering = true }
        flush(message)
      } catch { halted = true; notify('storage-error', message) }
    },
    enqueue(input: GameplayInput, serverNow: number): boolean {
      if (halted || recovering || !['ready', 'pending', 'offline'].includes(status) || !session || !box) return false
      const pending = box.pending()
      const event: GameplayEventMsg = {
        type: 'gameplay', protocolVersion: LIVE_PROTOCOL_VERSION, roundId, sessionId: session.id,
        sequence: (pending.at(-1)?.sequence ?? acknowledged) + 1,
        at: Math.max(lastAt, Math.round(serverNow)), ...input,
      }
      try { box.enqueue(event) } catch { halted = true; notify('storage-error'); return false }
      lastAt = event.at
      flush()
      return true
    },
    invalidate() {
      try { box?.clear() } catch { /* Old-round evidence is never replayed into the next scope. */ }
      session = null; box = null; roundId = -1; sent = 0; lastAt = 0; recovering = true; halted = false
      notify('resync')
    },
    reloadRequired() { halted = true; notify('reload-required') },
  }
}

/** Private hello responses can lead the trailing public round broadcast. Never drop that handshake. */
export function createLiveRoundInbox(opts: { invalidate(): void; accept(message: ScoringMsg): void }) {
  let publicRound: number | null = null
  let buffered: ScoringMsg | null = null
  return {
    privateState(message: ScoringMsg) {
      if (publicRound !== null && message.roundId < publicRound) return
      if (message.roundId === publicRound) { opts.accept(message); return }
      if (!buffered || message.roundId >= buffered.roundId) buffered = message
    },
    publicRound(roundId: number) {
      if (publicRound !== null && roundId < publicRound) return
      if (publicRound !== null && publicRound !== roundId) opts.invalidate()
      publicRound = roundId
      if (buffered && buffered.roundId < roundId) buffered = null
      if (buffered?.roundId === roundId) {
        const message = buffered; buffered = null; opts.accept(message)
      }
    },
  }
}
