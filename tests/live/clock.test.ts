import { describe, expect, it } from 'vitest'
import { clockOffset, countdownSec, remainingSec, serverTime } from '../../app/utils/live/clock'

describe('server clock', () => {
  it('uses server time, not the device clock', () => {
    // device is 5 minutes behind the server
    const offset = clockOffset(1_000_300_000, 1_000_000_000)
    expect(offset).toBe(300_000)
    expect(serverTime(offset, 1_000_000_000)).toBe(1_000_300_000)
    expect(remainingSec(1_000_300_000 + 480_000, offset, 1_000_000_000)).toBe(480)
  })

  it('rounds up and never goes negative', () => {
    expect(remainingSec(10_500, 0, 10_000)).toBe(1)
    expect(remainingSec(9_000, 0, 10_000)).toBe(0)
    expect(remainingSec(null, 0, 10_000)).toBe(0)
    expect(countdownSec(12_001, 0, 10_000)).toBe(3)
    expect(countdownSec(9_000, 0, 10_000)).toBe(0)
    expect(countdownSec(null, 0, 10_000)).toBe(0)
  })
})
