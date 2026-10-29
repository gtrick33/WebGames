/**
 * The arsenal as cartoon props: the weapon in a critter's hands and the shells in flight. Bold ink
 * outlines, candy colors and a face on anything with a personality (the rocket peeks out of its
 * launcher, grenades scowl, meteors are furious). Drawn around (0, 0) in world pixels, pointing
 * right; the caller places and turns them.
 */
import type { ProjKind } from '../sim';
import type { WeaponId } from '../weapons';
import { ell, faceEyes, INK, paint, shade, star, tube } from './paint';

type Ctx = CanvasRenderingContext2D;

/** A fizzing fuse spark: a flickering two-color star. */
function spark(c: Ctx, x: number, y: number, t: number, size = 1): void {
  const f = 0.75 + 0.35 * Math.sin(t * 37) + 0.15 * Math.sin(t * 61);
  star(c, x, y, 3.4 * f * size, 1.1 * size, 5, t * 9);
  paint(c, '#ffd23f');
  star(c, x, y, 1.8 * f * size, 0.7 * size, 4, -t * 7);
  paint(c, '#ffffff');
}

/** A short curly fuse from (x0, y0) to its spark. */
function fuse(c: Ctx, x0: number, y0: number, x1: number, y1: number, t: number, size = 1): void {
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo(x0 + (x1 - x0) * 0.2, y1 + 1, x1, y1);
  c.strokeStyle = INK;
  c.lineWidth = 1.5 * size;
  c.stroke();
  c.strokeStyle = '#e9c08a';
  c.lineWidth = 0.7 * size;
  c.stroke();
  spark(c, x1, y1, t, size);
}

/** A round grenade with a scowl. */
function grenadeBody(c: Ctx, x: number, y: number, r: number, t: number, lit: boolean): void {
  c.beginPath();
  c.roundRect(x - r * 0.38, y - r - r * 0.42, r * 0.76, r * 0.55, r * 0.12);
  paint(c, '#a7b1cc', INK, 0.9);
  c.beginPath();
  c.arc(x + r * 0.62, y - r * 1.2, r * 0.36, 0, Math.PI * 2);
  c.strokeStyle = INK;
  c.lineWidth = 1.2;
  c.stroke();
  c.strokeStyle = '#ffd23f';
  c.lineWidth = 0.6;
  c.stroke();
  ell(c, x, y, r, r);
  paint(c, shade(c, x, y, r, '#c8ff7a', '#3fae2a'), INK, 1.1);
  // pineapple grooves
  c.strokeStyle = 'rgba(25,80,20,0.5)';
  c.lineWidth = 0.6;
  for (const k of [-0.45, 0.45]) {
    c.beginPath();
    c.ellipse(x + k * r * 0.9, y, r * 0.35, r * 0.95, 0, -Math.PI / 2, Math.PI / 2, k < 0);
    c.stroke();
  }
  faceEyes(c, x - r * 0.15, y - r * 0.12, r * 0.24, true);
  c.beginPath();
  c.arc(x + r * 0.1, y + r * 0.42, r * 0.28, Math.PI * 1.1, Math.PI * 1.9);
  c.strokeStyle = INK;
  c.lineWidth = 0.7;
  c.stroke();
  if (lit && Math.sin(t * 14) > 0) {
    ell(c, x, y - r - r * 0.5, r * 0.22, r * 0.22);
    paint(c, '#ff4d4d');
  }
}

/** Three red sticks with a yellow band. */
function dynamiteBody(c: Ctx, x: number, y: number, t: number, s = 1): void {
  for (const dy of [-3.1, 0, 3.1]) {
    c.beginPath();
    c.roundRect(x - 6 * s, y + (dy - 1.55) * s, 12 * s, 3.1 * s, 1.4 * s);
    paint(c, tube(c, y + (dy - 1.55) * s, y + (dy + 1.55) * s, '#ff8a8a', '#ef3b3b', '#a3121b'), INK, 0.9);
  }
  c.beginPath();
  c.roundRect(x - 1.5 * s, y - 5 * s, 3 * s, 10 * s, 0.6 * s);
  paint(c, '#ffd23f', INK, 0.8);
  fuse(c, x + 6 * s, y - 2.5 * s, x + 9.5 * s, y - 7.5 * s, t, s);
}

/** The weapon held by a critter, pointing right along the aim. */
export function drawWeapon(c: Ctx, w: WeaponId, t: number): void {
  switch (w) {
    case 'rocket': {
      // grip and sight
      c.beginPath();
      c.roundRect(2, 2, 3, 5, 1);
      paint(c, '#3a3f63', INK, 0.9);
      c.beginPath();
      c.roundRect(5, -6.2, 3.2, 2.8, 0.8);
      paint(c, '#3a3f63', INK, 0.8);
      // the launcher tube
      c.beginPath();
      c.moveTo(-6, -3);
      c.lineTo(-9.5, -4.8);
      c.lineTo(-9.5, 4.8);
      c.lineTo(-6, 3);
      c.closePath();
      paint(c, '#3a3f63', INK, 0.9);
      c.beginPath();
      c.roundRect(-6.5, -3.8, 22, 7.6, 3);
      paint(c, tube(c, -3.8, 3.8, '#ff9aa8', '#f2385a', '#a8123a'), INK, 1.1);
      c.fillStyle = '#ffd23f';
      c.fillRect(-2, -3.3, 2.2, 6.6);
      c.fillRect(8.5, -3.3, 2.2, 6.6);
      c.beginPath();
      c.roundRect(-4, -2.9, 17, 1.4, 0.7);
      paint(c, 'rgba(255,255,255,0.55)');
      c.beginPath();
      c.roundRect(15, -4.8, 3.6, 9.6, 1.5);
      paint(c, '#3a3f63', INK, 1);
      // the rocket peeking out, eyes and all
      c.beginPath();
      c.arc(18.6, 0, 3.1, -Math.PI / 2, Math.PI / 2);
      c.closePath();
      paint(c, '#4cc9ff', INK, 0.9);
      faceEyes(c, 17.9, -0.6, 0.75);
      break;
    }
    case 'grenade':
      grenadeBody(c, 8.5, 0, 5, t, false);
      break;
    case 'splitter': {
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(3, s * 3);
        c.lineTo(-1.5, s * 7);
        c.lineTo(1, s * 1);
        c.closePath();
        paint(c, '#ff6fb5', INK, 0.9);
      }
      c.beginPath();
      c.roundRect(0.5, -4.6, 15, 9.2, 4.6);
      paint(c, tube(c, -4.6, 4.6, '#dcb6ff', '#9b5cff', '#5b21b6'), INK, 1.1);
      for (const [x, y] of [
        [4, -1.6],
        [8, 1.8],
        [11.6, -1.4],
      ]) {
        ell(c, x!, y!, 1.35, 1.35);
        paint(c, '#ffe14d', INK, 0.5);
      }
      c.beginPath();
      c.roundRect(3, -3.6, 9, 1.2, 0.6);
      paint(c, 'rgba(255,255,255,0.5)');
      fuse(c, 12.5, -4, 15, -8, t, 0.8);
      break;
    }
    case 'zapper': {
      c.beginPath();
      c.moveTo(1.5, 1.5);
      c.lineTo(5, 1.5);
      c.lineTo(3, 8);
      c.lineTo(-0.5, 8);
      c.closePath();
      paint(c, '#7c3aed', INK, 0.9);
      c.beginPath();
      c.moveTo(-1, -2);
      c.lineTo(-5, -6.5);
      c.lineTo(1.5, -3.6);
      c.closePath();
      paint(c, '#ff4fa3', INK, 0.9);
      ell(c, 5, -0.6, 7.6, 4.2);
      paint(c, tube(c, -4.8, 3.6, '#ccfff5', '#2dd4bf', '#0f766e'), INK, 1.1);
      c.beginPath();
      c.roundRect(11, -2.2, 7.5, 3.4, 1.5);
      paint(c, '#e2e8f0', INK, 0.9);
      for (const x of [12.6, 15.2]) {
        c.beginPath();
        c.roundRect(x, -3.2, 1.5, 5.4, 0.7);
        paint(c, '#ff4fa3', INK, 0.6);
      }
      const glow = 0.55 + 0.45 * Math.sin(t * 10);
      c.save();
      c.shadowColor = '#67e8f9';
      c.shadowBlur = 6;
      ell(c, 19.4, -0.5, 1.9, 1.9);
      paint(c, `rgba(165,243,252,${0.6 + glow * 0.4})`, INK, 0.7);
      ell(c, 4.6, -4.9, 1.7, 1.7);
      paint(c, `rgba(165,243,252,${0.5 + glow * 0.5})`, INK, 0.6);
      c.restore();
      c.beginPath();
      c.roundRect(1, -3.4, 7, 1.2, 0.6);
      paint(c, 'rgba(255,255,255,0.6)');
      break;
    }
    case 'mallet': {
      c.beginPath();
      c.roundRect(-2, -1.3, 15, 2.6, 1.2);
      paint(c, tube(c, -1.3, 1.3, '#f0b878', '#c98b4a', '#7a4b1e'), INK, 0.9);
      c.beginPath();
      c.roundRect(11.5, -7.5, 10, 15, 3);
      paint(c, tube(c, -7.5, 7.5, '#ff9b9b', '#ff4d5e', '#b3122e'), INK, 1.2);
      for (const y of [-7.5, 4.6]) {
        c.beginPath();
        c.roundRect(11.5, y, 10, 2.9, 1.2);
        paint(c, '#ffd23f', INK, 0.9);
      }
      ell(c, 14.2, -2.4, 1.2, 2.6);
      paint(c, 'rgba(255,255,255,0.65)');
      break;
    }
    case 'dynamite':
      dynamiteBody(c, 8, -1, t, 0.9);
      break;
    case 'meteor': {
      c.beginPath();
      c.moveTo(7.5, -5);
      c.lineTo(9.5, -11.5);
      c.strokeStyle = INK;
      c.lineWidth = 1.3;
      c.stroke();
      ell(c, 9.6, -12, 1.5, 1.5);
      paint(c, Math.sin(t * 8) > 0 ? '#ff3b3b' : '#ffd23f', INK, 0.6);
      c.beginPath();
      c.roundRect(1, -5.5, 9, 12, 2.4);
      paint(c, tube(c, -5.5, 6.5, '#b3a6ff', '#6d5dfc', '#3b2fb0'), INK, 1.1);
      c.beginPath();
      c.roundRect(2.6, -3.8, 5.8, 3.4, 0.9);
      paint(c, '#a5f3fc', INK, 0.6);
      ell(c, 5.5, 2.8, 2, 2);
      paint(c, shade(c, 5.5, 2.8, 2, '#ff9a9a', '#e11d48'), INK, 0.7);
      break;
    }
  }
}

/** A shell in flight (or resting), drawn at (0, 0). `vx`, `vy` turn the ones that fly nose first. */
export function drawShell(c: Ctx, kind: ProjKind, vx: number, vy: number, age: number, rest: boolean, t: number): void {
  switch (kind) {
    case 'rocket': {
      c.rotate(Math.atan2(vy, vx));
      // a flickering flame out the back
      const f = 1 + 0.25 * Math.sin(t * 50) + 0.15 * Math.sin(t * 23);
      c.beginPath();
      c.moveTo(-8, -3.4);
      c.quadraticCurveTo(-14 * f, -3, -19 * f, 0);
      c.quadraticCurveTo(-14 * f, 3, -8, 3.4);
      c.closePath();
      paint(c, '#ff7a1a');
      c.beginPath();
      c.moveTo(-8, -2);
      c.quadraticCurveTo(-11 * f, -1.6, -14 * f, 0);
      c.quadraticCurveTo(-11 * f, 1.6, -8, 2);
      c.closePath();
      paint(c, '#ffe14d');
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(-3, s * 3);
        c.lineTo(-9, s * 7.5);
        c.lineTo(-8.5, s * 2);
        c.closePath();
        paint(c, '#ffd23f', INK, 1);
      }
      c.beginPath();
      c.roundRect(-9, -3.8, 16, 7.6, 3.8);
      paint(c, tube(c, -3.8, 3.8, '#ff9aa8', '#f2385a', '#a8123a'), INK, 1.1);
      c.beginPath();
      c.moveTo(6, -3.8);
      c.quadraticCurveTo(14, -2.6, 14.5, 0);
      c.quadraticCurveTo(14, 2.6, 6, 3.8);
      c.closePath();
      paint(c, shade(c, 9, 0, 4, '#b8ecff', '#2fa8e8'), INK, 1.1);
      c.beginPath();
      c.roundRect(-6, -2.9, 11, 1.3, 0.6);
      paint(c, 'rgba(255,255,255,0.55)');
      faceEyes(c, 0.5, -0.6, 1.35);
      break;
    }
    case 'splitter': {
      c.rotate(Math.atan2(vy, vx));
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(-3, s * 3.4);
        c.lineTo(-9.5, s * 7.5);
        c.lineTo(-7.5, s * 1.5);
        c.closePath();
        paint(c, '#ff6fb5', INK, 1);
      }
      c.beginPath();
      c.roundRect(-8.5, -4.6, 18, 9.2, 4.6);
      paint(c, tube(c, -4.6, 4.6, '#dcb6ff', '#9b5cff', '#5b21b6'), INK, 1.2);
      for (const [x, y] of [
        [-4.5, -1.6],
        [0, 1.9],
        [4.5, -1.4],
      ]) {
        ell(c, x!, y!, 1.45, 1.45);
        paint(c, '#ffe14d', INK, 0.5);
      }
      c.beginPath();
      c.roundRect(-5, -3.6, 10, 1.2, 0.6);
      paint(c, 'rgba(255,255,255,0.5)');
      break;
    }
    case 'grenade':
      c.rotate(age * 0.2 * Math.sign(vx || 1));
      grenadeBody(c, 0, 0, 4.6, t, true);
      break;
    case 'bomblet': {
      c.rotate(age * 0.3 * Math.sign(vx || 1));
      ell(c, 0, 0, 3.4, 3.4);
      paint(c, shade(c, 0, 0, 3.4, '#e4c8ff', '#7c3aed'), INK, 1);
      ell(c, 1, -0.6, 1.2, 1.2);
      paint(c, '#ffe14d', INK, 0.4);
      spark(c, 0, -4.4, t + age * 0.1, 0.55);
      break;
    }
    case 'dynamite':
      c.rotate(rest ? 0 : age * 0.15);
      dynamiteBody(c, 0, -1, t, 0.85);
      break;
    case 'meteor': {
      // a flaming tail along the fall, then the angry rock on top (not turned, so its face stays up)
      const a = Math.atan2(vy, vx);
      const f = 1 + 0.18 * Math.sin(t * 30 + age);
      c.save();
      c.rotate(a);
      for (const [len, wid, col] of [
        [34, 8.5, '#ff4d2e'],
        [26, 6.4, '#ff9a1f'],
        [17, 4.2, '#ffe14d'],
      ] as const) {
        c.beginPath();
        c.moveTo(2, -wid);
        c.quadraticCurveTo(-len * 0.5 * f, -wid * 0.8, -len * f, 0);
        c.quadraticCurveTo(-len * 0.5 * f, wid * 0.8, 2, wid);
        c.closePath();
        paint(c, col);
      }
      c.restore();
      c.beginPath();
      for (let i = 0; i < 9; i++) {
        const k = (i / 9) * Math.PI * 2;
        const r = 7 + (i % 3 === 0 ? 0.9 : i % 2 ? -0.5 : 0.3);
        if (i) c.lineTo(Math.cos(k) * r, Math.sin(k) * r);
        else c.moveTo(Math.cos(k) * r, Math.sin(k) * r);
      }
      c.closePath();
      paint(c, shade(c, 0, 0, 7, '#c98a5e', '#6b3f26'), INK, 1.2);
      for (const [x, y, r] of [
        [-3.5, 2.8, 1.5],
        [3.6, 3.2, 1.1],
        [-4.2, -3, 0.9],
      ]) {
        ell(c, x!, y!, r!, r!);
        paint(c, 'rgba(60,30,15,0.45)');
      }
      faceEyes(c, -2.4, -1, 1.5, true);
      c.beginPath();
      c.moveTo(-1.8, 3.2);
      c.quadraticCurveTo(0, 2.2, 1.8, 3.2);
      c.strokeStyle = INK;
      c.lineWidth = 0.9;
      c.stroke();
      break;
    }
  }
}
