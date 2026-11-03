// Codi Arena Scoreboard client, adapted from the booth skill's assets/scoreboard-client.js.
// Shared by the worker (API key mode, holds the bk_ key) and the page (public leaderboard only).
// Keep the retry rules: one submissionId per round, reused on every retry.

const RETRYABLE = new Set(["RATE_LIMITED", "HUB_UNAVAILABLE", "INTERNAL", "NETWORK"]);

export type ScoreboardRules = { aggregate: "best" | "sum" | "latest"; order: "asc" | "desc"; unit: string; decimals: number };

export type LeaderboardEntry = {
  rank: number;
  playerType: "user" | "guest";
  displayName: string;
  arenaNo?: number;
  pictureUrl?: string;
  pictureFullUrl?: string;
  photoUrl?: string;
  value: number;
  playCount: number;
};

export type Leaderboard = {
  booth: { id: string; name: string; rules: ScoreboardRules };
  entries: LeaderboardEntry[];
  me: { rank: number; value: number; playCount: number } | null;
  updatedAt: string;
};

export type HubUser = Record<string, unknown> & { sub: string };
export type GuestPlayer = { name: string; guestId?: string };

export type SubmitResult =
  | { ok: true; duplicate: boolean; scoreId: string; entry: { value: number; playCount: number; improved: boolean }; submissionId: string }
  | { ok: false; status: number; code: string; message: string; retryable: boolean; submissionId: string };

export const SUBMISSION_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
export const GUEST_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isRetryableCode(code: string): boolean {
  return RETRYABLE.has(code);
}

type Response_ = { ok: true; status: number; body: any } | { ok: false; status: number; code: string; message: string; retryable: boolean };

export function createScoreboardClient(opts: {
  baseUrl: string;
  boothId: string;
  /** API key mode: the bk_ key (worker only, never the page). */
  auth?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  fetch?: typeof fetch;
}) {
  const { baseUrl, boothId, auth, timeoutMs = 5000, maxAttempts = 4 } = opts;
  const fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const root = `${baseUrl.replace(/\/+$/, "")}/api/booths/${encodeURIComponent(boothId)}`;

  async function request(path: string, init: RequestInit): Promise<Response_> {
    try {
      const res = await fetchImpl(`${root}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      const body: any = await res.json().catch(() => null);
      if (res.ok) return { ok: true, status: res.status, body };
      const code = typeof body?.error?.code === "string" ? body.error.code : "INTERNAL";
      return { ok: false, status: res.status, code, message: body?.error?.message ?? res.statusText, retryable: RETRYABLE.has(code) };
    } catch (err) {
      return { ok: false, status: 0, code: "NETWORK", message: String((err as Error)?.message ?? err), retryable: true };
    }
  }

  return {
    /** Submit one finished round. Never rejects. API key mode: exactly one of hubUser / guest. */
    async submitScore(round: { score: number; submissionId: string; hubUser?: HubUser; guest?: GuestPlayer; photoUrl?: string }): Promise<SubmitResult> {
      const { score, submissionId, hubUser, guest, photoUrl } = round;
      if (typeof score !== "number" || !Number.isFinite(score)) throw new TypeError("score must be a finite number");
      const body = JSON.stringify({ score, submissionId, hubUser, guest, photoUrl });
      let last: Response_ | undefined;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        last = await request("/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth ?? ""}` },
          body,
        });
        if (last.ok) return { ok: true, duplicate: last.status === 200, ...last.body, submissionId };
        if (!last.retryable || attempt === maxAttempts) break;
        // RATE_LIMITED: the booth's per-player interval (default 3 s). Others: 1 s, 2 s, 4 s …
        const wait = last.code === "RATE_LIMITED" ? 3000 : 1000 * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      const failed = last as Extract<Response_, { ok: false }>;
      return { ok: false, status: failed.status, code: failed.code, message: failed.message, retryable: failed.retryable, submissionId };
    },

    /** Public leaderboard (no auth, CORS open, cached 2 s server-side — poll every 3–5 s at most). */
    async getLeaderboard(query: { limit?: number; userId?: string } = {}): Promise<Leaderboard> {
      const q = new URLSearchParams();
      if (query.limit !== undefined) q.set("limit", String(query.limit));
      if (query.userId) q.set("userId", query.userId);
      const search = q.toString();
      const res = await request(`/leaderboard${search ? `?${search}` : ""}`, { method: "GET" });
      if (!res.ok) throw Object.assign(new Error(res.message), { code: res.code, status: res.status });
      return res.body as Leaderboard;
    },
  };
}

/** Format a value the way the board does, e.g. formatScore(12.3, { unit: 'วินาที', decimals: 2 }) → "12.30 วินาที". */
export function formatScore(value: number, rules: Pick<ScoreboardRules, "unit" | "decimals">): string {
  const number = new Intl.NumberFormat("en-US", { minimumFractionDigits: rules.decimals, maximumFractionDigits: rules.decimals }).format(value);
  return rules.unit ? `${number} ${rules.unit}` : number;
}
