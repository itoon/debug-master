import { describe, expect, it } from 'vitest'
import type { LivePlayer, PlayerHello, ProgressMsg } from '../../app/utils/live/protocol'
import { GRACE_MS, IDLE_MS, MAX_LEVEL_ID, maxLevelPoints } from '../../app/utils/live/protocol'
import {
  advanceClock,
  applyHostCommand,
  applyProgress,
  comparePlayers,
  createRoom,
  isIdleExpired,
  joinPlayer,
  nextAlarmAt,
  snapshot,
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
const prog = (o: Partial<ProgressMsg> = {}): ProgressMsg => ({
  type: 'progress',
  roundId: 1,
  score: 900,
  levelsCompleted: 1,
  bestCombo: 4,
  combo: 4,
  ...o,
})

/** Countdown room: p-aaaaaa seated in lane 0, started at t=0 (startAt 3000, endAt 483000). */
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

describe('applyProgress', () => {
  it('accepts monotonic cumulative progress', () => {
    const r = running()
    expect(applyProgress(r, 'p-aaaaaa', prog(), 10_000)).toBe(true)
    expect(applyProgress(r, 'p-aaaaaa', prog({ score: 800 }), 11_000)).toBe(false)
    expect(r.players['p-aaaaaa']).toMatchObject({ score: 900, levelsCompleted: 1, bestCombo: 4, combo: 4 })
  })

  it('writes all four values on success', () => {
    const r = running()
    expect(applyProgress(r, 'p-aaaaaa', prog({ score: 1500, levelsCompleted: 2, bestCombo: 5, combo: 2 }), 10_000)).toBe(true)
    expect(r.players['p-aaaaaa']).toMatchObject({ score: 1500, levelsCompleted: 2, bestCombo: 5, combo: 2 })
  })

  it('rejects score without a cleared level and jumps above the cap', () => {
    const r = running()
    expect(applyProgress(r, 'p-aaaaaa', prog({ levelsCompleted: 0 }), 10_000)).toBe(false)
    expect(applyProgress(r, 'p-aaaaaa', prog({ score: maxLevelPoints(4) + 1 }), 10_000)).toBe(false)
    expect(applyProgress(r, 'p-aaaaaa', prog({ score: maxLevelPoints(4) }), 10_000)).toBe(true)
  })

  it('rejects decreasing levelsCompleted or bestCombo and levelsCompleted above MAX_LEVEL_ID', () => {
    const r = running()
    expect(applyProgress(r, 'p-aaaaaa', prog({ score: 2000, levelsCompleted: 2 }), 10_000)).toBe(true)
    expect(applyProgress(r, 'p-aaaaaa', prog({ score: 2000, levelsCompleted: 1 }), 10_001)).toBe(false)
    expect(applyProgress(r, 'p-aaaaaa', prog({ score: 2000, levelsCompleted: 2, bestCombo: 3, combo: 3 }), 10_002)).toBe(false)
    const r2 = running()
    expect(applyProgress(r2, 'p-aaaaaa', prog({ score: 0, levelsCompleted: MAX_LEVEL_ID + 1, bestCombo: 0, combo: 0 }), 10_000)).toBe(false)
  })

  it('ignores unknown players and rooms that are not running', () => {
    const r = running()
    expect(applyProgress(r, 'p-zzzzzz', prog(), 10_000)).toBe(false)
    const c = running0()
    expect(applyProgress(c, 'p-aaaaaa', prog(), 1000)).toBe(false)
    const l = createRoom('CODI-1', 0)
    joinPlayer(l, hello('p-aaaaaa'), conn('p-aaaaaa'), 0)
    expect(applyProgress(l, 'p-aaaaaa', prog(), 1000)).toBe(false)
  })

  it('ignores a previous round progress after newRound', () => {
    const r = running()
    applyHostCommand(r, { type: 'endEarly' }, conn('p-aaaaaa'), 20_000)
    applyHostCommand(r, { type: 'newRound' }, conn('p-aaaaaa'), 30_000)
    applyHostCommand(r, { type: 'start' }, conn('p-aaaaaa'), 31_000)
    advanceClock(r, 34_000)
    expect(applyProgress(r, 'p-aaaaaa', prog({ roundId: 1 }), 35_000)).toBe(false)
    expect(applyProgress(r, 'p-aaaaaa', prog({ roundId: 2 }), 35_000)).toBe(true)
  })

  it('honours the 2s grace after endAt', () => {
    const r = running()
    advanceClock(r, 483_000)
    expect(r.phase).toBe('finished')
    expect(applyProgress(r, 'p-aaaaaa', prog(), 483_000 + GRACE_MS)).toBe(true)
    expect(applyProgress(r, 'p-aaaaaa', prog({ score: 1800, levelsCompleted: 2 }), 483_000 + GRACE_MS + 1)).toBe(false)
    expect(r.players['p-aaaaaa'].score).toBe(900)
  })

  it('rejects progress from queued players', () => {
    const r = running()
    expect(joinPlayer(r, hello('p-bbbbbb'), conn('p-aaaaaa', 'p-bbbbbb'), 5000)).toBe('queued')
    expect(applyProgress(r, 'p-bbbbbb', prog(), 10_000)).toBe(false)
    expect(r.players['p-bbbbbb'].score).toBe(0)
  })
})

describe('advanceClock', () => {
  it('moves countdown to running at startAt and running to finished at endAt', () => {
    const r = running0()
    expect(advanceClock(r, 2999)).toBe(false)
    expect(r.phase).toBe('countdown')
    expect(advanceClock(r, 3000)).toBe(true)
    expect(r.phase).toBe('running')
    expect(advanceClock(r, 482_999)).toBe(false)
    expect(advanceClock(r, 483_000)).toBe(true)
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
    expect(nextAlarmAt(countdownRoom, 3)).toBe(3000)
    expect(nextAlarmAt(runningRoom, 3)).toBe(483_000)
    expect(nextAlarmAt(lobbyRoom, 0)).toBe(lobbyRoom.lastActivity + IDLE_MS)
    expect(nextAlarmAt(lobbyRoom, 2)).toBeNull()
    expect(nextAlarmAt(countdownRoom, 0)).toBe(3000)
  })

  it('detects idle expiry only with no open sockets', () => {
    const r = createRoom('CODI-1', 100)
    expect(isIdleExpired(r, 0, 100 + IDLE_MS - 1)).toBe(false)
    expect(isIdleExpired(r, 0, 100 + IDLE_MS)).toBe(true)
    expect(isIdleExpired(r, 1, 100 + IDLE_MS)).toBe(false)
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

  it('comparePlayers orders playing by score, levels, joinedAt then queued by queuedAt', () => {
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
      durationSec: 480,
      roundId: 1,
      startAt: 3000,
      endAt: 483_000,
    })
  })
})
