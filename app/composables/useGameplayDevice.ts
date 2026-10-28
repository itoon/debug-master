import { onBeforeUnmount, onMounted, ref } from 'vue'
import { lightGameplayMotion, needsPortrait } from '../utils/gameplayDevice'

export function useGameplayDevice() {
  const lightMotion = ref(false)
  const rotationBlocked = ref(false)
  let touch: MediaQueryList | undefined
  let landscape: MediaQueryList | undefined
  const sync = () => {
    lightMotion.value = lightGameplayMotion()
    // Physical orientation avoids treating a portrait phone's open keyboard as landscape.
    rotationBlocked.value = needsPortrait({
      coarsePointer: lightMotion.value, userAgent: navigator.userAgent,
      platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints,
      orientation: window.screen.orientation?.type,
      angle: (window as Window & { orientation?: number }).orientation,
      viewportLandscape: landscape?.matches ?? false,
    })
  }
  onMounted(() => {
    touch = window.matchMedia('(any-pointer: coarse)')
    landscape = window.matchMedia('(orientation: landscape)')
    touch.addEventListener('change', sync)
    landscape.addEventListener('change', sync)
    window.screen.orientation?.addEventListener('change', sync)
    window.addEventListener('orientationchange', sync)
    sync()
  })
  onBeforeUnmount(() => {
    touch?.removeEventListener('change', sync)
    landscape?.removeEventListener('change', sync)
    window.screen.orientation?.removeEventListener('change', sync)
    window.removeEventListener('orientationchange', sync)
  })
  return { lightMotion, rotationBlocked }
}
