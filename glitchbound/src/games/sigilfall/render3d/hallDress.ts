import * as THREE from 'three';
import { Build, mul, type C } from './build';
import { Stand } from './crowd';
import { hexRgb } from './kits';
import type { LandPacks } from './land';
import type { Mesher } from './land';
import { seeded } from './ringFloor';
import type { Stage } from './stage';
import { LIGHT } from './toon';

/**
 * The Sigil-wardens' sanctum, the night it all comes due: a nave of great columns going back into the dark, the rose
 * window the one real light in it, two hooded wardens as tall as the wall keeping their watch, the seven-pointed star
 * of the broken crown let into a floor polished enough to hold the window's colors, and the Ash Crown's violet
 * grieflight coming up through the cracks. Everything's lit once, as it's built, by the window and a few low fires.
 */

const rgb = hexRgb;
const BACK = -9;
/** The nave's half width, to the faces of the columns. */
const NAVE = 5.7;
const ROSE = { x: 0, y: 3.62, z: BACK + 0.04, r: 1.9 };

export const GLASS = ['#7fb8ff', '#c58bff', '#ff8ac4', '#ffd36b', '#8ae0ff', '#a48bdc'];

export interface HallFire {
  x: number;
  y: number;
  z: number;
  size: number;
}

/** Where the fires stand: bowls down each side of the nave. */
const BOWLS: HallFire[] = [-1, 1].flatMap((s) => [
  { x: s * 4.5, y: 2.0, z: -0.9, size: 0.72 },
  { x: s * 4.7, y: 2.0, z: -5.1, size: 0.62 },
]);

/* ------------------------------------------------------------------ light, baked in */

/**
 * What light reaches each corner of what was built: a cold dimness, the window's light from behind it all, and the
 * warmth of the fires near them; the higher it goes the less of anything gets there.
 */
function bake(m: Mesher): void {
  const fires = BOWLS;
  const n = m.pos.length / 3;
  for (let i = 0; i < n; i++) {
    const x = m.pos[i * 3]!;
    const y = m.pos[i * 3 + 1]!;
    const z = m.pos[i * 3 + 2]!;
    const nx = m.nor[i * 3]!;
    const ny = m.nor[i * 3 + 1]!;
    const nz = m.nor[i * 3 + 2]!;
    let r = 0.17;
    let g = 0.15;
    let b = 0.27;
    // the window, on what turns toward it; and a wash of its light round it on the wall it's in
    const wx = ROSE.x - x;
    const wy = ROSE.y - y;
    const wz = ROSE.z + 1.2 - z;
    const wd = Math.hypot(wx, wy, wz) || 1;
    const facing = Math.max(0.1, (wx * nx + wy * ny + wz * nz) / wd);
    const wk = Math.min(0.72, (facing * 4.2) / (1 + wd * wd * 0.12));
    r += wk * 0.42;
    g += wk * 0.52;
    b += wk * 0.9;
    // the long fall of cold light down the middle of the hall, on what looks up at it
    const beam = Math.exp(-(x * x) / 5) * Math.max(0, 1 - y / 6) * (ny > 0.5 ? 0.62 : 0.1);
    r += beam * 0.5;
    g += beam * 0.62;
    b += beam * 0.95;
    for (const f of fires) {
      const dx = f.x - x;
      const dy = f.y + 0.3 - y;
      const dz = f.z - z;
      const d = Math.hypot(dx, dy, dz) || 1;
      const lam = Math.max(0.08, (dx * nx + dy * ny + dz * nz) / d);
      const k = (lam * 1.9) / (1 + d * d * 0.42);
      r += k * 1.1;
      g += k * 0.44;
      b += k * 0.14;
    }
    // grieflight, low down, coming up from the cracks
    const low = Math.max(0, 1 - y / 1.5);
    r += low * 0.05;
    g += low * 0.012;
    b += low * 0.09;
    // the dark gathering overhead
    const up = Math.min(1, Math.max(0, (y - 2.5) / 3.6));
    const fade = 1 - up * up * (3 - 2 * up) * 0.9;
    m.col[i * 3] = m.col[i * 3]! * r * fade;
    m.col[i * 3 + 1] = m.col[i * 3 + 1]! * g * fade;
    m.col[i * 3 + 2] = m.col[i * 3 + 2]! * b * fade;
  }
}

/* ------------------------------------------------------------------ shapes */

/** A pointed arch from its left spring over to its right (x, y). */
function pointed(cx: number, w: number, y: number, n = 7): [number, number][] {
  const out: [number, number][] = [];
  const R = 2 * w;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - (i / n) * (Math.PI / 3);
    out.push([cx + w + Math.cos(a) * R, y + Math.sin(a) * R]);
  }
  for (let i = n - 1; i >= 0; i--) {
    const a = Math.PI - (i / n) * (Math.PI / 3);
    out.push([cx - w - Math.cos(a) * R, y + Math.sin(a) * R]);
  }
  return out;
}

/** A pointed opening filled in, looking south: from y0 up to its spring, then the point. */
function archFill(b: Build, cx: number, w: number, y0: number, y: number, z: number, c0: C, c1: C): void {
  b.faceS(cx - w, cx + w, z, y0, y, c0, c1);
  const pts = pointed(cx, w, y);
  const top = y + Math.sqrt(3) * w;
  const at = (py: number): number[] => {
    const k = Math.min(1, Math.max(0, (py - y) / (top - y)));
    return [c1[0]! + (c0[0]! - c1[0]!) * k * 0.3, c1[1]! + (c0[1]! - c1[1]!) * k * 0.3, c1[2]! + (c0[2]! - c1[2]!) * k * 0.3];
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const q = pts[i + 1]!;
    // (always counter-clockwise from the south, whichever side of the point it is)
    b.m.quad([cx, y, z], [cx, y, z], [q[0], q[1], z], [p[0], p[1], z], [0, 0, 1], c1, at(p[1]));
  }
}

/** A carved frame round a pointed opening, standing out of the wall. */
function archFrame(b: Build, cx: number, w: number, y0: number, y: number, z: number, thick: number, out: number, c: C, dark: C): void {
  const inner = pointed(cx, w, y);
  const outer = pointed(cx, w + thick, y);
  const zf = z + out;
  for (let i = 0; i < inner.length - 1; i++) {
    const a = inner[i]!;
    const d = inner[i + 1]!;
    const e = outer[i]!;
    const f = outer[i + 1]!;
    const mid = (a[1] + d[1]) / 2;
    const k = 1 - (mid - y) * 0.02;
    const col = mul(c, k);
    if (i < inner.length / 2 - 0.5) b.m.quad([a[0], a[1], zf], [d[0], d[1], zf], [f[0], f[1], zf], [e[0], e[1], zf], [0, 0, 1], col);
    else b.m.quad([a[0], a[1], zf], [e[0], e[1], zf], [f[0], f[1], zf], [d[0], d[1], zf], [0, 0, 1], col);
  }
  // the jambs, and their inner faces
  b.box(cx - w - thick, z, cx - w, zf, y0, y, c, dark, c);
  b.box(cx + w, z, cx + w + thick, zf, y0, y, c, dark, c);
}

/** A ring standing out of the wall, looking south: its face and its outer edge. */
function ringBand(b: Build, x: number, y: number, z: number, r0: number, r1: number, out: number, c: C, side: C, n = 48, turn = 0): void {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + turn;
    const a1 = ((i + 1) / n) * Math.PI * 2 + turn;
    const P = (a: number, r: number, zz: number): number[] => [x + Math.cos(a) * r, y + Math.sin(a) * r, zz];
    const nm = [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0];
    b.m.quad(P(a0, r0, z + out), P(a0, r1, z + out), P(a1, r1, z + out), P(a1, r0, z + out), [0, 0, 1], c);
    b.m.quad(P(a1, r1, z), P(a1, r1, z + out), P(a0, r1, z + out), P(a0, r1, z), nm, side, c);
    b.m.quad(P(a0, r0, z), P(a0, r0, z + out), P(a1, r0, z + out), P(a1, r0, z), [-nm[0]!, -nm[1]!, 0], side, c);
  }
}

/** One of the great columns: a clustered shaft on stepped feet, bound once, opening into its capital out of sight. */
function column(b: Build, x: number, z: number, stone: C, stoneD: C, gold: C): void {
  const hi = mul(stone, 1.16);
  b.post(x, z, 1.02, 1.02, 0, 0.2, 8, stoneD, stone, 0, 0, Math.PI / 8);
  b.post(x, z, 0.88, 0.76, 0.2, 0.52, 8, stone, hi, 0, 0, Math.PI / 8);
  // the shaft, in lengths so the light can fall down it
  for (let y = 0.52; y < 8; y += 0.9) {
    b.post(x, z, 0.6, 0.6, y, y + 0.9, 8, stone, stone, 0, 0, Math.PI / 8);
    for (const [dx, dz] of [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6], [0.43, 0.43], [-0.43, 0.43]] as const) {
      b.post(x + dx, z + dz, dx && dz ? 0.11 : 0.17, dx && dz ? 0.11 : 0.17, y, y + 0.9, 6, hi, hi);
    }
  }
  // a band of old gilt, and its capital
  b.post(x, z, 0.82, 0.82, 2.5, 2.66, 12, gold, mul(gold, 1.15));
  b.post(x, z, 0.72, 0.72, 2.66, 2.74, 12, stoneD, stone);
  b.post(x, z, 0.8, 1.14, 4.6, 5.1, 8, stone, hi, 0, 0, Math.PI / 8);
  b.post(x, z, 1.14, 1.14, 5.1, 5.34, 8, hi, hi, 0, 0, Math.PI / 8);
}

/**
 * A warden in stone, as tall as the wall: hooded, head bowed, hands folded on a greatsword planted point down. The
 * hood holds nothing but two cold points of light.
 */
function warden(b: Build, glass: Build, eyes: HallFire[], x: number, z: number, stone: C, stoneD: C, gold: C): void {
  const hi = mul(stone, 1.22);
  const lo = mul(stone, 0.8);
  // its plinth
  b.box(x - 1.3, z - 0.9, x + 1.3, z + 0.9, 0, 0.22, stone, stoneD, hi);
  b.box(x - 1.12, z - 0.78, x + 1.12, z + 0.78, 0.22, 0.62, lo, stoneD, hi);
  b.box(x - 1.16, z + 0.78, x + 1.16, z + 0.82, 0.38, 0.46, mul(gold, 0.55), mul(gold, 0.45), mul(gold, 0.55));
  const y0 = 0.62;
  // the robe: wide at the hem, narrowing, the shoulders under the cowl
  b.post(x, z, 1.0, 0.86, y0, y0 + 1.0, 9, stoneD, stone);
  b.post(x, z, 0.86, 0.72, y0 + 1.0, y0 + 2.0, 9, stone, stone);
  b.post(x, z, 0.72, 0.84, y0 + 2.0, y0 + 3.0, 9, stone, hi);
  b.post(x, z, 0.84, 0.36, y0 + 3.0, y0 + 3.36, 9, hi, stone);
  // long folds down it
  for (const [dx, dz, r] of [[-0.58, 0.54, 0.13], [-0.2, 0.84, 0.11], [0.24, 0.84, 0.12], [0.6, 0.52, 0.13], [-0.9, 0.05, 0.12], [0.9, 0.05, 0.12]] as const) {
    b.post(x + dx, z + dz, r, r * 0.45, y0, y0 + 2.2, 5, stoneD, hi, -dx * 0.22, -dz * 0.26);
  }
  // a hem of old gilt
  b.post(x, z, 1.03, 1.0, y0, y0 + 0.1, 9, gold, mul(gold, 1.1));
  // the arms, coming down and in to the sword's grip
  const handY = y0 + 2.42;
  const handZ = z + 0.92;
  for (const s of [-1, 1]) {
    b.post(x + s * 0.74, z + 0.18, 0.27, 0.2, y0 + 3.0, y0 + 2.5, 6, hi, stone, s * -0.04, 0.12);
    b.post(x + s * 0.68, z + 0.32, 0.22, 0.14, y0 + 2.52, handY, 6, stone, hi, s * -0.54, 0.6);
    // the sleeve's wide mouth
    b.post(x + s * 0.2, handZ - 0.08, 0.18, 0.2, handY - 0.08, handY + 0.05, 6, lo, stone);
  }
  // the greatsword
  const steel = rgb('#9a96b6');
  const steelD = rgb('#5c5880');
  b.box(x - 0.13, handZ - 0.05, x + 0.13, handZ + 0.05, 0.62, handY - 0.34, steel, steelD, steel);
  b.faceS(x - 0.018, x + 0.018, handZ + 0.054, 0.62, handY - 0.34, steelD);
  b.box(x - 0.62, handZ - 0.08, x + 0.62, handZ + 0.08, handY - 0.34, handY - 0.2, gold, mul(gold, 0.74), mul(gold, 1.15));
  b.post(x, handZ, 0.06, 0.06, handY - 0.2, handY + 0.34, 5, stoneD, stone);
  b.post(x, handZ, 0.13, 0.13, handY + 0.34, handY + 0.5, 6, gold, mul(gold, 1.2));
  // the cowl, leaning out over its hands, and the dark in it
  const lean = 0.34;
  const hy = y0 + 3.2;
  const hz = z + lean;
  b.post(x, z + 0.1, 0.6, 0.66, hy, hy + 0.56, 9, stone, hi, 0, lean * 0.6);
  b.post(x, hz, 0.66, 0.46, hy + 0.56, hy + 0.96, 9, hi, hi, 0, 0.06);
  b.post(x, hz + 0.06, 0.46, 0.08, hy + 0.96, hy + 1.28, 9, hi, stone, 0, -0.1);
  // its opening
  const fz = hz + 0.56;
  const dark = rgb('#07050f');
  b.m.quad([x - 0.27, hy + 0.2, fz], [x + 0.27, hy + 0.2, fz], [x + 0.34, hy + 0.64, fz], [x - 0.34, hy + 0.64, fz], [0, 0, 1], dark);
  b.m.quad([x - 0.34, hy + 0.64, fz], [x + 0.34, hy + 0.64, fz], [x + 0.18, hy + 0.9, fz], [x - 0.18, hy + 0.9, fz], [0, 0, 1], dark);
  // (its lip)
  b.m.quad([x - 0.42, hy + 0.6, fz + 0.02], [x - 0.34, hy + 0.6, fz + 0.02], [x - 0.16, hy + 0.98, fz + 0.02], [x - 0.22, hy + 0.98, fz + 0.02], [0, 0, 1], hi);
  b.m.quad([x + 0.34, hy + 0.6, fz + 0.02], [x + 0.42, hy + 0.6, fz + 0.02], [x + 0.22, hy + 0.98, fz + 0.02], [x + 0.16, hy + 0.98, fz + 0.02], [0, 0, 1], hi);
  // what's in it
  for (const s of [-1, 1]) {
    const ex = x + s * 0.125;
    const ey = hy + 0.5;
    glass.m.quad([ex - 0.045, ey - 0.03, fz + 0.012], [ex + 0.045, ey - 0.03, fz + 0.012], [ex + 0.03, ey + 0.035, fz + 0.012], [ex - 0.03, ey + 0.035, fz + 0.012], [0, 0, 1], [0.75, 0.95, 1.7]);
    eyes.push({ x: ex, y: ey, z: fz, size: 1 });
  }
}

/* ------------------------------------------------------------------ the floor */

/** Where the grieflight comes up: cracks run out from under the far wall and from where the Crown has touched. */
function paintCracks(): HTMLCanvasElement {
  const PX = 30;
  const X = 12;
  const Z0 = -9;
  const Z1 = 8;
  const c = document.createElement('canvas');
  c.width = X * 2 * PX;
  c.height = (Z1 - Z0) * PX;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.scale(PX, PX);
  g.translate(X, -Z0);
  const rand = seeded(909);
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  const run = (x0: number, z0: number, a0: number, len: number, w: number): void => {
    let x = x0;
    let z = z0;
    let a = a0;
    g.lineWidth = w;
    g.globalAlpha = 0.5 + w * 6;
    g.beginPath();
    g.moveTo(x, z);
    const steps = Math.ceil(len / 0.32);
    for (let i = 0; i < steps; i++) {
      a += (rand() - 0.5) * 1.0;
      x += Math.cos(a) * 0.32;
      z += Math.sin(a) * 0.32;
      g.lineTo(x, z);
      if (rand() < 0.2 && w > 0.018) {
        const px = x;
        const pz = z;
        g.stroke();
        run(px, pz, a + (rand() < 0.5 ? 1 : -1) * (0.5 + rand() * 0.8), len * 0.45, w * 0.62);
        g.lineWidth = w * (1 - (i / steps) * 0.5);
        g.globalAlpha = 0.5 + w * 6;
        g.beginPath();
        g.moveTo(px, pz);
      }
    }
    g.stroke();
  };
  for (const [x, z, a, l] of [[-2.7, -9, 1.3, 5.2], [2.8, -9, 1.75, 5.6], [-5.2, -9, 1.1, 4.4], [5.3, -9, 2.0, 4.2], [-5, -3, 0.5, 2.6], [5, -3.4, 2.6, 2.4], [-3.8, 2.4, -0.6, 2.8], [4, 1.8, 3.8, 3], [0.6, -9, 1.5, 3.4]] as const) {
    run(x, z, a, l, 0.06);
  }
  return c;
}

function paintFloor(): HTMLCanvasElement {
  const PX = 60;
  const X = 12;
  const Z0 = -9;
  const Z1 = 8;
  const c = document.createElement('canvas');
  c.width = X * 2 * PX;
  c.height = (Z1 - Z0) * PX;
  const g = c.getContext('2d')!;
  g.scale(PX, PX);
  g.translate(X, -Z0);
  const rand = seeded(77);
  const blot = (x: number, z: number, r: number, color: string, alpha: number, sy = 1): void => {
    const n = parseInt(color.slice(1), 16);
    const end = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0)`;
    g.save();
    g.translate(x, z);
    g.scale(1, sy);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, end);
    g.globalAlpha = alpha;
    g.fillStyle = grad;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
    g.globalAlpha = 1;
  };
  g.fillStyle = '#07060f';
  g.fillRect(-X, Z0, X * 2, Z1 - Z0);
  // lozenges of polished black stone, veined
  g.save();
  g.rotate(Math.PI / 4);
  const S = 1.42;
  for (let i = -16; i < 16; i++) {
    for (let j = -16; j < 16; j++) {
      const odd = (i + j) & 1;
      const j2 = rand() * 0.05;
      g.fillStyle = odd ? `rgb(${28 + j2 * 130},${25 + j2 * 130},${46 + j2 * 130})` : `rgb(${15 + j2 * 80},${13 + j2 * 80},${28 + j2 * 80})`;
      g.fillRect(i * S + 0.012, j * S + 0.012, S - 0.024, S - 0.024);
      g.fillStyle = 'rgba(255,255,255,0.03)';
      g.fillRect(i * S + 0.012, j * S + 0.012, S - 0.024, 0.03);
      if (rand() < 0.55) {
        g.strokeStyle = odd ? 'rgba(190,180,240,0.08)' : 'rgba(140,130,200,0.06)';
        g.lineWidth = 0.014;
        g.beginPath();
        let vx = i * S + rand() * S;
        let vz = j * S;
        g.moveTo(vx, vz);
        for (let k = 0; k < 5; k++) {
          vx += (rand() - 0.5) * 0.5;
          vz += S / 5;
          g.lineTo(vx, vz);
        }
        g.stroke();
      }
    }
  }
  g.restore();
  // the runners: from the far wall to the dais, and from the dais toward us, the color of old blood
  const runner = (x0: number, x1: number, z0: number, z1: number): void => {
    const grad = g.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, '#1f070c');
    grad.addColorStop(0.5, '#3f0f18');
    grad.addColorStop(1, '#1f070c');
    g.fillStyle = grad;
    g.fillRect(x0, z0, x1 - x0, z1 - z0);
    g.fillStyle = '#7a5a28';
    g.fillRect(x0 + 0.08, z0, 0.04, z1 - z0);
    g.fillRect(x1 - 0.12, z0, 0.04, z1 - z0);
    const mx = (x0 + x1) / 2;
    for (let z = z0 + 0.5; z < z1; z += 1) {
      g.fillStyle = '#7a5a28';
      g.globalAlpha = 0.6;
      g.beginPath();
      g.moveTo(mx, z - 0.3);
      g.lineTo(mx + 0.24, z);
      g.lineTo(mx, z + 0.3);
      g.lineTo(mx - 0.24, z);
      g.closePath();
      g.fill();
      g.fillStyle = '#2c0a11';
      g.globalAlpha = 1;
      g.beginPath();
      g.moveTo(mx, z - 0.16);
      g.lineTo(mx + 0.13, z);
      g.lineTo(mx, z + 0.16);
      g.lineTo(mx - 0.13, z);
      g.closePath();
      g.fill();
    }
  };
  runner(-1.1, 1.1, Z0, -2.5);
  runner(-1.35, 1.35, 2.6, Z1);
  // the seven-pointed star of the Crown Sigils, let into the floor in old gilt, a socket at each point
  const SEVEN = (i: number, r: number): [number, number] => {
    const a = -Math.PI / 2 + (i / 7) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  g.strokeStyle = '#a07c38';
  g.lineJoin = 'miter';
  g.globalAlpha = 0.85;
  g.lineWidth = 0.05;
  g.beginPath();
  for (let i = 0; i <= 7; i++) {
    const [x, z] = SEVEN((i * 3) % 7, 4.35);
    if (i === 0) g.moveTo(x, z);
    else g.lineTo(x, z);
  }
  g.stroke();
  g.globalAlpha = 1;
  g.lineWidth = 0.035;
  for (const r of [3.05, 4.5]) {
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const [x, z] = SEVEN(i, 4.35);
    g.fillStyle = '#100d1e';
    g.beginPath();
    g.arc(x, z, 0.3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#7a5a28';
    g.beginPath();
    g.moveTo(x, z - 0.2);
    g.lineTo(x + 0.11, z);
    g.lineTo(x, z + 0.2);
    g.lineTo(x - 0.11, z);
    g.closePath();
    g.fill();
  }
  // the far aisles fall away into the dark
  for (const s of [-1, 1]) {
    const x0 = s * (NAVE - 1.2);
    const x1 = s * X;
    const grad = g.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, 'rgba(3,2,8,0)');
    grad.addColorStop(0.3, 'rgba(3,2,8,0.72)');
    grad.addColorStop(1, 'rgba(3,2,8,0.96)');
    g.fillStyle = grad;
    g.fillRect(Math.min(x0, x1), Z0, Math.abs(x1 - x0), Z1 - Z0);
  }
  // and what the glass throws: its colors lying across the floor, stretched as they come to us
  g.globalCompositeOperation = 'lighter';
  const glassAt = (i: number): string => GLASS[i % GLASS.length]!;
  g.save();
  g.translate(0, -2.6);
  g.scale(1, 1.5);
  const N = 18;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = ((i + 0.86) / N) * Math.PI * 2;
    const grad = g.createRadialGradient(0, 0, 0.6, 0, 0, 3.7);
    const col = glassAt(i);
    const n = parseInt(col.slice(1), 16);
    grad.addColorStop(0, `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.02)`);
    grad.addColorStop(0.55, `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.17)`);
    grad.addColorStop(1, `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, 3.7, a0, a1);
    g.closePath();
    g.fill();
  }
  g.restore();
  // the window itself, shining in the polish all the way down the hall
  const shine = g.createLinearGradient(0, Z0, 0, 3);
  shine.addColorStop(0, 'rgba(170,185,255,0.3)');
  shine.addColorStop(0.5, 'rgba(130,150,235,0.11)');
  shine.addColorStop(1, 'rgba(120,140,230,0)');
  for (const [w, a] of [[3.2, 0.34], [1.9, 0.5], [0.9, 0.66]] as const) {
    g.globalAlpha = a;
    g.fillStyle = shine;
    g.beginPath();
    g.moveTo(-w * 0.9, Z0);
    g.lineTo(w * 0.9, Z0);
    g.lineTo(w, 3);
    g.lineTo(-w, 3);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;
  blot(0, Z0, 5, '#8c9cff', 0.16, 0.5);
  blot(0, 0, 3.4, '#a8b4ff', 0.17);
  // the low fires in it, each with a long red reflection coming our way
  for (const f of BOWLS) {
    blot(f.x, f.z, 2.6, '#d0501c', 0.26);
    blot(f.x, f.z + 1.4, 0.9, '#ff8038', 0.2, 2.8);
  }
  g.globalCompositeOperation = 'source-over';
  // what stands on it darkens it where it stands
  const foot = (x: number, z: number, r: number, a: number): void => blot(x, z, r, '#020106', a);
  for (const s of [-1, 1]) {
    for (const z of [1.0, -2.6, -6.2]) foot(s * NAVE, z, 2, 0.85);
    foot(s * 3.98, BACK + 1, 2, 0.6);
    for (const f of BOWLS) foot(f.x, f.z, 0.75, 0.5);
  }
  const wallFoot = g.createLinearGradient(0, Z0, 0, Z0 + 1.4);
  wallFoot.addColorStop(0, 'rgba(2,1,6,0.6)');
  wallFoot.addColorStop(1, 'rgba(2,1,6,0)');
  g.fillStyle = wallFoot;
  g.fillRect(-X, Z0, X * 2, 1.4);
  foot(0, 0, 3.1, 0.34);
  return c;
}

const floorFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uCracks;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vW;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec3 c = texture2D(uMap, vUv).rgb;
    // grieflight: the violet the Ash Crown leaves in what it has touched, breathing in the cracks
    float crack = texture2D(uCracks, vUv).r;
    if (crack > 0.01) {
      float breath = 0.72 + 0.28 * sin(uTime * 0.45 + vW.x * 0.3 + vW.z * 0.4);
      float run = 0.7 + 0.3 * noise(vW.xz * 1.6);
      c = mix(c, vec3(0.08, 0.02, 0.12), min(1.0, crack * 1.6));
      c += vec3(0.62, 0.2, 1.0) * crack * breath * run * 1.9;
    }
    // and a cold mist moving slowly along the floor
    vec2 p = vW.xz * vec2(0.55, 1.1);
    float n = noise(p + vec2(uTime * 0.03, uTime * 0.012)) * 0.7 + noise(p * 2.3 - vec2(uTime * 0.04, 0.0)) * 0.3;
    float m = smoothstep(0.45, 0.9, n);
    c += vec3(0.2, 0.22, 0.36) * m * 0.2;
    // (a grain too fine to see, so a slow fade doesn't show as steps)
    c += (hash(gl_FragCoord.xy) - 0.5) * 1.5 / 255.0;
    gl_FragColor = vec4(c, 1.0);
  }`;

function floorMesh(): THREE.Mesh {
  const texture = (canvas: HTMLCanvasElement): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = 8;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    return tex;
  };
  const geo = new THREE.PlaneGeometry(24, 17);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -0.5);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: texture(paintFloor()) }, uCracks: { value: texture(paintCracks()) }, uTime: LIGHT.uTime },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vW;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: floorFrag,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

/* ------------------------------------------------------------------ light that's there to be seen */

/** The stained glass: lights itself, its colors stirring a little as if something passed outside. */
const glassMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: LIGHT.uTime },
  vertexShader: /* glsl */ `
    attribute vec3 aCol;
    varying vec3 vCol;
    varying vec3 vP;
    void main() {
      vCol = aCol;
      vP = position;
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying vec3 vCol;
    varying vec3 vP;
    void main() {
      float w = sin(vP.x * 1.1 + uTime * 0.13) * sin(vP.y * 0.9 - uTime * 0.1);
      gl_FragColor = vec4(vCol * (1.0 + w * 0.05), 1.0);
    }`,
});

/**
 * Shafts and haloes: added to what's behind them, soft at their edges and perfectly still (the ash moves through them;
 * faint patterns moving in the light itself only crawl, a step of color at a time, on a dark screen).
 */
const shaftMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
  vertexShader: /* glsl */ `
    attribute vec3 aQ;
    attribute vec4 aTint;
    varying vec3 vQ;
    varying vec4 vTint;
    void main() {
      vQ = aQ;
      vTint = aTint;
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vQ;
    varying vec4 vTint;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      // (across and along a shape wider at one end than the other, without a crease down it)
      vec2 u = vQ.xy / vQ.z;
      float a;
      if (vTint.a < 0.0) {
        // a halo: round
        float d = length(u - 0.5) * 2.0;
        a = smoothstep(1.0, 0.0, d);
        a *= a * -vTint.a;
      } else {
        float edge = smoothstep(0.0, 0.34, u.x) * smoothstep(1.0, 0.66, u.x);
        float along = smoothstep(0.0, 0.1, u.y) * mix(0.42, 1.0, u.y);
        a = edge * along * vTint.a;
      }
      // (a grain too fine to see, so a slow fade doesn't show as steps)
      vec3 c = vTint.rgb * a + (hash(gl_FragCoord.xy) - 0.5) * (a > 0.002 ? 1.5 / 255.0 : 0.0);
      gl_FragColor = vec4(max(c, vec3(0.0)), 0.0);
    }`,
});

class Shafts {
  private readonly pos: number[] = [];
  private readonly q: number[] = [];
  private readonly tint: number[] = [];
  private readonly idx: number[] = [];

  /** Four corners, the first two at the far end (where it fades), the others where it comes from. */
  add(a: number[], b: number[], c: number[], d: number[], color: C, alpha: number): void {
    const v = this.pos.length / 3;
    this.pos.push(...a, ...b, ...c, ...d);
    const near = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!);
    const far = Math.hypot(c[0]! - d[0]!, c[1]! - d[1]!, c[2]! - d[2]!);
    this.q.push(0, 0, near, near, 0, near, far, far, far, 0, far, far);
    for (let i = 0; i < 4; i++) this.tint.push(color[0]!, color[1]!, color[2]!, alpha);
    this.idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }

  halo(x: number, y: number, z: number, r: number, color: C, strength: number): void {
    this.add([x - r, y - r, z], [x + r, y - r, z], [x + r, y + r, z], [x - r, y + r, z], color, -strength);
  }

  build(): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aQ', new THREE.Float32BufferAttribute(this.q, 3));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(this.tint, 4));
    g.setIndex(this.idx);
    const mesh = new THREE.Mesh(g, shaftMaterial);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    return mesh;
  }
}

/* ------------------------------------------------------------------ the lot */

/** One of the seven points of the Starlight Crown: a long shard of star-iron, about a tile tall, its middle at 0. */
function sigilMesh() {
  const b = new Build();
  const w: C = [1, 1, 1];
  const d = mul(w, 0.62);
  b.post(0, 0, 0, 0.17, -0.5, -0.04, 5, d, w);
  b.post(0, 0, 0.17, 0, -0.04, 0.62, 5, w, mul(w, 1.25));
  return b.m.data();
}

export interface HallDress {
  fires: HallFire[];
  /** The candles, on the dais's lowest step. */
  candles: HallFire[];
  /** The hooded wardens' eyes. */
  eyes: HallFire[];
  /** The banners and the dais's ring, in the color of whoever stands there. */
  colors: Stand[];
  /** The seven points of the broken crown. */
  sigils: Stand;
  dispose(): void;
}

export function dressHall(st: Stage, packs: LandPacks): HallDress {
  const scene = st.scene;
  const rand = seeded(1313);
  const b = new Build();
  const glass = new Build();
  const cloth = new Build();
  const glowRing = new Build();
  const stones = [rgb('#5e5a78'), rgb('#55516f'), rgb('#66627f'), rgb('#4e4a66'), rgb('#5a5674')];
  const joint = rgb('#14111f');
  const stone = rgb('#6c6888');
  const stoneD = rgb('#2c2842');
  const stoneHi = rgb('#868299');
  const gold = rgb('#c49a48');
  const goldD = rgb('#7a5a28');
  const W = 14;
  const eyes: HallFire[] = [];

  st.groundScene.add(floorMesh());

  // the far wall, in great courses
  b.faceS(-W, W, BACK - 0.02, 0, 12, joint);
  b.courses('s', -W, W, BACK, 0.34, 11, 0.56, 1.5, stones, joint, rand);
  b.box(-W, BACK, W, BACK + 0.14, 0, 0.34, stone, stoneD, stoneHi);
  // a string course at the height of the window's foot, and another over it
  b.box(-W, BACK, W, BACK + 0.12, 1.44, 1.56, stoneHi, stone, stoneHi);
  // the side walls of the aisles
  b.faceE(BACK, 10, -W + 2, 0, 12, mul(stones[0]!, 0.7), mul(stones[1]!, 0.5));
  b.faceW(BACK, 10, W - 2, 0, 12, mul(stones[0]!, 0.7), mul(stones[1]!, 0.5));

  // ---- the rose window, in its great carved frame
  const R = ROSE.r;
  const { x: cx, y: cy, z: wz } = ROSE;
  const pt = (a: number, r: number, z = wz): number[] => [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z];
  const colors = GLASS.map(hexRgb);
  const bright = (c: C, k: number): number[] => [Math.min(1.7, c[0]! * k), Math.min(1.7, c[1]! * k), Math.min(1.7, c[2]! * k)];
  const N = 18;
  const nz = [0, 0, 1];
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = ((i + 1) / N) * Math.PI * 2;
    const c = colors[i % colors.length]!;
    // the outer wedges, the inner ones, and the pale heart: lit, but under the glow's threshold (the owner, 2026-11-22:
    // "remove the glow in the main screen its too bright and it hurts my eyes"; it was 1.1-1.55 and a 1.5 heart)
    glass.m.quad(pt(a0, 0.47 * R), pt(a0, 0.95 * R), pt(a1, 0.95 * R), pt(a1, 0.47 * R), nz, bright(c, 0.6), bright(c, 0.8));
    glass.m.quad(pt(a0, 0.08 * R), pt(a0, 0.42 * R), pt(a1, 0.42 * R), pt(a1, 0.08 * R), nz, [0.78, 0.78, 0.72]);
  }
  // little diamonds at the very middle
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2;
    const a1 = ((i + 1) / 6) * Math.PI * 2;
    glass.m.quad(pt(a0, 0), pt(a0, 0.1 * R), pt(a1, 0.1 * R), pt(a1, 0), nz, bright(colors[i % colors.length]!, 0.75));
  }
  // the tracery: stone over the glass
  const trace = rgb('#2c2748');
  const traceHi = rgb('#4a4470');
  const tz = wz + 0.02;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const w = 0.022 * R;
    const r0 = 0.44 * R;
    const r1 = 0.96 * R;
    const P = (r: number, s: number): number[] => [cx + ca * r - sa * s, cy + sa * r + ca * s, tz];
    b.m.quad(P(r0, -w), P(r1, -w), P(r1, w), P(r0, w), nz, trace, traceHi);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const w = 0.024 * R;
    const P = (r: number, s: number): number[] => [cx + ca * r - sa * s, cy + sa * r + ca * s, tz];
    b.m.quad(P(0.02 * R, -w), P(0.44 * R, -w), P(0.44 * R, w), P(0.02 * R, w), nz, trace, traceHi);
  }
  ringBand(b, cx, cy, tz, 0.42 * R, 0.47 * R, 0.05, traceHi, trace, 36);
  ringBand(b, cx, cy, tz, 0.09 * R, 0.13 * R, 0.05, traceHi, trace, 18);
  // and in its heart the Starlight Crown, whole, as it was: seven points of black lead against the light
  const crownZ = tz + 0.03;
  const lead = rgb('#17132a');
  const leadHi = rgb('#7a5a28');
  const cw = 0.5;
  const cb = cy - 0.3;
  b.faceS(cx - cw, cx + cw, crownZ, cb, cb + 0.13, lead);
  b.faceS(cx - cw, cx + cw, crownZ + 0.002, cb + 0.045, cb + 0.075, leadHi);
  for (let i = 0; i < 7; i++) {
    const x0 = cx - cw + ((cw * 2) / 7) * i;
    const x1 = x0 + (cw * 2) / 7;
    const xm = (x0 + x1) / 2;
    const lean = (xm - cx) * 0.2;
    const tall = 0.24 + (1 - Math.abs(i - 3) / 3) * 0.2;
    b.m.quad([x0, cb + 0.12, crownZ], [x1, cb + 0.12, crownZ], [xm + lean, cb + 0.13 + tall, crownZ], [xm + lean, cb + 0.13 + tall, crownZ], nz, lead);
  }
  // the carved rings of its frame, gilt between stone, and a boss at every spoke
  ringBand(b, cx, cy, wz, 0.95 * R, 1.0 * R, 0.1, gold, goldD);
  ringBand(b, cx, cy, wz, 1.0 * R, 1.16 * R, 0.24, stone, stoneD);
  ringBand(b, cx, cy, wz, 1.16 * R, 1.22 * R, 0.14, stoneHi, stoneD);
  ringBand(b, cx, cy, wz, 1.22 * R, 1.3 * R, 0.08, stone, stoneD);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + Math.PI / 18;
    const [x, y] = [cx + Math.cos(a) * 1.08 * R, cy + Math.sin(a) * 1.08 * R];
    ringBand(b, x, y, wz + 0.24, 0, 0.055 * R, 0.05, i % 3 ? stoneHi : gold, stoneD, 8);
  }
  // under it, a row of small blind arches, a candle's worth of gold in each
  for (let i = -3; i <= 3; i++) {
    const x = i * 0.74;
    archFill(b, x, 0.28, 0.42, 0.86, BACK + 0.02, rgb('#191430'), rgb('#231d3e'));
    archFrame(b, x, 0.28, 0.42, 0.86, BACK + 0.02, 0.05, 0.06, stoneHi, stone);
  }

  // ---- the wardens' niches, and the wardens
  for (const s of [-1, 1]) {
    const x = s * 3.98;
    archFill(b, x, 1.42, 0, 3.75, BACK + 0.03, rgb('#1a1532'), rgb('#120e24'));
    archFrame(b, x, 1.42, 0, 3.75, BACK + 0.03, 0.16, 0.26, stoneHi, stoneD);
    archFrame(b, x, 1.58, 0, 3.75, BACK + 0.03, 0.08, 0.14, stone, stoneD);
    warden(b, glass, eyes, x, BACK + 1.06, stone, stoneD, gold);
  }
  // pillars of the wall between them and the window, their tops lost overhead
  for (const s of [-1, 1]) {
    for (const x of [s * 2.42, s * 5.56]) {
      b.box(x - 0.17, BACK, x + 0.17, BACK + 0.3, 0, 12, stone, stoneD, stoneHi);
      b.box(x - 0.24, BACK, x + 0.24, BACK + 0.36, 0, 0.44, stoneHi, stoneD, stoneHi);
    }
  }

  // ---- the lancets of the aisles, behind the columns on a wide screen
  const lancet = (x: number, tone: number): void => {
    const w = 0.42;
    const y0 = 1.3;
    const y1 = 5;
    archFrame(b, x, w, y0, y1, BACK + 0.02, 0.1, 0.14, stoneHi, stoneD);
    const rows = 8;
    for (let i = 0; i < rows; i++) {
      const a = y0 + ((y1 - y0) * i) / rows;
      const c = y0 + ((y1 - y0) * (i + 1)) / rows;
      const col = colors[(i + tone) % colors.length]!;
      const low = bright(col, 0.26);
      glass.faceS(x - w, x, BACK + 0.03, a, c, low, bright(col, 0.38));
      const col2 = colors[(i + tone + 2) % colors.length]!;
      glass.faceS(x, x + w, BACK + 0.03, a, c, bright(col2, 0.26), bright(col2, 0.38));
      b.faceS(x - w, x + w, BACK + 0.04, c - 0.016, c + 0.016, trace);
    }
    b.faceS(x - 0.02, x + 0.02, BACK + 0.04, y0, y1 + 0.7, trace);
    archFill(glass, x, w, y1, y1, BACK + 0.03, bright(colors[tone % colors.length]!, 0.38), bright(colors[(tone + 1) % colors.length]!, 0.3));
  };
  for (const s of [-1, 1]) {
    lancet(s * 7.15, 0);
    lancet(s * 9.3, 3);
  }

  // ---- the great columns down the nave
  const ROWS = [1.0, -2.6, -6.2];
  for (const s of [-1, 1]) {
    for (const z of ROWS) column(b, s * NAVE, z, stone, stoneD, gold);
    // and pointed arches from each to the next, the far end of the ribs overhead
    for (let i = 0; i < ROWS.length - 1; i++) {
      const z0 = ROWS[i + 1]!;
      const z1 = ROWS[i]!;
      const zm = (z0 + z1) / 2;
      const w = (z1 - z0) / 2 - 0.6;
      const y = 5.3;
      const pts = pointed(zm, w, y);
      const x0 = s * NAVE - 0.34;
      const x1 = s * NAVE + 0.34;
      for (let k = 0; k < pts.length - 1; k++) {
        const p = pts[k]!;
        const q = pts[k + 1]!;
        const inner = s < 0 ? x1 : x0;
        const nx = s < 0 ? 1 : -1;
        if (s < 0) b.m.quad([inner, p[1], p[0]], [inner, q[1], q[0]], [inner, q[1] + 0.5, q[0]], [inner, p[1] + 0.5, p[0]], [nx, 0, 0], stone);
        else b.m.quad([inner, q[1], q[0]], [inner, p[1], p[0]], [inner, p[1] + 0.5, p[0]], [inner, q[1] + 0.5, q[0]], [nx, 0, 0], stone);
        b.m.quad([x0, p[1], p[0]], [x1, p[1], p[0]], [x1, q[1], q[0]], [x0, q[1], q[0]], [0, -0.8, 0.5], stoneD);
      }
    }
    // the bowls of fire down the nave, on stone stands
    for (const f of BOWLS) {
      if (Math.sign(f.x) !== s) continue;
      b.post(f.x, f.z, 0.46, 0.46, 0, 0.14, 8, stoneD, stone);
      b.post(f.x, f.z, 0.3, 0.19, 0.14, 1.34, 8, stone, stoneHi);
      b.post(f.x, f.z, 0.24, 0.24, 1.1, 1.18, 8, gold, gold);
      b.post(f.x, f.z, 0.22, 0.56, 1.34, 1.84, 10, rgb('#3e3442'), rgb('#7a6a5e'));
      b.post(f.x, f.z, 0.6, 0.6, 1.84, 1.92, 10, gold, mul(gold, 1.15));
      glass.post(f.x, f.z, 0.5, 0.12, 1.92, 2.0, 8, rgb('#9a3010'), rgb('#ff8a2a'));
    }
  }

  // ---- banners down the columns, in the color of the hero on the dais
  const banner = (x: number, z: number, top: number, w: number, h: number): void => {
    cloth.banner(x, z, top, w, h, [1, 1, 1], [1, 1, 1], [1, 1, 1]);
    // (the trim's own, ungiven to the color)
    b.faceS(x - w / 2 - 0.05, x + w / 2 + 0.05, z + 0.03, top - 0.11, top, gold);
    b.faceS(x - w / 2, x - w / 2 + 0.06, z + 0.03, top - h * 0.86, top, gold);
    b.faceS(x + w / 2 - 0.06, x + w / 2, z + 0.03, top - h * 0.86, top, gold);
    const dy = top - h * 0.46;
    const dw = w * 0.26;
    const dh = h * 0.2;
    b.m.quad([x, dy - dh, z + 0.035], [x + dw, dy, z + 0.035], [x, dy + dh, z + 0.035], [x - dw, dy, z + 0.035], nz, gold);
    b.m.quad([x, dy - dh * 0.5, z + 0.04], [x + dw * 0.5, dy, z + 0.04], [x, dy + dh * 0.5, z + 0.04], [x - dw * 0.5, dy, z + 0.04], nz, rgb('#fff0c8'));
  };
  for (const s of [-1, 1]) {
    banner(s * NAVE, -2.6 + 0.8, 5.0, 1.08, 3.4);
    banner(s * NAVE, -6.2 + 0.8, 5.2, 1.08, 3.4);
  }

  // ---- the dais: three steps of pale round stone, gilt-edged, its top worn by those who've stood there
  const ring = (r: number, y0: number, y1: number, top: C, side: C, edge?: C): void => {
    const n = 40;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const P = (a: number, rr: number, y: number): number[] => [Math.cos(a) * rr, y, Math.sin(a) * rr];
      const mid = (a0 + a1) / 2;
      b.m.quad(P(a1, r, y1), P(a0, r, y1), [0, y1, 0], [0, y1, 0], [0, 1, 0], top);
      b.m.quad(P(a1, r, y0), P(a0, r, y0), P(a0, r, y1), P(a1, r, y1), [Math.cos(mid), 0.1, Math.sin(mid)], mul(side, 0.72), side);
      if (edge) b.m.quad(P(a1, r + 0.012, y1 - 0.03), P(a0, r + 0.012, y1 - 0.03), P(a0, r + 0.012, y1 + 0.002), P(a1, r + 0.012, y1 + 0.002), [Math.cos(mid), 0, Math.sin(mid)], edge);
    }
  };
  ring(2.72, 0, 0.1, rgb('#55516e'), rgb('#2a2640'), gold);
  ring(2.24, 0.1, 0.2, rgb('#6c6888'), rgb('#343050'), gold);
  ring(1.76, 0.2, 0.3, rgb('#86829f'), rgb('#3f3b5a'), gold);
  // its top: a star of gilt, and a shadow under whoever's on it
  const dy = 0.302;
  const n = 32;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const P = (a: number, rr: number): number[] => [Math.cos(a) * rr, dy, Math.sin(a) * rr];
    b.m.quad(P(a1, 0.86), P(a0, 0.86), [0, dy, 0], [0, dy, 0], [0, 1, 0], rgb('#86829f'), rgb('#2c2842'));
    // the ring that takes the hero's color, and shines by itself
    glowRing.m.quad(P(a1, 1.46), P(a0, 1.46), P(a0, 1.38), P(a1, 1.38), [0, 1, 0], [1.25, 1.25, 1.25]);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const P = (r: number, s: number): number[] => [ca * r - sa * s, dy + 0.002, sa * r + ca * s];
    const w = i % 3 ? 0.03 : 0.07;
    b.m.quad(P(1.1, w), P(1.34, 0), P(1.1, -w), P(1.1, -w), [0, 1, 0], gold);
  }

  // ---- candles round the lowest step, the warm against the window's cold
  const candles: HallFire[] = [];
  const candleMesh = packs.indoor.meshes.candle_triple;
  const place: { x: number; z: number; rot: number }[] = [];
  for (const deg of [205, 232, 308, 335]) {
    const a = (deg * Math.PI) / 180;
    const x = Math.cos(a) * 2.5;
    const z = Math.sin(a) * 2.5;
    place.push({ x, z, rot: a });
    candles.push({ x, y: 0.42, z, size: 0.3 });
  }
  const extras: Stand[] = [];
  if (candleMesh) {
    const s = new Stand(candleMesh, scene, place.length);
    const k = 0.32 / Math.max(0.01, candleMesh.max[1] - candleMesh.min[1]);
    s.begin();
    for (const p of place) s.put(p.x, 0.1 - candleMesh.min[1] * k, p.z, p.rot, k, k, k, 0.5, 0.44, 0.36, 0);
    s.end();
    extras.push(s);
  }

  // ---- light it all, and put it up
  bake(b.m);
  bake(cloth.m);
  const main = b.m.build();
  scene.add(main);
  const lit = glass.m.build();
  lit.material = glassMaterial;
  scene.add(lit);
  const banners = new Stand(cloth.m.data(), scene, 1);
  const ringOf = new Stand(glowRing.m.data(), scene, 1);
  const sigils = new Stand(sigilMesh(), scene, 7);

  // ---- what you can see of the light
  const shafts = new Shafts();
  // the round of light on the wall about the window, then the fall of moonlight down to the dais
  shafts.halo(cx, cy, wz + 0.5, R * 2.6, [0.42, 0.5, 1], 0.07);
  shafts.halo(cx, cy, wz + 0.5, R * 1.3, [0.6, 0.66, 1], 0.03);
  const moon = [0.62, 0.72, 1];
  const fall = (w0: number, w1: number, a: number): void => {
    shafts.add([-w1, 0.03, 0.9], [w1, 0.03, 0.9], [w0, cy, wz + 0.5], [-w0, cy, wz + 0.5], moon, a);
  };
  fall(1.5, 3.1, 0.08);
  fall(1.0, 2.1, 0.1);
  fall(0.5, 1.1, 0.08);
  // and the cold slants from the lancets, down across the columns toward the middle
  for (const s of [-1, 1]) {
    for (const x of [7.15, 9.3]) {
      const lx = s * x;
      const fx = s * (x - 3.6);
      shafts.add([fx - 0.8, 0.03, -4.2], [fx + 0.8, 0.03, -4.2], [lx + 0.42, 4.2, BACK + 0.2], [lx - 0.42, 4.2, BACK + 0.2], [0.42, 0.5, 1], 0.045);
    }
  }
  const glow = shafts.build();
  scene.add(glow);

  return {
    fires: BOWLS,
    candles,
    eyes,
    colors: [banners, ringOf],
    sigils,
    dispose(): void {
      banners.dispose();
      ringOf.dispose();
      sigils.dispose();
      extras.forEach((s) => s.dispose());
    },
  };
}
