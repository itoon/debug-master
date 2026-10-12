import type { Direction, Node } from "../../../types/debug-game";
import { DIRECTIONS, perpendicular } from "../ast";
import { byLevel, type Template } from "./types";

// Sequence: read the moves top to bottom, one key per line.

export const seqLine: Template = {
  id: "seq-line",
  concept: "sequence",
  label: "Straight line",
  objective: "อ่านคำสั่งทีละบรรทัด แล้วกดลูกศรตามทิศเดียวกัน",
  build: (rng, difficulty, b) => {
    const count = rng.int(...byLevel<[number, number]>(difficulty, [[2, 3], [3, 4], [4, 6]]));
    return {
      program: { main: b.moves(rng.pick(DIRECTIONS), count), functions: {} },
      layout: { kind: "fit", padding: 1 },
    };
  },
};

export const seqTurn: Template = {
  id: "seq-turn",
  concept: "sequence",
  label: "One turn",
  objective: "สังเกตจุดที่โค้ดเปลี่ยนทิศ",
  build: (rng, difficulty, b) => {
    const first = rng.pick(DIRECTIONS);
    const second = rng.pick(perpendicular(first));
    const [min, max] = byLevel<[number, number]>(difficulty, [[1, 2], [2, 3], [2, 4]]);
    return {
      program: {
        main: [...b.moves(first, rng.int(min, max)), ...b.moves(second, rng.int(min, max))],
        functions: {},
      },
      layout: { kind: "fit", padding: 1 },
    };
  },
};

export const seqWalk: Template = {
  id: "seq-walk",
  concept: "sequence",
  label: "Winding path",
  objective: "ไล่คำสั่งยาวๆ ทีละบรรทัดโดยไม่ข้าม",
  build: (rng, difficulty, b) => {
    const segments = byLevel(difficulty, [3, 3, 4]);
    const main: Node[] = [];
    let direction: Direction = rng.pick(DIRECTIONS);
    for (let i = 0; i < segments; i += 1) {
      main.push(...b.moves(direction, rng.int(1, byLevel(difficulty, [2, 2, 3]))));
      direction = rng.pick(perpendicular(direction));
    }
    return {
      program: { main, functions: {} },
      layout: { kind: "fit", padding: 1 },
      rules: { maxLines: 10 },
    };
  },
};

export const sequenceTemplates = [seqLine, seqTurn, seqWalk];
