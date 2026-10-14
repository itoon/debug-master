import { describe, expect, it } from 'vitest'
import { challengeSets } from '../../app/data/challenge-groups'
import { homeConfig } from '../../app/data/home-config'
import { solveLevel } from '../../app/utils/programRunner'
import { useProgramParser } from '../../app/composables/useProgramParser'
import { MAX_LEVEL_ID, MAX_LEVEL_MOVES, maxLevelPoints, normalizeRoomCode, roomCodeFromSearch, DURATION_PRESETS_SEC, MAX_DURATION_SEC } from '../../app/utils/live/protocol'

describe('protocol constants match the game data', () => {
  it('every live mode set fits MAX_LEVEL_ID and MAX_LEVEL_MOVES', () => {
    for (const mode of homeConfig.modes) {
      const set = challengeSets.find((s) => s.id === mode.levelSetId)!
      expect(mode.levelRange[1]).toBeLessThanOrEqual(MAX_LEVEL_ID)
      for (const level of set.levels) {
        const { parseProgram } = useProgramParser(() => level.id)
        expect(level.id).toBeLessThanOrEqual(MAX_LEVEL_ID)
        expect(solveLevel(level, parseProgram(level.code)).moves.length).toBeLessThanOrEqual(MAX_LEVEL_MOVES)
      }
    }
  })
  it('maxLevelPoints mirrors calculateLevelScore at its worst case', () => {
    expect(maxLevelPoints(1)).toBe(Math.ceil((180 + 50 * 14 + MAX_LEVEL_MOVES * 36) * 4.5))
    expect(maxLevelPoints(11)).toBe(Math.ceil((180 + 50 * 14 + MAX_LEVEL_MOVES * 36) * 4.5 * 2.6))
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
