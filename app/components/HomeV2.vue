<template>
  <main class="home-v2">
    <header class="home-header">
      <div>
        <p class="brand">{{ t('brand') }}</p>
        <h1>{{ t('home.title') }}</h1>
      </div>
      <p class="intro">{{ t('home.subtitle') }}<small>{{ t('home.rules') }}</small></p>
    </header>

    <div class="mode-boards">
      <section v-for="mode in homeConfig.modes" :key="mode.id" class="mode-board" :class="`mode-${mode.id}`"
        :aria-labelledby="`mode-${mode.id}-title`">
        <header class="mode-heading">
          <h2 :id="`mode-${mode.id}-title`"><ModeBadge :mode="mode.id" />{{ t(mode.nameKey) }}</h2>
          <p>{{ mode.id }} · {{ t(`difficulty.${mode.id}`) }} · {{ t('home.levels', { from: mode.levelRange[0], to: mode.levelRange[1] }) }} · {{ t('home.limit', { time: formatClock(mode.timeLimit * 1000) }) }}</p>
        </header>
        <ChallengeRanking :repository="repository" :board="boardFor(mode)" />
        <button type="button" class="launch-button" :disabled="busy" aria-haspopup="dialog" :data-mode-launch="mode.id"
          @click="openModeSetup(mode, $event)">{{ t('home.openSetup') }} <span aria-hidden="true">→</span></button>
      </section>
    </div>

    <footer class="home-footer">{{ t('home.team') }}: <NuxtLink to="/review">{{ t('home.review') }}</NuxtLink> · <NuxtLink to="/elements">{{ t('home.elements') }}</NuxtLink></footer>
    <PlayerSetupDialog v-if="setupMode" :mode="setupMode" :error="error" :busy="busy"
      @close="closeSetup" @start="launch" />
  </main>
</template>

<script setup lang="ts">
import { homeConfig, type ChallengeMode } from "../data/home-config";
import { useGameI18n } from "../composables/useGameI18n";
import type { ScoreRepository } from "../storage/contracts";
import { formatClock, type RankingBoard } from "../utils/ranking";

defineProps<{ repository: ScoreRepository; error?: string; busy?: boolean }>();
const emit = defineEmits<{ start: [player: { nickname: string; age: number }, mode: ChallengeMode]; resetError: [] }>();
const { t } = useGameI18n();
const setupMode = ref<ChallengeMode | null>(null);
let launchButton: HTMLButtonElement | null = null;
function boardFor(mode: ChallengeMode): RankingBoard {
  return { challengeId: mode.challengeId, setId: homeConfig.levelSetId, mode: "timer", timeLimitSec: mode.timeLimit };
}
function openModeSetup(mode: ChallengeMode, event: MouseEvent) {
  emit("resetError");
  launchButton = event.currentTarget as HTMLButtonElement;
  setupMode.value = mode;
}
async function closeSetup() {
  setupMode.value = null;
  await nextTick();
  launchButton?.focus();
}
function launch(player: { nickname: string; age: number }) {
  if (setupMode.value) emit("start", player, setupMode.value);
}
</script>

<style scoped>
.home-v2 { height: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 12px; max-width: 1740px; margin: 0 auto; color: #fff; }
.home-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.brand { margin: 0 0 4px; font-size: .85rem; font-weight: 800; color: #b7d8ff; }
h1 { margin: 0; font-size: clamp(1.4rem, 2vw, 2rem); line-height: 1.3; font-weight: 800; }
.intro { margin: 0; font-size: .9rem; text-align: right; color: #d8e8ff; }
.intro small { display: block; margin-top: 5px; font-size: .75rem; }
.mode-boards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; min-height: 0; }
.mode-board { --accent: #2268f5; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 10px; padding: 14px; min-width: 0; min-height: 0; border: 1px solid #a8c9ff; border-top: 4px solid var(--accent); border-radius: 20px; color: var(--cv-heading); background: #fff; box-shadow: var(--cv-shadow-window); }
.mode-B { --accent: #8455d5; }
.mode-C { --accent: #d66a25; }
.mode-heading { display: grid; gap: 8px; }
.mode-heading h2 { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; margin: 0; padding: 4px 8px; border: 1px solid #527ee7; border-radius: 14px; background: #0c225e; color: #e0e9ff; font-size: 1.15rem; font-weight: 800; }
.mode-heading p { margin: 0; font-size: .78rem; color: #526079; text-align: center; }
.launch-button { min-height: 48px; display: flex; align-items: center; justify-content: center; gap: 20px; border: 0; border-radius: 12px; background: var(--accent); color: white; font: inherit; font-weight: 800; font-size: 1.05rem; cursor: pointer; }
.launch-button:disabled { background: #e0e7f1; color: #58677e; cursor: not-allowed; }
.launch-button:focus-visible, a:focus-visible { outline: 3px solid #ffc83d; outline-offset: 3px; }
.home-footer { text-align: center; color: #b7cbee; font-size: .7rem; }
.home-footer a { color: #fff; text-decoration: underline; text-underline-offset: 3px; }
@media (max-width: 1100px), (max-height: 680px) {
  .home-v2 { height: auto; min-height: 100%; grid-template-rows: auto auto auto; }
  .mode-board { min-height: 440px; grid-template-rows: auto auto auto; }
}
@media (max-width: 1100px) {
  .mode-boards { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .home-header { display: block; }
  .intro { margin-top: 8px; text-align: left; }
  .mode-boards { grid-template-columns: 1fr; }
  .mode-board { min-height: 300px; }
}
</style>
