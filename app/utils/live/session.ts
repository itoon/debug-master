// The live player on this device, remembered across a reload. Framework-free: no Vue imports.
// Every localStorage access is wrapped in try/catch (private mode / blocked storage).
import { PID_RE, normalizeRoomCode } from './protocol'

const SESSION_KEY = 'debug-master:live-session'
/** Longest round (15 min) plus a little: an older session is never resumed. */
export const SESSION_MAX_AGE_MS = 16 * 60 * 1000

export interface LiveSession {
  pid: string
  room: string
  nickname: string
  age: number
  avatarId: string
  savedAt: number
}

export function saveLiveSession(session: LiveSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* storage blocked: a reload just shows the form again */
  }
}

export function clearLiveSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

/** The saved session for this device id and room, if well-formed and at most SESSION_MAX_AGE_MS old. */
export function loadLiveSession(pid: string, room: string, now: number): LiveSession | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  let s: Partial<LiveSession>
  try {
    s = JSON.parse(raw) as Partial<LiveSession>
  } catch {
    return null
  }
  if (!s || typeof s !== 'object') return null
  if (typeof s.pid !== 'string' || !PID_RE.test(s.pid) || s.pid !== pid) return null
  if (typeof s.room !== 'string' || normalizeRoomCode(s.room) !== normalizeRoomCode(room)) return null
  if (typeof s.nickname !== 'string' || !s.nickname.trim()) return null
  if (typeof s.age !== 'number' || !Number.isInteger(s.age)) return null
  if (typeof s.avatarId !== 'string') return null
  if (typeof s.savedAt !== 'number' || !Number.isFinite(s.savedAt)) return null
  if (s.savedAt > now + 60_000 || now - s.savedAt > SESSION_MAX_AGE_MS) return null
  return { pid: s.pid, room: s.room, nickname: s.nickname, age: s.age, avatarId: s.avatarId, savedAt: s.savedAt }
}
