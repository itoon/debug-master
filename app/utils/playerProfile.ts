import { homeConfig } from '../data/home-config';
import { resolveAvatarId } from '../data/player-avatars';
import type { PlayerSetupInput } from '../storage/contracts';
import type { Score } from '../types/debug-game';

/** Codi does not supply age; a supplied manual age must still be valid. */
export function playerSetupFromScore(score: Pick<Score, 'name' | 'age' | 'avatarId'>): PlayerSetupInput | null {
  const nickname = score.name.trim();
  if (!nickname || nickname.length > homeConfig.nicknameMaxLength ||
    (score.age !== undefined && !homeConfig.ages.includes(score.age))) return null;
  return { nickname, avatarId: resolveAvatarId(score.avatarId), ...(score.age !== undefined ? { age: score.age } : {}) };
}
