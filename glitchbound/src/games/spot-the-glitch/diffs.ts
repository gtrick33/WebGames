/**
 * Turns a picture into a puzzle: picks exactly five fair, well-separated differences and builds the
 * "glitched" copy. Each difference records where it is (hit circles in scene units), so taps can be
 * checked exactly. Pure and seeded, unit tested.
 */
import { deltaE, hexToRgb } from '../color-recall/color';
import {
  ASYMMETRIC,
  bandFor,
  CLASSIC_THEMES,
  colorsFor,
  DETAILED,
  FIXED,
  freeSpot,
  H,
  makeScene,
  PALETTE,
  RADIUS,
  rng,
  THEME_IDS,
  VARIANTS,
  W,
  type Kind,
  type Obj,
  type Scene,
  type ThemeId,
} from './scene';

export const DIFFS = 5;

export type DiffType = 'color' | 'remove' | 'add' | 'scale' | 'flip' | 'detail' | 'move';

export interface Spot {
  x: number;
  y: number;
  r: number;
}

export interface Diff {
  type: DiffType;
  /** Where to tap (either picture); a move has two spots, before and after. */
  spots: Spot[];
}

export interface Puzzle {
  seed: number;
  difficulty: number;
  left: Scene;
  right: Scene;
  diffs: Diff[];
}

/** Difficulty 0 (bold changes, few objects) to 2 (subtle changes, crowded pictures). */
const TYPE_WEIGHTS: Record<DiffType, [number, number, number]> = {
  color: [5, 4, 3],
  remove: [5, 3, 2],
  add: [3, 3, 2],
  scale: [2, 3, 3],
  flip: [1, 2, 3],
  detail: [1, 3, 4],
  move: [1, 2, 3],
};

type R = () => number;

function weightedType(r: R, difficulty: number, allowed: DiffType[]): DiffType {
  const total = allowed.reduce((n, t) => n + TYPE_WEIGHTS[t][difficulty]!, 0);
  let x = r() * total;
  for (const t of allowed) {
    x -= TYPE_WEIGHTS[t][difficulty]!;
    if (x <= 0) return t;
  }
  return allowed[allowed.length - 1]!;
}

const hitR = (o: Obj): number => Math.max(20, RADIUS[o.kind] * o.s * 1.05);

/** Which differences make sense for an object. */
function typesFor(o: Obj): DiffType[] {
  const t: DiffType[] = ['color', 'scale', 'move'];
  if (!FIXED.has(o.kind)) t.push('remove');
  if (ASYMMETRIC.has(o.kind)) t.push('flip');
  if (DETAILED.has(o.kind)) t.push('detail');
  // Big fixed scenery (buildings, barns, the lighthouse) only changes color or detail; the sun and moon may also change size.
  if (FIXED.has(o.kind)) return t.filter((x) => x === 'color' || x === 'detail' || ((o.kind === 'sun' || o.kind === 'moon') && x === 'scale'));
  return t;
}

/** A clearly different color from the kind's own palette (or the full palette). */
function otherColor(r: R, theme: ThemeId, o: Obj): string {
  const pool = [...colorsFor(theme, o.kind), ...PALETTE].filter((c) => c !== o.c && deltaE(hexToRgb(c), hexToRgb(o.c)) > 25);
  return pool[Math.floor(r() * pool.length)] ?? (o.c === '#ff5a6c' ? '#3d7bff' : '#ff5a6c');
}

/**
 * A puzzle with exactly DIFFS differences (rare crowded pictures are regenerated from a derived seed).
 * `classic` rebuilds a puzzle exactly as the first published dailies made it (five themes, old shuffle).
 */
export function makePuzzle(seed: number, difficulty: number, theme?: ThemeId, classic = false): Puzzle {
  let p = buildPuzzle(seed, difficulty, theme, classic);
  for (let k = 1; p.diffs.length < DIFFS && k < 20; k++) p = buildPuzzle((seed + k * 0x9e3779b9) >>> 0, difficulty, theme, classic);
  return { ...p, seed };
}

/** Fisher-Yates (a random sort comparator shuffles differently in each browser, which would split the daily). */
function shuffled<T>(list: readonly T[], r: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function buildPuzzle(seed: number, difficulty: number, theme?: ThemeId, classic = false): Puzzle {
  const r = rng(seed);
  const pool = classic ? CLASSIC_THEMES : THEME_IDS;
  const th = theme ?? pool[Math.floor(r() * pool.length)]!;
  const left = makeScene(Math.floor(r() * 2 ** 32), th, difficulty / 2);
  const right: Scene = { ...left, objects: left.objects.map((o) => ({ ...o })) };
  const diffs: Diff[] = [];
  const used: Spot[] = [];
  const far = (x: number, y: number, rad: number): boolean => used.every((u) => Math.hypot(u.x - x, u.y - y) > u.r + rad + 8) && x > 8 && x < W - 8 && y > 8 && y < H - 8;
  const candidates = classic ? [...right.objects].sort(() => r() - 0.5) : shuffled(right.objects, r);
  let nextId = Math.max(...left.objects.map((o) => o.id)) + 1;

  // Usually one difference is an object that only exists in one picture.
  const adds = r() < 0.6 ? 1 : 0;
  for (const target of candidates) {
    if (diffs.length >= DIFFS - adds) break;
    const o = right.objects.find((x) => x.id === target.id);
    if (!o) continue;
    const rad = hitR(o);
    if (!far(o.x, o.y, rad)) continue;
    // Skip objects half hidden behind something drawn on top of them: the change might not show.
    const order = right.objects.indexOf(o);
    if (right.objects.slice(order + 1).some((f) => Math.hypot(f.x - o.x, f.y - o.y) < (RADIUS[f.kind] * f.s + RADIUS[o.kind] * o.s) * 0.6)) continue;
    // Tiny things only get bold changes; everything else follows the difficulty's mix.
    const small = RADIUS[o.kind] * o.s < 12;
    let types = typesFor(o);
    if (small) types = types.filter((t) => t === 'color' || t === 'remove' || t === 'scale');
    if (!types.length) continue;
    const type = weightedType(r, difficulty, types);
    const spot = { x: o.x, y: o.y, r: rad };
    switch (type) {
      case 'color':
        o.c = otherColor(r, th, o);
        break;
      case 'remove':
        right.objects = right.objects.filter((x) => x.id !== o.id);
        break;
      case 'scale': {
        // Grow only when the bigger object stays clear of the other differences; otherwise shrink.
        const grow = r() < 0.5 && far(o.x, o.y, Math.max(20, RADIUS[o.kind] * o.s * 1.45 * 1.05));
        o.s = Math.round(o.s * (grow ? 1.45 : 0.62) * 100) / 100;
        spot.r = Math.max(rad, hitR(o));
        break;
      }
      case 'flip':
        o.flip = !o.flip;
        break;
      case 'detail':
        o.v = (o.v + 1 + Math.floor(r() * Math.max(1, (VARIANTS[o.kind] ?? 2) - 1))) % (VARIANTS[o.kind] ?? 2);
        break;
      case 'move': {
        const dx = (r() < 0.5 ? -1 : 1) * (14 + r() * 10);
        const nx = Math.round(Math.min(W - rad, Math.max(rad, o.x + dx)));
        if (Math.abs(nx - o.x) < 12 || !far(nx, o.y, rad)) continue;
        o.x = nx;
        break;
      }
      case 'add':
        break;
    }
    const spots = [spot];
    if (type === 'move') spots.push({ x: o.x, y: o.y, r: rad });
    diffs.push({ type, spots });
    used.push(...spots);
  }

  // "Add" differences, and a fallback if the picture was too crowded for five changes.
  const addKinds = [...new Set(left.objects.map((o) => o.kind))].filter((k) => !FIXED.has(k));
  for (let tries = 0; diffs.length < DIFFS && tries < 60; tries++) {
    const kind = addKinds[Math.floor(r() * addKinds.length)] as Kind | undefined;
    if (!kind) break;
    const band = bandFor(th, kind) ?? [40, H - 40];
    const at = freeSpot(right, r, kind, band);
    if (!at) continue;
    const rad = Math.max(20, RADIUS[kind] * 1.05);
    if (!far(at.x, at.y, rad)) continue;
    const pool = colorsFor(th, kind);
    const obj: Obj = { id: nextId++, kind, x: at.x, y: at.y, s: 1, c: pool[Math.floor(r() * pool.length)]!, c2: PALETTE[Math.floor(r() * 8)]!, v: 0, flip: r() < 0.5 };
    right.objects = [...right.objects, obj].sort((a, b) => (a.kind === 'sun' ? -1 : b.kind === 'sun' ? 1 : a.y - b.y));
    const spot = { x: at.x, y: at.y, r: rad };
    diffs.push({ type: 'add', spots: [spot] });
    used.push(spot);
  }

  // Half the time the "original" is on the right, so players must really compare.
  return r() < 0.5 ? { seed, difficulty, left, right, diffs } : { seed, difficulty, left: right, right: left, diffs };
}

/** The difference at a tapped point (scene units), or -1. `slop` widens hit circles for fingers. */
export function diffAt(p: Puzzle, x: number, y: number, slop = 0): number {
  let best = -1;
  let bestD = Infinity;
  p.diffs.forEach((d, i) => {
    for (const s of d.spots) {
      const dist = Math.hypot(s.x - x, s.y - y);
      if (dist <= s.r + slop && dist < bestD) {
        best = i;
        bestD = dist;
      }
    }
  });
  return best;
}
