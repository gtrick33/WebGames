import type { Pal } from './artdata';

/**
 * Canvas helpers for pixel art: text art to canvases (with an automatic dark outline), mirrored and
 * white (hit flash) copies, and a tiny pixel font for numbers and short words.
 */

export const OUTLINE = '#1b1428';

/**
 * Art pixels per world pixel. The world is laid out in 16-px tiles; it is drawn at twice that
 * resolution, so newer art (drawn at DETAIL × its world size) has finer pixels, while older art drawn
 * at world size simply shows each of its pixels as a 2×2 block.
 */
export const DETAIL = 2;

export type Cnv = HTMLCanvasElement;

export function canvas(w: number, h: number): Cnv {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export const ctx2d = (c: Cnv): CanvasRenderingContext2D => {
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  g.imageSmoothingEnabled = false;
  return g;
};

export interface Sprite {
  c: Cnv;
  /** Mirrored copy (facing the other way). */
  f: Cnv;
  /** White silhouette for the hit flash. */
  w: Cnv;
  wf: Cnv;
  /** Canvas size, in art pixels. */
  width: number;
  height: number;
  /** Art pixels per world pixel: draw it at width / k × height / k. */
  k: number;
}

/** Text art to a canvas. The outline adds one pixel on every side. */
export function paint(rows: string[], pal: Pal, outline = true): Cnv {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const o = outline ? 1 : 0;
  const c = canvas(w + o * 2, h + o * 2);
  const g = ctx2d(c);
  const img = g.createImageData(c.width, c.height);
  const d = img.data;
  const rgb = new Map<string, [number, number, number]>();
  const col = (ch: string): [number, number, number] => {
    let v = rgb.get(ch);
    if (!v) {
      v = hexRgb(pal[ch] ?? '#ff00ff');
      rgb.set(ch, v);
    }
    return v;
  };
  for (let y = 0; y < h; y++) {
    const row = rows[y]!;
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === '.' || ch === ' ') continue;
      const [r, gg, b] = col(ch);
      const i = ((y + o) * c.width + (x + o)) * 4;
      d[i] = r;
      d[i + 1] = gg;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
  if (outline) {
    const [r, gg, b] = hexRgb(OUTLINE);
    const filled = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < c.width && y < c.height && d[(y * c.width + x) * 4 + 3]! > 0 && !isOutline(x, y);
    const mark = new Uint8Array(c.width * c.height);
    const isOutline = (x: number, y: number): boolean => mark[y * c.width + x] === 1;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (d[i + 3]! > 0) continue;
        if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) mark[y * c.width + x] = 2;
      }
    }
    for (let k = 0; k < mark.length; k++) {
      if (mark[k] !== 2) continue;
      d[k * 4] = r;
      d[k * 4 + 1] = gg;
      d[k * 4 + 2] = b;
      d[k * 4 + 3] = 255;
      mark[k] = 1;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgba = (hex: string, a: number): string => {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

/** Lighter (k > 0) or darker (k < 0) version of a color. */
export function shade(hex: string, k: number): string {
  const [r, g, b] = hexRgb(hex);
  const f = (v: number): number => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `#${[f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function mirror(src: Cnv): Cnv {
  const c = canvas(src.width, src.height);
  const g = ctx2d(c);
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

/** A solid-color silhouette of a canvas. */
export function silhouette(src: Cnv, color = '#ffffff'): Cnv {
  const c = canvas(src.width, src.height);
  const g = ctx2d(c);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

export function makeSprite(c: Cnv, k = 1): Sprite {
  const f = mirror(c);
  return { c, f, w: silhouette(c), wf: silhouette(f), width: c.width, height: c.height, k };
}

/**
 * Doubles text art with Scale2x (EPX): each pixel becomes four, and where two neighbours of the same
 * color meet at a corner the corner takes their color, so diagonals come out smooth instead of as
 * staircases of 2×2 blocks. Painted with an outline afterwards, the outline is one fine pixel.
 */
export function scale2x(rows: string[]): string[] {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const at = (x: number, y: number): string => (x < 0 || y < 0 || x >= w || y >= h ? '.' : (rows[y]![x] ?? '.').replace(' ', '.'));
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    let a = '';
    let b = '';
    for (let x = 0; x < w; x++) {
      const E = at(x, y);
      const B = at(x, y - 1);
      const D = at(x - 1, y);
      const F = at(x + 1, y);
      const H = at(x, y + 1);
      if (B !== H && D !== F) {
        a += (D === B ? D : E) + (B === F ? F : E);
        b += (D === H ? D : E) + (H === F ? F : E);
      } else {
        a += E + E;
        b += E + E;
      }
    }
    out.push(a, b);
  }
  return out;
}

/** Draws a canvas scaled up without smoothing (for UI icons). */
export function scaled(src: Cnv, k: number): Cnv {
  const c = canvas(src.width * k, src.height * k);
  const g = ctx2d(c);
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/* ------------------------------------------------------------ pixel font */

// 3x5 glyphs, rows top to bottom, 1 = ink.
const GLYPHS: Record<string, string> = {
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '111001111100111',
  '3': '111001111001111',
  '4': '101101111001001',
  '5': '111100111001111',
  '6': '111100111101111',
  '7': '111001010010010',
  '8': '111101111101111',
  '9': '111101111001111',
  '+': '000010111010000',
  '-': '000000111000000',
  '!': '010010010000010',
  '?': '111001011000010',
  '.': '000000000000010',
  ',': '000000000010100',
  ':': '000010000010000',
  '/': '001001010100100',
  '%': '101001010100101',
  "'": '010010000000000',
  ' ': '000000000000000',
  A: '010101111101101',
  B: '110101110101110',
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '011100101101011',
  H: '101101111101101',
  I: '111010010010111',
  J: '001001001101010',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '110101101101101',
  O: '010101101101010',
  P: '110101110100100',
  Q: '010101101110011',
  R: '110101110101101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  Z: '111001010100111',
};

const glyphCache = new Map<string, Cnv>();

/** A word in the pixel font, colored, with a dark outline (cached). */
export function pixelText(text: string, color: string): Cnv {
  const key = `${text}|${color}`;
  const hit = glyphCache.get(key);
  if (hit) return hit;
  const t = text.toUpperCase();
  const rows: string[] = ['', '', '', '', ''];
  for (const ch of t) {
    const gl = GLYPHS[ch] ?? GLYPHS['?']!;
    for (let r = 0; r < 5; r++) rows[r] += gl.slice(r * 3, r * 3 + 3).replace(/1/g, 'x').replace(/0/g, '.') + '.';
  }
  const c = paint(
    rows.map((r) => r.slice(0, -1)),
    { x: color },
  );
  if (glyphCache.size > 400) glyphCache.clear();
  glyphCache.set(key, c);
  return c;
}
