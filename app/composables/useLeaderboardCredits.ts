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
  const settings = homeConfig.leaderboardScroll;
  let frame: number | undefined;
  let lastTime = 0;
  let position = 0;
  let holdUntil = 0;
  let atEnd = false;
  let observer: ResizeObserver | undefined;
  let motionQuery: MediaQueryList | undefined;

  function stop() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    lastTime = 0;
  }
  function tick(time: number) {
    frame = undefined;
    const area = viewport.value;
    if (!area || !enabled.value || paused.value || reducedMotion.value || document.hidden) return;
    const maximum = Math.max(0, area.scrollHeight - area.clientHeight);
    if (maximum <= 1) { overflowing.value = false; return; }
    const delta = lastTime ? Math.min(time - lastTime, 80) : 0;
    if (!lastTime) position = area.scrollTop;
    lastTime = time;
    if (time < holdUntil) {
      position = area.scrollTop; // Preserve manual wheel/touch scrolling during the pause.
    } else {
      if (atEnd) {
        area.scrollTop = 0;
        position = 0;
        atEnd = false;
        holdUntil = time + settings.startPauseMs;
      } else {
        position = Math.min(maximum, position + delta / 1000 * settings.pixelsPerSecond);
        area.scrollTop = position;
        if (area.scrollTop >= maximum - 1) {
          atEnd = true;
          holdUntil = time + settings.endPauseMs;
        }
      }
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    const area = viewport.value;
    overflowing.value = Boolean(enabled.value && area && area.scrollHeight - area.clientHeight > 1);
    if (!overflowing.value || paused.value || reducedMotion.value || document.hidden) { stop(); return; }
    if (frame === undefined) frame = requestAnimationFrame(tick);
  }
  function observe() {
    observer?.disconnect();
    stop();
    atEnd = false;
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
    atEnd = false;
    holdUntil = performance.now() + settings.interactionPauseMs;
  }
  function updateMotion() {
    reducedMotion.value = motionQuery?.matches ?? true;
    sync();
  }
  watch([viewport, content], observe, { flush: "post" });
  watch([enabled, paused], sync, { flush: "post" });
  onMounted(() => {
    motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    motionQuery.addEventListener("change", updateMotion);
    reducedMotion.value = motionQuery.matches;
    document.addEventListener("visibilitychange", sync);
    observe();
  });
  onBeforeUnmount(() => {
    stop();
    observer?.disconnect();
    motionQuery?.removeEventListener("change", updateMotion);
    document.removeEventListener("visibilitychange", sync);
  });
  return { overflowing, reducedMotion, pauseForInput };
}
