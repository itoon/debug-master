import { describe, expect, it } from 'vitest'
import { needsPortrait } from '../../app/utils/gameplayDevice'

const phone = { coarsePointer: true, userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5, orientation: 'landscape-primary', angle: undefined, viewportLandscape: true }
describe('portrait requirement on player devices', () => {
  it('covers phones, Android tablets and desktop-mode iPads without a viewport width limit', () => {
    expect(needsPortrait(phone)).toBe(true)
    expect(needsPortrait({ ...phone, userAgent: 'Android', platform: 'Linux' })).toBe(true)
    expect(needsPortrait({ ...phone, userAgent: 'Macintosh', platform: 'MacIntel' })).toBe(true)
  })
  it('does not block desktop kiosks or touch laptops in landscape', () => {
    expect(needsPortrait({ ...phone, coarsePointer: false })).toBe(false)
    expect(needsPortrait({ ...phone, userAgent: 'Windows NT', platform: 'Win32' })).toBe(false)
  })
  it('uses physical portrait orientation when a keyboard makes the viewport wide', () => {
    expect(needsPortrait({ ...phone, orientation: 'portrait-primary' })).toBe(false)
    expect(needsPortrait({ ...phone, orientation: undefined, angle: 0 })).toBe(false)
    expect(needsPortrait({ ...phone, orientation: undefined, angle: -90 })).toBe(true)
    expect(needsPortrait({ ...phone, orientation: undefined, viewportLandscape: false })).toBe(false)
  })
})
