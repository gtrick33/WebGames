import { dist, TAU } from '../../core/math';
import { hurtPlayer } from '../combat';
import { castRay, circleHitsWall, moveCircle, tileAt } from '../map';
import type { Enemy, Field, Telegraph } from '../types';
import type { World } from '../world';
import type { PatternFn } from './kit';

/**
 * Boss attacks of the Barrow of Kings: ids start with 'barrow:'. King Hrodric's crown of grave-frost
 * and his whirled great sword; Sir Corvane's spectral steed, the chilling aura he brings when he fights
 * on foot, the ice his runeblade spreads over the floor, and his doom: a mark that follows the hero and
 * then falls where they stand, raising the dead from every grave it lands on.
 *
 * The lasting parts (the aura, the doom being carried, ice that keeps spreading) outlive the pattern
 * that made them, so each boss keeps them here and a small ticker (World.after, once a step) runs them
 * for as long as the fight lasts. A phase change or a defeat clears them like every other attack.
 */

const FROST = '#9ad8ff';
const DOOM = '#c08aff';
const CHILL = { status: 'chill' as const, dur: 1.2, power: 0.35 };

interface Doom {
  ring: Telegraph;
  r: number;
  fall: number;
  mul: number;
  raise: string;
  said: number;
  glowT: number;
}
interface Rime {
  f: Field;
  max: number;
  grow: number;
}
interface Fight {
  last: number;
  aura: { r: number; mul: number; f: Field | null } | null;
  auraT: number;
  dooms: Doom[];
  rimes: Rime[];
  /** The steed's hoofprints (only so they go when the fight does). */
  trails: Field[];
  /** Graves (bones) in the boss room, and the ones already risen this fight. */
  graves: { x: number; y: number; risen: boolean }[] | null;
}

const FIGHTS = new WeakMap<Enemy, Fight>();

const alive = (w: World, e: Enemy): boolean => !e.dead && !!e.boss && e.boss.dying <= 0 && w.enemies.includes(e);

/** The boss's lasting state, starting its ticker the first time. */
function fight(w: World, e: Enemy): Fight {
  let s = FIGHTS.get(e);
  if (!s) {
    s = { last: w.time, aura: null, auraT: 0, dooms: [], rimes: [], trails: [], graves: null };
    FIGHTS.set(e, s);
    w.after(0, () => tick(w, e));
  }
  return s;
}

/** Once a step for as long as the boss fights: the aura follows it, dooms follow the hero, ice spreads. */
function tick(w: World, e: Enemy): void {
  const s = FIGHTS.get(e);
  if (!s) return;
  if (!alive(w, e)) {
    // won, or the room reset after a defeat: what the fight left behind goes with it
    const mine = new Set<Field>([...s.rimes.map((r) => r.f), ...s.trails]);
    if (s.aura?.f) mine.add(s.aura.f);
    w.fields = w.fields.filter((f) => !mine.has(f));
    const rings = new Set(s.dooms.map((d) => d.ring));
    w.telegraphs = w.telegraphs.filter((t) => !rings.has(t));
    FIGHTS.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  tickAura(w, e, s, dt);
  tickDooms(w, e, s, dt);
  tickRime(w, s, dt);
  w.after(0, () => tick(w, e));
}

/* ------------------------------------------------------------------ the chilling aura */

function tickAura(w: World, e: Enemy, s: Fight, dt: number): void {
  const a = s.aura;
  if (!a) return;
  // a phase change clears enemy fields: the cold comes back when the boss moves again
  if (e.boss!.shift > 0) return;
  if (!a.f || !w.fields.includes(a.f)) {
    w.spawnField({ x: e.x, y: e.y, r: a.r, dur: 9999, tick: 0.5, dmg: e.dmg * a.mul, type: 'frost', status: CHILL, look: 'frost', hostile: true, depth: 0, spec: null, onHit: false });
    a.f = w.fields[w.fields.length - 1] ?? null;
  }
  if (a.f) {
    a.f.x = e.x;
    a.f.y = e.y;
    a.f.r = a.r;
    a.f.t = a.f.dur;
  }
  s.auraT -= dt;
  if (s.auraT <= 0) {
    s.auraT = 0.12;
    const ang = w.rand() * TAU;
    const rr = a.r * (0.4 + w.rand() * 0.6);
    w.addFx({ kind: 'spark', x: e.x + Math.cos(ang) * rr, y: e.y + Math.sin(ang) * rr * 0.75, vx: 0, vy: -14, life: 0.6, size: 1, color: w.rand() < 0.5 ? FROST : '#e8f6ff' });
  }
}

/* ------------------------------------------------------------------ the doom */

function graves(w: World, e: Enemy, s: Fight): { x: number; y: number; risen: boolean }[] {
  if (!s.graves) {
    s.graves = w.props
      .filter((p) => p.prop === 'bones' && w.map.room[tileAt(w.map, p.x, p.y)] === e.room + 1)
      .map((p) => ({ x: p.x, y: p.y, risen: false }));
  }
  return s.graves;
}

function tickDooms(w: World, e: Enemy, s: Fight, dt: number): void {
  if (!s.dooms.length) return;
  const p = w.player;
  for (const d of s.dooms) {
    const ring = d.ring;
    if (ring.t >= ring.dur) {
      dropDoom(w, e, s, d, p.x, p.y);
      d.said = -1;
      continue;
    }
    // a phase change or a defeat swept it away
    if (!w.telegraphs.includes(ring)) {
      d.said = -1;
      continue;
    }
    ring.x = p.x;
    ring.y = p.y;
    const left = Math.ceil(ring.dur - ring.t);
    if (left !== d.said && left <= 3) {
      d.said = left;
      w.text(p.x, p.y - 26, String(left), DOOM, true);
      w.sfx('enemyWindup', 0.5);
    }
    // the graves it would wake glow while the hero carries it near them
    d.glowT -= dt;
    if (d.glowT <= 0) {
      d.glowT = 0.25;
      w.addFx({ kind: 'ring', x: p.x, y: p.y, life: 0.5, size: d.r, color: DOOM });
      for (const g of graves(w, e, s)) {
        if (!g.risen && dist(g.x, g.y, p.x, p.y) < d.r + 6) w.addFx({ kind: 'glow', x: g.x, y: g.y - 2, life: 0.45, size: 12, color: DOOM });
      }
    }
  }
  s.dooms = s.dooms.filter((d) => d.said !== -1);
}

/** The doom falls where the hero stands: a circle that bursts, wakes the graves inside it and leaves ice. */
function dropDoom(w: World, e: Enemy, s: Fight, d: Doom, x: number, y: number): void {
  const id = w.nextId;
  w.addTelegraph({ shape: 'circle', x, y, r: d.r, r2: 0, angle: 0, len: 0, dur: d.fall, dmg: e.dmg * d.mul, status: CHILL, knock: 120, tone: 'rift', owner: -1, linger: 0 });
  const tg = w.telegraphs.find((t) => t.id === id);
  w.text(x, y - 24, 'THE DOOM FALLS', DOOM, true);
  w.sfx('beamCharge', 0.7);
  for (const g of graves(w, e, s)) if (!g.risen && dist(g.x, g.y, x, y) < d.r + 4) w.addFx({ kind: 'glow', x: g.x, y: g.y - 2, life: d.fall, size: 16, color: DOOM });
  w.after(d.fall, () => {
    // only if it really landed (a phase change or a defeat clears it first)
    if (!tg || tg.t < tg.dur - 0.05 || !alive(w, e)) return;
    w.sfx('rift', 0.8);
    w.shake(4);
    w.fxBurst(x, y, DOOM, 18, d.r * 0.7);
    w.addFx({ kind: 'ring', x, y, life: 0.5, size: d.r + 8, color: '#e8d8ff' });
    // the dead rise from every grave it fell on (each grave once a fight)
    const adds = w.enemies.filter((o) => !o.dead && !o.boss && o.room === e.room).length;
    let raised = 0;
    for (const g of graves(w, e, s)) {
      if (g.risen || dist(g.x, g.y, x, y) >= d.r + 4 || adds + raised >= 6) continue;
      g.risen = true;
      raised += 1;
      w.spawnAdd(d.raise, g.x, g.y, e.room);
      w.fxBurst(g.x, g.y, DOOM, 10, 10);
    }
    if (raised) w.text(x, y - 30, raised > 1 ? 'THE DEAD RISE!' : 'A GRAVE OPENS!', '#e8d8ff', true);
    // and the floor where it fell freezes over
    addRime(w, e, s, x, y, 14, 44, 5, 14, 0.14);
  });
}

/* ------------------------------------------------------------------ the rime */

function addRime(w: World, e: Enemy, s: Fight, x: number, y: number, r0: number, max: number, grow: number, life: number, mul: number): void {
  if (circleHitsWall(w.map, x, y, 2)) return;
  w.spawnField({ x, y, r: r0, dur: life, tick: 0.5, dmg: e.dmg * mul, type: 'frost', status: CHILL, look: 'frost', hostile: true, depth: 0, spec: null, onHit: false });
  const f = w.fields[w.fields.length - 1];
  if (f) s.rimes.push({ f, max, grow });
  // never more than a few patches at once: the oldest thaw
  if (s.rimes.length > 8) {
    const old = s.rimes[0]!;
    old.f.t = Math.min(old.f.t, 1);
  }
}

function tickRime(w: World, s: Fight, dt: number): void {
  if (!s.rimes.length) return;
  s.rimes = s.rimes.filter((r) => w.fields.includes(r.f));
  for (const r of s.rimes) r.f.r = Math.min(r.max, r.f.r + r.grow * dt);
}

/* ------------------------------------------------------------------ the patterns */

export const BARROW_OF_KINGS_PATTERNS: Record<string, PatternFn> = {
  /**
   * Hrodric's crown pulses: rings of grave-frost roll out from where he stands, one after another
   * (`rings` of `width`, each shown for `wind` s, `gap` s apart). Step into a ring that has already
   * burst, or get clear of them all. `inward` 1 rolls them in from the edge.
   */
  'barrow:frost-pulse': (w, e, _dt, k) => {
    const { pt } = k;
    const rings = k.num('rings', 3);
    const width = k.num('width', 34);
    const wind = k.num('wind', 1);
    const gap = k.num('gap', 0.45);
    if (pt.step === 0) {
      pt.data.x = e.x;
      pt.data.y = e.y;
      pt.data.n = 0;
      w.addFx({ kind: 'glow', x: e.x, y: e.y - 18, life: 0.6, size: 14, color: FROST });
      w.text(e.x, e.y - e.r - 16, 'GRAVE-FROST!', '#c8f0ff', true);
      w.sfx('freeze', 0.7);
      pt.step = 1;
    }
    const n = pt.data.n ?? 0;
    if (pt.step === 1 && n < rings && pt.t >= 0.3 + n * gap) {
      const i = k.num('inward', 0) > 0 ? rings - 1 - n : n;
      const x = pt.data.x!;
      const y = pt.data.y!;
      const outer = (i + 1) * width;
      w.addTelegraph({ shape: i === 0 ? 'circle' : 'donut', x, y, r: outer, r2: i * width, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1.2), status: CHILL, knock: 70, tone: 'enemy', owner: -1, linger: 0 });
      w.after(wind, () => {
        if (!alive(w, e)) return;
        w.addFx({ kind: 'ring', x, y, life: 0.4, size: outer, color: FROST });
        w.sfx('freeze', 0.35);
      });
      pt.data.n = n + 1;
    }
    if (pt.t >= 0.3 + (rings - 1) * gap + wind + 0.3) k.end();
  },

  /**
   * Hrodric whirls the great sword round himself as he wades toward the hero: `spins` circles of `r`
   * that follow him, each landing after `wind` s, while he walks at `speed`. Keep backing off.
   */
  'barrow:whirl': (w, e, dt, k) => {
    const { pt } = k;
    const p = w.player;
    const r = k.num('r', 38);
    const wind = k.num('wind', 0.7);
    if (pt.step === 0) {
      pt.data.t0 = pt.t;
      w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1.3), knock: 160, tone: 'enemy', owner: e.id, linger: 0 });
      w.sfx('whirl', 0.6);
      pt.step = 1;
    } else if (pt.step === 1) {
      if (!p.dead && dist(e.x, e.y, p.x, p.y) > e.r + p.r + 4) {
        const a = k.aimAt();
        const sp = k.num('speed', 52) * dt;
        const m = moveCircle(w.map, e.x, e.y, e.r, Math.cos(a) * sp, Math.sin(a) * sp);
        e.x = m.x;
        e.y = m.y;
        e.walkT += dt;
        e.face = Math.cos(a) < 0 ? Math.PI : 0;
      }
      if (pt.t >= pt.data.t0! + wind) {
        w.addFx({ kind: 'slash', x: e.x, y: e.y, a: e.face, a2: TAU, life: 0.22, size: r, color: '#d8e8ff', r2: 1 });
        w.sfx('swingBig');
        w.shake(3);
        pt.data.n = (pt.data.n ?? 0) + 1;
        pt.data.t1 = pt.t;
        pt.step = pt.data.n >= k.num('spins', 3) ? 2 : 3;
      }
    } else if (pt.step === 3 && pt.t >= pt.data.t1! + k.num('gap', 0.12)) pt.step = 0;
    else if (pt.step === 2 && pt.t >= pt.data.t1! + 0.5) k.end();
  },

  /**
   * Corvane's spectral steed rides the hero down along a lane (shown for `wind` s, then `wind2` for the
   * passes after), wheels at the wall and rides again, `passes` times, leaving hoofprints of frost that
   * last `trail` s. Contact deals `mul`; the lane stops at walls and pillars.
   */
  'barrow:steed-charge': (w, e, dt, k) => {
    const { pt } = k;
    const p = w.player;
    if (pt.step === 0) {
      const a = k.aimAt();
      const end = castRay(w.map, e.x, e.y, e.r, a, k.num('len', 300));
      pt.data.a = a;
      pt.data.left = Math.max(30, dist(e.x, e.y, end.x, end.y));
      pt.data.t0 = pt.t;
      pt.data.wind = (pt.data.n ?? 0) === 0 ? k.num('wind', 0.75) : k.num('wind2', 0.55);
      w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: e.r * 2 + 8, angle: a, len: pt.data.left + e.r, dur: pt.data.wind, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
      e.face = Math.cos(a) < 0 ? Math.PI : 0;
      w.sfx('snort', 0.9);
      pt.step = 1;
    } else if (pt.step === 1 && pt.t >= pt.data.t0! + pt.data.wind!) {
      pt.step = 2;
      pt.data.hit = 0;
      pt.data.trail = 0;
      w.sfx('rush');
    } else if (pt.step === 2) {
      const a = pt.data.a!;
      const step = k.num('speed', 300) * dt;
      const m = moveCircle(w.map, e.x, e.y, e.r, Math.cos(a) * step, Math.sin(a) * step);
      const moved = dist(e.x, e.y, m.x, m.y);
      e.x = m.x;
      e.y = m.y;
      e.walkT += dt * 2;
      pt.data.left! -= step;
      pt.data.trail! += moved;
      if (pt.data.trail! >= 20) {
        pt.data.trail = 0;
        const s = fight(w, e);
        w.spawnField({ x: e.x, y: e.y + 2, r: 10, dur: k.num('trail', 3), tick: 0.5, dmg: e.dmg * k.num('trailMul', 0.12), type: 'frost', status: CHILL, look: 'frost', hostile: true, depth: 0, spec: null, onHit: false });
        const f = w.fields[w.fields.length - 1];
        if (f) s.trails = [...s.trails.filter((x) => w.fields.includes(x)), f];
      }
      w.addFx({ kind: 'smoke', x: e.x - Math.cos(a) * e.r, y: e.y + e.r * 0.5, life: 0.45, size: 4, color: '#8ab0d0' });
      if (!pt.data.hit && !p.dead && dist(e.x, e.y, p.x, p.y) < e.r + p.r + 3) {
        pt.data.hit = 1;
        hurtPlayer(w, e.dmg * k.num('mul', 1.4), { fromX: e.x, fromY: e.y, knock: 210, source: e });
      }
      if (m.bx || m.by || pt.data.left! <= 0) {
        if (m.bx || m.by) {
          w.shake(4);
          w.sfx('slam');
          w.fxBurst(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, FROST, 12, 18);
        }
        pt.data.n = (pt.data.n ?? 0) + 1;
        pt.data.t1 = pt.t;
        pt.step = pt.data.n >= k.num('passes', 3) ? 3 : 0;
      }
    } else if (pt.step === 3 && pt.t >= pt.data.t1! + 0.55) k.end();
  },

  /**
   * The deathcharger falls: Corvane goes on foot (his `sprite` and `radius` change) and his chilling
   * aura begins: standing within `aura` of him chills and hurts (`mul` of his damage every half second).
   */
  'barrow:dismount': (w, e, _dt, k) => {
    const { pt } = k;
    if (pt.step === 0) {
      w.fxBurst(e.x, e.y - 6, FROST, 30, 26);
      w.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.7, size: 60, color: '#e8f6ff' });
      for (let i = 0; i < 10; i++) {
        const a = w.rand() * TAU;
        w.addFx({ kind: 'smoke', x: e.x + Math.cos(a) * 8, y: e.y + Math.sin(a) * 4, vx: Math.cos(a) * 30, vy: Math.sin(a) * 18 - 10, life: 0.9, size: 5, color: '#5a7a9a' });
      }
      w.sfx('crumble');
      w.shake(5);
      e.def = { ...e.def, sprite: k.str('sprite', e.def.sprite) };
      e.r = k.num('radius', e.r);
      const s = fight(w, e);
      s.aura = { r: k.num('aura', 42), mul: k.num('mul', 0.1), f: null };
      pt.step = 1;
    } else if (pt.t >= 0.9) k.end();
  },

  /** The cold around Corvane grows: a wider, harsher aura (`r`, `mul`). */
  'barrow:aura': (w, e, _dt, k) => {
    const { pt } = k;
    if (pt.step === 0) {
      const s = fight(w, e);
      s.aura = { r: k.num('r', 52), mul: k.num('mul', 0.12), f: s.aura?.f ?? null };
      w.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.6, size: s.aura.r + 10, color: FROST });
      w.sfx('freeze', 0.8);
      pt.step = 1;
    } else if (pt.t >= 0.4) k.end();
  },

  /**
   * Doom: a ring marks the hero and follows them for `carry` s (counting down), then the doom falls
   * where they stand: a circle of `r` that bursts after `fall` s for `mul` of his damage, raises the
   * dead (`raise`) from every grave inside it, and leaves spreading ice. Carry it away from the graves.
   */
  'barrow:doom': (w, e, _dt, k) => {
    const { pt } = k;
    const p = w.player;
    if (pt.step === 0) {
      const s = fight(w, e);
      const r = k.num('r', 46);
      const carry = k.num('carry', 5);
      const id = w.nextId;
      // a ring around the hero, not a circle under them: nothing lands until the doom falls
      w.addTelegraph({ shape: 'ring', x: p.x, y: p.y, r, r2: r - 5, angle: 0, len: 0, dur: carry, dmg: 0, knock: 0, tone: 'rift', owner: -1, linger: 0 });
      const ring = w.telegraphs.find((t) => t.id === id);
      if (ring) s.dooms.push({ ring, r, fall: k.num('fall', 0.9), mul: k.num('mul', 1.6), raise: k.str('raise', 'oathsworn-guard'), said: 99, glowT: 0 });
      graves(w, e, s);
      w.addFx({ kind: 'glow', x: e.x, y: e.y - 14, life: 0.7, size: 18, color: DOOM });
      w.addFx({ kind: 'zap', x: e.x, y: e.y - 14, x2: p.x, y2: p.y - 8, life: 0.35, size: 1, color: DOOM });
      w.text(p.x, p.y - 30, 'DOOM! Away from the graves!', DOOM, true);
      w.sfx('shadow', 0.8);
      pt.step = 1;
    } else if (pt.t >= 0.7) k.end();
  },

  /**
   * Corvane drives the runeblade into the floor: `count` circles of `r` (one under the hero) burst
   * after `wind` s, and each leaves a patch of ice that spreads (`grow` px a second, up to `max`) for
   * `life` s, chilling and hurting whoever stands on it.
   */
  'barrow:rime': (w, e, _dt, k) => {
    const { pt } = k;
    const p = w.player;
    const wind = k.num('wind', 1);
    if (pt.step === 0) {
      const s = fight(w, e);
      const count = k.num('count', 4);
      const r = k.num('r', 22);
      w.addFx({ kind: 'glow', x: e.x, y: e.y - 6, life: 0.6, size: 16, color: FROST });
      for (let i = 0; i < count; i++) {
        let x = p.x;
        let y = p.y;
        if (i > 0) {
          const a = w.rand() * TAU;
          const d = 34 + w.rand() * 40;
          x += Math.cos(a) * d;
          y += Math.sin(a) * d * 0.8;
        }
        const ti = tileAt(w.map, x, y);
        if (ti < 0 || w.map.room[ti] !== e.room + 1 || circleHitsWall(w.map, x, y, 4)) continue;
        const id = w.nextId;
        w.addTelegraph({ shape: 'circle', x, y, r, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1.1), status: CHILL, knock: 50, tone: 'enemy', owner: -1, linger: 0 });
        const tg = w.telegraphs.find((t) => t.id === id);
        w.after(wind, () => {
          if (!tg || tg.t < tg.dur - 0.05 || !alive(w, e)) return;
          for (let j = 0; j < 6; j++) {
            const a = (TAU * j) / 6;
            w.addFx({ kind: 'shard', x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 30 - 20, life: 0.4, size: 2, color: '#e8f6ff' });
          }
          addRime(w, e, s, x, y, 10, k.num('max', 36), k.num('grow', 5), k.num('life', 12), k.num('ice', 0.14));
        });
      }
      w.sfx('freeze', 0.8);
      w.shake(2);
      pt.step = 1;
    } else if (pt.t >= wind + 0.3) k.end();
  },
};
