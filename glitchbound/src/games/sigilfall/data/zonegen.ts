import { clamp, hash2, noise2, rng } from '../core/math';
import type { Marker, PlacedMarkerDef, RegionDef, RegionId } from './types';

/*
 * The wilds are generated, not drawn: a zone is a seeded description (its size, how wooded it is, its
 * water, its towns, its sights and its ways out) that this turns into the same tile map and markers a
 * hand-laid region has. The same spec always makes the same map, so a zone never changes under a
 * player, and a big world costs a few hundred lines of description instead of thousands of map rows.
 *
 * Steps: border and woods from noise, water (lakes, a river or the sea), clearings for towns and
 * sights, roads joining them (a spanning tree, meandering, bridged over water), the towns and sights
 * themselves, scattered trees and rocks, beaches, packs of enemies in the open (their level rising
 * with distance from the way in), and finally a pass that connects anything cut off.
 */

export type Side = 'n' | 's' | 'e' | 'w';
export type PoiKind = 'camp' | 'den' | 'ruin' | 'farm' | 'nest' | 'wreck' | 'grove' | 'cave';

export interface HubSpec {
  /** Where, as fractions of the map. */
  at: [number, number];
  npcs: string[];
  houses: number;
}

export interface ExitSpec {
  side: Side;
  /** Where along that side (0-1). */
  at: number;
  to: RegionId;
  label: string;
  minLevel?: number;
}

export interface PoiSpec {
  at: [number, number];
  /** Radius of the clearing, in tiles. */
  r: number;
  kind: PoiKind;
  /** Packs in it (each a list of enemy ids). */
  packs: string[][];
  /** Their level (otherwise from where the sight is). */
  level?: number;
  /** The first pack is led by an elite. */
  elite?: boolean;
  /** A named enemy in the middle that comes back slowly when killed. */
  rare?: string;
  /** Discovering it counts for explore objectives. */
  spot?: { id: string; name: string };
  chest?: 'common' | 'rare' | 'epic';
  /** A way down: a dungeon's door. */
  entrance?: { to: RegionId; label: string; minLevel?: number };
}

export interface ZoneSpec {
  w: number;
  h: number;
  seed: number;
  /** Enemy levels at `from` and at the farthest point; packs in between scale along. */
  levels: [number, number];
  from: [number, number];
  /** 0-1: how much of the land is woods. */
  forest: number;
  /** Per 100 open tiles. */
  scatter: { trees: number; bushes: number; rocks: number; flowers: number };
  water?: { kind: 'lakes'; amount: number } | { kind: 'river'; from: Side; to: Side } | { kind: 'sea'; side: Side; depth: number };
  /** Sand along the water; 'dunes' adds drifts inland; 'all' is desert. */
  sand?: 'shore' | 'dunes' | 'all';
  hubs: HubSpec[];
  exits: ExitSpec[];
  pois: PoiSpec[];
  /** Packs in the open: compositions by stretch of the level gradient (0 near `from`, 1 far). */
  wild: { band: [number, number]; packs: string[][] }[];
  /** How many packs in the open. */
  wildCount: number;
}

export interface GeneratedZone {
  map: string[];
  placed: PlacedMarkerDef[];
}

/* Tile letters (see regions.ts). */
const WALL = 35; // '#'
const FLOOR = 46; // '.'
const DECO = 44; // ','
const PATH = 61; // '='
const COBBLE = 58; // ':'
const WATER = 126; // '~'
const BRIDGE = 98; // 'b'
const TREE = 84; // 'T'
const BUSH = 116; // 't'
const ROCK = 114; // 'r'
const FENCE = 102; // 'f'
const HOUSE = 104; // 'h'
const HOUSE_ANCHOR = 72; // 'H'
const PILLAR = 106; // 'j'
const SAND = 115; // 's'

const WALKABLE = new Set([FLOOR, DECO, PATH, COBBLE, BRIDGE, SAND]);
const OPEN = new Set([FLOOR, DECO, SAND]);

/** Two octaves of value noise, 0..1. */
const fbm = (x: number, y: number, seed: number): number => noise2(x, y, seed) * 0.7 + noise2(x * 2.3, y * 2.3, seed + 1) * 0.3;

export function generateZone(spec: ZoneSpec): GeneratedZone {
  return new ZoneBuilder(spec).build();
}

class ZoneBuilder {
  private readonly w: number;
  private readonly h: number;
  private readonly g: Uint8Array;
  /** Reserved tiles (roads, towns, clearings): nothing is scattered on them. */
  private readonly lock: Uint8Array;
  private readonly placed: PlacedMarkerDef[] = [];
  private readonly r: () => number;
  /** Tiles markers stand on (they count as walkable). */
  private readonly marked = new Set<number>();
  private readonly packSpots: [number, number][] = [];

  constructor(private readonly spec: ZoneSpec) {
    this.w = spec.w;
    this.h = spec.h;
    this.g = new Uint8Array(spec.w * spec.h).fill(FLOOR);
    this.lock = new Uint8Array(spec.w * spec.h);
    this.r = rng(spec.seed);
  }

  build(): GeneratedZone {
    const s = this.spec;
    this.border();
    this.water();
    this.woods();
    const hubs = s.hubs.map((hb) => this.tileOf(hb.at));
    const pois = s.pois.map((p) => this.tileOf(p.at));
    const exits = s.exits.map((e) => this.exitTiles(e));
    // clearings first, so roads and buildings have room
    hubs.forEach(([x, y]) => this.clear(x, y, 12));
    pois.forEach(([x, y], i) => this.clear(x, y, s.pois[i]!.r));
    exits.forEach((e) => this.corridor(e.edge, e.inner));
    // roads reach the towns, the ways out and every sight (trails to the wilder ones)
    this.roads([...hubs, ...exits.map((e) => e.inner), ...pois]);
    s.hubs.forEach((hb, i) => this.town(hubs[i]![0], hubs[i]![1], hb));
    s.pois.forEach((p, i) => this.sight(pois[i]![0], pois[i]![1], p));
    s.exits.forEach((e, i) => this.put(exits[i]!.edge[0], exits[i]!.edge[1], { kind: 'exit', to: e.to, label: e.label, ...(e.minLevel ? { minLevel: e.minLevel } : {}) }));
    this.scatter();
    this.beaches();
    const start = hubs[0] ?? exits[0]!.inner;
    this.put(start[0], start[1] + 3, { kind: 'start' });
    this.wildPacks(hubs, exits.map((e) => e.inner));
    this.connect(start);
    const map: string[] = [];
    for (let y = 0; y < this.h; y++) map.push(String.fromCharCode(...this.g.subarray(y * this.w, (y + 1) * this.w)));
    return { map, placed: this.placed };
  }

  /* --------------------------------------------------------------- helpers */

  private idx(x: number, y: number): number {
    return y * this.w + x;
  }

  private inside(x: number, y: number, m = 0): boolean {
    return x >= m && y >= m && x < this.w - m && y < this.h - m;
  }

  private at(x: number, y: number): number {
    return this.inside(x, y) ? this.g[this.idx(x, y)]! : WALL;
  }

  private set(x: number, y: number, c: number): void {
    if (this.inside(x, y, 1)) this.g[this.idx(x, y)] = c;
  }

  private tileOf(at: [number, number]): [number, number] {
    return [Math.round(clamp(at[0], 0.04, 0.96) * (this.w - 1)), Math.round(clamp(at[1], 0.04, 0.96) * (this.h - 1))];
  }

  private put(x: number, y: number, marker: Marker): void {
    this.placed.push({ tx: x, ty: y, marker });
    this.marked.add(this.idx(x, y));
  }

  /** Level of a pack at a tile: rising from `from` to the farthest corner. */
  private levelAt(x: number, y: number): number {
    const [fx, fy] = this.tileOf(this.spec.from);
    const far = Math.max(...[0, this.w - 1].flatMap((cx) => [0, this.h - 1].map((cy) => Math.hypot(cx - fx, cy - fy))));
    const t = clamp(Math.hypot(x - fx, y - fy) / (far * 0.85), 0, 1);
    const [lo, hi] = this.spec.levels;
    return Math.round(lo + (hi - lo) * t);
  }

  private gradient(x: number, y: number): number {
    const [lo, hi] = this.spec.levels;
    return hi === lo ? 0 : (this.levelAt(x, y) - lo) / (hi - lo);
  }

  /** Clears a disc to open ground and reserves it. */
  private clear(cx: number, cy: number, r: number): void {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!this.inside(x, y, 2)) continue;
        // a ragged edge, so clearings don't look stamped
        const d = Math.hypot(x - cx, y - cy) + (hash2(x, y, this.spec.seed + 3) - 0.5) * 1.6;
        if (d > r) continue;
        const i = this.idx(x, y);
        if (this.g[i] !== WATER || d < r - 2) this.g[i] = FLOOR;
        this.lock[i] = 1;
      }
    }
  }

  /* ---------------------------------------------------------------- terrain */

  private border(): void {
    const sea = this.spec.water?.kind === 'sea' ? this.spec.water.side : null;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const d: Record<Side, number> = { w: x, e: this.w - 1 - x, n: y, s: this.h - 1 - y };
        const thick = 2 + fbm(x / 7, y / 7, this.spec.seed + 11) * 5;
        for (const side of ['n', 's', 'e', 'w'] as Side[]) {
          if (d[side] >= thick) continue;
          // the sea side is open water to the edge instead
          this.g[this.idx(x, y)] = side === sea ? WATER : WALL;
        }
      }
    }
  }

  private water(): void {
    const wt = this.spec.water;
    if (!wt) return;
    const seed = this.spec.seed + 21;
    if (wt.kind === 'sea') {
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          const along = wt.side === 'n' || wt.side === 's' ? x : y;
          const depth = wt.side === 'w' ? x : wt.side === 'e' ? this.w - 1 - x : wt.side === 'n' ? y : this.h - 1 - y;
          const size = wt.side === 'n' || wt.side === 's' ? this.h : this.w;
          const coast = size * wt.depth + (fbm(along / 16, 0.5, seed) - 0.5) * 26 + (noise2(along / 5, 3.3, seed + 1) - 0.5) * 5;
          if (depth < coast) this.g[this.idx(x, y)] = WATER;
        }
      }
    } else if (wt.kind === 'lakes') {
      for (let y = 3; y < this.h - 3; y++) {
        for (let x = 3; x < this.w - 3; x++) {
          if (fbm(x / 13, y / 13, seed) > 1 - wt.amount * 0.55) this.g[this.idx(x, y)] = WATER;
        }
      }
    } else {
      const a = this.sidePoint(wt.from, 0.3 + this.r() * 0.4);
      const b = this.sidePoint(wt.to, 0.3 + this.r() * 0.4);
      for (const [x, y] of this.meander(a, b, 0.22)) {
        const width = 1.3 + noise2(x / 9, y / 9, seed) * 1.4;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.hypot(dx, dy) <= width) this.set(x + dx, y + dy, WATER);
      }
    }
  }

  private sidePoint(side: Side, t: number): [number, number] {
    const x = side === 'w' ? 0 : side === 'e' ? this.w - 1 : Math.round(t * (this.w - 1));
    const y = side === 'n' ? 0 : side === 's' ? this.h - 1 : Math.round(t * (this.h - 1));
    return [x, y];
  }

  /** Woods: the densest parts are canopy you can't enter, ringed by single trees. */
  private woods(): void {
    const f = this.spec.forest;
    if (f <= 0) return;
    const seed = this.spec.seed + 31;
    const n = new Float32Array(this.w * this.h);
    const vals: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const v = fbm(x / 15, y / 15, seed);
        n[this.idx(x, y)] = v;
        if (this.g[this.idx(x, y)] === FLOOR) vals.push(v);
      }
    }
    vals.sort((a, b) => a - b);
    const thr = vals[Math.floor(vals.length * (1 - f))] ?? 1;
    for (let i = 0; i < n.length; i++) {
      if (this.g[i] !== FLOOR) continue;
      const v = n[i]!;
      if (v > thr + 0.035) this.g[i] = WALL;
      else if (v > thr) this.g[i] = hash2(i, 7, seed) < 0.7 ? TREE : BUSH;
    }
  }

  /** A wandering line of tiles from a to b. */
  private meander(a: [number, number], b: [number, number], wiggle: number): [number, number][] {
    let pts: [number, number][] = [a, b];
    for (let depth = 0; depth < 4; depth++) {
      const next: [number, number][] = [pts[0]!];
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1]!;
        const [x1, y1] = pts[i]!;
        const len = Math.hypot(x1 - x0, y1 - y0);
        const off = (this.r() - 0.5) * len * wiggle;
        next.push([(x0 + x1) / 2 + (-(y1 - y0) / (len || 1)) * off, (y0 + y1) / 2 + ((x1 - x0) / (len || 1)) * off], pts[i]!);
      }
      pts = next;
    }
    const out: [number, number][] = [];
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]!;
      const [x1, y1] = pts[i]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let k = 0; k <= steps; k++) {
        const x = Math.round(x0 + ((x1 - x0) * k) / steps);
        const y = Math.round(y0 + ((y1 - y0) * k) / steps);
        const last = out[out.length - 1];
        if (!last || last[0] !== x || last[1] !== y) out.push([x, y]);
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ roads */

  private exitTiles(e: ExitSpec): { edge: [number, number]; inner: [number, number] } {
    const edge = this.sidePoint(e.side, clamp(e.at, 0.08, 0.92));
    const [dx, dy] = e.side === 'w' ? [1, 0] : e.side === 'e' ? [-1, 0] : e.side === 'n' ? [0, 1] : [0, -1];
    return { edge, inner: [edge[0] + dx * 10, edge[1] + dy * 10] };
  }

  /** A three-wide gap through the border from the edge to the inner point. */
  private corridor(edge: [number, number], inner: [number, number]): void {
    const steps = Math.max(Math.abs(inner[0] - edge[0]), Math.abs(inner[1] - edge[1]));
    for (let k = 0; k <= steps; k++) {
      const x = Math.round(edge[0] + ((inner[0] - edge[0]) * k) / steps);
      const y = Math.round(edge[1] + ((inner[1] - edge[1]) * k) / steps);
      for (let d = -2; d <= 2; d++) {
        const tx = edge[0] === inner[0] ? x + d : x;
        const ty = edge[1] === inner[1] ? y + d : y;
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
        const i = this.idx(tx, ty);
        this.g[i] = Math.abs(d) <= 1 ? PATH : FLOOR;
        this.lock[i] = 1;
      }
    }
  }

  /** Roads join every node: a minimum spanning tree, each edge a meandering two-wide road. */
  private roads(nodes: [number, number][]): void {
    if (nodes.length < 2) return;
    const inTree = [0];
    const rest = nodes.map((_, i) => i).slice(1);
    while (rest.length) {
      let best = [-1, -1, Infinity];
      for (const a of inTree) {
        for (const b of rest) {
          const d = Math.hypot(nodes[a]![0] - nodes[b]![0], nodes[a]![1] - nodes[b]![1]);
          if (d < best[2]!) best = [a, b, d];
        }
      }
      const [a, b] = best as [number, number, number];
      this.road(nodes[a]!, nodes[b]!);
      inTree.push(b);
      rest.splice(rest.indexOf(b), 1);
    }
  }

  private road(a: [number, number], b: [number, number]): void {
    for (const [x, y] of this.meander(a, b, 0.18)) {
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ] as const) {
        const tx = x + dx;
        const ty = y + dy;
        if (!this.inside(tx, ty, 2)) continue;
        const i = this.idx(tx, ty);
        const here = this.g[i]!;
        if (here === COBBLE || here === HOUSE || here === HOUSE_ANCHOR) continue;
        this.g[i] = here === WATER || here === BRIDGE ? BRIDGE : PATH;
        this.lock[i] = 1;
      }
      // the road's shoulders are cleared of trees
      for (let dy = -1; dy <= 2; dy++) {
        for (let dx = -1; dx <= 2; dx++) {
          const tx = x + dx;
          const ty = y + dy;
          if (!this.inside(tx, ty, 2)) continue;
          const i = this.idx(tx, ty);
          const c = this.g[i]!;
          if (c === WALL || c === TREE || c === BUSH || c === ROCK) this.g[i] = FLOOR;
        }
      }
    }
  }

  /* ------------------------------------------------------------ towns, sights */

  private town(cx: number, cy: number, hub: HubSpec): void {
    // a cobbled square with the waystone in the middle
    for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 6; x <= cx + 6; x++) if (Math.hypot((x - cx) * 0.85, y - cy) <= 5.2) this.set(x, y, COBBLE);
    this.put(cx, cy - 1, { kind: 'waystone' });
    // the townsfolk stand around the square
    hub.npcs.forEach((npc, i) => {
      const a = -Math.PI / 2 + Math.PI * 0.35 + (i * Math.PI * 1.3) / Math.max(1, hub.npcs.length - 1 || 1);
      const x = Math.round(cx + Math.cos(a) * 4.5);
      const y = Math.round(cy + 1 + Math.sin(a) * 3.2);
      this.put(x, y, { kind: 'npc', npc });
    });
    // houses on a ring around it, where they fit
    let built = 0;
    for (const rad of [9, 11, 13]) {
      for (let k = 0; k < 20 && built < hub.houses; k++) {
        const a = (k / 20) * Math.PI * 2 + rad * 0.37;
        const hx = Math.round(cx + Math.cos(a) * rad * 1.15) - 2;
        const hy = Math.round(cy + Math.sin(a) * rad * 0.8) - 1;
        if (this.house(hx, hy)) built++;
      }
    }
    // lamps and goods
    for (const [dx, dy, prop, solid] of [
      [-6, -3, 'lamp', true],
      [6, -3, 'lamp', true],
      [-6, 3, 'crate', true],
      [7, 3, 'barrel', true],
    ] as const) {
      const x = cx + dx;
      const y = cy + dy;
      if (this.at(x, y) !== WATER && !this.marked.has(this.idx(x, y))) this.put(x, y, { kind: 'prop', prop, solid });
    }
  }

  /** A 4×3 house (with a free tile around it), if the ground allows. */
  private house(x0: number, y0: number): boolean {
    for (let y = y0 - 1; y <= y0 + 3; y++) {
      for (let x = x0 - 1; x <= x0 + 4; x++) {
        const c = this.at(x, y);
        if (!this.inside(x, y, 3) || c === PATH || c === COBBLE || c === WATER || c === BRIDGE || c === HOUSE || c === HOUSE_ANCHOR || this.marked.has(this.idx(x, y))) return false;
      }
    }
    for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 4; x++) this.set(x, y, y === y0 + 2 && x === x0 ? HOUSE_ANCHOR : HOUSE);
    return true;
  }

  private sight(cx: number, cy: number, p: PoiSpec): void {
    const r = p.r;
    const seed = this.spec.seed + cx * 31 + cy;
    const ring = (n: number, rad: number, fn: (x: number, y: number, k: number) => void): void => {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + hash2(k, seed, 5) * 0.6;
        fn(Math.round(cx + Math.cos(a) * rad), Math.round(cy + Math.sin(a) * rad * 0.8), k);
      }
    };
    const free = (x: number, y: number): boolean => OPEN.has(this.at(x, y)) && !this.marked.has(this.idx(x, y));
    switch (p.kind) {
      case 'camp':
        if (free(cx, cy)) this.put(cx, cy, { kind: 'prop', prop: 'campfire', solid: true });
        ring(3, r * 0.55, (x, y) => free(x, y) && this.put(x, y, { kind: 'prop', prop: 'tent', solid: true }));
        ring(4, r * 0.8, (x, y, k) => free(x, y) && this.put(x, y, { kind: 'prop', prop: k % 2 ? 'crate' : 'barrel', solid: true }));
        break;
      case 'den':
        ring(Math.round(r * 2.2), r - 0.5, (x, y, k) => k % 3 !== 0 && free(x, y) && this.set(x, y, ROCK));
        ring(4, r * 0.4, (x, y) => free(x, y) && this.put(x, y, { kind: 'prop', prop: 'bones' }));
        break;
      case 'ruin':
        ring(Math.round(r * 1.6), r * 0.7, (x, y, k) => free(x, y) && this.set(x, y, k % 3 === 0 ? ROCK : PILLAR));
        for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 3; x <= cx + 3; x++) if (free(x, y) && hash2(x, y, seed) < 0.7) this.set(x, y, COBBLE);
        break;
      case 'farm': {
        // a fenced field of crops with a gate toward the middle of the map
        const fw = Math.max(4, r - 2);
        const fh = Math.max(3, r - 4);
        for (let y = cy - fh; y <= cy + fh; y++) {
          for (let x = cx - fw; x <= cx + fw; x++) {
            if (!free(x, y)) continue;
            const edge = y === cy - fh || y === cy + fh || x === cx - fw || x === cx + fw;
            const gate = (y === cy + fh && Math.abs(x - cx) <= 1) || (x === cx - fw && Math.abs(y - cy) <= 1);
            this.set(x, y, edge ? (gate ? FLOOR : FENCE) : DECO);
          }
        }
        this.house(cx + fw + 2, cy - 2);
        break;
      }
      case 'nest':
        ring(Math.round(r * 2), r - 1, (x, y, k) => k % 2 === 0 && free(x, y) && this.set(x, y, k % 4 ? BUSH : ROCK));
        ring(3, r * 0.3, (x, y) => free(x, y) && this.put(x, y, { kind: 'prop', prop: 'eggs' }));
        break;
      case 'wreck':
        if (free(cx, cy)) this.put(cx, cy, { kind: 'prop', prop: 'wreck', solid: true });
        ring(5, r * 0.7, (x, y, k) => free(x, y) && this.put(x, y, { kind: 'prop', prop: k % 2 ? 'crate' : 'barrel', solid: true }));
        break;
      case 'grove':
        for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (free(x, y) && Math.hypot(x - cx, y - cy) < r - 1 && hash2(x, y, seed) < 0.45) this.set(x, y, DECO);
        ring(Math.round(r * 1.5), r - 0.5, (x, y, k) => k % 2 === 0 && free(x, y) && this.set(x, y, TREE));
        break;
      case 'cave':
        ring(Math.round(r * 2.6), r - 0.5, (x, y, k) => k % 4 !== 0 && free(x, y) && this.set(x, y, ROCK));
        break;
    }
    if (p.entrance) this.put(cx, cy, { kind: 'exit', to: p.entrance.to, label: p.entrance.label, ...(p.entrance.minLevel ? { minLevel: p.entrance.minLevel } : {}) });
    if (p.spot) this.put(cx, cy + (p.entrance ? 2 : 0), { kind: 'spot', id: p.spot.id, name: p.spot.name, r: Math.max(4, r - 1) });
    if (p.chest) {
      const [x, y] = this.near(cx + 2, cy - 2);
      this.put(x, y, { kind: 'chest', id: `poi-${cx}-${cy}`, tier: p.chest });
    }
    const level = p.level ?? this.levelAt(cx, cy);
    p.packs.forEach((enemies, k) => {
      const a = (k / Math.max(1, p.packs.length)) * Math.PI * 2 + 0.7;
      const [x, y] = this.near(Math.round(cx + Math.cos(a) * r * 0.5), Math.round(cy + Math.sin(a) * r * 0.45));
      this.put(x, y, { kind: 'pack', enemies, level, ...(p.elite && k === 0 ? { elite: true } : {}) });
      this.packSpots.push([x, y]);
    });
    if (p.rare) {
      const [x, y] = this.near(cx, cy + 1);
      this.put(x, y, { kind: 'pack', enemies: [p.rare], level: level + 1, rare: true });
      this.packSpots.push([x, y]);
    }
  }

  /** The nearest free open tile to (x, y). */
  private near(x: number, y: number): [number, number] {
    for (let rad = 0; rad < 8; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
          const tx = x + dx;
          const ty = y + dy;
          if (this.inside(tx, ty, 2) && WALKABLE.has(this.at(tx, ty)) && !this.marked.has(this.idx(tx, ty))) return [tx, ty];
        }
      }
    }
    this.set(x, y, FLOOR);
    return [x, y];
  }

  /* ----------------------------------------------------------- the open land */

  private scatter(): void {
    const sc = this.spec.scatter;
    const seed = this.spec.seed + 41;
    for (let y = 2; y < this.h - 2; y++) {
      for (let x = 2; x < this.w - 2; x++) {
        const i = this.idx(x, y);
        if (this.g[i] !== FLOOR || this.lock[i] || this.marked.has(i)) continue;
        const h = hash2(x, y, seed) * 100;
        // flowers and ferns come in patches
        if (h < sc.trees) this.g[i] = TREE;
        else if (h < sc.trees + sc.bushes) this.g[i] = BUSH;
        else if (h < sc.trees + sc.bushes + sc.rocks) this.g[i] = ROCK;
        else if (noise2(x / 5, y / 5, seed) > 1 - sc.flowers / 40) this.g[i] = DECO;
      }
    }
  }

  /** Sand along the water (or everywhere, for deserts). */
  private beaches(): void {
    const mode = this.spec.sand;
    if (!mode) return;
    const seed = this.spec.seed + 51;
    for (let y = 1; y < this.h - 1; y++) {
      for (let x = 1; x < this.w - 1; x++) {
        const i = this.idx(x, y);
        if (this.g[i] !== FLOOR && this.g[i] !== DECO) continue;
        if (mode === 'all') {
          this.g[i] = SAND;
          continue;
        }
        if (mode === 'dunes' && fbm(x / 9, y / 9, seed + 7) > 0.66) {
          this.g[i] = SAND;
          continue;
        }
        const reach = 2 + Math.floor(noise2(x / 6, y / 6, seed) * (mode === 'dunes' ? 7 : 4));
        let shore = false;
        for (let dy = -reach; dy <= reach && !shore; dy++) for (let dx = -reach; dx <= reach && !shore; dx++) if (this.at(x + dx, y + dy) === WATER && Math.hypot(dx, dy) <= reach) shore = true;
        if (shore) this.g[i] = SAND;
      }
    }
  }

  private wildPacks(hubs: [number, number][], ways: [number, number][]): void {
    const s = this.spec;
    let made = 0;
    for (let tries = 0; tries < s.wildCount * 60 && made < s.wildCount; tries++) {
      const x = 3 + Math.floor(this.r() * (this.w - 6));
      const y = 3 + Math.floor(this.r() * (this.h - 6));
      const i = this.idx(x, y);
      if (!OPEN.has(this.g[i]!) || this.marked.has(i)) continue;
      if (hubs.some(([hx, hy]) => Math.hypot(hx - x, hy - y) < 18)) continue;
      if (ways.some(([ex, ey]) => Math.hypot(ex - x, ey - y) < 9)) continue;
      if (this.packSpots.some(([px, py]) => Math.hypot(px - x, py - y) < 9)) continue;
      const t = this.gradient(x, y);
      const bands = s.wild.filter((b) => t >= b.band[0] - 0.05 && t <= b.band[1] + 0.05);
      const band = bands.length ? bands[Math.floor(this.r() * bands.length)]! : s.wild[0]!;
      const enemies = band.packs[Math.floor(this.r() * band.packs.length)]!;
      this.put(x, y, { kind: 'pack', enemies, level: this.levelAt(x, y), ...(this.r() < 0.06 ? { elite: true } : {}) });
      this.packSpots.push([x, y]);
      made++;
    }
  }

  /**
   * Everything a player should reach is reached: markers cut off by woods or water get a path to the
   * nearest reached ground, and open pockets nobody can get into are filled in.
   */
  private connect(start: [number, number]): void {
    const walk = (i: number): boolean => WALKABLE.has(this.g[i]!) || this.marked.has(i);
    const flood = (): Uint8Array => {
      const seen = new Uint8Array(this.w * this.h);
      const q = [this.idx(start[0], start[1])];
      seen[q[0]!] = 1;
      while (q.length) {
        const i = q.pop()!;
        const x = i % this.w;
        const y = (i - x) / this.w;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (!this.inside(nx, ny)) continue;
          const j = this.idx(nx, ny);
          if (seen[j] || !walk(j)) continue;
          seen[j] = 1;
          q.push(j);
        }
      }
      return seen;
    };
    let seen = flood();
    for (const m of this.placed) {
      const i = this.idx(m.tx, m.ty);
      if (seen[i]) continue;
      // walk toward the start until we meet reached ground, clearing as we go
      let x = m.tx;
      let y = m.ty;
      for (let guard = 0; guard < this.w + this.h && !seen[this.idx(x, y)]; guard++) {
        const c = this.g[this.idx(x, y)]!;
        if (!walk(this.idx(x, y))) this.g[this.idx(x, y)] = c === WATER ? BRIDGE : FLOOR;
        if (Math.abs(start[0] - x) > Math.abs(start[1] - y)) x += Math.sign(start[0] - x);
        else y += Math.sign(start[1] - y);
      }
      seen = flood();
    }
    for (let i = 0; i < seen.length; i++) if (!seen[i] && WALKABLE.has(this.g[i]!)) this.g[i] = this.g[i] === BRIDGE ? WATER : WALL;
  }
}

/** A wild region whose map is generated the first time something looks at it. */
export function wildRegion(base: Omit<RegionDef, 'kind' | 'map' | 'markers' | 'placed' | 'encounters' | 'level'>, spec: ZoneSpec): RegionDef {
  let made: GeneratedZone | null = null;
  const get = (): GeneratedZone => (made ??= generateZone(spec));
  return {
    ...base,
    kind: 'wild',
    level: spec.levels[0],
    markers: {},
    encounters: [],
    holds: {
      exits: [...spec.exits.map((e) => e.to), ...spec.pois.flatMap((p) => (p.entrance ? [p.entrance.to] : []))],
      npcs: spec.hubs.flatMap((h) => h.npcs),
      spots: spec.pois.flatMap((p) => (p.spot ? [p.spot.id] : [])),
    },
    get map() {
      return get().map;
    },
    get placed() {
      return get().placed;
    },
  };
}
