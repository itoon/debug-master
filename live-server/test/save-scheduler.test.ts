import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAVE_INTERVAL_MS, SaveScheduler } from '../src/save-scheduler'

describe('SaveScheduler', () => {
  let writes: number[]
  let saver: SaveScheduler
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    writes = []
    saver = new SaveScheduler(async () => {
      writes.push(Date.now())
    })
  })
  afterEach(() => vi.useRealTimers())

  it('writes the first progress at once, then at most once per second with a trailing write', async () => {
    expect(SAVE_INTERVAL_MS).toBe(1000)
    await saver.saveSoon()
    expect(writes).toEqual([10_000])
    for (let t = 0; t < 4; t++) {
      vi.advanceTimersByTime(200)
      await saver.saveSoon()
    }
    expect(writes).toEqual([10_000]) // 4 more progress messages, no write yet
    expect(saver.pending).toBe(true)
    await vi.advanceTimersByTimeAsync(200)
    expect(writes).toEqual([10_000, 11_000]) // trailing write
    expect(saver.pending).toBe(false)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(writes).toHaveLength(2) // nothing new: no write
  })

  it('an immediate write replaces the pending trailing one', async () => {
    await saver.saveSoon()
    vi.advanceTimersByTime(100)
    await saver.saveSoon()
    expect(saver.pending).toBe(true)
    await saver.saveNow()
    expect(writes).toEqual([10_000, 10_100])
    await vi.advanceTimersByTimeAsync(2_000)
    expect(writes).toHaveLength(2)
  })

  it('cancel drops a pending write', async () => {
    await saver.saveNow()
    await saver.saveSoon()
    saver.cancel()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(writes).toEqual([10_000])
  })
})
