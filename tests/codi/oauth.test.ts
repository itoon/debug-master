import { describe, expect, it } from 'vitest'
import { codeChallenge, codiPictureSrc, codiReturnPath, isCodiPictureUrl, redirectUriForOrigin } from '../../app/utils/codiOauth'
import { resolveAvatarId } from '../../app/data/player-avatars'
import { peekCodiResult, readCodiTxn, saveCodiResult, saveCodiTxn, type CodiTxn } from '../../app/utils/codiSession'

describe('Codi Arena login helpers', () => {
  it('pairs each origin with the redirect URI registered for it', () => {
    expect(redirectUriForOrigin('http://localhost:3002')).toBe('http://localhost:3002/callback')
    expect(redirectUriForOrigin('https://itoon.github.io')).toBe('https://itoon.github.io/debug-master/callback')
    expect(redirectUriForOrigin('http://192.168.1.113:3002')).toBeNull()
  })

  it('returns to the same game path, including the GitHub Pages prefix', () => {
    expect(codiReturnPath('/', { kind: 'home', modeId: 'A' })).toBe('/')
    expect(codiReturnPath('/', { kind: 'live', room: 'codi-1' })).toBe('/?room=CODI-1')
    expect(codiReturnPath('/debug-master/', { kind: 'live', room: 'codi-1' })).toBe('/debug-master/?room=CODI-1')
    expect(codiReturnPath('/debug-master/', { kind: 'live', room: 'no' })).toBe('/debug-master/')
  })

  it('asks the hub picture URL for one rendered image', () => {
    expect(codiPictureSrc('https://codi-arena-hub.innovasive.workers.dev/oauth/picture/kid.png')).toBe('https://codi-arena-hub.innovasive.workers.dev/oauth/picture/kid.png?size=512')
    expect(codiPictureSrc('https://codi-arena-hub.innovasive.workers.dev/oauth/picture/kid.png?size=256')).toBe('https://codi-arena-hub.innovasive.workers.dev/oauth/picture/kid.png?size=256')
  })

  it('keeps a Codi photo as the player avatar and rejects other remote values', () => {
    const photo = 'https://codi-arena-hub.innovasive.workers.dev/oauth/picture/kid.png'
    expect(isCodiPictureUrl(photo)).toBe(true)
    expect(isCodiPictureUrl('http://example.test/codi.png')).toBe(false)
    expect(isCodiPictureUrl('codi_default.svg')).toBe(false)
    expect(resolveAvatarId(photo)).toBe(photo)
    expect(resolveAvatarId('art-toy/10-party.svg')).toBe('art-toy/10-party.svg')
    expect(resolveAvatarId('not-a-photo')).toBe('codi_default.svg')
  })

  it('builds the S256 challenge from the PKCE verifier', async () => {
    await expect(codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).resolves.toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('keeps a sign-in and its result in the tab session', () => {
    const storage = memoryStorage()
    const txn: CodiTxn = { kind: 'home', modeId: 'B', verifier: 'a'.repeat(64), state: 'b'.repeat(32), nonce: 'c'.repeat(32) }
    saveCodiTxn(txn, storage)
    expect(readCodiTxn(storage)).toEqual(txn)
    saveCodiResult({ kind: 'home', modeId: 'B', profile: { sub: 'kid', nickname: 'มะลิ', picture: 'https://example.test/codi.png' } }, storage)
    expect(peekCodiResult(storage)?.profile?.nickname).toBe('มะลิ')
    saveCodiResult({ kind: 'home', modeId: 'B', profile: { sub: 'kid', nickname: 'มะลิ', picture: 'http://example.test/codi.png' } }, storage)
    expect(peekCodiResult(storage)).toBeNull()
  })
})

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  }
}
