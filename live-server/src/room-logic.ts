// Pure room logic for the Live Race Room. No I/O, no `cloudflare:workers` import:
// the Durable Object owns sockets and storage and passes connectivity in as a Set of pids.
//
// Identity: a device's `pid` is a secret (it alone re-binds a seat), sent only in `hello`.
// Every player also gets a random public `id` on first join; only that id is ever broadcast
// (snapshot) or accepted from the host (kick). `room.players` is keyed by the secret pid.
import type {
  HostCommand,
  LivePlayer,
  ModeId,
  Phase,
  PlayerHello,
  LiveRoundConfig,
  RoomState,
} from '../../app/utils/live/protocol'
import {
  COUNTDOWN_MS,
  DEFAULT_DURATION_SEC,
  IDLE_MS,
  MAX_PLAYERS,
} from '../../app/utils/live/protocol'
import { initializeRoundScoring, type LiveScoringState } from './scoring'

export type StoredPlayer = Omit<LivePlayer, 'connected'> & {
  /** Secret device id (also the key in StoredRoom.players). Never leaves the server. */
  pid: string
  scoring?: LiveScoringState
}

export interface StoredRoom {
  code: string
  phase: Phase
  mode: ModeId
  durationSec: number
  roundId: number
  round?: LiveRoundConfig
  startAt: number | null
  endAt: number | null
  /** Keyed by the secret pid. */
  players: Record<string, StoredPlayer>
  hostKeyHash?: string
  lastActivity: number
}

export function createRoom(code: string, now: number): StoredRoom {
  return {
    code,
    phase: 'lobby',
    mode: 'A',
    durationSec: DEFAULT_DURATION_SEC,
    roundId: 1,
    startAt: null,
    endAt: null,
    players: {},
    lastActivity: now,
  }
}

/** Connected playing players plus every queued player. */
export function seatCount(room: StoredRoom, connected: Set<string>): number {
  let n = 0
  for (const p of Object.values(room.players)) {
    if (p.status === 'queued' || connected.has(p.pid)) n++
  }
  return n
}

function lowestFreeLane(room: StoredRoom): number | null {
  const used = new Set<number>()
  for (const p of Object.values(room.players)) if (p.lane !== null) used.add(p.lane)
  for (let lane = 0; lane < MAX_PLAYERS; lane++) if (!used.has(lane)) return lane
  return null
}

export function joinPlayer(
  room: StoredRoom,
  hello: PlayerHello,
  connected: Set<string>,
  now: number,
): 'playing' | 'queued' | 'full' {
  room.lastActivity = now
  const existing = room.players[hello.pid]
  if (existing) {
    // A known device keeps its seat (and lane/score) whatever the phase; only the profile is locked mid-round.
    if (room.phase === 'lobby' || existing.status === 'queued') {
      existing.name = hello.name
      existing.avatarId = hello.avatarId
      existing.age = hello.age
    }
    return existing.status
  }

  if (seatCount(room, connected) >= MAX_PLAYERS) return 'full'

  const base = {
    id: newPublicId(room),
    pid: hello.pid,
    name: hello.name,
    avatarId: hello.avatarId,
    age: hello.age,
    score: 0,
    levelsCompleted: 0,
    bestCombo: 0,
    combo: 0,
    joinedAt: now,
  }

  if (room.phase !== 'lobby') {
    room.players[hello.pid] = { ...base, status: 'queued', lane: null, queuedAt: now }
    return 'queued'
  }

  let lane = lowestFreeLane(room)
  if (lane === null) {
    // Every lane is held, yet fewer than MAX_PLAYERS are connected, so some holder is offline
    // (still inside the reconnect grace window). Hand its lane to the newcomer.
    const stale = Object.values(room.players)
      .filter((p) => p.status === 'playing' && p.lane !== null && !connected.has(p.pid))
      .sort((a, b) => a.lane! - b.lane!)[0]
    if (!stale) return 'full'
    lane = stale.lane
    delete room.players[stale.pid]
  }
  room.players[hello.pid] = { ...base, status: 'playing', lane, queuedAt: null }
  return 'playing'
}

/** A fresh public id, unique within the room. */
export function newPublicId(room: StoredRoom): string {
  const taken = new Set(Object.values(room.players).map((p) => p.id))
  let id: string
  do id = crypto.randomUUID()
  while (taken.has(id))
  return id
}

/** Secret pid of the player with public id `id`, or null. */
export function pidForPublicId(room: StoredRoom, id: string): string | null {
  for (const p of Object.values(room.players)) if (p.id === id) return p.pid
  return null
}

/**
 * Rooms saved before the public/secret split keyed players by pid and broadcast it as `id`.
 * Give such players a fresh public id so the old (leaked) one stops being their identity.
 */
export function migrateRoom(room: StoredRoom): StoredRoom {
  for (const [key, p] of Object.entries(room.players)) {
    if (typeof p.pid === 'string') continue
    p.pid = key
    p.id = newPublicId(room)
  }
  return room
}

/** Removes the player bound to the secret `pid`. */
export function leavePlayer(room: StoredRoom, pid: string): boolean {
  if (!room.players[pid]) return false
  delete room.players[pid]
  return true
}

function startNewRound(room: StoredRoom, connected: Set<string>): void {
  const alive = Object.values(room.players).filter((p) => connected.has(p.pid))
  const staying = alive
    .filter((p) => p.status === 'playing')
    .sort((a, b) => (a.lane ?? Infinity) - (b.lane ?? Infinity))
  const queue = alive
    .filter((p) => p.status === 'queued')
    .sort((a, b) => (a.queuedAt ?? 0) - (b.queuedAt ?? 0))

  const next: Record<string, StoredPlayer> = {}
  const seat = (p: StoredPlayer, lane: number): void => {
    const { scoring: _previousScoring, ...profile } = p
    next[p.pid] = {
      ...profile,
      status: 'playing',
      lane,
      queuedAt: null,
      score: 0,
      levelsCompleted: 0,
      bestCombo: 0,
      combo: 0,
    }
  }
  let lane = 0
  for (const p of staying) seat(p, lane++)
  let i = 0
  for (; i < queue.length && lane < MAX_PLAYERS; i++) seat(queue[i], lane++)
  for (; i < queue.length; i++) next[queue[i].pid] = { ...queue[i] } // overflow keeps its queue position

  room.players = next
  room.roundId += 1
  room.phase = 'lobby'
  delete room.round
  room.startAt = null
  room.endAt = null
}

export function applyHostCommand(
  room: StoredRoom,
  cmd: HostCommand,
  connected: Set<string>,
  now: number,
): boolean {
  let changed = false
  switch (cmd.type) {
    case 'setMode':
      if (room.phase === 'lobby' && room.mode !== cmd.mode) {
        room.mode = cmd.mode
        changed = true
      }
      break
    case 'setDuration':
      if (room.phase === 'lobby' && room.durationSec !== cmd.durationSec) {
        room.durationSec = cmd.durationSec
        changed = true
      }
      break
    case 'start': {
      if (room.phase !== 'lobby') break
      const ready = Object.values(room.players).some((p) => p.status === 'playing' && connected.has(p.pid))
      if (!ready) break
      room.phase = 'countdown'
      room.startAt = now + COUNTDOWN_MS
      room.endAt = room.startAt + room.durationSec * 1000
      initializeRoundScoring(room)
      changed = true
      break
    }
    case 'endEarly':
      if (room.phase !== 'countdown' && room.phase !== 'running') break
      room.phase = 'finished'
      room.endAt = Math.min(room.endAt ?? now, now)
      changed = true
      break
    case 'newRound':
      if (room.phase !== 'finished') break
      startNewRound(room, connected)
      changed = true
      break
    case 'kick': {
      // cmd.playerId is the public id; the record is keyed by the secret pid.
      const pid = pidForPublicId(room, cmd.playerId)
      changed = pid !== null && leavePlayer(room, pid)
      break
    }
  }
  if (changed) room.lastActivity = now
  return changed
}

export async function hashHostKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** The first key reserves the room; later claims must present the same hash. */
export function claimHost(room: StoredRoom, keyHash: string | null): boolean {
  if (!keyHash) return false
  if (room.hostKeyHash === undefined) {
    room.hostKeyHash = keyHash
    return true
  }
  return room.hostKeyHash === keyHash
}

/** countdown -> running -> finished only; lobby and finished rooms are never moved. */
export function advanceClock(room: StoredRoom, now: number): boolean {
  let changed = false
  if (room.phase === 'countdown' && room.startAt !== null && now >= room.startAt) {
    room.phase = 'running'
    changed = true
  }
  if (room.phase === 'running' && room.endAt !== null && now >= room.endAt) {
    room.phase = 'finished'
    changed = true
  }
  return changed
}

/**
 * A player socket counts as connected only while it has been heard from recently: the last
 * auto-answered 'ping' or the last message, whichever is later. Clients ping every 20 s, but
 * Chrome throttles timers in hidden tabs to once a minute, hence 75 s.
 */
export const STALE_MS = 75_000
/** While player sockets are open, an alarm at least this often closes stale ones. */
export const SWEEP_MS = 30_000

export function isSocketFresh(lastAutoResponse: number | null, lastMessage: number, now: number): boolean {
  return now - Math.max(lastAutoResponse ?? 0, lastMessage) <= STALE_MS
}

/**
 * Earliest of the phase alarm (countdown/running), the stale-socket sweep (while player sockets are
 * open) and the idle cleanup (no sockets). `current` is the alarm already armed: a sweep alarm that
 * already fires within SWEEP_MS is kept, so the alarm is not rewritten on every message.
 */
export function nextAlarmAt(
  room: StoredRoom,
  sockets: { open: number; players: number },
  now: number,
  current: number | null = null,
): number | null {
  let at: number | null = null
  if (room.phase === 'countdown') at = room.startAt
  else if (room.phase === 'running') at = room.endAt
  else if (sockets.open === 0) at = room.lastActivity + IDLE_MS
  if (sockets.players > 0) {
    const sweep = current !== null && current > now && current <= now + SWEEP_MS ? current : now + SWEEP_MS
    at = at === null ? sweep : Math.min(at, sweep)
  }
  return at
}

export function isIdleExpired(room: StoredRoom, openSockets: number, now: number): boolean {
  return openSockets === 0 && now >= room.lastActivity + IDLE_MS
}

type RankedPlayer = Omit<LivePlayer, 'connected'> & { scoring?: LiveScoringState }

export function comparePlayers(a: RankedPlayer, b: RankedPlayer, strategy: 'BEST' | 'LATEST' = 'BEST'): number {
  if (a.status !== b.status) return a.status === 'playing' ? -1 : 1
  if (a.status === 'queued') return (a.queuedAt ?? 0) - (b.queuedAt ?? 0)
  const sa = a.scoring?.session
  const sb = b.scoring?.session
  // Lobby players have no session yet. Running-round players always use canonical update time.
  const time = (sa?.updatedAt ?? a.joinedAt) - (sb?.updatedAt ?? b.joinedAt)
  const idA = sa?.id ?? a.id
  const idB = sb?.id ?? b.id
  return b.score - a.score || b.levelsCompleted - a.levelsCompleted ||
    (strategy === 'BEST' ? time : -time) || (idA < idB ? -1 : idA > idB ? 1 : 0)
}

export function snapshot(
  room: StoredRoom,
  connected: Set<string>,
  counts: { screens: number; hosts: number },
  now: number,
): RoomState {
  // Explicit public whitelist: adding private fields to StoredPlayer cannot leak them.
  const players: LivePlayer[] = Object.values(room.players)
    .sort((a, b) => comparePlayers(a, b, room.round?.config.scoringStrategy ?? 'BEST'))
    .map(p => ({ id: p.id, name: p.name, avatarId: p.avatarId, age: p.age, status: p.status,
      lane: p.lane, score: p.score, levelsCompleted: p.levelsCompleted, bestCombo: p.bestCombo,
      combo: p.combo, joinedAt: p.joinedAt, queuedAt: p.queuedAt, connected: connected.has(p.pid) }))
  return {
    code: room.code,
    phase: room.phase,
    mode: room.mode,
    durationSec: room.durationSec,
    roundId: room.roundId,
    ...(room.round ? { round: { setId: room.round.setId, config: { ...room.round.config } } } : {}),
    startAt: room.startAt,
    endAt: room.endAt,
    serverNow: now,
    players,
    screens: counts.screens,
    hosts: counts.hosts,
  }
}
