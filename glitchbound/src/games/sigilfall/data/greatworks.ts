import type { PlacedMarkerDef } from './types';

/*
 * The great things of the world, and there are few of them: only what the story itself names (a land's own line says
 * "the great lighthouse", "a necropolis on an island", "the Gloam Gate"). The owner: "they could be present only in
 * meaningful to the story zones, not literally everywhere"; a normal land's wonder is its town. Nobody needs to see one
 * whole ("we don't need to see them fully on the screen to get immersed"): you walk past a shin the size of a house and
 * look up. They are built of the same models as everything else, at a scale nothing else has. They stand on the map as
 * one marker (`great:<id>`), and only the tiles in `solid` block the way.
 */

export interface GreatPart {
  /** A still model... */
  m?: string;
  /** ...or a figure from the creature files, frozen in a pose. */
  kit?: string;
  clip?: string;
  /** How far into the clip, in seconds. */
  t?: number;
  /** Tiles from the work's middle, east and south. */
  x: number;
  z: number;
  /** Tiles off the ground; below 0 it is sunk in it. */
  y?: number;
  /** How tall, in tiles. */
  h?: number;
  /** Or the size of a box it is stretched to: across, tall, deep, in tiles. */
  box?: [number, number, number];
  /** Degrees about the vertical. */
  rot?: number;
  /** Degrees tipped forward (toward the south) and sideways. */
  tipX?: number;
  tipZ?: number;
  tint?: string;
  /** A figure's own colors, washed out toward plain stone (0 to 1; a figure is all stone unless it says). */
  stone?: number;
  /** A soft shadow on the ground under it. */
  shadow?: number;
  shadowD?: number;
  /** It stirs in the wind. */
  sway?: number;
  /** A fire on it, this strong, this far up. */
  flame?: number;
  flameY?: number;
  /** A glow on it. */
  glow?: string;
  glowY?: number;
  glowSize?: number;
}

export interface GreatWork {
  parts: GreatPart[];
  /** What can't be walked through: rectangles of tiles from its middle [x0, y0, x1, y1], inclusive. */
  solid: [number, number, number, number][];
  /** How much ground it wants open round it, half across and half deep (tiles); woods and rocks there go. */
  room: [number, number];
  /** A city wall from one edge of the land to the other, this many tiles south of its middle, open where a road crosses. */
  wall?: number;
  /** It may stand across a road: it's at a door a road comes to, and everyone just walks round it. */
  overRoad?: boolean;
  /** Its ground has a wall round it: what's in there isn't for walking on, and now you can see why. */
  walled?: boolean;
}

/* ------------------------------------------------------------------ what they're made of */

const BONE = '#ddd5bd';
const OLD_BONE = '#b8ae94';
const STONE = '#a4a2a8';
const DARK_STONE = '#6a6874';
const SAND_STONE = '#d8b880';
const ICE = '#a8d4f0';
const BLACK = '#3a3640';
const GOLD = '#e8c060';

type Opts = Partial<GreatPart>;
const figure = (kit: string, clip: string, h: number, x: number, z: number, o: Opts = {}): GreatPart => ({ kit, clip, h, x, z, tint: STONE, ...o });
const thing = (m: string, h: number, x: number, z: number, o: Opts = {}): GreatPart => ({ m, h, x, z, ...o });
const block = (w: number, h: number, d: number, x: number, z: number, o: Opts = {}): GreatPart => ({ m: 'statue_block', box: [w, h, d], x, z, tint: STONE, ...o });

/** Stepped tiers, wide at the foot: a pyramid in the sand, a temple in the jungle. A stair up its south face. */
function stepped(tiers: number, w: number, d: number, rise: number, tint: string, sunk = 0): GreatPart[] {
  const out: GreatPart[] = [];
  for (let i = 0; i < tiers; i++) {
    const k = 1 - i / (tiers + 0.5);
    out.push(block(w * k, rise, d * k, 0, ((1 - k) * -d) / 6, { y: i * rise - sunk, tint: i % 2 ? tint : shade(tint, 0.92), shadow: i === 0 ? (w / 1.6) * 0.8 : 0, shadowD: d / w }));
  }
  // the stair, from the sand to the top
  out.push(block(w * 0.16, tiers * rise * 0.5, d * 0.62, 0, d * 0.24, { y: -sunk, tipX: 0, tint: shade(tint, 1.12) }));
  return out;
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number): string =>
    Math.max(0, Math.min(255, Math.round(v * k)))
      .toString(16)
      .padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

/** A throne cut from stone, as high as a hall: its back, its seat, its arms. */
function throne(h: number, z: number, tint: string, y = 1.8): GreatPart[] {
  const w = h * 0.72;
  return [
    block(w, h, h * 0.16, 0, z - h * 0.2, { y, tint }),
    block(w, h * 0.32, h * 0.5, 0, z, { y, tint: shade(tint, 1.1) }),
    block(h * 0.12, h * 0.52, h * 0.5, -w * 0.5, z, { y, tint: shade(tint, 0.92) }),
    block(h * 0.12, h * 0.52, h * 0.5, w * 0.5, z, { y, tint: shade(tint, 0.92) }),
  ];
}

/** Things in a circle round the middle. */
function ring(n: number, rx: number, rz: number, make: (x: number, z: number, i: number) => GreatPart): GreatPart[] {
  return Array.from({ length: n }, (_, i) => make(Math.cos((i / n) * Math.PI * 2) * rx, Math.sin((i / n) * Math.PI * 2) * rz, i));
}

/** Where each of a ring's things stands, for what can't be walked through. */
function ringFeet(n: number, rx: number, rz: number): [number, number, number, number][] {
  return Array.from({ length: n }, (_, i): [number, number, number, number] => {
    const x = Math.round(Math.cos((i / n) * Math.PI * 2) * rx);
    const z = Math.round(Math.sin((i / n) * Math.PI * 2) * rz);
    return [x, z, x, z];
  });
}

/** A great keep, a tower at each shoulder, a wall in front with a gate: a castle no house comes up to the knee of. */
function castle(h: number, tint: string | undefined, o: { sunk?: number; roof?: string } = {}): GreatPart[] {
  const y = -(o.sunk ?? 0);
  const t = tint ? { tint } : {};
  const r = o.roof ? `#${o.roof}` : '';
  return [
    thing(`b_castle${r}`, h, 0, -h * 0.1, { y, shadow: h * 0.32, ...t }),
    thing(`b_tower_B${r}`, h * 0.72, -h * 0.5, -h * 0.28, { y, shadow: h * 0.1, ...t }),
    thing(`b_tower_B${r}`, h * 0.72, h * 0.5, -h * 0.28, { y, shadow: h * 0.1, ...t }),
    thing(`b_tower_A${r}`, h * 0.5, -h * 0.62, h * 0.18, { y, shadow: h * 0.08, ...t }),
    thing(`b_tower_A${r}`, h * 0.5, h * 0.62, h * 0.18, { y, shadow: h * 0.08, ...t }),
  ];
}

/** What a hill with a dungeon's mouth in it stands on (render3d/doorways.ts): the rows behind the door, which is the tile south of the middle. */
const HILL: [number, number, number, number][] = [[-3, -1, 3, 0], [-2, -2, 2, -2]];

/* ------------------------------------------------------------------ the table */

export const GREAT: Record<string, GreatWork> = {
  // Ironpeak: "the dwarves' stolen forge". The first thanes either side of its door, their hands on their hammers
  'thanes-gate': {
    parts: [
      figure('barbarian_large', 'idle', 17, -8, 0, { rot: 12, tint: '#b4b0a8' }),
      figure('barbarian_large', 'idle', 17, 8, 0, { rot: -12, tint: '#b4b0a8' }),
      block(6, 1, 5, -8, 0, { tint: DARK_STONE, shadow: 4 }),
      block(6, 1, 5, 8, 0, { tint: DARK_STONE, shadow: 4 }),
    ],
    solid: [[-10, -1, -9, 1], [-7, -1, -6, 1], [6, -1, 7, 1], [9, -1, 10, 1], ...HILL],
    room: [13, 6],
    overRoad: true,
  },

  // The hills with a dungeon's mouth in them: boulders fallen at the foot of each, of its own stone
  'mouth-rimeheld': {
    parts: [thing('stone_tallA', 2.6, -3.5, 0.4, { rot: 20, tint: ICE }), thing('stone_tallA', 3.4, 3.7, -0.2, { rot: 200, tint: '#d0ecff' }), thing('stone_tallA', 1.7, 2.9, 0.6, { rot: 110, tint: ICE })],
    solid: HILL,
    room: [5, 4],
    overRoad: true,
  },
  'mouth-blight': {
    parts: [thing('Rock_3_G', 1.3, -3.4, 0.5, { rot: 40, tint: '#6a6650' }), thing('Rock_1_G', 1.1, 3.5, 0.3, { rot: 130, tint: '#5a5644' })],
    solid: HILL,
    room: [5, 4],
    overRoad: true,
  },
  'mouth-molten': {
    parts: [thing('Rock_3_G', 1.5, -3.6, 0.4, { rot: 70, tint: '#3a2e2c' }), thing('Rock_1_G', 1.3, 3.6, 0.2, { rot: 160, tint: '#42322e' })],
    solid: [[-3, 0, 3, 0]],
    room: [5, 2],
    overRoad: true,
  },
  'mouth-grotto': {
    parts: [thing('Rock_3_G', 1.2, -3.4, 0.5, { rot: 10, tint: '#8a948c' }), thing('Rock_1_G', 1, 3.5, 0.5, { rot: 95, tint: '#7a8680' })],
    solid: HILL,
    room: [5, 4],
    overRoad: true,
  },
  // The Rotmother's cistern lets out under a wall of brick
  'outfall-rotmother': { parts: [], solid: [[-3, 0, 3, 0]], room: [4, 2], overRoad: true },

  // Riftscar: "the Herald's spire", the way to it through a tear in an arch at its foot
  'herald-spire': {
    parts: [
      thing('b_tower_B', 22, 0, 0, { tint: '#5a4c78', shadow: 5, glow: '#c49aff', glowY: 21, glowSize: 70 }),
      thing('b_tower_A', 11, -4.4, 1.4, { tint: '#4c4066', shadow: 2 }),
      thing('b_tower_A', 12, 4.6, 1, { tint: '#4c4066', shadow: 2 }),
      ...ring(7, 7, 4, (x, z, i) => thing('stone_tallA', 2.4 + (i % 3) * 1.1, x, z, { rot: i * 67, tipZ: x * 2.6, tipX: -z * 2.6, y: -0.3, tint: i % 2 ? '#a078e8' : '#7a58c0' })),
    ],
    solid: [[-3, -2, 3, 1], [-5, 0, -4, 1], [4, 0, 5, 1]],
    room: [8, 5],
    overRoad: true,
  },

  // Stormwatch: "the great lighthouse" (it can be seen from the mainland, and from a long way out to sea)
  'great-lighthouse': {
    parts: [
      thing('Rock_3_G', 6, 0, 1, { tint: '#6a7078', shadow: 6 }),
      thing('Rock_1_G', 4.5, -4, 3, { tint: '#6a7078' }),
      thing('Rock_1_G', 4.5, 4, 3, { tint: '#6a7078' }),
      thing('b_tower_B', 34, 0, 0, { y: 3, tint: '#c0c4c8', flame: 3, flameY: 32, glow: '#ffe9a0', glowY: 32, glowSize: 80 }),
    ],
    solid: [[-3, -2, 3, 2]],
    room: [8, 7],
  },

  // The Sunscorch: "the sunken tomb where the Sun King keeps his sigil". Him on his throne over its door, the sand to his knees
  'sun-king-colossus': {
    parts: [
      block(13, 3, 9, 0, -1, { y: -1, tint: shade(SAND_STONE, 0.86), shadow: 7, shadowD: 0.7 }),
      figure('sk_king', 'sit', 20, 0, -1, { y: 1.8, tint: SAND_STONE }),
      thing('w_shield_round', 11, 0, -4.6, { y: 12, tint: GOLD, glow: '#ffd070', glowY: 5, glowSize: 50 }),
      thing('statue_obelisk', 12, -8.5, 1, { tint: SAND_STONE, shadow: 2 }),
      thing('statue_obelisk', 12, 8.5, 1, { tint: SAND_STONE, shadow: 2 }),
    ],
    solid: [[-6, -4, 6, 2], [-9, 1, -8, 1], [8, 1, 9, 1]],
    room: [12, 8],
  },

  // Rimeheld: "frost giants and the old vault": the one who sold the vault's door, still in the ice where he was paid
  'frozen-giant': {
    parts: [
      figure('frost_golem', 'idle', 18, 0, 0, { y: -2, tint: ICE, stone: 0.6, rot: -14 }),
      ...ring(9, 7.5, 5.5, (x, z, i) => thing('stone_tallA', 7 + (i % 3) * 3, x, z, { rot: i * 70, tint: i % 2 ? ICE : '#d0ecff', tipZ: x * 2.2, tipX: -z * 2.2, y: -0.6, shadow: 1.6 })),
    ],
    solid: [[-3, -2, 3, 2], ...ringFeet(9, 7.5, 5.5)],
    room: [11, 8],
  },

  // Vinecoil: "the serpent cult's temples, older than any kingdom"
  'serpent-temple': {
    parts: [
      ...stepped(6, 32, 26, 3.6, '#7a8a5e'),
      thing('statue_column', 11, -17, 11, { tint: '#7a8a5e', shadow: 2 }),
      thing('statue_column', 11, 17, 11, { tint: '#7a8a5e', shadow: 2 }),
    ],
    solid: [[-14, -13, 14, 11], [-17, 11, -17, 11], [17, 11, 17, 11]],
    room: [20, 15],
  },

  // Highwall March: "the great fortress of Highwall": its keep, and its wall, from one side of the land to the other
  'the-highwall': {
    parts: castle(30, undefined),
    solid: [[-8, -9, 8, 3], [-17, -10, -13, -7], [13, -10, 17, -7], [-20, 3, -17, 6], [17, 3, 20, 6]],
    room: [20, 12],
    wall: 7,
  },

  // Gloamhollow: "the Gloam Gate at its end": a door at the edge of the living lands, lit from the other side
  'gloam-gate': {
    parts: [
      thing('arch_gate', 24, 0, 0, { tint: BLACK, shadow: 7, shadowD: 0.35 }),
      thing('statue_obelisk', 16, -14, 2, { tint: BLACK, flame: 1.5, flameY: 15.5, shadow: 2 }),
      thing('statue_obelisk', 16, 14, 2, { tint: BLACK, flame: 1.5, flameY: 15.5, shadow: 2 }),
      block(14, 18, 0.5, 0, -0.4, { tint: '#7affb0', y: 0.2, glow: '#7affb0', glowY: 10, glowSize: 90 }),
    ],
    solid: [[-12, -1, -8, 1], [8, -1, 12, 1], [-7, 0, 7, 0], [-14, 2, -14, 2], [14, 2, 14, 2]],
    room: [17, 7],
  },

  // The Bonefields: the one place the world's bones are its land. The Titan: whatever the dead march for, this is what they mean to raise
  titan: {
    parts: [
      figure('sk_king', 'dead', 30, 0, 0, { rot: 90, tint: BONE, stone: 0.85 }),
      thing('w_sword_E', 34, 24, -12, { y: -6, rot: 40, tipZ: 180, tipX: 9, tint: '#aaa8b0' }),
    ],
    solid: [[-6, -3, 6, 3]],
    room: [32, 18],
  },

  // Emberdeep: "a ring of black mountains round a lake of fire"
  'black-mountain': {
    parts: [
      thing('Rock_4_C', 40, 0, 0, { rot: 30, tint: '#3a2e2c', shadow: 16 }),
      thing('Rock_4_C', 26, -9, 4, { rot: 120, tint: '#42322e', shadow: 8 }),
      thing('Rock_4_C', 24, 9, 3, { rot: 210, tint: '#42322e', shadow: 8 }),
      thing('Rock_3_G', 8, -5, 9, { tint: '#3a2e2c' }),
      thing('Rock_3_G', 7, 6, 9, { tint: '#3a2e2c' }),
      block(0.1, 0.1, 0.1, 0, 0, { y: 38, flame: 5, flameY: 2, glow: '#ff7a2a', glowY: 2, glowSize: 120 }),
    ],
    solid: [[-12, -7, 12, 8]],
    room: [16, 12],
  },

  // Hollowmere: "a necropolis on an island in its middle, where the Hallow King's dead are made"
  necropolis: {
    parts: [
      ...castle(26, '#7a7a88', { roof: '2a2838' }),
      ...ring(8, 18, 12, (x, z, i) => thing('statue_obelisk', 7 + (i % 2) * 3, x, z, { tint: '#4a4a58', flame: i % 2 ? 0.7 : 0, flameY: 9.6 })),
    ],
    solid: [[-11, -8, 11, 5]],
    room: [20, 13],
    walled: true,
  },

  // The Riftscar: "glass plains under a torn sky": the Tear itself, and the glass turning slowly round it
  'the-tear': {
    parts: [
      block(2.4, 34, 0.5, 0, 0, { y: 2, tint: '#f0e0ff', tipZ: 6, glow: '#d8a0ff', glowY: 18, glowSize: 140 }),
      ...ring(10, 13, 9, (x, z, i) => thing('stone_tallA', 3 + (i % 4) * 1.4, x, z, { y: 2 + ((i * 7) % 12), rot: i * 47, tipZ: i * 30, tipX: i * 21, tint: i % 3 ? '#a078e8' : '#d0b8ff' })),
    ],
    solid: [[-1, 0, 1, 0]],
    room: [15, 11],
  },

  /* What stands behind a boss's wall, rising out of the dark over it (z below 0 is north of the wall). */

  // the Chapel Crypt: Morgrave at the reliquary: its great arch, and the candles of all the years
  'reliquary-wall': {
    parts: [
      thing('arch', 9, 0, -2.2, { tint: '#8a8698' }),
    ],
    solid: [],
    room: [0, 0],
  },
  // Gallows Keep: "their gallows and their king": the gang's gibbet, three swinging, over the wall of his hall
  'gang-gallows': {
    parts: [
      block(1, 11, 1, -7, -2.4, { tint: '#6a4a2e' }),
      block(1, 11, 1, 7, -2.4, { tint: '#6a4a2e' }),
      block(15.5, 1, 1, 0, -2.4, { y: 10.4, tint: '#5a3e26' }),
      figure('sk_minion', 'hit', 2.4, -4, -2.2, { y: 6.6, tint: OLD_BONE, stone: 0.5 }),
      figure('sk_minion', 'hit', 2.4, 0, -2.2, { y: 6.6, tint: OLD_BONE, stone: 0.5, rot: 40 }),
      figure('sk_minion', 'hit', 2.4, 4, -2.2, { y: 6.6, tint: OLD_BONE, stone: 0.5, rot: -30 }),
      block(0.16, 2.2, 0.16, -4, -2.2, { y: 8.5, tint: '#4a3a2a' }),
      block(0.16, 2.2, 0.16, 0, -2.2, { y: 8.5, tint: '#4a3a2a' }),
      block(0.16, 2.2, 0.16, 4, -2.2, { y: 8.5, tint: '#4a3a2a' }),
    ],
    solid: [],
    room: [0, 0],
  },
  // the Smugglers' Grotto: "something older in the water": a ship stove in by it, and it
  'grotto-wreck': {
    parts: [
      thing('p_boat', 1.5, -5, -5, { tipZ: 16, rot: 20, tint: '#6a5a4a', y: 1 }),
      thing('p_boat', 1.2, 7, -6, { tipZ: -24, rot: -30, tint: '#5a4e42', y: 1 }),
    ],
    solid: [],
    room: [0, 0],
  },
  // the Rotmother's Cistern: "the Rot-Mother stirs her pot": vats you could drown a street in
  'rot-vats': {
    parts: [
      thing('barrel_large', 10, -9, -5, { tint: '#7a8a68' }),
      thing('barrel_large', 12, 0, -5.8, { tint: '#6a7a5c', glow: '#8aff6a', glowY: 12, glowSize: 30 }),
      thing('barrel_large', 10, 9, -5, { tint: '#7a8a68' }),
    ],
    solid: [],
    room: [0, 0],
  },
  // the Deepforge: "the master smith who serves the King": the furnace itself, and its stacks
  'great-furnace': {
    parts: [
      thing('b_blacksmith#3a3038', 13, 0, -8.6, { tint: '#6a5a58', flame: 1.6, flameY: 6 }),
      thing('pillar', 15, -10, -3, { tint: '#4a4048', flame: 1.4, flameY: 15 }),
      thing('pillar', 15, 10, -3, { tint: '#4a4048', flame: 1.4, flameY: 15 }),
    ],
    solid: [],
    room: [0, 0],
  },
  // the Barrow of Kings: "the old kings' halls": they sit along the wall of the last one, in stone, still at council
  'seated-kings': {
    parts: [-12, -6, 0, 6, 12].map((x, i): GreatPart => figure('knight', 'sit', 9 + (i === 2 ? 3 : 0), x, -3, { tint: '#9a98a4', y: 2 })),
    solid: [],
    room: [0, 0],
  },
  // the Tomb: the Sun King's own burning chamber, his image over it in gold
  'sun-throne': {
    parts: [
      thing('w_shield_round', 11, 0, -4.6, { y: 8, tint: GOLD, glow: '#ffd070', glowY: 5, glowSize: 60 }),
      figure('sk_king', 'sit', 14, 0, -3, { y: 1.8, tint: '#e8c880' }),
      thing('statue_obelisk', 12, -11, -2, { tint: SAND_STONE }),
      thing('statue_obelisk', 12, 11, -2, { tint: SAND_STONE }),
    ],
    solid: [],
    room: [0, 0],
  },
  // the Rimeheld Vault: the door the giants sold
  'vault-door': {
    parts: [
      thing('arch_gate', 12, 0, -2.2, { tint: '#a8c8e0' }),
      thing('stone_tallA', 12, -9, -4.6, { tint: ICE, rot: 30 }),
      thing('stone_tallA', 14, 9, -5.2, { tint: ICE, rot: 140 }),
    ],
    solid: [],
    room: [0, 0],
  },
  // the Siege: "General Morvain under his banner in the Inner Ward"
  'inner-ward-gate': {
    parts: [
      thing('banner_triple_red', 12, 0, -1.6, { y: 1.6, tint: '#d8d0d0' }),
      thing('b_tower_A', 15, -11, -4, { tint: '#8a8690' }),
      thing('b_tower_A', 15, 11, -4, { tint: '#8a8690' }),
    ],
    solid: [],
    room: [0, 0],
  },
  // Blightheart: "the Withered Queen on her throne of thorn"
  'thorn-throne': {
    parts: [
      thing('Tree_Bare_2_B', 16, -8, -3, { tint: '#4a3a44' }),
      thing('Tree_Bare_2_B', 18, 8, -3, { tint: '#4a3a44' }),
      ...throne(9, -3, '#5a4458'),
      thing('Tree_Bare_1_B', 7, -4, -1.8, { tint: '#6a4a5a', rot: 40 }),
      thing('Tree_Bare_1_B', 7, 4, -1.8, { tint: '#6a4a5a', rot: 200 }),
    ],
    solid: [],
    room: [0, 0],
  },
  // the Molten Throne: "Ashkar chained to his throne": the throne, black iron, as high as the hall
  'ashkar-throne': {
    parts: [
      ...throne(14, -4, '#6a4a40'),
      block(1.4, 10, 1.4, -11, -2.4, { tint: '#3a3034', flame: 1.5, flameY: 11 }),
      block(1.4, 10, 1.4, 11, -2.4, { tint: '#3a3034', flame: 1.5, flameY: 11 }),
      block(9, 0.5, 0.5, -6, -2.4, { y: 8, rot: 20, tint: '#6a6470' }),
      block(9, 0.5, 0.5, 6, -2.4, { y: 8, rot: -20, tint: '#6a6470' }),
    ],
    solid: [],
    room: [0, 0],
  },
  // the Spire: "at its crown the Pale Herald": the glass the tower is coming apart into
  'tear-shards': {
    parts: [
      thing('stone_tallA', 15, -8, -5.6, { tint: '#a078e8', rot: 30, tipZ: 12, glow: '#c090ff', glowSize: 50 }),
      thing('stone_tallA', 18, 0, -6.8, { tint: '#d0b8ff', rot: 200 }),
      thing('stone_tallA', 13, 9, -5, { tint: '#8a5ad8', rot: 100, tipZ: -14 }),
    ],
    solid: [],
    room: [0, 0],
  },
  // Duskspire: the Hallow King's own throne, and everything that ever knelt to him
  'hallow-throne': {
    parts: [
      ...throne(20, -6, '#4a4654'),
      figure('sk_king', 'sit', 17, 0, -5.4, { y: 1.8 + 6.2, tint: '#a8a8b8' }),
      figure('black_knight', 'idle', 12, -13, -3, { tint: '#6a6874' }),
      figure('black_knight', 'idle', 12, 13, -3, { tint: '#6a6874' }),
    ],
    solid: [],
    room: [0, 0],
  },

  // The Pale Reach: "the dead stand in ranks and Duskspire rises in the north"
  duskspire: {
    parts: [
      ...castle(38, '#5a5868', { roof: '20202c' }),
      thing('b_tower_B#20202c', 44, 0, -12, { tint: '#54525e' }),
      thing('b_tower_B#20202c', 34, -14, -10, { tint: '#54525e' }),
      thing('b_tower_B#20202c', 34, 14, -10, { tint: '#54525e' }),
    ],
    solid: [[-17, -14, 17, -1]],
    room: [22, 15],
  },
  'ranks-of-the-dead': {
    parts: Array.from({ length: 48 }, (_, i): GreatPart => figure('sk_guard', 'idle', 2.6, ((i % 8) - 3.5) * 3.2, (Math.floor(i / 8) - 2.5) * 3.2, { rot: 180, t: (i % 5) * 0.1, tint: '#c8ccd8', stone: 0.3 })),
    solid: [],
    room: [15, 11],
  },
};

/**
 * Which land has which, and where: about somewhere (`at`, fractions of the map), at the door of a dungeon (`door`, `dy`
 * tiles south of it), or at a place the land names (`spot`). `water`: it may stand in the water.
 */
export interface GreatPlace {
  id: string;
  at?: [number, number];
  door?: string;
  /** At a place the land's own list names. */
  spot?: string;
  dy?: number;
  water?: boolean;
  /** Right there or not at all: it's the door itself. */
  exact?: boolean;
}

/**
 * The hand-laid lands' built doors have their ground here: blocks on the tiles behind the door ([x0, y0, x1, y1] from the
 * door's own tile), which come and go with the door.
 */
export function withDoorGround(placed: PlacedMarkerDef[], to: string, rects: readonly (readonly [number, number, number, number])[]): PlacedMarkerDef[] {
  const door = placed.find((p) => p.marker.kind === 'exit' && p.marker.to === to);
  if (!door) return placed;
  const taken = new Set(placed.map((p) => `${p.tx},${p.ty}`));
  const out = [...placed];
  for (const [x0, y0, x1, y1] of rects) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const key = `${door.tx + x},${door.ty + y}`;
        if (taken.has(key)) continue;
        taken.add(key);
        out.push({ tx: door.tx + x, ty: door.ty + y, marker: { kind: 'prop', prop: 'block', solid: true }, ...(door.when ? { when: door.when } : {}) });
      }
    }
  }
  return out;
}

/** The ground under the dungeons' built doors (render3d/doorways.ts): no wonders, just what stands behind a door tile. */
export const DOOR_GROUND: Record<string, GreatPlace[]> = {
  rimeheld: [{ id: 'mouth-rimeheld', door: 'rimeheld-vault', dy: -1, exact: true }],
  blightwood: [{ id: 'mouth-blight', door: 'blightheart', dy: -1, exact: true }],
  saltmarsh: [{ id: 'mouth-grotto', door: 'smugglers-grotto', dy: -1, exact: true }],
  duskfen: [{ id: 'outfall-rotmother', door: 'rotmother-cistern', dy: -1, exact: true }],
  emberdeep: [{ id: 'mouth-molten', door: 'molten-throne', dy: -1, exact: true }],
};

export const GREAT_IN: Record<string, GreatPlace[]> = {
  ironpeak: [{ id: 'thanes-gate', door: 'deepforge-halls', dy: -1 }],
  stormwatch: [{ id: 'great-lighthouse', at: [0.18, 0.72] }],
  sunscorch: [{ id: 'sun-king-colossus', door: 'tomb-of-the-sun-king', dy: -3 }],
  rimeheld: [{ id: 'frozen-giant', at: [0.25, 0.65] }],
  vinecoil: [{ id: 'serpent-temple', at: [0.68, 0.3] }],
  highwall: [{ id: 'the-highwall', at: [0.42, 0.1] }],
  bonefields: [{ id: 'titan', at: [0.5, 0.38] }],
  emberdeep: [{ id: 'black-mountain', door: 'molten-throne', dy: -8 }],
  hollowmere: [{ id: 'necropolis', spot: 'the-necropolis', dy: -9, water: true }],
  riftscar: [{ id: 'the-tear', at: [0.35, 0.4] }, { id: 'herald-spire', door: 'spire-of-the-rift', dy: -5 }, { id: 'gloam-gate', at: [0.6, 0.2] }],
  'pale-reach': [{ id: 'duskspire', door: 'duskspire' }, { id: 'ranks-of-the-dead', at: [0.5, 0.45] }],
};
