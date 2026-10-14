// Per-device identity for the Live Race Room. Framework-free: no Vue imports.
// Every localStorage access is wrapped in try/catch (private mode / blocked storage).
import { HOST_KEY_RE, PID_RE, normalizeRoomCode } from './protocol'

const PID_KEY = 'debug-master:live-pid'
const HOST_KEY_PREFIX = 'debug-master:host:'

// Used when storage is unavailable, so the id is at least stable for this page load.
let memoryPid: string | null = null

function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // randomUUID needs a secure context; plain-http LAN dev falls back to 18 random bytes.
  return newHostKey()
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** 18 random bytes as base64url (24 chars), valid against HOST_KEY_RE. */
export function newHostKey(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(18)))
}

export function livePlayerId(): string {
  try {
    const saved = localStorage.getItem(PID_KEY)
    if (saved && PID_RE.test(saved)) return saved
  } catch {
    /* storage blocked: fall through to memory id */
  }
  return resetLivePlayerId(memoryPid ?? undefined)
}

/** Replaces the stored player id with a new random one (or `id`) and returns it. */
export function resetLivePlayerId(id?: string): string {
  const fresh = id ?? randomId()
  memoryPid = fresh
  try {
    localStorage.setItem(PID_KEY, fresh)
  } catch {
    /* keep the in-memory id */
  }
  return fresh
}

function hostStorageKey(code: string): string {
  return HOST_KEY_PREFIX + (normalizeRoomCode(code) ?? code.trim().toUpperCase())
}

export function hostKeyFor(code: string): string | null {
  try {
    const saved = localStorage.getItem(hostStorageKey(code))
    return saved && HOST_KEY_RE.test(saved) ? saved : null
  } catch {
    return null
  }
}

export function saveHostKey(code: string, key: string): void {
  try {
    localStorage.setItem(hostStorageKey(code), key)
  } catch {
    /* storage blocked: this device just can't remember the key */
  }
}
