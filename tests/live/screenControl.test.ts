import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { RoomState } from '../../app/utils/live/protocol'
import { useLiveScreenControl } from '../../app/composables/useLiveScreenControl'

const lifecycle = vi.hoisted(() => ({ mount: [] as (() => void)[], unmount: [] as (() => void)[] }))
vi.mock('vue', async original => ({ ...await original<typeof import('vue')>(),
  onMounted: (fn: () => void) => lifecycle.mount.push(fn),
  onBeforeUnmount: (fn: () => void) => lifecycle.unmount.push(fn),
}))
vi.mock('../../app/composables/useLiveRoom', () => ({ useLiveRoom: vi.fn() }))
vi.mock('../../app/utils/live/identity', () => ({ hostKeyFor: vi.fn() }))
import { useLiveRoom } from '../../app/composables/useLiveRoom'
import { hostKeyFor } from '../../app/utils/live/identity'

function setup() {
  const state = ref<RoomState | null>({ phase: 'lobby', players: [], durationSec: 300 } as unknown as RoomState)
  const host = { connected: ref(false), isHost: ref<boolean | null>(null), send: vi.fn(), close: vi.fn() }
  vi.mocked(useLiveRoom).mockReturnValue(host as unknown as ReturnType<typeof useLiveRoom>)
  const controls = useLiveScreenControl('QA-SCREEN', state)
  lifecycle.mount.forEach(fn => fn())
  return { state, host, controls }
}

beforeEach(() => { lifecycle.mount.length = lifecycle.unmount.length = 0; vi.clearAllMocks(); vi.mocked(hostKeyFor).mockReturnValue('saved-host-key-12345678') })
afterEach(() => { lifecycle.unmount.forEach(fn => fn()) })

describe('big-screen host controls', () => {
  it('keeps a display without a saved host key read-only', () => {
    vi.mocked(hostKeyFor).mockReturnValue(null)
    const { controls } = setup()
    expect(useLiveRoom).not.toHaveBeenCalled()
    expect(controls.canControl.value).toBe(false)
    controls.start(); controls.newRound()
  })

  it('authenticates a separate host connection with the existing room key', () => {
    const { controls, host } = setup()
    expect(hostKeyFor).toHaveBeenCalledWith('QA-SCREEN')
    expect(useLiveRoom).toHaveBeenCalledWith({ code: 'QA-SCREEN', role: 'host', key: 'saved-host-key-12345678', hello: expect.any(Function) })
    const options = vi.mocked(useLiveRoom).mock.calls[0]![0]
    expect(options.hello()).toEqual({ type: 'hello' })
    host.connected.value = true
    expect(controls.canControl.value).toBe(false)
    host.isHost.value = false
    expect(controls.canControl.value).toBe(false)
    host.isHost.value = true
    expect(controls.canControl.value).toBe(true)
  })

  it('starts only an authorized connected lobby with a connected playing participant', () => {
    const { state, host, controls } = setup()
    host.connected.value = true; host.isHost.value = true
    controls.start()
    expect(host.send).not.toHaveBeenCalled()
    state.value!.players = [{ status: 'playing', connected: false }, { status: 'queued', connected: true }] as RoomState['players']
    controls.start()
    expect(controls.canStart.value).toBe(false)
    expect(host.send).not.toHaveBeenCalled()
    state.value!.players[0]!.connected = true
    expect(controls.canStart.value).toBe(true)
    controls.start()
    expect(host.send).toHaveBeenCalledExactlyOnceWith({ type: 'start' })
    for (const phase of ['countdown', 'running', 'finished'] as const) {
      state.value!.phase = phase; controls.start()
      expect(controls.canStart.value).toBe(false)
    }
    expect(host.send).toHaveBeenCalledTimes(1)
  })

  it('never queues commands before authorization or during a disconnect', () => {
    const { state, host, controls } = setup()
    state.value!.players = [{ status: 'playing', connected: true }] as RoomState['players']
    host.connected.value = true
    controls.start()
    host.isHost.value = false; controls.start()
    host.isHost.value = true; host.connected.value = false; controls.start()
    state.value!.phase = 'finished'; controls.newRound()
    expect(host.send).not.toHaveBeenCalled()
  })

  it('opens a new round only from results and closes its control socket on unmount', () => {
    const { state, host, controls } = setup()
    host.connected.value = true; host.isHost.value = true
    controls.newRound()
    expect(host.send).not.toHaveBeenCalled()
    state.value!.phase = 'finished'
    expect(controls.canNewRound.value).toBe(true)
    controls.newRound()
    expect(host.send).toHaveBeenCalledExactlyOnceWith({ type: 'newRound' })
    lifecycle.unmount.forEach(fn => fn()); lifecycle.unmount.length = 0
    expect(host.close).toHaveBeenCalledOnce()
  })
})
