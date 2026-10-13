import { playerAvatarPath } from "../data/player-avatars";

export function usePlayerAvatar() {
  const baseURL = useRuntimeConfig().app.baseURL;
  return (avatarId?: string): string => `${baseURL.endsWith('/') ? baseURL : `${baseURL}/`}${playerAvatarPath(avatarId)}`;
}
