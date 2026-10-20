import type {
  CompetitionConfig, CompetitionLevelRef, CompetitionSession, NewCompetitionSession,
  SessionOperation, SessionReceipt, SessionTransition, StoredSessionOperation,
} from '../../types/competition'
import type { Score } from '../../types/debug-game'
import { calculateCompetitionScore, starsForMistakes } from './scoring'

function timestamp(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 8.64e15) throw new Error('Invalid timestamp')
}

function nonnegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${label}`)
}

function validateSeed(seed: number | string | undefined): void {
  if (seed !== undefined && typeof seed !== 'string' && !Number.isSafeInteger(seed)) throw new Error('Invalid level seed')
}

export function competitionLevelKey(level: CompetitionLevelRef): string {
  if (typeof level.setId !== 'string' || !level.setId) throw new Error('Invalid level set')
  nonnegativeInteger(level.levelId, 'level ID')
  validateSeed(level.seed)
  return JSON.stringify([level.setId, level.levelId, level.seed ?? null])
}

export function createCompetitionSession(input: NewCompetitionSession): CompetitionSession {
  timestamp(input.startedAt)
  if (!input.id || !input.playerId || !input.setId) throw new Error('Missing session identity')
  const config: CompetitionConfig = {
    difficulty: input.config?.difficulty === undefined ? 1 : input.config.difficulty,
    scoringStrategy: input.config?.scoringStrategy === undefined ? 'BEST' : input.config.scoringStrategy,
  }
  calculateCompetitionScore({ correct: false, stars: 0, difficulty: config.difficulty, timeSpentSeconds: 0 })
  if (config.scoringStrategy !== 'BEST' && config.scoringStrategy !== 'LATEST') throw new Error('Invalid scoring strategy')
  if (input.timeLimitSec !== undefined && (!Number.isFinite(input.timeLimitSec) || input.timeLimitSec <= 0)) throw new Error('Invalid time limit')
  const deadline = input.deadline === undefined ? (input.timeLimitSec === undefined ? undefined : input.startedAt + input.timeLimitSec * 1000) : input.deadline
  if (deadline !== undefined) {
    timestamp(deadline)
    if (deadline < input.startedAt) throw new Error('Deadline precedes session start')
  }
  const checkpoint = { levelIndex: 0, combo: 0, bestCombo: 0, inputs: 0, ...input.checkpoint }
  validateSeed(checkpoint.deadSeed)
  for (const key of ['levelIndex', 'combo', 'bestCombo', 'inputs', 'hearts'] as const) {
    if (checkpoint[key] !== undefined) nonnegativeInteger(checkpoint[key]!, key)
  }
  // Copy JSON data rather than retain caller-owned config or checkpoint references.
  const { config: _config, checkpoint: _checkpoint, deadline: _deadline, ...metadata } = input
  return {
    ...JSON.parse(JSON.stringify(metadata)), config: Object.freeze(config),
    revision: 0, status: 'active', startedAt: input.startedAt, updatedAt: input.startedAt,
    ...(deadline === undefined ? {} : { deadline }), checkpoint: { ...checkpoint },
    levels: {}, operations: {}, totalScore: 0, levelsCompleted: 0,
  }
}

/** Key ordering is irrelevant when comparing a restored operation with its retry. */
function fingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${fingerprint(entry)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

function receipt(session: CompetitionSession, operationId: string, stored: StoredSessionOperation, delta: number): SessionReceipt {
  return {
    operationId, revision: session.revision, candidatePoints: stored.candidatePoints,
    storedLevelPoints: stored.storedLevelPoints, stars: stored.stars, delta,
    totalScore: session.totalScore, levelsCompleted: session.levelsCompleted, session,
  }
}

export function applySessionOperation(session: CompetitionSession, operation: SessionOperation): SessionTransition {
  const operationFingerprint = fingerprint(operation)
  const existing = Object.hasOwn(session.operations, operation.id) ? session.operations[operation.id] : undefined
  if (existing) {
    if (existing.fingerprint !== operationFingerprint) throw new Error('Conflicting duplicate operation ID')
    return { session, receipt: receipt(session, operation.id, existing, 0), changed: false }
  }
  if (typeof operation.id !== 'string' || !operation.id) throw new Error('Missing operation ID')
  if (operation.expectedRevision !== session.revision) throw new Error('Stale session revision')
  timestamp(operation.at)
  if (operation.at < session.updatedAt) throw new Error('Operation time moves backward')
  const empty: StoredSessionOperation = { fingerprint: operationFingerprint, candidatePoints: 0, storedLevelPoints: 0, stars: 0 }
  if (session.status === 'finished') {
    if (operation.type === 'finish') return { session, receipt: receipt(session, operation.id, empty, 0), changed: false }
    throw new Error('Session is finished')
  }
  if (operation.type !== 'finish' && session.deadline !== undefined && operation.at > session.deadline) throw new Error('Operation exceeds deadline')
  const next: CompetitionSession = {
    ...session, config: Object.freeze({ ...session.config }),
    revision: session.revision + 1, updatedAt: operation.at,
    levels: { ...session.levels }, operations: { ...session.operations }, checkpoint: { ...session.checkpoint },
  }
  let delta = 0
  const stored = { ...empty }
  if (operation.type === 'finish') {
    next.status = 'finished'
    next.finishedAt = operation.at
  } else if (operation.type === 'enter-level') {
    const key = competitionLevelKey(operation.level)
    nonnegativeInteger(operation.levelIndex, 'level index')
    next.levels[key] = next.levels[key] ?? {
      ...operation.level, key, firstReadyAt: operation.at, mistakes: 0, attemptCursor: 0,
      completed: false, bestPoints: 0, stars: 0, timeSpentSeconds: 0,
    }
    next.checkpoint.levelKey = key
    next.checkpoint.levelIndex = operation.levelIndex
  } else {
    const key = next.checkpoint.levelKey
    if (!key || !Object.hasOwn(next.levels, key)) throw new Error('No active level')
    const record = { ...next.levels[key]! }
    next.levels[key] = record
    switch (operation.type) {
      case 'correct-input':
        record.attemptCursor++
        next.checkpoint.inputs++
        next.checkpoint.combo++
        next.checkpoint.bestCombo = Math.max(next.checkpoint.bestCombo, next.checkpoint.combo)
        break
      case 'wrong-input':
        record.mistakes++
        record.attemptCursor = 0
        next.checkpoint.inputs++
        next.checkpoint.combo = 0
        if (next.mode === 'dead' && next.checkpoint.hearts !== undefined) next.checkpoint.hearts = Math.max(0, next.checkpoint.hearts - 1)
        break
      case 'reset-attempt':
        record.attemptCursor = 0
        next.checkpoint.combo = 0
        break
      case 'complete-level': {
        if (operation.candidate !== undefined && (!operation.candidate || typeof operation.candidate.correct !== 'boolean' || !Number.isSafeInteger(operation.candidate.points))) throw new Error('Invalid candidate')
        const correct = operation.candidate === undefined ? true : operation.candidate.correct
        if (typeof correct !== 'boolean') throw new Error('Invalid candidate correctness')
        const stars = correct ? starsForMistakes(record.mistakes) : 0
        const timeSpentSeconds = (operation.at - record.firstReadyAt) / 1000
        const points = operation.candidate === undefined
          ? calculateCompetitionScore({ correct, stars, difficulty: next.config.difficulty, timeSpentSeconds })
          : operation.candidate.points
        nonnegativeInteger(points, 'candidate points')
        if (!correct && points !== 0) throw new Error('Incorrect candidate must have zero points')
        stored.candidatePoints = points
        stored.stars = stars
        delta = Math.max(0, points - record.bestPoints)
        if (correct && (!record.completed || points > record.bestPoints)) {
          record.bestPoints = points
          record.stars = stars
          record.timeSpentSeconds = timeSpentSeconds
          record.submittedAt = operation.at
        }
        record.completed ||= correct
        next.totalScore += delta
        next.levelsCompleted = Object.values(next.levels).filter(entry => entry.completed).length
        break
      }
      default: throw new Error('Unknown session operation')
    }
    stored.storedLevelPoints = record.bestPoints
    if (operation.type !== 'complete-level') stored.stars = record.stars
  }
  nonnegativeInteger(next.revision, 'revision')
  nonnegativeInteger(next.totalScore, 'session total')
  nonnegativeInteger(next.levelsCompleted, 'completed level count')
  for (const key of ['levelIndex', 'combo', 'bestCombo', 'inputs', 'hearts'] as const) {
    if (next.checkpoint[key] !== undefined) nonnegativeInteger(next.checkpoint[key]!, key)
  }
  if (next.checkpoint.levelKey) {
    const record = next.levels[next.checkpoint.levelKey]!
    nonnegativeInteger(record.mistakes, 'mistakes')
    nonnegativeInteger(record.attemptCursor, 'attempt cursor')
  }
  // Define explicitly so arbitrary opaque IDs (including __proto__) remain data.
  Object.defineProperty(next.operations, operation.id, { value: stored, enumerable: true, configurable: true, writable: true })
  return { session: next, receipt: receipt(next, operation.id, stored, delta), changed: true }
}

export function toScore(session: CompetitionSession): Score {
  if (session.status !== 'finished' || session.finishedAt === undefined) throw new Error('Only finished sessions have scores')
  return {
    id: session.id, playerId: session.playerId, name: session.name, avatarId: session.avatarId,
    challengeId: session.challengeId, setId: session.setId, setTitle: session.setTitle,
    mode: session.mode, language: session.language, debug: session.debug, age: session.age,
    timeLimitSec: session.timeLimitSec, score: session.totalScore,
    bestCombo: session.checkpoint.bestCombo, inputs: session.checkpoint.inputs,
    levelsCompleted: session.levelsCompleted, levelReached: session.checkpoint.levelIndex + 1,
    elapsedMs: session.finishedAt - session.startedAt,
    createdAt: new Date(session.startedAt).toISOString(), updatedAt: new Date(session.updatedAt).toISOString(),
    difficulty: session.config.difficulty, scoringStrategy: session.config.scoringStrategy,
  }
}
