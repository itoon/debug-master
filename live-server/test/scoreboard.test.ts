import { describe, expect, it } from 'vitest'
import { handleScoreboard } from '../src/scoreboard'

// COD-1144: the game is static, so its challenge runs reach the Codi Arena Scoreboard through this relay,
// which adds the booth's API key (a Worker secret). See docs/adr/0001-browser-scored-runs-via-worker-relay.md.
const PAGES = 'https://itoon.github.io'
const env = {
  ALLOWED_ORIGINS: `${PAGES},http://localhost:3002`,
  SCOREBOARD_BASE_URL: 'https://scoreboard.example.app/',
  SCOREBOARD_BOOTH_ID: 'debug-master',
  SCOREBOARD_API_KEY: 'bk_test_key_value',
}
const hubUser = { sub: 'abc', nickname: 'Ploy', picture: 'https://hub/p.png', arena_no: 14, arena_test: false }
const body = { score: 1250, board: 'beginner', submissionId: 'session-1', hubUser }

function post(payload: unknown, origin: string | null = PAGES, method = 'POST') {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (origin) headers.set('Origin', origin)
  return new Request('https://live.example/scores', { method, headers, body: method === 'POST' ? JSON.stringify(payload) : undefined })
}
function fakeFetch(reply: Response | Error = new Response(JSON.stringify({ scoreId: 's', entry: { value: 1250, playCount: 1, improved: true } }), { status: 201 })) {
  const calls: { url: string, init: RequestInit }[] = []
  const fn = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! })
    if (reply instanceof Error) throw reply
    return reply
  }) as typeof fetch
  return { fn, calls }
}

describe('handleScoreboard', () => {
  it('ignores other paths', async () => {
    expect(await handleScoreboard(new Request('https://live.example/health'), env)).toBeNull()
  })

  it('forwards a run to the booth with the API key and passes the answer back', async () => {
    const f = fakeFetch()
    const res = (await handleScoreboard(post(body), env, f.fn))!
    expect(res.status).toBe(201)
    expect(res.headers.get('access-control-allow-origin')).toBe(PAGES)
    expect(await res.json()).toMatchObject({ entry: { improved: true } })
    expect(f.calls[0]!.url).toBe('https://scoreboard.example.app/api/booths/debug-master/scores')
    expect(new Headers(f.calls[0]!.init.headers).get('authorization')).toBe('Bearer bk_test_key_value')
    expect(JSON.parse(String(f.calls[0]!.init.body))).toEqual(body)
  })

  it('forwards a Guest run', async () => {
    const f = fakeFetch()
    const guest = { score: 80, board: 'pro', submissionId: 'session-2', guest: { name: 'Mew', guestId: 'player-7' } }
    expect((await handleScoreboard(post(guest), env, f.fn))!.status).toBe(201)
    expect(JSON.parse(String(f.calls[0]!.init.body))).toEqual(guest)
  })

  it('refuses origins that are not the game\'s, and answers the preflight for allowed ones', async () => {
    const f = fakeFetch()
    expect((await handleScoreboard(post(body, 'https://evil.example'), env, f.fn))!.status).toBe(403)
    expect((await handleScoreboard(post(body, null), env, f.fn))!.status).toBe(403)
    const pre = (await handleScoreboard(post(body, PAGES, 'OPTIONS'), env, f.fn))!
    expect(pre.status).toBe(204)
    expect(pre.headers.get('access-control-allow-methods')).toContain('POST')
    expect(f.calls).toHaveLength(0)
  })

  it('forwards only the fields a submit needs', async () => {
    const f = fakeFetch()
    await handleScoreboard(post({ ...body, hubUser: { ...hubUser, email: 'x@y', extra: 1 }, photoUrl: 'https://x', admin: true }), env, f.fn)
    expect(JSON.parse(String(f.calls[0]!.init.body))).toEqual(body)
  })

  it.each([
    ['a string score', { ...body, score: '1250' }],
    ['an unknown board', { ...body, board: 'expert' }],
    ['no submissionId', { ...body, submissionId: undefined }],
    ['both hubUser and guest', { ...body, guest: { name: 'x', guestId: 'p' } }],
    ['neither hubUser nor guest', { score: 1, board: 'pro', submissionId: 's' }],
    ['a hubUser without sub', { ...body, hubUser: { nickname: 'x' } }],
    ['a bad guestId', { score: 1, board: 'pro', submissionId: 's', guest: { name: 'x', guestId: 'a/b' } }],
  ])('rejects %s without calling the Scoreboard', async (_name, payload) => {
    const f = fakeFetch()
    const res = (await handleScoreboard(post(payload), env, f.fn))!
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: { code: 'INVALID_BODY', message: expect.any(String) } })
    expect(f.calls).toHaveLength(0)
  })

  it('passes the Scoreboard\'s error code back unchanged', async () => {
    const f = fakeFetch(new Response(JSON.stringify({ error: { code: 'BOOTH_CLOSED', message: 'closed' } }), { status: 409 }))
    const res = (await handleScoreboard(post(body), env, f.fn))!
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: { code: 'BOOTH_CLOSED', message: 'closed' } })
  })

  it('answers a retryable NETWORK error when the Scoreboard can\'t be reached', async () => {
    const res = (await handleScoreboard(post(body), env, fakeFetch(new TypeError('fetch failed')).fn))!
    expect(res.status).toBe(502)
    expect((await res.json() as { error: { code: string } }).error.code).toBe('NETWORK')
  })

  it('is unavailable until the Scoreboard is configured, and never echoes the key', async () => {
    const f = fakeFetch()
    const res = (await handleScoreboard(post(body), { ...env, SCOREBOARD_API_KEY: '' }, f.fn))!
    expect(res.status).toBe(503)
    expect(await res.text()).not.toContain('bk_')
    expect(f.calls).toHaveLength(0)
  })
})
