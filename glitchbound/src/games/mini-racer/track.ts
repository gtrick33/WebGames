import { buildPath, leftOf, minSelfClearance, nearest, pointAt, resample, spline, type Path, type Vec } from './geometry';

/** Ground types. Each changes top speed, acceleration and how much the tyres grip. */
export type Surface = 'asphalt' | 'grass' | 'sand' | 'dirt' | 'ice' | 'snow' | 'mud' | 'boost';

export interface SurfaceProps {
  /** Multiplier on top speed. */
  speed: number;
  /** Multiplier on acceleration. */
  accel: number;
  /** Multiplier on lateral grip (low = slides). */
  grip: number;
  /** Extra rolling drag per second. */
  drag: number;
}

export const SURFACES: Record<Surface, SurfaceProps> = {
  asphalt: { speed: 1, accel: 1, grip: 1, drag: 0 },
  boost: { speed: 1, accel: 1, grip: 1, drag: 0 },
  dirt: { speed: 0.9, accel: 0.85, grip: 0.62, drag: 0.1 },
  ice: { speed: 1, accel: 0.55, grip: 0.22, drag: 0 },
  grass: { speed: 0.56, accel: 0.7, grip: 0.7, drag: 0.6 },
  sand: { speed: 0.5, accel: 0.6, grip: 0.55, drag: 0.8 },
  snow: { speed: 0.52, accel: 0.6, grip: 0.5, drag: 0.7 },
  mud: { speed: 0.45, accel: 0.5, grip: 0.45, drag: 1.4 },
};

export type ThemeId = 'bay' | 'frost' | 'canyon';
export type ObstacleKind = 'tires' | 'rock' | 'crate' | 'cone';

/**
 * A track as authored. Everything except the centreline is placed in track coordinates
 * (`at` = fraction of the lap from the start line, `off` = sideways offset in world units,
 * positive = left of the driving direction), which keeps features on the road when the shape is tweaked.
 */
/** A place on the lap: a fraction from the start line, or a world point snapped to the closest spot on the road. */
export type At = number | [number, number];

export interface TrackDef {
  id: string;
  name: string;
  blurb: string;
  theme: ThemeId;
  /** Road width in world units (the car is about 34 long). */
  width: number;
  /** Closed centreline control points, driven in this order. */
  points: [number, number][];
  /** Ground beside the road. */
  offroad: Surface;
  /** Stretches of road with a different surface. */
  zones?: { from: At; to: At; surface: Surface }[];
  /** Patches on the road (boost pads, puddles, ice sheets): rectangles along the road. */
  patches?: { at: At; off: number; len: number; wide: number; surface: Surface }[];
  /** Obstacles beside/on the road. `exact` places an [x, y] `at` as-is (e.g. a rock on the shortcut) instead of snapping it to the road. */
  obstacles?: { at: At; off: number; r: number; kind: ObstacleKind; exact?: boolean }[];
  /** A risky alternative route between two points of the lap (through `via`). */
  shortcut?: { from: At; to: At; via: [number, number][]; width: number; surface: Surface };
  /** Number of checkpoints including the start/finish line. */
  checkpoints: number;
  /** Gold lap time in ms; silver and bronze are derived. */
  par: number;
  /** Seed for scenery placement. */
  seed: number;
}

/** A line across the road the car must cross in the driving direction. */
export interface Gate {
  a: Vec;
  b: Vec;
  /** Driving direction across the gate (unit). */
  dir: Vec;
}

export interface Checkpoint {
  /** Any one of these counts (the main road, or the shortcut that bypasses it). */
  gates: Gate[];
}

export interface Patch {
  c: Vec;
  /** Unit vector along the road. */
  t: Vec;
  len: number;
  wide: number;
  surface: Surface;
}

export interface Obstacle {
  x: number;
  y: number;
  r: number;
  kind: ObstacleKind;
}

export interface Decor {
  x: number;
  y: number;
  s: number;
  kind: number;
  rot: number;
}

export interface Zone {
  from: number;
  to: number;
  surface: Surface;
}

/** A track ready to drive: sampled paths, gates, obstacles and scenery. */
export interface Track {
  def: TrackDef;
  path: Path;
  half: number;
  shortcut: { path: Path; half: number; surface: Surface } | null;
  zones: Zone[];
  /** Lap fractions where the shortcut leaves and rejoins the road. */
  shortcutRange: { from: number; to: number } | null;
  patches: Patch[];
  obstacles: Obstacle[];
  checkpoints: Checkpoint[];
  decor: Decor[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Where cars line up, facing the driving direction. */
  start: { x: number; y: number; a: number };
}

export const KERB = 9;

/** Deterministic PRNG (mulberry32). */
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

function gateAt(path: Path, s: number, half: number): Gate {
  const { p, t } = pointAt(path, s);
  const n = leftOf(t);
  const r = half + KERB + 14;
  return { a: { x: p.x + n.x * r, y: p.y + n.y * r }, b: { x: p.x - n.x * r, y: p.y - n.y * r }, dir: t };
}

/** Is fraction f inside the lap interval [from, to) (which may wrap past the start line)? */
export function inRange(f: number, from: number, to: number): boolean {
  return from <= to ? f >= from && f < to : f >= from || f < to;
}

/** Checkpoint indices (in driving order) inside the shortcut's stretch of road. */
export function bypassed(count: number, range: { from: number; to: number }): number[] {
  const out: number[] = [];
  for (let k = 1; k < count; k++) if (inRange(k / count, range.from, range.to)) out.push(k);
  // Driving order: distance from where the shortcut leaves (the stretch may wrap past the line).
  const ahead = (k: number): number => (k / count - range.from + 1) % 1;
  return out.sort((a, b) => ahead(a) - ahead(b));
}

export function buildTrack(def: TrackDef): Track {
  const ctrl = def.points.map(([x, y]) => ({ x, y }));
  const path = buildPath(resample(spline(ctrl, true, 24), 10, true), true);
  const half = def.width / 2;
  const L = path.length;
  const frac = (at: At): number => (typeof at === 'number' ? at : nearest(path, { x: at[0], y: at[1] }).s / L);

  let shortcut: Track['shortcut'] = null;
  let scRange: { from: number; to: number } | null = null;
  if (def.shortcut) {
    const sc = def.shortcut;
    scRange = { from: frac(sc.from), to: frac(sc.to) };
    const a = pointAt(path, scRange.from * L);
    const b = pointAt(path, scRange.to * L);
    // Lead in and out along the road so the shortcut leaves and joins tangentially.
    const lead = 40;
    const pts = [
      a.p,
      { x: a.p.x + a.t.x * lead, y: a.p.y + a.t.y * lead },
      ...sc.via.map(([x, y]) => ({ x, y })),
      { x: b.p.x - b.t.x * lead, y: b.p.y - b.t.y * lead },
      b.p,
    ];
    shortcut = { path: buildPath(resample(spline(pts, false, 16), 10, false), false), half: sc.width / 2, surface: sc.surface };
  }

  const checkpoints: Checkpoint[] = [];
  for (let k = 0; k < def.checkpoints; k++) checkpoints.push({ gates: [gateAt(path, (k / def.checkpoints) * L, half)] });
  if (shortcut && scRange) {
    // Checkpoints the shortcut skips get matching gates spread along the shortcut, in the same order.
    const skipped = bypassed(def.checkpoints, scRange);
    skipped.forEach((k, i) => {
      checkpoints[k]!.gates.push(gateAt(shortcut.path, (shortcut.path.length * (i + 1)) / (skipped.length + 1), shortcut.half));
    });
  }

  const placed = (at: At, off: number): { p: Vec; t: Vec } => {
    const { p, t } = pointAt(path, frac(at) * L);
    const n = leftOf(t);
    return { p: { x: p.x + n.x * off, y: p.y + n.y * off }, t };
  };
  const patches: Patch[] = (def.patches ?? []).map((pt) => {
    const { p, t } = placed(pt.at, pt.off);
    return { c: p, t, len: pt.len, wide: pt.wide, surface: pt.surface };
  });
  const obstacles: Obstacle[] = (def.obstacles ?? []).map((o) => {
    if (o.exact && typeof o.at !== 'number') return { x: o.at[0], y: o.at[1], r: o.r, kind: o.kind };
    const { p } = placed(o.at, o.off);
    return { x: p.x, y: p.y, r: o.r, kind: o.kind };
  });

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of [...path.pts, ...(shortcut?.path.pts ?? [])]) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const m = half + 220;
  const bounds = { minX: minX - m, minY: minY - m, maxX: maxX + m, maxY: maxY + m };

  const startPt = pointAt(path, L - 46);
  const track: Track = {
    def,
    path,
    half,
    shortcut,
    zones: (def.zones ?? []).map((z) => ({ from: frac(z.from), to: frac(z.to), surface: z.surface })),
    shortcutRange: scRange,
    patches,
    obstacles,
    checkpoints,
    decor: [],
    bounds,
    start: { x: startPt.p.x, y: startPt.p.y, a: Math.atan2(startPt.t.y, startPt.t.x) },
  };
  track.decor = scatterDecor(track);
  return track;
}

/** Scenery off the road (trees, rocks...). Purely visual; deterministic per track. */
function scatterDecor(track: Track): Decor[] {
  const r = rng(track.def.seed);
  const { minX, minY, maxX, maxY } = track.bounds;
  const area = (maxX - minX) * (maxY - minY);
  const want = Math.min(170, Math.round(area / 26000));
  const out: Decor[] = [];
  for (let tries = 0; tries < want * 6 && out.length < want; tries++) {
    const p = { x: minX + r() * (maxX - minX), y: minY + r() * (maxY - minY) };
    const s = 0.7 + r() * 0.7;
    const clear = 34 * s + KERB + 10;
    if (nearest(track.path, p).d < track.half + clear) continue;
    if (track.shortcut && nearest(track.shortcut.path, p).d < track.shortcut.half + clear) continue;
    if (out.some((d) => Math.hypot(d.x - p.x, d.y - p.y) < 48 * Math.max(d.s, s))) continue;
    out.push({ x: p.x, y: p.y, s, kind: Math.floor(r() * 3), rot: r() * Math.PI * 2 });
  }
  // Draw back to front for a hint of depth.
  return out.sort((a, b) => a.y - b.y);
}

function inPatch(p: Vec, pt: Patch): boolean {
  const dx = p.x - pt.c.x;
  const dy = p.y - pt.c.y;
  const along = dx * pt.t.x + dy * pt.t.y;
  const side = -dx * pt.t.y + dy * pt.t.x;
  return Math.abs(along) <= pt.len / 2 && Math.abs(side) <= pt.wide / 2;
}

export interface Ground {
  surface: Surface;
  /** On the main road or shortcut (including kerbs). */
  onRoad: boolean;
  /** On the red/white kerb strip. */
  kerb: boolean;
  /** Arc length along the main road of the closest point. */
  s: number;
  /** Distance to the main road centreline. */
  d: number;
}

/** What is under point p. */
export function groundAt(track: Track, p: Vec): Ground {
  const near = nearest(track.path, p);
  for (const pt of track.patches) {
    if (inPatch(p, pt)) return { surface: pt.surface, onRoad: true, kerb: false, s: near.s, d: near.d };
  }
  if (near.d <= track.half + KERB) {
    const f = near.s / track.path.length;
    const zone = track.zones.find((z) => inRange(f, z.from, z.to));
    return { surface: near.d > track.half ? 'asphalt' : (zone?.surface ?? 'asphalt'), onRoad: true, kerb: near.d > track.half, s: near.s, d: near.d };
  }
  if (track.shortcut) {
    const sc = nearest(track.shortcut.path, p);
    if (sc.d <= track.shortcut.half) return { surface: track.shortcut.surface, onRoad: true, kerb: false, s: near.s, d: near.d };
  }
  return { surface: track.def.offroad, onRoad: false, kerb: false, s: near.s, d: near.d };
}

export interface TrackIssue {
  problem: string;
}

/** Sanity checks used by the tests and the daily generator: the road must not overlap itself. */
export function validateTrack(track: Track): TrackIssue[] {
  const issues: TrackIssue[] = [];
  const w = track.def.width;
  const clearance = minSelfClearance(track.path, w * 3);
  if (clearance < w + 2 * KERB + 30) issues.push({ problem: `road overlaps itself (clearance ${clearance.toFixed(0)})` });
  if (track.def.checkpoints < 4) issues.push({ problem: 'needs at least 4 checkpoints' });
  if (track.path.length < 2000) issues.push({ problem: 'lap too short' });
  if (track.shortcutRange) {
    const { from, to } = track.shortcutRange;
    if (bypassed(track.def.checkpoints, { from, to }).length === 0) issues.push({ problem: 'shortcut bypasses no checkpoint, so it cannot be told from a cut' });
  }
  return issues;
}

export function medalTimes(par: number): { gold: number; silver: number; bronze: number } {
  return { gold: par, silver: Math.round(par * 1.1), bronze: Math.round(par * 1.25) };
}
