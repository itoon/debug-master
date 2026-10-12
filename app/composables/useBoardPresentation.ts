import { computed, type ComputedRef, type Ref } from "vue";
import { colorMeta, type LevelLike, type VisibleTile } from "../types/debug-game";
import { tileCode, tileDefinition } from "../data/tiles";

export function tileColorName(color: string): string {
  return colorMeta[tileCode(color)]?.name ?? "gray";
}

export function tileKindLabel(color: string): string {
  return tileDefinition(color).name;
}

// Must match the .board CSS: gap = max(5px, 0.14 * cell),
// padding = max(10px, 0.24 * cell), and a 2px border on each side.
const MIN_CELL = 24;
const MAX_CELL = 88;

function boardLength(count: number, cell: number): number {
  const gap = Math.max(5, cell * 0.14);
  const pad = Math.max(10, cell * 0.24);
  return count * cell + (count - 1) * gap + pad * 2 + 4;
}

/**
 * The largest square tile that lets the whole board fit the space it is given,
 * so small levels get big, easy-to-read tiles and large ones still fit.
 */
export function fitCellSize(
  cols: number,
  rows: number,
  space?: BoardSpace,
  maxCellSize = MAX_CELL,
): number {
  const safeCols = Math.max(1, cols);
  const safeRows = Math.max(1, rows);
  if (!space || space.width <= 0 || space.height <= 0) {
    // Before the board area is measured (first render): a safe guess.
    return Math.max(
      MIN_CELL,
      Math.min(54, Math.floor(Math.min(520 / safeCols, 500 / safeRows))),
    );
  }
  let cell = Math.max(MIN_CELL, Math.floor(maxCellSize));
  while (
    cell > MIN_CELL &&
    (boardLength(safeCols, cell) > space.width ||
      boardLength(safeRows, cell) > space.height)
  ) {
    cell -= 1;
  }
  return cell;
}

export type BoardSpace = { width: number; height: number };

export function useBoardPresentation(
  currentLevel: ComputedRef<LevelLike>,
  boardSpace?: Ref<BoardSpace | undefined>,
  maxCellSize?: Ref<number>,
) {
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
    const { cols, rows } = currentLevel.value;
    const cell = fitCellSize(cols, rows, boardSpace?.value, maxCellSize?.value);
    return {
      gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
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
