/**
 * The ground the placement editor paints on a land's map file (data/landmaps.ts): open ground, roads, water and what
 * grows or stands on it. Never a building, a pillar or a door: those are the land's own. The dev server checks a painted
 * map against this too (vite.config.ts), so the two can't differ.
 */
export interface Ground {
  /** Its letter in a land's rows (sim/map.ts TERRAIN). */
  ch: string;
  name: string;
  /** Its swatch in the editor. */
  color: string;
  /** Nobody walks through it: never painted where someone or something of the story stands. */
  solid: boolean;
}

export const GROUND: readonly Ground[] = [
  { ch: '.', name: 'Grass', color: '#6d9a4a', solid: false },
  { ch: ',', name: 'Flowers', color: '#9cbf5a', solid: false },
  { ch: '=', name: 'Road', color: '#b08a5a', solid: false },
  { ch: ':', name: 'Cobbles', color: '#9a948a', solid: false },
  { ch: 's', name: 'Sand', color: '#d8c08a', solid: false },
  { ch: 'b', name: 'Bridge', color: '#8a6440', solid: false },
  { ch: '~', name: 'Water', color: '#3f78b0', solid: true },
  { ch: 'T', name: 'Tree', color: '#2f5a2a', solid: true },
  { ch: 't', name: 'Bush', color: '#4a7a3a', solid: true },
  { ch: 'r', name: 'Rock', color: '#7a7a7a', solid: true },
  { ch: 'k', name: 'Bramble', color: '#5a4a2a', solid: true },
  { ch: 'f', name: 'Fence', color: '#8a6a40', solid: true },
  // (a wood's edge is its trees, a bare land's its cliffs: render3d/land.ts)
  { ch: '#', name: 'Woods or cliffs', color: '#2a2622', solid: true },
  { ch: '|', name: 'Rampart', color: '#a09a90', solid: true },
];

/** Every letter the editor may paint, and paint over. */
export const PAINTABLE = GROUND.map((g) => g.ch).join('');

/**
 * Why a land's rows, painted, can't be written over the rows it has now (null when they can): they must be the same
 * size, and only paintable ground may have changed, into paintable ground. A building, a pillar or a door is the
 * land's own.
 */
export function paintError(was: readonly string[], rows: unknown): string | null {
  if (!Array.isArray(rows) || rows.length !== was.length || rows.some((r, y) => typeof r !== 'string' || r.length !== was[y]!.length)) return 'rows of another size';
  for (const [y, row] of (rows as string[]).entries()) {
    const before = was[y]!;
    for (let x = 0; x < row.length; x++) if (row[x] !== before[x] && (!PAINTABLE.includes(row[x]!) || !PAINTABLE.includes(before[x]!))) return `${x}, ${y}: ${before[x]} can't become ${row[x]}`;
  }
  return null;
}
