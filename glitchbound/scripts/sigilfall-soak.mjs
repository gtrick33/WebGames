/**
 * Whether Sigilfall holds on to what it no longer shows (NINE_PLAN.md piece 7: memory over a long sitting).
 *
 *   node scripts/sigilfall-soak.mjs [--size phone|desktop] [--rounds 3] [--secs 5] [--url http://localhost:5173]
 *
 * A review hero is jumped through one beat of every land of the story, round after round, the way a long sitting
 * crosses them. After each stop the browser is made to collect its garbage and three numbers are read: the models the
 * graphics card holds (geometries), its pictures (textures), and the page's own memory (the JavaScript heap). The
 * first round fills what the game keeps on purpose (a land's models once loaded, the sounds); from the second round
 * on, the same stop should cost the same. It fails if, between the second round and the last, the stops together hold
 * over a twentieth more geometries or textures, or over a fifth more heap. Counts and bytes mean the same on any
 * machine. Writes .cache/soak/report.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, '.cache', 'soak');

const args = process.argv.slice(2);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('This script needs Playwright: npm i --no-save playwright');
  process.exit(1);
}

const SIZES = {
  desktop: { viewport: { width: 1440, height: 900 }, touch: false },
  phone: { viewport: { width: 844, height: 390 }, touch: true },
};

async function devServer() {
  const url = value('url');
  if (url) return { url: url.replace(/\/+$/, ''), close: async () => {} };
  const { createServer } = await import('vite');
  const server = await createServer({ root: ROOT, logLevel: 'silent', server: { port: 5196, strictPort: false } });
  await server.listen();
  return { url: (server.resolvedUrls?.local?.[0] ?? 'http://localhost:5196/').replace(/\/+$/, ''), close: () => server.close() };
}

async function run() {
  const size = SIZES[value('size') ?? 'phone'];
  const rounds = Math.max(3, Number(value('rounds') ?? 3));
  const secs = Number(value('secs') ?? 5);
  mkdirSync(OUT, { recursive: true });
  const server = await devServer();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const table = [];
  try {
    const context = await browser.newContext({ viewport: size.viewport, hasTouch: size.touch, isMobile: size.touch, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${server.url}/sigilfall?play=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!globalThis.__rb?.ui, null, { timeout: 120_000 });
    await page.evaluate(() => {
      const e = globalThis.__rb;
      e.setTutorial(false);
      if (!e.heroes().some(Boolean)) e.createHero(0, 'warrior', 'Soak', 'm', undefined, false);
      else e.play(0);
    });
    await page.waitForFunction(() => globalThis.__rb.ui.screen === 'game' && !!globalThis.__rb.world, null, { timeout: 120_000 });
    // one beat of every land the story has a review preset in
    const stops = await page.evaluate(async () => {
      const { PRESETS } = await import('/src/games/sigilfall/progress/presets.ts');
      const seen = new Set();
      return PRESETS.filter((p) => !seen.has(p.region) && seen.add(p.region)).map((p) => p.id);
    });
    console.log(`${stops.length} lands a round, ${rounds} rounds, ${secs} s a stop`);
    for (let round = 1; round <= rounds; round++) {
      const row = [];
      for (const id of stops) {
        await page.evaluate((pid) => globalThis.__rb.usePreset(pid), id);
        await page.waitForFunction(() => !globalThis.__rb.renderer.waiting, null, { timeout: 90_000 }).catch(() => undefined);
        for (let t = 0; t < secs; t++) {
          await page.evaluate(() => {
            const e = globalThis.__rb;
            if (e.ui.tip) e.skipTips();
            if (e.ui.story) e.closeStory();
            if (e.ui.dialogue) e.closeDialogue();
            if (e.world?.scene) e.skipScene();
            if (e.world) e.world.player.iframe = 99;
          });
          await page.waitForTimeout(1000);
        }
        await cdp.send('HeapProfiler.collectGarbage');
        const heap = (await cdp.send('Runtime.getHeapUsage')).usedSize;
        const gl = await page.evaluate(() => {
          const m = globalThis.__rb.renderer.stage?.gl.info.memory;
          return m ? { geometries: m.geometries, textures: m.textures } : null;
        });
        row.push({ id, heap, geometries: gl?.geometries ?? 0, textures: gl?.textures ?? 0 });
      }
      const sum = (k) => row.reduce((a, r) => a + r[k], 0);
      const most = (k) => Math.max(...row.map((r) => r[k]));
      table.push({ round, stops: row, heapMost: most('heap'), heapSum: sum('heap'), geometries: sum('geometries'), textures: sum('textures') });
      console.log(`round ${round}: heap ${(most('heap') / 1_048_576).toFixed(0)} MB at most, ${(sum('heap') / row.length / 1_048_576).toFixed(0)} MB a stop; geometries ${sum('geometries')}, textures ${sum('textures')} over the round`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  const second = table[1];
  const last = table[table.length - 1];
  const grew = (k) => last[k] / Math.max(1, second[k]) - 1;
  const found = [];
  if (grew('geometries') > 0.05) found.push(`geometries grew ${(grew('geometries') * 100).toFixed(0)}% from round 2 to round ${last.round}`);
  if (grew('textures') > 0.05) found.push(`textures grew ${(grew('textures') * 100).toFixed(0)}% from round 2 to round ${last.round}`);
  if (grew('heapSum') > 0.2) found.push(`the heap grew ${(grew('heapSum') * 100).toFixed(0)}% from round 2 to round ${last.round}`);
  for (const e of [...new Set(errors)]) found.push(`the page reported: ${e.slice(0, 160)}`);
  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ size: value('size') ?? 'phone', rounds, secs, table, found }, null, 2));
  console.log(found.length ? `\n${found.join('\n')}` : '\nNothing is held on to from one round to the next.');
  process.exitCode = found.length ? 1 : 0;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
