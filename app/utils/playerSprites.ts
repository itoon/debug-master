import type { Direction } from "../types/debug-game";
import codiDown from "~/assets/sprites/codi-down.svg";
import codiLeft from "~/assets/sprites/codi-left.svg";
import codiRight from "~/assets/sprites/codi-right.svg";
import codiUp from "~/assets/sprites/codi-up.svg";
import codiFailed from "~/assets/sprites/codi-failed.svg";
import codiWin from "~/assets/sprites/codi-win.svg";

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

export const PLAYER_POSES = { failed: codiFailed, win: codiWin } as const;
