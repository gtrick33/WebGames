/**
 * Draws a Prism Pals level: a night-violet sky, slate ground with lavender moss, bright color blocks with
 * their shapes, goo, gates, plates, crates, springs, levers, lifts, gems, the prism door and the pals. The
 * still parts are drawn once per size into a layer of their own; the rest every frame.
 */
import { PALS, type ColorId } from './critters';
import { drawGem, drawPal, emblem } from './draw';
import { Cell, cellAt, platformAt, tintAt, type Level } from './level';
import { doors, drawScenery, hash } from './scenery';
import { CH, CW, EXIT_HOLD, STEP, type SimEvent, type World } from './sim';

export interface Layout {
  s: number;
  ox: number;
  oy: number;
}

/** Fits the level in a box `cw` × `ch` CSS pixels, below a top bar of `top`. */
export function fit(lv: Level, cw: number, ch: number, top: number): Layout {
  const s = Math.max(4, Math.min(cw / lv.w, (ch - top) / lv.h));
  return { s, ox: (cw - lv.w * s) / 2, oy: top + (ch - top - lv.h * s) / 2 };
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  star: boolean;
}

interface Look {
  walk: number;
  squash: number;
  blinkAt: number;
}

export class Renderer {
  private layer: HTMLCanvasElement | null = null;
  private layerKey = '';
  private bits: Bit[] = [];
  private looks: Look[] = [];
  private springAt: number[] = [];
  private time = 0;
  reduced = false;

  /** Reacts to what happened in a step (sparkles, puffs, dust). */
  events(ev: readonly SimEvent[], w: World): void {
    const lv = w.lv;
    const many = this.reduced ? 0.4 : 1;
    for (const e of ev) {
      const c = w.cr[e.i];
      if (e.k === 'gem') {
        const g = lv.gems[e.i];
        if (g) this.burst(g.x + 0.5, g.y + 0.5, PALS[g.color].color, Math.round(12 * many), 4, true);
      } else if (e.k === 'die' && c) {
        const x = e.x ?? c.x + CW / 2;
        const y = e.y ?? c.y + CH / 2;
        this.burst(x, y, PALS[c.color].color, Math.round(18 * many), 5, false);
        this.burst(x, y, '#ffffff', Math.round(8 * many), 3, false);
      } else if (e.k === 'jump' && c) this.burst(c.x + CW / 2, c.y + CH, 'rgba(220,210,255,0.8)', Math.round(4 * many), 1.5, false);
      else if (e.k === 'land' && c) {
        this.burst(c.x + CW / 2, c.y + CH, 'rgba(220,210,255,0.8)', Math.round(6 * many), 2, false);
        const look = this.looks[e.i];
        if (look) look.squash = 1;
      } else if (e.k === 'spring' && c) {
        const k = lv.springs.findIndex((s) => Math.abs(s.x + 0.5 - (c.x + CW / 2)) < 1 && Math.abs(s.y - c.y) < 2);
        if (k >= 0) this.springAt[k] = this.time;
        this.burst(c.x + CW / 2, c.y + CH, '#ffe58a', Math.round(6 * many), 3, true);
      } else if (e.k === 'clear')
        for (const d of doors(lv)) for (let k = 0; k < 3; k++) this.burst(d.x + d.w / 2, d.y - 0.5, PALS[(k % 4) as ColorId].color, Math.round(14 * many), 6, true);
    }
  }

  private burst(x: number, y: number, color: string, n: number, speed: number, star: boolean): void {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.4, life: 0, max: 0.5 + Math.random() * 0.5, color, size: 0.06 + Math.random() * 0.07, star });
    }
    if (this.bits.length > 400) this.bits.splice(0, this.bits.length - 400);
  }

  private still(lv: Level, L: Layout, cw: number, ch: number, dpr: number): HTMLCanvasElement {
    const key = `${lv.name}|${cw}|${ch}|${dpr}|${L.s}`;
    if (this.layer && this.layerKey === key) return this.layer;
    const cv = this.layer ?? document.createElement('canvas');
    cv.width = Math.round(cw * dpr);
    cv.height = Math.round(ch * dpr);
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScenery(ctx, lv, L, cw, ch);
    this.layer = cv;
    this.layerKey = key;
    return cv;
  }

  /** One frame. `active`: the critter this player steers now; `labels`: a name over each critter (online). */
  draw(ctx: CanvasRenderingContext2D, w: World, L: Layout, cw: number, ch: number, dpr: number, dt: number, active: number, mine: readonly boolean[], labels: readonly string[] | null): void {
    const lv = w.lv;
    const { s, ox, oy } = L;
    this.time += dt;
    const time = this.time;
    const bob = this.reduced ? 0 : 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.still(lv, L, cw, ch, dpr), 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const X = (x: number): number => ox + x * s;
    const Y = (y: number): number => oy + y * s;
    // goo, gates, plates, levers, springs
    for (let y = 0; y < lv.h; y++)
      for (let x = 0; x < lv.w; x++) {
        const k = cellAt(lv, x, y);
        if (k === Cell.Air || k === Cell.Ground || k === Cell.Spikes || k === Cell.Block || k === Cell.Exit) continue;
        const px = X(x);
        const py = Y(y);
        const c = tintAt(lv, x, y);
        const pal = PALS[c];
        if (k === Cell.Goo) {
          const surface = cellAt(lv, x, y - 1) !== Cell.Goo;
          const top = surface ? 0.3 : 0;
          ctx.fillStyle = pal.color;
          ctx.globalAlpha = 0.82;
          ctx.beginPath();
          ctx.moveTo(px - 0.5, py + s + 0.5);
          if (surface) for (let t = 0; t <= 6; t++) ctx.lineTo(px + (t / 6) * s, py + s * (top + Math.sin(time * 3 * bob + x * 1.7 + t) * 0.04));
          else {
            ctx.lineTo(px - 0.5, py - 0.5);
            ctx.lineTo(px + s + 0.5, py - 0.5);
          }
          ctx.lineTo(px + s + 0.5, py + s + 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
          if (surface) {
            ctx.fillStyle = pal.light;
            ctx.fillRect(px, py + s * (top + 0.02), s, s * 0.05);
            const b = (time * 0.7 * bob + hash(x, y)) % 1;
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = Math.max(1, s * 0.03);
            ctx.beginPath();
            ctx.arc(px + s * (0.3 + hash(y, x) * 0.4), py + s * (0.95 - b * 0.6), s * 0.05 * (1 - b * 0.5), 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = pal.dark;
          ctx.globalAlpha = 0.35;
          emblem(ctx, c, px + s / 2, py + s * 0.68, s * 0.14);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (k === Cell.Gate || k === Cell.LeverGate || k === Cell.LeverGateOpen) {
          const open = k === Cell.Gate ? w.gates[c] : k === Cell.LeverGate ? w.leverOn : !w.leverOn;
          const col = k === Cell.Gate ? pal.color : '#c9c3e8';
          const dark = k === Cell.Gate ? pal.dark : '#5d5890';
          ctx.strokeStyle = dark;
          ctx.lineWidth = Math.max(1, s * 0.05);
          ctx.fillStyle = col;
          if (open) {
            ctx.globalAlpha = 0.35;
            ctx.setLineDash([s * 0.12, s * 0.1]);
            ctx.strokeRect(px + s * 0.1, py + s * 0.05, s * 0.8, s * 0.9);
            ctx.setLineDash([]);
            ctx.fillRect(px + s * 0.1, py + s * 0.05, s * 0.8, s * 0.1);
            ctx.globalAlpha = 1;
          } else {
            ctx.fillStyle = k === Cell.Gate ? pal.dark : '#4a4478';
            ctx.fillRect(px + s * 0.06, py, s * 0.88, s);
            ctx.fillStyle = col;
            for (let t = 0; t < 3; t++) {
              ctx.beginPath();
              ctx.roundRect(px + s * (0.14 + t * 0.26), py + s * 0.04, s * 0.2, s * 0.92, s * 0.08);
              ctx.fill();
            }
            if (k === Cell.Gate) {
              ctx.fillStyle = '#fff';
              ctx.globalAlpha = 0.9;
              emblem(ctx, c, px + s / 2, py + s / 2, s * 0.17);
              ctx.fill();
              ctx.globalAlpha = 1;
            } else {
              ctx.fillStyle = '#fff';
              ctx.beginPath();
              ctx.arc(px + s / 2, py + s / 2, s * 0.12, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else if (k === Cell.Plate) {
          const down = w.gates[c];
          const ph = down ? s * 0.06 : s * 0.14;
          if (down) {
            const rg = ctx.createRadialGradient(px + s / 2, py + s, 0, px + s / 2, py + s, s * 0.8);
            rg.addColorStop(0, pal.color + 'aa');
            rg.addColorStop(1, pal.color + '00');
            ctx.fillStyle = rg;
            ctx.fillRect(px - s * 0.3, py, s * 1.6, s);
          }
          ctx.fillStyle = '#4a4478';
          ctx.fillRect(px + s * 0.06, py + s - s * 0.06, s * 0.88, s * 0.06);
          ctx.fillStyle = pal.color;
          ctx.strokeStyle = pal.dark;
          ctx.lineWidth = Math.max(1, s * 0.04);
          ctx.beginPath();
          ctx.roundRect(px + s * 0.1, py + s - s * 0.06 - ph, s * 0.8, ph, s * 0.05);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = pal.dark;
          emblem(ctx, c, px + s / 2, py + s - s * 0.06 - ph / 2, s * 0.06);
          ctx.fill();
        } else if (k === Cell.Lever) {
          const j = lv.levers.findIndex((l) => l.x === x && l.y === y);
          const on = !!w.levers[j];
          const tip = { x: px + s / 2 + (on ? 1 : -1) * s * 0.3, y: py + s * 0.3 };
          // a light stick with a dark edge, so it reads on the night sky
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#2a2350';
          ctx.lineWidth = Math.max(3, s * 0.16);
          ctx.beginPath();
          ctx.moveTo(px + s / 2, py + s * 0.82);
          ctx.lineTo(tip.x, tip.y);
          ctx.stroke();
          ctx.strokeStyle = '#e9e4ff';
          ctx.lineWidth = Math.max(1.5, s * 0.08);
          ctx.stroke();
          ctx.fillStyle = on ? '#4ff0b0' : '#ff7a8a';
          ctx.strokeStyle = '#2a2350';
          ctx.lineWidth = Math.max(1, s * 0.05);
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, s * 0.16, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#c9c3e8';
          ctx.beginPath();
          ctx.roundRect(px + s * 0.16, py + s * 0.74, s * 0.68, s * 0.26, s * 0.08);
          ctx.fill();
          ctx.stroke();
        } else if (k === Cell.Spring) {
          const j = lv.springs.findIndex((p) => p.x === x && p.y === y);
          const since = time - (this.springAt[j] ?? -9);
          const squeeze = since < 0.25 ? Math.sin((since / 0.25) * Math.PI) * 0.18 : 0;
          const top = py + s * (0.6 - squeeze);
          ctx.strokeStyle = '#ffd84a';
          ctx.lineWidth = Math.max(1.5, s * 0.06);
          ctx.beginPath();
          for (let t = 0; t <= 4; t++) ctx.lineTo(px + s * (t % 2 ? 0.72 : 0.28), top + ((py + s - top) * t) / 4);
          ctx.stroke();
          ctx.fillStyle = '#ff6f91';
          ctx.strokeStyle = '#a3345a';
          ctx.lineWidth = Math.max(1, s * 0.04);
          ctx.beginPath();
          ctx.roundRect(px + s * 0.1, top - s * 0.08, s * 0.8, s * 0.14, s * 0.07);
          ctx.fill();
          ctx.stroke();
        }
      }
    // the prism door: brighter while the pals gather in it
    const glow = Math.min(1, w.hold / EXIT_HOLD);
    for (const d of doors(lv)) {
      const x0 = X(d.x) + s * 0.05;
      const ww = d.w * s - s * 0.1;
      const y1 = Y(d.y + 1);
      const hh = s * 1.9;
      const rg = ctx.createLinearGradient(x0, 0, x0 + ww, 0);
      rg.addColorStop(0, PALS[0].color);
      rg.addColorStop(0.33, PALS[3].color);
      rg.addColorStop(0.66, PALS[1].color);
      rg.addColorStop(1, PALS[2].color);
      ctx.fillStyle = `rgba(255,255,255,${0.12 + glow * 0.35 + Math.sin(time * 2) * 0.04 * bob})`;
      ctx.beginPath();
      const arch = Math.min(ww / 2, s * 0.85);
      ctx.roundRect(x0, y1 - hh, ww, hh, [arch, arch, 0, 0]);
      ctx.fill();
      ctx.strokeStyle = rg;
      ctx.lineWidth = Math.max(2, s * 0.12);
      ctx.stroke();
      ctx.fillStyle = rg;
      ctx.globalAlpha = 0.25 + glow * 0.5;
      ctx.beginPath();
      ctx.roundRect(x0 + s * 0.15, y1 - hh + s * 0.15, ww - s * 0.3, hh - s * 0.15, [arch - s * 0.15, arch - s * 0.15, 0, 0]);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // lifts
    lv.platforms.forEach((p) => {
      const at = platformAt(p, w.t, STEP);
      const px = X(at.x);
      const py = Y(at.y);
      ctx.fillStyle = '#e9e4ff';
      ctx.strokeStyle = '#6a5fb8';
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath();
      ctx.roundRect(px + s * 0.02, py, p.w * s - s * 0.04, s * 0.3, s * 0.12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#8f80e8';
      for (let t = 0; t < p.w; t++) {
        const cx = px + (t + 0.5) * s;
        ctx.beginPath();
        if (p.axis === 'h') {
          ctx.moveTo(cx - s * 0.12, py + s * 0.08);
          ctx.lineTo(cx + s * 0.02, py + s * 0.15);
          ctx.lineTo(cx - s * 0.12, py + s * 0.22);
          ctx.moveTo(cx + s * 0.02, py + s * 0.08);
          ctx.lineTo(cx + s * 0.16, py + s * 0.15);
          ctx.lineTo(cx + s * 0.02, py + s * 0.22);
        } else {
          ctx.moveTo(cx - s * 0.1, py + s * 0.2);
          ctx.lineTo(cx, py + s * 0.08);
          ctx.lineTo(cx + s * 0.1, py + s * 0.2);
        }
        ctx.fill();
      }
    });
    // crates
    for (const k of w.crates) {
      if (k.gone) continue;
      const px = X(k.x);
      const py = Y(k.y);
      ctx.fillStyle = '#c98a4b';
      ctx.strokeStyle = '#7a4a22';
      ctx.lineWidth = Math.max(1, s * 0.06);
      ctx.beginPath();
      ctx.roundRect(px + s * 0.03, py + s * 0.03, s * 0.94, s * 0.94, s * 0.1);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#9a6332';
      ctx.beginPath();
      ctx.moveTo(px + s * 0.18, py + s * 0.18);
      ctx.lineTo(px + s * 0.82, py + s * 0.82);
      ctx.moveTo(px + s * 0.82, py + s * 0.18);
      ctx.lineTo(px + s * 0.18, py + s * 0.82);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(px + s * 0.12, py + s * 0.1, s * 0.76, s * 0.08);
    }
    // gems
    lv.gems.forEach((g, i) => {
      if (w.gems[i]) return;
      const y = Y(g.y + 0.5) + Math.sin(time * 2.4 + i) * s * 0.06 * bob;
      drawGem(ctx, g.color, X(g.x + 0.5), y, s, Math.max(0, Math.sin(time * 3 + i * 1.7)) * 0.9 * bob);
    });
    // pals
    while (this.looks.length < w.cr.length) this.looks.push({ walk: 0, squash: 0, blinkAt: 1 + Math.random() * 3 });
    w.cr.forEach((c, i) => {
      if (c.dead) return;
      const look = this.looks[i]!;
      if (c.ground) look.walk += Math.abs(c.vx) * dt * 3.2;
      if (Math.abs(c.vx) < 0.3) look.walk *= 0.8;
      look.squash = Math.max(0, look.squash - dt * 6);
      const blink = time > look.blinkAt;
      if (time > look.blinkAt + 0.12) look.blinkAt = time + 2 + Math.random() * 3;
      const stretch = c.ground ? 1 - look.squash * 0.18 * bob : 1 + Math.max(-0.1, Math.min(0.14, -c.vy / 90)) * bob;
      const cx = X(c.x + CW / 2);
      const by = Y(c.y + CH);
      drawPal(ctx, c.color, cx, by, s, { face: c.face, walk: look.walk, stretch, blink, lean: c.push > 0 ? 1 : 0 });
      if (i === active && mine[i]) {
        const ay = by - s * 1.35 - Math.abs(Math.sin(time * 4)) * s * 0.08 * bob;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = PALS[c.color].dark;
        ctx.lineWidth = Math.max(1, s * 0.04);
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.13, ay);
        ctx.lineTo(cx + s * 0.13, ay);
        ctx.lineTo(cx, ay + s * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      const label = labels?.[i];
      if (label && !mine[i]) {
        ctx.font = `700 ${Math.max(9, Math.round(s * 0.3))}px system-ui, sans-serif`;
        const tw = ctx.measureText(label).width;
        const ly = by - s * 1.3;
        ctx.fillStyle = 'rgba(20,12,48,0.7)';
        ctx.beginPath();
        ctx.roundRect(cx - tw / 2 - 5, ly - s * 0.22, tw + 10, s * 0.36, s * 0.18);
        ctx.fill();
        ctx.fillStyle = PALS[c.color].light;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, ly - s * 0.04);
      }
    });
    // sparkles and puffs
    for (const b of this.bits) {
      b.life += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 9 * dt;
      const a = 1 - b.life / b.max;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = b.color;
      const r = b.size * s * (b.star ? 1.2 : 1);
      if (b.star) {
        emblem(ctx, 3, X(b.x), Y(b.y), r);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(X(b.x), Y(b.y), r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    this.bits = this.bits.filter((b) => b.life < b.max);
  }
}
