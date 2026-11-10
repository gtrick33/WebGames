/**
 * The world's one scale (the way the great RPGs keep theirs: everything is measured against the hero). A hero is 36
 * world pixels tall, and each prop is sized in world pixels: a crate comes to the knee, a barrel to the hip, a door a
 * head over, a lamp post over the head, a tower over everything. It takes the largest size that keeps within w (across
 * the view), d (deep) and h (tall). `flat` things lie on the ground; those with no model (`m: ''`) are only a rule.
 */
export interface PropDef {
  m: string;
  w?: number;
  d?: number;
  h?: number;
  /** Turned so that its long side runs across the view. */
  across?: boolean;
  tint?: string;
  flame?: number;
  /** How high the fire burns, in world pixels. */
  flameAt?: number;
  /** Stretches to fill w and d. */
  flat?: boolean;
  /** A small warm light over it (a candle). */
  glow?: string;
  /** How far it lights the dark at night, in tiles (a lantern: what burns has this from its fire). */
  light?: number;
  /** Stretches to fill w, d and h (a plinth). */
  box?: boolean;
  /** A stone hero this tall stands on it. */
  hero?: number;
}

export const PROPS: Record<string, PropDef> = {
  // the road and the yard
  lamp: { m: 'built_lamp', w: 18, d: 18, h: 50, glow: '#ffc060', light: 5 },
  lantern: { m: 'built_lantern', w: 12, d: 12, h: 18, glow: '#ffc060', light: 3 },
  // a barrow's grave-lamp: no light of its own, a fight's effects light it (sim/patterns/barrow-of-kings.ts)
  'grave-lamp': { m: 'post_lantern', w: 14, d: 14, h: 40, tint: '#a8a4b0' },
  torch: { m: 'built_torch', w: 12, d: 12, h: 32, flame: 0.62, flameAt: 32 },
  'iron-torch': { m: 'built_iron_torch', w: 12, d: 12, h: 32, flame: 0.62, flameAt: 32 },
  brazier: { m: 'bucket', w: 18, d: 18, h: 20, tint: '#7c7a8a', flame: 1, flameAt: 20 },
  campfire: { m: 'campfire_stones', w: 26, d: 26, h: 12, tint: '#8a8074', flame: 1.1, flameAt: 6 },
  barrel: { m: 'p_barrel', w: 16, d: 16, h: 20 },
  crate: { m: 'p_crate_A_big', w: 18, d: 18, h: 16 },
  sacks: { m: 'built_sacks', w: 20, d: 18, h: 12 },
  basket: { m: 'built_basket', w: 14, d: 14, h: 10 },
  bucket: { m: 'bucket', w: 10, d: 10, h: 9 },
  'clay-pot': { m: 'barrel_small', w: 11, d: 11, h: 13, tint: '#c88a5c' },
  pot: { m: 'barrel_small', w: 11, d: 11, h: 13, tint: '#c88a5c' },
  urn: { m: 'barrel_small', w: 15, d: 15, h: 20, tint: '#c8a060' },
  cauldron: { m: 'bucket', w: 20, d: 20, h: 15, tint: '#55525f' },
  fish: { m: 'p_trough', w: 24, d: 16, h: 9, tint: '#c8d8d8' },
  woodpile: { m: 'built_woodpile', w: 28, d: 22, h: 18 },
  log: { m: 'built_log', w: 30, d: 12, h: 9 },
  stump: { m: 'stump_round', w: 16, d: 16, h: 10, tint: '#a88a66' },
  'chopping-block': { m: 'stump_round', w: 16, d: 16, h: 11, tint: '#a88a66' },
  hay: { m: 'p_haybale', w: 24, d: 24, h: 18, tint: '#f0e2b8' },
  planter: { m: 'built_planter', w: 22, d: 16, h: 14 },
  flowerbed: { m: 'built_flowerbed', w: 26, d: 20, h: 10 },
  flowers: { m: 'flower_redA', w: 16, d: 16, h: 9 },
  topiary: { m: 'Bush_3_A', w: 22, d: 22, h: 22 },
  scarecrow: { m: 'built_scarecrow', w: 30, d: 14, h: 38 },
  wheat: { m: 'crops_wheatStageB', w: 20, d: 18, h: 16, tint: '#e8c860' },
  corn: { m: 'crops_cornStageD', w: 14, d: 14, h: 34 },
  pumpkin: { m: 'pumpkin_orange', w: 14, d: 14, h: 11 },
  notice: { m: 'sign', w: 26, d: 12, h: 32 },
  'danger-sign': { m: 'sign_both', w: 26, d: 12, h: 32 },
  target: { m: 'p_target', w: 24, d: 12, h: 30 },
  trough: { m: 'p_trough', w: 32, d: 16, h: 11, across: true },
  bench: { m: 'bench', w: 30, d: 14, h: 13, across: true },
  anvil: { m: 'anvil', w: 18, d: 14, h: 14 },
  'weapon-rack': { m: 'p_weaponrack', w: 30, d: 12, h: 28, across: true },
  rack: { m: 'p_weaponrack', w: 28, d: 12, h: 26, across: true },
  'armor-stand': { m: 'built_armor_stand', w: 22, d: 16, h: 30 },
  block: { m: '' },
  well: { m: 'built_well', w: 40, d: 40, h: 50 },
  'market-stall': { m: 'b_market', w: 74, d: 56, h: 46 },
  fountain: { m: 'built_fountain', w: 56, d: 56, h: 52 },
  // camps and the things of the land
  tent: { m: 'b_tent', w: 46, d: 46, h: 42 },
  'camp-tent': { m: 'tent_detailedOpen', w: 46, d: 46, h: 36, tint: '#d8c8a8' },
  pavilion: { m: 'b_tent', w: 60, d: 60, h: 52, tint: '#f0dcb4' },
  bedroll: { m: 'built_bedroll', w: 18, d: 30, h: 6 },
  'market-cart': { m: 'p_cart_merchant', w: 44, d: 34, h: 42, across: true },
  'market-goods': { m: 'p_crate_open', w: 20, d: 20, h: 14 },
  cart: { m: 'wagon', w: 44, d: 28, h: 28, across: true },
  wagon: { m: 'wagon_hay', w: 52, d: 32, h: 34, across: true },
  boat: { m: 'p_boat', w: 57, d: 30, h: 26, across: true },
  wreck: { m: 'p_boat', w: 64, d: 34, h: 30, across: true, tint: '#88807a' },
  // towers stand over everything: stone ones on a wall, a wooden lookout in a camp
  watchtower: { m: 'b_tower_A', w: 74, d: 74, h: 158 },
  lookout: { m: 'b_watchtower', w: 66, d: 66, h: 110 },
  windmill: { m: 'b_windmill', w: 96, d: 96, h: 180 },
  flag: { m: 'built_flag_red', w: 28, d: 12, h: 64 },
  'blue-banner': { m: 'built_flag_blue', w: 28, d: 12, h: 64 },
  'red-banner': { m: 'built_flag_red', w: 28, d: 12, h: 64 },
  'skull-banner': { m: 'built_skull_banner', w: 28, d: 12, h: 66 },
  // the dead
  gravestone: { m: 'gravestone', w: 18, d: 12, h: 22 },
  'grave-cross': { m: 'cross', w: 18, d: 10, h: 26, tint: '#b8b4a8' },
  coffin: { m: 'coffin', w: 18, d: 32, h: 11 },
  sarcophagus: { m: 'coffin', w: 24, d: 38, h: 18, tint: '#9a96a0' },
  bones: { m: 'bone_A', w: 16, d: 16, h: 5, tint: '#c8c0a8' },
  'bone-heap': { m: 'ribcage', w: 24, d: 24, h: 14 },
  skulls: { m: 'skull', w: 9, d: 9, h: 8, tint: '#c8c0a8' },
  debris: { m: 'debris-wood', w: 26, d: 26, h: 8, tint: '#d0b898' },
  rubble: { m: 'debris', w: 26, d: 26, h: 9, tint: '#8c8680' },
  'rubble-heap': { m: 'rubble_half', w: 44, d: 36, h: 28 },
  menhir: { m: 'stone_tallA', w: 26, d: 26, h: 62, tint: '#a09c92' },
  'standing-stone': { m: 'statue_obelisk', w: 28, d: 28, h: 78, tint: '#a8a49a' },
  crystals: { m: 'stone_tallA', w: 30, d: 30, h: 46, tint: '#c8a8ff' },
  cage: { m: 'built_cage', w: 28, d: 24, h: 32 },
  eggs: { m: 'built_eggs', w: 15, d: 13, h: 8 },
  altar: { m: 'altar-stone', w: 48, d: 26, h: 22, across: true, tint: '#b4b0a4' },
  // deep places
  'broken-column': { m: 'column', w: 24, d: 24, h: 36 },
  'great-column': { m: 'built_great_column', w: 42, d: 38, h: 118, box: true },
  'tall-column': { m: 'pillar', w: 34, d: 34, h: 104, box: true, tint: '#a8a6b0' },
  'mossy-column': { m: 'pillar', w: 34, d: 34, h: 96, box: true, tint: '#8aa080' },
  'sand-column': { m: 'built_great_column', w: 42, d: 38, h: 118, box: true, tint: '#e0c088' },
  'ice-column': { m: 'pillar', w: 36, d: 36, h: 104, box: true, tint: '#b8dcf4' },
  'black-column': { m: 'built_great_column', w: 42, d: 38, h: 124, box: true, tint: '#5a5664' },
  'crates-stack': { m: 'crates_stacked', w: 34, d: 34, h: 34 },
  'big-barrel': { m: 'barrel_large', w: 26, d: 26, h: 30 },
  trunk: { m: 'trunk_large_A', w: 26, d: 22, h: 18 },
  'coal-heap': { m: 'rocks', w: 34, d: 34, h: 18, tint: '#7a7480' },
  'stone-heap': { m: 'p_resource_stone', w: 30, d: 30, h: 20 },
  'lumber-pile': { m: 'p_resource_lumber', w: 44, d: 22, h: 14 },
  'banner-red': { m: 'banner_red', w: 26, d: 10, h: 52 },
  'banner-blue': { m: 'banner_blue', w: 26, d: 10, h: 52 },
  'banner-shield': { m: 'banner_shield_red', w: 32, d: 12, h: 52 },
  'coin-pile': { m: 'coin_stack_medium', w: 20, d: 20, h: 11 },
  'gold-chest': { m: 'chest_large_gold', w: 30, d: 24, h: 20 },
  'ice-crystal': { m: 'stone_tallA', w: 32, d: 32, h: 58, tint: '#a8d8ff' },
  'rift-crystal': { m: 'stone_tallA', w: 32, d: 32, h: 58, tint: '#b078ff' },
  'ember-rock': { m: 'Rock_4_C', w: 26, d: 26, h: 58, tint: '#6a3a30' },
  'root-tangle': { m: 'Tree_Bare_2_B', w: 40, d: 26, h: 66, tint: '#5a4a3a' },
  'great-mushroom': { m: 'mushroom_redTall', w: 28, d: 28, h: 46 },
  spores: { m: 'mushroom_redGroup', w: 24, d: 24, h: 14 },
  thorns: { m: 'Bush_4_D', w: 40, d: 30, h: 18, tint: '#a07a9a' },
  // what a land is known by, seen from far off
  'ancient-oak': { m: 'Tree_7_B', w: 130, d: 130, h: 250 },
  'ancient-pine': { m: 'tree_pine_orange_large', w: 130, d: 130, h: 220 },
  'dead-colossus': { m: 'tree_dead_large', w: 110, d: 80, h: 230, tint: '#6a5a50' },
  lighthouse: { m: 'b_tower_B', w: 84, d: 84, h: 200 },
  'water-mill': { m: 'b_watermill', w: 110, d: 110, h: 130 },
  'lumber-mill': { m: 'b_lumbermill', w: 120, d: 110, h: 130 },
  'mine-head': { m: 'b_mine', w: 130, d: 130, h: 100 },
  docks: { m: 'b_docks', w: 150, d: 50, h: 60 },
  'broken-tower': { m: 'b_tower_base', w: 96, d: 96, h: 140, tint: '#a8a4a0' },
  'ruined-hall': { m: 'rubble_large', w: 190, d: 76, h: 76 },
  'giant-statue': { m: 'statue_block', w: 96, d: 96, h: 34, box: true, tint: '#8a8a90', hero: 170 },
  'great-obelisk': { m: 'statue_obelisk', w: 70, d: 70, h: 210, tint: '#a8a49a' },
  'stone-arch': { m: 'arch', w: 130, d: 30, h: 136 },
  'crypt-hill': { m: 'crypt', w: 130, d: 150, h: 170 },
  'bone-arch': { m: 'ribcage', w: 170, d: 150, h: 170, tint: '#d8d0b8' },
  'giant-skull': { m: 'skull', w: 110, d: 110, h: 104, tint: '#d8d0b8' },
  'ice-spire': { m: 'stone_tallA', w: 90, d: 80, h: 190, tint: '#b8dcff' },
  'rift-spire': { m: 'stone_tallA', w: 90, d: 80, h: 190, tint: '#a868f0' },
  'lava-spire': { m: 'Rock_4_C', w: 70, d: 70, h: 200, tint: '#5a2a24' },
  'sand-spire': { m: 'Rock_4_C', w: 70, d: 70, h: 180, tint: '#c8a070' },
  'sea-rock': { m: 'Rock_3_G', w: 120, d: 110, h: 110 },
  'great-mushroom-tree': { m: 'mushroom_redTall', w: 90, d: 90, h: 190 },
  'great-wreck': { m: 'p_boat', w: 200, d: 110, h: 70, across: true, tint: '#88807a' },
  // indoors
  table: { m: 'table_medium', w: 32, d: 24, h: 17, across: true },
  longtable: { m: 'table_long_tablecloth_decorated_A', w: 84, d: 28, h: 20, across: true },
  'war-table': { m: 'table_long_decorated_B', w: 84, d: 34, h: 22, across: true },
  counter: { m: 'bartop_A_large', w: 84, d: 26, h: 24, across: true },
  chair: { m: 'chair', w: 14, d: 14, h: 20 },
  stool: { m: 'stool', w: 11, d: 11, h: 10 },
  pew: { m: 'bench', w: 78, d: 18, h: 14, across: true },
  bed: { m: 'bed_decorated', w: 26, d: 46, h: 18 },
  cot: { m: 'built_bedroll', w: 24, d: 40, h: 9 },
  shelf: { m: 'shelves_decorated', w: 40, d: 14, h: 40, across: true },
  bookshelf: { m: 'bookcase_double_decoratedA', w: 38, d: 14, h: 46, across: true },
  cupboard: { m: 'cabinet_medium_decorated', w: 32, d: 16, h: 38, across: true },
  casks: { m: 'keg', w: 50, d: 24, h: 24, across: true },
  keg: { m: 'keg', w: 18, d: 18, h: 18 },
  candles: { m: 'candle_triple', w: 9, d: 9, h: 9, tint: '#c8b890', glow: '#ffc060' },
  rug: { m: 'rug_rectangle_A', w: 68, d: 42, flat: true },
  runner: { m: 'rug_rectangle_A', w: 78, d: 26, flat: true, tint: '#b8504a' },
  banner: { m: 'banner_white', w: 24, d: 10, h: 46 },
  'great-banner': { m: 'banner_triple_red', w: 44, d: 12, h: 62 },
  column: { m: 'pillar', w: 24, d: 24, h: 70 },
  statue: { m: 'statue_block', w: 30, d: 30, h: 12, box: true, tint: '#8a8a90', hero: 46 },
  lion: { m: 'statue_block', w: 24, d: 24, h: 9, box: true, tint: '#8a8a90', hero: 30 },
  throne: { m: 'built_throne', w: 28, d: 26, h: 36 },
  'high-throne': { m: 'built_throne', w: 42, d: 34, h: 52 },
  // the Hallow King's seat on its dais (render3d/propsBuilt.ts frozenThrone)
  'frozen-throne': { m: 'built_frozen_throne', w: 132, d: 60, h: 150, glow: '#bfe4ff' },
  // the banner of the house of Vaelmoor, as it stands in Duskspire still: white, the color gone out of it
  'royal-banner': { m: 'built_flag_royal', w: 30, d: 12, h: 70 },
  hearth: { m: 'campfire_bricks', w: 62, d: 26, h: 16, across: true, tint: '#9a8e80', flame: 1.3, flameAt: 8 },
  forge: { m: 'campfire_bricks', w: 46, d: 26, h: 18, across: true, tint: '#a09aa8', flame: 1.2, flameAt: 12 },
  grindstone: { m: 'grindstone', w: 20, d: 18, h: 22 },
  stair: { m: 'stairs', w: 30, d: 30, h: 26 },
  // light and floor: the land's own colors do these
  window: { m: '' },
  sunbeam: { m: '' },
  'bell-rope': { m: '' },
  'hall-floor': { m: '' },
  dais: { m: '' },
  // (a marker for a whole great work: greatworks.ts)
  great: { m: '' },
  chickens: { m: '' },
};

/** Less than the size a model may fill: what its body takes up on the ground, across and deep (thin things). */
const BODIES: Record<string, [number, number]> = {
  lamp: [4, 4],
  lantern: [4, 4],
  'grave-lamp': [6, 6],
  torch: [4, 4],
  'iron-torch': [4, 4],
  flag: [4, 4],
  'blue-banner': [4, 4],
  'red-banner': [4, 4],
  'skull-banner': [4, 4],
  'royal-banner': [4, 4],
  'frozen-throne': [112, 43],
  'banner-red': [16, 5],
  'banner-blue': [16, 5],
  'banner-shield': [18, 6],
  banner: [16, 5],
  'great-banner': [30, 4],
  notice: [16, 5],
  'danger-sign': [16, 5],
  target: [18, 6],
  scarecrow: [8, 6],
  cage: [24, 10],
  'armor-stand': [14, 10],
  'grave-cross': [9, 6],
  gravestone: [15, 5],
  'broken-column': [18, 18],
  column: [16, 16],
  // what's up in the air isn't in the way: a tree is its trunk, a windmill its tower, a mushroom its stem
  'ancient-oak': [40, 30],
  'ancient-pine': [46, 36],
  'dead-colossus': [34, 26],
  'great-mushroom-tree': [22, 18],
  'great-mushroom': [8, 7],
  'root-tangle': [8, 6],
  windmill: [54, 46],
};

/**
 * What a model really takes up on the ground when it's sized to its line above, where that's short of its box (a model
 * keeps its own shape, so it fills one side of the box and not the other): measured off the packs, and it's what a body
 * goes by, so nobody bumps into air beside a cart. (tests/sigilfall-props.test.ts checks these against the packs.)
 */
const FILLED: Record<string, [number, number]> = {
  campfire: [26, 25],
  crate: [16, 16],
  sacks: [20, 16],
  cauldron: [16, 16],
  fish: [16, 16],
  woodpile: [26, 19],
  log: [25, 7],
  stump: [14, 16],
  'chopping-block': [14, 16],
  hay: [24, 13],
  trough: [16, 16],
  bench: [30, 13],
  anvil: [18, 8],
  'weapon-rack': [18, 12],
  rack: [18, 12],
  'market-stall': [74, 54],
  tent: [46, 41],
  'camp-tent': [46, 35],
  pavilion: [60, 53],
  'market-cart': [44, 22],
  'market-goods': [20, 12],
  cart: [44, 26],
  boat: [57, 29],
  wreck: [64, 32],
  watchtower: [64, 74],
  coffin: [17, 25],
  sarcophagus: [24, 36],
  'rubble-heap': [32, 24],
  menhir: [26, 18],
  crystals: [30, 21],
  altar: [41, 26],
  'crates-stack': [32, 34],
  'coal-heap': [33, 32],
  'stone-heap': [30, 25],
  'gold-chest': [29, 24],
  'ice-crystal': [32, 22],
  'rift-crystal': [32, 22],
  'ember-rock': [20, 20],
  lighthouse: [73, 84],
  'water-mill': [97, 102],
  'lumber-mill': [104, 91],
  'mine-head': [109, 130],
  docks: [83, 21],
  'broken-tower': [80, 96],
  'ruined-hall': [177, 69],
  'crypt-hill': [113, 150],
  'giant-skull': [106, 105],
  'ice-spire': [90, 63],
  'rift-spire': [90, 63],
  'lava-spire': [68, 68],
  'sand-spire': [61, 61],
  'sea-rock': [102, 95],
  'great-wreck': [200, 100],
  table: [24, 24],
  longtable: [42, 22],
  'war-table': [47, 23],
  counter: [44, 8],
  chair: [12, 12],
  pew: [42, 18],
  bed: [26, 30],
  cot: [19, 40],
  shelf: [33, 12],
  bookshelf: [38, 7],
  casks: [23, 21],
  keg: [16, 18],
  throne: [25, 20],
  'high-throne': [36, 28],
  hearth: [26, 26],
  forge: [26, 26],
  grindstone: [15, 18],
  stair: [25, 20],
};

/** Arches: you walk under them, and only their feet are in the way ([east of the middle, south of it, across, deep]). */
export const FEET: Record<string, readonly (readonly [number, number, number, number])[]> = {
  'stone-arch': [[-50, 0, 22, 20], [50, 0, 22, 20]],
  'bone-arch': [[-62, 0, 26, 40], [62, 0, 26, 40]],
};

/** Things you walk through or over: they lie on the ground, or bend. */
const UNDERFOOT = new Set(['flowers', 'wheat', 'corn', 'bones', 'skulls', 'debris', 'rubble', 'eggs', 'candles', 'rug', 'runner', 'spores', 'bedroll', 'coin-pile', 'planter', 'flowerbed', 'bone-heap', 'thorns']);

/** Share of what a model may fill that its body takes up: it's rarely square to its box, and never to its corners. */
const FILLS = 0.84;

/**
 * What a prop blocks, in world pixels across and deep, centered on its tile: what's there to bump into. Null for what
 * has no body to bump into (what lies flat or underfoot, or is only a rule).
 */
export function propBody(full: string): { w: number; d: number } | null {
  const name = full.split(':')[0]!;
  const def = PROPS[name];
  if (!def || !def.m || def.flat || UNDERFOOT.has(name)) return null;
  const own = BODIES[name];
  if (own) return { w: own[0], d: own[1] };
  const filled = FILLED[name];
  return { w: (filled?.[0] ?? def.w ?? 26) * FILLS, d: (filled?.[1] ?? def.d ?? 26) * FILLS };
}

/** Tall enough to walk into, whatever its marker says: below this a walker steps over it unless it's marked solid. */
const STANDS_FROM = 12;

/** Whether a prop stands up in anyone's way, solid-marked or not. */
export const propStandsUp = (name: string): boolean => (PROPS[name.split(':')[0]!]?.h ?? 0) >= STANDS_FROM && propBody(name) !== null;

/** How much of the ground a prop's model may fill (at most), across and deep. */
export const propReach = (name: string): { w: number; d: number } | null => {
  const def = PROPS[name.split(':')[0]!];
  return def && def.m && !def.flat ? { w: def.w ?? 26, d: def.d ?? 26 } : null;
};
