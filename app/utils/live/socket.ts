// Reconnecting WebSocket for the Live Race Room. Framework-free: no Vue imports.
// Behaviour adapted from codeventure-signal-lost-main/src/live.ts `connect()`:
// exponential backoff, hello resent on every (re)connect, 'ping' heartbeat every
// 20s (answered by the Durable Object auto-response), unsent messages queued.
// Pong watchdog: if nothing (not even 'pong') arrives within PONG_TIMEOUT_MS of a ping, the
// socket is treated as half-open: it is abandoned and a new one opened at once. The backoff
// resets only once a socket actually delivers a message, so a dead network still backs off.
import { CLOSE_FULL, CLOSE_KICKED, normalizeRoomCode } from './protocol'
import type { ClientMessage, Role, ServerMessage } from './protocol'

const PING_MS = 20_000
const PONG_TIMEOUT_MS = 10_000
const BACKOFF_MIN_MS = 500
const BACKOFF_MAX_MS = 8_000
const WS_OPEN = 1
// Close codes after which reconnecting is pointless (kicked / room full).
const NO_RETRY = new Set<number>([CLOSE_KICKED, CLOSE_FULL])

/** `https://x` -> `wss://x/rooms/CODE/ws?role=…[&key=…]`; `http` -> `ws`. The key is only sent for `host`. */
export function liveWsUrl(base: string, code: string, role: Role, key?: string): string {
  const root = base.trim().replace(/\/+$/, '').replace(/^http(s?):/i, (_m, s: string) => `ws${s}:`)
  const room = normalizeRoomCode(code) ?? code.trim().toUpperCase()
  let url = `${root}/rooms/${encodeURIComponent(room)}/ws?role=${role}`
  if (role === 'host' && key) url += `&key=${encodeURIComponent(key)}`
  return url
}

export interface LiveSocketHandlers {
  onMessage(m: ServerMessage, receivedAt: number): void
  onConnection(up: boolean): void
}

export interface LiveSocket {
  /** Sends now when open, otherwise queues it; a queued message with the same `coalesceKey` replaces the older one. */
  send(msg: ClientMessage, coalesceKey?: string): void
  close(): void
}

/** `hello` runs on every (re)connect; returning null skips it (the socket then only listens until the caller sends one). */
export function openLiveSocket(url: string, hello: () => ClientMessage | null, handlers: LiveSocketHandlers): LiveSocket {
  let ws: WebSocket | null = null
  let closed = false
  let attempt = 0
  let ping: ReturnType<typeof setInterval> | null = null
  let watchdog: ReturnType<typeof setTimeout> | null = null
  let retry: ReturnType<typeof setTimeout> | null = null
  const queue = new Map<string, string>()
  let seq = 0

  const stopWatchdog = () => {
    if (watchdog) clearTimeout(watchdog)
    watchdog = null
  }

  const stopPing = () => {
    if (ping) clearInterval(ping)
    ping = null
    stopWatchdog()
  }

  /** No reply to a ping: give up on this socket without waiting for a close that may never come. */
  const abandon = (sock: WebSocket) => {
    if (ws !== sock || closed) return
    stopPing()
    sock.onopen = sock.onmessage = sock.onclose = sock.onerror = null
    ws = null
    try {
      sock.close(4000, 'no pong')
    } catch {
      /* ignore */
    }
    handlers.onConnection(false)
    attempt++ // a drop like any other: the next failure backs off from here
    open()
  }

  const schedule = () => {
    if (closed || retry) return
    const jittered = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** attempt) * (0.8 + Math.random() * 0.4)
    attempt++
    retry = setTimeout(() => {
      retry = null
      open()
    }, Math.min(BACKOFF_MAX_MS, jittered))
  }

  const open = () => {
    if (closed) return
    let sock: WebSocket
    try {
      sock = new WebSocket(url)
    } catch {
      schedule()
      return
    }
    ws = sock
    sock.onopen = () => {
      const greeting = hello()
      if (greeting) sock.send(JSON.stringify(greeting))
      for (const data of queue.values()) sock.send(data)
      queue.clear()
      stopPing()
      ping = setInterval(() => {
        if (sock.readyState !== WS_OPEN) return
        sock.send('ping')
        watchdog ??= setTimeout(() => {
          watchdog = null
          abandon(sock)
        }, PONG_TIMEOUT_MS)
      }, PING_MS)
      handlers.onConnection(true)
    }
    sock.onmessage = (e) => {
      // Anything from the server proves the socket works: clear the watchdog and the backoff.
      stopWatchdog()
      attempt = 0
      if (typeof e.data !== 'string' || e.data === 'pong') return
      let msg: unknown
      try {
        msg = JSON.parse(e.data)
      } catch {
        return
      }
      if (!msg || typeof msg !== 'object' || typeof (msg as { type?: unknown }).type !== 'string') return
      try {
        handlers.onMessage(msg as ServerMessage, Date.now())
      } catch (err) {
        console.error('live message handler error', err)
      }
    }
    sock.onclose = (e) => {
      stopPing()
      if (ws === sock) ws = null
      handlers.onConnection(false)
      if (closed || NO_RETRY.has(e.code)) {
        closed = true
        return
      }
      schedule()
    }
    sock.onerror = () => {
      /* onclose follows */
    }
  }

  open()

  return {
    send(msg, coalesceKey) {
      if (closed) return
      const data = JSON.stringify(msg)
      if (ws && ws.readyState === WS_OPEN) ws.send(data)
      else queue.set(coalesceKey ?? `m${seq++}`, data)
    },
    close() {
      closed = true
      if (retry) clearTimeout(retry)
      stopPing()
      retry = null
      queue.clear()
      const sock = ws
      ws = null
      try {
        sock?.close(1000, 'bye')
      } catch {
        /* ignore */
      }
    },
  }
}
