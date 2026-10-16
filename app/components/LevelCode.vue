<template>
  <section class="code-card" :class="{ 'code-card-readable': readable }">
    <div class="window-bar">
      <span class="window-dots" aria-hidden="true"><i /><i /><i /></span>
      <h2>{{ title }}</h2>
      <span v-if="scrollHint" class="code-scroll-hint">{{ t('game.scrollCode') }}</span>
    </div>

    <pre
      ref="codeBox"
      class="code-box"
      :class="{ 'game-scrollbar': readable, 'follow-executed': followExecuted }"
      :style="codeBoxStyle"
      :aria-label="`Level ${level.id} code`"
      :tabindex="readable ? 0 : undefined"
    ><code><span
      v-for="entry in codeLineEntries"
      :key="`${level.id}-${entry.index}-${followExecuted && executedStep?.line === entry.index + 1 ? executedStep.sequence : 0}`"
      class="code-line"
      :class="{ active: isActiveLine?.(entry.line, entry.index), 'code-line-executed': followExecuted && executedStep?.line === entry.index + 1 }"
      :aria-current="followActiveLine && isActiveLine?.(entry.line, entry.index) ? 'step' : undefined"
    ><span
      v-if="lineNumbers"
      class="code-line-number"
      aria-hidden="true"
    >{{ entry.index + 1 }}</span><template
      v-for="(segment, segIndex) in entry.segments"
      :key="`${entry.index}-${segIndex}`"
    ><span
      v-if="segment.kind !== 'tile'"
      class="code-token"
      :class="`code-token-${segment.kind}`"
    >{{ segment.text }}</span><template v-else><span
      v-if="language === 'js'"
      class="code-token code-token-punct"
    >(</span><span
      v-if="segment.negate"
      class="code-negation"
      aria-hidden="true"
    >{{ language === "js" ? "!" : "not " }}</span><span
      class="code-tile"
      :class="`tile-${tileKind(segment.color)}`"
      role="img"
      :aria-label="`${segment.negate ? 'not ' : ''}${tileDescription(segment.color)}`"
      :title="tileDescription(segment.color)"
      :data-tile="tileKindLabel(segment.color)"
    ><i class="code-tile-swatch" aria-hidden="true" /><span
      class="code-tile-label"
      aria-hidden="true"
    >{{ tileKindLabel(segment.color) }}</span></span><span
      v-if="language === 'js'"
      class="code-token code-token-punct"
    >)</span></template></template></span></code></pre>
  </section>
</template>

<script setup lang="ts">
// A level's program in the "window" card, drawn the same way everywhere
// (game + review page). Styles live in assets/css/board.css.
import {
  tileKind,
  tileKindLabel,
} from "../composables/useBoardPresentation";
import { useCodePresentation } from "../composables/useCodePresentation";
import type { LevelLike } from "../types/debug-game";
import type { CodeLanguage } from "../utils/codeLanguage";
import { tileDefinition } from "../data/tiles";
import { useGameI18n } from "../composables/useGameI18n";

const { t } = useGameI18n();
function tileDescription(value: string): string {
  const tile = tileDefinition(value);
  return t("tile.description", { name: tile.name, translation: t(tile.nameKey) });
}

const props = withDefaults(
  defineProps<{
    level: LevelLike;
    language?: CodeLanguage;
    title?: string;
    lineNumbers?: boolean;
    /** Gameplay keeps readable text and scrolls instead of shrinking long code. */
    readable?: boolean;
    /** Compact gameplay cue; tutorial/review keep their existing header. */
    scrollHint?: boolean;
    /** Highlights a source line (the game uses it in Debug Mode). */
    isActiveLine?: (line: string, index: number) => boolean;
    /** Follow teaching hints within the code viewport only. */
    followActiveLine?: boolean;
    /** Presentation-only feedback from the last accepted move, not the next. */
    executedStep?: { line: number; sequence: number };
    /** Keep two source lines below the accepted move in compact gameplay. */
    followExecuted?: boolean;
  }>(),
  {
    language: "python",
    title: "Read the program",
    lineNumbers: false,
    readable: false,
    scrollHint: false,
    isActiveLine: undefined,
    followActiveLine: false,
    executedStep: undefined,
    followExecuted: false,
  },
);

const { codeLineEntries, codeBoxStyle } = useCodePresentation(
  computed(() => props.level),
  computed(() => props.language),
);
const codeBox = ref<HTMLPreElement | null>(null);
// A new program starts at its first line, not the previous level's scroll.
// Teaching mode retains ownership of scrolling to its active source line.
watch(() => props.level, () => {
  if (props.readable && (!props.followActiveLine || props.followExecuted) && codeBox.value) {
    codeBox.value.scrollTop = 0;
    codeBox.value.scrollLeft = 0;
  }
}, { flush: 'post' });
const activeLineIndex = computed(() => props.followActiveLine
  ? codeLineEntries.value.findIndex(entry => props.isActiveLine?.(entry.line, entry.index))
  : -1);
watch([() => props.followActiveLine, () => props.level, activeLineIndex], async () => {
  const index = activeLineIndex.value;
  const level = props.level;
  if (!props.followActiveLine || props.followExecuted || index < 0) return;
  await nextTick();
  if (!props.followActiveLine || props.followExecuted || props.level !== level || activeLineIndex.value !== index) return;
  const box = codeBox.value;
  const line = box?.querySelectorAll<HTMLElement>('.code-line')[index];
  if (!box?.isConnected || !line) return;
  const viewport = box.getBoundingClientRect();
  const position = line.getBoundingClientRect();
  if (position.top < viewport.top || position.bottom > viewport.bottom) {
    // Instant internal scroll avoids moving the game page or queued motion.
    box.scrollTop = Math.max(0, box.scrollTop + position.top - viewport.top - box.clientHeight / 2 + position.height / 2);
  }
}, { flush: 'post', immediate: true });

watch(() => props.executedStep, async (step) => {
  if (!props.followExecuted || !step) return;
  const level = props.level;
  await nextTick();
  if (!props.followExecuted || props.level !== level || props.executedStep !== step) return;
  const box = codeBox.value;
  const line = box?.querySelectorAll<HTMLElement>('.code-line')[step.line - 1];
  if (!box?.isConnected || !line) return;
  const viewport = box.getBoundingClientRect();
  const position = line.getBoundingClientRect();
  const lineHeight = position.height;
  const clearance = Math.min(lineHeight * 2, Math.max(0, box.clientHeight - lineHeight));
  if (position.top < viewport.top || position.bottom > viewport.top + box.clientHeight - clearance) {
    // No scrollIntoView: do not move the page or enqueue smooth scrolls while
    // the player presses quickly. Manual pan remains until the next move.
    box.scrollTop = Math.max(0, box.scrollTop + position.bottom - viewport.top - box.clientHeight + clearance);
  }
}, { flush: 'post' });
</script>

<style scoped>
.code-card-readable .code-box { min-width: 0; max-width: 100%; font-size: clamp(1rem, 1.15vw, 1.3rem); line-height: 1.65; overflow: auto; overscroll-behavior: contain; touch-action: pan-x pan-y; padding: 16px 0 var(--code-bottom-space, 16px); }
.code-card-readable .code-box:focus-visible { outline: 2px solid var(--cv-yellow); outline-offset: -2px; }
.code-card-readable .code-line { white-space: pre; flex-wrap: nowrap; width: max-content; min-width: 100%; padding: 0 18px; }
.code-card-readable .code-token { white-space: pre; flex: none; }
.code-card-readable .window-bar { padding: 14px 18px; }
.code-card-readable .window-bar h2 { min-width: 0; overflow-wrap: anywhere; }
.code-card-readable .code-box.follow-executed { --code-bottom-space: calc(10px + 3.3em); }
.code-line-executed:not(.active) { animation: executed-line-fade 1100ms ease-out both; }
@keyframes executed-line-fade {
  0%, 20% { background: #fdca3f38; border-left-color: var(--cv-yellow); }
  100% { background: transparent; border-left-color: transparent; }
}
.code-scroll-hint { flex: none; margin-left: auto; color: #bdd6ff; font: 700 .65rem/1.3 var(--cv-font); white-space: nowrap; }
@media (min-width: 921px) and (min-height: 561px) {
  .code-scroll-hint { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .code-line-executed:not(.active) { animation-duration: 1ms; }
}
</style>
