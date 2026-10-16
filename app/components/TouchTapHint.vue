<template>
  <svg class="tap-finger" :class="{ 'is-hidden': hidden }" viewBox="0 0 32 40" fill="none" aria-hidden="true">
    <path d="M12 23V6a3 3 0 0 1 6 0v13l2-2a3 3 0 0 1 4 0l5 5v9c0 4-3 7-7 7h-7l-10-12a3 3 0 0 1 4-4l3 1Z" fill="white" stroke="#102754" stroke-width="2" stroke-linejoin="round" />
  </svg>
</template>

<script setup lang="ts">
const hidden = ref(false);
function syncVisibility(): void { hidden.value = document.hidden; }
onMounted(() => {
  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();
});
onBeforeUnmount(() => document.removeEventListener('visibilitychange', syncVisibility));
</script>

<style scoped>
.tap-finger { position: absolute; width: 26px; height: 34px; right: -8px; bottom: -12px; z-index: 2; pointer-events: none; animation: tap-guide 1100ms ease-in-out infinite; }
.tap-finger.is-hidden { animation-play-state: paused; }
@keyframes tap-guide { 0%, 100% { transform: translateY(3px) scale(.94); } 50% { transform: translateY(-5px); } }
@media (prefers-reduced-motion: reduce) { .tap-finger { animation: none; } }
</style>
