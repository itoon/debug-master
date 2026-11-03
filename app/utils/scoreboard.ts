// Codi Arena Scoreboard for the home challenges (never Live rooms or practice). Each challenge is its own
// booth; live-server picks the booth and its bk_ key from the round's challengeId, so no key reaches the page.
// A finished round is kept on this device with its submissionId until live-server has forwarded it,
// so a network blip neither drops nor double-counts it.
import { reactive, ref } from "vue";
import { GUEST_ID_RE, SUBMISSION_ID_RE } from "./scoreboardClient";

const PENDING_KEY = "debug-master:scoreboard-pending";
const TICKETS_KEY = "debug-master:scoreboard-tickets";
const PENDING_MAX = 200;
const PENDING_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000; // live-server's own call to the hub times out at 5 s.
const RETRY_MS = [2000, 4000, 8000, 16000, 30000];

export type ScoreboardChallenge = "A" | "B" | "C";

export type PendingRound = {
  challengeId: ScoreboardChallenge;
  submissionId: string;
  score: number;
  createdAt: number;
  ticket?: string;
  guest?: { name: string; guestId?: string };
  /** A walk-in's chosen avatar on this game's own https site; the board shows it instead of an initial. */
  photoUrl?: string;
};

export type RoundStatus = "sending" | "recorded" | "pending" | "closed" | "dropped";

/** Per submissionId, for the result screen. */
export const roundStatus = reactive<Record<string, RoundStatus>>({});
/** Bumped after the hub records a round, so open leaderboards refresh. */
export const scoreboardVersion = ref(0);

type Store = Pick<Storage, "getItem" | "setItem">;

function store(): Store | null {
  try { return localStorage; } catch { return null; }
}

function readJson<T>(storage: Store | null, key: string, fallback: T): T {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage: Store | null, key: string, value: unknown): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // Quota or blocked storage.
  }
}

/** Rounds storage could not keep: still sent from this page, lost only if it closes first. */
const memoryPending = new Map<string, PendingRound>();

/** The ticket from this badge scan; never for a typed-name player, who has no codiSub. */
export function loginScoreTicket(codiSub: string | undefined, profile: { sub: string; scoreTicket?: string } | undefined): string | undefined {
  return codiSub && profile?.sub === codiSub ? profile.scoreTicket : undefined;
}

/** The ticket from the kid's latest badge scan, per local player. */
export function rememberScoreTicket(playerId: string, ticket: string, storage = store()): void {
  writeJson(storage, TICKETS_KEY, { ...readJson<Record<string, string>>(storage, TICKETS_KEY, {}), [playerId]: ticket });
}

export function scoreTicketFor(playerId: string, storage = store()): string | undefined {
  const ticket = readJson<Record<string, unknown>>(storage, TICKETS_KEY, {})[playerId];
  return typeof ticket === "string" ? ticket : undefined;
}

export function readPending(storage = store(), now = Date.now()): PendingRound[] {
  const stored = readJson<unknown>(storage, PENDING_KEY, []);
  const rounds = [...(Array.isArray(stored) ? stored : []), ...memoryPending.values()]
    .filter((round, index, all) => all.findIndex((other) => other?.submissionId === round?.submissionId) === index);
  // Rounds queued before challenges had their own booths were all Beginner.
  return rounds.map((round) => round && typeof round === "object" && round.challengeId === undefined ? { ...round, challengeId: "A" } : round)
    .filter((round): round is PendingRound => Boolean(round)
    && ["A", "B", "C"].includes(round.challengeId)
    && typeof round.submissionId === "string" && SUBMISSION_ID_RE.test(round.submissionId)
    && typeof round.score === "number" && Number.isFinite(round.score)
    && typeof round.createdAt === "number" && now - round.createdAt < PENDING_MAX_AGE_MS
    && (typeof round.ticket === "string" || (round.guest && typeof round.guest.name === "string")));
}

function removePending(submissionId: string, storage = store()): void {
  memoryPending.delete(submissionId);
  writeJson(storage, PENDING_KEY, readPending(storage).filter((round) => round.submissionId !== submissionId && !memoryPending.has(round.submissionId)));
}

/** Builds the round for one finished challenge session, or null when the player can't be named on the board. */
export function challengeRound(input: { challengeId: ScoreboardChallenge; sessionId: string; score: number; playerId: string; name: string; ticket?: string; codiLinked: boolean; photoUrl?: string; now?: number }): PendingRound | null {
  if (!SUBMISSION_ID_RE.test(input.sessionId) || !Number.isFinite(input.score)) return null;
  const base = { challengeId: input.challengeId, submissionId: input.sessionId, score: input.score, createdAt: input.now ?? Date.now() };
  if (input.ticket) return { ...base, ticket: input.ticket };
  // A badge player without a fresh ticket would land on the board as a stranger; let them scan again instead.
  if (input.codiLinked) return null;
  const name = input.name.trim();
  if (!name) return null;
  // Badge players keep their Codi picture; only a walk-in sends the avatar they picked.
  const photoUrl = input.photoUrl?.startsWith("https://") ? { photoUrl: input.photoUrl } : {};
  return { ...base, guest: { name, ...(GUEST_ID_RE.test(input.playerId) ? { guestId: input.playerId } : {}) }, ...photoUrl };
}

/** Keep the round, then send everything waiting. Same submissionId again is a no-op. */
export function queueRound(round: PendingRound, liveUrl: string, storage = store()): Promise<void> {
  const pending = readPending(storage).filter((item) => item.submissionId !== round.submissionId && !memoryPending.has(item.submissionId));
  if (!writeJson(storage, PENDING_KEY, [...pending, round].slice(-PENDING_MAX))) memoryPending.set(round.submissionId, round);
  roundStatus[round.submissionId] ??= "sending";
  return flushRounds(liveUrl, storage);
}

let flushing: Promise<void> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryStep = 0;

export function flushRounds(liveUrl: string, storage = store(), fetchImpl: typeof fetch = globalThis.fetch?.bind(globalThis)): Promise<void> {
  if (!liveUrl || !fetchImpl) return Promise.resolve();
  if (flushing) return flushing;
  clearTimeout(retryTimer);
  const run = (async () => {
    // Re-read after every send: rounds queued meanwhile join this flush. Each round is tried once per
    // flush, and one that must wait (say, a challenge whose key isn't set) never holds up the others.
    const tried = new Set<string>();
    let waiting = false;
    for (let round = nextUntried(storage, tried); round; round = nextUntried(storage, tried)) {
      tried.add(round.submissionId);
      const outcome = await sendRound(liveUrl, round, fetchImpl);
      if (outcome === "retry") {
        roundStatus[round.submissionId] = "pending";
        waiting = true;
        continue;
      }
      removePending(round.submissionId, storage);
      roundStatus[round.submissionId] = outcome;
      if (outcome === "recorded") scoreboardVersion.value++;
    }
    if (waiting) retryTimer = setTimeout(() => void flushRounds(liveUrl, storage, fetchImpl), RETRY_MS[Math.min(retryStep++, RETRY_MS.length - 1)]);
    else retryStep = 0;
  })();
  // Cleared after assignment: an empty queue finishes synchronously, before `flushing` is set.
  flushing = run;
  void run.finally(() => {
    if (flushing === run) flushing = undefined;
    // A round queued as this flush was ending joined a promise that no longer sends it.
    if (readPending(storage).some((round) => roundStatus[round.submissionId] === "sending")) void flushRounds(liveUrl, storage, fetchImpl);
  });
  return run;
}

function nextUntried(storage: Store | null, tried: Set<string>): PendingRound | undefined {
  return readPending(storage).find((round) => !tried.has(round.submissionId));
}

async function sendRound(liveUrl: string, round: PendingRound, fetchImpl: typeof fetch): Promise<"recorded" | "closed" | "dropped" | "retry"> {
  const { createdAt: _createdAt, ...body } = round;
  let response: Response;
  try {
    response = await fetchImpl(`${liveUrl.replace(/\/+$/, "")}/scoreboard/scores`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return "retry";
  }
  const result = await response.json().catch(() => null) as { ok?: boolean; code?: string; retryable?: boolean } | null;
  if (response.ok && result?.ok) return "recorded";
  // SCOREBOARD_OFF: the worker has no key yet; keep the round until it does.
  if (!result || result.retryable || result.code === "SCOREBOARD_OFF") return "retry";
  if (result.code === "BOOTH_CLOSED") return "closed";
  console.warn(`Scoreboard did not take round ${round.submissionId}: ${result.code}`);
  return "dropped";
}
