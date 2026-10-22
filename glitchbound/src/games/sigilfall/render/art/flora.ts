import { hash2, noise2 } from '../../core/math';
import type { Theme } from '../../data/types';
import { OUTLINE_RGB, Painter, ramp, rgb, type RGB } from './kit';

/**
 * Trees, bushes, rocks and the trunks under the forest's edge, painted at art resolution: leaf
 * clusters built from overlapping blobs, each lit from the top left, with leafy edges, glints and
 * gaps; bark with streaks; roots. Every one is a little different (seeded by its tile).
 */

const LEAVES: Record<'village' | 'forest', RGB[]> = {
  village: ['#174a22', '#22602e', '#2f7a3a', '#3c9445', '#56ac52', '#86d070'].map(rgb),
  forest: ['#0f3420', '#174a2c', '#1f5e35', '#2c7a44', '#45995a', '#6cbc7a'].map(rgb),
};
const BARK = { village: ramp('#6a4424'), forest: ramp('#56381e') };

type Blob = [number, number, number];

/**
 * A leaf mass from blobs: shade inside every blob, mid tone in blobs moved up-left and shrunk,
 * light in the top blobs, a few sunlit spots; edges wobble like leaves.
 */
function foliage(p: Painter, blobs: Blob[], tops: Blob[], leaves: RGB[], seed: number, spots: Blob[] = []): void {
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const wob = (noise2(x / 3, y / 3, 44 + seed) - 0.5) * 3.2;
      const inside = (b: Blob, dx: number, dy: number, dr: number): boolean => {
        const ex = x + 0.5 - (b[0] + dx);
        const ey = y + 0.5 - (b[1] + dy);
        const r = b[2] - dr - wob;
        return r > 0 && ex * ex + ey * ey <= r * r;
      };
      let layer = -1;
      for (const b of blobs) if (inside(b, 0, 0, 0)) layer = 1;
      if (layer < 0) continue;
      for (const b of blobs) if (inside(b, -2, -3, 4)) layer = 2;
      for (const b of tops) if (inside(b, -3, -4, 7)) layer = 3;
      for (const b of spots) if (inside(b, 0, 0, 0)) layer = 4;
      // leaf texture: glints and gaps
      const lf = noise2(x / 2.2, y / 1.8, 52 + seed);
      let i = layer;
      if (lf > 0.75) i += 1;
      else if (lf < 0.2) i -= 1;
      if (hash2(x, y, 53 + seed) < 0.025) i += 1;
      p.set(x, y, leaves[Math.max(0, Math.min(5, i))]!);
    }
  }
}

function trunk(p: Painter, x0: number, y0: number, w: number, h: number, bark: RGB[], seed: number): void {
  for (let y = y0; y < y0 + h; y++) {
    // the trunk flares into roots at the foot
    const flare = Math.max(0, y - (y0 + h - 6));
    const l = x0 - Math.round(flare * 0.8);
    const r = x0 + w + Math.round(flare * 0.8);
    for (let x = l; x < r; x++) {
      const t = (x - l) / Math.max(1, r - l - 1);
      let i = t < 0.25 ? 1 : t > 0.7 ? 3 : 2;
      // streaks in the bark
      if (noise2(x * 0.9, y / 6, 61 + seed) > 0.68) i += 1;
      if (hash2(x, y, 62 + seed) < 0.04) i = 1;
      p.set(x, y, bark[Math.min(4, i)]!);
    }
  }
}

export function oakTree(theme: Theme, seed: number): Painter {
  const p = new Painter(70, 86);
  const leaves = LEAVES[theme === 'forest' ? 'forest' : 'village'];
  const bark = BARK[theme === 'forest' ? 'forest' : 'village'];
  trunk(p, 29, 52, 12, 32, bark, seed);
  // shade under the leaves
  p.rect(29, 52, 12, 5, bark[4]);
  const r = (n: number): number => hash2(seed, n, 5);
  const blobs: Blob[] = [
    [35, 35, 23],
    [19 + r(1) * 6, 41, 14],
    [51 - r(2) * 6, 41, 14],
    [25, 23, 16],
    [45, 23, 16],
    [35, 15, 14],
  ];
  foliage(p, blobs, blobs.slice(3), leaves, seed % 7, [
    [26, 15, 3],
    [40, 11, 2],
  ]);
  // apples in village trees
  if (theme === 'village' && r(3) < 0.5) {
    const red = ramp('#e8404a');
    for (const [x, y] of [
      [20, 37],
      [44, 31],
      [32, 45],
      [52, 42],
    ] as const) {
      p.rect(x, y, 2, 2, red[2]);
      p.set(x, y, red[0]);
      p.set(x + 1, y + 1, red[3]);
    }
  }
  p.outline(OUTLINE_RGB);
  return p;
}

export function pineTree(seed: number): Painter {
  const p = new Painter(54, 90);
  const bark = BARK.forest;
  trunk(p, 23, 68, 8, 20, bark, seed);
  const G = ['#0e3020', '#174a2c', '#245e38', '#357a48', '#4f9a5e'].map(rgb);
  for (let t = 0; t < 4; t++) {
    const top = 3 + t * 16;
    const half = 12 + t * 6;
    for (let y = 0; y < 24; y++) {
      const w = Math.round((half * y) / 24);
      for (let x = 27 - w; x <= 27 + w; x++) {
        // the tier's lower edge is a row of needle tips
        if (y > 20 && (x + t) % 4 !== 0 && y > 21 + ((x * 7 + t) % 3)) continue;
        const k = (x - (27 - w)) / Math.max(1, 2 * w);
        let i = k < 0.3 ? 3 : k > 0.72 ? 1 : 2;
        if (y > 19) i -= 1;
        // needles: short diagonal strokes
        if ((x * 2 + y) % 5 === 0 && i > 0) i -= 1;
        if (hash2(x, y + top, 70 + seed) < 0.03) i = 4;
        p.set(x, top + y, G[Math.max(0, Math.min(4, i))]!);
      }
    }
  }
  if (hash2(seed, 2, 9) < 0.4) {
    // a dusting of snow on the tip
    p.rect(25, 4, 4, 2, rgb('#e8f0ff'));
    p.set(26, 3, rgb('#ffffff'));
  }
  p.outline(OUTLINE_RGB);
  return p;
}

/** The trunk and roots under the overhanging edge of the forest. */
export function edgeTrunk(theme: Theme, seed: number): Painter {
  const p = new Painter(28, 28);
  const bark = BARK[theme === 'forest' ? 'forest' : 'village'];
  trunk(p, 10, 0, 8, 27, bark, seed);
  // in the canopy's shadow at the top
  for (let y = 0; y < 8; y++) for (let x = 0; x < 28; x++) if (p.alpha(x, y)) p.set(x, y, bark[4]);
  p.outline(OUTLINE_RGB);
  return p;
}

export function bushArt(theme: Theme, seed: number): Painter {
  const p = new Painter(42, 32);
  const leaves = LEAVES[theme === 'forest' ? 'forest' : 'village'];
  const blobs: Blob[] = [
    [12, 19, 10],
    [29, 19, 10],
    [21, 13, 12],
  ];
  foliage(p, blobs, [blobs[2]!], leaves.slice(0, 5).concat([leaves[5]!]), seed % 5, [[17, 8, 2]]);
  if (hash2(seed, 1, 4) < 0.5) {
    const B = ramp(theme === 'forest' ? '#b06aff' : '#ff5a7a');
    for (const [x, y] of [
      [12, 20],
      [27, 14],
      [20, 23],
      [31, 21],
      [16, 12],
    ] as const) {
      p.rect(x, y, 2, 2, B[2]);
      p.set(x, y, B[0]);
    }
  }
  p.outline(OUTLINE_RGB);
  return p;
}

export function rockArt(theme: Theme, seed: number): Painter {
  const p = new Painter(34, 26);
  const R = ramp(theme === 'crypt' ? '#5e5c74' : '#8e8c9c');
  const lumps: Blob[] = [
    [13, 15, 9],
    [21, 15, 9],
    [16, 11, 8],
  ];
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      let best = -1;
      for (const [bx, by, r] of lumps) {
        const ex = (x + 0.5 - bx) / r;
        const ey = (y + 0.5 - by) / (r * 0.85);
        const d = ex * ex + ey * ey;
        if (d <= 1) best = Math.max(best, -ex * 0.5 - ey * 0.7 + Math.sqrt(1 - d) * 0.5);
      }
      if (best < -0.5) continue;
      // facets: brightness in steps, with a crack or two
      let i = best > 0.45 ? 0 : best > 0.2 ? 1 : best > -0.05 ? 2 : best > -0.3 ? 3 : 4;
      if (hash2(x, y, 33 + seed) < 0.05) i = Math.min(4, i + 1);
      if (Math.abs(x - 14 - (y - 8) * 0.5) < 0.6 && y > 9 && y < 18 && hash2(seed, 1, 7) < 0.6) i = 4;
      p.set(x, y, R[i]!);
    }
  }
  if (theme === 'forest' && hash2(seed, 3, 3) < 0.6) {
    // moss on the top
    const M = ramp('#4a8a3a');
    for (let y = 3; y < 10; y++) for (let x = 7; x < 24; x++) if (p.alpha(x, y) && noise2(x / 3, y / 2, 90 + seed) > 0.45) p.set(x, y, y < 6 ? M[1] : M[2]);
  }
  p.outline(OUTLINE_RGB);
  return p;
}
