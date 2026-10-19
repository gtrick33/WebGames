import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Rect } from '../src/games/mini-racer/cull';
import { MAX_TILE_SCALE, TILE, TileCache, tilePixels, tileSpan } from '../src/games/mini-racer/tiles';

/** A stand-in 2D context that records the calls the tile cache makes. */
interface FakeCtx {
  canvas: HTMLCanvasElement;
  transforms: number[][];
  draws: { src: HTMLCanvasElement; x: number; y: number; w: number; h: number }[];
  setTransform(...m: number[]): void;
  drawImage(src: HTMLCanvasElement, x: number, y: number, w: number, h: number): void;
}

function fakeCtx(canvas: HTMLCanvasElement): FakeCtx {
  return {
    canvas,
    transforms: [],
    draws: [],
    setTransform(...m: number[]) {
      this.transforms.push(m);
    },
    drawImage(src, x, y, w, h) {
      this.draws.push({ src, x, y, w, h });
    },
  };
}

const realGetContext = HTMLCanvasElement.prototype.getContext;
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    return fakeCtx(this);
  } as unknown as HTMLCanvasElement['getContext'];
});
afterEach(() => {
  HTMLCanvasElement.prototype.getContext = realGetContext;
});

/** A 1600 x 900 device-pixel screen looking at world (cx, cy) at `k` device pixels per unit. */
function screenAt(cx: number, cy: number, k: number, w = 1600, h = 900) {
  const view: Rect = { minX: cx - w / 2 / k, maxX: cx + w / 2 / k, minY: cy - h / 2 / k, maxY: cy + h / 2 / k };
  return { view, k, ox: w / 2 - cx * k, oy: h / 2 - cy * k, w, h };
}

function setup() {
  const painted: { view: Rect; px: number }[] = [];
  const cache = new TileCache((g, view) => painted.push({ view, px: g.canvas.width }));
  const main = fakeCtx(document.createElement('canvas'));
  const draw = (s: ReturnType<typeof screenAt>, scale: number, budget = 0): void => {
    main.draws = [];
    cache.draw(main as unknown as CanvasRenderingContext2D, s.view, s.k, s.ox, s.oy, scale, budget);
  };
  return { cache, main, painted, draw };
}

describe('mini racer scenery tiles', () => {
  it('maps world coordinates to tile indices and caps the tile resolution', () => {
    expect(tileSpan(0, TILE - 0.01)).toEqual([0, 0]);
    expect(tileSpan(-1, TILE)).toEqual([-1, 1]);
    expect(tilePixels(1)).toBe(TILE);
    expect(tilePixels(1.35)).toBe(Math.round(TILE * 1.35));
    expect(tilePixels(9)).toBe(TILE * MAX_TILE_SCALE);
  });

  it('covers the whole screen with whole-pixel tiles that share their edges (no seams)', () => {
    const { main, draw } = setup();
    const s = screenAt(1234.5, -321.25, 1.37);
    draw(s, 1.37);
    const xs = [...new Set(main.draws.map((d) => d.x))].sort((a, b) => a - b);
    const ys = [...new Set(main.draws.map((d) => d.y))].sort((a, b) => a - b);
    expect(main.draws.length).toBe(xs.length * ys.length);
    for (const d of main.draws) for (const v of [d.x, d.y, d.w, d.h]) expect(Number.isInteger(v)).toBe(true);
    // Every tile edge is where the next tile starts (or the outer edge): no gaps, no overlaps.
    const rights = main.draws.map((d) => d.x + d.w);
    const bottoms = main.draws.map((d) => d.y + d.h);
    for (const r of rights) expect(r === Math.max(...rights) || xs.includes(r)).toBe(true);
    for (const b of bottoms) expect(b === Math.max(...bottoms) || ys.includes(b)).toBe(true);
    expect(Math.min(...xs)).toBeLessThanOrEqual(0);
    expect(Math.min(...ys)).toBeLessThanOrEqual(0);
    expect(Math.max(...main.draws.map((d) => d.x + d.w))).toBeGreaterThanOrEqual(s.w);
    expect(Math.max(...main.draws.map((d) => d.y + d.h))).toBeGreaterThanOrEqual(s.h);
  });

  it('paints each tile once at the right place and scale, then only copies it', () => {
    const { cache, painted, draw } = setup();
    const s = screenAt(500, 500, 1.2);
    draw(s, 1.2);
    const first = painted.length;
    expect(cache.painted).toBe(first);
    const px = tilePixels(1.2);
    for (const p of painted) {
      expect(p.px).toBe(px);
      expect(p.view.maxX - p.view.minX).toBe(TILE);
      expect(Math.abs(p.view.minX % TILE)).toBe(0);
    }
    // The painter draws in world units: the tile's context maps its world corner to pixel (0, 0).
    const tile = cache as unknown as { tiles: Map<number, { g: FakeCtx; tx: number; ty: number }> };
    for (const t of tile.tiles.values()) {
      const [a, , , d, e, f] = t.g.transforms.at(-1)!;
      expect(a).toBeCloseTo(px / TILE);
      expect(d).toBeCloseTo(px / TILE);
      expect(e).toBeCloseTo(-t.tx * TILE * (px / TILE));
      expect(f).toBeCloseTo(-t.ty * TILE * (px / TILE));
    }
    draw(s, 1.2);
    expect(cache.painted).toBe(0);
    // Only the ring outside the screen is painted now; nothing on screen is painted twice.
    const later = painted.slice(first);
    expect(later.length).toBe(1);
    for (const p of later) {
      const inside = p.view.maxX > s.view.minX && p.view.minX < s.view.maxX && p.view.maxY > s.view.minY && p.view.minY < s.view.maxY;
      expect(inside).toBe(false);
    }
  });

  it('paints the ring around the screen ahead of time, within the frame budget', () => {
    const { cache, draw } = setup();
    const s = screenAt(0, 0, 1);
    draw(s, 1);
    const [tx0, tx1] = tileSpan(s.view.minX, s.view.maxX);
    const [ty0, ty1] = tileSpan(s.view.minY, s.view.maxY);
    const onScreen = (tx1 - tx0 + 1) * (ty1 - ty0 + 1);
    expect(cache.size).toBe(onScreen);
    // A zero budget still allows one tile per frame.
    draw(s, 1, 0);
    expect(cache.size).toBe(onScreen + 1);
    draw(s, 1, 1000);
    expect(cache.size).toBe((tx1 - tx0 + 3) * (ty1 - ty0 + 3));
    expect(cache.painted).toBe(0);
  });

  it('keeps old tiles on screen after a zoom change and repaints them a few per frame', () => {
    const { cache, main, painted, draw } = setup();
    const s = screenAt(300, 200, 1);
    draw(s, 1, 1000);
    draw(s, 1.3, 0);
    // Nothing painted on the spot: the stretched old tiles fill the screen meanwhile.
    expect(cache.painted).toBe(0);
    expect(main.draws.length).toBeGreaterThan(0);
    const before = painted.length;
    for (let i = 0; i < 200; i++) draw(s, 1.3, 0);
    const newPx = tilePixels(1.3);
    const repainted = painted.slice(before);
    expect(repainted.length).toBeGreaterThan(0);
    expect(repainted.every((p) => p.px === newPx)).toBe(true);
    draw(s, 1.3, 0);
    expect(main.draws.every((d) => d.src.width === newPx)).toBe(true);
  });

  it('holds a bounded number of tiles while the camera travels far', () => {
    const { cache, draw } = setup();
    let max = 0;
    for (let i = 0; i < 400; i++) {
      draw(screenAt(i * 40, Math.sin(i / 20) * 2000, 1.1), 1.1, 1000);
      max = Math.max(max, cache.size);
    }
    const s = screenAt(0, 0, 1.1);
    const cols = tileSpan(s.view.minX, s.view.maxX)[1] - tileSpan(s.view.minX, s.view.maxX)[0] + 1;
    const rows = tileSpan(s.view.minY, s.view.maxY)[1] - tileSpan(s.view.minY, s.view.maxY)[0] + 1;
    expect(max).toBeLessThanOrEqual((cols + 3) * (rows + 3) + 6);
    cache.dispose();
    expect(cache.size).toBe(0);
  });

  it('reports itself broken when a tile canvas has no 2D context, so the caller paints directly', () => {
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
    const { cache, draw } = setup();
    draw(screenAt(0, 0, 1), 1);
    expect(cache.broken).toBe(true);
  });
});
