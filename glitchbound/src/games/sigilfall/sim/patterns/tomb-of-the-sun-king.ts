import { dist, inCone, inLine, TAU } from '../../core/math';
import { hurtPlayer } from '../combat';
import { circleHitsWall, K, moveCircle, TILE, tileAt } from '../map';
import type { Enemy, Field, Telegraph } from '../types';
import type { World } from '../world';
import type { PatternFn } from './kit';

/**
 * Boss attacks of the Tomb of the Sun King: ids start with 'tomb:'.
 *
 * The Sand Warden, the tomb's guardian of stone and sand: a wall of sand that sweeps across its hall
 * with one gap to stand in (`sandsweep`), pits of quicksand that open under the hero and drag them in
 * (`quicksand`), and its fall into a heap of sand that rises again as wraiths (`crumble`): the heap
 * can't be hurt, and each wraith still walking when it reforms flows back into it as health.
 *
 * The Sun King fights with light, and pillars cast shadows. His sun disc (`sun-disc`) rises over the
 * burial chamber and blazes: everything it can see burns, and the only shelter is the shadow behind a
 * pillar; later it crosses the chamber like the sun the sky, flaring again from each new place. The
 * danger is drawn as a fan of light from the disc that stops at every pillar, so the shadows are the
 * gaps in it. His sunbeams (`sunbeam`) sweep an arc of the room the same way, stopped by the pillars;
 * scarab swarms break out of the floor by the walls (`scarabs`); and at the last his burial chamber
 * burns, rings of fire closing in from the walls (`pyre`).
 *
 * The lasting parts (the disc crossing the room, the pits, the heap, the fire) outlive the pattern
 * that made them, so each boss keeps them here and a small ticker (World.after, once a step) runs them
 * for as long as the fight lasts; a defeat or a reset of the room takes them away.
 */

const SAND = ['#d8b878', '#c8a060', '#e8d0a0', '#a88850'];
const SUN = '#ffd86b';
const SUNCORE = '#fff4c0';
/** How high over its spot the sun disc hangs (its light falls from there). */
const SUN_HIGH = 34;
const burn = (e: Enemy, dur = 2.5): { status: 'burn'; dur: number; power: number } => ({ status: 'burn', dur, power: Math.max(2, Math.round(e.dmg * 0.08)) });
const faceTo = (e: Enemy, a: number): void => {
  e.face = Math.cos(a) < 0 ? Math.PI : 0;
};

/** The fight goes on: the boss stands, isn't falling, and no respawn has reset its room (and, if given, it is still in that phase). */
function fighting(w: World, e: Enemy, phase?: number): boolean {
  const b = e.boss;
  return !!b && !e.dead && b.dying <= 0 && w.enemies.includes(e) && (phase === undefined || b.phase === phase);
}

/** The boss room's bounds in pixels (worked out once per fight). */
function roomBox(w: World, e: Enemy): { x0: number; y0: number; x1: number; y1: number } {
  const m = e.boss!.misc;
  if (m.tbx1 === undefined) {
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
    m.tbx0 = x0 * TILE;
    m.tby0 = y0 * TILE;
    m.tbx1 = (x1 + 1) * TILE;
    m.tby1 = (y1 + 1) * TILE;
  }
  return { x0: m.tbx0!, y0: m.tby0!, x1: m.tbx1, y1: m.tby1! };
}

/** A spot on the boss room's floor with room for a circle of radius r. */
function onFloor(w: World, e: Enemy, x: number, y: number, r: number): boolean {
  const i = tileAt(w.map, x, y);
  return i >= 0 && w.map.room[i] === e.room + 1 && !circleHitsWall(w.map, x, y, r);
}

/** Whether a hero at (x, y) is inside a telegraph's shape (as World's own test does it). */
function within(t: Pick<Telegraph, 'shape' | 'x' | 'y' | 'r' | 'r2' | 'angle' | 'len'>, x: number, y: number, r: number): boolean {
  if (t.shape === 'cone') return inCone(x, y, t.x, t.y, t.angle, t.r2, t.r + r * 0.5);
  if (t.shape === 'line') return inLine(x, y, r * 0.5, t.x, t.y, t.angle, t.len, t.r2);
  return dist(x, y, t.x, t.y) <= t.r + r * 0.5;
}

/* ------------------------------------------------------------------ light and shadow */

/** Rays from a light: 720 of them all round (half a degree each). */
const RAYS = 720;
const RAY_STEP = TAU / RAYS;
/** How far a ray of light reaches before it gives up (the chamber is smaller than this). */
const RAY_MAX = 520;

interface Ray {
  /** Distance to the first thing that stops the light. */
  d: number;
  /** The pillar tile that stopped it, or -1 for a wall. */
  pillar: number;
}

/** Casts one ray of light from (x, y): only walls, closed doors and pillars stop it (braziers and grave goods don't). */
function ray(w: World, x: number, y: number, a: number, max = RAY_MAX): Ray {
  const c = Math.cos(a);
  const s = Math.sin(a);
  for (let d = 1; d < max; d += 1.5) {
    const i = tileAt(w.map, x + c * d, y + s * d);
    if (i < 0) return { d, pillar: -1 };
    if (w.map.block[i]) return { d, pillar: w.map.kind[i] === K.Pillar ? i : -1 };
  }
  return { d: max, pillar: -1 };
}

/** A shape of light on the floor (a telegraph's geometry). */
type Shape = Pick<Telegraph, 'shape' | 'x' | 'y' | 'r' | 'r2' | 'angle' | 'len'>;

/**
 * What a light at (x, y) sees between angles `from` and `to` (a whole circle by default), as cones
 * from the light: open floor out to the walls, and the floor in front of each pillar up to the stone.
 * What they leave uncovered is the shadow behind the pillars. Open floor is cut every `piece` radians
 * so it hugs the walls. Radii come in steps of 16 px (the renderer lights every telegraph and keeps a
 * glow for each size): rounded up for open floor, down in front of a pillar, so a cone never reaches
 * into a shadow.
 */
function lightShapes(w: World, x: number, y: number, from = 0, to = TAU, piece = 0.42): Shape[] {
  const n = Math.max(1, Math.round((to - from) / RAY_STEP));
  const step = (to - from) / n;
  const rays: Ray[] = [];
  for (let i = 0; i < n; i++) rays.push(ray(w, x, y, from + (i + 0.5) * step));
  // a whole circle starts at a change between light and shadow, so no run wraps round its end
  let start = 0;
  if (to - from >= TAU - 1e-6) start = Math.max(0, rays.findIndex((r, i) => r.pillar !== rays[(i + n - 1) % n]!.pillar));
  const at = (i: number): Ray => rays[(start + i) % n]!;
  // how far each ray's cone reaches
  const reach = (r: Ray): number => (r.pillar < 0 ? Math.ceil((r.d + 4) / 16) * 16 : Math.max(16, Math.floor(r.d / 16) * 16));
  const wallRun = Math.max(1, Math.round(piece / step));
  const out: Shape[] = [];
  for (let i = 0; i < n; ) {
    const what = at(i).pillar;
    let len = 1;
    let far = reach(at(i));
    if (what < 0) {
      // open floor: out to the farthest wall in the piece
      while (i + len < n && len < wallRun && at(i + len).pillar < 0) far = Math.max(far, reach(at(i + len++)));
    } else {
      // in front of a pillar: rays that stop at the same distance share a cone
      while (i + len < n && at(i + len).pillar >= 0 && reach(at(i + len)) === far) len++;
    }
    const half = (len * step) / 2;
    out.push({ shape: 'cone', x, y, r: far, r2: half, angle: from + ((start + i) % n) * step + half, len: 0 });
    i += len;
  }
  return out;
}

/** Adds the light shapes as telegraphs; returns them. */
function addLight(w: World, x: number, y: number, o: { from?: number; to?: number; piece?: number; dur: number; linger: number }): Telegraph[] {
  const id0 = w.nextId;
  for (const s of lightShapes(w, x, y, o.from, o.to, o.piece)) w.addTelegraph({ ...s, dur: o.dur, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: o.linger });
  return w.telegraphs.filter((t) => t.id >= id0);
}

/** A spot for the sun: on the floor and clear of the pillars (a light inside one would shade everything). */
function sunSpot(w: World, e: Enemy, x: number, y: number): { x: number; y: number } {
  const b = e.boss!;
  for (let k = 0; k <= 10; k++) {
    const px = x + (b.cx - x) * (k / 10);
    const py = y + (b.cy - y) * (k / 10);
    if (onFloor(w, e, px, py, 18)) return { x: px, y: py };
  }
  return { x: b.cx, y: b.cy };
}

/* ------------------------------------------------------------------ the lasting state */

interface Sun {
  x: number;
  y: number;
  /** Flares still to come after this one. */
  left: number;
  phase: number;
  /** 'wind': the light spreading from the disc; 'blaze': it burns; 'move': on its way to its next place. */
  state: 'wind' | 'blaze' | 'move';
  t: number;
  wind: number;
  wind2: number;
  blaze: number;
  mul: number;
  tels: Telegraph[];
  hit: boolean;
  /** The way it crosses the chamber: the angle round the middle, and the step between flares. */
  a: number;
  step: number;
  orbit: number;
  /** Where it moves to next, and from where. */
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  said: number;
  glowT: number;
}
interface Heap {
  until: number;
  wraiths: number[];
  heal: number;
  daze: number;
  sprite: string;
}
interface Pit {
  f: Field;
  pull: number;
}
interface Pyre {
  rings: number;
  every: number;
  wind: number;
  mul: number;
  next: number;
  n: number;
  r: number;
  fields: Field[];
}
interface Fight {
  last: number;
  sun: Sun | null;
  heap: Heap | null;
  pits: Pit[];
  pyre: Pyre | null;
  swirlT: number;
}

const FIGHTS = new WeakMap<Enemy, Fight>();

/** The boss's lasting state, starting its ticker the first time. */
function fight(w: World, e: Enemy): Fight {
  let s = FIGHTS.get(e);
  if (!s) {
    s = { last: w.time, sun: null, heap: null, pits: [], pyre: null, swirlT: 0 };
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
    // won, or the room reset after a defeat: what the fight left behind goes with it
    const mine = new Set<Field>([...s.pits.map((p) => p.f), ...(s.pyre?.fields ?? [])]);
    w.fields = w.fields.filter((f) => !mine.has(f));
    if (s.sun) {
      const tels = new Set(s.sun.tels);
      w.telegraphs = w.telegraphs.filter((t) => !tels.has(t));
    }
    if (s.heap && !e.dead && e.boss) e.def.sprite = s.heap.sprite;
    FIGHTS.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  tickSun(w, e, s, dt);
  tickHeap(w, e, s);
  tickPits(w, s, dt);
  tickPyre(w, e, s);
  w.after(0, () => tick(w, e));
}

/* ------------------------------------------------------------------ the sun disc */

/** The disc itself: a burning disc in the air over its spot, and its light falling on the floor. */
function drawSun(w: World, sun: Sun, dt: number): void {
  sun.glowT -= dt;
  if (sun.glowT > 0) return;
  sun.glowT = 0.09;
  const hot = sun.state === 'blaze';
  const y = sun.y - SUN_HIGH;
  w.addFx({ kind: 'glow', x: sun.x, y, life: 0.3, size: hot ? 28 : 22, color: '#ff9a3d' });
  w.addFx({ kind: 'glow', x: sun.x, y, life: 0.3, size: hot ? 16 : 12, color: SUN });
  w.addFx({ kind: 'burst', x: sun.x, y, life: 0.2, size: hot ? 8 : 6, color: SUNCORE });
  // its light on the floor below, and sparks thrown off its rim
  w.addFx({ kind: 'glow', x: sun.x, y: sun.y, life: 0.3, size: 12, color: SUN });
  const a = w.rand() * TAU;
  w.addFx({ kind: 'spark', x: sun.x + Math.cos(a) * 12, y: y + Math.sin(a) * 10, vx: Math.cos(a) * 24, vy: Math.sin(a) * 18, life: 0.5, size: 1, color: w.rand() < 0.5 ? SUN : SUNCORE });
}

/** The disc lights its fan: the warning for this flare. */
function raiseLight(w: World, sun: Sun, dur: number): void {
  // the shapes outlast the blaze a little: the sun takes them away itself when it is over
  sun.tels = addLight(w, sun.x, sun.y, { dur, linger: sun.blaze + 1, piece: 0.8 });
  sun.state = 'wind';
  sun.t = 0;
  sun.hit = false;
  sun.said = 99;
  w.addFx({ kind: 'beam', x: sun.x, y: sun.y, life: 0.5, size: 10, color: SUN });
  w.addFx({ kind: 'ring', x: sun.x, y: sun.y, life: 0.6, size: 40, color: SUN });
  w.sfx('beamCharge', 0.8);
}

function tickSun(w: World, e: Enemy, s: Fight, dt: number): void {
  const sun = s.sun;
  if (!sun) return;
  const p = w.player;
  // a phase change clears the light: this sun has set
  if (e.boss!.phase !== sun.phase || (sun.state !== 'move' && sun.tels.length && !w.telegraphs.includes(sun.tels[0]!))) {
    s.sun = null;
    return;
  }
  sun.t += dt;
  drawSun(w, sun, dt);
  if (sun.state === 'wind') {
    const dur = sun.tels[0]?.dur ?? sun.wind;
    const left = Math.ceil(dur - sun.t);
    if (left !== sun.said && left <= 3 && left > 0) {
      sun.said = left;
      w.text(sun.x, sun.y - SUN_HIGH - 20, String(left), SUN, true);
    }
    if (sun.t >= dur) {
      sun.state = 'blaze';
      sun.t = 0;
      w.sfx('beam');
      w.sfx('fireball', 0.6);
      w.shake(4);
      w.addFx({ kind: 'ring', x: sun.x, y: sun.y, life: 0.6, size: 120, color: SUNCORE });
    }
  } else if (sun.state === 'blaze') {
    // everything the light touches burns: once a flare, the moment it is touched (a dodge's
    // instant passes; the blaze outlasts it)
    if (!sun.hit && !p.dead && sun.tels.some((t) => within(t, p.x, p.y, p.r))) {
      if (hurtPlayer(w, e.dmg * sun.mul, { status: burn(e, 2) })) {
        sun.hit = true;
        w.text(p.x, p.y - 26, 'SUNBURNT!', '#ffb04d', true);
      }
    }
    // heat shimmer over the lit floor
    for (let k = 0; k < 3; k++) {
      const t = sun.tels[Math.floor(w.rand() * sun.tels.length)];
      if (!t) break;
      const a = t.angle + (w.rand() - 0.5) * 2 * t.r2;
      const r = t.r * Math.sqrt(w.rand());
      const x = t.x + Math.cos(a) * r;
      const y = t.y + Math.sin(a) * r;
      if (onFloor(w, e, x, y, 1)) w.addFx({ kind: 'spark', x, y, vx: 0, vy: -24 - w.rand() * 20, life: 0.5, size: 1, color: w.rand() < 0.5 ? SUN : '#ff9a3d' });
    }
    if (sun.t >= sun.blaze) {
      w.telegraphs = w.telegraphs.filter((t) => !sun.tels.includes(t));
      sun.tels = [];
      if (sun.left <= 0) {
        s.sun = null;
        w.addFx({ kind: 'ring', x: sun.x, y: sun.y - SUN_HIGH, life: 0.5, size: 30, color: SUN });
        return;
      }
      // on to the next place in the sky
      sun.left -= 1;
      sun.a += sun.step;
      const b = e.boss!;
      const to = sunSpot(w, e, b.cx + Math.cos(sun.a) * sun.orbit, b.cy + Math.sin(sun.a) * sun.orbit * 0.62);
      sun.fx = sun.x;
      sun.fy = sun.y;
      sun.tx = to.x;
      sun.ty = to.y;
      sun.state = 'move';
      sun.t = 0;
    }
  } else {
    // the disc glides to its next place, then lights the floor from there
    const k = Math.min(1, sun.t / 0.5);
    sun.x = sun.fx + (sun.tx - sun.fx) * k;
    sun.y = sun.fy + (sun.ty - sun.fy) * k;
    if (k >= 1) raiseLight(w, sun, sun.wind2);
  }
}

/**
 * The sun disc rises (over the king with `at` 'king', or on its way round the chamber with 'arc') and,
 * after `wind` s, blazes for `blaze` s: whoever stands in its light is burnt once (`mul`), and only the
 * shadows behind the pillars are safe. With `flares` > 1 it moves on round the chamber (`step` radians
 * at a time, `orbit` px from the middle) and flares again after `wind2` s from each new place. With
 * `hold` the king stands holding it up until the last flare; otherwise he fights on beneath it.
 */
const sunDisc: PatternFn = (w, e, _dt, k) => {
  const pt = k.pt;
  const s = fight(w, e);
  if (pt.step === 0) {
    // one sun at a time
    if (s.sun) {
      k.end();
      return;
    }
    const b = e.boss!;
    const orbit = k.num('orbit', 92);
    let a = Math.atan2(e.y - b.cy, e.x - b.cx);
    let at = { x: e.x, y: e.y };
    if (k.str('at', 'king') !== 'king') {
      // it rises on the far side of the chamber from the hero
      a = Math.atan2(b.cy - w.player.y, b.cx - w.player.x);
      at = { x: b.cx + Math.cos(a) * orbit, y: b.cy + Math.sin(a) * orbit * 0.62 };
    }
    at = sunSpot(w, e, at.x, at.y);
    const sun: Sun = {
      x: at.x,
      y: at.y,
      left: k.num('flares', 1) - 1,
      phase: b.phase,
      state: 'wind',
      t: 0,
      wind: k.num('wind', 3),
      wind2: k.num('wind2', 2.2),
      blaze: k.num('blaze', 1),
      mul: k.num('mul', 2),
      tels: [],
      hit: false,
      a,
      step: k.num('step', 1.3) * (w.rand() < 0.5 ? 1 : -1),
      orbit,
      fx: 0,
      fy: 0,
      tx: 0,
      ty: 0,
      said: 99,
      glowT: 0,
    };
    s.sun = sun;
    raiseLight(w, sun, sun.wind);
    faceTo(e, k.aimAt());
    w.text(e.x, e.y - e.r - 18, 'THE SUN RISES!', SUN, true);
    w.text(w.player.x, w.player.y - 30, 'Hide in a pillar’s shadow!', SUNCORE, true);
    w.addFx({ kind: 'zap', x: e.x, y: e.y - 16, x2: sun.x, y2: sun.y - SUN_HIGH, life: 0.4, size: 1, color: SUN });
    w.sfx('summon', 0.6);
    pt.step = 1;
  } else if (k.num('hold', 0) > 0) {
    // he holds it up until it has burnt out
    if (!s.sun || pt.t > 30) k.end();
  } else if (pt.t >= 0.8) k.end();
};

/* ------------------------------------------------------------------ the sunbeams */

/**
 * Sunlight gathered in the king's staff: `beams` beams (spread evenly round him) each sweep an arc of
 * `sweep` radians in `time` s, after `wind` s showing the arc they will cover. Pillars stop them, and
 * the arc is drawn the same way: the shadows behind the pillars are left out. Caught: `mul`.
 */
const sunbeam: PatternFn = (w, e, _dt, k) => {
  const pt = k.pt;
  const p = w.player;
  const beams = k.num('beams', 1);
  const sweep = k.num('sweep', 1.6);
  const time = k.num('time', 1.4);
  const wind = k.num('wind', 0.9);
  const width = k.num('width', 14);
  if (pt.step === 0) {
    const dir = w.rand() < 0.5 ? 1 : -1;
    const mid = k.aimAt();
    pt.data.dir = dir;
    pt.data.a0 = mid - (dir * sweep) / 2;
    pt.data.x = e.x;
    pt.data.y = e.y;
    for (let i = 0; i < beams; i++) {
      const c = mid + (i * TAU) / beams;
      // one cone for each stretch of open floor in the arc, so it reads as one sweep
      addLight(w, e.x, e.y, { from: c - sweep / 2 - 0.05, to: c + sweep / 2 + 0.05, piece: sweep + 0.2, dur: wind, linger: time });
    }
    faceTo(e, mid);
    w.addFx({ kind: 'glow', x: e.x, y: e.y - 18, life: wind, size: 14, color: SUN });
    w.sfx('beamCharge', 0.7);
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= wind) {
    pt.step = 2;
    w.sfx('beam', 0.8);
  } else if (pt.step === 2) {
    const u = Math.min(1, (pt.t - wind) / time);
    const ox = pt.data.x!;
    const oy = pt.data.y!;
    for (let i = 0; i < beams; i++) {
      const a = pt.data.a0! + pt.data.dir! * sweep * u + (i * TAU) / beams;
      const len = ray(w, ox, oy, a).d;
      w.addTelegraph({ shape: 'line', x: ox, y: oy, r: 0, r2: width, angle: a, len, dur: 0.001, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0.06 });
      const d = w.rand() * len;
      w.addFx({ kind: 'spark', x: ox + Math.cos(a) * d, y: oy + Math.sin(a) * d, vx: (w.rand() - 0.5) * 30, vy: -30, life: 0.4, size: 1, color: w.rand() < 0.5 ? SUN : SUNCORE });
      // once a sweep, however many beams
      if (!p.dead && !pt.data.hit && inLine(p.x, p.y, p.r * 0.5, ox, oy, a, len, width) && hurtPlayer(w, e.dmg * k.num('mul', 1.3), { fromX: ox, fromY: oy, knock: 90, status: burn(e), source: e })) pt.data.hit = 1;
    }
    w.addFx({ kind: 'glow', x: ox, y: oy - 18, life: 0.12, size: 12, color: SUNCORE });
    if (u >= 1) {
      pt.step = 3;
      pt.data.t1 = pt.t;
    }
  } else if (pt.step === 3 && pt.t >= pt.data.t1! + 0.4) k.end();
};

/* ------------------------------------------------------------------ scarabs */

/** Room floor tiles by the walls (worked out once per fight). */
function edgeTiles(w: World, e: Enemy): number[] {
  const m = w.map;
  const out: number[] = [];
  for (const i of m.roomTiles[e.room] ?? []) {
    if (m.solid[i]) continue;
    const x = i % m.w;
    const near = [i - 1, i + 1, i - m.w, i + m.w, i - m.w - 1, i - m.w + 1, i + m.w - 1, i + m.w + 1];
    if (x > 0 && near.some((j) => m.kind[j] === K.Wall)) out.push(i);
  }
  return out;
}

/**
 * Scarab swarms break out of the floor by the walls: `count` cracks (shown for `wind` s, hurting
 * whoever stands on them) and from each a swarm of `enemy`; never more than six of his creatures at once.
 */
const scarabs: PatternFn = (w, e, _dt, k) => {
  const pt = k.pt;
  const wind = k.num('wind', 1.1);
  if (pt.step === 0) {
    const adds = w.enemies.filter((x) => !x.dead && !x.boss && x.room === e.room).length;
    const n = Math.min(k.num('count', 2), 6 - adds);
    const tiles = edgeTiles(w, e);
    const p = w.player;
    const enemy = k.str('enemy', 'scarab-swarm');
    const used: { x: number; y: number }[] = [];
    for (let j = 0; j < n && tiles.length; j++) {
      for (let tries = 0; tries < 20; tries++) {
        const i = tiles[Math.floor(w.rand() * tiles.length)]!;
        const x = ((i % w.map.w) + 0.5) * TILE;
        const y = (Math.floor(i / w.map.w) + 0.5) * TILE;
        const d = dist(x, y, p.x, p.y);
        if (d < 64 || d > 240 || used.some((u) => dist(u.x, u.y, x, y) < 48)) continue;
        used.push({ x, y });
        w.addTelegraph({ shape: 'circle', x, y, r: 16, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * 0.7, knock: 80, tone: 'enemy', owner: -1, linger: 0 });
        w.after(wind, () => {
          if (!fighting(w, e)) return;
          w.spawnAdd(enemy, x, y, e.room);
          for (let q = 0; q < 8; q++) w.addFx({ kind: 'rubble', x, y: y - 2, vx: (w.rand() - 0.5) * 90, vy: -40 - w.rand() * 50, life: 0.5, size: 2, color: SAND[q % 4]! });
          w.sfx('crumble', 0.5);
        });
        break;
      }
    }
    if (used.length) w.text(e.x, e.y - e.r - 16, 'SCARABS!', '#7ae0c8', true);
    w.sfx('summon', 0.5);
    pt.step = 1;
  } else if (pt.t >= Math.min(wind, 0.9)) k.end();
};

/* ------------------------------------------------------------------ the burning chamber */

/** Floor tiles of the boss room by their distance (in tiles) from its outer walls (pillars don't count). */
function wallDepth(w: World, e: Enemy): Map<number, number> {
  const m = w.map;
  const tiles = m.roomTiles[e.room] ?? [];
  const inRoom = new Set(tiles);
  const depth = new Map<number, number>();
  let front: number[] = [];
  for (const i of tiles) {
    const near = [i - 1, i + 1, i - m.w, i + m.w];
    if (near.some((j) => !inRoom.has(j) && m.kind[j] !== K.Pillar)) {
      depth.set(i, 1);
      front.push(i);
    }
  }
  for (let d = 2; front.length; d++) {
    const next: number[] = [];
    for (const i of front)
      for (const j of [i - 1, i + 1, i - m.w, i + m.w]) {
        if (!inRoom.has(j) || depth.has(j)) continue;
        depth.set(j, d);
        next.push(j);
      }
    front = next;
  }
  return depth;
}

/** Ring `n` of the pyre: fires placed so that their circles cover every tile `2n+1` or `2n+2` tiles in from the walls. */
function pyreRing(w: World, e: Enemy, n: number, r: number): { x: number; y: number }[] {
  const depth = wallDepth(w, e);
  const b = e.boss!;
  const band = [...depth.entries()].filter(([, d]) => d === 2 * n + 1 || d === 2 * n + 2).map(([i]) => i);
  const centre = (i: number): { x: number; y: number } => ({ x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE });
  // walk the band round the middle of the room, outer tiles first, a fire every so often
  const outer = band.filter((i) => depth.get(i) === 2 * n + 1).map(centre);
  outer.sort((p, q) => Math.atan2(p.y - b.cy, p.x - b.cx) - Math.atan2(q.y - b.cy, q.x - b.cx));
  const fires: { x: number; y: number }[] = [];
  const reach = r + 1;
  const covered = (x: number, y: number): boolean => fires.some((f) => dist(f.x, f.y, x, y) <= reach);
  for (const o of outer) {
    // half a tile in toward the middle: the fire sits on the band's centre line
    const a = Math.atan2(b.cy - o.y, b.cx - o.x);
    const x = o.x + Math.cos(a) * 8;
    const y = o.y + Math.sin(a) * 8;
    if (!fires.some((f) => dist(f.x, f.y, x, y) < r * 1.15)) fires.push({ x, y });
  }
  // anything the walk left uncovered (corners) gets its own fire
  for (const i of band) {
    const c = centre(i);
    const pts = [c, { x: c.x - 7, y: c.y - 7 }, { x: c.x + 7, y: c.y - 7 }, { x: c.x - 7, y: c.y + 7 }, { x: c.x + 7, y: c.y + 7 }];
    if (pts.some((q) => !covered(q.x, q.y))) fires.push(c);
  }
  return fires;
}

function tickPyre(w: World, e: Enemy, s: Fight): void {
  const py = s.pyre;
  if (!py || py.n >= py.rings || w.time < py.next) return;
  const n = py.n;
  py.n += 1;
  py.next = w.time + py.every;
  const fires = pyreRing(w, e, n, py.r);
  const phase = e.boss!.phase;
  for (const f of fires) w.addTelegraph({ shape: 'circle', x: f.x, y: f.y, r: py.r, r2: 0, angle: 0, len: 0, dur: py.wind, dmg: e.dmg * py.mul, status: burn(e), knock: 60, tone: 'enemy', owner: -1, linger: 0 });
  w.text(w.player.x, w.player.y - 30, n === 0 ? 'The chamber burns!' : 'The fire closes in!', '#ff9a3d', true);
  w.sfx('beamCharge', 0.6);
  w.after(py.wind, () => {
    if (!fighting(w, e, phase) || s.pyre !== py) return;
    for (const f of fires) {
      w.spawnField({ x: f.x, y: f.y, r: py.r, dur: 9999, tick: 0.5, dmg: e.dmg * 0.05, type: 'fire', status: { status: 'burn', dur: 1.5, power: Math.max(2, Math.round(e.dmg * 0.04)) }, look: 'fire', hostile: true, depth: 0, spec: null, onHit: false });
      const fl = w.fields[w.fields.length - 1];
      if (fl) py.fields.push(fl);
    }
    w.sfx('fireball', 0.8);
    w.shake(4);
  });
}

/**
 * The burial chamber burns: rings of fire `r` px wide close in from the walls, two tiles deep each,
 * `rings` of them, the first after `delay` s and then one every `every` s (each shown for `wind` s,
 * hurting `mul`), burning until the fight ends.
 */
const pyre: PatternFn = (w, e, _dt, k) => {
  const pt = k.pt;
  if (pt.step === 0) {
    const s = fight(w, e);
    // once lit, the fire keeps its own pace
    if (!s.pyre)
      s.pyre = { rings: k.num('rings', 2), every: k.num('every', 14), wind: k.num('wind', 1.6), mul: k.num('mul', 0.8), next: w.time + k.num('delay', 0), n: 0, r: k.num('r', 22), fields: [] };
    w.fxBurst(e.x, e.y - 12, '#ff9a3d', 24, 26);
    w.sfx('roar');
    pt.step = 1;
  } else if (pt.t >= 0.6) k.end();
};

/* ------------------------------------------------------------------ the Sand Warden */

/**
 * A wall of sand forms along one side of the hall (the side away from the hero), `form` s, then rolls
 * across it at `speed`: `width` px thick, with one gap `gap` px wide to stand in (or dodge through it).
 * `waves` walls in a row, each from a new side. Caught: `mul`, once a wall.
 */
const sandsweep: PatternFn = (w, e, dt, k) => {
  const pt = k.pt;
  const p = w.player;
  const box = roomBox(w, e);
  const width = k.num('width', 22);
  const form = k.num('form', 1.2);
  if (pt.step === 0) {
    const n = pt.data.n ?? 0;
    const b = e.boss!;
    let dir: number;
    if (n === 0) {
      const dx = p.x - b.cx;
      const dy = p.y - b.cy;
      dir = Math.abs(dx) * (box.y1 - box.y0) > Math.abs(dy) * (box.x1 - box.x0) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3;
    } else dir = (pt.data.dir! + (w.rand() < 0.5 ? 1 : 3)) % 4;
    pt.data.dir = dir;
    const horiz = dir === 0 || dir === 2;
    // along: where the wall is (it moves along this axis); across: the wall's length
    const lo = horiz ? box.y0 : box.x0;
    const hi = horiz ? box.y1 : box.x1;
    const gap = k.num('gap', 56);
    // the gap: anywhere along the wall but the corners
    const g0 = lo + 24 + w.rand() * Math.max(1, hi - lo - 48 - gap);
    pt.data.g0 = g0;
    pt.data.g1 = g0 + gap;
    pt.data.pos = dir === 0 ? box.x0 + 4 : dir === 2 ? box.x1 - 4 : dir === 1 ? box.y0 + 4 : box.y1 - 4;
    pt.data.end = dir === 0 ? box.x1 : dir === 2 ? box.x0 : dir === 1 ? box.y1 : box.y0;
    pt.data.sign = dir === 0 || dir === 1 ? 1 : -1;
    pt.data.hit = 0;
    pt.data.t0 = pt.t;
    const travel = Math.abs(pt.data.end - pt.data.pos) / k.num('speed', 105);
    // the wall in two parts either side of the gap: lines laid across the hall
    const a = horiz ? Math.PI / 2 : 0;
    const pos = pt.data.pos;
    const parts = [
      [lo, g0],
      [g0 + gap, hi],
    ].filter(([s0, s1]) => s1! - s0! >= 4) as [number, number][];
    pt.data.id0 = w.nextId;
    for (const [s0, s1] of parts) w.addTelegraph({ shape: 'line', x: horiz ? pos : s0, y: horiz ? s0 : pos, r: 0, r2: width, angle: a, len: s1 - s0, dur: form, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: travel + 0.2 });
    pt.data.id1 = w.nextId;
    // and the floor it will roll over, either side of the lane the gap leaves (shrinking behind it)
    const along = dir === 0 ? 0 : dir === 1 ? Math.PI / 2 : dir === 2 ? Math.PI : -Math.PI / 2;
    for (const [s0, s1] of parts) w.addTelegraph({ shape: 'line', x: horiz ? pos : (s0 + s1) / 2, y: horiz ? (s0 + s1) / 2 : pos, r: 0, r2: s1 - s0, angle: along, len: Math.abs(pt.data.end - pos), dur: form + travel + 0.3, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
    pt.data.id2 = w.nextId;
    if (n === 0) w.text(e.x, e.y - e.r - 16, 'THE SANDS RISE!', '#e8d0a0', true);
    faceTo(e, k.aimAt());
    w.sfx('quake', 0.6);
    pt.step = 1;
  } else if (pt.step === 1) {
    const horiz = pt.data.dir === 0 || pt.data.dir === 2;
    const g0 = pt.data.g0!;
    const g1 = pt.data.g1!;
    const tels = w.telegraphs.filter((t) => t.id >= pt.data.id0! && t.id < pt.data.id2!);
    if (pt.t - pt.data.t0! >= form) {
      // it rolls
      pt.data.pos! += pt.data.sign! * k.num('speed', 105) * dt;
      for (const t of tels) {
        if (horiz) t.x = pt.data.pos!;
        else t.y = pt.data.pos!;
        if (t.id >= pt.data.id1!) t.len = Math.max(0, Math.abs(pt.data.end! - pt.data.pos!));
      }
      const along = horiz ? p.x : p.y;
      const across = horiz ? p.y : p.x;
      const inGap = across > g0 + 1 && across < g1 - 1;
      if (!pt.data.hit && !p.dead && !inGap && Math.abs(along - pt.data.pos!) < width / 2 + p.r * 0.5) {
        if (hurtPlayer(w, e.dmg * k.num('mul', 1.3), { fromX: horiz ? pt.data.pos! - pt.data.sign! * 20 : p.x, fromY: horiz ? p.y : pt.data.pos! - pt.data.sign! * 20, knock: 160, source: e })) pt.data.hit = 1;
      }
    }
    // sand streaming off the wall
    const pos = pt.data.pos!;
    const lo = horiz ? box.y0 : box.x0;
    const hi = horiz ? box.y1 : box.x1;
    for (let q = 0; q < 3; q++) {
      const c = lo + w.rand() * (hi - lo);
      if (c > g0 && c < g1) continue;
      const x = horiz ? pos + (w.rand() - 0.5) * width : c;
      const y = horiz ? c : pos + (w.rand() - 0.5) * width;
      w.addFx({ kind: 'smoke', x, y: y - 2, vx: (horiz ? pt.data.sign! : 0) * 30, vy: (horiz ? 0 : pt.data.sign! * 30) - 8, life: 0.45, size: 3, color: SAND[Math.floor(w.rand() * 4)]! });
    }
    const done = pt.data.sign! > 0 ? pos >= pt.data.end! : pos <= pt.data.end!;
    if (done) {
      w.telegraphs = w.telegraphs.filter((t) => !tels.includes(t));
      pt.data.n = (pt.data.n ?? 0) + 1;
      pt.data.t1 = pt.t;
      pt.step = pt.data.n >= k.num('waves', 1) ? 3 : 2;
    }
  } else if (pt.step === 2 && pt.t >= pt.data.t1! + k.num('gapT', 0.5)) pt.step = 0;
  else if (pt.step === 3 && pt.t >= pt.data.t1! + 0.3) k.end();
};

/**
 * Pits of quicksand open: `count` circles of `r` (the first under the hero) that, after `wind` s, sink
 * (hurting `mul`) and stay `life` s, dragging whoever stands in them toward the middle (`pull` px/s)
 * and slowing them. A dodge carries you out.
 */
const quicksand: PatternFn = (w, e, _dt, k) => {
  const pt = k.pt;
  const wind = k.num('wind', 1.1);
  if (pt.step === 0) {
    const s = fight(w, e);
    const p = w.player;
    const r = k.num('r', 24);
    const count = k.num('count', 3);
    const a0 = w.rand() * TAU;
    for (let i = 0; i < count; i++) {
      let x = p.x;
      let y = p.y;
      if (i > 0) {
        const a = a0 + (TAU * i) / Math.max(1, count - 1);
        const d = 44 + w.rand() * 36;
        x += Math.cos(a) * d;
        y += Math.sin(a) * d * 0.8;
      }
      if (!onFloor(w, e, x, y, 4)) continue;
      const id = w.nextId;
      w.addTelegraph({ shape: 'circle', x, y, r, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1), knock: 0, tone: 'enemy', owner: -1, linger: 0 });
      const tg = w.telegraphs.find((t) => t.id === id);
      w.after(wind, () => {
        if (!tg || tg.t < tg.dur - 0.05 || !fighting(w, e)) return;
        w.spawnField({ x, y, r, dur: k.num('life', 8), tick: 0.5, dmg: e.dmg * 0.1, type: 'physical', status: { status: 'chill', dur: 0.8, power: 0.45 }, look: 'holy', hostile: true, depth: 0, spec: null, onHit: false });
        const f = w.fields[w.fields.length - 1];
        if (f) s.pits.push({ f, pull: k.num('pull', 30) });
        // never more than a handful at once: the oldest fill in
        const live = s.pits.filter((q) => w.fields.includes(q.f));
        if (live.length > 6) live[0]!.f.t = Math.min(live[0]!.f.t, 0.5);
        for (let q = 0; q < 10; q++) w.addFx({ kind: 'rubble', x: x + (w.rand() - 0.5) * r, y: y + (w.rand() - 0.5) * r * 0.6, vx: 0, vy: 30, life: 0.4, size: 2, color: SAND[q % 4]! });
        w.sfx('crumble', 0.4);
      });
    }
    w.text(e.x, e.y - e.r - 16, 'QUICKSAND!', '#e8d0a0', true);
    w.sfx('quake', 0.5);
    w.shake(2);
    pt.step = 1;
  } else if (pt.t >= wind + 0.2) k.end();
};

function tickPits(w: World, s: Fight, dt: number): void {
  if (!s.pits.length) return;
  s.pits = s.pits.filter((q) => w.fields.includes(q.f));
  const p = w.player;
  s.swirlT -= dt;
  const swirl = s.swirlT <= 0;
  if (swirl) s.swirlT = 0.08;
  for (const { f, pull } of s.pits) {
    // the sand turns round and runs down into the middle
    if (swirl) {
      for (let q = 0; q < 2; q++) {
        const a = w.rand() * TAU;
        const r = f.r * (0.5 + w.rand() * 0.45);
        const sp = 30;
        w.addFx({ kind: 'smoke', x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r * 0.75, vx: -Math.sin(a) * sp - Math.cos(a) * 16, vy: (Math.cos(a) * sp - Math.sin(a) * 16) * 0.75, life: 0.6, size: 2, color: q ? '#7a5a34' : SAND[Math.floor(w.rand() * 4)]! });
      }
      w.addFx({ kind: 'glow', x: f.x, y: f.y, life: 0.2, size: 6, color: '#5a4024' });
    }
    // and drags in whoever stands in it (a dodge carries you out)
    const d = dist(p.x, p.y, f.x, f.y);
    if (!p.dead && !p.dash && d < f.r && d > 2) {
      const step = Math.min(d - 2, pull * dt);
      const m = moveCircle(w.map, p.x, p.y, p.r, ((f.x - p.x) / d) * step, ((f.y - p.y) / d) * step);
      p.x = m.x;
      p.y = m.y;
    }
  }
}

/**
 * The Warden falls apart: a heap of sand (its `sprite`) that can't be hurt, and `wraiths` sand-wraiths
 * (`enemy`) rising around it. It reforms after `time` s, healing `heal` of its health for every wraith
 * still standing (they flow back into it); if they are all destroyed first, it reforms at once, thin
 * and cracked: reeling for `daze` s and softer for a while.
 */
const crumble: PatternFn = (w, e, _dt, k) => {
  const pt = k.pt;
  if (pt.step === 0) {
    const s = fight(w, e);
    const b = e.boss!;
    const time = k.num('time', 10);
    const sprite = e.def.sprite;
    e.def.sprite = k.str('sprite', 'the-sand-warden-heap');
    for (let i = 0; i < 26; i++) w.addFx({ kind: i % 2 ? 'rubble' : 'smoke', x: e.x + (w.rand() - 0.5) * 26, y: e.y - 6 - w.rand() * 22, vx: (w.rand() - 0.5) * 140, vy: -40 - w.rand() * 70, life: 0.8, size: i % 2 ? 2 : 4, color: SAND[i % 4]! });
    w.text(e.x, e.y - e.r - 18, 'IT FALLS INTO SAND!', '#e8d0a0', true);
    w.sfx('crumble');
    w.shake(6);
    // the wraiths rise from the spilled sand
    const id0 = w.nextId;
    const n = k.num('wraiths', 4);
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 12; tries++) {
        const a = (TAU * i) / n + w.rand() * 0.6;
        const d = 48 + w.rand() * 30;
        const x = e.x + Math.cos(a) * d;
        const y = e.y + Math.sin(a) * d * 0.8;
        if (!onFloor(w, e, x, y, 7)) continue;
        w.spawnAdd(k.str('enemy', 'sand-wraith'), x, y, e.room);
        w.addFx({ kind: 'zap', x: e.x, y: e.y - 6, x2: x, y2: y - 6, life: 0.4, size: 1, color: SAND[0]! });
        break;
      }
    }
    s.heap = { until: w.time + time, wraiths: w.enemies.filter((o) => o.id >= id0 && !o.boss).map((o) => o.id), heal: k.num('heal', 0.04), daze: k.num('daze', 3), sprite };
    w.text(w.player.x, w.player.y - 30, 'Destroy the wraiths before it reforms!', '#e8d0a0', true);
    // a heap of sand can't be hurt, and does nothing but wait
    b.shift = time;
    pt.step = 1;
    k.end();
  }
};

function tickHeap(w: World, e: Enemy, s: Fight): void {
  const h = s.heap;
  if (!h) return;
  const b = e.boss!;
  const left = h.wraiths.map((id) => w.enemyById(id)).filter((o): o is Enemy => !!o && !o.dead);
  // grains drifting back toward the heap from what is left of it
  for (const o of left) if (w.rand() < 0.15) w.addFx({ kind: 'smoke', x: o.x, y: o.y - 4, vx: (e.x - o.x) * 0.8, vy: (e.y - o.y) * 0.8, life: 0.8, size: 2, color: SAND[0]! });
  const early = left.length === 0;
  if (!early && w.time < h.until && b.shift > 0) return;
  // it reforms
  s.heap = null;
  e.def.sprite = h.sprite;
  b.shift = 0;
  w.shake(5);
  w.sfx('quake');
  for (let i = 0; i < 20; i++) {
    const a = w.rand() * TAU;
    w.addFx({ kind: 'smoke', x: e.x + Math.cos(a) * 40, y: e.y + Math.sin(a) * 30, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 45 - 10, life: 0.6, size: 4, color: SAND[i % 4]! });
  }
  if (early) {
    // nothing came back to it: it stands thin and cracked
    b.dazed = h.daze;
    e.statuses.push({ id: 'stun', t: h.daze, power: 1, tick: 0 });
    e.statuses.push({ id: 'armorBreak', t: h.daze + 4, power: 30, tick: 0 });
    w.text(e.x, e.y - e.r - 18, 'IT REFORMS, CRACKED!', '#ffe066', true);
    return;
  }
  // every wraith still walking flows back into it
  for (const o of left) {
    w.addFx({ kind: 'zap', x: o.x, y: o.y - 4, x2: e.x, y2: e.y - 10, life: 0.5, size: 1, color: SAND[2]! });
    o.hp = 0;
    o.dead = true;
    o.deathT = 0;
  }
  const add = e.maxHp * h.heal * left.length;
  e.hp = Math.min(e.maxHp, e.hp + add);
  w.text(e.x, e.y - e.r - 18, `IT REFORMS! +${Math.round(add)}`, '#e8d0a0', true);
}

export const TOMB_OF_THE_SUN_KING_PATTERNS: Record<string, PatternFn> = {
  'tomb:sun-disc': sunDisc,
  'tomb:sunbeam': sunbeam,
  'tomb:scarabs': scarabs,
  'tomb:pyre': pyre,
  'tomb:sandsweep': sandsweep,
  'tomb:quicksand': quicksand,
  'tomb:crumble': crumble,
};

/** For tests: whether a hero standing at (hx, hy) would be in the light of a sun at (x, y). */
export const inSunlight = (w: World, x: number, y: number, hx: number, hy: number, r: number): boolean => lightShapes(w, x, y).some((t) => within(t, hx, hy, r));
