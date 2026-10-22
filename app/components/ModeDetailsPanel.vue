<template>
  <section ref="element" class="mode-details-view" tabindex="-1" :aria-labelledby="titleId">
    <figure ref="cover" class="detail-cover">
      <img :src="thumbnailUrl" :alt="t('home.thumbnail', { mode: t(mode.nameKey) })" draggable="false" />
      <figcaption>
        <h2><ModeBadge :mode="mode.id" />{{ t(mode.nameKey) }}</h2>
        <div class="cover-details"><span class="difficulty-tag">{{ mode.id }} · {{ t(`difficulty.${mode.id}`) }}</span><span>{{ t('home.levels', { from: mode.levelRange[0], to: mode.levelRange[1] }) }}</span><span class="time-tag">◷ {{ formatClock(mode.timeLimit * 1000) }}</span></div>
      </figcaption>
    </figure>
    <div ref="panel" class="detail-panel">
      <header class="detail-header">
        <div><h2 :id="titleId" ref="heading" tabindex="-1">{{ t('home.today') }}</h2><p>{{ mode.id }} · {{ t(mode.nameKey) }} · {{ t('home.levels', { from: mode.levelRange[0], to: mode.levelRange[1] }) }} · {{ t('home.limit', { time: formatClock(mode.timeLimit * 1000) }) }}</p></div>
        <label class="player-search"><span>{{ t('ranking.search') }}</span><input v-model="search" type="search" :disabled="busy" :placeholder="t('ranking.searchPlaceholder')" autocomplete="off" spellcheck="false" /></label>
      </header>
      <ChallengeRanking class="detail-ranking" :repository="repository" :board="board" variant="space" podium split show-total placeholder :limit="Infinity" :search="search" selectable :selection-busy="busy" @select-player="emit('selectPlayer', $event)" />
      <footer class="detail-footer">
        <button type="button" class="back-button" :disabled="busy" @click="emit('back')"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m11 5-7 7 7 7M4 12h16" /></svg>{{ t('home.backModes') }}</button>
        <button ref="startButton" type="button" class="start-button" :disabled="busy" @click="emit('start')">{{ t('home.openSetup') }}<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg></button>
      </footer>
    </div>
  </section>
</template>
<script setup lang="ts">
import type { ChallengeMode } from '../data/home-config';
import { homeConfig } from '../data/home-config';
import type { ScoreRepository } from '../storage/contracts';
import type { Score } from '../types/debug-game';
import { formatClock, type RankingBoard } from '../utils/ranking';
import { useGameI18n } from '../composables/useGameI18n';
const props = defineProps<{ mode: ChallengeMode; repository: ScoreRepository; busy?: boolean; fromRect?: { left: number; top: number; width: number; height: number } }>();
const emit = defineEmits<{ ready: []; back: []; start: []; selectPlayer: [score: Score] }>();
const { t } = useGameI18n();
const titleId = useId();
const search = ref('');
const element = ref<HTMLElement | null>(null);
const cover = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const startButton = ref<HTMLButtonElement | null>(null);
const baseURL = useRuntimeConfig().app.baseURL;
const thumbnailUrl = computed(() => `${baseURL.endsWith('/') ? baseURL : `${baseURL}/`}${props.mode.thumbnail}`);
const board = computed<RankingBoard>(() => ({ challengeId: props.mode.challengeId, setId: props.mode.levelSetId, mode: 'timer', timeLimitSec: props.mode.timeLimit, difficulty: props.mode.difficulty, scoringStrategy: props.mode.scoringStrategy }));
let animations: Animation[] = [];
let disposed = false;
let closing = false;
function cancelMotion(): void { for (const animation of animations) animation.cancel(); animations = []; }
function animate(element: HTMLElement | null, frames: Keyframe[]): void {
  if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof element.animate !== 'function') return;
  const animation = element.animate(frames, { duration: homeConfig.modeMotion.cardsMs, easing: 'cubic-bezier(.22, .8, .25, 1)', fill: 'both' });
  void animation.finished.catch(() => {});
  animations.push(animation);
}
async function waitForMotion(): Promise<void> { await Promise.all(animations.map(animation => animation.finished.catch(() => {}))); }
function coverTransform(rect: { left: number; top: number; width: number; height: number }): string {
  const target = cover.value!.getBoundingClientRect();
  return `translate(${rect.left - target.left}px, ${rect.top - target.top}px) scale(${rect.width / target.width}, ${rect.height / target.height})`;
}
async function enter(): Promise<void> {
  if (props.fromRect && cover.value) animate(cover.value, [{ transform: coverTransform(props.fromRect), opacity: 1 }, { transform: 'none', opacity: 1 }]);
  animate(panel.value, [{ transform: 'translateX(70px)', opacity: 0 }, { transform: 'none', opacity: 1 }]);
  await waitForMotion();
  if (disposed || closing) return;
  cancelMotion();
  emit('ready');
  element.value?.focus({ preventScroll: true });
}
async function closeWithMotion(returnRect = props.fromRect): Promise<void> {
  if (closing || disposed) return;
  closing = true;
  cancelMotion();
  if (returnRect && cover.value) {
    animate(cover.value, [{ transform: 'none', opacity: 1 }, { transform: coverTransform(returnRect), opacity: 1 }]);
  }
  animate(panel.value, [{ transform: 'none', opacity: 1 }, { transform: 'translateX(70px)', opacity: 0 }]);
  await waitForMotion();
}
function settleResize(): void { cancelMotion(); }
function focusStart(): void { startButton.value?.focus({ preventScroll: true }); }
function focusHeading(): void { element.value?.focus({ preventScroll: true }); }
defineExpose({ closeWithMotion, getElement: () => element.value, focusStart, focusHeading });
onMounted(() => { window.addEventListener('resize', settleResize); void enter(); });
onBeforeUnmount(() => { disposed = true; cancelMotion(); window.removeEventListener('resize', settleResize); });
</script>
<style scoped>
.mode-details-view { display: grid; grid-template-columns: minmax(230px, .34fr) minmax(0, .66fr); gap: 18px; min-height: 0; height: 100%; }
.mode-details-view:focus { outline: none; }
.detail-cover { position: relative; min-width: 0; min-height: 0; height: 100%; margin: 0; overflow: hidden; border: 2px solid #7baaff; border-radius: 24px; background: #0b2456; transform-origin: top left; }
.detail-cover > img { width: 100%; height: 100%; object-fit: cover; object-position: center; }
figcaption { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; padding: 24px 20px; background: linear-gradient(180deg, #020d31e8, #04123966 110px, transparent 240px), linear-gradient(0deg, #020d31f2, #04123980 100px, transparent 220px); }
figcaption h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: clamp(1.5rem, 2.5vw, 2.3rem); text-shadow: 0 2px 6px #020d31; }
figcaption :deep(.mode-badge) { width: 56px; flex: none; }
.cover-details { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; color: #dceaff; font-size: .85rem; }
.difficulty-tag { padding: 4px 8px; border: 1px solid #8eafff; border-radius: 8px; background: #102b67; font-weight: 800; }
.time-tag { margin-left: auto; white-space: nowrap; }
.detail-panel { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 18px; min-height: 0; min-width: 0; padding: clamp(18px, 2vw, 28px); border: 1px solid #7caaff; border-radius: 24px; background: linear-gradient(160deg, #193a7ce8, #0b214aee); box-shadow: var(--cv-shadow-window); }
.detail-header { display: flex; align-items: end; justify-content: space-between; flex-wrap: wrap; gap: 14px; }
.detail-header h2 { margin: 0; color: #ffda53; font-size: clamp(1.7rem, 2.8vw, 2.4rem); }
.detail-header p { margin: 8px 0 0; color: #c4dcff; font-size: .8rem; line-height: 1.5; }
.player-search { display: grid; gap: 6px; width: min(100%, 260px); font-size: .75rem; font-weight: 800; }
.player-search input { box-sizing: border-box; width: 100%; min-height: 48px; padding: 10px 14px; border: 2px solid #9ebcfa; border-radius: 12px; background: #fff; color: #102858; font: inherit; font-size: .85rem; }
.player-search input:focus-visible { outline: 3px solid #ffda53; outline-offset: 2px; }
.detail-ranking { min-height: 0; min-width: 0; }
.detail-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding-top: 14px; border-top: 1px solid #83adff44; }
.detail-footer button { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 240px; max-width: 100%; min-height: 56px; padding: 12px 16px; border-radius: 12px; font: inherit; font-size: 1.1rem; font-weight: 800; cursor: pointer; }
.detail-footer svg { width: 20px; height: 20px; }
.back-button { border: 1px solid #789cda; background: #163565; color: #fff; }
.back-button svg { stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.start-button { border: 1px solid #ffedaa; background: #ffda53; color: #102858; box-shadow: 0 4px 0 #b88b19; }
button:disabled { opacity: .55; cursor: wait; }
button:not(:disabled):hover { filter: brightness(1.08); }
button:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
@media (min-width: 1101px) and (max-height: 780px) { .detail-panel { gap: 12px; padding: 18px; } .detail-header { gap: 8px; } .detail-header h2 { font-size: 1.7rem; } .player-search { width: 220px; } }
@media (max-width: 1100px) { .mode-details-view { height: auto; grid-template-columns: minmax(0, 1fr); } .detail-cover { height: 230px; } .detail-panel { height: min(700px, calc(100dvh - 70px)); min-height: 560px; } }
@media (max-width: 720px) { .detail-panel { height: auto; min-height: 0; grid-template-rows: auto auto auto; } .player-search { width: 100%; } .detail-ranking :deep(.split .credits-viewport) { max-height: 420px; overflow-y: auto; } .detail-ranking :deep(.rank-podium) { min-height: 260px; } .detail-footer { align-items: stretch; } .detail-footer button { width: 100%; } }
</style>
