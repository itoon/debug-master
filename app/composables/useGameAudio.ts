import { onBeforeUnmount, ref } from "vue";
import { soundEffects, UI_SOUND_EFFECTS, type SoundEffect } from "../data/sound-effects";
import failureSound from "~/assets/sounds/codi-failed.wav";
import clickSound from "~/assets/sounds/pops-4.mp3";

/** Browser audio belongs to presentation; gameplay never waits for playback. */
export function useGameAudio() {
  const enabled = ref(true);
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let generation = 0;
  let disposed = false;
  const activeVoices = new Set<OscillatorNode | AudioBufferSourceNode>();
  const fileBuffers = new Map<"wrong" | "click", Promise<AudioBuffer | undefined>>();
  const soundFiles = { wrong: failureSound, click: clickSound };

  function reportAudioError(action: string, error: unknown): void {
    console.warn(`[Debug Master audio] ${action}`, error);
  }

  function ensureContext(): AudioContext | undefined {
    if (disposed || !enabled.value || typeof window === "undefined") return;
    if (context) return context;
    try {
      const AudioCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      context = new AudioCtor();
      master = context.createGain();
      master.gain.value = .28;
      master.connect(context.destination);
      return context;
    } catch (error) {
      // Unsupported/blocked audio must not interrupt gameplay.
      reportAudioError("create context", error);
      return;
    }
  }

  function unlockAudio(): void {
    const audio = ensureContext();
    if (audio?.state === "suspended") void audio.resume().catch((error) => reportAudioError("unlock", error));
    if (audio) {
      void loadFileSound("wrong", audio);
      void loadFileSound("click", audio);
    }
  }

  function loadFileSound(effect: "wrong" | "click", audio: AudioContext): Promise<AudioBuffer | undefined> {
    let buffer = fileBuffers.get(effect);
    if (!buffer) {
      buffer = fetch(soundFiles[effect])
        .then((response) => {
          if (!response.ok) throw new Error(`${effect} sound HTTP ${response.status}`);
          return response.arrayBuffer();
        })
        .then((data) => audio.decodeAudioData(data))
        .catch((error) => {
          reportAudioError(`load ${effect} sound`, error);
          fileBuffers.delete(effect); // A later player gesture can retry loading.
          return undefined;
        });
      fileBuffers.set(effect, buffer);
    }
    return buffer;
  }

  function playBuffer(buffer: AudioBuffer, audio: AudioContext): void {
    if (!master || audio.state !== "running") return;
    const voice = audio.createBufferSource();
    voice.buffer = buffer;
    voice.connect(master);
    activeVoices.add(voice);
    voice.onended = () => { voice.disconnect(); activeVoices.delete(voice); };
    voice.start();
  }

  function stopSounds(): void {
    generation += 1; // Invalidate playback queued behind an async resume.
    for (const voice of activeVoices) {
      try { voice.stop(); } catch { /* Already stopped or context closed. */ }
    }
    activeVoices.clear();
  }

  function schedule(effect: SoundEffect, audio: AudioContext): void {
    if (!master || audio.state !== "running") return;
    for (const tone of soundEffects[effect]) {
      const start = audio.currentTime + tone.delay;
      const end = start + tone.duration;
      const voice = audio.createOscillator();
      const envelope = audio.createGain();
      voice.type = tone.wave;
      voice.frequency.setValueAtTime(tone.frequency, start);
      if (tone.endFrequency) voice.frequency.exponentialRampToValueAtTime(tone.endFrequency, end);
      envelope.gain.setValueAtTime(.0001, start);
      envelope.gain.linearRampToValueAtTime(tone.volume, start + .008);
      if (tone.release !== undefined) {
        // The old immediate exponential fade made brief step/bass cues faint.
        // Sustain move/retry tones, then fade; clear keeps its original shape.
        const releaseStart = Math.max(start + .008, end - tone.release);
        envelope.gain.setValueAtTime(tone.volume, releaseStart);
      }
      envelope.gain.exponentialRampToValueAtTime(.0001, end);
      voice.connect(envelope);
      envelope.connect(master);
      activeVoices.add(voice);
      voice.onended = () => { voice.disconnect(); envelope.disconnect(); activeVoices.delete(voice); };
      voice.start(start);
      voice.stop(end + .01);
    }
  }

  function playSound(effect: SoundEffect): void {
    if (!enabled.value || typeof document === "undefined" || document.hidden) return;
    // UI taps and selection/slide cues may play alongside other sounds.
    // Gameplay failure/clear/completion retains its existing interruption rule.
    if (effect !== "move" && !(UI_SOUND_EFFECTS as readonly SoundEffect[]).includes(effect)) stopSounds();
    const audio = ensureContext();
    if (!audio) return;
    const currentGeneration = generation;
    const canPlay = () => !disposed && enabled.value && !document.hidden && generation === currentGeneration;
    const play = () => {
      if (!canPlay()) return;
      if (effect === "wrong" || effect === "click") {
        void loadFileSound(effect, audio).then((buffer) => {
          if (!canPlay()) return;
          try {
            if (buffer) playBuffer(buffer, audio);
            else schedule(effect, audio); // Keep a fallback if the local asset cannot load.
          } catch (error) { reportAudioError(`play ${effect} sound`, error); }
        });
        return;
      }
      try { schedule(effect, audio); } catch (error) { reportAudioError(`play ${effect} (${audio.state})`, error); }
    };
    if (audio.state === "running") play();
    else if (audio.state === "suspended") void audio.resume().then(play).catch((error) => reportAudioError(`resume ${effect}`, error));
  }

  function toggleSound(): void {
    enabled.value = !enabled.value;
    if (enabled.value) unlockAudio();
    else stopSounds();
  }

  onBeforeUnmount(() => {
    disposed = true;
    stopSounds();
    if (context && context.state !== "closed") void context.close().catch(() => {});
  });

  return { enabled, unlockAudio, playSound, stopSounds, toggleSound };
}
