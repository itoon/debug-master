import type { RawLevel } from "../../data/levels";
import { createBuilder, printProgram } from "./ast";
import { layoutBoard } from "./layout";
import { createRng, hashSeed } from "./rng";
import { repeatLine, repeatMix, repeatNested, repeatPattern, repeatWrap } from "./templates/loop";
import { seqLine, seqTurn, seqWalk } from "./templates/sequence";
import { CONCEPT_LABELS, type Difficulty, type Template } from "./templates/types";
import { DEFAULT_RULES, validateLevel } from "./validate";

// Level generator for Dead Mode: builds level N of a run on the spot.
//
//   generateLevel(runSeed, index) -> the same level for the same inputs.
//
// The first levels climb the LADDER one step at a time (one concept step
// per level, like Set B). After the ladder every level draws a template by
// weight from HARD_POOL with hard settings. To add a concept, write its
// templates in templates/, append steps to LADDER and entries to HARD_POOL.

type Step = { template: Template; difficulty: Difficulty };

export const LADDER: Step[] = [
  { template: seqLine, difficulty: "easy" },
  { template: seqTurn, difficulty: "easy" },
  { template: seqWalk, difficulty: "normal" },
  { template: repeatLine, difficulty: "easy" },
  { template: repeatLine, difficulty: "normal" },
  { template: repeatPattern, difficulty: "normal" },
  { template: repeatWrap, difficulty: "normal" },
  { template: repeatNested, difficulty: "normal" },
  { template: repeatMix, difficulty: "normal" },
];

export const HARD_POOL: { value: Template; weight: number }[] = [
  { value: seqWalk, weight: 1 },
  { value: repeatLine, weight: 1 },
  { value: repeatPattern, weight: 2 },
  { value: repeatWrap, weight: 1.5 },
  { value: repeatNested, weight: 2 },
  { value: repeatMix, weight: 2 },
];

const MAX_ATTEMPTS = 40;
/** The last attempts fall back to easier settings before giving up. */
const EASY_RETRY_FROM = 30;

export type GeneratedLevel = RawLevel & {
  generator: {
    seed: number;
    template: string;
    difficulty: Difficulty;
    attempts: number;
    fallback: boolean;
  };
};

export function stepFor(index: number, rng: ReturnType<typeof createRng>): Step {
  return index < LADDER.length
    ? LADDER[index]
    : { template: rng.weighted(HARD_POOL), difficulty: "hard" };
}

export function generateLevel(runSeed: number, index: number): GeneratedLevel {
  const rng = createRng(hashSeed(`dead:${runSeed >>> 0}:${index}`));
  const id = index + 1;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const step = stepFor(index, rng);
    const difficulty =
      attempt >= EASY_RETRY_FROM && step.difficulty === "hard" ? "normal" : step.difficulty;
    const draft = step.template.build(rng, difficulty, createBuilder());
    const board = layoutBoard(draft.program, draft.layout, rng);
    if (!board) continue;
    const level: GeneratedLevel = {
      id,
      title: `Dead ${id.toString().padStart(2, "0")}`,
      ...board,
      code: printProgram(draft.program),
      concept: `${CONCEPT_LABELS[step.template.concept]} · ${step.template.label}`,
      learningObjective: step.template.objective,
      generator: {
        seed: runSeed >>> 0,
        template: step.template.id,
        difficulty,
        attempts: attempt + 1,
        fallback: false,
      },
    };
    const { reasons } = validateLevel(level, draft.program, {
      ...DEFAULT_RULES,
      ...draft.rules,
    });
    if (!reasons.length) return level;
  }
  return fallbackLevel(runSeed, id);
}

/** Known-good level, used only if every attempt was rejected. */
function fallbackLevel(runSeed: number, id: number): GeneratedLevel {
  return {
    id,
    title: `Dead ${id.toString().padStart(2, "0")}`,
    rows: 1,
    cols: 5,
    map: [["n", "n", "n", "n", "n"]],
    start: [0, 0],
    code: "repeat(4):\n  right()",
    concept: `${CONCEPT_LABELS.loop} · ${repeatLine.label}`,
    learningObjective: repeatLine.objective,
    generator: {
      seed: runSeed >>> 0,
      template: "fallback",
      difficulty: "easy",
      attempts: MAX_ATTEMPTS,
      fallback: true,
    },
  };
}

/** The first `count` levels of a run (review page preview, tests). */
export function generateRun(runSeed: number, count: number): GeneratedLevel[] {
  return Array.from({ length: count }, (_, index) => generateLevel(runSeed, index));
}

/** A fresh run seed for a new Dead Mode game. */
export function newRunSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
