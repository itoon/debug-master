import type { CompetitionSession, SessionOperation, SessionReceipt } from '../../app/types/competition'
import type { Direction } from '../../app/types/debug-game'
import { homeConfig } from '../../app/data/home-config'
import { challengeSets } from '../../app/data/challenge-groups'
import { useProgramParser } from '../../app/composables/useProgramParser'
import { solveLevel } from '../../app/utils/programRunner'
import { applySessionOperation, createCompetitionSession } from '../../app/utils/competition/session'
import { GRACE_MS, LIVE_PROTOCOL_VERSION, type GameplayEventMsg, type LiveScoringError, type ScoringMsg } from '../../app/utils/live/protocol'
import type { StoredRoom } from './room-logic'

/** Recent payload conflicts/receipts are retained; older accepted sequences only replay canonical ack.
 * The sequence layer owns Live deduplication, so reducer operation history is cleared after each event.
 * This keeps the complete 12-player/50-level room comfortably inside one durable storage value.
 */
export const LIVE_REPLAY_WINDOW = 64

export type LiveScoringState = {
  session: CompetitionSession
  lastSequence: number
  lastAt: number
  attemptCursor: number
  events: Record<string, { fingerprint: string; receipt?: Omit<SessionReceipt, 'session'> }>
}
export type LiveEventResult = { changed: boolean; message: ScoringMsg }

type OperationPayload<T = SessionOperation> = T extends SessionOperation ? Omit<T, 'id' | 'expectedRevision' | 'at'> : never

const solutions = new Map<string, readonly Direction[]>()
/** Resolve the exact game's interpreter output; no client-provided answer is used. */
export function gameplayMoves(setId: string, levelId: number): readonly Direction[] {
  const key = `${setId}:${levelId}`
  const cached = solutions.get(key)
  if (cached) return cached
  const level = challengeSets.find(set => set.id === setId)?.levels.find(level => level.id === levelId)
  if (!level) throw new Error('Unknown canonical level')
  const result = solveLevel(level, useProgramParser(() => level.id).parseProgram(level.code))
  if (result.error || !result.moves.length) throw new Error('Invalid canonical program')
  const moves = Object.freeze(result.moves)
  solutions.set(key, moves)
  return moves
}

/** Called only at host start: every participant receives one new, frozen round session. */
export function initializeRoundScoring(room: StoredRoom): void {
  const mode = homeConfig.modes.find(mode => mode.id === room.mode)!
  room.round = { setId: mode.levelSetId, config: { difficulty: mode.difficulty, scoringStrategy: mode.scoringStrategy } }
  for (const player of Object.values(room.players)) {
    if (player.status !== 'playing') continue
    const session = createCompetitionSession({
      id: crypto.randomUUID(), playerId: player.id, name: player.name, avatarId: player.avatarId,
      age: player.age, setId: room.round.setId, setTitle: challengeSets.find(set => set.id === room.round!.setId)!.title,
      challengeId: room.mode, mode: 'ranking', language: 'python', debug: false,
      boardId: JSON.stringify([room.code, room.roundId, room.mode, room.round.setId, room.durationSec, room.round.config.difficulty]),
      startedAt: room.startAt!, deadline: room.endAt!, timeLimitSec: room.durationSec, config: room.round.config,
    })
    player.scoring = { session, lastSequence: 0, lastAt: room.startAt!, attemptCursor: 0, events: {} }
    player.score = player.levelsCompleted = player.bestCombo = player.combo = 0
  }
}

export function scoringMessage(room: StoredRoom, pid: string, error?: LiveScoringError): ScoringMsg {
  const scoring = room.players[pid]?.scoring
  return {
    type: 'scoring', protocolVersion: LIVE_PROTOCOL_VERSION, roundId: room.roundId,
    session: scoring?.session ?? null, acknowledgedSequence: scoring?.lastSequence ?? 0,
    nextExpectedSequence: (scoring?.lastSequence ?? 0) + 1, ...(error ? { error } : {}),
  }
}

/** Mutates only on success. The owner must persist a candidate room before publishing this result. */
export function applyGameplayEvent(room: StoredRoom, pid: string, event: GameplayEventMsg, receivedAt: number): LiveEventResult {
  const reject = (error: LiveScoringError): LiveEventResult => ({ changed: false, message: scoringMessage(room, pid, error) })
  if (event.protocolVersion !== LIVE_PROTOCOL_VERSION) return reject('unsupported_version')
  const player = room.players[pid]
  if (!player || player.status !== 'playing' || !player.scoring) return reject('not_playing')
  const state = player.scoring
  if (event.roundId !== room.roundId) return reject('wrong_round')
  if (event.sessionId !== state.session.id) return reject('wrong_session')
  const allowedKeys = ['type', 'protocolVersion', 'roundId', 'sessionId', 'sequence', 'levelId', 'at', 'action', 'direction']
  if (Object.keys(event).some(key => !allowedKeys.includes(key)) || event.type !== 'gameplay' ||
    !Number.isSafeInteger(event.sequence) || event.sequence < 1 || !Number.isSafeInteger(event.levelId) ||
    !['ready', 'direction', 'reset'].includes(event.action) ||
    (event.action === 'direction' ? !['up', 'down', 'left', 'right'].includes(event.direction!) : event.direction !== undefined)) return reject('invalid_event')
  const fingerprint = JSON.stringify([event.levelId, event.at, event.action, event.direction ?? null])
  if (event.sequence <= state.lastSequence) {
    if (event.sequence <= state.lastSequence - LIVE_REPLAY_WINDOW) {
      return { changed: false, message: scoringMessage(room, pid) }
    }
    const accepted = state.events[event.sequence]
    if (!accepted || accepted.fingerprint !== fingerprint) return reject('conflicting_duplicate')
    const message = scoringMessage(room, pid)
    if (accepted.receipt) message.receipt = { ...accepted.receipt, delta: 0, revision: state.session.revision,
      totalScore: state.session.totalScore, levelsCompleted: state.session.levelsCompleted, session: state.session }
    return { changed: false, message }
  }
  if (event.sequence !== state.lastSequence + 1) return reject('sequence_gap')
  const session = state.session
  const active = session.checkpoint.levelKey ? session.levels[session.checkpoint.levelKey] : undefined
  const levelIndex = active?.completed ? session.checkpoint.levelIndex + 1 : session.checkpoint.levelIndex
  const set = challengeSets.find(set => set.id === room.round?.setId)
  const expected = set?.levels[levelIndex]
  const expectedId = event.action === 'ready' ? expected?.id : active?.levelId
  if ((event.action === 'ready' && event.levelId !== expectedId) || (active && event.action !== 'ready' && event.levelId !== expectedId)) return reject('wrong_level')
  if (event.action !== 'ready' && !active) return reject('not_ready')
  if (event.action !== 'ready' && active?.completed) return reject('level_complete')
  if (!Number.isSafeInteger(event.at) || event.at < state.lastAt || event.at < room.startAt! ||
    event.at > 8.64e15 || event.at > receivedAt || !Number.isSafeInteger(receivedAt)) return reject('invalid_time')
  if (!room.round || room.endAt === null || (room.phase !== 'running' && room.phase !== 'finished') ||
    event.at > room.endAt || receivedAt > room.endAt + GRACE_MS) return reject('round_closed')
  let next = session
  let completion: SessionReceipt | undefined
  const operation = (operation: OperationPayload, suffix: string) => {
    const result = applySessionOperation(next, { ...operation, id: `${event.sequence}:${suffix}`, expectedRevision: next.revision, at: event.at } as SessionOperation)
    next = result.session
    return result.receipt
  }
  if (event.action === 'ready') {
    operation({ type: 'enter-level', level: { setId: room.round.setId, levelId: event.levelId }, levelIndex }, 'ready')
  } else if (event.action === 'reset') {
    operation({ type: 'reset-attempt' }, 'reset')
  } else {
    const moves = gameplayMoves(room.round.setId, event.levelId)
    if (event.direction !== moves[active!.attemptCursor]) operation({ type: 'wrong-input' }, 'wrong')
    else {
      operation({ type: 'correct-input' }, 'correct')
      if (active!.attemptCursor + 1 === moves.length) completion = operation({ type: 'complete-level' }, 'complete')
    }
  }
  // Only the Live boundary compacts this reducer history. Accepted sequences are never reduced
  // again, while browser sessions retain the shared reducer's complete operation-ID contract.
  next = { ...next, operations: {} }
  if (completion) completion = { ...completion, session: next }
  const record = next.checkpoint.levelKey ? next.levels[next.checkpoint.levelKey] : undefined
  let storedReceipt: Omit<SessionReceipt, 'session'> | undefined
  if (completion) { const { session: _session, ...receipt } = completion; storedReceipt = receipt }
  const events: LiveScoringState['events'] = {}
  for (let sequence = Math.max(1, event.sequence - LIVE_REPLAY_WINDOW + 1); sequence < event.sequence; sequence++) {
    const accepted = state.events[sequence]
    if (accepted) events[sequence] = accepted
  }
  events[event.sequence] = { fingerprint, ...(storedReceipt ? { receipt: storedReceipt } : {}) }
  player.scoring = { session: next, lastSequence: event.sequence, lastAt: event.at, attemptCursor: record?.attemptCursor ?? 0,
    events }
  player.score = next.totalScore
  player.levelsCompleted = next.levelsCompleted
  player.combo = next.checkpoint.combo
  player.bestCombo = next.checkpoint.bestCombo
  const message = scoringMessage(room, pid)
  if (completion) message.receipt = completion
  return { changed: true, message }
}
