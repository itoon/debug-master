import { describe, expect, it } from 'vitest'
import { playerSetupFromScore } from '../../app/utils/playerProfile'

describe('returning player profile', () => {
  it('reuses a Codi profile without asking for an age', () => {
    expect(playerSetupFromScore({ name: ' โคดิ ', avatarId: 'https://example.test/codi.png' }))
      .toEqual({ nickname: 'โคดิ', avatarId: 'https://example.test/codi.png' })
  })

  it('keeps a manual player age and uses the default for an unknown avatar', () => {
    expect(playerSetupFromScore({ name: 'Player', age: 8, avatarId: 'missing' }))
      .toEqual({ nickname: 'Player', age: 8, avatarId: 'codi_default.svg' })
  })

  it('rejects invalid supplied ages and unusable names', () => {
    for (const age of [4, 19, NaN]) expect(playerSetupFromScore({ name: 'Player', age })).toBeNull()
    for (const name of ['', '   ', 'a'.repeat(25)]) expect(playerSetupFromScore({ name })).toBeNull()
  })
})
