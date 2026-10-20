import type { CompetitionSession, SessionOperation, SessionReceipt } from '../types/competition'
import { CODE_LANGUAGE_OPTIONS } from '../utils/codeLanguage'
import { applySessionOperation, competitionLevelKey } from '../utils/competition/session'
import type { CompetitionSessionStore } from './contracts'
import type { LocalStorageAdapter } from './LocalStorageAdapter'

const KEY = 'sessions'
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const timestamp = (value: unknown): value is number => integer(value) && value <= 8.64e15
const optionalString = (value: unknown) => value === undefined || typeof value === 'string'
const seed = (value: unknown) => value === undefined || typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value))
const stars = (value: unknown) => integer(value) && value <= 3
const duration = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

function validSession(value: unknown): value is CompetitionSession {
  if (!object(value)) return false
  if (!['id', 'playerId', 'setId'].every(key => typeof value[key] === 'string' && value[key] !== '')) return false
  if (!['name', 'setTitle'].every(key => typeof value[key] === 'string')) return false
  if (!['avatarId', 'boardId'].every(key => optionalString(value[key]))) return false
  if (!['campaign', 'timer', 'ranking', 'dead'].includes(value.mode as string) || !CODE_LANGUAGE_OPTIONS.some(language => language.id === value.language) || typeof value.debug !== 'boolean') return false
  if (value.challengeId !== undefined && !['A', 'B', 'C'].includes(value.challengeId as string)) return false
  if (value.age !== undefined && !integer(value.age)) return false
  if (value.timeLimitSec !== undefined && (!duration(value.timeLimitSec) || value.timeLimitSec === 0)) return false
  if (!object(value.config) || !integer(value.config.difficulty) || value.config.difficulty < 1 || !['BEST', 'LATEST'].includes(value.config.scoringStrategy as string)) return false
  if (!integer(value.revision) || !integer(value.totalScore) || !integer(value.levelsCompleted)) return false
  if (!timestamp(value.startedAt) || !timestamp(value.updatedAt) || value.updatedAt < value.startedAt) return false
  if (value.deadline !== undefined && (!timestamp(value.deadline) || value.deadline < value.startedAt)) return false
  if (value.status !== 'active' && value.status !== 'finished') return false
  if (value.status === 'finished' ? !timestamp(value.finishedAt) || value.finishedAt !== value.updatedAt : value.finishedAt !== undefined) return false
  if (!object(value.checkpoint) || !object(value.levels) || !object(value.operations)) return false
  const checkpoint = value.checkpoint
  if (!['levelIndex', 'combo', 'bestCombo', 'inputs'].every(key => integer(checkpoint[key])) || !seed(checkpoint.deadSeed)) return false
  if (checkpoint.hearts !== undefined && !integer(checkpoint.hearts)) return false
  if (!optionalString(checkpoint.levelKey) || (checkpoint.levelKey !== undefined && !Object.hasOwn(value.levels, checkpoint.levelKey as string))) return false
  let total = 0, completed = 0
  for (const [key, record] of Object.entries(value.levels)) {
    if (!object(record) || typeof record.setId !== 'string' || !record.setId || !integer(record.levelId) || !seed(record.seed)) return false
    if (record.key !== key || competitionLevelKey({ setId: record.setId, levelId: record.levelId, ...(record.seed === undefined ? {} : { seed: record.seed as string | number }) }) !== key) return false
    if (!timestamp(record.firstReadyAt) || record.firstReadyAt < value.startedAt || record.firstReadyAt > value.updatedAt) return false
    if (!integer(record.mistakes) || !integer(record.attemptCursor) || !integer(record.bestPoints) || !stars(record.stars) || !duration(record.timeSpentSeconds) || typeof record.completed !== 'boolean') return false
    if (record.completed) {
      if (!timestamp(record.submittedAt) || record.submittedAt < record.firstReadyAt || record.submittedAt > value.updatedAt || record.stars === 0) return false
      completed++
    } else if (record.bestPoints !== 0 || record.stars !== 0 || record.submittedAt !== undefined) return false
    total += record.bestPoints
  }
  if (!integer(total) || total !== value.totalScore || completed !== value.levelsCompleted) return false
  for (const record of Object.values(value.operations)) {
    if (!object(record) || Object.keys(record).some(key => !['fingerprint', 'candidatePoints', 'storedLevelPoints', 'stars'].includes(key))) return false
    if (typeof record.fingerprint !== 'string' || !record.fingerprint || !integer(record.candidatePoints) || !integer(record.storedLevelPoints) || !stars(record.stars)) return false
  }
  return true
}

function validSessions(value: unknown): value is CompetitionSession[] {
  return Array.isArray(value) && value.every(validSession) && new Set(value.map(session => session.id)).size === value.length
}

/** Atomic read/transition/write of the sole canonical browser session collection. */
export class CompetitionSessionRepository implements CompetitionSessionStore {
  constructor(private readonly adapter: LocalStorageAdapter) {}

  list(): CompetitionSession[] {
    return this.adapter.read(KEY, [], validSessions).map(session => ({ ...session, config: Object.freeze(session.config) }))
  }

  get(id: string): CompetitionSession | undefined { return this.list().find(session => session.id === id) }

  create(session: CompetitionSession): Promise<void> {
    return this.adapter.mutate(KEY, () => {
      if (!validSession(session)) throw new Error('Invalid competition session schema')
      const sessions = this.list()
      if (sessions.some(existing => existing.id === session.id)) throw new Error('Competition session already exists')
      this.adapter.write(KEY, [...sessions, session])
    })
  }

  apply(id: string, operation: SessionOperation): Promise<SessionReceipt> {
    return this.adapter.mutate(KEY, () => {
      const sessions = this.list()
      const index = sessions.findIndex(session => session.id === id)
      if (index < 0) throw new Error('Competition session not found')
      // The shared transition checks a replay before its stale revision check.
      const transition = applySessionOperation(sessions[index]!, operation)
      if (transition.changed) {
        if (!validSession(transition.session)) throw new Error('Invalid competition session schema')
        sessions[index] = transition.session
        this.adapter.write(KEY, sessions)
      }
      // A failed write throws before the caller receives a successful receipt.
      return transition.receipt
    })
  }

  removeMany(ids: readonly string[]): Promise<void> {
    if (!ids.length) return Promise.resolve()
    const selected = new Set(ids)
    return this.adapter.mutate(KEY, () => {
      const sessions = this.list()
      const remaining = sessions.filter(session => !selected.has(session.id))
      if (remaining.length !== sessions.length) this.adapter.write(KEY, remaining)
    })
  }

  subscribe(listener: () => void): () => void { return this.adapter.subscribe(listener, KEY) }
}
