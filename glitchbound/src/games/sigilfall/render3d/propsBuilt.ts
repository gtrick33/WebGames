import { hash2 } from '../core/math';
import { Build, mul, type C } from './build';
import { hexRgb } from './kits';
import type { MeshData } from './pack';

/**
 * The things the packs don't have a good one of, seen from where this camera sees them: a lamp whose lantern hangs from
 * a thin arm is a bent stick from up here, a wall torch stood on the floor is a claw with a fire over it, a flag no
 * thicker than a pencil is a feather. These are built so that they read from above and in front: what they are is on
 * the top and the south side. Each is around its own middle, in tiles, its foot on the ground, and is sized by its line
 * in props.ts like any model.
 */

const rgb = hexRgb;
const WOOD = rgb('#7a5a3c');
const WOOD_DARK = rgb('#4e3a28');
const IRON = rgb('#4a4650');
const IRON_DARK = rgb('#2a282e');
const STONE = rgb('#8e8a84');
const STONE_DARK = rgb('#5e5a56');
const PANE = rgb('#ffd27a');
const PANE_HOT = rgb('#fff0c0');
const LEAF = rgb('#4e7a3a');

/** A lantern: its lit panes on all four sides, an iron frame and a pointed cap. */
function lanternHead(b: Build, y: number, k: number): void {
  const hw = 0.13 * k;
  const h = 0.3 * k;
  // the light in it
  b.box(-hw, -hw, hw, hw, y, y + h, PANE, PANE_HOT, PANE);
  // the frame, standing proud of the panes
  const fr = 0.022 * k;
  for (const [x, z] of [[-hw, -hw], [hw, -hw], [-hw, hw], [hw, hw]] as const) b.box(x - fr, z - fr, x + fr, z + fr, y - 0.01, y + h + 0.01, IRON_DARK, IRON_DARK, IRON);
  b.box(-hw - fr, -hw - fr, hw + fr, hw + fr, y - 0.03 * k, y, IRON_DARK, IRON_DARK, IRON);
  // the cap
  b.post(0, 0, 0.21 * k, 0.03 * k, y + h, y + h + 0.17 * k, 4, IRON_DARK, IRON, 0, 0, Math.PI / 4);
  b.post(0, 0, 0.03 * k, 0.012 * k, y + h + 0.17 * k, y + h + 0.24 * k, 4, IRON, IRON);
}

/** The street lamp: a stone foot, a stout post, the lantern on top where anyone can see it. */
function lamp(): Build {
  const b = new Build();
  b.post(0, 0, 0.17, 0.12, 0, 0.14, 8, STONE_DARK, STONE);
  b.post(0, 0, 0.075, 0.06, 0.14, 1.28, 6, WOOD_DARK, WOOD);
  // an iron band, and the bracket the lantern sits in
  b.post(0, 0, 0.082, 0.08, 0.72, 0.78, 6, IRON_DARK, IRON);
  b.post(0, 0, 0.07, 0.16, 1.2, 1.3, 4, IRON_DARK, IRON, 0, 0, Math.PI / 4);
  lanternHead(b, 1.31, 1.05);
  return b;
}

/** A lantern set down on the ground. */
function lantern(): Build {
  const b = new Build();
  b.post(0, 0, 0.14, 0.11, 0, 0.05, 6, IRON_DARK, IRON);
  lanternHead(b, 0.06, 1);
  // its ring, to carry it by
  b.post(0, 0, 0.025, 0.025, 0.48, 0.56, 4, IRON, IRON);
  return b;
}

/** A torch on a pole, stuck in the ground. The fire burns in the basket at the top (props.ts: flameAt). */
function poleTorch(shaft: C, shaftDark: C): Build {
  const b = new Build();
  // (a few stones packed round its foot)
  for (const [x, z, r] of [[-0.09, 0.05, 0.07], [0.09, 0.06, 0.06], [0.01, -0.1, 0.07]] as const) b.post(x, z, r, r * 0.5, 0, 0.07, 5, STONE_DARK, STONE);
  b.post(0, 0, 0.05, 0.04, 0, 1.02, 6, shaftDark, shaft);
  // the basket, and the coals in it
  b.post(0, 0, 0.055, 0.145, 1.0, 1.18, 7, IRON_DARK, IRON);
  b.post(0, 0, 0.125, 0.05, 1.18, 1.22, 7, rgb('#ff7a22'), rgb('#ffd25a'));
  return b;
}

/** Sacks: two fat ones and a small one, their necks tied. */
function sacks(): Build {
  const b = new Build();
  const c0 = rgb('#8a7654');
  const c1 = rgb('#c2ab80');
  const sack = (x: number, z: number, k: number): void => {
    b.post(x, z, 0.24 * k, 0.26 * k, 0, 0.16 * k, 8, mul(c0, 0.86), c0);
    b.post(x, z, 0.26 * k, 0.11 * k, 0.16 * k, 0.36 * k, 8, c0, c1);
    b.post(x, z, 0.06 * k, 0.1 * k, 0.36 * k, 0.45 * k, 6, c0, c1);
  };
  sack(-0.2, -0.08, 1);
  sack(0.2, -0.04, 0.92);
  sack(0.02, 0.18, 0.78);
  return b;
}

/** A wicker basket with something in it. */
function basket(): Build {
  const b = new Build();
  const c = rgb('#b08a50');
  b.post(0, 0, 0.2, 0.27, 0, 0.26, 9, mul(c, 0.7), c);
  b.post(0, 0, 0.27, 0.285, 0.26, 0.29, 9, mul(c, 1.1), mul(c, 1.2));
  b.post(0, 0, 0.27, 0, 0.285, 0.29, 9, rgb('#4a3a28'), rgb('#4a3a28'));
  for (const [x, z, col] of [[-0.1, 0.04, '#c84a3a'], [0.08, 0.07, '#d8703a'], [0.02, -0.09, '#b83a30'], [0.14, -0.05, '#c85a3a']] as const) b.post(x, z, 0.075, 0.03, 0.29, 0.38, 6, rgb(col), mul(rgb(col), 1.25));
  return b;
}

/** A log on its side, running north and south: the cut end looks at the camera, pale with its rings. */
function logEnd(b: Build, x: number, y: number, z0: number, z1: number, r: number, seed: number): void {
  const m = b.m;
  const bark = mul(WOOD_DARK, 0.9 + hash2(seed, 3, 1) * 0.35);
  const barkHi = mul(WOOD, 0.85 + hash2(seed, 5, 1) * 0.3);
  const n = 7;
  const at = (i: number, z: number): number[] => {
    const a = (i / n) * Math.PI * 2 + seed;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r, z];
  };
  for (let i = 0; i < n; i++) {
    const mid = ((i + 0.5) / n) * Math.PI * 2 + seed;
    const nor = [Math.cos(mid), Math.sin(mid), 0];
    const up = Math.sin(mid) > 0;
    m.quad(at(i + 1, z1), at(i, z1), at(i, z0), at(i + 1, z0), nor, up ? barkHi : bark);
  }
  // the cut end, and the heart of it
  const face = rgb('#d8bc90');
  const heart = rgb('#b08c5c');
  const c = [x, y, z1 + 0.002];
  for (let i = 0; i < n; i++) m.quad(c, at(i, z1 + 0.002), at(i + 1, z1 + 0.002), at(i + 1, z1 + 0.002), [0, 0, 1], heart, face);
}

function woodpile(): Build {
  const b = new Build();
  const r = 0.135;
  let seed = 1;
  for (const [row, count] of [[0, 4], [1, 3], [2, 2]] as const) {
    const y = r + row * r * 1.72;
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * r * 2.02;
      logEnd(b, x, y, -0.36, 0.36 + hash2(seed, 7, 2) * 0.06, r, seed++);
    }
  }
  return b;
}

/** One log, lying across the view. */
function log(): Build {
  const b = new Build();
  const m = b.m;
  const r = 0.17;
  const n = 7;
  const at = (i: number, x: number): number[] => {
    const a = (i / n) * Math.PI * 2 + 0.3;
    return [x, r + Math.sin(a) * r, Math.cos(a) * r];
  };
  for (let i = 0; i < n; i++) {
    const mid = ((i + 0.5) / n) * Math.PI * 2 + 0.3;
    const nor = [0, Math.sin(mid), Math.cos(mid)];
    const lit = Math.sin(mid) > 0.2;
    m.quad(at(i, -0.56), at(i, 0.56), at(i + 1, 0.56), at(i + 1, -0.56), nor, lit ? WOOD : WOOD_DARK);
  }
  // its cut ends, and a stub of a branch
  const face = rgb('#d8bc90');
  for (const [x, nx] of [[0.56, 1], [-0.56, -1]] as const) {
    const c = [x, r, 0];
    for (let i = 0; i < n; i++) {
      if (nx > 0) m.quad(c, at(i + 1, x), at(i, x), at(i, x), [1, 0, 0], face);
      else m.quad(c, at(i, x), at(i + 1, x), at(i + 1, x), [-1, 0, 0], face);
    }
  }
  b.post(0.12, 0.05, 0.05, 0.03, r * 1.7, r * 2.4, 5, WOOD_DARK, WOOD, 0.05, 0.03);
  return b;
}

/** A village well: a ring of stone, dark water, two posts and a little roof over the windlass. */
function well(): Build {
  const b = new Build();
  const R = 0.66;
  const ring = 12;
  const stones: C[] = [rgb('#8e8a84'), rgb('#7a7672'), rgb('#9a958c')];
  let seed = 3;
  // courses of stone, each round of them turned a little
  for (let c = 0; c < 3; c++) {
    const y0 = c * 0.18;
    for (let i = 0; i < ring; i++) {
      const a0 = ((i + c * 0.5) / ring) * Math.PI * 2;
      const a1 = ((i + 1 + c * 0.5) / ring) * Math.PI * 2;
      const col = mul(stones[Math.floor(hash2(seed++, 2, 3) * 3)]!, 0.92 + hash2(seed, 4, 3) * 0.12);
      const mid = (a0 + a1) / 2;
      b.m.quad([Math.cos(a1) * R, y0, Math.sin(a1) * R], [Math.cos(a0) * R, y0, Math.sin(a0) * R], [Math.cos(a0) * R, y0 + 0.175, Math.sin(a0) * R], [Math.cos(a1) * R, y0 + 0.175, Math.sin(a1) * R], [Math.cos(mid), 0, Math.sin(mid)], mul(col, 0.82), col);
    }
  }
  // its rim, and the dark water in it
  b.post(0, 0, R + 0.04, R - 0.14, 0.54, 0.6, ring, rgb('#a8a49c'), rgb('#b8b4aa'));
  b.post(0, 0, R - 0.14, 0.04, 0.602, 0.606, ring, rgb('#16303e'), rgb('#3a6a7e'));
  // the posts, the windlass and its rope, and the bucket hanging over the water
  for (const side of [-1, 1] as const) b.post(side * R, -0.02, 0.06, 0.05, 0.1, 1.46, 6, WOOD_DARK, WOOD);
  b.box(-R - 0.06, -0.06, R + 0.06, 0.02, 1.34, 1.44, WOOD_DARK, WOOD_DARK, WOOD);
  b.post(0, -0.02, 0.012, 0.012, 1.0, 1.34, 3, rgb('#c8b890'), rgb('#c8b890'));
  b.post(0, -0.02, 0.1, 0.12, 0.84, 1.0, 7, IRON_DARK, rgb('#8a6a44'));
  return b;
}

/** A fountain: a wide stone basin of still water, a column, a bowl running over at the top. */
function fountain(): Build {
  const b = new Build();
  const n = 12;
  const stone = rgb('#a8a49c');
  const dark = rgb('#6e6a66');
  const water = rgb('#3e86a8');
  const shine = rgb('#8accdc');
  b.post(0, 0, 1.02, 1.02, 0, 0.36, n, dark, stone);
  b.post(0, 0, 1.08, 0.88, 0.36, 0.42, n, stone, mul(stone, 1.15));
  b.post(0, 0, 0.88, 0.1, 0.424, 0.428, n, water, shine);
  b.post(0, 0, 0.2, 0.13, 0.42, 1.02, 8, dark, stone);
  b.post(0, 0, 0.13, 0.46, 1.02, 1.2, 10, dark, stone);
  b.post(0, 0, 0.42, 0.05, 1.204, 1.208, 10, water, shine);
  b.post(0, 0, 0.07, 0.04, 1.2, 1.5, 6, stone, mul(stone, 1.15));
  b.post(0, 0, 0.09, 0.0, 1.5, 1.64, 6, shine, rgb('#e0f4fa'));
  // water falling from the bowl into the basin, in a few strings
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    const r = 0.48;
    b.post(Math.cos(a) * r, Math.sin(a) * r, 0.018, 0.018, 0.42, 1.2, 3, shine, rgb('#c8ecf4'));
  }
  return b;
}

/** A stand with a dead knight's plate on it. */
function armorStand(): Build {
  const b = new Build();
  const steel = rgb('#9aa0a8');
  const dim = rgb('#5a5e68');
  b.post(0, 0, 0.17, 0.13, 0, 0.06, 6, WOOD_DARK, WOOD);
  b.post(0, 0, 0.035, 0.03, 0.06, 0.5, 5, WOOD_DARK, WOOD);
  // the breastplate, its shoulders, the helm over it
  b.post(0, 0, 0.14, 0.23, 0.42, 0.86, 8, dim, steel);
  for (const side of [-1, 1] as const) b.post(side * 0.27, 0, 0.1, 0.05, 0.78, 0.9, 6, dim, steel);
  b.post(0, 0, 0.13, 0.14, 0.92, 1.1, 8, dim, steel);
  b.post(0, 0, 0.14, 0.02, 1.1, 1.2, 8, steel, mul(steel, 1.2));
  b.faceS(-0.09, 0.09, 0.137, 0.98, 1.02, IRON_DARK);
  return b;
}

/** A bedroll on the ground: a blanket, its top rolled. */
function bedroll(): Build {
  const b = new Build();
  const wool = rgb('#7c6048');
  const edge = rgb('#a08462');
  b.box(-0.28, -0.42, 0.28, 0.55, 0, 0.07, mul(wool, 0.8), mul(wool, 0.7), wool);
  for (const z of [-0.2, 0.08, 0.36]) b.flat(-0.28, z, 0.28, z + 0.05, 0.075, edge);
  b.post(0, -0.52, 0.14, 0.14, 0.13, 0.14, 7, edge, edge);
  b.box(-0.29, -0.62, 0.29, -0.42, 0, 0.2, mul(edge, 0.82), mul(edge, 0.7), edge);
  return b;
}

/** A war standard: a stout pole and a crossbar with its cloth hanging toward the camera. */
function standard(cloth: C, trim: C, device: C): Build {
  const b = new Build();
  b.post(0, 0, 0.17, 0.11, 0, 0.1, 6, STONE_DARK, STONE);
  b.post(0, 0, 0.05, 0.04, 0.08, 2.3, 6, WOOD_DARK, WOOD);
  b.post(0, 0, 0.05, 0, 2.3, 2.44, 5, IRON, rgb('#c8c4b8'));
  b.box(-0.5, -0.035, 0.5, 0.035, 2.12, 2.2, WOOD_DARK, WOOD_DARK, WOOD);
  b.banner(0, 0.05, 2.12, 0.84, 1.26, cloth, trim, device);
  return b;
}

/** The Host's mark at a place it holds: a skull on the pole, a black rag under it. */
function skullStandard(): Build {
  const b = standard(rgb('#2a262c'), rgb('#4a444c'), rgb('#c8c0a8'));
  const bone = rgb('#d8d0b8');
  const shade = rgb('#8a8470');
  b.post(0, 0.02, 0.12, 0.15, 2.3, 2.46, 8, shade, bone);
  b.post(0, 0.02, 0.15, 0.03, 2.46, 2.58, 8, bone, mul(bone, 1.08));
  b.post(0, 0.04, 0.08, 0.09, 2.2, 2.3, 7, shade, bone);
  for (const side of [-1, 1] as const) b.faceS(side * 0.06 - 0.03, side * 0.06 + 0.03, 0.155, 2.36, 2.43, IRON_DARK);
  return b;
}

/** Iron bars round a little floor: someone was kept in it. */
function cage(): Build {
  const b = new Build();
  const hw = 0.46;
  const hd = 0.4;
  const h = 1.16;
  b.box(-hw, -hd, hw, hd, 0, 0.07, IRON_DARK, IRON_DARK, rgb('#3a3640'));
  b.box(-hw, -hd, hw, -hd + 0.05, h, h + 0.05, IRON_DARK, IRON_DARK, IRON);
  b.box(-hw, hd - 0.05, hw, hd, h, h + 0.05, IRON_DARK, IRON_DARK, IRON);
  b.box(-hw, -hd, -hw + 0.05, hd, h, h + 0.05, IRON_DARK, IRON_DARK, IRON);
  b.box(hw - 0.05, -hd, hw, hd, h, h + 0.05, IRON_DARK, IRON_DARK, IRON);
  const bar = (x: number, z: number): void => b.post(x, z, 0.018, 0.018, 0.05, h, 4, IRON_DARK, IRON);
  for (let i = 0; i <= 5; i++) {
    const x = -hw + 0.03 + (i / 5) * (hw * 2 - 0.06);
    bar(x, hd - 0.025);
    bar(x, -hd + 0.025);
  }
  for (let i = 1; i < 4; i++) {
    const z = -hd + (i / 4) * hd * 2;
    bar(-hw + 0.025, z);
    bar(hw - 0.025, z);
  }
  // a ring on top, to haul it by
  b.post(0, 0, 0.09, 0.03, h + 0.03, h + 0.12, 6, IRON_DARK, IRON);
  return b;
}

/** A clutch of eggs, pale and damp. */
function eggs(): Build {
  const b = new Build();
  const c = rgb('#e8dfc0');
  const shade = rgb('#a89a78');
  for (const [x, z, k] of [[-0.14, 0.06, 1], [0.13, 0.09, 0.9], [0, -0.11, 1.05], [0.2, -0.1, 0.72], [-0.22, -0.12, 0.7]] as const) {
    b.post(x, z, 0.06 * k, 0.11 * k, 0, 0.1 * k, 7, shade, c);
    b.post(x, z, 0.11 * k, 0.09 * k, 0.1 * k, 0.2 * k, 7, c, c);
    b.post(x, z, 0.09 * k, 0.015 * k, 0.2 * k, 0.28 * k, 7, c, mul(c, 1.06));
  }
  return b;
}

/** A throne: a high back with a crown of points, gold on its edges, a red seat. */
function throne(): Build {
  const b = new Build();
  const m = b.m;
  const wood = rgb('#5e4630');
  const dark = rgb('#3a2a1c');
  const gold = rgb('#d8ac4e');
  const goldDim = rgb('#a07a30');
  const red = rgb('#8e2428');
  const redHi = rgb('#b43a3a');
  const hw = 0.46;
  const backZ = -0.3;
  // the back, and its crown
  b.box(-hw, backZ - 0.12, hw, backZ, 0, 1.34, wood, dark, goldDim);
  const top = 1.34;
  for (let i = 0; i < 3; i++) {
    const x0 = -hw + (i * (hw * 2)) / 3;
    const x1 = x0 + (hw * 2) / 3;
    const tip = i === 1 ? 0.34 : 0.22;
    m.quad([x0, top, backZ], [x1, top, backZ], [(x0 + x1) / 2, top + tip, backZ], [(x0 + x1) / 2, top + tip, backZ], [0, 0, 1], goldDim, gold);
    m.quad([x1, top, backZ - 0.12], [x0, top, backZ - 0.12], [(x0 + x1) / 2, top + tip, backZ - 0.12], [(x0 + x1) / 2, top + tip, backZ - 0.12], [0, 0, -1], goldDim, gold);
  }
  // the cloth down its back, framed in gold
  b.faceS(-hw + 0.04, hw - 0.04, backZ + 0.005, 0.46, top - 0.04, goldDim, gold);
  b.faceS(-hw + 0.1, hw - 0.1, backZ + 0.01, 0.46, top - 0.1, mul(red, 0.86), redHi);
  // the seat and its cushion
  b.box(-hw, backZ, hw, 0.34, 0, 0.42, wood, dark, wood);
  b.box(-hw + 0.1, backZ, hw - 0.1, 0.3, 0.42, 0.52, red, mul(red, 0.8), redHi);
  // the arms, ending in gold
  for (const side of [-1, 1] as const) {
    const x0 = side < 0 ? -hw - 0.04 : hw - 0.1;
    const x1 = x0 + 0.14;
    b.box(x0, backZ, x1, 0.34, 0.42, 0.72, wood, dark, goldDim);
    b.post((x0 + x1) / 2, 0.34, 0.07, 0.05, 0.72, 0.8, 6, goldDim, gold);
  }
  // a step under it
  b.box(-hw - 0.12, backZ - 0.14, hw + 0.12, 0.48, 0, 0.06, STONE_DARK, STONE_DARK, STONE);
  return b;
}

/** A box of earth and what grows in it. */
function bloomsIn(b: Build, x0: number, z0: number, x1: number, z1: number, y: number, seed: number, colors: readonly string[]): void {
  const n = 9;
  for (let i = 0; i < n; i++) {
    const x = x0 + hash2(i, seed, 11) * (x1 - x0);
    const z = z0 + hash2(i, seed, 13) * (z1 - z0);
    b.post(x, z, 0.05, 0.015, y, y + 0.14, 4, mul(LEAF, 0.72), LEAF);
    if (i % 3 !== 2) {
      const c = rgb(colors[i % colors.length]!);
      b.post(x, z, 0.055, 0.03, y + 0.12, y + 0.17, 5, mul(c, 0.86), c);
    }
  }
}

function planter(): Build {
  const b = new Build();
  b.box(-0.42, -0.3, 0.42, 0.3, 0, 0.24, WOOD, WOOD_DARK, WOOD_DARK);
  for (const y of [0.08, 0.16]) b.faceS(-0.42, 0.42, 0.302, y, y + 0.012, WOOD_DARK);
  b.flat(-0.37, -0.25, 0.37, 0.25, 0.245, rgb('#3a2c20'));
  bloomsIn(b, -0.32, -0.2, 0.32, 0.22, 0.24, 7, ['#e8607a', '#f0d060', '#f4f0e0']);
  return b;
}

function flowerbed(): Build {
  const b = new Build();
  b.box(-0.5, -0.38, 0.5, 0.38, 0, 0.1, STONE_DARK, STONE_DARK, STONE);
  b.flat(-0.44, -0.32, 0.44, 0.32, 0.105, rgb('#3a2c20'));
  bloomsIn(b, -0.4, -0.27, 0.4, 0.28, 0.1, 13, ['#d870c0', '#f0a040', '#f4f0e0', '#e85a60']);
  return b;
}

/** One of the columns down a great hall: a plinth, a shaft with bands of worked stone, a capital flaring to carry the roof. */
function greatColumn(): Build {
  const b = new Build();
  const c = rgb('#b4b0ac');
  const dim = mul(c, 0.6);
  const hi = mul(c, 1.14);
  b.box(-0.66, -0.66, 0.66, 0.66, 0, 0.24, mul(c, 0.72), dim, c);
  b.post(0, 0, 0.58, 0.46, 0.24, 0.46, 8, dim, c, 0, 0, Math.PI / 8);
  b.post(0, 0, 0.42, 0.37, 0.46, 3.74, 8, mul(c, 0.66), c, 0, 0, Math.PI / 8);
  for (const y of [1.4, 2.6]) b.post(0, 0, 0.44, 0.43, y, y + 0.12, 8, dim, hi, 0, 0, Math.PI / 8);
  b.post(0, 0, 0.37, 0.6, 3.74, 4.12, 8, dim, hi, 0, 0, Math.PI / 8);
  b.box(-0.68, -0.68, 0.68, 0.68, 4.12, 4.32, c, dim, hi);
  return b;
}

/** A scarecrow: a pole and a crossbar, an old blue coat on them, a sack for a head and a hat gone to ruin. */
function scarecrow(): Build {
  const b = new Build();
  const coat = rgb('#566a84');
  const coatDim = rgb('#3a485c');
  const sack = rgb('#c8b080');
  const straw = rgb('#d8bc60');
  b.post(0, 0, 0.04, 0.035, 0, 1.3, 5, WOOD_DARK, WOOD);
  b.box(-0.56, -0.03, 0.56, 0.03, 0.96, 1.02, WOOD_DARK, WOOD_DARK, WOOD);
  b.post(0, 0, 0.14, 0.21, 0.42, 1.02, 7, coatDim, coat);
  for (const side of [-1, 1] as const) {
    b.box(side < 0 ? -0.52 : 0.14, -0.08, side < 0 ? -0.14 : 0.52, 0.08, 0.88, 1.04, coatDim, coatDim, coat);
    b.post(side * 0.55, 0, 0.03, 0.05, 0.84, 0.94, 5, straw, straw);
  }
  b.post(0, 0, 0.15, 0.16, 1.08, 1.24, 8, mul(sack, 0.82), sack);
  b.post(0, 0, 0.26, 0.11, 1.24, 1.29, 8, rgb('#4a3e30'), rgb('#6a5a44'));
  b.post(0, 0, 0.11, 0.06, 1.29, 1.46, 7, rgb('#4a3e30'), rgb('#6a5a44'));
  return b;
}

const BUILDERS: Record<string, () => Build> = {
  built_lamp: lamp,
  built_lantern: lantern,
  built_torch: () => poleTorch(WOOD, WOOD_DARK),
  built_iron_torch: () => poleTorch(IRON, IRON_DARK),
  built_sacks: sacks,
  built_basket: basket,
  built_woodpile: woodpile,
  built_log: log,
  built_well: well,
  built_fountain: fountain,
  built_armor_stand: armorStand,
  built_bedroll: bedroll,
  built_flag_red: () => standard(rgb('#a02a2c'), rgb('#d8ac4e'), rgb('#e8d8a8')),
  built_flag_blue: () => standard(rgb('#2a5a98'), rgb('#d8ac4e'), rgb('#e8e0c8')),
  built_skull_banner: skullStandard,
  built_cage: cage,
  built_eggs: eggs,
  built_throne: throne,
  built_planter: planter,
  built_flowerbed: flowerbed,
  built_scarecrow: scarecrow,
  built_great_column: greatColumn,
};

const made = new Map<string, MeshData>();

/** One of the above, as a model the land can place like any other; null if it isn't one of ours. */
export function builtProp(id: string): MeshData | null {
  const have = made.get(id);
  if (have) return have;
  const make = BUILDERS[id];
  if (!make) return null;
  const data = make().m.data();
  made.set(id, data);
  return data;
}
