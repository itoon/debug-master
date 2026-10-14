<template>
  <dialog ref="dialog" class="practice-summary" :aria-labelledby="titleId" @cancel.prevent>
    <section class="summary-card">
      <p class="summary-brand">{{ t('brand') }}</p>
      <h1 :id="titleId" ref="heading" tabindex="-1">{{ t('practice.summaryTitle') }}</h1>
      <div class="summary-hero" aria-hidden="true">
        <span class="hero-glow" />
        <span class="hero-orbit" />
        <span class="hero-pad" />
        <img class="summary-codi" :src="PLAYER_POSES.win" width="128" height="128" alt="" draggable="false" />
        <svg v-for="star in 3" :key="star" class="hero-star" :class="`star-${star}`" viewBox="0 0 24 24" :style="{ '--twinkle-delay': `${(star - 1) * 380}ms` }">
          <path d="M12 1.5 15.1 8.9 22.5 12 15.1 15.1 12 22.5 8.9 15.1 1.5 12 8.9 8.9Z" />
          <path class="star-shine" d="m12 5 1.5 4.5L18 12l-4.5 1.5L12 18l-1.5-4.5L6 12l4.5-2.5Z" />
        </svg>
      </div>
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
import { PLAYER_POSES } from '../utils/playerSprites';
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
.summary-card { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: clamp(22px, 3vw, 32px); border: 1px solid #7faaff; border-radius: inherit; background: linear-gradient(155deg, #19387b, #0b214a); box-shadow: 0 20px 60px #020e36aa; animation: summary-arrive 380ms cubic-bezier(.2, .8, .2, 1) both; }
.summary-brand { color: #c9ddff; font-weight: 800; text-align: center; }
p, h1, dl, dd { margin: 0; }
h1 { width: 100%; color: #ffda53; font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 800; text-align: center; }
.summary-hero { position: relative; isolation: isolate; display: grid; place-items: center; width: min(240px, 100%); height: 168px; flex: none; pointer-events: none; }
.summary-codi { position: relative; width: 144px; height: 144px; object-fit: contain; animation: codi-arrive 650ms ease-out both; }
.hero-glow { position: absolute; inset: 0; background: radial-gradient(ellipse, #4b9aff35, #407dff14 45%, transparent 72%); }
.hero-orbit { position: absolute; width: 180px; height: 122px; border: 1px solid #91caff33; border-radius: 50%; transform: rotate(-18deg); }
.hero-pad { position: absolute; bottom: 5px; width: 144px; height: 14px; border: 1px solid #75cfff66; border-radius: 50%; background: linear-gradient(#469dff66, #1b62dc44); animation: pad-glow 2800ms ease-in-out infinite; }
.hero-star { position: absolute; width: 28px; height: 28px; fill: #ffda53; stroke: #fff3a2; stroke-width: .6; animation: star-twinkle 2600ms var(--twinkle-delay) ease-in-out infinite; }
.star-1 { left: 16px; top: 24px; }
.star-2 { right: 12px; top: 18px; width: 21px; height: 21px; fill: #87e7ff; stroke: #d6f8ff; }
.star-3 { right: 20px; bottom: 26px; width: 14px; height: 14px; }
.star-shine { fill: #fff6c7; stroke: none; }
.star-2 .star-shine { fill: #edfcff; }
.summary-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; width: 100%; }
.summary-metrics > div { animation: metric-pop 420ms 260ms cubic-bezier(.34, 1.56, .64, 1) backwards; min-width: 0; padding: 20px 8px; border: 1px solid #426493; border-radius: 16px; background: #091c3f66; text-align: center; }
dt { color: #d5e4ff; }
dd { margin-top: 12px; font-size: clamp(1.35rem, 3vw, 1.8rem); font-weight: 900; }
.summary-note { color: #c9ddff; text-align: center; font-size: .85rem; }
.home-action { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 14px 24px; border: 1px solid #ffe99a; border-radius: 14px; background: #ffda53; color: #102858; font: inherit; font-weight: 800; cursor: pointer; }
.home-action svg { width: 22px; height: 22px; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.home-action:hover { filter: brightness(1.08); }
.home-action:active { transform: translateY(1px); }
.home-action:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
.summary-metrics > div:nth-child(2) { animation-delay: 370ms; }
.summary-metrics > div:nth-child(3) { animation-delay: 480ms; }
@keyframes metric-pop { from { opacity: 0; transform: translateY(14px) scale(.85); } }
@keyframes summary-arrive { from { opacity: 0; transform: translateY(16px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes codi-arrive { 0% { transform: translateY(10px) scale(.85); } 55% { transform: translateY(-8px) scale(1.06); } 100% { transform: none; } }
@keyframes star-twinkle { 0%, 100% { opacity: .75; transform: scale(.88) rotate(-6deg); } 50% { opacity: 1; transform: scale(1.08) rotate(6deg); } }
@keyframes pad-glow { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
@media (max-width: 480px) { .summary-card { gap: 14px; } .summary-metrics { gap: 6px; } .summary-metrics > div { padding: 14px 4px; } dt { font-size: .8rem; } dd { font-size: 1.15rem; } }
@media (max-height: 560px) { .summary-card { gap: 12px; padding: 18px; } .summary-hero { width: 170px; height: 100px; } .summary-codi { width: 96px; height: 96px; } .hero-orbit { width: 120px; height: 80px; } .hero-pad { bottom: 0; width: 90px; height: 10px; } .star-1 { left: 0; top: 10px; width: 22px; height: 22px; } .star-2 { right: 2px; top: 2px; width: 16px; height: 16px; } .star-3 { right: 0; bottom: 8px; } .summary-metrics > div { padding: 12px 8px; } dd { margin-top: 6px; } }
@media (prefers-reduced-motion: reduce) { .summary-card, .summary-codi, .summary-metrics > div, .hero-star, .hero-pad { animation: none; } }
</style>
