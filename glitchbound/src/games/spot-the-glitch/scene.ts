/**
 * Procedural pictures for Spot the Glitch. A picture is plain data (a theme plus a list of objects),
 * generated from a seed, so the library is effectively endless, every daily is identical for every
 * player, and each difference has exact coordinates. Drawing lives in draw.ts.
 *
 * Coordinates are in scene units: the picture is W x H (4:3); y grows downward.
 */

export const W = 400;
export const H = 300;

export type ThemeId = 'meadow' | 'reef' | 'street' | 'space' | 'snow';

export type Kind =
  | 'tree'
  | 'pine'
  | 'cloud'
  | 'house'
  | 'flower'
  | 'bird'
  | 'balloon'
  | 'sun'
  | 'fish'
  | 'coral'
  | 'shell'
  | 'starfish'
  | 'weed'
  | 'bubbles'
  | 'building'
  | 'car'
  | 'lamp'
  | 'sign'
  | 'planet'
  | 'rocket'
  | 'star'
  | 'ufo'
  | 'snowman'
  | 'present'
  | 'kite'
  | 'mushroom';

export interface Obj {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  /** Scale; 1 is the kind's natural size. */
  s: number;
  /** Main colour. */
  c: string;
  /** Secondary colour (doors, stripes, petals' centre...). */
  c2: string;
  /** Small integer that changes a detail (window count, stripes, petals...). */
  v: number;
  flip: boolean;
}

export interface Scene {
  theme: ThemeId;
  /** Background variant (sky tint, ground shape) from the seed. */
  bg: number;
  objects: Obj[];
}

export const PALETTE = ['#d1544f', '#e0913d', '#e3c04d', '#8cae4f', '#3f9c94', '#4a72b0', '#8a6db5', '#d99aae', '#f6f3ec', '#8b5a3c'];

/** Natural radius of each kind at s = 1 (used for spacing and hit circles). */
export const RADIUS: Record<Kind, number> = {
  tree: 30,
  pine: 28,
  cloud: 30,
  house: 34,
  flower: 10,
  bird: 10,
  balloon: 13,
  sun: 24,
  fish: 16,
  coral: 22,
  shell: 10,
  starfish: 11,
  weed: 18,
  bubbles: 12,
  building: 40,
  car: 22,
  lamp: 22,
  sign: 14,
  planet: 26,
  rocket: 22,
  star: 9,
  ufo: 20,
  snowman: 24,
  present: 12,
  kite: 14,
  mushroom: 11,
};

/** Kinds that look different when mirrored (so a flip is a fair difference). */
export const ASYMMETRIC: ReadonlySet<Kind> = new Set(['bird', 'fish', 'car', 'house', 'rocket', 'sign', 'kite', 'lamp', 'snowman']);

/** Kinds whose `v` changes something visible. */
export const DETAILED: ReadonlySet<Kind> = new Set(['house', 'flower', 'fish', 'building', 'car', 'balloon', 'planet', 'present', 'shell', 'snowman', 'mushroom', 'ufo', 'kite', 'tree']);

/** Kinds that are scenery and too big or too structural to remove or add. */
export const FIXED: ReadonlySet<Kind> = new Set(['sun', 'building']);

/** Small, fast, seedable PRNG (mulberry32). Floats in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type R = () => number;
const pick = <T>(r: R, list: readonly T[]): T => list[Math.floor(r() * list.length)]!;
const between = (r: R, a: number, b: number): number => a + r() * (b - a);

/** Where a kind may stand in a theme: a y band and a count range. */
interface Slot {
  kind: Kind;
  y: [number, number];
  count: [number, number];
  s?: [number, number];
  colors?: readonly string[];
}

const SKY = ['#f6f3ec'];
const WARM = ['#d1544f', '#e0913d', '#e3c04d', '#d99aae', '#8a6db5', '#f6f3ec'];
const ALL = PALETTE.slice(0, 8);

const THEMES: Record<ThemeId, Slot[]> = {
  meadow: [
    { kind: 'sun', y: [34, 50], count: [1, 1], colors: ['#e3c04d'] },
    { kind: 'cloud', y: [26, 80], count: [2, 4], colors: SKY },
    { kind: 'bird', y: [40, 100], count: [2, 4], colors: ['#4a72b0', '#d1544f', '#2e2d35', '#8a6db5'] },
    { kind: 'kite', y: [40, 90], count: [0, 1], colors: ALL },
    { kind: 'balloon', y: [60, 120], count: [1, 3], colors: ALL },
    { kind: 'house', y: [150, 175], count: [1, 2], colors: ['#d1544f', '#e3c04d', '#3f9c94', '#e0913d', '#8a6db5'] },
    { kind: 'tree', y: [150, 200], count: [2, 4], colors: ['#4f8a3c', '#8cae4f', '#3e7a4f'] },
    { kind: 'mushroom', y: [230, 285], count: [1, 3], colors: ['#d1544f', '#e0913d', '#8a6db5'] },
    { kind: 'flower', y: [215, 290], count: [6, 10], colors: WARM },
  ],
  reef: [
    { kind: 'bubbles', y: [30, 160], count: [2, 4], colors: SKY },
    { kind: 'fish', y: [50, 200], count: [5, 8], colors: ALL },
    { kind: 'weed', y: [235, 270], count: [3, 5], colors: ['#3e7a4f', '#8cae4f', '#3f9c94'] },
    { kind: 'coral', y: [235, 275], count: [3, 4], colors: ['#d1544f', '#e0913d', '#d99aae', '#8a6db5'] },
    { kind: 'shell', y: [262, 292], count: [2, 4], colors: ['#ead6bd', '#d99aae', '#e3c04d', '#f6f3ec'] },
    { kind: 'starfish', y: [255, 292], count: [1, 3], colors: ['#e0913d', '#d1544f', '#e3c04d'] },
  ],
  street: [
    { kind: 'sun', y: [30, 44], count: [0, 1], colors: ['#e3c04d'] },
    { kind: 'cloud', y: [24, 60], count: [1, 3], colors: SKY },
    { kind: 'building', y: [176, 182], count: [4, 5], colors: ['#e0913d', '#3f9c94', '#d99aae', '#4a72b0', '#e3c04d', '#8a6db5'] },
    { kind: 'bird', y: [30, 80], count: [1, 3], colors: ['#2e2d35', '#4a72b0'] },
    { kind: 'sign', y: [212, 222], count: [1, 2], colors: ['#4a72b0', '#d1544f', '#8cae4f'] },
    { kind: 'lamp', y: [222, 230], count: [1, 2], colors: ['#2e2d35', '#4a72b0'] },
    { kind: 'car', y: [252, 280], count: [2, 4], colors: ALL },
  ],
  space: [
    { kind: 'star', y: [16, 290], count: [8, 13], colors: ['#e3c04d', '#f6f3ec', '#d99aae'] },
    { kind: 'planet', y: [40, 250], count: [2, 3], colors: ['#e0913d', '#3f9c94', '#d1544f', '#8a6db5', '#8cae4f'] },
    { kind: 'rocket', y: [60, 230], count: [1, 2], colors: ['#f6f3ec', '#d1544f', '#e3c04d'] },
    { kind: 'ufo', y: [50, 200], count: [1, 2], colors: ['#8cae4f', '#3f9c94', '#d99aae'] },
  ],
  snow: [
    { kind: 'cloud', y: [24, 70], count: [2, 3], colors: SKY },
    { kind: 'bird', y: [40, 100], count: [1, 3], colors: ['#d1544f', '#4a72b0', '#2e2d35'] },
    { kind: 'house', y: [150, 170], count: [1, 2], colors: ['#d1544f', '#4a72b0', '#e3c04d', '#3f9c94'] },
    { kind: 'pine', y: [150, 205], count: [3, 5], colors: ['#3e7a4f', '#2f5e46', '#4f8a3c'] },
    { kind: 'snowman', y: [220, 260], count: [1, 2], colors: ['#d1544f', '#4a72b0', '#e0913d', '#8a6db5'] },
    { kind: 'present', y: [255, 290], count: [2, 4], colors: ALL },
  ],
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const THEME_NAMES: Record<ThemeId, string> = {
  meadow: 'Sunny Meadow',
  reef: 'Coral Reef',
  street: 'Main Street',
  space: 'Pastel Space',
  snow: 'Snow Day',
};

/** Detail variants per kind (v is drawn modulo this). */
export const VARIANTS: Partial<Record<Kind, number>> = {
  house: 4,
  flower: 3,
  fish: 3,
  building: 4,
  car: 3,
  balloon: 2,
  planet: 3,
  present: 3,
  shell: 2,
  snowman: 3,
  mushroom: 3,
  ufo: 3,
  kite: 3,
  tree: 2,
};

/** Builds a picture. `crowd` (0-1) adds objects for harder pictures. */
export function makeScene(seed: number, theme: ThemeId, crowd = 0): Scene {
  const r = rng(seed);
  const objects: Obj[] = [];
  let id = 0;
  for (const slot of THEMES[theme]) {
    const [lo, hi] = slot.count;
    const extra = slot.count[1] > 2 ? Math.round(crowd * 2) : 0;
    const n = lo + Math.floor(r() * (hi - lo + 1)) + extra;
    for (let i = 0; i < n; i++) {
      const s = slot.s ? between(r, slot.s[0], slot.s[1]) : between(r, 0.85, 1.15);
      const rad = RADIUS[slot.kind] * s;
      // Spread objects out: try a few spots and keep the one furthest from its neighbours.
      let best: { x: number; y: number; d: number } | null = null;
      for (let t = 0; t < 14; t++) {
        const x = slot.kind === 'building' ? 40 + ((i + r() * 0.3) * (W - 60)) / n : between(r, rad + 4, W - rad - 4);
        const y = between(r, slot.y[0], slot.y[1]);
        const d = Math.min(1e9, ...objects.filter((o) => o.kind === slot.kind || Math.abs(o.y - y) < 40).map((o) => Math.hypot(o.x - x, o.y - y) - RADIUS[o.kind] * o.s - rad));
        if (!best || d > best.d) best = { x, y, d };
      }
      const colors = slot.colors ?? ALL;
      objects.push({
        id: id++,
        kind: slot.kind,
        x: Math.round(best!.x),
        y: Math.round(best!.y),
        s: Math.round(s * 100) / 100,
        c: pick(r, colors),
        c2: pick(r, ALL),
        v: Math.floor(r() * (VARIANTS[slot.kind] ?? 1)),
        flip: r() < 0.5,
      });
    }
  }
  // Painter's order: things further down the picture are in front.
  objects.sort((a, b) => (a.kind === 'sun' ? -1 : b.kind === 'sun' ? 1 : a.y - b.y));
  return { theme, bg: Math.floor(r() * 3), objects };
}

/** Free spots for adding an object: candidates a fair distance from everything else. */
export function freeSpot(scene: Scene, r: R, kind: Kind, yBand: [number, number]): { x: number; y: number } | null {
  const rad = RADIUS[kind];
  for (let t = 0; t < 40; t++) {
    const x = between(r, rad + 6, W - rad - 6);
    const y = between(r, yBand[0], yBand[1]);
    if (scene.objects.every((o) => Math.hypot(o.x - x, o.y - y) > RADIUS[o.kind] * o.s + rad + 6)) return { x: Math.round(x), y: Math.round(y) };
  }
  return null;
}

/** The y band a kind lives in for a theme (for adding objects). */
export function bandFor(theme: ThemeId, kind: Kind): [number, number] | null {
  return THEMES[theme].find((s) => s.kind === kind)?.y ?? null;
}

export function colorsFor(theme: ThemeId, kind: Kind): readonly string[] {
  return THEMES[theme].find((s) => s.kind === kind)?.colors ?? ALL;
}
