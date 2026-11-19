/**
 * A river is crossed in more than one place (2026-11-19, the owner: "some zones with rivers have a bridge only at one
 * side of the map and that makes traversing literally nightmare, when you have a huge river, make at least 2-3 bridges
 * to cross it"). The roads are a tree and crossed each river about once; Highwall, Glimmerwood and Amberfield had one
 * bridge each, in their northern quarter (data/zonegen.ts crossings).
 */
import { describe, expect, it } from 'vitest';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { RegionId } from '../src/games/sigilfall/data/types';

/** The bridges on a map: each run of bridge tiles at least `least` big, by its middle. */
function bridges(rows: string[], least = 4): { x: number; y: number }[] {
  const h = rows.length;
  const w = rows[0]!.length;
  const seen = new Uint8Array(w * h);
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rows[y]![x] !== 'b' || seen[y * w + x]) continue;
      const q = [y * w + x];
      seen[q[0]!] = 1;
      let sx = 0;
      let sy = 0;
      for (let k = 0; k < q.length; k++) {
        const i = q[k]!;
        const cx = i % w;
        const cy = (i - cx) / w;
        sx += cx;
        sy += cy;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || rows[ny]![nx] !== 'b') continue;
          seen[ny * w + nx] = 1;
          q.push(ny * w + nx);
        }
      }
      if (q.length >= least) out.push({ x: sx / q.length, y: sy / q.length });
    }
  }
  return out;
}

/** The lands a river runs through (data/zones/*.ts, `water: { kind: 'river' }`). */
const RIVERS: RegionId[] = ['amberfield', 'brackenridge', 'glimmerwood', 'highwall', 'weeping-woods'];

describe('Sigilfall: rivers are crossed in more than one place', () => {
  for (const id of RIVERS) {
    it(`${id}: at least two bridges, well apart, one of them south of the first quarter of the map`, () => {
      const rows = REGIONS[id].map;
      const list = bridges(rows);
      expect(list.length, id).toBeGreaterThanOrEqual(2);
      const far = list.some((a) => list.some((b) => Math.hypot(a.x - b.x, a.y - b.y) >= 16));
      expect(far, `${id}: ${JSON.stringify(list)}`).toBe(true);
      // (the one bridge every such land had stood in its northern quarter)
      expect(list.some((b) => b.y > rows.length * 0.3), `${id}: ${JSON.stringify(list)}`).toBe(true);
    });
  }

  it('Highwall and Glimmerwood, crossed north to south, have a bridge in each third of their river', () => {
    for (const id of ['highwall', 'glimmerwood'] as const) {
      const rows = REGIONS[id].map;
      const ys = bridges(rows).map((b) => b.y / rows.length);
      for (const [lo, hi] of [
        [0, 1 / 3],
        [1 / 3, 2 / 3],
        [2 / 3, 1],
      ] as const)
        expect(
          ys.some((y) => y >= lo && y < hi),
          `${id}: ${ys.map((y) => y.toFixed(2)).join(', ')}`,
        ).toBe(true);
    }
  });
});
