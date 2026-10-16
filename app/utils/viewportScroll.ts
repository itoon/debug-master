/** One cancellable, transform-free scroll owner for a bounded viewport. */
export function createViewportScroller() {
  let frame: number | undefined;
  let generation = 0;
  function cancel(): void {
    generation += 1;
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  }
  function to(element: HTMLElement, target: { top: number; left: number }): void {
    cancel();
    const token = generation;
    const top = Math.max(0, Math.min(target.top, element.scrollHeight - element.clientHeight));
    const left = Math.max(0, Math.min(target.left, element.scrollWidth - element.clientWidth));
    const fromTop = element.scrollTop;
    const fromLeft = element.scrollLeft;
    if (Math.max(Math.abs(top - fromTop), Math.abs(left - fromLeft)) < 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.scrollTo({ top, left, behavior: 'instant' });
      return;
    }
    const started = performance.now();
    function tick(now: number): void {
      frame = undefined;
      if (token !== generation || !element.isConnected) return;
      const progress = Math.min(1, (now - started) / 300);
      const eased = 1 - (1 - progress) ** 3;
      element.scrollTo({ top: fromTop + (top - fromTop) * eased, left: fromLeft + (left - fromLeft) * eased, behavior: 'instant' });
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }
  return { to, cancel };
}
