<template>
  <dialog ref="dialog" class="player-setup-dialog" :aria-labelledby="titleId" @cancel.prevent="emit('close')">
    <form class="setup-form" @submit.prevent="launch">
      <header class="setup-header">
        <div>
          <p class="setup-brand">{{ t('brand') }}</p>
          <h2 :id="titleId">{{ t('home.player') }}</h2>
        </div>
        <button type="button" class="close-button" :aria-label="t('home.closeSetup')" @click="emit('close')">×</button>
      </header>
      <div class="selected-mode"><ModeBadge :mode="mode.id" /><strong>{{ t(mode.nameKey) }}</strong></div>
      <div class="player-identity">
        <div class="profile-choice">
          <p>{{ t('home.avatar') }}</p>
          <div class="avatar-preview">
            <img :src="avatarSrc(selectedAvatar)" :alt="t('home.selectedAvatar', { number: avatarIndex + 1, total: PLAYER_AVATARS.length })" draggable="false" />
            <button type="button" class="avatar-cycle" :disabled="busy" :aria-label="t('home.nextAvatar')" :title="t('home.nextAvatar')" @click="nextAvatar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M18 17a7 7 0 0 1-12 1l-2-3" /></svg>
            </button>
          </div>
          <span class="sr-only" role="status">{{ t('home.selectedAvatar', { number: avatarIndex + 1, total: PLAYER_AVATARS.length }) }}</span>
        </div>
      <div class="nickname-field">
        <label for="setup-nickname">{{ t('home.nickname') }}</label>
        <div class="nickname-entry">
          <input id="setup-nickname" ref="nicknameInput" v-model="nickname" type="text"
            :maxlength="homeConfig.nicknameMaxLength" :placeholder="t('home.nicknamePlaceholder')"
            autocomplete="off" autocapitalize="off" spellcheck="false" required aria-describedby="nickname-note"
            @input="generatedAnnouncement = ''" />
          <button type="button" class="random-name-button" :disabled="busy" @click="randomizeNickname">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1.5" /><circle cx="16" cy="8" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="8" cy="16" r="1.5" /><circle cx="16" cy="16" r="1.5" /></svg>
            {{ t('home.randomName') }}
          </button>
        </div>
        <span class="sr-only" role="status">{{ generatedAnnouncement }}</span>
        <small id="nickname-note">{{ t('home.nicknameLimit', { max: homeConfig.nicknameMaxLength }) }}</small>
      </div>
      </div>
      <fieldset class="age-field">
        <legend>{{ t('home.age') }}</legend>
        <p class="age-hint">{{ t('home.ageHint') }}</p>
        <p class="age-current" role="status">{{ age === null ? t('home.ageUnselected') : t('home.years', { age }) }}</p>
        <div class="age-scroll">
          <div ref="ageTrack" class="age-track" :style="trackStyle"
            @pointerdown="beginAgeDrag" @pointermove="moveAgeDrag" @pointerup="endAgeDrag" @pointercancel="endAgeDrag">
            <div class="age-rail" aria-hidden="true"><div v-if="age !== null" class="age-progress" :style="{ width: `${progress}%` }" /></div>
            <div v-if="age !== null" class="age-marker" aria-hidden="true">
              <span>{{ t('home.years', { age }) }}</span>
              <img :src="PLAYER_SPRITES.down" alt="" draggable="false" />
            </div>
            <button v-for="(option, index) in homeConfig.ages" :key="option" type="button" class="age-step"
              :class="{ selected: age === option }" :aria-pressed="age === option"
              :aria-label="t('home.years', { age: option })"
              @click="selectAgeFromClick(option, $event)" @keydown="handleAgeKey($event, index)">
              <span class="age-dot" aria-hidden="true" /><span class="age-number">{{ option }}</span>
            </button>
          </div>
        </div>
        <p class="age-scroll-hint">{{ t('home.ageScrollHint') }}</p>
      </fieldset>
      <p id="setup-form-status" class="form-status" role="status">{{ formStatus }}</p>
      <p v-if="error" class="save-error" role="alert">{{ error }}</p>
      <button type="submit" class="confirm-button" :disabled="!valid || busy" aria-describedby="setup-form-status">{{ t('home.start') }} <span aria-hidden="true">→</span></button>
      <p class="privacy-note">{{ t('home.privacy') }}</p>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { homeConfig, type ChallengeMode } from "../data/home-config";
import { useGameI18n } from "../composables/useGameI18n";
import { PLAYER_SPRITES } from "../utils/playerSprites";
import { PLAYER_AVATARS } from "../data/player-avatars";
import { usePlayerAvatar } from "../composables/usePlayerAvatar";
import type { PlayerSetupInput } from "../storage/contracts";

defineProps<{ mode: ChallengeMode; error?: string; busy?: boolean }>();
const emit = defineEmits<{ close: []; start: [player: PlayerSetupInput] }>();
const { t } = useGameI18n();
const titleId = useId();
const dialog = ref<HTMLDialogElement | null>(null);
const nicknameInput = ref<HTMLInputElement | null>(null);
const ageTrack = ref<HTMLDivElement | null>(null);
const nickname = ref("");
const avatarSrc = usePlayerAvatar();
const avatarIndex = ref(0);
const selectedAvatar = computed(() => PLAYER_AVATARS[avatarIndex.value]!);
function nextAvatar() { avatarIndex.value = (avatarIndex.value + 1) % PLAYER_AVATARS.length; }
const generatedAnnouncement = ref("");
const randomNameKeys = ["nickname.star", "nickname.comet", "nickname.rocket", "nickname.captain", "nickname.explorer", "nickname.moon", "nickname.cosmo", "nickname.spark"] as const;
const age = ref<number | null>(null);
const normalizedName = computed(() => nickname.value.trim());
const valid = computed(() => normalizedName.value.length > 0 && normalizedName.value.length <= homeConfig.nicknameMaxLength && homeConfig.ages.includes(age.value as number));
const formStatus = computed(() => t(valid.value ? "home.ready" : !normalizedName.value && age.value === null ? "home.requiredBoth" : !normalizedName.value ? "home.requiredName" : "home.requiredAge"));
const selectedIndex = computed(() => age.value === null ? -1 : homeConfig.ages.indexOf(age.value));
const progress = computed(() => selectedIndex.value < 0 ? 0 : selectedIndex.value / Math.max(1, homeConfig.ages.length - 1) * 100);
const trackStyle = computed(() => ({
  "--age-count": homeConfig.ages.length,
  "--age-position": `${(selectedIndex.value + .5) / homeConfig.ages.length * 100}%`,
}));

function randomizeNickname(): void {
  const names = randomNameKeys.map((key) => t(key)).filter((name) =>
    t("nickname.generated", { name, number: "00" }).length <= homeConfig.nicknameMaxLength,
  );
  if (!names.length) return;
  const name = names[Math.floor(Math.random() * names.length)]!;
  const number = Math.floor(Math.random() * 100);
  const candidate = t("nickname.generated", { name, number: number.toString().padStart(2, "0") });
  nickname.value = candidate === normalizedName.value
    ? t("nickname.generated", { name, number: ((number + 1) % 100).toString().padStart(2, "0") })
    : candidate;
  generatedAnnouncement.value = t("home.randomNameReady", { name: nickname.value });
}

function selectAgeAt(event: PointerEvent) {
  const rect = ageTrack.value?.getBoundingClientRect();
  if (!rect) return;
  const cell = rect.width / homeConfig.ages.length;
  const index = Math.max(0, Math.min(homeConfig.ages.length - 1, Math.round((event.clientX - rect.left - cell / 2) / cell)));
  age.value = homeConfig.ages[index]!;
}
function beginAgeDrag(event: PointerEvent) {
  if (event.button !== 0) return;
  ageTrack.value?.setPointerCapture(event.pointerId);
  selectAgeAt(event);
}
function moveAgeDrag(event: PointerEvent) {
  if (ageTrack.value?.hasPointerCapture(event.pointerId)) selectAgeAt(event);
}
function endAgeDrag(event: PointerEvent) {
  if (!ageTrack.value?.hasPointerCapture(event.pointerId)) return;
  ageTrack.value.releasePointerCapture(event.pointerId);
  ageTrack.value.querySelectorAll<HTMLButtonElement>("button")[selectedIndex.value]?.focus({ preventScroll: true });
}
function selectAgeFromClick(option: number, event: MouseEvent) {
  // Pointer input already selects on down/drag. A post-drag click must not
  // restore the starting tick; keyboard and assistive clicks still select.
  if (event.detail === 0) age.value = option;
}
function handleAgeKey(event: KeyboardEvent, index: number) {
  const last = homeConfig.ages.length - 1;
  const next = event.key === "ArrowRight" || event.key === "ArrowUp" ? Math.min(last, index + 1)
    : event.key === "ArrowLeft" || event.key === "ArrowDown" ? Math.max(0, index - 1)
    : event.key === "Home" ? 0 : event.key === "End" ? last : undefined;
  if (next === undefined) return;
  event.preventDefault();
  age.value = homeConfig.ages[next]!;
  const button = ageTrack.value?.querySelectorAll<HTMLButtonElement>("button")[next];
  button?.focus();
}
function launch() {
  if (valid.value && age.value !== null) emit("start", { nickname: normalizedName.value, age: age.value, avatarId: selectedAvatar.value });
}
onMounted(() => { avatarIndex.value = Math.floor(Math.random() * PLAYER_AVATARS.length); dialog.value?.showModal(); nicknameInput.value?.focus(); });
onBeforeUnmount(() => dialog.value?.close());
</script>

<style scoped>
.player-setup-dialog { box-sizing: border-box; width: min(760px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); padding: 0; margin: auto; overflow-y: auto; border: 1px solid #668eff; border-radius: 24px; background: #142f80; color: #fff; font-family: var(--cv-font); box-shadow: var(--cv-shadow-window); }
.player-setup-dialog::backdrop { background: rgba(3, 12, 40, .78); backdrop-filter: blur(5px); }
.setup-form { display: grid; gap: 12px; padding: clamp(18px, 2vw, 24px); }
.setup-header { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
.setup-brand { margin: 0 0 5px; color: #b7d8ff; font-size: .8rem; font-weight: 800; }
h2 { margin: 0; font-size: clamp(1.3rem, 3vw, 1.5rem); font-weight: 800; line-height: 1.3; }
button, input { font: inherit; }
button { cursor: pointer; }
.close-button { flex: none; width: 48px; height: 48px; border: 1px solid #7d9cfa; border-radius: 12px; background: #0c225e; color: white; font-size: 1.7rem; }
.selected-mode { display: flex; align-items: center; justify-self: start; gap: 10px; min-height: 44px; padding: 6px 14px; border: 1px solid #668eff; border-radius: 12px; background: #0c225e; }
.nickname-field { display: grid; gap: 5px; }
.player-identity { display: grid; grid-template-columns: 120px minmax(0, 1fr); align-items: center; gap: 20px; }
.profile-choice { display: grid; justify-items: center; gap: 8px; }
.profile-choice p { margin: 0; font-size: .85rem; font-weight: 800; }
.avatar-preview { position: relative; width: 104px; height: 104px; border: 3px solid #87bbff; border-radius: 50%; background: radial-gradient(circle at top, #91caff, #2b59b5); }
.avatar-preview img { width: 100%; height: 100%; border-radius: inherit; object-fit: contain; }
.avatar-cycle { position: absolute; top: -10px; right: -10px; display: grid; place-items: center; width: 48px; height: 48px; padding: 9px; border: 2px solid #ffe889; border-radius: 50%; background: #153779; color: #ffe17a; box-shadow: 0 3px 8px #0c2058; }
.avatar-cycle svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.nickname-entry { display: flex; gap: 10px; }
.nickname-entry input { flex: 1; min-width: 0; }
.random-name-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex: none; min-width: 116px; min-height: 52px; padding: 8px 12px; border: 2px solid #ffe889; border-radius: 14px; background: #ffdc53; color: #142854; font-weight: 800; }
.random-name-button svg { width: 22px; height: 22px; flex: none; }
.random-name-button rect { fill: none; stroke: currentColor; stroke-width: 2; }
.random-name-button circle { fill: currentColor; }
.random-name-button:disabled { opacity: .5; cursor: not-allowed; }
label, legend { font-weight: 800; }
.nickname-field input { width: 100%; min-height: 52px; padding: 10px 16px; border: 2px solid #8db7ff; border-radius: 14px; background: white; color: #172b52; font-size: 1.05rem; }
.nickname-field small { color: #c2d8ff; font-size: .75rem; }
.age-field { margin: 0; padding: 0; border: 0; min-width: 0; }
.age-hint, .age-current { margin: 5px 0 0; color: #d2e1ff; font-size: .85rem; }
.age-current { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.age-scroll { overflow-x: auto; padding: 64px 12px 4px; }
.age-track { position: relative; display: grid; grid-template-columns: repeat(var(--age-count), minmax(48px, 1fr)); min-width: calc(var(--age-count) * 48px); isolation: isolate; touch-action: none; user-select: none; }
.age-rail { position: absolute; top: 22px; left: calc(100% / var(--age-count) / 2); right: calc(100% / var(--age-count) / 2); height: 10px; border-radius: 8px; background: #0b205c; box-shadow: inset 0 0 0 2px #5079e6; z-index: -1; }
.age-progress { height: 100%; background: #ffd440; border-radius: inherit; }
.age-step { display: grid; justify-items: center; align-content: start; gap: 8px; min-width: 48px; min-height: 80px; padding: 11px 0 0; border: 0; background: transparent; color: #e0e9ff; font-weight: 800; }
.age-dot { width: 30px; height: 30px; border: 3px solid #527ee7; border-radius: 50%; background: #183684; box-shadow: inset 0 0 0 2px #142a6c; }
.age-number { min-width: 32px; padding: 3px 6px; border-radius: 18px; font-size: 1rem; line-height: 1.4; }
.age-step.selected .age-dot { background: #ffd440; border-color: #ffd440; box-shadow: 0 0 0 3px #163078; }
.age-step.selected .age-number { color: #112760; background: #ffd440; }
.age-marker { position: absolute; left: var(--age-position); bottom: calc(100% - 13px); transform: translateX(-50%); display: grid; justify-items: center; gap: 2px; pointer-events: none; }
.age-marker span { white-space: nowrap; padding: 2px 8px; border: 2px solid #102252; border-radius: 10px; background: #fff; color: #1a1e1f; font-size: .8rem; font-weight: 800; }
.age-marker img { width: 40px; height: 48px; object-fit: contain; }
.age-scroll-hint { display: none; margin: 2px 0 0; font-size: .75rem; color: #c2d8ff; }
.form-status, .privacy-note, .save-error { margin: 0; font-size: .8rem; }
.form-status { color: #ffdc5a; text-align: center; }
.privacy-note { color: #c2d8ff; text-align: center; }
.save-error { color: #ffd1cb; }
.confirm-button { justify-self: center; width: min(260px, 100%); min-height: 52px; padding: 12px 24px; border: 0; border-radius: 14px; background: #ffd440; color: #112760; font-size: 1.1rem; font-weight: 800; }
.confirm-button:disabled { background: #667bad; color: #d5def3; cursor: not-allowed; }
button:focus-visible, input:focus-visible { outline: 3px solid #ffdc5a; outline-offset: 3px; }
@media (max-width: 760px) { .age-scroll-hint { display: block; } .confirm-button { justify-self: stretch; width: 100%; } }
@media (max-width: 420px) { .nickname-entry { flex-direction: column; } }
@media (max-width: 560px) { .player-identity { grid-template-columns: 1fr; gap: 16px; } }
</style>
