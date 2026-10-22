function mobileDevice(device: { userAgent: string; platform: string; maxTouchPoints: number }): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(device.userAgent) ||
    (device.platform === 'MacIntel' && device.maxTouchPoints > 1)
}

/** Shared presentation policy: preserve animation on desktop/touch kiosks. */
export function lightGameplayMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(any-pointer: coarse)').matches && mobileDevice(navigator)
}
