/**
 * Prism Pals levels: an ASCII map parsed into the static pieces the simulation and the renderer read.
 *
 *   .  air              #  ground            ^  spikes           @  exit
 *   1-4  where critter 0-3 starts (tangerine, mint, lilac, lemon)
 *   A-D  color block: solid only for the critter of that color
 *   a-d  color goo: deadly to every other color (its own critter wades through)
 *   E-H  color gate: shut, unless a critter of its color stands on a plate of that color
 *   e-h  color plate
 *   w x y z  gems (tangerine, mint, lilac, lemon): only their color picks them up
 *   %  crate (pushable)   T  spring          L  lever (E or ↓ pulls it)
 *   |  lever gate: shut until a lever is pulled (each pull flips every lever gate)
 *   !  the other kind of lever gate: open until a lever is pulled
 *   -  a horizontal moving platform, = a vertical one, : their track (air)
 *
 * Cells are one tile; x grows to the right and y downwards. Outside the map is solid at the sides and
 * the top, and a bottomless drop below.
 */
import type { ColorId } from './critters';

/** Cell kinds. */
export const Cell = { Air: 0, Ground: 1, Spikes: 2, Exit: 3, Block: 4, Goo: 5, Gate: 6, Plate: 7, LeverGate: 8, Spring: 9, Lever: 10, LeverGateOpen: 11 } as const;
export type Cell = (typeof Cell)[keyof typeof Cell];

export interface Platform {
  /** Left edge and top of the platform at time 0. */
  x: number;
  y: number;
  w: number;
  /** 'h' moves right first, then back; 'v' moves up first. */
  axis: 'h' | 'v';
  /** Lowest and highest value of x (axis h) or y (axis v) the platform reaches. */
  lo: number;
  hi: number;
}

export interface Gem {
  x: number;
  y: number;
  color: ColorId;
}

export interface LevelDef {
  name: string;
  /** Seconds a good team takes: the time bonus counts down from it. */
  par: number;
  map: string[];
}

export interface Level {
  name: string;
  par: number;
  w: number;
  h: number;
  /** Cell kinds, row by row (index y * w + x). */
  cells: Uint8Array;
  /** The color of a block, goo, gate or plate cell (0 otherwise). */
  tint: Uint8Array;
  /** Critter count (2 to 4) and where each starts (cell). */
  n: number;
  spawns: { x: number; y: number }[];
  exits: { x: number; y: number }[];
  gems: Gem[];
  crates: { x: number; y: number }[];
  platforms: Platform[];
  springs: { x: number; y: number }[];
  levers: { x: number; y: number }[];
  /** Which colors have gates. */
  gated: boolean[];
}

const KIND: Record<string, Cell> = { '.': Cell.Air, ':': Cell.Air, '#': Cell.Ground, '^': Cell.Spikes, '@': Cell.Exit, T: Cell.Spring, L: Cell.Lever, '|': Cell.LeverGate, '!': Cell.LeverGateOpen };

/** Platform speed, tiles per second. */
export const PLATFORM_SPEED = 2;

export function parseLevel(def: LevelDef): Level {
  const h = def.map.length;
  const w = def.map[0]?.length ?? 0;
  if (!w || def.map.some((r) => r.length !== w)) throw new Error(`${def.name}: rows differ in length`);
  const cells = new Uint8Array(w * h);
  const tint = new Uint8Array(w * h);
  const spawns: { x: number; y: number }[] = [];
  const lv: Level = { name: def.name, par: def.par, w, h, cells, tint, n: 0, spawns, exits: [], gems: [], crates: [], platforms: [], springs: [], levers: [], gated: [false, false, false, false] };
  const plat: { x: number; y: number; axis: 'h' | 'v' }[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = def.map[y]![x]!;
      const i = y * w + x;
      const k = KIND[ch];
      if (k !== undefined) cells[i] = k;
      else if (ch >= '1' && ch <= '4') spawns[ch.charCodeAt(0) - 49] = { x, y };
      else if (ch >= 'A' && ch <= 'D') [cells[i], tint[i]] = [Cell.Block, ch.charCodeAt(0) - 65];
      else if (ch >= 'a' && ch <= 'd') [cells[i], tint[i]] = [Cell.Goo, ch.charCodeAt(0) - 97];
      else if (ch >= 'E' && ch <= 'H') {
        [cells[i], tint[i]] = [Cell.Gate, ch.charCodeAt(0) - 69];
        lv.gated[tint[i]!] = true;
      }
      else if (ch >= 'e' && ch <= 'h') [cells[i], tint[i]] = [Cell.Plate, ch.charCodeAt(0) - 101];
      else if (ch >= 'w' && ch <= 'z') lv.gems.push({ x, y, color: (ch.charCodeAt(0) - 119) as ColorId });
      else if (ch === '%') lv.crates.push({ x, y });
      else if (ch === '-' || ch === '=') plat.push({ x, y, axis: ch === '-' ? 'h' : 'v' });
      else throw new Error(`${def.name}: unknown cell '${ch}' at ${x},${y}`);
      if (ch === '@') lv.exits.push({ x, y });
      if (ch === 'T') lv.springs.push({ x, y });
      if (ch === 'L') lv.levers.push({ x, y });
    }
  lv.n = spawns.length;
  if (lv.n < 2 || lv.n > 4 || Array.from(spawns).some((s) => !s)) throw new Error(`${def.name}: spawns must be 1..n`);
  // platforms: runs of cells of one kind on a row, moving along the track cells (':') beyond them
  const ch = (x: number, y: number): string => def.map[y]?.[x] ?? '#';
  const used = new Set<string>();
  for (const p of plat) {
    if (used.has(`${p.x},${p.y}`)) continue;
    const mark = p.axis === 'h' ? '-' : '=';
    let pw = 0;
    while (ch(p.x + pw, p.y) === mark) used.add(`${p.x + pw++},${p.y}`);
    let lo: number;
    let hi: number;
    if (p.axis === 'h') {
      lo = p.x;
      while (ch(lo - 1, p.y) === ':') lo--;
      hi = p.x;
      while (ch(hi + pw, p.y) === ':') hi++;
    } else {
      const free = (y: number): boolean => Array.from({ length: pw }, (_, i) => ch(p.x + i, y)).every((c) => c === ':');
      lo = p.y;
      while (free(lo - 1)) lo--;
      hi = p.y;
      while (free(hi + 1)) hi++;
    }
    if (lo === hi) throw new Error(`${def.name}: platform at ${p.x},${p.y} has no track`);
    lv.platforms.push({ x: p.x, y: p.y, w: pw, axis: p.axis, lo, hi });
  }
  return lv;
}

export const cellAt = (lv: Level, x: number, y: number): Cell => (x < 0 || x >= lv.w || y < 0 ? Cell.Ground : y >= lv.h ? Cell.Air : (lv.cells[y * lv.w + x] as Cell));
export const tintAt = (lv: Level, x: number, y: number): ColorId => (x < 0 || x >= lv.w || y < 0 || y >= lv.h ? 0 : (lv.tint[y * lv.w + x] as ColorId));

/** Where a platform is (its left edge and top) `t` steps into the level. */
export function platformAt(p: Platform, t: number, step: number): { x: number; y: number } {
  const span = p.hi - p.lo;
  const start = p.axis === 'h' ? p.x - p.lo : p.hi - p.y;
  // a triangle wave over the track: right (or up) first from where the map draws it
  const d = (start + PLATFORM_SPEED * t * step) % (2 * span);
  const at = d <= span ? d : 2 * span - d;
  return p.axis === 'h' ? { x: p.lo + at, y: p.y } : { x: p.x, y: p.hi - at };
}
