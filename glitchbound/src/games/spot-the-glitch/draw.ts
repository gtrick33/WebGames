/**
 * Canvas drawing for Spot the Glitch pictures: a painterly, naturally lit style (soft shading, thin
 * tonal edges, contact shadows, atmospheric backgrounds, film grain). Rendering only; what is drawn
 * comes from scene.ts / diffs.ts.
 */
import { H, RADIUS, W, rng, type Obj, type Scene } from './scene';

const INK = '#2e2d35';
type C = CanvasRenderingContext2D;

/** Mixes a hex colour towards white (amt > 0) or black (amt < 0). */
function tint(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)));
  return `rgb(${ch[0]} ${ch[1]} ${ch[2]})`;
}

/** Fills a path with soft top light and a darker underside, edged in a deeper shade of its own colour. */
function shape(ctx: C, fill: string, path: () => void, line = 1.2): void {
  ctx.beginPath();
  path();
  if (fill === 'transparent') {
    ctx.lineWidth = line + 0.6;
    ctx.strokeStyle = 'rgba(40,40,50,0.55)';
    ctx.stroke();
    return;
  }
  const g = ctx.createLinearGradient(0, -24, 0, 24);
  g.addColorStop(0, tint(fill, 0.22));
  g.addColorStop(0.55, fill);
  g.addColorStop(1, tint(fill, -0.22));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = line * 0.8;
  ctx.strokeStyle = tint(fill === '#f6f3ec' ? '#9a9aa6' : fill, -0.42);
  ctx.stroke();
}

/** Soft contact shadow under things that stand on the ground. */
function groundShadow(ctx: C, o: Obj): void {
  const r = RADIUS[o.kind] * o.s;
  const g = ctx.createRadialGradient(o.x + r * 0.15, o.y + r * 0.85, 1, o.x + r * 0.15, o.y + r * 0.85, r * 1.1);
  g.addColorStop(0, 'rgba(20,25,30,0.32)');
  g.addColorStop(1, 'rgba(20,25,30,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(o.x + r * 0.15, o.y + r * 0.85, r * 1.1, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}

const GROUNDED = new Set(['tree', 'pine', 'house', 'car', 'lamp', 'sign', 'snowman', 'present', 'mushroom', 'coral', 'shell', 'starfish', 'building']);

const circle = (ctx: C, x: number, y: number, r: number) => () => ctx.arc(x, y, r, 0, Math.PI * 2);
const ellipse = (ctx: C, x: number, y: number, rx: number, ry: number) => () => ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
const rect = (ctx: C, x: number, y: number, w: number, h: number, r = 3) => () => ctx.roundRect(x, y, w, h, r);

/* ------------------------------------------------------------ backgrounds */

function strokes(ctx: C, seed: number, n: number, y0: number, y1: number, colors: string[], len: [number, number], alpha: number): void {
  const r = rng(seed);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = y0 + r() * (y1 - y0);
    const l = len[0] + r() * (len[1] - len[0]);
    ctx.strokeStyle = colors[Math.floor(r() * colors.length)]!;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 3, y - l);
    ctx.stroke();
  }
  ctx.restore();
}

function ridge(ctx: C, seed: number, base: number, amp: number, color: string | CanvasGradient, jag: number): void {
  const r = rng(seed);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, H);
  let y = base;
  for (let x = 0; x <= W; x += jag) {
    y = Math.max(base - amp, Math.min(base + amp * 0.3, y + (r() - 0.5) * amp * 0.9));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.fill();
}

function background(ctx: C, s: Scene): void {
  // Same for both pictures of a puzzle (theme and variant only), so texture never becomes a false difference.
  const seed = s.bg * 31 + s.theme.length * 977 + s.theme.charCodeAt(0);
  const lin = (y0: number, y1: number, stops: [number, string][]): CanvasGradient => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  };
  switch (s.theme) {
    case 'meadow': {
      const skies: [string, string][] = [
        ['#6fa8d6', '#dfeaf1'],
        ['#e6a37e', '#f4dcc0'],
        ['#7fb0cf', '#e9eef0'],
      ];
      ctx.fillStyle = lin(0, 200, [
        [0, skies[s.bg]![0]],
        [1, skies[s.bg]![1]],
      ]);
      ctx.fillRect(0, 0, W, H);
      ridge(ctx, seed, 140, 34, 'rgba(120,140,160,0.45)', 14);
      ridge(ctx, seed + 1, 160, 18, lin(120, 220, [
        [0, '#86a86a'],
        [1, '#6c8f52'],
      ]), 22);
      ctx.fillStyle = lin(190, 300, [
        [0, '#7ea35a'],
        [1, '#557a3a'],
      ]);
      ctx.beginPath();
      ctx.moveTo(0, 212);
      ctx.bezierCurveTo(120, 192, 260, 226, 400, 204);
      ctx.lineTo(400, 300);
      ctx.lineTo(0, 300);
      ctx.fill();
      strokes(ctx, seed + 2, 900, 215, 300, ['#4a6e33', '#90b46a', '#3b5a2a'], [3, 7], 0.55);
      break;
    }
    case 'reef': {
      ctx.fillStyle = lin(0, 300, [
        [0, '#3f8fb0'],
        [0.6, '#1f5f80'],
        [1, '#163f5c'],
      ]);
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = '#e8f6ff';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(30 + i * 85, 0);
        ctx.lineTo(70 + i * 85, 0);
        ctx.lineTo(10 + i * 85, 260);
        ctx.lineTo(-20 + i * 85, 260);
        ctx.fill();
      }
      ctx.restore();
      // Caustic shimmer.
      const r = rng(seed);
      ctx.strokeStyle = 'rgba(220,245,255,0.12)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 40; i++) {
        const x = r() * W;
        const y = r() * 120;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 10, y + 6, x + 22, y + 1);
        ctx.stroke();
      }
      ctx.fillStyle = lin(240, 300, [
        [0, '#c9b48a'],
        [1, '#a8925f'],
      ]);
      ctx.beginPath();
      ctx.moveTo(0, 255);
      ctx.bezierCurveTo(130, 240, 270, 268, 400, 250);
      ctx.lineTo(400, 300);
      ctx.lineTo(0, 300);
      ctx.fill();
      strokes(ctx, seed + 3, 220, 258, 300, ['#8f7a4e', '#ddc99d'], [1, 3], 0.5);
      break;
    }
    case 'street': {
      const skies: [string, string][] = [
        ['#8fb4d4', '#e3e9ec'],
        ['#d7a787', '#efe2d2'],
        ['#a7bccb', '#e6eaec'],
      ];
      ctx.fillStyle = lin(0, 200, [
        [0, skies[s.bg]![0]],
        [1, skies[s.bg]![1]],
      ]);
      ctx.fillRect(0, 0, W, H);
      // Distant skyline in haze.
      const r = rng(seed);
      ctx.fillStyle = 'rgba(130,140,155,0.45)';
      for (let x = 0; x < W; x += 26 + r() * 20) ctx.fillRect(x, 150 - r() * 60, 22 + r() * 16, 80);
      ctx.fillStyle = '#c9c3b8';
      ctx.fillRect(0, 205, W, 35);
      ctx.strokeStyle = 'rgba(90,85,80,0.25)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 22) {
        ctx.beginPath();
        ctx.moveTo(x, 205);
        ctx.lineTo(x, 240);
        ctx.stroke();
      }
      ctx.fillStyle = lin(240, 300, [
        [0, '#55545b'],
        [1, '#3f3e44'],
      ]);
      ctx.fillRect(0, 240, W, 60);
      strokes(ctx, seed + 4, 400, 242, 300, ['#6b6a72', '#2f2e34'], [1, 2], 0.6);
      ctx.fillStyle = 'rgba(235,225,180,0.75)';
      for (let x = 10; x < W; x += 50) ctx.fillRect(x, 268, 26, 3);
      break;
    }
    case 'space': {
      ctx.fillStyle = lin(0, 300, [
        [0, ['#141a3a', '#1d1433', '#0f2238'][s.bg]!],
        [1, '#06070f'],
      ]);
      ctx.fillRect(0, 0, W, H);
      for (const [x, y, rad, col] of [
        [90, 80, 140, 'rgba(120,80,170,0.28)'],
        [320, 200, 160, 'rgba(60,110,170,0.25)'],
      ] as const) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      const r = rng(seed);
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.7})`;
        const sz = r() < 0.92 ? 0.8 : 1.6;
        ctx.fillRect(r() * W, r() * H, sz, sz);
      }
      break;
    }
    case 'snow': {
      ctx.fillStyle = lin(0, 200, [
        [0, ['#9fb8cf', '#b4b6cc', '#a6c2d4'][s.bg]!],
        [1, '#eef2f5'],
      ]);
      ctx.fillRect(0, 0, W, H);
      ridge(ctx, seed, 150, 50, 'rgba(200,212,226,0.9)', 18);
      ctx.fillStyle = lin(180, 300, [
        [0, '#f7f9fb'],
        [1, '#d8e3ec'],
      ]);
      ctx.beginPath();
      ctx.moveTo(0, 185);
      ctx.bezierCurveTo(110, 150, 250, 205, 400, 165);
      ctx.lineTo(400, 300);
      ctx.lineTo(0, 300);
      ctx.fill();
      strokes(ctx, seed + 5, 120, 190, 300, ['#c3d3e0'], [1, 2], 0.5);
      break;
    }
  }
}

/** Photo finish: a touch of warmth, grain and a vignette. */
function finish(ctx: C, seed: number): void {
  const r = rng(seed);
  ctx.save();
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = r() < 0.5 ? '#000' : '#fff';
    ctx.fillRect(r() * W, r() * H, 1, 1);
  }
  ctx.restore();
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

/* ---------------------------------------------------------------- objects */

function drawObj(ctx: C, o: Obj): void {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(o.flip ? -o.s : o.s, o.s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const { c, c2, v } = o;
  switch (o.kind) {
    case 'sun':
      ctx.strokeStyle = '#ffb020';
      ctx.lineWidth = 3;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
        ctx.lineTo(Math.cos(a) * 28, Math.sin(a) * 28);
        ctx.stroke();
      }
      shape(ctx, c, circle(ctx, 0, 0, 16));
      break;
    case 'cloud': {
      // Soft, edgeless puffs lit from above.
      const g = ctx.createLinearGradient(0, -20, 0, 12);
      g.addColorStop(0, tint(c, 0.5));
      g.addColorStop(1, tint(c, -0.12));
      ctx.fillStyle = g;
      for (const [x, y, r] of [
        [-16, 2, 10],
        [-2, -5, 14],
        [15, 1, 10],
        [4, 4, 11],
        [-8, 5, 9],
      ] as const) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'tree':
      shape(ctx, '#8b5a3c', rect(ctx, -4, 0, 8, 28, 2));
      if (v === 0) shape(ctx, c, circle(ctx, 0, -6, 20));
      else {
        shape(ctx, c, circle(ctx, -9, -2, 13));
        shape(ctx, c, circle(ctx, 9, -2, 13));
        shape(ctx, c, circle(ctx, 0, -14, 14));
      }
      break;
    case 'pine':
      shape(ctx, '#8b5a3c', rect(ctx, -4, 14, 8, 12, 2));
      shape(ctx, c, () => {
        ctx.moveTo(0, -30);
        ctx.lineTo(18, 0);
        ctx.lineTo(8, 0);
        ctx.lineTo(22, 16);
        ctx.lineTo(-22, 16);
        ctx.lineTo(-8, 0);
        ctx.lineTo(-18, 0);
        ctx.closePath();
      });
      ctx.fillStyle = '#f6f3ec';
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(7, -17);
      ctx.lineTo(-7, -17);
      ctx.fill();
      break;
    case 'house': {
      shape(ctx, c, rect(ctx, -24, -14, 48, 36, 2));
      shape(ctx, '#b5573f', () => {
        ctx.moveTo(-30, -12);
        ctx.lineTo(0, -36);
        ctx.lineTo(30, -12);
        ctx.closePath();
      });
      shape(ctx, '#8b5a3c', rect(ctx, 12, -38, 8, 14, 1));
      const doorX = v % 2 === 0 ? -6 : -18;
      shape(ctx, c2, rect(ctx, doorX, 2, 12, 20, 2));
      shape(ctx, '#cfe0ea', rect(ctx, v % 2 === 0 ? 10 : 4, -6, 10, 10, 1));
      if (v >= 2) shape(ctx, '#cfe0ea', rect(ctx, -20, -6, 10, 10, 1));
      break;
    }
    case 'flower': {
      ctx.strokeStyle = '#3e7a4f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 14);
      ctx.stroke();
      const petals = [5, 6, 4][v % 3]!;
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2;
        shape(ctx, c, circle(ctx, Math.cos(a) * 6, Math.sin(a) * 6 - 2, 4.5), 1.6);
      }
      shape(ctx, '#e3c04d', circle(ctx, 0, -2, 3.5), 1.6);
      break;
    }
    case 'bird':
      shape(ctx, c, ellipse(ctx, 0, 0, 10, 7));
      shape(ctx, '#e0913d', () => {
        ctx.moveTo(9, -2);
        ctx.lineTo(15, 0);
        ctx.lineTo(9, 2);
        ctx.closePath();
      }, 1.4);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(5, -2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      shape(ctx, c, () => {
        ctx.moveTo(-4, -2);
        ctx.quadraticCurveTo(-6, -12, 2, -10);
        ctx.closePath();
      }, 1.6);
      break;
    case 'balloon':
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.quadraticCurveTo(4, 22, 0, 30);
      ctx.stroke();
      shape(ctx, c, ellipse(ctx, 0, 0, 11, 13));
      if (v === 1) shape(ctx, c2, ellipse(ctx, 0, 0, 4, 13), 1.4);
      break;
    case 'kite':
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, 16);
      ctx.bezierCurveTo(8, 26, -6, 34, 4, 44);
      ctx.stroke();
      shape(ctx, c, () => {
        ctx.moveTo(0, -16);
        ctx.lineTo(11, 0);
        ctx.lineTo(0, 16);
        ctx.lineTo(-11, 0);
        ctx.closePath();
      });
      if (v >= 1) shape(ctx, c2, () => {
        ctx.moveTo(0, -16);
        ctx.lineTo(11, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
      }, 1.4);
      if (v === 2) shape(ctx, c2, () => {
        ctx.moveTo(0, 16);
        ctx.lineTo(-11, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
      }, 1.4);
      break;
    case 'mushroom':
      shape(ctx, '#efe6d6', rect(ctx, -4, 0, 8, 10, 2), 1.8);
      shape(ctx, c, () => {
        ctx.moveTo(-11, 1);
        ctx.quadraticCurveTo(-11, -11, 0, -11);
        ctx.quadraticCurveTo(11, -11, 11, 1);
        ctx.closePath();
      }, 1.8);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < [2, 3, 1][v % 3]!; i++) {
        ctx.beginPath();
        ctx.arc(-5 + i * 5, -5 + (i % 2) * 2, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'fish': {
      shape(ctx, c, () => {
        ctx.moveTo(-10, 0);
        ctx.lineTo(-20, -9);
        ctx.lineTo(-20, 9);
        ctx.closePath();
      });
      shape(ctx, c, ellipse(ctx, 0, 0, 14, 9));
      ctx.strokeStyle = c2 === c ? '#fff' : c2;
      ctx.lineWidth = 2.5;
      for (let i = 0; i < [1, 2, 0][v % 3]!; i++) {
        ctx.beginPath();
        ctx.moveTo(-3 + i * 5, -7);
        ctx.lineTo(-3 + i * 5, 7);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(7, -2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(8, -2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'coral':
      ctx.strokeStyle = c;
      ctx.lineWidth = 7;
      for (const [x, h] of [
        [-12, 20],
        [0, 30],
        [12, 22],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.quadraticCurveTo(x, 4, x, 14 - h);
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      for (const x of [-12, 0, 12]) {
        ctx.beginPath();
        ctx.arc(x, 14 - (x === 0 ? 30 : x < 0 ? 20 : 22), 3.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case 'shell':
      shape(ctx, c, () => {
        ctx.moveTo(-10, 5);
        ctx.quadraticCurveTo(-10, -9, 0, -9);
        ctx.quadraticCurveTo(10, -9, 10, 5);
        ctx.closePath();
      }, 1.8);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      for (let i = -1; i <= 1; i++) {
        if (v === 1 && i === 0) continue;
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.lineTo(i * 6, -7);
        ctx.stroke();
      }
      break;
    case 'starfish':
      shape(ctx, c, () => {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 ? 4.5 : 11;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
      }, 1.8);
      break;
    case 'weed':
      ctx.strokeStyle = c;
      ctx.lineWidth = 5;
      for (const dx of [-5, 3]) {
        ctx.beginPath();
        ctx.moveTo(dx, 18);
        ctx.bezierCurveTo(dx - 8, 6, dx + 8, -6, dx, -20);
        ctx.stroke();
      }
      break;
    case 'bubbles':
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 2;
      for (const [x, y, r] of [
        [0, 6, 5],
        [5, -3, 3.5],
        [-2, -10, 2.5],
      ] as const) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case 'building': {
      const h = 70 + ((o.id * 37) % 40);
      shape(ctx, c, rect(ctx, -26, 26 - h, 52, h, 2));
      const lit = [0, 1, 2, 3].map((k) => (v + k) % 4);
      let n = 0;
      for (let y = 34 - h; y < 16; y += 16) {
        for (let x = -18; x < 18; x += 14) {
          shape(ctx, lit[n % 4] === 0 ? '#e3c04d' : '#d8e6ee', rect(ctx, x, y, 8, 9, 1), 1.4);
          n++;
        }
      }
      break;
    }
    case 'car': {
      shape(ctx, c, () => {
        ctx.moveTo(-22, 6);
        ctx.lineTo(-22, -4);
        ctx.lineTo(-12, -6);
        ctx.lineTo(-6, -14);
        ctx.lineTo(10, -14);
        ctx.lineTo(16, -5);
        ctx.lineTo(22, -3);
        ctx.lineTo(22, 6);
        ctx.closePath();
      });
      shape(ctx, '#d8e6ee', rect(ctx, -4, -12, 12, 7, 1), 1.4);
      if (v >= 1) shape(ctx, c2, rect(ctx, -20, -1, 40, 3, 1), 1);
      if (v === 2) shape(ctx, '#e3c04d', circle(ctx, 20, 0, 2.5), 1);
      shape(ctx, '#2b2a30', circle(ctx, -12, 7, 5));
      shape(ctx, '#2b2a30', circle(ctx, 12, 7, 5));
      break;
    }
    case 'lamp':
      shape(ctx, c, rect(ctx, -2.5, -26, 5, 48, 2), 1.6);
      shape(ctx, c, () => {
        ctx.moveTo(0, -26);
        ctx.quadraticCurveTo(12, -30, 14, -22);
      }, 1.6);
      shape(ctx, '#e3c04d', circle(ctx, 14, -19, 4), 1.4);
      break;
    case 'sign':
      shape(ctx, '#77757f', rect(ctx, -2, -4, 4, 26, 1), 1.4);
      shape(ctx, c, () => {
        ctx.moveTo(-14, -16);
        ctx.lineTo(8, -16);
        ctx.lineTo(16, -9);
        ctx.lineTo(8, -2);
        ctx.lineTo(-14, -2);
        ctx.closePath();
      }, 1.8);
      break;
    case 'planet':
      shape(ctx, c, circle(ctx, 0, 0, 18));
      if (v === 0 || v === 2) {
        ctx.save();
        ctx.rotate(-0.35);
        shape(ctx, 'transparent', ellipse(ctx, 0, 0, 28, 6), 2.4);
        ctx.restore();
      }
      if (v >= 1) {
        shape(ctx, c2, circle(ctx, -6, -5, 4), 1.4);
        shape(ctx, c2, circle(ctx, 6, 6, 2.5), 1.2);
      }
      break;
    case 'rocket':
      shape(ctx, '#d1544f', () => {
        ctx.moveTo(-8, 10);
        ctx.lineTo(-14, 20);
        ctx.lineTo(-6, 18);
        ctx.closePath();
      }, 1.6);
      shape(ctx, c, () => {
        ctx.moveTo(0, -24);
        ctx.quadraticCurveTo(10, -10, 8, 18);
        ctx.lineTo(-8, 18);
        ctx.quadraticCurveTo(-10, -10, 0, -24);
        ctx.closePath();
      });
      shape(ctx, '#4a72b0', circle(ctx, 0, -6, 4.5), 1.6);
      shape(ctx, '#e0913d', () => {
        ctx.moveTo(-5, 18);
        ctx.lineTo(0, 28);
        ctx.lineTo(5, 18);
        ctx.closePath();
      }, 1.4);
      break;
    case 'star':
      shape(ctx, c, () => {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 ? 3.6 : 8.5;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
      }, 1.5);
      break;
    case 'ufo':
      shape(ctx, '#cfe0ea', ellipse(ctx, 0, -6, 9, 8), 1.8);
      shape(ctx, c, ellipse(ctx, 0, 2, 20, 7));
      ctx.fillStyle = '#e3c04d';
      for (let i = 0; i < [3, 4, 2][v % 3]!; i++) {
        ctx.beginPath();
        ctx.arc(-10 + (i * 20) / Math.max(1, [3, 4, 2][v % 3]! - 1), 3, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'snowman':
      shape(ctx, '#f6f3ec', circle(ctx, 0, 10, 13));
      shape(ctx, '#f6f3ec', circle(ctx, 0, -10, 9));
      shape(ctx, c, rect(ctx, -9, -4, 18, 4, 2), 1.4);
      shape(ctx, '#e0913d', () => {
        ctx.moveTo(2, -10);
        ctx.lineTo(10, -9);
        ctx.lineTo(2, -8);
        ctx.closePath();
      }, 1);
      if (v === 1) shape(ctx, INK, rect(ctx, -7, -24, 14, 6, 1), 1);
      if (v === 2) shape(ctx, c, circle(ctx, 0, -20, 4), 1.2);
      ctx.fillStyle = INK;
      for (const y of [6, 12]) {
        ctx.beginPath();
        ctx.arc(0, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'present':
      shape(ctx, c, rect(ctx, -11, -8, 22, 18, 2));
      ctx.fillStyle = c2 === c ? '#fff' : c2;
      if (v !== 1) ctx.fillRect(-2, -8, 4, 18);
      if (v !== 2) ctx.fillRect(-11, -1, 22, 4);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = INK;
      ctx.strokeRect(-11, -8, 22, 18);
      shape(ctx, c2 === c ? '#fff' : c2, ellipse(ctx, -4, -11, 4, 3), 1.2);
      shape(ctx, c2 === c ? '#fff' : c2, ellipse(ctx, 4, -11, 4, 3), 1.2);
      break;
  }
  ctx.restore();
}

/** Draws a whole picture into a canvas sized `px` wide (scaled for the device pixel ratio). */
export function drawScene(canvas: HTMLCanvasElement, scene: Scene, cssWidth: number): void {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const w = Math.round(cssWidth * dpr);
  const h = Math.round((cssWidth * H * dpr) / W);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(w / W, 0, 0, h / H, 0, 0);
  ctx.clearRect(0, 0, W, H);
  background(ctx, scene);
  for (const o of scene.objects) {
    if (GROUNDED.has(o.kind) && scene.theme !== 'space') groundShadow(ctx, o);
    drawObj(ctx, o);
  }
  finish(ctx, scene.bg * 131 + scene.theme.charCodeAt(1));
}
