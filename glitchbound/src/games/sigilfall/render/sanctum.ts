/**
 * The Wardens' Sanctum, where a hero waits: the hall behind the character screen, and the home page's key art. A
 * great rose window with the moon behind it, pillars marching back into the dark, banners in the hero's colors, a
 * round stone dais under a shaft of moonlight. Painted at a low resolution so it reads as the game's own pixel art.
 *
 * The stone is painted once; the light (flames, the turning sigil, motes in the moonbeam) over it every frame.
 */

export const SANCTUM_W = 640;
export const SANCTUM_H = 360;

type Ctx = CanvasRenderingContext2D;

/** Seeded, so the same hall comes back every time. */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number): number => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const CX = SANCTUM_W / 2;
/** The far wall, which everything recedes to. */
const BACK = { x0: 196, x1: 444, y0: 18, y1: 214 };
const WIN = { x: CX, y: 104, r: 70 };

/** A point between the near edge of the hall (t = 0) and the far wall (t = 1). */
function depthX(side: -1 | 1, t: number): number {
  const near = side < 0 ? -40 : SANCTUM_W + 40;
  const far = side < 0 ? BACK.x0 : BACK.x1;
  return near + (far - near) * t;
}

function stoneBlocks(g: Ctx, x0: number, y0: number, x1: number, y1: number, bw: number, bh: number, base: number, rand: () => number): void {
  let row = 0;
  for (let y = y0; y < y1; y += bh, row++) {
    for (let x = x0 - (row % 2) * (bw / 2); x < x1; x += bw) {
      const v = base + rand() * 7 - 3;
      g.fillStyle = `rgb(${v * 0.82},${v * 0.78},${v * 1.28})`;
      g.fillRect(Math.round(x), Math.round(y), bw - 1, bh - 1);
    }
  }
}

function paintBackWall(g: Ctx, rand: () => number): void {
  g.save();
  g.beginPath();
  g.rect(BACK.x0, BACK.y0, BACK.x1 - BACK.x0, BACK.y1 - BACK.y0);
  g.clip();
  g.fillStyle = '#0b0818';
  g.fillRect(BACK.x0, BACK.y0, BACK.x1 - BACK.x0, BACK.y1 - BACK.y0);
  stoneBlocks(g, BACK.x0, BACK.y0, BACK.x1, BACK.y1, 18, 9, 32, rand);
  // moonlight spills from the window onto the stone around it
  const spill = g.createRadialGradient(WIN.x, WIN.y, WIN.r * 0.8, WIN.x, WIN.y, WIN.r * 2.1);
  spill.addColorStop(0, 'rgba(150,170,255,0.3)');
  spill.addColorStop(1, 'rgba(150,170,255,0)');
  g.fillStyle = spill;
  g.fillRect(BACK.x0, BACK.y0, BACK.x1 - BACK.x0, BACK.y1 - BACK.y0);
  g.restore();
}

function paintWindow(g: Ctx, rand: () => number): void {
  const { x, y, r } = WIN;
  // the night outside, and a very large moon
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.clip();
  const sky = g.createLinearGradient(0, y - r, 0, y + r);
  sky.addColorStop(0, '#20184f');
  sky.addColorStop(0.55, '#4f3f9f');
  sky.addColorStop(1, '#b06fa8');
  g.fillStyle = sky;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  const moon = g.createRadialGradient(x - 8, y - 10, 2, x - 2, y - 4, 34);
  moon.addColorStop(0, '#fffdf2');
  moon.addColorStop(0.72, '#fff0c8');
  moon.addColorStop(0.92, '#e8c98a');
  moon.addColorStop(1, 'rgba(232,201,138,0)');
  g.fillStyle = moon;
  g.beginPath();
  g.arc(x - 2, y - 4, 34, 0, Math.PI * 2);
  g.fill();
  // the moon's dark seas
  g.fillStyle = 'rgba(190,160,120,0.35)';
  for (const [dx, dy, s] of [[-12, -14, 6], [6, -4, 8], [-8, 6, 5], [12, 12, 4]] as const) {
    g.beginPath();
    g.ellipse(x + dx, y + dy, s, s * 0.8, 0.3, 0, Math.PI * 2);
    g.fill();
  }
  // stars, and the far crags at the window's foot
  for (let i = 0; i < 44; i++) {
    const a = rand() * Math.PI * 2;
    const d = 38 + rand() * (r - 38);
    g.fillStyle = rand() > 0.6 ? '#ffe7a3' : '#ffffff';
    g.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.75 - 6), 1, 1);
  }
  g.fillStyle = '#1a1238';
  g.beginPath();
  g.moveTo(x - r, y + r);
  for (let i = 0; i <= 14; i++) g.lineTo(x - r + (i / 14) * r * 2, y + r * 0.62 + (i % 2 ? -11 : 3) - Math.abs(i - 7) * -1.4);
  g.lineTo(x + r, y + r);
  g.fill();
  // stained glass over all of it: wedges tinted in turn
  const TINT = ['rgba(120,90,255,0.2)', 'rgba(255,120,180,0.13)', 'rgba(90,180,255,0.17)', 'rgba(255,200,100,0.12)'];
  const SPOKES = 16;
  for (let i = 0; i < SPOKES; i++) {
    const a0 = (i / SPOKES) * Math.PI * 2;
    const a1 = ((i + 1) / SPOKES) * Math.PI * 2;
    g.fillStyle = TINT[i % TINT.length]!;
    g.beginPath();
    g.moveTo(x, y);
    g.arc(x, y, r, a0, a1);
    g.closePath();
    g.fill();
  }
  g.restore();
  // the stone tracery: rings and spokes, with a lit edge
  const stone = (w: number, c: string): void => {
    g.lineWidth = w;
    g.strokeStyle = c;
  };
  for (const [rr, w] of [[r, 6], [r * 0.72, 2.5], [r * 0.34, 3]] as const) {
    stone(w + 1, '#090612');
    g.beginPath();
    g.arc(x, y, rr, 0, Math.PI * 2);
    g.stroke();
    stone(w, '#3a3358');
    g.beginPath();
    g.arc(x, y, rr, 0, Math.PI * 2);
    g.stroke();
  }
  stone(2.2, '#2c2548');
  for (let i = 0; i < SPOKES; i++) {
    const a = (i / SPOKES) * Math.PI * 2;
    const r0 = i % 2 ? r * 0.72 : r * 0.34;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    g.stroke();
  }
  // petals of tracery between the rings
  stone(1.6, '#2c2548');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    g.beginPath();
    g.arc(x + Math.cos(a) * r * 0.53, y + Math.sin(a) * r * 0.53, r * 0.17, 0, Math.PI * 2);
    g.stroke();
  }
  // the carved surround
  stone(4, '#4a4270');
  g.beginPath();
  g.arc(x, y, r + 6, 0, Math.PI * 2);
  g.stroke();
  stone(1, '#8d84b8');
  g.beginPath();
  g.arc(x, y, r + 8, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();
}

function paintSideWalls(g: Ctx): void {
  for (const side of [-1, 1] as const) {
    const nearX = side < 0 ? -40 : SANCTUM_W + 40;
    const farX = side < 0 ? BACK.x0 : BACK.x1;
    const grad = g.createLinearGradient(nearX, 0, farX, 0);
    grad.addColorStop(0, '#05030b');
    grad.addColorStop(1, '#1b1533');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(nearX, -80);
    g.lineTo(farX, BACK.y0);
    g.lineTo(farX, BACK.y1);
    g.lineTo(nearX, SANCTUM_H + 40);
    g.closePath();
    g.fill();
    // courses of stone running back toward the far wall
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      g.beginPath();
      g.moveTo(nearX, -80 + t * (SANCTUM_H + 120));
      g.lineTo(farX, BACK.y0 + t * (BACK.y1 - BACK.y0));
      g.stroke();
    }
  }
  // the vault overhead, ribs meeting in the dark
  const vault = g.createLinearGradient(0, -40, 0, BACK.y0 + 4);
  vault.addColorStop(0, '#020107');
  vault.addColorStop(1, '#120d24');
  g.fillStyle = vault;
  g.beginPath();
  g.moveTo(-40, -80);
  g.lineTo(SANCTUM_W + 40, -80);
  g.lineTo(BACK.x1, BACK.y0);
  g.lineTo(BACK.x0, BACK.y0);
  g.closePath();
  g.fill();
}

function paintFloor(g: Ctx, rand: () => number): void {
  const top = BACK.y1;
  const grad = g.createLinearGradient(0, top, 0, SANCTUM_H);
  grad.addColorStop(0, '#1a1534');
  grad.addColorStop(1, '#07050f');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(BACK.x0, top);
  g.lineTo(BACK.x1, top);
  g.lineTo(SANCTUM_W + 40, SANCTUM_H + 40);
  g.lineTo(-40, SANCTUM_H + 40);
  g.closePath();
  g.fill();
  // flagstones in perspective
  const rows = 16;
  for (let r = 0; r < rows; r++) {
    const a = (r / rows) ** 1.8;
    const b = ((r + 1) / rows) ** 1.8;
    const y0 = top + a * (SANCTUM_H - top + 30);
    const y1 = top + b * (SANCTUM_H - top + 30);
    const cols = 15;
    for (let c = -cols; c <= cols; c++) {
      const col = c + (r % 2 ? 0.5 : 0);
      const x = (u: number, t: number): number => CX + ((u * (BACK.x1 - BACK.x0)) / 13) * (1 + t * 4.2);
      const v = 22 + rand() * 12;
      g.fillStyle = `rgb(${v * 0.84},${v * 0.8},${v * 1.3})`;
      g.beginPath();
      g.moveTo(x(col, a) + 0.5, y0 + 0.5);
      g.lineTo(x(col + 1, a) - 0.5, y0 + 0.5);
      g.lineTo(x(col + 1, b) - 1, y1 - 0.8);
      g.lineTo(x(col, b) + 1, y1 - 0.8);
      g.closePath();
      g.fill();
    }
  }
  // the window's reflection, polished stone at the foot of the far wall
  const glint = g.createLinearGradient(0, top, 0, top + 80);
  glint.addColorStop(0, 'rgba(170,180,255,0.3)');
  glint.addColorStop(1, 'rgba(170,180,255,0)');
  g.fillStyle = glint;
  g.beginPath();
  g.moveTo(CX - 40, top);
  g.lineTo(CX + 40, top);
  g.lineTo(CX + 70, top + 80);
  g.lineTo(CX - 70, top + 80);
  g.closePath();
  g.fill();
}

/** One pillar, at a depth: base, shaft with a lit edge, capital, and the arch springing from it. */
function paintPillar(g: Ctx, side: -1 | 1, t: number): void {
  const x = depthX(side, t);
  const scale = 1 - t * 0.74;
  const floorY = BACK.y1 + (1 - t) * 170;
  const topY = BACK.y0 - (1 - t) * 90;
  const w = 42 * scale;
  const shaft = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  // the light comes from the window, so the side facing the middle of the hall is the lit one
  const lit = side < 0 ? 1 : 0;
  shaft.addColorStop(lit, '#5a5288');
  shaft.addColorStop(0.5, '#2c2648');
  shaft.addColorStop(1 - lit, '#0c0918');
  g.fillStyle = shaft;
  g.fillRect(Math.round(x - w / 2), Math.round(topY), Math.round(w), Math.round(floorY - topY));
  // fluting
  g.fillStyle = 'rgba(0,0,0,0.26)';
  for (let i = 1; i < 4; i++) g.fillRect(Math.round(x - w / 2 + (i * w) / 4), Math.round(topY), Math.max(1, Math.round(1.5 * scale)), Math.round(floorY - topY));
  // base
  g.fillStyle = '#231e3c';
  g.fillRect(Math.round(x - w * 0.72), Math.round(floorY - 14 * scale), Math.round(w * 1.44), Math.round(14 * scale));
  g.fillStyle = '#3c3560';
  g.fillRect(Math.round(x - w * 0.72), Math.round(floorY - 14 * scale), Math.round(w * 1.44), Math.max(1, Math.round(2 * scale)));
  // the shadow it throws on the floor
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(x, floorY, w * 0.95, 6 * scale, 0, 0, Math.PI * 2);
  g.fill();
}

/** The hall, all that holds still. */
export function paintSanctumStone(g: Ctx): void {
  const rand = rng(77);
  g.fillStyle = '#05030b';
  g.fillRect(0, 0, SANCTUM_W, SANCTUM_H);
  paintBackWall(g, rand);
  paintWindow(g, rand);
  paintSideWalls(g);
  paintFloor(g, rand);
  // pillars from the far end forward
  for (const t of [0.86, 0.62, 0.3]) {
    paintPillar(g, -1, t);
    paintPillar(g, 1, t);
  }
  paintDais(g);
  // the near corners fall away into the dark
  const v = g.createRadialGradient(CX, 180, 150, CX, 190, 390);
  v.addColorStop(0, 'rgba(2,1,8,0)');
  v.addColorStop(1, 'rgba(2,1,8,0.86)');
  g.fillStyle = v;
  g.fillRect(0, 0, SANCTUM_W, SANCTUM_H);
}

export const DAIS = { x: CX, y: 286, rx: 118, ry: 30 };
/** Where the heroes who aren't chosen wait, on plinths to either side. */
export const PLINTHS = { y: 256, dx: 186 };

function paintPlinth(g: Ctx, x: number, y: number, rx: number, ry: number): void {
  for (const [dy, k, c] of [[9, 1.08, '#141029'], [4, 1.03, '#201a3a'], [0, 1, '#332c54']] as const) {
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(x, y + dy, rx * k, ry * k, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#5c5488';
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();
}

function paintDais(g: Ctx): void {
  const { x, y, rx, ry } = DAIS;
  paintPlinth(g, CX - PLINTHS.dx, PLINTHS.y, 46, 12);
  paintPlinth(g, CX + PLINTHS.dx, PLINTHS.y, 46, 12);
  // three broad steps
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.beginPath();
  g.ellipse(x, y + 22, rx * 1.28, ry * 1.22, 0, 0, Math.PI * 2);
  g.fill();
  for (const [dy, k, c] of [[17, 1.22, '#17122c'], [13, 1.2, '#2b2448'], [8, 1.1, '#1d1838'], [4, 1.08, '#37305c'], [0, 1, '#2a2348']] as const) {
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(x, y + dy, rx * k, ry * k, 0, 0, Math.PI * 2);
    g.fill();
  }
  // the top, polished, with a carved ring
  const top = g.createRadialGradient(x, y - 6, 8, x, y, rx);
  top.addColorStop(0, '#6a62a0');
  top.addColorStop(0.6, '#3a3360');
  top.addColorStop(1, '#2a2348');
  g.fillStyle = top;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#17122c';
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(x, y, rx * 0.82, ry * 0.82, 0, 0, Math.PI * 2);
  g.stroke();
}

/** The great shaft of moonlight down from the window onto the dais. */
function moonbeam(g: Ctx): void {
  const grad = g.createLinearGradient(0, WIN.y, 0, DAIS.y + 20);
  grad.addColorStop(0, 'rgba(190,200,255,0.2)');
  grad.addColorStop(1, 'rgba(190,200,255,0.03)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(WIN.x - 46, WIN.y);
  g.lineTo(WIN.x + 46, WIN.y);
  g.lineTo(DAIS.x + DAIS.rx * 0.86, DAIS.y + 8);
  g.lineTo(DAIS.x - DAIS.rx * 0.86, DAIS.y + 8);
  g.closePath();
  g.fill();
}

function banner(g: Ctx, side: -1 | 1, t: number, color: string, time: number): void {
  const x = depthX(side, t) + side * -30 * (1 - t * 0.74);
  const scale = 1 - t * 0.74;
  const y0 = BACK.y0 - (1 - t) * 40;
  const w = 26 * scale;
  const h = 118 * scale;
  const n = 10;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const sway = Math.sin(time * 1.1 + u * 3 + t * 9) * 1.4 * scale * u;
    const c = shade(color, (side < 0 ? 0.72 : 0.5) * (1 - u * 0.36));
    g.fillStyle = c;
    g.fillRect(Math.round(x - w / 2 + sway), Math.round(y0 + u * h), Math.ceil(w), Math.ceil(h / n) + 1);
  }
  const bottom = y0 + h;
  const sway = Math.sin(time * 1.1 + 3 + t * 9) * 1.4 * scale;
  g.fillStyle = shade(color, side < 0 ? 0.4 : 0.28);
  g.beginPath();
  g.moveTo(x - w / 2 + sway, bottom);
  g.lineTo(x + w / 2 + sway, bottom);
  g.lineTo(x + sway, bottom + 16 * scale);
  g.closePath();
  g.fill();
  // gold edges and a rod
  g.fillStyle = '#d9b65e';
  g.fillRect(Math.round(x - w / 2 - 2 * scale), Math.round(y0 - 2 * scale), Math.ceil(w + 4 * scale), Math.max(1, Math.round(2 * scale)));
  g.fillStyle = 'rgba(246,196,83,0.65)';
  // a sigil worked into the cloth
  g.lineWidth = Math.max(1, 1.5 * scale);
  g.strokeStyle = 'rgba(246,196,83,0.55)';
  g.beginPath();
  g.arc(x + sway * 0.5, y0 + h * 0.42, w * 0.3, 0, Math.PI * 2);
  g.stroke();
}

function brazier(g: Ctx, x: number, y: number, s: number, time: number, seed: number): void {
  // the bowl on its stand
  g.fillStyle = '#17122c';
  g.fillRect(Math.round(x - 2 * s), Math.round(y), Math.round(4 * s), Math.round(24 * s));
  g.fillRect(Math.round(x - 8 * s), Math.round(y + 22 * s), Math.round(16 * s), Math.round(3 * s));
  g.fillStyle = '#3a3358';
  g.beginPath();
  g.moveTo(x - 10 * s, y - 4 * s);
  g.lineTo(x + 10 * s, y - 4 * s);
  g.lineTo(x + 5 * s, y + 3 * s);
  g.lineTo(x - 5 * s, y + 3 * s);
  g.closePath();
  g.fill();
  // warm light on the stone around it
  const glow = g.createRadialGradient(x, y - 6 * s, 2, x, y - 6 * s, 62 * s);
  const f = 0.78 + Math.sin(time * 7 + seed) * 0.1 + Math.sin(time * 13 + seed * 2) * 0.06;
  glow.addColorStop(0, `rgba(255,150,70,${0.36 * f})`);
  glow.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(x, y - 6 * s, 62 * s, 0, Math.PI * 2);
  g.fill();
  // tongues of flame, three layers
  for (const [w, h, c] of [[8, 22, '#d9481e'], [5.5, 16, '#ff9a2e'], [3, 9, '#ffe88a']] as const) {
    g.fillStyle = c;
    g.beginPath();
    const lean = Math.sin(time * 5 + seed) * 2 * s;
    const hh = h * s * (0.86 + Math.sin(time * 11 + seed + w) * 0.16);
    g.moveTo(x - w * s, y - 3 * s);
    g.quadraticCurveTo(x - w * s * 0.7 + lean * 0.4, y - hh * 0.55, x + lean, y - hh - 3 * s);
    g.quadraticCurveTo(x + w * s * 0.7 + lean * 0.4, y - hh * 0.55, x + w * s, y - 3 * s);
    g.closePath();
    g.fill();
  }
}

/** The sigil turning in the dais, in the hero's color. `flare` (0 to 1) is the moment a hero steps up. */
function sigilRing(g: Ctx, color: string, time: number, flare: number): void {
  const { x, y, rx, ry } = DAIS;
  g.save();
  g.translate(x, y);
  g.scale(1, ry / rx);
  g.strokeStyle = color;
  g.globalAlpha = 0.55 + flare * 0.45;
  g.lineWidth = 2;
  for (const [r, n, sp] of [[rx * 0.76, 12, 0.22], [rx * 0.56, 6, -0.34]] as const) {
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + time * sp;
      g.fillStyle = color;
      g.fillRect(Math.cos(a) * r - 2.5, Math.sin(a) * r - 2.5, 5, 5);
    }
  }
  // the seven-pointed star of the Crown
  const star = rx * 0.54;
  g.beginPath();
  for (let i = 0; i <= 7; i++) {
    const a = ((i * 3) / 7) * Math.PI * 2 - time * 0.12;
    const px = Math.cos(a) * star;
    const py = Math.sin(a) * star;
    if (i) g.lineTo(px, py);
    else g.moveTo(px, py);
  }
  g.lineWidth = 1.5;
  g.stroke();
  // the glow pooled on the stone
  const pool = g.createRadialGradient(0, 0, 8, 0, 0, rx * (0.9 + flare * 0.3));
  pool.addColorStop(0, color);
  pool.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 0.2 + flare * 0.5;
  g.fillStyle = pool;
  g.beginPath();
  g.arc(0, 0, rx * (0.9 + flare * 0.3), 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export interface Mote {
  x: number;
  y: number;
  v: number;
  s: number;
  p: number;
  warm: boolean;
}

export function makeMotes(n: number): Mote[] {
  const rand = rng(5);
  return Array.from({ length: n }, () => {
    const warm = rand() < 0.3;
    return { x: warm ? CX + (rand() - 0.5) * 420 : CX + (rand() - 0.5) * 170, y: 110 + rand() * 200, v: 3 + rand() * 7, s: rand() > 0.7 ? 2 : 1, p: rand() * 6.28, warm };
  });
}

/** Everything alive over the stone, for one frame. */
export function paintSanctumLight(g: Ctx, color: string, time: number, flare: number, motes: Mote[]): void {
  moonbeam(g);
  for (const t of [0.62, 0.3]) {
    banner(g, -1, t, color, time);
    banner(g, 1, t, color, time);
  }
  brazier(g, CX - 118, 212, 1, time, 1);
  brazier(g, CX + 118, 212, 1, time, 2.4);
  sigilRing(g, color, time, flare);
  for (const m of motes) {
    const y = ((m.y - time * m.v) % 220 + 220) % 220 + 90;
    const x = m.x + Math.sin(time * 0.6 + m.p) * 7;
    g.globalAlpha = (m.warm ? 0.8 : 0.55) * (0.6 + Math.sin(time * 2 + m.p) * 0.4);
    g.fillStyle = m.warm ? '#ffb45c' : '#dfe6ff';
    g.fillRect(Math.round(x), Math.round(y), m.s, m.s);
  }
  g.globalAlpha = 1;
}
