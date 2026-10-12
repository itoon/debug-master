// Builds the new challenge lessons (specs.ts) into app/data/challenge-levels.json.
//
//   bun scripts/challenge-levels/build.ts            check + print every lesson
//   bun scripts/challenge-levels/build.ts --write    also write the JSON
//   bun scripts/challenge-levels/build.ts 210 230    print only ids 210..230
//
// Same output every run (decoys use a seed from the lesson id).

import { writeFileSync } from "node:fs";
import { useProgramParser } from "../../app/composables/useProgramParser";
import { featuresBeyond, TIER_CEILINGS } from "../../app/utils/conceptFeatures";
import { solveLevel } from "../../app/utils/programRunner";
import { paintLesson } from "./paint";
import { LESSON_SPECS } from "./specs";

const MAX_MOVES = 40;
const MAX_SIDE = 12;
const ARROW: Record<string, string> = { up: "U", down: "D", left: "L", right: "R" };

const args = process.argv.slice(2);
const write = args.includes("--write");
const [from, to] = args.filter((a) => /^\d+$/.test(a)).map(Number);

const problems: string[] = [];
const levels = [];
const ids = new Set<number>();

for (const spec of LESSON_SPECS) {
  const where = `lesson ${spec.id}`;
  if (ids.has(spec.id)) problems.push(`${where}: duplicate id`);
  ids.add(spec.id);

  let painted;
  try {
    painted = paintLesson(spec);
  } catch (error) {
    problems.push((error as Error).message);
    continue;
  }
  const { level, moves, unusedTiles, defaulted } = painted;
  const program = useProgramParser(() => level.id).parseProgram(level.code);
  const solution = solveLevel(level, program);

  if (solution.error) problems.push(`${where}: ${solution.error}`);
  if (solution.moves.join() !== moves.join()) {
    problems.push(`${where}: board plays differently from the painted run`);
  }
  if (moves.length < 2) problems.push(`${where}: only ${moves.length} moves`);
  if (moves.length > MAX_MOVES) problems.push(`${where}: ${moves.length} moves (max ${MAX_MOVES})`);
  if (level.rows > MAX_SIDE || level.cols > MAX_SIDE) {
    problems.push(`${where}: board ${level.rows}x${level.cols} (max ${MAX_SIDE})`);
  }
  if (unusedTiles) problems.push(`${where}: tiles never read: "${unusedTiles}"`);
  if (defaulted) problems.push(`${where}: ${defaulted} read(s) past the end of tiles`);
  const beyond = featuresBeyond(program, TIER_CEILINGS[spec.group]);
  if (beyond.length) problems.push(`${where}: uses ${beyond.join(", ")} (beyond ${spec.group})`);

  levels.push({ ...level, group: spec.group });

  if (from === undefined || (spec.id >= from && spec.id <= (to ?? from))) {
    const path = new Set(solution.path.map(([r, c]) => `${r},${c}`));
    console.log(
      `### ${spec.id} [${spec.group}] ${level.rows}x${level.cols} moves=${moves.length} wraps=${solution.wraps}`,
    );
    level.map.forEach((row, r) =>
      console.log(
        "   " +
          row
            .map((t, c) => {
              const start = r === level.start[0] && c === level.start[1];
              const mark = path.has(`${r},${c}`) ? t.toUpperCase() : t;
              return mark + (start ? "*" : " ");
            })
            .join(""),
      ),
    );
    console.log(level.code.split("\n").map((l) => "   | " + l).join("\n"));
    console.log("   = " + moves.map((m) => ARROW[m]).join(""));
  }
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}

if (write) {
  const out = new URL("../../app/data/challenge-levels.json", import.meta.url);
  const pack = {
    title: "Challenge lessons (new)",
    description:
      "บทเรียนใหม่สำหรับโหมดท้าทายเวลา แต่งตามแนวของ Set 01 ไม่เกินคอนเซปต์ของกลุ่มตัวเอง",
    source: "scripts/challenge-levels/specs.ts",
    levels,
  };
  writeFileSync(out, JSON.stringify(pack, null, 2) + "\n");
  console.log(`\nWrote ${levels.length} lessons to app/data/challenge-levels.json`);
} else {
  console.log(`\nOK: ${levels.length} lessons (run with --write to save)`);
}
