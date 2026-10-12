import type { Direction, Program } from "../../types/debug-game";
import { createRunState, runUntilMove } from "../programRunner";
import { DELTA } from "./ast";
import type { Rng } from "./rng";

// Turn a program into a board: either trace it on an open plane and fit the
// board around the path, or (for wrap-around puzzles) use a fixed board.

export type Layout =
  | { kind: "fit"; padding: number }
  | { kind: "fixed"; rows: number; cols: number; start: [number, number] };

export type BoardDraft = {
  rows: number;
  cols: number;
  start: [number, number];
  map: string[][];
};

/** Tile letters used as scenery on levels without conditions. */
const DECOR_TILES = ["g", "p", "b", "y"];

/**
 * Run a condition-free program on an endless plane from (0, 0).
 * Returns null if it errors or never ends.
 */
export function traceOnPlane(program: Program): [number, number][] | null {
  const state = createRunState(program);
  const pos = { row: 0, col: 0 };
  const path: [number, number][] = [[0, 0]];
  for (;;) {
    const result = runUntilMove(state, () => "n");
    if (result.kind === "done") return path;
    if (result.kind === "error") return null;
    const [dr, dc] = DELTA[result.node.direction as Direction];
    pos.row += dr;
    pos.col += dc;
    path.push([pos.row, pos.col]);
  }
}

export function layoutBoard(
  program: Program,
  layout: Layout,
  rng: Rng,
): BoardDraft | null {
  let rows: number;
  let cols: number;
  let start: [number, number];
  let pathCells: [number, number][];

  if (layout.kind === "fixed") {
    ({ rows, cols, start } = layout);
    pathCells = [start];
  } else {
    const path = traceOnPlane(program);
    if (!path) return null;
    const rowsUsed = path.map(([r]) => r);
    const colsUsed = path.map(([, c]) => c);
    const pad = () => rng.int(0, layout.padding);
    const top = pad();
    const left = pad();
    const minRow = Math.min(...rowsUsed);
    const minCol = Math.min(...colsUsed);
    rows = Math.max(...rowsUsed) - minRow + 1 + top + pad();
    cols = Math.max(...colsUsed) - minCol + 1 + left + pad();
    start = [top - minRow, left - minCol];
    pathCells = path.map(([r, c]) => [r - minRow + top, c - minCol + left]);
  }

  const map = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => "n"),
  );
  // A little scenery off the path. These levels have no conditions, so the
  // colours never change what the program does.
  const onPath = new Set(pathCells.map(([r, c]) => `${r},${c}`));
  const free: [number, number][] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (!onPath.has(`${r},${c}`)) free.push([r, c]);
    }
  }
  const decorCount = rng.int(0, Math.min(3, Math.floor(free.length / 4)));
  for (const [r, c] of rng.shuffle(free).slice(0, decorCount)) {
    map[r][c] = rng.pick(DECOR_TILES);
  }
  return { rows, cols, start, map };
}
