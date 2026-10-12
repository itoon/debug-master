import type { Program } from "../../../types/debug-game";
import type { Builder } from "../ast";
import type { Layout } from "../layout";
import type { Rng } from "../rng";
import type { Rules } from "../validate";

export type Concept = "sequence" | "loop" | "condition" | "function";

export type Difficulty = "easy" | "normal" | "hard";

export const CONCEPT_LABELS: Record<Concept, string> = {
  sequence: "Sequence",
  loop: "Loop",
  condition: "Condition",
  function: "Function",
};

export type TemplateDraft = {
  program: Program;
  layout: Layout;
  /** Overrides on top of DEFAULT_RULES. */
  rules?: Partial<Rules>;
};

/** One kind of puzzle. `build` draws a fresh program from the rng. */
export type Template = {
  id: string;
  concept: Concept;
  label: string;
  /** Shown in the game as the level's learning objective. */
  objective: string;
  build: (rng: Rng, difficulty: Difficulty, b: Builder) => TemplateDraft;
};

/** Pick a range by difficulty: [easy, normal, hard]. */
export function byLevel<T>(difficulty: Difficulty, values: [T, T, T]): T {
  return values[difficulty === "easy" ? 0 : difficulty === "normal" ? 1 : 2];
}
