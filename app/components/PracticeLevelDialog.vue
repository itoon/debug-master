<template>
  <dialog ref="dialog" class="practice-dialog" :aria-labelledby="titleId" @cancel.prevent="!busy && emit('close')">
    <header><div><p class="eyebrow">{{ t('practice.badge') }}</p><h2 :id="titleId">{{ t('practice.chooseTitle', { count: levels.length }) }}</h2></div><button class="close-button" type="button" :disabled="busy" :aria-label="t('home.closeSetup')" @click="emit('close')">×</button></header>
    <div class="concept-groups" :aria-label="t('practice.levels')">
      <section v-for="(group, index) in groups" :key="group.concept" class="concept-group" :class="{ 'current-group': group.levels.some(level => level.id === selectedLevel) }" :aria-labelledby="`${groupId}-${index}`">
        <div class="concept-heading"><span class="concept-emoji" aria-hidden="true">{{ group.emoji }}</span><h3 :id="`${groupId}-${index}`">{{ group.label }}</h3><span class="concept-count">{{ t('practice.groupCount', { count: group.levels.length }) }}</span></div>
        <div class="level-grid">
          <button v-for="level in group.levels" :key="level.id" type="button" :disabled="busy" :class="{ selected: level.id === selectedLevel }" :aria-current="level.id === selectedLevel ? 'step' : undefined"
            :title="level.concept" :aria-label="t('practice.playLevel', { level: level.id, concept: level.concept })" @click="emit('select', level.id)"><span>{{ level.id.toString().padStart(2, '0') }}</span></button>
        </div>
      </section>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import type { RawLevel } from '../data/levels';
import { useGameI18n } from '../composables/useGameI18n';
import { PRACTICE_CONCEPTS } from '../data/practice-concepts';
const props = defineProps<{ levels: Pick<RawLevel, 'id' | 'concept'>[]; selectedLevel: number; busy: boolean }>();
const emit = defineEmits<{ close: []; select: [level: number] }>();
const { t } = useGameI18n();
const titleId = useId();
const groupId = useId();
const groups = computed(() => {
  const byConcept = new Map<string, { concept: string; label: string; emoji: string; levels: typeof props.levels }>();
  for (const level of [...props.levels].sort((a, b) => a.id - b.id)) {
    if (!byConcept.has(level.concept)) {
      const meta = Object.hasOwn(PRACTICE_CONCEPTS, level.concept) ? PRACTICE_CONCEPTS[level.concept] : undefined;
      byConcept.set(level.concept, {
        concept: level.concept,
        label: meta ? t(meta.nameKey) : t('practice.concept.other', { concept: level.concept }),
        emoji: meta?.emoji ?? '🧩',
        levels: [],
      });
    }
    byConcept.get(level.concept)!.levels.push(level);
  }
  return [...byConcept.values()];
});
const dialog = ref<HTMLDialogElement | null>(null);
onMounted(() => {
  dialog.value?.showModal();
  const target = dialog.value?.querySelector<HTMLButtonElement>('.level-grid .selected') ?? dialog.value?.querySelector<HTMLButtonElement>('.level-grid button');
  target?.focus();
});
onBeforeUnmount(() => dialog.value?.close());
</script>

<style scoped>
.practice-dialog { width: min(940px, calc(100% - 32px)); max-height: calc(100dvh - 32px); overflow: hidden; margin: auto; padding: clamp(18px, 3vw, 28px); border: 1px solid #85b2ff; border-radius: 24px; background: linear-gradient(145deg, #193c87, #0b224e); color: #fff; box-shadow: var(--cv-shadow-window); }
.practice-dialog[open] { display: flex; flex-direction: column; }
.practice-dialog::backdrop { background: #03102cbf; backdrop-filter: blur(6px); }
header { display: flex; justify-content: space-between; align-items: center; gap: 14px; flex: none; }
h2 { font-size: clamp(1.2rem, 2vw, 1.6rem); margin: 0; }
.eyebrow { margin: 0 0 4px; color: #ffe36b; font-size: .8rem; font-weight: 800; }
.concept-groups { display: grid; gap: 12px; min-height: 0; margin-top: 14px; overflow-y: auto; padding: 2px 8px 5px 2px; scrollbar-width: thin; scrollbar-color: #9ca3af73 transparent; }
.concept-group { padding: 14px; border: 1px solid #82b0ff44; border-radius: 16px; background: #071b3a55; }
.concept-group.current-group { border-color: #ffe36b88; }
.concept-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.concept-emoji { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 10px; background: #244b8a; font-size: 1.3rem; }
h3 { min-width: 0; margin: 0; font-size: .95rem; font-weight: 800; line-height: 1.4; }
.concept-count { margin-left: auto; flex: none; color: #c6ddff; font-size: .7rem; white-space: nowrap; }
.level-grid { display: grid; grid-template-columns: repeat(10, minmax(48px, 1fr)); gap: 8px; }
button { min-height: 48px; padding: 6px; border: 1px solid #7caaff; border-radius: 10px; background: #102d64; color: #fff; font: inherit; font-weight: 800; cursor: pointer; }
.close-button { width: 48px; flex: none; font-size: 1.7rem; }
.level-grid button { position: relative; box-shadow: 0 3px 0 #061632; transition: transform 140ms ease, background 140ms ease, border-color 140ms ease; }
.level-grid button:not(:disabled):hover { transform: translateY(-2px); background: #285ba0; border-color: #bad5ff; }
.level-grid button.selected { background: #ffe36b; color: #102754; border-color: #ffe36b; }
.level-grid button.selected:not(:disabled):hover { background: #ffed9e; border-color: #ffed9e; }
.level-grid button:not(:disabled):active { transform: translateY(1px); box-shadow: 0 1px 0 #061632; }
.close-button:not(:disabled):hover { background: #285ba0; }
button:disabled { opacity: .55; cursor: wait; }
button:focus-visible { outline: 3px solid #ffe36b; outline-offset: 2px; }
@media (max-width: 720px) { .level-grid { grid-template-columns: repeat(5, minmax(48px, 1fr)); } }
@media (max-width: 420px) { .level-grid { grid-template-columns: repeat(3, minmax(48px, 1fr)); } .concept-group { padding: 10px; } .concept-heading { flex-wrap: wrap; gap: 6px; } h3 { flex: 1; font-size: .85rem; } .concept-count { width: 100%; padding-left: 42px; } }
@media (prefers-reduced-motion: reduce) { .level-grid button { transition: none; } .level-grid button:not(:disabled):hover, .level-grid button:not(:disabled):active { transform: none; } }
</style>
