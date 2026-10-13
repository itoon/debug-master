<template>
  <section class="code-card" :class="{ 'code-card-readable': readable }">
    <div class="window-bar">
      <span class="window-dots" aria-hidden="true"><i /><i /><i /></span>
      <h2>{{ title }}</h2>
    </div>

    <pre
      ref="codeBox"
      class="code-box"
      :style="codeBoxStyle"
      :aria-label="`Level ${level.id} code`"
    ><code><span
      v-for="entry in codeLineEntries"
      :key="`${level.id}-${entry.index}`"
      class="code-line"
      :class="{ active: isActiveLine?.(entry.line, entry.index) }"
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
    /** Highlights a source line (the game uses it in Debug Mode). */
    isActiveLine?: (line: string, index: number) => boolean;
    /** Follow teaching hints within the code viewport only. */
    followActiveLine?: boolean;
  }>(),
  {
    language: "python",
    title: "Read the program",
    lineNumbers: false,
    readable: false,
    isActiveLine: undefined,
    followActiveLine: false,
  },
);

const { codeLineEntries, codeBoxStyle } = useCodePresentation(
  computed(() => props.level),
  computed(() => props.language),
);
const codeBox = ref<HTMLPreElement | null>(null);
const activeLineIndex = computed(() => props.followActiveLine
  ? codeLineEntries.value.findIndex(entry => props.isActiveLine?.(entry.line, entry.index))
  : -1);
watch([() => props.followActiveLine, () => props.level, activeLineIndex], async () => {
  const index = activeLineIndex.value;
  const level = props.level;
  if (!props.followActiveLine || index < 0) return;
  await nextTick();
  if (!props.followActiveLine || props.level !== level || activeLineIndex.value !== index) return;
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
</script>

<style scoped>
.code-card-readable .code-box { font-size: clamp(1rem, 1.15vw, 1.3rem); line-height: 1.65; overflow: auto; padding: 16px 0; }
.code-card-readable .code-line { white-space: pre; flex-wrap: nowrap; width: max-content; min-width: 100%; padding: 0 18px; }
.code-card-readable .code-token { white-space: pre; flex: none; }
.code-card-readable .window-bar { padding: 14px 18px; }
</style>
