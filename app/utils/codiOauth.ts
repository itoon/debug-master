import { homeConfig, type ChallengeId } from "../data/home-config";
import { normalizeRoomCode } from "./live/protocol";

/** Public Codi Arena app. The client secret never belongs in this file. */
export const CODI_ISSUER = "https://codi-arena-hub.innovasive.workers.dev";
export const CODI_CLIENT_ID = "cva_zlfJ437Zr3GMa4ps";

/** Registered redirect URIs. The hub compares them character for character. */
export const CODI_REDIRECTS = {
  "http://localhost:3002": "http://localhost:3002/callback",
  "https://itoon.github.io": "https://itoon.github.io/debug-master/callback",
} as const;

const VERIFIER_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

export type CodiContext =
  | { kind: "home"; modeId: ChallengeId }
  | { kind: "live"; room: string };

export type CodiProfile = { sub: string; nickname: string; picture: string };

export function redirectUriForOrigin(origin: string): string | null {
  return CODI_REDIRECTS[origin as keyof typeof CODI_REDIRECTS] ?? null;
}

export function codiReturnPath(baseURL: string, context: CodiContext): string {
  const base = baseURL.endsWith("/") ? baseURL : `${baseURL}/`;
  if (context.kind === "live") {
    const room = normalizeRoomCode(context.room);
    if (room) return `${base}?room=${encodeURIComponent(room)}`;
  }
  return base;
}

export function createVerifier(random: Uint8Array = crypto.getRandomValues(new Uint8Array(64))): string {
  return Array.from(random, (byte) => VERIFIER_ALPHABET[byte % VERIFIER_ALPHABET.length]!).join("");
}

export function randomToken(bytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function buildAuthorizeUrl(input: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  challenge: string;
}): string {
  const url = new URL("/oauth/authorize", input.issuer);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.href;
}

/** The hub renders one Codi image at this URL. `size` asks for that same picture, not separate parts. */
export function isCodiPictureUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 500) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function codiPictureSrc(picture: string): string {
  try {
    const url = new URL(picture);
    if (url.protocol !== "https:") return picture;
    if (!url.searchParams.has("size")) url.searchParams.set("size", "512");
    return url.href;
  } catch {
    return picture;
  }
}

export function trimCodiNickname(nickname: string): string {
  return nickname.trim().slice(0, homeConfig.nicknameMaxLength);
}

export function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
