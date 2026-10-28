<template>
  <dialog ref="dialog" class="rotate-dialog" :aria-labelledby="titleId" :aria-describedby="descriptionId" @cancel.prevent @close="keepOpen">
    <div class="rotate-card">
      <svg class="rotate-icon" viewBox="0 0 112 112" fill="none" aria-hidden="true">
        <g class="device"><rect x="36" y="20" width="40" height="72" rx="8" /><path d="M50 28h12M52 83h8" /></g>
        <path class="rotate-arrow" d="M19 57a37 37 0 0 1 62-27m0-13v13H68M93 55a37 37 0 0 1-62 27m0 13V82h13" />
      </svg>
      <h2 :id="titleId" ref="heading" tabindex="-1">{{ t('game.rotateTitle') }}</h2>
      <p :id="descriptionId">{{ t('game.rotateDescription') }}</p>
      <p v-if="timed" class="timer-note">{{ t('game.rotateTimer') }}</p>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGameI18n } from '../composables/useGameI18n'
const props = defineProps<{ active: boolean; timed: boolean }>()
const { t } = useGameI18n()
const titleId = useId()
const descriptionId = useId()
const dialog = ref<HTMLDialogElement | null>(null)
const heading = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null
let observer: MutationObserver | null = null
let mounted = false
function front(): void {
  if (!mounted || !props.active || !dialog.value) return
  // A result/setup dialog can open while the device is sideways. Keep the rotate prompt on top.
  if (dialog.value.open) dialog.value.close()
  dialog.value.showModal()
  heading.value?.focus({ preventScroll: true })
}
function keepOpen(): void {
  if (props.active && !dialog.value?.open) void nextTick(front)
}
function sync(): void {
  if (props.active) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    front()
  } else {
    dialog.value?.close()
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    previousFocus = null
  }
}
onMounted(() => {
  mounted = true
  observer = new MutationObserver(records => {
    if (props.active && records.some(r => r.target instanceof HTMLDialogElement && r.target !== dialog.value && r.target.open)) void nextTick(front)
  })
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] })
  sync()
})
watch(() => props.active, sync, { flush: 'post' })
onBeforeUnmount(() => { mounted = false; observer?.disconnect(); dialog.value?.close() })
</script>

<style scoped>
.rotate-dialog { width: 100vw; max-width: none; height: 100dvh; max-height: none; margin: 0; padding: max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left)); border: 0; background: var(--cv-navy-900); color: var(--cv-on-dark); overflow-y: auto; touch-action: manipulation; }
.rotate-dialog::backdrop { background: var(--cv-navy-900); }
.rotate-card { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; }
.rotate-icon { flex: none; width: clamp(80px, 22dvh, 128px); height: clamp(80px, 22dvh, 128px); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
.device { stroke: var(--cv-on-dark); transform-origin: 56px 56px; animation: rotate-device 2.4s ease-in-out infinite; }
.rotate-arrow { stroke: var(--cv-yellow); }
h2 { margin: 0; font-size: clamp(1.3rem, 4dvh, 1.8rem); font-weight: 800; color: var(--cv-yellow); }
h2:focus { outline: none; }
p { max-width: 460px; margin: 0; color: #c4dcff; line-height: 1.6; }
.timer-note { font-size: .85rem; }
@keyframes rotate-device { 0%, 15% { transform: rotate(-90deg); } 60%, 100% { transform: rotate(0); } }
@media (prefers-reduced-motion: reduce) { .device { animation: none; } }
</style>
