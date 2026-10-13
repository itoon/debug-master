<template>
  <div class="superhint-layer" :class="{ 'is-paused': hidden }" aria-hidden="true">
    <span v-for="marker in markers" :key="`${marker.row}-${marker.col}`" class="superhint-marker"
      :class="{ 'is-end': marker.end }" :style="{ '--hint-col': marker.col, '--hint-row': marker.row, '--hint-delay': `${(marker.step * 120) % 1000 - 1000}ms` }">
      <span class="hint-circle hint-outer" />
      <span class="hint-circle hint-inner" />
      <span v-for="layer in Math.min(marker.remaining - 1, 3)" :key="layer" class="hint-circle hint-repeat-ring" :style="{ '--hint-layer': layer }" />
      <span v-if="marker.end" class="hint-end-ring" />
    </span>
  </div>
</template>

<script setup lang="ts">
// Presentation only. Coordinates come from an isolated solveLevel preview.
const props = withDefaults(defineProps<{ path: readonly (readonly [number, number])[]; completedMoves?: number }>(), { completedMoves: 0 });
const hidden = ref(false);
function syncVisibility(): void { hidden.value = document.hidden; }
onMounted(() => { syncVisibility(); document.addEventListener('visibilitychange', syncVisibility); });
onBeforeUnmount(() => document.removeEventListener('visibilitychange', syncVisibility));
const markers = computed(() => {
  const end = props.path.at(-1);
  const byCell = new Map<string, { row: number; col: number; step: number; end: boolean; remaining: number }>();
  // path[0] is the initial standing position. Each correct input consumes
  // exactly one destination; later visits to that cell remain in the route.
  props.path.slice(props.completedMoves + 1).forEach(([row, col], offset) => {
    const key = `${row}-${col}`;
    const marker = byCell.get(key);
    if (marker) marker.remaining += 1;
    else byCell.set(key, { row, col, step: props.completedMoves + offset, end: row === end?.[0] && col === end?.[1], remaining: 1 });
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
.hint-repeat-ring { width: min(calc(var(--cell-size) * .8), calc(clamp(12px, calc(var(--cell-size) * .28), 32px) + var(--hint-layer) * 6px)); aspect-ratio: 1; border: 2px solid var(--hint-color); background: transparent; }
.hint-end-ring { grid-area: 1 / 1; width: clamp(16px, calc(var(--cell-size) * .35), 40px); aspect-ratio: 1; border: 2px solid var(--hint-color); border-radius: 50%; opacity: .8; }
.is-paused .hint-circle { animation-play-state: paused; }
@keyframes superhint-blink { 0%, 100% { opacity: .4; } 50% { opacity: .7; } }
@media (prefers-reduced-motion: reduce) { .hint-circle { animation: none; opacity: .55; } }
</style>
