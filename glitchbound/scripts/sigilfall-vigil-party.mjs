/**
 * A party's night of the Vigil with two real games, through the rooms worker run on this machine: one browser opens a
 * party, a second joins it by its code, the host begins the night, and both are played by touch for a while. It checks
 * that the friend's game shows what the host's game says (the clock, the Host, the event, what stands on the ground,
 * what each hero carries) and that neither page reports an error, and takes a picture of each.
 *
 *   npx vite build                 (the pages worker serves dist/, and its functions are the API)
 *   node scripts/sigilfall-vigil-party.mjs --out docs/review/sf9-vigil-spells/party [--seconds 100] [--gpu]
 *
 * It starts the rooms worker (rooms/wrangler.toml), the pages worker over dist/ and a dev server that sends /api to
 * it, on ports of its own, and stops them when it is done.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, or) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : or;
};
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = join(ROOT, value('out', '.cache/vigil-party'));
const SECONDS = Number(value('seconds', '100'));
const ROOMS = 8796;
const PAGES = 8797;
const WRANGLER = join(ROOT, 'node_modules/wrangler/bin/wrangler.js');

const kids = [];
const logs = { rooms: '', pages: '' };
function start(name, argv) {
  const k = spawn(process.execPath, [WRANGLER, ...argv], { cwd: ROOT, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  k.stdout.on('data', (d) => (logs[name] += d));
  k.stderr.on('data', (d) => (logs[name] += d));
  kids.push(k);
}
const up = (port, ms) =>
  new Promise((done) => {
    const until = Date.now() + ms;
    const go = () => {
      const s = net.connect(port, '127.0.0.1');
      s.on('connect', () => {
        s.destroy();
        done(true);
      });
      s.on('error', () => (Date.now() > until ? done(false) : setTimeout(go, 500)));
    };
    go();
  });

const report = { steps: [], errors: [] };
const said = (text) => {
  report.steps.push(text);
  console.log(text);
};
let code = 0;
let browser;
let vite;
try {
  mkdirSync(OUT, { recursive: true });
  start('rooms', ['dev', '--config', 'rooms/wrangler.toml', '--port', String(ROOMS), '--ip', '127.0.0.1']);
  if (!(await up(ROOMS, 90_000))) throw new Error(`the rooms worker did not come up on ${ROOMS}: ${logs.rooms.slice(-400)}`);
  start('pages', ['pages', 'dev', 'dist', '--port', String(PAGES), '--ip', '127.0.0.1']);
  if (!(await up(PAGES, 120_000))) throw new Error(`the pages worker did not come up on ${PAGES}: ${logs.pages.slice(-400)}`);
  said('the rooms worker and the pages worker are up');
  process.env.GB_API = `http://127.0.0.1:${PAGES}`;
  const { createServer } = await import('vite');
  vite = await createServer({ root: ROOT, logLevel: 'silent', server: { port: 5205, strictPort: false } });
  await vite.listen();
  const url = (vite.resolvedUrls?.local?.[0] ?? 'http://localhost:5205/').replace(/\/+$/, '');
  browser = await chromium.launch({ args: flag('gpu') ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  /** One player's phone: its own device (so its own key and records), at the Vigil's lobby with a class chosen. */
  async function seat(name, cls, kept) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    await context.addInitScript((k) => {
      if (globalThis.localStorage.getItem('sigilfall.vigil.taught')) return;
      globalThis.localStorage.setItem('sigilfall.vigil.taught', '1');
      if (k) globalThis.localStorage.setItem('sigilfall.vigil.return', JSON.stringify(k));
    }, kept);
    const page = await context.newPage();
    page.on('pageerror', (e) => report.errors.push(`${name}: ${e.message.slice(0, 240)}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) report.errors.push(`${name} console: ${m.text().slice(0, 240)}`);
    });
    await page.goto(`${url}/sigilfall?play=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!globalThis.__rb?.ui, null, { timeout: 180_000 });
    await page.waitForTimeout(1500);
    await page.touchscreen.tap(62, 190);
    if (!(await page.waitForSelector('.rb-vlobby-land', { timeout: 6000 }).catch(() => null))) await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').startsWith('The Vigil:'))?.click());
    await page.waitForSelector('.rb-vlobby-land', { timeout: 60_000 });
    await page.waitForTimeout(800);
    await tapText(page, '.rb-vlobby-class', cls, true);
    return { name, page, cdp: await context.newCDPSession(page) };
  }
  async function tapText(page, selector, text, exact = false) {
    const at = await page.evaluate(
      ([sel, t, ex]) => {
        const b = [...document.querySelectorAll(sel)].filter((x) => x.offsetParent !== null && !x.disabled).find((x) => (ex ? x.textContent.trim() === t : ((x.getAttribute('aria-label') || '') + ' ' + x.textContent).includes(t)));
        if (!b) return null;
        b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect();
        return [r.x + r.width / 2, r.y + r.height / 2];
      },
      [selector, text, exact],
    );
    if (!at) throw new Error(`nothing to tap that says "${text}"`);
    await page.touchscreen.tap(at[0], at[1]);
    await page.waitForTimeout(500);
  }

  // the host carries two ranks of Hearthblood and a wild spell; the friend, a rank of Second Thoughts
  const host = await seat('host', 'Ranger', { motes: 0, boons: { hearth: 2 }, wilds: ['chain-spark'], wild: 'chain-spark' });
  const friend = await seat('friend', 'Priest', { motes: 0, boons: { rethink: 1, hearth: 3 } });
  await tapText(host.page, 'button', 'With friends');
  await tapText(host.page, 'button', 'Open a party');
  await host.page.waitForSelector('.rb-rp-code strong', { timeout: 30_000 });
  const room = await host.page.evaluate(() => document.querySelector('.rb-rp-code strong').textContent.trim());
  said(`the host opened a party: ${room}`);
  await tapText(friend.page, 'button', 'With friends');
  await friend.page.fill('.rb-rp-join input', room);
  await tapText(friend.page, '.rb-rp-join button', 'Join');
  await host.page.waitForFunction(() => document.querySelectorAll('.rb-vparty-seat:not(.is-open)').length === 2, null, { timeout: 30_000 });
  said('the friend joined by the code: two seats taken');
  await host.page.waitForTimeout(1200);
  await host.page.screenshot({ path: join(OUT, 'party-1-lobby-host.jpg'), type: 'jpeg', quality: 66 });
  await tapText(host.page, 'button', 'Begin the night');
  for (const s of [host, friend]) await s.page.waitForFunction(() => !!globalThis.__vigil?.renderer.landReady && globalThis.__vigil.renderer.objects.length > 0, null, { timeout: 240_000 });
  said('the night began on both');

  // each thumb on its stick, walking in a slow circle the other way from the other, dashing now and then; cards tapped
  const play = async (s, t, turn) => {
    const cards = await s.page.evaluate(() => {
      const g = globalThis.__vigil;
      const me = g.me;
      if (!me.cards) return null;
      const r = document.querySelector('.rb-vigil-card')?.getBoundingClientRect();
      return r ? [r.x + r.width / 2, r.y + r.height / 2] : null;
    });
    const touch = (type, points) => s.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y, id]) => ({ x, y, id })) });
    if (cards) {
      if (s.held) await touch('touchEnd', []);
      s.held = false;
      await s.page.touchscreen.tap(cards[0], cards[1]);
      return;
    }
    const a = t * 0.5 * turn;
    const at = [120 + Math.cos(a) * 44, 270 + Math.sin(a) * 44, 1];
    if (!s.held) await touch('touchStart', [[120, 270, 1]]);
    s.held = true;
    await touch('touchMove', [at]);
    if (Math.floor(t) % 7 === 0 && !s.dashed) {
      const d = await s.page.evaluate(() => {
        const r = document.querySelector('.rb-vigil-dash')?.getBoundingClientRect();
        return r ? [r.x + r.width / 2, r.y + r.height / 2] : null;
      });
      if (d) {
        await touch('touchStart', [at, [d[0], d[1], 2]]);
        await touch('touchEnd', [at]);
      }
      s.dashed = true;
    } else if (Math.floor(t) % 7 !== 0) s.dashed = false;
  };
  const state = (s) =>
    s.page.evaluate(() => {
      const { v, me } = globalThis.__vigil;
      return { t: v.t, foes: v.foes.length, level: v.level, kills: v.kills, event: v.event?.kind ?? null, events: v.eventLog.length, posts: v.posts.length, zones: v.zones.length, tip: v.tip?.text ?? null, over: v.over, me: { id: me.id, hp: Math.round(me.hp), max: Math.round(v.maxHpOf(me)), x: Math.round(me.x), y: Math.round(me.y), spells: Object.keys(me.spells), rerolls: me.rerolls, boons: me.boons, wild: me.wild }, heroes: v.heroes.map((h) => ({ id: h.id, cls: h.cls, max: Math.round(v.maxHpOf(h)), boons: h.boons, wild: h.wild, down: h.down, x: Math.round(h.x), y: Math.round(h.y) })) };
    });
  const began = Date.now();
  const checks = [];
  let shot = 0;
  for (;;) {
    const t = (Date.now() - began) / 1000;
    if (t > SECONDS) break;
    await play(host, t, 1);
    await play(friend, t, -1);
    if (t > 8 + checks.length * 12) {
      const [a, b] = [await state(host), await state(friend)];
      checks.push({ t: Math.round(t), host: a, friend: b });
      // the friend's game says what the host's says, give or take the moment between reports
      if (Math.abs(a.t - b.t) > 1.5) report.errors.push(`the clocks differ: ${a.t} and ${b.t}`);
      if (Math.abs(a.foes - b.foes) > Math.max(12, a.foes * 0.25)) report.errors.push(`the Host differs at ${Math.round(a.t)}s: ${a.foes} and ${b.foes}`);
      if (a.level !== b.level && Math.abs(a.level - b.level) > 1) report.errors.push(`the levels differ: ${a.level} and ${b.level}`);
      if (a.event !== b.event && a.events !== b.events) report.errors.push(`the events differ: ${a.event} and ${b.event}`);
      const moved = b.heroes.find((h) => h.id === a.me.id);
      if (moved && Math.hypot(moved.x - a.me.x, moved.y - a.me.y) > 60) report.errors.push(`the friend sees the host ${Math.round(Math.hypot(moved.x - a.me.x, moved.y - a.me.y))} away from where the host is`);
      if (a.over || b.over) break;
      if (shot < 3) {
        shot++;
        await host.page.screenshot({ path: join(OUT, `party-${shot + 1}-host.jpg`), type: 'jpeg', quality: 62 });
        await friend.page.screenshot({ path: join(OUT, `party-${shot + 1}-friend.jpg`), type: 'jpeg', quality: 62 });
      }
    }
    await host.page.waitForTimeout(60);
  }
  report.checks = checks;
  const last = checks[checks.length - 1];
  if (!last) throw new Error('the night was never looked at');
  // what each carried from the Watchfire reached the host's game, and the friend's game shows it
  const hostSeesFriend = last.host.heroes.find((h) => h.id === last.friend.me.id);
  const friendSeesHost = last.friend.heroes.find((h) => h.id === last.host.me.id);
  if (hostSeesFriend?.boons?.hearth !== 3) report.errors.push(`the host's game never heard what the friend carries: ${JSON.stringify(hostSeesFriend?.boons)}`);
  if (friendSeesHost?.boons?.hearth !== 2 || friendSeesHost?.wild !== 'chain-spark') report.errors.push(`the friend's game doesn't show what the host carries: ${JSON.stringify(friendSeesHost)}`);
  if (hostSeesFriend && hostSeesFriend.max !== last.friend.me.max) report.errors.push(`the friend's health is ${last.friend.me.max} on their game and ${hostSeesFriend.max} on the host's`);
  said(`looked at ${checks.length} times over ${last.t}s: clock ${Math.round(last.host.t)}s, ${last.host.foes} of the Host on the host's game and ${last.friend.foes} on the friend's, level ${last.host.level}, ${last.host.events} event(s)`);
  said(`the host sees the friend carrying ${JSON.stringify(hostSeesFriend?.boons)}; the friend sees the host carrying ${JSON.stringify(friendSeesHost?.boons)} and ${friendSeesHost?.wild}`);
} catch (e) {
  report.errors.push(`stopped: ${e.message}`);
} finally {
  report.rooms = logs.rooms.slice(-600);
  report.pages = logs.pages.slice(-600);
  writeFileSync(join(OUT, 'party.json'), `${JSON.stringify(report, null, 1)}\n`);
  await browser?.close().catch(() => undefined);
  await vite?.close().catch(() => undefined);
  for (const k of kids) k.kill('SIGTERM');
}
console.log(report.errors.length ? `${report.errors.length} problem(s): ${report.errors.slice(0, 4).join(' | ')}` : 'no problems');
if (report.errors.length) code = 1;
setTimeout(() => process.exit(code), 800);
