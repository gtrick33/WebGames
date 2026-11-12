/**
 * Sigilfall's pictures on the site, all from one scene rendered by the game itself (src/games/sigilfall/render3d/
 * keyArt.ts has the scene: all eight heroes before the rose window, the Gloamknight on the dais, two drakes):
 *
 *   key-art-2400 / key-art-1600 (.avif, .webp)   the home page's banner on a wide screen
 *   key-art-phone (.avif, .webp)                 the banner on a phone
 *   tile.webp (then tile-160, tile-400)          the game's square card
 *   wide.webp                                    the game's wide card
 *   og.jpg                                       the picture a shared link carries
 *
 * The scene is drawn in a browser, so it needs the dev server and Playwright (not a dependency of the site:
 * `npm i --no-save playwright` once, or use a machine that has it):
 *
 *   npm run dev                                   (in another terminal)
 *   node scripts/sigilfall-key-art.mjs [http://localhost:5173]
 *   node scripts/tile-sizes.mjs
 *
 * Change who stands where in keyArt.ts, run this, and every picture follows.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'public', 'games', 'sigilfall');
const base = (process.argv[2] ?? 'http://localhost:5173').replace(/\/+$/, '');

// (required, not imported: a Playwright installed for the whole machine is found that way too)
let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('This script needs Playwright: npm i --no-save playwright');
  process.exit(1);
}

/** The two renders: wide (2400 × 990) and tall (2000 × 1600), as PNG buffers. */
async function render() {
  // (software drawing works too: it is a still, and a slow one is fine)
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page.goto(`${base}/sigilfall?play=1`, { waitUntil: 'networkidle' }).catch(() => undefined);
  await page.waitForFunction(() => !!globalThis.__rbKeyArt, null, { timeout: 120_000 });
  const out = {};
  for (const name of ['wide', 'tall']) {
    const url = await page.evaluate((n) => globalThis.__rbKeyArt(n), name);
    out[name] = Buffer.from(url.split(',')[1], 'base64');
    console.log(`rendered ${name}`);
  }
  await browser.close();
  return out;
}

const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
const NIGHT = '#07050d';

const { wide, tall } = await render();

// ---- the banner on a wide screen: the words stand on its left, so the hall goes to night there
const shade = svg(
  2400,
  990,
  `<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${NIGHT}" stop-opacity="0.96"/><stop offset="0.2" stop-color="${NIGHT}" stop-opacity="0.86"/><stop offset="0.42" stop-color="${NIGHT}" stop-opacity="0"/></linearGradient></defs><rect width="2400" height="990" fill="url(#g)"/>`,
);
const banner = await sharp(wide).composite([{ input: shade }]).png().toBuffer();
await sharp(banner).avif({ quality: 50, effort: 7 }).toFile(join(OUT, 'key-art-2400.avif'));
await sharp(banner).webp({ quality: 74, effort: 6 }).toFile(join(OUT, 'key-art-2400.webp'));
await sharp(banner).resize({ width: 1600 }).avif({ quality: 50, effort: 7 }).toFile(join(OUT, 'key-art-1600.avif'));
await sharp(banner).resize({ width: 1600 }).webp({ quality: 74, effort: 6 }).toFile(join(OUT, 'key-art-1600.webp'));

// ---- the banner on a phone: everyone, close
await sharp(tall).resize({ width: 1000 }).avif({ quality: 50, effort: 7 }).toFile(join(OUT, 'key-art-phone.avif'));
await sharp(tall).resize({ width: 1000 }).webp({ quality: 76, effort: 6 }).toFile(join(OUT, 'key-art-phone.webp'));

// ---- the wide card: the group alone, with nothing over it
await sharp(wide).extract({ left: 700, top: 150, width: 1700, height: 680 }).resize(1200, 480).webp({ quality: 80, effort: 6 }).toFile(join(OUT, 'wide.webp'));

// ---- the square card: the middle of the tall render, the wordmark along its foot
const logo = readFileSync(join(OUT, 'logo.svg'));
const square = await sharp(tall).extract({ left: 250, top: 100, width: 1500, height: 1500 }).resize(800, 800).png().toBuffer();
const foot = svg(800, 800, `<defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0.6" stop-color="${NIGHT}" stop-opacity="0"/><stop offset="0.82" stop-color="${NIGHT}" stop-opacity="0.9"/><stop offset="1" stop-color="${NIGHT}" stop-opacity="0.97"/></linearGradient></defs><rect width="800" height="800" fill="url(#g)"/>`);
const mark = await sharp(logo, { density: 300 }).resize({ width: 560 }).png().toBuffer();
const markH = (await sharp(mark).metadata()).height;
await sharp(square)
  .composite([{ input: foot }, { input: mark, left: 120, top: 800 - markH - 26 }])
  .webp({ quality: 84, effort: 6 })
  .toFile(join(OUT, 'tile.webp'));

// ---- the picture a shared link carries: the wordmark and a line on the left, the group on the right, a gold rule
// (the tall render, whole, against the right edge: everyone fits beside the words, none of them under the words)
const group = await sharp(tall).resize({ height: 630 }).png().toBuffer();
const groupW = (await sharp(group).metadata()).width;
const scene = await sharp({ create: { width: 1200, height: 630, channels: 3, background: NIGHT } })
  .composite([{ input: group, left: 1200 - groupW, top: 0 }])
  .png()
  .toBuffer();
const side = svg(
  1200,
  630,
  `<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${NIGHT}" stop-opacity="1"/><stop offset="0.35" stop-color="${NIGHT}" stop-opacity="1"/><stop offset="0.47" stop-color="${NIGHT}" stop-opacity="0"/></linearGradient></defs>` +
    `<rect width="1200" height="630" fill="url(#g)"/>` +
    `<text x="46" y="356" font-family="Georgia, 'Liberation Serif', 'DejaVu Serif', serif" font-style="italic" font-weight="700" font-size="34" fill="#f4ecd8">A free fantasy RPG</text>` +
    `<text x="46" y="400" font-family="Georgia, 'Liberation Serif', 'DejaVu Serif', serif" font-style="italic" font-weight="700" font-size="34" fill="#f4ecd8">in your browser</text>` +
    `<rect y="622" width="1200" height="8" fill="#f2c14e"/>`,
);
const ogMark = await sharp(logo, { density: 300 }).resize({ width: 440 }).png().toBuffer();
await sharp(scene)
  .composite([{ input: side }, { input: ogMark, left: 40, top: 196 }])
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(join(OUT, 'og.jpg'));

console.log('written to public/games/sigilfall: now run `node scripts/tile-sizes.mjs`');
