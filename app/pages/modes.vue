<template>
  <DocShell :eyebrow="t('home.team')" :title="t('modes.title')">
    <template #subtitle>{{ t('modes.description') }}</template>
    <template #toolbar>
      <div class="modes-toolbar">
        <span class="summary">{{ t('modes.summary', { count: enabledIds.length }) }} · {{ enabledIds.length === 1 ? t('modes.layout1') : t('modes.layoutMany', { count: enabledIds.length }) }}</span>
        <span class="source">{{ customized ? t('modes.usingSaved') : t('modes.usingDefaults') }}</span>
        <button type="button" class="reset-button" :disabled="!loaded || (!customized && !loadError) || saving" @click="resetModes">{{ t('modes.reset') }}</button>
        <NuxtLink to="/" class="home-link">{{ t('modes.openHome') }}</NuxtLink>
      </div>
    </template>
    <p v-if="loadError" class="page-error" role="alert">{{ t('modes.loadError') }}</p>
    <p class="status" role="status" :class="{ error: saveError }">{{ status }}</p>
    <form class="duration-settings" @submit.prevent="saveTime">
      <div class="duration-copy"><label for="competition-minutes">{{ t('modes.duration') }}</label><p id="duration-help">{{ t('modes.durationHelp', { min: competitionTime.minMinutes, max: competitionTime.maxMinutes }) }}</p></div>
      <div class="duration-entry"><input id="competition-minutes" v-model="minutesDraft" type="number" inputmode="numeric" required step="1"
        :min="competitionTime.minMinutes" :max="competitionTime.maxMinutes" :disabled="!loaded || saving" :aria-invalid="minutesInvalid || undefined"
        :aria-describedby="minutesInvalid ? 'duration-help duration-error' : 'duration-help'" @focus="editingMinutes = true" @blur="editingMinutes = false" />
        <span>{{ t('modes.minutes') }}</span><button type="submit" class="reset-button" :disabled="!loaded || saving || parsedMinutes === null || !durationDirty">{{ t('modes.saveDuration') }}</button></div>
      <p v-if="minutesInvalid" id="duration-error" class="page-error" role="status">{{ t('modes.durationInvalid', { min: competitionTime.minMinutes, max: competitionTime.maxMinutes }) }}</p>
    </form>
    <ul class="mode-list" :class="{ loading: !loaded }">
      <li v-for="mode in homeConfig.modes" :key="mode.id" class="mode-row" :class="{ on: isOn(mode.id) }">
        <img class="thumb" :src="thumbnailUrl(mode)" alt="" draggable="false" />
        <div class="info">
          <h2><ModeBadge :mode="mode.id" />{{ t(mode.nameKey) }}</h2>
          <p>{{ mode.id }} · {{ t(`difficulty.${mode.id}`) }} · {{ t('home.levels', { from: mode.levelRange[0], to: mode.levelRange[1] }) }} · {{ formatClock(durationSec * 1000) }}</p>
          <p v-if="isLastOn(mode.id)" class="hint">{{ t('modes.lastOne') }}</p>
        </div>
        <button type="button" role="switch" class="switch" :aria-checked="isOn(mode.id)" :aria-label="t('modes.toggleLabel', { mode: t(mode.nameKey) })"
          :disabled="!loaded || saving || isLastOn(mode.id)" @click="toggle(mode)">
          <span class="track" aria-hidden="true"><span class="knob" /></span>
          <span class="state">{{ isOn(mode.id) ? t('modes.on') : t('modes.off') }}</span>
        </button>
      </li>
    </ul>
  </DocShell>
</template>

<script setup lang="ts">
import { competitionTime, homeConfig, isCompetitionTime, type ChallengeId, type ChallengeMode } from '../data/home-config';
import { createLocalRepositories } from '../storage/LocalStorageAdapter';
import { useGameI18n } from '../composables/useGameI18n';
import { useModeSettings } from '../composables/useModeSettings';
import { formatClock } from '../utils/ranking';

const { t } = useGameI18n();
const repositories = createLocalRepositories();
const { enabledIds, durationSec, customized, loaded, loadError, setEnabled, setDuration, reset } = useModeSettings(repositories.modes);
const baseURL = useRuntimeConfig().app.baseURL;
const saving = ref(false);
const saveError = ref(false);
const status = ref('');
const minutesDraft = ref<string | number>(competitionTime.defaultSeconds / 60);
const editingMinutes = ref(false);
const parsedMinutes = computed(() => {
  const text = String(minutesDraft.value).trim();
  const minutes = Number(text);
  return /^\d+$/.test(text) && isCompetitionTime(minutes * 60) ? minutes : null;
});
const minutesInvalid = computed(() => parsedMinutes.value === null);
const durationDirty = computed(() => parsedMinutes.value !== null && parsedMinutes.value * 60 !== durationSec.value);
watch(durationSec, value => { if (!editingMinutes.value) minutesDraft.value = value / 60; }, { immediate: true });

function isOn(id: ChallengeId): boolean { return enabledIds.value.includes(id); }
function isLastOn(id: ChallengeId): boolean { return isOn(id) && enabledIds.value.length === 1; }
function thumbnailUrl(mode: ChallengeMode): string {
  return `${baseURL.endsWith('/') ? baseURL : `${baseURL}/`}${mode.thumbnail}`;
}
async function run(action: () => Promise<void>, done: () => string): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  saveError.value = false;
  try {
    await action();
    status.value = done();
  } catch {
    saveError.value = true;
    status.value = t('modes.saveError');
  } finally {
    saving.value = false;
  }
}
function toggle(mode: ChallengeMode): Promise<void> {
  return run(() => setEnabled(mode.id, !isOn(mode.id)), () => t('modes.saved', { count: enabledIds.value.length }));
}
function resetModes(): Promise<void> {
  return run(async () => { await reset(); minutesDraft.value = durationSec.value / 60; }, () => t('modes.resetDone'));
}
function saveTime(): Promise<void> | undefined {
  const minutes = parsedMinutes.value;
  if (!loaded.value || minutes === null || !durationDirty.value) return;
  return run(() => setDuration(minutes * 60), () => t('modes.durationSaved', { minutes }));
}
</script>

<style scoped>
.modes-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 16px; font-size: .85rem; }
.summary { font-weight: 800; }
.source { opacity: .8; }
.reset-button, .home-link { display: inline-flex; align-items: center; min-height: 44px; padding: 8px 14px; border: 1px solid #86b4ff; border-radius: 10px; background: #fff; color: #142c54; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; }
.reset-button:disabled { opacity: .5; cursor: default; }
.status { min-height: 1.4em; margin: 0 0 12px; color: #1d6b3a; font-weight: 700; }
.status.error, .page-error { color: #a1283a; }
.duration-settings { display: flex; align-items: center; flex-wrap: wrap; gap: 12px 20px; margin-bottom: 18px; padding: 16px; border: 1px solid #b7cef0; border-radius: 14px; background: #f2f7ff; color: #142c54; }
.duration-copy { flex: 1 1 260px; }
.duration-copy label { font-size: 1rem; font-weight: 800; }
.duration-copy p { margin: 4px 0 0; color: #4b5d7a; font-size: .8rem; line-height: 1.5; }
.duration-entry { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: .85rem; }
.duration-entry input { box-sizing: border-box; width: 76px; min-height: 44px; padding: 8px; border: 1px solid #7499cf; border-radius: 10px; background: #fff; color: #142c54; font: inherit; font-size: 16px; }
.duration-entry input[aria-invalid="true"] { border-color: #a1283a; }
.duration-entry input:focus-visible { outline: 3px solid #ffd440; outline-offset: 3px; }
.duration-settings > .page-error { flex-basis: 100%; margin: 0; font-size: .85rem; }
.mode-list { display: grid; gap: 14px; margin: 0; padding: 0; list-style: none; }
.mode-list.loading { visibility: hidden; }
.mode-row { display: grid; grid-template-columns: 180px minmax(0, 1fr) auto; align-items: center; gap: 18px; padding: 12px 18px 12px 12px; border: 2px solid #d2e0f4; border-radius: 16px; background: #fff; transition: border-color 160ms ease, background 160ms ease; }
.mode-row.on { border-color: #4f8cff; background: #f2f7ff; }
.thumb { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 10px; background: #0b3a92; }
.mode-row:not(.on) .thumb { filter: grayscale(.85); opacity: .6; }
.info { min-width: 0; }
.info h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; color: #142c54; font-size: 1.25rem; font-weight: 800; }
.info h2 :deep(.mode-badge) { width: 40px; flex: none; }
.info p { margin: 0; color: #4b5d7a; font-size: .85rem; }
.info .hint { margin-top: 6px; color: #8a5a00; font-weight: 700; }
.switch { display: inline-flex; align-items: center; gap: 10px; min-height: 48px; padding: 6px 10px; border: 0; border-radius: 12px; background: none; color: #142c54; font: inherit; font-weight: 800; cursor: pointer; }
.switch:disabled { cursor: not-allowed; opacity: .55; }
.track { position: relative; width: 56px; height: 32px; border-radius: 999px; background: #c3cddd; transition: background 160ms ease; }
.knob { position: absolute; top: 4px; left: 4px; width: 24px; height: 24px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .25); transition: transform 160ms ease; }
.switch[aria-checked="true"] .track { background: #2f6fed; }
.switch[aria-checked="true"] .knob { transform: translateX(24px); }
.state { min-width: 2.2em; text-align: left; }
button:focus-visible, .home-link:focus-visible { outline: 3px solid #ffd440; outline-offset: 3px; }
@media (max-width: 640px) {
  .mode-row { grid-template-columns: 96px minmax(0, 1fr); }
  .switch { grid-column: 1 / -1; justify-self: end; }
}
@media (prefers-reduced-motion: reduce) {
  .mode-row, .track, .knob { transition: none; }
}
</style>
