import type { MeshData } from './pack';

/**
 * A creature's model, painted part by part and fitted with what it wears, when it loads: a boss is the same model as
 * its soldiers only in its bones. Colors live in the vertices, so a part is found by its color in the file (its hue,
 * how strong, how light) or by the bone it hangs from, and given a new color that keeps its own light and shade; or
 * cut away (a plume); or set alight (a blade, a pair of eyes).
 */
export interface Paint {
  /** The hues it covers, in degrees (wraps: [330, 20] is red). */
  hue?: readonly [number, number];
  /** How strong its color is, 0 to 1. */
  sat?: readonly [number, number];
  /** How light it is, 0 to 1. */
  lum?: readonly [number, number];
  /** Only what hangs from this bone. */
  joint?: string;
  /** Its new color. */
  to?: string;
  /** How much of its own light and shade it keeps (1: all, the default; 0: flat). */
  keep?: number;
  /** Taken off the model. */
  cut?: boolean;
  /** Gives its own light (drawn unshaded, by day and night). */
  glow?: boolean;
}

/** What is built onto a creature, on one of its bones (bossParts below). */
export interface Wear {
  piece: 'ice-crown' | 'eyes' | 'horns' | 'halo';
  /** Its colors: the body of it, and its light. */
  a?: string;
  b?: string;
  /** Bigger or smaller than it would be. */
  size?: number;
  /** Higher or lower on the head, as a share of the head's height. */
  lift?: number;
  /** A crown's band, where it isn't silver. */
  band?: string;
}

const hexOf = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

function hsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, mx ? d / mx : 0, mx / 255];
}

const within = (v: number, r: readonly [number, number] | undefined): boolean => !r || (v >= r[0] && v <= r[1]);
const hueWithin = (h: number, r: readonly [number, number] | undefined): boolean => !r || (r[0] <= r[1] ? h >= r[0] && h <= r[1] : h >= r[0] || h <= r[1]);

/** The model with each part repainted by the first rule that covers it. */
export function repaint(m: MeshData, joints: readonly string[], rules: readonly Paint[]): MeshData {
  const col = new Uint8Array(m.col);
  const nor = new Int8Array(m.nor);
  const rule = new Int8Array(m.n).fill(-1);
  const sum = rules.map(() => 0);
  const count = rules.map(() => 0);
  const jointOf = rules.map((r) => (r.joint ? joints.indexOf(r.joint) : -1));
  for (let v = 0; v < m.n; v++) {
    const [h, s, l] = hsv(m.col[v * 3]!, m.col[v * 3 + 1]!, m.col[v * 3 + 2]!);
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i]!;
      if (r.joint && (!m.skin || m.skin[v * 3] !== jointOf[i] || m.skin[v * 3 + 2]! < 128)) continue;
      // (a grey has no hue to speak of: only a rule that doesn't ask for one covers it)
      if (r.hue && (s < 0.08 || !hueWithin(h, r.hue))) continue;
      if (!within(s, r.sat) || !within(l, r.lum)) continue;
      rule[v] = i;
      sum[i]! += l;
      count[i]!++;
      break;
    }
  }
  for (let v = 0; v < m.n; v++) {
    const i = rule[v]!;
    if (i < 0) continue;
    const r = rules[i]!;
    if (r.to) {
      const to = hexOf(r.to);
      const mid = sum[i]! / Math.max(1, count[i]!);
      const l = Math.max(m.col[v * 3]!, m.col[v * 3 + 1]!, m.col[v * 3 + 2]!) / 255;
      const k = 1 + (Math.min(1.7, Math.max(0.45, l / Math.max(0.05, mid))) - 1) * (r.keep ?? 1);
      for (let c = 0; c < 3; c++) col[v * 3 + c] = Math.min(255, to[c]! * k);
    }
    if (r.glow) nor[v * 3] = nor[v * 3 + 1] = nor[v * 3 + 2] = 0;
  }
  let idx = m.idx;
  let n = m.i;
  if (rules.some((r) => r.cut)) {
    const kept: number[] = [];
    for (let t = 0; t < m.i; t += 3) {
      const a = m.idx[t]!;
      const b = m.idx[t + 1]!;
      const c = m.idx[t + 2]!;
      const gone = (v: number): boolean => rule[v]! >= 0 && !!rules[rule[v]!]!.cut;
      // (a face goes when any corner of it is of the part cut away: its edge would be left hanging otherwise)
      if (gone(a) || gone(b) || gone(c)) continue;
      kept.push(a, b, c);
    }
    idx = Uint16Array.from(kept);
    n = kept.length;
  }
  return { ...m, col, nor, idx, i: n };
}

/** Where a bone's part of a model is, at rest: the box round every vertex that hangs from it and is still drawn. */
function boxOf(m: MeshData, joint: number): { min: [number, number, number]; max: [number, number, number] } | null {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const used = new Uint8Array(m.n);
  for (let t = 0; t < m.i; t++) used[m.idx[t]!] = 1;
  let any = false;
  for (let v = 0; v < m.n; v++) {
    if (!used[v] || !m.skin || m.skin[v * 3] !== joint || m.skin[v * 3 + 2]! < 200) continue;
    any = true;
    for (let c = 0; c < 3; c++) {
      min[c] = Math.min(min[c]!, m.pos[v * 3 + c]!);
      max[c] = Math.max(max[c]!, m.pos[v * 3 + c]!);
    }
  }
  return any ? { min, max } : null;
}

/** Triangles in the making: flat-shaded, each corner its own color; `lit` corners give their own light. */
class Bits {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  tri(a: readonly number[], b: readonly number[], c: readonly number[], ca: readonly number[], cb: readonly number[] = ca, cc: readonly number[] = ca, lit: readonly [boolean, boolean, boolean] = [false, false, false]): void {
    const ux = b[0]! - a[0]!;
    const uy = b[1]! - a[1]!;
    const uz = b[2]! - a[2]!;
    const vx = c[0]! - a[0]!;
    const vy = c[1]! - a[1]!;
    const vz = c[2]! - a[2]!;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    this.pos.push(...a, ...b, ...c);
    for (const on of lit) this.nor.push(...(on ? [0, 0, 0] : [nx, ny, nz]));
    this.col.push(...ca, ...cb, ...cc);
  }
  quad(a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[], lo: readonly number[], hi: readonly number[] = lo, lit = false): void {
    this.tri(a, b, c, lo, lo, hi, [false, false, lit]);
    this.tri(a, c, d, lo, hi, hi, [false, lit, lit]);
  }
}

/** A model with `bits` added to it, hanging whole from one bone. */
function withBits(m: MeshData, bits: Bits, joint: number): MeshData {
  const add = bits.pos.length / 3;
  const n = m.n + add;
  const pos = new Float32Array(n * 3);
  pos.set(m.pos);
  pos.set(bits.pos, m.n * 3);
  const nor = new Int8Array(n * 3);
  nor.set(m.nor);
  const sn = new Int8Array(n * 3);
  sn.set(m.sn);
  for (let i = 0; i < bits.nor.length; i++) {
    nor[m.n * 3 + i] = Math.round(bits.nor[i]! * 127);
    sn[m.n * 3 + i] = Math.round(bits.nor[i]! * 127);
  }
  const col = new Uint8Array(n * 3);
  col.set(m.col);
  for (let i = 0; i < bits.col.length; i++) col[m.n * 3 + i] = Math.min(255, Math.round(bits.col[i]!));
  const skin = new Uint8Array(n * 3);
  if (m.skin) skin.set(m.skin);
  for (let v = 0; v < add; v++) {
    skin[(m.n + v) * 3] = joint;
    skin[(m.n + v) * 3 + 1] = joint;
    skin[(m.n + v) * 3 + 2] = 255;
  }
  const idx = new Uint16Array(m.i + add);
  idx.set(m.idx.subarray(0, m.i));
  for (let v = 0; v < add; v++) idx[m.i + v] = m.n + v;
  const min: [number, number, number] = [...m.min];
  const max: [number, number, number] = [...m.max];
  for (let v = 0; v < add; v++) {
    for (let c = 0; c < 3; c++) {
      // (its height is left as the body's own: a crown's points don't make a king stand smaller)
      if (c === 1) continue;
      min[c] = Math.min(min[c]!, bits.pos[v * 3 + c]!);
      max[c] = Math.max(max[c]!, bits.pos[v * 3 + c]!);
    }
  }
  return { ...m, n, i: m.i + add, pos, nor, sn, col, skin, idx, min, max };
}

const mixc = (a: readonly number[], b: readonly number[], t: number): number[] => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];

/**
 * A crown of ice on a helm: a band round the brow and nine points standing from it, the three over the face the
 * tallest, each leaning a little outward, the body of each a deep ice and its upper half alight.
 */
function iceCrown(b: Bits, box: { min: number[]; max: number[] }, w: Wear): void {
  const cx = (box.min[0]! + box.max[0]!) / 2;
  const cz = (box.min[2]! + box.max[2]!) / 2;
  const hh = box.max[1]! - box.min[1]!;
  const k = w.size ?? 1;
  const R = Math.min(box.max[0]! - box.min[0]!, box.max[2]! - box.min[2]!) * 0.46 * k;
  const y0 = box.min[1]! + hh * (0.74 + (w.lift ?? 0));
  const band = hh * 0.1;
  const ice = hexOf(w.a ?? '#6fa8e8');
  const light = hexOf(w.b ?? '#f0fbff');
  const metal: number[] = w.band ? hexOf(w.band) : [176, 190, 214];
  const dark = metal.map((v) => v * 0.55);
  const N = 18;
  const at = (i: number, r: number, y: number): number[] => {
    const a = (i / N) * Math.PI * 2;
    return [cx + Math.sin(a) * r, y, cz + Math.cos(a) * r];
  };
  for (let i = 0; i < N; i++) {
    // the band: its face, and a lip along its top
    b.quad(at(i, R, y0), at(i + 1, R, y0), at(i + 1, R * 1.03, y0 + band), at(i, R * 1.03, y0 + band), dark, metal);
    b.quad(at(i, R * 1.03, y0 + band), at(i + 1, R * 1.03, y0 + band), at(i + 1, R * 0.9, y0 + band), at(i, R * 0.9, y0 + band), metal);
  }
  const P = 9;
  for (let p = 0; p < P; p++) {
    const a = (p / P) * Math.PI * 2;
    // (how far round from the face: the front three stand tallest)
    const front = Math.max(0, Math.cos(a));
    const tall = hh * (0.36 + 0.34 * front * front) * k;
    const half = R * 0.19;
    const out = [Math.sin(a), Math.cos(a)];
    const side = [Math.cos(a), -Math.sin(a)];
    const baseR = R * 0.98;
    const y = y0 + band * 0.6;
    const foot = (sx: number, so: number): number[] => [cx + out[0]! * (baseR + so) + side[0]! * sx, y, cz + out[1]! * (baseR + so) + side[1]! * sx];
    const lean = tall * 0.2;
    const tip = [cx + out[0]! * (baseR + lean), y + tall, cz + out[1]! * (baseR + lean)];
    const corners = [foot(-half, 0.5 * half), foot(half, 0.5 * half), foot(half * 0.6, -half), foot(-half * 0.6, -half)];
    // each face in two: its foot in deep ice, its upper half alight
    for (let f = 0; f < 4; f++) {
      const c0 = corners[f]!;
      const c1 = corners[(f + 1) % 4]!;
      const m0 = [(c0[0]! + tip[0]!) / 2, (c0[1]! + tip[1]!) / 2, (c0[2]! + tip[2]!) / 2];
      const m1 = [(c1[0]! + tip[0]!) / 2, (c1[1]! + tip[1]!) / 2, (c1[2]! + tip[2]!) / 2];
      const midc = mixc(ice, light, 0.45);
      b.tri(c0, c1, m1, ice, ice, midc);
      b.tri(c0, m1, m0, ice, midc, midc);
      b.tri(m0, m1, tip, midc, midc, light, [true, true, true]);
    }
  }
}

/** Two eyes alight in a helm's dark: slits across its face, a little below its middle. */
function eyes(b: Bits, box: { min: number[]; max: number[] }, w: Wear): void {
  const cx = (box.min[0]! + box.max[0]!) / 2;
  const hh = box.max[1]! - box.min[1]!;
  const wide = box.max[0]! - box.min[0]!;
  const z = box.max[2]! + 0.012;
  const y = box.min[1]! + hh * (0.4 + (w.lift ?? 0));
  const c = hexOf(w.b ?? '#e8f8ff');
  const k = w.size ?? 1;
  for (const s of [-1, 1]) {
    // (each a narrow lozenge, slanting down toward the nose: a glare, not a lamp)
    const ex = cx + s * wide * 0.17;
    const rx = wide * 0.07 * k;
    const ry = hh * 0.04 * k;
    const p = [
      [ex - rx, y + (s > 0 ? -ry * 0.5 : ry * 0.5), z],
      [ex, y - ry, z],
      [ex + rx, y + (s > 0 ? ry * 0.5 : -ry * 0.5), z],
      [ex, y + ry, z],
    ];
    b.tri(p[0]!, p[1]!, p[2]!, c, c, c, [true, true, true]);
    b.tri(p[0]!, p[2]!, p[3]!, c, c, c, [true, true, true]);
  }
}

/** A length of horn or thorn from `p0` to `p1`, four-sided, `r0` thick at its foot and `r1` at its end. */
function prism(b: Bits, p0: readonly number[], p1: readonly number[], r0: number, r1: number, c0: readonly number[], c1: readonly number[], lit = false): void {
  const d = [p1[0]! - p0[0]!, p1[1]! - p0[1]!, p1[2]! - p0[2]!];
  const l = Math.hypot(d[0]!, d[1]!, d[2]!) || 1;
  // two directions square to it
  const up = Math.abs(d[1]! / l) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = [d[1]! * up[2]! - d[2]! * up[1]!, d[2]! * up[0]! - d[0]! * up[2]!, d[0]! * up[1]! - d[1]! * up[0]!];
  const ul = Math.hypot(u[0]!, u[1]!, u[2]!) || 1;
  for (let i = 0; i < 3; i++) u[i] = u[i]! / ul;
  const v = [(d[1]! * u[2]! - d[2]! * u[1]!) / l, (d[2]! * u[0]! - d[0]! * u[2]!) / l, (d[0]! * u[1]! - d[1]! * u[0]!) / l];
  const ring = (p: readonly number[], r: number): number[][] => [0, 1, 2, 3].map((k) => {
    const a = (k / 4) * Math.PI * 2;
    return [0, 1, 2].map((i) => p[i]! + (u[i]! * Math.cos(a) + v[i]! * Math.sin(a)) * r);
  });
  const a = ring(p0, r0);
  const z = ring(p1, r1);
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4;
    b.tri(a[k]!, z[n]!, a[n]!, c0, c1, c0, [false, lit, false]);
    b.tri(a[k]!, z[k]!, z[n]!, c0, c1, c1, [false, lit, lit]);
  }
}

/** Two horns from the sides of a head, sweeping out, up and a little forward to a point. */
function horns(b: Bits, box: { min: number[]; max: number[] }, w: Wear): void {
  const cx = (box.min[0]! + box.max[0]!) / 2;
  const cz = (box.min[2]! + box.max[2]!) / 2;
  const hh = box.max[1]! - box.min[1]!;
  const wide = box.max[0]! - box.min[0]!;
  const k = w.size ?? 1;
  const c0 = hexOf(w.a ?? '#4a4038');
  const c1 = hexOf(w.b ?? '#d8cdb8');
  const y0 = box.min[1]! + hh * (0.66 + (w.lift ?? 0));
  for (const s of [-1, 1]) {
    let p = [cx + s * wide * 0.36, y0, cz];
    const steps = 5;
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps;
      // (out first, then up: a quarter turn)
      const a = t * Math.PI * 0.56;
      const q = [cx + s * (wide * 0.36 + Math.sin(a) * wide * 0.42 * k), y0 + (1 - Math.cos(a)) * hh * 0.62 * k, cz + t * t * wide * 0.14];
      const r0 = hh * 0.11 * k * (1 - i / steps);
      const r1 = hh * 0.11 * k * (1 - (i + 1) / steps);
      prism(b, p, q, r0, Math.max(r1, 0.001), mixc(c0, c1, i / steps), mixc(c0, c1, t));
      p = q;
    }
  }
}

/** A disc of rays standing behind a head, alight: what crowns a thing that was worshipped. */
function halo(b: Bits, box: { min: number[]; max: number[] }, w: Wear): void {
  const cx = (box.min[0]! + box.max[0]!) / 2;
  const hh = box.max[1]! - box.min[1]!;
  const wide = box.max[0]! - box.min[0]!;
  const k = w.size ?? 1;
  const z = box.min[2]! - wide * 0.08;
  const cy = box.min[1]! + hh * (0.62 + (w.lift ?? 0));
  const c0 = hexOf(w.a ?? '#e8a838');
  const c1 = hexOf(w.b ?? '#fff4c0');
  const N = 14;
  const r0 = wide * 0.5 * k;
  for (let i = 0; i < N; i++) {
    const a0 = ((i - 0.34) / N) * Math.PI * 2;
    const a1 = ((i + 0.34) / N) * Math.PI * 2;
    const am = (i / N) * Math.PI * 2;
    const r1 = wide * (i % 2 ? 0.78 : 0.98) * k;
    const p0 = [cx + Math.sin(a0) * r0, cy + Math.cos(a0) * r0, z];
    const p1 = [cx + Math.sin(a1) * r0, cy + Math.cos(a1) * r0, z];
    const tip = [cx + Math.sin(am) * r1, cy + Math.cos(am) * r1, z];
    b.tri(p1, p0, tip, c0, c0, c1, [true, true, true]);
  }
  // the ring they stand from
  for (let i = 0; i < N * 2; i++) {
    const a0 = (i / (N * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (N * 2)) * Math.PI * 2;
    const at = (a: number, r: number): number[] => [cx + Math.sin(a) * r, cy + Math.cos(a) * r, z + 0.004];
    b.tri(at(a1, r0 * 0.86), at(a0, r0 * 0.86), at(a0, r0 * 1.02), c1, c1, c1, [true, true, true]);
    b.tri(at(a1, r0 * 0.86), at(a0, r0 * 1.02), at(a1, r0 * 1.02), c1, c1, c1, [true, true, true]);
  }
}

/** The model with what it wears built onto its head. */
export function dressed(m: MeshData, joints: readonly string[], wears: readonly Wear[]): MeshData {
  const head = joints.indexOf('head');
  if (head < 0) return m;
  const box = boxOf(m, head);
  if (!box) return m;
  const bits = new Bits();
  for (const w of wears) {
    if (w.piece === 'ice-crown') iceCrown(bits, box, w);
    else if (w.piece === 'eyes') eyes(bits, box, w);
    else if (w.piece === 'horns') horns(bits, box, w);
    else if (w.piece === 'halo') halo(bits, box, w);
  }
  return bits.pos.length ? withBits(m, bits, head) : m;
}
