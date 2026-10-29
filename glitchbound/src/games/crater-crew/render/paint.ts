/**
 * Small drawing helpers shared by the critters, the weapons and the effects, and the ink color of
 * every cartoon outline. Also gives older browsers (Safari 15, Firefox 111) the canvas `roundRect`
 * the art leans on, so the battle draws there instead of failing every frame.
 */
type Ctx = CanvasRenderingContext2D;

/** The outline of everything cartoony. */
export const INK = '#21183a';

/** The arcade's typeface for words on the canvas (a canvas font can't name a CSS variable). */
export const FONT = "'Bricolage', 'Avenir Next', 'Segoe UI', system-ui, sans-serif";

if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (this: Ctx, x: number, y: number, w: number, h: number, radii?: number | DOMPointInit | (number | DOMPointInit)[]) {
    const first = Array.isArray(radii) ? radii[0] : radii;
    const r0 = typeof first === 'number' ? first : (first?.x ?? 0);
    const r = Math.max(0, Math.min(r0, Math.abs(w) / 2, Math.abs(h) / 2));
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

export function ell(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

export function paint(c: Ctx, fill: string | CanvasGradient, line?: string, width = 1.1): void {
  c.fillStyle = fill;
  c.fill();
  if (line) {
    c.strokeStyle = line;
    c.lineWidth = width;
    c.stroke();
  }
}

/** A soft top-left lit gradient over a body centered at (x, y). */
export function shade(c: Ctx, x: number, y: number, r: number, hi: string, lo: string): CanvasGradient {
  const g = c.createRadialGradient(x - r * 0.45, y - r * 0.5, r * 0.1, x, y, r * 1.25);
  g.addColorStop(0, hi);
  g.addColorStop(1, lo);
  return g;
}

/** A top-to-bottom gradient for tubes and sticks: light on top, dark underneath. */
export function tube(c: Ctx, y0: number, y1: number, hi: string, mid: string, lo: string): CanvasGradient {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, hi);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, lo);
  return g;
}

/** A star with `n` points (sparks, fuses, flashes). */
export function star(c: Ctx, x: number, y: number, outer: number, inner: number, n = 4, rot = 0): void {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / n;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i) c.lineTo(px, py);
    else c.moveTo(px, py);
  }
  c.closePath();
}

/** A pair of googly cartoon eyes looking forward (+x), with optional cross eyebrows. */
export function faceEyes(c: Ctx, x: number, y: number, r: number, angry = false): void {
  for (const dx of [0, r * 2.15]) {
    ell(c, x + dx, y, r, r * 1.12);
    paint(c, '#ffffff', INK, Math.max(0.45, r * 0.4));
    ell(c, x + dx + r * 0.32, y + r * 0.12, r * 0.52, r * 0.6);
    paint(c, INK);
    ell(c, x + dx + r * 0.12, y - r * 0.2, r * 0.18, r * 0.18);
    paint(c, '#ffffff');
  }
  if (angry) {
    c.beginPath();
    c.moveTo(x - r * 0.9, y - r * 1.5);
    c.lineTo(x + r * 0.9, y - r * 0.95);
    c.moveTo(x + r * 2.15 - r * 0.9, y - r * 0.95);
    c.lineTo(x + r * 2.15 + r * 0.9, y - r * 1.5);
    c.strokeStyle = INK;
    c.lineWidth = Math.max(0.5, r * 0.45);
    c.lineCap = 'round';
    c.stroke();
    c.lineCap = 'butt';
  }
}
