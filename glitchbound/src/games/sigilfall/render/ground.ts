import { hash2, noise2 } from '../core/math';
import type { RegionDef } from '../data/types';
import { TILE, type TileMap } from '../sim/map';
import { Painter, ramp, rgb } from './art/kit';
import { CHUNK_ART, CHUNK_TILES, GroundPainter, type GroundSource } from './groundPaint';
import { canvas, ctx2d, DETAIL, type Cnv } from './pixel';

/**
 * The ground of a region, painted at art resolution (DETAIL art pixels per world pixel) in square
 * chunks. Chunks around the view are painted ahead of time on a worker (or, without one, a few
 * milliseconds per frame here), the ones in view are painted at once if they aren't ready, and far
 * ones are dropped, so even a very large map costs only what is around the hero.
 */

const D = DETAIL;
/** Art pixels per tile. */
const T = TILE * D;
const CA = CHUNK_ART;
/** World pixels per chunk side. */
const CW = CHUNK_TILES * TILE;
/** Chunks kept around at most (256×256 art px each, about 0.25 MB). */
const KEEP = 140;

/** A flat picture painted onto the ground (rune circles, the waystone's pad), in art pixels. */
interface Decal {
  x: number;
  y: number;
  c: Cnv;
}

const key = (cx: number, cy: number): number => cy * 4096 + cx;

export class Ground {
  private readonly map: TileMap;
  private readonly painter: GroundPainter;
  private readonly decals: Decal[];
  private readonly cache = new Map<number, Cnv>();
  /** Painting here, a few rows per frame, when there is no worker. */
  private job: { key: number; cx: number; cy: number; img: ImageData; row: number } | null = null;
  private worker: Worker | null = null;
  /** Chunks asked of the worker and not back yet. */
  private readonly asked = new Set<number>();

  constructor(map: TileMap, region: RegionDef) {
    this.map = map;
    const src: GroundSource = { w: map.w, h: map.h, kind: map.kind, marked: map.markers.map((m) => m.ty * map.w + m.tx), theme: region.theme };
    this.painter = new GroundPainter(src);
    this.decals = buildDecals(map, region);
    try {
      this.worker = new Worker(new URL('./ground.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<{ cx: number; cy: number; buf: Uint8ClampedArray }>) => {
        const { cx, cy, buf } = e.data;
        const k = key(cx, cy);
        this.asked.delete(k);
        if (!this.cache.has(k)) this.finish(cx, cy, new ImageData(buf as Uint8ClampedArray<ArrayBuffer>, CA, CA));
      };
      this.worker.onerror = () => this.dropWorker();
      this.worker.postMessage({ type: 'init', src });
    } catch {
      this.worker = null;
    }
  }

  /** Stops the worker (the region is gone). */
  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }

  private dropWorker(): void {
    this.dispose();
    this.asked.clear();
  }

  /** Draws the ground under the view; the context is in world pixels. */
  draw(g: CanvasRenderingContext2D, ox: number, oy: number, vw: number, vh: number): void {
    const cx0 = Math.max(0, Math.floor(ox / CW));
    const cy0 = Math.max(0, Math.floor(oy / CW));
    const cx1 = Math.floor((ox + vw - 1) / CW);
    const cy1 = Math.floor((oy + vh - 1) / CW);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) g.drawImage(this.chunk(cx, cy), cx * CW - ox, cy * CW - oy, CW, CW);
  }

  /** Gets the chunks just outside the view painted: on the worker, or here for at most `budget` ms. */
  prefetch(ox: number, oy: number, vw: number, vh: number, budget = 2): void {
    const cols = Math.ceil((this.map.w * TILE) / CW);
    const rows = Math.ceil((this.map.h * TILE) / CW);
    const ring = this.worker ? 2 : 1;
    const cx0 = Math.max(0, Math.floor(ox / CW) - ring);
    const cy0 = Math.max(0, Math.floor(oy / CW) - ring);
    const cx1 = Math.min(cols - 1, Math.floor((ox + vw) / CW) + ring);
    const cy1 = Math.min(rows - 1, Math.floor((oy + vh) / CW) + ring);
    const missing: [number, number][] = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) if (!this.cache.has(key(cx, cy)) && !this.asked.has(key(cx, cy))) missing.push([cx, cy]);
    if (this.worker) {
      // a couple at a time, nearest first, so the worker doesn't fall behind a walking hero
      const mx = (ox + vw / 2) / CW - 0.5;
      const my = (oy + vh / 2) / CW - 0.5;
      missing.sort((a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my));
      for (const [cx, cy] of missing) {
        if (this.asked.size >= 2) break;
        this.asked.add(key(cx, cy));
        this.worker.postMessage({ type: 'paint', cx, cy });
      }
      return;
    }
    const end = performance.now() + budget;
    while (performance.now() < end) {
      if (!this.job) {
        const next = missing.shift();
        if (!next) return;
        this.start(next[0], next[1]);
      }
      this.work(end);
    }
  }

  private chunk(cx: number, cy: number): Cnv {
    const k = key(cx, cy);
    const hit = this.cache.get(k);
    if (hit) {
      // most recently used goes last
      this.cache.delete(k);
      this.cache.set(k, hit);
      return hit;
    }
    // needed now: paint it here (a late answer from the worker is then ignored)
    if (this.job?.key !== k) this.start(cx, cy);
    this.work(Infinity);
    return this.cache.get(k)!;
  }

  private start(cx: number, cy: number): void {
    this.job = { key: key(cx, cy), cx, cy, img: new ImageData(CA, CA), row: 0 };
  }

  /** Paints rows of the current chunk until it is done or the time is up. */
  private work(end: number): void {
    const job = this.job;
    if (!job) return;
    while (job.row < CA) {
      const next = Math.min(CA, job.row + 8);
      this.painter.paint(job.cx, job.cy, job.img.data, job.row, next);
      job.row = next;
      if (performance.now() > end) return;
    }
    this.job = null;
    this.finish(job.cx, job.cy, job.img);
  }

  /** Puts a painted chunk on a canvas with the decals over it, and keeps it. */
  private finish(cx: number, cy: number, img: ImageData): void {
    const c = canvas(CA, CA);
    const g = ctx2d(c);
    g.putImageData(img, 0, 0);
    const x0 = cx * CA;
    const y0 = cy * CA;
    for (const dc of this.decals) {
      const x = dc.x - x0;
      const y = dc.y - y0;
      if (x < CA && y < CA && x + dc.c.width > 0 && y + dc.c.height > 0) g.drawImage(dc.c, x, y);
    }
    this.cache.set(key(cx, cy), c);
    while (this.cache.size > KEEP) this.cache.delete(this.cache.keys().next().value!);
  }
}

/* -------------------------------------------------------------- decals */

function buildDecals(map: TileMap, region: RegionDef): Decal[] {
  const out: Decal[] = [];
  for (const pm of map.markers) {
    const x = (pm.tx + 0.5) * TILE * D;
    const y = (pm.ty + 0.5) * TILE * D;
    const m = pm.marker;
    const put = (p: Painter, cx: number, cy: number): void => {
      out.push({ x: Math.round(cx - p.w / 2), y: Math.round(cy - p.h / 2), c: p.toCanvas() });
    };
    if (m.kind === 'boss' && region.theme === 'crypt') put(runeCircle(m.boss === 'morgrave' ? 70 : 52, m.boss === 'morgrave' ? '#ff3fd2' : '#7af0ff'), x, y);
    if (m.kind === 'boss' && region.theme === 'forest') put(den(), x, y);
    if (m.kind === 'waystone') put(waystonePad(), x, y + 5 * D);
    if (m.kind === 'exit' && region.theme === 'crypt') {
      const p = cryptStairs();
      out.push({ x: pm.tx * TILE * D, y: pm.ty * TILE * D, c: p.toCanvas() });
    }
  }
  return out;
}

function runeCircle(r: number, color: string): Painter {
  const R = r * D;
  const p = new Painter(R * 2 + 8, R * 1.5 + 8);
  const cx = p.w / 2;
  const cy = p.h / 2;
  const c = rgb(color);
  // a faint fill and two thin rings
  p.ellipse(cx, cy, R, R * 0.75, (dx, dy) => {
    const d = Math.sqrt(dx * dx + dy * dy);
    return d > 0.86 ? null : c;
  });
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const ex = (x + 0.5 - cx) / R;
      const ey = (y + 0.5 - cy) / (R * 0.75);
      const d = Math.sqrt(ex * ex + ey * ey) * R;
      const o = (y * p.w + x) * 4;
      if (Math.abs(d - R) < 1 || Math.abs(d - (R - 12)) < 0.8) {
        p.d[o] = c[0];
        p.d[o + 1] = c[1];
        p.d[o + 2] = c[2];
        p.d[o + 3] = 120;
      } else if (p.d[o + 3]! > 0) p.d[o + 3] = 16;
    }
  }
  // sixteen glyphs around the rim
  const glyphs = [
    ['.#.', '###', '.#.', '.#.', '#.#'],
    ['#.#', '.#.', '###', '.#.', '.#.'],
    ['##.', '#.#', '##.', '#..', '#..'],
    ['.#.', '#.#', '.#.', '#.#', '.#.'],
  ];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const gx = Math.round(cx + Math.cos(a) * (R - 6)) - 1;
    const gy = Math.round(cy + Math.sin(a) * (R - 6) * 0.75) - 2;
    const gl = glyphs[i % 4]!;
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (gl[y]![x] === '#') p.set(gx + x, gy + y, c, 150);
  }
  return p;
}

function den(): Painter {
  const R = 70 * D;
  const p = new Painter(R * 2 + 4, R * 1.6 + 4);
  const cx = p.w / 2;
  const cy = p.h / 2;
  const dirt = ramp('#8a7048');
  // trampled earth, thinning out toward the edge
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const ex = (x + 0.5 - cx) / R;
      const ey = (y + 0.5 - cy) / (R * 0.8);
      const d = Math.sqrt(ex * ex + ey * ey);
      if (d > 1) continue;
      const n = noise2(x / 9, y / 9, 81);
      if (n * 1.2 - d * 0.9 > 0.12) {
        const h = hash2(x, y, 82);
        p.set(x, y, h < 0.08 ? dirt[3] : h < 0.12 ? dirt[1] : dirt[2], 210);
      }
    }
  }
  // scattered bones
  const bone = ramp('#e8e0c8');
  for (let i = 0; i < 22; i++) {
    const a = hash2(i, 1, 3) * Math.PI * 2;
    const r = Math.sqrt(hash2(i, 2, 3)) * R * 0.85;
    const bx = cx + Math.cos(a) * r;
    const by = cy + Math.sin(a) * r * 0.8;
    const ang = hash2(i, 4, 3) * Math.PI;
    const len = 3 + Math.floor(hash2(i, 5, 3) * 4);
    const ux = Math.cos(ang);
    const uy = Math.sin(ang) * 0.6;
    for (let s = -len; s <= len; s++) {
      p.set(Math.round(bx + ux * s), Math.round(by + uy * s) + 1, bone[4]);
      p.set(Math.round(bx + ux * s), Math.round(by + uy * s), bone[1]);
    }
    for (const e of [-1, 1]) {
      const kx = Math.round(bx + ux * len * e);
      const ky = Math.round(by + uy * len * e);
      p.set(kx, ky - 1, bone[0]);
      p.set(kx + 1, ky, bone[2]);
      p.set(kx - 1, ky, bone[2]);
    }
  }
  return p;
}

function waystonePad(): Painter {
  const p = new Painter(30 * D, 16 * D);
  const cx = p.w / 2;
  const cy = p.h / 2;
  const stone = ramp('#8a88a0');
  p.ellipse(cx, cy + 1, 14 * D, 7 * D, (dx, dy, x, y) => {
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 0.93) return stone[4];
    if (d > 0.84) return dy < 0 ? stone[1] : stone[3];
    // the inner disc, worn smooth, lit from the top left
    const b = -dx * 0.4 - dy * 0.6;
    const h = hash2(x, y, 90);
    return h < 0.05 ? stone[3] : b > 0.35 ? stone[1] : stone[2];
  });
  // carved notches around the rim
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const nx = Math.round(cx + Math.cos(a) * 10.5 * D);
    const ny = Math.round(cy + 1 + Math.sin(a) * 5.2 * D);
    p.set(nx, ny, stone[4]);
    p.set(nx + 1, ny, stone[4]);
    p.set(nx, ny - 1, stone[0]);
  }
  return p;
}

function cryptStairs(): Painter {
  const p = new Painter(T, T);
  p.rect(0, 0, T, T, rgb('#0e0c18'));
  const step = ramp('#4a4864');
  for (let s = 0; s < 4; s++) {
    const y = s * 8;
    const inset = s;
    p.rect(inset, y, T - inset * 2, 2, step[1]);
    p.rect(inset, y + 2, T - inset * 2, 5, s % 2 ? step[3] : step[2]);
    p.rect(inset, y + 7, T - inset * 2, 1, step[4]);
  }
  return p;
}

