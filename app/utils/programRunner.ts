import type {
  Condition,
  Direction,
  Frame,
  MoveNode,
  Node,
  Program,
} from "../types/debug-game";

// The one interpreter for level programs. The game runs it step by step as the
// player presses arrows; the review page (pages/review.vue) runs it to the end
// to print the expected key sequence. Change rules here and both follow.

export const MAX_EXECUTION_STEPS = 1000;
const MAX_CALL_DEPTH = 80;

export type RunState = {
  frames: Frame[];
  functions: Record<string, Node[]>;
  steps: number;
};

export type RunResult =
  | { kind: "move"; node: MoveNode }
  | { kind: "done" }
  | { kind: "error"; reason: string };

export function createRunState(program: Program): RunState {
  return {
    frames: [{ nodes: program.main, index: 0, kind: "main" }],
    functions: program.functions,
    steps: 0,
  };
}

/**
 * Advance until the program needs the next move (only move nodes need an
 * arrow key), finishes, or hits an error. `readTile` returns the tile letter
 * under the player right now, for if / while conditions.
 */
export function runUntilMove(
  state: RunState,
  readTile: () => string,
  onNode?: (node: Node) => void,
): RunResult {
  const holds = (condition: Condition) => {
    const match = readTile() === condition.color;
    return condition.negate ? !match : match;
  };

  while (state.frames.length) {
    if (state.steps > MAX_EXECUTION_STEPS) {
      return { kind: "error", reason: "Loop error" };
    }
    const frame = state.frames[state.frames.length - 1];
    if (frame.index >= frame.nodes.length) {
      if (
        frame.kind === "repeat" &&
        frame.iteration !== undefined &&
        frame.total &&
        frame.iteration < frame.total
      ) {
        frame.iteration += 1;
        frame.index = 0;
        continue;
      }
      if (
        frame.kind === "while" &&
        frame.whileNode &&
        holds(frame.whileNode.condition)
      ) {
        frame.iteration = (frame.iteration ?? 0) + 1;
        frame.index = 0;
        continue;
      }
      state.frames.pop();
      continue;
    }
    const node = frame.nodes[frame.index++];
    onNode?.(node);
    state.steps += 1;
    if (node.type === "move") {
      return { kind: "move", node };
    }
    if (node.type === "if") {
      state.frames.push({
        nodes: holds(node.condition) ? node.body : node.elseBody,
        index: 0,
        kind: "branch",
      });
      continue;
    }
    if (node.type === "repeat") {
      if (node.count > 0)
        state.frames.push({
          nodes: node.body,
          index: 0,
          kind: "repeat",
          repeatId: node.id,
          total: node.count,
          iteration: 1,
        });
      continue;
    }
    if (node.type === "while") {
      if (holds(node.condition))
        state.frames.push({
          nodes: node.body,
          index: 0,
          kind: "while",
          whileNode: node,
          iteration: 1,
        });
      continue;
    }
    if (node.type === "call") {
      const fn = state.functions[node.name];
      if (!fn) {
        return { kind: "error", reason: "Function missing" };
      }
      if (
        state.frames.filter((item) => item.kind === "function").length >
        MAX_CALL_DEPTH
      ) {
        return { kind: "error", reason: "Stack overflow" };
      }
      state.frames.push({
        nodes: fn,
        index: 0,
        kind: "function",
        functionName: node.name,
      });
    }
  }
  return { kind: "done" };
}

/** Movement wraps around the board edges. */
export function stepPosition(
  from: { row: number; col: number },
  direction: Direction,
  rows: number,
  cols: number,
): { row: number; col: number; wrapped: boolean } {
  const delta = {
    up: [-1, 0],
    down: [1, 0],
    left: [0, -1],
    right: [0, 1],
  }[direction];
  const rawRow = from.row + delta[0];
  const rawCol = from.col + delta[1];
  const row = (rawRow + rows) % rows;
  const col = (rawCol + cols) % cols;
  return { row, col, wrapped: row !== rawRow || col !== rawCol };
}

export type LevelSolution = {
  moves: Direction[];
  path: [number, number][];
  end: [number, number];
  wraps: number;
  error?: string;
};

/** Run a whole level as if every key press were correct. */
export function solveLevel(
  level: {
    rows: number;
    cols: number;
    map: string[][];
    start: [number, number];
  },
  program: Program,
): LevelSolution {
  const state = createRunState(program);
  const pos = { row: level.start[0], col: level.start[1] };
  const moves: Direction[] = [];
  const path: [number, number][] = [[pos.row, pos.col]];
  let wraps = 0;
  const readTile = () => level.map[pos.row]?.[pos.col] ?? "n";

  for (;;) {
    const result = runUntilMove(state, readTile);
    if (result.kind === "done") break;
    if (result.kind === "error") {
      return { moves, path, end: [pos.row, pos.col], wraps, error: result.reason };
    }
    const next = stepPosition(pos, result.node.direction, level.rows, level.cols);
    pos.row = next.row;
    pos.col = next.col;
    if (next.wrapped) wraps += 1;
    moves.push(result.node.direction);
    path.push([pos.row, pos.col]);
  }
  return { moves, path, end: [pos.row, pos.col], wraps };
}
