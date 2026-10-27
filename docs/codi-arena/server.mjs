// Example booth server for "Login with Codi Arena", Node 20+ with openid-client v6.
// A one-file game shell: sign in, show the kid's nickname and Codi, finish a "game", send the stars, next kid.
//   npm install openid-client
//   CODI_ISSUER=https://<hub> CODI_CLIENT_ID=cva_... CODI_CLIENT_SECRET=cvs_... PORT=3000 node server.mjs
// Register http://localhost:3000/callback as a redirect URI (test mode allows http on localhost).
// The secret stays in the environment on this server; the browser only gets a session cookie.
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import * as client from 'openid-client'

const { CODI_ISSUER, CODI_CLIENT_ID, CODI_CLIENT_SECRET, PORT = '3000' } = process.env
if (!CODI_ISSUER || !CODI_CLIENT_ID || !CODI_CLIENT_SECRET) throw new Error('set CODI_ISSUER, CODI_CLIENT_ID and CODI_CLIENT_SECRET')
const BASE = `http://localhost:${PORT}`, REDIRECT = `${BASE}/callback`
const local = new URL(CODI_ISSUER).protocol === 'http:'  // only for a hub on your own machine
const config = await client.discovery(new URL(CODI_ISSUER), CODI_CLIENT_ID, CODI_CLIENT_SECRET, undefined, local ? { execute: [client.allowInsecureRequests] } : undefined)

/** One session per booth machine (a cookie): the sign-in in progress, then the kid who plays. */
const sessions = new Map()
const page = (body) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Booth</title>
<body style="font-family:sans-serif;max-width:520px;margin:40px auto;text-align:center">${body}</body>`
const esc = (s) => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

/** Stars from the game result, worked out here on the server (never trust a number from the page). */
const starsFor = (r) => r.finished ? (r.commands <= r.par ? (r.hints === 0 ? 3 : 2) : 1) : 0
async function sendStars(s, run) {
  const res = await fetch(new URL('/api/ext/play', CODI_ISSUER), {
    method: 'POST', headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ id: run.id, stars: run.stars, secret: run.secret }), signal: AbortSignal.timeout(5000),
  })
  if (res.status === 401) throw Object.assign(new Error('sign in again'), { relogin: true })
  if (!res.ok) throw new Error(`play ${res.status}`)
  return res.json()  // { ok, duplicate }: sending the same id again records nothing, so retries are safe
}

createServer(async (req, res) => {
  const url = new URL(req.url, BASE), sid = /sid=([\w-]+)/.exec(req.headers.cookie ?? '')?.[1] ?? randomUUID()
  const s = sessions.get(sid) ?? {}; sessions.set(sid, s)
  const send = (html, code = 200, headers = {}) => { res.writeHead(code, { 'content-type': 'text/html; charset=utf-8', 'set-cookie': `sid=${sid}; HttpOnly; SameSite=Lax; Path=/`, ...headers }); res.end(html) }
  try {
    if (url.pathname === '/login') {  // the "Login with Codi Arena" button
      s.verifier = client.randomPKCECodeVerifier(); s.state = client.randomState(); s.nonce = client.randomNonce()
      const to = client.buildAuthorizationUrl(config, { redirect_uri: REDIRECT, scope: 'openid profile arena.stars arena.play',
        code_challenge: await client.calculatePKCECodeChallenge(s.verifier), code_challenge_method: 'S256', state: s.state, nonce: s.nonce })
      return send('', 302, { location: to.href })
    }
    if (url.pathname === '/callback') {
      if (url.searchParams.get('error')) return send(page(`<p>เล่นได้โดยไม่เข้าสู่ระบบ แต่จะไม่ได้ดาว</p><a href="/">กลับ</a>`))
      const t = await client.authorizationCodeGrant(config, url, { pkceCodeVerifier: s.verifier, expectedState: s.state, expectedNonce: s.nonce })
      const kid = await client.fetchUserInfo(config, t.access_token, t.claims().sub)
      Object.assign(s, { token: t.access_token, kid, verifier: null, state: null, nonce: null })
      return send('', 302, { location: '/' })
    }
    if (url.pathname === '/finish') {  // the game ends: a made-up result for the example
      const run = { id: `run-${randomUUID()}`, ...{ finished: true, commands: 8, par: 10, hints: 1 } }
      run.stars = starsFor(run); run.secret = false
      if (!s.token) return send(page(`<h1>ได้ ${run.stars} ดาว</h1><p>เล่นแบบไม่เข้าสู่ระบบ ดาวไม่เข้า Codi Arena</p><a href="/next">คนต่อไป</a>`))
      const r = await sendStars(s, run).catch(e => ({ error: e.message }))
      return send(page(`<h1>ได้ ${run.stars} ดาว</h1><p>${r.error ? `ยังส่งดาวไม่ได้ (${esc(r.error)})` : r.duplicate ? 'ส่งไปแล้ว' : 'ดาวเข้า Codi Arena แล้ว'}</p><a href="/next">คนต่อไป</a>`))
    }
    if (url.pathname === '/next') { sessions.delete(sid); return send('', 302, { location: '/', 'set-cookie': 'sid=; Max-Age=0; Path=/' }) }
    if (s.kid) return send(page(`<img src="${esc(s.kid.picture)}?size=256" width="160" alt=""><h1>สวัสดี ${esc(s.kid.nickname)}</h1>
      <p>ดาวรวม ${esc(s.kid.arena_stars ?? 0)} ดวง</p><a href="/finish">เล่นจบ (ตัวอย่าง)</a> · <a href="/next">คนต่อไป</a>`))
    return send(page(`<h1>Booth game</h1><p><a href="/login">เข้าสู่ระบบด้วย Codi Arena</a></p><p><a href="/finish">เล่นเลยโดยไม่เข้าสู่ระบบ</a></p>`))
  } catch (e) {
    console.error(e.message)  // never log tokens or the secret
    return send(page(`<p>เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง</p><a href="/">กลับ</a>`), 500)
  }
}).listen(Number(PORT), () => console.log(`booth example on ${BASE}`))
