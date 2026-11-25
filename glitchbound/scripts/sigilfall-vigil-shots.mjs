/**
 * The Vigil's return, looked at in a browser at a phone's size (844×390, touch): the lobby with each land's rule, the
 * week's watch and the Watchfire, then a night in every land with its rule at work, each event, the new kinds of foe
 * and each champion's own attack, and the night's end with its motes.
 *
 *   node scripts/sigilfall-vigil-shots.mjs --out docs/review/sf9-vigil-return [--only lobby|lands|events|foes|champions|end|old]
 *
 * It starts its own dev server (the night's handle, `__vigil`, is the dev server's) and needs Playwright, as the tour
 * does. Each scene is set through that handle (the clock moved, an event drawn from the bag) and then left to play for
 * a moment before the picture; the hero is given health to spare so the scene stays up. Pictures are JPEGs in <out>;
 * the report, with whatever the page said went wrong, is <out>/shots.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
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
const OUT = join(ROOT, value('out') ?? '.cache/vigil-shots');
const only = value('only');
const PHONE = { width: 844, height: 390 };

const LANDS = ['Whisperwood', 'Thornvale', 'Brackenridge', 'Greyfen Marsh', 'Saltmarsh Coast', 'Ironpeak', 'Ashen Barrows', 'Sunscorch', 'Rimeheld', 'Vinecoil Jungle', 'Emberdeep Caldera', 'The Pale Reach'];
const IDS = ['whisperwood', 'thornvale', 'brackenridge', 'greyfen', 'saltmarsh', 'ironpeak', 'ashen-barrows', 'sunscorch', 'rimeheld', 'vinecoil', 'emberdeep', 'pale-reach'];

// (a part run again with --only keeps the rest of the report as it was)
const report = existsSync(join(OUT, 'shots.json')) ? JSON.parse(readFileSync(join(OUT, 'shots.json'), 'utf8')) : [];
const put = (row) => {
  const at = report.findIndex((r) => r.name === row.name);
  if (at >= 0) report[at] = row;
  else report.push(row);
};
const errors = [];

function listen(page) {
  page.on('pageerror', (e) => errors.push(`error: ${e.message.slice(0, 300)}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/\/api\/|Failed to load resource|ERR_CONNECTION|502|favicon/.test(text)) return;
    errors.push(`console: ${text.slice(0, 300)}`);
  });
}

const press = (page, text) =>
  page
    .evaluate((t) => {
      const name = (x) => `${x.getAttribute('aria-label') ?? ''} ${x.textContent ?? ''}`.replace(/\s+/g, ' ').trim().toLowerCase();
      const b = [...globalThis.document.querySelectorAll('button, [role=radio]')].filter((x) => x.offsetParent !== null && !x.disabled).find((x) => name(x).includes(t.toLowerCase()));
      if (!b) return false;
      b.click();
      return true;
    }, text)
    .catch(() => false);

/** What the device kept before tonight: every land open, the first night's card read, and (unless `old`) motes to spend. */
function keep({ old, motes }) {
  const bests = Object.fromEntries(['whisperwood', 'thornvale', 'brackenridge', 'greyfen', 'saltmarsh', 'ironpeak', 'ashen-barrows', 'sunscorch', 'rimeheld', 'vinecoil', 'emberdeep', 'pale-reach'].map((id) => [id, 320]));
  if (globalThis.localStorage.getItem('sigilfall.vigil.taught')) return;
  globalThis.localStorage.setItem('sigilfall.vigil.taught', '1');
  globalThis.localStorage.setItem('sigilfall.vigil.bests', JSON.stringify(old ? { whisperwood: 412 } : bests));
  if (old) globalThis.localStorage.setItem('sigilfall.vigil.best', '380');
  else if (motes) globalThis.localStorage.setItem('sigilfall.vigil.return', JSON.stringify({ motes, earned: motes, nights: 9 }));
}

async function open(browser, server, init) {
  const context = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await context.addInitScript(keep, init);
  const page = await context.newPage();
  listen(page);
  await page.goto(`${server.url}/sigilfall?play=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!globalThis.__rb?.ui, null, { timeout: 120_000 });
  const full = page.getByRole('button', { name: 'Fullscreen' });
  if (await full.count()) await full.first().click().catch(() => undefined);
  return { context, page };
}

async function shot(page, name, note) {
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 68 });
  const said = [...new Set(errors.splice(0))];
  put({ name, note, errors: said });
  writeFileSync(join(OUT, 'shots.json'), `${JSON.stringify(report, null, 1)}\n`);
  console.log(`${name.padEnd(34)}${said.length ? `${said.length} problem(s): ${said[0]}` : 'clean'}`);
}

async function toLobby(page) {
  await page.waitForTimeout(1500);
  if (!(await press(page, 'The Vigil:'))) errors.push('no Vigil on the title screen');
  await page.waitForSelector('.rb-vlobby-land', { timeout: 60_000 });
  await page.waitForTimeout(1500);
}

const pickLand = (page, name) =>
  page.evaluate((n) => {
    const b = [...globalThis.document.querySelectorAll('.rb-vlobby-land:not(.is-week)')].find((x) => x.querySelector('strong')?.textContent === n);
    b?.click();
    b?.scrollIntoView({ block: 'center' });
    return !!b;
  }, name);

/** Into a night in this land, its handle ready and the land drawn. */
async function night(page, land) {
  await page.evaluate(() => {
    delete globalThis.__vigil;
  });
  if (land && !(await pickLand(page, land))) errors.push(`no land called ${land}`);
  await page.waitForTimeout(300);
  if (!(await press(page, land ? 'Keep the watch in' : 'Keep the week’s watch'))) errors.push('no way to begin the night');
  await page.waitForFunction(() => !!globalThis.__vigil?.renderer.landReady && globalThis.__vigil.renderer.objects.length > 0, null, { timeout: 180_000 }).catch(() => errors.push(`the land ${land} never came up`));
  // cards are taken as they come, so a level never covers the picture
  await page.evaluate(() => {
    globalThis.clearInterval(globalThis.__vigilPick);
    globalThis.__vigilPick = globalThis.setInterval(() => {
      const g = globalThis.__vigil;
      if (g?.me.cards) g.pick(0);
    }, 250);
  });
  await page.waitForTimeout(1200);
}

async function leave(page) {
  await page.evaluate(() => globalThis.clearInterval(globalThis.__vigilPick));
  await press(page, 'Pause');
  await page.waitForTimeout(400);
  await press(page, 'Leave the Vigil');
  await page.waitForSelector('.rb-vlobby-land', { timeout: 60_000 });
  await page.waitForTimeout(600);
}

/** Runs a little of the page's own code on the night: `fn(g, arg)` with the dev handle. */
const scene = (page, fn, arg) => page.evaluate(`(${fn.toString()})(globalThis.__vigil, ${JSON.stringify(arg ?? null)})`);
const event = (g, kind) => {
  g.me.hp = 1e7;
  g.v.event = null;
  g.v.bag = [kind];
  g.v.nextEvent = 0;
};

async function run() {
  const { createServer } = await import('vite');
  const vite = await createServer({ root: ROOT, logLevel: 'silent', server: { port: 5198, strictPort: false } });
  await vite.listen();
  const server = { url: (vite.resolvedUrls?.local?.[0] ?? 'http://localhost:5198/').replace(/\/+$/, '') };
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const want = (part) => !only || only === part;
  try {
    if (want('old')) {
      // a device from before this piece: only its longest nights kept
      const { context, page } = await open(browser, server, { old: true });
      await toLobby(page);
      const kept = await page.evaluate(() => ({ bests: globalThis.localStorage.getItem('sigilfall.vigil.bests'), ret: globalThis.localStorage.getItem('sigilfall.vigil.return'), fire: globalThis.document.querySelector('.rb-vlobby-fire')?.textContent }));
      if (kept.ret !== null) errors.push('something was written for a device that has earned nothing');
      if (!/^0 motes/.test(kept.fire ?? '')) errors.push(`an old device should begin at no motes: ${kept.fire}`);
      await shot(page, 'old-01-lobby', `An old device's keep (${kept.bests}) opens the lobby: its longest night shown, no motes yet.`);
      await night(page, 'Whisperwood');
      await page.waitForTimeout(4000);
      await shot(page, 'old-02-night', 'And its night begins as any other.');
      await context.close();
    }
    if (want('lobby')) {
      const { context, page } = await open(browser, server, { motes: 120 });
      await toLobby(page);
      await shot(page, 'lobby-01-lands', 'The lands, each with its rule named on its card; the land chosen says what the rule does.');
      await pickLand(page, 'Rimeheld');
      await page.waitForTimeout(500);
      await shot(page, 'lobby-02-rimeheld', 'Rimeheld chosen: Biting Cold, and what it does.');
      await page.evaluate(() => {
        const b = globalThis.document.querySelector('.rb-vlobby-land.is-week');
        b?.click();
        b?.scrollIntoView({ block: 'start' });
      });
      await page.waitForTimeout(500);
      await shot(page, 'lobby-03-week', 'The week’s watch chosen: its land, its omen, and the bounty.');
      await press(page, 'The Watchfire');
      await page.waitForTimeout(600);
      await shot(page, 'lobby-04-watchfire', 'The Watchfire with 120 motes: boons and wild spells.');
      await press(page, 'Hearthblood');
      await press(page, 'Hearthblood');
      await press(page, 'Second Thoughts');
      await press(page, 'Call Wolf');
      await page.waitForTimeout(400);
      await shot(page, 'lobby-05-bought', 'After two ranks of Hearthblood, one of Second Thoughts and Call Wolf learned (and carried).');
      const before = await page.evaluate(() => globalThis.localStorage.getItem('sigilfall.vigil.return'));
      await page.evaluate(() => globalThis.document.querySelector('.rb-vfire')?.scrollTo(0, 9999));
      await page.waitForTimeout(300);
      await shot(page, 'lobby-06-wilds', 'The wild spells, lower on the same page.');
      // the page loaded afresh (the old one closed, a new one opened on the same device): what was bought is still there
      await page.close();
      const again = await context.newPage();
      listen(again);
      await again.goto(`${server.url}/sigilfall?play=1`, { waitUntil: 'domcontentloaded' });
      await again.waitForFunction(() => !!globalThis.__rb?.ui, null, { timeout: 180_000 });
      await toLobby(again);
      const after = await again.evaluate(() => globalThis.localStorage.getItem('sigilfall.vigil.return'));
      if (before !== after || !/"hearth":2/.test(after ?? '')) errors.push(`what was bought did not survive a reload: ${before} / ${after}`);
      await press(again, 'The Watchfire');
      await again.waitForTimeout(600);
      await shot(again, 'lobby-07-after-reload', `After the page was loaded afresh: ${after}`);
      await context.close();
    }
    if (want('lands')) {
      const { context, page } = await open(browser, server, {});
      await toLobby(page);
      /** Each land's rule at work: how the scene is set, how long it plays, and what the picture should show. */
      /** The fallen, for the rules that need them: everything in sight is felled where it stands. */
      const fell = (g) => {
        for (const f of [...g.v.foes]) if (!f.boss && Math.hypot(f.x - g.me.x, f.y - g.me.y) < 260) g.v.hurt(f, f.hp + 1);
      };
      const RULES = [
        [(g) => { g.me.hp = 40; g.v.t = 9.8; }, 'g.v.zones.some((z) => z.t > 0.6)', 'Whispering Glade: a glade of light has opened near the hero'],
        [(g) => { g.v.t = 5.8; }, 'g.v.zones.some((z) => z.t > 0.6)', 'Creeping Bramble: thorns sprouted where the hero was heading'],
        [(g) => { g.v.t = 6.9; }, 'g.v.slams.some((s) => s.t > 0.5)', 'Loose Stone: the marks where rocks are about to fall'],
        [(g) => { g.v.t = 20; }, 'g.v.t > 20.5', 'Sucking Mire: bog pools on the ground'],
        [(g) => { g.v.t = 25.8; }, 'g.v.t > 27.5', 'The Tide: it has come in, and more of the Host with it'],
        [(g) => { g.v.t = 12.6; }, '!!g.v.gale() && g.v.t > 13.6', 'Mountain Gale: blowing, with the arrow showing which way'],
        [(g) => { g.v.t = 40; }, 'g.v.foes.length > 25', 'Restless Graves: marks where the fallen are getting up', fell, 'g.v.fx.some((f) => f.kind === "grave" && f.t > 1)'],
        [(g) => { g.v.t = 25.8; }, 'g.v.storming && g.v.t > 27.5', 'Scouring Wind: a sandstorm over the field'],
        [(g) => { g.v.t = 20; }, 'g.me.chill >= 1', 'Biting Cold: the hero has stood still, and the cold is in'],
        [(g) => { g.v.t = 20; }, 'g.v.t > 20.3', 'Jungle Venom: wounded by a blow, the health bar striped while the venom bites', (g) => { g.me.hp = g.v.maxHpOf(g.me); g.v.slams.push({ x: g.me.x, y: g.me.y, r: 30, dmg: 30, t: 0.95, dur: 1 }); }, 'g.me.venom > 0 && g.me.venom < 3.4'],
        [(g) => { g.v.t = 30; }, 'g.v.t > 30.5', 'Fire Vents: vents on the ground, one or more about to erupt'],
        [(g) => { g.v.t = 40; }, 'g.v.foes.length > 25', 'Hollow Light: sparks left lying, the old ones flickering out', fell, 'g.v.sparks.some((s) => s.age > 6.6)'],
      ];
      const until = (expr) => page.waitForFunction(`(() => { const g = globalThis.__vigil; g.me.hp = Math.max(g.me.hp, 1); return ${expr}; })()`, null, { timeout: 150_000, polling: 200 }).catch(() => errors.push(`never came: ${expr}`));
      for (let i = 0; i < LANDS.length; i++) {
        if (value('land') && value('land') !== IDS[i]) continue;
        await night(page, LANDS[i]);
        await shot(page, `land-${String(i + 1).padStart(2, '0')}-${IDS[i]}-a-begins`, `${LANDS[i]}: the night begins, its rule named under the clock and said in a line.`);
        const [set, when, note, then, after] = RULES[i];
        // (no event while the rule is looked at, and health to spare unless the scene is about health)
        await scene(page, (g) => {
          g.v.nextEvent = 1e9;
          g.me.hp = 1e7;
        });
        await scene(page, set);
        await until(when);
        if (then) {
          await scene(page, then);
          await until(after);
        }
        await shot(page, `land-${String(i + 1).padStart(2, '0')}-${IDS[i]}-b-rule`, note);
        await leave(page);
      }
      await context.close();
    }
    if (want('events')) {
      const { context, page } = await open(browser, server, {});
      await toLobby(page);
      const EVENTS = [
        ['pack', 3500, 'Ashsworn Pack: three marked foes with a trait, and the card that says so'],
        ['run', 1700, 'The Wild Run: the paths are marked'],
        ['lantern', 2500, 'Dawn Lantern: a lantern stands a little way off'],
        ['thief', 2500, 'Spark Thief: marked in gold, running'],
        ['hour', 3000, 'The Ember Hour: the edge of the screen burns'],
        ['ring', 2500, 'The Closing Ring: they come from every side'],
        ['swarm', 2500, 'Night Swarm: a swarm from one side'],
      ];
      await night(page, 'Thornvale');
      let n = 0;
      for (const [kind, wait, note] of EVENTS) {
        n++;
        await scene(page, (g) => {
          g.me.hp = 1e7;
          g.v.t = 62;
          g.v.lanes = [];
        });
        await scene(page, event, kind);
        await page.waitForTimeout(wait);
        await shot(page, `event-${n}-${kind}`, note);
        if (kind === 'run') {
          await page.waitForTimeout(1500);
          await shot(page, `event-${n}-${kind}-b-herd`, 'The Wild Run: the herd comes down the first path');
        }
        if (kind === 'lantern') {
          await scene(page, (g) => {
            g.me.x = g.v.event.x;
            g.me.y = g.v.event.y + 6;
          });
          await page.waitForTimeout(2600);
          await shot(page, `event-${n}-${kind}-b-held`, 'Dawn Lantern: stood in, its light filling');
        }
        await scene(page, (g) => {
          g.v.event = null;
          for (const f of g.v.foes) if (f.elite) f.dead = true;
        });
      }
      await leave(page);
      await context.close();
    }
    if (want('foes')) {
      const { context, page } = await open(browser, server, {});
      await toLobby(page);
      await night(page, 'Whisperwood');
      // one of each kind, set down around the hero, standing still so they can be told apart
      await scene(page, (g) => {
        g.me.hp = 1e7;
        g.me.spells = {};
        g.v.nextEvent = 1e9;
        g.v.spawnT = -1e9;
        g.v.foes = [];
        const at = (ai, dx, dy) => {
          g.v.addFoe(g.v.waves.find((w) => w.ai === ai), null, null, { x: g.me.x + dx, y: g.me.y + dy });
          const f = g.v.foes[g.v.foes.length - 1];
          f.speed = 0;
          f.dmg = 0;
          return f;
        };
        at('split', -90, -30);
        at('burst', -40, 60).speed = 0;
        at('guard', 70, -10);
        at('rally', 120, 60);
        at('walk', 140, 80);
        at('walk', 100, 85);
      });
      await page.waitForTimeout(1800);
      await shot(page, 'foes-1-kinds', 'The four kinds: a Twinhusk (left), a Cinderbloat (below), a Wallbearer with its guard (right), a Hostcaller with those it heartens (far right)');
      await scene(page, (g) => {
        const husk = g.v.foes.find((f) => f.def.ai === 'split');
        const bloat = g.v.foes.find((f) => f.def.ai === 'burst');
        g.v.hurt(husk, husk.hp + 1);
        g.v.hurt(bloat, bloat.hp + 1);
      });
      await page.waitForTimeout(450);
      await shot(page, 'foes-2-fallen', 'The Twinhusk has broken in two, and the mark shows where the Cinderbloat is about to go off');
      await leave(page);
      await context.close();
    }
    if (want('champions')) {
      const { context, page } = await open(browser, server, {});
      await toLobby(page);
      const MOVES = [
        ['Whisperwood', 'rake', 600, 'The Gravewarden’s rake: three marked lines'],
        ['Whisperwood', 'charge', 600, 'The Bone Tusk’s charge: the line it will run down'],
        ['Whisperwood', 'call', 1500, 'The Ash Captain’s call: small ones run in to its side'],
        ['Thornvale', 'volley', 1700, 'The Gallows Boss’s volley: a ring of slow shots'],
        ['Greyfen Marsh', 'ring', 700, 'Mother Mire’s ring: safe close in and far out'],
      ];
      let at = '';
      let n = 0;
      for (const [land, move, wait, note] of MOVES) {
        n++;
        if (land !== at) {
          if (at) await leave(page);
          await night(page, land);
          at = land;
        }
        await scene(
          page,
          (g, m) => {
            g.me.hp = 1e7;
            g.me.spells = {};
            g.v.nextEvent = 1e9;
            g.v.spawnT = -1e9;
            g.v.foes = [];
            g.v.slams = [];
            g.v.foeShots = [];
            const c = g.v.map.champions.find((x) => x.move === m);
            g.v.addFoe(g.v.waves[0], c.name, c.sprite, { x: g.me.x + 110, y: g.me.y - 20 });
            const boss = g.v.foes[0];
            boss.cast = 1;
            boss.fireT = 0;
          },
          move,
        );
        await page.waitForTimeout(wait);
        await shot(page, `champion-${n}-${move}`, note);
      }
      await leave(page);
      await context.close();
    }
    if (want('end')) {
      const { context, page } = await open(browser, server, { motes: 5 });
      await toLobby(page);
      // the week's watch, held past its bounty, then lost
      await page.evaluate(() => globalThis.document.querySelector('.rb-vlobby-land.is-week')?.click());
      await page.waitForTimeout(400);
      await night(page, null);
      await shot(page, 'end-1-week-begins', 'The week’s watch begins: both its rules under the clock');
      await scene(page, (g) => {
        g.v.t = 200;
        g.v.feats.champions = 1;
        g.v.feats.events = 2;
        g.v.kills = 412;
        for (const h of g.v.heroes) g.v.fall(h);
      });
      await page.waitForSelector('.rb-vend', { timeout: 20_000 });
      await page.waitForTimeout(1200);
      await shot(page, 'end-2-motes', 'The night’s end: motes for the time held, the champion and the events, and the week’s bounty');
      const kept = await page.evaluate(() => globalThis.localStorage.getItem('sigilfall.vigil.return'));
      put({ name: 'end-kept', note: kept, errors: [] });
      await context.close();
    }
  } finally {
    writeFileSync(join(OUT, 'shots.json'), `${JSON.stringify(report, null, 1)}\n`);
    await browser.close();
    await vite.close();
  }
  const bad = report.filter((r) => r.errors.length);
  console.log(bad.length ? `${bad.length} stop(s) with problems` : 'no problems');
  process.exit(bad.length ? 1 : 0);
}

await run();
