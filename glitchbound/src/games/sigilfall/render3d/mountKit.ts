import * as THREE from 'three';
import type { MountDef } from '../data/mounts';
import { Build, mul, type C } from './build';
import { above, below, between, blade, coatKeysOf, mix, otherSides, Part, rgb, rod, shell, smooth, swatchKey, tied, warped, within, withoutParts, type Corner, type Inside } from './meshKit';
import { shapeOf, type MountShape, type Swatch } from './mountLook';
import { mergeMeshes, type MeshData, type Pack } from './pack';
import { RigAnim, rigAnimOf, type ExtraJoint } from './toon';

/**
 * A mount made up from its animal: the file's colors moved onto the mount's own, then what it wears. Blankets, girths
 * and barding are cut from the animal's own surface (the part of its skin in a region, raised a little), so they fit
 * it and bend with it. What stands off it (a saddle's seat, a boar's tusks, a drake's horns and wings) is built here
 * and tied to a joint.
 */

export interface MountModel {
  shape: MountShape;
  mesh: MeshData;
  rig: RigAnim;
  /** The joint under the saddle. */
  joint: number;
}

/** The colors in the file moved onto the mount's own. */
function repainted(m: MeshData, def: MountDef, shape: MountShape, extra?: Record<string, Swatch>): MeshData {
  const named = (s: Swatch): C => rgb(s === 'coat' ? def.coat : s === 'mane' ? def.mane : s === 'tack' ? def.tack : s === 'barding' ? (def.barding ?? def.tack) : s);
  const table = new Map(Object.entries({ ...shape.paint, ...extra }).map(([k, s]) => [k, named(s)]));
  const zones = (shape.zones ?? []).map((z) => ({ ...z, c: named(z.to) }));
  const col = new Uint8Array(m.col);
  for (let v = 0; v < m.n; v++) {
    const key = swatchKey(col[v * 3]!, col[v * 3 + 1]!, col[v * 3 + 2]!);
    let to = table.get(key);
    for (const z of zones) if (z.key === key && m.pos[v * 3 + 2]! >= z.z0 && m.pos[v * 3 + 2]! <= z.z1) to = z.c;
    if (!to) continue;
    col[v * 3] = to[0]! * 255;
    col[v * 3 + 1] = to[1]! * 255;
    col[v * 3 + 2] = to[2]! * 255;
  }
  return { ...m, col };
}

/** The saddle's seat, front and back, and the irons, in a horse's units, with its origin on top of the animal's back. */
function buildSaddle(tack: string, backW: number, drop: number): Build {
  const b = new Build();
  const leather = mul(rgb(tack), 0.72);
  const dark = mul(leather, 0.6);
  const edge = mix(leather, rgb('#e8d8b0'), 0.18);
  const w = backW;
  b.box(-w * 0.66, -0.24, w * 0.66, 0.22, -0.02, 0.045, leather, dark, mul(leather, 1.08));
  // the low rise in front of the rider, and a curved one behind
  b.box(-w * 0.42, 0.17, w * 0.42, 0.29, -0.02, 0.095, leather, dark, edge);
  b.box(-w * 0.34, -0.33, w * 0.34, -0.23, -0.02, 0.135, leather, dark, edge);
  for (const side of [1, -1]) b.box(side > 0 ? w * 0.3 : -w * 0.62, -0.31, side > 0 ? w * 0.62 : -w * 0.3, -0.22, -0.02, 0.09, leather, dark, edge);
  // straps down to the irons
  for (const side of [1, -1]) {
    const x = side * (w + 0.015);
    b.box(x - 0.012, 0.02, x + 0.012, 0.07, -drop, 0.0, dark, dark, dark);
    b.box(x - 0.038, 0.0, x + 0.038, 0.09, -drop - 0.05, -drop, rgb('#b8bcc4'), rgb('#70747c'), rgb('#d8dce4'));
  }
  return b;
}

/** A thin strip between two points on two joints (a rein, a chain): seen from any side. */
function strip(out: Part, a: readonly number[], ja: number, b: readonly number[], jb: number, w: number, color: C): void {
  const put = (p: readonly number[], x: number, j: number, ny: number): number => out.corner([p[0]! + x, p[1]!, p[2]!, 0, ny, 0, 0, ny, 0, j, j, 255], color);
  for (const ny of [1, -1]) {
    const i0 = put(a, -w, ja, ny);
    const i1 = put(a, w, ja, ny);
    const i2 = put(b, w, jb, ny);
    const i3 = put(b, -w, jb, ny);
    if (ny > 0) out.idx.push(i0, i2, i1, i0, i3, i2);
    else out.idx.push(i0, i1, i2, i0, i2, i3);
  }
}

/** How high the animal's top is at a point along it, and who carries that part of it. */
function topAt(m: MeshData, z: number, reach: number, w: number): { y: number; j: number } | null {
  let best = -Infinity;
  let j = -1;
  for (let v = 0; v < m.n; v++) {
    if (Math.abs(m.pos[v * 3 + 2]! - z) > reach || Math.abs(m.pos[v * 3]!) > w) continue;
    if (m.pos[v * 3 + 1]! > best) {
      best = m.pos[v * 3 + 1]!;
      j = m.skin![v * 3]!;
    }
  }
  return j < 0 ? null : { y: best, j };
}

/* ------------------------------------------------------------------ horses */

function horseParts(base: MeshData, def: MountDef, shape: MountShape, joint: number, rig: RigAnim): MeshData[] {
  const parts: MeshData[] = [];
  const coat = new Set(coatKeysOf(base));
  const { seatZ: sz, seatY: sy, hemY } = shape;
  const J = (name: string): number => rig.joints.indexOf(name);
  if (shape.saddled) {
    if (def.blaze) parts.push(shell(base, [within(0.045), above(1.5), ...between(1.22, 1.62)], 0.012, rgb('#f4efe2'), coat));
    return parts;
  }
  const blanket = rgb(def.tack);
  const hemC = mix(blanket, rgb('#f0e0b0'), 0.55);
  if (def.barding) {
    // a caparison, cut in scallops along its hem, front to back; a plate down the face, with a spike
    const cloth = rgb(def.barding);
    const trim = blanket;
    const hem: Inside = (_x, y, z) => y - (1.1 + Math.cos(z * 15) * 0.035);
    const band: Inside = (_x, y, z) => 1.17 + Math.cos(z * 15) * 0.035 - y;
    parts.push(shell(base, [hem, ...between(-0.9, 0.7)], 0.02, (_x, y) => mul(cloth, 0.86 + (y - 1.1) * 0.26), coat));
    parts.push(shell(base, [hem, band, ...between(-0.9, 0.7)], 0.032, trim, coat));
    parts.push(shell(base, [hem, ...between(0.64, 0.7)], 0.032, trim, coat));
    parts.push(shell(base, [hem, ...between(-0.9, -0.84)], 0.032, trim, coat));
    parts.push(shell(base, [within(0.11), above(1.54), ...between(1.14, 1.5)], 0.018, trim, coat));
    parts.push(rod([0, 1.98, 1.24], [0, 2.24, 1.42], 0.05, 0, 5, trim, mix(trim, [1, 1, 1], 0.5), J('head') >= 0 ? J('head') : joint, base.rig));
  } else {
    parts.push(shell(base, [above(hemY), ...between(sz - 0.42, sz + 0.34)], 0.03, blanket, coat));
    // its border, at the hem and front and back
    parts.push(shell(base, [above(hemY), below(hemY + 0.05), ...between(sz - 0.42, sz + 0.34)], 0.04, hemC, coat));
    parts.push(shell(base, [above(hemY), ...between(sz - 0.42, sz - 0.37)], 0.04, hemC, coat));
    parts.push(shell(base, [above(hemY), ...between(sz + 0.29, sz + 0.34)], 0.04, hemC, coat));
  }
  // the girth, round the belly
  parts.push(shell(base, [...between(sz + 0.04, sz + 0.11), below(hemY + 0.02)], 0.03, mul(blanket, 0.55), coat));
  // the seat
  parts.push(tied(buildSaddle(def.barding ? '#3a2a20' : def.tack, shape.backW, 0.42), joint, 1, [0, sy + 0.02, sz], base.rig));
  // the bridle: a noseband and a strap behind the cheek
  const strapC = mul(blanket, 0.7);
  parts.push(shell(base, [above(1.45), ...between(1.42, 1.47)], 0.014, strapC, coat));
  parts.push(shell(base, [above(1.5), ...between(1.17, 1.22)], 0.014, strapC, coat));
  // the reins, from the bit back to the rider's hands
  const reins = new Part();
  const head = J('head') >= 0 ? J('head') : joint;
  for (const side of [1, -1]) strip(reins, [side * 0.1, 1.58, 1.42], head, [side * 0.06, sy + 0.2, sz + 0.34], joint, 0.012, strapC);
  parts.push(reins.data(base.rig));
  if (def.blaze) parts.push(shell(base, [within(0.045), above(1.5), ...between(1.22, 1.62)], 0.012, rgb('#f4efe2'), coat));
  if (def.socks) parts.push(shell(base, [below(0.34)], 0.012, rgb('#f0ece0'), coat));
  return parts;
}

/* ------------------------------------------------------------------ harts */

function deerParts(base: MeshData, def: MountDef, shape: MountShape, joint: number): MeshData[] {
  const parts: MeshData[] = [];
  const hide = new Set([...coatKeysOf(base), '866844', 'b8a993']);
  const { seatZ: sz, seatY: sy, hemY } = shape;
  const blanket = rgb(def.tack);
  const hemC = mix(blanket, rgb('#f0e0b0'), 0.55);
  const u = 21 / shape.px;
  parts.push(shell(base, [above(hemY), ...between(sz - 0.85, sz + 0.72)], 0.05, blanket, hide));
  parts.push(shell(base, [above(hemY), below(hemY + 0.1), ...between(sz - 0.85, sz + 0.72)], 0.07, hemC, hide));
  parts.push(shell(base, [above(hemY), ...between(sz - 0.85, sz - 0.75)], 0.07, hemC, hide));
  parts.push(shell(base, [above(hemY), ...between(sz + 0.62, sz + 0.72)], 0.07, hemC, hide));
  parts.push(shell(base, [...between(sz + 0.1, sz + 0.25), below(hemY + 0.04)], 0.05, mul(blanket, 0.55), hide));
  parts.push(tied(buildSaddle(def.tack, shape.backW / u, 0.4), joint, u, [0, sy + 0.03, sz], base.rig));
  return parts;
}

/* ------------------------------------------------------------------ boars */

/** A bull's bones with a boar's shape: short in the body, high in the shoulder, the head carried low. */
function boarBody(base: MeshData): MeshData {
  return warped(base, (p) => {
    const z = p.z;
    const up = smooth(1.2, 3.0, p.y);
    const hump = Math.exp(-(((z - 1.2) / 1.1) ** 2)) * 0.42;
    const rump = -0.3 * smooth(-0.5, -2.2, z);
    const head = -0.52 * smooth(2.3, 3.5, z);
    p.y += (hump + rump) * up + head;
    p.z = z * 0.74;
    p.x *= 1.22;
  });
}

function boarParts(base: MeshData, def: MountDef, shape: MountShape, joint: number, rig: RigAnim): MeshData[] {
  const parts: MeshData[] = [];
  const hide = new Set(coatKeysOf(base));
  const { seatZ: sz, seatY: sy, hemY } = shape;
  const u = 21 / shape.px;
  const blanket = rgb(def.tack);
  const hemC = mix(blanket, rgb('#f0e0b0'), 0.5);
  const J = (name: string): number => rig.joints.indexOf(name);
  const head = J('Head');
  const mane = rgb(def.mane);
  const ivory = rgb('#efe6cc');
  const root = mul(ivory, 0.72);
  if (def.barding) {
    const steel = mul(rgb(def.barding), 0.92);
    const edge = mul(rgb(def.tack), 1.15);
    const rows = (_x: number, _y: number, z: number): C => mul(steel, Math.floor(z * 6) % 2 ? 1 : 0.78);
    parts.push(shell(base, [above(2.75), ...between(0.32, 1.6)], 0.05, rows, hide));
    parts.push(shell(base, [above(2.75), below(2.9), ...between(0.32, 1.6)], 0.075, edge, hide));
    parts.push(shell(base, [above(3.1), ...between(-1.95, -0.9)], 0.05, rows, hide));
    parts.push(shell(base, [above(3.1), below(3.25), ...between(-1.95, -0.9)], 0.075, edge, hide));
    // a brow plate with a spike
    parts.push(rod([0, 3.5, 2.75], [0, 4.25, 2.55], 0.22, 0, 5, steel, mix(steel, [1, 1, 1], 0.5), head, base.rig));
  }
  // the blanket
  parts.push(shell(base, [above(hemY), ...between(sz - 0.7, sz + 0.62)], def.barding ? 0.08 : 0.05, blanket, hide));
  parts.push(shell(base, [above(hemY), below(hemY + 0.13), ...between(sz - 0.7, sz + 0.62)], def.barding ? 0.1 : 0.075, hemC, hide));
  parts.push(tied(buildSaddle(def.tack, shape.backW / u, 0.22), joint, u, [0, sy + 0.04, sz], base.rig));

  // tusks out of the jaw, curving up
  for (const side of [1, -1]) {
    parts.push(rod([side * 0.52, 2.5, 3.15], [side * 0.72, 3.0, 3.42], 0.17, 0.13, 6, root, ivory, head, base.rig));
    parts.push(rod([side * 0.72, 3.0, 3.42], [side * 0.8, 3.56, 3.34], 0.13, 0, 6, ivory, mix(ivory, [1, 1, 1], 0.5), head, base.rig));
  }
  // a snout, flat at the end
  const nose = mul(rgb(def.coat), 0.5);
  parts.push(rod([0, 2.86, 3.34], [0, 2.84, 3.86], 0.5, 0.42, 8, nose, mul(nose, 0.7), head, base.rig));

  // bristles from the brow back down the spine, broken by the saddle
  const tip = mix(mane, rgb('#a89878'), 0.35);
  for (let z = 2.3; z > -2.05; z -= 0.27) {
    if (z < sz + 0.75 && z > sz - 0.82) continue;
    const top = topAt(base, z, 0.2, 0.6);
    if (!top) continue;
    const tall = 0.62 + Math.sin(z * 4.3) * 0.12 + 0.3 * smooth(0.2, 1.2, z) * (1 - smooth(1.8, 2.4, z));
    parts.push(blade(z, top.y - 0.08, tall, 0.5, 0.1, mane, tip, top.j, base.rig));
  }
  return parts;
}

/* ------------------------------------------------------------------ drakes */

/** Where a wing joins the shoulders and where its elbow is, in the model's units. */
const SHOULDER = new THREE.Vector3(175, 1205, 560);
const ELBOW = new THREE.Vector3(800, 1640, 500);

/** How a wing moves: its beat and how far it's folded, from a clip's point in its loop. */
function wingAngles(clip: string | null, phase: number): { arm: number; sweep: number; hand: number; fold: number } {
  const a = phase * Math.PI * 2;
  switch (clip) {
    case 'run':
      return { arm: 0.3 + Math.sin(a) * 0.48, sweep: 0.22 + Math.cos(a) * 0.1, hand: -0.28 + Math.sin(a - 0.9) * 0.46, fold: 0.1 };
    case 'walk':
      return { arm: 0.46 + Math.sin(a) * 0.16, sweep: 0.62, hand: -0.7 + Math.sin(a - 0.7) * 0.14, fold: 0.5 };
    case 'chop':
    case 'die':
      return { arm: 0.5, sweep: 0.3, hand: -0.3, fold: 0.2 };
    default:
      // folded along the flanks, breathing
      return { arm: 0.34 + Math.sin(a) * 0.03, sweep: 1.0, hand: -1.2 + Math.sin(a + 0.6) * 0.03, fold: 1.05 };
  }
}

const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/** The two joints of one wing. */
function wingJoints(side: 1 | -1, parent: string): ExtraJoint[] {
  const shoulder = new THREE.Vector3(SHOULDER.x * side, SHOULDER.y, SHOULDER.z);
  const elbow = new THREE.Vector3(ELBOW.x * side, ELBOW.y, ELBOW.z);
  const tmpA = new THREE.Matrix4();
  const tmpB = new THREE.Matrix4();
  const armOf = (clip: string | null, phase: number, out: THREE.Matrix4): void => {
    if (clip === null) {
      out.identity();
      return;
    }
    const w = wingAngles(clip, phase);
    out.makeTranslation(shoulder.x, shoulder.y, shoulder.z);
    out.multiply(tmpA.makeRotationAxis(AXIS_Y, side * w.sweep));
    out.multiply(tmpA.makeRotationAxis(AXIS_Z, side * w.arm));
    out.multiply(tmpA.makeTranslation(-shoulder.x, -shoulder.y, -shoulder.z));
  };
  const name = side > 0 ? 'l' : 'r';
  return [
    { name: `wing.${name}`, parent, pose: armOf },
    {
      name: `hand.${name}`,
      parent,
      pose: (clip, phase, out) => {
        armOf(clip, phase, out);
        if (clip === null) return;
        const w = wingAngles(clip, phase);
        out.multiply(tmpB.makeTranslation(elbow.x, elbow.y, elbow.z));
        out.multiply(tmpA.makeRotationAxis(AXIS_Y, side * w.fold));
        out.multiply(tmpA.makeRotationAxis(AXIS_Z, side * w.hand));
        out.multiply(tmpB.makeTranslation(-elbow.x, -elbow.y, -elbow.z));
      },
    },
  ];
}

const DRAKE_JOINTS = [...wingJoints(1, 'Shoulders'), ...wingJoints(-1, 'Shoulders')];

/** One wing: a thin arm and fingers, and a skin between them cut in scallops. Its points are for the left side. */
function wingPart(side: 1 | -1, jArm: number, jHand: number, skin: C, bone: C, rig?: string): MeshData {
  const out = new Part();
  const X = (p: readonly number[]): number[] => [p[0]! * side, p[1]!, p[2]!];
  const S = SHOULDER.toArray();
  const E = ELBOW.toArray();
  const W = [1340, 1520, 330];
  const F1 = [2040, 1120, -60];
  const F2 = [1600, 760, -470];
  const F3 = [1020, 700, -610];
  const R = [190, 1130, -60];
  const sc = (a: number[], b: number[], to: number[], k: number): number[] => [(a[0]! + b[0]!) / 2 + (to[0]! - (a[0]! + b[0]!) / 2) * k, (a[1]! + b[1]!) / 2 + (to[1]! - (a[1]! + b[1]!) / 2) * k, (a[2]! + b[2]!) / 2 + (to[2]! - (a[2]! + b[2]!) / 2) * k];
  const near = mul(skin, 0.74);
  const far = mix(skin, [1, 1, 1], 0.06);
  /** A triangle of skin, on both of its sides. Each corner: its point, the joint(s) that carry it, its color. */
  const tri = (a: number[], ja: readonly number[], ca: C, b: number[], jb: readonly number[], cb: C, c: number[], jc: readonly number[], cc: C): void => {
    const ax = X(a);
    const bx = X(b);
    const cx = X(c);
    const e1 = new THREE.Vector3(bx[0]! - ax[0]!, bx[1]! - ax[1]!, bx[2]! - ax[2]!);
    const e2 = new THREE.Vector3(cx[0]! - ax[0]!, cx[1]! - ax[1]!, cx[2]! - ax[2]!);
    const n = e1.cross(e2).normalize();
    for (const flip of [1, -1]) {
      const c0 = (p: number[], j: readonly number[]): Corner => [p[0]!, p[1]!, p[2]!, n.x * flip, n.y * flip, n.z * flip, n.x * flip, n.y * flip, n.z * flip, j[0]!, j[1]!, j[2]!];
      const i0 = out.corner(c0(ax, ja), ca);
      const i1 = out.corner(c0(bx, jb), cb);
      const i2 = out.corner(c0(cx, jc), cc);
      if (flip > 0) out.idx.push(i0, i1, i2);
      else out.idx.push(i0, i2, i1);
    }
  };
  const A = [jArm, jArm, 255] as const;
  const H = [jHand, jHand, 255] as const;
  const B = [jArm, jHand, 128] as const;
  const s12 = sc(F1, F2, W, 0.2);
  const s23 = sc(F2, F3, E, 0.2);
  const s3R = sc(F3, R, S, 0.28);
  // the hand: from the wrist out to its first two fingers, then back to the elbow
  tri(W, H, far, F1, H, far, s12, H, far);
  tri(W, H, far, s12, H, far, F2, H, far);
  tri(E, B, near, W, H, far, F2, H, far);
  tri(E, B, near, F2, H, far, s23, H, far);
  tri(E, B, near, s23, H, far, F3, B, far);
  // the arm: back to the shoulders and the flank
  tri(S, A, near, E, B, near, F3, B, far);
  tri(S, A, near, F3, B, far, s3R, A, near);
  tri(S, A, near, s3R, A, near, R, A, near);
  const dim = mul(bone, 0.78);
  const parts = [
    out.data(rig),
    rod(X(S), X(E), 62, 42, 5, dim, bone, jArm, rig),
    rod(X(E), X(W), 40, 28, 5, dim, bone, jHand, rig),
    rod(X(W), X(F1), 27, 5, 5, dim, bone, jHand, rig),
    rod(X(W), X(F2), 24, 5, 5, dim, bone, jHand, rig),
    rod(X(E), X(F3), 24, 5, 5, dim, bone, jHand, rig),
    // the claw at the wrist
    rod(X(W), X([W[0]! + 60, W[1]! + 190, W[2]! + 70]), 26, 0, 5, dim, bone, jHand, rig),
  ];
  return mergeMeshes(parts);
}

/** Up from a lizard's stoop: the neck rises in a curve, the head comes down in size, the waist in. */
function drakeBody(base: MeshData): MeshData {
  const cz = 946;
  const cy = 1309;
  return warped(base, (p) => {
    const n = smooth(560, 1020, p.z);
    const h = smooth(900, 1080, p.z);
    p.x *= 1 - 0.14 * (1 - smooth(120, 520, Math.abs(p.z - 200)));
    const k = 1 - 0.2 * h;
    p.x *= k;
    p.y = cy + (p.y - cy) * k;
    p.z = cz + (p.z - cz) * k;
    p.y += n * 430;
    p.z += n * 170;
  });
}

function drakeParts(base: MeshData, def: MountDef, shape: MountShape, joint: number, rig: RigAnim): MeshData[] {
  const parts: MeshData[] = [];
  const coat = rgb(def.coat);
  const wings = rgb(def.mane);
  const tack = rgb(def.tack);
  const glow = rgb(def.glow?.color ?? '#ffffff');
  const J = (name: string): number => rig.joints.indexOf(name);
  const head = J('Head');
  const u = 21 / shape.px;
  const { seatZ: sz, seatY: sy, hemY } = shape;
  const horn = mix(coat, rgb('#efe6cc'), 0.62);

  // the saddle: a blanket, a band round the chest, the seat
  const body = new Set(coatKeysOf(base));
  parts.push(shell(base, [above(hemY), ...between(sz - 230, sz + 210)], 12, mul(tack, 1.1), body));
  parts.push(shell(base, [above(hemY), below(hemY + 40), ...between(sz - 230, sz + 210)], 18, mix(tack, glow, 0.55), body));
  parts.push(shell(base, [...between(sz + 60, sz + 110), below(hemY + 20)], 12, mul(tack, 0.7), body));
  parts.push(tied(buildSaddle(def.tack, (shape.backW * 0.72) / u, 0.3), joint, u, [0, sy + 6, sz], base.rig));

  // horns, swept back from the brow, and smaller ones at the jaw
  const top = base.max[1];
  const hz = 1090;
  for (const side of [1, -1]) {
    parts.push(rod([side * 62, top - 80, hz], [side * 88, top + 30, hz - 110], 40, 25, 6, mul(horn, 0.78), horn, head, base.rig));
    parts.push(rod([side * 88, top + 30, hz - 110], [side * 112, top + 96, hz - 260], 25, 0, 6, horn, mix(horn, [1, 1, 1], 0.3), head, base.rig));
    parts.push(rod([side * 96, top - 230, hz + 40], [side * 170, top - 170, hz - 80], 24, 0, 5, mul(horn, 0.82), horn, head, base.rig));
  }

  // blades, from the head down the neck, broken by the saddle, on down to the tail
  for (let z = 1030; z > -1560; z -= 112) {
    if (z < sz + 250 && z > sz - 270) continue;
    const at = topAt(base, z, 80, 90);
    if (!at) continue;
    const tall = 150 * (0.42 + 0.6 * smooth(-1560, -500, z) * (1 - 0.42 * smooth(560, 1000, z)));
    parts.push(blade(z, at.y - 12, tall, 150, 22, mix(coat, wings, 0.45), wings, at.j, base.rig));
  }

  // a fin at the tail's end
  const tailEnd = J('Tail5');
  if (tailEnd >= 0) {
    const fin = new Part();
    const z0 = base.min[2];
    const y = (topAt(base, z0 + 40, 120, 100)?.y ?? 900) - 30;
    const pts: number[][] = [
      [0, y, z0 + 90],
      [150, y + 8, z0 - 70],
      [0, y + 4, z0 - 230],
      [-150, y + 8, z0 - 70],
    ];
    for (const flip of [1, -1]) {
      const ids = pts.map((p) => fin.corner([p[0]!, p[1]!, p[2]!, 0, flip, 0, 0, flip, 0, tailEnd, tailEnd, 255], wings));
      if (flip > 0) fin.idx.push(ids[0]!, ids[1]!, ids[2]!, ids[0]!, ids[2]!, ids[3]!);
      else fin.idx.push(ids[0]!, ids[2]!, ids[1]!, ids[0]!, ids[3]!, ids[2]!);
    }
    parts.push(fin.data(base.rig));
  }

  // the wings
  const bone = mul(coat, 0.86);
  parts.push(wingPart(1, J('wing.l'), J('hand.l'), wings, bone, base.rig));
  parts.push(wingPart(-1, J('wing.r'), J('hand.r'), wings, bone, base.rig));

  // eyes that burn
  const eyes = new Build();
  for (const side of [1, -1]) eyes.box(side * 84 - 15, hz + 70, side * 84 + 15, hz + 120, top - 165, top - 135, glow, glow, glow);
  parts.push(tied(eyes, head, 1, [0, 0, 0], base.rig));
  return parts;
}

/** A drake's own coat: dark along its back, paler down its belly and throat. */
function drakeCoat(m: MeshData, def: MountDef): MeshData {
  const coat = rgb(def.coat);
  const wings = rgb(def.mane);
  const belly = mix(mix(coat, wings, 0.32), [1, 1, 1], 0.2);
  const claw = mul(coat, 0.42);
  const col = new Uint8Array(m.col);
  for (let v = 0; v < m.n; v++) {
    const key = swatchKey(col[v * 3]!, col[v * 3 + 1]!, col[v * 3 + 2]!);
    let c: C = coat;
    if (key === 'b2b2b2') c = belly;
    else if (key === '787878') c = claw;
    else if (key === 'd2d2d2') c = mul(coat, 1.12);
    else if (key === '949494') c = mul(coat, 0.86);
    col[v * 3] = Math.min(255, c[0]! * 255);
    col[v * 3 + 1] = Math.min(255, c[1]! * 255);
    col[v * 3 + 2] = Math.min(255, c[2]! * 255);
  }
  return { ...m, col };
}

/* ------------------------------------------------------------------ all together */

const rigs = new Map<string, RigAnim>();
function rigOf(pack: Pack, kit: string, body: MountDef['body']): RigAnim {
  if (body !== 'drake') return rigAnimOf(pack, pack.meshes.body!.rig!);
  let r = rigs.get(kit);
  if (!r) {
    r = new RigAnim(pack.rigs[pack.meshes.body!.rig!]!, pack.bin, DRAKE_JOINTS);
    rigs.set(kit, r);
  }
  return r;
}

const models = new Map<string, MountModel>();

/** A mount's model, made once. */
export function mountModel(def: MountDef, pack: Pack): MountModel {
  const hit = models.get(def.id);
  if (hit) return hit;
  const shape = shapeOf(def);
  const rig = rigOf(pack, shape.kit, def.body);
  const joint = Math.max(0, rig.joints.indexOf(shape.joint));
  let body = pack.meshes.body!;
  if (shape.without) body = withoutParts(body, new Set(shape.without));
  let parts: MeshData[];
  // (what's cut from its skin is cut first: it goes by the file's colors)
  if (def.body === 'drake') {
    body = drakeBody(body);
    parts = drakeParts(body, def, shape, joint, rig);
    body = drakeCoat(body, def);
  } else if (def.body === 'boar') {
    body = boarBody(body);
    parts = boarParts(body, def, shape, joint, rig);
    body = repainted(body, def, shape);
  } else if (def.body === 'deer') {
    parts = deerParts(body, def, shape, joint);
    body = repainted(body, def, shape, { '352d22': def.antlers === 'elk' ? '#a89878' : def.glow ? '#efe8d0' : '#5a4630' });
  } else {
    parts = horseParts(body, def, shape, joint, rig);
    const sheets = shape.hair?.length ? otherSides(body, new Set(shape.hair)) : null;
    body = repainted(body, def, shape);
    if (sheets) parts.push(repainted(sheets, def, shape));
  }
  const mesh = mergeMeshes([body, ...parts]);
  mesh.min = [body.min[0], body.min[1], body.min[2]];
  mesh.max = [body.max[0], body.max[1], body.max[2]];
  const model: MountModel = { shape, mesh, rig, joint };
  models.set(def.id, model);
  return model;
}
