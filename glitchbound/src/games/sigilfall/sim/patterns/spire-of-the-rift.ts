import { dist, inLine, TAU } from '../../core/math';
import { hurtPlayer } from '../combat';
import { castRay, circleHitsWall, moveCircle, TILE, tileAt } from '../map';
import type { Enemy, Telegraph } from '../types';
import type { World } from '../world';
import type { PatternFn } from './kit';

/**
 * Boss attacks of the Spire of the Tear: ids start with 'spire:'.
 *
 * The Veil Sentinel, the construct of black glass that guards the stair: a beam from its core of
 * grieflight crystal that glances off the walls and pillars it meets (`prism`), and its core turned inward,
 * the Tear's gravity dragging everything toward it before it crushes the space around itself
 * (`gravity`).
 *
 * The Pale Herald steps between this world and the other. He tears the Veil open (`tear`): each tear
 * pulls the hero toward it, spits grieflight at them and bursts as it closes, and at the very end one
 * great tear opens over the middle of the Crown and pulls at the whole room. He steps out of the world
 * and comes back as several of himself (`echoes`): pale echoes of glass that cast his lances with him,
 * in turn, until the hero finds the one carrying the Sigil of the Veil (strike him and the echoes
 * shatter and he staggers) or they all cast at once. And he drops the floor into the Tear (`sunder`):
 * the Crown is panes of glass over the Tear, and the ones he strikes crack and fall away, leaving holes
 * that hurt and slow whoever stands over them until the floor comes back.
 *
 * The tears, the holes in the floor and the echoes outlive the pattern that made them, so each fight
 * keeps them here and a small ticker (World.after, once a step) runs them while the boss stands. A
 * phase change takes the tears with it like every other attack (and the holes, which close); a defeat
 * or a win takes everything.
 */

const RIFT = '#ff3fd2';
const VEIL = '#22e4ff';
const PALE = '#e8d8ff';
const GLASS = ['#2e2440', '#40305a', '#5a3488', '#9af0ff'];
const ECHO = 'spire-echo';
/** Tears pulling together never pull harder than this (px/s): always slower than a hero walks. */
const MAX_PULL = 46;
const MAX_TEARS = 5;
/** Seconds between bites of a hole in the floor (however many the hero stands over, it bites once). */
const HOLE_TICK = 0.45;
/** Seconds a tear's core waits between bites. */
const CORE_TICK = 0.5;

interface Tear {
  x: number;
  y: number;
  phase: number;
  /** Open from `open` (once its circle lands); it starts to close at `close`. */
  open: number;
  close: number;
  pull: number;
  reach: number;
  every: number;
  shotT: number;
  mul: number;
  speed: number;
  /** The burst when it closes: radius and share of the boss's blow. */
  r: number;
  bmul: number;
  /** Its core (touching it hurts), shown as a circle that fills as the tear's time runs out. */
  core: number;
  mark: Telegraph | null;
  bite: number;
  fxT: number;
  closing: boolean;
  big: boolean;
}
interface Pane {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  state: 'whole' | 'cracking' | 'fallen';
  /** The hole while it is open (its fill shows the floor coming back). */
  hole: Telegraph | null;
  vmul: number;
  fxT: number;
}
interface Fight {
  last: number;
  tears: Tear[];
  panes: Pane[] | null;
  /** Seconds to the next bite of the holes. */
  bite: number;
  echoes: Enemy[];
}

const FIGHTS = new WeakMap<Enemy, Fight>();

/** The fight goes on: the boss stands, isn't falling, its room hasn't reset (and, if given, it is still in that phase). */
function fighting(w: World, e: Enemy, phase?: number): boolean {
  const b = e.boss;
  return !!b && !e.dead && b.dying <= 0 && w.enemies.includes(e) && (phase === undefined || b.phase === phase);
}

const standing = (w: World, x: Enemy): boolean => !x.dead && x.hp > 0 && w.enemies.includes(x);

const faceTo = (e: Enemy, a: number): void => {
  e.face = Math.cos(a) < 0 ? Math.PI : 0;
};

/** The boss room's bounds in pixels (worked out once per fight). */
function roomBox(w: World, e: Enemy): { x0: number; y0: number; x1: number; y1: number } {
  const m = e.boss!.misc;
  if (m.sx1 === undefined) {
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
    m.sx0 = x0 * TILE;
    m.sy0 = y0 * TILE;
    m.sx1 = (x1 + 1) * TILE;
    m.sy1 = (y1 + 1) * TILE;
  }
  return { x0: m.sx0!, y0: m.sy0!, x1: m.sx1, y1: m.sy1! };
}

/** A spot on the boss room's open floor with room for a circle of radius r. */
function onFloor(w: World, e: Enemy, x: number, y: number, r: number): boolean {
  const i = tileAt(w.map, x, y);
  return i >= 0 && w.map.room[i] === e.room + 1 && !circleHitsWall(w.map, x, y, r);
}

/** A random open spot of the boss room's floor (or null after a few tries). */
function anySpot(w: World, e: Enemy, r: number): { x: number; y: number } | null {
  const tiles = w.map.roomTiles[e.room] ?? [];
  for (let tries = 0; tries < 20 && tiles.length; tries++) {
    const i = tiles[Math.floor(w.rand() * tiles.length)]!;
    const x = ((i % w.map.w) + 0.5) * TILE;
    const y = (Math.floor(i / w.map.w) + 0.5) * TILE;
    if (onFloor(w, e, x, y, r)) return { x, y };
  }
  return null;
}

/** Drags the hero by (vx, vy) px/s, at most MAX_PULL (walls still stop them); a dodge slips the pull. */
function drag(w: World, vx: number, vy: number, dt: number): void {
  const p = w.player;
  if (p.dead || p.dash) return;
  const l = Math.hypot(vx, vy);
  if (l < 0.5) return;
  const k = l > MAX_PULL ? MAX_PULL / l : 1;
  const m = moveCircle(w.map, p.x, p.y, p.r, vx * k * dt, vy * k * dt);
  p.x = m.x;
  p.y = m.y;
}

/** A spark of the Tear drifting in toward a point from `r` px away (the pull, made visible). */
function inward(w: World, x: number, y: number, r: number): void {
  const a = w.rand() * TAU;
  const d = r * (0.45 + w.rand() * 0.55);
  const life = 0.55;
  w.addFx({ kind: 'shard', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.75, vx: (-Math.cos(a) * d) / life, vy: (-Math.sin(a) * d * 0.75) / life, life, size: 1, color: w.rand() < 0.5 ? RIFT : VEIL });
}

/* ------------------------------------------------------------ the lasting state */

function fight(w: World, e: Enemy): Fight {
  let s = FIGHTS.get(e);
  if (!s) {
    s = { last: w.time, tears: [], panes: null, bite: 0, echoes: [] };
    FIGHTS.set(e, s);
    w.after(0, () => tick(w, e));
  }
  return s;
}

/** An echo goes back into the Veil (no burst, nothing to loot). */
function fade(w: World, x: Enemy): void {
  if (x.dead) return;
  w.addFx({ kind: 'rift', x: x.x, y: x.y, life: 0.5, size: 12, color: RIFT });
  w.fxBurst(x.x, x.y - 8, PALE, 8, 10);
  x.hp = 0;
  x.dead = true;
  x.deathT = 0;
}

/** Once a step for as long as the boss fights. */
function tick(w: World, e: Enemy): void {
  const s = FIGHTS.get(e);
  if (!s) return;
  if (!fighting(w, e)) {
    // won, or the room reset after a defeat: the tears close, the floor comes back, the echoes go
    const marks = new Set<Telegraph>();
    for (const t of s.tears) if (t.mark) marks.add(t.mark);
    for (const q of s.panes ?? []) if (q.hole) marks.add(q.hole);
    w.telegraphs = w.telegraphs.filter((t) => !marks.has(t));
    for (const x of s.echoes) fade(w, x);
    FIGHTS.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  tickTears(w, e, s, dt);
  tickPanes(w, e, s, dt);
  // echoes outlive their spell only by a moment (a phase change cut it short)
  s.echoes = s.echoes.filter((x) => standing(w, x));
  if (s.echoes.length && e.boss!.pattern?.use.id !== 'spire:echoes') {
    for (const x of s.echoes) fade(w, x);
    s.echoes = [];
  }
  for (const x of s.echoes) faceTo(x, Math.atan2(w.player.y - x.y, w.player.x - x.x));
  w.after(0, () => tick(w, e));
}

/* ------------------------------------------------------------ the Veil Sentinel */

interface Seg {
  x: number;
  y: number;
  a: number;
  len: number;
}

/** A beam from (x, y) along `a`, `len` long in all, glancing off up to `bounces` walls or pillars. */
function beamPath(w: World, x: number, y: number, a: number, len: number, bounces: number): Seg[] {
  const segs: Seg[] = [];
  let left = len;
  for (let i = 0; i <= bounces && left > 12; i++) {
    const end = castRay(w.map, x, y, 2, a, left);
    const l = dist(x, y, end.x, end.y);
    segs.push({ x, y, a, len: Math.max(8, l) });
    left -= l;
    if (left <= 6) break;
    // which way the wall faces: a wall across x turns the beam back in x, one across y in y
    const hx = circleHitsWall(w.map, end.x + Math.cos(a) * 4, end.y, 2);
    const hy = circleHitsWall(w.map, end.x, end.y + Math.sin(a) * 4, 2);
    if (hx && !hy) a = Math.PI - a;
    else if (hy && !hx) a = -a;
    else a += Math.PI;
    x = end.x;
    y = end.y;
  }
  return segs;
}

/**
 * The prism: the Sentinel's core gathers the Veil's light (shown for `wind` s along the whole path) and
 * looses `beams` beams (`spread` apart, aimed at the hero), each `width` wide and `len` long in all,
 * glancing off up to `bounces` walls or pillars. Caught in any of them, the hero takes `mul` of its
 * blow, once; the beams burn on for `linger` s.
 */
const prism: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const p = w.player;
  const wind = k.num('wind', 1);
  const lin = k.num('linger', 0.25);
  const width = k.num('width', 16);
  const hit = (): void => {
    if (pt.data.hit || p.dead) return;
    for (let i = 0; i < pt.data.ns!; i++) {
      if (!inLine(p.x, p.y, p.r * 0.5, pt.data[`x${i}`]!, pt.data[`y${i}`]!, pt.data[`a${i}`]!, pt.data[`l${i}`]!, width)) continue;
      if (hurtPlayer(w, e.dmg * k.num('mul', 1.5), { fromX: pt.data[`x${i}`], fromY: pt.data[`y${i}`], knock: 90, source: e })) pt.data.hit = 1;
      return;
    }
  };
  if (pt.step === 0) {
    const beams = k.num('beams', 1);
    const spread = k.num('spread', 0.5);
    const a0 = k.aimAt();
    let n = 0;
    for (let j = 0; j < beams; j++) {
      const a = a0 + (j - (beams - 1) / 2) * spread;
      for (const sg of beamPath(w, e.x, e.y, a, k.num('len', 520), k.num('bounces', 1))) {
        w.addTelegraph({ shape: 'line', x: sg.x, y: sg.y, r: 0, r2: width, angle: sg.a, len: sg.len, dur: wind, dmg: 0, knock: 0, tone: 'rift', owner: -1, linger: lin });
        pt.data[`x${n}`] = sg.x;
        pt.data[`y${n}`] = sg.y;
        pt.data[`a${n}`] = sg.a;
        pt.data[`l${n}`] = sg.len;
        n++;
      }
    }
    pt.data.ns = n;
    faceTo(e, a0);
    w.addFx({ kind: 'glow', x: e.x, y: e.y - 10, life: wind, size: 16, color: VEIL });
    w.sfx('beamCharge', 0.8);
    pt.step = 1;
  } else if (pt.step === 1) {
    // the core brightens as it gathers the light
    if (w.rand() < 0.4) inward(w, e.x, e.y - 10, 30);
    if (pt.t >= wind) {
      w.sfx('beam');
      w.shake(3);
      for (let i = 0; i < pt.data.ns!; i++) {
        const a = pt.data[`a${i}`]!;
        const l = pt.data[`l${i}`]!;
        for (let d = 0; d < l; d += 22) w.addFx({ kind: 'spark', x: pt.data[`x${i}`]! + Math.cos(a) * d, y: pt.data[`y${i}`]! + Math.sin(a) * d, vx: (w.rand() - 0.5) * 30, vy: -20 - w.rand() * 20, life: 0.35, size: 1, color: w.rand() < 0.5 ? VEIL : '#ffffff' });
      }
      hit();
      pt.step = 2;
    }
  } else if (pt.step === 2) {
    if (pt.t < wind + lin) hit();
    else if (pt.t >= wind + lin + 0.3) k.end();
  }
};

/**
 * The Tear's gravity: the Sentinel turns its core inward. For `time` s everything within `reach` is
 * pulled toward it (`pull` px/s, harder the closer), and then the space around it is crushed: a circle
 * of `r` for `mul` of its blow, shown all the while (walk out against the pull, or dodge through it).
 * With `wave`, the crush sends a shockwave rolling out (that share of its blow).
 */
const gravity: PatternFn = (w, e, dt, k) => {
  const { pt } = k;
  const p = w.player;
  const time = k.num('time', 2.2);
  const reach = k.num('reach', 240);
  if (pt.step === 0) {
    w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: k.num('r', 66), r2: 0, angle: 0, len: 0, dur: time, dmg: e.dmg * k.num('mul', 1.8), knock: 170, tone: 'rift', owner: e.id, linger: 0 });
    w.text(e.x, e.y - e.r - 18, 'THE RIFT TURNS INWARD!', '#ff9af0', true);
    w.addFx({ kind: 'rift', x: e.x, y: e.y, life: time, size: 20, color: RIFT });
    w.sfx('beamCharge', 0.9);
    w.sfx('rift', 0.5);
    pt.step = 1;
  } else if (pt.step === 1) {
    const d = dist(p.x, p.y, e.x, e.y);
    const near = e.r + p.r + 4;
    if (d < reach && d > near) {
      const s = k.num('pull', 36) * (0.55 + 0.45 * (1 - d / reach));
      drag(w, ((e.x - p.x) / d) * s, ((e.y - p.y) / d) * s, dt);
    }
    if (w.rand() < 0.7) inward(w, e.x, e.y, reach * 0.6);
    if (pt.t >= time) {
      w.shake(6);
      w.sfx('rift');
      w.sfx('slam', 0.7);
      w.fxBurst(e.x, e.y, RIFT, 26, k.num('r', 66) * 0.6);
      w.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.5, size: k.num('r', 66), color: VEIL });
      if (k.num('wave', 0) > 0) w.spawnWave(e.x, e.y, 110, 200, 8, e.dmg * k.num('wave', 0));
      pt.data.t1 = pt.t;
      pt.step = 2;
    }
  } else if (pt.step === 2 && pt.t >= pt.data.t1! + 0.55) k.end();
};

/* ------------------------------------------------------------ the Pale Herald: tears */

function tickTears(w: World, e: Enemy, s: Fight, dt: number): void {
  if (!s.tears.length) return;
  const p = w.player;
  const phase = e.boss!.phase;
  // a phase change takes the tears with it, like every other attack in flight
  s.tears = s.tears.filter((t) => {
    if (t.phase === phase) return true;
    if (t.mark) w.telegraphs = w.telegraphs.filter((x) => x !== t.mark);
    return false;
  });
  let vx = 0;
  let vy = 0;
  for (const t of s.tears) {
    if (w.time < t.open) continue;
    if (!t.mark && !t.closing) {
      // it opens: a wound in the air, showing the Tear behind it
      t.mark = w.addTelegraph({ shape: 'circle', x: t.x, y: t.y, r: t.core, r2: 0, angle: 0, len: 0, dur: Math.max(0.5, t.close - w.time), dmg: 0, knock: 0, tone: 'rift', owner: -1, linger: 0 });
      w.addFx({ kind: 'rift', x: t.x, y: t.y, life: 0.7, size: t.big ? 30 : 18, color: RIFT });
      w.fxBurst(t.x, t.y, RIFT, 14, 14);
      w.sfx('rift', 0.6);
    }
    t.fxT -= dt;
    if (t.fxT <= 0) {
      t.fxT = 0.4;
      w.addFx({ kind: 'rift', x: t.x, y: t.y, life: 0.5, size: t.big ? 24 : 12, color: RIFT });
    }
    if (t.closing) continue;
    const d = dist(p.x, p.y, t.x, t.y);
    // the Tear's gravity: toward the tear, harder the closer
    if (d < t.reach && d > 6) {
      const k = t.pull * (0.5 + 0.5 * (1 - d / t.reach));
      vx += ((t.x - p.x) / d) * k;
      vy += ((t.y - p.y) / d) * k;
    }
    if (w.rand() < dt * (t.big ? 30 : 12)) inward(w, t.x, t.y, Math.min(t.reach, t.big ? 160 : 80));
    // its core burns whoever touches it
    t.bite -= dt;
    if (!p.dead && d < t.core + p.r * 0.5 && t.bite <= 0) {
      t.bite = CORE_TICK;
      hurtPlayer(w, e.dmg * 0.3, { fromX: t.x, fromY: t.y, knock: 60, status: { status: 'chill', dur: 0.8, power: 0.4 } });
    }
    // it spits grieflight at the hero (a glow first)
    t.shotT -= dt;
    if (t.shotT <= 0.35 && t.shotT + dt > 0.35) w.addFx({ kind: 'glow', x: t.x, y: t.y - 4, life: 0.4, size: 10, color: RIFT });
    if (t.shotT <= 0) {
      t.shotT = t.every;
      if (!p.dead && d < 340) {
        const a = Math.atan2(p.y - t.y, p.x - t.x);
        w.spawnProjectile({ x: t.x + Math.cos(a) * 6, y: t.y - 4 + Math.sin(a) * 6, vx: Math.cos(a) * t.speed, vy: Math.sin(a) * t.speed, r: 3.5, life: 300, dmg: e.dmg * t.mul, type: 'arcane', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'riftOrb', color: RIFT, hostile: true, homing: 0.25, child: false, knock: 0 });
        w.sfx('riftShot', 0.3);
      }
    }
    if (w.time >= t.close) {
      // it closes, and the Veil snaps shut in a burst
      t.closing = true;
      if (t.mark) w.telegraphs = w.telegraphs.filter((x) => x !== t.mark);
      t.mark = null;
      w.addTelegraph({ shape: 'circle', x: t.x, y: t.y, r: t.r, r2: 0, angle: 0, len: 0, dur: 1, dmg: e.dmg * t.bmul, knock: 140, tone: 'rift', owner: -1, linger: 0 });
      w.sfx('beamCharge', 0.5);
      w.after(1, () => {
        s.tears = s.tears.filter((x) => x !== t);
        if (!fighting(w, e, t.phase)) return;
        w.fxBurst(t.x, t.y, RIFT, 18, t.r * 0.6);
        w.addFx({ kind: 'ring', x: t.x, y: t.y, life: 0.4, size: t.r, color: VEIL });
        w.sfx('rift', 0.7);
        w.shake(3);
      });
    }
  }
  drag(w, vx, vy, dt);
}

/**
 * Tears in the Veil: `count` of them open around the hero (`center`: one great tear in the middle of
 * the room instead), each where its circle shows after `wind` s (`omul` of his blow to whoever stands
 * there). An open tear lasts `life` s: it pulls the hero toward it (`pull` px/s within `reach`, harder
 * the closer; all the tears together never faster than a hero walks, and a dodge slips it), burns
 * whoever touches its core, and spits a slow orb of grieflight at them every `every` s (`mul`, at
 * `speed`). Then it closes in a burst (a circle of `r`, shown for a second, `bmul` of his blow).
 */
const tear: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  if (pt.step === 0) {
    const s = fight(w, e);
    const p = w.player;
    const b = e.boss!;
    const big = k.num('center', 0) > 0;
    const count = Math.min(k.num('count', 2), MAX_TEARS - s.tears.length);
    const wind = k.num('wind', 1);
    const spots: { x: number; y: number }[] = [];
    if (big && !s.tears.some((t) => t.big)) spots.push({ x: b.cx, y: b.cy });
    else if (!big) {
      const a0 = w.rand() * TAU;
      for (let i = 0; i < count; i++) {
        for (let tries = 0; tries < 10; tries++) {
          const a = a0 + (TAU * i) / count + (w.rand() - 0.5) * 0.6;
          const d = 55 + w.rand() * 45;
          const x = p.x + Math.cos(a) * d;
          const y = p.y + Math.sin(a) * d * 0.85;
          if (!onFloor(w, e, x, y, 8)) continue;
          if ([...s.tears, ...spots].some((t) => dist(t.x, t.y, x, y) < 48)) continue;
          spots.push({ x, y });
          break;
        }
      }
    }
    if (!spots.length) {
      k.end();
      return;
    }
    const r = k.num('r', 34);
    const life = k.num('life', 7);
    for (const c of spots) {
      w.addTelegraph({ shape: 'circle', x: c.x, y: c.y, r: big ? r : 24, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('omul', 0.9), knock: 80, tone: 'rift', owner: -1, linger: 0 });
      w.addFx({ kind: 'zap', x: c.x - 10, y: c.y - 8, x2: c.x + 10, y2: c.y + 8, life: wind, size: 1, color: VEIL });
      s.tears.push({ x: c.x, y: c.y, phase: b.phase, open: w.time + wind, close: w.time + wind + life, pull: k.num('pull', 26), reach: k.num('reach', 120), every: k.num('every', 2.2), shotT: 1.2, mul: k.num('mul', 0.7), speed: k.num('speed', 85), r, bmul: k.num('bmul', 1.5), core: big ? 22 : 12, mark: null, bite: 0, fxT: 0, closing: false, big });
    }
    faceTo(e, k.aimAt());
    w.text(e.x, e.y - e.r - 18, big ? 'THE RIFT OPENS!' : 'THE VEIL TEARS!', '#ff9af0', true);
    w.addFx({ kind: 'glow', x: e.x, y: e.y - 10, life: 0.6, size: 16, color: RIFT });
    w.sfx('rift', 0.7);
    pt.step = 1;
  } else if (pt.t >= 0.7) k.end();
};

/* ------------------------------------------------------------ the Pale Herald: echoes */

/** Where the Herald and his echoes stand: spread round the middle of the room, away from the hero. */
function echoSpots(w: World, e: Enemy, n: number): { x: number; y: number }[] {
  const b = e.boss!;
  const box = roomBox(w, e);
  const p = w.player;
  const R = Math.min(box.x1 - box.x0, box.y1 - box.y0) * 0.32;
  const a0 = w.rand() * TAU;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (TAU * i) / n;
    let spot: { x: number; y: number } | null = null;
    for (const f of [1, 0.75, 1.25, 0.5, 1.5]) {
      const x = b.cx + Math.cos(a) * R * f;
      const y = b.cy + Math.sin(a) * R * f * 0.85;
      if (onFloor(w, e, x, y, 10) && dist(x, y, p.x, p.y) > 50 && out.every((o) => dist(o.x, o.y, x, y) > 40)) {
        spot = { x, y };
        break;
      }
    }
    spot ??= anySpot(w, e, 10);
    if (spot) out.push(spot);
  }
  return out;
}

/** A lance of pale light from one of them at the hero: a line shown for `wind` s, `dmg` to whoever is in it. */
function lance(w: World, e: Enemy, from: Enemy, wind: number, width: number, dmg: number): void {
  const p = w.player;
  const a = Math.atan2(p.y - from.y, p.x - from.x);
  const end = castRay(w.map, from.x, from.y, 2, a, 420);
  const len = Math.max(20, dist(from.x, from.y, end.x, end.y));
  w.addTelegraph({ shape: 'line', x: from.x, y: from.y, r: 0, r2: width, angle: a, len, dur: wind, dmg, knock: 60, tone: 'rift', owner: -1, linger: 0.12 });
  faceTo(from, a);
  w.addFx({ kind: 'glow', x: from.x + Math.cos(a) * 8, y: from.y - 10, life: wind, size: 8, color: PALE });
  const phase = e.boss!.phase;
  w.after(wind, () => {
    if (!fighting(w, e, phase)) return;
    for (let d = 0; d < len; d += 24) w.addFx({ kind: 'spark', x: from.x + Math.cos(a) * d, y: from.y + Math.sin(a) * d, vx: 0, vy: -18, life: 0.3, size: 1, color: PALE });
    w.sfx('riftShot', 0.4);
  });
}

/**
 * Echoes: the Herald steps out of the world (gone for `hide` s, nothing touches him) and comes back as
 * `count` + 1 of himself, spread round the room: pale echoes of glass (spire-echo) and, among them, the
 * Herald, the only one carrying the Sigil of the Veil (it glints). They take turns casting a lance of
 * pale light at the hero (`wind` s each, `gap` s apart, `mul` of his blow). Wound the Herald himself and
 * the echoes shatter and he staggers for `daze` s; an echo struck down bursts. If he is still hidden
 * among them after `time` s, they all cast at once (`fwind` s, `fmul`) and the echoes fade.
 */
const echoes: PatternFn = (w, e, dt, k) => {
  const { pt } = k;
  const s = fight(w, e);
  if (pt.step === 0) {
    pt.data.hide = 1;
    w.addFx({ kind: 'rift', x: e.x, y: e.y, life: 0.6, size: 16, color: RIFT });
    w.fxBurst(e.x, e.y - 8, PALE, 16, 16);
    w.text(e.x, e.y - e.r - 18, 'WHICH OF US?', PALE, true);
    w.sfx('blink');
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= k.num('hide', 0.7)) {
    const spots = echoSpots(w, e, k.num('count', 3) + 1);
    const real = Math.floor(w.rand() * spots.length);
    spots.forEach((c, i) => {
      w.addFx({ kind: 'rift', x: c.x, y: c.y, life: 0.8, size: 16, color: RIFT });
      if (i === real) {
        e.x = c.x;
        e.y = c.y;
        return;
      }
      w.spawnAdd(ECHO, c.x, c.y, e.room);
      const x = w.enemies[w.enemies.length - 1];
      if (x?.def.id === ECHO) s.echoes.push(x);
    });
    pt.data.hide = 0;
    // any wound from here on gives him away (a boss's hurtT is only ever reset by a hit)
    e.hurtT = 99;
    pt.data.hp = e.hp + e.shield;
    pt.data.t1 = pt.t;
    pt.data.next = pt.t + 1;
    pt.data.ci = Math.floor(w.rand() * (s.echoes.length + 1));
    faceTo(e, k.aimAt());
    w.sfx('summon', 0.6);
    pt.step = 2;
  } else if (pt.step === 2) {
    // the Sigil glints on the one who carries it
    if (w.rand() < dt * 4) w.addFx({ kind: 'spark', x: e.x + (w.rand() - 0.5) * 4, y: e.y - 9, vx: 0, vy: -14, life: 0.5, size: 1, color: VEIL });
    if (e.hurtT < 1 || e.hp + e.shield < pt.data.hp! - 0.5) {
      for (const x of s.echoes) {
        if (!standing(w, x)) continue;
        w.fxBurst(x.x, x.y - 8, PALE, 12, 14);
        fade(w, x);
      }
      s.echoes = [];
      w.text(e.x, e.y - e.r - 18, 'FOUND!', '#ffffff', true);
      w.sfx('shieldBreak');
      w.shake(4);
      w.fxBurst(e.x, e.y - 8, VEIL, 20, 18);
      k.end();
      e.boss!.dazed = k.num('daze', 2.2);
      return;
    }
    const casters = [e, ...s.echoes.filter((x) => standing(w, x) && x.state !== 'spawn')];
    if (pt.t >= pt.data.next!) {
      const c = casters[pt.data.ci! % casters.length]!;
      pt.data.ci = pt.data.ci! + 1;
      lance(w, e, c, k.num('wind', 1.1), k.num('width', 14), e.dmg * k.num('mul', 1.1));
      pt.data.next = pt.t + k.num('gap', 0.8);
    }
    if (pt.t >= pt.data.t1! + k.num('time', 9)) {
      // out of time: all of them at once
      for (const c of casters) lance(w, e, c, k.num('fwind', 1.3), k.num('width', 14), e.dmg * k.num('fmul', 1.4));
      w.text(e.x, e.y - e.r - 18, 'HEAR US!', '#ff9af0', true);
      w.sfx('beamCharge');
      pt.data.t2 = pt.t;
      pt.step = 3;
    }
  } else if (pt.step === 3 && pt.t >= pt.data.t2! + k.num('fwind', 1.3) + 0.3) {
    for (const x of s.echoes) fade(w, x);
    s.echoes = [];
    k.end();
  }
};

/* ------------------------------------------------------------ the Pale Herald: the floor falls */

const inPane = (q: Pane, x: number, y: number): boolean => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1;

/** The Crown's floor as panes: `cols` × `rows` of them over the whole room (worked out once). */
function panesOf(w: World, e: Enemy, s: Fight, cols: number, rows: number): Pane[] {
  if (s.panes) return s.panes;
  const b = roomBox(w, e);
  const pw = (b.x1 - b.x0) / cols;
  const ph = (b.y1 - b.y0) / rows;
  s.panes = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) s.panes.push({ x0: b.x0 + i * pw + 1, y0: b.y0 + j * ph + 1, x1: b.x0 + (i + 1) * pw - 1, y1: b.y0 + (j + 1) * ph - 1, state: 'whole', hole: null, vmul: 0.3, fxT: 0 });
  }
  return s.panes;
}

/** A pane of the floor, as a telegraph (a line as long as the pane and as wide: the hero steps out the short way). */
function paneMark(w: World, q: Pane, dur: number, dmg: number): Telegraph {
  const wd = q.x1 - q.x0;
  const ht = q.y1 - q.y0;
  if (wd >= ht) return w.addTelegraph({ shape: 'line', x: q.x0, y: (q.y0 + q.y1) / 2, r: 0, r2: ht, angle: 0, len: wd, dur, dmg, knock: 0, tone: 'rift', owner: -1, linger: 0 });
  return w.addTelegraph({ shape: 'line', x: (q.x0 + q.x1) / 2, y: q.y0, r: 0, r2: wd, angle: Math.PI / 2, len: ht, dur, dmg, knock: 0, tone: 'rift', owner: -1, linger: 0 });
}

function tickPanes(w: World, e: Enemy, s: Fight, dt: number): void {
  if (!s.panes) return;
  const p = w.player;
  let over: Pane | null = null;
  for (const q of s.panes) {
    if (q.state !== 'fallen') continue;
    if (!q.hole || !w.telegraphs.includes(q.hole)) {
      // its time ran out (or a phase change sealed it): the floor comes back
      const back = !!q.hole && q.hole.t >= q.hole.dur - 0.05;
      q.state = 'whole';
      q.hole = null;
      if (back) {
        for (let i = 0; i < 10; i++) w.addFx({ kind: 'spark', x: q.x0 + w.rand() * (q.x1 - q.x0), y: q.y0 + w.rand() * (q.y1 - q.y0), vx: 0, vy: -12, life: 0.5, size: 1, color: '#c896ff' });
        w.sfx('freeze', 0.3);
      }
      continue;
    }
    // the Tear shows through the hole: motes rising out of it
    q.fxT -= dt;
    if (q.fxT <= 0) {
      q.fxT = 0.1;
      const x = q.x0 + w.rand() * (q.x1 - q.x0);
      const y = q.y0 + w.rand() * (q.y1 - q.y0);
      if (w.rand() < 0.25) w.addFx({ kind: 'rift', x, y, life: 0.6, size: 6 + w.rand() * 6, color: RIFT });
      else w.addFx({ kind: 'shard', x, y, vx: 0, vy: -16 - w.rand() * 14, life: 0.7, size: 1, color: w.rand() < 0.5 ? VEIL : RIFT });
    }
    if (!p.dead && inPane(q, p.x, p.y)) over = q;
  }
  // over a hole: the Tear bites and drags at the hero's feet
  s.bite -= dt;
  if (over && s.bite <= 0) {
    s.bite = HOLE_TICK;
    if (hurtPlayer(w, e.dmg * over.vmul, { status: { status: 'chill', dur: 0.6, power: 0.5 } })) w.addFx({ kind: 'rift', x: p.x, y: p.y + 2, life: 0.4, size: 9, color: RIFT });
  } else if (!over) s.bite = Math.max(s.bite, 0.15);
}

/** A cracked pane falls into the Tear (if the fight and its phase still go on). */
function fall(w: World, e: Enemy, q: Pane, phase: number, life: number, vmul: number): void {
  if (q.state !== 'cracking') return;
  if (!fighting(w, e, phase)) {
    q.state = 'whole';
    return;
  }
  q.state = 'fallen';
  q.vmul = vmul;
  q.hole = paneMark(w, q, life, 0);
  for (let i = 0; i < 26; i++) {
    const x = q.x0 + w.rand() * (q.x1 - q.x0);
    const y = q.y0 + w.rand() * (q.y1 - q.y0);
    w.addFx({ kind: 'rubble', x, y, vx: (w.rand() - 0.5) * 40, vy: -30 - w.rand() * 50, life: 0.7, size: 2 + Math.floor(w.rand() * 2), color: GLASS[Math.floor(w.rand() * GLASS.length)]! });
  }
  for (let i = 0; i < 4; i++) w.addFx({ kind: 'rift', x: q.x0 + w.rand() * (q.x1 - q.x0), y: q.y0 + w.rand() * (q.y1 - q.y0), life: 0.8, size: 14, color: RIFT });
  w.sfx('crumble', 0.8);
  w.sfx('rift', 0.5);
  w.shake(4);
}

/**
 * The floor falls into the Tear: the Herald strikes it with his staff and `count` panes of the Crown
 * (a grid of `cols` × `rows`) crack (shown for `wind` s, `mul` of his blow to whoever is still on them
 * when they go) and fall away, the one under the hero first. A hole lasts `life` s, its fill showing the
 * floor coming back; standing over one hurts (`vmul` of his blow every HOLE_TICK s) and slows. Never more
 * than `most` of the floor is gone at once.
 */
const sunder: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  if (pt.step === 0) {
    const s = fight(w, e);
    const panes = panesOf(w, e, s, k.num('cols', 4), k.num('rows', 3));
    const whole = panes.filter((q) => q.state === 'whole');
    const most = Math.floor(panes.length * k.num('most', 0.5));
    const n = Math.min(k.num('count', 3), most - (panes.length - whole.length), whole.length);
    if (n <= 0) {
      k.end();
      return;
    }
    const p = w.player;
    const under = whole.find((q) => inPane(q, p.x, p.y));
    const rest = whole.filter((q) => q !== under && !inPane(q, e.x, e.y));
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(w.rand() * (i + 1));
      [rest[i], rest[j]] = [rest[j]!, rest[i]!];
    }
    const pick = [...(under ? [under] : []), ...rest].slice(0, n);
    const wind = k.num('wind', 1.8);
    const life = k.num('life', 7);
    const vmul = k.num('vmul', 0.3);
    const phase = e.boss!.phase;
    for (const q of pick) {
      q.state = 'cracking';
      paneMark(w, q, wind, e.dmg * k.num('mul', 1.6));
      // cracks run across it
      for (let c = 0; c < 4; c++) {
        const x = q.x0 + w.rand() * (q.x1 - q.x0);
        const y = q.y0 + w.rand() * (q.y1 - q.y0);
        const a = w.rand() * TAU;
        w.addFx({ kind: 'zap', x, y, x2: x + Math.cos(a) * 40, y2: y + Math.sin(a) * 30, life: wind, size: 1, color: VEIL });
      }
      w.after(wind, () => fall(w, e, q, phase, life, vmul));
    }
    w.text(e.x, e.y - e.r - 18, 'THE FLOOR FALLS!', '#ff9af0', true);
    w.addFx({ kind: 'glow', x: e.x, y: e.y - 10, life: 0.6, size: 18, color: VEIL });
    w.sfx('crumble', 0.5);
    w.sfx('beamCharge', 0.6);
    w.shake(2);
    pt.step = 1;
  } else if (pt.t >= 0.8) k.end();
};

export const SPIRE_OF_THE_RIFT_PATTERNS: Record<string, PatternFn> = {
  'spire:prism': prism,
  'spire:gravity': gravity,
  'spire:tear': tear,
  'spire:echoes': echoes,
  'spire:sunder': sunder,
};
