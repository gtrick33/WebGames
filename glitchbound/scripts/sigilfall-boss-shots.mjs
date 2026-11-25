/**
 * Pictures of a boss for review (NINE_PLAN.md, piece 2): beside the hero and its soldiers, in each of its states, at
 * the size a phone shows it and close up.
 *
 *   node scripts/sigilfall-boss-shots.mjs --boss coffin-matron --out docs/review/sf9-boss-matron [--size phone|desktop]
 *   node scripts/sigilfall-boss-shots.mjs --boss coffin-matron --out … --tag before      (file names begin "before-")
 *   node scripts/sigilfall-boss-shots.mjs --boss coffin-matron --only-look              (the line-up and the portrait)
 *   node scripts/sigilfall-boss-shots.mjs --boss coffin-matron --only-fall              (those, then dazed, struck and its death)
 *   node scripts/sigilfall-boss-shots.mjs --boss coffin-matron --motion                 (in motion: does it walk, has every attack a move)
 *
 * A review hero walks into the boss's own room in its own dungeon, so everything is the game's: the arena, the light,
 * the rules' timing. The fight is then led by hand, one state at a time, and each is pictured twice: the whole screen
 * as a phone shows it, and the boss close up (the same picture, cut round it and doubled).
 *
 * - line-up: the boss standing by the hero and two of its soldiers; then a portrait, far closer than the game shows.
 * - entrance: as it is shown for the first time, five moments close up.
 * - each attack of each phase: in the middle of its wind-up (its telegraph on the ground), and as it strikes.
 * - each phase change, dazed, struck, and its death, nine moments close up.
 *
 * It starts its own dev server and needs Playwright, as the screen check does. Writes <out>/<tag->NN-<state>.jpg and
 * <out>/<tag->shots.json (what was pictured, the boss's cost in triangles, and anything the page reported).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
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
const BOSS = value('boss');
if (!BOSS) {
  console.error('Which boss? --boss coffin-matron');
  process.exit(1);
}
const OUT = join(ROOT, value('out') ?? `.cache/boss-shots/${BOSS}`);
const TAG = value('tag') ? `${value('tag')}-` : '';

const SIZES = {
  phone: { viewport: { width: 844, height: 390 }, touch: true },
  desktop: { viewport: { width: 1440, height: 900 }, touch: false },
};

async function run() {
  const size = SIZES[value('size') ?? 'phone'];
  mkdirSync(OUT, { recursive: true });
  const { createServer } = await import('vite');
  const vite = await createServer({ root: ROOT, logLevel: 'silent', server: { port: 5195, strictPort: false } });
  await vite.listen();
  const url = (vite.resolvedUrls?.local?.[0] ?? 'http://localhost:5195/').replace(/\/+$/, '');
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const report = { boss: BOSS, shots: [], errors: [] };
  try {
    const context = await browser.newContext({ viewport: size.viewport, hasTouch: size.touch, isMobile: size.touch, deviceScaleFactor: 2 });
    const page = await context.newPage();
    page.on('pageerror', (e) => report.errors.push(`error: ${e.message.slice(0, 300)}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/\/api\/|Failed to load resource|ERR_CONNECTION|502|favicon/.test(m.text())) report.errors.push(`console: ${m.text().slice(0, 300)}`);
    });
    await page.goto(`${url}/sigilfall?play=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!globalThis.__rb?.ui, null, { timeout: 120_000 });
    if (size.touch) {
      const full = page.getByRole('button', { name: 'Fullscreen' });
      if (await full.count()) await full.first().click().catch(() => undefined);
    }
    await page.evaluate(() => {
      const e = globalThis.__rb;
      e.setTutorial(false);
      e.createHero(0, 'warrior', 'Review', 'm', undefined, false);
    });
    await page.waitForFunction(() => globalThis.__rb.ui.screen === 'game' && !!globalThis.__rb.world && !globalThis.__rb.renderer.waiting, null, { timeout: 180_000 });

    // into the boss's own room: a review hero of the dungeon's level, every other room's fight left alone
    const where = await page.evaluate(async (boss) => {
      const e = globalThis.__rb;
      const { REGIONS, REGION_IDS } = await import('/src/games/sigilfall/data/regions.ts');
      const { BOSSES } = await import('/src/games/sigilfall/data/bosses.ts');
      const { addXp } = await import('/src/games/sigilfall/progress/character.ts');
      const { xpToNext } = await import('/src/games/sigilfall/data/classes.ts');
      if (!BOSSES[boss]) return { error: `no boss ${boss}` };
      const region = REGION_IDS.find((id) => (REGIONS[id].encounters ?? []).some((x) => x.boss === boss));
      if (!region) return { error: `${boss} has no room of its own` };
      const h = e.hero;
      h.review = true;
      for (let g = 0; h.level < REGIONS[region].levels[0] + 2 && g < 80; g++) addXp(h, xpToNext(h.level));
      if (!h.unlocked.includes(region)) h.unlocked.push(region);
      if (!e.travel(region, 0, [])) return { error: `the way into ${region} is shut` };
      return { region, name: BOSSES[boss].name, phases: BOSSES[boss].phases.map((p) => ({ at: p.at, enter: (p.enter ?? []).map((u) => u.id), patterns: p.patterns.map((u) => u.id) })) };
    }, BOSS);
    if (where.error) throw new Error(where.error);
    await page.waitForFunction((region) => globalThis.__rb.world?.region.id === region && !globalThis.__rb.renderer.waiting, where.region, { timeout: 120_000 });

    /** Runs in the page: what the script asks of the fight. */
    const fight = (what, arg) =>
      page.evaluate(
        async ([what, boss, arg]) => {
          const e = globalThis.__rb;
          const w = e.world;
          const p = w.player;
          p.iframe = 99;
          p.hp = p.maxHp;
          if (e.ui.tip) e.skipTips();
          if (e.ui.story) e.closeStory();
          const foe = w.enemies.find((x) => x.boss?.def.id === boss && !x.dead) ?? w.enemies.find((x) => x.boss?.def.id === boss);
          // (where it last stood: its fall is pictured there once the rules have let go of it)
          if (foe) globalThis.__sfBossAt = { x: foe.x, y: foe.y };
          const { TILE } = await import('/src/games/sigilfall/sim/map.ts');
          switch (what) {
            case 'enter': {
              const enc = w.encounters.find((x) => x.def.boss === boss);
              const tiles = (w.map.roomTiles[enc.index] ?? []).filter((t) => !w.map.solid[t]);
              // (a tile of the room's own, two thirds of the way down it: the boss comes out further up)
              const mid = tiles[Math.floor(tiles.length * 0.66)];
              // (the other rooms' doors would hold the hero back: their fights count as won)
              for (const o of w.encounters) if (o !== enc && o.state !== 'cleared') o.state = 'cleared';
              p.x = ((mid % w.map.w) + 0.5) * TILE;
              p.y = (Math.floor(mid / w.map.w) + 0.5) * TILE;
              return true;
            }
            case 'there':
              return !!foe;
            case 'time':
              return w.time;
            case 'freeze':
              // the fight holds still while its picture is taken (the rules' own pause on a heavy blow, held)
              w.hitstopT = arg ? 600 : 0;
              return true;
            case 'scene':
              return w.scene?.def.id ?? null;
            case 'skip':
              if (w.scene) e.skipScene();
              return true;
            case 'hold': {
              // it stands, and so does everything of its own: the line-up
              if (!foe) return false;
              // (not `held`, which is the story holding it in a shot: it would go on with its entrance)
              foe.speedMul = arg ? 0 : 1;
              if (arg) {
                foe.boss.pattern = null;
                foe.boss.rest = 99;
                w.clearHostile();
                p.x = foe.x - 34;
                p.y = foe.y + 6;
                const gone = (o) => {
                  o.hp = 0;
                  o.dead = true;
                  o.deathT = 9;
                };
                for (const o of w.enemies) if (o !== foe && !o.dead && !o.boss) gone(o);
                const before = new Set(w.enemies);
                w.spawnAdd('skeleton', foe.x + 30, foe.y + 8, foe.room);
                w.spawnAdd('skeleton', foe.x + 50, foe.y - 2, foe.room);
                for (const m of w.enemies) {
                  if (before.has(m)) continue;
                  m.held = true;
                  m.aggro = false;
                  m.state = 'idle';
                  m.t = 0;
                }
              } else {
                for (const o of w.enemies) {
                  if (o === foe || o.boss) continue;
                  o.dead = true;
                  o.deathT = 9;
                }
                foe.boss.rest = 0.1;
                p.x = foe.x - 70;
                p.y = foe.y + 30;
              }
              return true;
            }
            case 'pattern': {
              // its next attack is the one asked for (the queue is what a phase's opening uses)
              if (!foe) return false;
              const phase = foe.boss.def.phases[foe.boss.phase];
              const use = [...phase.patterns, ...(phase.enter ?? [])].find((u) => u.id === arg);
              if (!use) return false;
              w.clearHostile();
              foe.boss.pattern = null;
              foe.boss.dazed = 0;
              foe.boss.cds[use.id] = 0;
              foe.boss.queue = [use];
              foe.boss.rest = 0;
              return true;
            }
            case 'state':
              return foe ? { pattern: foe.boss.pattern?.use.id ?? null, t: foe.boss.pattern?.t ?? 0, step: foe.boss.pattern?.step ?? 0, phase: foe.boss.phase, shift: foe.boss.shift, dying: foe.boss.dying, dead: foe.dead, hidden: foe.boss.pattern?.data.hide === 1, marks: w.telegraphs.filter((t) => !t.dead).length } : null;
            case 'daze': {
              // dazed, as the rules have it when it is found out or struck down for a moment
              if (!foe) return false;
              w.clearHostile();
              foe.boss.pattern = null;
              foe.boss.dazed = arg;
              return true;
            }
            case 'phase': {
              const next = foe?.boss.def.phases[foe.boss.phase + 1];
              if (!next) return false;
              foe.boss.pattern = null;
              foe.hp = foe.maxHp * next.at - 1;
              return true;
            }
            case 'strike': {
              const { hitEnemy } = await import('/src/games/sigilfall/sim/combat.ts');
              // (the last blow finds it out in the open, whatever it was in the middle of)
              if (foe && arg > 1e6) {
                foe.boss.pattern = null;
                foe.boss.dazed = 0;
                w.clearHostile();
              }
              if (foe) hitEnemy(w, foe, arg, 'physical', { depth: 0 });
              return true;
            }
            case 'zoom': {
              // a closer look than the game ever gives: for looking at the model, not at the fight
              const r = e.renderer;
              const [cw, ch, dpr, touch, phone] = r.sized;
              if (arg === 1) r.resize(cw, ch, dpr, touch, phone);
              else r.stageNow().setSize(cw, ch, dpr, ((ch * dpr) / (touch ? 216 : 300)) * TILE * arg, phone);
              return true;
            }
            case 'box': {
              // where it is on the screen, with room round it for what it carries and casts
              const r = e.renderer;
              const c = r.canvas.getBoundingClientRect();
              const at = foe ?? globalThis.__sfBossAt ?? p;
              const feet = r.toScreenAt(at.x, at.y, 0);
              const kx = c.width / (r.viewW || c.width);
              const ky = c.height / (r.viewH || c.height);
              return { x: c.left + feet.x * kx, y: c.top + feet.y * ky };
            }
            case 'anim': {
              // how it is being drawn this instant: its clip and how far through, how fast it really moves, and whether
              // its kit lifts it off the ground (render3d/worldCast.ts FoeAnim, render3d/kits.ts float)
              if (!foe) return null;
              const a = e.renderer.people?.foes?.get(foe.id);
              const { kitOf } = await import('/src/games/sigilfall/render3d/kits.ts');
              const { bossHidden } = await import('/src/games/sigilfall/sim/boss.ts');
              const kit = kitOf(foe.boss.def.sprite, foe.def.id);
              return { clip: a?.clip ?? null, t: a?.t ?? 0, speed: a?.speed ?? 0, state: foe.state, pattern: foe.boss.pattern?.use.id ?? null, hidden: bossHidden(foe), float: kit.float ?? 0, form: kit.form ?? null, file: kit.k };
            }
            case 'record': {
              // reads it sixteen times a second from inside the page (a reading asked for from outside takes too long
              // on a slow machine to catch a blow), until the readings are taken
              const { kitOf } = await import('/src/games/sigilfall/render3d/kits.ts');
              const { bossHidden } = await import('/src/games/sigilfall/sim/boss.ts');
              globalThis.clearInterval(globalThis.__sfRecT);
              globalThis.__sfRec = [];
              globalThis.__sfRecT = globalThis.setInterval(() => {
                const ww = globalThis.__rb.world;
                const f = ww?.enemies.find((x) => x.boss?.def.id === boss);
                if (!f) return;
                const a = globalThis.__rb.renderer.people?.foes?.get(f.id);
                globalThis.__sfRec.push({ clip: a?.clip ?? null, t: a?.t ?? 0, speed: a?.speed ?? 0, pattern: f.boss.pattern?.use.id ?? null, began: f.boss.began?.id ?? null, hidden: bossHidden(f), shift: f.boss.shift > 0, x: Math.round(f.x), y: Math.round(f.y), dazed: f.boss.dazed > 0, stun: f.statuses.some((q) => q.id === 'stun') });
              }, 60);
              const kit = foe ? kitOf(foe.boss.def.sprite, foe.def.id) : null;
              return { float: kit?.float ?? 0, form: kit?.form ?? null, file: kit?.k ?? null };
            }
            case 'recorded': {
              const out = globalThis.__sfRec ?? [];
              globalThis.__sfRec = [];
              return out;
            }
            case 'near': {
              // the hero beside it, so that it and what it does are both on a phone's short screen
              if (!foe) return false;
              p.x = foe.x - 62;
              p.y = foe.y + 14;
              return true;
            }
            case 'walk': {
              // nothing to do but come: its attacks wait, its helpers are gone, and the hero stands well off
              if (!foe) return false;
              w.clearHostile();
              foe.boss.pattern = null;
              foe.boss.queue = [];
              foe.boss.rest = arg;
              // (and nothing left over from a rush cut short: not stunned against a wall, not sliding)
              foe.boss.dazed = 0;
              foe.statuses.length = 0;
              foe.vx = 0;
              foe.vy = 0;
              foe.state = 'chase';
              for (const o of w.enemies) {
                if (o === foe || o.boss || o.dead) continue;
                o.hp = 0;
                o.dead = true;
                o.deathT = 9;
              }
              // (a tile of its own room, as far from it as the room gives within ten tiles)
              const enc = w.encounters.find((x) => x.def.boss === boss);
              let far = null;
              let best = 0;
              for (const t of w.map.roomTiles[enc.index] ?? []) {
                if (w.map.solid[t]) continue;
                const q = { x: ((t % w.map.w) + 0.5) * TILE, y: (Math.floor(t / w.map.w) + 0.5) * TILE };
                const d = Math.hypot(q.x - foe.x, q.y - foe.y);
                // (to the side of it, so that both stay on a phone's short screen)
                if (d > best && d < TILE * 10 && Math.abs(q.y - foe.y) < TILE * 2.5) {
                  best = d;
                  far = q;
                }
              }
              if (far) {
                p.x = far.x;
                p.y = far.y;
              }
              return !!far;
            }
            case 'cost': {
              const cast = e.renderer.stage?.cast;
              const { kitOf } = await import('/src/games/sigilfall/render3d/kits.ts');
              const kit = foe ? kitOf(foe.boss.def.sprite, foe.def.id) : null;
              let tris = null;
              for (const [id, k] of cast?.kits ?? []) if (kit && id.startsWith(kit.k) && k.mesh) tris = Math.round(k.mesh.i / 3);
              return { file: kit?.k ?? null, tris, frame: e.renderer.frameCost?.() ?? null };
            }
            default:
              return null;
          }
        },
        [what, BOSS, arg],
      );

    let n = 0;
    const shot = async (state) => {
      const file = `${TAG}${String(++n).padStart(2, '0')}-${state}.jpg`;
      await fight('freeze', true);
      await page.waitForTimeout(120);
      await page.screenshot({ path: join(OUT, file), type: 'jpeg', quality: 78 });
      const at = await fight('box');
      const w = 300;
      const h = 250;
      const clip = { x: Math.max(0, Math.min(size.viewport.width - w, at.x - w / 2)), y: Math.max(0, Math.min(size.viewport.height - h, at.y - h * 0.68)), width: w, height: h };
      const close = file.replace('.jpg', '-close.jpg');
      await page.screenshot({ path: join(OUT, close), type: 'jpeg', quality: 86, clip });
      await fight('freeze', false);
      report.shots.push({ state, file, close });
      console.log(`  ${file}`);
    };
    /** A close-up alone, taken at once: for what goes by the picture's own clock (an entrance, a fall) and can't be held. */
    const quick = async (state) => {
      const at = await fight('box');
      const w = 300;
      const h = 250;
      const clip = { x: Math.max(0, Math.min(size.viewport.width - w, at.x - w / 2)), y: Math.max(0, Math.min(size.viewport.height - h, at.y - h * 0.68)), width: w, height: h };
      const close = `${TAG}${String(++n).padStart(2, '0')}-${state}-close.jpg`;
      await page.screenshot({ path: join(OUT, close), type: 'jpeg', quality: 86, clip });
      report.shots.push({ state, close });
      console.log(`  ${close}`);
    };
    const until = async (test, ms) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (await test()) return true;
        await page.waitForTimeout(40);
      }
      return false;
    };
    /** Waits by the fight's own clock, so a slow machine pictures the same moments as a fast one. */
    const wait = async (ms) => {
      const t0 = await fight('time');
      await until(async () => (await fight('time')) >= t0 + ms / 1000, ms * 30 + 8000);
    };

    /**
     * `--motion`: the boss in motion, not held still. It walks to the hero with nothing else to do, then makes each of
     * its attacks in every phase, in the fight's own time. All the while what it is drawn with is read ten times a
     * second (its clip, how far through, how fast it is really moving), and six pictures are taken a fifth of a
     * second apart: one strip per state, all on `<tag->motion.jpg`. `<tag->motion.json` has what was read and what is
     * wrong: moving without a walk, an attack with no move of its own, or a kit that lifts it off the ground.
     */
    const motion = async () => {
      const sharp = createRequire(import.meta.url)('sharp');
      const fw = Math.round(size.viewport.width / 2);
      const fh = Math.round(size.viewport.height / 2);
      const rows = [];
      const found = [];
      // (stop-motion: the fight is held for each picture and let run a sixth of a second of its own time between
      // them, so the six are the same moments of a move on a slow machine as on a fast one)
      const strip = async (label, ms, keep = false) => {
        // (`keep`: the readings so far are part of this one: a move that began before the first picture could be asked for)
        if (!keep) await fight('recorded');
        const frames = [];
        const t0 = await fight('time');
        for (let i = 0; i < 6; i++) {
          await fight('freeze', true);
          await page.waitForTimeout(60);
          // (the whole screen at half size: a crop round where the boss was reckoned to stand kept missing it)
          frames.push(await sharp(await page.screenshot({ type: 'jpeg', quality: 84 })).resize(fw, fh).jpeg({ quality: 82 }).toBuffer());
          await fight('freeze', false);
          await wait(160);
        }
        await until(async () => (await fight('time')) >= t0 + ms / 1000, ms * 30 + 8000);
        rows.push({ label, frames });
        return fight('recorded');
      };
      if (await fight('scene')) await fight('skip');
      await wait(600);
      const first = await fight('record');
      // (four bosses are creatures of the air and drift on purpose: tests/sigilfall-bosses-move.test.ts ALOFT)
      const ALOFT = ['morgrave', 'the-rime-wyrm', 'ilvane-the-unmoored', 'herald-in-the-spire'];
      if (first?.float && !ALOFT.includes(BOSS)) found.push(`its kit lifts it ${first.float} off the ground (kits.ts float)`);
      // standing: its idle runs
      await fight('hold', true);
      const still = await strip('standing', 1500);
      await fight('hold', false);
      const ts = new Set(still.map((a) => a.t.toFixed(2)));
      if (ts.size < 3) found.push('standing, its clip does not advance');
      // walking: it comes to the hero
      const walked = { samples: 0, moving: 0, walking: 0, clips: {} };
      const onlyMoves = value('moves')?.split(',') ?? null;
      const onlyWalk = args.includes('--only-walk');
      for (let go = 0; go < (onlyMoves ? 0 : 2); go++) {
        if (!(await fight('walk', 5))) break;
        for (const a of await strip(go ? 'walking (again)' : 'walking', 2200)) {
          walked.samples++;
          if (onlyWalk && walked.samples % 8 === 1) console.log('   ', JSON.stringify(a));
          if (a.speed <= 8) continue;
          walked.moving++;
          walked.clips[a.clip] = (walked.clips[a.clip] ?? 0) + 1;
          if (a.clip === 'walk' || a.clip === 'run') walked.walking++;
        }
      }
      if (onlyMoves) void 0;
      else if (walked.moving < 5) found.push(`it was never seen moving (${walked.moving} of ${walked.samples} readings)`);
      else if (walked.walking / walked.moving < 0.8) found.push(`moving, it walks only ${Math.round((walked.walking / walked.moving) * 100)}% of the time: ${JSON.stringify(walked.clips)}`);
      // each attack of each phase, in the fight's own time
      const attacks = [];
      const PLAIN = new Set(['idle', 'walk', 'run', 'hit']);
      for (const [pi, phase] of where.phases.entries()) {
        if (onlyWalk) break;
        if (pi > 0) {
          await fight('phase');
          await until(async () => ((await fight('state'))?.shift ?? 0) > 0, 4000);
          const shifting = await strip(`phase ${pi + 1} begins`, 1600);
          attacks.push({ phase: pi + 1, id: '(phase change)', clips: [...new Set(shifting.map((a) => a.clip))] });
          await until(async () => ((await fight('state'))?.shift ?? 0) <= 0, 6000);
        }
        for (const id of [...new Set([...phase.patterns, ...phase.enter])]) {
          if (onlyWalk || (onlyMoves && !onlyMoves.includes(id))) continue;
          await fight('near');
          // (read from before it is asked for: a blow can be over before the next question gets an answer)
          await fight('recorded');
          if (!(await fight('pattern', id))) continue;
          if (!(await until(async () => (await fight('state'))?.pattern === id, 6000))) {
            attacks.push({ phase: pi + 1, id, clips: [], note: 'never began' });
            continue;
          }
          const all = await strip(`phase ${pi + 1}: ${id}`, 2600, true);
          // (its readings: from when it began, through it, and the second and a half after, where the move of a
          // pattern that is over the instant it opens plays)
          const from = all.findIndex((a) => a.began === id);
          const seen = from < 0 ? [] : all.slice(from).filter((a) => a.pattern === id || !a.pattern);
          const clips = [...new Set(seen.filter((a) => !a.hidden).map((a) => a.clip))];
          const hiddenAll = seen.length > 0 && seen.every((a) => a.hidden);
          attacks.push({ phase: pi + 1, id, clips, readings: seen.length, hidden: hiddenAll || undefined });
          if (!hiddenAll && !clips.some((c) => c && !PLAIN.has(c))) found.push(`phase ${pi + 1}, ${id}: no move of its own (${clips.join(', ') || 'nothing read'})`);
          await until(async () => !(await fight('state'))?.pattern, 8000);
        }
      }
      // the strips, one row a state
      const parts = [];
      for (const [r, row] of rows.entries()) {
        const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${fw * 6}" height="18"><rect width="100%" height="100%" fill="#111"/><text x="4" y="13" font-family="Helvetica" font-size="12" fill="#fff">${row.label.replace(/[<&]/g, '')}</text></svg>`);
        parts.push({ input: label, left: 0, top: r * (fh + 18) });
        for (const [i, f] of row.frames.entries()) parts.push({ input: f, left: i * fw, top: r * (fh + 18) + 18 });
      }
      await sharp({ create: { width: fw * 6, height: Math.max(1, rows.length) * (fh + 18), channels: 3, background: '#000' } }).composite(parts).jpeg({ quality: 80 }).toFile(join(OUT, `${TAG}motion.jpg`));
      const out = { boss: BOSS, file: first?.file, form: first?.form, float: first?.float ?? 0, walked, attacks, found, errors: report.errors };
      writeFileSync(join(OUT, `${TAG}motion.json`), JSON.stringify(out, null, 2));
      console.log(`  walking: ${walked.walking} of ${walked.moving} moving readings in a walk or a run ${JSON.stringify(walked.clips)}`);
      for (const a of attacks) console.log(`  phase ${a.phase} ${a.id.padEnd(22)} ${a.hidden ? '(out of sight throughout)' : a.clips.join(', ')}${a.note ? ` (${a.note})` : ''}`);
      console.log(found.length ? `\n${found.map((f) => `  WRONG: ${f}`).join('\n')}` : '\n  It walks when it moves and has a move for every attack.');
      if (found.length) process.exitCode = 1;
    };

    await fight('enter');
    if (!(await until(() => fight('there'), 30_000))) throw new Error(`${BOSS} never came out`);
    if (args.includes('--motion')) {
      await motion();
      return;
    }
    // the entrance: the first time it is shown
    for (const ms of [150, 350, 450, 500, 600]) {
      await page.waitForTimeout(ms);
      await quick('entrance');
    }
    if (await fight('scene')) await fight('skip');
    await wait(400);
    await fight('hold', true);
    await wait(1600);
    await shot('line-up');
    report.cost = await fight('cost');
    // a portrait: the camera much closer than the game ever comes
    await fight('zoom', 2.6);
    await wait(700);
    {
      const file = `${TAG}${String(++n).padStart(2, '0')}-portrait.jpg`;
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(OUT, file), type: 'jpeg', quality: 86 });
      report.shots.push({ state: 'portrait', file });
      console.log(`  ${file}`);
    }
    await fight('zoom', 1);
    await wait(400);
    await fight('hold', false);

    for (const [pi, phase] of (args.includes('--only-look') || args.includes('--only-fall') ? [] : where.phases).entries()) {
      if (pi > 0) {
        await fight('phase');
        await until(async () => ((await fight('state'))?.shift ?? 0) > 0, 4000);
        await wait(450);
        await shot(`phase-${pi + 1}-change`);
        await until(async () => ((await fight('state'))?.shift ?? 1) <= 0, 4000);
        // (its opening moves are its own: let them go by, pictured as they come)
        await wait(300);
      }
      for (const id of [...new Set(phase.patterns)]) {
        const name = id.replace(/[^a-z0-9]+/gi, '-');
        if (!(await fight('pattern', id))) continue;
        if (!(await until(async () => (await fight('state'))?.pattern === id, 5000))) continue;
        // the wind-up: its mark is on the ground and filling (a pattern with none is pictured as it gathers)
        await until(async () => ((await fight('state'))?.marks ?? 0) > 0, 1500);
        await wait(320);
        await shot(`phase-${pi + 1}-${name}-windup`);
        await until(async () => {
          const s = await fight('state');
          return !s || s.pattern !== id || s.step > 0 || s.hidden;
        }, 2500);
        await wait(160);
        await shot(`phase-${pi + 1}-${name}-strike`);
        await until(async () => (await fight('state'))?.pattern !== id, 14_000);
        await wait(250);
      }
    }
    if (args.includes('--only-look')) {
      writeFileSync(join(OUT, `${TAG}shots.json`), `${JSON.stringify(report, null, 1)}\n`);
      return;
    }
    // dazed, struck, and then its death
    await fight('daze', 3);
    await page.waitForTimeout(900);
    await quick('dazed');
    await fight('daze', 0.01);
    await fight('strike', 1);
    await wait(60);
    await shot('struck');
    await fight('strike', 1e9);
    // its dying (the rules' 1.8 s, slowed for the last blow), then as it lies, until the floor has it
    for (let i = 0; i < 9; i++) {
      await page.waitForTimeout(120);
      await quick('death');
    }
    writeFileSync(join(OUT, `${TAG}shots.json`), `${JSON.stringify(report, null, 1)}\n`);
    console.log(`${where.name}: ${report.shots.length} pictures in ${OUT}${report.cost?.tris ? `, ${report.cost.tris} triangles (${report.cost.file})` : ''}`);
    if (report.errors.length) console.log(`The page reported:\n  ${[...new Set(report.errors)].join('\n  ')}`);
  } finally {
    await browser.close();
    await vite.close();
  }
  process.exit(report.errors.length ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
