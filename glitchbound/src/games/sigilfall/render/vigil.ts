import { CLASSES } from '../data/classes';
import type { ClassId } from '../data/types';
import { newCharacter, type Face } from '../progress/character';
import { FIELD_ICONS, FOE_KINDS, SPELLS, type Element } from '../vigil/kit';
import { GALE, galeAngle, inPhase, LANE_LEN, LANE_RUN, LANE_W, LANE_WARN, LANTERN_R, RALLY_R, spotsNear, TRAIT, TRAITS, VENT_EVERY, VENT_QUIET, VENT_WARN, ventClock } from '../vigil/night';
import type { Fx, Hero, Obstacle, Slam, Vigil } from '../vigil/sim';
import { K, TILE, type TileMap } from '../sim/map';
import { iconPicture } from './art/gameIcons';
import { dangerColor, screenAngle, shortened, shot, spell, TONES, type Tone } from './effects';
import type { LandLayer, LandView } from './renderer';
import { heldWeapon, heroLook } from './sprites';
import type { HeroLook } from './art/hero';
import { heightFromRadius, Motion, PERSON_H, type Cast } from '../render3d/cast';
import { FIELD, FX, WARN, type Fx3D } from '../render3d/fx3d';
import type { Held } from '../render3d/dress';
import type { LandObject } from '../render3d/land';
import { shieldOf, turnOf } from '../render3d/worldCast';

/**
 * The Vigil's night: the Host and the party stand on the 3D land, and the spells are the shaders' (render3d/fx3d.ts),
 * each in its element's color. Numbers and bars go over them on the top canvas. All of it is in world pixels.
 */

const TAU = Math.PI * 2;
const FROZEN = [0.62, 0.86, 1.25] as const;
const CHILLED = [0.82, 0.93, 1.12] as const;
const INK = '#1c0e08';
/** What marks out the kinds of foe that ask for a different answer, as a wash over them. */
const KIND_TINT: Partial<Record<string, readonly [number, number, number]>> = { split: [0.78, 1.12, 0.7], burst: [1.3, 0.78, 0.55], guard: [0.72, 0.88, 1.3], rally: [1.25, 1.1, 0.6] };
const HEARTENED = [1.18, 1.0, 0.8] as const;
/** What a blow on its way is: a champion's, a falling rock, fire. */
const SLAM_TONE = ['#ff3a2a', '#e0a850', '#ff7a1e'] as const;

/* ---------------------------------------------------------------- what the land keeps */

/** What people built: a night's battlefield has none of it. */
const BUILT = new Set(['building', 'fence', 'gate', 'sign', 'shrine', 'waystone', 'brazier', 'pillar', 'well']);
const TALL = 40;
const spot = (x: number, y: number): number => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
};

/**
 * The Host comes from everywhere and walks straight at the hero, so a night's battlefield is open ground: its walls,
 * water and buildings are cleared away, leaving a ring of the land's own wall round the edge. Only what `keepOnLand`
 * keeps stands on it, and nobody walks through those.
 */
export function openBattlefield(map: TileMap): void {
  const edge = 2;
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const i = y * map.w + x;
      if (x < edge || y < edge || x >= map.w - edge || y >= map.h - edge) {
        map.kind[i] = K.Wall;
        continue;
      }
      const k = map.kind[i]!;
      if (k === K.Wall || k === K.Water || k === K.Bridge || k === K.House || k === K.HouseAnchor || k === K.Door || k === K.Cracked || k === K.Rampart || k === K.Illusion || k === K.Prop || k === K.Fence || k === K.Pillar || k === K.Brazier) map.kind[i] = K.Floor;
    }
  }
  map.buildings.length = 0;
  map.markers.length = 0;
}

/** The land thinned out for a fight: low things stay, and about one tree in five, with room to run between them. */
export function keepOnLand(o: LandObject): boolean {
  if (BUILT.has(o.kind) || (o.kind === 'prop' && o.name === 'well')) return false;
  if (-o.dy <= TALL) return true;
  return spot(o.x, o.y) < 0.22;
}

/** The trunks and boulders of what stays: nobody walks through these, hero or Host. */
export function trunksOf(objects: LandObject[]): Obstacle[] {
  const out: Obstacle[] = [];
  for (const o of objects) {
    if (!keepOnLand(o)) continue;
    // (as wide as what stands there: a foe walks round the leaves, not through them)
    if (-o.dy > TALL) out.push({ x: o.x, y: o.y, r: 15 });
    else if (o.kind === 'rock' || o.kind === 'bush') out.push({ x: o.x, y: o.y, r: 11 });
  }
  return out;
}
/* ---------------------------------------------------------------- the night */

/** More than this many little hits at once would only hide what they hit. */
const MAX_HITS = 30;
const MAX_FULL_BURSTS = 12;

const toneOfEl = (el: Element): Tone => EL_TONES[el];
const EL_TONES: Record<Element, Tone> = {
  fire: TONES.fire!,
  ice: TONES.frost!,
  lightning: TONES.lightning!,
  arcane: TONES.arcane!,
  nature: TONES.nature!,
  poison: TONES.poison!,
  holy: TONES.holy!,
  shadow: TONES.shadow!,
  water: { a: '#1a6ab8', b: '#a8e8ff' },
  blood: { a: '#a81e2e', b: '#ff9a9a' },
};
/** An element's ground. */
const FIELD_OF: Record<Element, [number, string, string]> = {
  fire: [FIELD.fire, '#ff5a1e', '#ffc23a'],
  ice: [FIELD.frost, '#7fd4ff', '#ffffff'],
  lightning: [FIELD.lightning, '#7ac8ff', '#ffffff'],
  arcane: [FIELD.rift, '#a05aff', '#f0d8ff'],
  nature: [FIELD.nature, '#4aa83a', '#b8ff8a'],
  poison: [FIELD.poison, '#5ab02e', '#c8ff6a'],
  holy: [FIELD.holy, '#ffd84d', '#fff2a0'],
  shadow: [FIELD.shadow, '#8a4aff', '#d0a8ff'],
  water: [FIELD.water, '#1a6ab8', '#7fd8ff'],
  blood: [FIELD.poison, '#a81e2e', '#ff7a7a'],
};
const FOE_SHOT: Tone = { a: '#d81e4a', b: '#ffc0d0' };

const icons = new Map<string, HTMLImageElement>();
function iconImage(name: string): HTMLImageElement | null {
  let im = icons.get(name);
  if (!im) {
    const src = iconPicture(name);
    if (!src) return null;
    im = new Image();
    im.src = src;
    icons.set(name, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}

const easeOut = (u: number): number => 1 - (1 - u) * (1 - u);
interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  dur: number;
  c: string;
  s: number;
}

const BITS = ['#ffe39a', '#ffb45c', '#ff7a3d', '#ffffff', '#c9b8ff'];
const SPARK_TIERS: [number, string, number][] = [
  [25, '#ffd257', 7],
  [5, '#6ac8ff', 5.4],
  [0, '#7dffb0', 4],
];

export interface PartyLook {
  face?: Face;
  body?: 'm' | 'f';
}

export class VigilPainter implements LandLayer {
  /** Who the watching player is: their own hero is the renderer's, everyone else's is drawn here. */
  meId: number;
  private readonly v: Vigil;
  private readonly looks = new Map<number, HeroLook>();
  private readonly held = new Map<number, Held>();
  private readonly motions = new Map<number, { m: Motion; turn: number }>();
  private readonly pops: { x: number; y: number; n: number; big: boolean; crit: boolean; t: number }[] = [];
  private readonly bits: Bit[] = [];
  private dt = 0;
  private readonly foeTurn = new Map<number, number>();

  constructor(v: Vigil, meId: number, party: Record<number, PartyLook> = {}) {
    this.v = v;
    this.meId = meId;
    for (const h of v.heroes) {
      const c = newCharacter(h.cls as ClassId, h.name, 'vigil');
      const p = party[h.id];
      this.looks.set(h.id, heroLook(h.cls as ClassId, c.equip, {}, p?.body ?? 'm', p?.face));
      this.held.set(h.id, heldWeapon(h.cls as ClassId, c.equip.weapon));
    }
  }

  /** Takes what has just happened, once a frame before the land is drawn. */
  frame(dt: number): void {
    this.dt = dt;
    const v = this.v;
    // (when too many hit at once, only a critical hit gets a number: a wall of them would hide the fight)
    for (const p of v.pops) if (this.pops.length < 14 || (p.crit && this.pops.length < 24)) this.pops.push({ ...p, t: 0 });
    v.pops.length = 0;
    for (const f of v.falls) {
      const n = f.boss ? 60 : f.elite ? 22 : 6;
      for (let i = 0; i < n && this.bits.length < 320; i++) {
        const a = Math.random() * TAU;
        const sp = (f.boss ? 60 : 26) + Math.random() * (f.boss ? 160 : 60);
        this.bits.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 24, t: 0, dur: 0.3 + Math.random() * 0.4, c: BITS[i % BITS.length]!, s: f.boss ? 2.4 : 1.4 });
      }
    }
    v.falls.length = 0;
  }

  private drawPickup(g: CanvasRenderingContext2D, kind: keyof typeof FIELD_ICONS, x: number, y: number, time: number): void {
    const bob = Math.sin(time * 4 + x) * 1.4;
    const r = kind === 'chest' ? 9 : 6.5;
    const im = iconImage(FIELD_ICONS[kind]);
    if (im) {
      g.save();
      g.beginPath();
      g.arc(x, y - r + bob, r, 0, TAU);
      g.closePath();
      g.lineWidth = 1;
      g.strokeStyle = INK;
      g.stroke();
      g.clip();
      g.imageSmoothingEnabled = true;
      g.drawImage(im, x - r, y - r * 2 + bob, r * 2, r * 2);
      g.imageSmoothingEnabled = false;
      g.restore();
    }
  }

  /* -------------------------------------------------------------- everything standing, sorted with the trees */

  /** Who stands on the land: the Host, the party's pets and the other heroes (the watching player's is the world's). */
  cast(cast: Cast, dt: number, time: number): void {
    const v = this.v;
    for (const f of v.foes) {
      const sprite = f.bossSprite ?? f.def.sprite;
      const size = f.boss ? 2 : f.elite ? 1.35 : 1;
      let clip = 'walk';
      let t = f.walk + f.id * 0.31;
      if (f.frozen > 0) t = f.id * 0.31;
      else if (f.stun > 0) {
        clip = 'hit';
        t = time * 0.4;
      } else if (f.mode === 1) {
        clip = 'chop';
        t = 0.14;
      } else if (f.mode === 2) clip = 'run';
      const cold = f.frozen > 0 ? FROZEN : f.slow > 0 ? CHILLED : f.boss ? undefined : (KIND_TINT[f.def.ai] ?? (f.rally > 0 ? HEARTENED : undefined));
      cast.shadow(f.x, f.y, f.r * size + 1);
      // (turning as a body turns, and fading from one clip to the next)
      const was = this.foeTurn.get(f.id) ?? turnOf(f.face);
      const d = ((turnOf(f.face) - was + Math.PI * 3) % TAU) - Math.PI;
      const turn = was + d * (1 - Math.exp(-dt * 10));
      this.foeTurn.set(f.id, turn);
      cast.creature(sprite, f.x, f.y, turn, heightFromRadius(f.def.r) * size, clip, t, clip !== 'chop', { flash: f.flash > 0 ? 0.8 : 0, tint: cold });
    }
    for (const p of v.pets) {
      cast.shadow(p.x, p.y, 7);
      cast.creature(p.sprite, p.x, p.y, turnOf(p.face), PERSON_H * 0.8, 'walk', p.walk, true);
    }
    // the Wild Run: a herd of the land's own beasts down each marked path
    const herd = v.waves[4]?.sprite;
    if (herd) {
      for (const l of v.lanes) {
        const u = (l.t - LANE_WARN) / LANE_RUN;
        if (u < 0 || u > 1) continue;
        const c = Math.cos(l.a);
        const n = Math.sin(l.a);
        for (let i = 0; i < 6; i++) {
          const along = (u * 1.3 - 0.15 - i * 0.05) * LANE_LEN - LANE_LEN / 2;
          if (Math.abs(along) > LANE_LEN / 2) continue;
          const side = ((i % 3) - 1) * LANE_W * 0.6;
          const x = l.x + c * along - n * side;
          const y = l.y + n * along + c * side;
          cast.shadow(x, y, 10);
          cast.creature(herd, x, y, turnOf(l.a), heightFromRadius(9) * 1.25, 'run', time * 1.6 + i * 0.2, true);
        }
      }
    }
    for (const h of v.heroes) {
      if (h.id === this.meId) continue;
      const look = this.looks.get(h.id);
      if (!look) continue;
      let s = this.motions.get(h.id);
      if (!s) {
        s = { m: new Motion(), turn: 0 };
        this.motions.set(h.id, s);
      }
      const moving = Math.hypot(h.vx, h.vy) > 4;
      s.turn = Math.atan2(h.dirX, h.dirY);
      s.m.set(h.down ? 'die' : moving ? 'run' : 'idle', !h.down);
      s.m.advance(dt);
      cast.shadow(h.x, h.y, 8);
      cast.person(look, this.held.get(h.id) ?? null, shieldOf(h.cls), h.x, h.y, s.turn, s.m, { alpha: h.iframe > 0 && Math.floor(time * 18) % 2 === 0 ? 0.5 : 1 });
    }
  }

  /* -------------------------------------------------------------- the spells (render3d/fx3d.ts) */

  fx(fx: Fx3D, cast: Cast, time: number): void {
    const v = this.v;
    const dt = this.dt;
    for (const f of v.fields) this.field(fx, cast, f);
    for (const h of v.heroes) {
      if (h.down) {
        fx.put({ kind: FX.mark, x: h.x, y: h.y, flat: true, w: REVIVE_DRAW * 2, a: '#ffe39a', alpha: 0.6 + Math.sin(time * 6) * 0.3 });
        continue;
      }
      this.auras(fx, cast, h, time);
    }
    this.land(fx, time);
    // where the blows are about to land
    for (const s of v.slams) this.slam(fx, s);
    for (const f of v.foes) {
      if (f.mode === 1) {
        const u = Math.max(0, 1 - f.modeT / (f.boss ? 0.9 : 0.7));
        const len = 150 * Math.min(1, u * 1.6);
        const a = Math.atan2(f.aimY, f.aimX);
        fx.put({ kind: FX.warn, x: f.x + (Math.cos(a) * len) / 2, y: f.y + (Math.sin(a) * len) / 2, flat: true, w: len, h: f.r * 1.6, rot: a, a: '#ff3a2a', t: 0.999, p1: WARN.line });
      }
      if (f.elite || f.boss) fx.put({ kind: FX.mark, x: f.x, y: f.y, flat: true, w: (f.r + (f.boss ? 9 : 5)) * 2, a: f.boss ? '#ff5a4a' : (TRAITS[f.trait]?.color ?? '#ffb02e'), alpha: 0.75 + Math.sin(time * 6) * 0.2 });
      // the Spark Thief: a column of gold over it, so it can be found in a crowd
      if (f.trait === TRAIT.thief) fx.put({ kind: FX.shaft, x: f.x, y: f.y, base: true, w: 16, h: 60, a: '#ffd257', alpha: 0.8, seed: f.id });
      if (!f.boss) {
        const ai = f.def.ai;
        // a Wallbearer's guard: an arc before it, gone while it is stopped
        if (ai === 'guard' && f.frozen <= 0 && f.stun <= 0) fx.put({ kind: FX.slash, x: f.x + Math.cos(f.face) * 4, y: f.y + Math.sin(f.face) * 4, up: 7, flat: true, w: ((f.r + 8) * 2) / 0.82, rot: f.face, a: FOE_KINDS.guard!.color, t: 0.45, p1: 1.7, p2: 1, alpha: 0.85 });
        // a Hostcaller's voice: how far it carries
        else if (ai === 'rally') fx.put({ kind: FX.mark, x: f.x, y: f.y, flat: true, w: RALLY_R * 2, a: FOE_KINDS.rally!.color, alpha: 0.28 + Math.sin(time * 4 + f.id) * 0.1 });
        // a Cinderbloat glows hotter and hotter
        else if (ai === 'burst') fx.put({ kind: FX.glow, x: f.x, y: f.y, up: 8, w: f.r * 5, a: FOE_KINDS.burst!.color, alpha: 0.55 + Math.sin(time * 10 + f.id) * 0.3 });
      }
      if (f.frozen > 0) fx.put({ kind: FX.field, x: f.x, y: f.y, flat: true, w: (f.r + 5) * 2, a: '#7fd4ff', b: '#ffffff', t: 1, seed: f.id * 0.3, p1: FIELD.frost });
    }
    for (const s of v.sparks) {
      const tier = SPARK_TIERS.find(([min]) => s.xp >= min)!;
      // (one that is fading under the Hollow Light flickers before it goes)
      fx.put({ kind: FX.spark, x: s.x, y: s.y, up: 6 + Math.sin(time * 5 + s.x) * 1.2, w: tier[2] * 3.2, a: tier[1], t: 0.1, alpha: (s.age ?? 0) > 6 ? 0.45 + Math.sin(time * 16 + s.x) * 0.35 : 1 });
    }
    for (const p of v.pickups) {
      const r = p.kind === 'chest' ? 9 : 6.5;
      const color = p.kind === 'chest' ? '#ffd257' : '#9fe8ff';
      fx.put({ kind: FX.glow, x: p.x, y: p.y, flat: true, w: r * 5, a: color, alpha: 0.7 });
      fx.put({ kind: FX.shaft, x: p.x, y: p.y, base: true, w: r * 2.6, h: 44, a: color, alpha: 0.7, seed: p.x * 0.1 });
      fx.put({ kind: FX.rain, x: p.x, y: p.y, base: true, w: r * 3.6, h: 34, a: color, t: -1, seed: p.y * 0.1 });
    }
    for (const s of v.foeShots) {
      fx.put({ kind: FX.mark, x: s.x, y: s.y, flat: true, w: s.r * 3.2 + 3, a: dangerColor() });
      shot(fx, 'blood', s.x, s.y, s.vx, s.vy, 12, s.r, s.x * 0.05 + s.y * 0.03, FOE_SHOT);
    }
    for (const s of v.shots) this.shot(fx, cast, s);
    for (const h of v.heroes) {
      if (h.down) continue;
      for (const o of v.orbitPoints(h)) this.orbiter(fx, cast, h, o, time);
    }
    let hits = 0;
    let bursts = 0;
    for (const f of v.fx) {
      if (f.kind === 'hit' && ++hits > MAX_HITS) continue;
      const u = Math.min(0.999, f.t / f.dur);
      // when dozens go off together, past the first few each is only its explosion
      if (f.kind === 'burst' && ++bursts > MAX_FULL_BURSTS) {
        const tone = toneOfEl(f.el);
        fx.put({ kind: FX.blast, x: f.x, y: f.y, up: 10, w: Math.max(26, Math.min(60, (f.r ?? 20) * 2)), a: tone.a, b: tone.b, t: u, seed: f.x * 0.1 });
        continue;
      }
      this.effect(fx, cast, f, u, time);
    }
    for (const b of this.bits) {
      b.t += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 140 * dt;
      fx.put({ kind: FX.spark, x: b.x, y: b.y, up: 9, w: b.s * 5, a: b.c, t: b.t / b.dur });
    }
    for (let i = this.bits.length - 1; i >= 0; i--) if (this.bits[i]!.t >= this.bits[i]!.dur) this.bits.splice(i, 1);
  }

  /** A blow on its way: a ring, a ring that is safe close in, or a line. */
  private slam(fx: Fx3D, s: Slam): void {
    const t = Math.max(0, Math.min(0.999, s.t / s.dur));
    const a = SLAM_TONE[s.tone ?? 0];
    if (s.len) {
      const rot = s.a ?? 0;
      fx.put({ kind: FX.warn, x: s.x + (Math.cos(rot) * s.len) / 2, y: s.y + (Math.sin(rot) * s.len) / 2, flat: true, w: s.len, h: (s.w ?? 12) * 2, rot, a, t, p1: WARN.line });
    } else if (s.inner) fx.put({ kind: FX.warn, x: s.x, y: s.y, flat: true, w: s.r * 2, a, t, p1: WARN.donut, p2: s.inner / s.r });
    else fx.put({ kind: FX.warn, x: s.x, y: s.y, flat: true, w: s.r * 2, a, t, p1: WARN.circle });
  }

  /** What the land's rule and the night's event put on the ground. */
  private land(fx: Fx3D, time: number): void {
    const v = this.v;
    const me = v.heroOf(this.meId) ?? v.me;
    for (const z of v.zones) {
      const seed = (z.x * 0.13 + z.y * 0.07) % 11;
      if (z.t < 0) {
        // a bramble about to sprout: where it will be
        fx.put({ kind: FX.warn, x: z.x, y: z.y, flat: true, w: z.r * 2, a: '#5a9a3a', t: Math.max(0, 1 + z.t / 1.4), p1: WARN.circle });
        continue;
      }
      const alpha = Math.min(1, (z.dur - z.t) / 1.2, z.t / 0.4 + 0.2);
      if (z.kind === 'glade') {
        fx.put({ kind: FX.field, x: z.x, y: z.y, flat: true, w: z.r * 2, a: '#8fe86a', b: '#fff2a0', t: 1, seed, p1: FIELD.holy, alpha });
        fx.put({ kind: FX.rune, x: z.x, y: z.y, flat: true, w: z.r * 2.05, a: '#c8ff9a', b: '#ffffff', t: 0.5, seed, alpha: alpha * 0.8 });
        fx.put({ kind: FX.shaft, x: z.x, y: z.y, base: true, w: z.r * 1.3, h: 120, a: '#d8ffb0', alpha: alpha * 0.45, seed });
        fx.put({ kind: FX.rain, x: z.x, y: z.y, base: true, w: z.r * 1.8, h: 44, a: '#d8ffb0', t: -1, seed, alpha });
      } else {
        fx.put({ kind: FX.field, x: z.x, y: z.y, flat: true, w: z.r * 2, a: '#2e5a1e', b: '#7a9a3a', t: 1, seed, p1: FIELD.nature, alpha });
        fx.put({ kind: FX.mark, x: z.x, y: z.y, flat: true, w: z.r * 2, a: '#b0481e', alpha: alpha * 0.7 });
      }
    }
    if (v.rules.includes('mire')) {
      for (const s of spotsNear(v.seed, 'mire', me.x, me.y, 420)) {
        fx.put({ kind: FX.field, x: s.x, y: s.y, flat: true, w: s.r * 2, a: '#2a4a3a', b: '#6a8a5a', t: 1, seed: s.off, p1: FIELD.water, alpha: 0.9 });
        fx.put({ kind: FX.mark, x: s.x, y: s.y, flat: true, w: s.r * 2, a: '#8ab07a', alpha: 0.45 });
      }
    }
    if (v.rules.includes('vents')) {
      for (const s of spotsNear(v.seed, 'vents', me.x, me.y, 420)) {
        const clock = ventClock(s, v.t);
        const warn = v.t > VENT_QUIET - VENT_WARN ? (clock - (VENT_EVERY - VENT_WARN)) / VENT_WARN : -1;
        fx.put({ kind: FX.mark, x: s.x, y: s.y, flat: true, w: s.r * 2, a: '#ff7a1e', alpha: 0.5 });
        fx.put({ kind: FX.field, x: s.x, y: s.y, flat: true, w: s.r * 1.1, a: '#5a1e0a', b: '#ff9a3d', t: 1, seed: s.off, p1: FIELD.fire, alpha: 0.75 });
        fx.put({ kind: FX.smoke, x: s.x, y: s.y, up: 10 + ((time * 14 + s.off * 9) % 26), w: 16, a: '#6a5a50', alpha: 0.35, t: ((time * 0.5 + s.off) % 1), seed: s.off });
        if (warn > 0) fx.put({ kind: FX.warn, x: s.x, y: s.y, flat: true, w: s.r * 2, a: SLAM_TONE[2], t: Math.min(0.999, warn), p1: WARN.circle });
      }
    }
    for (const l of v.lanes) {
      if (l.t < 0) continue;
      fx.put({ kind: FX.warn, x: l.x, y: l.y, flat: true, w: LANE_LEN, h: LANE_W * 2, rot: l.a, a: SLAM_TONE[1], t: Math.min(0.999, l.t / LANE_WARN), p1: WARN.line });
    }
    const e = v.event;
    if (e?.kind === 'lantern') {
      const seed = (e.x * 0.11) % 7;
      fx.put({ kind: FX.rune, x: e.x, y: e.y, flat: true, w: LANTERN_R * 2.05, a: '#ffe39a', b: '#ffffff', t: 0.5, seed });
      fx.put({ kind: FX.mark, x: e.x, y: e.y, flat: true, w: LANTERN_R * 2, a: '#ffd257', alpha: 0.7 + Math.sin(time * 5) * 0.2 });
      // the light fills as it is held
      if (e.prog > 0) fx.put({ kind: FX.field, x: e.x, y: e.y, flat: true, w: LANTERN_R * 2 * Math.sqrt(e.prog), a: '#ffd84d', b: '#fff2a0', t: 1, seed, p1: FIELD.holy, alpha: 0.8 });
      fx.put({ kind: FX.shaft, x: e.x, y: e.y, base: true, w: 12 + e.prog * 22, h: 150, a: '#ffe39a', alpha: 0.6 + e.prog * 0.4, seed });
      fx.put({ kind: FX.flame, x: e.x, y: e.y, base: true, w: 14, h: 22, a: '#ffb02e', b: '#fff2a0', seed });
    }
    // the gale: streaks of it going by, the way it blows
    if (v.rules.includes('gale') && inPhase(v.t, GALE)) {
      const a = galeAngle(v.seed, v.t);
      for (let i = 0; i < 9; i++) {
        const along = ((time * 260 + i * 83) % 420) - 210;
        const side = spot(i, 3.1) * 440 - 220;
        fx.put({ kind: FX.trail, x: me.x + Math.cos(a) * along - Math.sin(a) * side, y: me.y + Math.sin(a) * along + Math.cos(a) * side, up: 12, flat: true, w: 70, h: 7, rot: a, a: '#e8f2ff', b: '#ffffff', seed: i, alpha: 0.4 });
      }
    }
  }

  private field(fx: Fx3D, cast: Cast, f: Vigil['fields'][number]): void {
    const alpha = Math.min(1, f.life / 0.5, (f.max - f.life) / 0.15 + 0.2);
    const seed = (f.x * 0.13 + f.y * 0.07) % 11;
    const [look, a, b] = FIELD_OF[f.el];
    fx.put({ kind: FX.field, x: f.x, y: f.y, flat: true, w: f.r * 2, a: f.el === 'arcane' ? f.color : a, b, t: 1, seed, p1: look, alpha });
    fx.put({ kind: FX.rune, x: f.x, y: f.y, flat: true, w: f.r * 2.05, a: f.color, b: '#ffffff', t: 0.5, seed, alpha: alpha * 0.8 });
    fx.put({ kind: FX.rain, x: f.x, y: f.y, base: true, w: f.r * 1.9, h: 38, a: b, t: -1, seed, alpha });
    if (f.el === 'fire') {
      const n = Math.min(6, Math.round(f.r / 11));
      for (let i = 0; i < n; i++) {
        const ang = spot(i, seed) * TAU;
        const r = Math.sqrt(spot(seed, i)) * f.r * 0.72;
        fx.put({ kind: FX.flame, x: f.x + Math.cos(ang) * r, y: f.y + Math.sin(ang) * r, base: true, w: 15, h: 24, a, b, seed: seed + i, alpha });
      }
    }
    // a blade driven into the middle of it, to mark what it is
    if (f.spell === 'blood-banner' || f.spell === 'blessed-ground') {
      const k = 34 / TILE / 1.78;
      cast.thrown('w_sword_A', f.x, f.y, 1.42 * k * 0.9, 0.5, k, Math.PI);
    }
  }

  private auras(fx: Fx3D, cast: Cast, h: Hero, time: number): void {
    for (const au of this.v.auras(h)) {
      const pulse = 1 + Math.sin(time * 7) * 0.03;
      const [look, a, b] = FIELD_OF[au.el];
      const seed = h.id * 1.3;
      fx.put({ kind: FX.field, x: h.x, y: h.y, flat: true, w: au.r * 2 * pulse, a: au.el === 'arcane' ? au.color : a, b, t: 1, seed, p1: look, alpha: 0.5 });
      fx.put({ kind: FX.rune, x: h.x, y: h.y, flat: true, w: au.r * 2.05 * pulse, a: au.color, b: '#ffffff', t: 0.5, seed });
      // the blades themselves, flat out and pointing away from the hero
      if (au.spell === 'steel-tempest') {
        const k = 26 / TILE / 1.78;
        for (let i = 0; i < 3; i++) {
          const ang = time * 7 + (i / 3) * TAU;
          cast.thrown('w_sword_A', h.x + Math.cos(ang) * au.r * 0.55, h.y + Math.sin(ang) * au.r * 0.55, 13 / TILE, Math.atan2(Math.cos(ang), Math.sin(ang)), k, Math.PI / 2);
        }
      }
    }
    if (h.frenzyT > 0) {
      fx.put({ kind: FX.rain, x: h.x, y: h.y, base: true, w: 36, h: 52, a: '#ff9a3d', t: -1, seed: h.id });
      fx.put({ kind: FX.flame, x: h.x, y: h.y, base: true, w: 34, h: 40, a: '#ff5a1e', b: '#ffc23a', alpha: 0.55, seed: h.id, behind: true });
      fx.put({ kind: FX.mark, x: h.x, y: h.y, flat: true, w: 30 + Math.sin(time * 12) * 3, a: '#ff9a3d' });
    }
  }

  private shot(fx: Fx3D, cast: Cast, s: Vigil['shots'][number]): void {
    const seed = (s.x * 0.05 + s.y * 0.03) % 13;
    if (s.back) {
      // a thrown axe or hammer, turning end over end, leaving the air streaked behind it
      const kind = SPELLS[s.spell]?.weapon ?? 'axe';
      shot(fx, 'trail', s.x, s.y, s.vx, s.vy, 12, s.r * 0.8, seed, { a: s.color, b: '#ffffff' });
      const k = (s.r * 3.2) / TILE / 1.16;
      cast.thrown(kind === 'hammer' ? 'w_hammer_A' : 'w_axe_A', s.x, s.y, 12 / TILE, Math.atan2(s.vx, s.vy), k, s.spin);
      return;
    }
    shot(fx, s.el, s.x, s.y, s.vx, s.vy, 12, s.r, seed, toneOfEl(s.el));
  }

  private orbiter(fx: Fx3D, cast: Cast, h: Hero, o: { x: number; y: number; r: number; color: string; spell: string; el: Element }, time: number): void {
    const seed = (o.x * 0.05) % 7;
    if (o.spell === 'hawk-wheel') {
      fx.put({ kind: FX.glow, x: o.x, y: o.y, up: 14, w: o.r * 5, a: o.color, alpha: 0.5, behind: true });
      cast.creature('griffon', o.x, o.y, Math.atan2(h.y - o.y, o.x - h.x), o.r * 2.8, 'walk', time * 1.4 + o.y * 0.01, true, { lift: 0.5 });
      return;
    }
    const tone = toneOfEl(o.el);
    fx.put({ kind: FX.glow, x: o.x, y: o.y, up: 13, w: o.r * 6, a: o.color, alpha: 0.7 });
    if (o.el === 'holy') fx.put({ kind: FX.holy, x: o.x, y: o.y, up: 13, w: o.r * 5.5, a: tone.a, b: tone.b, seed });
    else fx.put({ kind: FX.orb, x: o.x, y: o.y, up: 13, w: o.r * 4.4, a: tone.a, b: tone.b, seed });
  }

  private effect(fx: Fx3D, cast: Cast, f: Fx, u: number, time: number): void {
    const r = f.r ?? 20;
    const tone = toneOfEl(f.el);
    const seed = (f.x * 0.37 + f.y * 0.61) % 13;
    switch (f.kind) {
      case 'hit':
        spell(fx, 'impact', tone, f.x, f.y, u, Math.max(14, r * 1.1), seed);
        break;
      case 'burst':
        spell(fx, 'blast', tone, f.x, f.y, u, r, seed);
        break;
      case 'nova': {
        const R = r * (0.18 + easeOut(u) * 0.82);
        const band = 11 * (1 - u * 0.6);
        const out = R + band;
        fx.put({ kind: FX.shock, x: f.x, y: f.y, flat: true, w: out * 2, a: tone.a, p1: R / out, p2: band / out, seed, alpha: 1 - u * u });
        fx.put({ kind: FX.glow, x: f.x, y: f.y, flat: true, w: R * 2.4, a: f.color, alpha: (1 - u) * 0.6 });
        const n = Math.max(6, Math.min(14, Math.round(r / 9)));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + seed;
          fx.put({ kind: f.freeze ? FX.frost : FX.impact, x: f.x + Math.cos(a) * R, y: f.y + Math.sin(a) * R, up: 8, w: f.freeze ? 16 : 26, h: f.freeze ? 8 : 26, rot: f.freeze ? a : 0, a: tone.a, b: tone.b, t: u, seed: seed + i, alpha: f.freeze ? 1 - u : 1 });
        }
        break;
      }
      case 'chain': {
        const pts = f.pts ?? [];
        const flick = Math.floor(time * 24);
        for (let i = 1; i < pts.length; i++) {
          const [px, py] = pts[i - 1]!;
          const [x, y] = pts[i]!;
          const dx = x - px;
          const dy = y - py;
          fx.put({ kind: FX.bolt, x: (x + px) / 2, y: (y + py) / 2, up: 12, w: Math.max(16, Math.hypot(dx, dy) * shortened(dx, dy) * 1.12), h: 30, rot: screenAngle(dx, dy), a: f.color, alpha: 1 - u * u, seed: flick + i });
          fx.put({ kind: FX.impact, x, y, up: 12, w: 28, a: tone.a, b: tone.b, t: u, seed: seed + i });
        }
        break;
      }
      case 'strike':
        this.strike(fx, cast, f, r, tone, seed);
        break;
      case 'drop': {
        const at = f.at ?? 0.18;
        const moon = f.el === 'water';
        if (f.t < at) {
          const fall = f.t / at;
          fx.put({ kind: FX.mark, x: f.x, y: f.y, flat: true, w: r * 2, a: f.color, alpha: fall * 0.8 });
          if (!moon) fx.put({ kind: FX.orb, x: f.x, y: f.y, up: 160 * (1 - fall), w: 14, a: tone.a, b: tone.b, seed });
          break;
        }
        const v = (f.t - at) / (f.dur - at);
        fx.put({ kind: FX.ring, x: f.x, y: f.y, flat: true, w: r * 2.4, a: f.color, t: v, seed });
        if (moon) {
          fx.put({ kind: FX.shaft, x: f.x, y: f.y, base: true, w: r * 1.8, h: 170, a: f.color, t: v, seed });
          fx.put({ kind: FX.impact, x: f.x, y: f.y, up: 8, w: r * 1.8, a: tone.a, b: tone.b, t: v, seed });
        } else if (f.el === 'poison') {
          fx.put({ kind: FX.poison, x: f.x, y: f.y, up: 6, w: r * 2.2, a: tone.a, b: tone.b, seed, alpha: 1 - v });
        } else fx.put({ kind: FX.impact, x: f.x, y: f.y, up: 10, w: r * 2.4, a: tone.a, b: tone.b, t: v, seed });
        break;
      }
      case 'cone':
        fx.put({ kind: FX.slash, x: f.x, y: f.y, up: 10, flat: true, w: (r * 2) / 0.82, rot: f.a ?? 0, a: f.color, t: u, p1: f.arc ?? 1.9, p2: 1 });
        break;
      case 'beam': {
        const a = f.a ?? 0;
        const len = f.len ?? 200;
        const ex = f.x + Math.cos(a) * len;
        const ey = f.y + Math.sin(a) * len;
        const alpha = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
        fx.put({ kind: FX.beam, x: (f.x + ex) / 2, y: (f.y + ey) / 2, up: 10, flat: true, w: len, h: (f.w ?? 8) * 2.4 * (1 - u * 0.7), rot: a, a: tone.a, b: tone.b, seed, alpha });
        spell(fx, 'cast', tone, f.x, f.y, u, 20, seed);
        fx.put({ kind: FX.impact, x: ex, y: ey, up: 10, w: 40, a: tone.a, b: tone.b, t: u, seed });
        break;
      }
      case 'heal':
        spell(fx, 'heal', f.el === 'holy' ? TONES.nature! : tone, f.x, f.y, u, 20, seed);
        break;
      case 'guard':
        spell(fx, 'shield', tone, f.x, f.y, Math.min(0.99, f.t / 0.5), 20, seed);
        if (f.t > 0.5) fx.put({ kind: FX.bubble, x: f.x, y: f.y, up: 16, w: 50, a: tone.a, alpha: 0.55 });
        break;
      case 'cast':
        spell(fx, 'cast', tone, f.x, f.y, u, 20, seed);
        break;
      case 'dash': {
        const a = f.a ?? 0;
        fx.put({ kind: FX.trail, x: f.x - Math.cos(a) * 16, y: f.y - Math.sin(a) * 16, up: 11, flat: true, w: 46, h: 20, rot: a, a: tone.a, b: tone.b, seed, alpha: 1 - u });
        fx.put({ kind: FX.smoke, x: f.x, y: f.y, up: 6, w: 22, a: '#c8c0b0', alpha: 0.6, t: u, seed });
        break;
      }
      case 'level':
        spell(fx, 'summon', tone, f.x, f.y, u, 30, seed);
        fx.put({ kind: FX.ring, x: f.x, y: f.y, flat: true, w: 150, a: '#ffe39a', t: u, seed });
        fx.put({ kind: FX.ring, x: f.x, y: f.y, flat: true, w: 96, a: '#8fd8ff', t: u, seed });
        break;
      case 'frenzy':
        spell(fx, 'buff', TONES.fire!, f.x, f.y, u, 30, seed);
        fx.put({ kind: FX.ring, x: f.x, y: f.y, flat: true, w: r * 2, a: '#ff9a3d', t: u, seed });
        break;
      case 'summon':
        spell(fx, 'summon', tone, f.x, f.y, u, 22, seed);
        break;
      case 'slam': {
        const R = r * (0.5 + easeOut(u) * 0.5);
        const band = 12 * (1 - u * 0.6);
        const out = R + band;
        fx.put({ kind: FX.shock, x: f.x, y: f.y, flat: true, w: out * 2, a: '#ff6a4a', p1: R / out, p2: band / out, seed, alpha: 1 - u });
        fx.put({ kind: FX.smoke, x: f.x, y: f.y, up: 8 + u * 12, w: r * 1.6, a: '#6a5a50', alpha: 0.6, t: u, seed });
        break;
      }
      case 'bomb':
        spell(fx, 'blast', tone, f.x, f.y, u, r, seed);
        break;
      case 'grave':
        // something is getting up here
        fx.put({ kind: FX.mark, x: f.x, y: f.y, flat: true, w: r * 2 * (0.5 + u * 0.5), a: f.color, alpha: 0.5 + u * 0.5 });
        fx.put({ kind: FX.smoke, x: f.x, y: f.y, up: 4 + u * 14, w: r * 1.6, a: '#8a80a8', alpha: 0.5, t: u, seed });
        break;
      case 'rake': {
        const a = f.a ?? 0;
        const len = f.len ?? 200;
        fx.put({ kind: FX.beam, x: f.x + (Math.cos(a) * len) / 2, y: f.y + (Math.sin(a) * len) / 2, up: 8, flat: true, w: len, h: (f.w ?? 12) * 2.6 * (1 - u * 0.6), rot: a, a: '#b81c28', b: '#ff9a8a', seed, alpha: 1 - u });
        break;
      }
    }
  }

  /** What falls from above: a star, a shaft of light, a gate, a giant's sword. */
  private strike(fx: Fx3D, cast: Cast, f: Fx, r: number, tone: Tone, seed: number): void {
    const at = f.at ?? 0.3;
    const look = f.look ?? 'star';
    const bladeK = Math.max(44, Math.min(84, r * 1.5)) / TILE / 3.25;
    if (f.t < at) {
      const fall = f.t / at;
      // the mark on the ground, closing in on where it lands
      fx.put({ kind: FX.mark, x: f.x, y: f.y, flat: true, w: r * 2 * (1.3 - fall * 0.3), a: f.color, alpha: 0.4 + fall * 0.6 });
      if (look === 'star' || look === 'lightning') {
        const size = Math.max(30, r * 1.1);
        const sx = f.x + 70 * (1 - fall);
        const up = 240 * (1 - fall);
        fx.put({ kind: FX.trail, x: sx + 24, y: f.y, up: up + 62, w: 100, h: size * 0.8, rot: Math.atan2(-122, -70), a: tone.a, b: tone.b, seed });
        fx.put({ kind: FX.orb, x: sx, y: f.y, up, w: size, a: tone.a, b: tone.b, seed });
      } else if (look === 'column') {
        fx.put({ kind: FX.shaft, x: f.x, y: f.y, base: true, w: Math.max(6, Math.min(40, r * 0.8) * fall * 0.7), h: 170, a: f.color, alpha: 0.5 + fall * 0.5, seed });
      } else if (look === 'portal') {
        fx.put({ kind: FX.rift, x: f.x, y: f.y, flat: true, w: Math.min(90, r * 2.2) * fall, a: f.color, b: tone.b, seed });
      } else if (look === 'blade') {
        cast.thrown('w_sword_E', f.x, f.y, (180 * (1 - fall)) / TILE + 2.82 * bladeK * 0.92, 0.6, bladeK, Math.PI);
      }
      return;
    }
    const u = (f.t - at) / (f.dur - at);
    fx.put({ kind: FX.ring, x: f.x, y: f.y, flat: true, w: r * 2.2, a: f.color, t: u, seed });
    if (look === 'column') fx.put({ kind: FX.shaft, x: f.x, y: f.y, base: true, w: Math.min(40, r * 0.8) * 2 * (1 - u * 0.75), h: 170, a: f.color, t: u * u, seed });
    else if (look === 'portal') fx.put({ kind: FX.rift, x: f.x, y: f.y, flat: true, w: Math.min(90, r * 2.2), a: f.color, b: tone.b, seed, alpha: 1 - u });
    else if (look === 'blade') cast.thrown('w_sword_E', f.x, f.y, (2.82 * bladeK * 0.92) * (1 - u * u), 0.6, bladeK, Math.PI);
    spell(fx, 'blast', tone, f.x, f.y, u, r, seed);
  }

  /* -------------------------------------------------------------- over everything: what you read */

  over(g: CanvasRenderingContext2D, time: number, view: LandView): void {
    const v = this.v;
    const dt = this.dt;
    const near = (x: number, y: number, m: number): boolean => x > view.x - m && x < view.x + view.w + m && y > view.y - m && y < view.y + view.h + m;
    for (const p of v.pickups) {
      if (!near(p.x, p.y, 20)) continue;
      view.up(p.x, p.y, 6);
      this.drawPickup(g, p.kind, p.x, p.y, time);
    }
    g.globalAlpha = 1;
    this.drawPeople(g, view);
    // the lantern or the thief, when it is out of sight: an arrow at the edge of the view
    const e = v.event;
    if (e && (e.kind === 'lantern' || e.kind === 'thief')) {
      const k = g.getTransform();
      this.edgeArrow(g, view.project(e.x, e.y, 10), '#ffd257');
      g.setTransform(k);
    }
    // numbers: the game's only smooth letters, so they can be read at a glance
    g.textAlign = 'center';
    g.lineJoin = 'round';
    for (const n of this.pops) {
      n.t += dt;
      const u = n.t / 0.62;
      view.up(n.x, n.y, 18);
      const y = n.y - u * 14;
      const size = (n.crit ? 11 : n.big ? 9 : 6.4) * (u < 0.18 ? 1 + (0.18 - u) * 2.6 : 1);
      g.font = `800 ${size}px Georgia, serif`;
      g.globalAlpha = Math.max(0, 1 - u * u);
      g.lineWidth = 1.6;
      g.strokeStyle = INK;
      const text = n.crit ? `${n.n}!` : String(n.n);
      const x = n.x + Math.sin(n.y) * 3;
      g.strokeText(text, x, y);
      g.fillStyle = n.crit ? '#ff7a3d' : n.big ? '#ffd257' : '#fff6e0';
      g.fillText(text, x, y);
    }
    for (let i = this.pops.length - 1; i >= 0; i--) if (this.pops[i]!.t >= 0.62) this.pops.splice(i, 1);
    g.globalAlpha = 1;
    g.textAlign = 'start';
  }

  /** Everyone's health, names and, for whoever is out of sight, which way they are. */
  private drawPeople(g: CanvasRenderingContext2D, view: LandView): void {
    const v = this.v;
    for (const h of v.heroes) {
      const mine = h.id === this.meId;
      const color = CLASSES[h.cls as ClassId].colors.accent;
      const head = view.project(h.x, h.y, PERSON_H + 2);
      if (h.down) {
        if (h.reviveT > 0) {
          view.up(h.x, h.y, 14);
          g.beginPath();
          g.arc(h.x, h.y, 5, -Math.PI / 2, -Math.PI / 2 + (h.reviveT / 3) * TAU);
          g.lineWidth = 2;
          g.strokeStyle = '#7fe06a';
          g.stroke();
        }
      } else {
        const max = v.maxHpOf(h);
        const k = h.hp / max;
        view.bar(head.x, head.y, 40, k, k < 0.3 ? '#ff4f6a' : mine ? '#7fe06a' : '#6ac8ff');
      }
      if (mine) continue;
      view.label(h.name, head.x, head.y - 12, 11, color);
      // out of sight: an arrow at the edge of the view
      this.edgeArrow(g, head, h.down ? '#ff4f6a' : color);
    }
  }

  /** An arrow at the edge of the view toward something out of sight (nothing, when it is in sight). Leaves the canvas in screen points. */
  private edgeArrow(g: CanvasRenderingContext2D, at: { x: number; y: number }, color: string): void {
    const m = 22;
    const host = g.canvas;
    const sw = host.clientWidth || 1;
    const sh = host.clientHeight || 1;
    if (at.x > m && at.x < sw - m && at.y > m && at.y < sh - m) return;
    const a = Math.atan2(at.y - sh / 2, at.x - sw / 2);
    const t = Math.min((sw / 2 - m) / Math.max(0.001, Math.abs(Math.cos(a))), (sh / 2 - m) / Math.max(0.001, Math.abs(Math.sin(a))));
    const k = g.canvas.width / sw;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.translate(sw / 2 + Math.cos(a) * t, sh / 2 + Math.sin(a) * t);
    g.rotate(a);
    g.beginPath();
    g.moveTo(12, 0);
    g.lineTo(-8, -9);
    g.lineTo(-8, 9);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = INK;
    g.stroke();
  }
}

/** The ring around a downed friend: stand in it to get them up (sim.ts's reach). */
const REVIVE_DRAW = 30;
