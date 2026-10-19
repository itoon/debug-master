import { computed, reactive, ref, shallowRef, watch, type Ref } from 'vue'
import type { RawLevel } from '../data/levels'
import type { BoardSpace } from './useBoardPresentation'
import type { Direction, GameStatus, MoveNode, Node } from '../types/debug-game'

/** One attempt's mutable board and presentation state. Session rules stay with the caller. */
export function useLevelState(level: Readonly<Ref<RawLevel>>) {
  const player = reactive({ row: level.value.start[0], col: level.value.start[1] })
  const playerHop = ref(0)
  const boardRound = ref(0)
  const boardSpace = ref<BoardSpace>({ width: 0, height: 0 })
  const playerWarped = ref(false)
  const wrapExit = ref<{ id: number; row: number; col: number; dx: number; dy: number } | null>(
    null
  )
  const playerFacing = ref<Direction>('down')
  const status = ref<GameStatus>('ready')
  const notificationMessage = ref('')
  const boardShattering = ref(false)
  const feedbackMessage = ref('กด Start เพื่อเริ่มเกม')
  const activeNode = ref<Node | null>(null)
  const expectedMove = ref<MoveNode | null>(null)
  const executionSteps = ref(0)
  const playerInputs = ref(0)
  const levelCorrectInputs = ref(0)
  const executedCodeStep = shallowRef<{ line: number; sequence: number } | null>(null)
  let executedCodeSequence = 0

  const actorStyle = computed(() => ({ '--x': player.col, '--y': player.row }))
  const currentTile = computed(() => level.value.map[player.row]?.[player.col] ?? 'n')

  // Capture the accepted instruction before the runner clears expectedMove.
  watch(
    levelCorrectInputs,
    (count, previous) => {
      if (count <= previous) return
      const line = expectedMove.value?.sourceLine
      if (line) executedCodeStep.value = { line, sequence: ++executedCodeSequence }
    },
    { flush: 'sync' }
  )
  watch(
    boardRound,
    () => {
      executedCodeStep.value = null
    },
    { flush: 'sync' }
  )

  function reset() {
    boardRound.value += 1
    player.row = level.value.start[0]
    player.col = level.value.start[1]
    playerWarped.value = true
    wrapExit.value = null
    playerFacing.value = 'down'
    expectedMove.value = null
    activeNode.value = null
    executionSteps.value = 0
    playerInputs.value = 0
    levelCorrectInputs.value = 0
    notificationMessage.value = ''
    boardShattering.value = false
    status.value = 'playing'
  }

  return {
    player,
    playerHop,
    boardRound,
    boardSpace,
    playerWarped,
    wrapExit,
    playerFacing,
    status,
    notificationMessage,
    boardShattering,
    feedbackMessage,
    activeNode,
    expectedMove,
    executionSteps,
    playerInputs,
    levelCorrectInputs,
    executedCodeStep,
    actorStyle,
    currentTile,
    reset
  }
}
