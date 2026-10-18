/**
 * Canvas drawing for Spot the Glitch pictures: flat toy-box shapes with chunky outlines. Rendering
 * only; what is drawn comes from scene.ts / diffs.ts.
 */
import { H, W, type Obj, type Scene } from './scene';

const INK = '#14102a';
type C = CanvasRenderingContext2D;

function shape(ctx: C, fill: string, path: () => void, line = 2.2): void {
  ctx.beginPath();
  path();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = line;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

const circle = (ctx: C, x: number, y: number, r: number) => () => ctx.arc(x, y, r, 0, Math.PI * 2);
const ellipse = (ctx: C, x: number, y: number, rx: number, ry: number) => () => ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
const rect = (ctx: C, x: number, y: number, w: number, h: number, r = 3) => () => ctx.roundRect(x, y, w, h, r);

/* ------------------------------------------------------------ backgrounds */

function background(ctx: C, s: Scene): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const sky = (a: string, b: string): void => {
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  switch (s.theme) {
    case 'meadow': {
      sky(['#9ee3ff', '#ffd6e8', '#b8f0ff'][s.bg]!, '#fff6d8');
      ctx.fillStyle = '#9ad86a';
      ctx.beginPath();
      ctx.moveTo(0, 170);
      ctx.bezierCurveTo(90, 120 + s.bg * 10, 200, 190, 400, 140);
      ctx.lineTo(400, 300);
      ctx.lineTo(0, 300);
      ctx.fill();
      ctx.fillStyle = '#6fc24f';
      ctx.beginPath();
      ctx.moveTo(0, 215);
      ctx.bezierCurveTo(120, 185, 260, 235, 400, 200);
      ctx.lineTo(400, 300);
      ctx.lineTo(0, 300);
      ctx.fill();
      break;
    }
    case 'reef': {
      sky(['#5fd0f0', '#4fc3e8', '#6ad6e0'][s.bg]!, '#1e8fc7');
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(40 + i * 100, 0);
        ctx.lineTo(80 + i * 100, 0);
        ctx.lineTo(20 + i * 100, 250);
        ctx.lineTo(-10 + i * 100, 250);
        ctx.fill();
      }
      ctx.fillStyle = '#f6dca0';
      ctx.beginPath();
      ctx.moveTo(0, 255);
      ctx.bezierCurveTo(130, 240, 270, 268, 400, 250);
      ctx.lineTo(400, 300);
      ctx.lineTo(0, 300);
      ctx.fill();
      break;
    }
    case 'street': {
      sky(['#a6e4ff', '#ffd9c2', '#cfe8ff'][s.bg]!, '#fff3e0');
      ctx.fillStyle = '#d9d2c5';
      ctx.fillRect(0, 205, W, 35);
      ctx.fillStyle = '#5a566b';
      ctx.fillRect(0, 240, W, 60);
      ctx.fillStyle = '#ffd21f';
      for (let x = 10; x < W; x += 50) ctx.fillRect(x, 268, 26, 4);
      break;
    }
    case 'space': {
      sky(['#c9b6ff', '#ffc4e1', '#b6d4ff'][s.bg]!, '#fbe7ff');
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % W, (i * 53) % H, 1.6, 1.6);
      break;
    }
    case 'snow': {
      sky(['#bfe6ff', '#d8d4ff', '#c8f0ff'][s.bg]!, '#f4fbff');
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#cfe3f3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 185);
      ctx.bezierCurveTo(110, 150, 250, 205, 400, 165);
      ctx.lineTo(400, 300);
      ctx.lineTo(0, 300);
      ctx.fill();
      ctx.stroke();
      break;
    }
  }
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
    case 'cloud':
      shape(ctx, c, () => {
        ctx.moveTo(-26, 8);
        ctx.arc(-16, 2, 10, Math.PI * 0.5, Math.PI * 1.5);
        ctx.arc(-2, -6, 14, Math.PI, Math.PI * 1.9);
        ctx.arc(16, 0, 10, Math.PI * 1.3, Math.PI * 0.5);
        ctx.closePath();
      });
      break;
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
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(7, -17);
      ctx.lineTo(-7, -17);
      ctx.fill();
      break;
    case 'house': {
      shape(ctx, c, rect(ctx, -24, -14, 48, 36, 2));
      shape(ctx, '#ff7a59', () => {
        ctx.moveTo(-30, -12);
        ctx.lineTo(0, -36);
        ctx.lineTo(30, -12);
        ctx.closePath();
      });
      shape(ctx, '#8b5a3c', rect(ctx, 12, -38, 8, 14, 1));
      const doorX = v % 2 === 0 ? -6 : -18;
      shape(ctx, c2, rect(ctx, doorX, 2, 12, 20, 2));
      shape(ctx, '#bfe8ff', rect(ctx, v % 2 === 0 ? 10 : 4, -6, 10, 10, 1));
      if (v >= 2) shape(ctx, '#bfe8ff', rect(ctx, -20, -6, 10, 10, 1));
      break;
    }
    case 'flower': {
      ctx.strokeStyle = '#2f9e6a';
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
      shape(ctx, '#ffd21f', circle(ctx, 0, -2, 3.5), 1.6);
      break;
    }
    case 'bird':
      shape(ctx, c, ellipse(ctx, 0, 0, 10, 7));
      shape(ctx, '#ff9f1c', () => {
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
      shape(ctx, '#fff3e0', rect(ctx, -4, 0, 8, 10, 2), 1.8);
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
          shape(ctx, lit[n % 4] === 0 ? '#ffd21f' : '#dff4ff', rect(ctx, x, y, 8, 9, 1), 1.4);
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
      shape(ctx, '#dff4ff', rect(ctx, -4, -12, 12, 7, 1), 1.4);
      if (v >= 1) shape(ctx, c2, rect(ctx, -20, -1, 40, 3, 1), 1);
      if (v === 2) shape(ctx, '#ffd21f', circle(ctx, 20, 0, 2.5), 1);
      shape(ctx, '#2a2540', circle(ctx, -12, 7, 5));
      shape(ctx, '#2a2540', circle(ctx, 12, 7, 5));
      break;
    }
    case 'lamp':
      shape(ctx, c, rect(ctx, -2.5, -26, 5, 48, 2), 1.6);
      shape(ctx, c, () => {
        ctx.moveTo(0, -26);
        ctx.quadraticCurveTo(12, -30, 14, -22);
      }, 1.6);
      shape(ctx, '#ffd21f', circle(ctx, 14, -19, 4), 1.4);
      break;
    case 'sign':
      shape(ctx, '#7d7797', rect(ctx, -2, -4, 4, 26, 1), 1.4);
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
      shape(ctx, '#ff5a6c', () => {
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
      shape(ctx, '#3d7bff', circle(ctx, 0, -6, 4.5), 1.6);
      shape(ctx, '#ff9f1c', () => {
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
      shape(ctx, '#bfe8ff', ellipse(ctx, 0, -6, 9, 8), 1.8);
      shape(ctx, c, ellipse(ctx, 0, 2, 20, 7));
      ctx.fillStyle = '#ffd21f';
      for (let i = 0; i < [3, 4, 2][v % 3]!; i++) {
        ctx.beginPath();
        ctx.arc(-10 + (i * 20) / Math.max(1, [3, 4, 2][v % 3]! - 1), 3, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'snowman':
      shape(ctx, '#ffffff', circle(ctx, 0, 10, 13));
      shape(ctx, '#ffffff', circle(ctx, 0, -10, 9));
      shape(ctx, c, rect(ctx, -9, -4, 18, 4, 2), 1.4);
      shape(ctx, '#ff9f1c', () => {
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
  for (const o of scene.objects) drawObj(ctx, o);
}
