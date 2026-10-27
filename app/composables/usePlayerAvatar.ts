import { playerAvatarPath } from "../data/player-avatars";
import { codiPictureSrc, isCodiPictureUrl } from "../utils/codiOauth";

export function usePlayerAvatar() {
  const baseURL = useRuntimeConfig().app.baseURL;
  return (avatarId?: string): string => {
    if (isCodiPictureUrl(avatarId)) return codiPictureSrc(avatarId);
    const prefix = baseURL.endsWith("/") ? baseURL : `${baseURL}/`;
    return `${prefix}${playerAvatarPath(avatarId)}`;
  };
}
