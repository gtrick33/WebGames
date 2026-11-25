/**
 * What a late, crowded night of the Vigil costs to draw, at a phone's size: the clock is put at nine minutes with a
 * hero who can't fall and holds five spells at their top, and the frames of the next half minute are timed.
 *
 *   node scripts/sigilfall-vigil-bench.mjs [--root <a checkout's glitchbound folder>] [--class mage] [--land Whisperwood] [--seconds 30] [--gpu]
 *
 * `--root` times another checkout with the same script (the branch before a change), so the two can be set side by
 * side. It prints the mean, the 95th-percentile and the worst frame in milliseconds, the frames a second, and how many
 * of the Host were on the field. The numbers are this machine's and this browser's (headless Chromium), good for a
 * before and after, not for what a phone does.
 */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, or) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : or;
};
const ROOT = resolve(value('root', join(HERE, '..')));
const { chromium } = createRequire(import.meta.url)('playwright');
const CLASS_NAMES = { warrior: 'Warrior', mage: 'Mage', ranger: 'Ranger', paladin: 'Paladin', priest: 'Priest', warlock: 'Warlock', druid: 'Druid' };
const CLS = value('class', 'mage');
const LAND = value('land', 'Whisperwood');
const SECONDS = Number(value('seconds', '30'));

const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const vite = await createServer({ root: ROOT, logLevel: 'silent', server: { port: 5203, strictPort: false } });
await vite.listen();
const url = (vite.resolvedUrls?.local?.[0] ?? 'http://localhost:5203/').replace(/\/+$/, '');
const browser = await chromium.launch({ args: flag('gpu') ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let code = 0;
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    globalThis.localStorage.setItem('sigilfall.vigil.taught', '1');
    globalThis.localStorage.setItem('sigilfall.vigil.bests', JSON.stringify(Object.fromEntries(['whisperwood', 'thornvale', 'brackenridge', 'greyfen', 'saltmarsh', 'ironpeak', 'ashen-barrows', 'sunscorch', 'rimeheld', 'vinecoil', 'emberdeep', 'pale-reach'].map((id) => [id, 300]))));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${url}/sigilfall?play=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!globalThis.__rb?.ui, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').startsWith('The Vigil:'))?.click());
  await page.waitForSelector('.rb-vlobby-land', { timeout: 60_000 });
  await page.waitForTimeout(1000);
  await page.evaluate((name) => [...document.querySelectorAll('.rb-vlobby-class')].find((x) => x.textContent.trim() === name)?.click(), CLASS_NAMES[CLS]);
  await page.evaluate((name) => [...document.querySelectorAll('.rb-vlobby-land')].find((x) => x.querySelector('strong')?.textContent === name)?.click(), LAND);
  await page.waitForTimeout(400);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Keep the watch in'))?.click());
  await page.waitForFunction(() => !!globalThis.__vigil?.renderer.landReady && globalThis.__vigil.renderer.objects.length > 0, null, { timeout: 240_000 });
  // late in the night, five spells at their top, and a hero who stays standing; cards are taken as they come
  await page.evaluate(() => {
    const g = globalThis.__vigil;
    g.v.t = 540;
    globalThis.setInterval(() => {
      g.me.hp = 1e9;
      if (g.me.cards) g.pick(0);
    }, 100);
  });
  await page.evaluate(async () => {
    const mod = await import('/src/games/sigilfall/vigil/kit.ts');
    const g = globalThis.__vigil;
    g.me.spells = Object.fromEntries(mod.spellsOf(g.me.cls).slice(0, 5).map((s) => [s.id, 6]));
    g.me.rev++;
  });
  // (the crowd comes in)
  await page.waitForTimeout(12_000);
  const out = await page.evaluate(
    (seconds) =>
      new Promise((done) => {
        const g = globalThis.__vigil;
        const gaps = [];
        const foes = [];
        let last = performance.now();
        const end = last + seconds * 1000;
        const tick = (now) => {
          gaps.push(now - last);
          last = now;
          if (gaps.length % 30 === 0) foes.push(g.v.foes.length);
          if (now < end) requestAnimationFrame(tick);
          else {
            gaps.sort((a, b) => a - b);
            const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
            done({ frames: gaps.length, mean: Math.round(mean * 10) / 10, p95: Math.round(gaps[Math.floor(gaps.length * 0.95)] * 10) / 10, worst: Math.round(gaps[gaps.length - 1] * 10) / 10, fps: Math.round(10000 / mean) / 10, foes: Math.round(foes.reduce((a, b) => a + b, 0) / Math.max(1, foes.length)), fx: g.v.fx.length, clock: Math.round(g.v.t) });
          }
        };
        requestAnimationFrame(tick);
      }),
    SECONDS,
  );
  console.log(JSON.stringify({ root: ROOT.split('/').slice(-3).join('/'), class: CLS, land: LAND, ...out, errors }));
  if (errors.length) code = 1;
} catch (e) {
  console.error(e.message);
  code = 1;
} finally {
  await browser.close();
  await vite.close();
}
process.exit(code);
