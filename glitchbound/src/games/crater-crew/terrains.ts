/**
 * The ten battlefields. Each has its own landform (terrain.ts builds it from a seed), physics (gravity,
 * how strong the wind gets, where the deadly liquid starts) and look (render/scene.ts paints it). Pure
 * data: the room server imports it too.
 */

export const TERRAIN_IDS = ['meadow', 'dunes', 'peaks', 'magma', 'atoll', 'moon', 'sugar', 'hollow', 'graves', 'scrap'] as const;
export type TerrainId = (typeof TERRAIN_IDS)[number];
export const isTerrainId = (v: unknown): v is TerrainId => typeof v === 'string' && (TERRAIN_IDS as readonly string[]).includes(v);

export type Pattern = 'loam' | 'sand' | 'ice' | 'basalt' | 'coral' | 'regolith' | 'cake' | 'crystal' | 'shale' | 'metal';
export type Decor = 'tree' | 'flower' | 'tuft' | 'cactus' | 'skull' | 'pine' | 'icicle' | 'vent' | 'charred' | 'palm' | 'shell' | 'dish' | 'rock' | 'cane' | 'lolly' | 'gumdrop' | 'crystal' | 'mushroom' | 'tomb' | 'deadtree' | 'pumpkin' | 'barrel' | 'tire' | 'pipe';
export type Far = 'hills' | 'mesas' | 'peaks' | 'volcano' | 'sea' | 'planet' | 'cakes' | 'stalactites' | 'spires' | 'stacks';
export type Ambient = 'leaves' | 'dust' | 'snow' | 'embers' | 'gulls' | 'stars' | 'sprinkles' | 'motes' | 'fireflies' | 'smog';

export interface TerrainDef {
  id: TerrainId;
  name: string;
  /** Shown under the name in the picker. */
  blurb: string;
  emoji: string;
  /** Gravity as a share of normal (the moon floats). */
  gravity: number;
  /** Strongest wind, 0..10. */
  windMax: number;
  /** The liquid's surface (world y): anything below it is lost. */
  liquidY: number;
  liquid: { kind: 'water' | 'lava' | 'sludge' | 'void'; top: string; deep: string; name: string };
  sky: [string, string, string];
  sun: { kind: 'sun' | 'moon' | 'planet' | 'glow' | 'none'; color: string; x: number; y: number; r: number };
  far: { kind: Far; near: string; far: string };
  clouds: string | null;
  ambient: Ambient | null;
  /** The grass / snow / frosting band along every surface. */
  top: { color: string; hi: string; depth: number };
  pattern: Pattern;
  /** The ground's body: light and dark tone, specks, and the dark rim along air. */
  soil: { light: string; dark: string; speck: string; rim: string };
  decor: Decor[];
}

export const TERRAINS: Record<TerrainId, TerrainDef> = {
  meadow: {
    id: 'meadow',
    name: 'Clover Hills',
    blurb: 'Rolling green hills and a gentle breeze',
    emoji: '🌳',
    gravity: 1,
    windMax: 6,
    liquidY: 850,
    liquid: { kind: 'water', top: '#4cc3ff', deep: '#155fa8', name: 'the lake' },
    sky: ['#4aa8f0', '#8fd3ff', '#e6f7ff'],
    sun: { kind: 'sun', color: '#fff3b0', x: 0.78, y: 0.16, r: 54 },
    far: { kind: 'hills', near: '#7fc779', far: '#a9dcb0' },
    clouds: '#ffffff',
    ambient: 'leaves',
    top: { color: '#4fbf3a', hi: '#8ee35c', depth: 11 },
    pattern: 'loam',
    soil: { light: '#9a6a3f', dark: '#6b4425', speck: '#c69a62', rim: '#3e2614' },
    decor: ['tree', 'tree', 'flower', 'tuft', 'tuft', 'rock'],
  },
  dunes: {
    id: 'dunes',
    name: 'Sunscorch Dunes',
    blurb: 'Sand dunes, flat mesas and fierce wind',
    emoji: '🌵',
    gravity: 1,
    windMax: 10,
    liquidY: 860,
    liquid: { kind: 'water', top: '#3fd0c9', deep: '#13707a', name: 'the oasis' },
    sky: ['#ff9a4d', '#ffc26e', '#ffe8b8'],
    sun: { kind: 'sun', color: '#fff0c0', x: 0.24, y: 0.22, r: 70 },
    far: { kind: 'mesas', near: '#d9824a', far: '#eda872' },
    clouds: null,
    ambient: 'dust',
    top: { color: '#f3cf7a', hi: '#fde7a6', depth: 7 },
    pattern: 'sand',
    soil: { light: '#e2a95a', dark: '#b97a35', speck: '#f5d08c', rim: '#7a4a1c' },
    decor: ['cactus', 'cactus', 'skull', 'rock', 'tuft'],
  },
  peaks: {
    id: 'peaks',
    name: 'Frostbite Peaks',
    blurb: 'Jagged icy mountains with deep valleys',
    emoji: '🏔️',
    gravity: 1,
    windMax: 8,
    liquidY: 860,
    liquid: { kind: 'water', top: '#9fe6ff', deep: '#2a6fa8', name: 'the icy sea' },
    sky: ['#5b7fc7', '#a9c4ef', '#eef5ff'],
    sun: { kind: 'sun', color: '#ffffff', x: 0.66, y: 0.12, r: 40 },
    far: { kind: 'peaks', near: '#a8bfe0', far: '#cfdcf2' },
    clouds: '#f4f8ff',
    ambient: 'snow',
    top: { color: '#f5fbff', hi: '#ffffff', depth: 13 },
    pattern: 'ice',
    soil: { light: '#9fb6d3', dark: '#5f7799', speck: '#d8e8fb', rim: '#33445e' },
    decor: ['pine', 'pine', 'pine', 'icicle', 'rock'],
  },
  magma: {
    id: 'magma',
    name: 'Magma Rift',
    blurb: 'Volcanoes over a rising lava sea',
    emoji: '🌋',
    gravity: 1,
    windMax: 5,
    liquidY: 800,
    liquid: { kind: 'lava', top: '#ffb12a', deep: '#c2260f', name: 'the lava' },
    sky: ['#2a0d1c', '#6e1c22', '#d5512a'],
    sun: { kind: 'glow', color: '#ff7a2a', x: 0.5, y: 0.95, r: 260 },
    far: { kind: 'volcano', near: '#3b1418', far: '#5a1d1f' },
    clouds: '#4a2a2e',
    ambient: 'embers',
    top: { color: '#3a2a2c', hi: '#ff7b2e', depth: 6 },
    pattern: 'basalt',
    soil: { light: '#4b3236', dark: '#24161a', speck: '#ff6a1f', rim: '#120a0c' },
    decor: ['vent', 'charred', 'charred', 'rock'],
  },
  atoll: {
    id: 'atoll',
    name: 'Coconut Atoll',
    blurb: 'Little islands with open sea between them',
    emoji: '🏝️',
    gravity: 1,
    windMax: 7,
    liquidY: 790,
    liquid: { kind: 'water', top: '#3fe0e8', deep: '#0b6aa6', name: 'the sea' },
    sky: ['#2f9df2', '#7fd1fb', '#d9f6ff'],
    sun: { kind: 'sun', color: '#fffbd0', x: 0.2, y: 0.14, r: 46 },
    far: { kind: 'sea', near: '#4fb5c6', far: '#8fd7e2' },
    clouds: '#ffffff',
    ambient: 'gulls',
    top: { color: '#f6dc96', hi: '#fff1c4', depth: 9 },
    pattern: 'coral',
    soil: { light: '#d9b77a', dark: '#a7804a', speck: '#fff3d6', rim: '#6b4f2a' },
    decor: ['palm', 'palm', 'shell', 'tuft'],
  },
  moon: {
    id: 'moon',
    name: 'Moonbase Dust',
    blurb: 'Low gravity, no wind, and a long way down',
    emoji: '🌕',
    gravity: 0.55,
    windMax: 0,
    liquidY: 860,
    liquid: { kind: 'void', top: '#3b2f7a', deep: '#05040f', name: 'deep space' },
    sky: ['#05060f', '#0f1230', '#26285a'],
    sun: { kind: 'planet', color: '#3f8cff', x: 0.8, y: 0.2, r: 70 },
    far: { kind: 'planet', near: '#3a3d52', far: '#4a4e66' },
    clouds: null,
    ambient: 'stars',
    top: { color: '#d4d6df', hi: '#f2f3f8', depth: 5 },
    pattern: 'regolith',
    soil: { light: '#9da0ad', dark: '#62656f', speck: '#c9cbd4', rim: '#2b2d35' },
    decor: ['dish', 'rock', 'rock'],
  },
  sugar: {
    id: 'sugar',
    name: 'Sugar Summit',
    blurb: 'Stacked cake terraces and floating sweets',
    emoji: '🍰',
    gravity: 1,
    windMax: 6,
    liquidY: 860,
    liquid: { kind: 'water', top: '#ff8fd0', deep: '#b8327e', name: 'the syrup' },
    sky: ['#ffa6d6', '#ffd1ea', '#fff2f8'],
    sun: { kind: 'sun', color: '#fffbe0', x: 0.7, y: 0.18, r: 44 },
    far: { kind: 'cakes', near: '#f6a6c9', far: '#fbd0e2' },
    clouds: '#ffffff',
    ambient: 'sprinkles',
    top: { color: '#fff4fb', hi: '#ffffff', depth: 12 },
    pattern: 'cake',
    soil: { light: '#c98a5a', dark: '#8a5434', speck: '#ff7ab8', rim: '#4d2a17' },
    decor: ['cane', 'lolly', 'gumdrop', 'gumdrop'],
  },
  hollow: {
    id: 'hollow',
    name: 'Crystal Hollow',
    blurb: 'A mountain full of glowing caves',
    emoji: '💎',
    gravity: 1,
    windMax: 3,
    liquidY: 860,
    liquid: { kind: 'water', top: '#7a6bff', deep: '#22186b', name: 'the underground lake' },
    sky: ['#1d1846', '#3c2f7a', '#7b5fc2'],
    sun: { kind: 'moon', color: '#e8e2ff', x: 0.15, y: 0.14, r: 30 },
    far: { kind: 'stalactites', near: '#2e2560', far: '#3d3278' },
    clouds: null,
    ambient: 'motes',
    top: { color: '#5d8f6e', hi: '#93d1a3', depth: 6 },
    pattern: 'crystal',
    soil: { light: '#5a5378', dark: '#2f2a49', speck: '#7ff2ff', rim: '#16132a' },
    decor: ['crystal', 'crystal', 'mushroom', 'rock'],
  },
  graves: {
    id: 'graves',
    name: 'Gloomwood Graves',
    blurb: 'Moonlit hills with crumbling overhangs',
    emoji: '🎃',
    gravity: 1,
    windMax: 7,
    liquidY: 860,
    liquid: { kind: 'sludge', top: '#7cff9a', deep: '#14532d', name: 'the bog' },
    sky: ['#120c2a', '#2e1f57', '#5b3d85'],
    sun: { kind: 'moon', color: '#fff6d6', x: 0.74, y: 0.16, r: 48 },
    far: { kind: 'spires', near: '#24183f', far: '#33245a' },
    clouds: '#3b2d63',
    ambient: 'fireflies',
    top: { color: '#3f6b3a', hi: '#6c9a55', depth: 7 },
    pattern: 'shale',
    soil: { light: '#5a4a5e', dark: '#33283a', speck: '#85738a', rim: '#17111c' },
    decor: ['tomb', 'tomb', 'deadtree', 'pumpkin', 'tuft'],
  },
  scrap: {
    id: 'scrap',
    name: 'Rustbelt Yard',
    blurb: 'Blocky scrap heaps and hanging girders',
    emoji: '🏭',
    gravity: 1,
    windMax: 8,
    liquidY: 860,
    liquid: { kind: 'sludge', top: '#b6f23a', deep: '#3c5a0c', name: 'the sludge' },
    sky: ['#6f7f8f', '#b3a58c', '#e8cf9e'],
    sun: { kind: 'sun', color: '#ffe2a8', x: 0.3, y: 0.24, r: 60 },
    far: { kind: 'stacks', near: '#6a6560', far: '#8c857a' },
    clouds: '#cfc4b2',
    ambient: 'smog',
    top: { color: '#8a8f96', hi: '#c6ccd3', depth: 5 },
    pattern: 'metal',
    soil: { light: '#9a6b4b', dark: '#5e3d2a', speck: '#c98a4e', rim: '#2b1c13' },
    decor: ['barrel', 'tire', 'pipe', 'barrel'],
  },
};

export const terrainList = (): TerrainDef[] => TERRAIN_IDS.map((id) => TERRAINS[id]);
