/**
 * Turns a thing's picture into artwork the game can size precisely: its original art, or its emoji,
 * drawn big on a canvas (diagonal emoji turned level first), cropped to its visible pixels (emoji
 * fonts pad differently on every device), and also as a one-color silhouette. Results are cached per
 * thing and color.
 */
import type { Thing } from './objects';

export interface Glyph {
  /** Data URLs of the cropped picture and the silhouette. */
  color: string;
  silhouette: string;
  /** Width over height of the visible shape. */
  aspect: number;
}

/** Drawn this big (CSS pixels), so big pictures stay sharp on high-density screens. */
const DRAW = 360;
const ALPHA = 24;
/** Only art clearly longer one way has a long axis worth turning, and only when it is off by more than this. */
const MIN_ELONGATION = 1.25;
const MIN_TURN = (4 * Math.PI) / 180;
const cache = new Map<string, Glyph>();

/**
 * The angle (radians, y down) of the shape's principal axis, and how much longer it is that way than
 * across, from the visible pixels' second moments.
 */
export function principalAxis(rgba: ArrayLike<number>, size: number): { angle: number; elongation: number } {
  let n = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (rgba[(y * size + x) * 4 + 3]! > ALPHA) {
        n++;
        sx += x;
        sy += y;
        sxx += x * x;
        syy += y * y;
        sxy += x * y;
      }
  if (!n) return { angle: 0, elongation: 1 };
  const mx = sx / n;
  const my = sy / n;
  const cxx = sxx / n - mx * mx;
  const cyy = syy / n - my * my;
  const cxy = sxy / n - mx * my;
  const tr = (cxx + cyy) / 2;
  const det = Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy * cxy);
  return { angle: 0.5 * Math.atan2(2 * cxy, cxx - cyy), elongation: Math.sqrt((tr + det) / Math.max(1e-9, tr - det)) };
}

/** The smallest turn (radians) that lays an axis at `angle` along the picture's width or height. */
export function levelTurn(angle: number, axis: 'w' | 'h'): number {
  let r = (axis === 'w' ? 0 : Math.PI / 2) - angle;
  while (r > Math.PI / 2) r -= Math.PI;
  while (r <= -Math.PI / 2) r += Math.PI;
  return r;
}

function draw(t: Thing, ctx: CanvasRenderingContext2D, size: number): void {
  const art = t.art;
  if (!art) {
    ctx.font = `${DRAW}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.emoji, size / 2, size / 2);
    return;
  }
  const k = DRAW / Math.max(art.w, art.h);
  ctx.save();
  ctx.translate(size / 2 - (art.w * k) / 2, size / 2 - (art.h * k) / 2);
  ctx.scale(k, k);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of art.parts)
    // Each shape on its own, so overlapping shapes drawn in opposite directions never cut holes.
    for (const d of p.d.split(/(?=M)/)) {
      const path = new Path2D(d);
      if (p.fill) {
        ctx.fillStyle = p.fill;
        ctx.fill(path);
      }
      if (p.stroke) {
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = p.width ?? 1;
        ctx.stroke(path);
      }
    }
  ctx.restore();
}

export function glyph(t: Thing, tint: string): Glyph | null {
  const id = `${t.name}|${tint}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const size = Math.round(DRAW * 1.6);
  let c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  draw(t, ctx, size);
  let data = ctx.getImageData(0, 0, size, size).data;
  if (t.level && !t.art) {
    const { angle, elongation } = principalAxis(data, size);
    const turn = levelTurn(angle, t.axis);
    const turned = document.createElement('canvas');
    turned.width = turned.height = size;
    const tc = elongation >= MIN_ELONGATION && Math.abs(turn) > MIN_TURN ? turned.getContext('2d', { willReadFrequently: true }) : null;
    if (tc) {
      tc.translate(size / 2, size / 2);
      tc.rotate(turn);
      tc.drawImage(c, -size / 2, -size / 2);
      c = turned;
      data = tc.getImageData(0, 0, size, size).data;
    }
  }
  let x0 = size;
  let y0 = size;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (data[(y * size + x) * 4 + 3]! > ALPHA) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const crop = document.createElement('canvas');
  crop.width = w;
  crop.height = h;
  const cc = crop.getContext('2d')!;
  cc.drawImage(c, x0, y0, w, h, 0, 0, w, h);
  const color = crop.toDataURL('image/png');
  cc.globalCompositeOperation = 'source-in';
  cc.fillStyle = tint;
  cc.fillRect(0, 0, w, h);
  const out: Glyph = { color, silhouette: crop.toDataURL('image/png'), aspect: w / h };
  cache.set(id, out);
  return out;
}
