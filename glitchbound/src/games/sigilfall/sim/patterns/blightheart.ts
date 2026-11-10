import { dist, dist2, inCone, TAU, turnToward } from '../../core/math';
import type { StatusId } from '../../data/types';
import { hurtPlayer, killEnemy } from '../combat';
import { castRay, circleHitsWall, moveCircle, TILE, tileAt } from '../map';
import type { Enemy, Field, Telegraph } from '../types';
import type { World } from '../world';
import type { PatternFn } from './kit';

/**
 * Boss attacks of Blightheart: ids start with 'blight:'.
 *
 * The Rotwood Colossus, a hill of rotten heartwood on root-legs: it rears up and falls on the hero full
 * length, then lies there a moment getting up (`topple`); it shakes spore pods out of its canopy that
 * swell where they land and burst into clouds unless they are popped first (`pods`); and once it has
 * torn its roots out of the floor it drives them back in, and they come up under the hero again and
 * again while it stands rooted (`taproot`).
 *
 * The Withered Queen, the wood's guardian who took the Hallow King's promise that she would never
 * fade. Her thorns grow across the floor: a briar that creeps toward the hero and curls after them
 * (`briar`), and seeds that grow into thickets and put out runners (`garden`); the briar stays, and
 * standing in it bites and holds. Spores rise from the floor and drift after the hero as poison clouds
 * (`spores`). Her favor is a kiss blown down a cone (`kiss`): caught in it, the hero is charmed and
 * walks to her, through her thorns, until they dodge free; if they don't, her thorns close round her.
 * And she withers (`wither`): her petals fall, she drinks her own court dry to keep standing, the
 * Sigil of Thorns grown into her starts to beat (a ring of thorns rolls out from her with every beat),
 * and at the last she fades of herself, a little every moment.
 *
 * What lasts beyond a pattern (the thorns, the clouds, the pods, the Sigil's beat, the fading) is kept
 * per boss here and run by a small ticker (World.after, once a step) for as long as the fight lasts. A
 * phase change sweeps the floor like every other attack (her garden withers with her); a win, or the
 * room resetting after a defeat, takes the rest.
 */

const PINK = '#ff6ac8';
const PETAL = '#ff9ad8';
const ROT = '#6a4a2a';
const BARK = '#8a6a44';
const THORN = '#c84a8a';
const SPORE = '#b6e36b';
const POD = 'rotwood-pod';
const WITHERED = 'the-withered-queen-withered';
/** At most this many thorn patches at once: the oldest withers when a new one would go past it. */
const MAX_THORNS = 26;
/** At most this many spore clouds at once. */
const MAX_CLOUDS = 8;
/** Thorns bite every half second (this share of the Queen's blow) and hold you back. */
const THORN_BITE = 0.11;
const THORN_HOLD = { status: 'chill' as StatusId, dur: 0.6, power: 0.4 };
/** A spore cloud chokes every half second for this share of her blow (however many you stand in). */
const SPORE_BITE = 0.1;

interface Thorn {
  f: Field;
  max: number;
  grow: number;
  /** A grown thicket puts out a runner every `spread` s (0: never). */
  spread: number;
  seedT: number;
}
interface Cloud {
  f: Field;
  drift: number;
}
interface Pod {
  pod: Enemy;
  tg: Telegraph;
  cloud: number;
  done: boolean;
}
interface Fight {
  last: number;
  thorns: Thorn[];
  clouds: Cloud[];
  pods: Pod[];
  bite: number;
  choke: number;
  fxT: number;
  /** The Sigil's beat: a ring of thorns every `beat` s (0: not yet). */
  beat: number;
  beatT: number;
  said: number;
  /** She fades of herself: this share of her health a second. */
  fade: number;
}

const FIGHTS = new WeakMap<Enemy, Fight>();

/** The fight goes on: the boss stands, isn't falling, its room hasn't reset (and, if given, it is still in that phase). */
function fighting(w: World, e: Enemy, phase?: number): boolean {
  const b = e.boss;
  return !!b && !e.dead && b.dying <= 0 && w.enemies.includes(e) && (phase === undefined || b.phase === phase);
}

const standing = (w: World, x: Enemy): boolean => !x.dead && x.hp > 0 && w.enemies.includes(x);

/** Gone without a fight (no reward): a pod that burst, a courtier drunk dry. */
function quietly(x: Enemy): void {
  x.hp = 0;
  x.dead = true;
  x.deathT = 0;
}

const faceTo = (e: Enemy, a: number): void => {
  e.face = Math.cos(a) < 0 ? Math.PI : 0;
};

/** Thorns and whips make the hero bleed (a tenth of the boss's blow a second). */
const bleed = (e: Enemy, dur = 3): { status: StatusId; dur: number; power: number } => ({ status: 'bleed', dur, power: Math.max(2, Math.round(e.dmg * 0.1)) });
const poison = (e: Enemy): { status: StatusId; dur: number; power: number } => ({ status: 'poison', dur: 2, power: Math.max(2, Math.round(e.dmg * 0.1)) });

/** A spot on the boss room's open floor with room for a circle of radius r. */
function onFloor(w: World, e: Enemy, x: number, y: number, r: number): boolean {
  const i = tileAt(w.map, x, y);
  return i >= 0 && w.map.room[i] === e.room + 1 && !circleHitsWall(w.map, x, y, r);
}

/** A random open spot of the boss room's floor, away from the given ones (or null after a few tries). */
function anySpot(w: World, e: Enemy, r: number, away: { x: number; y: number }[], gap: number): { x: number; y: number } | null {
  const tiles = w.map.roomTiles[e.room] ?? [];
  for (let tries = 0; tries < 14 && tiles.length; tries++) {
    const t = tiles[Math.floor(w.rand() * tiles.length)]!;
    const x = ((t % w.map.w) + 0.5) * TILE + (w.rand() - 0.5) * 8;
    const y = (Math.floor(t / w.map.w) + 0.5) * TILE + (w.rand() - 0.5) * 8;
    if (onFloor(w, e, x, y, r) && away.every((q) => dist(q.x, q.y, x, y) > gap)) return { x, y };
  }
  return null;
}

/** A spot `d0`-`d1` px from the hero on the boss room's floor, away from the given ones (or null). */
function nearHero(w: World, e: Enemy, d0: number, d1: number, r: number, away: { x: number; y: number }[], gap: number): { x: number; y: number } | null {
  const p = w.player;
  for (let tries = 0; tries < 12; tries++) {
    const a = w.rand() * TAU;
    const d = d0 + w.rand() * (d1 - d0);
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d * 0.8;
    if (onFloor(w, e, x, y, r) && away.every((q) => dist(q.x, q.y, x, y) > gap)) return { x, y };
  }
  return null;
}

/* ------------------------------------------------------------ the lasting state */

function fight(w: World, e: Enemy): Fight {
  let s = FIGHTS.get(e);
  if (!s) {
    s = { last: w.time, thorns: [], clouds: [], pods: [], bite: 0, choke: 0, fxT: 0, beat: 0, beatT: 0, said: 0, fade: 0 };
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
    // won, or the room reset after a defeat: the thorns and the clouds wither, the pods with them
    const mine = new Set<Field>([...s.thorns.map((t) => t.f), ...s.clouds.map((c) => c.f)]);
    w.fields = w.fields.filter((f) => !mine.has(f));
    for (const q of s.pods) if (standing(w, q.pod)) quietly(q.pod);
    FIGHTS.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  tickThorns(w, e, s, dt);
  tickClouds(w, e, s, dt);
  tickPods(w, e, s);
  tickHeart(w, e, s, dt);
  w.after(0, () => tick(w, e));
}

/* ------------------------------------------------------------ thorns */

/**
 * A patch of thorns on the floor: it grows (`grow` px a second, up to `max`) for `life` s, and a grown
 * one puts out a runner toward the hero every `spread` s. The field only shows it: the bite is the
 * fight's (tickThorns), so patches that overlap don't bite twice.
 */
function addThorn(w: World, e: Enemy, x: number, y: number, r0: number, max: number, grow: number, life: number, spread: number): void {
  if (!onFloor(w, e, x, y, 2)) return;
  const s = fight(w, e);
  s.thorns = s.thorns.filter((t) => w.fields.includes(t.f));
  const live = s.thorns.filter((t) => t.f.t > 1);
  if (live.length >= MAX_THORNS) live.reduce((a, b) => (a.f.t < b.f.t ? a : b)).f.t = 1;
  const f = w.spawnField({ x, y, r: r0, dur: life, tick: 0.5, dmg: 0, type: 'nature', look: 'nature', hostile: true, depth: 0, spec: null, onHit: false });
  s.thorns.push({ f, max, grow, spread, seedT: spread });
}

function tickThorns(w: World, e: Enemy, s: Fight, dt: number): void {
  if (!s.thorns.length) return;
  s.thorns = s.thorns.filter((t) => w.fields.includes(t.f));
  const p = w.player;
  for (const t of s.thorns) {
    t.f.r = Math.min(t.max, t.f.r + t.grow * dt);
    // the garden spreads: a grown thicket sends a runner out toward the hero
    if (t.spread > 0 && t.f.r >= t.max - 0.5 && t.f.t > 3) {
      t.seedT -= dt;
      if (t.seedT <= 0) {
        t.seedT = t.spread * (0.8 + w.rand() * 0.4);
        const a = Math.atan2(p.y - t.f.y, p.x - t.f.x) + (w.rand() - 0.5) * 1.6;
        const d = t.f.r * 1.25;
        addThorn(w, e, t.f.x + Math.cos(a) * d, t.f.y + Math.sin(a) * d * 0.8, 6, t.max * 0.8, t.grow, Math.min(t.f.t, 20), 0);
        w.sfx('squish', 0.25);
      }
    }
  }
  // the thorns bite and hold whoever stands in them (not while dodging across)
  s.bite -= dt;
  if (s.bite <= 0 && !p.dead && !p.dash && s.thorns.some((t) => dist2(p.x, p.y, t.f.x, t.f.y) < (t.f.r + p.r * 0.5) ** 2)) {
    s.bite = 0.5;
    hurtPlayer(w, e.dmg * THORN_BITE, { status: THORN_HOLD });
  }
  // thorn tips glint in the patches
  s.fxT -= dt;
  if (s.fxT <= 0 && s.thorns.length) {
    s.fxT = 0.07;
    const t = s.thorns[Math.floor(w.rand() * s.thorns.length)]!;
    const a = w.rand() * TAU;
    const r = Math.sqrt(w.rand()) * t.f.r * 0.85;
    w.addFx({ kind: 'shard', x: t.f.x + Math.cos(a) * r, y: t.f.y + Math.sin(a) * r * 0.75, vx: 0, vy: -10, life: 0.45, size: w.rand() < 0.4 ? 2 : 1, color: w.rand() < 0.55 ? THORN : '#4a6a2a' });
  }
}

/* ------------------------------------------------------------ spore clouds */

function addCloud(w: World, e: Enemy, x: number, y: number, r: number, life: number, drift: number): void {
  if (!onFloor(w, e, x, y, 2)) return;
  const s = fight(w, e);
  s.clouds = s.clouds.filter((c) => w.fields.includes(c.f));
  if (s.clouds.length >= MAX_CLOUDS) s.clouds[0]!.f.t = Math.min(s.clouds[0]!.f.t, 0.4);
  const f = w.spawnField({ x, y, r, dur: life, tick: 0.5, dmg: 0, type: 'poison', look: 'poison', hostile: true, depth: 0, spec: null, onHit: false });
  s.clouds.push({ f, drift });
}

function tickClouds(w: World, e: Enemy, s: Fight, dt: number): void {
  if (!s.clouds.length) return;
  s.clouds = s.clouds.filter((c) => w.fields.includes(c.f));
  const p = w.player;
  // the clouds drift after the hero (slowly: you can always walk away from one)
  for (const c of s.clouds) {
    if (!c.drift || p.dead) continue;
    const a = Math.atan2(p.y - c.f.y, p.x - c.f.x);
    const nx = c.f.x + Math.cos(a) * c.drift * dt;
    const ny = c.f.y + Math.sin(a) * c.drift * dt;
    if (onFloor(w, e, nx, ny, 2)) {
      c.f.x = nx;
      c.f.y = ny;
    }
    if (w.rand() < dt * 6) w.addFx({ kind: 'smoke', x: c.f.x + (w.rand() - 0.5) * c.f.r, y: c.f.y + (w.rand() - 0.5) * c.f.r * 0.6, vx: 0, vy: -8, life: 0.8, size: 3, color: '#9ac04a' });
  }
  s.choke -= dt;
  if (s.choke <= 0 && !p.dead && s.clouds.some((c) => dist2(p.x, p.y, c.f.x, c.f.y) < (c.f.r + p.r * 0.5) ** 2)) {
    s.choke = 0.5;
    hurtPlayer(w, e.dmg * SPORE_BITE, { status: poison(e) });
  }
}

/* ------------------------------------------------------------ spore pods */

function tickPods(w: World, e: Enemy, s: Fight): void {
  if (!s.pods.length) return;
  for (const q of s.pods) {
    const live = !q.tg.dead && w.telegraphs.includes(q.tg);
    if (!standing(w, q.pod)) {
      // popped before it burst: a harmless puff
      if (live) {
        q.tg.dead = true;
        q.tg.dmg = 0;
        w.text(q.pod.x, q.pod.y - 16, 'POP!', SPORE, false);
        w.fxBurst(q.pod.x, q.pod.y - 4, SPORE, 10, 10);
        w.sfx('puff', 0.5);
      }
      q.done = true;
      continue;
    }
    if (live) {
      // it swells
      if (w.rand() < 0.15) w.addFx({ kind: 'spark', x: q.pod.x + (w.rand() - 0.5) * 8, y: q.pod.y - 6, vx: (w.rand() - 0.5) * 12, vy: -24, life: 0.4, size: 1, color: SPORE });
      continue;
    }
    // its circle landed (it burst) or was swept away (a phase change): either way the pod is spent
    if (q.tg.t >= q.tg.dur) {
      w.fxBurst(q.pod.x, q.pod.y - 4, SPORE, 18, q.tg.r * 0.6);
      w.sfx('explode', 0.5);
      addCloud(w, e, q.pod.x, q.pod.y, q.tg.r * 0.75, q.cloud, 0);
    }
    quietly(q.pod);
    q.done = true;
  }
  s.pods = s.pods.filter((q) => !q.done);
}

/* ------------------------------------------------------------ the Sigil's beat and the fading */

function tickHeart(w: World, e: Enemy, s: Fight, dt: number): void {
  const b = e.boss!;
  if (b.shift > 0) return;
  if (s.beat > 0) {
    s.beatT -= dt;
    if (s.beatT <= 0) {
      s.beatT = s.beat;
      const phase = b.phase;
      const wind = 0.75;
      w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: 34, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * 1.2, status: bleed(e), knock: 150, tone: 'rift', owner: e.id, linger: 0 });
      w.addFx({ kind: 'glow', x: e.x, y: e.y - 12, life: wind, size: 16, color: PINK });
      if (!s.said) {
        s.said = 1;
        w.callout('THE SIGIL OF THORNS BEATS', PINK);
      }
      w.sfx('beamCharge', 0.45);
      w.after(wind, () => {
        if (!fighting(w, e, phase)) return;
        // a ring of thorns rolls out from her across the whole room: dodge through it
        w.spawnWave(e.x, e.y, 115, 300, 8, e.dmg * 0.8);
        w.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.6, size: 60, color: PINK });
        w.sfx('quake', 0.5);
        w.shake(3);
      });
    }
  }
  if (s.fade > 0 && e.hp > e.maxHp * 0.01) {
    // she fades of herself, petals falling from her
    e.hp = Math.max(e.maxHp * 0.01, e.hp - e.maxHp * s.fade * dt);
    if (w.rand() < dt * 8) w.addFx({ kind: 'leaf', x: e.x + (w.rand() - 0.5) * 20, y: e.y - 20 - w.rand() * 8, vx: (w.rand() - 0.5) * 10, vy: 14, life: 1.2, size: 1, color: w.rand() < 0.6 ? PETAL : '#8a6a5a', a: w.rand() * TAU });
  }
}

/* ------------------------------------------------------------ the Rotwood Colossus */

/**
 * The fall: the Colossus rears up (a line `width` wide and up to `len` long, shown for `wind` s) and
 * comes down full length along it for `mul` of its blow (a hit dazes the hero a moment). Its body ends
 * up lying along the line, and it is down for `down` s, getting up. With `splinters`, the fall sheds
 * that many rotten splinters flying out all round where it lands.
 */
const topple: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const wind = k.num('wind', 1.2);
  if (pt.step === 0) {
    const a = k.aimAt();
    const end = castRay(w.map, e.x, e.y, 2, a, k.num('len', 130));
    const len = Math.max(e.r + 10, dist(e.x, e.y, end.x, end.y));
    pt.data.a = a;
    pt.data.len = len;
    w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: k.num('width', 44), angle: a, len, dur: wind, dmg: e.dmg * k.num('mul', 2), status: { status: 'stun', dur: 0.6, power: 1 }, knock: 160, tone: 'enemy', owner: -1, linger: 0 });
    faceTo(e, a);
    w.callout('TIMBER!', '#e8c890');
    w.sfx('windup', 0.8);
    pt.step = 1;
  } else if (pt.step === 1) {
    // it rears back, creaking, and leaves shake loose
    if (w.rand() < 0.3) w.addFx({ kind: 'leaf', x: e.x + (w.rand() - 0.5) * 30, y: e.y - 30, vx: (w.rand() - 0.5) * 20, vy: 18, life: 1, size: 1, color: w.rand() < 0.5 ? '#8a9a3a' : PETAL, a: w.rand() * TAU });
    if (pt.t < wind) return;
    const a = pt.data.a!;
    const fall = Math.min(pt.data.len! * 0.55, 72);
    const m = moveCircle(w.map, e.x, e.y, e.r, Math.cos(a) * fall, Math.sin(a) * fall);
    e.x = m.x;
    e.y = m.y;
    w.shake(6);
    w.sfx('slam');
    w.sfx('crumble', 0.6);
    const len = pt.data.len!;
    for (let i = 0; i < 18; i++) {
      const f = w.rand();
      w.addFx({ kind: 'rubble', x: e.x - Math.cos(a) * fall + Math.cos(a) * len * f, y: e.y - Math.sin(a) * fall + Math.sin(a) * len * f, vx: (w.rand() - 0.5) * 90, vy: -30 - w.rand() * 60, life: 0.6, size: 2, color: w.rand() < 0.5 ? BARK : ROT });
    }
    const n = k.num('splinters', 0);
    for (let i = 0; i < n; i++) {
      const b = (TAU * i) / n + w.rand() * 0.2;
      w.spawnProjectile({ x: e.x + Math.cos(b) * e.r, y: e.y - 4 + Math.sin(b) * e.r, vx: Math.cos(b) * 150, vy: Math.sin(b) * 150, r: 3, life: 170, dmg: e.dmg * 0.7, type: 'physical', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'spear', color: BARK, hostile: true, homing: 0, child: false, knock: 0 });
    }
    k.end();
    e.boss!.dazed = k.num('down', 2.2);
    w.callout('IT’S DOWN!', '#ffe066');
  }
};

/**
 * Spore pods: the Colossus shakes `count` pods out of its canopy, one beside the hero and the rest
 * about the room. Each swells for `fuse` s (its circle, `r`, fills) and then bursts for `mul` of the
 * Colossus's blow, leaving a cloud of spores for `cloud` s; popped first, it only puffs.
 */
const pods: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  if (pt.step === 0) {
    const s = fight(w, e);
    const n = k.num('count', 3);
    const r = k.num('r', 36);
    const fuse = k.num('fuse', 4.5);
    const p = w.player;
    const placed: { x: number; y: number }[] = [{ x: e.x, y: e.y }];
    for (let i = 0; i < n; i++) {
      const at = i === 0 ? nearHero(w, e, 44, 70, 8, placed, r * 1.4) : anySpot(w, e, 8, [...placed, { x: p.x, y: p.y }], r * 1.6);
      if (!at) continue;
      placed.push(at);
      w.spawnAdd(POD, at.x, at.y, e.room);
      const pod = w.enemies[w.enemies.length - 1];
      if (pod?.def.id !== POD) continue;
      const tg = w.addTelegraph({ shape: 'circle', x: pod.x, y: pod.y, r, r2: 0, angle: 0, len: 0, dur: fuse + i * 0.15, dmg: e.dmg * k.num('mul', 1.6), status: poison(e), knock: 80, tone: 'enemy', owner: -1, linger: 0 });
      s.pods.push({ pod, tg, cloud: k.num('cloud', 4), done: false });
      // the pod falls out of the canopy
      w.addFx({ kind: 'ember', x: pod.x, y: pod.y - 90, vx: 0, vy: 90 / 0.6, life: 0.6, size: 3, color: SPORE });
    }
    for (let i = 0; i < 14; i++) w.addFx({ kind: 'leaf', x: e.x + (w.rand() - 0.5) * 36, y: e.y - 26 - w.rand() * 10, vx: (w.rand() - 0.5) * 30, vy: 16, life: 1.1, size: 1, color: w.rand() < 0.5 ? '#8a9a3a' : SPORE, a: w.rand() * TAU });
    w.callout('SPORE PODS! Pop them!', SPORE);
    w.sfx('summon', 0.6);
    w.shake(2);
    pt.step = 1;
  } else if (pt.t >= 0.9) k.end();
};

/**
 * Taproots: the Colossus drives its roots into the floor and stands rooted while they run: `count`
 * times, every `every` s, a root breaks up under the hero (a circle `r` that lands after `wind` s for
 * `mul` of its blow, and holds whoever it catches); the last one is bigger.
 */
const taproot: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const count = k.num('count', 7);
  const every = k.num('every', 0.5);
  const wind = k.num('wind', 0.85);
  if (pt.step === 0) {
    w.callout('ROOTS!', '#e8c890');
    w.sfx('quake', 0.7);
    w.shake(3);
    w.fxBurst(e.x, e.y + e.r * 0.6, BARK, 14, e.r);
    pt.data.n = 0;
    pt.step = 1;
  }
  const n = pt.data.n ?? 0;
  if (n < count && pt.t >= 0.35 + n * every) {
    const p = w.player;
    const phase = e.boss!.phase;
    if (!p.dead && onFloor(w, e, p.x, p.y, 1)) {
      const last = n === count - 1;
      const r = k.num('r', 22) * (last ? 1.5 : 1);
      const x = p.x;
      const y = p.y;
      w.addTelegraph({ shape: 'circle', x, y, r, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1.3) * (last ? 1.25 : 1), status: { status: 'chill', dur: 1, power: 0.5 }, knock: 90, tone: 'enemy', owner: -1, linger: 0 });
      // the root runs under the floor from the Colossus to the spot
      w.addFx({ kind: 'zap', x: e.x, y: e.y + e.r * 0.5, x2: x, y2: y, life: 0.3, size: 1, color: ROT });
      w.after(wind, () => {
        if (!fighting(w, e, phase)) return;
        for (let j = 0; j < 9; j++) w.addFx({ kind: 'rubble', x: x + (w.rand() - 0.5) * r, y: y - 2, vx: (w.rand() - 0.5) * 60, vy: -40 - w.rand() * 50, life: 0.5, size: 2, color: w.rand() < 0.5 ? BARK : ROT });
        w.sfx('crumble', 0.35);
      });
    }
    pt.data.n = n + 1;
  }
  if (pt.t >= 0.35 + count * every + wind) k.end();
};

/* ------------------------------------------------------------ the Withered Queen */

/**
 * Creeping briar: she drives her scepter into the floor and `lines` briars (fanned `spread` apart) grow
 * from her toward the hero, a step of `step` px every `gap` s, `count` steps, each head turning after
 * the hero by up to `turn` a step. Each step is a circle (`r`) that bursts after `wind` s for `mul` of
 * her blow (and bleeds), and leaves thorns there for `life` s. A briar stops at a wall or a pillar.
 */
const briar: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const lines = k.num('lines', 1);
  const wind = k.num('wind', 0.8);
  if (pt.step === 0) {
    const a0 = k.aimAt();
    const spread = k.num('spread', 0.7);
    for (let i = 0; i < lines; i++) {
      const a = a0 + (i - (lines - 1) / 2) * spread;
      pt.data[`x${i}`] = e.x + Math.cos(a) * (e.r + 4);
      pt.data[`y${i}`] = e.y + Math.sin(a) * (e.r + 4);
      pt.data[`a${i}`] = a;
      pt.data[`on${i}`] = 1;
    }
    pt.data.n = 0;
    faceTo(e, a0);
    w.addFx({ kind: 'glow', x: e.x + Math.cos(e.face) * 8, y: e.y - 14, life: 0.4, size: 12, color: PINK });
    w.text(e.x, e.y - e.r - 20, 'THE BRIAR GROWS!', PINK, false);
    w.sfx('windup', 0.6);
    pt.step = 1;
  } else if (pt.step === 1) {
    const n = pt.data.n!;
    if (pt.t < 0.25 + n * k.num('gap', 0.09)) return;
    const p = w.player;
    const phase = e.boss!.phase;
    const step = k.num('step', 18);
    const r = k.num('r', 15);
    const life = k.num('life', 9);
    let growing = 0;
    for (let i = 0; i < lines; i++) {
      if (!pt.data[`on${i}`]) continue;
      const x = pt.data[`x${i}`]!;
      const y = pt.data[`y${i}`]!;
      // the head curls after the hero
      const a = turnToward(pt.data[`a${i}`]!, Math.atan2(p.y - y, p.x - x), k.num('turn', 0.3));
      const nx = x + Math.cos(a) * step;
      const ny = y + Math.sin(a) * step;
      if (!onFloor(w, e, nx, ny, 3)) {
        pt.data[`on${i}`] = 0;
        continue;
      }
      growing += 1;
      pt.data[`x${i}`] = nx;
      pt.data[`y${i}`] = ny;
      pt.data[`a${i}`] = a;
      w.addTelegraph({ shape: 'circle', x: nx, y: ny, r, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1.1), status: bleed(e), knock: 40, tone: 'enemy', owner: -1, linger: 0 });
      w.after(wind, () => {
        if (!fighting(w, e, phase)) return;
        addThorn(w, e, nx, ny, r * 0.75, r, 2, life, 0);
        for (let j = 0; j < 4; j++) w.addFx({ kind: 'shard', x: nx + (w.rand() - 0.5) * r, y: ny - 2, vx: (w.rand() - 0.5) * 30, vy: -40 - w.rand() * 30, life: 0.35, size: 2, color: THORN });
      });
    }
    if (growing && n % 3 === 0) w.sfx('squish', 0.3);
    pt.data.n = n + 1;
    if (pt.data.n >= k.num('count', 12) || !growing) {
      pt.data.t1 = pt.t;
      pt.step = 2;
    }
  } else if (pt.step === 2 && pt.t >= pt.data.t1! + wind + 0.2) k.end();
};

/**
 * Her garden: `seeds` seeds burst out of the floor (two by the hero, the rest about the room; circles
 * `r` landing after `wind` s for `mul` of her blow), and each grows into a thicket (`grow` px a second
 * up to `max`) that stays `life` s and, once grown, sends a runner of thorns toward the hero every
 * `spread` s.
 */
const garden: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  if (pt.step === 0) {
    const n = k.num('seeds', 6);
    const r = k.num('r', 16);
    const wind = k.num('wind', 1.1);
    const phase = e.boss!.phase;
    const placed: { x: number; y: number }[] = [{ x: e.x, y: e.y }];
    for (let i = 0; i < n; i++) {
      const at = i < 2 ? nearHero(w, e, 26, 70, 4, placed, 46) : anySpot(w, e, 4, placed, 56);
      if (!at) continue;
      placed.push(at);
      const dur = wind + i * 0.07;
      w.addTelegraph({ shape: 'circle', x: at.x, y: at.y, r, r2: 0, angle: 0, len: 0, dur, dmg: e.dmg * k.num('mul', 1.1), status: bleed(e), knock: 50, tone: 'enemy', owner: -1, linger: 0 });
      w.after(dur, () => {
        if (!fighting(w, e, phase)) return;
        addThorn(w, e, at.x, at.y, r * 0.8, k.num('max', 30), k.num('grow', 2.5), k.num('life', 40), k.num('spread', 5));
        w.fxBurst(at.x, at.y - 2, THORN, 8, r * 0.6);
      });
    }
    w.callout('MY GARDEN GROWS!', PINK);
    for (let i = 0; i < 10; i++) w.addFx({ kind: 'leaf', x: e.x + (w.rand() - 0.5) * 24, y: e.y - 22, vx: (w.rand() - 0.5) * 40, vy: 10, life: 1, size: 1, color: PETAL, a: w.rand() * TAU });
    w.sfx('summon', 0.6);
    pt.step = 1;
  } else if (pt.t >= 0.8) k.end();
};

/**
 * Spores: `count` blooms open in the floor on and around the hero (circles `r`, bursting after `wind`
 * s for `mul` of her blow and poisoning), and each leaves a cloud of spores for `cloud` s that drifts
 * after the hero at `drift` px a second.
 */
const spores: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  if (pt.step === 0) {
    const n = k.num('count', 5);
    const r = k.num('r', 26);
    const wind = k.num('wind', 1.3);
    const phase = e.boss!.phase;
    const p = w.player;
    const placed: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const at = i === 0 && onFloor(w, e, p.x, p.y, 2) ? { x: p.x, y: p.y } : nearHero(w, e, 40, 120, 4, placed, r * 1.8);
      if (!at) continue;
      placed.push(at);
      const dur = wind + i * 0.08;
      w.addTelegraph({ shape: 'circle', x: at.x, y: at.y, r, r2: 0, angle: 0, len: 0, dur, dmg: e.dmg * k.num('mul', 1), status: poison(e), knock: 40, tone: 'enemy', owner: -1, linger: 0 });
      for (let j = 0; j < 3; j++) w.after(j * 0.3, () => fighting(w, e, phase) && w.addFx({ kind: 'spark', x: at.x + (w.rand() - 0.5) * r, y: at.y, vx: 0, vy: -20, life: 0.5, size: 1, color: SPORE }));
      w.after(dur, () => {
        if (!fighting(w, e, phase)) return;
        w.fxBurst(at.x, at.y - 2, SPORE, 12, r * 0.6);
        addCloud(w, e, at.x, at.y, r * 0.85, k.num('cloud', 5), k.num('drift', 16));
      });
    }
    w.callout('SPORES!', SPORE);
    w.sfx('puff', 0.8);
    pt.step = 1;
  } else if (pt.t >= 0.7) k.end();
};

/**
 * Her favor: she blows a kiss down a cone (`len` long, half-angle `arc`, shown for `wind` s). Caught in
 * it, the hero is charmed: for `time` s they walk to her at `pull` px a second, whatever they would
 * rather do, until they dodge (or dash) free. If they don't, her thorns close round her: a circle `er`
 * that lands after `ewind` s for `emul` of her blow.
 */
const kiss: PatternFn = (w, e, dt, k) => {
  const { pt } = k;
  const p = w.player;
  const len = k.num('len', 170);
  const arc = k.num('arc', 0.32);
  const wind = k.num('wind', 0.95);
  if (pt.step === 0) {
    const a = k.aimAt();
    pt.data.a = a;
    w.addTelegraph({ shape: 'cone', x: e.x, y: e.y, r: len, r2: arc, angle: a, len: 0, dur: wind, dmg: 0, knock: 0, tone: 'rift', owner: -1, linger: 0 });
    faceTo(e, a);
    w.callout('“Come. Kneel.”', PETAL);
    w.addFx({ kind: 'glow', x: e.x + Math.cos(a) * 6, y: e.y - 16, life: wind, size: 10, color: PINK });
    w.sfx('beamCharge', 0.5);
    pt.step = 1;
  } else if (pt.step === 1) {
    if (pt.t < wind) return;
    const a = pt.data.a!;
    // petals blown down the cone
    for (let i = 0; i < 22; i++) {
      const b = a + (w.rand() - 0.5) * arc * 2;
      const s = 80 + w.rand() * 140;
      w.addFx({ kind: 'leaf', x: e.x + Math.cos(a) * 8, y: e.y - 12, vx: Math.cos(b) * s, vy: Math.sin(b) * s * 0.75, life: 0.7, size: 1, color: w.rand() < 0.6 ? PETAL : PINK, a: w.rand() * TAU });
    }
    w.sfx('soul', 0.6);
    pt.data.t1 = pt.t;
    if (!p.dead && p.iframe <= 0 && !p.dash && inCone(p.x, p.y, e.x, e.y, a, arc, len + p.r * 0.5)) {
      w.text(p.x, p.y - 30, 'CHARMED! Dodge to break free!', PINK, true);
      w.sfx('blink', 0.5);
      pt.step = 2;
    } else pt.step = 9;
  } else if (pt.step === 2) {
    if (p.dead) {
      k.end();
      return;
    }
    if (p.dash) {
      // dodged free
      w.text(p.x, p.y - 26, 'FREE!', '#ffffff', true);
      w.fxBurst(p.x, p.y - 6, PINK, 14, 12);
      w.sfx('shieldBreak', 0.6);
      pt.data.t1 = pt.t;
      pt.step = 9;
      return;
    }
    const d = dist(e.x, e.y, p.x, p.y);
    const near = e.r + p.r + 6;
    if (d > near && pt.t < pt.data.t1! + k.num('time', 1.8)) {
      // charmed: the hero walks to her, and nothing they press turns them away
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      const s = Math.min(d - near, k.num('pull', 95) * dt);
      const m = moveCircle(w.map, p.x, p.y, p.r, Math.cos(a) * s, Math.sin(a) * s);
      p.x = m.x;
      p.y = m.y;
      p.vx = 0;
      p.vy = 0;
      p.walkT += dt;
      w.addFx({ kind: 'zap', x: e.x, y: e.y - 10, x2: p.x, y2: p.y - 8, life: dt * 2, size: 1, color: PINK });
      if (w.rand() < dt * 8) w.addFx({ kind: 'glow', x: p.x, y: p.y - 22, life: 0.35, size: 5, color: PINK });
      if (w.rand() < dt * 6) w.addFx({ kind: 'leaf', x: p.x + (w.rand() - 0.5) * 10, y: p.y - 20, vx: 0, vy: -12, life: 0.6, size: 1, color: PETAL, a: w.rand() * TAU });
    } else {
      // her embrace: thorns close round her
      w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: k.num('er', 46), r2: 0, angle: 0, len: 0, dur: k.num('ewind', 0.6), dmg: e.dmg * k.num('emul', 1.8), status: bleed(e, 4), knock: 170, tone: 'enemy', owner: e.id, linger: 0 });
      w.callout('“Stay.”', PETAL);
      w.sfx('windup', 0.7);
      pt.data.t1 = pt.t;
      pt.step = 3;
    }
  } else if (pt.step === 3 && pt.t >= pt.data.t1! + k.num('ewind', 0.6)) {
    w.addFx({ kind: 'slash', x: e.x, y: e.y, a: e.face, a2: TAU, life: 0.25, size: k.num('er', 46), color: THORN, r2: 1 });
    for (let i = 0; i < 12; i++) {
      const b = (TAU * i) / 12;
      w.addFx({ kind: 'shard', x: e.x + Math.cos(b) * k.num('er', 46) * 0.8, y: e.y + Math.sin(b) * k.num('er', 46) * 0.6, vx: Math.cos(b) * 20, vy: -30, life: 0.4, size: 2, color: THORN });
    }
    w.sfx('swingBig');
    w.shake(3);
    pt.data.t1 = pt.t;
    pt.step = 9;
  } else if (pt.step === 9 && pt.t >= pt.data.t1! + 0.4) k.end();
};

/**
 * She withers: her petals fall (the withered drawing from now on), and she drinks every courtier still
 * standing in the room dry, mending `heal` of her health for each (never past where this phase began).
 * From now on the Sigil of Thorns in her beats every `beat` s, and with `fade` she fades of herself,
 * that share of her health a second (never below a hundredth: the last of her is yours to take).
 */
const wither: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  if (pt.step === 0) {
    const s = fight(w, e);
    const b = e.boss!;
    if (e.def.sprite !== WITHERED) e.def = { ...e.def, sprite: WITHERED };
    s.beat = k.num('beat', 0);
    s.beatT = Math.min(s.beat, 2.5);
    s.fade = Math.max(s.fade, k.num('fade', 0));
    const heal = k.num('heal', 0.03);
    const cap = e.maxHp * (b.def.phases[b.phase]?.at ?? 1);
    let n = 0;
    for (const o of w.enemies) {
      if (o.dead || o.boss || o.room !== e.room || o.def.id === POD) continue;
      n += 1;
      w.addFx({ kind: 'zap', x: o.x, y: o.y - 6, x2: e.x, y2: e.y - 12, life: 0.5, size: 1.4, color: PINK });
      w.fxBurst(o.x, o.y - 4, PETAL, 10, 10);
      w.text(o.x, o.y - o.r - 10, 'DRUNK DRY', PETAL, false);
      quietly(o);
    }
    if (n) {
      const add = Math.max(0, Math.min(cap, e.hp + e.maxHp * heal * n) - e.hp);
      e.hp += add;
      if (add > 0) w.text(e.x, e.y - e.r - 30, `+${Math.round(add)}`, '#7bff9a', true);
    }
    for (let i = 0; i < 26; i++) w.addFx({ kind: 'leaf', x: e.x + (w.rand() - 0.5) * 30, y: e.y - 24 - w.rand() * 10, vx: (w.rand() - 0.5) * 24, vy: 10 + w.rand() * 10, life: 1.4, size: 1, color: w.rand() < 0.6 ? PETAL : '#8a6a5a', a: w.rand() * TAU });
    w.text(e.x, e.y - e.r - 20, s.fade > 0 ? 'SHE IS FADING...' : 'SHE WITHERS...', PETAL, true);
    w.sfx('soul', 0.8);
    w.shake(3);
    pt.step = 1;
  } else if (pt.t >= 1.2) k.end();
};

/* ------------------------------------------------------------ the Faded Lamps: Elowen of the Dawn and Merrin of the Dusk */

/**
 * Elowen of the Dawn and her sister Merrin of the Dusk lit the elven halls' lamps, morning and evening, for a thousand
 * years. The blight put both lights out, and now they keep each other instead (`twins`). Whichever sister falls first,
 * the other sings her back: in a few seconds she rises again (with a third of her strength), unless the singer falls
 * in the meantime. Fallen, Elowen is a mote of dawn-light over where she stood, that no blow can touch; Merrin, a wisp
 * of dusk. While the sisters stand close, their bond turns half of every wound aside: pull them apart (Elowen comes
 * after the hero, Merrin keeps her distance). And from Elowen's second phase the bond itself burns, a beam from one
 * sister to the other: never stand between them.
 *
 * The sisters' bond outlives the pattern that wakes it, so it is kept per boss here and run by a small ticker
 * (World.after, once a step) for as long as the fight lasts.
 */

const DAWN = '#ffe08a';
const DUSK = '#b48aff';
const SISTER = 'merrin-of-the-dusk';
/** Closer than this (px), the sisters' bond turns half of every wound aside. */
const BOND = 90;
/** Seconds before a fallen sister is sung back up. */
const SING = 12;
/** The share of her health a sister rises with. */
const RISE = 0.3;
/** Below this share of her health (while Merrin stands) Elowen fades instead of falling. */
const FADE_AT = 0.06;

interface Twins {
  last: number;
  sister: Enemy | null;
  /** The sisters' health a step ago (for what the bond turns aside). */
  hpE: number;
  hpS: number;
  /** A sister fallen: which, where, and when she rises again. */
  down: 'dawn' | 'dusk' | null;
  dx: number;
  dy: number;
  until: number;
  /** Seconds to the burning bond's next beat. */
  burn: number;
  fxT: number;
  tick: number;
  said: number;
}

const TWINS = new WeakMap<Enemy, Twins>();

function twinsOf(w: World, e: Enemy): Twins {
  let s = TWINS.get(e);
  if (!s) {
    s = { last: w.time, sister: null, hpE: e.hp, hpS: 0, down: null, dx: 0, dy: 0, until: 0, burn: 0, fxT: 0, tick: 0, said: -99 };
    TWINS.set(e, s);
    w.after(0, () => twinTick(w, e));
  }
  return s;
}

/** Merrin up at (x, y) with `share` of her health. */
function wakeSister(w: World, e: Enemy, s: Twins, x: number, y: number, share: number): void {
  const before = w.enemies.length;
  w.spawnAdd(SISTER, x, y, e.room);
  const m = w.enemies.length > before ? w.enemies[w.enemies.length - 1]! : null;
  if (!m || m.def.id !== SISTER) return;
  m.hp = Math.max(1, Math.round(m.maxHp * share));
  s.sister = m;
  s.hpS = m.hp;
}

function twinTick(w: World, e: Enemy): void {
  const s = TWINS.get(e);
  if (!s) return;
  if (!fighting(w, e)) {
    // Elowen gone (or the room reset): her sister goes with her
    if (s.sister && standing(w, s.sister)) quietly(s.sister);
    TWINS.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  const b = e.boss!;
  const m = s.sister && standing(w, s.sister) ? s.sister : null;
  if (s.sister && !m && s.down === null) {
    // Merrin falls first: her sister will sing her back
    s.down = 'dusk';
    s.dx = s.sister.x;
    s.dy = s.sister.y;
    s.until = w.time + SING;
    s.sister = null;
    s.tick = 0;
    w.callout('Merrin! Hold on, I will sing you back!', DAWN);
    w.text(w.player.x, w.player.y - 30, 'Now Elowen, before Merrin rises!', '#fff2c0', false);
  } else if (m && s.down === null && e.hp < e.maxHp * FADE_AT) {
    // Elowen falls first: she fades to a mote of dawn, out of reach, while her sister sings
    s.down = 'dawn';
    s.dx = e.x;
    s.dy = e.y;
    s.until = w.time + SING;
    s.tick = 0;
    b.queue = [];
    b.pattern = { use: { id: 'blight:fade', w: 1, cd: 0 }, t: 0, step: 0, data: { hide: 1 } };
    w.callout('Merrin... sing for me...', DAWN);
    w.text(w.player.x, w.player.y - 30, 'Now Merrin, before Elowen rises!', '#fff2c0', false);
    w.fxBurst(e.x, e.y - 10, DAWN, 24, 18);
    w.sfx('soul', 0.7);
  }
  if (s.down) {
    // the fallen sister's light, and the count to her rising
    s.fxT -= dt;
    if (s.fxT <= 0) {
      s.fxT = 0.15;
      const c = s.down === 'dawn' ? DAWN : DUSK;
      const bob = Math.sin(w.time * 4) * 3;
      w.addFx({ kind: 'glow', x: s.dx, y: s.dy - 18 + bob, life: 0.2, size: 12, color: c });
      w.addFx({ kind: 'spark', x: s.dx + (w.rand() - 0.5) * 10, y: s.dy - 18 + bob, vx: 0, vy: -24, life: 0.45, size: 2, color: c });
      const singer = s.down === 'dawn' ? m : e;
      if (singer && w.rand() < 0.5) w.addFx({ kind: 'beam', x: singer.x, y: singer.y - 16, x2: s.dx, y2: s.dy - 18, life: 0.15, size: 1, color: s.down === 'dawn' ? DUSK : DAWN });
    }
    const left = Math.ceil(s.until - w.time);
    if (left !== s.tick && left <= 6) {
      s.tick = left;
      w.text(s.dx, s.dy - 34, String(left), s.down === 'dawn' ? DAWN : DUSK, true);
    }
    if (s.down === 'dawn' && !m) {
      // the singer fell: the dawn goes out with her
      s.down = null;
      b.pattern = null;
      e.hp = 0;
      w.text(s.dx, s.dy - 30, 'Merrin... the light...', DAWN, true);
      killEnemy(w, e, 'arcane', 1, null);
    } else if (w.time >= s.until) {
      if (s.down === 'dawn') {
        b.pattern = null;
        e.hp = Math.max(e.hp, e.maxHp * RISE);
        s.hpE = e.hp;
        w.callout('The dusk sings the dawn back!', DAWN);
        w.fxBurst(e.x, e.y - 10, DAWN, 24, 20);
      } else {
        wakeSister(w, e, s, s.dx, s.dy, RISE);
        w.text(s.dx, s.dy - 30, 'Rise, sister!', DUSK, true);
        w.fxBurst(s.dx, s.dy - 10, DUSK, 24, 20);
      }
      s.down = null;
      w.sfx('summon');
    }
  }
  const sis = s.sister && standing(w, s.sister) ? s.sister : null;
  if (sis && !s.down) {
    const d = dist(e.x, e.y, sis.x, sis.y);
    // close together, their bond turns half of every wound aside
    if (d < BOND) {
      const lostE = s.hpE - e.hp;
      const lostS = s.hpS - sis.hp;
      if (lostE > 0) e.hp = Math.min(e.maxHp, e.hp + lostE * 0.5);
      if (lostS > 0) sis.hp = Math.min(sis.maxHp, sis.hp + lostS * 0.5);
      s.fxT -= dt;
      if (s.fxT <= 0) {
        s.fxT = 0.15;
        w.addFx({ kind: 'beam', x: e.x, y: e.y - 16, x2: sis.x, y2: sis.y - 14, life: 0.18, size: 1.5, color: w.rand() < 0.5 ? DAWN : DUSK });
      }
      if ((lostE > 0 || lostS > 0) && w.time - s.said > 8) {
        s.said = w.time;
        w.text(w.player.x, w.player.y - 30, 'Bound together, they turn half aside: pull them apart!', '#fff2c0', false);
      }
    }
    // from her second phase the bond burns: a beam from one sister to the other
    if (b.phase >= 1 && b.shift <= 0) {
      s.burn -= dt;
      if (s.burn <= 0) {
        s.burn = 0.5;
        const a = Math.atan2(sis.y - e.y, sis.x - e.x);
        w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: 12, angle: a, len: d, dur: 0.5, dmg: e.dmg * 0.45, status: { status: 'burn', dur: 2, power: Math.max(2, Math.round(e.dmg * 0.1)) }, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
        w.addFx({ kind: 'beam', x: e.x, y: e.y - 14, x2: sis.x, y2: sis.y - 14, life: 0.5, size: 3, color: '#ffb070' });
      }
    }
  }
  s.hpE = e.hp;
  s.hpS = sis ? sis.hp : 0;
  w.after(0, () => twinTick(w, e));
}

/** Merrin of the Dusk wakes beside her sister (within the bond's reach). Once a fight. */
const twins: PatternFn = (w, e, _dt, k) => {
  const s = twinsOf(w, e);
  if (!s.sister && !s.down) {
    let at: { x: number; y: number } | null = null;
    for (let i = 0; i < 12 && !at; i++) {
      const a = w.rand() * TAU;
      const x = e.x + Math.cos(a) * 60;
      const y = e.y + Math.sin(a) * 50;
      if (onFloor(w, e, x, y, 8) && dist(x, y, w.player.x, w.player.y) > 40) at = { x, y };
    }
    at ??= { x: e.x + 40, y: e.y };
    wakeSister(w, e, s, at.x, at.y, 1);
    w.callout('Sister, wake! Someone has come to put out the last light.', DAWN);
    w.fxBurst(at.x, at.y - 10, DUSK, 20, 16);
  }
  k.end();
};

/** Elowen faded to a mote of dawn: out of sight and reach while her sister sings (the bond's ticker ends it). */
const fade: PatternFn = (_w, e, _dt, k) => {
  const s = TWINS.get(e);
  if (!s || s.down !== 'dawn') k.end();
  else k.pt.data.hide = 1;
};

/** The sisters: Merrin, and which of them is fallen (for tests). */
export const twinsOfElowen = (e: Enemy): { sister: Enemy | null; down: 'dawn' | 'dusk' | null } | null => {
  const s = TWINS.get(e);
  return s ? { sister: s.sister && !s.sister.dead ? s.sister : null, down: s.down } : null;
};

export const BLIGHTHEART_PATTERNS: Record<string, PatternFn> = {
  'blight:topple': topple,
  'blight:pods': pods,
  'blight:taproot': taproot,
  'blight:briar': briar,
  'blight:garden': garden,
  'blight:spores': spores,
  'blight:kiss': kiss,
  'blight:wither': wither,
  'blight:twins': twins,
  'blight:fade': fade,
};
