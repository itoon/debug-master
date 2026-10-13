import { onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import { homeConfig } from "../data/home-config";

/** Scroll a single readable list upward; never duplicate scores or touch storage. */
export function useLeaderboardCredits(
  viewport: Ref<HTMLElement | null>,
  content: Ref<HTMLElement | null>,
  enabled: Readonly<Ref<boolean>>,
  paused: Readonly<Ref<boolean>>,
) {
  const overflowing = ref(false);
  const reducedMotion = ref(true);
  const isDragging = ref(false);
  const settings = homeConfig.leaderboardScroll;
  let frame: number | undefined;
  let lastTime = 0;
  let position = 0;
  let holdUntil = 0;
  let direction = 1;
  let drag: { area: HTMLElement; pointerId: number; startY: number; scrollTop: number } | undefined;
  let observer: ResizeObserver | undefined;
  let motionQuery: MediaQueryList | undefined;
  let disposed = false;

  function stop() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    lastTime = 0;
  }
  function tick(time: number) {
    frame = undefined;
    const area = viewport.value;
    if (disposed || !area || !enabled.value || paused.value || isDragging.value || reducedMotion.value || document.hidden) return;
    const maximum = Math.max(0, area.scrollHeight - area.clientHeight);
    if (maximum <= 1) { overflowing.value = false; return; }
    const delta = lastTime ? Math.min(time - lastTime, 80) : 0;
    if (!lastTime) position = area.scrollTop;
    lastTime = time;
    if (time < holdUntil) {
      position = area.scrollTop; // Preserve manual wheel/touch scrolling during the pause.
    } else {
      const speed = direction > 0 ? settings.pixelsPerSecond : settings.returnPixelsPerSecond;
      position = Math.max(0, Math.min(maximum, position + direction * delta / 1000 * speed));
      area.scrollTop = position;
      if (direction > 0 && position >= maximum) {
        direction = -1;
        holdUntil = time + settings.endPauseMs;
      } else if (direction < 0 && position <= 0) {
        direction = 1;
        holdUntil = time + settings.startPauseMs;
      }
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    if (disposed) { stop(); return; }
    const area = viewport.value;
    overflowing.value = Boolean(enabled.value && area && area.scrollHeight - area.clientHeight > 1);
    if (!overflowing.value || paused.value || isDragging.value || reducedMotion.value || document.hidden) { stop(); return; }
    if (frame === undefined) frame = requestAnimationFrame(tick);
  }
  function observe() {
    if (disposed) return;
    endManualDrag();
    observer?.disconnect();
    stop();
    direction = 1;
    holdUntil = performance.now() + settings.startPauseMs;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(sync);
      if (viewport.value) observer.observe(viewport.value);
      if (content.value) observer.observe(content.value);
    }
    sync();
  }
  function pauseForInput() {
    position = viewport.value?.scrollTop ?? 0;
    lastTime = 0;
    holdUntil = performance.now() + settings.interactionPauseMs;
  }
  function focusForInput() {
    viewport.value?.focus({ preventScroll: true });
    pauseForInput();
  }
  function beginManualDrag(event: PointerEvent) {
    if (!enabled.value) return;
    const area = viewport.value;
    if (!area) return;
    focusForInput();
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const rect = area.getBoundingClientRect();
    // Leave the native scrollbar gutter to the browser's own thumb dragging.
    if (event.clientX >= rect.left + area.clientLeft + area.clientWidth) return;
    event.preventDefault();
    drag = { area, pointerId: event.pointerId, startY: event.clientY, scrollTop: area.scrollTop };
    area.setPointerCapture(event.pointerId);
  }
  function moveManualDrag(event: PointerEvent) {
    const area = viewport.value;
    if (!drag || drag.pointerId !== event.pointerId || !area) return;
    const distance = event.clientY - drag.startY;
    if (!isDragging.value && Math.abs(distance) < 4) return;
    isDragging.value = true;
    stop();
    area.scrollTop = drag.scrollTop - distance;
    position = area.scrollTop;
  }
  function endManualDrag() {
    if (!drag) return;
    const { area, pointerId } = drag;
    drag = undefined;
    isDragging.value = false;
    if (area.hasPointerCapture(pointerId)) area.releasePointerCapture(pointerId);
    pauseForInput();
    sync();
  }
  function updateMotion() {
    reducedMotion.value = motionQuery?.matches ?? true;
    sync();
  }
  watch([viewport, content], observe, { flush: "post" });
  watch(enabled, sync, { flush: "post" });
  watch(paused, (value, previous) => {
    if (!value && previous) pauseForInput(); // Resume only three seconds after blur/hover ends.
    sync();
  }, { flush: "post" });
  onMounted(() => {
    motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    motionQuery.addEventListener("change", updateMotion);
    reducedMotion.value = motionQuery.matches;
    document.addEventListener("visibilitychange", sync);
    observe();
  });
  onBeforeUnmount(() => {
    disposed = true;
    endManualDrag();
    stop();
    observer?.disconnect();
    motionQuery?.removeEventListener("change", updateMotion);
    document.removeEventListener("visibilitychange", sync);
  });
  return { isDragging, pauseForInput, focusForInput, beginManualDrag, moveManualDrag, endManualDrag };
}
