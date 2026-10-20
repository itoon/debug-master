import { LIVE_PROTOCOL_VERSION, type GameplayEventMsg } from '../../app/utils/live/protocol'
import { advanceClock, applyHostCommand, createRoom, joinPlayer } from '../src/room-logic'
import { applyGameplayEvent, gameplayMoves } from '../src/scoring'

/** Actual supported capacity, with two failed attempts and a transition before every level. */
export function completedProRound(pauseFirstBeforeFinal = false) {
  const epoch = 1_800_000_000_000
  const room = createRoom('CAPACITY-12', epoch)
  const pids = ['secret-player', ...Array.from({ length: 11 }, (_, i) => `capacity-player-${i}`)]
  const connected = new Set(pids)
  for (const pid of pids) {
    joinPlayer(room, { type: 'hello', pid, name: 'ผู้เล่นทดสอบ', avatarId: 'codi_default.svg', age: 9 }, connected, epoch)
  }
  applyHostCommand(room, { type: 'setMode', mode: 'C' }, connected, epoch)
  applyHostCommand(room, { type: 'setDuration', durationSec: 900 }, connected, epoch)
  applyHostCommand(room, { type: 'start' }, connected, epoch)
  advanceClock(room, room.startAt!)
  const first: Record<string, GameplayEventMsg> = {}
  const last: Record<string, GameplayEventMsg> = {}
  const lastCompletion: Record<string, GameplayEventMsg> = {}
  for (const pid of pids) {
    let at = room.startAt!
    const send = (levelId: number, action: GameplayEventMsg['action'], direction?: GameplayEventMsg['direction']) => {
      const state = room.players[pid].scoring!
      const event: GameplayEventMsg = { type: 'gameplay', protocolVersion: LIVE_PROTOCOL_VERSION,
        roundId: room.roundId, sessionId: state.session.id, sequence: state.lastSequence + 1,
        levelId, at, action, ...(direction ? { direction } : {}) }
      const result = applyGameplayEvent(room, pid, event, at + 20)
      if (!result.changed) throw new Error(`Capacity fixture rejected ${pid} seq ${event.sequence}: ${result.message.error}`)
      first[pid] ??= event
      last[pid] = event
      if (result.message.receipt) lastCompletion[pid] = event
    }
    for (let levelId = 1; levelId <= 50; levelId++) {
      at += 800 // Level transition finishes before readiness.
      send(levelId, 'ready')
      const moves = gameplayMoves(room.round!.setId, levelId)
      const wrong = moves[0] === 'up' ? 'down' : 'up'
      for (let retry = 0; retry < 2; retry++) {
        at += 400 // Read/think, then a wrong answer.
        send(levelId, 'direction', wrong)
        at += 1000 // Failed-attempt animation and retry time.
        send(levelId, 'reset')
      }
      for (const [index, direction] of moves.entries()) {
        if (pauseFirstBeforeFinal && pid === pids[0] && levelId === 50 && index === moves.length - 1) break
        at += 120
        send(levelId, 'direction', direction)
      }
    }
  }
  return { room, pids, first, last, lastCompletion }
}
