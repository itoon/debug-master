<template>
  <span class="next-move-hint" :class="[`hint-${direction}`, { 'is-paused': hidden }]" aria-hidden="true">
    <svg viewBox="0 0 24 24"><path d="M6 4 19 12 6 20Z" /></svg>
  </span>
</template>

<script setup lang="ts">
import type { Direction } from '../types/debug-game';
defineProps<{ direction: Direction }>();
const hidden = ref(false);
function syncVisibility(): void { hidden.value = document.hidden; }
onMounted(() => { syncVisibility(); document.addEventListener('visibilitychange', syncVisibility); });
onBeforeUnmount(() => document.removeEventListener('visibilitychange', syncVisibility));
</script>

<style scoped>
.next-move-hint { --cue-size: clamp(24px, calc(var(--cell-size) * .5), 60px); --cue-x: 0px; --cue-y: 0px; position: absolute; width: var(--cue-size); height: var(--cue-size); pointer-events: none; z-index: 4; animation: next-move-nudge 850ms ease-in-out infinite; }
svg { display: block; width: 100%; height: 100%; overflow: visible; fill: #fff; stroke: var(--cv-navy-900); stroke-width: 2.5; stroke-linejoin: round; filter: drop-shadow(0 1px 2px #0009); }
.hint-right { left: calc(100% - var(--cue-size) / 2); top: calc(50% - var(--cue-size) / 2); --cue-x: 3px; }
.hint-left { right: calc(100% - var(--cue-size) / 2); top: calc(50% - var(--cue-size) / 2); --cue-x: -3px; }
.hint-left svg { rotate: 180deg; }
.hint-up { bottom: calc(100% - var(--cue-size) / 2); left: calc(50% - var(--cue-size) / 2); --cue-y: -3px; }
.hint-up svg { rotate: -90deg; }
.hint-down { top: calc(100% - var(--cue-size) / 2); left: calc(50% - var(--cue-size) / 2); --cue-y: 3px; }
.hint-down svg { rotate: 90deg; }
.is-paused { animation-play-state: paused; }
@keyframes next-move-nudge { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(var(--cue-x), var(--cue-y)); } }
@media (prefers-reduced-motion: reduce) { .next-move-hint { animation: none; } }
</style>
