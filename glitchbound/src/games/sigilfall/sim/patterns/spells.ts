import { dist, TAU } from '../../core/math';
import type { DmgType, StatusId } from '../../data/types';
import { circleHitsWall, moveCircle } from '../map';
import type { Enemy, Projectile, Telegraph } from '../types';
import type { World } from '../world';
import { onFloor, roomBox } from './arena';
import type { PatternFn, PatternKit } from './kit';

/**
 * Boss spells: ids start with 'spell:'. Every spell here is one boss's own (tests/sigilfall-boss-spells.test.ts keeps
 * it so): no two bosses fight alike. Each is cast in its boss's look (`look`, the shot's drawing: 'frost', 'holy',
 * 'shadow', 'water', 'poison', 'fire', 'rift', 'skull', 'spear', 'bolt', 'ball', 'web', 'flame'), `color`, damage type
 * (`type`), blow (`mul` of its own) and what the hit leaves on the hero (`st`, `stDur`, `stPow`).
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
 * - `sinkhole`: quicksand under the hero (slow to wade out of) that erupts.
 * - `pin`: a javelin that pins whoever it hits, and a blow on the pinned.
 * - `tether`: a chain from the boss to the hero that burns the harder the farther they stand.
 * - `constellation`: stars set round the hero, joined one to the next, line by line.
 * - `undertow`: the hero dragged toward the boss while it brings the sea down round itself.
 * - `eclipse`: everywhere burns but one circle of light drifting across the room.
 * - `gild`: coins that gild whoever they hit, a little more each time, until they are turned to gold.
 * - `sunspot`: a spot of sun that hunts the hero across the floor.
 * - `quills`: quills hung in the air round the hero that fly at them all at once.
 * - `cage`: a coffin closing round the hero, one side left open.
 * - `sequence`: vats boiling over one after another, in the order counted out.
 * - `hurl`: a buffet that flings whoever stands before the boss across the hall.
 * - `halves`: judgment on the half of the hall the hero stands in.
 * - `drain`: the boss drinks the hero's life while they stay in reach.
 * - `grief`: a keening that turns the hero around (their movement goes the other way).
 * - `pendulum`: a scythe swinging from the wall, back and forth across the room.
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

/* ------------------------------------------------------------ one boss's own */

/** Vizier Khepset: quicksand opens under the hero (they wade through it, slow), and erupts. */
const sinkhole: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const at = { x: p.x, y: p.y };
    const r = k.num('rr', 42);
    const time = k.num('time', 2.6);
    const c = color(k);
    mark(w, e, k, { shape: 'circle', x: at.x, y: at.y, r }, time, k.num('mul', 1.3));
    const t0 = w.time;
    const sink = (): void => {
      if (!fighting(w, e) || w.time - t0 >= time) return;
      if (!p.dead && dist(p.x, p.y, at.x, at.y) < r) {
        const chill = p.statuses.find((x) => x.id === 'chill');
        if (chill) {
          chill.power = Math.max(chill.power, 0.6);
          chill.t = Math.max(chill.t, 0.15);
        } else p.statuses.push({ id: 'chill', t: 0.15, power: 0.6, tick: 0 });
      }
      if (Math.floor(w.time * 8) !== Math.floor((w.time - 1 / 60) * 8)) {
        const a = w.rand() * TAU;
        w.addFx({ kind: 'spark', x: at.x + Math.cos(a) * r * 0.9, y: at.y + Math.sin(a) * r * 0.7, vx: -Math.cos(a) * 30, vy: -Math.sin(a) * 22, life: 0.6, size: 2, color: c });
      }
      w.after(0, sink);
    };
    w.after(0, sink);
    w.text(p.x, p.y - 30, 'Quicksand! Wade out!', '#fff2c0', false);
    return 0.5;
  });

/** Hallvor: a javelin that pins whoever it hits, and her halberd falls on the pinned. */
const pin: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const n = k.num('count', 1);
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(p.y - e.y, p.x - e.x) + (i - (n - 1) / 2) * 0.35;
      const q = shot(w, e, k, e.x, e.y - 6, a, k.num('speed', 230), { r: 4, life: 360, look: 'spear', status: { status: 'stun', dur: 0.8, power: 1 } });
      if (!q) continue;
      const watch = (): void => {
        if (!fighting(w, e)) return;
        if (!q.dead) {
          w.after(0, watch);
          return;
        }
        if (!p.dead && dist(q.x, q.y, p.x, p.y) < q.r + p.r + 6 && p.statuses.some((x) => x.id === 'stun')) {
          w.text(p.x, p.y - 30, 'Pinned!', '#e8f6ff', true);
          mark(w, e, k, { shape: 'circle', x: p.x, y: p.y, r: 22 }, 1, k.num('blow', 1.4));
        }
      };
      w.after(0, watch);
    }
    w.sfx('spear', 0.7);
    return 0.4;
  });

/** Elowen: a chain of dawn-light from her to the hero that burns the harder the farther they stand. */
const tether: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const time = k.num('time', 4);
    const beats = Math.round(time / 0.5);
    for (let j = 0; j < beats; j++) {
      w.after(j * 0.5, () => {
        if (!fighting(w, e) || p.dead) return;
        const d = dist(e.x, e.y, p.x, p.y);
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        mark(w, e, k, { shape: 'line', x: e.x, y: e.y, r2: 10, angle: a, len: d + 12 }, 0.5, k.num('mul', 0.18) * Math.min(3, Math.max(0.4, d / 60)));
        w.addFx({ kind: 'beam', x: e.x, y: e.y - 14, x2: p.x, y2: p.y - 10, life: 0.5, size: 1 + Math.min(3, d / 60), color: color(k) });
      });
    }
    w.text(p.x, p.y - 30, 'Chained to the dawn: the farther, the hotter!', '#fff2c0', false);
    return 0.5;
  });

/** Ilvane: stars set about the hero, then joined one to the next, line by line. */
const constellation: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const n = k.num('count', 5);
    const stars: { x: number; y: number }[] = [];
    const a0 = w.rand() * TAU;
    for (let i = 0; i < n; i++) {
      const a = a0 + (TAU * i * 2) / n;
      const d = 50 + w.rand() * 60;
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d * 0.8;
      if (onFloor(w, e, x, y, 2)) stars.push({ x, y });
    }
    for (const st of stars) w.addFx({ kind: 'glow', x: st.x, y: st.y - 4, life: 0.8 + stars.length * k.num('step', 0.35), size: 8, color: color(k) });
    stars.forEach((st, i) => {
      const nx = stars[(i + 1) % stars.length]!;
      w.after(0.4 + i * k.num('step', 0.35), () => {
        if (!fighting(w, e)) return;
        const a = Math.atan2(nx.y - st.y, nx.x - st.x);
        mark(w, e, k, { shape: 'line', x: st.x, y: st.y, r2: 14, angle: a, len: dist(st.x, st.y, nx.x, nx.y) }, k.num('dur', 0.8), k.num('mul', 1));
      });
    });
    return 0.4 + stars.length * k.num('step', 0.35) + 0.4;
  });

/** The Drowned Priestess: the undertow drags the hero toward her, and she brings the sea down round her. */
const undertow: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const time = k.num('time', 2.4);
    const pull = k.num('pull', 46);
    const r = k.num('rr', 58);
    mark(w, e, k, { shape: 'circle', x: e.x, y: e.y, r }, time, k.num('mul', 1.4));
    const t0 = w.time;
    const drag = (): void => {
      if (!fighting(w, e) || w.time - t0 >= time || p.dead) return;
      if (!p.dash) {
        const d = dist(p.x, p.y, e.x, e.y) || 1;
        const m = moveCircle(w.map, p.x, p.y, p.r, ((e.x - p.x) / d) * pull / 60, ((e.y - p.y) / d) * pull / 60);
        p.x = m.x;
        p.y = m.y;
      }
      if (Math.floor(w.time * 10) !== Math.floor((w.time - 1 / 60) * 10)) w.addFx({ kind: 'spark', x: p.x, y: p.y, vx: (e.x - p.x) * 0.6, vy: (e.y - p.y) * 0.6, life: 0.5, size: 2, color: color(k) });
      w.after(0, drag);
    };
    w.after(0, drag);
    w.text(p.x, p.y - 30, 'The undertow! Swim against it!', '#d8f6ff', false);
    return time;
  });

/** The Hallow King's Ash Crown, in his summer hour: the light goes out but for one drifting circle of summer; outside it, the ash burns. */
const eclipse: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const box = roomBox(w, e);
    const time = k.num('time', 6);
    const r = k.num('rr', 48);
    // the light drifts from one side of the room to the other, past where the hero stands
    const p = w.player;
    const across = box.x1 - box.x0 > box.y1 - box.y0;
    const from = across ? { x: box.x0 + 40, y: p.y } : { x: p.x, y: box.y0 + 40 };
    const to = across ? { x: box.x1 - 40, y: p.y } : { x: p.x, y: box.y1 - 40 };
    if (w.rand() < 0.5) [from.x, from.y, to.x, to.y] = [to.x, to.y, from.x, from.y];
    const beats = Math.round(time / 0.5);
    for (let j = 0; j < beats; j++) {
      w.after(0.6 + j * 0.5, () => {
        if (!fighting(w, e)) return;
        const t = j / Math.max(1, beats - 1);
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t;
        mark(w, e, k, { shape: 'donut', x, y, r: 900, r2: r }, 0.5, k.num('mul', 0.3));
        w.addFx({ kind: 'glow', x, y, life: 0.5, size: r * 0.8, color: '#fff2c0' });
        w.addFx({ kind: 'ring', x, y, life: 0.5, size: r, color: '#fff2c0' });
      });
    }
    w.text(p.x, p.y - 30, 'Eclipse! Keep to the light!', '#fff2c0', true);
    return 0.6 + time;
  });

const GILD = new WeakMap<Enemy, number[]>();
/** Maelis Crane: coins of cold ash-gold; every one that hits gilds the hero a little more, and four turn them to gold. */
const gild: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const n = k.num('count', 5);
    const spread = k.num('spread', 0.9);
    const a0 = Math.atan2(p.y - e.y, p.x - e.x);
    const coins: Projectile[] = [];
    for (let i = 0; i < n; i++) {
      const q = shot(w, e, k, e.x, e.y - 6, a0 - spread / 2 + (spread * i) / Math.max(1, n - 1), k.num('speed', 115), { look: 'ball' });
      if (q) coins.push(q);
    }
    const watch = (): void => {
      if (!fighting(w, e)) return;
      for (const q of [...coins]) {
        if (!q.dead) continue;
        coins.splice(coins.indexOf(q), 1);
        if (p.dead || dist(q.x, q.y, p.x, p.y) > q.r + p.r + 6 || p.iframe > 0) continue;
        const stacks = (GILD.get(e) ?? []).filter((t) => t > w.time);
        stacks.push(w.time + k.num('last', 6));
        if (stacks.length >= k.num('gold', 4)) {
          GILD.set(e, []);
          if (hurtPlayerShare(w, e, k.num('share', 0.2))) w.text(p.x, p.y - 30, 'Turned to gold!', color(k), true);
          p.statuses.push({ id: 'stun', t: 1.4, power: 1, tick: 0 });
          w.fxBurst(p.x, p.y - 8, color(k), 20, 14);
        } else {
          GILD.set(e, stacks);
          w.text(p.x, p.y - 28, `Gilded ×${stacks.length}`, color(k), false);
        }
      }
      if (coins.length) w.after(0, watch);
    };
    w.after(0, watch);
    w.sfx('coin', 0.7);
    return 0.5;
  });
const hurtPlayerShare = (w: World, e: Enemy, share: number): boolean => {
  const p = w.player;
  const d = Math.min(p.hp - 1, p.maxHp * share);
  if (d <= 0) return false;
  p.hp -= d;
  p.flash = 0.15;
  w.text(p.x, p.y - 18, `-${Math.round(d)}`, '#ff9a9a', false);
  void e;
  return true;
};

/** The Sun King: a spot of the noon sun that hunts the hero across the floor, burning where it stands. */
const sunspot: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const time = k.num('time', 3.5);
    const r = k.num('rr', 26);
    const speed = k.num('chase', 55);
    const at = { x: e.x, y: e.y };
    const beats = Math.round(time / 0.35);
    for (let j = 0; j < beats; j++) {
      w.after(j * 0.35, () => {
        if (!fighting(w, e)) return;
        const d = dist(at.x, at.y, p.x, p.y);
        if (d > 1) {
          const step = Math.min(d, speed * 0.35);
          at.x += ((p.x - at.x) / d) * step;
          at.y += ((p.y - at.y) / d) * step;
        }
        mark(w, e, k, { shape: 'circle', x: at.x, y: at.y, r }, 0.6, k.num('mul', 0.6));
        w.addFx({ kind: 'beam', x: at.x, y: at.y - 120, x2: at.x, y2: at.y, life: 0.35, size: 3, color: color(k) });
      });
    }
    return time + 0.4;
  });

/** The Royal Auditor: quills of red ink hang in the air round the hero, then all fly at once. */
const quills: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const n = k.num('count', 8);
    const ring0 = k.num('spread', 95);
    const hang = k.num('hang', 1.1);
    const held: Projectile[] = [];
    const a0 = w.rand() * TAU;
    for (let i = 0; i < n; i++) {
      const a = a0 + (TAU * i) / n;
      const x = p.x + Math.cos(a) * ring0;
      const y = p.y + Math.sin(a) * ring0 * 0.85;
      if (!onFloor(w, e, x, y, 2)) continue;
      const q = shot(w, e, k, x, y, 0, 0, { life: 9999, look: 'spear', r: 3.5 });
      if (q) held.push(q);
    }
    w.after(hang, () => {
      if (!fighting(w, e)) return;
      for (const q of held) {
        if (q.dead) continue;
        const a = Math.atan2(p.y - q.y, p.x - q.x);
        q.vx = Math.cos(a) * k.num('speed', 170);
        q.vy = Math.sin(a) * k.num('speed', 170);
        q.life = 320;
      }
      w.sfx('spear', 0.7);
    });
    return hang + 0.3;
  });

/** The Coffin Matron: a coffin closes round the hero, three walls and a lid, one side left open. */
const cage: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const h = k.num('size', 36);
    const open = Math.floor(w.rand() * 4);
    const sides = [
      { x: p.x - h, y: p.y - h, a: 0 },
      { x: p.x + h, y: p.y - h, a: Math.PI / 2 },
      { x: p.x + h, y: p.y + h, a: Math.PI },
      { x: p.x - h, y: p.y + h, a: -Math.PI / 2 },
    ];
    sides.forEach((sd, i) => {
      if (i === open) return;
      mark(w, e, k, { shape: 'line', x: sd.x, y: sd.y, r2: 14, angle: sd.a, len: h * 2 }, k.num('dur', 1.1), k.num('mul', 1));
    });
    // and the lid
    mark(w, e, k, { shape: 'circle', x: p.x, y: p.y, r: h * 0.7 }, k.num('dur', 1.1) + 0.5, k.num('mul', 1));
    w.text(p.x, p.y - 34, 'The coffin closes: out the open side!', '#e0ffe0', false);
    return k.num('dur', 1.1) + 0.6;
  });

/** Brother Pustule: the vats boil over one after another, in an order he counts out. */
const sequence: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const n = k.num('count', 6);
    const step = k.num('step', 0.45);
    const r = k.num('rr', 24);
    const spots: { x: number; y: number }[] = [];
    for (let tries = 0; tries < n * 8 && spots.length < n; tries++) {
      const a = w.rand() * TAU;
      const d = spots.length === 0 ? 0 : 30 + w.rand() * 80;
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d * 0.8;
      if (onFloor(w, e, x, y, 4) && spots.every((o) => dist(o.x, o.y, x, y) > r * 1.4)) spots.push({ x, y });
    }
    spots.forEach((sp, i) => {
      mark(w, e, k, { shape: 'circle', x: sp.x, y: sp.y, r }, 1 + i * step, k.num('mul', 0.95));
      w.text(sp.x, sp.y - 10, String(i + 1), color(k), true);
    });
    return 1 + n * step;
  });

/** Gloomwing: a buffet of its wings flings whoever stands before it across the hall. */
const hurl: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    const reach = k.num('reach', 90);
    const dur = k.num('dur', 0.7);
    mark(w, e, k, { shape: 'cone', x: e.x, y: e.y, r: reach, r2: 0.9, angle: a }, dur, k.num('mul', 0.6));
    w.after(dur, () => {
      if (!fighting(w, e) || p.dead || p.iframe > 0 || p.dash) return;
      const d = dist(e.x, e.y, p.x, p.y);
      let off = Math.abs(Math.atan2(p.y - e.y, p.x - e.x) - a) % TAU;
      if (off > Math.PI) off = TAU - off;
      if (d > reach + p.r || off > 0.9) return;
      // flung, in a few strides, until a wall stops them
      const fa = Math.atan2(p.y - e.y, p.x - e.x);
      for (let i = 0; i < 8; i++) {
        const m = moveCircle(w.map, p.x, p.y, p.r, Math.cos(fa) * 18, Math.sin(fa) * 18);
        p.x = m.x;
        p.y = m.y;
      }
      p.statuses.push({ id: 'stun', t: 0.5, power: 1, tick: 0 });
      w.text(p.x, p.y - 30, 'Flung!', color(k), true);
      w.shake(4);
    });
    w.sfx('rush', 0.7);
    return dur + 0.3;
  });

/** Sir Corvane: the barrow's judgment falls on one half of the hall: the half the hero stands in. */
const halves: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const box = roomBox(w, e);
    const across = w.rand() < 0.5;
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    const wide = Math.max(box.x1 - box.x0, box.y1 - box.y0) + 40;
    const dur = k.num('dur', 1.5);
    // the line through the middle, and the hero's side of it struck
    if (across) {
      const right = p.x > cx;
      mark(w, e, k, { shape: 'line', x: cx, y: cy, r2: wide, angle: right ? 0 : Math.PI, len: (box.x1 - box.x0) / 2 + 20 }, dur, k.num('mul', 1.3));
    } else {
      const down = p.y > cy;
      mark(w, e, k, { shape: 'line', x: cx, y: cy, r2: wide, angle: down ? Math.PI / 2 : -Math.PI / 2, len: (box.y1 - box.y0) / 2 + 20 }, dur, k.num('mul', 1.3));
    }
    w.text(p.x, p.y - 30, 'Judgment on this half of the hall!', '#d8e8ff', true);
    return dur + 0.2;
  });

/** Prior Vessant: his censer drinks the hero's life while they stay within its reach. */
const drain: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const p = w.player;
  const reach = k.num('reach', 150);
  if (pt.step === 0) {
    cast(w, e, k);
    w.text(p.x, p.y - 30, 'His censer drinks: get out of its reach!', '#e0ffe0', false);
    pt.data.next = 0.4;
    pt.step = 1;
  } else if (pt.t >= k.num('time', 3)) k.end();
  else if (pt.t >= pt.data.next!) {
    pt.data.next! += 0.5;
    const d = dist(e.x, e.y, p.x, p.y);
    if (!p.dead && d < reach) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      mark(w, e, k, { shape: 'line', x: e.x, y: e.y, r2: 12, angle: a, len: d + 12 }, 0.45, k.num('mul', 0.3));
      w.addFx({ kind: 'beam', x: p.x, y: p.y - 10, x2: e.x, y2: e.y - 16, life: 0.45, size: 2, color: color(k) });
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * k.num('heal', 0.004));
    }
  }
};

/** Lady Cendre: her keening rolls out from her; caught in it, grief turns the hero around (left is right, up is down). */
const grief: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const p = w.player;
    const r0 = k.num('inner', 40);
    const r1 = k.num('outer', 140);
    const dur = k.num('dur', 1);
    mark(w, e, k, { shape: 'donut', x: e.x, y: e.y, r: r1, r2: r0 }, dur, k.num('mul', 0.6));
    w.after(dur, () => {
      if (!fighting(w, e) || p.dead || p.iframe > 0) return;
      const d = dist(e.x, e.y, p.x, p.y);
      if (d < r0 - p.r || d > r1 + p.r) return;
      w.inverted = Math.max(w.inverted, k.num('time', 3.5));
      w.text(p.x, p.y - 30, 'Grief turns you around!', color(k), true);
    });
    return dur + 0.2;
  });

/** Vaelor: a scythe of souls swinging from the wall behind his throne, back and forth across the room. */
const pendulum: PatternFn = (w, e, _dt, k) =>
  windThen(w, e, k, () => {
    const box = roomBox(w, e);
    const top = w.player.y > e.y;
    const pivot = { x: (box.x0 + box.x1) / 2, y: top ? box.y0 + 6 : box.y1 - 6 };
    const down = top ? Math.PI / 2 : -Math.PI / 2;
    const len = (box.y1 - box.y0) * k.num('reach', 0.95);
    const amp = k.num('amp', 1);
    const time = k.num('time', 3.2);
    const period = k.num('period', 2);
    const width = k.num('width', 16);
    mark(w, e, k, { shape: 'line', x: pivot.x, y: pivot.y, r2: width, angle: down - amp, len }, 0.8, 0);
    const beats = Math.round(time / 0.15);
    for (let j = 0; j < beats; j++) {
      w.after(0.8 + j * 0.15, () => {
        if (!fighting(w, e)) return;
        const a = down - amp * Math.cos((TAU * j * 0.15) / period);
        mark(w, e, k, { shape: 'line', x: pivot.x, y: pivot.y, r2: width, angle: a, len }, 0.22, k.num('mul', 0.5));
        w.addFx({ kind: 'beam', x: pivot.x, y: pivot.y - 10, x2: pivot.x + Math.cos(a) * len, y2: pivot.y - 10 + Math.sin(a) * len, life: 0.18, size: 2, color: color(k) });
      });
    }
    return 0.8 + time;
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
  'spell:sinkhole': sinkhole,
  'spell:pin': pin,
  'spell:tether': tether,
  'spell:constellation': constellation,
  'spell:undertow': undertow,
  'spell:eclipse': eclipse,
  'spell:gild': gild,
  'spell:sunspot': sunspot,
  'spell:quills': quills,
  'spell:cage': cage,
  'spell:sequence': sequence,
  'spell:hurl': hurl,
  'spell:halves': halves,
  'spell:drain': drain,
  'spell:grief': grief,
  'spell:pendulum': pendulum,
};
