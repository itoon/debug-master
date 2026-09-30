import set02Pack from "./set-02.json";
import { rawLevels, type RawLevel } from "./levels";

export type LevelSet = {
  id: string;
  title: string;
  description: string;
  levels: RawLevel[];
};

const set02Levels: RawLevel[] = set02Pack.levels.map((level) => ({
  id: level.id,
  title: level.title,
  rows: level.rows,
  cols: level.cols,
  map: level.map,
  start: level.start as [number, number],
  code: level.code,
  concept: level.concept,
  learningObjective: level.learningObjective,
}));

export const levelSets: LevelSet[] = [
  {
    id: "set-01",
    title: "Set 01 - Original",
    description: "ภาพแกะจากต้นฉบับ 60 ด่าน ไล่จาก sequence ไป recursion",
    levels: rawLevels,
  },
  {
    id: "set-02",
    title: "Set 02 - Logic Trails",
    description: "ชุดใหม่ 60 ด่าน เน้น branch, while, function และ final challenge",
    levels: set02Levels,
  },
];
