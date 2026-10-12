export type ChallengeId = "A" | "B" | "C";

export type ChallengeMode = {
  id: ChallengeId;
  nameKey: "mode.A" | "mode.B" | "mode.C";
  levelRange: readonly [number, number];
  /** Seconds. Placeholder until the booth playthrough; maximum 15 minutes. */
  timeLimit: number;
  challengeId: ChallengeId;
};

export const homeConfig = {
  schemaVersion: 1,
  enabled: true, // false restores Dev's original setup and modes.
  levelSetId: "set-01",
  idleTimeoutMs: 90_000,
  nicknameMaxLength: 24,
  ages: Array.from({ length: 14 }, (_, index) => index + 5),
  modes: [
    { id: "A", nameKey: "mode.A", levelRange: [1, 20], timeLimit: 900, challengeId: "A" },
    { id: "B", nameKey: "mode.B", levelRange: [21, 40], timeLimit: 900, challengeId: "B" },
    { id: "C", nameKey: "mode.C", levelRange: [41, 60], timeLimit: 900, challengeId: "C" },
  ] satisfies ChallengeMode[],
} as const;
