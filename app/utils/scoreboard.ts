import { competitionTime, DEFAULT_COMPETITION_CONFIG, type ChallengeId } from "../data/home-config";
import type { CompetitionSession } from "../types/competition";

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
