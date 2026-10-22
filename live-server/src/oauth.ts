// Exchanges a Codi Arena authorization code. The browser only receives the kid's
// name and picture. The client secret and access token stay in this worker.
import { homeConfig } from "../../app/data/home-config";
import { redirectUriForOrigin } from "../../app/utils/codiOauth";

export interface OauthEnv {
  ALLOWED_ORIGINS?: string;
  CODI_ISSUER?: string;
  CODI_CLIENT_ID?: string;
  CODI_CLIENT_SECRET?: string;
}

export type CodiProfile = { sub: string; nickname: string; picture: string };

const VERIFIER_RE = /^[A-Za-z0-9._~-]{43,128}$/;
const SKEW_SEC = 60;

export async function handleOauth(request: Request, env: OauthEnv, fetchImpl: typeof fetch = fetch): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/oauth/complete") return null;

  const origin = request.headers.get("Origin");
  const allowed = allowedOrigins(env);
  if (!origin || !allowed.has(origin)) return json({ error: "origin" }, 403, null);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== "POST") return json({ error: "method" }, 405, origin);

  const redirectUri = redirectUriForOrigin(origin);
  const issuer = env.CODI_ISSUER?.replace(/\/+$/, "") ?? "";
  const clientId = env.CODI_CLIENT_ID ?? "";
  const clientSecret = env.CODI_CLIENT_SECRET ?? "";
  if (!redirectUri || !issuer || !clientId || !clientSecret) return json({ error: "unavailable" }, 500, origin);

  const body = await readBody(request);
  if (!body || body.redirect_uri !== redirectUri || !VERIFIER_RE.test(body.code_verifier) || !token(body.nonce) || !token(body.code)) {
    return json({ error: "request" }, 400, origin);
  }

  try {
    const profile = await completeLogin({
      issuer, clientId, clientSecret, redirectUri,
      code: body.code, codeVerifier: body.code_verifier, nonce: body.nonce, fetchImpl,
    });
    return json(profile, 200, origin);
  } catch (error) {
    const reason = (error instanceof Error ? error.message : "error").replace(/cvs_[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 120);
    console.error(`oauth complete failed: ${reason}`);
    return json({ error: "login_failed" }, 401, origin);
  }
}

export async function completeLogin(input: {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  nonce: string;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<CodiProfile> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? Date.now();
  const tokenResponse = await fetchDirect(fetchImpl, new URL("/oauth/token", input.issuer), {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
      client_id: input.clientId,
      client_secret: input.clientSecret,
    }),
  });
  const tokenJson = await readJson(tokenResponse);
  const accessToken = stringField(tokenJson, "access_token");
  const idToken = stringField(tokenJson, "id_token");
  if (!tokenResponse.ok || !accessToken || !idToken) throw new Error(`token:${tokenResponse.status}`);

  const claims = await verifyIdToken(idToken, {
    issuer: input.issuer,
    clientId: input.clientId,
    nonce: input.nonce,
    now,
    fetchImpl,
  });

  const infoResponse = await fetchDirect(fetchImpl, new URL("/oauth/userinfo", input.issuer), {
    signal: AbortSignal.timeout(8000),
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const info = await readJson(infoResponse);
  if (!infoResponse.ok || !info) throw new Error(`userinfo:${infoResponse.status}`);
  const sub = stringField(info, "sub");
  const nickname = (stringField(info, "nickname") ?? stringField(info, "name") ?? "").trim().slice(0, homeConfig.nicknameMaxLength);
  const picture = stringField(info, "picture");
  if (!sub || sub !== claims.sub || !nickname || !picture || !picture.startsWith("https://") || picture.length > 500) {
    throw new Error("profile");
  }
  return { sub, nickname, picture };
}

export async function verifyIdToken(idToken: string, input: {
  issuer: string;
  clientId: string;
  nonce: string;
  now: number;
  fetchImpl: typeof fetch;
}): Promise<{ sub: string }> {
  const parts = idToken.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) throw new Error("jwt");
  const header = decodeJson(parts[0]!);
  const payload = decodeJson(parts[1]!);
  if (!header || header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("header");
  const key = await jwkForKid(input.issuer, header.kid, input.fetchImpl);
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlToBytes(parts[2]!);
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, data);
  if (!valid || !payload) throw new Error("signature");
  const nowSec = Math.floor(input.now / 1000);
  const aud = payload.aud;
  const audienceOk = aud === input.clientId || (Array.isArray(aud) && aud.includes(input.clientId));
  if (payload.iss !== input.issuer || !audienceOk || payload.nonce !== input.nonce) throw new Error("claims");
  if (typeof payload.exp !== "number" || payload.exp <= nowSec - SKEW_SEC) throw new Error("exp");
  if (typeof payload.nbf === "number" && payload.nbf > nowSec + SKEW_SEC) throw new Error("nbf");
  if (typeof payload.sub !== "string" || payload.sub.length === 0) throw new Error("sub");
  return { sub: payload.sub };
}

function fetchDirect(fetchImpl: typeof fetch, url: URL, init: RequestInit): Promise<Response> {
  return fetchImpl(url, { ...init, redirect: "manual" }).then((response) => {
    if (response.status >= 300 && response.status < 400) throw new Error("redirect");
    return response;
  });
}

function allowedOrigins(env: OauthEnv): Set<string> {
  return new Set(String(env.ALLOWED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean));
}

type RsaJwk = { kid?: string; kty?: string; n?: string; e?: string };

async function jwkForKid(issuer: string, kid: string, fetchImpl: typeof fetch): Promise<JsonWebKey> {
  const response = await fetchDirect(fetchImpl, new URL("/oauth/jwks", issuer), { signal: AbortSignal.timeout(8000) });
  const body = await readJson(response);
  const keys = body && Array.isArray(body.keys) ? body.keys : [];
  const key = keys.find((item): item is RsaJwk => Boolean(item && typeof item === "object" && (item as RsaJwk).kid === kid));
  if (!response.ok || !key || key.kty !== "RSA" || typeof key.n !== "string" || typeof key.e !== "string") throw new Error("jwks");
  return { kty: "RSA", n: key.n, e: key.e, alg: "RS256", ext: true };
}

async function readBody(request: Request): Promise<{ code: string; code_verifier: string; nonce: string; redirect_uri: string } | null> {
  const text = await request.text();
  if (text.length === 0 || text.length > 4096) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object") return null;
    const body = value as Record<string, unknown>;
    if (typeof body.code !== "string" || typeof body.code_verifier !== "string" || typeof body.nonce !== "string" || typeof body.redirect_uri !== "string") return null;
    return { code: body.code, code_verifier: body.code_verifier, nonce: body.nonce, redirect_uri: body.redirect_uri };
  } catch {
    return null;
  }
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function stringField(value: Record<string, unknown> | null, key: string): string | null {
  const field = value?.[key];
  return typeof field === "string" && field.length > 0 ? field : null;
}

function token(value: string): boolean {
  return value.length >= 1 && value.length <= 512 && !/[\s]/.test(value);
}

function decodeJson(part: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
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
