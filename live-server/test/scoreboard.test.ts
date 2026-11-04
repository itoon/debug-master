import { describe, expect, it } from 'vitest'
import { handleScoreboard, signTicket, verifyTicket } from '../src/scoreboard'

const LOCAL = 'http://localhost:3002'
const PAGES = 'https://itoon.github.io'
const KEY = 'ticket-secret'
const env = {
  ALLOWED_ORIGINS: `${LOCAL},${PAGES}`, SCOREBOARD_BASE_URL: 'http://hub.test', SCORE_TICKET_SECRET: KEY,
  SCOREBOARD_BOOTH_ID: 'debug-master', SCOREBOARD_API_KEY: 'bk_booth',
}

describe('score tickets', () => {
  it('round-trips the hub user and rejects tampering, other keys and expiry', async () => {
    const user = { sub: 'kid', nickname: 'มะลิ', picture: 'https://example.test/codi.png', arena_no: 14 }
    const ticket = await signTicket(user, KEY, 1_000)
    expect(await verifyTicket(ticket, KEY, 2_000)).toEqual(user)
    expect(await verifyTicket(ticket, 'other-secret', 2_000)).toBeNull()
    expect(await verifyTicket(`${ticket.split('.')[0]}x.${ticket.split('.')[1]}`, KEY, 2_000)).toBeNull()
    expect(await verifyTicket(ticket, KEY, 1_000 + 13 * 60 * 60 * 1000)).toBeNull()
  })
})

describe('POST /scoreboard/scores', () => {
  it('sends a ticket player as hubUser with the API key, on the Beginner Board for challenge A', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const ticket = await signTicket({ sub: 'kid', nickname: 'มะลิ' }, KEY)
    const res = await post({ challengeId: 'A', score: 120, submissionId: 'round-1', ticket }, hub(calls, 201, { scoreId: 's1', entry: { value: 120, playCount: 1, improved: true } }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, duplicate: false, entry: { value: 120, playCount: 1, improved: true } })
    expect(calls[0]!.url).toBe('http://hub.test/api/booths/debug-master/scores')
    expect(new Headers(calls[0]!.init.headers).get('authorization')).toBe('Bearer bk_booth')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ score: 120, board: 'beginner', submissionId: 'round-1', hubUser: { sub: 'kid', nickname: 'มะลิ' } })
  })

  it('sends a typed-name player as a guest to the Board of the challenge played, on the same booth', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const ok = hub(calls, 201, { scoreId: 's2', entry: { value: 0, playCount: 1, improved: false } })
    await post({ challengeId: 'C', score: 0, submissionId: 'round-2', guest: { name: ' เอ ', guestId: 'p-1' } }, ok)
    await post({ challengeId: 'B', score: 5, submissionId: 'round-3', guest: { name: 'บี' } }, ok)
    expect(calls.map((call) => call.url)).toEqual(['http://hub.test/api/booths/debug-master/scores', 'http://hub.test/api/booths/debug-master/scores'])
    expect(new Headers(calls[0]!.init.headers).get('authorization')).toBe('Bearer bk_booth')
    expect(calls.map((call) => JSON.parse(String(call.init.body)).board)).toEqual(['pro', 'intermediate'])
    expect(JSON.parse(String(calls[0]!.init.body)).guest).toEqual({ name: 'เอ', guestId: 'p-1' })
  })

  it("forwards a walk-in's own avatar and drops any other image", async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const ok = hub(calls, 201, { scoreId: 's', entry: { value: 1, playCount: 1, improved: true } })
    const avatar = `${PAGES}/debug-master/student-avatar/art-toy/14-bee.svg`
    await post({ challengeId: 'A', score: 1, submissionId: 'p-1', guest: { name: 'a' }, photoUrl: avatar }, ok, PAGES)
    await post({ challengeId: 'A', score: 1, submissionId: 'p-2', guest: { name: 'a' }, photoUrl: 'https://evil.test/student-avatar/x.svg' }, ok, PAGES)
    await post({ challengeId: 'A', score: 1, submissionId: 'p-3', guest: { name: 'a' }, photoUrl: `${PAGES}/debug-master/other.png` }, ok, PAGES)
    const sentPhotos = calls.map((call) => JSON.parse(String(call.init.body)).photoUrl)
    expect(sentPhotos).toEqual([avatar, undefined, undefined])
  })

  it('passes hub errors through with retryable', async () => {
    const res = await post({ challengeId: 'A', score: 1, submissionId: 'round-3', guest: { name: 'a' } }, hub([], 500, { error: { code: 'INTERNAL', message: 'x' } }))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ ok: false, code: 'INTERNAL', retryable: true })
  })

  it('rejects forged tickets, bad bodies, other origins, and is off without the booth key', async () => {
    const never = hub([], 201, {})
    const guest = { challengeId: 'A', score: 1, submissionId: 'r', guest: { name: 'a' } }
    expect((await post({ challengeId: 'A', score: 1, submissionId: 'r', ticket: 'a.b' }, never)).status).toBe(401)
    expect((await post({ ...guest, score: '1' }, never)).status).toBe(400)
    expect((await post({ ...guest, challengeId: 'live' }, never)).status).toBe(400)
    expect((await post({ challengeId: 'A', score: 1, submissionId: 'r' }, never)).status).toBe(400)
    expect((await post(guest, never, 'https://evil.test')).status).toBe(403)
    const noKey = await handleScoreboard(request(guest, LOCAL), { ...env, SCOREBOARD_API_KEY: '' }, never)
    expect(noKey!.status).toBe(503)
    const noSecret = await handleScoreboard(request(guest, LOCAL), { ...env, SCORE_TICKET_SECRET: '' }, never)
    expect(noSecret!.status).toBe(503)
  })

  it('ignores other paths', async () => {
    expect(await handleScoreboard(new Request('https://worker.test/health'), env)).toBeNull()
  })
})

function request(body: unknown, origin: string): Request {
  return new Request('https://worker.test/scoreboard/scores', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

async function post(body: unknown, fetchImpl: typeof fetch, origin = LOCAL): Promise<Response> {
  return (await handleScoreboard(request(body, origin), env, fetchImpl))!
}

function hub(calls: { url: string; init: RequestInit }[], status: number, body: unknown): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
}
