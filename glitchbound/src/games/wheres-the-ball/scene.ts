/**
 * Where's the Ball? scenes: top-down "drone shots" of tennis places, generated from a seed. A scene
 * is plain data (environment, clutter items, decoys and the one real ball with its exact position
 * and radius), so every level has a precise hitbox, the daily is identical for everyone and the
 * supply of levels never runs out. Drawing lives in paint.ts.
 *
 * Coordinates are scene units: W x H (4:3), y down.
 */

export const W = 800;
export const H = 600;

export type EnvId = 'hardcourt' | 'clay' | 'lawn' | 'locker' | 'picnic' | 'autumn';

export const ENV_NAMES: Record<EnvId, string> = {
  hardcourt: 'Center Court',
  clay: 'Clay Club',
  lawn: 'Grass Lawn',
  locker: 'Locker Room',
  picnic: 'Garden Party',
  autumn: 'Autumn Park',
};

export type ItemKind =
  | 'leaf'
  | 'lemon'
  | 'lime'
  | 'daisy'
  | 'dandelion'
  | 'towel'
  | 'bag'
  | 'bottle'
  | 'can'
  | 'racquet'
  | 'shoe'
  | 'cone'
  | 'cup'
  | 'cap'
  | 'apple'
  | 'golfball'
  | 'chair'
  | 'umbrella'
  | 'blanket'
  | 'plate'
  | 'pebble'
  | 'tuft'
  | 'puddle'
  | 'bench'
  | 'shadow';

export interface Item {
  kind: ItemKind;
  x: number;
  y: number;
  /** Size multiplier. */
  s: number;
  /** Rotation in radians. */
  rot: number;
  color: string;
}

export interface Ball {
  x: number;
  y: number;
  r: number;
  /** Seam rotation. */
  rot: number;
  /** 0 bright sun to ~0.5 deep shade. */
  shade: number;
  /** Dust or dirt tint (clay, mud), 0-1. */
  dust: number;
}

export interface Scene {
  env: EnvId;
  seed: number;
  variant: number;
  /** Items drawn below the ball. */
  under: Item[];
  /** Items drawn above the ball (some may partly cover it). */
  over: Item[];
  ball: Ball;
  difficulty: number;
}

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
const between = (r: R, a: number, b: number): number => a + r() * (b - a);
const pick = <T>(r: R, list: readonly T[]): T => list[Math.floor(r() * list.length)]!;

/** Ball radius per difficulty (scene units); Endless keeps shrinking slowly to a floor. */
export const ballRadius = (d: number): number => Math.max(5.5, [15, 12, 10, 8.2, 7][Math.min(4, d)]! - Math.max(0, d - 4) * 0.25);

/** Typical visual radius of each item at s = 1 (for spacing and cover checks). */
export const ITEM_R: Record<ItemKind, number> = {
  leaf: 12,
  lemon: 13,
  lime: 11,
  daisy: 9,
  dandelion: 9,
  towel: 40,
  bag: 46,
  bottle: 22,
  can: 14,
  racquet: 48,
  shoe: 24,
  cone: 13,
  cup: 12,
  cap: 20,
  apple: 13,
  golfball: 7,
  chair: 34,
  umbrella: 70,
  blanket: 90,
  plate: 22,
  pebble: 7,
  tuft: 12,
  puddle: 40,
  bench: 70,
  shadow: 80,
};

/** Things that look a bit like a tennis ball from above. */
const DECOYS: Record<EnvId, ItemKind[]> = {
  hardcourt: ['can', 'cap', 'golfball', 'lime', 'cone', 'bottle'],
  clay: ['leaf', 'lemon', 'cone', 'cap', 'pebble'],
  lawn: ['dandelion', 'daisy', 'lime', 'golfball', 'leaf', 'apple'],
  locker: ['lemon', 'lime', 'cap', 'can', 'cup', 'apple'],
  picnic: ['lemon', 'lime', 'apple', 'cup', 'dandelion', 'plate'],
  autumn: ['leaf', 'leaf', 'leaf', 'lemon', 'pebble', 'dandelion'],
};

/** Big, structural clutter per environment. */
const CLUTTER: Record<EnvId, ItemKind[]> = {
  hardcourt: ['towel', 'bag', 'racquet', 'bottle', 'shoe', 'bench', 'chair', 'shadow'],
  clay: ['towel', 'bag', 'racquet', 'shoe', 'bench', 'shadow', 'puddle'],
  lawn: ['tuft', 'towel', 'racquet', 'chair', 'umbrella', 'shadow', 'bag'],
  locker: ['bench', 'towel', 'bag', 'shoe', 'racquet', 'bottle'],
  picnic: ['blanket', 'umbrella', 'chair', 'plate', 'cup', 'racquet', 'shadow', 'tuft'],
  autumn: ['bench', 'shadow', 'racquet', 'bag', 'tuft', 'puddle'],
};

const TOWEL_COLORS = ['#ffffff', '#ff5a6c', '#3d7bff', '#ffd21f', '#12c6b3', '#a45cff', '#d9f24a'];
const BAG_COLORS = ['#14102a', '#ff5a6c', '#3d7bff', '#ff9f1c', '#2f9e6a', '#a45cff'];
const LEAF_COLORS = ['#e8c21f', '#d98b1f', '#c9d43a', '#b5651d', '#e0a526', '#cfe04a'];

function colorFor(r: R, kind: ItemKind): string {
  switch (kind) {
    case 'towel':
    case 'blanket':
      return pick(r, TOWEL_COLORS);
    case 'bag':
    case 'shoe':
    case 'cap':
    case 'chair':
    case 'umbrella':
    case 'bottle':
      return pick(r, BAG_COLORS.concat(['#d9f24a', '#ffffff']));
    case 'leaf':
      return pick(r, LEAF_COLORS);
    case 'racquet':
      return pick(r, ['#ff5a6c', '#3d7bff', '#14102a', '#ff9f1c', '#d9f24a']);
    case 'cup':
      return pick(r, ['#d9f24a', '#ffd21f', '#ffffff', '#ff7eb6']);
    default:
      return '#ffffff';
  }
}

export interface Difficulty {
  ballR: number;
  decoys: number;
  clutter: number;
  /** Chance an item partly covers the ball. */
  cover: number;
  /** Chance the ball sits in shade. */
  shade: number;
}

export function difficultyFor(d: number): Difficulty {
  const k = Math.min(4, d);
  return {
    ballR: ballRadius(d),
    decoys: [6, 12, 20, 28, 36][k]! + Math.max(0, d - 4) * 3,
    clutter: [8, 11, 14, 17, 20][k]! + Math.max(0, d - 4),
    cover: [0, 0.25, 0.45, 0.6, 0.7][k]!,
    shade: [0, 0.3, 0.45, 0.6, 0.7][k]!,
  };
}

export const ENV_IDS = Object.keys(ENV_NAMES) as EnvId[];

/** The playable floor for each environment (where balls and decoys can be). */
export function floorAt(env: EnvId, x: number, y: number): boolean {
  if (env === 'hardcourt' || env === 'clay') return !(Math.abs(y - 300) < 6 && x > 60 && x < 740); // not on the net cord
  return x > 10 && x < W - 10 && y > 10 && y < H - 10;
}

export function makeScene(seed: number, difficulty: number, env?: EnvId): Scene {
  const r = rng(seed);
  const e = env ?? pick(r, ENV_IDS);
  const diff = difficultyFor(difficulty);
  const under: Item[] = [];
  const over: Item[] = [];

  const place = (kind: ItemKind, s = between(r, 0.8, 1.2)): Item => {
    for (let t = 0; t < 10; t++) {
      const x = between(r, 30, W - 30);
      const y = between(r, 30, H - 30);
      if (floorAt(e, x, y)) return { kind, x, y, s, rot: r() * Math.PI * 2, color: colorFor(r, kind) };
    }
    return { kind, x: between(r, 30, W - 30), y: between(r, 30, H - 30), s, rot: r() * Math.PI * 2, color: colorFor(r, kind) };
  };

  for (let i = 0; i < diff.clutter; i++) under.push(place(pick(r, CLUTTER[e])));
  // Background texture items (always under).
  const texture: ItemKind | null = e === 'lawn' || e === 'picnic' ? 'tuft' : e === 'autumn' ? 'leaf' : e === 'clay' ? 'pebble' : null;
  if (texture) for (let i = 0; i < 18 + difficulty * 6; i++) under.push(place(texture, between(r, 0.6, 1.1)));

  // The ball: away from the very edges, and not sitting on a big object's centre.
  const R0 = diff.ballR;
  let ball: Ball = { x: 400, y: 300, r: R0, rot: r() * Math.PI, shade: 0, dust: 0 };
  for (let t = 0; t < 40; t++) {
    const x = between(r, 50, W - 50);
    const y = between(r, 50, H - 50);
    if (!floorAt(e, x, y)) continue;
    if (under.some((it) => (it.kind === 'bag' || it.kind === 'bench' || it.kind === 'umbrella') && Math.hypot(it.x - x, it.y - y) < ITEM_R[it.kind] * it.s * 0.6)) continue;
    ball = { x, y, r: R0, rot: r() * Math.PI, shade: r() < diff.shade ? between(r, 0.2, 0.45) : 0, dust: e === 'clay' ? between(r, 0.15, 0.45) : e === 'autumn' ? between(r, 0, 0.2) : 0 };
    break;
  }
  // A shadow under a shaded ball, so the shade has a visible cause.
  if (ball.shade > 0) under.push({ kind: 'shadow', x: ball.x + between(r, -20, 20), y: ball.y + between(r, -20, 20), s: between(r, 0.8, 1.3), rot: r() * Math.PI, color: '#000' });

  // Decoys: some near the ball (camouflage), the rest anywhere. Never on top of it.
  for (let i = 0; i < diff.decoys; i++) {
    const kind = pick(r, DECOYS[e]);
    let it = place(kind, between(r, 0.75, 1.15));
    if (i < diff.decoys * 0.3) {
      const a = r() * Math.PI * 2;
      const d = R0 * 2.4 + r() * 90;
      it = { ...it, x: ball.x + Math.cos(a) * d, y: ball.y + Math.sin(a) * d };
    }
    if (Math.hypot(it.x - ball.x, it.y - ball.y) < (ITEM_R[kind] * it.s + R0) * 1.1) continue;
    (r() < 0.5 ? under : over).push(it);
  }

  // Partial cover: one item overlapping the ball's edge, leaving most of it visible.
  if (r() < diff.cover) {
    const kind = pick(r, ['leaf', 'racquet', 'towel', 'tuft'] as const);
    const coverR = ITEM_R[kind];
    const a = r() * Math.PI * 2;
    const d = coverR + R0 * 0.35;
    over.push({ kind, x: ball.x + Math.cos(a) * d, y: ball.y + Math.sin(a) * d, s: 1, rot: a + Math.PI / 2, color: colorFor(r, kind) });
  }

  // Keep other "over" items from hiding the ball.
  const safeOver = over.filter((it, i) => i === over.length - 1 || Math.hypot(it.x - ball.x, it.y - ball.y) > ITEM_R[it.kind] * it.s + R0);
  return { env: e, seed, variant: Math.floor(r() * 3), under, over: safeOver, ball, difficulty };
}

/** Whether a guess (scene units) hits the ball. `slop` adds forgiveness for fingers. */
export function isHit(s: Scene, x: number, y: number, slop = 0): boolean {
  return Math.hypot(x - s.ball.x, y - s.ball.y) <= s.ball.r * 1.5 + slop;
}

/** Hot / warm / cold for a wrong guess, by distance. */
export function warmth(s: Scene, x: number, y: number): 'hot' | 'warm' | 'cold' {
  const d = Math.hypot(x - s.ball.x, y - s.ball.y);
  return d < 90 ? 'hot' : d < 220 ? 'warm' : 'cold';
}

/** A hint area containing the ball: a quarter of the picture, then a smaller box. */
export function hintBox(s: Scene, level: number, r: R = Math.random): { x: number; y: number; w: number; h: number } {
  const w = level <= 1 ? W / 2 : W / 4;
  const h = level <= 1 ? H / 2 : H / 4;
  // Seeded jitter so the box does not centre on the ball.
  const x = Math.min(W - w, Math.max(0, s.ball.x - w * (0.2 + r() * 0.6)));
  const y = Math.min(H - h, Math.max(0, s.ball.y - h * (0.2 + r() * 0.6)));
  return { x, y, w, h };
}
