/**
 * The scenery standing on the ground (trees, cacti, palms, gravestones, candy canes, barrels…). Each
 * is drawn with its base at (0, 0), growing up. Only drawn: shots pass through it, blasts clear it.
 */
import { hash01 } from '../math';
import type { Decor } from '../terrains';

type Ctx = CanvasRenderingContext2D;

function blob(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, line?: string, w = 1): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (line) {
    c.strokeStyle = line;
    c.lineWidth = w;
    c.stroke();
  }
}

function trunk(c: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: string, line: string): void {
  c.beginPath();
  c.moveTo(x0 - w, y0);
  c.quadraticCurveTo((x0 + x1) / 2 - w * 0.6, (y0 + y1) / 2, x1 - w * 0.5, y1);
  c.lineTo(x1 + w * 0.5, y1);
  c.quadraticCurveTo((x0 + x1) / 2 + w * 0.6, (y0 + y1) / 2, x0 + w, y0);
  c.closePath();
  c.fillStyle = color;
  c.fill();
  c.strokeStyle = line;
  c.lineWidth = 1;
  c.stroke();
}

export function drawDecor(c: Ctx, kind: Decor, seed: number): void {
  const r = (k: number): number => hash01(seed, k);
  switch (kind) {
    case 'tree': {
      trunk(c, 0, 0, 1, -22, 3.2, '#7a4a24', '#3e2410');
      const g = c.createRadialGradient(-6, -40, 2, 0, -34, 22);
      g.addColorStop(0, '#9be05a');
      g.addColorStop(1, '#2f8a2c');
      for (const [x, y, rr] of [
        [-9, -28, 10],
        [9, -29, 10],
        [0, -38, 13],
        [-4, -26, 9],
        [5, -25, 9],
      ])
        blob(c, x!, y!, rr!, rr! * 0.9, g, '#1f5a1e');
      blob(c, -5, -40, 4, 3, 'rgba(255,255,255,0.18)');
      for (let k = 0; k < 3; k++) blob(c, -8 + r(k) * 16, -34 + r(k + 9) * 10, 1.4, 1.4, '#e8433a');
      break;
    }
    case 'flower': {
      c.strokeStyle = '#2f7d32';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(2, -6, 0, -11);
      c.stroke();
      const col = ['#ff5d8f', '#ffd23f', '#a78bfa', '#ffffff'][Math.floor(r(1) * 4)]!;
      for (let k = 0; k < 5; k++) blob(c, Math.cos((k / 5) * Math.PI * 2) * 2.6, -11 + Math.sin((k / 5) * Math.PI * 2) * 2.6, 2, 2, col, 'rgba(0,0,0,0.25)', 0.5);
      blob(c, 0, -11, 1.4, 1.4, '#ffb300');
      break;
    }
    case 'tuft': {
      c.strokeStyle = r(2) < 0.5 ? '#3f9a2e' : '#57b33b';
      c.lineWidth = 1.3;
      c.lineCap = 'round';
      for (let k = -2; k <= 2; k++) {
        c.beginPath();
        c.moveTo(k * 1.5, 0);
        c.quadraticCurveTo(k * 2.5, -4, k * 3.2 + (r(k + 5) - 0.5) * 2, -6 - r(k + 3) * 4);
        c.stroke();
      }
      break;
    }
    case 'cactus': {
      const body = (x: number, y: number, w: number, h: number): void => {
        c.beginPath();
        c.roundRect(x - w / 2, y - h, w, h, w / 2);
        const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        g.addColorStop(0, '#5fbf55');
        g.addColorStop(1, '#2c7a35');
        c.fillStyle = g;
        c.fill();
        c.strokeStyle = '#1d4d22';
        c.lineWidth = 1;
        c.stroke();
      };
      body(-8, -10, 5, 12);
      body(8, -14, 5, 12);
      c.fillStyle = '#2c7a35';
      c.fillRect(-8, -13, 6, 3.5);
      c.fillRect(2, -17, 6, 3.5);
      body(0, 0, 8, 34);
      c.strokeStyle = 'rgba(255,255,255,0.25)';
      c.beginPath();
      c.moveTo(-1.5, -4);
      c.lineTo(-1.5, -30);
      c.stroke();
      blob(c, 0, -34, 2.4, 1.8, '#ff5fa2');
      break;
    }
    case 'skull': {
      blob(c, 0, -4, 5, 4.2, '#efe6d2', '#8a7a5a', 0.8);
      blob(c, -1.8, -4.4, 1.2, 1.3, '#3b2f20');
      blob(c, 1.8, -4.4, 1.2, 1.3, '#3b2f20');
      c.fillStyle = '#efe6d2';
      c.fillRect(-2.5, -1.5, 5, 2);
      break;
    }
    case 'pine': {
      trunk(c, 0, 0, 0, -10, 2.4, '#6b4226', '#3a2412');
      for (let k = 0; k < 3; k++) {
        const y = -8 - k * 9;
        const w = 13 - k * 3.4;
        c.beginPath();
        c.moveTo(-w, y);
        c.lineTo(0, y - 15);
        c.lineTo(w, y);
        c.closePath();
        c.fillStyle = '#2f6b4f';
        c.fill();
        c.strokeStyle = '#1a3d2c';
        c.lineWidth = 1;
        c.stroke();
        c.beginPath();
        c.moveTo(-w * 0.7, y - 4);
        c.lineTo(0, y - 15);
        c.lineTo(w * 0.7, y - 4);
        c.quadraticCurveTo(0, y - 7, -w * 0.7, y - 4);
        c.fillStyle = '#f4faff';
        c.fill();
      }
      break;
    }
    case 'icicle':
    case 'crystal': {
      const ice = kind === 'icicle';
      for (const [x, h, tilt] of [
        [-4, 14, -0.3],
        [0, 22, 0],
        [4.5, 12, 0.35],
      ]) {
        c.save();
        c.rotate(tilt!);
        c.beginPath();
        c.moveTo(x! - 3, 0);
        c.lineTo(x! - 2.6, -h! + 4);
        c.lineTo(x!, -h!);
        c.lineTo(x! + 2.6, -h! + 4);
        c.lineTo(x! + 3, 0);
        c.closePath();
        const g = c.createLinearGradient(x! - 3, 0, x! + 3, 0);
        g.addColorStop(0, ice ? '#e0f7ff' : '#a5f3fc');
        g.addColorStop(1, ice ? '#7cc4f0' : '#22d3ee');
        c.fillStyle = g;
        if (!ice) {
          c.shadowColor = '#67e8f9';
          c.shadowBlur = 8;
        }
        c.fill();
        c.shadowBlur = 0;
        c.strokeStyle = ice ? '#4a8ab8' : '#0e7490';
        c.lineWidth = 0.8;
        c.stroke();
        c.restore();
      }
      break;
    }
    case 'vent': {
      c.beginPath();
      c.moveTo(-9, 0);
      c.lineTo(-4, -9);
      c.lineTo(4, -9);
      c.lineTo(9, 0);
      c.closePath();
      c.fillStyle = '#2b1d1f';
      c.fill();
      c.strokeStyle = '#120a0c';
      c.stroke();
      const g = c.createRadialGradient(0, -9, 0, 0, -9, 9);
      g.addColorStop(0, 'rgba(255,190,70,0.95)');
      g.addColorStop(1, 'rgba(255,80,20,0)');
      blob(c, 0, -9, 9, 5, g);
      break;
    }
    case 'charred': {
      trunk(c, 0, 0, -1, -16, 2.6, '#2a1d1b', '#0d0807');
      c.strokeStyle = '#2a1d1b';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-0.5, -10);
      c.lineTo(5, -16);
      c.moveTo(-1, -13);
      c.lineTo(-6, -18);
      c.stroke();
      blob(c, 0.6, -5, 1, 1, '#ff6a1f');
      break;
    }
    case 'palm': {
      c.beginPath();
      c.moveTo(-2.5, 0);
      c.bezierCurveTo(-1, -14, 6, -28, 10, -38);
      c.lineTo(12.5, -37);
      c.bezierCurveTo(9, -27, 2, -14, 2.5, 0);
      c.closePath();
      c.fillStyle = '#a0703c';
      c.fill();
      c.strokeStyle = '#5a3a18';
      c.lineWidth = 1;
      c.stroke();
      c.strokeStyle = 'rgba(90,58,24,0.6)';
      for (let k = 1; k < 7; k++) {
        const y = -k * 5;
        c.beginPath();
        c.moveTo(-1 + k * 1.4, y);
        c.lineTo(2 + k * 1.5, y - 1);
        c.stroke();
      }
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI + (k / 5) * Math.PI;
        c.beginPath();
        c.moveTo(11, -38);
        c.quadraticCurveTo(11 + Math.cos(a) * 10, -38 + Math.sin(a) * 9 - 6, 11 + Math.cos(a) * 19, -38 + Math.sin(a) * 6 + 6);
        c.quadraticCurveTo(11 + Math.cos(a) * 10, -38 + Math.sin(a) * 9 - 1, 11, -37);
        c.fillStyle = k % 2 ? '#3fa34d' : '#2e8a3e';
        c.fill();
        c.strokeStyle = '#1d5a28';
        c.stroke();
      }
      blob(c, 9.5, -35.5, 2.2, 2.2, '#6b4520');
      blob(c, 12.5, -35, 2.2, 2.2, '#5a3a18');
      break;
    }
    case 'shell': {
      c.beginPath();
      c.moveTo(-5, 0);
      c.quadraticCurveTo(0, -11, 5, 0);
      c.closePath();
      c.fillStyle = '#ffd1dc';
      c.fill();
      c.strokeStyle = '#c27b8e';
      c.stroke();
      for (const x of [-2.5, 0, 2.5]) {
        c.beginPath();
        c.moveTo(0, -1);
        c.lineTo(x * 1.6, -6.5);
        c.stroke();
      }
      break;
    }
    case 'dish': {
      c.strokeStyle = '#9ca3af';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-5, 0);
      c.lineTo(0, -12);
      c.lineTo(5, 0);
      c.stroke();
      c.save();
      c.translate(0, -14);
      c.rotate(-0.5);
      c.beginPath();
      c.ellipse(0, 0, 10, 4, 0, 0, Math.PI);
      c.closePath();
      c.fillStyle = '#e5e7eb';
      c.fill();
      c.strokeStyle = '#6b7280';
      c.lineWidth = 1;
      c.stroke();
      c.beginPath();
      c.moveTo(0, 1);
      c.lineTo(0, -6);
      c.stroke();
      blob(c, 0, -6.5, 1.3, 1.3, '#ef4444');
      c.restore();
      break;
    }
    case 'rock': {
      c.beginPath();
      c.moveTo(-8, 0);
      c.lineTo(-6, -6);
      c.lineTo(-1, -9);
      c.lineTo(5, -7);
      c.lineTo(8, 0);
      c.closePath();
      const g = c.createLinearGradient(0, -9, 0, 0);
      g.addColorStop(0, '#a8a29e');
      g.addColorStop(1, '#57534e');
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = '#292524';
      c.lineWidth = 1;
      c.stroke();
      break;
    }
    case 'cane': {
      c.lineCap = 'round';
      c.lineWidth = 4;
      c.strokeStyle = '#ffffff';
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -24);
      c.arc(5, -24, 5, Math.PI, 0);
      c.stroke();
      c.setLineDash([3, 3]);
      c.strokeStyle = '#e11d48';
      c.stroke();
      c.setLineDash([]);
      break;
    }
    case 'lolly': {
      c.fillStyle = '#f5f5f4';
      c.fillRect(-0.9, -20, 1.8, 20);
      const g = c.createRadialGradient(-2, -25, 1, 0, -23, 8);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.3, '#ff7ab8');
      g.addColorStop(1, '#c026d3');
      blob(c, 0, -23, 7, 7, g, '#86198f');
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.lineWidth = 1.2;
      c.beginPath();
      for (let a = 0; a < 9; a += 0.3) c.lineTo(Math.cos(a) * a * 0.7, -23 + Math.sin(a) * a * 0.7);
      c.stroke();
      break;
    }
    case 'gumdrop': {
      const col = ['#ff4d6d', '#4dd2ff', '#7cff6b', '#ffd23f', '#b26bff'][Math.floor(r(4) * 5)]!;
      c.beginPath();
      c.moveTo(-6, 0);
      c.quadraticCurveTo(-6, -10, 0, -10);
      c.quadraticCurveTo(6, -10, 6, 0);
      c.closePath();
      c.fillStyle = col;
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      c.stroke();
      for (let k = 0; k < 6; k++) blob(c, -4 + r(k + 11) * 8, -2 - r(k + 21) * 6, 0.7, 0.7, 'rgba(255,255,255,0.8)');
      break;
    }
    case 'mushroom': {
      c.fillStyle = '#f5f0e6';
      c.fillRect(-1.6, -8, 3.2, 8);
      c.beginPath();
      c.ellipse(0, -8, 7, 5, 0, Math.PI, 0);
      c.closePath();
      c.fillStyle = '#5eead4';
      c.shadowColor = '#5eead4';
      c.shadowBlur = 8;
      c.fill();
      c.shadowBlur = 0;
      c.strokeStyle = '#115e59';
      c.lineWidth = 0.8;
      c.stroke();
      blob(c, -2.5, -10, 1.1, 1.1, '#ccfbf1');
      blob(c, 2, -11, 0.9, 0.9, '#ccfbf1');
      break;
    }
    case 'tomb': {
      c.beginPath();
      c.moveTo(-6, 0);
      c.lineTo(-6, -11);
      c.arc(0, -11, 6, Math.PI, 0);
      c.lineTo(6, 0);
      c.closePath();
      c.fillStyle = '#6b6478';
      c.fill();
      c.strokeStyle = '#2a2433';
      c.lineWidth = 1;
      c.stroke();
      c.fillStyle = '#4a4356';
      c.fillRect(-0.8, -15, 1.6, 8);
      c.fillRect(-3, -12.5, 6, 1.6);
      blob(c, 4, -3, 2.5, 1.2, '#3f6b3a');
      break;
    }
    case 'deadtree': {
      trunk(c, 0, 0, 1, -26, 3, '#3d2f3f', '#1b141c');
      c.strokeStyle = '#3d2f3f';
      c.lineCap = 'round';
      for (const [x0, y0, x1, y1, w] of [
        [0, -16, -10, -26, 2],
        [1, -22, 9, -32, 1.8],
        [-6, -22, -9, -33, 1.2],
        [5, -27, 4, -36, 1.2],
      ]) {
        c.lineWidth = w!;
        c.beginPath();
        c.moveTo(x0!, y0!);
        c.lineTo(x1!, y1!);
        c.stroke();
      }
      break;
    }
    case 'pumpkin': {
      for (const x of [-4, 4, 0]) blob(c, x, -5, 5, 5, '#f97316', '#7c2d12', 0.8);
      c.fillStyle = '#365314';
      c.fillRect(-0.8, -12, 1.6, 3);
      c.fillStyle = '#ffd166';
      c.beginPath();
      c.moveTo(-3, -6);
      c.lineTo(-1.5, -8);
      c.lineTo(0, -6);
      c.moveTo(1, -6);
      c.lineTo(2.5, -8);
      c.lineTo(4, -6);
      c.fill();
      c.fillRect(-3, -3.6, 6, 1.2);
      break;
    }
    case 'barrel': {
      c.beginPath();
      c.roundRect(-6, -16, 12, 16, 2);
      const g = c.createLinearGradient(-6, 0, 6, 0);
      g.addColorStop(0, '#b91c1c');
      g.addColorStop(0.5, '#ef4444');
      g.addColorStop(1, '#7f1d1d');
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = '#450a0a';
      c.lineWidth = 1;
      c.stroke();
      c.fillStyle = '#450a0a';
      c.fillRect(-6, -12, 12, 1.2);
      c.fillRect(-6, -4.5, 12, 1.2);
      c.fillStyle = '#fde047';
      c.beginPath();
      c.moveTo(0, -10.5);
      c.lineTo(2.2, -7);
      c.lineTo(-2.2, -7);
      c.closePath();
      c.fill();
      break;
    }
    case 'tire': {
      blob(c, 0, -7, 8, 7, '#1f2937', '#030712');
      blob(c, 0, -7, 3.5, 3, '#6b7280');
      break;
    }
    case 'pipe': {
      c.fillStyle = '#64748b';
      c.strokeStyle = '#1e293b';
      c.lineWidth = 1;
      c.beginPath();
      c.roundRect(-3, -18, 6, 18, 1);
      c.fill();
      c.stroke();
      c.beginPath();
      c.roundRect(-3, -21, 14, 6, 1);
      c.fill();
      c.stroke();
      c.beginPath();
      c.roundRect(9, -22.5, 3, 9, 1);
      c.fill();
      c.stroke();
      break;
    }
  }
}
