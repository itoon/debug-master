<template>
  <dialog ref="dialog" class="practice-dialog" :aria-labelledby="titleId" :aria-describedby="descriptionId" @cancel.prevent="!busy && emit('close')">
    <header><div><p class="eyebrow">{{ t('practice.badge') }}</p><h2 :id="titleId">{{ t('practice.chooseTitle', { count: levels.length }) }}</h2></div><button class="close-button" type="button" :disabled="busy" :aria-label="t('home.closeSetup')" @click="emit('close')">×</button></header>
    <p :id="descriptionId" class="description">{{ t('practice.description') }}</p>
    <div class="level-grid" :aria-label="t('practice.levels')">
      <button v-for="level in levels" :key="level.id" type="button" :disabled="busy" :class="{ selected: level.id === selectedLevel }"
        :title="level.concept" :aria-label="t('practice.playLevel', { level: level.id, concept: level.concept })" @click="emit('select', level.id)">{{ level.id.toString().padStart(2, '0') }}</button>
    </div>
    <p class="practice-tip">{{ t('practice.features') }}</p>
  </dialog>
</template>

<script setup lang="ts">
import type { RawLevel } from '../data/levels';
import { useGameI18n } from '../composables/useGameI18n';
defineProps<{ levels: Pick<RawLevel, 'id' | 'concept'>[]; selectedLevel: number; busy: boolean }>();
const emit = defineEmits<{ close: []; select: [level: number] }>();
const { t } = useGameI18n();
const titleId = useId();
const descriptionId = useId();
const dialog = ref<HTMLDialogElement | null>(null);
onMounted(() => { dialog.value?.showModal(); dialog.value?.querySelector<HTMLButtonElement>('.level-grid .selected, .level-grid button')?.focus(); });
onBeforeUnmount(() => dialog.value?.close());
</script>

<style scoped>
.practice-dialog { width: min(860px, calc(100% - 32px)); max-height: calc(100dvh - 32px); overflow-y: auto; margin: auto; padding: clamp(18px, 3vw, 28px); border: 1px solid #85b2ff; border-radius: 24px; background: linear-gradient(145deg, #193c87, #0b224e); color: #fff; box-shadow: var(--cv-shadow-window); }
.practice-dialog::backdrop { background: #03102cbf; backdrop-filter: blur(6px); }
header { display: flex; justify-content: space-between; align-items: center; gap: 14px; }
h2 { font-size: clamp(1.2rem, 2vw, 1.6rem); margin: 0; }
.eyebrow { margin: 0 0 4px; color: #ffe36b; font-size: .8rem; font-weight: 800; }
.description, .practice-tip { color: #bed9ff; margin: 14px 0; font-size: .85rem; }
.practice-tip { margin-bottom: 0; }
.level-grid { display: grid; grid-template-columns: repeat(10, minmax(48px, 1fr)); gap: 6px; }
button { min-height: 48px; padding: 6px; border: 1px solid #7caaff; border-radius: 10px; background: #102d64; color: #fff; font: inherit; font-weight: 800; cursor: pointer; }
.close-button { width: 48px; flex: none; font-size: 1.7rem; }
.level-grid button.selected { background: #ffe36b; color: #102754; border-color: #ffe36b; }
button:hover { filter: brightness(1.15); }
button:disabled { opacity: .55; cursor: wait; }
button:focus-visible { outline: 3px solid #ffe36b; outline-offset: 2px; }
@media (max-width: 620px) { .level-grid { grid-template-columns: repeat(5, minmax(48px, 1fr)); } }
@media (max-width: 380px) { .level-grid { grid-template-columns: repeat(4, minmax(48px, 1fr)); } }
</style>
