<template>
  <div class="play-cluster" :class="{ 'practice-gameplay': practiceActive }">
    <div class="board-wrap">
      <div
        v-if="notificationMessage && status !== 'success'"
        class="notification"
        :class="`notification-${status}`"
        role="alert"
      >
        <strong>{{ notificationTitle }}</strong>
        <p>{{ notificationMessage }}</p>
      </div>
      <div
        v-if="practiceActive && (status === 'success' || status === 'completed')"
        :key="`practice-pass-${boardRound}`"
        class="notification notification-success practice-success-notice"
        role="status"
      >
        <strong>✓ {{ t('practice.passed') }}</strong>
      </div>
      <p
        v-if="
          practiceSuperHint && practiceActive && practiceHintSolution?.error && !notificationMessage
        "
        class="notification"
        role="alert"
      >
        {{ t('practice.pathError') }}
      </p>
      <div class="board-and-controls">
        <p class="board-combo" :role="practiceActive ? 'status' : undefined">
          <span
            v-if="practiceActive && (status === 'success' || status === 'completed')"
            class="practice-passed"
            >✓ {{ t('practice.passed') }}</span
          ><span
            v-else-if="!practiceActive && comboStreak > 1"
            :key="comboStreak"
            class="combo-pop"
            :class="{ 'combo-hot': comboStreak >= 5 }"
            >{{ t('game.comboDisplay', { count: comboStreak }) }}</span
          >
        </p>
        <div
          ref="boardViewportEl"
          class="board-viewport"
          role="region"
          :aria-label="t('game.boardViewport', { level: level.id })"
          tabindex="0"
          @pointerdown.passive="emit('cancel-follow')"
          @touchstart.passive="emit('cancel-follow')"
          @wheel.passive="emit('cancel-follow')"
        >
          <LevelBoard
            :key="boardRound"
            :level="level"
            :space="boardSpace"
            :max-cell-size="160"
            :shattering="boardShattering"
            cascade
          >
            <BoardSuperHint
              v-if="
                practiceSuperHint &&
                practiceActive &&
                !practiceStarting &&
                ['playing', 'success', 'completed'].includes(status) &&
                !practiceHintSolution?.error
              "
              :key="level.id"
              :path="practiceHintSolution?.path ?? []"
              :completed-moves="levelCorrectInputs"
            />
            <div
              v-if="wrapExit"
              :key="`exit-${wrapExit.id}`"
              class="actor wrap-exit"
              :style="{
                '--x': wrapExit.col,
                '--y': wrapExit.row,
                '--wrap-dx': wrapExit.dx,
                '--wrap-dy': wrapExit.dy
              }"
              aria-hidden="true"
              @animationend.self="emit('wrap-ended')"
            >
              <img class="player-sprite" :src="codiSprite" alt="" draggable="false" />
            </div>
            <div
              class="actor"
              :class="[`actor-${status}`, { warp: playerWarped }]"
              :style="actorStyle"
              aria-hidden="true"
            >
              <span v-if="playerHop" :key="`dust-${playerHop}`" class="landing-dust"
                ><i /><i
              /></span>
              <span v-if="status === 'success' || status === 'completed'" class="clear-burst"
                ><i v-for="ray in 8" :key="ray" :style="{ '--ray': ray }"
              /></span>
              <div
                :key="playerHop"
                class="hop"
                :class="{ 'wrap-in': wrapExit }"
                :style="
                  wrapExit ? { '--wrap-dx': wrapExit.dx, '--wrap-dy': wrapExit.dy } : undefined
                "
              >
                <img class="player-sprite" :src="codiSprite" alt="" draggable="false" />
              </div>
              <NextMoveHint
                v-if="
                  ((practiceActive && practiceSuperHint) || mobileGuidance) &&
                  canControl &&
                  !showExitConfirm &&
                  expectedMove
                "
                :direction="expectedMove.direction"
              />
            </div>
          </LevelBoard>
        </div>
        <div ref="controlsEl" class="board-footer">
          <!-- On phones and tablets these system buttons move up into the HUD so
                     they never sit beside the D-pad under the player's thumb. -->
          <Teleport :to="hudTarget || 'body'" defer :disabled="!compactLayout || !hudTarget">
            <nav class="game-actions" :aria-label="t('game.actions')">
              <button
                type="button"
                class="hud-action sound-toggle"
                :aria-pressed="soundEnabled"
                :aria-label="t('game.soundEffects')"
                :title="t(soundEnabled ? 'game.mute' : 'game.unmute')"
                @click="emit('sound-toggle')"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 9h4l5-4v14l-5-4H4z" />
                  <path v-if="soundEnabled" d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
                  <path v-else d="m17 9 5 6m0-6-5 6" />
                </svg>
              </button>
              <button
                v-if="!campaignStarted && !practiceActive && !liveMode"
                type="button"
                class="hud-action primary-button small"
                :disabled="status === 'playing' || campaignStarted || Boolean(pendingExitScore)"
                @click="emit('start')"
              >
                {{ t('game.start') }} <span aria-hidden="true">▶</span>
              </button>
              <button
                v-if="!liveMode || compactLayout"
                type="button"
                class="hud-action soft-button small exit-action"
                :class="{ 'live-only-exit': liveMode }"
                :disabled="exitSaving || practiceStarting"
                :aria-label="
                  liveMode
                    ? t('live.leave')
                    : pendingExitScore
                      ? t('game.retryExit')
                      : campaignStarted
                        ? t('game.exit')
                        : t('game.menu')
                "
                :title="
                  liveMode
                    ? t('live.leave')
                    : campaignStarted || pendingExitScore
                      ? t('game.exitHint')
                      : undefined
                "
                @click="emit('exit')"
              >
                <svg class="exit-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 4H4v16h5m6-12 4 4-4 4M8 12h11" /></svg
                ><span class="exit-text">{{
                  pendingExitScore
                    ? t('game.retryExit')
                    : campaignStarted
                      ? t('game.exit')
                      : t('game.menu')
                }}</span>
              </button>
            </nav>
          </Teleport>
          <div class="touch-controls" :aria-label="t('game.controls')">
            <button
              type="button"
              class="arrow up"
              :class="{ 'guided-arrow': mobileGuidedMove === 'up' }"
              :disabled="!canControl"
              :aria-label="t('game.up')"
              aria-keyshortcuts="ArrowUp W"
              @click="emit('move', 'up')"
            >
              ▲<TouchTapHint v-if="mobileGuidedMove === 'up'" />
            </button>
            <button
              type="button"
              class="arrow left"
              :class="{ 'guided-arrow': mobileGuidedMove === 'left' }"
              :disabled="!canControl"
              :aria-label="t('game.left')"
              aria-keyshortcuts="ArrowLeft A"
              @click="emit('move', 'left')"
            >
              ◀<TouchTapHint v-if="mobileGuidedMove === 'left'" />
            </button>
            <button
              type="button"
              class="arrow down"
              :class="{ 'guided-arrow': mobileGuidedMove === 'down' }"
              :disabled="!canControl"
              :aria-label="t('game.down')"
              aria-keyshortcuts="ArrowDown S"
              @click="emit('move', 'down')"
            >
              ▼<TouchTapHint v-if="mobileGuidedMove === 'down'" />
            </button>
            <button
              type="button"
              class="arrow right"
              :class="{ 'guided-arrow': mobileGuidedMove === 'right' }"
              :disabled="!canControl"
              :aria-label="t('game.right')"
              aria-keyshortcuts="ArrowRight D"
              @click="emit('move', 'right')"
            >
              ▶<TouchTapHint v-if="mobileGuidedMove === 'right'" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <LevelCode
      :class="{ 'python-code': language === 'python' }"
      :level="level"
      :language="language"
      :title="t('game.readCode', { language: languageLabel })"
      :readable="true"
      scroll-hint
      :is-active-line="isGameCodeLineActive"
      :follow-active-line="(practiceActive && practiceSuperHint) || mobileGuidance"
      :teaching-guidance="practiceActive || mobileGuidance"
      :executed-step="executedCodeStep ?? undefined"
      :follow-executed="compactLayout && language === 'python' && !mobileGuidance"
      :follow-upcoming="followMobileViewports && language === 'python'"
      :upcoming-line="expectedMove?.sourceLine"
    />
  </div>
</template>

<script setup lang="ts">
import type { RawLevel } from '../data/levels'
import type { CodeLanguage } from '../utils/codeLanguage'
import type { Direction, GameStatus, MoveNode } from '../types/debug-game'
import type { BoardSpace } from '../composables/useBoardPresentation'
import type { solveLevel } from '../utils/programRunner'
import { useGameI18n } from '../composables/useGameI18n'
import { onBeforeUnmount, onMounted, ref, toRefs, watch } from 'vue'

export type LevelGameplayView = {
  notificationMessage: string
  status: GameStatus
  notificationTitle: string
  practiceActive: boolean
  boardRound: number
  practiceSuperHint: boolean
  practiceHintSolution: ReturnType<typeof solveLevel> | { path: never[]; error: string } | null
  practiceStarting: boolean
  comboStreak: number
  boardSpace: BoardSpace
  boardShattering: boolean
  wrapExit: { id: number; row: number; col: number; dx: number; dy: number } | null
  codiSprite: string
  playerWarped: boolean
  actorStyle: { '--x': number; '--y': number }
  playerHop: number
  mobileGuidance: boolean
  canControl: boolean
  keyboardEnabled: boolean
  showExitConfirm: boolean
  expectedMove: MoveNode | null
  compactLayout: boolean
  hudTarget?: string
  soundEnabled: boolean
  campaignStarted: boolean
  liveMode: boolean
  pendingExitScore: boolean
  exitSaving: boolean
  mobileGuidedMove: Direction | null
  languageLabel: string
  isGameCodeLineActive: (line: string, index: number) => boolean
  followMobileViewports: boolean
  executedCodeStep: { line: number; sequence: number } | null
  levelCorrectInputs: number
}

const props = defineProps<{ level: RawLevel; language: CodeLanguage; view: LevelGameplayView }>()
const emit = defineEmits<{
  move: [direction: Direction]
  exit: []
  start: []
  'sound-toggle': []
  'wrap-ended': []
  'cancel-follow': []
  completed: [level: RawLevel]
  failed: [level: RawLevel]
}>()
const { t } = useGameI18n()
const {
  notificationMessage,
  status,
  notificationTitle,
  practiceActive,
  boardRound,
  practiceSuperHint,
  practiceHintSolution,
  practiceStarting,
  comboStreak,
  boardSpace,
  boardShattering,
  wrapExit,
  codiSprite,
  playerWarped,
  actorStyle,
  playerHop,
  mobileGuidance,
  canControl,
  keyboardEnabled,
  showExitConfirm,
  expectedMove,
  compactLayout,
  soundEnabled,
  campaignStarted,
  liveMode,
  pendingExitScore,
  exitSaving,
  mobileGuidedMove,
  languageLabel,
  isGameCodeLineActive,
  followMobileViewports,
  executedCodeStep,
  levelCorrectInputs
} = toRefs(props.view)
const boardViewportEl = ref<HTMLElement | null>(null)
const controlsEl = ref<HTMLElement | null>(null)
const hudTarget = props.view.hudTarget
function pulseArrow(direction: Direction, wrong: boolean): void {
  const button = controlsEl.value?.querySelector<HTMLElement>(`.arrow.${direction}`)
  if (!button || typeof button.animate !== 'function') return
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (wrong) {
    const red = { backgroundColor: '#ffd6d6', borderColor: '#ff6b6b', color: '#c62f3c' }
    button.animate(
      still
        ? [red, { ...red, offset: 0.7 }, {}]
        : [
            { ...red, transform: 'translateX(0)' },
            { transform: 'translateX(-5px) rotate(-3deg)', offset: 0.2 },
            { transform: 'translateX(5px) rotate(3deg)', offset: 0.45 },
            { ...red, transform: 'translateX(-3px)', offset: 0.7 },
            {}
          ],
      { duration: 420, easing: 'ease-out' }
    )
    return
  }
  button.animate(
    still
      ? [{ backgroundColor: '#dcebff' }, {}]
      : [
          {
            transform: 'translateY(3px) scale(.92)',
            boxShadow: 'inset 0 -1px 0 rgba(6, 26, 56, .12)',
            backgroundColor: '#dcebff'
          },
          { transform: 'translateY(-1px) scale(1.04)', offset: 0.6 },
          {}
        ],
    { duration: 220, easing: 'cubic-bezier(.16, 1, .3, 1)' }
  )
}

const keyDirections: Partial<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyA: 'left',
  KeyS: 'down',
  KeyD: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right'
}

function handleKeydown(event: KeyboardEvent): void {
  if (
    !keyboardEnabled.value ||
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return
  const target = event.target
  if (
    target instanceof Element &&
    target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
    )
  )
    return
  const direction =
    keyDirections[event.code] ?? keyDirections[event.key] ?? keyDirections[event.key.toLowerCase()]
  if (!direction) return
  event.preventDefault()
  emit('move', direction)
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))

defineExpose({ boardViewportEl, controlsEl, pulseArrow })
watch(status, (next, previous) => {
  if ((next === 'success' || next === 'completed') && previous !== 'success')
    emit('completed', props.level)
  if (next === 'failed') emit('failed', props.level)
})
</script>

<style scoped>
/* Wider stacked layout: code, then board/D-pad. Phone overrides below put
   map first, then code, then the full-width D-pad using the same DOM. */
.play-cluster {
  @apply mx-auto grid w-full min-h-0 flex-1;
  grid-template-columns: minmax(0, 1fr);
  /* The program scrolls at readable size; map dimensions cannot grow either
     row or push the D-pad out of the available game area. */
  grid-template-rows: clamp(136px, 25dvh, 220px) minmax(0, 1fr);
  gap: 8px;
  align-items: stretch;
  justify-content: center;
}

.play-cluster .code-card {
  order: -1;
  align-self: stretch;
  min-width: 0;
  min-height: 0;
  width: 100%;
}
.play-cluster .code-card :deep(.window-bar) {
  padding: 8px 14px;
}
.play-cluster .code-card :deep(.window-bar h2) {
  font-size: 0.8rem;
}
.play-cluster .code-card :deep(.code-box) {
  padding: 10px 0 var(--code-bottom-space, 10px);
}
.play-cluster .code-card {
  overflow: hidden;
}

.sound-toggle {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 44px;
  min-height: 44px;
  padding: 0;
  border: 1px solid #759bd966;
  border-radius: 10px;
  background: #14357499;
  color: #e4edff;
}
.exit-action {
  color: #c4d9ff;
  background: #122b5744;
  border-color: #759bd94d;
}
.sound-toggle svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.sound-toggle[aria-pressed='false'] {
  color: #b6c7e7;
  background: #102955;
}
.hud-action {
  min-height: 44px;
  min-width: 72px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 0.8rem;
}
.hud-action.sound-toggle {
  min-width: 44px;
  width: 44px;
  padding: 0;
}
.hud-action.exit-action {
  color: #c4d9ff;
  background: #122b5744;
  border-color: #759bd94d;
}
.exit-icon,
.live-only-exit {
  display: none;
}

/* ---------- Board ---------- */

.board-combo {
  width: 100%;
  min-height: 1.4em;
  margin: 0;
  color: var(--cv-yellow);
  text-align: left;
  font-size: clamp(1rem, 1.4vw, 1.4rem);
  font-weight: 800;
  line-height: 1.4;
}

.practice-passed {
  display: inline-block;
  color: var(--cv-green);
  animation: passed-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

/* Combo: each step punches in; from ×5 it runs hot. */
.combo-pop {
  display: inline-block;
  transform-origin: left center;
  animation: combo-punch 360ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.combo-hot {
  color: #ffb347;
  text-shadow:
    0 0 12px #ff8a3d88,
    0 2px 0 #7a2e0a;
}
@keyframes combo-punch {
  0% {
    transform: scale(0.6);
    opacity: 0;
  }
  45% {
    transform: scale(1.3);
    opacity: 1;
  }
  100% {
    transform: scale(1);
  }
}
@keyframes passed-pop {
  from {
    transform: scale(0.5);
    opacity: 0;
  }
}

/* fitCellSize retains its original 24px tile minimum. If a map cannot fit at
   that size, only its viewport pans; controls are never part of that scroll. */
.board-wrap {
  @apply relative grid h-full w-full min-h-0 min-w-0 place-items-center justify-self-center;
}

.board-and-controls {
  @apply grid h-full w-full min-h-0 min-w-0 items-center justify-items-center gap-3;
  grid-template-rows: auto minmax(80px, 1fr) auto;
}
.board-viewport {
  @apply flex w-full h-full min-w-0 min-h-0 overflow-auto;
  padding: 6px;
  overscroll-behavior: contain;
  touch-action: pan-x pan-y;
  border-radius: var(--cv-radius-lg);
  /* Clear/wrap effects can temporarily exceed the board; keep panning without a flashing bar. */
  scrollbar-width: none;
}
.board-viewport::-webkit-scrollbar {
  display: none;
}
/* Auto margins center fitting maps and become zero on an overflowing axis,
   so the first row/column stays reachable from the scroll origin. */
.board-viewport > .board {
  flex: none;
  max-width: none;
  max-height: none;
  margin: auto;
}
.board-viewport:focus-visible {
  outline: 2px solid var(--cv-yellow);
  outline-offset: -2px;
}
/* Thumb zone: the D-pad alone, centred. Sound/exit live in the HUD here
   (teleported); desktop brings them back beside the D-pad. */
.board-footer {
  @apply grid w-full items-end;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}
.game-actions {
  @apply flex min-w-0 flex-row items-center;
  gap: 6px;
}
.board-footer .touch-controls {
  grid-column: 1;
  justify-self: center;
}
#game-hud-system .hud-action.exit-action {
  min-width: 0;
  padding: 0 12px;
}

/* ---------- Touch arrows ---------- */

.touch-controls {
  @apply grid flex-none justify-center gap-2;
  grid-template-columns: repeat(3, 68px);
  grid-template-areas:
    '. up .'
    'left down right';
}

.arrow {
  position: relative;
  width: 68px;
  height: 52px;
  border: 1px solid #a8ceff;
  border-radius: 12px;
  background: #fff;
  color: var(--cv-blue);
  font-weight: 800;
  font-size: 1.1rem;
  box-shadow:
    inset 0 -4px 0 rgba(6, 26, 56, 0.12),
    var(--cv-shadow-md);
}

.arrow.guided-arrow:not(:disabled) {
  background: #ffe36b;
  outline: 3px solid #87dfff88;
  outline-offset: 2px;
}

.arrow:not(:disabled):hover {
  background: var(--cv-blue-soft);
}

.arrow.up {
  grid-area: up;
}
.arrow.left {
  grid-area: left;
}
.arrow.down {
  grid-area: down;
}
.arrow.right {
  grid-area: right;
}

/* ---------- Buttons ---------- */

.primary-button,
.soft-button {
  min-height: 44px;
  border: 0;
  border-radius: var(--cv-radius-lg);
  padding: 0 18px;
  font-weight: 800;
}

/* Yellow-orange CTA, like "Try free!" */
.primary-button {
  background: var(--cv-cta);
  color: var(--cv-gray-800);
  box-shadow: var(--cv-shadow-xl);
}

.primary-button:not(:disabled):hover {
  filter: brightness(1.05);
}

/* Outline button on light surfaces, like "Compare all plans" */
.soft-button {
  border: 2px solid var(--cv-blue);
  background: #fff;
  color: var(--cv-blue);
}

.soft-button:not(:disabled):hover {
  background: var(--cv-blue-soft);
}

/* Glass button on the dark game panel */
.soft-button {
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.1);
  color: var(--cv-on-dark);
}

.soft-button:not(:disabled):hover {
  background: rgba(255, 255, 255, 0.2);
}

.primary-button.small,
.soft-button.small {
  min-height: 38px;
  border-radius: var(--cv-radius);
  padding: 0 14px;
  font-size: 0.9rem;
}

.primary-button.small {
  box-shadow: var(--cv-shadow-md);
}

/* ---------- Notifications ---------- */

.notification {
  position: absolute;
  top: 8px;
  left: 50%;
  z-index: 8;
  transform: translateX(-50%);
  width: min(440px, calc(100% - 24px));
  padding: 12px 16px;
  border: 2px solid #94bcff;
  border-radius: var(--cv-radius-lg);
  background: #102b62;
  color: #fff;
  text-align: center;
  line-height: 1.4;
  box-shadow: 0 8px 24px rgba(3, 10, 40, 0.45);
  pointer-events: none;
}
.notification {
  animation: notice-pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes notice-pop {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px) scale(0.86);
  }
}
.notification strong {
  display: block;
  font-size: 1.1rem;
  font-weight: 800;
}
.notification p {
  margin: 3px 0 0;
  font-size: 0.95rem;
}
.notification.practice-success-notice {
  display: none;
}
@keyframes practice-notice-pop {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% - 10px)) scale(0.86);
  }
}

.notification-failed,
.status-failed,
.status-timeup {
  background: rgba(255, 107, 107, 0.2);
  border-color: var(--cv-red);
}
.notification-failed {
  background: #52283d;
  border-color: #ffa8a0;
}
.notification-timeup {
  background: #523b20;
  border-color: #ffd479;
}

.notification-success,
.notification-completed,
.status-success,
.status-completed {
  background: rgba(50, 213, 131, 0.2);
  border-color: var(--cv-green);
}

.status-playing {
  background: rgba(253, 202, 63, 0.2);
  border-color: var(--cv-yellow);
}

/* The phone composition gives the program and map the space removed from
   the verbose level header; values and existing system actions stay visible. */
@media (max-width: 639px), (orientation: landscape) and (max-width: 920px) and (max-height: 560px) {
  .play-cluster .code-card.python-code :deep(.code-box) {
    font-size: 0.875rem;
  }
  .play-cluster.practice-gameplay .board-combo {
    display: none;
  }
  .notification.practice-success-notice {
    display: block;
    position: fixed;
    top: 50%;
    width: min(340px, calc(100vw - 40px));
    transform: translate(-50%, -50%);
    background: #123e32;
    color: #bbf7d0;
    animation-name: practice-notice-pop;
  }
}
@media (max-width: 639px) {
  .play-cluster {
    grid-template-rows: clamp(156px, 30dvh, 260px) minmax(0, 1fr);
    gap: 6px;
  }
  .play-cluster .code-card :deep(.window-bar) {
    padding: 4px 10px;
    gap: 7px;
  }
  .play-cluster .code-card :deep(.window-bar h2) {
    font-size: 0.7rem;
    line-height: 1.3;
  }
  .play-cluster .code-card :deep(.window-dots) {
    gap: 4px;
  }
  .play-cluster .code-card :deep(.window-dots i) {
    width: 7px;
    height: 7px;
  }
  .play-cluster .code-card :deep(.code-scroll-hint) {
    font-size: 0.55rem;
  }
  .board-and-controls {
    grid-template-rows: minmax(80px, 1fr) auto;
    gap: 8px;
    position: relative;
  }
  .board-combo {
    display: none;
  }
}

/* Wide landscape phones put code and the D-pad beside the board. Narrow
   landscape windows keep the stacked, scrollable layout so tiles have width. */
@media (min-width: 640px) and (orientation: landscape) and (max-height: 560px) {
  .play-cluster {
    grid-template-columns: minmax(0, 1.3fr) minmax(220px, 0.7fr);
    grid-template-rows: minmax(0, 1fr);
  }
  .play-cluster .code-card {
    order: 0;
    height: 100%;
  }
  .play-cluster .code-card :deep(.code-box) {
    max-height: none;
  }
  .board-and-controls {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto minmax(0, 1fr);
  }
  .board-combo {
    grid-column: 1 / -1;
  }
  .board-viewport {
    grid-column: 1;
    grid-row: 2;
  }
  .board-footer {
    grid-column: 2;
    grid-row: 2;
    grid-template-columns: auto;
    justify-items: center;
    align-self: end;
  }
  .board-footer .touch-controls {
    grid-column: 1;
    grid-row: 1;
  }
}

/* Desktop: board and D-pad on the left, code on the right. */
@media (min-width: 921px) and (min-height: 561px) {
  .play-cluster {
    min-height: 320px;
    grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
    grid-template-rows: none;
    gap: 16px;
  }
  .play-cluster .code-card {
    order: 0;
    height: 100%;
    max-height: 100%;
  }
  .play-cluster .code-card :deep(.window-bar) {
    padding: 14px 18px;
  }
  .play-cluster .code-card :deep(.window-bar h2) {
    font-size: 0.9rem;
  }
  .play-cluster .code-card :deep(.code-box) {
    max-height: none;
    padding: 16px 0 var(--code-bottom-space, 16px);
  }
  .board-wrap {
    min-height: 0;
  }
  .board-footer {
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  }
  .game-actions {
    flex-wrap: wrap;
  }
  .board-footer .touch-controls {
    grid-column: 2;
    justify-self: auto;
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

/* Small phones (320–359px) and short landscape screens: a tighter D-pad. */
@media (max-width: 359px), (orientation: landscape) and (max-height: 560px) {
  .touch-controls {
    grid-template-columns: repeat(3, 60px);
    gap: 6px;
  }
  .arrow {
    width: 60px;
    height: 50px;
    font-size: 1.1rem;
  }
}

/* Phone experiment: map above code, with a full-width thumb pad below both.
   Flatten layout wrappers only; the observed scroll viewports and input DOM
   remain the same elements, including the teleported system actions. */
@media (max-width: 639px), (orientation: landscape) and (max-width: 920px) and (max-height: 560px) {
  .play-cluster {
    position: relative;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: clamp(120px, 22dvh, 180px) minmax(180px, 1fr) auto;
    gap: 8px;
  }
  .board-wrap,
  .board-and-controls {
    display: contents;
  }
  .board-combo {
    display: none;
  }
  .board-viewport {
    grid-column: 1;
    grid-row: 1;
  }
  .play-cluster .code-card {
    grid-column: 1;
    grid-row: 2;
    order: 0;
    height: 100%;
  }
  .play-cluster .code-card :deep(.code-box) {
    max-height: none;
  }
  .board-footer {
    grid-column: 1;
    grid-row: 3;
    align-self: end;
  }
  .board-footer .touch-controls {
    grid-column: 1;
    grid-row: 1;
    width: 100%;
    justify-self: stretch;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-areas: '. up .' 'left down right';
    gap: 6px;
  }
  .touch-controls .arrow {
    width: 100%;
    min-width: 0;
    height: 52px;
    font-size: 1.15rem;
  }
  .touch-controls :deep(.tap-finger) {
    right: 6px;
    bottom: 2px;
    width: 22px;
    height: 28px;
  }
  .hud-action.sound-toggle {
    display: none;
  }
  .hud-action.exit-action {
    display: inline-grid;
    place-items: center;
    width: 40px;
    min-width: 40px;
    min-height: 44px;
    padding: 0;
  }
  .exit-action .exit-text {
    display: none;
  }
  .exit-action .exit-icon {
    display: block;
    width: 22px;
    height: 22px;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
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
