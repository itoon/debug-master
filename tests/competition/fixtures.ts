import type { NewCompetitionSession, SessionOperation } from '../../app/types/competition'

export const START = 1_800_000_000_000
export const level = { setId: 'set-a', levelId: 1 } as const

export function newSession(overrides: Partial<NewCompetitionSession> = {}): NewCompetitionSession {
  return {
    id: 'session-1', playerId: 'player-1', name: 'Player', avatarId: 'codi_default.svg',
    setId: 'set-a', setTitle: 'Set A', mode: 'ranking', language: 'python', debug: false,
    startedAt: START, timeLimitSec: 300, challengeId: 'A',
    ...overrides,
  }
}

export function operation(
  type: SessionOperation['type'], revision: number, seconds: number,
  payload: Record<string, unknown> = {},
): SessionOperation {
  return { id: `op-${revision}`, type, at: START + seconds * 1000, expectedRevision: revision, ...payload } as SessionOperation
}
