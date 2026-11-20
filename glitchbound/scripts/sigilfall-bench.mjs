/**
 * Sigilfall's frame cost in its heaviest battles (POLISH_PLAN.md piece 27).
 *
 *   node scripts/sigilfall-bench.mjs [--size desktop|phone] [--preset id] [--secs 8] [--url http://localhost:5173]
 *
 * Opens the game with the frame-cost meter on (?perf: ui/PerfMeter.tsx), jumps to each of the story's biggest fights,
 * keeps the hero standing (nothing is fought for them) and reads the meter once a second. What it prints is per fight:
 * the draw calls and triangles of a frame (the most and the middle of the run), the effects and foes at once, and the
 * frames a second. The calls and triangles go by what is drawn, so they mean the same on any machine; the frames a
 * second are this machine's (a browser drawing in software here runs far slower than any phone). Writes
 * .cache/bench/report.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, '.cache', 'bench');

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

/** The story's biggest fights: sieges, raids and marches, with the most foes and effects at once. */
const HEAVY = ['prologue-raid', 'hearth-ram', 'night-of-knives', 'the-sortie', 'fireships', 'every-banner', 'siege-mages', 'keep-the-door', 'last-march'];

async function devServer() {
  const url = value('url');
  if (url) return { url: url.replace(/\/+$/, ''), close: async () => {} };
  const { createServer } = await import('vite');
  const server = await createServer({ root: ROOT, logLevel: 'silent', server: { port: 5198, strictPort: false } });
  await server.listen();
  return { url: (server.resolvedUrls?.local?.[0] ?? 'http://localhost:5198/').replace(/\/+$/, ''), close: () => server.close() };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

async function run() {
  const size = SIZES[value('size') ?? 'desktop'];
  const secs = Number(value('secs') ?? 8);
  const only = value('preset');
  mkdirSync(OUT, { recursive: true });
  const server = await devServer();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const report = [];
  try {
    const context = await browser.newContext({ viewport: size.viewport, hasTouch: size.touch, isMobile: size.touch, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(`${server.url}/sigilfall?play=1&perf`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!globalThis.__rb?.ui, null, { timeout: 120_000 });
    await page.evaluate(() => {
      const e = globalThis.__rb;
      e.setTutorial(false);
      if (!e.heroes().some(Boolean)) e.createHero(0, 'warrior', 'Bench', 'm', undefined, false);
      else e.play(0);
    });
    await page.waitForFunction(() => globalThis.__rb.ui.screen === 'game' && !!globalThis.__rb.world, null, { timeout: 120_000 });
    for (const id of HEAVY.filter((p) => !only || p === only)) {
      await page.evaluate((pid) => globalThis.__rb.usePreset(pid), id);
      await page.waitForFunction(() => !globalThis.__rb.renderer.waiting, null, { timeout: 60_000 }).catch(() => undefined);
      const samples = [];
      for (let t = 0; t < secs + 3; t++) {
        await page.evaluate(() => {
          const e = globalThis.__rb;
          if (e.ui.tip) e.skipTips();
          if (e.ui.story) e.closeStory();
          if (e.ui.dialogue) e.closeDialogue();
          if (e.world?.scene) e.skipScene();
          // (the hero stands and is never struck down: the fight goes on round them)
          if (e.world) e.world.player.iframe = 99;
        });
        await page.waitForTimeout(1000);
        // (the first seconds are the land coming in: not counted)
        if (t >= 3) {
          const s = await page.evaluate(() => globalThis.__sfPerf ?? null);
          if (s) samples.push(s);
        }
      }
      const row = {
        preset: id,
        calls: { max: Math.max(...samples.map((s) => s.calls)), mid: median(samples.map((s) => s.calls)) },
        ktris: { max: Math.round(Math.max(...samples.map((s) => s.tris)) / 1000), mid: Math.round(median(samples.map((s) => s.tris)) / 1000) },
        foes: Math.max(...samples.map((s) => s.foes)),
        fx: Math.max(...samples.map((s) => s.fx)),
        fps: Math.round(median(samples.map((s) => s.fps))),
        worstMs: Math.round(Math.max(...samples.map((s) => s.worst))),
      };
      report.push(row);
      writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
      console.log(`${id.padEnd(16)} calls ${row.calls.mid}/${row.calls.max}  tris ${row.ktris.mid}k/${row.ktris.max}k  foes ${row.foes}  fx ${row.fx}  ${row.fps} fps (this machine)`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
