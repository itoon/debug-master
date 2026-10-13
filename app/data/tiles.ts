// Public condition names are independent of the compact codes in Dev's maps.
// Preserve map codes; presentation uses item names in labels and CSS classes.
export const TILE_TYPES = ["flower", "rock", "grass", "honey", "ice", "gem"] as const;

export const TILE_DEFINITIONS = {
  p: { name: "flower", nameKey: "tile.flower" },
  k: { name: "rock", nameKey: "tile.rock" },
  g: { name: "grass", nameKey: "tile.grass" },
  o: { name: "honey", nameKey: "tile.honey" },
  b: { name: "ice", nameKey: "tile.ice" },
  v: { name: "gem", nameKey: "tile.gem" },
  n: { name: "floor", nameKey: "tile.floor" },
  y: { name: "sand", nameKey: "tile.sand" },
} as const;

export type TileCode = keyof typeof TILE_DEFINITIONS;
export type TileName = (typeof TILE_DEFINITIONS)[TileCode]["name"];

const entries = Object.entries(TILE_DEFINITIONS) as [TileCode, (typeof TILE_DEFINITIONS)[TileCode]][];
const codesByName: Readonly<Record<string, TileCode>> = Object.fromEntries(
  entries.map(([code, definition]) => [definition.name, code]),
);

/** Accept canonical names at the parser boundary; leave legacy codes unchanged. */
export function tileCode(value: string): string {
  return Object.hasOwn(codesByName, value) ? codesByName[value]! : value;
}

export function tileDefinition(value: string) {
  const code = tileCode(value);
  return Object.hasOwn(TILE_DEFINITIONS, code)
    ? TILE_DEFINITIONS[code as TileCode]
    : TILE_DEFINITIONS.n;
}

// Used by both code display languages, including future named conditions.
export const TILE_CONDITION_NAMES = entries.flatMap(([code, definition]) => [code, definition.name]);
