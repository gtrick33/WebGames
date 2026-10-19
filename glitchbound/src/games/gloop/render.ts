/** Canvas drawing for Gloop. Rendering only; positions come from sim.ts. */
import { canDrop, DROP_Y, H, LINE, nextTier, RADII, W, type Sim } from './sim';

type C = CanvasRenderingContext2D;
const INK = '#2a1446';

/** Body color per size (matching the share line's circles); the biggest is a rainbow. */
export const BLOB_COLORS = ['#f3eefc', '#ffd23f', '#ff9a3c', '#ff5d5d', '#ff8fc8', '#a66bff', '#3d8bff', '#6fd8ff', '#3fcf7a', '#b27a4d', '#ffffff'];

function body(ctx: C, tier: number, r: number): void {
  if (tier === BLOB_COLORS.length - 1) {
    const g = ctx.createLinearGradient(-r, -r, r, r);
    ['#ff5d5d', '#ffb020', '#ffe066', '#3fcf7a', '#3d8bff', '#a66bff'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
    ctx.fillStyle = g;
  } else ctx.fillStyle = BLOB_COLORS[tier]!;
}

/** One blob at the origin: outlined body, a glossy shine and a face that grows calmer as blobs get bigger. */
export function drawBlob(ctx: C, tier: number, r: number, t: number, pop = 0, wobble = 0): void {
  const sx = 1 + pop * 0.18 + Math.sin(t * 7 + wobble) * 0.012;
  const sy = 1 - pop * 0.14 - Math.sin(t * 7 + wobble) * 0.012;
  ctx.save();
  ctx.scale(sx, sy);
  ctx.lineWidth = Math.max(2.5, r * 0.09);
  ctx.strokeStyle = INK;
  body(ctx, tier, r);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.26, r * 0.15, -0.6, 0, Math.PI * 2);
  ctx.fill();
  // Face
  const ey = -r * 0.08;
  const ex = r * 0.3;
  const er = Math.max(2.2, r * 0.14);
  const blink = Math.sin(t * 1.3 + wobble * 3) > 0.985;
  ctx.fillStyle = INK;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    if (blink) ctx.ellipse(side * ex, ey, er, er * 0.18, 0, 0, Math.PI * 2);
    else ctx.arc(side * ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
    if (!blink) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(side * ex + er * 0.35, ey - er * 0.35, er * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
    }
  }
  ctx.lineWidth = Math.max(1.6, r * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, ey + r * 0.14, r * 0.2, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  // Rosy cheeks
  ctx.fillStyle = 'rgba(255,80,120,0.28)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * ex * 1.45, ey + r * 0.2, r * 0.13, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export interface View {
  cw: number;
  ch: number;
  ctx: CanvasRenderingContext2D | null;
}
export const newView = (): View => ({ cw: 0, ch: 0, ctx: null });

/** Maps a pointer's client x to world x, given the canvas rect. */
export function worldX(rect: DOMRect, clientX: number): number {
  const k = Math.min(rect.width / W, rect.height / H);
  const ox = (rect.width - W * k) / 2;
  return (clientX - rect.left - ox) / k;
}

export function drawFrame(canvas: HTMLCanvasElement, view: View, s: Sim, t: number, flashes: { x: number; y: number; r: number; age: number }[]): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = view.cw || canvas.clientWidth;
  const ch = view.ch || canvas.clientHeight;
  if (!cw || !ch) return;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  const ctx = (view.ctx ??= canvas.getContext('2d'));
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const k = Math.min((cw * dpr) / W, (ch * dpr) / H);
  const ox = (cw * dpr - W * k) / 2;
  const oy = (ch * dpr - H * k) / 2;
  ctx.setTransform(k, 0, 0, k, ox, oy);

  // The jar: glass with a soft inner glow.
  const glass = ctx.createLinearGradient(0, 0, 0, H);
  glass.addColorStop(0, 'rgba(255,255,255,0.35)');
  glass.addColorStop(1, 'rgba(255,255,255,0.6)');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, [6, 6, 28, 28]);
  ctx.fill();
  // The line: dashed, glowing red as blobs linger above it.
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = s.danger > 0 ? `rgba(255,40,80,${0.4 + 0.6 * Math.abs(Math.sin(t * 10))})` : 'rgba(42,20,70,0.3)';
  ctx.beginPath();
  ctx.moveTo(4, LINE);
  ctx.lineTo(W - 4, LINE);
  ctx.stroke();
  ctx.restore();

  // The next blob, waiting under the dropper, with a guide line.
  if (canDrop(s)) {
    const tier = nextTier(s);
    const r = RADII[tier]!;
    ctx.save();
    ctx.setLineDash([3, 7]);
    ctx.strokeStyle = 'rgba(42,20,70,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.aim, DROP_Y + r);
    ctx.lineTo(s.aim, H);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(s.aim, DROP_Y + Math.sin(t * 4) * 2);
    drawBlob(ctx, tier, r, t);
    ctx.restore();
  }

  for (const b of s.blobs) {
    ctx.save();
    ctx.translate(b.x, b.y);
    drawBlob(ctx, b.tier, b.r, t, b.pop, b.id);
    ctx.restore();
  }

  // Merge sparkles.
  for (const f of flashes) {
    const a = 1 - f.age / 0.5;
    if (a <= 0) continue;
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * (1 + f.age * 1.6), 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + f.age * 3;
      const d = f.r * (1.1 + f.age * 2.2);
      ctx.fillStyle = `rgba(255,224,102,${a})`;
      ctx.beginPath();
      ctx.arc(f.x + Math.cos(ang) * d, f.y + Math.sin(ang) * d, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The jar's rim on top of everything.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, [6, 6, 28, 28]);
  ctx.stroke();
}

