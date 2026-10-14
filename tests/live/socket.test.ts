import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hostKeyFor, livePlayerId, newHostKey, resetLivePlayerId, saveHostKey } from '../../app/utils/live/identity'
import { liveWsUrl, openLiveSocket } from '../../app/utils/live/socket'
import { CLOSE_FULL, CLOSE_KICKED, HOST_KEY_RE } from '../../app/utils/live/protocol'

describe('liveWsUrl', () => {
  it('builds secure and local socket URLs', () => {
    expect(liveWsUrl('https://live.example.workers.dev/', 'codi-1', 'player')).toBe('wss://live.example.workers.dev/rooms/CODI-1/ws?role=player')
    expect(liveWsUrl('http://127.0.0.1:8787', 'CODI-1', 'screen')).toBe('ws://127.0.0.1:8787/rooms/CODI-1/ws?role=screen')
    expect(liveWsUrl('https://x.dev', 'CODI-1', 'host', 'k_k-'.repeat(5))).toBe(`wss://x.dev/rooms/CODI-1/ws?role=host&key=${'k_k-'.repeat(5)}`)
    expect(liveWsUrl('https://x.dev', 'CODI-1', 'player', 'secret-secret-secret')).not.toContain('key=')
  })
})

class FakeWS {
  static instances: FakeWS[] = []
  static OPEN = 1
  static CLOSED = 3
  readyState = 0
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: unknown }) => void) | null = null
  onclose: ((e: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  closedWith: number | null = null
  constructor(public url: string) {
    FakeWS.instances.push(this)
  }
  send(d: string) {
    this.sent.push(d)
  }
  close(code?: number) {
    this.closedWith = code ?? 1000
    this.readyState = 3
  }
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  recv(data: unknown) {
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) })
  }
  drop(code = 1006) {
    this.readyState = 3
    this.onclose?.({ code })
  }
}

describe('openLiveSocket', () => {
  const last = () => FakeWS.instances[FakeWS.instances.length - 1]!
  const hello = () => ({ type: 'hello' as const })
  let onMessage: ReturnType<typeof vi.fn>
  let onConnection: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    FakeWS.instances = []
    vi.stubGlobal('WebSocket', FakeWS)
    onMessage = vi.fn()
    onConnection = vi.fn()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends hello on connect, reports up, and forwards server messages with receivedAt', () => {
    vi.setSystemTime(1000)
    openLiveSocket('ws://x', hello, { onMessage, onConnection })
    last().open()
    expect(onConnection).toHaveBeenLastCalledWith(true)
    expect(last().sent).toEqual([JSON.stringify({ type: 'hello' })])
    last().recv({ type: 'full' })
    expect(onMessage).toHaveBeenCalledWith({ type: 'full' }, 1000)
    last().recv('pong')
    last().recv('not json')
    expect(onMessage).toHaveBeenCalledTimes(1)
  })

  it('pings every 20 seconds while open', () => {
    openLiveSocket('ws://x', hello, { onMessage, onConnection })
    last().open()
    vi.advanceTimersByTime(20_000)
    expect(last().sent).toContain('ping')
    last().recv('pong')
    vi.advanceTimersByTime(20_000)
    expect(last().sent.filter((s) => s === 'ping')).toHaveLength(2)
  })

  it('reconnects with 0.5s doubling to 8s backoff (±20%) and resends hello', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // jitter factor exactly 1
    openLiveSocket('ws://x', hello, { onMessage, onConnection })
    const delays = [500, 1000, 2000, 4000, 8000, 8000]
    for (const d of delays) {
      const n = FakeWS.instances.length
      last().drop()
      expect(onConnection).toHaveBeenLastCalledWith(false)
      vi.advanceTimersByTime(d - 1)
      expect(FakeWS.instances).toHaveLength(n)
      vi.advanceTimersByTime(1)
      expect(FakeWS.instances).toHaveLength(n + 1)
    }
    last().open()
    expect(last().sent[0]).toBe(JSON.stringify({ type: 'hello' }))
    // a connection that delivers a message resets the backoff
    last().recv('pong')
    last().drop()
    vi.advanceTimersByTime(500)
    expect(FakeWS.instances.length).toBeGreaterThan(delays.length + 1)
  })

  it('applies ±20% jitter and never exceeds the 8s cap', () => {
    const rnd = vi.spyOn(Math, 'random')
    rnd.mockReturnValue(0)
    openLiveSocket('ws://x', hello, { onMessage, onConnection })
    last().drop()
    vi.advanceTimersByTime(399)
    expect(FakeWS.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(FakeWS.instances).toHaveLength(2)
    rnd.mockReturnValue(0.999)
    for (let i = 0; i < 6; i++) last().drop(), vi.advanceTimersByTime(8000)
    const n = FakeWS.instances.length
    last().drop()
    vi.advanceTimersByTime(8000)
    expect(FakeWS.instances).toHaveLength(n + 1)
  })

  it('does not reset the backoff for a socket that opens but never answers', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    openLiveSocket('ws://x', hello, { onMessage, onConnection })
    last().drop()
    vi.advanceTimersByTime(500)
    last().open() // accepted, but silent
    last().drop()
    vi.advanceTimersByTime(999)
    expect(FakeWS.instances).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeWS.instances).toHaveLength(3)
  })

  it('abandons a socket that does not answer a ping within 10 s and reconnects at once', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    openLiveSocket('ws://x', hello, { onMessage, onConnection })
    const first = last()
    first.open()
    first.recv('pong')
    vi.advanceTimersByTime(20_000)
    expect(first.sent.at(-1)).toBe('ping')
    vi.advanceTimersByTime(9_999)
    expect(FakeWS.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(first.closedWith).toBe(4000)
    expect(onConnection).toHaveBeenLastCalledWith(false)
    expect(FakeWS.instances).toHaveLength(2) // no backoff wait
    // a late close event from the abandoned socket changes nothing
    first.drop()
    expect(FakeWS.instances).toHaveLength(2)
    // the new socket resends hello
    last().open()
    expect(last().sent[0]).toBe(JSON.stringify({ type: 'hello' }))
    expect(onConnection).toHaveBeenLastCalledWith(true)
  })

  it('counts an abandoned socket as a drop: a following failure backs off', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    openLiveSocket('ws://x', hello, { onMessage, onConnection })
    last().open()
    last().recv('pong')
    vi.advanceTimersByTime(30_000) // ping, then no pong -> abandoned, new socket opened
    expect(FakeWS.instances).toHaveLength(2)
    last().drop() // network still down
    vi.advanceTimersByTime(999)
    expect(FakeWS.instances).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeWS.instances).toHaveLength(3)
  })

  it('keeps the socket when pong (or any message) arrives in time', () => {
    openLiveSocket('ws://x', hello, { onMessage, onConnection })
    last().open()
    vi.advanceTimersByTime(20_000) // ping at 20 s
    vi.advanceTimersByTime(9_999)
    last().recv('pong')
    vi.advanceTimersByTime(10_001) // ping at 40 s
    vi.advanceTimersByTime(5_000)
    last().recv({ type: 'state' }) // any message counts
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(20_000)
      last().recv('pong')
    }
    vi.advanceTimersByTime(9_000)
    expect(FakeWS.instances).toHaveLength(1)
    expect(last().closedWith).toBeNull()
  })

  it('close() also stops the pong watchdog', () => {
    const s = openLiveSocket('ws://x', hello, { onMessage, onConnection })
    last().open()
    vi.advanceTimersByTime(20_000)
    s.close()
    vi.advanceTimersByTime(60_000)
    expect(FakeWS.instances).toHaveLength(1)
  })

  it.each([CLOSE_KICKED, CLOSE_FULL])('stops retrying after close code %i', (code) => {
    openLiveSocket('ws://x', hello, { onMessage, onConnection })
    last().open()
    last().drop(code)
    vi.advanceTimersByTime(60_000)
    expect(FakeWS.instances).toHaveLength(1)
    expect(onConnection).toHaveBeenLastCalledWith(false)
  })

  it('queues unsent messages (latest per coalesce key) and flushes them after hello', () => {
    const s = openLiveSocket('ws://x', hello, { onMessage, onConnection })
    const p = (score: number) => ({ type: 'progress' as const, roundId: 1, score, levelsCompleted: 0, bestCombo: 0, combo: 0 })
    s.send(p(1), 'progress')
    s.send(p(2), 'progress')
    s.send({ type: 'leave' })
    last().open()
    expect(last().sent).toEqual([JSON.stringify({ type: 'hello' }), JSON.stringify(p(2)), JSON.stringify({ type: 'leave' })])
    s.send(p(3), 'progress')
    expect(last().sent.at(-1)).toBe(JSON.stringify(p(3)))
  })

  it('skips hello while the hello factory returns null', () => {
    let greeting: { type: 'hello' } | null = null
    const s = openLiveSocket('ws://x', () => greeting, { onMessage, onConnection })
    last().open()
    expect(last().sent).toEqual([])
    greeting = { type: 'hello' }
    s.send(greeting)
    expect(last().sent).toEqual([JSON.stringify({ type: 'hello' })])
  })

  it('close() stops reconnecting and ignores later sends', () => {
    const s = openLiveSocket('ws://x', hello, { onMessage, onConnection })
    last().open()
    const sock = last()
    s.close()
    expect(sock.closedWith).toBe(1000)
    sock.drop()
    vi.advanceTimersByTime(60_000)
    expect(FakeWS.instances).toHaveLength(1)
    s.send({ type: 'leave' })
    expect(sock.sent).toEqual([JSON.stringify({ type: 'hello' })])
  })
})

class MemStorage {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
}

describe('identity', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('persists the player id and can reset it', () => {
    const store = new MemStorage()
    vi.stubGlobal('localStorage', store)
    const a = livePlayerId()
    expect(a).toMatch(/^[A-Za-z0-9_-]{6,64}$/)
    expect(livePlayerId()).toBe(a)
    expect(store.getItem('debug-master:live-pid')).toBe(a)
    const b = resetLivePlayerId()
    expect(b).not.toBe(a)
    expect(livePlayerId()).toBe(b)
  })

  it('falls back to a stable per-page-load id when storage throws', () => {
    const boom = () => {
      throw new Error('blocked')
    }
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom })
    const a = livePlayerId()
    expect(a).toMatch(/^[A-Za-z0-9_-]{6,64}$/)
    expect(livePlayerId()).toBe(a)
    expect(hostKeyFor('codi-1')).toBeNull()
    expect(() => saveHostKey('codi-1', 'x'.repeat(20))).not.toThrow()
  })

  it('stores host keys per normalized room code and rejects malformed saved keys', () => {
    const store = new MemStorage()
    vi.stubGlobal('localStorage', store)
    expect(hostKeyFor('codi-1')).toBeNull()
    const key = newHostKey()
    expect(key).toMatch(HOST_KEY_RE)
    expect(key).toHaveLength(24)
    saveHostKey('codi-1', key)
    expect(store.getItem('debug-master:host:CODI-1')).toBe(key)
    expect(hostKeyFor('CODI-1')).toBe(key)
    store.setItem('debug-master:host:BAD', 'short')
    expect(hostKeyFor('BAD')).toBeNull()
  })
})
