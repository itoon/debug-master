import { describe, expect, it } from 'vitest'
import { derivePlayerStage } from '../../app/utils/live/playerStage'
import type { LivePlayer, PlayerStatus, RoomState } from '../../app/utils/live/protocol'

const PID = 'p-aaaaaa'

function me(status: PlayerStatus, id = PID): LivePlayer {
  return {
    id,
    name: 'Me',
    avatarId: 'default',
    age: 10,
    status,
    lane: status === 'playing' ? 0 : null,
    score: 0,
    levelsCompleted: 0,
    bestCombo: 0,
    combo: 0,
    connected: true,
    joinedAt: 1,
    queuedAt: status === 'queued' ? 1 : null,
  }
}

function state(over: Partial<RoomState>, ...players: LivePlayer[]): RoomState {
  return {
    code: 'CODI-1',
    phase: 'lobby',
    mode: 'A',
    durationSec: 480,
    roundId: 1,
    startAt: null,
    endAt: null,
    serverNow: 0,
    players,
    screens: 0,
    hosts: 1,
    ...over,
  }
}

const base = {
  enabled: true,
  code: 'CODI-1' as string | null,
  hasProfile: true,
  connected: true,
  notice: null as 'full' | 'kicked' | null,
  state: null as RoomState | null,
  pid: PID,
  offset: 0,
  now: 5_000,
}

describe('derivePlayerStage', () => {
  it('1: unavailable when live is disabled or there is no code', () => {
    const s = state({}, me('playing'))
    expect(derivePlayerStage({ ...base, enabled: false, state: s })).toBe('unavailable')
    expect(derivePlayerStage({ ...base, code: null, state: s })).toBe('unavailable')
  })

  it('1: unavailable wins over a missing profile and a notice', () => {
    expect(derivePlayerStage({ ...base, enabled: false, hasProfile: false, notice: 'kicked' })).toBe('unavailable')
  })

  it('2: setup while there is no profile', () => {
    expect(derivePlayerStage({ ...base, hasProfile: false, state: state({}, me('playing')) })).toBe('setup')
  })

  it('2: setup wins over a notice', () => {
    expect(derivePlayerStage({ ...base, hasProfile: false, notice: 'full' })).toBe('setup')
  })

  it('3: a full notice shows full', () => {
    expect(derivePlayerStage({ ...base, notice: 'full' })).toBe('full')
  })

  it('3: a kicked notice wins over any state', () =>
    expect(derivePlayerStage({ ...base, notice: 'kicked', state: state({ phase: 'running' }, me('playing')) })).toBe('kicked'))

  it('4: connecting while there is no state', () => {
    expect(derivePlayerStage({ ...base, state: null })).toBe('connecting')
  })

  it('5: connecting while this pid is not in the player list', () => {
    expect(derivePlayerStage({ ...base, state: state({ phase: 'running' }, me('playing', 'p-other1')) })).toBe('connecting')
    expect(derivePlayerStage({ ...base, state: state({ phase: 'lobby' }) })).toBe('connecting')
  })

  it('6: queued when this player is queued', () => {
    expect(derivePlayerStage({ ...base, state: state({ phase: 'lobby' }, me('queued')) })).toBe('queued')
  })

  it('6: keeps a queued player in the queue while the round runs', () =>
    expect(derivePlayerStage({ ...base, state: state({ phase: 'running' }, me('queued')) })).toBe('queued'))

  it('6: keeps a queued player in the queue during countdown and results', () => {
    expect(derivePlayerStage({ ...base, state: state({ phase: 'countdown', startAt: 9_000 }, me('queued')) })).toBe('queued')
    expect(derivePlayerStage({ ...base, state: state({ phase: 'finished' }, me('queued')) })).toBe('queued')
  })

  it('7: lobby for a playing player in the lobby', () => {
    expect(derivePlayerStage({ ...base, state: state({ phase: 'lobby' }, me('playing')) })).toBe('lobby')
  })

  it('8: countdown while server time is before startAt', () => {
    const s = state({ phase: 'countdown', startAt: 10_000 }, me('playing'))
    expect(derivePlayerStage({ ...base, state: s, now: 9_999 })).toBe('countdown')
  })

  it('8: uses server time (offset), not the device clock', () => {
    const s = state({ phase: 'countdown', startAt: 10_000 }, me('playing'))
    // device clock reads 9_000 but the server is 2_000 ahead
    expect(derivePlayerStage({ ...base, state: s, offset: 2_000, now: 9_000 })).toBe('running')
    expect(derivePlayerStage({ ...base, state: s, offset: -2_000, now: 11_000 })).toBe('countdown')
  })

  it('shows the race once server time passes startAt even before the running broadcast', () => {
    const s = state({ phase: 'countdown', startAt: 10_000 }, me('playing'))
    expect(derivePlayerStage({ ...base, state: s, offset: 0, now: 9_999 })).toBe('countdown')
    expect(derivePlayerStage({ ...base, state: s, offset: 0, now: 10_000 })).toBe('running')
  })

  it('9: running in the running phase', () => {
    expect(derivePlayerStage({ ...base, state: state({ phase: 'running', startAt: 1_000, endAt: 9_000 }, me('playing')) })).toBe('running')
  })

  it('10: results when the round is finished', () => {
    expect(derivePlayerStage({ ...base, state: state({ phase: 'finished' }, me('playing')) })).toBe('results')
  })

  it('connected is not part of the decision', () => {
    const s = state({ phase: 'running' }, me('playing'))
    expect(derivePlayerStage({ ...base, connected: false, state: s })).toBe('running')
  })
})
