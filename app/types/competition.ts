import type { Score } from './debug-game'

export type ScoringStrategy = 'BEST' | 'LATEST'

export type CompetitionConfig = {
  difficulty: number
  scoringStrategy: ScoringStrategy
}

export type CompetitionLevelRef = {
  setId: string
  levelId: number
  seed?: number | string
}

export type CompetitionLevelRecord = CompetitionLevelRef & {
  key: string
  firstReadyAt: number
  mistakes: number
  attemptCursor: number
  completed: boolean
  bestPoints: number
  stars: 0 | 1 | 2 | 3
  timeSpentSeconds: number
  submittedAt?: number
}

export type CompetitionCheckpoint = {
  levelIndex: number
  levelKey?: string
  combo: number
  bestCombo: number
  inputs: number
  deadSeed?: number | string
  hearts?: number
}

type SessionMetadata = Pick<Score,
  'id' | 'playerId' | 'name' | 'avatarId' | 'challengeId' | 'setId' | 'setTitle' |
  'mode' | 'language' | 'debug' | 'age' | 'timeLimitSec'
> & { playerId: string; boardId?: string }

export type NewCompetitionSession = SessionMetadata & {
  startedAt: number
  config?: Partial<CompetitionConfig>
  deadline?: number
  checkpoint?: CompetitionCheckpoint
}

/** Already validated by the gameplay boundary; never accept client points in Live. */
export type CompetitionLevelCandidate = { correct: boolean; points: number }

type OperationBase = { id: string; at: number; expectedRevision: number }

export type SessionOperation = OperationBase & (
  | { type: 'enter-level'; level: CompetitionLevelRef; levelIndex: number }
  | { type: 'correct-input' }
  | { type: 'wrong-input' }
  | { type: 'reset-attempt' }
  | { type: 'complete-level'; candidate?: CompetitionLevelCandidate }
  | { type: 'finish' }
)

/** Receipt history excludes session snapshots to keep persistence nonrecursive. */
export type StoredSessionOperation = {
  fingerprint: string
  candidatePoints: number
  storedLevelPoints: number
  stars: 0 | 1 | 2 | 3
}

export type CompetitionSession = SessionMetadata & {
  readonly config: Readonly<CompetitionConfig>
  revision: number
  status: 'active' | 'finished'
  startedAt: number
  updatedAt: number
  deadline?: number
  finishedAt?: number
  levels: Record<string, CompetitionLevelRecord>
  checkpoint: CompetitionCheckpoint
  totalScore: number
  levelsCompleted: number
  operations: Record<string, StoredSessionOperation>
}

export type SessionReceipt = {
  operationId: string
  revision: number
  candidatePoints: number
  storedLevelPoints: number
  delta: number
  stars: 0 | 1 | 2 | 3
  totalScore: number
  levelsCompleted: number
  session: CompetitionSession
}

export type SessionTransition = {
  session: CompetitionSession
  receipt: SessionReceipt
  changed: boolean
}
