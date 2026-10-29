/**
 * The eight critters, drawn as vector art (crisp at any zoom): each a different silhouette, palette
 * and face, with idle breathing, blinking, a walk cycle, eyes that follow the aim and the weapon in
 * hand. Drawn facing right with the feet at (0, 0) in world pixels; the caller flips and places it.
 */
import type { CharId } from '../characters';
import type { WeaponId } from '../weapons';

export interface Pose {
  /** Seconds, for breathing and blinking. */
  t: number;
  /** Walk cycle 0..1, or -1 standing still. */
  walk: number;
  air: boolean;
  /** Aim above the horizon, radians (eyes and weapon follow it). */
  look: number;
  /** The weapon in hand, or null. */
  weapon: WeaponId | null;
  /** 0..1: just got hurt (a red flash and a wince). */
  hurt: number;
  /** A per-unit offset so a crew doesn't blink in unison. */
  seed: number;
}

type Ctx = CanvasRenderingContext2D;

function ell(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function paint(c: Ctx, fill: string | CanvasGradient, line?: string, width = 1.1): void {
  c.fillStyle = fill;
  c.fill();
  if (line) {
    c.strokeStyle = line;
    c.lineWidth = width;
    c.stroke();
  }
}

/** A soft top-left lit gradient over a body centered at (x, y). */
function shade(c: Ctx, x: number, y: number, r: number, hi: string, lo: string): CanvasGradient {
  const g = c.createRadialGradient(x - r * 0.45, y - r * 0.5, r * 0.1, x, y, r * 1.25);
  g.addColorStop(0, hi);
  g.addColorStop(1, lo);
  return g;
}

/** Two eyes with pupils that look along the aim (or a blink). */
function eyes(c: Ctx, pts: [number, number][], r: number, p: Pose, iris?: string, line = '#1a1a1a'): void {
  const blink = (p.t * 0.9 + p.seed * 0.37) % 4.2 < 0.12 || p.hurt > 0.5;
  const lx = Math.cos(p.look) * r * 0.38;
  const ly = -Math.sin(p.look) * r * 0.38;
  for (const [x, y] of pts) {
    if (blink) {
      c.beginPath();
      c.moveTo(x - r * 0.8, y);
      c.quadraticCurveTo(x, y + r * 0.55, x + r * 0.8, y);
      c.strokeStyle = line;
      c.lineWidth = 0.9;
      c.stroke();
      continue;
    }
    ell(c, x, y, r, r * 1.08);
    paint(c, '#ffffff', line, 0.8);
    if (iris) {
      ell(c, x + lx, y + ly, r * 0.68, r * 0.68);
      paint(c, iris);
    }
    ell(c, x + lx * 1.15, y + ly * 1.15, r * 0.42, r * 0.46);
    paint(c, '#111111');
    ell(c, x + lx - r * 0.22, y + ly - r * 0.3, r * 0.17, r * 0.17);
    paint(c, '#ffffff');
  }
}

/** Two little feet that step while walking (and dangle in the air). */
function feet(c: Ctx, p: Pose, color: string, line: string, w = 3.2, spread = 4): void {
  const ph = p.walk >= 0 ? Math.sin(p.walk * Math.PI * 2) : 0;
  const lift = p.walk >= 0 ? Math.max(0, Math.cos(p.walk * Math.PI * 2)) : 0;
  const dy = p.air ? 1.5 : 0;
  ell(c, -spread + ph * 2.2, -1.1 - lift * 1.2 + dy, w, 1.6);
  paint(c, color, line, 0.9);
  ell(c, spread - ph * 2.2, -1.1 - (p.walk >= 0 ? Math.max(0, -Math.cos(p.walk * Math.PI * 2)) : 0) * 1.2 + dy, w, 1.6);
  paint(c, color, line, 0.9);
}

function scarf(c: Ctx, y: number, half: number, color: string, t: number): void {
  c.beginPath();
  c.moveTo(-half, y - 1.4);
  c.quadraticCurveTo(0, y + 0.6, half, y - 1.4);
  c.lineTo(half, y + 1.3);
  c.quadraticCurveTo(0, y + 3.2, -half, y + 1.3);
  c.closePath();
  paint(c, color, 'rgba(0,0,0,0.45)', 0.7);
  // the loose end flaps behind
  const flap = Math.sin(t * 6) * 1.2;
  c.beginPath();
  c.moveTo(-half + 1, y);
  c.quadraticCurveTo(-half - 3, y + 2 + flap, -half - 5.5, y + 4 + flap);
  c.lineTo(-half - 3.5, y + 5.5 + flap);
  c.quadraticCurveTo(-half - 1.5, y + 3, -half + 2.5, y + 1.8);
  c.closePath();
  paint(c, color, 'rgba(0,0,0,0.45)', 0.7);
}

const DRAW: Record<CharId, (c: Ctx, p: Pose, crew: string) => void> = {
  frog(c, p) {
    const line = '#1f5a2a';
    feet(c, p, '#4cc35c', line, 3.6, 4.6);
    ell(c, 0, -8, 10.5, 8);
    paint(c, shade(c, 0, -8, 10, '#9af0a2', '#38a84c'), line, 1.2);
    ell(c, 2.5, -5, 6.5, 4.4);
    paint(c, '#e7f8b0');
    for (const x of [-2.5, 5]) {
      ell(c, x, -15, 4.2, 4);
      paint(c, shade(c, x, -15, 4, '#a8f5ae', '#45b956'), line, 1.1);
    }
    eyes(c, [[-2.3, -15.3], [5.2, -15.3]], 2.7, p);
    c.beginPath();
    c.moveTo(1.5, -9.6);
    c.quadraticCurveTo(6, p.hurt > 0.3 ? -10.5 : -7, 10, -9.8);
    c.strokeStyle = line;
    c.lineWidth = 1;
    c.stroke();
    ell(c, 8.6, -11.5, 1.6, 1);
    paint(c, 'rgba(255,120,150,0.55)');
  },
  fox(c, p) {
    const line = '#6b2b02';
    const wag = Math.sin(p.t * 4 + p.seed) * 0.12;
    c.save();
    c.translate(-6, -7);
    c.rotate(-0.5 + wag);
    ell(c, -6, 0, 8, 4.2);
    paint(c, shade(c, -6, 0, 7, '#ffb065', '#e46a14'), line, 1.1);
    ell(c, -12, 0, 3, 2.8);
    paint(c, '#fff8ef');
    c.restore();
    feet(c, p, '#3b2416', '#1a0f08', 2.8, 3.8);
    ell(c, 0, -10, 8.5, 10);
    paint(c, shade(c, 0, -11, 9, '#ffb36b', '#e0651a'), line, 1.2);
    ell(c, 3.2, -6.5, 4.6, 6);
    paint(c, '#fff4e6');
    for (const [x0, x1, x2] of [
      [-5.5, -6.5, -0.8],
      [0.8, 3.6, 6],
    ]) {
      c.beginPath();
      c.moveTo(x0!, -17);
      c.lineTo(x1!, -26);
      c.lineTo(x2!, -18.5);
      c.closePath();
      paint(c, '#f07a24', line, 1.1);
      c.beginPath();
      c.moveTo(x1!, -26);
      c.lineTo((x0! + x1!) / 2 + 0.6, -22);
      c.lineTo((x1! + x2!) / 2 - 0.3, -22.3);
      c.closePath();
      paint(c, '#3b2416');
    }
    ell(c, 8.4, -11.3, 3.6, 2.6);
    paint(c, '#fff4e6', line, 0.9);
    ell(c, 11.3, -11.8, 1.3, 1.1);
    paint(c, '#1a1a1a');
    eyes(c, [[1.4, -14.6], [5.6, -14.8]], 2.2, p, '#5b3a10');
  },
  penguin(c, p, crew) {
    const line = '#0b1020';
    feet(c, p, '#ff9f1c', '#9a4d00', 3.2, 3.6);
    ell(c, -7.2, -9.5, 2.4, 6, 0.35 + Math.sin(p.t * 2) * 0.05);
    paint(c, '#1d2433', line, 1);
    ell(c, 0, -11, 8.5, 11);
    paint(c, shade(c, 0, -12, 10, '#46526b', '#161c29'), line, 1.2);
    ell(c, 2.6, -8.6, 5.6, 8);
    paint(c, shade(c, 2, -9, 7, '#ffffff', '#dfe5f0'));
    scarf(c, -12.2, 7.6, crew, p.t);
    eyes(c, [[2.2, -16.2], [6.2, -16.2]], 2.2, p);
    c.beginPath();
    c.moveTo(8.3, -14.2);
    c.lineTo(12.8, -12.6);
    c.lineTo(8.3, -11.4);
    c.closePath();
    paint(c, '#ffb020', '#9a4d00', 0.8);
  },
  robot(c, p, crew) {
    const line = '#273449';
    // treads
    c.beginPath();
    c.roundRect(-8.5, -4.2, 17, 4.6, 2.3);
    paint(c, '#2a3242', line, 1);
    const spin = p.walk >= 0 ? p.walk * Math.PI * 2 : 0;
    for (const x of [-5, 0, 5]) {
      ell(c, x, -1.9, 1.6, 1.6);
      paint(c, '#7b8799');
      c.beginPath();
      c.moveTo(x + Math.cos(spin) * 1.4, -1.9 + Math.sin(spin) * 1.4);
      c.lineTo(x - Math.cos(spin) * 1.4, -1.9 - Math.sin(spin) * 1.4);
      c.strokeStyle = '#2a3242';
      c.lineWidth = 0.6;
      c.stroke();
    }
    const glow = 0.6 + 0.4 * Math.sin(p.t * 5 + p.seed);
    c.beginPath();
    c.moveTo(-1, -21);
    c.lineTo(-2, -26);
    c.strokeStyle = '#64748b';
    c.lineWidth = 1;
    c.stroke();
    ell(c, -2, -26.6, 1.9, 1.9);
    paint(c, `rgba(94,234,212,${glow})`, '#0f766e', 0.6);
    c.beginPath();
    c.roundRect(-8, -21.5, 16, 17.5, 4);
    paint(c, shade(c, 0, -13, 11, '#f1f5f9', '#8b9bb3'), line, 1.2);
    c.beginPath();
    c.roundRect(-2.5, -18.4, 10, 8, 2);
    paint(c, '#0b1324', '#0f766e', 0.8);
    const lx = Math.cos(p.look) * 0.8;
    const ly = -Math.sin(p.look) * 0.9;
    const blink = (p.t * 0.9 + p.seed * 0.37) % 4.2 < 0.12;
    c.fillStyle = crew;
    c.shadowColor = crew;
    c.shadowBlur = 3;
    for (const x of [0, 4.6]) c.fillRect(x + lx, -15.6 + ly, 2.2, blink ? 0.6 : 2.6);
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(39,52,73,0.6)';
    for (const [x, y] of [
      [-6, -6],
      [6, -6],
      [-6, -19.5],
    ])
      c.fillRect(x!, y!, 1, 1);
    c.beginPath();
    c.roundRect(-5.5, -8.2, 6, 2.4, 1);
    paint(c, crew, line, 0.6);
  },
  slime(c, p) {
    const wob = Math.sin(p.t * 5 + p.seed) * 0.05 + (p.walk >= 0 ? Math.sin(p.walk * Math.PI * 4) * 0.08 : 0);
    c.save();
    c.scale(1 + wob, 1 - wob);
    c.beginPath();
    c.moveTo(-10.5, 0);
    c.bezierCurveTo(-12.5, -9, -6, -19, 0.5, -21);
    c.bezierCurveTo(6, -19, 12.5, -10, 10.5, 0);
    c.closePath();
    const g = c.createLinearGradient(0, -21, 0, 0);
    g.addColorStop(0, 'rgba(206,160,255,0.96)');
    g.addColorStop(1, 'rgba(126,58,224,0.96)');
    paint(c, g, '#4c1d95', 1.2);
    ell(c, -4.5, -14, 2.4, 3.6, 0.5);
    paint(c, 'rgba(255,255,255,0.65)');
    for (const [x, y, r] of [
      [-5, -5, 1.2],
      [6, -4, 0.9],
      [-1, -3, 0.7],
    ]) {
      ell(c, x!, y!, r!, r!);
      paint(c, 'rgba(255,255,255,0.35)');
    }
    eyes(c, [[1.2, -10.5], [6.4, -10.5]], 2.9, p, undefined, '#3b0f7a');
    c.beginPath();
    c.arc(4.2, -6.5, 1.6, 0.1, Math.PI - 0.1);
    c.strokeStyle = '#3b0f7a';
    c.lineWidth = 0.9;
    c.stroke();
    c.restore();
  },
  owl(c, p, crew) {
    const line = '#3a200b';
    feet(c, p, '#f59e0b', '#7c4a03', 2.6, 3.4);
    ell(c, 0, -11, 9, 11);
    paint(c, shade(c, 0, -12, 10, '#d39a5c', '#7a4a1f'), line, 1.2);
    ell(c, 2, -6.5, 5.2, 6);
    paint(c, '#ecd2a8');
    c.strokeStyle = 'rgba(122,74,31,0.6)';
    c.lineWidth = 0.7;
    for (const [x, y] of [
      [0, -8],
      [3.5, -8],
      [1.7, -5.5],
      [5, -5.5],
      [0, -3],
      [3.5, -3],
    ]) {
      c.beginPath();
      c.moveTo(x! - 1, y! - 0.6);
      c.lineTo(x!, y! + 0.4);
      c.lineTo(x! + 1, y! - 0.6);
      c.stroke();
    }
    ell(c, -6.5, -10, 2.8, 6.2, 0.25);
    paint(c, '#8a5426', line, 0.9);
    for (const [x0, x1] of [
      [-6, -3],
      [4, 7.5],
    ]) {
      c.beginPath();
      c.moveTo(x0!, -19);
      c.lineTo(x0! - 1 + (x1! - x0!) * 0.2, -24.5);
      c.lineTo(x1!, -20.5);
      c.closePath();
      paint(c, '#9a6230', line, 0.9);
    }
    for (const x of [1.1, 6.4]) {
      ell(c, x, -15.4, 3.7, 3.5);
      paint(c, '#f6e3c2', 'rgba(58,32,11,0.5)', 0.7);
    }
    eyes(c, [[1.1, -15.4], [6.4, -15.4]], 2.6, p, '#f59e0b');
    c.beginPath();
    c.moveTo(3, -13.4);
    c.lineTo(4.5, -13.4);
    c.lineTo(3.8, -10.8);
    c.closePath();
    paint(c, '#f59e0b', '#7c4a03', 0.6);
    scarf(c, -10.4, 7.2, crew, p.t);
  },
  bunny(c, p) {
    const line = '#8f3c63';
    const flop = Math.sin(p.t * 2.2 + p.seed) * 0.06;
    for (const [x, rot, len] of [
      [-2.5, -0.28 + flop, 7.2],
      [2.8, 0.12 - flop, 7.8],
    ]) {
      c.save();
      c.translate(x!, -18);
      c.rotate(rot!);
      ell(c, 0, -len!, 2.7, len!);
      paint(c, shade(c, 0, -len!, 4, '#ffffff', '#ecd9e4'), line, 1);
      ell(c, 0.3, -len! + 0.5, 1.2, len! - 2);
      paint(c, '#ffb3d1');
      c.restore();
    }
    ell(c, -8.6, -6, 3, 3);
    paint(c, '#ffffff', line, 0.8);
    feet(c, p, '#ffe3ef', line, 3.8, 3.8);
    ell(c, 0, -10, 8.5, 10);
    paint(c, shade(c, 0, -11, 9, '#ffffff', '#efd6e3'), line, 1.2);
    ell(c, 4, -7, 4.4, 5);
    paint(c, '#fff7fb');
    eyes(c, [[2.6, -14], [6.8, -14]], 2.2, p, '#7c2d5a');
    ell(c, 9.6, -11.6, 1.3, 1);
    paint(c, '#ff6fb5');
    c.fillStyle = '#ffffff';
    c.strokeStyle = line;
    c.lineWidth = 0.5;
    c.fillRect(8.2, -10.4, 1.6, 1.8);
    c.strokeRect(8.2, -10.4, 1.6, 1.8);
    ell(c, 7.2, -10.6, 1.8, 1.1);
    paint(c, 'rgba(255,111,181,0.45)');
  },
  duck(c, p) {
    const line = '#7a5a00';
    feet(c, p, '#ff8a1c', '#8a3f00', 3.6, 3.6);
    ell(c, 0, -9.5, 9.6, 9.2);
    paint(c, shade(c, 0, -10, 10, '#fff59a', '#f2b300'), line, 1.2);
    ell(c, -3.5, -8.5, 4.6, 3.4, -0.3 + Math.sin(p.t * 3 + p.seed) * 0.08);
    paint(c, '#f0b400', line, 0.8);
    c.beginPath();
    c.moveTo(-1, -18);
    c.quadraticCurveTo(-3, -22.5, 0.5, -22);
    c.quadraticCurveTo(-0.5, -20.5, 1.5, -18.5);
    paint(c, '#ffd84a', line, 0.8);
    eyes(c, [[2.6, -13.6], [6.2, -13.6]], 2.1, p);
    ell(c, 10.4, -10.4, 4.6, 2.1, 0.08);
    paint(c, '#ff8a1c', '#8a3f00', 0.8);
    c.beginPath();
    c.moveTo(7, -10.2);
    c.lineTo(14.2, -10);
    c.strokeStyle = '#8a3f00';
    c.lineWidth = 0.6;
    c.stroke();
  },
};

/** The weapon in hand, pointing right along the aim. */
export function drawWeapon(c: Ctx, w: WeaponId, t: number): void {
  switch (w) {
    case 'rocket':
      c.beginPath();
      c.roundRect(-3, -2.4, 17, 4.8, 1.2);
      paint(c, '#4d6b1f', '#1f2d0a', 0.9);
      c.fillStyle = '#e8d04a';
      c.fillRect(2, -2.4, 1.4, 4.8);
      c.fillRect(9, -2.4, 1.4, 4.8);
      c.beginPath();
      c.moveTo(14, -2);
      c.lineTo(17.5, 0);
      c.lineTo(14, 2);
      paint(c, '#e43d30', '#5c0f09', 0.6);
      break;
    case 'grenade':
      ell(c, 7, 0, 3.6, 3.8);
      paint(c, shade(c, 7, 0, 3.6, '#7fbf4a', '#2f5d17'), '#16300a', 0.8);
      c.fillStyle = '#9aa3ad';
      c.fillRect(6, -5, 2, 1.6);
      break;
    case 'splitter':
      c.beginPath();
      c.roundRect(2, -3.2, 10, 6.4, 2);
      paint(c, '#ff8a1f', '#7a3500', 0.8);
      c.fillStyle = '#2a1600';
      c.fillRect(5, -3.2, 1.2, 6.4);
      c.fillRect(8.4, -3.2, 1.2, 6.4);
      break;
    case 'zapper':
      c.beginPath();
      c.roundRect(-1, -2.4, 14, 4, 1.5);
      paint(c, '#c7d2fe', '#312e81', 0.8);
      c.beginPath();
      c.roundRect(0, 1, 3, 4, 1);
      paint(c, '#6366f1', '#312e81', 0.7);
      c.fillStyle = `rgba(103,232,249,${0.6 + 0.4 * Math.sin(t * 10)})`;
      c.fillRect(4, -1.4, 7, 1.6);
      break;
    case 'mallet':
      c.fillStyle = '#8b5a2b';
      c.fillRect(-1, -0.9, 13, 1.8);
      c.beginPath();
      c.roundRect(11, -4.8, 6.5, 9.6, 1.8);
      paint(c, shade(c, 14, 0, 5, '#fbbf24', '#b45309'), '#5a2d02', 0.8);
      break;
    case 'dynamite':
      c.beginPath();
      c.roundRect(2, -2, 9, 4, 1);
      paint(c, '#dc2626', '#5c0b0b', 0.8);
      c.beginPath();
      c.moveTo(11, 0);
      c.quadraticCurveTo(13, -2, 14, -3);
      c.strokeStyle = '#3b2a18';
      c.lineWidth = 0.7;
      c.stroke();
      ell(c, 14.2, -3.3, 1 + Math.sin(t * 20) * 0.4, 1 + Math.sin(t * 20) * 0.4);
      paint(c, '#ffe066');
      break;
    case 'meteor':
      c.beginPath();
      c.roundRect(2, -3.5, 6, 7, 1.2);
      paint(c, '#334155', '#0f172a', 0.8);
      c.beginPath();
      c.moveTo(6.5, -3.5);
      c.lineTo(8, -8);
      c.strokeStyle = '#0f172a';
      c.lineWidth = 0.8;
      c.stroke();
      ell(c, 5, -1.2, 1, 1);
      paint(c, Math.sin(t * 8) > 0 ? '#ef4444' : '#7f1d1d');
      break;
  }
}

/** A critter, its weapon and its hurt flash. */
export function drawCritter(c: Ctx, char: CharId, crew: string, p: Pose): void {
  const breathe = p.walk >= 0 || p.air ? 0 : Math.sin(p.t * 2.6 + p.seed) * 0.025;
  const bob = p.walk >= 0 ? Math.abs(Math.sin(p.walk * Math.PI * 2)) * 1.1 : 0;
  c.save();
  c.translate(0, -bob);
  c.scale(1 - breathe * 0.5, 1 + breathe);
  if (p.hurt > 0) c.filter = `brightness(${1 + p.hurt * 0.6}) saturate(${1 + p.hurt})`;
  DRAW[char](c, p, crew);
  c.filter = 'none';
  if (p.weapon) {
    c.save();
    c.translate(3, -9.5);
    c.rotate(-p.look);
    drawWeapon(c, p.weapon, p.t);
    c.restore();
  }
  c.restore();
}

/** A knocked-out critter's gravestone, with a ribbon in its crew color. */
export function drawGrave(c: Ctx, crew: string): void {
  c.beginPath();
  c.moveTo(-7, 0);
  c.lineTo(-7, -12);
  c.arc(0, -12, 7, Math.PI, 0);
  c.lineTo(7, 0);
  c.closePath();
  paint(c, shade(c, 0, -10, 9, '#d6d9e0', '#7d8494'), '#3b4150', 1.1);
  c.fillStyle = crew;
  c.fillRect(-7, -9, 14, 2.6);
  c.fillStyle = '#3b4150';
  c.font = 'bold 4.6px system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText('RIP', 0, -12.5);
  ell(c, 0, 0.3, 8.5, 1.4);
  paint(c, 'rgba(0,0,0,0.25)');
}
