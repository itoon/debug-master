import type { RawLevel } from "../data/levels";
import type { CodeLanguage } from "../utils/codeLanguage";

export type { CodeLanguage } from "../utils/codeLanguage";

export type Direction = "up" | "down" | "left" | "right";

export type GameStatus =
  | "ready"
  | "playing"
  | "success"
  | "failed"
  | "timeup"
  | "completed";

export type Mode = "campaign" | "timer" | "ranking" | "dead";

export type Condition = { color: string; negate: boolean };

/** Optional 1-based source position for UI hints; execution ignores it. */
type SourceLocation = { sourceLine?: number };

export type MoveNode = SourceLocation & { id: string; type: "move"; direction: Direction };

export type IfNode = SourceLocation & {
  id: string;
  type: "if";
  condition: Condition;
  body: Node[];
  elseBody: Node[];
};

export type RepeatNode = SourceLocation & {
  id: string;
  type: "repeat";
  count: number;
  body: Node[];
};

export type WhileNode = SourceLocation & {
  id: string;
  type: "while";
  condition: Condition;
  body: Node[];
};

export type CallNode = SourceLocation & { id: string; type: "call"; name: string };

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
  /** Home v2 boards use their own identity; legacy results never enter A/B/C. */
  challengeId?: "A" | "B" | "C";
  playerId?: string;
  /** Optional so existing stored scores remain valid without migration. */
  avatarId?: string;
  id: string;
  name: string;
  setId: string;
  setTitle: string;
  mode: Mode;
  language: CodeLanguage;
  debug: boolean;
  score: number;
  bestCombo: number;
  levelsCompleted: number;
  levelReached: number;
  inputs: number;
  elapsedMs: number;
  createdAt: string;
  /** Player age picked on the start screen (shown as an age band). */
  age?: number;
  /** Ranking / timer modes: the run's time limit, so boards don't mix. */
  timeLimitSec?: number;
};

/** Transient practice results; never stored in the score repository. */
export type PracticeSummary = {
  elapsedMs: number;
  levelsCompleted: number;
  mistakes: number;
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
  kind: string;
  symbol: string;
};

export type LevelLike = Pick<
  RawLevel,
  "id" | "rows" | "cols" | "map" | "start" | "code" | "concept" | "learningObjective"
>;
