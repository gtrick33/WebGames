import type { MountDef } from '../../data/mounts';
import type { Piece } from './hero';
import { mixRGB, OUTLINE_RGB, Painter, ramp, rgb, shadeAt, tone, type Ramp } from './kit';

/**
 * Mounts in layers (blueprint §6.5, COLLECTION_SYSTEM_DESIGN.md §3): the animal is painted as a back layer
 * (what is behind the rider) and a front layer (what is in front of them), and the rider — the hero's own
 * paper doll, cut at the hips — is drawn between the two, so every helm, chest piece, weapon and Wardrobe
 * look shows in the saddle without a picture for every combination. Painted at art resolution in the
 * paper doll's language: lit from the top left, a dark outline, ramps for every surface.
 *
 * Three views like the hero (down, up, side facing right; left is the side mirrored), a standing frame and
 * four walking frames. Every size below is in art pixels.
 */

export type MountView = 'down' | 'up' | 'side';

export interface MountFrame {
  w: number;
  h: number;
  /** Where the hero's ground point (their feet on foot) is on the picture. */
  gx: number;
  gy: number;
  /** Where the rider's hips (the hero picture's row RIDER_HIP) sit, per body. */
  seat: Record<MountDef['body'], [number, number]>;
}

export const MOUNT_FRAMES: Record<MountView, MountFrame> = {
  side: { w: 84, h: 58, gx: 42, gy: 55, seat: { horse: [40, 21], deer: [40, 20], boar: [40, 24] } },
  down: { w: 46, h: 66, gx: 23, gy: 55, seat: { horse: [23, 25], deer: [23, 25], boar: [23, 29] } },
  up: { w: 46, h: 66, gx: 23, gy: 55, seat: { horse: [23, 27], deer: [23, 27], boar: [23, 31] } },
};

/** The row of the hero picture at their hips: the rider is drawn down to here. */
export const RIDER_HIP = 44;

/** Walking frames (1–4); 0 stands. */
export const MOUNT_WALK_FRAMES = 4;

interface Body {
  /** Barrel half-length and half-height (side view). */
  len: number;
  depth: number;
  /** Leg length below the barrel, and thickness. */
  leg: number;
  thick: number;
  /** How high the barrel's middle is above the ground. */
  ride: number;
}

const BODIES: Record<MountDef['body'], Body> = {
  horse: { len: 19, depth: 8, leg: 17, thick: 4, ride: 26 },
  deer: { len: 17, depth: 7, leg: 19, thick: 3, ride: 27 },
  boar: { len: 18, depth: 10, leg: 9, thick: 4, ride: 20 },
};

const HOOF = rgb('#2a2026');
const WHITE: Ramp = ramp('#ece8e0');
const LEATHER: Ramp = ramp('#5a3a22');
const BRASS = rgb('#e8c060');

/** A tapered limb from (x0, y0) to (x1, y1), w0 wide at the top and w1 at the bottom, lit from the left. */
function limb(p: Painter, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, R: Ramp, socks?: number): void {
  const n = Math.max(1, Math.round(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cx = x0 + (x1 - x0) * t;
    const hw = (w0 + (w1 - w0) * t) / 2;
    const y = Math.round(y0 + (y1 - y0) * t);
    for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
      const k = (x + 0.5 - (cx - hw)) / (hw * 2);
      const ramp_ = socks !== undefined && y >= socks ? WHITE : R;
      p.set(x, y, k < 0.34 ? ramp_[1] : k < 0.72 ? ramp_[2] : ramp_[3]);
    }
  }
  // the hoof (or trotter)
  const hx = Math.round(x1 - w1 / 2 - 0.5);
  p.rect(hx, Math.round(y1) - 1, Math.round(w1) + 1, 2, HOOF);
}

/** A walking leg's offset: forward swing and lift, by frame and phase (diagonal pairs move together). */
function stride(frame: number, phase: number): { dx: number; lift: number } {
  if (frame === 0) return { dx: 0, lift: 0 };
  const a = ((frame - 1) / MOUNT_WALK_FRAMES) * Math.PI * 2 + phase;
  return { dx: Math.round(Math.sin(a) * 3), lift: Math.max(0, Math.round(Math.cos(a) * 2)) };
}

const coatOf = (m: MountDef): Ramp => ramp(m.coat);
const maneOf = (m: MountDef): Ramp => ramp(m.mane);

/** A shaded body part: a ball lit from the top left. */
const ball = (p: Painter, cx: number, cy: number, rx: number, ry: number, R: Ramp, light = 0): void => p.ball(cx, cy, rx, ry, R, { light, rim: true });

/* ------------------------------------------------------------------- side */

function sideLayers(m: MountDef, f: number, outline: boolean): { back: Painter; front: Painter } {
  const F = MOUNT_FRAMES.side;
  const b = BODIES[m.body];
  const back = new Painter(F.w, F.h);
  const front = new Painter(F.w, F.h);
  const C = coatOf(m);
  const M = maneOf(m);
  const dark = C.map((c) => tone(c, -0.25)) as Ramp;
  const gy = F.gy;
  const cx = F.gx - 2;
  const cy = gy - b.ride;
  const bob = f === 0 ? 0 : f % 2 === 0 ? -1 : 0;
  const y0 = cy + bob;
  const belly = y0 + b.depth;
  const sock = m.socks ? gy - 5 : undefined;
  const foreX = cx + b.len - 5;
  const hindX = cx - b.len + 6;
  // far legs (darker, behind everything)
  for (const [x, ph] of [
    [foreX - 3, Math.PI],
    [hindX + 3, 0],
  ] as const) {
    const s = stride(f, ph);
    limb(back, x, belly - 2, x + s.dx, gy - s.lift - 1, b.thick, b.thick - 1, dark, sock);
  }
  // the tail (behind the rump)
  const swish = f === 0 ? 0 : Math.round(Math.sin(((f - 1) / MOUNT_WALK_FRAMES) * Math.PI * 2));
  if (m.body === 'horse') {
    front.poly(
      [
        [hindX - 4, y0 - 5],
        [hindX - 1, y0 - 3],
        [hindX - 6 + swish, y0 + 14],
        [hindX - 9 + swish, y0 + 16],
        [hindX - 9, y0 + 4],
      ],
      (x, y) => shadeAt(M, 0.3 - (x - (hindX - 9)) * 0.06 - (y - y0) * 0.02, x, y),
    );
  } else if (m.body === 'deer') {
    ball(front, hindX - 5, y0 - 2, 2, 3, WHITE, 0.2);
  } else {
    front.line(hindX - 5, y0 - 1, hindX - 7, y0 + 2, C[3]);
    front.set(hindX - 8, y0 + 1, C[3]);
  }
  // the body: rump, barrel, chest
  ball(front, hindX, y0 - 1, 9, b.depth + 1, C, 0.05);
  ball(front, cx, y0, b.len, b.depth, C, 0.1);
  ball(front, foreX + 1, y0 - (m.body === 'boar' ? 2 : 0), m.body === 'boar' ? 10 : 8, b.depth + (m.body === 'boar' ? 2 : 1), C, 0.15);
  // the neck and head
  if (m.body === 'boar') {
    // a low heavy head straight ahead: snout, ear, tusk, eye
    ball(front, foreX + 9, y0 + 1, 7, 6, C, 0.1);
    front.poly(
      [
        [foreX + 13, y0 - 1],
        [foreX + 20, y0 + 2],
        [foreX + 20, y0 + 6],
        [foreX + 13, y0 + 6],
      ],
      (x, y) => shadeAt(C, 0.1 - (y - y0) * 0.08, x, y),
    );
    front.rect(foreX + 20, y0 + 2, 1, 4, tone(C[2], 0.25));
    front.set(foreX + 19, y0 + 3, OUTLINE_RGB);
    if (m.tusks) {
      front.line(foreX + 16, y0 + 6, foreX + 18, y0 + 3, WHITE[1]);
      front.set(foreX + 18, y0 + 2, WHITE[0]);
    }
    front.poly(
      [
        [foreX + 6, y0 - 6],
        [foreX + 9, y0 - 9],
        [foreX + 10, y0 - 4],
      ],
      dark[2],
    );
    front.set(foreX + 12, y0 - 1, OUTLINE_RGB);
    // the bristle ridge along the spine
    for (let x = hindX; x < foreX + 6; x += 2) front.rect(x, y0 - b.depth - 2 + Math.round(Math.abs(x - cx) / 9), 2, 2, M[x % 4 === 0 ? 2 : 3]);
  } else {
    const deer = m.body === 'deer';
    const nx = foreX + 3;
    const top = y0 - (deer ? 19 : 17);
    front.poly(
      [
        [nx - 4, y0 - 4],
        [nx + 1, top + 6],
        [nx + 5, top],
        [nx + 10, top + 1],
        [nx + 9, top + 8],
        [nx + 6, y0 + 2],
        [nx + 2, y0 + 5],
      ],
      (x, y) => shadeAt(C, 0.35 - (x - nx) * 0.05 - (y - top) * 0.01, x, y),
    );
    // the head, muzzle forward and down
    const hx = nx + 7;
    const hy = top + 1;
    front.poly(
      [
        [hx - 3, hy - 2],
        [hx + 3, hy - 3],
        [hx + (deer ? 9 : 11), hy + 5],
        [hx + (deer ? 9 : 11), hy + 9],
        [hx + 6, hy + 10],
        [hx - 1, hy + 5],
      ],
      (x, y) => shadeAt(C, 0.45 - (x - hx) * 0.04 - (y - hy) * 0.05, x, y),
    );
    if (m.blaze) front.line(hx + 3, hy - 2, hx + (deer ? 8 : 10), hy + 5, WHITE[0]);
    // the muzzle, darker; a nostril; the eye
    front.rect(hx + (deer ? 6 : 8), hy + 7, 3, 2, tone(C[3], -0.1));
    front.set(hx + (deer ? 8 : 10), hy + 6, OUTLINE_RGB);
    front.set(hx + 2, hy + 1, OUTLINE_RGB);
    front.set(hx + 2, hy, mixRGB(C[1], [255, 255, 255], 0.5));
    // the ear
    front.poly(
      [
        [hx - 2, hy - 2],
        [hx - 1, hy - 7],
        [hx + 1, hy - 2],
      ],
      C[2],
    );
    if (m.antlers) antlersSide(front, hx - 1, hy - 3, m.antlers);
    if (!deer) {
      // the mane down the neck and the forelock
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const x = Math.round(nx - 3 + t * 9);
        const y = Math.round(y0 - 5 - t * (y0 - 5 - top));
        front.rect(x - 1, y - 1, 3, 3, M[i % 3 === 0 ? 1 : 2]);
      }
      front.rect(hx - 1, hy - 3, 3, 2, M[1]);
    } else if (m.antlers === 'elk') {
      // the elk's beard
      front.poly(
        [
          [nx + 3, y0 - 6],
          [nx + 6, y0 - 7],
          [nx + 4, y0 - 1],
        ],
        M[2],
      );
    }
    // bridle and reins
    front.line(hx, hy - 1, hx + 8, hy + 7, LEATHER[2]);
    front.line(hx + 7, hy + 7, cx + 4, y0 - b.depth - 2, LEATHER[1]);
    front.set(hx + 7, hy + 6, BRASS);
  }
  // barding: a caparison over the chest and flank
  if (m.barding) {
    const B = ramp(m.barding);
    const T = ramp(m.tack);
    front.poly(
      [
        [hindX - 2, y0 - 2],
        [foreX + 6, y0 - 4],
        [foreX + 8, belly + 1],
        [hindX + 1, belly + 2],
      ],
      (x, y) => (y >= belly ? T[2] : shadeAt(B, 0.4 - (y - y0) * 0.06 - (x - hindX) * 0.006, x, y)),
    );
    for (let x = hindX + 2; x < foreX + 6; x += 5) front.set(x, y0 + 2, BRASS);
  }
  // near legs (in front of the body)
  for (const [x, ph] of [
    [foreX, 0],
    [hindX, Math.PI],
  ] as const) {
    const s = stride(f, ph);
    limb(front, x, belly - 3, x + s.dx, gy - s.lift - 1, b.thick + 1, b.thick, C, sock);
  }
  // the saddle on its blanket
  const sx = F.seat[m.body][0];
  const sy = F.seat[m.body][1] + bob;
  const T = ramp(m.tack);
  front.rect(sx - 8, sy + 1, 17, 6, T[2]);
  front.rect(sx - 8, sy + 6, 17, 1, T[3]);
  front.rect(sx - 8, sy + 1, 17, 1, T[1]);
  front.rect(sx - 6, sy - 1, 13, 3, LEATHER[2]);
  front.rect(sx + 5, sy - 3, 3, 3, LEATHER[1]);
  front.rect(sx - 7, sy - 2, 2, 2, LEATHER[3]);
  front.rect(sx + 3, sy + 2, 2, belly - sy - 1, LEATHER[3]);
  if (outline) {
    front.outline(OUTLINE_RGB);
    back.outline(OUTLINE_RGB);
  }
  return { back, front };
}

function antlersSide(p: Painter, x: number, y: number, kind: 'hart' | 'elk'): void {
  const A = ramp('#e8d8b0');
  if (kind === 'hart') {
    p.line(x, y, x - 2, y - 8, A[2]);
    p.line(x - 2, y - 8, x - 5, y - 12, A[1]);
    p.line(x - 1, y - 5, x + 2, y - 9, A[1]);
    p.line(x - 2, y - 9, x, y - 13, A[1]);
  } else {
    p.line(x, y, x - 3, y - 5, A[2]);
    p.poly(
      [
        [x - 3, y - 5],
        [x - 10, y - 9],
        [x - 8, y - 12],
        [x - 4, y - 10],
        [x - 1, y - 13],
        [x + 1, y - 8],
      ],
      (xx, yy) => shadeAt(A, 0.4 - (yy - y) * -0.04, xx, yy),
    );
  }
}

/* ------------------------------------------------------------- down & up */

/** The animal coming toward the viewer (down) or going away (up). */
function frontLayers(m: MountDef, view: 'down' | 'up', f: number, outline: boolean): { back: Painter; front: Painter } {
  const F = MOUNT_FRAMES[view];
  const b = BODIES[m.body];
  const back = new Painter(F.w, F.h);
  const front = new Painter(F.w, F.h);
  const C = coatOf(m);
  const M = maneOf(m);
  const dark = C.map((c) => tone(c, -0.25)) as Ramp;
  const T = ramp(m.tack);
  const cx = F.gx;
  const bob = f === 0 ? 0 : f % 2 === 0 ? -1 : 0;
  const boar = m.body === 'boar';
  const deer = m.body === 'deer';
  const wide = boar ? 13 : deer ? 10 : 12;
  const sock = m.socks ? 5 : -1;
  const lift = (ph: number): number => stride(f, ph).lift + Math.abs(stride(f, ph).dx) * 0.3;
  /** A pair of legs from under the body down to the ground, thick at the top and tapering to the hoof. */
  const legs = (p: Painter, top: number, foot: number, R: Ramp, ph: number, spread: number): void => {
    for (const [s, phase] of [
      [-1, ph],
      [1, ph + Math.PI],
    ] as const) {
      const x = cx + s * spread;
      const l = lift(phase);
      limb(p, x, top, x + s * 0.5, foot - l, b.thick + 2, b.thick, R, m.socks ? foot - sock : undefined);
    }
  };
  const seatY = F.seat[m.body][1] + bob;
  const barrelY = seatY + 2;
  // the far legs (seen past the body), the far end and the barrel are behind the rider
  const farFoot = F.gy - 9;
  legs(back, barrelY + 4, farFoot, dark, Math.PI, wide - 3);
  if (view === 'down') {
    // the rump far away, the tail's tip over it
    ball(back, cx, seatY - 9, wide + 1, 7, C, 0.1);
    if (!boar) back.rect(cx - 1, seatY - 16, 3, 4, M[2]);
  } else {
    // the head far away: ears (and antlers) over the neck, the mane down it
    const hy = seatY - 16;
    ball(back, cx, seatY - 7, 6, 8, C, 0.15);
    ball(back, cx, hy + (boar ? 6 : 2), boar ? 8 : 5, boar ? 6 : 6, C, 0.2);
    if (!boar) {
      back.poly([[cx - 5, hy - 2], [cx - 3, hy - 7], [cx - 2, hy - 1]], C[2]);
      back.poly([[cx + 5, hy - 2], [cx + 3, hy - 7], [cx + 2, hy - 1]], C[3]);
      if (!deer) back.rect(cx - 1, hy, 3, 13, M[2]);
      if (m.antlers) antlersFront(back, cx, hy - 2, m.antlers);
    } else {
      back.poly([[cx - 7, hy + 2], [cx - 5, hy - 2], [cx - 3, hy + 2]], C[3]);
      back.poly([[cx + 7, hy + 2], [cx + 5, hy - 2], [cx + 3, hy + 2]], C[3]);
    }
  }
  ball(back, cx, barrelY, wide, boar ? 12 : 11, C, 0.1);
  if (boar) for (let y = barrelY - 10; y < barrelY + 8; y += 2) back.rect(cx - 1, y, 2, 2, M[(y >> 1) % 2 ? 2 : 3]);
  if (m.barding) {
    const B = ramp(m.barding);
    back.ellipse(cx, barrelY + 1, wide, 9, (dx, _dy, x, y) => (Math.abs(dx) > 0.78 ? shadeAt(B, 0.3 - dx * 0.5, x, y) : null));
  }
  // the saddle under the rider
  back.rect(cx - 8, seatY - 3, 17, 10, T[2]);
  back.rect(cx - 8, seatY - 3, 1, 10, T[1]);
  back.rect(cx + 8, seatY - 3, 1, 10, T[3]);
  back.rect(cx - 6, seatY - 2, 13, 7, LEATHER[2]);
  back.rect(cx - 5, seatY - 2, 11, 1, LEATHER[1]);
  // the near end is in front of the rider: the chest, neck and face (down) or the rump and tail (up); the
  // near legs stand under it, from inside the body to the ground
  const nearFoot = F.gy + 3;
  if (view === 'down') {
    const ny = seatY + 10;
    const chestR = boar ? 8 : 6;
    legs(front, ny + chestR - 3, nearFoot, C, 0, wide - 3);
    ball(front, cx, ny + 1, wide - 1, chestR + 1, C, 0.25);
    if (m.barding) {
      const B = ramp(m.barding);
      front.ellipse(cx, ny + 2, wide - 2, chestR - 1, (dx, dy, x, y) => shadeAt(B, 0.4 - dx * 0.4 - dy * 0.3, x, y));
      front.set(cx, ny + 1, BRASS);
    }
    if (boar) {
      // a broad face low between the legs: ears, snout, tusks
      const fy = ny + 6;
      ball(front, cx, fy, 8, 6, C, 0.25);
      front.rect(cx - 3, fy + 3, 7, 4, tone(C[2], 0.2));
      front.set(cx - 1, fy + 5, OUTLINE_RGB);
      front.set(cx + 1, fy + 5, OUTLINE_RGB);
      if (m.tusks) {
        front.line(cx - 4, fy + 6, cx - 5, fy + 3, WHITE[1]);
        front.line(cx + 4, fy + 6, cx + 5, fy + 3, WHITE[1]);
      }
      front.set(cx - 4, fy - 1, OUTLINE_RGB);
      front.set(cx + 4, fy - 1, OUTLINE_RGB);
      front.poly([[cx - 8, fy - 3], [cx - 6, fy - 7], [cx - 4, fy - 3]], C[3]);
      front.poly([[cx + 8, fy - 3], [cx + 6, fy - 7], [cx + 4, fy - 3]], C[3]);
    } else {
      // the neck rising toward the viewer, the long face hanging down in front of the chest
      front.poly([[cx - 5, ny - 6], [cx + 5, ny - 6], [cx + 5, ny], [cx - 5, ny]], (x, y) => shadeAt(C, 0.35 - (x - cx) * 0.09 - (y - ny) * 0.03, x, y));
      const top = ny - 2;
      const len = deer ? 15 : 18;
      front.poly(
        [
          [cx - 5, top],
          [cx + 5, top],
          [cx + 4, top + len - 7],
          [cx + 5, top + len - 2],
          [cx + 3, top + len],
          [cx - 3, top + len],
          [cx - 5, top + len - 2],
          [cx - 4, top + len - 7],
        ],
        (x, y) => shadeAt(C, 0.5 - (x - cx) * 0.11 - (y - top) * 0.012, x, y),
      );
      const my = top + len;
      // the muzzle, darker and soft; the nostrils
      front.rect(cx - 4, my - 4, 9, 4, tone(C[3], -0.12));
      front.rect(cx - 3, my - 4, 7, 1, tone(C[2], -0.05));
      front.set(cx - 2, my - 2, OUTLINE_RGB);
      front.set(cx + 2, my - 2, OUTLINE_RGB);
      // a star on the forehead and a thin blaze down to the nose
      if (m.blaze) {
        front.rect(cx - 1, top + 2, 3, 3, WHITE[0]);
        front.rect(cx, top + 5, 1, len - 10, WHITE[1]);
      }
      // eyes set wide on the face, with a glint; ears and the forelock over it
      for (const s of [-1, 1]) {
        front.set(cx + s * 4, top + 4, OUTLINE_RGB);
        front.set(cx + s * 4, top + 3, mixRGB(C[1], [255, 255, 255], 0.5));
      }
      front.poly([[cx - 6, top + 1], [cx - 5, top - 5], [cx - 2, top]], C[2]);
      front.poly([[cx + 6, top + 1], [cx + 5, top - 5], [cx + 2, top]], C[3]);
      if (!deer) front.rect(cx - 1, top - 1, 3, 4, M[1]);
      if (m.antlers) antlersFront(front, cx, top - 3, m.antlers);
      // the bridle: noseband and cheek straps
      front.rect(cx - 4, my - 6, 9, 1, LEATHER[2]);
      front.rect(cx - 5, top + 2, 1, len - 8, LEATHER[2]);
      front.rect(cx + 5, top + 2, 1, len - 8, LEATHER[3]);
      front.set(cx - 4, my - 6, BRASS);
      front.set(cx + 4, my - 6, BRASS);
    }
  } else {
    const ry = seatY + 11;
    legs(front, ry + 3, nearFoot, C, 0, wide - 4);
    ball(front, cx, ry, wide + 1, 8, C, 0.2);
    // the two haunches
    if (!boar) front.rect(cx, ry - 5, 1, 9, C[3]);
    if (m.barding) {
      const B = ramp(m.barding);
      front.ellipse(cx, ry - 1, wide, 6, (dx, dy, x, y) => (dy < 0.2 ? shadeAt(B, 0.4 - dx * 0.4, x, y) : null));
    }
    const swish = f === 0 ? 0 : Math.round(Math.sin(((f - 1) / MOUNT_WALK_FRAMES) * Math.PI * 2) * 2);
    if (m.body === 'horse') {
      // a full tail, wide in the middle and swinging at the tip
      front.poly(
        [
          [cx - 2, ry - 7],
          [cx + 2, ry - 7],
          [cx + 4 + swish, ry + 4],
          [cx + 2 + swish, ry + 13],
          [cx - 2 + swish, ry + 13],
          [cx - 3 + swish, ry + 4],
        ],
        (x, y) => shadeAt(M, 0.4 - (x - cx - swish) * 0.14 - (y - ry) * 0.01, x, y),
      );
    } else if (deer) ball(front, cx, ry - 6, 2, 3, WHITE, 0.2);
    else front.rect(cx, ry - 7, 1, 3, C[3]);
  }
  if (outline) {
    front.outline(OUTLINE_RGB);
    back.outline(OUTLINE_RGB);
  }
  return { back, front };
}

function antlersFront(p: Painter, cx: number, y: number, kind: 'hart' | 'elk'): void {
  const A = ramp('#e8d8b0');
  for (const s of [-1, 1]) {
    if (kind === 'hart') {
      p.line(cx + s * 2, y, cx + s * 5, y - 7, A[s < 0 ? 1 : 2]);
      p.line(cx + s * 5, y - 7, cx + s * 8, y - 10, A[1]);
      p.line(cx + s * 4, y - 4, cx + s * 2, y - 9, A[1]);
    } else {
      p.line(cx + s * 2, y, cx + s * 5, y - 4, A[2]);
      p.poly(
        [
          [cx + s * 5, y - 4],
          [cx + s * 12, y - 6],
          [cx + s * 12, y - 10],
          [cx + s * 8, y - 9],
          [cx + s * 6, y - 11],
          [cx + s * 4, y - 7],
        ],
        A[s < 0 ? 1 : 2],
      );
    }
  }
}

/** The mount's two layers for a view and frame (0 standing, 1–4 walking); unoutlined to be smoothed first. */
export function paintMount(m: MountDef, view: MountView, frame: number, outline = true): { back: Painter; front: Painter } {
  return view === 'side' ? sideLayers(m, frame, outline) : frontLayers(m, view, frame, outline);
}

/**
 * The rider's legs where the saddle shows them: one leg bent over the near flank (side), or both astride
 * (down and up), in the colors of what the hero wears on their legs and feet.
 */
export function paintRiderLegs(view: MountView, body: MountDef['body'], legs: Piece, feet: Piece, outline = true): Painter {
  const F = MOUNT_FRAMES[view];
  const p = new Painter(F.w, F.h);
  const L = ramp(legs.tint);
  const B = ramp(feet.tint);
  const [sx, sy] = F.seat[body];
  if (view === 'side') {
    // thigh forward along the saddle, the shin down the flank, the boot in the stirrup
    p.poly(
      [
        [sx - 3, sy - 1],
        [sx + 3, sy - 1],
        [sx + 6, sy + 4],
        [sx + 2, sy + 5],
      ],
      (x, y) => shadeAt(L, 0.4 - (y - sy) * 0.08, x, y),
    );
    p.rect(sx + 2, sy + 4, 4, 6, L[2]);
    p.rect(sx + 2, sy + 4, 1, 6, L[1]);
    p.rect(sx + 1, sy + 9, 6, 3, B[2]);
    p.rect(sx + 1, sy + 9, 6, 1, B[1]);
    p.rect(sx + 1, sy + 12, 6, 1, BRASS);
  } else {
    for (const s of [-1, 1]) {
      const x = sx + s * 8;
      p.rect(Math.min(x, x - s * 3), sy - 1, 4, 6, L[s < 0 ? 1 : 3]);
      p.rect(x - (s < 0 ? 1 : 2), sy + 4, 4, 4, B[s < 0 ? 1 : 2]);
    }
  }
  if (outline) p.outline(OUTLINE_RGB);
  return p;
}

