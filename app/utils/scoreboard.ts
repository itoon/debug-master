import { competitionTime, DEFAULT_COMPETITION_CONFIG, type ChallengeId } from "../data/home-config";
import type { CompetitionSession } from "../types/competition";
import type { Score } from "../types/debug-game";
import type { RankingBoard } from "./ranking";

// Codi Arena Scoreboard (COD-1144): a finished Challenge run at the default 5:00 goes to the `debug-master` Booth,
// on the Board of its Tier, through the live-server Worker (which holds the booth's API key — this site is static).
// The session id is the submissionId, so a resend never counts twice. Scores are worked out in this browser; that
// is an accepted risk (docs/adr/0001-browser-scored-runs-via-worker-relay.md).

/** Challenge A, B, C are the Beginner, Intermediate and Pro Tiers; each is one Board of the booth. */
export const CHALLENGE_BOARDS: Record<ChallengeId, "beginner" | "intermediate" | "pro"> = { A: "beginner", B: "intermediate", C: "pro" };

/** What Codi Arena sign-in returned for a badge kid (see live-server/src/oauth.ts). */
export type HubProfile = { sub: string; nickname: string; picture: string; arena_no?: number; arena_test?: boolean };

export type RelayBody = { score: number; board: string; submissionId: string }
  & ({ hubUser: HubProfile } | { guest: { name: string; guestId: string } });

const ID = /^[\w-]{1,64}$/;

/** The submit for a finished run, or undefined when this run doesn't go to the Scoreboard. */
export function scoreboardBody(session: CompetitionSession, hub: HubProfile | undefined): RelayBody | undefined {
  if (session.status !== "finished" || !session.challengeId) return undefined;
  // Only the event's challenge setup ranks: staff changes at /modes stay on this device.
  if (session.timeLimitSec !== competitionTime.defaultSeconds || session.config.difficulty !== DEFAULT_COMPETITION_CONFIG.difficulty) return undefined;
  const board = CHALLENGE_BOARDS[session.challengeId];
  if (!board || !ID.test(session.id)) return undefined;
  const base = { score: session.totalScore, board, submissionId: session.id };
  if (hub) return { ...base, hubUser: hub };
  if (!ID.test(session.playerId)) return undefined;
  return { ...base, guest: { name: session.name, guestId: session.playerId } };
}

/** `pending` is sent again later with the same run; `closed` (booth not taking scores) and `rejected` are final. */
export type RelayStatus = "sent" | "pending" | "closed" | "rejected";
const RETRYABLE = new Set(["RATE_LIMITED", "HUB_UNAVAILABLE", "INTERNAL", "NETWORK"]);

export function relayOutcome(status: number, code?: string): RelayStatus {
  if (status === 200 || status === 201) return "sent";
  if (code === "BOOTH_CLOSED") return "closed";
  if ((code && RETRYABLE.has(code)) || (!code && (status === 0 || status >= 500))) return "pending";
  return "rejected";
}

/** POST <live-server>/scores with a 5 s timeout; branches on the Scoreboard's error `code`. */
export async function sendViaRelay(liveUrl: string, body: RelayBody, fetchImpl: typeof fetch = fetch): Promise<RelayStatus> {
  try {
    const res = await fetchImpl(`${liveUrl.replace(/\/+$/, "")}/scores`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return relayOutcome(res.status);
    const error = await res.json().catch(() => null) as { error?: { code?: string } } | null;
    return relayOutcome(res.status, error?.error?.code);
  } catch {
    return relayOutcome(0, "NETWORK");
  }
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const OUTBOX_KEY = "debug-master:scoreboard-outbox";
const HUB_KEY = "debug-master:codi-hub";
const MAX_PENDING = 100;

function readList(storage: Store | null): RelayBody[] {
  try {
    const value: unknown = JSON.parse(storage?.getItem(OUTBOX_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((b): b is RelayBody => Boolean(b && typeof b === "object" && typeof (b as RelayBody).submissionId === "string")) : [];
  } catch {
    return [];
  }
}

/**
 * Runs waiting for the Scoreboard, kept in localStorage so a reload (or the next round) sends them again.
 * `storage` null (private mode, blocked storage): runs are just sent, and a pending one is lost with the tab.
 */
export function createScoreboardOutbox(storage: Store | null, send: (body: RelayBody) => Promise<RelayStatus>) {
  let flushing: Promise<void> | undefined;
  const write = (list: RelayBody[]) => {
    try { storage?.setItem(OUTBOX_KEY, JSON.stringify(list.slice(-MAX_PENDING))); } catch { /* full or blocked */ }
  };
  const drop = (id: string) => write(readList(storage).filter((b) => b.submissionId !== id));

  async function submit(body: RelayBody): Promise<RelayStatus> {
    const list = readList(storage);
    if (!list.some((b) => b.submissionId === body.submissionId)) write([...list, body]);
    const status = await send(body);
    if (status !== "pending") drop(body.submissionId);
    return status;
  }

  /** Sends every waiting run once, oldest first; one flush at a time. */
  function flush(): Promise<void> {
    flushing ??= (async () => {
      for (const body of readList(storage)) {
        if ((await send(body)) !== "pending") drop(body.submissionId);
      }
    })().finally(() => { flushing = undefined; });
    return flushing;
  }

  return { submit, flush, pending: () => readList(storage) };
}

/** Each badge kid's sign-in profile by local player, so their runs (also after a reload) carry it to the Scoreboard. */
export function createHubProfiles(storage: Store | null) {
  const read = (): Record<string, HubProfile> => {
    try {
      const value: unknown = JSON.parse(storage?.getItem(HUB_KEY) ?? "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, HubProfile> : {};
    } catch {
      return {};
    }
  };
  return {
    remember(playerId: string, profile: HubProfile) {
      try { storage?.setItem(HUB_KEY, JSON.stringify({ ...read(), [playerId]: profile })); } catch { /* full or blocked */ }
    },
    forPlayer(playerId: string): HubProfile | undefined {
      const p = read()[playerId];
      return p && typeof p.sub === "string" ? p : undefined;
    },
  };
}

// ---- Reading the central Board (COD-1145) ----

/** The Tier Board a challenge ranking shows, or undefined when that ranking stays on this device (staff setups). */
export function centralBoardId(board: Pick<RankingBoard, "challengeId" | "timeLimitSec" | "difficulty">): (typeof CHALLENGE_BOARDS)[ChallengeId] | undefined {
  if (!board.challengeId) return undefined;
  if (board.timeLimitSec !== competitionTime.defaultSeconds || board.difficulty !== DEFAULT_COMPETITION_CONFIG.difficulty) return undefined;
  return CHALLENGE_BOARDS[board.challengeId];
}

/** One row of the Scoreboard's public leaderboard (never another player's id). */
export type CentralEntry = { rank: number; playerType: "user" | "guest"; displayName: string; arenaNo?: number; pictureUrl?: string; photoUrl?: string; value: number; playCount: number };
export type CentralLeaderboard = { entries: CentralEntry[]; me: { rank: number; value: number; playCount: number } | null };

/** Who "you" are: this device's player and run; the signed-in kid is found by `me` rank, a typed player by nickname. */
export type CentralYou = { playerId?: string; sessionId?: string; nickname?: string; meRank?: number };

const DEFAULT_AVATAR = "codi_default.svg";

/** Scoreboard entries as ranking rows, so the same ranking components draw them. "You" carries the local ids. */
export function centralScores(boardId: string, entries: CentralEntry[], you: CentralYou): Score[] {
  const nickname = you.nickname?.trim().normalize("NFC").toLocaleLowerCase("th-TH");
  let found = false;
  return entries.map((e, index) => {
    const byRank = e.playerType === "user" && you.meRank !== undefined && you.meRank === e.rank;
    const byName = e.playerType === "guest" && !!nickname && e.displayName.trim().normalize("NFC").toLocaleLowerCase("th-TH") === nickname;
    const mine = !found && (byRank || byName) && !!you.playerId;
    if (mine) found = true;
    const picture = [e.photoUrl, e.pictureUrl].find((p): p is string => typeof p === "string" && p.startsWith("https://"));
    const id = `central-${boardId}-${index}`;
    return {
      id: mine && you.sessionId ? you.sessionId : id,
      playerId: mine ? you.playerId : id,
      name: e.displayName, avatarId: picture ?? DEFAULT_AVATAR,
      setId: boardId, setTitle: "", mode: "timer", language: "python", debug: false,
      score: e.value, bestCombo: 0, levelsCompleted: 0, levelReached: 0, inputs: 0, elapsedMs: 0,
      createdAt: "", updatedAt: "", difficulty: DEFAULT_COMPETITION_CONFIG.difficulty, scoringStrategy: "BEST",
      central: { plays: e.playCount, ...(e.arenaNo === undefined ? {} : { arenaNo: e.arenaNo }) },
    } satisfies Score;
  });
}

/** GET <scoreboard>/api/booths/<booth>/leaderboard for one Board (public, CORS open, 5 s timeout). */
export async function fetchCentralBoard(config: { url: string; boothId: string }, boardId: string, sub: string | undefined, fetchImpl: typeof fetch = fetch): Promise<CentralLeaderboard> {
  const q = new URLSearchParams({ board: boardId, limit: "50" });
  if (sub) q.set("userId", sub);
  const res = await fetchImpl(`${config.url.replace(/\/+$/, "")}/api/booths/${encodeURIComponent(config.boothId)}/leaderboard?${q}`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`leaderboard ${res.status}`);
  const body = await res.json() as Partial<CentralLeaderboard>;
  return { entries: Array.isArray(body.entries) ? body.entries : [], me: body.me ?? null };
}
