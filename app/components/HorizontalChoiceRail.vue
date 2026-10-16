<template>
  <div class="choice-rail" :class="`rail-${variant}`">
    <button type="button" class="rail-arrow" :aria-label="previousLabel" :disabled="disabled || (!loop && modelValue === items[0])" @click="step(-1)">‹</button>
    <div ref="viewport" class="rail-options game-scrollbar" role="radiogroup" :aria-label="label"
      @scroll.passive="normalizeLoop" @pointerdown.passive="cancelReveal" @touchstart.passive="cancelReveal" @wheel.passive="cancelReveal">
      <button v-for="item in ordered" :key="item" type="button" class="rail-option" :class="{ selected: modelValue === item }"
        role="radio" :aria-checked="modelValue === item" :aria-label="itemLabel(item, items.indexOf(item))"
        :tabindex="modelValue === item || (modelValue === null && item === items[0]) ? 0 : -1"
        :disabled="disabled" @click="choose(item)" @keydown="keyChoice($event, item)">
        <slot :item="item" />
      </button>
    </div>
    <button type="button" class="rail-arrow" :aria-label="nextLabel" :disabled="disabled || (!loop && modelValue === items[items.length - 1])" @click="step(1)">›</button>
  </div>
</template>

<script setup lang="ts" generic="T extends string | number">
import { createViewportScroller } from '../utils/viewportScroll';
const props = withDefaults(defineProps<{
  items: readonly T[]; modelValue: T | null; label: string; itemLabel: (item: T, index: number) => string;
  previousLabel: string; nextLabel: string; variant?: 'avatar' | 'age'; loop?: boolean; disabled?: boolean;
}>(), { variant: 'age', loop: false, disabled: false });
const emit = defineEmits<{ 'update:modelValue': [value: T] }>();
const ordered = shallowRef<T[]>([...props.items]);
const viewport = ref<HTMLElement | null>(null);
const scroller = createViewportScroller();
let disposed = false;
let rebasing = false;
let generation = 0;
let focusAfterSelection = false;
let observer: ResizeObserver | undefined;
let settling: ReturnType<typeof setTimeout> | undefined;
let revealing = false;
function cancelReveal(): void {
  generation += 1;
  scroller.cancel();
  clearTimeout(settling);
  revealing = false;
}
function pitch(): number {
  const item = viewport.value?.querySelector<HTMLElement>('.rail-option');
  return item && viewport.value ? item.offsetWidth + parseFloat(getComputedStyle(viewport.value).columnGap) : 0;
}
// Recycle unique keyed choices outside the visible window, without cloned
// radios or a duplicate selected option. Adjust offsets before the next paint.
async function rebase(front: boolean): Promise<void> {
  const area = viewport.value;
  const size = pitch();
  if (!area || !size || rebasing) return;
  const count = Math.min(Math.floor(ordered.value.length / 3), Math.max(0, ordered.value.length - Math.ceil(area.clientWidth / size) - 1));
  if (!count) return;
  rebasing = true;
  scroller.cancel();
  const offset = area.scrollLeft;
  ordered.value = front
    ? [...ordered.value.slice(-count), ...ordered.value.slice(0, -count)]
    : [...ordered.value.slice(count), ...ordered.value.slice(0, count)];
  await nextTick();
  if (!disposed) area.scrollTo({ left: offset + (front ? count : -count) * size, behavior: 'instant' });
  rebasing = false;
}
function normalizeLoop(): void {
  const area = viewport.value;
  const size = pitch();
  if (!props.loop || !area || rebasing || revealing || !size || area.scrollWidth <= area.clientWidth + 1) return;
  if (area.scrollLeft < size) void rebase(true);
  else if (area.scrollLeft > area.scrollWidth - area.clientWidth - size) void rebase(false);
}
async function revealSelected(animate = true, focus = false): Promise<void> {
  cancelReveal();
  const token = generation;
  await nextTick();
  if (disposed || token !== generation || props.modelValue === null) return;
  let index = ordered.value.indexOf(props.modelValue);
  if (props.loop && index >= 0) {
    const buffer = Math.ceil((viewport.value?.clientWidth ?? 0) / (pitch() || 1) / 2) + 1;
    if (index < buffer) await rebase(true);
    else if (index >= ordered.value.length - buffer) await rebase(false);
    index = ordered.value.indexOf(props.modelValue);
  }
  if (disposed || token !== generation || index < 0) return;
  const area = viewport.value;
  const item = area?.querySelectorAll<HTMLButtonElement>('.rail-option')[index];
  if (!area || !item) return;
  const left = item.offsetLeft - (area.clientWidth - item.offsetWidth) / 2;
  // Finish this move before recycling the edge; recycling cancels RAF scrolling.
  revealing = true;
  if (animate) scroller.to(area, { left, top: 0 });
  else area.scrollTo({ left, behavior: 'instant' });
  settling = setTimeout(() => { revealing = false; normalizeLoop(); }, animate ? 340 : 0);
  if (focus) item.focus({ preventScroll: true });
}
function choose(item: T, focus = false): void {
  if (props.disabled) return;
  focusAfterSelection = focus;
  if (props.modelValue === item) void revealSelected(true, focus);
  else emit('update:modelValue', item);
}
function step(direction: number): void {
  const index = props.modelValue === null ? -1 : props.items.indexOf(props.modelValue);
  const next = index < 0 ? direction > 0 ? 0 : props.items.length - 1 : index + direction;
  const target = props.loop ? (next + props.items.length) % props.items.length : Math.max(0, Math.min(props.items.length - 1, next));
  const item = props.items[target];
  if (item !== undefined) choose(item);
}
function keyChoice(event: KeyboardEvent, item: T): void {
  const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
  if (!direction && event.key !== 'Home' && event.key !== 'End') return;
  event.preventDefault();
  const index = props.items.indexOf(item);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? props.items.length - 1 : props.loop ? (index + direction + props.items.length) % props.items.length : Math.max(0, Math.min(props.items.length - 1, index + direction));
  const target = props.items[next];
  if (target !== undefined) choose(target, true);
}
watch(() => props.modelValue, () => {
  const focus = focusAfterSelection;
  focusAfterSelection = false;
  void revealSelected(true, focus);
}, { flush: 'post' });
onMounted(() => {
  void revealSelected(false);
  observer = new ResizeObserver(() => { void revealSelected(false); });
  if (viewport.value) observer.observe(viewport.value);
});
onBeforeUnmount(() => { disposed = true; cancelReveal(); observer?.disconnect(); });
</script>

<style scoped>
.choice-rail { display: grid; grid-template-columns: 40px minmax(0, 1fr) 40px; gap: 2px; min-width: 0; }
.rail-options { position: relative; display: flex; gap: 8px; min-width: 0; padding: 8px 6px; overflow-x: auto; overflow-y: hidden; overflow-anchor: none; overscroll-behavior-x: contain; touch-action: pan-x; }
button { font: inherit; cursor: pointer; }
.rail-arrow { align-self: center; min-height: 44px; padding: 0; border: 1px solid #7199ea66; border-radius: 10px; background: #0c225e; color: #d8eaff; font-size: 26px; }
.rail-option { box-sizing: border-box; position: relative; flex: 0 0 44px; display: grid; place-items: center; height: 44px; padding: 0; border: 2px solid #5a80d8; border-radius: 10px; background: #0c225e; color: #e0e9ff; font-size: 14px; font-weight: 800; }
.rail-avatar .rail-option { flex-basis: 48px; height: 48px; border-radius: 50%; background: #cceaff; }
.rail-option.selected { border-color: #ffe889; box-shadow: 0 0 0 2px #112760, 0 0 0 4px #ffd440; }
.rail-age .rail-option.selected { background: #ffd440; color: #112760; }
button:not(:disabled):hover { border-color: #b6d7ff; }
button:active { filter: brightness(1.15); }
button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
button:disabled { opacity: .45; cursor: not-allowed; }
</style>
