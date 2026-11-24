/**
 * Makes Sigilfall's save fixtures (src/games/sigilfall/NINE_PLAN.md, "The regression bar"): three heroes as the game
 * stood when the pass to 9/10 began, saved by the game's own save code, for the test that loads them in every later
 * piece (tests/sigilfall-save-fixtures.test.ts).
 *
 *   node scripts/sigilfall-save-fixtures.mjs            makes any fixture that is missing
 *   node scripts/sigilfall-save-fixtures.mjs --force    makes them all again (only ever on the commit they are of)
 *
 * The fixtures are a record of an old game: they are made once, on the commit named in their README, and never again
 * on a later one. A piece that changes quests, items or save fields leaves the files alone and shows that they still
 * load. The heroes are walked through the simulation (tests/sigilfall-save-maker.ts), which takes some minutes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'tests', 'sigilfall-saves');
const force = process.argv.includes('--force');

const MAKERS = [
  ['mid-prologue.json', 'midPrologue'],
  ['mid-act-3.json', 'midActThree'],
  ['finished-riftward.json', 'finishedInRiftward'],
];

const server = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const maker = await server.ssrLoadModule('/tests/sigilfall-save-maker.ts');
  const { SAVE_VERSION } = await server.ssrLoadModule('/src/games/sigilfall/progress/save.ts');
  mkdirSync(OUT, { recursive: true });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
  const about = existsSync(join(OUT, 'about.json')) && !force ? JSON.parse((await import('node:fs')).readFileSync(join(OUT, 'about.json'), 'utf8')) : { commit, saveVersion: SAVE_VERSION, madeAt: new Date(maker.MADE_AT).toISOString(), saves: {} };
  let wrote = 0;
  for (const [file, fn] of MAKERS) {
    if (existsSync(join(OUT, file)) && !force) continue;
    const t0 = Date.now();
    const made = maker[fn]();
    if (made.about.lost.length) throw new Error(`${file}: the walk lost its way: ${made.about.lost.join('; ')}`);
    writeFileSync(join(OUT, file), made.text);
    about.saves[file] = { ...made.about, bytes: Buffer.byteLength(made.text) };
    console.log(`${file}: ${made.about.name}, ${made.about.cls} ${made.about.level}, in ${made.about.region}, ${made.about.done} quests done, ${made.about.sigils} sigils, stone ${made.about.keystone}, ${Buffer.byteLength(made.text)} bytes (${Math.round((Date.now() - t0) / 1000)} s)`);
    wrote++;
  }
  if (wrote) writeFileSync(join(OUT, 'about.json'), `${JSON.stringify(about, null, 2)}\n`);
  console.log(wrote ? `${wrote} save(s) written to ${OUT}` : 'Every fixture is there already (--force makes them again).');
} finally {
  await server.close();
}
