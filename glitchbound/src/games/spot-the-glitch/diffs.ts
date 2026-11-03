/**
 * Turns a picture into a puzzle: picks exactly five fair, well-separated differences and builds the
 * "glitched" copy. Each difference records where it is (hit circles in scene units), so taps can be
 * checked exactly. Pure and seeded, unit tested.
 *
 * The fair generator checks every candidate against what it really draws (trace.ts): the change must
 * paint something, be big enough, show (not hidden behind something drawn later), stand out from the
 * backdrop, and its hit circle covers what changed. Older pictures keep their first generator so
 * published dailies never change; only their hit circles are refitted to the drawing.
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
import { backdropAt } from './draw';
import { area, bodyOf, changedOps, contrastWith, traceObj, union, type Box, type Op } from './trace';

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

/** Which generator built a puzzle: the first dailies' ('classic'), the next ones' ('v1') or the fair one. */
export type Gen = 'classic' | 'v1' | 'fair';

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

/** Kinds drawn without their main color `c` (bubbles are always white): a color change would not show. */
export const COLORLESS: ReadonlySet<Kind> = new Set(['bubbles']);

/** Which differences make sense for an object. */
function typesFor(o: Obj, fair = false): DiffType[] {
  const t: DiffType[] = fair && COLORLESS.has(o.kind) ? ['scale', 'move'] : ['color', 'scale', 'move'];
  if (!FIXED.has(o.kind)) t.push('remove');
  if (ASYMMETRIC.has(o.kind)) t.push('flip');
  if (DETAILED.has(o.kind)) t.push('detail');
  // Big fixed scenery (buildings, barns, the lighthouse) only changes color or detail; the sun and moon may also change size.
  if (FIXED.has(o.kind)) return t.filter((x) => x === 'color' || x === 'detail' || ((o.kind === 'sun' || o.kind === 'moon') && x === 'scale'));
  return t;
}

/** A clearly different color from the kind's own palette (or the full palette). */
function otherColor(r: R, theme: ThemeId, o: Obj, fair = false): string {
  const pool = [...colorsFor(theme, o.kind, fair), ...PALETTE].filter((c) => c !== o.c && deltaE(hexToRgb(c), hexToRgb(o.c)) > 25);
  return pool[Math.floor(r() * pool.length)] ?? (o.c === '#ff5a6c' ? '#3d7bff' : '#ff5a6c');
}

/**
 * A puzzle with exactly DIFFS differences (rare crowded pictures are regenerated from a derived seed).
 * `gen` 'classic' rebuilds a puzzle exactly as the first published dailies made it (five themes, old
 * shuffle), 'v1' as the dailies until the fair generator made it; both get refitted hit circles.
 */
export function makePuzzle(seed: number, difficulty: number, theme?: ThemeId, gen: Gen = 'fair'): Puzzle {
  const build = (s: number): Puzzle => (gen === 'fair' ? buildFair(s, difficulty, theme) : buildPuzzle(s, difficulty, theme, gen === 'classic'));
  let p = build(seed);
  for (let k = 1; p.diffs.length < DIFFS && k < 20; k++) p = build((seed + k * 0x9e3779b9) >>> 0);
  return { ...p, seed };
}

/* ------------------------------------------------------- drawn geometry */

/** A hit circle that covers a drawn box (at least 20 units, like every hit circle). */
function spotOf(b: Box): Spot {
  return { x: Math.round((b.x0 + b.x1) / 2), y: Math.round((b.y0 + b.y1) / 2), r: Math.max(20, Math.round(Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.525 * 10) / 10) };
}

/** Painted area of some ops, in scene units² (a shape's fill and edge count once). */
function paintedArea(ops: readonly Op[]): number {
  const seen = new Set<string>();
  let n = 0;
  for (const op of ops) {
    const k = [op.box.x0, op.box.y0, op.box.x1, op.box.y1].map((v) => Math.round(v)).join(',');
    if (seen.has(k)) continue;
    seen.add(k);
    n += area(op.box);
  }
  return Math.min(n, area(union(ops.map((op) => op.box))!));
}

/** The solid part of what changed between two drawings of an object (null: nothing visible changed). */
function changedBox(before: readonly Op[], after: readonly Op[]): { box: Box; area: number } | null {
  const ch = changedOps(before, after).filter((op) => !op.faint);
  return ch.length ? { box: union(ch.map((op) => op.box))!, area: paintedArea(ch) } : null;
}

/**
 * Share of a box that is not covered by the bodies of objects drawn after `index` (sampled on a grid;
 * covering bodies are shrunk a little, since round shapes do not fill their corners).
 */
function shownShare(objects: readonly Obj[], index: number, box: Box, ops: (o: Obj) => Op[]): number {
  const covers = objects
    .slice(index + 1)
    .map((f) => bodyOf(ops(f)))
    .filter((b): b is Box => !!b && b.x1 > box.x0 && b.x0 < box.x1 && b.y1 > box.y0 && b.y0 < box.y1)
    .map((b) => {
      const dx = Math.min(3, (b.x1 - b.x0) * 0.08);
      const dy = Math.min(3, (b.y1 - b.y0) * 0.08);
      return { x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 - dx, y1: b.y1 - dy };
    });
  if (!covers.length) return 1;
  let shown = 0;
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 6; j++) {
      const x = box.x0 + ((i + 0.5) / 6) * (box.x1 - box.x0);
      const y = box.y0 + ((j + 0.5) / 6) * (box.y1 - box.y0);
      if (!covers.some((b) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1)) shown++;
    }
  return shown / 36;
}

/**
 * Older generators' hit circles were centered on each object's anchor, which misses the tops of tall
 * buildings, a sandcastle's flag and mirrored drawings. Refit each to what the difference really drew,
 * where the bigger circle stays clear of the other differences (the pictures themselves never change).
 */
function refit(left: Scene, right: Scene, diffs: Diff[], ids: number[]): void {
  diffs.forEach((d, i) => {
    const a = left.objects.find((o) => o.id === ids[i]);
    const b = right.objects.find((o) => o.id === ids[i]);
    const before = a ? traceObj(a) : [];
    const after = b ? traceObj(b) : [];
    let spots: Spot[];
    if (d.type === 'move') {
      const pa = bodyOf(before);
      const pb = bodyOf(after);
      if (!pa || !pb) return;
      spots = [spotOf(pa), spotOf(pb)];
    } else {
      const ch = changedBox(before, after);
      if (!ch) return;
      spots = [spotOf(ch.box)];
    }
    const others = diffs.flatMap((e, j) => (j === i ? [] : e.spots));
    const clear = spots.every((s) => s.x > 0 && s.x < W && s.y > 0 && s.y < H && others.every((t) => Math.hypot(s.x - t.x, s.y - t.y) > s.r + t.r));
    if (clear) d.spots = spots;
  });
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
  const ids: number[] = [];
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
    ids.push(o.id);
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
    ids.push(obj.id);
    used.push(spot);
  }
  refit(left, right, diffs, ids);

  // Half the time the "original" is on the right, so players must really compare.
  return r() < 0.5 ? { seed, difficulty, left, right, diffs } : { seed, difficulty, left: right, right: left, diffs };
}

/** Changes easy pictures may use: bold ones only (no tiny details, mirrors or nudges). */
const BOLD: ReadonlySet<DiffType> = new Set(['color', 'remove', 'add', 'scale']);
/** Least painted area of a change per difficulty, scene units² (about 70, 45 and 30 css px² on a 280 px picture). */
const MIN_AREA = [140, 90, 60];
/** Least deltaE between an object's colors and the backdrop for a change of shape (remove, add, move...). */
const MIN_CONTRAST = 15;
/** Least share of a change that must show (not covered by things drawn later). */
const MIN_SHOWN = 0.6;
const order = (a: Obj, b: Obj): number => (a.kind === 'sun' ? -1 : b.kind === 'sun' ? 1 : a.y - b.y);

function buildFair(seed: number, difficulty: number, theme?: ThemeId): Puzzle {
  const r = rng(seed);
  const th = theme ?? THEME_IDS[Math.floor(r() * THEME_IDS.length)]!;
  const left = makeScene(Math.floor(r() * 2 ** 32), th, difficulty / 2, true);
  const right: Scene = { ...left, objects: left.objects.map((o) => ({ ...o })) };
  const traces = new Map<Obj, Op[]>();
  const ops = (o: Obj): Op[] => {
    let t = traces.get(o);
    if (!t) traces.set(o, (t = traceObj(o)));
    return t;
  };
  const diffs: Diff[] = [];
  const used: Spot[] = [];
  const far = (s: Spot): boolean => used.every((u) => Math.hypot(u.x - s.x, u.y - s.y) > u.r + s.r + 8) && s.x > 8 && s.x < W - 8 && s.y > 8 && s.y < H - 8;
  const minArea = MIN_AREA[difficulty] ?? MIN_AREA[2]!;
  const standsOut = (o: Obj): boolean => {
    const body = bodyOf(ops(o));
    return !!body && contrastWith(ops(o), backdropAt(left, (body.y0 + body.y1) / 2)) >= MIN_CONTRAST;
  };
  /** The hit circle of an object shown (or changed) in a picture, or null if it would not be fair. */
  const shown = (objects: readonly Obj[], o: Obj, ch: { box: Box; area: number } | null): Spot | null => {
    if (!ch || ch.area < minArea) return null;
    if (shownShare(objects, objects.indexOf(o), ch.box, ops) < MIN_SHOWN) return null;
    const spot = spotOf(ch.box);
    return far(spot) ? spot : null;
  };
  const candidates = shuffled(right.objects, r);
  let nextId = Math.max(...left.objects.map((o) => o.id)) + 1;

  // Usually one difference is an object that only exists in one picture.
  const adds = r() < 0.6 ? 1 : 0;
  for (const target of candidates) {
    if (diffs.length >= DIFFS - adds) break;
    const i = right.objects.findIndex((x) => x.id === target.id);
    const o = right.objects[i];
    if (!o) continue;
    // Tiny things only get bold changes, as do easy pictures; everything else follows the difficulty's mix.
    const small = RADIUS[o.kind] * o.s < 12;
    let types = typesFor(o, true);
    if (small) types = types.filter((t) => t === 'color' || t === 'remove' || t === 'scale');
    if (difficulty === 0) types = types.filter((t) => BOLD.has(t));
    if (!types.length) continue;
    const type = weightedType(r, difficulty, types);
    const swap = (n: Obj): Obj[] => right.objects.map((x, j) => (j === i ? n : x));
    let spots: Spot[] | null = null;
    let next: Obj[] | null = null;
    switch (type) {
      case 'remove': {
        if (!standsOut(o)) break;
        const s = shown(right.objects, o, changedBox(ops(o), []));
        if (s) [spots, next] = [[s], right.objects.filter((x) => x.id !== o.id)];
        break;
      }
      case 'move': {
        const dx = (r() < 0.5 ? -1 : 1) * (14 + r() * 10);
        const rad = Math.max(20, RADIUS[o.kind] * o.s * 1.05);
        const nx = Math.round(Math.min(W - rad, Math.max(rad, o.x + dx)));
        if (Math.abs(nx - o.x) < 12 || !standsOut(o)) break;
        const n = { ...o, x: nx };
        const objs = swap(n);
        const a = bodyOf(ops(o));
        const b = bodyOf(ops(n));
        if (!a || !b || area(a) < minArea) break;
        const sa = shown(right.objects, o, { box: a, area: area(a) });
        const sb = sa && shown(objs, n, { box: b, area: area(b) });
        if (sa && sb && Math.hypot(sa.x - sb.x, sa.y - sb.y) >= 12) [spots, next] = [[sa, sb], objs];
        break;
      }
      default: {
        // Grow only when the bigger object stays clear of the other differences; otherwise shrink.
        const options: Obj[] =
          type === 'color'
            ? [{ ...o, c: otherColor(r, th, o, true) }]
            : type === 'flip'
              ? [{ ...o, flip: !o.flip }]
              : type === 'detail'
                ? [{ ...o, v: (o.v + 1 + Math.floor(r() * Math.max(1, (VARIANTS[o.kind] ?? 2) - 1))) % (VARIANTS[o.kind] ?? 2) }]
                : (r() < 0.5 ? [1.45, 0.62] : [0.62]).map((k) => ({ ...o, s: Math.round(o.s * k * 100) / 100 }));
        if ((type === 'scale' || type === 'flip') && !standsOut(o)) break;
        for (const n of options) {
          const objs = swap(n);
          const s = shown(objs, n, changedBox(ops(o), ops(n)));
          if (s) {
            [spots, next] = [[s], objs];
            break;
          }
        }
      }
    }
    if (!spots || !next) continue;
    right.objects = next;
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
    const pool = colorsFor(th, kind, true);
    const obj: Obj = { id: nextId++, kind, x: at.x, y: at.y, s: 1, c: pool[Math.floor(r() * pool.length)]!, c2: PALETTE[Math.floor(r() * 8)]!, v: 0, flip: r() < 0.5 };
    if (!standsOut(obj)) continue;
    const objs = [...right.objects, obj].sort(order);
    const s = shown(objs, obj, changedBox([], ops(obj)));
    if (!s) continue;
    right.objects = objs;
    diffs.push({ type: 'add', spots: [s] });
    used.push(s);
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
