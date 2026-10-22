import { hash2 } from '../core/math';
import { THEMES } from '../data/themes';
import type { Theme } from '../data/types';
import { K, TILE } from '../sim/map';
import { mixRGB, OUTLINE_RGB, ramp, rgb, type RGB } from './art/kit';
import { DETAIL } from './pixel';

/**
 * The ground's pixels: a pure function of the map and the position, so chunks can be painted on a
 * worker as well as here. Grass with single blades and flowers, worn paths with pebbles, water with
 * banks, foam and ripples, cobbles, plank bridges, the forest canopy seen from above with leafy edges
 * and a shadow on the ground, and crypt flagstones and brick. Positions are in art pixels.
 */

const D = DETAIL;
/** Art pixels per tile. */
const T = TILE * D;
/** Tiles per chunk side. */
export const CHUNK_TILES = 8;
/** Art pixels per chunk side. */
export const CHUNK_ART = CHUNK_TILES * T;

/** What the painter needs to know about a map (plain data, so it can be posted to a worker). */
export interface GroundSource {
  w: number;
  h: number;
  kind: Uint8Array;
  /** Tiles that hold a marker (they take the ground around them). */
  marked: number[];
  theme: Theme;
}

/** The painter's colors for an outdoor theme, from the theme table. */
function palette(theme: Theme) {
  const g = THEMES[theme].ground;
  const w = g.water;
  return {
    grass: g.grass.map(rgb),
    field: g.grass.slice(1).map(rgb),
    rough: g.grass.slice(0, 3).map(rgb),
    blade: rgb(g.blade),
    bladeHi: rgb(g.bladeHi),
    flowers: g.flowers.map(rgb),
    path: g.path.map(rgb),
    dirt: g.path.slice(1).map(rgb),
    pebble: ramp(g.pebble),
    leaf: g.leaf.map(rgb),
    water: { deep: rgb(w.deep), mid: rgb(w.mid), shallow: rgb(w.shallow), depths: [w.deep, w.mid, w.shallow].map(rgb), light: rgb(w.light), foam: rgb(w.foam), bank: rgb(w.bank), bankDark: rgb(w.bankDark) },
    sand: g.sand.map(rgb),
    shell: g.shell.map(rgb),
  };
}
type Pal = ReturnType<typeof palette>;

/** Indoor stone, from the theme table. */
function stonePalette(theme: Theme) {
  const t = THEMES[theme].stone!;
  return {
    slab: t.slab.map(rgb),
    mortar: rgb(t.mortar),
    top: rgb(t.top),
    topHi: rgb(t.topHi),
    lip: rgb(t.lip),
    lip2: rgb(t.lip2),
    brick: t.brick.map(rgb),
    brickMortar: rgb(t.brickMortar),
    moss: ramp(t.moss),
    crack: rgb(t.crack),
  };
}
type Indoor = ReturnType<typeof stonePalette>;

const CITY_WALL = {
  top: rgb('#a4a4b0'),
  topHi: rgb('#b2b2bc'),
  mortar: rgb('#7a7a88'),
  lip: rgb('#c8c8d4'),
  lip2: rgb('#8a8a98'),
  brick: ['#a8a8b4', '#9c9ca8', '#b4b4c0'].map(rgb),
};

const COBBLE = {
  mortar: rgb('#6e6a7a'),
  stones: ['#aca8b4', '#a29eaa', '#b2aca8'].map((c) => {
    const b = rgb(c);
    return { lit: mixRGB(b, [255, 255, 250], 0.13), base: b, shade: mixRGB(b, [60, 54, 80], 0.16) };
  }),
};
const WOOD = { gap: rgb('#3a2418'), planks: [ramp('#a87848'), ramp('#9a6c40'), ramp('#b0804e')], nail: rgb('#3a2c26'), glint: rgb('#d8c0a0') };
const BRAMBLE = { vine: rgb('#3a4a22'), vineDark: rgb('#26321a'), thorn: rgb('#d0c49a'), berry: rgb('#d8364a'), berryHi: rgb('#ff8a96') };

/** What the ground looks like under a tile (solid things stand on grass or stone). */
function groundOf(k: number): number {
  if (k === K.Path || k === K.Cobble || k === K.Water || k === K.Bramble || k === K.Bridge || k === K.Deco || k === K.Wall || k === K.Illusion || k === K.Cracked || k === K.Sand || k === K.Rampart) return k;
  return K.Floor;
}

const blendable = (k: number): boolean => k !== K.Bridge && k !== K.Cracked && k !== K.Rampart;

/** A tone between two ramp steps, dithered only inside a narrow band so most ground is flat color. */
function band(cols: RGB[], t: number, x: number, y: number): RGB {
  const pos = Math.max(0, Math.min(cols.length - 1, t * (cols.length - 1)));
  const i = Math.floor(pos);
  const f = pos - i;
  if (i >= cols.length - 1) return cols[cols.length - 1]!;
  // a soft step: flat, then a short checkered blend, then the next color
  const k = (f - 0.4) / 0.2;
  if (k <= 0) return cols[i]!;
  if (k >= 1) return cols[i + 1]!;
  return ((x + y) & 1) === 0 && k > 0.25 ? cols[i + 1]! : k > 0.75 ? cols[i + 1]! : cols[i]!;
}

export class GroundPainter {
  private readonly map: GroundSource;
  private readonly theme: Theme;
  private readonly pal: Pal;
  private readonly stone: Indoor | null;
  /** Bare land: rock cliffs instead of the woods' canopy. */
  private readonly cliffs: boolean;
  /** Padded row length: the per-tile arrays have a one-tile border around the map. */
  private readonly pw: number;
  /** Per tile, the canopy's blobs: 2 × (x, y, r), a highlight (x, y, r) in art px, and the tile's hash. */
  private readonly canopy: Float32Array;
  /** Per tile: the kind of ground drawn there. */
  private readonly gk: Uint8Array;
  /** Per tile: 1 when it and its eight neighbours have the same ground (edges can't wander in). */
  private readonly same: Uint8Array;
  /** Per tile: 1 when foliage is on it or next to it. */
  private readonly leafy: Uint8Array;

  constructor(src: GroundSource) {
    const map = src;
    this.map = src;
    this.theme = src.theme;
    this.pal = palette(src.theme);
    this.stone = THEMES[src.theme].indoor ? stonePalette(src.theme) : null;
    this.cliffs = !!THEMES[src.theme].cliffs;
    const pw = map.w + 2;
    const ph = map.h + 2;
    this.pw = pw;
    // markers and things standing on a square or a road stand on its stones, not on a patch of grass
    const marked = new Set(src.marked);
    this.gk = new Uint8Array(pw * ph).fill(K.Wall);
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        const raw = map.kind[ty * map.w + tx]!;
        let g = groundOf(raw);
        if (g === K.Floor && (raw !== K.Floor || marked.has(ty * map.w + tx))) {
          const around = [this.kindAt(tx + 1, ty), this.kindAt(tx - 1, ty), this.kindAt(tx, ty + 1), this.kindAt(tx, ty - 1)];
          for (const want of [K.Cobble, K.Path]) if (around.filter((k) => k === want).length >= 2) g = want;
        }
        this.gk[(ty + 1) * pw + tx + 1] = g;
      }
    }
    this.same = new Uint8Array(pw * ph);
    this.leafy = new Uint8Array(pw * ph);
    for (let ty = 0; ty < ph; ty++) {
      for (let tx = 0; tx < pw; tx++) {
        const own = this.gk[ty * pw + tx]!;
        let same = 1;
        let leafy = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = tx + dx;
            const y = ty + dy;
            const k = x < 0 || y < 0 || x >= pw || y >= ph ? K.Wall : this.gk[y * pw + x]!;
            if (k !== own) same = 0;
            if (k === K.Wall || k === K.Illusion) leafy = 1;
          }
        }
        this.same[ty * pw + tx] = same;
        this.leafy[ty * pw + tx] = leafy;
      }
    }
    this.canopy = new Float32Array(pw * ph * 10);
    for (let ty = -1; ty <= map.h; ty++) {
      for (let tx = -1; tx <= map.w; tx++) {
        const o = ((ty + 1) * pw + (tx + 1)) * 10;
        const x = tx * TILE + 8;
        const y = ty * TILE + 8;
        const h = hash2(tx, ty, 61);
        const j = (n: number): number => (hash2(x, y, 70 + n) - 0.5) * 6;
        const b = this.canopy;
        b[o] = (x + j(1)) * D;
        b[o + 1] = (y + j(2)) * D;
        b[o + 2] = (9 + Math.floor(h * 3)) * D;
        b[o + 3] = (x + j(3) + 3) * D;
        b[o + 4] = (y + j(4) - 4) * D;
        b[o + 5] = (7 + Math.floor(h * 2)) * D;
        b[o + 6] = (x - 3 + h * 4) * D;
        b[o + 7] = (y - 5) * D;
        b[o + 8] = h < 0.55 ? (1 + Math.floor(h * 3)) * D : 0;
        b[o + 9] = h;
      }
    }
  }

  private kindAt(tx: number, ty: number): number {
    const m = this.map;
    return tx < 0 || ty < 0 || tx >= m.w || ty >= m.h ? K.Wall : m.kind[ty * m.w + tx]!;
  }

  /** Padded index of a tile, or −1 outside the border. */
  private pi(tx: number, ty: number): number {
    return tx < -1 || ty < -1 || tx > this.map.w || ty > this.map.h ? -1 : (ty + 1) * this.pw + tx + 1;
  }

  private gkAt(tx: number, ty: number): number {
    const i = this.pi(tx, ty);
    return i < 0 ? K.Wall : this.gk[i]!;
  }

  /** Paints rows [row0, row1) of a chunk into an RGBA buffer of CHUNK_ART² pixels. */
  paint(cx: number, cy: number, out: Uint8ClampedArray, row0 = 0, row1 = CHUNK_ART): void {
    const x0 = cx * CHUNK_ART;
    const y0 = cy * CHUNK_ART;
    const indoor = this.stone;
    for (let row = row0; row < row1; row++) {
      const ay = y0 + row;
      for (let x = 0; x < CHUNK_ART; x++) {
        const c = indoor ? this.cryptPixel(indoor, x0 + x, ay) : this.outdoorPixel(x0 + x, ay);
        const o = (row * CHUNK_ART + x) * 4;
        out[o] = c[0];
        out[o + 1] = c[1];
        out[o + 2] = c[2];
        out[o + 3] = 255;
      }
    }
  }

  /* ------------------------------------------------------------ outdoors */

  /** The kind of ground at an art pixel, with edges between kinds wandering naturally. */
  private kAt(ax: number, ay: number): number {
    const tx = Math.floor(ax / T);
    const ty = Math.floor(ay / T);
    const i = this.pi(tx, ty);
    if (i < 0) return K.Wall;
    const own = this.gk[i]!;
    if (own === K.Bridge || this.same[i]) return own;
    // the wobble reaches at most 9 px, so the middle of a tile is always its own
    const lx = ax - tx * T;
    const ly = ay - ty * T;
    if (lx >= 9 && ly >= 9 && lx < T - 9 && ly < T - 9) return own;
    const wx = (noise2(ax / 10, ay / 10, 7) - 0.5) * 14 + (noise2(ax / 3, ay / 3, 17) - 0.5) * 2.5;
    const wy = (noise2(ax / 10, ay / 10, 13) - 0.5) * 14 + (noise2(ax / 3, ay / 3, 19) - 0.5) * 2.5;
    const sk = this.gkAt(Math.floor((ax + wx) / T), Math.floor((ay + wy) / T));
    return blendable(sk) ? sk : own;
  }

  private outdoorPixel(ax: number, ay: number): RGB {
    const P = this.pal;
    const k = this.kAt(ax, ay);
    if (this.cliffs && (k === K.Wall || k === K.Illusion)) return this.cliff(P, ax, ay);
    // the canopy covers foliage and hangs a little over the ground around it
    const cl = this.cliffs ? -1 : this.canopyAt(ax, ay);
    if (cl >= 0) return this.canopyColor(P, cl, ax, ay);
    let col: RGB;
    switch (k) {
      case K.Water:
        col = this.water(P, ax, ay);
        break;
      case K.Path:
        col = this.path(P, ax, ay);
        break;
      case K.Cobble:
        col = cobble(ax, ay);
        break;
      case K.Bridge:
        col = bridge(ax, ay);
        break;
      case K.Bramble:
        col = bramble(P, ax, ay);
        break;
      case K.Sand:
        col = this.sand(P, ax, ay);
        break;
      case K.Rampart:
        return this.rampart(ax, ay);
      case K.Wall:
      case K.Illusion:
        col = P.leaf[1]!;
        break;
      default:
        col = this.grass(P, ax, ay, k === K.Deco);
    }
    // the canopy's shadow falls down and to the right; a cliff's lies at its foot
    if (cl === -2) col = mixRGB(col, [10, 26, 22], 0.38);
    else if (this.cliffs && this.isRock(ax, ay - 3 * D)) col = mixRGB(col, [24, 12, 6], this.isRock(ax, ay - D) ? 0.42 : 0.28);
    return col;
  }

  private isRock(ax: number, ay: number): boolean {
    const k = this.kAt(ax, ay);
    return k === K.Wall || k === K.Illusion;
  }

  /**
   * Bare lands: rock where other lands have woods. A flat top with strata and cracks, a lit rim where
   * it meets the ground behind, and a cliff face of layered stone where it drops to the ground below.
   */
  private cliff(P: Pal, ax: number, ay: number): RGB {
    const L = P.leaf;
    const FACE = 10 * D;
    // how far down the ground is (within a face's height)
    let down = 0;
    for (let d = 1; d <= FACE; d++) {
      if (!this.isRock(ax, ay + d)) {
        down = d;
        break;
      }
    }
    if (!this.isRock(ax, ay - 1) || !this.isRock(ax - 1, ay) || !this.isRock(ax + 1, ay) || down === 1) return OUTLINE_RGB;
    if (down > 0) {
      // the face: layers of stone, darker toward the foot, cracked here and there
      const f = FACE - down;
      const layer = Math.floor((ay + Math.round(noise2(ax / 18, ay / 40, 81) * 6)) / 7);
      let col = L[f < 3 ? 3 : f < FACE - 6 ? 2 : 1]!;
      if ((ay + Math.round(noise2(ax / 18, ay / 40, 81) * 6)) % 7 === 0) col = L[f < 3 ? 4 : 1]!;
      const crack = hash2(Math.floor(ax / 5), layer, 83);
      if (crack < 0.12 && ax % 5 === 2) col = L[0]!;
      else if (hash2(ax, ay, 84) < 0.05) col = L[1]!;
      if (down <= 2) col = L[0]!;
      return col;
    }
    // the top: a lit rim at the back edge, strata like contour lines, cracks and grit
    if (!this.isRock(ax, ay - 2 * D)) return L[5]!;
    if (!this.isRock(ax - 2 * D, ay) || !this.isRock(ax + 2 * D, ay)) return L[2]!;
    const n = noise2(ax / 30, ay / 30, 85);
    const band = (n * 5) % 1;
    let col = L[n > 0.55 ? 4 : 3]!;
    if (band < 0.04) col = L[2]!;
    const h = hash2(ax, ay, 86);
    if (h < 0.025) col = L[2]!;
    else if (h < 0.04) col = L[5]!;
    const ck = noise2(ax / 9, ay / 9, 87);
    if (Math.abs(ck - 0.5) < 0.012) col = L[1]!;
    return col;
  }

  /** City walls: a flagged walkway on top and, where the wall drops to the ground, a face of stone blocks. */
  private rampart(ax: number, ay: number): RGB {
    const C = CITY_WALL;
    const tx = Math.floor(ax / T);
    const ty = Math.floor(ay / T);
    const lx = ax - tx * T;
    const ly = ay - ty * T;
    const face = this.kindAt(tx, ty + 1) !== K.Rampart;
    const topRows = 9 * D;
    if (!face || ly < topRows) {
      // the walkway's flagstones, with a lip where it ends
      if (face && ly >= topRows - 3) return ly === topRows - 1 ? C.lip2 : C.lip;
      const edgeL = this.kindAt(tx - 1, ty) !== K.Rampart && lx < 4;
      const edgeR = this.kindAt(tx + 1, ty) !== K.Rampart && lx >= T - 4;
      if (edgeL || edgeR) return C.lip;
      const sx = Math.floor(ax / 20);
      const sy = Math.floor(ay / 14);
      if (ax % 20 === 0 || ay % 14 === 0) return C.mortar;
      return hash2(sx, sy, 421) < 0.5 ? C.top : C.topHi;
    }
    const fy = ly - topRows;
    const row = Math.floor(fy / 8);
    const off = row % 2 ? 9 : 0;
    const bx = (ax + off) % 18;
    const by = fy % 8;
    if (by === 7 || bx === 0) return C.mortar;
    const base = C.brick[Math.floor(hash2(Math.floor((ax + off) / 18), row + ty * 3, 423) * 3)]!;
    if (by === 0 || bx === 1) return mixRGB(base, [255, 255, 255], 0.12);
    if (ly >= T - 2) return mixRGB(base, [0, 0, 0], 0.3);
    return hash2(ax, ay, 425) < 0.05 ? mixRGB(base, [20, 20, 40], 0.15) : base;
  }

  /** Sand: soft dunes with wind ripples, darker grains, and a shell or pebble here and there. */
  private sand(P: Pal, ax: number, ay: number): RGB {
    const t = noise2(ax / 26, ay / 26, 61) * 0.6 + noise2(ax / 7, ay / 7, 62) * 0.4;
    let col = band(P.sand, t * 0.85 + 0.1, ax, ay);
    const ry = ay + Math.round(Math.sin(ax / 9 + noise2(ax / 30, ay / 30, 66) * 4) * 2);
    if (noise2(ax / 12, ay / 12, 63) > 0.5) {
      if (ry % 9 === 0) col = P.sand[4]!;
      else if (ry % 9 === 1) col = P.sand[1]!;
    }
    const h = hash2(ax, ay, 64);
    if (h < 0.03) col = P.sand[0]!;
    else if (h < 0.045) col = P.sand[4]!;
    const cx = Math.floor(ax / 13);
    const cy = Math.floor(ay / 13);
    const sh = hash2(cx, cy, 65);
    if (sh < 0.07) {
      const dx = ax - (cx * 13 + 3 + (Math.floor(sh * 977) % 7));
      const dy = ay - (cy * 13 + 3 + (Math.floor(sh * 577) % 7));
      if (dy === 0 && dx >= 0 && dx < 2) return P.shell[0]!;
      if (dy === 1 && dx >= 0 && dx < 2) return P.shell[1]!;
      if (dy === 2 && dx === 1) return P.sand[0]!;
    }
    return col;
  }

  private grass(P: Pal, ax: number, ay: number, deco: boolean): RGB {
    const G = P.grass;
    const t = noise2(ax / 30, ay / 30, 3) * 0.65 + noise2(ax / 9, ay / 9, 9) * 0.35;
    let col = band(P.field, t, ax, ay);
    // single blades, a little leaning, with a shadow at the foot
    const cx = Math.floor(ax / 6);
    const cy = Math.floor(ay / 7);
    const bh = hash2(cx, cy, 2);
    if (bh < 0.5) {
      const lx = ax - cx * 6;
      const ly = ay - cy * 7;
      const c0 = 1 + (Math.floor(bh * 37) % 4);
      const r0 = 4 + (Math.floor(bh * 53) % 3);
      const lean = (Math.floor(bh * 101) % 3) - 1;
      if (lx === c0 && ly === r0) return G[1]!;
      if (lx === c0 && ly === r0 - 1) return P.blade;
      if (lx === c0 + lean && ly === r0 - 2) return P.bladeHi;
      if (lx === c0 + 1 && ly === r0) return G[0]!;
      if (bh < 0.18 && lx === c0 + 2 && (ly === r0 || ly === r0 - 1)) return ly === r0 ? G[1]! : P.blade;
    }
    const h = hash2(ax, ay, 1);
    if (h < 0.02) col = G[0]!;
    else if (h < 0.03) col = G[4]!;
    // flowers: clusters on flower ground, a rare one anywhere
    const fs = deco ? 9 : 15;
    const fx = Math.floor(ax / fs);
    const fy = Math.floor(ay / fs);
    const fh = hash2(fx, fy, deco ? 6 : 16);
    if (fh < (deco ? 0.55 : 0.07)) {
      const px = fx * fs + 2 + (Math.floor(fh * 413) % (fs - 4));
      const py = fy * fs + 2 + (Math.floor(fh * 719) % (fs - 4));
      const dx = ax - px;
      const dy = ay - py;
      const flower = P.flowers[Math.floor(fh * 1000) % P.flowers.length]!;
      if (deco && fh < 0.42) {
        // a five-pixel flower: petals around a yellow eye, a shadow below right
        if (dx === 0 && dy === 0) return flower === P.flowers[1] ? rgb('#ffffff') : rgb('#ffe066');
        if (Math.abs(dx) + Math.abs(dy) === 1) return dx > 0 || dy > 0 ? mixRGB(flower, [60, 40, 80], 0.18) : flower;
        if (dx === 1 && dy === 1) return G[0]!;
        if (dx === 0 && dy === 2) return G[1]!;
      } else {
        // a bud
        if (dx === 0 && dy === 0) return flower;
        if (dx === 0 && dy === 1) return G[0]!;
      }
    }
    return col;
  }

  private path(P: Pal, ax: number, ay: number): RGB {
    const t = noise2(ax / 16, ay / 16, 3) * 0.7 + noise2(ax / 5, ay / 5, 4) * 0.3;
    let col = band(P.dirt, t, ax, ay);
    // pebbles with a lit top and a shadow below
    const cx = Math.floor(ax / 9);
    const cy = Math.floor(ay / 9);
    const ph = hash2(cx, cy, 31);
    if (ph < 0.2) {
      const px = cx * 9 + 1 + (Math.floor(ph * 577) % 5);
      const py = cy * 9 + 1 + (Math.floor(ph * 311) % 5);
      const w = ph < 0.07 ? 3 : 2;
      const dx = ax - px;
      const dy = ay - py;
      if (dx >= 0 && dx < w && dy >= 0 && dy < 2) return dx === 0 && dy === 0 ? P.pebble[1] : dy === 1 ? P.pebble[3] : P.pebble[2];
      if (dy === 2 && dx >= 0 && dx < w) return P.path[0]!;
    }
    const h = hash2(ax, ay, 5);
    if (h < 0.05) col = P.path[0]!;
    else if (h < 0.08) col = P.path[3]!;
    // the grass edge above throws a thin shadow onto the path
    const up = this.kAt(ax, ay - 3);
    if (up !== K.Path && up !== K.Water && up !== K.Bridge && up !== K.Cobble) col = mixRGB(col, P.path[0]!, 0.6);
    return col;
  }

  private water(P: Pal, ax: number, ay: number): RGB {
    const W = P.water;
    // in the middle of open water the shore is far: no need to look for it
    const tx = Math.floor(ax / T);
    const ty = Math.floor(ay / T);
    const open = this.same[this.pi(tx, ty)] === 1;
    let shore = 99;
    if (!open) {
      // the bank: land just above shows its earth face going down into the water
      for (let dd = 1; dd <= 4; dd++) {
        if (this.kAt(ax, ay - dd) !== K.Water) {
          if (dd <= 2) return dd === 1 ? W.bank : W.bankDark;
          return W.deep;
        }
      }
      // how far the shore is
      outer: for (const r of RINGS) {
        for (let i = 0; i < 16; i += 2) {
          if (this.kAt(Math.round(ax + DIRS[i]! * r), Math.round(ay + DIRS[i + 1]! * r)) !== K.Water) {
            shore = r;
            break outer;
          }
        }
      }
    }
    const h = hash2(ax, ay, 9);
    if (shore <= 2) return h < 0.7 ? W.foam : W.light;
    if (shore <= 4) return h < 0.25 ? W.foam : W.shallow;
    let col = shore <= 7 ? W.shallow : band(W.depths, noise2(ax / 22, ay / 22, 5) * 0.8, ax, ay);
    // ripples: short light strokes with a darker line under them
    const cx = Math.floor(ax / 14);
    const cy = Math.floor(ay / 8);
    const rh = hash2(cx, cy, 41);
    if (rh < 0.32) {
      const sx = cx * 14 + 2 + (Math.floor(rh * 311) % 6);
      const len = 3 + (Math.floor(rh * 97) % 4);
      const ry = cy * 8 + 3;
      if (ax >= sx && ax < sx + len) {
        if (ay === ry) return W.light;
        if (ay === ry + 1 && ax > sx && ax < sx + len - 1) return W.deep;
      }
    }
    if (h < 0.004) col = W.foam;
    return col;
  }

  /* -------------------------------------------------------------- canopy */

  /**
   * The canopy at an art pixel: −1 nothing, −2 its shadow on the ground, 0 outline, 1-3 leaf tones
   * from shade to light, 4 a sunlit top, 5/6 blossoms.
   */
  private canopyAt(ax: number, ay: number): number {
    const tx = Math.floor(ax / T);
    const ty = Math.floor(ay / T);
    const ti = this.pi(tx, ty);
    if (ti >= 0 && !this.leafy[ti]) return -1;
    let layer = -1;
    let shadow = false;
    const px = ax + 0.5;
    const py = ay + 0.5;
    // leafy edges: the blobs' outlines wobble a little (worked out only once a blob is near)
    let s = NaN;
    const b = this.canopy;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        const pi = this.pi(nx, ny);
        if (pi < 0) {
          if (layer < 2) layer = 2;
          continue;
        }
        const k = this.gk[pi]!;
        if (k !== K.Wall && k !== K.Illusion) continue;
        const o = pi * 10;
        for (let i = 0; i < 2; i++) {
          const bx = b[o + i * 3]!;
          const by = b[o + i * 3 + 1]!;
          const r = b[o + i * 3 + 2]!;
          const ex = px - bx;
          const ey = py - by;
          if (ex > r + 2 * D || ey > r + 4 * D || ex < -r - 2 || ey < -r - 2) continue;
          if (s !== s) s = (noise2(ax / 3, ay / 3, 44) - 0.5) * 3.5;
          // "distance + s <= radius", compared squared
          const d2 = ex * ex + ey * ey;
          const r1 = r - s;
          if (layer < 1) {
            const r0 = r1 + 1.5;
            if (r0 > 0 && d2 <= r0 * r0 && layer < 0) layer = 0;
            if (r1 > 0 && d2 <= r1 * r1) layer = 1;
          }
          if (layer >= 1 && layer < 3) {
            const ax2 = ex + D;
            const ay2 = ey + 2 * D;
            const r2 = r1 - 2 * D;
            if (layer < 2 && r2 > 0 && ax2 * ax2 + ay2 * ay2 <= r2 * r2) layer = 2;
            const ax3 = ex + 2 * D;
            const ay3 = ey + 3 * D;
            const r3 = r1 - 5 * D;
            if (r3 > 0 && ax3 * ax3 + ay3 * ay3 <= r3 * r3) layer = 3;
          }
          if (layer < 0) {
            const sx = ex - D;
            const sy = ey - 4 * D;
            if (sx * sx + sy * sy <= r * r) shadow = true;
          }
        }
        const hr = b[o + 8]!;
        if (hr > 0 && layer >= 1) {
          const hx = px - b[o + 6]!;
          const hy = py - b[o + 7]!;
          if (Math.sqrt(hx * hx + hy * hy) + (s === s ? s * 0.5 : 0) <= hr) layer = 4;
        }
        const hh = b[o + 9]!;
        if (hh > 0.93 && layer >= 1 && this.theme === 'forest') {
          // a few berries and blossoms in the canopy
          const cx = (nx * TILE + 8) * D;
          const cy = (ny * TILE + 8) * D;
          for (const [fx, fy] of BERRIES) if (Math.abs(px - (cx + fx * D)) <= 1.2 && Math.abs(py - (cy + fy * D)) <= 1.2) return hh > 0.965 ? 5 : 6;
        }
      }
    }
    return layer >= 0 ? layer : shadow ? -2 : -1;
  }

  private canopyColor(P: Pal, layer: number, ax: number, ay: number): RGB {
    if (layer === 0) return OUTLINE_RGB;
    if (layer === 5) return rgb('#ff8ad8');
    if (layer === 6) return rgb('#ffe07a');
    // leaf clusters: a glint here, a gap there
    let i = layer;
    const lf = noise2(ax / 2.2, ay / 1.8, 52);
    if (lf > 0.74) i += 1;
    else if (lf < 0.2) i -= 1;
    const h = hash2(ax, ay, 53);
    if (h < 0.025) i += 1;
    return P.leaf[Math.max(0, Math.min(5, i))]!;
  }

  /* --------------------------------------------------------------- crypt */

  private cryptPixel(P: Indoor, ax: number, ay: number): RGB {
    const tx = Math.floor(ax / T);
    const ty = Math.floor(ay / T);
    const k = this.kindAt(tx, ty);
    const lx = ax - tx * T;
    const ly = ay - ty * T;
    // water underground (flooded tunnels, a sea cave): darker, with a stone lip where the floor ends
    if (k === K.Water) {
      const above = this.kindAt(tx, ty - 1);
      if (above !== K.Water && above !== K.Bridge && ly < 3) return ly === 0 ? P.lip : P.lip2;
      return mixRGB(this.water(this.pal, ax, ay), [6, 8, 20], 0.35);
    }
    if (k === K.Bridge) return bridge(ax, ay);
    if (k === K.Wall || k === K.Cracked) {
      const below = this.kindAt(tx, ty + 1);
      const face = below !== K.Wall && below !== K.Cracked;
      const topRows = 6 * D;
      if (!face || ly < topRows) {
        const n = noise2(ax / 8, ay / 8, 31) + (hash2(ax, ay, 32) - 0.5) * 0.12;
        if (face && ly === topRows - 2) return P.lip;
        if (face && ly === topRows - 1) return P.lip2;
        return n > 0.56 ? P.topHi : P.top;
      }
      // the visible face: bricks
      const fy = ly - topRows;
      const row = Math.floor(fy / 8);
      const off = row % 2 ? 8 : 0;
      const bx = Math.floor((ax + off) / 16);
      const bxl = (ax + off) % 16;
      const by = fy % 8;
      if (by === 7 || bxl === 0) return P.brickMortar;
      const base = P.brick[Math.floor(hash2(bx, row + ty * 3, 12) * 3)]!;
      let col = base;
      if (by === 0 || bxl === 1) col = mixRGB(base, [255, 240, 255], 0.14);
      else if (by === 6 || bxl === 15) col = mixRGB(base, [10, 6, 30], 0.22);
      else if (hash2(ax, ay, 15) < 0.06) col = mixRGB(base, [10, 6, 30], 0.15);
      // a chipped corner here and there
      if (hash2(bx, row + ty * 3, 16) < 0.15 && bxl >= 13 && by <= 1) col = P.brickMortar;
      // contact shadow at the foot of the wall
      if (ly >= T - 2) col = mixRGB(col, [0, 0, 0], ly === T - 1 ? 0.45 : 0.25);
      if (k === K.Cracked) {
        const crack = Math.abs(lx - 16 - Math.sin(ay * 0.45) * 4) < 1 || (Math.abs(lx - 8 - ly * 0.4) < 0.8 && ly > 14);
        if (crack) return P.crack;
      }
      // moss creeping up from the floor
      if (fy > 10 && noise2(ax / 6, ay / 5, 14) > 0.66 + (20 - fy) * 0.02) col = (ax + ay) & 1 ? P.moss[2] : P.moss[3];
      return col;
    }
    // floor: big worn flagstones
    const row = Math.floor(ay / 24);
    const off = row % 2 ? 14 : 0;
    const sx = Math.floor((ax + off) / 28);
    const sl = (ax + off) % 28;
    const sy = ay % 24;
    let col: RGB;
    if (sl === 0 || sy === 0) col = P.mortar;
    else {
      const base = P.slab[Math.floor(hash2(sx, row, 11) * 4)]!;
      col = base;
      if (sl === 1 || sy === 1) col = mixRGB(base, [255, 255, 255], 0.08);
      else if (sl === 27 || sy === 23) col = mixRGB(base, [8, 6, 20], 0.2);
      const n = noise2(ax / 10, ay / 10, 41);
      if (n > 0.78) col = mixRGB(col, [20, 18, 32], 0.16);
      const h = hash2(ax, ay, 42);
      if (h < 0.03) col = mixRGB(col, [16, 14, 28], 0.3);
      else if (h < 0.045) col = mixRGB(col, [255, 255, 255], 0.08);
      // a crack across some stones
      const ch = hash2(sx * 7 + 3, row * 13 + 5, 191);
      if (ch < 0.06 && sy > 3 && sy < 17 && Math.abs(sl - 8 - sy * 0.7 - ch * 100 + Math.sin(sy * 0.9) * 1.2) < 0.6) col = P.crack;
    }
    // shadow from a wall above
    const above = this.kindAt(tx, ty - 1);
    if ((above === K.Wall || above === K.Cracked) && ly < 9) {
      const a = 0.55 - ly * 0.06;
      col = mixRGB(col, [8, 6, 16], ly > 5 && (ax + ay) & 1 ? a * 0.6 : a);
    }
    // moss creeps along walls
    const nearWall = this.kindAt(tx - 1, ty) === K.Wall || this.kindAt(tx + 1, ty) === K.Wall;
    if (nearWall) {
      const mn = noise2(ax / 6, ay / 6, 17);
      if (mn > 0.74) col = mn > 0.8 ? P.moss[2] : (ax + ay) & 1 ? P.moss[3] : col;
    }
    return col;
  }
}

/** The same smooth value noise as core/math's noise2, written out flat (it runs for every pixel). */
function noise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let u = x - xi;
  let v = y - yi;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Rings and directions the water looks along for the shore. */
const RINGS = [2, 4, 7, 11];
const DIRS = [1, 0, -1, 0, 0, 1, 0, -1, 0.7, 0.7, -0.7, 0.7, 0.7, -0.7, -0.7, -0.7];

const BERRIES = [
  [-2, 1],
  [3, -2],
  [0, 4],
] as const;

function cobble(ax: number, ay: number): RGB {
  // stones: the nearest of a jittered point per 14 px cell; the gaps are where two stones meet
  const S = 14;
  const cx = Math.floor(ax / S);
  const cy = Math.floor(ay / S);
  let d1 = 1e9;
  let d2 = 1e9;
  let id = 0;
  let sx1 = 0;
  let sy1 = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const gx = cx + ox;
      const gy = cy + oy;
      const sx = gx * S + 2 + hash2(gx, gy, 21) * (S - 4);
      const sy = gy * S + 2 + hash2(gx, gy, 22) * (S - 4);
      const d = (ax - sx) * (ax - sx) + (ay - sy) * (ay - sy);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = hash2(gx, gy, 23);
        sx1 = sx;
        sy1 = sy;
      } else if (d < d2) d2 = d;
    }
  }
  const edge = Math.sqrt(d2) - Math.sqrt(d1);
  if (edge < 1.2) return COBBLE.mortar;
  const R = COBBLE.stones[Math.floor(id * 3)]!;
  // lit on the top-left rim, shaded on the bottom-right
  if (edge < 2.2) return ax - sx1 + (ay - sy1) < 0 ? R.lit : R.shade;
  if (hash2(ax, ay, 24) < 0.035) return R.shade;
  return R.base;
}

function bridge(ax: number, ay: number): RGB {
  const ly = ay % 8;
  const row = Math.floor(ay / 8);
  if (ly === 7) return WOOD.gap;
  const off = Math.floor(hash2(row, 0, 6) * 40);
  const seg = Math.floor((ax + off) / 40);
  const sl = (ax + off) % 40;
  if (sl === 0) return WOOD.gap;
  const R = WOOD.planks[Math.floor(hash2(seg, row, 5) * 3)]!;
  // nails at the plank ends
  if ((sl === 3 || sl === 37) && (ly === 2 || ly === 4)) return ly === 2 ? WOOD.nail : WOOD.glint;
  if (ly === 0) return R[1];
  if (ly === 6) return R[3];
  // grain
  const grain = noise2(ax / 11, ay * 0.9 + row * 7, 5);
  if (grain > 0.7) return R[3];
  if (grain < 0.16) return R[1];
  return R[2];
}

function bramble(P: Pal, ax: number, ay: number): RGB {
  const v1 = Math.abs(Math.sin(ax * 0.35 + Math.sin(ay * 0.25) * 2)) < 0.12;
  const v2 = Math.abs(Math.sin(ay * 0.4 + ax * 0.15)) < 0.09;
  if (v1 || v2) {
    const h = hash2(ax, ay, 4);
    if (h < 0.05) return BRAMBLE.berry;
    if (h < 0.07) return BRAMBLE.berryHi;
    if (h < 0.15) return BRAMBLE.thorn;
    return v2 ? BRAMBLE.vineDark : BRAMBLE.vine;
  }
  const base = band(P.rough, noise2(ax / 9, ay / 9, 9), ax, ay);
  return mixRGB(base, [40, 50, 20], 0.35);
}

