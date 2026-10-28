import type { Theme } from '../../data/types';
import type { Derived, Grade, Season } from './atlas';

/**
 * Every outdoor land drawn in one art language: Royal Keep (VISUAL_BIBLE.md §1, §3). A land is the pack in a
 * season (summer, its own autumn and winter repaints) with a grade over it (its color treatment), its ground
 * sets, and its trees, plants and stones picked from the pack. Sand, tilled soil, ash and mud are the pack's
 * dirt with a grade (`derived`), so a desert or a swamp is still the same hand.
 *
 * A piece is a Royal Keep prop name ('tree_big_leaf'), 'anim:<name>' for its animated props, or 'gc:<name>'
 * for the few things the pack doesn't have (skulls, bones, cages, crystals; Gloomvault, ASSET_AUDIT.md).
 */

export interface Recipe {
  season: Season;
  /** The land's palette treatment on its ground and props (never on people). */
  grade: Grade;
  /** On water only (murk, toxic, lava, ice). */
  water?: Grade;
  ground: {
    /** Open land: 'grass' (the pack's sixteen grass tiles), or a ground set's whole tiles ('sand', 'dgrass'). */
    base: string;
    /** Patches over the open land where a slow noise is high: a set and the share of the land it covers. */
    patches: { set: string; share: number; size: number }[];
    /** The ground under woods and boulder fields, spilling a little past their edge. */
    under: string;
    /** Roads, sand (beaches, dunes), squares, and farm fields (Deco inside a fence). */
    path: string;
    sand: string;
    cobble: string;
    field: string;
    /** Wooden or stone bridges. */
    bridge: 'bridge' | 'sbridge';
    /** Small things in the grass (the pack's decals): which, and how many per 100 open tiles. */
    decals: string[];
    decalRate: number;
  };
  trees: string[];
  bushes: string[];
  rocks: string[];
  /** Small, never-solid plants about the open land (flowers, tall grass, mushrooms, hay). */
  flora: string[];
  /** Map edges and woods: a forest of trees, or a field of boulders (bare lands). */
  edge: 'forest' | 'rocks';
  /** What a ruin's standing stones are in this land (pillars by default): graves, statues, crystals. */
  ruins?: string[];
}

/** Ground sets made from the pack's dirt: sand, tilled soil, ash and mud. */
export const DERIVED: Derived[] = [
  { name: 'sand', from: 'dirt', grade: { tint: ['#f2dca4', 0.6], bright: 0.05, sat: 0.9 } },
  { name: 'soil', from: 'dirt', grade: { tint: ['#6e4a2e', 0.45], bright: -0.1 } },
  { name: 'ash', from: 'dirt', grade: { tint: ['#8a8480', 0.7], bright: -0.04 } },
  { name: 'mud', from: 'dirt', grade: { tint: ['#5a5634', 0.55], bright: -0.12 } },
];

const LEAFY = ['tree_big_leaf', 'tree_mid_leaf', 'tree_big2_leaf', 'tree_mid_mint', 'tree_big_mint', 'tree_small_leaf', 'tree_tall_leaf'];
const BUSHES = ['bush_leaf', 'bush_mint', 'bush_berry', 'bush_leaf', 'bush_wide'];
const ROCKS = ['rock_2', 'rock_3', 'rock_4', 'rock_mossy_1', 'rock_3'];
const BOULDERS = ['rock_5', 'rock_tall', 'rock_mossy_2', 'rock_4'];
const MEADOW = ['tall_grass_1', 'tall_grass_2', 'tall_grass_3', 'flowers_yellow', 'flowers_white', 'flowers_red', 'flowers_violet', 'flowers_blue', 'flowers_pink', 'mushroom_brown', 'mushroom_red', 'stump', 'log'];
const DECALS = ['decal_tuft_1', 'decal_tuft_2', 'decal_tuft_3', 'decal_flowers_1', 'decal_flowers_2', 'decal_flowers_3', 'decal_clover_1', 'decal_clover_2', 'decal_pebbles_1', 'decal_leaves_1'];
const BARE_DECALS = ['decal_pebbles_1', 'decal_pebbles_2', 'decal_pebbles_3', 'decal_crack_1', 'decal_tuft_1', 'decal_worn_1'];
const DEAD = ['tree_dead', 'tree_dead', 'pine_mid', 'tree_small_amber'];

const land = (season: Season, over: Partial<Omit<Recipe, 'ground'>> = {}, ground: Partial<Recipe['ground']> = {}): Recipe => ({
  season,
  grade: {},
  trees: LEAFY,
  bushes: BUSHES,
  rocks: ROCKS,
  flora: MEADOW,
  edge: 'forest',
  ...over,
  ground: {
    base: 'grass',
    patches: [
      { set: 'lgrass', share: 0.2, size: 9 },
      { set: 'dgrass', share: 0.07, size: 7 },
    ],
    under: 'dgrass',
    path: 'dirt',
    sand: 'sand',
    cobble: 'cobble',
    field: 'soil',
    bridge: 'bridge',
    decals: DECALS,
    decalRate: 9,
    ...ground,
  },
});

/** A wetland: dark grass and mud, still water, reeds and dead wood. */
const wet = (season: Season, over: Partial<Omit<Recipe, 'ground'>> = {}, ground: Partial<Recipe['ground']> = {}): Recipe =>
  land(
    season,
    {
      trees: ['tree_dead', 'tree_tall_mint', 'tree_mid_teal', 'pine_mid_green', 'tree_dead', 'tree_big_teal'],
      bushes: ['bush_teal', 'bush_mint', 'bush_small_teal', 'bush_wide'],
      rocks: ['rock_mossy_1', 'rock_mossy_2', 'rock_3'],
      flora: ['reeds', 'reeds_2', 'tall_grass_2', 'tall_grass_3', 'mushroom_brown', 'mushroom_blue', 'log', 'stump'],
      ...over,
    },
    { base: 'dgrass', patches: [{ set: 'mud', share: 0.2, size: 7 }, { set: 'lgrass', share: 0.1, size: 9 }], under: 'dgrass', sand: 'mud', decals: ['decal_moss_1', 'decal_moss_2', 'decal_puddle_1', 'decal_tuft_2', 'decal_leaves_2'], decalRate: 8, ...ground },
  );

/** A bare land: stone and dry ground, boulders at the edges, a few hardy trees. */
const bare = (season: Season, over: Partial<Omit<Recipe, 'ground'>> = {}, ground: Partial<Recipe['ground']> = {}): Recipe =>
  land(
    season,
    { edge: 'rocks', trees: ['pine_big', 'pine_mid', 'pine_small', 'tree_dead'], bushes: ['bush_small_leaf', 'bush_amber'], rocks: [...ROCKS, ...BOULDERS], flora: ['tall_grass_1', 'tall_grass_3', 'rock_1', 'stump'], ...over },
    { patches: [{ set: 'dirt', share: 0.2, size: 8 }, { set: 'lgrass', share: 0.08, size: 9 }], under: 'dirt', decals: BARE_DECALS, decalRate: 7, ...ground },
  );

export const RECIPES: Partial<Record<Theme, Recipe>> = {
  // Emberwick, the Crown City: the pack's own summer, as it was drawn
  village: land('summer', { trees: ['tree_big_leaf', 'tree_mid_leaf', 'tree_apple', 'tree_mid_mint', 'tree_blossom', 'tree_small_leaf'], bushes: ['bush_rose', 'bush_leaf', 'bush_mint', 'bush_berry'] }, { bridge: 'sbridge' }),
  // Briarhollow and the farms: orchards and hay
  farm: land('summer', { trees: ['tree_apple', 'tree_big_leaf', 'tree_mid_leaf', 'tree_orange', 'tree_big2_leaf', 'tree_mid_mint', 'tree_blossom', 'tree_big_leaf'], flora: [...MEADOW, 'hay_pile', 'flowers_yellow'] }),
  plains: land('summer', { grade: { tint: ['#f0d860', 0.1], sat: 1.02 }, trees: ['tree_big_leaf', 'tree_mid_mint', 'tree_apple', 'tree_small_leaf', 'tree_big_coral', 'tree_big2_leaf', 'tree_big_leaf', 'tree_mid_leaf', 'tree_big2_leaf'], flora: [...MEADOW, 'hay_pile', 'hay_bale'] }, { patches: [{ set: 'lgrass', share: 0.3, size: 10 }, { set: 'dirt', share: 0.05, size: 6 }] }),
  forest: land('summer', { grade: { bright: -0.06, tint: ['#1a4a30', 0.08] }, trees: ['tree_big_teal', 'tree_big2_leaf', 'tree_tall_leaf', 'pine_big_green', 'pine_mid_green', 'tree_big_leaf', 'tree_mid_teal', 'tree_big_amber', 'tree_big_leaf'], bushes: ['bush_teal', 'bush_leaf', 'bush_mint', 'bush_wide'] }, { patches: [{ set: 'dgrass', share: 0.32, size: 8 }, { set: 'lgrass', share: 0.08, size: 9 }] }),
  coast: land('summer', { trees: ['tree_mid_mint', 'tree_tall_mint', 'pine_mid_green', 'tree_small_mint'], flora: ['tall_grass_1', 'tall_grass_2', 'reeds', 'flowers_white', 'flowers_blue', 'rock_1'] }, { patches: [{ set: 'sand', share: 0.2, size: 8 }, { set: 'lgrass', share: 0.14, size: 9 }] }),
  autumn: land('autumn', { trees: ['tree_big_amber', 'tree_big_coral', 'tree_mid_amber', 'tree_mid_coral', 'tree_orange', 'tree_tall_coral', 'tree_big2_coral'], bushes: ['bush_amber', 'bush_coral', 'bush_berry', 'bush_wide'] }),
  fey: land('summer', { grade: { hue: -8, sat: 1.06 }, ruins: ['pillar', 'pillar_broken', 'gc:cyan_crystals'], trees: ['tree_blossom', 'tree_big_teal', 'tree_mid_teal', 'tree_big_mint', 'tree_blossom', 'tree_tall_mint'], bushes: ['bush_blue', 'bush_teal', 'bush_rose', 'bush_mint'], flora: ['flowers_violet', 'flowers_blue', 'flowers_pink', 'mushroom_blue', 'mushroom_red', 'tall_grass_2', 'flowers_white'] }),
  jungle: land('summer', { grade: { sat: 1.1, bright: -0.04 }, ruins: ['pillar_broken', 'statue_archer', 'pillar'], trees: ['tree_big2_mint', 'tree_big_teal', 'tree_tall_mint', 'tree_big_leaf', 'tree_big2_leaf'], bushes: ['bush_teal', 'bush_mint', 'bush_wide', 'bush_leaf'] }, { patches: [{ set: 'dgrass', share: 0.35, size: 7 }] }),
  mountain: bare('summer', { grade: { sat: 0.85, tint: ['#9ab0c0', 0.08] }, ruins: ['pillar_broken', 'rock_tall', 'pillar'] }),
  storm: bare('summer', { grade: { sat: 0.76, bright: -0.04, tint: ['#6a8aa8', 0.14] }, ruins: ['pillar_broken', 'pillar', 'rock_tall'] }, {}),
  desert: bare('summer', { grade: { tint: ['#f0c070', 0.08] }, ruins: ['pillar_broken', 'pillar', 'statue_king'], trees: ['tree_dead', 'tree_small_amber', 'tree_dead'], bushes: ['bush_amber', 'bush_small_amber'], rocks: ['rock_sand', 'rock_4', 'rock_3', 'rock_sand'], flora: ['tall_grass_1', 'rock_sand', 'bush_small_amber', 'rock_1', 'tall_grass_3', 'rock_sand', 'gc:scattered_bones', 'tall_grass_1'] }, { base: 'sand', patches: [{ set: 'dirt', share: 0.14, size: 9 }], under: 'dirt' }),
  barrow: land('autumn', { grade: { sat: 0.5, bright: -0.08, tint: ['#4a4a5e', 0.22] }, edge: 'rocks', ruins: ['gravestone_1', 'grave_cross', 'gravestone_2', 'pillar_broken', 'gc:stone_coffin'], trees: DEAD, bushes: ['bush_small_amber', 'bush_amber'], rocks: [...ROCKS, ...BOULDERS], flora: ['tall_grass_1', 'tall_grass_3', 'rock_1', 'stump', 'mushroom_brown', 'tall_grass_1', 'grave_cross', 'log', 'rock_2', 'tall_grass_3'] }, { decals: BARE_DECALS }),
  // the moors: heather gone purple-brown, peat-dark pools, mist (THEMES dread)
  moor: land('autumn', { grade: { sat: 0.52, bright: -0.08, tint: ['#4a3458', 0.24] }, water: { tint: ['#3a4052', 0.45], bright: -0.05 }, edge: 'rocks', ruins: ['pillar_broken', 'gravestone_1', 'pillar'], trees: ['tree_dead', 'pine_mid', 'tree_small_coral'], rocks: [...ROCKS, ...BOULDERS] }),
  rift: land('autumn', { grade: { sat: 0.74, bright: -0.04, tint: ['#7a5aa8', 0.2] }, edge: 'rocks', ruins: ['gc:cyan_crystals', 'gc:cyan_crystals', 'pillar_broken'], trees: ['tree_dead', 'tree_small_coral'], rocks: BOULDERS, flora: ['tall_grass_1', 'rock_1', 'tall_grass_3', 'stump', 'mushroom_blue', 'rock_2', 'tall_grass_1', 'gc:cyan_crystals'] }, { decals: BARE_DECALS }),
  warfront: land('autumn', { grade: { sat: 0.7, bright: -0.05, tint: ['#9a7a5a', 0.12] }, edge: 'rocks', ruins: ['pillar_broken', 'gravestone_1', 'pillar_broken'], trees: ['tree_dead', 'tree_mid_amber', 'tree_small_amber', 'tree_dead'], rocks: [...ROCKS, ...BOULDERS], flora: ['tall_grass_1', 'tall_grass_3', 'log', 'stump', 'rock_1', 'gc:scattered_bones', 'tall_grass_1', 'rock_2'] }, { patches: [{ set: 'dirt', share: 0.22, size: 7 }, { set: 'ash', share: 0.06, size: 5 }], decals: BARE_DECALS }),
  snow: land('winter', { grade: {}, water: { tint: ['#a8d8f0', 0.4], bright: 0.08 }, trees: ['pine_snowy', 'pine_big', 'pine_mid', 'tree_big_leaf', 'pine_snowy'], bushes: ['bush_leaf', 'bush_small_leaf'], flora: ['tall_grass_1', 'rock_1', 'stump', 'log'] }, { patches: [{ set: 'lgrass', share: 0.12, size: 9 }], decals: ['decal_pebbles_1', 'decal_tuft_1', 'decal_tuft_2'], decalRate: 4 }),
  // a fen: dead trees standing in brown water, reeds, mist (THEMES dread)
  marsh: wet('autumn', { grade: { sat: 0.55, bright: -0.1, tint: ['#3a4424', 0.3] }, water: { tint: ['#4a5634', 0.45], bright: -0.06 }, trees: ['tree_dead', 'pine_mid', 'tree_dead', 'tree_small_amber', 'pine_big', 'tree_dead', 'tree_mid_amber'], ruins: ['pillar_broken', 'rock_mossy_2', 'gravestone_2'] }),
  // a sick fen: yellowed and dying, its water a poisonous green
  plague: wet('autumn', { grade: { sat: 0.5, bright: -0.1, tint: ['#5a6418', 0.3] }, water: { tint: ['#56862a', 0.5], bright: -0.06 }, trees: ['tree_dead', 'tree_dead', 'pine_mid', 'tree_small_amber', 'tree_dead', 'pine_big'], bushes: ['bush_small_amber', 'bush_amber', 'bush_wide'], ruins: ['pillar_broken', 'gc:skulls', 'gravestone_2'] }),
  blight: wet('autumn', { grade: { sat: 0.5, bright: -0.1, tint: ['#4a2a5a', 0.26] }, ruins: ['gravestone_2', 'gc:skulls', 'pillar_broken'], trees: ['tree_dead', 'tree_dead', 'tree_mid_coral', 'pine_mid', 'pine_big'] }),
  sunken: wet('summer', { grade: { sat: 0.75, bright: -0.06, tint: ['#3a8a8a', 0.18] }, water: { tint: ['#3a7a7a', 0.3] }, ruins: ['pillar_broken', 'statue_queen', 'pillar'] }),
  gloam: wet('summer', { grade: { sat: 0.66, bright: -0.06, tint: ['#2a6a5a', 0.2] }, water: { tint: ['#2a5a4a', 0.4], bright: -0.08 }, ruins: ['pillar_broken', 'gc:skulls', 'gravestone_1'] }),
  // the haunted wood: black pines and dead oaks under an evening that never lifts, lamps along the road,
  // graves in the clearings (THEMES dread)
  haunted: land('summer', { grade: { sat: 0.5, bright: -0.12, tint: ['#1c2a4a', 0.3] }, edge: 'forest', ruins: ['gravestone_1', 'grave_cross', 'gravestone_2', 'gc:stone_coffin'], trees: ['pine_big', 'tree_dead', 'pine_big', 'pine_mid', 'tree_dead', 'tree_big_teal', 'pine_big'], bushes: ['bush_teal', 'bush_small_teal', 'bush_wide'], flora: ['mushroom_blue', 'mushroom_brown', 'tall_grass_2', 'stump', 'log', 'tall_grass_3'] }, { base: 'dgrass', patches: [{ set: 'dirt', share: 0.1, size: 6 }, { set: 'mud', share: 0.06, size: 5 }], under: 'dgrass', decals: ['decal_leaves_1', 'decal_leaves_2', 'decal_pebbles_1', 'decal_moss_1'], decalRate: 7 }),
  volcanic: bare('autumn', { grade: { sat: 0.58, bright: -0.03, tint: ['#6a4436', 0.22] }, water: { hue: 150, tint: ['#ff7a2a', 0.7], bright: 0.08, sat: 1.4 }, ruins: ['pillar_broken', 'rock_tall', 'pillar_broken'], trees: ['tree_dead', 'tree_dead', 'pine_small'] }, { base: 'ash', patches: [{ set: 'dirt', share: 0.18, size: 8 }], under: 'ash' }),
  deadlake: land('winter', { grade: { sat: 0.4, bright: -0.1, tint: ['#2a3a4a', 0.26] }, water: { tint: ['#1a2a36', 0.5], bright: -0.14 }, edge: 'rocks', ruins: ['pillar_broken', 'gc:stone_coffin', 'gravestone_2'], trees: ['tree_dead', 'pine_mid', 'tree_dead'], rocks: [...ROCKS, ...BOULDERS], flora: ['tall_grass_1', 'tall_grass_3', 'rock_1', 'stump', 'log', 'mushroom_blue', 'tall_grass_1', 'rock_2'] }, { decals: BARE_DECALS, decalRate: 5 }),
  peaks: bare('winter', { ruins: ['pillar_broken', 'rock_tall', 'pillar'], trees: ['pine_snowy', 'pine_big', 'pine_mid', 'pine_snowy'], rocks: BOULDERS, flora: ['rock_1', 'stump'] }, { patches: [{ set: 'lgrass', share: 0.1, size: 9 }] }),
  bonefield: bare('autumn', { grade: { sat: 0.45, tint: ['#c0b08a', 0.18] }, ruins: ['pillar_broken', 'gravestone_2', 'pillar_broken'], flora: ['tall_grass_1', 'tall_grass_3', 'gc:scattered_bones', 'rock_1', 'tall_grass_1', 'log', 'gc:skulls', 'rock_2', 'bush_small_amber', 'tall_grass_3'] }, { patches: [{ set: 'dirt', share: 0.3, size: 8 }] }),
  pale: land('winter', { grade: { sat: 0.35, bright: 0.02, tint: ['#9a9ac0', 0.22] }, edge: 'rocks', ruins: ['gc:cyan_crystals', 'pillar_broken', 'statue_knight'], trees: ['tree_dead', 'pine_snowy', 'tree_dead'], rocks: BOULDERS, flora: ['rock_1', 'tall_grass_1', 'stump', 'rock_2', 'tall_grass_3', 'tall_grass_1'] }, { decals: BARE_DECALS, decalRate: 4 }),
};

/** Every piece a recipe names (for the art-integrity test). */
export const recipeRefs = (r: Recipe): string[] => [...r.trees, ...r.bushes, ...r.rocks, ...r.flora, ...(r.ruins ?? [])];
