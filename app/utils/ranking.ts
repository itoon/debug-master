import type { CompetitionConfig, ScoringStrategy } from "../types/competition";
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

/** Scores compete only with the same challenge, set, mode, time limit and scoring config. */
export type RankingBoard = CompetitionConfig & {
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

export function isOnBoard(score: Score, board: RankingBoard): boolean {
  if (board.challengeId ? score.challengeId !== board.challengeId : !!score.challengeId) return false;
  if (score.setId !== board.setId || score.mode !== board.mode) return false;
  if (score.difficulty !== board.difficulty || score.scoringStrategy !== board.scoringStrategy) return false;
  if (board.mode === "ranking" || board.mode === "timer") {
    return score.timeLimitSec === board.timeLimitSec;
  }
  return true;
}

/** Player identity is stable across sessions; nicknames are never identity. */
export function scorePlayerKey(score: Score): string {
  return score.playerId!;
}

/** A zero-point run stays in history but has no leaderboard position. */
export function hasRankingScore(score: Pick<Score, 'score'>): boolean {
  return score.score > 0;
}

/** Negative means a ranks before b. Elapsed duration is display-only. */
export function compareCompetitionScores(a: Score, b: Score, strategy: ScoringStrategy): number {
  const updated = Date.parse(a.updatedAt!) - Date.parse(b.updatedAt!);
  return b.score - a.score || b.levelsCompleted - a.levelsCompleted ||
    (strategy === "BEST" ? updated : -updated) || compareSessionIds(a, b);
}

function compareSessionIds(a: Score, b: Score): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function compareLatestSessions(a: Score, b: Score): number {
  return Date.parse(b.updatedAt!) - Date.parse(a.updatedAt!) || compareSessionIds(a, b);
}

/** Input is already scoped to one board/day. Zero-score sessions must participate. */
export function selectPlayerSessions(scores: readonly Score[], strategy: ScoringStrategy): Score[] {
  const selected = new Map<string, Score>();
  for (const score of scores) {
    const key = scorePlayerKey(score);
    const previous = selected.get(key);
    if (!previous || (strategy === "BEST"
      ? compareCompetitionScores(score, previous, "BEST")
      : compareLatestSessions(score, previous)) < 0) selected.set(key, score);
  }
  return [...selected.values()];
}

/** All stored history on this board; BEST is independent of the board's strategy. */
export function bestPlayerScore(scores: readonly Score[], board: RankingBoard, playerId: string): Score | undefined {
  return scores.filter(score => isOnBoard(score, board) && scorePlayerKey(score) === playerId)
    .sort((a, b) => compareCompetitionScores(a, b, "BEST"))[0];
}

/** Latest history includes zero-score results and uses update time, not start time. */
export function latestPlayerScore(scores: readonly Score[], board: RankingBoard, playerId: string): Score | undefined {
  return scores.filter(score => isOnBoard(score, board) && scorePlayerKey(score) === playerId)
    .sort(compareLatestSessions)[0];
}

/** Scope, select, exclude zero, rank, then limit; the order matters for LATEST. */
export function todayRanking(
  scores: readonly Score[],
  board: RankingBoard,
  now: Date = new Date(),
  limit = 10,
): Score[] {
  const today = bangkokDay(now);
  const candidates = scores.filter(score => isOnBoard(score, board) && bangkokDay(score.createdAt) === today);
  return selectPlayerSessions(candidates, board.scoringStrategy)
    .filter(hasRankingScore)
    .sort((a, b) => compareCompetitionScores(a, b, board.scoringStrategy))
    .slice(0, limit);
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${minutes.toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}
