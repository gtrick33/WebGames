import { TILE } from '../sim/map';
import type { Cast } from '../render3d/cast';
import { FIELD, FX, type Fx3D } from '../render3d/fx3d';
import { screenAngle, shortened } from './effects';

/**
 * The Vigil's spells, each with a look of its own (the owner, 2026-11-26: "we need separate spells visual effects for
 * every spell - currently hunter uses meteors, green versions of the fireball, etc, every class should have unique
 * looking spell", and "evolves should completely change the visual effect of the spell they overhaul into something
 * much better, glorious and greater looking"). Before, a spell was drawn by its element: every fire spell was the same
 * fireball whatever class cast it. Now every spell has its own two colors, its own shape for what flies or falls, and
 * its own particle; and an evolution has a different look again, with its grandeur on top (a halo, light from above,
 * motes about it). All of it is made of the shader effects and models the game already has (render3d/fx3d.ts, the
 * weapon models): nothing new was bought or drawn.
 *
 * What flies is small and what lands is big ("scale down the spell sizes ... the effects should be bigger, but the
 * projectiles not"): a shot is drawn at about its own hit size, and what bursts, rings or falls a little past its reach.
 */

/** The particle a spell is made of: it trails behind what flies, rims what rings out and sprinkles what lies. */
export type Motif = 'flame' | 'frost' | 'bolt' | 'poison' | 'shadow' | 'holy' | 'water' | 'leaf' | 'chip' | 'flake' | 'ghost' | 'smoke' | 'spark' | 'bubble' | 'web' | 'spill' | 'rune' | 'impact';

/**
 * What it is, when it is a thing: what flies (an ember, an arrow, a skull), what falls (a star, arrows, a sword, a
 * column of light, a gate), what circles (a hawk, a halo, a shade), or nothing in particular (the area kinds).
 */
export type Body =
  | 'ember'
  | 'comet'
  | 'shard'
  | 'spark'
  | 'arrow'
  | 'spear'
  | 'axe'
  | 'hammer'
  | 'shield'
  | 'skull'
  | 'thorn'
  | 'lash'
  | 'ball'
  | 'mote'
  | 'star'
  | 'arrows'
  | 'blade'
  | 'brand'
  | 'column'
  | 'portal'
  | 'moon'
  | 'hawk'
  | 'halo'
  | 'shade'
  | 'chain'
  | 'vine'
  | 'none';

export interface Look {
  /** Its body's color and the light at its heart. */
  a: string;
  b: string;
  motif: Motif;
  body: Body;
  /** What it lays on the ground, where it lies there (render3d/fx3d.ts's FIELD). */
  ground?: keyof typeof FIELD;
  /** An evolution's grandeur: a halo, light from above, motes about it, and what lands lands bigger. */
  grand?: boolean;
}

const L = (a: string, b: string, motif: Motif, body: Body = 'none', ground?: keyof typeof FIELD): Look => ({ a, b, motif, body, ground });
const G = (a: string, b: string, motif: Motif, body: Body = 'none', ground?: keyof typeof FIELD): Look => ({ a, b, motif, body, ground, grand: true });

/** Every spell's own look, by its id (vigil/kit.ts). */
export const LOOKS: Record<string, Look> = {
  // the mage: fire, frost, storm and the arcane, each of its own hue
  'ember-bolt': L('#ff5a1e', '#ffd24a', 'flame', 'ember'),
  'frost-ring': L('#4ab8ff', '#e0f8ff', 'frost'),
  'chain-spark': L('#6ab8ff', '#ffffff', 'bolt', 'spark'),
  'orbit-motes': L('#a05aff', '#f4e4ff', 'rune', 'mote'),
  meteor: L('#ff8a2e', '#ffe08a', 'smoke', 'star'),
  'ash-field': L('#e84a10', '#ffa020', 'flame', 'none', 'fire'),
  'ice-javelin': L('#7fd8ff', '#f0fcff', 'flake', 'spear'),
  'ball-lightning': L('#5aa0ff', '#d8ecff', 'bolt', 'ball'),
  'arcane-ward': L('#c58cff', '#f8eaff', 'rune'),
  'gravity-well': L('#7a3aff', '#d0b0ff', 'ghost', 'portal', 'rift'),
  // the warrior: steel, iron and blood
  'reaping-arc': L('#f2ece0', '#ffffff', 'chip'),
  'thrown-axe': L('#d8dce6', '#ffffff', 'chip', 'axe'),
  'war-stomp': L('#d8a860', '#fff0c8', 'smoke'),
  'steel-tempest': L('#e8e8f4', '#fbfbff', 'chip', 'blade', 'lightning'),
  'giants-blade': L('#c8d0e0', '#f8faff', 'impact', 'blade'),
  'blood-banner': L('#c8324a', '#ff9a9a', 'spill', 'none', 'poison'),
  'war-charge': L('#e8c8a0', '#fff4e0', 'spark'),
  'shield-wall': L('#9ab8e8', '#e8f0ff', 'rune'),
  'ground-breaker': L('#b8864a', '#ffe0a0', 'web'),
  'thousand-cuts': L('#ffb0a0', '#fff6f4', 'impact'),
  // the ranger: wood, feather, venom and the hunt's arrows
  'seeking-arrow': L('#d8ffb0', '#ffffff', 'leaf', 'arrow'),
  'arrow-storm': L('#e8e0a8', '#fff8e0', 'chip', 'arrows'),
  'wolf-pack': L('#c8c8d8', '#f4f4ff', 'smoke'),
  snapjaw: L('#9a8a68', '#e8d8b0', 'chip', 'none', 'arrows'),
  'long-shot': L('#f6f2c8', '#fffff4', 'spark', 'arrow'),
  'hawk-wheel': L('#ffe39a', '#fffbe8', 'spark', 'hawk'),
  'poison-trap': L('#9ae85a', '#e8ffb0', 'poison'),
  tumble: L('#c0e890', '#fafff0', 'leaf'),
  'viper-arrow': L('#b8f06a', '#f0ffd0', 'poison', 'vine'),
  'blast-arrow': L('#ffb45c', '#fff0c0', 'flame', 'arrows'),
  // the priest: white-gold light, and the shadow it keeps
  'lance-of-dawn': L('#fff0a8', '#ffffff', 'holy'),
  'radiant-wave': L('#ffe9a0', '#fffbe8', 'rune'),
  'mending-light': L('#b8ffb8', '#f0fff0', 'leaf'),
  'halo-ring': L('#fff2b0', '#fffef4', 'holy', 'halo'),
  sunfall: L('#fff4c0', '#ffffff', 'spark', 'column'),
  'hallowed-ground': L('#ffe48a', '#fff8d8', 'spark', 'none', 'holy'),
  'ward-of-grace': L('#fff6d8', '#fffefa', 'bubble'),
  'searing-hymn': L('#fff0c8', '#fffcf2', 'flame'),
  'thought-lash': L('#c88aff', '#f4e0ff', 'shadow', 'lash'),
  'seraph-lance': L('#fffae0', '#fffff8', 'flake'),
  // the paladin: the sun, gold and hammered steel
  'thrown-hammer': L('#ffd060', '#fff8e0', 'holy', 'hammer'),
  'judging-light': L('#ffe070', '#fffbe0', 'impact', 'brand'),
  'sun-ring': L('#ffc76a', '#fff0b0', 'flame', 'none', 'fire'),
  'blessed-ground': L('#ffe9b8', '#fffdf0', 'rune', 'none', 'holy'),
  'dawn-swing': L('#fff2c8', '#fffff0', 'holy'),
  'aegis-pulse': L('#ffd870', '#fffae0', 'bubble'),
  'thrown-aegis': L('#e8c860', '#fffcf0', 'impact', 'shield'),
  bulwark: L('#ffe6a0', '#fffef0', 'impact'),
  'lance-of-noon': L('#fff8c8', '#fffffa', 'spark'),
  'halting-word': L('#ffefb8', '#fffdf4', 'flake'),
  // the warlock: fel green, violet and the pit's fire
  soulfire: L('#8bff6a', '#e8ffd0', 'shadow', 'skull'),
  'pit-imps': L('#ff7a3d', '#ffd8b0', 'smoke'),
  'plague-rain': L('#9ae84a', '#e8ffb8', 'flame', 'ember'),
  'soul-chain': L('#b070ff', '#f0d8ff', 'ghost', 'chain'),
  'doom-ring': L('#a060ff', '#e8d0ff', 'shadow'),
  'black-star': L('#b080ff', '#f8e8ff', 'ghost', 'portal'),
  'drain-life': L('#d040a0', '#ffc0e8', 'spill'),
  hellbrand: L('#ff6a2e', '#ffd0a0', 'flame'),
  'demonic-step': L('#7a3ad8', '#d8b8ff', 'ghost'),
  'rotting-curse': L('#7ab02e', '#d8ff8a', 'poison', 'none', 'poison'),
  // the druid: leaf, root, the beasts and the moon
  'thorn-volley': L('#a8e85a', '#f0ffd0', 'leaf', 'thorn'),
  'bear-swipe': L('#e8d0a8', '#fff8e8', 'chip'),
  'spirit-stag': L('#c8ffb0', '#f8fff4', 'spark'),
  moonbeams: L('#cfe0ff', '#ffffff', 'spark', 'moon'),
  'living-roots': L('#7ad65a', '#d8ffb0', 'web', 'none', 'nature'),
  'verdant-pulse': L('#9af08a', '#f0fff0', 'holy'),
  moonburn: L('#9ab8ff', '#eef4ff', 'water'),
  'briar-burst': L('#8ad65a', '#e0ffc0', 'flake'),
  thornhide: L('#a8c84a', '#f0ffc8', 'impact'),
  'wild-dash': L('#b0f0a0', '#fcfffa', 'leaf'),
  // the Gloamknight: dusk violet and old blood
  'gloam-sweep': L('#c8a8ff', '#fdfaff', 'shadow'),
  'circling-shades': L('#9a6ae0', '#e0c8ff', 'ghost', 'shade'),
  'dusk-toll': L('#b48cff', '#f0e0ff', 'rune'),
  duskblade: L('#8a5ad0', '#e0c8ff', 'shadow', 'blade'),
  'gloom-pool': L('#7a52b0', '#d0b8f0', 'ghost', 'none', 'shadow'),
  'blood-remembers': L('#c0344e', '#ffb0c0', 'spill'),
  'hollow-ward': L('#a0284a', '#ffc0d0', 'bubble'),
  'shadow-lunge': L('#8a4ad8', '#d8c0ff', 'smoke'),
  'mourning-arc': L('#a878e0', '#fcf8ff', 'spark'),
  'night-tether': L('#b890ff', '#f8f0ff', 'chip', 'chain'),
};

/** Every evolution's look: another shape, other colors, and its grandeur. */
export const EVOLVED: Record<string, Look> = {
  'ember-bolt': G('#ff2a6a', '#fff0a0', 'spark', 'comet'),
  'frost-ring': G('#9ff0ff', '#ffffff', 'flake'),
  'ice-javelin': G('#3a8cff', '#dff6ff', 'frost', 'spear'),
  'ball-lightning': G('#c8a0ff', '#ffffff', 'spark', 'ball'),
  'reaping-arc': G('#ff3a3a', '#ffd0c0', 'impact', 'blade'),
  'thrown-axe': G('#ff6a3a', '#ffe0b0', 'flame', 'axe'),
  'shield-wall': G('#6a8ac8', '#ffe39a', 'impact'),
  'thousand-cuts': G('#d81e2e', '#ffb0b0', 'flame'),
  'seeking-arrow': G('#ffe36a', '#ffffff', 'spark', 'arrow'),
  'wolf-pack': G('#8ad8ff', '#ffffff', 'spark'),
  'poison-trap': G('#5ad8a0', '#e0fff0', 'smoke'),
  'blast-arrow': G('#ffd257', '#ffffff', 'spark', 'arrows'),
  'lance-of-dawn': G('#ffd84d', '#fffdf0', 'spark'),
  'mending-light': G('#ffb86a', '#fff6d8', 'holy'),
  'searing-hymn': G('#ffcf6a', '#fffff8', 'spark'),
  'thought-lash': G('#5a1a9a', '#e0b0ff', 'ghost', 'skull'),
  'thrown-hammer': G('#ffb02e', '#fff6c8', 'impact', 'hammer'),
  'dawn-swing': G('#ffb040', '#fff0c0', 'flame'),
  bulwark: G('#ffcc40', '#ffffff', 'holy'),
  'lance-of-noon': G('#ffa82e', '#fffff0', 'impact'),
  soulfire: G('#c8ff3a', '#ffffff', 'flame', 'comet'),
  'pit-imps': G('#ff3a1e', '#ffe08a', 'impact'),
  hellbrand: G('#ff2e2e', '#ffe08a', 'impact'),
  'rotting-curse': G('#4a6a2e', '#c8b0ff', 'smoke', 'none', 'shadow'),
  'thorn-volley': G('#5ad84a', '#ffe0a0', 'chip', 'thorn'),
  moonbeams: G('#a0b8ff', '#fffbe0', 'holy', 'moon'),
  'briar-burst': G('#3ab84a', '#d0ffa0', 'web'),
  thornhide: G('#a8784a', '#ffe8c0', 'chip'),
  'gloam-sweep': G('#7a1e3a', '#ffb0c8', 'ghost'),
  'circling-shades': G('#5a3aa0', '#ffd0ff', 'shadow', 'shade'),
  'hollow-ward': G('#3a2a6a', '#c8b0ff', 'ghost'),
  'mourning-arc': G('#4a1a6a', '#ff80c0', 'spill'),
};

const PLAIN: Look = L('#e0d8c8', '#ffffff', 'impact');

/** A spell's look now: its evolution's, once it has evolved. */
export const lookOf = (spell: string | undefined, evolved = false): Look => (spell ? ((evolved ? EVOLVED[spell] : undefined) ?? LOOKS[spell]) : undefined) ?? PLAIN;

const TAU = Math.PI * 2;
const spot = (x: number, y: number): number => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
};

/** One of a look's particles. `w` its size; `t` how far through its life it is; `rot` the way it points. */
export function motif(fx: Fx3D, m: Motif, x: number, y: number, up: number, w: number, a: string, b: string, seed: number, t = 0.5, alpha = 1, rot = 0): void {
  switch (m) {
    case 'flame':
      fx.put({ kind: FX.flame, x, y, base: up < 2, up: up < 2 ? undefined : up, w, h: w * 1.4, a, b, seed, alpha });
      return;
    case 'frost':
      fx.put({ kind: FX.frost, x, y, up, w, h: w * 0.5, rot, a, b, t, seed, alpha });
      return;
    case 'bolt':
      fx.put({ kind: FX.bolt, x, y, up, w: w * 1.2, h: w * 0.8, rot: seed * 3, a, seed: seed + Math.floor(x * 0.3), alpha });
      return;
    case 'poison':
      fx.put({ kind: FX.poison, x, y, up, w, a, b, seed, alpha });
      return;
    case 'shadow':
      fx.put({ kind: FX.shadow, x, y, up, w, a, b, seed, alpha });
      return;
    case 'holy':
      fx.put({ kind: FX.holy, x, y, up, w, a, b, seed, alpha });
      return;
    case 'water':
      fx.put({ kind: FX.water, x, y, up, w, rot, a, b, seed, p1: 0.5, alpha });
      return;
    case 'leaf':
      fx.put({ kind: FX.leaf, x, y, up, w: w * 0.7, h: w * 0.7, rot: rot + seed, a, b, seed, alpha });
      return;
    case 'chip':
      fx.put({ kind: FX.chip, x, y, up, w: w * 0.6, h: w * 0.6, rot: rot + seed * 2, a, b, seed, alpha });
      return;
    case 'flake':
      fx.put({ kind: FX.flake, x, y, up, w: w * 0.8, h: w * 0.8, rot: rot + seed, a, b, seed, alpha });
      return;
    case 'ghost':
      fx.put({ kind: FX.ghost, x, y, up, w, h: w * 1.2, a, b, seed, alpha: alpha * 0.85 });
      return;
    case 'smoke':
      fx.put({ kind: FX.smoke, x, y, up, w, a, alpha: alpha * 0.6, t, seed });
      return;
    case 'spark':
      fx.put({ kind: FX.spark, x, y, up, w: w * 0.8, a: b, t: t * 0.6, alpha });
      return;
    case 'bubble':
      fx.put({ kind: FX.bubble, x, y, up, w: w * 0.8, a, alpha: alpha * 0.6 });
      return;
    case 'web':
      fx.put({ kind: FX.web, x, y, flat: true, w: w * 1.4, a, b, seed, alpha });
      return;
    case 'spill':
      fx.put({ kind: FX.spill, x, y, flat: true, w: w * 1.2, a, b, seed, alpha });
      return;
    case 'rune':
      fx.put({ kind: FX.rune, x, y, flat: true, w: w * 1.3, a, b, t: 0.5, seed, alpha });
      return;
    case 'impact':
      fx.put({ kind: FX.impact, x, y, up, w, a, b, t, seed, alpha });
      return;
  }
}

/** An evolution's grandeur, about a point: a halo, light from above and motes turning about it. */
export function grandeur(fx: Fx3D, look: Look, x: number, y: number, up: number, size: number, time: number, seed: number, alpha = 1): void {
  fx.put({ kind: FX.glow, x, y, up, w: size * 2.6, a: look.a, alpha: 0.45 * alpha, behind: true });
  fx.put({ kind: FX.glow, x, y, up, w: size * 1.3, a: look.b, alpha: 0.5 * alpha });
  for (let i = 0; i < 3; i++) {
    const a = time * 5 + (i / 3) * TAU + seed;
    motif(fx, 'spark', x + Math.cos(a) * size * 0.75, y + Math.sin(a) * size * 0.45, up + Math.sin(a) * 2, size * 0.45, look.a, look.b, seed + i, 0.3, alpha);
  }
}

/** The shot's head at a size of its own: what flies is drawn about as big as what it hits. */
export function flyer(fx: Fx3D, cast: Cast, look: Look, x: number, y: number, vx: number, vy: number, r: number, spin: number, time: number, seed: number): void {
  const up = 11;
  const speed = Math.hypot(vx, vy);
  const rot = screenAngle(vx, vy);
  const { a, b } = look;
  const size = Math.max(6, r * 2.4);
  // the air it leaves behind, thin
  if (speed > 1) {
    const len = Math.min(42, speed * 0.12);
    fx.put({ kind: FX.trail, x: x - (vx / speed) * len * 0.5, y: y - (vy / speed) * len * 0.5, up, w: len * shortened(vx, vy), h: size * (look.grand ? 0.9 : 0.6), rot, a, b, seed });
    // and its particle, falling behind
    motif(fx, look.motif, x - (vx / speed) * len * 0.8, y - (vy / speed) * len * 0.8, up, size * 0.8, a, b, seed, (time * 3 + seed) % 1, 0.8, rot);
  }
  switch (look.body) {
    case 'arrow':
      cast.thrown('w_arrow_A', x, y, up / TILE, Math.atan2(vx, vy), 22 / TILE / 1.22);
      break;
    case 'spear':
      cast.thrown('w_spear_A', x, y, up / TILE, Math.atan2(vx, vy), 34 / TILE / 3.14, Math.PI / 2);
      break;
    case 'axe':
    case 'hammer':
    case 'shield':
      cast.thrown(look.body === 'axe' ? 'w_axe_A' : look.body === 'hammer' ? 'w_hammer_A' : 'w_shield_round', x, y, (up - 2) / TILE, Math.atan2(vx, vy), (r * 2.6) / TILE / 1.16, spin);
      break;
    case 'ember':
      if (speed > 1) fx.put({ kind: FX.flame, x, y, up, base: false, w: size * 1.3, h: size * 1.6, rot: rot + Math.PI / 2, a, b, seed });
      fx.put({ kind: FX.orb, x, y, up, w: size * 1.1, a, b, seed });
      break;
    case 'comet':
      fx.put({ kind: FX.trail, x: x - vx * 0.08, y: y - vy * 0.08, up, w: Math.max(14, speed * 0.16) * shortened(vx, vy), h: size * 1.2, rot, a: b, b: a, seed });
      fx.put({ kind: FX.orb, x, y, up, w: size * 1.3, a, b, seed });
      break;
    case 'shard':
      fx.put({ kind: FX.frost, x, y, up, w: size * 1.6, h: size * 0.8, rot, a, b, seed });
      break;
    case 'spark':
      fx.put({ kind: FX.bolt, x, y, up, w: size * 1.6, h: size, rot: seed * 3, a, seed: seed + Math.floor(time * 20) });
      fx.put({ kind: FX.orb, x, y, up, w: size * 0.8, a, b, seed });
      break;
    case 'ball':
      // a ball of lightning: a small hard core, the sparks round it doing the rest
      fx.put({ kind: FX.orb, x, y, up, w: size, a, b, seed });
      fx.put({ kind: FX.bolt, x, y, up, w: size * 1.8, h: size * 1.3, rot: time * 9 + seed, a: b, seed: seed + Math.floor(time * 24) });
      break;
    case 'skull':
      fx.put({ kind: FX.ghost, x, y, up, w: size * 1.3, h: size * 1.5, a, b, seed });
      fx.put({ kind: FX.shadow, x, y, up, w: size * 1.1, a, b, seed });
      break;
    case 'thorn':
      fx.put({ kind: FX.leaf, x, y, up, w: size, h: size * 0.6, rot, a, b, seed });
      fx.put({ kind: FX.chip, x, y, up, w: size * 0.5, h: size * 0.5, rot: rot + 0.6, a: b, b: a, seed });
      break;
    case 'lash':
      fx.put({ kind: FX.bolt, x, y, up, w: size * 1.8, h: size * 0.7, rot, a, seed: seed + Math.floor(time * 18) });
      fx.put({ kind: FX.shadow, x, y, up, w: size, a, b, seed });
      break;
    case 'mote':
      fx.put({ kind: FX.holy, x, y, up, w: size * 1.3, a, b, seed });
      break;
    default:
      fx.put({ kind: FX.orb, x, y, up, w: size, a, b, seed });
  }
  if (look.grand) {
    // an evolved shot burns a second, longer streak of its heart's color, and is crowned
    if (speed > 1) {
      const len = Math.min(70, speed * 0.22);
      fx.put({ kind: FX.trail, x: x - (vx / speed) * len * 0.5, y: y - (vy / speed) * len * 0.5, up, w: len * shortened(vx, vy), h: size * 1.4, rot, a: b, b: a, seed: seed + 1, alpha: 0.8 });
    }
    grandeur(fx, look, x, y, up, size * 1.2, time, seed);
  }
}

/** Particles round the rim of a ring, `R` across, each the look's own. */
export function rim(fx: Fx3D, look: Look, x: number, y: number, R: number, u: number, seed: number, n: number, w: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + seed;
    motif(fx, look.motif, x + Math.cos(a) * R, y + Math.sin(a) * R, 8, w, look.a, look.b, seed + i, u, 1 - u * 0.7, a);
  }
}

/** Particles strewn over ground `r` across, the same ones from frame to frame. */
export function strew(fx: Fx3D, look: Look, x: number, y: number, r: number, n: number, seed: number, time: number, alpha: number): void {
  for (let i = 0; i < n; i++) {
    const ang = spot(i, seed) * TAU;
    const d = Math.sqrt(spot(seed, i)) * r * 0.8;
    const bob = (time * 0.8 + spot(i * 3, seed)) % 1;
    motif(fx, look.motif, x + Math.cos(ang) * d, y + Math.sin(ang) * d, 4 + bob * 10, 11, look.a, look.b, seed + i, bob, alpha * (1 - bob * 0.5), ang);
  }
}

/** A spell's look as a picture's colors for the lobby and the cards: its body over its heart. */
export const lookSwatch = (spell: string, evolved = false): [string, string] => {
  const l = lookOf(spell, evolved);
  return [l.a, l.b];
};
