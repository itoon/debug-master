// Race-track scale math shared by the big-screen lanes and the player HUD.
// Keep this file free of imports so it stays portable.

/** Smallest track length, so the first points of a round don't fill the lane. */
export const TRACK_BASELINE = 5000
/** Fraction of the lane the leader should occupy; the rest is headroom. */
export const LEADER_SPAN = 0.85

/** Round up to a readable track length: step 1,000 up to 10,000, 2,000 up to 40,000, then 5,000. */
export function niceCeil(v: number): number {
  const step = v <= 10_000 ? 1000 : v <= 40_000 ? 2000 : 5000
  return Math.ceil(v / step) * step
}

/** Track length that keeps the leader near LEADER_SPAN of the lane. */
export function trackMax(leaderScore: number): number {
  return niceCeil(Math.max(TRACK_BASELINE, leaderScore / LEADER_SPAN))
}

/** Position of `score` along a track of length `max`, clamped to 0..1. */
export function laneFraction(score: number, max: number): number {
  if (!(max > 0)) return 0
  return Math.min(1, Math.max(0, score / max))
}

/** Five evenly spaced axis ticks: 0, max/4, max/2, 3max/4, max. */
export function trackTicks(max: number): number[] {
  return [0, 1, 2, 3, 4].map(i => (max * i) / 4)
}
