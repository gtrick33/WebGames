import { hash2, noise2 } from '../core/math';
import type { Marker, PlacedMarkerDef, RegionId } from './types';

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

  private mark(x: number, y: number, marker: Marker): void {
    this.placed.push({ tx: x, ty: y, marker });
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
  building(style: Style, x: number, y: number, w: number, h: number, o: { npc?: string; name?: string; pave?: boolean } = {}): this {
    this.fill(x, y, x + w - 1, y + h - 1, 'house');
    this.mark(x, y + h - 1, { kind: 'building', style, w, h, ...(o.name ? { name: o.name } : {}) });
    const door = x + Math.floor(w / 2);
    if (o.pave !== false) this.fill(door - 1, y + h, door + 1, y + h + 1, 'cobble');
    // the keeper stands beside the door, out of the doorway
    if (o.npc) this.mark(door + 2 <= x + w - 1 ? door + 2 : door - 2, y + h, { kind: 'npc', npc: o.npc });
    return this;
  }

  npc(id: string, x: number, y: number): this {
    this.mark(x, y, { kind: 'npc', npc: id });
    return this;
  }

  prop(prop: string, x: number, y: number, solid = true): this {
    this.mark(x, y, { kind: 'prop', prop, solid });
    return this;
  }

  marker(x: number, y: number, marker: Marker): this {
    this.mark(x, y, marker);
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
