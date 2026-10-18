/**
 * Canvas painting for Where's the Ball? scenes: textured top-down grounds, soft drop shadows,
 * grain and a vignette for a photo-like feel. Rendering only; positions come from scene.ts.
 */
import { H, rng, W, type Ball, type EnvId, type Item, type Scene } from './scene';

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function softShadow(ctx: C, on: boolean, depth = 1): void {
  if (on) {
    ctx.shadowColor = 'rgba(20, 16, 30, 0.32)';
    ctx.shadowBlur = 6 * depth;
    ctx.shadowOffsetX = 3 * depth;
    ctx.shadowOffsetY = 5 * depth;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
}

/* ----------------------------------------------------------------- ground */

function speckle(ctx: C, seed: number, n: number, colors: string[], size: [number, number], alpha = 0.25): void {
  const r = rng(seed);
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)]!;
    const s = size[0] + r() * (size[1] - size[0]);
    ctx.fillRect(r() * W, r() * H, s, s * (0.5 + r()));
  }
  ctx.restore();
}

function courtLines(ctx: C, color: string, width = 5): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  const L = 110;
  const R = 690;
  const T = 30;
  const B = 570;
  ctx.strokeRect(L, T, R - L, B - T);
  ctx.beginPath();
  ctx.moveTo(L + 70, T);
  ctx.lineTo(L + 70, B);
  ctx.moveTo(R - 70, T);
  ctx.lineTo(R - 70, B);
  ctx.moveTo(L + 70, 160);
  ctx.lineTo(R - 70, 160);
  ctx.moveTo(L + 70, 440);
  ctx.lineTo(R - 70, 440);
  ctx.moveTo(400, 160);
  ctx.lineTo(400, 440);
  ctx.moveTo(400, T);
  ctx.lineTo(400, T + 12);
  ctx.moveTo(400, B);
  ctx.lineTo(400, B - 12);
  ctx.stroke();
}

function net(ctx: C): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(60, 306, 680, 14);
  ctx.strokeStyle = 'rgba(30,30,40,0.55)';
  ctx.lineWidth = 1;
  for (let x = 62; x < 740; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 294);
    ctx.lineTo(x + 3, 306);
    ctx.stroke();
  }
  ctx.fillStyle = '#f7f7f2';
  ctx.fillRect(56, 292, 688, 5);
  ctx.fillStyle = '#3a3a44';
  ctx.beginPath();
  ctx.arc(56, 296, 7, 0, TAU);
  ctx.arc(744, 296, 7, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function ground(ctx: C, s: Scene): void {
  const v = s.variant;
  switch (s.env) {
    case 'hardcourt': {
      const [outer, inner] = [
        ['#3f8a5a', '#2f63a8'],
        ['#4b7f4f', '#3b8a63'],
        ['#7a4f8f', '#3d6fb0'],
      ][v]!;
      ctx.fillStyle = outer!;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = inner!;
      ctx.fillRect(110, 30, 580, 540);
      speckle(ctx, s.seed, 2600, ['#ffffff', '#000000'], [1, 2], 0.08);
      courtLines(ctx, 'rgba(255,255,255,0.92)');
      net(ctx);
      break;
    }
    case 'clay': {
      ctx.fillStyle = ['#c4623a', '#b85a35', '#cc6d42'][v]!;
      ctx.fillRect(0, 0, W, H);
      speckle(ctx, s.seed, 4000, ['#e08a5c', '#9c4a2a', '#d4764a'], [1, 3], 0.35);
      // Sweep marks.
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = '#ffffff';
      for (let y = 10; y < H; y += 14) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(200, y + 6, 600, y - 6, W, y + 2);
        ctx.stroke();
      }
      ctx.restore();
      courtLines(ctx, 'rgba(250,245,235,0.78)', 6);
      net(ctx);
      break;
    }
    case 'lawn':
    case 'picnic': {
      const greens = s.env === 'lawn' ? ['#5aa64a', '#4e9a40'] : ['#6aae4c', '#62a446'];
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = greens[i % 2]!;
        ctx.fillRect(0, i * 60, W, 60);
      }
      speckle(ctx, s.seed, 5000, ['#3f7f32', '#7cc160', '#2f6b28'], [1, 3], 0.35);
      if (s.env === 'picnic') {
        // A gravel path.
        ctx.fillStyle = '#d9cdb2';
        ctx.beginPath();
        ctx.moveTo(0, 430 + v * 20);
        ctx.bezierCurveTo(260, 380, 520, 520, W, 450);
        ctx.lineTo(W, 520);
        ctx.bezierCurveTo(520, 590, 260, 450, 0, 510 + v * 20);
        ctx.fill();
      }
      break;
    }
    case 'locker': {
      // Warm wooden planks.
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = ['#c99863', '#bd8b57', '#d3a36e', '#b9864f'][(i + v) % 4]!;
        ctx.fillRect(0, i * 38, W, 38);
        ctx.fillStyle = 'rgba(60,35,15,0.35)';
        ctx.fillRect(0, i * 38, W, 2);
        ctx.fillRect(((i * 197) % 700) + 40, i * 38, 2, 38);
      }
      speckle(ctx, s.seed, 1600, ['#8a5a30', '#e8bf8a'], [1, 6], 0.2);
      // Lockers along the top wall.
      for (let x = 0; x < W; x += 66) {
        ctx.fillStyle = ['#3d7bff', '#2f6fd8'][Math.floor(x / 66) % 2]!;
        ctx.fillRect(x, 0, 64, 46);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let k = 0; k < 4; k++) ctx.fillRect(x + 10, 10 + k * 7, 26, 3);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, 46, W, 8);
      break;
    }
    case 'autumn': {
      ctx.fillStyle = '#7e9a4a';
      ctx.fillRect(0, 0, W, H);
      speckle(ctx, s.seed, 4000, ['#5d7a33', '#9bb35a', '#a88a3c'], [1, 3], 0.4);
      ctx.fillStyle = '#9a958c';
      ctx.beginPath();
      ctx.moveTo(0, 180 + v * 30);
      ctx.lineTo(W, 330 - v * 20);
      ctx.lineTo(W, 440 - v * 20);
      ctx.lineTo(0, 290 + v * 30);
      ctx.fill();
      speckle(ctx, s.seed + 1, 1500, ['#7d786f', '#b5b0a6'], [1, 2], 0.5);
      break;
    }
  }
}

/* ------------------------------------------------------------------ items */

function drawItem(ctx: C, it: Item): void {
  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.rotate(it.rot);
  ctx.scale(it.s, it.s);
  const c = it.color;
  const fillShape = (fill: string | CanvasGradient, path: () => void, shadow = true): void => {
    softShadow(ctx, shadow);
    ctx.beginPath();
    path();
    ctx.fillStyle = fill;
    ctx.fill();
    softShadow(ctx, false);
  };
  switch (it.kind) {
    case 'shadow': {
      const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 80);
      g.addColorStop(0, 'rgba(10,20,30,0.42)');
      g.addColorStop(1, 'rgba(10,20,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, 90, 60, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case 'puddle':
      ctx.fillStyle = it.color === '#ffffff' ? 'rgba(120,150,170,0.45)' : 'rgba(110,140,165,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 44, 26, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.ellipse(-10, -8, 16, 5, -0.3, 0, TAU);
      ctx.fill();
      break;
    case 'tuft':
      ctx.strokeStyle = 'rgba(40,90,30,0.75)';
      ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 2, 6);
        ctx.quadraticCurveTo(i * 4, -2, i * 5, -12 + Math.abs(i) * 2);
        ctx.stroke();
      }
      break;
    case 'pebble':
      fillShape(c === '#ffffff' ? '#d7cfc2' : '#b9aa96', () => ctx.ellipse(0, 0, 7, 5, 0, 0, TAU), false);
      break;
    case 'leaf': {
      fillShape(c, () => {
        ctx.moveTo(-13, 0);
        ctx.quadraticCurveTo(0, -11, 13, 0);
        ctx.quadraticCurveTo(0, 11, -13, 0);
      });
      ctx.strokeStyle = 'rgba(90,50,10,0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(13, 0);
      for (let k = -8; k <= 8; k += 4) {
        ctx.moveTo(k, 0);
        ctx.lineTo(k + 4, -5 + Math.abs(k) * 0.2);
        ctx.moveTo(k, 0);
        ctx.lineTo(k + 4, 5 - Math.abs(k) * 0.2);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(80,40,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(4, 3, 5, 2.5, 0.3, 0, TAU);
      ctx.fill();
      break;
    }
    case 'lemon': {
      const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 15);
      g.addColorStop(0, '#fff27a');
      g.addColorStop(1, '#e9c514');
      fillShape(g, () => {
        ctx.ellipse(0, 0, 14, 11, 0, 0, TAU);
      });
      ctx.fillStyle = '#d9b310';
      ctx.beginPath();
      ctx.arc(14, 0, 2.5, 0, TAU);
      ctx.fill();
      // Peel dimples and a highlight.
      ctx.fillStyle = 'rgba(150,110,0,0.22)';
      for (let i = 0; i < 14; i++) {
        const a = i * 2.39996;
        const rr = 3 + (i % 5) * 1.8;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.75, 0.7, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(-5, -5, 4, 2, -0.5, 0, TAU);
      ctx.fill();
      break;
    }
    case 'lime':
    case 'apple': {
      const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 13);
      g.addColorStop(0, it.kind === 'lime' ? '#c8ef5a' : '#b8e65a');
      g.addColorStop(1, it.kind === 'lime' ? '#6fae1f' : '#7fb52a');
      fillShape(g, () => ctx.arc(0, 0, it.kind === 'lime' ? 11 : 13, 0, TAU));
      if (it.kind === 'apple') {
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(-1, -3, 2, 5);
      }
      break;
    }
    case 'golfball': {
      const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#cfd3d6');
      fillShape(g, () => ctx.arc(0, 0, 7, 0, TAU));
      break;
    }
    case 'daisy':
    case 'dandelion': {
      const petal = it.kind === 'daisy' ? '#ffffff' : '#ffd21f';
      softShadow(ctx, true, 0.4);
      ctx.fillStyle = petal;
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.ellipse(Math.cos((i / 10) * TAU) * 5, Math.sin((i / 10) * TAU) * 5, 4, 2, (i / 10) * TAU, 0, TAU);
        ctx.fill();
      }
      softShadow(ctx, false);
      ctx.fillStyle = it.kind === 'daisy' ? '#ffcf1f' : '#f2b705';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, TAU);
      ctx.fill();
      break;
    }
    case 'can': {
      const g = ctx.createRadialGradient(-3, -3, 2, 0, 0, 15);
      g.addColorStop(0, '#f2f2f2');
      g.addColorStop(1, '#a8acb2');
      fillShape(g, () => ctx.arc(0, 0, 14, 0, TAU));
      ctx.fillStyle = '#d9f24a';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TAU);
      ctx.stroke();
      break;
    }
    case 'cone':
      fillShape(c === '#ffffff' ? '#ff8a1f' : '#ffb21f', () => ctx.arc(0, 0, 13, 0, TAU));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ff8a1f';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, TAU);
      ctx.fill();
      break;
    case 'cup':
      fillShape(c, () => ctx.arc(0, 0, 12, 0, TAU));
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(0, 0, 8.5, 0, TAU);
      ctx.fill();
      break;
    case 'plate':
      fillShape('#fbfbf8', () => ctx.arc(0, 0, 22, 0, TAU));
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, TAU);
      ctx.stroke();
      break;
    case 'cap':
      fillShape(c, () => {
        ctx.arc(0, 0, 15, 0, TAU);
      });
      fillShape(c, () => ctx.ellipse(0, 18, 14, 9, 0, 0, Math.PI), false);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, TAU);
      ctx.fill();
      break;
    case 'towel': {
      fillShape(c, () => ctx.roundRect(-40, -24, 80, 48, 4));
      // Terry-cloth weave and a soft fold.
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-40, -24, 80, 48, 4);
      ctx.clip();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#000';
      for (let y = -24; y < 24; y += 2) ctx.fillRect(-40, y, 80, 0.7);
      const fold = ctx.createLinearGradient(-40, 0, 40, 0);
      fold.addColorStop(0, 'rgba(0,0,0,0)');
      fold.addColorStop(0.45, 'rgba(0,0,0,0.25)');
      fold.addColorStop(0.55, 'rgba(255,255,255,0.4)');
      fold.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = fold;
      ctx.fillRect(-40, -24, 80, 48);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-40, -18, 80, 4);
      ctx.fillRect(-40, 14, 80, 4);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, -24);
      ctx.quadraticCurveTo(-4, 0, -12, 24);
      ctx.stroke();
      break;
    }
    case 'blanket': {
      fillShape(c, () => ctx.roundRect(-90, -60, 180, 120, 6));
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let i = -80; i < 90; i += 30) ctx.fillRect(i, -60, 12, 120);
      for (let j = -50; j < 60; j += 30) ctx.fillRect(-90, j, 180, 12);
      break;
    }
    case 'bag':
      fillShape(c, () => ctx.roundRect(-46, -16, 92, 32, 16));
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-40, -4, 80, 3);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-20, -16);
      ctx.quadraticCurveTo(0, -34, 20, -16);
      ctx.stroke();
      break;
    case 'bottle':
      fillShape(c, () => ctx.roundRect(-20, -8, 36, 16, 6));
      fillShape('#e8e8e8', () => ctx.roundRect(16, -5, 8, 10, 2), false);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(-16, -5, 26, 3);
      break;
    case 'shoe':
      fillShape(c, () => {
        ctx.ellipse(0, 0, 24, 10, 0, 0, TAU);
      });
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-4, 0, 12, 5, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.2;
      for (let i = -12; i < 2; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i, -4);
        ctx.lineTo(i + 2, 4);
        ctx.stroke();
      }
      break;
    case 'racquet': {
      softShadow(ctx, true);
      ctx.strokeStyle = c;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(-14, 0, 30, 22, 0, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(52, 0);
      ctx.stroke();
      softShadow(ctx, false);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 0.9;
      for (let x = -40; x <= 12; x += 6) {
        ctx.beginPath();
        ctx.moveTo(x, -20);
        ctx.lineTo(x, 20);
        ctx.stroke();
      }
      for (let y = -18; y <= 18; y += 6) {
        ctx.beginPath();
        ctx.moveTo(-42, y);
        ctx.lineTo(14, y);
        ctx.stroke();
      }
      break;
    }
    case 'chair':
      fillShape(c, () => ctx.roundRect(-30, -30, 60, 60, 8));
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(-30, -30, 60, 14);
      break;
    case 'umbrella': {
      softShadow(ctx, true, 2);
      ctx.fillStyle = c;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.lineTo(Math.cos(a) * 70, Math.sin(a) * 70);
      }
      ctx.closePath();
      ctx.fill();
      softShadow(ctx, false);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 8; i += 2) {
        const a = (i / 8) * TAU;
        const b = ((i + 1) / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 70, Math.sin(a) * 70);
        ctx.lineTo(Math.cos(b) * 70, Math.sin(b) * 70);
        ctx.fill();
      }
      ctx.fillStyle = '#eee';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, TAU);
      ctx.fill();
      break;
    }
    case 'bench':
      fillShape('#8a5a34', () => ctx.roundRect(-72, -16, 144, 32, 4));
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-72, -6, 144, 2);
      ctx.fillRect(-72, 5, 144, 2);
      break;
  }
  ctx.restore();
}

/* ------------------------------------------------------------------- ball */

export function drawBall(ctx: C, b: Ball): void {
  ctx.save();
  ctx.translate(b.x, b.y);
  // Contact shadow.
  ctx.fillStyle = 'rgba(15,20,25,0.35)';
  ctx.beginPath();
  ctx.ellipse(b.r * 0.35, b.r * 0.5, b.r * 1.05, b.r * 0.75, 0, 0, TAU);
  ctx.fill();
  const g = ctx.createRadialGradient(-b.r * 0.35, -b.r * 0.35, b.r * 0.1, 0, 0, b.r * 1.05);
  g.addColorStop(0, '#f1ff7a');
  g.addColorStop(0.65, '#d4ee32');
  g.addColorStop(1, '#a7c21c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, b.r, 0, TAU);
  ctx.fill();
  // Felt fuzz: tiny fibres around the edge and speckle across the felt.
  ctx.strokeStyle = 'rgba(235,250,160,0.55)';
  ctx.lineWidth = Math.max(0.5, b.r * 0.05);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU + b.rot;
    const r0 = b.r * 0.94;
    const r1 = b.r * (1.05 + ((i * 7) % 5) * 0.02);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a + 0.05) * r1, Math.sin(a + 0.05) * r1);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(120,140,20,0.18)';
  for (let i = 0; i < 18; i++) {
    const a = i * 2.39996 + b.rot;
    const rr = b.r * 0.15 + ((i * 13) % 10) * b.r * 0.075;
    ctx.fillRect(Math.cos(a) * rr, Math.sin(a) * rr, Math.max(0.6, b.r * 0.07), Math.max(0.6, b.r * 0.07));
  }
  // The seam.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, b.r, 0, TAU);
  ctx.clip();
  ctx.rotate(b.rot);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(0.8, b.r * 0.14);
  ctx.beginPath();
  ctx.arc(-b.r * 1.15, 0, b.r * 0.85, -0.9, 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(b.r * 1.15, 0, b.r * 0.85, Math.PI - 0.9, Math.PI + 0.9);
  ctx.stroke();
  ctx.restore();
  if (b.dust > 0) {
    ctx.fillStyle = `rgba(190, 95, 55, ${b.dust})`;
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ----------------------------------------------------------------- finish */

let grain: HTMLCanvasElement | null = null;
function grainPattern(ctx: C): CanvasPattern | null {
  if (!grain) {
    grain = document.createElement('canvas');
    grain.width = grain.height = 128;
    const g = grain.getContext('2d');
    if (!g) return null;
    const img = g.createImageData(128, 128);
    const r = rng(7);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(r() * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  return ctx.createPattern(grain, 'repeat');
}

/** Paints the whole scene into a canvas `cssWidth` CSS pixels wide (device-pixel sharp). */
export function paintScene(canvas: HTMLCanvasElement, s: Scene, cssWidth: number): void {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const w = Math.round(cssWidth * dpr);
  const h = Math.round((cssWidth * dpr * H) / W);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(w / W, 0, 0, h / H, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ground(ctx, s);
  for (const it of s.under) drawItem(ctx, it);
  drawBall(ctx, s.ball);
  // Shade falls on the ball too.
  if (s.ball.shade > 0) {
    const g = ctx.createRadialGradient(s.ball.x, s.ball.y, 0, s.ball.x, s.ball.y, s.ball.r * 3);
    g.addColorStop(0, `rgba(10,20,30,${s.ball.shade})`);
    g.addColorStop(1, 'rgba(10,20,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(s.ball.x - s.ball.r * 3, s.ball.y - s.ball.r * 3, s.ball.r * 6, s.ball.r * 6);
  }
  for (const it of s.over) drawItem(ctx, it);
  // Photo finish: soft light, grain, vignette.
  const light = ctx.createLinearGradient(0, 0, W, H);
  light.addColorStop(0, 'rgba(255,245,215,0.12)');
  light.addColorStop(1, 'rgba(0,0,30,0.1)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, H);
  const pat = grainPattern(ctx);
  if (pat) {
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

export type { EnvId };
