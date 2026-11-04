import { hexRgb } from './kits';
import { Mesher } from './land';

/** Building what stands out of plain shapes: in tiles, facing the camera to the south. */

export type C = readonly number[];

const rgb = hexRgb;
export const mul = (c: C, k: number): number[] => [c[0]! * k, c[1]! * k, c[2]! * k];
export const pick = <T,>(list: readonly T[], r: () => number): T => list[Math.floor(r() * list.length) % list.length]!;

export class Build {
  readonly m = new Mesher();

  /** A block: its top and four sides. `foot`: the color its sides go down to. */
  box(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, side: C, foot: C, top: C): void {
    const m = this.m;
    m.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], top);
    m.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], foot, side);
    m.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], foot, side);
    m.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], foot, side);
    m.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], foot, side);
  }

  /** A post of `n` sides, tapering from r0 to r1, its top (dx, dz) from its foot. */
  post(cx: number, cz: number, r0: number, r1: number, y0: number, y1: number, n: number, c0: C, c1: C, dx = 0, dz = 0, turn = 0): void {
    const m = this.m;
    const at = (i: number, r: number, y: number, ox: number, oz: number): number[] => {
      const a = (i / n) * Math.PI * 2 + turn;
      return [cx + ox + Math.cos(a) * r, y, cz + oz + Math.sin(a) * r];
    };
    const slope = (r0 - r1) / Math.max(0.01, y1 - y0);
    for (let i = 0; i < n; i++) {
      const mid = ((i + 0.5) / n) * Math.PI * 2 + turn;
      const len = Math.hypot(1, slope);
      const nr = [Math.cos(mid) / len, slope / len, Math.sin(mid) / len];
      m.quad(at(i + 1, r0, y0, 0, 0), at(i, r0, y0, 0, 0), at(i, r1, y1, dx, dz), at(i + 1, r1, y1, dx, dz), nr, c0, c1);
    }
    if (r1 > 0.005) {
      const c = [cx + dx, y1, cz + dz];
      for (let i = 0; i < n; i++) m.quad(c, at(i + 1, r1, y1, dx, dz), at(i, r1, y1, dx, dz), at(i, r1, y1, dx, dz), [0, 1, 0], c1);
    }
  }

  /** A face looking south (at the camera). */
  faceS(x0: number, x1: number, z: number, y0: number, y1: number, c0: C, c1: C = c0): void {
    this.m.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, 1], c0, c1);
  }

  faceE(z0: number, z1: number, x: number, y0: number, y1: number, c0: C, c1: C = c0): void {
    this.m.quad([x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1], [1, 0, 0], c0, c1);
  }

  faceW(z0: number, z1: number, x: number, y0: number, y1: number, c0: C, c1: C = c0): void {
    this.m.quad([x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], [-1, 0, 0], c0, c1);
  }

  flat(x0: number, z0: number, x1: number, z1: number, y: number, c: C): void {
    this.m.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], c);
  }

  /** Cut stone in courses over a dark backing, on a face (s: south, e: east, w: west). */
  courses(dir: 's' | 'e' | 'w', a0: number, a1: number, at: number, y0: number, y1: number, rowH: number, blockW: number, palette: readonly C[], joint: C, rand: () => number): void {
    const out = 0.012;
    if (dir === 's') this.faceS(a0, a1, at, y0, y1, joint);
    else if (dir === 'e') this.faceE(a0, a1, at, y0, y1, joint);
    else this.faceW(a0, a1, at, y0, y1, joint);
    const gap = 0.022;
    let row = 0;
    for (let y = y0; y < y1 - 0.01; y += rowH) {
      const top = Math.min(y1, y + rowH);
      let a = a0 - (row % 2 ? blockW * 0.5 : 0);
      while (a < a1) {
        const w = blockW * (0.72 + rand() * 0.56);
        const s0 = Math.max(a0, a) + gap;
        const s1 = Math.min(a1, a + w) - gap;
        if (s1 > s0) {
          const base = pick(palette, rand);
          const c0 = mul(base, 0.92 + rand() * 0.06);
          const c1 = mul(base, 1 + rand() * 0.08);
          if (dir === 's') this.faceS(s0, s1, at + out, y + gap, top - gap, c0, c1);
          else if (dir === 'e') this.faceE(s0, s1, at + out, y + gap, top - gap, c0, c1);
          else this.faceW(s0, s1, at - out, y + gap, top - gap, c0, c1);
        }
        a += w;
      }
      row++;
    }
  }

  /** Flagstones over a flat top. */
  flags(x0: number, z0: number, x1: number, z1: number, y: number, w: number, d: number, palette: readonly C[], joint: C, rand: () => number): void {
    this.flat(x0, z0, x1, z1, y, joint);
    let row = 0;
    for (let z = z0; z < z1 - 0.01; z += d) {
      let x = x0 - (row % 2 ? w * 0.5 : 0);
      while (x < x1) {
        const sw = w * (0.75 + rand() * 0.5);
        const s0 = Math.max(x0, x) + 0.02;
        const s1 = Math.min(x1, x + sw) - 0.02;
        if (s1 > s0) this.flat(s0, z + 0.02, s1, Math.min(z1, z + d) - 0.02, y + 0.008, mul(pick(palette, rand), 0.95 + rand() * 0.1));
        x += sw;
      }
      row++;
    }
  }

  /** A hanging banner on a south face: swallowtailed, with a trim and a device. */
  banner(cx: number, z: number, top: number, w: number, h: number, cloth: C, trim: C, device: C): void {
    const m = this.m;
    const hw = w / 2;
    const tail = top - h;
    const notch = tail + h * 0.14;
    const n = [0, 0, 1];
    // (a little fold down the middle, for the light to catch)
    const dim = mul(cloth, 0.82);
    m.quad([cx - hw, notch, z], [cx, notch, z + 0.02], [cx, top, z + 0.02], [cx - hw, top, z], n, dim, cloth);
    m.quad([cx, notch, z + 0.02], [cx + hw, notch, z], [cx + hw, top, z], [cx, top, z + 0.02], n, cloth, dim);
    m.quad([cx - hw, notch, z], [cx - hw, tail, z], [cx - hw * 0.5, notch - h * 0.02, z], [cx - hw * 0.5, notch - h * 0.02, z], n, dim);
    m.quad([cx - hw, notch, z], [cx - hw * 0.5, notch - h * 0.02, z], [cx, notch, z + 0.02], [cx, notch, z + 0.02], n, dim);
    m.quad([cx + hw, notch, z], [cx, notch, z + 0.02], [cx + hw * 0.5, notch - h * 0.02, z], [cx + hw * 0.5, notch - h * 0.02, z], n, cloth);
    m.quad([cx + hw, notch, z], [cx + hw * 0.5, notch - h * 0.02, z], [cx + hw, tail, z], [cx + hw, tail, z], n, cloth);
    // trim along the top and down the sides
    this.faceS(cx - hw - 0.03, cx + hw + 0.03, z + 0.024, top - 0.09, top, trim);
    this.faceS(cx - hw, cx - hw + 0.05, z + 0.024, notch, top, trim);
    this.faceS(cx + hw - 0.05, cx + hw, z + 0.024, notch, top, trim);
    // a device: a lozenge
    const dy = top - h * 0.46;
    const dw = w * 0.26;
    const dh = h * 0.2;
    m.quad([cx, dy - dh, z + 0.03], [cx + dw, dy, z + 0.03], [cx, dy + dh, z + 0.03], [cx - dw, dy, z + 0.03], n, device);
    // the pole it hangs from
    this.post(cx - hw - 0.06, z + 0.03, 0.03, 0.03, top - 0.03, top + 0.03, 4, trim, trim);
  }

  /** A flag on its own pole. */
  flag(x: number, z: number, y: number, h: number, cloth: C, wood: C, side: 1 | -1): void {
    this.post(x, z, 0.04, 0.03, y, y + h, 5, mul(wood, 0.8), wood);
    this.post(x, z, 0.05, 0.0, y + h, y + h + 0.12, 5, wood, mul(wood, 1.3));
    const y1 = y + h - 0.02;
    const y0 = y1 - h * 0.34;
    const w = h * 0.46;
    const dim = mul(cloth, 0.8);
    const n = [0, 0, 1];
    this.m.quad([x, y0, z], [x + side * w * 0.5, y0 + 0.02, z + 0.04], [x + side * w * 0.5, y1 - 0.01, z + 0.04], [x, y1, z], n, dim, cloth);
    this.m.quad([x + side * w * 0.5, y0 + 0.02, z + 0.04], [x + side * w, (y0 + y1) / 2, z], [x + side * w, (y0 + y1) / 2, z], [x + side * w * 0.5, y1 - 0.01, z + 0.04], n, cloth, dim);
  }

  /** An iron bowl on three legs, with coals in it. */
  brazier(x: number, z: number, y: number, k: number): void {
    const iron = rgb('#4a4048');
    const dark = rgb('#241e24');
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      this.post(x + Math.cos(a) * 0.17 * k, z + Math.sin(a) * 0.17 * k, 0.025 * k, 0.025 * k, y, y + 0.3 * k, 3, dark, iron, -Math.cos(a) * 0.08 * k, -Math.sin(a) * 0.08 * k);
    }
    this.post(x, z, 0.1 * k, 0.24 * k, y + 0.26 * k, y + 0.42 * k, 8, dark, iron);
    this.post(x, z, 0.2 * k, 0.05 * k, y + 0.42 * k, y + 0.47 * k, 7, rgb('#ff7a22'), rgb('#ffd25a'));
  }

  /** A row of battlements along a line (x or z). */
  merlons(x0: number, z0: number, x1: number, z1: number, y: number, h: number, each: number, side: C, foot: C, top: C): void {
    const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const len = alongX ? x1 - x0 : z1 - z0;
    const n = Math.max(1, Math.round(len / (each * 2)));
    const w = len / (n * 2);
    for (let i = 0; i < n; i++) {
      const a = w * (i * 2 + 0.5);
      if (alongX) this.box(x0 + a, z0, x0 + a + w, z1, y, y + h, side, foot, top);
      else this.box(x0, z0 + a, x1, z0 + a + w, y, y + h, side, foot, top);
    }
  }
}
