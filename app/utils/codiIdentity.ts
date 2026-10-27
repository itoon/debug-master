import type { CodiLinks } from "../storage/contracts";
import { nicknameKey } from "./playerNickname";

export type CodiScoreName = { name: string; playerId?: string };

/** A returning badge continues its player. A different person keeps the name taken. */
export type CodiReuse =
  | { status: "new" }
  | { status: "same"; playerId: string }
  | { status: "taken" };

export function resolveCodiPlayer(sub: string, nickname: string, scores: readonly CodiScoreName[], links: CodiLinks): CodiReuse {
  const key = nicknameKey(nickname);
  const matching = scores.filter((score) => nicknameKey(score.name) === key);
  const owners = [...new Set(matching.flatMap((score) => score.playerId ? [score.playerId] : []))];
  const unkeyed = matching.some((score) => !score.playerId);
  const linked = links[sub];
  if (linked) {
    if (unkeyed || owners.some((playerId) => playerId !== linked)) return { status: "taken" };
    return { status: "same", playerId: linked };
  }
  const claimed = new Set(Object.values(links));
  if (owners.length === 0 && !unkeyed) return { status: "new" };
  if (owners.length === 1 && !unkeyed && !claimed.has(owners[0]!)) return { status: "same", playerId: owners[0]! };
  return { status: "taken" };
}
