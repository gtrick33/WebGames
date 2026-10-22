/**
 * The ground painter runs on a worker, so it must not touch the DOM; it must also be a pure function
 * of the map and the position (a chunk painted twice, here or there, is the same picture).
 */
import { describe, expect, it, vi } from 'vitest';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { CHUNK_ART, GroundPainter, type GroundSource } from '../src/games/sigilfall/render/groundPaint';
import { K, parseRegion } from '../src/games/sigilfall/sim/map';

const source = (id: keyof typeof REGIONS): GroundSource => {
  const map = parseRegion(REGIONS[id]);
  return { w: map.w, h: map.h, kind: map.kind, marked: map.markers.map((m) => m.ty * map.w + m.tx), theme: REGIONS[id].theme };
};

/** The top rows of a chunk (a whole chunk is 256 rows; a band is enough and keeps the test quick). */
const ROWS = 64;
const paint = (gp: GroundPainter, cx: number, cy: number): Uint8ClampedArray => {
  const buf = new Uint8ClampedArray(CHUNK_ART * ROWS * 4);
  gp.paint(cx, cy, buf, 0, ROWS);
  return buf;
};

describe('sigilfall ground', () => {
  it('paints without the DOM (no canvases), the same every time, opaque', () => {
    const make = vi.spyOn(document, 'createElement');
    for (const id of ['emberwick', 'whisperwood', 'crypt'] as const) {
      const a = paint(new GroundPainter(source(id)), 1, 1);
      const b = paint(new GroundPainter(source(id)), 1, 1);
      expect(a).toEqual(b);
      for (let i = 3; i < a.length; i += 4) expect(a[i]).toBe(255);
      // and it is a picture, not a flat fill
      const colors = new Set<number>();
      for (let i = 0; i < a.length; i += 4) colors.add((a[i]! << 16) | (a[i + 1]! << 8) | a[i + 2]!);
      expect(colors.size).toBeGreaterThan(12);
    }
    expect(make).not.toHaveBeenCalled();
    make.mockRestore();
  }, 30_000);

  it('paints rows in pieces exactly as in one go', () => {
    const gp = new GroundPainter(source('whisperwood'));
    const whole = paint(gp, 2, 1);
    const parts = new Uint8ClampedArray(CHUNK_ART * ROWS * 4);
    for (let r = 0; r < ROWS; r += 8) gp.paint(2, 1, parts, r, r + 8);
    expect(parts).toEqual(whole);
  });

  it('things on the village square stand on its stones, not on a patch of grass', () => {
    const src = source('emberwick');
    const map = parseRegion(REGIONS.emberwick);
    const gp = new GroundPainter(src) as unknown as { gkAt(tx: number, ty: number): number };
    const onSquare = map.markers.filter((m) => {
      const around = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].filter(([dx, dy]) => map.kind[(m.ty + dy!) * map.w + m.tx + dx!] === K.Cobble).length;
      return around >= 3;
    });
    expect(onSquare.length).toBeGreaterThan(0);
    for (const m of onSquare) expect(gp.gkAt(m.tx, m.ty)).toBe(K.Cobble);
  });
});
