// Relays a finished challenge run to the Codi Arena Scoreboard (COD-1144). The game is a static site, so the
// booth's API key lives here, as a Worker secret. Scores are still worked out in the browser — an accepted risk,
// see docs/adr/0001-browser-scored-runs-via-worker-relay.md. Only the game's origins may call it, and only the
// fields a submit needs are forwarded; the Scoreboard's answer (status and error code) is passed back unchanged.

export interface ScoreboardEnv {
  ALLOWED_ORIGINS?: string
  /** e.g. https://scoreboard.example.app */
  SCOREBOARD_BASE_URL?: string
  SCOREBOARD_BOOTH_ID?: string
  /** bk_… — set with `wrangler secret put SCOREBOARD_API_KEY`, never in wrangler.jsonc. */
  SCOREBOARD_API_KEY?: string
}

/** Challenge A, B, C = the booth's Tier Boards. */
export const SCOREBOARD_BOARDS = ['beginner', 'intermediate', 'pro'] as const
const SUBMISSION_ID = /^[\w-]{1,100}$/
const GUEST_ID = /^[\w-]{1,64}$/

type HubUser = { sub: string, nickname?: string, name?: string, picture?: string, arena_picture_full?: string, arena_no?: number, arena_test?: boolean }
export type RelayBody = { score: number, board: string, submissionId: string } & ({ hubUser: HubUser } | { guest: { name: string, guestId: string } })

export async function handleScoreboard(request: Request, env: ScoreboardEnv, fetchImpl: typeof fetch = fetch): Promise<Response | null> {
  if (new URL(request.url).pathname !== '/scores') return null

  const origin = request.headers.get('Origin')
  if (!origin || !allowedOrigins(env).has(origin)) return error('FORBIDDEN_ORIGIN', 'Origin not allowed', 403, null)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) })
  if (request.method !== 'POST') return error('INVALID_BODY', 'POST only', 405, origin)

  const base = env.SCOREBOARD_BASE_URL?.trim().replace(/\/+$/, '')
  const booth = env.SCOREBOARD_BOOTH_ID?.trim()
  const key = env.SCOREBOARD_API_KEY?.trim()
  if (!base || !booth || !key) return error('INTERNAL', 'Scoreboard relay is not configured', 503, origin)

  const text = await request.text()
  const body = text.length <= 4096 ? relayBody(parse(text)) : null
  if (!body) return error('INVALID_BODY', 'Expected { score, board, submissionId } and exactly one of hubUser / guest', 400, origin)

  let upstream: Response
  try {
    upstream = await fetchImpl(`${base}/api/booths/${encodeURIComponent(booth)}/scores`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
  }
  catch {
    return error('NETWORK', 'Scoreboard unreachable', 502, origin)
  }
  const headers = cors(origin)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')
  return new Response(await upstream.text(), { status: upstream.status, headers })
}

/** The submit body with only the fields the Scoreboard reads, or null when it isn't one. */
export function relayBody(value: unknown): RelayBody | null {
  if (!isObject(value)) return null
  const { score, board, submissionId, hubUser, guest } = value
  if (typeof score !== 'number' || !Number.isFinite(score)) return null
  if (typeof board !== 'string' || !(SCOREBOARD_BOARDS as readonly string[]).includes(board)) return null
  if (typeof submissionId !== 'string' || !SUBMISSION_ID.test(submissionId)) return null
  if ((hubUser === undefined) === (guest === undefined)) return null
  const base = { score, board, submissionId }
  if (hubUser !== undefined) {
    if (!isObject(hubUser) || typeof hubUser.sub !== 'string' || !hubUser.sub || hubUser.sub.length > 200) return null
    const user: HubUser = { sub: hubUser.sub }
    for (const field of ['nickname', 'name', 'picture', 'arena_picture_full'] as const) {
      const v = hubUser[field]
      if (typeof v === 'string' && v.length <= 500) user[field] = v
    }
    if (Number.isInteger(hubUser.arena_no)) user.arena_no = hubUser.arena_no as number
    if (typeof hubUser.arena_test === 'boolean') user.arena_test = hubUser.arena_test
    return { ...base, hubUser: user }
  }
  if (!isObject(guest) || typeof guest.name !== 'string' || typeof guest.guestId !== 'string' || !GUEST_ID.test(guest.guestId)) return null
  const name = guest.name.trim()
  if (!name || [...name].length > 40) return null
  return { ...base, guest: { name, guestId: guest.guestId } }
}

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

function parse(text: string): unknown {
  try { return JSON.parse(text) }
  catch { return null }
}

function allowedOrigins(env: ScoreboardEnv): Set<string> {
  return new Set(String(env.ALLOWED_ORIGINS ?? '').split(',').map(o => o.trim()).filter(Boolean))
}

function cors(origin: string): Headers {
  return new Headers({
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'Origin',
  })
}

/** Same error shape as the Scoreboard, so the game branches on `code` either way. */
function error(code: string, message: string, status: number, origin: string | null): Response {
  const headers = origin ? cors(origin) : new Headers()
  headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify({ error: { code, message } }), { status, headers })
}
