<template>
  <main class="home-v2" :data-motion="motionPhase" :inert="entering" :class="{ 'has-details': detailMode, 'selection-made': selectionMade }"
    :style="{ '--card-in-ms': `${homeConfig.sleepScreen.cardInMs}ms`, '--card-stagger-ms': `${homeConfig.sleepScreen.cardStaggerMs}ms` }">
    <h1 class="sr-only">{{ t('brand') }}</h1>

    <div v-show="!detailMode" ref="modeBoards" class="mode-boards" :class="[`count-${enabledModes.length}`, { 'modes-loading': !modesLoaded }]" :inert="motionPhase !== 'idle'">
      <section v-for="(mode, index) in enabledModes" :key="mode.id" class="mode-board" :class="[`mode-${mode.id}`, { 'selected-card': selectedMode?.id === mode.id, 'has-history': !emptyBoards[mode.id], 'empty-board': emptyBoards[mode.id] && !singleMode, 'is-mouse-hovered': hoveredMode === mode.id && motionPhase === 'idle' && !entering }]"
        :data-mode-card="mode.id" :style="{ '--deal': index }"
        :aria-labelledby="`mode-${mode.id}-title`" :aria-busy="busy || motionPhase === 'entering' || motionPhase === 'leaving'"
        @click="openModeSetup(mode, $event)"
        @pointerenter="updateCardHover(mode.id, $event)" @pointermove="updateCardHover(mode.id, $event)" @pointerleave="leaveCardHover(mode.id)"
        @focusin="focusedMode = mode.id" @focusout="leaveCardFocus($event)">
        <!-- Keyboard target for the whole card; there is no visible Start button. -->
        <button type="button" class="card-launch-target" :disabled="busy || motionPhase !== 'idle'" aria-haspopup="dialog" :data-mode-launch="mode.id"
          :aria-label="t(mobilePicker ? 'home.cardAction' : 'home.modeDetail', { mode: t(mode.nameKey) })" />
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
        <!-- Visual cue only; the card's launch button carries the accessible name. -->
        <span class="start-cta" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M7 4.5v11l9-5.5z" /></svg>{{ t('home.startGame') }}</span>
        <span class="mobile-card-play" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M7 4.5v11l9-5.5z" /></svg></span>
        <ChallengeRanking class="card-ranking" :repository="repository" :board="boardFor(mode)" variant="space" podium credits hide-empty :placeholder="singleMode"
          :paused="mobilePicker || motionPhase !== 'idle' || focusedMode === mode.id" @viewport-removed="clearDetachedFocus(mode.id)" @empty-change="emptyBoards[mode.id] = $event" />
      </section>
    </div>

    <ModeDetailsPanel v-if="currentDetailMode" ref="detailPanel" :mode="currentDetailMode" :repository="repository" :busy="busy || motionPhase !== 'open'" :from-rect="detailFromRect"
      @ready="detailReady" @back="closeDetails" @start="createPlayer" @select-player="selectPlayer" />
    <footer class="home-footer" :inert="motionPhase !== 'idle'">
      <div class="home-footer-left">
        <button type="button" class="practice-button rest-button" :disabled="busy || motionPhase !== 'idle'" @click="emit('sleep')"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></svg>{{ t('sleep.back') }}</button>
        <button type="button" class="practice-button join-room-button" :disabled="busy || motionPhase !== 'idle'" aria-haspopup="dialog" @click="openJoinRoom"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4h6v16h-6M3 12h12m-4-4 4 4-4 4" /></svg>{{ t('live.joinRoom') }}</button>
      </div>
      <div class="home-footer-info"><span>{{ t('home.team') }}: <NuxtLink to="/review">{{ t('home.review') }}</NuxtLink> · <NuxtLink to="/elements">{{ t('home.elements') }}</NuxtLink> · <NuxtLink to="/players">{{ t('home.players') }}</NuxtLink> · <NuxtLink to="/modes">{{ t('home.modes') }}</NuxtLink></span></div>
      <button type="button" class="practice-button" :disabled="busy || motionPhase !== 'idle'" @click="emit('practice')"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8 4 3 5-5 3-3-5zm10 8 3 5-5 3-3-5zM4 19h5m6-15h5" /></svg>{{ t('practice.open') }}</button>
    </footer>
    <LiveJoinDialog v-if="showJoinRoom" @close="showJoinRoom = false" />
    <PlayerSetupDialog v-if="setupMode" ref="setupDialog" :mode="setupMode" :repository="repository" :error="error" :busy="busy || motionPhase === 'leaving'"
      @close="closeSetup" @start="launch" @edit="emit('resetError')" @popup="emit('sound', 'popup')" />
    <ReturningPlayerDialog v-if="selectedPlayer" :player="selectedPlayer" :latest-score="selectedLatestScore" :error="error" :busy="busy" @close="closePlayer" @create="createPlayer" @reuse="reusePlayer" />
  </main>
</template>

<script setup lang="ts">
import { homeConfig, type ChallengeMode, type ChallengeId } from "../data/home-config";
import { useModeSettings } from "../composables/useModeSettings";
import { useGameI18n } from "../composables/useGameI18n";
import type { ModeSettingsRepository, ScoreRepository, PlayerSetupInput } from "../storage/contracts";
import { formatClock, bestPlayerScore, latestPlayerScore, scorePlayerKey, type RankingBoard } from "../utils/ranking";
import type { UiSoundEffect } from "../data/sound-effects";
import type { Score } from "../types/debug-game";
import LiveJoinDialog from "./live/LiveJoinDialog.vue";

const props = defineProps<{ repository: ScoreRepository; modesRepository: ModeSettingsRepository; error?: string; busy?: boolean; entering?: boolean }>();
const emit = defineEmits<{ start: [player: PlayerSetupInput, mode: ChallengeMode]; resume: [scoreId: string, mode: ChallengeMode]; practice: []; sleep: []; resetError: []; unlockAudio: []; sound: [effect: UiSoundEffect] }>();
const { t } = useGameI18n();
// Saved on this device at /modes; hidden until read so SSR defaults never flash.
const { enabledModes, loaded: modesLoaded } = useModeSettings(props.modesRepository);
const singleMode = computed(() => enabledModes.value.length === 1);
// Same breakpoint as the compact picker CSS below. Keep ranking subscriptions
// intact, but pause hidden credits and use direct setup for backup phone play.
const mobilePicker = ref(false);
const showJoinRoom = ref(false);
function openJoinRoom(): void {
  if (props.busy || motionPhase.value !== 'idle') return;
  showJoinRoom.value = true;
}
let mobilePickerQuery: MediaQueryList | undefined;
function syncMobilePicker(): void { mobilePicker.value = mobilePickerQuery?.matches ?? false; }
const setupMode = ref<ChallengeMode | null>(null);
const selectedMode = ref<ChallengeMode | null>(null);
const selectionMade = ref(false);
const detailMode = ref<ChallengeMode | null>(null);
const currentDetailMode = computed(() => enabledModes.value.find(mode => mode.id === detailMode.value?.id) ?? detailMode.value);
const detailFromRect = ref<{ left: number; top: number; width: number; height: number }>();
const detailPanel = ref<{ closeWithMotion: (rect?: { left: number; top: number; width: number; height: number }) => Promise<void>; getElement: () => HTMLElement | null; focusStart: () => void; focusHeading: () => void } | null>(null);
const selectionHasHistory = ref(false);
const selectedPlayer = ref<Score | null>(null);
const selectedLatestScore = ref<Score | null>(null);
const motionPhase = ref<"idle" | "entering" | "open" | "leaving">("idle");
const hoveredMode = ref<ChallengeId | null>(null);
function updateCardHover(modeId: ChallengeId, event: PointerEvent): void {
  hoveredMode.value = event.pointerType === 'mouse' && motionPhase.value === 'idle' && !props.entering ? modeId : null;
}
function leaveCardHover(modeId: ChallengeId): void {
  if (hoveredMode.value === modeId) hoveredMode.value = null;
}
watch(motionPhase, (phase) => { if (phase !== 'idle') hoveredMode.value = null; });
const modeBoards = ref<HTMLElement | null>(null);
const setupDialog = ref<{ closeWithMotion: () => Promise<void> } | null>(null);
const focusedMode = ref<ChallengeId | null>(null);
const emptyBoards = ref<Record<ChallengeId, boolean>>({ A: false, B: false, C: false });
const baseURL = useRuntimeConfig().app.baseURL;
let launchButton: HTMLButtonElement | null = null;
let playerButton: HTMLElement | null = null;
let cardAnimations: Animation[] = [];
let expandedCover: HTMLElement | null = null;
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
  expandedCover?.remove();
  expandedCover = null;
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
    const x = selected ? selectionHasHistory.value ? 0 : centerX - (left + rect.width / 2)
      : index < chosenIndex ? -left - rect.width - 32 : window.innerWidth - left + 32;
    const y = selected && !selectionHasHistory.value ? centerY - (top + rect.height / 2) : 0;
    const scale = selected && !selectionHasHistory.value ? Math.min(1, (window.innerWidth - 48) / rect.width, (window.innerHeight - 48) / rect.height) : 1;
    const duration = reducedMotion() ? 0 : homeConfig.modeMotion.cardsMs;
    const animation = element.animate([
      { transform, opacity: 1 },
      { transform: `translate(${x}px, ${y}px) scale(${scale})`, opacity: selected ? 1 : 0 },
    ], { duration, easing: "cubic-bezier(.22, .8, .25, 1)", fill: "both" });
    void animation.finished.catch(() => {}); // Cancellation on resize/unmount is intentional.
    if (pinned) { animation.pause(); animation.currentTime = duration; }
    cardAnimations.push(animation);
    if (selected && selectionHasHistory.value) expandSelectedCover(element, duration, pinned);
  });
}
/** A visual copy expands without changing the card/grid's layout geometry. */
function expandSelectedCover(card: HTMLElement, duration: number, pinned: boolean): void {
  const source = card.querySelector<HTMLElement>('.mode-cover');
  if (!source) return;
  const preview = source.cloneNode(true) as HTMLElement;
  preview.removeAttribute('id');
  preview.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
  preview.setAttribute('aria-hidden', 'true');
  preview.inert = true;
  preview.classList.add('expanded-cover-preview');
  Object.assign(preview.style, { position: 'absolute', margin: '0', left: `${source.offsetLeft}px`, top: `${source.offsetTop}px`, width: `${source.offsetWidth}px`, height: `${source.offsetHeight}px`, borderRadius: '21px', zIndex: '3', pointerEvents: 'none' });
  const image = preview.querySelector<HTMLElement>('.cover-image');
  if (image) { image.style.transform = 'none'; image.style.filter = 'none'; }
  card.appendChild(preview);
  expandedCover = preview;
  const options: KeyframeAnimationOptions = { duration, easing: 'cubic-bezier(.22, .8, .25, 1)', fill: 'both' };
  const expansion = preview.animate([
    { left: `${source.offsetLeft}px`, top: `${source.offsetTop}px`, width: `${source.offsetWidth}px`, height: `${source.offsetHeight}px` },
    { left: '0px', top: '0px', width: `${card.clientWidth}px`, height: `${card.clientHeight}px` },
  ], options);
  const ranking = card.querySelector<HTMLElement>('.card-ranking');
  const effects = [expansion, ...(ranking ? [ranking.animate([{ opacity: 1 }, { opacity: 0 }], options)] : [])];
  for (const animation of effects) {
    void animation.finished.catch(() => {});
    if (pinned) { animation.pause(); animation.currentTime = duration; }
    cardAnimations.push(animation);
  }
}
function recenterCards(): void {
  if (detailMode.value) return;
  if ((motionPhase.value !== "open" && motionPhase.value !== "leaving" && !(motionPhase.value === 'entering' && selectionHasHistory.value)) || !selectedMode.value) return;
  if (motionPhase.value === 'entering') {
    cancelCardMotion();
    positionCards(selectedMode.value, snapshotCards());
    return;
  }
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
  return { challengeId: mode.challengeId, setId: mode.levelSetId, mode: "timer", timeLimitSec: mode.timeLimit, difficulty: mode.difficulty, scoringStrategy: mode.scoringStrategy };
}
async function openModeSetup(mode: ChallengeMode, event: MouseEvent) {
  if (props.busy || motionPhase.value !== "idle") return;
  emit("unlockAudio"); // Unlock on the original pointer/keyboard gesture.
  emit("sound", "select");
  let hasPlayers = true;
  try { hasPlayers = props.repository.today(boardFor(mode), new Date(), 1).length > 0; } catch { /* Preserve the detail storage-error state. */ }
  const showDetails = hasPlayers && !mobilePicker.value;
  selectionHasHistory.value = showDetails;
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
  if (showDetails) {
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
  selectedLatestScore.value = null;
  try {
    const board = boardFor(detailMode.value);
    const history = props.repository.list();
    const playerKey = scorePlayerKey(score);
    selectedLatestScore.value = latestPlayerScore(history, board, playerKey) ?? null;
    selectedPlayer.value = bestPlayerScore(history, board, playerKey) ?? score;
  } catch { selectedPlayer.value = score; /* Keep the profile usable on a storage error. */ }
  emit('sound', 'popup');
}
async function closePlayer(): Promise<void> {
  if (props.busy) return;
  selectedPlayer.value = null;
  selectedLatestScore.value = null;
  emit('resetError');
  await nextTick();
  if (disposed) return;
  if (playerButton?.isConnected) playerButton.focus({ preventScroll: true });
  else detailPanel.value?.focusHeading();
}
function createPlayer(): void {
  if (props.busy || motionPhase.value !== 'open' || !detailMode.value) return;
  selectedPlayer.value = null;
  selectedLatestScore.value = null;
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
  // Temporarily remove detail from flow to measure the restored Home grid.
  // Restore styles synchronously before any paint; this also handles resize.
  cancelCardMotion();
  const grid = modeBoards.value;
  const detail = detailPanel.value?.getElement();
  let returnRect: { left: number; top: number; width: number; height: number } | undefined;
  if (grid && detail && selectedMode.value) {
    const saved = { display: grid.style.display, position: detail.style.position, width: detail.style.width, height: detail.style.height };
    const bounds = detail.getBoundingClientRect();
    Object.assign(detail.style, { position: 'absolute', width: `${bounds.width}px`, height: `${bounds.height}px` });
    grid.style.display = '';
    const rect = grid.querySelector<HTMLElement>(`[data-mode-card="${selectedMode.value.id}"]`)?.getBoundingClientRect();
    if (rect) returnRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    grid.style.display = saved.display;
    Object.assign(detail.style, { position: saved.position, width: saved.width, height: saved.height });
  }
  await detailPanel.value?.closeWithMotion(returnRect);
  if (disposed || token !== motionToken) return;
  detailMode.value = null;
  await nextTick();
  if (disposed || token !== motionToken || !selectedMode.value) return;
  // The grid was display:none during detail. Measure its fresh responsive
  // layout, pin the expanded card in its original slot, then reverse stage one.
  cancelCardMotion();
  positionCards(selectedMode.value, snapshotCards(), true);
  cardsReturning = true;
  if (!reducedMotion()) { reverseCards(); await waitForCardMotion(token); }
  if (disposed || token !== motionToken) return;
  cancelCardMotion();
  cardsReturning = false;
  detailFromRect.value = undefined;
  selectionHasHistory.value = false;
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
  selectionHasHistory.value = false;
  await nextTick();
  if (!disposed && token === motionToken) launchButton?.focus({ preventScroll: true });
}
function launch(player: PlayerSetupInput) {
  if (motionPhase.value === "open" && setupMode.value && !props.busy) emit("start", player, setupMode.value);
}
async function focusFirstMode(): Promise<void> {
  await nextTick();
  if (!disposed && motionPhase.value === 'idle') modeBoards.value?.querySelector<HTMLButtonElement>('[data-mode-launch]:not(:disabled)')?.focus({ preventScroll: true });
}
defineExpose({ focusFirstMode });
onMounted(() => {
  mobilePickerQuery = window.matchMedia('(max-width: 639px), (orientation: landscape) and (max-width: 920px) and (max-height: 560px)');
  syncMobilePicker();
  mobilePickerQuery.addEventListener('change', syncMobilePicker);
  window.addEventListener("resize", recenterCards);
});
watch([enabledModes, () => props.busy], ([modes, busy]) => {
  const selected = selectedMode.value;
  if (!selected || busy) return;
  if (modes.some(mode => mode.id === selected.id && mode.timeLimit === selected.timeLimit)) return;
  motionToken += 1;
  cancelCardMotion();
  setupMode.value = null;
  selectedPlayer.value = null;
  selectedLatestScore.value = null;
  detailMode.value = null;
  detailFromRect.value = undefined;
  selectionHasHistory.value = false;
  selectedMode.value = null;
  cardsReturning = false;
  motionPhase.value = 'idle';
});
onBeforeUnmount(() => {
  disposed = true;
  motionToken += 1;
  cancelCardMotion();
  window.removeEventListener("resize", recenterCards);
  mobilePickerQuery?.removeEventListener('change', syncMobilePicker);
});
</script>

<style scoped>
.home-v2 { height: 100%; display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 12px; max-width: 1640px; padding: 8px; margin: 0 auto; color: #fff; }
.mode-boards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; min-height: 0; }
.mode-board { --mode-accent: #ffdc53; position: relative; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 12px; min-width: 0; min-height: 0; padding: 0 14px 12px; border: 2px solid #5c86db; border-radius: 24px; color: #fff; background: linear-gradient(165deg, #183985, #0c2056); box-shadow: 0 14px 30px rgba(3, 15, 56, .35); cursor: pointer; transition: transform 240ms ease, border-color 240ms ease, box-shadow 240ms ease; }
.mode-A { border-color: #e3bd4b; }
.mode-board { --cover-height: clamp(170px, 27dvh, 280px); --cta-y: calc(var(--cover-height) - 14px); }
/* Cards are dealt in left to right once the enabled modes are known. Backwards
   fill only, so hover lift and the selection motion own transform afterwards. */
.home-v2:not(.selection-made) .mode-boards:not(.modes-loading) .mode-board { animation: card-deal var(--card-in-ms) cubic-bezier(.16, 1, .3, 1) backwards; animation-delay: calc(var(--deal, 0) * var(--card-stagger-ms)); }
@keyframes card-deal { from { opacity: 0; transform: translate3d(0, 42px, 0); } }
.home-v2:not([data-motion="idle"]) .mode-boards { overflow: clip; }
.home-v2:not([data-motion="idle"]) .mode-board { transform: none; transition: none; }
.mode-board.selected-card { z-index: 2; }
.mode-B { --mode-accent: #94deff; }
.mode-C { --mode-accent: #d7bcff; }
.mode-board:hover, .mode-board:focus-within { transform: translateY(-4px); border-color: var(--mode-accent); box-shadow: 0 20px 36px rgba(2, 13, 51, .5), 0 0 22px color-mix(in srgb, var(--mode-accent) 18%, transparent); }
.mode-board[aria-busy="true"] { cursor: wait; }
.card-launch-target { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; border-radius: inherit; background: none; pointer-events: none; }
.card-launch-target:focus-visible { outline: 3px solid #fff; outline-offset: 5px; }
.mode-cover { position: relative; height: var(--cover-height); margin: 0 -14px; overflow: hidden; border-radius: 21px 21px 0 0; background: #0b3a92; }
.cover-image { width: 100%; height: 100%; object-fit: cover; object-position: center 48%; transition: transform 650ms cubic-bezier(.2, .7, .2, 1), filter 300ms ease; }
.mode-board.is-mouse-hovered .cover-image { transform: scale(1.06); filter: brightness(.72) saturate(1.1); }
.cover-sheen { position: absolute; inset: 0; background: linear-gradient(110deg, transparent 20%, rgba(255, 255, 255, .22) 45%, transparent 70%); transform: translateX(-120%); pointer-events: none; }
.mode-board:hover .cover-sheen { animation: cover-sweep 900ms ease both; }
/* Centre the cue across the lower thumbnail edge, as in the supplied layout. */
.start-cta { --cta-scale: 1; position: absolute; top: var(--cta-y); left: 50%; z-index: 1; display: inline-flex; align-items: center; gap: 12px; padding: 10px 28px 10px 10px; border: 3px solid #fff; border-radius: 999px; background: var(--mode-accent); color: #0c2056; font-size: clamp(1.1rem, 1.45vw, 1.4rem); font-weight: 800; line-height: 1; white-space: nowrap; box-shadow: 0 12px 30px rgba(2, 13, 51, .55); opacity: 0; transform: translate(-50%, -50%) scale(calc(var(--cta-scale) * .84)); transition: opacity 220ms ease, transform 380ms cubic-bezier(.16, 1, .3, 1); pointer-events: none; }
.start-cta svg { width: 46px; height: 46px; flex: none; padding: 12px; border-radius: 50%; background: #0c2056; fill: var(--mode-accent); }
.mode-board.has-history .start-cta { --cta-scale: .704; }
.empty-board .start-cta { --cta-y: 50%; }
.count-1 .mode-board .start-cta { --cta-y: calc(100% - 156px); left: calc(var(--single-h) * 2 / 3); }
.count-1 .mode-board:not(.has-history) .start-cta { --cta-y: 50%; }
.mode-board.is-mouse-hovered .start-cta { opacity: 1; transform: translate(-50%, -50%) scale(var(--cta-scale)); pointer-events: auto; }
.mode-board.is-mouse-hovered .start-cta svg { animation: start-nudge 900ms ease-in-out 380ms infinite; }
.count-1 .start-cta { gap: 14px; padding: 12px 34px 12px 12px; font-size: clamp(1.3rem, 1.9vw, 1.75rem); }
.count-1 .start-cta svg { width: 58px; height: 58px; padding: 15px; }
.home-v2:not([data-motion="idle"]) .start-cta { opacity: 0; transition: none; }
.mode-heading { position: absolute; inset: auto 0 0; display: grid; gap: 7px; padding: 34px 14px 12px; background: linear-gradient(transparent, rgba(4, 18, 57, .95)); }
.mode-heading h2 { display: flex; align-items: center; gap: 8px; margin: 0; color: #fff; font-size: clamp(1.15rem, 1.7vw, 1.65rem); font-weight: 800; line-height: 1.3; text-shadow: 0 2px 8px #081f52; }
.mode-heading :deep(.mode-badge) { width: 48px; flex: none; }
.mode-details { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 10px; color: #e1edff; font-size: .75rem; }
.difficulty-tag { padding: 3px 8px; border: 1px solid rgba(170, 198, 255, .6); border-radius: 8px; background: #102b67; color: var(--mode-accent); font-weight: 800; }
.time-tag { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; font-variant-numeric: tabular-nums; }
.time-tag svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
.card-ranking { min-height: 0; }
.mobile-card-play { display: none; }
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
.home-footer { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; color: #d0e2ff; font-size: .7rem; text-align: center; }
.home-footer-left { display: flex; align-items: center; gap: 8px; }
.practice-button.rest-button { justify-self: start; }
.home-v2.sleep-switch-leave-active { transition: opacity 220ms ease; }
.home-v2.sleep-switch-leave-to { opacity: 0; }
.home-v2.sleep-switch-enter-active .home-footer { animation: card-fade 220ms ease backwards; animation-delay: calc(var(--card-stagger-ms) * 2); }
.home-v2.sleep-switch-leave-active { pointer-events: none; }
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
  .mode-board { --cover-height: clamp(220px, 35vw, 300px); }
  .count-1 { grid-template-columns: minmax(0, 1fr); }
  .count-1 .mode-board { height: 760px; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 12px; padding: 0 14px 12px; }
  .count-1 .mode-cover { height: var(--cover-height); margin: 0 -14px; border-radius: 21px 21px 0 0; }
  .count-1 .mode-board .start-cta { --cta-y: calc(var(--cover-height) - 14px); left: 50%; }
  .count-1 .mode-board:not(.has-history) .start-cta { --cta-y: calc(var(--cover-height) / 2); }
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
  .mode-board { --cover-height: 230px; }
  .count-1 .mode-board { height: 690px; }
  .start-cta, .count-1 .start-cta { gap: 10px; padding: 8px 22px 8px 8px; font-size: 1.05rem; }
  .start-cta svg, .count-1 .start-cta svg { width: 40px; height: 40px; padding: 10px; }
}
/* Phones are a secondary event entry point: every enabled mode and practice
   stay on the first screen. Keep desktop podiums/cards untouched. */
@media (max-width: 639px), (orientation: landscape) and (max-width: 920px) and (max-height: 560px) {
  .home-v2 { height: 100%; min-height: 380px; grid-template-rows: minmax(0, 1fr) auto; padding: 0; gap: 8px; }
  .mode-boards { --picker-count: 3; grid-template-columns: minmax(0, 1fr); grid-template-rows: repeat(var(--picker-count), minmax(104px, 1fr)); gap: 8px; width: 100%; max-width: none; align-content: stretch; }
  .mode-boards.count-1 { --picker-count: 1; }
  .mode-boards.count-2 { --picker-count: 2; }
  .mode-boards .mode-board { height: 100%; max-width: none; grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); padding: 0; gap: 0; border-radius: 16px; overflow: hidden; }
  .mode-boards .mode-board:hover, .mode-boards .mode-board:focus-within { transform: none; }
  .mode-boards .card-launch-target:focus-visible { outline-offset: -5px; }
  .mode-boards .mode-cover { height: 100%; min-height: 0; margin: 0; border-radius: 13px; }
  .mode-boards .cover-image { object-position: center 45%; }
  .mode-boards .mode-heading { inset: 0; display: flex; flex-direction: column; justify-content: space-between; gap: 6px; padding: 12px; background: linear-gradient(180deg, #020d31d9, #04123944 55%, #020d31ed); }
  .mode-boards .mode-heading h2 { gap: 6px; padding-right: 40px; font-size: clamp(1rem, 4.5vw, 1.25rem); line-height: 1.2; }
  .mode-boards .mode-heading :deep(.mode-badge) { width: 30px; }
  .mode-boards .mode-details { gap: 4px 8px; font-size: .65rem; }
  .mode-boards .difficulty-tag { padding: 2px 6px; }
  .mode-boards .time-tag svg { width: 14px; height: 14px; }
  .mode-boards .card-ranking, .mode-boards .start-cta, .home-footer-info { display: none; }
  .mobile-card-play { position: absolute; top: 10px; right: 10px; display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid #fff9; border-radius: 50%; color: #102754; background: var(--mode-accent); pointer-events: none; }
  .mobile-card-play svg { width: 20px; height: 20px; fill: currentColor; }
  .home-footer { grid-template-columns: auto minmax(0, 1fr); gap: 8px; }
  .home-footer-left { gap: 6px; }
  .practice-button { width: 100%; min-height: 44px; justify-content: center; justify-self: stretch; padding: 8px 12px; font-size: .8rem; background: #173d7de8; }
  .home-footer-left .practice-button { flex: none; width: auto; gap: 4px; padding: 8px; font-size: .7rem; white-space: nowrap; }
  .practice-button.rest-button { width: auto; min-width: 44px; padding: 8px; font-size: .7rem; background: #0b275c99; }
}
@media (orientation: landscape) and (max-width: 920px) and (max-height: 560px) {
  .home-v2 { min-height: 220px; }
  .mode-boards { grid-template-columns: repeat(var(--picker-count), minmax(0, 1fr)); grid-template-rows: minmax(132px, 1fr); }
  .mode-boards .mode-heading { padding: 10px; }
  .mode-boards .mode-heading h2 { flex-wrap: wrap; padding-right: 0; padding-top: 30px; font-size: 1rem; overflow-wrap: anywhere; }
  .mode-boards .mode-heading :deep(.mode-badge) { width: 26px; }
  .mode-boards .mode-details { gap: 4px 6px; }
}
@media (prefers-reduced-motion: reduce) {
  .home-v2.sleep-switch-enter-active, .home-v2.sleep-switch-leave-active { transition: none; }
  .home-v2.sleep-switch-enter-active .home-footer { animation: none; }
  .mode-board, .cover-image { transition: none; }
  .home-v2:not(.selection-made) .mode-boards:not(.modes-loading) .mode-board { animation: none; }
  .mode-board:hover, .mode-board:focus-within, .mode-board.is-mouse-hovered .cover-image { transform: none; }
  .mode-board:hover .cover-sheen, .mode-board.is-mouse-hovered .start-cta svg { animation: none; }
  .start-cta, .mode-board.is-mouse-hovered .start-cta { transform: translate(-50%, -50%) scale(var(--cta-scale)); transition: opacity 120ms linear; }
}
</style>
