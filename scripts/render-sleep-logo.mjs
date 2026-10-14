// Offline asset QA: render vector paths at the reference PNG's native size.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
const require = createRequire(import.meta.url);
const [sharpModule, source, output] = process.argv.slice(2);
if (!sharpModule || !source || !output) throw new Error('Usage: node render-sleep-logo.mjs <sharp-module> <svg> <png>');
const sharp = require(sharpModule);
await mkdir(dirname(output), { recursive: true });
await sharp(source, { density: 72, limitInputPixels: false }).png().toFile(output);
console.log(output);
