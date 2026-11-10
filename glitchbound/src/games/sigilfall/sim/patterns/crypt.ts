import { dist, TAU } from '../../core/math';
import type { Enemy } from '../types';
import type { World } from '../world';
import { exposed as expose, fighting, removeThing, ringSpots, roomBox, spawnThing, standing, up } from './arena';
import type { PatternFn } from './kit';

/**
 * Boss attacks of the Chapel Crypt: ids start with 'crypt:'. The first dungeon, so each boss teaches one thing.
 *
 * The Coffin Matron (the Ossuary) plays the shell game: she sinks into one of the coffins that rise round her
 * hall, the coffins trade places, and the one she lies in twitches and breathes a little green light. Strike it
 * and she bursts out stunned and open to every blow; strike another and it lets out the dead; wait too long and
 * she comes out screaming (`coffins`).
 *
 * Warden Ossric (the Crypt Gate) keeps grave-candles round his gate (`candles`): while any burns he is warded, the
 * more of them the stronger, and the ward grows back while they stand. Snuff them; he relights them in time, and
 * once he is wounded he charges whoever snuffs one.
 *
 * Morgrave (the Sanctum) tears his soul into shards that flee to the corners of the reliquary (`soul-split`):
 * while they fly he can't be touched and they spit soul-fire. Break every shard before the bell of his spell
 * rings and he falls back together stunned; leave any and each one flies home and makes him whole and stronger.
 *
 * What lasts beyond a pattern (the candles and their ward) is kept per boss here and run by a small ticker
 * (World.after, once a step) for as long as the fight lasts.
 */

const COFFIN = 'matron-coffin';
const CANDLE = 'grave-candle';
const SOUL = 'morgrave-soul';
const GREEN = '#9cff9c';
const CANDLE_GOLD = '#ffd88a';

interface Crypt {
  last: number;
  /** Ossric's candles, the spots they stand on, and the ward they keep on him. */
  candles: (Enemy | null)[];
  spots: { x: number; y: number }[];
  wardT: number;
  linkT: number;
  glowT: number;
  /** The Matron's coffins (the one she lies in by index), and Morgrave's soul-shards with the corners they fly to. */
  coffins: Enemy[];
  souls: Enemy[];
  goals: { x: number; y: number }[];
}

const FIGHTS = new WeakMap<Enemy, Crypt>();

function fight(w: World, e: Enemy): Crypt {
  let s = FIGHTS.get(e);
  if (!s) {
    s = { last: w.time, candles: [], spots: [], wardT: 0, linkT: 0, glowT: 0, coffins: [], souls: [], goals: [] };
    FIGHTS.set(e, s);
    w.after(0, () => tick(w, e));
  }
  return s;
}

function tick(w: World, e: Enemy): void {
  const s = FIGHTS.get(e);
  if (!s) return;
  if (!fighting(w, e)) {
    for (const c of [...s.candles, ...s.coffins, ...s.souls]) removeThing(w, c);
    FIGHTS.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  tickCandles(w, e, s, dt);
  w.after(0, () => tick(w, e));
}

/** A stunned boss, open to every blow for a while (the reward for playing the mechanic). */
const exposed = (w: World, e: Enemy, secs: number, text: string): void => expose(w, e, secs, text, GREEN);

/* ------------------------------------------------------------ the Coffin Matron */

/**
 * The shell game: `n` coffins rise in a ring (she in one), trade places `swaps` times (`swap` s each), then wait up
 * to `wait` s to be struck. Grave hands reach for the hero every `grasp` s meanwhile.
 */
const coffins: PatternFn = (w, e, dt, k) => {
  const { pt } = k;
  const p = w.player;
  const box = roomBox(w, e);
  const s = fight(w, e);
  const list = s.coffins;
  if (pt.step === 0) {
    const n = Math.round(k.num('n', 4));
    w.text(e.x, e.y - e.r - 16, 'Which grave, dear?', GREEN, true);
    w.sfx('soul');
    w.fxBurst(e.x, e.y - 6, GREEN, 16, 14);
    pt.data.hide = 1;
    const spots = ringSpots(w, e, n, Math.min(110, (box.x1 - box.x0) * 0.32), w.rand() * TAU);
    const made: Enemy[] = [];
    for (const sp of spots) {
      const c = spawnThing(w, e, COFFIN, sp.x, sp.y);
      if (c) made.push(c);
    }
    s.coffins = made;
    pt.data.right = Math.floor(w.rand() * Math.max(1, made.length));
    pt.data.swaps = Math.round(k.num('swaps', 3));
    pt.data.t1 = pt.t + 0.9;
    pt.data.grasp = pt.t + 1.6;
    pt.data.twitch = 0;
    // she lies in the middle of the room meanwhile (out of sight, out of reach)
    e.x = box.cx;
    e.y = box.cy;
    pt.step = 1;
    return;
  }
  if (!list.length) {
    pt.data.hide = 0;
    k.end();
    return;
  }
  const right = list[pt.data.right!];
  // the one she lies in twitches and breathes a little green light
  pt.data.twitch = (pt.data.twitch ?? 0) - dt;
  if (standing(w, right) && pt.data.twitch! <= 0) {
    pt.data.twitch = 0.7;
    right.flash = 0.08;
    w.addFx({ kind: 'ghost', x: right.x + (w.rand() - 0.5) * 6, y: right.y - 10, vx: 0, vy: -14, life: 0.8, size: 3, color: GREEN });
  }
  // grave hands under the hero while she hides
  if (pt.t >= pt.data.grasp!) {
    pt.data.grasp = pt.t + k.num('grasp', 2.6);
    w.addTelegraph({ shape: 'circle', x: p.x, y: p.y, r: 20, r2: 0, angle: 0, len: 0, dur: 1, dmg: e.dmg * 0.8, status: { status: 'root', dur: 0.8, power: 1 }, knock: 0, tone: 'rift', owner: -1, linger: 0 });
  }
  // the coffins trade places, two at a time
  if (pt.step === 1) {
    if (pt.t < pt.data.t1!) return;
    if ((pt.data.swaps ?? 0) <= 0) {
      pt.step = 3;
      pt.data.t2 = pt.t + k.num('wait', 10);
      w.text(box.cx, box.cy - 20, 'Strike her coffin!', GREEN, false);
      return;
    }
    const alive = list.map((c, i) => [c, i] as const).filter(([c]) => standing(w, c));
    if (alive.length < 2) {
      pt.data.swaps = 0;
      return;
    }
    // two coffins, never the same two as the swap before (that would only put them back)
    let a = alive[Math.floor(w.rand() * alive.length)]!;
    let b = alive[Math.floor(w.rand() * alive.length)]!;
    if (b[1] === a[1]) b = alive[(alive.indexOf(a) + 1) % alive.length]!;
    const pair = (x: number, y: number): number => Math.min(x, y) * 100 + Math.max(x, y);
    if (alive.length > 2 && pair(a[1], b[1]) === pt.data.last) a = alive.find(([, i]) => i !== a[1] && i !== b[1])!;
    pt.data.last = pair(a[1], b[1]);
    pt.data.sa = a[1];
    pt.data.sb = b[1];
    pt.data.ax = a[0].x;
    pt.data.ay = a[0].y;
    pt.data.bx = b[0].x;
    pt.data.by = b[0].y;
    pt.data.s0 = pt.t;
    pt.data.swaps! -= 1;
    w.sfx('slam', 0.4);
    pt.step = 2;
    return;
  }
  if (pt.step === 2) {
    const dur = k.num('swap', 0.9);
    const u = Math.min(1, (pt.t - pt.data.s0!) / dur);
    const ca = list[pt.data.sa!];
    const cb = list[pt.data.sb!];
    // along an arc, so the two never pass through each other
    const lift = Math.sin(u * Math.PI) * 26;
    const ease = u * u * (3 - 2 * u);
    if (standing(w, ca)) {
      ca.x = pt.data.ax! + (pt.data.bx! - pt.data.ax!) * ease;
      ca.y = pt.data.ay! + (pt.data.by! - pt.data.ay!) * ease - lift;
    }
    if (standing(w, cb)) {
      cb.x = pt.data.bx! + (pt.data.ax! - pt.data.bx!) * ease;
      cb.y = pt.data.by! + (pt.data.ay! - pt.data.by!) * ease + lift;
    }
    if (u >= 1) {
      pt.step = 1;
      pt.data.t1 = pt.t + 0.15;
    }
    return;
  }
  // waiting to be struck
  if (!standing(w, right)) {
    // found: she bursts out of the broken coffin, stunned
    const at = right ?? { x: box.cx, y: box.cy };
    e.x = at.x;
    e.y = at.y;
    for (const c of list) removeThing(w, c);
    s.coffins = [];
    pt.data.hide = 0;
    k.end();
    exposed(w, e, k.num('daze', 3.5), 'FOUND!');
    return;
  }
  for (const [i, c] of list.entries()) {
    if (i === pt.data.right || c.dead === false || pt.data[`gone${i}`]) continue;
    // a wrong grave: it lets out its dead
    pt.data[`gone${i}`] = 1;
    w.text(c.x, c.y - 16, 'Wrong grave, dear.', GREEN, false);
    for (let j = 0; j < Math.round(k.num('dead', 2)); j++) w.spawnAdd('skeleton', c.x + (j ? 10 : -10), c.y + 4, e.room);
    w.sfx('summon', 0.6);
  }
  if (pt.t >= pt.data.t2!) {
    // too slow: she comes out screaming, and every coffin left lets out one of its dead
    e.x = right.x;
    e.y = right.y;
    w.addTelegraph({ shape: 'circle', x: right.x, y: right.y, r: 64, r2: 0, angle: 0, len: 0, dur: 0.7, dmg: e.dmg * 1.6, knock: 160, tone: 'enemy', owner: e.id, linger: 0 });
    for (const c of list) {
      if (standing(w, c) && c !== right) w.spawnAdd('skeleton', c.x, c.y + 4, e.room);
      removeThing(w, c);
    }
    s.coffins = [];
    w.text(e.x, e.y - e.r - 16, 'TOO SLOW!', '#ff8a8a', true);
    w.sfx('roar', 0.6);
    pt.data.hide = 0;
    k.end();
  }
};

/* ------------------------------------------------------------ Warden Ossric's candles */

/** Lights the grave-candles still missing (up to `n` in all, `relight` of them at a time). */
const candles: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const s = fight(w, e);
  if (pt.step === 0) {
    const n = Math.round(k.num('n', 3));
    if (s.spots.length !== n) s.spots = ringSpots(w, e, n, 96, Math.PI / 2);
    w.text(e.x, e.y - e.r - 16, 'Burn, grave-lights!', CANDLE_GOLD, true);
    w.addFx({ kind: 'glow', x: e.x, y: e.y - 14, life: 0.8, size: 18, color: CANDLE_GOLD });
    w.sfx('summon', 0.6);
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= 0.8) {
    let lit = 0;
    const most = Math.round(k.num('relight', 3));
    for (const [i, sp] of s.spots.entries()) {
      if (lit >= most) break;
      if (standing(w, s.candles[i])) continue;
      const c = spawnThing(w, e, CANDLE, sp.x, sp.y);
      s.candles[i] = c;
      if (c) {
        lit++;
        w.fxBurst(c.x, c.y - 10, CANDLE_GOLD, 12, 10);
      }
    }
    s.wardT = 0;
    pt.data.t1 = pt.t;
    pt.step = 2;
  } else if (pt.step === 2 && pt.t >= pt.data.t1! + 0.3) k.end();
};

/** While any candle burns: a ward on Ossric (8% of his health a candle, growing back 2% a candle a second). */
function tickCandles(w: World, e: Enemy, s: Crypt, dt: number): void {
  if (!s.candles.length) return;
  let burning = 0;
  for (const [i, c] of s.candles.entries()) {
    if (!c) continue;
    if (up(w, c)) {
      burning++;
      continue;
    }
    // snuffed
    s.candles[i] = null;
    w.text(c.x, c.y - 18, 'A grave-light goes out!', CANDLE_GOLD, false);
    w.fxBurst(c.x, c.y - 10, '#5a5a6a', 10, 8);
    w.sfx('puff');
    // wounded, he goes for whoever put it out
    if (e.boss!.phase >= 1 && !e.boss!.queue.some((q) => q.id === 'charge')) e.boss!.queue.push({ id: 'charge', w: 1, cd: 0, p: { wind: 0.6, len: 300, speed: 380, mul: 1.3 } });
  }
  if (!burning) {
    if (e.shield > 0) {
      w.fxBurst(e.x, e.y - 6, CANDLE_GOLD, 14, 14);
      w.text(e.x, e.y - e.r - 16, 'His ward breaks!', CANDLE_GOLD, true);
    }
    e.shield = 0;
    return;
  }
  s.wardT -= dt;
  if (s.wardT <= 0) {
    s.wardT = 0.5;
    e.shield = Math.min(e.maxHp * 0.08 * burning, e.shield + e.maxHp * 0.02 * burning * 0.5);
  }
  // each one burns: a flicker of gold over its wicks, so it reads as something to put out
  s.glowT -= dt;
  if (s.glowT <= 0) {
    s.glowT = 0.3;
    for (const c of s.candles) if (c && up(w, c)) w.addFx({ kind: 'glow', x: c.x, y: c.y - 17, life: 0.42, size: 9 + ((w.time * 7) % 3), color: CANDLE_GOLD });
  }
  s.linkT -= dt;
  if (s.linkT <= 0) {
    s.linkT = 0.9;
    for (const c of s.candles) if (standing(w, c)) w.addFx({ kind: 'beam', x: c.x, y: c.y - 12, x2: e.x, y2: e.y - 10, life: 0.35, size: 1, color: CANDLE_GOLD });
  }
}

/* ------------------------------------------------------------ Morgrave's soul-split */

/**
 * Morgrave tears his soul into `n` shards that flee to the corners of the room and spit soul-fire; break them all
 * within `time` s or each one left makes him whole (`heal` of his health) and stronger (`rage` times his blows).
 */
const soulSplit: PatternFn = (w, e, dt, k) => {
  const { pt } = k;
  const p = w.player;
  const box = roomBox(w, e);
  const st = fight(w, e);
  if (pt.step === 0) {
    const n = Math.round(k.num('n', 3));
    w.text(e.x, e.y - e.r - 16, 'You cannot kill what the crypt keeps!', GREEN, true);
    w.sfx('rift');
    w.shake(4);
    w.fxBurst(e.x, e.y - 10, GREEN, 30, 22);
    pt.data.hide = 1;
    const goals = ringSpots(w, e, n, Math.min(150, (box.x1 - box.x0) * 0.42), w.rand() * TAU);
    const souls: Enemy[] = [];
    for (let i = 0; i < n; i++) {
      const s = spawnThing(w, e, SOUL, e.x + Math.cos((i / n) * TAU) * 14, e.y + Math.sin((i / n) * TAU) * 10);
      if (s) souls.push(s);
    }
    st.souls = souls;
    st.goals = goals;
    pt.data.t1 = pt.t;
    pt.data.bolt = pt.t + 1.4;
    pt.data.tick = 0;
    w.text(box.cx, box.cy - 26, 'Break his soul-shards!', GREEN, false);
    pt.step = 1;
    return;
  }
  const souls = st.souls;
  const goals = st.goals;
  const alive = souls.filter((s) => standing(w, s));
  // the shards drift to their corners
  for (const [i, s] of souls.entries()) {
    if (!standing(w, s)) continue;
    const g = goals[i % Math.max(1, goals.length)] ?? { x: box.cx, y: box.cy };
    const d = dist(s.x, s.y, g.x, g.y);
    if (d > 2) {
      const sp = Math.min(d, 46 * dt);
      s.x += ((g.x - s.x) / d) * sp;
      s.y += ((g.y - s.y) / d) * sp;
    }
  }
  // soul-fire from one shard after another
  if (alive.length && pt.t >= pt.data.bolt!) {
    pt.data.bolt = pt.t + k.num('bolt', 1.7);
    const s = alive[Math.floor(w.rand() * alive.length)]!;
    const a = Math.atan2(p.y - s.y, p.x - s.x);
    w.spawnProjectile({ x: s.x, y: s.y - 8, vx: Math.cos(a) * 100, vy: Math.sin(a) * 100, r: 4, life: 320, dmg: e.dmg * 0.55, type: 'arcane', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'skull', color: GREEN, hostile: true, homing: 0.25, child: false, knock: 0 });
    w.sfx('soul', 0.5);
  }
  // the spell's count, in seconds
  const left = k.num('time', 12) - (pt.t - pt.data.t1!);
  if (Math.ceil(left) !== pt.data.tick && left > 0 && left <= 5) {
    pt.data.tick = Math.ceil(left);
    w.text(box.cx, box.cy - 26, String(pt.data.tick), GREEN, true);
    w.sfx('bell-toll', 0.25);
  }
  if (!alive.length) {
    // every shard broken: he falls back together, stunned
    e.x = box.cx;
    e.y = box.cy;
    st.souls = [];
    pt.data.hide = 0;
    k.end();
    exposed(w, e, k.num('daze', 3), 'Pieces... you cut me to pieces...');
    return;
  }
  if (left <= 0) {
    // the shards fly home: each one makes him whole and stronger
    e.x = box.cx;
    e.y = box.cy;
    const heal = k.num('heal', 0.1);
    for (const s of alive) {
      w.addFx({ kind: 'beam', x: s.x, y: s.y - 8, x2: e.x, y2: e.y - 10, life: 0.5, size: 2, color: GREEN });
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * heal);
      e.atkMul *= k.num('rage', 1.12);
      removeThing(w, s);
    }
    st.souls = [];
    w.text(e.x, e.y - e.r - 16, 'WHOLE AGAIN!', '#ff8a8a', true);
    w.sfx('roar', 0.6);
    w.shake(5);
    pt.data.hide = 0;
    k.end();
  }
};

export const CRYPT_PATTERNS: Record<string, PatternFn> = {
  'crypt:coffins': coffins,
  'crypt:candles': candles,
  'crypt:soul-split': soulSplit,
};
