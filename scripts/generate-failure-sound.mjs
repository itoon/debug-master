// Rebuild the local failure cue: node scripts/generate-failure-sound.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const sampleRate = 22050;
const duration = .52;
const samples = Math.ceil(sampleRate * duration);
const wav = Buffer.alloc(44 + samples * 2);
wav.write("RIFF", 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); // PCM
wav.writeUInt16LE(1, 22); // mono
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(samples * 2, 40);

const notes = [392, 329.63, 261.63];
for (let index = 0; index < samples; index += 1) {
  const time = index / sampleRate;
  const note = Math.floor(time / .17);
  const localTime = time - note * .17;
  let value = 0;
  if (note < notes.length && localTime < .16) {
    const envelope = Math.min(1, localTime / .006, (.16 - localTime) / .035);
    const phase = 2 * Math.PI * notes[note] * localTime;
    // A buzzer with audible upper harmonics, distinct from the clear chime.
    value = .68 * envelope * (Math.sin(phase) + .3 * Math.sin(phase * 3)) / 1.3;
  }
  wav.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
}

const target = new URL("../app/assets/sounds/", import.meta.url);
mkdirSync(target, { recursive: true });
writeFileSync(new URL("codi-failed.wav", target), wav);
