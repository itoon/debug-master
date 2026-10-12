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
        `tile-${tile.colorName}`,
        {
          alt: (tile.row + tile.col) % 2 === 1,
          start:
            tile.row === level.start[0] && tile.col === level.start[1],
        },
      ]"
      :style="tileStyle(tile)"
      role="gridcell"
      :aria-label="`row ${tile.row}, col ${tile.col}, ${tileKindLabel(tile.raw)}`"
    />
    <!-- Actors (Codi, markers) use .actor with --x / --y grid coordinates. -->
    <slot />
  </div>
</template>

<script setup lang="ts">
// The level map, drawn the same way everywhere (game + review page).
// Tile looks live in assets/css/board.css.
import {
  tileKindLabel,
  useBoardPresentation,
  type BoardSpace,
} from "../composables/useBoardPresentation";
import type { LevelLike } from "../types/debug-game";

const props = withDefaults(
  defineProps<{
    level: LevelLike;
    /** Space the board may fill; tiles scale to fit it. */
    space?: BoardSpace;
    /** Presentation only: gameplay can use larger tiles than review cards. */
    maxCellSize?: number;
    shattering?: boolean;
  }>(),
  { space: undefined, shattering: false, maxCellSize: 88 },
);

const { visibleTiles, boardStyle, tileStyle } = useBoardPresentation(
  computed(() => props.level),
  toRef(props, "space"),
  toRef(props, "maxCellSize"),
);
</script>
