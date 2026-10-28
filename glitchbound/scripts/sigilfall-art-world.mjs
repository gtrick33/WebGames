/**
 * The story pieces Royal Keep has nothing for, called by sigilfall-art.mjs (ASSET_AUDIT.md, VISUAL_BIBLE.md):
 *
 *   props-gc.png/.json     Gloomvault's skulls, bones, coffin, cage, skull banner, altar and crystals, each with
 *                          its ground point, at the world scale (`k: 4`, 4 atlas px per world px).
 *
 * Everything else in the outdoor world is Royal Keep's (rk-*), built by sigilfall-art.mjs. Nothing else from the
 * Worlds bundle or the CraftPix packs ships.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/** The only pieces taken from Gloomvault (render/worldScenery.ts and render/art/recipes.ts name them). */
const GC = ['skulls', 'scattered_bones', 'stone_coffin', 'iron_cage', 'skull_banner', 'stone_altar', 'cyan_crystals'];

export async function buildWorld({ SRC, write, json, pack, report }) {
  const p = 'Gloomvault_Crypt';
  const cat = JSON.parse(fs.readFileSync(path.join(SRC, p, 'Data/catalog.json'), 'utf8'));
  const entries = [];
  for (const group of ['props', 'buildings']) {
    for (const [name, def] of Object.entries(cat[group])) {
      if (!GC.includes(name)) continue;
      const file = path.join(SRC, p, def.file.replace('{size}', 'Game'));
      if (!fs.existsSync(file)) continue;
      const meta = await sharp(file).metadata();
      const pivot = def.sizes?.Game?.pivot ?? [Math.round(meta.width / 2), meta.height];
      entries.push({ key: name, buf: await sharp(file).png().toBuffer(), w: meta.width, h: meta.height, o: pivot });
    }
  }
  const missing = GC.filter((k) => !entries.some((e) => e.key === k));
  if (missing.length) throw new Error(`Gloomvault pieces not found: ${missing.join(', ')}`);
  const packed = await pack(entries, 1024);
  write('props-gc.png', packed.buf);
  report.push(['props-gc.png', packed.buf.length]);
  const props = {};
  for (const e of entries) props[e.key] = { r: packed.rects[e.key], o: e.o };
  json('props-gc.json', { k: 4, props });
}
