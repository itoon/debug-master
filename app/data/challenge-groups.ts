import challengePack from "./challenge-levels.json";
import type { LevelSet } from "./level-sets";
import { rawLevels, type RawLevel } from "./levels";
import { TIER_CEILINGS, type Feature, type Tier } from "../utils/conceptFeatures";

// The three level groups of the time-challenge modes (แข่ง 05:00 and
// ท้าทายเวลา). A group is an ordered list of levels: Set 01 levels plus new
// lessons from challenge-levels.json (written by scripts/challenge-levels/).
//
// To change a group, edit its `levels` list: order = play order.
//   s01(1, 20)      Set 01 levels 1..20
//   fresh(101)      new lesson 101 (ids: 1xx Beginner, 2xx Intermediate, 3xx Pro)
// Every level must stay within the group's `ceiling` (features it may use);
// /review flags any level that goes beyond it.

type LevelRef = { from: "set-01" | "new"; id: number };

const s01 = (first: number, last = first): LevelRef[] => refs("set-01", first, last);
const fresh = (first: number, last = first): LevelRef[] => refs("new", first, last);

function refs(from: LevelRef["from"], first: number, last: number): LevelRef[] {
  return Array.from({ length: last - first + 1 }, (_, index) => ({ from, id: first + index }));
}

export type ChallengeGroup = {
  tier: Tier;
  title: string;
  description: string;
  ceiling: Feature[];
  levels: LevelRef[];
};

export const CHALLENGE_GROUPS: ChallengeGroup[] = [
  {
    tier: "beginner",
    title: "Beginner",
    description: "sequence, repeat, wrap และ if (Set 01 ด่าน 1–20 + ด่านใหม่)",
    ceiling: TIER_CEILINGS.beginner,
    levels: [
      ...s01(1, 3), ...fresh(101, 104), // sequence
      ...s01(4), ...fresh(105, 107), // repeat one move
      ...fresh(111), ...s01(5, 6), // first wraps
      ...fresh(108, 110), ...fresh(112, 113), // repeat a pattern, more wraps
      ...s01(7, 8), ...fresh(114, 117), ...s01(9, 10), // nested repeat
      ...s01(11, 12), ...fresh(118, 120), // if
      ...s01(13, 16), ...fresh(121, 124), // if inside repeat
      ...s01(17, 18), ...fresh(125, 126), // if that stops firing
      ...s01(19, 20), ...fresh(127, 130), // repeat inside if, finale
    ],
  },
  {
    tier: "intermediate",
    title: "Intermediate",
    description: "if/else, elif, while และ not (Set 01 ด่าน 21–40 + ด่านใหม่)",
    ceiling: TIER_CEILINGS.intermediate,
    levels: [
      ...fresh(201, 202), ...s01(22, 23), ...fresh(203, 204), ...s01(21), // if / else
      ...fresh(205, 206), ...s01(24, 25), ...fresh(207), // elif
      ...s01(26), ...fresh(208, 209), ...s01(27), ...fresh(210), ...s01(28), ...fresh(211), // repeat + branches
      ...fresh(212), ...s01(29), ...fresh(213), ...s01(30), ...fresh(214, 215), // while
      ...fresh(216), ...s01(31, 32), ...fresh(217), ...s01(33), ...fresh(218), ...s01(34), ...fresh(219), // while + if, nested
      ...fresh(220), ...s01(35, 36), ...fresh(221), // if not
      ...s01(37), ...fresh(222), ...s01(38), ...fresh(223, 224), // if not in repeat
      ...fresh(225), ...s01(39, 40), ...fresh(226, 230), // while not, finale
    ],
  },
  {
    tier: "pro",
    title: "Pro",
    description: "control flow ซับซ้อน, def และ recursion (Set 01 ด่าน 41–60 + ด่านใหม่)",
    ceiling: TIER_CEILINGS.pro,
    levels: [
      ...s01(41, 42), ...fresh(301, 302), ...s01(43), ...fresh(303), // advanced control flow
      ...s01(44), ...fresh(304), ...s01(45), ...fresh(305), ...s01(46), ...fresh(306),
      ...fresh(307, 308), ...s01(47, 49), ...fresh(309, 310), // def
      ...s01(50), ...fresh(311, 312), ...s01(51), ...fresh(313, 314), // composing functions
      ...s01(52, 53), ...fresh(315, 316), ...s01(54), ...fresh(317, 318), // def with if / while
      ...fresh(319, 320), ...s01(55), ...fresh(321, 322), ...s01(56), // recursion
      ...fresh(323, 324), ...s01(57), ...fresh(325, 326), ...s01(58), // call stack, mutual
      ...fresh(327, 328), ...s01(59), ...fresh(329), ...s01(60), ...fresh(330), // finale
    ],
  },
];

const newLevels = challengePack.levels as (RawLevel & { group: Tier })[];

function resolve(ref: LevelRef): RawLevel {
  const level =
    ref.from === "set-01"
      ? rawLevels.find((item) => item.id === ref.id)
      : newLevels.find((item) => item.id === ref.id);
  if (!level) throw new Error(`Challenge group: no ${ref.from} level ${ref.id}`);
  return level;
}

export function challengeSetId(tier: Tier): string {
  return `challenge-${tier}`;
}

/**
 * Groups as level sets the game can play. Levels are renumbered 1..N inside
 * each group; `source` keeps where each one came from.
 */
export const challengeSets: LevelSet[] = CHALLENGE_GROUPS.map((group) => ({
  id: challengeSetId(group.tier),
  title: group.title,
  description: group.description,
  levels: group.levels.map((ref, index) => {
    const { image: _image, ...level } = resolve(ref);
    const number = index + 1;
    return {
      ...level,
      id: number,
      title: `${group.title} ${number.toString().padStart(2, "0")}`,
      source: ref.from === "set-01" ? `Set 01 · ด่าน ${ref.id}` : `ด่านใหม่ #${ref.id}`,
    };
  }),
}));

/** Feature ceiling for a set id (only challenge sets have one). */
export function ceilingForSet(setId: string): Feature[] | undefined {
  return CHALLENGE_GROUPS.find((group) => challengeSetId(group.tier) === setId)?.ceiling;
}
