/**
 * The 3D side. Cars are lofted: each body is a stack of rounded cross-sections along its length
 * (a rounded rectangle with tumblehome, rounded nose and tail, real wheel arches), so it reads as
 * a smooth, chunky toy car rather than an extruded slab. The glass cabin is lofted the same way
 * with painted pillars and roof. Lamps, grilles, mirrors and parts are snapped onto the body
 * surface. Paint and glass reflect the strip's own sky. Static meshes are merged per material, so
 * a car is a few draw calls and the whole world a few dozen. Three.js loads with the game's chunk.
 */
import * as THREE from 'three';
import type { CabinKind, CarDef, Feature } from './cars';
import { getCosmetic } from './cosmetics';
import { ENV_DEFS, type EnvDef } from './envs';
import type { Levels } from './parts';
import { clamp, lerp, shade } from './util';
import { buildModelCar, paintOf } from './modelcar';
import { getModel, loadModel, specFor } from './models';
import { CHROME, DRL, GLASS, LAMP, RUBBER, TAIL, TRIM, ball, blobTexture, box, lam, mergeStatic, mesh, pillow, std } from './mats';

export interface CarLook {
  def: CarDef;
  levels: Levels;
  paint: string;
  livery: string;
  wheels: string;
  helmet: [string, string];
  suit: string;
}

export interface CarState {
  x: number;
  v: number;
  rpm: number;
  redline: number;
  spinning: boolean;
  dead: boolean;
}

export const DISTANCE_M = 402.336;
/** Five lanes: the player in the middle (lane 0), then alternating right and left. */
export const LANES = 5;
const LANE_PITCH = 4.0;
export const LANE_Z = [0, -LANE_PITCH, LANE_PITCH, -2 * LANE_PITCH, 2 * LANE_PITCH] as const;
const LANE_W = (LANE_PITCH * LANES) / 2;

const noise = (i: number, k = 1): number => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Monotone cubic through points (no overshoot): the body's side profile. */
function monotone(pts: [number, number][]): (x: number) => number {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const n = xs.length;
  const d: number[] = [];
  const m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1]! - ys[i]!) / (xs[i + 1]! - xs[i]!));
  m[0] = d[0]!;
  m[n - 1] = d[n - 2]!;
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / d[i]!;
    const b = m[i + 1]! / d[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i]!;
      m[i + 1] = t * b * d[i]!;
    }
  }
  return (x: number): number => {
    const xc = clamp(x, xs[0]!, xs[n - 1]!);
    let i = 0;
    while (i < n - 2 && xc > xs[i + 1]!) i++;
    const h = xs[i + 1]! - xs[i]!;
    const t = (xc - xs[i]!) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i]! + (t3 - 2 * t2 + t) * h * m[i]! + (-2 * t3 + 3 * t2) * ys[i + 1]! + (t3 - t2) * h * m[i + 1]!;
  };
}

// ---------------------------------------------------------------- the body model
interface Style {
  /** Rounded-rectangle corner radii (fractions of the half size): top and bottom. */
  rt: number;
  rb: number;
  tumble: number;
  /** Nose and tail corner rounding, as fractions of the length. */
  rN: number;
  rT: number;
  /** How far the nose/tail face shrinks into its corners: width and height (1 = a square end). */
  fw: number;
  fh: number;
}

const STYLES: Record<CabinKind, Style> = {
  bug: { rt: 0.95, rb: 0.4, tumble: 0.1, rN: 0.12, rT: 0.12, fw: 0.4, fh: 0.62 },
  hatch: { rt: 0.5, rb: 0.25, tumble: 0.12, rN: 0.05, rT: 0.035, fw: 0.8, fh: 0.88 },
  wagon: { rt: 0.42, rb: 0.25, tumble: 0.1, rN: 0.045, rT: 0.03, fw: 0.82, fh: 0.9 },
  notch: { rt: 0.45, rb: 0.25, tumble: 0.12, rN: 0.05, rT: 0.04, fw: 0.8, fh: 0.88 },
  fast: { rt: 0.48, rb: 0.25, tumble: 0.18, rN: 0.055, rT: 0.045, fw: 0.76, fh: 0.84 },
  open: { rt: 0.55, rb: 0.25, tumble: 0.15, rN: 0.055, rT: 0.05, fw: 0.74, fh: 0.84 },
  cab: { rt: 0.32, rb: 0.22, tumble: 0.05, rN: 0.035, rT: 0.02, fw: 0.82, fh: 0.92 },
  none: { rt: 0.9, rb: 0.6, tumble: 0.05, rN: 0.1, rT: 0.05, fw: 0.45, fh: 0.6 },
};

interface Body {
  L: number;
  W: number;
  st: Style;
  X: (u: number) => number;
  top: (u: number) => number;
  bottom: (u: number) => number;
  hw: (u: number) => number;
  /** Plan-view rounding of the nose and tail (width); `kh` is the gentler height rounding. */
  k: (u: number) => number;
  kh: (u: number) => number;
  arch: (u: number) => number;
  /** Top corner radius at a station: flatter, crisper hood and deck than the body under the cabin. */
  rt: (u: number) => number;
  /** Half perimeter of the normalized rounded rectangle (with the style's corners: the texture layout). */
  P: number;
}

function bodyOf(def: CarDef, wr: number, rearR: number): Body {
  const sh = def.shape;
  const c = sh.cabin;
  const st = STYLES[c.kind];
  const L = sh.len;
  const W = c.kind === 'open' && def.shape.features.includes('chrome') && sh.len < 3.5 ? sh.width * 0.72 : sh.width;
  const X = (u: number): number => u * L - L / 2;
  // side profile: tail, deck, belt under the cabin, cowl, hood, nose
  const raw: [number, number][] = [
    [0, sh.tail],
    [0.07, sh.deck],
    [c.from - 0.03, sh.deck],
    [c.from + 0.02, sh.belt],
    [c.to, sh.belt],
    [Math.min(c.to + 0.08, 0.86), sh.cowl],
    [0.93, sh.nose],
    [1, sh.nose - 0.09],
  ];
  raw.sort((a, b) => a[0] - b[0]);
  const pts: [number, number][] = [];
  for (const p of raw) {
    const last = pts[pts.length - 1];
    if (last && p[0] - last[0] < 0.02) last[1] = p[1];
    else pts.push([clamp(p[0], 0, 1), p[1]]);
  }
  const top = monotone(pts);
  const bottom = (u: number): number => sh.clear + 0.06 * (smooth(0.07, 0, u) + smooth(0.93, 1, u));
  const wide = sh.features.includes('wide') ? 0.05 : 0.014;
  const wheels: [number, number][] = c.kind === 'none' ? [] : [
    [sh.wheels.front, wr],
    [sh.wheels.rear, rearR],
  ];
  const hw = (u: number): number => {
    let w = W / 2;
    if (u > 0.7) w *= 1 - 0.06 * ((u - 0.7) / 0.3) ** 2;
    if (u < 0.2) w *= 1 - 0.04 * ((0.2 - u) / 0.2) ** 2;
    for (const [cu, r] of wheels) {
      const d = (Math.abs(u - cu) * L) / (r * 1.7);
      if (d < 1) w += wide * (1 - d * d);
    }
    return w;
  };
  // the nose and tail round into a flat face (capped in loftBody)
  const q = (u: number): number => {
    let f = 1;
    if (u > 1 - st.rN) f = Math.min(f, Math.sqrt(Math.max(0, 1 - ((u - (1 - st.rN)) / st.rN) ** 2)));
    if (u < st.rT) f = Math.min(f, Math.sqrt(Math.max(0, 1 - ((st.rT - u) / st.rT) ** 2)));
    return f;
  };
  const k = (u: number): number => st.fw + (1 - st.fw) * q(u);
  const kh = (u: number): number => st.fh + (1 - st.fh) * q(u);
  const arch = (u: number): number => {
    let y = -Infinity;
    for (const [cu, r] of wheels) {
      const dx = (u - cu) * L;
      const R = r * 1.14 + 0.035;
      if (Math.abs(dx) < R) y = Math.max(y, r + Math.sqrt(R * R - dx * dx));
    }
    return y;
  };
  const P = 1 - st.rb + (st.rb * Math.PI) / 2 + (2 - st.rb - st.rt) + (st.rt * Math.PI) / 2 + (1 - st.rt);
  const flat = c.kind === 'bug' ? st.rt : Math.min(st.rt, 0.3);
  const rt = (u: number): number => lerp(st.rt, flat, Math.max(smooth(c.to, c.to + 0.1, u), smooth(c.from, c.from - 0.08, u)));
  return { L, W, st, X, top, bottom, hw, k, kh, arch, rt, P };
}

/** A point of the normalized rounded rectangle for ring parameter t (0 bottom centre, 0.25 right, 0.5 top, 0.75 left). */
function ringPoint(b: Body, t: number, u: number): [number, number] {
  const rb = b.st.rb;
  const rt = b.rt(u);
  const P = 1 - rb + (rb * Math.PI) / 2 + (2 - rb - rt) + (rt * Math.PI) / 2 + (1 - rt);
  const left = t > 0.5;
  let s = (left ? 1 - t : t) * 2 * P;
  let z: number;
  let y: number;
  const seg = (len: number): boolean => {
    if (s <= len) return true;
    s -= len;
    return false;
  };
  if (seg(1 - rb)) [z, y] = [s, -1];
  else if (seg((rb * Math.PI) / 2)) {
    const a = -Math.PI / 2 + s / rb;
    [z, y] = [1 - rb + Math.cos(a) * rb, -1 + rb + Math.sin(a) * rb];
  } else if (seg(2 - rb - rt)) [z, y] = [1, -1 + rb + s];
  else if (seg((rt * Math.PI) / 2)) {
    const a = s / rt;
    [z, y] = [1 - rt + Math.cos(a) * rt, 1 - rt + Math.sin(a) * rt];
  } else [z, y] = [Math.max(0, 1 - rt - s), 1];
  return [left ? -z : z, y];
}

function sectionPoint(b: Body, u: number, t: number): [number, number, number] {
  const top = b.top(u);
  const bot = b.bottom(u);
  const mid = (top + bot) / 2;
  const half = (top - bot) / 2;
  const k = b.k(u);
  const kh = b.kh(u);
  const [zN, yN] = ringPoint(b, t, u);
  const shape = (1 - b.st.tumble * Math.max(0, yN) ** 2) * (1 + 0.02 * (1 - yN * yN));
  let y = mid + half * yN * kh;
  const z = b.hw(u) * zN * shape * k;
  // the wheel arch lifts only the outer sides: an opening on the side, a fender over the wheel,
  // and the hood between the fenders stays where it is
  const a = b.arch(u);
  if (y < a) y = lerp(y, a, smooth(0.5, 0.72, Math.abs(zN)));
  return [b.X(u), y, z];
}

/** Whether a point is inside the body at station u (for snapping details onto the surface). */
function inside(b: Body, u: number, y: number, z: number): boolean {
  const top = b.top(u);
  const bot = b.bottom(u);
  const k = b.k(u);
  const half = ((top - bot) / 2) * b.kh(u);
  const yN = (y - (top + bot) / 2) / half;
  if (Math.abs(yN) > 1) return false;
  const shape = (1 - b.st.tumble * Math.max(0, yN) ** 2) * (1 + 0.02 * (1 - yN * yN));
  const zMax = b.hw(u) * k * shape * edgeAt(b, yN, u);
  return Math.abs(z) <= zMax;
}
/** Normalized half width of the rounded rectangle at height yN. */
function edgeAt(b: Body, yN: number, u: number): number {
  const rb = b.st.rb;
  const rt = b.rt(u);
  if (yN > 1 - rt) {
    const dy = (yN - (1 - rt)) / rt;
    return 1 - rt + rt * Math.sqrt(Math.max(0, 1 - dy * dy));
  }
  if (yN < -1 + rb) {
    const dy = (-1 + rb - yN) / rb;
    return 1 - rb + rb * Math.sqrt(Math.max(0, 1 - dy * dy));
  }
  return 1;
}
/** The body surface's x at height y and offset z: the nose (front) or the tail. */
function surfaceX(b: Body, y: number, z: number, front: boolean): number {
  let lo = front ? 0.6 : 0.4;
  let hi = front ? 1 : 0;
  if (!inside(b, lo, y, z)) return b.X(lo);
  if (inside(b, hi, y, z)) return b.X(hi);
  for (let i = 0; i < 22; i++) {
    const midU = (lo + hi) / 2;
    if (inside(b, midU, y, z)) lo = midU;
    else hi = midU;
  }
  return b.X(lo);
}
function loftBody(b: Body): THREE.BufferGeometry {
  const S = 76;
  const R = 48;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < S; i++) {
    const lin = i / (S - 1);
    const u = lerp(lin, (1 - Math.cos(lin * Math.PI)) / 2, 0.55);
    for (let j = 0; j <= R; j++) {
      const t = j / R;
      const [x, y, z] = sectionPoint(b, u, t);
      pos.push(x, y, z);
      uv.push(u, t);
    }
  }
  const row = R + 1;
  for (let i = 0; i < S - 1; i++)
    for (let j = 0; j < R; j++) {
      const a = i * row + j;
      const c = (i + 1) * row + j;
      idx.push(a, c, c + 1, a, c + 1, a + 1);
    }
  // flat faces at the tail (u = 0) and nose (u = 1): their own vertices, so the edge stays crisp
  for (const end of [0, 1]) {
    const base = pos.length / 3;
    let cy = 0;
    let cx = 0;
    for (let j = 0; j <= R; j++) {
      const [x, y, z] = sectionPoint(b, end, j / R);
      pos.push(x, y, z);
      // the face takes the plain paint of the side's upper half
      uv.push(end ? 0.999 : 0.001, 0.3);
      cy += y;
      cx = x;
    }
    pos.push(cx, cy / (R + 1), 0);
    uv.push(end ? 0.999 : 0.001, 0.3);
    const centre = base + R + 1;
    for (let j = 0; j < R; j++) {
      if (end) idx.push(centre, base + j + 1, base + j);
      else idx.push(centre, base + j, base + j + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

interface Cabin {
  yb: number;
  roof: (u: number) => number;
  wb: (u: number) => number;
}

function cabinOf(def: CarDef, b: Body): Cabin {
  const c = def.shape.cabin;
  const yb = def.shape.belt - 0.07;
  const roofY = c.roof;
  const roof = (u: number): number => {
    let h: number;
    if (u <= c.from || u >= c.to) h = 0;
    else if (u < c.roofFrom) {
      const s = (u - c.from) / (c.roofFrom - c.from);
      // hatches and wagons drop almost straight down; fastbacks run long and flat
      h = c.kind === 'hatch' || c.kind === 'wagon' || c.kind === 'cab' ? Math.pow(Math.sin(s * (Math.PI / 2)), 0.4) : c.kind === 'fast' ? Math.pow(s, 0.75) : Math.pow(Math.sin(s * (Math.PI / 2)), 0.8);
    } else if (u > c.roofTo) {
      const s = (c.to - u) / (c.to - c.roofTo);
      // the windshield: nearly straight on sporty cars, slightly bowed on the rest
      h = c.kind === 'fast' ? Math.pow(s, 0.85) : c.kind === 'bug' ? Math.pow(Math.sin(s * (Math.PI / 2)), 0.7) : Math.pow(Math.sin(s * (Math.PI / 2)), 1.1);
    }
    else h = 1 + 0.02 * Math.sin((Math.PI * (u - c.roofFrom)) / (c.roofTo - c.roofFrom));
    return yb + (roofY - yb) * h;
  };
  return { yb, roof, wb: (u: number) => b.hw(u) * 0.71 };
}

/** The glass cabin: a loft with painted roof, frames and pillars. Groups: 0 paint, 1 glass. */
function loftCabin(def: CarDef, b: Body, cab: Cabin): THREE.BufferGeometry {
  const c = def.shape.cabin;
  const S = 34;
  const ts = [0.3, 0.4, 0.44, 0.5, 0.56, 0.6, 0.7];
  const pos: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i < S; i++) {
    const u = lerp(c.from, c.to, i / (S - 1));
    const y = cab.roof(u);
    const h = y - cab.yb;
    const wb = cab.wb(u);
    const wt = wb * (1 - c.taper);
    const rr = Math.min(0.08, h * 0.35);
    const ring: [number, number][] = [
      [wb, cab.yb],
      [wt, y - rr],
      [wt - rr * 0.8, y],
      [0, y + rr * 0.15],
      [-(wt - rr * 0.8), y],
      [-wt, y - rr],
      [-wb, cab.yb],
    ];
    ring.forEach(([z, yy], j) => {
      pos.push(b.X(u), yy, z);
      uv.push(u, ts[j]!);
    });
  }
  const paint: number[] = [];
  const glass: number[] = [];
  const span = c.to - c.from;
  const bPillar = c.kind === 'cab' ? -1 : def.shape.doors === 2 ? c.to - span * 0.47 : c.kind === 'hatch' || c.kind === 'wagon' ? c.to - span * 0.62 : -1;
  for (let i = 0; i < S - 1; i++) {
    const um = lerp(c.from, c.to, (i + 0.5) / (S - 1));
    for (let j = 0; j < 6; j++) {
      let painted: boolean;
      if (j === 1 || j === 4) painted = true;
      else if (j === 2 || j === 3) painted = um >= c.roofFrom - 0.004 && um <= c.roofTo + 0.004;
      else {
        painted = bPillar > 0 && Math.abs(um - bPillar) < 0.016;
        if (c.kind === 'fast' || c.kind === 'notch') painted ||= um < c.roofFrom + (c.roofTo - c.roofFrom) * 0.14;
        if (c.kind === 'hatch' || c.kind === 'wagon') painted ||= um < c.from + (c.roofFrom - c.from) * 0.9 + 0.012;
        if (c.kind === 'cab') painted ||= um < c.from + 0.012;
      }
      const a = i * 7 + j;
      const d = (i + 1) * 7 + j;
      (painted ? paint : glass).push(a, d, d + 1, a, d + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([...paint, ...glass]);
  g.addGroup(0, paint.length, 0);
  g.addGroup(paint.length, glass.length, 1);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- livery

/** The body's paint as one texture: u along the length, v around the cross-section (see ringPoint). */
function liveryTexture(look: CarLook, b: Body): THREE.CanvasTexture {
  const Wc = 1024;
  const Hc = 1024;
  const cv = document.createElement('canvas');
  cv.width = Wc;
  cv.height = Hc;
  const ctx = cv.getContext('2d')!;
  const paint = paintOf(look);
  const { rt, rb } = b.st;
  const P = b.P;
  const sh = look.def.shape;
  const c = sh.cabin;
  // ring parameter of a point on the right side (yN) or the top (zN)
  const tSide = (yN: number): number => (1 - rb + (rb * Math.PI) / 2 + clamp(yN - (-1 + rb), 0, 2 - rb - rt)) / (2 * P);
  const tTop = (zN: number): number => (P - clamp(zN, 0, 1 - rt)) / (2 * P);
  const X = (u: number): number => u * Wc;
  const Y = (t: number): number => (1 - t) * Hc;
  const sidePoly = (pts: [number, number][], color: string): void => {
    ctx.fillStyle = color;
    for (const mirror of [false, true]) {
      ctx.beginPath();
      pts.forEach(([u, yN], i) => {
        const t = tSide(yN);
        const yy = Y(mirror ? 1 - t : t);
        if (i) ctx.lineTo(X(u), yy);
        else ctx.moveTo(X(u), yy);
      });
      ctx.closePath();
      ctx.fill();
    }
  };
  const sideRect = (u0: number, u1: number, y0: number, y1: number, color: string): void => sidePoly([[u0, y0], [u1, y0], [u1, y1], [u0, y1]], color);
  const topRect = (u0: number, u1: number, z0: number, z1: number, color: string): void => {
    ctx.fillStyle = color;
    for (const mirror of [false, true]) {
      const a = tTop(z0);
      const bb = tTop(z1);
      const t0 = mirror ? 1 - a : a;
      const t1 = mirror ? 1 - bb : bb;
      ctx.fillRect(X(u0), Math.min(Y(t0), Y(t1)), X(u1) - X(u0), Math.max(2, Math.abs(Y(t0) - Y(t1))));
    }
  };
  ctx.fillStyle = paint;
  ctx.fillRect(0, 0, Wc, Hc);
  // underside and sills
  ctx.fillStyle = '#1b1a21';
  ctx.fillRect(0, Y(0.05), Wc, Hc);
  ctx.fillRect(0, 0, Wc, Y(0.95));
  sideRect(0, 1, -1, -0.62, shade(paint, -0.3));
  // the livery
  const liv = getCosmetic(look.livery);
  if (liv) {
    const [c0 = '#ffffff', c1 = '#1d1238'] = liv.colors;
    switch (liv.id) {
      case 'l-stripes':
        topRect(0, 1, 0.07, 0.19, c0);
        sideRect(0, 1, -0.5, -0.4, c0);
        break;
      case 'l-roundel': {
        const u = (c.from + c.to) / 2 - 0.02;
        for (const mirror of [false, true]) {
          const t = tSide(0.1);
          ctx.fillStyle = c0;
          ctx.beginPath();
          ctx.ellipse(X(u), Y(mirror ? 1 - t : t), Wc * 0.05, Hc * 0.05, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = c1;
          ctx.font = `900 ${Hc * 0.065}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.save();
          ctx.translate(X(u), Y(mirror ? 1 - t : t));
          ctx.scale(mirror ? -1 : 1, -1);
          ctx.rotate(mirror ? 0 : 0);
          ctx.fillText('7', 0, Hc * 0.004);
          ctx.restore();
        }
        break;
      }
      case 'l-swoosh':
        sidePoly([[0.02, -0.3], [0.62, 0.05], [0.98, -0.18], [0.98, -0.3], [0.6, -0.08], [0.02, -0.45]], c0);
        break;
      case 'l-flames':
        for (let i = 0; i < 2; i++) {
          const kk = 1 - i * 0.3;
          sidePoly([[1, -0.4], [1 - 0.16 * kk, 0.3], [1 - 0.24 * kk, -0.15], [1 - 0.34 * kk, 0.42], [1 - 0.46 * kk, -0.25], [1 - 0.55 * kk, 0.1], [1 - 0.62 * kk, -0.45], [1, -0.55]], liv.colors[i] ?? c0);
          topRect(0.84 + i * 0.05, 1, 0, 0.5 - i * 0.2, liv.colors[i] ?? c0);
        }
        break;
      case 'l-checker': {
        const n = 5;
        for (let i = 0; i < n; i++)
          for (let j = 0; j < 4; j++) {
            const y0 = -0.4 + j * 0.25;
            sideRect(0.02 + i * 0.035, 0.02 + (i + 1) * 0.035, y0, y0 + 0.25, (i + j) % 2 ? c1 : c0);
          }
        break;
      }
      case 'l-camo':
        for (let i = 0; i < 26; i++) {
          ctx.fillStyle = i % 2 ? c0 : c1;
          ctx.beginPath();
          ctx.ellipse(noise(i, 3) * Wc, noise(i, 4) * Hc, Wc * (0.03 + noise(i, 5) * 0.05), Hc * (0.03 + noise(i, 6) * 0.04), noise(i, 7) * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#1b1a21';
        ctx.fillRect(0, Y(0.05), Wc, Hc);
        ctx.fillRect(0, 0, Wc, Y(0.95));
        break;
      case 'l-rainbow':
        liv.colors.forEach((col, i) => sideRect(0, 1, -0.2 + i * 0.12, -0.08 + i * 0.12, col));
        liv.colors.forEach((col, i) => topRect(0, 1, i * 0.06, (i + 1) * 0.06, col));
        break;
    }
  }
  if (look.levels.looks >= 7) sideRect(0.04, 0.96, -0.6, -0.56, '#f4f4f4');
  // panel lines: doors, handles, hood and boot
  const line = 'rgba(0,0,0,0.42)';
  if (c.kind !== 'open' && c.kind !== 'none') {
    const span = c.to - c.from;
    const seams = sh.doors === 2 ? [c.to - span * 0.92, c.to - span * 0.47, c.to + 0.005] : [c.to - span * 0.72, c.to + 0.005];
    for (const s of seams) sideRect(s - 0.0015, s + 0.0015, -0.55, 0.92, line);
    for (let i = 0; i < seams.length - 1; i++) sideRect(seams[i + 1]! - 0.05, seams[i + 1]! - 0.02, 0.5, 0.58, 'rgba(0,0,0,0.5)');
    topRect(Math.min(c.to + 0.07, 0.86) - 0.001, Math.min(c.to + 0.07, 0.86) + 0.001, 0, 0.6, line);
    if (c.kind === 'notch' || c.kind === 'fast') topRect(c.from - 0.035, c.from - 0.033, 0, 0.6, line);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------- the car
export interface CarRig {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  wheelR: number;
  flames: THREE.Object3D[];
  shiftLamp: THREE.MeshStandardMaterial | null;
  smoke: THREE.Mesh[];
  len: number;
  dispose(): void;
}


function buildWheel(r: number, w: number, look: CarLook, side: 1 | -1, slick: boolean, disposables: { dispose(): void }[]): THREE.Group {
  const g = new THREE.Group();
  // tyre: a lathed profile with rounded shoulders
  const rimR = r * (slick ? 0.6 : 0.66);
  const prof: THREE.Vector2[] = [];
  const hw = w / 2;
  const sh = Math.min(0.05, w * 0.25);
  prof.push(new THREE.Vector2(rimR, -hw + 0.01));
  prof.push(new THREE.Vector2(r - sh, -hw));
  for (let i = 1; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    prof.push(new THREE.Vector2(r - sh + Math.sin(a) * sh, -hw + sh - Math.cos(a) * sh));
  }
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    prof.push(new THREE.Vector2(r - sh + Math.cos(a) * sh, hw - sh + Math.sin(a) * sh));
  }
  prof.push(new THREE.Vector2(rimR, hw - 0.01));
  const tyreGeo = new THREE.LatheGeometry(prof, 30);
  tyreGeo.rotateX(Math.PI / 2);
  g.add(mesh(tyreGeo, slick ? std('#121216', { rough: 0.6 }) : RUBBER()));
  // rim: dish, spokes, lip, hub
  const rimCol = getCosmetic(look.wheels)?.colors[0] ?? '#cfcfcf';
  const rimMat = std(rimCol, { metal: 0.55, rough: 0.32 });
  const face = side * hw * 0.55;
  const dish = new THREE.CylinderGeometry(rimR, rimR, w * 0.6, 28);
  dish.rotateX(Math.PI / 2);
  g.add(mesh(dish, std('#2b2b33', { rough: 0.6, metal: 0.4 })));
  const lip = new THREE.TorusGeometry(rimR - 0.012, 0.022, 8, 30);
  g.add(mesh(lip, rimMat, 0, 0, face));
  const spokes = look.wheels === 'w-mesh' ? 12 : look.wheels === 'w-turbine' ? 9 : look.wheels === 'w-deep' ? 6 : look.wheels === 'w-steel' ? 8 : 5;
  const spokeW = look.wheels === 'w-mesh' ? 0.025 : look.wheels === 'w-steel' ? 0.05 : 0.06;
  for (let i = 0; i < spokes; i++) {
    const s = box(rimR * 0.95, spokeW, 0.04, rimMat, 0, 0, face - side * 0.01);
    s.geometry.translate(rimR * 0.48, 0, 0);
    s.position.set(0, 0, face - side * 0.01);
    s.rotation.z = (i / spokes) * Math.PI * 2 + (look.wheels === 'w-turbine' ? 0.35 : 0);
    g.add(s);
  }
  if (look.wheels === 'w-steel') g.add(mesh(new THREE.CylinderGeometry(rimR * 0.7, rimR * 0.7, 0.03, 24).rotateX(Math.PI / 2), rimMat, 0, 0, face));
  g.add(mesh(new THREE.CylinderGeometry(rimR * 0.2, rimR * 0.22, 0.06, 14).rotateX(Math.PI / 2), CHROME(), 0, 0, face + side * 0.015));
  const keep = new Set<THREE.Object3D>();
  disposables.push(...mergeStatic(g, (o) => keep.has(o), { cast: true, receive: false }));
  return g;
}

/** Builds a car from its look: origin on the ground under the car's centre, nose toward +x. */
export function buildCar(look: CarLook): CarRig {
  const def = look.def;
  const sh = def.shape;
  const c = sh.cabin;
  const lv = look.levels;
  const disposables: { dispose(): void }[] = [];
  const keepD = <T extends { dispose(): void }>(d: T): T => {
    disposables.push(d);
    return d;
  };
  const root = new THREE.Group();
  const bodyG = new THREE.Group();
  root.add(bodyG);
  const isRail = c.kind === 'none';
  const isOpen = c.kind === 'open';
  const wr = sh.wheels.r + lv.tyres * 0.007;
  const rearR = (sh.wheels.rearR ?? sh.wheels.r) + lv.tyres * 0.007;
  const tw = sh.wheels.w + lv.tyres * 0.018;
  const b = bodyOf(def, wr, rearR);
  const { X, L } = b;
  const paint = paintOf(look);
  const has = (f: Feature): boolean => sh.features.includes(f);

  // body
  const tex = keepD(liveryTexture(look, b));
  const paintOpts = { metalness: 0.15, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.1 };
  const liveryMat = keepD(new THREE.MeshPhysicalMaterial({ map: tex, ...paintOpts }));
  const paintMat = keepD(new THREE.MeshPhysicalMaterial({ color: paint, ...paintOpts }));
  const bodyGeo = keepD(loftBody(b));
  const body = new THREE.Mesh(bodyGeo, liveryMat);
  body.castShadow = true;
  bodyG.add(body);

  // cabin
  if (!isOpen && !isRail) {
    const cab = cabinOf(def, b);
    const cabGeo = keepD(loftCabin(def, b, cab));
    const cabMesh = new THREE.Mesh(cabGeo, [liveryMat, GLASS()]);
    cabMesh.castShadow = true;
    bodyG.add(cabMesh);
    // mirrors
    const mu = c.to - (c.to - c.roofTo) * 0.35;
    const my = cab.yb + 0.13;
    for (const s of [1, -1]) {
      const zIn = cab.wb(mu) - 0.02;
      bodyG.add(box(0.06, 0.03, 0.12, TRIM(), X(mu), my - 0.02, s * (zIn + 0.05)));
      bodyG.add(pillow(0.12, 0.08, 0.14, paintMat, X(mu) - 0.01, my, s * (zIn + 0.14)));
    }
    if (lv.transmission >= 2) {
      const lampMat = keepD(new THREE.MeshStandardMaterial({ color: '#3a3845', emissive: '#000000' }));
      const lamp = ball(0.05, 0.035, 0.05, lampMat, X((c.roofFrom + c.roofTo) / 2), cab.roof((c.roofFrom + c.roofTo) / 2) + 0.03, 0);
      lamp.name = 'shiftlamp';
      bodyG.add(lamp);
    }
  } else if (isOpen) {
    const um = (c.from + c.to) / 2;
    const y = sh.belt;
    const cw = b.hw(um) * 1.3;
    bodyG.add(pillow(L * (c.to - c.from) * 0.9, 0.14, cw, TRIM(), X(um), y - 0.03, 0));
    for (const s of [1, -1]) {
      bodyG.add(pillow(0.18, 0.36, 0.42, std('#2a2833'), X(um) - 0.18, y + 0.12, s * cw * 0.25));
      bodyG.add(pillow(0.14, 0.18, 0.3, paintMat, X(c.from + 0.02), y + 0.08, s * cw * 0.25));
    }
    // windscreen and frame
    const wsx = X(c.to) - 0.06;
    const ws = pillow(0.03, 0.3, cw * 0.92, GLASS(), wsx, y + 0.14, 0);
    ws.rotation.z = 0.55;
    bodyG.add(ws);
    const fr = pillow(0.04, 0.035, cw * 0.95, paintMat, wsx - 0.08, y + 0.27, 0);
    bodyG.add(fr);
    // the driver
    const hr = 0.16;
    const hx = X(um) - 0.08;
    bodyG.add(ball(hr, hr, hr, std(look.helmet[0], { rough: 0.25, metal: 0.1 }), hx, y + 0.24, -cw * 0.25));
    bodyG.add(ball(hr * 0.75, hr * 0.55, hr * 0.85, std('#111118', { rough: 0.1 }), hx + hr * 0.45, y + 0.24, -cw * 0.25));
    bodyG.add(box(hr * 1.6, hr * 0.3, hr * 0.32, std(look.helmet[1]), hx, y + 0.24 + hr * 0.82, -cw * 0.25));
    bodyG.add(pillow(0.3, 0.3, 0.36, std(look.suit, { rough: 0.9 }), hx - 0.04, y + 0.02, -cw * 0.25));
  } else {
    // rail dragster: cockpit cage and a canopy wing on struts
    const um = 0.17;
    bodyG.add(pillow(0.7, 0.3, 0.5, TRIM(), X(um), sh.belt + 0.05, 0));
    bodyG.add(ball(0.17, 0.17, 0.17, std(look.helmet[0], { rough: 0.25 }), X(um), sh.belt + 0.28, 0));
    bodyG.add(ball(0.13, 0.1, 0.15, std('#111118', { rough: 0.1 }), X(um) + 0.08, sh.belt + 0.28, 0));
  }

  // wheel wells and underbody (dark), so the arches read as holes
  for (const [u, r] of [[sh.wheels.front, wr], [sh.wheels.rear, rearR]] as [number, number][]) {
    if (isRail) continue;
    const R = r * 1.14 + 0.035;
    // a dark liner fills the arch behind the wheel; it must stay under the hood and boot
    const lo = sh.clear;
    const hi = Math.min(r + R, b.top(clamp(u - R / L, 0, 1)) - 0.08, b.top(clamp(u + R / L, 0, 1)) - 0.08, b.top(u) - 0.08);
    if (hi > lo + 0.05) bodyG.add(box(R * 2, hi - lo, Math.max(0.2, b.hw(u) * 2 - tw * 2 - 0.06), std('#101014', { rough: 1 }), X(u), (hi + lo) / 2, 0));
    // wide-body cars get bolted-on arch flares
    if (has('wide'))
      for (const s of [1, -1]) {
        const flare = mesh(new THREE.TorusGeometry(R + 0.005, 0.05, 8, 22, Math.PI + 0.4), TRIM(), X(u), r, s * (b.hw(u) - 0.04));
        flare.rotation.z = -0.2;
        bodyG.add(flare);
      }
  }
  if (!isRail) bodyG.add(box(L * 0.82, 0.06, b.W * 0.7, std('#101014', { rough: 1 }), 0, sh.clear + 0.06, 0));

  // face: lamps, grille, intake
  const uN = 0.965;
  const topN = b.top(uN);
  const botN = b.bottom(uN);
  const hN = topN - botN;
  // just under the hood line, on the corners: visible from the front and from above
  const lampY = topN - Math.min(0.11, hN * 0.28);
  const zL = b.hw(uN) * 0.6;
  const atNose = (y: number, z: number, inset: number): number => surfaceX(b, y, z, true) - inset;
  switch (sh.lights) {
    case 'slim':
      for (const s of [1, -1]) {
        const z = b.hw(uN) * 0.6;
        const x = atNose(lampY, z, 0.03);
        const frame = pillow(0.09, 0.11, b.W * 0.32, std('#3a3a46', { rough: 0.3, metal: 0.3 }), x - 0.01, lampY, s * z);
        frame.rotation.y = s * 0.35;
        bodyG.add(frame);
        const l = pillow(0.09, 0.085, b.W * 0.29, LAMP(), x + 0.008, lampY + 0.004, s * z);
        l.rotation.y = s * 0.35;
        bodyG.add(l);
        const d = pillow(0.05, 0.02, b.W * 0.22, DRL(), x + 0.018, lampY - 0.055, s * z);
        d.rotation.y = s * 0.35;
        bodyG.add(d);
      }
      break;
    case 'rect':
      for (const s of [1, -1]) {
        const x = atNose(lampY, zL, 0.03);
        bodyG.add(pillow(0.08, 0.17, b.W * 0.24, TRIM(), x, lampY, s * zL));
        bodyG.add(pillow(0.07, 0.13, b.W * 0.2, LAMP(), x + 0.02, lampY, s * zL));
      }
      break;
    case 'bar': {
      const x = atNose(lampY, 0, 0.02);
      bodyG.add(pillow(0.06, 0.05, b.W * 0.82, LAMP(), x, lampY, 0));
      break;
    }
    case 'round':
      for (const s of [1, -1]) {
        const x = atNose(lampY, zL, 0.05);
        bodyG.add(ball(0.06, 0.12, 0.12, LAMP(), x + 0.02, lampY, s * zL));
        const ring = mesh(new THREE.TorusGeometry(0.12, 0.022, 8, 22), CHROME(), x + 0.02, lampY, s * zL);
        ring.rotation.y = Math.PI / 2;
        bodyG.add(ring);
      }
      break;
    case 'quad':
      for (const s of [1, -1])
        for (const k of [0.4, 0.72]) {
          const z = b.hw(uN) * k;
          const x = atNose(lampY, z, 0.04);
          bodyG.add(ball(0.05, 0.085, 0.085, LAMP(), x + 0.02, lampY, s * z));
        }
      break;
    case 'popup':
      for (const s of [1, -1]) {
        const u2 = 0.88;
        bodyG.add(pillow(0.3, 0.07, b.W * 0.22, paintMat, X(u2), b.top(u2) - 0.01, s * zL));
        bodyG.add(pillow(0.04, 0.05, b.W * 0.18, LAMP(), atNose(lampY - 0.08, zL, 0.01), lampY - 0.08, s * zL));
      }
      break;
  }
  const grY = botN + hN * 0.3;
  switch (sh.grille) {
    case 'wide':
      bodyG.add(pillow(0.08, hN * 0.22, b.W * 0.48, TRIM(), atNose(grY, 0, 0.02), grY, 0));
      break;
    case 'slim':
      bodyG.add(pillow(0.06, hN * 0.1, b.W * 0.4, TRIM(), atNose(grY + hN * 0.12, 0, 0.015), grY + hN * 0.12, 0));
      break;
    case 'oval':
      bodyG.add(ball(0.05, hN * 0.16, b.W * 0.26, TRIM(), atNose(grY, 0, 0.02), grY, 0));
      break;
    case 'twin':
      for (const s of [1, -1]) bodyG.add(pillow(0.07, hN * 0.2, b.W * 0.12, TRIM(), atNose(grY + 0.04, b.W * 0.08, 0.02), grY + 0.04, s * b.W * 0.08));
      break;
    case 'mesh':
      bodyG.add(pillow(0.08, hN * 0.3, b.W * 0.56, std('#18181e', { rough: 0.4 }), atNose(grY, 0, 0.02), grY, 0));
      break;
    case 'upright':
      bodyG.add(pillow(0.08, hN * 0.36, b.W * 0.5, CHROME(), atNose(grY + 0.05, 0, 0.03), grY + 0.05, 0));
      bodyG.add(pillow(0.08, hN * 0.3, b.W * 0.44, TRIM(), atNose(grY + 0.05, 0, 0.02), grY + 0.05, 0));
      break;
    case 'none':
      break;
  }
  if (c.kind !== 'bug' && !isRail && sh.grille !== 'upright') bodyG.add(pillow(0.06, hN * 0.12, b.W * 0.62, TRIM(), atNose(botN + hN * 0.1, 0, 0.012), botN + hN * 0.1, 0));
  if (has('bullbar')) {
    const bx = surfaceX(b, sh.clear + 0.3, 0, true) + 0.1;
    for (const y of [sh.clear + 0.18, sh.clear + 0.5]) bodyG.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, b.W * 0.78, 10).rotateX(Math.PI / 2), CHROME(), bx, y, 0));
    for (const z of [-0.3, 0.3]) bodyG.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 10), CHROME(), bx, sh.clear + 0.34, z));
  }
  if (has('chrome') && !isRail) {
    bodyG.add(pillow(0.08, 0.08, b.W * 0.9, CHROME(), atNose(sh.clear + 0.14, 0, 0.02), sh.clear + 0.14, 0));
    bodyG.add(pillow(0.08, 0.08, b.W * 0.9, CHROME(), surfaceX(b, sh.clear + 0.14, 0, false) + 0.02, sh.clear + 0.14, 0));
  }

  // tail: lamps, plate, exhausts
  const uT = 0.03;
  const topT = b.top(uT);
  const botT = b.bottom(uT);
  const hT = topT - botT;
  const tlY = topT - Math.min(0.13, hT * 0.3);
  const atTail = (y: number, z: number, inset: number): number => surfaceX(b, y, z, false) + inset;
  switch (sh.tails) {
    case 'bar':
    case 'strip': {
      const x = atTail(tlY, 0, 0.02);
      bodyG.add(pillow(0.05, sh.tails === 'bar' ? 0.07 : 0.04, b.W * 0.82, TAIL(), x, tlY, 0));
      break;
    }
    case 'rect':
      for (const s of [1, -1]) bodyG.add(pillow(0.05, 0.13, b.W * 0.22, TAIL(), atTail(tlY, b.W * 0.33, 0.02), tlY, s * b.W * 0.33));
      break;
    case 'round':
      for (const s of [1, -1])
        for (const k of [0.25, 0.38]) bodyG.add(ball(0.03, 0.075, 0.075, TAIL(), atTail(tlY, b.W * k, 0.015), tlY, s * b.W * k));
      break;
    case 'split':
      for (const s of [1, -1]) for (let i = 0; i < 3; i++) bodyG.add(pillow(0.04, 0.14, 0.07, TAIL(), atTail(tlY, b.W * (0.2 + i * 0.07), 0.015), tlY, s * b.W * (0.2 + i * 0.07)));
      break;
  }
  if (!isRail) bodyG.add(box(0.02, 0.11, 0.4, std('#f4f4f4'), atTail(botT + hT * 0.4, 0, 0.012), botT + hT * 0.4, 0));
  const pipes = def.hp > 300 || lv.engine >= 6 ? 2 : 1;
  const pipeZ = pipes === 2 ? [b.W * 0.3, -b.W * 0.3] : [-b.W * 0.3];
  const flames: THREE.Object3D[] = [];
  for (const z of pipeZ) {
    const py = sh.clear + 0.1;
    const px = atTail(py, z, -0.04);
    const pipe = mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.18, 12).rotateZ(Math.PI / 2), CHROME(), px, py, z);
    bodyG.add(pipe);
    if (lv.engine >= 6) {
      const flame = mesh(keepD(new THREE.ConeGeometry(0.07, 0.6, 8).rotateZ(Math.PI / 2)), std('#ff8a1f', { emissive: '#ff5a00', ei: 2 }), px - 0.38, py, z);
      flame.visible = false;
      flame.name = 'flame';
      bodyG.add(flame);
      flames.push(flame);
    }
  }

  // parts and features
  const wingLevel = lv.aero >= 7 || has('bigwing') ? 2 : lv.aero >= 4 || has('wing') ? 1 : 0;
  const deckU = 0.07;
  const deckY = b.top(deckU);
  if (!isRail) {
    if (wingLevel) {
      const wh = wingLevel === 2 ? 0.36 : 0.18;
      const wing = pillow(0.38, 0.05, b.W * (wingLevel === 2 ? 1.0 : 0.88), std('#1d1c24', { rough: 0.35, metal: 0.2 }), X(deckU), deckY + wh, 0);
      wing.rotation.z = -0.1;
      bodyG.add(wing);
      for (const s of [1, -1]) bodyG.add(box(0.12, wh, 0.04, TRIM(), X(deckU) + 0.02, deckY + wh / 2, s * b.W * 0.3));
      if (wingLevel === 2) for (const s of [1, -1]) bodyG.add(box(0.42, 0.2, 0.025, TRIM(), X(deckU), deckY + wh + 0.06, s * b.W * 0.5));
    } else if (lv.aero >= 1) bodyG.add(pillow(0.16, 0.05, b.W * 0.7, paintMat, X(0.04), b.top(0.04) + 0.02, 0));
    if (lv.aero >= 2 || has('lip')) bodyG.add(pillow(0.3, 0.035, b.W * 0.9, TRIM(), surfaceX(b, sh.clear + 0.08, 0, true) - 0.1, sh.clear + 0.02, 0));
    if (lv.aero >= 5) for (let i = -2; i <= 2; i++) bodyG.add(box(0.36, 0.1, 0.02, TRIM(), X(0.04), sh.clear + 0.05, i * b.W * 0.12));
    if ((lv.engine >= 3 || has('scoop')) && !isOpen) {
      const su = 0.78;
      const scoop = pillow(0.55, 0.12, b.W * 0.3, lv.engine >= 3 ? TRIM() : paintMat, X(su), b.top(su) + 0.025, 0);
      scoop.rotation.z = 0.04;
      bodyG.add(scoop);
      bodyG.add(box(0.03, 0.06, b.W * 0.24, std('#08080a'), X(su) + 0.27, b.top(su) + 0.04, 0));
    }
    if (has('vents')) for (let i = 0; i < 4; i++) bodyG.add(box(0.04, 0.015, b.W * 0.5, TRIM(), X(0.12 + i * 0.03), b.top(0.12 + i * 0.03) + 0.008, 0));
    if (has('roofscoop') && !isOpen) bodyG.add(pillow(0.34, 0.15, 0.26, TRIM(), X(c.roofFrom) - 0.06, c.roof + 0.04, 0));
    if (has('sidepipes')) for (const s of [1, -1]) bodyG.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, L * 0.36, 12).rotateZ(Math.PI / 2), CHROME(), X(0.5), sh.clear + 0.12, s * (b.W / 2 + 0.02)));
    if (has('bed')) {
      const u0 = 0.03;
      const u1 = c.from - 0.015;
      bodyG.add(box(L * (u1 - u0), 0.05, b.W * 0.82, std('#16161c', { rough: 0.9 }), X((u0 + u1) / 2), sh.deck - 0.01, 0));
    }
    if (has('hump')) bodyG.add(pillow(1.3, 0.34, b.W * 0.46, TRIM(), X(0.72), sh.cowl + 0.12, 0));
    if (lv.looks >= 4) {
      const glow = new THREE.Mesh(keepD(new THREE.PlaneGeometry(L * 0.78, b.W * 1.15)), keepD(new THREE.MeshBasicMaterial({ color: lv.looks >= 7 ? '#ff5fa2' : '#c4f034', transparent: true, opacity: 0.35, depthWrite: false })));
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.02;
      glow.name = 'glow';
      root.add(glow);
    }
  } else {
    // rail: chrome frame rails, engine block, big rear wing on struts, small front wing
    for (const s of [1, -1]) bodyG.add(box(L * 0.75, 0.05, 0.05, CHROME(), X(0.52), sh.clear + 0.16, s * 0.3));
    bodyG.add(pillow(0.7, 0.5, 0.62, std('#2a2a33', { metal: 0.6, rough: 0.35 }), X(0.28), sh.deck + 0.12, 0));
    bodyG.add(pillow(0.36, 0.36, 0.36, CHROME(), X(0.28), sh.deck + 0.5, 0));
    const wy = sh.deck + 1.25;
    bodyG.add(pillow(0.9, 0.08, 1.7, TRIM(), X(0.03), wy, 0));
    for (const s of [1, -1]) bodyG.add(box(0.07, 1.1, 0.06, TRIM(), X(0.04), wy - 0.55, s * 0.55));
    bodyG.add(pillow(0.3, 0.04, 1.0, TRIM(), X(0.99), sh.clear + 0.1, 0));
  }

  // wheels (they spin; their parts are merged per wheel)
  const wheels: THREE.Object3D[] = [];
  const slick = lv.tyres >= 5 || isRail;
  const addWheel = (u: number, r: number, w: number, s: 1 | -1): void => {
    const wg = buildWheel(r, w, look, s, slick, disposables);
    const z = isRail ? s * (u < 0.5 ? 0.75 : 0.42) : s * (b.hw(u) - w / 2 + 0.05);
    wg.position.set(X(u), r, z);
    root.add(wg);
    wheels.push(wg);
    // brake disc and caliper (do not spin)
    if (!isRail && r > 0.25) {
      root.add(mesh(keepD(new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.03, 20).rotateX(Math.PI / 2)), std('#6a6a72', { metal: 0.8, rough: 0.35 }), X(u), r, z - s * w * 0.1));
      root.add(pillow(0.1, 0.16, 0.07, std(def.tier >= 3 || lv.transmission >= 4 ? '#e8262f' : '#3a3a44', { rough: 0.4 }), X(u) + r * 0.32, r + r * 0.22, z + s * w * 0.12));
    }
  };
  for (const s of [1, -1] as const) {
    addWheel(sh.wheels.rear, rearR, isRail || sh.wheels.rearR ? tw * 1.5 : tw, s);
    addWheel(sh.wheels.front, wr, isRail ? tw * 0.4 : tw, s);
  }

  // suspension: lowered body
  bodyG.position.y = -Math.min(lv.suspension * 0.014, sh.clear - 0.07);

  // blob shadow
  const blob = new THREE.Mesh(keepD(new THREE.PlaneGeometry(L * 1.2, b.W * 1.45)), keepD(new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.012;
  blob.name = 'blob';
  root.add(blob);

  // smoke pool
  const smoke: THREE.Mesh[] = [];
  const smokeGeo = keepD(new THREE.SphereGeometry(0.4, 8, 6));
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(smokeGeo, keepD(new THREE.MeshBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.5, depthWrite: false })));
    m.visible = false;
    m.name = 'smoke';
    root.add(m);
    smoke.push(m);
  }

  // merge the body's static parts per material
  let shiftLamp: THREE.MeshStandardMaterial | null = null;
  bodyG.traverse((o) => {
    if (o instanceof THREE.Mesh && o.name === 'shiftlamp') shiftLamp = o.material as THREE.MeshStandardMaterial;
  });
  disposables.push(...mergeStatic(bodyG, (o) => o.name === 'flame' || o.name === 'shiftlamp' || (o instanceof THREE.Mesh && Array.isArray(o.material)) || o === body, { cast: true, receive: false }));
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry && !disposables.includes(o.geometry)) disposables.push(o.geometry);
  });

  return {
    group: root,
    wheels,
    wheelR: wr,
    flames,
    shiftLamp,
    smoke,
    len: L,
    dispose() {
      for (const d of new Set(disposables)) d.dispose();
    },
  };
}

// ---------------------------------------------------------------- the world
interface World {
  group: THREE.Group;
  lamps: THREE.MeshStandardMaterial[];
  clouds: THREE.Group;
  dispose(): void;
}

function textTexture(text: string, bg: string, fg: string, w = 256, h = 128, size = 72): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = `900 ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function checkerTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const ctx = cv.getContext('2d')!;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#1d1238' : '#ffffff';
      ctx.fillRect(i * 16, j * 16, 16, 16);
    }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  return t;
}

function windowsTexture(base: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 10; j++) {
      ctx.fillStyle = (i * 7 + j * 3) % 5 === 0 ? '#fff6c8' : '#8fd0ff';
      ctx.fillRect(6 + i * 14, 6 + j * 12, 9, 7);
    }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** The sky dome (also the scene's reflections). */
function skyDome(env: EnvDef): THREE.Mesh {
  const geo = new THREE.SphereGeometry(950, 32, 16);
  const pos = geo.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(env.sky[0]);
  const bottom = new THREE.Color(env.sky[1]);
  // below the horizon: a neutral grey, so chrome and paint do not pick up the grass colour
  const ground = new THREE.Color(env.track).lerp(new THREE.Color('#9aa0aa'), 0.5);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 950;
    const cc = y >= 0 ? bottom.clone().lerp(top, Math.pow(y, 0.55)) : bottom.clone().lerp(ground, Math.min(1, -y * 6));
    colors.set([cc.r, cc.g, cc.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
}

function buildWorld(env: EnvDef): World {
  const g = new THREE.Group();
  const dispose: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(d: T): T => {
    dispose.push(d);
    return d;
  };
  const lamps: THREE.MeshStandardMaterial[] = [];
  const add = (m: THREE.Object3D): void => {
    g.add(m);
  };

  const sky = skyDome(env);
  sky.position.set(200, -30, 0);
  sky.name = 'keep';
  keep(sky.geometry);
  keep(sky.material as THREE.Material);
  add(sky);
  const sun = mesh(keep(new THREE.SphereGeometry(18, 16, 10)), keep(new THREE.MeshBasicMaterial({ color: '#fffbe6', fog: false })), env.sun.x + 200, env.sun.y, env.sun.z);
  sun.name = 'keep';
  add(sun);

  // clouds drift: their own group, merged once
  const clouds = new THREE.Group();
  const cloudMat = keep(new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#d8e8ff', emissiveIntensity: 0.25, fog: false }));
  for (let i = 0; i < 14; i++) {
    for (let k = 0; k < 5; k++) {
      const s = 7 + noise(i * 5 + k, 11) * 9;
      const puff = mesh(new THREE.SphereGeometry(s, 10, 7), cloudMat, -150 + noise(i, 12) * 800 + k * s * 0.9 - s * 2, 90 + noise(i, 13) * 50 + noise(i * 5 + k, 12) * 4, (noise(i, 14) - 0.5) * 760 + (noise(i * 5 + k, 13) - 0.5) * s);
      puff.scale.y = 0.5;
      clouds.add(puff);
    }
  }
  keep({ dispose: () => undefined });
  dispose.push(...mergeStatic(clouds, () => false, { cast: false, receive: false }));
  clouds.name = 'keep';
  add(clouds);

  // ground, verge, strip
  const ground = mesh(new THREE.PlaneGeometry(2600, 2600).rotateX(-Math.PI / 2), lam(env.ground), 200, -0.03, 0);
  add(ground);
  add(mesh(new THREE.PlaneGeometry(640, 48).rotateX(-Math.PI / 2), lam(env.verge), 200, -0.015, 0));
  const asphalt = std(env.track, { rough: 0.95 });
  add(mesh(new THREE.PlaneGeometry(640, LANE_W * 2 + 1.6).rotateX(-Math.PI / 2), asphalt, 200, 0, 0));
  const groove = std(shade(env.track, -0.22), { rough: 1 });
  for (const z of LANE_Z) add(mesh(new THREE.PlaneGeometry(430, 1.7).rotateX(-Math.PI / 2), groove, 200, 0.004, z));
  for (let k = 0; k <= LANES; k++) add(mesh(new THREE.PlaneGeometry(640, 0.18).rotateX(-Math.PI / 2), lam(env.line), 200, 0.006, -LANE_W + k * LANE_PITCH));
  add(mesh(new THREE.PlaneGeometry(0.5, LANE_W * 2 + 1.6).rotateX(-Math.PI / 2), lam('#ffffff'), 0, 0.007, 0));
  for (let m = 20; m < DISTANCE_M; m += 20) {
    for (const z of [-(LANE_W + 1.0), LANE_W + 1.0]) add(mesh(new THREE.PlaneGeometry(0.7, 1.4).rotateX(-Math.PI / 2), lam('#ffffff'), m, 0.007, z));
    if (m % 100 === 0) {
      const t = keep(textTexture(`${m}`, '#ffd12e', '#1d1238', 128, 64, 40));
      const signMat = keep(new THREE.MeshLambertMaterial({ map: t }));
      const sign = mesh(new THREE.PlaneGeometry(1.6, 0.8), signMat, m, 1.7, -(LANE_W + 2.6));
      sign.rotation.y = -Math.PI / 2;
      sign.name = 'keep';
      add(sign);
      add(box(0.12, 1.3, 0.12, TRIM(), m, 0.65, -(LANE_W + 2.6)));
    }
  }
  // tyre walls (instanced: two colours)
  const tyreGeo = keep(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10));
  const tyreCount = Math.ceil(500 / 0.9) * 2 * 2;
  const tyresRed = new THREE.InstancedMesh(tyreGeo, lam('#ff3b4e'), tyreCount);
  const tyresWhite = new THREE.InstancedMesh(tyreGeo, lam('#ffffff'), tyreCount);
  let nr = 0;
  let nw = 0;
  const dummy = new THREE.Object3D();
  for (let x = -40; x < 460; x += 0.9) {
    const i = Math.round(x / 0.9);
    for (const z of [-(LANE_W + 1.9), LANE_W + 1.9])
      for (const layer of [0, 1]) {
        dummy.position.set(x + layer * 0.45, 0.15 + layer * 0.3, z);
        dummy.updateMatrix();
        if ((i >> 2) % 2) tyresRed.setMatrixAt(nr++, dummy.matrix);
        else tyresWhite.setMatrixAt(nw++, dummy.matrix);
      }
  }
  tyresRed.count = nr;
  tyresWhite.count = nw;
  keep(tyresRed);
  keep(tyresWhite);
  add(tyresRed);
  add(tyresWhite);
  // finish band and arch
  const chk = keep(checkerTexture());
  chk.repeat.set(2, 14);
  const fin = mesh(new THREE.PlaneGeometry(2.2, LANE_W * 2 + 1.6).rotateX(-Math.PI / 2), keep(new THREE.MeshLambertMaterial({ map: chk })), DISTANCE_M + 1, 0.008, 0);
  add(fin);
  for (const z of [-(LANE_W + 2.4), LANE_W + 2.4]) add(box(0.5, 8, 0.5, TRIM(), DISTANCE_M, 4, z));
  const ft = keep(textTexture('FINISH', '#ff3b4e', '#ffffff', 512, 96, 64));
  const banner = mesh(new THREE.PlaneGeometry(LANE_W * 2 + 5.3, 1.8), keep(new THREE.MeshLambertMaterial({ map: ft })), DISTANCE_M - 0.2, 8, 0);
  banner.rotation.y = -Math.PI / 2;
  banner.name = 'keep';
  add(banner);
  add(box(0.3, 1.9, LANE_W * 2 + 5.4, lam('#ff3b4e'), DISTANCE_M, 8, 0));
  // sponsor gantry behind the start
  const gt = keep(textTexture('LAUNCH CONTROL', '#ffd12e', '#1d1238', 1024, 128, 86));
  const gan = mesh(new THREE.PlaneGeometry(LANE_W * 2 + 5.3, 1.6), keep(new THREE.MeshLambertMaterial({ map: gt })), -13.75, 7.5, 0);
  gan.rotation.y = -Math.PI / 2;
  gan.name = 'keep';
  add(gan);
  add(box(0.4, 1.7, LANE_W * 2 + 5.4, lam('#ffd12e'), -14, 7.5, 0));
  for (const z of [-(LANE_W + 2.4), LANE_W + 2.4]) add(box(0.4, 7.5, 0.4, TRIM(), -14, 3.75, z));
  // the tree: a gantry over the strip ahead of the cars, a light cluster per lane
  const TX = 14;
  for (const z of [-(LANE_W + 1.6), LANE_W + 1.6]) add(box(0.3, 7.2, 0.3, TRIM(), TX, 3.6, z));
  add(box(0.35, 0.35, LANE_W * 2 + 3.5, TRIM(), TX, 7.2, 0));
  for (const z of LANE_Z) add(pillow(0.4, 1.9, 0.55, TRIM(), TX, 6.15, z));
  const lampGeo = keep(new THREE.SphereGeometry(0.14, 14, 10));
  ['#ffb703', '#ffb703', '#ffb703', '#06d6a0', '#e63946'].forEach((col, i) => {
    const m = keep(new THREE.MeshStandardMaterial({ color: '#3a3845', emissive: '#000000', roughness: 0.3 }));
    m.userData = { on: col };
    const inst = new THREE.InstancedMesh(lampGeo, m, LANES);
    LANE_Z.forEach((z, k) => {
      dummy.position.set(TX - 0.24, 6.9 - i * 0.36, z);
      dummy.updateMatrix();
      inst.setMatrixAt(k, dummy.matrix);
    });
    keep(inst);
    add(inst);
    lamps.push(m);
  });

  // grandstands: seats, roofs and an instanced crowd
  const palette = ['#1d1238', '#ffffff', '#ffd12e', '#22e4ff', '#ff4fc8', '#c4f034', '#ff6a1a'];
  const crowd = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(0.26, 6, 4)), keep(new THREE.MeshLambertMaterial({ color: '#ffffff' })), 24 * 2 * 3 * 11);
  let ci = 0;
  for (let seg = 0; seg < 24; seg++) {
    const x = -30 + seg * 20;
    for (const side of [1, -1]) {
      for (let row = 0; row < 3; row++) {
        add(box(19, 1, 2.6, lam(seg % 2 ? env.stands[0] : env.stands[1]), x, 0.5 + row, side * (LANE_W + 7.5 + row * 2.6)));
        for (let k = 0; k < 11; k++) {
          dummy.position.set(x - 8.5 + k * 1.7, 1.3 + row, side * (LANE_W + 7.5 + row * 2.6) + (noise(ci, 15) - 0.5));
          dummy.scale.setScalar(0.8 + noise(ci, 16) * 0.5);
          dummy.updateMatrix();
          crowd.setMatrixAt(ci, dummy.matrix);
          crowd.setColorAt(ci, new THREE.Color(palette[(ci * 7 + seg) % palette.length]!));
          ci++;
        }
      }
      add(box(19, 0.2, 4, lam(seg % 2 ? env.stands[1] : env.stands[0]), x, 5.4, side * (LANE_W + 13.1)));
      for (const dx of [-8, 8]) add(box(0.2, 2.4, 0.2, TRIM(), x + dx, 4.2, side * (LANE_W + 14.5)));
    }
  }
  crowd.count = ci;
  keep(crowd);
  add(crowd);
  for (let x = -30; x < 450; x += 1.6)
    for (const side of [1, -1]) {
      const f = mesh(new THREE.PlaneGeometry(0.5, 0.4), lam(palette[Math.abs(Math.round(x / 1.6)) % palette.length]!), x, 3.9, side * (LANE_W + 6.2));
      f.rotation.y = side > 0 ? 0 : Math.PI;
      add(f);
    }

  // scenery per strip
  const palm = (i: number, x: number, z: number): void => {
    const s = 0.8 + noise(i, 20) * 0.6;
    const trunk = mesh(new THREE.CylinderGeometry(0.16 * s, 0.3 * s, 7 * s, 7), lam('#9c6644'), x, 3.5 * s, z);
    trunk.rotation.z = (noise(i, 21) - 0.5) * 0.2;
    add(trunk);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const leaf = box(3.2 * s, 0.1 * s, 0.7 * s, lam(k % 2 ? '#40916c' : '#2d6a4f'), x + Math.cos(a) * 1.3 * s, 7 * s - 0.6 * s, z + Math.sin(a) * 1.3 * s);
      leaf.rotation.set(0, -a, -0.5);
      add(leaf);
    }
  };
  const pine = (i: number, x: number, z: number): void => {
    const s = 0.9 + noise(i, 22) * 0.8;
    add(box(0.4 * s, 1.4 * s, 0.4 * s, lam('#6f4e37'), x, 0.7 * s, z));
    for (let k = 0; k < 3; k++) add(mesh(new THREE.ConeGeometry((2.4 - k * 0.55) * s, 2.6 * s, 7), lam(k % 2 ? '#40916c' : '#2d6a4f'), x, (1.8 + k * 1.6) * s, z));
  };
  const cactus = (i: number, x: number, z: number): void => {
    const s = 0.8 + noise(i, 23) * 0.7;
    const cm = lam('#2d6a4f');
    add(box(0.5 * s, 3 * s, 0.5 * s, cm, x, 1.5 * s, z));
    add(box(0.35 * s, 1.2 * s, 0.35 * s, cm, x + 0.9 * s, 1.6 * s, z));
    add(box(1.0 * s, 0.35 * s, 0.35 * s, cm, x + 0.5 * s, 1.1 * s, z));
    add(box(0.35 * s, 1.4 * s, 0.35 * s, cm, x - 0.9 * s, 2.1 * s, z));
    add(box(1.0 * s, 0.35 * s, 0.35 * s, cm, x - 0.5 * s, 1.5 * s, z));
  };
  const windowMats = new Map<string, THREE.MeshLambertMaterial>();
  const building = (i: number, x: number, z: number, pastel: boolean): void => {
    const h = 10 + noise(i, 24) * (pastel ? 24 : 50);
    const w = 10 + noise(i, 25) * 10;
    const cols = pastel ? ['#ffb4a2', '#ffd6a5', '#caffbf', '#9bf6ff', '#bdb2ff', '#ffc6ff', '#fdffb6'] : ['#5a6c9e', '#7d8fc0', '#8ea4d2', '#6b7fb3', '#9fb3dd'];
    const base = cols[i % cols.length]!;
    let wm = windowMats.get(base);
    if (!wm) {
      const tx = keep(windowsTexture(base));
      tx.repeat.set(2, 4);
      wm = keep(new THREE.MeshLambertMaterial({ map: tx }));
      windowMats.set(base, wm);
    }
    add(box(w, h, w, wm, x, h / 2, z));
    add(box(w * 1.04, 0.6, w * 1.04, lam(shade(base, -0.2)), x, h + 0.3, z));
  };
  const mountain = (i: number, x: number, z: number, snow: boolean): void => {
    const h = 50 + noise(i, 31) * 80;
    const m = mesh(new THREE.ConeGeometry(60 + noise(i, 32) * 50, h, 6), lam(i % 3 ? env.far : env.far2), x, h / 2 - 4, z);
    m.rotation.y = noise(i, 33) * 3;
    add(m);
    if (snow) {
      const cap = mesh(new THREE.ConeGeometry(18, h * 0.3, 6), lam('#ffffff'), x, h - h * 0.15 - 4, z);
      cap.rotation.y = m.rotation.y;
      add(cap);
    }
  };
  const mesa = (i: number, x: number, z: number): void => {
    const h = 20 + noise(i, 34) * 40;
    const w = 30 + noise(i, 35) * 50;
    add(box(w, h, w * 0.7, lam(i % 2 ? env.far : env.far2), x, h / 2 - 2, z));
    add(box(w * 0.6, h * 0.35, w * 0.4, lam(env.far2), x, h + h * 0.17 - 2, z));
  };
  const sc = env.scenery;
  if (sc === 'bay') {
    add(mesh(new THREE.PlaneGeometry(1600, 700).rotateX(-Math.PI / 2), lam('#2ec4f0'), 200, -0.5, -400));
    add(mesh(new THREE.PlaneGeometry(1600, 24).rotateX(-Math.PI / 2), lam('#f6e3b4'), 200, -0.2, -48));
    for (let i = 0; i < 32; i++) {
      palm(i, -60 + i * 16 + noise(i, 26) * 8, -(LANE_W + 22 + noise(i, 27) * 10));
      palm(i + 50, -50 + i * 16 + noise(i, 28) * 8, LANE_W + 20 + noise(i, 29) * 6);
    }
    for (let i = 0; i < 26; i++) building(i, -80 + i * 24 + noise(i, 30) * 10, LANE_W + 44 + noise(i, 31) * 30, true);
    for (let i = 0; i < 14; i++) mountain(i, -200 + i * 60, 330 + noise(i, 36) * 80, false);
  } else if (sc === 'canyon') {
    for (let i = 0; i < 22; i++) mesa(i, -220 + (i >> 1) * 60 + noise(i, 37) * 30, (i % 2 ? 1 : -1) * (150 + noise(i, 38) * 120));
    for (let i = 0; i < 40; i++) cactus(i, -50 + i * 13 + noise(i, 39) * 6, (i % 2 ? 1 : -1) * (LANE_W + 20 + noise(i, 40) * 14));
    for (let i = 0; i < 10; i++) mountain(i + 40, -200 + i * 80, (i % 2 ? 1 : -1) * 420, false);
  } else if (sc === 'alpine') {
    for (let i = 0; i < 70; i++) pine(i, -60 + (i >> 1) * 15 + noise(i, 41) * 8, (i % 2 ? 1 : -1) * (LANE_W + 20 + noise(i, 42) * 30));
    for (let i = 0; i < 22; i++) mountain(i, -260 + (i >> 1) * 60, (i % 2 ? 1 : -1) * (240 + noise(i, 43) * 120), true);
    for (let i = 0; i < 8; i++) {
      const x = -20 + i * 60;
      const z = (i % 2 ? 1 : -1) * (LANE_W + 60 + noise(i, 44) * 20);
      add(box(8, 5, 8, lam('#f4e1c1'), x, 2.5, z));
      const roof = mesh(new THREE.ConeGeometry(7.5, 4, 4), lam('#9a3b3b'), x, 7, z);
      roof.rotation.y = Math.PI / 4;
      add(roof);
    }
  } else {
    for (let i = 0; i < 44; i++) building(i, -80 + (i >> 1) * 28 + noise(i, 45) * 10, (i % 2 ? 1 : -1) * (LANE_W + 36 + noise(i, 46) * 50), i % 3 === 0);
    for (let i = 0; i < 20; i++) palm(i + 80, -40 + i * 24 + noise(i, 47) * 8, (i % 2 ? 1 : -1) * (LANE_W + 21 + noise(i, 48) * 4));
    for (let i = 0; i < 12; i++) mountain(i + 60, -200 + i * 70, (i % 2 ? 1 : -1) * 460, false);
  }

  dispose.push(...mergeStatic(g, (o) => o.name === 'keep' || o instanceof THREE.InstancedMesh, { cast: false, receive: true }));
  return {
    group: g,
    lamps,
    clouds,
    dispose() {
      for (const d of dispose) d.dispose();
    },
  };
}

// ---------------------------------------------------------------- the stage
export interface FixedCamera {
  pos: [number, number, number];
  aim: [number, number, number];
  fov?: number;
}

export type Framing = 'center' | 'right' | 'thumb';
/** What the showcase camera looks at: the whole car on the turntable, or where a part shows on it. */
export type ShowFocus = 'car' | 'engine' | 'transmission' | 'suspension' | 'tyres' | 'aero' | 'looks';
/** Camera per focus: a fixed angle (null = the turntable's), distance and height factors, and where it aims (x in car lengths, y in metres). */
const FOCUS: Record<ShowFocus, { angle: number | null; dist: number; height: number; aimX: number; aimY: number }> = {
  car: { angle: null, dist: 1, height: 0.3, aimX: 0, aimY: 0.62 },
  engine: { angle: -0.5, dist: 0.78, height: 0.62, aimX: 0.2, aimY: 0.85 },
  transmission: { angle: Math.PI + 0.55, dist: 0.8, height: 0.42, aimX: -0.18, aimY: 0.85 },
  suspension: { angle: -Math.PI / 2, dist: 0.74, height: 0.02, aimX: 0.12, aimY: 0.42 },
  tyres: { angle: -1.1, dist: 0.66, height: 0.1, aimX: 0.24, aimY: 0.4 },
  aero: { angle: Math.PI + 0.72, dist: 0.9, height: 0.5, aimX: -0.12, aimY: 0.8 },
  looks: { angle: -0.95, dist: 0.95, height: 0.48, aimX: 0, aimY: 0.4 },
};
/** Where the garage turntable parks the car: down the strip, clear of the gantries. */
const SHOW_X = 70;

const lookKeyOf = (look: CarLook): string => `${look.def.id}|${JSON.stringify(look.levels)}|${look.paint}|${look.livery}|${look.wheels}|${look.helmet.join()}|${look.suit}`;
export const lookKey = lookKeyOf;

export class Stage3D {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(56, 1, 0.1, 1800);
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private world: World | null = null;
  private envId = '';
  private envMap: THREE.Texture | null = null;
  private pmrem: THREE.PMREMGenerator;
  private cars: (CarRig | null)[] = Array.from({ length: LANES }, () => null);
  private carKeys: string[] = Array.from({ length: LANES }, () => '');
  private camPos = new THREE.Vector3(-9, 3.2, 0);
  private camAim = new THREE.Vector3(8, 1, 0);
  private w = 1;
  private h = 1;
  private smokeT = 0;
  private disposed = false;
  /** The showcase camera, eased toward its focus (angle, distance, height, aim). */
  private show = { a: 0, d: 0, h: 0, ax: 0, ay: 0, ready: false };

  constructor(canvas?: HTMLCanvasElement, shadows = true) {
    this.canvas = canvas ?? document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !canvas });
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#88aa88', 0.75);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff6e0', 2.4);
    this.sun.castShadow = shadows;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -14;
    sc.right = 14;
    sc.top = 14;
    sc.bottom = -14;
    sc.near = 1;
    sc.far = 120;
    this.sun.shadow.bias = -0.0015;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  setEnv(id: string): void {
    if (id === this.envId && this.world) return;
    const env = ENV_DEFS[id] ?? ENV_DEFS['e-bay']!;
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
    }
    this.world = buildWorld(env);
    this.scene.add(this.world.group);
    this.envId = env.id;
    this.scene.fog = new THREE.Fog(env.fog, 140, 760);
    this.hemi.color.set(env.light[0]);
    this.hemi.groundColor.set(env.light[1]);
    // reflections: the strip's own sky, ground and sun
    const envScene = new THREE.Scene();
    const dome = skyDome(env);
    envScene.add(dome);
    const sunBall = new THREE.Mesh(new THREE.SphereGeometry(60, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    sunBall.position.set(env.sun.x * 2, env.sun.y * 2.5, env.sun.z * 2);
    envScene.add(sunBall);
    this.envMap?.dispose();
    this.envMap = this.pmrem.fromScene(envScene, 0, 1, 2000).texture;
    this.scene.environment = this.envMap;
    dome.geometry.dispose();
    (dome.material as THREE.Material).dispose();
    sunBall.geometry.dispose();
    (sunBall.material as THREE.Material).dispose();
  }

  /** Puts a car in a lane (null empties it). The same look is not rebuilt. */
  setCar(i: number, look: CarLook | null): void {
    if (i < 0 || i >= LANES) return;
    const key = look ? lookKeyOf(look) : '';
    if (key === this.carKeys[i] && (this.cars[i] || !look || getModel(specFor(look.def).base) === undefined)) {
      if (this.cars[i]) this.cars[i]!.group.position.set(0, 0, LANE_Z[i]!);
      return;
    }
    const old = this.cars[i];
    if (old) {
      this.scene.remove(old.group);
      old.dispose();
      this.cars[i] = null;
    }
    this.carKeys[i] = key;
    if (!look) return;
    const base = specFor(look.def).base;
    const model = getModel(base);
    if (model === undefined) {
      // first use of this body: load it, then build if the lane still wants this car
      void loadModel(base).then(() => {
        if (!this.disposed && this.carKeys[i] === key && !this.cars[i]) this.setCar(i, look);
      });
      return;
    }
    const rig = model ? buildModelCar(look, model) : buildCar(look);
    rig.group.position.set(0, 0, LANE_Z[i]!);
    this.scene.add(rig.group);
    this.cars[i] = rig;
  }

  /** Whether every lane that wants a car has one (bodies still loading make this false). */
  carsReady(): boolean {
    return this.carKeys.every((k, i) => !k || !!this.cars[i]);
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.w, this.h, false);
  }

  setPixelRatio(dpr: number): void {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.w, this.h, false);
  }

  private placeCar(i: number, s: CarState, dt: number, t: number): void {
    const rig = this.cars[i];
    if (!rig) return;
    rig.group.position.set(s.x, 0, LANE_Z[i]!);
    const spin = s.spinning ? s.v + 18 : s.v;
    for (const w of rig.wheels) w.rotation.z -= (spin * dt) / ((w.userData.r as number | undefined) ?? rig.wheelR);
    rig.group.rotation.z = lerp(rig.group.rotation.z, s.v > 0.5 && s.rpm / s.redline > 0.6 ? 0.018 : 0, 0.1);
    const frac = s.rpm / s.redline;
    for (const f of rig.flames) f.visible = frac > 0.86 && !s.dead && Math.sin(t * 60) > -0.3;
    if (rig.shiftLamp) rig.shiftLamp.emissive.set(frac > 0.88 && Math.sin(t * 40) > 0 ? '#ff2a1a' : '#000000');
    for (const m of rig.smoke) {
      if (!m.visible) continue;
      const mt = m.material as THREE.MeshBasicMaterial;
      m.position.x -= (s.v * 0.3 + 2) * dt;
      m.position.y += 1.0 * dt;
      m.scale.addScalar(1.1 * dt);
      mt.opacity -= 0.8 * dt;
      if (mt.opacity <= 0) m.visible = false;
    }
    if ((s.spinning || s.dead) && t - this.smokeT > 0.05) {
      this.smokeT = t;
      const m = rig.smoke.find((x) => !x.visible);
      if (m) {
        const mt = m.material as THREE.MeshBasicMaterial;
        mt.color.set(s.dead ? '#444444' : '#f4f4f4');
        mt.opacity = 0.5;
        m.scale.setScalar(0.5);
        m.visible = true;
        m.position.set(s.dead ? rig.len * 0.3 : -rig.len * 0.35, s.dead ? 1.2 : 0.3, (Math.random() - 0.5) * 1.6);
      }
    }
  }

  private setFrame(framing: Framing): void {
    if (framing === 'right') {
      const fullW = this.w * 1.42;
      this.camera.aspect = fullW / this.h;
      this.camera.setViewOffset(fullW, this.h, 0, 0, this.w, this.h);
    } else {
      this.camera.aspect = this.w / this.h;
      this.camera.clearViewOffset();
    }
  }

  /** Draws one race frame from behind the player's car (or from a fixed camera, for pictures). */
  renderRace(cars: CarState[], ambers: number, green: boolean, t: number, dt: number, fixed?: FixedCamera): void {
    if (!this.world) this.setEnv('e-bay');
    for (let i = 0; i < LANES; i++) {
      const c = cars[i];
      if (c) this.placeCar(i, c, dt, t);
      else if (this.cars[i]) this.cars[i]!.group.visible = false;
    }
    for (let i = 0; i < cars.length; i++) if (this.cars[i]) this.cars[i]!.group.visible = true;
    const me = cars[0]!;
    this.world!.lamps.forEach((m, i) => {
      const on = i < 3 ? ambers > i && !green : i === 3 ? green : false;
      m.emissive.set(on ? (m.userData.on as string) : '#000000');
      m.color.set(on ? (m.userData.on as string) : '#3a3845');
    });
    this.world!.clouds.position.x += dt * 1.5;
    this.setFrame('center');
    const narrow = this.w < this.h;
    // pulled back and up far enough to see the rivals in the next lanes (all five in landscape)
    const back = (narrow ? 13.5 : 11.5) + Math.min(4, me.v * 0.04);
    const target = new THREE.Vector3(me.x - back, (narrow ? 6.0 : 4.5) + Math.min(1, me.v * 0.01), 0);
    const aim = new THREE.Vector3(me.x + (narrow ? 16 : 14), 0.5, 0);
    const k = Math.min(1, dt * 6);
    this.camPos.lerp(target, k);
    this.camAim.lerp(aim, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camAim);
    this.camera.fov = (narrow ? 64 : 54) + Math.min(10, me.v * 0.09);
    if (fixed) {
      this.camera.position.set(...fixed.pos);
      this.camera.lookAt(...fixed.aim);
      this.camera.fov = fixed.fov ?? 50;
    }
    this.camera.updateProjectionMatrix();
    this.sun.position.set(me.x - 10, 40, 22);
    this.sun.target.position.set(me.x + 6, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * The garage turntable or a thumbnail: car 0 parked on the strip, the others hidden. With a part
   * `focus` the camera swings to where that part shows; `dt` > 0 eases it there, 0 jumps.
   */
  renderShowcase(angle: number, framing: Framing = 'center', cloudDt = 0, focus: ShowFocus = 'car', dt = 0): void {
    if (!this.world) this.setEnv('e-bay');
    const rig = this.cars[0];
    for (let i = 1; i < LANES; i++) if (this.cars[i]) this.cars[i]!.group.visible = false;
    if (rig) {
      rig.group.visible = true;
      rig.group.position.set(SHOW_X, 0, 0);
      rig.group.rotation.z = 0;
    }
    this.world!.clouds.position.x += cloudDt;
    this.setFrame(framing);
    const len = rig?.len ?? 4.5;
    const fov = framing === 'thumb' ? 30 : 38;
    this.camera.fov = fov;
    const vHalf = THREE.MathUtils.degToRad(fov / 2);
    const visibleShare = framing === 'right' ? 1 / 1.42 : 1;
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect);
    const want = framing === 'thumb' ? 0.8 : framing === 'right' ? 0.42 : 0.66;
    const across = len * 0.92 + 0.4;
    const dW = across / (2 * Math.tan(hHalf) * want * visibleShare);
    const dH = 2.0 / (2 * Math.tan(vHalf) * (framing === 'thumb' ? 0.8 : 0.55));
    const d = Math.max(dW, dH);
    const f = FOCUS[focus];
    const goal = { a: f.angle ?? angle, d: d * f.dist, h: focus === 'car' ? (framing === 'thumb' ? 0.22 : 0.3) : f.height, ax: f.aimX * len, ay: f.aimY };
    const sh = this.show;
    if (!sh.ready || dt <= 0) {
      Object.assign(sh, goal, { ready: dt > 0 });
    } else {
      const k = 1 - Math.exp(-dt * 4.5);
      // the shortest way round to the new angle
      let da = (goal.a - sh.a) % (Math.PI * 2);
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      sh.a += da * k;
      sh.d += (goal.d - sh.d) * k;
      sh.h += (goal.h - sh.h) * k;
      sh.ax += (goal.ax - sh.ax) * k;
      sh.ay += (goal.ay - sh.ay) * k;
    }
    this.camera.position.set(SHOW_X + sh.ax * 0.5 + Math.cos(sh.a) * sh.d, 0.75 + sh.d * sh.h, Math.sin(sh.a) * sh.d);
    this.camera.lookAt(SHOW_X + sh.ax, sh.ay, 0);
    this.camera.updateProjectionMatrix();
    this.sun.position.set(SHOW_X - 10, 40, 22);
    this.sun.target.position.set(SHOW_X, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    for (let i = 0; i < LANES; i++) this.setCar(i, null);
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
      this.world = null;
    }
    this.envMap?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

// ---------------------------------------------------------------- thumbnails (one offscreen stage, a queue)
let thumbStage: Stage3D | null = null;
const thumbCache = new Map<string, string>();
const thumbQueue: { key: string; look: CarLook; env: string }[] = [];
const thumbWaiters = new Map<string, Set<(url: string) => void>>();
let thumbBusy = false;

function renderThumb(look: CarLook, env: string): string {
  try {
    if (!thumbStage) {
      thumbStage = new Stage3D(undefined, false);
      thumbStage.resize(360, 200, 1);
    }
    thumbStage.setEnv(env);
    thumbStage.setCar(0, look);
    thumbStage.renderShowcase(-0.72, 'thumb');
    return thumbStage.canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

function pumpThumbs(): void {
  if (thumbBusy || !thumbQueue.length) return;
  thumbBusy = true;
  const base = specFor(thumbQueue[0]!.look.def).base;
  if (getModel(base) === undefined) {
    void loadModel(base).then(() => {
      thumbBusy = false;
      pumpThumbs();
    });
    return;
  }
  window.setTimeout(() => {
    thumbBusy = false;
    const job = thumbQueue.shift();
    if (job) {
      const waiting = thumbWaiters.get(job.key);
      if (waiting?.size) {
        const url = renderThumb(job.look, job.env);
        thumbCache.set(job.key, url);
        if (thumbCache.size > 240) thumbCache.delete(thumbCache.keys().next().value!);
        for (const cb of waiting) cb(url);
      }
      thumbWaiters.delete(job.key);
    }
    pumpThumbs();
  }, 12);
}

export const thumbKey = (look: CarLook, env = 'e-bay'): string => `${env}|${lookKeyOf(look)}`;
export const cachedThumb = (key: string): string | undefined => thumbCache.get(key);

/** Asks for a 3/4-front picture of a car; the callback runs later with a data URL ('' without WebGL). */
export function requestThumb(look: CarLook, env: string, cb: (url: string) => void): () => void {
  const key = thumbKey(look, env);
  let set = thumbWaiters.get(key);
  if (!set) {
    set = new Set();
    thumbWaiters.set(key, set);
    thumbQueue.push({ key, look, env });
  }
  set.add(cb);
  pumpThumbs();
  return () => {
    set.delete(cb);
  };
}
