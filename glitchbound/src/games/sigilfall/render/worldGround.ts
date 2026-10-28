import { hash2, noise2 } from '../core/math';
import { K, TILE, type TileMap } from '../sim/map';
import type { WorldArt } from './art/atlas';
import type { Recipe } from './art/recipes';
import { canvas, ctx2d, type Cnv } from './pixel';

/**
 * The ground of an outdoor land, all of it Royal Keep's (VISUAL_BIBLE.md §1): the pack's grass tiles for the
 * open land, its auto-tiling sets laid over them (meadow and dark-grass patches, the woods' floor, dirt roads,
 * sand, cobbled squares, tilled fields), each blending into what lies under it through its see-through edges,
 * its decals (tufts, flowers, clover, pebbles) about the grass, and its castle walls. Water and bridges are
 * the pack's animated tiles, drawn each frame over the painted ground.
 *
 * Painted in 8 x 8-tile chunks at 64 px per tile, on demand.
 */

const T = 64;
const CHUNK = 8;
const CA = CHUNK * T;
const CW = CHUNK * TILE;
const KEEP = 120;
/** Milliseconds a frame of the water's ripple lasts (the pack suggests 120; a pond is calmer). */
const WATER_MS = 220;

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
/** Things standing on a tile lie on the ground most of their neighbours have. */
const STANDING = new Set<number>([K.Prop, K.Tree, K.Bush, K.Rock, K.Fence, K.Pillar, K.Brazier, K.Floor, K.House, K.HouseAnchor, K.Bramble]);
const WOODS = new Set<number>([K.Wall, K.Tree, K.Illusion]);

const key = (cx: number, cy: number): number => cy * 4096 + cx;

export interface GroundDecal {
  x: number;
  y: number;
  c: Cnv;
}

/** A blob mask from which neighbours continue a ground (corners only where both sides do). */
function maskOf(same: (dx: number, dy: number) => boolean): string {
  const bit = NB.map(([dx, dy]) => same(dx, dy));
  const [n, e, s, w] = bit;
  return [n, e, s, w, bit[4] && n && e, bit[5] && s && e, bit[6] && s && w, bit[7] && n && w].map((b) => (b ? '1' : '0')).join('');
}

/**
 * The rows of a raised block (a castle wall, a cliff) that show its south face: 1 the bottom row, 2 the row above
 * it where the block is tall enough; 0 its top. `kind` is the block's tile kind.
 */
export function faces(map: TileMap, kind: number, rows = 2): Uint8Array {
  const n = map.w * map.h;
  const out = new Uint8Array(n);
  const is = (i: number): boolean => i >= 0 && i < n && map.kind[i] === kind;
  // from the bottom up: a face row is the block's bottom row, or the row above a face row, as long as the
  // block keeps a row of top above it (a block two rows deep shows one row of face)
  for (let r = 1; r <= rows; r++) {
    for (let i = 0; i < n; i++) {
      if (!is(i) || out[i]) continue;
      const y = Math.floor(i / map.w);
      const below = y + 1 < map.h ? i + map.w : -1;
      if (r === 1 ? below === -1 || !is(below) : below !== -1 && out[below] === r - 1 && is(i - map.w)) out[i] = r;
    }
  }
  return out;
}

/** Which row of its face a face tile is: 'tb' a face one row tall, else 't', 'm' or 'b'. */
function faceRow(faceOf: Uint8Array, w: number, i: number): 'tb' | 't' | 'm' | 'b' {
  let k = i;
  while (k - w >= 0 && faceOf[k - w]! > 0) k -= w;
  const height = faceOf[k]!;
  const f = faceOf[i]!;
  return height === 1 ? 'tb' : f === height ? 't' : f === 1 ? 'b' : 'm';
}

/** Farm fields: Deco tiles fenced in on three sides or more (the generator's farms). */
export function farmFields(map: TileMap): Uint8Array {
  const out = new Uint8Array(map.w * map.h);
  const kindAt = (x: number, y: number): number => (x < 0 || y < 0 || x >= map.w || y >= map.h ? K.Wall : map.kind[y * map.w + x]!);
  for (let i = 0; i < map.w * map.h; i++) {
    if (map.kind[i] !== K.Deco) continue;
    const x = i % map.w;
    const y = Math.floor(i / map.w);
    let fenced = 0;
    for (const [dx, dy] of NB.slice(0, 4)) {
      for (let s = 1; s <= 8; s++) {
        const nk = kindAt(x + dx * s, y + dy * s);
        if (nk === K.Fence) {
          fenced++;
          break;
        }
        if (nk !== K.Deco) break;
      }
    }
    if (fenced >= 3) out[i] = 1;
  }
  return out;
}

export class WorldGround {
  private readonly map: TileMap;
  private readonly rk: WorldArt;
  private readonly r: Recipe;
  private readonly cache = new Map<number, Cnv>();
  private readonly decals: GroundDecal[];
  /** The ground each tile lies on (things standing on a road keep the road under them). */
  private readonly lie: Uint8Array;
  /** Membership of each patch layer, and of the woods' floor. */
  private readonly patches: Uint8Array[];
  private readonly under: Uint8Array;
  /** Farm fields: Deco tiles inside a fence. */
  readonly field: Uint8Array;
  /** Castle-wall faces: 1 bottom row, 2 the row above it. */
  private readonly face: Uint8Array;
  /** Cliff faces of a bare land's rock (its woods are cliffs: VISUAL_BIBLE.md §3), or null in a wooded land. */
  private readonly cliff: Uint8Array | null;
  /** Water tiles' mask names, and bridges' piece names, by tile. */
  private readonly water = new Map<number, string>();
  private readonly bridges = new Map<number, string>();

  constructor(map: TileMap, rk: WorldArt, recipe: Recipe, decals: GroundDecal[]) {
    this.map = map;
    this.rk = rk;
    this.r = recipe;
    this.decals = decals;
    const n = map.w * map.h;
    this.lie = new Uint8Array(n);
    this.under = new Uint8Array(n);
    this.patches = recipe.ground.patches.map(() => new Uint8Array(n));
    const kindAt = (x: number, y: number): number => (x < 0 || y < 0 || x >= map.w || y >= map.h ? K.Wall : map.kind[y * map.w + x]!);
    for (let i = 0; i < n; i++) {
      const x = i % map.w;
      const y = Math.floor(i / map.w);
      const k = map.kind[i]!;
      this.lie[i] = GROUNDS.has(k) ? k : K.Floor;
      // patches where a slow noise (two octaves, so their edges wander) is high, each its own field
      recipe.ground.patches.forEach((p, j) => {
        const v = noise2(x / p.size, y / p.size, 517 + j * 71) * 0.65 + noise2(x / (p.size * 0.4), y / (p.size * 0.4), 519 + j * 71) * 0.35;
        if (v > 1 - p.share * 1.1) this.patches[j]![i] = 1;
      });
      // the woods' floor reaches a ragged step past their edge
      if (WOODS.has(k) || k === K.Bush || k === K.Bramble) this.under[i] = 1;
      else if (k === K.Floor || k === K.Deco) {
        let near = 0;
        for (const [dx, dy] of NB.slice(0, 4)) if (WOODS.has(kindAt(x + dx, y + dy))) near++;
        if (near && hash2(x, y, 523) < 0.3 + near * 0.15) this.under[i] = 1;
      }
    }
    this.face = faces(map, K.Rampart);
    this.cliff = recipe.edge === 'rocks' ? faces(map, K.Wall, 3) : null;
    // rounded off: a tile joins its patch where most of the 3 x 3 round it is in it (no lone specks or slivers)
    for (const layer of [...this.patches, this.under]) {
      for (let pass = 0; pass < 2; pass++) {
        const src = layer.slice();
        for (let i = 0; i < n; i++) {
          const x = i % map.w;
          const y = Math.floor(i / map.w);
          let c = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) c += x + dx >= 0 && y + dy >= 0 && x + dx < map.w && y + dy < map.h ? src[i + dy * map.w + dx]! : src[i]!;
          // the woods' floor never leaves the woods
          layer[i] = c >= 5 || (layer === this.under && WOODS.has(map.kind[i]!)) ? 1 : 0;
        }
      }
    }
    // what stands on a tile lies on the ground most of its neighbours have
    for (let i = 0; i < n; i++) {
      if (!STANDING.has(map.kind[i]!)) continue;
      const x = i % map.w;
      const y = Math.floor(i / map.w);
      const count = new Map<number, number>();
      for (const [dx, dy] of NB.slice(0, 4)) {
        const g = kindAt(x + dx, y + dy);
        if (g !== K.Floor && g !== K.Deco && GROUNDS.has(g)) count.set(g, (count.get(g) ?? 0) + 1);
      }
      let best: number = K.Floor;
      let most = 0;
      for (const [g, c] of count) if (c > most) [best, most] = [g, c];
      if (most >= (map.kind[i] === K.Floor ? 3 : 2)) this.lie[i] = best;
    }
    this.field = farmFields(map);
    // water and its bridges: a bridge runs the way its span is longest, its end pieces on the banks' side
    const wet = (x: number, y: number): boolean => kindAt(x, y) === K.Water || kindAt(x, y) === K.Bridge;
    const bridge = (x: number, y: number): boolean => kindAt(x, y) === K.Bridge;
    const run = (x: number, y: number, dx: number, dy: number): number => {
      let c = 1;
      for (let s = 1; bridge(x + dx * s, y + dy * s); s++) c++;
      for (let s = 1; bridge(x - dx * s, y - dy * s); s++) c++;
      return c;
    };
    const kindName = this.r.ground.bridge;
    for (let i = 0; i < n; i++) {
      const k = map.kind[i]!;
      if (k !== K.Water && k !== K.Bridge) continue;
      const x = i % map.w;
      const y = Math.floor(i / map.w);
      this.water.set(i, `water_${maskOf((dx, dy) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx < 0 || ny < 0 || nx >= map.w || ny >= map.h || wet(nx, ny);
      })}`);
      if (k !== K.Bridge) continue;
      const across = run(x, y, 1, 0) >= run(x, y, 0, 1);
      const piece = across ? (bridge(x - 1, y) ? (bridge(x + 1, y) ? 'h_m' : 'h_r') : 'h_l') : bridge(x, y - 1) ? (bridge(x, y + 1) ? 'v_m' : 'v_b') : 'v_t';
      this.bridges.set(i, `${kindName}_${piece}`);
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

  /** The water's ripple and the bridges over it, each frame (drawn in world coordinates). */
  drawWater(g: CanvasRenderingContext2D, ox: number, oy: number, vw: number, vh: number, time: number): void {
    if (!this.water.size) return;
    const m = this.map;
    const rk = this.rk;
    const tx0 = Math.max(0, Math.floor(ox / TILE));
    const ty0 = Math.max(0, Math.floor(oy / TILE));
    const tx1 = Math.min(m.w - 1, Math.floor((ox + vw) / TILE));
    const ty1 = Math.min(m.h - 1, Math.floor((oy + vh) / TILE));
    const frame = Math.floor((time * 1000) / WATER_MS) % 4;
    const suffix = frame ? `_f${frame}` : '';
    // whole device pixels, so neighbouring tiles never leave a hairline between them
    const tr = g.getTransform();
    const sx = (v: number): number => (Math.round(v * tr.a + tr.e) - tr.e) / tr.a;
    const sy = (v: number): number => (Math.round(v * tr.d + tr.f) - tr.f) / tr.d;
    const smooth = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = true;
    const put = (name: string, tx: number, ty: number): void => {
      const idx = rk.tile[name];
      if (idx === undefined) return;
      const [ax, ay] = rk.tileAt(idx);
      const x0 = sx(tx * TILE);
      const y0 = sy(ty * TILE);
      g.drawImage(rk.tiles, ax, ay, rk.T, rk.T, x0, y0, sx((tx + 1) * TILE) - x0, sy((ty + 1) * TILE) - y0);
    };
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const name = this.water.get(ty * m.w + tx);
        if (name) put(name + suffix, tx, ty);
      }
    }
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const name = this.bridges.get(ty * m.w + tx);
        if (name) put(name, tx, ty);
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
    const each = (fn: (tx: number, ty: number, x: number, y: number) => void): void => {
      for (let ty = ty0; ty < ty0 + CHUNK; ty++) for (let tx = tx0; tx < tx0 + CHUNK; tx++) if (tx < this.map.w && ty < this.map.h) fn(tx, ty, (tx - tx0) * T, (ty - ty0) * T);
    };
    each((tx, ty, x, y) => this.paintTile(g, tx, ty, x, y));
    // castle walls and cliffs over everything flat
    each((tx, ty, x, y) => {
      const k = this.map.kind[ty * this.map.w + tx];
      if (k === K.Rampart) this.paintWall(g, tx, ty, x, y, 'wall', this.face);
      else if (k === K.Wall && this.cliff) this.paintWall(g, tx, ty, x, y, 'cliff', this.cliff);
    });
    const x0 = cx * CA;
    const y0 = cy * CA;
    for (const dc of this.decals) {
      // the story's decals are made at 32 px per tile: drawn at twice their size
      const x = dc.x * 2 - x0;
      const y = dc.y * 2 - y0;
      if (x < CA && y < CA && x + dc.c.width * 2 > 0 && y + dc.c.height * 2 > 0) g.drawImage(dc.c, x, y, dc.c.width * 2, dc.c.height * 2);
    }
    this.cache.set(k, c);
    while (this.cache.size > KEEP) this.cache.delete(this.cache.keys().next().value!);
    return c;
  }

  private put(g: CanvasRenderingContext2D, name: string, x: number, y: number): boolean {
    const idx = this.rk.tile[name];
    if (idx === undefined) return false;
    const [sx, sy] = this.rk.tileAt(idx);
    g.drawImage(this.rk.tiles, sx, sy, this.rk.T, this.rk.T, x, y, T, T);
    return true;
  }

  /** A ground set's tile for where (tx, ty) sits in its patch: an edge, or a whole tile (with its variants). */
  private putSet(g: CanvasRenderingContext2D, set: string, tx: number, ty: number, x: number, y: number, same: (nx: number, ny: number) => boolean): void {
    const m = this.map;
    const mask = maskOf((dx, dy) => {
      const nx = tx + dx;
      const ny = ty + dy;
      return nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || same(nx, ny);
    });
    if (mask === '11111111') {
      this.putWhole(g, set, tx, ty, x, y);
      return;
    }
    this.put(g, `${set}_${mask}`, x, y);
  }

  /** A whole tile of a set: plain now and then, its variants between. */
  private putWhole(g: CanvasRenderingContext2D, set: string, tx: number, ty: number, x: number, y: number): void {
    const h = hash2(tx, ty, 333);
    if (set === 'grass') {
      // mostly the plain grasses, now and then one with a flower or a pebble in it
      const n = h < 0.78 ? Math.floor((h / 0.78) * 8) : 8 + Math.floor(((h - 0.78) / 0.22) * 8);
      this.put(g, `grass_${n}`, x, y);
      return;
    }
    // its variants (four or five) half the time, where the set has them
    if (h < 0.5 && this.put(g, `${set}_c${1 + Math.floor((h / 0.5) * 5)}`, x, y)) return;
    this.put(g, `${set}_11111111`, x, y);
  }

  private paintTile(g: CanvasRenderingContext2D, tx: number, ty: number, x: number, y: number): void {
    const m = this.map;
    const i = ty * m.w + tx;
    const gr = this.r.ground;
    this.putWhole(g, gr.base, tx, ty, x, y);
    gr.patches.forEach((p, j) => {
      const layer = this.patches[j]!;
      if (layer[i] && p.set !== gr.base) this.putSet(g, p.set, tx, ty, x, y, (nx, ny) => layer[ny * m.w + nx] === 1);
    });
    // the woods' floor (under a cliff's top the land's own ground: the rock's foot is scree)
    const underAt = (j: number): boolean => this.under[j] === 1 && !(this.cliff && m.kind[j] === K.Wall);
    if (underAt(i) && gr.under !== gr.base) this.putSet(g, gr.under, tx, ty, x, y, (nx, ny) => underAt(ny * m.w + nx));
    const lie = this.lie[i];
    const lieAt = (nx: number, ny: number): number => this.lie[ny * m.w + nx]!;
    if (lie === K.Sand) this.putSet(g, gr.sand, tx, ty, x, y, (nx, ny) => lieAt(nx, ny) === K.Sand);
    if (lie === K.Path) this.putSet(g, gr.path, tx, ty, x, y, (nx, ny) => lieAt(nx, ny) === K.Path || lieAt(nx, ny) === K.Cobble);
    if (lie === K.Cobble) this.putSet(g, gr.cobble, tx, ty, x, y, (nx, ny) => lieAt(nx, ny) === K.Cobble);
    if (this.field[i]) this.putSet(g, gr.field, tx, ty, x, y, (nx, ny) => this.field[ny * m.w + nx] === 1);
    // the small things in the grass (and a pebble on a road, moss between the cobbles)
    const k = m.kind[i]!;
    const h = hash2(tx, ty, 341);
    if (k === K.Water || k === K.Bridge || k === K.Rampart) return;
    if (lie === K.Cobble) {
      if (h < 0.05) this.put(g, h < 0.025 ? 'decal_moss_1' : 'decal_crack_2', x, y);
    } else if (lie === K.Path) {
      if (h < 0.06) this.put(g, h < 0.03 ? 'decal_pebbles_2' : 'decal_worn_2', x, y);
    } else if (!this.field[i] && gr.decals.length) {
      // decals gather where a slow noise says, like the plants they are
      const rate = (gr.decalRate / 100) * (0.5 + noise2(tx / 6, ty / 6, 347) * 1.2);
      if (h < rate) this.put(g, gr.decals[Math.floor(hash2(tx, ty, 349) * gr.decals.length)]!, x, y);
    }
  }

  /**
   * A castle wall (`wall`: Royal Keep's wall top and face) or a cliff (`cliff`: the rock's grassy top ringed by
   * its ledge, and its rock face): the top auto-tiles, the face hangs on the southern rows inside the block.
   */
  private paintWall(g: CanvasRenderingContext2D, tx: number, ty: number, x: number, y: number, set: 'wall' | 'cliff', faceOf: Uint8Array): void {
    const m = this.map;
    const i = ty * m.w + tx;
    const kind = m.kind[i]!;
    const kindAt = (nx: number, ny: number): number => (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h ? -1 : m.kind[ny * m.w + nx]!);
    const face = faceOf[i]!;
    const top = set === 'wall' ? 'wall' : 'ledge';
    if (!face) {
      const mask = maskOf((dx, dy) => {
        const k = kindAt(tx + dx, ty + dy);
        return k === -1 || (k === kind && !faceOf[(ty + dy) * m.w + tx + dx]);
      });
      if (!this.put(g, `${top}_${mask}`, x, y)) this.put(g, `${top}_11111111`, x, y);
      return;
    }
    const left = kindAt(tx - 1, ty);
    const right = kindAt(tx + 1, ty);
    const l = left !== kind && left !== -1;
    const r = right !== kind && right !== -1;
    const col = l && r ? 'lr' : l ? 'l' : r ? 'r' : 'm';
    const row = faceRow(faceOf, m.w, i);
    // the long runs get the pack's variants: a second (and third) stone pattern, a crack, moss
    const h = hash2(tx, ty, 351);
    const v =
      col !== 'm'
        ? ''
        : set === 'wall'
          ? row !== 'tb' && h < 0.1
            ? row === 'b'
              ? '_moss'
              : '_crack'
            : row !== 'tb' && h < 0.3
              ? '_2'
              : ''
          : h < 0.08 && row === 'm'
            ? '_moss'
            : h < 0.4
              ? '_2'
              : h < 0.65
                ? '_3'
                : '';
    if (!this.put(g, `${set}_${row}_${col}${v}`, x, y) && !this.put(g, `${set}_${row}_${col}`, x, y)) this.put(g, `${set}_${row}_m`, x, y);
  }

}
