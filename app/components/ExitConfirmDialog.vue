<template>
  <dialog ref="dialog" class="exit-dialog" :aria-labelledby="titleId" :aria-describedby="descriptionId" @cancel.prevent="emit('cancel')">
    <h2 :id="titleId">{{ t('exit.title') }}</h2>
    <p :id="descriptionId">{{ t('exit.description') }}</p>
    <p class="timer-note">{{ t('exit.timerContinues') }}</p>
    <div class="exit-actions">
      <button ref="cancelButton" type="button" class="keep-playing" @click="emit('cancel')">{{ t('exit.cancel') }}</button>
      <button type="button" class="confirm-exit" @click="emit('confirm')">{{ t('exit.confirm') }}</button>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { useGameI18n } from "../composables/useGameI18n";
const { t } = useGameI18n();
const emit = defineEmits<{ confirm: []; cancel: [] }>();
const dialog = ref<HTMLDialogElement | null>(null);
const cancelButton = ref<HTMLButtonElement | null>(null);
const titleId = useId();
const descriptionId = useId();
onMounted(() => { dialog.value?.showModal(); cancelButton.value?.focus(); });
onBeforeUnmount(() => dialog.value?.close());
</script>

<style scoped>
.exit-dialog { box-sizing: border-box; width: min(440px, calc(100% - 32px)); max-height: calc(100dvh - 32px); overflow-y: auto; margin: auto; padding: 26px; border: 1px solid #87b0ef; border-radius: 20px; background: #102858; color: #fff; box-shadow: 0 20px 60px #020e36aa; }
.exit-dialog::backdrop { background: #03102caa; backdrop-filter: blur(5px); }
h2 { margin: 0 0 12px; font-size: 1.4rem; }
p { margin: 0; line-height: 1.6; color: #d5e4ff; }
.timer-note { margin-top: 8px; font-size: .8rem; color: #9fbce8; }
.exit-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
button { flex: 1; min-height: 48px; padding: 10px 14px; border-radius: 12px; font: inherit; font-weight: 800; cursor: pointer; }
.keep-playing { border: 0; background: #ffda53; color: #102858; }
.confirm-exit { border: 1px solid #709adc; background: #19386c; color: #fff; }
button:hover { filter: brightness(1.08); }
button:active { transform: translateY(1px); }
button:focus-visible { outline: 3px solid #ffda53; outline-offset: 3px; }
</style>
