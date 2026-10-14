// Worker entry for the Live Race Room.
//   GET /health                                          -> 200 ok
//   GET /rooms/:code/ws?role=player|host|screen[&key=…]  -> WebSocket, served by the LiveRoom Durable Object
import { HOST_KEY_RE, normalizeRoomCode } from '../../app/utils/live/protocol'

export { LiveRoom } from './live-room'

const ROOM_PATH = /^\/rooms\/([^/]+)\/ws$/
const ROLES = new Set(['player', 'host', 'screen'])

function text(body: string, status: number): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })
}

function allowedOrigins(env: Env): Set<string> {
  return new Set(
    String(env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  )
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/health') return text('ok', 200)

    const match = url.pathname.match(ROOM_PATH)
    if (!match) return text('not found', 404)
    if (request.method !== 'GET') return text('method not allowed', 405)
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return text('expected websocket upgrade', 426)
    }
    // Browsers always send Origin on a WebSocket handshake; tools such as the smoke script do not.
    const origin = request.headers.get('Origin')
    if (origin !== null && !allowedOrigins(env).has(origin)) return text('origin not allowed', 403)

    let code: string | null = null
    try {
      code = normalizeRoomCode(decodeURIComponent(match[1]))
    } catch {
      /* malformed escape */
    }
    if (!code) return text('room must match [A-Z0-9-]{3,16}', 400)
    const role = url.searchParams.get('role') ?? 'player'
    if (!ROLES.has(role)) return text('role must be player, host or screen', 400)

    // Rebuild the URL so the DO sees the canonical code, and only a well-formed key, only for hosts.
    const target = new URL(`/rooms/${code}/ws`, url)
    target.searchParams.set('role', role)
    const key = url.searchParams.get('key')
    if (role === 'host' && key && HOST_KEY_RE.test(key)) target.searchParams.set('key', key)

    const stub = env.LIVE_ROOM.get(env.LIVE_ROOM.idFromName(code))
    return stub.fetch(new Request(target, request))
  },
} satisfies ExportedHandler<Env>
