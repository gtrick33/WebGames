/**
 * The still part of a level, drawn once per size: the night-violet sky with its prism glows and stars, the
 * slate ground with lavender moss on every top, spikes, color blocks with their shapes, and lift tracks.
 */
import { PALS } from './critters';
import { emblem } from './draw';
import { Cell, cellAt, tintAt, type Level } from './level';
import type { Layout } from './render';

const GROUND = '#2b2458';
const MOSS = '#8d7cf0';
const MOSS_LIGHT = '#c3b6ff';

export function hash(x: number, y: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  h ^= h >>> 13;
  return ((h >>> 0) % 1000) / 1000;
}

/** Exit doors: runs of exit cells on a row. */
export function doors(lv: Level): { x: number; y: number; w: number }[] {
  const out: { x: number; y: number; w: number }[] = [];
  for (const e of [...lv.exits].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = out[out.length - 1];
    if (last && last.y === e.y && last.x + last.w === e.x) last.w++;
    else out.push({ x: e.x, y: e.y, w: 1 });
  }
  return out;
}

export function drawScenery(ctx: CanvasRenderingContext2D, lv: Level, L: Layout, cw: number, ch: number): void {
const { s, ox, oy } = L;
  // sky
  const g = ctx.createLinearGradient(0, 0, 0, ch);
  g.addColorStop(0, '#1b1342');
  g.addColorStop(0.6, '#33236b');
  g.addColorStop(1, '#4a2f7d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);
  // soft prism glows and stars
  const glows: [number, number, string][] = [
    [0.15, 0.25, 'rgba(255,148,71,0.10)'],
    [0.5, 0.15, 'rgba(63,216,164,0.09)'],
    [0.82, 0.3, 'rgba(181,140,255,0.13)'],
    [0.35, 0.7, 'rgba(255,216,74,0.07)'],
  ];
  for (const [gx, gy, c] of glows) {
    const r = Math.max(cw, ch) * 0.35;
    const rg = ctx.createRadialGradient(gx * cw, gy * ch, 0, gx * cw, gy * ch, r);
    rg.addColorStop(0, c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, cw, ch);
  }
  for (let k = 0; k < 70; k++) {
    ctx.fillStyle = `rgba(255,255,255,${0.15 + hash(k, 7) * 0.45})`;
    ctx.beginPath();
    ctx.arc(hash(k, 1) * cw, hash(k, 2) * ch * 0.8, 0.6 + hash(k, 3) * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // the play area's back wall
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  ctx.beginPath();
  ctx.roundRect(ox - s * 0.2, oy - s * 0.2, lv.w * s + s * 0.4, lv.h * s + s * 0.4, s * 0.5);
  ctx.fill();
  const ground = (x: number, y: number): boolean => cellAt(lv, x, y) === Cell.Ground && x >= 0 && x < lv.w && y >= 0 && y < lv.h;
  for (let y = 0; y < lv.h; y++)
    for (let x = 0; x < lv.w; x++) {
      const k = cellAt(lv, x, y);
      const px = ox + x * s;
      const py = oy + y * s;
      if (k === Cell.Ground) {
        ctx.fillStyle = GROUND;
        ctx.fillRect(px - 0.5, py - 0.5, s + 1, s + 1);
        if (hash(x, y) > 0.55) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.beginPath();
          ctx.arc(px + s * (0.25 + hash(y, x) * 0.5), py + s * (0.35 + hash(x + 9, y) * 0.4), s * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
        if (!ground(x - 1, y) && x > 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(px, py, s * 0.08, s);
        }
        if (!ground(x + 1, y) && x < lv.w - 1) {
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(px + s * 0.92, py, s * 0.08, s);
        }
        if (!ground(x, y + 1) && y < lv.h - 1) {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(px, py + s * 0.88, s, s * 0.12);
        }
      } else if (k === Cell.Spikes) {
        ctx.fillStyle = '#e3e1f7';
        ctx.strokeStyle = '#5d5890';
        ctx.lineWidth = Math.max(1, s * 0.04);
        ctx.beginPath();
        for (let t = 0; t < 3; t++) {
          const bx = px + s * (0.1 + t * 0.27);
          ctx.moveTo(bx, py + s);
          ctx.lineTo(bx + s * 0.135, py + s * 0.5);
          ctx.lineTo(bx + s * 0.27, py + s);
        }
        ctx.fill();
        ctx.stroke();
      } else if (k === Cell.Block) {
        const c = tintAt(lv, x, y);
        const pal = PALS[c];
        const bg = ctx.createLinearGradient(0, py, 0, py + s);
        bg.addColorStop(0, pal.light);
        bg.addColorStop(0.3, pal.color);
        bg.addColorStop(1, pal.dark);
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.roundRect(px + s * 0.04, py + s * 0.04, s * 0.92, s * 0.92, s * 0.18);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.roundRect(px + s * 0.14, py + s * 0.1, s * 0.5, s * 0.12, s * 0.06);
        ctx.fill();
        ctx.fillStyle = pal.dark;
        ctx.globalAlpha = 0.55;
        emblem(ctx, c, px + s / 2, py + s * 0.56, s * 0.2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (k === Cell.Air && lv.platforms.some((p) => (p.axis === 'h' ? y === p.y && x >= p.lo && x < p.hi + p.w : x >= p.x && x < p.x + p.w && y >= p.lo && y <= p.hi))) {
        ctx.fillStyle = 'rgba(200,190,255,0.25)';
        ctx.beginPath();
        ctx.arc(px + s / 2, py + s * 0.15, s * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  // moss on every top face of the ground
  for (let y = 0; y < lv.h; y++)
    for (let x = 0; x < lv.w; x++) {
      if (!ground(x, y) || ground(x, y - 1) || y === 0) continue;
      const px = ox + x * s;
      const py = oy + y * s;
      const l = !ground(x - 1, y) || ground(x - 1, y - 1);
      const r = !ground(x + 1, y) || ground(x + 1, y - 1);
      ctx.fillStyle = MOSS;
      ctx.beginPath();
      ctx.roundRect(px - (l ? 0 : 0.5), py - s * 0.04, s + (l ? 0 : 0.5) + (r ? 0 : 0.5), s * 0.26, [l ? s * 0.12 : 0, r ? s * 0.12 : 0, s * 0.08, s * 0.08]);
      ctx.fill();
      ctx.fillStyle = MOSS_LIGHT;
      ctx.fillRect(px + (l ? s * 0.1 : 0), py - s * 0.02, s - (l ? s * 0.1 : 0) - (r ? s * 0.1 : 0), s * 0.06);
      // little tufts
      if (hash(x, y + 3) > 0.6) {
        ctx.fillStyle = MOSS;
        ctx.beginPath();
        ctx.ellipse(px + s * (0.3 + hash(x, y) * 0.4), py - s * 0.04, s * 0.07, s * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
}
