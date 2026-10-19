import type { Rect } from './cull';

/**
 * A cache for everything on the track that never moves (ground, road, kerbs, walls, scenery). The
 * world is cut into square tiles; each is painted once into its own small canvas and from then on
 * only copied to the screen. Stroking the road, kerbs and walls as wide vector paths every frame
 * was what made full-screen play slow on laptops: a copied tile costs the same however much is on it.
 *
 * Tiles keep the scale they were painted at. After a zoom or resolution change the old ones are
 * still drawn (stretched a little) and repainted a few per frame, so a change never stalls a frame.
 * Tiles just outside the screen are painted ahead of time, inside a small time budget per frame.
 */

/** Tile side in world units. */
export const TILE = 256;
/** Upper limit for a tile's pixels per world unit: keeps the cache small on large, sharp screens. */
export const MAX_TILE_SCALE = 2;
/** Canvases kept for reuse after their tiles were dropped. */
const SPARE_MAX = 8;

export type Painter = (g: CanvasRenderingContext2D, view: Rect) => void;

interface Tile {
  c: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  /** Canvas size in pixels (the tile's scale is px / TILE). */
  px: number;
  tx: number;
  ty: number;
  /** Frame number when it was last on screen or painted. */
  used: number;
}

const keyOf = (tx: number, ty: number): number => (tx + 4096) * 8192 + (ty + 4096);

/** Tile index range [from, to] covering world coordinates [min, max]. */
export function tileSpan(min: number, max: number): [number, number] {
  return [Math.floor(min / TILE), Math.floor(max / TILE)];
}

/** Pixel size for tiles painted at `scale` device pixels per world unit. */
export function tilePixels(scale: number): number {
  return Math.max(32, Math.round(TILE * Math.min(MAX_TILE_SCALE, scale)));
}

export class TileCache {
  private tiles = new Map<number, Tile>();
  private spare: Tile[] = [];
  private frame = 0;
  private readonly paint: Painter;
  /** True when a tile canvas could not get a 2D context: the caller then paints directly. */
  broken = false;
  /** Tiles painted during the last draw() because they were needed on screen straight away. */
  painted = 0;

  constructor(paint: Painter) {
    this.paint = paint;
  }

  get size(): number {
    return this.tiles.size;
  }

  /** Drops every tile (new track or theme). */
  clear(): void {
    for (const t of this.tiles.values()) this.recycle(t);
    this.tiles.clear();
  }

  /** Releases all canvas memory (Safari counts it until garbage collection otherwise). */
  dispose(): void {
    this.clear();
    for (const t of this.spare) t.c.width = t.c.height = 0;
    this.spare = [];
  }

  /**
   * Copies the tiles under `view` (world rectangle on screen) onto `ctx`. The screen maps world
   * (x, y) to device pixels (ox + x * k, oy + y * k). New tiles are painted at `scale` device pixels
   * per world unit; then up to `budgetMs` goes to repainting stale tiles and painting the ring
   * of tiles around the screen.
   */
  draw(ctx: CanvasRenderingContext2D, view: Rect, k: number, ox: number, oy: number, scale: number, budgetMs: number): void {
    this.frame++;
    this.painted = 0;
    const px = tilePixels(scale);
    const [tx0, tx1] = tileSpan(view.minX, view.maxX);
    const [ty0, ty1] = tileSpan(view.minY, view.maxY);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let ty = ty0; ty <= ty1; ty++) {
      // Edges are rounded to whole device pixels, shared by neighbours, so tiles never leave seams.
      const y0 = Math.round(oy + ty * TILE * k);
      const y1 = Math.round(oy + (ty + 1) * TILE * k);
      for (let tx = tx0; tx <= tx1; tx++) {
        let t = this.tiles.get(keyOf(tx, ty));
        if (!t) {
          const made = this.make(tx, ty, px);
          if (!made) return;
          t = made;
          this.painted++;
        }
        t.used = this.frame;
        const x0 = Math.round(ox + tx * TILE * k);
        const x1 = Math.round(ox + (tx + 1) * TILE * k);
        ctx.drawImage(t.c, x0, y0, x1 - x0, y1 - y0);
      }
    }
    if (this.painted === 0) this.prefetch(tx0, tx1, ty0, ty1, px, budgetMs);
    this.evict((tx1 - tx0 + 3) * (ty1 - ty0 + 3) + 6);
  }

  /** Repaints stale tiles on screen, then paints or repaints the ring just outside it. */
  private prefetch(tx0: number, tx1: number, ty0: number, ty1: number, px: number, budgetMs: number): void {
    const start = performance.now();
    const todo: [number, number][] = [];
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = this.tiles.get(keyOf(tx, ty));
        if (t && t.px !== px) todo.push([tx, ty]);
      }
    for (let ty = ty0 - 1; ty <= ty1 + 1; ty++)
      for (let tx = tx0 - 1; tx <= tx1 + 1; tx++) {
        if (tx >= tx0 && tx <= tx1 && ty >= ty0 && ty <= ty1) continue;
        const t = this.tiles.get(keyOf(tx, ty));
        if (t) t.used = this.frame;
        if (!t || t.px !== px) todo.push([tx, ty]);
      }
    for (const [tx, ty] of todo) {
      const key = keyOf(tx, ty);
      const old = this.tiles.get(key);
      if (old) {
        this.tiles.delete(key);
        this.recycle(old);
      }
      if (!this.make(tx, ty, px)) return;
      if (performance.now() - start >= budgetMs) return;
    }
  }

  /** Drops the least recently used tiles beyond `limit`. */
  private evict(limit: number): void {
    if (this.tiles.size <= limit) return;
    const old = [...this.tiles.entries()].filter(([, t]) => t.used < this.frame).sort((a, b) => a[1].used - b[1].used);
    for (const [key, t] of old) {
      if (this.tiles.size <= limit) break;
      this.tiles.delete(key);
      this.recycle(t);
    }
  }

  private make(tx: number, ty: number, px: number): Tile | null {
    const t = this.take(px);
    if (!t) {
      this.broken = true;
      return null;
    }
    t.tx = tx;
    t.ty = ty;
    t.used = this.frame;
    const s = px / TILE;
    t.g.setTransform(s, 0, 0, s, -tx * TILE * s, -ty * TILE * s);
    this.paint(t.g, { minX: tx * TILE, minY: ty * TILE, maxX: (tx + 1) * TILE, maxY: (ty + 1) * TILE });
    this.tiles.set(keyOf(tx, ty), t);
    return t;
  }

  /** A canvas of px x px: a spare one if possible (resized if needed), else a new one. */
  private take(px: number): Tile | null {
    const i = this.spare.findIndex((t) => t.px === px);
    const reuse = i >= 0 ? this.spare.splice(i, 1)[0]! : this.spare.pop();
    if (reuse) {
      if (reuse.px !== px) {
        reuse.c.width = reuse.c.height = px;
        reuse.px = px;
      }
      return reuse;
    }
    const c = document.createElement('canvas');
    c.width = c.height = px;
    // Opaque: the painter always covers the whole tile, and opaque canvases copy faster.
    const g = c.getContext('2d', { alpha: false });
    if (!g) return null;
    return { c, g, px, tx: 0, ty: 0, used: 0 };
  }

  private recycle(t: Tile): void {
    if (this.spare.length < SPARE_MAX) this.spare.push(t);
    else t.c.width = t.c.height = 0;
  }
}
