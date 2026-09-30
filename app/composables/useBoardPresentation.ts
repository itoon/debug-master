import { computed, type ComputedRef } from "vue";
import { colorMeta, type LevelLike, type VisibleTile } from "../types/debug-game";

export function tileColorName(color: string): string {
  return colorMeta[color]?.name ?? "gray";
}

export function useBoardPresentation(currentLevel: ComputedRef<LevelLike>) {
  const visibleTiles = computed<VisibleTile[]>(() =>
    currentLevel.value.map.flatMap((row, rowIndex) =>
      row.map((color, colIndex) => ({
        row: rowIndex,
        col: colIndex,
        raw: color,
        colorName: tileColorName(color),
        symbol: colorMeta[color]?.symbol ?? "",
      })),
    ),
  );

  const boardStyle = computed(() => {
    // Junior note:
    // Large maps should not overflow the board panel, so we size the square
    // cell using both the row count and column count.
    const cell = Math.max(
      18,
      Math.min(
        54,
        Math.floor(
          Math.min(
            520 / Math.max(1, currentLevel.value.cols),
            500 / Math.max(1, currentLevel.value.rows),
          ),
        ),
      ),
    );

    return {
      gridTemplateColumns: `repeat(${currentLevel.value.cols}, ${cell}px)`,
      "--cell-size": `${cell}px`,
    };
  });

  function tileStyle(tile: { row: number; col: number }): Record<string, string> {
    // These burst values are only for the fail animation. We calculate them
    // from the tile position so each square flies away from the board center.
    const rowCenter = (currentLevel.value.rows - 1) / 2;
    const colCenter = (currentLevel.value.cols - 1) / 2;
    const dx = tile.col - colCenter;
    const dy = tile.row - rowCenter;
    const length = Math.max(1, Math.hypot(dx, dy));
    const distance = 34 + Math.min(86, length * 18);

    return {
      "--burst-x": `${(dx / length) * distance}px`,
      "--burst-y": `${(dy / length) * distance}px`,
      "--burst-r": `${(dx + dy) * 9}deg`,
    };
  }

  return {
    visibleTiles,
    boardStyle,
    tileStyle,
  };
}
