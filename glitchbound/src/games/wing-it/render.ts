/** Canvas drawing for Wing It. Rendering only; positions come from sim.ts. */
import { biomeFor, BIRD_R, BIRD_X, gapCentre, GROUND, H, PILLAR_W, STEP, W, type Biome, type Sim } from './sim';

type C = CanvasRenderingContext2D;
const INK = '#1d1238';

const LOOK: Record<Biome, { sky: [string, string]; hills: [string, string]; pillar: [string, string]; ground: string; dirt: string; stars: boolean; sun: string | null }> = {
  meadow: { sky: ['#8fdcff', '#e8f9ff'], hills: ['#9ed97a', '#76c45c'], pillar: ['#3fbf6a', '#2f9e55'], ground: '#7bd26b', dirt: '#e2b878', stars: false, sun: '#ffe066' },
  sunset: { sky: ['#ff9a8b', '#ffd59e'], hills: ['#d98ba0', '#b8708d'], pillar: ['#ff8a4c', '#e06a2f'], ground: '#f2a65a', dirt: '#d98943', stars: false, sun: '#fff1a8' },
  night: { sky: ['#1b2a5c', '#46407a'], hills: ['#2c3a6b', '#22305a'], pillar: ['#5b6cff', '#3f4fd9'], ground: '#3a4a86', dirt: '#2a3566', stars: true, sun: null },
  space: { sky: ['#12082e', '#3a1f6b'], hills: ['#4b2a7a', '#3a2063'], pillar: ['#c45cff', '#9b3fe0'], ground: '#5a3a8f', dirt: '#3e2766', stars: true, sun: null },
};

function hills(ctx: C, offset: number, base: number, amp: number, color: string, wave: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  for (let x = 0; x <= W; x += 10) {
    const k = (x + offset) / wave;
    ctx.lineTo(x, base - Math.sin(k) * amp - Math.sin(k * 2.3) * amp * 0.4);
  }
  ctx.lineTo(W, GROUND);
  ctx.fill();
}

function pillar(ctx: C, x: number, y: number, h: number, colors: [string, string], cap: 'top' | 'bottom'): void {
  if (h <= 0) return;
  ctx.fillStyle = colors[0];
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x + 5, y, PILLAR_W - 10, h, 4);
  ctx.fill();
  ctx.stroke();
  // Shine and shade stripes.
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x + 12, y, 8, h);
  ctx.fillStyle = colors[1];
  ctx.fillRect(x + PILLAR_W - 20, y + 2, 9, Math.max(0, h - 4));
  // Cap at the gap end.
  const cy = cap === 'top' ? y + h - 24 : y;
  ctx.fillStyle = colors[0];
  ctx.beginPath();
  ctx.roundRect(x, cy, PILLAR_W, 24, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(x + 7, cy + 4, 10, 16);
}

function feather(ctx: C, x: number, y: number, t: number): void {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 5) * 3);
  ctx.rotate(-0.5 + Math.sin(t * 3) * 0.15);
  ctx.fillStyle = '#ffd21f';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.quadraticCurveTo(10, -2, 0, 14);
  ctx.quadraticCurveTo(-10, -2, 0, -14);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(0, 16);
  ctx.stroke();
  ctx.restore();
}

export function drawBird(ctx: C, x: number, y: number, vy: number, flapT: number, t: number, dead: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.max(-0.45, Math.min(1.2, vy / 700)));
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  // Body
  ctx.fillStyle = '#ffcf3a';
  ctx.beginPath();
  ctx.ellipse(0, 0, BIRD_R + 3, BIRD_R, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Belly
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.ellipse(-2, 6, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wing: up while flapping, gently beating otherwise.
  const up = flapT > 0 ? -1 : Math.sin(t * 14) * 0.4;
  ctx.fillStyle = '#ff9f1c';
  ctx.beginPath();
  ctx.ellipse(-6, 1 + up * 6, 10, 6, -0.4 + up * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(8, -5, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  if (dead) {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(5, -8);
    ctx.lineTo(11, -2);
    ctx.moveTo(11, -8);
    ctx.lineTo(5, -2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(9.5, -5, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Beak
  ctx.fillStyle = '#ff6a1a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(25, 3);
  ctx.lineTo(14, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Canvas size in CSS pixels, kept by a ResizeObserver so frames never read layout. */
export interface View {
  cw: number;
  ch: number;
  ctx: CanvasRenderingContext2D | null;
  /** Sky gradient, rebuilt only when the biome or size changes. */
  sky: CanvasGradient | null;
  skyKey: string;
}

export const newView = (): View => ({ cw: 0, ch: 0, ctx: null, sky: null, skyKey: '' });

/**
 * Draws a frame. `t` is wall time in seconds (for idle animation); `alpha` (0-1) places the frame
 * between the last two physics steps, so motion stays smooth whatever the display's refresh rate.
 */
export function drawFrame(canvas: HTMLCanvasElement, view: View, s: Sim, t: number, alpha = 1): void {
  // A cartoon look needs no more than 2x pixels; 3x screens would triple the fill work for nothing.
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = view.cw || canvas.clientWidth;
  const ch = view.ch || canvas.clientHeight;
  if (!cw || !ch) return;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    view.skyKey = '';
  }
  const ctx = (view.ctx ??= canvas.getContext('2d'));
  if (!ctx) return;
  // Step back from the latest physics state to where the world was at this moment.
  const back = 1 - Math.max(0, Math.min(1, alpha));
  const dx = s.lastDx * back;
  const dist = s.dist - dx;
  const y = s.y - (s.y - s.prevY) * back;
  const st = s.lastDx ? s.t - back * STEP : s.t;
  // Fit the world (W x H) to the canvas, centred; extra space shows more sky above and ground below.
  const k = Math.min((cw * dpr) / W, (ch * dpr) / H);
  const ox = (cw * dpr - W * k) / 2;
  const oy = (ch * dpr - H * k) / 2;
  const left = -ox / k;
  const top = -oy / k;
  const fullW = canvas.width / k;
  const bottom = top + canvas.height / k;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const look = LOOK[biomeFor(s.score)];
  ctx.fillStyle = look.sky[0];
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, ox, oy);
  ctx.save();

  const skyKey = `${look.sky[0]}:${top}`;
  if (view.skyKey !== skyKey || !view.sky) {
    const sky = ctx.createLinearGradient(0, top, 0, GROUND);
    sky.addColorStop(0, look.sky[0]);
    sky.addColorStop(1, look.sky[1]);
    view.sky = sky;
    view.skyKey = skyKey;
  }
  ctx.fillStyle = view.sky;
  ctx.fillRect(left, top, fullW, GROUND - top);
  if (look.stars) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 40; i++) {
      const x = (((i * 97 - dist * 0.05) % (W + 40)) + W + 40) % (W + 40) - 20;
      ctx.fillRect(x, (i * 53) % (GROUND - 120), 2, 2);
    }
  }
  if (look.sun) {
    ctx.fillStyle = look.sun;
    ctx.beginPath();
    ctx.arc(310, 120, 38, 0, Math.PI * 2);
    ctx.fill();
  }
  // Clouds
  ctx.fillStyle = look.stars ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 4; i++) {
    const x = ((((i * 160 - dist * 0.2) % (W + 160)) + W + 160) % (W + 160)) - 80;
    const y = 70 + i * 55;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.arc(x + 24, y - 8, 26, 0, Math.PI * 2);
    ctx.arc(x + 50, y, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  hills(ctx, dist * 0.25, GROUND - 90, 26, look.hills[0], 70);
  hills(ctx, dist * 0.5 + 300, GROUND - 40, 18, look.hills[1], 50);

  for (const p of s.pillars) {
    const px = p.x + dx;
    if (px > left + fullW || px + PILLAR_W < left) continue;
    const cy = gapCentre(p, st);
    pillar(ctx, px, top - 10, cy - p.gapH / 2 - top + 10, look.pillar, 'top');
    pillar(ctx, px, cy + p.gapH / 2, GROUND - (cy + p.gapH / 2), look.pillar, 'bottom');
    if (p.feather) feather(ctx, px + PILLAR_W / 2, cy, t);
  }

  // Ground with scrolling stripes.
  ctx.fillStyle = look.dirt;
  ctx.fillRect(left, GROUND, fullW, bottom - GROUND);
  ctx.fillStyle = look.ground;
  ctx.fillRect(left, GROUND, fullW, 16);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(left, GROUND);
  ctx.lineTo(left + fullW, GROUND);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = left - (dist % 28) - 28; x < left + fullW + 28; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND + 16);
    ctx.lineTo(x + 14, GROUND + 16);
    ctx.lineTo(x + 4, GROUND + 54);
    ctx.lineTo(x - 10, GROUND + 54);
    ctx.fill();
  }

  drawBird(ctx, BIRD_X, y, s.started ? s.vy : 0, s.flapT, t, s.dead);
  ctx.restore();
}
