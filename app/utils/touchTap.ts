type TouchPoint = { identifier: number; clientX: number; clientY: number }
type TouchInput = { touches: ArrayLike<TouchPoint>; changedTouches: ArrayLike<TouchPoint>; cancelable: boolean; preventDefault(): void }

/** Only cancel the browser's default for a completed, single-finger game-button tap. */
export function createTouchTap<T>(activate: (control: T) => void) {
  let active: { control: T; point: TouchPoint } | null = null
  const cancel = () => { active = null }
  return {
    cancel,
    start(event: TouchInput, control: T | null) {
      cancel()
      // Native Touch coordinates are prototype properties, so copy them explicitly.
      if (event.touches.length === 1 && control !== null) {
        const point = event.touches[0]!
        active = { control, point: { identifier: point.identifier, clientX: point.clientX, clientY: point.clientY } }
      }
    },
    multitouch(event: TouchInput) { if (event.touches.length > 1) cancel() },
    move(event: TouchInput) {
      const point = Array.from(event.touches).find(t => t.identifier === active?.point.identifier)
      if (!point || !active || Math.hypot(point.clientX - active.point.clientX, point.clientY - active.point.clientY) > 12) cancel()
    },
    end(event: TouchInput, control: T | null) {
      const tap = active
      cancel()
      const point = Array.from(event.changedTouches).find(t => t.identifier === tap?.point.identifier)
      if (!tap || control !== tap.control || !point || event.touches.length || !event.cancelable ||
        Math.hypot(point.clientX - tap.point.clientX, point.clientY - tap.point.clientY) > 12) return
      // Cancels double-tap zoom and the synthetic click; keyboard/mouse keep their click path.
      event.preventDefault()
      activate(tap.control)
    },
  }
}
