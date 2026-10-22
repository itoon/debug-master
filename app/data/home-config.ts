import type { CompetitionConfig, ScoringStrategy } from "../types/competition";

export const DEFAULT_COMPETITION_CONFIG: Readonly<CompetitionConfig> = Object.freeze({ difficulty: 1, scoringStrategy: "BEST" });

export type ChallengeId = "A" | "B" | "C";
export type LoginMethod = "manual" | "oauth";
export type ModeScoringStrategies = Partial<Record<ChallengeId, ScoringStrategy>>;

export const competitionTime = { defaultSeconds: 300, minMinutes: 1, maxMinutes: 15 } as const;
export function isCompetitionTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value / 60) && value >= competitionTime.minMinutes * 60 && value <= competitionTime.maxMinutes * 60;
}

export type ChallengeMode = CompetitionConfig & {
  id: ChallengeId;
  /** Default only: the team can switch modes on and off at /modes (saved on this device). */
  enabled: boolean;
  nameKey: "mode.A" | "mode.B" | "mode.C";
  levelRange: readonly [number, number];
  levelSetId: string;
  /** Seconds. Defaults to five minutes; staff can configure whole minutes at /modes. */
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
  /** Default only: the team chooses Codi Arena or the typed form at /modes. */
  login: "manual",
  nicknameEmojis: ['🎮', '🔥', '🚀', '✨', '😎', '⚡', '🌟', '🤖', '🐱', '🦖', '🍀', '🍉'],
  practice: { levelSetId: "set-01" },
  modeMotion: { cardsMs: 420, popupInMs: 380, popupOutMs: 180 },
  ages: Array.from({ length: 14 }, (_, index) => index + 5),
  leaderboardScroll: { pixelsPerSecond: 18, returnPixelsPerSecond: 12, startPauseMs: 1400, endPauseMs: 1800, interactionPauseMs: 3000 },
  modes: [
    { id: "A", enabled: true, ...DEFAULT_COMPETITION_CONFIG, nameKey: "mode.A", levelRange: [1, 50], levelSetId: "challenge-beginner", timeLimit: competitionTime.defaultSeconds, challengeId: "A", thumbnail: "thumbnail-game-1.png" },
    { id: "B", enabled: true, ...DEFAULT_COMPETITION_CONFIG, nameKey: "mode.B", levelRange: [1, 50], levelSetId: "challenge-intermediate", timeLimit: competitionTime.defaultSeconds, challengeId: "B", thumbnail: "thumbnail-game-2.png" },
    { id: "C", enabled: true, ...DEFAULT_COMPETITION_CONFIG, nameKey: "mode.C", levelRange: [1, 50], levelSetId: "challenge-pro", timeLimit: competitionTime.defaultSeconds, challengeId: "C", thumbnail: "thumbnail-game-3.png" },
  ] satisfies ChallengeMode[],
} as const;

export const CHALLENGE_IDS: readonly ChallengeId[] = homeConfig.modes.map((mode) => mode.id);
export const defaultEnabledIds: readonly ChallengeId[] = homeConfig.modes.filter((mode) => mode.enabled).map((mode) => mode.id);

export function isLoginMethod(value: unknown): value is LoginMethod {
  return value === "manual" || value === "oauth";
}

/** Saved choice at /modes, otherwise the home-config default. */
export function resolveLoginMethod(saved: LoginMethod | undefined): LoginMethod {
  return saved ?? homeConfig.login;
}

/** Configured modes that are switched on, in config order. Never empty: falls back to the defaults. */
export function enabledModesFor(ids: readonly ChallengeId[] | undefined, strategies: ModeScoringStrategies = {}, durationSec?: number): ChallengeMode[] {
  const valid = ids?.filter((id) => CHALLENGE_IDS.includes(id)) ?? [];
  const chosen = valid.length ? valid : defaultEnabledIds;
  return homeConfig.modes.filter((mode) => chosen.includes(mode.id))
    .map((mode) => ({ ...mode, scoringStrategy: strategies[mode.id] ?? mode.scoringStrategy, timeLimit: isCompetitionTime(durationSec) ? durationSec : mode.timeLimit }));
}
