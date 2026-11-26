/**
 * Plays whole nights of the Vigil in a browser by a phone's own input: a thumb on the stick, taps on the dash button
 * and on the level-up cards, at 844×390 with touch. Nothing in the night is set by this script; it only reads where
 * things are (through the dev server's handle, `__vigil`) to decide where to push the stick, as a player reads the
 * screen. It keeps a log of each night (how long, what was taken, which events came and how they ended, what hurt)
 * and a picture every so often.
 *
 *   node scripts/sigilfall-vigil-play.mjs --out docs/review/sf9-vigil-spells/play --class mage --land Thornvale [--week] [--minutes 10] [--name mage-thornvale] [--seed 3] [--gpu]
 *
 * What it is and isn't: the input is real (touch events on the page's own controls) and the night is whole, but the
 * thumb is a simple rule (away from what is near and out of what is marked, toward sparks, chests, a lantern, a glade
 * when hurt; dash when hemmed in), not a person. Headless Chromium draws slowly, and the game slows its clock with it,
 * so the rule gets more time to think than a person would.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('This script needs Playwright: npm i --no-save playwright');
  process.exit(1);
}
const OUT = join(ROOT, value('out', '.cache/vigil-play'));
const CLS = value('class', 'mage');
const LAND = value('land', 'Whisperwood');
const WEEK = flag('week');
const MINUTES = Number(value('minutes', '10'));
const NAME = value('name', `${CLS}-${WEEK ? 'week' : LAND.toLowerCase().replace(/[^a-z]+/g, '-')}`);
const SEED = Number(value('seed', '1'));
const PHONE = { width: 844, height: 390 };
const CLASS_NAMES = { warrior: 'Warrior', mage: 'Mage', ranger: 'Ranger', paladin: 'Paladin', priest: 'Priest', warlock: 'Warlock', druid: 'Druid', gloamknight: 'Gloamknight' };

const errors = [];
let roll = SEED * 7919 + 13;
const dice = () => {
  roll = (Math.imul(roll, 1103515245) + 12345) >>> 0;
  return roll / 4294967296;
};

/** Everything the thumb's rule reads off the night, in one look. */
function look() {
  const g = globalThis.__vigil;
  if (!g) return null;
  const { v, me } = g;
  const near = (o, d) => Math.abs(o.x - me.x) < d && Math.abs(o.y - me.y) < d;
  return {
    t: v.t,
    over: v.over,
    hp: me.hp / v.maxHpOf(me),
    x: me.x,
    y: me.y,
    down: me.down,
    dash: me.dashCd <= 0,
    cards: me.cards ? me.cards.map((c) => ({ kind: c.kind, id: c.id, evolve: !!c.evolve, up: c.up })) : null,
    level: v.level,
    kills: v.kills,
    count: v.foes.length,
    foes: v.foes.filter((f) => near(f, 150)).map((f) => [f.x, f.y, f.r, f.boss ? 2 : f.trait === 4 ? 3 : f.def.ai === 'burst' ? 1 : 0, f.mode, f.aimX, f.aimY]),
    shots: v.foeShots.filter((s) => near(s, 110)).map((s) => [s.x, s.y, s.vx, s.vy]),
    slams: v.slams.map((s) => ({ in: v.inSlam(s, me.x, me.y, 8), x: s.x, y: s.y, r: s.r, len: s.len ?? 0, a: s.a ?? 0, inner: s.inner ?? 0, left: s.dur - s.t })),
    lanes: v.lanes.filter((l) => l.t > -0.3).map((l) => [l.x, l.y, l.a]),
    zones: v.zones.map((z) => [z.kind, z.x, z.y, z.r, z.t]),
    event: v.event ? { kind: v.event.kind, x: v.event.x, y: v.event.y, t: v.event.t } : null,
    sparks: v.sparks.filter((s) => near(s, 170)).slice(-40).map((s) => [s.x, s.y]),
    pickups: v.pickups.filter((p) => near(p, 320)).map((p) => [p.x, p.y, p.kind === 'chest' ? 1 : 0]),
    mire: v.rules.includes('mire') && v.inMire(me.x, me.y),
    cold: me.chill,
    gale: v.gale(),
    spells: Object.entries(me.spells).map(([id, l]) => `${id}:${l}${me.evolved.has(id) ? '*' : ''}`),
    relics: Object.entries(me.strengths).map(([id, l]) => `${id}:${l}`),
    events: [...v.eventLog],
    won: [...v.wonLog],
    felled: [...v.felledLog],
    harm: { ...v.harm },
    banner: v.banner?.text ?? '',
    tip: v.tip?.text ?? '',
    frenzies: me.frenzies,
  };
}

/**
 * The pieces of the night's HUD that are showing, and any two that cover each other (the screen check the campaign has,
 * scripts/sigilfall-overlap-check.mjs, for the Vigil's own HUD). The stick's zone is left out: it is the whole left of
 * the screen by design.
 */
function overlaps() {
  const PIECES = ['.rb-vigil-stat', '.rb-vigil-buttons', '.rb-vigil-event', '.rb-vigil-boss', '.rb-vigil-banner', '.rb-vigil-wait', '.rb-vigil-tip', '.rb-vigil-gale', '.rb-vigil-loadout', '.rb-vigil-dash'];
  const boxes = [];
  for (const sel of PIECES) {
    const el = globalThis.document.querySelector(sel);
    if (!el || !el.offsetParent || !(el.textContent || el.querySelector('img'))) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    boxes.push([sel, r.left, r.top, r.right, r.bottom]);
  }
  const out = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const [a, al, at, ar, ab] = boxes[i];
      const [b, bl, bt, br, bb] = boxes[j];
      const w = Math.min(ar, br) - Math.max(al, bl);
      const h = Math.min(ab, bb) - Math.max(at, bt);
      if (w > 2 && h > 2) out.push(`${a} over ${b} by ${Math.round(w)}x${Math.round(h)}`);
    }
  }
  return out;
}

/** Where to push the stick: a sum of pulls and pushes. Returns [x, y, dash]. */
function steer(s, wander) {
  let x = Math.cos(wander) * 0.25;
  let y = Math.sin(wander) * 0.25;
  let hemmed = 0;
  let danger = false;
  for (const [fx, fy, r, kind, mode, ax, ay] of s.foes) {
    const dx = s.x - fx;
    const dy = s.y - fy;
    const d = Math.max(4, Math.hypot(dx, dy) - r);
    // a thief is chased, a Cinderbloat and a champion given more room
    if (kind === 3) {
      x -= (dx / d) * 0.8;
      y -= (dy / d) * 0.8;
      continue;
    }
    const reach = kind === 2 ? 110 : kind === 1 ? 90 : 70;
    if (d < reach) {
      const push = ((reach - d) / reach) ** 2 * (kind ? 5 : 3);
      x += (dx / d) * push;
      y += (dy / d) * push;
      if (d < 26) hemmed++;
    }
    // out of a charger's line while it winds up
    if (mode === 1 && d < 170) {
      const side = dx * ay - dy * ax;
      x += -ay * Math.sign(side || 1) * -2.5;
      y += ax * Math.sign(side || 1) * -2.5;
    }
  }
  for (const [sx, sy, vx, vy] of s.shots) {
    const dx = s.x - sx;
    const dy = s.y - sy;
    const sp = Math.hypot(vx, vy) || 1;
    const along = (dx * vx + dy * vy) / sp;
    const off = (dx * vy - dy * vx) / sp;
    if (along > 0 && along < 90 && Math.abs(off) < 18) {
      x += (vy / sp) * Math.sign(off || 1) * 3;
      y += (-vx / sp) * Math.sign(off || 1) * 3;
    }
  }
  for (const m of s.slams) {
    if (!m.in) continue;
    danger = true;
    if (m.len) {
      // off the line, sideways
      const side = (s.x - m.x) * Math.sin(m.a) - (s.y - m.y) * Math.cos(m.a);
      x += Math.sin(m.a) * Math.sign(side || 1) * 8;
      y += -Math.cos(m.a) * Math.sign(side || 1) * 8;
    } else {
      const dx = s.x - m.x;
      const dy = s.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      // a ring that is safe close in: whichever edge is nearer
      const inward = m.inner && d - m.inner < m.r - d;
      x += (dx / d) * (inward ? -8 : 8);
      y += (dy / d) * (inward ? -8 : 8);
    }
  }
  for (const [lx, ly, a] of s.lanes) {
    const side = (s.x - lx) * Math.sin(a) - (s.y - ly) * Math.cos(a);
    if (Math.abs(side) < 34) {
      danger = true;
      x += Math.sin(a) * Math.sign(side || 1) * 8;
      y += -Math.cos(a) * Math.sign(side || 1) * 8;
    }
  }
  for (const [kind, zx, zy, r, t] of s.zones) {
    const dx = zx - s.x;
    const dy = zy - s.y;
    const d = Math.hypot(dx, dy) || 1;
    if (kind === 'glade' && s.hp < 0.8 && d < 260) {
      x += (dx / d) * 2.2;
      y += (dy / d) * 2.2;
    }
    if (kind === 'bramble' && t > -1 && d < r + 10) {
      x -= (dx / d) * 4;
      y -= (dy / d) * 4;
    }
  }
  if (s.event?.kind === 'lantern') {
    const dx = s.event.x - s.x;
    const dy = s.event.y - s.y;
    const d = Math.hypot(dx, dy) || 1;
    const pull = d > 20 ? 2.6 : 0.3;
    x += (dx / d) * pull;
    y += (dy / d) * pull;
  }
  // sparks and what lies about, when nothing is pressing
  let best = null;
  let bd = 1e9;
  for (const [px, py, chest] of s.pickups) {
    const d = Math.hypot(px - s.x, py - s.y) / (chest ? 3 : 1.5);
    if (d < bd) {
      bd = d;
      best = [px, py];
    }
  }
  for (const [px, py] of s.sparks) {
    const d = Math.hypot(px - s.x, py - s.y);
    if (d < bd) {
      bd = d;
      best = [px, py];
    }
  }
  if (best) {
    const d = Math.hypot(best[0] - s.x, best[1] - s.y) || 1;
    x += ((best[0] - s.x) / d) * 1.1;
    y += ((best[1] - s.y) / d) * 1.1;
  }
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len, s.dash && (hemmed >= 3 || (danger && hemmed >= 1) || (s.mire && hemmed >= 1))];
}

/** Which card to tap: an evolution, then a new spell while there is room, then at the dice's whim. */
function choose(cards) {
  const evolve = cards.findIndex((c) => c.evolve);
  if (evolve >= 0) return evolve;
  const spells = cards.map((c, i) => [c, i]).filter(([c]) => c.kind === 'spell');
  if (spells.length && dice() < 0.7) return spells[Math.floor(dice() * spells.length)][1];
  return Math.floor(dice() * cards.length);
}

async function run() {
  const { createServer } = await import('vite');
  const vite = await createServer({ root: ROOT, logLevel: 'silent', server: { port: 5201, strictPort: false } });
  await vite.listen();
  const url = (vite.resolvedUrls?.local?.[0] ?? 'http://localhost:5201/').replace(/\/+$/, '');
  const browser = await chromium.launch({ args: flag('gpu') ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  // (a device that has kept watch before: every land open, the first night's card read; nothing bought)
  await context.addInitScript(() => {
    if (globalThis.localStorage.getItem('sigilfall.vigil.taught')) return;
    globalThis.localStorage.setItem('sigilfall.vigil.taught', '1');
    globalThis.localStorage.setItem('sigilfall.vigil.bests', JSON.stringify(Object.fromEntries(['whisperwood', 'thornvale', 'brackenridge', 'greyfen', 'saltmarsh', 'ironpeak', 'ashen-barrows', 'sunscorch', 'rimeheld', 'vinecoil', 'emberdeep', 'pale-reach'].map((id) => [id, 300]))));
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`error: ${e.message.slice(0, 300)}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/\/api\/|Failed to load resource|ERR_CONNECTION|502|favicon/.test(m.text())) errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y, id]) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 })) });
  // (a tap on a button or a card is Playwright's own touch tap; the stick and the dash are held and moved by hand, above)
  const tap = (x, y) => page.touchscreen.tap(x, y);
  const tapOn = async (find) => {
    const at = await page.evaluate(find);
    if (!at) return false;
    await tap(at[0], at[1]);
    return true;
  };
  const button = (text) =>
    `(() => { const b = [...globalThis.document.querySelectorAll('button, [role=radio]')].filter((x) => x.offsetParent !== null && !x.disabled).find((x) => ((x.getAttribute('aria-label') || '') + ' ' + (x.textContent || '')).replace(/\\s+/g, ' ').toLowerCase().includes(${JSON.stringify(text.toLowerCase())})); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`;

  const log = { name: NAME, class: CLS, land: WEEK ? 'the week’s watch' : LAND, seed: SEED, samples: [], picks: [], errors };
  mkdirSync(OUT, { recursive: true });
  try {
    await page.goto(`${url}/sigilfall?play=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!globalThis.__rb?.ui, null, { timeout: 180_000 });
    const full = page.getByRole('button', { name: 'Fullscreen' });
    if (await full.count()) await full.first().click().catch(() => undefined);
    await page.waitForTimeout(1500);
    // (the title's banners are drawn in its hall: the Vigil's hangs at the left. If the tap on the picture doesn't take,
    // its button for screen readers is pressed instead, and the log says so)
    await tap(62, 190);
    if (!(await page.waitForSelector('.rb-vlobby-land', { timeout: 6000 }).catch(() => null))) {
      log.note = 'the Vigil’s banner on the title did not answer a tap at (62, 190): its screen-reader button was pressed instead';
      await page.evaluate(() => [...globalThis.document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').startsWith('The Vigil:'))?.click());
    }
    await page.waitForSelector('.rb-vlobby-land', { timeout: 60_000 });
    await page.waitForTimeout(1200);
    if (!(await tapOn(`(() => { const b = [...globalThis.document.querySelectorAll('.rb-vlobby-class')].find((x) => x.textContent.trim() === ${JSON.stringify(CLASS_NAMES[CLS])}); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`))) throw new Error(`no class ${CLS}`);
    await page.waitForTimeout(500);
    const land = WEEK ? `globalThis.document.querySelector('.rb-vlobby-land.is-week')` : `[...globalThis.document.querySelectorAll('.rb-vlobby-land:not(.is-week)')].find((x) => x.querySelector('strong')?.textContent === ${JSON.stringify(LAND)})`;
    if (!(await tapOn(`(() => { const b = ${land}; if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`))) throw new Error(`no land ${LAND}`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT, `${NAME}-00-lobby.jpg`), type: 'jpeg', quality: 66 });
    if (!(await tapOn(button(WEEK ? 'Keep the week’s watch' : 'Keep the watch in')))) throw new Error('no way to begin');
    await page.waitForFunction(() => !!globalThis.__vigil?.renderer.landReady && globalThis.__vigil.renderer.objects.length > 0, null, { timeout: 240_000 });
    await page.waitForTimeout(800);

    // the thumb goes down on the stick's side of the screen and stays there
    const base = [120, 270];
    let held = false;
    const push = async (x, y, dash) => {
      const at = [base[0] + x * 46, base[1] + y * 46, 1];
      if (!held) {
        await touch('touchStart', [[base[0], base[1], 1]]);
        held = true;
      }
      await touch('touchMove', [at]);
      if (dash) {
        const d = await page.evaluate(() => {
          const r = globalThis.document.querySelector('.rb-vigil-dash')?.getBoundingClientRect();
          return r ? [r.x + r.width / 2, r.y + r.height / 2] : null;
        });
        if (d) {
          await touch('touchStart', [at, [d[0], d[1], 2]]);
          await touch('touchEnd', [at]);
        }
      }
    };
    const lift = async () => {
      if (held) await touch('touchEnd', []);
      held = false;
    };

    const began = Date.now();
    let nextSample = 0;
    let shots = 0;
    let last = null;
    let seenEvents = 0;
    let dashes = 0;
    let looks = 0;
    const covered = {};
    for (;;) {
      const s = await page.evaluate(look);
      if (!s) break;
      last = s;
      if (s.over || s.t >= MINUTES * 60) break;
      if (s.cards) {
        // a level: the thumb comes off the stick and taps a card
        await lift();
        await page.waitForTimeout(350);
        const i = choose(s.cards);
        log.picks.push({ t: Math.round(s.t), level: s.level, offered: s.cards.map((c) => `${c.kind}:${c.up ?? c.id}${c.evolve ? '*' : ''}`), took: i });
        if (shots < 3) await page.screenshot({ path: join(OUT, `${NAME}-cards-${++shots}.jpg`), type: 'jpeg', quality: 66 });
        await tapOn(`(() => { const b = globalThis.document.querySelectorAll('.rb-vigil-card')[${i}]; if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
        await page.waitForTimeout(250);
        continue;
      }
      // the screen check, a few times a second: what covers what, and for how many looks
      if (++looks % 6 === 0) for (const o of await page.evaluate(overlaps)) covered[o] = (covered[o] ?? 0) + 1;
      const [x, y, dash] = steer(s, s.t * 0.6);
      if (dash) dashes++;
      await push(x, y, dash);
      if (s.t >= nextSample || s.events.length > seenEvents) {
        const event = s.events.length > seenEvents;
        seenEvents = s.events.length;
        if (!event) nextSample += 20;
        log.samples.push({ t: Math.round(s.t), real: Math.round((Date.now() - began) / 1000), hp: Math.round(s.hp * 100), level: s.level, kills: s.kills, foes: s.count, event: s.event?.kind ?? null, banner: s.banner, tip: s.tip });
        if (event) await page.waitForTimeout(700);
        await page.screenshot({ path: join(OUT, `${NAME}-${String(Math.round(s.t)).padStart(3, '0')}${event ? `-${s.events[s.events.length - 1]}` : ''}.jpg`), type: 'jpeg', quality: 62 });
      }
      await page.waitForTimeout(45);
    }
    await lift();
    await page.waitForTimeout(1800);
    await page.screenshot({ path: join(OUT, `${NAME}-end.jpg`), type: 'jpeg', quality: 70 });
    if (last) {
      Object.assign(log, { held: Math.round(last.t), ended: last.over ? 'the line broke' : `stopped at ${MINUTES} minutes`, real: Math.round((Date.now() - began) / 1000), level: last.level, kills: last.kills, spells: last.spells, relics: last.relics, events: last.events, won: last.won, felled: last.felled, frenzies: last.frenzies, dashes, overlaps: covered, harm: Object.fromEntries(Object.entries(last.harm).map(([k, n]) => [k, Math.round(n)]).sort((a, b) => b[1] - a[1])) });
      log.endText = await page.evaluate(() => globalThis.document.querySelector('.rb-vend-body')?.innerText ?? '');
      log.kept = await page.evaluate(() => globalThis.localStorage.getItem('sigilfall.vigil.return'));
    }
  } catch (e) {
    errors.push(`stopped: ${e.message}`);
    await page.screenshot({ path: join(OUT, `${NAME}-stopped.jpg`), type: 'jpeg', quality: 60 }).catch(() => undefined);
  } finally {
    writeFileSync(join(OUT, `${NAME}.json`), `${JSON.stringify(log, null, 1)}\n`);
    await browser.close();
    await vite.close();
  }
  console.log(`${NAME}: held ${log.held ?? '?'}s (${log.ended ?? 'did not finish'}), level ${log.level ?? '?'}, ${log.kills ?? '?'} felled, in ${log.real ?? '?'}s of real time; ${errors.length} problem(s)${errors.length ? `: ${errors[0]}` : ''}`);
  process.exit(errors.length ? 1 : 0);
}

await run();
