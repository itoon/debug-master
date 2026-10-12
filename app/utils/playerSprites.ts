import type { Direction } from "../types/debug-game";
import codiDown from "~/assets/sprites/codi-down.png";
import codiLeft from "~/assets/sprites/codi-left.png";
import codiRight from "~/assets/sprites/codi-right.png";
import codiUp from "~/assets/sprites/codi-up.png";

// The player character, one picture per facing. The game shows the picture
// of the last move's direction; a level starts facing down (towards the
// player). Swap the files in assets/sprites to restyle the character.
export const PLAYER_SPRITES: Record<Direction, string> = {
  up: codiUp,
  down: codiDown,
  left: codiLeft,
  right: codiRight,
};

export const START_FACING: Direction = "down";
