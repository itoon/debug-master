import { describe, expect, it } from 'vitest'
import { challengeSets } from '../../app/data/challenge-groups'
import { homeConfig } from '../../app/data/home-config'
import { solveLevel } from '../../app/utils/programRunner'
import { useProgramParser } from '../../app/composables/useProgramParser'
import { LIVE_PROTOCOL_VERSION, normalizeRoomCode, roomCodeFromSearch, DURATION_PRESETS_SEC, MAX_DURATION_SEC } from '../../app/utils/live/protocol'

describe('protocol constants match the game data', () => {
  it('every configured Live level has a canonical executable solution', () => {
    for (const mode of homeConfig.modes) {
      const set = challengeSets.find((s) => s.id === mode.levelSetId)!
      expect(set.levels).toHaveLength(mode.levelRange[1])
      for (const level of set.levels) {
        const { parseProgram } = useProgramParser(() => level.id)
        const result = solveLevel(level, parseProgram(level.code))
        expect(result.error).toBeUndefined()
        expect(result.moves.length).toBeGreaterThan(0)
      }
    }
  })
  it('versions authoritative gameplay independently of cumulative scores', () => {
    expect(LIVE_PROTOCOL_VERSION).toBe(1)
  })
  it('durations stay inside the game 15-minute cap', () => {
    expect(DURATION_PRESETS_SEC).toEqual([480, 600, 900])
    expect(MAX_DURATION_SEC).toBe(900)
  })
  it('normalizes room codes', () => {
    expect(normalizeRoomCode(' codi-1 ')).toBe('CODI-1')
    expect(normalizeRoomCode('ab')).toBeNull()
    expect(normalizeRoomCode('BAD CODE')).toBeNull()
    expect(normalizeRoomCode(42)).toBeNull()
  })
  it('reads the room code from a URL query string', () => {
    // The prerendered Pages build hydrates with the query-less route, so the page reads location.search.
    expect(roomCodeFromSearch('?room=a12')).toBe('A12')
    expect(roomCodeFromSearch('?x=1&room=CODI-1')).toBe('CODI-1')
    expect(roomCodeFromSearch('?room=ab')).toBeNull()
    expect(roomCodeFromSearch('')).toBeNull()
  })
})
