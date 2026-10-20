/** The driver portrait (helmet on a suit) drawn with Canvas 2D for the menus and the style shop. */
import { shade } from './util';

export function drawHelmet(ctx: CanvasRenderingContext2D, colors: [string, string], x: number, y: number, r: number): void {
  ctx.fillStyle = colors[0];
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors[1];
  ctx.fillRect(x - r * 0.1, y - r, r * 0.25, r * 2);
  ctx.fillStyle = '#1d1238';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.45, y + r * 0.1, r * 0.5, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

/** The driver card: helmet on a suit, for the menu and the shop. */
export function drawDriver(ctx: CanvasRenderingContext2D, helmet: [string, string], suit: string, x: number, y: number, size: number): void {
  ctx.fillStyle = suit;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.5, y + size * 0.55);
  ctx.quadraticCurveTo(x, y - size * 0.05, x + size * 0.5, y + size * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(suit, -0.35);
  ctx.fillRect(x - size * 0.04, y + size * 0.25, size * 0.08, size * 0.3);
  drawHelmet(ctx, helmet, x, y - size * 0.05, size * 0.3);
}
