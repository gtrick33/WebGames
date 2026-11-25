import * as THREE from 'three';
import type { MountDef, MountExtra } from '../data/mounts';
import { mul, type C } from './build';
import { above, below, between, glowing, mix, Part, rgb, rod, shell, smooth, topAt, within, type Corner, type Inside } from './meshKit';
import type { MountShape } from './mountLook';
import type { MeshData } from './pack';
import type { RigAnim } from './toon';

/**
 * What the shop's mounts have built onto them (src/catalog/sigilItems.ts names them): plates of armor cut from the
 * animal's own skin, a crown of horns, crystal spines, a burning tail, antlers of flame or of crystal, a horned helm,
 * runes laid on the skin. What glows is lit by nothing but itself (meshKit.ts glowing), in the mount's glow color.
 * Built from nothing but the animal's own model and shapes made here, like the drakes' wings and horns.
 */

export const hasExtra = (def: MountDef, x: MountExtra): boolean => !!def.extras?.includes(x);

const WHITE: C = [1, 1, 1];
const PALE_FIRE: C = rgb('#fff2b0');

/** The color of everything on the mount that glows. */
export const glowOf = (def: MountDef): C => rgb(def.glow?.color ?? '#ffd27a');

/** A rod that glows. */
const lit = (a: readonly number[], b: readonly number[], ra: number, rb: number, sides: number, ca: C, cb: C, joint: number, rig?: string): MeshData => glowing(rod(a, b, ra, rb, sides, ca, cb, joint, rig));

/**
 * A tongue of flame, glowing: flat and seen from both sides, from its root to its tip, widest a third of the way up,
 * spread across `across` (so two at right angles make one that looks full from anywhere).
 */
function tongue(root: readonly number[], tip: readonly number[], w: number, across: THREE.Vector3, c0: C, c1: C, c2: C, joint: number, rig?: string): MeshData {
  const along = new THREE.Vector3(tip[0]! - root[0]!, tip[1]! - root[1]!, tip[2]! - root[2]!);
  const side = across.clone().addScaledVector(along.clone().normalize(), -across.dot(along.clone().normalize())).normalize().multiplyScalar(w);
  const n = new THREE.Vector3().crossVectors(along, side).normalize();
  const at = (t: number, k: number): number[] => [root[0]! + along.x * t + side.x * k, root[1]! + along.y * t + side.y * k, root[2]! + along.z * t + side.z * k];
  const pts = [[...root], at(0.3, 0.55), at(0.62, 0.38), [...tip], at(0.62, -0.38), at(0.3, -0.55)];
  const cols = [c0, c1, mix(c1, c2, 0.6), c2, mix(c1, c2, 0.6), c1];
  const out = new Part();
  for (const flip of [1, -1]) {
    const ids = pts.map((p, i) => out.corner([p[0]!, p[1]!, p[2]!, n.x * flip, n.y * flip, n.z * flip, n.x * flip, n.y * flip, n.z * flip, joint, joint, 255], cols[i]!));
    for (let i = 1; i + 1 < ids.length; i++) {
      if (flip > 0) out.idx.push(ids[0]!, ids[i]!, ids[i + 1]!);
      else out.idx.push(ids[0]!, ids[i + 1]!, ids[i]!);
    }
  }
  return glowing(out.data(rig));
}

/** A curve of rods through points, each its own width, its color running from one end to the other. */
function curve(points: readonly (readonly number[])[], widths: readonly number[], c0: C, c1: C, joint: number, rig: string | undefined, sides = 6, glow = false): MeshData[] {
  const out: MeshData[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = i / (points.length - 1);
    const b = (i + 1) / (points.length - 1);
    const make = glow ? lit : rod;
    out.push(make(points[i]!, points[i + 1]!, widths[i]!, widths[i + 1]!, sides, mix(c0, c1, a), mix(c0, c1, b), joint, rig));
  }
  return out;
}

/** The outermost point of a flank near (y, z), its smooth normal and the joints that carry it. */
function flankAt(m: MeshData, side: 1 | -1, y: number, z: number, reach: number): { p: THREE.Vector3; n: THREE.Vector3; skin: [number, number, number] } | null {
  let best = -1;
  let bx = -Infinity;
  const r2 = reach * reach;
  for (let v = 0; v < m.n; v++) {
    const x = m.pos[v * 3]! * side;
    if (x <= 0) continue;
    const dy = m.pos[v * 3 + 1]! - y;
    const dz = m.pos[v * 3 + 2]! - z;
    if (dy * dy + dz * dz > r2) continue;
    if (x > bx) {
      bx = x;
      best = v;
    }
  }
  if (best < 0) return null;
  const n = new THREE.Vector3(m.sn[best * 3]!, m.sn[best * 3 + 1]!, m.sn[best * 3 + 2]!).normalize();
  if (n.x * side < 0.25) n.set(side, 0.2, 0).normalize();
  return { p: new THREE.Vector3(m.pos[best * 3]!, y, z), n, skin: [m.skin![best * 3]!, m.skin![best * 3 + 1]!, m.skin![best * 3 + 2]!] };
}

/* ------------------------------------------------------------------ runes */

/** Sigil shapes (no letters of any alphabet): strokes from (x0, y0) to (x1, y1), in a box half a unit wide and one tall. */
const RUNES: readonly (readonly number[])[][] = [
  // a diamond on a stem
  [[0.22, 0, 0.22, 0.2], [0.22, 0.2, 0.44, 0.5], [0.44, 0.5, 0.22, 0.8], [0.22, 0.8, 0, 0.5], [0, 0.5, 0.22, 0.2], [0.22, 0.8, 0.22, 1]],
  // two chevrons over a stem
  [[0, 0.62, 0.22, 0.84], [0.22, 0.84, 0.44, 0.62], [0, 0.36, 0.22, 0.58], [0.22, 0.58, 0.44, 0.36], [0.22, 0.58, 0.22, 0]],
  // an eye: a pointed oval with a stroke through
  [[0, 0.5, 0.22, 0.82], [0.22, 0.82, 0.44, 0.5], [0.44, 0.5, 0.22, 0.18], [0.22, 0.18, 0, 0.5], [0.22, 0.38, 0.22, 0.62]],
  // a triangle hung from a bar
  [[0, 0.95, 0.44, 0.95], [0.22, 0.95, 0.22, 0.62], [0, 0.62, 0.44, 0.62], [0.44, 0.62, 0.22, 0.08], [0.22, 0.08, 0, 0.62]],
  // a crescent over a dot
  [[0.04, 0.9, 0.3, 0.84], [0.3, 0.84, 0.42, 0.62], [0.42, 0.62, 0.3, 0.4], [0.3, 0.4, 0.04, 0.34], [0.2, 0.14, 0.24, 0.05]],
  // a star of three strokes
  [[0.22, 0.05, 0.22, 0.95], [0.02, 0.25, 0.42, 0.75], [0.42, 0.25, 0.02, 0.75]],
];

/** A rune laid on the skin of a flank near (y, z), glowing: drawn in the plane that touches the skin there. */
function rune(m: MeshData, side: 1 | -1, y: number, z: number, size: number, which: number, color: C, rig?: string): MeshData | null {
  const at = flankAt(m, side, y, z, size * 0.9);
  if (!at) return null;
  const { n } = at;
  const along = new THREE.Vector3(0, 1, 0).cross(n).normalize();
  const up = new THREE.Vector3().crossVectors(n, along).normalize();
  if (up.y < 0) up.negate();
  const origin = at.p.clone().addScaledVector(n, size * 0.07);
  const out = new Part();
  const w = size * 0.075;
  const put = (gx: number, gy: number, off: THREE.Vector3): number => {
    const q = origin.clone().addScaledVector(along, (gx - 0.22) * size).addScaledVector(up, (gy - 0.5) * size).add(off);
    const c: Corner = [q.x, q.y, q.z, n.x, n.y, n.z, n.x, n.y, n.z, at.skin[0], at.skin[1], at.skin[2]];
    return out.corner(c, color);
  };
  for (const [x0, y0, x1, y1] of RUNES[which % RUNES.length]!) {
    const dir = along.clone().multiplyScalar(x1! - x0!).addScaledVector(up, y1! - y0!).normalize();
    const perp = new THREE.Vector3().crossVectors(n, dir).normalize().multiplyScalar(w);
    const back = perp.clone().negate();
    const i0 = put(x0!, y0!, perp);
    const i1 = put(x0!, y0!, back);
    const i2 = put(x1!, y1!, back);
    const i3 = put(x1!, y1!, perp);
    // (facing out, whichever way round the stroke runs)
    const e1 = new THREE.Vector3().subVectors(new THREE.Vector3(...out.pos.slice(i1 * 3, i1 * 3 + 3)), new THREE.Vector3(...out.pos.slice(i0 * 3, i0 * 3 + 3)));
    const e2 = new THREE.Vector3().subVectors(new THREE.Vector3(...out.pos.slice(i2 * 3, i2 * 3 + 3)), new THREE.Vector3(...out.pos.slice(i0 * 3, i0 * 3 + 3)));
    if (e1.cross(e2).dot(n) > 0) out.idx.push(i0, i1, i2, i0, i2, i3);
    else out.idx.push(i0, i2, i1, i0, i3, i2);
  }
  return glowing(out.data(rig));
}

/** Runes down both flanks at these spots (y, z), mirrored. */
function runes(m: MeshData, spots: readonly (readonly [number, number])[], size: number, color: C, rig?: string): MeshData[] {
  const out: MeshData[] = [];
  spots.forEach(([y, z], i) => {
    for (const side of [1, -1] as const) {
      const r = rune(m, side, y, z, size, i * 2 + (side > 0 ? 0 : 3), color, rig);
      if (r) out.push(r);
    }
  });
  return out;
}

/* ------------------------------------------------------------------ drakes */

/** How high the drake's back is along it, sampled once. */
function ridgeOf(base: MeshData): (z: number) => number {
  const lo = base.min[2];
  const hi = base.max[2];
  const step = 40;
  const ys: number[] = [];
  for (let z = lo; z <= hi + step; z += step) ys.push(topAt(base, z, 30, 160)?.y ?? NaN);
  // (gaps take their neighbours')
  for (let i = 0; i < ys.length; i++) if (Number.isNaN(ys[i])) ys[i] = ys[i - 1] ?? ys.find((y) => !Number.isNaN(y)) ?? 0;
  return (z) => {
    const f = Math.max(0, Math.min(ys.length - 1.001, (z - lo) / step));
    const i = Math.floor(f);
    return ys[i]! + (ys[i + 1]! - ys[i]!) * (f - i);
  };
}

export function drakeExtras(base: MeshData, def: MountDef, shape: MountShape, rig: RigAnim, at: { top: number; hz: number }): MeshData[] {
  const parts: MeshData[] = [];
  const J = (name: string): number => rig.joints.indexOf(name);
  const head = J('Head');
  const R = base.rig;
  const glow = glowOf(def);
  const plate = rgb(def.plate ?? '#5a5e6a');
  const trim = mix(glow, WHITE, 0.25);
  const { top, hz } = at;
  const { seatZ: sz } = shape;
  const ridge = ridgeOf(base);

  if (hasExtra(def, 'plates')) {
    // overlapping plates down the neck, the back and the tail, each with a gold seam, cut from its own skin
    const depth = (z: number): number => (z > 560 ? 150 : z > sz ? 210 : 70 + 150 * smooth(-1500, -100, z));
    const under: Inside = (_x, y, z) => y - (ridge(z) - depth(z));
    // (each plate lighter at its top edge and darker at its foot, so the rows read as scales of steel)
    const rows = (_x: number, _y: number, z: number): C => mul(plate, 0.74 + 0.42 * (((z + 4000) % 110) / 110));
    const gold = mix(trim, rgb('#ffd56a'), 0.5);
    for (const [z0, z1] of [[sz + 220, 1060], [-1560, sz - 240]] as const) {
      parts.push(shell(base, [under, ...between(z0, z1)], 14, rows));
      parts.push(shell(base, [under, (_x, y, z) => ridge(z) - depth(z) + 26 - y, ...between(z0, z1)], 20, gold));
    }
    // a plate over the brow and down the snout, with a spike
    parts.push(shell(base, [(_x, y, z) => y - (ridge(z) - 70), ...between(1120, 1470), within(115)], 12, mul(plate, 1.04)));
    parts.push(shell(base, [(_x, y, z) => y - (ridge(z) - 70), (_x, y, z) => ridge(z) - 48 - y, ...between(1120, 1470), within(115)], 16, mix(trim, rgb('#ffd56a'), 0.5)));
    parts.push(rod([0, top - 40, 1380], [0, top + 120, 1300], 34, 0, 5, plate, trim, head, R));
    // a breastplate
    parts.push(shell(base, [...between(420, 760), above(700), below(1250), within(150)], 14, mul(plate, 0.95)));
    parts.push(shell(base, [...between(420, 760), above(700), below(745), within(150)], 18, mix(trim, rgb('#ffd56a'), 0.5)));
  }

  if (hasExtra(def, 'crown')) {
    // a ring of horns round the back of the skull, the middle ones the tallest, the colors of its plate going to light
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (1.12 + (0.76 * i) / (n - 1));
      const x = Math.cos(a) * 150;
      const z = hz - 10 + Math.sin(a) * 120;
      const tall = 170 + 150 * Math.sin((Math.PI * i) / (n - 1));
      const out = new THREE.Vector3(x, 0, z - hz).normalize();
      const root = [x, top - 70, z];
      const mid = [x + out.x * tall * 0.25, top - 70 + tall * 0.55, z + out.z * tall * 0.3 - tall * 0.12];
      const tip = [x + out.x * tall * 0.42, top - 70 + tall, z + out.z * tall * 0.5 - tall * 0.3];
      parts.push(...curve([root, mid, tip], [34, 22, 0], mul(plate, 0.9), trim, head, R, 5));
    }
  }

  if (hasExtra(def, 'crystals')) {
    // shards down the spine in pairs, leaning back, glowing from within
    for (let z = 1000; z > -1500; z -= 120) {
      if (z < sz + 250 && z > sz - 270) continue;
      const t = topAt(base, z, 70, 90);
      if (!t) continue;
      const tall = 120 + 150 * smooth(-1500, -300, z) * (1 - 0.5 * smooth(500, 1000, z));
      for (const side of [1, -1]) {
        const lean = side * (18 + (Math.abs(z) % 50));
        parts.push(lit([side * 10, t.y - 20, z], [side * 28 + lean, t.y + tall, z - tall * 0.4], 30, 0, 4, mix(glow, mul(plate, 0.6), 0.45), mix(glow, WHITE, 0.55), t.j, R));
      }
      parts.push(lit([0, t.y - 20, z + 30], [0, t.y + tall * 0.7, z - tall * 0.15], 22, 0, 4, mix(glow, mul(plate, 0.6), 0.45), mix(glow, WHITE, 0.4), t.j, R));
    }
  }

  if (hasExtra(def, 'flametail')) {
    // tongues of flame off the tail's end, and smaller ones along it
    const end = J('Tail5');
    const z0 = base.min[2];
    const y0 = (topAt(base, z0 + 40, 120, 100)?.y ?? 980) - 40;
    const deep = mix(glow, rgb('#d8341a'), 0.5);
    for (let i = 0; i < 5; i++) {
      const a = -0.8 + (1.6 * i) / 4;
      const long = 300 + 160 * Math.cos(a * 1.6);
      const root = [Math.sin(a) * 30, y0 + 20, z0 + 90];
      const tip = [Math.sin(a) * long * 0.55, y0 + 120 + Math.cos(a) * long * 0.7, z0 - long * 0.6];
      parts.push(tongue(root, tip, 70, new THREE.Vector3(Math.cos(a), 0, 0), deep, glow, PALE_FIRE, end, R));
      parts.push(tongue(root, tip, 70, new THREE.Vector3(0, 0.3, 1).normalize(), deep, glow, PALE_FIRE, end, R));
    }
    for (const [jn, dz] of [['Tail4', 300], ['Tail3', 600], ['Tail2', 880]] as const) {
      const j = J(jn);
      const t = topAt(base, z0 + dz, 60, 90);
      if (j < 0 || !t) continue;
      const root = [0, t.y - 10, z0 + dz];
      const tip = [0, t.y + 170 - dz * 0.06, z0 + dz - 150];
      parts.push(tongue(root, tip, 46, new THREE.Vector3(1, 0, 0), deep, glow, PALE_FIRE, j, R));
    }
  }

  if (hasExtra(def, 'runes')) {
    // runes along the neck and over the haunches
    parts.push(...runes(base, [[1400, 760], [1460, 880], [1120, -320], [1080, -470]], 110, glow, R));
  }
  return parts;
}

/* ------------------------------------------------------------------ harts */

/** Whether a hart has antlers built for it, in place of its own. */
export const builtAntlers = (def: MountDef): 'flame' | 'crystal' | null => (hasExtra(def, 'flame-antlers') ? 'flame' : hasExtra(def, 'crystal-antlers') ? 'crystal' : null);

/** The stag without its own antlers (the dark of its file over its head): built ones go there instead. */
export function withoutAntlers(m: MeshData, head: number): MeshData {
  const idx: number[] = [];
  const dark = (v: number): boolean => m.col[v * 3] === 0x35 && m.col[v * 3 + 1] === 0x2d && m.col[v * 3 + 2] === 0x22 && m.skin![v * 3] === head && m.pos[v * 3 + 1]! > 4.0;
  for (let t = 0; t < m.i; t += 3) {
    const a = m.idx[t]!;
    const b = m.idx[t + 1]!;
    const c = m.idx[t + 2]!;
    if (dark(a) && dark(b) && dark(c)) continue;
    idx.push(a, b, c);
  }
  return { ...m, i: idx.length, idx: Uint16Array.from(idx) };
}

/** One side's antlers: the beam up and back from the brow, and the tines off it. */
function antlerTree(side: 1 | -1): { a: number[]; b: number[]; ra: number; rb: number; tip: boolean }[] {
  const X = (p: number[]): number[] => [p[0]! * side, p[1]!, p[2]!];
  const beam = [
    [0.27, 4.12, 2.26],
    [0.55, 4.58, 2.08],
    [0.86, 5.04, 1.74],
    [1.06, 5.5, 1.32],
    [1.16, 5.92, 0.96],
  ];
  const r = [0.1, 0.085, 0.072, 0.06, 0.03];
  const out: { a: number[]; b: number[]; ra: number; rb: number; tip: boolean }[] = [];
  for (let i = 0; i + 1 < beam.length; i++) out.push({ a: X(beam[i]!), b: X(beam[i + 1]!), ra: r[i]!, rb: r[i + 1]!, tip: false });
  const tine = (from: number, to: number[], ra: number): void => {
    out.push({ a: X(beam[from]!), b: X(to), ra, rb: 0, tip: true });
  };
  tine(1, [0.66, 5.02, 2.66], 0.06);
  tine(2, [0.98, 5.72, 2.02], 0.058);
  tine(3, [1.28, 6.06, 1.58], 0.05);
  tine(3, [1.5, 5.66, 0.96], 0.045);
  tine(4, [1.06, 6.32, 0.72], 0.04);
  tine(4, [1.42, 6.16, 1.08], 0.04);
  return out;
}

export function deerExtras(base: MeshData, def: MountDef, shape: MountShape, rig: RigAnim): MeshData[] {
  const parts: MeshData[] = [];
  const head = rig.joints.indexOf('Head');
  const R = base.rig;
  const glow = glowOf(def);
  const plate = rgb(def.plate ?? '#c8ccd8');
  const { seatZ: sz } = shape;
  const kind = builtAntlers(def);
  const deep = mix(glow, rgb('#c82c16'), 0.55);
  if (kind) {
    for (const side of [1, -1] as const) {
      for (const s of antlerTree(side)) {
        if (kind === 'flame') {
          // fire: a burning core, red at the brow, gold and pale toward the tips, and tongues of flame along it
          const heat = (y: number): C => (y < 5 ? mix(deep, glow, smooth(4.1, 5, y)) : mix(glow, PALE_FIRE, smooth(5, 6.2, y)));
          parts.push(lit(s.a, s.b, s.ra * 1.4, s.rb * 1.2, 5, heat(s.a[1]!), heat(s.b[1]! + (s.tip ? 0.4 : 0)), head, R));
          const d = [s.b[0]! - s.a[0]!, s.b[1]! - s.a[1]!, s.b[2]! - s.a[2]!];
          for (const t of s.tip ? [0.45] : [0.5]) {
            const at = [s.a[0]! + d[0]! * t, s.a[1]! + d[1]! * t, s.a[2]! + d[2]! * t];
            const tip = [at[0]! + side * 0.08, at[1]! + 0.36, at[2]! - 0.12];
            parts.push(tongue(at, tip, 0.1, new THREE.Vector3(0, 0, 1), heat(at[1]!), glow, PALE_FIRE, head, R));
            parts.push(tongue(at, tip, 0.1, new THREE.Vector3(1, 0, 0), heat(at[1]!), glow, PALE_FIRE, head, R));
          }
          if (s.tip) {
            const flare = [s.b[0]! + side * 0.04, s.b[1]! + 0.3, s.b[2]! - 0.08];
            parts.push(tongue(s.b, flare, 0.08, new THREE.Vector3(0, 0, 1), glow, mix(glow, PALE_FIRE, 0.5), PALE_FIRE, head, R));
            parts.push(tongue(s.b, flare, 0.08, new THREE.Vector3(1, 0, 0), glow, mix(glow, PALE_FIRE, 0.5), PALE_FIRE, head, R));
          }
        } else {
          // crystal, faceted, swelling between its ends, its points lit from within
          const m = [(s.a[0]! + s.b[0]!) / 2, (s.a[1]! + s.b[1]!) / 2, (s.a[2]! + s.b[2]!) / 2];
          const fat = Math.max(s.ra, s.rb) * 1.5 + 0.02;
          const ice = mix(glow, WHITE, 0.55);
          parts.push(rod(s.a, m, s.ra, fat, 4, mix(ice, plate, 0.3), ice, head, R));
          parts.push(lit(m, s.b, fat, s.rb, 4, mix(glow, WHITE, 0.15), mix(glow, WHITE, s.tip ? 0.8 : 0.4), head, R));
        }
      }
      // where they grow from: a cluster of short shards, or a ring of fire
      const root = [side * 0.27, 4.12, 2.26];
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + 0.4;
        const tip = [root[0]! + side * (0.14 + Math.cos(a) * 0.08), root[1]! + 0.22 + Math.sin(a) * 0.05, root[2]! + Math.sin(a) * 0.16];
        if (kind === 'crystal') parts.push(lit(root, tip, 0.06, 0, 4, mix(glow, WHITE, 0.3), mix(glow, WHITE, 0.7), head, R));
        else parts.push(lit(root, tip, 0.07, 0, 5, glow, PALE_FIRE, head, R));
      }
    }
  }

  if (def.barding) {
    // plates down the neck and over the rump, rows of them edged with light, and a plate down the face
    const lightEdge = mix(glow, WHITE, 0.25);
    const rows = (_x: number, _y: number, z: number): C => mul(plate, 0.72 + 0.4 * ((z * 6 + 60) % 1));
    const edge = (m: MeshData): MeshData => glowing(m);
    const line = (z: number): number => 2.72 + (z - 0.7) * 0.55;
    const neck: Inside = (_x, y, z) => y - line(z);
    parts.push(shell(base, [neck, ...between(0.75, 2.02)], 0.05, rows));
    parts.push(edge(shell(base, [neck, (_x, y, z) => line(z) + 0.06 - y, ...between(0.75, 2.02)], 0.07, lightEdge)));
    parts.push(edge(shell(base, [neck, ...between(0.75, 0.81)], 0.07, lightEdge)));
    parts.push(shell(base, [above(2.62), ...between(-1.75, sz - 0.9)], 0.06, rows));
    parts.push(edge(shell(base, [above(2.62), below(2.68), ...between(-1.75, sz - 0.9)], 0.08, lightEdge)));
    const brow = (z: number): number => 4.0 - (z - 2.3) * 0.7;
    parts.push(shell(base, [(_x, y, z) => y - brow(z), ...between(2.28, 3.05), within(0.26)], 0.03, mul(plate, 1.05)));
    parts.push(edge(shell(base, [(_x, y, z) => y - brow(z), (_x, y, z) => brow(z) + 0.05 - y, ...between(2.28, 3.05), within(0.26)], 0.045, lightEdge)));
  }

  if (hasExtra(def, 'runes')) parts.push(...runes(base, [[2.35, -1.05], [2.3, -1.45], [2.72, 1.42]], 0.34, glow, R));
  return parts;
}

/* ------------------------------------------------------------------ boars */

export function boarExtras(base: MeshData, def: MountDef, rig: RigAnim): MeshData[] {
  const parts: MeshData[] = [];
  const head = rig.joints.indexOf('Head');
  const R = base.rig;
  const glow = glowOf(def);
  const plate = rgb(def.plate ?? '#6e7280');
  const steel = mix(plate, WHITE, 0.35);

  if (hasExtra(def, 'plates')) {
    // spikes along the plated shoulders and rump, out of the plate's top and down its sides
    const spike = (j: number, a: number[], b: number[], r: number): MeshData => rod(a, b, r, 0, 5, mul(plate, 0.8), steel, j, R);
    for (const [z0, z1] of [[0.62, 1.55], [-1.9, -0.95]] as const) {
      for (let z = z1; z >= z0; z -= 0.3) {
        const t = topAt(base, z, 0.15, 0.4);
        if (!t) continue;
        parts.push(spike(t.j, [0, t.y - 0.05, z], [0, t.y + 0.62, z - 0.22], 0.16));
        for (const side of [1, -1] as const) {
          const f = flankAt(base, side, t.y - 0.42, z, 0.3);
          if (!f) continue;
          const tip = f.p.clone().addScaledVector(f.n, 0.48).add(new THREE.Vector3(0, 0.18, -0.12));
          parts.push(rod([f.p.x, f.p.y, f.p.z], [tip.x, tip.y, tip.z], 0.12, 0, 5, mul(plate, 0.8), steel, f.skin[0], R));
        }
      }
    }
  }

  if (hasExtra(def, 'helm')) {
    // a helm over the skull, banded at its rim, with a pair of horns sweeping out and up and a spike at the brow
    parts.push(shell(base, [above(3.42), ...between(2.68, 3.4)], 0.07, (_x, y) => mul(plate, 0.9 + (y - 3.42) * 0.4)));
    parts.push(shell(base, [above(3.42), below(3.52), ...between(2.68, 3.4)], 0.095, steel));
    parts.push(shell(base, [above(3.42), within(0.09), ...between(2.68, 3.4)], 0.1, steel));
    for (const side of [1, -1]) {
      const pts = [
        [side * 0.62, 3.72, 2.96],
        [side * 1.12, 3.96, 3.08],
        [side * 1.46, 4.38, 3.16],
        [side * 1.5, 4.86, 3.0],
      ];
      parts.push(...curve(pts, [0.2, 0.15, 0.1, 0], mul(plate, 0.85), mix(steel, WHITE, 0.4), head, R));
    }
    parts.push(rod([0, 3.86, 3.0], [0, 4.5, 2.84], 0.18, 0, 5, mul(plate, 0.85), steel, head, R));
  }

  if (hasExtra(def, 'rune-tusks')) {
    // bands round each tusk, glowing (the tusks themselves are built in mountKit.ts boarParts)
    for (const side of [1, -1]) {
      const a = [side * 0.52, 2.5, 3.15];
      const b = [side * 0.72, 3.0, 3.42];
      const c = [side * 0.8, 3.56, 3.34];
      const ring = (p: number[], q: number[], t: number, r: number): void => {
        const d = [q[0]! - p[0]!, q[1]! - p[1]!, q[2]! - p[2]!];
        const len = Math.hypot(d[0]!, d[1]!, d[2]!);
        const at = [p[0]! + d[0]! * t, p[1]! + d[1]! * t, p[2]! + d[2]! * t];
        const to = [at[0]! + (d[0]! / len) * 0.07, at[1]! + (d[1]! / len) * 0.07, at[2]! + (d[2]! / len) * 0.07];
        parts.push(lit(at, to, r, r, 8, glow, mix(glow, WHITE, 0.4), head, R));
      };
      ring(a, b, 0.3, 0.19);
      ring(a, b, 0.72, 0.165);
      ring(b, c, 0.35, 0.12);
    }
  }

  if (hasExtra(def, 'runes')) parts.push(...runes(base, [[3.9, 1.05], [4.0, -1.45]], 0.5, glow, R));
  // a beast nobody rides, with a light of its own: it burns in its eyes (Grimtusk, the grieflight's violet)
  if (def.bare && def.glow) {
    for (const side of [1, -1]) parts.push(lit([side * 0.5, 3.3, 2.86], [side * 0.62, 3.34, 3.02], 0.17, 0.11, 6, glow, mix(glow, WHITE, 0.5), head, R));
  }
  return parts;
}
