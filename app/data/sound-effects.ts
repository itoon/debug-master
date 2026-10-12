export type SoundEffect = "move" | "clear" | "wrong";
export type EffectTone = {
  frequency: number;
  endFrequency?: number;
  delay: number;
  duration: number;
  volume: number;
  wave: OscillatorType;
};

// Short, soft synthesized placeholders; no network/audio file is required.
export const soundEffects: Record<SoundEffect, readonly EffectTone[]> = {
  move: [
    { frequency: 260, endFrequency: 520, delay: 0, duration: .075, volume: .14, wave: "sine" },
  ],
  clear: [
    { frequency: 523.25, delay: 0, duration: .13, volume: .22, wave: "triangle" },
    { frequency: 659.25, delay: .09, duration: .13, volume: .22, wave: "triangle" },
    { frequency: 783.99, delay: .18, duration: .13, volume: .22, wave: "triangle" },
    { frequency: 1046.5, delay: .27, duration: .18, volume: .2, wave: "sine" },
  ],
  wrong: [
    { frequency: 220, endFrequency: 164.81, delay: 0, duration: .14, volume: .2, wave: "triangle" },
    { frequency: 164.81, endFrequency: 130.81, delay: .12, duration: .14, volume: .18, wave: "triangle" },
    { frequency: 130.81, endFrequency: 82.41, delay: .24, duration: .15, volume: .16, wave: "triangle" },
  ],
};
