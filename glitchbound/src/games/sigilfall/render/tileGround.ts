import { hash2, noise2 } from '../core/math';
import { K, TILE, type TileMap } from '../sim/map';
import type { WorldArt } from './art/atlas';
import type { Biome } from './art/biomes';
import { canvas, ctx2d, DETAIL, type Cnv } from './pixel';

/**
 * The ground of an outdoor land drawn from the Royal Keep tiles: grass (with patches of a second
 * ground), auto-tiled dirt roads, cobbles, water, bridges, and the tops and faces of cliffs and city
 * walls, with decals scattered over the open ground. Painted in chunks like the procedural ground
 * (ground.ts), but by copying tiles, so a chunk takes well under a millisecond and needs no worker.
 *
 * Everything sits inside the tiles the simulation uses: a cliff's face is drawn on the cliff's own
 * southern row, never on the walkable ground below it.
 */

const D = DETAIL;
/** Art pixels per tile (the Royal Keep grid is 32 px, exactly a tile at DETAIL 2). */
const T = TILE * D;
const CHUNK = 8;
const CA = CHUNK * T;
const CW = CHUNK * TILE;
const KEEP = 160;

/** Neighbour order of the pack's masks: n e s w ne se sw nw. */
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

const key = (cx: number, cy: number): number => cy * 4096 + cx;

/** Grounds a road or square is made of (a tile of another kind lies on one of these). */
const GROUNDS = new Set<K>([K.Floor, K.Deco, K.Path, K.Cobble, K.Sand]);
/** Things that stand on the ground rather than being it. */
const STANDING = new Set<K>([K.Prop, K.Tree, K.Bush, K.Rock, K.Fence, K.Pillar, K.Brazier, K.Floor]);

/** A flat picture laid on the ground, in art pixels. */
export interface GroundDecal {
  x: number;
  y: number;
  c: Cnv;
}

/**
 * A wall tile that isn't part of any 2 x 2 block of wall: a spine one tile thick. In bare lands it is
 * drawn as a line of boulders rather than as a cliff (a one-tile cliff reads as a garden wall).
 */
export function thinWall(map: TileMap, tx: number, ty: number): boolean {
  const k = map.kind[ty * map.w + tx];
  const is = (x: number, y: number): boolean => x < 0 || y < 0 || x >= map.w || y >= map.h || map.kind[y * map.w + x] === k;
  for (const [ox, oy] of [
    [0, 0],
    [-1, 0],
    [0, -1],
    [-1, -1],
  ] as const) {
    if (is(tx + ox, ty + oy) && is(tx + ox + 1, ty + oy) && is(tx + ox, ty + oy + 1) && is(tx + ox + 1, ty + oy + 1)) return false;
  }
  return true;
}

export class TileGround {
  private readonly map: TileMap;
  private readonly art: WorldArt;
  private readonly biome: Biome;
  private readonly cache = new Map<number, Cnv>();
  private readonly decals: GroundDecal[];
  /** Per tile: which ground it is drawn as (0 base, 1 patch). */
  private readonly patch: Uint8Array;
  /** Tiles that are a cliff's or wall's face (their southern row). */
  private readonly face: Uint8Array;
  /** The ground each tile lies on: things standing on a road or a square (a lamp, a well, a crate) keep its ground. */
  private readonly lie: Uint8Array;

  constructor(map: TileMap, art: WorldArt, biome: Biome, decals: GroundDecal[]) {
    this.map = map;
    this.art = art;
    this.biome = biome;
    this.decals = decals;
    const n = map.w * map.h;
    this.patch = new Uint8Array(n);
    this.face = new Uint8Array(n);
    this.lie = new Uint8Array(n);
    const share = biome.patches?.share ?? 0;
    for (let i = 0; i < n; i++) {
      const x = i % map.w;
      const y = Math.floor(i / map.w);
      // patches are smooth blobs: low-frequency noise, thresholded by the share
      if (share > 0 && noise2(x / 9, y / 9, 517) > 1 - share * 1.15) this.patch[i] = 1;
      const k = map.kind[i];
      const below = y + 1 < map.h ? map.kind[i + map.w] : k;
      if (k === K.Wall && biome.edge === 'ledge' && thinWall(map, x, y)) this.face[i] = 3;
      else if ((k === K.Wall && biome.edge === 'ledge') || k === K.Rampart) {
        if (below !== k) this.face[i] = 1;
        // walls and cliffs stand two tiles tall where they are thick enough
        else if (y + 2 < map.h && map.kind[i + map.w * 2] !== k && y > 0 && map.kind[i - map.w] === k) this.face[i] = 2;
      }
      this.lie[i] = k !== undefined && GROUNDS.has(k as K) ? k : K.Floor;
    }
    // what stands on a tile takes the ground most of its neighbours have
    for (let i = 0; i < n; i++) {
      if (!STANDING.has(map.kind[i] as K)) continue;
      const x = i % map.w;
      const count = new Map<number, number>();
      for (const [dx, dy] of NB.slice(0, 4)) {
        const nx = x + dx;
        const ny = Math.floor(i / map.w) + dy;
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
        const g = map.kind[ny * map.w + nx] as K;
        if (GROUNDS.has(g)) count.set(g, (count.get(g) ?? 0) + 1);
      }
      let best: number = K.Floor;
      let most = 0;
      for (const [g, c] of count) if (g !== K.Floor && g !== K.Deco && c > most) [best, most] = [g, c];
      // a bare tile only fills a hole in a road or square; a thing standing there sits on its ground
      if (most >= (map.kind[i] === K.Floor ? 3 : 2)) this.lie[i] = best;
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
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) g.drawImage(this.chunk(cx, cy), cx * CW - ox, cy * CW - oy, CW, CW);
  }

  /** Paints a chunk or two just outside the view, so walking never waits on one. */
  prefetch(ox: number, oy: number, vw: number, vh: number): void {
    const cols = Math.ceil(this.map.w / CHUNK);
    const rows = Math.ceil(this.map.h / CHUNK);
    const cx0 = Math.max(0, Math.floor(ox / CW) - 1);
    const cy0 = Math.max(0, Math.floor(oy / CW) - 1);
    const cx1 = Math.min(cols - 1, Math.floor((ox + vw) / CW) + 1);
    const cy1 = Math.min(rows - 1, Math.floor((oy + vh) / CW) + 1);
    let budget = 2;
    for (let cy = cy0; cy <= cy1 && budget > 0; cy++) {
      for (let cx = cx0; cx <= cx1 && budget > 0; cx++) {
        if (!this.cache.has(key(cx, cy))) {
          this.chunk(cx, cy);
          budget--;
        }
      }
    }
  }

  /** Water tiles in view, drawn with the frame of the moment (the pack's water has four). */
  drawWater(g: CanvasRenderingContext2D, ox: number, oy: number, vw: number, vh: number, time: number): void {
    const m = this.map;
    const f = Math.floor(time * 8.3) % 4;
    const tx0 = Math.max(0, Math.floor(ox / TILE));
    const ty0 = Math.max(0, Math.floor(oy / TILE));
    const tx1 = Math.min(m.w - 1, Math.floor((ox + vw) / TILE));
    const ty1 = Math.min(m.h - 1, Math.floor((oy + vh) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (m.kind[ty * m.w + tx] !== K.Water) continue;
        const name = this.autoName('water', tx, ty, (k) => k === K.Water || k === K.Bridge);
        const idx = this.art.tile[f ? `${name}_f${f}` : name] ?? this.art.tile[name];
        if (idx === undefined) continue;
        const [sx, sy] = this.art.tileAt(idx);
        g.drawImage(this.art.tiles, sx, sy, T, T, tx * TILE, ty * TILE, TILE, TILE);
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
    const tx0 = cx * CHUNK;
    const ty0 = cy * CHUNK;
    for (let ty = ty0; ty < ty0 + CHUNK; ty++) {
      for (let tx = tx0; tx < tx0 + CHUNK; tx++) {
        if (tx >= this.map.w || ty >= this.map.h) continue;
        this.paintTile(g, tx, ty, (tx - tx0) * T, (ty - ty0) * T);
      }
    }
    const x0 = cx * CA;
    const y0 = cy * CA;
    for (const dc of this.decals) {
      const x = dc.x - x0;
      const y = dc.y - y0;
      if (x < CA && y < CA && x + dc.c.width > 0 && y + dc.c.height > 0) g.drawImage(dc.c, x, y);
    }
    this.cache.set(k, c);
    while (this.cache.size > KEEP) this.cache.delete(this.cache.keys().next().value!);
    return c;
  }

  private kindAt(tx: number, ty: number): number {
    const m = this.map;
    // past the edge counts as more of the same, so no border is drawn along the map's rim
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return -1;
    return m.kind[ty * m.w + tx]!;
  }

  /** The 47-piece name for a ground at a tile: its neighbours that are the same ground. */
  private autoName(set: string, tx: number, ty: number, same: (k: number, x: number, y: number) => boolean): string {
    const bit = NB.map(([dx, dy]) => {
      const k = this.kindAt(tx + dx, ty + dy);
      return k === -1 || same(k, tx + dx, ty + dy);
    });
    // a corner only counts when both of its sides do
    const [n, e, s, w] = bit;
    const ne = bit[4] && n && e;
    const se = bit[5] && s && e;
    const sw = bit[6] && s && w;
    const nw = bit[7] && n && w;
    const mask = [n, e, s, w, ne, se, sw, nw].map((b) => (b ? '1' : '0')).join('');
    return `${set}_${mask}`;
  }

  private put(g: CanvasRenderingContext2D, name: string, x: number, y: number): boolean {
    const idx = this.art.tile[name];
    if (idx === undefined) return false;
    const [sx, sy] = this.art.tileAt(idx);
    g.drawImage(this.art.tiles, sx, sy, T, T, x, y, T, T);
    return true;
  }

  private putAuto(g: CanvasRenderingContext2D, set: string, tx: number, ty: number, x: number, y: number, same: (k: number, x: number, y: number) => boolean): void {
    let name = this.autoName(set, tx, ty, same);
    // big areas: break up the middle with the pack's alternative centre pieces
    if (name.endsWith('_11111111')) {
      const h = hash2(tx, ty, 333);
      const alt = [`${set}_c1`, `${set}_c2`, `${set}_c3`, `${set}_c4`, `${set}_c5`].filter((n) => this.art.tile[n] !== undefined);
      if (alt.length && h < 0.5) name = alt[Math.floor((h / 0.5) * alt.length)]!;
    }
    if (!this.put(g, name, x, y)) this.put(g, `${set}_11111111`, x, y);
  }

  private paintTile(g: CanvasRenderingContext2D, tx: number, ty: number, x: number, y: number): void {
    const m = this.map;
    const i = ty * m.w + tx;
    const k = m.kind[i]!;
    const b = this.biome;
    const h = hash2(tx, ty, 101);
    // 1. the open land
    if (b.base === 'sand') this.putAuto(g, 'sand', tx, ty, x, y, () => true);
    else if (b.base === 'ash') this.putAuto(g, 'ash', tx, ty, x, y, () => true);
    else this.put(g, `grass_${Math.floor(h * 16)}`, x, y);
    // a second ground in patches (never under roads, which have their own edges)
    if (b.patches && this.patch[i]) this.putAuto(g, b.patches.set, tx, ty, x, y, (_k, nx, ny) => this.patch[ny * m.w + nx] === 1);
    // woods: the forest floor is dark grass under the trees
    if (k === K.Wall && b.edge === 'forest') this.putAuto(g, 'dgrass', tx, ty, x, y, (nk) => nk === K.Wall || nk === K.Illusion);
    // 2. roads and yards
    const lie = this.lie[i];
    const lieAt = (nx: number, ny: number): number => this.lie[ny * m.w + nx]!;
    if (lie === K.Path) this.putAuto(g, 'dirt', tx, ty, x, y, (_nk, nx, ny) => lieAt(nx, ny) === K.Path);
    if (lie === K.Sand) this.putAuto(g, 'sand', tx, ty, x, y, (_nk, nx, ny) => lieAt(nx, ny) === K.Sand);
    if (lie === K.Cobble) this.putAuto(g, 'cobble', tx, ty, x, y, (_nk, nx, ny) => lieAt(nx, ny) === K.Cobble);
    // 3. water and bridges
    if (k === K.Water || k === K.Bridge) this.putAuto(g, 'water', tx, ty, x, y, (nk) => nk === K.Water || nk === K.Bridge);
    if (k === K.Bridge) this.bridge(g, tx, ty, x, y);
    // 4. cliffs and city walls: the top auto-tiles, the face hangs on the southern rows
    if (((k === K.Wall && b.edge === 'ledge') || k === K.Rampart) && this.face[i] !== 3) {
      const set = k === K.Rampart ? 'wall' : 'ledge';
      const faceSet = k === K.Rampart ? 'wall' : 'cliff';
      const face = this.face[i]!;
      if (!face) this.putAuto(g, set, tx, ty, x, y, (nk, nx, ny) => nk === k && !this.face[ny * m.w + nx]);
      else {
        const left = this.kindAt(tx - 1, ty);
        const right = this.kindAt(tx + 1, ty);
        const l = left !== k && left !== -1;
        const r = right !== k && right !== -1;
        const col = l && r ? 'lr' : l ? 'l' : r ? 'r' : 'm';
        const tall = face === 2 || this.face[i - m.w] === 2;
        const row = !tall ? 'tb' : face === 2 ? 't' : 'b';
        let name = `${faceSet}_${row}_${col}`;
        // long runs: the pack's variant middles (a crack, moss, a slit) now and then
        if (col === 'm' && h > 0.7) {
          const alts = ['m_2', 'm_3', 'm_moss', 'm_crack', 'm_slit'].map((v) => `${faceSet}_${row}_${v}`).filter((n) => this.art.tile[n] !== undefined);
          if (alts.length) name = alts[Math.floor(((h - 0.7) / 0.3) * alts.length)]!;
        }
        if (!this.put(g, name, x, y)) this.put(g, `${faceSet}_${row}_m`, x, y);
      }
    }
    // 5. a little life on the open ground
    if (k === K.Deco) {
      const d = b.decals[Math.floor(hash2(tx, ty, 103) * b.decals.length)];
      if (d) this.put(g, d, x, y);
    } else if (k === K.Floor && h > 0.93 && b.decals.length) {
      const d = b.decals[Math.floor(hash2(tx, ty, 104) * b.decals.length)];
      if (d) this.put(g, d, x, y);
    }
  }

  private bridge(g: CanvasRenderingContext2D, tx: number, ty: number, x: number, y: number): void {
    const isB = (dx: number, dy: number): boolean => this.kindAt(tx + dx, ty + dy) === K.Bridge;
    const land = (dx: number, dy: number): boolean => {
      const k = this.kindAt(tx + dx, ty + dy);
      return k !== K.Water && k !== K.Bridge && k !== -1;
    };
    // a bridge runs the way it has land or more bridge at both ends
    const horizontal = (isB(-1, 0) || land(-1, 0)) && (isB(1, 0) || land(1, 0)) && !(isB(0, -1) && isB(0, 1));
    if (horizontal) this.put(g, isB(-1, 0) ? (isB(1, 0) ? 'bridge_h_m' : 'bridge_h_r') : 'bridge_h_l', x, y);
    else this.put(g, isB(0, -1) ? (isB(0, 1) ? 'bridge_v_m' : 'bridge_v_b') : 'bridge_v_t', x, y);
  }
}
