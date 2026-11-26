/**
 * What a late, crowded night of the Vigil costs to draw, at a phone's size: the clock is put at nine minutes with a
 * hero who can't fall and holds two weak spells, so the Host fills the field to its most (320), and after twenty
 * seconds for it to do so the frames of the next half minute are timed.
 *
 *   node scripts/sigilfall-vigil-bench.mjs [--root <a checkout's glitchbound folder>] [--class mage] [--land Whisperwood] [--seconds 30] [--gpu] [--evolved]
 *
 * `--evolved`: the hero holds every one of the 32 spells that evolve, all at their top and all evolved, and the Host
 * can't fall, so the field stays full and every evolution keeps going off: the heaviest night there could be.
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
  await page.addInitScript((p) => {
    globalThis.__probe = p;
  }, process.env.VIGIL_PROBE ?? '');
  await page.goto(`${url}/sigilfall?play=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!globalThis.__rb?.ui, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => [...globalThis.document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').startsWith('The Vigil:'))?.click());
  await page.waitForSelector('.rb-vlobby-land', { timeout: 60_000 });
  await page.waitForTimeout(1000);
  await page.evaluate((name) => [...globalThis.document.querySelectorAll('.rb-vlobby-class')].find((x) => x.textContent.trim() === name)?.click(), CLASS_NAMES[CLS]);
  await page.evaluate((name) => [...globalThis.document.querySelectorAll('.rb-vlobby-land')].find((x) => x.querySelector('strong')?.textContent === name)?.click(), LAND);
  await page.waitForTimeout(400);
  await page.evaluate(() => [...globalThis.document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Keep the watch in'))?.click());
  await page.waitForFunction(() => !!globalThis.__vigil?.renderer.landReady && globalThis.__vigil.renderer.objects.length > 0, null, { timeout: 240_000 });
  // late in the night, five spells at their top, and a hero who stays standing; cards are taken as they come
  await page.evaluate(() => {
    const g = globalThis.__vigil;
    g.v.t = 540;
    globalThis.setInterval(() => {
      g.me.hp = 1e9;
      if (g.me.cards) g.pick(0);
      if (globalThis.__all) {
        for (const f of g.v.foes) if (!f.boss) f.hp = f.maxHp = 1e9;
      } else g.me.spells = Object.fromEntries(Object.entries(g.me.spells).slice(0, 2).map(([id]) => [id, 1]));
    }, 100);
  });
  await page.evaluate(async (all) => {
    const mod = await import('/src/games/sigilfall/vigil/kit.ts');
    const g = globalThis.__vigil;
    if (all) {
      globalThis.__all = true;
      // (every evolution there is, or with `--evolved class` the four of the hero's own class and its first spell: a
      // night a player could really have)
      const ev = all === 'class' ? mod.spellsOf(g.me.cls).filter((s, i) => s.evolve || i === 0) : mod.ALL_SPELLS.filter((s) => s.evolve);
      g.me.spells = Object.fromEntries(ev.map((s) => [s.id, 6]));
      g.me.evolved = new Set(ev.filter((s) => s.evolve).map((s) => s.id));
    }
    // (two spells, weak ones: enough going off to count, and the Host left to fill the field to its most in any checkout)
    else g.me.spells = Object.fromEntries(mod.spellsOf(g.me.cls).slice(0, 2).map((s) => [s.id, 1]));
    g.me.rev++;
  }, flag('evolved') ? (value('evolved', '') === 'class' ? 'class' : 'all') : '');
  // (the crowd comes in)
  await page.waitForTimeout(20_000);
  const out = await page.evaluate(
    (seconds) =>
      new Promise((done) => {
        const g = globalThis.__vigil;
        // (a probe: VIGIL_PROBE=noscars leaves the evolved marks off the ground, to see what they cost)
        if (globalThis.__probe === 'noscars' && Array.isArray(g.painter.scars)) g.painter.scars.push = () => 0;
        // (VIGIL_PROBE=area: how much of the screen each kind of effect covers a frame, in world pixels squared)
        const area = {};
        const fxs = g.renderer.stage?.fx;
        if (globalThis.__probe === 'area' && fxs) {
          const put = fxs.put.bind(fxs);
          fxs.put = (q) => {
            const k = String(q.kind);
            area[k] = (area[k] ?? 0) + (q.w ?? 0) * (q.h ?? q.w ?? 0);
            return put(q);
          };
        }
        // where the time goes: the night's own step, and each part of its drawing
        const cost = {};
        const timed = (o, name, label) => {
          const was = o[name].bind(o);
          o[name] = (...xs) => {
            const t0 = globalThis.performance.now();
            const r = was(...xs);
            cost[label] = (cost[label] ?? 0) + globalThis.performance.now() - t0;
            return r;
          };
        };
        timed(g.v, 'step', 'step');
        for (const part of ['frame', 'cast', 'fx', 'over']) if (typeof g.painter[part] === 'function') timed(g.painter, part, `paint.${part}`);
        timed(g.renderer, 'draw', 'draw (all)');
        const gaps = [];
        const foes = [];
        const gl = [];
        let last = globalThis.performance.now();
        const end = last + seconds * 1000;
        const tick = (now) => {
          gaps.push(now - last);
          last = now;
          if (gaps.length % 30 === 0) foes.push(g.v.foes.length);
          // (what the graphics card was asked for: draws and triangles a frame)
          const info = g.renderer.stage?.gl?.info?.render;
          if (info && gaps.length % 10 === 0) gl.push([info.calls, info.triangles]);
          if (now < end) globalThis.requestAnimationFrame(tick);
          else {
            gaps.sort((a, b) => a - b);
            const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
            done({ frames: gaps.length, mean: Math.round(mean * 10) / 10, p95: Math.round(gaps[Math.floor(gaps.length * 0.95)] * 10) / 10, worst: Math.round(gaps[gaps.length - 1] * 10) / 10, fps: Math.round(10000 / mean) / 10, foes: Math.round(foes.reduce((a, b) => a + b, 0) / Math.max(1, foes.length)), fx: g.v.fx.length, clock: Math.round(g.v.t), msPerFrame: Object.fromEntries(Object.entries(cost).map(([k, n]) => [k, Math.round((n / gaps.length) * 100) / 100])), ...(gl.length ? { drawCalls: Math.round(gl.reduce((x, y) => x + y[0], 0) / gl.length), triangles: Math.round(gl.reduce((x, y) => x + y[1], 0) / gl.length) } : {}), ...(Object.keys(area).length ? { areaPerFrame: Object.fromEntries(Object.entries(area).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([k, n]) => [k, Math.round(n / gaps.length)])) } : {}) });
          }
        };
        globalThis.requestAnimationFrame(tick);
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
