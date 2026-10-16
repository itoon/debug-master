<template>
  <dialog ref="dialog" class="training-dialog game-scrollbar" :class="{ 'is-hidden': hidden }" :aria-labelledby="titleId" :aria-describedby="descriptionId" @cancel.prevent="emit('cancel')">
    <header class="training-heading">
      <div><p class="eyebrow">{{ t('mobileTutorial.badge') }}</p><h2 :id="titleId" ref="heading" tabindex="-1">{{ t('mobileTutorial.title') }}</h2></div>
      <span class="lesson-count">{{ lessonIndex + 1 }}/{{ lessons.length }}</span>
    </header>
    <ol class="lesson-track" :aria-label="t('mobileTutorial.progress')">
      <li v-for="(_, index) in lessons" :key="index" :class="{ current: index === lessonIndex, done: index < lessonIndex }" :aria-current="index === lessonIndex ? 'step' : undefined">
        <span aria-hidden="true">{{ index < lessonIndex ? '✓' : String(index + 1).padStart(2, '0') }}</span>
      </li>
    </ol>
    <div class="training-body">
      <LevelCode :level="lesson.level" :title="t('tutorial.code')" language="python" readable
        :is-active-line="(_, index) => !completed && nextMove?.line === index + 1"
        :executed-step="executedStep" follow-executed />
      <div ref="boardArea" class="training-board game-scrollbar">
        <LevelBoard :key="lessonIndex" :level="lesson.level" :space="boardSpace" :max-cell-size="88">
          <div class="actor training-actor" :style="{ '--x': position.col, '--y': position.row }" aria-hidden="true">
            <div :key="step" :class="{ hop: step > 0 }"><img class="player-sprite" :src="PLAYER_SPRITES[facing]" alt="" draggable="false" /></div>
            <NextMoveHint v-if="nextMove && !moving" :direction="nextMove.direction" />
          </div>
        </LevelBoard>
      </div>
    </div>
    <div class="training-controls">
      <p :id="descriptionId" class="training-status" :class="{ success: completed, wrong }" role="status">
        {{ t(completed ? 'mobileTutorial.done' : wrong ? 'mobileTutorial.tryAgain' : 'mobileTutorial.tap', { direction: nextMove ? arrows[nextMove.direction] : '' }) }}
      </p>
      <div class="training-pad" :aria-label="t('game.controls')">
        <button v-for="direction in directions" :key="direction" type="button" class="arrow" :class="[direction, { suggested: nextMove?.direction === direction && !moving }]"
          :disabled="completed || moving" :aria-label="t(`game.${direction}`)" @click="press(direction)">
          {{ arrows[direction] }}
          <svg v-if="nextMove?.direction === direction && !moving" class="tap-finger" viewBox="0 0 32 40" fill="none" aria-hidden="true"><path d="M12 23V6a3 3 0 0 1 6 0v13l2-2a3 3 0 0 1 4 0l5 5v9c0 4-3 7-7 7h-7l-10-12a3 3 0 0 1 4-4l3 1Z" fill="white" stroke="#102754" stroke-width="2" stroke-linejoin="round" /></svg>
        </button>
      </div>
    </div>
    <footer class="training-actions">
      <button type="button" class="back-button" @click="emit('cancel')"><span aria-hidden="true">←</span>{{ t('tutorial.back') }}</button>
      <button type="button" class="next-button" :disabled="!completed || moving" @click="advanceLesson">{{ t(lessonIndex === lessons.length - 1 ? 'mobileTutorial.start' : 'mobileTutorial.next') }}<span aria-hidden="true">{{ lessonIndex === lessons.length - 1 ? '▶' : '→' }}</span></button>
    </footer>
  </dialog>
</template>

<script setup lang="ts">
import { rawLevels } from '../data/levels';
import { useProgramParser } from '../composables/useProgramParser';
import { useGameI18n } from '../composables/useGameI18n';
import type { BoardSpace } from '../composables/useBoardPresentation';
import type { Direction } from '../types/debug-game';
import { createRunState, runUntilMove, stepPosition } from '../utils/programRunner';
import { PLAYER_SPRITES } from '../utils/playerSprites';

const emit = defineEmits<{ complete: []; cancel: []; sound: [effect: 'move' | 'wrong' | 'clear']; unlockAudio: [] }>();
const { t } = useGameI18n();
const titleId = useId();
const descriptionId = useId();
const dialog = ref<HTMLDialogElement | null>(null);
const heading = ref<HTMLElement | null>(null);
const boardArea = ref<HTMLElement | null>(null);
const boardSpace = ref<BoardSpace>();
const directions: Direction[] = ['up', 'left', 'down', 'right'];
const arrows: Record<Direction, string> = { up: '▲', left: '◀', down: '▼', right: '▶' };
// Solve only copies of the original first three authored lessons. This does
// not share run state, timer, score, player identity or a socket with gameplay.
const lessons = rawLevels.slice(0, 3).map(level => {
  const state = createRunState(useProgramParser(() => level.id).parseProgram(level.code));
  const position = { row: level.start[0]!, col: level.start[1]! };
  const moves: { direction: Direction; line: number; row: number; col: number }[] = [];
  for (;;) {
    const result = runUntilMove(state, () => level.map[position.row]?.[position.col] ?? 'n');
    if (result.kind !== 'move') break;
    const next = stepPosition(position, result.node.direction, level.rows, level.cols);
    moves.push({ direction: result.node.direction, line: result.node.sourceLine!, row: next.row, col: next.col });
    position.row = next.row;
    position.col = next.col;
  }
  return { level, moves };
});
const lessonIndex = ref(0);
const lesson = computed(() => lessons[lessonIndex.value]!);
const step = ref(0);
const nextMove = computed(() => lesson.value.moves[step.value]);
const completed = computed(() => step.value >= lesson.value.moves.length);
const position = computed(() => step.value ? lesson.value.moves[step.value - 1]! : { row: lesson.value.level.start[0], col: lesson.value.level.start[1] });
const facing = computed<Direction>(() => step.value ? lesson.value.moves[step.value - 1]!.direction : 'down');
const executedStep = shallowRef<{ line: number; sequence: number }>();
const moving = ref(false);
const wrong = ref(false);
const hidden = ref(false);
let sequence = 0;
let moveTimer: ReturnType<typeof setTimeout> | undefined;
let observer: ResizeObserver | undefined;
let disposed = false;

function press(direction: Direction): void {
  if (moving.value || completed.value || !nextMove.value) return;
  emit('unlockAudio');
  if (nextMove.value.direction !== direction) {
    wrong.value = true;
    emit('sound', 'wrong');
    return; // Keep training progress; wrong taps never affect the real game.
  }
  wrong.value = false;
  executedStep.value = { line: nextMove.value.line, sequence: ++sequence };
  step.value += 1;
  moving.value = true;
  emit('sound', completed.value ? 'clear' : 'move');
  moveTimer = setTimeout(() => { if (!disposed) moving.value = false; }, 260);
}
function advanceLesson(): void {
  if (!completed.value || moving.value) return;
  if (lessonIndex.value === lessons.length - 1) { emit('complete'); return; }
  lessonIndex.value += 1;
  step.value = 0;
  wrong.value = false;
  executedStep.value = undefined;
  if (boardArea.value) { boardArea.value.scrollTop = 0; boardArea.value.scrollLeft = 0; }
  heading.value?.focus({ preventScroll: true });
}
function onKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
  const keys: Partial<Record<string, Direction>> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyA: 'left', KeyS: 'down', KeyD: 'right' };
  const direction = keys[event.code] ?? keys[event.key];
  if (!direction) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!event.repeat) press(direction);
}
function syncVisibility(): void { hidden.value = document.hidden; }
onMounted(() => {
  dialog.value?.showModal();
  heading.value?.focus();
  observer = new ResizeObserver(() => {
    if (boardArea.value) boardSpace.value = { width: boardArea.value.clientWidth - 12, height: boardArea.value.clientHeight - 12 };
  });
  if (boardArea.value) observer.observe(boardArea.value);
  window.addEventListener('keydown', onKeydown, true);
  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();
});
onBeforeUnmount(() => {
  disposed = true;
  clearTimeout(moveTimer);
  observer?.disconnect();
  window.removeEventListener('keydown', onKeydown, true);
  document.removeEventListener('visibilitychange', syncVisibility);
  dialog.value?.close();
});
</script>

<style scoped>
.training-dialog { width: min(600px, calc(100% - 16px)); height: min(800px, calc(100dvh - 16px)); max-height: calc(100dvh - 16px); margin: auto; padding: 14px; border: 1px solid #85b2ff; border-radius: 20px; color: #fff; background: linear-gradient(145deg, #193c87, #0b224e); overflow-y: auto; }
.training-dialog[open] { display: flex; flex-direction: column; gap: 10px; }
.training-dialog::backdrop { background: #03102bd9; backdrop-filter: blur(5px); }
.training-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex: none; }
.eyebrow { color: #bed9ff; margin: 0; font-size: .65rem; }
h2 { margin: 0; color: #ffe36b; font-size: 1.05rem; font-weight: 800; }
.lesson-count { font-size: 1.2rem; font-weight: 800; color: #87dfff; }
.lesson-track { display: flex; gap: 6px; padding: 0; margin: 0; list-style: none; flex: none; }
.lesson-track li { flex: 1; padding: 2px 8px; border-radius: 6px; background: #071e4988; text-align: center; font-size: .65rem; color: #bed9ff; }
.lesson-track .current { background: #ffe36b; color: #102754; font-weight: 800; }
.lesson-track .done { background: #1c6757; color: #c8ffe9; }
.training-body { flex: 1; min-height: 210px; display: grid; grid-template-rows: minmax(94px, .8fr) minmax(96px, 1fr); gap: 8px; }
.training-body :deep(.code-card) { width: 100%; border-radius: 12px; }
.training-body :deep(.window-bar) { padding: 4px 10px; gap: 6px; }
.training-body :deep(.window-bar h2) { font-size: .7rem; }
.training-body :deep(.window-dots i) { width: 6px; height: 6px; }
.training-body :deep(.code-box) { font-size: 1rem; line-height: 1.5; padding-top: 6px; }
.training-body :deep(.code-line) { padding-inline: 10px; }
.training-board { display: flex; padding: 6px; min-height: 0; min-width: 0; overflow: auto; touch-action: pan-x pan-y; }
.training-board > .board { flex: none; margin: auto; max-height: none; max-width: none; }
.training-actor > div { display: grid; place-items: center; width: 100%; height: 100%; }
.training-controls { flex: none; display: grid; gap: 6px; justify-items: center; }
.training-status { margin: 0; min-height: 1.5em; font-size: .8rem; color: #ffe36b; text-align: center; }
.training-status.success { color: #79edb1; }
.training-status.wrong { color: #ffb9b9; }
.training-pad { display: grid; grid-template-columns: repeat(3, 60px); grid-template-areas: '. up .' 'left down right'; gap: 6px; }
.training-pad button { position: relative; height: 48px; border: 1px solid #a8ceff; border-radius: 12px; background: #fff; color: var(--cv-blue); font-size: 1.2rem; box-shadow: inset 0 -4px 0 #061a381f; }
.up { grid-area: up; } .left { grid-area: left; } .down { grid-area: down; } .right { grid-area: right; }
.training-pad button.suggested { background: #ffe36b; outline: 3px solid #ffe36b66; outline-offset: 3px; }
.tap-finger { position: absolute; width: 26px; height: 34px; right: -8px; bottom: -12px; z-index: 2; pointer-events: none; animation: tap-guide 1100ms ease-in-out infinite; }
.is-hidden .tap-finger { animation-play-state: paused; }
.training-actions { display: flex; gap: 10px; flex: none; }
button { font: inherit; font-weight: 800; cursor: pointer; transition: background 120ms; }
.training-actions button { flex: 1; min-height: 44px; display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 12px; padding: 8px 10px; font-size: .9rem; }
.back-button { border: 1px solid #85b2ff77; color: #e3eeff; background: #133165; }
.next-button { border: 1px solid #ffe36b; color: #102754; background: #ffe36b; }
button:not(:disabled):hover { filter: brightness(1.12); }
button:not(:disabled):active { transform: translateY(2px); }
button:disabled { opacity: .55; cursor: default; }
button:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
@keyframes tap-guide { 0%, 100% { transform: translateY(3px) scale(.94); } 50% { transform: translateY(-5px); } }
@media (max-height: 650px) {
  .training-dialog { padding: 10px; }
  .training-dialog[open] { gap: 6px; }
  .training-pad { grid-template-columns: repeat(3, 52px); gap: 4px; }
  .training-pad button { height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .tap-finger { animation: none; }
  .training-actor, .training-actor :deep(.hop) { animation: none; transition: none; }
  button { transition: none; }
}
</style>
