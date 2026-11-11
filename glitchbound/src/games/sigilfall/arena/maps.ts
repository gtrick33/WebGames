/**
 * The Ring's three grounds. Every one is the same size: half again as much ground as they first had (the owner: "scale
 * up the arenas a bit, make them 50% bigger with more obstacles and healing spheres"), so a wide screen holds all of
 * it and a phone follows its player. What matters is where the stone stands, because a pillar between you and a
 * caster is the whole game. Each team waits in its own entry,
 * a walled recess at its end of the ground, behind a gate that lifts when the match begins. Plain data.
 */

export const ARENA_W = 684;
export const ARENA_H = 312;
/** How deep an entry is, and the stretch of the end wall it opens through. */
export const ENTRY_W = 44;
export const ENTRY_Y0 = ARENA_H / 2 - 40;
export const ENTRY_Y1 = ARENA_H / 2 + 40;

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
  theme: 'sands' | 'frost' | 'forge';
  color: string;
  pillars: Pillar[];
  /** Where each team stands when the gates open: team 0 left, team 1 right. */
  spawns: [[number, number][], [number, number][]];
  /** Where the healing spheres rise: the same for both ends. */
  orbs: [number, number][];
}

const MID_Y = ARENA_H / 2;
const LEFT: [number, number][] = [
  [24, MID_Y],
  [24, MID_Y - 24],
  [24, MID_Y + 24],
];
const RIGHT: [number, number][] = [
  [ARENA_W - 24, MID_Y],
  [ARENA_W - 24, MID_Y - 24],
  [ARENA_W - 24, MID_Y + 24],
];
/** A stone and its twin: the same turned half a circle about the middle, so neither end has the better of it. */
const pair = (x: number, y: number, w: number, h: number): Pillar[] => [
  { x, y, w, h },
  { x: ARENA_W - x - w, y: ARENA_H - y - h, w, h },
];
/**
 * Four spheres: one toward each end, and two between, one north-west of the middle and its twin south-east. None
 * stands just north of a stone: the ground there is behind the stone, to an eye that looks from the south.
 */
const ORBS = (side: number, dx: number, up: number): [number, number][] => [
  [side, MID_Y],
  [ARENA_W - side, MID_Y],
  [ARENA_W / 2 - dx, up],
  [ARENA_W / 2 + dx, ARENA_H - up],
];

export const MAPS: Record<string, RingMap> = {
  sands: {
    id: 'sands',
    name: 'The Proving Sands',
    blurb: 'Eight old pillars and nowhere to hide for long.',
    theme: 'sands',
    color: '#d8a860',
    pillars: [...pair(176, 70, 30, 26), ...pair(176, 216, 30, 26), ...pair(327, 34, 30, 26), ...pair(262, 143, 30, 26), ...ENTRY_WALLS],
    spawns: [LEFT, RIGHT],
    orbs: ORBS(118, 110, 112),
  },
  frost: {
    id: 'frost',
    name: 'The Frozen Mere',
    blurb: 'Ice walls set on the slant, and boulders between them.',
    theme: 'frost',
    color: '#7fc8ee',
    // (a boulder is 26 wide and under 40 deep; anything else is a wall of ice: render3d/ringDress.ts)
    pillars: [...pair(236, 30, 22, 82), { x: 329, y: 139, w: 26, h: 34 }, ...pair(132, 214, 30, 24), ...pair(132, 74, 30, 24), ...pair(250, 238, 26, 32), ...ENTRY_WALLS],
    spawns: [LEFT, RIGHT],
    orbs: ORBS(96, 42, 100),
  },
  forge: {
    id: 'forge',
    name: 'The Cinder Forge',
    blurb: 'One great anvil in the middle, and furnaces all round it.',
    theme: 'forge',
    color: '#d8622a',
    // (the anvil is the one over 40 wide; the rest are furnaces)
    pillars: [{ x: 314, y: 129, w: 56, h: 54 }, ...pair(170, 54, 26, 24), ...pair(170, 234, 26, 24), ...pair(329, 46, 26, 24), ...ENTRY_WALLS],
    spawns: [LEFT, RIGHT],
    orbs: ORBS(112, 92, 110),
  },
};

export const MAP_IDS = Object.keys(MAPS);
