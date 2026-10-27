import type { Accent } from '../src/catalog/types';
import { CARD_ACCENTS, CARD_INK } from '../src/platform/accents';
import { OG_FONTS } from './ogFont';

/**
 * Link-preview pictures (og:image) for shared links: the invite or result itself, typed on a card
 * in the game's colors, so a chat shows the message as a picture under the bare link. Drawn here
 * from what the server knows (never from an uploaded picture), as a palette PNG: no font engine,
 * no canvas, a few milliseconds of work, cached at the edge by the caller.
 */

export const OG_W = 1200;
export const OG_H = 630;

export interface OgCard {
  /** The big line: "Ana challenges you to beat 1,234 in Wing It". */
  headline: string;
  /** Smaller lines under it (a result grid of colored squares is drawn as squares). */
  lines?: string[];
  game?: { title: string; accent: Accent };
  /** The button at the bottom ("Can you beat it?"). */
  cta?: string;
}

/* ------------------------------------------------------------------ the letters */

interface Glyph {
  adv: number;
  x: number;
  y: number;
  w: number;
  h: number;
  data: Uint8Array;
}
interface Font {
  size: number;
  glyphs: Map<number, Glyph>;
}
type FontName = keyof typeof OG_FONTS;

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(bytes as BodyInit).body!.pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

let fonts: Promise<Record<FontName, Font>> | null = null;

/** The two fonts, unpacked once per worker. */
function loadFonts(): Promise<Record<FontName, Font>> {
  fonts ??= (async () => {
    const out = {} as Record<FontName, Font>;
    for (const name of Object.keys(OG_FONTS) as FontName[]) {
      const bin = await inflate(Uint8Array.from(atob(OG_FONTS[name].data), (c) => c.charCodeAt(0)));
      const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
      const glyphs = new Map<number, Glyph>();
      for (let o = 0; o + 8 <= bin.length; ) {
        const w = bin[o + 6]!;
        const h = bin[o + 7]!;
        glyphs.set(view.getUint16(o, true), { adv: view.getUint16(o + 2, true) / 8, x: view.getInt8(o + 4), y: view.getInt8(o + 5), w, h, data: bin.subarray(o + 8, o + 8 + w * h) });
        o += 8 + w * h;
      }
      out[name] = { size: OG_FONTS[name].size, glyphs };
    }
    return out;
  })();
  return fonts;
}

/** Emoji have no letters here: result squares (and a few marks) become colored shapes, the rest is left out. */
const SHAPES: Record<string, { color: string; round?: true }> = {
  '🟩': { color: '#22b35e' },
  '🟨': { color: '#ffc928' },
  '🟥': { color: '#ff5a6c' },
  '🟦': { color: '#3d5bff' },
  '🟧': { color: '#ff6a1a' },
  '🟪': { color: '#7b4dff' },
  '🟫': { color: '#9b6a3c' },
  '⬛': { color: CARD_INK },
  '⬜': { color: '#ddd6ec' },
  '✅': { color: '#22b35e' },
  '❌': { color: '#ff5a6c' },
  '💥': { color: '#ff5a6c', round: true },
  '🥇': { color: '#ffc928', round: true },
  '🥈': { color: '#b9b4c7', round: true },
  '🥉': { color: '#d08a4c', round: true },
  '🎯': { color: '#22b35e', round: true },
};
/** Marks that have a letter of their own. */
const AS_TEXT: Record<string, string> = { '🔼': '↑', '🔽': '↓', '⬆': '↑', '⬇': '↓', '➡': '→', '⬅': '←', '✔': '✓', '✖': '✗' };
const CLUSTER = /\p{Extended_Pictographic}(?:\ufe0f|\p{Emoji_Modifier}|\u200d\p{Extended_Pictographic}\ufe0f?)*|\ufe0f|\u20e3|\u200d|./gsu;

type Token = { glyph: Glyph } | { shape: (typeof SHAPES)[string] } | { space: true };

function tokens(font: Font, text: string): Token[] {
  const out: Token[] = [];
  for (const [part] of text.replace(/\s+/g, ' ').matchAll(CLUSTER)) {
    const cp = part.codePointAt(0)!;
    const bare = part.replace(/\ufe0f/g, '');
    const shape = SHAPES[bare];
    const glyph = font.glyphs.get(AS_TEXT[bare]?.codePointAt(0) ?? cp);
    if (shape) out.push({ shape });
    else if (part === ' ') out.push({ space: true });
    else if (glyph) out.push({ glyph });
  }
  // A left-out emoji may leave a space at an end ("🔥 5 day streak"), which would push the line off centre.
  while (out[0] && 'space' in out[0]) out.shift();
  while (out.length && 'space' in out[out.length - 1]!) out.pop();
  return out;
}

const SPACE = 0.26;
const SHAPE_ADV = 1.0;
const advance = (font: Font, t: Token, size: number): number => ('glyph' in t ? (t.glyph.adv * size) / font.size : 'shape' in t ? size * SHAPE_ADV : size * SPACE);

/** Width of a text at a size. */
export function measure(font: Font, text: string, size: number): number {
  return tokens(font, text).reduce((w, t) => w + advance(font, t, size), 0);
}

function greedy(font: Font, words: string[], size: number, maxW: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || measure(font, next, size) <= maxW) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Splits a text into lines no wider than `maxW`, evened out (no word left alone on the last line);
 * the last kept line ends with … when it ran over.
 */
export function wrap(font: Font, text: string, size: number, maxW: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  let lines = greedy(font, words, size, maxW);
  if (lines.length > 1 && lines.length <= maxLines) {
    for (let w = maxW - 16; w > maxW * 0.5; w -= 16) {
      const tried = greedy(font, words, size, w);
      if (tried.length !== lines.length) break;
      lines = tried;
    }
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = `${kept[maxLines - 1]!}…`;
  while (measure(font, last, size) > maxW && last.includes(' ')) last = `${last.slice(0, last.lastIndexOf(' '))}…`;
  kept[maxLines - 1] = last;
  return kept;
}

/* ------------------------------------------------------------------ the picture */

const rgb = (hex: string): number => parseInt(hex.slice(1), 16);
const mix = (a: number, b: number, k: number): number => {
  const ch = (s: number): number => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** An indexed-color image: every pixel is a palette entry (at most 256, near colors merge when full). */
class Picture {
  readonly px = new Uint8Array(OG_W * OG_H);
  readonly palette: number[] = [];
  private readonly index = new Map<number, number>();
  /** For each color and coverage step: what every palette entry becomes with that color over it. */
  private readonly luts = new Map<number, Int16Array>();

  color(c: number): number {
    const known = this.index.get(c);
    if (known !== undefined) return known;
    if (this.palette.length < 256) {
      this.palette.push(c);
      this.index.set(c, this.palette.length - 1);
      return this.palette.length - 1;
    }
    let best = 0;
    let bestD = Infinity;
    this.palette.forEach((p, i) => {
      const d = (((p >> 16) & 255) - ((c >> 16) & 255)) ** 2 + (((p >> 8) & 255) - ((c >> 8) & 255)) ** 2 + ((p & 255) - (c & 255)) ** 2;
      if (d < bestD) [best, bestD] = [i, d];
    });
    this.index.set(c, best);
    return best;
  }

  /** Paints `c` over pixels `from`..`to` (exclusive) with coverage `step`/15 (16 steps, so blends stay few). */
  blend(from: number, c: number, step: number, to = from + 1): void {
    if (step <= 0) return;
    if (step >= 15) {
      this.px.fill(this.color(c), from, to);
      return;
    }
    const key = c * 16 + step;
    let lut = this.luts.get(key);
    if (!lut) this.luts.set(key, (lut = new Int16Array(256).fill(-1)));
    const px = this.px;
    for (let i = from; i < to; i++) {
      const base = px[i]!;
      let out = lut[base]!;
      if (out < 0) out = lut[base] = this.color(mix(this.palette[base]!, c, step / 15));
      px[i] = out;
    }
  }

  /**
   * A rounded rectangle, smooth at its edges (on the background, in 4 steps: blends with every
   * band of the gradient would fill the palette); `alpha` tints what is under it instead of covering
   * it. Only pixels inside `clip` ([x0, y0, x1, y1]) are painted.
   */
  roundRect(x: number, y: number, w: number, h: number, r: number, c: number, alpha = 1, clip = [0, 0, OG_W, OG_H]): void {
    const step = (cover: number): number => Math.round(Math.round(Math.max(0, Math.min(1, cover)) * 3) * 5 * alpha);
    const x0 = Math.max(clip[0]!, Math.floor(x));
    const x1 = Math.min(clip[2]!, Math.ceil(x + w));
    for (let py = Math.max(clip[1]!, Math.floor(y)); py < Math.min(clip[3]!, Math.ceil(y + h)); py++) {
      const cy = py + 0.5;
      const dy = cy < y + r ? y + r - cy : cy > y + h - r ? cy - (y + h - r) : 0;
      const vy = Math.min(1, cy - y + 0.5, y + h - cy + 0.5);
      const row = py * OG_W;
      // The middle of the row (straight edges only above and below) is one run.
      const in0 = Math.max(x0, Math.ceil(x + 0.5), dy > 0 ? Math.ceil(x + r - 0.5) : 0);
      const in1 = Math.min(x1, Math.floor(x + w - 0.5), dy > 0 ? Math.floor(x + w - r - 0.5) + 1 : OG_W);
      const mid = step(dy > 0 ? r - dy + 0.5 : vy);
      this.blend(row + in0, c, mid, row + Math.max(in0, in1));
      for (let px = x0; px < x1; px++) {
        if (px === in0) px = Math.max(in0, in1);
        if (px >= x1) break;
        const cx = px + 0.5;
        const dx = cx < x + r ? x + r - cx : cx > x + w - r ? cx - (x + w - r) : 0;
        const cover = dx > 0 && dy > 0 ? r - Math.sqrt(dx * dx + dy * dy) + 0.5 : Math.min(cx - x + 0.5, x + w - cx + 0.5, dy > 0 ? r - dy + 0.5 : vy);
        this.blend(row + px, c, step(cover));
      }
    }
  }

  /** Text on one line from (x, baseline); returns where it ended. */
  text(font: Font, text: string, x: number, base: number, size: number, c: number): number {
    let pen = x;
    for (const t of tokens(font, text)) {
      if ('glyph' in t) this.glyph(scaled(font, t.glyph, size), Math.round(pen), Math.round(base), c);
      else if ('shape' in t) {
        const s = Math.round(size * 0.82);
        this.roundRect(Math.round(pen + (size * SHAPE_ADV - s) / 2), Math.round(base - size * 0.74), s, s, t.shape.round ? s / 2 : s * 0.2, rgb(t.shape.color));
      }
      pen += advance(font, t, size);
    }
    return pen;
  }

  private glyph(g: Scaled, pen: number, base: number, c: number): void {
    for (let y = 0; y < g.h; y++) {
      const py = base + g.y + y;
      if (py < 0 || py >= OG_H) continue;
      for (let x = 0; x < g.w; x++) {
        const px = pen + g.x + x;
        const v = g.data[y * g.w + x]!;
        if (v && px >= 0 && px < OG_W) this.blend(py * OG_W + px, c, v);
      }
    }
  }
}

/** A letter at the size it is set in: coverage in 16 steps (0..15). */
interface Scaled {
  x: number;
  y: number;
  w: number;
  h: number;
  data: Uint8Array;
}
const scaledCache = new WeakMap<Glyph, Map<number, Scaled>>();

/** Area-averaged resize of a run of `n` samples (stride `step`) by `k`; `shift` is where the first sample starts. */
function resample(src: Float32Array, n: number, k: number, shift: number, out: Float32Array, outStride: number, srcStride: number, srcOff: number, outOff: number): void {
  for (let s = 0; s < n; s++) {
    const v = src[srcOff + s * srcStride]!;
    if (!v) continue;
    const a = shift + s * k;
    const b = a + k;
    for (let o = Math.floor(a); o < b; o++) out[outOff + o * outStride]! += v * (Math.min(b, o + 1) - Math.max(a, o));
  }
}

function scaled(font: Font, g: Glyph, size: number): Scaled {
  let bySize = scaledCache.get(g);
  if (!bySize) scaledCache.set(g, (bySize = new Map()));
  const hit = bySize.get(size);
  if (hit) return hit;
  const k = size / font.size;
  // Keep the letter's position to the pixel: the fraction of its offset becomes a shift inside the box.
  const fx = g.x * k;
  const fy = g.y * k;
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  const w = Math.ceil(fx - x + g.w * k);
  const h = Math.ceil(fy - y + g.h * k);
  const src = Float32Array.from(g.data);
  const rows = new Float32Array(w * g.h);
  for (let r = 0; r < g.h; r++) resample(src, g.w, k, fx - x, rows, 1, 1, r * g.w, r * w);
  const out = new Float32Array(w * h);
  for (let col = 0; col < w; col++) resample(rows, g.h, k, fy - y, out, w, w, col, col);
  const data = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) data[i] = Math.min(15, Math.round((out[i]! / 255) * 15));
  const result = { x, y, w, h, data };
  bySize.set(size, result);
  return result;
}

/* ------------------------------------------------------------------ PNG */

const CRC = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < 8 + data.length; i++) crc = CRC[(crc ^ out[i]!) & 255]! ^ (crc >>> 8);
  view.setUint32(8 + data.length, (crc ^ 0xffffffff) >>> 0);
  return out;
}

/* PNG data is a zlib stream: here one fixed-Huffman block whose only matches are runs (distance 1),
 * about a millisecond for a whole card where a full deflate takes several (a Worker has 10 ms of CPU). */
const rev = (v: number, n: number): number => {
  let r = 0;
  for (let i = 0; i < n; i++) r = (r << 1) | ((v >> i) & 1);
  return r;
};
const LIT_CODE = Uint32Array.from({ length: 256 }, (_, v) => (v < 144 ? rev(0x30 + v, 8) : rev(0x190 + v - 144, 9)));
const LIT_BITS = Uint8Array.from({ length: 256 }, (_, v) => (v < 144 ? 8 : 9));
const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
/** A run of `length` (3..258) copies of the previous byte: length code and extra bits, then distance code 0 (five 0 bits). */
const RUN_CODE = new Uint32Array(259);
const RUN_BITS = new Uint8Array(259);
for (let len = 3; len <= 258; len++) {
  let i = LBASE.length - 1;
  while (LBASE[i]! > len) i--;
  const sym = 257 + i;
  const [code, n] = sym <= 279 ? [rev(sym - 256, 7), 7] : [rev(0xc0 + sym - 280, 8), 8];
  RUN_CODE[len] = code | ((len - LBASE[i]!) << n);
  RUN_BITS[len] = n + LEXTRA[i]! + 5;
}

/** Writes Huffman codes and extra bits into a byte array, low bit first. */
class Bits {
  out = new Uint8Array(1 << 16);
  o = 0;
  private acc = 0;
  private n = 0;
  /** Room for `bytes` more (a card packs to a few tens of KB; the buffer grows if one does not). */
  room(bytes: number): void {
    if (this.o + bytes <= this.out.length) return;
    const bigger = new Uint8Array(Math.max(this.out.length * 2, this.o + bytes));
    bigger.set(this.out.subarray(0, this.o));
    this.out = bigger;
  }
  put(code: number, bits: number): void {
    this.acc |= code << this.n;
    this.n += bits;
    while (this.n >= 8) {
      this.out[this.o++] = this.acc & 255;
      this.acc >>>= 8;
      this.n -= 8;
    }
  }
  /** `count` copies of byte `v`, which the stream already holds just before them. */
  repeat(v: number, count: number): void {
    for (; count >= 258 + 3 || count === 258; count -= 258) this.put(RUN_CODE[258]!, RUN_BITS[258]!);
    if (count > 258) {
      // 259 or 260: one shorter run, so the rest is still a run of at least 3.
      this.put(RUN_CODE[count - 3]!, RUN_BITS[count - 3]!);
      count = 3;
    }
    if (count >= 3) this.put(RUN_CODE[count]!, RUN_BITS[count]!);
    else for (; count > 0; count--) this.put(LIT_CODE[v]!, LIT_BITS[v]!);
  }
  end(): void {
    this.put(0, 7); // end of block
    if (this.n > 0) this.put(0, 8 - this.n);
  }
}

/**
 * The image data (rows of palette indexes, each after its filter byte) as a zlib stream, in one
 * pass: rows after the first use the "up" filter, so a row like the one above is a run of zeros,
 * counted in a tight loop.
 */
export function zlibRows(px: Uint8Array, w: number, h: number): Uint8Array {
  const bits = new Bits();
  bits.put(0x0178, 16); // zlib header
  bits.put(0b011, 3); // the final block, fixed Huffman codes
  // The pixels as 32-bit words, to compare four at a time with the row above.
  const words = px.byteOffset % 4 === 0 && w % 4 === 0 ? new Uint32Array(px.buffer, px.byteOffset, (w * h) >> 2) : null;
  let a = 1;
  let b = 0;
  let prev = -1;
  let run = 0;
  for (let y = 0; y < h; y++) {
    bits.room(Math.ceil(((w + 1) * 9) / 8) + 64);
    const row = y * w;
    const up = y ? w : 0;
    for (let x = -1; x < w; ) {
      const v = x < 0 ? (y ? 2 : 0) : (px[row + x]! - (up ? px[row + x - up]! : 0)) & 255;
      if (v === prev) {
        // The run goes on: count it, and add it to the checksum in one step.
        const from = x;
        x++;
        if (up && v === 0) {
          // The same as the row above: four pixels at a time once aligned.
          while (x < w && (x & 3) !== 0 && px[row + x] === px[row + x - up]) x++;
          if (words && (x & 3) === 0) for (let i = (row + x) >> 2; x + 4 <= w && words[i] === words[i - (w >> 2)]; i++) x += 4;
          while (x < w && px[row + x] === px[row + x - up]) x++;
        } else if (up) while (x < w && ((px[row + x]! - px[row + x - up]!) & 255) === v) x++;
        else while (x < w && px[row + x] === v) x++;
        const n = x - from;
        b += n * a + (v * n * (n + 1)) / 2;
        a += n * v;
        run += n;
        continue;
      }
      bits.repeat(prev, run);
      run = 0;
      bits.put(LIT_CODE[v]!, LIT_BITS[v]!);
      prev = v;
      a += v;
      b += a;
      x++;
    }
    a %= 65521;
    b %= 65521;
  }
  bits.repeat(prev, run);
  bits.end();
  bits.room(4);
  new DataView(bits.out.buffer).setUint32(bits.o, ((b << 16) | a) >>> 0);
  return bits.out.subarray(0, bits.o + 4);
}

function encodePng(pic: Picture): Uint8Array<ArrayBuffer> {
  const head = new Uint8Array(13);
  const hv = new DataView(head.buffer);
  hv.setUint32(0, OG_W);
  hv.setUint32(4, OG_H);
  head.set([8, 3, 0, 0, 0], 8);
  const plte = new Uint8Array(pic.palette.length * 3);
  pic.palette.forEach((c, i) => plte.set([(c >> 16) & 255, (c >> 8) & 255, c & 255], i * 3));
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('PLTE', plte), chunk('IDAT', zlibRows(pic.px, OG_W, OG_H)), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/* ------------------------------------------------------------------ the card */

const INK = rgb(CARD_INK);
const CREAM = rgb('#fffaf2');
const MUTED = rgb('#4a3f66');
const WHITE = 0xffffff;
const LIME = rgb('#c4f034');

/** Draws a link-preview card: the game's colors, the brand and game in stickers, the message on a panel, a button. */
export async function renderOgCard(card: OgCard): Promise<Uint8Array<ArrayBuffer>> {
  const f = await loadFonts();
  const pic = new Picture();
  const [a1, a2] = (card.game ? CARD_ACCENTS[card.game.accent] : CARD_ACCENTS.cyan).map(rgb) as [number, number];
  // The solid colors first, so they keep their own palette entries whatever else is drawn.
  const text = [card.headline, ...(card.lines ?? [])].join(' ');
  for (const c of [INK, CREAM, MUTED, WHITE, LIME, ...Object.entries(SHAPES).flatMap(([e, sh]) => (text.includes(e) ? [rgb(sh.color)] : []))]) pic.color(c);

  // Background: the accent gradient in 24 bands (one palette entry each), a light grain of dots.
  const row = new Uint8Array(OG_W);
  for (let x = 0; x < OG_W; x++) row[x] = pic.color(mix(a1, a2, Math.round((x / (OG_W - 1)) * 23) / 23));
  for (let y = 0; y < OG_H; y++) pic.px.set(row, y * OG_W);
  for (let y = 18; y < OG_H; y += 36) for (let x = (y / 36) % 2 >= 1 ? 18 : 0; x < OG_W; x += 36) pic.roundRect(x, y, 3, 3, 0, WHITE, 0.12);

  // Stickers: GlitchBound on the left, the game on the right.
  const sticker = (label: string, right: boolean): void => {
    const size = 30;
    const w = Math.round(measure(f.bold, label, size) + 44);
    const x = right ? OG_W - 48 - w : 48;
    pic.roundRect(x + 4, 34 + 6, w, 56, 28, INK);
    pic.roundRect(x, 34, w, 56, 28, INK);
    pic.text(f.bold, label, x + 22, 34 + 38, size, WHITE);
  };
  sticker('GlitchBound', false);
  if (card.game) sticker(wrap(f.bold, card.game.title, 30, 480, 1)[0] ?? '', true);

  // The panel, with an ink outline and a hard shadow.
  const px = 48;
  const py = 120;
  const pw = OG_W - px * 2;
  const ph = card.cta ? 366 : 450;
  // (The shadow only where the panel will not cover it.)
  pic.roundRect(px + 12, py + 14, pw, ph, 40, INK, 0.25, [px + pw - 40, 0, OG_W, py + ph - 40]);
  pic.roundRect(px + 12, py + 14, pw, ph, 40, INK, 0.25, [0, py + ph - 40, OG_W, OG_H]);
  pic.roundRect(px, py, pw, ph, 40, INK);
  pic.roundRect(px + 6, py + 6, pw - 12, ph - 12, 34, CREAM);

  // The message: the headline as large as fits in three lines, then the details; centred.
  const maxW = pw - 120;
  const room = ph - 64;
  type Row = { text: string; font: Font; size: number; color: number; h: number };
  let rows: Row[] = [];
  for (const size of [64, 56, 50, 44, 40]) {
    const head = wrap(f.bold, card.headline, size, maxW, 3);
    rows = head.map((text) => ({ text, font: f.bold, size, color: INK, h: Math.round(size * 1.18) }));
    if (rows.length * rows[0]!.h <= room * 0.62 || size === 40) break;
  }
  const details = (card.lines ?? []).filter((l) => tokens(f.text, l).some((t) => !('space' in t)));
  if (details.length) rows.push({ text: '', font: f.text, size: 0, color: MUTED, h: 14 });
  for (const line of details) for (const text of wrap(f.text, line, 34, maxW, 2)) rows.push({ text, font: f.text, size: 34, color: MUTED, h: 46 });
  let used = rows.reduce((n, r) => n + r.h, 0);
  while (used > room && rows.length > 1) used -= rows.pop()!.h;
  let y = py + 32 + Math.max(0, (room - used) / 2);
  for (const r of rows) {
    if (r.text) pic.text(r.font, r.text, OG_W / 2 - measure(r.font, r.text, r.size) / 2, y + r.size * 0.92, r.size, r.color);
    y += r.h;
  }

  // The button.
  if (card.cta) {
    const size = 36;
    const label = wrap(f.bold, card.cta, size, 700, 1)[0] ?? '';
    const w = Math.round(measure(f.bold, label, size) + 88);
    const x = Math.round((OG_W - w) / 2);
    const top = py + ph + 26;
    pic.roundRect(x + 6, top + 8, w, 72, 36, INK);
    pic.roundRect(x, top, w, 72, 36, INK);
    pic.roundRect(x + 5, top + 5, w - 10, 62, 31, LIME);
    pic.text(f.bold, label, x + 44, top + 49, size, INK);
  }
  return encodePng(pic);
}

/** For tests: the fonts' letters (to check what can be typed). */
export const ogFonts = loadFonts;
