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
      <div class="nickname-field">
        <label for="setup-nickname">{{ t('home.nickname') }}</label>
        <input id="setup-nickname" ref="nicknameInput" v-model="nickname" type="text"
          :maxlength="homeConfig.nicknameMaxLength" :placeholder="t('home.nicknamePlaceholder')"
          autocomplete="off" autocapitalize="off" spellcheck="false" required aria-describedby="nickname-note" />
        <small id="nickname-note">{{ t('home.nicknameLimit', { max: homeConfig.nicknameMaxLength }) }}</small>
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

defineProps<{ mode: ChallengeMode; error?: string; busy?: boolean }>();
const emit = defineEmits<{ close: []; start: [player: { nickname: string; age: number }] }>();
const { t } = useGameI18n();
const titleId = useId();
const dialog = ref<HTMLDialogElement | null>(null);
const nicknameInput = ref<HTMLInputElement | null>(null);
const ageTrack = ref<HTMLDivElement | null>(null);
const nickname = ref("");
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
  if (valid.value && age.value !== null) emit("start", { nickname: normalizedName.value, age: age.value });
}
onMounted(() => { dialog.value?.showModal(); nicknameInput.value?.focus(); });
onBeforeUnmount(() => dialog.value?.close());
</script>

<style scoped>
.player-setup-dialog { width: min(900px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); padding: 0; margin: auto; overflow-y: auto; border: 1px solid #668eff; border-radius: 24px; background: #142f80; color: #fff; font-family: var(--cv-font); box-shadow: var(--cv-shadow-window); }
.player-setup-dialog::backdrop { background: rgba(3, 12, 40, .78); backdrop-filter: blur(5px); }
.setup-form { display: grid; gap: 10px; padding: clamp(18px, 2vw, 24px); }
.setup-header { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
.setup-brand { margin: 0 0 5px; color: #b7d8ff; font-size: .8rem; font-weight: 800; }
h2 { margin: 0; font-size: clamp(1.3rem, 3vw, 1.5rem); font-weight: 800; line-height: 1.3; }
button, input { font: inherit; }
button { cursor: pointer; }
.close-button { flex: none; width: 48px; height: 48px; border: 1px solid #7d9cfa; border-radius: 12px; background: #0c225e; color: white; font-size: 1.7rem; }
.selected-mode { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 52px; border: 1px solid #668eff; border-radius: 14px; background: #0c225e; }
.nickname-field { display: grid; gap: 5px; }
label, legend { font-weight: 800; }
.nickname-field input { width: 100%; min-height: 52px; padding: 10px 16px; border: 2px solid #8db7ff; border-radius: 14px; background: white; color: #172b52; font-size: 1.05rem; }
.nickname-field small { color: #c2d8ff; font-size: .75rem; }
.age-field { margin: 0; padding: 0; border: 0; min-width: 0; }
.age-hint, .age-current { margin: 5px 0 0; color: #d2e1ff; font-size: .85rem; }
.age-current { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.age-scroll { overflow-x: auto; padding: 86px 12px 8px; }
.age-track { position: relative; display: grid; grid-template-columns: repeat(var(--age-count), minmax(48px, 1fr)); min-width: calc(var(--age-count) * 48px); isolation: isolate; touch-action: none; user-select: none; }
.age-rail { position: absolute; top: 22px; left: calc(100% / var(--age-count) / 2); right: calc(100% / var(--age-count) / 2); height: 10px; border-radius: 8px; background: #0b205c; box-shadow: inset 0 0 0 2px #5079e6; z-index: -1; }
.age-progress { height: 100%; background: #ffd440; border-radius: inherit; }
.age-step { display: grid; justify-items: center; align-content: start; gap: 8px; min-width: 48px; min-height: 80px; padding: 11px 0 0; border: 0; background: transparent; color: #e0e9ff; font-weight: 800; }
.age-dot { width: 30px; height: 30px; border: 3px solid #527ee7; border-radius: 50%; background: #183684; box-shadow: inset 0 0 0 2px #142a6c; }
.age-number { min-width: 32px; padding: 3px 6px; border-radius: 18px; font-size: 1rem; line-height: 1.4; }
.age-step.selected .age-dot { background: #ffd440; border-color: #ffd440; box-shadow: 0 0 0 3px #163078; }
.age-step.selected .age-number { color: #112760; background: #ffd440; }
.age-marker { position: absolute; left: var(--age-position); bottom: calc(100% - 13px); transform: translateX(-50%); display: grid; justify-items: center; gap: 4px; pointer-events: none; }
.age-marker span { white-space: nowrap; padding: 3px 10px; border: 2px solid #102252; border-radius: 12px; background: #fff; color: #1a1e1f; font-size: .85rem; font-weight: 800; }
.age-marker img { width: 48px; height: 60px; object-fit: contain; }
.age-scroll-hint { display: none; margin: 2px 0 0; font-size: .75rem; color: #c2d8ff; }
.form-status, .privacy-note, .save-error { margin: 0; font-size: .8rem; }
.form-status { color: #ffdc5a; }
.privacy-note { color: #c2d8ff; }
.save-error { color: #ffd1cb; }
.confirm-button { justify-self: start; min-height: 52px; min-width: 190px; padding: 12px 24px; border: 0; border-radius: 14px; background: #ffd440; color: #112760; font-size: 1.1rem; font-weight: 800; }
.confirm-button:disabled { background: #667bad; color: #d5def3; cursor: not-allowed; }
button:focus-visible, input:focus-visible { outline: 3px solid #ffdc5a; outline-offset: 3px; }
@media (max-width: 760px) { .age-scroll-hint { display: block; } .confirm-button { justify-self: stretch; } }
</style>
