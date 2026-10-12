import type { RawLevel } from "../../app/data/levels";
import type { Node, Program } from "../../app/types/debug-game";
import { useProgramParser } from "../../app/composables/useProgramParser";
import { DELTA } from "../../app/utils/levelGen/ast";
import { createRng, hashSeed } from "../../app/utils/levelGen/rng";
import { createRunState, runUntilMove, stepPosition } from "../../app/utils/programRunner";
import type { Tier } from "../../app/utils/conceptFeatures";

// Turns a lesson spec (program + the colours its conditions should see) into
// a board. The program runs on the game's own interpreter; whenever an
// if / while reads a cell for the first time, the cell takes the next colour
// from `tiles`. Cells Codi only walks over get the `path` colour, the rest of
// the board is `bg` plus a few decoys next to the path.

export type LessonSpec = {
  id: number;
  group: Tier;
  concept: string;
  objective: string;
  code: string;
  /**
   * Colour of each cell the conditions read, in the order they are first
   * read. "." means the path colour (matches no condition in the code).
   */
  tiles?: string;
  /** Colour of cells walked over but never read. */
  path?: string;
  /** Colour of the rest of the board. Default "n". */
  bg?: string;
  /** Fixed board for wrap-around lessons: [rows, cols, startRow, startCol]. */
  board?: [number, number, number, number];
  /** Max empty rows/cols around the path on a fitted board. Default 1. */
  pad?: number;
  /** Off-path cells next to the path painted in condition colours. */
  decoys?: number;
};

/** Path colours for lessons without conditions, picked by lesson id. */
const PATH_PALETTE = ["b", "p", "g", "y", "o", "v"];

export function conditionColors(program: Program): string[] {
  const colors = new Set<string>();
  const visit = (nodes: Node[]) => {
    for (const node of nodes) {
      if (node.type === "if") {
        colors.add(node.condition.color);
        visit(node.body);
        visit(node.elseBody);
      } else if (node.type === "while") {
        colors.add(node.condition.color);
        visit(node.body);
      } else if (node.type === "repeat") visit(node.body);
    }
  };
  visit(program.main);
  Object.values(program.functions).forEach(visit);
  return [...colors];
}

export type Painted = {
  level: RawLevel;
  moves: string[];
  /** Colours in `tiles` that were never read (the spec does not match). */
  unusedTiles: string;
  /** Cells read after `tiles` ran out (they got the path colour). */
  defaulted: number;
};

export function paintLesson(spec: LessonSpec): Painted {
  const program = useProgramParser(() => spec.id).parseProgram(spec.code);
  const condColors = conditionColors(program);
  const bg = spec.bg ?? "n";
  const path =
    spec.path ??
    (condColors.length
      ? "n"
      : PATH_PALETTE.filter((c) => c !== bg)[spec.id % (PATH_PALETTE.length - 1)]);
  if (condColors.includes(path)) {
    throw new Error(`lesson ${spec.id}: path colour "${path}" is also a condition colour`);
  }

  const script = [...(spec.tiles ?? "")];
  let used = 0;
  let defaulted = 0;
  const painted = new Map<string, string>();
  const visited: [number, number][] = [];
  const key = (r: number, c: number) => `${r},${c}`;

  const fixed = spec.board;
  const pos = fixed ? { row: fixed[2], col: fixed[3] } : { row: 0, col: 0 };
  visited.push([pos.row, pos.col]);

  const readTile = () => {
    const k = key(pos.row, pos.col);
    let color = painted.get(k);
    if (color === undefined) {
      const next = script[used];
      if (next === undefined) {
        defaulted += 1;
        color = path;
      } else {
        used += 1;
        color = next === "." ? path : next;
      }
      painted.set(k, color);
    }
    return color;
  };

  const state = createRunState(program);
  const moves: string[] = [];
  for (;;) {
    const result = runUntilMove(state, readTile);
    if (result.kind === "done") break;
    if (result.kind === "error") {
      throw new Error(`lesson ${spec.id}: ${result.reason} after ${moves.length} moves`);
    }
    const direction = result.node.direction;
    moves.push(direction);
    if (fixed) {
      const next = stepPosition(pos, direction, fixed[0], fixed[1]);
      pos.row = next.row;
      pos.col = next.col;
    } else {
      const [dr, dc] = DELTA[direction];
      pos.row += dr;
      pos.col += dc;
    }
    visited.push([pos.row, pos.col]);
  }

  // Fit the board around everything visited (fixed boards keep their size).
  const rng = createRng(hashSeed(`challenge:${spec.id}`));
  let rows: number;
  let cols: number;
  let offR = 0;
  let offC = 0;
  if (fixed) {
    [rows, cols] = fixed;
  } else {
    const pad = spec.pad ?? 1;
    const rs = visited.map(([r]) => r);
    const cs = visited.map(([, c]) => c);
    const top = rng.int(0, pad);
    const left = rng.int(0, pad);
    offR = top - Math.min(...rs);
    offC = left - Math.min(...cs);
    rows = Math.max(...rs) - Math.min(...rs) + 1 + top + rng.int(0, pad);
    cols = Math.max(...cs) - Math.min(...cs) + 1 + left + rng.int(0, pad);
  }

  const map = Array.from({ length: rows }, () => Array.from({ length: cols }, () => bg));
  const onPath = new Set<string>();
  for (const [r, c] of visited) {
    const k = key(r, c);
    onPath.add(key(r + offR, c + offC));
    map[r + offR][c + offC] = painted.get(k) ?? path;
  }

  // Decoys: condition colours (or other scenery) right next to the path, so
  // the board does not give the answer away by colour alone.
  const decoyColors = condColors.length
    ? condColors
    : PATH_PALETTE.filter((c) => c !== path && c !== bg);
  const near: [number, number][] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (onPath.has(key(r, c))) continue;
      const touches = [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ].some(([a, b]) => onPath.has(key(a, b)));
      if (touches) near.push([r, c]);
    }
  }
  const decoyCount = Math.min(spec.decoys ?? (condColors.length ? 3 : 2), near.length);
  for (const [r, c] of rng.shuffle(near).slice(0, decoyCount)) {
    map[r][c] = rng.pick(decoyColors);
  }

  const start: [number, number] = fixed
    ? [fixed[2], fixed[3]]
    : [offR, offC];

  return {
    level: {
      id: spec.id,
      title: `New ${spec.id}`,
      rows,
      cols,
      map,
      start,
      code: spec.code,
      concept: spec.concept,
      learningObjective: spec.objective,
    },
    moves,
    unusedTiles: script.slice(used).join(""),
    defaulted,
  };
}
