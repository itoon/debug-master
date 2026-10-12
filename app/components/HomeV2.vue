<template>
  <main class="home-v2">
    <header class="home-header">
      <div class="home-hero">
        <img class="hero-codi" :src="codiHappy" alt="Codi" draggable="false" />
        <div class="hero-copy">
          <p class="brand">{{ t('brand') }}</p>
          <p class="codi-greeting">{{ t('home.greeting') }}</p>
          <h1>{{ t('home.title') }}</h1>
        </div>
      </div>
      <p class="intro">{{ t('home.subtitle') }}<small>{{ t('home.rules') }}</small></p>
    </header>

    <div class="mode-boards">
      <section v-for="mode in homeConfig.modes" :key="mode.id" class="mode-board" :class="`mode-${mode.id}`"
        :aria-labelledby="`mode-${mode.id}-title`">
        <header class="mode-heading">
          <h2 :id="`mode-${mode.id}-title`"><ModeBadge :mode="mode.id" />{{ t(mode.nameKey) }}</h2>
          <div class="mode-details">
            <span class="difficulty-tag">{{ mode.id }} · {{ t(`difficulty.${mode.id}`) }}</span>
            <span>{{ t('home.levels', { from: mode.levelRange[0], to: mode.levelRange[1] }) }}</span>
            <span class="time-tag"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="M10 5v5l3 2" /></svg>{{ formatClock(mode.timeLimit * 1000) }}</span>
          </div>
        </header>
        <ChallengeRanking :repository="repository" :board="boardFor(mode)" variant="space" />
        <button type="button" class="launch-button" :disabled="busy" aria-haspopup="dialog" :data-mode-launch="mode.id"
          @click="openModeSetup(mode, $event)"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 3 11 7-11 7z" /></svg>{{ t('home.openSetup') }}</button>
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
import codiHappy from "~/assets/sprites/cody-happy.webp";

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
.home-v2 { height: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 16px; max-width: 1480px; padding: 12px; margin: 0 auto; color: #fff; }
.home-header { display: flex; align-items: center; justify-content: space-between; gap: 28px; }
.home-hero { display: flex; align-items: center; gap: 20px; min-width: 0; }
.hero-codi { flex: none; width: 90px; height: 112px; object-fit: contain; filter: drop-shadow(0 8px 8px rgba(3, 16, 70, .35)); }
.hero-copy { min-width: 0; }
.brand { margin: 0 0 6px; font-size: .75rem; font-weight: 800; letter-spacing: .04em; color: #d0e4ff; }
.codi-greeting { display: inline-block; position: relative; margin: 0 0 8px; padding: 5px 12px; border: 2px solid #102252; border-radius: 13px; background: #fff; color: #17283f; font-size: .85rem; font-weight: 800; box-shadow: 0 3px 0 rgba(4, 20, 66, .2); }
.codi-greeting::before { content: ""; position: absolute; left: -7px; top: 12px; width: 10px; height: 10px; border-left: 2px solid #102252; border-bottom: 2px solid #102252; background: #fff; transform: rotate(45deg); }
h1 { margin: 0; font-size: clamp(1.8rem, 2.7vw, 2.6rem); line-height: 1.2; font-weight: 800; text-shadow: 0 3px 12px rgba(2, 27, 111, .2); }
.intro { max-width: 310px; margin: 0; padding: 12px 16px; border: 1px solid rgba(147, 192, 255, .45); border-radius: 16px; background: rgba(10, 37, 113, .65); font-size: .9rem; text-align: left; color: #f0f6ff; backdrop-filter: blur(8px); }
.intro small { display: block; margin-top: 7px; font-size: .72rem; color: #c1d5ff; }
.mode-boards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; min-height: 0; }
.mode-board { --mode-accent: #ffdc53; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 14px; padding: 18px; min-width: 0; min-height: 0; border: 2px solid #5c86db; border-radius: 26px; color: #fff; background: linear-gradient(165deg, #1a398f, #17317f); box-shadow: 0 14px 28px rgba(3, 21, 85, .25), inset 0 1px 0 rgba(199, 222, 255, .15); }
.mode-A { border-color: #e3bd4b; }
.mode-B { --mode-accent: #94deff; }
.mode-C { --mode-accent: #ffdc53; }
.mode-heading { display: grid; gap: 10px; }
.mode-heading h2 { display: flex; align-items: center; gap: 9px; margin: 0; color: #fff; font-size: clamp(1.2rem, 1.7vw, 1.6rem); font-weight: 800; line-height: 1.3; }
.mode-heading :deep(.mode-badge) { width: 52px; }
.mode-details { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; color: #c9ddff; font-size: .75rem; }
.difficulty-tag { padding: 4px 10px; border: 1px solid rgba(134, 179, 255, .6); border-radius: 20px; background: #0e286d; color: var(--mode-accent); font-weight: 800; }
.time-tag { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; font-variant-numeric: tabular-nums; }
.time-tag svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
.launch-button { min-height: 56px; display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 5px; padding: 10px 20px; border: 2px solid #ffe889; border-radius: 30px; background: linear-gradient(#ffe269, #ffce36); color: #142854; box-shadow: 0 5px 0 #bb8c24, 0 8px 14px rgba(5, 21, 72, .25); font: inherit; font-weight: 800; font-size: 1.2rem; cursor: pointer; transition: transform 150ms ease, box-shadow 150ms ease; }
.launch-button svg { width: 19px; height: 19px; fill: currentColor; }
.launch-button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 7px 0 #bb8c24, 0 10px 18px rgba(5, 21, 72, .3); }
.launch-button:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 2px 0 #bb8c24; }
.launch-button:disabled { background: #647cae; border-color: #8d9dc2; color: #d5def3; box-shadow: 0 5px 0 #3d5287; cursor: not-allowed; }
.launch-button:focus-visible, a:focus-visible { outline: 3px solid #fff; outline-offset: 4px; }
.home-footer { text-align: center; color: #d0e2ff; font-size: .7rem; }
.home-footer a { color: #fff; text-decoration: underline; text-underline-offset: 3px; }
@media (max-width: 1100px), (max-height: 680px) {
  .home-v2 { height: auto; min-height: 100%; grid-template-rows: auto auto auto; }
  .mode-board { min-height: 440px; grid-template-rows: auto auto auto; }
}
@media (max-width: 1100px) {
  .mode-boards { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .home-v2 { padding: 4px; }
  .home-header { display: block; }
  .home-hero { gap: 12px; }
  .hero-codi { width: 66px; height: 88px; }
  .intro { max-width: none; margin-top: 14px; }
  .mode-boards { grid-template-columns: 1fr; }
  .mode-board { min-height: 300px; }
}
@media (prefers-reduced-motion: reduce) { .launch-button { transition: none; } }
</style>
