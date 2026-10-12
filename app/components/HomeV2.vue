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
          <span class="mode-letter" aria-hidden="true">{{ mode.id }}</span>
          <div>
            <h2 :id="`mode-${mode.id}-title`">{{ mode.id }} · {{ t(`difficulty.${mode.id}`) }} <span>{{ t(mode.nameKey) }}</span></h2>
            <p>{{ t('home.levels', { from: mode.levelRange[0], to: mode.levelRange[1] }) }} · {{ t('home.limit', { time: formatClock(mode.timeLimit * 1000) }) }}</p>
          </div>
        </header>
        <ChallengeRanking :repository="repository" :board="boardFor(mode)" />
        <button type="button" class="launch-button" :disabled="!valid || busy" aria-describedby="player-form-status"
          @click="launch(mode)">{{ t('home.start') }} <span aria-hidden="true">→</span></button>
      </section>
    </div>

    <form class="player-form" aria-labelledby="player-form-title" @submit.prevent>
      <div class="player-intro">
        <img :src="PLAYER_SPRITES.down" alt="Codi" draggable="false" />
        <h2 id="player-form-title">{{ t('home.player') }}</h2>
      </div>
      <div class="nickname-field">
        <label for="home-nickname">{{ t('home.nickname') }}</label>
        <input id="home-nickname" v-model="nickname" type="text" :maxlength="homeConfig.nicknameMaxLength"
          :placeholder="t('home.nicknamePlaceholder')" autocomplete="off" autocapitalize="off" spellcheck="false"
          required aria-describedby="nickname-note" />
        <small id="nickname-note">{{ t('home.nicknameLimit', { max: homeConfig.nicknameMaxLength }) }}</small>
      </div>
      <fieldset class="age-field">
        <legend>{{ t('home.age') }}</legend>
        <div class="home-age-grid">
          <button v-for="option in homeConfig.ages" :key="option" type="button" :aria-pressed="age === option"
            :class="{ selected: age === option }" @click="age = option">{{ t('home.years', { age: option }) }}</button>
        </div>
      </fieldset>
      <div class="form-notes">
        <p id="player-form-status" role="status">{{ formStatus }}</p>
        <p>{{ t('home.privacy') }}</p>
        <p v-if="error" class="save-error" role="alert">{{ error }}</p>
      </div>
    </form>

    <footer class="home-footer">{{ t('home.team') }}: <NuxtLink to="/review">{{ t('home.review') }}</NuxtLink> · <NuxtLink to="/elements">{{ t('home.elements') }}</NuxtLink></footer>
  </main>
</template>

<script setup lang="ts">
import { homeConfig, type ChallengeMode } from "../data/home-config";
import { useGameI18n } from "../composables/useGameI18n";
import type { ScoreRepository } from "../storage/contracts";
import { formatClock, type RankingBoard } from "../utils/ranking";
import { PLAYER_SPRITES } from "../utils/playerSprites";

defineProps<{ repository: ScoreRepository; error?: string; busy?: boolean }>();
const emit = defineEmits<{ start: [player: { nickname: string; age: number }, mode: ChallengeMode] }>();
const { t } = useGameI18n();
const nickname = ref("");
const age = ref<number | null>(null);
const normalizedName = computed(() => nickname.value.trim());
const valid = computed(() => normalizedName.value.length > 0 && normalizedName.value.length <= homeConfig.nicknameMaxLength && homeConfig.ages.includes(age.value as number));
const formStatus = computed(() => t(valid.value ? "home.ready" : !normalizedName.value && age.value === null ? "home.requiredBoth" : !normalizedName.value ? "home.requiredName" : "home.requiredAge"));
function boardFor(mode: ChallengeMode): RankingBoard {
  return { challengeId: mode.challengeId, setId: homeConfig.levelSetId, mode: "timer", timeLimitSec: mode.timeLimit };
}
function launch(mode: ChallengeMode) {
  if (valid.value && age.value !== null) emit("start", { nickname: normalizedName.value, age: age.value }, mode);
}
</script>

<style scoped>
.home-v2 { height: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr) auto auto; gap: 12px; max-width: 1740px; margin: 0 auto; color: #fff; }
.home-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.brand { margin: 0 0 4px; font-size: .85rem; font-weight: 800; color: #b7d8ff; }
h1 { margin: 0; font-size: clamp(1.4rem, 2vw, 2rem); line-height: 1.3; font-weight: 800; }
.intro { margin: 0; font-size: .9rem; text-align: right; color: #d8e8ff; }
.intro small { display: block; margin-top: 5px; font-size: .75rem; }
.mode-boards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; min-height: 0; }
.mode-board { --accent: #2268f5; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 10px; padding: 14px; min-width: 0; min-height: 0; border: 1px solid #a8c9ff; border-top: 4px solid var(--accent); border-radius: 20px; color: var(--cv-heading); background: #fff; box-shadow: var(--cv-shadow-window); }
.mode-B { --accent: #8455d5; }
.mode-C { --accent: #d66a25; }
.mode-heading { display: flex; align-items: center; gap: 12px; }
.mode-letter { display: grid; place-items: center; flex: 0 0 40px; height: 40px; border-radius: 12px; background: var(--accent); color: white; font-weight: 800; font-size: 1.3rem; }
.mode-heading h2 { margin: 0; font-size: 1.05rem; font-weight: 800; }
.mode-heading h2 span { display: inline; font-size: .9rem; margin-left: 5px; }
.mode-heading p { margin: 3px 0 0; font-size: .78rem; color: #526079; }
.launch-button { min-height: 48px; display: flex; align-items: center; justify-content: center; gap: 20px; border: 0; border-radius: 12px; background: var(--accent); color: white; font: inherit; font-weight: 800; font-size: 1.05rem; cursor: pointer; }
.launch-button:disabled { background: #e0e7f1; color: #58677e; cursor: not-allowed; }
.launch-button:focus-visible, input:focus-visible, .home-age-grid button:focus-visible, a:focus-visible { outline: 3px solid #ffc83d; outline-offset: 3px; }
.player-form { display: grid; grid-template-columns: minmax(150px, .65fr) minmax(210px, 1fr) minmax(420px, 1.6fr); column-gap: 24px; row-gap: 8px; padding: 14px 20px; border: 1px solid #91bbff; border-radius: 20px; background: #142f80; }
.player-intro { display: flex; align-items: center; gap: 14px; }
.player-intro img { width: 62px; height: 76px; object-fit: contain; }
.player-intro h2 { max-width: 160px; margin: 0; font-size: 1.05rem; font-weight: 800; line-height: 1.4; }
.nickname-field { display: flex; flex-direction: column; justify-content: center; gap: 5px; }
label, legend { font-size: .9rem; font-weight: 800; }
.nickname-field input { width: 100%; min-height: 48px; padding: 8px 14px; border: 2px solid #8db7ff; border-radius: 12px; background: white; color: #172b52; font: inherit; font-size: 1rem; }
.nickname-field small { color: #c2d8ff; font-size: .7rem; }
.age-field { margin: 0; padding: 0; border: 0; min-width: 0; }
.age-field legend { margin-bottom: 5px; }
.home-age-grid { display: grid; grid-template-columns: repeat(7, minmax(48px, 1fr)); gap: 5px; }
.home-age-grid button { min-height: 48px; border: 1px solid #6e98ee; border-radius: 9px; background: #0c225e; color: #fff; font: inherit; font-size: .85rem; font-weight: 700; cursor: pointer; }
.home-age-grid button.selected { background: #ffdc5a; color: #172b52; border-color: #ffdc5a; box-shadow: inset 0 0 0 2px #fff2b5; }
.form-notes { grid-column: 1 / -1; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 16px; font-size: .75rem; color: #c2d8ff; }
.form-notes p { margin: 0; }
#player-form-status { color: #ffdc5a; }
.save-error { flex-basis: 100%; color: #ffd1cb; }
.home-footer { text-align: center; color: #b7cbee; font-size: .7rem; }
.home-footer a { color: #fff; text-decoration: underline; text-underline-offset: 3px; }
@media (max-width: 1100px), (max-height: 680px) {
  .home-v2 { height: auto; min-height: 100%; grid-template-rows: auto auto auto auto; }
  .mode-board { min-height: 440px; grid-template-rows: auto auto auto; }
  .player-form { grid-template-columns: minmax(200px, 1fr) minmax(380px, 1.5fr); }
  .player-intro { grid-column: 1 / -1; }
  .player-intro h2 { max-width: none; }
  .player-intro img { height: 52px; width: 44px; }
}
@media (max-width: 1100px) {
  .mode-boards { grid-template-columns: 1fr; grid-row: 3; }
  .player-form { grid-row: 2; }
}
@media (max-width: 760px) {
  .home-header { display: block; }
  .intro { margin-top: 8px; text-align: left; }
  .mode-boards { grid-template-columns: 1fr; }
  .player-form { grid-row: 2; }
  .mode-boards { grid-row: 3; }
  .mode-board { min-height: 300px; }
  .player-form { grid-template-columns: minmax(0, 1fr); padding: 16px; }
  .player-intro, .form-notes { grid-column: 1; }
  .form-notes { flex-direction: column; gap: 8px; }
  .home-age-grid { grid-template-columns: repeat(7, minmax(0, 1fr)); }
}
@media (max-width: 420px) { .home-age-grid { grid-template-columns: repeat(4, minmax(48px, 1fr)); } }
</style>
