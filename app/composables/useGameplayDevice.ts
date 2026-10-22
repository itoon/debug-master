import { onBeforeUnmount, onMounted, ref } from 'vue'
import { lightGameplayMotion } from '../utils/gameplayDevice'

export function useGameplayDevice() {
  const lightMotion = ref(false)
  let touch: MediaQueryList | undefined
  const sync = () => { lightMotion.value = lightGameplayMotion() }
  onMounted(() => {
    touch = window.matchMedia('(any-pointer: coarse)')
    touch.addEventListener('change', sync)
    sync()
  })
  onBeforeUnmount(() => touch?.removeEventListener('change', sync))
  return { lightMotion }
}
