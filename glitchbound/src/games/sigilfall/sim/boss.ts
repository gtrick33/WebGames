import { dist, pickWeighted, TAU } from '../core/math';
import type { PatternUse } from '../data/bosses';
import { hasStatus, hurtPlayer } from './combat';
import { castRay, circleHitsWall, flowStep, lineOfSight, moveCircle } from './map';
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
  const ok = phase.patterns.filter((u) => (b.cds[u.id] ?? 0) <= 0 && (u.id !== 'summon' || w.enemies.filter((x) => !x.dead && !x.boss && x.room === e.room).length < 4));
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
      const total = u.id === 'tripleCharge' ? 3 : 1;
      const wind = u.id === 'tripleCharge' ? 0.55 : 0.8;
      // step 0: aim and show the lane; step 1: rush
      if (pt.step === 0) {
        if (pt.t === dt) {
          const a = aimAt();
          pt.data.a = a;
          const end = castRay(w.map, e.x, e.y, e.r, a, 260);
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
        const step = 290 * dt;
        const r = moveCircle(w.map, e.x, e.y, e.r, Math.cos(a) * step, Math.sin(a) * step);
        e.x = r.x;
        e.y = r.y;
        pt.data.len! -= step;
        w.addFx({ kind: 'smoke', x: e.x - Math.cos(a) * e.r, y: e.y + e.r * 0.6, life: 0.4, size: 4, color: '#b9a58a' });
        if (!pt.data.hit && !p.dead && dist(e.x, e.y, p.x, p.y) < e.r + p.r + 3) {
          pt.data.hit = 1;
          hurtPlayer(w, e.dmg * 1.35, { fromX: e.x, fromY: e.y, knock: 190, source: e });
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
            if (wall) {
              b.dazed = num(u, 'stun', 1.4);
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
  }
  // bosses are never stunned by statuses (being dazed after a missed charge is their only stun)
  if (hasStatus(e, 'stun')) e.statuses = e.statuses.filter((s) => s.id !== 'stun');
}

/** Whether the boss is hidden mid-teleport (the renderer fades it, attacks pass through). */
export const bossHidden = (e: Enemy): boolean => !!e.boss?.pattern && e.boss.pattern.use.id === 'teleport' && e.boss.pattern.data.hide === 1;
