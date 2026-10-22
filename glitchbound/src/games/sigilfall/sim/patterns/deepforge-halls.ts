import { dist, TAU } from '../../core/math';
import { castRay, circleHitsWall, flowStep, lineOfSight, moveCircle, TILE, tileAt } from '../map';
import type { Enemy } from '../types';
import type { World } from '../world';
import type { PatternFn, PatternKit } from './kit';

/**
 * Boss attacks of the Deepforge Halls: ids start with 'forge:'.
 *
 * The Slag Colossus flings molten slag (`slag`), sheds chunks of itself that crawl after you (`shed`)
 * and cools into a crust that has to be cracked before its heat breaks out (`harden`). Forgemaster
 * Grold uses his forge: molten bone-steel poured down the hall's channels (`pour`), the bellows
 * blowing the furnace's heat across half the hall (`bellows`), hammer blows that split the floor
 * along lines (`quake`) and forged blades thrown in loops that come back to his hand (`blades`).
 */

/** The fight goes on: the boss stands, isn't falling, and no respawn has reset its room (and, if given, it is still in that phase). */
function fighting(w: World, e: Enemy, phase?: number): boolean {
  const b = e.boss;
  return !!b && !e.dead && b.dying <= 0 && w.enemies.includes(e) && (phase === undefined || b.phase === phase);
}

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

/** Molten things set the hero burning (a tenth of the boss's blow a second). */
const burn = (e: Enemy, dur = 2): { status: 'burn'; dur: number; power: number } => ({ status: 'burn', dur, power: Math.max(2, Math.round(e.dmg * 0.1)) });

const faceTo = (e: Enemy, a: number): void => {
  e.face = Math.cos(a) < 0 ? Math.PI : 0;
};

/* ------------------------------------------------------------ the Slag Colossus */

/** Globs of molten slag, flung high: each lands where its circle shows and leaves a burning pool. */
const slag: PatternFn = (w, e, _dt, k) => {
  const pt = k.pt;
  if (pt.step === 0) {
    const n = k.num('count', 3);
    const dur = k.num('dur', 1.2);
    const r = k.num('r', 20);
    const spread = k.num('spread', 64);
    const p = w.player;
    const a0 = w.rand() * TAU;
    for (let i = 0; i < n; i++) {
      let x = p.x;
      let y = p.y;
      if (i > 0) {
        const a = a0 + (TAU * i) / Math.max(1, n - 1);
        const d = spread * (0.6 + w.rand() * 0.4);
        x += Math.cos(a) * d;
        y += Math.sin(a) * d * 0.8;
      }
      if (!onFloor(w, e, x, y, 3)) continue;
      w.addTelegraph({ shape: 'circle', x, y, r, r2: 0, angle: 0, len: 0, dur, dmg: e.dmg * k.num('mul', 1.2), status: burn(e), knock: 80, tone: 'enemy', owner: -1, linger: 0 });
      // the glob coming down
      const sx = x + (e.x - x) * 0.25;
      w.addFx({ kind: 'ember', x: sx, y: y - 130, vx: (x - sx) / dur, vy: 130 / dur, life: dur, size: 6, color: '#ff7a3d', sprite: 'meteor' });
      const poolR = k.num('poolR', 15);
      const pool = k.num('pool', 3.5);
      w.after(dur, () => {
        if (!fighting(w, e)) return;
        w.spawnField({ x, y, r: poolR, dur: pool, tick: 0.5, dmg: e.dmg * 0.15, type: 'fire', status: burn(e), look: 'fire', hostile: true, depth: 0, spec: null, onHit: false });
        w.sfx('explode', 0.35);
      });
    }
    faceTo(e, k.aimAt());
    w.fxBurst(e.x, e.y - 14, '#ff8a2a', 10, 10);
    w.sfx('sling', 0.8);
    pt.step = 1;
  } else if (pt.t >= 0.8) k.end();
};

/** Pieces crack off the Colossus, land where their circles show, and crawl after the hero. */
const shed: PatternFn = (w, e, _dt, k) => {
  const pt = k.pt;
  const dur = k.num('dur', 1.1);
  if (pt.step === 0) {
    const adds = w.enemies.filter((x) => !x.dead && !x.boss && x.room === e.room).length;
    const n = Math.min(k.num('count', 2), 4 - adds);
    if (n <= 0) {
      k.end();
      return;
    }
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 12; tries++) {
        const a = w.rand() * TAU;
        const d = 40 + w.rand() * 50;
        const x = e.x + Math.cos(a) * d;
        const y = e.y + Math.sin(a) * d;
        if (!onFloor(w, e, x, y, 7)) continue;
        w.addTelegraph({ shape: 'circle', x, y, r: 14, r2: 0, angle: 0, len: 0, dur, dmg: e.dmg * 0.9, knock: 100, tone: 'enemy', owner: -1, linger: 0 });
        w.addFx({ kind: 'ember', x, y: y - 110, vx: 0, vy: 110 / dur, life: dur, size: 5, color: '#ff7a3d', sprite: 'meteor' });
        w.after(dur, () => {
          if (fighting(w, e)) w.spawnAdd('slag-lump', x, y, e.room);
        });
        break;
      }
    }
    for (let i = 0; i < 12; i++) w.addFx({ kind: 'rubble', x: e.x + (w.rand() - 0.5) * 20, y: e.y - 10 - w.rand() * 12, vx: (w.rand() - 0.5) * 120, vy: -60 - w.rand() * 60, life: 0.7, size: 2, color: w.rand() < 0.5 ? '#4a3a34' : '#ff7a2a' });
    w.text(e.x, e.y - e.r - 16, 'CRACK!', '#ffb04d', true);
    w.sfx('crumble');
    w.shake(3);
    pt.step = 1;
  } else if (pt.t >= dur + 0.3) k.end();
};

/** The crust gives way: the Colossus reels, glowing and soft, for a few seconds. */
function crack(w: World, e: Enemy, k: PatternKit): void {
  const daze = k.num('daze', 2.5);
  e.def.sprite = 'slag-colossus';
  w.text(e.x, e.y - e.r - 16, 'CRACKED!', '#ffd04a', true);
  w.sfx('crumble');
  w.shake(5);
  w.fxBurst(e.x, e.y - 10, '#ff8a2a', 24, 22);
  for (let i = 0; i < 14; i++) w.addFx({ kind: 'rubble', x: e.x + (w.rand() - 0.5) * 24, y: e.y - 8 - w.rand() * 16, vx: (w.rand() - 0.5) * 140, vy: -50 - w.rand() * 80, life: 0.8, size: 2, color: w.rand() < 0.6 ? '#8a8e98' : '#5a5e68' });
  k.end();
  e.boss!.dazed = daze;
  // the stars over its head, and molten flesh that takes a beating
  e.statuses.push({ id: 'stun', t: daze, power: 1, tick: 0 });
  e.statuses.push({ id: 'armorBreak', t: daze + 4, power: k.num('soft', 30), tick: 0 });
}

/**
 * The slag cools and hardens: a crust (a shield of `shield` of its health) the hero has to break
 * within `time` seconds while it trudges after them stamping the floor. Cracked, it reels and takes
 * more damage; left alone, the heat inside breaks out all around it.
 */
const harden: PatternFn = (w, e, dt, k) => {
  const pt = k.pt;
  const time = k.num('time', 9);
  if (pt.step === 0) {
    e.shield = e.maxHp * k.num('shield', 0.12);
    pt.data.full = e.shield;
    pt.data.next = 1.4;
    e.def.sprite = 'slag-colossus-cooled';
    w.text(e.x, e.y - e.r - 16, 'HARDENED!', '#c8ccd4', true);
    w.sfx('freeze');
    w.shake(3);
    for (let i = 0; i < 16; i++) w.addFx({ kind: 'smoke', x: e.x + (w.rand() - 0.5) * 26, y: e.y - w.rand() * 24, vx: (w.rand() - 0.5) * 30, vy: -14 - w.rand() * 16, life: 0.9, size: 4, color: '#b8bcc8' });
    pt.step = 1;
    return;
  }
  if (e.shield <= 0) {
    crack(w, e, k);
    return;
  }
  // steam off the cooling crust; molten light leaking through it once it is half broken
  if (w.rand() < dt * 5) w.addFx({ kind: 'smoke', x: e.x + (w.rand() - 0.5) * 22, y: e.y - 6 - w.rand() * 20, vx: 0, vy: -16, life: 0.8, size: 3, color: '#a8acb8' });
  if (e.shield < pt.data.full! * 0.5 && w.rand() < dt * 12) w.addFx({ kind: 'spark', x: e.x + (w.rand() - 0.5) * 22, y: e.y - 4 - w.rand() * 20, vx: (w.rand() - 0.5) * 30, vy: -30, life: 0.4, size: 1, color: '#ff8a2a' });
  if (pt.step === 1) {
    // it trudges after the hero, slower than ever
    const p = w.player;
    if (!p.dead && dist(e.x, e.y, p.x, p.y) > e.r + p.r + 14) {
      const los = lineOfSight(w.map, e.x, e.y, p.x, p.y);
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      const st = los ? { x: Math.cos(a), y: Math.sin(a) } : (flowStep(w.map, w.flow, e.x, e.y) ?? { x: 0, y: 0 });
      const sp = k.num('creep', 14) * dt;
      const m = moveCircle(w.map, e.x, e.y, e.r, st.x * sp, st.y * sp);
      e.x = m.x;
      e.y = m.y;
      e.walkT += dt * 0.6;
      if (Math.abs(st.x) > 0.1) e.face = st.x < 0 ? Math.PI : 0;
    }
    // and stamps the floor now and then
    if (pt.t >= pt.data.next!) {
      pt.data.next = pt.t + k.num('stomp', 2.4);
      w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: 42, r2: 0, angle: 0, len: 0, dur: 1, dmg: e.dmg * 1.2, knock: 140, tone: 'enemy', owner: e.id, linger: 0 });
      w.sfx('windup', 0.5);
      w.after(1, () => {
        if (!fighting(w, e)) return;
        w.sfx('slam', 0.8);
        w.shake(3);
      });
    }
    if (pt.t >= time) {
      // not cracked in time: the heat inside breaks out
      w.telegraphs = w.telegraphs.filter((t) => t.owner !== e.id);
      w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: 72, r2: 0, angle: 0, len: 0, dur: 1.3, dmg: e.dmg * 1.8, status: burn(e, 3), knock: 180, tone: 'enemy', owner: e.id, linger: 0 });
      w.text(e.x, e.y - e.r - 16, 'ERUPTION!', '#ff6a3d', true);
      w.sfx('beamCharge');
      pt.data.t1 = pt.t;
      pt.step = 2;
    }
  } else if (pt.step === 2 && pt.t >= pt.data.t1! + 1.3) {
    // the crust bursts: burning slag all around
    e.shield = 0;
    e.def.sprite = 'slag-colossus';
    const a0 = w.rand() * TAU;
    for (let i = 0; i < 6; i++) {
      const a = a0 + (TAU * i) / 6;
      const x = e.x + Math.cos(a) * 54;
      const y = e.y + Math.sin(a) * 54;
      if (onFloor(w, e, x, y, 3)) w.spawnField({ x, y, r: 16, dur: 4, tick: 0.5, dmg: e.dmg * 0.15, type: 'fire', status: burn(e), look: 'fire', hostile: true, depth: 0, spec: null, onHit: false });
    }
    w.fxBurst(e.x, e.y - 8, '#ff8a2a', 30, 30);
    w.sfx('explode');
    w.shake(6);
    k.end();
  }
};

/* ------------------------------------------------------------ Forgemaster Grold */

/** One of the Great Forge's channels: its row on the map and the way it runs from its spout (1 east, -1 west). */
interface Lane {
  row: number;
  dir: 1 | -1;
}

/** The channels from the pattern's `lanes` knob ('7L': row 7, poured from the west wall). */
function lanesOf(k: PatternKit): Lane[] {
  const v = k.use.p?.lanes;
  return (Array.isArray(v) ? v : []).map((s) => ({ row: parseInt(s, 10), dir: s.endsWith('R') ? -1 : 1 }));
}

const LANE_W = 14;

/**
 * Molten bone-steel runs down one channel: the line fills from the spout for `wind` seconds, then the
 * channel burns whoever stands in it (every half second, dodging through is safe) for `open`
 * seconds, and cools. Scheduled on the world's clock, so Grold fights on while it flows.
 */
function pour(w: World, e: Enemy, lane: Lane, wind: number, open: number, phase: number): void {
  const b = roomBox(w, e);
  const y = (lane.row + 0.5) * TILE;
  const x = lane.dir > 0 ? b.x0 + TILE : b.x1 - TILE;
  const a = lane.dir > 0 ? 0 : Math.PI;
  const len = b.x1 - b.x0 - TILE;
  const live = (): boolean => fighting(w, e, phase);
  const molten = (first: boolean): void => {
    w.addTelegraph({ shape: 'line', x, y, r: 0, r2: LANE_W, angle: a, len, dur: first ? wind : 0.01, dmg: e.dmg * (first ? 0.8 : 0.6), status: burn(e), knock: 0, tone: 'enemy', owner: -1, linger: 0.55 });
  };
  molten(true);
  // the spout glows while the metal comes
  w.addFx({ kind: 'glow', x: x - Math.cos(a) * 6, y: y - 6, life: wind + 0.3, size: 16, color: '#ff8a2a' });
  const ticks = Math.max(1, Math.round(open / 0.5));
  for (let i = 0; i < ticks; i++) {
    w.after(wind + i * 0.5, () => {
      if (!live()) return;
      if (i > 0) molten(false);
      else {
        w.sfx('fireball', 0.5);
        w.shake(1.5);
      }
      // the channel glows white-hot along its length (and lights the dark hall)
      for (let d = 8; d < len; d += 22) {
        const px = x + Math.cos(a) * (d + w.rand() * 8);
        const hot = w.rand();
        w.addFx({ kind: 'burst', x: px, y: y + (w.rand() - 0.5) * 4, life: 0.7, size: 7 + Math.floor(w.rand() * 3), color: hot < 0.35 ? '#ffe680' : hot < 0.75 ? '#ffb02a' : '#ff6a1e' });
        if (w.rand() < 0.45) w.addFx({ kind: 'spark', x: px, y: y - 2, vx: (w.rand() - 0.5) * 20, vy: -30 - w.rand() * 30, life: 0.5, size: 1, color: w.rand() < 0.5 ? '#ffd04a' : '#ff8a2a' });
      }
    });
  }
  // and cools
  w.after(wind + ticks * 0.5, () => {
    if (!live()) return;
    for (let d = 10; d < len; d += 28) w.addFx({ kind: 'smoke', x: x + Math.cos(a) * d, y: y - 2, vx: 0, vy: -10, life: 0.9, size: 3, color: '#6a6470' });
    w.sfx('puff', 0.4);
  });
}

/** The forge overflows: from now on the channels fill and empty by themselves, two at a time, until Grold falls. */
function overflow(w: World, e: Enemy, lanes: Lane[], phase: number): void {
  const m = e.boss!.misc;
  if (m.overflow) return;
  m.overflow = 1;
  let n = 0;
  const wave = (): void => {
    if (!fighting(w, e, phase)) return;
    for (const [i, l] of lanes.entries()) if (i % 2 === n % 2) pour(w, e, l, 1.3, 2.5, phase);
    n += 1;
    w.after(4.6, wave);
  };
  w.after(0.4, wave);
}

/** Molten bone-steel poured down `count` channels (the one nearest the hero first), or (`cycle`) the overflow. */
const pourPattern: PatternFn = (w, e, _dt, k) => {
  const pt = k.pt;
  if (pt.step === 0) {
    const lanes = lanesOf(k);
    const phase = e.boss!.phase;
    if (!lanes.length) {
      k.end();
      return;
    }
    if (k.num('cycle', 0) > 0) overflow(w, e, lanes, phase);
    else {
      const p = w.player;
      const near = (l: Lane): number => Math.abs((l.row + 0.5) * TILE - p.y);
      const order = [...lanes].sort((a, b) => near(a) - near(b));
      const rest = order.slice(1);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(w.rand() * (i + 1));
        [rest[i], rest[j]] = [rest[j]!, rest[i]!];
      }
      const pick = [order[0]!, ...rest].slice(0, k.num('count', 1));
      pick.forEach((l, i) => pour(w, e, l, k.num('wind', 1.4) + i * 0.3, k.num('open', 3), phase));
    }
    w.text(e.x, e.y - e.r - 14, 'MOLTEN STEEL!', '#ffb04d', true);
    w.sfx('windup', 0.7);
    pt.step = 1;
  } else if (pt.t >= 0.9) k.end();
};

/**
 * The bellows: the furnace mouth on the side of the hall the hero stands in draws breath for `wind`
 * seconds, then blows its heat `reach` of the way across the hall (`blast` times his blow); the
 * middle of the hall is out of reach of both. With `cracks`, Grold hammers that many cracks at the
 * hero while they draw breath (the quake's knobs shape them); with `twice`, the other side blows next.
 */
const bellows: PatternFn = (w, e, _dt, k) => {
  const pt = k.pt;
  const wind = k.num('wind', 2.6);
  const blasts = k.num('twice', 0) > 0 ? 2 : 1;
  const b = roomBox(w, e);
  if (pt.step === 0) {
    const n = pt.data.n ?? 0;
    const left = n === 0 ? w.player.x < (b.x0 + b.x1) / 2 : pt.data.side! > 0;
    pt.data.side = left ? -1 : 1;
    pt.data.t0 = pt.t;
    // the shape is a band centred on the wall the bellows blow from, reaching `reach` of the way across
    w.addTelegraph({ shape: 'line', x: left ? b.x0 : b.x1, y: b.y0 - 8, r: 0, r2: (b.x1 - b.x0) * 2 * k.num('reach', 0.45), angle: Math.PI / 2, len: b.y1 - b.y0 + 16, dur: wind, dmg: e.dmg * k.num('blast', 1.5), status: burn(e, 3), knock: 120, tone: 'enemy', owner: -1, linger: 0.25 });
    w.text(e.x, e.y - e.r - 14, n === 0 ? 'THE BELLOWS!' : 'AND AGAIN!', '#ffb04d', true);
    w.sfx('beamCharge', 0.8);
    pt.step = 1;
  } else if (pt.step === 1) {
    const left = pt.data.side! < 0;
    const mx = left ? b.x0 : b.x1;
    const my = (b.y0 + b.y1) / 2;
    // the bellows draw breath: embers stream into the furnace mouth
    if (w.rand() < 0.6) {
      const sx = mx + (left ? 1 : -1) * (20 + w.rand() * (b.x1 - b.x0) * 0.45);
      const sy = b.y0 + w.rand() * (b.y1 - b.y0);
      w.addFx({ kind: 'spark', x: sx, y: sy, vx: (mx - sx) * 1.2, vy: (my - sy) * 1.2 - 20, life: 0.5, size: 1, color: '#ffb04d' });
    }
    // while they draw breath, Grold hammers cracks across the way out
    const crack = k.num('cracks', 0);
    if (crack > 0 && !pt.data.cracked && pt.t - pt.data.t0! >= k.num('crackAt', 0.6)) {
      pt.data.cracked = 1;
      const a = k.aimAt();
      faceTo(e, a);
      cracks(w, e, k, a, crack, k.num('crackWind', 0.8));
    }
    if (pt.t - pt.data.t0! >= wind) {
      // the blast: heat and cinders roll across the half
      for (let i = 0; i < 30; i++) {
        const sy = b.y0 + w.rand() * (b.y1 - b.y0);
        const v = (left ? 1 : -1) * (160 + w.rand() * 140);
        w.addFx({ kind: i % 3 ? 'spark' : 'smoke', x: mx, y: sy, vx: v, vy: (w.rand() - 0.5) * 30, life: 0.7 + w.rand() * 0.4, size: i % 3 ? 2 : 5, color: i % 3 ? (w.rand() < 0.5 ? '#ffd04a' : '#ff7a2a') : '#8a6a5a' });
      }
      w.sfx('rush');
      w.sfx('fireball', 0.7);
      w.shake(5);
      pt.data.n = (pt.data.n ?? 0) + 1;
      pt.data.t1 = pt.t;
      pt.step = pt.data.n < blasts ? 3 : 2;
    }
  } else if (pt.step === 3 && pt.t >= pt.data.t1! + 0.3) {
    pt.data.cracked = 0;
    pt.step = 0;
  } else if (pt.step === 2 && pt.t >= pt.data.t1! + 0.5) k.end();
};

/**
 * Cracks run out from Grold along `lines` lines (a fan around angle `a0`, or all round with `ring`): every
 * stone along them is shown at once and they burst one after another outward, from `wind` on.
 * Returns when the last one bursts.
 */
function cracks(w: World, e: Enemy, k: PatternKit, a0: number, lines: number, wind: number): number {
  const ring = k.num('ring', 0) > 0;
  const spread = ring ? TAU / lines : k.num('spread', 0.5);
  const r = k.num('r', 13);
  const gap = k.num('gap', 0.06);
  let last = 0;
  for (let i = 0; i < lines; i++) {
    const a = ring ? a0 + i * spread : a0 + (i - (lines - 1) / 2) * spread;
    const end = castRay(w.map, e.x, e.y, 2, a, k.num('len', 180));
    const L = dist(e.x, e.y, end.x, end.y);
    let j = 0;
    for (let d = e.r + r * 0.6; d <= L; d += r * 2, j++) {
      const x = e.x + Math.cos(a) * d;
      const y = e.y + Math.sin(a) * d;
      const t = wind + j * gap;
      w.addTelegraph({ shape: 'circle', x, y, r, r2: 0, angle: 0, len: 0, dur: t, dmg: e.dmg * k.num('mul', 1.1), knock: 90, tone: 'enemy', owner: -1, linger: 0 });
      w.after(t, () => {
        if (fighting(w, e)) w.addFx({ kind: 'smoke', x, y: y - 2, vx: 0, vy: -12, life: 0.6, size: 4, color: '#7a6e64' });
      });
    }
    last = Math.max(last, j);
  }
  w.after(wind, () => {
    if (!fighting(w, e)) return;
    w.sfx('quake');
    w.sfx('slam', 0.7);
    w.shake(4);
    w.fxBurst(e.x + Math.cos(e.face) * 10, e.y + 4, '#a89070', 14, 16);
  });
  return wind + last * gap;
}

/** The hammer splits the floor: cracks along `lines` lines, aimed at the hero (or all round). */
const quake: PatternFn = (w, e, _dt, k) => {
  const pt = k.pt;
  if (pt.step === 0) {
    const a0 = k.aimAt();
    pt.data.end = cracks(w, e, k, a0, k.num('lines', 3), k.num('wind', 0.75));
    faceTo(e, a0);
    w.sfx('windup', 0.6);
    pt.step = 1;
  } else if (pt.t >= pt.data.end! + 0.3) k.end();
};

/** Where a thrown blade is `u` of the way round its loop (a circle `size` across, out along `a`, bulging to side `s`). */
function loopAt(ox: number, oy: number, a: number, s: number, size: number, u: number): { x: number; y: number } {
  const cx = ox + Math.cos(a) * size * 0.5;
  const cy = oy + Math.sin(a) * size * 0.5;
  const f = a + Math.PI + s * TAU * u;
  return { x: cx + Math.cos(f) * size * 0.5, y: cy + Math.sin(f) * size * 0.5 };
}

/**
 * Forged blades thrown in loops: each flies out round a circle and back to his hand. They go in pairs
 * whose loops cross where the hero stands (the next pair `spread` round from the first); the loops are
 * shown while he winds up, then the blades fly them, still glowing from the forge (walls stop them).
 */
const blades: PatternFn = (w, e, dt, k) => {
  const pt = k.pt;
  const n = k.num('count', 2);
  const wind = k.num('wind', 0.9);
  const flight = k.num('flight', 1.7);
  const SEG = 18;
  if (pt.step === 0) {
    const a0 = k.aimAt();
    const spread = k.num('spread', Math.PI);
    // a loop out along a0 ± 0.45 through the hero is 1/cos(0.45) as wide as the hero is far
    const d = dist(e.x, e.y, w.player.x, w.player.y);
    const size = Math.max(110, Math.min(240, d / Math.cos(0.45)));
    pt.data.size = size;
    pt.data.ox = e.x;
    pt.data.oy = e.y;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const a = a0 + Math.floor(i / 2) * spread + side * 0.45;
      const s = -side;
      pt.data[`a${i}`] = a;
      pt.data[`s${i}`] = s;
      let prev = loopAt(e.x, e.y, a, s, size, 0);
      for (let j = 0; j < SEG; j++) {
        const next = loopAt(e.x, e.y, a, s, size, (j + 1) / SEG);
        if (!lineOfSight(w.map, prev.x, prev.y, next.x, next.y)) break;
        const la = Math.atan2(next.y - prev.y, next.x - prev.x);
        w.addTelegraph({ shape: 'line', x: prev.x, y: prev.y, r: 0, r2: 10, angle: la, len: dist(prev.x, prev.y, next.x, next.y) + 1, dur: wind, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
        prev = next;
      }
    }
    faceTo(e, a0);
    w.sfx('windup', 0.6);
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= wind) {
    const ox = pt.data.ox!;
    const oy = pt.data.oy!;
    for (let i = 0; i < n; i++) {
      const to = loopAt(ox, oy, pt.data[`a${i}`]!, pt.data[`s${i}`]!, pt.data.size!, 1 / 60 / flight);
      pt.data[`id${i}`] = w.nextId;
      w.spawnProjectile({ x: ox, y: oy, vx: (to.x - ox) * 60, vy: (to.y - oy) * 60, r: 4, life: 9999, dmg: e.dmg * k.num('mul', 0.9), type: 'physical', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'spear', color: '#e8e0cc', hostile: true, homing: 0, child: false, knock: 0 });
    }
    w.sfx('whirl', 0.8);
    w.sfx('spear', 0.6);
    pt.step = 2;
  } else if (pt.step === 2) {
    const u = (pt.t - wind) / flight;
    const ox = pt.data.ox!;
    const oy = pt.data.oy!;
    for (let i = 0; i < n; i++) {
      const id = pt.data[`id${i}`];
      const pr = w.projectiles.find((x) => x.id === id);
      if (!pr || pr.dead) continue;
      if (u >= 1) {
        // back in his hand
        pr.dead = true;
        continue;
      }
      // steer it along the loop: where it should be once this frame's movement is done
      const to = loopAt(ox, oy, pt.data[`a${i}`]!, pt.data[`s${i}`]!, pt.data.size!, u);
      if (dt > 0) {
        pr.vx = (to.x - pr.x) / dt;
        pr.vy = (to.y - pr.y) / dt;
      }
      // still hot from the forge: sparks behind it, and a glow you can follow in the dark
      w.addFx({ kind: 'spark', x: pr.x, y: pr.y, vx: (w.rand() - 0.5) * 20, vy: -10, life: 0.3, size: 1, color: w.rand() < 0.5 ? '#ffd04a' : '#ff8a2a' });
      if (Math.floor(pt.t * 30) !== Math.floor((pt.t - dt) * 30)) w.addFx({ kind: 'burst', x: pr.x, y: pr.y, life: 0.25, size: 5, color: '#ff9a3a' });
    }
    if (u >= 1) {
      w.fxBurst(ox, oy - 6, '#ffb04d', 8, 8);
      k.end();
    }
  }
};

export const DEEPFORGE_HALLS_PATTERNS: Record<string, PatternFn> = {
  'forge:slag': slag,
  'forge:shed': shed,
  'forge:harden': harden,
  'forge:pour': pourPattern,
  'forge:bellows': bellows,
  'forge:quake': quake,
  'forge:blades': blades,
};
