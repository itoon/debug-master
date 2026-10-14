<template>
  <dialog ref="dialog" class="returning-dialog" :aria-labelledby="titleId" @cancel.prevent="!busy && emit('close')">
    <header><h2 :id="titleId">{{ t('player.returnTitle') }}</h2><button ref="closeButton" type="button" class="close-button" :disabled="busy" :aria-label="t('player.closeProfile')" @click="emit('close')">×</button></header>
    <img class="profile-image" :src="avatarSrc(player.avatarId)" :alt="t('home.avatar')" draggable="false" />
    <p class="profile-name">{{ player.name }}</p>
    <p class="profile-age">{{ validAge ? t('home.years', { age: player.age! }) : t('player.ageUnknown') }}</p>
    <dl class="profile-score">
      <dt>{{ t('player.latestScore') }}</dt>
      <dd :class="{ 'score-unavailable': !latestScore }">{{ latestScore ? latestScore.score.toLocaleString('th-TH') : t('player.scoreUnavailable') }}</dd>
    </dl>
    <p v-if="!canReuse" class="profile-note">{{ t('player.incomplete') }}</p>
    <p v-if="error" class="profile-error" role="alert">{{ error }}</p>
    <div class="profile-actions">
      <button type="button" class="primary-action" :disabled="busy || !canReuse" @click="emit('reuse')">{{ t('player.useExisting') }}<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg></button>
      <button type="button" class="secondary-action" :disabled="busy" @click="emit('create')">{{ t('player.createNew') }}</button>
    </div>
  </dialog>
</template>
<script setup lang="ts">
import type { Score } from '../types/debug-game';
import { homeConfig } from '../data/home-config';
import { useGameI18n } from '../composables/useGameI18n';
import { usePlayerAvatar } from '../composables/usePlayerAvatar';
const props = defineProps<{ player: Score; latestScore?: Score | null; busy?: boolean; error?: string }>();
const emit = defineEmits<{ close: []; reuse: []; create: [] }>();
const { t } = useGameI18n();
const avatarSrc = usePlayerAvatar();
const dialog = ref<HTMLDialogElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const titleId = useId();
const validAge = computed(() => homeConfig.ages.includes(props.player.age as number));
const canReuse = computed(() => validAge.value && props.player.name.trim().length > 0 && props.player.name.trim().length <= homeConfig.nicknameMaxLength);
onMounted(() => { dialog.value?.showModal(); closeButton.value?.focus(); });
onBeforeUnmount(() => dialog.value?.close());
</script>
<style scoped>
.returning-dialog { box-sizing: border-box; width: min(480px, calc(100% - 32px)); max-height: calc(100dvh - 32px); overflow-y: auto; padding: 26px; margin: auto; border: 1px solid #87b0ef; border-radius: 24px; background: linear-gradient(155deg, #19387b, #0b214a); color: #fff; box-shadow: var(--cv-shadow-window); animation: profile-arrive 300ms cubic-bezier(.2, .8, .2, 1); }
.returning-dialog::backdrop { background: #03102caa; backdrop-filter: blur(6px); }
header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
h2 { margin: 0; font-size: 1.4rem; color: #ffdc53; }
button { font: inherit; font-weight: 800; cursor: pointer; }
.close-button { flex: none; width: 48px; height: 48px; border: 1px solid #87b0ef; border-radius: 12px; background: #102858; color: #fff; font-size: 1.6rem; }
.profile-image { display: block; width: 112px; height: 112px; margin: 24px auto 16px; object-fit: contain; border: 4px solid #e5f2ff; border-radius: 50%; background: #cceaff; }
.profile-name { margin: 0; font-size: 1.5rem; font-weight: 800; text-align: center; overflow-wrap: anywhere; }
.profile-age { margin: 6px 0 14px; text-align: center; color: #cce1ff; }
.profile-score { margin: 0 0 24px; text-align: center; }
.profile-score dt { color: #cce1ff; font-size: .9rem; }
.profile-score dd { margin: 4px 0 0; color: var(--cv-yellow); font-size: 2rem; font-weight: 800; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.profile-score .score-unavailable { font-size: 1rem; color: #cce1ff; }
.profile-note, .profile-error { line-height: 1.5; color: #ffe0a5; }
.profile-actions { display: grid; gap: 10px; }
.profile-actions button { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 12px 18px; border-radius: 12px; }
.primary-action { border: 1px solid #ffe99a; background: #ffda53; color: #102858; }
.primary-action svg { width: 20px; height: 20px; }
.secondary-action { border: 1px solid #709adc; background: #19386c; color: #fff; }
button:not(:disabled):hover { filter: brightness(1.08); }
button:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
button:disabled { opacity: .55; cursor: default; }
@keyframes profile-arrive { from { opacity: 0; transform: scale(.9); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .returning-dialog { animation: none; } }
</style>
