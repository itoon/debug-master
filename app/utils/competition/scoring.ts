export type CompetitionScoreInput = {
  correct: boolean
  stars: number
  difficulty?: number
  timeSpentSeconds: number
}

export function calculateCompetitionScore(input: CompetitionScoreInput): number {
  const { correct, stars, difficulty = 1, timeSpentSeconds } = input
  if (typeof correct !== 'boolean') throw new Error('Correct must be a boolean')
  if (!Number.isInteger(stars) || stars < 0 || stars > 3) throw new Error('Stars must be an integer from zero to three')
  if (!Number.isSafeInteger(difficulty) || difficulty < 1) throw new Error('Difficulty must be a positive integer')
  if (!Number.isFinite(timeSpentSeconds) || timeSpentSeconds < 0) throw new Error('Elapsed seconds must be finite and nonnegative')
  if (!correct) return 0
  const starMultiplier = 1 + 0.5 * (stars - 1)
  const difficultyMultiplier = 1 + 0.25 * (difficulty - 1)
  const points = Math.round(1000 * starMultiplier * difficultyMultiplier / Math.log10(timeSpentSeconds + 10))
  if (!Number.isSafeInteger(points)) throw new Error('Awarded points exceed safe integer range')
  return points
}

export function starsForMistakes(mistakes: number): 1 | 2 | 3 {
  if (!Number.isSafeInteger(mistakes) || mistakes < 0) throw new Error('Mistakes must be a nonnegative integer')
  return mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1
}
