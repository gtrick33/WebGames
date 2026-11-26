/**
 * The owner's phone notes on the Vigil (2026-11-26), looked at in a browser at an iPhone's size on its side (932×430,
 * touch): the lobby with a spell chosen (its words ran into the line under them, and the Wardrobe's picker was cut off
 * at the top), a land and the week's watch chosen (one short sentence each), a held press on the night's clock (it
 * picked up the words, and Safari offered to copy a link to them), each new event, and a chest out of sight.
 *
 *   node scripts/sigilfall-vigil-phonecheck.mjs --out docs/review/sf9-vigil-looks/phone [--root <another checkout>] [--gpu]
 *
 * It reports, for each picture, whether any piece of the lobby's middle column covers another or runs out of it, and
 * whether a held press selected any words. Writes <out>/check.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
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
const OUT = resolve(join(HERE, '..'), value('out', '.cache/vigil-phone'));
const { chromium } = createRequire(import.meta.url)('playwright');

const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const vite = await createServer({ root: ROOT, logLevel: 'silent', server: { port: 5209, strictPort: false } });
await vite.listen();
const url = (vite.resolvedUrls?.local?.[0] ?? 'http://localhost:5209/').replace(/\/+$/, '');
const browser = await chromium.launch({ args: flag('gpu') ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = [];
const errors = [];

/** What in the lobby's middle column covers something else, or runs out of the column. */
function columnFaults() {
  const doc = globalThis.document;
  const col = doc.querySelector('.rb-vlobby-kit');
  if (!col) return ['no kit column'];
  const box = col.getBoundingClientRect();
  const parts = [...col.querySelectorAll('.rb-rp-looks, .rb-vlobby-spells, .rb-vlobby-about, .rb-vlobby-codex')].filter((e) => e.offsetParent);
  const out = [];
  const rects = parts.map((e) => [e.className.split(' ')[0], e.getBoundingClientRect()]);
  for (const [n, r] of rects) {
    // (seen: its top and foot within the column's, give or take a pixel; the column scrolls, so only what is shown counts)
    if (r.top < box.top - 1 && r.bottom > box.top) out.push(`${n} is cut off at the column's top by ${Math.round(box.top - r.top)}`);
  }
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const [a, ra] = rects[i];
      const [b, rb] = rects[j];
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      if (h > 2 && w > 2) out.push(`${a} over ${b} by ${Math.round(h)}`);
    }
  // the words of the about box don't spill out of it
  const about = col.querySelector('.rb-vlobby-about');
  if (about && about.scrollHeight > about.clientHeight + 2 && globalThis.getComputedStyle(about).overflow === 'visible') out.push(`the spell's words run ${about.scrollHeight - about.clientHeight} past their box`);
  return out;
}

async function shot(page, name, note, extra = {}) {
  await page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 72 });
  report.push({ name, note, ...extra });
  console.log(`${name.padEnd(28)}${JSON.stringify(extra)}`);
}

try {
  mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 932, height: 430 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    globalThis.localStorage.setItem('sigilfall.vigil.taught', '1');
    globalThis.localStorage.setItem('sigilfall.vigil.bests', JSON.stringify(Object.fromEntries(['whisperwood', 'thornvale', 'brackenridge', 'greyfen', 'saltmarsh', 'ironpeak', 'ashen-barrows', 'sunscorch', 'rimeheld', 'vinecoil', 'emberdeep', 'pale-reach'].map((id) => [id, 530]))));
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${url}/sigilfall?play=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!globalThis.__rb?.ui, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => [...globalThis.document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').startsWith('The Vigil:'))?.click());
  await page.waitForSelector('.rb-vlobby-land', { timeout: 60_000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => [...globalThis.document.querySelectorAll('.rb-vlobby-class')].find((x) => x.textContent.trim() === 'Mage')?.click());
  await page.evaluate(() => [...globalThis.document.querySelectorAll('.rb-vlobby-land')].find((x) => x.querySelector('strong')?.textContent === 'Greyfen Marsh')?.click());
  await page.waitForTimeout(600);
  await shot(page, 'lobby-1-mage-greyfen', 'The lobby as in the owner’s picture: the Mage, Fireball shown, Greyfen Marsh chosen.', { faults: await page.evaluate(columnFaults) });
  await page.evaluate(() => globalThis.document.querySelector('.rb-vlobby-land.is-week')?.click());
  await page.waitForTimeout(400);
  await shot(page, 'lobby-2-week', 'The week’s watch chosen.', { faults: await page.evaluate(columnFaults) });
  // the longest of a mage's spells to describe
  await page.evaluate(() => globalThis.document.querySelectorAll('.rb-vlobby-spell')[7]?.click());
  await page.waitForTimeout(300);
  await shot(page, 'lobby-3-mage-spell', 'Another spell shown.', { faults: await page.evaluate(columnFaults) });
  // a held press on the lobby's words
  const held = async (sel) => {
    const at = await page.evaluate((s) => {
      const r = globalThis.document.querySelector(s)?.getBoundingClientRect();
      return r ? [r.x + r.width / 2, r.y + r.height / 2] : null;
    }, sel);
    if (!at) return 'nothing there';
    await page.mouse.move(at[0], at[1]);
    // (a long press selects a word on a phone; a double click does in Chromium)
    await page.mouse.dblclick(at[0], at[1]);
    await page.waitForTimeout(200);
    const picked = await page.evaluate(() => globalThis.getSelection()?.toString() ?? '');
    const css = await page.evaluate((s) => {
      const c = globalThis.getComputedStyle(globalThis.document.querySelector(s));
      return `${c.userSelect || c.webkitUserSelect} ${c.webkitTouchCallout ?? ''}`;
    }, sel);
    await page.evaluate(() => globalThis.getSelection()?.removeAllRanges());
    return { picked, css };
  };
  report.push({ name: 'press-lobby', note: 'A double click (a long press, on a phone) on a spell’s words in the lobby.', ...(await held('.rb-vlobby-about')) });
  await page.evaluate(() => [...globalThis.document.querySelectorAll('.rb-vlobby-land')].find((x) => x.querySelector('strong')?.textContent === 'Greyfen Marsh')?.click());
  await page.evaluate(() => [...globalThis.document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Keep the watch in'))?.click());
  await page.waitForFunction(() => !!globalThis.__vigil?.renderer.landReady && globalThis.__vigil.renderer.objects.length > 0, null, { timeout: 240_000 });
  await page.waitForTimeout(2500);
  report.push({ name: 'press-night', note: 'The same on the night’s clock and level, as in the owner’s picture.', ...(await held('.rb-vigil-stat')) });
  await shot(page, 'night-1-greyfen', 'The night in Greyfen Marsh after the presses: nothing picked up.');
  // each new event, and a chest out of sight (the night held still for each: the hero can't fall)
  const hasNew = await page.evaluate(async () => (await import('/src/games/sigilfall/vigil/night.ts')).EVENT_KINDS.includes('wisps'));
  if (hasNew) {
    for (const kind of ['gilded', 'wisps', 'hound']) {
      await page.evaluate((k) => {
        const g = globalThis.__vigil;
        g.me.hp = 1e9;
        g.v.event = null;
        g.v.bag = [k];
        g.v.nextEvent = 0;
        globalThis.clearInterval(globalThis.__hold);
        globalThis.__hold = globalThis.setInterval(() => {
          g.me.hp = 1e9;
          if (g.me.cards) g.pick(0);
        }, 100);
      }, kind);
      await page.waitForTimeout(1800);
      await shot(page, `event-${kind}`, `The new event: ${kind}.`);
    }
    await page.evaluate(() => {
      const g = globalThis.__vigil;
      g.v.event = null;
      g.v.pickups.push({ kind: 'chest', x: g.me.x + 520, y: g.me.y - 140, t: 0, dead: false });
    });
    await page.waitForTimeout(600);
    await shot(page, 'chest-arrow-off', 'A chest out of sight, up and to the right: the gold chevron at the edge points to it.');
    await page.evaluate(() => {
      const g = globalThis.__vigil;
      g.v.pickups = [{ kind: 'chest', x: g.me.x + 90, y: g.me.y - 30, t: 0, dead: false }];
    });
    await page.waitForTimeout(600);
    await shot(page, 'chest-arrow-on', 'A chest in sight: a bobbing mark over it.');
  }
  await context.close();
} catch (e) {
  errors.push(`stopped: ${e.message}`);
} finally {
  writeFileSync(join(OUT, 'check.json'), `${JSON.stringify({ report, errors }, null, 1)}\n`);
  await browser.close();
  await vite.close();
}
console.log(errors.length ? `${errors.length} problem(s): ${errors.slice(0, 3).join(' | ')}` : 'no page errors');
process.exit(errors.length ? 1 : 0);
