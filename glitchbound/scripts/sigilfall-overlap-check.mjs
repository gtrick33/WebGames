/**
 * Sigilfall's screen check: nothing on the screen covers anything else (POLISH_PLAN.md, piece 2).
 *
 * The game is opened at three sizes (a desktop, a tablet and a phone on its side, the last two by touch), a hero is
 * jumped to each story beat of the review presets (progress/presets.ts), and for some seconds of each the pieces of the
 * HUD and the words spoken on the picture are measured several times a second. Any two that cover each other are
 * reported (once it lasts half a second: not a frame of an animation passing by), with a picture of the moment, and
 * the script fails.
 *
 *   node scripts/sigilfall-overlap-check.mjs                 the story's beats (the presets not of a later pass:
 *                                                           about thirty) at every size, about forty minutes
 *   node scripts/sigilfall-overlap-check.mjs --all           every preset there is (over a hundred and fifty: hours)
 *   node scripts/sigilfall-overlap-check.mjs --quick         six presets that cover the kinds of moment
 *   node scripts/sigilfall-overlap-check.mjs --size phone --preset hearthstead
 *   node scripts/sigilfall-overlap-check.mjs --url http://localhost:5173   (a dev server already running)
 *
 * Without --url it starts its own dev server. It needs Playwright, as the key-art script does
 * (`npm i --no-save playwright` once, or a machine that has it). Pictures of what it found go to
 * `.cache/overlap/` (ignored by git).
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, '.cache', 'overlap');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

// (required, not imported: a Playwright installed for the whole machine is found that way too)
let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('This script needs Playwright: npm i --no-save playwright');
  process.exit(1);
}

/** The sizes a player meets: a desktop, a laptop, a tablet held sideways and a phone on its side, the last two by touch. */
const SIZES = [
  { id: 'desktop', viewport: { width: 1440, height: 900 }, touch: false },
  { id: 'laptop', viewport: { width: 1280, height: 720 }, touch: false },
  { id: 'tablet', viewport: { width: 1024, height: 768 }, touch: true },
  { id: 'phone', viewport: { width: 844, height: 390 }, touch: true },
];

/** Six presets that between them have every kind of moment: a first fight with lessons, a raid, a town, a boss, a scene, a siege. */
const QUICK = ['prologue-dusk', 'prologue-raid', 'hearthstead', 'crown-city', 'the-tear', 'muster-hall'];

/**
 * The pieces of the HUD that must never cover each other, each a selector for the elements that are one piece. A
 * group of buttons is measured button by button, so the gaps between them are free.
 */
const PIECES = [
  ['hero', '.rb-hud-hero'],
  ['menu', '.rb-hud-menu .rb-hudbtn'],
  ['map', '.rb-minimap-hud'],
  ['quest', '.rb-tracker'],
  ['toast', '.rb-toasts > .rb-toast'],
  ['wave', '.rb-encounter'],
  ['announce', '.rb-announce .rb-banner, .rb-announce .rb-levelup, .rb-announce .rb-tcard-text'],
  ['boss', '.rb-bossbar'],
  ['cast', '.rb-castbar'],
  ['bar', '.rb-bar6 > .rb-slot6, .rb-bar6 > button'],
  ['prompt', '.rb-prompt'],
  ['teach', '.rb-teach'],
  ['thumb', '.rb-cluster .rb-sb, .rb-potion-dock, .rb-interact'],
  // (where the stick rests: a thumb is on it, and words under it are lost)
  ['stick', '.rb-joy'],
  ['party', '.rb-party-frames'],
  ['clock', '.rb-keybar'],
  ['invite', '.rb-invite'],
];

/** Pairs that may meet: a piece and the piece it belongs to. */
const ALLOWED = new Set([]);

async function devServer() {
  const url = value('url');
  if (url) return { url: url.replace(/\/+$/, ''), close: async () => {} };
  const { createServer } = await import('vite');
  const server = await createServer({ root: ROOT, logLevel: 'silent', server: { port: 5199, strictPort: false } });
  await server.listen();
  const local = server.resolvedUrls?.local?.[0] ?? 'http://localhost:5199/';
  return { url: local.replace(/\/+$/, ''), close: () => server.close() };
}

/** Everything measured at one moment, in the page's pixels. */
function measure(pieces) {
  // (run in the page: its document and its styles)
  const { document, getComputedStyle } = globalThis;
  const shown = (el) => {
    if (el.closest('[hidden]')) return false;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.3) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const out = [];
  for (const [id, sel] of pieces) {
    for (const el of document.querySelectorAll(sel)) {
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      out.push({ id, x: r.left, y: r.top, w: r.width, h: r.height, text: (el.textContent ?? '').trim().slice(0, 40) });
    }
  }
  const e = globalThis.__rb;
  const r = e?.renderer;
  if (r?.canvas) {
    const c = r.canvas.getBoundingClientRect();
    const kx = c.width / (r.viewW || c.width);
    const ky = c.height / (r.viewH || c.height);
    // (every card on the picture: the renderer lists them as it lays them out, scenes' too where it can say)
    const cards = r.speechCards ?? r.speechBoxes ?? [];
    for (const s of cards) out.push({ id: 'speech', x: c.left + s.x * kx, y: c.top + s.y * ky, w: s.w * kx, h: s.h * ky, text: s.text ?? '' });
  }
  return out;
}

/**
 * Words spoken where they are hardest to place: whoever stands highest on the screen, whoever stands nearest the hero,
 * and the hero, all at once, each a line long enough to wrap.
 */
function speak() {
  const e = globalThis.__rb;
  const w = e.world;
  const r = e.renderer;
  const st = r?.stage;
  if (!w || !st || w.scene) return 0;
  const W = r.canvas.clientWidth;
  const H = r.canvas.clientHeight;
  const seen = [...w.npcs.map((n) => ({ id: n.id, x: n.x, y: n.y })), ...w.enemies.filter((f) => !f.dead).map((f) => ({ id: f.def.id, x: f.x, y: f.y }))]
    .map((v) => ({ ...v, at: st.project(v.x, v.y, 30) }))
    .filter((v) => v.at.x > 0 && v.at.x < W && v.at.y > 0 && v.at.y < H);
  const p = w.player;
  const top = [...seen].sort((a, b) => a.at.y - b.at.y)[0];
  const near = [...seen].sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  const lines = [
    [top?.id, 'They are coming over the east wall while we hold the gate! Keep them away from the well!'],
    [near?.id !== top?.id ? near?.id : undefined, 'Archer! Dodge when it draws, then close in before it nocks again.'],
    ['hero', 'Stay behind me. I will hold them here.'],
  ];
  let n = 0;
  for (const [who, text] of lines) {
    if (!who) continue;
    w.story.speakNow({ who, text }, 7);
    n++;
  }
  return n;
}

/** Each pair that covers the other by more than a sliver. */
function overlaps(boxes) {
  const found = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.id === b.id && a.id !== 'speech') continue;
      if (ALLOWED.has(`${a.id}|${b.id}`) || ALLOWED.has(`${b.id}|${a.id}`)) continue;
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (w > 2 && h > 2) found.push({ a, b, w: Math.round(w), h: Math.round(h) });
    }
  }
  return found;
}

async function run() {
  const only = value('preset');
  const sizes = SIZES.filter((s) => !value('size') || s.id === value('size'));
  const secs = Number(value('secs') ?? 9);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const server = await devServer();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const report = [];
  try {
    for (const size of sizes) {
      const context = await browser.newContext({ viewport: size.viewport, hasTouch: size.touch, isMobile: size.touch, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${server.url}/sigilfall?play=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!globalThis.__rb?.ui, null, { timeout: 120_000 });
      // a phone or a tablet plays the game filling the screen
      if (size.touch) {
        const full = page.getByRole('button', { name: 'Fullscreen' });
        if (await full.count()) await full.first().click().catch(() => undefined);
      }
      await page.evaluate(() => {
        const e = globalThis.__rb;
        e.setTutorial(false);
        if (!e.heroes().some(Boolean)) e.createHero(0, 'warrior', 'Overlap', 'm', undefined, false);
        else e.play(0);
      });
      await page.waitForFunction(() => globalThis.__rb.ui.screen === 'game' && !!globalThis.__rb.world, null, { timeout: 120_000 });
      const presets = await page.evaluate(async () => (await import('/src/games/sigilfall/progress/presets.ts')).PRESETS.map((p) => ({ id: p.id, region: p.region })));
      // (the presets of the later passes, v3- and v4-, are the same moments seen again: the story's own beats are enough
      // for a run, and --all takes every one)
      const list = presets.filter((p) => (only ? p.id === only : flag('quick') ? QUICK.includes(p.id) : flag('all') ? true : !/^v\d-/.test(p.id)));
      for (const p of list) {
        await page.evaluate((id) => globalThis.__rb.usePreset(id), p.id);
        await page.waitForFunction((region) => globalThis.__rb.world?.region.id === region && !globalThis.__rb.renderer.waiting, p.region, { timeout: 60_000 }).catch(() => undefined);
        // the news a fight brings, all at once: a quest done, its reward, the next quest
        await page.evaluate(() => {
          const e = globalThis.__rb;
          e.toast('Quest complete: The Overlap Check', 'quest', undefined, '35 XP · 10 gold');
          e.toast('New quest: Nothing Covered', 'quest', undefined, 'Hold the line with Mara');
          e.toast('Low health! Press 1 to drink a potion.', 'warn');
        });
        const seen = new Set();
        // (an overlap counts once it lasts: seen in two samples running, half a second apart, not a frame of an
        // animation passing by)
        let before = new Set();
        const t0 = Date.now();
        let shot = 0;
        let spoken = 0;
        while (Date.now() - t0 < secs * 1000) {
          // once the beat's own opening has had its moment, and again later, words where they are hardest to place
          if ((spoken === 0 && Date.now() - t0 > 2500) || (spoken === 1 && Date.now() - t0 > secs * 600)) {
            await page.evaluate(speak);
            spoken++;
          }
          await page.evaluate(() => {
            const e = globalThis.__rb;
            if (e.ui.tip) e.skipTips();
            if (e.ui.story) e.closeStory();
            if (e.ui.travel) e.cancelTravel();
            if (e.ui.death) e.respawn();
            if (e.ui.dialogue) e.closeDialogue();
          });
          // scenes go on a line every second and a half or so, as a reader would take them
          if ((Date.now() - t0) % 1500 < 600) await page.evaluate(() => globalThis.__rb.world?.scene && globalThis.__rb.sceneNext());
          const boxes = await page.evaluate(measure, PIECES);
          if (flag('verbose')) console.log(`    ${p.id} ${((Date.now() - t0) / 1000).toFixed(1)}s: ${[...new Set(boxes.map((b) => b.id))].join(' ')}`);
          const now = new Set();
          for (const o of overlaps(boxes)) {
            const key = [o.a.id, o.b.id].sort().join('×');
            now.add(key);
            if (!before.has(key) || seen.has(key)) continue;
            seen.add(key);
            const file = `${size.id}-${p.id}-${++shot}.png`;
            await page.screenshot({ path: join(OUT, file) });
            report.push({ size: size.id, preset: p.id, pair: key, a: o.a.text, b: o.b.text, w: o.w, h: o.h, file });
            // (kept as it goes: a run cut short still says what it found)
            writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
            console.log(`  ${size.id.padEnd(7)} ${p.id.padEnd(22)} ${key.padEnd(18)} ${o.w}×${o.h}px  "${o.a.text}" / "${o.b.text}"`);
          }
          before = now;
          await page.waitForTimeout(500);
        }
      }
      if (errors.length) report.push(...errors.map((m) => ({ size: size.id, error: m })));
      await context.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  const bad = report.filter((r) => r.pair || r.error);
  console.log(bad.length ? `\n${bad.length} problem(s); pictures in ${OUT}` : '\nNothing on the screen covers anything else.');
  process.exit(bad.length ? 1 : 0);
}

await run();
