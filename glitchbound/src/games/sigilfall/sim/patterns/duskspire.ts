import { dist, TAU } from '../../core/math';
import { hurtPlayer } from '../combat';
import { castRay, flowStep, K, moveCircle, TILE } from '../map';
import type { Enemy, Field } from '../types';
import type { World } from '../world';
import type { PatternFn } from './kit';

/**
 * Boss attacks of Duskspire: ids start with 'dusk:'. The Hollow Guard's oath, and Vaelor, the Hollow
 * King: chains of souls that bind the hero to a pillar, rot that spreads over the throne room and never
 * dries, ghouls climbing out of the walls, a ring of frost that closes in with spikes rising inside it,
 * the Hollowing that drains the living a little every moment and the toll that rings through the whole
 * hall (only a dodge at the last moment goes through it), souls torn from the hero that drift back to
 * heal him, and the Last King's doom, which ends the fight if he is still standing when it falls.
 *
 * The lasting parts (shackles, the rot, the oath, the doom) outlive the pattern that made them, so each
 * fight keeps them here and a small ticker (World.after, once a step) runs them while the boss stands. A
 * defeat or a win clears them like every other attack.
 */

const VIOLET = '#b07aff';
const ROT = '#6a8a3a';
const FROST = '#a8e0ff';

interface Shackle {
  id: number;
  r: number;
  until: number;
}
interface Soul {
  id: number;
  heal: number;
  speed: number;
}
interface Rot {
  f: Field;
  max: number;
  grow: number;
}
/** The most rot pools on the floor at once. */
const ROT_MOST = 7;
interface Fight {
  last: number;
  shackles: Shackle[];
  rots: Rot[];
  souls: Soul[];
  /** The Hollowing: share of the hero's health drained a second, how much of their healing it eats, and when it next bites. */
  drain: { pct: number; cut: number; next: number } | null;
  /** The Hollow Guard's oath: the shield its guardsmen keep on it, and its most. */
  oath: { max: number; regen: number; guards: string } | null;
  /** The Last King's doom: when it falls, and the last second announced. */
  doom: { at: number; said: number } | null;
}

const FIGHTS = new WeakMap<Enemy, Fight>();

const alive = (w: World, e: Enemy): boolean => !e.dead && !!e.boss && e.boss.dying <= 0 && w.enemies.includes(e);

function fight(w: World, e: Enemy): Fight {
  let s = FIGHTS.get(e);
  if (!s) {
    s = { last: w.time, shackles: [], rots: [], souls: [], drain: null, oath: null, doom: null };
    FIGHTS.set(e, s);
    w.after(0, () => tick(w, e));
  }
  return s;
}

/** Once a step for as long as the boss stands. */
function tick(w: World, e: Enemy): void {
  const s = FIGHTS.get(e);
  if (!s) return;
  if (!alive(w, e)) {
    // won, or the room reset after a defeat: the rot dries, the chains break, the shackles crumble
    const rot = new Set(s.rots.map((r) => r.f));
    w.fields = w.fields.filter((f) => !rot.has(f));
    for (const sh of [...s.shackles, ...s.souls]) {
      const m = w.enemies.find((x) => x.id === sh.id);
      if (m && !m.dead) m.hp = 0;
      if (m) m.dead = true;
    }
    FIGHTS.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  const p = w.player;
  // chains of souls: the hero can't stray from a living shackle until it breaks (or its time is up)
  s.shackles = s.shackles.filter((sh) => {
    const m = w.enemies.find((x) => x.id === sh.id);
    if (!m || m.dead || w.time > sh.until) {
      if (m && !m.dead) {
        m.hp = 0;
        m.dead = true;
        m.deathT = 0;
      }
      return false;
    }
    if (!p.dead) {
      const d = dist(p.x, p.y, m.x, m.y);
      if (d > sh.r) {
        p.x = m.x + ((p.x - m.x) / d) * sh.r;
        p.y = m.y + ((p.y - m.y) / d) * sh.r;
      }
      if (Math.floor(w.time * 20) % 2 === 0) w.addFx({ kind: 'zap', x: m.x, y: m.y - 4, x2: p.x, y2: p.y - 6, life: 0.06, size: 1.2, color: VIOLET });
    }
    return true;
  });
  // torn souls drift home to Vaelor; each that reaches him mends him
  s.souls = s.souls.filter((so) => {
    const m = w.enemies.find((x) => x.id === so.id);
    if (!m || m.dead) return false;
    const d = dist(m.x, m.y, e.x, e.y);
    if (d < e.r + m.r + 2) {
      m.hp = 0;
      m.dead = true;
      m.deathT = 0;
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * so.heal);
      w.text(e.x, e.y - e.r - 14, `+${Math.round(so.heal * 100)}%`, '#c8a8ff', true);
      w.fxBurst(e.x, e.y - 8, VIOLET, 12, 20);
      w.sfx('heal', 0.5);
      return false;
    }
    m.x += ((e.x - m.x) / d) * so.speed * dt;
    m.y += ((e.y - m.y) / d) * so.speed * dt;
    return true;
  });
  // the Hollowing: the living lose a little of themselves every moment they stand before him
  if (s.drain && !p.dead && w.time >= s.drain.next) {
    s.drain.next = w.time + 1;
    // and it eats at the healing that would fill them back up (a curse, while it lasts)
    if (s.drain.cut > 0) {
      const cur = p.statuses.find((x) => x.id === 'curse');
      if (cur) {
        cur.t = Math.max(cur.t, 1.5);
        cur.power = Math.max(cur.power, s.drain.cut);
      } else p.statuses.push({ id: 'curse', t: 1.5, power: s.drain.cut, tick: 0 });
    }
    if (p.iframe <= 0) {
      let d = Math.max(1, Math.round(p.maxHp * s.drain.pct));
      const took = Math.min(p.shield, d);
      p.shield -= took;
      d -= took;
      p.hp -= d;
      p.flash = 0.06;
      if (d > 0) w.text(p.x, p.y - 18, `-${d}`, '#b07aff', false);
      if (p.hp <= 0) w.playerDies();
    }
  }
  // the rot creeps outward, a little every second, and never dries while Vaelor stands
  for (const r of s.rots) if (r.f.r < r.max) r.f.r = Math.min(r.max, r.f.r + r.grow * dt);
  // the oath: while any of its guardsmen stand, the Hollow Guard's shield mends
  if (s.oath) {
    const guards = w.enemies.filter((x) => !x.dead && x.def.id === s.oath!.guards && x.room === e.room).length;
    if (guards > 0 && e.shield < s.oath.max) {
      e.shield = Math.min(s.oath.max, e.shield + s.oath.regen * guards * dt);
      if (Math.floor(w.time * 4) !== Math.floor((w.time - dt) * 4)) {
        for (const g of w.enemies) if (!g.dead && g.def.id === s.oath.guards && g.room === e.room) w.addFx({ kind: 'zap', x: g.x, y: g.y - 6, x2: e.x, y2: e.y - 10, life: 0.2, size: 1, color: '#d8c8ff' });
      }
    }
  }
  // the Last King's doom
  if (s.doom) {
    const left = Math.ceil(s.doom.at - w.time);
    if (left !== s.doom.said && left >= 0 && (left <= 5 || left % 10 === 0)) {
      s.doom.said = left;
      w.text(e.x, e.y - e.r - 20, left > 0 ? `DOOM ${left}` : 'DOOM', '#ff4a8a', true);
      if (left <= 5) w.sfx('windup', 0.5);
    }
    if (w.time >= s.doom.at) {
      s.doom = null;
      w.emit({ t: 'banner', text: 'The Hallow King is eternal', sub: 'His doom has fallen' });
      w.shake(10);
      w.fxBurst(p.x, p.y, '#ff4a8a', 40, 80);
      if (!p.dead) hurtPlayer(w, p.maxHp * 50, {});
    }
  }
  w.after(0, () => tick(w, e));
}

/** Pillars standing in the boss's room (tile centers). */
function pillars(w: World, e: Enemy): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const i of w.map.roomTiles[e.room] ?? []) {
    const tx = i % w.map.w;
    const ty = Math.floor(i / w.map.w);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const j = (ty + dy) * w.map.w + tx + dx;
      if (w.map.kind[j] === K.Pillar) out.push({ x: (tx + dx + 0.5) * TILE, y: (ty + dy + 1.4) * TILE });
    }
  }
  return out;
}

/** A free floor spot of the boss room next to its walls (where the dead climb out). */
function wallSpot(w: World, e: Enemy): { x: number; y: number } | null {
  const tiles = (w.map.roomTiles[e.room] ?? []).filter((i) => {
    if (w.map.solid[i]) return false;
    const tx = i % w.map.w;
    const ty = Math.floor(i / w.map.w);
    return [i - 1, i + 1, i - w.map.w, i + w.map.w].some((j) => w.map.kind[j] === K.Wall) && dist((tx + 0.5) * TILE, (ty + 0.5) * TILE, w.player.x, w.player.y) > 60;
  });
  if (!tiles.length) return null;
  const i = tiles[Math.floor(w.rand() * tiles.length)]!;
  return { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

/* ------------------------------------------------------------ Lady Cendre, the Last Mourner */

/**
 * Lady Cendre (the Hall of Kneeling Dead) has mourned the Hallow King's dead for three hundred years, and they still do
 * as she asks. She bids them keep vigil (`vigil`): the kneeling dead rise about the hall, and while the hero's back is
 * turned they creep after them; faced, they go still as stone (and can be struck down). One that reaches the hero
 * seizes them, a heavy blow, and crumbles. Keep turning: what you are not looking at is coming.
 *
 * The vigil outlives the pattern that calls it, so it is kept per boss here and run by a small ticker (World.after,
 * once a step) for as long as the fight lasts.
 */

const ASH = '#c8c4d0';
const MOURNER = 'mourning-dead';
/** Faced within this angle either side (radians), the dead go still. */
const SEEN = 1.15;
/** Never more of them keeping vigil than this. */
const MOST_DEAD = 8;

interface Vigil {
  last: number;
  dead: Enemy[];
  /** Which way the hero last faced. */
  face: number;
  creep: number;
  mul: number;
  fxT: number;
}

const VIGILS = new WeakMap<Enemy, Vigil>();

function vigilOf(w: World, e: Enemy): Vigil {
  let s = VIGILS.get(e);
  if (!s) {
    s = { last: w.time, dead: [], face: 0, creep: 44, mul: 1.2, fxT: 0 };
    VIGILS.set(e, s);
    w.after(0, () => vigilTick(w, e));
  }
  return s;
}

/** Which way the hero faces: where they aim, else where they walk, else where they last faced. */
function heroFacing(w: World, s: Vigil): number {
  const inp = w.input;
  if (inp.aim !== null) s.face = inp.aim;
  else if (Math.hypot(inp.mx, inp.my) > 0.15) s.face = Math.atan2(inp.my, inp.mx);
  return s.face;
}

/** Whether the hero is looking toward (x, y). */
function watched(w: World, s: Vigil, x: number, y: number): boolean {
  const p = w.player;
  let off = Math.abs(Math.atan2(y - p.y, x - p.x) - s.face) % TAU;
  if (off > Math.PI) off = TAU - off;
  return off < SEEN;
}

const crumble = (w: World, d: Enemy): void => {
  d.hp = 0;
  d.dead = true;
  d.deathT = 0;
  w.fxBurst(d.x, d.y - 6, ASH, 12, 12);
};

function vigilTick(w: World, e: Enemy): void {
  const s = VIGILS.get(e);
  if (!s) return;
  if (!alive(w, e)) {
    // her vigil ends with her
    for (const d of s.dead) if (!d.dead) crumble(w, d);
    VIGILS.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  const p = w.player;
  s.dead = s.dead.filter((d) => !d.dead && w.enemies.includes(d));
  heroFacing(w, s);
  s.fxT -= dt;
  const fx = s.fxT <= 0;
  if (fx) s.fxT = 0.25;
  for (const d of s.dead) {
    if (d.state === 'spawn' || p.dead) continue;
    if (watched(w, s, d.x, d.y)) {
      // faced: still as stone
      if (fx) w.addFx({ kind: 'ring', x: d.x, y: d.y, life: 0.3, size: 10, color: ASH });
      continue;
    }
    const dd = dist(d.x, d.y, p.x, p.y);
    if (dd < d.r + p.r + 4) {
      // it reaches the hero: seizes them, and crumbles
      if (hurtPlayer(w, e.dmg * s.mul, { fromX: d.x, fromY: d.y, knock: 60, status: { status: 'stun', dur: 0.7, power: 1 }, source: e })) w.text(p.x, p.y - 30, 'Seized from behind!', '#d8c8ff', true);
      crumble(w, d);
      w.sfx('soul', 0.6);
      continue;
    }
    // the hero's back is turned: it creeps after them (round whatever stands in the way)
    const step = Math.min(dd, s.creep * dt);
    let m = moveCircle(w.map, d.x, d.y, d.r, ((p.x - d.x) / dd) * step, ((p.y - d.y) / dd) * step);
    if (Math.hypot(m.x - d.x, m.y - d.y) < step * 0.5) {
      const round = flowStep(w.map, w.flow, d.x, d.y);
      if (round) m = moveCircle(w.map, d.x, d.y, d.r, round.x * step, round.y * step);
    }
    d.x = m.x;
    d.y = m.y;
    d.face = Math.atan2(p.y - d.y, p.x - d.x);
    if (fx) w.addFx({ kind: 'spark', x: d.x + (w.rand() - 0.5) * 8, y: d.y - 10, vx: 0, vy: -18, life: 0.45, size: 2, color: VIOLET });
  }
  w.after(0, () => vigilTick(w, e));
}

/**
 * The vigil: `count` of the kneeling dead rise about the hall, well away from the hero; while the hero's back is
 * turned they creep after them at `creep` px/s, and one that reaches them strikes for `mul` of her blow.
 */
const vigil: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const s = vigilOf(w, e);
  if (pt.step === 0) {
    s.creep = k.num('creep', 44);
    s.mul = k.num('mul', 1.2);
    const n = Math.min(k.num('count', 4), MOST_DEAD - s.dead.length);
    const p = w.player;
    const tiles = w.map.roomTiles[e.room] ?? [];
    let placed = 0;
    for (let tries = 0; tries < n * 14 && placed < n && tiles.length; tries++) {
      const t = tiles[Math.floor(w.rand() * tiles.length)]!;
      const x = ((t % w.map.w) + 0.5) * TILE;
      const y = (Math.floor(t / w.map.w) + 0.5) * TILE;
      if (w.map.solid[t] || dist(x, y, p.x, p.y) < 110 || s.dead.some((d) => dist(d.x, d.y, x, y) < 40)) continue;
      const before = w.enemies.length;
      w.spawnAdd(MOURNER, x, y, e.room);
      const d = w.enemies.length > before ? w.enemies[w.enemies.length - 1]! : null;
      if (d && d.def.id === MOURNER) {
        s.dead.push(d);
        placed++;
      }
    }
    w.text(e.x, e.y - e.r - 18, 'Keep your vigil, my dead. Watch him when he does not watch you.', ASH, true);
    w.text(p.x, p.y - 30, 'They move only while your back is turned!', '#e8e0ff', false);
    w.sfx('soul', 0.7);
    pt.data.t1 = pt.t;
    pt.step = 1;
  } else if (pt.t >= pt.data.t1! + 0.8) k.end();
};

/** Lady Cendre's dead keeping vigil (for tests). */
export const vigilOfCendre = (e: Enemy): Enemy[] => (VIGILS.get(e)?.dead ?? []).filter((d) => !d.dead);

export const DUSKSPIRE_PATTERNS: Record<string, PatternFn> = {
  /**
   * The Hollow Guard's oath: its guardsmen answer, and while any of them stand its shield keeps mending.
   * Knobs: guards (enemy id), count, shield (share of its health), regen (shield a second per guard).
   */
  'dusk:oath': (w, e, _dt, k) => {
    const s = fight(w, e);
    if (k.pt.step === 0) {
      const id = k.str('guards', 'hollow-guardsman');
      const n = k.num('count', 2);
      for (let i = 0; i < n; i++) {
        const a = (TAU * i) / n + w.rand();
        const to = castRay(w.map, e.x, e.y, 8, a, 40);
        w.spawnAdd(id, to.x, to.y, e.room);
      }
      s.oath = { max: e.maxHp * k.num('shield', 0.12), regen: e.maxHp * k.num('regen', 0.004), guards: id };
      w.text(e.x, e.y - e.r - 14, 'THE OATH HOLDS', '#d8c8ff', true);
      w.sfx('summon', 0.6);
      k.pt.step = 1;
    } else if (k.pt.t >= 0.9) k.end();
  },

  /**
   * Chains of souls: a shackle rises at the pillar nearest the hero and binds them to it; break it (it
   * has a little health) or wait out `time`. Knobs: count (shackles at once), r (chain length), time.
   */
  'dusk:chains': (w, e, _dt, k) => {
    const s = fight(w, e);
    if (k.pt.step === 0) {
      const p = w.player;
      const all = pillars(w, e).sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y));
      const n = Math.max(1, Math.min(k.num('count', 1), all.length || 1));
      for (let i = 0; i < n; i++) {
        const at = all[i] ?? castRay(w.map, p.x, p.y, 6, w.rand() * TAU, 44);
        w.addTelegraph({ shape: 'circle', x: at.x, y: at.y, r: 12, r2: 0, angle: 0, len: 0, dur: 0.7, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
        w.after(0.7, () => {
          if (!alive(w, e)) return;
          const m = w.addEnemy('soul-shackle', at.x, at.y, e.level, { room: e.room, pack: -1, spawn: true, post: true });
          m.aggro = true;
          s.shackles.push({ id: m.id, r: k.num('r', 50), until: w.time + k.num('time', 9) });
        });
      }
      w.text(e.x, e.y - e.r - 14, 'KNEEL', VIOLET, true);
      w.sfx('summon', 0.5);
      k.pt.step = 1;
    } else if (k.pt.t >= 1) k.end();
  },

  /**
   * Hollowbrand's rot: pools land on circles and stay for the rest of the fight, creeping outward; past
   * ROT_MOST the oldest dries as a new one lands, so the hall never rots wall to wall.
   * Knobs: count, r (start), max, grow (px a second), mul (damage per tick), spread (px from the hero).
   */
  'dusk:rot': (w, e, _dt, k) => {
    const s = fight(w, e);
    if (k.pt.step === 0) {
      const p = w.player;
      const n = k.num('count', 3);
      for (let i = 0; i < n; i++) {
        const a = w.rand() * TAU;
        const d = i === 0 ? 0 : 20 + w.rand() * k.num('spread', 70);
        const to = castRay(w.map, p.x, p.y, 6, a, d);
        const r = k.num('r', 18);
        w.addTelegraph({ shape: 'circle', x: to.x, y: to.y, r, r2: 0, angle: 0, len: 0, dur: 1.1, dmg: e.dmg * 0.8, knock: 60, tone: 'enemy', owner: -1, linger: 0 });
        w.after(1.1, () => {
          if (!alive(w, e)) return;
          const f = w.spawnField({ x: to.x, y: to.y, r, dur: 9999, tick: 0.5, dmg: e.dmg * k.num('mul', 0.22), type: 'shadow', status: { status: 'chill', dur: 0.8, power: 0.3 }, look: 'poison', hostile: true, depth: 0, spec: null, onHit: false });
          s.rots.push({ f, max: k.num('max', 34), grow: k.num('grow', 1.2) });
          for (const old of s.rots.splice(0, Math.max(0, s.rots.length - ROT_MOST))) old.f.t = Math.min(old.f.t, 0.6);
          w.fxBurst(to.x, to.y, ROT, 10, r);
        });
      }
      w.sfx('slam', 0.5);
      k.pt.step = 1;
    } else if (k.pt.t >= 1.3) k.end();
  },

  /**
   * The Hollowing: from now on the hero loses `pct` of their health every second while Vaelor stands,
   * and their healing is cut by `cut` (each phase sets both anew; it stops only with him).
   */
  'dusk:hollowing': (w, e, _dt, k) => {
    const s = fight(w, e);
    if (k.pt.step === 0) {
      const pct = k.num('pct', 0.004);
      if (!s.drain || s.drain.pct < pct) w.text(w.player.x, w.player.y - 26, s.drain ? 'THE HOLLOWING DEEPENS' : 'THE HOLLOWING', VIOLET, true);
      s.drain = { pct, cut: k.num('cut', 0), next: s.drain?.next ?? w.time + 1 };
      k.pt.step = 1;
    } else if (k.pt.t >= 0.3) k.end();
  },

  /**
   * The King's toll: a knell that fills the whole hall after a long wind-up. Nowhere is out of it; only a
   * dodge in its last half second goes through. Knobs: wind, mul.
   */
  'dusk:toll': (w, e, _dt, k) => {
    const p = w.player;
    if (k.pt.step === 0) {
      const wind = k.num('wind', 1.8);
      // the shape only shows it coming: whether it lands is decided below
      w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: 640, r2: 0, angle: 0, len: 0, dur: wind, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
      w.text(e.x, e.y - e.r - 14, 'THE KING’S TOLL', '#ff4a8a', true);
      w.sfx('windup', 0.7);
      k.pt.data.wind = wind;
      k.pt.data.safe = 0;
      k.pt.step = 1;
    } else if (k.pt.step === 1) {
      // any dodge (any moment out of reach) in its last half second goes through it
      if (k.pt.t >= k.pt.data.wind! - 0.5 && p.iframe > 0) k.pt.data.safe = 1;
      if (k.pt.t >= k.pt.data.wind!) {
        w.shake(8);
        w.fxBurst(e.x, e.y, VIOLET, 30, 120);
        w.sfx('slam', 0.8);
        if (!k.pt.data.safe && !p.dead) hurtPlayer(w, e.dmg * k.num('mul', 2), { source: e });
        else if (!p.dead) w.text(p.x, p.y - 26, 'THROUGH', '#d8c8ff', false);
        k.pt.step = 2;
      }
    } else if (k.pt.step === 2 && k.pt.t >= k.pt.data.wind! + 0.4) k.end();
  },

  /**
   * Souls torn from the hero: `count` of them rise round the hero and drift back to Vaelor; each that
   * reaches him mends `heal` of his health. Knobs: count, heal, speed, far (least distance from him).
   */
  'dusk:harvest': (w, e, _dt, k) => {
    const s = fight(w, e);
    if (k.pt.step === 0) {
      const p = w.player;
      const n = k.num('count', 3);
      // they tear loose on the hero's side of the hall, never in his reach
      const a0 = Math.atan2(p.y - e.y, p.x - e.x);
      const far = Math.max(k.num('far', 110), dist(p.x, p.y, e.x, e.y) + 16);
      for (let i = 0; i < n; i++) {
        const to = castRay(w.map, e.x, e.y, 6, a0 + (i - (n - 1) / 2) * 0.5, far);
        const m = w.addEnemy(k.str('enemy', 'torn-soul'), to.x, to.y, e.level, { room: e.room, pack: -1, spawn: true, post: true });
        m.aggro = true;
        s.souls.push({ id: m.id, heal: k.num('heal', 0.03), speed: k.num('speed', 24) });
      }
      w.text(p.x, p.y - 26, 'YOUR SOUL IS HIS', VIOLET, true);
      w.sfx('summon', 0.6);
      k.pt.step = 1;
    } else if (k.pt.t >= 0.8) k.end();
  },

  /** The dead climb out of the walls: `count` of `enemy` along the room's edges. */
  'dusk:ghouls': (w, e, _dt, k) => {
    if (k.pt.step === 0) {
      const id = k.str('enemy', 'hollow-ghoul');
      const n = k.num('count', 4);
      for (let i = 0; i < n; i++) {
        const at = wallSpot(w, e);
        if (at) w.spawnAdd(id, at.x, at.y, e.room);
      }
      w.text(e.x, e.y - e.r - 14, 'RISE', VIOLET, true);
      w.sfx('summon', 0.6);
      k.pt.step = 1;
    } else if (k.pt.t >= 0.8) k.end();
  },

  /**
   * A ring of frost closes in on the middle of the hall in steps (everything outside it freezes), while
   * spikes of ice rise inside. Knobs: from, to (radius), steps, step (seconds each), spikes (a step), mul.
   */
  'dusk:frost-ring': (w, e, _dt, k) => {
    const b = e.boss!;
    const steps = k.num('steps', 4);
    const each = k.num('step', 1.3);
    if (k.pt.step === 0) {
      k.pt.data.n = 0;
      k.pt.data.t0 = k.pt.t;
      w.text(e.x, e.y - e.r - 14, 'THE FROST CLOSES', FROST, true);
      k.pt.step = 1;
    }
    if (k.pt.step === 1 && k.pt.t >= k.pt.data.t0! + (k.pt.data.n! === 0 ? 0 : each)) {
      const n = k.pt.data.n!;
      if (n >= steps) {
        k.pt.step = 2;
        k.pt.data.t1 = k.pt.t;
      } else {
        const r0 = k.num('from', 150);
        const r1 = k.num('to', 64);
        const r = r0 + ((r1 - r0) * n) / Math.max(1, steps - 1);
        // the frozen ground outside the ring
        w.addTelegraph({ shape: 'ring', x: b.cx, y: b.cy, r: r + 260, r2: r, angle: 0, len: 0, dur: each * 0.95, dmg: e.dmg * k.num('mul', 1.1), knock: 0, tone: 'enemy', owner: -1, linger: 0 });
        // spikes inside, one under the hero
        const spikes = k.num('spikes', 3);
        const p = w.player;
        for (let i = 0; i < spikes; i++) {
          const a = w.rand() * TAU;
          const d = i === 0 ? 0 : w.rand() * r * 0.8;
          const x = i === 0 ? p.x : b.cx + Math.cos(a) * d;
          const y = i === 0 ? p.y : b.cy + Math.sin(a) * d;
          w.addTelegraph({ shape: 'circle', x, y, r: 16, r2: 0, angle: 0, len: 0, dur: each * 0.9, dmg: e.dmg * 1.2, knock: 80, tone: 'enemy', owner: -1, linger: 0 });
        }
        w.sfx('freeze', 0.6);
        k.pt.data.n = n + 1;
        k.pt.data.t0 = k.pt.t;
      }
    } else if (k.pt.step === 2 && k.pt.t >= k.pt.data.t1! + 0.4) k.end();
  },

  /** The Last King: his doom begins to fall (`time` seconds); if he still stands when it lands, all is lost. */
  'dusk:doom': (w, e, _dt, k) => {
    const s = fight(w, e);
    if (k.pt.step === 0) {
      if (!s.doom) {
        s.doom = { at: w.time + k.num('time', 45), said: -1 };
        w.emit({ t: 'banner', text: 'The Last King', sub: 'Bring him down before his doom falls' });
        w.shake(6);
        w.sfx('roar');
      }
      k.pt.step = 1;
    } else if (k.pt.t >= 1) k.end();
  },
  'dusk:vigil': vigil,
};
