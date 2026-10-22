import { dist, dist2, inCone, TAU } from '../../core/math';
import { hurtPlayer } from '../combat';
import { castRay, circleHitsWall, K, lineOfSight, moveCircle, pushOut, TILE, tileAt } from '../map';
import type { Enemy, Field } from '../types';
import type { World } from '../world';
import type { PatternFn } from './kit';

/**
 * Boss attacks of the Rimeheld Vault: ids start with 'rime:'.
 *
 * Jarl Hrimfang, the frost giant who sold the vault to the Legion: stomps that shatter the floor in
 * spokes of ice (`shatter`), blocks of ice hurled to burst into shards (`boulder`), and a war cry that
 * calls his huscarls in from the camp and his hounds to his side (`warcry`).
 *
 * The Rime Wyrm, the vault's guardian woken and maddened: frost breath that sweeps across the cavern
 * (`breath`), wing gusts that drive the hero back (`gust`), icicles shaken from the roof (`icicles`,
 * and in the end a steady fall of them, `storm`), ice it breathes onto the floor (`frost`), and its
 * flight (`flight`): it takes to the air where nothing can touch it, its shadow circling the cavern,
 * strafing the floor with frost while ice spreads and icicles fall, until it dives back down on the
 * hero. Its ice stays: patches that grow, and anyone who stands on them too long freezes solid.
 *
 * The lasting parts (the ice, the cold building in a hero standing on it, the storm) outlive the
 * pattern that made them, so each boss keeps them here and a small ticker (World.after, once a step)
 * runs them for as long as the fight lasts. A phase change or a defeat clears them like every other
 * attack.
 */

const FROST = '#9ad8ff';
const ICE = '#e8f8ff';
const CHILL = { status: 'chill' as const, dur: 1.2, power: 0.35 };
/** Seconds on the wyrm's ice before the hero freezes solid. */
const FREEZE_AT = 2.4;

interface Ice {
  f: Field;
  max: number;
  grow: number;
}
interface Storm {
  every: number;
  count: number;
  r: number;
  mul: number;
  t: number;
}
interface Fight {
  last: number;
  ices: Ice[];
  /** Seconds the hero has stood on the ice (it wears off when they step away). */
  cold: number;
  /** After freezing, a moment before the cold can take hold again. */
  grace: number;
  said: number;
  coldFx: number;
  /** Seconds to the next bite of the ice (however many patches the hero stands in, it bites once). */
  bite: number;
  storm: Storm | null;
}

const FIGHTS = new WeakMap<Enemy, Fight>();

const alive = (w: World, e: Enemy): boolean => !e.dead && !!e.boss && e.boss.dying <= 0 && w.enemies.includes(e);

/** The boss is up in the air right now (out of reach, only its shadow showing). */
const inFlight = (e: Enemy): boolean => e.boss?.pattern?.use.id === 'rime:flight' && e.boss.pattern.data.hide === 1;

const faceTo = (e: Enemy, a: number): void => {
  e.face = Math.cos(a) < 0 ? Math.PI : 0;
};

/** The boss's lasting state, starting its ticker the first time. */
function fight(w: World, e: Enemy): Fight {
  let s = FIGHTS.get(e);
  if (!s) {
    s = { last: w.time, ices: [], cold: 0, grace: 0, said: 99, coldFx: 0, bite: 0, storm: null };
    FIGHTS.set(e, s);
    w.after(0, () => tick(w, e));
  }
  return s;
}

/** Once a step for as long as the boss fights: the ice spreads, the cold builds, the storm falls. */
function tick(w: World, e: Enemy): void {
  const s = FIGHTS.get(e);
  if (!s) return;
  if (!alive(w, e)) {
    // won, or the room reset after a defeat: the ice goes with the fight
    const mine = new Set<Field>(s.ices.map((i) => i.f));
    w.fields = w.fields.filter((f) => !mine.has(f));
    FIGHTS.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  s.ices = s.ices.filter((i) => w.fields.includes(i.f));
  for (const i of s.ices) i.f.r = Math.min(i.max, i.f.r + i.grow * dt);
  tickCold(w, e, s, dt);
  tickStorm(w, e, s, dt);
  w.after(0, () => tick(w, e));
}

/* ------------------------------------------------------------------ the room */

/** The boss room's bounds in pixels (worked out once per fight). */
function roomBox(w: World, e: Enemy): { x0: number; y0: number; x1: number; y1: number } {
  const m = e.boss!.misc;
  if (m.rx1 === undefined) {
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
    m.rx0 = x0 * TILE;
    m.ry0 = y0 * TILE;
    m.rx1 = (x1 + 1) * TILE;
    m.ry1 = (y1 + 1) * TILE;
  }
  return { x0: m.rx0!, y0: m.ry0!, x1: m.rx1, y1: m.ry1! };
}

/** A spot on the boss room's floor with room for a circle of radius r. */
function onFloor(w: World, e: Enemy, x: number, y: number, r: number): boolean {
  const i = tileAt(w.map, x, y);
  return i >= 0 && w.map.room[i] === e.room + 1 && !circleHitsWall(w.map, x, y, r);
}

/** A random open spot of the boss room's floor (or null after a few tries). */
function anySpot(w: World, e: Enemy, r: number): { x: number; y: number } | null {
  const tiles = w.map.roomTiles[e.room] ?? [];
  for (let tries = 0; tries < 10 && tiles.length; tries++) {
    const t = tiles[Math.floor(w.rand() * tiles.length)]!;
    const x = ((t % w.map.w) + 0.5) * TILE + (w.rand() - 0.5) * 8;
    const y = (Math.floor(t / w.map.w) + 0.5) * TILE + (w.rand() - 0.5) * 8;
    if (onFloor(w, e, x, y, r)) return { x, y };
  }
  return null;
}

/** A spot `d0`-`d1` px from the hero on the boss room's floor (or null). */
function nearHero(w: World, e: Enemy, d0: number, d1: number, r: number): { x: number; y: number } | null {
  const p = w.player;
  for (let tries = 0; tries < 10; tries++) {
    const a = w.rand() * TAU;
    const d = d0 + w.rand() * (d1 - d0);
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d * 0.8;
    if (onFloor(w, e, x, y, r)) return { x, y };
  }
  return null;
}

const addsIn = (w: World, e: Enemy): number => w.enemies.filter((o) => !o.dead && !o.boss && o.room === e.room).length;

/* ------------------------------------------------------------------ the ice and the cold */

/**
 * A patch of the wyrm's ice: it grows (`grow` px a second, up to `max`) for `life` seconds. The field
 * itself only shows it: the bite and the cold are the fight's (tickCold), so patches that overlap
 * don't bite twice.
 */
function addIce(w: World, e: Enemy, x: number, y: number, r0: number, max: number, grow: number, life: number): void {
  if (circleHitsWall(w.map, x, y, 2)) return;
  const s = fight(w, e);
  w.spawnField({ x, y, r: r0, dur: life, tick: 0.5, dmg: 0, type: 'frost', look: 'frost', hostile: true, depth: 0, spec: null, onHit: false });
  const f = w.fields[w.fields.length - 1];
  if (f) s.ices.push({ f, max, grow });
  // never more than so much ice at once: the oldest patches thaw
  const live = s.ices.filter((i) => i.f.t > 1.2);
  if (live.length > 14) live[0]!.f.t = 1.2;
}

/** The cold builds while the hero stands on the ice (not while dodging across it) and freezes them solid. */
function tickCold(w: World, e: Enemy, s: Fight, dt: number): void {
  const p = w.player;
  if (p.dead || p.iframe > 1) {
    s.cold = 0;
    return;
  }
  s.grace = Math.max(0, s.grace - dt);
  const under = (i: Ice): boolean => dist2(p.x, p.y, i.f.x, i.f.y) < (i.f.r + p.r * 0.5) ** 2;
  const onIce = !p.dash && s.ices.some(under);
  // the ice bites (a tenth of the wyrm's blow every half second) and slows
  s.bite -= dt;
  if (onIce && s.bite <= 0) {
    s.bite = 0.5;
    hurtPlayer(w, e.dmg * 0.1, { status: CHILL });
  }
  if (onIce && s.grace <= 0) s.cold += dt;
  else s.cold = Math.max(0, s.cold - dt * 1.5);
  if (s.cold < 0.7) {
    s.said = 99;
    return;
  }
  // the frost creeps up the hero: rings and motes, and a count while they still have time
  s.coldFx -= dt;
  if (s.coldFx <= 0) {
    s.coldFx = 0.18;
    w.addFx({ kind: 'ring', x: p.x, y: p.y, life: 0.35, size: 14, color: FROST });
    const a = w.rand() * TAU;
    w.addFx({ kind: 'spark', x: p.x + Math.cos(a) * 6, y: p.y - 4 + Math.sin(a) * 4, vx: 0, vy: -40, life: 0.4, size: 1, color: ICE });
  }
  const left = Math.ceil(FREEZE_AT - s.cold);
  if (left !== s.said && onIce) {
    if (s.said === 99) w.text(p.x, p.y - 30, 'FREEZING! Off the ice!', '#c8f0ff', true);
    else w.text(p.x, p.y - 26, String(left), '#c8f0ff', true);
    s.said = left;
    w.sfx('freeze', 0.35);
  }
  if (s.cold < FREEZE_AT) return;
  s.cold = 0;
  s.grace = 2.5;
  s.said = 99;
  const dur = 1.1;
  if (!hurtPlayer(w, e.dmg * 0.7, { status: { status: 'stun', dur, power: 1 } })) return;
  // frozen in, and the ice under the hero cracks away as they break free (no freezing twice in a row)
  for (const i of s.ices) if (under(i)) i.f.t = Math.min(i.f.t, dur);
  w.text(p.x, p.y - 30, 'FROZEN SOLID!', ICE, true);
  w.sfx('freeze');
  w.shake(3);
  w.fxBurst(p.x, p.y - 6, ICE, 16, 14);
  // a shell of ice around the hero while it holds, then it cracks
  for (let k = 0; k * 0.12 < dur; k++) {
    w.after(k * 0.12, () => {
      if (p.dead) return;
      w.addFx({ kind: 'glow', x: p.x, y: p.y - 6, life: 0.2, size: 12, color: FROST });
      w.addFx({ kind: 'shard', x: p.x + (w.rand() - 0.5) * 12, y: p.y - 2 - w.rand() * 14, life: 0.25, size: 2, color: ICE });
    });
  }
  w.after(dur, () => {
    if (p.dead) return;
    for (let j = 0; j < 8; j++) {
      const a = (TAU * j) / 8;
      w.addFx({ kind: 'shard', x: p.x, y: p.y - 6, vx: Math.cos(a) * 50, vy: Math.sin(a) * 40 - 10, life: 0.4, size: 2, color: ICE });
    }
    w.sfx('shard', 0.6);
  });
}

/* ------------------------------------------------------------------ icicles */

/** An icicle falls from the roof: its circle fills for `dur`, it drops, shatters, and (with `ice`) leaves a patch of ice. */
function icicle(w: World, e: Enemy, x: number, y: number, r: number, dur: number, mul: number, ice: boolean): void {
  const id = w.nextId;
  w.addTelegraph({ shape: 'circle', x, y, r, r2: 0, angle: 0, len: 0, dur, dmg: e.dmg * mul, status: CHILL, knock: 50, tone: 'enemy', owner: -1, linger: 0 });
  const tg = w.telegraphs.find((t) => t.id === id);
  const fall = Math.min(dur, 0.5);
  w.after(dur - fall, () => {
    if (!tg || !w.telegraphs.includes(tg) || !alive(w, e)) return;
    // the icicle itself, dropping fast: a streak of ice
    const h = 120;
    for (const [dy, size, color] of [
      [0, 3, ICE],
      [-3, 2, ICE],
      [-6, 2, FROST],
      [-9, 1, FROST],
    ] as const) {
      w.addFx({ kind: 'shard', x: x - size / 2, y: y - h + dy, vx: 0, vy: h / fall, life: fall, size, color });
    }
  });
  w.after(dur, () => {
    if (!tg || tg.t < tg.dur - 0.05 || !alive(w, e)) return;
    for (let j = 0; j < 7; j++) {
      const a = (TAU * j) / 7 + w.rand();
      w.addFx({ kind: 'shard', x, y, vx: Math.cos(a) * 55, vy: Math.sin(a) * 40 - 25, life: 0.45, size: 2, color: j % 2 ? ICE : FROST });
    }
    w.addFx({ kind: 'ring', x, y, life: 0.35, size: r + 4, color: ICE });
    w.sfx('shard', 0.4);
    w.shake(1.5);
    if (ice) addIce(w, e, x, y, 8, 20, 3, 9);
  });
}

/** The roof keeps coming down: a few icicles every `every` seconds (one on the hero) until the end. */
function tickStorm(w: World, e: Enemy, s: Fight, dt: number): void {
  const st = s.storm;
  // not while it is in the air: its wings bring down enough on their own
  if (!st || e.boss!.shift > 0 || inFlight(e)) return;
  st.t -= dt;
  if (st.t > 0) return;
  st.t = st.every;
  const p = w.player;
  if (p.dead) return;
  if (onFloor(w, e, p.x, p.y, 2)) icicle(w, e, p.x, p.y, st.r, 1.4, st.mul, false);
  for (let i = 1; i < st.count; i++) {
    const at = nearHero(w, e, 40, 120, 4);
    if (at) icicle(w, e, at.x, at.y, st.r, 1.4, st.mul, true);
  }
}

/* ------------------------------------------------------------------ breath */

/** Frost pouring along a line: mist and glitter from the mouth outward. */
function breathFx(w: World, x: number, y: number, a: number, len: number): void {
  for (let d = 10; d < len; d += 14) {
    const px = x + Math.cos(a) * d + (w.rand() - 0.5) * 6;
    const py = y + Math.sin(a) * d + (w.rand() - 0.5) * 6;
    w.addFx({ kind: 'smoke', x: px, y: py - 3, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 6, life: 0.5 + w.rand() * 0.3, size: 3 + Math.floor(w.rand() * 3), color: w.rand() < 0.5 ? '#d8f0ff' : '#8ac0e8' });
    if (w.rand() < 0.5) w.addFx({ kind: 'shard', x: px, y: py - 2, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: 0.3, size: 1, color: ICE });
  }
  w.addFx({ kind: 'burst', x: x + Math.cos(a) * len, y: y + Math.sin(a) * len, life: 0.3, size: 10, color: '#c8ecff' });
}

/* ------------------------------------------------------------------ the Jarl */

/**
 * The Jarl stamps and the floor shatters: a circle around him, then spikes of ice burst up along
 * `spokes` lines all round him, one after another outward (each `r` across, `gap` s apart, from
 * `wind` on; walls and pillars stop them). With `stomps` 2 the second turns half a spoke, so the
 * gaps of the first are where it lands: step into a gap that has burst, then out again.
 */
const shatter: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const stomps = k.num('stomps', 1);
  const wind = k.num('wind', 0.9);
  if (pt.step === 0) {
    const n = pt.data.n ?? 0;
    const spokes = k.num('spokes', 6);
    const r = k.num('r', 13);
    const gap = k.num('gap', 0.07);
    const mul = k.num('mul', 1.2);
    const a0 = n === 0 ? k.aimAt() : pt.data.a0! + Math.PI / spokes;
    pt.data.a0 = a0;
    w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: e.r + 22, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * mul, knock: 150, tone: 'enemy', owner: e.id, linger: 0 });
    let last = 0;
    for (let i = 0; i < spokes; i++) {
      const a = a0 + (TAU * i) / spokes;
      const end = castRay(w.map, e.x, e.y, 2, a, k.num('len', 150));
      const L = dist(e.x, e.y, end.x, end.y);
      let j = 0;
      for (let d = e.r + 22 + r; d <= L; d += r * 2, j++) {
        const x = e.x + Math.cos(a) * d;
        const y = e.y + Math.sin(a) * d;
        const t = wind + (j + 1) * gap;
        w.addTelegraph({ shape: 'circle', x, y, r, r2: 0, angle: 0, len: 0, dur: t, dmg: e.dmg * mul * 0.85, status: CHILL, knock: 70, tone: 'enemy', owner: -1, linger: 0 });
        w.after(t, () => {
          if (!alive(w, e)) return;
          // a spike of ice punches up through the floor
          w.addFx({ kind: 'shard', x: x - 1, y: y - 10, vx: 0, vy: -20, life: 0.3, size: 3, color: ICE });
          w.addFx({ kind: 'shard', x: x - 2, y: y - 4, vx: 0, vy: -10, life: 0.35, size: 4, color: FROST });
          w.addFx({ kind: 'smoke', x, y: y - 2, vx: 0, vy: -10, life: 0.5, size: 3, color: '#b8d8f0' });
        });
      }
      last = Math.max(last, j);
    }
    faceTo(e, a0);
    w.sfx('windup', 0.6);
    w.after(wind, () => {
      if (!alive(w, e)) return;
      w.sfx('slam');
      w.sfx('quake', 0.7);
      w.shake(5);
      w.fxBurst(e.x, e.y + 4, ICE, 18, e.r + 16);
    });
    pt.data.t1 = pt.t + wind + last * gap;
    pt.data.n = n + 1;
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= pt.data.t1!) {
    if (pt.data.n! < stomps) pt.step = 0;
    else {
      pt.data.t2 = pt.t;
      pt.step = 2;
    }
  } else if (pt.step === 2 && pt.t >= pt.data.t2! + 0.35) k.end();
};

/**
 * He wrenches up a block of ice and hurls it: `count` of them (one at the hero, the others `spread`
 * around), each landing where its circle shows after `dur` s for `mul` of his blow, then bursting into
 * `shards` splinters that fly outward (`shardMul` each). Out of the circle, then out of the splinters' way.
 */
const boulder: PatternFn = (w, e, dt, k) => {
  const { pt } = k;
  const lift = k.num('lift', 0.55);
  const dur = k.num('dur', 1.3);
  const n = k.num('count', 1);
  if (pt.step === 0) {
    w.addFx({ kind: 'glow', x: e.x, y: e.y - e.r - 10, life: lift, size: 12, color: FROST });
    for (let i = 0; i < 8; i++) w.addFx({ kind: 'rubble', x: e.x + (w.rand() - 0.5) * 16, y: e.y + 4, vx: (w.rand() - 0.5) * 60, vy: -40 - w.rand() * 40, life: 0.5, size: 2, color: w.rand() < 0.5 ? ICE : '#8ab0d0' });
    faceTo(e, k.aimAt());
    w.sfx('crumble', 0.6);
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= lift) {
    const p = w.player;
    const r = k.num('r', 26);
    const spread = k.num('spread', 70);
    const a0 = w.rand() * TAU;
    let m = 0;
    for (let i = 0; i < n; i++) {
      let x = p.x;
      let y = p.y;
      if (i > 0) {
        const a = a0 + (TAU * i) / Math.max(1, n - 1);
        x += Math.cos(a) * spread;
        y += Math.sin(a) * spread * 0.8;
      }
      if (!onFloor(w, e, x, y, 3)) continue;
      w.addTelegraph({ shape: 'circle', x, y, r, r2: 0, angle: 0, len: 0, dur, dmg: e.dmg * k.num('mul', 1.5), status: CHILL, knock: 140, tone: 'enemy', owner: -1, linger: 0 });
      pt.data[`x${m}`] = x;
      pt.data[`y${m}`] = y;
      m += 1;
      w.after(dur, () => {
        if (!alive(w, e)) return;
        w.sfx('explode', 0.5);
        w.sfx('shard', 0.6);
        w.shake(3);
        w.fxBurst(x, y, ICE, 16, r * 0.7);
        const shards = k.num('shards', 6);
        const b0 = w.rand() * TAU;
        for (let j = 0; j < shards; j++) {
          const a = b0 + (TAU * j) / shards;
          w.spawnProjectile({ x: x + Math.cos(a) * 6, y: y - 4 + Math.sin(a) * 6, vx: Math.cos(a) * 105, vy: Math.sin(a) * 105, r: 3, life: 130, dmg: e.dmg * k.num('shardMul', 0.6), type: 'frost', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'orb', color: '#c8ecff', hostile: true, homing: 0, child: false, knock: 0, status: CHILL });
        }
      });
    }
    pt.data.m = m;
    pt.data.ox = e.x;
    pt.data.oy = e.y - e.r - 8;
    pt.data.t0 = pt.t;
    w.sfx('sling', 0.9);
    pt.step = 2;
  } else if (pt.step === 2) {
    // the blocks in flight: high arcs, their shadows on the floor below
    const u = Math.min(1, (pt.t - pt.data.t0!) / dur);
    if (dt > 0) {
      for (let i = 0; i < (pt.data.m ?? 0); i++) {
        const tx = pt.data[`x${i}`]!;
        const ty = pt.data[`y${i}`]!;
        const gx = pt.data.ox! + (tx - pt.data.ox!) * u;
        const gy = pt.data.oy! + (ty - pt.data.oy!) * u;
        const h = Math.sin(u * Math.PI) * 44;
        w.addFx({ kind: 'shard', x: gx - 4, y: gy - h - 4, life: 0.05, size: 9, color: '#5a8ab8' });
        w.addFx({ kind: 'shard', x: gx - 3, y: gy - h - 4, life: 0.05, size: 6, color: '#a8d4f0' });
        w.addFx({ kind: 'shard', x: gx - 2, y: gy - h - 3, life: 0.05, size: 3, color: ICE });
        w.addFx({ kind: 'burst', x: gx, y: gy + 2, life: 0.05, size: Math.round(6 + u * 5), color: 'rgba(0,8,20,0.45)' });
      }
    }
    if (u >= 1) {
      pt.data.t1 = pt.t;
      pt.step = 3;
    }
  } else if (pt.step === 3 && pt.t >= pt.data.t1! + 0.3) k.end();
};

/**
 * The war cry: frost on his breath, a blast that throws the hero back (within `r`) and chills them,
 * his huscarls (`enemies`) come running in through the doors, and `hounds` of his hounds bound up at
 * his side (never more than four of his following at once).
 */
const warcry: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const wind = k.num('wind', 0.7);
  if (pt.step === 0) {
    w.text(e.x, e.y - e.r - 18, 'WAR CRY!', '#ffd27a', true);
    w.addFx({ kind: 'glow', x: e.x, y: e.y - e.r, life: wind, size: 18, color: FROST });
    w.sfx('enemyWindup', 0.6);
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= wind) {
    const p = w.player;
    const r = k.num('r', 80);
    w.sfx('roar');
    w.shake(6);
    w.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.5, size: r, color: ICE });
    w.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.7, size: r * 1.4, color: FROST });
    for (let i = 0; i < 14; i++) {
      const a = (TAU * i) / 14;
      w.addFx({ kind: 'smoke', x: e.x + Math.cos(a) * 10, y: e.y + Math.sin(a) * 6, vx: Math.cos(a) * 90, vy: Math.sin(a) * 60, life: 0.6, size: 4, color: '#c8e0f0' });
    }
    if (!p.dead && dist(e.x, e.y, p.x, p.y) < r) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      p.vx += Math.cos(a) * k.num('push', 220);
      p.vy += Math.sin(a) * k.num('push', 220);
      const cur = p.statuses.find((x) => x.id === 'chill');
      if (cur) cur.t = Math.max(cur.t, 1.5);
      else p.statuses.push({ id: 'chill', t: 1.5, power: 0.35, tick: 0 });
    }
    let room = Math.max(0, 4 - addsIn(w, e));
    // the huscarls, from the doors: each at the floor just inside one
    const doors = w.map.doors[e.room] ?? [];
    for (const id of (k.use.p?.enemies as string[] | undefined) ?? []) {
      if (room <= 0) break;
      let at = { x: e.x, y: e.y };
      const d = doors[Math.floor(w.rand() * doors.length)];
      if (d !== undefined) {
        const tx = d % w.map.w;
        const ty = Math.floor(d / w.map.w);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const j = (ty + dy * 2) * w.map.w + tx + dx * 2;
          if (w.map.room[j] === e.room + 1 && !w.map.solid[j]) {
            at = { x: (tx + dx * 2 + 0.5) * TILE, y: (ty + dy * 2 + 0.5) * TILE };
            break;
          }
        }
      }
      w.spawnAdd(id, at.x, at.y, e.room);
      room -= 1;
    }
    // and the hounds at his side
    const hounds = Math.min(room, k.num('hounds', 2));
    for (let i = 0; i < hounds; i++) {
      const a = (TAU * i) / Math.max(1, hounds) + w.rand();
      w.spawnAdd(k.str('hound', 'rime-hound'), e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, e.room);
    }
    pt.step = 2;
  } else if (pt.step === 2 && pt.t >= wind + 0.8) k.end();
};

/* ------------------------------------------------------------------ the Rime Wyrm */

/**
 * Frost breath sweeping across the cavern: the `arc` in front of it cut in `beams` slices (from the side
 * away from the way the hero is moving), all shown at once, bursting one after another from `wind` on,
 * `step` s apart, for `mul` of its blow (once a sweep) and leaving ice where it falls. Walls and the
 * columns stop it: hide behind one, or follow the sweep through where it has passed. With `sweeps` 2
 * it sweeps back the other way.
 */
const breath: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const beams = Math.max(2, k.num('beams', 9));
  const step = k.num('step', 0.08);
  const wind = k.num('wind', 1);
  if (pt.step === 0) {
    const p = w.player;
    const n = pt.data.n ?? 0;
    const arc = k.num('arc', 1.5);
    const a0 = n === 0 ? k.aimAt() : pt.data.a0!;
    // the first sweep starts on the side the hero is running from (they run into it, or turn back
    // through where it has passed); the second comes back
    let dir: number;
    if (n === 0) {
      const side = -Math.sin(a0) * p.vx + Math.cos(a0) * p.vy;
      dir = Math.abs(side) > 8 ? (side > 0 ? 1 : -1) : w.rand() < 0.5 ? 1 : -1;
    } else dir = -pt.data.dir!;
    pt.data.a0 = a0;
    pt.data.dir = dir;
    // the arc in slices, each as far as the breath gets before a wall or a column
    const half = arc / (2 * beams);
    const slice = (i: number): number => a0 - (dir * arc) / 2 + dir * half * (2 * i + 1);
    const id0 = w.nextId;
    const lens: number[] = [];
    for (let i = 0; i < beams; i++) {
      const a = slice(i);
      const end = castRay(w.map, e.x, e.y, 2, a, k.num('len', 210));
      const len = Math.max(e.r + 8, dist(e.x, e.y, end.x, end.y));
      lens.push(len);
      w.addTelegraph({ shape: 'cone', x: e.x, y: e.y, r: len, r2: half + 0.01, angle: a, len: 0, dur: wind + i * step, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0.15 });
    }
    const mul = k.num('mul', 1.3);
    const ox = e.x;
    const oy = e.y;
    pt.data.hit = 0;
    for (let i = 0; i < beams; i++) {
      const a = slice(i);
      const len = lens[i]!;
      const tid = id0 + i;
      w.after(wind + i * step, () => {
        const tg = w.telegraphs.find((t) => t.id === tid);
        if (!tg || !alive(w, e)) return;
        faceTo(e, a);
        breathFx(w, ox, oy - 4, a, len);
        if (i === 0) {
          w.sfx('beam', 0.8);
          w.sfx('freeze', 0.7);
          w.shake(3);
        }
        // one blow a sweep, however many slices the hero is caught in
        const p = w.player;
        if (!pt.data.hit && !p.dead && inCone(p.x, p.y, ox, oy, a, half + 0.01, len + p.r * 0.5)) {
          if (hurtPlayer(w, e.dmg * mul, { fromX: ox, fromY: oy, knock: 90, status: CHILL, source: e })) pt.data.hit = 1;
        }
        // the frost settles on the floor out along the breath
        if (k.num('ice', 1) > 0 && i % 3 === 1 && len > 70) {
          const d = 50 + w.rand() * (len - 60);
          addIce(w, e, ox + Math.cos(a) * d, oy + Math.sin(a) * d, 8, 26, 2.5, 12);
        }
      });
    }
    faceTo(e, a0 - (dir * arc) / 2);
    w.addFx({ kind: 'glow', x: e.x + Math.cos(a0) * e.r, y: e.y - 8, life: wind, size: 14, color: FROST });
    if (n === 0) w.text(e.x, e.y - e.r - 16, 'FROST BREATH!', '#c8f0ff', true);
    w.sfx('beamCharge', 0.8);
    pt.data.t1 = pt.t + wind + (beams - 1) * step;
    pt.data.n = n + 1;
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= pt.data.t1!) {
    if (pt.data.n! < k.num('sweeps', 1)) {
      // a breath, and it turns back the other way
      pt.data.t2 = pt.t + k.num('turn', 0.25);
      pt.step = 3;
    } else {
      pt.data.t2 = pt.t;
      pt.step = 2;
    }
  } else if (pt.step === 3 && pt.t >= pt.data.t2!) pt.step = 0;
  else if (pt.step === 2 && pt.t >= pt.data.t2! + 0.45) k.end();
};

/**
 * The wings beat: a gust over `arc` toward the hero (shown for `wind` s), then for `time` s it drives
 * whoever is in it away at `push` px a second (a pillar between shelters you). With `icicles`, the
 * roof shakes loose that many where the gust would carry you; with `then` 1, a breath follows.
 */
const gust: PatternFn = (w, e, dt, k) => {
  const { pt } = k;
  const p = w.player;
  const wind = k.num('wind', 0.9);
  const len = k.num('len', 220);
  const arc = k.num('arc', 0.75);
  if (pt.step === 0) {
    const a = k.aimAt();
    pt.data.a = a;
    w.addTelegraph({ shape: 'cone', x: e.x, y: e.y, r: len, r2: arc, angle: a, len: 0, dur: wind, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
    faceTo(e, a);
    w.text(e.x, e.y - e.r - 16, 'WINGS!', '#c8f0ff', true);
    w.sfx('whirl', 0.7);
    // where the wind will throw the hero: the roof shakes loose over it
    const n = k.num('icicles', 0);
    for (let i = 0; i < n; i++) {
      const d = 90 + (len - 90) * (i / Math.max(1, n - 1)) * 0.9 + w.rand() * 20;
      const aa = a + (w.rand() - 0.5) * arc * 1.2;
      const x = e.x + Math.cos(aa) * d;
      const y = e.y + Math.sin(aa) * d;
      if (onFloor(w, e, x, y, 4)) icicle(w, e, x, y, 18, wind + 0.6 + w.rand() * 0.8, k.num('icMul', 1), true);
    }
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= wind) {
    pt.data.t0 = pt.t;
    w.sfx('rush', 0.9);
    w.shake(3);
    pt.step = 2;
  } else if (pt.step === 2) {
    const a = pt.data.a!;
    // the gust itself: snow streaming out over the cone
    for (let i = 0; i < 3; i++) {
      const aa = a + (w.rand() - 0.5) * arc * 2;
      const d = e.r + w.rand() * len * 0.5;
      w.addFx({ kind: i ? 'shard' : 'smoke', x: e.x + Math.cos(aa) * d, y: e.y + Math.sin(aa) * d - 4, vx: Math.cos(aa) * 220, vy: Math.sin(aa) * 220, life: 0.45, size: i ? 1 : 3, color: i ? ICE : '#c8e0f0' });
    }
    if (Math.floor(pt.t * 2.5) !== Math.floor((pt.t - dt) * 2.5)) w.sfx('whirl', 0.4);
    if (!p.dead && !p.dash && inCone(p.x, p.y, e.x, e.y, a, arc, len) && lineOfSight(w.map, e.x, e.y, p.x, p.y)) {
      const pa = Math.atan2(p.y - e.y, p.x - e.x);
      const sp = k.num('push', 110) * dt;
      const m = moveCircle(w.map, p.x, p.y, p.r, Math.cos(pa) * sp, Math.sin(pa) * sp);
      p.x = m.x;
      p.y = m.y;
    }
    if (pt.t >= pt.data.t0! + k.num('time', 1.6)) {
      pt.data.t1 = pt.t;
      pt.step = 3;
    }
  } else if (pt.step === 3 && pt.t >= pt.data.t1! + 0.2) {
    const then = k.num('then', 0);
    if (then > 0) e.boss!.queue.unshift({ id: 'rime:breath', w: 1, cd: k.num('thenCd', 5), p: { arc: k.num('thenArc', 1.4), beams: 9, len: 220, wind: k.num('thenWind', 0.85), step: 0.075, mul: k.num('thenMul', 1.3) } });
    k.end();
  }
};

/** The roof gives way: `salvos` of `count` icicles (one on the hero), `gap` s apart, each `r` across. */
const icicles: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const salvos = k.num('salvos', 2);
  const gap = k.num('gap', 0.7);
  const fired = pt.data.f ?? 0;
  if (!pt.data.said) {
    pt.data.said = 1;
    w.text(e.x, e.y - e.r - 16, 'THE ROOF!', '#c8f0ff', true);
    w.sfx('roar', 0.6);
    w.shake(4);
    for (let i = 0; i < 10; i++) w.addFx({ kind: 'spark', x: e.x + (w.rand() - 0.5) * 200, y: e.y - 80 - w.rand() * 40, vx: 0, vy: 30, life: 0.8, size: 1, color: ICE });
  }
  if (fired < salvos && pt.t >= 0.25 + fired * gap) {
    const p = w.player;
    const r = k.num('r', 18);
    const dur = k.num('dur', 1.3);
    const mul = k.num('mul', 1.1);
    if (onFloor(w, e, p.x, p.y, 2)) icicle(w, e, p.x + p.vx * 0.3, p.y + p.vy * 0.3, r, dur, mul, true);
    for (let i = 1; i < k.num('count', 5); i++) {
      const at = i % 2 ? nearHero(w, e, 36, 110, 4) : anySpot(w, e, 4);
      if (at) icicle(w, e, at.x, at.y, r, dur + w.rand() * 0.3, mul, i % 2 === 0);
    }
    w.sfx('crumble', 0.5);
    pt.data.f = fired + 1;
  }
  if (pt.t >= 0.25 + (salvos - 1) * gap + 0.6) k.end();
};

/**
 * The wyrm breathes into the floor: `count` circles (one beside the hero) burst after `wind` s and
 * become ice that spreads (`grow` px a second up to `max`, for `life` s).
 */
const frost: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const wind = k.num('wind', 1);
  if (pt.step === 0) {
    const count = k.num('count', 4);
    const r = k.num('r', 20);
    w.addFx({ kind: 'glow', x: e.x, y: e.y - 8, life: 0.6, size: 16, color: FROST });
    for (let i = 0; i < count; i++) {
      const at = nearHero(w, e, i === 0 ? 24 : 40, i === 0 ? 40 : 120, 4);
      if (!at) continue;
      const id = w.nextId;
      w.addTelegraph({ shape: 'circle', x: at.x, y: at.y, r, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 0.9), status: CHILL, knock: 40, tone: 'enemy', owner: -1, linger: 0 });
      const tg = w.telegraphs.find((t) => t.id === id);
      w.addFx({ kind: 'zap', x: e.x, y: e.y - 10, x2: at.x, y2: at.y, life: 0.3, size: 1, color: FROST });
      w.after(wind, () => {
        if (!tg || tg.t < tg.dur - 0.05 || !alive(w, e)) return;
        for (let j = 0; j < 6; j++) {
          const a = (TAU * j) / 6;
          w.addFx({ kind: 'shard', x: at.x, y: at.y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 30 - 20, life: 0.4, size: 2, color: ICE });
        }
        addIce(w, e, at.x, at.y, 10, k.num('max', 38), k.num('grow', 4), k.num('life', 14));
      });
    }
    w.text(e.x, e.y - e.r - 16, 'THE RIME SPREADS!', '#c8f0ff', true);
    w.sfx('freeze', 0.8);
    pt.step = 1;
  } else if (pt.t >= wind + 0.3) k.end();
};

/** From here on the roof keeps falling: `count` icicles every `every` s (one on the hero), `r` across. */
const storm: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  if (pt.step === 0) {
    const s = fight(w, e);
    s.storm = { every: k.num('every', 2.6), count: k.num('count', 2), r: k.num('r', 18), mul: k.num('mul', 0.9), t: 1.5 };
    w.emit({ t: 'banner', text: 'The cavern is coming down', sub: 'Watch the roof' });
    w.sfx('quake');
    w.shake(6);
    pt.step = 1;
  } else if (pt.t >= 0.6) k.end();
};

/* ------------------------------------------------------------------ flight */

/** The wyrm's shadow on the floor, wings spread across the way it flies (`a`), `size` 1 as it soars, bigger as it dives. */
function shadowAt(w: World, x: number, y: number, a: number, size: number): void {
  const col = 'rgba(0,6,16,0.4)';
  const c = Math.cos(a);
  const s = Math.sin(a);
  const life = 0.05;
  const blob = (dx: number, dy: number, r: number): void => w.addFx({ kind: 'burst', x: x + (c * dx - s * dy) * size, y: y + (s * dx + c * dy) * size * 0.75, life, size: Math.max(2, Math.round(r * size)), color: col });
  // body, neck and head ahead, the tail behind, the wings swept back on either side
  blob(0, 0, 11);
  blob(9, 0, 6);
  blob(16, 0, 5);
  blob(-12, 0, 6);
  blob(-21, 1, 4);
  blob(-29, 3, 3);
  for (const side of [1, -1]) {
    blob(-2, side * 11, 8);
    blob(-6, side * 20, 7);
    blob(-11, side * 28, 5);
    blob(-16, side * 34, 3);
  }
}

/** The line through the hero along `a`, as far as the cavern's floor goes each way (columns don't stop it: it comes from above). */
function across(w: World, e: Enemy, x: number, y: number, a: number): { x0: number; y0: number; len: number } {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const open = (px: number, py: number): boolean => {
    const i = tileAt(w.map, px, py);
    return i >= 0 && (w.map.room[i] === e.room + 1 || w.map.kind[i] === K.Pillar);
  };
  let back = 0;
  while (back < 900 && open(x - c * (back + 4), y - s * (back + 4))) back += 4;
  let fwd = 0;
  while (fwd < 900 && open(x + c * (fwd + 4), y + s * (fwd + 4))) fwd += 4;
  return { x0: x - c * back, y0: y - s * back, len: Math.max(8, back + fwd) };
}

/**
 * It takes to the air: for `time` s it is out of reach (nothing touches it) and only its shadow shows,
 * circling the cavern. Meanwhile icicles fall (`icicles` every `icEvery` s, one on the hero), the rime
 * spreads (a patch near the hero every `seedEvery` s) and `strafes` times it dives low along a line
 * through the hero, breathing frost the length of the cavern (shown for `strafeWind` s, `strafeMul`)
 * and leaving ice along it. Then it dives onto the hero: a circle of `landR` (shown `land` s, `landMul`)
 * and a ring of ice splinters flying out from where it lands.
 */
const flight: PatternFn = (w, e, dt, k) => {
  const { pt } = k;
  const p = w.player;
  const time = k.num('time', 10);
  const takeoff = 0.8;
  const box = roomBox(w, e);
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  const rx = (box.x1 - box.x0) * 0.3;
  const ry = (box.y1 - box.y0) * 0.28;
  if (pt.step === 0) {
    w.text(e.x, e.y - e.r - 18, 'IT TAKES WING!', '#c8f0ff', true);
    w.sfx('roar');
    w.sfx('whirl');
    w.shake(6);
    for (let i = 0; i < 20; i++) {
      const a = (TAU * i) / 20;
      w.addFx({ kind: 'smoke', x: e.x + Math.cos(a) * 12, y: e.y + Math.sin(a) * 8, vx: Math.cos(a) * 110, vy: Math.sin(a) * 70, life: 0.7, size: 5, color: '#c8e0f0' });
    }
    if (!p.dead && dist(e.x, e.y, p.x, p.y) < 70) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      p.vx += Math.cos(a) * 200;
      p.vy += Math.sin(a) * 200;
    }
    pt.data.sx = e.x;
    pt.data.sy = e.y;
    pt.data.th = Math.atan2((e.y - cy) / ry, (e.x - cx) / rx);
    pt.data.ic = 1.2;
    pt.data.seed = 0.8;
    pt.data.strafe = 0;
    pt.data.wing = 0;
    pt.step = 1;
    return;
  }
  if (pt.step === 1) {
    // rising: still there to be seen, the wings beating up a storm of snow
    if (w.rand() < 0.5) w.addFx({ kind: 'smoke', x: e.x + (w.rand() - 0.5) * 40, y: e.y + 4, vx: (w.rand() - 0.5) * 80, vy: -10, life: 0.6, size: 4, color: '#c8e0f0' });
    if (pt.t >= takeoff) {
      pt.data.hide = 1;
      w.sfx('rush');
      w.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.5, size: 50, color: ICE });
      pt.step = 2;
    }
    return;
  }
  // in the air: the shadow moves toward where it is going
  const moveShadow = (tx: number, ty: number, speed: number): void => {
    const d = dist(pt.data.sx!, pt.data.sy!, tx, ty);
    const st = Math.min(d, speed * dt);
    if (d > 0.01) {
      pt.data.sa = Math.atan2(ty - pt.data.sy!, tx - pt.data.sx!);
      pt.data.sx! += ((tx - pt.data.sx!) / d) * st;
      pt.data.sy! += ((ty - pt.data.sy!) / d) * st;
    }
    // the boss is where its shadow is (the light follows it, it can't be hit)
    e.x = pt.data.sx!;
    e.y = pt.data.sy!;
    e.face = Math.cos(pt.data.sa ?? 0) < 0 ? Math.PI : 0;
  };
  if (pt.step === 2) {
    const flown = pt.t - takeoff;
    // strafing runs, spread over the flight
    const strafes = k.num('strafes', 2);
    const due = pt.data.strafe! < strafes && flown >= (time * (pt.data.strafe! + 0.7)) / (strafes + 1);
    const sw = k.num('strafeWind', 1.2);
    if (due && !pt.data.sOn) {
      // line it up through the hero, across the whole cavern
      const a = Math.atan2(p.y - pt.data.sy!, p.x - pt.data.sx!) + (w.rand() - 0.5) * 0.3;
      const l = across(w, e, p.x, p.y, a);
      w.addTelegraph({ shape: 'line', x: l.x0, y: l.y0, r: 0, r2: k.num('strafeW', 26), angle: a, len: l.len, dur: sw, dmg: e.dmg * k.num('strafeMul', 1.25), status: CHILL, knock: 80, tone: 'enemy', owner: -1, linger: 0.15 });
      pt.data.sOn = 1;
      pt.data.sT = pt.t;
      pt.data.la = a;
      pt.data.lx = l.x0;
      pt.data.ly = l.y0;
      pt.data.ll = l.len;
      w.text(p.x, p.y - 30, 'FROM ABOVE!', '#c8f0ff', true);
      w.sfx('beamCharge', 0.8);
    }
    if (pt.data.sOn) {
      const a = pt.data.la!;
      const since = pt.t - pt.data.sT!;
      if (since < sw) moveShadow(pt.data.lx! - Math.cos(a) * 30, pt.data.ly! - Math.sin(a) * 30, 300);
      else {
        if (!pt.data.sFired) {
          pt.data.sFired = 1;
          breathFx(w, pt.data.lx!, pt.data.ly!, a, pt.data.ll!);
          w.sfx('beam', 0.9);
          w.sfx('freeze', 0.7);
          w.shake(4);
          // the frost settles along the run
          for (let d = 30 + w.rand() * 20; d < pt.data.ll! - 10; d += 56) addIce(w, e, pt.data.lx! + Math.cos(a) * d, pt.data.ly! + Math.sin(a) * d, 8, 24, 2.5, 13);
        }
        moveShadow(pt.data.lx! + Math.cos(a) * (pt.data.ll! + 30), pt.data.ly! + Math.sin(a) * (pt.data.ll! + 30), 700);
        if (since >= sw + 0.6) {
          pt.data.sOn = 0;
          pt.data.sFired = 0;
          pt.data.strafe! += 1;
          pt.data.th = Math.atan2((pt.data.sy! - cy) / ry, (pt.data.sx! - cx) / rx);
        }
      }
    } else {
      // circling the cavern
      pt.data.th! += dt * 0.9;
      moveShadow(cx + Math.cos(pt.data.th!) * rx, cy + Math.sin(pt.data.th!) * ry, 220);
    }
    // icicles shaken loose by its wings, and the rime creeping over the floor
    pt.data.ic! -= dt;
    if (pt.data.ic! <= 0) {
      pt.data.ic = k.num('icEvery', 1.3);
      const n = k.num('icicles', 3);
      if (onFloor(w, e, p.x, p.y, 2)) icicle(w, e, p.x + p.vx * 0.35, p.y + p.vy * 0.35, 17, 1.3, k.num('icMul', 0.85), false);
      for (let i = 1; i < n; i++) {
        const at = i % 2 ? nearHero(w, e, 40, 130, 4) : anySpot(w, e, 4);
        if (at) icicle(w, e, at.x, at.y, 17, 1.2 + w.rand() * 0.4, k.num('icMul', 0.85), i % 2 === 0);
      }
    }
    pt.data.seed! -= dt;
    if (pt.data.seed! <= 0) {
      pt.data.seed = k.num('seedEvery', 1.8);
      const at = nearHero(w, e, 40, 100, 4);
      if (at) {
        const id = w.nextId;
        w.addTelegraph({ shape: 'circle', x: at.x, y: at.y, r: 16, r2: 0, angle: 0, len: 0, dur: 0.9, dmg: e.dmg * 0.6, status: CHILL, knock: 30, tone: 'enemy', owner: -1, linger: 0 });
        const tg = w.telegraphs.find((t) => t.id === id);
        w.after(0.9, () => {
          if (!tg || tg.t < tg.dur - 0.05 || !alive(w, e)) return;
          w.sfx('freeze', 0.4);
          addIce(w, e, at.x, at.y, 9, 34, 3.5, 15);
        });
      }
    }
    // the wings overhead, the snow they shake down
    pt.data.wing! -= dt;
    if (pt.data.wing! <= 0) {
      pt.data.wing = 0.7;
      w.sfx('whirl', 0.35);
    }
    if (w.rand() < 0.4) w.addFx({ kind: 'spark', x: pt.data.sx! + (w.rand() - 0.5) * 120, y: pt.data.sy! - 60 - w.rand() * 30, vx: (w.rand() - 0.5) * 20, vy: 10, life: 0.9, size: 1, color: ICE });
    shadowAt(w, pt.data.sx!, pt.data.sy!, pt.data.sa ?? 0, 1);
    if (flown >= time && !pt.data.sOn) {
      // the dive: onto the hero
      const land = k.num('land', 1.4);
      const r = k.num('landR', 46);
      const spot = pushOut(w.map, p.x, p.y, e.r, e.room) ?? { x: p.x, y: p.y };
      pt.data.dx = spot.x;
      pt.data.dy = spot.y;
      w.addTelegraph({ shape: 'circle', x: spot.x, y: spot.y, r, r2: 0, angle: 0, len: 0, dur: land, dmg: e.dmg * k.num('landMul', 1.8), status: CHILL, knock: 220, tone: 'enemy', owner: -1, linger: 0 });
      w.text(spot.x, spot.y - 34, 'IT DIVES!', '#c8f0ff', true);
      w.sfx('beamCharge');
      pt.data.dT = pt.t;
      pt.data.dS = dist(pt.data.sx!, pt.data.sy!, spot.x, spot.y) / Math.max(0.2, land * 0.8);
      pt.step = 3;
    }
    return;
  }
  if (pt.step === 3) {
    const land = k.num('land', 1.4);
    const u = Math.min(1, (pt.t - pt.data.dT!) / land);
    moveShadow(pt.data.dx!, pt.data.dy!, Math.max(120, pt.data.dS!));
    shadowAt(w, pt.data.sx!, pt.data.sy!, pt.data.sa ?? 0, 1 + u * 0.5);
    if (u >= 1) {
      e.x = pt.data.dx!;
      e.y = pt.data.dy!;
      pt.data.hide = 0;
      w.sfx('slam');
      w.sfx('quake');
      w.sfx('roar', 0.7);
      w.shake(8);
      w.fxBurst(e.x, e.y, ICE, 30, 40);
      w.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.6, size: 70, color: ICE });
      for (let i = 0; i < 16; i++) {
        const a = (TAU * i) / 16;
        w.addFx({ kind: 'smoke', x: e.x + Math.cos(a) * 14, y: e.y + Math.sin(a) * 10, vx: Math.cos(a) * 130, vy: Math.sin(a) * 80, life: 0.7, size: 5, color: '#c8e0f0' });
      }
      // splinters of the floor fly out from where it lands
      const n = k.num('shards', 8);
      const a0 = w.rand() * TAU;
      for (let i = 0; i < n; i++) {
        const a = a0 + (TAU * i) / n;
        w.spawnProjectile({ x: e.x + Math.cos(a) * (e.r + 4), y: e.y - 4 + Math.sin(a) * (e.r + 4), vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, r: 3.5, life: 220, dmg: e.dmg * k.num('shardMul', 0.6), type: 'frost', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'orb', color: '#c8ecff', hostile: true, homing: 0, child: false, knock: 0, status: CHILL });
      }
      pt.data.t9 = pt.t;
      pt.step = 4;
    }
    return;
  }
  if (pt.step === 4 && pt.t >= pt.data.t9! + 0.8) k.end();
};

export const RIMEHELD_VAULT_PATTERNS: Record<string, PatternFn> = {
  'rime:shatter': shatter,
  'rime:boulder': boulder,
  'rime:warcry': warcry,
  'rime:breath': breath,
  'rime:gust': gust,
  'rime:icicles': icicles,
  'rime:frost': frost,
  'rime:storm': storm,
  'rime:flight': flight,
};
