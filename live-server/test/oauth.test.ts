import { beforeAll, describe, expect, it } from 'vitest'
import { handleOauth } from '../src/oauth'

const ISSUER = 'https://codi-arena-hub.innovasive.workers.dev'
const CLIENT = 'cva_zlfJ437Zr3GMa4ps'
const SECRET = 'cvs_test_secret_value'
const NONCE = 'nonce-value-1234567890'
const LOCAL = 'http://localhost:3002'
const LOCAL_REDIRECT = 'http://localhost:3002/callback'
const PAGES = 'https://itoon.github.io'
const PAGES_REDIRECT = 'https://itoon.github.io/debug-master/callback'

let privateKey: CryptoKey
let jwk: Record<string, unknown>

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  ) as CryptoKeyPair
  privateKey = pair.privateKey
  jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }
})

const env = {
  ALLOWED_ORIGINS: `${PAGES},http://localhost:3000,${LOCAL}`,
  CODI_ISSUER: ISSUER,
  CODI_CLIENT_ID: CLIENT,
  CODI_CLIENT_SECRET: SECRET,
}

describe('POST /oauth/complete', () => {
  it('returns only the kid profile and keeps the secret and access token', async () => {
    const response = await complete(LOCAL, LOCAL_REDIRECT, hub())
    const text = await response.text()
    expect(response.status).toBe(200)
    expect(text).not.toContain(SECRET)
    expect(text).not.toContain('atk-secret-token')
    expect(JSON.parse(text)).toEqual({ sub: 'kid', nickname: 'มะลิ', picture: 'https://example.test/codi.png' })
    expect(response.headers.get('access-control-allow-origin')).toBe(LOCAL)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('accepts the GitHub Pages origin only with its own redirect URI', async () => {
    const ok = await complete(PAGES, PAGES_REDIRECT, hub())
    expect(ok.status).toBe(200)
    const crossed = await complete(LOCAL, PAGES_REDIRECT, hub())
    expect(crossed.status).toBe(400)
    expect(await crossed.text()).not.toContain(SECRET)
  })

  it('rejects a missing or foreign origin and answers the preflight', async () => {
    const missing = await handleOauth(new Request('https://worker.test/oauth/complete', { method: 'POST', body: '{}' }), env, hub())
    expect(missing?.status).toBe(403)
    const foreign = await complete('https://evil.test', LOCAL_REDIRECT, hub())
    expect(foreign.status).toBe(403)
    const preflight = await handleOauth(new Request('https://worker.test/oauth/complete', { method: 'OPTIONS', headers: { origin: LOCAL } }), env, hub())
    expect(preflight?.status).toBe(204)
    expect(preflight?.headers.get('access-control-allow-origin')).toBe(LOCAL)
  })

  it('rejects a bad nonce, a long nickname is shortened, and other paths pass through', async () => {
    const badNonce = await complete(LOCAL, LOCAL_REDIRECT, hub({ claims: { nonce: 'different-nonce-value' } }))
    expect(badNonce.status).toBe(401)
    expect(await badNonce.text()).not.toContain(SECRET)
    const longName = 'x'.repeat(30)
    const shortened = await complete(LOCAL, LOCAL_REDIRECT, hub({ userinfo: { sub: 'kid', nickname: longName, picture: 'https://example.test/codi.png' } }))
    const profile = await shortened.json() as { nickname: string }
    expect(profile.nickname).toHaveLength(24)
    expect(profile.nickname).toBe(longName.slice(0, 24))
    const other = await handleOauth(new Request('https://worker.test/health'), env, hub())
    expect(other).toBeNull()
  })
})

function complete(origin: string, redirect: string, fetchImpl: typeof fetch): Promise<Response> {
  return handleOauth(new Request('https://worker.test/oauth/complete', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'auth-code', code_verifier: 'a'.repeat(64), nonce: NONCE, redirect_uri: redirect }),
  }), env, fetchImpl).then((response) => {
    if (!response) throw new Error('expected a response')
    return response
  })
}

function hub(options: { claims?: Record<string, unknown>; userinfo?: Record<string, unknown> } = {}): typeof fetch {
  return async (input, init) => {
    const url = String(input)
    if (url === `${ISSUER}/oauth/token`) {
      const sent = String(init?.body)
      expect(sent).toContain('client_secret=')
      expect(sent).toContain(encodeURIComponent(SECRET))
      const idToken = await sign({ iss: ISSUER, aud: CLIENT, sub: 'kid', nonce: NONCE, exp: Math.floor(Date.now() / 1000) + 600, ...options.claims })
      return Response.json({ access_token: 'atk-secret-token', id_token: idToken, token_type: 'Bearer' })
    }
    if (url === `${ISSUER}/oauth/jwks`) return Response.json({ keys: [jwk] })
    if (url === `${ISSUER}/oauth/userinfo`) {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer atk-secret-token')
      return Response.json(options.userinfo ?? { sub: 'kid', nickname: 'มะลิ', picture: 'https://example.test/codi.png' })
    }
    throw new Error(url)
  }
}

async function sign(payload: Record<string, unknown>): Promise<string> {
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'k1' })))
  const body = base64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(`${header}.${body}`))
  return `${header}.${body}.${base64Url(new Uint8Array(signature))}`
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
