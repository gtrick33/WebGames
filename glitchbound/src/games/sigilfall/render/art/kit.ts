import { canvas, ctx2d, type Cnv } from '../pixel';

/**
 * The art kit: everything newer art is painted with. A Painter is an RGBA buffer of art pixels with
 * the few shapes pixel art needs (filled discs and ellipses, polygons, lines, sphere and cylinder
 * shading with ordered dithering) and a final outline pass. Colors come in hue-shifted ramps (warm,
 * lighter highlights; cool, darker shadows), which is most of what makes flat shapes read as painted.
 * Light comes from the top left.
 */

export type RGB = [number, number, number];

export const OUTLINE_RGB: RGB = [27, 20, 40];

export function rgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const hex = (c: RGB): string => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

export function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function toHsl([r, g, b]: RGB): [number, number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h /= 6;
  return [h, s, l];
}

function fromHsl([h, s, l]: [number, number, number]): RGB {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const f = (p: number, q: number, t: number): number => {
    let u = t;
    if (u < 0) u += 1;
    if (u > 1) u -= 1;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
}

/** Shifts a color's lightness (and hue: lighter toward warm yellow, darker toward cool blue-violet). */
export function tone(c: RGB, k: number): RGB {
  const [h, s, l] = toHsl(c);
  // hue moves toward 1/6 (yellow) when lighter, toward 0.7 (blue-violet) when darker
  const target = k > 0 ? 1 / 6 : 0.7;
  let dh = target - h;
  if (dh > 0.5) dh -= 1;
  if (dh < -0.5) dh += 1;
  const nh = (h + dh * Math.min(0.35, Math.abs(k) * 0.45) + 1) % 1;
  const ns = Math.max(0, Math.min(1, s * (k > 0 ? 1 - k * 0.25 : 1 + Math.abs(k) * 0.15)));
  const nl = Math.max(0, Math.min(1, l + k * (k > 0 ? 1 - l : l)));
  return fromHsl([nh, ns, nl]);
}

/** Five steps from highlight to deep shadow around a base color: [hi, light, base, shade, deep]. */
export type Ramp = [RGB, RGB, RGB, RGB, RGB];

export function ramp(base: string | RGB): Ramp {
  const c = typeof base === 'string' ? rgb(base) : base;
  return [tone(c, 0.45), tone(c, 0.2), c, tone(c, -0.28), tone(c, -0.52)];
}

/** 4×4 ordered dither: true where a tone `t` (0..1) of the lighter color should show. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const dither = (x: number, y: number, t: number): boolean => (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16 < t;

export class Painter {
  readonly w: number;
  readonly h: number;
  readonly d: Uint8ClampedArray;

  constructor(w: number, h: number) {
    this.w = Math.max(1, Math.ceil(w));
    this.h = Math.max(1, Math.ceil(h));
    this.d = new Uint8ClampedArray(this.w * this.h * 4);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x: number, y: number, c: RGB, a = 255): void {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    if (!this.inside(X, Y)) return;
    const o = (Y * this.w + X) * 4;
    if (a >= 255) {
      this.d[o] = c[0];
      this.d[o + 1] = c[1];
      this.d[o + 2] = c[2];
      this.d[o + 3] = 255;
      return;
    }
    // blend over what is there
    const k = a / 255;
    const old = this.d[o + 3]! / 255;
    const outA = k + old * (1 - k);
    if (outA <= 0) return;
    for (let i = 0; i < 3; i++) this.d[o + i] = (c[i]! * k + this.d[o + i]! * old * (1 - k)) / outA;
    this.d[o + 3] = outA * 255;
  }

  /** Alpha at a pixel (0 outside). */
  alpha(x: number, y: number): number {
    if (!this.inside(x, y)) return 0;
    return this.d[(y * this.w + x) * 4 + 3]!;
  }

  color(x: number, y: number): RGB {
    const o = (y * this.w + x) * 4;
    return [this.d[o]!, this.d[o + 1]!, this.d[o + 2]!];
  }

  clear(x: number, y: number): void {
    if (!this.inside(x, y)) return;
    this.d[(y * this.w + x) * 4 + 3] = 0;
  }

  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) for (let xx = Math.round(x); xx < Math.round(x + w); xx++) this.set(xx, yy, c);
  }

  /** A filled ellipse; `paint` decides each pixel's color (for shading), given its offset from the center. */
  ellipse(cx: number, cy: number, rx: number, ry: number, paint: RGB | ((dx: number, dy: number, x: number, y: number) => RGB | null)): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        const c = typeof paint === 'function' ? paint(dx, dy, x, y) : paint;
        if (c) this.set(x, y, c);
      }
    }
  }

  disc(cx: number, cy: number, r: number, paint: RGB | ((dx: number, dy: number, x: number, y: number) => RGB | null)): void {
    this.ellipse(cx, cy, r, r, paint);
  }

  /** A shaded ball: lit from the top left, dithered between the ramp's steps. */
  ball(cx: number, cy: number, rx: number, ry: number, r: Ramp, opts: { light?: number; rim?: boolean } = {}): void {
    const lift = opts.light ?? 0;
    this.ellipse(cx, cy, rx, ry, (dx, dy, x, y) => {
      // light from up-left: brightness from the surface normal
      const nz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
      let b = (-dx * 0.55 - dy * 0.65 + nz * 0.55) * 0.9 + lift;
      if (opts.rim && dx * dx + dy * dy > 0.82 && dx + dy > 0.3) b -= 0.25;
      return shadeAt(r, b, x, y);
    });
  }

  /** A filled polygon (even-odd). */
  poly(pts: [number, number][], paint: RGB | ((x: number, y: number) => RGB | null)): void {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys));
    const y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i]!;
        const [bx, by] = pts[(i + 1) % pts.length]!;
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.round(xs[i]!); x < Math.round(xs[i + 1]!); x++) {
          const c = typeof paint === 'function' ? paint(x, y) : paint;
          if (c) this.set(x, y, c);
        }
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
  }

  /** A 1-px outline around everything painted (pixels touching an opaque one, side by side). */
  outline(c: RGB = OUTLINE_RGB, diagonal = false): void {
    const src = new Uint8ClampedArray(this.d);
    const at = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < this.w && y < this.h && src[(y * this.w + x) * 4 + 3]! > 100;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (at(x, y)) continue;
        const near = at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1) || (diagonal && (at(x + 1, y + 1) || at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1)));
        if (near) this.set(x, y, c);
      }
    }
  }

  /** Darkens the pixels on the inside edge facing down-right (a self-shadow along the outline). */
  innerShade(k = 0.25): void {
    const src = new Uint8ClampedArray(this.d);
    const at = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < this.w && y < this.h && src[(y * this.w + x) * 4 + 3]! > 100;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!at(x, y)) continue;
        if (!at(x + 1, y) || !at(x, y + 1)) {
          const o = (y * this.w + x) * 4;
          this.d[o] = this.d[o]! * (1 - k);
          this.d[o + 1] = this.d[o + 1]! * (1 - k);
          this.d[o + 2] = this.d[o + 2]! * (1 - k * 0.6);
        }
      }
    }
  }

  /** Copies another painter on top at an offset (opaque pixels only, optionally mirrored). */
  stamp(src: Painter, ox: number, oy: number, flip = false): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const o = (y * src.w + x) * 4;
        const a = src.d[o + 3]!;
        if (a === 0) continue;
        const sx = flip ? src.w - 1 - x : x;
        this.set(ox + sx, oy + y, [src.d[o]!, src.d[o + 1]!, src.d[o + 2]!], a);
      }
    }
  }

  toCanvas(): Cnv {
    const c = canvas(this.w, this.h);
    const g = ctx2d(c);
    const img = g.createImageData(this.w, this.h);
    img.data.set(this.d);
    g.putImageData(img, 0, 0);
    return c;
  }
}

/** A ramp color for a brightness (−1 dark .. +1 lit), dithered between neighbours. */
export function shadeAt(r: Ramp, b: number, x: number, y: number): RGB {
  // map brightness to a position on the ramp: 0 = hi, 4 = deep
  const pos = Math.max(0, Math.min(4, 2 - b * 2.2));
  const i = Math.floor(pos);
  const t = pos - i;
  if (i >= 4) return r[4];
  return dither(x, y, t) ? r[i + 1]! : r[i]!;
}
