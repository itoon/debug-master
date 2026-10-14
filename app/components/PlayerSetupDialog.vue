<template>
  <dialog ref="dialog" class="player-setup-dialog game-scrollbar" :class="[`setup-mode-${mode.id}`, { 'is-closing': isClosing }]"
    :style="{ '--popup-in-ms': `${homeConfig.modeMotion.popupInMs}ms`, '--popup-out-ms': `${homeConfig.modeMotion.popupOutMs}ms` }"
    :aria-labelledby="titleId" @cancel.prevent="!busy && emit('close')">
    <form class="setup-form" @submit.prevent="launch">
      <header class="setup-header">
        <div class="mission">
          <p class="mission-chip">
            <ModeBadge :mode="mode.id" /><strong>{{ t(mode.nameKey) }}</strong>
            <span>{{ t('home.levels', { from: mode.levelRange[0], to: mode.levelRange[1] }) }}</span>
            <span class="mission-time"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="M10 5v5l3 2" /></svg>{{ formatClock(mode.timeLimit * 1000) }}</span>
          </p>
          <h2 :id="titleId">{{ t('home.player') }}</h2>
        </div>
        <button type="button" class="close-button" :disabled="busy || isClosing" :aria-label="t('home.closeSetup')" @click="emit('close')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>

      <div class="setup-body">
        <!-- Live player card: what the leaderboard will show once the run is saved. -->
        <aside class="player-card" aria-hidden="true">
          <div class="hero-stage">
            <img :key="selectedAvatar" class="hero-avatar" :src="avatarSrc(selectedAvatar)" alt="" draggable="false" />
            <span :key="`pad-${selectedAvatar}`" class="landing-pad" />
          </div>
          <p :key="nameRolls" class="name-plate" :class="{ empty: !normalizedName, rolled: nameRolls > 0 }">{{ normalizedName || t('home.namePlatePlaceholder') }}</p>
          <p :key="age ?? 'none'" class="age-plate" :class="{ empty: age === null }">{{ age === null ? t('home.ageUnselected') : t('home.years', { age }) }}</p>
        </aside>

        <div class="steps">
          <fieldset class="step">
            <legend class="step-title"><span class="step-pip done" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m3.5 8.5 3 3 6-7" /></svg></span>{{ t('home.pickAvatar') }}</legend>
            <div class="avatar-grid">
              <label v-for="(avatar, index) in PLAYER_AVATARS" :key="avatar" class="avatar-option" :class="{ selected: selectedAvatar === avatar }">
                <input v-model="selectedAvatar" class="sr-only" type="radio" name="setup-avatar" :value="avatar" :disabled="busy"
                  :aria-label="t('home.selectedAvatar', { number: index + 1, total: PLAYER_AVATARS.length })" />
                <img :src="avatarSrc(avatar)" alt="" draggable="false" loading="lazy" />
              </label>
            </div>
          </fieldset>

          <div class="step nickname-field">
            <label class="step-title" for="setup-nickname"><span class="step-pip" :class="{ done: !!normalizedName && !nicknameError && namesLoaded }" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m3.5 8.5 3 3 6-7" /></svg></span>{{ t('home.nickname') }}</label>
            <div class="nickname-entry">
              <input id="setup-nickname" ref="nicknameInput" v-model="nickname" type="text"
                :maxlength="homeConfig.nicknameMaxLength" :placeholder="t('home.nicknamePlaceholder')"
                autocomplete="off" autocapitalize="off" spellcheck="false" required aria-describedby="nickname-note"
                :disabled="busy || isClosing" :aria-invalid="!!nicknameError || undefined"
                @input="generatedAnnouncement = ''" />
              <button type="button" class="random-name-button" :disabled="busy" @click="randomizeNickname">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1.5" /><circle cx="16" cy="8" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="8" cy="16" r="1.5" /><circle cx="16" cy="16" r="1.5" /></svg>
                {{ t('home.randomName') }}
              </button>
            </div>
            <span class="sr-only" role="status">{{ generatedAnnouncement }}</span>
            <small id="nickname-note" :class="{ 'nickname-error': nicknameError }" role="status">{{ nicknameError || t('home.nicknameLimit', { max: homeConfig.nicknameMaxLength }) }}</small>
            <button v-if="nameReadError" type="button" class="name-retry" :disabled="busy" @click="refreshNames">{{ t('home.retryNameCheck') }}</button>
          </div>

          <fieldset class="step">
            <legend class="step-title"><span class="step-pip" :class="{ done: age !== null }" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m3.5 8.5 3 3 6-7" /></svg></span>{{ t('home.age') }}</legend>
            <div class="age-grid">
              <label v-for="option in homeConfig.ages" :key="option" class="age-option" :class="{ selected: age === option }">
                <input v-model="age" class="sr-only" type="radio" name="setup-age" :value="option" :disabled="busy"
                  :aria-label="t('home.years', { age: option })" />
                <span aria-hidden="true">{{ option }}</span>
              </label>
            </div>
          </fieldset>
        </div>
      </div>

      <footer class="setup-footer">
        <p id="setup-form-status" class="form-status" :class="{ ready: valid }" role="status">{{ formStatus }}</p>
        <p v-if="error" class="save-error" role="alert">{{ error }}</p>
        <button type="submit" class="confirm-button" :disabled="!valid || busy" aria-describedby="setup-form-status">
          {{ t('home.start') }}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
        </button>
        <p class="privacy-note">{{ t('home.privacy') }}</p>
      </footer>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { homeConfig, type ChallengeMode } from "../data/home-config";
import { useGameI18n } from "../composables/useGameI18n";
import { PLAYER_AVATARS, isPlayerAvatarId } from "../data/player-avatars";
import { usePlayerAvatar } from "../composables/usePlayerAvatar";
import type { PlayerSetupInput, ScoreRepository } from "../storage/contracts";
import { formatClock } from "../utils/ranking";
import { nicknameKey } from "../utils/playerNickname";

// `initial` prefills the form (Live: the last player on this device); without it the form starts empty.
// `repository` enables the duplicate-nickname check against saved scores; Live omits it because
// live results never enter the local ranking.
const props = defineProps<{ mode: ChallengeMode; repository?: ScoreRepository; error?: string; busy?: boolean; initial?: PlayerSetupInput | null }>();
const emit = defineEmits<{ close: []; start: [player: PlayerSetupInput]; popup: []; edit: [] }>();
const { t } = useGameI18n();
const titleId = useId();
const dialog = ref<HTMLDialogElement | null>(null);
const isClosing = ref(false);
let popupAnimation: Animation | undefined;
let disposed = false;

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
async function animatePopup(frames: Keyframe[], duration: number): Promise<void> {
  popupAnimation?.cancel();
  if (!dialog.value || reducedMotion() || typeof dialog.value.animate !== "function") return;
  const animation = dialog.value.animate(frames, { duration, easing: frames.length > 2 ? "linear" : "cubic-bezier(.22, .8, .25, 1)", fill: "both" });
  popupAnimation = animation;
  await animation.finished.catch(() => {});
  if (popupAnimation === animation && !isClosing.value) { animation.cancel(); popupAnimation = undefined; }
}
async function closeWithMotion(): Promise<void> {
  if (isClosing.value || disposed) return;
  const current = dialog.value ? getComputedStyle(dialog.value) : undefined;
  const opacity = current?.opacity ?? "1";
  const transform = current?.transform ?? "none";
  if (dialog.value) dialog.value.style.setProperty("--backdrop-start-opacity", getComputedStyle(dialog.value, "::backdrop").opacity);
  isClosing.value = true;
  await animatePopup([
    { opacity, transform },
    { opacity: 0, transform: "scale(.68)" },
  ], homeConfig.modeMotion.popupOutMs);
  if (!disposed) dialog.value?.close();
}
defineExpose({ closeWithMotion });
const nicknameInput = ref<HTMLInputElement | null>(null);
const nickname = ref(props.initial?.nickname ?? "");
const avatarSrc = usePlayerAvatar();
// Starts on a random character so the leaderboard stays varied; the player can pick any other.
const selectedAvatar = ref<string>(PLAYER_AVATARS[0]);
const generatedAnnouncement = ref("");
// Re-keys the name plate so each dice roll flips it in; typing does not.
const nameRolls = ref(0);
const nicknameBaseKeys = [
  "nickname.base.bug", "nickname.base.codi", "nickname.base.rocket", "nickname.base.cat",
  "nickname.base.captain", "nickname.base.star", "nickname.base.duck", "nickname.base.panda",
] as const;
const nicknameVibeKeys = [
  "nickname.vibe.top", "nickname.vibe.chill", "nickname.vibe.cool", "nickname.vibe.carry",
  "nickname.vibe.godMode", "nickname.vibe.boost", "nickname.vibe.sneaky", "nickname.vibe.energy",
  "nickname.vibe.playful", "nickname.vibe.fast",
] as const;
const age = ref<number | null>(props.initial && homeConfig.ages.includes(props.initial.age) ? props.initial.age : null);
const normalizedName = computed(() => nickname.value.trim());
const existingNames = ref<string[]>([]);
const namesLoaded = ref(false);
const nameReadError = ref(false);
let unsubscribeNames: (() => void) | undefined;
const usedNameKeys = computed(() => new Set(existingNames.value.map(nicknameKey)));
const duplicateName = computed(() => !!normalizedName.value && usedNameKeys.value.has(nicknameKey(normalizedName.value)));
const nicknameError = computed(() => nameReadError.value ? t('home.nicknameCheckError') : duplicateName.value ? t('home.nicknameTaken') : '');
const valid = computed(() => namesLoaded.value && !nicknameError.value && normalizedName.value.length > 0 && normalizedName.value.length <= homeConfig.nicknameMaxLength && homeConfig.ages.includes(age.value as number));
const formStatus = computed(() => nicknameError.value || t(valid.value ? "home.ready" : !normalizedName.value && age.value === null ? "home.requiredBoth" : !normalizedName.value ? "home.requiredName" : "home.requiredAge"));
function refreshNames(): void {
  if (disposed) return;
  try {
    existingNames.value = props.repository ? props.repository.list().map(score => score.name) : [];
    nameReadError.value = false;
  } catch {
    existingNames.value = [];
    nameReadError.value = true;
  } finally { namesLoaded.value = true; }
}
watch(nickname, () => emit('edit'));

function randomizeNickname(): void {
  refreshNames();
  if (nameReadError.value) return;
  const names = nicknameBaseKeys.flatMap((nameKey) =>
    nicknameVibeKeys.map((vibeKey) => t("nickname.combined", { name: t(nameKey), vibe: t(vibeKey) })),
  );
  const candidates = names.flatMap((name) => homeConfig.nicknameEmojis.map((emoji) =>
    t("nickname.generated", { name, emoji }),
  )).filter((candidate) => candidate.length <= homeConfig.nicknameMaxLength && nicknameKey(candidate) !== nicknameKey(normalizedName.value) && !usedNameKeys.value.has(nicknameKey(candidate)));
  if (!candidates.length) return;
  nickname.value = candidates[Math.floor(Math.random() * candidates.length)]!;
  nameRolls.value += 1;
  generatedAnnouncement.value = t("home.randomNameReady", { name: nickname.value });
}

function launch() {
  refreshNames();
  if (!props.busy && !isClosing.value && valid.value && age.value !== null) emit("start", { nickname: normalizedName.value, age: age.value, avatarId: selectedAvatar.value });
}
onMounted(() => {
  refreshNames();
  unsubscribeNames = props.repository?.subscribe(refreshNames);
  const preset = props.initial?.avatarId;
  selectedAvatar.value = isPlayerAvatarId(preset)
    ? preset
    : PLAYER_AVATARS[Math.floor(Math.random() * PLAYER_AVATARS.length)]!;
  dialog.value?.showModal();
  void animatePopup([
    { offset: 0, opacity: 0, transform: "scale(.72)", easing: "cubic-bezier(.2, .8, .2, 1)" },
    { offset: .65, opacity: 1, transform: "scale(1.035)", easing: "ease-in-out" },
    { offset: .85, opacity: 1, transform: "scale(.985)", easing: "ease-in-out" },
    { offset: 1, opacity: 1, transform: "none" },
  ], homeConfig.modeMotion.popupInMs);
  emit("popup");
  nicknameInput.value?.focus();
});
onBeforeUnmount(() => { disposed = true; unsubscribeNames?.(); popupAnimation?.cancel(); dialog.value?.close(); });
</script>

<style scoped>
.player-setup-dialog { --mode-accent: #ffdc53; box-sizing: border-box; width: min(940px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); padding: 0; margin: auto; overflow-y: auto; border: 2px solid #668eff; border-radius: 28px; background: linear-gradient(170deg, #1a3a91, #11286f 60%, #0d215e); color: #fff; font-family: var(--cv-font); box-shadow: var(--cv-shadow-window); }
.player-setup-dialog.setup-mode-B { --mode-accent: #94deff; }
.player-setup-dialog.setup-mode-C { --mode-accent: #d7bcff; }
.player-setup-dialog::backdrop { background: rgba(3, 12, 40, .78); backdrop-filter: blur(5px); animation: setup-backdrop-in var(--popup-in-ms) ease both; }
.player-setup-dialog.is-closing::backdrop { animation: setup-backdrop-out var(--popup-out-ms) ease both; }
@keyframes setup-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes setup-backdrop-out { from { opacity: var(--backdrop-start-opacity, 1); } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .player-setup-dialog::backdrop, .player-setup-dialog.is-closing::backdrop { animation: none; } }
::selection { background: #ffd440; color: #112760; }
.setup-form { display: grid; gap: 18px; padding: clamp(18px, 2.4vw, 28px); }
button, input { font: inherit; }
button { cursor: pointer; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }

/* Header: the mission being launched, then the screen title. */
.setup-header { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
.mission { display: grid; gap: 10px; min-width: 0; }
.mission-chip { display: inline-flex; flex-wrap: wrap; align-items: center; justify-self: start; gap: 6px 12px; margin: 0; padding: 6px 14px 6px 8px; border: 1px solid color-mix(in srgb, var(--mode-accent) 55%, #3b5fc4); border-radius: 999px; background: #0b1f57; color: #c9dcff; font-size: .85rem; }
.mission-chip :deep(.mode-badge) { width: 40px; flex: none; }
.mission-chip strong { color: var(--mode-accent); font-size: 1rem; font-weight: 800; }
.mission-time { display: inline-flex; align-items: center; gap: 4px; font-variant-numeric: tabular-nums; }
.mission-time svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
h2 { margin: 0; font-size: clamp(1.45rem, 3vw, 1.9rem); font-weight: 800; line-height: 1.25; text-wrap: balance; }
.close-button { display: grid; place-items: center; flex: none; width: 48px; height: 48px; border: 1px solid #7d9cfa; border-radius: 14px; background: #0c225e; color: #fff; transition: background 150ms ease; }
.close-button svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; }
.close-button:not(:disabled):hover { background: #1b3a8c; }

.setup-body { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 24px; align-items: stretch; }

/* Player card: a character-select preview on a launch pad. */
.player-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-width: 0; padding: 22px 16px 24px; border: 2px solid color-mix(in srgb, var(--mode-accent) 45%, #355bc0); border-radius: 22px; background:
  radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--mode-accent) 30%, transparent), transparent 58%),
  radial-gradient(rgba(255, 255, 255, .5) 1px, transparent 1.6px) 0 0 / 26px 26px,
  linear-gradient(180deg, #0a1c52, #0e2a72); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .12), 0 10px 24px rgba(3, 12, 40, .35); }
.hero-stage { position: relative; display: grid; place-items: center; width: 100%; height: 190px; }
.hero-avatar { position: relative; z-index: 1; width: 156px; height: 156px; margin-bottom: 18px; border: 5px solid #fff; border-radius: 50%; background: #cceaff; object-fit: contain; box-shadow: 0 0 0 3px color-mix(in srgb, var(--mode-accent) 70%, #0b1f57), 0 14px 26px rgba(2, 10, 36, .5); animation: hero-in 420ms cubic-bezier(.16, 1, .3, 1) both; }
.landing-pad { animation: pad-charge 520ms ease-out; position: absolute; bottom: 4px; width: 170px; height: 34px; border: 2px solid #123981; border-radius: 50%; background: radial-gradient(ellipse at 50% 35%, #6aa2ff, #2f6ff0 60%); box-shadow: 0 5px 0 #124da8, 0 0 28px color-mix(in srgb, var(--mode-accent) 45%, transparent); }
@keyframes pad-charge { 0% { filter: brightness(1.8); transform: scale(1.12); } 100% { filter: none; transform: none; } }
@keyframes hero-in { from { opacity: .4; transform: translateY(-14px) scale(.86); } to { opacity: 1; transform: none; } }
.name-plate, .age-plate { max-width: 100%; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; }
.name-plate { padding: 8px 16px; border: 2px solid #fff; border-radius: 14px; background: #fff; color: #112760; font-size: 1.15rem; font-weight: 800; box-shadow: 0 4px 0 #0a1c52; }
.name-plate.rolled { animation: plate-flip 420ms cubic-bezier(.34, 1.56, .64, 1); }
.age-plate:not(.empty) { animation: plate-pop 340ms cubic-bezier(.34, 1.56, .64, 1); }
@keyframes plate-flip { 0% { transform: rotateX(90deg); } 100% { transform: none; } }
@keyframes plate-pop { 0% { transform: scale(.6); } 60% { transform: scale(1.15); } }
.name-plate.empty { border-style: dashed; border-color: #8fb0e6; background: transparent; color: #b5cdfa; box-shadow: none; font-weight: 700; }
.age-plate { padding: 3px 12px; border-radius: 999px; background: var(--mode-accent); color: #0c2056; font-size: .85rem; font-weight: 800; }
.age-plate.empty { background: rgba(140, 182, 255, .15); color: #b5cdfa; font-weight: 700; }

/* Steps: avatar, nickname and age, each with a pip that lights when done. */
/* One rhythm: 12px from a step title to its control, 26px between steps. */
.steps { display: grid; gap: 26px; min-width: 0; align-content: start; }
.step { display: grid; gap: 12px; min-width: 0; margin: 0; padding: 0; border: 0; }
/* A rendered legend sits outside the fieldset's grid, so gap never reaches it. */
legend.step-title { margin-bottom: 12px; }
.step-title { display: flex; align-items: center; gap: 8px; padding: 0; color: #fff; font-size: 1rem; font-weight: 800; }
.step-pip { display: grid; place-items: center; width: 22px; height: 22px; flex: none; border: 2px solid #5f86e8; border-radius: 50%; color: transparent; transition: background 200ms ease, border-color 200ms ease, color 200ms ease; }
.step-pip svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.step-pip.done { border-color: #ffd440; background: #ffd440; color: #112760; animation: pip-pop 380ms cubic-bezier(.34, 1.56, .64, 1); }
.step-pip.done path { stroke-dasharray: 16; animation: pip-check 300ms 120ms ease-out backwards; }
@keyframes pip-pop { 0% { transform: scale(.5); } 60% { transform: scale(1.25); } }
@keyframes pip-check { from { stroke-dashoffset: 16; } }

/* Flush with the nickname and age edges; block padding only keeps the selected ring off the title. */
.avatar-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(54px, 1fr)); gap: 10px; padding: 4px 0; }
.avatar-option { position: relative; display: grid; place-items: center; aspect-ratio: 1; border: 3px solid transparent; border-radius: 50%; background: #cceaff; box-shadow: 0 0 0 1px #3d63c9; cursor: pointer; transition: transform 160ms cubic-bezier(.16, 1, .3, 1), border-color 160ms ease, box-shadow 160ms ease; }
.avatar-option img { width: 100%; height: 100%; border-radius: 50%; object-fit: contain; pointer-events: none; }
.avatar-option:hover { transform: translateY(-3px); box-shadow: 0 0 0 1px #8db7ff, 0 6px 12px rgba(3, 12, 40, .4); }
.avatar-option.selected { border-color: #ffd440; box-shadow: 0 0 0 3px #112760, 0 0 0 5px #ffd440; transform: scale(1.06); }
.avatar-option.selected::after { content: ""; position: absolute; right: -6px; bottom: -6px; width: 20px; height: 20px; border: 2px solid #112760; border-radius: 50%; background: #ffd440 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='m3.5 8.5 3 3 6-7' fill='none' stroke='%23112760' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 14px no-repeat; }
.avatar-option:has(input:focus-visible), .age-option:has(input:focus-visible) { outline: 3px solid #fff; outline-offset: 3px; }
.avatar-option:has(input:disabled), .age-option:has(input:disabled) { opacity: .55; cursor: not-allowed; }

.nickname-field small { margin-top: -4px; }
.nickname-entry { display: flex; gap: 10px; }
.nickname-entry input { flex: 1; min-width: 0; min-height: 54px; padding: 10px 16px; border: 2px solid #8db7ff; border-radius: 14px; background: #fff; color: #172b52; font-size: 1.1rem; font-weight: 700; caret-color: #1f75ff; }
.nickname-entry input::placeholder { color: #6a7da3; font-weight: 400; }
.random-name-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex: none; min-width: 120px; min-height: 54px; padding: 8px 14px; border: 2px solid #ffe889; border-radius: 14px; background: #ffdc53; color: #142854; font-weight: 800; box-shadow: 0 4px 0 #c59a1c; transition: transform 120ms ease, box-shadow 120ms ease; }
.random-name-button svg { width: 22px; height: 22px; flex: none; }
.random-name-button rect { fill: none; stroke: currentColor; stroke-width: 2; }
.random-name-button circle { fill: currentColor; }
.random-name-button:not(:disabled):active { transform: translateY(3px); box-shadow: 0 1px 0 #c59a1c; }
.random-name-button:disabled { opacity: .5; cursor: not-allowed; }
.nickname-field small { color: #c2d8ff; font-size: .78rem; }
.nickname-field .nickname-error { color: #ffb9b9; }
.nickname-entry input[aria-invalid="true"] { border-color: var(--cv-red); }
.name-retry { justify-self: start; padding: 8px 12px; border: 1px solid #7d9cfa; border-radius: 10px; background: #0c225e; color: #fff; font-weight: 700; }

.age-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
.age-option { display: grid; place-items: center; min-height: 52px; border: 2px solid #3d63c9; border-radius: 14px; background: #0c225e; color: #e0e9ff; font-size: 1.25rem; font-weight: 800; font-variant-numeric: tabular-nums; cursor: pointer; box-shadow: 0 3px 0 #081845; transition: transform 120ms ease, background 150ms ease, border-color 150ms ease, box-shadow 120ms ease; }
.age-option:hover { border-color: #8db7ff; background: #163584; }
.age-option:active { transform: translateY(2px); box-shadow: 0 1px 0 #081845; }
.age-option.selected { border-color: #ffe889; background: #ffd440; color: #112760; box-shadow: 0 3px 0 #c59a1c; }

/* Footer: status, then the launch button. */
.setup-footer { display: grid; justify-items: center; gap: 10px; padding-top: 10px; }
.form-status, .privacy-note, .save-error { margin: 0; font-size: .85rem; text-align: center; }
.form-status { color: #ffdc5a; font-weight: 700; }
.form-status.ready { color: #9ff0b8; }
/* Clears the button's 6px base shadow so it sits as far below as the status sits above. */
.privacy-note { margin-top: 6px; color: #b5cdfa; font-size: .78rem; }
.save-error { color: #ffd1cb; }
.confirm-button { display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: min(360px, 100%); min-height: 60px; padding: 12px 28px; border: 2px solid #ffe889; border-radius: 18px; background: #ffd440; color: #112760; font-size: 1.3rem; font-weight: 800; box-shadow: 0 6px 0 #c59a1c, 0 14px 24px rgba(3, 12, 40, .35); transition: transform 120ms ease, box-shadow 120ms ease, filter 150ms ease; }
/* Ready to launch: one light sweep the moment every step is complete. */
.confirm-button { position: relative; overflow: hidden; }
.confirm-button::after { content: ""; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, .7) 50%, transparent 65%); transform: translateX(-110%); pointer-events: none; }
.confirm-button:not(:disabled)::after { animation: confirm-sheen 750ms 80ms ease-out both; }
.confirm-button:not(:disabled) svg { animation: confirm-nudge 1.4s 900ms ease-in-out infinite; }
@keyframes confirm-sheen { to { transform: translateX(110%); } }
@keyframes confirm-nudge { 0%, 60%, 100% { transform: none; } 30% { transform: translateX(4px); } }
.confirm-button svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.confirm-button:not(:disabled):hover { filter: brightness(1.05); }
.confirm-button:not(:disabled):active { transform: translateY(4px); box-shadow: 0 2px 0 #c59a1c, 0 6px 12px rgba(3, 12, 40, .3); }
.confirm-button:disabled { border-color: #7b8fc0; background: #5d6f9f; color: #d5def3; box-shadow: 0 6px 0 #3e4d78; cursor: not-allowed; }
button:focus-visible, input:focus-visible { outline: 3px solid #ffdc5a; outline-offset: 3px; }

@media (max-width: 760px) {
  .setup-body { grid-template-columns: minmax(0, 1fr); gap: 18px; }
  .player-card { display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto auto; justify-items: start; align-items: center; column-gap: 16px; row-gap: 6px; padding: 14px 16px; }
  .hero-stage { grid-row: 1 / 3; width: 96px; height: 104px; }
  .hero-avatar { width: 84px; height: 84px; margin-bottom: 14px; border-width: 4px; }
  .landing-pad { width: 96px; height: 22px; box-shadow: 0 3px 0 #124da8; }
  .name-plate { align-self: end; justify-self: stretch; text-align: left; font-size: 1.05rem; }
  .age-plate { align-self: start; }
  .confirm-button { width: 100%; }
}
@media (max-width: 460px) {
  .nickname-entry { flex-direction: column; }
  .age-grid { gap: 6px; }
  .age-option { min-height: 48px; font-size: 1.1rem; }
  .avatar-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; padding: 4px 0; }
}
@media (prefers-reduced-motion: reduce) {
  .hero-avatar, .landing-pad, .step-pip.done, .step-pip.done path, .name-plate.rolled, .age-plate:not(.empty), .confirm-button:not(:disabled)::after, .confirm-button:not(:disabled) svg { animation: none; }
  .avatar-option, .age-option, .confirm-button, .random-name-button, .step-pip, .close-button { transition: none; }
  .avatar-option:hover, .avatar-option.selected { transform: none; }
}
</style>
