// Checks the time-challenge groups (app/data/challenge-groups.ts):
// every level solves with the game's interpreter, stays within its group's
// feature ceiling, appears only once, and every new lesson is used exactly
// once in the group of its own tier. Exits non-zero on any failure.
//
//   bun scripts/check-challenge-groups.ts      (or: pnpm dlx jiti ...)

import challengePack from "../app/data/challenge-levels.json";
import { CHALLENGE_GROUPS, challengeSets } from "../app/data/challenge-groups";
import { useProgramParser } from "../app/composables/useProgramParser";
import { featuresBeyond, programFeatures } from "../app/utils/conceptFeatures";
import { solveLevel } from "../app/utils/programRunner";

const failures: string[] = [];
const newUses = new Map<number, string[]>();

CHALLENGE_GROUPS.forEach((group, index) => {
  const set = challengeSets[index];
  const seen = new Set<string>();
  for (const ref of group.levels) {
    const key = `${ref.from}:${ref.id}`;
    if (seen.has(key)) failures.push(`${group.title}: ${key} listed twice`);
    seen.add(key);
    if (ref.from === "new") newUses.set(ref.id, [...(newUses.get(ref.id) ?? []), group.tier]);
  }

  const featureCount = new Map<string, number>();
  let moves = 0;
  for (const level of set.levels) {
    const where = `${group.title} ${level.id} (${level.source})`;
    const program = useProgramParser(() => level.id).parseProgram(level.code);
    const solution = solveLevel(level, program);
    if (solution.error) failures.push(`${where}: ${solution.error}`);
    if (solution.moves.length < 2) failures.push(`${where}: only ${solution.moves.length} moves`);
    const beyond = featuresBeyond(program, group.ceiling);
    if (beyond.length) failures.push(`${where}: uses ${beyond.join(", ")}`);
    for (const feature of programFeatures(program)) {
      featureCount.set(feature, (featureCount.get(feature) ?? 0) + 1);
    }
    moves += solution.moves.length;
  }

  const fromSet01 = group.levels.filter((ref) => ref.from === "set-01").length;
  console.log(
    `${group.title.padEnd(12)} ${set.levels.length} levels ` +
      `(${fromSet01} Set 01 + ${set.levels.length - fromSet01} new) · ` +
      `avg ${(moves / set.levels.length).toFixed(1)} moves · ` +
      [...featureCount].map(([feature, count]) => `${feature} ${count}`).join(", "),
  );
});

for (const level of challengePack.levels) {
  const uses = newUses.get(level.id) ?? [];
  if (uses.length !== 1) failures.push(`new lesson ${level.id} is used ${uses.length} times`);
  else if (uses[0] !== level.group) {
    failures.push(`new lesson ${level.id} (${level.group}) is in the ${uses[0]} group`);
  }
}

if (failures.length) {
  console.error(`\nFAILED (${failures.length}):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nOK");
