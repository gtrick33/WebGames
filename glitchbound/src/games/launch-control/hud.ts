/**
 * The driver portrait, drawn with Canvas 2D: the player icon in the race plates, the line-ups, the
 * results, the live room and the style shop (the drivers sit in closed cars, so this is where you
 * see their helmet and suit). A three-quarter helmet with its stripe, a dark visor catching the
 * sky and a chin bar, over the shoulders of a race suit with a collar and shoulder stripes.
 */
import { shade } from './util';

/** A helmet facing right, centred on (x, y), radius r. */
export function drawHelmet(ctx: CanvasRenderingContext2D, colors: [string, string], x: number, y: number, r: number): void {
  const [shell, stripe] = colors;
  ctx.save();
  // the shell, lit from the top left
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, shade(shell, 0.45));
  g.addColorStop(0.55, shell);
  g.addColorStop(1, shade(shell, -0.4));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.95, y + r * 0.35);
  ctx.bezierCurveTo(x - r * 1.05, y - r * 0.75, x - r * 0.2, y - r * 1.08, x + r * 0.35, y - r * 0.98);
  ctx.bezierCurveTo(x + r * 0.95, y - r * 0.85, x + r * 1.08, y - r * 0.15, x + r * 1.02, y + r * 0.42);
  ctx.lineTo(x + r * 0.92, y + r * 0.82);
  ctx.bezierCurveTo(x + r * 0.4, y + r * 1.0, x - r * 0.5, y + r * 0.98, x - r * 0.85, y + r * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.clip();
  // the stripe over the crown, front to back
  ctx.fillStyle = stripe;
  ctx.beginPath();
  ctx.moveTo(x - r * 1.1, y - r * 0.05);
  ctx.bezierCurveTo(x - r * 0.6, y - r * 0.95, x + r * 0.3, y - r * 1.0, x + r * 0.9, y - r * 0.55);
  ctx.lineTo(x + r * 0.95, y - r * 0.32);
  ctx.bezierCurveTo(x + r * 0.3, y - r * 0.78, x - r * 0.55, y - r * 0.7, x - r * 1.1, y + r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // the visor: dark, with the sky in it
  const v = ctx.createLinearGradient(x, y - r * 0.4, x, y + r * 0.35);
  v.addColorStop(0, '#5a7bd6');
  v.addColorStop(0.45, '#1b1f3a');
  v.addColorStop(1, '#0b0c16');
  ctx.fillStyle = v;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.05, y - r * 0.32);
  ctx.bezierCurveTo(x + r * 0.45, y - r * 0.42, x + r * 0.9, y - r * 0.35, x + r * 1.04, y - r * 0.12);
  ctx.lineTo(x + r * 1.02, y + r * 0.3);
  ctx.bezierCurveTo(x + r * 0.7, y + r * 0.36, x + r * 0.2, y + r * 0.34, x - r * 0.02, y + r * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + r * 0.2, y - r * 0.24);
  ctx.quadraticCurveTo(x + r * 0.55, y - r * 0.3, x + r * 0.8, y - r * 0.22);
  ctx.stroke();
  // the chin bar and the visor's pivot
  ctx.fillStyle = shade(shell, -0.25);
  ctx.beginPath();
  ctx.moveTo(x + r * 0.05, y + r * 0.4);
  ctx.bezierCurveTo(x + r * 0.45, y + r * 0.46, x + r * 0.85, y + r * 0.42, x + r * 0.98, y + r * 0.36);
  ctx.lineTo(x + r * 0.9, y + r * 0.8);
  ctx.bezierCurveTo(x + r * 0.55, y + r * 0.88, x + r * 0.25, y + r * 0.86, x + r * 0.05, y + r * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(shell, -0.5);
  ctx.beginPath();
  ctx.arc(x - r * 0.05, y - r * 0.02, r * 0.11, 0, Math.PI * 2);
  ctx.fill();
  // outline
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.95, y + r * 0.35);
  ctx.bezierCurveTo(x - r * 1.05, y - r * 0.75, x - r * 0.2, y - r * 1.08, x + r * 0.35, y - r * 0.98);
  ctx.bezierCurveTo(x + r * 0.95, y - r * 0.85, x + r * 1.08, y - r * 0.15, x + r * 1.02, y + r * 0.42);
  ctx.stroke();
}

/** The portrait: shoulders in the suit, the helmet on top, centred on x, the helmet at y; `size` is the figure's height. */
export function drawDriver(ctx: CanvasRenderingContext2D, helmet: [string, string], suit: string, x: number, y: number, size: number): void {
  const top = y + size * 0.16;
  const g = ctx.createLinearGradient(x, top, x, top + size * 0.45);
  g.addColorStop(0, shade(suit, 0.18));
  g.addColorStop(1, shade(suit, -0.3));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.5, top + size * 0.5);
  ctx.bezierCurveTo(x - size * 0.5, top + size * 0.12, x - size * 0.3, top, x, top);
  ctx.bezierCurveTo(x + size * 0.3, top, x + size * 0.5, top + size * 0.12, x + size * 0.5, top + size * 0.5);
  ctx.closePath();
  ctx.fill();
  // shoulder stripes and the collar
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1, size * 0.03);
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + k * size * 0.14, top + size * 0.03);
    ctx.quadraticCurveTo(x + k * size * 0.36, top + size * 0.06, x + k * size * 0.46, top + size * 0.3);
    ctx.stroke();
  }
  ctx.fillStyle = shade(suit, -0.45);
  ctx.beginPath();
  ctx.ellipse(x, top + size * 0.02, size * 0.17, size * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  drawHelmet(ctx, helmet, x, y - size * 0.06, size * 0.27);
}
