import {
  MAX_DURATION_SEC,
  MAX_MSG_BYTES,
  MIN_DURATION_SEC,
  NAME_MAX,
  PID_RE,
  PLAYER_ID_RE,
  type ClientMessage,
  type ModeId,
  type Role,
} from '../../app/utils/live/protocol'
import { PLAYER_AVATARS, isPlayerAvatarId } from '../../app/data/player-avatars'

const MODES: readonly string[] = ['A', 'B', 'C']
const AGE_MIN = 5
const AGE_MAX = 18

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' })
const encoder = new TextEncoder()

/** Strip control characters, collapse whitespace, then cut at a grapheme boundary within NAME_MAX UTF-16 units. */
export function cleanName(v: unknown): string {
  if (typeof v !== 'string') return ''
  const text = v.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim()
  if (text.length <= NAME_MAX) return text
  let out = ''
  for (const { segment } of segmenter.segment(text)) {
    if (out.length + segment.length > NAME_MAX) break
    out += segment
  }
  return out.trimEnd()
}

function isNonNegInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
}

function isPid(v: unknown): v is string {
  return typeof v === 'string' && PID_RE.test(v)
}

export function parseClientMessage(raw: string | ArrayBuffer, role: Role): ClientMessage | null {
  if (typeof raw !== 'string') return null
  if (raw.length > MAX_MSG_BYTES) return null // cheap pre-check: bytes >= UTF-16 units
  if (encoder.encode(raw).length > MAX_MSG_BYTES) return null

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const m = data as Record<string, unknown>

  switch (m.type) {
    case 'hello': {
      if (role !== 'player') return { type: 'hello' }
      const name = cleanName(m.name)
      if (!isPid(m.pid) || !name) return null
      if (typeof m.age !== 'number' || !Number.isInteger(m.age) || m.age < AGE_MIN || m.age > AGE_MAX) return null
      return {
        type: 'hello',
        pid: m.pid,
        name,
        avatarId: isPlayerAvatarId(m.avatarId) ? m.avatarId : PLAYER_AVATARS[0],
        age: m.age,
      }
    }
    case 'gameplay': {
      if (role !== 'player') return null
      const allowed = ['type', 'protocolVersion', 'roundId', 'sessionId', 'sequence', 'levelId', 'at', 'action', 'direction']
      if (Object.keys(m).some(key => !allowed.includes(key)) || !isNonNegInt(m.protocolVersion) ||
        !isNonNegInt(m.roundId) || typeof m.sessionId !== 'string' || !m.sessionId || m.sessionId.length > 128 ||
        !isNonNegInt(m.sequence) || m.sequence < 1 || !isNonNegInt(m.levelId) ||
        !isNonNegInt(m.at) || m.at > 8.64e15 || !['ready', 'direction', 'reset'].includes(m.action as string)) return null
      if (m.action === 'direction' ? !['up', 'down', 'left', 'right'].includes(m.direction as string) : m.direction !== undefined) return null
      return m as unknown as ClientMessage
    }
    case 'leave':
      return role === 'player' ? { type: 'leave' } : null
    case 'setMode':
      if (role !== 'host' || typeof m.mode !== 'string' || !MODES.includes(m.mode)) return null
      return { type: 'setMode', mode: m.mode as ModeId }
    case 'setDuration': {
      const d = m.durationSec
      if (role !== 'host' || typeof d !== 'number' || !Number.isInteger(d)) return null
      if (d < MIN_DURATION_SEC || d > MAX_DURATION_SEC) return null
      return { type: 'setDuration', durationSec: d }
    }
    case 'start':
    case 'endEarly':
    case 'newRound':
      return role === 'host' ? { type: m.type } : null
    case 'kick':
      // playerId is the public LivePlayer.id, never a device's secret pid.
      if (role !== 'host' || typeof m.playerId !== 'string' || !PLAYER_ID_RE.test(m.playerId)) return null
      return { type: 'kick', playerId: m.playerId }
    default:
      return null
  }
}
