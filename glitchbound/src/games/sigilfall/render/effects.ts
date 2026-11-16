import { clamp, hash2, TAU } from '../core/math';
import { DAY_LIGHT, DOOR_LIGHT, zoneLight } from './zoneLight';
import type { MountDef } from '../data/mounts';
import { mountDef, riddenMount, wornLooks } from '../progress/wardrobe';
import type { ClassId } from '../data/types';
import { SKILLS } from '../data/skills';
import { CLASSES } from '../data/classes';
import { colorOf, FIELD, FX, WARN, type Fx3D } from '../render3d/fx3d';
import { heightFromRadius, PERSON_H, type Cast } from '../render3d/cast';
import { kitOf } from '../render3d/kits';
import { PITCH } from '../render3d/land';
import type { Land3D, RoofSpot } from '../render3d/land';
import { bossHidden } from '../sim/boss';
import { hasStatus } from '../sim/combat';
import { TILE } from '../sim/map';
import type { Enemy, Fx, Projectile, Telegraph, TelegraphKind } from '../sim/types';
import { SUMMON_TIME, type World } from '../sim/world';

/**
 * Every spell, shot, flame and warning, handed to the shaders in render3d/fx3d.ts: what each thing in the rules looks
 * like. Names, bars and numbers stay on the 2D canvas; everything that glows, flows or burns is here.
 */

const SIN_P = Math.sin(PITCH);
/** The angle a direction on the ground has on the screen. */
export const screenAngle = (dx: number, dy: number): number => Math.atan2(-dy * SIN_P, dx);
/** How much of a length along a direction on the ground is left on the screen. */
export const shortened = (dx: number, dy: number): number => Math.hypot(dx, dy * SIN_P) / (Math.hypot(dx, dy) || 1);

export interface Tone {
  a: string;
  b: string;
}

/** A damage type's colors: what its effects are made of. */
export const TONES: Record<string, Tone> = {
  fire: { a: '#ff5a1e', b: '#ffd24a' },
  frost: { a: '#4ab8ff', b: '#e0f8ff' },
  lightning: { a: '#6ab8ff', b: '#ffffff' },
  arcane: { a: '#a05aff', b: '#f4e4ff' },
  poison: { a: '#5ab82e', b: '#d8ff8a' },
  shadow: { a: '#7a3ad8', b: '#d8b8ff' },
  holy: { a: '#ffc23a', b: '#fff6c8' },
  nature: { a: '#58c848', b: '#e4ffc8' },
  physical: { a: '#e0d8c8', b: '#ffffff' },
};
/** What a mark on the ground asks of the hero (sim/types.ts TelegraphKind): absent, it is an attack. */
/**
 * Whether something drawn round (x, y), reaching `reach` world pixels from it, can be in a view `vw` by `vh` centered
 * on (cx, cy). A little past the view's edges counts (the camera's tilt shows more up the picture than its flat size).
 */
export const inView = (cx: number, cy: number, vw: number, vh: number, x: number, y: number, reach = 0): boolean => Math.abs(x - cx) < vw * 0.7 + reach && Math.abs(y - cy) < vh * 0.9 + reach;

export const telegraphKind = (t: { kind?: TelegraphKind }): TelegraphKind => t.kind ?? 'danger';

/** The colors a blow about to land can be drawn in (Settings.dangerTone): red, or magenta for red-green color blindness. */
export const DANGER_TONES = { red: '#ff3b3b', magenta: '#ff2bd6' } as const;
let danger: string = DANGER_TONES.red;
/** What a blow about to land is drawn in, as the player chose it (engine.ts applySettings). */
export const dangerColor = (): string => danger;
export function setDangerTone(tone: keyof typeof DANGER_TONES): void {
  danger = DANGER_TONES[tone] ?? DANGER_TONES.red;
}
/** The colors of the marks that aren't attacks: gold for safety, blue for a place to stand, grey for a plain warning. */
export const KIND_COLOR: Record<Exclude<TelegraphKind, 'danger'>, string> = { safe: '#ffd24a', stand: '#4aa8ff', warn: '#b8b4c4' };
const toneOf = (type: string): Tone => TONES[type] ?? TONES.physical!;

/** What fire looks like in a place: most burn orange, a deep place its own color. */
const FIRE: Record<string, Tone> = {
  default: { a: '#f4561f', b: '#ffb02e' },
  // the cold dead of a crypt burn pale; a giant's ice burns blue; a rift burns violet; the rot burns sick green
  crypt: { a: '#4a7ad8', b: '#a8d8f8' },
  icecave: { a: '#2a8ad8', b: '#90e0f8' },
  riftspire: { a: '#a03ae0', b: '#f090f8' },
  roots: { a: '#5a9a2a', b: '#c0e050' },
  // Duskspire, the Hallow King's frozen citadel: grieflight burning cold, violet at the heart and ice-white at the tips
  citadel: { a: '#6a5ad8', b: '#d0e4ff' },
  lavacave: { a: '#e0321a', b: '#ff8a1e' },
  cistern: { a: '#3a9a78', b: '#80e0b0' },
};

const FIELDS: Record<string, [number, string, string]> = {
  fire: [FIELD.fire, '#ff5a1e', '#ffc23a'],
  poison: [FIELD.poison, '#5ab02e', '#c8ff6a'],
  frost: [FIELD.frost, '#7fd4ff', '#ffffff'],
  arrows: [FIELD.arrows, '#f5e6c8', '#f5e6c8'],
  lightning: [FIELD.lightning, '#7ac8ff', '#ffffff'],
  rift: [FIELD.rift, '#ff3fd2', '#22e4ff'],
  holy: [FIELD.holy, '#ffd84d', '#fff2a0'],
  shadow: [FIELD.shadow, '#8a4aff', '#d0a8ff'],
  nature: [FIELD.nature, '#4aa83a', '#b8ff8a'],
};

/**
 * The colors of a class's own spells, beyond the damage types' (sim/cast.ts names them after the colon of a spell
 * effect: `crush:steel`, `pillar:fire`, `golemfall:brimstone`...).
 */
const SPELL_TONES: Record<string, Tone> = {
  // the warrior's blows: red-hot steel; a wound's blood
  steel: { a: '#e0502e', b: '#ffe6c0' },
  blood: { a: '#c8202a', b: '#ff8a70' },
  // the paladin's gold of dawn
  dawn: { a: '#ffb630', b: '#fff6d0' },
  // the gloam knight's dusk: lavender over the dark
  gloam: { a: '#7a4ad8', b: '#d8c0ff' },
  // the druid's shapes: a lynx's claws, a bear's weight; the moon and the stars
  cat: { a: '#ff8a2a', b: '#ffe0a0' },
  bear: { a: '#a8743a', b: '#f0d8a8' },
  lunar: { a: '#c06aff', b: '#ffe8ff' },
  moon: { a: '#8a9aff', b: '#eef2ff' },
  solar: { a: '#ff9a2a', b: '#fff2c0' },
  // the warlock's brimstone and its ruin: fire gone to blood and violet
  brimstone: { a: '#e0401a', b: '#ffb040' },
  ruin: { a: '#d02a5a', b: '#ffc080' },
  // the priest's shadow on the mind
  psy: { a: '#8a3ae0', b: '#f0d0ff' },
  // the earth itself
  earth: { a: '#c08a4a', b: '#ffe0b0' },
};

/** A druid's Starfall on the ground: a ring of moonlit runes. */
const STARFALL_FIELD: [number, string, string] = [FIELD.holy, '#a06aff', '#f0d8ff'];

/** How long a named spell effect plays, in seconds (the rest play out over the life the rules gave them). */
const LENGTHS: Record<string, number> = { impact: 0.36, blast: 0.62, cast: 0.6, buff: 0.85, heal: 0.9, shield: 0.7, summon: 0.95, teleport: 0.55, charge: 0.65, debuff: 0.6, shatter: 0.55, thunder: 0.5 };

/** What a shot is made of, going by the color a foe's data gives it. */
type Stuff = 'water' | 'fire' | 'poison' | 'shadow' | 'rift' | 'holy' | 'soul' | 'pale' | 'frost' | 'rock';

interface Dye {
  stuff: Stuff;
  /** A shot's outside: deep. */
  a: string;
  /** Its inside: bright. */
  b: string;
}

const hex2 = (n: number): string => Math.round(clamp(n, 0, 1) * 255).toString(16).padStart(2, '0');
const mixHex = (c: readonly [number, number, number], to: number, k: number): string => `#${hex2(c[0] + (to - c[0]) * k)}${hex2(c[1] + (to - c[1]) * k)}${hex2(c[2] + (to - c[2]) * k)}`;

const dyes = new Map<string, Dye>();
/** The stuff a color reads as, and its deep and bright shades. */
function dyeOf(color: string): Dye {
  let d = dyes.get(color);
  if (d) return d;
  const c = colorOf(color);
  const mx = Math.max(c[0], c[1], c[2]);
  const mn = Math.min(c[0], c[1], c[2]);
  const l = (mx + mn) / 2;
  const s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (mx !== mn) {
    if (mx === c[0]) h = ((c[1] - c[2]) / (mx - mn) + 6) % 6;
    else if (mx === c[1]) h = (c[2] - c[0]) / (mx - mn) + 2;
    else h = (c[0] - c[1]) / (mx - mn) + 4;
    h *= 60;
  }
  let stuff: Stuff;
  if (mx - mn < 0.16) stuff = l > 0.55 ? 'pale' : 'rock';
  else if (s < 0.22) stuff = l > 0.55 ? 'soul' : 'rock';
  else if (h < 12 || h >= 345) stuff = 'fire';
  else if (h < 42) stuff = s < 0.45 ? 'rock' : 'fire';
  else if (h < 64) stuff = s < 0.5 ? 'soul' : 'holy';
  else if (h < 170) stuff = 'poison';
  else if (h < 232) stuff = 'frost';
  else if (h < 295) stuff = 'shadow';
  else stuff = 'rift';
  d = { stuff, a: mixHex(c, 0, 0.45), b: mixHex(c, 1, 0.45) };
  dyes.set(color, d);
  return d;
}

/** A foe's head, in world pixels. */
export function headOf(e: Enemy): number {
  const kit = kitOf(e.def.sprite, e.def.id);
  return heightFromRadius(e.r, kit.size ?? 1) * 0.92 + (kit.float ?? 0) * 16 + 4;
}

export interface EffectsScene {
  fx: Fx3D;
  cast: Cast;
  land: Land3D | null;
  time: number;
  /**
   * Whether a spot is near enough to the view to matter. `reach`: how far what is drawn there goes from the spot (a
   * blow's circle, a pool on the ground): something whose middle is off the picture can still lie half across it.
   */
  near(x: number, y: number, reach?: number): boolean;
}

/** Where the hero stands this frame (Effects.ground sets it): a blast round them is drawn lighter. Far off, by default. */
const heroAt = { x: -1e9, y: -1e9 };

/** An effect by name, somewhere on its way through its life (`u`, 0 to 1): The Vigil's spells use them too. */
export function spell(fx: Fx3D, name: string, tone: Tone, x: number, y: number, u: number, size: number, seed: number, angle = 0): void {
  const a = tone.a;
  const b = tone.b;
  switch (name) {
    case 'impact': {
      const w = Math.max(30, size * 2.2);
      fx.put({ kind: FX.impact, x, y, up: 13, w, a, b, t: u, seed });
      fx.put({ kind: FX.ring, x, y, flat: true, w: w * 0.8, a, t: u, seed });
      break;
    }
    case 'blast': {
      const R = Math.max(16, size);
      // (one going off round the hero, their own nova: lighter, and no smoke, so the hero is seen in the middle of it;
      // a Rime Burst used to swallow them whole for half a second)
      const own = Math.hypot(x - heroAt.x, y - heroAt.y) < 8;
      fx.put({ kind: FX.field, x, y, flat: true, w: R * 2, a: mixHex(colorOf(a), 0, 0.5), b: a, t: 0.34 * (1 - u), seed, p1: FIELD.fire });
      fx.put({ kind: FX.blast, x, y, up: R * 0.42, w: R * 2.7, a, b, t: u, seed, ...(own ? { alpha: 0.5 } : {}) });
      fx.put({ kind: FX.ring, x, y, flat: true, w: R * 2.3, a: b, t: u, seed });
      if (u > 0.3 && !own) fx.put({ kind: FX.smoke, x, y, up: R * 0.5 + u * 14, w: R * (1.6 + u * 1.2), a: '#3a3440', alpha: 0.5, t: u, seed });
      break;
    }
    case 'cast':
      fx.put({ kind: FX.rune, x, y, flat: true, w: 42, a, b, t: u, seed });
      fx.put({ kind: FX.gather, x, y, up: 16, w: 46, a, b, t: u, seed });
      break;
    case 'buff':
      fx.put({ kind: FX.rune, x, y, flat: true, w: 44, a, b, t: u, seed });
      fx.put({ kind: FX.rain, x, y, base: true, w: 40, h: 56, a: b, t: u, seed });
      fx.put({ kind: FX.shaft, x, y, base: true, w: 34, h: 52, a, alpha: 0.5, t: u, seed });
      break;
    case 'heal':
      fx.put({ kind: FX.rain, x, y, base: true, w: 42, h: 60, a: '#8cffa0', t: u, seed });
      fx.put({ kind: FX.rain, x, y, base: true, w: 34, h: 50, a: b, t: u, seed: seed + 3 });
      fx.put({ kind: FX.shaft, x, y, base: true, w: 36, h: 56, a: '#5ae07a', alpha: 0.45, t: u, seed });
      fx.put({ kind: FX.ring, x, y, flat: true, w: 44, a: '#8cffa0', t: u, seed });
      break;
    case 'shield':
      fx.put({ kind: FX.bubble, x, y, up: 16, w: 50, a, t: u * u, seed });
      fx.put({ kind: FX.ring, x, y, flat: true, w: 46, a: b, t: u, seed });
      break;
    case 'summon':
      fx.put({ kind: FX.rune, x, y, flat: true, w: 64, a, b, t: u, seed });
      fx.put({ kind: FX.shaft, x, y, base: true, w: 44, h: 86, a, t: u, seed });
      fx.put({ kind: FX.rain, x, y, base: true, w: 46, h: 66, a: b, t: u, seed });
      break;
    case 'teleport':
      fx.put({ kind: FX.shaft, x, y, base: true, w: 34, h: 80, a, t: u, seed });
      fx.put({ kind: FX.ring, x, y, flat: true, w: 52, a: b, t: u, seed });
      fx.put({ kind: FX.spark, x, y, up: 16, w: 46 * (1 - u), a, t: u, seed });
      break;
    case 'charge':
      fx.put({ kind: FX.gather, x, y, up: 15, w: 64, a, b, t: u, seed });
      fx.put({ kind: FX.rune, x, y, flat: true, w: 52, a, b, t: u, seed });
      break;
    case 'debuff':
      fx.put({ kind: FX.ring, x, y, flat: true, w: 36, a, t: 1 - u, seed });
      fx.put({ kind: FX.rain, x, y, base: true, w: 30, h: 42, a, t: u, seed });
      break;
    case 'shatter': {
      const R = Math.max(18, size);
      fx.put({ kind: FX.impact, x, y, up: 14, w: R * 2.4, a, b, t: u, seed });
      fx.put({ kind: FX.field, x, y, flat: true, w: R * 2, a, b, t: 0.34 * (1 - u), seed, p1: FIELD.frost });
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * TAU + seed;
        const out = R * 1.1 * (1 - (1 - u) * (1 - u));
        fx.put({ kind: FX.frost, x: x + Math.cos(ang) * out, y: y + Math.sin(ang) * out, up: 9 + Math.sin(u * Math.PI) * 14, w: 12, h: 6, rot: ang + u * 5, a, b, alpha: clamp(1.4 - u * 1.4, 0, 1), seed: seed + i });
      }
      break;
    }
    case 'thunder': {
      const R = Math.max(18, size);
      fx.put({ kind: FX.bolt, x, y, base: true, w: 40, h: 170, a, seed: seed + Math.floor(u * 4), p1: 1, alpha: clamp(1.4 - u * 1.4, 0, 1) });
      fx.put({ kind: FX.impact, x, y, up: 8, w: R * 2.2, a, b, t: u, seed });
      fx.put({ kind: FX.ring, x, y, flat: true, w: R * 2.2, a: b, t: u, seed });
      break;
    }
    default:
      bigSpell(fx, name, tone, x, y, u, size, seed, angle);
      break;
  }
}

/** How a world height shows on the screen against a length across it (the camera looks down at PITCH). */
const COS_P = Math.cos(PITCH);

/**
 * Something coming down out of the sky onto (x, y), `u` of the way there (gathering speed as it falls): from `from`
 * world pixels to the west and `high` up. Where it is now, and its heading as an angle on the screen.
 */
function fallen(x: number, u: number, from: number, high: number): { x: number; up: number; rot: number; k: number } {
  const k = u * (0.55 + 0.45 * u);
  return { x: x - from * (1 - k), up: high * (1 - k), rot: Math.atan2(-high * COS_P, from), k };
}

/** A ring of force racing out over the ground (or `up` over it), `r` across, `width` thick. */
function shockRing(fx: Fx3D, x: number, y: number, r: number, width: number, a: string, alpha: number, seed: number, up = 0): void {
  const out = r + width;
  fx.put({ kind: FX.shock, x, y, up, flat: true, w: out * 2, a, alpha, p1: r / out, p2: width / out, seed });
}

/** Lumps of whatever was struck, flung out of (x, y) and falling back (`u`: 0 to 1 through their flight). */
function rubble(fx: Fx3D, x: number, y: number, R: number, u: number, n: number, seed: number, a: string, b: string): void {
  const k = Math.min(1, u * 1.5);
  const alpha = clamp(1.7 - u * 1.8, 0, 1);
  if (alpha <= 0) return;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + seed * 1.7;
    const out = R * (0.3 + (0.9 + (i % 3) * 0.2) * k);
    const hop = Math.sin(k * Math.PI) * (22 + (i % 3) * 10);
    fx.put({ kind: FX.chip, x: x + Math.cos(ang) * out, y: y + Math.sin(ang) * out * 0.8, up: 3 + hop, w: 5 + (i % 3) * 2, rot: ang + u * 9, a: i % 2 ? a : b, alpha });
  }
}

/** Dust or smoke going up from a blow: `n` puffs round (x, y), drifting out. */
function dust(fx: Fx3D, x: number, y: number, R: number, u: number, n: number, seed: number, a: string, alpha: number): void {
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + seed;
    const out = R * (0.35 + 0.65 * u);
    fx.put({ kind: FX.smoke, x: x + Math.cos(ang) * out, y: y + Math.sin(ang) * out * 0.7, up: 3 + u * 10, w: R * (0.55 + u * 0.6), a, alpha, t: u, seed: seed + i * 1.9 });
  }
}

/**
 * The great spells, each its own look: what falls out of the sky, what comes up out of the ground, the heavy blows and
 * the ultimates (sim/cast.ts asks for them by name). `size`: its reach in world pixels; `angle`: which way it was aimed
 * (a blow's swing), on the ground.
 */
function bigSpell(fx: Fx3D, name: string, tone: Tone, x: number, y: number, u: number, size: number, seed: number, angle: number): void {
  const { a, b } = tone;
  const R = Math.max(14, size);
  const fade = clamp(1 - u, 0, 1);
  switch (name) {
    // Flame Pillar, gathering: the ground under it cracks and glows, flames lick up round its edge, taller as it comes
    case 'pyre': {
      const k = u * u;
      fx.put({ kind: FX.glow, x, y, flat: true, w: R * 3.2, a, alpha: 0.2 + 0.55 * k });
      fx.put({ kind: FX.crack, x, y, flat: true, w: R * 2.1, a, b, t: 1 - 0.8 * k, seed });
      fx.put({ kind: FX.rune, x, y, flat: true, w: R * 2.15, a, b, t: 0.35 + 0.25 * u, seed });
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + seed;
        fx.put({ kind: FX.flame, x: x + Math.cos(ang) * R * 0.82, y: y + Math.sin(ang) * R * 0.82, base: true, w: 12 + 8 * k, h: 8 + 28 * k, a, b, seed: seed + i, alpha: 0.35 + 0.65 * u });
      }
      fx.put({ kind: FX.rain, x, y, base: true, w: R * 1.8, h: 40 + 50 * k, a: b, t: -1, seed, p1: 1 });
      break;
    }
    // Flame Pillar, erupting: a column of fire standing up out of the ground, the ground split and burning at its foot
    case 'pillar': {
      const H = R * 2.8 + 28;
      fx.put({ kind: FX.crack, x, y, flat: true, w: R * 2.4, a, b, t: u, seed });
      fx.put({ kind: FX.glow, x, y, flat: true, w: R * 4.6, a, alpha: 0.75 * fade });
      shockRing(fx, x, y, R * (0.5 + 0.9 * (1 - fade * fade)), 3 + 9 * fade, b, fade, seed);
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * TAU + seed * 2;
        const lick = Math.sin(Math.min(1, u * 2.5) * Math.PI * 0.5) * fade;
        fx.put({ kind: FX.flame, x: x + Math.cos(ang) * R * 0.78, y: y + Math.sin(ang) * R * 0.78, base: true, w: 18, h: 16 + 30 * lick, a, b, seed: seed + i * 1.3, alpha: lick });
      }
      fx.put({ kind: FX.column, x, y, base: true, w: R * 1.9, h: H, a, b, t: u, seed });
      fx.put({ kind: FX.column, x, y, base: true, w: R * 0.7, h: H * 0.9, a: '#ff8a2a', b, t: Math.min(1, u * 1.15), seed: seed + 3.7, alpha: 0.6 });
      // tongues of flame breaking off its sides as it burns
      for (let i = 0; i < 4; i++) {
        const ph = (u * 2.2 + i * 0.27) % 1;
        const side = i % 2 ? 1 : -1;
        const tall = Math.max(0, 1 - Math.max(0, u - 0.45) * 1.8);
        fx.put({ kind: FX.flame, x: x + side * R * (0.45 + ph * 0.2), y, up: H * (0.15 + ph * 0.6) * tall, base: true, w: 22, h: 34 * (1 - ph), rot: side * -0.35, a, b, seed: seed + i * 2.1, alpha: (1 - ph) * tall });
      }
      fx.put({ kind: FX.glow, x, y, up: H * 0.4, w: R * 5, a, alpha: 0.55 * fade });
      fx.put({ kind: FX.rain, x, y, base: true, w: R * 1.6, h: H, a: b, t: u, seed, p1: 1 });
      if (u > 0.35) fx.put({ kind: FX.smoke, x, y, up: H * 0.8 + u * 26, w: R * (1.8 + u), a: '#3a3036', alpha: 0.5, t: (u - 0.35) / 0.65, seed });
      break;
    }
    // Meteor, falling: a burning rock out of the sky, its long tail behind it, its shadow closing on the spot
    case 'meteorfall': {
      const f = fallen(x, u, 80, 170);
      fx.put({ kind: FX.mark, x, y, flat: true, w: R * (0.5 + 1.1 * f.k), a: '#000000', alpha: 0.4 + 0.5 * f.k });
      fx.put({ kind: FX.glow, x, y, flat: true, w: R * 3.2, a, alpha: 0.5 * f.k });
      for (let i = 1; i <= 3; i++) {
        const s = fallen(x, Math.max(0, u - i * 0.07), 80, 170);
        fx.put({ kind: FX.smoke, x: s.x, y, up: s.up + 4, w: 22 + i * 9, a: '#4a3a38', alpha: 0.42 * (1 - i * 0.22), t: 0.2 + i * 0.2, seed: seed + i });
      }
      fx.put({ kind: FX.glow, x: f.x, y, up: f.up, w: 92, a, alpha: 0.85 });
      fx.put({ kind: FX.flame, x: f.x, y, up: f.up, base: true, w: 44, h: 104, rot: f.rot + Math.PI / 2, a, b, seed });
      fx.put({ kind: FX.ball, x: f.x, y, up: f.up, w: 32, a: '#3a2620', b: '#ff8a3a' });
      fx.put({ kind: FX.glow, x: f.x, y, up: f.up, w: 30, a: b, alpha: 0.6 });
      break;
    }
    // Meteor, landed: a blast, the ground cratered and cracked with fire, rubble thrown out and a column of smoke
    case 'crater': {
      fx.put({ kind: FX.crack, x, y, flat: true, w: R * 2.7, a, b, t: u, seed });
      fx.put({ kind: FX.glow, x, y, flat: true, w: R * 4.4, a, alpha: 0.8 * fade * fade });
      shockRing(fx, x, y, R * (0.35 + 1.15 * (1 - fade * fade)), 4 + 12 * fade, b, fade, seed);
      fx.put({ kind: FX.blast, x, y, up: R * 0.45, w: R * 3.3, a, b, t: Math.min(1, u * 1.5), seed });
      fx.put({ kind: FX.impact, x, y, up: 14, w: R * 3.2, a, b, t: Math.min(1, u * 2.2), seed });
      rubble(fx, x, y, R, u, 8, seed, '#4a3a30', '#6a5040');
      if (u > 0.12) for (let i = 0; i < 2; i++) fx.put({ kind: FX.smoke, x: x + (i ? 7 : -7), y, up: R * 0.6 + u * 46 + i * 16, w: R * (1.3 + u * 1.3), a: i ? '#3a3034' : '#4a3e3c', alpha: 0.62, t: u, seed: seed + i * 2.3 });
      break;
    }
    // a comet of ice (Absolute Zero): a long crystal falling, a cold trail of mist and glitter behind it
    case 'cometfall': {
      const f = fallen(x, u, 80, 170);
      const len = 110;
      const ux = 80 / Math.hypot(80, 170);
      const uu = 170 / Math.hypot(80, 170);
      fx.put({ kind: FX.mark, x, y, flat: true, w: R * (0.5 + 1.1 * f.k), a: '#9be7ff', alpha: 0.35 + 0.4 * f.k });
      fx.put({ kind: FX.field, x, y, flat: true, w: R * 2 * f.k, a, b, t: 0.25 * f.k, seed, p1: FIELD.frost });
      fx.put({ kind: FX.trail, x: f.x - (ux * len) / 2, y, up: f.up + (uu * len) / 2, w: len * (Math.hypot(80, 170 * COS_P) / Math.hypot(80, 170)), h: 26, rot: f.rot, a, b, seed });
      fx.put({ kind: FX.glow, x: f.x, y, up: f.up, w: 80, a, alpha: 0.8 });
      fx.put({ kind: FX.frost, x: f.x, y, up: f.up, w: 58, h: 22, rot: f.rot, a, b, seed });
      fx.put({ kind: FX.rain, x: f.x, y, up: f.up - 20, base: true, w: 40, h: 60, a: b, t: -1, seed, p1: 1 });
      break;
    }
    // the comet landed: the ground frozen over and cracked, shards of ice thrown out, a cold mist rolling off it
    case 'rimecrater': {
      fx.put({ kind: FX.field, x, y, flat: true, w: R * 2.4, a, b, t: 0.34 * fade + 0.1, seed, p1: FIELD.frost });
      fx.put({ kind: FX.crack, x, y, flat: true, w: R * 2.6, a, b: '#ffffff', t: u, seed });
      shockRing(fx, x, y, R * (0.35 + 1.15 * (1 - fade * fade)), 4 + 10 * fade, b, fade, seed);
      fx.put({ kind: FX.impact, x, y, up: 14, w: R * 3.2, a, b, t: Math.min(1, u * 2.2), seed });
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * TAU + seed;
        const out = R * 1.2 * (1 - (1 - Math.min(1, u * 1.4)) ** 2);
        fx.put({ kind: FX.frost, x: x + Math.cos(ang) * out, y: y + Math.sin(ang) * out, up: 8 + Math.sin(Math.min(1, u * 1.4) * Math.PI) * 18, w: 14, h: 6, rot: ang + u * 5, a, b, alpha: clamp(1.5 - u * 1.5, 0, 1), seed: seed + i });
      }
      dust(fx, x, y, R, u, 4, seed, '#d8f2ff', 0.45 * fade);
      break;
    }
    // the Brimstone Golem called: a burning sigil opens on the ground, and a lump of smoking brimstone comes down on it
    case 'golemfall': {
      const f = fallen(x, u, 60, 180);
      fx.put({ kind: FX.glow, x, y, flat: true, w: R * 3.4, a, alpha: 0.25 + 0.5 * f.k });
      fx.put({ kind: FX.rune, x, y, flat: true, w: R * 2.5, a: '#a050e0', b, t: 0.4 + 0.15 * u, seed });
      fx.put({ kind: FX.rune, x, y, flat: true, w: R * 1.6, a, b: '#ffd0a0', t: 0.45, seed: seed + 0.5 });
      fx.put({ kind: FX.mark, x, y, flat: true, w: R * (0.5 + 1.0 * f.k), a: '#000000', alpha: 0.45 + 0.4 * f.k });
      for (let i = 1; i <= 3; i++) {
        const s = fallen(x, Math.max(0, u - i * 0.07), 60, 180);
        fx.put({ kind: FX.smoke, x: s.x, y, up: s.up + 6, w: 26 + i * 11, a: '#24181c', alpha: 0.6 * (1 - i * 0.2), t: 0.2 + i * 0.2, seed: seed + i });
      }
      fx.put({ kind: FX.glow, x: f.x, y, up: f.up, w: 96, a: '#a050e0', alpha: 0.6 });
      fx.put({ kind: FX.flame, x: f.x, y, up: f.up, base: true, w: 52, h: 110, rot: f.rot + Math.PI / 2, a, b, seed });
      fx.put({ kind: FX.ball, x: f.x, y, up: f.up, w: 40, a: '#2a1c1e', b: '#ff5a2a' });
      fx.put({ kind: FX.flame, x: f.x, y, up: f.up - 10, base: true, w: 34, h: 40, a: '#7a2ad0', b: '#ff7a3a', seed: seed + 2, alpha: 0.85 });
      break;
    }
    // ...and lands: the ground split with brimstone fire, a dark blast, the sigil flaring, rubble and black smoke
    case 'golemland': {
      fx.put({ kind: FX.crack, x, y, flat: true, w: R * 2.8, a, b, t: u, seed });
      fx.put({ kind: FX.rune, x, y, flat: true, w: R * (2.5 + u * 0.8), a: '#a050e0', b: '#ffd0a0', t: 0.45 + 0.55 * u, seed });
      shockRing(fx, x, y, R * (0.35 + 1.2 * (1 - fade * fade)), 4 + 12 * fade, '#ff6a2a', fade, seed);
      fx.put({ kind: FX.blast, x, y, up: R * 0.45, w: R * 3.2, a, b, t: Math.min(1, u * 1.5), seed });
      fx.put({ kind: FX.impact, x, y, up: 14, w: R * 3.2, a: '#a050e0', b, t: Math.min(1, u * 2.2), seed });
      rubble(fx, x, y, R, u, 8, seed, '#2a1c1e', '#4a2a24');
      if (u > 0.12) for (let i = 0; i < 2; i++) fx.put({ kind: FX.smoke, x: x + (i ? 8 : -8), y, up: R * 0.6 + u * 40 + i * 16, w: R * (1.3 + u * 1.3), a: '#1e1418', alpha: 0.7, t: u, seed: seed + i * 2.3 });
      break;
    }
    // something else from the sky: a shaft of its light and a burst where it lands
    case 'skyfall':
      fx.put({ kind: FX.shaft, x, y, base: true, w: R * 1.4, h: 190, a, t: u, seed });
      fx.put({ kind: FX.blast, x, y, up: R * 0.4, w: R * 2.8, a, b, t: u, seed });
      shockRing(fx, x, y, R * (0.4 + (1 - fade * fade)), 3 + 9 * fade, b, fade, seed);
      break;
    // Tempest: a storm cloud gathered over the spot, lightning crawling over the ground under it
    case 'stormcloud': {
      const on = Math.min(1, u * 6, (1 - u) * 5);
      fx.put({ kind: FX.field, x, y, flat: true, w: R * 2, a, b, t: on * 0.34, seed, p1: FIELD.lightning });
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * TAU + seed;
        const r = i === 0 ? 0 : R * 0.7;
        fx.put({ kind: FX.smoke, x: x + Math.cos(ang) * r, y: y + Math.sin(ang) * r * 0.6, up: 120 + (i % 2) * 10, w: R * 1.6, a: i % 2 ? '#2a3448' : '#384258', alpha: 0.75 * on, t: 0.3, seed: seed + i * 2.1 });
      }
      fx.put({ kind: FX.glow, x, y, up: 118, w: R * 3, a, alpha: on * (0.25 + 0.25 * Math.max(0, Math.sin(u * 47 + seed))) });
      break;
    }
    // Fireball, landed: a churning ball of fire, tongues of flame thrown out and a ring along the ground
    case 'fireburst': {
      fx.put({ kind: FX.glow, x, y, flat: true, w: R * 4, a, alpha: 0.7 * fade });
      shockRing(fx, x, y, R * (0.3 + 1.0 * (1 - fade * fade)), 3 + 7 * fade, b, fade, seed);
      fx.put({ kind: FX.blast, x, y, up: 12, w: R * 3, a, b, t: Math.min(1, u * 1.2), seed });
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * TAU + seed;
        const out = R * (0.3 + 0.8 * Math.min(1, u * 2));
        fx.put({ kind: FX.flame, x: x + Math.cos(ang) * out, y: y + Math.sin(ang) * out * 0.7, base: true, w: 16, h: 24 * fade, a, b, seed: seed + i, alpha: fade });
      }
      if (u > 0.25) fx.put({ kind: FX.smoke, x, y, up: 14 + u * 24, w: R * (1.4 + u), a: '#3a3036', alpha: 0.5, t: u, seed });
      break;
    }
    // Ruin Bolt, landed: chaos fire tearing itself apart, cracking with arcs, a hole of dark at its heart
    case 'ruin': {
      fx.put({ kind: FX.glow, x, y, flat: true, w: R * 4, a, alpha: 0.7 * fade });
      shockRing(fx, x, y, R * (0.3 + 1.1 * (1 - fade * fade)), 3 + 8 * fade, b, fade, seed);
      fx.put({ kind: FX.blast, x, y, up: 12, w: R * 3.2, a, b, t: Math.min(1, u * 1.3), seed });
      fx.put({ kind: FX.shadow, x, y, up: 12, w: R * 2.2 * (1 - u), a: '#c0306a', b: '#ffb070', seed });
      for (let i = 0; i < 3; i++) fx.put({ kind: FX.bolt, x, y, up: 12, w: R * 3, h: 18, rot: seed * 3 + (i * TAU) / 3 + u * 2, a: b, seed: seed + i + Math.floor(u * 10), alpha: clamp(1.2 - u * 1.4, 0, 1) });
      break;
    }
    // Searing Hymn, landed: a burst of holy flame going up off them, rays turning
    case 'hymn':
      fx.put({ kind: FX.glow, x, y, flat: true, w: R * 3.4, a, alpha: 0.6 * fade });
      fx.put({ kind: FX.column, x, y, base: true, w: R * 1.2, h: R * 3.6 + 30, a, b, t: u, seed });
      fx.put({ kind: FX.holy, x, y, up: 14, w: R * 3.4, a, b, seed, alpha: fade });
      fx.put({ kind: FX.ring, x, y, flat: true, w: R * 2.6, a: b, t: u, seed });
      break;
    // Starbreak, landed: a star bursting, its points flung wide, motes of it scattering
    case 'starburst': {
      const k = Math.min(1, u * 2.2);
      fx.put({ kind: FX.glow, x, y, flat: true, w: R * 3.6, a, alpha: 0.6 * fade });
      fx.put({ kind: FX.spark, x, y, up: 14, w: R * (2.2 + 2.4 * k), a, t: u });
      fx.put({ kind: FX.spark, x, y, up: 14, w: R * (1.4 + 1.6 * k), rot: Math.PI / 4, a: b, t: u });
      fx.put({ kind: FX.ring, x, y, flat: true, w: R * 2.6, a, t: u, seed });
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + seed;
        const out = R * 1.3 * k;
        fx.put({ kind: FX.spark, x: x + Math.cos(ang) * out, y: y + Math.sin(ang) * out * 0.7, up: 12 + Math.sin(k * Math.PI) * 10, w: 9, a: i % 2 ? b : a, t: u });
      }
      break;
    }
    // Starflame, landed: a little sun going off, its rays turning
    case 'solar':
      fx.put({ kind: FX.glow, x, y, flat: true, w: R * 3.6, a, alpha: 0.7 * fade });
      shockRing(fx, x, y, R * (0.3 + (1 - fade * fade)), 3 + 7 * fade, b, fade, seed);
      fx.put({ kind: FX.blast, x, y, up: 12, w: R * 2.8, a, b, t: Math.min(1, u * 1.3), seed });
      fx.put({ kind: FX.holy, x, y, up: 14, w: R * 3.4, a, b, seed: seed + u * 2, alpha: fade });
      break;
    // a crushing blow: the ground cracked under it, a flash, dust thrown up and a ring of force
    case 'crush':
      fx.put({ kind: FX.crack, x, y, flat: true, w: R * 2, a, b, t: Math.min(1, u * 1.2), seed });
      shockRing(fx, x, y, R * (0.25 + 0.85 * (1 - fade * fade)), 3 + 7 * fade, b, fade, seed);
      fx.put({ kind: FX.impact, x, y, up: 10, w: R * 2.6, a, b, t: Math.min(1, u * 1.8), seed });
      dust(fx, x, y, R, u, 4, seed, '#8a7a66', 0.45 * fade);
      rubble(fx, x, y, R * 0.8, u, 5, seed, '#6a5a4a', '#8a7a64');
      break;
    // a wound torn open: a dark red gash, blood flung, a red ring
    case 'rend': {
      const g = Math.min(1, u * 3);
      fx.put({ kind: FX.trail, x, y, up: 10, flat: true, w: R * 1.8 * g, h: 9 * fade + 2, rot: angle + Math.PI / 2 + 0.5, a, b, seed, alpha: fade });
      fx.put({ kind: FX.impact, x, y, up: 10, w: R * 2.3, a, b, t: Math.min(1, u * 1.8), seed });
      fx.put({ kind: FX.ring, x, y, flat: true, w: R * 2.2, a, t: u, seed });
      for (let i = 0; i < 7; i++) {
        const ang = angle + (i / 6 - 0.5) * 1.8;
        const out = R * (0.2 + 1.0 * Math.min(1, u * 1.6));
        fx.put({ kind: FX.chip, x: x + Math.cos(ang) * out, y: y + Math.sin(ang) * out * 0.8, up: 8 + Math.sin(Math.min(1, u * 1.6) * Math.PI) * 12, w: 3.5 + (i % 2) * 1.5, rot: ang, a: i % 3 ? a : '#5a0a14', alpha: clamp(1.5 - u * 1.6, 0, 1) });
      }
      break;
    }
    // a verdict of light: two blades of it crossed where the blow landed, a flare, and a shaft of light coming down
    case 'verdict': {
      const g = Math.min(1, u * 3.5);
      for (let i = -1; i <= 1; i += 2) fx.put({ kind: FX.beam, x, y, up: 10, flat: true, w: R * 2 * g, h: 7 * fade + 2, rot: angle + (i * Math.PI) / 4, a, b, seed: seed + i, alpha: fade });
      fx.put({ kind: FX.shaft, x, y, base: true, w: R * 1.1, h: 120, a, t: u, seed });
      fx.put({ kind: FX.holy, x, y, up: 14, w: R * 3.2, a, b, seed, alpha: fade });
      fx.put({ kind: FX.impact, x, y, up: 12, w: R * 2.6, a, b, t: Math.min(1, u * 1.8), seed });
      shockRing(fx, x, y, R * (0.25 + 0.85 * (1 - fade * fade)), 3 + 6 * fade, b, fade, seed);
      break;
    }
    // a shield driven into them: a flash of its face and a ring of light
    case 'bastion':
      fx.put({ kind: FX.bubble, x, y, up: 14, w: R * 1.8 * (0.6 + 0.4 * Math.min(1, u * 3)), a, t: u, seed });
      fx.put({ kind: FX.impact, x, y, up: 12, w: R * 2.4, a, b, t: Math.min(1, u * 1.8), seed });
      shockRing(fx, x, y, R * (0.25 + 0.8 * (1 - fade * fade)), 3 + 6 * fade, b, fade, seed);
      break;
    // jaws: two curved rows of teeth snapping shut on them, blood flung
    case 'bite': {
      const d = R * 0.5;
      for (let i = -1; i <= 1; i += 2) {
        const n = angle + (i * Math.PI) / 2;
        fx.put({ kind: FX.slash, x: x + Math.cos(n) * d, y: y + Math.sin(n) * d, up: 11, flat: true, w: (d * 2) / 0.82, rot: n + Math.PI, a, b, t: Math.min(0.99, u * 1.4), p1: 2.4, p2: 1 });
      }
      fx.put({ kind: FX.impact, x, y, up: 10, w: R * 2, a, b, t: Math.min(1, u * 1.8), seed });
      for (let i = 0; i < 6; i++) {
        const ang = angle + (i / 5 - 0.5) * 2.2;
        const out = R * (0.2 + 0.9 * Math.min(1, u * 1.6));
        fx.put({ kind: FX.chip, x: x + Math.cos(ang) * out, y: y + Math.sin(ang) * out * 0.8, up: 8 + Math.sin(Math.min(1, u * 1.6) * Math.PI) * 12, w: 3.5, rot: ang, a: i % 2 ? '#c8202a' : '#7a0a14', alpha: clamp(1.5 - u * 1.6, 0, 1) });
      }
      break;
    }
    // a blow of shadow: the dark bursting out of the wound, wisps of it rising, a ring of pale violet
    case 'umbral':
      fx.put({ kind: FX.glow, x, y, flat: true, w: R * 3, a, alpha: 0.5 * fade });
      fx.put({ kind: FX.impact, x, y, up: 12, w: R * 2.6, a, b, t: Math.min(1, u * 1.8), seed });
      fx.put({ kind: FX.shadow, x, y, up: 13, w: R * (1.4 + 1.4 * Math.min(1, u * 2)), a, b, seed, alpha: clamp(1.4 - u * 1.4, 0, 1) });
      shockRing(fx, x, y, R * (0.25 + 0.85 * (1 - fade * fade)), 3 + 7 * fade, a, fade, seed);
      fx.put({ kind: FX.rain, x, y, base: true, w: R * 1.8, h: 56, a, t: u, seed, p1: 1 });
      break;
    // the ground sundered by shadow: a fissure of violet light, dark rising out of it
    case 'sunder':
      fx.put({ kind: FX.crack, x, y, flat: true, w: R * 2.6, a, b, t: u, seed });
      shockRing(fx, x, y, R * (0.3 + 1.0 * (1 - fade * fade)), 4 + 9 * fade, b, fade, seed);
      fx.put({ kind: FX.shadow, x, y, up: 12, w: R * (1.4 + 1.4 * Math.min(1, u * 2)), a, b, seed, alpha: fade });
      fx.put({ kind: FX.column, x, y, base: true, w: R * 1.2, h: R * 2.6 + 20, a, b, t: Math.min(1, u * 1.1), seed });
      fx.put({ kind: FX.impact, x, y, up: 12, w: R * 2.8, a: b, b: '#ffffff', t: Math.min(1, u * 1.8), seed });
      dust(fx, x, y, R, u, 4, seed, '#2a2236', 0.6 * fade);
      break;
    // Halo: a ring of light going out from the priest at the height of a heart, burning gold, sparks riding it
    case 'halo': {
      const e = 1 - fade * fade;
      const r = R * (0.15 + 0.9 * e);
      fx.put({ kind: FX.shaft, x, y, base: true, w: 44, h: 150, a, t: u, seed });
      fx.put({ kind: FX.holy, x, y, up: 18, w: 90 * fade + 30, a, b, seed, alpha: fade });
      shockRing(fx, x, y, r, 6 + 10 * fade, a, fade, seed, 14);
      shockRing(fx, x, y, r * 0.96, 3 + 4 * fade, b, fade * 0.8, seed + 1);
      shockRing(fx, x, y, r * 1.02, 8 + 14 * fade, a, fade * 0.45, seed + 2);
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * TAU + seed + u * 1.5;
        fx.put({ kind: FX.spark, x: x + Math.cos(ang) * r, y: y + Math.sin(ang) * r, up: 15, w: 12, a: i % 2 ? b : a, t: u * 0.8 });
      }
      break;
    }
    // a dark halo: the light drawn into a hole of black, then a ring of pale shadow thrown out, wisps going up
    case 'eclipse': {
      const pull = Math.min(1, u * 3.5);
      const e = Math.max(0, (u - 0.18) / 0.82);
      fx.put({ kind: FX.shadow, x, y, flat: true, w: R * 1.3 * (1 - pull * 0.6) + R * 0.6 * e, a, b, seed, alpha: clamp(1.3 - u * 1.3, 0, 1) });
      fx.put({ kind: FX.glow, x, y, flat: true, w: R * 3, a, alpha: 0.4 * fade });
      if (e > 0) {
        const r = R * (0.2 + 0.85 * (1 - (1 - e) * (1 - e)));
        shockRing(fx, x, y, r, 5 + 12 * (1 - e), b, 1 - e, seed, 2);
        shockRing(fx, x, y, r * 0.9, 3 + 5 * (1 - e), a, (1 - e) * 0.8, seed + 1, 12);
      }
      fx.put({ kind: FX.shadow, x, y, up: 46, w: 40 * (1 - u * 0.5), a, b, seed: seed + 1, alpha: fade });
      fx.put({ kind: FX.glow, x, y, up: 46, w: 90, a: b, alpha: 0.45 * fade, behind: true });
      fx.put({ kind: FX.rain, x, y, base: true, w: R * 1.8, h: 70, a: b, t: u, seed, p1: 1 });
      break;
    }
    // Duskfall: the eclipse, and the ground under it splitting with the dark coming up out of it round the knight
    case 'nightfall':
      fx.put({ kind: FX.crack, x, y, flat: true, w: R * 1.9, a, b, t: u, seed });
      bigSpell(fx, 'eclipse', tone, x, y, u, size, seed, angle);
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * TAU + seed;
        const out = R * (0.3 + 0.55 * Math.min(1, u * 1.6));
        fx.put({ kind: FX.column, x: x + Math.cos(ang) * out, y: y + Math.sin(ang) * out * 0.8, base: true, w: 26, h: 70, a, b, t: Math.min(1, u * 1.2 + i * 0.03), seed: seed + i * 1.7 });
      }
      break;
    // Dawn's Fury: a pillar of gold standing up over the paladin, sun rays thrown across the ground, a ring of light
    case 'dawn': {
      const e = 1 - fade * fade;
      fx.put({ kind: FX.holy, x, y, flat: true, w: R * 3.2 * (0.5 + 0.5 * e), a, b, seed, alpha: fade });
      shockRing(fx, x, y, R * (0.2 + 0.85 * e), 5 + 10 * fade, b, fade, seed);
      fx.put({ kind: FX.column, x, y, base: true, w: 46, h: 190, a, b, t: u, seed });
      fx.put({ kind: FX.shaft, x, y, base: true, w: 70, h: 200, a: b, t: u, seed });
      fx.put({ kind: FX.glow, x, y, up: 40, w: 150, a, alpha: 0.5 * fade });
      fx.put({ kind: FX.rain, x, y, base: true, w: R * 1.6, h: 90, a: b, t: u, seed, p1: 1 });
      break;
    }
    // Radiant Sweep: blades of light turning all the way round
    case 'sweep':
      for (let i = 0; i < 2; i++) fx.put({ kind: FX.slash, x, y, up: 11, flat: true, w: (R * 2) / 0.82, rot: seed + i * Math.PI + u * 5, a, b, t: Math.min(0.99, u * 1.1), p1: 3.6, p2: 1 });
      fx.put({ kind: FX.holy, x, y, up: 14, w: 60, a, b, seed, alpha: fade });
      shockRing(fx, x, y, R * (0.3 + 0.75 * (1 - fade * fade)), 3 + 6 * fade, b, fade, seed);
      break;
    // a stamp that cracks the ground: dust and a ring of force thrown out (lightning crawling over it for a thunderclap)
    case 'stomp':
    case 'thunderstomp': {
      fx.put({ kind: FX.crack, x, y, flat: true, w: R * 1.6, a, b, t: u, seed });
      shockRing(fx, x, y, R * (0.2 + 0.85 * (1 - fade * fade)), 4 + 9 * fade, b, fade, seed);
      dust(fx, x, y, R, u, 6, seed, '#8a7a66', 0.38 * fade);
      if (name === 'thunderstomp') {
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * TAU + seed;
          const r = R * 0.5 * (0.5 + 0.5 * Math.min(1, u * 3));
          fx.put({ kind: FX.bolt, x: x + Math.cos(ang) * r, y: y + Math.sin(ang) * r, up: 4, flat: true, w: R, h: 16, rot: ang, a, seed: seed + i + Math.floor(u * 12), alpha: clamp(1.3 - u * 1.5, 0, 1) });
        }
      }
      break;
    }
    // a bell tolled in the dark: rings of shadow going out one after another
    case 'toll':
      for (let i = 0; i < 3; i++) {
        const k = u * 1.5 - i * 0.25;
        if (k <= 0 || k >= 1) continue;
        shockRing(fx, x, y, R * (0.15 + 0.9 * k), 3 + 6 * (1 - k), i % 2 ? b : a, 1 - k, seed + i, 2);
      }
      fx.put({ kind: FX.shadow, x, y, up: 16, w: 36 * fade, a, b, seed, alpha: fade });
      break;
    // Smite: a narrow lance of light falling on them out of the sky
    case 'smite':
      fx.put({ kind: FX.shaft, x, y, base: true, w: 18, h: 130, a, t: Math.min(1, u * 1.4), seed });
      fx.put({ kind: FX.impact, x, y, up: 10, w: R * 2.4, a, b, t: u, seed });
      fx.put({ kind: FX.ring, x, y, flat: true, w: R * 2, a: b, t: u, seed });
      break;
    // Thought Lash: the mind crushed: shadow drawn into them and bursting out again
    case 'psyblast':
      fx.put({ kind: FX.gather, x, y, up: 14, w: R * 3 * fade, a, b, t: 1 - u, seed });
      fx.put({ kind: FX.shadow, x, y, up: 14, w: R * 1.8 * (1 - Math.min(1, u * 2)) + 4, a, b, seed });
      fx.put({ kind: FX.impact, x, y, up: 14, w: R * 2.8, a: b, b: '#ffffff', t: u, seed });
      shockRing(fx, x, y, R * (0.3 + 0.8 * (1 - fade * fade)), 3 + 5 * fade, a, fade, seed, 12);
      break;
    // Moonburn: a beam of moonlight on them, a pale ring at their feet
    case 'moonbeam':
      fx.put({ kind: FX.shaft, x, y, base: true, w: 26, h: 160, a, t: u, seed });
      fx.put({ kind: FX.glow, x, y, flat: true, w: R * 3, a: b, alpha: 0.7 * fade });
      fx.put({ kind: FX.rune, x, y, flat: true, w: R * 2, a, b, t: 0.3 + 0.6 * u, seed });
      break;
    // Harvest: a reaping stroke of shadow across them
    case 'reap':
      fx.put({ kind: FX.slash, x, y, up: 16, w: (R * 2.4) / 0.82, rot: -0.6, a, b, t: Math.min(0.99, u * 1.2), p1: 2.6, p2: 1 });
      fx.put({ kind: FX.impact, x, y, up: 14, w: R * 2.4, a, b, t: u, seed });
      fx.put({ kind: FX.rain, x, y, base: true, w: R * 1.4, h: 46, a: b, t: u, seed, p1: 1 });
      break;
    default:
      break;
  }
}

/**
 * The air round a Sigil-warden. `from` and `rise`: how high their motes start and how far they go (below zero they
 * fall). Small on purpose: the armor is what's looked at.
 */
type Aura = { a: string; b: string; n: number; speed: number; spin: number; from: number; rise: number; size: number; halo?: { up: number; w: number; alpha: number } };

/** The shop's armor sets, the same way (their colors are the set's own or an admin's: its glow, then its trim). */
/**
 * What hangs in the air round a boss (render/effects.ts bossPresence): `kind` of particle, `n` of them (more each
 * phase), how fast they go round (`speed`, `spin`), from how high (`from`) and how far they rise or fall (`rise`), how
 * big (`size`), and its two colors (`a` the sigil and halo, `b` the light it turns and falls in).
 */
interface BossAura {
  kind: 'spark' | 'smoke' | 'rain' | 'bubble';
  n: number;
  speed: number;
  spin: number;
  from: number;
  rise: number;
  size: number;
  a: string;
  b: string;
}
const EMBERS = (a: string, b: string): BossAura => ({ kind: 'spark', n: 10, speed: 0.45, spin: 0.2, from: 8, rise: 46, size: 7, a, b });
const MOTES = (a: string, b: string): BossAura => ({ kind: 'spark', n: 9, speed: 0.2, spin: 0.6, from: 6, rise: 40, size: 8, a, b });
const FALLING = (a: string, b: string): BossAura => ({ kind: 'spark', n: 9, speed: 0.25, spin: 0.15, from: 10, rise: -48, size: 6, a, b });
const GLOOM = (a: string, b: string): BossAura => ({ kind: 'smoke', n: 6, speed: 0.3, spin: 0.25, from: 4, rise: 30, size: 16, a, b });
const BUBBLES = (a: string, b: string): BossAura => ({ kind: 'bubble', n: 7, speed: 0.35, spin: 0.3, from: 2, rise: 44, size: 6, a, b });
/** By the land a boss is fought in. */
const THEME_AURA: Record<string, BossAura> = {
  crypt: MOTES('#7af0c8', '#d8fff0'),
  cave: MOTES('#d8c8a0', '#fff2d0'),
  cistern: { kind: 'rain', n: 1, speed: 0.3, spin: 0, from: 0, rise: 0, size: 0, a: '#9ad84a', b: '#e0ff9a' },
  keep: EMBERS('#ff8a3a', '#ffd27a'),
  icecave: FALLING('#bfe8ff', '#ffffff'),
  lavacave: EMBERS('#ff5a1e', '#ffc23a'),
  riftspire: MOTES('#b07aff', '#f0d8ff'),
  roots: MOTES('#a8d84a', '#f0ffb0'),
  forest: MOTES('#a8d84a', '#f0ffb0'),
  temple: MOTES('#ffd27a', '#fff6d0'),
  citadel: FALLING('#d8e8ff', '#ffffff'),
  village: EMBERS('#ff8a3a', '#ffd27a'),
};
/** A boss with an air of its own. */
const BOSS_AURA: Record<string, BossAura> = {
  'coffin-matron': MOTES('#9cff9c', '#e0ffe0'),
  ossric: EMBERS('#ffd88a', '#fff2c0'),
  morgrave: MOTES('#ff3fd2', '#ffd0f6'),
  hangman: GLOOM('#4a3a3a', '#c9b89a'),
  gnasher: EMBERS('#ff4a2a', '#ffb070'),
  varric: EMBERS('#ffb04d', '#ffe8b0'),
  'the-drowned': BUBBLES('#7ad8ff', '#d8f6ff'),
  clatterclaw: BUBBLES('#87cfc4', '#e0fff8'),
  saltbeard: MOTES('#e0d0f0', '#ffffff'),
  'brother-pustule': { kind: 'rain', n: 1, speed: 0.3, spin: 0, from: 0, rise: 0, size: 0, a: '#b8d84a', b: '#f0ffb0' },
  'old-sluicegut': GLOOM('#5a7a3a', '#c8e0a0'),
  'the-rot-mother': { kind: 'rain', n: 1, speed: 0.3, spin: 0, from: 0, rise: 0, size: 0, a: '#a8d04a', b: '#e8ff9a' },
  'slag-colossus': EMBERS('#ff5a1e', '#ffc23a'),
  'the-runewarden': MOTES('#ffd27a', '#fff2c0'),
  'forgemaster-grold': EMBERS('#ff7a2a', '#ffe08a'),
  'king-hrodric': FALLING('#bfe8ff', '#ffffff'),
  gloomwing: GLOOM('#2a1e3a', '#b8a8ff'),
  'sir-corvane': FALLING('#a8c8ff', '#e8f0ff'),
  grimtusk: MOTES('#c86aff', '#f0d0ff'),
  'the-sand-warden': FALLING('#e8cf95', '#fff2d0'),
  'the-sun-king': EMBERS('#ffd27a', '#fffbe0'),
  'vizier-khepset': FALLING('#ffd27a', '#fff6d0'),
  'jarl-hrimfang': FALLING('#bfe8ff', '#ffffff'),
  'hallvor-the-unthawed': MOTES('#9ad8ff', '#ffffff'),
  'the-rime-wyrm': FALLING('#a9dcff', '#ffffff'),
  'the-siege-breaker': EMBERS('#ff8a3a', '#ffd27a'),
  'prior-vessant': GLOOM('#2a3a2a', '#9cff9c'),
  'general-morvain': MOTES('#ffd27a', '#ffffff'),
  'rotwood-colossus': MOTES('#a8d84a', '#f0ffb0'),
  'elowen-of-the-dawn': MOTES('#ffe08a', '#ffffff'),
  'the-withered-queen': GLOOM('#4a6a2a', '#d8f0a0'),
  'magma-warden': EMBERS('#ff5a1e', '#ffc23a'),
  'ossa-the-founder': EMBERS('#ffb060', '#fff2d0'),
  'ashkar-the-bound': EMBERS('#ff3a1a', '#ffe08a'),
  'veil-sentinel': MOTES('#a48bdc', '#f0e0ff'),
  'ilvane-the-unmoored': MOTES('#c8b8ff', '#ffffff'),
  'herald-in-the-spire': MOTES('#d8d0f0', '#ffffff'),
  'lady-cendre': GLOOM('#2a2430', '#c08aff'),
  'hollow-guard': GLOOM('#3a3448', '#c8c0e0'),
  // the Hallow King: rime falling round him in a slow crown, grieflight in it
  vaelor: { kind: 'spark', n: 14, speed: 0.22, spin: 0.35, from: 14, rise: -56, size: 7, a: '#c8a8ff', b: '#e8f6ff' },
  'silas-vey': GLOOM('#2a2430', '#e8d07a'),
  'the-royal-auditor': MOTES('#f0e0a0', '#ffffff'),
  'maelis-crane': MOTES('#ffd98a', '#ffffff'),
};

const SHOP_GLOW: Record<string, Omit<Aura, 'a' | 'b'>> = {
  crownforged: { n: 8, speed: 0.42, spin: 0, from: 6, rise: 32, size: 7, halo: { up: 18, w: 40, alpha: 0.14 } },
  celestine: { n: 9, speed: 0.2, spin: 0.6, from: 8, rise: -34, size: 7, halo: { up: 34, w: 42, alpha: 0.2 } },
  gloamquill: { n: 7, speed: 0.26, spin: -0.45, from: 4, rise: 20, size: 6 },
};

const WARDEN_GLOW: Record<ClassId, Aura> = {
  warrior: { a: '#ff6a4a', b: '#ffc06a', n: 7, speed: 0.4, spin: 0, from: 6, rise: 30, size: 7 },
  mage: { a: '#d8f0ff', b: '#ffffff', n: 8, speed: 0.22, spin: 0.7, from: 6, rise: -30, size: 7, halo: { up: 34, w: 36, alpha: 0.24 } },
  ranger: { a: '#7ad8c8', b: '#d8fff4', n: 7, speed: 0.3, spin: 0.4, from: 2, rise: 22, size: 6 },
  priest: { a: '#fff2c0', b: '#ffd24a', n: 8, speed: 0.26, spin: 0.3, from: 4, rise: 32, size: 7, halo: { up: 30, w: 46, alpha: 0.18 } },
  paladin: { a: '#ffb040', b: '#ffe08a', n: 9, speed: 0.42, spin: 0, from: 8, rise: 30, size: 7, halo: { up: 16, w: 44, alpha: 0.18 } },
  warlock: { a: '#a050e0', b: '#8bff6a', n: 8, speed: 0.34, spin: -0.5, from: 8, rise: 26, size: 8 },
  druid: { a: '#9ae06a', b: '#ffd0e8', n: 7, speed: 0.2, spin: 0.5, from: 6, rise: -30, size: 6 },
  gloamknight: { a: '#9a6ae0', b: '#ffb070', n: 8, speed: 0.24, spin: -0.3, from: 30, rise: -26, size: 7, halo: { up: 10, w: 40, alpha: 0.16 } },
};

/** A shot of an element flying: `tone` colors it, `el` says what it's made of. */
export function shot(fx: Fx3D, el: string, x: number, y: number, vx: number, vy: number, up: number, r: number, seed: number, tone: Tone): void {
  const { a, b } = tone;
  const speed = Math.hypot(vx, vy);
  const rot = screenAngle(vx, vy);
  const tail = (wide: number, seconds: number): void => {
    if (speed < 1) return;
    const len = speed * seconds;
    fx.put({ kind: FX.trail, x: x - (vx * seconds) / 2, y: y - (vy * seconds) / 2, up, w: len * shortened(vx, vy), h: wide, rot, a, b, seed });
  };
  switch (el) {
    case 'trail':
      tail(r * 3, 0.14);
      break;
    case 'fire':
      if (speed >= 1) fx.put({ kind: FX.flame, x, y, up, base: true, w: r * 5.2, h: r * 3.6 + Math.min(speed * 0.14, r * 7), rot: rot + Math.PI / 2, a, b, seed });
      fx.put({ kind: FX.orb, x, y, up, w: r * 4.8, a, b, seed });
      break;
    case 'ice':
    case 'frost':
      tail(r * 2, 0.14);
      fx.put({ kind: FX.frost, x, y, up, w: r * 6, h: r * 3, rot, a, b, seed });
      break;
    case 'lightning':
      fx.put({ kind: FX.bolt, x, y, up, w: r * 8, h: r * 5, rot: seed * 3, a, seed: seed + Math.floor(x * 0.2) });
      tail(r * 2, 0.14);
      fx.put({ kind: FX.orb, x, y, up, w: r * 4.4, a, b, seed });
      break;
    case 'poison':
      tail(r * 2.2, 0.16);
      fx.put({ kind: FX.poison, x, y, up, w: r * 5, a, b, seed });
      break;
    case 'shadow':
      tail(r * 2.8, 0.2);
      fx.put({ kind: FX.shadow, x, y, up, w: r * 5.2, a, b, seed });
      break;
    case 'holy':
      tail(r * 2.2, 0.16);
      fx.put({ kind: FX.holy, x, y, up, w: r * 6.5, a, b, seed });
      break;
    case 'water':
      tail(r * 2.6, 0.2);
      fx.put({ kind: FX.water, x, y, up, w: r * 5, rot, a, b, seed, p1: clamp(speed / 70, 0, 1) });
      break;
    default:
      tail(r * 2.4, 0.16);
      fx.put({ kind: FX.orb, x, y, up, w: r * 4.8, a, b, seed });
      break;
  }
}

export class Effects {
  /** The waves of a tide, drawn back to front. */
  private readonly tides: Projectile[] = [];

  /** Hands everything of a frame to the shaders (between the Fx3D's begin and end, and the cast's). */
  draw(w: World, sc: EffectsScene): void {
    this.ground(w, sc);
    this.fires(w, sc);
    this.marks(w, sc);
    this.shots(w, sc);
    this.throwing(w, sc);
    for (const f of w.fx) if (sc.near(f.x, f.y)) this.particle(f, sc);
    // a scene's own effects (a sigil waking, a wall going): render/effects' spells, by name
    for (const f of w.scene?.fx ?? []) spell(sc.fx, f.name, { a: f.color, b: '#ffffff' }, f.x, f.y, Math.min(1, f.t / 1.4), f.size, f.seed);
    for (const gh of w.coop?.ghosts ?? []) {
      for (const sh of gh.shots) {
        const d = dyeOf(sh.color);
        sc.fx.put({ kind: FX.orb, x: sh.x, y: sh.y, up: 12, w: Math.max(9, sh.r * 4.8), a: d.a, b: d.b, seed: sh.x * 0.1 });
      }
    }
    if (w.portal) {
      const { x, y } = w.portal;
      sc.fx.put({ kind: FX.glow, x, y, up: 22, w: 80, a: '#22e4ff', alpha: 0.5 });
      sc.fx.put({ kind: FX.rift, x, y, base: true, up: 2, w: 36, h: 50, a: '#ff3fd2', b: '#22e4ff', seed: 1 });
      sc.fx.put({ kind: FX.rain, x, y, base: true, w: 42, h: 58, a: '#9ff2ff', t: -1, seed: 2 });
    }
  }

  /* -------------------------------------------------------------- on the ground */

  private ground(w: World, sc: EffectsScene): void {
    const fx = sc.fx;
    const p = w.player;
    heroAt.x = p.x;
    heroAt.y = p.y;
    // (by how far each reaches: a boss's great circle, cone or ring whose middle was just off the picture wasn't drawn
    // at all, and the half of it that lay across the room came and went as the hero stepped. The owner: "some of the
    // red projected spells of the boss get cut off on the side")
    for (const f of w.fields) if (sc.near(f.x, f.y, f.r)) this.field(f, sc);
    for (const t of w.telegraphs) if (t.shape === 'line' || sc.near(t.x, t.y, Math.max(t.r, t.len))) this.telegraph(t, fx);
    for (const wv of w.waves) {
      const out = wv.r + wv.width;
      fx.put({ kind: FX.shock, x: wv.x, y: wv.y, flat: true, w: out * 2, a: '#ff8a4a', p1: wv.r / out, p2: wv.width / out, seed: wv.id * 0.3 });
    }
    this.windups(w, fx);
    for (const tr of w.traps) {
      if (sc.near(tr.x, tr.y)) fx.put({ kind: FX.trap, x: tr.x, y: tr.y, flat: true, w: 24, a: tr.arm > 0 ? '#8a8a8a' : '#8be36b', t: tr.arm > 0 ? 0 : 1 });
    }
    for (const e of w.enemies) {
      if (e.dead || !hasStatus(e, 'root') || !sc.near(e.x, e.y)) continue;
      fx.put({ kind: FX.field, x: e.x, y: e.y, flat: true, w: (e.r + 5) * 2, a: '#4a9a3a', b: '#b8ff8a', t: 1, seed: e.id * 0.3, p1: FIELD.nature });
    }
    if (p.channel) {
      const tone = toneOf(p.channel.spec.dmgType);
      fx.put({ kind: FX.rune, x: p.x, y: p.y, flat: true, w: 46, a: tone.a, b: tone.b, t: 0.5 });
      fx.put({ kind: FX.gather, x: p.x, y: p.y, up: 16, w: 50, a: tone.a, b: tone.b, t: 1 });
      const target = p.channel.target !== undefined ? w.enemyById(p.channel.target) : null;
      if (target) {
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        fx.put({ kind: FX.beam, x: (p.x + target.x) / 2, y: (p.y + target.y) / 2, up: 14, w: Math.hypot(dx, dy) * shortened(dx, dy), h: 9, rot: screenAngle(dx, dy), a: tone.a, b: tone.b, seed: 1 });
      }
    }
    if (p.windup) {
      const tone = toneOf(p.windup.spec.dmgType);
      fx.put({ kind: FX.gather, x: p.x, y: p.y, up: 18, w: 44, a: tone.a, b: tone.b, t: 1 - clamp(p.windup.t / p.windup.total, 0, 1) });
    }
    if (p.casting) this.gathering(fx, p.x, p.y, p.casting.angle, p.casting.spec.dmgType, clamp(p.casting.t / p.casting.total, 0, 1));
    for (const gh of w.coop?.ghosts ?? []) {
      const spell = gh.cast && !gh.dead ? SKILLS[gh.cast.id] : undefined;
      if (spell && sc.near(gh.x, gh.y)) this.gathering(fx, gh.x, gh.y, gh.cast!.angle, spell.base.dmgType, gh.cast!.k);
    }
    if (p.summon > 0 && !p.riding && !p.dead) this.calling(fx, p.x, p.y, clamp(p.summon / SUMMON_TIME, 0, 1), mountDef(riddenMount(w.hero) ?? '')?.glow?.color ?? '#ffd98a');
    const boss = w.boss();
    if (boss?.boss && boss.boss.collapse > 0) {
      fx.put({ kind: FX.collapse, x: boss.boss.cx, y: boss.boss.cy, flat: true, w: 1600, a: '#ff3fd2', b: '#22e4ff', p1: boss.boss.collapse / 800, seed: 0.5 });
    }
  }

  /**
   * A spell being cast (the cast bar, sim/cast.ts updateCasting), `k` how far along: a rune under the caster
   * that widens and brightens in the spell's color, power streaming in, and a light gathering in the raised
   * hands, a little in front, that grows until the spell is thrown.
   */
  /**
   * A spell thrown out of the hand: a flash where it leaves (its light flaring and a rune turning at the hero's feet),
   * in the hero's own color, so a caster's every cast is seen as a blow is.
   */
  private throwing(w: World, sc: EffectsScene): void {
    const p = w.player;
    if (p.dead || p.actT <= 0 || (p.actKind !== 'cast' && p.actKind !== 'shoot')) return;
    const c = CLASSES[w.hero.cls].colors;
    const u = clamp(1 - p.actT / 0.3, 0, 1);
    const hx = p.x + Math.cos(p.actAngle) * 10;
    const hy = p.y + Math.sin(p.actAngle) * 10;
    sc.fx.put({ kind: FX.glow, x: hx, y: hy, up: 22, w: 34 * (1 - u * 0.5), a: c.accent, alpha: 0.75 * (1 - u) });
    sc.fx.put({ kind: FX.impact, x: hx, y: hy, up: 22, w: 26, a: c.accent, b: '#ffffff', t: u, seed: p.x * 0.1 });
    if (p.actKind === 'cast') sc.fx.put({ kind: FX.rune, x: p.x, y: p.y, flat: true, w: 34, a: c.main, b: c.accent, t: 0.5, alpha: 0.7 * (1 - u), seed: 0.3 });
  }

  private gathering(fx: Fx3D, x: number, y: number, angle: number, type: string, k: number): void {
    const tone = toneOf(type);
    fx.put({ kind: FX.rune, x, y, flat: true, w: 28 + 20 * k, a: tone.a, b: tone.b, t: 0.5, alpha: 0.45 + 0.45 * k, seed: 0.7 });
    fx.put({ kind: FX.gather, x, y, up: 18, w: 38, a: tone.a, b: tone.b, t: 0.2 + 0.5 * k, alpha: 0.6 });
    const hx = x + Math.cos(angle) * 8;
    const hy = y + Math.sin(angle) * 8;
    fx.put({ kind: FX.glow, x: hx, y: hy, up: 26, w: 14 + 20 * k, a: tone.b, alpha: 0.2 + 0.35 * k });
    fx.put({ kind: FX.orb, x: hx, y: hy, up: 26, w: 3 + 8 * k, a: tone.a, b: tone.b, seed: 0.4 });
  }

  private field(f: World['fields'][number], sc: EffectsScene): void {
    const fx = sc.fx;
    // (a druid's Starfall is a ring of moonlit ground with stars falling on it, not the rift its rules borrow)
    const starfall = !f.hostile && f.spec?.id === 'starfall' && f.type === 'arcane';
    const [look, a, b] = starfall ? STARFALL_FIELD : (FIELDS[f.look] ?? FIELDS.rift!);
    const life = clamp(f.t / f.dur, 0, 1);
    const seed = f.id * 0.31;
    fx.put({ kind: FX.field, x: f.x, y: f.y, flat: true, w: f.r * 2, a, b, t: life, seed, p1: look, p2: f.hostile ? 1 : 0 });
    const fade = clamp(life * 3, 0, 1);
    if (starfall) {
      this.fallingStars(fx, f, sc.time, fade);
      return;
    }
    // Rain of Fire: balls of fire coming down on the burning ground
    if (!f.hostile && f.spec?.id === 'rain-of-fire' && f.look === 'fire') this.fireRain(fx, f, sc.time, fade);
    // what stands up out of it
    const n = clamp(Math.round(f.r / 11), 1, 7);
    switch (f.look) {
      case 'fire':
        for (let i = 0; i < n; i++) {
          const ang = hash2(i, f.id, 3) * TAU;
          const r = Math.sqrt(hash2(i, f.id, 4)) * f.r * 0.72;
          const s = 0.75 + hash2(i, f.id, 5) * 0.6;
          fx.put({ kind: FX.flame, x: f.x + Math.cos(ang) * r, y: f.y + Math.sin(ang) * r, base: true, w: 22 * s, h: 26 * s, a, b, seed: seed + i, alpha: fade });
        }
        break;
      case 'poison':
        fx.put({ kind: FX.rain, x: f.x, y: f.y, base: true, w: f.r * 1.9, h: 34, a: b, t: -1, seed, alpha: fade });
        break;
      case 'frost':
      case 'holy':
        fx.put({ kind: FX.rain, x: f.x, y: f.y, base: true, w: f.r * 1.9, h: 40, a: b, t: -1, seed, alpha: fade });
        break;
      case 'lightning': {
        const flick = Math.floor(sc.time * 9 + f.id);
        for (let i = 0; i < Math.min(3, n); i++) {
          const ang = hash2(i, flick, 6) * TAU;
          const r = Math.sqrt(hash2(i, flick, 7)) * f.r * 0.7;
          fx.put({ kind: FX.bolt, x: f.x + Math.cos(ang) * r, y: f.y + Math.sin(ang) * r, base: true, w: 16, h: 30, a, seed: flick + i, p1: 1, alpha: fade });
        }
        break;
      }
      case 'shadow':
      case 'rift':
        fx.put({ kind: FX.rain, x: f.x, y: f.y, base: true, w: f.r * 1.8, h: 34, a, t: -1, seed, alpha: fade });
        break;
      case 'nature':
        for (let i = 0; i < Math.min(4, n); i++) {
          const ph = (sc.time * 0.5 + hash2(i, f.id, 8)) % 1;
          const ang = hash2(i, f.id, 9) * TAU;
          const r = Math.sqrt(hash2(i, f.id, 10)) * f.r * 0.8;
          fx.put({ kind: FX.leaf, x: f.x + Math.cos(ang) * r, y: f.y + Math.sin(ang) * r, up: 2 + ph * 22, w: 7, h: 4, rot: ph * 7 + i, a: i % 2 ? '#7ac85a' : '#a8e070', alpha: clamp((1 - ph) * 2, 0, 1) * fade });
        }
        break;
      default:
        break;
    }
  }

  /**
   * Things coming down on a field out of the sky, `n` at a time, each landing on a new spot of it every time round:
   * where each one is, handed to `draw` (`ph`: 0 high up to 1 landed).
   */
  private skyfall(f: World['fields'][number], time: number, n: number, speed: number, draw: (x: number, y: number, up: number, ph: number, i: number) => void): void {
    for (let i = 0; i < n; i++) {
      const at = time * speed + i / n + hash2(i, f.id, 21);
      const ph = at % 1;
      const round = Math.floor(at);
      const ang = hash2(i, round, f.id) * TAU;
      const r = Math.sqrt(hash2(i, round, f.id + 7)) * f.r * 0.8;
      const fall = fallen(f.x + Math.cos(ang) * r, ph, 50, 190);
      draw(fall.x, f.y + Math.sin(ang) * r, fall.up, ph, i);
    }
  }

  /** A druid's Starfall: stars streaking down on the moonlit ring, each a flash where it lands. */
  private fallingStars(fx: Fx3D, f: World['fields'][number], time: number, fade: number): void {
    const rot = Math.atan2(-190 * COS_P, 50);
    const sl = Math.hypot(50, 190 * COS_P) / Math.hypot(50, 190);
    this.skyfall(f, time, 5, 1.4, (x, y, up, ph, i) => {
      if (ph < 0.86) {
        fx.put({ kind: FX.trail, x: x - 9, y, up: up + 34, w: 72 * sl, h: 9, rot, a: '#8a5ad8', b: '#f4e4ff', seed: i, alpha: fade });
        fx.put({ kind: FX.spark, x, y, up, w: 16, rot: time * 5 + i, a: '#ffe8ff', t: 0.05, alpha: fade });
      } else {
        const u = (ph - 0.86) / 0.14;
        fx.put({ kind: FX.impact, x, y, up: 6, w: 34, a: '#c06aff', b: '#ffe8ff', t: u, seed: i, alpha: fade });
        fx.put({ kind: FX.ring, x, y, flat: true, w: 30, a: '#e0b0ff', t: u, seed: i, alpha: fade });
      }
    });
  }

  /** Rain of Fire: balls of fire coming down on the burning ground, each a splash of flame where it lands. */
  private fireRain(fx: Fx3D, f: World['fields'][number], time: number, fade: number): void {
    const rot = Math.atan2(-190 * COS_P, 50);
    this.skyfall(f, time, 3, 1.1, (x, y, up, ph, i) => {
      if (ph < 0.86) {
        fx.put({ kind: FX.flame, x, y, up, base: true, w: 20, h: 46, rot: rot + Math.PI / 2, a: '#f4461f', b: '#ffc23a', seed: i * 1.7, alpha: fade });
        fx.put({ kind: FX.orb, x, y, up, w: 14, a: '#ff5a1e', b: '#ffe07a', seed: i, alpha: fade });
      } else {
        const u = (ph - 0.86) / 0.14;
        fx.put({ kind: FX.blast, x, y, up: 6, w: 40, a: '#ff5a1e', b: '#ffc23a', t: u, seed: i, alpha: fade });
      }
    });
  }

  private telegraph(t: Telegraph, fx: Fx3D): void {
    if (t.t >= t.dur && t.linger <= 0) return;
    const k = clamp(t.t / t.dur, 0, 1);
    const kind = telegraphKind(t);
    const a = kind === 'danger' ? (t.tone === 'rift' ? '#ff3fd2' : t.tone === 'player' ? '#ffb04d' : dangerColor()) : KIND_COLOR[kind];
    const lingering = t.t >= t.dur;
    if (kind !== 'danger') {
      this.quietTelegraph(t, kind, a, fx);
      return;
    }
    switch (t.shape) {
      case 'circle':
        fx.put({ kind: FX.warn, x: t.x, y: t.y, flat: true, w: t.r * 2, a, t: lingering ? 1 : k, p1: WARN.circle, seed: lingering ? 0.7 : 0 });
        break;
      case 'ring':
      case 'donut':
        fx.put({ kind: FX.warn, x: t.x, y: t.y, flat: true, w: t.r * 2, a, t: lingering ? 1 : k, p1: WARN.donut, p2: t.r2 / t.r, seed: lingering ? 0.7 : 0 });
        break;
      case 'line': {
        const mx = t.x + (Math.cos(t.angle) * t.len) / 2;
        const my = t.y + (Math.sin(t.angle) * t.len) / 2;
        if (lingering) fx.put({ kind: FX.beam, x: mx, y: my, flat: true, up: 7, w: t.len, h: t.r2 * 1.6, rot: t.angle, a, b: mixHex(colorOf(a), 1, 0.5), seed: t.id * 0.3 });
        else fx.put({ kind: FX.warn, x: mx, y: my, flat: true, w: t.len, h: t.r2, rot: t.angle, a, t: k, p1: WARN.line });
        break;
      }
      case 'cone':
        fx.put({ kind: FX.warn, x: t.x, y: t.y, flat: true, w: t.r * 2, rot: t.angle, a, t: k, p1: WARN.cone, p2: t.r2 });
        break;
    }
  }

  /**
   * A place on the ground that isn't an attack, each kind its own look so it is never read as one: a safe place is
   * gold, steady (it doesn't fill like a blow about to land) and outlined; a place to stand is blue with a mark turning
   * at its middle; a plain warning is grey and faint.
   */
  private quietTelegraph(t: Telegraph, kind: Exclude<TelegraphKind, 'danger'>, a: string, fx: Fx3D): void {
    if (t.t >= t.dur) return;
    const pulse = 0.5 + Math.sin(t.t * 5) * 0.08;
    const fill = kind === 'warn' ? 0.2 : pulse;
    const alpha = kind === 'warn' ? 0.45 : 1;
    let cx = t.x;
    let cy = t.y;
    switch (t.shape) {
      case 'circle':
        fx.put({ kind: FX.warn, x: t.x, y: t.y, flat: true, w: t.r * 2, a, t: fill, p1: WARN.circle, alpha });
        if (kind === 'safe') fx.put({ kind: FX.mark, x: t.x, y: t.y, flat: true, w: t.r * 2 + 4, a });
        break;
      case 'ring':
      case 'donut':
        fx.put({ kind: FX.warn, x: t.x, y: t.y, flat: true, w: t.r * 2, a, t: fill, p1: WARN.donut, p2: t.r2 / t.r, alpha });
        break;
      case 'line':
        cx = t.x + (Math.cos(t.angle) * t.len) / 2;
        cy = t.y + (Math.sin(t.angle) * t.len) / 2;
        fx.put({ kind: FX.warn, x: cx, y: cy, flat: true, w: t.len, h: t.r2, rot: t.angle, a, t: fill, p1: WARN.line, alpha });
        break;
      case 'cone':
        fx.put({ kind: FX.warn, x: t.x, y: t.y, flat: true, w: t.r * 2, rot: t.angle, a, t: fill, p1: WARN.cone, p2: t.r2, alpha });
        break;
    }
    if (kind === 'stand') fx.put({ kind: FX.rune, x: cx, y: cy, flat: true, w: Math.min(40, Math.max(18, t.r)), a, b: '#ffffff', t: 0.6, seed: t.id * 0.37 });
  }

  /** The wind-ups of ordinary foes, read from their state: arcs, slam circles, aim lines, charge lanes. */
  private windups(w: World, fx: Fx3D): void {
    const red = dangerColor();
    for (const e of w.enemies) {
      if (e.dead || e.state !== 'windup' || e.boss) continue;
      const k = clamp(1 - e.t / e.def.windup, 0, 1);
      if (e.mend) {
        // a healer gathering a heal: a green thread to its friend (stun or kill it to stop it)
        const ally = w.enemyById(e.mend);
        if (ally) {
          const dx = ally.x - e.x;
          const dy = ally.y - e.y;
          fx.put({ kind: FX.beam, x: (e.x + ally.x) / 2, y: (e.y + ally.y) / 2, up: 14, w: Math.hypot(dx, dy) * shortened(dx, dy), h: 5, rot: screenAngle(dx, dy), a: '#3ad86a', b: '#b8ffc8', alpha: 0.35 + k * 0.6, seed: e.id * 0.3 });
        }
        continue;
      }
      switch (e.def.ai) {
        case 'melee':
        case 'hopper': {
          const r = e.def.reach + e.r + 4 + (e.def.ai === 'hopper' ? 18 : 0);
          fx.put({ kind: FX.warn, x: e.x, y: e.y, flat: true, w: r * 2, rot: e.aimA, a: red, t: k, p1: WARN.cone, p2: 0.9 });
          break;
        }
        case 'armored': {
          const r = e.def.slam?.radius ?? 30;
          fx.put({ kind: FX.warn, x: e.x, y: e.y, flat: true, w: r * 2, a: red, t: k, p1: WARN.circle });
          break;
        }
        case 'ranged':
        case 'caster':
          if (e.aimX === -1) break; // casters with a ground circle: the telegraph shows it
          fx.put({ kind: FX.warn, x: e.x + Math.cos(e.aimA) * 62, y: e.y + Math.sin(e.aimA) * 62, flat: true, w: 120, h: 3.5, rot: e.aimA, a: red, t: k, p1: WARN.line, alpha: 0.5 + k * 0.5 });
          break;
        case 'charger': {
          const wide = e.r * 2 + 4;
          fx.put({ kind: FX.warn, x: e.x + (Math.cos(e.aimA) * e.rushLeft) / 2, y: e.y + (Math.sin(e.aimA) * e.rushLeft) / 2, flat: true, w: e.rushLeft, h: wide, rot: e.aimA, a: red, t: k, p1: WARN.line });
          break;
        }
      }
    }
  }

  /* -------------------------------------------------------------- fires */

  /** A fire of `size` (a torch is under 1), its foot `up` world pixels over (x, y). */
  private flame(fx: Fx3D, x: number, y: number, up: number, size: number, tone: Tone, alpha = 1): void {
    const s = 0.8 + Math.min(2.4, size) * 0.75;
    fx.put({ kind: FX.glow, x, y, up: up + 5 * s, w: 40 * s, a: tone.a, alpha: 0.42 * alpha });
    fx.put({ kind: FX.flame, x, y, up: up - 3 * s, base: true, w: 17 * s, h: 21 * s, a: tone.a, b: tone.b, seed: (x * 0.73 + y * 0.31) % 19, alpha });
  }

  /**
   * A roof on fire: tongues of flame standing on its real surface, a great glow, embers going up, and a column of smoke
   * leaning away on the wind. A fire with no building under it burns on the ground where it is.
   */
  private blaze(fx: Fx3D, f: World['fires'][number], lit: number, roof: readonly RoofSpot[], time: number, tone: Tone): void {
    const key = Math.round(f.x * 0.7 + f.y * 3.1);
    const k = clamp(f.size / 2, 0.7, 1.35);
    const grow = 0.25 + lit * 0.75;
    // where it burns hottest: the top of the roof, nearest where it caught
    let top: RoofSpot | null = null;
    let score = -Infinity;
    for (const p of roof) {
      const v = p.y * 2 - Math.abs(p.x * TILE - f.x) / TILE - Math.abs(p.z * TILE - f.y) / TILE;
      if (v > score) {
        score = v;
        top = p;
      }
    }
    const x = top ? top.x * TILE : f.x;
    const y = top ? top.z * TILE : f.y;
    const peak = top ? top.y * TILE : 0;
    fx.put({ kind: FX.glow, x, y, up: peak - 4, w: 190 * k, a: tone.a, alpha: 0.55 * grow, behind: true });
    fx.put({ kind: FX.glow, x, y: y + 34, flat: true, w: 210 * k, a: tone.a, alpha: 0.34 * grow });
    // the smoke first, so that the flames burn in front of it
    for (let i = 0; i < 8; i++) {
      const ph = (time * 0.13 + i / 8 + hash2(key, i, 1) * 0.07) % 1;
      const wind = ph * ph * 80 + Math.sin(ph * 5 + key) * 7;
      fx.put({ kind: FX.smoke, x: x + wind, y, up: peak + 10 + ph * 190, w: (44 + ph * 110) * k, a: i % 2 ? '#2c2829' : '#3e3838', alpha: 0.62 * grow * Math.min(1, ph * 5), t: ph * 0.95, seed: (key % 17) + i * 3.3, behind: true });
    }
    // flames all over the roof, overlapping into one fire; it reaches higher near the ridge
    const n = Math.min(14, 7 + Math.round(f.size * 2));
    for (let i = 0; i < n; i++) {
      const p = roof.length ? roof[Math.floor(hash2(key, i, 2) * roof.length)]! : null;
      const u = hash2(key, i, 3) * TAU;
      const px = p ? p.x * TILE : f.x + Math.cos(u) * 13 * k;
      const py = p ? p.z * TILE : f.y + Math.sin(u) * 9 * k;
      const high = p && peak > 0 ? clamp((p.y * TILE) / peak, 0.5, 1) : 1;
      const s = (0.75 + hash2(key, i, 4) * 0.6) * k * grow * (0.7 + high * 0.3);
      fx.put({ kind: FX.flame, x: px, y: py, up: (p ? p.y * TILE : 0) - 7 * s, base: true, over: true, w: 36 * s, h: 48 * s, a: tone.a, b: tone.b, seed: (key % 23) + i * 1.7 });
    }
    // sparks going up on the heat
    fx.put({ kind: FX.rain, x: x + 8, y, up: peak, base: true, w: 90, h: 130, a: '#ffb04d', t: -1, seed: key % 31, p1: 1 });
    fx.put({ kind: FX.rain, x: x + 14, y, up: peak + 10, base: true, w: 70, h: 100, a: '#ffe08a', t: -1, seed: (key % 31) + 5, p1: 1 });
  }

  /**
   * The light at the ways through: out of each road's gate the next land's own light spills along the ground in that
   * land's color, soft on every side (it lies on the ground in the world, so a tree or a wall stands in it and hides it
   * as it would, and it has no edge to be cut off at); a way down in the middle of a land has its deep place's light at
   * its mouth; and a house that can be gone into has lamplight falling out of its door onto the step (no arrow painted
   * on the ground: a door you can use is the one with a light in it). From inside, daylight comes in at the door.
   */
  private wayLights(w: World, sc: EffectsScene): void {
    const fx = sc.fx;
    const time = sc.time;
    const dungeon = w.region.kind === 'dungeon';
    const inside = !!w.region.interior || dungeon;
    const mw = w.map.w * TILE;
    const mh = w.map.h * TILE;
    /** Light from a source at (x, y) spilling toward `into` (radians: 0 east, a quarter turn south), `long` px. */
    const spill = (x: number, y: number, into: number, long: number, wide: number, color: string, alpha: number, seed: number): void => {
      // (the source is a quarter of the way in from the quad's near edge: fx3d.ts spill)
      fx.put({ kind: FX.spill, x: x + Math.cos(into) * long * 0.25, y: y + Math.sin(into) * long * 0.25, up: 2, flat: true, w: wide, h: long, rot: into - Math.PI / 2, a: color, alpha, seed });
    };
    const groups: { to: string; door: boolean; x: number; y: number; n: number }[] = [];
    for (const x of w.exits) {
      const g = groups.find((o) => o.to === x.to && o.door === !!x.door && Math.abs(o.x / o.n - x.x) < TILE * 4 && Math.abs(o.y / o.n - x.y) < TILE * 4);
      if (g) {
        g.x += x.x;
        g.y += x.y;
        g.n++;
      } else groups.push({ to: x.to, door: !!x.door, x: x.x, y: x.y, n: 1 });
    }
    for (const g of groups) {
      const x = g.x / g.n;
      const y = g.y / g.n;
      if (!sc.near(x, y) && !sc.near(x, y + 220) && !sc.near(x, y - 220) && !sc.near(x + 220, y) && !sc.near(x - 220, y)) continue;
      const breathe = 0.5 + Math.sin(time * 1.3 + x * 0.02) * 0.5;
      const seed = (x * 0.013 + y * 0.007) % 1;
      if (inside) {
        // the way back out: daylight on the floor at the door
        if (g.door) spill(x, y + 6, -Math.PI / 2, 120, 96, DAY_LIGHT, 0.5 + breathe * 0.08, seed);
        else fx.put({ kind: FX.glow, x, y, up: 2, flat: true, w: 110, a: DAY_LIGHT, alpha: 0.42 + breathe * 0.08 });
        continue;
      }
      if (g.door) {
        // a house: its lamplight out of the door and down the step, and the door itself lit
        // (the doorway itself full of light: what is behind it isn't seen through it. The owner: "increase the glow of
        // the zone gates and innkeeps, make it so that it covers the background")
        spill(x, y - 12, Math.PI / 2, 150, 118, DOOR_LIGHT, 0.82 + breathe * 0.1, seed);
        fx.put({ kind: FX.glow, x, y: y - 14, up: 15, w: 62, a: DOOR_LIGHT, alpha: 0.62 + breathe * 0.08, over: true });
        fx.put({ kind: FX.glow, x, y: y - 14, up: 13, w: 30, a: DOOR_LIGHT, alpha: 0.9, over: true });
        continue;
      }
      const col = zoneLight(g.to);
      const least = Math.min(x, y, mw - x, mh - y);
      if (least < TILE * 8) {
        // a gate at the land's edge: the way through that fills its arch is the gate's own (render3d/portal.ts), and
        // it throws no light. It used to: a great fan of the next land's color down the road and a haze of it in
        // the air, which the owner asked to have gone ("without illuminating anything on the floor").
        continue;
      } else {
        // a way down in the middle of the land: its doors face south
        spill(x, y - 10, Math.PI / 2, 330, 320, col, 0.42 + breathe * 0.06, seed);
      }
    }
  }

  private fires(w: World, sc: EffectsScene): void {
    const fx = sc.fx;
    const tone = FIRE[w.region.theme] ?? FIRE.default!;
    if (sc.land) {
      for (const f of sc.land.flames) {
        const x = f.x * TILE;
        const y = f.z * TILE;
        if (sc.near(x, y)) this.flame(fx, x, y, f.y * TILE, f.size, tone);
      }
      for (const f of sc.land.glows) {
        const x = f.x * TILE;
        const y = f.z * TILE;
        if (!sc.near(x, y)) continue;
        const r = f.size * (0.92 + Math.sin(sc.time * 1.8 + x) * 0.08);
        fx.put({ kind: FX.glow, x, y, up: f.y * TILE, w: r * 2.6, a: f.color, alpha: 0.6 });
        // in a deep place its light lies on the floor round it too: a small warm pool in the room's cold
        if (w.region.dark) fx.put({ kind: FX.glow, x, y, flat: true, w: r * 9, a: f.color, alpha: 0.2 + Math.sin(sc.time * 5.3 + x * 0.7) * 0.02 });
      }
    }
    this.wayLights(w, sc);
    for (const f of w.fires) {
      const lit = w.fireLit(f);
      if (lit && sc.near(f.x, f.y)) this.blaze(fx, f, lit, sc.land?.roofAt(f.x / TILE, f.y / TILE) ?? [], sc.time, tone);
    }
    // what a quest asks for, lying where it fell: a shaft of gold over it and a pool of light under, pulsing, so it is
    // seen across a field (the owner couldn't see what they were collecting)
    for (const d of w.drops) {
      if (d.kind !== 'quest' || !sc.near(d.x, d.y)) continue;
      const beat = 0.75 + Math.sin(sc.time * 5 + d.x) * 0.2;
      fx.put({ kind: FX.shaft, x: d.x, y: d.y, base: true, w: 16, h: 70, a: QUEST_GOLD, alpha: 0.85 * beat, seed: d.x * 0.1 });
      fx.put({ kind: FX.glow, x: d.x, y: d.y, flat: true, w: 40, a: QUEST_GOLD, alpha: 0.7 * beat });
    }
    for (const d of w.drops) {
      if (d.kind !== 'item' || !d.item || !sc.near(d.x, d.y)) continue;
      const color = BEAM[d.item.r] ?? '#ffffff';
      fx.put({ kind: FX.shaft, x: d.x, y: d.y, base: true, w: 14, h: 58, a: color, alpha: 0.75, seed: d.x * 0.1 });
      fx.put({ kind: FX.glow, x: d.x, y: d.y, flat: true, w: 30, a: color, alpha: 0.55 });
    }
  }

  /* -------------------------------------------------------------- on people */

  private marks(w: World, sc: EffectsScene): void {
    const fx = sc.fx;
    for (const e of w.enemies) if (!e.dead && sc.near(e.x, e.y)) this.enemyMarks(e, fx, sc.time);
    // a boss's presence: its sigil, its halo and what hangs in the air round it, and the light of its turns and its fall
    for (const e of w.enemies) if (e.boss && sc.near(e.x, e.y) && !bossHidden(e)) this.bossPresence(e, fx, sc.time, w.region.theme);
    const p = w.player;
    if (p.dead) return;
    if (p.shield > 0) fx.put({ kind: FX.bubble, x: p.x, y: p.y, up: 16, w: 50, a: '#7fd8ff' });
    for (let i = 0; i < p.buffs.length; i++) {
      const b = p.buffs[i]!;
      fx.put({ kind: FX.rain, x: p.x, y: p.y, base: true, w: 34, h: 50, a: b.def.color, t: -1, seed: i * 2.1 + 1 });
      if (b.def.dr) fx.put({ kind: FX.rune, x: p.x, y: p.y, flat: true, w: 40, a: b.def.color, b: '#ffffff', t: 0.5, seed: i });
    }
    if (hasStatus(p, 'stun')) this.stars(fx, p.x, p.y, PERSON_H + 2, sc.time);
    const ridden = p.riding ? mountDef(p.riding) : undefined;
    if (ridden?.glow) this.mountGlow(fx, p.x, p.y, ridden.glow, ridden.body === 'drake' ? 1.5 : 1, sc.time);
    const worn = w.hero.worn.chest;
    const shop = wornLooks(w.hero).chest;
    if (shop && shop !== 'bare' && shop.shop && shop.set && SHOP_GLOW[shop.set]) {
      const c = shop.colors ?? [];
      this.aura(fx, p.x, p.y, ridden ? 24 : 0, { ...SHOP_GLOW[shop.set]!, a: c[3] ?? '#ffffff', b: c[1] ?? '#ffffff' }, sc.time);
    } else if (worn?.startsWith('warden-')) this.aura(fx, p.x, p.y, ridden ? 24 : 0, WARDEN_GLOW[w.hero.cls], sc.time);
  }

  /** What a Sigil-warden's armor (or a shop set) does in the air round them: each of the seven sigils its own way. */
  private aura(fx: Fx3D, x: number, y: number, up: number, look: Aura, time: number): void {
    const n = look.n;
    for (let i = 0; i < n; i++) {
      const u = (time * look.speed + i / n) % 1;
      const round = Math.floor(time * look.speed + i / n);
      const a = hash2(i, round, 11) * TAU + time * look.spin;
      const out = 8 + hash2(i, round, 13) * 8;
      const rise = look.rise >= 0 ? u * look.rise : (1 - u) * -look.rise;
      fx.put({ kind: FX.spark, x: x + Math.cos(a) * out, y: y + Math.sin(a) * out * 0.6, up: up + look.from + rise, w: look.size * Math.sin(u * Math.PI), a: i % 3 === 2 ? look.b : look.a, t: 0.1 + u * 0.5 });
    }
    if (look.halo) fx.put({ kind: FX.glow, x, y, up: up + look.halo.up, w: look.halo.w, a: look.a, alpha: look.halo.alpha + Math.sin(time * 1.7) * 0.05 });
  }

  /**
   * Calling the mount (`u`, 0 to 1 through the call): a ring drawn on the ground and light swirling in round the hero
   * as they cast. The rules end it in a flash with them in the saddle (sim/world.ts).
   */
  private calling(fx: Fx3D, x: number, y: number, u: number, color: string): void {
    fx.put({ kind: FX.rune, x, y, flat: true, w: 36 + u * 16, a: color, b: '#ffffff', t: 0.2 + u * 0.4, seed: 0.4 });
    fx.put({ kind: FX.gather, x, y, up: 16, w: 46, a: color, b: '#ffffff', t: u, seed: 0.4 });
    const n = 10;
    for (let i = 0; i < n; i++) {
      // round and in, and up the body
      const a = (i / n) * TAU + u * TAU * 1.25;
      const out = 22 - u * 13;
      fx.put({ kind: FX.spark, x: x + Math.cos(a) * out, y: y + Math.sin(a) * out * 0.6, up: 3 + (i % 4) * 5 + u * 16, w: 5 + 4 * Math.sin(u * Math.PI), a: i % 2 ? '#ffffff' : color, t: 0.15 + u * 0.5 });
    }
  }

  /**
   * A prestige mount's touch, kept small: embers going up off it, or stars round its feet. The shop's have more: sparks
   * crackling over it, motes of light drifting up, flames licking at its feet.
   */
  private mountGlow(fx: Fx3D, x: number, y: number, glow: NonNullable<MountDef['glow']>, k: number, time: number): void {
    if (glow.kind === 'sparks') {
      // each one jumps to a new spot many times a second
      for (let i = 0; i < 7; i++) {
        const tick = Math.floor(time * 11 + i * 0.37);
        const a = hash2(i, tick, 3) * TAU;
        const r = 6 + hash2(i, tick, 5) * 12;
        fx.put({ kind: FX.spark, x: x + Math.cos(a) * r * k, y: y + Math.sin(a) * r * 0.6 * k, up: (10 + hash2(i, tick, 9) * 30) * k, w: 4 + hash2(i, tick, 13) * 6, a: hash2(i, tick, 17) > 0.7 ? '#ffffff' : glow.color, t: 0.1 });
      }
      return;
    }
    if (glow.kind === 'flames') {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + 0.6;
        const flick = Math.sin(time * 9 + i * 1.7) * 0.5 + 0.5;
        fx.put({ kind: FX.flame, x: x + Math.cos(a) * 10 * k, y: y + Math.sin(a) * 6 * k, base: true, w: 8 * k, h: (9 + flick * 6) * k, a: glow.color, b: '#fff2b0', seed: i * 1.3 });
      }
    }
    const n = glow.kind === 'motes' ? 8 : 6;
    const speed = glow.kind === 'motes' ? 0.22 : 0.42;
    for (let i = 0; i < n; i++) {
      const u = (time * speed + i / n) % 1;
      const a = hash2(i, Math.floor(time * speed + i / n), 7) * TAU;
      if (glow.kind === 'embers' || glow.kind === 'flames') fx.put({ kind: FX.spark, x: x + Math.cos(a) * 11 * k, y: y + Math.sin(a) * 6 * k, up: (22 + u * 26) * k, w: 7 * (1 - u * 0.6), a: glow.color, t: 0.1 + u * 0.8 });
      else if (glow.kind === 'motes') fx.put({ kind: FX.spark, x: x + Math.cos(a + u * 2) * 14 * k, y: y + Math.sin(a + u * 2) * 8 * k, up: (6 + u * 46) * k, w: 8 * Math.sin(u * Math.PI), a: glow.color, t: 0.1 });
      else fx.put({ kind: FX.spark, x: x + Math.cos(a) * 15, y: y + Math.sin(a) * 9, up: 2 + u * 9, w: 9 * Math.sin(u * Math.PI), a: glow.color, t: 0.1 });
    }
  }

  private stars(fx: Fx3D, x: number, y: number, up: number, time: number): void {
    for (let i = 0; i < 3; i++) {
      const a = time * 5 + (i * TAU) / 3;
      fx.put({ kind: FX.spark, x: x + Math.cos(a) * 9, y: y + Math.sin(a) * 3, up, w: 11, a: '#ffe066', t: 0.1 });
    }
  }

  /**
   * A boss's presence, so that it looks the fight it is: a rune turning on the floor under it in its own color, a halo
   * behind it, and what hangs in the air round it (embers off a forge's master, frost off a wyrm, souls off a crypt's
   * dead, gloom off a lamp-eater...), thicker with every phase. As it turns to its next phase, light gathers into it
   * and flares; as it falls, a column of light and a spiral of sparks go up from it.
   */
  private bossPresence(e: Enemy, fx: Fx3D, time: number, theme: string): void {
    const b = e.boss!;
    const look = BOSS_AURA[b.def.id] ?? THEME_AURA[theme] ?? THEME_AURA.cave!;
    const h = headOf(e);
    const seed = e.id * 0.37;
    const phase = b.phase;
    const dying = b.dying > 0 ? 1 - b.dying / 1.8 : 0;
    const pulse = Math.sin(time * 2.2 + seed) * 0.5 + 0.5;
    // the sigil under it, and its halo
    fx.put({ kind: FX.rune, x: e.x, y: e.y, flat: true, w: (e.r + 16 + phase * 4) * 2, a: look.a, b: look.b, t: 0.32 + pulse * 0.12 + dying * 0.4, seed });
    fx.put({ kind: FX.glow, x: e.x, y: e.y, up: h * 0.55, w: e.r * 4 + 34 + phase * 8, a: look.a, alpha: 0.16 + pulse * 0.08 + phase * 0.04, behind: true });
    // what hangs in the air round it
    const n = Math.round(look.n * (1 + phase * 0.5));
    for (let i = 0; i < n; i++) {
      const u = (time * look.speed + i / n) % 1;
      const round = Math.floor(time * look.speed + i / n);
      const a = hash2(i, round, 7 + e.id) * TAU + time * look.spin;
      const out = e.r * 0.6 + 6 + hash2(i, round, 11) * (e.r + 10);
      const rise = look.rise >= 0 ? u * look.rise : (1 - u) * -look.rise;
      const color = i % 3 === 2 ? look.b : look.a;
      if (look.kind === 'rain') fx.put({ kind: FX.rain, x: e.x, y: e.y, base: true, w: e.r * 3 + 16, h: h + 14, a: color, t: -1, seed: seed + i });
      else if (look.kind === 'smoke') fx.put({ kind: FX.smoke, x: e.x + Math.cos(a) * out, y: e.y + Math.sin(a) * out * 0.6, up: look.from + rise, w: look.size * (0.6 + u), a: color, alpha: 0.5 * Math.sin(u * Math.PI), t: u, seed: seed + i });
      else if (look.kind === 'bubble') fx.put({ kind: FX.bubble, x: e.x + Math.cos(a) * out, y: e.y + Math.sin(a) * out * 0.6, up: look.from + rise, w: look.size * Math.sin(u * Math.PI) + 1, a: color });
      else fx.put({ kind: FX.spark, x: e.x + Math.cos(a) * out, y: e.y + Math.sin(a) * out * 0.6, up: look.from + rise, w: look.size * Math.sin(u * Math.PI), a: color, t: 0.1 + u * 0.6 });
    }
    // in its last phase it burns brighter: a second, wider sigil turning the other way
    if (phase >= 1 && phase === b.def.phases.length - 1) fx.put({ kind: FX.rune, x: e.x, y: e.y, flat: true, w: (e.r + 30) * 2, a: look.b, b: look.a, t: 0.22 + pulse * 0.1, seed: seed + 0.5 });
    // turning to its next phase: the light gathers into it and flares
    if (b.shift > 0) {
      const u = 1 - b.shift / 1.4;
      fx.put({ kind: FX.gather, x: e.x, y: e.y, up: h * 0.5, w: e.r * 5 + 50, a: look.a, b: '#ffffff', t: u, seed });
      fx.put({ kind: FX.glow, x: e.x, y: e.y, up: h * 0.5, w: (e.r * 4 + 40) * (0.6 + u), a: look.b, alpha: 0.35 * Math.sin(u * Math.PI) + 0.1 });
    }
    // falling: a column of light, and sparks spiraling up out of it
    if (dying > 0) {
      fx.put({ kind: FX.shaft, x: e.x, y: e.y, base: true, w: e.r * 3 + 26, h: 150, a: look.b, alpha: 0.5 + 0.45 * dying, t: dying, seed });
      fx.put({ kind: FX.glow, x: e.x, y: e.y, flat: true, w: (e.r * 4 + 40) * (1 + dying), a: look.b, alpha: 0.5 * (1 - dying * 0.5) });
      fx.put({ kind: FX.glow, x: e.x, y: e.y, up: headOf(e) * 0.6, w: e.r * 5 + 40, a: '#ffffff', alpha: 0.3 * dying });
      for (let i = 0; i < 14; i++) {
        const u = (dying * 1.6 + i / 14) % 1;
        const a = (i / 14) * TAU + dying * 9;
        fx.put({ kind: FX.spark, x: e.x + Math.cos(a) * (e.r + 6) * (1 - u * 0.5), y: e.y + Math.sin(a) * (e.r + 6) * 0.6 * (1 - u * 0.5), up: u * 90, w: 9 * (1 - u), a: i % 2 ? '#ffffff' : look.a, t: 0.1 + u * 0.5 });
      }
    }
  }

  private enemyMarks(e: Enemy, fx: Fx3D, time: number): void {
    const h = headOf(e);
    const seed = e.id * 0.37;
    if (hasStatus(e, 'burn')) fx.put({ kind: FX.flame, x: e.x, y: e.y, base: true, w: e.r * 2.6 + 10, h: h * 0.85 + 8, a: '#ff5a1e', b: '#ffc23a', seed });
    if (hasStatus(e, 'poison')) fx.put({ kind: FX.rain, x: e.x, y: e.y, base: true, w: e.r * 3 + 12, h: h + 8, a: '#8be36b', t: -1, seed });
    if (hasStatus(e, 'shock')) {
      const flick = Math.floor(time * 11 + e.id);
      fx.put({ kind: FX.bolt, x: e.x, y: e.y, up: h * 0.5, w: e.r * 2.5 + 12, h: 14, rot: hash2(flick, e.id, 1) * TAU, a: '#9ad8ff', seed: flick });
    }
    if (e.shield > 0) fx.put({ kind: FX.bubble, x: e.x, y: e.y, up: h * 0.5, w: Math.max(h * 1.25, e.r * 3 + 10), a: '#7fd8ff' });
    if (hasStatus(e, 'freeze')) {
      fx.put({ kind: FX.field, x: e.x, y: e.y, flat: true, w: (e.r + 7) * 2, a: '#7fd4ff', b: '#ffffff', t: 1, seed, p1: FIELD.frost });
      fx.put({ kind: FX.rain, x: e.x, y: e.y, base: true, w: e.r * 2.6 + 10, h: h, a: '#d8f6ff', t: -1, seed });
    }
    if (hasStatus(e, 'stun') || hasStatus(e, 'freeze') || e.boss?.dazed) this.stars(fx, e.x, e.y, h, time);
    if (hasStatus(e, 'mark')) {
      fx.put({ kind: FX.frost, x: e.x, y: e.y, up: h + 7 + Math.sin(time * 4) * 1.5, w: 13, h: 8, rot: Math.PI / 2, a: '#ffb02e', b: '#fff2a0', seed });
      fx.put({ kind: FX.mark, x: e.x, y: e.y, flat: true, w: (e.r + 6) * 2, a: '#ffe066' });
    }
  }

  /* -------------------------------------------------------------- in the air */

  private shots(w: World, sc: EffectsScene): void {
    const tides = this.tides;
    tides.length = 0;
    for (const pr of w.projectiles) {
      if (!sc.near(pr.x, pr.y)) continue;
      if (pr.look === 'tide') tides.push(pr);
      else if (pr.hostile) this.hostile(pr, sc);
      else this.friendly(pr, sc);
    }
    if (tides.length) this.tide(tides, sc);
  }

  /** What comes behind a shot. */
  private tail(fx: Fx3D, pr: Projectile, up: number, wide: number, a: string, b: string, seconds = 0.16): void {
    const speed = Math.hypot(pr.vx, pr.vy);
    if (speed < 1) return;
    const len = Math.min(pr.age * speed, speed * seconds);
    if (len < 3) return;
    const ux = pr.vx / speed;
    const uy = pr.vy / speed;
    fx.put({ kind: FX.trail, x: pr.x - (ux * len) / 2, y: pr.y - (uy * len) / 2, up, w: len * shortened(ux, uy), h: wide, rot: screenAngle(ux, uy), a, b, seed: pr.id * 0.37 });
  }

  /** A tongue of fire streaming back from a shot. */
  private fireTail(fx: Fx3D, pr: Projectile, up: number, r: number, a: string, b: string, behind = false): void {
    const speed = Math.hypot(pr.vx, pr.vy);
    if (speed < 1) return;
    fx.put({ kind: FX.flame, x: pr.x, y: pr.y, up, base: true, behind, w: r * 4.6, h: r * 3 + Math.min(speed * 0.14, r * 6), rot: screenAngle(pr.vx, pr.vy) + Math.PI / 2, a, b, seed: pr.id * 0.37 });
  }

  /** Puffs of smoke left behind a shot, thinning as they fall back (three, each going round on the clock). */
  private smokeTrail(fx: Fx3D, pr: Projectile, up: number, size: number, color: string, alpha: number, time: number): void {
    const speed = Math.hypot(pr.vx, pr.vy);
    if (speed < 1) return;
    const back = Math.min(pr.age * speed, 60);
    for (let i = 0; i < 3; i++) {
      const ph = (time * 2.6 + i / 3 + pr.id * 0.13) % 1;
      const d = Math.min(back, 8 + ph * 46);
      fx.put({ kind: FX.smoke, x: pr.x - (pr.vx / speed) * d, y: pr.y - (pr.vy / speed) * d, up: up + ph * 6, w: size * (1.4 + ph * 2), a: color, alpha: alpha * (1 - ph), t: ph * 0.8, seed: pr.id * 0.37 + i });
    }
  }

  /** Motes of light shed behind a shot, winking out. */
  private glitter(fx: Fx3D, pr: Projectile, up: number, a: string, b: string, time: number, n: number): void {
    const speed = Math.hypot(pr.vx, pr.vy);
    if (speed < 1) return;
    const back = Math.min(pr.age * speed, 50);
    for (let i = 0; i < n; i++) {
      const ph = (time * 3 + i / n + pr.id * 0.17) % 1;
      const d = Math.min(back, 6 + ph * 40);
      const side = (hash2(pr.id, i, Math.floor(time * 3 + i / n)) - 0.5) * 10;
      fx.put({ kind: FX.spark, x: pr.x - (pr.vx / speed) * d - (pr.vy / speed) * side, y: pr.y - (pr.vy / speed) * d + (pr.vx / speed) * side, up: up + side * 0.4, w: 8 * (1 - ph * 0.5), a: i % 2 ? b : a, t: ph });
    }
  }

  /** A model in flight, pointing where it's going. */
  private thrown(sc: EffectsScene, id: string, pr: Projectile, up: number, k: number, tipX = 0, rot = Math.atan2(pr.vx, pr.vy)): void {
    sc.cast.thrown(id, pr.x, pr.y, up / TILE, rot, k, tipX);
  }

  /** A wall of water: the shots in its line drawn as one wave, back to front, its wake lying behind it. */
  private tide(tides: Projectile[], sc: EffectsScene): void {
    const fx = sc.fx;
    tides.sort((p, q) => p.y - q.y);
    for (const pr of tides) {
      const d = dyeOf(pr.color);
      const speed = Math.hypot(pr.vx, pr.vy);
      if (speed < 1) continue;
      const ux = pr.vx / speed;
      const uy = pr.vy / speed;
      fx.put({ kind: FX.wake, x: pr.x - ux * 24, y: pr.y - uy * 24, flat: true, w: 56, h: 34, rot: Math.atan2(uy, ux), a: d.a, b: pr.color, seed: (ux !== 0 ? pr.y : pr.x) * 0.0385 });
    }
    for (const pr of tides) {
      const d = dyeOf(pr.color);
      // it rises where it forms, then rolls
      const rise = clamp(pr.age / 0.9, 0.12, 1);
      const moving = Math.abs(pr.vx) > 1 || Math.abs(pr.vy) > 1;
      const lane = Math.abs(pr.vy) > Math.abs(pr.vx) || !moving ? pr.x : pr.y;
      fx.put({ kind: FX.wave, x: pr.x, y: pr.y, up: 0, base: true, w: 38, h: 46 * rise, a: d.a, b: pr.color, seed: lane * 0.063, p1: Math.abs(pr.vx) > Math.abs(pr.vy) ? 0.35 : 1 });
      if (!moving) continue;
      // spray off its crest
      const ph = (sc.time * 1.7 + pr.id * 0.41) % 1;
      const side = hash2(pr.id, 1, 3) - 0.5;
      fx.put({ kind: FX.water, x: pr.x + side * 22 + (pr.vx * ph) / 18, y: pr.y + (pr.vy * ph) / 18, up: 24 + Math.sin(ph * Math.PI) * 12, w: 7, a: d.a, b: d.b, alpha: 1 - ph, seed: pr.id * 0.2 });
    }
  }

  private hostile(pr: Projectile, sc: EffectsScene): void {
    const fx = sc.fx;
    const r = Math.max(2, pr.r);
    const up = 13;
    const rot = screenAngle(pr.vx, pr.vy);
    const seed = pr.id * 0.37;
    const dye = dyeOf(pr.color);
    // (where it really is: shots fly at chest height, and this is what you dodge)
    fx.put({ kind: FX.mark, x: pr.x, y: pr.y, flat: true, w: r * 3.2 + 4, a: dangerColor() });
    switch (pr.look) {
      case 'enemyArrow':
        this.tail(fx, pr, up, 5, '#ffffff', '#ffd8c8', 0.12);
        this.thrown(sc, 'w_arrow_A', pr, up, 26 / TILE / 1.22);
        return;
      case 'spear':
        this.tail(fx, pr, up, 6, '#ffffff', '#ffd8c8', 0.12);
        this.thrown(sc, 'w_spear_A', pr, up, 46 / TILE / 3.14, Math.PI / 2);
        return;
      case 'web':
        this.tail(fx, pr, up, r * 2, '#f0ece0', '#ffffff', 0.12);
        fx.put({ kind: FX.web, x: pr.x, y: pr.y, up, w: r * 7.5, a: '#f4f0e8', seed: pr.age * 3 });
        return;
      case 'ball': {
        this.tail(fx, pr, up, r * 2.4, '#5a5464', '#8a8698', 0.2);
        fx.put({ kind: FX.ball, x: pr.x, y: pr.y, up, w: r * 3.4, a: dye.stuff === 'rock' ? '#3a3640' : dye.a, b: pr.color, seed });
        return;
      }
      case 'bolt':
        fx.put({ kind: FX.glow, x: pr.x, y: pr.y, up, w: r * 7, a: pr.color, alpha: 0.6 });
        fx.put({ kind: FX.bolt, x: pr.x - (pr.vx * 0.04) / 2, y: pr.y - (pr.vy * 0.04) / 2, up, w: r * 9, h: r * 6, rot, a: pr.color, seed });
        fx.put({ kind: FX.spark, x: pr.x, y: pr.y, up, w: r * 5, a: pr.color, t: 0.1 });
        return;
      case 'skull':
        fx.put({ kind: FX.glow, x: pr.x, y: pr.y, up: up + r * 0.5, w: r * 8, a: pr.color, alpha: 0.6, behind: true });
        this.fireTail(fx, pr, up + r * 0.5, r * 1.1, dye.a, pr.color, true);
        this.thrown(sc, 'skull', pr, up - r * 1.1, (r * 3.6 / TILE) / 0.9);
        return;
      case 'flame':
        this.fireTail(fx, pr, up, r * 1.35, dye.stuff === 'fire' ? '#f4461f' : dye.a, pr.color);
        fx.put({ kind: FX.orb, x: pr.x, y: pr.y, up, w: r * 4.6, a: '#ff5a1e', b: '#ffe07a', seed });
        return;
      default:
        break;
    }
    if (pr.look === 'stone' && (dye.stuff === 'rock' || dye.stuff === 'pale')) {
      this.tail(fx, pr, up, r * 2, '#6a6058', '#a89a88', 0.12);
      const k = (r * 2.6) / TILE / 0.58;
      sc.cast.thrown('Rock_1_A', pr.x, pr.y, (up - r) / TILE, pr.age * 7, k, pr.age * 5);
      return;
    }
    this.magic(fx, pr, dye, up, r, rot, seed);
  }

  /** A shot of some stuff, as the color a foe's data gives it says. */
  private magic(fx: Fx3D, pr: Projectile, dye: Dye, up: number, r: number, rot: number, seed: number): void {
    switch (pr.look === 'orb' && dye.stuff === 'frost' ? 'water' : dye.stuff) {
      case 'water':
        this.tail(fx, pr, up, r * 2.6, dye.a, pr.color, 0.2);
        fx.put({ kind: FX.water, x: pr.x, y: pr.y, up, w: r * 5, rot, a: dye.a, b: pr.color, seed, p1: clamp(Math.hypot(pr.vx, pr.vy) / 70, 0, 1) });
        return;
      case 'fire':
        this.fireTail(fx, pr, up, r * 1.2, dye.a, pr.color);
        fx.put({ kind: FX.orb, x: pr.x, y: pr.y, up, w: r * 4.8, a: pr.color, b: '#ffe8a0', seed });
        return;
      case 'poison':
        this.tail(fx, pr, up, r * 2.4, dye.a, pr.color, 0.18);
        fx.put({ kind: FX.poison, x: pr.x, y: pr.y, up, w: r * 5, a: pr.color, b: dye.b, seed });
        return;
      case 'shadow':
        this.tail(fx, pr, up, r * 2.8, dye.a, pr.color, 0.2);
        fx.put({ kind: FX.shadow, x: pr.x, y: pr.y, up, w: r * 5, a: pr.color, b: dye.b, seed });
        return;
      case 'rift':
        this.tail(fx, pr, up, r * 2.4, pr.color, '#22e4ff', 0.18);
        fx.put({ kind: FX.glow, x: pr.x, y: pr.y, up, w: r * 7, a: pr.color, alpha: 0.6 });
        fx.put({ kind: FX.rift, x: pr.x, y: pr.y, up, w: r * 3.8, a: pr.color, b: '#22e4ff', seed });
        return;
      case 'holy':
        this.tail(fx, pr, up, r * 2.4, pr.color, dye.b, 0.18);
        fx.put({ kind: FX.holy, x: pr.x, y: pr.y, up, w: r * 6.5, a: pr.color, b: dye.b, seed });
        return;
      case 'frost':
        this.tail(fx, pr, up, r * 2, pr.color, dye.b, 0.14);
        fx.put({ kind: FX.frost, x: pr.x, y: pr.y, up, w: r * 6, h: r * 3.2, rot, a: dye.a, b: dye.b, seed });
        return;
      default:
        // pale things: a soul, a cold light
        this.tail(fx, pr, up, r * 2.4, dye.a, pr.color, 0.2);
        fx.put({ kind: FX.orb, x: pr.x, y: pr.y, up, w: r * 4.8, a: pr.color, b: '#ffffff', seed });
        return;
    }
  }

  private friendly(pr: Projectile, sc: EffectsScene): void {
    const fx = sc.fx;
    const look = pr.look;
    const up = 13;
    const r = Math.max(1.8, pr.r) * 1.25;
    const rot = screenAngle(pr.vx, pr.vy);
    const seed = pr.id * 0.37;
    const tone = LOOK_TONES[look] ?? toneOf(pr.type);
    const { a, b } = tone;
    switch (look) {
      case 'shield':
      case 'judgment':
        // a thrown shield or a hammer of light, spinning
        fx.put({ kind: FX.glow, x: pr.x, y: pr.y, up, w: 50, a, alpha: 0.7, behind: true });
        fx.put({ kind: FX.holy, x: pr.x, y: pr.y, up, w: 42, a, b, seed, behind: true });
        sc.cast.thrown(look === 'shield' ? 'w_shield_round' : 'w_hammer_A', pr.x, pr.y, (up - 3) / TILE, sc.time * 16, look === 'shield' ? 0.42 : 0.55, Math.PI / 2 - 0.35);
        return;
      case 'icelance':
        this.tail(fx, pr, up, r * 2, a, b, 0.14);
        fx.put({ kind: FX.frost, x: pr.x, y: pr.y, up, w: r * 8.5, h: r * 3, rot, a, b, seed });
        return;
      case 'vines':
        fx.put({ kind: FX.beam, x: pr.x - (pr.vx * 0.08) / 2, y: pr.y - (pr.vy * 0.08) / 2, up, w: Math.max(14, Math.hypot(pr.vx, pr.vy) * 0.08 * shortened(pr.vx, pr.vy)), h: 7, rot: rot + Math.sin(sc.time * 18) * 0.12, a: '#2e6a2a', b: '#7ac85a', seed });
        fx.put({ kind: FX.leaf, x: pr.x, y: pr.y, up: up + Math.sin(sc.time * 20) * 3, w: 9, h: 5, rot: sc.time * 9, a: '#9cf07a' });
        return;
      case 'quake': {
        // the ground heaves as it passes: dust, lumps of earth
        fx.put({ kind: FX.wake, x: pr.x - (pr.vx / (Math.hypot(pr.vx, pr.vy) || 1)) * 14, y: pr.y - (pr.vy / (Math.hypot(pr.vx, pr.vy) || 1)) * 14, flat: true, w: 44, h: pr.r * 2.4, rot: Math.atan2(pr.vy, pr.vx), a: '#5a4428', b: '#a88a5a', seed });
        fx.put({ kind: FX.smoke, x: pr.x, y: pr.y, up: 8, w: pr.r * 5, a: '#a8906a', alpha: 0.85, t: 0.15, seed });
        for (let i = 0; i < 3; i++) {
          const ph = (sc.time * 3 + i * 0.33 + seed) % 1;
          fx.put({ kind: FX.chip, x: pr.x + (i - 1) * pr.r * 0.8, y: pr.y, up: 2 + Math.sin(ph * Math.PI) * 18, w: 9, rot: ph * 9 + i, a: i % 2 ? '#8a6a44' : '#c9a06a' });
        }
        return;
      }
      default:
        break;
    }
    // (a skill whose look is shared, or that has none, is told by its own id: a Starfall Lance flies as a lance of
    // starlight, not as an arcane bolt; a Blast Arrow as a burning arrow, not as a ball of fire)
    const id = pr.depth === 0 ? pr.spec?.id : undefined;
    if (id === 'aimed-shot' && pr.type === 'physical') {
      // Long Draw: the arrow and a long white streak of the air it tears, a glow round its head
      this.tail(fx, pr, up, 11, '#ffffff', '#fff2c8', 0.3);
      this.tail(fx, pr, up, 4, '#ffe8a0', '#ffffff', 0.5);
      fx.put({ kind: FX.glow, x: pr.x, y: pr.y, up, w: 34, a: '#fff2c8', alpha: 0.7 });
      this.thrown(sc, 'w_arrow_A', pr, up, 30 / TILE / 1.22);
      return;
    }
    if (id === 'explosive-shot' && pr.type === 'fire') {
      // Blast Arrow: an arrow with its head on fire, smoke and sparks streaming off it
      this.tail(fx, pr, up, 5, '#ffb04d', '#ffe8a0', 0.14);
      this.smokeTrail(fx, pr, up, 7, '#5a4a44', 0.35, sc.time);
      this.fireTail(fx, pr, up, 2.4, '#ff5a1e', '#ffd24a');
      fx.put({ kind: FX.glow, x: pr.x, y: pr.y, up, w: 30, a: '#ff7a2d', alpha: 0.7 });
      this.thrown(sc, 'w_arrow_A', pr, up, 28 / TILE / 1.22);
      return;
    }
    if (id === 'starfall-lance' && pr.type === 'arcane') {
      // Starfall Lance: a long shaft of starlight, white at its heart, a star at its head and glitter left behind it
      const speed = Math.hypot(pr.vx, pr.vy) || 1;
      const len = Math.min(70, pr.age * speed);
      fx.put({ kind: FX.beam, x: pr.x - (pr.vx / speed) * len * 0.5, y: pr.y - (pr.vy / speed) * len * 0.5, up, w: Math.max(8, len * shortened(pr.vx, pr.vy)), h: 12, rot, a: '#8a6aff', b: '#e8e0ff', seed });
      this.tail(fx, pr, up, 16, '#6a4ad8', '#d8d0ff', 0.35);
      fx.put({ kind: FX.glow, x: pr.x, y: pr.y, up, w: 50, a: '#a07aff', alpha: 0.75 });
      fx.put({ kind: FX.spark, x: pr.x, y: pr.y, up, w: 30, rot: sc.time * 4, a: '#ffffff', t: 0.1 });
      this.glitter(fx, pr, up, '#e8e0ff', '#a07aff', sc.time, 3);
      return;
    }
    if (id === 'evenfall' && pr.type === 'shadow') {
      // Evenfall: a blade of dusk thrown flat, a crescent of pale violet over the dark, turning nothing as it flies
      const R = 15;
      const ga = Math.atan2(pr.vy, pr.vx);
      fx.put({ kind: FX.glow, x: pr.x, y: pr.y, flat: true, w: 70, a: '#7a4ad8', alpha: 0.4 });
      fx.put({ kind: FX.slash, x: pr.x - Math.cos(ga) * R * 0.82, y: pr.y - Math.sin(ga) * R * 0.82, up: 9, flat: true, w: (R * 2) / 0.82 + 8, rot: ga, a: '#5a2aa8', t: 0.3, p1: 2.6, p2: 1 });
      fx.put({ kind: FX.slash, x: pr.x - Math.cos(ga) * R * 0.82, y: pr.y - Math.sin(ga) * R * 0.82, up: 10, flat: true, w: (R * 2) / 0.82, rot: ga, a: '#d8c0ff', t: 0.3, p1: 2.2, p2: 0 });
      this.tail(fx, pr, up - 3, 14, '#3a1a6a', '#b48cff', 0.18);
      return;
    }
    if (look === 'arrow' || look === 'piercing-arrow' || look === 'multishot' || (pr.type === 'physical' && look !== 'shard')) {
      const hot = look === 'piercing-arrow';
      this.tail(fx, pr, up, hot ? 8 : 5.5, hot ? '#ffd84d' : '#ffffff', hot ? '#fff6c8' : '#ffffff', hot ? 0.18 : 0.13);
      if (hot) fx.put({ kind: FX.glow, x: pr.x, y: pr.y, up, w: 22, a: '#ffd84d', alpha: 0.6 });
      this.thrown(sc, 'w_arrow_A', pr, up, 28 / TILE / 1.22);
      return;
    }
    switch (look) {
      case 'fireball': {
        // Fireball: a big, heavy ball of fire, a great tongue of flame streaming back off it and smoke behind that,
        // lighting the ground under it as it goes
        const R = r * 1.3;
        fx.put({ kind: FX.glow, x: pr.x, y: pr.y, flat: true, w: R * 10, a, alpha: 0.32 });
        this.smokeTrail(fx, pr, up, R * 1.6, '#4a3a38', 0.45, sc.time);
        this.fireTail(fx, pr, up, R * 1.6, a, b);
        fx.put({ kind: FX.glow, x: pr.x, y: pr.y, up, w: R * 9, a, alpha: 0.65 });
        fx.put({ kind: FX.orb, x: pr.x, y: pr.y, up, w: R * 5.4, a, b, seed });
        fx.put({ kind: FX.flame, x: pr.x, y: pr.y, up: up - R * 1.2, base: true, w: R * 4, h: R * 4.2, a, b, seed: seed + 1.3, alpha: 0.8 });
        return;
      }
      case 'arcane-bolt': {
        // Arcane Bolt: a quick dart of violet, a thin bright streak behind it; the lance that every fourth is (bigger,
        // through everything) trails a turning glint and a wider streak
        const lance = pr.r > 4.4;
        this.tail(fx, pr, up, r * (lance ? 2.6 : 1.6), a, b, lance ? 0.26 : 0.2);
        fx.put({ kind: FX.orb, x: pr.x, y: pr.y, up, w: r * (lance ? 4.6 : 3.8), a, b, seed });
        if (lance) {
          fx.put({ kind: FX.glow, x: pr.x, y: pr.y, up, w: r * 9, a, alpha: 0.6 });
          fx.put({ kind: FX.spark, x: pr.x, y: pr.y, up, w: r * 5, rot: sc.time * 6, a: b, t: 0.1 });
        }
        return;
      }
      case 'shard':
      case 'needle':
        this.tail(fx, pr, up, r * 1.8, a, b, 0.1);
        fx.put({ kind: FX.frost, x: pr.x, y: pr.y, up, w: r * 5.4, h: r * 2.2, rot, a, b, seed });
        return;
      case 'lightning':
      case 'spark':
      case 'ball':
        fx.put({ kind: FX.bolt, x: pr.x, y: pr.y, up, w: r * 8, h: r * 5, rot: sc.time * 9 + seed, a, seed: Math.floor(sc.time * 14) + pr.id });
        this.tail(fx, pr, up, r * 2, a, b, 0.14);
        fx.put({ kind: FX.orb, x: pr.x, y: pr.y, up, w: r * 4.4, a, b, seed });
        return;
      case 'shadowbolt':
        // Shadow Bolt: a hole of dark with violet at its lip, wisps of it trailing
        this.tail(fx, pr, up, r * 2.8, a, b, 0.2);
        this.smokeTrail(fx, pr, up, r * 1.4, '#2a1a3a', 0.5, sc.time);
        fx.put({ kind: FX.shadow, x: pr.x, y: pr.y, up, w: r * 5.2, a, b, seed });
        return;
      case 'chaosbolt':
        // Ruin Bolt: a great, unstable ball of chaos fire, a dark heart in it and arcs cracking round it, a ragged tail
        // of fire gone to blood behind it
        fx.put({ kind: FX.glow, x: pr.x, y: pr.y, flat: true, w: r * 10, a, alpha: 0.3 });
        this.smokeTrail(fx, pr, up, r * 1.5, '#2a1420', 0.55, sc.time);
        this.fireTail(fx, pr, up, r * 1.5, '#7a1a4a', a);
        fx.put({ kind: FX.glow, x: pr.x, y: pr.y, up, w: r * 9, a, alpha: 0.65 });
        fx.put({ kind: FX.orb, x: pr.x, y: pr.y, up, w: r * 5.6, a, b, seed });
        fx.put({ kind: FX.shadow, x: pr.x, y: pr.y, up, w: r * 2.8, a: '#ff4a7a', b, seed: seed + 2 });
        fx.put({ kind: FX.bolt, x: pr.x, y: pr.y, up, w: r * 9, h: r * 6, rot: sc.time * 7 + seed, a: b, seed: Math.floor(sc.time * 16) + pr.id });
        return;
      case 'smite':
      case 'holy-shock':
        this.tail(fx, pr, up, r * 2.2, a, b, 0.16);
        fx.put({ kind: FX.holy, x: pr.x, y: pr.y, up, w: r * 6.5, a, b, seed });
        return;
      case 'comet':
        this.tail(fx, pr, up, r * 3.4, a, b, 0.34);
        fx.put({ kind: FX.orb, x: pr.x, y: pr.y, up, w: r * 5.4, a, b, seed });
        return;
      case 'holyfire':
        // Searing Hymn: a flame of gold and white with rays of light turning behind it
        fx.put({ kind: FX.holy, x: pr.x, y: pr.y, up, w: r * 8, a, b, seed, behind: true });
        this.fireTail(fx, pr, up, r * 1.3, a, b);
        fx.put({ kind: FX.orb, x: pr.x, y: pr.y, up, w: r * 4.4, a: '#ffc23a', b: '#ffffff', seed });
        this.glitter(fx, pr, up, '#fff6c8', '#ffc23a', sc.time, 2);
        return;
      case 'starfire': {
        // Starflame: a little sun, its corona turning, a star's four points flashing over it, a tail of flame
        fx.put({ kind: FX.glow, x: pr.x, y: pr.y, flat: true, w: r * 9, a, alpha: 0.3 });
        this.fireTail(fx, pr, up, r * 1.2, a, b);
        fx.put({ kind: FX.holy, x: pr.x, y: pr.y, up, w: r * 8, a, b, seed: seed + sc.time });
        fx.put({ kind: FX.orb, x: pr.x, y: pr.y, up, w: r * 5, a, b, seed });
        fx.put({ kind: FX.spark, x: pr.x, y: pr.y, up, w: r * 6, rot: sc.time * 2, a: b, t: 0.1 });
        return;
      }
      case 'starsurge': {
        // Starbreak: a star of the night, four-pointed and turning fast, glitter streaming from it
        this.tail(fx, pr, up, r * 2.6, a, b, 0.24);
        fx.put({ kind: FX.glow, x: pr.x, y: pr.y, up, w: r * 8, a, alpha: 0.6 });
        fx.put({ kind: FX.spark, x: pr.x, y: pr.y, up, w: r * 7, rot: sc.time * 7, a, t: 0.05 });
        fx.put({ kind: FX.spark, x: pr.x, y: pr.y, up, w: r * 4.5, rot: sc.time * 7 + Math.PI / 4, a: b, t: 0.1 });
        fx.put({ kind: FX.orb, x: pr.x, y: pr.y, up, w: r * 2.6, a, b, seed });
        this.glitter(fx, pr, up, b, a, sc.time, 4);
        return;
      }
      default:
        break;
    }
    // bolts of the elements
    switch (pr.type) {
      case 'fire':
        this.fireTail(fx, pr, up, r * 1.2, a, b);
        fx.put({ kind: FX.orb, x: pr.x, y: pr.y, up, w: r * 4.8, a, b, seed });
        return;
      case 'frost':
        this.tail(fx, pr, up, r * 2, a, b, 0.14);
        fx.put({ kind: FX.frost, x: pr.x, y: pr.y, up, w: r * 6, h: r * 3, rot, a, b, seed });
        return;
      case 'poison':
        this.tail(fx, pr, up, r * 2.2, a, b, 0.16);
        fx.put({ kind: FX.poison, x: pr.x, y: pr.y, up, w: r * 5, a, b, seed });
        return;
      case 'shadow':
        this.tail(fx, pr, up, r * 2.8, a, b, 0.2);
        fx.put({ kind: FX.shadow, x: pr.x, y: pr.y, up, w: r * 5.2, a, b, seed });
        return;
      case 'holy':
        this.tail(fx, pr, up, r * 2.2, a, b, 0.16);
        fx.put({ kind: FX.holy, x: pr.x, y: pr.y, up, w: r * 6.5, a, b, seed });
        return;
      default:
        this.tail(fx, pr, up, r * 2.4, a, b, 0.16);
        fx.put({ kind: FX.orb, x: pr.x, y: pr.y, up, w: r * 4.8, a, b, seed });
        return;
    }
  }

  /* -------------------------------------------------------------- what flies off things */

  private particle(f: Fx, sc: EffectsScene): void {
    const fx = sc.fx;
    const k = f.t / f.life;
    if (f.sprite && f.sprite.includes(':')) {
      const [name, type] = f.sprite.split(':');
      // (the great spells play out over the life the rules gave them: a meteor's fall lasts as long as its wind-up)
      const len = LENGTHS[name ?? ''] ?? f.life;
      if (f.t < len) spell(fx, name!, SPELL_TONES[type ?? ''] ?? toneOf(type ?? 'physical'), f.x, f.y, f.t / len, f.size, (f.x * 0.37 + f.y * 0.61) % 13, f.a);
      return;
    }
    switch (f.kind) {
      case 'spark':
        fx.put({ kind: FX.spark, x: f.x, y: f.y, up: 11 + k * 5, w: Math.max(7, f.size * 5), a: f.color, t: k });
        break;
      case 'rubble':
      case 'coin':
      case 'shard':
        fx.put({ kind: FX.chip, x: f.x, y: f.y, up: 7 + Math.sin(Math.min(1, k * 1.2) * Math.PI) * 13, w: Math.max(4.5, f.size * 2.6), rot: f.a + f.t * 9, a: f.color, alpha: clamp(1.6 - k * 1.4, 0, 1) });
        break;
      case 'smoke':
        fx.put({ kind: FX.smoke, x: f.x, y: f.y, up: 4 + k * 15, w: f.size * (3.2 + k * 3.4), a: f.color, alpha: 0.85, t: k * 0.9, seed: f.life * 11 });
        break;
      case 'flake':
        // a snowflake coming down out of the sky, swaying on the wind, fading as it settles
        fx.put({ kind: FX.flake, x: f.x, y: f.y, up: 3 + (1 - k) * 36, w: 3 + f.size * 2.8, a: f.color, alpha: clamp(Math.min(k * 6, (1 - k) * 3.5), 0, 0.95), seed: f.a, t: k });
        f.vx += Math.sin(f.t * 1.6 + f.a) * 0.32;
        break;
      case 'leaf':
        fx.put({ kind: FX.leaf, x: f.x, y: f.y, up: 6 + (1 - k) * 14, w: 7, h: 4, rot: f.a + f.t * 4, a: f.color, alpha: clamp(1 - k * 1.2, 0, 0.95) });
        f.vx += Math.sin(f.t * 3 + f.a) * 0.6;
        break;
      case 'ember':
        if (f.sprite === 'meteor') {
          // the falling meteor: burning rock and its long tail (the rules fake its height on the ground)
          const rot = Math.atan2(-f.vy, f.vx);
          fx.put({ kind: FX.glow, x: f.x, y: f.y, up: 10, w: 64, a: '#ff7a3d', alpha: 0.8 });
          fx.put({ kind: FX.flame, x: f.x, y: f.y, up: 10, base: true, w: 34, h: 74, rot: rot + Math.PI / 2, a: '#f4461f', b: '#ffb02e', seed: f.life * 7 });
          fx.put({ kind: FX.ball, x: f.x, y: f.y, up: 10, w: 26, a: '#4a342c', b: '#ff9a3d' });
        } else fx.put({ kind: FX.spark, x: f.x, y: f.y, up: 9 + k * 12, w: 7, a: f.color, t: k });
        break;
      case 'ring':
        fx.put({ kind: FX.ring, x: f.x, y: f.y, flat: true, w: Math.max(4, f.size * 2.04), a: f.color, t: k, seed: f.size });
        break;
      case 'burst':
        fx.put({ kind: FX.glow, x: f.x, y: f.y, up: 11, w: f.size * (3.2 + k * 1.2), a: f.color, alpha: clamp(1 - k, 0, 1) });
        break;
      case 'glow':
        fx.put({ kind: FX.glow, x: f.x, y: f.y, up: 11, w: f.size * 3, a: f.color, alpha: clamp(Math.sin(k * Math.PI), 0, 1) * 0.9 });
        break;
      case 'slash': {
        const R = f.size + 3;
        fx.put({ kind: FX.slash, x: f.x, y: f.y, up: 11, flat: true, w: (R * 2) / 0.82, rot: f.a, a: f.color, t: k, p1: f.a2, p2: f.r2 ? 1 : 0 });
        break;
      }
      case 'zap': {
        const dx = f.x2 - f.x;
        const dy = f.y2 - f.y;
        if (f.sprite === 'thorn') {
          // a lash of living thorns: a green whip cracking out to them, leaves torn off where it lands
          const len = Math.hypot(dx, dy) * shortened(dx, dy);
          const lash = Math.min(1, k * 3);
          fx.put({ kind: FX.beam, x: f.x + (dx * lash) / 2, y: f.y + (dy * lash) / 2, up: 12, w: Math.max(10, len * lash), h: 7, rot: screenAngle(dx, dy), a: '#2e7a2a', b: f.color, alpha: clamp(1.3 - k * 1.3, 0, 1), seed: f.x * 0.1 });
          for (let i = 0; i < 3; i++) {
            const ang = (i / 3) * TAU + f.x * 0.37;
            const out = 4 + k * 16;
            fx.put({ kind: FX.leaf, x: f.x2 + Math.cos(ang) * out, y: f.y2 + Math.sin(ang) * out * 0.7, up: 10 + Math.sin(k * Math.PI) * 9, w: 7, h: 4, rot: ang + k * 8, a: i % 2 ? '#7ac85a' : '#c8f07a', alpha: clamp(1.4 - k * 1.4, 0, 1) });
          }
          break;
        }
        const seed = Math.floor(f.t * 24) + f.x * 0.1;
        fx.put({ kind: FX.bolt, x: (f.x + f.x2) / 2, y: (f.y + f.y2) / 2, up: 12, w: Math.max(14, Math.hypot(dx, dy) * shortened(dx, dy) * 1.12), h: 26, rot: screenAngle(dx, dy), a: f.color, alpha: clamp(1.25 - k, 0, 1), seed });
        break;
      }
      case 'beam':
        if (f.sprite === 'arrow') {
          // a falling arrow of the volley
          const h = 60 * (1 - k);
          fx.put({ kind: FX.trail, x: f.x, y: f.y, up: h + 18, w: 30, h: 5, rot: -Math.PI / 2, a: '#ffffff', b: '#f5e6c8', alpha: 0.8 });
          sc.cast.thrown('w_arrow_A', f.x, f.y, (h + 3) / TILE, 0, 26 / TILE / 1.22, Math.PI / 2);
        } else {
          // a shaft of light from the sky
          const wide = Math.max(8, f.size * 1.8);
          fx.put({ kind: FX.shaft, x: f.x, y: f.y, base: true, w: wide * 2, h: 170, a: f.color, t: k, seed: f.life * 5 });
          fx.put({ kind: FX.glow, x: f.x, y: f.y, flat: true, w: wide * 5, a: f.color, alpha: clamp(1 - k, 0, 1) });
        }
        break;
      case 'rift': {
        const s = f.size * Math.sin(Math.min(1, k * 1.5) * Math.PI * 0.5);
        fx.put({ kind: FX.rift, x: f.x, y: f.y, flat: true, w: Math.max(4, s * 2.2), a: '#ff3fd2', b: '#22e4ff', seed: f.life * 3, alpha: clamp((1 - k) * 4, 0, 1) });
        break;
      }
      case 'ghost':
        fx.put({ kind: FX.ghost, x: f.x, y: f.y, up: 12 + k * 26, w: 22, h: 26, a: '#dfe8ff', alpha: clamp(0.75 - k * 0.75, 0, 1) });
        break;
      default:
        break;
    }
  }
}

/** The beam over an item on the ground. */
/** The light of a thing a quest asks for, where it lies. */
const QUEST_GOLD = '#ffe066';
const BEAM: Record<string, string> = { common: '#e8e4d8', uncommon: '#7fe06a', rare: '#6fb4ff', epic: '#c58bff', legendary: '#ffae42' };

/** A friendly look's own colors (the rest take their damage type's). */
const LOOK_TONES: Record<string, Tone> = {
  'arcane-bolt': { a: '#a05aff', b: '#f4e4ff' },
  lightning: { a: '#6ab8ff', b: '#ffffff' },
  fireball: { a: '#ff5a1e', b: '#ffd24a' },
  ember: { a: '#ff7a2d', b: '#ffe07a' },
  spark: { a: '#8fd4ff', b: '#ffffff' },
  shard: { a: '#5ac0f0', b: '#e8fbff' },
  needle: { a: '#5ab82e', b: '#e8ffd8' },
  firebolt: { a: '#ff5a1e', b: '#ffd24a' },
  icelance: { a: '#4ab8f0', b: '#f0fcff' },
  ball: { a: '#4a9aff', b: '#ffffff' },
  comet: { a: '#4ab8ff', b: '#ffffff' },
  smite: { a: '#ffc23a', b: '#fffbe0' },
  'holy-shock': { a: '#ffd24a', b: '#ffffff' },
  holyfire: { a: '#ffb02e', b: '#fffbe0' },
  judgment: { a: '#ffc23a', b: '#fff6c8' },
  shield: { a: '#ffc23a', b: '#ffffff' },
  shadowbolt: { a: '#7a3ad8', b: '#e0c8ff' },
  chaosbolt: { a: '#d02a5a', b: '#ffc080' },
  wrath: { a: '#5ac83a', b: '#f0ffe0' },
  starfire: { a: '#ff9a2a', b: '#fff2c0' },
  starsurge: { a: '#c06aff', b: '#ffe8ff' },
};
