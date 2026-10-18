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

const GROUNDED = new Set([
  'tree',
  'pine',
  'house',
  'car',
  'lamp',
  'sign',
  'snowman',
  'present',
  'mushroom',
  'coral',
  'shell',
  'starfish',
  'building',
  'umbrella',
  'sandcastle',
  'bucket',
  'crab',
  'beachball',
  'barn',
  'tractor',
  'cow',
  'sheep',
  'chicken',
  'hay',
  'fence',
  'pumpkin',
  'jar',
  'mug',
  'plant',
  'teapot',
  'pot',
  'apple',
  'bread',
  'cat',
  'palm',
  'frog',
  'tent',
  'campfire',
  'lantern',
  'log',
  'cake',
  'partyhat',
  'owl',
]);

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
    case 'beach': {
      ctx.fillStyle = lin(0, 150, [
        [0, ['#6fb4e0', '#f0a77e', '#86c3e3'][s.bg]!],
        [1, ['#e2f1f8', '#f8dcc0', '#e8f4f8'][s.bg]!],
      ]);
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = lin(150, 205, [
        [0, '#3d8fb8'],
        [1, '#5fb3c8'],
      ]);
      ctx.fillRect(0, 150, W, 56);
      const r = rng(seed);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 26; i++) {
        const x = r() * W;
        const y = 156 + r() * 44;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 7, y - 3, x + 14, y);
        ctx.stroke();
      }
      // Wet sand and foam where the waves reach.
      ctx.fillStyle = '#f4efe2';
      ctx.beginPath();
      ctx.moveTo(0, 204);
      for (let x = 0; x <= W; x += 20) ctx.quadraticCurveTo(x + 10, 200 + (x % 40 === 0 ? 3 : -2), x + 20, 205);
      ctx.lineTo(W, 214);
      ctx.lineTo(0, 214);
      ctx.fill();
      ctx.fillStyle = lin(208, 300, [
        [0, '#ecd7a8'],
        [1, '#d9bd84'],
      ]);
      ctx.fillRect(0, 210, W, 90);
      strokes(ctx, seed + 6, 260, 214, 300, ['#c9a86c', '#f5e6c4'], [1, 2], 0.55);
      break;
    }
    case 'farm': {
      ctx.fillStyle = lin(0, 170, [
        [0, ['#79b3dc', '#e8a982', '#8cbad8'][s.bg]!],
        [1, '#eef3f0'],
      ]);
      ctx.fillRect(0, 0, W, H);
      ridge(ctx, seed, 150, 26, 'rgba(118,150,120,0.55)', 16);
      ctx.fillStyle = lin(160, 300, [
        [0, '#9cc169'],
        [1, '#6f9a45'],
      ]);
      ctx.beginPath();
      ctx.moveTo(0, 168);
      ctx.bezierCurveTo(140, 152, 260, 176, 400, 160);
      ctx.lineTo(400, 300);
      ctx.lineTo(0, 300);
      ctx.fill();
      // Ploughed strip and furrows.
      ctx.fillStyle = 'rgba(140,105,70,0.35)';
      ctx.beginPath();
      ctx.moveTo(250, 300);
      ctx.lineTo(330, 175);
      ctx.lineTo(400, 175);
      ctx.lineTo(400, 300);
      ctx.fill();
      ctx.strokeStyle = 'rgba(95,70,45,0.35)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(270 + i * 22, 300);
        ctx.lineTo(338 + i * 9, 176);
        ctx.stroke();
      }
      strokes(ctx, seed + 7, 700, 180, 300, ['#5d8a3a', '#a9cc78', '#4d7530'], [2, 5], 0.5);
      break;
    }
    case 'kitchen': {
      // Wall with tiles, a shelf, and a wooden table filling the bottom of the picture.
      ctx.fillStyle = ['#f3e6cf', '#e3eef0', '#f2dfd8'][s.bg]!;
      ctx.fillRect(0, 0, W, 150);
      ctx.strokeStyle = 'rgba(120,100,80,0.12)';
      ctx.lineWidth = 1;
      for (let y = 100; y < 150; y += 12)
        for (let x = (y / 12) % 2 ? 0 : 10; x < W; x += 20) ctx.strokeRect(x, y, 20, 12);
      // Window with sky.
      ctx.fillStyle = lin(14, 70, [
        [0, '#8fc3e3'],
        [1, '#dcefff'],
      ]);
      ctx.fillRect(150, 14, 100, 46);
      ctx.strokeStyle = '#f6f3ec';
      ctx.lineWidth = 4;
      ctx.strokeRect(150, 14, 100, 46);
      ctx.beginPath();
      ctx.moveTo(200, 14);
      ctx.lineTo(200, 60);
      ctx.stroke();
      // Shelf.
      ctx.fillStyle = '#9a6a45';
      ctx.fillRect(10, 92, 380, 6);
      ctx.fillStyle = 'rgba(60,40,30,0.18)';
      ctx.fillRect(10, 98, 380, 4);
      ctx.fillStyle = lin(150, 300, [
        [0, '#c08a5a'],
        [1, '#94643e'],
      ]);
      ctx.fillRect(0, 150, W, 150);
      ctx.strokeStyle = 'rgba(80,50,30,0.25)';
      ctx.lineWidth = 1;
      for (let y = 168; y < 300; y += 26) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      strokes(ctx, seed + 8, 260, 152, 300, ['#7a5032', '#d6a273'], [4, 10], 0.25);
      break;
    }
    case 'night': {
      ctx.fillStyle = lin(0, 210, [
        [0, ['#0f1638', '#1b1236', '#0c2033'][s.bg]!],
        [1, '#33406b'],
      ]);
      ctx.fillRect(0, 0, W, H);
      const r = rng(seed);
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.5})`;
        ctx.fillRect(r() * W, r() * 150, 0.9, 0.9);
      }
      ctx.fillStyle = 'rgba(70,80,120,0.6)';
      for (let x = 0; x < W; x += 24 + r() * 20) ctx.fillRect(x, 160 - r() * 55, 22 + r() * 16, 80);
      ctx.fillStyle = '#5a5866';
      ctx.fillRect(0, 205, W, 35);
      ctx.fillStyle = lin(240, 300, [
        [0, '#2f2e38'],
        [1, '#1f1e26'],
      ]);
      ctx.fillRect(0, 240, W, 60);
      ctx.fillStyle = 'rgba(235,225,180,0.55)';
      for (let x = 10; x < W; x += 50) ctx.fillRect(x, 268, 26, 3);
      break;
    }
    case 'jungle': {
      ctx.fillStyle = lin(0, 300, [
        [0, ['#a9d8a0', '#cfe2a0', '#9fd0b8'][s.bg]!],
        [0.6, '#5d9a58'],
        [1, '#3e6e3a'],
      ]);
      ctx.fillRect(0, 0, W, H);
      const r = rng(seed);
      // Hazy layers of leaves and hanging vines.
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(${40 + r() * 40},${110 + r() * 60},${50 + r() * 30},0.35)`;
        ctx.beginPath();
        ctx.ellipse(r() * W, r() * 200, 14 + r() * 18, 6 + r() * 8, r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(50,90,40,0.6)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const x = r() * W;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 10, 50, x - 10, 90, x + 4, 120 + r() * 60);
        ctx.stroke();
      }
      ctx.fillStyle = lin(230, 300, [
        [0, '#4e7f3a'],
        [1, '#3a5e2a'],
      ]);
      ctx.beginPath();
      ctx.moveTo(0, 236);
      ctx.bezierCurveTo(130, 222, 270, 246, 400, 228);
      ctx.lineTo(400, 300);
      ctx.lineTo(0, 300);
      ctx.fill();
      strokes(ctx, seed + 9, 600, 236, 300, ['#2f5222', '#79a85a'], [3, 7], 0.5);
      break;
    }
    case 'camp': {
      ctx.fillStyle = lin(0, 200, [
        [0, ['#2c3a66', '#4a3a6b', '#25456a'][s.bg]!],
        [0.7, '#d98e6a'],
        [1, '#f2c48e'],
      ]);
      ctx.fillRect(0, 0, W, H);
      // Far pine silhouettes.
      const r = rng(seed);
      ctx.fillStyle = 'rgba(40,50,60,0.55)';
      for (let x = -10; x < W; x += 18 + r() * 14) {
        const h = 30 + r() * 30;
        ctx.beginPath();
        ctx.moveTo(x, 200);
        ctx.lineTo(x + 9, 200 - h);
        ctx.lineTo(x + 18, 200);
        ctx.fill();
      }
      ctx.fillStyle = lin(196, 300, [
        [0, '#6a7a3e'],
        [1, '#4e5a2c'],
      ]);
      ctx.fillRect(0, 196, W, 104);
      strokes(ctx, seed + 10, 500, 200, 300, ['#3d4a22', '#8a9a52', '#a0703c'], [2, 5], 0.5);
      break;
    }
    case 'harbor': {
      ctx.fillStyle = lin(0, 140, [
        [0, ['#78b0d8', '#e9a07a', '#8fb9d2'][s.bg]!],
        [1, '#eef3f5'],
      ]);
      ctx.fillRect(0, 0, W, H);
      ridge(ctx, seed, 138, 18, 'rgba(110,135,150,0.5)', 20);
      ctx.fillStyle = lin(140, 300, [
        [0, '#4a9cc0'],
        [1, '#22607e'],
      ]);
      ctx.fillRect(0, 140, W, 160);
      const r = rng(seed);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 60; i++) {
        const x = r() * W;
        const y = 146 + r() * 150;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 6, y - 3, x + 12, y);
        ctx.stroke();
      }
      // A wooden pier.
      ctx.fillStyle = '#8b5a3c';
      ctx.fillRect(s.bg === 1 ? 0 : 300, 228, 100, 8);
      for (let x = s.bg === 1 ? 6 : 306; x < (s.bg === 1 ? 100 : 400); x += 22) ctx.fillRect(x, 236, 5, 30);
      break;
    }
    case 'party': {
      ctx.fillStyle = ['#f7e4ec', '#e6eefa', '#f5f0d9'][s.bg]!;
      ctx.fillRect(0, 0, W, 210);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      for (let x = 0; x < W; x += 28) ctx.fillRect(x, 0, 12, 210);
      // Bunting across the top.
      const flags = ['#d1544f', '#e3c04d', '#4a72b0', '#8cae4f', '#d99aae', '#8a6db5'];
      ctx.strokeStyle = 'rgba(60,50,60,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.quadraticCurveTo(200, 34, 400, 12);
      ctx.stroke();
      for (let i = 0; i < 14; i++) {
        const x = 10 + i * 28;
        const t = x / 400;
        const y = 12 + 4 * t * (1 - t) * 22;
        ctx.fillStyle = flags[i % flags.length]!;
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.lineTo(x + 8, y);
        ctx.lineTo(x, y + 14);
        ctx.fill();
      }
      ctx.fillStyle = lin(206, 300, [
        [0, '#f6f3ec'],
        [1, '#e3dccd'],
      ]);
      ctx.fillRect(0, 206, W, 94);
      // Tablecloth checks.
      ctx.fillStyle = 'rgba(209,84,79,0.16)';
      for (let y = 206; y < 300; y += 18) for (let x = ((y - 206) / 18) % 2 ? 0 : 18; x < W; x += 36) ctx.fillRect(x, y, 18, 18);
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
    /* ---- beach ---- */
    case 'umbrella': {
      shape(ctx, '#d8d4cc', rect(ctx, -1.5, -14, 3, 40, 1), 1.2);
      const canopy = (): void => {
        ctx.moveTo(-26, -6);
        ctx.quadraticCurveTo(0, -36, 26, -6);
        for (let x = 26; x > -26; x -= 13) ctx.quadraticCurveTo(x - 6.5, -1, x - 13, -6);
        ctx.closePath();
      };
      shape(ctx, c, canopy);
      ctx.save();
      ctx.beginPath();
      canopy();
      ctx.clip();
      ctx.fillStyle = c2 === c ? '#f6f3ec' : c2;
      const bands = [2, 3, 4][v % 3]!;
      const step = 52 / (bands * 2);
      for (let i = 0; i < bands; i++) ctx.fillRect(-26 + step * (i * 2 + 0.5), -40, step, 40);
      ctx.restore();
      shape(ctx, '#d8d4cc', circle(ctx, 0, -21, 2), 1);
      break;
    }
    case 'towel': {
      shape(ctx, c, rect(ctx, -20, -9, 40, 18, 2), 1.2);
      ctx.fillStyle = c2 === c ? '#f6f3ec' : c2;
      const n = [1, 2, 3][v % 3]!;
      for (let i = 0; i < n; i++) ctx.fillRect(-20 + ((i + 1) * 40) / (n + 1) - 2, -9, 4, 18);
      ctx.strokeStyle = tint(c, -0.3);
      ctx.lineWidth = 0.8;
      for (let y = -8; y <= 8; y += 2.5) {
        ctx.beginPath();
        ctx.moveTo(-20, y);
        ctx.lineTo(-23, y);
        ctx.moveTo(20, y);
        ctx.lineTo(23, y);
        ctx.stroke();
      }
      break;
    }
    case 'sandcastle': {
      const sand = '#e2c58f';
      shape(ctx, sand, rect(ctx, -20, -2, 40, 18, 2));
      const towers = [[0], [-11, 11], [-13, 0, 13]][v % 3]!;
      for (const x of towers) {
        shape(ctx, sand, rect(ctx, x - 6, -16, 12, 16, 1), 1);
        ctx.fillStyle = tint(sand, -0.15);
        for (const dx of [-6, -1, 4]) ctx.fillRect(x + dx, -19, 2.5, 3);
      }
      shape(ctx, '#6b5a4a', () => {
        ctx.moveTo(-4, 16);
        ctx.lineTo(-4, 9);
        ctx.quadraticCurveTo(0, 4, 4, 9);
        ctx.lineTo(4, 16);
        ctx.closePath();
      }, 1);
      const fx = towers[towers.length - 1]!;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fx, -16);
      ctx.lineTo(fx, -28);
      ctx.stroke();
      shape(ctx, c, () => {
        ctx.moveTo(fx, -28);
        ctx.lineTo(fx + 9, -25);
        ctx.lineTo(fx, -22);
        ctx.closePath();
      }, 1);
      break;
    }
    case 'bucket':
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, -8, 8, Math.PI, 0);
      ctx.stroke();
      shape(ctx, c, () => {
        ctx.moveTo(-9, -8);
        ctx.lineTo(9, -8);
        ctx.lineTo(7, 10);
        ctx.lineTo(-7, 10);
        ctx.closePath();
      });
      shape(ctx, tint(c, 0.25), ellipse(ctx, 0, -8, 9, 2.5), 1);
      break;
    case 'crab':
      ctx.strokeStyle = tint(c, -0.35);
      ctx.lineWidth = 1.6;
      for (const sd of [-1, 1])
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(sd * 7, 3 + i * 2);
          ctx.lineTo(sd * 14, 6 + i * 3);
          ctx.stroke();
        }
      shape(ctx, c, ellipse(ctx, 0, 2, 11, 7));
      shape(ctx, c, circle(ctx, -13, -5, 4), 1.2);
      shape(ctx, c, circle(ctx, 13, -5, 4), 1.2);
      for (const x of [-4, 4]) {
        ctx.beginPath();
        ctx.moveTo(x, -3);
        ctx.lineTo(x, -8);
        ctx.stroke();
        shape(ctx, '#fff', circle(ctx, x, -9, 2), 0.8);
      }
      break;
    case 'beachball': {
      shape(ctx, '#f6f3ec', circle(ctx, 0, 0, 11));
      const cols = [c, c2 === c ? '#e3c04d' : c2, '#e3c04d', '#4a72b0'];
      const n = [3, 2, 4][v % 3]!;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - 0.6;
        ctx.fillStyle = cols[i % cols.length]!;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 10.5, a, a + Math.PI / n);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(40,40,50,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(-4, -5, 3, 2, -0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'boat': {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-26, 16);
      ctx.quadraticCurveTo(0, 20, 26, 16);
      ctx.stroke();
      ctx.strokeStyle = '#6b5a4a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(0, -28);
      ctx.stroke();
      shape(ctx, '#f6f3ec', () => {
        ctx.moveTo(2, -28);
        ctx.lineTo(18, 0);
        ctx.lineTo(2, 0);
        ctx.closePath();
      }, 1.2);
      if (v >= 1)
        shape(ctx, v === 2 ? c2 : '#f6f3ec', () => {
          ctx.moveTo(-2, -22);
          ctx.lineTo(-2, 0);
          ctx.lineTo(-14, 0);
          ctx.closePath();
        }, 1.2);
      if (v === 2) shape(ctx, c2, rect(ctx, 0, -32, 8, 4, 0.5), 0.8);
      shape(ctx, c, () => {
        ctx.moveTo(-22, 3);
        ctx.lineTo(22, 3);
        ctx.lineTo(16, 14);
        ctx.lineTo(-16, 14);
        ctx.closePath();
      });
      ctx.fillStyle = '#f6f3ec';
      ctx.fillRect(-17, 6, 34, 2);
      break;
    }
    /* ---- farm ---- */
    case 'barn': {
      shape(ctx, c, rect(ctx, -28, -12, 56, 36, 1));
      shape(ctx, '#5b4b45', () => {
        ctx.moveTo(-32, -10);
        ctx.lineTo(-22, -28);
        ctx.lineTo(0, -38);
        ctx.lineTo(22, -28);
        ctx.lineTo(32, -10);
        ctx.closePath();
      });
      shape(ctx, '#f6f3ec', rect(ctx, -10, 2, 20, 22, 1), 1.2);
      ctx.strokeStyle = '#f6f3ec';
      ctx.lineWidth = 2;
      if (v === 0) {
        ctx.beginPath();
        ctx.moveTo(-9, 3);
        ctx.lineTo(9, 23);
        ctx.moveTo(9, 3);
        ctx.lineTo(-9, 23);
        ctx.stroke();
      }
      ctx.fillStyle = tint(c, -0.35);
      ctx.fillRect(-8, 4, 16, 18);
      if (v !== 0) {
        ctx.beginPath();
        ctx.moveTo(-8, 4);
        ctx.lineTo(8, 22);
        ctx.moveTo(8, 4);
        ctx.lineTo(-8, 22);
        ctx.stroke();
      }
      shape(ctx, v === 2 ? '#e3c04d' : '#2e2d35', circle(ctx, 0, -18, 5), 1.2);
      break;
    }
    case 'tractor':
      shape(ctx, '#d8e6ee', rect(ctx, -16, -20, 14, 14, 1), 1.2);
      shape(ctx, c, rect(ctx, -18, -8, 38, 12, 2));
      shape(ctx, '#77757f', rect(ctx, 12, -18, 3, 10, 1), 1);
      shape(ctx, '#2b2a30', circle(ctx, -10, 8, 10));
      shape(ctx, '#9a9aa6', circle(ctx, -10, 8, 4), 1);
      shape(ctx, '#2b2a30', circle(ctx, 14, 11, 6));
      shape(ctx, '#9a9aa6', circle(ctx, 14, 11, 2.5), 1);
      break;
    case 'cow': {
      for (const x of [-12, -6, 7, 13]) shape(ctx, '#f6f3ec', rect(ctx, x - 1.8, 4, 3.6, 12, 1), 1);
      shape(ctx, '#f6f3ec', ellipse(ctx, 0, 0, 18, 11));
      ctx.fillStyle = c;
      const spots = [
        [-8, -3, 5, 4],
        [5, 2, 4, 3],
        [-2, 5, 3, 2.5],
        [10, -4, 3, 2.5],
      ].slice(0, [2, 3, 4][v % 3]!);
      for (const [x, y, rx, ry] of spots) {
        ctx.beginPath();
        ctx.ellipse(x!, y!, rx!, ry!, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      shape(ctx, '#f6f3ec', ellipse(ctx, 18, -6, 7, 6), 1.2);
      shape(ctx, '#e8a7a7', ellipse(ctx, 22, -3, 4, 3), 1);
      shape(ctx, '#c9b48a', () => {
        ctx.moveTo(14, -11);
        ctx.lineTo(12, -15);
        ctx.lineTo(16, -12);
      }, 1);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(17, -8, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = tint('#f6f3ec', -0.4);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-18, -2);
      ctx.quadraticCurveTo(-24, 4, -21, 10);
      ctx.stroke();
      break;
    }
    case 'sheep':
      for (const x of [-7, 6]) shape(ctx, '#3a3540', rect(ctx, x - 1.5, 4, 3, 10, 1), 1);
      for (const [x, y, r] of [
        [-8, 0, 7],
        [0, -4, 8],
        [8, 0, 7],
        [0, 4, 7],
        [-4, 2, 6],
        [5, 3, 6],
      ] as const)
        shape(ctx, c, circle(ctx, x, y, r), 1);
      shape(ctx, '#3a3540', ellipse(ctx, 14, -3, 5, 6), 1.2);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(15.5, -4, 1.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'chicken':
      ctx.strokeStyle = '#e0913d';
      ctx.lineWidth = 1.4;
      for (const x of [-2, 2]) {
        ctx.beginPath();
        ctx.moveTo(x, 6);
        ctx.lineTo(x, 11);
        ctx.stroke();
      }
      shape(ctx, c, () => {
        ctx.moveTo(-9, -2);
        ctx.lineTo(-13, -9);
        ctx.lineTo(-7, -5);
        ctx.closePath();
      }, 1);
      shape(ctx, c, ellipse(ctx, 0, 0, 9, 7));
      shape(ctx, c, circle(ctx, 7, -6, 4.5), 1);
      shape(ctx, '#d1544f', () => {
        ctx.moveTo(5, -10);
        ctx.quadraticCurveTo(7, -14, 9, -10);
      }, 1);
      shape(ctx, '#e0913d', () => {
        ctx.moveTo(11, -7);
        ctx.lineTo(14, -6);
        ctx.lineTo(11, -5);
        ctx.closePath();
      }, 0.8);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(8, -7, 0.9, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'hay':
      if (v % 2 === 0) {
        shape(ctx, c, circle(ctx, 0, 0, 15));
        ctx.strokeStyle = tint(c, -0.3);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let a = 0; a < 14; a += 0.3) ctx.lineTo(Math.cos(a) * a, Math.sin(a) * a);
        ctx.stroke();
      } else {
        shape(ctx, c, rect(ctx, -16, -10, 32, 20, 2));
        ctx.strokeStyle = '#8b5a3c';
        ctx.lineWidth = 1.4;
        for (const x of [-7, 7]) {
          ctx.beginPath();
          ctx.moveTo(x, -10);
          ctx.lineTo(x, 10);
          ctx.stroke();
        }
      }
      break;
    case 'fence': {
      const n = [4, 5, 6][v % 3]!;
      shape(ctx, c, rect(ctx, -32, -6, 64, 4, 1), 1);
      shape(ctx, c, rect(ctx, -32, 4, 64, 4, 1), 1);
      for (let i = 0; i < n; i++) {
        const x = -30 + (i * 60) / (n - 1);
        shape(ctx, c, () => {
          ctx.moveTo(x - 3, 12);
          ctx.lineTo(x - 3, -10);
          ctx.lineTo(x, -14);
          ctx.lineTo(x + 3, -10);
          ctx.lineTo(x + 3, 12);
          ctx.closePath();
        }, 1);
      }
      break;
    }
    case 'pumpkin':
      shape(ctx, '#4f8a3c', rect(ctx, -1.5, -14, 3, 6, 1), 1);
      shape(ctx, c, ellipse(ctx, -5, 0, 7, 9));
      shape(ctx, c, ellipse(ctx, 5, 0, 7, 9));
      shape(ctx, c, ellipse(ctx, 0, 0, 6, 9.5));
      if (v === 1) {
        ctx.fillStyle = '#3a2a1a';
        for (const x of [-4, 4]) {
          ctx.beginPath();
          ctx.moveTo(x - 2, -1);
          ctx.lineTo(x + 2, -1);
          ctx.lineTo(x, -4);
          ctx.fill();
        }
        ctx.fillRect(-4, 3, 8, 2);
      }
      if (v === 2)
        shape(ctx, '#8cae4f', () => {
          ctx.moveTo(1, -11);
          ctx.quadraticCurveTo(9, -15, 10, -9);
          ctx.quadraticCurveTo(5, -8, 1, -11);
        }, 1);
      break;
    /* ---- kitchen ---- */
    case 'clock': {
      shape(ctx, c, circle(ctx, 0, 0, 14));
      shape(ctx, '#f6f3ec', circle(ctx, 0, 0, 11), 1);
      ctx.strokeStyle = INK;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.lineWidth = i % 3 ? 0.6 : 1.2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9);
        ctx.lineTo(Math.cos(a) * 10.5, Math.sin(a) * 10.5);
        ctx.stroke();
      }
      const [hh, mm] = [
        [3, 0],
        [7, 30],
        [10, 10],
      ][v % 3]!;
      const ha = ((hh! % 12) / 12 + mm! / 720) * Math.PI * 2 - Math.PI / 2;
      const ma = (mm! / 60) * Math.PI * 2 - Math.PI / 2;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ha) * 5.5, Math.sin(ha) * 5.5);
      ctx.stroke();
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ma) * 8.5, Math.sin(ma) * 8.5);
      ctx.stroke();
      break;
    }
    case 'frame':
      shape(ctx, c, rect(ctx, -15, -12, 30, 24, 1));
      ctx.save();
      ctx.beginPath();
      ctx.rect(-11, -8, 22, 16);
      ctx.clip();
      if (v === 0) {
        ctx.fillStyle = '#9cc9e8';
        ctx.fillRect(-11, -8, 22, 16);
        ctx.fillStyle = '#6c8f52';
        ctx.beginPath();
        ctx.moveTo(-11, 8);
        ctx.lineTo(-3, -3);
        ctx.lineTo(3, 3);
        ctx.lineTo(7, -1);
        ctx.lineTo(11, 8);
        ctx.fill();
      } else if (v === 1) {
        ctx.fillStyle = '#f2c48e';
        ctx.fillRect(-11, -8, 22, 16);
        ctx.fillStyle = '#4a9cc0';
        ctx.fillRect(-11, 2, 22, 6);
        ctx.fillStyle = '#e0913d';
        ctx.beginPath();
        ctx.arc(0, 2, 5, Math.PI, 0);
        ctx.fill();
      } else {
        ctx.fillStyle = '#f6f3ec';
        ctx.fillRect(-11, -8, 22, 16);
        ctx.fillStyle = c2 === c ? '#d1544f' : c2;
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.bezierCurveTo(-9, -1, -4, -8, 0, -3);
        ctx.bezierCurveTo(4, -8, 9, -1, 0, 5);
        ctx.fill();
      }
      ctx.restore();
      break;
    case 'jar':
      shape(ctx, 'rgba(216,230,238,0.9)' as string, rect(ctx, -8, -9, 16, 19, 4), 1);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(-7, -2, 14, 11, 3);
      ctx.fill();
      shape(ctx, c2 === c ? '#9a9aa6' : c2, rect(ctx, -8.5, -13, 17, 5, 1.5), 1);
      if (v >= 1) {
        shape(ctx, '#f6f3ec', rect(ctx, -6, 0, 12, 6, 1), 0.8);
        if (v === 2) {
          ctx.fillStyle = c2 === c ? '#d1544f' : c2;
          ctx.fillRect(-6, 2, 12, 1.5);
        }
      }
      break;
    case 'mug':
      ctx.strokeStyle = tint(c, -0.35);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(8, 0, 4.5, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      shape(ctx, c, rect(ctx, -8, -8, 15, 17, 2));
      if (v === 1) {
        ctx.fillStyle = c2 === c ? '#f6f3ec' : c2;
        ctx.fillRect(-8, -2, 15, 3);
      }
      if (v === 2) shape(ctx, c2 === c ? '#f6f3ec' : c2, circle(ctx, -0.5, 1, 3), 0.8);
      shape(ctx, '#5a3a2a', ellipse(ctx, -0.5, -8, 6.5, 1.6), 0.6);
      break;
    case 'plant': {
      const leaves = [3, 5, 4][v % 3]!;
      for (let i = 0; i < leaves; i++) {
        const a = -Math.PI / 2 + (i - (leaves - 1) / 2) * 0.5;
        ctx.save();
        ctx.translate(0, -2);
        ctx.rotate(a + Math.PI / 2);
        shape(ctx, '#4f8a3c', ellipse(ctx, 0, -10, 4, 10), 1);
        ctx.restore();
      }
      if (v === 2) shape(ctx, c2 === c ? '#d99aae' : c2, circle(ctx, 0, -18, 4), 1);
      shape(ctx, c, () => {
        ctx.moveTo(-10, -2);
        ctx.lineTo(10, -2);
        ctx.lineTo(7, 14);
        ctx.lineTo(-7, 14);
        ctx.closePath();
      });
      break;
    }
    case 'teapot':
      ctx.strokeStyle = tint(c, -0.35);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(13, 0, 6, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      shape(ctx, c, () => {
        ctx.moveTo(-10, 2);
        ctx.quadraticCurveTo(-18, -4, -21, -10);
        ctx.lineTo(-17, -10);
        ctx.quadraticCurveTo(-14, -3, -9, -2);
        ctx.closePath();
      }, 1.2);
      shape(ctx, c, ellipse(ctx, 0, 2, 13, 11));
      shape(ctx, c2 === c ? tint(c, 0.25) : c2, ellipse(ctx, 0, -9, 7, 2.5), 1);
      shape(ctx, c2 === c ? tint(c, 0.25) : c2, circle(ctx, 0, -12, 2.2), 1);
      break;
    case 'pot':
      shape(ctx, '#77757f', rect(ctx, -19, -3, 6, 3, 1), 1);
      shape(ctx, '#77757f', rect(ctx, 13, -3, 6, 3, 1), 1);
      shape(ctx, c, rect(ctx, -14, -6, 28, 18, 3));
      shape(ctx, tint(c, 0.2), ellipse(ctx, 0, -7, 15, 3.5), 1);
      shape(ctx, '#2e2d35', circle(ctx, 0, -10, 2), 0.8);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.2;
      for (const x of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.moveTo(x, -14);
        ctx.bezierCurveTo(x - 3, -18, x + 3, -21, x, -25);
        ctx.stroke();
      }
      break;
    case 'apple':
      shape(ctx, '#6b4a35', rect(ctx, -0.8, -12, 1.6, 5, 0.5), 0.6);
      shape(ctx, c, () => {
        ctx.moveTo(0, -6);
        ctx.bezierCurveTo(-11, -12, -12, 6, -2, 9);
        ctx.quadraticCurveTo(0, 8, 2, 9);
        ctx.bezierCurveTo(12, 6, 11, -12, 0, -6);
      });
      if (v === 1)
        shape(ctx, '#6c9a3c', () => {
          ctx.moveTo(1, -10);
          ctx.quadraticCurveTo(7, -14, 9, -9);
          ctx.quadraticCurveTo(4, -8, 1, -10);
        }, 0.8);
      break;
    case 'bread':
      shape(ctx, c, ellipse(ctx, 0, 0, 15, 8));
      ctx.strokeStyle = tint(c, 0.4);
      ctx.lineWidth = 1.6;
      for (let i = 0; i < [2, 3, 4][v % 3]!; i++) {
        const x = -8 + i * 5.5;
        ctx.beginPath();
        ctx.moveTo(x - 2, 3);
        ctx.lineTo(x + 3, -4);
        ctx.stroke();
      }
      break;
    /* ---- night, jungle, camp, harbor, party ---- */
    case 'moon': {
      const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 30);
      glow.addColorStop(0, 'rgba(255,245,200,0.35)');
      glow.addColorStop(1, 'rgba(255,245,200,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();
      if (v === 0) {
        shape(ctx, c, circle(ctx, 0, 0, 16));
        ctx.fillStyle = tint(c, -0.15);
        for (const [x, y, r] of [
          [-5, -4, 3],
          [5, 4, 2.2],
          [3, -7, 1.6],
        ] as const) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else
        shape(ctx, c, () => {
          ctx.arc(0, 0, 16, 1.062, -1.062 + Math.PI * 2);
          ctx.arc(7, 0, 14, -1.515, 1.515, true);
          ctx.closePath();
        });
      break;
    }
    case 'cat':
      ctx.strokeStyle = c;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, 10);
      ctx.bezierCurveTo(18, 10, 18, -4, 13, -8);
      ctx.stroke();
      shape(ctx, c, ellipse(ctx, 0, 4, 9, 9));
      shape(ctx, c, circle(ctx, -2, -8, 6.5));
      for (const x of [-7, 2])
        shape(ctx, c, () => {
          ctx.moveTo(x, -11);
          ctx.lineTo(x + 2, -17);
          ctx.lineTo(x + 4.5, -12);
          ctx.closePath();
        }, 1);
      if (v === 1) {
        ctx.strokeStyle = tint(c, c === '#2e2d35' ? 0.35 : -0.3);
        ctx.lineWidth = 1.4;
        for (const y of [0, 4, 8]) {
          ctx.beginPath();
          ctx.moveTo(-6, y);
          ctx.lineTo(-1, y + 1);
          ctx.stroke();
        }
      }
      ctx.fillStyle = '#e3c04d';
      for (const x of [-4.5, 0.5]) {
        ctx.beginPath();
        ctx.ellipse(x, -8.5, 1.4, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'palm': {
      ctx.strokeStyle = '#8b6a45';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-4, 30);
      ctx.quadraticCurveTo(-2, 0, 6, -20);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(60,40,25,0.4)';
      ctx.lineWidth = 1;
      for (let y = 24; y > -16; y -= 6) {
        ctx.beginPath();
        ctx.moveTo(-6 + (24 - y) * 0.2, y);
        ctx.lineTo(-1 + (24 - y) * 0.2, y - 1);
        ctx.stroke();
      }
      for (const a of [-2.7, -2.1, -1.4, -0.7, -0.2, 0.5]) {
        ctx.save();
        ctx.translate(6, -20);
        ctx.rotate(a);
        shape(ctx, c, () => {
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(12, -6, 24, 2);
          ctx.quadraticCurveTo(12, 1, 0, 0);
        }, 1);
        ctx.restore();
      }
      const nuts = [0, 2, 3][v % 3]!;
      for (let i = 0; i < nuts; i++) shape(ctx, '#6b4a35', circle(ctx, 3 + i * 4, -16 + (i % 2) * 3, 2.6), 0.8);
      break;
    }
    case 'parrot':
      shape(ctx, c, () => {
        ctx.moveTo(-6, 4);
        ctx.lineTo(-14, 18);
        ctx.lineTo(-9, 18);
        ctx.lineTo(-3, 6);
        ctx.closePath();
      }, 1);
      shape(ctx, c, ellipse(ctx, 0, 0, 7, 10));
      shape(ctx, c2 === c ? '#4a72b0' : c2, ellipse(ctx, -2, 2, 4, 7), 1);
      shape(ctx, c, circle(ctx, 2, -9, 5.5), 1);
      shape(ctx, '#2e2d35', () => {
        ctx.moveTo(6, -10);
        ctx.quadraticCurveTo(11, -9, 8, -4);
        ctx.lineTo(6, -6);
        ctx.closePath();
      }, 0.8);
      shape(ctx, '#fff', circle(ctx, 3, -10, 1.8), 0.6);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(3.4, -10, 0.9, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'butterfly':
      for (const sd of [-1, 1]) {
        shape(ctx, c, ellipse(ctx, sd * 6, -3, 6, 6.5), 1);
        shape(ctx, c, ellipse(ctx, sd * 5, 5, 4.5, 4), 1);
        if (v === 1) shape(ctx, c2 === c ? '#f6f3ec' : c2, circle(ctx, sd * 6, -3, 2), 0.6);
      }
      shape(ctx, '#2e2d35', ellipse(ctx, 0, 0, 1.5, 7), 0.6);
      ctx.strokeStyle = '#2e2d35';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-0.5, -7);
      ctx.lineTo(-3, -11);
      ctx.moveTo(0.5, -7);
      ctx.lineTo(3, -11);
      ctx.stroke();
      break;
    case 'monkey':
      ctx.strokeStyle = '#4f7a3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(6, -40);
      ctx.quadraticCurveTo(10, -26, 6, -16);
      ctx.stroke();
      ctx.strokeStyle = c;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(4, -2);
      ctx.lineTo(6, -16);
      ctx.moveTo(-6, 8);
      ctx.quadraticCurveTo(-16, 14, -12, 22);
      ctx.stroke();
      shape(ctx, c, ellipse(ctx, 0, 4, 7, 9));
      shape(ctx, c, circle(ctx, -1, -7, 7));
      shape(ctx, '#ead6bd', ellipse(ctx, -1, -5, 4.5, 4), 0.8);
      for (const x of [-8, 6]) shape(ctx, '#ead6bd', circle(ctx, x, -8, 2.2), 0.6);
      ctx.fillStyle = INK;
      for (const x of [-3, 1]) {
        ctx.beginPath();
        ctx.arc(x, -8, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'frog':
      shape(ctx, c, ellipse(ctx, -8, 6, 5, 3), 1);
      shape(ctx, c, ellipse(ctx, 8, 6, 5, 3), 1);
      shape(ctx, c, ellipse(ctx, 0, 1, 10, 7));
      for (const x of [-5, 5]) {
        shape(ctx, c, circle(ctx, x, -6, 3.5), 1);
        shape(ctx, '#fff', circle(ctx, x, -6.5, 2), 0.6);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(x, -6.5, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = tint(c, -0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 1, 4, 0.3, Math.PI - 0.3);
      ctx.stroke();
      break;
    case 'tent':
      shape(ctx, c, () => {
        ctx.moveTo(0, -22);
        ctx.lineTo(26, 16);
        ctx.lineTo(-26, 16);
        ctx.closePath();
      });
      shape(ctx, v === 1 ? '#2e2d35' : tint(c, -0.2), () => {
        ctx.moveTo(0, -12);
        ctx.lineTo(8, 16);
        ctx.lineTo(-8, 16);
        ctx.closePath();
      }, 1);
      ctx.strokeStyle = 'rgba(60,50,40,0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(-34, 18);
      ctx.moveTo(0, -22);
      ctx.lineTo(34, 18);
      ctx.stroke();
      break;
    case 'campfire': {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI;
        shape(ctx, '#8a8a92', ellipse(ctx, Math.cos(a) * 14, 8 - Math.sin(a) * 3, 3.5, 2.5), 0.8);
      }
      ctx.save();
      ctx.rotate(0.35);
      shape(ctx, '#7a4a2a', rect(ctx, -12, 2, 24, 4, 2), 1);
      ctx.rotate(-0.7);
      shape(ctx, '#7a4a2a', rect(ctx, -12, 2, 24, 4, 2), 1);
      ctx.restore();
      const glow = ctx.createRadialGradient(0, -4, 2, 0, -4, 24);
      glow.addColorStop(0, 'rgba(255,190,90,0.45)');
      glow.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -4, 24, 0, Math.PI * 2);
      ctx.fill();
      shape(ctx, c, () => {
        ctx.moveTo(-8, 4);
        ctx.quadraticCurveTo(-10, -8, -2, -18);
        ctx.quadraticCurveTo(0, -9, 3, -14);
        ctx.quadraticCurveTo(10, -6, 8, 4);
        ctx.closePath();
      }, 0.8);
      shape(ctx, '#f7d35a', () => {
        ctx.moveTo(-4, 4);
        ctx.quadraticCurveTo(-5, -4, 0, -9);
        ctx.quadraticCurveTo(5, -3, 4, 4);
        ctx.closePath();
      }, 0.6);
      break;
    }
    case 'lantern': {
      if (v === 0) {
        const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
        glow.addColorStop(0, 'rgba(255,215,120,0.5)');
        glow.addColorStop(1, 'rgba(255,215,120,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, -11, 4, Math.PI, 0);
      ctx.stroke();
      shape(ctx, c, rect(ctx, -6, -11, 12, 3, 1), 1);
      shape(ctx, v === 0 ? '#f7d35a' : '#c9d6dd', rect(ctx, -5, -8, 10, 13, 2), 1);
      shape(ctx, c, rect(ctx, -6, 5, 12, 4, 1), 1);
      break;
    }
    case 'owl':
      // Perched on a tree stump.
      shape(ctx, '#7a5236', rect(ctx, -11, 11, 22, 12, 2), 1);
      shape(ctx, '#c9a06a', ellipse(ctx, 0, 11, 11, 3), 0.8);
      shape(ctx, c, ellipse(ctx, 0, 0, 10, 13));
      shape(ctx, tint(c, 0.4), ellipse(ctx, 0, 4, 6, 7), 0.8);
      for (const x of [-7, 7])
        shape(ctx, c, () => {
          ctx.moveTo(x, -9);
          ctx.lineTo(x + (x < 0 ? -1 : 1) * 2, -15);
          ctx.lineTo(x * 0.4, -10);
          ctx.closePath();
        }, 0.8);
      for (const x of [-4, 4]) {
        shape(ctx, '#f6f3ec', circle(ctx, x, -5, 3.6), 0.8);
        if (v === 1 && x > 0) {
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x - 2.5, -5);
          ctx.lineTo(x + 2.5, -5);
          ctx.stroke();
        } else {
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.arc(x, -5, 1.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      shape(ctx, '#e0913d', () => {
        ctx.moveTo(-1.5, -2);
        ctx.lineTo(1.5, -2);
        ctx.lineTo(0, 1);
        ctx.closePath();
      }, 0.6);
      break;
    case 'log':
      shape(ctx, c, rect(ctx, -18, -6, 34, 12, 5));
      shape(ctx, '#d9b07a', ellipse(ctx, 16, 0, 4, 6), 1);
      ctx.strokeStyle = tint('#d9b07a', -0.3);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(16, 0, 2, 3.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = tint(c, -0.3);
      for (const x of [-10, -2, 6]) {
        ctx.beginPath();
        ctx.moveTo(x, -4);
        ctx.lineTo(x + 4, -3);
        ctx.stroke();
      }
      break;
    case 'lighthouse': {
      shape(ctx, '#6b6a72', ellipse(ctx, 0, 28, 20, 6), 1);
      shape(ctx, '#f6f3ec', () => {
        ctx.moveTo(-10, 26);
        ctx.lineTo(-6, -24);
        ctx.lineTo(6, -24);
        ctx.lineTo(10, 26);
        ctx.closePath();
      });
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-10, 26);
      ctx.lineTo(-6, -24);
      ctx.lineTo(6, -24);
      ctx.lineTo(10, 26);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = c;
      const stripes = [2, 3][v % 2]!;
      for (let i = 0; i < stripes; i++) ctx.fillRect(-12, -18 + i * (40 / stripes), 24, 20 / stripes);
      ctx.restore();
      shape(ctx, '#2e2d35', rect(ctx, 1, 16, 5, 9, 1), 0.8);
      shape(ctx, '#f7d35a', rect(ctx, -6, -32, 12, 8, 1), 1);
      shape(ctx, c, () => {
        ctx.moveTo(-8, -32);
        ctx.lineTo(0, -40);
        ctx.lineTo(8, -32);
        ctx.closePath();
      }, 1);
      ctx.fillStyle = 'rgba(255,240,170,0.35)';
      ctx.beginPath();
      ctx.moveTo(6, -28);
      ctx.lineTo(40, -38);
      ctx.lineTo(40, -18);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'buoy':
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-14, 9);
      ctx.quadraticCurveTo(0, 13, 14, 9);
      ctx.stroke();
      shape(ctx, c, () => {
        ctx.moveTo(-9, 8);
        ctx.quadraticCurveTo(-9, -8, 0, -8);
        ctx.quadraticCurveTo(9, -8, 9, 8);
        ctx.closePath();
      });
      ctx.fillStyle = v === 0 ? '#f6f3ec' : c2 === c ? '#2e2d35' : c2;
      ctx.fillRect(-8.5, -1, 17, 3.5);
      shape(ctx, '#77757f', rect(ctx, -1, -14, 2, 6, 0.5), 0.6);
      shape(ctx, '#f7d35a', circle(ctx, 0, -15, 2), 0.6);
      break;
    case 'cake': {
      shape(ctx, '#e3dccd', ellipse(ctx, 0, 14, 24, 4), 1);
      shape(ctx, c, rect(ctx, -18, -4, 36, 18, 3));
      shape(ctx, tint(c, 0.15), rect(ctx, -12, -16, 24, 12, 3));
      ctx.fillStyle = '#f6f3ec';
      for (const [x0, w, y] of [
        [-18, 36, -4],
        [-12, 24, -16],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(x0, y);
        for (let x = x0; x <= x0 + w; x += 6) ctx.quadraticCurveTo(x + 1.5, y + 5, x + 3, y + 1.5);
        ctx.lineTo(x0 + w, y);
        ctx.fill();
      }
      const n = [1, 3, 5][v % 3]!;
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 0 : -9 + (i * 18) / (n - 1);
        shape(ctx, c2 === c ? '#4a72b0' : c2, rect(ctx, x - 1, -24, 2, 8, 0.5), 0.6);
        shape(ctx, '#f7c34a', ellipse(ctx, x, -26, 1.4, 2.4), 0.5);
      }
      break;
    }
    case 'partyhat':
      shape(ctx, c, () => {
        ctx.moveTo(0, -12);
        ctx.lineTo(9, 10);
        ctx.lineTo(-9, 10);
        ctx.closePath();
      });
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(9, 10);
      ctx.lineTo(-9, 10);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = c2 === c ? '#f6f3ec' : c2;
      if (v === 0)
        for (const [x, y] of [
          [-2, 0],
          [3, 5],
          [-4, 7],
          [1, -5],
        ] as const) {
          ctx.beginPath();
          ctx.arc(x, y, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      else
        for (const y of [-4, 2, 8]) {
          ctx.save();
          ctx.translate(0, y);
          ctx.rotate(-0.3);
          ctx.fillRect(-12, -1, 24, 2.2);
          ctx.restore();
        }
      ctx.restore();
      shape(ctx, '#f6f3ec', circle(ctx, 0, -13, 2.6), 0.8);
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
    if (GROUNDED.has(o.kind) && scene.theme !== 'space' && scene.theme !== 'night') groundShadow(ctx, o);
    drawObj(ctx, o);
  }
  finish(ctx, scene.bg * 131 + scene.theme.charCodeAt(1));
}
