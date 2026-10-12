import type { RawLevel } from "../../data/levels";
import type { Program } from "../../types/debug-game";
import { useProgramParser } from "../../composables/useProgramParser";
import { solveLevel, type LevelSolution } from "../programRunner";
import { countMoveStatements } from "./ast";

// Every generated level must pass these rules before a player sees it.
// The rules run the level with the game's own parser + interpreter, so a
// valid level is guaranteed playable exactly as the game will run it.

export type Rules = {
  minMoves: number;
  maxMoves: number;
  maxRows: number;
  maxCols: number;
  maxLines: number;
  /** Wrap-around puzzles may cross their own path; others must not. */
  allowRevisit?: boolean;
  /** The puzzle is about wrapping, so the path must wrap at least once. */
  requireWrap?: boolean;
  /** A loop must save writing: more moves run than move lines written. */
  loopMustMatter?: boolean;
};

export const DEFAULT_RULES: Rules = {
  minMoves: 2,
  maxMoves: 14,
  maxRows: 8,
  maxCols: 8,
  maxLines: 10,
};

/** Returns the reasons a level is rejected (empty = valid). */
export function validateLevel(
  level: RawLevel,
  program: Program,
  rules: Rules,
): { reasons: string[]; solution: LevelSolution } {
  const reasons: string[] = [];
  const solution = solveLevel(level, program);

  // The printed code must parse back to the same behaviour.
  const parsed = useProgramParser(() => level.id).parseProgram(level.code);
  const fromCode = solveLevel(level, parsed);
  if (fromCode.moves.join() !== solution.moves.join()) {
    reasons.push("printed code runs differently from the generated program");
  }

  if (solution.error) reasons.push(`run error: ${solution.error}`);
  const moves = solution.moves.length;
  if (moves < rules.minMoves) reasons.push(`too few moves (${moves})`);
  if (moves > rules.maxMoves) reasons.push(`too many moves (${moves})`);
  if (level.rows > rules.maxRows || level.cols > rules.maxCols) {
    reasons.push(`board too big (${level.rows}x${level.cols})`);
  }
  const lines = level.code.split("\n").filter((line) => line.trim()).length;
  if (lines > rules.maxLines) reasons.push(`too many lines (${lines})`);

  const [startRow, startCol] = level.start;
  if (!level.map[startRow]?.[startCol]) reasons.push("start is off the board");

  if (!rules.allowRevisit) {
    const seen = new Set(solution.path.map(([r, c]) => `${r},${c}`));
    if (seen.size !== solution.path.length) reasons.push("path crosses itself");
  }
  if (rules.requireWrap && !solution.wraps) reasons.push("path never wraps");
  if (!rules.requireWrap && solution.wraps) reasons.push("path wraps unexpectedly");
  if (rules.loopMustMatter && moves <= countMoveStatements(program)) {
    reasons.push("loop does not save any lines");
  }
  return { reasons, solution };
}
