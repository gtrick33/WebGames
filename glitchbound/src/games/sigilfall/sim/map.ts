import type { Marker, RegionDef } from '../data/types';

/**
 * A region's tile map at runtime: terrain kinds, which room each floor tile belongs to, what is solid
 * right now (doors close, cracked walls break), plus collision, line of sight and a flow field that
 * lets enemies walk around obstacles. Pixels in, pixels out; tiles are 16 px.
 */

export const TILE = 16;

export const K = {
  Floor: 0,
  Deco: 1,
  Path: 2,
  Cobble: 3,
  Water: 4,
  Bridge: 5,
  Wall: 6,
  Tree: 7,
  Bush: 8,
  Rock: 9,
  Fence: 10,
  House: 11,
  HouseAnchor: 12,
  Pillar: 13,
  Brazier: 14,
  Cracked: 15,
  Door: 16,
  Illusion: 17,
  Bramble: 18,
  Prop: 19,
  Sand: 20,
  /** City walls (stone, too high to see over). */
  Rampart: 21,
} as const;
export type K = (typeof K)[keyof typeof K];

const TERRAIN: Record<string, K> = {
  '.': K.Floor,
  ',': K.Deco,
  '=': K.Path,
  ':': K.Cobble,
  '~': K.Water,
  b: K.Bridge,
  '#': K.Wall,
  T: K.Tree,
  t: K.Bush,
  r: K.Rock,
  f: K.Fence,
  h: K.House,
  H: K.HouseAnchor,
  j: K.Pillar,
  Q: K.Brazier,
  Z: K.Cracked,
  D: K.Door,
  '%': K.Illusion,
  k: K.Bramble,
  u: K.Rock,
  s: K.Sand,
  '|': K.Rampart,
};

/** Kinds you can't walk through. */
const SOLID_KINDS = new Set<K>([K.Water, K.Wall, K.Tree, K.Bush, K.Rock, K.Fence, K.House, K.HouseAnchor, K.Pillar, K.Brazier, K.Cracked, K.Prop, K.Rampart]);
/** Kinds that stop projectiles (water and fences don't, low enough to shoot over). */
const BLOCK_KINDS = new Set<K>([K.Wall, K.Tree, K.Rock, K.House, K.HouseAnchor, K.Pillar, K.Cracked, K.Rampart]);

export interface PlacedMarker {
  ch: string;
  marker: Marker;
  tx: number;
  ty: number;
}

export interface TileMap {
  w: number;
  h: number;
  kind: Uint8Array;
  /** Encounter index + 1 for room floors, 0 elsewhere. */
  room: Uint8Array;
  /** 1 = can't walk. Doors and cracked walls change it at runtime. */
  solid: Uint8Array;
  /** 1 = stops projectiles. */
  block: Uint8Array;
  markers: PlacedMarker[];
  /** Door tiles per encounter index. */
  doors: number[][];
  /** Room floor tiles per encounter index. */
  roomTiles: number[][];
}

export function parseRegion(def: RegionDef): TileMap {
  const h = def.map.length;
  const w = def.map[0]!.length;
  const kind = new Uint8Array(w * h);
  const room = new Uint8Array(w * h);
  const solid = new Uint8Array(w * h);
  const block = new Uint8Array(w * h);
  const markers: PlacedMarker[] = [];
  const roomOf = new Map(def.encounters.map((e, i) => [e.floor, i]));
  const roomTiles: number[][] = def.encounters.map(() => []);
  for (let y = 0; y < h; y++) {
    const row = def.map[y]!;
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? '#';
      const i = y * w + x;
      const marker = def.markers[ch];
      const r = roomOf.get(ch);
      if (marker) {
        markers.push({ ch, marker, tx: x, ty: y });
        // markers stand on floor; some are solid things in their own right
        kind[i] = marker.kind === 'prop' && marker.solid ? K.Prop : marker.kind === 'waystone' || marker.kind === 'dummy' ? K.Prop : K.Floor;
        // a marker inside a room belongs to it
        const around = [row[x - 1], row[x + 1], def.map[y - 1]?.[x], def.map[y + 1]?.[x]];
        for (const a of around) {
          const rr = a !== undefined ? roomOf.get(a) : undefined;
          if (rr !== undefined) {
            room[i] = rr + 1;
            break;
          }
        }
      } else if (r !== undefined) {
        kind[i] = K.Floor;
        room[i] = r + 1;
      } else {
        kind[i] = TERRAIN[ch] ?? K.Wall;
      }
      if (room[i]) roomTiles[room[i] - 1]!.push(i);
      solid[i] = SOLID_KINDS.has(kind[i] as K) ? 1 : 0;
      block[i] = BLOCK_KINDS.has(kind[i] as K) ? 1 : 0;
    }
  }
  // doors belong to the rooms they touch
  const doors: number[][] = def.encounters.map(() => []);
  for (let i = 0; i < w * h; i++) {
    if (kind[i] !== K.Door) continue;
    const x = i % w;
    const y = (i - x) / w;
    const near = new Set<number>();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const rr = room[ny * w + nx];
      if (rr) near.add(rr - 1);
    }
    for (const r of near) doors[r]!.push(i);
  }
  // markers a zone generator placed: they stand on the ground already there (sand, a road), or on grass
  for (const pm of def.placed ?? []) {
    const { tx, ty, marker } = pm;
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
    const i = ty * w + tx;
    markers.push({ ch: '', marker, tx, ty });
    if ((marker.kind === 'prop' && marker.solid) || marker.kind === 'waystone' || marker.kind === 'dummy') kind[i] = K.Prop;
    // buildings stand on their own footprint, which stays solid
    else if (marker.kind !== 'building' && SOLID_KINDS.has(kind[i] as K)) kind[i] = K.Floor;
    solid[i] = SOLID_KINDS.has(kind[i] as K) ? 1 : 0;
    block[i] = BLOCK_KINDS.has(kind[i] as K) ? 1 : 0;
  }
  return { w, h, kind, room, solid, block, markers, doors, roomTiles };
}

export const tileAt = (m: TileMap, px: number, py: number): number => {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return -1;
  return ty * m.w + tx;
};

export function solidAt(m: TileMap, px: number, py: number): boolean {
  const i = tileAt(m, px, py);
  return i < 0 || m.solid[i] === 1;
}

export function blocksAt(m: TileMap, px: number, py: number): boolean {
  const i = tileAt(m, px, py);
  return i < 0 || m.block[i] === 1;
}

/** Whether a circle overlaps any solid tile. */
export function circleHitsWall(m: TileMap, x: number, y: number, r: number): boolean {
  const x0 = Math.floor((x - r) / TILE);
  const x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE);
  const y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
      if (!m.solid[ty * m.w + tx]) continue;
      // nearest point of the tile to the circle center
      const nx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
      const ny = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
      if ((nx - x) * (nx - x) + (ny - y) * (ny - y) < r * r) return true;
    }
  }
  return false;
}

/**
 * Moves a circle by (dx, dy), sliding along walls: X then Y, in steps no longer than a quarter tile
 * so nothing tunnels. Returns the new position and whether each axis was blocked.
 */
export function moveCircle(m: TileMap, x: number, y: number, r: number, dx: number, dy: number): { x: number; y: number; bx: boolean; by: boolean } {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
  const sx = dx / steps;
  const sy = dy / steps;
  let bx = false;
  let by = false;
  for (let i = 0; i < steps; i++) {
    if (!bx && sx !== 0) {
      if (circleHitsWall(m, x + sx, y, r)) bx = true;
      else x += sx;
    }
    if (!by && sy !== 0) {
      if (circleHitsWall(m, x, y + sy, r)) by = true;
      else y += sy;
    }
  }
  return { x, y, bx, by };
}

/** Clear line between two points for projectiles and sight (walks the tiles the segment crosses). */
export function lineOfSight(m: TileMap, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (blocksAt(m, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

/** The farthest free point from (x, y) toward angle `a`, up to `dist` (for blinks and dashes). */
export function castRay(m: TileMap, x: number, y: number, r: number, a: number, dist: number): { x: number; y: number } {
  const c = Math.cos(a);
  const s = Math.sin(a);
  let lx = x;
  let ly = y;
  for (let d = 2; d <= dist; d += 2) {
    const nx = x + c * d;
    const ny = y + s * d;
    // stop at the first wall: never through doors or into sealed rooms
    if (circleHitsWall(m, nx, ny, r)) break;
    lx = nx;
    ly = ny;
  }
  return { x: lx, y: ly };
}

/**
 * Distance field (in tiles) from a target tile over walkable tiles, out to `max` steps. Enemies step
 * to the neighbour with the smallest value, so they path around walls instead of pushing into them.
 */
export function flowField(m: TileMap, tx: number, ty: number, max: number, out?: Int16Array): Int16Array {
  const f = out && out.length === m.w * m.h ? out : new Int16Array(m.w * m.h);
  f.fill(-1);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return f;
  const q = new Int32Array(m.w * m.h);
  let head = 0;
  let tail = 0;
  const start = ty * m.w + tx;
  f[start] = 0;
  q[tail++] = start;
  while (head < tail) {
    const i = q[head++]!;
    const d = f[i]!;
    if (d >= max) continue;
    const x = i % m.w;
    if (x > 0) visit(i - 1);
    if (x < m.w - 1) visit(i + 1);
    if (i >= m.w) visit(i - m.w);
    if (i < m.w * (m.h - 1)) visit(i + m.w);
    function visit(j: number): void {
      if (f[j] !== -1 || m.solid[j]) return;
      f[j] = d + 1;
      q[tail++] = j;
    }
  }
  return f;
}

/** The direction to step from (px, py) following a flow field, or null when off the field. */
export function flowStep(m: TileMap, f: Int16Array, px: number, py: number): { x: number; y: number } | null {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  const here = f[ty * m.w + tx];
  if (here === undefined || here < 0) return null;
  let best = here;
  let bx = 0;
  let by = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = tx + dx;
      const ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const v = f[ny * m.w + nx]!;
      if (v < 0 || v >= best) continue;
      // no corner cutting through walls
      if (dx && dy && (m.solid[ty * m.w + nx] || m.solid[ny * m.w + tx])) continue;
      best = v;
      bx = dx;
      by = dy;
    }
  }
  if (!bx && !by) return null;
  // aim for the middle of the next tile
  const cx = (tx + bx + 0.5) * TILE - px;
  const cy = (ty + by + 0.5) * TILE - py;
  const l = Math.hypot(cx, cy) || 1;
  return { x: cx / l, y: cy / l };
}

/** Tile-center position of a marker. */
export const markerPos = (pm: PlacedMarker): { x: number; y: number } => ({ x: (pm.tx + 0.5) * TILE, y: (pm.ty + 0.5) * TILE });

export function setDoors(m: TileMap, room: number, closed: boolean): void {
  for (const i of m.doors[room] ?? []) {
    m.solid[i] = closed ? 1 : 0;
    m.block[i] = closed ? 1 : 0;
  }
}

/**
 * The nearest point where a circle overlaps no wall (a door that slammed shut on top of someone).
 * Searches outward in rings, preferring tiles of `room` when given; returns null if nothing is free
 * within two tiles.
 */
export function pushOut(m: TileMap, x: number, y: number, r: number, room = -1): { x: number; y: number } | null {
  if (!circleHitsWall(m, x, y, r)) return { x, y };
  let fallback: { x: number; y: number } | null = null;
  for (let d = 1; d <= TILE * 2; d += 1) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const nx = x + Math.cos(a) * d;
      const ny = y + Math.sin(a) * d;
      if (circleHitsWall(m, nx, ny, r)) continue;
      if (room < 0 || m.room[tileAt(m, nx, ny)] === room + 1) return { x: nx, y: ny };
      fallback ??= { x: nx, y: ny };
    }
    if (fallback && d > r + 2) return fallback;
  }
  return fallback;
}

/** Breaks a cracked wall tile (returns whether it was one). */
export function breakWall(m: TileMap, i: number): boolean {
  if (m.kind[i] !== K.Cracked) return false;
  m.kind[i] = K.Floor;
  m.solid[i] = 0;
  m.block[i] = 0;
  return true;
}

export const isKind = (m: TileMap, i: number, k: K): boolean => m.kind[i] === k;
