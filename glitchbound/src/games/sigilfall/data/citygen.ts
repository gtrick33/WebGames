import { hash2, noise2 } from '../core/math';
import type { Marker, PlacedMarkerDef, RegionId, StoryCond } from './types';

/*
 * Cities are laid out by a short script rather than drawn letter by letter: walls with gates and the
 * roads out through them, avenues and squares, buildings with their keepers at the door, parks and
 * ponds, lamps and market stalls. The result is the same tile map and markers as any region.
 * Coordinates are tiles; rectangles are inclusive.
 */

type Style = Extract<Marker, { kind: 'building' }>['style'];

const C = {
  wall: 35, // '#' woods outside the walls
  floor: 46, // '.'
  deco: 44, // ','
  path: 61, // '='
  cobble: 58, // ':'
  water: 126, // '~'
  bridge: 98, // 'b'
  tree: 84, // 'T'
  bush: 116, // 't'
  rock: 114, // 'r'
  fence: 102, // 'f'
  house: 104, // 'h'
  rampart: 124, // '|'
  brazier: 81, // 'Q' (a fire in an iron bowl, burning)
} as const;

export class CityPlan {
  readonly g: Uint8Array;
  readonly placed: PlacedMarkerDef[] = [];
  private readonly taken = new Set<number>();

  constructor(
    readonly w: number,
    readonly h: number,
    readonly seed: number,
  ) {
    this.g = new Uint8Array(w * h).fill(C.floor);
  }

  private i(x: number, y: number): number {
    return y * this.w + x;
  }

  private inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  at(x: number, y: number): number {
    return this.inside(x, y) ? this.g[this.i(x, y)]! : C.wall;
  }

  set(x: number, y: number, ch: keyof typeof C): void {
    if (this.inside(x, y)) this.g[this.i(x, y)] = C[ch];
  }

  fill(x0: number, y0: number, x1: number, y1: number, ch: keyof typeof C): this {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, ch);
    return this;
  }

  private mark(x: number, y: number, marker: Marker, when?: StoryCond): void {
    this.placed.push({ tx: x, ty: y, marker, ...(when ? { when } : {}) });
    this.taken.add(this.i(x, y));
  }

  /** Woods all round the map's edge (a ragged band), outside the walls. */
  woods(min: number, max: number): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const d = Math.min(x, y, this.w - 1 - x, this.h - 1 - y);
        const band = min + noise2(x / 6, y / 6, this.seed + 3) * (max - min);
        if (d < band) this.set(x, y, 'wall');
        else if (d < band + 2 && hash2(x, y, this.seed + 5) < 0.35) this.set(x, y, 'tree');
      }
    }
    return this;
  }

  /** The city walls: a ring of rampart `thick` tiles deep. */
  walls(x0: number, y0: number, x1: number, y1: number, thick = 2): this {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x < x0 + thick || x > x1 - thick || y < y0 + thick || y > y1 - thick) this.set(x, y, 'rampart');
    return this;
  }

  /**
   * A gate: a gap `width` wide through the wall at (x, y) on the wall line, and a road from it to the
   * map's edge on `side`, where the way out is.
   */
  gate(side: 'n' | 's' | 'e' | 'w', along: number, width: number, wallFrom: number, wallTo: number, exit: { to: RegionId; label: string; minLevel?: number }): this {
    const half = Math.floor(width / 2);
    if (side === 'e' || side === 'w') {
      const xEdge = side === 'e' ? this.w - 1 : 0;
      const [a, b] = side === 'e' ? [wallFrom, xEdge] : [xEdge, wallTo];
      for (let x = a; x <= b; x++) for (let y = along - half; y <= along - half + width - 1; y++) this.set(x, y, x >= wallFrom && x <= wallTo ? 'cobble' : 'path');
      this.mark(xEdge, along, { kind: 'exit', ...exit });
    } else {
      const yEdge = side === 's' ? this.h - 1 : 0;
      const [a, b] = side === 's' ? [wallFrom, yEdge] : [yEdge, wallTo];
      for (let y = a; y <= b; y++) for (let x = along - half; x <= along - half + width - 1; x++) this.set(x, y, y >= wallFrom && y <= wallTo ? 'cobble' : 'path');
      this.mark(along, yEdge, { kind: 'exit', ...exit });
    }
    return this;
  }

  /**
   * A building on a footprint whose top-left tile is (x, y). Its keeper stands at the door (in front of
   * the middle of the front wall), with the street paved up to it.
   */
  building(style: Style, x: number, y: number, w: number, h: number, o: { npc?: string; name?: string; pave?: boolean; art?: string; scale?: number; grim?: boolean } = {}): this {
    this.fill(x, y, x + w - 1, y + h - 1, 'house');
    this.mark(x, y + h - 1, { kind: 'building', style, w, h, ...(o.name ? { name: o.name } : {}), ...(o.art ? { art: o.art } : {}), ...(o.scale ? { scale: o.scale } : {}), ...(o.grim ? { grim: true } : {}) });
    const door = x + Math.floor(w / 2);
    if (o.pave !== false) this.step(door, y + h);
    // the keeper stands beside the door, out of the doorway
    if (o.npc) this.mark(door + 2 <= x + w - 1 ? door + 2 : door - 2, y + h, { kind: 'npc', npc: o.npc });
    return this;
  }

  /**
   * A path from a door down to the street it faces: cobbled when the street is, trodden earth otherwise (a pad of
   * cobbles in the grass before every door read as a stamp). Two tiles of path where no street is near.
   */
  private step(x: number, y0: number): void {
    let reach = -1;
    for (let k = 0; k <= 8; k++) {
      const at = this.at(x, y0 + k);
      if (at === C.path || at === C.cobble) {
        reach = k;
        break;
      }
      if (at !== C.floor && at !== C.deco) break;
    }
    const kind = reach >= 0 && this.at(x, y0 + reach) === C.cobble ? 'cobble' : 'path';
    for (let k = 0; k < (reach >= 0 ? reach : 2); k++) {
      const at = this.at(x, y0 + k);
      if (at === C.floor || at === C.deco || at === C.path) this.set(x, y0 + k, kind);
    }
  }

  /**
   * A row of houses side by side whose doors open on row `door` (a street), from x0 to x1: a house wherever
   * its lot (and the row behind it, under its roof) is still open ground.
   */
  row(x0: number, x1: number, door: number): this {
    for (let x = x0; x + 3 <= x1; x += 4) {
      let free = true;
      for (let y = door - 4; y < door && free; y++) for (let xx = x; xx < x + 4 && free; xx++) free = (this.at(xx, y) === C.floor || this.at(xx, y) === C.deco) && !this.taken.has(this.i(xx, y));
      if (free) this.building('house', x, door - 3, 4, 3);
    }
    return this;
  }

  npc(id: string, x: number, y: number, when?: StoryCond): this {
    this.mark(x, y, { kind: 'npc', npc: id }, when);
    return this;
  }

  prop(prop: string, x: number, y: number, solid = true, when?: StoryCond): this {
    this.mark(x, y, { kind: 'prop', prop, solid }, when);
    return this;
  }

  marker(x: number, y: number, marker: Marker, when?: StoryCond): this {
    this.mark(x, y, marker, when);
    return this;
  }

  /** A pond, with its banks planted. */
  pond(cx: number, cy: number, rx: number, ry: number): this {
    for (let y = cy - ry - 2; y <= cy + ry + 2; y++) {
      for (let x = cx - rx - 2; x <= cx + rx + 2; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (hash2(x, y, this.seed + 9) - 0.5) * 0.3;
        if (d <= 1) this.set(x, y, 'water');
        else if (d <= 1.9 && this.at(x, y) === C.floor && hash2(x, y, this.seed + 11) < 0.3) this.set(x, y, hash2(x, y, 13) < 0.5 ? 'deco' : 'bush');
      }
    }
    return this;
  }

  /** Trees and flowers over the open grass of an area (a park, a garden). */
  plant(x0: number, y0: number, x1: number, y1: number, trees: number, flowers: number): this {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (this.at(x, y) !== C.floor || this.taken.has(this.i(x, y))) continue;
        const r = hash2(x, y, this.seed + 17);
        if (r < trees) this.set(x, y, 'tree');
        else if (noise2(x / 3, y / 3, this.seed + 19) > 1 - flowers) this.set(x, y, 'deco');
      }
    }
    return this;
  }

  /**
   * A copse: trees thick at its heart and thinning toward a ragged edge, bushes as undergrowth around it,
   * on the open grass only. Groves give a place its shape (trees sprinkled one by one over a whole area
   * read as a toy box).
   */
  grove(cx: number, cy: number, r: number, density = 0.6): this {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        if (this.at(x, y) !== C.floor || this.taken.has(this.i(x, y))) continue;
        const d = Math.hypot(x - cx, y - cy) / r + (noise2(x / 2, y / 2, this.seed + 23) - 0.5) * 0.5;
        const h = hash2(x, y, this.seed + 29);
        if (d < 1 && h < density * (1 - d * 0.55)) this.set(x, y, 'tree');
        else if (d < 1.35 && h < 0.22) this.set(x, y, 'bush');
      }
    }
    return this;
  }

  /** Lamps along a line of tiles, every `step`. */
  lamps(x0: number, y0: number, x1: number, y1: number, step: number): this {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k += step) {
      const x = Math.round(x0 + ((x1 - x0) * k) / Math.max(1, n));
      const y = Math.round(y0 + ((y1 - y0) * k) / Math.max(1, n));
      if (this.at(x, y) === C.floor || this.at(x, y) === C.deco) this.prop('lamp', x, y);
    }
    return this;
  }

  build(): { map: string[]; placed: PlacedMarkerDef[] } {
    const map: string[] = [];
    for (let y = 0; y < this.h; y++) map.push(String.fromCharCode(...this.g.subarray(y * this.w, (y + 1) * this.w)));
    return { map, placed: this.placed };
  }
}

/**
 * A plan written at one size and laid out `s` times larger: every position spreads out by `s` and buildings grow
 * with it (roads and yards too, places keep their places), while people and props keep their own size: a village
 * as big as it should be, without redrawing it.
 */
export class SpreadPlan {
  readonly plan: CityPlan;

  constructor(
    w: number,
    h: number,
    seed: number,
    readonly s: number,
  ) {
    this.plan = new CityPlan(Math.round(w * s), Math.round(h * s), seed);
  }

  /** The first tile of an old tile's block, and the tile at its middle. */
  private a(v: number): number {
    return Math.floor(v * this.s + 1e-6);
  }
  private m(v: number): number {
    return Math.floor((v + 0.5) * this.s);
  }

  get w(): number {
    return this.plan.w;
  }
  get h(): number {
    return this.plan.h;
  }

  woods(min: number, max: number): this {
    this.plan.woods(min * this.s, max * this.s);
    return this;
  }
  set(x: number, y: number, ch: Parameters<CityPlan['set']>[2]): void {
    this.plan.fill(this.a(x), this.a(y), this.a(x + 1) - 1, this.a(y + 1) - 1, ch);
  }
  fill(x0: number, y0: number, x1: number, y1: number, ch: Parameters<CityPlan['set']>[2]): this {
    this.plan.fill(this.a(x0), this.a(y0), this.a(x1 + 1) - 1, this.a(y1 + 1) - 1, ch);
    return this;
  }
  building(style: Style, x: number, y: number, w: number, h: number, o: Parameters<CityPlan['building']>[5] = {}): this {
    // its door (the middle of its front, where the street and any interior's way in meet it) is where the
    // old door's tile spreads to
    const half = Math.floor(w / 2);
    const W = Math.round(w * this.s);
    const H = Math.round(h * this.s);
    this.plan.building(style, this.m(x + half) - Math.floor(W / 2), this.m(y + h) - H, W, H, o);
    return this;
  }
  /** A fence along a line of plan tiles: one tile thick at any scale. */
  fence(x0: number, y0: number, x1: number, y1: number): this {
    this.plan.fill(this.m(x0), this.m(y0), this.m(x1), this.m(y1), 'fence');
    return this;
  }
  npc(id: string, x: number, y: number, when?: StoryCond): this {
    this.plan.npc(id, this.m(x), this.m(y), when);
    return this;
  }
  prop(prop: string, x: number, y: number, solid = true, when?: StoryCond): this {
    this.plan.prop(prop, this.m(x), this.m(y), solid, when);
    return this;
  }
  marker(x: number, y: number, marker: Marker, when?: StoryCond): this {
    // a way out stays on the map's edge
    const ex = marker.kind === 'exit' ? (x <= 0 ? 0 : x >= this.plan.w / this.s - 1 ? this.plan.w - 1 : this.m(x)) : this.m(x);
    const ey = marker.kind === 'exit' ? (y <= 0 ? 0 : y >= this.plan.h / this.s - 1 ? this.plan.h - 1 : this.m(y)) : this.m(y);
    this.plan.marker(ex, ey, marker, when);
    return this;
  }
  pond(cx: number, cy: number, rx: number, ry: number): this {
    this.plan.pond(this.m(cx), this.m(cy), Math.round(rx * this.s), Math.round(ry * this.s));
    return this;
  }
  plant(x0: number, y0: number, x1: number, y1: number, trees: number, flowers: number): this {
    this.plan.plant(this.a(x0), this.a(y0), this.a(x1 + 1) - 1, this.a(y1 + 1) - 1, trees, flowers);
    return this;
  }
  grove(cx: number, cy: number, r: number, density?: number): this {
    this.plan.grove(this.m(cx), this.m(cy), r * this.s, density);
    return this;
  }
  lamps(x0: number, y0: number, x1: number, y1: number, step: number): this {
    this.plan.lamps(this.m(x0), this.m(y0), this.m(x1), this.m(y1), Math.max(1, Math.round(step * this.s)));
    return this;
  }
  build(): ReturnType<CityPlan['build']> {
    return this.plan.build();
  }
}
