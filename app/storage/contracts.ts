import type { CompetitionSession, ScoringStrategy, SessionOperation, SessionReceipt } from "../types/competition";
import type { Score } from "../types/debug-game";
import type { RankingBoard } from "../utils/ranking";
import type { ChallengeId, LoginMethod, ModeScoringStrategies } from "../data/home-config";

export type PlayerProfile = { id: string; nickname: string; age?: number; avatarId?: string };
export type PlayerSetupInput = Omit<PlayerProfile, "id"> & { avatarId: string };
export type CodiLinks = Record<string, string>;

export interface PlayerRepository {
  save(player: PlayerProfile): Promise<void>;
  clearCurrent(): Promise<void>;
  clearIfPlayer(playerId: string): Promise<void>;
  /** Codi Arena subject → the local player created for that badge. */
  codiLinks(): CodiLinks;
  rememberCodi(sub: string, playerId: string): Promise<void>;
}

export interface ScoreRepository {
  list(): Score[];
  save(score: Score): Promise<void>;
  remove(scoreId: string): Promise<void>;
  removeMany(scoreIds: readonly string[]): Promise<void>;
  today(board: RankingBoard, now?: Date, limit?: number): Score[];
  rank(scoreId: string, board: RankingBoard, now?: Date): number | undefined;
  subscribe(listener: () => void): () => void;
}

export interface ModeSettingsRepository {
  /** Modes switched on at /modes, or undefined when the team kept the home-config defaults. */
  enabledIds(): ChallengeId[] | undefined;
  /** Shared solo competition duration; undefined uses the five-minute config default. */
  durationSec(): number | undefined;
  save(ids: ChallengeId[]): Promise<void>;
  scoringStrategies(): ModeScoringStrategies;
  setScoringStrategy(id: ChallengeId, strategy: ScoringStrategy): Promise<void>;
  saveDuration(seconds: number): Promise<void>;
  /** Codi Arena or the typed form. Undefined keeps the home-config default. */
  loginMethod(): LoginMethod | undefined;
  setLoginMethod(method: LoginMethod): Promise<void>;
  reset(): Promise<void>;
  subscribe(listener: () => void): () => void;
}

export interface CompetitionSessionStore {
  list(): CompetitionSession[];
  get(id: string): CompetitionSession | undefined;
  create(session: CompetitionSession): Promise<void>;
  apply(id: string, operation: SessionOperation): Promise<SessionReceipt>;
  removeMany(ids: readonly string[]): Promise<void>;
  subscribe(listener: () => void): () => void;
}
