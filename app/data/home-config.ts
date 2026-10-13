export type ChallengeId = "A" | "B" | "C";

export type ChallengeMode = {
  id: ChallengeId;
  nameKey: "mode.A" | "mode.B" | "mode.C";
  levelRange: readonly [number, number];
  levelSetId: string;
  /** Seconds. Placeholder until the booth playthrough; maximum 15 minutes. */
  timeLimit: number;
  challengeId: ChallengeId;
  thumbnail: string;
};

export const homeConfig = {
  schemaVersion: 1,
  enabled: true, // false restores Dev's original setup and modes.
  idleTimeoutMs: 90_000,
  nicknameMaxLength: 24,
  modeMotion: { cardsMs: 420, popupInMs: 380, popupOutMs: 180 },
  ages: Array.from({ length: 14 }, (_, index) => index + 5),
  leaderboardScroll: { pixelsPerSecond: 18, returnPixelsPerSecond: 12, startPauseMs: 1400, endPauseMs: 1800, interactionPauseMs: 3000 },
  modes: [
    { id: "A", nameKey: "mode.A", levelRange: [1, 50], levelSetId: "challenge-beginner", timeLimit: 900, challengeId: "A", thumbnail: "thumbnail-game-1.png" },
    { id: "B", nameKey: "mode.B", levelRange: [1, 50], levelSetId: "challenge-intermediate", timeLimit: 900, challengeId: "B", thumbnail: "thumbnail-game-2.png" },
    { id: "C", nameKey: "mode.C", levelRange: [1, 50], levelSetId: "challenge-pro", timeLimit: 900, challengeId: "C", thumbnail: "thumbnail-game-3.png" },
  ] satisfies ChallengeMode[],
} as const;
