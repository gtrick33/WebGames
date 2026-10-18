/**
 * View culling for long polylines (the road, tyre walls). The line is cut into short chunks with
 * bounding boxes; each frame only the stretches near the camera are turned into a Path2D and
 * stroked. Stroking a whole track several times per frame was the main cost of drawing a frame
 * (and the cause of hitches on phones when the camera zoom changes).
 *
 * Dashed strokes stay continuous: every visible stretch carries the arc length where it starts, to
 * be used as the canvas lineDashOffset, so dash patterns never jump as stretches come and go.
 */

export interface Vec {
  x: number;
  y: number;
}

export interface Rect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface Chunk extends Rect {
  from: number;
  to: number;
}

/** Index ranges [from, to] (inclusive; `to` may run past the end on closed lines, wrapping). */
export type Range = [number, number];

export interface Stretch {
  path: Path2D;
  /** Arc length from the start of the line to the start of this stretch. */
  offset: number;
}

export interface Visible {
  /** Every visible stretch in one path, for solid strokes (overlaps never double translucent strokes). */
  union: Path2D;
  /** Each stretch separately, with its dash offset. */
  parts: Stretch[];
  /** Nothing of this line is on screen. */
  empty: boolean;
}

export class PolyCull {
  readonly pts: Vec[];
  readonly closed: boolean;
  private chunks: Chunk[] = [];
  /** cum[i] = arc length from point 0 to point i (cum[n] = full length when closed). */
  private cum: number[] = [];
  private cacheKey = '';
  private cache: Visible | null = null;

  constructor(pts: Vec[], closed: boolean, size = 14) {
    this.pts = pts;
    this.closed = closed;
    const n = pts.length;
    const last = closed ? n : n - 1;
    this.cum = [0];
    for (let i = 1; i <= last; i++) {
      const a = pts[(i - 1) % n]!;
      const b = pts[i % n]!;
      this.cum.push(this.cum[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
    }
    for (let from = 0; from < last; from += size) {
      const to = Math.min(last, from + size);
      const c: Chunk = { from, to, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
      for (let i = from; i <= to; i++) {
        const p = pts[i % n]!;
        c.minX = Math.min(c.minX, p.x);
        c.maxX = Math.max(c.maxX, p.x);
        c.minY = Math.min(c.minY, p.y);
        c.maxY = Math.max(c.maxY, p.y);
      }
      this.chunks.push(c);
    }
  }

  get chunkCount(): number {
    return this.chunks.length;
  }

  /** Contiguous visible index ranges for a view rectangle grown by `pad` (half the stroke width). */
  ranges(view: Rect, pad: number): Range[] {
    const vis = this.chunks.map((c) => c.maxX + pad >= view.minX && c.minX - pad <= view.maxX && c.maxY + pad >= view.minY && c.minY - pad <= view.maxY);
    const n = this.chunks.length;
    if (vis.every(Boolean)) return [[0, this.closed ? this.pts.length : this.pts.length - 1]];
    const out: Range[] = [];
    for (let i = 0; i < n; i++) {
      if (!vis[i]) continue;
      const prev = out[out.length - 1];
      if (prev && prev[1] === this.chunks[i]!.from) prev[1] = this.chunks[i]!.to;
      else out.push([this.chunks[i]!.from, this.chunks[i]!.to]);
    }
    // A closed line: join the last stretch with the first when they meet at point 0.
    if (this.closed && out.length > 1 && out[0]![0] === 0 && out[out.length - 1]![1] === this.pts.length) {
      const tail = out.pop()!;
      out[0] = [tail[0], this.pts.length + out[0]![1]];
    }
    return out;
  }

  /** Arc length at the start of a range. */
  offsetOf(from: number): number {
    return this.cum[from] ?? 0;
  }

  /** The visible stretches as paths (cached while the visible set stays the same). */
  visible(view: Rect, pad: number): Visible {
    const rs = this.ranges(view, pad);
    const key = rs.map((r) => `${r[0]}-${r[1]}`).join(',');
    if (key === this.cacheKey && this.cache) return this.cache;
    const n = this.pts.length;
    const union = new Path2D();
    const parts: Stretch[] = [];
    const full = rs.length === 1 && rs[0]![0] === 0 && rs[0]![1] >= (this.closed ? n : n - 1);
    for (const [from, to] of rs) {
      const p = new Path2D();
      for (let i = from; i <= to; i++) {
        const pt = this.pts[i % n]!;
        if (i === from) {
          p.moveTo(pt.x, pt.y);
          union.moveTo(pt.x, pt.y);
        } else {
          p.lineTo(pt.x, pt.y);
          union.lineTo(pt.x, pt.y);
        }
      }
      if (full && this.closed) {
        p.closePath();
        union.closePath();
      }
      parts.push({ path: p, offset: this.offsetOf(from) });
    }
    this.cacheKey = key;
    this.cache = { union, parts, empty: rs.length === 0 };
    return this.cache;
  }
}

/** Bounding box of a list of points. */
export function bboxOf(pts: Vec[]): Rect {
  const r: Rect = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const p of pts) {
    r.minX = Math.min(r.minX, p.x);
    r.maxX = Math.max(r.maxX, p.x);
    r.minY = Math.min(r.minY, p.y);
    r.maxY = Math.max(r.maxY, p.y);
  }
  return r;
}

export const overlaps = (a: Rect, b: Rect, pad = 0): boolean => a.maxX + pad >= b.minX && a.minX - pad <= b.maxX && a.maxY + pad >= b.minY && a.minY - pad <= b.maxY;
