import type { Direction, Node } from "../../../types/debug-game";
import { DIRECTIONS, perpendicular } from "../ast";
import { byLevel, type Template } from "./types";

// Loop: repeat(n) runs its body n times; the reader counts instead of
// reading every move.

export const repeatLine: Template = {
  id: "repeat-line",
  concept: "loop",
  label: "Repeat one move",
  objective: "repeat(n) คือทำคำสั่งข้างในซ้ำ n ครั้ง",
  build: (rng, difficulty, b) => {
    const direction = rng.pick(DIRECTIONS);
    const turn = rng.pick(perpendicular(direction));
    const count = rng.int(...byLevel<[number, number]>(difficulty, [[3, 4], [3, 5], [4, 6]]));
    const main: Node[] = [b.repeat(count, [b.move(direction)])];
    if (difficulty !== "easy") main.push(b.move(turn));
    if (difficulty === "hard") main.unshift(b.move(rng.pick(perpendicular(direction))));
    return {
      program: { main, functions: {} },
      layout: { kind: "fit", padding: 1 },
      rules: { loopMustMatter: true },
    };
  },
};

export const repeatPattern: Template = {
  id: "repeat-pattern",
  concept: "loop",
  label: "Repeat a pattern",
  objective: "ข้างใน repeat มีหลายคำสั่ง ต้องทำครบทุกบรรทัดก่อนเริ่มรอบใหม่",
  build: (rng, difficulty, b) => {
    const forward = rng.pick(DIRECTIONS);
    const side = rng.pick(perpendicular(forward));
    const body =
      difficulty === "hard" && rng.chance(0.5)
        ? [b.move(forward), b.move(forward), b.move(side)]
        : [b.move(forward), b.move(side)];
    const count = rng.int(...byLevel<[number, number]>(difficulty, [[2, 3], [3, 4], [3, 4]]));
    return {
      program: { main: [b.repeat(count, body)], functions: {} },
      layout: { kind: "fit", padding: 1 },
      rules: { loopMustMatter: true },
    };
  },
};

export const repeatWrap: Template = {
  id: "repeat-wrap",
  concept: "loop",
  label: "Wrap around the edge",
  objective: "เดินตกขอบกระดานแล้วไปโผล่อีกฝั่ง นับต่อให้ถูก",
  build: (rng, difficulty, b) => {
    const horizontal = rng.chance(0.5);
    const direction: Direction = horizontal
      ? rng.pick<Direction>(["left", "right"])
      : rng.pick<Direction>(["up", "down"]);
    const length = rng.int(...byLevel<[number, number]>(difficulty, [[4, 4], [4, 5], [5, 6]]));
    const across = byLevel(difficulty, [1, rng.int(1, 2), rng.int(2, 3)]);
    // Steps to the edge, then enough to come back in on the far side
    // without reaching the start again (no revisit): toEdge < count < length.
    const toEdge = rng.int(0, length - 2);
    const startAlong =
      direction === "right" || direction === "down" ? length - 1 - toEdge : toEdge;
    const count = rng.int(toEdge + 1, length - 1);
    const startAcross = rng.int(0, across - 1);
    const rows = horizontal ? across : length;
    const cols = horizontal ? length : across;
    const start: [number, number] = horizontal
      ? [startAcross, startAlong]
      : [startAlong, startAcross];
    return {
      program: { main: [b.repeat(count, [b.move(direction)])], functions: {} },
      layout: { kind: "fixed", rows, cols, start },
      rules: { requireWrap: true, minMoves: 2 },
    };
  },
};

export const repeatNested: Template = {
  id: "repeat-nested",
  concept: "loop",
  label: "Repeat inside repeat",
  objective: "repeat ซ้อนกัน: รอบในทำจนครบก่อน แล้วค่อยนับรอบนอก",
  build: (rng, difficulty, b) => {
    const forward = rng.pick(DIRECTIONS);
    const side = rng.pick(perpendicular(forward));
    const inner = rng.int(2, byLevel(difficulty, [2, 3, 3]));
    const outer = rng.int(2, byLevel(difficulty, [2, 3, 3]));
    const body: Node[] = [b.repeat(inner, [b.move(forward)]), b.move(side)];
    if (difficulty === "hard" && rng.chance(0.5)) body.push(b.move(side));
    return {
      program: { main: [b.repeat(outer, body)], functions: {} },
      layout: { kind: "fit", padding: 1 },
      rules: { loopMustMatter: true },
    };
  },
};

export const repeatMix: Template = {
  id: "repeat-mix",
  concept: "loop",
  label: "Moves and loops together",
  objective: "อ่านคำสั่งปกติสลับกับ repeat ให้ครบตามลำดับ",
  build: (rng, difficulty, b) => {
    const first = rng.pick(DIRECTIONS);
    const second = rng.pick(perpendicular(first));
    const third = rng.pick(perpendicular(second));
    const count = () => rng.int(2, byLevel(difficulty, [3, 3, 4]));
    return {
      program: {
        main: [
          b.repeat(count(), [b.move(first)]),
          b.move(second),
          b.repeat(count(), [b.move(third)]),
        ],
        functions: {},
      },
      layout: { kind: "fit", padding: 1 },
      rules: { loopMustMatter: true },
    };
  },
};

export const loopTemplates = [repeatLine, repeatPattern, repeatWrap, repeatNested, repeatMix];
