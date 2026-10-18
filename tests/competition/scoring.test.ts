import { describe, expect, it } from 'vitest'
import { calculateCompetitionScore, starsForMistakes } from '../../app/utils/competition/scoring'

describe('competition formula', () => {
  it.each([[10, 1537], [30, 1248], [60, 1084], [120, 946]])(
    'awards %s-second reference points', (timeSpentSeconds, expected) => {
      expect(calculateCompetitionScore({ correct: true, stars: 3, difficulty: 1, timeSpentSeconds })).toBe(expected)
    },
  )

  it('keeps zero-star formula support independent of the game rubric', () => {
    expect(calculateCompetitionScore({ correct: true, stars: 0, timeSpentSeconds: 0 })).toBe(500)
    expect(calculateCompetitionScore({ correct: false, stars: 3, timeSpentSeconds: 10 })).toBe(0)
    expect([0, 1, 2, 9].map(starsForMistakes)).toEqual([3, 2, 1, 1])
  })

  it('uses fractional seconds without intermediate rounding and applies numeric difficulty', () => {
    expect(calculateCompetitionScore({ correct: true, stars: 3, timeSpentSeconds: 10.25 })).toBe(Math.round(2000 / Math.log10(20.25)))
    expect(calculateCompetitionScore({ correct: true, stars: 1, difficulty: 3, timeSpentSeconds: 0 })).toBe(1500)
  })

  it.each([
    { timeSpentSeconds: NaN }, { timeSpentSeconds: Infinity }, { timeSpentSeconds: -1 },
    { stars: NaN }, { stars: Infinity }, { stars: -1 }, { stars: 4 }, { stars: 1.5 },
    { difficulty: NaN }, { difficulty: Infinity }, { difficulty: 0 }, { difficulty: -1 }, { difficulty: 1.5 },
    { correct: 'yes' }, { stars: '3' }, { difficulty: null },
  ])('rejects malformed scoring values %o even for an incorrect result', (override) => {
    expect(() => calculateCompetitionScore({ correct: false, stars: 3, timeSpentSeconds: 10, ...override } as never)).toThrow()
  })

  it.each([-1, 1.5, NaN, Infinity])('rejects invalid mistake counts %s', (mistakes) => {
    expect(() => starsForMistakes(mistakes)).toThrow()
  })

  it('rejects unsafe counts and formula overflow, while incorrect answers short-circuit', () => {
    expect(() => starsForMistakes(Number.MAX_SAFE_INTEGER + 1)).toThrow()
    expect(() => calculateCompetitionScore({ correct: true, stars: 3, difficulty: Number.MAX_SAFE_INTEGER + 1, timeSpentSeconds: 0 })).toThrow()
    expect(() => calculateCompetitionScore({ correct: true, stars: 3, difficulty: Number.MAX_SAFE_INTEGER, timeSpentSeconds: 0 })).toThrow()
    expect(calculateCompetitionScore({ correct: false, stars: 3, difficulty: Number.MAX_SAFE_INTEGER, timeSpentSeconds: 0 })).toBe(0)
  })
})
