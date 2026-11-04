// Forwards finished home-challenge rounds to the Codi Arena Scoreboard in API key mode. The game is one booth,
// and each challenge (A Beginner, B Intermediate, C Pro) is one of its Boards; the booth's bk_ key stays in this worker.
// A Codi player is identified by a ticket this worker signed at /oauth/complete; a typed-name player is a guest.
//   POST /scoreboard/scores  { challengeId, score, submissionId, ticket } | { challengeId, score, submissionId, guest: { name, guestId }, photoUrl? }
import { CHALLENGE_BOARDS, createScoreboardClient, GUEST_ID_RE, SUBMISSION_ID_RE, type ChallengeBoard, type HubUser } from "../../app/utils/scoreboardClient";

export interface ScoreboardEnv {
  ALLOWED_ORIGINS?: string;
  SCOREBOARD_BASE_URL?: string;
  /** Signs score tickets. Separate from the booth keys so rotating one key keeps players signed in. */
  SCORE_TICKET_SECRET?: string;
  SCOREBOARD_BOOTH_ID?: string;
  /** The booth's bk_ key, one for all its Boards. */
  SCOREBOARD_API_KEY?: string;
}

export type ScoreboardChallenge = "A" | "B" | "C";
const CHALLENGES: readonly ScoreboardChallenge[] = ["A", "B", "C"];

/** A booth day; the kid scans the badge again for a new ticket. */
const TICKET_TTL_MS = 12 * 60 * 60 * 1000;
/** Userinfo fields the Scoreboard reads. Nothing else about the kid goes in the ticket. */
const HUB_FIELDS = ["sub", "nickname", "name", "picture", "arena_picture_full", "arena_no", "arena_test"] as const;

/** The booth, its key and the challenge's Board, or null while the booth has no key. */
export function scoreboardBooth(env: ScoreboardEnv, challengeId: ScoreboardChallenge): { boothId: string; apiKey: string; board: ChallengeBoard } | null {
  const boothId = env.SCOREBOARD_BOOTH_ID?.trim();
  const apiKey = env.SCOREBOARD_API_KEY?.trim();
  return boothId && apiKey?.startsWith("bk_") ? { boothId, apiKey, board: CHALLENGE_BOARDS[challengeId] } : null;
}

/** Tickets are only worth issuing when scores can be sent. */
export function scoreboardEnabled(env: ScoreboardEnv): boolean {
  return Boolean(env.SCOREBOARD_BASE_URL && env.SCORE_TICKET_SECRET && scoreboardBooth(env, "A"));
}

export function pickHubUser(info: Record<string, unknown>): HubUser | null {
  if (typeof info.sub !== "string" || info.sub.length === 0) return null;
  const user: HubUser = { sub: info.sub };
  for (const field of HUB_FIELDS) if (info[field] !== undefined) (user as Record<string, unknown>)[field] = info[field];
  return user;
}

export async function signTicket(hubUser: HubUser, secret: string, now = Date.now()): Promise<string> {
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({ u: hubUser, exp: now + TICKET_TTL_MS })));
  return `${payload}.${base64Url(await hmac(secret, payload))}`;
}

export async function verifyTicket(ticket: string, secret: string, now = Date.now()): Promise<HubUser | null> {
  if (ticket.length > 2048) return null;
  const [payload, signature, extra] = ticket.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  let valid = false;
  try {
    valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), new TextEncoder().encode(payload));
  } catch {
    return null;
  }
  if (!valid) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { u?: unknown; exp?: unknown };
    if (typeof value.exp !== "number" || value.exp <= now || !value.u || typeof value.u !== "object") return null;
    return pickHubUser(value.u as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function handleScoreboard(request: Request, env: ScoreboardEnv, fetchImpl: typeof fetch = fetch): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/scoreboard/scores") return null;

  const origin = request.headers.get("Origin");
  if (!origin || !allowedOrigins(env).has(origin)) return json({ ok: false, code: "FORBIDDEN_ORIGIN", retryable: false }, 403, null);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== "POST") return json({ ok: false, code: "METHOD", retryable: false }, 405, origin);
  const body = await readBody(request, allowedOrigins(env));
  if (!body) return json({ ok: false, code: "INVALID_BODY", retryable: false }, 400, origin);
  const booth = scoreboardBooth(env, body.challengeId);
  if (!scoreboardEnabled(env) || !booth) return json({ ok: false, code: "SCOREBOARD_OFF", retryable: false }, 503, origin);

  let hubUser: HubUser | undefined;
  if (body.ticket !== undefined) {
    hubUser = (await verifyTicket(body.ticket, env.SCORE_TICKET_SECRET!)) ?? undefined;
    // An expired or forged ticket: the kid has to scan the badge again.
    if (!hubUser) return json({ ok: false, code: "TICKET", retryable: false }, 401, origin);
  }

  const client = createScoreboardClient({
    baseUrl: env.SCOREBOARD_BASE_URL!,
    boothId: booth.boothId,
    auth: booth.apiKey,
    // The page keeps the round and retries with the same submissionId, so one attempt here.
    maxAttempts: 1,
    fetch: fetchImpl,
  });
  const player = hubUser ? { hubUser } : { guest: body.guest!, ...(body.photoUrl ? { photoUrl: body.photoUrl } : {}) };
  const result = await client.submitScore({ score: body.score, board: booth.board, submissionId: body.submissionId, ...player });
  if (result.ok) return json({ ok: true, duplicate: result.duplicate, entry: result.entry }, 200, origin);
  if (result.code === "UNAUTHORIZED") console.error("scoreboard rejected SCOREBOARD_API_KEY: set the booth's current key");
  return json({ ok: false, code: result.code, retryable: result.retryable }, result.status || 502, origin);
}

type Body = { challengeId: ScoreboardChallenge; score: number; submissionId: string; ticket?: string; guest?: { name: string; guestId?: string }; photoUrl?: string };

/** A walk-in's avatar: only an avatar file served by the game's own https site, never any image. */
export function isGameAvatarUrl(value: unknown, origins: Set<string>): value is string {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && origins.has(url.origin) && /\/student-avatar\/[A-Za-z0-9_/-]+\.svg$/.test(url.pathname) && !url.search && !url.hash;
  } catch {
    return false;
  }
}

async function readBody(request: Request, origins: Set<string>): Promise<Body | null> {
  const text = await request.text();
  if (text.length === 0 || text.length > 4096) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object") return null;
    const body = value as Record<string, unknown>;
    if (typeof body.score !== "number" || !Number.isFinite(body.score)) return null;
    if (typeof body.submissionId !== "string" || !SUBMISSION_ID_RE.test(body.submissionId)) return null;
    if (!CHALLENGES.includes(body.challengeId as ScoreboardChallenge)) return null;
    const challengeId = body.challengeId as ScoreboardChallenge;
    if ((body.ticket === undefined) === (body.guest === undefined)) return null;
    if (body.ticket !== undefined) {
      return typeof body.ticket === "string" ? { challengeId, score: body.score, submissionId: body.submissionId, ticket: body.ticket } : null;
    }
    const guest = body.guest as Record<string, unknown> | null;
    if (!guest || typeof guest.name !== "string") return null;
    const name = guest.name.trim();
    const length = [...name].length;
    if (length < 1 || length > 40) return null;
    if (guest.guestId !== undefined && (typeof guest.guestId !== "string" || !GUEST_ID_RE.test(guest.guestId))) return null;
    // An avatar URL that isn't the game's own is dropped, not rejected: the score still counts.
    const photoUrl = isGameAvatarUrl(body.photoUrl, origins) ? { photoUrl: body.photoUrl } : {};
    return { challengeId, score: body.score, submissionId: body.submissionId, guest: { name, ...(guest.guestId ? { guestId: guest.guestId as string } : {}) }, ...photoUrl };
  } catch {
    return null;
  }
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function allowedOrigins(env: ScoreboardEnv): Set<string> {
  return new Set(String(env.ALLOWED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean));
}

function cors(origin: string): Headers {
  return new Headers({
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "Origin",
  });
}

function json(body: unknown, status: number, origin: string | null): Response {
  const headers = origin ? cors(origin) : new Headers();
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}
