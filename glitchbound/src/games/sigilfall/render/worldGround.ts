import { hash2, noise2 } from '../core/math';
import { K, TILE, type TileMap } from '../sim/map';
import type { GroundSet, Overlays, WorldArt } from './art/atlas';
import type { Recipe } from './art/recipes';
import { canvas, ctx2d, type Cnv } from './pixel';

/**
 * The ground of an outdoor land in the approved hierarchy (VISUAL_BIBLE.md §1, §3): CraftPix tiles lead —
 * whole tiles for the open land, its blob sets for roads, sand and patches — and the Worlds-bundle overlays
 * (water, cobbles, planks, tilled soil, normalized at build) lie on top on a dual grid: each overlay tile is
 * centered on a tile corner and picked by the four tiles that meet there, so a pond's edge runs along the
 * same tile edges that stop the hero. Royal Keep (its smoothed 64 px build) draws only castle walls.
 *
 * Painted in 8 x 8-tile chunks at 64 px per tile, on demand.
 */

const T = 64;
const CHUNK = 8;
const CA = CHUNK * T;
const CW = CHUNK * TILE;
const KEEP = 120;

/** Neighbour order of the blob masks: n e s w ne se sw nw. */
const NB: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];

const GROUNDS = new Set<number>([K.Floor, K.Deco, K.Path, K.Cobble, K.Sand]);
const STANDING = new Set<number>([K.Prop, K.Tree, K.Bush, K.Rock, K.Fence, K.Pillar, K.Brazier, K.Floor]);

const key = (cx: number, cy: number): number => cy * 4096 + cx;

export interface GroundDecal {
  x: number;
  y: number;
  c: Cnv;
}

export interface WorldGroundArt {
  ground: GroundSet;
  over: Overlays;
  /** Royal Keep's smoothed build, for castle walls (null: none in this land). */
  rk: WorldArt | null;
}

export class WorldGround {
  private readonly map: TileMap;
  private readonly art: WorldGroundArt;
  private readonly r: Recipe;
  private readonly cache = new Map<number, Cnv>();
  private readonly decals: GroundDecal[];
  /** The ground each tile lies on (things standing on a road keep the road under them). */
  private readonly lie: Uint8Array;
  private readonly patch: Uint8Array;
  /** Farm fields: Deco tiles inside a fence. */
  private readonly field: Uint8Array;
  /** Castle-wall faces: 1 bottom row, 2 the row above it. */
  private readonly face: Uint8Array;
  /** Mask -> tiles of each blob set, with the nearest available mask for the ones the set lacks. */
  private readonly blob = new Map<string, number[]>();

  constructor(map: TileMap, art: WorldGroundArt, recipe: Recipe, decals: GroundDecal[]) {
    this.map = map;
    this.art = art;
    this.r = recipe;
    this.decals = decals;
    const n = map.w * map.h;
    this.lie = new Uint8Array(n);
    this.patch = new Uint8Array(n);
    this.field = new Uint8Array(n);
    this.face = new Uint8Array(n);
    const share = recipe.ground.patches?.share ?? 0;
    for (let i = 0; i < n; i++) {
      const x = i % map.w;
      const y = Math.floor(i / map.w);
      const k = map.kind[i]!;
      this.lie[i] = GROUNDS.has(k) ? k : K.Floor;
      if (share > 0 && noise2(x / 9, y / 9, 517) > 1 - share * 1.15) this.patch[i] = 1;
      if (k === K.Rampart) {
        const below = y + 1 < map.h ? map.kind[i + map.w] : k;
        if (below !== k) this.face[i] = 1;
        else if (y + 2 < map.h && map.kind[i + map.w * 2] !== k && y > 0 && map.kind[i - map.w] === k) this.face[i] = 2;
      }
    }
    // what stands on a tile lies on the ground most of its neighbours have
    for (let i = 0; i < n; i++) {
      if (!STANDING.has(map.kind[i]!)) continue;
      const x = i % map.w;
      const y = Math.floor(i / map.w);
      const count = new Map<number, number>();
      for (const [dx, dy] of NB.slice(0, 4)) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
        const g = map.kind[ny * map.w + nx]!;
        if (g !== K.Floor && g !== K.Deco && GROUNDS.has(g)) count.set(g, (count.get(g) ?? 0) + 1);
      }
      let best: number = K.Floor;
      let most = 0;
      for (const [g, c] of count) if (c > most) [best, most] = [g, c];
      if (most >= (map.kind[i] === K.Floor ? 3 : 2)) this.lie[i] = best;
    }
    // fields: flowers and furrows inside a fence (the generator's farms)
    if (recipe.ground.field) {
      for (let i = 0; i < n; i++) {
        if (map.kind[i] !== K.Deco) continue;
        const x = i % map.w;
        const y = Math.floor(i / map.w);
        let fenced = 0;
        for (const [dx, dy] of NB.slice(0, 4)) {
          for (let s = 1; s <= 6; s++) {
            const nx = x + dx * s;
            const ny = y + dy * s;
            if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) break;
            const nk = map.kind[ny * map.w + nx];
            if (nk === K.Fence) {
              fenced++;
              break;
            }
            if (nk !== K.Deco) break;
          }
        }
        if (fenced >= 3) this.field[i] = 1;
      }
    }
  }

  dispose(): void {
    this.cache.clear();
  }

  draw(g: CanvasRenderingContext2D, ox: number, oy: number, vw: number, vh: number): void {
    const cx0 = Math.max(0, Math.floor(ox / CW));
    const cy0 = Math.max(0, Math.floor(oy / CW));
    const cx1 = Math.floor((ox + vw - 1) / CW);
    const cy1 = Math.floor((oy + vh - 1) / CW);
    const smooth = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = true;
    // chunks meet on whole canvas pixels (a fractional scale, as in a small window, would leave a hairline
    // between them); scaled, each is sampled half a pixel in from its edge so its border never blends with
    // the transparent outside
    const a = g.getTransform().a;
    const snap = (v: number): number => Math.round(v * a) / a;
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = this.chunk(cx, cy);
        const x0 = snap(cx * CW - ox);
        const y0 = snap(cy * CW - oy);
        const w = snap((cx + 1) * CW - ox) - x0;
        const h = snap((cy + 1) * CW - oy) - y0;
        const k = c.width / CW;
        const inset = Math.abs(a - k) > 1e-3 ? 0.5 : 0;
        g.drawImage(c, inset, inset, c.width - inset * 2, c.height - inset * 2, x0, y0, w, h);
      }
    }
    g.imageSmoothingEnabled = smooth;
  }

  prefetch(ox: number, oy: number, vw: number, vh: number): void {
    const cols = Math.ceil(this.map.w / CHUNK);
    const rows = Math.ceil(this.map.h / CHUNK);
    const cx0 = Math.max(0, Math.floor(ox / CW) - 1);
    const cy0 = Math.max(0, Math.floor(oy / CW) - 1);
    const cx1 = Math.min(cols - 1, Math.floor((ox + vw) / CW) + 1);
    const cy1 = Math.min(rows - 1, Math.floor((oy + vh) / CW) + 1);
    let budget = 1;
    for (let cy = cy0; cy <= cy1 && budget > 0; cy++) {
      for (let cx = cx0; cx <= cx1 && budget > 0; cx++) {
        if (!this.cache.has(key(cx, cy))) {
          this.chunk(cx, cy);
          budget--;
        }
      }
    }
  }

  private chunk(cx: number, cy: number): Cnv {
    const k = key(cx, cy);
    const hit = this.cache.get(k);
    if (hit) {
      this.cache.delete(k);
      this.cache.set(k, hit);
      return hit;
    }
    const c = canvas(CA, CA);
    const g = ctx2d(c);
    g.imageSmoothingEnabled = true;
    const tx0 = cx * CHUNK;
    const ty0 = cy * CHUNK;
    for (let ty = ty0; ty < ty0 + CHUNK; ty++) for (let tx = tx0; tx < tx0 + CHUNK; tx++) if (tx < this.map.w && ty < this.map.h) this.paintTile(g, tx, ty, (tx - tx0) * T, (ty - ty0) * T);
    // overlays on the dual grid: every corner of the chunk's tiles, so pieces crossing the edge are drawn on both sides
    for (let vy = ty0; vy <= ty0 + CHUNK; vy++) for (let vx = tx0; vx <= tx0 + CHUNK; vx++) this.paintCorner(g, vx, vy, (vx - tx0) * T - T / 2, (vy - ty0) * T - T / 2);
    // castle walls over everything flat
    if (this.art.rk) for (let ty = ty0; ty < ty0 + CHUNK; ty++) for (let tx = tx0; tx < tx0 + CHUNK; tx++) if (tx < this.map.w && ty < this.map.h && this.map.kind[ty * this.map.w + tx] === K.Rampart) this.paintWall(g, tx, ty, (tx - tx0) * T, (ty - ty0) * T);
    const x0 = cx * CA;
    const y0 = cy * CA;
    for (const dc of this.decals) {
      // decals are made at 32 px per tile: drawn at twice their size
      const x = dc.x * 2 - x0;
      const y = dc.y * 2 - y0;
      if (x < CA && y < CA && x + dc.c.width * 2 > 0 && y + dc.c.height * 2 > 0) g.drawImage(dc.c, x, y, dc.c.width * 2, dc.c.height * 2);
    }
    this.cache.set(k, c);
    while (this.cache.size > KEEP) this.cache.delete(this.cache.keys().next().value!);
    return c;
  }

  private kindAt(tx: number, ty: number): number {
    const m = this.map;
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return -1;
    return m.kind[ty * m.w + tx]!;
  }

  private put(g: CanvasRenderingContext2D, i: number | undefined, x: number, y: number, from: { img: Cnv; at: (i: number) => [number, number] } = this.art.ground): void {
    if (i === undefined) return;
    const [sx, sy] = from.at(i);
    g.drawImage(from.img, sx, sy, T, T, x, y, T, T);
  }

  /** The tiles of a blob set for a mask, or of the nearest mask the set has (edges count twice). */
  private blobTiles(set: string, mask: string): number[] {
    const id = `${set}:${mask}`;
    let hit = this.blob.get(id);
    if (hit) return hit;
    const masks = this.art.ground.sets[set] ?? {};
    hit = masks[mask];
    if (!hit) {
      let best = Infinity;
      for (const [m, tiles] of Object.entries(masks)) {
        let d = 0;
        for (let b = 0; b < 8; b++) if (m[b] !== mask[b]) d += b < 4 ? 2 : 1;
        if (d < best) [best, hit] = [d, tiles];
      }
    }
    this.blob.set(id, hit ?? []);
    return hit ?? [];
  }

  private putBlob(g: CanvasRenderingContext2D, set: string, tx: number, ty: number, x: number, y: number, same: (nx: number, ny: number) => boolean): void {
    const bit = NB.map(([dx, dy]) => {
      const nx = tx + dx;
      const ny = ty + dy;
      return nx < 0 || ny < 0 || nx >= this.map.w || ny >= this.map.h || same(nx, ny);
    });
    const [n, e, s, w] = bit;
    const mask = [n, e, s, w, bit[4] && n && e, bit[5] && s && e, bit[6] && s && w, bit[7] && n && w].map((b) => (b ? '1' : '0')).join('');
    const tiles = this.blobTiles(set, mask);
    this.put(g, tiles[Math.floor(hash2(tx, ty, 141) * tiles.length)], x, y);
  }

  private paintTile(g: CanvasRenderingContext2D, tx: number, ty: number, x: number, y: number): void {
    const m = this.map;
    const i = ty * m.w + tx;
    const gr = this.r.ground;
    const base = this.art.ground.fill[gr.base] ?? [];
    this.put(g, base[Math.floor(hash2(tx, ty, 101) * base.length)], x, y);
    if (gr.patches && this.patch[i]) this.putBlob(g, gr.patches.set, tx, ty, x, y, (nx, ny) => this.patch[ny * m.w + nx] === 1);
    const lie = this.lie[i];
    const lieAt = (nx: number, ny: number): number => this.lie[ny * m.w + nx]!;
    if (lie === K.Path) this.putBlob(g, gr.path, tx, ty, x, y, (nx, ny) => lieAt(nx, ny) === K.Path);
    if (lie === K.Sand) this.putBlob(g, gr.sand, tx, ty, x, y, (nx, ny) => lieAt(nx, ny) === K.Sand);
    // the capital's squares are Royal Keep's (architecture): its cobble set, smoothed
    if (lie === K.Cobble && gr.cobble === 'rk') this.putRk(g, 'cobble', tx, ty, x, y, (nx, ny) => lieAt(nx, ny) === K.Cobble);
  }

  /** A Royal Keep blob tile (its 47-piece names), with its extra centre pieces now and then. */
  private putRk(g: CanvasRenderingContext2D, set: string, tx: number, ty: number, x: number, y: number, same: (nx: number, ny: number) => boolean): void {
    const rk = this.art.rk;
    if (!rk) return;
    const bit = NB.map(([dx, dy]) => {
      const nx = tx + dx;
      const ny = ty + dy;
      return nx < 0 || ny < 0 || nx >= this.map.w || ny >= this.map.h || same(nx, ny);
    });
    const [n, e, s, w] = bit;
    let name = `${set}_${[n, e, s, w, bit[4] && n && e, bit[5] && s && e, bit[6] && s && w, bit[7] && n && w].map((b) => (b ? '1' : '0')).join('')}`;
    if (name.endsWith('_11111111')) {
      const h = hash2(tx, ty, 333);
      if (h < 0.5) name = `${set}_c${1 + Math.floor((h / 0.5) * 4)}`;
    }
    const idx = rk.tile[name] ?? rk.tile[`${set}_11111111`];
    if (idx === undefined) return;
    const [sx, sy] = rk.tileAt(idx);
    g.drawImage(rk.tiles, sx, sy, rk.T, rk.T, x, y, T, T);
  }

  /** The overlay grounds meeting at a tile corner (dual grid). */
  private paintCorner(g: CanvasRenderingContext2D, vx: number, vy: number, x: number, y: number): void {
    const m = this.map;
    const gr = this.r.ground;
    const at = (tx: number, ty: number): number => {
      const cx = Math.min(m.w - 1, Math.max(0, tx));
      const cy = Math.min(m.h - 1, Math.max(0, ty));
      return cy * m.w + cx;
    };
    const tl = at(vx - 1, vy - 1);
    const tr = at(vx, vy - 1);
    const bl = at(vx - 1, vy);
    const br = at(vx, vy);
    const layer = (name: string | undefined, test: (i: number) => boolean): void => {
      if (!name) return;
      const o = this.art.over.overlays[name];
      if (!o) return;
      const idx = (test(tl) ? 8 : 0) + (test(tr) ? 4 : 0) + (test(bl) ? 2 : 0) + (test(br) ? 1 : 0);
      if (!idx) return;
      // the inside is a seamless 4 x 4 texture, laid by position
      const tile = idx === 15 && o.full.length === 16 ? o.full[(((vy % 4) + 4) % 4) * 4 + (((vx % 4) + 4) % 4)] : o.wang[idx];
      this.put(g, tile, x, y, this.art.over);
    };
    const kind = (i: number): number => m.kind[i]!;
    layer(gr.field, (i) => this.field[i] === 1);
    if (gr.cobble !== 'rk') layer(gr.cobble, (i) => this.lie[i] === K.Cobble);
    layer(gr.water, (i) => kind(i) === K.Water || kind(i) === K.Bridge);
    layer(gr.bridge, (i) => kind(i) === K.Bridge);
  }

  /** A castle wall: Royal Keep's wall top, and its face on the southern rows (inside the wall's tiles). */
  private paintWall(g: CanvasRenderingContext2D, tx: number, ty: number, x: number, y: number): void {
    const rk = this.art.rk!;
    const m = this.map;
    const i = ty * m.w + tx;
    const put = (name: string): boolean => {
      const idx = rk.tile[name];
      if (idx === undefined) return false;
      const [sx, sy] = rk.tileAt(idx);
      g.drawImage(rk.tiles, sx, sy, rk.T, rk.T, x, y, T, T);
      return true;
    };
    const face = this.face[i]!;
    const same = (nx: number, ny: number): boolean => {
      const k = this.kindAt(nx, ny);
      return k === -1 || (k === K.Rampart && !this.face[ny * m.w + nx]);
    };
    if (!face) {
      const bit = NB.map(([dx, dy]) => same(tx + dx, ty + dy));
      const [n, e, s, w] = bit;
      const mask = [n, e, s, w, bit[4] && n && e, bit[5] && s && e, bit[6] && s && w, bit[7] && n && w].map((b) => (b ? '1' : '0')).join('');
      if (!put(`wall_${mask}`)) put('wall_11111111');
      return;
    }
    const left = this.kindAt(tx - 1, ty);
    const right = this.kindAt(tx + 1, ty);
    const l = left !== K.Rampart && left !== -1;
    const r = right !== K.Rampart && right !== -1;
    const col = l && r ? 'lr' : l ? 'l' : r ? 'r' : 'm';
    const tall = face === 2 || this.face[i - m.w] === 2;
    const row = !tall ? 'tb' : face === 2 ? 't' : 'b';
    if (!put(`wall_${row}_${col}`)) put(`wall_${row}_m`);
  }
}
