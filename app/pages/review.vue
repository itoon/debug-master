<template>
  <DocShell eyebrow="สำหรับผู้ตรวจโจทย์" title="คลังโจทย์ Debug Runner">
    <template #subtitle>
      ข้อมูลชุดเดียวกับในเกม · แก้ที่ <code>app/data/</code>
      แล้วทั้งเกมและหน้านี้เปลี่ยนตาม
    </template>

    <template #toolbar>
      <div class="review-toolbar">
        <div class="segmented" role="tablist" aria-label="เลือกชุดโจทย์">
          <button
            v-for="(set, index) in levelSets"
            :key="set.id"
            type="button"
            role="tab"
            :aria-selected="selectedSetId === set.id"
            :class="{ on: selectedSetId === set.id }"
            @click="selectedSetId = set.id"
          >
            Set {{ setLetter(index) }} <small>{{ set.title }}</small>
          </button>
          <button
            v-for="set in challengeSets"
            :key="set.id"
            type="button"
            role="tab"
            :aria-selected="selectedSetId === set.id"
            :class="{ on: selectedSetId === set.id }"
            @click="selectedSetId = set.id"
          >
            {{ set.title }} <small>ท้าทายเวลา · {{ set.levels.length }} ด่าน</small>
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="selectedSetId === DEAD_PREVIEW_ID"
            :class="{ on: selectedSetId === DEAD_PREVIEW_ID }"
            @click="selectedSetId = DEAD_PREVIEW_ID"
          >
            Dead Mode <small>ตัวอย่างด่านสุ่ม</small>
          </button>
        </div>

        <div v-if="selectedSetId === DEAD_PREVIEW_ID" class="review-seed">
          <label>
            <span>seed</span>
            <input v-model.number="deadSeed" type="number" min="0" />
          </label>
          <button type="button" @click="deadSeed = newRunSeed()">สุ่ม seed ใหม่</button>
        </div>

        <div class="segmented" role="tablist" aria-label="รูปแบบโค้ด">
          <button
            v-for="option in CODE_LANGUAGE_OPTIONS"
            :key="option.id"
            type="button"
            role="tab"
            :aria-selected="language === option.id"
            :class="{ on: language === option.id }"
            @click="language = option.id"
          >
            {{ option.title }}
          </button>
        </div>

        <label class="review-filter">
          <span>Concept</span>
          <select v-model="conceptFilter">
            <option value="">ทั้งหมด ({{ activeSet.levels.length }})</option>
            <option v-for="concept in concepts" :key="concept" :value="concept">
              {{ concept }}
            </option>
          </select>
        </label>

        <label class="review-check">
          <input v-model="showSolution" type="checkbox" />
          <span>แสดงเฉลย</span>
        </label>
        <label class="review-check">
          <input v-model="issuesOnly" type="checkbox" />
          <span>เฉพาะข้อที่มีปัญหา ({{ issueCount }})</span>
        </label>
      </div>

      <nav class="review-jump" aria-label="ไปที่ด่าน">
        <a
          v-for="item in reviewed"
          :key="item.level.id"
          :href="`#level-${item.level.id}`"
          :class="{ warn: item.issues.length }"
          >{{ pad(item.level.id) }}</a
        >
      </nav>
    </template>

    <div class="review-list">
      <article
        v-for="item in visible"
        :id="`level-${item.level.id}`"
        :key="`${selectedSetId}-${item.level.id}`"
        class="review-card"
        :class="{ warn: item.issues.length }"
      >
        <header class="review-card-head">
          <h2>ด่าน {{ pad(item.level.id) }}</h2>
          <span class="pill pill-blue">{{ item.level.concept }}</span>
          <span v-if="item.level.source" class="pill pill-yellow">{{ item.level.source }}</span>
          <span class="pill">{{ item.level.rows }}×{{ item.level.cols }}</span>
          <span class="pill">เริ่ม ({{ item.level.start[0] }}, {{ item.level.start[1] }})</span>
          <span class="pill">{{ item.solution.moves.length }} ก้าว</span>
          <span v-if="item.solution.wraps" class="pill pill-yellow"
            >ทะลุขอบ {{ item.solution.wraps }} ครั้ง</span
          >
          <span v-if="generatorInfo(item.level)" class="pill pill-yellow">{{
            generatorInfo(item.level)
          }}</span>
          <NuxtLink
            v-if="selectedSetId !== DEAD_PREVIEW_ID"
            class="review-play"
            :to="{ path: '/', query: { set: selectedSetId, level: item.level.id } }"
            >เล่นด่านนี้ →</NuxtLink
          >
        </header>

        <div class="review-card-body">
          <div class="review-board">
            <LevelBoard :level="item.level" :space="BOARD_SPACE">
              <template v-if="showSolution">
                <span
                  v-for="([row, col], step) in item.pathCells"
                  :key="`p-${row}-${col}`"
                  class="actor review-dot"
                  :style="{ '--x': col, '--y': row }"
                  aria-hidden="true"
                  ><i>{{ step + 1 }}</i></span
                >
                <span
                  class="actor review-flag"
                  :style="{ '--x': item.solution.end[1], '--y': item.solution.end[0] }"
                  aria-hidden="true"
                  >🏁</span
                >
              </template>
              <span
                class="actor review-player"
                :style="{ '--x': item.level.start[1], '--y': item.level.start[0] }"
                aria-hidden="true"
                ><img
                  class="player-sprite"
                  :src="PLAYER_SPRITES[START_FACING]"
                  alt=""
                  draggable="false"
              /></span>
            </LevelBoard>
          </div>

          <LevelCode
            class="review-code"
            :level="item.level"
            :language="language"
            :title="`${item.level.title} · ${languageTitle}`"
            line-numbers
          />
        </div>

        <footer class="review-card-foot">
          <p v-if="item.level.learningObjective" class="review-objective">
            <strong>เป้าหมาย:</strong> {{ item.level.learningObjective }}
          </p>

          <div v-if="showSolution" class="review-solution">
            <strong>เฉลยลำดับปุ่ม</strong>
            <span v-if="!item.solution.moves.length" class="muted">ไม่มีการเดิน</span>
            <span
              v-for="(run, index) in item.runs.slice(0, MAX_RUNS)"
              :key="index"
              class="key-run"
              :aria-label="`${run.direction} ${run.count} ครั้ง`"
              ><kbd>{{ ARROWS[run.direction] }}</kbd
              ><small v-if="run.count > 1">×{{ run.count }}</small></span
            >
            <span v-if="item.runs.length > MAX_RUNS" class="muted"
              >… (อีก {{ item.runs.length - MAX_RUNS }} ชุด)</span
            >
            <span class="muted">
              · จบที่ ({{ item.solution.end[0] }}, {{ item.solution.end[1] }})
              บนช่อง {{ tileKindLabel(tileAt(item.level, item.solution.end)) }}
            </span>
          </div>

          <ul v-if="item.issues.length" class="review-issues">
            <li v-for="issue in item.issues" :key="issue">⚠ {{ issue }}</li>
          </ul>
        </footer>
      </article>

      <p v-if="!visible.length" class="review-empty">ไม่มีโจทย์ตามตัวกรองนี้</p>
    </div>
  </DocShell>
</template>

<script setup lang="ts">
// Review page: every level of a set on one page, for people checking the
// problems. It reads the same data (data/level-sets.ts), draws with the same
// components (LevelBoard / LevelCode) and solves with the same interpreter
// (utils/programRunner.ts) as the game, so an edit in one place shows up here.
import { levelSets } from "../data/level-sets";
import { ceilingForSet, challengeSets } from "../data/challenge-groups";
import { featuresBeyond, FEATURE_LABELS } from "../utils/conceptFeatures";
import type { RawLevel } from "../data/levels";
import {
  tileKindLabel,
  type BoardSpace,
} from "../composables/useBoardPresentation";
import { useProgramParser } from "../composables/useProgramParser";
import type { Direction } from "../types/debug-game";
import { CODE_LANGUAGE_OPTIONS, type CodeLanguage } from "../utils/codeLanguage";
import { solveLevel, type LevelSolution } from "../utils/programRunner";
import { PLAYER_SPRITES, START_FACING } from "../utils/playerSprites";
import {
  generateRun,
  newRunSeed,
  type GeneratedLevel,
} from "../utils/levelGen";

useHead({ title: "คลังโจทย์ · Debug Runner" });

const BOARD_SPACE: BoardSpace = { width: 340, height: 320 };
// A runaway program (Loop error) can make hundreds of moves; show the start.
const MAX_RUNS = 40;
const ARROWS: Record<Direction, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

const selectedSetId = ref(levelSets[0]?.id ?? "set-01");
const language = ref<CodeLanguage>("python");
const conceptFilter = ref("");
const showSolution = ref(true);
const issuesOnly = ref(false);

// Dead Mode preview: the first levels of a generated run, by seed, so the
// team can check the generator (utils/levelGen) with the same tools.
const DEAD_PREVIEW_ID = "dead-preview";
const DEAD_PREVIEW_COUNT = 30;
const deadSeed = ref(42);
const deadPreview = computed(() => ({
  id: DEAD_PREVIEW_ID,
  title: `Dead Mode · seed ${deadSeed.value}`,
  description: "",
  levels: generateRun(Math.max(0, deadSeed.value || 0), DEAD_PREVIEW_COUNT),
}));
const activeSet = computed(() =>
  selectedSetId.value === DEAD_PREVIEW_ID
    ? deadPreview.value
    : ([...levelSets, ...challengeSets].find((set) => set.id === selectedSetId.value) ??
      levelSets[0]),
);
const languageTitle = computed(
  () => CODE_LANGUAGE_OPTIONS.find((o) => o.id === language.value)?.title ?? "",
);
const concepts = computed(() => [
  ...new Set(activeSet.value.levels.map((level) => level.concept)),
]);

type Reviewed = {
  level: RawLevel;
  solution: LevelSolution;
  runs: { direction: Direction; count: number }[];
  pathCells: [number, number][];
  issues: string[];
};

const reviewed = computed<Reviewed[]>(() =>
  activeSet.value.levels.map((level) => {
    const { parseProgram } = useProgramParser(() => level.id);
    const program = parseProgram(level.code);
    const solution = solveLevel(level, program);
    // Challenge groups must not use concepts beyond their tier.
    const ceiling = ceilingForSet(selectedSetId.value);
    const beyond = ceiling ? featuresBeyond(program, ceiling) : [];
    return {
      level,
      solution,
      runs: compressRuns(solution.moves),
      pathCells: uniqueCells(solution.path.slice(1)),
      issues: [
        ...findIssues(level, solution),
        ...(beyond.length
          ? [`ใช้ ${beyond.map((f) => FEATURE_LABELS[f]).join(", ")} เกินคอนเซปต์ของกลุ่มนี้`]
          : []),
      ],
    };
  }),
);
const issueCount = computed(
  () => reviewed.value.filter((item) => item.issues.length).length,
);
const visible = computed(() =>
  reviewed.value.filter(
    (item) =>
      (!conceptFilter.value || item.level.concept === conceptFilter.value) &&
      (!issuesOnly.value || item.issues.length),
  ),
);

watch(selectedSetId, () => {
  conceptFilter.value = "";
});

function setLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

function pad(id: number): string {
  return id.toString().padStart(2, "0");
}

/** Template + difficulty for generated levels (empty for hand-made ones). */
function generatorInfo(level: RawLevel): string {
  const info = (level as Partial<GeneratedLevel>).generator;
  if (!info) return "";
  return info.fallback ? "fallback" : `${info.template} · ${info.difficulty}`;
}

function tileAt(level: RawLevel, [row, col]: [number, number]): string {
  return level.map[row]?.[col] ?? "n";
}

function compressRuns(moves: Direction[]) {
  const runs: { direction: Direction; count: number }[] = [];
  for (const direction of moves) {
    const last = runs[runs.length - 1];
    if (last && last.direction === direction) last.count += 1;
    else runs.push({ direction, count: 1 });
  }
  return runs;
}

/** Visit order per cell (first visit wins), for the numbered path dots. */
function uniqueCells(path: [number, number][]): [number, number][] {
  const seen = new Set<string>();
  return path.filter(([row, col]) => {
    const key = `${row},${col}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Automatic checks a reviewer would otherwise do by hand. */
function findIssues(level: RawLevel, solution: LevelSolution): string[] {
  const issues: string[] = [];
  if (level.map.length !== level.rows) {
    issues.push(`map มี ${level.map.length} แถว แต่ rows = ${level.rows}`);
  }
  level.map.forEach((row, index) => {
    if (row.length !== level.cols) {
      issues.push(`แถว ${index} มี ${row.length} ช่อง แต่ cols = ${level.cols}`);
    }
  });
  const [startRow, startCol] = level.start;
  if (!level.map[startRow]?.[startCol]) {
    issues.push(`จุดเริ่ม (${startRow}, ${startCol}) อยู่นอกกระดาน`);
  }
  if (solution.error) {
    issues.push(`โปรแกรมรันไม่จบ: ${solution.error}`);
  } else if (!solution.moves.length) {
    issues.push("โปรแกรมไม่มีคำสั่งเดินเลย");
  }
  return issues;
}
</script>

<style scoped>
.review-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.segmented {
  display: inline-flex;
  padding: 3px;
  border-radius: var(--cv-radius);
  background: rgba(255, 255, 255, 0.1);
}

.segmented button {
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--cv-on-dark-muted);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.segmented button small {
  margin-left: 4px;
  font-weight: 400;
  opacity: 0.8;
}

.segmented button.on {
  background: #fff;
  color: var(--cv-blue);
}

.review-seed {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 700;
}

.review-seed label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.review-seed input {
  width: 120px;
  min-height: 34px;
  border: 0;
  border-radius: 9px;
  padding: 0 8px;
  background: #fff;
  color: var(--cv-ink);
  font: inherit;
}

.review-seed button {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--cv-on-dark);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.review-filter,
.review-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 700;
}

.review-filter select {
  min-height: 34px;
  max-width: 260px;
  border: 0;
  border-radius: 9px;
  padding: 0 8px;
  background: #fff;
  color: var(--cv-ink);
  font: inherit;
  font-weight: 400;
}

.review-check input {
  accent-color: var(--cv-yellow);
}

.review-jump {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.review-jump a {
  min-width: 32px;
  padding: 3px 0;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--cv-on-dark);
  font-size: 0.72rem;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
}

.review-jump a:hover {
  background: rgba(255, 255, 255, 0.22);
}

.review-jump a.warn {
  background: var(--cv-red);
}

.review-list {
  display: grid;
  gap: 18px;
}

.review-card {
  scroll-margin-top: 220px;
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--cv-border);
  border-radius: var(--cv-radius-xl);
  background: #fff;
  box-shadow: var(--cv-shadow-md);
  break-inside: avoid;
}

.review-card.warn {
  border-color: var(--cv-red);
  box-shadow: 0 0 0 2px rgba(255, 107, 107, 0.35);
}

.review-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.review-card-head h2 {
  margin: 0 6px 0 0;
  color: var(--cv-heading);
  font-size: 1.3rem;
  font-weight: 800;
}

.pill {
  padding: 3px 10px;
  border-radius: 9999px;
  background: #f1f5f9;
  color: var(--cv-text);
  font-size: 0.78rem;
  font-weight: 700;
}

.pill-blue {
  background: rgba(31, 117, 255, 0.1);
  color: var(--cv-blue);
}

.pill-yellow {
  background: rgba(253, 202, 63, 0.3);
  color: #7a5204;
}

.review-play {
  margin-left: auto;
  color: var(--cv-blue);
  font-size: 0.85rem;
  font-weight: 700;
  text-decoration: none;
}

.review-card-body {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.review-board {
  display: grid;
  place-items: center;
  min-height: 200px;
}

.review-code {
  width: 100%;
  min-height: 200px;
  background: var(--cv-navy-900);
}

.review-player {
  z-index: 3;
}

.review-dot {
  z-index: 2;
}

.review-dot i {
  display: grid;
  place-items: center;
  min-width: 34%;
  height: 34%;
  padding: 0 3px;
  border-radius: 9999px;
  background: rgba(6, 26, 56, 0.78);
  color: #fff;
  font-size: max(10px, calc(var(--cell-size) * 0.2));
  font-style: normal;
  font-weight: 800;
}

.review-flag {
  z-index: 4;
  place-items: start end;
  font-size: max(14px, calc(var(--cell-size) * 0.34));
  line-height: 1;
}

.review-card-foot {
  display: grid;
  gap: 8px;
}

.review-objective {
  margin: 0;
  color: var(--cv-text);
  font-size: 0.9rem;
}

.review-solution {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
}

.key-run {
  display: inline-flex;
  align-items: baseline;
  gap: 1px;
}

.key-run kbd {
  display: inline-grid;
  place-items: center;
  min-width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--cv-blue);
  color: #fff;
  font-family: var(--cv-font);
  font-size: 1rem;
  font-weight: 800;
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.2);
}

.key-run small {
  color: var(--cv-blue);
  font-weight: 800;
}

.muted {
  color: var(--cv-muted);
}

.review-issues {
  margin: 0;
  padding: 10px 14px;
  list-style: none;
  border-radius: var(--cv-radius);
  background: rgba(255, 107, 107, 0.12);
  color: #b42318;
  font-weight: 700;
}

.review-empty {
  padding: 40px 0;
  color: var(--cv-muted);
  text-align: center;
}

@media (max-width: 760px) {
  .review-card-body {
    grid-template-columns: 1fr;
  }
}

@media print {
  .review-toolbar,
  .review-jump,
  .review-play {
    display: none;
  }
}
</style>
