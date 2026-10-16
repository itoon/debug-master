<template>
  <button ref="wakeButton" type="button" class="home-sleep-screen" :aria-label="t('sleep.open')"
    :style="{ '--sleep-float-ms': `${homeConfig.sleepScreen.floatMs}ms`, '--sleep-transition-ms': `${homeConfig.sleepScreen.transitionMs}ms` }"
    @wheel.stop.prevent="wake" @click.stop.prevent="wake"
    @touchstart.passive="startTouch" @touchend.stop.prevent="endTouch" @touchcancel="touchStart = null"
    @keydown.space.stop.prevent @keyup.space.stop.prevent="wake" @keydown.enter.stop.prevent>
    <span class="sleep-logo-wrap"><img class="sleep-logo" :src="sleepLogo" width="1448" height="980" alt="Debug Master" draggable="false" /></span>
    <span class="sleep-prompt sleep-prompt-desktop">{{ t('sleep.wake') }}</span>
    <span class="sleep-prompt sleep-prompt-touch">{{ t('sleep.wakeTouch') }}</span>
  </button>
</template>
<script setup lang="ts">
// Rendered from the approved SVG: animate a decoded bitmap, not a million paths.
import sleepLogo from '../assets/brand/logo-sleep-display.png';
import { homeConfig } from '../data/home-config';
import { useGameI18n } from '../composables/useGameI18n';
const emit = defineEmits<{ wake: [input: 'keyboard' | 'pointer']; unlockAudio: [] }>();
const { t } = useGameI18n();
const baseURL = useRuntimeConfig().app.baseURL;
// Start decoding the local card art while the attract screen is visible.
useHead({ link: homeConfig.modes.map((mode) => ({ rel: 'preload', as: 'image', href: `${baseURL.endsWith('/') ? baseURL : `${baseURL}/`}${mode.thumbnail}` })) });
const wakeButton = ref<HTMLButtonElement | null>(null);
let waking = false;
let touchStart: { id: number; x: number; y: number } | null = null;
function startTouch(event: TouchEvent): void {
  const touch = event.touches.length === 1 ? event.touches[0] : undefined;
  touchStart = touch ? { id: touch.identifier, x: touch.clientX, y: touch.clientY } : null;
}
function endTouch(event: TouchEvent): void {
  const start = touchStart;
  touchStart = null;
  if (!start || event.touches.length) return;
  const touch = Array.from(event.changedTouches).find((item) => item.identifier === start.id);
  if (!touch) return;
  const dx = Math.abs(touch.clientX - start.x);
  const up = start.y - touch.clientY;
  const tap = dx <= 12 && Math.abs(up) <= 12;
  if (tap || (up >= 40 && up > dx)) wake(event);
}
function wake(event: Event): void {
  if (waking) return;
  waking = true;
  emit('unlockAudio');
  emit('wake', event instanceof KeyboardEvent ? 'keyboard' : 'pointer');
}
// Wake on Space release so a held key cannot also choose the first mode.
onMounted(() => wakeButton.value?.focus({ preventScroll: true }));
</script>
<style scoped>
.home-sleep-screen { box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 20px; width: 100%; height: 100%; min-height: calc(100dvh - 28px); padding: 20px 16px; overflow: hidden; border: 0; border-radius: 18px; background: transparent; color: #d4e6ff; font: inherit; cursor: pointer; }
.sleep-logo-wrap { display: block; width: min(90vw, 115dvh, 1200px); max-width: 100%; will-change: transform; }
.sleep-logo { display: block; width: 100%; height: auto; animation: sleep-float var(--sleep-float-ms) ease-in-out infinite; will-change: transform; }
.sleep-prompt { font-size: clamp(.85rem, 1.3vw, 1.1rem); font-weight: 700; text-align: center; }
.sleep-prompt-touch { display: none; }
.home-sleep-screen { touch-action: pinch-zoom; }
@media (max-width: 639px), (pointer: coarse) {
  .sleep-prompt-desktop { display: none; }
  .sleep-prompt-touch { display: inline; }
}
.home-sleep-screen:focus-visible { outline: 2px solid #c7e7ff; outline-offset: -4px; }
.home-sleep-screen.sleep-switch-enter-active { transition: opacity 220ms ease; }
.home-sleep-screen.sleep-switch-enter-from { opacity: 0; }
.home-sleep-screen.sleep-switch-leave-active { transition: opacity var(--sleep-transition-ms) ease; pointer-events: none; }
.sleep-switch-leave-active .sleep-logo-wrap { transition: transform var(--sleep-transition-ms) cubic-bezier(.6, 0, .2, 1); }
.home-sleep-screen.sleep-switch-leave-to { opacity: 0; }
.sleep-switch-leave-to .sleep-logo-wrap { transform: translate3d(0, -65dvh, 0); }
@keyframes sleep-float { 0%, 100% { transform: translate3d(0, 12px, 0); } 50% { transform: translate3d(0, -12px, 0); } }
@media (max-height: 560px) { .home-sleep-screen { gap: 10px; padding: 12px; } .sleep-logo-wrap { width: min(88vw, 103dvh, 1200px); } }
@media (prefers-reduced-motion: reduce) { .sleep-logo { animation: none; } .home-sleep-screen, .sleep-logo-wrap { transition: none !important; transform: none !important; } }
</style>
