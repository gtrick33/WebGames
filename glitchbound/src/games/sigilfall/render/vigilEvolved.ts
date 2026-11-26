import { TILE } from '../sim/map';
import type { Cast } from '../render3d/cast';
import { FIELD, FX, type Fx3D } from '../render3d/fx3d';
import type { Fx } from '../vigil/sim';
import { screenAngle, shortened } from './effects';
import { grandeur, motif, type Look, type Motif } from './vigilLooks';

/**
 * The Vigil's evolutions, each its own form (the owner, 2026-11-26: "evolves ... should completely change the visual
 * effect of the spell they overhaul into something much better, glorious and greater looking", and then "Yes, bolder
 * evolutions"). The first pass gave each its own colors and a halo; this gives each a different shape from its spell:
 * a phoenix with wings of flame where there was a fireball, a storm cloud striking down where there was a ball of
 * lightning, spectral wolves that howl where there were grey ones, a sword of light falling where there was a beam.
 * And what an evolution lands is layered: a flash, a shockwave, then a mark on the ground that lingers a few seconds
 * (embers, frost, light or shadow), with a shake for the biggest.
 *
 * Still only the game's own shader effects (render3d/fx3d.ts), creature models and weapon models. What flies stays
 * small; what lands is big.
 */

/** Each evolution's form, by its spell's id: what a player tells it by at a glance. */
export const EVO_FORM: Record<string, string> = {
  'ember-bolt': 'a phoenix with wings of flame',
  'frost-ring': 'a crown of ice spikes erupting, and frost left on the ground',
  'ice-javelin': 'ice spikes bursting up along the line, one after another',
  'ball-lightning': 'a storm cloud that strikes down as it drifts',
  'reaping-arc': 'a spectral executioner’s halberd swinging through, and blood on the ground',
  'thrown-axe': 'axes wreathed in a wheel of fire',
  'shield-wall': 'a ring of spectral shields turning round the hero',
  'thousand-cuts': 'twin red swords whirling at the blade’s ends',
  'seeking-arrow': 'arrows of light',
  'wolf-pack': 'spectral wolves that howl a shockwave',
  'poison-trap': 'spectral stags charging out of the burst',
  'blast-arrow': 'a rain of light-arrows, then a golden blast',
  'lance-of-dawn': 'columns of sunlight rising along the line',
  'mending-light': 'a sun rising behind the hero',
  'searing-hymn': 'a tall candle of light with three flames circling it',
  'thought-lash': 'a black star that swallows light as it flies',
  'thrown-hammer': 'a hammer before a blazing sun disc, crackling',
  'dawn-swing': 'a crescent of dawn with sun rays along it',
  bulwark: 'a ring of pillars of light',
  'lance-of-noon': 'a great sword of light falling at the line’s end',
  soulfire: 'a fel comet with a burning skull',
  'pit-imps': 'imps of fire on burning ground',
  hellbrand: 'a burning gate in the ground, erupting',
  'rotting-curse': 'a dome of dark miasma with ash falling',
  'thorn-volley': 'a spinning wheel of brambles',
  moonbeams: 'a full moon over the hero, its light falling in beams',
  'briar-burst': 'a vortex of vines spiraling in',
  thornhide: 'a coat of bark plates turning round the hero',
  'gloam-sweep': 'a reaper rising behind the hero with the sweep',
  'circling-shades': 'the shades of old knights, circling',
  'hollow-ward': 'a cloak of night round the hero',
  'mourning-arc': 'black lightning along the turning blade',
};

const TAU = Math.PI * 2;
const ease = (u: number): number => 1 - (1 - u) * (1 - u);
const clamp01 = (u: number): number => Math.max(0, Math.min(0.999, u));

/** What a scene's drawing needs. */
export interface Scene {
  fx: Fx3D;
  cast: Cast;
  time: number;
  /**
   * How many more whole models (a knight's shade, a charging stag) this frame may still draw: each is thousands of
   * triangles, on top of the Host's hundreds of bodies. Past it, a shade is drawn as light (render/vigil.ts sets it
   * each frame).
   */
  models?: { left: number };
  /**
   * How many more evolved shots this frame may be drawn in their full form. A night late on throws dozens at once; past
   * this they are each a small streak and a core in their own colors (render/vigil.ts sets it each frame).
   */
  shots?: { left: number };
}

const spend = (sc: Scene): boolean => {
  if (!sc.models) return true;
  if (sc.models.left <= 0) return false;
  sc.models.left--;
  return true;
};

/* ---------------------------------------------------------------- what flies */

/** The spells whose evolved shots have a form of their own. */
const SHOT_FORMS: Record<string, true> = { 'ember-bolt': true, 'ball-lightning': true, 'seeking-arrow': true, 'thought-lash': true, soulfire: true, 'thorn-volley': true, 'thrown-axe': true, 'thrown-hammer': true };

/** An evolved shot in its own form. Returns false when the spell has none (the look's flyer draws it). */
export function evolvedShot(sc: Scene, id: string, look: Look, x: number, y: number, vx: number, vy: number, r: number, spin: number, seed: number): boolean {
  const { fx, cast, time } = sc;
  const up = 12;
  const speed = Math.hypot(vx, vy) || 1;
  const ux = vx / speed;
  const uy = vy / speed;
  const rot = screenAngle(vx, vy);
  const { a, b } = look;
  const size = Math.max(7, r * 2.6);
  const tail = (len: number, h: number, ca: string, cb: string, alpha = 1, s = seed): void =>
    fx.put({ kind: FX.trail, x: x - ux * len * 0.5, y: y - uy * len * 0.5, up, w: len * shortened(vx, vy), h, rot, a: ca, b: cb, seed: s, alpha });
  if (!(id in SHOT_FORMS)) return false;
  if (sc.shots) {
    if (sc.shots.left <= 0) {
      tail(30, size * 0.7, a, b);
      fx.put({ kind: FX.orb, x, y, up, w: size * 0.9, a, b, seed });
      return true;
    }
    sc.shots.left--;
  }
  switch (id) {
    case 'ember-bolt': {
      // a phoenix: a bright body, two wings of flame beating either side of its flight, and fire streaming behind
      const beat = 0.75 + Math.sin(time * 16 + seed) * 0.25;
      tail(46, size * 0.9, a, b);
      for (const side of [-1, 1]) {
        const wx = x - uy * side * size * 0.55 - ux * size * 0.2;
        const wy = y + ux * side * size * 0.55 - uy * size * 0.2;
        fx.put({ kind: FX.flame, x: wx, y: wy, up: up + 2, w: size * 1.1 * beat, h: size * 1.7, rot: rot + side * 1.2 + Math.PI, a, b, seed: seed + side });
      }
      // (a bright star of a body, not the fireball's round one)
      fx.put({ kind: FX.holy, x, y, up, w: size * 1.1, a: b, b: '#ffffff', seed });
      return true;
    }
    case 'ball-lightning': {
      // a storm cloud drifting at head height, a bolt striking down from it to a small core on the ground
      fx.put({ kind: FX.smoke, x, y, up: 32, w: size * 2, a: '#4a4a72', alpha: 0.9, t: 0.4, seed });
      if (Math.floor(time * 12 + seed) % 2 === 0) fx.put({ kind: FX.bolt, x, y, up: 18, w: 12, h: 34, rot: -Math.PI / 2, a: b, seed: seed + Math.floor(time * 20) });
      fx.put({ kind: FX.orb, x, y, up: 4, w: size * 0.6, a, b, seed });
      return true;
    }
    case 'seeking-arrow': {
      // an arrow of light: a hard white-gold line, no wood in it
      fx.put({ kind: FX.beam, x: x - ux * 9, y: y - uy * 9, up, flat: true, w: 26, h: 5, rot: Math.atan2(uy, ux), a, b, seed });
      tail(34, size * 0.5, b, a, 0.8);
      fx.put({ kind: FX.holy, x, y, up, w: size * 0.9, a, b, seed });
      return true;
    }
    case 'thought-lash': {
      // a black star: dark at the heart, light bending round it, motes drawn in
      fx.put({ kind: FX.glow, x, y, up, w: size * 2.4, a: b, alpha: 0.5 });
      fx.put({ kind: FX.shadow, x, y, up, w: size * 1.4, a, b: '#000000', seed });
      fx.put({ kind: FX.ring, x, y, up, w: size * 1.6, a: b, t: (time * 2 + seed) % 1, seed });
      return true;
    }
    case 'soulfire': {
      // a fel comet: a burning skull at its head, green fire pouring back from it
      tail(56, size * 1.1, a, b);
      fx.put({ kind: FX.flame, x: x - ux * size * 0.9, y: y - uy * size * 0.9, up, w: size * 1.3, h: size * 2.4, rot: rot + Math.PI / 2, a, b, seed });
      fx.put({ kind: FX.ghost, x, y, up: up + 1, w: size * 1.1, h: size * 1.2, a: b, b: a, seed });
      return true;
    }
    case 'thorn-volley': {
      // a wheel of brambles, spinning as it goes
      for (let i = 0; i < 4; i++) {
        const ang = time * 18 + (i / 4) * TAU;
        fx.put({ kind: i % 2 ? FX.leaf : FX.chip, x: x + Math.cos(ang) * size * 0.6, y: y + Math.sin(ang) * size * 0.4, up, w: size * 0.55, h: size * 0.55, rot: ang, a, b, seed: seed + i });
      }
      // (the wheel's rim)
      fx.put({ kind: FX.ring, x, y, up, w: size * 1.4, a, t: 0.5, seed });
      return true;
    }
    case 'thrown-axe':
    case 'thrown-hammer': {
      const model = id === 'thrown-axe' ? 'w_axe_A' : 'w_hammer_A';
      if (id === 'thrown-axe') {
        // the axe in a wheel of fire
        for (let i = 0; i < 2; i++) {
          const ang = spin * 0.6 + (i / 2) * TAU;
          fx.put({ kind: FX.flame, x: x + Math.cos(ang) * r * 2, y: y + Math.sin(ang) * r * 1.4, up: up - 2, w: r * 2, h: r * 3, rot: ang + Math.PI / 2, a, b, seed: seed + i });
        }
      } else {
        // the hammer before a sun, lightning crackling off it
        fx.put({ kind: FX.holy, x, y, up: up + 2, w: r * 5, a, b, seed, behind: true });
        if (Math.floor(time * 14 + seed) % 3 === 0) fx.put({ kind: FX.bolt, x, y, up, w: r * 5, h: r * 3, rot: time * 7, a: b, seed: seed + Math.floor(time * 30) });
      }
      cast.thrown(model, x, y, (up - 2) / TILE, Math.atan2(vx, vy), (r * 2.6) / TILE / 1.16, spin);
      tail(40, r * 2, a, b);
      return true;
    }
  }
  return false;
}

/** An evolved thing circling a hero. */
export function evolvedOrbit(sc: Scene, id: string, look: Look, hx: number, hy: number, x: number, y: number, r: number, seed: number): boolean {
  if (id !== 'circling-shades') return false;
  const { fx, cast, time } = sc;
  // a knight's shade, pale and faint, its wake behind it
  const face = Math.atan2(y - hy, x - hx) + Math.PI / 2;
  if (spend(sc)) cast.creature('restless-shade', x, y, Math.atan2(Math.cos(face), Math.sin(face)), Math.max(10, r * 2.4), 'walk', time * 1.2 + seed, true, { alpha: 0.7, tint: [0.9, 0.7, 1.6], lift: 0.25 });
  else fx.put({ kind: FX.ghost, x, y, up: 12, w: r * 2, h: r * 3, a: look.b, b: look.a, seed: seed + 2, alpha: 0.85 });
  fx.put({ kind: FX.ghost, x: x - Math.cos(face) * 6, y: y - Math.sin(face) * 4, up: 10, w: r * 2.2, h: r * 2.6, a: look.a, b: look.b, seed, alpha: 0.6 });
  return true;
}

/** An evolved companion's look in the cast: a tint and a ghostliness. */
export function evolvedPetLook(id: string): { alpha: number; tint: readonly [number, number, number] } | null {
  if (id === 'wolf-pack') return { alpha: 0.78, tint: [0.75, 1.35, 1.9] };
  if (id === 'pit-imps') return { alpha: 1, tint: [1.9, 1.0, 0.45] };
  if (id === 'spirit-stag') return null;
  return null;
}

/** What an evolved companion carries with it on the ground and in the air. */
export function evolvedPet(sc: Scene, id: string, look: Look, x: number, y: number, seed: number): boolean {
  const { fx, time } = sc;
  if (id === 'wolf-pack') {
    // a spectral wolf: a glow round it, and now and then the howl that shakes the air
    fx.put({ kind: FX.glow, x, y, up: 8, w: 30, a: look.a, alpha: 0.55 });
    fx.put({ kind: FX.ghost, x, y, up: 10, w: 16, h: 18, a: look.a, b: look.b, seed, alpha: 0.4 });
    const howl = (time * 0.4 + seed * 0.13) % 1;
    if (howl < 0.35) {
      const u = howl / 0.35;
      fx.put({ kind: FX.shock, x, y, flat: true, w: 20 + u * 90, a: look.b, p1: 0.82, p2: 0.12, seed, alpha: 1 - u });
    }
    return true;
  }
  if (id === 'pit-imps') {
    // burning ground under each imp, and flame licking up round it
    fx.put({ kind: FX.field, x, y, flat: true, w: 26, a: look.a, b: look.b, t: 1, seed, p1: FIELD.fire, alpha: 0.8 });
    fx.put({ kind: FX.flame, x: x + Math.sin(time * 3 + seed) * 5, y, base: true, w: 12, h: 20, a: look.a, b: look.b, seed });
    return true;
  }
  return false;
}

/* ---------------------------------------------------------------- what stands */

/** An evolved trap or totem. */
export function evolvedPost(sc: Scene, id: string, look: Look, x: number, y: number, fade: number, armed: boolean, seed: number): boolean {
  const { fx, time } = sc;
  if (id === 'searing-hymn') {
    // a tall candle of light, three flames turning round it
    fx.put({ kind: FX.column, x, y, base: true, w: 14, h: 64, a: look.a, b: look.b, t: 0.5, seed, alpha: fade });
    fx.put({ kind: FX.ring, x, y, flat: true, w: 40, a: look.a, t: (time * 0.8 + seed) % 1, seed, alpha: fade });
    for (let i = 0; i < 3; i++) {
      const ang = time * 3 + (i / 3) * TAU;
      fx.put({ kind: FX.flame, x: x + Math.cos(ang) * 14, y: y + Math.sin(ang) * 9, up: 30, w: 9, h: 14, a: look.a, b: look.b, seed: seed + i, alpha: fade });
    }
    return true;
  }
  if (id === 'hellbrand') {
    // a burning gate in the ground, flames leaping out of it
    fx.put({ kind: FX.rift, x, y, flat: true, w: 40, a: look.a, b: look.b, seed, alpha: fade });
    const leap = (time * 1.6 + seed) % 1;
    fx.put({ kind: FX.flame, x, y, base: true, w: 18, h: 18 + leap * 30, a: look.a, b: look.b, seed, alpha: fade * (1 - leap * 0.6) });
    fx.put({ kind: FX.smoke, x, y, up: 20 + leap * 26, w: 16, a: '#3a2a2a', alpha: 0.4 * fade, t: leap, seed });
    return true;
  }
  if (id === 'poison-trap') {
    // a hunting horn's sigil: a ring of the hunt, a stag's breath over it
    fx.put({ kind: FX.rune, x, y, flat: true, w: 26, a: look.a, b: look.b, t: 0.5, seed, alpha: fade });
    fx.put({ kind: FX.ghost, x, y, up: 8 + Math.sin(time * 3 + seed) * 2, w: 12, h: 14, a: look.a, b: look.b, seed, alpha: fade * (armed ? 0.8 : 0.4) });
    return true;
  }
  if (id === 'briar-burst') {
    // a knot of vines, already turning
    for (let i = 0; i < 4; i++) {
      const ang = time * 2 + (i / 4) * TAU;
      fx.put({ kind: FX.leaf, x: x + Math.cos(ang) * 9, y: y + Math.sin(ang) * 6, up: 4, w: 9, h: 9, rot: ang, a: look.a, b: look.b, seed: seed + i, alpha: fade });
    }
    fx.put({ kind: FX.web, x, y, flat: true, w: 26, a: look.a, b: look.b, seed, alpha: fade });
    return true;
  }
  return false;
}

/** An evolved ward round a hero. `left` is how much of it is left (0 to 1). */
export function evolvedWard(sc: Scene, id: string, look: Look, x: number, y: number, left: number, seed: number): boolean {
  const { fx, cast, time } = sc;
  const alpha = 0.35 + left * 0.6;
  switch (id) {
    case 'shield-wall':
      // a ring of spectral shields, turning
      for (let i = 0; i < 4; i++) {
        const ang = time * 1.6 + (i / 4) * TAU;
        cast.thrown('w_shield_round', x + Math.cos(ang) * 20, y + Math.sin(ang) * 14, 12 / TILE, ang + Math.PI / 2, 0.42, Math.PI / 2);
        fx.put({ kind: FX.glow, x: x + Math.cos(ang) * 20, y: y + Math.sin(ang) * 14, up: 12, w: 16, a: look.b, alpha: alpha * 0.6 });
      }
      return true;
    case 'bulwark':
      // pillars of light standing round the hero, and the dome between them
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + time * 0.4;
        fx.put({ kind: FX.shaft, x: x + Math.cos(ang) * 24, y: y + Math.sin(ang) * 17, base: true, w: 7, h: 50, a: look.a, alpha, seed: seed + i });
      }
      fx.put({ kind: FX.bubble, x, y, up: 16, w: 52, a: look.b, alpha: alpha * 0.6 });
      return true;
    case 'thornhide':
      // bark plates turning about the hero
      for (let i = 0; i < 6; i++) {
        const ang = -time * 2 + (i / 6) * TAU;
        fx.put({ kind: FX.chip, x: x + Math.cos(ang) * 17, y: y + Math.sin(ang) * 12, up: 10 + Math.sin(ang * 2) * 3, w: 10, h: 10, rot: ang, a: look.a, b: look.b, seed: seed + i, alpha });
      }
      fx.put({ kind: FX.ring, x, y, flat: true, w: 40, a: look.a, t: 0.5, seed, alpha });
      return true;
    case 'hollow-ward':
      // a cloak of night: a tall shape of shadow behind the hero, a ring of dark at their feet
      fx.put({ kind: FX.ghost, x, y: y - 2, up: 18, w: 34, h: 44, a: look.a, b: look.b, seed, alpha: alpha * 0.8, behind: true });
      fx.put({ kind: FX.shadow, x, y, flat: true, w: 44, a: look.a, b: look.b, seed, alpha });
      return true;
  }
  return false;
}

/** An evolved aura round a hero, `r` across. */
export function evolvedAura(sc: Scene, id: string, look: Look, x: number, y: number, r: number, seed: number): boolean {
  if (id !== 'rotting-curse') return false;
  const { fx, time } = sc;
  // a dome of dark miasma, ash falling through it
  fx.put({ kind: FX.field, x, y, flat: true, w: r * 2, a: look.a, b: look.b, t: 1, seed, p1: FIELD.shadow, alpha: 0.7 });
  fx.put({ kind: FX.bubble, x, y, up: 4, w: r * 2.1, a: look.a, alpha: 0.35 });
  for (let i = 0; i < 6; i++) {
    const fall = (time * 0.6 + i / 6) % 1;
    const ang = (i / 6) * TAU + seed;
    fx.put({ kind: FX.flake, x: x + Math.cos(ang) * r * 0.6, y: y + Math.sin(ang) * r * 0.5, up: 40 * (1 - fall) + 3, w: 7, h: 7, rot: ang + time, a: '#4a4040', b: look.b, seed: seed + i, alpha: 1 - fall * 0.5 });
    fx.put({ kind: FX.smoke, x: x + Math.cos(ang + 1) * r * 0.4, y: y + Math.sin(ang + 1) * r * 0.3, up: 6 + fall * 30, w: 18, a: look.a, alpha: 0.35 * (1 - fall), t: fall, seed: seed + i });
  }
  return true;
}

/** What an evolved spell keeps over a hero while it is held: the full moon over a druid. */
export function evolvedOverHero(sc: Scene, id: string, look: Look, x: number, y: number): boolean {
  if (id !== 'moonbeams') return false;
  const { fx, time } = sc;
  fx.put({ kind: FX.glow, x, y: y - 6, up: 96, w: 70, a: look.a, alpha: 0.5 });
  fx.put({ kind: FX.holy, x, y: y - 6, up: 96, w: 36 + Math.sin(time * 2) * 2, a: look.a, b: look.b, seed: 1 });
  return true;
}

/* ---------------------------------------------------------------- what lands */

/**
 * An evolved spell's effect in its own form, for the kinds it changes. `hx`, `hy`: the hero it is cast from (for what
 * turns about them). Returns false when this spell's evolution keeps the effect's own form for this kind (and the
 * layered impact and the ground's mark are still added: `impactLayers`, `scarOf`).
 */
export function evolvedEffect(sc: Scene, f: Fx, look: Look, u: number, seed: number, hx: number, hy: number): boolean {
  const { fx, cast, time } = sc;
  const id = f.spell!;
  const r = f.r ?? 20;
  switch (`${f.kind}:${id}`) {
    case 'nova:frost-ring': {
      // a crown of ice spikes bursting up round the hero, the ring of cold behind them
      const R = r * 1.25 * (0.2 + ease(u) * 0.8);
      fx.put({ kind: FX.shock, x: f.x, y: f.y, flat: true, w: R * 2 + 30, a: look.a, p1: R / (R + 15), p2: 15 / (R + 15), seed, alpha: 1 - u * u });
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + seed;
        const rise = Math.min(1, u * 3) * (1 - Math.max(0, u - 0.7) / 0.3);
        fx.put({ kind: FX.frost, x: f.x + Math.cos(a) * R, y: f.y + Math.sin(a) * R, up: 4 + rise * 10, w: 10, h: 10 + rise * 26, rot: -Math.PI / 2, a: look.a, b: look.b, t: u, seed: seed + i });
        fx.put({ kind: FX.flake, x: f.x + Math.cos(a + 0.2) * R * 0.7, y: f.y + Math.sin(a + 0.2) * R * 0.7, up: 20 + u * 20, w: 8, h: 8, rot: time + i, a: look.b, b: '#ffffff', seed: seed + i, alpha: 1 - u });
      }
      fx.put({ kind: FX.shaft, x: f.x, y: f.y, base: true, w: 30 * (1 - u), h: 170, a: look.b, alpha: 1 - u, seed });
      return true;
    }
    case 'beam:ice-javelin': {
      // ice spikes erupting up the line, one after another, the line frozen behind them
      const a = f.a ?? 0;
      const len = f.len ?? 200;
      const n = 9;
      for (let i = 0; i < n; i++) {
        const at = (i + 0.5) / n;
        const grow = Math.max(0, Math.min(1, u * 3 - at * 1.4));
        if (grow <= 0) continue;
        const fall = Math.max(0, u - 0.75) / 0.25;
        fx.put({ kind: FX.frost, x: f.x + Math.cos(a) * len * at, y: f.y + Math.sin(a) * len * at, up: 4, w: 12, h: 12 + grow * 30 * (1 - fall), rot: -Math.PI / 2 + Math.sin(i * 2.3) * 0.3, a: look.a, b: look.b, t: grow, seed: seed + i });
      }
      fx.put({ kind: FX.beam, x: f.x + (Math.cos(a) * len) / 2, y: f.y + (Math.sin(a) * len) / 2, up: 3, flat: true, w: len, h: 22 * (1 - u * 0.5), rot: a, a: look.a, b: look.b, seed, alpha: 0.6 * (1 - u) });
      return true;
    }
    case 'beam:lance-of-dawn': {
      // columns of sunlight rising along the line
      const a = f.a ?? 0;
      const len = f.len ?? 200;
      for (let i = 0; i < 6; i++) {
        const at = (i + 0.5) / 6;
        const rise = Math.max(0, Math.min(1, u * 2.6 - at));
        fx.put({ kind: FX.column, x: f.x + Math.cos(a) * len * at, y: f.y + Math.sin(a) * len * at, base: true, w: 16, h: 40 + rise * 110, a: look.a, b: look.b, t: rise, seed: seed + i, alpha: 1 - u * u });
      }
      fx.put({ kind: FX.beam, x: f.x + (Math.cos(a) * len) / 2, y: f.y + (Math.sin(a) * len) / 2, up: 8, flat: true, w: len, h: 30 * (1 - u * 0.6), rot: a, a: look.a, b: look.b, seed, alpha: 1 - u });
      return true;
    }
    case 'beam:lance-of-noon': {
      // the line's light, and a great sword of it falling at its far end
      const a = f.a ?? 0;
      const len = f.len ?? 200;
      const ex = f.x + Math.cos(a) * len;
      const ey = f.y + Math.sin(a) * len;
      fx.put({ kind: FX.beam, x: (f.x + ex) / 2, y: (f.y + ey) / 2, up: 8, flat: true, w: len, h: 16 * (1 - u * 0.6), rot: a, a: look.a, b: look.b, seed, alpha: 1 - u });
      const fall = Math.min(1, u * 2.2);
      const k = 74 / TILE / 3.25;
      cast.thrown('w_sword_F', ex, ey, ((1 - fall) * 160) / TILE + 2.82 * k * 0.92, 0.6, k, Math.PI);
      fx.put({ kind: FX.shaft, x: ex, y: ey, base: true, w: 22, h: 190, a: look.b, alpha: 1 - u, seed });
      if (fall >= 1) fx.put({ kind: FX.shock, x: ex, y: ey, flat: true, w: 30 + (u - 0.45) * 160, a: look.a, p1: 0.8, p2: 0.15, seed, alpha: 1 - u });
      return true;
    }
    case 'cone:reaping-arc': {
      // a spectral executioner's halberd swung through the arc, a red wake behind it
      const a0 = (f.a ?? 0) - (f.arc ?? 1.9) / 2;
      const a = a0 + (f.arc ?? 1.9) * ease(Math.min(1, u * 1.4));
      const k = 70 / TILE / 3.14;
      cast.thrown('w_halberd', f.x + Math.cos(a) * r * 0.45, f.y + Math.sin(a) * r * 0.45, 12 / TILE, Math.atan2(Math.cos(a), Math.sin(a)), k, Math.PI / 2);
      fx.put({ kind: FX.slash, x: f.x, y: f.y, up: 10, flat: true, w: (r * 2.6) / 0.82, rot: f.a ?? 0, a: look.a, t: u, p1: f.arc ?? 1.9, p2: 1 });
      fx.put({ kind: FX.slash, x: f.x, y: f.y, up: 12, flat: true, w: (r * 2) / 0.82, rot: (f.a ?? 0) + 0.1, a: look.b, t: u, p1: f.arc ?? 1.9, p2: 1, alpha: 0.7 });
      return true;
    }
    case 'cone:dawn-swing': {
      // a crescent of dawn, rays of sun standing up along its edge
      fx.put({ kind: FX.slash, x: f.x, y: f.y, up: 10, flat: true, w: (r * 2.7) / 0.82, rot: f.a ?? 0, a: look.a, t: u, p1: TAU * 0.95, p2: 1 });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + (f.a ?? 0);
        fx.put({ kind: FX.shaft, x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r, base: true, w: 8 * (1 - u), h: 70 + Math.sin(i) * 20, a: look.b, alpha: 1 - u, seed: seed + i });
      }
      fx.put({ kind: FX.holy, x: f.x, y: f.y, up: 14, w: 40 * (1 - u * 0.5), a: look.a, b: look.b, seed, alpha: 1 - u });
      return true;
    }
    case 'cone:gloam-sweep': {
      // a reaper rising behind the hero for the sweep, the dark of its scythe through the arc
      const rise = Math.min(1, u * 3);
      fx.put({ kind: FX.ghost, x: hx - Math.cos(f.a ?? 0) * 10, y: hy - Math.sin(f.a ?? 0) * 6, up: 22 + rise * 10, w: 40, h: 56 * rise, a: look.a, b: look.b, seed, alpha: (1 - u) * 0.85, behind: true });
      fx.put({ kind: FX.slash, x: f.x, y: f.y, up: 10, flat: true, w: (r * 2.8) / 0.82, rot: f.a ?? 0, a: look.a, t: u, p1: (f.arc ?? 1.9) * 1.2, p2: 1 });
      fx.put({ kind: FX.slash, x: f.x, y: f.y, up: 11, flat: true, w: (r * 2.2) / 0.82, rot: (f.a ?? 0) - 0.12, a: look.b, t: u, p1: f.arc ?? 1.9, p2: 1, alpha: 0.6 });
      return true;
    }
    case 'sweep:thousand-cuts':
    case 'sweep:mourning-arc': {
      // the turning blade: twin red swords at its ends, or black lightning along it
      const len = f.len ?? 70;
      const alpha = u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2;
      for (let k = 0; k < (f.n && f.n > 1 ? 2 : 1); k++) {
        const a = (f.a ?? 0) + u * TAU + k * Math.PI;
        const ex = hx + Math.cos(a) * len;
        const ey = hy - 4 + Math.sin(a) * len;
        if (id === 'thousand-cuts') {
          fx.put({ kind: FX.slash, x: hx, y: hy - 4, up: 9, flat: true, w: (len * 2.1) / 0.82, rot: a - 0.6, a: look.a, t: 0.5, p1: 1.4, p2: 1, alpha });
          for (const at of [0.55, 1]) cast.thrown('w_sword_A', hx + Math.cos(a) * len * at, hy - 4 + Math.sin(a) * len * at, 12 / TILE, Math.atan2(Math.cos(a), Math.sin(a)), 28 / TILE / 1.78, Math.PI / 2);
          fx.put({ kind: FX.spill, x: ex, y: ey + 4, flat: true, w: 18, a: look.a, b: look.b, seed: seed + k, alpha });
        } else {
          fx.put({ kind: FX.bolt, x: (hx + ex) / 2, y: (hy - 4 + ey) / 2, up: 11, w: len * 1.1, h: 22, rot: screenAngle(Math.cos(a), Math.sin(a)), a: look.a, seed: seed + Math.floor(time * 22) + k, alpha });
          fx.put({ kind: FX.slash, x: hx, y: hy - 4, up: 9, flat: true, w: (len * 2) / 0.82, rot: a - 0.5, a: look.b, t: 0.5, p1: 1.2, p2: 1, alpha: alpha * 0.7 });
          fx.put({ kind: FX.shadow, x: ex, y: ey, up: 10, w: 20, a: look.a, b: look.b, seed, alpha });
        }
      }
      return true;
    }
    case 'strike:blast-arrow': {
      // a rain of arrows of light coming down on the mark, then a golden blast
      const at = f.at ?? 0.3;
      if (f.t < at) {
        const fall = f.t / at;
        fx.put({ kind: FX.mark, x: f.x, y: f.y, flat: true, w: r * 2, a: look.a, alpha: 0.4 + fall * 0.6 });
        for (let i = 0; i < 9; i++) {
          const ox = Math.sin(i * 2.4 + seed) * r * 0.6;
          const oy = Math.cos(i * 1.7 + seed) * r * 0.45;
          const h = 170 * (1 - fall) + (i % 3) * 14;
          fx.put({ kind: FX.trail, x: f.x + ox, y: f.y + oy, up: h + 18, w: 36, h: 5, rot: -Math.PI / 2, a: look.b, b: '#ffffff', alpha: 0.95 });
        }
        return true;
      }
      // the landing: a golden sigil burned into the ground, a pillar of light off it, and light-arrows standing in it
      const v = (f.t - at) / (f.dur - at);
      fx.put({ kind: FX.rune, x: f.x, y: f.y, flat: true, w: r * 2.3, a: look.a, b: look.b, t: 0.5, seed, alpha: 1 - v });
      fx.put({ kind: FX.column, x: f.x, y: f.y, base: true, w: 26 * (1 - v * 0.6), h: 190, a: look.a, b: look.b, t: v, seed, alpha: 1 - v });
      fx.put({ kind: FX.blast, x: f.x, y: f.y, up: 10, w: r * 2.2, a: look.a, b: look.b, t: v, seed });
      for (let i = 0; i < 7; i++) {
        const ox = Math.sin(i * 2.4 + seed) * r * 0.6;
        const oy = Math.cos(i * 1.7 + seed) * r * 0.45;
        fx.put({ kind: FX.shaft, x: f.x + ox, y: f.y + oy, base: true, w: 4, h: 26, a: look.b, alpha: 1 - v, seed: seed + i });
      }
      return true;
    }
    case 'drop:moonbeams': {
      // a beam of the full moon's light
      const at = f.at ?? 0.18;
      if (f.t < at) return true;
      const v = (f.t - at) / (f.dur - at);
      fx.put({ kind: FX.shaft, x: f.x, y: f.y, base: true, w: r * 2.6, h: 190, a: look.a, t: v, seed, alpha: 1 - v });
      fx.put({ kind: FX.ring, x: f.x, y: f.y, flat: true, w: r * 3, a: look.b, t: v, seed });
      fx.put({ kind: FX.holy, x: f.x, y: f.y, up: 8, w: r * 2, a: look.a, b: look.b, seed, alpha: 1 - v });
      return true;
    }
    case 'heal:mending-light': {
      // a sun rising behind the hero, and its light falling round them
      fx.put({ kind: FX.holy, x: f.x, y: f.y - 4, up: 10 + u * 46, w: 46 * (0.6 + u * 0.4), a: look.a, b: look.b, seed, alpha: 1 - u * u, behind: true });
      fx.put({ kind: FX.shock, x: f.x, y: f.y, flat: true, w: 30 + u * 70, a: look.b, p1: 0.85, p2: 0.1, seed, alpha: 1 - u });
      for (let i = 0; i < 5; i++) fx.put({ kind: FX.shaft, x: f.x + Math.cos(i * 1.26) * 22, y: f.y + Math.sin(i * 1.26) * 15, base: true, w: 6, h: 60, a: look.a, alpha: (1 - u) * 0.8, seed: seed + i });
      return true;
    }
    case 'burst:poison-trap': {
      // the trap's burst, and three spectral stags charging out of it
      const R = r * 1.2;
      fx.put({ kind: FX.poison, x: f.x, y: f.y, up: 8, w: R * 2 * (0.4 + ease(u) * 0.6), a: look.a, b: look.b, seed, alpha: 1 - u });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + seed;
        const d = 10 + ease(u) * R * 1.4;
        const sx = f.x + Math.cos(a) * d;
        const sy = f.y + Math.sin(a) * d;
        if (spend(sc)) cast.creature('blighted-stag', sx, sy, Math.atan2(Math.cos(a), Math.sin(a)), 22, 'run', time * 1.6 + i, true, { alpha: 0.7 * (1 - u * u), tint: [0.6, 1.6, 1.3] });
        else fx.put({ kind: FX.ghost, x: sx, y: sy, up: 10, w: 18, h: 20, a: look.a, b: look.b, seed: seed + i, alpha: 0.8 * (1 - u) });
      }
      return true;
    }
    case 'burst:briar-burst': {
      // a vortex of vines spiraling in on the burst
      const R = r * 1.3;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + u * 5;
        const d = R * (1 - ease(u) * 0.8);
        fx.put({ kind: FX.leaf, x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d, up: 6, w: 12, h: 12, rot: a + Math.PI / 2, a: look.a, b: look.b, seed: seed + i, alpha: 1 - u * 0.5 });
      }
      fx.put({ kind: FX.web, x: f.x, y: f.y, flat: true, w: R * 2, a: look.a, b: look.b, seed, alpha: 1 - u });
      return true;
    }
  }
  return false;
}

/**
 * The layers of an evolved spell's landing, under whatever form it takes: a flash, then a shockwave. Returns how hard
 * the screen should kick (0 for none).
 */
export function impactLayers(sc: Scene, f: Fx, look: Look, u: number, seed: number): number {
  const { fx } = sc;
  const kind = f.kind;
  if (kind !== 'burst' && kind !== 'nova' && kind !== 'strike' && kind !== 'drop') return 0;
  // (a strike lands when its fall is done: only then)
  const at = kind === 'strike' || kind === 'drop' ? (f.at ?? 0.3) : 0;
  if (f.t < at) return 0;
  const v = at ? (f.t - at) / (f.dur - at) : u;
  const r = (f.r ?? 20) * (kind === 'drop' ? 1 : 1.2);
  // (the flash is brief and the glow small: big soft quads are what a phone's drawing pays for)
  if (v < 0.18) fx.put({ kind: FX.glow, x: f.x, y: f.y, up: 10, w: Math.min(110, r * 2.2), a: '#ffffff', alpha: (1 - v / 0.18) * 0.85 });
  const R = r * (0.3 + ease(clamp01(v)) * 1.0);
  fx.put({ kind: FX.shock, x: f.x, y: f.y, flat: true, w: R * 2 + 16, a: look.b, p1: R / (R + 8), p2: 8 / (R + 8), seed: seed + 5, alpha: (1 - v) * 0.9 });
  return kind === 'strike' || (kind === 'nova' && r > 50) ? 7 : kind === 'burst' && r > 30 ? 4 : 0;
}

/* ---------------------------------------------------------------- what is left on the ground */

/** A mark an evolved spell leaves on the ground for a few seconds: embers, frost, light, shadow, venom, roots. */
export interface Scar {
  x: number;
  y: number;
  r: number;
  t: number;
  dur: number;
  look: Look;
  /** Along a line, this way and this long (a lance's), instead of a round mark. */
  a?: number;
  len?: number;
}

const GROUND_OF: Partial<Record<Motif, number>> = { flame: FIELD.fire, frost: FIELD.frost, flake: FIELD.frost, holy: FIELD.holy, spark: FIELD.holy, shadow: FIELD.shadow, ghost: FIELD.shadow, poison: FIELD.poison, smoke: FIELD.poison, leaf: FIELD.nature, web: FIELD.nature, chip: FIELD.nature, bolt: FIELD.lightning, impact: FIELD.lightning, spill: FIELD.poison, water: FIELD.water, bubble: FIELD.water, rune: FIELD.rift };

/** The mark a landing evolution leaves, if it leaves one. */
export function scarOf(f: Fx, look: Look): Scar | null {
  const r = f.r ?? 20;
  switch (f.kind) {
    case 'burst':
    case 'nova':
      return { x: f.x, y: f.y, r: Math.min(56, r * 0.8), t: f.kind === 'nova' ? -0.3 : 0, dur: 2.6, look };
    case 'strike':
    case 'drop':
      return { x: f.x, y: f.y, r: Math.min(56, r * 0.8), t: -(f.at ?? 0.3), dur: 2.8, look };
    case 'beam':
      return { x: f.x, y: f.y, r: Math.max(8, (f.w ?? 8) * 1.4), t: -0.15, dur: 2.6, look, a: f.a ?? 0, len: f.len ?? 200 };
    case 'cone':
      return { x: f.x + Math.cos(f.a ?? 0) * r * 0.5, y: f.y + Math.sin(f.a ?? 0) * r * 0.5, r: r * 0.55, t: -0.1, dur: 2.4, look };
    case 'heal':
      return { x: f.x, y: f.y, r: 26, t: 0, dur: 2.4, look };
  }
  return null;
}

/** A mark on the ground, fading as it goes. */
export function drawScar(sc: Scene, s: Scar, seed: number): void {
  if (s.t < 0) return;
  const { fx, time } = sc;
  const alpha = Math.min(1, s.t / 0.2) * (1 - s.t / s.dur) ** 1.4;
  const ground = GROUND_OF[s.look.motif] ?? FIELD.rift;
  const spots: [number, number, number][] = [];
  if (s.len) {
    const n = Math.max(3, Math.min(5, Math.round(s.len / 45)));
    for (let i = 0; i < n; i++) spots.push([s.x + Math.cos(s.a ?? 0) * s.len * ((i + 0.5) / n), s.y + Math.sin(s.a ?? 0) * s.len * ((i + 0.5) / n), s.r]);
  } else spots.push([s.x, s.y, s.r]);
  spots.forEach(([x, y, r], i) => {
    fx.put({ kind: FX.field, x, y, flat: true, w: r * 2, a: s.look.a, b: s.look.b, t: 1, seed: seed + i, p1: ground, alpha: alpha * 0.85 });
    // what drifts up off it: embers, flakes, motes
    const lift = (time * 0.7 + i * 0.31 + seed) % 1;
    motif(fx, s.look.motif, x + Math.sin(i * 3.1 + seed) * r * 0.5, y + Math.cos(i * 2.3 + seed) * r * 0.35, 3 + lift * 16, 9, s.look.a, s.look.b, seed + i, lift, alpha * (1 - lift));
  });
}

/** The halo an evolved thing keeps (re-exported for the painter's other parts). */
export { grandeur };
