/**
 * What a new player's device loads before Sigilfall's first fight, and how long it takes (NINE_PLAN.md: the baseline,
 * and piece 7, phone and network readiness).
 *
 *   npx vite build && node scripts/build-games.mjs      (it measures the production build in dist/)
 *   node scripts/sigilfall-load-check.mjs [--size phone|desktop] [--net slow4g|fast4g] [--cpu 4] [--out name]
 *
 * Opens the built site's /sigilfall as a first-time visitor (nothing cached, no save), makes a hero the way a player
 * does (New hero, Begin), goes through the opening's page and words, and stops when the first fight's foes are called.
 * Every file the page asked for is counted at three moments: the title screen up, the hero standing in the world, and
 * the first fight begun. Files are counted at the size of the built file and, for text (scripts, styles, JSON), as Brotli
 * would send them, which is how the site's host serves them. Times are this
 * machine's, with a software graphics card: they are for comparing one run with another, not a phone's numbers.
 * Writes .cache/load/<out>.json.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, '.cache', 'load');

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
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('No build in dist/: run `npx vite build && node scripts/build-games.mjs` first.');
  process.exit(1);
}

const SIZES = {
  desktop: { viewport: { width: 1440, height: 900 }, touch: false },
  phone: { viewport: { width: 844, height: 390 }, touch: true },
};
/** Network profiles, as Chromium's DevTools names them (bytes a second, and the round trip in ms). */
const NETS = {
  slow4g: { downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, latency: 150 },
  fast4g: { downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8, latency: 60 },
};

/** What kind of file an address is, for the table. */
function kindOf(path) {
  if (path.startsWith('/games/sigilfall/3d/')) return 'models';
  if (path.startsWith('/games/sigilfall/music/')) return 'music';
  if (path.startsWith('/games/sigilfall/audio/')) return 'sounds';
  if (path.startsWith('/games/sigilfall/icons/')) return 'icons';
  if (path.startsWith('/games/sigilfall/')) return 'other game files';
  if (/\.js$/.test(path)) return 'scripts';
  if (/\.css$/.test(path)) return 'styles';
  if (/\.(woff2?|ttf)$/.test(path)) return 'fonts';
  if (/\.(webp|png|jpe?g|svg|avif|ico)$/.test(path)) return 'site pictures';
  if (path.startsWith('/api/')) return 'api';
  return 'pages and the rest';
}
const TEXT = /\.(js|css|json|html|svg|txt|webmanifest)$/;

/** Presses the first button on the page whose words fit (`=Begin` for exactly those words). (A page that is moving on to another address has nothing to press yet.) */
const press = (page, text) =>
  page
    .evaluate((t) => {
      const name = (x) => `${x.getAttribute('aria-label') ?? ''} ${x.textContent ?? ''}`.replace(/\s+/g, ' ').trim().toLowerCase();
      const want = t.replace(/^=/, '').toLowerCase();
      const b = [...globalThis.document.querySelectorAll('button, [role=radio]')].filter((x) => x.offsetParent !== null && !x.disabled).find((x) => (t.startsWith('=') ? name(x) === want : name(x).includes(want)));
      if (!b) return false;
      b.click();
      return true;
    }, text)
    .catch(() => false);
const shown = (page, sel) =>
  page
    .evaluate((s) => {
      const e = globalThis.document.querySelector(s);
      return !!e && e.offsetParent !== null;
    }, sel)
    .catch(() => false);

async function run() {
  const size = SIZES[value('size') ?? 'desktop'];
  const net = value('net') ? NETS[value('net')] : null;
  const cpu = Number(value('cpu') ?? 1);
  const name = value('out') ?? `${value('size') ?? 'desktop'}${value('net') ? `-${value('net')}` : ''}${cpu > 1 ? `-cpu${cpu}` : ''}`;
  mkdirSync(OUT, { recursive: true });
  const { preview } = await import('vite');
  const server = await preview({ root: ROOT, preview: { port: 5197, strictPort: false }, logLevel: 'silent' });
  const base = (server.resolvedUrls?.local?.[0] ?? 'http://localhost:5197/').replace(/\/+$/, '');
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const context = await browser.newContext({ viewport: size.viewport, hasTouch: size.touch, isMobile: size.touch, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    if (net) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...net });
    if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    /** Every file asked for: its address, and its size once it has come. */
    const asked = new Map();
    const files = [];
    const errors = [];
    cdp.on('Network.requestWillBeSent', (e) => asked.set(e.requestId, e.request.url));
    cdp.on('Network.loadingFinished', (e) => {
      const url = asked.get(e.requestId);
      if (!url || !url.startsWith(base)) return;
      const path = new URL(url).pathname;
      const file = join(DIST, path === '/' || !/\.[a-z0-9]+$/i.test(path) ? 'index.html' : path);
      // (a file asked for twice, a preload and then its use, came over the wire once: counted once, at its first coming)
      if (files.some((f) => f.path === path)) return;
      // its size is the built file's own (what the browser says it received is nothing for a file it had kept from a
      // moment before); text goes out as Brotli from the site's host, where here it came plain or gzipped
      const there = existsSync(file);
      const bytes = there ? statSync(file).size : e.encodedDataLength;
      files.push({ path, kind: kindOf(path), bytes, sent: there && TEXT.test(file) ? brotliCompressSync(readFileSync(file)).length : bytes, at: Date.now() });
    });
    cdp.on('Network.loadingFailed', (e) => {
      // (a file the page stopped asking for as it moved on, a preload it no longer needed, is not a failure)
      if (e.canceled) return;
      const url = asked.get(e.requestId);
      if (url && url.startsWith(base) && !new URL(url).pathname.startsWith('/api/')) errors.push(`failed: ${new URL(url).pathname}`);
    });
    page.on('pageerror', (e) => errors.push(`error: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/\/api\/|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text().slice(0, 160)}`);
    });

    const t0 = Date.now();
    const marks = [];
    const mark = (id) => {
      const upTo = files.filter((f) => f.at <= Date.now());
      const by = {};
      for (const f of upTo) {
        by[f.kind] ??= { files: 0, bytes: 0, sent: 0 };
        by[f.kind].files++;
        by[f.kind].bytes += f.bytes;
        by[f.kind].sent += f.sent;
      }
      marks.push({ id, seconds: Math.round((Date.now() - t0) / 100) / 10, files: upTo.length, bytes: upTo.reduce((a, f) => a + f.bytes, 0), sent: upTo.reduce((a, f) => a + f.sent, 0), by });
    };
    const until = async (what, test, ms, each) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (await test()) return true;
        if (each) await each();
        await page.waitForTimeout(250);
      }
      // where it stopped, for whoever reads the failure: a picture, and the buttons that were up
      await page.screenshot({ path: join(OUT, `${name}-stuck.png`) }).catch(() => undefined);
      const up = await page.evaluate(() => [...globalThis.document.querySelectorAll('button')].filter((x) => x.offsetParent !== null).map((x) => `${x.getAttribute('aria-label') ?? ''} ${x.textContent ?? ''}`.replace(/\s+/g, ' ').trim().slice(0, 30))).catch(() => []);
      throw new Error(`Timed out waiting for ${what}. Buttons up: ${up.join(' | ')}`);
    };

    await page.goto(`${base}/sigilfall?play=1`, { waitUntil: 'domcontentloaded' });
    await until('the title screen', () => press(page, 'New hero: '), 180_000);
    mark('title');
    await until('the hero screen', () => press(page, 'Begin as '), 60_000);
    await until('the Begin dialog', () => press(page, '=Begin'), 60_000);
    await until('the world', () => shown(page, '.rb-hud-hero'), 240_000);
    // (the land is on the screen once the page of the tale, which waits for it, has come up or the fight has)
    await until('the land', async () => (await shown(page, '.rb-story')) || (await shown(page, '.rb-encounter')), 240_000);
    mark('world');
    // the tale's page, then Mara's words at the gate: read on as a player does. The fight is on when the wave's
    // banner or the first lesson's card shows, or once her words are done and nothing more comes up to read
    let talked = false;
    let begun = false;
    await until(
      'the first fight',
      async () => begun || (await shown(page, '.rb-encounter')) || (await shown(page, '.rb-teach')),
      90_000,
      async () => {
        const reading = async () => (await shown(page, '.rb-dialogue')) || (await shown(page, '.rb-story'));
        if (await shown(page, '.rb-dialogue')) talked = true;
        for (const b of ['Next ▸', '=Continue', '=Accept', '=Farewell', '=Done', '=Close']) if (await press(page, b)) return;
        if (talked && !(await reading())) {
          await page.waitForTimeout(4000);
          if (!(await reading())) begun = true;
        }
      },
    );
    mark('fight');
    // a few seconds of the fight: whatever it calls for late (a foe's model, a sound) is counted too
    await page.waitForTimeout(6000);
    mark('fight + 6 s');

    const report = { build: name, size: value('size') ?? 'desktop', net: value('net') ?? 'none', cpu, marks, biggest: [...files].sort((a, b) => b.sent - a.sent).slice(0, 25).map((f) => ({ path: f.path, kind: f.kind, kb: Math.round(f.sent / 1024) })), errors: [...new Set(errors)] };
    writeFileSync(join(OUT, `${name}.json`), JSON.stringify(report, null, 2));
    const kb = (n) => `${(n / 1024).toFixed(0)} KB`.padStart(10);
    for (const m of marks) {
      console.log(`\n${m.id}: ${m.seconds} s, ${m.files} files, ${kb(m.bytes)} off the disk, ${kb(m.sent)} as sent`);
      for (const [k, v] of Object.entries(m.by).sort((a, b) => b[1].sent - a[1].sent)) console.log(`  ${k.padEnd(20)} ${String(v.files).padStart(4)} files ${kb(v.sent)}`);
    }
    if (report.errors.length) console.log(`\nThe page reported:\n  ${report.errors.join('\n  ')}`);
  } finally {
    await browser.close();
    await new Promise((done) => server.httpServer.close(done));
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
