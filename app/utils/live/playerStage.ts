// Pure derivation of which screen a live player should see. No Vue imports.
import { serverTime } from './clock'
import type { RoomState } from './protocol'

export type LivePlayerStage =
  | 'unavailable'
  | 'setup'
  | 'connecting'
  | 'lobby'
  | 'queued'
  | 'full'
  | 'kicked'
  | 'countdown'
  | 'running'
  | 'results'

export interface PlayerStageInput {
  enabled: boolean
  code: string | null
  hasProfile: boolean
  connected: boolean // part of the input for callers; no rule depends on it
  notice: 'full' | 'kicked' | null
  state: RoomState | null
  /** This device's public LivePlayer.id (from `you`), never the secret pid. Empty until known. */
  selfId: string
  offset: number
  now: number
}

/** First matching rule wins. */
export function derivePlayerStage(i: PlayerStageInput): LivePlayerStage {
  if (!i.enabled || i.code == null) return 'unavailable'
  if (!i.hasProfile) return 'setup'
  if (i.notice) return i.notice
  if (!i.state) return 'connecting'
  const self = i.selfId ? i.state.players.find(p => p.id === i.selfId) : undefined
  if (!self) return 'connecting'
  if (self.status === 'queued') return 'queued'

  const { phase, startAt } = i.state
  if (phase === 'lobby') return 'lobby'
  // Trust the server clock: the race starts at startAt even if the 'running' broadcast is late.
  if (phase === 'countdown' && startAt != null && serverTime(i.offset, i.now) < startAt) return 'countdown'
  if (phase === 'running' || phase === 'countdown') return 'running'
  return 'results'
}
