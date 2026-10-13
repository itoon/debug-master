export const UI_SOUND_EFFECTS = ["click", "select", "transition", "transitionBack", "popup"] as const;
export type UiSoundEffect = (typeof UI_SOUND_EFFECTS)[number];
export type SoundEffect = "move" | "clear" | "wrong" | "complete" | UiSoundEffect;
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
  // A dry two-layer tap, distinct from movement tones and melodic UI cues.
  click: [
    { frequency: 2200, endFrequency: 1400, delay: 0, duration: .032, volume: .09, wave: "square", release: .016 },
    { frequency: 180, endFrequency: 120, delay: 0, duration: .055, volume: .16, wave: "sine", release: .025 },
  ],
  select: [
    { frequency: 880, endFrequency: 1046.5, delay: 0, duration: .09, volume: .18, wave: "sine", release: .04 },
  ],
  transition: [
    { frequency: 440, endFrequency: 880, delay: .025, duration: .26, volume: .1, wave: "sine", release: .09 },
  ],
  transitionBack: [
    { frequency: 880, endFrequency: 440, delay: 0, duration: .26, volume: .1, wave: "sine", release: .09 },
  ],
  popup: [
    { frequency: 350, endFrequency: 900, delay: 0, duration: .11, volume: .16, wave: "sine", release: .05 },
    { frequency: 760, endFrequency: 500, delay: .11, duration: .16, volume: .13, wave: "triangle", release: .08 },
    { frequency: 600, endFrequency: 660, delay: .26, duration: .11, volume: .09, wave: "sine", release: .06 },
  ],
  complete: [
    { frequency: 523.25, delay: 0, duration: .18, volume: .18, wave: "triangle" },
    { frequency: 659.25, delay: .12, duration: .18, volume: .18, wave: "triangle" },
    { frequency: 783.99, delay: .24, duration: .22, volume: .18, wave: "triangle" },
    { frequency: 1046.5, delay: .4, duration: .4, volume: .16, wave: "sine" },
  ],
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
