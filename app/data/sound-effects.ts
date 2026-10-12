export type SoundEffect = "move" | "clear" | "wrong";
export type EffectTone = {
  frequency: number;
  endFrequency?: number;
  delay: number;
  duration: number;
  volume: number;
  wave: OscillatorType;
  /** Keep the tone audible before its fade; omitted preserves the old envelope. */
  release?: number;
};

// Synthesized placeholders; mid-range move/retry tones work on small speakers.
export const soundEffects: Record<SoundEffect, readonly EffectTone[]> = {
  move: [
    { frequency: 660, endFrequency: 440, delay: 0, duration: .14, volume: .28, wave: "triangle", release: .055 },
  ],
  clear: [
    { frequency: 523.25, delay: 0, duration: .13, volume: .22, wave: "triangle" },
    { frequency: 659.25, delay: .09, duration: .13, volume: .22, wave: "triangle" },
    { frequency: 783.99, delay: .18, duration: .13, volume: .22, wave: "triangle" },
    { frequency: 1046.5, delay: .27, duration: .18, volume: .2, wave: "sine" },
  ],
  wrong: [
    { frequency: 440, endFrequency: 349.23, delay: 0, duration: .16, volume: .28, wave: "triangle", release: .07 },
    { frequency: 349.23, endFrequency: 293.66, delay: .13, duration: .16, volume: .28, wave: "triangle", release: .07 },
    { frequency: 293.66, endFrequency: 261.63, delay: .26, duration: .16, volume: .26, wave: "triangle", release: .07 },
  ],
};
