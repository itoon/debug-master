import type { Score } from "../types/debug-game";
import type { RankingBoard } from "../utils/ranking";

export type PlayerProfile = { id: string; nickname: string; age: number; avatarId?: string };
export type PlayerSetupInput = Omit<PlayerProfile, "id"> & { avatarId: string };

export interface PlayerRepository {
  save(player: PlayerProfile): Promise<void>;
  clearCurrent(): Promise<void>;
  clearIfPlayer(playerId: string): Promise<void>;
}

export interface ScoreRepository {
  list(): Score[];
  save(score: Score): Promise<void>;
  remove(scoreId: string): Promise<void>;
  today(board: RankingBoard, now?: Date, limit?: number): Score[];
  rank(scoreId: string, board: RankingBoard, now?: Date): number | undefined;
  subscribe(listener: () => void): () => void;
}
