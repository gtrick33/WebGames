/** The 2D overlay on top of the 3D race: tacho, progress bar, banners and popups; plus the driver portrait. */
import { clamp, lerp, shade } from './util';

export interface Hud {
  t: number;
  tacho: { rpm: number; redline: number; gear: number; gears: number; v: number; window: [number, number] | null; staging: boolean; perfectFrom: number } | null;
  progress: [number, number] | null;
  /** Player and rival, for the progress bar. */
  names?: [string, string];
  banner: { text: string; sub?: string; color: string } | null;
  popups: { text: string; at: number; color: string }[];
}

export function drawHud(ctx: CanvasRenderingContext2D, w: number, h: number, hud: Hud): void {
  ctx.clearRect(0, 0, w, h);
  if (hud.progress) progressBar(ctx, w, hud.progress, hud.names);
  if (hud.tacho) tacho(ctx, w, h, hud.tacho);
  if (hud.banner) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.min(w * 0.13, h * 0.18)}px sans-serif`;
    ctx.lineWidth = Math.max(3, w * 0.012);
    ctx.strokeStyle = '#1d1238';
    ctx.strokeText(hud.banner.text, w / 2, h * 0.28);
    ctx.fillStyle = hud.banner.color;
    ctx.fillText(hud.banner.text, w / 2, h * 0.28);
    if (hud.banner.sub) {
      ctx.font = `bold ${Math.min(w * 0.045, 22)}px sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeText(hud.banner.sub, w / 2, h * 0.28 + Math.min(w * 0.1, h * 0.14));
      ctx.fillStyle = '#fff';
      ctx.fillText(hud.banner.sub, w / 2, h * 0.28 + Math.min(w * 0.1, h * 0.14));
    }
  }
  for (const p of hud.popups) {
    const age = hud.t - p.at;
    if (age < 0 || age > 1) continue;
    ctx.globalAlpha = 1 - age;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.min(w * 0.06, 32)}px sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1d1238';
    ctx.strokeText(p.text, w * 0.5, h * 0.5 - age * 30);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, w * 0.5, h * 0.5 - age * 30);
    ctx.globalAlpha = 1;
  }
}

function progressBar(ctx: CanvasRenderingContext2D, w: number, pr: [number, number], names?: [string, string]): void {
  const x0 = w * 0.2;
  const x1 = w * 0.8;
  const y = 18;
  ctx.fillStyle = 'rgba(29,18,56,0.6)';
  ctx.fillRect(x0 - 8, y - 6, x1 - x0 + 16, 12);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x1 - 2, y - 8, 4, 16);
  const dot = (p: number, col: string, up: boolean): void => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(lerp(x0, x1, clamp(p, 0, 1)), y + (up ? -1 : 1), 6, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(pr[1], '#5ad1ff', true);
  dot(pr[0], '#ffd23f', false);
  // Names only when there is room beside the bar (phones keep the hint and pause button clear).
  if (names && w >= 560) {
    ctx.font = 'bold 11px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5ad1ff';
    ctx.textAlign = 'right';
    ctx.fillText(names[1], x0 - 14, y);
    ctx.fillStyle = '#ffd23f';
    ctx.textAlign = 'left';
    ctx.fillText(names[0], x1 + 14, y);
  }
}

function tacho(ctx: CanvasRenderingContext2D, w: number, h: number, t: NonNullable<Hud['tacho']>): void {
  const r = Math.min(w * 0.16, h * 0.24, 110);
  const cx = r + 14;
  const cy = h - 14;
  const a0 = Math.PI;
  const a1 = Math.PI * 2;
  const ang = (f: number): number => a0 + clamp(f, 0, 1.02) * (a1 - a0);
  ctx.fillStyle = 'rgba(29,18,56,0.8)';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, a0, a1);
  ctx.lineTo(cx + r + 8, cy + 10);
  ctx.lineTo(cx - r - 8, cy + 10);
  ctx.closePath();
  ctx.fill();
  const band = (f0: number, f1: number, col: string): void => {
    ctx.strokeStyle = col;
    ctx.lineWidth = r * 0.22;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.82, ang(f0), ang(f1));
    ctx.stroke();
  };
  band(0, 1, '#3a3845');
  if (t.staging && t.window) band(t.window[0] / t.redline, t.window[1] / t.redline, '#06d6a0');
  if (!t.staging && t.gears > 1) {
    band(0.8, t.perfectFrom, '#ffd23f');
    band(t.perfectFrom, 1, '#06d6a0');
  }
  band(0.98, 1.02, '#e63946');
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 10; i++) {
    const a = ang(i / 10);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.66, cy + Math.sin(a) * r * 0.66);
    ctx.lineTo(cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72);
    ctx.stroke();
  }
  const a = ang(t.rpm / t.redline);
  ctx.strokeStyle = '#ff5a6c';
  ctx.lineWidth = Math.max(3, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 ${r * 0.42}px sans-serif`;
  ctx.fillText(t.gears === 1 ? 'D' : String(t.gear), cx, cy - r * 0.18);
  ctx.font = `bold ${r * 0.2}px sans-serif`;
  ctx.fillText(`${Math.round(t.v * 3.6)} km/h`, cx, cy - 2);
  ctx.font = `${r * 0.16}px sans-serif`;
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(`${Math.round(t.rpm / 100) * 100} rpm`, cx + r * 0.6, cy - r * 0.95 + r * 0.16);
}

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
