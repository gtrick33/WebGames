/**
 * A sheet of every Vigil spell of a class, each beside its evolution, as the game draws it at a phone's size on its side
 * (844×390, touch): one night, the spell alone at its top, a ring of the Host walking in slowly, and a picture when it
 * has gone off. Rows are the class's spells; the left column is the spell, the right its evolution (blank when it has
 * none). Each spell's picture is cropped round the hero.
 *
 *   node scripts/sigilfall-vigil-spellsheet.mjs --out docs/review/sf9-vigil-looks/after [--root <another checkout>] [--class mage] [--gpu]
 *
 * `--root` draws another checkout's game with the same script (the branch before a change), for a before and after.
 * Writes <out>/<class>.jpg and, for each spell, <out>/tiles/<class>-<spell>[-evolved].jpg.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, or) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : or;
};
const ROOT = resolve(value('root', join(HERE, '..')));
const OUT = resolve(join(HERE, '..'), value('out', '.cache/vigil-spellsheet'));
const { chromium } = createRequire(import.meta.url)('playwright');
const CLASSES = { warrior: 'Warrior', mage: 'Mage', ranger: 'Ranger', paladin: 'Paladin', priest: 'Priest', warlock: 'Warlock', druid: 'Druid', gloamknight: 'Gloamknight' };
const ONLY = value('class');
/** How long after a spell is set going to take its picture, by its kind (when its look is at its fullest). */
const WAIT = { bolt: 380, nova: 220, chain: 120, orbit: 600, strike: 470, field: 900, cone: 110, lance: 140, rain: 420, pet: 1200, aura: 600, pulse: 260, boomerang: 360, mine: 1700, totem: 1300, dash: 160, sweep: 380, ward: 450 };
const CROP = { left: 172, top: 55, width: 500, height: 290 };
const TILE_W = 400;
const TILE_H = Math.round((TILE_W * CROP.height) / CROP.width);

const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const vite = await createServer({ root: ROOT, logLevel: 'silent', server: { port: 5207, strictPort: false } });
await vite.listen();
const url = (vite.resolvedUrls?.local?.[0] ?? 'http://localhost:5207/').replace(/\/+$/, '');
const browser = await chromium.launch({ args: flag('gpu') ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
let code = 0;
try {
  mkdirSync(join(OUT, 'tiles'), { recursive: true });
  for (const [cls, name] of Object.entries(CLASSES)) {
    if (ONLY && ONLY !== cls) continue;
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    await context.addInitScript(() => {
      globalThis.localStorage.setItem('sigilfall.vigil.taught', '1');
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${cls}: ${e.message.slice(0, 200)}`));
    await page.goto(`${url}/sigilfall?play=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!globalThis.__rb?.ui, null, { timeout: 180_000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => [...globalThis.document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').startsWith('The Vigil:'))?.click());
    await page.waitForSelector('.rb-vlobby-land', { timeout: 60_000 });
    await page.waitForTimeout(800);
    await page.evaluate((n) => [...globalThis.document.querySelectorAll('.rb-vlobby-class')].find((x) => x.textContent.trim() === n)?.click(), name);
    await page.waitForTimeout(300);
    await page.evaluate(() => [...globalThis.document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Keep the watch in'))?.click());
    await page.waitForFunction(() => !!globalThis.__vigil?.renderer.landReady && globalThis.__vigil.renderer.objects.length > 0, null, { timeout: 240_000 });
    // a quiet night: nothing comes but what each picture sets down, nothing happens, and the hero stands
    const kit = await page.evaluate(async (c) => {
      const mod = await import('/src/games/sigilfall/vigil/kit.ts');
      const g = globalThis.__vigil;
      g.v.t = 20;
      g.v.nextEvent = 1e9;
      globalThis.setInterval(() => {
        g.v.spawnT = -1e9;
        g.me.hp = 1e9;
        g.me.cards = null;
        g.me.owed = 0;
        g.v.banner = null;
        g.v.tip = null;
      }, 30);
      return mod.spellsOf(c).map((s) => ({ id: s.id, name: s.name, kind: s.kind, evolve: s.evolve?.name ?? null }));
    }, cls);
    const rows = [];
    for (const s of kit) {
      const tiles = [];
      for (const evolved of [false, true]) {
        if (evolved && !s.evolve) {
          tiles.push(null);
          continue;
        }
        await page.evaluate(
          ({ id, evolved: ev }) => {
            const g = globalThis.__vigil;
            const { v, me } = g;
            me.spells = { [id]: 6 };
            me.evolved = new Set(ev ? [id] : []);
            me.took = {};
            me.built = {};
            me.cool = {};
            me.ward = 0;
            me.rev++;
            v.fx = [];
            v.shots = [];
            v.fields = [];
            v.posts = [];
            v.pets = [];
            v.slams = [];
            v.foeShots = [];
            v.sparks = [];
            v.pickups = [];
            v.foes = [];
            // a ring of the Host, walking in slowly and harmless
            const def = v.waves[0];
            for (let i = 0; i < 12; i++) {
              const a = (i / 12) * Math.PI * 2;
              const d = 70 + (i % 3) * 22;
              v.addFoe(def, null, null, { x: me.x + Math.cos(a) * d, y: me.y + Math.sin(a) * d * 0.8 });
              const f = v.foes[v.foes.length - 1];
              f.hp = f.maxHp = 1e9;
              f.dmg = 0;
              f.speed = 9;
            }
          },
          { id: s.id, evolved },
        );
        // a dash spell goes off on a dash; a pulse when hurt; a ward is seen breaking
        if (s.kind === 'dash') {
          await page.waitForTimeout(250);
          await page.evaluate(() => globalThis.dispatchEvent(new globalThis.KeyboardEvent('keydown', { code: 'Space' })));
        }
        if (s.kind === 'pulse') await page.evaluate(() => (globalThis.__vigil.me.hp = globalThis.__vigil.v.maxHpOf(globalThis.__vigil.me) * 0.5));
        await page.waitForTimeout(WAIT[s.kind] ?? 400);
        if (s.kind === 'pulse') await page.evaluate(() => (globalThis.__vigil.me.hp = 1e9));
        if (s.kind === 'ward') {
          await page.evaluate(() => {
            const g = globalThis.__vigil;
            g.me.iframe = 0;
            g.v.wound(g.me, g.me.ward + 1);
            g.me.hp = 1e9;
          });
          await page.waitForTimeout(140);
        }
        const file = join(OUT, 'tiles', `${cls}-${s.id}${evolved ? '-evolved' : ''}.jpg`);
        await page.screenshot({ path: file, type: 'jpeg', quality: 80, clip: { x: CROP.left, y: CROP.top, width: CROP.width, height: CROP.height } });
        tiles.push(file);
      }
      rows.push({ s, tiles });
      console.log(`${cls.padEnd(12)}${s.name}`);
    }
    // the sheet: a row a spell, its evolution beside it, each with its name
    const label = 26;
    const W = TILE_W * 2 + 12;
    const H = rows.length * (TILE_H + label + 6) + 40;
    const parts = [];
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/’/g, '&#8217;');
    parts.push({ input: Buffer.from(`<svg width="${W}" height="40"><text x="${W / 2}" y="28" font-family="Georgia" font-size="24" font-weight="700" fill="#ffe39a" text-anchor="middle">${esc(name)}: each spell, and its evolution</text></svg>`), top: 0, left: 0 });
    rows.forEach((r, i) => {
      const y = 40 + i * (TILE_H + label + 6);
      r.tiles.forEach((t, c) => {
        const x = c * (TILE_W + 12);
        const title = c === 0 ? `${r.s.name} (${r.s.kind})` : r.s.evolve ? `${r.s.evolve} (evolved)` : '';
        if (title) parts.push({ input: Buffer.from(`<svg width="${TILE_W}" height="${label}"><text x="4" y="19" font-family="Georgia" font-size="16" font-weight="700" fill="${c ? '#ffd257' : '#efe6d4'}">${esc(title)}</text></svg>`), top: y, left: x });
        if (t) parts.push({ input: t, top: y + label, left: x });
      });
    });
    const resized = await Promise.all(parts.map(async (p) => (typeof p.input === 'string' ? { ...p, input: await sharp(p.input).resize(TILE_W, TILE_H).toBuffer() } : p)));
    await sharp({ create: { width: W, height: H, channels: 3, background: '#0b0816' } })
      .composite(resized)
      .jpeg({ quality: 78 })
      .toFile(join(OUT, `${cls}.jpg`));
    await context.close();
  }
} catch (e) {
  errors.push(`stopped: ${e.message}`);
} finally {
  await browser.close();
  await vite.close();
}
console.log(errors.length ? `${errors.length} problem(s): ${errors.slice(0, 3).join(' | ')}` : 'no problems');
if (errors.length) code = 1;
process.exit(code);
