import { CHALLENGE_IDS, type ChallengeId } from "../data/home-config";
import {
  buildAuthorizeUrl,
  codeChallenge,
  createVerifier,
  randomToken,
  redirectUriForOrigin,
  trimCodiNickname,
  type CodiContext,
  type CodiProfile,
} from "./codiOauth";

const TXN_KEY = "debug-master:codi-txn";
const RESULT_KEY = "debug-master:codi-result";

export class CodiOriginError extends Error {
  constructor() { super("Codi Arena login is only available on the registered origins"); }
}

export type CodiTxn = CodiContext & { verifier: string; state: string; nonce: string };

export type CodiResult = CodiContext & {
  profile?: CodiProfile;
  fallback?: boolean;
  error?: string;
};

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): Store {
  return sessionStorage;
}

export function saveCodiTxn(txn: CodiTxn, storage: Store = store()): void {
  storage.setItem(TXN_KEY, JSON.stringify(txn));
}

export function readCodiTxn(storage: Store = store()): CodiTxn | null {
  return parseTxn(storage.getItem(TXN_KEY));
}

export function clearCodiTxn(storage: Store = store()): void {
  storage.removeItem(TXN_KEY);
}

export function saveCodiResult(result: CodiResult, storage: Store = store()): void {
  storage.setItem(RESULT_KEY, JSON.stringify(result));
}

export function peekCodiResult(storage: Store = store()): CodiResult | null {
  return parseResult(storage.getItem(RESULT_KEY));
}

export function clearCodiResult(storage: Store = store()): void {
  storage.removeItem(RESULT_KEY);
}

export async function beginCodiLogin(context: CodiContext, config: { issuer: string; clientId: string }): Promise<void> {
  const redirectUri = redirectUriForOrigin(window.location.origin);
  if (!redirectUri || !config.issuer || !config.clientId) throw new CodiOriginError();
  const verifier = createVerifier();
  const txn: CodiTxn = { ...context, verifier, state: randomToken(), nonce: randomToken() };
  saveCodiTxn(txn);
  window.location.assign(buildAuthorizeUrl({
    issuer: config.issuer,
    clientId: config.clientId,
    redirectUri,
    state: txn.state,
    nonce: txn.nonce,
    challenge: await codeChallenge(verifier),
  }));
}

function parseTxn(raw: string | null): CodiTxn | null {
  const value = parseJson(raw);
  if (!value || !token(value.verifier) || !token(value.state) || !token(value.nonce)) return null;
  const context = parseContext(value);
  return context ? { ...context, verifier: value.verifier, state: value.state, nonce: value.nonce } : null;
}

function parseResult(raw: string | null): CodiResult | null {
  const value = parseJson(raw);
  if (!value) return null;
  const context = parseContext(value);
  if (!context) return null;
  const profile = parseProfile(value.profile);
  if (value.profile !== undefined && !profile) return null;
  return {
    ...context,
    ...(profile ? { profile } : {}),
    ...(value.fallback === true ? { fallback: true } : {}),
    ...(typeof value.error === "string" && value.error.length > 0 && value.error.length <= 200 ? { error: value.error } : {}),
  };
}

function parseContext(value: Json): CodiContext | null {
  if (value.kind === "home" && CHALLENGE_IDS.includes(value.modeId as ChallengeId)) {
    return { kind: "home", modeId: value.modeId as ChallengeId };
  }
  if (value.kind === "live" && typeof value.room === "string" && value.room.length > 0 && value.room.length <= 16) {
    return { kind: "live", room: value.room };
  }
  return null;
}

function parseProfile(value: unknown): CodiProfile | null {
  if (!value || typeof value !== "object") return null;
  const profile = value as Json;
  const nickname = typeof profile.nickname === "string" ? trimCodiNickname(profile.nickname) : "";
  if (!nickname || typeof profile.sub !== "string" || profile.sub.length === 0 || profile.sub.length > 200) return null;
  if (typeof profile.picture !== "string" || !profile.picture.startsWith("https://") || profile.picture.length > 500) return null;
  return { sub: profile.sub, nickname, picture: profile.picture };
}

function token(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._~-]{16,128}$/.test(value);
}

type Json = Record<string, unknown>;

function parseJson(raw: string | null): Json | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Json : null;
  } catch {
    return null;
  }
}
