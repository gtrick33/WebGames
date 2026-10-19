/** Canvas drawing for Wing It. Rendering only; positions come from sim.ts. */
import { biomeFor, BIRD_R, BIRD_X, gapCentre, GROUND, H, PILLAR_W, STEP, W, type Biome, type Sim } from './sim';

type C = CanvasRenderingContext2D;
const INK = '#1d1238';

/** Obstacles are stacked stones (cairns), never pipes; the gap-end stone carries a tuft per biome. */
const LOOK: Record<Biome, { sky: [string, string]; hills: [string, string]; pillar: [string, string]; tuft: string; ground: string; dirt: string; stars: boolean; sun: string | null }> = {
  meadow: { sky: ['#8fdcff', '#e8f9ff'], hills: ['#9ed97a', '#76c45c'], pillar: ['#dcc79c', '#b89f74'], tuft: '#5fc25a', ground: '#7bd26b', dirt: '#e2b878', stars: false, sun: '#ffe066' },
  sunset: { sky: ['#ff9a8b', '#ffd59e'], hills: ['#d98ba0', '#b8708d'], pillar: ['#ec8f63', '#c86b42'], tuft: '#ffd166', ground: '#f2a65a', dirt: '#d98943', stars: false, sun: '#fff1a8' },
  night: { sky: ['#1b2a5c', '#46407a'], hills: ['#2c3a6b', '#22305a'], pillar: ['#8b97ff', '#6170e0'], tuft: '#b8f3ff', ground: '#3a4a86', dirt: '#2a3566', stars: true, sun: null },
  space: { sky: ['#12082e', '#3a1f6b'], hills: ['#4b2a7a', '#3a2063'], pillar: ['#c96bff', '#9b3fe0'], tuft: '#ff9be9', ground: '#5a3a8f', dirt: '#3e2766', stars: true, sun: null },
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

const STONE_H = 30;

/**
 * One obstacle: a cairn of rounded stones stacked from the gap end outwards, each nudged left or right
 * by its place in the stack (so the stack never flickers as the gap drifts). Stays inside PILLAR_W.
 */
function pillar(ctx: C, x: number, y: number, h: number, look: (typeof LOOK)[Biome], end: 'top' | 'bottom'): void {
  if (h <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 2, y, PILLAR_W + 4, h);
  ctx.clip();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  const n = Math.ceil(h / STONE_H) + 1;
  for (let i = n - 1; i >= 0; i--) {
    // i = 0 is the stone at the gap.
    const sy = end === 'top' ? y + h - (i + 1) * STONE_H : y + i * STONE_H;
    const nudge = (((i * 7) % 3) - 1) * 4;
    const inset = i === 0 ? 2 : 6 + ((i * 5) % 2) * 3;
    const sx = x + inset + nudge;
    const sw = PILLAR_W - inset * 2;
    ctx.fillStyle = i % 2 ? look.pillar[1] : look.pillar[0];
    ctx.beginPath();
    ctx.roundRect(sx, sy + 1, sw, STONE_H - 2, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.ellipse(sx + sw * 0.32, sy + 9, sw * 0.18, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // A tuft on the gap-end stone: grass, dry flowers, frost or alien fronds.
  const ty = end === 'top' ? y + h : y;
  const dir = end === 'top' ? 1 : -1;
  ctx.fillStyle = look.tuft;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  for (const [ox, len, lean] of [[18, 8, -0.5], [30, 11, -0.15], [42, 10, 0.2], [53, 7, 0.55]] as const) {
    ctx.beginPath();
    ctx.moveTo(x + ox - 4, ty);
    ctx.quadraticCurveTo(x + ox + lean * 10, ty + dir * len * 1.1, x + ox + lean * 12, ty + dir * len);
    ctx.quadraticCurveTo(x + ox + 2, ty + dir * len * 0.4, x + ox + 4, ty);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
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

/** The hero: a round pink finch with a crest and a short tail. */
export function drawBird(ctx: C, x: number, y: number, vy: number, flapT: number, t: number, dead: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.max(-0.45, Math.min(1.2, vy / 700)));
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  // Tail
  ctx.fillStyle = '#c93a68';
  ctx.beginPath();
  ctx.moveTo(-BIRD_R + 2, -2);
  ctx.lineTo(-BIRD_R - 11, -9);
  ctx.lineTo(-BIRD_R - 8, 2);
  ctx.lineTo(-BIRD_R - 12, 9);
  ctx.lineTo(-BIRD_R + 2, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Crest: three feathers on top of the head.
  ctx.fillStyle = '#ff4f86';
  for (const [cx, lean] of [[2, -0.5], [7, -0.15], [12, 0.25]] as const) {
    ctx.beginPath();
    ctx.moveTo(cx - 3, -BIRD_R + 3);
    ctx.quadraticCurveTo(cx + lean * 10 - 2, -BIRD_R - 9, cx + lean * 12, -BIRD_R - 10);
    ctx.quadraticCurveTo(cx + 1, -BIRD_R - 3, cx + 3, -BIRD_R + 3);
    ctx.fill();
    ctx.stroke();
  }
  // Body
  ctx.fillStyle = '#ff7aa2';
  ctx.beginPath();
  ctx.arc(0, 0, BIRD_R + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Belly
  ctx.fillStyle = '#ffe1ea';
  ctx.beginPath();
  ctx.ellipse(3, 7, 10, 6.5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Cheek
  ctx.fillStyle = 'rgba(255,90,120,0.55)';
  ctx.beginPath();
  ctx.arc(6, 3, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Wing: up while flapping, gently beating otherwise.
  const up = flapT > 0 ? -1 : Math.sin(t * 14) * 0.4;
  ctx.fillStyle = '#d94a7a';
  ctx.beginPath();
  ctx.ellipse(-8, 4 + up * 4, 9, 6, -0.3 + up * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Eye: a dot with a sparkle (an x when the run ends).
  ctx.fillStyle = INK;
  if (dead) {
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(4, -9);
    ctx.lineTo(10, -3);
    ctx.moveTo(10, -9);
    ctx.lineTo(4, -3);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(7, -6, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(8.3, -7.3, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Beak: short and pointed.
  ctx.fillStyle = '#ffc233';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(BIRD_R - 1, -4);
  ctx.lineTo(BIRD_R + 9, 0);
  ctx.lineTo(BIRD_R - 1, 4);
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
  // Opaque: every frame covers the whole canvas, so the page never has to blend it.
  const ctx = (view.ctx ??= canvas.getContext('2d', { alpha: false }));
  if (!ctx) return;
  // Step back from the latest physics state to where the world was at this moment.
  const back = 1 - Math.max(0, Math.min(1, alpha));
  const dx = s.lastDx * back;
  const dist = s.dist - dx;
  const y = s.y - (s.y - s.prevY) * back;
  const st = s.lastDx ? s.t - back * STEP : s.t;
  // Fit the world (W x H) to the canvas, centerd; extra space shows more sky above and ground below.
  const k = Math.min((cw * dpr) / W, (ch * dpr) / H);
  const ox = (cw * dpr - W * k) / 2;
  const oy = (ch * dpr - H * k) / 2;
  const left = -ox / k;
  const top = -oy / k;
  const fullW = canvas.width / k;
  const bottom = top + canvas.height / k;
  const look = LOOK[biomeFor(s.score)];
  // No separate clear: the sky (top to ground) and the dirt (ground to bottom) cover the whole canvas.
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
    pillar(ctx, px, top - 10, cy - p.gapH / 2 - top + 10, look, 'top');
    pillar(ctx, px, cy + p.gapH / 2, GROUND - (cy + p.gapH / 2), look, 'bottom');
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
