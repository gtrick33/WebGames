import { dist, inLine, pickWeighted, TAU } from '../core/math';
import type { PatternUse } from '../data/bosses';
import { hasStatus, hurtPlayer } from './combat';
import { castRay, circleHitsWall, flowStep, K, lineOfSight, moveCircle, TILE, tileAt } from './map';
import { EXTRA_PATTERNS } from './patterns';
import type { Enemy } from './types';
import type { World } from './world';

/**
 * The boss framework: phases (by health), a rest between patterns, and patterns built from the same
 * pieces (telegraphs, projectiles, waves, summons). Each pattern is a small state machine that runs
 * for a few seconds; a new boss is a new list of patterns in data/bosses.ts.
 */

export function updateBoss(w: World, e: Enemy, dt: number): void {
  const b = e.boss!;
  const p = w.player;
  if (b.dying > 0) {
    b.dying -= dt;
    if (w.rand() < 0.5) w.fxBurst(e.x + (w.rand() - 0.5) * 20, e.y - 6 + (w.rand() - 0.5) * 24, '#ff6ae0', 3, 10);
    if (b.dying <= 0) w.bossFinished(e);
    return;
  }
  tickPhase(w, e);
  if (b.shift > 0) {
    b.shift -= dt;
    return;
  }
  if (b.dazed > 0) {
    b.dazed -= dt;
    return;
  }
  // the collapsing arena: outside the light hurts
  if (b.collapse > 0) {
    b.collapse = Math.max(96, b.collapse - dt * 3);
    if (!p.dead && dist(p.x, p.y, b.cx, b.cy) > b.collapse) {
      b.misc.tick = (b.misc.tick ?? 0) - dt;
      if ((b.misc.tick ?? 0) <= 0) {
        b.misc.tick = 0.5;
        hurtPlayer(w, Math.max(4, p.maxHp * 0.06), {});
      }
    }
  }
  const phase = b.def.phases[b.phase]!;
  for (const k of Object.keys(b.cds)) b.cds[k] = Math.max(0, b.cds[k]! - dt);
  if (b.pattern) {
    runPattern(w, e, dt);
    return;
  }
  // between patterns: walk toward the hero (Morgrave drifts at a distance)
  b.rest -= dt;
  const d = dist(e.x, e.y, p.x, p.y);
  const keep = b.def.floats ? 70 : 24;
  if (!p.dead && d > keep) {
    const los = lineOfSight(w.map, e.x, e.y, p.x, p.y);
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    const st = los ? { x: Math.cos(a), y: Math.sin(a) } : (flowStep(w.map, w.flow, e.x, e.y) ?? { x: 0, y: 0 });
    const chill = e.statuses.find((s) => s.id === 'chill');
    const sp = phase.speed * (chill ? 1 - chill.power : 1) * e.speedMul;
    const r = moveCircle(w.map, e.x, e.y, e.r, st.x * sp * dt, st.y * sp * dt);
    e.x = r.x;
    e.y = r.y;
    e.walkT += dt;
    e.face = st.x < 0 ? Math.PI : 0;
  }
  if (b.rest <= 0 && !p.dead) {
    const next = b.queue.shift() ?? choose(w, e);
    if (next) startPattern(e, next);
    else b.rest = 0.3;
  }
}

/** Enters the next phase when health drops past it. */
function tickPhase(w: World, e: Enemy): void {
  const b = e.boss!;
  const next = b.def.phases[b.phase + 1];
  if (!next || e.hp > e.maxHp * next.at) return;
  b.phase += 1;
  b.pattern = null;
  b.shift = 1.4;
  b.queue = [...(next.enter ?? [])];
  b.rest = 0.2;
  w.clearHostile();
  w.emit({ t: 'bossPhase', banner: next.banner ?? '' });
  w.sfx('roar');
  w.shake(5);
  w.fxBurst(e.x, e.y, '#ff3fd2', 24, 40);
}

function choose(w: World, e: Enemy): PatternUse | null {
  const b = e.boss!;
  const phase = b.def.phases[b.phase]!;
  // a charge needs a clear lane: with a pillar in the way the boss walks round it instead
  const clear = lineOfSight(w.map, e.x, e.y, w.player.x, w.player.y);
  const ok = phase.patterns.filter(
    (u) =>
      (b.cds[u.id] ?? 0) <= 0 &&
      (clear || (u.id !== 'charge' && u.id !== 'tripleCharge')) &&
      (u.id !== 'summon' || w.enemies.filter((x) => !x.dead && !x.boss && x.room === e.room).length < 4),
  );
  if (!ok.length) return null;
  return pickWeighted(ok, (u) => u.w, w.rand());
}

function startPattern(e: Enemy, use: PatternUse): void {
  const b = e.boss!;
  b.pattern = { use, t: 0, step: 0, data: {} };
  b.cds[use.id] = use.cd;
}

function endPattern(w: World, e: Enemy): void {
  const b = e.boss!;
  const phase = b.def.phases[b.phase]!;
  b.pattern = null;
  b.rest = phase.rest[0] + w.rand() * (phase.rest[1] - phase.rest[0]);
}

const num = (use: PatternUse, key: string, dflt: number): number => {
  const v = use.p?.[key];
  return typeof v === 'number' ? v : dflt;
};

const str = (use: PatternUse, key: string, dflt: string): string => {
  const v = use.p?.[key];
  return typeof v === 'string' ? v : dflt;
};

/** One frame of the running pattern. */
function runPattern(w: World, e: Enemy, dt: number): void {
  const b = e.boss!;
  const pt = b.pattern!;
  const p = w.player;
  const u = pt.use;
  pt.t += dt;
  const aimAt = (): number => Math.atan2(p.y - e.y, p.x - e.x);
  switch (u.id) {
    case 'charge':
    case 'tripleCharge': {
      // knobs: count, wind, len (longest lane), speed, mul (contact damage), stun (0: a wall doesn't daze)
      const total = num(u, 'count', u.id === 'tripleCharge' ? 3 : 1);
      const wind = num(u, 'wind', u.id === 'tripleCharge' ? 0.55 : 0.8);
      // step 0: aim and show the lane; step 1: rush
      if (pt.step === 0) {
        if (pt.t === dt) {
          const a = aimAt();
          pt.data.a = a;
          const end = castRay(w.map, e.x, e.y, e.r, a, num(u, 'len', 260));
          pt.data.len = Math.max(30, dist(e.x, e.y, end.x, end.y));
          w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: e.r * 2 + 6, angle: a, len: pt.data.len + e.r, dur: wind, dmg: 0, knock: 0, tone: 'enemy', owner: e.id, linger: 0 });
          e.face = Math.cos(a) < 0 ? Math.PI : 0;
          w.sfx('snort', 0.8);
        }
        if (pt.t >= wind) {
          pt.step = 1;
          pt.t = 0;
          pt.data.hit = 0;
          w.sfx('rush');
        }
      } else {
        const a = pt.data.a!;
        const step = num(u, 'speed', 290) * dt;
        const r = moveCircle(w.map, e.x, e.y, e.r, Math.cos(a) * step, Math.sin(a) * step);
        e.x = r.x;
        e.y = r.y;
        pt.data.len! -= step;
        w.addFx({ kind: 'smoke', x: e.x - Math.cos(a) * e.r, y: e.y + e.r * 0.6, life: 0.4, size: 4, color: '#b9a58a' });
        if (!pt.data.hit && !p.dead && dist(e.x, e.y, p.x, p.y) < e.r + p.r + 3) {
          pt.data.hit = 1;
          hurtPlayer(w, e.dmg * num(u, 'mul', 1.35), { fromX: e.x, fromY: e.y, knock: 190, source: e });
        }
        if (r.bx || r.by || pt.data.len! <= 0) {
          const wall = r.bx || r.by;
          pt.data.done = (pt.data.done ?? 0) + 1;
          if (wall) {
            w.shake(4);
            w.sfx('slam');
            w.fxBurst(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, '#a89070', 14, 20);
          }
          if (pt.data.done! >= total) {
            const stun = num(u, 'stun', 1.4);
            if (wall && stun > 0) {
              b.dazed = stun;
              w.text(e.x, e.y - e.r - 10, 'STUNNED', '#ffe066', true);
            }
            endPattern(w, e);
          } else {
            pt.step = 0;
            pt.t = 0;
          }
        }
      }
      break;
    }
    case 'stomp':
    case 'slam': {
      const r = u.id === 'stomp' ? 46 : 44;
      if (pt.step === 0) {
        w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r, r2: 0, angle: 0, len: 0, dur: 0.95, dmg: e.dmg * 1.3, knock: 150, tone: 'enemy', owner: e.id, linger: 0 });
        pt.step = 1;
      } else if (pt.step === 1 && pt.t >= 0.95) {
        w.shake(4);
        w.fxBurst(e.x, e.y + 6, '#a89070', 18, r);
        w.sfx('slam');
        pt.step = 2;
      } else if (pt.step === 2 && pt.t >= 1.3) endPattern(w, e);
      break;
    }
    case 'slamRings': {
      if (pt.step === 0) {
        w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: 36, r2: 0, angle: 0, len: 0, dur: 0.85, dmg: e.dmg * 1.3, knock: 150, tone: 'enemy', owner: e.id, linger: 0 });
        pt.step = 1;
      } else if (pt.step === 1 && pt.t >= 0.85) {
        w.shake(4);
        w.sfx('slam');
        w.spawnWave(e.x, e.y, 95, 190, 8, e.dmg);
        pt.step = 2;
      } else if (pt.step === 2 && pt.t >= 1.25) {
        w.spawnWave(e.x, e.y, 95, 190, 8, e.dmg);
        pt.step = 3;
      } else if (pt.step === 3 && pt.t >= 1.8) endPattern(w, e);
      break;
    }
    case 'gore': {
      if (pt.step === 0) {
        const a = aimAt();
        pt.data.a = a;
        w.addTelegraph({ shape: 'cone', x: e.x, y: e.y, r: 40, r2: 0.75, angle: a, len: 0, dur: 0.5, dmg: e.dmg * 1.1, knock: 140, tone: 'enemy', owner: e.id, linger: 0 });
        pt.step = 1;
      } else if (pt.t >= 0.5 && pt.step === 1) {
        w.addFx({ kind: 'slash', x: e.x, y: e.y, a: pt.data.a!, a2: 1.5, life: 0.18, size: 40, color: '#ffb0a0', r2: 1 });
        w.sfx('enemySwing');
        pt.step = 2;
      } else if (pt.t >= 0.8) endPattern(w, e);
      break;
    }
    case 'spearFan': {
      const count = num(u, 'count', 3);
      if (pt.step === 0) {
        pt.data.a = aimAt();
        for (let i = 0; i < count; i++) {
          const a = pt.data.a + (count === 1 ? 0 : -0.5 + (1 * i) / (count - 1));
          w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: 6, angle: a, len: 120, dur: 0.6, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
        }
        pt.step = 1;
      } else if (pt.step === 1 && pt.t >= 0.6) {
        for (let i = 0; i < count; i++) {
          const a = pt.data.a! + (count === 1 ? 0 : -0.5 + (1 * i) / (count - 1));
          w.spawnProjectile({ x: e.x, y: e.y - 4, vx: Math.cos(a) * 175, vy: Math.sin(a) * 175, r: 3.5, life: 300, dmg: e.dmg, type: 'physical', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'spear', color: '#e8e0c8', hostile: true, homing: 0, child: false, knock: 0 });
        }
        w.sfx('spear');
        pt.step = 2;
      } else if (pt.step === 2 && pt.t >= 1) endPattern(w, e);
      break;
    }
    case 'soulVolley': {
      const count = num(u, 'count', 5);
      const waves = num(u, 'waves', 2);
      const fired = pt.data.f ?? 0;
      if (fired < waves && pt.t >= 0.5 + fired * 0.5) {
        const base = aimAt() + (fired % 2 ? 0.09 : 0);
        for (let i = 0; i < count; i++) {
          const a = base - 0.5 + (1 * i) / (count - 1);
          w.spawnProjectile({ x: e.x, y: e.y - 8, vx: Math.cos(a) * 92, vy: Math.sin(a) * 92, r: 4, life: 320, dmg: e.dmg * 0.9, type: 'arcane', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'skull', color: '#9cff9c', hostile: true, homing: 0.35, child: false, knock: 0 });
        }
        w.sfx('soul');
        pt.data.f = fired + 1;
      }
      if (fired === 0 && pt.t < dt * 1.5) w.addFx({ kind: 'glow', x: e.x, y: e.y - 8, life: 0.5, size: 14, color: '#9cff9c' });
      if (pt.t >= 0.6 + waves * 0.5) endPattern(w, e);
      break;
    }
    case 'graveGrasp': {
      const count = num(u, 'count', 4);
      const placed = pt.data.n ?? 0;
      if (placed < count && pt.t >= placed * 0.16) {
        let x = p.x;
        let y = p.y;
        if (placed > 0) {
          const a = w.rand() * TAU;
          const r = 26 + w.rand() * 30;
          x += Math.cos(a) * r;
          y += Math.sin(a) * r;
        }
        if (!circleHitsWall(w.map, x, y, 4)) w.addTelegraph({ shape: 'circle', x, y, r: 22, r2: 0, angle: 0, len: 0, dur: 1, dmg: e.dmg, status: { status: 'chill', dur: 1.5, power: 0.5 }, knock: 30, tone: 'rift', owner: -1, linger: 0 });
        pt.data.n = placed + 1;
      }
      if (pt.t >= 1.3 + count * 0.16) endPattern(w, e);
      break;
    }
    case 'summon': {
      if (pt.step === 0) {
        w.addFx({ kind: 'glow', x: e.x, y: e.y, life: 0.8, size: 26, color: '#ff3fd2' });
        w.sfx('summon');
        pt.step = 1;
      } else if (pt.step === 1 && pt.t >= 0.8) {
        const list = (u.p?.enemies as string[] | undefined) ?? ['skeleton'];
        list.forEach((id, i) => {
          const a = (TAU * i) / list.length + w.rand();
          w.spawnAdd(id, e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40, e.room);
        });
        pt.step = 2;
      } else if (pt.step === 2 && pt.t >= 1.2) endPattern(w, e);
      break;
    }
    case 'roar': {
      if (pt.step === 0) {
        w.sfx('roar');
        w.shake(5);
        w.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.5, size: 70, color: '#ffffff' });
        if (!p.dead && dist(e.x, e.y, p.x, p.y) < 70) {
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          p.vx += Math.cos(a) * 220;
          p.vy += Math.sin(a) * 220;
        }
        pt.step = 1;
      } else if (pt.t >= 1) endPattern(w, e);
      break;
    }
    case 'teleport': {
      if (pt.step === 0) {
        b.shift = 0;
        w.fxBurst(e.x, e.y, '#ff3fd2', 16, 20);
        w.sfx('blink');
        pt.step = 1;
        pt.data.hide = 1;
      } else if (pt.step === 1 && pt.t >= 0.5) {
        let tx = b.cx;
        let ty = b.cy;
        if (!num(u, 'center', 0)) {
          for (let i = 0; i < 12; i++) {
            const a = w.rand() * TAU;
            const r = 50 + w.rand() * 70;
            const x = b.cx + Math.cos(a) * r;
            const y = b.cy + Math.sin(a) * r * 0.7;
            if (!circleHitsWall(w.map, x, y, e.r + 2) && dist(x, y, p.x, p.y) > 70) {
              tx = x;
              ty = y;
              break;
            }
          }
        }
        e.x = tx;
        e.y = ty;
        w.fxBurst(e.x, e.y, '#ff3fd2', 16, 20);
        pt.step = 2;
        pt.data.hide = 0;
      } else if (pt.step === 2 && pt.t >= 0.8) endPattern(w, e);
      break;
    }
    case 'riftSpiral': {
      const arms = num(u, 'arms', 3);
      const time = num(u, 'time', 3);
      pt.data.emit = (pt.data.emit ?? 0) - dt;
      if (pt.t > 0.5 && pt.t < 0.5 + time && pt.data.emit <= 0) {
        pt.data.emit = 0.13;
        const base = (pt.data.rot = (pt.data.rot ?? w.rand() * TAU) + 0.32);
        for (let i = 0; i < arms; i++) {
          const a = base + (TAU * i) / arms;
          w.spawnProjectile({ x: e.x, y: e.y - 6, vx: Math.cos(a) * 78, vy: Math.sin(a) * 78, r: 3.5, life: 260, dmg: e.dmg * 0.75, type: 'arcane', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'riftOrb', color: '#ff3fd2', hostile: true, homing: 0, child: false, knock: 0 });
        }
        if (Math.floor(pt.t * 4) !== Math.floor((pt.t - dt) * 4)) w.sfx('riftShot', 0.35);
      }
      if (pt.t < 0.5 && pt.t < dt * 1.5) w.addFx({ kind: 'glow', x: e.x, y: e.y - 6, life: 0.5, size: 18, color: '#ff3fd2' });
      if (pt.t >= 0.9 + time) endPattern(w, e);
      break;
    }
    case 'riftBeams': {
      const beams = num(u, 'beams', 4);
      if (pt.step === 0) {
        const a0 = aimAt();
        for (let i = 0; i < beams; i++) {
          const a = a0 + (TAU * i) / beams;
          w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: 14, angle: a, len: 320, dur: 1.05, dmg: e.dmg * 1.4, knock: 60, tone: 'rift', owner: -1, linger: 0.3 });
        }
        w.sfx('beamCharge');
        pt.step = 1;
      } else if (pt.step === 1 && pt.t >= 1.05) {
        w.sfx('beam');
        w.shake(3);
        pt.step = 2;
      } else if (pt.step === 2 && pt.t >= 1.6) endPattern(w, e);
      break;
    }
    case 'riftNova': {
      if (pt.step === 0) {
        const inner = (b.misc.nova = ((b.misc.nova ?? 0) + 1) % 2) === 0;
        if (inner) w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: 62, r2: 0, angle: 0, len: 0, dur: 1.6, dmg: e.dmg * 2, knock: 160, tone: 'rift', owner: e.id, linger: 0 });
        else w.addTelegraph({ shape: 'donut', x: e.x, y: e.y, r: 200, r2: 42, angle: 0, len: 0, dur: 1.6, dmg: e.dmg * 2, knock: 0, tone: 'rift', owner: e.id, linger: 0 });
        w.text(e.x, e.y - e.r - 14, inner ? 'GET AWAY!' : 'GET CLOSE!', '#ff9af0', true);
        w.sfx('beamCharge');
        pt.step = 1;
      } else if (pt.step === 1 && pt.t >= 1.6) {
        w.shake(5);
        w.sfx('rift');
        pt.step = 2;
      } else if (pt.step === 2 && pt.t >= 2) endPattern(w, e);
      break;
    }
    case 'collapse': {
      if (pt.step === 0) {
        b.collapse = 170;
        w.emit({ t: 'banner', text: 'The arena is collapsing', sub: 'Stay inside the light' });
        pt.step = 1;
      } else if (pt.t >= 0.6) endPattern(w, e);
      break;
    }
    case 'cleave': {
      // heavy swings in front (an axe, two knives, a cutlass): each steps in (`lunge`), aims at the hero,
      // shows its cone for `wind` seconds and lands; `swings` of them in a row
      const swings = num(u, 'swings', 1);
      const wind = num(u, 'wind', 0.7);
      const r = num(u, 'r', 50);
      const arc = num(u, 'arc', 0.9);
      if (pt.step === 0) {
        const lunge = num(u, 'lunge', 0);
        const s0 = (pt.data.s0 ??= pt.t);
        if (lunge > 0 && pt.t - s0 < 0.16 && !p.dead && dist(e.x, e.y, p.x, p.y) > e.r + p.r + 8) {
          const a = aimAt();
          const m = moveCircle(w.map, e.x, e.y, e.r, Math.cos(a) * (lunge / 0.16) * dt, Math.sin(a) * (lunge / 0.16) * dt);
          e.x = m.x;
          e.y = m.y;
          e.walkT += dt;
          break;
        }
        delete pt.data.s0;
        const a = aimAt();
        pt.data.a = a;
        pt.data.t0 = pt.t;
        w.addTelegraph({ shape: 'cone', x: e.x, y: e.y, r, r2: arc, angle: a, len: 0, dur: wind, dmg: e.dmg * num(u, 'mul', 1.4), knock: 150, tone: 'enemy', owner: e.id, linger: 0 });
        e.face = Math.cos(a) < 0 ? Math.PI : 0;
        w.sfx('windup', 0.5);
        pt.step = 1;
      } else if (pt.step === 1 && pt.t >= pt.data.t0! + wind) {
        w.addFx({ kind: 'slash', x: e.x, y: e.y, a: pt.data.a!, a2: arc * 2, life: 0.2, size: r, color: '#ffb0a0', r2: 1 });
        w.sfx('swingBig');
        w.shake(2);
        pt.data.n = (pt.data.n ?? 0) + 1;
        pt.data.t1 = pt.t;
        pt.step = pt.data.n >= swings ? 2 : 3;
      } else if (pt.step === 3 && pt.t >= pt.data.t1! + num(u, 'gap', 0.12)) pt.step = 0;
      else if (pt.step === 2 && pt.t >= pt.data.t1! + 0.35) endPattern(w, e);
      break;
    }
    case 'chop': {
      // a heavy blow along a line from the boss (or a fan of `lines`), stopped by walls and pillars;
      // shown for `wind` seconds, `swings` times
      const lines = num(u, 'lines', 1);
      const spread = num(u, 'spread', 0.45);
      const wind = num(u, 'wind', 0.9);
      const width = num(u, 'width', 18);
      const swings = num(u, 'swings', 1);
      const angle = (i: number): number => pt.data.a! + (i - (lines - 1) / 2) * spread;
      if (pt.step === 0) {
        pt.data.a = aimAt();
        pt.data.t0 = pt.t;
        for (let i = 0; i < lines; i++) {
          const a = angle(i);
          const end = castRay(w.map, e.x, e.y, 2, a, num(u, 'len', 120));
          const len = Math.max(e.r + 8, dist(e.x, e.y, end.x, end.y));
          pt.data[`l${i}`] = len;
          w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: width, angle: a, len, dur: wind, dmg: e.dmg * num(u, 'mul', 1.6), knock: 130, tone: 'enemy', owner: e.id, linger: 0.12 });
        }
        e.face = Math.cos(pt.data.a) < 0 ? Math.PI : 0;
        w.sfx('windup', 0.6);
        pt.step = 1;
      } else if (pt.step === 1 && pt.t >= pt.data.t0! + wind) {
        w.shake(4);
        w.sfx('slam');
        for (let i = 0; i < lines; i++) {
          const a = angle(i);
          const len = pt.data[`l${i}`] ?? 60;
          for (let k = 1; k <= 4; k++) w.fxBurst(e.x + (Math.cos(a) * len * k) / 4, e.y + (Math.sin(a) * len * k) / 4, '#a89070', 4, 8);
        }
        pt.data.n = (pt.data.n ?? 0) + 1;
        pt.data.t1 = pt.t;
        pt.step = pt.data.n >= swings ? 2 : 3;
      } else if (pt.step === 3 && pt.t >= pt.data.t1! + num(u, 'gap', 0.2)) pt.step = 0;
      else if (pt.step === 2 && pt.t >= pt.data.t1! + 0.5) endPattern(w, e);
      break;
    }
    case 'hook': {
      // a rope (a noose, a chain) thrown along a line: caught in it, the hero is dragged in, slowed, and
      // a heavy blow follows (step out of the line, or dodge through it)
      const wind = num(u, 'wind', 0.85);
      const width = num(u, 'width', 12);
      const fwind = num(u, 'fwind', 0.6);
      if (pt.step === 0) {
        const a = aimAt();
        const end = castRay(w.map, e.x, e.y, 3, a, num(u, 'len', 150));
        pt.data.a = a;
        pt.data.len = Math.max(20, dist(e.x, e.y, end.x, end.y));
        w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: width, angle: a, len: pt.data.len, dur: wind, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
        e.face = Math.cos(a) < 0 ? Math.PI : 0;
        w.sfx('windup', 0.6);
        pt.step = 1;
      } else if (pt.step === 1 && pt.t >= wind) {
        const a = pt.data.a!;
        const len = pt.data.len!;
        w.addFx({ kind: 'zap', x: e.x, y: e.y - 4, x2: e.x + Math.cos(a) * len, y2: e.y + Math.sin(a) * len, life: 0.15, size: 1, color: '#c9b89a' });
        w.sfx('whirl', 0.6);
        pt.data.t1 = pt.t;
        const caught = !p.dead && inLine(p.x, p.y, p.r * 0.5, e.x, e.y, a, len, width) && hurtPlayer(w, e.dmg * num(u, 'mul', 0.5), { source: e });
        if (caught) {
          const cur = p.statuses.find((x) => x.id === 'chill');
          if (cur) cur.t = Math.max(cur.t, 0.9);
          else p.statuses.push({ id: 'chill', t: 0.9, power: 0.45, tick: 0 });
          w.text(p.x, p.y - 22, 'CAUGHT!', '#ffb0a0', true);
          pt.step = 2;
        } else pt.step = 9;
      } else if (pt.step === 2) {
        // dragged in along the rope (walls and pillars still stop the hero)
        const d = dist(e.x, e.y, p.x, p.y);
        const near = e.r + p.r + 10;
        if (!p.dead && d > near && pt.t < pt.data.t1! + 0.5) {
          const a = Math.atan2(e.y - p.y, e.x - p.x);
          const s = Math.min(d - near, 420 * dt);
          const m = moveCircle(w.map, p.x, p.y, p.r, Math.cos(a) * s, Math.sin(a) * s);
          p.x = m.x;
          p.y = m.y;
          p.vx = 0;
          p.vy = 0;
          w.addFx({ kind: 'zap', x: e.x, y: e.y - 4, x2: p.x, y2: p.y - 4, life: dt * 2, size: 1, color: '#c9b89a' });
        } else {
          const a = aimAt();
          pt.data.a = a;
          pt.data.t1 = pt.t;
          w.addTelegraph({ shape: 'cone', x: e.x, y: e.y, r: num(u, 'r', 46), r2: num(u, 'arc', 0.9), angle: a, len: 0, dur: fwind, dmg: e.dmg * num(u, 'fmul', 1.4), knock: 170, tone: 'enemy', owner: e.id, linger: 0 });
          e.face = Math.cos(a) < 0 ? Math.PI : 0;
          pt.step = 3;
        }
      } else if (pt.step === 3 && pt.t >= pt.data.t1! + fwind) {
        w.addFx({ kind: 'slash', x: e.x, y: e.y, a: pt.data.a!, a2: num(u, 'arc', 0.9) * 2, life: 0.2, size: num(u, 'r', 46), color: '#ffb0a0', r2: 1 });
        w.sfx('swingBig');
        w.shake(3);
        pt.data.t1 = pt.t;
        pt.step = 9;
      } else if (pt.step === 9 && pt.t >= pt.data.t1! + 0.45) endPattern(w, e);
      break;
    }
    case 'volley': {
      // thrown or fired shots (axes, knives, a pistol ball): each aims at the hero (ahead of them by `lead`,
      // from where they are heading), shows its lines for `wind` seconds, then flies; `fan` per throw,
      // `shots` throws in a row
      const fan = num(u, 'fan', 1);
      const spread = num(u, 'spread', 0);
      const wind = num(u, 'wind', 0.6);
      const speed = num(u, 'speed', 200);
      const dirs = (a0: number): number[] => Array.from({ length: fan }, (_, i) => (fan === 1 ? a0 : a0 - spread / 2 + (spread * i) / (fan - 1)));
      if (pt.step === 0) {
        let tx = p.x;
        let ty = p.y;
        const lead = num(u, 'lead', 0);
        if (lead > 0) {
          const t = wind + dist(e.x, e.y, p.x, p.y) / speed;
          let ox = p.vx * t * lead;
          let oy = p.vy * t * lead;
          const l = Math.hypot(ox, oy);
          if (l > 90) {
            ox *= 90 / l;
            oy *= 90 / l;
          }
          tx += ox;
          ty += oy;
        }
        const a0 = Math.atan2(ty - e.y, tx - e.x);
        pt.data.a = a0;
        pt.data.t0 = pt.t;
        for (const a of dirs(a0)) {
          const end = castRay(w.map, e.x, e.y, 1, a, num(u, 'len', 140));
          w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: num(u, 'width', 6), angle: a, len: Math.max(12, dist(e.x, e.y, end.x, end.y)), dur: wind, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
        }
        e.face = Math.cos(a0) < 0 ? Math.PI : 0;
        w.sfx('windup', 0.4);
        pt.step = 1;
      } else if (pt.step === 1 && pt.t >= pt.data.t0! + wind) {
        for (const a of dirs(pt.data.a!)) {
          w.spawnProjectile({ x: e.x + Math.cos(a) * e.r * 0.6, y: e.y - 4 + Math.sin(a) * e.r * 0.6, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: num(u, 'r', 3), life: num(u, 'range', 300), dmg: e.dmg * num(u, 'mul', 1), type: 'physical', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: str(u, 'look', 'stone'), color: str(u, 'color', '#e8e0c8'), hostile: true, homing: num(u, 'homing', 0), child: false, knock: 0 });
        }
        w.sfx(str(u, 'sfx', 'spear'), 0.6);
        pt.data.n = (pt.data.n ?? 0) + 1;
        pt.data.t1 = pt.t;
        pt.step = pt.data.n >= num(u, 'shots', 1) ? 2 : 3;
      } else if (pt.step === 3 && pt.t >= pt.data.t1! + num(u, 'interval', 0.2)) pt.step = 0;
      else if (pt.step === 2 && pt.t >= pt.data.t1! + 0.4) endPattern(w, e);
      break;
    }
    case 'vanish': {
      // a smoke bomb: the boss is gone (nothing touches it), comes back behind the hero (away from where
      // they are heading) and strikes at once from there
      const wind = num(u, 'wind', 0.55);
      if (pt.step === 0) {
        smoke(w, e.x, e.y);
        w.sfx('puff');
        pt.data.hide = 1;
        pt.step = 1;
      } else if (pt.step === 1 && pt.t >= num(u, 'hide', 0.6)) {
        const moving = Math.hypot(p.vx, p.vy) > 10;
        const back = moving ? Math.atan2(-p.vy, -p.vx) : Math.atan2(e.y - p.y, e.x - p.x);
        const d = num(u, 'behind', 34);
        for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.5, -2.5, Math.PI]) {
          const x = p.x + Math.cos(back + off) * d;
          const y = p.y + Math.sin(back + off) * d;
          const i = tileAt(w.map, x, y);
          if (i >= 0 && w.map.room[i] === e.room + 1 && !circleHitsWall(w.map, x, y, e.r + 1)) {
            e.x = x;
            e.y = y;
            break;
          }
        }
        smoke(w, e.x, e.y);
        w.sfx('blink');
        pt.data.hide = 0;
        const a = aimAt();
        pt.data.a = a;
        pt.data.t1 = pt.t;
        e.face = Math.cos(a) < 0 ? Math.PI : 0;
        w.addTelegraph({ shape: 'cone', x: e.x, y: e.y, r: num(u, 'r', 44), r2: num(u, 'arc', 1), angle: a, len: 0, dur: wind, dmg: e.dmg * num(u, 'mul', 1.3), knock: 150, tone: 'enemy', owner: e.id, linger: 0 });
        pt.step = 2;
      } else if (pt.step === 2 && pt.t >= pt.data.t1! + wind) {
        w.addFx({ kind: 'slash', x: e.x, y: e.y, a: pt.data.a!, a2: num(u, 'arc', 1) * 2, life: 0.2, size: num(u, 'r', 44), color: '#ffb0a0', r2: 1 });
        w.sfx('swingBig');
        pt.step = 3;
      } else if (pt.step === 3 && pt.t >= pt.data.t1! + wind + 0.35) endPattern(w, e);
      break;
    }
    case 'tide': {
      // a wall of water forms along one side of the room (from the side away from the hero), then rolls
      // across it; a gap of `gap` drops is the way through (or dodge it); `waves` walls, each turned
      const waves = num(u, 'waves', 1);
      if (pt.step === 0) {
        const box = roomBox(w, e);
        const n = pt.data.n ?? 0;
        let dir: number;
        if (n === 0) {
          const dx = p.x - b.cx;
          const dy = p.y - b.cy;
          dir = Math.abs(dx) * (box.y1 - box.y0) > Math.abs(dy) * (box.x1 - box.x0) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3;
        } else dir = (pt.data.dir! + (w.rand() < 0.5 ? 1 : 3)) % 4;
        pt.data.dir = dir;
        const vx = [1, 0, -1, 0][dir]!;
        const vy = [0, 1, 0, -1][dir]!;
        const spacing = num(u, 'spacing', 20);
        const lo = vx !== 0 ? box.y0 : box.x0;
        const hi = vx !== 0 ? box.y1 : box.x1;
        const lanes = Math.floor((hi - lo) / spacing) + 1;
        const gap = num(u, 'gap', 3);
        const g0 = 1 + Math.floor(w.rand() * Math.max(1, lanes - gap - 1));
        const span = (vx !== 0 ? box.x1 - box.x0 : box.y1 - box.y0) + 24;
        const off = (hi - lo - (lanes - 1) * spacing) / 2;
        pt.data.id0 = w.nextId;
        for (let k = 0; k < lanes; k++) {
          if (k >= g0 && k < g0 + gap) continue;
          const c = lo + off + k * spacing;
          // from the starting edge inward to the first open spot of the room
          for (let s = 6; s < 8 * TILE; s += TILE / 2) {
            const x = vx > 0 ? box.x0 + s : vx < 0 ? box.x1 - s : c;
            const y = vy > 0 ? box.y0 + s : vy < 0 ? box.y1 - s : c;
            if (!inArena(w, e, x, y)) continue;
            w.spawnProjectile({ x, y, vx: 0, vy: 0, r: num(u, 'r', 4.5), life: span - s + 12, dmg: e.dmg * num(u, 'mul', 1), type: 'frost', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'orb', color: str(u, 'color', '#5ac8ff'), hostile: true, homing: 0, child: false, knock: 0 });
            break;
          }
        }
        pt.data.cnt = w.nextId - pt.data.id0;
        pt.data.vx = vx;
        pt.data.vy = vy;
        pt.data.t0 = pt.t;
        if (n === 0) w.text(e.x, e.y - e.r - 14, 'THE TIDE!', '#9ce8ff', true);
        w.sfx('freeze', 0.6);
        pt.step = 1;
      } else if (pt.step === 1 && pt.t >= pt.data.t0! + num(u, 'form', 1.1)) {
        const sp = num(u, 'speed', 70);
        const id0 = pt.data.id0!;
        const id1 = id0 + pt.data.cnt!;
        for (const pr of w.projectiles) {
          if (pr.id < id0 || pr.id >= id1 || pr.vx !== 0 || pr.vy !== 0) continue;
          pr.vx = pt.data.vx! * sp;
          pr.vy = pt.data.vy! * sp;
        }
        w.sfx('quake', 0.5);
        w.shake(2);
        pt.data.n = (pt.data.n ?? 0) + 1;
        pt.data.t1 = pt.t;
        pt.step = pt.data.n >= waves ? 2 : 3;
      } else if (pt.step === 3 && pt.t >= pt.data.t1! + num(u, 'gapT', 1.2)) pt.step = 0;
      else if (pt.step === 2 && pt.t >= pt.data.t1! + 0.6) endPattern(w, e);
      break;
    }
    case 'orbs': {
      // slow orbs that seek the hero, let go all around the boss (`ring`) or in a fan at the hero, in
      // `waves`; outrun them or let them break on a wall
      const count = num(u, 'count', 4);
      const waves = num(u, 'waves', 1);
      const gapT = num(u, 'gap', 0.7);
      const color = str(u, 'color', '#7ad8ff');
      const fired = pt.data.f ?? 0;
      if (!pt.data.glow) {
        pt.data.glow = 1;
        w.addFx({ kind: 'glow', x: e.x, y: e.y - 8, life: 0.6, size: 16, color });
      }
      if (fired < waves && pt.t >= 0.6 + fired * gapT) {
        const sp = num(u, 'speed', 55);
        const ring = num(u, 'ring', 1) > 0;
        const base = ring ? w.rand() * TAU : aimAt();
        for (let i = 0; i < count; i++) {
          const a = ring ? base + (TAU * i) / count : base - 0.6 + (1.2 * i) / Math.max(1, count - 1);
          w.spawnProjectile({ x: e.x + Math.cos(a) * (e.r + 2), y: e.y - 6 + Math.sin(a) * (e.r + 2), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: num(u, 'r', 4), life: num(u, 'range', 260), dmg: e.dmg * num(u, 'mul', 0.9), type: 'frost', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'orb', color, hostile: true, homing: num(u, 'homing', 1), child: false, knock: 0 });
        }
        w.sfx('soul');
        pt.data.f = fired + 1;
      }
      if (pt.t >= 1.1 + (waves - 1) * gapT) endPattern(w, e);
      break;
    }
    case 'barrage': {
      // shells across the room, salvo after salvo: one on the hero, the rest anywhere in the room; each
      // lands where its circle shows (the boss moves on while they fall)
      const salvos = num(u, 'salvos', 3);
      const gapT = num(u, 'gap', 0.5);
      const fired = pt.data.f ?? 0;
      if (fired < salvos && pt.t >= 0.3 + fired * gapT) {
        const count = num(u, 'count', 5);
        const r = num(u, 'r', 24);
        const dur = num(u, 'dur', 1.1);
        const tiles = w.map.roomTiles[e.room] ?? [];
        for (let i = 0; i < count; i++) {
          let x = p.x;
          let y = p.y;
          if (i > 0 && tiles.length) {
            for (let tries = 0; tries < 6; tries++) {
              const t = tiles[Math.floor(w.rand() * tiles.length)]!;
              x = ((t % w.map.w) + 0.5) * TILE;
              y = (Math.floor(t / w.map.w) + 0.5) * TILE;
              if (!w.map.solid[t]) break;
            }
          }
          w.addTelegraph({ shape: 'circle', x, y, r, r2: 0, angle: 0, len: 0, dur, dmg: e.dmg * num(u, 'mul', 1.2), knock: 120, tone: 'enemy', owner: -1, linger: 0 });
        }
        w.sfx('sling', 0.7);
        w.after(dur, () => {
          w.sfx('explode', 0.5);
          w.shake(3);
        });
        pt.data.f = fired + 1;
      }
      if (pt.t >= 0.7 + (salvos - 1) * gapT) endPattern(w, e);
      break;
    }
    case 'kegs': {
      // powder kegs rolled out on and around the hero: each fuse burns while its circle fills, then blows
      if (pt.step === 0) {
        const count = num(u, 'count', 3);
        const fuse = num(u, 'fuse', 2.2);
        const r = num(u, 'r', 34);
        const spread = num(u, 'spread', 46);
        const a0 = w.rand() * TAU;
        for (let i = 0; i < count; i++) {
          let x = p.x;
          let y = p.y;
          if (i > 0) {
            const a = a0 + (TAU * i) / Math.max(1, count - 1);
            x += Math.cos(a) * spread;
            y += Math.sin(a) * spread * 0.8;
          }
          if (!inArena(w, e, x, y) || circleHitsWall(w.map, x, y, 4)) continue;
          const id = w.nextId;
          w.addTelegraph({ shape: 'circle', x, y, r, r2: 0, angle: 0, len: 0, dur: fuse, dmg: e.dmg * num(u, 'mul', 1.6), knock: 170, tone: 'enemy', owner: -1, linger: 0 });
          const live = (): boolean => w.telegraphs.some((t) => t.id === id && !t.dead);
          // the fuse sparks while it burns, and the keg goes up a moment before the circle resolves
          for (let k = 0; k * 0.2 < fuse - 0.1; k++) {
            w.after(k * 0.2, () => {
              if (live()) w.addFx({ kind: 'spark', x: x + (w.rand() - 0.5) * 3, y: y - 6, vx: (w.rand() - 0.5) * 30, vy: -30 - w.rand() * 20, life: 0.3, size: 1, color: '#ffd86b' });
            });
          }
          w.after(fuse - 0.03, () => {
            if (!live()) return;
            w.sfx('explode', 0.6);
            w.shake(4);
            w.fxBurst(x, y, '#ff9a3d', 16, r * 0.6);
          });
        }
        w.sfx('sling', 0.6);
        pt.step = 1;
      } else if (pt.t >= 0.7) endPattern(w, e);
      break;
    }
    default: {
      // a dungeon's own attack (sim/patterns/)
      const fn = EXTRA_PATTERNS[u.id];
      if (!fn) {
        endPattern(w, e);
        break;
      }
      fn(w, e, dt, { use: u, pt, aimAt, num: (k, d) => num(u, k, d), str: (k, d) => str(u, k, d), end: () => endPattern(w, e) });
      break;
    }
  }
  // bosses are never stunned by statuses (being dazed after a missed charge is their only stun)
  if (hasStatus(e, 'stun')) e.statuses = e.statuses.filter((s) => s.id !== 'stun');
}

/** A puff of smoke (smoke bombs). */
function smoke(w: World, x: number, y: number): void {
  for (let i = 0; i < 16; i++) {
    const a = w.rand() * TAU;
    const s = 10 + w.rand() * 30;
    w.addFx({ kind: 'smoke', x: x + Math.cos(a) * 4, y: y + Math.sin(a) * 3, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 6, life: 0.7 + w.rand() * 0.4, size: 4 + Math.floor(w.rand() * 4), color: w.rand() < 0.5 ? '#8a8494' : '#5e5868' });
  }
}

/** The boss room's bounds in pixels (worked out once). */
function roomBox(w: World, e: Enemy): { x0: number; y0: number; x1: number; y1: number } {
  const m = e.boss!.misc;
  if (m.bx1 === undefined) {
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
    m.bx0 = x0 * TILE;
    m.by0 = y0 * TILE;
    m.bx1 = (x1 + 1) * TILE;
    m.by1 = (y1 + 1) * TILE;
  }
  return { x0: m.bx0!, y0: m.by0!, x1: m.bx1, y1: m.by1! };
}

/** A point over the boss room's floor, or over water and bridges inside its bounds. */
function inArena(w: World, e: Enemy, x: number, y: number): boolean {
  const i = tileAt(w.map, x, y);
  if (i < 0 || w.map.block[i]) return false;
  if (w.map.room[i] === e.room + 1) return true;
  const k = w.map.kind[i];
  if (k !== K.Water && k !== K.Bridge) return false;
  const box = roomBox(w, e);
  return x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1;
}

/** Whether the boss is hidden mid-teleport or in its smoke (the renderer fades it, attacks pass through). */
export const bossHidden = (e: Enemy): boolean => !!e.boss?.pattern && e.boss.pattern.data.hide === 1;
