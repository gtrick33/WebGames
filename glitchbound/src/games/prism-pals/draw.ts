/**
 * The pals, drawn with canvas paths: a round body in the pal's color, a pale belly, big eyes and what makes
 * each one itself (Tango the hamster's round ears and cheeks, Sprig the cat's pointed ears and whiskers,
 * Plum the bunny's long ears, Zest the chick's tuft and beak). Each color also has a shape (a circle, a
 * triangle, a diamond, a star) drawn on its blocks, plates, gates and gems, so colors never rely on hue alone.
 */
import { PALS, type ColorId } from './critters';

export interface PalPose {
  face: 1 | -1;
  /** Walk cycle, radians. */
  walk: number;
  /** Squash (< 1) or stretch (> 1) from moving up and down. */
  stretch: number;
  /** Eyes shut (a blink). */
  blink: boolean;
  /** 0 to 1: a little push lean. */
  lean: number;
}

const STILL: PalPose = { face: 1, walk: 0, stretch: 1, blink: false, lean: 0 };

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

/** A pal standing with its feet at (cx, by); `s` is one tile in pixels. */
export function drawPal(ctx: CanvasRenderingContext2D, color: ColorId, cx: number, by: number, s: number, pose: Partial<PalPose> = {}): void {
  const p = { ...STILL, ...pose };
  const pal = PALS[color];
  const w = 0.74 * s;
  const h = 0.72 * s * p.stretch;
  const bw = w / Math.sqrt(p.stretch);
  const lw = Math.max(1, s * 0.05);
  const step = Math.sin(p.walk);
  ctx.save();
  ctx.translate(cx, by);
  ctx.rotate(p.lean * 0.12 * p.face);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = pal.dark;
  // shadow
  ctx.fillStyle = 'rgba(10, 4, 30, 0.28)';
  ellipse(ctx, 0, 0, bw * 0.46, s * 0.06);
  ctx.fill();
  // feet
  ctx.fillStyle = pal.dark;
  for (const side of [-1, 1]) {
    ellipse(ctx, side * bw * 0.2 + step * side * s * 0.05, -s * 0.04 - Math.max(0, step * side) * s * 0.05, s * 0.11, s * 0.065);
    ctx.fill();
  }
  const top = -h - s * 0.05;
  const midY = -s * 0.05 - h / 2;
  // ears and crests behind the body
  ctx.fillStyle = pal.color;
  if (pal.species === 'bunny') {
    for (const side of [-1, 1]) {
      const sway = step * 0.08 * side;
      ctx.save();
      ctx.translate(side * bw * 0.18, top + s * 0.08);
      ctx.rotate(side * 0.18 + sway);
      ellipse(ctx, 0, -s * 0.22, s * 0.1, s * 0.26);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = pal.light;
      ellipse(ctx, 0, -s * 0.2, s * 0.045, s * 0.17);
      ctx.fill();
      ctx.fillStyle = pal.color;
      ctx.restore();
    }
  } else if (pal.species === 'cat') {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * bw * 0.12, top + s * 0.1);
      ctx.lineTo(side * bw * 0.42, top - s * 0.14);
      ctx.lineTo(side * bw * 0.46, top + s * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = pal.light;
      ctx.beginPath();
      ctx.moveTo(side * bw * 0.22, top + s * 0.1);
      ctx.lineTo(side * bw * 0.38, top - s * 0.04);
      ctx.lineTo(side * bw * 0.4, top + s * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pal.color;
    }
  } else if (pal.species === 'hamster') {
    for (const side of [-1, 1]) {
      ellipse(ctx, side * bw * 0.3, top + s * 0.06, s * 0.1, s * 0.09);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = pal.light;
      ellipse(ctx, side * bw * 0.3, top + s * 0.07, s * 0.05, s * 0.045);
      ctx.fill();
      ctx.fillStyle = pal.color;
    }
  } else {
    // chick: a three-curl tuft
    for (const k of [-1, 0, 1]) {
      ellipse(ctx, k * s * 0.06, top - s * 0.02 - (k === 0 ? s * 0.05 : 0), s * 0.05, s * 0.09, k * 0.5);
      ctx.fill();
      ctx.stroke();
    }
  }
  // body
  const g = ctx.createLinearGradient(0, top, 0, -s * 0.05);
  g.addColorStop(0, pal.light);
  g.addColorStop(0.35, pal.color);
  g.addColorStop(1, pal.color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-bw / 2, top, bw, h, [bw * 0.5, bw * 0.5, bw * 0.36, bw * 0.36]);
  ctx.fill();
  ctx.stroke();
  // belly
  ctx.fillStyle = 'rgba(255, 250, 240, 0.55)';
  ellipse(ctx, p.face * bw * 0.04, midY + h * 0.18, bw * 0.28, h * 0.24);
  ctx.fill();
  if (pal.species === 'chick')
    for (const side of [-1, 1]) {
      ctx.fillStyle = pal.dark;
      ellipse(ctx, side * bw * 0.48, midY + h * 0.08, s * 0.05, s * 0.11, side * 0.4 + step * 0.3);
      ctx.fill();
    }
  // face
  const fx = p.face * bw * 0.1;
  const ey = midY - h * 0.1;
  for (const side of [-1, 1]) {
    const ex = fx + side * bw * 0.18;
    if (p.blink) {
      ctx.strokeStyle = '#2a1840';
      ctx.lineWidth = lw * 1.1;
      ctx.beginPath();
      ctx.moveTo(ex - s * 0.06, ey);
      ctx.quadraticCurveTo(ex, ey + s * 0.04, ex + s * 0.06, ey);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#fff';
      ellipse(ctx, ex, ey, s * 0.085, s * 0.1);
      ctx.fill();
      ctx.fillStyle = '#2a1840';
      ellipse(ctx, ex + p.face * s * 0.025, ey + s * 0.012, s * 0.05, s * 0.065);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ellipse(ctx, ex + p.face * s * 0.035 - s * 0.018, ey - s * 0.025, s * 0.018, s * 0.018);
      ctx.fill();
    }
  }
  // cheeks
  ctx.fillStyle = pal.species === 'hamster' ? 'rgba(255, 120, 110, 0.55)' : 'rgba(255, 110, 150, 0.35)';
  for (const side of [-1, 1]) {
    ellipse(ctx, fx + side * bw * 0.32, ey + s * 0.11, s * (pal.species === 'hamster' ? 0.075 : 0.055), s * 0.04);
    ctx.fill();
  }
  // mouth, beak, whiskers
  ctx.strokeStyle = '#2a1840';
  ctx.lineWidth = lw * 0.9;
  if (pal.species === 'chick') {
    ctx.fillStyle = '#ff9a3c';
    ctx.beginPath();
    ctx.moveTo(fx - s * 0.06, ey + s * 0.09);
    ctx.lineTo(fx + p.face * s * 0.1, ey + s * 0.12);
    ctx.lineTo(fx - s * 0.04, ey + s * 0.16);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(fx - s * 0.045, ey + s * 0.11);
    ctx.quadraticCurveTo(fx - s * 0.02, ey + s * 0.15, fx, ey + s * 0.12);
    ctx.quadraticCurveTo(fx + s * 0.02, ey + s * 0.15, fx + s * 0.045, ey + s * 0.11);
    ctx.stroke();
    if (pal.species === 'cat') {
      ctx.lineWidth = lw * 0.6;
      ctx.strokeStyle = pal.dark;
      for (const side of [-1, 1])
        for (const k of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(fx + side * bw * 0.26, ey + s * 0.12 + k * s * 0.015);
          ctx.lineTo(fx + side * bw * 0.52, ey + s * 0.1 + k * s * 0.05);
          ctx.stroke();
        }
    }
    if (pal.species === 'hamster') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(fx - s * 0.022, ey + s * 0.125, s * 0.044, s * 0.04);
    }
  }
  ctx.restore();
}

/** The color's shape, centered at (x, y), `r` across half. */
export function emblem(ctx: CanvasRenderingContext2D, color: ColorId, x: number, y: number, r: number): void {
  ctx.beginPath();
  if (color === 0) ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
  else if (color === 1) {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.95, y + r * 0.7);
    ctx.lineTo(x - r * 0.95, y + r * 0.7);
    ctx.closePath();
  } else if (color === 2) {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.8, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.8, y);
    ctx.closePath();
  } else
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r * 0.45 : r;
      if (k) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
  if (color === 3) ctx.closePath();
}

/** A gem of a color, centered at (x, y). */
export function drawGem(ctx: CanvasRenderingContext2D, color: ColorId, x: number, y: number, s: number, glint = 0): void {
  const pal = PALS[color];
  const r = s * 0.26;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.fillStyle = pal.color;
  ctx.strokeStyle = pal.dark;
  ctx.lineWidth = Math.max(1, s * 0.045);
  ctx.beginPath();
  ctx.moveTo(x - r, y - r * 0.35);
  ctx.lineTo(x - r * 0.5, y - r * 0.85);
  ctx.lineTo(x + r * 0.5, y - r * 0.85);
  ctx.lineTo(x + r, y - r * 0.35);
  ctx.lineTo(x, y + r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.light;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.5, y - r * 0.85);
  ctx.lineTo(x + r * 0.1, y - r * 0.85);
  ctx.lineTo(x - r * 0.15, y - r * 0.35);
  ctx.lineTo(x - r, y - r * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.15, y - r * 0.35);
  ctx.lineTo(x + r * 0.35, y - r * 0.35);
  ctx.lineTo(x, y + r * 0.75);
  ctx.closePath();
  ctx.fill();
  if (glint > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${glint})`;
    ctx.lineWidth = Math.max(1, s * 0.04);
    const gx = x + r * 0.7;
    const gy = y - r * 0.9;
    ctx.beginPath();
    ctx.moveTo(gx - s * 0.08, gy);
    ctx.lineTo(gx + s * 0.08, gy);
    ctx.moveTo(gx, gy - s * 0.08);
    ctx.lineTo(gx, gy + s * 0.08);
    ctx.stroke();
  }
  ctx.restore();
}
