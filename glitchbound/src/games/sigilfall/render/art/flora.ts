import { hash2, noise2 } from '../../core/math';
import { THEMES } from '../../data/themes';
import type { Theme } from '../../data/types';
import { OUTLINE_RGB, Painter, ramp, rgb, type Ramp, type RGB } from './kit';

/**
 * Trees, bushes, rocks and the trunks under the forest's edge, painted at art resolution: leaf
 * clusters built from overlapping blobs, each lit from the top left, with leafy edges, glints and
 * gaps; bark with streaks; roots. Every one is a little different (seeded by its tile).
 */

/** A theme's leaves and bark (see data/themes.ts). */
const leavesOf = (theme: Theme): RGB[] => THEMES[theme].leaves.map(rgb);
const barkOf = (theme: Theme): Ramp => ramp(THEMES[theme].bark);
const PINE_BARK = ramp('#56381e');

/** Rock colors where the lands differ from plain grey stone. */
const ROCK: Partial<Record<Theme, string>> = { crypt: '#5e5c74', desert: '#b0784a', volcanic: '#3a3436', snow: '#9aa8b8', rift: '#5a4a7a', blight: '#5a4e5e', haunted: '#5e6a76', deadlake: '#6a6c74', mountain: '#7e7e8c', peaks: '#8a94a6', sunken: '#4e5e58', bonefield: '#8a8270', gloam: '#3a443c', pale: '#7a7e8c' };

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
  const leaves = leavesOf(theme);
  const bark = barkOf(theme);
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
  if ((theme === 'village' || theme === 'farm') && r(3) < 0.5) {
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

export function pineTree(seed: number, snowy = false): Painter {
  const p = new Painter(54, 90);
  const bark = PINE_BARK;
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
        // snow lies along each tier's upper slopes (the pixels just under its edge), with gaps
        if (snowy && y < 20 && Math.abs(x - 27) > (half * (y - 3)) / 24 && hash2(x, y + top, 77 + seed) > 0.12) {
          p.set(x, top + y, y < 2 ? rgb('#ffffff') : rgb('#dce8f4'));
          continue;
        }
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

/** A palm for the coast: a ringed trunk leaning a little, drooping fronds, coconuts under the crown. */
export function palmTree(seed: number): Painter {
  const p = new Painter(76, 94);
  const r = (n: number): number => hash2(seed, n, 17);
  const bark = ramp('#a88250');
  const lean = (r(1) - 0.5) * 18;
  const topX = 38 + lean;
  const topY = 30;
  for (let y = topY; y < 93; y++) {
    const t = (93 - y) / (93 - topY);
    const cx = 38 + lean * t * t;
    const half = 3.8 - t * 1.3;
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const k = (x + 0.5 - (cx - half)) / (2 * half);
      if (k < 0 || k > 1) continue;
      let i = k < 0.3 ? 1 : k > 0.72 ? 3 : 2;
      // the trunk's rings
      if ((y + Math.round(lean * t * t)) % 5 === 0) i = Math.min(4, i + 1);
      p.set(x, y, bark[i]!);
    }
  }
  const leaves = ['#123a24', '#1a5030', '#246a3c', '#33864a', '#4ea45a', '#7cc46e'].map(rgb);
  const fronds = 8;
  // the fronds' shaded undersides first, then their lit tops
  for (let pass = 0; pass < 2; pass++) {
    for (let f = 0; f < fronds; f++) {
      const side = (f / (fronds - 1)) * 2 - 1;
      const reach = 26 + r(f + 4) * 8;
      const rise = (1 - Math.abs(side)) * 12 + 3;
      const droop = 12 + Math.abs(side) * 12;
      for (let s = 1; s <= 18; s++) {
        const u = s / 18;
        const x = topX + side * reach * u;
        const y = topY - rise * Math.sin(u * Math.PI * 0.65) + u * u * droop;
        const w = (1 - u) * 4.2 + 1.1;
        if (pass === 0) p.ellipse(x, y + 1.6, w, w * 0.6, leaves[1]!);
        else {
          p.ellipse(x, y, w, w * 0.55, leaves[u < 0.25 ? 4 : u < 0.65 ? 3 : 2]!);
          // leaflets hanging from the rib
          if (s % 2 === 0) p.line(Math.round(x), Math.round(y), Math.round(x + side * 1.5), Math.round(y + w + 2), leaves[2]!);
        }
      }
    }
  }
  for (const [ox, oy] of [
    [-3, 4],
    [2, 5],
    [0, 2],
  ] as const)
    p.ball(topX + ox, topY + oy, 2.4, 2.4, ramp('#7a5628'));
  p.disc(topX - 1, topY - 2, 2.2, leaves[5]!);
  p.outline(OUTLINE_RGB);
  return p;
}

/** A dead tree: a bare, twisted trunk and forked branches (barrows, blight, warfronts, haunted woods). */
export function deadTree(theme: Theme, seed: number): Painter {
  const p = new Painter(60, 84);
  const bark = barkOf(theme);
  const r = (n: number): number => hash2(seed, n, 23);
  trunk(p, 25, 40, 9, 42, bark, seed);
  // branches: forked lines thickened by one, the upper side lit
  const branch = (x0: number, y0: number, a: number, len: number, depth: number): void => {
    const x1 = x0 + Math.cos(a) * len;
    const y1 = y0 + Math.sin(a) * len;
    const steps = Math.ceil(len);
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps);
      const y = Math.round(y0 + ((y1 - y0) * i) / steps);
      const thick = depth >= 2 ? 2 : 1;
      for (let d = 0; d < thick; d++) {
        p.set(x + d, y, bark[d === 0 ? 2 : 3]!);
        p.set(x + d, y + 1, bark[3]!);
      }
    }
    if (depth > 0) {
      branch(x1, y1, a - 0.45 - r(depth * 7 + len) * 0.3, len * 0.65, depth - 1);
      branch(x1, y1, a + 0.4 + r(depth * 11 + len) * 0.3, len * 0.6, depth - 1);
    }
  };
  branch(29, 44, -Math.PI / 2 - 0.5, 16 + r(1) * 4, 3);
  branch(31, 46, -Math.PI / 2 + 0.55, 15 + r(2) * 4, 3);
  branch(29, 58, -Math.PI + 0.35, 9, 1);
  p.outline(OUTLINE_RGB);
  return p;
}

/** A cactus: a ribbed column with an arm or two, a flower on top now and then. */
export function cactus(seed: number): Painter {
  const p = new Painter(40, 60);
  const G = ramp('#4a8a3a');
  const r = (n: number): number => hash2(seed, n, 29);
  const column = (cx: number, top: number, bottom: number, half: number): void => {
    for (let y = top; y <= bottom; y++) {
      const round = y - top < half ? Math.sqrt(Math.max(0, half * half - (half - (y - top)) ** 2)) : half;
      for (let x = Math.round(cx - round); x <= Math.round(cx + round); x++) {
        const k = (x - (cx - half)) / (2 * half);
        let i = k < 0.3 ? 1 : k > 0.7 ? 3 : 2;
        // ribs
        if (Math.round(x - cx) % 3 === 0) i = Math.min(4, i + 1);
        p.set(x, y, G[i]!);
      }
    }
  };
  column(20, 8, 58, 5);
  // arms: out, then up
  if (r(1) < 0.8) {
    const ay = 26 + Math.floor(r(2) * 10);
    for (let x = 10; x < 17; x++) for (let y = ay; y < ay + 6; y++) p.set(x, y, G[y === ay ? 1 : 2]!);
    column(11, ay - 12, ay + 4, 3.5);
  }
  if (r(3) < 0.6) {
    const ay = 32 + Math.floor(r(4) * 8);
    for (let x = 24; x < 30; x++) for (let y = ay; y < ay + 5; y++) p.set(x, y, G[y === ay ? 2 : 3]!);
    column(29, ay - 9, ay + 3, 3);
  }
  // spines
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r(10 + i) * 40);
    const y = Math.floor(r(50 + i) * 60);
    if (p.alpha(x, y)) p.set(x, y, rgb('#f2ead8'));
  }
  if (r(5) < 0.4) p.disc(20, 8, 2.5, rgb('#ff6a8a'));
  p.outline(OUTLINE_RGB);
  return p;
}

/** A giant mushroom: a pale stem and a broad spotted cap (fey woods, blight, plague swamps). */
export function mushroomTree(theme: Theme, seed: number): Painter {
  const p = new Painter(64, 78);
  const r = (n: number): number => hash2(seed, n, 31);
  const cap = ramp(theme === 'fey' ? (r(1) < 0.5 ? '#6a8aff' : '#c86aff') : theme === 'plague' ? '#8a9a3a' : '#a85a8a');
  const stem = ramp('#d8d0c0');
  for (let y = 34; y < 77; y++) {
    const half = 5 + Math.max(0, y - 66) * 0.5;
    for (let x = Math.round(32 - half); x <= Math.round(32 + half); x++) {
      const k = (x - (32 - half)) / (2 * half);
      p.set(x, y, stem[k < 0.3 ? 1 : k > 0.7 ? 3 : 2]!);
    }
  }
  // the cap: a dome lit from the top left, with a dark rim underneath
  p.ellipse(32, 30, 28, 9, cap[4]!);
  p.ellipse(32, 24, 28, 16, (dx, dy) => (dy > 8 ? null : cap[dx < -10 && dy < -2 ? 1 : dx > 12 || dy > 3 ? 3 : 2]!));
  p.ellipse(25, 16, 9, 4, cap[0]!);
  // spots
  for (let i = 0; i < 7; i++) {
    const x = 12 + r(10 + i) * 40;
    const y = 12 + r(20 + i) * 14;
    if (p.alpha(Math.round(x), Math.round(y))) p.disc(x, y, 1.6 + r(30 + i) * 1.5, rgb('#f6f0e4'));
  }
  // a soft glow under fey caps
  if (theme === 'fey') for (let x = 10; x < 54; x += 3) p.set(x, 33 + (x % 2), rgb('#c8f4ff'));
  p.outline(OUTLINE_RGB);
  return p;
}

/** A crystal spire grown out of rift-torn ground: faceted shards, light on one face. */
export function crystalSpire(seed: number): Painter {
  const p = new Painter(52, 80);
  const r = (n: number): number => hash2(seed, n, 37);
  const C = ramp(r(1) < 0.5 ? '#9a5aff' : '#3ad8ff');
  const shard = (cx: number, base: number, h: number, half: number, lean: number): void => {
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const w = half * Math.min(1, (1 - t) * 1.6);
      const mid = cx + lean * t;
      for (let x = Math.round(mid - w); x <= Math.round(mid + w); x++) {
        const lit = x < mid;
        p.set(x, base - y, C[lit ? (t > 0.7 ? 0 : 1) : x > mid + w * 0.5 ? 4 : 3]!);
      }
    }
  };
  shard(16, 78, 34 + r(2) * 10, 6, -6);
  shard(36, 78, 30 + r(3) * 10, 5, 7);
  shard(26, 78, 60 + r(4) * 14, 8, 2 * (r(5) - 0.5));
  // a glint
  p.rect(22, 30, 1, 6, rgb('#ffffff'));
  p.outline(OUTLINE_RGB);
  return p;
}

/** A willow: a crooked trunk and long hanging strands (marshes and swamps). */
export function willowTree(theme: Theme, seed: number): Painter {
  const p = new Painter(70, 84);
  const leaves = leavesOf(theme);
  const bark = barkOf(theme);
  const r = (n: number): number => hash2(seed, n, 41);
  trunk(p, 30, 44, 10, 38, bark, seed);
  foliage(p, [
    [35, 30, 22],
    [22, 34, 13],
    [48, 34, 13],
    [35, 18, 15],
  ], [[35, 18, 15]], leaves, seed % 5);
  // hanging strands
  for (let i = 0; i < 16; i++) {
    const x = 12 + Math.floor(r(i) * 46);
    const top = 30 + Math.floor(r(i + 20) * 10);
    const len = 14 + Math.floor(r(i + 40) * 22);
    for (let y = top; y < Math.min(82, top + len); y++) p.set(x + (y % 7 === 0 ? 1 : 0), y, leaves[y - top > len * 0.7 ? 3 : 2]!);
  }
  p.outline(OUTLINE_RGB);
  return p;
}

/** A jungle tree: a tall trunk with buttress roots under a broad, layered crown. */
export function jungleTree(theme: Theme, seed: number): Painter {
  const p = new Painter(76, 96);
  const leaves = leavesOf(theme);
  const bark = barkOf(theme);
  trunk(p, 32, 40, 11, 54, bark, seed);
  // buttress roots
  for (const side of [-1, 1]) for (let y = 78; y < 95; y++) for (let d = 0; d < (y - 78) * 0.5; d++) p.set(side < 0 ? 31 - d : 43 + d, y, bark[side < 0 ? 1 : 3]!);
  foliage(p, [
    [38, 34, 20],
    [18, 38, 14],
    [58, 38, 14],
    [28, 22, 15],
    [50, 22, 15],
    [38, 12, 12],
  ], [
    [28, 22, 15],
    [50, 22, 15],
    [38, 12, 12],
  ], leaves, seed % 7, [[30, 12, 3]]);
  // vines hanging from the crown
  for (let i = 0; i < 6; i++) {
    const x = 16 + Math.floor(hash2(seed, i, 43) * 44);
    for (let y = 44; y < 44 + 8 + Math.floor(hash2(seed, i, 44) * 18); y++) p.set(x, y, leaves[2]!);
  }
  p.outline(OUTLINE_RGB);
  return p;
}

/** The trunk and roots under the overhanging edge of the forest. */
export function edgeTrunk(theme: Theme, seed: number): Painter {
  const p = new Painter(28, 28);
  const bark = barkOf(theme);
  trunk(p, 10, 0, 8, 27, bark, seed);
  // in the canopy's shadow at the top
  for (let y = 0; y < 8; y++) for (let x = 0; x < 28; x++) if (p.alpha(x, y)) p.set(x, y, bark[4]);
  p.outline(OUTLINE_RGB);
  return p;
}

export function bushArt(theme: Theme, seed: number): Painter {
  const p = new Painter(42, 32);
  const leaves = leavesOf(theme);
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
  const R = ramp(ROCK[theme] ?? '#8e8c9c');
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
  if (theme === 'snow' && hash2(seed, 3, 3) < 0.8) {
    // a cap of snow
    for (let y = 2; y < 9; y++) for (let x = 6; x < 26; x++) if (p.alpha(x, y) && noise2(x / 3, y / 2, 91 + seed) > 0.35 - (9 - y) * 0.06) p.set(x, y, y < 5 ? rgb('#ffffff') : rgb('#dce8f4'));
  }
  if (theme === 'forest' && hash2(seed, 3, 3) < 0.6) {
    // moss on the top
    const M = ramp('#4a8a3a');
    for (let y = 3; y < 10; y++) for (let x = 7; x < 24; x++) if (p.alpha(x, y) && noise2(x / 3, y / 2, 90 + seed) > 0.45) p.set(x, y, y < 6 ? M[1] : M[2]);
  }
  p.outline(OUTLINE_RGB);
  return p;
}
