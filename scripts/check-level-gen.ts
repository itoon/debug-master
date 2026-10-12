// Bulk check for the Dead Mode level generator (app/utils/levelGen).
// Builds many runs and re-checks every level with the game's parser and
// interpreter. Exits non-zero on any failure.
//
//   pnpm dlx jiti scripts/check-level-gen.ts [runs=300] [levels=25]

import { useProgramParser } from "../app/composables/useProgramParser";
import { generateLevel, LADDER } from "../app/utils/levelGen";
import { solveLevel } from "../app/utils/programRunner";

const runs = Number(process.argv[2] ?? 300);
const levelsPerRun = Number(process.argv[3] ?? 25);

const failures: string[] = [];
const byTemplate = new Map<string, { count: number; moves: number[]; attempts: number[] }>();
let fallbacks = 0;
let total = 0;
let maxRows = 0;
let maxCols = 0;

for (let run = 0; run < runs; run += 1) {
  const seed = (run * 2654435761) >>> 0;
  for (let index = 0; index < levelsPerRun; index += 1) {
    const level = generateLevel(seed, index);
    const again = generateLevel(seed, index);
    total += 1;
    const where = `seed ${seed} level ${index + 1} (${level.generator.template})`;

    if (JSON.stringify(level) !== JSON.stringify(again)) {
      failures.push(`${where}: not deterministic`);
    }
    if (level.generator.fallback) fallbacks += 1;

    const program = useProgramParser(() => level.id).parseProgram(level.code);
    const solution = solveLevel(level, program);
    if (solution.error) failures.push(`${where}: ${solution.error}\n${level.code}`);
    if (solution.moves.length < 2) failures.push(`${where}: only ${solution.moves.length} moves`);
    if (level.map.length !== level.rows || level.map.some((row) => row.length !== level.cols)) {
      failures.push(`${where}: map size does not match rows/cols`);
    }
    if (index < LADDER.length && !level.generator.fallback) {
      const expected = LADDER[index].template.id;
      if (level.generator.template !== expected) {
        failures.push(`${where}: expected ladder template ${expected}`);
      }
    }

    maxRows = Math.max(maxRows, level.rows);
    maxCols = Math.max(maxCols, level.cols);
    const stats = byTemplate.get(level.generator.template) ?? { count: 0, moves: [], attempts: [] };
    stats.count += 1;
    stats.moves.push(solution.moves.length);
    stats.attempts.push(level.generator.attempts);
    byTemplate.set(level.generator.template, stats);
  }
}

const range = (values: number[]) => `${Math.min(...values)}-${Math.max(...values)}`;
const avg = (values: number[]) =>
  (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);

console.log(`${total} levels from ${runs} runs × ${levelsPerRun}`);
console.log(`fallbacks: ${fallbacks} (${((fallbacks / total) * 100).toFixed(2)}%)`);
console.log(`largest board: ${maxRows} rows, ${maxCols} cols`);
console.log("template          count  moves  avg-attempts");
for (const [template, stats] of [...byTemplate].sort()) {
  console.log(
    `${template.padEnd(16)} ${String(stats.count).padStart(6)}  ${range(stats.moves).padStart(5)}  ${avg(stats.attempts).padStart(5)}`,
  );
}
if (failures.length) {
  console.log(`\n${failures.length} FAILURES (first 10):`);
  for (const failure of failures.slice(0, 10)) console.log(" -", failure);
  process.exit(1);
}
console.log("\nOK: every level is deterministic and playable.");
