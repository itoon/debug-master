import type {
  Condition,
  Direction,
  IfNode,
  MoveNode,
  Node,
  Program,
  RepeatNode,
  WhileNode,
  CallNode,
} from "../../types/debug-game";

// Build level programs as trees (the same Node types the parser produces),
// then print them as the Python-style code stored in level data.

export const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];

export const DELTA: Record<Direction, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

export const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function perpendicular(direction: Direction): Direction[] {
  return direction === "up" || direction === "down"
    ? ["left", "right"]
    : ["up", "down"];
}

/** Node factory; ids only need to be unique inside one program. */
export function createBuilder() {
  let id = 0;
  const nextId = (kind: string) => `gen-${kind}-${id++}`;
  return {
    move: (direction: Direction): MoveNode => ({
      id: nextId("move"),
      type: "move",
      direction,
    }),
    moves: (direction: Direction, count: number): MoveNode[] =>
      Array.from({ length: count }, () => ({
        id: nextId("move"),
        type: "move" as const,
        direction,
      })),
    repeat: (count: number, body: Node[]): RepeatNode => ({
      id: nextId("repeat"),
      type: "repeat",
      count,
      body,
    }),
    ifElse: (condition: Condition, body: Node[], elseBody: Node[] = []): IfNode => ({
      id: nextId("if"),
      type: "if",
      condition,
      body,
      elseBody,
    }),
    whileLoop: (condition: Condition, body: Node[]): WhileNode => ({
      id: nextId("while"),
      type: "while",
      condition,
      body,
    }),
    call: (name: string): CallNode => ({ id: nextId("call"), type: "call", name }),
  };
}

export type Builder = ReturnType<typeof createBuilder>;

const INDENT = "  ";

function printCondition(condition: Condition): string {
  return `${condition.negate ? "not " : ""}${condition.color}`;
}

function printNodes(nodes: Node[], depth: number, out: string[]): void {
  const pad = INDENT.repeat(depth);
  for (const node of nodes) {
    if (node.type === "move") {
      out.push(`${pad}${node.direction}()`);
    } else if (node.type === "call") {
      out.push(`${pad}${node.name}()`);
    } else if (node.type === "repeat") {
      out.push(`${pad}repeat(${node.count}):`);
      printNodes(node.body, depth + 1, out);
    } else if (node.type === "while") {
      out.push(`${pad}while ${printCondition(node.condition)}:`);
      printNodes(node.body, depth + 1, out);
    } else {
      printIf(node, depth, "if", out);
    }
  }
}

function printIf(node: IfNode, depth: number, keyword: "if" | "elif", out: string[]): void {
  const pad = INDENT.repeat(depth);
  out.push(`${pad}${keyword} ${printCondition(node.condition)}:`);
  printNodes(node.body, depth + 1, out);
  const [only] = node.elseBody;
  if (node.elseBody.length === 1 && only.type === "if") {
    printIf(only, depth, "elif", out);
  } else if (node.elseBody.length) {
    out.push(`${pad}else:`);
    printNodes(node.elseBody, depth + 1, out);
  }
}

/** Python-style source, laid out like the hand-written levels. */
export function printProgram(program: Program): string {
  const out: string[] = [];
  printNodes(program.main, 0, out);
  for (const [name, body] of Object.entries(program.functions)) {
    out.push("", `def ${name}():`);
    printNodes(body, 1, out);
  }
  return out.join("\n");
}

/** Number of move statements written in the code (not moves executed). */
export function countMoveStatements(program: Program): number {
  const count = (nodes: Node[]): number =>
    nodes.reduce((sum, node) => {
      if (node.type === "move") return sum + 1;
      if (node.type === "repeat" || node.type === "while") return sum + count(node.body);
      if (node.type === "if") return sum + count(node.body) + count(node.elseBody);
      return sum;
    }, 0);
  return (
    count(program.main) +
    Object.values(program.functions).reduce((sum, body) => sum + count(body), 0)
  );
}
