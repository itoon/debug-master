<template>
  <dialog ref="dialog" class="delete-dialog" :aria-labelledby="titleId" :aria-describedby="descriptionId" @cancel.prevent="close">
    <h2 :id="titleId">{{ t('players.confirmTitle', { name: entry.name }) }}</h2>
    <p :id="descriptionId">{{ t('players.confirmDescription') }}</p>
    <p class="entry-detail">{{ entry.name }} · {{ t('ranking.points', { score: entry.score.toLocaleString('th-TH') }) }}</p>
    <p>{{ modeLabel }} · {{ playedAt }}</p>
    <p v-if="busy" role="status">{{ t('players.deleting') }}</p>
    <p v-if="error" class="delete-error" role="alert">{{ t('players.deleteError') }}</p>
    <div class="delete-actions">
      <button ref="cancelButton" type="button" :disabled="busy" @click="close">{{ t('players.cancel') }}</button>
      <button type="button" class="danger" :disabled="busy" @click="emit('confirm')">{{ t('players.confirm') }}</button>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import type { Score } from '../types/debug-game';
import { useGameI18n } from '../composables/useGameI18n';
const props = defineProps<{ entry: Score; modeLabel: string; playedAt: string; busy: boolean; error: boolean }>();
const emit = defineEmits<{ close: []; confirm: [] }>();
const { t } = useGameI18n();
const titleId = useId();
const descriptionId = useId();
const dialog = ref<HTMLDialogElement | null>(null);
const cancelButton = ref<HTMLButtonElement | null>(null);
function close(): void { if (!props.busy) emit('close'); }
onMounted(() => { dialog.value?.showModal(); cancelButton.value?.focus(); });
onBeforeUnmount(() => dialog.value?.close());
</script>

<style scoped>
.delete-dialog { width: min(460px, calc(100% - 32px)); max-height: calc(100dvh - 32px); overflow-y: auto; margin: auto; padding: 24px; border: 1px solid #87b0ef; border-radius: 20px; background: #102858; color: #fff; box-shadow: var(--cv-shadow-window); }
.delete-dialog::backdrop { background: #03102cbb; backdrop-filter: blur(5px); }
h2 { margin: 0 0 12px; font-size: 1.25rem; overflow-wrap: anywhere; }
p { margin: 0; line-height: 1.6; color: #d5e4ff; }
.entry-detail { margin-top: 12px; padding: 10px; border-radius: 10px; background: #071a3c; overflow-wrap: anywhere; }
.delete-error { margin-top: 12px; color: #ffbeb6; }
.delete-actions { display: flex; gap: 10px; margin-top: 20px; }
button { flex: 1; min-height: 48px; padding: 8px 12px; border: 1px solid #85b2ff66; border-radius: 12px; background: #203f76; color: #fff; font: inherit; font-weight: 800; cursor: pointer; }
.danger { background: #b33142; border-color: #e97e8c; }
button:not(:disabled):hover { filter: brightness(1.12); }
button:focus-visible { outline: 3px solid #ffe36b; outline-offset: 3px; }
button:disabled { opacity: .55; cursor: wait; }
</style>
