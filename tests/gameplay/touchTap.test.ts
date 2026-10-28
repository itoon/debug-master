import { describe, expect, it, vi } from 'vitest'
import { createTouchTap } from '../../app/utils/touchTap'

const touch = (id = 1, x = 10, y = 10) => ({ identifier: id, clientX: x, clientY: y })
function event(touches: ReturnType<typeof touch>[], changedTouches = touches) {
  return { touches, changedTouches, cancelable: true, preventDefault: vi.fn() }
}

describe('game button touch gestures', () => {
  it('activates every single-finger tap once and cancels the browser zoom/click default', () => {
    const activate = vi.fn()
    const tap = createTouchTap(activate)
    for (let i = 0; i < 3; i++) {
      tap.start(event([touch()]), 'right')
      const end = event([], [touch()])
      tap.end(end, 'right')
      expect(end.preventDefault).toHaveBeenCalledOnce()
    }
    expect(activate.mock.calls).toEqual([['right'], ['right'], ['right']])
  })
  it('leaves pinch gestures alone even when the second finger lifts first', () => {
    const activate = vi.fn()
    const tap = createTouchTap(activate)
    tap.start(event([touch()]), 'right')
    tap.multitouch(event([touch(), touch(2)]))
    const end = event([], [touch()])
    tap.end(end, 'right')
    expect(activate).not.toHaveBeenCalled()
    expect(end.preventDefault).not.toHaveBeenCalled()
  })
  it('does not turn scrolling, cancelled touches or release on another button into input', () => {
    const activate = vi.fn()
    const tap = createTouchTap(activate)
    tap.start(event([touch()]), 'left')
    tap.move(event([touch(1, 40)]))
    tap.end(event([], [touch(1, 10)]), 'left')
    tap.start(event([touch()]), 'left')
    tap.cancel()
    tap.end(event([], [touch()]), 'left')
    tap.start(event([touch()]), 'left')
    tap.end(event([], [touch()]), 'right')
    tap.start(event([touch()]), 'left')
    tap.end(event([], [touch()]), null)
    expect(activate).not.toHaveBeenCalled()
  })
})
