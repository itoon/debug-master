import { describe, expect, it } from 'vitest'
import type { LivePlayer, PlayerHello } from '../../app/utils/live/protocol'
import { IDLE_MS } from '../../app/utils/live/protocol'
import {
  advanceClock,
  applyHostCommand,
  comparePlayers,
  createRoom,
  isIdleExpired,
  isSocketFresh,
  joinPlayer,
  nextAlarmAt,
  snapshot,
  STALE_MS,
  SWEEP_MS,
} from '../src/room-logic'
import type { StoredRoom } from '../src/room-logic'

const hello = (pid: string, name = 'P'): PlayerHello => ({
  type: 'hello',
  pid,
  name,
  avatarId: 'codi_default.svg',
  age: 9,
})
const conn = (...pids: string[]) => new Set(pids)
/** Countdown room: p-aaaaaa seated in lane 0, started at t=0 (startAt 3000, endAt 303000). */
function running0(): StoredRoom {
  const r = createRoom('CODI-1', 0)
  joinPlayer(r, hello('p-aaaaaa'), conn('p-aaaaaa'), 0)
  applyHostCommand(r, { type: 'start' }, conn('p-aaaaaa'), 0)
  return r
}
function running(): StoredRoom {
  const r = running0()
  advanceClock(r, 3000)
  return r
}

describe('advanceClock', () => {
  it('moves countdown to running at startAt and running to finished at endAt', () => {
    const r = running0()
    expect(advanceClock(r, 2999)).toBe(false)
    expect(r.phase).toBe('countdown')
    expect(advanceClock(r, 3000)).toBe(true)
    expect(r.phase).toBe('running')
    expect(advanceClock(r, 302_999)).toBe(false)
    expect(advanceClock(r, 303_000)).toBe(true)
    expect(r.phase).toBe('finished')
    expect(advanceClock(r, 999_999)).toBe(false)
  })

  it('advances countdown → running → finished even when woken late', () => {
    const r = running0()
    expect(advanceClock(r, 500_000)).toBe(true)
    expect(r.phase).toBe('finished')
  })

  it('never moves a lobby or a finished room (endEarly during countdown)', () => {
    const l = createRoom('CODI-1', 0)
    expect(advanceClock(l, 999_999)).toBe(false)
    expect(l.phase).toBe('lobby')
    const r = running0()
    applyHostCommand(r, { type: 'endEarly' }, conn('p-aaaaaa'), 1000)
    expect(r.phase).toBe('finished')
    expect(r.startAt).toBe(3000)
    expect(r.endAt).toBe(1000)
    expect(advanceClock(r, 999_999)).toBe(false)
    expect(r.phase).toBe('finished')
  })
})

describe('alarms', () => {
  it('schedules alarms', () => {
    const countdownRoom = running0()
    const runningRoom = running()
    const lobbyRoom = createRoom('CODI-1', 100)
    const only = (open: number) => ({ open, players: 0 }) // host/screen sockets only
    expect(nextAlarmAt(countdownRoom, only(3), 1000)).toBe(3000)
    expect(nextAlarmAt(runningRoom, only(3), 4000)).toBe(303_000)
    expect(nextAlarmAt(lobbyRoom, only(0), 200)).toBe(lobbyRoom.lastActivity + IDLE_MS)
    expect(nextAlarmAt(lobbyRoom, only(2), 200)).toBeNull()
    expect(nextAlarmAt(countdownRoom, only(0), 1000)).toBe(3000)
  })

  it('adds a stale-socket sweep while player sockets are open', () => {
    const lobbyRoom = createRoom('CODI-1', 100)
    const players = { open: 3, players: 2 }
    // lobby/finished: sweep only
    expect(nextAlarmAt(lobbyRoom, players, 1000)).toBe(1000 + SWEEP_MS)
    // running: the earlier of endAt and the sweep
    const runningRoom = running()
    expect(nextAlarmAt(runningRoom, players, 4000)).toBe(4000 + SWEEP_MS)
    expect(nextAlarmAt(runningRoom, players, 290_000)).toBe(303_000)
    // countdown ends before the sweep
    expect(nextAlarmAt(running0(), players, 1000)).toBe(3000)
  })

  it('keeps an armed sweep alarm instead of pushing it back on every message', () => {
    const r = createRoom('CODI-1', 100)
    const players = { open: 1, players: 1 }
    const armed = nextAlarmAt(r, players, 1000, null)!
    expect(armed).toBe(1000 + SWEEP_MS)
    expect(nextAlarmAt(r, players, 5000, armed)).toBe(armed) // unchanged -> no storage write
    expect(nextAlarmAt(r, players, armed, armed)).toBe(armed + SWEEP_MS) // already due: re-arm
    expect(nextAlarmAt(r, players, 1000, 1000 + IDLE_MS)).toBe(1000 + SWEEP_MS) // a far idle alarm is pulled in
    // a phase alarm earlier than the armed sweep still wins
    const run = running()
    expect(nextAlarmAt(run, players, 290_000, 290_000 + SWEEP_MS)).toBe(303_000)
  })

  it('detects idle expiry only with no open sockets', () => {
    const r = createRoom('CODI-1', 100)
    expect(isIdleExpired(r, 0, 100 + IDLE_MS - 1)).toBe(false)
    expect(isIdleExpired(r, 0, 100 + IDLE_MS)).toBe(true)
    expect(isIdleExpired(r, 1, 100 + IDLE_MS)).toBe(false)
  })
})

describe('isSocketFresh', () => {
  it('uses the later of the last auto-answered ping and the last message', () => {
    expect(isSocketFresh(null, 1000, 1000 + STALE_MS)).toBe(true)
    expect(isSocketFresh(null, 1000, 1001 + STALE_MS)).toBe(false)
    expect(isSocketFresh(50_000, 1000, 50_000 + STALE_MS)).toBe(true) // pings keep a quiet player fresh
    expect(isSocketFresh(50_000, 1000, 50_001 + STALE_MS)).toBe(false)
    expect(isSocketFresh(1000, 60_000, 60_000 + STALE_MS)).toBe(true) // messages count too
  })

  it('tolerates a hidden tab pinging once a minute', () => {
    expect(STALE_MS).toBeGreaterThan(60_000)
    expect(isSocketFresh(0, 0, 61_000)).toBe(true)
  })
})

describe('snapshot', () => {
  const mk = (id: string, o: Partial<LivePlayer>): LivePlayer => ({
    id,
    name: id,
    avatarId: 'codi_default.svg',
    age: 9,
    status: 'playing',
    lane: 0,
    score: 0,
    levelsCompleted: 0,
    bestCombo: 0,
    combo: 0,
    connected: true,
    joinedAt: 0,
    queuedAt: null,
    ...o,
  })

  it('comparePlayers orders standalone playing rows by score, levels, joinedAt then queue time', () => {
    const list = [
      mk('q2', { status: 'queued', lane: null, queuedAt: 20 }),
      mk('a', { score: 100, levelsCompleted: 1, joinedAt: 5 }),
      mk('q1', { status: 'queued', lane: null, queuedAt: 10 }),
      mk('b', { score: 200, levelsCompleted: 1, joinedAt: 6 }),
      mk('c', { score: 100, levelsCompleted: 2, joinedAt: 7 }),
      mk('d', { score: 100, levelsCompleted: 1, joinedAt: 3 }),
    ]
    expect(list.sort(comparePlayers).map((p) => p.id)).toEqual(['b', 'c', 'd', 'a', 'q1', 'q2'])
  })

  it('snapshot sorts playing by score then queue by queuedAt and marks connection', () => {
    const r = running()
    joinPlayer(r, hello('p-bbbbbb'), conn('p-aaaaaa', 'p-bbbbbb'), 4000) // queued (mid-round)
    joinPlayer(r, hello('p-cccccc'), conn('p-aaaaaa', 'p-bbbbbb', 'p-cccccc'), 3500) // queued earlier
    r.players['p-aaaaaa'].score = 50
    const s = snapshot(r, conn('p-aaaaaa', 'p-bbbbbb'), { screens: 2, hosts: 1 }, 123_456)
    const pub = (pid: string) => r.players[pid].id
    expect(s.players.map((p) => p.id)).toEqual([pub('p-aaaaaa'), pub('p-cccccc'), pub('p-bbbbbb')])
    expect(s.players.map((p) => p.connected)).toEqual([true, false, true])
    expect(s.serverNow).toBe(123_456)
    expect(s.screens).toBe(2)
    expect(s.hosts).toBe(1)
    expect(s).toMatchObject({
      code: 'CODI-1',
      phase: 'running',
      mode: 'A',
      durationSec: 300,
      roundId: 1,
      startAt: 3000,
      endAt: 303_000,
    })
  })
})
