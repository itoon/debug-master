import { describe, expect, it } from 'vitest'
import { laneFraction, trackMax, trackTicks } from '../../app/utils/live/track'

describe('race track math', () => {
  it('keeps a baseline track early in the round', () => {
    expect(trackMax(0)).toBe(5000)
  })

  it('extends so the leader stays near 85%', () => {
    expect(trackMax(6820)).toBe(9000) // 6820/0.85 = 8023.5 -> 9000
    expect(trackMax(20000)).toBe(24000) // 23529 -> 24000
    expect(trackMax(60000)).toBe(75000) // 70588 -> 75000
  })

  it('clamps lane fraction', () => {
    expect(laneFraction(4500, 9000)).toBe(0.5)
    expect(laneFraction(-1, 9000)).toBe(0)
    expect(laneFraction(99999, 9000)).toBe(1)
  })

  it('makes five ticks', () => {
    expect(trackTicks(8000)).toEqual([0, 2000, 4000, 6000, 8000])
  })
})
