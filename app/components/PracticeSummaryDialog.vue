<template>
  <dialog ref="dialog" class="practice-summary" :aria-labelledby="titleId" @cancel.prevent>
    <section class="summary-card">
      <p class="summary-brand">{{ t('brand') }}</p>
      <h1 :id="titleId" ref="heading" tabindex="-1">{{ t('practice.summaryTitle') }}</h1>
      <img class="summary-codi" :src="codiHappy" alt="" draggable="false" />
      <dl class="summary-metrics">
        <div>
          <dt>{{ t('summary.time') }}</dt>
          <dd>{{ formatClock(result.elapsedMs) }}</dd>
        </div>
        <div>
          <dt>{{ t('practice.summaryLevels') }}</dt>
          <dd>{{ t('practice.summaryLevelCount', { count: result.levelsCompleted }) }}</dd>
        </div>
        <div>
          <dt>{{ t('practice.summaryMistakes') }}</dt>
          <dd>{{ t('practice.summaryMistakeCount', { count: result.mistakes }) }}</dd>
        </div>
      </dl>
      <p class="summary-note">{{ t('practice.noRanking') }}</p>
      <button type="button" class="home-action" @click="emit('home')">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" /></svg>
        {{ t('flow.home') }}
      </button>
    </section>
  </dialog>
</template>

<script setup lang="ts">
import codiHappy from '../assets/sprites/cody-happy.webp';
import { useGameI18n } from '../composables/useGameI18n';
import type { PracticeSummary } from '../types/debug-game';
import { formatClock } from '../utils/ranking';

defineProps<{ result: PracticeSummary }>();
const emit = defineEmits<{ home: [] }>();
const { t } = useGameI18n();
const dialog = ref<HTMLDialogElement | null>(null);
const heading = ref<HTMLHeadingElement | null>(null);
const titleId = useId();
onMounted(() => {
  dialog.value?.showModal();
  heading.value?.focus({ preventScroll: true });
});
onBeforeUnmount(() => dialog.value?.close());
</script>

<style scoped>
.practice-summary { box-sizing: border-box; width: min(640px, calc(100% - 32px)); max-height: calc(100dvh - 32px); overflow-y: auto; scrollbar-width: none; margin: auto; padding: 0; border: 0; border-radius: 24px; background: transparent; color: #fff; }
.practice-summary::-webkit-scrollbar { display: none; }
.practice-summary::backdrop { background: #03102caa; backdrop-filter: blur(7px); }
.summary-card { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: clamp(22px, 3vw, 32px); border: 1px solid #7faaff; border-radius: inherit; background: linear-gradient(155deg, #19387b, #0b214a); box-shadow: 0 20px 60px #020e36aa; animation: summary-arrive 380ms cubic-bezier(.2, .8, .2, 1) both; }
.summary-brand { align-self: flex-start; color: #c9ddff; font-weight: 800; }
p, h1, dl, dd { margin: 0; }
h1 { align-self: flex-start; color: #ffda53; font-size: clamp(1.5rem, 3vw, 2rem); }
.summary-codi { width: 104px; height: 104px; object-fit: contain; animation: codi-arrive 650ms ease-out both; }
.summary-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; width: 100%; }
.summary-metrics > div { min-width: 0; padding: 20px 8px; border: 1px solid #426493; border-radius: 16px; background: #091c3f66; text-align: center; }
dt { color: #d5e4ff; }
dd { margin-top: 12px; font-size: clamp(1.35rem, 3vw, 1.8rem); font-weight: 900; }
.summary-note { color: #c9ddff; text-align: center; font-size: .85rem; }
.home-action { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 14px 24px; border: 1px solid #ffe99a; border-radius: 14px; background: #ffda53; color: #102858; font: inherit; font-weight: 800; cursor: pointer; }
.home-action svg { width: 22px; height: 22px; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.home-action:hover { filter: brightness(1.08); }
.home-action:active { transform: translateY(1px); }
.home-action:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
@keyframes summary-arrive { from { opacity: 0; transform: translateY(16px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes codi-arrive { 0% { transform: translateY(10px) scale(.85); } 55% { transform: translateY(-8px) scale(1.06); } 100% { transform: none; } }
@media (max-width: 480px) { .summary-card { gap: 14px; } .summary-metrics { gap: 6px; } .summary-metrics > div { padding: 14px 4px; } dt { font-size: .8rem; } dd { font-size: 1.15rem; } }
@media (max-height: 560px) { .summary-card { gap: 12px; padding: 18px; } .summary-codi { width: 64px; height: 64px; } .summary-metrics > div { padding: 12px 8px; } dd { margin-top: 6px; } }
@media (prefers-reduced-motion: reduce) { .summary-card, .summary-codi { animation: none; } }
</style>
