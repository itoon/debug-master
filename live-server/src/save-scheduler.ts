// Storage writes for the LiveRoom. Structural changes (phase, host, join/leave) are written at once;
// progress-only changes at most once per interval, with a trailing write so the latest room always lands.
// Progress is cumulative and clients resend it on reconnect, so losing up to one interval is harmless.

export const SAVE_INTERVAL_MS = 1000

export class SaveScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null
  private lastSaveAt = Number.NEGATIVE_INFINITY

  constructor(
    private readonly write: () => Promise<void>,
    private readonly intervalMs = SAVE_INTERVAL_MS,
    private readonly clock: () => number = Date.now,
  ) {}

  /** True while a trailing write is pending. */
  get pending(): boolean {
    return this.timer !== null
  }

  /** Writes now; a pending trailing write is no longer needed. */
  async saveNow(): Promise<void> {
    this.cancel()
    this.lastSaveAt = this.clock()
    await this.write()
  }

  /** Writes now if the last write is at least `intervalMs` old, otherwise once when it is. */
  async saveSoon(): Promise<void> {
    if (this.timer) return // the pending write will carry the latest room
    const wait = this.lastSaveAt + this.intervalMs - this.clock()
    if (wait <= 0) return this.saveNow()
    this.timer = setTimeout(() => {
      this.timer = null
      this.saveNow().catch((err) => console.error('live room save failed', err))
    }, wait)
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}
