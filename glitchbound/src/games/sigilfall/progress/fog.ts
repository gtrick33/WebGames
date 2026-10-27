import type { RegionId } from '../data/types';
import type { Character } from './character';

/**
 * Fog of war on the maps: each land remembers which parts of it the hero has walked near, in cells of
 * FOG_CELL tiles, kept on the hero as a base64 bitset per land ('*' for a land seen whole: one explored
 * before the fog existed). The maps draw what is unexplored dark; the world itself is never hidden.
 */

/** Tiles to a side of one fog cell. */
export const FOG_CELL = 4;
/** How far round the hero the fog lifts, in tiles (about the width of the screen). */
export const FOG_REVEAL = 13;
/** A land seen whole. */
export const SEEN_ALL = '*';

export interface Fog {
  w: number;
  h: number;
  /** One byte a cell: 1 explored. */
  cells: Uint8Array;
  /** Cells explored, kept up to date. */
  count: number;
  all: boolean;
}

export const fogSize = (mapW: number, mapH: number): { w: number; h: number } => ({ w: Math.ceil(mapW / FOG_CELL), h: Math.ceil(mapH / FOG_CELL) });

/** The hero's fog of a land (a fresh one, all dark, if they have none, or one that doesn't fit the map). */
export function loadFog(c: Character, region: RegionId, mapW: number, mapH: number): Fog {
  const { w, h } = fogSize(mapW, mapH);
  const cells = new Uint8Array(w * h);
  const saved = c.seen[region];
  if (saved === SEEN_ALL) {
    cells.fill(1);
    return { w, h, cells, count: w * h, all: true };
  }
  let count = 0;
  if (saved) {
    try {
      const bytes = atob(saved);
      if (bytes.length === Math.ceil((w * h) / 8)) {
        for (let i = 0; i < w * h; i++) {
          if ((bytes.charCodeAt(i >> 3) >> (i & 7)) & 1) {
            cells[i] = 1;
            count++;
          }
        }
      }
    } catch {
      // a broken entry: the land is dark again, nothing else is lost
    }
  }
  return { w, h, cells, count, all: false };
}

/** Writes a land's fog back onto the hero. */
export function storeFog(c: Character, region: RegionId, f: Fog): void {
  if (f.all) {
    c.seen[region] = SEEN_ALL;
    return;
  }
  const bytes = new Uint8Array(Math.ceil((f.w * f.h) / 8));
  for (let i = 0; i < f.cells.length; i++) if (f.cells[i]) bytes[i >> 3]! |= 1 << (i & 7);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  c.seen[region] = btoa(s);
}

/** Lifts the fog round a point (in tiles); true when anything new was seen. */
export function revealFog(f: Fog, tx: number, ty: number, radius = FOG_REVEAL): boolean {
  if (f.all) return false;
  let fresh = false;
  const r = radius / FOG_CELL;
  const cx = tx / FOG_CELL;
  const cy = ty / FOG_CELL;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(f.h - 1, Math.floor(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(f.w - 1, Math.floor(cx + r)); x++) {
      const i = y * f.w + x;
      if (f.cells[i] || Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r + 0.35) continue;
      f.cells[i] = 1;
      f.count++;
      fresh = true;
    }
  }
  return fresh;
}

/** Whether a tile has been explored. */
export const fogSeen = (f: Fog, tx: number, ty: number): boolean => f.all || f.cells[Math.floor(ty / FOG_CELL) * f.w + Math.floor(tx / FOG_CELL)] === 1;

/** How much of a land has been explored (0..1), counting only the cells with ground to walk on (`open`). */
export function fogShare(f: Fog, open: Uint8Array): number {
  if (f.all) return 1;
  let n = 0;
  let seen = 0;
  for (let i = 0; i < open.length; i++) {
    if (!open[i]) continue;
    n++;
    if (f.cells[i]) seen++;
  }
  return n ? seen / n : 1;
}

/** The cells of a map with any ground to walk on. */
export function fogOpen(f: Fog, solid: Uint8Array, mapW: number): Uint8Array {
  const open = new Uint8Array(f.w * f.h);
  for (let i = 0; i < solid.length; i++) if (!solid[i]) open[Math.floor(Math.floor(i / mapW) / FOG_CELL) * f.w + Math.floor((i % mapW) / FOG_CELL)] = 1;
  return open;
}
