/**
 * Procedural pictures for Spot the Glitch. A picture is plain data (a theme plus a list of objects),
 * generated from a seed, so the library is effectively endless, every daily is identical for every
 * player, and each difference has exact coordinates. Drawing lives in draw.ts.
 *
 * Coordinates are in scene units: the picture is W x H (4:3); y grows downward.
 */

export const W = 400;
export const H = 300;

export type ThemeId = 'meadow' | 'reef' | 'street' | 'space' | 'snow' | 'beach' | 'farm' | 'kitchen' | 'night' | 'jungle' | 'camp' | 'harbor' | 'party';

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
  | 'mushroom'
  // Beach
  | 'umbrella'
  | 'towel'
  | 'sandcastle'
  | 'bucket'
  | 'crab'
  | 'beachball'
  | 'boat'
  // Farm
  | 'barn'
  | 'tractor'
  | 'cow'
  | 'sheep'
  | 'chicken'
  | 'hay'
  | 'fence'
  | 'pumpkin'
  // Kitchen
  | 'clock'
  | 'frame'
  | 'jar'
  | 'mug'
  | 'plant'
  | 'teapot'
  | 'pot'
  | 'apple'
  | 'bread'
  // Night, jungle, camp, harbor, party
  | 'moon'
  | 'cat'
  | 'palm'
  | 'parrot'
  | 'butterfly'
  | 'monkey'
  | 'frog'
  | 'tent'
  | 'campfire'
  | 'lantern'
  | 'owl'
  | 'log'
  | 'lighthouse'
  | 'buoy'
  | 'cake'
  | 'partyhat';

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
  umbrella: 26,
  towel: 18,
  sandcastle: 22,
  bucket: 12,
  crab: 12,
  beachball: 11,
  boat: 24,
  barn: 36,
  tractor: 24,
  cow: 22,
  sheep: 16,
  chicken: 10,
  hay: 16,
  fence: 34,
  pumpkin: 12,
  clock: 14,
  frame: 16,
  jar: 11,
  mug: 10,
  plant: 16,
  teapot: 16,
  pot: 16,
  apple: 9,
  bread: 14,
  moon: 20,
  cat: 14,
  palm: 30,
  parrot: 12,
  butterfly: 10,
  monkey: 16,
  frog: 11,
  tent: 26,
  campfire: 16,
  lantern: 11,
  owl: 16,
  log: 18,
  lighthouse: 34,
  buoy: 11,
  cake: 22,
  partyhat: 11,
};

/** Kinds that look different when mirrored (so a flip is a fair difference). */
export const ASYMMETRIC: ReadonlySet<Kind> = new Set([
  'bird',
  'fish',
  'car',
  'house',
  'rocket',
  'sign',
  'kite',
  'lamp',
  'snowman',
  'sandcastle',
  'boat',
  'tractor',
  'cow',
  'sheep',
  'chicken',
  'mug',
  'teapot',
  'cat',
  'palm',
  'parrot',
  'monkey',
  'log',
  'lighthouse',
]);

/** Kinds whose `v` changes something visible. */
export const DETAILED: ReadonlySet<Kind> = new Set([
  'house',
  'flower',
  'fish',
  'building',
  'car',
  'balloon',
  'planet',
  'present',
  'shell',
  'snowman',
  'mushroom',
  'ufo',
  'kite',
  'tree',
  'umbrella',
  'towel',
  'sandcastle',
  'beachball',
  'boat',
  'barn',
  'cow',
  'hay',
  'fence',
  'pumpkin',
  'clock',
  'frame',
  'jar',
  'mug',
  'plant',
  'apple',
  'bread',
  'moon',
  'cat',
  'palm',
  'butterfly',
  'tent',
  'lantern',
  'owl',
  'lighthouse',
  'buoy',
  'cake',
  'partyhat',
]);

/** Kinds that are scenery and too big or too structural to remove or add. */
export const FIXED: ReadonlySet<Kind> = new Set(['sun', 'building', 'barn', 'lighthouse', 'moon']);

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
  beach: [
    { kind: 'sun', y: [30, 46], count: [1, 1], colors: ['#e3c04d'] },
    { kind: 'cloud', y: [24, 70], count: [1, 3], colors: SKY },
    { kind: 'bird', y: [40, 115], count: [2, 3], colors: ['#f6f3ec', '#9a9aa6'] },
    { kind: 'boat', y: [158, 176], count: [1, 2], colors: ['#d1544f', '#4a72b0', '#e3c04d', '#3f9c94'] },
    { kind: 'umbrella', y: [208, 230], count: [1, 2], colors: WARM.slice(0, 5) },
    { kind: 'towel', y: [238, 282], count: [1, 3], colors: ALL },
    { kind: 'sandcastle', y: [226, 270], count: [1, 2], colors: ['#d1544f', '#4a72b0', '#e3c04d'] },
    { kind: 'bucket', y: [246, 288], count: [1, 3], colors: ['#d1544f', '#4a72b0', '#8cae4f', '#e0913d'] },
    { kind: 'beachball', y: [232, 288], count: [1, 2], colors: ['#d1544f', '#4a72b0', '#8cae4f'] },
    { kind: 'crab', y: [256, 290], count: [1, 2], colors: ['#d1544f', '#e0913d'] },
    { kind: 'shell', y: [256, 292], count: [2, 3], colors: ['#ead6bd', '#d99aae', '#f6f3ec'] },
    { kind: 'starfish', y: [258, 292], count: [1, 2], colors: ['#e0913d', '#d1544f', '#e3c04d'] },
  ],
  farm: [
    { kind: 'sun', y: [30, 46], count: [0, 1], colors: ['#e3c04d'] },
    { kind: 'cloud', y: [24, 70], count: [2, 3], colors: SKY },
    { kind: 'bird', y: [40, 100], count: [1, 3], colors: ['#2e2d35', '#8b5a3c'] },
    { kind: 'barn', y: [146, 152], count: [1, 1], colors: ['#c0473f', '#b5573f', '#8a6db5', '#4a72b0'] },
    { kind: 'tree', y: [150, 180], count: [1, 2], colors: ['#4f8a3c', '#8cae4f', '#3e7a4f'] },
    { kind: 'fence', y: [192, 200], count: [1, 2], colors: ['#f6f3ec', '#8b5a3c', '#c9b48a'] },
    { kind: 'tractor', y: [214, 236], count: [0, 1], colors: ['#d1544f', '#8cae4f', '#4a72b0', '#e3c04d'] },
    { kind: 'cow', y: [210, 250], count: [1, 2], colors: ['#2e2d35', '#8b5a3c'] },
    { kind: 'sheep', y: [214, 258], count: [2, 3], colors: ['#f6f3ec', '#ead6bd', '#c9c3b8'] },
    { kind: 'hay', y: [212, 250], count: [1, 2], colors: ['#e3c04d', '#d9b65a'] },
    { kind: 'chicken', y: [252, 286], count: [2, 3], colors: ['#f6f3ec', '#b5573f', '#e0913d'] },
    { kind: 'pumpkin', y: [262, 290], count: [1, 3], colors: ['#e0913d', '#e3c04d', '#d1544f'] },
  ],
  kitchen: [
    { kind: 'clock', y: [30, 40], count: [1, 1], colors: ['#d1544f', '#4a72b0', '#3f9c94', '#2e2d35'] },
    { kind: 'frame', y: [30, 42], count: [1, 2], colors: ['#8b5a3c', '#e3c04d', '#2e2d35', '#f6f3ec'] },
    { kind: 'jar', y: [82, 84], count: [2, 3], colors: ['#d1544f', '#e0913d', '#8a6db5', '#8cae4f'] },
    { kind: 'plant', y: [78, 80], count: [1, 1], colors: ['#c9714f', '#4a72b0', '#f6f3ec'] },
    { kind: 'mug', y: [86, 88], count: [1, 2], colors: ALL },
    { kind: 'teapot', y: [168, 205], count: [1, 1], colors: ['#4a72b0', '#d99aae', '#3f9c94', '#f6f3ec'] },
    { kind: 'pot', y: [170, 210], count: [0, 1], colors: ['#d1544f', '#9a9aa6', '#3f9c94'] },
    { kind: 'bread', y: [200, 260], count: [1, 2], colors: ['#c98a4a', '#b5733c'] },
    { kind: 'apple', y: [205, 285], count: [3, 5], colors: ['#d1544f', '#8cae4f', '#e3c04d'] },
    { kind: 'mug', y: [215, 285], count: [1, 2], colors: ALL },
    { kind: 'jar', y: [220, 285], count: [0, 1], colors: ['#d1544f', '#e0913d', '#8a6db5'] },
  ],
  night: [
    { kind: 'moon', y: [36, 60], count: [1, 1], colors: ['#f2e6b8'] },
    { kind: 'star', y: [14, 120], count: [6, 9], colors: ['#f2e6b8', '#f6f3ec'] },
    { kind: 'building', y: [176, 182], count: [4, 5], colors: ['#3b3f6b', '#4a3f63', '#2f4a5c', '#5a4a6b'] },
    { kind: 'cat', y: [212, 222], count: [1, 1], colors: ['#2e2d35', '#e0913d', '#9a9aa6', '#f6f3ec'] },
    { kind: 'lamp', y: [222, 230], count: [1, 2], colors: ['#2e2d35', '#4a72b0'] },
    { kind: 'car', y: [254, 282], count: [2, 3], colors: ALL },
  ],
  jungle: [
    { kind: 'parrot', y: [40, 130], count: [2, 3], colors: ['#d1544f', '#4a72b0', '#8cae4f', '#e3c04d'] },
    { kind: 'monkey', y: [70, 140], count: [1, 1], colors: ['#8b5a3c', '#6b4a35'] },
    { kind: 'palm', y: [150, 196], count: [2, 3], colors: ['#3e7a4f', '#4f8a3c', '#2f5e46'] },
    { kind: 'butterfly', y: [60, 210], count: [2, 3], colors: ['#e0913d', '#4a72b0', '#d99aae', '#e3c04d'] },
    { kind: 'weed', y: [232, 262], count: [2, 3], colors: ['#3e7a4f', '#4f8a3c'] },
    { kind: 'flower', y: [240, 292], count: [3, 5], colors: ['#d1544f', '#d99aae', '#e0913d', '#8a6db5'] },
    { kind: 'frog', y: [258, 290], count: [1, 2], colors: ['#8cae4f', '#3f9c94', '#e0913d'] },
    { kind: 'mushroom', y: [258, 290], count: [1, 2], colors: ['#d1544f', '#e0913d'] },
  ],
  camp: [
    { kind: 'moon', y: [28, 50], count: [0, 1], colors: ['#f2e6b8'] },
    { kind: 'star', y: [12, 70], count: [2, 4], colors: ['#f2e6b8', '#f6f3ec'] },
    { kind: 'owl', y: [222, 262], count: [1, 1], colors: ['#8b5a3c', '#9a9aa6', '#c98a4a'] },
    { kind: 'pine', y: [150, 200], count: [2, 4], colors: ['#3e7a4f', '#2f5e46', '#4f8a3c'] },
    { kind: 'tree', y: [150, 190], count: [1, 2], colors: ['#e0913d', '#d1544f', '#e3c04d'] },
    { kind: 'tent', y: [206, 228], count: [1, 2], colors: ['#e0913d', '#4a72b0', '#8cae4f', '#d1544f'] },
    { kind: 'campfire', y: [244, 266], count: [1, 1], colors: ['#e0913d', '#d1544f'] },
    { kind: 'lantern', y: [228, 284], count: [1, 2], colors: ['#2e2d35', '#4a72b0', '#d1544f'] },
    { kind: 'log', y: [258, 288], count: [1, 2], colors: ['#8b5a3c', '#a06a45'] },
    { kind: 'mushroom', y: [262, 292], count: [1, 2], colors: ['#d1544f', '#e0913d', '#8a6db5'] },
  ],
  harbor: [
    { kind: 'sun', y: [30, 46], count: [0, 1], colors: ['#e3c04d'] },
    { kind: 'cloud', y: [24, 80], count: [1, 3], colors: SKY },
    { kind: 'bird', y: [34, 120], count: [2, 4], colors: ['#f6f3ec', '#9a9aa6'] },
    { kind: 'lighthouse', y: [118, 126], count: [1, 1], colors: ['#d1544f', '#4a72b0', '#2e2d35'] },
    { kind: 'boat', y: [168, 280], count: [3, 5], colors: ALL },
    { kind: 'buoy', y: [180, 290], count: [2, 3], colors: ['#d1544f', '#e3c04d', '#e0913d'] },
    { kind: 'fish', y: [250, 290], count: [0, 1], colors: ['#9a9aa6', '#e0913d'] },
  ],
  party: [
    { kind: 'frame', y: [36, 48], count: [0, 1], colors: ['#e3c04d', '#8b5a3c'] },
    { kind: 'balloon', y: [40, 150], count: [3, 5], colors: ALL },
    { kind: 'star', y: [20, 160], count: [2, 3], colors: ['#e3c04d', '#d99aae', '#8a6db5'] },
    { kind: 'cake', y: [214, 222], count: [1, 1], colors: ['#d99aae', '#8b5a3c', '#f6f3ec', '#3f9c94'] },
    { kind: 'present', y: [240, 290], count: [2, 4], colors: ALL },
    { kind: 'partyhat', y: [236, 286], count: [2, 3], colors: ALL },
    { kind: 'mug', y: [240, 286], count: [1, 2], colors: ALL },
    { kind: 'apple', y: [250, 290], count: [0, 1], colors: ['#d1544f', '#8cae4f'] },
  ],
};

/** The five themes of the first published dailies (their pictures must stay exactly as they were). */
export const CLASSIC_THEMES: ThemeId[] = ['meadow', 'reef', 'street', 'space', 'snow'];

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const THEME_NAMES: Record<ThemeId, string> = {
  meadow: 'Sunny Meadow',
  reef: 'Coral Reef',
  street: 'Main Street',
  space: 'Pastel Space',
  snow: 'Snow Day',
  beach: 'Beach Day',
  farm: 'Country Farm',
  kitchen: 'Cozy Kitchen',
  night: 'City Night',
  jungle: 'Jungle',
  camp: 'Campsite',
  harbor: 'Harbor',
  party: 'Birthday Party',
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
  umbrella: 3,
  towel: 3,
  sandcastle: 3,
  beachball: 3,
  boat: 3,
  barn: 3,
  cow: 3,
  hay: 2,
  fence: 3,
  pumpkin: 3,
  clock: 3,
  frame: 3,
  jar: 3,
  mug: 3,
  plant: 3,
  apple: 2,
  bread: 3,
  moon: 2,
  cat: 2,
  palm: 3,
  butterfly: 2,
  tent: 2,
  lantern: 2,
  owl: 2,
  lighthouse: 2,
  buoy: 2,
  cake: 3,
  partyhat: 2,
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
