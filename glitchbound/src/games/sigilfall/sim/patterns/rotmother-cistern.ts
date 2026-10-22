import { dist, TAU } from '../../core/math';
import { hurtPlayer } from '../combat';
import { castRay, circleHitsWall, moveCircle, TILE, tileAt } from '../map';
import type { Enemy, Field } from '../types';
import type { World } from '../world';
import type { PatternFn } from './kit';

/**
 * Boss attacks of the Rotmother's Cistern: ids start with 'rot:'. Brother Pustule's censer clouds,
 * and the Rot-Mother's floor: the bile she spits, pours and drags stays on the ground as pools that
 * hurt and slow, and her swell makes every pool surge outward, so the pit closes in the longer the
 * fight goes (a phase change drains it). Every pool is shown before it lands.
 */

const BILE = '#a8d04a';
const BILE_DARK = '#5a7a2a';

/** The bile pools on the floor (fields this file spawned), so the swell can find them. */
const POOLS = new WeakSet<Field>();
/** At most this many pools at once: the oldest dries up when a new one would go past it. */
const MAX_POOLS = 22;
/** A pool's damage every half second, as a share of the boss's hit (the `tick` knob changes it). */
const POOL_TICK = 0.26;

/** Whether a point is open floor of the boss's room. */
function inRoom(w: World, e: Enemy, x: number, y: number): boolean {
  const i = tileAt(w.map, x, y);
  return i >= 0 && !w.map.solid[i] && w.map.room[i] === e.room + 1;
}

/** A telegraph's id is the world's next id at the moment it is added. */
function telegraph(w: World, t: Parameters<World['addTelegraph']>[0]): number {
  const id = w.nextId;
  w.addTelegraph(t);
  return id;
}

const live = (w: World, id: number): boolean => w.telegraphs.some((t) => t.id === id && !t.dead);

/** The boss is gone (beaten, or its room reset after the hero fell). */
const gone = (w: World, e: Enemy): boolean => e.dead || !e.boss || e.boss.dying > 0 || !w.enemies.includes(e);

/**
 * A pool of bile on the floor: it hurts and slows whoever stands in it, for `dur` seconds. Pools dry
 * up when the boss is gone.
 */
function pool(w: World, e: Enemy, x: number, y: number, r: number, dur: number, mul: number): void {
  if (!inRoom(w, e, x, y)) return;
  const mine = w.fields.filter((f) => POOLS.has(f));
  if (mine.length >= MAX_POOLS) {
    const old = mine.reduce((a, b) => (a.t < b.t ? a : b));
    old.t = Math.min(old.t, 0.4);
  }
  w.spawnField({ x, y, r, dur, tick: 0.5, dmg: e.dmg * mul, type: 'poison', status: { status: 'chill', dur: 0.6, power: 0.35 }, look: 'poison', hostile: true, depth: 0, spec: null, onHit: false });
  const f = w.fields[w.fields.length - 1];
  if (f) POOLS.add(f);
  watch(w, e);
}

/** Checks twice a second whether the boss is gone, and dries its pools and its brew when it is. */
function watch(w: World, e: Enemy): void {
  const m = e.boss!.misc;
  if (m.watch) return;
  m.watch = 1;
  const tick = (): void => {
    if (gone(w, e)) {
      for (const f of w.fields) if (POOLS.has(f) || f.id === m.brew) f.t = Math.min(f.t, 0.6);
      m.watch = 0;
      return;
    }
    w.after(0.5, tick);
  };
  w.after(0.5, tick);
}

/** The Rot-Mother's brew: a pool around her in the pit (only a look: it hurts no one). */
function brew(w: World, e: Enemy): void {
  const m = e.boss!.misc;
  if (m.brew !== undefined && w.fields.some((f) => f.id === m.brew)) return;
  if (m.brewX === undefined) {
    m.brewX = e.x;
    m.brewY = e.y + 3;
  }
  m.brew = w.nextId;
  w.spawnField({ x: m.brewX, y: m.brewY!, r: e.r + 12, dur: 9999, tick: 999, dmg: 0, type: 'poison', look: 'poison', hostile: false, depth: 0, spec: null, onHit: false });
  watch(w, e);
}

/** Green spatter where bile lands. */
function splash(w: World, x: number, y: number, r: number): void {
  w.fxBurst(x, y, BILE, 10, r * 0.6);
  for (let i = 0; i < 5; i++) {
    const a = w.rand() * TAU;
    w.addFx({ kind: 'smoke', x: x + Math.cos(a) * r * 0.4, y: y + Math.sin(a) * r * 0.3, vx: Math.cos(a) * 14, vy: Math.sin(a) * 8 - 6, life: 0.6 + w.rand() * 0.3, size: 3 + Math.floor(w.rand() * 3), color: w.rand() < 0.5 ? BILE : BILE_DARK });
  }
}

/** A gob of bile flying in an arc from (x0, y0) to (x1, y1), landing after `t` seconds (looks only). */
function lob(w: World, x0: number, y0: number, x1: number, y1: number, t: number): void {
  // sparks fall at 220 px/s², so this throw lands where it should
  for (let i = 0; i < 3; i++) {
    const k = 0.92 + i * 0.04;
    w.addFx({ kind: 'spark', x: x0, y: y0, vx: (x1 - x0) / (t * k), vy: (y1 - y0) / (t * k) - 110 * t * k, life: t * k, size: 3 - i, color: i ? BILE_DARK : BILE });
  }
}

/** Where the casks of brew in the boss's room stand (2x2 groups of barrels), worked out once. */
function vats(w: World, e: Enemy): { x: number; y: number }[] {
  const m = e.boss!.misc;
  if (m.vats === undefined) {
    const tiles = w.map.roomTiles[e.room] ?? [];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const i of tiles) {
      x0 = Math.min(x0, i % w.map.w);
      x1 = Math.max(x1, i % w.map.w);
      y0 = Math.min(y0, Math.floor(i / w.map.w));
      y1 = Math.max(y1, Math.floor(i / w.map.w));
    }
    const casks = w.map.markers.filter((pm) => pm.marker.kind === 'prop' && pm.marker.prop === 'barrel' && pm.tx >= x0 && pm.tx <= x1 && pm.ty >= y0 && pm.ty <= y1);
    // neighbouring casks make one vat
    const groups: { tx: number; ty: number }[][] = [];
    for (const c of casks) {
      const g = groups.find((gr) => gr.some((o) => Math.abs(o.tx - c.tx) <= 1 && Math.abs(o.ty - c.ty) <= 1));
      if (g) g.push(c);
      else groups.push([c]);
    }
    m.vats = groups.length;
    groups.forEach((gr, i) => {
      m[`vat${i}x`] = (gr.reduce((a, c) => a + c.tx, 0) / gr.length + 0.5) * TILE;
      m[`vat${i}y`] = (gr.reduce((a, c) => a + c.ty, 0) / gr.length + 0.5) * TILE;
    });
  }
  return Array.from({ length: m.vats }, (_, i) => ({ x: m[`vat${i}x`]!, y: m[`vat${i}y`]! }));
}

export const ROTMOTHER_CISTERN_PATTERNS: Record<string, PatternFn> = {
  /**
   * Brother Pustule swings his censer high: clouds of plague come down on and around the hero, one
   * after another, each shown as a circle first, and hang there for `cloud` seconds.
   * Knobs: count, r, wind, gap (between clouds), mul, cloud.
   */
  'rot:miasma': (w, e, _dt, k) => {
    const { pt } = k;
    const p = w.player;
    const count = k.num('count', 4);
    const gap = k.num('gap', 0.22);
    const wind = k.num('wind', 1);
    const r = k.num('r', 26);
    if (pt.step === 0) {
      w.sfx('whirl', 0.6);
      e.face = Math.cos(k.aimAt()) < 0 ? Math.PI : 0;
      pt.step = 1;
    }
    const placed = pt.data.n ?? 0;
    if (placed < count && pt.t >= 0.2 + placed * gap) {
      let x = p.x;
      let y = p.y;
      if (placed > 0) {
        // the rest fall around the hero, a little ahead of where they are going
        const a = w.rand() * TAU;
        const d = 24 + w.rand() * 34;
        x += Math.cos(a) * d + p.vx * 0.3;
        y += Math.sin(a) * d + p.vy * 0.3;
      }
      if (inRoom(w, e, x, y) && !circleHitsWall(w.map, x, y, 4)) {
        const id = telegraph(w, { shape: 'circle', x, y, r, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 0.9), status: { status: 'poison', dur: 3, power: e.dmg * 0.12 }, knock: 30, tone: 'enemy', owner: -1, linger: 0 });
        w.addFx({ kind: 'smoke', x: e.x + (w.rand() - 0.5) * 10, y: e.y - 14, vx: (w.rand() - 0.5) * 20, vy: -20, life: 0.7, size: 4, color: BILE });
        const cloud = k.num('cloud', 3.5);
        w.after(wind - 0.03, () => {
          if (!live(w, id) || gone(w, e)) return;
          splash(w, x, y, r);
          w.sfx('puff', 0.5);
          w.spawnField({ x, y, r: r * 0.9, dur: cloud, tick: 0.5, dmg: e.dmg * k.num('tick', 0.2), type: 'poison', status: { status: 'poison', dur: 2, power: e.dmg * 0.1 }, look: 'poison', hostile: true, depth: 0, spec: null, onHit: false });
        });
      }
      pt.data.n = placed + 1;
    }
    if (pt.t >= 0.2 + count * gap + 0.3) k.end();
  },

  /**
   * The Rot-Mother spits gobs of bile: one at the hero, the rest around them (`spread`), in
   * `volleys`. Each landing is shown as a circle; where it lands a pool stays for `pool` seconds.
   * Knobs: count, volleys, gap, r, wind, mul, pool, spread, tick (the pool's damage per tick).
   */
  'rot:bile': (w, e, _dt, k) => {
    const { pt } = k;
    const p = w.player;
    brew(w, e);
    const volleys = k.num('volleys', 1);
    const gap = k.num('gap', 0.6);
    if (pt.step === 0) {
      w.addFx({ kind: 'glow', x: e.x, y: e.y - 12, life: 0.4, size: 14, color: BILE });
      w.sfx('squish', 0.7);
      e.face = Math.cos(k.aimAt()) < 0 ? Math.PI : 0;
      pt.step = 1;
    }
    const fired = pt.data.f ?? 0;
    if (fired < volleys && pt.t >= 0.35 + fired * gap) {
      const count = k.num('count', 3);
      const r = k.num('r', 16);
      const wind = k.num('wind', 1.2);
      const spread = k.num('spread', 46);
      const life = k.num('pool', 22);
      const tick = k.num('tick', POOL_TICK);
      const a0 = w.rand() * TAU;
      for (let i = 0; i < count; i++) {
        let x = p.x;
        let y = p.y;
        if (i > 0) {
          const a = a0 + (TAU * i) / Math.max(1, count - 1) + (w.rand() - 0.5) * 0.6;
          const d = spread * (0.6 + w.rand() * 0.6);
          x += Math.cos(a) * d;
          y += Math.sin(a) * d * 0.8;
        }
        if (!inRoom(w, e, x, y)) continue;
        const id = telegraph(w, { shape: 'circle', x, y, r, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1), knock: 50, tone: 'enemy', owner: -1, linger: 0 });
        lob(w, e.x, e.y - 14, x, y, wind);
        w.after(wind - 0.03, () => {
          if (!live(w, id) || gone(w, e)) return;
          splash(w, x, y, r);
          w.sfx('squish', 0.5);
          pool(w, e, x, y, r, life, tick);
        });
      }
      w.sfx('sling', 0.6);
      pt.data.f = fired + 1;
    }
    if (pt.t >= 0.35 + (volleys - 1) * gap + 0.55) k.end();
  },

  /**
   * The brew rises: every bile pool on the floor surges outward by `grow` (up to `max`). Each surge is
   * shown as a circle the size the pool will be; inside it when it fills, you are hit. With no pools
   * down, bile wells up from the drains instead (`count` new pools around the hero).
   * Knobs: grow, max, wind, mul, extend (seconds added to each pool's life), count.
   */
  'rot:swell': (w, e, _dt, k) => {
    const { pt } = k;
    const p = w.player;
    const wind = k.num('wind', 1.2);
    if (pt.step === 0) {
      brew(w, e);
      const grow = k.num('grow', 10);
      const max = k.num('max', 40);
      const extend = k.num('extend', 6);
      const mul = k.num('mul', 0.8);
      const mine = w.fields.filter((f) => POOLS.has(f) && f.t > wind + 0.2 && inRoom(w, e, f.x, f.y));
      if (mine.length) {
        for (const f of mine) {
          const r = Math.min(max, f.r + grow);
          const id = telegraph(w, { shape: 'circle', x: f.x, y: f.y, r, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * mul, status: { status: 'poison', dur: 3, power: e.dmg * 0.12 }, knock: 60, tone: 'enemy', owner: -1, linger: 0 });
          w.after(wind - 0.03, () => {
            if (!live(w, id) || gone(w, e) || !w.fields.includes(f)) return;
            f.r = r;
            f.t += extend;
            f.dur = Math.max(f.dur, f.t);
            splash(w, f.x, f.y, r);
          });
          // the pool bubbles while it rises
          for (let i = 0; i < 4; i++) {
            w.after(i * 0.25, () => {
              if (w.fields.includes(f)) w.fxBurst(f.x + (w.rand() - 0.5) * f.r, f.y + (w.rand() - 0.5) * f.r * 0.6, BILE, 2, 4);
            });
          }
        }
      } else {
        // nothing to swell: the drains well up around the hero
        const count = k.num('count', 3);
        for (let i = 0; i < count; i++) {
          let x = p.x;
          let y = p.y;
          if (i > 0) {
            const a = w.rand() * TAU;
            x += Math.cos(a) * (30 + w.rand() * 30);
            y += Math.sin(a) * (24 + w.rand() * 24);
          }
          if (!inRoom(w, e, x, y)) continue;
          const id = telegraph(w, { shape: 'circle', x, y, r: 18, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * mul, knock: 40, tone: 'enemy', owner: -1, linger: 0 });
          w.after(wind - 0.03, () => {
            if (!live(w, id) || gone(w, e)) return;
            splash(w, x, y, 18);
            pool(w, e, x, y, 18, 18, k.num('tick', POOL_TICK));
          });
        }
      }
      if (!e.boss!.misc.risen) {
        e.boss!.misc.risen = 1;
        w.text(e.x, e.y - e.r - 16, 'THE BREW RISES!', '#c8f07a', true);
      }
      w.sfx('quake', 0.6);
      w.shake(2);
      pt.step = 1;
    } else if (pt.t >= wind + 0.3) k.end();
  },

  /**
   * The vats tip: `vats` casks of brew in the room each pour a stream along a line toward the hero
   * (shown for `wind` seconds), and leave a row of bile pools along it. In a room without casks the
   * Rot-Mother pours from her own mouth.
   * Knobs: vats, wind, width, len, mul, puddle (pool radius), pdur, spacing.
   */
  'rot:pour': (w, e, _dt, k) => {
    const { pt } = k;
    const p = w.player;
    if (pt.step === 0) {
      brew(w, e);
      const wind = k.num('wind', 1.3);
      const width = k.num('width', 26);
      const puddle = k.num('puddle', 13);
      const pdur = k.num('pdur', 12);
      const spacing = k.num('spacing', 44);
      const all = vats(w, e);
      // the casks nearest the hero tip first, but only those with a clear pour at them
      const order = all
        .map((v) => ({ v, a: Math.atan2(p.y - v.y, p.x - v.x), d: dist(p.x, p.y, v.x, v.y) }))
        .sort((a, b) => a.d - b.d)
        .filter(({ v, a }) => {
          const sx = v.x + Math.cos(a) * 28;
          const sy = v.y + Math.sin(a) * 28;
          return !circleHitsWall(w.map, sx, sy, 2);
        });
      const from = order.length ? order.slice(0, k.num('vats', 1)).map(({ v, a }) => ({ x: v.x + Math.cos(a) * 28, y: v.y + Math.sin(a) * 28, a, vx: v.x, vy: v.y })) : [{ x: e.x, y: e.y, a: k.aimAt(), vx: e.x, vy: e.y - 10 }];
      for (const s of from) {
        const end = castRay(w.map, s.x, s.y, 2, s.a, k.num('len', 300));
        const len = Math.max(30, dist(s.x, s.y, end.x, end.y));
        const id = telegraph(w, { shape: 'line', x: s.x, y: s.y, r: 0, r2: width, angle: s.a, len, dur: wind, dmg: e.dmg * k.num('mul', 1.5), status: { status: 'poison', dur: 3, power: e.dmg * 0.12 }, knock: 90, tone: 'enemy', owner: -1, linger: 0.25 });
        // the cask rocks and drips while the line shows
        for (let i = 0; i < 6; i++) {
          w.after(i * (wind / 6), () => {
            if (live(w, id)) w.addFx({ kind: 'smoke', x: s.vx + (w.rand() - 0.5) * 14, y: s.vy - 10, vx: (w.rand() - 0.5) * 16, vy: 18, life: 0.5, size: 3, color: BILE });
          });
        }
        w.after(wind - 0.03, () => {
          if (!live(w, id) || gone(w, e)) return;
          w.sfx('whirl', 0.7);
          w.shake(3);
          for (let d = spacing * 0.5; d < len; d += spacing) {
            const x = s.x + Math.cos(s.a) * d;
            const y = s.y + Math.sin(s.a) * d;
            splash(w, x, y, puddle);
            pool(w, e, x, y, puddle, pdur, k.num('tick', POOL_TICK));
          }
        });
      }
      w.text(e.x, e.y - e.r - 16, 'THE VATS!', '#c8f07a', true);
      w.sfx('windup', 0.7);
      pt.step = 1;
    } else if (pt.t >= 0.8) k.end();
  },

  /**
   * The plague breath: a long cone at the hero, shown for `wind` seconds, that hits and poisons; with
   * `breaths` above 1 she turns and breathes again where the hero went.
   * Knobs: breaths, r, arc (half-angle), wind, mul, gap.
   */
  'rot:breath': (w, e, _dt, k) => {
    const { pt } = k;
    const r = k.num('r', 110);
    const arc = k.num('arc', 0.5);
    const wind = k.num('wind', 1.1);
    if (pt.step === 0) {
      brew(w, e);
      const a = k.aimAt();
      pt.data.a = a;
      pt.data.t0 = pt.t;
      telegraph(w, { shape: 'cone', x: e.x, y: e.y - 4, r, r2: arc, angle: a, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1.4), status: { status: 'poison', dur: 4, power: e.dmg * 0.18 }, knock: 70, tone: 'enemy', owner: -1, linger: 0 });
      e.face = Math.cos(a) < 0 ? Math.PI : 0;
      w.addFx({ kind: 'glow', x: e.x + Math.cos(a) * 8, y: e.y - 12, life: wind, size: 10, color: BILE });
      w.sfx('beamCharge', 0.6);
      pt.step = 1;
    } else if (pt.step === 1 && pt.t >= pt.data.t0! + wind) {
      const a = pt.data.a!;
      for (let i = 0; i < 26; i++) {
        const b = a + (w.rand() - 0.5) * arc * 2;
        const s = 60 + w.rand() * 110;
        w.addFx({ kind: 'smoke', x: e.x + Math.cos(b) * 10, y: e.y - 8 + Math.sin(b) * 10, vx: Math.cos(b) * s, vy: Math.sin(b) * s, life: 0.5 + w.rand() * 0.4, size: 3 + Math.floor(w.rand() * 4), color: w.rand() < 0.6 ? BILE : BILE_DARK });
      }
      w.sfx('puff', 0.8);
      w.shake(2);
      pt.data.n = (pt.data.n ?? 0) + 1;
      pt.data.t1 = pt.t;
      pt.step = pt.data.n >= k.num('breaths', 1) ? 2 : 3;
    } else if (pt.step === 3 && pt.t >= pt.data.t1! + k.num('gap', 0.3)) pt.step = 0;
    else if (pt.step === 2 && pt.t >= pt.data.t1! + 0.5) k.end();
  },

  /**
   * She drags herself out of the pit: a heave along a lane at the hero (shown for `wind` seconds, as
   * wide as she is), crushing what she slides over and leaving bile pools in her wake; `count` heaves.
   * Knobs: count, wind, len, speed, mul, spacing, puddle, pdur.
   */
  'rot:drag': (w, e, dt, k) => {
    const { pt } = k;
    const p = w.player;
    const count = k.num('count', 2);
    if (pt.step === 0) {
      const a = k.aimAt();
      const end = castRay(w.map, e.x, e.y, e.r, a, k.num('len', 130));
      const len = dist(e.x, e.y, end.x, end.y);
      pt.data.n = (pt.data.n ?? 0) + 1;
      if (len < 20) {
        // no room to heave this way
        if (pt.data.n >= count) k.end();
        return;
      }
      pt.data.a = a;
      pt.data.len = len;
      pt.data.left = len;
      pt.data.drop = 0;
      pt.data.hit = 0;
      pt.data.t0 = pt.t;
      telegraph(w, { shape: 'line', x: e.x, y: e.y, r: 0, r2: e.r * 2 + 6, angle: a, len: len + e.r, dur: k.num('wind', 0.8), dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
      e.face = Math.cos(a) < 0 ? Math.PI : 0;
      w.sfx('snort', 0.9);
      pt.step = 1;
    } else if (pt.step === 1 && pt.t >= pt.data.t0! + k.num('wind', 0.8)) {
      w.sfx('rush');
      pt.step = 2;
    } else if (pt.step === 2) {
      const a = pt.data.a!;
      const step = Math.min(pt.data.left!, k.num('speed', 150) * dt);
      const m = moveCircle(w.map, e.x, e.y, e.r, Math.cos(a) * step, Math.sin(a) * step);
      e.x = m.x;
      e.y = m.y;
      e.walkT += dt;
      pt.data.left! -= step;
      pt.data.drop! += step;
      const spacing = k.num('spacing', 24);
      if (pt.data.drop! >= spacing) {
        pt.data.drop = 0;
        pool(w, e, e.x - Math.cos(a) * e.r * 0.5, e.y - Math.sin(a) * e.r * 0.5 + 4, k.num('puddle', 14), k.num('pdur', 16), k.num('tick', POOL_TICK));
      }
      if (w.rand() < 0.5) w.addFx({ kind: 'smoke', x: e.x - Math.cos(a) * e.r, y: e.y + e.r * 0.5, life: 0.4, size: 4, color: BILE_DARK });
      if (!pt.data.hit && !p.dead && dist(e.x, e.y, p.x, p.y) < e.r + p.r + 3) {
        pt.data.hit = 1;
        hurtPlayer(w, e.dmg * k.num('mul', 1.4), { fromX: e.x, fromY: e.y, knock: 190, source: e });
      }
      if (m.bx || m.by || pt.data.left! <= 0.5) {
        splash(w, e.x, e.y + 4, e.r + 6);
        w.sfx('slam', 0.8);
        w.shake(4);
        pt.data.t1 = pt.t;
        pt.step = 3;
      }
    } else if (pt.step === 3 && pt.t >= pt.data.t1! + 0.35) {
      if (pt.data.n! >= count) k.end();
      else pt.step = 0;
    }
  },
};
