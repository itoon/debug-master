import { onBeforeUnmount, watch, type Ref } from 'vue'
import type { Direction } from '../types/debug-game'
import { createTouchTap } from '../utils/touchTap'

export function useGameTouchControls(root: Ref<HTMLElement | null>, activate: (direction: Direction) => void) {
  const tap = createTouchTap<HTMLButtonElement>(button => {
    if (!button.disabled) activate(button.dataset.direction as Direction)
  })
  let detach = () => {}
  const control = (target: EventTarget | null): HTMLButtonElement | null => {
    const button = target instanceof Element ? target.closest<HTMLButtonElement>('button[data-direction]') : null
    // Disabled buttons still suppress double-tap zoom during the game's short input cooldown.
    return button && root.value?.contains(button) ? button : null
  }
  watch(root, element => {
    detach()
    if (!element) return
    const start = (event: TouchEvent) => tap.start(event, control(event.target))
    const end = (event: TouchEvent) => {
      const point = event.changedTouches[0]
      const target = point ? document.elementFromPoint(point.clientX, point.clientY) : null
      tap.end(event, control(target))
    }
    element.addEventListener('touchstart', start, { passive: true })
    element.addEventListener('touchmove', tap.move, { passive: true })
    element.addEventListener('touchend', end, { passive: false })
    element.addEventListener('touchcancel', tap.cancel, { passive: true })
    // A second finger may start outside the D-pad. Never consume that pinch gesture.
    document.addEventListener('touchstart', tap.multitouch, { passive: true })
    detach = () => {
      tap.cancel()
      element.removeEventListener('touchstart', start)
      element.removeEventListener('touchmove', tap.move)
      element.removeEventListener('touchend', end)
      element.removeEventListener('touchcancel', tap.cancel)
      document.removeEventListener('touchstart', tap.multitouch)
    }
  }, { flush: 'post' })
  onBeforeUnmount(() => detach())
}
