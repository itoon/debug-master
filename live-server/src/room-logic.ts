// Pure room logic for the Live Race Room. No I/O, no `cloudflare:workers` import:
// the Durable Object owns sockets and storage and passes connectivity in as a Set of pids.
import type { HostCommand, LivePlayer, ModeId, Phase, PlayerHello } from '../../app/utils/live/protocol'
import { COUNTDOWN_MS, DEFAULT_DURATION_SEC, MAX_PLAYERS } from '../../app/utils/live/protocol'

export type StoredPlayer = Omit<LivePlayer, 'connected'>

export interface StoredRoom {
  code: string
  phase: Phase
  mode: ModeId
  durationSec: number
  roundId: number
  startAt: number | null
  endAt: number | null
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
    if (p.status === 'queued' || connected.has(p.id)) n++
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
    id: hello.pid,
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
      .filter((p) => p.status === 'playing' && p.lane !== null && !connected.has(p.id))
      .sort((a, b) => a.lane! - b.lane!)[0]
    if (!stale) return 'full'
    lane = stale.lane
    delete room.players[stale.id]
  }
  room.players[hello.pid] = { ...base, status: 'playing', lane, queuedAt: null }
  return 'playing'
}

export function leavePlayer(room: StoredRoom, pid: string): boolean {
  if (!room.players[pid]) return false
  delete room.players[pid]
  return true
}

function startNewRound(room: StoredRoom, connected: Set<string>): void {
  const alive = Object.values(room.players).filter((p) => connected.has(p.id))
  const staying = alive
    .filter((p) => p.status === 'playing')
    .sort((a, b) => (a.lane ?? Infinity) - (b.lane ?? Infinity))
  const queue = alive
    .filter((p) => p.status === 'queued')
    .sort((a, b) => (a.queuedAt ?? 0) - (b.queuedAt ?? 0))

  const next: Record<string, StoredPlayer> = {}
  const seat = (p: StoredPlayer, lane: number): void => {
    next[p.id] = {
      ...p,
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
  for (; i < queue.length; i++) next[queue[i].id] = { ...queue[i] } // overflow keeps its queue position

  room.players = next
  room.roundId += 1
  room.phase = 'lobby'
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
      const ready = Object.values(room.players).some((p) => p.status === 'playing' && connected.has(p.id))
      if (!ready) break
      room.phase = 'countdown'
      room.startAt = now + COUNTDOWN_MS
      room.endAt = room.startAt + room.durationSec * 1000
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
    case 'kick':
      changed = leavePlayer(room, cmd.playerId)
      break
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
