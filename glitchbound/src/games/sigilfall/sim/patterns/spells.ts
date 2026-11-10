import { dist, TAU } from '../../core/math';
import type { DmgType, StatusId } from '../../data/types';
import { circleHitsWall } from '../map';
import type { Enemy, Projectile, Telegraph } from '../types';
import type { World } from '../world';
import { onFloor, roomBox } from './arena';
import type { PatternFn, PatternKit } from './kit';

/**
 * Boss spells: ids start with 'spell:'. Shapes of attack a boss casts in its own colors, so that no two bosses fight
 * alike: each boss takes a few of these with its own look (`look`, the shot's drawing: 'frost', 'holy', 'shadow',
 * 'water', 'poison', 'fire', 'rift', 'skull', 'spear', 'bolt', 'ball', 'web', 'flame'), `color`, damage type (`type`),
 * blow (`mul` of its own) and what the hit leaves on the hero (`st`, `stDur`, `stPow`).
 *
 * - `ring`: rings of shots out from the boss, each with a gap to slip through, the next ring's gap elsewhere.
 * - `wall`: a wall of shots marching across the room at the hero, with a gap or two in it.
 * - `boomerang`: shots thrown out in a fan that stop and come back to the boss.
 * - `meteors`: impacts falling one after another along a line from the boss to where the hero stood.
 * - `crossfire`: lines crossing on the hero, struck all at once, then again turned.
 * - `orbit`: shots wheeling round the boss, spiralling outward, then flung away.
 * - `rain`: impacts falling about the room, some on the hero.
 * - `seekers`: slow shots that hunt the hero down.
 * - `mines`: traps set round the hero that go off when they come near, or when the fuse runs out.
 * - `fissure`: a crack that crawls after the hero across the floor.
 * - `pulse`: rings of ground round the boss bursting, every other one and then the rest.
 * - `lances`: lances from the walls of the room, aimed at the hero one after another.
 * - `vortex`: arms of power turning round the boss.
 * - `split`: a great slow shot that bursts into a ring of small ones.
 * - `blink`: the boss vanishes and strikes where it comes back (behind the hero, with `behind`).
 * - `bouncers`: shots that glance off the walls.
 * - `pools`: globs lobbed round the hero that leave the floor burning, freezing or rotting a while.
 */

/* ------------------------------------------------------------ the boss's own colors */

const look = (k: PatternKit): string => k.str('look', 'ball');
const color = (k: PatternKit): string => k.str('color', '#ffffff');
const dmgType = (k: PatternKit): DmgType => k.str('type', 'arcane') as DmgType;
function status(k: PatternKit): { status: StatusId; dur: number; power: number } | undefined {
  const id = k.str('st', '');
  return id ? { status: id as StatusId, dur: k.num('stDur', 1.5), power: k.num('stPow', 0.35) } : undefined;
}

/** One of the boss's shots, from (x, y) at angle `a`. Returns it. */
function shot(w: World, e: Enemy, k: PatternKit, x: number, y: number, a: number, speed: number, o: Partial<Projectile> = {}): Projectile | null {
  const before = w.projectiles.length;
  const st = status(k);
  w.spawnProjectile({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: k.num('r', 4), life: k.num('range', 340), dmg: e.dmg * k.num('mul', 0.85), type: dmgType(k), spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: look(k), color: color(k), hostile: true, homing: 0, child: false, knock: 0, ...(st ? { status: st } : {}), ...o });
  return w.projectiles.length > before ? w.projectiles[w.projectiles.length - 1]! : null;
}

/** Ground marked to strike after `dur` s (its blow `mul` of the boss's), and the boss's colors where it lands. */
function mark(w: World, e: Enemy, k: PatternKit, t: Pick<Telegraph, 'shape' | 'x' | 'y'> & Partial<Telegraph>, dur: number, mul: number): void {
  const st = status(k);
  const tone = k.str('tone', 'enemy') as Telegraph['tone'];
  w.addTelegraph({ r: 0, r2: 0, angle: 0, len: 0, knock: 30, tone, owner: -1, linger: 0, dmg: e.dmg * mul, ...(st ? { status: st } : {}), dur, ...t });
  const c = color(k);
  w.after(dur, () => {
    if (!e.dead && e.boss && e.boss.dying <= 0 && w.enemies.includes(e)) w.fxBurst(t.x, t.y, c, 8, Math.max(8, (t.r ?? 12) * 0.6));
  });
}

const cast = (w: World, e: Enemy, k: PatternKit, size = 24): void => {
  w.addFx({ kind: 'glow', x: e.x, y: e.y - 12, life: 0.5, size, color: color(k) });
  w.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.5, size: size + 10, color: color(k) });
};

const fighting = (w: World, e: Enemy): boolean => !e.dead && !!e.boss && e.boss.dying <= 0 && w.enemies.includes(e);

/** Steps the pattern through a wind-up (`wind` s, the boss's glow), then `fire`, then rests `after` s. */
function windThen(w: World, e: Enemy, k: PatternKit, fire: () => number): void {
  const { pt } = k;
  if (pt.step === 0) {
    cast(w, e, k);
    w.sfx('enemyWindup', 0.5);
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= k.num('wind', 0.55)) {
    pt.data.end = pt.t + fire();
    pt.step = 2;
  } else if (pt.step === 2 && pt.t >= pt.data.end!) k.end();
}

/* ------------------------------------------------------------ the shapes */

const ring: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const n = k.num('count', 16);
    const gap = k.num('gap', 3);
    const waves = k.num('waves', 2);
    const every = k.num('every', 0.45);
    for (let j = 0; j < waves; j++) {
      w.after(j * every, () => {
        if (!fighting(w, e)) return;
        const hole = Math.floor(w.rand() * n);
        for (let i = 0; i < n; i++) {
          if ((i - hole + n) % n < gap) continue;
          shot(w, e, k, e.x, e.y - 6, (TAU * (i + (j % 2) * 0.5)) / n, k.num('speed', 95));
        }
        w.sfx('soul', 0.45);
      });
    }
    return waves * every + 0.3;
  });

const wall: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const box = roomBox(w, e);
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    const spacing = k.num('spacing', 20);
    const half = Math.hypot(box.x1 - box.x0, box.y1 - box.y0) / 2;
    const gaps = Array.from({ length: k.num('gaps', 2) }, () => (w.rand() - 0.5) * half * 1.2);
    const gapW = k.num('gapW', 44);
    for (let s = -half; s <= half; s += spacing) {
      if (gaps.some((g) => Math.abs(s - g) < gapW / 2)) continue;
      const x = e.x + nx * s;
      const y = e.y + ny * s;
      if (x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1 || circleHitsWall(w.map, x, y, 3)) continue;
      shot(w, e, k, x, y, a, k.num('speed', 70), { life: 700 });
    }
    w.sfx('rush', 0.5);
    return 0.5;
  });

const boomerang: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const n = k.num('count', 3);
    const spread = k.num('spread', 0.6);
    const a0 = Math.atan2(p.y - e.y, p.x - e.x);
    const thrown: Projectile[] = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + (n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1));
      const q = shot(w, e, k, e.x, e.y - 6, a, k.num('speed', 150), { life: 900 });
      if (q) thrown.push(q);
    }
    const out = k.num('out', 0.75);
    w.after(out, () => {
      for (const q of thrown) {
        if (q.dead) continue;
        const b = Math.atan2(e.y - q.y, e.x - q.x);
        const v = k.num('back', 170);
        q.vx = Math.cos(b) * v;
        q.vy = Math.sin(b) * v;
        q.hit = [];
        q.life = Math.min(q.life, dist(q.x, q.y, e.x, e.y) + 20);
        w.addFx({ kind: 'ring', x: q.x, y: q.y, life: 0.3, size: 8, color: q.color });
      }
    });
    w.sfx('rush', 0.5);
    return out + 0.6;
  });

const meteors: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const n = k.num('count', 6);
    const gap = k.num('gap', 0.2);
    const r = k.num('rr', 20);
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    const far = dist(e.x, e.y, p.x, p.y) + 40;
    for (let i = 1; i <= n; i++) {
      const d = (far * i) / n;
      const x = e.x + Math.cos(a) * d;
      const y = e.y + Math.sin(a) * d;
      w.after((i - 1) * gap, () => {
        if (!fighting(w, e) || !onFloor(w, e, x, y, 2)) return;
        const dur = k.num('fall', 0.85);
        mark(w, e, k, { shape: 'circle', x, y, r }, dur, k.num('mul', 1));
        const fall = Math.min(dur, 0.45);
        w.after(dur - fall, () => w.addFx({ kind: 'ember', x, y: y - 110, vx: 0, vy: 110 / fall, life: fall, size: 4, color: color(k) }));
      });
    }
    return (n - 1) * gap + 0.4;
  });

const crossfire: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const lines = k.num('lines', 3);
    const len = k.num('len', 320);
    const width = k.num('width', 18);
    const dur = k.num('dur', 0.9);
    const twice = k.num('twice', 1);
    const at = { x: p.x, y: p.y };
    const turn = w.rand() * Math.PI;
    for (let j = 0; j <= twice; j++) {
      w.after(j * (dur + 0.15), () => {
        if (!fighting(w, e)) return;
        for (let i = 0; i < lines; i++) {
          const a = turn + (Math.PI * i) / lines + (j * Math.PI) / lines / 2;
          mark(w, e, k, { shape: 'line', x: at.x - (Math.cos(a) * len) / 2, y: at.y - (Math.sin(a) * len) / 2, r2: width, angle: a, len }, dur, k.num('mul', 1.1));
        }
      });
    }
    w.sfx('enemyWindup', 0.6);
    return (twice + 1) * (dur + 0.15);
  });

const orbit: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const n = k.num('count', 6);
    const time = k.num('time', 3);
    const spin = k.num('spin', 2.4);
    const grow = k.num('grow', 34);
    const r0 = k.num('r0', e.r + 12);
    const balls = Array.from({ length: n }, () => shot(w, e, k, e.x, e.y, 0, 0, { life: 9999, r: k.num('r', 5) })).filter((q): q is Projectile => !!q);
    const t0 = w.time;
    const a0 = w.rand() * TAU;
    const turn = (): void => {
      if (!fighting(w, e)) {
        for (const q of balls) q.dead = true;
        return;
      }
      const t = w.time - t0;
      balls.forEach((q, i) => {
        if (q.dead) return;
        const a = a0 + spin * t + (TAU * i) / n;
        const rr = r0 + grow * t;
        if (t >= time) {
          // flung outward at the last
          q.vx = Math.cos(a) * 110;
          q.vy = Math.sin(a) * 110;
          q.life = 260;
          return;
        }
        q.x = e.x + Math.cos(a) * rr;
        q.y = e.y - 4 + Math.sin(a) * rr * 0.85;
        q.vx = 0;
        q.vy = 0;
        q.hit = [];
      });
      if (t < time) w.after(0, turn);
    };
    w.after(0, turn);
    w.sfx('soul', 0.5);
    return 0.4;
  });

const rain: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const box = roomBox(w, e);
    const n = k.num('count', 10);
    const onHero = k.num('onHero', 2);
    const time = k.num('time', 2);
    const r = k.num('rr', 18);
    for (let i = 0; i < n; i++) {
      w.after((time * i) / n, () => {
        if (!fighting(w, e)) return;
        let x = p.x;
        let y = p.y;
        if (i % Math.max(1, Math.floor(n / Math.max(1, onHero))) !== 0) {
          for (let tries = 0; tries < 8; tries++) {
            x = box.x0 + 20 + w.rand() * (box.x1 - box.x0 - 40);
            y = box.y0 + 20 + w.rand() * (box.y1 - box.y0 - 40);
            if (onFloor(w, e, x, y, 4)) break;
          }
        }
        if (!onFloor(w, e, x, y, 2)) return;
        const dur = k.num('fall', 1);
        mark(w, e, k, { shape: 'circle', x, y, r }, dur, k.num('mul', 0.9));
        w.after(Math.max(0, dur - 0.4), () => w.addFx({ kind: 'ember', x, y: y - 100, vx: 0, vy: 250, life: 0.4, size: 3, color: color(k) }));
      });
    }
    return time + 0.3;
  });

const seekers: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const n = k.num('count', 4);
    const a0 = w.rand() * TAU;
    for (let i = 0; i < n; i++) {
      const a = a0 + (TAU * i) / n;
      shot(w, e, k, e.x + Math.cos(a) * (e.r + 6), e.y - 6 + Math.sin(a) * (e.r + 6), a, k.num('speed', 55), { homing: k.num('homing', 1.4), life: k.num('range', 460), r: k.num('r', 5) });
    }
    w.sfx('soul', 0.6);
    return 0.4;
  });

const mines: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const n = k.num('count', 5);
    const ring0 = k.num('spread', 70);
    const fuse = k.num('fuse', 3.5);
    const trig = k.num('trig', 22);
    const blast = k.num('blast', 34);
    const c = color(k);
    const a0 = w.rand() * TAU;
    for (let i = 0; i < n; i++) {
      const a = a0 + (TAU * i) / n;
      const x = p.x + Math.cos(a) * ring0;
      const y = p.y + Math.sin(a) * ring0 * 0.8;
      if (!onFloor(w, e, x, y, 4)) continue;
      const set = w.time;
      let fxT = 0;
      let gone = false;
      const go = (): void => {
        gone = true;
        mark(w, e, k, { shape: 'circle', x, y, r: blast }, 0.45, k.num('mul', 1.1));
      };
      const watch = (): void => {
        if (gone || !fighting(w, e)) return;
        const t = w.time - set;
        fxT -= 1 / 60;
        if (fxT <= 0) {
          fxT = t > fuse - 1 ? 0.12 : 0.3;
          w.addFx({ kind: 'glow', x, y: y - 2, life: 0.2, size: 6, color: c });
          w.addFx({ kind: 'ring', x, y, life: 0.25, size: trig, color: c });
        }
        if (t >= fuse || (t > 0.8 && !p.dead && dist(p.x, p.y, x, y) < trig + p.r)) go();
        else w.after(0, watch);
      };
      w.addFx({ kind: 'burst', x, y, life: 0.3, size: 8, color: c });
      w.after(0, watch);
    }
    w.sfx('enemyWindup', 0.5);
    return 0.4;
  });

const fissure: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const n = k.num('count', 8);
    const step = k.num('step', 0.18);
    const stride = k.num('stride', 22);
    const r = k.num('rr', 16);
    const head = { x: e.x, y: e.y };
    for (let i = 0; i < n; i++) {
      w.after(i * step, () => {
        if (!fighting(w, e)) return;
        const a = Math.atan2(p.y - head.y, p.x - head.x);
        const nx = head.x + Math.cos(a) * stride;
        const ny = head.y + Math.sin(a) * stride;
        if (!onFloor(w, e, nx, ny, 2)) return;
        head.x = nx;
        head.y = ny;
        mark(w, e, k, { shape: 'circle', x: nx, y: ny, r }, k.num('dur', 0.5), k.num('mul', 0.9));
        w.addFx({ kind: 'rubble', x: nx, y: ny, life: 0.5, size: 3, color: color(k) });
      });
    }
    w.sfx('slam', 0.4);
    return n * step + 0.3;
  });

const pulse: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const rings = k.num('rings', 4);
    const band = k.num('band', 34);
    const gap = k.num('gap', 0.7);
    const dur = k.num('dur', 0.9);
    const at = { x: e.x, y: e.y };
    for (let pass = 0; pass < 2; pass++) {
      w.after(pass * gap, () => {
        if (!fighting(w, e)) return;
        for (let i = pass; i < rings; i += 2) mark(w, e, k, { shape: i === 0 ? 'circle' : 'donut', x: at.x, y: at.y, r: (i + 1) * band, r2: i * band }, dur, k.num('mul', 1));
      });
    }
    w.sfx('enemyWindup', 0.6);
    return gap + dur + 0.2;
  });

const lances: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const box = roomBox(w, e);
    const n = k.num('count', 4);
    const stagger = k.num('stagger', 0.3);
    const width = k.num('width', 14);
    const dur = k.num('dur', 0.85);
    const span = Math.hypot(box.x1 - box.x0, box.y1 - box.y0);
    for (let i = 0; i < n; i++) {
      w.after(i * stagger, () => {
        if (!fighting(w, e)) return;
        // from a point on the room's edge, through where the hero stands now
        const side = Math.floor(w.rand() * 4);
        const u = w.rand();
        const x = side < 2 ? box.x0 + u * (box.x1 - box.x0) : side === 2 ? box.x0 + 4 : box.x1 - 4;
        const y = side === 0 ? box.y0 + 4 : side === 1 ? box.y1 - 4 : box.y0 + u * (box.y1 - box.y0);
        const a = Math.atan2(p.y - y, p.x - x);
        mark(w, e, k, { shape: 'line', x, y, r2: width, angle: a, len: span }, dur, k.num('mul', 1.1));
        w.after(dur, () => fighting(w, e) && w.addFx({ kind: 'beam', x, y: y - 8, x2: x + Math.cos(a) * span, y2: y - 8 + Math.sin(a) * span, life: 0.25, size: 2, color: color(k) }));
      });
    }
    return (n - 1) * stagger + dur + 0.1;
  });

const vortex: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const arms = k.num('arms', 2);
    const time = k.num('time', 3);
    const spin = k.num('spin', 1.1) * (w.rand() < 0.5 ? -1 : 1);
    const len = k.num('len', 230);
    const width = k.num('width', 14);
    const a0 = w.rand() * TAU;
    const warn = k.num('warnT', 0.8);
    // first the arms, shown and harmless, then turning and burning
    for (let i = 0; i < arms; i++) mark(w, e, k, { shape: 'line', x: e.x, y: e.y, r2: width, angle: a0 + (TAU * i) / arms, len }, warn, 0);
    const beats = Math.round(time / 0.2);
    for (let j = 0; j < beats; j++) {
      w.after(warn + j * 0.2, () => {
        if (!fighting(w, e)) return;
        for (let i = 0; i < arms; i++) {
          const a = a0 + spin * j * 0.2 + (TAU * i) / arms;
          mark(w, e, k, { shape: 'line', x: e.x, y: e.y, r2: width, angle: a, len }, 0.3, k.num('mul', 0.55));
          w.addFx({ kind: 'beam', x: e.x, y: e.y - 10, x2: e.x + Math.cos(a) * len, y2: e.y - 10 + Math.sin(a) * len, life: 0.2, size: 2, color: color(k) });
        }
      });
    }
    return warn + time + 0.2;
  });

const split: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    const big = shot(w, e, k, e.x, e.y - 6, a, k.num('speed', 80), { r: k.num('bigR', 9), dmg: e.dmg * k.num('bigMul', 1.3), life: 600 });
    w.after(k.num('fuse', 1.2), () => {
      if (!big || big.dead || !fighting(w, e)) return;
      big.dead = true;
      const n = k.num('count', 10);
      for (let i = 0; i < n; i++) shot(w, e, k, big.x, big.y, (TAU * i) / n + w.rand() * 0.2, k.num('small', 110), { r: 3.5 });
      w.fxBurst(big.x, big.y, color(k), 14, 14);
      w.sfx('shard', 0.5);
    });
    return 0.5;
  });

const blink: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const p = w.player;
  if (pt.step === 0) {
    w.fxBurst(e.x, e.y - 8, color(k), 18, 18);
    w.sfx('blink');
    pt.data.hide = 1;
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= k.num('gone', 0.4)) {
    // back behind the hero (from where they face), or somewhere near them
    const behind = k.num('behind', 0) > 0;
    let tx = e.x;
    let ty = e.y;
    for (let i = 0; i < 14; i++) {
      const a = behind && i < 6 ? p.aim + Math.PI + (w.rand() - 0.5) * 0.8 : w.rand() * TAU;
      const d = k.num('dist', behind ? 34 : 80) * (0.85 + w.rand() * 0.3);
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d;
      if (onFloor(w, e, x, y, e.r + 2)) {
        tx = x;
        ty = y;
        break;
      }
    }
    e.x = tx;
    e.y = ty;
    pt.data.hide = 0;
    w.fxBurst(e.x, e.y - 8, color(k), 18, 18);
    mark(w, e, k, { shape: 'circle', x: e.x, y: e.y, r: k.num('rr', 34) }, k.num('wind', 0.55), k.num('mul', 1.2));
    pt.data.t1 = pt.t;
    pt.step = 2;
  } else if (pt.step === 2 && pt.t >= pt.data.t1! + k.num('wind', 0.55) + 0.3) k.end();
};

const bouncers: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const n = k.num('count', 5);
    const spread = k.num('spread', 0.9);
    const a0 = Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = 0; i < n; i++) {
      const a = a0 + (n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1));
      shot(w, e, k, e.x, e.y - 6, a, k.num('speed', 120), { bounce: k.num('bounces', 2), life: k.num('range', 700) });
    }
    w.sfx('rush', 0.5);
    return 0.4;
  });

const pools: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const n = k.num('count', 3);
    const r = k.num('rr', 24);
    const c = color(k);
    for (let i = 0; i < n; i++) {
      const a = w.rand() * TAU;
      const d = i === 0 ? 0 : 40 + w.rand() * 50;
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d * 0.8;
      if (!onFloor(w, e, x, y, 4)) continue;
      const fly = 0.7;
      w.addFx({ kind: 'beam', x: e.x, y: e.y - 18, x2: x, y2: y, life: fly, size: 1.5, color: c });
      mark(w, e, k, { shape: 'circle', x, y, r }, fly, k.num('mul', 0.8));
      w.after(fly, () => {
        if (!fighting(w, e)) return;
        const st = status(k);
        w.spawnField({ x, y, r, dur: k.num('life', 6), tick: 0.5, dmg: e.dmg * k.num('tickMul', 0.18), type: dmgType(k), look: k.str('pool', 'poison') as never, hostile: true, depth: 0, spec: null, onHit: false, ...(st ? { status: st } : {}) });
      });
    }
    w.sfx('enemyWindup', 0.5);
    return 0.9;
  });

export const SPELL_PATTERNS: Record<string, PatternFn> = {
  'spell:ring': ring,
  'spell:wall': wall,
  'spell:boomerang': boomerang,
  'spell:meteors': meteors,
  'spell:crossfire': crossfire,
  'spell:orbit': orbit,
  'spell:rain': rain,
  'spell:seekers': seekers,
  'spell:mines': mines,
  'spell:fissure': fissure,
  'spell:pulse': pulse,
  'spell:lances': lances,
  'spell:vortex': vortex,
  'spell:split': split,
  'spell:blink': blink,
  'spell:bouncers': bouncers,
  'spell:pools': pools,
};
