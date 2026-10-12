import type { Mode, Score } from "../types/debug-game";

// Today's leaderboard rules, shared by the start screen and the end-of-game
// ranking (components/TodayRanking.vue). Pure functions, no Vue.

export const PLAYER_AGES = Array.from({ length: 14 }, (_, index) => index + 5); // 5..18

/** Age bands shown next to names (exact ages stay private). */
const AGE_BANDS: [number, number][] = [
  [5, 8],
  [9, 12],
  [13, 15],
  [16, 18],
];

export function ageBand(age?: number): string {
  if (!age) return "";
  const band = AGE_BANDS.find(([min, max]) => age >= min && age <= max);
  return band ? `อายุ ${band[0]}–${band[1]}` : "";
}

/** Scores compete only with the same set, mode and time limit. */
export type RankingBoard = {
  challengeId?: "A" | "B" | "C";
  setId: string;
  mode: Mode;
  /** Ranking and timer modes only. */
  timeLimitSec?: number;
};

/** Calendar day in Thai time (Asia/Bangkok), as YYYY-MM-DD. */
export function bangkokDay(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

function timeLimitOf(score: Score): number | undefined {
  // Scores saved before timeLimitSec existed: Ranking was always 5 minutes.
  if (score.timeLimitSec) return score.timeLimitSec;
  return score.mode === "ranking" ? 300 : undefined;
}

export function isOnBoard(score: Score, board: RankingBoard): boolean {
  if (board.challengeId) return score.challengeId === board.challengeId;
  if (score.challengeId) return false;
  if (score.setId !== board.setId || score.mode !== board.mode) return false;
  if (board.mode === "ranking" || board.mode === "timer") {
    return timeLimitOf(score) === board.timeLimitSec;
  }
  return true;
}

/** Today's scores on a board: higher score first, then less time. */
export function todayRanking(
  scores: Score[],
  board: RankingBoard,
  now: Date = new Date(),
  limit = 10,
): Score[] {
  const today = bangkokDay(now);
  return scores
    .filter((score) => isOnBoard(score, board) && bangkokDay(score.createdAt) === today)
    .sort((a, b) => b.score - a.score || a.elapsedMs - b.elapsedMs)
    .slice(0, limit);
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${minutes.toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}
