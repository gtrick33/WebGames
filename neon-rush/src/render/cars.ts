import { FillGradient, type Graphics } from 'pixi.js';
import type { CarShape, StripeStyle } from '../cosmetics/skins';

/**
 * Original top-down car designs, drawn with vector paths. Every player car fits the same
 * 46 x 84 footprint so the (identical) hitbox always matches what you see.
 */

export function linear(c0: number, c1: number, vertical = true): FillGradient {
  return new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: vertical ? { x: 0, y: 1 } : { x: 1, y: 0 },
    colorStops: [
      { offset: 0, color: c0 },
      { offset: 1, color: c1 },
    ],
    textureSpace: 'local',
  });
}

export function shade(color: number, f: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((color & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

// ------------------------------------------------------------------ cars

export interface CarPaint {
  body: [number, number];
  accent: number;
  glass: number;
  stripe: StripeStyle;
  stripeColor: number;
  finish: 'gloss' | 'matte' | 'metal';
  tail: number;
  head: number;
  glow?: number;
  number?: number;
}

/** Sporty top-down car body path, facing up, centered at 0,0, sized w x h. */
export function carBodyPath(g: Graphics, w: number, h: number): Graphics {
  const sx = w / 46;
  const sy = h / 84;
  const P = (x: number, y: number): [number, number] => [x * sx, y * sy];
  g.moveTo(...P(-13, -42));
  g.quadraticCurveTo(...P(0, -45), ...P(13, -42));
  g.quadraticCurveTo(...P(20, -40), ...P(20.5, -30));
  g.lineTo(...P(21.5, -14));
  g.quadraticCurveTo(...P(23, -4), ...P(21.5, 8));
  g.lineTo(...P(21, 33));
  g.quadraticCurveTo(...P(20, 42), ...P(11, 43));
  g.lineTo(...P(-11, 43));
  g.quadraticCurveTo(...P(-20, 42), ...P(-21, 33));
  g.lineTo(...P(-21.5, 8));
  g.quadraticCurveTo(...P(-23, -4), ...P(-21.5, -14));
  g.lineTo(...P(-20.5, -30));
  g.quadraticCurveTo(...P(-20, -40), ...P(-13, -42));
  g.closePath();
  return g;
}

export function drawStripes(g: Graphics, style: StripeStyle, color: number, sx: number, sy: number): void {
  const R = (x: number, y: number, w: number, h: number, a = 0.92) => g.rect(x * sx, y * sy, w * sx, h * sy).fill({ color, alpha: a });
  switch (style) {
    case 'none':
      break;
    case 'center':
      R(-3.5, -43, 7, 86);
      break;
    case 'dual':
      R(-8, -43, 4, 86);
      R(4, -43, 4, 86);
      break;
    case 'side':
      R(-19, -30, 2, 62, 1);
      R(17, -30, 2, 62, 1);
      R(-12, -40, 24, 1.5, 0.8);
      break;
    case 'circuit': {
      const lines: [number, number][][] = [
        [[-9, -41], [-9, -28], [-4, -23]],
        [[9, -41], [9, -31], [14, -26]],
        [[0, -41], [0, -20]],
        [[-10, 40], [-10, 31], [-5, 27]],
        [[10, 40], [10, 33]],
      ];
      for (const pts of lines) {
        const first = pts[0] as [number, number];
        g.moveTo(first[0] * sx, first[1] * sy);
        for (let i = 1; i < pts.length; i++) {
          const p = pts[i] as [number, number];
          g.lineTo(p[0] * sx, p[1] * sy);
        }
        g.stroke({ width: 1.6 * sx, color, alpha: 0.95 });
        const last = pts[pts.length - 1] as [number, number];
        g.circle(last[0] * sx, last[1] * sy, 1.8 * sx).fill({ color });
      }
      break;
    }
    case 'checker':
      for (let i = 0; i < 6; i++) {
        R(-15 + i * 5, -36, 5, 4, i % 2 ? 0.9 : 0);
        R(-15 + i * 5, -32, 5, 4, i % 2 ? 0 : 0.9);
        R(-15 + i * 5, 33, 5, 4, i % 2 ? 0.9 : 0);
      }
      break;
    case 'pixel': {
      const pattern = ['0110110', '1011101', '0101010', '1110111'];
      pattern.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) if (row[c] === '1') R(-14 + c * 4, -38 + r * 4, 3.4, 3.4, 1);
      });
      R(-14, 30, 28, 3, 1);
      R(-10, 35, 20, 2.5, 1);
      break;
    }
    case 'chevron':
      for (let i = 0; i < 3; i++) {
        g.moveTo(-13 * sx, (-26 + i * 6) * sy).lineTo(0, (-35 + i * 6) * sy).lineTo(13 * sx, (-26 + i * 6) * sy);
        g.stroke({ width: 2.2 * sx, color, alpha: 0.9 - i * 0.2 });
      }
      break;
  }
}

export function drawSportsCar(g: Graphics, p: CarPaint, w: number, h: number): void {
  const sx = w / 46;
  const sy = h / 84;
  // Soft drop shadow.
  carBodyPath(g, w * 1.04, h * 1.02);
  g.fill({ color: 0x000000, alpha: 0.35 });
  // Wheels.
  for (const [x, y] of [[-21, -26], [21, -26], [-21, 27], [21, 27]] as const) {
    g.roundRect((x - 4) * sx, (y - 8) * sy, 8 * sx, 16 * sy, 2.5 * sx).fill({ color: 0x07070c });
  }
  // Body.
  carBodyPath(g, w, h).fill(linear(p.body[0], p.body[1]));
  if (p.finish === 'metal') {
    carBodyPath(g, w, h).fill(
      new FillGradient({
        type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, textureSpace: 'local',
        colorStops: [
          { offset: 0, color: 'rgba(255,255,255,0)' },
          { offset: 0.3, color: 'rgba(255,255,255,0.45)' },
          { offset: 0.42, color: 'rgba(255,255,255,0)' },
          { offset: 0.8, color: 'rgba(255,255,255,0.15)' },
          { offset: 1, color: 'rgba(255,255,255,0)' },
        ],
      }),
    );
  }
  drawStripes(g, p.stripe, p.stripeColor, sx, sy);
  // Hood crease / gloss highlight.
  if (p.finish !== 'matte') {
    g.ellipse(-7 * sx, -28 * sy, 5 * sx, 9 * sy).fill({ color: 0xffffff, alpha: 0.22 });
  }
  // Windshield, roof, rear window.
  g.poly([-15 * sx, -16 * sy, 15 * sx, -16 * sy, 12.5 * sx, -3 * sy, -12.5 * sx, -3 * sy]).fill({ color: p.glass });
  g.poly([-11 * sx, -14.5 * sy, -4 * sx, -14.5 * sy, -9 * sx, -5 * sy, -11 * sx, -5 * sy]).fill({ color: 0xffffff, alpha: 0.18 });
  g.roundRect(-12.5 * sx, -3 * sy, 25 * sx, 20 * sy, 4 * sx).fill(linear(shade(p.body[0], 0.8), shade(p.body[1], 0.75)));
  g.poly([-12.5 * sx, 17 * sy, 12.5 * sx, 17 * sy, 14 * sx, 25 * sy, -14 * sx, 25 * sy]).fill({ color: p.glass });
  // Side mirrors.
  g.roundRect(-25 * sx, -11 * sy, 4 * sx, 3.5 * sy, 1).fill({ color: shade(p.body[0], 0.7) });
  g.roundRect(21 * sx, -11 * sy, 4 * sx, 3.5 * sy, 1).fill({ color: shade(p.body[0], 0.7) });
  // Lights.
  g.roundRect(-15 * sx, -42 * sy, 8 * sx, 3.5 * sy, 1.5).fill({ color: p.head });
  g.roundRect(7 * sx, -42 * sy, 8 * sx, 3.5 * sy, 1.5).fill({ color: p.head });
  g.roundRect(-16 * sx, 39.5 * sy, 9 * sx, 3 * sy, 1.2).fill({ color: p.tail });
  g.roundRect(7 * sx, 39.5 * sy, 9 * sx, 3 * sy, 1.2).fill({ color: p.tail });
  // Accent outline.
  carBodyPath(g, w, h).stroke({ width: 1.2, color: p.accent, alpha: 0.55 });
}


// ------------------------------------------------------------------ helpers

type P = [number, number];

function path(g: Graphics, pts: P[], sx: number, sy: number): Graphics {
  const [x0, y0] = pts[0] as P;
  g.moveTo(x0 * sx, y0 * sy);
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i] as P;
    g.lineTo(x * sx, y * sy);
  }
  return g.closePath();
}

function wheel(g: Graphics, x: number, y: number, w: number, h: number, sx: number, sy: number): void {
  g.roundRect((x - w / 2) * sx, (y - h / 2) * sy, w * sx, h * sy, 2.5 * sx).fill({ color: 0x07070c });
  g.roundRect((x - w / 2 + 1.5) * sx, (y - h / 2 + 2) * sy, (w - 3) * sx, 2 * sy, 1).fill({ color: 0x3a3a48 });
}

function lights(g: Graphics, p: CarPaint, sx: number, sy: number, frontY: number, rearY: number, inset: number, w = 7): void {
  g.roundRect((-inset - w / 2) * sx, frontY * sy, w * sx, 3 * sy, 1.2).fill({ color: p.head });
  g.roundRect((inset - w / 2) * sx, frontY * sy, w * sx, 3 * sy, 1.2).fill({ color: p.head });
  g.roundRect((-inset - w / 2) * sx, rearY * sy, w * sx, 3 * sy, 1.2).fill({ color: p.tail });
  g.roundRect((inset - w / 2) * sx, rearY * sy, w * sx, 3 * sy, 1.2).fill({ color: p.tail });
}

// Seven-segment digits for race numbers (no fonts needed).
const SEGMENTS = ['1111110', '0110000', '1101101', '1111001', '0110011', '1011011', '1011111', '1110000', '1111111', '1111011'];

export function drawNumber(g: Graphics, n: number, cx: number, cy: number, h: number, color: number): void {
  const digits = String(Math.max(0, Math.floor(n)) % 1000).split('').map(Number);
  const w = h * 0.55;
  const t = Math.max(0.9, h * 0.16);
  const gap = t * 1.3;
  const total = digits.length * w + (digits.length - 1) * gap;
  digits.forEach((d, i) => {
    const x = cx - total / 2 + i * (w + gap);
    const y = cy - h / 2;
    const seg = SEGMENTS[d] ?? SEGMENTS[0]!;
    const rects: [number, number, number, number][] = [
      [x, y, w, t], [x + w - t, y, t, h / 2], [x + w - t, y + h / 2, t, h / 2],
      [x, y + h - t, w, t], [x, y + h / 2, t, h / 2], [x, y, t, h / 2], [x, y + h / 2 - t / 2, w, t],
    ];
    rects.forEach((r, k) => {
      if (seg[k] === '1') g.rect(r[0], r[1], r[2], r[3]).fill({ color });
    });
  });
}

function roundel(g: Graphics, n: number | undefined, x: number, y: number, r: number, sx: number, sy: number, bg = 0xffffff, fg = 0x111111): void {
  if (n === undefined) return;
  g.circle(x * sx, y * sy, r * sx).fill({ color: bg });
  g.circle(x * sx, y * sy, r * sx).stroke({ width: 1, color: 0x000000, alpha: 0.4 });
  drawNumber(g, n, x * sx, y * sy, r * 1.15 * sy, fg);
}

function glassShine(g: Graphics, x: number, y: number, w: number, h: number, sx: number, sy: number): void {
  g.poly([x * sx, y * sy, (x + w * 0.45) * sx, y * sy, (x + w * 0.15) * sx, (y + h) * sy, x * sx, (y + h) * sy]).fill({ color: 0xffffff, alpha: 0.16 });
}

function metalSheen(shapePath: () => Graphics): void {
  shapePath().fill(
    new FillGradient({
      type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, textureSpace: 'local',
      colorStops: [
        { offset: 0, color: 'rgba(255,255,255,0)' },
        { offset: 0.3, color: 'rgba(255,255,255,0.4)' },
        { offset: 0.42, color: 'rgba(255,255,255,0)' },
        { offset: 0.8, color: 'rgba(255,255,255,0.14)' },
        { offset: 1, color: 'rgba(255,255,255,0)' },
      ],
    }),
  );
}

function finishPass(g: Graphics, p: CarPaint, shapePath: () => Graphics, hx: number, hy: number, sx: number, sy: number): void {
  if (p.finish === 'metal') metalSheen(shapePath);
  if (p.finish === 'gloss') g.ellipse(hx * sx, hy * sy, 4.5 * sx, 8 * sy).fill({ color: 0xffffff, alpha: 0.2 });
}

// ------------------------------------------------------------------ shapes

function drawFormula(g: Graphics, p: CarPaint, sx: number, sy: number): void {
  const dark = shade(p.body[1], 0.6);
  // Shadow.
  g.roundRect(-20 * sx, -40 * sy, 40 * sx, 82 * sy, 8).fill({ color: 0x000000, alpha: 0.3 });
  // Suspension arms.
  for (const [y, x] of [[-24, 16], [22, 17]] as const) {
    g.moveTo(-x * sx, y * sy).lineTo(x * sx, y * sy).stroke({ width: 1.4 * sx, color: 0x2a2a35 });
  }
  wheel(g, -17, -24, 9, 15, sx, sy);
  wheel(g, 17, -24, 9, 15, sx, sy);
  wheel(g, -18, 23, 11, 18, sx, sy);
  wheel(g, 18, 23, 11, 18, sx, sy);
  // Front wing with endplates.
  g.roundRect(-22 * sx, -42 * sy, 44 * sx, 5 * sy, 1.5).fill(linear(p.body[0], dark, false));
  g.rect(-22 * sx, -43 * sy, 2.2 * sx, 8 * sy).fill({ color: p.accent });
  g.rect(19.8 * sx, -43 * sy, 2.2 * sx, 8 * sy).fill({ color: p.accent });
  // Nose, sidepods, engine cover.
  const body = () => path(g, [[-3.5, -40], [3.5, -40], [6.5, -14], [13, -8], [13, 16], [7, 20], [4.5, 33], [-4.5, 33], [-7, 20], [-13, 16], [-13, -8], [-6.5, -14]], sx, sy);
  body().fill(linear(p.body[0], p.body[1]));
  drawStripes(g, p.stripe, p.stripeColor, sx * 0.55, sy);
  finishPass(g, p, body, -6, 2, sx, sy);
  // Sidepod intakes.
  g.roundRect(-12 * sx, -7 * sy, 4 * sx, 6 * sy, 1).fill({ color: 0x07070c });
  g.roundRect(8 * sx, -7 * sy, 4 * sx, 6 * sy, 1).fill({ color: 0x07070c });
  // Cockpit and halo.
  g.ellipse(0, -5 * sy, 4.5 * sx, 8 * sy).fill({ color: p.glass });
  g.circle(0, -7 * sy, 3 * sx).fill({ color: p.accent, alpha: 0.85 }); // helmet
  g.arc(0, -5 * sy, 6 * sx, Math.PI * 1.05, Math.PI * 1.95).stroke({ width: 1.6 * sx, color: 0x1a1a22 });
  g.moveTo(0, -11 * sy).lineTo(0, -15 * sy).stroke({ width: 1.6 * sx, color: 0x1a1a22 });
  // Rear wing.
  g.roundRect(-20 * sx, 34 * sy, 40 * sx, 6 * sy, 1.5).fill(linear(dark, p.body[0], false));
  g.rect(-20 * sx, 32 * sy, 2.2 * sx, 10 * sy).fill({ color: p.accent });
  g.rect(17.8 * sx, 32 * sy, 2.2 * sx, 10 * sy).fill({ color: p.accent });
  g.rect(-2 * sx, 40.5 * sy, 4 * sx, 2.5 * sy).fill({ color: p.tail });
  if (p.number !== undefined) drawNumber(g, p.number, 0, -27 * sy, 6 * sy, p.stripeColor === p.body[0] ? 0xffffff : p.accent);
}

function drawStock(g: Graphics, p: CarPaint, sx: number, sy: number): void {
  const outline = () => g.roundRect(-21.5 * sx, -42 * sy, 43 * sx, 84 * sy, 8 * sx);
  g.roundRect(-22.5 * sx, -41 * sy, 45 * sx, 85 * sy, 9 * sx).fill({ color: 0x000000, alpha: 0.35 });
  wheel(g, -21, -25, 6, 15, sx, sy);
  wheel(g, 21, -25, 6, 15, sx, sy);
  wheel(g, -21, 26, 6, 15, sx, sy);
  wheel(g, 21, 26, 6, 15, sx, sy);
  outline().fill(linear(p.body[0], p.body[1]));
  drawStripes(g, p.stripe, p.stripeColor, sx, sy);
  finishPass(g, p, outline, -8, -28, sx, sy);
  // Hood pins and lines.
  g.moveTo(-10 * sx, -38 * sy).lineTo(-12 * sx, -18 * sy).stroke({ width: 0.8, color: 0x000000, alpha: 0.35 });
  g.moveTo(10 * sx, -38 * sy).lineTo(12 * sx, -18 * sy).stroke({ width: 0.8, color: 0x000000, alpha: 0.35 });
  // Windshield, roof, rear glass.
  path(g, [[-16, -17], [16, -17], [14, -6], [-14, -6]], sx, sy).fill({ color: p.glass });
  glassShine(g, -14, -16, 14, 9, sx, sy);
  g.roundRect(-14.5 * sx, -6 * sy, 29 * sx, 26 * sy, 3).fill(linear(shade(p.body[0], 0.9), shade(p.body[1], 0.85)));
  path(g, [[-14, 20], [14, 20], [15.5, 28], [-15.5, 28]], sx, sy).fill({ color: p.glass });
  roundel(g, p.number, 0, 7, 8.5, sx, sy);
  // Spoiler and splitter.
  g.rect(-20 * sx, 38 * sy, 40 * sx, 3 * sy).fill({ color: shade(p.body[1], 0.5) });
  g.rect(-19 * sx, -43 * sy, 38 * sx, 2 * sy).fill({ color: 0x111111 });
  lights(g, p, sx, sy, -41.5, 39.5, 13, 9);
  outline().stroke({ width: 1, color: p.accent, alpha: 0.4 });
}

function drawWedge(g: Graphics, p: CarPaint, sx: number, sy: number): void {
  const pts: P[] = [[-17, -42], [17, -42], [22, -22], [23.5, 4], [22, 38], [16, 43], [-16, 43], [-22, 38], [-23.5, 4], [-22, -22]];
  path(g, pts.map(([x, y]) => [x * 1.04, y * 1.02 + 1.5] as P), sx, sy).fill({ color: 0x000000, alpha: 0.35 });
  wheel(g, -21.5, -24, 7, 15, sx, sy);
  wheel(g, 21.5, -24, 7, 15, sx, sy);
  wheel(g, -22, 26, 8, 17, sx, sy);
  wheel(g, 22, 26, 8, 17, sx, sy);
  const body = () => path(g, pts, sx, sy);
  body().fill(linear(p.body[0], p.body[1]));
  drawStripes(g, p.stripe, p.stripeColor, sx, sy);
  finishPass(g, p, body, -8, -28, sx, sy);
  // Sharp hood creases.
  for (const side of [-1, 1]) {
    g.moveTo(side * 6 * sx, -41 * sy).lineTo(side * 12 * sx, -16 * sy).stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    // Hexagonal side intake.
    path(g, [[side * 17, 2], [side * 22, 6], [side * 22, 16], [side * 17, 20], [side * 14, 14], [side * 14, 6]], sx, sy).fill({ color: 0x05050a });
  }
  // Angular cockpit.
  path(g, [[-15, -14], [15, -14], [11, -1], [-11, -1]], sx, sy).fill({ color: p.glass });
  glassShine(g, -13, -13, 12, 11, sx, sy);
  path(g, [[-11, -1], [11, -1], [12, 14], [-12, 14]], sx, sy).fill({ color: shade(p.body[1], 0.75) });
  // Engine louvers.
  for (let y = 18; y < 34; y += 3.5) g.rect(-10 * sx, y * sy, 20 * sx, 1.4 * sy).fill({ color: 0x05050a, alpha: 0.8 });
  // Slim slanted headlights and Y taillights.
  path(g, [[-16, -40], [-8, -40], [-9, -37.5], [-15, -37.5]], sx, sy).fill({ color: p.head });
  path(g, [[16, -40], [8, -40], [9, -37.5], [15, -37.5]], sx, sy).fill({ color: p.head });
  for (const side of [-1, 1]) {
    g.moveTo(side * 9 * sx, 40 * sy).lineTo(side * 14 * sx, 37 * sy).lineTo(side * 19 * sx, 40 * sy).stroke({ width: 2 * sx, color: p.tail });
  }
  g.rect(-8 * sx, 41 * sy, 16 * sx, 2 * sy).fill({ color: 0x111111 });
  body().stroke({ width: 1, color: p.accent, alpha: 0.5 });
}

function drawExotic(g: Graphics, p: CarPaint, sx: number, sy: number): void {
  const body = () => {
    g.moveTo(0, -43 * sy);
    g.bezierCurveTo(10 * sx, -43 * sy, 20 * sx, -41 * sy, 21.5 * sx, -30 * sy);
    g.bezierCurveTo(23 * sx, -20 * sy, 18.5 * sx, -10 * sy, 18.5 * sx, 0);
    g.bezierCurveTo(18.5 * sx, 10 * sy, 24 * sx, 16 * sy, 22.5 * sx, 30 * sy);
    g.bezierCurveTo(21.5 * sx, 40 * sy, 14 * sx, 43 * sy, 0, 43 * sy);
    g.bezierCurveTo(-14 * sx, 43 * sy, -21.5 * sx, 40 * sy, -22.5 * sx, 30 * sy);
    g.bezierCurveTo(-24 * sx, 16 * sy, -18.5 * sx, 10 * sy, -18.5 * sx, 0);
    g.bezierCurveTo(-18.5 * sx, -10 * sy, -23 * sx, -20 * sy, -21.5 * sx, -30 * sy);
    g.bezierCurveTo(-20 * sx, -41 * sy, -10 * sx, -43 * sy, 0, -43 * sy);
    return g.closePath();
  };
  g.ellipse(0, 1.5 * sy, 24 * sx, 44 * sy).fill({ color: 0x000000, alpha: 0.3 });
  wheel(g, -20.5, -26, 6, 14, sx, sy);
  wheel(g, 20.5, -26, 6, 14, sx, sy);
  wheel(g, -21.5, 26, 7, 15, sx, sy);
  wheel(g, 21.5, 26, 7, 15, sx, sy);
  body().fill(linear(p.body[0], p.body[1]));
  drawStripes(g, p.stripe, p.stripeColor, sx, sy);
  finishPass(g, p, body, -9, -26, sx, sy);
  // Hood vents and fender lines.
  for (const side of [-1, 1]) {
    g.ellipse(side * 7 * sx, -26 * sy, 2.2 * sx, 5 * sy).fill({ color: 0x05050a, alpha: 0.8 });
    g.ellipse(side * 17.5 * sx, 12 * sy, 2 * sx, 6 * sy).fill({ color: 0x05050a }); // side intake
  }
  // Teardrop cabin.
  g.moveTo(-13 * sx, -8 * sy).quadraticCurveTo(0, -16 * sy, 13 * sx, -8 * sy).lineTo(10 * sx, 3 * sy).lineTo(-10 * sx, 3 * sy).closePath().fill({ color: p.glass });
  glassShine(g, -11, -10, 10, 11, sx, sy);
  g.moveTo(-10 * sx, 3 * sy).lineTo(10 * sx, 3 * sy).quadraticCurveTo(9 * sx, 16 * sy, 0, 18 * sy).quadraticCurveTo(-9 * sx, 16 * sy, -10 * sx, 3 * sy).closePath().fill({ color: shade(p.body[1], 0.8) });
  g.moveTo(-6 * sx, 17 * sy).quadraticCurveTo(0, 21 * sy, 6 * sx, 17 * sy).stroke({ width: 1.2, color: p.glass });
  // Round twin taillights and long headlights.
  for (const side of [-1, 1]) {
    g.circle(side * 9 * sx, 39.5 * sy, 2.2 * sx).fill({ color: p.tail });
    g.circle(side * 14.5 * sx, 38 * sy, 2.2 * sx).fill({ color: p.tail });
    g.ellipse(side * 13 * sx, -38 * sy, 5 * sx, 1.8 * sy).fill({ color: p.head });
  }
  body().stroke({ width: 1, color: p.accent, alpha: 0.45 });
}

function drawMuscle(g: Graphics, p: CarPaint, sx: number, sy: number): void {
  const outline = () => g.roundRect(-21 * sx, -42 * sy, 42 * sx, 84 * sy, 6 * sx);
  g.roundRect(-22 * sx, -41 * sy, 44 * sx, 85 * sy, 7).fill({ color: 0x000000, alpha: 0.35 });
  wheel(g, -20.5, -27, 7, 14, sx, sy);
  wheel(g, 20.5, -27, 7, 14, sx, sy);
  wheel(g, -21.5, 26, 9, 17, sx, sy);
  wheel(g, 21.5, 26, 9, 17, sx, sy);
  outline().fill(linear(p.body[0], p.body[1]));
  drawStripes(g, p.stripe, p.stripeColor, sx, sy);
  finishPass(g, p, outline, -9, -30, sx, sy);
  // Hood scoop.
  g.roundRect(-6.5 * sx, -34 * sy, 13 * sx, 15 * sy, 2).fill({ color: shade(p.body[0], 0.75) });
  g.roundRect(-4.5 * sx, -34 * sy, 9 * sx, 4 * sy, 1).fill({ color: 0x05050a });
  // Glass, short roof, long trunk.
  path(g, [[-16, -12], [16, -12], [14, -2], [-14, -2]], sx, sy).fill({ color: p.glass });
  glassShine(g, -14, -11, 13, 8, sx, sy);
  g.roundRect(-14 * sx, -2 * sy, 28 * sx, 16 * sy, 3).fill({ color: shade(p.body[0], 0.85) });
  path(g, [[-14, 14], [14, 14], [15, 20], [-15, 20]], sx, sy).fill({ color: p.glass });
  // Chrome bumpers.
  g.roundRect(-19 * sx, -43 * sy, 38 * sx, 2.4 * sy, 1).fill({ color: 0xd8dde8 });
  g.roundRect(-19 * sx, 40.5 * sy, 38 * sx, 2.4 * sy, 1).fill({ color: 0xd8dde8 });
  // Round headlights, wide tail bar.
  for (const side of [-1, 1]) g.circle(side * 14 * sx, -38.5 * sy, 2.6 * sx).fill({ color: p.head });
  g.rect(-17 * sx, 37.5 * sy, 34 * sx, 2.5 * sy).fill({ color: p.tail });
  outline().stroke({ width: 1, color: p.accent, alpha: 0.4 });
}

function drawCyber(g: Graphics, p: CarPaint, sx: number, sy: number): void {
  const pts: P[] = [[-20, -42], [20, -42], [23, -32], [23, 36], [19, 43], [-19, 43], [-23, 36], [-23, -32]];
  path(g, pts.map(([x, y]) => [x * 1.03, y + 1.5] as P), sx, sy).fill({ color: 0x000000, alpha: 0.35 });
  wheel(g, -22, -25, 6, 15, sx, sy);
  wheel(g, 22, -25, 6, 15, sx, sy);
  wheel(g, -22, 27, 6, 15, sx, sy);
  wheel(g, 22, 27, 6, 15, sx, sy);
  const body = () => path(g, pts, sx, sy);
  body().fill(linear(p.body[0], p.body[1]));
  drawStripes(g, p.stripe, p.stripeColor, sx, sy);
  finishPass(g, p, body, -9, -26, sx, sy);
  // Roof ridge: two planes meeting in the middle.
  path(g, [[-20, -14], [0, -20], [0, 30], [-20, 22]], sx, sy).fill({ color: 0xffffff, alpha: 0.08 });
  path(g, [[20, -14], [0, -20], [0, 30], [20, 22]], sx, sy).fill({ color: 0x000000, alpha: 0.12 });
  g.moveTo(0, -20 * sy).lineTo(0, 30 * sy).stroke({ width: 1, color: 0xffffff, alpha: 0.3 });
  // Glass band.
  path(g, [[-19, -16], [0, -22], [19, -16], [19, -10], [0, -15], [-19, -10]], sx, sy).fill({ color: p.glass });
  // Full-width light bars.
  g.rect(-20 * sx, -41.5 * sy, 40 * sx, 2.2 * sy).fill({ color: p.glow ?? p.head });
  g.rect(-19 * sx, 40 * sy, 38 * sx, 2.2 * sy).fill({ color: p.tail });
  // Panel seams.
  for (const y of [-28, 30]) g.moveTo(-22 * sx, y * sy).lineTo(22 * sx, y * sy).stroke({ width: 0.8, color: 0x000000, alpha: 0.35 });
  body().stroke({ width: 1, color: p.accent, alpha: 0.6 });
}

function drawHover(g: Graphics, p: CarPaint, sx: number, sy: number): void {
  const glow = p.glow ?? p.body[0];
  g.roundRect(-18 * sx, -39 * sy, 36 * sx, 82 * sy, 17 * sx).fill({ color: 0x000000, alpha: 0.25 });
  // Thruster pods.
  for (const side of [-1, 1]) {
    for (const y of [-24, 22]) {
      g.roundRect((side * 20 - 4) * sx, (y - 9) * sy, 8 * sx, 18 * sy, 4 * sx).fill({ color: shade(p.body[1], 0.6) });
      g.roundRect((side * 20 - 2.5) * sx, (y - 6) * sy, 5 * sx, 12 * sy, 2.5 * sx).fill({ color: glow });
      g.roundRect((side * 20 - 1) * sx, (y - 4) * sy, 2 * sx, 8 * sy, 1).fill({ color: 0xffffff, alpha: 0.85 });
    }
    // Struts.
    g.rect(side > 0 ? 14 * sx : -16 * sx, -25 * sy, 2 * sx, 3 * sy).fill({ color: 0x2a2a35 });
    g.rect(side > 0 ? 14 * sx : -16 * sx, 21 * sy, 2 * sx, 3 * sy).fill({ color: 0x2a2a35 });
  }
  const body = () => g.roundRect(-16 * sx, -41 * sy, 32 * sx, 82 * sy, 16 * sx);
  body().fill(linear(p.body[0], p.body[1]));
  drawStripes(g, p.stripe, p.stripeColor, sx * 0.8, sy);
  finishPass(g, p, body, -6, -24, sx, sy);
  // Bubble canopy.
  g.ellipse(0, -6 * sy, 9 * sx, 15 * sy).fill({ color: p.glass });
  g.ellipse(-3 * sx, -12 * sy, 3 * sx, 6 * sy).fill({ color: 0xffffff, alpha: 0.3 });
  g.ellipse(0, -6 * sy, 9 * sx, 15 * sy).stroke({ width: 1.2, color: p.accent, alpha: 0.6 });
  // Fins and main thruster.
  path(g, [[-3, 22], [3, 22], [1.5, 38], [-1.5, 38]], sx, sy).fill({ color: shade(p.body[1], 0.7) });
  g.ellipse(0, 40 * sy, 7 * sx, 2.5 * sy).fill({ color: glow });
  g.ellipse(0, 40 * sy, 3.5 * sx, 1.2 * sy).fill({ color: 0xffffff });
  g.ellipse(0, -39 * sy, 6 * sx, 1.6 * sy).fill({ color: p.head });
}

function drawRally(g: Graphics, p: CarPaint, sx: number, sy: number): void {
  const outline = () => g.roundRect(-20 * sx, -39 * sy, 40 * sx, 80 * sy, 9 * sx);
  g.roundRect(-21 * sx, -38 * sy, 42 * sx, 81 * sy, 10).fill({ color: 0x000000, alpha: 0.35 });
  wheel(g, -20, -23, 7, 14, sx, sy);
  wheel(g, 20, -23, 7, 14, sx, sy);
  wheel(g, -20, 23, 7, 14, sx, sy);
  wheel(g, 20, 23, 7, 14, sx, sy);
  // Mud flaps.
  g.rect(-22 * sx, 31 * sy, 6 * sx, 4 * sy).fill({ color: 0x111111 });
  g.rect(16 * sx, 31 * sy, 6 * sx, 4 * sy).fill({ color: 0x111111 });
  outline().fill(linear(p.body[0], p.body[1]));
  drawStripes(g, p.stripe, p.stripeColor, sx, sy);
  finishPass(g, p, outline, -8, -26, sx, sy);
  // Light pod on the bumper.
  g.roundRect(-14 * sx, -43 * sy, 28 * sx, 4.5 * sy, 2).fill({ color: 0x15151c });
  for (let i = 0; i < 4; i++) g.circle((-10.5 + i * 7) * sx, -40.7 * sy, 1.9 * sx).fill({ color: p.head });
  roundel(g, p.number, 0, -25, 6.5, sx, sy);
  // Cabin with roof scoop and rear wing.
  path(g, [[-15, -14], [15, -14], [13, -4], [-13, -4]], sx, sy).fill({ color: p.glass });
  glassShine(g, -13, -13, 12, 8, sx, sy);
  g.roundRect(-13.5 * sx, -4 * sy, 27 * sx, 24 * sy, 3).fill({ color: shade(p.body[0], 0.88) });
  g.roundRect(-3 * sx, -2 * sy, 6 * sx, 7 * sy, 1.5).fill({ color: shade(p.body[1], 0.55) });
  for (const x of [-9, 9]) g.moveTo(x * sx, 0).lineTo(x * sx, 16 * sy).stroke({ width: 0.8, color: 0x000000, alpha: 0.4 }); // roof rack
  g.roundRect(-17 * sx, 21 * sy, 34 * sx, 5 * sy, 1.5).fill({ color: shade(p.body[1], 0.6) });
  path(g, [[-13, 27], [13, 27], [14, 33], [-14, 33]], sx, sy).fill({ color: p.glass });
  lights(g, p, sx, sy, -38.5, 37.5, 13, 6);
  outline().stroke({ width: 1, color: p.accent, alpha: 0.45 });
}

function drawProto(g: Graphics, p: CarPaint, sx: number, sy: number): void {
  const body = () => {
    g.moveTo(-8 * sx, -43 * sy);
    g.lineTo(8 * sx, -43 * sy);
    g.quadraticCurveTo(22 * sx, -42 * sy, 22.5 * sx, -28 * sy); // front fender
    g.quadraticCurveTo(22 * sx, -14 * sy, 15 * sx, -8 * sy);
    g.lineTo(15 * sx, 8 * sy);
    g.quadraticCurveTo(23 * sx, 14 * sy, 22.5 * sx, 30 * sy); // rear fender
    g.lineTo(21 * sx, 40 * sy);
    g.lineTo(-21 * sx, 40 * sy);
    g.lineTo(-22.5 * sx, 30 * sy);
    g.quadraticCurveTo(-23 * sx, 14 * sy, -15 * sx, 8 * sy);
    g.lineTo(-15 * sx, -8 * sy);
    g.quadraticCurveTo(-22 * sx, -14 * sy, -22.5 * sx, -28 * sy);
    g.quadraticCurveTo(-22 * sx, -42 * sy, -8 * sx, -43 * sy);
    return g.closePath();
  };
  g.ellipse(0, 1.5 * sy, 24 * sx, 44 * sy).fill({ color: 0x000000, alpha: 0.28 });
  wheel(g, -19, -27, 6, 14, sx, sy);
  wheel(g, 19, -27, 6, 14, sx, sy);
  wheel(g, -19.5, 25, 7, 15, sx, sy);
  wheel(g, 19.5, 25, 7, 15, sx, sy);
  body().fill(linear(p.body[0], p.body[1]));
  drawStripes(g, p.stripe, p.stripeColor, sx, sy);
  finishPass(g, p, body, -14, -28, sx, sy);
  // Enclosed teardrop canopy and shark fin.
  g.moveTo(0, -20 * sy).quadraticCurveTo(10 * sx, -10 * sy, 7 * sx, 6 * sy).quadraticCurveTo(0, 12 * sy, -7 * sx, 6 * sy).quadraticCurveTo(-10 * sx, -10 * sy, 0, -20 * sy).closePath().fill({ color: p.glass });
  glassShine(g, -6, -15, 8, 14, sx, sy);
  g.moveTo(0, 8 * sy).lineTo(0, 36 * sy).stroke({ width: 2.4 * sx, color: shade(p.body[1], 0.6) });
  // Rear wing, splitter, light strips.
  g.roundRect(-21 * sx, 39 * sy, 42 * sx, 4.5 * sy, 1.5).fill({ color: shade(p.body[1], 0.5) });
  g.rect(-14 * sx, 39.5 * sy, 28 * sx, 1.5 * sy).fill({ color: p.tail });
  g.rect(-12 * sx, -44 * sy, 24 * sx, 2 * sy).fill({ color: 0x111111 });
  for (const side of [-1, 1]) path(g, [[side * 10, -41], [side * 19, -38], [side * 18, -36], [side * 10, -39]], sx, sy).fill({ color: p.head });
  roundel(g, p.number, 0, -30, 5.5, sx, sy);
  body().stroke({ width: 1, color: p.accent, alpha: 0.5 });
}

/** Draw any player car shape into a 46 x 84 box centered on the origin. */
export function drawCar(g: Graphics, shape: CarShape, p: CarPaint): void {
  const sx = 1;
  const sy = 1;
  switch (shape) {
    case 'sport': return drawSportsCar(g, p, 46, 84);
    case 'formula': return drawFormula(g, p, sx, sy);
    case 'stock': return drawStock(g, p, sx, sy);
    case 'wedge': return drawWedge(g, p, sx, sy);
    case 'exotic': return drawExotic(g, p, sx, sy);
    case 'muscle': return drawMuscle(g, p, sx, sy);
    case 'cyber': return drawCyber(g, p, sx, sy);
    case 'hover': return drawHover(g, p, sx, sy);
    case 'rally': return drawRally(g, p, sx, sy);
    case 'proto': return drawProto(g, p, sx, sy);
  }
}
