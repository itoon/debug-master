<template>
  <main class="home-v2" :data-motion="motionPhase" :class="{ 'has-details': detailMode, 'selection-made': selectionMade }">
    <h1 class="sr-only">{{ t('brand') }}</h1>

    <div v-show="!detailMode" ref="modeBoards" class="mode-boards" :class="[`count-${enabledModes.length}`, { 'modes-loading': !modesLoaded }]" :inert="motionPhase !== 'idle'">
      <section v-for="(mode, index) in enabledModes" :key="mode.id" class="mode-board" :class="[`mode-${mode.id}`, { 'selected-card': selectedMode?.id === mode.id, 'empty-board': emptyBoards[mode.id] && !singleMode }]"
        :data-mode-card="mode.id" :style="{ '--deal': index }"
        :aria-labelledby="`mode-${mode.id}-title`" :aria-busy="busy || motionPhase === 'entering' || motionPhase === 'leaving'"
        @click="openModeSetup(mode, $event)"
        @focusin="focusedMode = mode.id" @focusout="leaveCardFocus($event)">
        <!-- Keyboard target for the whole card; there is no visible Start button. -->
        <button type="button" class="card-launch-target" :disabled="busy || motionPhase !== 'idle'" aria-haspopup="dialog" :data-mode-launch="mode.id"
          :aria-label="t('home.modeDetail', { mode: t(mode.nameKey) })" />
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
          <!-- Visual cue only; the card's launch button carries the accessible name. -->
          <span class="start-cta" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M7 4.5v11l9-5.5z" /></svg>{{ t('home.startGame') }}</span>
        </figure>
        <ChallengeRanking class="card-ranking" :repository="repository" :board="boardFor(mode)" variant="space" podium credits hide-empty :placeholder="singleMode"
          :paused="motionPhase !== 'idle' || focusedMode === mode.id" @viewport-removed="clearDetachedFocus(mode.id)" @empty-change="emptyBoards[mode.id] = $event" />
      </section>
    </div>

    <ModeDetailsPanel v-if="detailMode" ref="detailPanel" :mode="detailMode" :repository="repository" :busy="busy || motionPhase !== 'open'" :from-rect="detailFromRect"
      @ready="detailReady" @back="closeDetails" @start="createPlayer" @select-player="selectPlayer" />
    <footer class="home-footer" :inert="motionPhase !== 'idle'">
      <div class="home-footer-info"><span>{{ t('ranking.bestPerPlayer') }}</span><span>{{ t('home.team') }}: <NuxtLink to="/review">{{ t('home.review') }}</NuxtLink> · <NuxtLink to="/elements">{{ t('home.elements') }}</NuxtLink> · <NuxtLink to="/players">{{ t('home.players') }}</NuxtLink> · <NuxtLink to="/modes">{{ t('home.modes') }}</NuxtLink></span></div>
      <button type="button" class="practice-button" :disabled="busy || motionPhase !== 'idle'" @click="emit('practice')"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8 4 3 5-5 3-3-5zm10 8 3 5-5 3-3-5zM4 19h5m6-15h5" /></svg>{{ t('practice.open') }}</button>
    </footer>
    <PlayerSetupDialog v-if="setupMode" ref="setupDialog" :mode="setupMode" :error="error" :busy="busy || motionPhase === 'leaving'"
      @close="closeSetup" @start="launch" @popup="emit('sound', 'popup')" />
    <ReturningPlayerDialog v-if="selectedPlayer" :player="selectedPlayer" :error="error" :busy="busy" @close="closePlayer" @create="createPlayer" @reuse="reusePlayer" />
  </main>
</template>

<script setup lang="ts">
import { homeConfig, type ChallengeMode, type ChallengeId } from "../data/home-config";
import { useModeSettings } from "../composables/useModeSettings";
import { useGameI18n } from "../composables/useGameI18n";
import type { ModeSettingsRepository, ScoreRepository, PlayerSetupInput } from "../storage/contracts";
import { formatClock, type RankingBoard } from "../utils/ranking";
import type { UiSoundEffect } from "../data/sound-effects";
import type { Score } from "../types/debug-game";

const props = defineProps<{ repository: ScoreRepository; modesRepository: ModeSettingsRepository; error?: string; busy?: boolean }>();
const emit = defineEmits<{ start: [player: PlayerSetupInput, mode: ChallengeMode]; resume: [scoreId: string, mode: ChallengeMode]; practice: []; resetError: []; unlockAudio: []; sound: [effect: UiSoundEffect] }>();
const { t } = useGameI18n();
// Saved on this device at /modes; hidden until read so SSR defaults never flash.
const { enabledModes, loaded: modesLoaded } = useModeSettings(props.modesRepository);
const singleMode = computed(() => enabledModes.value.length === 1);
const setupMode = ref<ChallengeMode | null>(null);
const selectedMode = ref<ChallengeMode | null>(null);
const selectionMade = ref(false);
const detailMode = ref<ChallengeMode | null>(null);
const detailFromRect = ref<{ left: number; top: number; width: number; height: number }>();
const detailPanel = ref<{ closeWithMotion: () => Promise<void>; focusStart: () => void; focusHeading: () => void } | null>(null);
const selectedPlayer = ref<Score | null>(null);
const motionPhase = ref<"idle" | "entering" | "open" | "leaving">("idle");
const modeBoards = ref<HTMLElement | null>(null);
const setupDialog = ref<{ closeWithMotion: () => Promise<void> } | null>(null);
const focusedMode = ref<ChallengeId | null>(null);
const emptyBoards = ref<Record<ChallengeId, boolean>>({ A: false, B: false, C: false });
const baseURL = useRuntimeConfig().app.baseURL;
let launchButton: HTMLButtonElement | null = null;
let playerButton: HTMLElement | null = null;
let cardAnimations: Animation[] = [];
let motionToken = 0;
let disposed = false;
let viewportSize = "";
let cardsReturning = false;

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function cancelCardMotion(): void {
  for (const animation of cardAnimations) animation.cancel();
  cardAnimations = [];
}
async function waitForCardMotion(token: number): Promise<void> {
  // Resize replaces the animations; don't mistake cancellation for completion.
  while (!disposed && token === motionToken) {
    const animations = cardAnimations;
    await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
    if (animations === cardAnimations) return;
  }
}
function reverseCards(): void {
  cardAnimations = cardAnimations.filter((animation) => {
    if (animation.effect?.getTiming().duration !== 0) return true;
    animation.cancel();
    return false;
  });
  for (const animation of cardAnimations) animation.reverse();
}
function snapshotCards() {
  return Array.from(modeBoards.value?.querySelectorAll<HTMLElement>("[data-mode-card]") ?? []).map((element) => ({
    element, rect: element.getBoundingClientRect(), transform: getComputedStyle(element).transform,
  }));
}
/** Keep the grid intact; move each card from its measured position. */
function positionCards(mode: ChallengeMode, snapshots = snapshotCards(), pinned = false): void {
  cancelCardMotion();
  const area = modeBoards.value?.getBoundingClientRect();
  if (!area) return;
  const centerX = (Math.max(16, area.left) + Math.min(window.innerWidth - 16, area.right)) / 2;
  const centerY = (Math.max(16, area.top) + Math.min(window.innerHeight - 16, area.bottom)) / 2;
  const chosenIndex = snapshots.findIndex(({ element }) => element.dataset.modeCard === mode.id);
  viewportSize = `${window.innerWidth}:${window.innerHeight}`;
  snapshots.forEach(({ element, rect, transform }, index) => {
    if (typeof element.animate !== "function") return;
    const matrix = new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
    const left = rect.left - matrix.e;
    const top = rect.top - matrix.f;
    const selected = index === chosenIndex;
    const x = selected ? centerX - (left + rect.width / 2)
      : index < chosenIndex ? -left - rect.width - 32 : window.innerWidth - left + 32;
    const y = selected ? centerY - (top + rect.height / 2) : 0;
    const scale = selected ? Math.min(1, (window.innerWidth - 48) / rect.width, (window.innerHeight - 48) / rect.height) : 1;
    const duration = reducedMotion() ? 0 : homeConfig.modeMotion.cardsMs;
    const animation = element.animate([
      { transform, opacity: 1 },
      { transform: `translate(${x}px, ${y}px) scale(${scale})`, opacity: selected ? 1 : 0 },
    ], { duration, easing: "cubic-bezier(.22, .8, .25, 1)", fill: "both" });
    void animation.finished.catch(() => {}); // Cancellation on resize/unmount is intentional.
    if (pinned) { animation.pause(); animation.currentTime = duration; }
    cardAnimations.push(animation);
  });
}
function recenterCards(): void {
  if (detailMode.value) return;
  if ((motionPhase.value !== "open" && motionPhase.value !== "leaving") || !selectedMode.value) return;
  const duration = Number(cardAnimations[0]?.effect?.getTiming().duration ?? homeConfig.modeMotion.cardsMs);
  const currentTime = cardAnimations[0]?.currentTime;
  const progress = duration > 0 && typeof currentTime === "number" ? Math.max(0, Math.min(1, currentTime / duration)) : 1;
  cancelCardMotion(); // Measure the natural positions after a responsive reflow.
  if (cardsReturning && reducedMotion()) return;
  positionCards(selectedMode.value, snapshotCards(), true);
  if (cardsReturning) {
    for (const animation of cardAnimations) animation.currentTime = Number(animation.effect?.getTiming().duration ?? 0) * progress;
    reverseCards();
  }
}
function thumbnailUrl(mode: ChallengeMode): string {
  return `${baseURL.endsWith('/') ? baseURL : `${baseURL}/`}${mode.thumbnail}`;
}
function boardFor(mode: ChallengeMode): RankingBoard {
  return { challengeId: mode.challengeId, setId: mode.levelSetId, mode: "timer", timeLimitSec: mode.timeLimit };
}
async function openModeSetup(mode: ChallengeMode, event: MouseEvent) {
  if (props.busy || motionPhase.value !== "idle") return;
  emit("unlockAudio"); // Unlock on the original pointer/keyboard gesture.
  emit("sound", "select");
  const snapshots = snapshotCards();
  selectionMade.value = true; // Do not replay the initial deal when detail restores the grid.
  const token = ++motionToken;
  emit("resetError");
  launchButton = (event.currentTarget as HTMLElement).querySelector<HTMLButtonElement>("[data-mode-launch]");
  selectedMode.value = mode;
  motionPhase.value = "entering";
  await nextTick();
  if (disposed || token !== motionToken) return;
  emit("sound", "transition");
  positionCards(mode, snapshots);
  await waitForCardMotion(token);
  if (disposed || token !== motionToken || motionPhase.value !== "entering") return;
  motionPhase.value = "open";
  if (viewportSize !== `${window.innerWidth}:${window.innerHeight}`) recenterCards();
  let hasPlayers = true;
  try { hasPlayers = props.repository.today(boardFor(mode), new Date(), 1).length > 0; } catch { /* Show the detail's storage error rather than pretend the board is empty. */ }
  if (hasPlayers) {
    const rect = modeBoards.value?.querySelector<HTMLElement>(`[data-mode-card="${mode.id}"]`)?.getBoundingClientRect();
    if (rect) detailFromRect.value = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    motionPhase.value = "entering";
    detailMode.value = mode;
  } else setupMode.value = mode;
}
function detailReady(): void {
  if (!disposed && detailMode.value && motionPhase.value === 'entering') motionPhase.value = 'open';
}
function selectPlayer(score: Score): void {
  if (props.busy || motionPhase.value !== 'open' || !detailMode.value || setupMode.value || selectedPlayer.value) return;
  playerButton = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  emit('resetError');
  selectedPlayer.value = score;
  emit('sound', 'popup');
}
async function closePlayer(): Promise<void> {
  if (props.busy) return;
  selectedPlayer.value = null;
  emit('resetError');
  await nextTick();
  if (disposed) return;
  if (playerButton?.isConnected) playerButton.focus({ preventScroll: true });
  else detailPanel.value?.focusHeading();
}
function createPlayer(): void {
  if (props.busy || motionPhase.value !== 'open' || !detailMode.value) return;
  selectedPlayer.value = null;
  emit('resetError');
  setupMode.value = detailMode.value;
}
function reusePlayer(): void {
  if (!props.busy && motionPhase.value === 'open' && detailMode.value && selectedPlayer.value) emit('resume', selectedPlayer.value.id, detailMode.value);
}
async function closeDetails(): Promise<void> {
  if (props.busy || motionPhase.value !== 'open' || !detailMode.value || setupMode.value || selectedPlayer.value) return;
  const token = ++motionToken;
  motionPhase.value = 'leaving';
  emit('sound', 'transitionBack');
  await detailPanel.value?.closeWithMotion();
  if (disposed || token !== motionToken) return;
  detailMode.value = null;
  await nextTick();
  if (disposed || token !== motionToken || !selectedMode.value) return;
  // The grid was display:none during detail. Measure its fresh responsive
  // layout, pin the chosen card at centre, then run the existing return motion.
  cancelCardMotion();
  positionCards(selectedMode.value, snapshotCards(), true);
  cardsReturning = true;
  if (!reducedMotion()) { reverseCards(); await waitForCardMotion(token); }
  if (disposed || token !== motionToken) return;
  cancelCardMotion();
  cardsReturning = false;
  detailFromRect.value = undefined;
  selectedMode.value = null;
  motionPhase.value = 'idle';
  await nextTick();
  if (!disposed && token === motionToken) launchButton?.focus({ preventScroll: true });
}
function leaveCardFocus(event: FocusEvent) {
  if (!(event.relatedTarget instanceof Node) || !(event.currentTarget as HTMLElement).contains(event.relatedTarget)) focusedMode.value = null;
}
function clearDetachedFocus(modeId: ChallengeId) {
  const activeCard = document.activeElement?.closest("[data-mode-card]");
  if (focusedMode.value === modeId && activeCard?.getAttribute("data-mode-card") !== modeId) focusedMode.value = null;
}
async function closeSetup() {
  if (props.busy || motionPhase.value !== "open") return;
  const token = ++motionToken;
  motionPhase.value = "leaving";
  await setupDialog.value?.closeWithMotion();
  if (disposed || token !== motionToken) return;
  setupMode.value = null;
  await nextTick();
  if (disposed || token !== motionToken) return;
  if (detailMode.value) {
    motionPhase.value = 'open';
    await nextTick();
    detailPanel.value?.focusStart();
    return;
  }
  emit("sound", "transitionBack");
  if (!reducedMotion()) {
    cardsReturning = true;
    reverseCards();
    await waitForCardMotion(token);
  }
  if (disposed || token !== motionToken) return;
  cancelCardMotion();
  cardsReturning = false;
  selectedMode.value = null;
  motionPhase.value = "idle";
  await nextTick();
  if (!disposed && token === motionToken) launchButton?.focus({ preventScroll: true });
}
function launch(player: PlayerSetupInput) {
  if (motionPhase.value === "open" && setupMode.value && !props.busy) emit("start", player, setupMode.value);
}
onMounted(() => window.addEventListener("resize", recenterCards));
watch([enabledModes, () => props.busy], ([modes, busy]) => {
  if (!selectedMode.value || modes.some(mode => mode.id === selectedMode.value?.id) || busy) return;
  motionToken += 1;
  cancelCardMotion();
  setupMode.value = null;
  selectedPlayer.value = null;
  detailMode.value = null;
  detailFromRect.value = undefined;
  selectedMode.value = null;
  cardsReturning = false;
  motionPhase.value = 'idle';
});
onBeforeUnmount(() => {
  disposed = true;
  motionToken += 1;
  cancelCardMotion();
  window.removeEventListener("resize", recenterCards);
});
</script>

<style scoped>
.home-v2 { height: 100%; display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 12px; max-width: 1640px; padding: 8px; margin: 0 auto; color: #fff; }
.mode-boards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; min-height: 0; }
.mode-board { --mode-accent: #ffdc53; position: relative; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 12px; min-width: 0; min-height: 0; padding: 0 14px 12px; border: 2px solid #5c86db; border-radius: 24px; color: #fff; background: linear-gradient(165deg, #183985, #0c2056); box-shadow: 0 14px 30px rgba(3, 15, 56, .35); cursor: pointer; transition: transform 240ms ease, border-color 240ms ease, box-shadow 240ms ease; }
.mode-A { border-color: #e3bd4b; }
/* Cards are dealt in left to right once the enabled modes are known. Backwards
   fill only, so hover lift and the selection motion own transform afterwards. */
.home-v2:not(.selection-made) .mode-boards:not(.modes-loading) .mode-board { animation: card-deal 620ms cubic-bezier(.16, 1, .3, 1) backwards; animation-delay: calc(var(--deal, 0) * 90ms); }
@keyframes card-deal { from { opacity: 0; transform: translateY(36px) scale(.94) rotate(calc((var(--deal, 0) - 1) * -1.5deg)); } }
.home-v2:not([data-motion="idle"]) .mode-boards { overflow: clip; }
.home-v2:not([data-motion="idle"]) .mode-board { transform: none; transition: none; }
.mode-board.selected-card { z-index: 2; }
.mode-B { --mode-accent: #94deff; }
.mode-C { --mode-accent: #d7bcff; }
.mode-board:hover, .mode-board:focus-within { transform: translateY(-4px); border-color: var(--mode-accent); box-shadow: 0 20px 36px rgba(2, 13, 51, .5), 0 0 22px color-mix(in srgb, var(--mode-accent) 18%, transparent); }
.mode-board[aria-busy="true"] { cursor: wait; }
.card-launch-target { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; border-radius: inherit; background: none; pointer-events: none; }
.card-launch-target:focus-visible { outline: 3px solid #fff; outline-offset: 5px; }
.mode-cover { position: relative; height: clamp(170px, 27dvh, 280px); margin: 0 -14px; overflow: hidden; border-radius: 21px 21px 0 0; background: #0b3a92; }
.cover-image { width: 100%; height: 100%; object-fit: cover; object-position: center 48%; transition: transform 650ms cubic-bezier(.2, .7, .2, 1), filter 300ms ease; }
.mode-board:hover .cover-image, .mode-board:focus-within .cover-image { transform: scale(1.06); filter: brightness(.72) saturate(1.1); }
.cover-sheen { position: absolute; inset: 0; background: linear-gradient(110deg, transparent 20%, rgba(255, 255, 255, .22) 45%, transparent 70%); transform: translateX(-120%); pointer-events: none; }
.mode-board:hover .cover-sheen { animation: cover-sweep 900ms ease both; }
/* Start cue: one large pill at the centre of the art, scaling in as the cover dims. */
.start-cta { --cta-y: 50%; position: absolute; top: var(--cta-y); left: 50%; z-index: 1; display: inline-flex; align-items: center; gap: 12px; padding: 10px 28px 10px 10px; border: 3px solid #fff; border-radius: 999px; background: var(--mode-accent); color: #0c2056; font-size: clamp(1.1rem, 1.45vw, 1.4rem); font-weight: 800; line-height: 1; white-space: nowrap; box-shadow: 0 12px 30px rgba(2, 13, 51, .55); opacity: 0; transform: translate(-50%, -50%) scale(.84); transition: opacity 220ms ease, transform 380ms cubic-bezier(.16, 1, .3, 1); pointer-events: none; }
.start-cta svg { width: 46px; height: 46px; flex: none; padding: 12px; border-radius: 50%; background: #0c2056; fill: var(--mode-accent); }
/* Cards with scores keep their title strip at the bottom of the art; centre in the space above it. */
.mode-board:not(.empty-board) .start-cta { --cta-y: calc((100% - 92px) / 2); }
.count-1 .mode-board .start-cta { --cta-y: calc((100% - 120px) / 2); }
.mode-board:hover .start-cta, .mode-board:focus-within .start-cta { opacity: 1; transform: translate(-50%, -50%); }
.mode-board:hover .start-cta svg { animation: start-nudge 900ms ease-in-out 380ms infinite; }
.count-1 .start-cta { gap: 14px; padding: 12px 34px 12px 12px; font-size: clamp(1.3rem, 1.9vw, 1.75rem); }
.count-1 .start-cta svg { width: 58px; height: 58px; padding: 15px; }
/* Touch screens have no hover: keep the cue visible so players know the card starts a game. */
@media (hover: none) { .start-cta { opacity: 1; transform: translate(-50%, -50%); } }
.home-v2:not([data-motion="idle"]) .start-cta { opacity: 0; transition: none; }
.mode-heading { position: absolute; inset: auto 0 0; display: grid; gap: 7px; padding: 34px 14px 12px; background: linear-gradient(transparent, rgba(4, 18, 57, .95)); }
.mode-heading h2 { display: flex; align-items: center; gap: 8px; margin: 0; color: #fff; font-size: clamp(1.15rem, 1.7vw, 1.65rem); font-weight: 800; line-height: 1.3; text-shadow: 0 2px 8px #081f52; }
.mode-heading :deep(.mode-badge) { width: 48px; flex: none; }
.mode-details { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 10px; color: #e1edff; font-size: .75rem; }
.difficulty-tag { padding: 3px 8px; border: 1px solid rgba(170, 198, 255, .6); border-radius: 8px; background: #102b67; color: var(--mode-accent); font-weight: 800; }
.time-tag { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; font-variant-numeric: tabular-nums; }
.time-tag svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
.card-ranking { min-height: 0; }
.modes-loading { visibility: hidden; }
.count-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; max-width: 1240px; justify-self: center; }
/* One enabled mode: the art at its own 4:3 shape beside a full leaderboard, sized to the viewport. */
.count-1 { --single-h: clamp(420px, calc(100dvh - 150px), 620px); grid-template-columns: minmax(0, max-content); justify-content: center; align-content: center; }
.count-1 .mode-board { height: var(--single-h); grid-template-columns: minmax(0, calc(var(--single-h) * 4 / 3)) minmax(340px, 420px); grid-template-rows: minmax(0, 1fr); gap: 24px; padding: 0 22px 0 0; }
.count-1 .mode-cover { height: 100%; margin: 0; border-radius: 21px 0 0 21px; }
.count-1 .mode-heading { gap: 12px; padding: 80px 28px 24px; }
.count-1 .mode-heading h2 { gap: 12px; font-size: clamp(1.7rem, 2.6vw, 2.5rem); }
.count-1 .mode-heading :deep(.mode-badge) { width: 64px; }
.count-1 .mode-details { gap: 8px 14px; font-size: .95rem; }
.count-1 .card-ranking { padding: 20px 0 16px; }
.mode-board.empty-board { grid-template-rows: minmax(0, 1fr); gap: 0; padding-bottom: 0; }
.empty-board .mode-cover { height: 100%; min-height: 0; border-radius: 21px; }
.empty-board .mode-heading { inset: 0; display: flex; flex-direction: column; justify-content: space-between; padding: 20px 18px 18px; background: linear-gradient(180deg, #020d31ed, #04123980 90px, transparent 200px), linear-gradient(0deg, #020d31f2, #04123999 75px, transparent 180px); }
.empty-board .mode-heading h2 { text-shadow: 0 2px 3px #020d31, 0 0 14px #020d31b3; }
.home-footer { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; color: #d0e2ff; font-size: .7rem; text-align: center; }
.home-footer-info { display: flex; justify-content: center; flex-wrap: wrap; gap: 4px 24px; }
.practice-button { display: inline-flex; justify-self: end; align-items: center; gap: 6px; min-height: 36px; padding: 6px 10px; border: 1px solid #84b4ff80; border-radius: 10px; background: #0b275c99; color: #e4efff; font: inherit; font-size: .75rem; font-weight: 800; cursor: pointer; }
.practice-button svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.practice-button:not(:disabled):hover { background: #1b4380; }
.practice-button:focus-visible { outline: 3px solid #ffe36b; outline-offset: 3px; }
.practice-button:disabled { opacity: .55; cursor: wait; }
.home-footer a { color: #fff; text-decoration: underline; text-underline-offset: 3px; }
a:focus-visible { outline: 3px solid #fff; outline-offset: 4px; }
@keyframes card-fade { from { opacity: 0; } }
@keyframes cover-sweep { to { transform: translateX(120%); } }
@keyframes start-nudge { 50% { transform: translateX(3px); } }
@media (max-width: 1100px) {
  .home-v2 { height: auto; min-height: 100%; grid-template-rows: auto auto; }
  .mode-boards { grid-template-columns: 1fr; }
  .mode-board { height: 760px; max-width: 620px; width: 100%; justify-self: center; }
  .mode-cover { height: clamp(220px, 35vw, 300px); }
  .count-1 { grid-template-columns: minmax(0, 1fr); }
  .count-1 .mode-board { height: 760px; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 12px; padding: 0 14px 12px; }
  .count-1 .mode-cover { height: clamp(220px, 35vw, 300px); margin: 0 -14px; border-radius: 21px 21px 0 0; }
  .count-1 .card-ranking { padding: 0; }
}
@media (max-height: 680px) and (min-width: 1101px) {
  .home-v2 { height: auto; min-height: 100%; grid-template-rows: auto auto; }
  .mode-board { height: 620px; }
}
@media (max-width: 520px) {
  .home-footer { grid-template-columns: 1fr; }
  .home-v2 { padding: 4px; }
  .mode-boards { gap: 18px; }
  .mode-board { height: 690px; }
  .mode-cover, .count-1 .mode-cover { height: 230px; }
  .count-1 .mode-board { height: 690px; }
  .start-cta, .count-1 .start-cta { gap: 10px; padding: 8px 22px 8px 8px; font-size: 1.05rem; }
  .start-cta svg, .count-1 .start-cta svg { width: 40px; height: 40px; padding: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .mode-board, .cover-image { transition: none; }
  .home-v2:not(.selection-made) .mode-boards:not(.modes-loading) .mode-board { animation: card-fade 200ms ease backwards; }
  .mode-board:hover, .mode-board:focus-within, .mode-board:hover .cover-image, .mode-board:focus-within .cover-image { transform: none; }
  .mode-board:hover .cover-sheen, .mode-board:hover .start-cta svg { animation: none; }
  .start-cta, .mode-board:hover .start-cta { transform: translate(-50%, -50%); transition: opacity 120ms linear; }
}
</style>
