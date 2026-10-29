#!/usr/bin/env node
/**
 * Builds Sigilfall's skill and talent icon atlas from the game-icons.net set (CC BY 3.0), which is kept in
 * assets/sigilfall/game-icons/ and never shipped:
 *
 *   npm pack @iconify-json/game-icons   (in assets/sigilfall/game-icons/, then unpack it there as package/)
 *   git clone --filter=blob:none --no-checkout --depth 1 https://github.com/game-icons/icons repo
 *   git -C repo ls-tree -r --name-only HEAD | grep '\.svg$' > authors.txt   (who drew each icon)
 *   node scripts/sigilfall-icons.mjs
 *
 * Only the icons render/art/iconPicks.ts names go in, as white silhouettes on a grid:
 *
 *   public/games/sigilfall/icons/icons.png   the atlas (grey + alpha: the alpha is the silhouette)
 *   public/games/sigilfall/icons/icons.json  { cell, cols, names } (an icon's cell is its index in names)
 *   src/games/sigilfall/render/art/iconVersion.ts   the build's hash (cache-busting) and the artists' names
 *   src/games/sigilfall/ICON_CREDITS.md       every icon in the atlas and who drew it
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SKILL_ICON, TALENT_ICONS } from '../src/games/sigilfall/render/art/iconPicks.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets/sigilfall/game-icons');
const OUT = path.join(ROOT, 'public/games/sigilfall/icons');
/** Atlas px per icon: the tiles are drawn at 128 px with the silhouette a little under 100 px across. */
const CELL = 96;
const COLS = 16;

const setFile = path.join(SRC, 'package/icons.json');
if (!fs.existsSync(setFile)) {
  console.error(`No icon set at ${setFile}: see the top of this script for how to fetch it.`);
  process.exit(1);
}
const set = JSON.parse(fs.readFileSync(setFile, 'utf8'));
const authorsFile = path.join(SRC, 'authors.txt');
const byName = new Map();
if (fs.existsSync(authorsFile)) {
  for (const line of fs.readFileSync(authorsFile, 'utf8').split('\n')) {
    const m = /^([^/]+)\/(?:.*\/)?([^/]+)\.svg$/.exec(line.trim());
    // (badges/ holds copies for the site's own badges, not an artist's work)
    if (m && m[1] !== 'badges' && !byName.has(m[2])) byName.set(m[2], m[1]);
  }
}

const names = [...new Set([...Object.values(SKILL_ICON), ...Object.values(TALENT_ICONS).flat()])].sort();
const missing = names.filter((n) => !set.icons[n]);
if (missing.length) {
  console.error(`Not in the set: ${missing.join(', ')}`);
  process.exit(1);
}

/** One icon as a CELL-px silhouette: white, with the shape in the alpha. */
async function cell(name) {
  const w = set.icons[name].width ?? set.width ?? 512;
  const h = set.icons[name].height ?? set.height ?? 512;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${CELL * 4}" height="${CELL * 4}" color="#fff">${set.icons[name].body}</svg>`;
  return sharp(Buffer.from(svg)).resize(CELL, CELL, { kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer();
}

const rows = Math.ceil(names.length / COLS);
const W = COLS * CELL;
const H = rows * CELL;
const atlas = Buffer.alloc(W * H * 2);
for (let i = 0; i < names.length; i++) {
  const px = await cell(names[i]);
  const ox = (i % COLS) * CELL;
  const oy = Math.floor(i / COLS) * CELL;
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const o = ((oy + y) * W + ox + x) * 2;
      atlas[o] = 255;
      atlas[o + 1] = px[(y * CELL + x) * 4 + 3];
    }
  }
}

fs.mkdirSync(OUT, { recursive: true });
const png = await sharp(atlas, { raw: { width: W, height: H, channels: 2 } }).png({ compressionLevel: 9, effort: 10, adaptiveFiltering: true }).toBuffer();
fs.writeFileSync(path.join(OUT, 'icons.png'), png);
const index = { cell: CELL, cols: COLS, names };
fs.writeFileSync(path.join(OUT, 'icons.json'), `${JSON.stringify(index)}\n`);
const version = crypto.createHash('sha256').update(png).update(JSON.stringify(index)).digest('hex').slice(0, 10);

// who drew what (CC BY 3.0 asks for it)
const AUTHOR = { lorc: 'Lorc', delapouite: 'Delapouite', skoll: 'Skoll', 'caro-asercion': 'Caro Asercion', sbed: 'Sbed', 'viscious-speed': 'Viscious Speed (CC0)', aussiesim: 'Aussiesim', darkzaitzev: 'DarkZaitzev', cathelineau: 'Cathelineau', quoting: 'Quoting', 'lord-berandas': 'Lord Berandas', faithtoken: 'Faithtoken', willdabeast: 'Willdabeast', priorblue: 'PriorBlue', 'carl-olsen': 'Carl Olsen', felbrigg: 'Felbrigg', lucasms: 'Lucas', zeromancer: 'Zeromancer (CC0)', 'john-redman': 'John Redman', 'kier-heyl': 'Kier Heyl', guard13007: 'Guard13007', rihlsul: 'Rihlsul', 'heavenly-dog': 'HeavenlyDog', andymeneely: 'Andy Meneely', 'john-colburn': 'John Colburn', irongamer: 'Irongamer', sparker: 'Sparker', 'pierre-leducq': 'Pierre Leducq', seregacthtuf: 'Seregacthtuf', zajkonur: 'Zajkonur', generalace135: 'GeneralAce135', 'various-artists': 'Various artists', starseeker: 'Starseeker', catsu: 'Catsu', 'pepijn-poolman': 'Pepijn Poolman', spencerdub: 'SpencerDub' };
const who = (n) => {
  const a = byName.get(n);
  return a ? (AUTHOR[a] ?? a) : 'unknown (see game-icons.net)';
};
const people = [...new Set(names.map(who))].sort();
const cc0 = names.filter((n) => who(n).includes('CC0')).length;
const lines = [
  '# Sigilfall icon credits',
  '',
  'The skill and talent icons are silhouettes from [game-icons.net](https://game-icons.net), under',
  `[Creative Commons BY 3.0](https://creativecommons.org/licenses/by/3.0/)${cc0 === 1 ? ' (the one marked CC0 is public domain)' : cc0 ? ` (the ${cc0} marked CC0 are public domain)` : ''}.`,
  'Sigilfall lays them on its own colored tiles. Written by `scripts/sigilfall-icons.mjs`; the picks are in',
  '`render/art/iconPicks.ts`.',
  '',
  `By ${people.join(', ')}.`,
  '',
  '| Icon | By |',
  '| --- | --- |',
  ...names.map((n) => `| ${n} | ${who(n)} |`),
  '',
];
fs.writeFileSync(path.join(ROOT, 'src/games/sigilfall/ICON_CREDITS.md'), lines.join('\n'));
fs.writeFileSync(
  path.join(ROOT, 'src/games/sigilfall/render/art/iconVersion.ts'),
  [
    '/** Written by scripts/sigilfall-icons.mjs: the build of the icon atlas in public/games/sigilfall/icons (for cache-busting). */',
    `export const ICON_VERSION = '${version}';`,
    '/** Who drew the icons in it (CC BY 3.0 asks for their names: the Settings panel\u2019s art credits). */',
    `export const ICON_AUTHORS = [${people.map((p) => `'${p}'`).join(', ')}];`,
    '',
  ].join('\n'),
);
console.log(`${names.length} icons, ${W}×${H}, ${(png.length / 1024).toFixed(0)} KB (version ${version}); by ${people.join(', ')}`);
