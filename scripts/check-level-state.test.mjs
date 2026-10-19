import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ref } from 'vue'
import { useLevelState } from '../app/composables/useLevelState.ts'

const level = {
  id: 4,
  title: 'Test',
  rows: 2,
  cols: 3,
  map: [
    ['g', 'g', 'g'],
    ['g', 'g', 'g']
  ],
  start: [1, 0],
  code: 'right()',
  concept: 'sequence',
  learningObjective: ''
}

test('a new level resets Codi and its animation state without changing the level', () => {
  const state = useLevelState(ref(level))
  state.player.row = 0
  state.player.col = 2
  state.playerHop.value = 3
  state.status.value = 'failed'
  state.reset()
  assert.deepEqual([state.player.row, state.player.col], level.start)
  assert.equal(state.playerHop.value, 3)
  assert.equal(state.boardRound.value, 1)
  assert.equal(state.status.value, 'playing')
  assert.equal(state.currentTile.value, 'g')
})

test('accepted moves retain their code line until the next instruction', () => {
  const state = useLevelState(ref(level))
  state.reset()
  state.expectedMove.value = { direction: 'right', sourceLine: 2 }
  state.levelCorrectInputs.value += 1
  state.expectedMove.value = null
  assert.deepEqual(state.executedCodeStep.value, { line: 2, sequence: 1 })

  state.reset()
  assert.equal(state.executedCodeStep.value, null)
})
