import { afterEach, describe, expect, it, vi } from 'vitest'
import { SESSION_MAX_AGE_MS, clearLiveSession, loadLiveSession, saveLiveSession } from '../../app/utils/live/session'

class MemStorage {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
}

const session = { pid: 'pid-abc123', room: 'CODI-1', nickname: 'มิ้นท์', age: 9, avatarId: 'codi_default.svg', savedAt: 1_000_000 }

describe('live session', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('round-trips for the same device id and room within 16 minutes', () => {
    vi.stubGlobal('localStorage', new MemStorage())
    saveLiveSession(session)
    expect(loadLiveSession('pid-abc123', 'codi-1', 1_000_000 + SESSION_MAX_AGE_MS)).toEqual(session)
    expect(SESSION_MAX_AGE_MS).toBe(16 * 60 * 1000)
  })

  it('ignores another device id, another room, or an expired session', () => {
    vi.stubGlobal('localStorage', new MemStorage())
    saveLiveSession(session)
    expect(loadLiveSession('pid-other1', 'CODI-1', 1_000_000)).toBeNull()
    expect(loadLiveSession('pid-abc123', 'CODI-2', 1_000_000)).toBeNull()
    expect(loadLiveSession('pid-abc123', 'CODI-1', 1_000_001 + SESSION_MAX_AGE_MS)).toBeNull()
  })

  it('rejects malformed data and is cleared', () => {
    const store = new MemStorage()
    vi.stubGlobal('localStorage', store)
    store.setItem('debug-master:live-session', '{nope')
    expect(loadLiveSession('pid-abc123', 'CODI-1', 1_000_000)).toBeNull()
    store.setItem('debug-master:live-session', JSON.stringify({ ...session, age: '9' }))
    expect(loadLiveSession('pid-abc123', 'CODI-1', 1_000_000)).toBeNull()
    saveLiveSession(session)
    clearLiveSession()
    expect(loadLiveSession('pid-abc123', 'CODI-1', 1_000_000)).toBeNull()
  })

  it('never throws when storage is blocked', () => {
    const boom = () => {
      throw new Error('blocked')
    }
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom })
    expect(() => saveLiveSession(session)).not.toThrow()
    expect(() => clearLiveSession()).not.toThrow()
    expect(loadLiveSession('pid-abc123', 'CODI-1', 1_000_000)).toBeNull()
  })
})
