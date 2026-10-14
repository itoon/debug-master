import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

// Asset rendering only; does not launch the game or change its source images.
const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; };
const require = createRequire(import.meta.url);
const sharp = require(option('--sharp-module', 'sharp'));
const output = path.resolve(option('--out', '.cache/codi-svg/rendered'));
const scale = Number(option('--scale', '1'));
if (!Number.isInteger(scale) || scale < 1 || scale > 8) throw new Error('Scale must be an integer from 1 to 8');
await fs.mkdir(output, { recursive: true });
const poses = ['down', 'up', 'left', 'right', 'failed', 'win'];
for (const pose of poses) {
  const source = path.resolve(`app/assets/sprites/codi-${pose}.svg`);
  await sharp(source, { density: 96 * scale }).resize(128 * scale, 128 * scale).png().toFile(path.join(output, `codi-${pose}.png`));
}
console.log(`Rendered ${poses.length} SVG poses at ${128 * scale}×${128 * scale} to ${output}`);
