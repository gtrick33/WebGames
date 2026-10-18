import { GRIP_HANDLING, type Handling } from './physics';
import { buildPath, leftOf, minSelfClearance, nearest, nearestNear, pointAt, resample, spline, type Path, type Vec } from './geometry';

/** Ground types. Each changes top speed, acceleration and how much the tyres grip. */
export type Surface = 'asphalt' | 'grass' | 'sand' | 'dirt' | 'gravel' | 'ice' | 'snow' | 'mud' | 'boost';

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
  // Rally surfaces are fast but loose: full speed, low grip.
  dirt: { speed: 0.98, accel: 0.95, grip: 0.62, drag: 0.02 },
  gravel: { speed: 0.96, accel: 0.9, grip: 0.52, drag: 0.04 },
  ice: { speed: 1, accel: 0.55, grip: 0.22, drag: 0 },
  grass: { speed: 0.56, accel: 0.7, grip: 0.7, drag: 0.6 },
  sand: { speed: 0.5, accel: 0.6, grip: 0.55, drag: 0.8 },
  snow: { speed: 0.52, accel: 0.6, grip: 0.5, drag: 0.7 },
  mud: { speed: 0.45, accel: 0.5, grip: 0.45, drag: 1.4 },
};

export type ThemeId = 'bay' | 'frost' | 'canyon' | 'park' | 'candy';

/** What kind of track it is: decides what drifting does. */
export type TrackType = 'circuit' | 'rally' | 'snow' | 'oval';

export interface TrackTypeRules extends Handling {
  name: string;
  /** One line for the menu. */
  hint: string;
  /** Turbo paid for a banked drift chain (x the base payout); 0 = none. */
  turbo: number;
  /** AI drivers keep the car tidy (no sliding) on this type. */
  noDrift: boolean;
}

export const TRACK_TYPES: Record<TrackType, TrackTypeRules> = {
  circuit: { name: 'Circuit', hint: 'Grippy tarmac. Drifting costs speed; clean lines win.', ...GRIP_HANDLING, scrub: 170, turbo: 0, noDrift: true },
  oval: { name: 'Oval', hint: 'Flat out. Any slide scrubs a lot of speed; keep it smooth.', ...GRIP_HANDLING, scrub: 240, turbo: 0, noDrift: true },
  snow: { name: 'Snow', hint: 'Low grip and long slides. Drifting is neutral; control is everything.', ...GRIP_HANDLING, scrub: 55, turbo: 0, noDrift: false },
  // Rally: the tail steps out readily at speed with a sharper turn-in, so drifting is the fun way round.
  rally: {
    name: 'Rally',
    hint: 'Loose and fast. Turn in hard and the car drifts: slides keep speed and pay a turbo.',
    scrub: 15,
    slideSteer: 0.32,
    slideSpeed: 0.3,
    slideRate: 5,
    turnIn: 1.15,
    turbo: 1.25,
    noDrift: false,
  },
};
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
  type: TrackType;
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
  /** Trackside tyre walls: polylines beside the road, open where a shortcut leaves or joins. */
  walls: Vec[][];
  /** Everything solid (obstacles and scenery) and the wall segments, bucketed for cheap lookups. */
  solids: Solid[];
  segs: Seg[];
  grid: Map<number, Cell>;
  /** Where cars line up, facing the driving direction. */
  start: { x: number; y: number; a: number };
}

export const KERB = 9;
/** Run-off between the kerb and the tyre wall. */
export const WALL_GAP = 40;
/** Half-thickness of a tyre wall. */
export const WALL_HALF = 7;
const CELL = 160;

export interface Solid {
  x: number;
  y: number;
  r: number;
}
export interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}
export interface Cell {
  solids: number[];
  segs: number[];
}
const EMPTY_CELL: Cell = { solids: [], segs: [] };

/** Distance from the road centreline to the centre of the tyre walls. */
export function wallOffset(half: number): number {
  return half + KERB + WALL_GAP;
}

const cellKey = (cx: number, cy: number): number => (cx + 2048) * 4096 + (cy + 2048);

/** The solids and wall segments that could touch a car at (x, y). */
export function cellAt(track: Track, x: number, y: number): Cell {
  return track.grid.get(cellKey(Math.floor(x / CELL), Math.floor(y / CELL))) ?? EMPTY_CELL;
}

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

/** How far a gate reaches past the kerb: forgiving when you run wide, short of the infield. */
const GATE_SLACK = 45;

/**
 * A gate across `path` at arc length s. Each half reaches up to GATE_SLACK past the kerb, but stops
 * short wherever it would reach another stretch of road (`blocked`), e.g. across a hairpin, so a
 * gate can never be crossed from the neighbouring piece of track.
 */
function gateAt(path: Path, s: number, half: number, blocked: (q: Vec) => boolean): Gate {
  const { p, t } = pointAt(path, s);
  const n = leftOf(t);
  const reach = (side: number): number => {
    let r = half + KERB;
    for (let next = r + 5; next <= half + KERB + GATE_SLACK; next += 5) {
      if (blocked({ x: p.x + n.x * next * side, y: p.y + n.y * next * side })) break;
      r = next;
    }
    return r;
  };
  const ra = reach(1);
  const rb = reach(-1);
  return { a: { x: p.x + n.x * ra, y: p.y + n.y * ra }, b: { x: p.x - n.x * rb, y: p.y - n.y * rb }, dir: t };
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

/**
 * Rotates a closed, evenly sampled loop so it begins a little way into its longest straight. The
 * start/finish line and the grid then sit on a straight, so a car with automatic gas leaves the grid
 * on the road even before the player steers.
 */
export function startOnStraight(pts: Vec[], avoid: (i: number) => boolean = () => false): Vec[] {
  const n = pts.length;
  const heading = (i: number): number => {
    const a = pts[i % n]!;
    const b = pts[(i + 1) % n]!;
    return Math.atan2(b.y - a.y, b.x - a.x);
  };
  const turn = (a: number, b: number): number => Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
  let best = 0;
  let bestRun = -1;
  for (let i = 0; i < n; i++) {
    if (avoid(i)) continue;
    const h0 = heading(i);
    let run = 0;
    while (run < n && turn(h0, heading(i + run)) < 0.12) run++;
    if (run > bestRun) {
      bestRun = run;
      best = i;
    }
  }
  // Leave room behind the line for the grid (samples are ~10 units apart).
  const offset = Math.min(8, Math.floor(bestRun / 3));
  const start = (best + offset) % n;
  return [...pts.slice(start), ...pts.slice(0, start)];
}

export function buildTrack(def: TrackDef): Track {
  const ctrl = def.points.map(([x, y]) => ({ x, y }));
  // The start line goes on the longest straight, but never inside the stretch a shortcut skips
  // (a car taking the shortcut would miss the line).
  const loop = resample(spline(ctrl, true, 24), 10, true);
  let avoid: (i: number) => boolean = () => false;
  if (def.shortcut && typeof def.shortcut.from !== 'number' && typeof def.shortcut.to !== 'number') {
    const raw = buildPath(loop, true);
    const idx = (pt: [number, number]): number => nearest(raw, { x: pt[0], y: pt[1] }).i;
    const from = idx(def.shortcut.from);
    const to = idx(def.shortcut.to);
    const n = loop.length;
    // Skip the stretch plus a margin of ~25 samples either side (grid behind, gates around).
    avoid = (i: number): boolean => {
      const rel = (i - from + 25 + n) % n;
      return rel <= (to - from + n) % n + 50;
    };
  }
  const path = buildPath(startOnStraight(loop, avoid), true);
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
  // A main-road gate is blocked where its end is closer to a different stretch of the main road.
  const otherStretch = (s: number) => (q: Vec): boolean => {
    const near = nearest(path, q);
    const along = Math.abs(near.s - s);
    return Math.min(along, L - along) > half * 3;
  };
  for (let k = 0; k < def.checkpoints; k++) {
    const s = (k / def.checkpoints) * L;
    checkpoints.push({ gates: [gateAt(path, s, half, otherStretch(s))] });
  }
  if (shortcut && scRange) {
    // Checkpoints the shortcut skips get matching gates spread along the shortcut, in the same order.
    const skipped = bypassed(def.checkpoints, scRange);
    skipped.forEach((k, i) => {
      const onMain = (q: Vec): boolean => nearest(path, q).d < half + KERB;
      checkpoints[k]!.gates.push(gateAt(shortcut.path, (shortcut.path.length * (i + 1)) / (skipped.length + 1), shortcut.half, onMain));
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
    walls: [],
    solids: [],
    segs: [],
    grid: new Map(),
    start: { x: startPt.p.x, y: startPt.p.y, a: Math.atan2(startPt.t.y, startPt.t.x) },
  };
  track.walls = buildWalls(track);
  track.decor = scatterDecor(track);
  buildGrid(track);
  return track;
}

/**
 * Tyre walls on both sides of the road, WALL_GAP past the kerb. A wall point is dropped where it would
 * sit closer to another stretch of road (tight hairpins) or on a shortcut, so walls never block a
 * legal route; the remaining runs become the barriers.
 */
function buildWalls(track: Track): Vec[][] {
  const { path, half } = track;
  const n = path.pts.length;
  const L = path.length;
  const off = wallOffset(half);
  const runs: Vec[][] = [];
  for (const side of [1, -1]) {
    const keep: (Vec | null)[] = path.pts.map((p, i) => {
      const nn = leftOf(path.tan[i]!);
      const q = { x: p.x + nn.x * off * side, y: p.y + nn.y * off * side };
      const near = nearest(path, q);
      const along = Math.abs(near.s - path.cum[i]!);
      if (Math.min(along, L - along) > half * 2.2 || near.d < off - 4) return null;
      if (track.shortcut && nearest(track.shortcut.path, q).d < track.shortcut.half + WALL_HALF + 26) return null;
      return q;
    });
    // Split into runs of kept points, joining across the loop's seam.
    const start = keep.findIndex((q) => q === null);
    if (start < 0) {
      runs.push([...(keep as Vec[]), keep[0]!]);
      continue;
    }
    let run: Vec[] = [];
    for (let k = 1; k <= n; k++) {
      const q = keep[(start + k) % n];
      if (q) run.push(q);
      else {
        if (run.length >= 3) runs.push(run);
        run = [];
      }
    }
    if (run.length >= 3) runs.push(run);
  }
  return runs;
}

function buildGrid(track: Track): void {
  const grid = track.grid;
  const add = (minX: number, minY: number, maxX: number, maxY: number, put: (c: Cell) => void): void => {
    // Pad by a car's reach so a single cell lookup at the car's centre finds everything it can touch.
    const pad = 24;
    for (let cx = Math.floor((minX - pad) / CELL); cx <= Math.floor((maxX + pad) / CELL); cx++) {
      for (let cy = Math.floor((minY - pad) / CELL); cy <= Math.floor((maxY + pad) / CELL); cy++) {
        const key = cellKey(cx, cy);
        let c = grid.get(key);
        if (!c) grid.set(key, (c = { solids: [], segs: [] }));
        put(c);
      }
    }
  };
  track.solids = [
    ...track.obstacles.map((o) => ({ x: o.x, y: o.y, r: o.r })),
    // Scenery is solid too: a trunk-sized core of each prop.
    ...track.decor.map((d) => ({ x: d.x, y: d.y, r: decorRadius(d) })),
  ];
  track.solids.forEach((s, i) => add(s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r, (c) => c.solids.push(i)));
  track.segs = [];
  for (const run of track.walls) {
    for (let i = 1; i < run.length; i++) {
      const a = run[i - 1]!;
      const b = run[i]!;
      const idx = track.segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y }) - 1;
      add(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y), (c) => c.segs.push(idx));
    }
  }
}

/** Collision radius of a scenery prop: most of its drawn canopy (drawn at 26 x scale), so contact looks right. */
export function decorRadius(d: Decor): number {
  return 19 * d.s;
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
    // Outside the tyre walls (where there is one), clear of the road everywhere.
    if (nearest(track.path, p).d < Math.max(track.half + clear, wallOffset(track.half) + WALL_HALF + 18 * s + 8)) continue;
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
  /** Segment index of the closest point on the main road (a hint for the next lookup). */
  i: number;
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
export function groundAt(track: Track, p: Vec, hint?: number): Ground {
  const near = hint === undefined ? nearest(track.path, p) : nearestNear(track.path, p, hint);
  const base = { s: near.s, d: near.d, i: near.i };
  for (const pt of track.patches) {
    if (inPatch(p, pt)) return { surface: pt.surface, onRoad: true, kerb: false, ...base };
  }
  if (near.d <= track.half + KERB) {
    const f = near.s / track.path.length;
    const zone = track.zones.find((z) => inRange(f, z.from, z.to));
    return { surface: near.d > track.half ? 'asphalt' : (zone?.surface ?? 'asphalt'), onRoad: true, kerb: near.d > track.half, ...base };
  }
  if (track.shortcut) {
    const sc = nearest(track.shortcut.path, p);
    if (sc.d <= track.shortcut.half) return { surface: track.shortcut.surface, onRoad: true, kerb: false, ...base };
  }
  return { surface: track.def.offroad, onRoad: false, kerb: false, ...base };
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
