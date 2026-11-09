import * as THREE from 'three';
import { ARENA_H, ARENA_W, ENTRY_W, ENTRY_Y0, ENTRY_Y1, type Pillar, type RingMap } from '../arena/maps';
import { TILE } from '../sim/map';
import { LIGHT } from './toon';

/**
 * The floor of a ring, painted once when the match begins: what the feet of a hundred fights have done to it, under
 * the stone that stands on it. Only ever looks: where a fighter can walk is the map's business.
 */

/** Pixels of paint to one of the world's. */
const INK = 2.8;
const MID = { x: ARENA_W / 2, y: ARENA_H / 2 };

export const seeded = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type G = CanvasRenderingContext2D;
type Rand = () => number;

/** The same color with nothing of it showing (a gradient fades through its far end's color: 'transparent' is black). */
const none = (hex: string): string => {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0)`;
};

function blot(g: G, x: number, y: number, r: number, color: string, alpha: number): void {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, none(color));
  g.globalAlpha = alpha;
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.globalAlpha = 1;
}

function blots(g: G, rand: Rand, n: number, r0: number, r1: number, color: string, alpha: number): void {
  for (let i = 0; i < n; i++) blot(g, rand() * ARENA_W, rand() * ARENA_H, r0 + rand() * (r1 - r0), color, alpha);
}

function specks(g: G, rand: Rand, n: number, size: number, colors: string[], alpha: number): void {
  g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length]!;
    const s = size * (0.5 + rand());
    g.fillRect(rand() * ARENA_W, rand() * ARENA_H, s, s);
  }
  g.globalAlpha = 1;
}

/** A soft dark edge where something stands on the ground. */
function foot(g: G, x: number, y: number, w: number, h: number, reach: number, alpha: number, color = '#160d10'): void {
  g.strokeStyle = color;
  g.lineJoin = 'round';
  const n = 7;
  g.globalAlpha = alpha / n;
  for (let i = 1; i <= n; i++) {
    g.lineWidth = (reach * 2 * i) / n;
    g.strokeRect(x, y, w, h);
  }
  g.globalAlpha = 1;
}

/** The foot of everything that stands: walls harder than the south one, whose bottom the camera can hardly see. */
function feet(g: G, map: RingMap, alpha: number, color?: string): void {
  for (const p of map.pillars) foot(g, p.x, p.y, p.w, p.h, p.wall ? 10 : 9, alpha, color);
  foot(g, -8, -8, ARENA_W + 16, 8, 16, alpha, color);
  foot(g, -8, ARENA_H, ARENA_W + 16, 8, 7, alpha * 0.5, color);
}

const scratch = (g: G, x: number, y: number, a: number, len: number, bend: number): void => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + c * len * 0.5 - s * bend, y + s * len * 0.5 + c * bend, x + c * len, y + s * len);
  g.stroke();
};

/** A line that wanders from a to b. */
function wander(g: G, rand: Rand, x0: number, y0: number, x1: number, y1: number, steps: number, wob: number): void {
  g.beginPath();
  g.moveTo(x0, y0);
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const j = i === steps ? 0 : wob;
    g.lineTo(x0 + (x1 - x0) * k + (rand() - 0.5) * j, y0 + (y1 - y0) * k + (rand() - 0.5) * j);
  }
  g.stroke();
}

/** The team's own ground, in front of its gate. */
function colors(g: G, rand: Rand, alpha: number, rough = 1): void {
  const paint = (cx: number, dir: number, color: string): void => {
    g.save();
    g.beginPath();
    g.rect(dir > 0 ? cx : cx - 90, ENTRY_Y0 - 30, 90, ENTRY_Y1 - ENTRY_Y0 + 60);
    g.clip();
    g.strokeStyle = color;
    g.fillStyle = color;
    // the ground before the gate and three arcs walking out of it, worn through in patches
    g.globalAlpha = alpha * 0.55;
    g.beginPath();
    g.arc(cx, MID.y, 34, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = alpha;
    g.lineWidth = 2.4;
    for (const r of [38, 46, 54]) {
      g.setLineDash([12 + rand() * 8, 3 + rand() * 4 * rough]);
      g.beginPath();
      g.arc(cx, MID.y, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.setLineDash([]);
    g.restore();
    g.globalAlpha = 1;
  };
  paint(ENTRY_W, 1, '#3f7fe0');
  paint(ARENA_W - ENTRY_W, -1, '#e04848');
  // the entries themselves
  g.globalAlpha = alpha * 0.8;
  g.fillStyle = '#3f7fe0';
  g.fillRect(0, ENTRY_Y0, ENTRY_W, ENTRY_Y1 - ENTRY_Y0);
  g.fillStyle = '#e04848';
  g.fillRect(ARENA_W - ENTRY_W, ENTRY_Y0, ENTRY_W, ENTRY_Y1 - ENTRY_Y0);
  g.globalAlpha = 1;
}

/* ------------------------------------------------------------------ the sands */

function paintSands(g: G, map: RingMap, rand: Rand): void {
  g.fillStyle = '#dcc08c';
  g.fillRect(0, 0, ARENA_W, ARENA_H);
  blots(g, rand, 60, 30, 90, '#c6a26c', 0.34);
  blots(g, rand, 50, 24, 70, '#efdcb0', 0.36);
  // what the wind leaves: long ripples, lit on one side
  for (let i = 0; i < 74; i++) {
    const y0 = rand() * ARENA_H;
    const x0 = rand() * ARENA_W - 60;
    const len = 60 + rand() * 150;
    const amp = 1.5 + rand() * 3;
    const f = 0.03 + rand() * 0.04;
    const ph = rand() * 9;
    for (const [dy, c, a] of [[0, '#a98657', 0.2], [1, '#f6e8c6', 0.26]] as const) {
      g.strokeStyle = c;
      g.globalAlpha = a;
      g.lineWidth = 0.7;
      g.beginPath();
      for (let x = 0; x <= len; x += 8) {
        const yy = y0 + dy + Math.sin(x * f + ph) * amp + x * 0.05;
        if (x === 0) g.moveTo(x0 + x, yy);
        else g.lineTo(x0 + x, yy);
      }
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  // an old sun of red stone let into the middle, the sand drifting back over it
  g.save();
  g.translate(MID.x, MID.y);
  g.scale(1, 0.92);
  g.strokeStyle = '#7d4f35';
  g.lineWidth = 8;
  g.globalAlpha = 0.72;
  g.beginPath();
  g.arc(0, 0, 66, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = '#a5684a';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 66, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 1.6;
  g.strokeStyle = '#7d4f35';
  g.beginPath();
  g.arc(0, 0, 54, 0, Math.PI * 2);
  g.stroke();
  // (the joints between its stones)
  g.strokeStyle = '#4e2f20';
  g.lineWidth = 0.9;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * 62, Math.sin(a) * 62);
    g.lineTo(Math.cos(a) * 70, Math.sin(a) * 70);
    g.stroke();
  }
  g.fillStyle = '#8c5a3c';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.save();
    g.rotate(a);
    g.globalAlpha = 0.62;
    g.beginPath();
    g.moveTo(25, -4);
    g.lineTo(i % 2 ? 44 : 50, 0);
    g.lineTo(25, 4);
    g.closePath();
    g.fill();
    g.restore();
  }
  g.globalAlpha = 0.66;
  g.fillStyle = '#9a6444';
  g.beginPath();
  g.arc(0, 0, 21, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#d7a26c';
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(0, 0, 16, 0, Math.PI * 2);
  g.stroke();
  g.restore();
  g.globalAlpha = 1;
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const r = 18 + rand() * 60;
    blot(g, MID.x + Math.cos(a) * r, MID.y + Math.sin(a) * r * 0.92, 10 + rand() * 18, '#dcc08c', 0.8);
  }
  colors(g, rand, 0.3);
  // boots: where the fighting goes, the sand is churned darker
  g.lineCap = 'round';
  g.strokeStyle = '#7d5f3d';
  for (let i = 0; i < 150; i++) {
    const a = rand() * Math.PI * 2;
    const r = 30 + rand() * 210;
    g.globalAlpha = 0.08 + rand() * 0.14;
    g.lineWidth = 0.8 + rand() * 1.8;
    scratch(g, MID.x + Math.cos(a) * r, MID.y + Math.sin(a) * r * 0.5, rand() * 6.3, 6 + rand() * 12, (rand() - 0.5) * 6);
  }
  // a line of footprints crossing the ground
  g.fillStyle = '#8a6b46';
  for (let t = 0; t < 12; t++) {
    let x = rand() * ARENA_W;
    let y = rand() * ARENA_H;
    let a = rand() * 6.3;
    for (let i = 0; i < 14; i++) {
      a += (rand() - 0.5) * 0.35;
      x += Math.cos(a) * 6;
      y += Math.sin(a) * 6;
      const side = i % 2 ? 1.7 : -1.7;
      g.globalAlpha = 0.28;
      g.beginPath();
      g.ellipse(x - Math.sin(a) * side, y + Math.cos(a) * side, 1.7, 1, a, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  // what falls in a ring and gets raked over
  for (let i = 0; i < 9; i++) {
    const x = 60 + rand() * (ARENA_W - 120);
    const y = 20 + rand() * (ARENA_H - 40);
    blot(g, x, y, 8 + rand() * 9, '#6f3a2a', 0.34);
    for (let k = 0; k < 7; k++) blot(g, x + (rand() - 0.5) * 34, y + (rand() - 0.5) * 22, 1 + rand() * 2.5, '#6f3a2a', 0.5);
  }
  // pebbles
  for (let i = 0; i < 90; i++) {
    const x = rand() * ARENA_W;
    const y = rand() * ARENA_H;
    const r = 0.6 + rand() * 1.5;
    g.fillStyle = '#8f7450';
    g.beginPath();
    g.ellipse(x, y + 0.5, r, r * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e9d8b4';
    g.beginPath();
    g.ellipse(x - 0.2, y, r * 0.8, r * 0.5, 0, 0, Math.PI * 2);
    g.fill();
  }
  // the kerb of cut stone round the whole of it
  const kerb = (x: number, y: number, w: number, h: number): void => {
    const along = w > h;
    const len = along ? w : h;
    let at = 0;
    while (at < len) {
      const step = 13 + rand() * 12;
      const shade = ['#b89a70', '#ad8f66', '#c4a67c', '#a48760'][Math.floor(rand() * 4)]!;
      g.fillStyle = shade;
      if (along) g.fillRect(x + at, y, Math.min(step, len - at) - 0.7, h);
      else g.fillRect(x, y + at, w, Math.min(step, len - at) - 0.7);
      at += step;
    }
  };
  kerb(0, 0, ARENA_W, 10);
  kerb(0, ARENA_H - 7, ARENA_W, 7);
  // drifts against the old stone
  for (const p of map.pillars) {
    if (p.wall) continue;
    for (let i = 0; i < 9; i++) blot(g, p.x + p.w * rand(), p.y + p.h + 3 + rand() * 6, 8 + rand() * 9, '#f1dfb6', 0.55);
  }
  feet(g, map, 0.42, '#3a2414');
  specks(g, rand, 2600, 0.7, ['#8d6f49', '#f7ecd0', '#b0926a'], 0.35);
}

/* ------------------------------------------------------------------ the mere */

function crack(g: G, rand: Rand, x: number, y: number, a: number, len: number, depth: number): void {
  let cx = x;
  let cy = y;
  const steps = Math.ceil(len / 9);
  const pts: [number, number][] = [[cx, cy]];
  for (let i = 0; i < steps; i++) {
    a += (rand() - 0.5) * 0.9;
    cx += Math.cos(a) * 9;
    cy += Math.sin(a) * 9;
    pts.push([cx, cy]);
    if (depth > 0 && rand() < 0.28) crack(g, rand, cx, cy, a + (rand() < 0.5 ? 1 : -1) * (0.5 + rand() * 0.7), len * 0.45, depth - 1);
  }
  const line = (color: string, w: number, dy: number, alpha: number): void => {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.globalAlpha = alpha;
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py + dy) : g.moveTo(px, py + dy)));
    g.stroke();
  };
  // the crack's depth under the ice, and its bright lip
  line('#2f6a9c', 1.3, 0.9, 0.42);
  line('#ffffff', depth > 1 ? 0.8 : 0.55, 0, 0.7);
  g.globalAlpha = 1;
}

function paintMere(g: G, map: RingMap, rand: Rand): void {
  g.fillStyle = '#9fd0ec';
  g.fillRect(0, 0, ARENA_W, ARENA_H);
  blots(g, rand, 40, 34, 90, '#6fa9d6', 0.34);
  blots(g, rand, 44, 26, 80, '#d6f0fb', 0.42);
  // what the ice holds: an old sea-serpent's bones, a long way down
  g.lineCap = 'round';
  const spine: [number, number][] = [];
  for (let i = 0; i <= 44; i++) {
    const k = i / 44;
    spine.push([70 + k * 408, 188 - k * 128 + Math.sin(k * 8) * 32]);
  }
  g.strokeStyle = '#3f7bb0';
  spine.forEach(([x, y], i) => {
    const next = spine[Math.min(i + 1, spine.length - 1)]!;
    const a = Math.atan2(next[1] - y, next[0] - x);
    const k = i / spine.length;
    const size = (1 - Math.abs(k - 0.42)) * 24;
    g.globalAlpha = 0.34;
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(x - Math.cos(a) * 3, y - Math.sin(a) * 3);
    g.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3);
    g.stroke();
    g.lineWidth = 1.3;
    g.globalAlpha = 0.26;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x - Math.sin(a) * side * size * 0.8, y + Math.cos(a) * side * size * 0.8, x - Math.sin(a) * side * size + Math.cos(a) * -6, y + Math.cos(a) * side * size + Math.sin(a) * -6);
      g.stroke();
    }
  });
  // its skull
  const head = spine[spine.length - 1]!;
  g.globalAlpha = 0.34;
  g.fillStyle = '#3f7bb0';
  g.beginPath();
  g.ellipse(head[0] + 10, head[1] - 4, 16, 9, -0.35, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#9fd0ec';
  g.beginPath();
  g.ellipse(head[0] + 13, head[1] - 7, 3, 2, -0.35, 0, Math.PI * 2);
  g.fill();
  // and the fish that came to look
  g.fillStyle = '#34709f';
  for (let i = 0; i < 16; i++) {
    const x = rand() * ARENA_W;
    const y = rand() * ARENA_H;
    const a = rand() * 6.3;
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.globalAlpha = 0.3;
    g.beginPath();
    g.ellipse(0, 0, 5, 1.7, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(-4, 0);
    g.lineTo(-8, -2);
    g.lineTo(-8, 2);
    g.closePath();
    g.fill();
    g.restore();
  }
  g.globalAlpha = 1;
  // haze over all that, so it stays under the ice
  blots(g, rand, 34, 30, 80, '#e8f7fd', 0.24);
  // the ring the hunters cut for their fights
  g.strokeStyle = '#f3fcff';
  g.globalAlpha = 0.5;
  g.lineWidth = 2.2;
  g.setLineDash([16, 5]);
  g.beginPath();
  g.ellipse(MID.x, MID.y, 96, 82, 0, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.globalAlpha = 1;
  // bubbles held in it
  for (let i = 0; i < 180; i++) {
    const x = rand() * ARENA_W;
    const y = rand() * ARENA_H;
    g.fillStyle = '#ffffff';
    g.globalAlpha = 0.28 + rand() * 0.3;
    g.beginPath();
    g.arc(x, y, 0.5 + rand() * 1.3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  colors(g, rand, 0.26, 1.6);
  // blades have gone over it
  g.strokeStyle = '#ffffff';
  for (let i = 0; i < 44; i++) {
    g.globalAlpha = 0.14 + rand() * 0.22;
    g.lineWidth = 0.6;
    scratch(g, rand() * ARENA_W, rand() * ARENA_H, rand() * 6.3, 22 + rand() * 60, (rand() - 0.5) * 34);
  }
  g.globalAlpha = 1;
  // cracks out of everything that stands in it, and from where something heavy came down
  for (const p of map.pillars) {
    if (p.wall) continue;
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand();
      crack(g, rand, p.x + p.w / 2 + Math.cos(a) * p.w * 0.45, p.y + p.h / 2 + Math.sin(a) * p.h * 0.45, a, 30 + rand() * 40, 1);
    }
  }
  for (const [x, y] of [[128, 88], [430, 168], [272, 214]] as const) {
    for (let i = 0; i < 5; i++) crack(g, rand, x, y, (i / 5) * Math.PI * 2 + rand() * 0.5, 16 + rand() * 30, 1);
  }
  // snow, blown up against whatever stops it
  const drift = (x: number, y: number, n: number, spreadX: number, spreadY: number): void => {
    for (let i = 0; i < n; i++) blot(g, x + (rand() - 0.5) * spreadX, y + (rand() - 0.5) * spreadY, 6 + rand() * 14, '#ffffff', 0.5);
  };
  for (let x = 0; x < ARENA_W; x += 12) {
    drift(x, 4, 2, 16, 16);
    drift(x, ARENA_H - 3, 2, 16, 14);
  }
  for (const p of map.pillars) {
    drift(p.x + p.w / 2, p.y + p.h + 4, Math.ceil(p.w / 3), p.w + 8, 8);
    drift(p.x - 2, p.y + p.h / 2, Math.ceil(p.h / 8), 8, p.h);
    drift(p.x + p.w + 2, p.y + p.h / 2, Math.ceil(p.h / 8), 8, p.h);
  }
  feet(g, map, 0.3, '#1d4a78');
  specks(g, rand, 1700, 0.7, ['#ffffff', '#ffffff', '#5a9ccc'], 0.5);
}

/* ------------------------------------------------------------------ the forge */

interface Run {
  x: number;
  y: number;
  to: [number, number][];
}

/** The runs of molten iron in their stone gutters. */
const RUNS: Run[] = [
  { x: 153, y: 64, to: [[153, 86], [196, 86], [196, 120], [246, 120]] },
  { x: 395, y: 186, to: [[395, 164], [352, 164], [352, 130], [302, 130]] },
  { x: 274, y: 0, to: [[274, 98]] },
  { x: 274, y: 152, to: [[274, 250]] },
];

function paintForge(g: G, glow: G, map: RingMap, rand: Rand): void {
  g.fillStyle = '#1a1416';
  g.fillRect(0, 0, ARENA_W, ARENA_H);
  // courses of big worn flags
  let row = 0;
  for (let y = -6; y < ARENA_H; y += 21) {
    let x = row % 2 ? -22 : -6;
    while (x < ARENA_W) {
      const w = 30 + rand() * 26;
      const shade = ['#3d3234', '#352b2d', '#453938', '#2f2729', '#3a2f2f', '#4b3e3a'][Math.floor(rand() * 6)]!;
      g.fillStyle = shade;
      g.fillRect(x, y, w - 1.2, 19.8);
      // lit on its top edge, dark on its bottom
      g.fillStyle = 'rgba(255,220,190,0.09)';
      g.fillRect(x, y, w - 1.2, 1.1);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x, y + 18.4, w - 1.2, 1.4);
      if (rand() < 0.2) {
        // an old crack in it
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 0.7;
        wander(g, rand, x + rand() * w, y, x + rand() * w, y + 19, 4, 5);
      }
      x += w;
    }
    row++;
  }
  blots(g, rand, 40, 16, 60, '#0d090a', 0.5);
  blots(g, rand, 20, 26, 60, '#6b5349', 0.13);
  // the bronze ring the great anvil stands in
  g.save();
  g.translate(MID.x, MID.y);
  g.lineWidth = 7;
  g.strokeStyle = '#6d4d29';
  g.beginPath();
  g.arc(0, 0, 58, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 1.2;
  g.strokeStyle = '#c99a55';
  g.beginPath();
  g.arc(0, 0, 61, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(0, 0, 55, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.fillStyle = '#d9b06c';
    g.beginPath();
    g.arc(Math.cos(a) * 58, Math.sin(a) * 58, 1.5, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  colors(g, rand, 0.26, 1.4);
  // iron plates, riveted down over the worst of it
  const plate = (x: number, y: number, w: number, h: number): void => {
    g.fillStyle = '#3c3c46';
    g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.09)';
    g.fillRect(x, y, w, 1);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(x, y + h - 1, w, 1);
    g.fillStyle = '#6a6a78';
    for (const [rx, ry] of [[2, 2], [w - 2, 2], [2, h - 2], [w - 2, h - 2]] as const) {
      g.beginPath();
      g.arc(x + rx, y + ry, 0.9, 0, Math.PI * 2);
      g.fill();
    }
  };
  for (const [x, y, w, h] of [[92, 150, 40, 26], [418, 72, 40, 26], [188, 196, 34, 22], [326, 34, 34, 22], [70, 30, 30, 20], [452, 206, 30, 20]] as const) plate(x, y, w, h);
  // the gutters, and what runs in them
  const trace = (ctx: G, r: Run): void => {
    ctx.beginPath();
    ctx.moveTo(r.x, r.y);
    for (const [x, y] of r.to) ctx.lineTo(x, y);
    ctx.stroke();
  };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const r of RUNS) {
    g.strokeStyle = '#0c0708';
    g.lineWidth = 11;
    trace(g, r);
    g.strokeStyle = '#5d4640';
    g.lineWidth = 9;
    trace(g, r);
    g.strokeStyle = '#120a0a';
    g.lineWidth = 7;
    trace(g, r);
    g.strokeStyle = '#d4551a';
    g.lineWidth = 4.6;
    trace(g, r);
    glow.lineCap = 'round';
    glow.lineJoin = 'round';
    glow.strokeStyle = '#ffffff';
    glow.lineWidth = 4.4;
    trace(glow, r);
  }
  // iron bars laid over them where people cross
  g.fillStyle = '#26262e';
  for (const [x, y, w, h] of [[160, 82, 3, 8], [176, 82, 3, 8], [192, 98, 8, 3], [192, 108, 8, 3], [212, 116, 3, 8], [228, 116, 3, 8], [374, 160, 3, 8], [358, 160, 3, 8], [348, 142, 8, 3], [348, 152, 8, 3], [320, 126, 3, 8], [336, 126, 3, 8], [270, 22, 8, 3], [270, 46, 8, 3], [270, 70, 8, 3], [270, 176, 8, 3], [270, 202, 8, 3], [270, 228, 8, 3]] as const) {
    g.fillRect(x, y, w, h);
  }
  // heat crazes the stone beside them; light pools round them
  g.lineCap = 'butt';
  for (const r of RUNS) {
    let px = r.x;
    let py = r.y;
    for (const [x, y] of r.to) {
      const len = Math.hypot(x - px, y - py);
      for (let d = 0; d < len; d += 10) {
        const k = d / len;
        const lx = px + (x - px) * k;
        const ly = py + (y - py) * k;
        g.globalCompositeOperation = 'lighter';
        blot(g, lx, ly, 22, '#c9431a', 0.13);
        g.globalCompositeOperation = 'source-over';
        if (rand() < 0.3) {
          const a = rand() * 6.3;
          const l = 7 + rand() * 13;
          const ex = lx + Math.cos(a) * l;
          const ey = ly + Math.sin(a) * l;
          g.strokeStyle = '#e8732a';
          g.lineWidth = 0.9;
          g.globalAlpha = 0.85;
          wander(g, rand, lx, ly, ex, ey, 3, 3);
          g.globalAlpha = 1;
          glow.strokeStyle = '#a0a0a0';
          glow.lineWidth = 1.2;
          wander(glow, seeded(d + 3), lx, ly, ex, ey, 3, 3);
        }
      }
      px = x;
      py = y;
    }
  }
  // slag spattered round the furnaces
  for (const p of map.pillars) {
    if (p.wall || p.w > 40) continue;
    g.globalCompositeOperation = 'lighter';
    blot(g, p.x + p.w / 2, p.y + p.h + 5, 34, '#e0601e', 0.32);
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 26; i++) {
      const x = p.x + p.w / 2 + (rand() - 0.5) * 66;
      const y = p.y + p.h + (rand() - 0.2) * 34;
      g.fillStyle = rand() < 0.3 ? '#b54a1a' : '#0e090a';
      g.beginPath();
      g.ellipse(x, y, 0.7 + rand() * 2, 0.5 + rand() * 1.3, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  feet(g, map, 0.55, '#040203');
  specks(g, rand, 1500, 0.7, ['#6b5a50', '#0a0607', '#2a2022'], 0.45);
}

/* ------------------------------------------------------------------ on the ground */

const floorVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vW;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const floorFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uGlow;
  uniform float uTime;
  uniform float uKind;
  varying vec2 vUv;
  varying vec3 vW;
  // (no sin in the hash: on a phone's GPU sin of a big number loses its precision and the molten iron crawled in jitters)
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec3 c = texture2D(uMap, vUv).rgb;
    // (time kept small, for the same reason)
    float t = mod(uTime, 400.0);
    if (uKind > 1.5) {
      // molten iron, crawling along its gutters
      float h = texture2D(uGlow, vUv).r;
      if (h > 0.01) {
        float n = noise(vW.xz * 2.4 + vec2(t * 0.32, -t * 0.24));
        float m = noise(vW.xz * 4.6 - vec2(t * 0.4, t * 0.12));
        float k = n * 0.65 + m * 0.35;
        vec3 hot = mix(vec3(0.95, 0.24, 0.03), vec3(1.0, 0.82, 0.32), smoothstep(0.35, 0.8, k));
        c = mix(c, hot * (0.86 + 0.14 * sin(t * 1.2 + k * 3.0)), h);
      }
    } else if (uKind > 0.5) {
      // the low sun going slowly across the ice
      float s = sin(dot(vW.xz, vec2(0.62, 0.24)) * 1.5 - t * 0.3 + noise(vW.xz * 0.6) * 2.0);
      c += vec3(0.16, 0.2, 0.22) * pow(max(s, 0.0), 14.0);
    }
    gl_FragColor = vec4(c, 1.0);
  }`;

/** The painted floor of a ring, ready to lie on the ground. */
export function floorOf(map: RingMap): THREE.Mesh {
  const color = document.createElement('canvas');
  color.width = Math.round(ARENA_W * INK);
  color.height = Math.round(ARENA_H * INK);
  const g = color.getContext('2d')!;
  g.scale(color.width / ARENA_W, color.height / ARENA_H);
  const heat = document.createElement('canvas');
  heat.width = Math.round(ARENA_W * 1.4);
  heat.height = Math.round(ARENA_H * 1.4);
  const h = heat.getContext('2d')!;
  h.fillStyle = '#000';
  h.fillRect(0, 0, heat.width, heat.height);
  h.scale(heat.width / ARENA_W, heat.height / ARENA_H);
  const rand = seeded(map.id.length * 7919 + map.id.charCodeAt(0));
  if (map.theme === 'sands') paintSands(g, map, rand);
  else if (map.theme === 'frost') paintMere(g, map, rand);
  else paintForge(g, h, map, rand);
  const texture = (c: HTMLCanvasElement): THREE.CanvasTexture => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = 4;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    return t;
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: texture(color) }, uGlow: { value: texture(heat) }, uTime: LIGHT.uTime, uKind: { value: map.theme === 'forge' ? 2 : map.theme === 'frost' ? 1 : 0 } },
    vertexShader: floorVert,
    fragmentShader: floorFrag,
    depthTest: false,
    depthWrite: false,
  });
  const geo = new THREE.PlaneGeometry(ARENA_W / TILE, ARENA_H / TILE);
  geo.rotateX(-Math.PI / 2);
  geo.translate(ARENA_W / TILE / 2, 0, ARENA_H / TILE / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
}

export function disposeFloor(mesh: THREE.Mesh): void {
  const mat = mesh.material as THREE.ShaderMaterial;
  (mat.uniforms.uMap!.value as THREE.Texture).dispose();
  (mat.uniforms.uGlow!.value as THREE.Texture).dispose();
  mat.dispose();
  mesh.geometry.dispose();
}

/** (For what stands: a pillar's own footprint in tiles.) */
export const tilesOf = (p: Pillar): { x0: number; z0: number; x1: number; z1: number } => ({ x0: p.x / TILE, z0: p.y / TILE, x1: (p.x + p.w) / TILE, z1: (p.y + p.h) / TILE });
