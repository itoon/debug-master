<template>
  <div class="superhint-layer" :class="{ 'is-paused': hidden }" aria-hidden="true">
    <span v-for="marker in markers" :key="`${marker.row}-${marker.col}`" class="superhint-marker"
      :class="{ 'is-end': marker.end }" :style="{ '--hint-col': marker.col, '--hint-row': marker.row, '--hint-delay': `${(marker.step * 120) % 1000 - 1000}ms` }">
      <span class="hint-circle hint-outer" />
      <span class="hint-circle hint-inner" />
      <span v-if="marker.end" class="hint-end-ring" />
    </span>
  </div>
</template>

<script setup lang="ts">
// Presentation only. Coordinates come from an isolated solveLevel preview.
const props = defineProps<{ path: readonly (readonly [number, number])[]; visitedCells?: ReadonlySet<string> }>();
const hidden = ref(false);
function syncVisibility(): void { hidden.value = document.hidden; }
onMounted(() => { syncVisibility(); document.addEventListener('visibilitychange', syncVisibility); });
onBeforeUnmount(() => document.removeEventListener('visibilitychange', syncVisibility));
const markers = computed(() => {
  const end = props.path.at(-1);
  const byCell = new Map<string, { row: number; col: number; step: number; end: boolean }>();
  props.path.slice(1).forEach(([row, col], step) => {
    const key = `${row}-${col}`;
    if (props.visitedCells?.has(key)) return;
    if (!byCell.has(key)) byCell.set(key, { row, col, step, end: row === end?.[0] && col === end?.[1] });
  });
  return [...byCell.values()];
});
</script>

<style scoped>
.superhint-layer { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.superhint-marker { position: absolute; left: calc(var(--pad) + var(--hint-col) * var(--pitch)); top: calc(var(--pad) + var(--hint-row) * var(--pitch)); width: var(--cell-size); height: var(--cell-size); display: grid; place-items: center; --hint-color: var(--cv-red); }
.hint-circle { grid-area: 1 / 1; border-radius: 50%; background: var(--hint-color); animation: superhint-blink 1s linear infinite; animation-delay: var(--hint-delay); }
.hint-outer { width: clamp(12px, calc(var(--cell-size) * .28), 32px); aspect-ratio: 1; }
.hint-inner { width: clamp(6px, calc(var(--cell-size) * .14), 16px); aspect-ratio: 1; }
.hint-end-ring { grid-area: 1 / 1; width: clamp(16px, calc(var(--cell-size) * .35), 40px); aspect-ratio: 1; border: 2px solid var(--hint-color); border-radius: 50%; opacity: .8; }
.is-paused .hint-circle { animation-play-state: paused; }
@keyframes superhint-blink { 0%, 100% { opacity: .4; } 50% { opacity: .7; } }
@media (prefers-reduced-motion: reduce) { .hint-circle { animation: none; opacity: .55; } }
</style>
