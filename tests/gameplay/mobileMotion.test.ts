import { afterEach, describe, expect, it, vi } from 'vitest'
import { lightGameplayMotion } from '../../app/utils/gameplayDevice'

afterEach(() => vi.unstubAllGlobals())
describe('mobile gameplay motion', () => {
  it('keeps desktop touch animation and shares the mobile policy for count-up and scrolling', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    vi.stubGlobal('navigator', { userAgent: 'Windows NT', platform: 'Win32', maxTouchPoints: 10 })
    expect(lightGameplayMotion()).toBe(false)
    vi.stubGlobal('navigator', { userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 })
    expect(lightGameplayMotion()).toBe(true)
  })
})
