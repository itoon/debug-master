import { describe, expect, it } from 'vitest'
import type { PlayerHello } from '../../app/utils/live/protocol'
import { COUNTDOWN_MS, DEFAULT_DURATION_SEC, MAX_PLAYERS } from '../../app/utils/live/protocol'
import {
  applyHostCommand,
  claimHost,
  createRoom,
  hashHostKey,
  joinPlayer,
  leavePlayer,
  seatCount,
} from '../src/room-logic'

const hello = (pid: string, name = 'P'): PlayerHello => ({
  type: 'hello',
  pid,
  name,
  avatarId: 'codi_default.svg',
  age: 9,
})
const conn = (...pids: string[]) => new Set(pids)
const pidOf = (i: number) => `p-${String(i).padStart(6, '0')}`

describe('room lobby', () => {
  it('creates a lobby room with defaults', () => {
    expect(createRoom('CODI-1', 5)).toMatchObject({
      code: 'CODI-1',
      phase: 'lobby',
      mode: 'A',
      durationSec: DEFAULT_DURATION_SEC,
      roundId: 1,
      startAt: null,
      endAt: null,
      players: {},
      lastActivity: 5,
    })
  })

  it('seats lobby players in the lowest free lane', () => {
    const r = createRoom('CODI-1', 0)
    expect(joinPlayer(r, hello('p-aaaaaa'), conn('p-aaaaaa'), 1)).toBe('playing')
    expect(joinPlayer(r, hello('p-bbbbbb'), conn('p-aaaaaa', 'p-bbbbbb'), 2)).toBe('playing')
    leavePlayer(r, 'p-aaaaaa')
    joinPlayer(r, hello('p-cccccc'), conn('p-bbbbbb', 'p-cccccc'), 3)
    expect(r.players['p-cccccc'].lane).toBe(0)
  })

  it('two players with the same name get separate lanes', () => {
    const r = createRoom('CODI-1', 0)
    joinPlayer(r, hello('p-aaaaaa', 'มิ้นท์'), conn('p-aaaaaa'), 1)
    joinPlayer(r, hello('p-bbbbbb', 'มิ้นท์'), conn('p-aaaaaa', 'p-bbbbbb'), 2)
    expect(new Set(Object.values(r.players).map((p) => p.lane))).toEqual(new Set([0, 1]))
  })

  it('queues joiners while a round runs and returns full at 12 seats', () => {
    const r = createRoom('CODI-1', 0)
    const all = conn()
    for (let i = 0; i < MAX_PLAYERS; i++) {
      all.add(pidOf(i))
      expect(joinPlayer(r, hello(pidOf(i)), all, i)).toBe('playing')
    }
    expect(seatCount(r, all)).toBe(12)
    all.add('p-extra1')
    expect(joinPlayer(r, hello('p-extra1'), all, 100)).toBe('full')
    expect(r.players['p-extra1']).toBeUndefined()

    // a different room: 11 seated, round running -> new pid queues until seats hit 12
    const r2 = createRoom('CODI-2', 0)
    const c2 = conn()
    for (let i = 0; i < 11; i++) {
      c2.add(pidOf(i))
      joinPlayer(r2, hello(pidOf(i)), c2, i)
    }
    expect(applyHostCommand(r2, { type: 'start' }, c2, 1000)).toBe(true)
    r2.phase = 'running'
    c2.add('p-queue1')
    expect(joinPlayer(r2, hello('p-queue1'), c2, 2000)).toBe('queued')
    expect(r2.players['p-queue1']).toMatchObject({ status: 'queued', lane: null, queuedAt: 2000 })
    expect(seatCount(r2, c2)).toBe(12)
    c2.add('p-queue2')
    expect(joinPlayer(r2, hello('p-queue2'), c2, 2100)).toBe('full')
    // a known pid is never refused, even when seats are full
    expect(joinPlayer(r2, hello('p-queue1'), c2, 2200)).toBe('queued')
    expect(joinPlayer(r2, hello(pidOf(0)), c2, 2200)).toBe('playing')
  })

  it('does not count disconnected playing players as seats', () => {
    const r = createRoom('CODI-1', 0)
    const c = conn()
    for (let i = 0; i < MAX_PLAYERS; i++) {
      c.add(pidOf(i))
      joinPlayer(r, hello(pidOf(i)), c, i)
    }
    applyHostCommand(r, { type: 'start' }, c, 1000)
    r.phase = 'running'
    c.delete(pidOf(3))
    expect(seatCount(r, c)).toBe(11)
    c.add('p-queue1')
    expect(joinPlayer(r, hello('p-queue1'), c, 2000)).toBe('queued')
  })

  it('reuses a disconnected lobby player lane when no lane below 12 is free', () => {
    const r = createRoom('CODI-1', 0)
    const c = conn()
    for (let i = 0; i < MAX_PLAYERS; i++) {
      c.add(pidOf(i))
      joinPlayer(r, hello(pidOf(i)), c, i)
    }
    c.delete(pidOf(4)) // lane 4 owner drops but is still in the lobby
    c.add('p-newbie')
    expect(joinPlayer(r, hello('p-newbie'), c, 50)).toBe('playing')
    expect(r.players['p-newbie'].lane).toBe(4)
    expect(r.players[pidOf(4)]).toBeUndefined()
  })

  it('a reloaded booth device keeps its lane and score mid-round', () => {
    const r = createRoom('CODI-1', 0)
    joinPlayer(r, hello('p-aaaaaa'), conn('p-aaaaaa'), 1)
    applyHostCommand(r, { type: 'start' }, conn('p-aaaaaa'), 1000)
    r.phase = 'running'
    r.players['p-aaaaaa'].score = 500
    expect(joinPlayer(r, hello('p-aaaaaa', 'Renamed'), conn('p-aaaaaa'), 5_000)).toBe('playing')
    expect(r.players['p-aaaaaa']).toMatchObject({ lane: 0, score: 500, name: 'P' })
  })

  it('lets a known player edit the profile in lobby or while queued only', () => {
    const r = createRoom('CODI-1', 0)
    joinPlayer(r, hello('p-aaaaaa', 'Old'), conn('p-aaaaaa'), 1)
    joinPlayer(r, { ...hello('p-aaaaaa', 'New'), age: 12, avatarId: 'art-toy/10-party.svg' }, conn('p-aaaaaa'), 2)
    expect(r.players['p-aaaaaa']).toMatchObject({ name: 'New', age: 12, avatarId: 'art-toy/10-party.svg', lane: 0 })
    applyHostCommand(r, { type: 'start' }, conn('p-aaaaaa'), 1000)
    r.phase = 'running'
    const c = conn('p-aaaaaa', 'p-queue1')
    joinPlayer(r, hello('p-queue1', 'Q'), c, 2000)
    joinPlayer(r, hello('p-queue1', 'Q2'), c, 2100)
    expect(r.players['p-queue1']).toMatchObject({ name: 'Q2', status: 'queued', queuedAt: 2000 })
  })

  it('leavePlayer removes a record and reports whether it existed', () => {
    const r = createRoom('CODI-1', 0)
    joinPlayer(r, hello('p-aaaaaa'), conn('p-aaaaaa'), 1)
    expect(leavePlayer(r, 'p-aaaaaa')).toBe(true)
    expect(leavePlayer(r, 'p-aaaaaa')).toBe(false)
  })
})

describe('host commands', () => {
  it('start requires lobby and a connected playing player, and sets the clock', () => {
    const r = createRoom('CODI-1', 0)
    expect(applyHostCommand(r, { type: 'start' }, conn(), 1000)).toBe(false)
    joinPlayer(r, hello('p-aaaaaa'), conn('p-aaaaaa'), 1)
    expect(applyHostCommand(r, { type: 'start' }, conn(), 1000)).toBe(false) // seated but offline
    applyHostCommand(r, { type: 'setDuration', durationSec: 600 }, conn('p-aaaaaa'), 1000)
    expect(applyHostCommand(r, { type: 'start' }, conn('p-aaaaaa'), 1000)).toBe(true)
    expect(r).toMatchObject({ phase: 'countdown', startAt: 1000 + COUNTDOWN_MS, endAt: 604000 })
    expect(applyHostCommand(r, { type: 'setMode', mode: 'C' }, conn('p-aaaaaa'), 1100)).toBe(false)
    expect(applyHostCommand(r, { type: 'setDuration', durationSec: 480 }, conn('p-aaaaaa'), 1100)).toBe(false)
    expect(applyHostCommand(r, { type: 'start' }, conn('p-aaaaaa'), 1100)).toBe(false)
    expect(r.mode).toBe('A')
    expect(r.durationSec).toBe(600)
  })

  it('setMode and setDuration change the lobby settings', () => {
    const r = createRoom('CODI-1', 0)
    expect(applyHostCommand(r, { type: 'setMode', mode: 'B' }, conn(), 10)).toBe(true)
    expect(r.mode).toBe('B')
    expect(applyHostCommand(r, { type: 'setDuration', durationSec: 900 }, conn(), 11)).toBe(true)
    expect(r.durationSec).toBe(900)
    expect(r.lastActivity).toBe(11)
  })

  it('start ignores queued and disconnected players when counting', () => {
    const r = createRoom('CODI-1', 0)
    joinPlayer(r, hello('p-aaaaaa'), conn('p-aaaaaa'), 1)
    r.players['p-aaaaaa'].status = 'queued'
    r.players['p-aaaaaa'].lane = null
    expect(applyHostCommand(r, { type: 'start' }, conn('p-aaaaaa'), 1000)).toBe(false)
    expect(r.phase).toBe('lobby')
  })

  it('endEarly finishes a countdown or running round and clamps endAt', () => {
    const r = createRoom('CODI-1', 0)
    joinPlayer(r, hello('p-aaaaaa'), conn('p-aaaaaa'), 1)
    applyHostCommand(r, { type: 'start' }, conn('p-aaaaaa'), 1000)
    expect(applyHostCommand(r, { type: 'endEarly' }, conn('p-aaaaaa'), 2000)).toBe(true)
    expect(r).toMatchObject({ phase: 'finished', endAt: 2000 })

    const r2 = createRoom('CODI-2', 0)
    joinPlayer(r2, hello('p-aaaaaa'), conn('p-aaaaaa'), 1)
    applyHostCommand(r2, { type: 'start' }, conn('p-aaaaaa'), 1000)
    r2.phase = 'running'
    // already past endAt: never extend it
    expect(applyHostCommand(r2, { type: 'endEarly' }, conn('p-aaaaaa'), 9_999_999)).toBe(true)
    expect(r2.endAt).toBe(4000 + 480_000)
  })

  it('newRound and endEarly only from their phases', () => {
    const r = createRoom('CODI-1', 0)
    joinPlayer(r, hello('p-aaaaaa'), conn('p-aaaaaa'), 1)
    expect(applyHostCommand(r, { type: 'endEarly' }, conn('p-aaaaaa'), 2)).toBe(false)
    expect(applyHostCommand(r, { type: 'newRound' }, conn('p-aaaaaa'), 2)).toBe(false)
    applyHostCommand(r, { type: 'start' }, conn('p-aaaaaa'), 1000)
    expect(applyHostCommand(r, { type: 'newRound' }, conn('p-aaaaaa'), 1500)).toBe(false) // countdown
    r.phase = 'running'
    expect(applyHostCommand(r, { type: 'newRound' }, conn('p-aaaaaa'), 5000)).toBe(false)
    applyHostCommand(r, { type: 'endEarly' }, conn('p-aaaaaa'), 6000)
    expect(applyHostCommand(r, { type: 'endEarly' }, conn('p-aaaaaa'), 7000)).toBe(false)
    expect(r.phase).toBe('finished')
  })

  it('newRound drops disconnected players, promotes the queue and re-lanes', () => {
    const r = createRoom('CODI-1', 0)
    const c = conn('p-aaaaaa', 'p-bbbbbb')
    joinPlayer(r, hello('p-aaaaaa', 'A'), c, 1)
    joinPlayer(r, hello('p-bbbbbb', 'B'), c, 2)
    applyHostCommand(r, { type: 'start' }, c, 1000)
    r.phase = 'running'
    // queue arrives out of insertion order to prove sorting by queuedAt
    c.add('p-queue2')
    c.add('p-queue1')
    joinPlayer(r, hello('p-queue2', 'Q2'), c, 3000)
    joinPlayer(r, hello('p-queue1', 'Q1'), c, 2500)
    r.players['p-aaaaaa'] = { ...r.players['p-aaaaaa'], score: 900, levelsCompleted: 3, bestCombo: 4, combo: 2 }
    r.players['p-bbbbbb'].score = 700
    applyHostCommand(r, { type: 'endEarly' }, c, 4000)
    c.delete('p-bbbbbb')

    expect(applyHostCommand(r, { type: 'newRound' }, c, 5000)).toBe(true)
    expect(r).toMatchObject({ phase: 'lobby', roundId: 2, startAt: null, endAt: null })
    expect(r.players['p-bbbbbb']).toBeUndefined()
    expect(r.players['p-aaaaaa']).toMatchObject({
      status: 'playing', lane: 0, score: 0, levelsCompleted: 0, bestCombo: 0, combo: 0,
    })
    expect(r.players['p-queue1']).toMatchObject({ status: 'playing', lane: 1, queuedAt: null })
    expect(r.players['p-queue2']).toMatchObject({ status: 'playing', lane: 2, queuedAt: null })
    expect(Object.keys(r.players)).toHaveLength(3)
  })

  it('newRound removes disconnected queued players and keeps overflow queued', () => {
    const r = createRoom('CODI-1', 0)
    const c = conn()
    for (let i = 0; i < 11; i++) {
      c.add(pidOf(i))
      joinPlayer(r, hello(pidOf(i)), c, i)
    }
    applyHostCommand(r, { type: 'start' }, c, 1000)
    r.phase = 'running'
    // seats are 11, so one can queue; fake extra queued records directly to test overflow
    c.add('p-queue1')
    joinPlayer(r, hello('p-queue1'), c, 2000)
    for (const [pid, at] of [['p-queue2', 2100], ['p-queue3', 2200], ['p-gone99', 2050]] as const) {
      r.players[pid] = {
        id: pid, name: pid, avatarId: 'codi_default.svg', age: 9, status: 'queued', lane: null,
        score: 0, levelsCompleted: 0, bestCombo: 0, combo: 0, joinedAt: at, queuedAt: at,
      }
      if (pid !== 'p-gone99') c.add(pid)
    }
    applyHostCommand(r, { type: 'endEarly' }, c, 3000)
    expect(applyHostCommand(r, { type: 'newRound' }, c, 4000)).toBe(true)
    expect(r.players['p-gone99']).toBeUndefined()
    expect(r.players['p-queue1']).toMatchObject({ status: 'playing', lane: 11 })
    expect(r.players['p-queue2']).toMatchObject({ status: 'queued', lane: null, queuedAt: 2100 })
    expect(r.players['p-queue3']).toMatchObject({ status: 'queued', lane: null, queuedAt: 2200 })
    const lanes = Object.values(r.players).filter((p) => p.status === 'playing').map((p) => p.lane).sort((a, b) => a! - b!)
    expect(lanes).toEqual([...Array(12).keys()])
  })

  it('newRound keeps survivors in their previous lane order', () => {
    const r = createRoom('CODI-1', 0)
    const c = conn('p-aaaaaa', 'p-bbbbbb', 'p-cccccc')
    for (const pid of ['p-aaaaaa', 'p-bbbbbb', 'p-cccccc']) joinPlayer(r, hello(pid), c, 1)
    applyHostCommand(r, { type: 'start' }, c, 1000)
    applyHostCommand(r, { type: 'endEarly' }, c, 2000)
    c.delete('p-aaaaaa')
    applyHostCommand(r, { type: 'newRound' }, c, 3000)
    expect(r.players['p-bbbbbb'].lane).toBe(0)
    expect(r.players['p-cccccc'].lane).toBe(1)
  })

  it('kick removes a player in any phase and is false for unknown ids', () => {
    const r = createRoom('CODI-1', 0)
    joinPlayer(r, hello('p-aaaaaa'), conn('p-aaaaaa'), 1)
    expect(applyHostCommand(r, { type: 'kick', playerId: 'p-zzzzzz' }, conn('p-aaaaaa'), 2)).toBe(false)
    applyHostCommand(r, { type: 'start' }, conn('p-aaaaaa'), 1000)
    expect(applyHostCommand(r, { type: 'kick', playerId: 'p-aaaaaa' }, conn('p-aaaaaa'), 1500)).toBe(true)
    expect(r.players['p-aaaaaa']).toBeUndefined()
  })
})

describe('host key', () => {
  it('first host key claims; a different key does not', async () => {
    const r = createRoom('CODI-1', 0)
    expect(claimHost(r, await hashHostKey('k'.repeat(20)))).toBe(true)
    expect(claimHost(r, await hashHostKey('z'.repeat(20)))).toBe(false)
    expect(claimHost(r, null)).toBe(false)
    expect(claimHost(r, await hashHostKey('k'.repeat(20)))).toBe(true)
  })

  it('hashes to SHA-256 hex', async () => {
    expect(await hashHostKey('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('claimHost without a key never reserves the room', () => {
    const r = createRoom('CODI-1', 0)
    expect(claimHost(r, null)).toBe(false)
    expect(r.hostKeyHash).toBeUndefined()
  })
})
