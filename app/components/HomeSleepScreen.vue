<template>
  <button ref="wakeButton" type="button" class="home-sleep-screen" :aria-label="t('sleep.wake')"
    :style="{ '--sleep-float-ms': `${homeConfig.sleepScreen.floatMs}ms`, '--sleep-transition-ms': `${homeConfig.sleepScreen.transitionMs}ms` }"
    @pointerdown.stop.prevent="wake" @pointermove.stop="wakeOnMouseMove" @wheel.stop.prevent="wake"
    @keydown.stop.prevent @keyup.stop.prevent="wake" @click.stop.prevent="wake">
    <span class="sleep-logo-wrap"><img class="sleep-logo" :src="sleepLogo" width="1448" height="980" alt="Debug Master" draggable="false" /></span>
    <span class="sleep-prompt">{{ t('sleep.wake') }}</span>
  </button>
</template>
<script setup lang="ts">
import sleepLogo from '../assets/brand/logo-sleep.png';
import { homeConfig } from '../data/home-config';
import { useGameI18n } from '../composables/useGameI18n';
const emit = defineEmits<{ wake: [input: 'keyboard' | 'pointer']; unlockAudio: [] }>();
const { t } = useGameI18n();
const wakeButton = ref<HTMLButtonElement | null>(null);
let waking = false;
function wake(event: Event): void {
  if (waking) return;
  waking = true;
  if (event.type !== 'pointermove') emit('unlockAudio');
  emit('wake', event instanceof KeyboardEvent ? 'keyboard' : 'pointer');
}
function wakeOnMouseMove(event: PointerEvent): void {
  if (event.pointerType === 'mouse' && (event.movementX !== 0 || event.movementY !== 0)) wake(event);
}
// Wake on key release so held Enter/Space cannot also choose the first mode.
onMounted(() => wakeButton.value?.focus({ preventScroll: true }));
</script>
<style scoped>
.home-sleep-screen { box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 20px; width: 100%; height: 100%; min-height: calc(100dvh - 28px); padding: 20px 16px; overflow: hidden; border: 0; border-radius: 18px; background: transparent; color: #d4e6ff; font: inherit; cursor: pointer; }
.sleep-logo-wrap { display: block; width: min(90vw, 115dvh, 1200px); max-width: 100%; }
.sleep-logo { display: block; width: 100%; height: auto; filter: drop-shadow(0 24px 28px #03113288); animation: sleep-float var(--sleep-float-ms) ease-in-out infinite; }
.sleep-prompt { font-size: clamp(.85rem, 1.3vw, 1.1rem); font-weight: 700; text-align: center; }
.home-sleep-screen:focus-visible { outline: 2px solid #c7e7ff; outline-offset: -4px; }
.home-sleep-screen.sleep-switch-enter-active { transition: opacity 220ms ease; }
.home-sleep-screen.sleep-switch-enter-from { opacity: 0; }
.home-sleep-screen.sleep-switch-leave-active { transition: opacity var(--sleep-transition-ms) ease; pointer-events: none; }
.sleep-switch-leave-active .sleep-logo-wrap { transition: transform var(--sleep-transition-ms) cubic-bezier(.6, 0, .2, 1); }
.home-sleep-screen.sleep-switch-leave-to { opacity: 0; }
.sleep-switch-leave-to .sleep-logo-wrap { transform: translateY(-110dvh); }
@keyframes sleep-float { 0%, 100% { transform: translateY(12px); } 50% { transform: translateY(-12px); } }
@media (max-height: 560px) { .home-sleep-screen { gap: 10px; padding: 12px; } .sleep-logo-wrap { width: min(88vw, 103dvh, 1200px); } }
@media (prefers-reduced-motion: reduce) { .sleep-logo { animation: none; } .home-sleep-screen, .sleep-logo-wrap { transition: none !important; transform: none !important; } }
</style>
