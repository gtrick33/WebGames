/** Small 2D geometry helpers for the racer. Pure: no DOM, safe to test. */

export interface Vec {
  x: number;
  y: number;
}

/** A polyline with cumulative arc length, tangents and left-hand normals at each vertex. */
export interface Path {
  pts: Vec[];
  /** cum[i] = arc length from pts[0] to pts[i]. For a closed path cum has pts.length + 1 entries. */
  cum: number[];
  length: number;
  closed: boolean;
  /** Unit tangent at each vertex. */
  tan: Vec[];
}

function cr(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** Catmull-Rom spline through control points. Closed splines loop back to the first point. */
export function spline(ctrl: Vec[], closed: boolean, perSeg = 16): Vec[] {
  const n = ctrl.length;
  const out: Vec[] = [];
  const at = (i: number): Vec => (closed ? ctrl[((i % n) + n) % n]! : ctrl[Math.max(0, Math.min(n - 1, i))]!);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg;
      out.push({ x: cr(p0.x, p1.x, p2.x, p3.x, t), y: cr(p0.y, p1.y, p2.y, p3.y, t) });
    }
  }
  if (!closed) out.push({ ...ctrl[n - 1]! });
  return out;
}

/** Re-samples a polyline at (nearly) uniform spacing so lookups and drawing are even. */
export function resample(pts: Vec[], spacing: number, closed: boolean): Vec[] {
  const src = closed ? [...pts, pts[0]!] : pts;
  let total = 0;
  for (let i = 1; i < src.length; i++) total += dist(src[i - 1]!, src[i]!);
  const count = Math.max(2, Math.round(total / spacing));
  const step = total / count;
  const out: Vec[] = [{ ...src[0]! }];
  let seg = 1;
  let segStart = 0;
  let segLen = dist(src[0]!, src[1]!);
  const last = closed ? count : count + 1;
  for (let k = 1; k < last; k++) {
    const target = k * step;
    while (segStart + segLen < target && seg < src.length - 1) {
      segStart += segLen;
      seg++;
      segLen = dist(src[seg - 1]!, src[seg]!);
    }
    const u = segLen > 0 ? Math.min(1, (target - segStart) / segLen) : 0;
    const a = src[seg - 1]!;
    const b = src[seg]!;
    out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
  }
  if (!closed) out[out.length - 1] = { ...src[src.length - 1]! };
  return out;
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function buildPath(pts: Vec[], closed: boolean): Path {
  const cum = [0];
  const n = pts.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) cum.push(cum[i]! + dist(pts[i]!, pts[(i + 1) % n]!));
  const tan: Vec[] = pts.map((_, i) => {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)]!;
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]!;
    const l = dist(a, b) || 1;
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  });
  return { pts, cum, length: cum[cum.length - 1]!, closed, tan };
}

export interface Nearest {
  /** Distance from the query point to the path. */
  d: number;
  /** Arc length of the closest point. */
  s: number;
  /** Segment index. */
  i: number;
  /** Signed lateral offset: positive to the left of travel direction (screen coordinates, y down). */
  side: number;
}

/** Closest point on the path (brute force; tracks have a few hundred segments). */
export function nearest(path: Path, p: Vec): Nearest {
  const { pts, closed, cum } = path;
  const n = pts.length;
  const segs = closed ? n : n - 1;
  let best: Nearest = { d: Infinity, s: 0, i: 0, side: 0 };
  let bestD2 = Infinity;
  for (let i = 0; i < segs; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const l2 = ex * ex + ey * ey || 1;
    let u = ((p.x - a.x) * ex + (p.y - a.y) * ey) / l2;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const qx = a.x + ex * u - p.x;
    const qy = a.y + ey * u - p.y;
    const d2 = qx * qx + qy * qy;
    if (d2 < bestD2) {
      bestD2 = d2;
      // cross(e, p - a) > 0 means p is to the right in y-down screen space; we report left as positive.
      const cross = ex * (p.y - a.y) - ey * (p.x - a.x);
      best = { d: 0, s: cum[i]! + (cum[i + 1]! - cum[i]!) * u, i, side: cross > 0 ? -1 : 1 };
    }
  }
  best.d = Math.sqrt(bestD2);
  best.side *= best.d;
  return best;
}

/** Point and unit tangent at arc length s (wraps on closed paths). */
export function pointAt(path: Path, s: number): { p: Vec; t: Vec } {
  const { pts, cum, length, closed } = path;
  const n = pts.length;
  if (closed) s = ((s % length) + length) % length;
  else s = Math.max(0, Math.min(length, s));
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid]! <= s) lo = mid;
    else hi = mid;
  }
  const a = pts[lo % n]!;
  const b = pts[(lo + 1) % n]!;
  const segLen = cum[lo + 1]! - cum[lo]! || 1;
  const u = (s - cum[lo]!) / segLen;
  const l = dist(a, b) || 1;
  return { p: { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }, t: { x: (b.x - a.x) / l, y: (b.y - a.y) / l } };
}

/** Left-hand normal (y-down screen space: left of travel direction). */
export function leftOf(t: Vec): Vec {
  return { x: t.y, y: -t.x };
}

/**
 * Where segment p0→p1 crosses segment a→b, as a fraction along p0→p1, or null if they don't cross.
 */
export function crossFraction(p0: Vec, p1: Vec, a: Vec, b: Vec): number | null {
  const rx = p1.x - p0.x;
  const ry = p1.y - p0.y;
  const sx = b.x - a.x;
  const sy = b.y - a.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qx = a.x - p0.x;
  const qy = a.y - p0.y;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return t;
}

/** Smallest distance between any two path vertices that are at least `gap` apart along the path. */
export function minSelfClearance(path: Path, gap: number): number {
  const { pts, cum, length, closed } = path;
  let min = Infinity;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      let along = cum[j]! - cum[i]!;
      if (closed) along = Math.min(along, length - along);
      if (along < gap) continue;
      const d = dist(pts[i]!, pts[j]!);
      if (d < min) min = d;
    }
  }
  return min;
}

export function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
