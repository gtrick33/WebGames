import type { MountDef } from '../../data/mounts';
import { mixRGB, OUTLINE_RGB, Painter, ramp, rgb, shadeAt, tone, type Ramp, type RGB } from './kit';
import { MOUNT_FRAMES, MOUNT_WALK_FRAMES, type MountView } from './mount';

/**
 * The Sigil Drakes, a campaign's prize, painted in the mounts' layers: wings, far legs and tail behind the rider,
 * body, neck and head in front. A long curved neck, a horned wedge of a head with its jaw hung open, heavy
 * haunches, and bat's wings that beat slowly as it walks. Same language as every mount: lit from the top left,
 * ramps for every surface, a dark outline.
 */

type Layers = { back: Painter; front: Painter };
type Pt = [number, number];

const CLAW = rgb('#efe6d0');
const HORN = ramp('#e8dcc0');
const TOOTH = rgb('#fff8e8');
const MOUTH = rgb('#3a0f18');

const flapOf = (f: number): number => (f === 0 ? 0 : Math.round(Math.sin(((f - 1) / MOUNT_WALK_FRAMES) * Math.PI * 2) * 3));
const swishOf = (f: number): number => (f === 0 ? 0 : Math.round(Math.sin(((f - 1) / MOUNT_WALK_FRAMES) * Math.PI * 2) * 2));

function stride(f: number, phase: number): { dx: number; lift: number } {
  if (f === 0) return { dx: 0, lift: 0 };
  const a = ((f - 1) / MOUNT_WALK_FRAMES) * Math.PI * 2 + phase;
  return { dx: Math.round(Math.sin(a) * 3), lift: Math.max(0, Math.round(Math.cos(a) * 2)) };
}

const bez = (a: Pt, b: Pt, c: Pt, t: number): Pt => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t ** 2 * c[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t ** 2 * c[1]];

/** A smooth tapering tube along a curve: necks and tails. `seg` is called at each step for what runs along it. */
function tube(p: Painter, a: Pt, b: Pt, c: Pt, r0: number, r1: number, R: Ramp, seg?: (x: number, y: number, r: number, t: number) => void): void {
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [x, y] = bez(a, b, c, t);
    const r = r0 + (r1 - r0) * t;
    p.ball(x, y, r, r, R, { light: 0.12 });
  }
  if (seg) {
    for (let i = 0; i <= n; i += 2) {
      const t = i / n;
      const [x, y] = bez(a, b, c, t);
      seg(x, y, r0 + (r1 - r0) * t, t);
    }
  }
}

/** A spike standing off a surface. */
function spike(p: Painter, x: number, y: number, dx: number, dy: number, w: number, c: RGB): void {
  p.poly(
    [
      [x - w, y + 1],
      [x + dx, y + dy],
      [x + w, y + 1],
    ],
    c,
  );
}

/** A heavy clawed leg: a bent shin down to a splayed foot. */
function foot(p: Painter, x0: number, y0: number, x1: number, y1: number, w: number, R: Ramp, bend: number): void {
  const mid: Pt = [(x0 + x1) / 2 + bend, (y0 + y1) / 2];
  tube(p, [x0, y0], mid, [x1, y1 - 2], w / 2 + 0.5, w / 2 - 0.6, R);
  p.rect(Math.round(x1 - w / 2) - 1, y1 - 2, w + 3, 3, R[3]);
  p.rect(Math.round(x1 - w / 2) - 1, y1 - 2, w + 3, 1, R[2]);
  for (let i = 0; i < 3; i++) {
    const cx = Math.round(x1 - w / 2) - 1 + i * 2 + (i === 2 ? 1 : 0);
    p.set(cx, y1 + 1, CLAW);
    p.set(cx + 1, y1, CLAW);
  }
}

/** A bat's wing: an arm up to the wrist, then fingers fanning out, the skin hung and scalloped between them. */
function wing(p: Painter, shoulder: Pt, wrist: Pt, tips: Pt[], W: Ramp, bone: Ramp): void {
  // the skin, panel by panel, darker toward the body
  for (let i = 0; i < tips.length; i++) {
    const b = tips[i]!;
    const prev = i === 0 ? wrist : tips[i - 1]!;
    const sag: Pt = [(prev[0] + b[0]) / 2 + (shoulder[0] - (prev[0] + b[0]) / 2) * 0.22, (prev[1] + b[1]) / 2 + (shoulder[1] - (prev[1] + b[1]) / 2) * 0.22];
    const shade = 0.34 - i * 0.12;
    p.poly(i === 0 ? [wrist, b, shoulder] : [wrist, prev, sag, b], (x, y) => shadeAt(W, shade + ((x * 3 + y) % 7 === 0 ? -0.05 : 0), x, y));
  }
  const lastTip = tips[tips.length - 1]!;
  p.poly([wrist, lastTip, [(lastTip[0] + shoulder[0]) / 2 + 2, (lastTip[1] + shoulder[1]) / 2 + 3], shoulder], (x, y) => shadeAt(W, 0.02 + ((x * 3 + y) % 7 === 0 ? -0.05 : 0), x, y));
  // the bones over it
  for (const t of tips) p.line(wrist[0], wrist[1], t[0], t[1], bone[2]);
  tube(p, shoulder, [(shoulder[0] + wrist[0]) / 2 + 3, (shoulder[1] + wrist[1]) / 2], wrist, 2.1, 1.3, bone);
  // the thumb claw at the wrist
  p.set(wrist[0] + 1, wrist[1] - 1, CLAW);
  p.set(wrist[0] + 1, wrist[1] - 2, CLAW);
}

function sideDrake(m: MountDef, f: number, outline: boolean): Layers {
  const F = MOUNT_FRAMES.side;
  const back = new Painter(F.w, F.h);
  const front = new Painter(F.w, F.h);
  const C = ramp(m.coat);
  const W = ramp(m.mane);
  const belly = ramp(mixHex(m.coat, '#e8dcb8', 0.55));
  const T = ramp(m.tack);
  const dark = C.map((c) => tone(c, -0.3)) as Ramp;
  const glow = rgb(m.glow?.color ?? '#ffd27a');
  const gy = F.gy;
  const bob = f === 0 ? 0 : f % 2 === 0 ? -1 : 0;
  const y0 = gy - 19 + bob;
  const cx = F.gx - 3;
  const foreX = cx + 11;
  const hindX = cx - 12;
  const flap = flapOf(f);
  const swish = swishOf(f);

  // the far wing, then the near one, spread up and back behind the rider
  const farW = W.map((c) => tone(c, -0.3)) as Ramp;
  wing(back, [cx + 9, y0 - 9], [cx + 4, y0 - 28 - flap], [[cx - 7, 1 + Math.max(0, -flap)], [cx - 20, 3 - flap / 2], [cx - 30, 11 - flap / 2]], farW, dark);
  wing(back, [cx + 5, y0 - 8], [cx - 3, y0 - 25 - flap], [[cx - 14, 2 + Math.max(0, -flap)], [cx - 27, 6 - flap / 2], [cx - 36, 15 - flap / 2], [cx - 36, 27 - flap / 3]], W, C);

  // far legs
  for (const [x, ph, b] of [
    [foreX - 4, Math.PI, 2],
    [hindX + 4, 0, -3],
  ] as const) {
    const s = stride(f, ph);
    foot(back, x, y0 + 4, x + s.dx, gy - s.lift, 4, dark, b);
  }

  // the tail, long and low, ending in a spade
  const tailEnd: Pt = [6, y0 + 3 + swish];
  tube(front, [hindX - 5, y0 - 2], [hindX - 13, y0 + 10], tailEnd, 6.5, 1.2, C, (x, y, r, t) => {
    if (t < 0.92) front.rect(Math.round(x - 1), Math.round(y + r - 1), 2, 1, belly[1]);
    if (Math.round(t * 22) % 4 === 0 && t < 0.9) spike(front, x, y - r, -1, -3 - r * 0.25, 1.6, W[2]);
  });
  front.poly(
    [
      [tailEnd[0] + 2, tailEnd[1]],
      [tailEnd[0] - 5, tailEnd[1] - 5],
      [tailEnd[0] - 3, tailEnd[1] + 1],
      [tailEnd[0] - 5, tailEnd[1] + 5],
    ],
    (x, y) => shadeAt(W, 0.3 - (y - tailEnd[1]) * 0.06, x, y),
  );

  // the body: heavy haunch, a narrow waist, a deep chest
  front.ball(hindX, y0, 11, 11, C, { light: 0.08 });
  front.ball(cx, y0 + 1, 15, 8, C, { light: 0.08 });
  front.ball(foreX, y0 - 1, 11, 11, C, { light: 0.14 });
  // the belly plates under it
  for (let x = hindX + 2; x < foreX + 8; x += 3) {
    const y = y0 + 7 + Math.round(((x - cx) / 22) ** 2 * 3);
    front.rect(x, y, 2, 2, belly[x % 2 === 0 ? 1 : 2]);
  }
  // a little texture of scales on the flank
  for (let y = y0 - 7; y < y0 + 6; y += 3) {
    for (let x = hindX - 4 + (y % 2 === 0 ? 1 : 3); x < foreX + 5; x += 5) front.set(x, y, C[3]);
  }

  // the neck: a long curve up from the chest, the throat plated, spines down its back
  const nA: Pt = [foreX + 5, y0 - 5];
  const nB: Pt = [foreX + 2, y0 - 19];
  const nC: Pt = [foreX + 13, y0 - 25];
  tube(front, nA, nB, nC, 7.5, 3.6, C, (x, y, r, t) => {
    front.rect(Math.round(x + r - 2), Math.round(y), 2, 2, belly[t < 0.5 ? 2 : 1]);
    if (Math.round(t * 22) % 4 === 0) spike(front, x - r * 0.6, y - r * 0.6, -3, -3, 1.6, W[2]);
  });

  // the head: a long wedge, the jaw hung open
  const hx = nC[0] + 1;
  const hy = nC[1];
  front.poly(
    [
      [hx - 5, hy + 2],
      [hx + 6, hy + 4],
      [hx + 13, hy + 7],
      [hx + 11, hy + 9],
      [hx + 3, hy + 8],
      [hx - 4, hy + 5],
    ],
    (x, y) => shadeAt(dark, 0.3 - (y - hy) * 0.03, x, y),
  );
  front.poly(
    [
      [hx + 1, hy + 2],
      [hx + 12, hy + 5],
      [hx + 11, hy + 7],
      [hx + 2, hy + 6],
    ],
    MOUTH,
  );
  for (let i = 0; i < 4; i++) {
    front.set(hx + 4 + i * 2, hy + 3 + Math.round(i * 0.5), TOOTH);
    front.set(hx + 5 + i * 2, hy + 6 + Math.round(i * 0.3), TOOTH);
  }
  front.poly(
    [
      [hx - 5, hy - 4],
      [hx + 3, hy - 5],
      [hx + 13, hy - 1],
      [hx + 16, hy + 2],
      [hx + 14, hy + 4],
      [hx + 4, hy + 3],
      [hx - 4, hy + 3],
    ],
    (x, y) => shadeAt(C, 0.46 - (x - hx) * 0.012 - (y - hy) * 0.07, x, y),
  );
  // the brow over a burning eye, the nostril
  front.line(hx - 1, hy - 3, hx + 6, hy - 2, dark[4]);
  front.rect(hx + 2, hy - 1, 3, 2, glow);
  front.set(hx + 13, hy, dark[4]);
  // two great horns swept back, a smaller pair below them, and a cheek spine
  front.poly(
    [
      [hx - 2, hy - 4],
      [hx - 10, hy - 9],
      [hx - 18, hy - 10],
      [hx - 10, hy - 5],
      [hx - 3, hy - 1],
    ],
    (x, y) => shadeAt(HORN, 0.5 - (y - hy + 8) * 0.05 + (x - hx) * 0.012, x, y),
  );
  front.poly(
    [
      [hx - 4, hy],
      [hx - 11, hy - 2],
      [hx - 15, hy - 1],
      [hx - 9, hy + 1],
      [hx - 4, hy + 3],
    ],
    (x, y) => shadeAt(HORN, 0.2 - (y - hy) * 0.03, x, y),
  );
  spike(front, hx - 3, hy + 5, -5, 3, 1.5, W[2]);

  // spines along the back
  for (const [x, h] of [
    [hindX - 3, 5],
    [hindX + 4, 6],
    [foreX + 1, 5],
  ] as const) {
    spike(front, x, y0 - 10, -1, -h, 2.2, W[2]);
  }

  // the near legs: a powerful thigh and shoulder over bent shins
  const sf = stride(f, 0);
  const sh = stride(f, Math.PI);
  front.ball(hindX - 1, y0 + 3, 7, 9, C, { light: 0.16 });
  foot(front, hindX - 2, y0 + 9, hindX - 3 + sh.dx, gy - sh.lift, 5, C, -4);
  front.ball(foreX + 2, y0 + 2, 5, 7, C, { light: 0.18 });
  foot(front, foreX + 2, y0 + 7, foreX + 3 + sf.dx, gy - sf.lift, 5, C, 2);

  // a war saddle, low on the back
  front.poly(
    [
      [cx - 7, y0 - 8],
      [cx + 8, y0 - 8],
      [cx + 7, y0 - 2],
      [cx - 6, y0 - 2],
    ],
    (x, y) => shadeAt(T, 0.3 - (y - y0 + 8) * 0.05, x, y),
  );
  front.rect(cx - 6, y0 - 3, 13, 1, tone(glow, -0.15));

  if (outline) {
    back.outline(OUTLINE_RGB);
    front.outline(OUTLINE_RGB);
  }
  return { back, front };
}

function frontDrake(m: MountDef, view: 'down' | 'up', f: number, outline: boolean): Layers {
  const F = MOUNT_FRAMES[view];
  const back = new Painter(F.w, F.h);
  const front = new Painter(F.w, F.h);
  const C = ramp(m.coat);
  const W = ramp(m.mane);
  const T = ramp(m.tack);
  const belly = ramp(mixHex(m.coat, '#e8dcb8', 0.55));
  const dark = C.map((c) => tone(c, -0.3)) as Ramp;
  const glow = rgb(m.glow?.color ?? '#ffd27a');
  const cx = F.gx;
  const gy = F.gy;
  const bob = f === 0 ? 0 : f % 2 === 0 ? -1 : 0;
  const y0 = gy - 20 + bob;
  const flap = flapOf(f);
  const swish = swishOf(f);

  // both wings up and out, behind the rider
  for (const s of [-1, 1]) {
    const R = s < 0 ? W : (W.map((c) => tone(c, -0.16)) as Ramp);
    wing(back, [cx + s * 6, y0 - 10], [cx + s * 13, y0 - 30 - flap], [[cx + s * 20, y0 - 34 - flap], [cx + s * 22, y0 - 22 - flap], [cx + s * 22, y0 - 8 - flap]], R, C);
  }

  // the far legs, then the near ones
  for (const [s, ph] of [
    [-1, 0],
    [1, Math.PI],
  ] as const) {
    const st = stride(f, ph);
    foot(back, cx + s * 7, y0 + 3, cx + s * 8, gy - 3 - st.lift, 4, dark, s * 1);
    front.ball(cx + s * 9, y0 + 4, 4, 6, C, { light: s < 0 ? 0.2 : 0.02 });
    foot(front, cx + s * 9, y0 + 8, cx + s * 10, gy - st.lift, 4, C, s * 1);
  }

  front.ball(cx, y0, 9, 12, C, { light: 0.12 });
  if (view === 'down') {
    // the belly plates, the neck coming down toward the viewer, the horned head
    for (let y = y0 + 3; y < y0 + 12; y += 3) front.rect(cx - 3, y, 7, 2, belly[1]);
    tube(front, [cx, y0 - 2], [cx, y0 + 2], [cx, y0 + 5], 5, 4.5, C);
    const hy = y0 + 7;
    front.poly(
      [
        [cx - 6, hy - 5],
        [cx + 6, hy - 5],
        [cx + 5, hy + 2],
        [cx + 3, hy + 12],
        [cx - 3, hy + 12],
        [cx - 5, hy + 2],
      ],
      (x, y) => shadeAt(C, 0.42 - (x - cx) * 0.05 - (y - hy) * 0.018, x, y),
    );
    front.rect(cx - 2, hy + 9, 5, 2, MOUTH);
    for (let i = 0; i < 3; i++) front.set(cx - 2 + i * 2, hy + 11, TOOTH);
    front.set(cx - 1, hy + 6, dark[4]);
    front.set(cx + 1, hy + 6, dark[4]);
    // the brows over burning eyes
    front.rect(cx - 5, hy - 2, 3, 2, glow);
    front.rect(cx + 3, hy - 2, 3, 2, glow);
    front.line(cx - 5, hy - 3, cx - 2, hy - 1, dark[4]);
    front.line(cx + 6, hy - 3, cx + 3, hy - 1, dark[4]);
    // great horns, swept up and out
    for (const s of [-1, 1]) {
      front.poly(
        [
          [cx + s * 3, hy - 5],
          [cx + s * 9, hy - 10],
          [cx + s * 15, hy - 18],
          [cx + s * 11, hy - 8],
          [cx + s * 6, hy - 2],
        ],
        (x, y) => shadeAt(HORN, 0.5 + (y - hy) * 0.02 - s * (x - cx) * 0.008, x, y),
      );
    }
    // the saddle above the neck
    front.ball(cx, y0 - 8, 6, 3, T, { light: 0.1 });
  } else {
    // going away: the saddle, spines down the back, the tail coming toward the viewer
    front.ball(cx, y0 - 6, 6, 3, T, { light: 0.1 });
    for (let y = y0 + 1; y < y0 + 12; y += 4) spike(front, cx, y, 0, -3, 2, W[2]);
    const end: Pt = [cx + swish * 2, gy + 6];
    tube(front, [cx, y0 + 8], [cx + swish, y0 + 15], end, 4.5, 1, C, (x, y, r, t) => {
      if (Math.round(t * 22) % 5 === 0) spike(front, x, y - r * 0.2, 0, -3, 1.6, W[2]);
    });
    front.poly(
      [
        [end[0], end[1] - 2],
        [end[0] - 3, end[1] + 2],
        [end[0], end[1] + 4],
        [end[0] + 3, end[1] + 2],
      ],
      W[2],
    );
    // the neck rising beyond the rider, the horns above all of it
    tube(back, [cx, y0 - 6], [cx, y0 - 12], [cx, y0 - 20], 6, 4.5, C);
    for (const s of [-1, 1]) {
      back.poly(
        [
          [cx + s * 2, y0 - 22],
          [cx + s * 8, y0 - 29],
          [cx + s * 12, y0 - 34],
          [cx + s * 8, y0 - 26],
          [cx + s * 4, y0 - 20],
        ],
        (x, y) => shadeAt(HORN, 0.4 + (y - y0) * 0.01, x, y),
      );
    }
  }

  if (outline) {
    back.outline(OUTLINE_RGB);
    front.outline(OUTLINE_RGB);
  }
  return { back, front };
}

function mixHex(a: string, b: string, t: number): string {
  const [r, g, bl] = mixRGB(rgb(a), rgb(b), t);
  return `#${[r, g, bl].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

export function drakeLayers(m: MountDef, view: MountView, f: number, outline: boolean): Layers {
  return view === 'side' ? sideDrake(m, f, outline) : frontDrake(m, view, f, outline);
}
