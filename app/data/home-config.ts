import type { CompetitionConfig, ScoringStrategy } from "../types/competition";

export const DEFAULT_COMPETITION_CONFIG: Readonly<CompetitionConfig> = Object.freeze({ difficulty: 1, scoringStrategy: "BEST" });

export type ChallengeId = "A" | "B" | "C";
export type ModeScoringStrategies = Partial<Record<ChallengeId, ScoringStrategy>>;

export type ChallengeMode = CompetitionConfig & {
  id: ChallengeId;
  /** Default only: the team can switch modes on and off at /modes (saved on this device). */
  enabled: boolean;
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
  sleepScreen: { floatMs: 4200, transitionMs: 650, cardInMs: 520, cardStaggerMs: 150, entryBufferMs: 80 }, // Entry/manual only; idle does not activate it.
  nicknameMaxLength: 24,
  nicknameEmojis: ['🎮', '🔥', '🚀', '✨', '😎', '⚡', '🌟', '🤖', '🐱', '🦖', '🍀', '🍉'],
  practice: { levelSetId: "set-01" },
  modeMotion: { cardsMs: 420, popupInMs: 380, popupOutMs: 180 },
  ages: Array.from({ length: 14 }, (_, index) => index + 5),
  leaderboardScroll: { pixelsPerSecond: 18, returnPixelsPerSecond: 12, startPauseMs: 1400, endPauseMs: 1800, interactionPauseMs: 3000 },
  modes: [
    { id: "A", enabled: true, ...DEFAULT_COMPETITION_CONFIG, nameKey: "mode.A", levelRange: [1, 50], levelSetId: "challenge-beginner", timeLimit: 900, challengeId: "A", thumbnail: "thumbnail-game-1.png" },
    { id: "B", enabled: true, ...DEFAULT_COMPETITION_CONFIG, nameKey: "mode.B", levelRange: [1, 50], levelSetId: "challenge-intermediate", timeLimit: 900, challengeId: "B", thumbnail: "thumbnail-game-2.png" },
    { id: "C", enabled: true, ...DEFAULT_COMPETITION_CONFIG, nameKey: "mode.C", levelRange: [1, 50], levelSetId: "challenge-pro", timeLimit: 900, challengeId: "C", thumbnail: "thumbnail-game-3.png" },
  ] satisfies ChallengeMode[],
} as const;

export const CHALLENGE_IDS: readonly ChallengeId[] = homeConfig.modes.map((mode) => mode.id);
export const defaultEnabledIds: readonly ChallengeId[] = homeConfig.modes.filter((mode) => mode.enabled).map((mode) => mode.id);

/** Configured modes that are switched on, in config order. Never empty: falls back to the defaults. */
export function enabledModesFor(ids: readonly ChallengeId[] | undefined, strategies: ModeScoringStrategies = {}): ChallengeMode[] {
  const valid = ids?.filter((id) => CHALLENGE_IDS.includes(id)) ?? [];
  const chosen = valid.length ? valid : defaultEnabledIds;
  return homeConfig.modes.filter((mode) => chosen.includes(mode.id))
    .map((mode) => ({ ...mode, scoringStrategy: strategies[mode.id] ?? mode.scoringStrategy }));
}
