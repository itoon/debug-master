<template>
  <section class="tutorial-demo" :aria-label="t(reducedMotion ? 'tutorial.staticDemo' : 'tutorial.demo')">
    <div class="demo-heading">
      <span class="demo-label">{{ t('tutorial.example') }}</span>
      <span class="demo-progress" :class="{ complete: completed }">
        <svg v-if="completed" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
        {{ t(completed ? 'tutorial.demoDone' : 'tutorial.demoProgress', { count: step, total: solution.moves.length }) }}
      </span>
    </div>

    <div class="demo-scene">
      <div class="demo-playfield">
        <div ref="boardArea" class="demo-board-area">
          <LevelBoard :level="level" :space="boardSpace" :max-cell-size="88">
            <div class="actor demo-actor" :class="{ resetting }" :style="{ '--x': position[1], '--y': position[0] }" aria-hidden="true">
              <div :key="step" :class="{ hop: stepping }">
                <img class="player-sprite" :src="PLAYER_SPRITES[facing]" alt="" draggable="false" />
              </div>
            </div>
          </LevelBoard>
        </div>
        <div class="demo-keyboard" aria-hidden="true">
          <span class="demo-key key-up">↑<small>W</small></span>
          <span class="demo-key key-left">←<small>A</small></span>
          <span class="demo-key key-down">↓<small>S</small></span>
          <span class="demo-key key-right" :class="{ pressed }">→<small>D</small></span>
        </div>
        <p class="demo-control-hint">{{ t('tutorial.demoKey') }}</p>
      </div>

      <div class="demo-program">
        <LevelCode :level="level" :title="t('tutorial.code')" language="python" readable line-numbers
          :is-active-line="(_, index) => !completed && index === activeLine" />
        <p class="demo-code-hint"><code>right()</code><span>{{ t('tutorial.right') }}</span></p>
      </div>
    </div>

    <ol class="demo-story">
      <li><span class="story-number">1</span><span>{{ t('tutorial.storyRead') }}</span></li>
      <li><span class="story-number">2</span><span>{{ t('tutorial.storyPress') }}</span></li>
      <li><span class="story-number">3</span><span>{{ t('tutorial.storyMove') }}</span></li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { rawLevels } from '../data/levels';
import { useProgramParser } from '../composables/useProgramParser';
import { useGameI18n } from '../composables/useGameI18n';
import type { BoardSpace } from '../composables/useBoardPresentation';
import { solveLevel } from '../utils/programRunner';
import { PLAYER_SPRITES } from '../utils/playerSprites';

const { t } = useGameI18n();
// Set 01's original level 1 is three straight-line moves. The preview is
// isolated: it reads the authored program, never the player's live run.
const level = rawLevels[0]!;
const solution = solveLevel(level, useProgramParser(() => level.id).parseProgram(level.code));
const step = ref(0);
const phase = ref(0);
const completed = ref(false);
const reducedMotion = ref(false);
const resetting = ref(false);
const boardArea = ref<HTMLElement | null>(null);
const boardSpace = ref<BoardSpace>();
const position = computed(() => solution.path[step.value] ?? level.start);
const facing = computed(() => step.value ? solution.moves[step.value - 1]! : 'down');
const pressed = computed(() => !completed.value && (phase.value === 1 || phase.value === 2));
const stepping = computed(() => !completed.value && phase.value === 2);
const activeLine = computed(() => step.value - (phase.value >= 2 ? 1 : 0));
const delays = [780, 160, 300, 160] as const;
let timer: ReturnType<typeof setTimeout> | undefined;
let observer: ResizeObserver | undefined;
let motionQuery: MediaQueryList | undefined;
let disposed = false;

function stop(): void {
  clearTimeout(timer);
  timer = undefined;
}
function schedule(): void {
  stop();
  if (disposed || reducedMotion.value || document.hidden) return;
  timer = setTimeout(() => {
    if (disposed) return;
    if (completed.value) {
      // Reset the example without implying a left() instruction in the code.
      resetting.value = true;
      step.value = 0;
      phase.value = 0;
      completed.value = false;
    } else {
      resetting.value = false;
      phase.value = (phase.value + 1) % 4;
      if (phase.value === 2) step.value += 1;
      if (phase.value === 0 && step.value === solution.moves.length) completed.value = true;
    }
    schedule();
  }, completed.value ? 1200 : delays[phase.value]!);
}
function syncMotion(): void {
  reducedMotion.value = motionQuery?.matches ?? false;
  if (reducedMotion.value) {
    stop();
    step.value = solution.moves.length;
    completed.value = true;
  } else schedule();
}
onMounted(() => {
  observer = new ResizeObserver(() => {
    if (boardArea.value) boardSpace.value = { width: boardArea.value.clientWidth, height: boardArea.value.clientHeight };
  });
  if (boardArea.value) observer.observe(boardArea.value);
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  motionQuery.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', schedule);
  syncMotion();
});
onBeforeUnmount(() => {
  disposed = true;
  stop();
  observer?.disconnect();
  motionQuery?.removeEventListener('change', syncMotion);
  document.removeEventListener('visibilitychange', schedule);
});
</script>

<style scoped>
.tutorial-demo { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; flex: 1; min-height: 0; gap: clamp(8px, 1.8dvh, 16px); padding: clamp(12px, 2dvh, 20px); border-radius: 18px; background: #061a3899; }
.demo-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.demo-label { font-size: .85rem; font-weight: 800; letter-spacing: .02em; color: #bed9ff; }
.demo-progress { display: flex; align-items: center; gap: 5px; color: #bed9ff; font-size: .85rem; min-height: 24px; font-variant-numeric: tabular-nums; }
.demo-progress.complete { color: #ffe36b; }
.demo-progress svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 2.5; }
.demo-scene { min-height: 0; display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: clamp(12px, 2vw, 24px); align-items: stretch; }
.demo-playfield { min-width: 0; min-height: 0; display: grid; grid-template-rows: minmax(56px, 1fr) auto auto; justify-items: center; gap: 8px; }
.demo-board-area { width: 100%; min-height: 0; display: grid; place-items: center; }
.demo-actor.resetting { transition: none; }
.demo-actor > div { display: grid; width: 100%; height: 100%; grid-template-columns: minmax(0, 1fr); place-items: center; }
.demo-actor .player-sprite { animation: none; }
.demo-keyboard { display: grid; grid-template-columns: repeat(3, 42px); grid-template-rows: repeat(2, 38px); gap: 5px; }
.demo-key { display: flex; align-items: center; justify-content: center; gap: 3px; border-radius: 9px; background: #e5efff; color: #144b9c; box-shadow: 0 3px 0 #8ca4d3; font-size: 1.2rem; font-weight: 800; transition: transform 120ms, background 120ms; }
.demo-key small { font-size: .65rem; }
.key-up { grid-column: 2; }
.key-left { grid-row: 2; grid-column: 1; }
.key-down { grid-row: 2; grid-column: 2; }
.key-right { grid-row: 2; grid-column: 3; }
.demo-key.pressed { background: #ffe36b; transform: translateY(3px); box-shadow: none; }
.demo-control-hint { margin: 0; color: #bed9ff; font-size: .8rem; }
.demo-program { display: flex; flex-direction: column; min-width: 0; min-height: 0; gap: 10px; }
.demo-program :deep(.code-card) { flex: 1; min-height: 0; border-radius: 16px; box-shadow: none; }
.demo-program :deep(.window-bar) { padding: 12px 16px; }
.demo-program :deep(.window-bar h2) { font-size: .85rem; }
.demo-program :deep(.code-box) { --code-line-height: 1.9; font-size: clamp(1.1rem, 1.5vw, 1.35rem); line-height: 1.9; }
.demo-code-hint { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 0; color: #bed9ff; font-size: .9rem; }
.demo-code-hint code { color: #ffe36b; font-family: var(--cv-font-mono); }
.demo-story { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0; padding: 14px 0 0; border-top: 1px solid #a6caff26; list-style: none; }
.demo-story li { display: flex; align-items: center; gap: 8px; font-size: .9rem; }
.story-number { display: grid; place-items: center; flex: 0 0 26px; height: 26px; border-radius: 50%; background: #1f75ff; font-weight: 800; }
@media (max-width: 680px) and (min-height: 650px) {
  .tutorial-demo { padding: 14px; gap: 12px; }
  .demo-scene { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(122px, 1fr) minmax(148px, 1.2fr); gap: 12px; }
  .demo-playfield { gap: 6px; }
  .demo-playfield { grid-template-rows: minmax(56px, 1fr) auto; }
  .demo-keyboard { grid-template-columns: repeat(3, 34px); grid-template-rows: repeat(2, 28px); gap: 4px; }
  .demo-control-hint { display: none; }
  .demo-story { gap: 6px; font-size: .8rem; }
  .demo-story li { align-items: flex-start; flex-direction: column; gap: 4px; font-size: .8rem; }
  .demo-program :deep(.code-box) { font-size: 1rem; line-height: 1.55; padding: 8px 0; }
  .demo-program :deep(.window-bar) { padding: 8px 12px; }
  .demo-program :deep(.code-line) { padding-inline: 12px; }
}
@media (max-height: 650px) {
  .tutorial-demo { gap: 8px; padding: 10px; }
  .demo-playfield { gap: 5px; }
  .demo-keyboard { grid-template-columns: repeat(3, 34px); grid-template-rows: repeat(2, 28px); gap: 4px; }
  .demo-key { font-size: 1rem; }
  .demo-program :deep(.code-box) { font-size: 1rem; line-height: 1.5; padding: 6px 0; }
  .demo-program :deep(.window-bar) { padding: 7px 10px; }
  .demo-program :deep(.code-line) { padding-inline: 10px; }
  .demo-story { gap: 6px; padding-top: 8px; }
  .demo-story li { gap: 5px; font-size: .8rem; }
}
@media (max-width: 680px) and (max-height: 649px) {
  .demo-scene { gap: 8px; }
  .demo-control-hint { font-size: .7rem; }
  .demo-code-hint { font-size: .75rem; gap: 4px; }
  .demo-program :deep(.window-dots) { display: none; }
  .demo-story li { align-items: flex-start; flex-direction: column; }
}
@media (max-width: 500px) and (max-height: 749px) {
  .demo-scene { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(88px, 1fr) minmax(148px, 1.2fr); }
  .demo-playfield { grid-template-rows: minmax(56px, 1fr) auto; gap: 4px; }
  .demo-keyboard { grid-template-columns: repeat(4, 34px); grid-template-rows: 28px; }
  .demo-key { grid-row: 1; grid-column: auto; }
  .demo-control-hint, .demo-story { display: none; }
  .tutorial-demo { grid-template-rows: auto minmax(0, 1fr); }
  .demo-heading { flex-wrap: nowrap; gap: 4px; }
  .demo-label, .demo-progress { font-size: .75rem; }
  .demo-program { gap: 6px; }
}
@media (max-height: 480px) {
  .tutorial-demo { grid-template-rows: auto minmax(0, 1fr); }
  .demo-story, .demo-control-hint { display: none; }
  .demo-program { gap: 5px; }
  .demo-code-hint { font-size: .75rem; }
  .demo-label, .demo-progress { font-size: .75rem; }
  .demo-program :deep(.code-box) { font-size: .875rem; line-height: 1.5; padding-block: 4px; }
  .demo-program :deep(.window-bar) { padding-block: 5px; }
  .demo-program :deep(.window-bar h2) { font-size: .75rem; }
}
@media (max-width: 500px) and (max-height: 480px) {
  .demo-scene { grid-template-rows: minmax(88px, 1fr) minmax(108px, 1.2fr); }
}
@media (prefers-reduced-motion: reduce) {
  .demo-actor { transition: none; }
  .demo-actor :deep(.hop) { animation: none; }
  .demo-key { transition: none; }
}
</style>
