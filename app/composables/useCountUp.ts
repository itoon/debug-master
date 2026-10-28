// Presentation only: a displayed number that eases toward its source value.
import { lightGameplayMotion } from '../utils/gameplayDevice';
// Increases roll up; decreases (new run, reset) snap so totals never count down.
// Touch devices, reduced motion and hidden tabs skip the per-frame number animation.
export function useCountUp(source: Ref<number>, options: { duration?: number; from?: number; delay?: number } = {}) {
  const duration = options.duration ?? 600;
  const shown = ref(options.from ?? source.value);
  let frame = 0;
  let delayTimer: ReturnType<typeof setTimeout> | null = null;

  function stop(): void {
    if (frame) cancelAnimationFrame(frame);
    if (delayTimer) clearTimeout(delayTimer);
    frame = 0;
    delayTimer = null;
  }

  function run(target: number): void {
    stop();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (target <= shown.value || reduced || lightGameplayMotion() || document.hidden) {
      shown.value = target;
      return;
    }
    const start = shown.value;
    let startedAt = 0;
    const tick = (now: number) => {
      startedAt ||= now;
      const progress = Math.min(1, (now - startedAt) / duration);
      // Exponential ease-out: fast roll, soft landing on the real value.
      const eased = progress === 1 ? 1 : 1 - 2 ** (-10 * progress);
      shown.value = Math.round(start + (target - start) * eased);
      frame = progress < 1 ? requestAnimationFrame(tick) : 0;
    };
    frame = requestAnimationFrame(tick);
  }

  watch(source, (value) => run(value));
  onMounted(() => {
    if (shown.value === source.value) return;
    if (lightGameplayMotion() || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) run(source.value);
    else if (options.delay) delayTimer = setTimeout(() => run(source.value), options.delay);
    else run(source.value);
  });
  onBeforeUnmount(stop);
  return shown;
}
