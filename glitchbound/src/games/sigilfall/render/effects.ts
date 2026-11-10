import { clamp, hash2, TAU } from '../core/math';
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
import type { Enemy, Fx, Projectile, Telegraph } from '../sim/types';
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

/** How long a named spell effect plays, in seconds. */
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
  /** Whether a spot is near enough to the view to matter. */
  near(x: number, y: number): boolean;
}

/** An effect by name, somewhere on its way through its life (`u`, 0 to 1): The Vigil's spells use them too. */
export function spell(fx: Fx3D, name: string, tone: Tone, x: number, y: number, u: number, size: number, seed: number): void {
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
      fx.put({ kind: FX.field, x, y, flat: true, w: R * 2, a: mixHex(colorOf(a), 0, 0.5), b: a, t: 0.34 * (1 - u), seed, p1: FIELD.fire });
      fx.put({ kind: FX.blast, x, y, up: R * 0.42, w: R * 2.7, a, b, t: u, seed });
      fx.put({ kind: FX.ring, x, y, flat: true, w: R * 2.3, a: b, t: u, seed });
      if (u > 0.3) fx.put({ kind: FX.smoke, x, y, up: R * 0.5 + u * 14, w: R * (1.6 + u * 1.2), a: '#3a3440', alpha: 0.5, t: u, seed });
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
    for (const f of w.fields) if (sc.near(f.x, f.y)) this.field(f, sc);
    for (const t of w.telegraphs) if (sc.near(t.x, t.y) || t.shape === 'line') this.telegraph(t, fx);
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
    const [look, a, b] = FIELDS[f.look] ?? FIELDS.rift!;
    const life = clamp(f.t / f.dur, 0, 1);
    const seed = f.id * 0.31;
    fx.put({ kind: FX.field, x: f.x, y: f.y, flat: true, w: f.r * 2, a, b, t: life, seed, p1: look, p2: f.hostile ? 1 : 0 });
    const fade = clamp(life * 3, 0, 1);
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

  private telegraph(t: Telegraph, fx: Fx3D): void {
    if (t.t >= t.dur && t.linger <= 0) return;
    const k = clamp(t.t / t.dur, 0, 1);
    const a = t.tone === 'rift' ? '#ff3fd2' : t.tone === 'player' ? '#ffb04d' : '#ff3b3b';
    const lingering = t.t >= t.dur;
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

  /** The wind-ups of ordinary foes, read from their state: arcs, slam circles, aim lines, charge lanes. */
  private windups(w: World, fx: Fx3D): void {
    const red = '#ff3b3b';
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
    for (const f of w.fires) {
      const lit = w.fireLit(f);
      if (lit && sc.near(f.x, f.y)) this.blaze(fx, f, lit, sc.land?.roofAt(f.x / TILE, f.y / TILE) ?? [], sc.time, tone);
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
    fx.put({ kind: FX.mark, x: pr.x, y: pr.y, flat: true, w: r * 3.2 + 4, a: '#ff3b3b' });
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
    if (look === 'arrow' || look === 'piercing-arrow' || look === 'multishot' || (pr.type === 'physical' && look !== 'shard')) {
      const hot = look === 'piercing-arrow';
      this.tail(fx, pr, up, hot ? 8 : 5.5, hot ? '#ffd84d' : '#ffffff', hot ? '#fff6c8' : '#ffffff', hot ? 0.18 : 0.13);
      if (hot) fx.put({ kind: FX.glow, x: pr.x, y: pr.y, up, w: 22, a: '#ffd84d', alpha: 0.6 });
      this.thrown(sc, 'w_arrow_A', pr, up, 28 / TILE / 1.22);
      return;
    }
    switch (look) {
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
      case 'chaosbolt':
        this.tail(fx, pr, up, r * 2.8, a, b, 0.2);
        fx.put({ kind: FX.shadow, x: pr.x, y: pr.y, up, w: r * 5.2, a, b, seed });
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
        this.fireTail(fx, pr, up, r * 1.2, a, b);
        fx.put({ kind: FX.orb, x: pr.x, y: pr.y, up, w: r * 4.8, a, b, seed });
        return;
      case 'starfire':
      case 'starsurge':
        this.tail(fx, pr, up, r * 2.4, a, b, 0.2);
        fx.put({ kind: FX.orb, x: pr.x, y: pr.y, up, w: r * 4.8, a, b, seed });
        fx.put({ kind: FX.spark, x: pr.x, y: pr.y - 1, up: up + r * 1.4, w: r * 3.4, a: b, t: 0.1 });
        for (let i = 0; i < 2; i++) {
          const ph = (sc.time * 3 + i * 0.5 + seed) % 1;
          const speed = Math.hypot(pr.vx, pr.vy) || 1;
          fx.put({ kind: FX.spark, x: pr.x - (pr.vx / speed) * (8 + ph * 16) + (i ? 4 : -4), y: pr.y - (pr.vy / speed) * (8 + ph * 16), up, w: 6, a, t: ph });
        }
        return;
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
      const len = LENGTHS[name ?? ''] ?? 0.5;
      if (f.t < len) spell(fx, name!, toneOf(type ?? 'physical'), f.x, f.y, f.t / len, f.size, (f.x * 0.37 + f.y * 0.61) % 13);
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
  holyfire: { a: '#ff8a2d', b: '#fff2a0' },
  judgment: { a: '#ffc23a', b: '#fff6c8' },
  shield: { a: '#ffc23a', b: '#ffffff' },
  shadowbolt: { a: '#7a3ad8', b: '#e0c8ff' },
  chaosbolt: { a: '#4ab82e', b: '#eaffa0' },
  wrath: { a: '#5ac83a', b: '#f0ffe0' },
  starfire: { a: '#a878ff', b: '#fff6d0' },
  starsurge: { a: '#ff6ac8', b: '#ffffff' },
};
