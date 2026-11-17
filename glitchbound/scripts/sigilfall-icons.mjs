#!/usr/bin/env node
/**
 * Builds Sigilfall's skill and talent icon atlas from the pack Nasha's Lumenfall, Skill & Spell Icons Vol. 1. The
 * pack's license forbids sharing its files as assets, so it stays on this machine, in assets/sigilfall/lumenfall/
 * (copy its sprites/, manifest.json and LICENSE.txt there), and only the icons the game uses ship, as one atlas:
 *
 *   node scripts/sigilfall-icons.mjs
 *
 *   public/games/sigilfall/icons/icons.png   the atlas: only the icons render/art/iconPicks.ts names
 *   public/games/sigilfall/icons/icons.json  { cell, cols, names } (an icon's cell is its index in names)
 *   src/games/sigilfall/render/art/iconVersion.ts   the build's hash (cache-busting)
 *   src/games/sigilfall/ICON_CREDITS.md       where the icons come from
 *
 * On a machine without the pack (a cloud session), it can still drop icons that fell out of use: when every icon the
 * game names is in the atlas already, the atlas is packed again from its own cells. An icon that isn't in it needs the
 * pack.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SKILL_ICON, TALENT_ICONS, VIGIL_ICON } from '../src/games/sigilfall/render/art/iconPicks.ts';
import { vigilIcons } from '../src/games/sigilfall/vigil/kit.ts';
import { ringIcons } from '../src/games/sigilfall/arena/abilities.ts';
import { talentIcons } from '../src/games/sigilfall/arena/talents.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets/sigilfall/lumenfall');
const OUT = path.join(ROOT, 'public/games/sigilfall/icons');
/** The pack's own size: pixel art, so it is never resampled here. */
const CELL = 60;
const COLS = 24;

const manifestFile = path.join(SRC, 'manifest.json');
const havePack = fs.existsSync(manifestFile);
// (without the pack: the atlas as it stands, to be packed again from its own cells)
const old = !havePack && fs.existsSync(path.join(OUT, 'icons.json')) && fs.existsSync(path.join(OUT, 'icons.png')) ? { ...JSON.parse(fs.readFileSync(path.join(OUT, 'icons.json'), 'utf8')), png: fs.readFileSync(path.join(OUT, 'icons.png')) } : null;
if (!havePack && !old) {
  console.error(`No icon pack at ${SRC}: see the top of this script.`);
  process.exit(1);
}
const category = havePack ? new Map(JSON.parse(fs.readFileSync(manifestFile, 'utf8')).map((m) => [m.name, m.category])) : null;

// (the Ring's challenges name icons too; arena/record.ts is read as text, since it imports what node alone can't resolve)
const challengeIcons = [...fs.readFileSync(path.join(ROOT, 'src/games/sigilfall/arena/record.ts'), 'utf8').matchAll(/\bicon: '([a-z0-9_]+)'/g)].map((m) => m[1]);
const names = [...new Set([...Object.values(SKILL_ICON), ...Object.values(TALENT_ICONS).flat(), ...Object.values(VIGIL_ICON), ...vigilIcons(), ...ringIcons(), ...talentIcons(), ...challengeIcons])].sort();
const missing = names.filter((n) => (category ? !category.has(n) : !old.names.includes(n)));
if (missing.length) {
  console.error(category ? `Not in the pack: ${missing.join(', ')}` : `Not in the atlas, and the pack isn't on this machine (${SRC}): ${missing.join(', ')}`);
  process.exit(1);
}
if (old && (old.cell !== CELL || old.cols !== COLS)) {
  console.error('The atlas was built at another size: it needs the pack to be built again.');
  process.exit(1);
}

/** An icon's picture: from the pack, or cut out of the atlas as it stands. */
const tileOf = (name) => {
  if (category) return sharp(path.join(SRC, 'sprites', category.get(name), `${name}.png`)).resize(CELL, CELL, { kernel: 'nearest', fit: 'fill' }).ensureAlpha().png().toBuffer();
  const j = old.names.indexOf(name);
  return sharp(old.png).extract({ left: (j % COLS) * CELL, top: Math.floor(j / COLS) * CELL, width: CELL, height: CELL }).ensureAlpha().png().toBuffer();
};
const rows = Math.ceil(names.length / COLS);
const tiles = await Promise.all(
  names.map(async (name, i) => ({
    input: await tileOf(name),
    left: (i % COLS) * CELL,
    top: Math.floor(i / COLS) * CELL,
  })),
);
fs.mkdirSync(OUT, { recursive: true });
const png = await sharp({ create: { width: COLS * CELL, height: rows * CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(tiles)
  .png({ compressionLevel: 9, palette: false })
  .toBuffer();
fs.writeFileSync(path.join(OUT, 'icons.png'), png);
fs.writeFileSync(path.join(OUT, 'icons.json'), JSON.stringify({ cell: CELL, cols: COLS, names }));

const version = crypto.createHash('sha1').update(png).digest('hex').slice(0, 10);
fs.writeFileSync(
  path.join(ROOT, 'src/games/sigilfall/render/art/iconVersion.ts'),
  `/** Written by scripts/sigilfall-icons.mjs: the atlas's hash, for cache-busting. */\nexport const ICON_VERSION = '${version}';\n`,
);
fs.writeFileSync(
  path.join(ROOT, 'src/games/sigilfall/ICON_CREDITS.md'),
  `# Sigilfall icon credits

The skill, talent and Vigil icons are from **Nasha's Lumenfall: Skill & Spell Icons Vol. 1** by nanasha
(https://nanasha.itch.io/nashas-lumenfall-skill-spell-icons-vol-1), bought by the owner. The license allows them in
any game, sold or not, as part of the game; it forbids resharing them as assets, so the pack itself stays off the
repository (assets/sigilfall/lumenfall/, ignored) and only the atlas of the ${names.length} icons in use ships. Credit is not
required and is given in the game's Settings anyway.

The store page discloses AI-assisted graphics (see LEGAL_REVIEW.md). Written by \`scripts/sigilfall-icons.mjs\`; the
picks are in \`render/art/iconPicks.ts\`.
`,
);
console.log(`${names.length} icons, ${(png.length / 1024).toFixed(0)} KB, version ${version}`);
