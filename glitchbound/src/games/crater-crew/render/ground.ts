/**
 * Paints the destructible ground: a tiling texture per terrain (soil, sand strata, ice veins, cake
 * layers, rusty plates…), a grass / snow / frosting band along every upward surface, dark rims on
 * walls and ceilings, scorch marks around craters, and the scenery standing on it. Repaints only the
 * part a blast changed.
 */
import { hash01 } from '../math';
import { baseMask, decorSpots, H, isSolid, W, type DecorSpot, type Mask } from '../terrain';
import { TERRAINS, type Pattern, type TerrainDef, type TerrainId } from '../terrains';
import { drawDecor } from './decor';

const T = 256;

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Value noise that wraps every `period` cells, so the tile repeats seamlessly. */
function pnoise(seed: number, x: number, y: number, period: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const h = (a: number, b: number): number => hash01(seed, (((a % period) + period) % period) + (((b % period) + period) % period) * 1009);
  const top = h(i, j) + (h(i + 1, j) - h(i, j)) * sx;
  const bot = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * sx;
  return top + (bot - top) * sy;
}

function pfbm(seed: number, u: number, v: number, cells: number, oct = 3): number {
  let s = 0;
  let a = 1;
  let tot = 0;
  for (let o = 0; o < oct; o++) {
    const p = cells << o;
    s += pnoise(seed + o * 31, (u / T) * p, (v / T) * p, p) * a;
    tot += a;
    a *= 0.5;
  }
  return s / tot;
}

/** The ground's body texture, T x T, repeating. */
function makeTile(def: TerrainDef): Uint8ClampedArray {
  const light = hex(def.soil.light);
  const dark = hex(def.soil.dark);
  const speck = hex(def.soil.speck);
  const out = new Uint8ClampedArray(T * T * 4);
  const seed = def.id.length * 977 + def.id.charCodeAt(0);
  const P: Pattern = def.pattern;
  for (let v = 0; v < T; v++) {
    for (let u = 0; u < T; u++) {
      const n = pfbm(seed, u, v, 6, 3);
      let c: RGB;
      if (P === 'loam') {
        const strata = 0.5 + 0.5 * Math.sin(((v + pfbm(seed + 4, u, v, 3, 2) * 30) / T) * Math.PI * 2 * 5);
        c = mix(dark, light, clamp01(n * 1.3 - 0.2 + strata * 0.18));
      }
      else if (P === 'sand') {
        const band = 0.5 + 0.5 * Math.sin(((v + pfbm(seed + 3, u, v, 4, 2) * 40) / T) * Math.PI * 2 * 9);
        c = mix(dark, light, clamp01(band * 0.55 + n * 0.6 - 0.05));
      } else if (P === 'ice') {
        const r = 1 - Math.abs(2 * pfbm(seed + 5, u, v, 6, 3) - 1);
        c = mix(dark, light, clamp01(n * 1.2 - 0.1));
        if (r > 0.93) c = mix(c, speck, Math.min(1, (r - 0.93) * 14) * 0.8);
      } else if (P === 'basalt' || P === 'crystal') {
        const r = 1 - Math.abs(2 * pfbm(seed + 7, u, v, 6, 3) - 1);
        c = mix(dark, light, clamp01(n * 1.3 - 0.2));
        if (r > 0.95) c = mix(c, speck, Math.min(1, (r - 0.95) * 30));
        else if (r > 0.9) c = mix(c, speck, (r - 0.9) * 2.4);
      } else if (P === 'coral') c = mix(dark, light, clamp01(n * 1.4 - 0.15));
      else if (P === 'regolith') c = mix(dark, light, clamp01(n * 1.6 - 0.3));
      else if (P === 'cake') {
        const layer = v % 64;
        if (layer < 40) c = mix(dark, light, clamp01(n * 1.1 + 0.05));
        else if (layer < 47) c = mix(hex('#c2185b'), hex('#ff5c9a'), n);
        else c = mix(hex('#fde8f1'), hex('#fff8fb'), n);
      } else if (P === 'shale') {
        const band = 0.5 + 0.5 * Math.sin(((v + u * 0.35) / T) * Math.PI * 2 * 14 + n * 4);
        c = mix(dark, light, clamp01(band * 0.5 + n * 0.5));
      } else {
        // metal: rusty plates with seams
        const px = u % 64;
        const py = v % 32;
        const rust = pfbm(seed + 9, u, v, 8, 2);
        c = mix(hex('#6b7280'), hex('#9ca3af'), n);
        c = mix(c, mix(dark, light, n), clamp01(rust * 1.8 - 0.6));
        if (px < 2 || py < 2) c = mix(c, [30, 30, 34], 0.55);
        if ((px === 5 || px === 59) && (py === 5 || py === 27)) c = [210, 214, 220];
      }
      const i = (v * T + u) * 4;
      out[i] = c[0];
      out[i + 1] = c[1];
      out[i + 2] = c[2];
      out[i + 3] = 255;
    }
  }
  // pebbles, pores, craters, sprinkles: small round details
  const dot = (cx: number, cy: number, r: number, col: RGB, rim: RGB | null): void => {
    for (let dy = -r - 1; dy <= r + 1; dy++)
      for (let dx = -r - 1; dx <= r + 1; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r + 0.5) continue;
        const x = (((cx + dx) % T) + T) % T;
        const y = (((cy + dy) % T) + T) % T;
        const i = (y * T + x) * 4;
        const cc = rim && (d > r - 1 || dy > r * 0.4) ? rim : rim && dx + dy < -r * 0.7 ? mix(col, [255, 255, 255], 0.35) : col;
        out[i] = cc[0];
        out[i + 1] = cc[1];
        out[i + 2] = cc[2];
      }
  };
  const count = P === 'cake' ? 70 : P === 'regolith' ? 26 : P === 'metal' ? 0 : 34;
  for (let k = 0; k < count; k++) {
    const x = Math.floor(hash01(seed + 101, k) * T);
    const y = Math.floor(hash01(seed + 202, k) * T);
    const r = 1 + Math.floor(hash01(seed + 303, k) * (P === 'regolith' ? 6 : P === 'loam' || P === 'shale' ? 5 : 3));
    if (P === 'cake') {
      if (y % 64 < 48) continue;
      const cols: RGB[] = [hex('#ff4d8d'), hex('#4dd2ff'), hex('#ffe14d'), hex('#7cff6b'), hex('#b26bff')];
      dot(x, y, 1, cols[k % cols.length]!, null);
    } else if (P === 'regolith') dot(x, y, r, mix(dark, light, 0.75), dark);
    else if (P === 'coral') dot(x, y, r, mix(dark, [40, 30, 20], 0.35), null);
    else dot(x, y, r, speck, mix(dark, [0, 0, 0], 0.3));
  }
  return out;
}

/** The painted ground of one battle, kept in step with the world's mask. */
export class GroundPainter {
  readonly canvas: HTMLCanvasElement;
  readonly decor: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly img: ImageData;
  private readonly tile: Uint8ClampedArray;
  private readonly burn = new Uint8Array(W * H);
  private readonly def: TerrainDef;
  private spots: DecorSpot[];
  private readonly top: RGB;
  private readonly hi: RGB;
  private readonly rim: RGB;
  private readonly wobble = new Float32Array(W);
  /** How deep below the map's original surface each pixel lies (255: deeper). Fresh craters show bare soil, not grass. */
  private readonly depth = new Uint8Array(W * H);
  /** Caves (Crystal Hollow): the map's first surface per column; air below it shows the cave wall. */
  private readonly caveTop: Int16Array | null;
  private readonly wall: RGB;

  constructor(
    terrain: TerrainId,
    private mask: Mask,
    seed: number,
  ) {
    this.def = TERRAINS[terrain];
    this.tile = makeTile(this.def);
    this.top = hex(this.def.top.color);
    this.hi = hex(this.def.top.hi);
    this.rim = hex(this.def.soil.rim);
    for (let x = 0; x < W; x++) this.wobble[x] = (hash01(seed ^ 0x77, x >> 3) * 0.6 + hash01(seed ^ 0x99, x) * 0.4) * 4;
    const base = baseMask(seed, terrain);
    this.wall = mix(hex(this.def.soil.dark), [26, 20, 58], 0.35);
    this.caveTop = this.def.pattern === 'crystal' ? new Int16Array(W).fill(H) : null;
    if (this.caveTop)
      for (let x = 0; x < W; x++)
        for (let y = 0; y < H; y++)
          if (base[y * W + x] === 1) {
            this.caveTop[x] = y + 6;
            break;
          }
    for (let x = 0; x < W; x++) {
      let d = 0;
      for (let y = 0; y < H; y++) {
        const i = y * W + x;
        d = base[i] === 1 ? Math.min(255, d + 1) : 0;
        this.depth[i] = d;
      }
    }
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d')!;
    this.img = this.ctx.createImageData(W, H);
    this.decor = document.createElement('canvas');
    this.decor.width = W;
    this.decor.height = H;
    this.spots = decorSpots(mask, terrain, seed);
  }

  /** Follow a rebuilt world whose ground is the same as painted. */
  setMask(mask: Mask): void {
    this.mask = mask;
  }

  /** Follow a new mask (a rebuilt world), painting it all again. */
  reset(mask: Mask, craters: readonly number[]): void {
    this.mask = mask;
    this.burn.fill(0);
    for (let i = 0; i + 2 < craters.length; i += 3) this.scorch(craters[i]!, craters[i + 1]!, craters[i + 2]!);
    this.spots = this.spots.filter((s) => isSolid(mask, s.x, s.y + 2) && isSolid(mask, s.x - 3, s.y + 3) && isSolid(mask, s.x + 3, s.y + 3));
    this.paint(0, 0, W - 1, H - 1);
    this.drawDecor();
  }

  private scorch(cx: number, cy: number, r: number): void {
    const R = r + 9;
    for (let y = Math.max(0, cy - R); y <= Math.min(H - 1, cy + R); y++)
      for (let x = Math.max(0, cx - R); x <= Math.min(W - 1, cx + R); x++) {
        const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
        if (d > R || d < r - 1) continue;
        const k = 1 - (d - r) / 9;
        const i = y * W + x;
        this.burn[i] = Math.min(220, this.burn[i]! + Math.round(170 * k * (0.75 + hash01(cx * 31 + cy, i) * 0.5)));
      }
  }

  /** A blast changed the mask around (cx, cy). */
  blast(cx: number, cy: number, r: number): void {
    this.scorch(cx, cy, r);
    this.paint(cx - r - 12, cy - r - 12, cx + r + 12, cy + r + 40);
    const before = this.spots.length;
    this.spots = this.spots.filter((s) => (s.x - cx) * (s.x - cx) + (s.y - 6 - cy) * (s.y - 6 - cy) > (r + 6) * (r + 6) && isSolid(this.mask, s.x, s.y + 2));
    if (this.spots.length !== before) this.drawDecor();
  }

  private drawDecor(): void {
    const c = this.decor.getContext('2d')!;
    c.clearRect(0, 0, W, H);
    for (const s of this.spots) {
      c.save();
      c.translate(s.x, s.y);
      c.scale(s.flip ? -s.s : s.s, s.s);
      drawDecor(c, s.kind, s.x);
      c.restore();
    }
  }

  paint(x0: number, y0: number, x1: number, y1: number): void {
    x0 = Math.max(0, Math.floor(x0));
    y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(W - 1, Math.ceil(x1));
    y1 = Math.min(H - 1, Math.ceil(y1));
    if (x1 < x0 || y1 < y0) return;
    const m = this.mask;
    const data = this.img.data;
    const band = this.def.top.depth;
    const tile = this.tile;
    const depth = this.depth;
    for (let x = x0; x <= x1; x++) {
      const edge = band + this.wobble[x]!;
      for (let y = y0; y <= y1; y++) {
        const i = y * W + x;
        const o = i * 4;
        if (m[i] !== 1) {
          if (this.caveTop && y > this.caveTop[x]! && y < H - 30) {
            const ti = ((y & (T - 1)) * T + (x & (T - 1))) * 4;
            const k = (tile[ti]! + tile[ti + 1]! + tile[ti + 2]!) / 765;
            const w = mix(this.wall, [0, 0, 0], 0.25 - k * 0.3);
            data[o] = w[0];
            data[o + 1] = w[1];
            data[o + 2] = w[2];
            data[o + 3] = 255;
          } else data[o + 3] = 0;
          continue;
        }
        const d = depth[i]!;
        let c: RGB;
        if (d <= edge) {
          c = d <= 2 ? this.hi : d >= edge - 1.5 ? mix(this.top, [0, 0, 0], 0.22) : this.top;
          const ti = ((y & (T - 1)) * T + (x & (T - 1))) * 4;
          const tn = (tile[ti]! + tile[ti + 1]! + tile[ti + 2]!) / 765;
          c = mix(c, [255, 255, 255], (tn - 0.5) * 0.12);
        } else {
          const ti = ((y & (T - 1)) * T + (x & (T - 1))) * 4;
          c = [tile[ti]!, tile[ti + 1]!, tile[ti + 2]!];
          // deeper is a little darker
          const k = Math.min(d, 140) / 140;
          c = mix(c, [0, 0, 0], k * 0.22);
          if (d <= edge + 3) c = mix(c, [0, 0, 0], 0.18);
        }
        // walls, ceilings and freshly blasted ground get a dark rim
        const open = (x > 0 && m[i - 1] !== 1) || (x < W - 1 && m[i + 1] !== 1) || (y < H - 1 && m[i + W] !== 1) || (d > edge && y > 0 && m[i - W] !== 1);
        if (open && d > 2) c = mix(c, this.rim, 0.55);
        const b = this.burn[i]!;
        if (b) c = mix(c, [24, 14, 10], (b / 255) * 0.85);
        data[o] = c[0];
        data[o + 1] = c[1];
        data[o + 2] = c[2];
        data[o + 3] = 255;
      }
    }
    this.ctx.putImageData(this.img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  }
}
