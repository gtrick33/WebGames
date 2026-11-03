/**
 * The Ring's three grounds. Every one is the same size and fits on one screen, with nothing to scroll: what matters is
 * where the stone stands, because a pillar between you and a caster is the whole game. Each team waits in its own entry,
 * a walled recess at its end of the ground, behind a gate that lifts when the match begins. Plain data.
 */

export const ARENA_W = 548;
export const ARENA_H = 250;
/** How deep an entry is, and the stretch of the end wall it opens through. */
export const ENTRY_W = 44;
export const ENTRY_Y0 = 85;
export const ENTRY_Y1 = 165;

export interface Pillar {
  x: number;
  y: number;
  w: number;
  h: number;
  /** The walls of an entry: low, and no use for hiding behind. */
  wall?: boolean;
}

/** The walls either side of the entries, on every ground. */
const ENTRY_WALLS: Pillar[] = [
  { x: 0, y: 0, w: ENTRY_W, h: ENTRY_Y0, wall: true },
  { x: 0, y: ENTRY_Y1, w: ENTRY_W, h: ARENA_H - ENTRY_Y1, wall: true },
  { x: ARENA_W - ENTRY_W, y: 0, w: ENTRY_W, h: ENTRY_Y0, wall: true },
  { x: ARENA_W - ENTRY_W, y: ENTRY_Y1, w: ENTRY_W, h: ARENA_H - ENTRY_Y1, wall: true },
];

/** The gates: shut until the match begins. */
export const ENTRY_GATES: Pillar[] = [
  { x: ENTRY_W - 2, y: ENTRY_Y0, w: 4, h: ENTRY_Y1 - ENTRY_Y0 },
  { x: ARENA_W - ENTRY_W - 2, y: ENTRY_Y0, w: 4, h: ENTRY_Y1 - ENTRY_Y0 },
];

export interface RingMap {
  id: string;
  name: string;
  blurb: string;
  /** The ground's look (render/ring.ts). */
  theme: 'sands' | 'baths' | 'forge';
  color: string;
  pillars: Pillar[];
  /** Where each team stands when the gates open: team 0 left, team 1 right. */
  spawns: [[number, number][], [number, number][]];
}

const LEFT: [number, number][] = [
  [24, 125],
  [24, 101],
  [24, 149],
];
const RIGHT: [number, number][] = [
  [ARENA_W - 24, 125],
  [ARENA_W - 24, 101],
  [ARENA_W - 24, 149],
];

export const MAPS: Record<string, RingMap> = {
  sands: {
    id: 'sands',
    name: 'The Proving Sands',
    blurb: 'Four old pillars and nowhere to hide for long.',
    theme: 'sands',
    color: '#d8a860',
    pillars: [
      { x: 190, y: 58, w: 30, h: 26 },
      { x: 328, y: 58, w: 30, h: 26 },
      { x: 190, y: 166, w: 30, h: 26 },
      { x: 328, y: 166, w: 30, h: 26 },
      ...ENTRY_WALLS,
    ],
    spawns: [LEFT, RIGHT],
  },
  baths: {
    id: 'baths',
    name: 'The Drowned Baths',
    blurb: 'A long wall of broken marble down the middle.',
    theme: 'baths',
    color: '#5ab0c8',
    pillars: [
      { x: 260, y: 24, w: 28, h: 56 },
      { x: 260, y: 170, w: 28, h: 56 },
      { x: 148, y: 110, w: 26, h: 30 },
      { x: 374, y: 110, w: 26, h: 30 },
      ...ENTRY_WALLS,
    ],
    spawns: [LEFT, RIGHT],
  },
  forge: {
    id: 'forge',
    name: 'The Cinder Forge',
    blurb: 'One great anvil in the middle, and a pair of furnaces.',
    theme: 'forge',
    color: '#d8622a',
    pillars: [
      { x: 246, y: 98, w: 56, h: 54 },
      { x: 140, y: 40, w: 26, h: 24 },
      { x: 382, y: 186, w: 26, h: 24 },
      ...ENTRY_WALLS,
    ],
    spawns: [LEFT, RIGHT],
  },
};

export const MAP_IDS = Object.keys(MAPS);
