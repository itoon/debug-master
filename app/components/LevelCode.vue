<template>
  <section class="code-card">
    <div class="window-bar">
      <span class="window-dots" aria-hidden="true"><i /><i /><i /></span>
      <h2>{{ title }}</h2>
    </div>

    <pre
      class="code-box"
      :style="codeBoxStyle"
      :aria-label="`Level ${level.id} code`"
    ><code><span
      v-for="entry in codeLineEntries"
      :key="`${level.id}-${entry.index}`"
      class="code-line"
      :class="{ active: isActiveLine?.(entry.line) }"
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
      :class="`tile-${tileColorName(segment.color)}`"
      role="img"
      :aria-label="`${segment.negate ? 'not ' : ''}${tileKindLabel(segment.color)} (${segment.color})`"
      :title="segment.color"
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
  tileColorName,
  tileKindLabel,
} from "../composables/useBoardPresentation";
import { useCodePresentation } from "../composables/useCodePresentation";
import type { LevelLike } from "../types/debug-game";
import type { CodeLanguage } from "../utils/codeLanguage";

const props = withDefaults(
  defineProps<{
    level: LevelLike;
    language?: CodeLanguage;
    title?: string;
    lineNumbers?: boolean;
    /** Highlights a source line (the game uses it in Debug Mode). */
    isActiveLine?: (line: string) => boolean;
  }>(),
  {
    language: "python",
    title: "Read the program",
    lineNumbers: false,
    isActiveLine: undefined,
  },
);

const { codeLineEntries, codeBoxStyle } = useCodePresentation(
  computed(() => props.level),
  computed(() => props.language),
);
</script>
