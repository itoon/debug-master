<template>
  <div class="app-shell">
    <NuxtRouteAnnouncer />

    <main class="game">
      <section class="board-panel">
        <header class="game-header">
          <div>
            <p class="eyebrow">Debug Runner</p>
            <h1>LV {{ currentLevel.id.toString().padStart(2, "0") }}</h1>
          </div>
          <div class="header-tools">
            <div class="hud">
              <span>{{ playerName || "Player" }}</span>
              <span>{{ modeLabel }}</span>
              <span v-if="isTimedMode">{{ formattedTime }}</span>
              <span>Score {{ totalScore }}</span>
              <span>Combo x{{ Math.max(1, comboStreak) }}</span>
              <span>{{ completedLevels }}/{{ activeLevels.length }}</span>
            </div>
            <div class="header-menu">
              <span class="status" :class="`status-${status}`">{{
                statusLabel
              }}</span>
              <button
                type="button"
                class="primary-button small"
                :disabled="status === 'playing' || campaignStarted"
                @click="startGame"
              >
                Start
              </button>
              <button
                type="button"
                class="soft-button small"
                :disabled="!campaignStarted"
                @click="restartLevel"
              >
                Restart
              </button>
              <button
                type="button"
                class="soft-button small"
                @click="openSetup"
              >
                Menu
              </button>
            </div>
          </div>
        </header>

        <div class="objective">
          <span>{{ currentLevel.concept }}</span>
          <strong>กดลูกศรให้ตรงกับ code จนจบด่าน</strong>
        </div>

        <div class="play-cluster">
          <div class="board-wrap">
            <div
              class="board"
              :class="{ shattering: boardShattering }"
              :style="boardStyle"
              role="grid"
              :aria-label="`Level ${currentLevel.id} board`"
            >
              <div
                v-for="tile in visibleTiles"
                :key="`${tile.row}-${tile.col}`"
                class="tile"
                :class="[
                  `tile-${tile.colorName}`,
                  {
                    start:
                      tile.row === currentLevel.start[0] &&
                      tile.col === currentLevel.start[1],
                  },
                ]"
                :style="tileStyle(tile)"
                role="gridcell"
                :aria-label="`row ${tile.row}, col ${tile.col}, ${tile.colorName}`"
              >
                <span class="tile-symbol" aria-hidden="true">{{
                  tile.symbol
                }}</span>
                <span
                  v-if="player.row === tile.row && player.col === tile.col"
                  class="player"
                />
              </div>
            </div>
          </div>

          <section class="code-card">
            <div class="panel-title">
              <div>
                <p class="eyebrow">Fixed code</p>
                <h2>Read the program</h2>
              </div>
            </div>

            <pre
              class="code-box"
              :style="codeBoxStyle"
              aria-label="Current level code"
            ><code><span
              v-for="entry in codeLineEntries"
              :key="`${currentLevel.id}-${entry.index}`"
              class="code-line"
              :class="{ active: debugMode && isActiveRawLine(entry.line) }"
            ><template
              v-for="(segment, segIndex) in entry.segments"
              :key="`${entry.index}-${segIndex}`"
            ><span
              v-if="segment.kind !== 'tile'"
              class="code-token"
              :class="`code-token-${segment.kind}`"
            >{{ segment.text }}</span><template v-else><span
              v-if="segment.negate"
              class="code-negation"
              aria-hidden="true"
            >not </span><span
              class="code-tile"
              :class="`tile-${tileColorName(segment.color)}`"
              role="img"
              :aria-label="segment.negate ? `not tile ${segment.color}` : `tile ${segment.color}`"
              :title="segment.negate ? `not ${segment.color}` : segment.color"
            ><span
              v-if="colorMeta[segment.color]?.symbol"
              class="code-tile-symbol"
              aria-hidden="true"
            >{{ colorMeta[segment.color]?.symbol }}</span></span></template></template></span></code></pre>
          </section>
        </div>

        <transition name="score-pop">
          <div v-if="scorePopup" class="score-popup" role="status" aria-live="polite">
            <strong>+{{ scorePopup.points }}</strong>
            <span
              >Speed {{ scorePopup.speedMultiplier.toFixed(2) }} x Combo
              {{ scorePopup.comboMultiplier.toFixed(2) }}</span
            >
          </div>
        </transition>

        <div class="touch-controls" aria-label="Touch arrow controls">
          <button
            type="button"
            class="arrow up"
            :disabled="!canControl"
            aria-label="Move up"
            @click="controlMove('up')"
          >
            ▲
          </button>
          <button
            type="button"
            class="arrow left"
            :disabled="!canControl"
            aria-label="Move left"
            @click="controlMove('left')"
          >
            ◀
          </button>
          <button
            type="button"
            class="arrow down"
            :disabled="!canControl"
            aria-label="Move down"
            @click="controlMove('down')"
          >
            ▼
          </button>
          <button
            type="button"
            class="arrow right"
            :disabled="!canControl"
            aria-label="Move right"
            @click="controlMove('right')"
          >
            ▶
          </button>
        </div>

        <section v-if="debugMode" class="debug-card">
          <div class="metric-grid">
            <div>
              <span>Position</span
              ><strong>[{{ player.row }}, {{ player.col }}]</strong>
            </div>
            <div>
              <span>Tile</span><strong>{{ currentTile }}</strong>
            </div>
            <div>
              <span>Step</span><strong>{{ executionSteps }}</strong>
            </div>
            <div>
              <span>Input</span><strong>{{ playerInputs }}</strong>
            </div>
          </div>
          <p class="debug-note">{{ feedbackMessage }}</p>
          <button type="button" class="soft-button" @click="showNextHint">
            Hint
          </button>
          <div v-if="revealedHints.length" class="hint-list">
            <p v-for="hint in revealedHints" :key="hint">{{ hint }}</p>
          </div>
        </section>

        <div
          v-if="notificationMessage && status !== 'success'"
          class="notification"
          :class="`notification-${status}`"
          role="alert"
        >
          <strong>{{ notificationTitle }}</strong>
          <p>{{ notificationMessage }}</p>
        </div>
      </section>
    </main>

    <section
      v-if="showSetup"
      class="overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-title"
    >
      <form class="setup-card" @submit.prevent="startGame">
        <p class="eyebrow">Before start</p>
        <h2 id="setup-title">ตั้งค่าเกม</h2>

        <label class="field">
          <span>ชื่อผู้เล่น</span>
          <input
            v-model.trim="playerNameDraft"
            type="text"
            maxlength="24"
            placeholder="เช่น น้องเอ"
            required
          />
        </label>

        <fieldset class="set-grid">
          <legend>เลือกชุดข้อสอบ</legend>
          <label
            v-for="set in levelSets"
            :key="set.id"
            class="set-option"
            :class="{ selected: selectedSetId === set.id }"
          >
            <input v-model="selectedSetId" type="radio" :value="set.id" />
            <span
              ><strong>{{ set.title }}</strong
              ><small>{{ set.description }}</small></span
            >
          </label>
        </fieldset>

        <fieldset class="mode-grid">
          <legend>เลือก Mode</legend>
          <label>
            <input v-model="selectedMode" type="radio" value="campaign" />
            <span
              ><strong>ตะลุยด่าน</strong
              ><small
                >เลือกเริ่มด่านได้ เล่นต่อเนื่องจนครบ 60 ด่าน ไม่จับเวลา</small
              ></span
            >
          </label>
          <label>
            <input v-model="selectedMode" type="radio" value="timer" />
            <span
              ><strong>จับเวลา</strong
              ><small>ตั้งเวลาที่ต้องการเอง</small></span
            >
          </label>
          <label>
            <input v-model="selectedMode" type="radio" value="ranking" />
            <span
              ><strong>Ranking Mode</strong
              ><small>เวลา固定 5 นาที แล้วจัดอันดับ</small></span
            >
          </label>
        </fieldset>

        <fieldset v-if="selectedMode === 'campaign'" class="level-picker">
          <legend>เลือกด่านเริ่มต้น</legend>
          <p class="level-picker-note">
            {{ activeSet.title }} ·
            ด่าน {{ selectedLevelDraft.toString().padStart(2, "0") }} ·
            {{ campaignLevelConcept }}
          </p>
          <div class="level-grid" role="listbox" aria-label="เลือกด่าน">
            <button
              v-for="level in activeLevels"
              :key="level.id"
              type="button"
              class="level-chip"
              :class="{ selected: selectedLevelDraft === level.id }"
              role="option"
              :aria-selected="selectedLevelDraft === level.id"
              :aria-label="`ด่าน ${level.id}`"
              @click="selectedLevelDraft = level.id"
            >
              {{ level.id.toString().padStart(2, "0") }}
            </button>
          </div>
        </fieldset>

        <label
          class="field timer-field"
          :class="{ disabled: selectedMode !== 'timer' }"
        >
          <span>เวลาโหมดจับเวลา (นาที)</span>
          <input
            v-model.number="customMinutes"
            type="number"
            min="1"
            max="60"
            :disabled="selectedMode !== 'timer'"
          />
        </label>

        <label class="debug-toggle">
          <input v-model="debugModeDraft" type="checkbox" />
          <span
            ><strong>Debug Mode</strong
            ><small
              >เปิดเพื่อดู Position, Tile, Step, Input และ Hint
              ระหว่างเล่น</small
            ></span
          >
        </label>

        <div class="setup-actions">
          <button type="button" class="soft-button" @click="showRanking = true">
            ดู Ranking
          </button>
          <button type="submit" class="primary-button">Start Game</button>
        </div>
      </form>
    </section>

    <section
      v-if="showRanking"
      class="overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ranking-title"
    >
      <div class="ranking-card">
        <div class="panel-title">
          <div>
            <p class="eyebrow">LocalStorage</p>
            <h2 id="ranking-title">Ranking</h2>
          </div>
          <button
            type="button"
            class="soft-button small"
            @click="showRanking = false"
          >
            Close
          </button>
        </div>
        <ol class="ranking-list">
          <li v-for="score in rankedScores" :key="score.id">
            <strong>{{ score.name }}</strong>
            <span
              >{{ score.setTitle || "Set 01 - Original" }} ·
              {{ score.mode }} · {{ score.score }} pts ·
              {{ score.levelsCompleted }} ด่าน ·
              {{ formatDuration(score.elapsedMs) }} · combo
              {{ score.bestCombo }}</span
            >
          </li>
        </ol>
        <p v-if="!rankedScores.length" class="empty-ranking">ยังไม่มีคะแนน</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { levelSets } from "./data/level-sets";
import { useBoardPresentation, tileColorName } from "./composables/useBoardPresentation";
import { useCodePresentation } from "./composables/useCodePresentation";
import { MOVE_NAMES, useProgramParser } from "./composables/useProgramParser";
import { colorMeta, type Condition, type Direction, type Frame, type GameStatus, type Mode, type Node, type Score, type ScorePopup } from "./types/debug-game";

const STORAGE_KEY = "debug-runner-scores-v1";

const showSetup = ref(true);
const showRanking = ref(false);
const selectedMode = ref<Mode>("campaign");
const selectedSetId = ref(levelSets[0]?.id ?? "set-01");
const playerNameDraft = ref("A");
const playerName = ref("");
const customMinutes = ref(10);
const debugModeDraft = ref(false);
const debugMode = ref(false);

const selectedLevelIndex = ref(0);
const selectedLevelDraft = ref(1);
const activeSet = computed(
  () => levelSets.find((set) => set.id === selectedSetId.value) ?? levelSets[0],
);
const activeLevels = computed(() => activeSet.value.levels);
const currentLevel = computed(
  () => activeLevels.value[selectedLevelIndex.value] ?? activeLevels.value[0],
);
const { parseProgram } = useProgramParser(() => currentLevel.value.id);
const { rawCodeLines, codeLineEntries, codeBoxStyle } =
  useCodePresentation(currentLevel);
const { visibleTiles, boardStyle, tileStyle } = useBoardPresentation(currentLevel);

// Junior note:
// `player` is the only mutable board position. Everything else should derive
// from current level + player position so we have one clear source of truth.
const player = reactive({
  row: currentLevel.value.start[0],
  col: currentLevel.value.start[1],
});
const status = ref<GameStatus>("ready");
const campaignStarted = ref(false);
const notificationMessage = ref("");
const boardShattering = ref(false);
const feedbackMessage = ref("กด Start เพื่อเริ่มเกม");
const frames = ref<Frame[]>([]);
const functionsMap = ref<Record<string, Node[]>>({});
const activeNode = ref<Node | null>(null);
const expectedMove = ref<MoveNode | null>(null);
const executionSteps = ref(0);
const playerInputs = ref(0);
const totalInputs = ref(0);
const completedLevels = ref(0);
const totalScore = ref(0);
const comboStreak = ref(0);
const bestCombo = ref(0);
const revealedHintCount = ref(0);
const scores = ref<Score[]>([]);
const scorePopup = ref<ScorePopup | null>(null);
const timerRemaining = ref(0);
const startedAt = ref(0);
const levelStartedAt = ref(0);
const levelCorrectInputs = ref(0);
let timerId: ReturnType<typeof setInterval> | null = null;
let levelAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
let scorePopupTimer: ReturnType<typeof setTimeout> | null = null;

const isTimedMode = computed(
  () => selectedMode.value === "timer" || selectedMode.value === "ranking",
);
const modeLabel = computed(() => {
  if (selectedMode.value === "campaign") return "ตะลุยด่าน";
  if (selectedMode.value === "ranking") return "Ranking 5:00";
  return `${customMinutes.value} min`;
});
const statusLabel = computed(
  () =>
    ({
      ready: "Ready",
      playing: "Control",
      success: "Correct",
      failed: "Restart",
      timeup: "Time up",
      completed: "Done",
    })[status.value],
);
const notificationTitle = computed(() => {
  if (status.value === "failed") return "ผิด";
  if (status.value === "timeup") return "หมดเวลา";
  if (status.value === "success") return "ถูกต้อง";
  return "แจ้งเตือน";
});
const canControl = computed(
  () => status.value === "playing" && Boolean(expectedMove.value),
);
const currentTile = computed(
  () => currentLevel.value.map[player.row]?.[player.col] ?? "n",
);
const campaignLevelConcept = computed(() => {
  const level =
    activeLevels.value[
      Math.max(
        0,
        Math.min(activeLevels.value.length - 1, selectedLevelDraft.value - 1),
      )
    ];
  return level?.concept ?? "";
});
const formattedTime = computed(() => formatClock(timerRemaining.value));
const revealedHints = computed(() =>
  [
    `Concept: ${currentLevel.value.concept}`,
    currentLevel.value.learningObjective ||
      "อ่าน code จากบนลงล่าง แล้วกดลูกศรตามคำสั่งที่โปรแกรมต้องการ",
    expectedMove.value
      ? `คำสั่งถัดไปคือ ${expectedMove.value.direction}()`
      : "ให้ดูว่าเงื่อนไขหรือ loop จะพาไปคำสั่ง move ใดต่อ",
  ].slice(0, revealedHintCount.value),
);
const rankedScores = computed(() =>
  [...scores.value]
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.levelsCompleted - a.levelsCompleted ||
        a.elapsedMs - b.elapsedMs ||
        a.inputs - b.inputs,
    )
    .slice(0, 12),
);

function startGame(): void {
  // Copy setup modal values into live game state once, right before a run.
  playerName.value = playerNameDraft.value || "Player";
  debugMode.value = debugModeDraft.value;
  showSetup.value = false;
  showRanking.value = false;
  if (selectedMode.value === "campaign") {
    const levelIndex = Math.max(
      0,
      Math.min(activeLevels.value.length - 1, selectedLevelDraft.value - 1),
    );
    selectedLevelIndex.value = levelIndex;
  } else {
    selectedLevelIndex.value = 0;
  }
  completedLevels.value = 0;
  totalInputs.value = 0;
  totalScore.value = 0;
  comboStreak.value = 0;
  bestCombo.value = 0;
  scorePopup.value = null;
  campaignStarted.value = true;
  startedAt.value = Date.now();
  beginTimer();
  beginLevel();
}

function openSetup(): void {
  stopTimer();
  clearLevelAdvanceTimer();
  clearScorePopupTimer();
  selectedLevelDraft.value = currentLevel.value.id;
  selectedSetId.value = activeSet.value.id;
  showSetup.value = true;
  campaignStarted.value = false;
  status.value = "ready";
}

function beginTimer(): void {
  stopTimer();
  if (!isTimedMode.value) {
    timerRemaining.value = 0;
    return;
  }
  timerRemaining.value =
    selectedMode.value === "ranking"
      ? 300
      : Math.max(1, customMinutes.value) * 60;
  timerId = setInterval(() => {
    timerRemaining.value -= 1;
    if (timerRemaining.value <= 0) {
      timeUp();
    }
  }, 1000);
}

function stopTimer(): void {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function clearLevelAdvanceTimer(): void {
  if (levelAdvanceTimer) {
    clearTimeout(levelAdvanceTimer);
    levelAdvanceTimer = null;
  }
}

function clearScorePopupTimer(): void {
  if (scorePopupTimer) {
    clearTimeout(scorePopupTimer);
    scorePopupTimer = null;
  }
}

function beginLevel(): void {
  clearLevelAdvanceTimer();
  clearScorePopupTimer();
  const parsed = parseProgram(currentLevel.value.code);
  frames.value = [{ nodes: parsed.main, index: 0, kind: "main" }];
  functionsMap.value = parsed.functions;
  player.row = currentLevel.value.start[0];
  player.col = currentLevel.value.start[1];
  expectedMove.value = null;
  activeNode.value = null;
  executionSteps.value = 0;
  playerInputs.value = 0;
  levelCorrectInputs.value = 0;
  levelStartedAt.value = Date.now();
  revealedHintCount.value = 0;
  notificationMessage.value = "";
  boardShattering.value = false;
  scorePopup.value = null;
  status.value = "playing";
  feedbackMessage.value = "เริ่มด่านแล้ว กดลูกศรตาม code";
  advanceToMove();
}

function restartLevel(): void {
  if (!campaignStarted.value) return;
  beginLevel();
}

function evaluateCondition(condition: Condition): boolean {
  const match = currentTile.value === condition.color;
  return condition.negate ? !match : match;
}

function advanceToMove(): void {
  // This is the tiny interpreter loop. It keeps advancing until it reaches a
  // move node, because only move nodes require the player to press an arrow.
  while (frames.value.length && status.value === "playing") {
    if (executionSteps.value > 1000) {
      failLevel("Loop error");
      return;
    }
    const frame = frames.value[frames.value.length - 1];
    if (frame.index >= frame.nodes.length) {
      if (
        frame.kind === "repeat" &&
        frame.iteration !== undefined &&
        frame.total &&
        frame.iteration < frame.total
      ) {
        frame.iteration += 1;
        frame.index = 0;
        continue;
      }
      if (
        frame.kind === "while" &&
        frame.whileNode &&
        evaluateCondition(frame.whileNode.condition)
      ) {
        frame.iteration = (frame.iteration ?? 0) + 1;
        frame.index = 0;
        continue;
      }
      frames.value.pop();
      continue;
    }
    const node = frame.nodes[frame.index++];
    activeNode.value = node;
    executionSteps.value += 1;
    if (node.type === "move") {
      expectedMove.value = node;
      feedbackMessage.value = `รอกด ${node.direction}()`;
      return;
    }
    if (node.type === "if") {
      frames.value.push({
        nodes: evaluateCondition(node.condition) ? node.body : node.elseBody,
        index: 0,
        kind: "branch",
      });
      continue;
    }
    if (node.type === "repeat") {
      if (node.count > 0)
        frames.value.push({
          nodes: node.body,
          index: 0,
          kind: "repeat",
          repeatId: node.id,
          total: node.count,
          iteration: 1,
        });
      continue;
    }
    if (node.type === "while") {
      if (evaluateCondition(node.condition))
        frames.value.push({
          nodes: node.body,
          index: 0,
          kind: "while",
          whileNode: node,
          iteration: 1,
        });
      continue;
    }
    if (node.type === "call") {
      const fn = functionsMap.value[node.name];
      if (!fn) {
        failLevel("Function missing");
        return;
      }
      if (frames.value.filter((item) => item.kind === "function").length > 80) {
        failLevel("Stack overflow");
        return;
      }
      frames.value.push({
        nodes: fn,
        index: 0,
        kind: "function",
        functionName: node.name,
      });
    }
  }
  completeLevel();
}

function controlMove(direction: Direction): void {
  // The game only succeeds when the player's input matches the next move node.
  if (!canControl.value || !expectedMove.value) return;
  const expected = expectedMove.value.direction;
  if (direction !== expected) {
    failLevel("Wrong key");
    return;
  }
  const result = resolveMove(direction);
  player.row = result.row;
  player.col = result.col;
  playerInputs.value += 1;
  totalInputs.value += 1;
  levelCorrectInputs.value += 1;
  comboStreak.value += 1;
  bestCombo.value = Math.max(bestCombo.value, comboStreak.value);
  expectedMove.value = null;
  feedbackMessage.value = result.wrapped
    ? `ถูกต้อง และ wrap ไปอีกฝั่ง`
    : "ถูกต้อง";
  setTimeout(() => advanceToMove(), 80);
}

function resolveMove(direction: Direction): {
  row: number;
  col: number;
  wrapped: boolean;
} {
  // Movement wraps around the board edges, so we normalize with modulo.
  const delta = {
    up: [-1, 0],
    down: [1, 0],
    left: [0, -1],
    right: [0, 1],
  }[direction];
  const rawRow = player.row + delta[0];
  const rawCol = player.col + delta[1];
  const row = (rawRow + currentLevel.value.rows) % currentLevel.value.rows;
  const col = (rawCol + currentLevel.value.cols) % currentLevel.value.cols;
  return { row, col, wrapped: row !== rawRow || col !== rawCol };
}

function completeLevel(): void {
  const levelScore = calculateLevelScore();
  totalScore.value += levelScore.points;
  scorePopup.value = {
    levelId: currentLevel.value.id,
    points: levelScore.points,
    speedMultiplier: levelScore.speedMultiplier,
    comboMultiplier: levelScore.comboMultiplier,
  };
  clearScorePopupTimer();
  scorePopupTimer = setTimeout(() => {
    scorePopup.value = null;
  }, 1400);
  completedLevels.value += 1;
  status.value = "success";
  notificationMessage.value = "";
  if (selectedLevelIndex.value >= activeLevels.value.length - 1) {
    status.value = "completed";
    saveScore();
    stopTimer();
    showRanking.value = true;
    return;
  }
  levelAdvanceTimer = setTimeout(() => {
    selectedLevelIndex.value += 1;
    beginLevel();
  }, 520);
}

function failLevel(reason: string): void {
  status.value = "failed";
  expectedMove.value = null;
  comboStreak.value = 0;
  notificationMessage.value = reason;
  feedbackMessage.value = notificationMessage.value;
  boardShattering.value = false;
  setTimeout(() => {
    boardShattering.value = true;
  }, 0);
  setTimeout(() => {
    boardShattering.value = false;
    if (campaignStarted.value && status.value === "failed") {
      beginLevel();
    }
  }, 760);
}

function timeUp(): void {
  stopTimer();
  status.value = "timeup";
  expectedMove.value = null;
  notificationMessage.value = "หมดเวลา 5 นาที/เวลาที่ตั้งไว้ แสดง Ranking แล้ว";
  saveScore();
  showRanking.value = true;
}

function saveScore(): void {
  const elapsedMs = Math.max(0, Date.now() - startedAt.value);
  const score: Score = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: playerName.value || "Player",
    setId: activeSet.value.id,
    setTitle: activeSet.value.title,
    mode: selectedMode.value,
    debug: debugMode.value,
    score: totalScore.value,
    bestCombo: bestCombo.value,
    levelsCompleted: completedLevels.value,
    levelReached: currentLevel.value.id,
    inputs: totalInputs.value,
    elapsedMs,
    createdAt: new Date().toISOString(),
  };
  scores.value = [...scores.value, score];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores.value));
}

function calculateLevelScore(): {
  points: number;
  speedMultiplier: number;
  comboMultiplier: number;
} {
  const elapsedSec = Math.max(
    1,
    Math.round((Date.now() - levelStartedAt.value) / 1000),
  );
  const base = 180 + currentLevel.value.id * 14 + levelCorrectInputs.value * 36;
  const speedMultiplier = Math.max(1, Math.min(4.5, 18 / elapsedSec));
  const comboMultiplier = 1 + Math.max(0, comboStreak.value - 1) * 0.16;
  const points = Math.round(base * speedMultiplier * comboMultiplier);
  return { points, speedMultiplier, comboMultiplier };
}

function showNextHint(): void {
  if (!debugMode.value) return;
  revealedHintCount.value = Math.min(revealedHintCount.value + 1, 3);
}

function isActiveRawLine(line: string): boolean {
  if (!activeNode.value) return false;
  const text = line.trim();
  if (activeNode.value.type === "move")
    return text === `${activeNode.value.direction}();`;
  if (activeNode.value.type === "if") return text.startsWith("if ");
  if (activeNode.value.type === "repeat") return text.startsWith("repeat");
  if (activeNode.value.type === "while") return text.startsWith("while");
  if (activeNode.value.type === "call")
    return text === `${activeNode.value.name}();`;
  return false;
}

function handleKeydown(event: KeyboardEvent): void {
  const keys: Partial<Record<string, Direction>> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
  };
  const direction = keys[event.key];
  if (!direction) return;
  if (status.value === "playing") {
    event.preventDefault();
    controlMove(direction);
  }
}

function formatClock(seconds: number): string {
  const mins = Math.max(0, Math.floor(seconds / 60));
  const secs = Math.max(0, seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDuration(ms: number): string {
  return formatClock(Math.round(ms / 1000));
}

onMounted(() => {
  scores.value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  window.addEventListener("keydown", handleKeydown);
});

watch(selectedSetId, () => {
  selectedLevelIndex.value = 0;
  selectedLevelDraft.value = 1;
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
  stopTimer();
  clearLevelAdvanceTimer();
  clearScorePopupTimer();
});
</script>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(html),
:global(body),
:global(#__nuxt) {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

:global(body) {
  background: #eef2ff;
  color: #1e1b4b;
  font-family: ui-rounded, "Avenir Next", system-ui, sans-serif;
}

button,
input {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

button:focus-visible,
input:focus-visible,
summary:focus-visible {
  outline: 3px solid #f97316;
  outline-offset: 3px;
}

.app-shell {
  height: 100dvh;
  padding: 14px;
  overflow: hidden;
  background:
    radial-gradient(
      circle at top left,
      rgba(249, 115, 22, 0.18),
      transparent 340px
    ),
    linear-gradient(135deg, #eef2ff 0%, #f8fbff 52%, #fff7ed 100%);
}

.game {
  display: grid;
  grid-template-columns: 1fr;
  height: 100%;
  min-height: 0;
}

.board-panel,
.setup-card,
.ranking-card {
  border: 3px solid #1e1b4b;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 8px 8px 0 rgba(79, 70, 229, 0.16);
}

.board-panel {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto auto auto;
  gap: 10px;
  padding: 14px;
  position: relative;
}

.play-cluster {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
  gap: 18px;
  align-items: stretch;
  justify-content: center;
  width: 100%;
  max-width: 1220px;
  margin: 0 auto;
}

.play-cluster .code-card {
  align-self: stretch;
  max-height: 100%;
}

.game-header,
.header-tools,
.header-menu,
.panel-title,
.objective,
.hud,
.setup-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.header-tools {
  flex-direction: column;
  align-items: flex-end;
}

.header-menu {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.eyebrow {
  margin: 0 0 3px;
  color: #4f46e5;
  font-size: 0.72rem;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: clamp(2rem, 5vw, 4.4rem);
  line-height: 0.9;
}

h2 {
  font-size: 1.15rem;
}

.hud {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.hud span,
.status,
.objective,
.notification,
.debug-note {
  border: 2px solid #c7d2fe;
  border-radius: 12px;
  background: #f8fafc;
}

.hud span,
.status {
  padding: 6px 10px;
  font-size: 0.82rem;
  font-weight: 900;
}

.objective {
  padding: 9px 11px;
}

.objective span {
  color: #5b6175;
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
}

.board-wrap {
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  position: relative;
  justify-self: center;
  width: 100%;
  max-width: min(100%, 760px);
  padding-inline: 6px;
}

.score-popup {
  position: absolute;
  top: 86px;
  left: 50%;
  z-index: 7;
  transform: translateX(-50%);
  display: grid;
  gap: 2px;
  border: 3px solid #1e1b4b;
  border-radius: 16px;
  background: #fff7ed;
  padding: 10px 14px;
  text-align: center;
  box-shadow: 0 8px 0 rgba(249, 115, 22, 0.18);
  pointer-events: none;
  min-width: min(320px, calc(100% - 28px));
}

.score-popup strong {
  font-size: 1.35rem;
  line-height: 1;
}

.score-popup span {
  color: #5b6175;
  font-size: 0.78rem;
  font-weight: 800;
}

.board {
  display: grid;
  gap: max(5px, calc(var(--cell-size) * 0.16));
  padding: max(8px, calc(var(--cell-size) * 0.25));
  border: 2px dashed #c7d2fe;
  border-radius: 16px;
  background: #f7f9ff;
  max-width: 100%;
  max-height: 100%;
  margin: 0 auto;
}

.board.shattering .tile {
  animation: shatter-tile 700ms cubic-bezier(0.16, 1, 0.3, 1);
  animation-delay: calc((var(--tile-index, 0)) * 8ms);
}

.tile {
  position: relative;
  width: var(--cell-size);
  height: var(--cell-size);
  border: 3px solid rgba(30, 27, 75, 0.18);
  border-radius: 26%;
  display: grid;
  place-items: center;
  color: rgba(30, 27, 75, 0.76);
  font-size: calc(var(--cell-size) * 0.32);
  font-weight: 950;
  box-shadow: inset 0 -6px 0 rgba(30, 27, 75, 0.1);
}

.tile-cyan {
  background: #62c7cf;
}
.tile-pink {
  background: #cf3d76;
  color: #fff;
}
.tile-green {
  background: #86d982;
}
.tile-orange {
  background: #f59e62;
}
.tile-yellow {
  background: #f4db45;
}
.tile-purple {
  background: #a77de0;
}
.tile-gray {
  background: #e5e7eb;
}
.tile-black {
  background: #3f3f46;
  color: #fff;
}

.player {
  position: absolute;
  inset: 18%;
  border: max(5px, calc(var(--cell-size) * 0.14)) solid #fff;
  border-radius: 50%;
  box-shadow:
    0 0 0 4px #1e1b4b,
    0 8px 16px rgba(30, 27, 75, 0.28);
}

.touch-controls {
  display: grid;
  grid-template-columns: repeat(3, 58px);
  grid-template-areas:
    ". up ."
    "left down right";
  justify-content: center;
  gap: 9px;
}

.arrow {
  width: 58px;
  height: 48px;
  border: 3px solid #1e1b4b;
  border-radius: 14px;
  background: #e0e7ff;
  color: #1e1b4b;
  font-weight: 950;
  box-shadow: 0 5px 0 rgba(30, 27, 75, 0.2);
}

.arrow.up {
  grid-area: up;
}
.arrow.left {
  grid-area: left;
}
.arrow.down {
  grid-area: down;
  background: #f97316;
}
.arrow.right {
  grid-area: right;
}

.code-card,
.debug-card {
  min-height: 0;
  border: 2px solid #c7d2fe;
  border-radius: 14px;
  background: #f8fafc;
  padding: 10px;
}

.code-card {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  justify-self: center;
  width: min(100%, 720px);
}

.code-box {
  min-height: 0;
  overflow: hidden;
  margin: 8px 0 0;
  border: 3px solid #1e1b4b;
  border-radius: 12px;
  background: #111827;
  color: #e5e7eb;
  padding: 10px 0;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: var(--code-font-size);
  line-height: var(--code-line-height);
}

.code-line {
  display: flex;
  align-items: center;
  min-height: 1.12em;
  padding: 0 12px;
  white-space: pre-wrap;
}

.code-token {
  white-space: pre-wrap;
}

.code-token-plain {
  color: #e5e7eb;
}

.code-token-keyword {
  color: #c084fc;
  font-weight: 900;
}

.code-token-name {
  color: #93c5fd;
}

.code-token-number {
  color: #86efac;
  font-weight: 850;
}

.code-token-punct {
  color: #94a3b8;
}

.code-tile {
  display: inline-block;
  width: calc(var(--code-font-size) * 1.45);
  height: calc(var(--code-font-size) * 1.45);
  margin: 0 0.1em;
  vertical-align: -0.2em;
  border: 2px solid rgba(30, 27, 75, 0.22);
  border-radius: 26%;
  box-shadow: inset 0 -3px 0 rgba(30, 27, 75, 0.12);
  position: relative;
}

.code-tile-symbol {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  font-size: 0.58em;
  font-weight: 950;
  line-height: 1;
  color: rgba(30, 27, 75, 0.76);
}

.code-tile.tile-pink .code-tile-symbol,
.code-tile.tile-black .code-tile-symbol {
  color: #fff;
}

.code-negation {
  display: inline-block;
  margin-right: 0.22em;
  font-weight: 900;
  color: #f59e0b;
  line-height: 1;
}

.code-line.active {
  background: rgba(249, 115, 22, 0.24);
  border-left: 5px solid #f97316;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.debug-card,
.notification {
  width: 100%;
  max-width: 1220px;
  margin: 0 auto;
}

.metric-grid div {
  border: 2px solid #dbe3ff;
  border-radius: 10px;
  background: #fff;
  padding: 7px;
}

.metric-grid span {
  display: block;
  color: #5b6175;
  font-size: 0.68rem;
  font-weight: 900;
}

.metric-grid strong {
  font-size: 0.92rem;
}

.debug-note {
  margin-top: 8px;
  padding: 8px;
  color: #354052;
  line-height: 1.35;
}

.hint-list {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}

.hint-list p {
  border-left: 5px solid #4f46e5;
  border-radius: 8px;
  background: #fff;
  padding: 7px;
  color: #354052;
}

.primary-button,
.soft-button {
  min-height: 44px;
  border: 3px solid #1e1b4b;
  border-radius: 12px;
  padding: 0 14px;
  color: #1e1b4b;
  font-weight: 950;
  box-shadow: 0 5px 0 rgba(30, 27, 75, 0.18);
}

.primary-button {
  background: #f97316;
}

.soft-button {
  background: #fff;
}

.primary-button.small,
.soft-button.small {
  min-height: 38px;
  border-width: 2px;
  box-shadow: 0 4px 0 rgba(30, 27, 75, 0.16);
}

.notification {
  padding: 10px;
  line-height: 1.35;
}

.score-pop-enter-active,
.score-pop-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms ease;
}

.score-pop-enter-from,
.score-pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px) scale(0.92);
}

.notification-failed,
.status-failed,
.status-timeup {
  background: #ffe4e6;
  border-color: #fb7185;
}

.notification-success,
.notification-completed,
.status-success,
.status-completed {
  background: #d1fae5;
  border-color: #34d399;
}

.status-playing {
  background: #fef3c7;
  border-color: #f59e0b;
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(30, 27, 75, 0.4);
}

.setup-card,
.ranking-card {
  width: min(620px, 100%);
  max-height: min(760px, calc(100dvh - 32px));
  overflow: hidden;
  padding: 20px;
}

.setup-card {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
}

.field,
.debug-toggle,
.mode-grid label,
.set-grid label {
  display: grid;
  gap: 6px;
  margin-top: 12px;
}

.field span,
.mode-grid legend,
.set-grid legend {
  color: #354052;
  font-weight: 900;
}

.field input {
  min-height: 46px;
  border: 2px solid #c7d2fe;
  border-radius: 10px;
  padding: 0 12px;
}

.timer-field.disabled {
  opacity: 0.55;
}

.mode-grid {
  display: grid;
  gap: 8px;
  margin: 14px 0 0;
  padding: 0;
  border: 0;
}

.set-grid {
  display: grid;
  gap: 8px;
  margin: 14px 0 0;
  padding: 0;
  border: 0;
}

.mode-grid label,
.set-option,
.debug-toggle {
  grid-template-columns: auto 1fr;
  align-items: center;
  border: 2px solid #c7d2fe;
  border-radius: 12px;
  background: #f8fafc;
  padding: 10px;
  cursor: pointer;
}

.mode-grid small,
.set-grid small,
.debug-toggle small {
  display: block;
  color: #5b6175;
}

.set-option.selected {
  border-color: #4f46e5;
  background: #eef2ff;
  box-shadow: 0 4px 0 rgba(79, 70, 229, 0.14);
}

.level-picker {
  margin: 14px 0 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

.level-picker legend {
  color: #354052;
  font-weight: 900;
}

.level-picker-note {
  margin: 6px 0 8px;
  color: #5b6175;
  font-size: 0.82rem;
  font-weight: 800;
  line-height: 1.35;
}

.level-grid {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 6px;
  max-height: min(200px, 28dvh);
  overflow-y: auto;
  padding: 4px;
  border: 2px solid #c7d2fe;
  border-radius: 12px;
  background: #f8fafc;
}

.level-chip {
  min-height: 40px;
  border: 2px solid #c7d2fe;
  border-radius: 10px;
  background: #fff;
  color: #354052;
  font-size: 0.78rem;
  font-weight: 950;
  cursor: pointer;
  box-shadow: 0 3px 0 rgba(30, 27, 75, 0.1);
}

.level-chip.selected {
  border-color: #f97316;
  background: #fff7ed;
  color: #9a3412;
  box-shadow: 0 4px 0 rgba(249, 115, 22, 0.22);
}

.level-chip:hover {
  border-color: #818cf8;
}

.setup-actions {
  margin-top: 16px;
}

.ranking-list {
  display: grid;
  gap: 8px;
  max-height: min(520px, calc(100dvh - 190px));
  overflow: hidden;
  padding-left: 24px;
}

.ranking-list li {
  border-bottom: 1px solid #dbe3ff;
  padding: 8px 0;
}

.ranking-list span {
  display: block;
  color: #5b6175;
}

.empty-ranking {
  color: #5b6175;
  padding: 18px 0;
}

@keyframes shatter-tile {
  0% {
    opacity: 1;
    transform: translate(0, 0) rotate(0) scale(1);
  }

  38% {
    opacity: 1;
    transform: translate(
        calc(var(--burst-x) * 0.72),
        calc(var(--burst-y) * 0.72)
      )
      rotate(var(--burst-r)) scale(0.82);
  }

  100% {
    opacity: 0;
    transform: translate(var(--burst-x), var(--burst-y))
      rotate(calc(var(--burst-r) * 1.8)) scale(0.36);
  }
}

@media (max-width: 920px) {
  .game-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-tools {
    align-items: stretch;
  }

  .play-cluster {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .debug-card {
    display: none;
  }
}

@media (max-width: 520px) {
  .level-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .play-cluster {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) minmax(180px, 36dvh);
    align-items: center;
  }

  .play-cluster .board-wrap {
    min-height: 0;
  }
}

@media (hover: none) and (pointer: coarse) {
  .touch-controls {
    grid-template-columns: repeat(3, 74px);
  }

  .arrow {
    width: 74px;
    height: 62px;
    font-size: 1.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
