import { dist, TAU } from '../../core/math';
import { hurtPlayer } from '../combat';
import { castRay, circleHitsWall, moveCircle, TILE, tileAt } from '../map';
import type { Enemy, Field } from '../types';
import type { World } from '../world';
import type { PatternFn } from './kit';

/**
 * Boss attacks of the Molten Throne: ids start with 'throne:'.
 *
 * The Magma Warden keeps the Host's forges: a fist into the floor sends geysers of magma rolling
 * out along a line (`eruption`), its crucible pours molten bone-steel across the hall in a channel
 * that burns for a while (`pour`), and once its shell splits its core flares, heat rolling out in
 * rings one after another (`core`).
 *
 * Ashkar the Bound is chained to his throne. Four chains run from his shackles to bone-steel anchors
 * in the floor (`shackles`): they hold him close, and when he strains at them every chain still whole
 * burns along its length (`taut`). An anchor can be broken: the chain falls slack, he roams a little
 * farther and burns hotter (his blows grow with every chain gone). The Pale Crown on the anvil before
 * him commands him, and he hammers it, each blow ringing across the hall (`forge`). Then he tears out
 * the chains still whole himself, and each rips a burning furrow through the floor that lasts the
 * fight (`tear`): the chains a hero broke first leave nothing behind. Loose, he whirls a torn chain
 * round him (`flail`). The Crown rises onto his brow (`crown`): it wards him and casts pale fire until
 * it is broken, and broken it leaves him reeling and weaker. At the last the lake of fire rises along
 * every wall (`lake`) and the heart of the mountain flares, first round him, then everywhere but beside
 * him (`inferno`). Freed, he thanks the hero.
 *
 * What lasts beyond a pattern (the anchors and their chains, the leash, the heat, the Crown and its
 * ward, lava on the floor) is kept per boss here and run by a small ticker (World.after, once a step)
 * while the fight lasts. A phase change clears the lava like any attack, but the furrows and the risen
 * lake come back once it is over; a defeat or a win takes everything away.
 */

const FIRE = '#ff8a2a';
const GOLD = '#ffd06a';
const PALE = '#d8e8ff';
const IRON = ['#4a4048', '#8a8290'] as const;
const HOT = ['#c84a1a', '#ffb04d'] as const;
const ANCHOR = 'throne-chain';
const CROWN = 'the-pale-crown';
/** At most this many short-lived pools of lava (geysers, pours) at once: the oldest cools first. */
const MAX_LAVA = 36;

interface Chain {
  anchor: Enemy | null;
  /** Whole, broken by the hero, or torn out by Ashkar. */
  state: 'whole' | 'broken' | 'torn';
}
interface Lasting {
  x: number;
  y: number;
  r: number;
  dmg: number;
  f: Field | null;
}
interface Ward {
  max: number;
  rate: number;
  every: number;
  daze: number;
  mul: number;
  weak: number;
}
interface Fight {
  last: number;
  /** Where he is chained (his throne), and where the anvil with the Crown stands. */
  tx: number;
  ty: number;
  ax: number;
  ay: number;
  chains: Chain[];
  /** How far from the throne the chains let him go (0: free). */
  leash: number;
  more: number;
  /** Chains gone: every one makes him burn hotter. */
  heat: number;
  baseDmg: number;
  /** Seconds the chains glow while drawn taut. */
  tautT: number;
  linkT: number;
  emberT: number;
  lava: Field[];
  /** Fire that stays the whole fight (the furrows, the risen lake): it comes back after a phase change. */
  lasting: Lasting[];
  crown: Enemy | null;
  crownState: 'anvil' | 'risen' | 'broken';
  ward: Ward;
  crownT: number;
  crownN: number;
  zapT: number;
}

const FIGHTS = new WeakMap<Enemy, Fight>();

/** The fight goes on: the boss stands, isn't falling, its room hasn't reset (and, if given, it is still in that phase). */
function fighting(w: World, e: Enemy, phase?: number): boolean {
  const b = e.boss;
  return !!b && !e.dead && b.dying <= 0 && w.enemies.includes(e) && (phase === undefined || b.phase === phase);
}

const standing = (w: World, x: Enemy | null): x is Enemy => !!x && !x.dead && x.hp > 0 && w.enemies.includes(x);

const faceTo = (e: Enemy, a: number): void => {
  e.face = Math.cos(a) < 0 ? Math.PI : 0;
};

/** Fire sets the hero burning (a tenth of the boss's blow a second). */
const burn = (e: Enemy, dur = 2): { status: 'burn'; dur: number; power: number } => ({ status: 'burn', dur, power: Math.max(2, Math.round(e.dmg * 0.1)) });

/** The boss room's bounds in pixels (worked out once per fight). */
function roomBox(w: World, e: Enemy): { x0: number; y0: number; x1: number; y1: number } {
  const m = e.boss!.misc;
  if (m.tx1 === undefined) {
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
    m.tx0 = x0 * TILE;
    m.ty0 = y0 * TILE;
    m.tx1 = (x1 + 1) * TILE;
    m.ty1 = (y1 + 1) * TILE;
  }
  return { x0: m.tx0!, y0: m.ty0!, x1: m.tx1, y1: m.ty1! };
}

/** A spot on the boss room's open floor with room for a circle of radius r. */
function onFloor(w: World, e: Enemy, x: number, y: number, r: number): boolean {
  const i = tileAt(w.map, x, y);
  return i >= 0 && w.map.room[i] === e.room + 1 && !circleHitsWall(w.map, x, y, r);
}

/* ------------------------------------------------------------ the lasting state */

function fight(w: World, e: Enemy): Fight {
  let s = FIGHTS.get(e);
  if (!s) {
    // the anvil before the throne (the Crown sits on it), or a spot just in front of him
    let ax = e.x;
    let ay = e.y + 64;
    let best = Infinity;
    for (const pr of w.props) {
      if (pr.prop !== 'anvil') continue;
      const i = tileAt(w.map, pr.x, pr.y);
      if (i < 0 || w.map.room[i] !== e.room + 1) continue;
      const d = dist(pr.x, pr.y, e.x, e.y);
      if (d < best) {
        best = d;
        ax = pr.x;
        ay = pr.y;
      }
    }
    s = {
      last: w.time,
      tx: e.x,
      ty: e.y,
      ax,
      ay,
      chains: [],
      leash: 0,
      more: 32,
      heat: 0,
      baseDmg: e.dmg,
      tautT: 0,
      linkT: 0,
      emberT: 0,
      lava: [],
      lasting: [],
      crown: null,
      crownState: 'anvil',
      ward: { max: 0.1, rate: 0.012, every: 3.2, daze: 3, mul: 0.9, weak: 0.2 },
      crownT: 2,
      crownN: 0,
      zapT: 0,
    };
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
    finish(w, e, s);
    FIGHTS.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  s.lava = s.lava.filter((f) => w.fields.includes(f));
  tickChains(w, e, s, dt);
  tickCrown(w, e, s, dt);
  tickLasting(w, e, s);
  tickHeat(w, e, s, dt);
  w.after(0, () => tick(w, e));
}

/** Won, or the room reset after a defeat: the anchors and the Crown go, the fire dies down. */
function finish(w: World, e: Enemy, s: Fight): void {
  const mine = new Set<Field>([...s.lava, ...s.lasting.map((l) => l.f).filter((f): f is Field => !!f)]);
  w.fields = w.fields.filter((f) => !mine.has(f));
  for (const c of s.chains) if (standing(w, c.anchor)) quietly(c.anchor);
  if (standing(w, s.crown)) quietly(s.crown);
  // freed: the fire lord's last words (only when he fell, not when the hero did)
  if (s.chains.length && e.boss && (e.boss.dying > 0 || e.dead)) {
    w.callout('“The chains... they are gone.”', GOLD);
    w.after(1, () => w.callout('“Thank you. Take my fire, and break their crown.”', GOLD, undefined, 4));
    w.emit({ t: 'banner', text: 'Ashkar is free', sub: '“Thank you, Sigil-bearer. Take my fire with you.”' });
    w.fxBurst(e.x, e.y - 10, GOLD, 30, 30);
  }
}

/** Gone without a reward (torn out, or the fight is over). */
function quietly(x: Enemy): void {
  x.hp = 0;
  x.dead = true;
  x.deathT = 0;
}

/** His blows grow with every chain gone (and shrink once the Crown is broken). */
function setDmg(e: Enemy, s: Fight): void {
  e.dmg = s.baseDmg * (1 + 0.05 * s.heat) * (s.crownState === 'broken' ? 0.85 : 1);
}

/* ------------------------------------------------------------ lava */

/** A pool of lava on the floor for `life` s (the oldest cools when there are too many). */
function addLava(w: World, e: Enemy, x: number, y: number, r: number, life: number, tick = 0.1): void {
  if (!onFloor(w, e, x, y, 2)) return;
  const s = fight(w, e);
  s.lava = s.lava.filter((f) => w.fields.includes(f));
  if (s.lava.length >= MAX_LAVA) {
    const old = s.lava.reduce((a, b) => (a.t < b.t ? a : b));
    old.t = Math.min(old.t, 0.3);
  }
  s.lava.push(w.spawnField({ x, y, r, dur: life, tick: 0.5, dmg: e.dmg * tick, type: 'fire', status: burn(e), look: 'fire', hostile: true, depth: 0, spec: null, onHit: false }));
}

/** Fire that stays until the fight ends (the furrows, the risen lake). */
function addLasting(w: World, e: Enemy, x: number, y: number, r: number): void {
  if (!onFloor(w, e, x, y, 2)) return;
  const s = fight(w, e);
  const l: Lasting = { x, y, r, dmg: 0.1, f: null };
  l.f = w.spawnField({ x, y, r, dur: 9999, tick: 0.5, dmg: e.dmg * l.dmg, type: 'fire', status: burn(e, 1.5), look: 'fire', hostile: true, depth: 0, spec: null, onHit: false });
  s.lasting.push(l);
}

/** A phase change clears the floor: once it is over, the lasting fire comes back. */
function tickLasting(w: World, e: Enemy, s: Fight): void {
  if (!s.lasting.length || e.boss!.shift > 0) return;
  for (const l of s.lasting) {
    if (l.f && w.fields.includes(l.f)) continue;
    l.f = w.spawnField({ x: l.x, y: l.y, r: l.r, dur: 9999, tick: 0.5, dmg: e.dmg * l.dmg, type: 'fire', status: burn(e, 1.5), look: 'fire', hostile: true, depth: 0, spec: null, onHit: false });
  }
}

/** Embers rise off him, more the hotter he burns. */
function tickHeat(w: World, e: Enemy, s: Fight, dt: number): void {
  if (!s.chains.length) return;
  s.emberT -= dt;
  if (s.emberT > 0) return;
  s.emberT = 0.22 - s.heat * 0.035;
  const a = w.rand() * TAU;
  w.addFx({ kind: 'spark', x: e.x + Math.cos(a) * e.r * 0.8, y: e.y - 6 + Math.sin(a) * e.r * 0.6, vx: (w.rand() - 0.5) * 14, vy: -40 - w.rand() * 30 - s.heat * 6, life: 0.6, size: 1 + (s.heat >= 2 ? 1 : 0), color: w.rand() < 0.5 ? GOLD : FIRE });
}

/* ------------------------------------------------------------ the chains */

/** Where a chain is fastened on him: his wrists and ankles, by the side its anchor is on. */
function shackle(e: Enemy, c: Enemy): { x: number; y: number } {
  const side = c.x < e.x ? -1 : 1;
  return { x: e.x + side * e.r * 0.55, y: e.y - (c.y < e.y + 40 ? 10 : 2) };
}

/** A chain drawn as links on the floor from its anchor to his shackle (glowing while taut). */
function drawChain(w: World, e: Enemy, c: Enemy, hot: boolean): void {
  const sh = shackle(e, c);
  const x0 = c.x;
  const y0 = c.y - 4;
  const len = dist(x0, y0, sh.x, sh.y);
  const n = Math.max(2, Math.floor(len / 9));
  const col = hot ? HOT : IRON;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // a little slack: the chain sags in the middle
    const sag = Math.sin(t * Math.PI) * Math.min(10, len * 0.04) * (hot ? 0.2 : 1);
    w.addFx({ kind: 'shard', x: x0 + (sh.x - x0) * t, y: y0 + (sh.y - y0) * t + sag, life: 0.13, size: 2, color: col[i % 2]! });
  }
}

function tickChains(w: World, e: Enemy, s: Fight, dt: number): void {
  if (!s.chains.length) return;
  const b = e.boss!;
  s.tautT = Math.max(0, s.tautT - dt);
  s.linkT -= dt;
  const draw = s.linkT <= 0;
  if (draw) s.linkT = 0.1;
  for (const c of s.chains) {
    if (c.state !== 'whole' || !c.anchor) continue;
    if (!standing(w, c.anchor)) {
      breakChain(w, e, s, c, 'broken');
      continue;
    }
    if (draw && c.anchor.state !== 'spawn') drawChain(w, e, c.anchor, s.tautT > 0);
  }
  // the chains hold him close to his throne
  if (s.leash > 0 && b.shift <= 0) {
    const d = dist(e.x, e.y, s.tx, s.ty);
    if (d > s.leash) {
      const a = Math.atan2(s.ty - e.y, s.tx - e.x);
      const m = moveCircle(w.map, e.x, e.y, e.r, Math.cos(a) * (d - s.leash), Math.sin(a) * (d - s.leash));
      e.x = m.x;
      e.y = m.y;
    }
  }
}

/** A chain is gone: broken by the hero (the anchor shattered), or torn out by Ashkar. */
function breakChain(w: World, e: Enemy, s: Fight, c: Chain, how: 'broken' | 'torn'): void {
  c.state = how;
  const at = c.anchor;
  if (at && how === 'torn' && standing(w, at)) quietly(at);
  s.heat += 1;
  setDmg(e, s);
  const whole = s.chains.filter((x) => x.state === 'whole').length;
  if (s.leash > 0) s.leash = whole ? s.leash + s.more : 0;
  if (at) {
    w.fxBurst(at.x, at.y - 6, '#8a8290', 16, 14);
    w.fxBurst(at.x, at.y - 6, FIRE, 10, 10);
  }
  w.sfx('shieldBreak', 0.8);
  w.shake(4);
  if (how === 'broken') {
    w.text(at?.x ?? e.x, (at?.y ?? e.y) - 24, 'A CHAIN BREAKS!', GOLD, true);
    w.text(e.x, e.y - e.r - 20, whole ? 'Ashkar burns hotter!' : 'His chains are all broken!', FIRE, true);
    // the shackle wrenches at him as it falls slack: he staggers
    if (!e.boss!.pattern) e.boss!.dazed = Math.max(e.boss!.dazed, 1.2);
    w.sfx('roar', 0.5);
  }
}

/**
 * The chains: four anchors of bone-steel driven into the floor, two either side of the throne
 * (`ux`, `uy` from it) and two toward the doors (`lx`, `ly`), each holding a chain to his shackles.
 * They let him go only `leash` px from the throne (`more` farther for every chain broken).
 */
const shackles: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  if (pt.step === 0) {
    const s = fight(w, e);
    if (s.chains.length) {
      k.end();
      return;
    }
    s.leash = k.num('leash', 64);
    s.more = k.num('more', 32);
    const ux = k.num('ux', 208);
    const uy = k.num('uy', 16);
    const lx = k.num('lx', 176);
    const ly = k.num('ly', 288);
    const spots = [
      { x: s.tx - ux, y: s.ty + uy },
      { x: s.tx + ux, y: s.ty + uy },
      { x: s.tx - lx, y: s.ty + ly },
      { x: s.tx + lx, y: s.ty + ly },
    ];
    for (const sp of spots) {
      // in from the walls if the spot isn't open floor
      let { x, y } = sp;
      for (let i = 0; i < 12 && !onFloor(w, e, x, y, 9); i++) {
        x += (s.tx - x) * 0.12;
        y += (s.ty - y) * 0.12;
      }
      const id = w.nextId;
      w.spawnAdd(ANCHOR, x, y, e.room);
      const a = w.enemies.find((o) => o.id >= id && o.def.id === ANCHOR) ?? null;
      s.chains.push({ anchor: a, state: a ? 'whole' : 'broken' });
      if (a) w.fxBurst(a.x, a.y - 4, '#8a8290', 10, 10);
    }
    w.callout('CHAINED TO HIS THRONE', '#c8c0d0');
    w.emit({ t: 'banner', text: 'Ashkar is chained to his throne', sub: 'Break the anchors to loosen him: he burns hotter for every chain' });
    w.sfx('doorSlam', 0.6);
    w.shake(3);
    pt.data.t1 = pt.t;
    pt.step = 1;
  } else if (pt.t >= pt.data.t1! + 0.4) k.end();
};

/**
 * He heaves against his chains: every chain still whole is shown along its length for `wind` s
 * (`width` wide), then burns for `mul` of his blow. With every chain broken there is nothing to strain.
 */
const taut: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const s = fight(w, e);
  if (pt.step === 0) {
    const live = s.chains.filter((c) => c.state === 'whole' && standing(w, c.anchor));
    if (!live.length) {
      k.end();
      return;
    }
    const wind = k.num('wind', 1.2);
    const width = k.num('width', 18);
    const phase = e.boss!.phase;
    for (const c of live) {
      const at = c.anchor!;
      const sh = shackle(e, at);
      const a = Math.atan2(sh.y - at.y, sh.x - at.x);
      const len = dist(at.x, at.y, sh.x, sh.y);
      w.addTelegraph({ shape: 'line', x: at.x, y: at.y, r: 0, r2: width, angle: a, len, dur: wind, dmg: e.dmg * k.num('mul', 1.3), status: burn(e), knock: 90, tone: 'enemy', owner: -1, linger: 0 });
      w.after(wind, () => {
        if (!fighting(w, e, phase)) return;
        for (let j = 0; j <= 10; j++) {
          const x = at.x + Math.cos(a) * len * (j / 10);
          const y = at.y + Math.sin(a) * len * (j / 10);
          w.addFx({ kind: 'spark', x, y: y - 2, vx: (w.rand() - 0.5) * 30, vy: -30 - w.rand() * 40, life: 0.5, size: 2, color: j % 2 ? GOLD : FIRE });
        }
      });
    }
    s.tautT = wind + 0.3;
    w.callout('HE STRAINS AT HIS CHAINS!', FIRE);
    w.sfx('roar', 0.6);
    w.sfx('windup', 0.6);
    pt.data.wind = wind;
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= pt.data.wind!) {
    w.sfx('fireball', 0.7);
    w.shake(4);
    pt.step = 2;
  } else if (pt.step === 2 && pt.t >= pt.data.wind! + 0.4) k.end();
};

/**
 * Torn out: every chain still whole is shown along its length (`wind` s, `width`), whips for `mul` of
 * his blow as he rips it out of the floor, and leaves a burning furrow along `fissure` of its length
 * from the anchor that lasts the whole fight. Chains already broken leave nothing.
 */
const tear: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const s = fight(w, e);
  if (pt.step === 0) {
    const live = s.chains.filter((c) => c.state === 'whole' && standing(w, c.anchor));
    s.leash = 0;
    if (!live.length) {
      if (s.chains.length) w.callout('NOTHING HOLDS HIM NOW!', FIRE);
      k.end();
      return;
    }
    const wind = k.num('wind', 1);
    const phase = e.boss!.phase;
    for (const c of live) {
      const at = c.anchor!;
      const x0 = at.x;
      const y0 = at.y;
      const a = Math.atan2(e.y - y0, e.x - x0);
      const len = dist(x0, y0, e.x, e.y);
      w.addTelegraph({ shape: 'line', x: x0, y: y0, r: 0, r2: k.num('width', 22), angle: a, len, dur: wind, dmg: e.dmg * k.num('mul', 1.4), status: burn(e), knock: 120, tone: 'enemy', owner: -1, linger: 0 });
      w.after(wind, () => {
        if (!fighting(w, e, phase)) return;
        if (c.state === 'whole') breakChain(w, e, s, c, 'torn');
        // the furrow the chain ripped through the floor
        const fl = len * k.num('fissure', 0.6);
        for (let d = 10; d <= fl; d += 22) addLasting(w, e, x0 + Math.cos(a) * d, y0 + Math.sin(a) * d, 13);
        for (let j = 0; j < 12; j++) w.addFx({ kind: 'rubble', x: x0 + Math.cos(a) * fl * (j / 12), y: y0 + Math.sin(a) * fl * (j / 12), vx: (w.rand() - 0.5) * 60, vy: -40 - w.rand() * 50, life: 0.6, size: 2, color: j % 2 ? '#3a3030' : FIRE });
      });
    }
    w.callout('HE TEARS OUT HIS CHAINS!', FIRE);
    w.sfx('roar');
    w.sfx('windup', 0.7);
    pt.data.wind = wind;
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= pt.data.wind!) {
    w.sfx('crumble');
    w.shake(6);
    pt.step = 2;
  } else if (pt.step === 2 && pt.t >= pt.data.wind! + 0.5) k.end();
};

/**
 * A torn chain whirled round him: a sweep across `arc` rad centerd on the hero, `beams` lines of `len`
 * (`width` wide), the whole sweep shown at once and landing one after another (`wind` s for the
 * first, `step` s apart) for `mul` of his blow. `sweeps` 2 sweeps back again after `gapT` s.
 */
const flail: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const sweeps = k.num('sweeps', 1);
  if (pt.step === 0) {
    const n = pt.data.n ?? 0;
    const beams = Math.max(2, k.num('beams', 10));
    const arc = k.num('arc', 2.2);
    const wind = n === 0 ? k.num('wind', 0.85) : k.num('wind2', 0.6);
    const step = k.num('step', 0.06);
    const width = k.num('width', 16);
    const dir = n === 0 ? (w.rand() < 0.5 ? 1 : -1) : -pt.data.dir!;
    const mid = k.aimAt();
    const phase = e.boss!.phase;
    pt.data.dir = dir;
    for (let i = 0; i < beams; i++) {
      const a = mid - (dir * arc) / 2 + (dir * arc * i) / (beams - 1);
      const end = castRay(w.map, e.x, e.y, 2, a, k.num('len', 120));
      const len = Math.max(e.r + 8, dist(e.x, e.y, end.x, end.y));
      const dur = wind + i * step;
      w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: width, angle: a, len, dur, dmg: e.dmg * k.num('mul', 1.3), knock: 110, tone: 'enemy', owner: -1, linger: 0 });
      const x0 = e.x;
      const y0 = e.y;
      w.after(dur, () => {
        if (!fighting(w, e, phase)) return;
        // the chain passing over the floor
        for (let j = 2; j <= 8; j++) w.addFx({ kind: 'shard', x: x0 + Math.cos(a) * len * (j / 8), y: y0 - 4 + Math.sin(a) * len * (j / 8), life: 0.16, size: 2, color: j % 2 ? HOT[1] : IRON[1] });
        if (i % 3 === 0) w.sfx('whirl', 0.4);
      });
    }
    faceTo(e, mid);
    if (n === 0) w.callout('THE CHAIN!', FIRE);
    w.sfx('windup', 0.6);
    pt.data.t1 = pt.t + wind + (beams - 1) * step;
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= pt.data.t1!) {
    w.shake(2);
    pt.data.n = (pt.data.n ?? 0) + 1;
    pt.data.t1 = pt.t;
    pt.step = pt.data.n >= sweeps ? 3 : 2;
  } else if (pt.step === 2 && pt.t >= pt.data.t1! + k.num('gapT', 0.3)) pt.step = 0;
  else if (pt.step === 3 && pt.t >= pt.data.t1! + 0.35) k.end();
};

/**
 * "THE CROWN COMMANDS": he strides to the anvil and hammers the Pale Crown on it, `blows` times (a
 * circle of `r` on the anvil, `wind` s for the first and `wind2` after) for `mul` of his blow; every
 * blow rings across the hall as a shockwave (`wave` of his blow: dodge through it), and after the last
 * the Crown drinks his fire and spits it back as `orbs` pale flames that seek the hero.
 */
const forge: PatternFn = (w, e, dt, k) => {
  const { pt } = k;
  const s = fight(w, e);
  if (s.crownState !== 'anvil') {
    k.end();
    return;
  }
  const spot = { x: s.ax, y: s.ay - e.r - 12 };
  if (pt.step === 0) {
    // to the anvil (a stride or two)
    const d = dist(e.x, e.y, spot.x, spot.y);
    if (d > 6 && pt.t < 1.2) {
      const a = Math.atan2(spot.y - e.y, spot.x - e.x);
      const st = Math.min(d, 150 * dt);
      const m = moveCircle(w.map, e.x, e.y, e.r, Math.cos(a) * st, Math.sin(a) * st);
      e.x = m.x;
      e.y = m.y;
      e.walkT += dt * 1.5;
      faceTo(e, a);
      return;
    }
    pt.data.blow = 0;
    w.callout('THE CROWN COMMANDS!', PALE);
    w.sfx('summon', 0.6);
    pt.step = 1;
  }
  if (pt.step === 1) {
    const n = pt.data.blow!;
    const wind = n === 0 ? k.num('wind', 0.8) : k.num('wind2', 0.55);
    w.addTelegraph({ shape: 'circle', x: s.ax, y: s.ay, r: k.num('r', 36), r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1.5), status: burn(e), knock: 140, tone: 'enemy', owner: -1, linger: 0 });
    faceTo(e, Math.atan2(s.ay - e.y, s.ax - e.x));
    w.sfx('windup', 0.5);
    pt.data.t1 = pt.t + wind;
    pt.step = 2;
  } else if (pt.step === 2 && pt.t >= pt.data.t1!) {
    // the hammer falls on the Crown: pale sparks, and the blow rings out across the hall
    w.shake(4);
    w.sfx('heavy', 0.9);
    w.sfx('slam', 0.6);
    w.fxBurst(s.ax, s.ay - 8, PALE, 14, 16);
    w.fxBurst(s.ax, s.ay - 8, GOLD, 8, 10);
    w.addFx({ kind: 'glow', x: s.ax, y: s.ay - 10, life: 0.5, size: 14 + pt.data.blow! * 4, color: PALE });
    if (k.num('wave', 0.7) > 0) w.spawnWave(s.ax, s.ay, 120, 280, 8, e.dmg * k.num('wave', 0.7));
    pt.data.blow! += 1;
    pt.data.t1 = pt.t;
    pt.step = pt.data.blow! >= k.num('blows', 3) ? 3 : 4;
  } else if (pt.step === 4 && pt.t >= pt.data.t1! + 0.2) pt.step = 1;
  else if (pt.step === 3 && pt.t >= pt.data.t1! + 0.3) {
    // the Crown drinks the fire and casts it back, pale
    const count = k.num('orbs', 6);
    const a0 = w.rand() * TAU;
    for (let i = 0; i < count; i++) {
      const a = a0 + (TAU * i) / count;
      w.spawnProjectile({ x: s.ax + Math.cos(a) * 10, y: s.ay - 10 + Math.sin(a) * 10, vx: Math.cos(a) * 55, vy: Math.sin(a) * 55, r: 4, life: 280, dmg: e.dmg * 0.7, type: 'fire', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'orb', color: PALE, hostile: true, homing: 0.4, child: false, knock: 0 });
    }
    w.sfx('soul', 0.7);
    w.addFx({ kind: 'ring', x: s.ax, y: s.ay - 8, life: 0.6, size: 40, color: PALE });
    pt.data.t1 = pt.t;
    pt.step = 5;
  } else if (pt.step === 5 && pt.t >= pt.data.t1! + 0.4) k.end();
};

/* ------------------------------------------------------------ the Pale Crown */

/**
 * The Crown rises from the anvil onto his brow. While it stands it hovers before him, wards him (a
 * shield up to `ward` of his health, `rate` of it a second) and every `every` s casts its pale fire:
 * brands on the floor round the hero, or a ring of pale flames that seek them (`mul` of his blow).
 * Broken, the ward goes, he reels for `daze` s and from then on takes `weak` more damage and deals
 * less.
 */
const crown: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const s = fight(w, e);
  if (pt.step === 0) {
    if (s.crownState !== 'anvil') {
      k.end();
      return;
    }
    s.ward = { max: k.num('ward', 0.1), rate: k.num('rate', 0.012), every: k.num('every', 3.2), daze: k.num('daze', 3), mul: k.num('mul', 0.9), weak: k.num('weak', 0.2) };
    const id = w.nextId;
    w.spawnAdd(CROWN, s.ax, s.ay - 6, e.room);
    s.crown = w.enemies.find((o) => o.id >= id && o.def.id === CROWN) ?? null;
    s.crownState = s.crown ? 'risen' : 'broken';
    s.crownT = 2.5;
    w.addFx({ kind: 'glow', x: s.ax, y: s.ay - 10, life: 1, size: 26, color: PALE });
    w.fxBurst(s.ax, s.ay - 10, PALE, 20, 20);
    w.callout('THE PALE CROWN RISES!', PALE);
    w.sfx('summon');
    w.sfx('beamCharge', 0.6);
    pt.data.t1 = pt.t;
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= pt.data.t1! + 0.6) k.end();
};

function tickCrown(w: World, e: Enemy, s: Fight, dt: number): void {
  if (s.crownState !== 'risen') {
    // on the anvil: it glows pale, waiting
    if (s.crownState === 'anvil' && s.chains.length && w.rand() < dt * 3) w.addFx({ kind: 'spark', x: s.ax + (w.rand() - 0.5) * 8, y: s.ay - 12, vx: 0, vy: -16, life: 0.6, size: 1, color: PALE });
    return;
  }
  const c = s.crown;
  const b = e.boss!;
  if (!standing(w, c)) {
    crownBreaks(w, e, s);
    return;
  }
  if (c.state === 'spawn') return;
  // it hovers before him, between him and the hero
  const p = w.player;
  const a = Math.atan2(p.y - e.y, p.x - e.x);
  const gx = e.x + Math.cos(a) * (e.r + 14);
  const gy = e.y + Math.sin(a) * (e.r + 14) * 0.8 - 4;
  const d = dist(c.x, c.y, gx, gy);
  if (d > 0.5) {
    const st = Math.min(d, Math.max(80, d * 4) * dt);
    c.x += ((gx - c.x) / d) * st;
    c.y += ((gy - c.y) / d) * st;
  }
  c.face = a;
  if (b.shift > 0) return;
  // its ward on him
  e.shield = Math.min(e.maxHp * s.ward.max, e.shield + e.maxHp * s.ward.rate * dt);
  s.zapT -= dt;
  if (s.zapT <= 0) {
    s.zapT = 0.5;
    w.addFx({ kind: 'zap', x: c.x, y: c.y - 6, x2: e.x, y2: e.y - 14, life: 0.3, size: 1, color: PALE });
    w.addFx({ kind: 'glow', x: c.x, y: c.y - 6, life: 0.4, size: 10, color: PALE });
  }
  // its pale fire
  s.crownT -= dt;
  if (s.crownT > 0 || p.dead) return;
  s.crownT = s.ward.every;
  s.crownN += 1;
  if (s.crownN % 2 === 1) {
    // brands: on the hero and round them
    const a0 = w.rand() * TAU;
    for (let i = 0; i < 3; i++) {
      const x = i === 0 ? p.x : p.x + Math.cos(a0 + i * Math.PI) * 46;
      const y = i === 0 ? p.y : p.y + Math.sin(a0 + i * Math.PI) * 36;
      if (!onFloor(w, e, x, y, 2)) continue;
      w.addTelegraph({ shape: 'circle', x, y, r: 22, r2: 0, angle: 0, len: 0, dur: 1.1, dmg: e.dmg * s.ward.mul, knock: 40, tone: 'enemy', owner: -1, linger: 0 });
      w.after(1.1, () => {
        if (fighting(w, e)) w.fxBurst(x, y, PALE, 10, 14);
      });
    }
    w.text(c.x, c.y - 18, 'KNEEL!', PALE, false);
    w.sfx('beamCharge', 0.4);
  } else {
    const n = 6;
    const a0 = w.rand() * TAU;
    for (let i = 0; i < n; i++) {
      const b2 = a0 + (TAU * i) / n;
      w.spawnProjectile({ x: c.x + Math.cos(b2) * 8, y: c.y - 6 + Math.sin(b2) * 8, vx: Math.cos(b2) * 60, vy: Math.sin(b2) * 60, r: 4, life: 260, dmg: e.dmg * s.ward.mul * 0.8, type: 'fire', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'orb', color: PALE, hostile: true, homing: 0.45, child: false, knock: 0 });
    }
    w.sfx('soul', 0.6);
  }
}

/** The Crown is broken: the ward goes, and he reels free of the Host's will. */
function crownBreaks(w: World, e: Enemy, s: Fight): void {
  s.crownState = 'broken';
  const c = s.crown;
  const x = c?.x ?? e.x;
  const y = c?.y ?? e.y;
  e.shield = 0;
  const b = e.boss!;
  b.dazed = Math.max(b.dazed, s.ward.daze);
  // weaker: more harm from everything, and his blows lighter
  const resist: Record<string, number> = {};
  for (const t of ['physical', 'fire', 'frost', 'lightning', 'poison', 'arcane', 'shadow', 'holy', 'nature']) resist[t] = -s.ward.weak;
  e.def = { ...e.def, resist };
  setDmg(e, s);
  for (let i = 0; i < 20; i++) {
    const a = w.rand() * TAU;
    w.addFx({ kind: 'shard', x, y: y - 6, vx: Math.cos(a) * (40 + w.rand() * 60), vy: Math.sin(a) * (40 + w.rand() * 60) - 30, life: 0.7, size: 2, color: i % 2 ? PALE : '#9aa8c8' });
  }
  w.addFx({ kind: 'ring', x, y, life: 0.7, size: 50, color: PALE });
  w.text(x, y - 24, 'THE PALE CROWN SHATTERS!', PALE, true);
  w.callout('“My own fire... at last.”', GOLD);
  w.emit({ t: 'banner', text: 'The Pale Crown is broken', sub: 'Ashkar reels: the Host’s will is gone from him' });
  w.sfx('shieldBreak');
  w.sfx('crumble', 0.6);
  w.shake(6);
}

/* ------------------------------------------------------------ the floor of fire */

/**
 * A fist into the floor: geysers of magma erupt one after another along `lines` lines (`spread` rad
 * apart) from the boss toward the hero, `count` of them `gap` px apart (circles of `r`, the first
 * shown for `wind` s, each next `step` s later) for `mul` of its blow; walls stop a line. With `lava`,
 * every other geyser leaves a pool of lava for that many seconds.
 */
const eruption: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  if (pt.step === 0) {
    const lines = k.num('lines', 1);
    const spread = k.num('spread', 0.5);
    const count = k.num('count', 8);
    const gap = k.num('gap', 30);
    const r = k.num('r', 20);
    const wind = k.num('wind', 0.9);
    const step = k.num('step', 0.11);
    const lava = k.num('lava', 0);
    const a0 = k.aimAt();
    const phase = e.boss!.phase;
    for (let l = 0; l < lines; l++) {
      const a = a0 + (l - (lines - 1) / 2) * spread;
      const end = castRay(w.map, e.x, e.y, 3, a, e.r + gap * (count + 0.5));
      const reach = dist(e.x, e.y, end.x, end.y);
      for (let i = 0; i < count; i++) {
        const d = e.r + 8 + gap * i;
        if (d > reach) break;
        const x = e.x + Math.cos(a) * d;
        const y = e.y + Math.sin(a) * d;
        if (!onFloor(w, e, x, y, 2)) continue;
        const dur = wind + i * step;
        w.addTelegraph({ shape: 'circle', x, y, r, r2: 0, angle: 0, len: 0, dur, dmg: e.dmg * k.num('mul', 1.3), status: burn(e), knock: 90, tone: 'enemy', owner: -1, linger: 0 });
        w.after(dur, () => {
          if (!fighting(w, e, phase)) return;
          for (let j = 0; j < 7; j++) w.addFx({ kind: 'spark', x: x + (w.rand() - 0.5) * r, y: y - 2, vx: (w.rand() - 0.5) * 40, vy: -70 - w.rand() * 70, life: 0.55, size: 2, color: j % 2 ? GOLD : FIRE });
          w.addFx({ kind: 'smoke', x, y: y - 6, vx: 0, vy: -20, life: 0.8, size: 4, color: '#3a2a26' });
          if (i % 3 === 0) w.sfx('fireball', 0.35);
          if (lava > 0 && i % 2 === 1) addLava(w, e, x, y, r * 0.8, lava);
        });
      }
    }
    faceTo(e, a0);
    w.callout('THE MAGMA RISES!', FIRE);
    w.sfx('slam', 0.8);
    w.shake(4);
    w.fxBurst(e.x + Math.cos(a0) * e.r, e.y + 4, FIRE, 12, 12);
    pt.data.t1 = pt.t;
    pt.step = 1;
  } else if (pt.t >= pt.data.t1! + 0.7) k.end();
};

/**
 * The crucible tips: molten bone-steel pours along `channels` channels (`spread` rad apart) from the
 * boss toward the hero to the wall (at most `len`), each shown `width` wide for `wind` s, scalding for
 * `mul` of its blow, and left on the floor as a channel of lava that burns for `life` s.
 */
const pour: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  if (pt.step === 0) {
    const channels = k.num('channels', 1);
    const spread = k.num('spread', 0.9);
    const width = k.num('width', 26);
    const wind = k.num('wind', 1.1);
    const a0 = k.aimAt();
    const lanes: { a: number; len: number }[] = [];
    for (let c = 0; c < channels; c++) {
      const a = a0 + (c - (channels - 1) / 2) * spread;
      const end = castRay(w.map, e.x, e.y, 3, a, k.num('len', 420));
      const len = Math.max(e.r + 10, dist(e.x, e.y, end.x, end.y));
      lanes.push({ a, len });
      w.addTelegraph({ shape: 'line', x: e.x, y: e.y, r: 0, r2: width, angle: a, len, dur: wind, dmg: e.dmg * k.num('mul', 1.2), status: burn(e), knock: 80, tone: 'enemy', owner: -1, linger: 0 });
    }
    pt.data.x0 = e.x;
    pt.data.y0 = e.y;
    pt.data.wind = wind;
    pt.data.width = width;
    pt.data.lanes = lanes.length;
    lanes.forEach((l, i) => {
      pt.data[`a${i}`] = l.a;
      pt.data[`l${i}`] = l.len;
    });
    faceTo(e, a0);
    w.callout('THE CRUCIBLE POURS!', FIRE);
    w.sfx('windup', 0.6);
    pt.step = 1;
  } else if (pt.step === 1) {
    // the crucible steams as it tips
    if (w.rand() < 0.4) w.addFx({ kind: 'smoke', x: e.x + (w.rand() - 0.5) * 10, y: e.y - e.r - 8, vx: 0, vy: -18, life: 0.7, size: 3, color: '#5a4a46' });
    if (pt.t >= pt.data.wind!) {
      const width = pt.data.width!;
      for (let i = 0; i < pt.data.lanes!; i++) {
        const a = pt.data[`a${i}`]!;
        const len = pt.data[`l${i}`]!;
        for (let d = e.r + 6; d <= len - 4; d += width * 0.9) {
          const x = pt.data.x0! + Math.cos(a) * d;
          const y = pt.data.y0! + Math.sin(a) * d;
          addLava(w, e, x, y, width / 2 + 3, k.num('life', 8), 0.12);
          w.addFx({ kind: 'spark', x, y: y - 2, vx: (w.rand() - 0.5) * 30, vy: -40 - w.rand() * 40, life: 0.5, size: 2, color: GOLD });
        }
      }
      w.sfx('fireball', 0.8);
      w.sfx('squish', 0.5);
      w.shake(3);
      pt.data.t1 = pt.t;
      pt.step = 2;
    }
  } else if (pt.step === 2 && pt.t >= pt.data.t1! + 0.45) k.end();
};

/**
 * The core flares: heat rolls out from the boss in `rings` rings `width` px thick, one after another:
 * the circle round it first (`wind` s), then each ring beyond the last as it lands (`wind2` s). Each
 * scalds for `mul` of its blow: step in behind each ring as it passes.
 */
const core: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const width = k.num('width', 44);
  const rings = k.num('rings', 3);
  if (pt.step === 0) {
    pt.data.n = 0;
    pt.data.x = e.x;
    pt.data.y = e.y;
    w.callout('ITS CORE FLARES!', GOLD);
    w.sfx('beamCharge', 0.7);
    pt.step = 1;
  }
  if (pt.step === 1) {
    const n = pt.data.n!;
    const wind = n === 0 ? k.num('wind', 1) : k.num('wind2', 0.8);
    const x = pt.data.x!;
    const y = pt.data.y!;
    if (n === 0) w.addTelegraph({ shape: 'circle', x, y, r: width, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1.4), status: burn(e), knock: 120, tone: 'enemy', owner: -1, linger: 0 });
    else w.addTelegraph({ shape: 'donut', x, y, r: width * (n + 1), r2: width * n, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1.4), status: burn(e), knock: 60, tone: 'enemy', owner: -1, linger: 0 });
    pt.data.t1 = pt.t + wind;
    pt.step = 2;
  } else if (pt.step === 2 && pt.t >= pt.data.t1!) {
    const n = pt.data.n!;
    w.addFx({ kind: 'ring', x: pt.data.x!, y: pt.data.y!, life: 0.5, size: width * (n + 1) * 1.1, color: GOLD });
    for (let j = 0; j < 10; j++) {
      const a = w.rand() * TAU;
      const r = width * (n + 0.5);
      w.addFx({ kind: 'spark', x: pt.data.x! + Math.cos(a) * r, y: pt.data.y! + Math.sin(a) * r * 0.75, vx: 0, vy: -50, life: 0.45, size: 2, color: j % 2 ? GOLD : FIRE });
    }
    w.sfx('fireball', 0.5);
    w.shake(3);
    pt.data.n = n + 1;
    pt.data.t1 = pt.t;
    pt.step = pt.data.n >= rings ? 3 : 1;
  } else if (pt.step === 3 && pt.t >= pt.data.t1! + 0.3) k.end();
};

/**
 * The lake rises: fire comes up along every wall of the room, circles `r` round shown for `wind` s
 * (`inset` px in from the walls, `every` px apart) for `mul` of his blow, and stays until the end.
 */
const lake: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  if (pt.step === 0) {
    const b = roomBox(w, e);
    const inset = k.num('inset', 22);
    const every = k.num('every', 40);
    const r = k.num('r', 24);
    const wind = k.num('wind', 1.6);
    const spots: { x: number; y: number }[] = [];
    const add = (x: number, y: number): void => {
      // pushed in off the walls: rounded corners and pillars
      let px = x;
      let py = y;
      const cx = (b.x0 + b.x1) / 2;
      const cy = (b.y0 + b.y1) / 2;
      for (let i = 0; i < 6 && !onFloor(w, e, px, py, 3); i++) {
        px += (cx - px) * 0.08;
        py += (cy - py) * 0.08;
      }
      if (onFloor(w, e, px, py, 3) && spots.every((q) => dist(q.x, q.y, px, py) > every * 0.6)) spots.push({ x: px, y: py });
    };
    for (let x = b.x0 + inset; x <= b.x1 - inset; x += every) {
      add(x, b.y0 + inset);
      add(x, b.y1 - inset);
    }
    for (let y = b.y0 + inset + every; y <= b.y1 - inset - every; y += every) {
      add(b.x0 + inset, y);
      add(b.x1 - inset, y);
    }
    const phase = e.boss!.phase;
    for (const sp of spots) {
      w.addTelegraph({ shape: 'circle', x: sp.x, y: sp.y, r, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1.2), status: burn(e), knock: 80, tone: 'enemy', owner: -1, linger: 0 });
      w.after(wind, () => {
        if (fighting(w, e, phase)) addLasting(w, e, sp.x, sp.y, r);
      });
    }
    w.callout('THE LAKE OF FIRE RISES!', FIRE);
    w.sfx('quake', 0.8);
    w.shake(5);
    pt.data.t1 = pt.t;
    pt.step = 1;
  } else if (pt.t >= pt.data.t1! + 0.8) k.end();
};

/**
 * The heart of the mountain: fire round him (a circle of `r`, `wind` s: get away), then, as it lands,
 * everywhere but beside him (a ring from `r` out across the room, `wind2` s: get close). Each for `mul`
 * of his blow.
 */
const inferno: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const r = k.num('r', 80);
  if (pt.step === 0) {
    const wind = k.num('wind', 1.3);
    pt.data.x = e.x;
    pt.data.y = e.y;
    pt.data.t1 = pt.t + wind;
    w.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r, r2: 0, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1.6), status: burn(e), knock: 160, tone: 'enemy', owner: -1, linger: 0 });
    w.callout('GET AWAY!', GOLD);
    w.addFx({ kind: 'glow', x: e.x, y: e.y - 8, life: wind, size: 24, color: GOLD });
    w.sfx('beamCharge', 0.8);
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= pt.data.t1!) {
    const wind = k.num('wind2', 1.1);
    const x = pt.data.x!;
    const y = pt.data.y!;
    w.addFx({ kind: 'ring', x, y, life: 0.5, size: r * 1.2, color: FIRE });
    w.fxBurst(x, y - 6, GOLD, 20, r * 0.5);
    w.sfx('explode', 0.7);
    w.shake(5);
    const b = roomBox(w, e);
    const far = Math.max(dist(x, y, b.x0, b.y0), dist(x, y, b.x1, b.y0), dist(x, y, b.x0, b.y1), dist(x, y, b.x1, b.y1)) + 16;
    w.addTelegraph({ shape: 'donut', x, y, r: far, r2: r, angle: 0, len: 0, dur: wind, dmg: e.dmg * k.num('mul', 1.6), status: burn(e), knock: 60, tone: 'enemy', owner: -1, linger: 0 });
    w.callout('GET CLOSE!', GOLD);
    w.sfx('beamCharge', 0.8);
    pt.data.t1 = pt.t + wind;
    pt.step = 2;
  } else if (pt.step === 2 && pt.t >= pt.data.t1!) {
    const b = roomBox(w, e);
    for (let i = 0; i < 40; i++) {
      const x = b.x0 + w.rand() * (b.x1 - b.x0);
      const y = b.y0 + w.rand() * (b.y1 - b.y0);
      if (dist(x, y, pt.data.x!, pt.data.y!) > r && onFloor(w, e, x, y, 1)) w.addFx({ kind: 'spark', x, y, vx: 0, vy: -60 - w.rand() * 50, life: 0.5, size: 2, color: i % 2 ? GOLD : FIRE });
    }
    w.sfx('explode');
    w.shake(6);
    pt.data.t1 = pt.t;
    pt.step = 3;
  } else if (pt.step === 3 && pt.t >= pt.data.t1! + 0.4) k.end();
};

/** For tests: the state of a fight (chains, heat, leash, the Crown, the lasting fire). */
export function throneState(e: Enemy): { chains: string[]; heat: number; leash: number; crown: string; lasting: number; throne: { x: number; y: number } } | null {
  const s = FIGHTS.get(e);
  return s ? { chains: s.chains.map((c) => c.state), heat: s.heat, leash: s.leash, crown: s.crownState, lasting: s.lasting.length, throne: { x: s.tx, y: s.ty } } : null;
}

/* ------------------------------------------------------------ Ossa the Founder */

/**
 * Ossa the Founder (the Bone-Steel Foundry) pours the Host's bone-steel, and she has taken the hero's measure. She casts
 * their likeness (`likeness`): a figure of white-hot bone-steel, the hero to the life, that walks exactly where the hero
 * walked, a few seconds behind, until it cools. It burns whatever it touches, and no blow can touch it. Stand still and
 * it catches up; walk in circles and it cuts across your path: keep making new ground. Below half health she pours two
 * at once, a little apart, and a cooling likeness cracks and spits molten metal round it.
 *
 * The hero's path and the likenesses outlive the pattern that casts them, so they are kept per boss here and run by a
 * small ticker (World.after, once a step) for as long as the fight lasts.
 */

const MOLTEN = '#ffb060';
/** How far back the hero's path is kept (s): no likeness walks further behind than this. */
const TRAIL = 9;
/** A likeness walks no faster than this (px/s): across a blink's gap, or over to where the path begins. */
const STRIDE = 150;

interface Likeness {
  lag: number;
  until: number;
  hitT: number;
  fxT: number;
  mul: number;
  burst: number;
  at: { x: number; y: number; vx: number; vy: number; face: number };
}
interface Foundry {
  last: number;
  trail: { x: number; y: number; t: number }[];
  casts: Likeness[];
}

const FOUNDRIES = new WeakMap<Enemy, Foundry>();

function foundryOf(w: World, e: Enemy): Foundry {
  let s = FOUNDRIES.get(e);
  if (!s) {
    s = { last: w.time, trail: [], casts: [] };
    FOUNDRIES.set(e, s);
    w.after(0, () => foundryTick(w, e));
  }
  return s;
}

/** Where the hero stood at time `t` (or null if the path doesn't reach back that far). */
function trailAt(s: Foundry, t: number): { x: number; y: number } | null {
  const tr = s.trail;
  if (!tr.length || tr[0]!.t > t) return null;
  let lo = 0;
  let hi = tr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tr[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  const a = tr[lo]!;
  const b = tr[Math.min(tr.length - 1, lo + 1)]!;
  const k = b.t > a.t ? Math.min(1, (t - a.t) / (b.t - a.t)) : 0;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

function coolLikeness(w: World, e: Enemy, c: Likeness): void {
  const { x, y } = c.at;
  w.fxBurst(x, y - 10, '#8a8290', 16, 14);
  w.addFx({ kind: 'smoke', x, y: y - 12, vx: 0, vy: -20, life: 0.9, size: 8, color: '#5a5258' });
  if (c.burst > 0) {
    // it cracks as it cools, and spits molten metal round it
    w.addTelegraph({ shape: 'circle', x, y, r: c.burst, r2: 0, angle: 0, len: 0, dur: 0.7, dmg: e.dmg * 0.9, status: burn(e, 3), knock: 80, tone: 'enemy', owner: -1, linger: 0 });
    w.after(0.7, () => {
      if (!fighting(w, e)) return;
      for (let j = 0; j < 10; j++) {
        const a = (TAU * j) / 10;
        w.addFx({ kind: 'ember', x, y: y - 6, vx: Math.cos(a) * 70, vy: Math.sin(a) * 50 - 30, life: 0.5, size: 2, color: j % 2 ? MOLTEN : FIRE });
      }
      w.sfx('slam', 0.5);
    });
  }
}

function foundryTick(w: World, e: Enemy): void {
  const s = FOUNDRIES.get(e);
  if (!s) return;
  if (!fighting(w, e)) {
    const mine = new Set(s.casts.map((c) => c.at));
    w.likenesses = w.likenesses.filter((l) => !mine.has(l));
    FOUNDRIES.delete(e);
    return;
  }
  const dt = Math.max(0, w.time - s.last);
  s.last = w.time;
  const p = w.player;
  if (!p.dead) s.trail.push({ x: p.x, y: p.y, t: w.time });
  while (s.trail.length > 2 && s.trail[1]!.t < w.time - TRAIL) s.trail.shift();
  for (const c of s.casts) {
    // to where the hero stood `lag` seconds ago (or toward where their path begins), at a walk
    const want = trailAt(s, w.time - c.lag) ?? s.trail[0] ?? { x: c.at.x, y: c.at.y };
    const dx = want.x - c.at.x;
    const dy = want.y - c.at.y;
    const d = Math.hypot(dx, dy);
    const step = Math.min(d, STRIDE * dt);
    const nx = d > 0 ? c.at.x + (dx / d) * step : c.at.x;
    const ny = d > 0 ? c.at.y + (dy / d) * step : c.at.y;
    c.at.vx = dt > 0 ? (nx - c.at.x) / dt : 0;
    c.at.vy = dt > 0 ? (ny - c.at.y) / dt : 0;
    if (Math.hypot(c.at.vx, c.at.vy) > 8) c.at.face = Math.atan2(c.at.vx, c.at.vy);
    c.at.x = nx;
    c.at.y = ny;
    // white-hot: the floor glows under it (a warning to step off), and it burns what it touches
    c.fxT -= dt;
    if (c.fxT <= 0) {
      c.fxT = 0.2;
      w.addTelegraph({ shape: 'circle', x: c.at.x, y: c.at.y, r: 13, r2: 0, angle: 0, len: 0, dur: 0.25, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
      w.addFx({ kind: 'ember', x: c.at.x + (w.rand() - 0.5) * 10, y: c.at.y - 6 - w.rand() * 16, vx: 0, vy: -30, life: 0.5, size: 2, color: w.rand() < 0.5 ? MOLTEN : FIRE });
      w.addFx({ kind: 'glow', x: c.at.x, y: c.at.y - 8, life: 0.25, size: 12, color: FIRE });
    }
    c.hitT -= dt;
    if (!p.dead && c.hitT <= 0 && dist(p.x, p.y, c.at.x, c.at.y) < 12 + p.r) {
      c.hitT = 0.9;
      if (hurtPlayer(w, e.dmg * c.mul, { fromX: c.at.x, fromY: c.at.y, knock: 120, status: burn(e, 3), source: e })) w.text(p.x, p.y - 30, 'Burned by your own likeness!', '#ffd0a0', false);
    }
  }
  const cooled = s.casts.filter((c) => w.time >= c.until);
  if (cooled.length) {
    for (const c of cooled) coolLikeness(w, e, c);
    const gone = new Set(cooled.map((c) => c.at));
    w.likenesses = w.likenesses.filter((l) => !gone.has(l));
    s.casts = s.casts.filter((c) => w.time < c.until);
  }
  w.after(0, () => foundryTick(w, e));
}

/**
 * The likeness: `count` figures of the hero in white-hot bone-steel, `lag` s behind them (each next one `gap` s
 * further), cooling after `life` s; their touch burns for `mul` of her blow, and with `burst` a cooling one spits
 * molten metal `burst` px round it. She takes `wind` s to pour.
 */
const likeness: PatternFn = (w, e, _dt, k) => {
  const { pt } = k;
  const s = foundryOf(w, e);
  if (pt.step === 0) {
    faceTo(e, k.aimAt());
    w.callout('Hold still. Let me take your measure.', MOLTEN);
    w.addFx({ kind: 'glow', x: e.x, y: e.y - 14, life: 0.9, size: 26, color: FIRE });
    w.sfx('summon', 0.6);
    pt.data.t1 = pt.t;
    pt.step = 1;
  } else if (pt.step === 1 && pt.t >= pt.data.t1! + k.num('wind', 0.9)) {
    const n = k.num('count', 1);
    const lag = k.num('lag', 2.4);
    const gap = k.num('gap', 1.4);
    for (let i = 0; i < n; i++) {
      const lg = lag + i * gap;
      // poured from her crucible, it walks to the hero's path
      const at = { x: e.x + Math.cos(k.aimAt()) * (e.r + 8), y: e.y + Math.sin(k.aimAt()) * (e.r + 8), vx: 0, vy: 0, face: 0 };
      s.casts.push({ lag: lg, until: w.time + k.num('life', 9), hitT: 0.6, fxT: 0, mul: k.num('mul', 0.6), burst: k.num('burst', 0), at });
      w.likenesses.push(at);
      w.fxBurst(at.x, at.y - 10, MOLTEN, 22, 16);
      w.addFx({ kind: 'ring', x: at.x, y: at.y, life: 0.5, size: 20, color: MOLTEN });
    }
    w.text(w.player.x, w.player.y - 30, 'Your likeness walks your path: keep ahead of it!', '#ffe0c0', false);
    w.sfx('slam', 0.6);
    w.shake(2);
    pt.data.t2 = pt.t;
    pt.step = 2;
  } else if (pt.step === 2 && pt.t >= pt.data.t2! + 0.5) k.end();
};

/** Ossa's likenesses as they stand (for tests). */
export const likenessesOf = (e: Enemy): { x: number; y: number; lag: number }[] => (FOUNDRIES.get(e)?.casts ?? []).map((c) => ({ x: c.at.x, y: c.at.y, lag: c.lag }));

export const MOLTEN_THRONE_PATTERNS: Record<string, PatternFn> = {
  'throne:eruption': eruption,
  'throne:pour': pour,
  'throne:core': core,
  'throne:shackles': shackles,
  'throne:taut': taut,
  'throne:forge': forge,
  'throne:tear': tear,
  'throne:flail': flail,
  'throne:crown': crown,
  'throne:lake': lake,
  'throne:inferno': inferno,
  'throne:likeness': likeness,
};
