/**
 * Freezes Sigilfall's generated lands to map files (the owner's call of 2026-11-19: every land hand-built,
 * POLISH_PLAN.md). Each live land the generator makes is written to src/games/sigilfall/data/maps/<land>.json exactly as
 * the generator makes it now: its rows, one to a line, and everything placed on them, one to a line, in the order the
 * map is built from (scripts/sigilfall-landmap-file.ts). From then on the file is the land (data/landmaps.ts), worked by hand.
 *
 *   node scripts/sigilfall-freeze-lands.mjs                   (every live land that has no file yet)
 *   node scripts/sigilfall-freeze-lands.mjs --force <land>    (makes that land's file again from the generator, losing
 *                                                             whatever was done to it by hand)
 *
 * It loads the game's data through Vite, as the dev server does.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';

const root = new URL('..', import.meta.url).pathname;
const OUT = join(root, 'src/games/sigilfall/data/maps');
const force = process.argv.includes('--force') ? process.argv[process.argv.indexOf('--force') + 1] : null;

/** Whether a value comes back the same from JSON: no NaN or Infinity, no functions, no holes, only plain objects. */
function lossless(v, path) {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`${path} is ${v}, which JSON can't keep`);
    return;
  }
  if (Array.isArray(v)) {
    v.forEach((x, i) => {
      if (x === undefined) throw new Error(`${path}[${i}] is undefined, which JSON turns into null`);
      lossless(x, `${path}[${i}]`);
    });
    return;
  }
  if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    for (const [k, x] of Object.entries(v)) if (x !== undefined) lossless(x, `${path}.${k}`);
    return;
  }
  throw new Error(`${path} is a ${typeof v}, which JSON can't keep`);
}

const server = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const { REGION_IDS } = await server.ssrLoadModule('/src/games/sigilfall/data/regions.ts');
  const { generatedLand } = await server.ssrLoadModule('/src/games/sigilfall/data/zonegen.ts');
  const { landMapText } = await server.ssrLoadModule('/scripts/sigilfall-landmap-file.ts');
  mkdirSync(OUT, { recursive: true });
  let wrote = 0;
  for (const id of REGION_IDS) {
    const file = join(OUT, `${id}.json`);
    if (existsSync(file) && force !== id) continue;
    // (a land laid out by hand already, the Whisperwood's drawn map, has nothing to freeze)
    const land = generatedLand(id);
    if (!land) continue;
    lossless(land, id);
    writeFileSync(file, landMapText(land));
    console.log(`${id}: ${land.map[0].length}×${land.map.length}, ${land.placed.length} placed`);
    wrote++;
  }
  console.log(wrote ? `${wrote} land(s) frozen to ${OUT}` : 'Every live land has its file already.');
} finally {
  await server.close();
}
