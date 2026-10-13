import type { Node, Program } from "../types/debug-game";

// Which language features a level program uses. Challenge groups
// (data/challenge-groups.ts) set a ceiling of allowed features, so a
// Beginner level can never sneak in a while loop or a function.
// Pure functions, no Vue.

export type Feature =
  | "repeat"
  | "if"
  | "else"
  | "elif"
  | "while"
  | "not"
  | "function"
  | "recursion";

export const FEATURE_LABELS: Record<Feature, string> = {
  repeat: "repeat",
  if: "if",
  else: "else",
  elif: "elif",
  while: "while",
  not: "not",
  function: "def",
  recursion: "recursion",
};

export type Tier = "beginner" | "intermediate" | "pro";

/**
 * Features each tier may use. Each tier follows the concepts of its Set 01
 * range: Beginner #1–20, Intermediate #21–40, Pro #41–60.
 */
export const TIER_CEILINGS: Record<Tier, Feature[]> = {
  beginner: ["repeat", "if"],
  intermediate: ["repeat", "if", "else", "elif", "while", "not"],
  pro: ["repeat", "if", "else", "elif", "while", "not", "function", "recursion"],
};

export function programFeatures(program: Program): Set<Feature> {
  const found = new Set<Feature>();

  const visit = (nodes: Node[]): void => {
    for (const node of nodes) {
      if (node.type === "repeat") {
        found.add("repeat");
        visit(node.body);
      } else if (node.type === "while") {
        found.add("while");
        if (node.condition.negate) found.add("not");
        visit(node.body);
      } else if (node.type === "if") {
        found.add("if");
        if (node.condition.negate) found.add("not");
        visit(node.body);
        // The parser stores `elif` as a lone if inside elseBody.
        const [only] = node.elseBody;
        if (node.elseBody.length === 1 && only.type === "if") found.add("elif");
        else if (node.elseBody.length) found.add("else");
        visit(node.elseBody);
      } else if (node.type === "call") {
        found.add("function");
      }
    }
  };

  visit(program.main);
  for (const body of Object.values(program.functions)) visit(body);
  if (Object.keys(program.functions).length) found.add("function");
  if (hasRecursion(program)) found.add("recursion");
  return found;
}

/** Features used beyond `allowed` (empty = the level fits the ceiling). */
export function featuresBeyond(program: Program, allowed: readonly Feature[]): Feature[] {
  const allow = new Set(allowed);
  return [...programFeatures(program)].filter((feature) => !allow.has(feature));
}

/** A function that can reach itself through calls (direct or mutual). */
function hasRecursion(program: Program): boolean {
  const callsIn = (nodes: Node[], out: Set<string>): Set<string> => {
    for (const node of nodes) {
      if (node.type === "call") out.add(node.name);
      else if (node.type === "repeat" || node.type === "while") callsIn(node.body, out);
      else if (node.type === "if") {
        callsIn(node.body, out);
        callsIn(node.elseBody, out);
      }
    }
    return out;
  };
  const graph = new Map(
    Object.entries(program.functions).map(([name, body]) => [name, callsIn(body, new Set())]),
  );
  const reaches = (from: string, target: string, seen: Set<string>): boolean => {
    for (const next of graph.get(from) ?? []) {
      if (next === target) return true;
      if (!seen.has(next)) {
        seen.add(next);
        if (reaches(next, target, seen)) return true;
      }
    }
    return false;
  };
  return [...graph.keys()].some((name) => reaches(name, name, new Set()));
}
