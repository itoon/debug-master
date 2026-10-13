<template>
  <component :is="stage === 'summary' ? 'dialog' : 'main'" ref="panel" class="session-panel"
    :class="{ 'summary-dialog': stage === 'summary', 'tutorial-panel': stage === 'tutorial' }" :aria-labelledby="headingId" @cancel.prevent>
    <section class="session-card" :aria-labelledby="headingId">
      <p class="session-brand">{{ t('brand') }}</p>
      <h1 :id="headingId" ref="heading" tabindex="-1">{{ t(stage === 'tutorial' ? 'tutorial.title' : stage === 'summary' ? 'summary.title' : 'home.today') }}</h1>
      <p class="session-mode">{{ mode.id }} · {{ t(mode.nameKey) }} · {{ t('home.levels', { from: mode.levelRange[0], to: mode.levelRange[1] }) }} · {{ t('home.limit', { time: formatClock(mode.timeLimit * 1000) }) }}</p>

      <template v-if="stage === 'tutorial'">
        <div class="tutorial-lesson">
        <TutorialDemo v-if="!tipsOpen" />
        <details class="tutorial-tips" @toggle="tipsOpen = ($event.target as HTMLDetailsElement).open">
          <summary>{{ t('tutorial.more') }}</summary>
          <div class="tutorial-tips-content">
            <div class="guidance-tabs" role="group" :aria-label="t('tutorial.more')">
              <label><input v-model="guideTab" type="radio" :name="guideName" value="controls" />{{ t('tutorial.controlsTab') }}</label>
              <label><input v-model="guideTab" type="radio" :name="guideName" value="items" />{{ t('tutorial.itemsTab') }}</label>
            </div>
            <template v-if="guideTab === 'controls'">
            <p>{{ t('tutorial.controls') }}</p>
            <p>{{ t('tutorial.repeatHint') }}</p>
            <p>{{ t('tutorial.retry') }}</p>
            </template>
            <template v-else>
            <ul class="tile-legend">
              <li v-for="tile in tutorialTiles" :key="tile.name">
                <i class="code-tile-swatch" :class="`tile-${tile.name}`" aria-hidden="true" />
                <code>{{ tile.name }}</code><span>{{ t(tile.nameKey) }}</span>
              </li>
            </ul>
            <p>{{ t('tutorial.tiles') }}</p>
            </template>
          </div>
        </details>
        </div>
        <div class="session-actions">
          <button type="button" class="text-action" @click="emit('home')">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m11 5-7 7 7 7M4 12h16" /></svg>
            {{ t('tutorial.back') }}
          </button>
          <button type="button" class="main-action" @click="emit('play')">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>
            {{ t('tutorial.start') }}
          </button>
        </div>
      </template>

      <template v-else-if="stage === 'summary' && result">
        <div class="result-sparks" aria-hidden="true"><span v-for="spark in 8" :key="spark" :style="{ '--spark': spark }">✦</span></div>
        <img class="session-avatar" :src="avatarSrc(result.avatarId)" :alt="t('home.avatar')" draggable="false" />
        <p class="result-player">{{ result.name }} · {{ t('summary.levels', { count: result.levelsCompleted }) }}</p>
        <dl class="summary-metrics">
          <div><dt>{{ t('summary.score') }}</dt><dd>{{ result.score.toLocaleString('th-TH') }}</dd></div>
          <div><dt>{{ t('summary.time') }}</dt><dd>{{ formatClock(result.elapsedMs) }}</dd></div>
          <div><dt>{{ t('summary.rank') }}</dt><dd>{{ rank ? t('ranking.rank', { rank }) : t('ranking.unranked') }}</dd></div>
        </dl>
        <p v-if="storageError || error" class="session-error" role="alert">{{ t(storageError ? 'storage.error' : 'storage.loadError') }}</p>
        <button v-if="!saved" type="button" class="text-action" @click="emit('retry')">{{ t('storage.retry') }}</button>
        <div class="session-actions">
          <button type="button" class="main-action" @click="emit('home')">{{ t('flow.home') }}</button>
          <button type="button" class="text-action" @click="emit('ranking')">{{ t('summary.leaderboard') }}</button>
        </div>
      </template>

      <template v-else-if="stage === 'ranking'">
        <p class="ranking-rules">{{ t('home.rules') }}</p>
        <ChallengeRanking :repository="repository" :board="board" :highlight-id="saved ? result?.id : undefined" />
        <p v-if="storageError" class="session-error" role="alert">{{ t('storage.error') }}</p>
        <button v-if="!saved" type="button" class="text-action" @click="emit('retry')">{{ t('storage.retry') }}</button>
        <div class="session-actions">
          <button type="button" class="main-action" @click="emit('home')">{{ t('flow.nextPlayer') }}</button>
        </div>
      </template>
    </section>
  </component>
</template>

<script setup lang="ts">
import type { ChallengeMode } from "../data/home-config";
import type { ScoreRepository } from "../storage/contracts";
import type { Score } from "../types/debug-game";
import { formatClock, type RankingBoard } from "../utils/ranking";
import { useGameI18n } from "../composables/useGameI18n";
import { useScoreBoard } from "../composables/useScoreBoard";
import { TILE_TYPES, tileDefinition } from "../data/tiles";
import { usePlayerAvatar } from "../composables/usePlayerAvatar";

const tutorialTiles = TILE_TYPES.map(tileDefinition);
const avatarSrc = usePlayerAvatar();

const props = defineProps<{
  stage: "tutorial" | "summary" | "ranking";
  mode: ChallengeMode;
  repository: ScoreRepository;
  board: RankingBoard;
  result?: Score;
  saved: boolean;
  storageError: boolean;
}>();
const emit = defineEmits<{ play: []; home: []; ranking: []; retry: [] }>();
const { t } = useGameI18n();
const headingId = useId();
const heading = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const tipsOpen = ref(false);
const guideTab = ref('controls');
const guideName = useId();
const { rows, error } = useScoreBoard(props.repository, computed(() => props.board), Infinity);
const rank = computed(() => {
  if (!props.saved || !props.result) return undefined;
  const index = rows.value.findIndex((score) => score.id === props.result?.id);
  return index < 0 ? undefined : index + 1;
});
function focusPanel(): void {
  if (panel.value instanceof HTMLDialogElement && !panel.value.open) panel.value.showModal();
  heading.value?.focus();
}
onMounted(focusPanel);
watch(() => props.stage, async () => { await nextTick(); focusPanel(); });
onBeforeUnmount(() => { if (panel.value instanceof HTMLDialogElement) panel.value.close(); });
</script>

<style scoped>
.session-panel { min-height: 100%; display: grid; place-items: center; padding: 12px; }
.session-card { width: min(740px, 100%); padding: clamp(20px, 3vw, 36px); display: grid; gap: 16px; border: 1px solid #a8c9ff; border-radius: 24px; background: #fff; color: var(--cv-heading); box-shadow: var(--cv-shadow-window); }
.session-brand { margin: 0; font-size: .85rem; font-weight: 800; color: #2564c9; }
h1 { margin: 0; font-size: clamp(1.35rem, 3vw, 1.9rem); font-weight: 800; line-height: 1.3; }
.session-mode, .ranking-rules { margin: 0; font-size: .9rem; color: #526079; }
.session-avatar { width: 92px; height: 92px; border: 3px solid #8db7ff; border-radius: 50%; background: #d8eaff; object-fit: contain; justify-self: center; }
.result-player { margin: 0; color: #526079; }
.tile-legend { display: flex; flex-wrap: wrap; gap: 8px 20px; padding: 0; margin: 0; list-style: none; }
.tile-legend li { display: flex; gap: 8px; align-items: baseline; font-size: .9rem; }
.tile-legend code { font-weight: 700; color: #1a4d9c; }
.result-player { text-align: center; }
.summary-metrics { margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; text-align: center; }
.summary-metrics div { display: grid; gap: 8px; padding: 16px 8px; border-radius: 14px; background: #edf4ff; }
dt { font-size: .85rem; color: #526079; }
dd { margin: 0; font-size: 1.3rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.session-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
button { min-height: 48px; padding: 12px 20px; border-radius: 12px; font: inherit; font-weight: 800; cursor: pointer; }
.main-action { border: 0; color: #fff; background: var(--cv-blue); }
.text-action { border: 1px solid #bdd2f1; color: #1a4d9c; background: #edf4ff; }
button:focus-visible { outline: 3px solid #ffc83d; outline-offset: 3px; }
.session-error { margin: 0; color: #a32d30; }
.tutorial-panel { height: 100%; min-height: 0; padding: clamp(6px, 1.5dvh, 12px); }
.tutorial-panel .session-card { box-sizing: border-box; width: min(1040px, 100%); height: min(660px, 100%); min-height: 0; grid-template-rows: auto auto auto minmax(0, 1fr) auto; gap: clamp(6px, 1.5dvh, 12px); padding: clamp(12px, 2.5dvh, 24px); background: linear-gradient(145deg, #193c87f5, #0b224ef5); color: #fff; border-color: #85b2ff; }
.tutorial-lesson { display: flex; flex-direction: column; min-height: 0; gap: 6px; }
.tutorial-panel .session-brand, .tutorial-panel .session-mode { color: #bed9ff; }
.tutorial-panel h1 { font-size: clamp(1.4rem, 2.2vw, 1.8rem); }
.tutorial-panel .session-actions { justify-content: flex-end; }
.tutorial-panel .session-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 156px; transition: background 150ms, transform 150ms; }
.tutorial-panel .session-actions svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.tutorial-panel .main-action { color: #102754; background: #ffe36b; box-shadow: 0 3px 0 #bc8e22; }
.tutorial-panel .main-action:hover { background: #ffec9b; }
.tutorial-panel .text-action { color: #e3eeff; background: #133165; border-color: #85b2ff66; }
.tutorial-panel .text-action:hover { background: #214682; }
.tutorial-panel .session-actions button:active { transform: translateY(2px); }
.tutorial-tips { color: #bed9ff; font-size: .85rem; min-height: 0; }
.tutorial-tips[open] { flex: 1; }
.tutorial-tips summary { cursor: pointer; padding: 8px 0; }
.tutorial-tips summary:focus-visible { outline: 3px solid #ffe36b; outline-offset: 3px; border-radius: 6px; }
.tutorial-tips-content { display: grid; gap: 10px; padding: 8px 0; }
.tutorial-tips-content p { margin: 0; }
.guidance-tabs { grid-column: 1 / -1; display: flex; gap: 8px; }
.guidance-tabs label { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 48px; padding: 6px 10px; border-radius: 10px; border: 1px solid #85b2ff66; cursor: pointer; }
.guidance-tabs label:has(:checked) { color: #ffe36b; background: #214682; border-color: #ffe36b; }
.guidance-tabs label:has(:focus-visible) { outline: 3px solid #ffe36b; outline-offset: 2px; }
.guidance-tabs input { accent-color: #ffe36b; }
.tutorial-panel .tile-legend li { align-items: center; gap: 6px; }
.tutorial-panel .tile-legend code { color: #ffe36b; }
.tutorial-panel .tile-legend .code-tile-swatch { display: inline-block; flex: 0 0 22px; width: 22px; height: 22px; }
.summary-dialog { box-sizing: border-box; width: min(640px, calc(100% - 32px)); max-width: none; min-height: 0; max-height: calc(100dvh - 32px); overflow-y: auto; margin: auto; padding: 0; border: 0; border-radius: 24px; background: transparent; }
.summary-dialog::backdrop { background: #03102bb3; backdrop-filter: blur(6px); }
.summary-dialog .session-card { box-sizing: border-box; position: relative; width: 100%; overflow: hidden; gap: 14px; padding: clamp(22px, 3vw, 32px); border: 1px solid #7faaff; background: linear-gradient(155deg, #19387b, #0b214a); color: #fff; animation: summary-arrive 380ms cubic-bezier(.2, .8, .2, 1) both; }
.summary-dialog .session-brand, .summary-dialog .session-mode { color: #bdd8ff; }
.summary-dialog h1 { color: #ffdc58; font-size: clamp(1.4rem, 3vw, 1.8rem); }
.summary-dialog .result-player { color: #fff; font-size: 1.05rem; font-weight: 800; }
.summary-dialog .session-avatar { width: 84px; height: 84px; animation: avatar-celebrate 650ms 120ms ease-out both; }
.summary-dialog .summary-metrics div { border: 1px solid #86b5ff33; background: #071a3c80; }
.summary-dialog dt { color: #bed7ff; }
.summary-dialog dd { color: #fff; font-size: 1.5rem; }
.summary-dialog .summary-metrics div:first-child dd { color: #ffdc58; }
.summary-dialog .main-action { background: #ffdc58; color: #102754; }
.summary-dialog .text-action { border-color: #799bd466; background: #203f76; color: #e0ecff; }
.summary-dialog .session-error { color: #ffc7bb; }
.result-sparks { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.result-sparks span { position: absolute; top: 38%; left: calc(var(--spark) * 11%); color: #ffdc58; font-size: 1.2rem; opacity: 0; animation: spark-rise 1000ms calc(var(--spark) * 65ms) ease-out both; }
@keyframes summary-arrive { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes avatar-celebrate { 0% { transform: scale(.8); } 55% { transform: scale(1.08) rotate(-4deg); } 100% { transform: none; } }
@keyframes spark-rise { 20% { opacity: .8; } to { opacity: 0; transform: translateY(-100px) rotate(90deg); } }
@media (prefers-reduced-motion: reduce) { .summary-dialog .session-card, .summary-dialog .session-avatar, .result-sparks span { animation: none; } .tutorial-panel .session-actions button { transition: none; } }
@media (max-width: 500px) { .summary-metrics { grid-template-columns: 1fr; } .session-actions { flex-direction: column; } }
@media (max-width: 500px) {
  .tutorial-panel .session-brand { display: none; }
  .tutorial-panel .session-card { grid-template-rows: auto auto minmax(0, 1fr) auto; }
  .tutorial-panel h1 { font-size: 1.25rem; }
  .tutorial-panel .session-actions { flex-direction: row; }
  .tutorial-panel .session-actions button { flex: 1; min-width: 0; padding-inline: 10px; }
  .tutorial-panel .session-mode { font-size: .8rem; }
}
@media (max-height: 650px) {
  .tutorial-tips-content { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 8px 16px; font-size: .8rem; }
  .tutorial-panel .tile-legend { gap: 4px 10px; }
  .tutorial-panel .tile-legend li { font-size: .8rem; }
}
@media (max-width: 500px) and (min-height: 481px) {
  .tutorial-tips-content { grid-template-columns: 1fr; gap: 8px; font-size: .8rem; }
  .tutorial-panel .tile-legend { gap: 4px 10px; }
  .tutorial-panel .tile-legend li { font-size: .8rem; }
}
@media (max-height: 480px) {
  .tutorial-panel .session-brand { display: none; }
  .tutorial-panel .session-card { grid-template-rows: auto auto minmax(0, 1fr) auto; padding: 10px; gap: 6px; }
  .tutorial-panel h1 { font-size: 1.1rem; }
  .tutorial-panel .session-mode { font-size: .75rem; }
  .tutorial-tips summary { padding-block: 3px; font-size: .75rem; }
}
</style>
