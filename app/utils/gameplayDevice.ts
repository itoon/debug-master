function mobileDevice(device: { userAgent: string; platform: string; maxTouchPoints: number }): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(device.userAgent) ||
    (device.platform === 'MacIntel' && device.maxTouchPoints > 1)
}

/** Shared presentation policy: preserve animation on desktop/touch kiosks. */
export function lightGameplayMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(any-pointer: coarse)').matches && mobileDevice(navigator)
}

/** The player-only rotate requirement must not cover landscape desktop/touch kiosks. */
export function needsPortrait(device: {
  coarsePointer: boolean; userAgent: string; platform: string; maxTouchPoints: number
  orientation?: string; angle?: number; viewportLandscape: boolean
}): boolean {
  const landscape = device.orientation ? device.orientation.startsWith('landscape')
    : typeof device.angle === 'number' ? Math.abs(device.angle) === 90 : device.viewportLandscape
  return device.coarsePointer && mobileDevice(device) && landscape
}
