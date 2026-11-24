/**
 * Sigilfall's panels, dialogs and shops looked over at three sizes (NINE_PLAN.md, piece 8): every panel is opened on a
 * mid-game hero at a phone's, a tablet's and a desktop's size, and what a player would trip on is measured:
 *
 * - something of the panel's that lies outside the game's stage (cut off), unless it is inside a part that scrolls;
 * - words smaller than 10 px on the screen;
 * - a button under 28 px on its short side on a touch screen;
 * - two buttons that cover each other.
 *
 *   node scripts/sigilfall-panel-audit.mjs [--out docs/review/sf9-<topic>/panels] [--size phone] [--panel talents]
 *
 * It starts its own dev server and needs Playwright, as the screen check does. A picture of each panel goes to <out>,
 * with audit.json; the script prints what it found and fails if anything is cut off or covered (small words and small
 * buttons are listed, not failed: some are the game's own choice).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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
const OUT = join(ROOT, value('out') ?? '.cache/panel-audit');

const SIZES = [
  { id: 'phone', viewport: { width: 844, height: 390 }, touch: true },
  { id: 'tablet', viewport: { width: 1024, height: 768 }, touch: true },
  { id: 'desktop', viewport: { width: 1440, height: 900 }, touch: false },
];
/** What is opened: the panels by their ids, the shops, and the pause menu. */
const STOPS = [
  ...['hero', 'wardrobe', 'skills', 'talents', 'quests', 'map', 'settings', 'party', 'store'].map((id) => ({ id, open: (p) => globalThis.__rb.openPanel(p), arg: id })),
  ...['inn', 'weapons', 'armor', 'curios', 'quartermaster'].map((id) => ({ id: `shop-${id}`, open: (s) => globalThis.__rb.openShop(s), arg: id })),
];

/** Runs in the page: what is wrong with what is on the screen now. */
function audit(touch) {
  const { document, getComputedStyle } = globalThis;
  const stage = document.querySelector('.rb-ui') ?? document.querySelector('.rb-root');
  if (!stage) return { error: 'no game on the page' };
  const S = stage.getBoundingClientRect();
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    for (let e = el; e && e !== stage; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.2) return false;
    }
    return true;
  };
  /** Inside something that scrolls or cuts its own overflow on purpose: not cut off, only scrolled away. */
  const scrolled = (el) => {
    for (let e = el.parentElement; e && e !== stage; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (/(auto|scroll|hidden|clip)/.test(`${cs.overflowX} ${cs.overflowY}`)) {
        const r = e.getBoundingClientRect();
        const b = el.getBoundingClientRect();
        if (b.left < r.left - 1 || b.right > r.right + 1 || b.top < r.top - 1 || b.bottom > r.bottom + 1) return true;
      }
    }
    return false;
  };
  const name = (el) => `${el.className?.toString().split(' ')[0] || el.tagName.toLowerCase()}: ${(el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)}`;
  const panel = document.querySelector('.rb-panel, .rb-modal, .rb-shop, .rb-pause') ?? stage;
  const cut = [];
  const small = [];
  const tiny = [];
  const buttons = [];
  for (const el of panel.querySelectorAll('*')) {
    if (!shown(el) || scrolled(el)) continue;
    const r = el.getBoundingClientRect();
    const leaf = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (leaf || el.tagName === 'BUTTON' || el.tagName === 'IMG' || el.tagName === 'CANVAS') {
      if (r.left < S.left - 2 || r.right > S.right + 2 || r.top < S.top - 2 || r.bottom > S.bottom + 2) cut.push(name(el));
    }
    // (words drawn inside a picture, the world map's names, are sized by the picture and zoom with it)
    if (leaf && !el.closest('svg')) {
      // (the size it is drawn at: its font's, times whatever its parents are scaled or zoomed by)
      const k = el.offsetHeight ? r.height / el.offsetHeight : 1;
      const px = parseFloat(getComputedStyle(el).fontSize) * (Number.isFinite(k) && k > 0 ? k : 1);
      if (px < 10) small.push(`${px.toFixed(1)}px ${name(el)}`);
    }
    if (el.tagName === 'BUTTON' && !el.disabled) {
      buttons.push({ el, r });
      if (touch && Math.min(r.width, r.height) < 28) tiny.push(`${Math.round(r.width)}×${Math.round(r.height)} ${name(el)}`);
    }
  }
  const covered = [];
  for (let i = 0; i < buttons.length; i++) {
    for (let j = i + 1; j < buttons.length; j++) {
      const a = buttons[i];
      const b = buttons[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 4 && h > 4) covered.push(`${name(a.el)} × ${name(b.el)}`);
    }
  }
  const uniq = (xs) => [...new Set(xs)];
  return { cut: uniq(cut).slice(0, 12), small: uniq(small).slice(0, 12), tiny: uniq(tiny).slice(0, 12), covered: uniq(covered).slice(0, 12) };
}

async function run() {
  mkdirSync(OUT, { recursive: true });
  const { createServer } = await import('vite');
  const vite = await createServer({ root: ROOT, logLevel: 'silent', server: { port: 5194, strictPort: false } });
  await vite.listen();
  const url = (vite.resolvedUrls?.local?.[0] ?? 'http://localhost:5194/').replace(/\/+$/, '');
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const report = [];
  try {
    for (const size of SIZES.filter((s) => !value('size') || s.id === value('size'))) {
      const context = await browser.newContext({ viewport: size.viewport, hasTouch: size.touch, isMobile: size.touch, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
      await page.goto(`${url}/sigilfall?play=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!globalThis.__rb?.ui, null, { timeout: 120_000 });
      if (size.touch) {
        const full = page.getByRole('button', { name: 'Fullscreen' });
        if (await full.count()) await full.first().click().catch(() => undefined);
      }
      await page.evaluate(() => {
        const e = globalThis.__rb;
        e.setTutorial(false);
        e.createHero(0, 'mage', 'Audit', 'f', undefined, false);
      });
      await page.waitForFunction(() => globalThis.__rb.ui.screen === 'game' && !!globalThis.__rb.world && !globalThis.__rb.renderer.waiting, null, { timeout: 180_000 });
      // a hero with something in every panel: the Crown City, level 29, a bag of gear
      await page.evaluate(() => globalThis.__rb.usePreset('after-knives'));
      await page.waitForFunction(() => globalThis.__rb.world?.region.id === 'emberwick' && !globalThis.__rb.renderer.waiting, null, { timeout: 120_000 }).catch(() => undefined);
      for (const stop of STOPS.filter((s) => !value('panel') || s.id === value('panel'))) {
        await page.evaluate(() => {
          const e = globalThis.__rb;
          if (e.world?.scene) e.skipScene();
          if (e.ui.dialogue) e.closeDialogue();
          if (e.ui.panel) e.closePanel?.();
        });
        // (the pages of the tale and what the review hero's jump brought up are put away first, however many)
        for (let k = 0; k < 6; k++) {
          const more = await page.evaluate(() => {
            const e = globalThis.__rb;
            if (e.ui.story) e.closeStory();
            for (const t of e.ui.toasts ?? []) e.dismissToast(t.id);
            return !!e.ui.story;
          });
          await page.waitForTimeout(350);
          if (!more) break;
        }
        await page.evaluate(([fn, arg]) => new Function('a', `return (${fn})(a)`)(arg), [stop.open.toString(), stop.arg]).catch((e) => errors.push(`${stop.id}: ${e.message.slice(0, 120)}`));
        await page.waitForTimeout(900);
        const open = await page.evaluate(() => globalThis.__rb.ui.panel);
        const found = await page.evaluate(audit, size.touch);
        await page.screenshot({ path: join(OUT, `${size.id}-${stop.id}.jpg`), type: 'jpeg', quality: 66 });
        report.push({ size: size.id, stop: stop.id, open, ...found, errors: errors.splice(0) });
        const bad = (found.cut?.length ?? 0) + (found.covered?.length ?? 0);
        console.log(`${size.id.padEnd(8)}${stop.id.padEnd(20)}${open ? '' : '(did not open) '}cut ${found.cut?.length ?? '-'}  covered ${found.covered?.length ?? '-'}  small words ${found.small?.length ?? '-'}  small buttons ${found.tiny?.length ?? '-'}${bad ? `   ${[...(found.cut ?? []), ...(found.covered ?? [])][0]}` : ''}`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    await vite.close();
  }
  writeFileSync(join(OUT, 'audit.json'), `${JSON.stringify(report, null, 1)}\n`);
  const bad = report.filter((r) => r.cut?.length || r.covered?.length || r.errors.length);
  console.log(bad.length ? `\n${bad.length} stop(s) with something cut off, covered or reported; see ${join(OUT, 'audit.json')}` : `\n${report.length} stops: nothing cut off, nothing covered.`);
  process.exit(bad.length ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
