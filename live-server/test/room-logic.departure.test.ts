import { describe, expect, it } from 'vitest'
import type { Phase, PlayerHello } from '../../app/utils/live/protocol'
import { LIVE_PROTOCOL_VERSION } from '../../app/utils/live/protocol'
import { advanceClock, applyHostCommand, createRoom, joinPlayer, leavePlayer, seatCount, snapshot } from '../src/room-logic'
import { applyGameplayEvent, gameplayMoves } from '../src/scoring'

const hello = (pid: string, name = 'Player'): PlayerHello => ({ type: 'hello', pid, name, avatarId: 'codi_default.svg', age: 9 })

function scoredRound() {
  const room = createRoom('LEAVE-TEST', 0)
  const connected = new Set(['p-first', 'p-second'])
  for (const pid of connected) joinPlayer(room, hello(pid), connected, 0)
  applyHostCommand(room, { type: 'start' }, connected, 1000)
  advanceClock(room, room.startAt!)
  const player = room.players['p-first']
  const send = (action: 'ready' | 'direction', direction?: 'up' | 'down' | 'left' | 'right') => {
    const event = { type: 'gameplay' as const, protocolVersion: LIVE_PROTOCOL_VERSION, roundId: room.roundId,
      sessionId: player.scoring!.session.id, sequence: player.scoring!.lastSequence + 1,
      levelId: 1, at: room.startAt! + 1000, action, ...(direction ? { direction } : {}) }
    expect(applyGameplayEvent(room, player.pid, event, event.at + 20).message.error).toBeUndefined()
  }
  send('ready')
  for (const direction of gameplayMoves(room.round!.setId, 1)) send('direction', direction)
  expect(player.score).toBeGreaterThan(0)
  return { room, connected, player }
}

describe('leaving a scored round', () => {
  it.each<Phase>(['running', 'finished'])('retains the participant and canonical score in %s', phase => {
    const { room, connected, player } = scoredRound()
    room.phase = phase
    const before = structuredClone(player)
    expect(leavePlayer(room, player.pid)).toBe(true)
    connected.delete(player.pid)

    expect(room.players[player.pid]).toEqual(before)
    const publicState = snapshot(room, connected, { hosts: 1, screens: 1 }, 6000)
    expect(publicState.players[0]).toMatchObject({ id: player.id, name: player.name, score: before.score,
      levelsCompleted: 1, lane: 0, status: 'playing', connected: false })
    expect(JSON.stringify(publicState)).not.toContain(player.pid)
    expect(JSON.stringify(publicState)).not.toContain('checkpoint')
    expect(seatCount(room, connected)).toBe(1)
  })

  it('keeps a participant who leaves during countdown in the round', () => {
    const room = createRoom('LEAVE-TEST', 0)
    joinPlayer(room, hello('p-first'), new Set(['p-first']), 0)
    applyHostCommand(room, { type: 'start' }, new Set(['p-first']), 1000)
    const before = structuredClone(room.players['p-first'])
    expect(leavePlayer(room, 'p-first')).toBe(true)
    expect(room.players['p-first']).toEqual(before)
    expect(snapshot(room, new Set(), { hosts: 1, screens: 1 }, 2000).players[0])
      .toMatchObject({ id: before.id, score: 0, connected: false })
  })

  it('keeps an old score when the same device changes to a new player', () => {
    const { room, connected, player } = scoredRound()
    const before = structuredClone(player.scoring)
    leavePlayer(room, player.pid)
    connected.delete(player.pid)
    connected.add('p-replacement')
    expect(joinPlayer(room, hello('p-replacement', 'New player'), connected, 6000)).toBe('queued')
    expect(room.players[player.pid]?.scoring).toEqual(before)
    expect(room.players['p-replacement']).toMatchObject({ status: 'queued', lane: null, score: 0 })

    applyHostCommand(room, { type: 'endEarly' }, connected, 7000)
    const results = snapshot(room, connected, { hosts: 1, screens: 1 }, 7000)
    expect(results.players[0]).toMatchObject({ id: player.id, score: player.score, connected: false })
    applyHostCommand(room, { type: 'newRound' }, connected, 8000)
    expect(room.players[player.pid]).toBeUndefined()
    expect(room.players['p-replacement']).toMatchObject({ status: 'playing', score: 0 })
    expect(Object.values(room.players).every(p => p.score === 0 && !p.scoring)).toBe(true)
  })

  it('restores the same participant and score when they rejoin the round', () => {
    const { room, connected, player } = scoredRound()
    const before = structuredClone(player)
    leavePlayer(room, player.pid)
    connected.delete(player.pid)
    connected.add(player.pid)
    expect(joinPlayer(room, hello(player.pid, 'Changed name'), connected, 6000)).toBe('playing')
    expect(room.players[player.pid]).toEqual(before)
  })

  it('removes queued players who leave without adding them to the results', () => {
    const { room, connected } = scoredRound()
    connected.add('p-queue')
    joinPlayer(room, hello('p-queue'), connected, 6000)
    expect(leavePlayer(room, 'p-queue')).toBe(true)
    expect(room.players['p-queue']).toBeUndefined()
    expect(leavePlayer(room, 'p-missing')).toBe(false)
  })

  it('still lets the host remove a participant explicitly', () => {
    const { room, connected, player } = scoredRound()
    expect(applyHostCommand(room, { type: 'kick', playerId: player.id }, connected, 6000)).toBe(true)
    expect(room.players[player.pid]).toBeUndefined()
  })
})
