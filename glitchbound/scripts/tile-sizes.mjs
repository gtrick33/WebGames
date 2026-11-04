/**
 * Small copies of every game's square art, so a 60px thumbnail doesn't download an 800px picture: tile-160.webp and
 * tile-400.webp next to each tile.webp. `tileImg` (src/platform/cardImg.ts) asks for them. Run it after changing a tile.
 *
 *   node scripts/tile-sizes.mjs
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const SIZES = [
  [160, 72],
  [400, 76],
];

let made = 0;
let bytes = 0;
for (const area of ['games', 'party']) {
  for (const slug of readdirSync(join(PUBLIC, area))) {
    const tile = join(PUBLIC, area, slug, 'tile.webp');
    if (!existsSync(tile)) continue;
    for (const [width, quality] of SIZES) {
      const out = join(PUBLIC, area, slug, `tile-${width}.webp`);
      await sharp(tile).resize({ width }).webp({ quality, effort: 6 }).toFile(out);
      bytes += statSync(out).size;
      made++;
    }
  }
}
console.log(`${made} files, ${(bytes / 1024).toFixed(0)} KB`);
