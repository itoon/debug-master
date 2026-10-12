import type { Score } from "../types/debug-game";
import type { RankingBoard } from "../utils/ranking";

export type PlayerProfile = { id: string; nickname: string; age: number };

export interface PlayerRepository {
  save(player: PlayerProfile): void;
  clearCurrent(): void;
}

export interface ScoreRepository {
  list(): Score[];
  save(score: Score): void;
  today(board: RankingBoard, now?: Date, limit?: number): Score[];
  rank(scoreId: string, board: RankingBoard, now?: Date): number | undefined;
  subscribe(listener: () => void): () => void;
}
