import * as THREE from 'three';
import { Build, type C } from './build';
import { hexRgb } from './kits';
import type { MeshData } from './pack';

/**
 * Making things that fit a figure, for mounts and for armor alike: cutting clothes from a model's own skin, and tying
 * built pieces to its joints.
 */

export const rgb = (hex: string): C => hexRgb(hex) as unknown as C;
export const mix = (a: C, b: C, k: number): number[] => [a[0]! + (b[0]! - a[0]!) * k, a[1]! + (b[1]! - a[1]!) * k, a[2]! + (b[2]! - a[2]!) * k];
export const swatchKey = (r: number, g: number, b: number): string => ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
export const keyAt = (m: MeshData, v: number): string => swatchKey(m.col[v * 3]!, m.col[v * 3 + 1]!, m.col[v * 3 + 2]!);

export const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ------------------------------------------------------------------ the surface */

/** A region: above zero is inside it. */
export type Inside = (x: number, y: number, z: number) => number;

export const above = (y0: number): Inside => (_x, y) => y - y0;
export const below = (y1: number): Inside => (_x, y) => y1 - y;
export const between = (z0: number, z1: number): Inside[] => [(_x, _y, z) => z - z0, (_x, _y, z) => z1 - z];
export const within = (w: number): Inside => (x) => w - Math.abs(x);

/** One corner, with all a corner carries: place, normal, smooth normal, skin. */
export type Corner = number[];

export function cornerOf(m: MeshData, v: number): Corner {
  const p = m.pos;
  const n = m.nor;
  const s = m.sn;
  const k = m.skin;
  return [p[v * 3]!, p[v * 3 + 1]!, p[v * 3 + 2]!, n[v * 3]! / 127, n[v * 3 + 1]! / 127, n[v * 3 + 2]! / 127, s[v * 3]! / 127, s[v * 3 + 1]! / 127, s[v * 3 + 2]! / 127, k?.[v * 3] ?? 0, k?.[v * 3 + 1] ?? 0, k?.[v * 3 + 2] ?? 255];
}

function cut(poly: Corner[], f: Inside): Corner[] {
  const out: Corner[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const da = f(a[0]!, a[1]!, a[2]!);
    const db = f(b[0]!, b[1]!, b[2]!);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      const c = a.slice();
      for (let k = 0; k < 9; k++) c[k] = a[k]! + (b[k]! - a[k]!) * t;
      // (a skin can't be halved: the nearer corner's)
      if (t >= 0.5) for (let k = 9; k < 12; k++) c[k] = b[k]!;
      out.push(c);
    }
  }
  return out;
}

export class Part {
  pos: number[] = [];
  nor: number[] = [];
  sn: number[] = [];
  col: number[] = [];
  skin: number[] = [];
  idx: number[] = [];

  corner(c: Corner, color: C, puff = 0): number {
    const v = this.pos.length / 3;
    this.pos.push(c[0]! + c[6]! * puff, c[1]! + c[7]! * puff, c[2]! + c[8]! * puff);
    this.nor.push(c[3]! * 127, c[4]! * 127, c[5]! * 127);
    this.sn.push(c[6]! * 127, c[7]! * 127, c[8]! * 127);
    this.col.push(Math.min(255, color[0]! * 255), Math.min(255, color[1]! * 255), Math.min(255, color[2]! * 255));
    this.skin.push(c[9]!, c[10]!, c[11]!);
    return v;
  }

  data(rig?: string): MeshData {
    const n = this.pos.length / 3;
    const pos = Float32Array.from(this.pos);
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n * 3; i++) {
      const c = i % 3;
      min[c] = Math.min(min[c]!, pos[i]!);
      max[c] = Math.max(max[c]!, pos[i]!);
    }
    return { n, i: this.idx.length, min, max, pos, nor: Int8Array.from(this.nor), sn: Int8Array.from(this.sn), col: Uint8Array.from(this.col), skin: Uint8Array.from(this.skin), idx: Uint16Array.from(this.idx), rig };
  }
}

/** The part of a model's skin inside a region, raised `puff` off it, in one color (or one for each point). */
export function shell(m: MeshData, region: readonly Inside[], puff: number, color: C | ((x: number, y: number, z: number) => C), only?: ReadonlySet<string>): MeshData {
  const out = new Part();
  for (let t = 0; t < m.i; t += 3) {
    const a = m.idx[t]!;
    if (only && !only.has(keyAt(m, a))) continue;
    let poly: Corner[] = [cornerOf(m, a), cornerOf(m, m.idx[t + 1]!), cornerOf(m, m.idx[t + 2]!)];
    for (const f of region) {
      poly = cut(poly, f);
      if (poly.length < 3) break;
    }
    if (poly.length < 3) continue;
    const ids = poly.map((c) => out.corner(c, typeof color === 'function' ? color(c[0]!, c[1]!, c[2]!) : color, puff));
    for (let i = 1; i < ids.length - 1; i++) out.idx.push(ids[0]!, ids[i]!, ids[i + 1]!);
  }
  return out.data(m.rig);
}

/** The other side of what's only a sheet in the file (a mane, a tail), so that it isn't a dark hole from behind. */
export function otherSides(m: MeshData, keys: ReadonlySet<string>): MeshData {
  const out = new Part();
  for (let t = 0; t < m.i; t += 3) {
    const a = m.idx[t]!;
    if (!keys.has(keyAt(m, a))) continue;
    const ids = [m.idx[t]!, m.idx[t + 2]!, m.idx[t + 1]!].map((v) => {
      const c = cornerOf(m, v);
      for (let k = 3; k < 9; k++) c[k] = -c[k]!;
      return out.corner(c, [m.col[v * 3]! / 255, m.col[v * 3 + 1]! / 255, m.col[v * 3 + 2]! / 255]);
    });
    out.idx.push(ids[0]!, ids[1]!, ids[2]!);
  }
  return out.data(m.rig);
}

/** Moves the model's points about (only as far as nobody will notice its joints weren't moved too). */
export function warped(m: MeshData, f: (p: THREE.Vector3) => void): MeshData {
  const pos = new Float32Array(m.pos);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const p = new THREE.Vector3();
  for (let v = 0; v < m.n; v++) {
    p.set(pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!);
    f(p);
    pos[v * 3] = p.x;
    pos[v * 3 + 1] = p.y;
    pos[v * 3 + 2] = p.z;
    for (let c = 0; c < 3; c++) {
      min[c] = Math.min(min[c]!, pos[v * 3 + c]!);
      max[c] = Math.max(max[c]!, pos[v * 3 + c]!);
    }
  }
  return { ...m, pos, min, max };
}

/** The model without the parts of these colors. */
export function withoutParts(m: MeshData, keys: ReadonlySet<string>): MeshData {
  const idx: number[] = [];
  for (let t = 0; t < m.i; t += 3) if (!keys.has(keyAt(m, m.idx[t]!))) idx.push(m.idx[t]!, m.idx[t + 1]!, m.idx[t + 2]!);
  return { ...m, i: idx.length, idx: Uint16Array.from(idx) };
}

/** The colors that cover most of a model: what clothing is cut from. */
export function coatKeysOf(m: MeshData): string[] {
  const counts = new Map<string, number>();
  for (let v = 0; v < m.n; v++) {
    const k = keyAt(m, v);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ? [top] : [];
}

/* ------------------------------------------------------------------ what is built on */

/** What a Build made, moved into the model and tied to a joint (`k`: how big, `at`: where its origin goes). */
export function tied(b: Build, joint: number, k: number, at: readonly [number, number, number], rig?: string): MeshData {
  const d = b.m.data();
  const pos = new Float32Array(d.pos.length);
  const skin = new Uint8Array(d.n * 3);
  for (let v = 0; v < d.n; v++) {
    pos[v * 3] = d.pos[v * 3]! * k + at[0];
    pos[v * 3 + 1] = d.pos[v * 3 + 1]! * k + at[1];
    pos[v * 3 + 2] = d.pos[v * 3 + 2]! * k + at[2];
    skin[v * 3] = joint;
    skin[v * 3 + 1] = joint;
    skin[v * 3 + 2] = 255;
  }
  const lo = (c: 0 | 1 | 2): number => d.min[c] * k + at[c];
  const hi = (c: 0 | 1 | 2): number => d.max[c] * k + at[c];
  return { ...d, pos, skin, rig, min: [lo(0), lo(1), lo(2)], max: [hi(0), hi(1), hi(2)] };
}

const rodY = new THREE.Vector3(0, 1, 0);

/** A tapering rod from one point to another, tied to a joint (a bone, a tusk, a horn). */
export function rod(a: readonly number[], b: readonly number[], ra: number, rb: number, sides: number, ca: C, cb: C, joint: number, rig?: string): MeshData {
  const g = new Build();
  const dir = new THREE.Vector3(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!);
  const len = dir.length();
  g.post(0, 0, ra, rb, 0, len, sides, ca, cb);
  const d = g.m.data();
  const q = new THREE.Quaternion().setFromUnitVectors(rodY, dir.normalize());
  const pos = new Float32Array(d.pos.length);
  const nor = new Int8Array(d.nor.length);
  const skin = new Uint8Array(d.n * 3);
  const v = new THREE.Vector3();
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < d.n; i++) {
    v.set(d.pos[i * 3]!, d.pos[i * 3 + 1]!, d.pos[i * 3 + 2]!).applyQuaternion(q);
    pos[i * 3] = v.x + a[0]!;
    pos[i * 3 + 1] = v.y + a[1]!;
    pos[i * 3 + 2] = v.z + a[2]!;
    for (let c = 0; c < 3; c++) {
      min[c] = Math.min(min[c]!, pos[i * 3 + c]!);
      max[c] = Math.max(max[c]!, pos[i * 3 + c]!);
    }
    v.set(d.nor[i * 3]!, d.nor[i * 3 + 1]!, d.nor[i * 3 + 2]!).applyQuaternion(q);
    nor[i * 3] = v.x;
    nor[i * 3 + 1] = v.y;
    nor[i * 3 + 2] = v.z;
    skin[i * 3] = joint;
    skin[i * 3 + 1] = joint;
    skin[i * 3 + 2] = 255;
  }
  return { ...d, pos, nor, sn: nor, skin, rig, min, max };
}

/** A blade standing on a back, pointing behind (a drake's spine, a boar's bristles). */
export function blade(z: number, y: number, tall: number, long: number, thick: number, c0: C, c1: C, joint: number, rig?: string): MeshData {
  const out = new Part();
  const front = [0, y, z + long * 0.5];
  const back = [0, y, z - long * 0.5];
  const tip = [0, y + tall, z - long * 0.72];
  for (const side of [1, -1]) {
    const flank = [side * thick, y, z];
    const face = (a: number[], b: number[], c: number[]): void => {
      const n = new THREE.Vector3(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!).cross(new THREE.Vector3(c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!)).normalize();
      const c3 = (p: number[]): Corner => [p[0]!, p[1]!, p[2]!, n.x, n.y, n.z, n.x, n.y, n.z, joint, joint, 255];
      const i0 = out.corner(c3(a), c0);
      const i1 = out.corner(c3(b), c0);
      const i2 = out.corner(c3(c), c1);
      out.idx.push(i0, i1, i2);
    };
    if (side > 0) {
      face(front, flank, tip);
      face(flank, back, tip);
    } else {
      face(flank, front, tip);
      face(back, flank, tip);
    }
  }
  return out.data(rig);
}
