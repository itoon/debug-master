<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <template v-if="name === 'gamepad'"><path d="M6 8h12c2 0 3 2 3.5 5l.5 4c.3 2-1.5 3-3 1.5L16 16H8l-3 2.5C3.5 20 1.7 19 2 17l.5-4C3 10 4 8 6 8Z" /><path d="M6 11v4m-2-2h4m8-1h.1m2 2h.1M9 8V6h6" /></template>
    <template v-else-if="name === 'timer'"><circle cx="12" cy="14" r="8" /><path d="M12 10v4l2 2M9 2h6m-3 0v4m6 1 2-2" /></template>
    <template v-else-if="name === 'users'"><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2" /></template>
    <template v-else-if="name === 'link'"><path d="m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m3 1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 0) scale(.92)" /></template>
    <template v-else-if="name === 'screen'"><rect x="3" y="3" width="18" height="13" rx="2" /><path d="M8 21h8m-4-5v5m0-8V6m-3 3 3-3 3 3" /></template>
    <template v-else-if="name === 'logout'"><path d="M9 4H4v16h5m6-12 4 4-4 4M8 12h11" /></template>
    <template v-else-if="name === 'scan'"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3M3 12h18" /></template>
    <template v-else-if="name === 'rocket'"><path d="M10 14 7 11c2-5 6-8 13-7 1 7-2 11-7 13l-3-3Zm-3-3-3 1-2 5 6-1m5 1-1 5 5-2 1-5M5 19l-2 2" /><circle cx="15" cy="9" r="2" /></template>
    <template v-else-if="name === 'orbit'"><circle cx="12" cy="12" r="2" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-35 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(35 12 12)" /></template>
    <template v-else-if="name === 'trophy'"><path d="M7 3h10v6a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4m-4 2v7m-4 0h8" /></template>
  </svg>
</template>

<script setup lang="ts">
defineProps<{ name: 'gamepad' | 'timer' | 'users' | 'link' | 'screen' | 'logout' | 'scan' | 'rocket' | 'orbit' | 'trophy' }>();
</script>
