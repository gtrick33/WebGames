import { clamp, dist, TAU } from '../../core/math';
import { hurtPlayer } from '../combat';
import { castRay, circleHitsWall, moveCircle, TILE, tileAt } from '../map';
import type { Enemy, Field } from '../types';
import type { World } from '../world';
import type { PatternFn, PatternKit } from './kit';

/**
 * Boss attacks of the Siege of Highwall: ids start with 'siege:'.
 *
 * The Siege-Breaker is a walking ram: it charges down a lane and, when the lane ends in a wall, the
 * wall gives and its masonry comes down around the impact (`ram`); the cauldron on its back pours
 * boiling pitch that stays on the floor as sticky pools (`pitch`), and its crew's torches set every
 * pool alight (`torch`).
 *
 * General Morvain commands: the archers on the walls rain arrows on bands across the yard, half of
 * them and then the other half (`arrows`); his war banner wards and rallies the Legion around it until
 * it is broken (`banner`); squads march in through the gate farthest from the hero (`squad`); and at
 * his last stand every archer looses at once, sparing only the ground beside his banner, or beside
 * the general himself once it has fallen (`last-volley`). He fights too: a death knight's charge that
 * ends in a blow all round (`deathcharge`), and a guard that answers any wound with a riposte
 * (`guard`).
 *
 * What lasts beyond a pattern (pitch on the floor, the banner and its ward, the guard's stance) is
 * kept per boss here and run by a small ticker (World.after, once a step) for as long as the fight
 * lasts; when the boss falls, or the room resets after a defeat, it all goes with it.
 */

const GOLD = '#ffd86b';
const PITCH_SMOKE = '#1e1a1e';
const BANNER = 'legion-war-banner';
const GUARD_SPRITE = 'general-morvain-guard';
/** At most this many pools of pitch at once: the oldest dries when a new one would go past it. */
const MAX_PITCH = 14;
/** At most this many fires from burning arrows at once. */
const MAX_FIRES = 12;
/** Raw pitch hurts a little every half second (a share of the boss's blow) and holds you fast. */
const PITCH_TICK = 0.12;

interface Pitch {
  f: Field;
  lit: boolean;
}
interface Ward {
  /** How far the banner's ward reaches. */
  r: number;
  /** The boss's ward: at most this share of its health, growing by `rate` of it a second. */
  boss: number;
  rate: number;
  /** Troops near it are warded for this share of their health, and attack `rally` times as fast. */
  adds: number;
  rally: number;
}
interface Siege {
  last: number;
  pitch: Pitch[];
  smokeT: number;
  /** The cauldron boiling over: a pool of pitch every `drip` s while it walks (0: not yet). */
  drip: number;
  dripT: number;
  dripX: number;
  dripY: number;
  /** Fires the burning arrows started. */
  fires: Field[];
  banner: Enemy | null;
  ward: Ward;
  wardT: number;
  linkT: number;
  /** Troops the banner rallied, with their own speeds, to give back when it falls. */
  rallied: Map<Enemy, { atk: number; speed: number }>;
  /** The boss's own sprite (the guard changes it). */
  sprite: string;
}

const FIGHTS = new WeakMap<Enemy, Siege>();

/** The fight goes on: the boss stands, isn't falling, its room hasn't reset (and, if given, it is still in that phase). */
function fighting(w: World, e: Enemy, phase?: number): boolean {
  const b = e.boss;
  return !!b && !e.dead && b.dying <= 0 && w.enemies.includes(e) && (phase === undefined || b.phase === phase);
}

const standing = (w: World, x: Enemy | null): x is Enemy => !!x && !x.dead && w.enemies.includes(x);

/** The boss room's bounds in pixels (worked out once per fight). */
function roomBox(w: World, e: Enemy): { x0: number; y0: number; x1: number; y1: number } {
  const m = e.boss!.misc;
  if (m.hx1 === undefined) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const i of w.map.roomTiles[e.room] ?? []) {
      const tx = i % w.map.w;
      const ty = Math.floor(i / w.map.w);
      x0 = Math.min(x0, tx);
      y0 = Math.min(y0, ty);
      x1 = Math.max(x1, tx);
      y1 = Math.max(y1, ty);
    }
    if (x0 === Infinity) {
      x0 = x1 = Math.floor(e.x / TILE);
      y0 = y1 = Math.floor(e.y / TILE);
    }
    m.hx0 = x0 * TILE;
    m.hy0 = y0 * TILE;
    m.hx1 = (x1 + 1) * TILE;
    m.hy1 = (y1 + 1) * TILE;
  }
  return { x0: m.hx0!, y0: m.hy0!, x1: m.hx1, y1: m.hy1! };
}

/** A spot on the boss room's open floor with room for a circle of radius r. */
function onFloor(w: World, e: Enemy, x: number, y: number, r: number): boolean {
  const i = tileAt(w.map, x, y);
  return i >= 0 && w.map.room[i] === e.room + 1 && !circleHitsWall(w.map, x, y, r);
}

/** Boiling pitch and torches set the hero burning (a tenth of the boss's blow a second). */
const burn = (e: Enemy, dur = 2): { status: 'burn'; dur: number; power: number } => ({ status: 'burn', dur, power: Math.max(2, Math.round(e.dmg * 0.1)) });

const faceTo = (e: Enemy, a: number): void => {
  e.face = Math.cos(a) < 0 ? Math.PI : 0;
};

/* ------------------------------------------------------------ the lasting state */

function fight(w: World, e: Enemy): Siege {
  let s = FIGHTS.get(e);
  if (!s) {
    s = { last: w.time, pitch: [], smokeT: 0, drip: 0, dripT: 0, dripX: e.x, dripY: e.y, fires: [], banner: null, ward: { r: 110, boss: 0.06, rate: 0.004, adds: 0.3, rally: 1.3 }, wardT: 0, linkT: 0, rallied: new Map(), sprite: e.def.sprite };
    FIGHTS.set(e, s);
    w.after(0, () => tick(w, e));
  }
  return s;
}

/** Once a step for as long as the boss fights. */
function tick(w: World, e: Enemy): void {
  const s = FIGHTS.get(e);
  if (!s) return;
  if (!fighting(w, e)) {
    // won, or the room reset after a defeat: the pitch dries, the banner falls with its general
    const mine = new Set([...s.pitch.map((q) => q.f), ...s.fires]);
    w.fields = w.fields.filter((f) => !mine.has(f));
    if (standing(w, s.banner)) {
      s.banner.hp = 0;
      s.banner.dead = true;
      s.banner.deathT = 0;
    }
    unrally(s);
    if (e.def.sprite === GUARD_SPRITE) e.def = { ...e.def, sprite: s.sprite };
    FIGHTS.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  tickPitch(w, s, dt);
  tickDrip(w, e, s, dt);
  tickBanner(w, e, s, dt);
  // a guard cut short (a phase change) leaves the stance behind
  if (e.def.sprite === GUARD_SPRITE && e.boss!.pattern?.use.id !== 'siege:guard') e.def = { ...e.def, sprite: s.sprite };
  w.after(0, () => tick(w, e));
}

/* ------------------------------------------------------------ the pitch */

/** A pool of pitch on the floor: it holds whoever wades in and hurts a little, until a torch finds it. */
function addPitch(w: World, e: Enemy, x: number, y: number, r: number, life: number): void {
  if (!onFloor(w, e, x, y, 2)) return;
  const s = fight(w, e);
  s.pitch = s.pitch.filter((q) => w.fields.includes(q.f));
  if (s.pitch.length >= MAX_PITCH) {
    const old = s.pitch.reduce((a, b) => (a.f.t < b.f.t ? a : b));
    old.f.t = Math.min(old.f.t, 0.4);
  }
  w.spawnField({ x, y, r, dur: life, tick: 0.5, dmg: e.dmg * PITCH_TICK, type: 'fire', status: { status: 'chill', dur: 0.6, power: 0.4 }, look: 'shadow', hostile: true, depth: 0, spec: null, onHit: false });
  const f = w.fields[w.fields.length - 1];
  if (f) s.pitch.push({ f, lit: false });
}

function tickPitch(w: World, s: Siege, dt: number): void {
  if (!s.pitch.length) return;
  s.pitch = s.pitch.filter((q) => w.fields.includes(q.f));
  s.smokeT -= dt;
  if (s.smokeT > 0 || !s.pitch.length) return;
  s.smokeT = 0.12;
  // black bubbles on the raw pitch, flames and smoke where it has caught
  const q = s.pitch[Math.floor(w.rand() * s.pitch.length)]!;
  const a = w.rand() * TAU;
  const r = Math.sqrt(w.rand()) * q.f.r * 0.8;
  const x = q.f.x + Math.cos(a) * r;
  const y = q.f.y + Math.sin(a) * r * 0.75;
  if (q.lit) {
    w.addFx({ kind: 'spark', x, y: y - 2, vx: (w.rand() - 0.5) * 16, vy: -26 - w.rand() * 20, life: 0.5, size: 1, color: w.rand() < 0.5 ? '#ffd04a' : '#ff7a2a' });
    if (w.rand() < 0.4) w.addFx({ kind: 'smoke', x, y: y - 4, vx: 0, vy: -14, life: 0.9, size: 3, color: '#3a3034' });
  } else w.addFx({ kind: 'smoke', x, y, vx: 0, vy: -6, life: 0.6, size: 2, color: PITCH_SMOKE });
}

/** The cauldron has boiled over: pitch spills behind the Siege-Breaker wherever it goes. */
function tickDrip(w: World, e: Enemy, s: Siege, dt: number): void {
  if (!s.drip || e.boss!.shift > 0) return;
  s.dripT -= dt;
  if (s.dripT > 0 || dist(e.x, e.y, s.dripX, s.dripY) < 20) return;
  s.dripT = s.drip;
  s.dripX = e.x;
  s.dripY = e.y;
  addPitch(w, e, e.x - Math.cos(e.face) * e.r * 0.6, e.y + 4, 14, 9);
}

/* ------------------------------------------------------------ the banner */

/** The banner fell (or its general did): the rallied troops slow down again and their wards break. */
function unrally(s: Siege): void {
  for (const [x, o] of s.rallied) {
    x.atkMul = o.atk;
    x.speedMul = o.speed;
    x.shield = 0;
  }
  s.rallied.clear();
}

function tickBanner(w: World, e: Enemy, s: Siege, dt: number): void {
  if (!s.banner) return;
  const flag = s.banner;
  if (!standing(w, flag) || flag.hp <= 0) {
    // broken: the ward goes from everyone it covered
    w.text(flag.x, flag.y - 26, 'THE BANNER FALLS!', GOLD, true);
    w.sfx('shieldBreak');
    w.shake(4);
    w.fxBurst(flag.x, flag.y - 10, GOLD, 24, 20);
    for (const x of s.rallied.keys()) if (!x.dead) w.fxBurst(x.x, x.y - 4, '#7fd8ff', 6, 8);
    if (e.shield > 0) w.fxBurst(e.x, e.y - 6, '#7fd8ff', 14, 14);
    e.shield = 0;
    unrally(s);
    s.banner = null;
    return;
  }
  // it can't be warded by itself, and it waits out a phase change with its general
  if (flag.state === 'spawn' || e.boss!.shift > 0) return;
  s.wardT -= dt;
  s.linkT -= dt;
  const link = s.linkT <= 0;
  if (link) s.linkT = 1;
  if (s.wardT <= 0) {
    s.wardT = 0.5;
    const r = s.ward.r;
    for (const x of w.enemies) {
      if (x === flag || x.dead || x.room !== e.room || x.state === 'spawn') continue;
      if (dist(x.x, x.y, flag.x, flag.y) > r) continue;
      if (x === e) {
        x.shield = Math.min(x.maxHp * s.ward.boss, x.shield + x.maxHp * s.ward.rate * 0.5);
      } else {
        x.shield = Math.max(x.shield, x.maxHp * s.ward.adds);
        if (!s.rallied.has(x)) {
          s.rallied.set(x, { atk: x.atkMul, speed: x.speedMul });
          x.atkMul *= s.ward.rally;
          x.speedMul *= 1.15;
        }
      }
      if (link) w.addFx({ kind: 'zap', x: flag.x, y: flag.y - 18, x2: x.x, y2: x.y - 6, life: 0.3, size: 1, color: GOLD });
    }
  }
  if (link) {
    w.addFx({ kind: 'ring', x: flag.x, y: flag.y, life: 0.9, size: s.ward.r, color: GOLD });
    w.addFx({ kind: 'glow', x: flag.x, y: flag.y - 18, life: 0.6, size: 12, color: GOLD });
  }
}

/* ------------------------------------------------------------ the Siege-Breaker */

/**
 * The wall gives where the ram struck: `rubble` stones (circles of `rr`, falling for `fall` s and a
 * little longer each) come down for `rmul` of its blow, half of them in a fan back into the room from
 * the impact and half on and around the hero, wherever they are (`spread` px around them), as the
 * whole wall shakes.
 */
function breach(w: World, e: Enemy, k: PatternKit, a: number): void {
  const ix = e.x + Math.cos(a) * e.r;
  const iy = e.y + Math.sin(a) * e.r;
  w.shake(6);
  w.sfx('slam');
  w.sfx('crumble');
  w.text(ix, iy - 44, 'THE WALL GIVES!', '#e8d8c0', true);
  for (let i = 0; i < 18; i++) w.addFx({ kind: 'rubble', x: ix + (w.rand() - 0.5) * 16, y: iy - w.rand() * 14, vx: (w.rand() - 0.5) * 140, vy: -40 - w.rand() * 90, life: 0.8, size: 2 + Math.floor(w.rand() * 2), color: w.rand() < 0.6 ? '#7a7e8a' : '#4a4e58' });
  for (let i = 0; i < 8; i++) w.addFx({ kind: 'smoke', x: ix + (w.rand() - 0.5) * 20, y: iy + (w.rand() - 0.5) * 10, vx: (w.rand() - 0.5) * 30, vy: -10, life: 1.1, size: 5, color: '#8a8478' });
  const n = k.num('rubble', 6);
  const r = k.num('rr', 20);
  const fall = k.num('fall', 1.1);
  const mul = k.num('rmul', 1.1);
  const phase = e.boss!.phase;
  const p = w.player;
  const placed: { x: number; y: number }[] = [];
  const spread = k.num('spread', 70);
  for (let i = 0; i < n; i++) {
    let x = 0;
    let y = 0;
    let ok = false;
    const onHero = i % 2 === 1 && !p.dead;
    if (i === 1 && onHero && onFloor(w, e, p.x, p.y, 2)) {
      x = p.x;
      y = p.y;
      ok = true;
    }
    for (let tries = 0; !ok && tries < 10; tries++) {
      if (onHero) {
        const b = w.rand() * TAU;
        const d = 20 + w.rand() * spread;
        x = p.x + Math.cos(b) * d;
        y = p.y + Math.sin(b) * d * 0.8;
      } else {
        const b = a + Math.PI + (w.rand() - 0.5) * 2.4;
        const d = 24 + w.rand() * 96;
        x = ix + Math.cos(b) * d;
        y = iy + Math.sin(b) * d;
      }
      ok = onFloor(w, e, x, y, 3) && placed.every((q) => dist(q.x, q.y, x, y) > r * 1.3);
    }
    if (!ok) continue;
    placed.push({ x, y });
    const dur = fall + i * 0.08;
    w.addTelegraph({ shape: 'circle', x, y, r, r2: 0, angle: 0, len: 0, dur, dmg: e.dmg * mul, knock: 90, tone: 'enemy', owner: -1, linger: 0 });
    // the masonry coming down, still burning from the fires in the city
    w.addFx({ kind: 'ember', x, y: y - 130, vx: 0, vy: 130 / dur, life: dur, size: 6, color: '#ff7a3d', sprite: 'meteor' });
    w.after(dur, () => {
      if (!fighting(w, e, phase)) return;
      for (let j = 0; j < 8; j++) w.addFx({ kind: 'rubble', x, y: y - 2, vx: (w.rand() - 0.5) * 90, vy: -30 - w.rand() * 50, life: 0.5, size: 2, color: w.rand() < 0.5 ? '#7a7e8a' : '#5a5e68' });
      w.sfx('crumble', 0.35);
    });
  }
}

/**
 * The ram: the Siege-Breaker lowers its head and charges down a lane (shown for `wind` s, `wind2` for
 * the passes after the first) at `speed`, `passes` times. Caught in it, the hero takes `mul` of its
 * blow; a wall at the end of the lane gives (see breach), and after the last pass it is stuck there
 * for `daze` s.
 */
const ram: PatternFn = (w, e, dt, k) => {
  const { pt } = k;
  const p = w.player;
  if (pt.step === 0) {
    const a = k.aimAt();
    const end = castRay(w.map, e.x, e.y, e.r, a, k.num('len', 440));
    pt.data.a = a;
    pt.data.left = Math.max(30, dist(e.x, e.y, end.x, end.y));
    pt.data.t0 = pt.t;
    pt.data.wind = (pt.data.n ?? 0) === 0 ? k.num('wind', 1) : k.num('wind2', 0.6);
    w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: (e.r + w.player.r + 3) * 2, angle: a, len: pt.data.left + e.r, dur: pt.data.wind, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
    faceTo(e, a);
    if (!pt.data.n) w.text(e.x, e.y - e.r - 18, 'RAMMING SPEED!', '#ffb04d', true);
    w.sfx('snort', 0.9);
    w.sfx('windup', 0.6);
    pt.step = 1;
  } else if (pt.step === 1) {
    // it paws the stones
    if (w.rand() < dt * 14) w.addFx({ kind: 'smoke', x: e.x - Math.cos(pt.data.a!) * e.r, y: e.y + e.r * 0.6, vx: -Math.cos(pt.data.a!) * 20, vy: -6, life: 0.5, size: 4, color: '#9a9488' });
    if (pt.t >= pt.data.t0! + pt.data.wind!) {
      pt.step = 2;
      pt.data.hit = 0;
      w.sfx('rush');
    }
  } else if (pt.step === 2) {
    const a = pt.data.a!;
    const step = k.num('speed', 300) * dt;
    const m = moveCircle(w.map, e.x, e.y, e.r, Math.cos(a) * step, Math.sin(a) * step);
    e.x = m.x;
    e.y = m.y;
    e.walkT += dt * 2;
    pt.data.left! -= step;
    w.addFx({ kind: 'smoke', x: e.x - Math.cos(a) * e.r, y: e.y + e.r * 0.5, life: 0.45, size: 5, color: '#9a9488' });
    if (w.rand() < 0.5) w.addFx({ kind: 'spark', x: e.x + Math.cos(a) * e.r, y: e.y - 4, vx: (w.rand() - 0.5) * 60, vy: -30, life: 0.25, size: 1, color: '#ffd04a' });
    if (!pt.data.hit && !p.dead && dist(e.x, e.y, p.x, p.y) < e.r + p.r + 3) {
      pt.data.hit = 1;
      hurtPlayer(w, e.dmg * k.num('mul', 1.6), { fromX: e.x, fromY: e.y, knock: 240, source: e });
    }
    if (m.bx || m.by || pt.data.left! <= 0) {
      const wall = m.bx || m.by;
      if (wall) breach(w, e, k, a);
      pt.data.n = (pt.data.n ?? 0) + 1;
      if (pt.data.n >= k.num('passes', 1)) {
        const daze = k.num('daze', 1.5);
        k.end();
        if (wall && daze > 0) {
          e.boss!.dazed = daze;
          w.text(e.x, e.y - e.r - 12, 'STUCK!', '#ffe066', true);
        }
        return;
      }
      // it wheels round for another run
      pt.step = 0;
    }
  }
};

/**
 * Boiling pitch: the cauldron on its back tips forward. A cone (`r`, half-angle `arc`) shown for
 * `wind` s burns for `mul` of its blow, and leaves `pools` pools of pitch (`poolR`) in it for `life` s.
 * With `drip`, the cauldron boils over for the rest of the fight: a pool behind it every `drip` s
 * while it walks.
 */
const pitch: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const wind = k.num('wind', 1.1);
  const r = k.num('r', 84);
  const arc = k.num('arc', 0.55);
  if (pt.step === 0) {
    const a = k.aimAt();
    pt.data.a = a;
    w.addTelegraph({ shape: 'cone', x: e.x, y: e.y, r, r2: arc, angle: a, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1), status: burn(e), knock: 80, tone: 'enemy', owner: -1, linger: 0 });
    faceTo(e, a);
    w.text(e.x, e.y - e.r - 18, 'BOILING PITCH!', '#ffb04d', true);
    w.sfx('windup', 0.6);
    pt.step = 1;
  } else if (pt.step === 1) {
    // the cauldron steams as it tips
    if (w.rand() < 0.5) w.addFx({ kind: 'smoke', x: e.x - Math.cos(pt.data.a!) * 4 + (w.rand() - 0.5) * 8, y: e.y - e.r - 6, vx: (w.rand() - 0.5) * 10, vy: -18, life: 0.8, size: 3, color: '#b8b4b0' });
    if (pt.t >= wind) {
      const a = pt.data.a!;
      for (let i = 0; i < 26; i++) {
        const b = a + (w.rand() - 0.5) * arc * 2;
        const s = 60 + w.rand() * 120;
        w.addFx({ kind: 'spark', x: e.x + Math.cos(a) * e.r, y: e.y - 8, vx: Math.cos(b) * s, vy: Math.sin(b) * s * 0.75 - 10, life: 0.45, size: 2, color: w.rand() < 0.6 ? '#2a2228' : '#ff8a3a' });
      }
      w.sfx('squish', 0.8);
      w.sfx('fireball', 0.5);
      w.shake(2);
      if (k.num('drip', 0) > 0) {
        fight(w, e).drip = k.num('drip', 0);
        w.text(e.x, e.y - e.r - 28, 'THE CAULDRON BOILS OVER!', '#ffb04d', true);
      }
      const n = k.num('pools', 4);
      for (let i = 0; i < n; i++) {
        const f = n === 1 ? 0.6 : 0.3 + (0.65 * i) / (n - 1);
        const b = a + (w.rand() - 0.5) * arc * 1.3;
        addPitch(w, e, e.x + Math.cos(b) * r * f, e.y + Math.sin(b) * r * f, k.num('poolR', 17), k.num('life', 10));
      }
      pt.data.t1 = pt.t;
      pt.step = 2;
    }
  } else if (pt.step === 2 && pt.t >= pt.data.t1! + 0.45) k.end();
};

/**
 * Torches: the crew throw a torch at every pool of raw pitch on the floor (a circle a little bigger
 * than the pool, landing after `wind` s, one after another), and each pool they hit burns for `burn`
 * s. With no pitch down, `count` firepots come down on and around the hero instead.
 */
const torch: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  if (pt.step === 0) {
    const s = fight(w, e);
    const p = w.player;
    const wind = k.num('wind', 1.3);
    const phase = e.boss!.phase;
    const targets: { x: number; y: number; r: number; q: Pitch | null }[] = s.pitch.filter((q) => !q.lit && w.fields.includes(q.f)).map((q) => ({ x: q.f.x, y: q.f.y, r: q.f.r + 8, q }));
    if (!targets.length) {
      const count = k.num('count', 3);
      const a0 = w.rand() * TAU;
      for (let i = 0; i < count; i++) {
        const a = a0 + (TAU * i) / Math.max(1, count - 1);
        const x = i === 0 ? p.x : p.x + Math.cos(a) * 44;
        const y = i === 0 ? p.y : p.y + Math.sin(a) * 36;
        if (onFloor(w, e, x, y, 3)) targets.push({ x, y, r: 22, q: null });
      }
    }
    targets.forEach((tg, i) => {
      const dur = wind + i * 0.12;
      w.addTelegraph({ shape: 'circle', x: tg.x, y: tg.y, r: tg.r, r2: 0, angle: 0, len: 0, dur, dmg: e.dmg * k.num('mul', 1.2), status: burn(e), knock: 60, tone: 'enemy', owner: -1, linger: 0 });
      // the torch, end over end
      w.addFx({ kind: 'spark', x: e.x, y: e.y - 22, vx: (tg.x - e.x) / dur, vy: (tg.y - (e.y - 22)) / dur, life: dur, size: 2, color: '#ffb04d' });
      w.after(dur, () => {
        if (!fighting(w, e, phase)) return;
        w.fxBurst(tg.x, tg.y, '#ff8a2a', 12, tg.r * 0.6);
        w.sfx('fireball', 0.4);
        const f = tg.q?.f;
        if (tg.q && f && w.fields.includes(f)) {
          // the pitch catches
          tg.q.lit = true;
          f.look = 'fire';
          f.status = burn(e);
          f.dmg = e.dmg * k.num('tick', 0.24);
          f.t = f.dur = k.num('burn', 5);
        } else if (onFloor(w, e, tg.x, tg.y, 2)) {
          w.spawnField({ x: tg.x, y: tg.y, r: 16, dur: 3, tick: 0.5, dmg: e.dmg * 0.12, type: 'fire', status: burn(e), look: 'fire', hostile: true, depth: 0, spec: null, onHit: false });
          const nf = w.fields[w.fields.length - 1];
          if (nf) fight(w, e).pitch.push({ f: nf, lit: true });
        }
      });
    });
    w.text(e.x, e.y - e.r - 18, 'TORCHES!', '#ffb04d', true);
    w.sfx('sling', 0.7);
    pt.step = 1;
  } else if (pt.t >= 0.8) k.end();
};

/* ------------------------------------------------------------ General Morvain */

/** A fire where a burning arrow struck: it burns whoever stands in it for `life` s. */
function addFire(w: World, e: Enemy, x: number, y: number, life: number): void {
  if (!onFloor(w, e, x, y, 2)) return;
  const s = fight(w, e);
  s.fires = s.fires.filter((f) => w.fields.includes(f));
  if (s.fires.length >= MAX_FIRES) s.fires[0]!.t = Math.min(s.fires[0]!.t, 0.3);
  w.spawnField({ x, y, r: 14, dur: life, tick: 0.5, dmg: e.dmg * 0.12, type: 'fire', status: burn(e), look: 'fire', hostile: true, depth: 0, spec: null, onHit: false });
  const f = w.fields[w.fields.length - 1];
  if (f) s.fires.push(f);
}

/**
 * Arrows rain on every other band (`band` px wide) across the room: `parity` picks which. With `fire`,
 * that many burning arrows in each band start a fire that lasts `fireLife` s.
 */
function volleyBands(w: World, e: Enemy, vertical: boolean, parity: number, band: number, wind: number, mul: number, fire: number, fireLife: number): void {
  const b = roomBox(w, e);
  const lo = vertical ? b.x0 : b.y0;
  const hi = vertical ? b.x1 : b.y1;
  const n = Math.ceil((hi - lo) / band);
  const phase = e.boss!.phase;
  for (let i = 0; i < n; i++) {
    if (i % 2 !== parity) continue;
    const c0 = lo + i * band;
    const c1 = Math.min(hi, c0 + band);
    const c = (c0 + c1) / 2;
    const width = c1 - c0;
    if (vertical) w.addTelegraph({ shape: 'line', x: c, y: b.y0, r: 0, r2: width, angle: Math.PI / 2, len: b.y1 - b.y0, dur: wind, dmg: e.dmg * mul, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
    else w.addTelegraph({ shape: 'line', x: b.x0, y: c, r: 0, r2: width, angle: 0, len: b.x1 - b.x0, dur: wind, dmg: e.dmg * mul, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
    w.after(wind - 0.3, () => {
      if (!fighting(w, e, phase)) return;
      // the arrows come down along the band
      const len = vertical ? b.y1 - b.y0 : b.x1 - b.x0;
      for (let j = 0; j < len / 20; j++) {
        const x = vertical ? c0 + w.rand() * width : b.x0 + w.rand() * len;
        const y = vertical ? b.y0 + w.rand() * len : c0 + w.rand() * width;
        if (onFloor(w, e, x, y, 1)) w.addFx({ kind: 'beam', x, y, life: 0.3 + w.rand() * 0.1, size: 1, color: '#e8e0c8', sprite: 'arrow' });
      }
    });
    for (let j = 0; j < fire; j++) {
      const len = vertical ? b.y1 - b.y0 : b.x1 - b.x0;
      const x = vertical ? c0 + 6 + w.rand() * (width - 12) : b.x0 + w.rand() * len;
      const y = vertical ? b.y0 + w.rand() * len : c0 + 6 + w.rand() * (width - 12);
      w.after(wind, () => {
        if (fighting(w, e, phase)) addFire(w, e, x, y, fireLife);
      });
    }
  }
  w.after(wind, () => {
    if (fighting(w, e, phase)) w.sfx('arrowRain', 0.7);
  });
}

/**
 * "Archers, loose!": the archers on the walls rain arrows on bands `band` px wide across the room,
 * every other band at once: first the half the hero stands in, then (as those land) the other half.
 * `sweeps` 4 does it twice, the second time crosswise. Each band lands after `wind` s for `mul` of his
 * blow, and with `fire` the arrows burn: that many fires in each band, for `fireLife` s. Morvain
 * fights on while they fall.
 */
const arrows: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  if (pt.step === 0) {
    const band = k.num('band', 40);
    const wind = k.num('wind', 1.3);
    const mul = k.num('mul', 1.1);
    const sweeps = k.num('sweeps', 2);
    const phase = e.boss!.phase;
    let vertical = w.rand() < 0.5;
    let parity = 0;
    for (let s = 0; s < sweeps; s++) {
      const first = s % 2 === 0;
      w.after(s * wind, () => {
        if (!fighting(w, e, phase)) return;
        if (first) {
          if (s > 0) vertical = !vertical;
          const b = roomBox(w, e);
          const p = w.player;
          parity = Math.max(0, Math.floor(((vertical ? p.x - b.x0 : p.y - b.y0) / band) % 2));
        } else parity = 1 - parity;
        volleyBands(w, e, vertical, parity, band, wind, mul, k.num('fire', 0), k.num('fireLife', 5));
      });
    }
    w.text(e.x, e.y - e.r - 18, 'ARCHERS, LOOSE!', '#ff9a8a', true);
    w.addFx({ kind: 'glow', x: e.x + Math.cos(e.face) * 8, y: e.y - 20, life: 0.6, size: 12, color: '#e8e0c8' });
    w.sfx('volley', 0.8);
    pt.step = 1;
  } else if (pt.t >= 0.6) k.end();
};

/**
 * The war banner: Morvain plants it beside him (after `wind` s). While it stands, every soldier within
 * `r` of it is warded (a shield of `adds` of its health) and rallied (attacks `rally` times as fast),
 * and the general himself is warded up to `ward` of his health, growing by `rate` of it a second while
 * he is near it. Breaking the banner breaks every ward. If it still stands, the call is a rally: the
 * wards come back at once.
 */
const banner: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const s = fight(w, e);
  if (pt.step === 0) {
    s.ward = { r: k.num('r', 110), boss: k.num('ward', 0.06), rate: k.num('rate', 0.004), adds: k.num('adds', 0.3), rally: k.num('rally', 1.3) };
    if (standing(w, s.banner)) {
      w.text(e.x, e.y - e.r - 18, 'RALLY TO THE COLORS!', GOLD, true);
      w.addFx({ kind: 'ring', x: s.banner.x, y: s.banner.y, life: 0.7, size: s.ward.r, color: GOLD });
      w.sfx('roar', 0.5);
      s.wardT = 0;
      pt.data.t1 = pt.t;
      pt.step = 9;
      return;
    }
    w.text(e.x, e.y - e.r - 18, 'TO THE COLORS!', GOLD, true);
    w.addFx({ kind: 'glow', x: e.x, y: e.y - 16, life: k.num('wind', 0.8), size: 18, color: GOLD });
    w.sfx('summon', 0.7);
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= k.num('wind', 0.8)) {
    const side = Math.cos(e.face) < 0 ? 1 : -1;
    w.spawnAdd(BANNER, e.x + side * (e.r + 10), e.y + 4, e.room);
    const flag = w.enemies[w.enemies.length - 1];
    if (flag?.def.id === BANNER) {
      s.banner = flag;
      s.wardT = 0.8;
      w.fxBurst(flag.x, flag.y - 8, GOLD, 18, 16);
      w.addFx({ kind: 'ring', x: flag.x, y: flag.y, life: 0.8, size: s.ward.r, color: GOLD });
    }
    w.sfx('slam', 0.8);
    w.shake(3);
    pt.data.t1 = pt.t;
    pt.step = 9;
  } else if (pt.step === 9 && pt.t >= pt.data.t1! + 0.4) k.end();
};

/** The middle of the gate of the boss room farthest from the hero, and the way into the room from it. */
function farGate(w: World, e: Enemy): { x: number; y: number; ix: number; iy: number } | null {
  const doors = w.map.doors[e.room] ?? [];
  if (!doors.length) return null;
  const p = w.player;
  const at = (i: number): { x: number; y: number } => ({ x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE });
  let best = at(doors[0]!);
  for (const i of doors) {
    const c = at(i);
    if (dist(c.x, c.y, p.x, p.y) > dist(best.x, best.y, p.x, p.y)) best = c;
  }
  // the whole gate: its door tiles next to that one
  const gate = doors.map(at).filter((c) => dist(c.x, c.y, best.x, best.y) <= TILE * 2.5);
  const x = gate.reduce((a, c) => a + c.x, 0) / gate.length;
  const y = gate.reduce((a, c) => a + c.y, 0) / gate.length;
  const b = e.boss!;
  const l = Math.hypot(b.cx - x, b.cy - y) || 1;
  // straight in through the gate (the side of the room it opens on)
  const dx = (b.cx - x) / l;
  const dy = (b.cy - y) / l;
  return Math.abs(dx) > Math.abs(dy) ? { x, y, ix: Math.sign(dx), iy: 0 } : { x, y, ix: 0, iy: Math.sign(dy) };
}

/**
 * A squad marches in: the `enemies` come through the gate farthest from the hero, side by side, as
 * long as no more than `cap` of his troops are already in the room.
 */
const squad: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  if (pt.step === 0) {
    const list = (k.use.p?.enemies as string[] | undefined) ?? ['legion-shieldbearer'];
    const adds = w.enemies.filter((x) => !x.dead && !x.boss && x.room === e.room && x.def.id !== BANNER).length;
    const n = Math.min(list.length, k.num('cap', 5) - adds);
    const gate = farGate(w, e);
    if (n <= 0 || !gate) {
      k.end();
      return;
    }
    pt.data.n = n;
    pt.data.gx = gate.x + gate.ix * 26;
    pt.data.gy = gate.y + gate.iy * 26;
    pt.data.px = -gate.iy;
    pt.data.py = gate.ix;
    w.text(gate.x + gate.ix * 30, gate.y + gate.iy * 30 - 10, 'SQUAD, FORWARD!', '#ff9a8a', true);
    w.text(e.x, e.y - e.r - 18, 'SEND THEM IN!', '#ff9a8a', false);
    w.addFx({ kind: 'glow', x: pt.data.gx, y: pt.data.gy, life: 0.8, size: 20, color: '#ff6a4d' });
    w.sfx('doorSlam', 0.7);
    w.sfx('roar', 0.4);
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= 0.7) {
    const list = (k.use.p?.enemies as string[] | undefined) ?? ['legion-shieldbearer'];
    const n = pt.data.n!;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 20;
      w.spawnAdd(list[i]!, pt.data.gx! + pt.data.px! * off, pt.data.gy! + pt.data.py! * off, e.room);
    }
    pt.step = 2;
  } else if (pt.step === 2 && pt.t >= 1.1) k.end();
};

/**
 * The last volley: every archer on the walls looses at once. The whole room is covered (shown for a
 * while: longer the farther the hero has to go, at least `wind` s), except a circle `safe` around the
 * war banner, which they won't shoot, or around the general himself once it has fallen. It lands for
 * `mul` of his blow; then Morvain swings all round himself (a circle of `slam`, and with `wave` a
 * shockwave rolling out from it).
 */
const lastVolley: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const s = fight(w, e);
  if (pt.step === 0) {
    const p = w.player;
    const flag = standing(w, s.banner) ? s.banner : null;
    const cx = flag ? flag.x : e.x;
    const cy = flag ? flag.y : e.y;
    const safe = k.num('safe', 46);
    const b = roomBox(w, e);
    const far = Math.max(dist(cx, cy, b.x0, b.y0), dist(cx, cy, b.x1, b.y0), dist(cx, cy, b.x0, b.y1), dist(cx, cy, b.x1, b.y1)) + 16;
    const wind = clamp(dist(p.x, p.y, cx, cy) / 60 + 1.4, k.num('wind', 3.2), 6);
    pt.data.cx = cx;
    pt.data.cy = cy;
    pt.data.wind = wind;
    pt.data.safe = safe;
    pt.data.said = 99;
    pt.data.ringT = 0;
    w.addTelegraph({ shape: 'donut', x: cx, y: cy, r: far, r2: safe, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 2.2), knock: 60, tone: 'enemy', owner: -1, linger: 0 });
    w.text(e.x, e.y - e.r - 18, 'LOOSE EVERYTHING!', '#ff6a5a', true);
    w.text(cx, cy - 34, flag ? 'TO THE BANNER! They won’t shoot their colors' : 'TO THE GENERAL! They won’t shoot him', GOLD, true);
    w.sfx('roar', 0.8);
    w.sfx('beamCharge', 0.7);
    pt.step = 1;
  } else if (pt.step === 1) {
    const cx = pt.data.cx!;
    const cy = pt.data.cy!;
    const left = Math.ceil(pt.data.wind! - pt.t);
    if (left !== pt.data.said && left <= 3 && left > 0) {
      pt.data.said = left;
      w.text(cx, cy - 26, String(left), GOLD, true);
      w.sfx('enemyWindup', 0.5);
    }
    if (pt.t >= pt.data.ringT!) {
      pt.data.ringT = pt.t + 0.4;
      w.addFx({ kind: 'ring', x: cx, y: cy, life: 0.5, size: pt.data.safe!, color: GOLD });
    }
    if (pt.t >= pt.data.wind!) {
      // the sky goes dark with arrows
      const b = roomBox(w, e);
      for (let i = 0; i < 70; i++) {
        const x = b.x0 + w.rand() * (b.x1 - b.x0);
        const y = b.y0 + w.rand() * (b.y1 - b.y0);
        if (dist(x, y, cx, cy) > pt.data.safe! && onFloor(w, e, x, y, 1)) w.addFx({ kind: 'beam', x, y, life: 0.3 + w.rand() * 0.15, size: 1, color: '#e8e0c8', sprite: 'arrow' });
      }
      w.sfx('arrowRain');
      w.sfx('volley');
      w.shake(6);
      // and his own blade, for whoever came close
      w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: k.num('slam', 52), r2: 0, angle: 0, len: 0, dur: k.num('slamWind', 0.75), dmg: e.dmg * k.num('slamMul', 1.4), knock: 150, tone: 'enemy', owner: e.id, linger: 0 });
      pt.data.t1 = pt.t;
      pt.step = 2;
    }
  } else if (pt.step === 2 && pt.t >= pt.data.t1! + k.num('slamWind', 0.75)) {
    w.addFx({ kind: 'slash', x: e.x, y: e.y, a: e.face, a2: TAU, life: 0.25, size: k.num('slam', 52), color: '#d8e0ff', r2: 1 });
    w.sfx('swingBig');
    w.shake(3);
    if (k.num('wave', 0) > 0) w.spawnWave(e.x, e.y, 120, 170, 8, e.dmg * k.num('wave', 0));
    pt.step = 3;
  } else if (pt.step === 3 && pt.t >= pt.data.t1! + k.num('slamWind', 0.75) + 0.35) k.end();
};

/**
 * The death knight's charge: down a lane at the hero (shown for `wind` s, `wind2` after the first) at
 * `speed`, `mul` of his blow to whoever is in the way, and where he stops, a blow all round (a circle
 * of `r` after `slamWind` s, `slamMul`) that sends out a shockwave (`wave` of his blow, rolling out at
 * `waveSpeed` to `waveMax`; none without `wave`). `passes` times.
 */
const deathcharge: PatternFn = (w, e, dt, k) => {
  const { pt } = k;
  const p = w.player;
  if (pt.step === 0) {
    const a = k.aimAt();
    const end = castRay(w.map, e.x, e.y, e.r, a, k.num('len', 320));
    pt.data.a = a;
    pt.data.left = Math.max(30, dist(e.x, e.y, end.x, end.y));
    pt.data.t0 = pt.t;
    pt.data.wind = (pt.data.n ?? 0) === 0 ? k.num('wind', 0.8) : k.num('wind2', 0.55);
    w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: (e.r + w.player.r + 3) * 2, angle: a, len: pt.data.left + e.r, dur: pt.data.wind, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
    faceTo(e, a);
    if (!pt.data.n) w.text(e.x, e.y - e.r - 18, 'FOR THE KING!', '#ff9a8a', true);
    w.sfx('windup', 0.7);
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= pt.data.t0! + pt.data.wind!) {
    pt.step = 2;
    pt.data.hit = 0;
    w.sfx('rush');
  } else if (pt.step === 2) {
    const a = pt.data.a!;
    const step = k.num('speed', 330) * dt;
    const m = moveCircle(w.map, e.x, e.y, e.r, Math.cos(a) * step, Math.sin(a) * step);
    e.x = m.x;
    e.y = m.y;
    e.walkT += dt * 2;
    pt.data.left! -= step;
    w.addFx({ kind: 'smoke', x: e.x - Math.cos(a) * e.r, y: e.y + e.r * 0.5, life: 0.4, size: 4, color: '#5a5a72' });
    if (!pt.data.hit && !p.dead && dist(e.x, e.y, p.x, p.y) < e.r + p.r + 3) {
      pt.data.hit = 1;
      hurtPlayer(w, e.dmg * k.num('mul', 1.4), { fromX: e.x, fromY: e.y, knock: 200, source: e });
    }
    if (m.bx || m.by || pt.data.left! <= 0) {
      if (m.bx || m.by) {
        w.shake(3);
        w.sfx('slam', 0.7);
      }
      w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: k.num('r', 46), r2: 0, angle: 0, len: 0, dur: k.num('slamWind', 0.55), dmg: e.dmg * k.num('slamMul', 1.5), knock: 160, tone: 'enemy', owner: e.id, linger: 0 });
      faceTo(e, k.aimAt());
      pt.data.t1 = pt.t;
      pt.step = 3;
    }
  } else if (pt.step === 3 && pt.t >= pt.data.t1! + k.num('slamWind', 0.55)) {
    w.addFx({ kind: 'slash', x: e.x, y: e.y, a: e.face, a2: TAU, life: 0.22, size: k.num('r', 46), color: '#d8e0ff', r2: 1 });
    w.sfx('swingBig');
    w.shake(3);
    // the blade in the stones: a shockwave rolls out (dodge through it, or be beyond its reach)
    if (k.num('wave', 0) > 0) w.spawnWave(e.x, e.y, k.num('waveSpeed', 120), k.num('waveMax', 150), 8, e.dmg * k.num('wave', 0));
    pt.data.n = (pt.data.n ?? 0) + 1;
    pt.data.t1 = pt.t;
    pt.step = pt.data.n >= k.num('passes', 2) ? 5 : 4;
  } else if (pt.step === 4 && pt.t >= pt.data.t1! + 0.15) pt.step = 0;
  else if (pt.step === 5 && pt.t >= pt.data.t1! + 0.4) k.end();
};

/**
 * His guard: Morvain sets the greatsword across himself for `time` s. Wound him while it is up (a blow,
 * a spell, a burn ticking) and he answers at once: a riposte, a wide cut (`r`, half-angle `arc`) after
 * only `wind` s for `mul` of his blow. Leave him be and the guard ends in a lunge along a line.
 */
const guard: PatternFn = (w, e, dt, k) => {
  const { pt } = k;
  const s = fight(w, e);
  if (pt.step === 0) {
    if (e.def.sprite !== GUARD_SPRITE) s.sprite = e.def.sprite;
    e.def = { ...e.def, sprite: GUARD_SPRITE };
    // any wound from here on (hitEnemy marks the moment: a boss's hurtT is only ever reset by a hit)
    e.hurtT = 99;
    pt.data.hp = e.hp + e.shield;
    faceTo(e, k.aimAt());
    w.text(e.x, e.y - e.r - 18, 'GUARD!', '#d8e0ff', true);
    w.sfx('shield', 0.8);
    pt.step = 1;
  } else if (pt.step === 1) {
    faceTo(e, k.aimAt());
    if (w.rand() < dt * 10) w.addFx({ kind: 'spark', x: e.x + Math.cos(e.face) * 6, y: e.y - 6 - w.rand() * 16, vx: 0, vy: -10, life: 0.4, size: 1, color: '#e8f0ff' });
    const hurt = e.hurtT < 1 || e.hp + e.shield < pt.data.hp! - 0.5;
    if (hurt || pt.t >= k.num('time', 2.4)) {
      const a = k.aimAt();
      pt.data.a = a;
      pt.data.t1 = pt.t;
      faceTo(e, a);
      e.def = { ...e.def, sprite: s.sprite };
      if (hurt) {
        pt.data.wind = k.num('wind', 0.45);
        pt.data.c = 1;
        w.addTelegraph({ shape: 'cone', x: e.x, y: e.y, r: k.num('r', 62), r2: k.num('arc', 1.15), angle: a, len: 0, dur: pt.data.wind, dmg: e.dmg * k.num('mul', 2), knock: 190, tone: 'enemy', owner: e.id, linger: 0 });
        w.text(e.x, e.y - e.r - 18, 'RIPOSTE!', '#ff6a5a', true);
        w.sfx('windup', 0.8);
      } else {
        pt.data.wind = 0.6;
        pt.data.c = 0;
        const end = castRay(w.map, e.x, e.y, 2, a, 150);
        w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: 20, angle: a, len: Math.max(e.r + 8, dist(e.x, e.y, end.x, end.y)), dur: 0.6, dmg: e.dmg * 1.5, knock: 140, tone: 'enemy', owner: e.id, linger: 0.1 });
        w.sfx('windup', 0.6);
      }
      pt.step = 2;
    }
  } else if (pt.step === 2 && pt.t >= pt.data.t1! + pt.data.wind!) {
    const a = pt.data.a!;
    if (pt.data.c) w.addFx({ kind: 'slash', x: e.x, y: e.y, a, a2: k.num('arc', 1.15) * 2, life: 0.2, size: k.num('r', 62), color: '#ffb0a0', r2: 1 });
    else for (let j = 1; j <= 4; j++) w.fxBurst(e.x + Math.cos(a) * 30 * j, e.y + Math.sin(a) * 30 * j, '#d8e0ff', 3, 6);
    w.sfx('swingBig');
    w.shake(3);
    pt.step = 3;
  } else if (pt.step === 3 && pt.t >= pt.data.t1! + pt.data.wind! + 0.35) k.end();
};

export const SIEGE_OF_HIGHWALL_PATTERNS: Record<string, PatternFn> = {
  'siege:ram': ram,
  'siege:pitch': pitch,
  'siege:torch': torch,
  'siege:arrows': arrows,
  'siege:banner': banner,
  'siege:squad': squad,
  'siege:last-volley': lastVolley,
  'siege:deathcharge': deathcharge,
  'siege:guard': guard,
};
