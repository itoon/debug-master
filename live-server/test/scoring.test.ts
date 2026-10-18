import { describe, expect, it } from 'vitest'
import { LIVE_PROTOCOL_VERSION, GRACE_MS, type GameplayEventMsg } from '../../app/utils/live/protocol'
import { homeConfig } from '../../app/data/home-config'
import { calculateCompetitionScore } from '../../app/utils/competition/scoring'
import { applyGameplayEvent, gameplayMoves, scoringMessage } from '../src/scoring'
import { advanceClock, applyHostCommand, createRoom, joinPlayer, snapshot } from '../src/room-logic'

const pid = 'secret-player'
export function runningRoom() {
  const room = createRoom('TEST-1', 0)
  joinPlayer(room, { type: 'hello', pid, name: 'P', avatarId: 'codi_default.svg', age: 9 }, new Set([pid]), 0)
  applyHostCommand(room, { type: 'start' }, new Set([pid]), 0)
  advanceClock(room, 3000)
  return room
}
function event(room: ReturnType<typeof runningRoom>, changes: Partial<GameplayEventMsg> = {}): GameplayEventMsg {
  return { type: 'gameplay', protocolVersion: LIVE_PROTOCOL_VERSION, roundId: room.roundId,
    sessionId: room.players[pid].scoring!.session.id, sequence: room.players[pid].scoring!.lastSequence + 1,
    levelId: 1, at: 4000, action: 'ready', ...changes }
}
function send(room: ReturnType<typeof runningRoom>, changes: Partial<GameplayEventMsg> = {}, receivedAt?: number) {
  const msg = event(room, changes)
  return applyGameplayEvent(room, pid, msg, receivedAt ?? msg.at)
}

describe('authoritative gameplay', () => {
  it.each([0, 1, 2])('uses canonical first-level moves, fixed ready time and %i mistakes', mistakes => {
    const room = runningRoom()
    expect(send(room).changed).toBe(true)
    const moves = gameplayMoves(room.round!.setId, 1)
    expect(moves).toEqual(['right', 'right', 'right'])
    for (let n = 0; n < mistakes; n++) {
      send(room, { action: 'direction', direction: 'up', at: 4500 + n * 100 })
      send(room, { action: 'reset', at: 4550 + n * 100 })
      send(room, { action: 'ready', at: 4560 + n * 100 })
    }
    let result
    for (const [i, direction] of moves.entries()) result = send(room, { action: 'direction', direction, at: 5000 + i * 125 })
    const stars = mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1
    const points = calculateCompetitionScore({ correct: true, stars, timeSpentSeconds: 1.25 })
    expect(result!.message.receipt).toMatchObject({ stars, delta: points, totalScore: points })
    expect(room.players[pid]).toMatchObject({ score: points, levelsCompleted: 1 })
    expect(Object.values(room.players[pid].scoring!.session.levels)[0]).toMatchObject({ firstReadyAt: 4000, mistakes, timeSpentSeconds: 1.25 })
    expect(send(room, { levelId: 2, at: 6000 }).changed).toBe(true)
  })
  it('matches the 10-second reference score using the final input timestamp, not receipt latency', () => {
    const room = runningRoom()
    send(room)
    send(room, { action: 'direction', direction: 'right', at: 5000 })
    send(room, { action: 'direction', direction: 'right', at: 6000 })
    const msg = event(room, { action: 'direction', direction: 'right', at: 14_000 })
    const result = applyGameplayEvent(room, pid, msg, 15_500)
    expect(result.message.receipt).toMatchObject({ stars: 3, delta: 1537, totalScore: 1537 })
    const replay = applyGameplayEvent(room, pid, msg, room.endAt! + GRACE_MS + 1)
    expect(replay.message.receipt).toMatchObject({ delta: 0, totalScore: 1537 })
    expect(room.players[pid].scoring!.session.updatedAt).toBe(14_000)
  })
  it('awards pre-deadline completion delivered exactly at grace and rejects an after-deadline final input', () => {
    const room = runningRoom()
    send(room)
    send(room, { action: 'direction', direction: 'right', at: 5000 })
    send(room, { action: 'direction', direction: 'right', at: 6000 })
    applyHostCommand(room, { type: 'endEarly' }, new Set([pid]), 14_000)
    expect(send(room, { action: 'direction', direction: 'right', at: 14_001 }, 15_000).message.error).toBe('round_closed')
    expect(room.players[pid].score).toBe(0)
    expect(send(room, { action: 'direction', direction: 'right', at: 14_000 }, 16_000).message.receipt).toMatchObject({ stars: 3, delta: 1537 })
  })
  it('cannot carry positive scores or prior-session events into a new round', () => {
    const room = runningRoom()
    send(room)
    for (const [i, direction] of gameplayMoves(room.round!.setId, 1).entries()) send(room, { action: 'direction', direction, at: 5000 + i * 100 })
    const oldSession = room.players[pid].scoring!.session.id
    expect(room.players[pid].score).toBeGreaterThan(0)
    applyHostCommand(room, { type: 'endEarly' }, new Set([pid]), 6000)
    applyHostCommand(room, { type: 'newRound' }, new Set([pid]), 7000)
    applyHostCommand(room, { type: 'start' }, new Set([pid]), 8000)
    advanceClock(room, 11_000)
    expect(scoringMessage(room, pid)).toMatchObject({ acknowledgedSequence: 0, session: { totalScore: 0, levelsCompleted: 0, levels: {}, operations: {} } })
    expect(room.players[pid].scoring!.session.id).not.toBe(oldSession)
    expect(send(room, { sessionId: oldSession, at: 11_000 }).message.error).toBe('wrong_session')
    expect(send(room, { roundId: 1, at: 11_000 }).message.error).toBe('wrong_round')
    expect(snapshot(room, new Set([pid]), { screens: 0, hosts: 0 }, 11_000).players[0].score).toBe(0)
  })
  it('requires ordered matching events and allows harmless duplicate replay after grace', () => {
    const room = runningRoom()
    const first = event(room)
    expect(applyGameplayEvent(room, pid, first, 4000).changed).toBe(true)
    const before = structuredClone(room)
    expect(applyGameplayEvent(room, pid, first, room.endAt! + GRACE_MS + 100).changed).toBe(false)
    expect(room).toEqual(before)
    expect(send(room, { sequence: 3 }).message).toMatchObject({ error: 'sequence_gap', acknowledgedSequence: 1, nextExpectedSequence: 2 })
    expect(send(room, { sequence: 1, at: 4001 }).message.error).toBe('conflicting_duplicate')
  })
  it.each([
    [{ levelId: 2 }, 'wrong_level'], [{ levelId: 999 }, 'wrong_level'],
    [{ action: 'direction', direction: 'right' }, 'not_ready'],
    [{ sessionId: 'other' }, 'wrong_session'], [{ roundId: 7 }, 'wrong_round'],
    [{ protocolVersion: 99 }, 'unsupported_version'], [{ at: NaN }, 'invalid_time'],
    [{ at: Infinity }, 'invalid_time'], [{ at: -1 }, 'invalid_time'], [{ at: 3000.5 }, 'invalid_time'],
    [{ at: 8.64e15 + 1 }, 'invalid_time'], [{ at: 2000 }, 'invalid_time'],
  ] as const)('rejects invalid boundary %o', (changes, error) => {
    const room = runningRoom()
    const result = send(room, changes as Partial<GameplayEventMsg>, 3999)
    expect(result.message.error).toBe(error)
    expect(room.players[pid].score).toBe(0)
    expect(room.players[pid].scoring!.lastSequence).toBe(0)
  })
  it('cannot skip an unfinished level or erase mistakes and timing with reset/ready', () => {
    const room = runningRoom()
    send(room)
    send(room, { action: 'direction', direction: 'up', at: 4500 })
    expect(send(room, { levelId: 2, at: 4600 }).message.error).toBe('wrong_level')
    send(room, { action: 'reset', at: 4700 })
    send(room, { at: 4800 })
    expect(Object.values(room.players[pid].scoring!.session.levels)[0]).toMatchObject({ firstReadyAt: 4000, mistakes: 1, attemptCursor: 0 })
    expect(send(room, { action: 'direction', direction: 'right', at: 4799 }).message.error).toBe('invalid_time')
  })
  it('rejects queued/unknown players and events after a shortened deadline, accepts pre-deadline delivery in grace', () => {
    const room = runningRoom()
    joinPlayer(room, { type: 'hello', pid: 'queued-player', name: 'Q', avatarId: 'codi_default.svg', age: 9 }, new Set([pid, 'queued-player']), 4000)
    expect(applyGameplayEvent(room, 'queued-player', event(room), 4000).message.error).toBe('not_playing')
    expect(applyGameplayEvent(room, 'missing-player', event(room), 4000).message.error).toBe('not_playing')
    send(room)
    applyHostCommand(room, { type: 'endEarly' }, new Set([pid]), 5000)
    expect(send(room, { action: 'direction', direction: 'right', at: 5001 }, 5100).message.error).toBe('round_closed')
    expect(send(room, { action: 'direction', direction: 'right', at: 4999 }, 5000 + GRACE_MS).changed).toBe(true)
    expect(send(room, { action: 'direction', direction: 'right', at: 5000 }, 5000 + GRACE_MS + 1).message.error).toBe('round_closed')
  })
  it('copies mode configuration at start so configuration edits only affect the next round', () => {
    const room = runningRoom()
    const config = homeConfig.modes[0] as unknown as { difficulty: number; scoringStrategy: 'BEST' | 'LATEST' }
    const original = { difficulty: config.difficulty, scoringStrategy: config.scoringStrategy }
    try {
      config.difficulty = 3
      config.scoringStrategy = 'LATEST'
      expect(room.round!.config).toEqual({ difficulty: 1, scoringStrategy: 'BEST' })
      expect(room.players[pid].scoring!.session.config).toEqual(room.round!.config)
      const boardBefore = JSON.parse(room.players[pid].scoring!.session.boardId!)
      expect(boardBefore).toEqual(['TEST-1', 1, 'A', 'challenge-beginner', 480, 1])
      applyHostCommand(room, { type: 'endEarly' }, new Set([pid]), 4000)
      applyHostCommand(room, { type: 'newRound' }, new Set([pid]), 5000)
      applyHostCommand(room, { type: 'start' }, new Set([pid]), 6000)
      expect(room.round!.config).toEqual({ difficulty: 3, scoringStrategy: 'LATEST' })
      expect(room.players[pid].scoring!.session.config).toEqual(room.round!.config)
    } finally { Object.assign(config, original) }
  })
  it('freezes round configuration, uses strategy time ties, resets every ledger, and whitelists public fields', () => {
    const room = runningRoom()
    joinPlayer(room, { type: 'hello', pid: 'other-secret', name: 'Q', avatarId: 'codi_default.svg', age: 9 }, new Set([pid, 'other-secret']), 4000)
    room.players['other-secret'].status = 'playing'
    room.players['other-secret'].scoring = structuredClone(room.players[pid].scoring!)
    room.players['other-secret'].scoring!.session.id = 'other-session'
    room.players['other-secret'].scoring!.session.updatedAt = 5000
    room.players[pid].scoring!.session.updatedAt = 6000
    const publicState = () => snapshot(room, new Set([pid, 'other-secret']), { screens: 1, hosts: 1 }, 6000)
    expect(publicState().players[0].id).toBe(room.players['other-secret'].id)
    room.round!.config.scoringStrategy = 'LATEST'
    expect(publicState().players[0].id).toBe(room.players[pid].id)
    expect(room.round!.config).toEqual({ difficulty: 1, scoringStrategy: 'LATEST' })
    Object.assign(room.players[pid], { pendingEvents: ['private-input'], privateCheckpoint: 'private-checkpoint' })
    const json = JSON.stringify(publicState())
    for (const secret of [pid, 'other-secret', '"scoring":', 'operations', 'checkpoint', 'firstReadyAt', 'lastSequence', 'pendingEvents', 'privateCheckpoint', 'private-input', 'private-checkpoint']) expect(json).not.toContain(secret)
    expect(publicState().players).toHaveLength(2)
    applyHostCommand(room, { type: 'endEarly' }, new Set([pid]), 7000)
    applyHostCommand(room, { type: 'newRound' }, new Set([pid]), 8000)
    expect(room.players[pid].scoring).toBeUndefined()
    expect(room.players[pid].score).toBe(0)
    applyHostCommand(room, { type: 'start' }, new Set([pid]), 9000)
    expect(scoringMessage(room, pid)).toMatchObject({ acknowledgedSequence: 0, nextExpectedSequence: 1, session: { totalScore: 0, levels: {} } })
  })
})
