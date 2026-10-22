import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue'
import type { Ref } from 'vue'
import { hostKeyFor } from '../utils/live/identity'
import type { RoomState } from '../utils/live/protocol'
import { useLiveRoom, type LiveRoom } from './useLiveRoom'

/** A public display stays a screen; a saved room key adds a separately authenticated control socket. */
export function useLiveScreenControl(code: string, state: Readonly<Ref<RoomState | null>>) {
  const control = shallowRef<LiveRoom | null>(null)
  const canControl = computed(() => control.value?.isHost.value === true)
  const available = computed(() => canControl.value && control.value?.connected.value === true)
  const canStart = computed(() => available.value && state.value?.phase === 'lobby' &&
    state.value.players.some(player => player.status === 'playing' && player.connected))
  const canNewRound = computed(() => available.value && state.value?.phase === 'finished')

  onMounted(() => {
    if (!code) return
    const key = hostKeyFor(code)
    if (key) control.value = useLiveRoom({ code, role: 'host', key, hello: () => ({ type: 'hello' }) })
  })
  onBeforeUnmount(() => control.value?.close())

  function start(): void {
    if (canStart.value) control.value?.send({ type: 'start' })
  }
  function newRound(): void {
    if (canNewRound.value) control.value?.send({ type: 'newRound' })
  }

  return { canControl, canStart, canNewRound, start, newRound }
}
