import { isCodiPictureUrl } from "../utils/codiOauth";

// Selectable avatar set from the reference frontend's profile editor.
export const PLAYER_AVATARS = [
  "codi_default.svg",
  "art-toy/01-default.svg",
  "art-toy/23-reindeer.svg",
  "art-toy/04-coin.svg",
  "art-toy/09-driving.svg",
  "art-toy/15-egg.svg",
  "art-toy/05-nerdy.svg",
  "art-toy/06-sun_glassed.svg",
  "art-toy/07-robinhood.svg",
  "art-toy/10-party.svg",
  "art-toy/12-pineapple.svg",
  "art-toy/13-flag.svg",
  "art-toy/14-bee.svg",
  "art-toy/02-wink.svg",
  "art-toy/16-tv.svg",
  "art-toy/17-jedi.svg",
  "art-toy/18-sith.svg",
] as const;

export type PlayerAvatarId = (typeof PLAYER_AVATARS)[number];
export function isPlayerAvatarId(value: unknown): value is PlayerAvatarId {
  return typeof value === "string" && (PLAYER_AVATARS as readonly string[]).includes(value);
}

/** Old scores and unknown avatar IDs use the standard Codi profile. A Codi Arena photo URL is kept. */
export function resolveAvatarId(value: unknown): string {
  if (isPlayerAvatarId(value) || isCodiPictureUrl(value)) return value;
  return PLAYER_AVATARS[0];
}

export function playerAvatarPath(value?: string): string {
  return `student-avatar/${isPlayerAvatarId(value) ? value : PLAYER_AVATARS[0]}`;
}
