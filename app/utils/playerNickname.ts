/** Comparison only: keep the player's original spelling/emoji for display. */
export function nicknameKey(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}
