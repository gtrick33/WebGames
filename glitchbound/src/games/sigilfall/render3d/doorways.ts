import { hash2 } from '../core/math';
import type { ThemeLook } from '../data/themes';
import { stoneGate } from './gateways';
import { Build, mul, type C } from './build';
import { hexRgb } from './kits';
import type { Mesher } from './land';

/**
 * How a dungeon meets the land above it, built of plain shapes because no pack has one you could believe: a hole in a
 * hill with real dark in it, a stair going down into the ground, a sewer's outfall under a wall. Each is in tiles, with
 * the door's own tile at the origin (the tile you step on to go in): it stands north of that tile, facing the camera.
 * Standing on the land's top layer, it can't really go below the ground, so what goes down is drawn going dark.
 */

type V = [number, number, number];

const rgb = hexRgb;

/** A face of four corners, wound so it looks toward `out` (only the faces looking at the camera get drawn). */
function facet(m: Mesher, a: V, b: V, c: V, d: V, out: V, ca: C, cb: C = ca): void {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = d[0] - a[0];
  const vy = d[1] - a[1];
  const vz = d[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;
  if (nx * out[0] + ny * out[1] + nz * out[2] >= 0) m.quad(a, b, c, d, [nx, ny, nz], ca, cb);
  else m.quad(b, a, d, c, [-nx, -ny, -nz], ca, cb);
}

/* ------------------------------------------------------------------ a hole in a hill */

export interface CaveLook {
  /** Its rock: where the light falls on top, its faces, and its foot. */
  top: string;
  face: string;
  foot: string;
  /** The lip round the hole, catching the light. */
  lip: string;
  /** The dark of the hole, just inside. */
  throat: string;
  /** What hangs from the top of the hole. */
  teeth: string;
  /** How broad and high the hole is (tiles). */
  wide: number;
  high: number;
  seed: number;
}

/** A jagged hill with a mouth in its south side, going back into the dark. */
export function caveMouth(look: CaveLook): Build {
  const b = new Build();
  const m = b.m;
  const N = 11;
  const zf = -0.5;
  const top = rgb(look.top);
  const face = rgb(look.face);
  const foot = rgb(look.foot);
  const lip = rgb(look.lip);
  const throat = rgb(look.throat);
  const teeth = rgb(look.teeth);
  const black: C = [0.012, 0.01, 0.016];
  const noise = (i: number, r: number, k: number): number => hash2(i * 7 + look.seed, r * 13 + look.seed, k) - 0.5;
  const a0 = look.wide / 2;
  const b0 = look.high;
  /** The hill's outline bulges and dips the same way all the way up, so it has shoulders and not a clean curve. */
  const shoulder = (i: number): number => 1 + noise(i >> 1, 40, 9) * 0.44 + noise(i, 41, 9) * 0.22;
  /** One band of the hill: a half-ring round the hole, its feet on the ground, out of step with the band inside it. */
  const ring = (r: number, a: number, h: number, z: number, lean: number, rough: number, step: number): V[] => {
    const out: V[] = [];
    for (let i = 0; i <= N; i++) {
      // (the ends stay at the ends; in between, each band's joints fall where the last band's didn't)
      const at = i === 0 || i === N ? i : i + step * (i % 2 ? 1 : -1);
      const t = (at / N) * Math.PI;
      const s = Math.sin(t);
      const k = r ? shoulder(i) : 1;
      // (the feet stay on the ground; the rest of it is as broken as a hill is)
      const jx = noise(i, r, 3) * rough * 2;
      const jy = i === 0 || i === N ? 0 : noise(i, r, 5) * rough * 2 * s;
      const jz = noise(i, r, 7) * rough * 1.6;
      out.push([Math.cos(t) * a * (r ? 1 + (k - 1) * 0.5 : 1) + jx, Math.max(0, s * h * k + jy), z - lean * s + jz]);
    }
    return out;
  };
  const rim = ring(0, a0, b0, zf, 0, 0.05, 0);
  const bands: V[][] = [rim, ring(1, a0 + 0.42, b0 + 0.46, zf + 0.1, 0.12, 0.1, 0), ring(2, a0 + 1.4, b0 + 1.1, zf - 0.28, 0.5, 0.26, 0.28), ring(3, a0 + 2.25, b0 + 1.3, zf - 0.8, 1.1, 0.36, -0.22), ring(4, a0 + 2.75, 0.02, zf - 0.6, 3.1, 0.2, 0.2)];
  for (let r = 0; r + 1 < bands.length; r++) {
    const inner = bands[r]!;
    const outer = bands[r + 1]!;
    for (let i = 0; i < N; i++) {
      const p = inner[i]!;
      const q = inner[i + 1]!;
      const u = outer[i + 1]!;
      const v = outer[i]!;
      // (facing the sky it takes the light; facing the camera it's the rock's own face; each facet its own shade)
      const ux = q[0] - p[0];
      const uy = q[1] - p[1];
      const uz = q[2] - p[2];
      const vx = v[0] - p[0];
      const vy = v[1] - p[1];
      const vz = v[2] - p[2];
      let ny = uz * vx - ux * vz;
      const nx = uy * vz - uz * vy;
      const nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      ny = Math.abs(ny) / len;
      const k = 0.9 + hash2(i + look.seed, r, 11) * 0.22;
      const lit: number[] = [0, 1, 2].map((c) => (face[c]! + (top[c]! - face[c]!) * ny) * k);
      const low = (p[1] + q[1] + u[1] + v[1]) / 4 < 0.9;
      const shade = r === 0 ? lip : low ? mul(lit, 0.82) : lit;
      const under = r === 0 ? mul(lip, 0.8) : low ? foot : lit;
      facet(m, p, q, u, v, [0, 1, 0.75], under, shade);
    }
  }
  // down into the dark: the walls of the hole, and the back of it
  const deep = 1.5;
  const back: V[] = rim.map((p) => [p[0] * 0.72, p[1] * 0.74, zf - deep]);
  for (let i = 0; i < N; i++) {
    const p = rim[i]!;
    const q = rim[i + 1]!;
    const midX = (p[0] + q[0]) / 2;
    const midY = (p[1] + q[1]) / 2;
    facet(m, p, q, back[i + 1]!, back[i]!, [-midX, -midY + 0.4, 0.6], throat, black);
    facet(m, [0, b0 * 0.3, zf - deep], back[i]!, back[i + 1]!, back[i + 1]!, [0, 0, 1], black);
  }
  // the floor going down: from the land's own light to nothing
  facet(m, [-a0, 0.03, zf + 0.06], [a0, 0.03, zf + 0.06], [a0 * 0.72, 0.03, zf - deep], [-a0 * 0.72, 0.03, zf - deep], [0, 1, 0], mul(throat, 1.3), black);
  // what hangs from the top of the hole, broken and uneven
  for (let i = 1; i < N; i++) {
    const c = rim[i]!;
    if (c[1] < b0 * 0.5 || (i + look.seed) % 3 === 2) continue;
    const w = 0.12 + hash2(i, look.seed, 21) * 0.12;
    const long = 0.26 + hash2(i, look.seed, 23) * 0.42;
    const z = zf + 0.02;
    const tip: V = [c[0] + (hash2(i, look.seed, 25) - 0.5) * 0.08, c[1] - long, z - 0.04];
    const dim = mul(teeth, 0.62);
    facet(m, [c[0] - w, c[1] + 0.04, z], [c[0] + w, c[1] + 0.04, z], tip, tip, [0, 0, 1], teeth, dim);
  }
  return b;
}

/* ------------------------------------------------------------------ a stair going down */

export interface StairLook {
  stone: string;
  cap: string;
  /** How far back it goes (tiles). */
  deep: number;
  seed: number;
}

/** A stair cut down into the ground between two low walls, a slab of a doorway at the foot of it. */
export function cryptStair(look: StairLook): Build {
  const b = new Build();
  const stone = rgb(look.stone);
  const cap = rgb(look.cap);
  const dark = mul(stone, 0.34);
  const black: C = [0.012, 0.01, 0.016];
  const z0 = -0.46;
  const z1 = z0 - look.deep;
  const hw = 1.12;
  const wall = 0.34;
  // the treads: each a step further from the light, its lip catching what's left of it
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const fall = 1 - t0 * 0.96;
    const za = z0 + (z1 - z0) * t0;
    const zb = z0 + (z1 - z0) * t1;
    const tread = mul(stone, 0.62 * fall * fall);
    b.flat(-hw, zb, hw, za, 0.03, tread);
    b.flat(-hw, za - 0.07, hw, za, 0.034, mul(stone, 1.02 * fall * fall));
  }
  // the walls down either side, rising as the stair falls
  const rand = (i: number): number => hash2(i, look.seed, 31);
  for (const side of [-1, 1] as const) {
    const x0 = side < 0 ? -hw - wall : hw;
    const x1 = side < 0 ? -hw : hw + wall;
    const parts = 3;
    for (let i = 0; i < parts; i++) {
      const za = z0 + ((z1 - z0) * i) / parts;
      const zb = z0 + ((z1 - z0) * (i + 1)) / parts;
      const h = 0.46 + (0.6 * (i + 1)) / parts;
      const k = 0.94 + rand(i + side) * 0.12;
      b.box(x0, zb, x1, za, 0, h, mul(stone, 0.86 * k), mul(stone, 0.62 * k), mul(cap, k));
      // (its inner face going dark toward the bottom of the stair)
      if (side < 0) b.faceE(zb, za, x1 + 0.004, 0, h, mul(dark, 1 - 0.7 * ((i + 1) / parts)), mul(stone, 0.72));
      else b.faceW(zb, za, x0 - 0.004, 0, h, mul(dark, 1 - 0.7 * ((i + 1) / parts)), mul(stone, 0.72));
    }
    // a post at the head of the stair, and the fire on it (land.ts lights it)
    const px = (x0 + x1) / 2;
    b.box(px - 0.24, z0 - 0.26, px + 0.24, z0 + 0.22, 0, 0.92, mul(stone, 0.92), mul(stone, 0.64), cap);
    b.box(px - 0.3, z0 - 0.32, px + 0.3, z0 + 0.28, 0.92, 1.04, mul(cap, 0.86), mul(cap, 0.74), cap);
  }
  // the slab at the foot of it: a wall with a dark door, a pitched head over it
  const zb = z1;
  const across = hw + wall + 0.12;
  const hh = 1.42;
  b.box(-across, zb - 0.42, across, zb, 0, hh, mul(stone, 0.9), mul(stone, 0.6), cap);
  b.faceS(-0.78, 0.78, zb + 0.012, 0, 1.08, mul(black, 1), mul(dark, 0.42));
  // (its frame, and the lintel across it)
  b.faceS(-0.94, -0.78, zb + 0.016, 0, 1.2, mul(stone, 0.72), mul(stone, 1.04));
  b.faceS(0.78, 0.94, zb + 0.016, 0, 1.2, mul(stone, 0.72), mul(stone, 1.04));
  b.faceS(-1.0, 1.0, zb + 0.02, 1.08, 1.28, mul(stone, 0.9), mul(cap, 1));
  const m = b.m;
  const peak = 2.06;
  m.quad([-across, hh, zb], [across, hh, zb], [0, peak, zb - 0.1], [0, peak, zb - 0.1], [0, 0.2, 0.98], mul(stone, 0.92), mul(cap, 0.98));
  m.quad([-across, hh, zb], [0, peak, zb - 0.1], [0, peak, zb - 0.42], [-across, hh, zb - 0.42], [-0.62, 0.78, 0], cap, mul(cap, 1.1));
  m.quad([0, peak, zb - 0.1], [across, hh, zb], [across, hh, zb - 0.42], [0, peak, zb - 0.42], [0.62, 0.78, 0], mul(cap, 1.1), cap);
  return b;
}

/* ------------------------------------------------------------------ a sewer's outfall */

/** Where a city's filth comes out: an arch in a wall of old brick, its grate half raised, the sludge running out of it. */
export function culvert(): Build {
  const b = new Build();
  const m = b.m;
  const brick: C[] = [rgb('#6a6258'), rgb('#5c5650'), rgb('#726a5e'), rgb('#544e48')];
  const joint = rgb('#2a2622');
  const cap = rgb('#8a8272');
  const moss = rgb('#4e6a34');
  const black: C = [0.012, 0.012, 0.012];
  const sludge = rgb('#6c9a2e');
  const sludge2 = rgb('#8ab83e');
  let seed = 11;
  const rand = (): number => hash2(seed++, 3, 41);
  const zf = -0.5;
  const back = zf - 0.9;
  const hw = 2.7;
  const h = 1.9;
  // the wall: its top and its ends, sloping down into the bank at either side
  b.flat(-hw, back, hw, zf, h, cap);
  for (let x = -hw; x < hw - 0.01; x += 0.7) b.flat(x + 0.04, zf - 0.22, x + 0.62, zf + 0.02, h + 0.012, mul(cap, 0.92 + rand() * 0.16));
  for (const side of [-1, 1] as const) {
    const x0 = side * hw;
    const x1 = side * (hw + 0.9);
    m.quad([x0, 0, zf], [x1, 0, zf], [x0, h, zf], [x0, h, zf], [0, 0, 1], mul(brick[0]!, 0.7), brick[1]!);
    facet(m, [x0, h, zf], [x1, 0, zf], [x1, 0, back], [x0, h, back], [side, 0.7, 0], mul(cap, 0.9), mul(cap, 0.74));
  }
  // (courses of brick, either side of the arch and over it)
  const aw = 1.14;
  const ah = 1.46;
  b.courses('s', -hw, -aw, zf, 0, h, 0.22, 0.46, brick, joint, rand);
  b.courses('s', aw, hw, zf, 0, h, 0.22, 0.46, brick, joint, rand);
  b.courses('s', -aw, aw, zf, ah, h, 0.22, 0.46, brick, joint, rand);
  // moss growing down from the top
  for (let i = 0; i < 9; i++) {
    const x = -hw + 0.3 + rand() * (hw * 2 - 0.6);
    const w = 0.12 + rand() * 0.22;
    const l = 0.12 + rand() * 0.36;
    if (Math.abs(x) < aw + 0.2) continue;
    b.faceS(x - w, x + w, zf + 0.02, h - l, h + 0.005, mul(moss, 0.7), moss);
  }
  // the arch: a ring of cut stone, and the dark behind it
  const N = 10;
  for (let i = 0; i < N; i++) {
    const t0 = (i / N) * Math.PI;
    const t1 = ((i + 1) / N) * Math.PI;
    const p = (a: number, t: number, z: number): V => [Math.cos(t) * a, Math.sin(t) * (a === aw ? ah : ah + 0.22), z];
    const c = i % 2 ? mul(cap, 0.86) : mul(cap, 1.02);
    m.quad(p(aw, t0, zf + 0.03), p(aw + 0.22, t0, zf + 0.03), p(aw + 0.22, t1, zf + 0.03), p(aw, t1, zf + 0.03), [0, 0, 1], c);
    // (the hole itself: dark that gets darker)
    m.quad([0, 0, zf + 0.012], p(aw, t0, zf + 0.012), p(aw, t1, zf + 0.012), p(aw, t1, zf + 0.012), [0, 0, 1], black, mul(sludge, 0.1));
  }
  // the grate, raised as far as it goes and rusted there
  const iron = rgb('#3a3634');
  const rust = rgb('#6a4a34');
  for (let x = -0.9; x <= 0.91; x += 0.3) {
    const roof = Math.sqrt(Math.max(0, 1 - (x / aw) ** 2)) * ah;
    b.post(x, zf + 0.06, 0.035, 0.035, 0.74, roof, 4, iron, rust);
    b.post(x, zf + 0.06, 0.05, 0.002, 0.62, 0.74, 4, iron, iron);
  }
  for (const y of [0.92, 1.2]) b.faceS(-0.98, 0.98, zf + 0.09, y, y + 0.06, rust, iron);
  // the sludge, out of the hole and away south down the bank
  const lane = (x0: number, x1: number, z0: number, z1: number, y: number, c0: C, c1: C): void => {
    m.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], c0, c1);
  };
  lane(-0.76, 0.76, zf + 0.04, -0.1, 0.04, mul(sludge, 0.82), mul(sludge, 0.3));
  lane(-0.86, 0.72, -0.1, 0.34, 0.04, mul(sludge, 0.9), mul(sludge, 0.82));
  lane(-0.7, 0.54, 0.34, 0.76, 0.04, mul(sludge, 0.82), mul(sludge, 0.9));
  lane(-0.42, 0.26, 0.76, 1.06, 0.04, mul(sludge, 0.62), mul(sludge, 0.82));
  for (const [x, z, w] of [[-0.3, 0.1, 0.2], [0.22, 0.42, 0.14], [-0.1, 0.64, 0.12], [0.34, -0.2, 0.12]] as const) lane(x - w, x + w, z - w * 0.5, z + w * 0.5, 0.046, sludge2, sludge2);
  return b;
}

/* ------------------------------------------------------------------ a tear in the air */

/** What's in an arch that goes nowhere you could walk to: dark in the middle, burning round the edge. */
export function tear(color: string, a: number, h: number, zf: number): Build {
  const b = new Build();
  const m = b.m;
  const edge = rgb(color);
  const core: C = [0.05, 0.02, 0.09];
  const N = 12;
  const p = (k: number, t: number): V => [Math.cos(t) * a * k, Math.sin(t) * h * k + (t === 0 || t === Math.PI ? 0 : 0), zf];
  for (let i = 0; i < N; i++) {
    const t0 = (i / N) * Math.PI;
    const t1 = ((i + 1) / N) * Math.PI;
    m.quad(p(0.74, t0), p(1, t0), p(1, t1), p(0.74, t1), [0, 0, 1], mul(edge, 0.42), edge);
    m.quad([0, h * 0.28, zf], p(0.74, t0), p(0.74, t1), p(0.74, t1), [0, 0, 1], core, mul(edge, 0.42));
  }
  // (and the ground under it, stained with the light)
  m.quad([-a, 0.03, zf + 0.42], [a, 0.03, zf + 0.42], [a, 0.03, zf], [-a, 0.03, zf], [0, 1, 0], mul(edge, 0.12), mul(edge, 0.3));
  return b;
}

/* ------------------------------------------------------------------ a king's barrow */

export interface MoundLook {
  /** Its turf: in shade at its foot, on its sides, in the light on top. */
  turf: readonly [string, string, string];
  stone: string;
  /** The light in its door. */
  light: string;
  seed: number;
}

/**
 * A king's barrow: a great round mound of turf with its door in a front of dressed stone let into its south side,
 * wing walls stepping down from it to hold the earth back, and kerbstones round its foot. The door is the dark between
 * two leaning jambs under one great lintel, as the old tombs are; a door standing by itself in a field is not a tomb.
 */
export function barrow(look: MoundLook): Build {
  const b = new Build();
  const dark = rgb(look.turf[0]);
  const mid = rgb(look.turf[1]);
  const lit = rgb(look.turf[2]);
  const stone = rgb(look.stone);
  const stoneDark = mul(stone, 0.6);
  const cz = -3.0;
  const R = 3.7;
  // the mound, in bands from its foot to its crown
  const bands: readonly (readonly [number, number])[] = [[R, 0], [R * 0.95, 0.55], [R * 0.82, 1.3], [R * 0.6, 2.1], [R * 0.32, 2.65], [0.02, 2.9]];
  for (let i = 0; i + 1 < bands.length; i++) {
    const [r0, y0] = bands[i]!;
    const [r1, y1] = bands[i + 1]!;
    const t = i / (bands.length - 2);
    const c0 = [0, 1, 2].map((c) => dark[c]! + (lit[c]! - dark[c]!) * t * 0.9);
    const c1 = [0, 1, 2].map((c) => mid[c]! + (lit[c]! - mid[c]!) * Math.min(1, t * 1.2));
    b.post(0, cz, r0, r1, y0, y1, 16, c0, c1, 0, 0, Math.PI / 16);
  }
  // the stone front: a wall let into the slope, the doorway in it
  b.box(-2.0, -1.5, 2.0, -0.42, 0, 2.75, stone, stoneDark, mul(stone, 0.7));
  for (const y of [0.9, 1.8]) b.faceS(-2.0, 2.0, -0.415, y, y + 0.07, stoneDark);
  const black: C = [0.016, 0.014, 0.024];
  b.faceS(-0.8, 0.8, -0.41, 0, 2.0, black, mul(rgb(look.light), 0.2));
  // its jambs, leaning in, and the lintel across them
  for (const s of [-1, 1] as const) b.post(s * 0.98, -0.3, 0.2, 0.17, 0, 2.05, 4, stoneDark, stone, s * -0.1, 0, Math.PI / 4);
  b.box(-1.35, -0.52, 1.35, -0.1, 2.05, 2.5, mul(stone, 1.08), stoneDark, mul(stone, 0.8));
  // wing walls stepping down each side
  for (const s of [-1, 1] as const) {
    for (let i = 0; i < 3; i++) {
      const x0 = 2.0 + i * 0.75;
      const h = 2.0 - i * 0.62;
      b.box(s < 0 ? -x0 - 0.75 : x0, -1.3 + i * 0.12, s < 0 ? -x0 : x0 + 0.75, -0.5 + i * 0.12, 0, h, stone, stoneDark, mul(stone, 0.72));
    }
  }
  // kerbstones round its foot (not across its front)
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.2;
    const x = Math.cos(a) * (R + 0.2);
    const z = cz + Math.sin(a) * (R + 0.2);
    if (z > -1.6 && Math.abs(x) < 4.6) continue;
    const h = 0.55 + hash2(i, look.seed, 5) * 0.5;
    b.post(x, z, 0.24, 0.16, 0, h, 5, stoneDark, stone, (hash2(i, look.seed, 7) - 0.5) * 0.12, 0, hash2(i, look.seed, 9) * 3);
  }
  return b;
}

/* ------------------------------------------------------------------ a tomb's pylon */

export interface PylonLook {
  /** Its sandstone, in the light and in shade, and the lighter stone of its arch and columns. */
  stone: string;
  shade: string;
  trim: string;
  /** The disc over the door. */
  sun: string;
}

/**
 * Where the pylon stands: its front a little proud of the face of the plinth behind it (the Sun King's, its front on the
 * door tile's north edge, as the ground it can't be walked on is), and the dark of its doorway between the two.
 */
export const PYLON = { front: -0.42, dark: -0.47, half: 1.0, spring: 1.75, high: 4.0 };

/**
 * A sun king's tomb: a pylon of sandstone, wider at its foot than at its cornice, a round-arched doorway in it at the
 * ground with the dark in it and the portcullis drawn up into the arch, its teeth showing; a column either side of the
 * door and the sun's disc over it. The arch, the opening and the gate are one built thing, so they can't stand apart.
 * It was the pack's arch with its gate, set into the face of the plinth the colossus sits on: the plinth stood a tile
 * in front of it, so the arch showed only above the plinth's top, high up the wall, and its gate as a row of bars at the
 * foot of a solid wall (the owner: "check the entrance of the tomb of the sun king dungeon ... this needs to be fixed").
 */
export function pylon(look: PylonLook): Build {
  const b = new Build();
  const m = b.m;
  const stone = rgb(look.stone);
  const shade = rgb(look.shade);
  const trim = rgb(look.trim);
  const sun = rgb(look.sun);
  const black: C = [0.02, 0.016, 0.026];
  const { front: zf, dark: zd, half, spring, high } = PYLON;
  const zb = -1.5;
  const crown = spring + half;
  const n: V = [0, 0, 1];
  // the pylon's outline: battered, wide at the foot and narrower under its cornice
  const foot = 3.7;
  const top = 3.2;
  // its front round the doorway: a pier either side, and the stone over the arch in strips down to its curve
  for (const s of [-1, 1] as const) facet(m, [s * foot, 0, zf], [s * half, 0, zf], [s * half, high, zf], [s * top, high, zf], n, mul(stone, 0.9), stone);
  const N = 10;
  const arch = (i: number, r: number): [number, number] => {
    const t = Math.PI - (i / N) * Math.PI;
    return [Math.cos(t) * r, spring + Math.sin(t) * r];
  };
  for (let i = 0; i < N; i++) {
    const [x0, y0] = arch(i, half);
    const [x1, y1] = arch(i + 1, half);
    facet(m, [x0, y0, zf], [x1, y1, zf], [x1, high, zf], [x0, high, zf], n, stone);
  }
  // its battered ends, going back into the plinth
  for (const s of [-1, 1] as const) {
    const len = Math.hypot(high, foot - top);
    facet(m, [s * foot, 0, zf], [s * foot, 0, zb], [s * top, high, zb], [s * top, high, zf], [(s * high) / len, (foot - top) / len, 0], mul(shade, 0.9), shade);
  }
  // the doorway: its jambs and the arch's underside going in, and the dark, darkest at the foot
  for (const s of [-1, 1] as const) {
    if (s < 0) b.faceE(zd, zf, -half, 0, spring, mul(shade, 0.5), mul(shade, 0.8));
    else b.faceW(zd, zf, half, 0, spring, mul(shade, 0.5), mul(shade, 0.8));
  }
  for (let i = 0; i < N; i++) {
    const [x0, y0] = arch(i, half);
    const [x1, y1] = arch(i + 1, half);
    facet(m, [x0, y0, zf], [x1, y1, zf], [x1, y1, zd], [x0, y0, zd], [-(x0 + x1) / 2, spring - (y0 + y1) / 2, 0], mul(shade, 0.7));
  }
  facet(m, [-half, 0, zd], [half, 0, zd], [half, spring, zd], [-half, spring, zd], n, black, mul(shade, 0.16));
  for (let i = 0; i < N; i++) {
    const [x0, y0] = arch(i, half);
    const [x1, y1] = arch(i + 1, half);
    facet(m, [0, spring, zd], [x0, y0, zd], [x1, y1, zd], [x1, y1, zd], n, mul(shade, 0.16), mul(shade, 0.12));
  }
  // (the threshold, in the doorway's shadow: the sand going dark toward the door, so the way in reads as going in)
  m.quad([-half, 0.02, zf + 0.42], [half, 0.02, zf + 0.42], [half, 0.02, zd], [-half, 0.02, zd], [0, 1, 0], mul(shade, 0.62), mul(black, 1));
  // the arch: a ring of lighter cut stone proud of the face, on jambs of the same down to the ground
  const ring = 0.3;
  const out = 0.08;
  for (let i = 0; i < N; i++) {
    const [x0, y0] = arch(i, half);
    const [x1, y1] = arch(i + 1, half);
    const [u0, v0] = arch(i, half + ring);
    const [u1, v1] = arch(i + 1, half + ring);
    facet(m, [x0, y0, zf + out], [u0, v0, zf + out], [u1, v1, zf + out], [x1, y1, zf + out], n, i % 2 ? mul(trim, 0.9) : trim);
    // (its lip, out from the face, and its inside down to the face)
    facet(m, [u0, v0, zf], [u1, v1, zf], [u1, v1, zf + out], [u0, v0, zf + out], [(u0 + u1) / 2, (v0 + v1) / 2 - spring, 0], mul(trim, 0.8));
    facet(m, [x0, y0, zf], [x1, y1, zf], [x1, y1, zf + out], [x0, y0, zf + out], [-(x0 + x1) / 2, spring - (y0 + y1) / 2, 0], mul(trim, 0.7));
  }
  for (const s of [-1, 1] as const) b.box(s < 0 ? -half - ring : half, zf, s < 0 ? -half : half + ring, zf + out, 0, spring, trim, mul(trim, 0.78), trim);
  // a keystone at its crown, and the sun's disc over it in gold
  b.box(-0.17, zf, 0.17, zf + out + 0.03, crown - 0.04, crown + ring + 0.06, mul(trim, 1.06), mul(trim, 0.8), mul(trim, 1.1));
  const disc = { y: crown + ring + 0.5, r: 0.3 };
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * Math.PI * 2;
    const a1 = ((i + 1) / 16) * Math.PI * 2;
    const z = zf + 0.04;
    facet(m, [0, disc.y, z], [Math.cos(a0) * disc.r, disc.y + Math.sin(a0) * disc.r, z], [Math.cos(a1) * disc.r, disc.y + Math.sin(a1) * disc.r, z], [Math.cos(a1) * disc.r, disc.y + Math.sin(a1) * disc.r, z], n, mul(sun, 1.1), sun);
  }
  // the portcullis drawn up into the arch, in the doorway: iron bars from its curve down to their teeth, bands across
  const iron: C = [0.17, 0.15, 0.16];
  // (between the dark and the pylon's face, clear of both)
  const gz = zd + 0.025;
  for (let x = -half + 0.18; x <= half - 0.17; x += 0.33) {
    const roof = spring + Math.sqrt(Math.max(0, half * half - x * x)) - 0.03;
    b.post(x, gz, 0.021, 0.021, 1.22, roof, 4, iron, iron, 0, 0, Math.PI / 4);
    b.post(x, gz, 0.024, 0.003, 1.04, 1.22, 4, iron, iron, 0, 0, Math.PI / 4);
  }
  for (const y of [1.42, 2.02]) {
    const up = y + 0.07 - spring;
    const w = up > 0 ? Math.sqrt(half * half - up * up) - 0.04 : half - 0.02;
    b.faceS(-w, w, gz + 0.023, y, y + 0.07, mul(iron, 1.4), iron);
  }
  // a column either side of the door, half out of the face, a capital of the lighter stone on each
  for (const s of [-1, 1] as const) {
    const cx = s * 2.25;
    const cz = zf + 0.12;
    b.box(cx - 0.36, zf + 0.01, cx + 0.36, cz + 0.34, 0, 0.2, mul(trim, 0.86), mul(trim, 0.7), trim);
    b.post(cx, cz, 0.26, 0.22, 0.2, 3.0, 10, mul(stone, 0.92), stone);
    for (const y of [0.9, 1.9]) b.post(cx, cz, 0.275, 0.265, y, y + 0.08, 10, mul(trim, 0.8), trim);
    b.box(cx - 0.38, zf + 0.01, cx + 0.38, cz + 0.36, 3.0, 3.26, mul(trim, 0.95), mul(trim, 0.74), trim);
  }
  // the cornice: a band, and the lip flaring out over it, its underside in shadow
  b.box(-top - 0.12, zb, top + 0.12, zf + 0.12, high, high + 0.14, mul(trim, 0.92), mul(shade, 0.7), trim);
  b.box(-top - 0.28, zb, top + 0.28, zf + 0.3, high + 0.14, high + 0.46, stone, mul(shade, 0.55), mul(stone, 0.86));
  return b;
}

/** A hill with a hole in it, the hole framed in timber: somebody lives in there, and props the roof. */
function timbered(b: Build, wide: number, high: number): Build {
  const wood = rgb('#6e5236');
  const dark = rgb('#40301e');
  const hw = wide / 2;
  for (const s of [-1, 1] as const) b.post(s * (hw - 0.08), -0.32, 0.2, 0.17, 0, high - 0.2, 6, dark, wood, s * -0.06, 0);
  b.box(-hw - 0.3, -0.52, hw + 0.3, -0.14, high - 0.42, high - 0.06, wood, dark, mul(wood, 0.8));
  // (the ends of the roof-beams showing over it)
  for (let x = -hw + 0.3; x <= hw - 0.3; x += 0.62) b.box(x - 0.1, -0.5, x + 0.1, -0.06, high - 0.06, high + 0.12, mul(wood, 0.9), dark, wood);
  return b;
}

/* ------------------------------------------------------------------ which dungeon has which */

export interface Doorway {
  /** Built in the colors of the land it stands in, where it is of that land's own ground. */
  build: (land: ThemeLook) => Build;
  /** Fires by it (east, up, south of the door, in tiles; how strong). */
  flames?: readonly [number, number, number, number][];
  /** A glow in it. */
  glow?: { color: string; x: number; y: number; z: number; size: number };
}

const CAVE = { wide: 2.4, high: 2 };

/** With iron bowls standing either side of it, or at one, for its fires to burn in. */
function withBowls(b: Build, at: readonly [number, number][], k: number): Build {
  for (const [x, z] of at) b.brazier(x, z, 0, k);
  return b;
}

export const DOORWAYS: Record<string, Doorway> = {
  // the dwarves' stolen forge: dressed stone gone black with soot, the fires still burning somewhere under the hill
  'deepforge-halls': {
    build: () => withBowls(caveMouth({ ...CAVE, top: '#8a8690', face: '#5e5a66', foot: '#34323c', lip: '#a09ca4', throat: '#3a1c10', teeth: '#6a6670', seed: 3 }), [[-1.9, 0.25], [1.9, 0.25]], 1.7),
    flames: [[-1.9, 0.8, 0.25, 0.62], [1.9, 0.8, 0.25, 0.62]],
    glow: { color: '#ff8a3a', x: 0, y: 0.5, z: -1.4, size: 22 },
  },
  // a cave in the ice, the vault's cold coming up out of it
  'rimeheld-vault': {
    build: () => caveMouth({ ...CAVE, top: '#eaf6ff', face: '#a8d0ec', foot: '#6a94b8', lip: '#d8f0ff', throat: '#1c4468', teeth: '#e6f6ff', seed: 9 }),
    glow: { color: '#8ad8ff', x: 0, y: 0.5, z: -1.4, size: 22 },
  },
  // where the rot's heart lies: a hollow in sick ground, the blight's light in it
  blightheart: {
    build: () => caveMouth({ ...CAVE, top: '#5e5a44', face: '#3e3a34', foot: '#242226', lip: '#6a6a42', throat: '#23331a', teeth: '#4a4a32', seed: 14 }),
    glow: { color: '#a0e050', x: 0, y: 0.5, z: -1.4, size: 22 },
  },
  // black basalt with the mountain's fire inside
  'molten-throne': {
    build: () => caveMouth({ wide: 2.8, high: 2.4, top: '#4e4240', face: '#2e2626', foot: '#181416', lip: '#7a4a30', throat: '#70200c', teeth: '#2a2222', seed: 21 }),
    glow: { color: '#ff6a22', x: 0, y: 0.6, z: -1.4, size: 30 },
  },
  // the smugglers' sea cave: wet grey rock, a lantern to find it by
  'smugglers-grotto': {
    build: () => withBowls(caveMouth({ ...CAVE, top: '#9aa49c', face: '#6a7674', foot: '#3e4a4c', lip: '#aab4aa', throat: '#10282e', teeth: '#5e6a68', seed: 27 }), [[1.7, 0.35]], 1.4),
    flames: [[1.7, 0.66, 0.35, 0.46]],
    glow: { color: '#60b0b8', x: 0, y: 0.4, z: -1.4, size: 16 },
  },
  // the Kings' Mound: turf of the barrow-land's own grey grass, the old kings' cold light in its door
  'barrow-of-kings': {
    build: (land) => withBowls(barrow({ turf: [land.ground.grass[0], land.ground.grass[2], land.ground.grass[4]], stone: '#8c869c', light: '#8ab4ff', seed: 4 }), [[-1.7, 0.3], [1.7, 0.3]], 1.5),
    flames: [[-1.7, 0.72, 0.3, 0.5], [1.7, 0.72, 0.3, 0.5]],
    glow: { color: '#8ab4ff', x: 0, y: 1.0, z: -0.5, size: 20 },
  },
  // the Gallows Gang's hold: a hole dug into a green hill and propped with stolen timber, fires at its mouth
  'gallows-keep': {
    build: (land) => withBowls(timbered(caveMouth({ wide: 3.0, high: 2.5, top: land.ground.grass[3], face: land.ground.grass[1], foot: '#4a3e2c', lip: '#7a6a4c', throat: '#1c1408', teeth: '#5a4c36', seed: 31 }), 3.0, 2.5), [[-2.3, 0.35], [2.3, 0.35]], 1.6),
    flames: [[-2.3, 0.76, 0.35, 0.58], [2.3, 0.76, 0.35, 0.58]],
    glow: { color: '#ffb466', x: 0, y: 0.6, z: -1.4, size: 22 },
  },
  // the Sun King's tomb: a pylon of the sandstone the colossus is cut from, set against the foot of the plinth he sits
  // on, its fires burning in bowls before it
  'tomb-of-the-sun-king': {
    build: () => withBowls(pylon({ stone: '#d2b27c', shade: '#a8885a', trim: '#ead2a0', sun: '#ffd060' }), [[-3.15, 0.22], [3.15, 0.22]], 1.6),
    flames: [[-3.15, 0.76, 0.22, 0.58], [3.15, 0.76, 0.22, 0.58]],
    glow: { color: '#ffc870', x: 0, y: 1.0, z: -0.3, size: 18 },
  },
  // Highwall's sally port: a gatehouse of the fortress's own stone with a length of its wall either side, the way in
  // under its arch
  'siege-of-highwall': {
    build: () => {
      const g = stoneGate({ span: 2.4, body: '#8a8078', trim: '#b8a888', light: '#c8442c', seed: 7, wings: 5, shut: true, ends: true }).b;
      // (it stands north of the door's tile, its arch over the step)
      for (let i = 2; i < g.m.pos.length; i += 3) g.m.pos[i] = g.m.pos[i]! - 1.0;
      return g;
    },
    flames: [[-2.3, 6.15, -1.0, 1.15], [2.3, 6.15, -1.0, 1.15]],
    glow: { color: '#ffb070', x: 0, y: 1.6, z: -0.6, size: 22 },
  },
  // Duskspire's gate: the citadel's own pale stone, a length of its curtain wall either side, and the dark under its arch
  duskspire: {
    build: () => {
      const g = stoneGate({ span: 2.4, body: '#8a86a0', trim: '#c0c8e0', light: '#8f9cff', seed: 11, wings: 4, shut: true, ends: 'east' }).b;
      for (let i = 2; i < g.m.pos.length; i += 3) g.m.pos[i] = g.m.pos[i]! - 1.0;
      return g;
    },
    flames: [[-2.3, 6.15, -1.0, 1.15], [2.3, 6.15, -1.0, 1.15]],
    glow: { color: '#b4acff', x: 0, y: 1.6, z: -0.6, size: 22 },
  },
  crypt: {
    build: () => cryptStair({ stone: '#8a8680', cap: '#a4a098', deep: 2.3, seed: 2 }),
    flames: [[-1.29, 1.1, -0.46, 0.34], [1.29, 1.1, -0.46, 0.34]],
  },
  // (under the capital, a house behind it: not so far back)
  'crown-catacombs': {
    build: () => cryptStair({ stone: '#8e8a88', cap: '#b0aca4', deep: 1.1, seed: 5 }),
    flames: [[-1.29, 1.1, -0.46, 0.34], [1.29, 1.1, -0.46, 0.34]],
  },
  'rotmother-cistern': {
    build: culvert,
    glow: { color: '#90d040', x: 0, y: 0.3, z: -0.7, size: 16 },
  },
  'spire-of-the-rift': {
    build: () => tear('#b88cff', 1.02, 3.05, -0.72),
    glow: { color: '#c49aff', x: 0, y: 1.4, z: -0.6, size: 26 },
  },
  'vaelmoor-remembered': {
    build: () => tear('#f0e0a8', 1.02, 3.05, -0.72),
    glow: { color: '#ffe9b0', x: 0, y: 1.4, z: -0.6, size: 26 },
  },
};
