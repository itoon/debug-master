<template>
  <div
    class="board"
    :class="{ shattering }"
    :style="boardStyle"
    role="grid"
    :aria-label="`Level ${level.id} board`"
  >
    <div
      v-for="tile in visibleTiles"
      :key="`${tile.row}-${tile.col}`"
      class="tile"
      :class="[
        `tile-${tile.kind}`,
        {
          alt: (tile.row + tile.col) % 2 === 1,
          start:
            tile.row === level.start[0] && tile.col === level.start[1],
        },
      ]"
      :style="tileStyle(tile)"
      role="gridcell"
      :aria-label="`row ${tile.row}, col ${tile.col}, ${tile.kind}`"
    />
    <!-- Actors (Codi, markers) use .actor with --x / --y grid coordinates. -->
    <slot />
  </div>
</template>

<script setup lang="ts">
// The level map, drawn the same way everywhere (game + review page).
// Tile looks live in assets/css/board.css.
import {
  useBoardPresentation,
  type BoardSpace,
} from "../composables/useBoardPresentation";
import type { LevelLike } from "../types/debug-game";

const props = withDefaults(
  defineProps<{
    level: LevelLike;
    /** Space the board may fill; tiles scale to fit it. */
    space?: BoardSpace;
    shattering?: boolean;
  }>(),
  { space: undefined, shattering: false },
);

const { visibleTiles, boardStyle, tileStyle } = useBoardPresentation(
  computed(() => props.level),
  toRef(props, "space"),
);
</script>
