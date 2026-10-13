<template>
  <main class="home-v2">
    <h1 class="sr-only">{{ t('brand') }}</h1>

    <div class="mode-boards">
      <section v-for="mode in homeConfig.modes" :key="mode.id" class="mode-board" :class="`mode-${mode.id}`"
        :data-mode-card="mode.id"
        :aria-labelledby="`mode-${mode.id}-title`" :aria-busy="busy"
        @click="openModeSetup(mode, $event)"
        @focusin="focusedMode = mode.id" @focusout="leaveCardFocus($event)">
        <!-- Keyboard target for the whole card; there is no visible Start button. -->
        <button type="button" class="card-launch-target" :disabled="busy" aria-haspopup="dialog" :data-mode-launch="mode.id"
          :aria-label="t('home.cardAction', { mode: t(mode.nameKey) })" />
        <figure class="mode-cover">
          <img class="cover-image" :src="thumbnailUrl(mode)" :alt="t('home.thumbnail', { mode: t(mode.nameKey) })" draggable="false" />
          <span class="cover-sheen" aria-hidden="true" />
          <figcaption class="mode-heading">
          <h2 :id="`mode-${mode.id}-title`"><ModeBadge :mode="mode.id" />{{ t(mode.nameKey) }}</h2>
          <div class="mode-details">
            <span class="difficulty-tag">{{ mode.id }} · {{ t(`difficulty.${mode.id}`) }}</span>
            <span>{{ t('home.levels', { from: mode.levelRange[0], to: mode.levelRange[1] }) }}</span>
            <span class="time-tag"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="M10 5v5l3 2" /></svg>{{ formatClock(mode.timeLimit * 1000) }}</span>
          </div>
          </figcaption>
        </figure>
        <ChallengeRanking class="card-ranking" :repository="repository" :board="boardFor(mode)" variant="space" podium credits
          :paused="setupMode !== null || focusedMode === mode.id" @viewport-removed="clearDetachedFocus(mode.id)" />
        <p class="card-hint">{{ t('home.cardHint') }} <span aria-hidden="true">↗</span></p>
      </section>
    </div>

    <footer class="home-footer"><span>{{ t('home.rules') }}</span><span>{{ t('home.team') }}: <NuxtLink to="/review">{{ t('home.review') }}</NuxtLink> · <NuxtLink to="/elements">{{ t('home.elements') }}</NuxtLink></span></footer>
    <PlayerSetupDialog v-if="setupMode" :mode="setupMode" :error="error" :busy="busy"
      @close="closeSetup" @start="launch" />
  </main>
</template>

<script setup lang="ts">
import { homeConfig, type ChallengeMode, type ChallengeId } from "../data/home-config";
import { useGameI18n } from "../composables/useGameI18n";
import type { ScoreRepository, PlayerSetupInput } from "../storage/contracts";
import { formatClock, type RankingBoard } from "../utils/ranking";

const props = defineProps<{ repository: ScoreRepository; error?: string; busy?: boolean }>();
const emit = defineEmits<{ start: [player: PlayerSetupInput, mode: ChallengeMode]; resetError: [] }>();
const { t } = useGameI18n();
const setupMode = ref<ChallengeMode | null>(null);
const focusedMode = ref<ChallengeId | null>(null);
const baseURL = useRuntimeConfig().app.baseURL;
let launchButton: HTMLButtonElement | null = null;
function thumbnailUrl(mode: ChallengeMode): string {
  return `${baseURL.endsWith('/') ? baseURL : `${baseURL}/`}${mode.thumbnail}`;
}
function boardFor(mode: ChallengeMode): RankingBoard {
  return { challengeId: mode.challengeId, setId: homeConfig.levelSetId, mode: "timer", timeLimitSec: mode.timeLimit };
}
function openModeSetup(mode: ChallengeMode, event: MouseEvent) {
  if (props.busy || setupMode.value) return;
  emit("resetError");
  launchButton = (event.currentTarget as HTMLElement).querySelector<HTMLButtonElement>("[data-mode-launch]");
  setupMode.value = mode;
}
function leaveCardFocus(event: FocusEvent) {
  if (!(event.relatedTarget instanceof Node) || !(event.currentTarget as HTMLElement).contains(event.relatedTarget)) focusedMode.value = null;
}
function clearDetachedFocus(modeId: ChallengeId) {
  const activeCard = document.activeElement?.closest("[data-mode-card]");
  if (focusedMode.value === modeId && activeCard?.getAttribute("data-mode-card") !== modeId) focusedMode.value = null;
}
async function closeSetup() {
  setupMode.value = null;
  await nextTick();
  launchButton?.focus();
}
function launch(player: PlayerSetupInput) {
  if (setupMode.value) emit("start", player, setupMode.value);
}
</script>

<style scoped>
.home-v2 { height: 100%; display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 12px; max-width: 1640px; padding: 8px; margin: 0 auto; color: #fff; }
.mode-boards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; min-height: 0; }
.mode-board { --mode-accent: #ffdc53; position: relative; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 12px; min-width: 0; min-height: 0; padding: 0 14px 12px; border: 2px solid #5c86db; border-radius: 24px; color: #fff; background: linear-gradient(165deg, #183985, #0c2056); box-shadow: 0 14px 30px rgba(3, 15, 56, .35); cursor: pointer; transition: transform 240ms ease, border-color 240ms ease, box-shadow 240ms ease; }
.mode-A { border-color: #e3bd4b; }
.mode-B { --mode-accent: #94deff; }
.mode-C { --mode-accent: #d7bcff; }
.mode-board:hover, .mode-board:focus-within { transform: translateY(-4px); border-color: var(--mode-accent); box-shadow: 0 20px 36px rgba(2, 13, 51, .5), 0 0 22px color-mix(in srgb, var(--mode-accent) 18%, transparent); }
.mode-board[aria-busy="true"] { cursor: wait; }
.card-launch-target { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; border-radius: inherit; background: none; pointer-events: none; }
.card-launch-target:focus-visible { outline: 3px solid #fff; outline-offset: 5px; }
.mode-cover { position: relative; height: clamp(170px, 27dvh, 280px); margin: 0 -14px; overflow: hidden; border-radius: 21px 21px 0 0; background: #0b3a92; }
.cover-image { width: 100%; height: 100%; object-fit: cover; object-position: center 48%; transition: transform 650ms cubic-bezier(.2, .7, .2, 1); }
.mode-board:hover .cover-image, .mode-board:focus-within .cover-image { transform: scale(1.06); }
.cover-sheen { position: absolute; inset: 0; background: linear-gradient(110deg, transparent 20%, rgba(255, 255, 255, .22) 45%, transparent 70%); transform: translateX(-120%); pointer-events: none; }
.mode-board:hover .cover-sheen { animation: cover-sweep 900ms ease both; }
.mode-heading { position: absolute; inset: auto 0 0; display: grid; gap: 7px; padding: 34px 14px 12px; background: linear-gradient(transparent, rgba(4, 18, 57, .95)); }
.mode-heading h2 { display: flex; align-items: center; gap: 8px; margin: 0; color: #fff; font-size: clamp(1.15rem, 1.7vw, 1.65rem); font-weight: 800; line-height: 1.3; text-shadow: 0 2px 8px #081f52; }
.mode-heading :deep(.mode-badge) { width: 48px; flex: none; }
.mode-details { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 10px; color: #e1edff; font-size: .75rem; }
.difficulty-tag { padding: 3px 8px; border: 1px solid rgba(170, 198, 255, .6); border-radius: 8px; background: #102b67; color: var(--mode-accent); font-weight: 800; }
.time-tag { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; font-variant-numeric: tabular-nums; }
.time-tag svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
.card-ranking { min-height: 0; }
.card-hint { display: flex; justify-content: center; align-items: center; gap: 10px; margin: 0; color: #e1d597; font-size: .78rem; font-weight: 700; }
.card-hint span { transition: transform 240ms ease; }
.mode-board:hover .card-hint span { transform: translate(3px, -3px); }
.home-footer { display: flex; justify-content: center; flex-wrap: wrap; gap: 4px 24px; color: #d0e2ff; font-size: .7rem; text-align: center; }
.home-footer a { color: #fff; text-decoration: underline; text-underline-offset: 3px; }
a:focus-visible { outline: 3px solid #fff; outline-offset: 4px; }
@keyframes cover-sweep { to { transform: translateX(120%); } }
@media (max-width: 1100px) {
  .home-v2 { height: auto; min-height: 100%; grid-template-rows: auto auto; }
  .mode-boards { grid-template-columns: 1fr; }
  .mode-board { height: 760px; max-width: 620px; width: 100%; justify-self: center; }
  .mode-cover { height: clamp(220px, 35vw, 300px); }
}
@media (max-height: 680px) and (min-width: 1101px) {
  .home-v2 { height: auto; min-height: 100%; grid-template-rows: auto auto; }
  .mode-board { height: 620px; }
}
@media (max-width: 520px) {
  .home-v2 { padding: 4px; }
  .mode-boards { gap: 18px; }
  .mode-board { height: 690px; }
  .mode-cover { height: 230px; }
}
@media (prefers-reduced-motion: reduce) {
  .mode-board, .cover-image, .card-hint span { transition: none; }
  .mode-board:hover, .mode-board:focus-within, .mode-board:hover .cover-image, .mode-board:focus-within .cover-image, .mode-board:hover .card-hint span { transform: none; }
  .mode-board:hover .cover-sheen { animation: none; }
}
</style>
