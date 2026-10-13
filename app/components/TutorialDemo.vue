<template>
  <section class="tutorial-demo" :aria-label="t('tutorial.demo')">
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
            <div class="actor demo-actor" :style="{ '--x': position[1], '--y': position[0] }" aria-hidden="true">
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
    <p class="demo-note">{{ t(reducedMotion ? 'tutorial.staticDemo' : 'tutorial.demoNote') }}</p>
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
  if (disposed || completed.value || reducedMotion.value || document.hidden) return;
  timer = setTimeout(() => {
    if (disposed) return;
    phase.value = (phase.value + 1) % 4;
    if (phase.value === 2) step.value += 1;
    if (phase.value === 0 && step.value === solution.moves.length) completed.value = true;
    schedule();
  }, delays[phase.value]!);
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
.tutorial-demo { display: grid; gap: 16px; padding: 20px; border-radius: 18px; background: #061a3899; }
.demo-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.demo-label { font-size: .85rem; font-weight: 800; letter-spacing: .02em; color: #bed9ff; }
.demo-progress { display: flex; align-items: center; gap: 5px; color: #bed9ff; font-size: .85rem; min-height: 24px; font-variant-numeric: tabular-nums; }
.demo-progress.complete { color: #ffe36b; }
.demo-progress svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 2.5; }
.demo-scene { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 24px; align-items: stretch; }
.demo-playfield { min-width: 0; display: grid; justify-items: center; gap: 8px; align-content: center; }
.demo-board-area { width: 100%; height: 154px; display: grid; place-items: center; }
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
.demo-control-hint, .demo-note { margin: 0; color: #bed9ff; font-size: .8rem; }
.demo-program { display: flex; flex-direction: column; min-width: 0; justify-content: center; gap: 10px; }
.demo-program :deep(.code-card) { min-height: 208px; border-radius: 16px; box-shadow: none; }
.demo-program :deep(.window-bar) { padding: 12px 16px; }
.demo-program :deep(.window-bar h2) { font-size: .85rem; }
.demo-program :deep(.code-box) { --code-line-height: 1.9; font-size: clamp(1.1rem, 1.5vw, 1.35rem); line-height: 1.9; }
.demo-code-hint { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 0; color: #bed9ff; font-size: .9rem; }
.demo-code-hint code { color: #ffe36b; font-family: var(--cv-font-mono); }
.demo-story { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0; padding: 14px 0 0; border-top: 1px solid #a6caff26; list-style: none; }
.demo-story li { display: flex; align-items: center; gap: 8px; font-size: .9rem; }
.story-number { display: grid; place-items: center; flex: 0 0 26px; height: 26px; border-radius: 50%; background: #1f75ff; font-weight: 800; }
.demo-note { text-align: center; }
@media (max-width: 680px) {
  .tutorial-demo { padding: 14px; gap: 12px; }
  .demo-scene { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .demo-board-area { height: 130px; }
  .demo-playfield { gap: 6px; }
  .demo-program :deep(.code-card) { min-height: 0; }
  .demo-story { grid-template-columns: 1fr; gap: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .demo-actor { transition: none; }
  .demo-actor :deep(.hop) { animation: none; }
  .demo-key { transition: none; }
}
</style>
