import type { RawLevel } from "../data/levels";

export type Direction = "up" | "down" | "left" | "right";

export type GameStatus =
  | "ready"
  | "playing"
  | "success"
  | "failed"
  | "timeup"
  | "completed";

export type Mode = "campaign" | "timer" | "ranking";

export type Condition = { color: string; negate: boolean };

export type MoveNode = { id: string; type: "move"; direction: Direction };

export type IfNode = {
  id: string;
  type: "if";
  condition: Condition;
  body: Node[];
  elseBody: Node[];
};

export type RepeatNode = {
  id: string;
  type: "repeat";
  count: number;
  body: Node[];
};

export type WhileNode = {
  id: string;
  type: "while";
  condition: Condition;
  body: Node[];
};

export type CallNode = { id: string; type: "call"; name: string };

export type Node = MoveNode | IfNode | RepeatNode | WhileNode | CallNode;

export type Program = { main: Node[]; functions: Record<string, Node[]> };

export type Frame = {
  nodes: Node[];
  index: number;
  kind: "main" | "branch" | "repeat" | "while" | "function";
  repeatId?: string;
  total?: number;
  iteration?: number;
  whileNode?: WhileNode;
  functionName?: string;
};

export type Score = {
  id: string;
  name: string;
  setId: string;
  setTitle: string;
  mode: Mode;
  debug: boolean;
  score: number;
  bestCombo: number;
  levelsCompleted: number;
  levelReached: number;
  inputs: number;
  elapsedMs: number;
  createdAt: string;
};

export type ScorePopup = {
  levelId: number;
  points: number;
  speedMultiplier: number;
  comboMultiplier: number;
};

export type CodeSegment =
  | { kind: "plain"; text: string }
  | { kind: "keyword"; text: string }
  | { kind: "name"; text: string }
  | { kind: "number"; text: string }
  | { kind: "punct"; text: string }
  | { kind: "tile"; color: string; negate: boolean };

export type TileMeta = { name: string; symbol: string };

export type VisibleTile = {
  row: number;
  col: number;
  raw: string;
  colorName: string;
  symbol: string;
};

export type LevelLike = Pick<
  RawLevel,
  "id" | "rows" | "cols" | "map" | "start" | "code" | "concept" | "learningObjective"
>;

export const colorMeta: Record<string, TileMeta> = {
  b: { name: "cyan", symbol: "B" },
  p: { name: "pink", symbol: "P" },
  g: { name: "green", symbol: "G" },
  o: { name: "orange", symbol: "O" },
  y: { name: "yellow", symbol: "Y" },
  v: { name: "purple", symbol: "V" },
  n: { name: "gray", symbol: "" },
  k: { name: "black", symbol: "K" },
};
