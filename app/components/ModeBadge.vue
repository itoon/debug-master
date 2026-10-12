<template>
  <svg class="mode-badge" viewBox="0 0 60 42" aria-hidden="true" focusable="false">
    <template v-if="mode !== 'C'">
      <path d="M4 14h19l-4 6H8zm6 9h11l-4 5h-4zM37 14h19l-4 6H41zm2 9h11l-3 5h-4z" fill="#e5f1ff" />
      <circle cx="30" cy="21" r="10" fill="#267aff" stroke="#10285b" stroke-width="2" />
      <path v-if="mode === 'B'" d="M30 11a10 10 0 0 1 0 20z" fill="#ffda42" />
      <circle cx="27" cy="18" r="3" fill="#9bdcff" />
    </template>
    <template v-else>
      <path d="M3 12h18l-3 6H7zm8 9h11l-4 5h-3zm28-9h18l-4 6H42zm-1 9h11l-4 5h-3z" fill="#ffdc42" />
      <path d="m30 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#ffcf35" stroke="#10285b" stroke-width="1.5" />
      <path d="m23 24 7 5 7-5M23 31l7 5 7-5" fill="none" stroke="#ffdc42" stroke-width="4" stroke-linejoin="round" />
    </template>
  </svg>
</template>

<script setup lang="ts">
import type { ChallengeId } from "../data/home-config";
defineProps<{ mode: ChallengeId }>();
</script>

<style scoped>
.mode-badge { width: 48px; height: 36px; flex: none; }
</style>
