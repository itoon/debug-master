<template>
  <main class="session-panel">
    <section class="session-card" :aria-labelledby="headingId">
      <p class="session-brand">{{ t('brand') }}</p>
      <h1 :id="headingId" ref="heading" tabindex="-1">{{ t(stage === 'tutorial' ? 'tutorial.title' : stage === 'summary' ? 'summary.title' : 'home.today') }}</h1>
      <p class="session-mode">{{ mode.id }} · {{ t(mode.nameKey) }} · {{ t('home.levels', { from: mode.levelRange[0], to: mode.levelRange[1] }) }} · {{ t('home.limit', { time: formatClock(mode.timeLimit * 1000) }) }}</p>

      <template v-if="stage === 'tutorial'">
        <img class="session-codi" :src="PLAYER_SPRITES.down" alt="Codi" draggable="false" />
        <ol class="instructions">
          <li>{{ t('tutorial.read') }}</li>
          <li>{{ t('tutorial.move') }}</li>
          <li>{{ t('tutorial.repeat') }}</li>
        </ol>
        <ul class="tile-legend">
          <li v-for="tile in tutorialTiles" :key="tile.name"><code>{{ tile.name }}</code><span>{{ t(tile.nameKey) }}</span></li>
        </ul>
        <p class="retry-note">{{ t('tutorial.tiles') }}</p>
        <p class="retry-note">{{ t('tutorial.retry') }}</p>
        <div class="session-actions">
          <button type="button" class="main-action" @click="emit('play')">{{ t('tutorial.start') }}</button>
          <button type="button" class="text-action" @click="emit('play')">{{ t('tutorial.skip') }}</button>
          <button type="button" class="text-action" @click="emit('home')">{{ t('flow.home') }}</button>
        </div>
      </template>

      <template v-else-if="stage === 'summary' && result">
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
          <button type="button" class="main-action" @click="emit('ranking')">{{ t('summary.leaderboard') }}</button>
          <button type="button" class="text-action" @click="emit('home')">{{ t('flow.nextPlayer') }}</button>
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
  </main>
</template>

<script setup lang="ts">
import type { ChallengeMode } from "../data/home-config";
import type { ScoreRepository } from "../storage/contracts";
import type { Score } from "../types/debug-game";
import { formatClock, type RankingBoard } from "../utils/ranking";
import { PLAYER_SPRITES } from "../utils/playerSprites";
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
const { rows, error } = useScoreBoard(props.repository, computed(() => props.board), Infinity);
const rank = computed(() => {
  if (!props.saved || !props.result) return undefined;
  const index = rows.value.findIndex((score) => score.id === props.result?.id);
  return index < 0 ? undefined : index + 1;
});
onMounted(() => heading.value?.focus());
watch(() => props.stage, async () => { await nextTick(); heading.value?.focus(); });
</script>

<style scoped>
.session-panel { min-height: 100%; display: grid; place-items: center; padding: 12px; }
.session-card { width: min(740px, 100%); padding: clamp(20px, 3vw, 36px); display: grid; gap: 16px; border: 1px solid #a8c9ff; border-radius: 24px; background: #fff; color: var(--cv-heading); box-shadow: var(--cv-shadow-window); }
.session-brand { margin: 0; font-size: .85rem; font-weight: 800; color: #2564c9; }
h1 { margin: 0; font-size: clamp(1.35rem, 3vw, 1.9rem); font-weight: 800; line-height: 1.3; }
.session-mode, .ranking-rules { margin: 0; font-size: .9rem; color: #526079; }
.session-codi { width: 76px; height: 92px; object-fit: contain; justify-self: center; }
.session-avatar { width: 92px; height: 92px; border: 3px solid #8db7ff; border-radius: 50%; background: #d8eaff; object-fit: contain; justify-self: center; }
.instructions { list-style: none; display: grid; gap: 10px; padding: 0; margin: 0; font-size: 1.05rem; }
.retry-note, .result-player { margin: 0; color: #526079; }
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
@media (max-width: 500px) { .summary-metrics { grid-template-columns: 1fr; } .session-actions { flex-direction: column; } }
</style>
