import * as THREE from 'three';
import { hash2 } from '../core/math';
import { picBody } from '../data/buildingArt';
import { REGIONS } from '../data/regions';
import { GREAT, type GreatPart } from '../data/greatworks';
import { THEMES, type ThemeLook, type TreeKind } from '../data/themes';
import type { RegionDef } from '../data/types';
import { ART_TILE, K, TILE, type PlacedMarker, type TileMap } from '../sim/map';
import { hexRgb } from './kits';
import type { Colossus } from './cast';
import { loadPack, type MeshData, type Pack } from './pack';
import { LIGHT, shadowMaterial, staticMaterial } from './toon';
import { Stand } from './crowd';

/**
 * A land in 3D, from the same tile map the game's rules walk on: a painted ground (one draw call), solid blocks
 * for walls and cliffs, and trees, houses and furniture placed tile by tile. Only what is near the camera is
 * drawn, however big the land is.
 */

/** Tiles per world pixel. */
export const UNIT = 1 / TILE;
/** How far the camera looks down from level. */
export const PITCH = (50 * Math.PI) / 180;

export interface LandPacks {
  /** The people's parts and weapons: a giant's sword is the same sword. */
  hero: Pack;
  nature: Pack;
  town: Pack;
  indoor: Pack;
}

let lands: Promise<LandPacks> | null = null;
export function loadLand(): Promise<LandPacks> {
  if (!lands) {
    lands = Promise.all([loadPack('nature'), loadPack('town'), loadPack('indoor'), loadPack('hero')]).then(([nature, town, indoor, hero]) => ({ nature, town, indoor, hero }));
    lands.catch(() => (lands = null));
  }
  return lands;
}

/** What stands somewhere: a kind other code can ask about. */
export interface LandObject {
  x: number;
  y: number;
  kind: string;
  /** Its name in the data, when it has one (a prop). */
  name?: string;
  /** Its height in world pixels. */
  dy: number;
}

interface Placed {
  m: string;
  x: number;
  z: number;
  rot: number;
  sx: number;
  sy: number;
  sz: number;
  r: number;
  g: number;
  b: number;
  sway: number;
  shadow: number;
  /** How deep the shadow is, next to how wide (a long table's isn't round). */
  shadowD?: number;
  y: number;
  /** Tipped over (radians, forward and sideways). */
  tipX?: number;
  tipZ?: number;
}

/** A great thing's piece, big enough that its middle going out of view doesn't mean it has. */
interface Giant extends Placed {
  reach: number;
}

/* ------------------------------------------------------------------ what grows where */

const TREES: Record<TreeKind, { m: string[]; h: number }> = {
  oak: { m: ['Tree_1_A', 'Tree_1_B', 'Tree_2_A', 'Tree_2_B', 'Tree_2_C'], h: 3.5 },
  pine: { m: ['Tree_4_A', 'Tree_4_B', 'tree_pineDefaultA', 'tree_pineRoundA'], h: 4 },
  snowpine: { m: ['tree_pineDefaultA', 'tree_pineTallA', 'tree_pineRoundA'], h: 4 },
  palm: { m: ['tree_palm', 'tree_palmBend', 'tree_palmTall', 'tree_palmDetailedShort'], h: 3.6 },
  dead: { m: ['Tree_Bare_1_A', 'Tree_Bare_1_B', 'Tree_Bare_2_A', 'Tree_Bare_2_B', 'tree_dead_large', 'tree_dead_medium'], h: 3.2 },
  cactus: { m: ['cactus_tall', 'cactus_short'], h: 1.5 },
  mushroom: { m: ['mushroom_redTall', 'mushroom_tanTall', 'mushroom_red'], h: 1.9 },
  crystal: { m: ['stone_tallA', 'stone_tallE'], h: 2 },
  willow: { m: ['Tree_5_A', 'Tree_5_B', 'Tree_5_D'], h: 3.5 },
  jungle: { m: ['Tree_6_A', 'Tree_7_A', 'Tree_7_B', 'Tree_3_A'], h: 4 },
} as Record<TreeKind, { m: string[]; h: number }>;

const BUSHES = ['Bush_1_A', 'Bush_1_B', 'Bush_1_D', 'Bush_2_A', 'Bush_2_C', 'Bush_3_A', 'Bush_4_A', 'Bush_4_C'];
const ROCKS = ['Rock_1_A', 'Rock_1_D', 'Rock_2_C', 'Rock_3_A', 'Rock_4_C', 'Rock_5_C', 'Rock_6_C'];
const TUFTS = ['Grass_1_A', 'Grass_2_A', 'Grass_1_B', 'Grass_2_B'];
const FLOWERS = ['flower_redA', 'flower_yellowA', 'flower_purpleA'];

/**
 * The world's one scale (the way the great RPGs keep theirs: everything is measured against the hero). A hero is 36
 * world pixels tall, and each prop is sized in world pixels: a crate comes to the knee, a barrel to the hip, a door a
 * head over, a lamp post over the head, a tower over everything. It takes the largest size that keeps within w (across
 * the view), d (deep) and h (tall). `flat` things lie on the ground; those with no model (`m: ''`) are only a rule.
 */
interface PropDef {
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
  /** Stretches to fill w, d and h (a plinth). */
  box?: boolean;
  /** A stone hero this tall stands on it. */
  hero?: number;
}

const PROPS: Record<string, PropDef> = {
  // the road and the yard
  lamp: { m: 'post_lantern', w: 16, d: 16, h: 46 },
  lantern: { m: 'lantern_standing', w: 12, d: 12, h: 20 },
  torch: { m: 'torch_lit', w: 12, d: 12, h: 32, flame: 0.8, flameAt: 32 },
  'iron-torch': { m: 'torch_lit', w: 12, d: 12, h: 32, flame: 0.8, flameAt: 32 },
  brazier: { m: 'bucket', w: 18, d: 18, h: 20, tint: '#7c7a8a', flame: 1, flameAt: 20 },
  campfire: { m: 'campfire_stones', w: 26, d: 26, h: 12, flame: 1.1, flameAt: 6 },
  barrel: { m: 'p_barrel', w: 16, d: 16, h: 20 },
  crate: { m: 'p_crate_A_big', w: 18, d: 18, h: 16 },
  sacks: { m: 'p_sack', w: 16, d: 16, h: 11 },
  basket: { m: 'p_sack', w: 13, d: 13, h: 9, tint: '#d8b070' },
  bucket: { m: 'bucket', w: 10, d: 10, h: 9 },
  'clay-pot': { m: 'barrel_small', w: 11, d: 11, h: 13, tint: '#c88a5c' },
  pot: { m: 'barrel_small', w: 11, d: 11, h: 13, tint: '#c88a5c' },
  urn: { m: 'barrel_small', w: 15, d: 15, h: 20, tint: '#c8a060' },
  cauldron: { m: 'bucket', w: 20, d: 20, h: 15, tint: '#55525f' },
  fish: { m: 'p_trough', w: 24, d: 16, h: 9, tint: '#c8d8d8' },
  woodpile: { m: 'log_stack', w: 28, d: 22, h: 18 },
  log: { m: 'log', w: 30, d: 12, h: 9 },
  stump: { m: 'stump_round', w: 16, d: 16, h: 10 },
  'chopping-block': { m: 'stump_round', w: 16, d: 16, h: 11 },
  hay: { m: 'p_haybale', w: 24, d: 24, h: 18 },
  planter: { m: 'Bush_1_B', w: 22, d: 16, h: 14 },
  flowerbed: { m: 'Bush_2_C', w: 26, d: 20, h: 10, tint: '#f0c8d8' },
  flowers: { m: 'flower_redA', w: 16, d: 16, h: 9 },
  topiary: { m: 'Bush_3_A', w: 22, d: 22, h: 22 },
  scarecrow: { m: 'scarecrow', w: 24, d: 14, h: 38 },
  wheat: { m: 'crops_wheatStageB', w: 20, d: 18, h: 16 },
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
  'armor-stand': { m: 'sword_shield', w: 22, d: 16, h: 28 },
  block: { m: '' },
  well: { m: 'b_well', w: 46, d: 46, h: 62 },
  'market-stall': { m: 'b_market', w: 74, d: 56, h: 46 },
  fountain: { m: 'b_well', w: 56, d: 56, h: 52, tint: '#c8d8e8' },
  // camps and the things of the land
  tent: { m: 'b_tent', w: 46, d: 46, h: 42 },
  'camp-tent': { m: 'tent_detailedOpen', w: 46, d: 46, h: 36, tint: '#d8c8a8' },
  pavilion: { m: 'b_tent', w: 60, d: 60, h: 52, tint: '#f0dcb4' },
  bedroll: { m: 'bed_floor', w: 18, d: 30, h: 6 },
  'market-cart': { m: 'p_cart_merchant', w: 44, d: 34, h: 42 },
  'market-goods': { m: 'p_crate_open', w: 20, d: 20, h: 14 },
  cart: { m: 'wagon', w: 44, d: 28, h: 28 },
  wagon: { m: 'wagon_hay', w: 52, d: 32, h: 34 },
  boat: { m: 'p_boat', w: 57, d: 26, h: 26 },
  wreck: { m: 'p_boat', w: 64, d: 30, h: 30, tint: '#88807a' },
  // towers stand over everything: stone ones on a wall, a wooden lookout in a camp
  watchtower: { m: 'b_tower_A', w: 74, d: 74, h: 158 },
  lookout: { m: 'b_watchtower', w: 66, d: 66, h: 110 },
  windmill: { m: 'b_windmill', w: 96, d: 96, h: 180 },
  flag: { m: 'p_flag_red', w: 18, d: 18, h: 62 },
  'blue-banner': { m: 'p_flag_blue', w: 18, d: 18, h: 62 },
  'red-banner': { m: 'p_flag_red', w: 18, d: 18, h: 62 },
  'skull-banner': { m: 'post_skull', w: 18, d: 18, h: 46 },
  // the dead
  gravestone: { m: 'gravestone', w: 18, d: 12, h: 22 },
  'grave-cross': { m: 'cross', w: 18, d: 10, h: 26 },
  coffin: { m: 'coffin', w: 18, d: 32, h: 11 },
  sarcophagus: { m: 'coffin', w: 24, d: 38, h: 18, tint: '#9a96a0' },
  bones: { m: 'bone_A', w: 16, d: 16, h: 5, tint: '#c8c0a8' },
  'bone-heap': { m: 'ribcage', w: 24, d: 24, h: 14 },
  skulls: { m: 'skull', w: 9, d: 9, h: 8, tint: '#c8c0a8' },
  debris: { m: 'debris-wood', w: 26, d: 26, h: 8, tint: '#8a7660' },
  rubble: { m: 'debris', w: 26, d: 26, h: 9, tint: '#8c8680' },
  'rubble-heap': { m: 'rubble_half', w: 44, d: 36, h: 28 },
  menhir: { m: 'stone_tallA', w: 26, d: 26, h: 62 },
  'standing-stone': { m: 'statue_obelisk', w: 28, d: 28, h: 78 },
  crystals: { m: 'stone_tallA', w: 30, d: 30, h: 46, tint: '#c8a8ff' },
  cage: { m: 'iron-fence', w: 28, d: 14, h: 32 },
  eggs: { m: 'Rock_1_A', w: 12, d: 12, h: 8, tint: '#f0e8c8' },
  altar: { m: 'altar-stone', w: 48, d: 26, h: 22, across: true },
  // deep places
  'broken-column': { m: 'column', w: 24, d: 24, h: 36 },
  'great-column': { m: 'pillar_decorated', w: 42, d: 38, h: 118, box: true },
  'tall-column': { m: 'pillar', w: 34, d: 34, h: 104, box: true, tint: '#a8a6b0' },
  'mossy-column': { m: 'pillar', w: 34, d: 34, h: 96, box: true, tint: '#8aa080' },
  'sand-column': { m: 'pillar_decorated', w: 42, d: 38, h: 118, box: true, tint: '#e0c088' },
  'ice-column': { m: 'pillar', w: 36, d: 36, h: 104, box: true, tint: '#b8dcf4' },
  'black-column': { m: 'pillar_decorated', w: 42, d: 38, h: 124, box: true, tint: '#5a5664' },
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
  'great-obelisk': { m: 'statue_obelisk', w: 70, d: 70, h: 210 },
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
  'great-wreck': { m: 'p_boat', w: 200, d: 90, h: 70, tint: '#88807a' },
  // indoors
  table: { m: 'table_medium', w: 32, d: 24, h: 17, across: true },
  longtable: { m: 'table_long_tablecloth_decorated_A', w: 84, d: 28, h: 20, across: true },
  'war-table': { m: 'table_long_decorated_B', w: 84, d: 34, h: 22, across: true },
  counter: { m: 'bartop_A_large', w: 84, d: 26, h: 24, across: true },
  chair: { m: 'chair', w: 14, d: 14, h: 20 },
  stool: { m: 'stool', w: 11, d: 11, h: 10 },
  pew: { m: 'bench', w: 78, d: 18, h: 14, across: true },
  bed: { m: 'bed_decorated', w: 26, d: 46, h: 18 },
  cot: { m: 'bed_floor', w: 24, d: 40, h: 9 },
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
  throne: { m: 'armchair', w: 28, d: 26, h: 36, tint: '#c8a050' },
  'high-throne': { m: 'armchair', w: 42, d: 34, h: 52, tint: '#d8b050' },
  hearth: { m: 'campfire_bricks', w: 62, d: 26, h: 16, across: true, flame: 1.3, flameAt: 8 },
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

/** A dungeon's way in: each its own, so a crypt is a stair in the ground and a mine is a hole in the hill. */
const ENTRANCES: Record<string, { m: string; w: number; tint?: string }> = {
  crypt: { m: 'crypt-door', w: 2 },
  'crown-catacombs': { m: 'crypt-door', w: 2 },
  'barrow-of-kings': { m: 'crypt-large-door', w: 3 },
  'gallows-keep': { m: 'gate', w: 3, tint: '#a09a90' },
  'siege-of-highwall': { m: 'gate', w: 3.2 },
  duskspire: { m: 'gate', w: 3.2, tint: '#7a7488' },
  'smugglers-grotto': { m: 'cave_rock', w: 3 },
  'deepforge-halls': { m: 'cave_stone', w: 3 },
  'rimeheld-vault': { m: 'cave_stone', w: 3, tint: '#c0e4ff' },
  blightheart: { m: 'cave_rock', w: 3, tint: '#a8c088' },
  'molten-throne': { m: 'cave_rock', w: 3, tint: '#e08a60' },
  'rotmother-cistern': { m: 'metal-gate', w: 2.4 },
  'tomb-of-the-sun-king': { m: 'arch_gate', w: 3, tint: '#f0d8a0' },
  'spire-of-the-rift': { m: 'arch', w: 3, tint: '#c0a0f0' },
  'vaelmoor-remembered': { m: 'arch', w: 3, tint: '#d8d8f0' },
};

const BUILDINGS: Record<string, string[]> = {
  house: ['b_home_A', 'b_home_B'],
  inn: ['b_tavern'],
  tavern: ['b_tavern'],
  shop: ['b_workshop'],
  tower: ['b_tower_A', 'b_tower_B', 'b_watchtower'],
  temple: ['b_church'],
  keep: ['b_castle'],
  hall: ['b_townhall'],
  lighthouse: ['b_tower_B'],
  smithy: ['b_blacksmith'],
};

/** The size a model takes to keep within a prop's limits. */
function sizeWithin(m: MeshData, def: PropDef): { sx: number; sy: number; sz: number; rot: number } {
  let xw = Math.max(0.01, m.max[0] - m.min[0]);
  let zw = Math.max(0.01, m.max[2] - m.min[2]);
  const tall = Math.max(0.01, m.max[1] - m.min[1]);
  const rot = def.across && zw > xw ? Math.PI / 2 : 0;
  if (rot) [xw, zw] = [zw, xw];
  const w = (def.w ?? TILE) / TILE;
  const d = (def.d ?? TILE) / TILE;
  if (def.box) return { sx: w / xw, sy: (def.h ?? TILE) / TILE / tall, sz: d / zw, rot };
  if (def.flat) {
    const fx = w / xw;
    const fz = d / zw;
    return rot ? { sx: fz, sy: 1, sz: fx, rot } : { sx: fx, sy: 1, sz: fz, rot };
  }
  const k = Math.min(w / xw, d / zw, (def.h ?? 9999) / TILE / tall);
  return { sx: k, sy: k, sz: k, rot };
}

/* ------------------------------------------------------------------ recoloring for a land */

function hsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

function rgbOf(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

/**
 * One world's materials, whichever pack a model came from: all timber is the same weathered oak, nothing is
 * candy-bright, so a crate from one pack and a house from another look made by the same hands.
 */
function harmonize(col: Uint8Array, n: number): void {
  for (let v = 0; v < n; v++) {
    const i = v * 3;
    const [h, s, l] = hsl(col[i]! / 255, col[i + 1]! / 255, col[i + 2]! / 255);
    let to: [number, number, number] | null = null;
    // timber and thatch, from orange to tan
    if (h >= 12 && h <= 46 && s > 0.2 && l < 0.88) to = rgbOf(26 + (h - 28) * 0.35, Math.min(0.48, s * 0.7), Math.max(0.09, l > 0.5 ? l * 0.6 : l * 0.8));
    // anything else that shouts
    else if (s > 0.62 && l > 0.3) to = rgbOf(h, s * 0.8, l * 0.92);
    if (!to) continue;
    col[i] = to[0] * 255;
    col[i + 1] = to[1] * 255;
    col[i + 2] = to[2] * 255;
  }
}

/** Green leaves take the land's own leaf colors, dark to light; bark and rock take its bark and stone. */
function colorsFor(m: MeshData, look: ThemeLook, id: string): Uint8Array {
  const out = new Uint8Array(m.col);
  // (bone is bone, not timber)
  if (!/ribcage|skull|bone_/.test(id)) harmonize(out, m.n);
  const roof = id.split('#')[1];
  if (roof) {
    const [rr, rg, rb] = hexRgb(`#${roof}`);
    for (let v = 0; v < m.n; v++) {
      const i = v * 3;
      const [h, s, l] = hsl(out[i]! / 255, out[i + 1]! / 255, out[i + 2]! / 255);
      if (h < 190 || h > 265 || s < 0.18) continue;
      const f = 0.45 + l * 1.15;
      out[i] = Math.min(255, rr * 255 * f);
      out[i + 1] = Math.min(255, rg * 255 * f);
      out[i + 2] = Math.min(255, rb * 255 * f);
    }
    return out;
  }
  const leaves = look.leaves.map((c): [number, number, number] => {
    const [r, g, b] = hexRgb(c);
    const lum = r * 0.3 + g * 0.59 + b * 0.11;
    const k = 0.8;
    return [(lum + (r - lum) * k) * 0.93, (lum + (g - lum) * k) * 0.93, (lum + (b - lum) * k) * 0.88];
  });
  const bark = hexRgb(look.bark);
  const leafy = /^(Tree|Bush|Grass|tree_|plant|hanging)/.test(id);
  const rocky = /^(Rock|rock_|stone_)/.test(id);
  const rock = look.cliffs ? hexRgb(look.ground.leaf[3]) : null;
  for (let v = 0; v < m.n; v++) {
    const i = v * 3;
    const [h, s, l] = hsl(out[i]! / 255, out[i + 1]! / 255, out[i + 2]! / 255);
    if (leafy && h >= 52 && h <= 280 && s > 0.1) {
      const k = Math.max(0, Math.min(leaves.length - 1, Math.round(l * 1.35 * (leaves.length - 1))));
      const c = leaves[k]!;
      out[i] = c[0] * 255;
      out[i + 1] = c[1] * 255;
      out[i + 2] = c[2] * 255;
    } else if (leafy && h > 8 && h < 50) {
      const f = 0.65 + l * 0.7;
      out[i] = Math.min(255, bark[0] * 255 * f);
      out[i + 1] = Math.min(255, bark[1] * 255 * f);
      out[i + 2] = Math.min(255, bark[2] * 255 * f);
    } else if (rocky && rock) {
      const f = 0.55 + l * 0.9;
      out[i] = Math.min(255, rock[0] * 255 * f);
      out[i + 1] = Math.min(255, rock[1] * 255 * f);
      out[i + 2] = Math.min(255, rock[2] * 255 * f);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ the ground */

const groundVert = /* glsl */ `
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const groundFrag = /* glsl */ `
  uniform sampler2D uMask;
  uniform vec2 uSize;
  uniform vec3 uA; uniform vec3 uB;
  uniform vec3 uPathA; uniform vec3 uPathB;
  uniform vec3 uSandA; uniform vec3 uSandB;
  uniform vec3 uCobA; uniform vec3 uCobB;
  uniform vec3 uDeep; uniform vec3 uMidW; uniform vec3 uLightW; uniform vec3 uFoam;
  uniform vec3 uEdge;
  uniform float uIndoor;
  uniform float uLava;
  uniform float uTime;
  uniform vec4 uGrade;
  uniform vec4 uDark;
  uniform vec4 uSee;
  uniform vec3 uFlames[6];
  varying vec3 vW;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec2 p = vW.xz;
    vec2 uv = p / uSize;
    vec4 m = texture2D(uMask, uv);
    vec4 far = texture2D(uMask, uv + vec2(0.0, 0.35) / uSize);
    float n = noise(p * 0.55);
    float n2 = noise(p * 2.3);
    float wob = (n - 0.5) * 0.22 + (n2 - 0.5) * 0.1;
    vec3 c;
    float ck = mod(floor(p.x) + floor(p.y), 2.0);
    if (uIndoor > 0.5) {
      // fitted flagstones, worn unevenly (no grid: the stones lie in courses, each its own shade)
      vec2 s = p * vec2(1.6, 2.2);
      s.x += mod(floor(s.y), 2.0) * 0.5;
      vec2 id = floor(s);
      vec2 f = fract(s) - 0.5;
      float line = smoothstep(0.43, 0.5, max(abs(f.x), abs(f.y)));
      c = mix(uA, uB, hash(id));
      c *= 0.9 + n * 0.2;
      c = mix(c, uEdge, line * 0.45);
    } else {
      // grass in big soft blotches over a checker a player's eye can measure distance by
      c = mix(uA, uB, smoothstep(0.3, 0.7, n));
      // the land's light and shade in long drifts, and the fine grain of what grows on it
      c *= 0.86 + noise(p * 0.17 + 7.0) * 0.26;
      c *= 0.95 + noise(p * 6.0) * 0.1;
      c *= 1.0 + (ck - 0.5) * 0.01;
    }
    float sand = smoothstep(0.46, 0.54, m.b + wob);
    c = mix(c, mix(uSandA, uSandB, n), sand);
    float path = smoothstep(0.46, 0.54, m.r + wob);
    vec3 pc = mix(uPathA, uPathB, n * 0.7 + n2 * 0.3);
    float pathShade = smoothstep(0.54, 0.46, m.r + wob + 0.1);
    c = mix(c, pc * (1.0 - pathShade * 0.14), path);
    float cob = smoothstep(0.46, 0.54, m.a + wob * 0.4);
    if (cob > 0.0) {
      vec2 s = p * vec2(2.7, 3.6);
      s.x += mod(floor(s.y), 2.0) * 0.5;
      vec2 id = floor(s);
      vec2 f = fract(s) - 0.5;
      float line = smoothstep(0.36, 0.5, max(abs(f.x), abs(f.y)));
      vec3 st = mix(uCobA, uCobB, hash(id) * 0.8);
      st *= 0.9 + n * 0.2;
      c = mix(c, mix(st, uCobA * 0.72, line * 0.8), cob);
    }
    // water: dark in the middle, lighter at the bank, with foam where it meets the land
    float w = smoothstep(0.47, 0.53, m.g + wob * 0.55);
    if (w > 0.0) {
      float deep = smoothstep(0.55, 0.98, m.g);
      vec3 wc = mix(uMidW, uDeep, deep);
      float t = uTime;
      float r1 = sin(p.x * 2.2 + t * 1.1 + sin(p.y * 1.7 + t * 0.6) * 1.4);
      float r2 = sin(p.y * 3.1 - t * 0.9 + sin(p.x * 2.4 - t * 0.5) * 1.1);
      float glint = smoothstep(0.82, 0.98, r1 * 0.55 + r2 * 0.55);
      wc = mix(wc, uLightW, glint * (uLava > 0.5 ? 0.85 : 0.55));
      if (uLava > 0.5) wc += vec3(0.25, 0.08, 0.0) * (0.5 + 0.5 * sin(t * 1.5 + n * 9.0));
      float foamLine = smoothstep(0.03, 0.0, abs(m.g + wob * 0.55 - 0.56 - sin(t * 1.3 + n * 7.0) * 0.012));
      wc = mix(wc, uFoam, foamLine * 0.9);
      c = mix(c, wc, w);
    }
    // what stands on a solid tile shades its foot
    float foot = smoothstep(0.0, 0.9, far.g) * 0.0;
    c *= 1.0 - foot;
    float lum = dot(c, vec3(0.3, 0.59, 0.11));
    c = mix(vec3(lum), c, 0.84) * vec3(0.99, 0.97, 0.91);
    c = mix(c, uGrade.rgb, uGrade.a);
    if (uDark.x > 0.0) {
      float d = length(vW.xz - uSee.xz);
      float k = smoothstep(uDark.y * 0.45, uDark.y, d);
      for (int i = 0; i < 6; i++) {
        if (uFlames[i].z > 0.0) k = min(k, smoothstep(uFlames[i].z * 0.3, uFlames[i].z, length(vW.xz - uFlames[i].xy)));
      }
      c *= mix(1.0, 1.0 - uDark.x, k);
    }
    gl_FragColor = vec4(c, 1.0);
  }`;

const col3 = (hex: string): THREE.Vector3 => {
  const [r, g, b] = hexRgb(hex);
  return new THREE.Vector3(r, g, b);
};

/** Tiles something stands on: what is under it is whatever most of the ground round it is. */
const THINGS = new Set<number>([K.Prop, K.Fence, K.Tree, K.Bush, K.Bramble, K.Rock, K.Pillar, K.Brazier]);
const PAVED = [K.Path, K.Cobble, K.Sand] as const;

/**
 * The ground as it is painted: a bench on a square stands on the square's stones, a palm in the desert on sand (a
 * tile with something on it has no ground of its own, and showed the land's grass in a square patch). A thing at
 * the edge of a road, with most of its tile's neighbors off the road, keeps its grass, so roads keep their line.
 */
function groundUnderThings(map: TileMap): Uint8Array {
  const W = map.w;
  const H = map.h;
  const out = Uint8Array.from(map.kind);
  // (three times, so the middle of something three tiles wide gets it too)
  for (let pass = 0; pass < 3; pass++) {
    const was = Uint8Array.from(out);
    for (let i = 0; i < W * H; i++) {
      if (!THINGS.has(was[i]!)) continue;
      const tx = i % W;
      const ty = Math.floor(i / W);
      for (const ground of PAVED) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = tx + dx;
            const y = ty + dy;
            if ((dx || dy) && x >= 0 && y >= 0 && x < W && y < H && was[y * W + x] === ground) n++;
          }
        }
        if (n >= 4) {
          out[i] = ground;
          break;
        }
      }
    }
  }
  return out;
}

export function buildGround(map: TileMap, look: ThemeLook): THREE.Mesh {
  const W = map.w;
  const H = map.h;
  const mask = new Uint8Array(W * H * 4);
  const kinds = groundUnderThings(map);
  for (let i = 0; i < W * H; i++) {
    const k = kinds[i]!;
    const at = i * 4;
    if (k === K.Path) mask[at] = 255;
    if (k === K.Water || (k === K.Bridge && !look.indoor)) mask[at + 1] = 255;
    if (k === K.Sand) mask[at + 2] = 255;
    if (k === K.Cobble) mask[at + 3] = 255;
  }
  const tex = new THREE.DataTexture(mask, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  const g = look.ground;
  const stone = look.stone;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: LIGHT.uTime,
      uGrade: LIGHT.uGrade,
      uDark: LIGHT.uDark,
      uSee: LIGHT.uSee,
      uFlames: LIGHT.uFlames,
      uMask: { value: tex },
      uSize: { value: new THREE.Vector2(W, H) },
      uA: { value: col3(stone ? stone.slab[1] : g.grass[2]) },
      uB: { value: col3(stone ? stone.slab[2] : g.grass[3]) },
      uEdge: { value: col3(stone ? stone.mortar : g.grass[0]) },
      uPathA: { value: col3(g.path[1]) },
      uPathB: { value: col3(g.path[2]) },
      uSandA: { value: col3(g.sand[2]) },
      uSandB: { value: col3(g.sand[3]) },
      uCobA: { value: col3(stone ? stone.slab[0] : g.path[0]) },
      uCobB: { value: col3(stone ? stone.slab[3] : g.path[1]) },
      uDeep: { value: col3(g.water.deep) },
      uMidW: { value: col3(g.water.mid) },
      uLightW: { value: col3(g.water.light) },
      uFoam: { value: col3(g.water.foam) },
      uIndoor: { value: look.indoor ? 1 : 0 },
      uLava: { value: look.lava ? 1 : 0 },
    },
    vertexShader: groundVert,
    fragmentShader: groundFrag,
  });
  const geo = new THREE.PlaneGeometry(W + 80, H + 80);
  geo.rotateX(-Math.PI / 2);
  geo.translate(W / 2, 0, H / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

/* ------------------------------------------------------------------ blocks */

interface BlockStyle {
  h: number;
  top: [number, number, number];
  top2: [number, number, number];
  side: [number, number, number];
  side2: [number, number, number];
}

/** How tall the walls of a place under a roof stand, in tiles: halls, not cellars. */
const DUNGEON_WALL = 2.7;

function blockStyles(look: ThemeLook, woody: boolean): { wall: BlockStyle; rampart: BlockStyle } {
  const st = look.stone;
  const wall: BlockStyle = st
    ? { h: DUNGEON_WALL, top: hexRgb(st.top), top2: hexRgb(st.topHi), side: hexRgb(st.brick[1]), side2: hexRgb(st.brick[0]) }
    : woody
      ? { h: 1.0, top: hexRgb(look.ground.leaf[1]), top2: hexRgb(look.ground.leaf[2]), side: hexRgb(look.ground.leaf[0]), side2: hexRgb(look.ground.leaf[0]) }
      : { h: 1.7, top: hexRgb(look.ground.leaf[3]), top2: hexRgb(look.ground.leaf[4]), side: hexRgb(look.ground.leaf[1]), side2: hexRgb(look.ground.leaf[0]) };
  const rampart: BlockStyle = { h: 2.5, top: [0.46, 0.44, 0.46], top2: [0.68, 0.65, 0.62], side: [0.62, 0.59, 0.56], side2: [0.42, 0.4, 0.42] };
  return { wall, rampart };
}

export class Mesher {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  quad(a: number[], b: number[], c: number[], d: number[], n: number[], ca: readonly number[], cb: readonly number[] = ca): void {
    const v = this.pos.length / 3;
    this.pos.push(...a, ...b, ...c, ...d);
    this.nor.push(...n, ...n, ...n, ...n);
    this.col.push(...ca, ...ca, ...cb, ...cb);
    this.idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }
  /** As a model a Stand can place (bytes for colors, like the rest). */
  data(): MeshData {
    const n = this.pos.length / 3;
    const pos = Float32Array.from(this.pos);
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n * 3; i++) {
      const c = i % 3;
      min[c] = Math.min(min[c]!, pos[i]!);
      max[c] = Math.max(max[c]!, pos[i]!);
    }
    const nor = Int8Array.from(this.nor, (x) => x * 127);
    return { n, i: this.idx.length, min, max, pos, nor, sn: nor, col: Uint8Array.from(this.col, (x) => Math.min(255, x * 255)), idx: Uint16Array.from(this.idx) };
  }
  build(): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    const tint = new THREE.InstancedBufferAttribute(new Float32Array([1, 1, 1, 0]), 4);
    g.setAttribute('iTint', tint);
    const mesh = new THREE.InstancedMesh(g, staticMaterial, 1);
    mesh.setMatrixAt(0, new THREE.Matrix4());
    mesh.frustumCulled = false;
    return mesh;
  }
}

function shade(c: readonly number[], k: number): number[] {
  return [Math.min(1, c[0]! * k), Math.min(1, c[1]! * k), Math.min(1, c[2]! * k)];
}

function buildBlocks(map: TileMap, look: ThemeLook, woody: boolean): THREE.Mesh {
  const { wall, rampart } = blockStyles(look, woody);
  const m = new Mesher();
  const W = map.w;
  const H = map.h;
  const styleAt = (x: number, y: number): BlockStyle | null => {
    if (x < 0 || y < 0 || x >= W || y >= H) return wall;
    const k = map.kind[y * W + x]!;
    if (k === K.Wall || k === K.Illusion) return wall;
    if (k === K.Rampart) return rampart;
    return null;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = styleAt(x, y);
      if (!s) continue;
      const hs = hash2(x, y, 5);
      // (one height: blocks of differing heights leave bright seams, and the trees on them give the skyline)
      const h = s.h;
      const top = shade(s.top, 0.97 + hash2(x, y, 9) * 0.05 + (hs > 0.5 ? 0.02 : 0));
      m.quad([x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], [x, h, y], [0, 1, 0], top);
      const side = (a: number[], b: number[], c: number[], d: number[], n: number[]): void => {
        const f = 0.92 + hash2(x, y, 13) * 0.14;
        // built walls are laid in courses of stone, each its own shade; a cliff or a wood is one face
        if (s === wall && !look.indoor) {
          m.quad(a, b, c, d, n, shade(s.side2, f), shade(s.side, f));
          return;
        }
        const rows = 4;
        const lerp = (p: number[], q: number[], t: number): number[] => [p[0]! + (q[0]! - p[0]!) * t, p[1]! + (q[1]! - p[1]!) * t, p[2]! + (q[2]! - p[2]!) * t];
        for (let r = 0; r < rows; r++) {
          const t0 = r / rows;
          const t1 = (r + 1) / rows;
          const lift = shade(s.side2, 0.02 + 1);
          const up = shade(s.side, 1);
          const course = f * (0.9 + hash2(x + r * 3, y + r, 17) * 0.2);
          const c0 = shade([lift[0]! + (up[0]! - lift[0]!) * t0, lift[1]! + (up[1]! - lift[1]!) * t0, lift[2]! + (up[2]! - lift[2]!) * t0], course);
          // (the bottom of a course in shadow, like the mortar under it)
          m.quad(lerp(a, d, t0), lerp(b, c, t0), lerp(b, c, t1), lerp(a, d, t1), n, shade(c0, 0.84), c0);
        }
      };
      if (!styleAt(x, y + 1)) side([x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, h, y + 1], [x, h, y + 1], [0, 0, 1]);
      if (!styleAt(x + 1, y)) side([x + 1, 0, y + 1], [x + 1, 0, y], [x + 1, h, y], [x + 1, h, y + 1], [1, 0, 0]);
      if (!styleAt(x - 1, y)) side([x, 0, y], [x, 0, y + 1], [x, h, y + 1], [x, h, y], [-1, 0, 0]);
      if (!styleAt(x, y - 1)) side([x + 1, 0, y], [x, 0, y], [x, h, y], [x + 1, h, y], [0, 0, -1]);
      // crenels along a city wall
      if (s === rampart) {
        // the parapet: two small merlons a tile, on the wall's outer edges, a walkway between
        const ch = h + 0.3;
        const c = shade(s.top2, 1.02);
        const south = !styleAt(x, y + 1);
        const north = !styleAt(x, y - 1);
        const east = !styleAt(x + 1, y);
        const west = !styleAt(x - 1, y);
        const merlon = (x0: number, z0: number, x1: number, z1: number): void => {
          m.quad([x0, ch, z1], [x1, ch, z1], [x1, ch, z0], [x0, ch, z0], [0, 1, 0], c);
          m.quad([x0, h, z1], [x1, h, z1], [x1, ch, z1], [x0, ch, z1], [0, 0, 1], s.side, c);
          m.quad([x1, h, z1], [x1, h, z0], [x1, ch, z0], [x1, ch, z1], [1, 0, 0], s.side, c);
          m.quad([x0, h, z0], [x0, h, z1], [x0, ch, z1], [x0, ch, z0], [-1, 0, 0], s.side, c);
        };
        const t = 0.2;
        if (south || north) for (const u of [0.06, 0.56]) merlon(x + u, south ? y + 1 - t : y, x + u + 0.36, south ? y + 1 : y + t);
        if (east || west) for (const u of [0.06, 0.56]) merlon(east ? x + 1 - t : x, y + u, east ? x + 1 : x + t, y + u + 0.36);
      }
      if (map.kind[y * W + x] === K.Bridge) continue;
    }
  }
  // the world past the map's edge: more of the same
  const far = 40;
  const h = wall.h;
  const t = wall.top;
  m.quad([-far, h, H + far], [0, h, H + far], [0, h, -far], [-far, h, -far], [0, 1, 0], t);
  m.quad([W, h, H + far], [W + far, h, H + far], [W + far, h, -far], [W, h, -far], [0, 1, 0], t);
  m.quad([0, h, 0], [W, h, 0], [W, h, -far], [0, h, -far], [0, 1, 0], t);
  m.quad([0, h, H + far], [W, h, H + far], [W, h, H], [0, h, H], [0, 1, 0], t);
  return m.build();
}

/** Planks over the water; indoors, a wooden floor. */
function buildPlanks(map: TileMap, look: ThemeLook): THREE.Mesh {
  const m = new Mesher();
  const W = map.w;
  const H = map.h;
  // planks over the water; indoors, a wooden floor (what stands on it stands on planks too)
  const wood = hexRgb(look.indoor ? '#7f5c3c' : '#7a5a3a');
  const wood2 = hexRgb(look.indoor ? '#6c4e33' : '#644a30');
  const planked = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && map.kind[y * W + x] === K.Bridge;
  const y0 = 0.02;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = map.kind[y * W + x]!;
      const under = look.indoor && (k === K.Prop || k === K.Door || k === K.Deco) && (planked(x - 1, y) || planked(x + 1, y) || planked(x, y - 1) || planked(x, y + 1));
      if (k !== K.Bridge && !under) continue;
      const across = !look.indoor && (planked(x - 1, y) || planked(x + 1, y));
      const n = 4;
      const gap = look.indoor ? 0.97 : 0.9;
      for (let i = 0; i < n; i++) {
        const c = shade(i % 2 ? wood : wood2, 0.94 + hash2(x + i, y, 3) * 0.14);
        const a = i / n;
        const b = (i + gap) / n;
        if (across) m.quad([x + a, y0, y + 1], [x + b, y0, y + 1], [x + b, y0, y], [x + a, y0, y], [0, 1, 0], c);
        else m.quad([x, y0, y + b], [x + 1, y0, y + b], [x + 1, y0, y + a], [x, y0, y + a], [0, 1, 0], c);
      }
    }
  }
  return m.build();
}

/* ------------------------------------------------------------------ the land */

const CELL = 8;
/** A cell's key, for cells a little past the map's edge too. */
const cellKey = (r: number, c: number): number => ((r + 64) << 12) | (c + 64);
/** The hues of a land's roofs (the models are painted blue). */
const ROOFS: Record<string, string[]> = {
  default: ['#3f6fb0', '#b04a3f', '#c08a3a'],
  village: ['#3f6fb0', '#b04a3f', '#5f8f4f'],
  farm: ['#b04a3f', '#c08a3a', '#7a5a3a'],
  coast: ['#3f7fa0', '#d0d0c8', '#b04a3f'],
  desert: ['#c8a060', '#b0683f', '#d8c090'],
  snow: ['#5a7a9a', '#8a9ab0', '#a05a4a'],
  plague: ['#5a5a48', '#4a4a5a', '#6a5040'],
  moor: ['#4a4a5a', '#5a5048'],
  barrow: ['#4a4a5a', '#5a5048'],
  haunted: ['#4a4a5a', '#3f3f4a'],
  deadlake: ['#3f4a5a', '#3f3f4a'],
  sunken: ['#3f6a70', '#4a5a5a'],
  storm: ['#4a5a70', '#5a6a7a'],
  mountain: ['#6a6a78', '#7a5a4a'],
  volcanic: ['#4a3a3a', '#6a3a2f'],
  rift: ['#5a4a7a', '#4a4a6a'],
  warfront: ['#5a4a3f', '#6a5a4a'],
  fey: ['#9a5ab0', '#5a9a8a', '#c08ac0'],
  jungle: ['#5a7a3f', '#8a6a3f'],
  pale: ['#7a7a8a', '#5a5a6a'],
};
/** A waystone's stone and the color of its rune, by land. */
const WAYSTONES: Record<string, [string, string]> = {
  default: ['#808798', '#7fd4ff'],
  autumn: ['#8a7a68', '#ffd27a'],
  coast: ['#a8a490', '#8ae8e0'],
  marsh: ['#6a7468', '#b0ff9a'],
  plague: ['#5c6650', '#baff5a'],
  mountain: ['#6c6a70', '#ffb060'],
  barrow: ['#5e5c66', '#c8b8ff'],
  storm: ['#5c6878', '#9ad8ff'],
  moor: ['#5c5660', '#d0a0ff'],
  desert: ['#c0996a', '#ffe08a'],
  fey: ['#a890c8', '#ff9aea'],
  snow: ['#8aa8c4', '#c8f0ff'],
  rift: ['#54407a', '#d090ff'],
  jungle: ['#6a7a50', '#a8ff70'],
  warfront: ['#6a625a', '#ff9a6a'],
  gloam: ['#44504a', '#7affb0'],
  bonefield: ['#a89c84', '#ffd0a0'],
  haunted: ['#5c6670', '#ffe0a0'],
  sunken: ['#4e6a68', '#7affe0'],
  blight: ['#5a4e5e', '#c8ff6a'],
  volcanic: ['#3e3634', '#ff7a2a'],
  deadlake: ['#4a4c54', '#a8c0ff'],
  pale: ['#8a8e9e', '#d8e4ff'],
};

/** Nothing flowers here. */
const BARE_LANDS = new Set<string>(['volcanic', 'snow', 'desert', 'peaks', 'bonefield', 'blight', 'deadlake', 'haunted', 'rift', 'pale', 'barrow', 'plague', 'warfront', 'gloam', 'storm', 'mountain']);

export class Land3D {
  /** What stands. */
  readonly group = new THREE.Group();
  /** What lies on the ground: the floor, planks and shadows. */
  readonly under = new THREE.Group();
  readonly objects: LandObject[] = [];
  /** The fires burning here: their foot, and how tall the thing holding them is (tiles). */
  readonly flames: { x: number; z: number; y: number; size: number }[] = [];
  /** The stone heroes on their plinths (the cast draws them, in a pose). */
  readonly statues: { x: number; y: number; h: number; lift: number; tint: readonly [number, number, number] }[] = [];
  /** Great figures frozen in a pose (the cast draws them). */
  readonly colossi: Colossus[] = [];
  /** The pieces of great works, which the view keeps as long as any of them could show. */
  private readonly giants: Giant[] = [];
  /** Soft lights that aren't fire: the rune on a waymarker. */
  readonly glows: { x: number; z: number; y: number; color: string; size: number }[] = [];
  private readonly look: ThemeLook;
  private readonly ground: THREE.Mesh;
  private readonly blocks: THREE.Mesh;
  private readonly planks: THREE.Mesh;
  private readonly cells = new Map<number, Placed[]>();
  private readonly stands = new Map<string, Stand>();
  private readonly shadows: THREE.InstancedMesh;
  private wallH = 1.45;
  private cx = NaN;
  private cz = NaN;
  private readonly doors: { i: number; x: number; y: number; k: number; h: number }[] = [];
  private readonly doorStand: Stand;

  constructor(
    private readonly map: TileMap,
    readonly region: RegionDef,
    private readonly packs: LandPacks,
    private readonly shown: (pm: PlacedMarker) => boolean,
    readonly keep: ((o: LandObject) => boolean) | null = null,
  ) {
    const theme = region.theme;
    const look = THEMES[theme];
    this.look = look;
    const woody = !look.indoor && !look.cliffs && look.trees.filter((t) => t !== 'cactus' && t !== 'crystal').length * 2 > look.trees.length;
    this.ground = buildGround(map, look);
    this.blocks = buildBlocks(map, look, woody);
    this.planks = buildPlanks(map, look);
    this.under.add(this.ground, this.planks);
    this.group.add(this.blocks);
    this.wallH = look.indoor ? DUNGEON_WALL : woody ? 1 : 1.6;
    this.placeAll(woody);
    this.placeSlabs();
    // the shadow of what stands, one soft disc each
    const quad = new THREE.PlaneGeometry(1, 1);
    quad.rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(quad, shadowMaterial, 600);
    this.shadows.frustumCulled = false;
    this.shadows.count = 0;
    this.shadows.position.y = 0.04;
    this.under.add(this.shadows);
    // a door or a cracked wall is a block of its own: it can go away
    const box = boxMesh(look.indoor ? hexRgb(look.stone!.brick[2]) : [0.47, 0.34, 0.2]);
    let doors = 0;
    for (let i = 0; i < map.w * map.h; i++) {
      const k = map.kind[i]!;
      if (k === K.Door || k === K.Cracked) {
        doors++;
        this.doors.push({ i, x: i % map.w, y: Math.floor(i / map.w), k, h: map.solid[i] ? 1 : 0 });
      }
    }
    this.doorStand = new Stand(box, this.group, Math.max(1, doors));
    this.updateDoors(0);
    // (materials may need to compile on first draw; nothing else is set up lazily)
  }

  private pack(id: string): MeshData | null {
    const base = id.replace('~', '').split('#')[0]!;
    return this.packs.nature.meshes[base] ?? this.packs.town.meshes[base] ?? this.packs.indoor.meshes[base] ?? this.packs.hero.meshes[base] ?? null;
  }

  /** A roof color for this land: a village has two or three, a desert's are clay and a dead land's are slate. */
  private roofOf(tx: number, ty: number): string {
    const list = ROOFS[this.region.theme] ?? ROOFS.default!;
    return list[Math.floor(hash2(tx, ty, 23) * list.length)]!.slice(1);
  }

  private add(p: Omit<Placed, 'r' | 'g' | 'b' | 'sway' | 'shadow' | 'y' | 'sz' | 'sy'> & Partial<Placed>): void {
    if (!this.pack(p.m)) return;
    const key = cellKey(Math.floor(p.z / CELL), Math.floor(p.x / CELL));
    let list = this.cells.get(key);
    if (!list) {
      list = [];
      this.cells.set(key, list);
    }
    const placedNow: Placed = { r: 1, g: 1, b: 1, sway: 0, shadow: 0, y: 0, sy: p.sx, sz: p.sx, ...p };
    if (this.region.kind === 'dungeon') {
      placedNow.r *= 0.86;
      placedNow.g *= 0.84;
      placedNow.b *= 0.86;
    }
    list.push(placedNow);
  }

  /** Sized to `h` tiles tall, but no wider or deeper than `wide` tiles. */
  private fitted(id: string, h: number, wide: number): number {
    const m = this.pack(id);
    if (!m) return 1;
    const across = Math.max(0.01, m.max[0] - m.min[0], m.max[2] - m.min[2]);
    return Math.min(h / Math.max(0.01, m.max[1] - m.min[1]), wide / across);
  }

  /** Sized to `h` tiles tall. */
  private sized(id: string, h: number): number {
    const m = this.pack(id);
    if (!m) return 1;
    return h / Math.max(0.01, m.max[1] - m.min[1]);
  }

  private keepIt(o: LandObject): boolean {
    this.objects.push(o);
    return !this.keep || this.keep(o);
  }

  private placeAll(woody: boolean): void {
    const { map, look, region } = this;
    const W = map.w;
    const H = map.h;
    const kindAt = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= H ? K.Wall : map.kind[y * W + x]!);
    const fences = (x: number, y: number): boolean => kindAt(x, y) === K.Fence;
    for (let i = 0; i < W * H; i++) {
      const tx = i % W;
      const ty = Math.floor(i / W);
      const k = map.kind[i]!;
      const x = tx + 0.5;
      const z = ty + 0.5;
      const h = hash2(tx, ty, 77);
      const wx = x * TILE;
      const wy = (ty + 1) * TILE - 3;
      switch (k) {
        case K.Tree: {
          const kind = look.trees[Math.floor(hash2(tx, ty, 91) * look.trees.length)] ?? 'oak';
          const def = TREES[kind] ?? TREES.oak;
          const m = def.m[Math.floor(h * def.m.length) % def.m.length]!;
          const s = this.fitted(m, def.h * (0.85 + hash2(tx, ty, 21) * 0.3), 2.4);
          // (a crystal takes the land's own light: the model itself is plain white)
          const shard = kind === 'crystal' ? hexRgb(look.leaves[hash2(tx, ty, 93) < 0.3 ? 5 : 4]) : null;
          if (this.keepIt({ x: wx, y: wy, kind: 'tree', dy: -def.h * TILE })) this.add({ m, x: x + (h - 0.5) * 0.12, z: z + (hash2(tx, ty, 31) - 0.5) * 0.12, rot: h * 6.28, sx: s, sway: kind === 'dead' || kind === 'crystal' || kind === 'cactus' ? 0 : 1, shadow: 1.25, ...(shard ? { r: shard[0], g: shard[1], b: shard[2] } : {}) });
          break;
        }
        case K.Bush:
        case K.Bramble: {
          const m = BUSHES[Math.floor(h * BUSHES.length)]!;
          const s = this.fitted(m, 0.72 + hash2(tx, ty, 21) * 0.26, 1.05);
          const thorn = k === K.Bramble;
          if (this.keepIt({ x: wx, y: wy, kind: 'bush', dy: -12 })) this.add({ m, x, z, rot: h * 6.28, sx: s, sway: 0.6, shadow: 0.7, r: thorn ? 0.72 : 1, g: thorn ? 0.5 : 1, b: thorn ? 0.72 : 1 });
          break;
        }
        case K.Rock: {
          const m = ROCKS[Math.floor(h * ROCKS.length)]!;
          const s = this.fitted(m, 0.75 + hash2(tx, ty, 21) * 0.45, 1);
          if (this.keepIt({ x: wx, y: wy, kind: 'rock', dy: -10 })) this.add({ m, x, z, rot: h * 6.28, sx: s, shadow: 0.7 });
          break;
        }
        case K.Fence: {
          const across = fences(tx - 1, ty) || fences(tx + 1, ty);
          const m = 'fence_simple';
          const size = this.pack(m);
          const sx = size ? 1.02 / Math.max(0.01, size.max[0] - size.min[0]) : 1;
          if (this.keepIt({ x: wx, y: wy, kind: 'fence', dy: -10 })) this.add({ m, x, z, rot: across ? 0 : Math.PI / 2, sx, sy: size ? 15 / TILE / Math.max(0.01, size.max[1] - size.min[1]) : sx, sz: sx });
          break;
        }
        case K.Pillar: {
          const m = look.indoor ? 'pillar' : 'statue_column';
          // (indoors a column goes up into the dark, far over anyone's head)
          const pw = this.spanOf(m, 0);
          const ph = this.spanOf(m, 1);
          if (look.indoor) {
            if (this.keepIt({ x: wx, y: wy, kind: 'pillar', dy: -96 })) this.add({ m, x, z, rot: 0, sx: 1.25 / pw, sy: 4.4 / ph, sz: 1.25 / pw, shadow: 0.9 });
          } else if (this.keepIt({ x: wx, y: wy, kind: 'pillar', dy: -40 })) this.add({ m, x, z, rot: 0, sx: this.fitted(m, 2.6, 1), shadow: 0.8, r: 0.68, g: 0.68, b: 0.72 });
          break;
        }
        case K.Brazier: {
          const m = 'bucket';
          if (this.keepIt({ x: wx, y: wy, kind: 'brazier', dy: -24 })) this.add({ m, x, z, rot: 0, sx: this.fitted(m, 0.95, 0.9), shadow: 0.55, r: 0.5, g: 0.48, b: 0.55 });
          this.flames.push({ x, z, y: 0.95, size: 1 });
          break;
        }
        case K.Deco:
        case K.Floor: {
          if (look.indoor) break;
          const d = hash2(tx, ty, 41);
          if (d < (k === K.Deco ? 0.8 : 0.26)) {
            const flower = hash2(tx, ty, 43) < 0.18 && !BARE_LANDS.has(region.theme);
            const m = flower ? FLOWERS[Math.floor(hash2(tx, ty, 47) * FLOWERS.length)]! : TUFTS[Math.floor(hash2(tx, ty, 47) * TUFTS.length)]!;
            this.add({ m, x: x + (hash2(tx, ty, 51) - 0.5) * 0.8, z: z + (hash2(tx, ty, 53) - 0.5) * 0.8, rot: d * 40, sx: this.sized(m, flower ? 0.42 : 0.34 + d * 0.2), sway: flower ? 0 : 1.2 });
          }
          break;
        }
        case K.Water: {
          if (look.lava || look.indoor) break;
          if (hash2(tx, ty, 61) < 0.05) {
            const m = hash2(tx, ty, 63) < 0.5 ? 'lily_large' : 'lily_small';
            this.add({ m, x, z, rot: h * 6.28, sx: this.sized(m, 0.12) * 0.7, y: 0.02 });
          }
          break;
        }
        case K.Wall: {
          if (look.indoor) {
            const below = kindAt(tx, ty + 1);
            if (below !== K.Wall && below !== K.Cracked && below !== K.Door) {
              // a hall's wall has a rhythm: a buttress, then a torch, then a buttress
              if (tx % 6 === 0) {
                this.add({ m: 'torch_mounted', x, z: ty + 1.02, rot: 0, sx: this.sized('torch_mounted', 0.7), y: 0.9 });
                this.flames.push({ x, z: ty + 1.06, y: 1.4, size: 0.72 });
              } else if (tx % 6 === 3 && look.stone) {
                this.add({ m: 'pillar', x, z: ty + 1, rot: 0, sx: this.fitted('pillar', 3.1, 0.78), shadow: 0 });
              }
            }
            break;
          }
          if (!woody) {
            // bare land: broken rock along the top of the cliff, not a flat table
            if (hash2(tx, ty, 71) < 0.62) {
              const rock = ROCKS[Math.floor(hash2(tx, ty, 73) * ROCKS.length)]!;
              this.add({ m: rock, x: x + (h - 0.5) * 0.5, z: z + (hash2(tx, ty, 31) - 0.5) * 0.5, rot: h * 6.28, sx: this.fitted(rock, 0.7 + hash2(tx, ty, 21) * 0.8, 1.5), y: 1.5 });
            }
            break;
          }
          // the forest wall: its edge is trees, and its depths a bumpy roof of crowns
          const open = kindAt(tx, ty + 1) !== K.Wall || kindAt(tx - 1, ty) !== K.Wall || kindAt(tx + 1, ty) !== K.Wall || kindAt(tx, ty - 1) !== K.Wall;
          if (open || (tx + ty) % 2 === 0) {
            const kind = look.trees[Math.floor(hash2(tx, ty, 91) * look.trees.length)] ?? 'oak';
            const def = TREES[kind] ?? TREES.oak;
            const m = def.m[Math.floor(h * def.m.length) % def.m.length]!;
            const s = this.fitted(m, def.h * (open ? 0.72 : 0.6) * (0.9 + hash2(tx, ty, 21) * 0.3), 1.9);
            this.add({ m, x: x + (h - 0.5) * 0.2, z: z + (hash2(tx, ty, 31) - 0.5) * 0.2, rot: h * 6.28, sx: s, sway: 0.7 });
          }
          break;
        }
        default:
          break;
      }
    }
    // the wood goes on past the edge of the map: a land doesn't stop at its border
    if (woody) {
      for (let ty = -6; ty < H + 6; ty++) {
        for (let tx = -6; tx < W + 6; tx++) {
          if (tx >= 0 && ty >= 0 && tx < W && ty < H) continue;
          if ((tx + ty) % 2 !== 0) continue;
          const h = hash2(tx + 40, ty + 40, 77);
          const kind = look.trees[Math.floor(hash2(tx + 40, ty + 40, 91) * look.trees.length)] ?? 'oak';
          const def = TREES[kind] ?? TREES.oak;
          const m = def.m[Math.floor(h * def.m.length) % def.m.length]!;
          this.add({ m, x: tx + 0.5 + (h - 0.5) * 0.2, z: ty + 0.5 + (hash2(tx + 40, ty + 40, 31) - 0.5) * 0.2, rot: h * 6.28, sx: this.fitted(m, def.h * 0.6 * (0.9 + hash2(tx + 40, ty + 40, 21) * 0.3), 1.9), sway: 0.7 });
        }
      }
    }
    // houses and halls, on the tiles the rules make solid (the rest of a lot is its yard)
    for (const b of map.buildings) {
      const list = BUILDINGS[b.style] ?? BUILDINGS.house!;
      const m = list[Math.floor(hash2(b.lot.tx, b.lot.ty, 7) * list.length)]!;
      const mesh = this.pack(m);
      if (!mesh) continue;
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (let y = b.lot.ty; y < b.lot.ty + b.lot.h; y++) {
        for (let x = b.lot.tx; x < b.lot.tx + b.lot.w; x++) {
          if (kindAt(x, y) !== K.House) continue;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x + 1);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y + 1);
        }
      }
      if (x1 < x0) {
        x0 = b.lot.tx;
        x1 = b.lot.tx + b.lot.w;
        y0 = b.lot.ty;
        y1 = b.lot.ty + b.lot.h;
      }
      const wideX = Math.max(0.01, mesh.max[0] - mesh.min[0]);
      const wideZ = Math.max(0.01, mesh.max[2] - mesh.min[2]);
      // true to its own shape (no stretched barns): at most a quarter wider or deeper than the model was made,
      // its door on the lot's front, toward the street
      const fx = (x1 - x0) / wideX;
      const fz = (y1 - y0) / wideZ;
      // (the capital's keep rises far over its own gate: the rest of it goes back behind its wall, out of anyone's way)
      const seat = b.style === 'keep' && b.pics[0]?.grim === true;
      const base = Math.min(fx, fz) * (seat ? 2.1 : 1);
      const sx = seat ? base : Math.min(fx, base * 1.25) * 1.03;
      const sz = seat ? base : Math.min(fz, base * 1.25) * 1.03;
      const sy = base * (seat ? 1 : 1.12);
      const cx = (x0 + x1) / 2 - ((mesh.min[0] + mesh.max[0]) / 2) * sx;
      const cz = y1 + 0.05 - mesh.max[2] * sz;
      const roof = this.roofOf(b.lot.tx, b.lot.ty);
      if (this.keepIt({ x: ((x0 + x1) / 2) * TILE, y: y1 * TILE - 2, kind: 'building', dy: -(mesh.max[1] * sy) * TILE })) this.add({ m: `${m}#${roof}`, x: cx, z: cz, rot: 0, sx, sy, sz, shadow: 0 });
      for (const y of b.yard) this.placeProp(y.prop, y.tx, y.ty);
      // its towers, where its plan has them
      if (seat) {
        for (const p of b.pics.slice(1)) {
          const [bx0, , bx1, by1] = picBody(p);
          const round = p.id.startsWith('tower_round');
          this.placePart({ m: round ? 'b_tower_B' : 'b_tower_A', h: round ? 19 : 14, x: (bx0 + bx1) / 2 / ART_TILE, z: by1 / ART_TILE - 0.6, shadow: 2.2 }, 0, 0);
        }
      }
    }
    for (const pm of map.markers) {
      if (!this.shown(pm)) continue;
      const m = pm.marker;
      const x = pm.tx + 0.5;
      const z = pm.ty + 0.5;
      const wx = x * TILE;
      const wy = (pm.ty + 1) * TILE - 3;
      if (m.kind === 'prop') this.placeProp(m.prop, pm.tx, pm.ty);
      else if (m.kind === 'waystone') {
        if (this.keepIt({ x: wx, y: wy, kind: 'waystone', dy: -30 })) {
          // (of the land's own stone, its rune in the land's own light)
          const ws = WAYSTONES[region.theme] ?? WAYSTONES.default!;
          const wc = hexRgb(ws[0]);
          this.add({ m: 'statue_obelisk', x, z, rot: 0, sx: this.sized('statue_obelisk', 2.5), shadow: 0.7, r: wc[0], g: wc[1], b: wc[2] });
          this.glows.push({ x, z, y: 1.5, color: ws[1], size: 16 });
        }
      } else if (m.kind === 'shrine') {
        if (this.keepIt({ x: wx, y: wy, kind: 'shrine', dy: -24 })) this.add({ m: 'shrine_candles', x, z, rot: 0, sx: this.sized('shrine_candles', 1.9), shadow: 0.8 });
      } else if (m.kind === 'exit' && !look.indoor && !m.door) {
        const dungeon = REGIONS[m.to]?.kind === 'dungeon';
        const near = this.objects.some((o) => o.kind === (dungeon ? 'gate' : 'sign') && Math.abs(o.x - wx) < 3 * TILE && Math.abs(o.y - wy) < 3 * TILE);
        if (near || !this.keepIt({ x: wx, y: wy, kind: dungeon ? 'gate' : 'sign', dy: -24 })) continue;
        if (!dungeon) {
          // a signpost beside the road out
          this.add({ m: 'sign_both', x: x - 1.1, z: z + 0.2, rot: 0, sx: this.fitted('sign_both', 1.35, 0.9), shadow: 0.5 });
          continue;
        }
        const door = ENTRANCES[m.to] ?? { m: 'cave_rock', w: 3 };
        const mesh = this.pack(door.m);
        if (mesh) {
          // (some gates lie along the model's other axis: turned to face the road, and sized by their real width)
          const xw = mesh.max[0] - mesh.min[0];
          const zw = mesh.max[2] - mesh.min[2];
          const turned = zw > xw;
          const k = Math.min(door.w / Math.max(0.01, turned ? zw : xw), 4.2 / Math.max(0.01, mesh.max[1] - mesh.min[1]));
          const mx = ((mesh.min[0] + mesh.max[0]) / 2) * k;
          const mz = ((mesh.min[2] + mesh.max[2]) / 2) * k;
          const c = door.tint ? hexRgb(door.tint) : ([1, 1, 1] as const);
          this.add({ m: door.m, x: x - (turned ? mz : mx), z: z - (turned ? -mx : mz) - 0.35, rot: turned ? Math.PI / 2 : 0, sx: k, r: c[0], g: c[1], b: c[2] });
        }
      }
    }
  }

  /** A dais is a low step of stone under what stands on it. */
  private placeSlabs(): void {
    for (const pm of this.map.markers) {
      if (pm.marker.kind !== 'prop' || pm.marker.prop.split(':')[0] !== 'dais' || !this.shown(pm)) continue;
      const stone = hexRgb(this.look.stone?.brick[0] ?? '#8a8698');
      this.add({ m: 'statue_block', x: pm.tx + 0.5, z: pm.ty + 0.5, rot: 0, sx: 11 / Math.max(0.01, this.spanOf('statue_block', 0)), sy: 0.14 / Math.max(0.01, this.spanOf('statue_block', 1)), sz: 4 / Math.max(0.01, this.spanOf('statue_block', 2)), r: stone[0], g: stone[1], b: stone[2] });
    }
  }

  private spanOf(id: string, axis: 0 | 1 | 2): number {
    const m = this.pack(id);
    return m ? m.max[axis] - m.min[axis] : 1;
  }

  /** One piece of a great work, its foot at (cx + part.x, cz + part.z) in tiles. */
  placePart(p: GreatPart, cx: number, cz: number): void {
    const tipX = ((p.tipX ?? 0) * Math.PI) / 180;
    const tipZ = ((p.tipZ ?? 0) * Math.PI) / 180;
    const rot = ((p.rot ?? 0) * Math.PI) / 180;
    const c = p.tint ? hexRgb(p.tint) : ([1, 1, 1] as const);
    const dim = this.region.kind === 'dungeon' ? 0.86 : 1;
    if (p.kit) {
      this.colossi.push({ kit: p.kit, x: cx + p.x, z: cz + p.z, lift: p.y ?? 0, rot, h: p.h ?? 8, clip: p.clip ?? 'idle', t: p.t ?? 0, tint: [c[0] * dim, c[1] * dim, c[2] * dim], tipX, tipZ, stone: p.stone ?? 1 });
      return;
    }
    const mesh = this.pack(p.m!);
    if (!mesh) return;
    const w = Math.max(0.01, mesh.max[0] - mesh.min[0]);
    const t = Math.max(0.01, mesh.max[1] - mesh.min[1]);
    const d = Math.max(0.01, mesh.max[2] - mesh.min[2]);
    const k = (p.h ?? 1) / t;
    const sx = p.box ? p.box[0] / w : k;
    const sy = p.box ? p.box[1] / t : k;
    const sz = p.box ? p.box[2] / d : k;
    // its foot's middle goes on the spot, however it's turned or tipped
    const foot = new THREE.Vector3(((mesh.min[0] + mesh.max[0]) / 2) * sx, mesh.min[1] * sy, ((mesh.min[2] + mesh.max[2]) / 2) * sz).applyEuler(new THREE.Euler(tipX, rot, tipZ, 'YXZ'));
    const y = p.y ?? 0;
    const sunk = y < 0 || tipX !== 0 || tipZ !== 0;
    const roofed = p.m!.startsWith('b_') && !p.tint && !p.m!.includes('#') ? `${p.m}#${this.roofOf(Math.floor(cx), Math.floor(cz))}` : p.m!;
    const piece: Giant = { m: `${sunk ? '~' : ''}${roofed}`, x: cx + p.x - foot.x, z: cz + p.z - foot.z, y: y - foot.y, rot, sx, sy, sz, r: c[0] * dim, g: c[1] * dim, b: c[2] * dim, sway: p.sway ?? 0, shadow: p.shadow ?? 0, shadowD: p.shadowD ?? 1, tipX, tipZ, reach: Math.max(w * sx, t * sy, d * sz) + 2 };
    this.giants.push(piece);
    if (p.flame) this.flames.push({ x: cx + p.x, z: cz + p.z, y: y + (p.flameY ?? 1), size: p.flame });
    if (p.glow) this.glows.push({ x: cx + p.x, z: cz + p.z, y: y + (p.glowY ?? t * sy), color: p.glow, size: p.glowSize ?? 16 });
  }

  /** A great work, by its name in the table. */
  private placeGreat(id: string, tx: number, ty: number): void {
    const work = GREAT[id];
    if (!work) return;
    this.objects.push({ x: (tx + 0.5) * TILE, y: (ty + 1) * TILE, kind: 'great', name: id, dy: -200 });
    for (const p of work.parts) this.placePart(p, tx + 0.5, ty + 0.5);
  }

  private placeProp(prop: string, tx: number, ty: number): void {
    const [name, param] = prop.split(':') as [string, string | undefined];
    if (name === 'great') {
      this.placeGreat(param!, tx, ty);
      return;
    }
    const def = PROPS[name];
    const x = tx + 0.5;
    const z = ty + 0.5;
    const wx = x * TILE;
    const wy = (ty + 1) * TILE - 3;
    const o: LandObject = { x: wx, y: wy, kind: 'prop', name, dy: -(def?.h ?? TILE) };
    if (!this.keepIt(o) || !def || !def.m) return;
    const mesh = this.pack(def.m);
    if (!mesh) return;
    const size = sizeWithin(mesh, def);
    let tint = def.tint;
    if (param?.startsWith('#')) tint = param;
    const c = tint ? hexRgb(tint) : ([1, 1, 1] as const);
    // (a little turn of its own for loose things; furniture stands square)
    const loose = !def.across && !def.flat && (def.w ?? TILE) < 30;
    const rot = size.rot + (loose ? (hash2(tx, ty, 3) - 0.5) * 0.5 : 0);
    // (a building-pack model carries the land's own roof color)
    const model = def.m.startsWith('b_') && !tint ? `${def.m}#${this.roofOf(tx, ty)}` : def.m;
    // (its middle on the tile, whatever the model's own origin)
    const big = (def.w ?? 0) > 40;
    const ox = big ? -((mesh.min[0] + mesh.max[0]) / 2) * size.sx : 0;
    const oz = big ? -((mesh.min[2] + mesh.max[2]) / 2) * size.sz : 0;
    const sw = def.w ?? TILE;
    this.add({ m: model, x: x + ox, z: z + oz, rot, sx: size.sx, sy: size.sy, sz: size.sz, shadow: def.flat || (def.h ?? 0) < 12 ? 0 : Math.min(2.4, (sw / TILE) * 0.65), shadowD: Math.min(1, (def.d ?? sw) / sw + 0.1), y: def.flat ? 0.02 : 0, r: c[0], g: c[1], b: c[2] });
    if (def.flame) this.flames.push({ x, z, y: (def.flameAt ?? 10) / TILE, size: def.flame });
    if (def.glow) this.glows.push({ x, z, y: ((def.h ?? 10) + 2) / TILE, color: def.glow, size: 9 });
    if (def.hero) this.statues.push({ x: x * TILE, y: z * TILE, h: def.hero, lift: (def.h ?? 0) / TILE, tint: c });
  }

  private standOf(id: string, want: number): Stand | null {
    let s = this.stands.get(id);
    if (!s) {
      const m = this.pack(id);
      if (!m) return null;
      const plain = id.replace('~', '');
      // (a person's parts and weapons keep their own colors: bone is bone, gold is gold)
      s = new Stand(m, this.group, Math.max(16, want), this.packs.hero.meshes[plain] === m ? m.col : colorsFor(m, this.look, plain), id.startsWith('~'));
      this.stands.set(id, s);
    }
    return s;
  }

  /**
   * Is a spot hidden behind something solid from where the camera is? Spells and numbers go on a layer of their own
   * over the land, so they ask this first rather than shine through a wall.
   */
  hidden(x: number, y: number, h: number): boolean {
    const m = this.map;
    const tx = Math.floor(x / TILE);
    if (tx < 0 || tx >= m.w) return false;
    const rise = Math.tan(PITCH);
    const y0 = y / TILE;
    for (let d = 0; d < 5; d++) {
      const ty = Math.floor(y0) + d + 1;
      if (ty >= m.h) return false;
      // the height of the line of sight as it comes over this row's near edge
      const sight = h / TILE + (ty + 1 - y0) * rise;
      if (sight > 3.4) return false;
      const k = m.kind[ty * m.w + tx];
      const tall = k === K.Wall || k === K.Illusion ? this.wallH : k === K.Rampart ? 2.4 : k === K.House ? 3.2 : 0;
      if (tall > sight) return true;
    }
    return false;
  }

  /** The fires nearest the view light the dark round them. */
  lightFlames(camX: number, camZ: number): void {
    const list = LIGHT.uFlames.value;
    const near = this.flames
      .map((f) => ({ f, d: Math.hypot(f.x - camX, f.z - camZ) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, list.length);
    for (let i = 0; i < list.length; i++) {
      const n = near[i];
      if (n) list[i]!.set(n.f.x, n.f.z, 4.4 * n.f.size + 1);
      else list[i]!.set(0, 0, 0);
    }
  }

  /** Fills the instances from the cells round the camera (only when the camera has moved a cell's worth). */
  update(camX: number, camZ: number, spanX: number, spanZ: number): void {
    const cx = Math.floor(camX / 2);
    const cz = Math.floor(camZ / 2);
    if (cx === this.cx && cz === this.cz) return;
    this.cx = cx;
    this.cz = cz;
    const R = 3;
    const x0 = camX - spanX - R;
    const x1 = camX + spanX + R;
    const z0 = camZ - spanZ - R - 5;
    const z1 = camZ + spanZ + R + 2;
    const want = new Map<string, Placed[]>();
    const c0 = Math.floor(x0 / CELL);
    const c1 = Math.floor(x1 / CELL);
    const r0 = Math.floor(z0 / CELL);
    const r1 = Math.floor(z1 / CELL);
    let shadow = 0;
    const m4 = new THREE.Matrix4();
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const list = this.cells.get(cellKey(r, c));
        if (!list) continue;
        for (const p of list) {
          if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
          let w = want.get(p.m);
          if (!w) {
            w = [];
            want.set(p.m, w);
          }
          w.push(p);
          if (p.shadow > 0 && shadow < 600) {
            const size = p.shadow * 1.6;
            m4.makeScale(size, 1, size * (p.shadowD ?? 1));
            m4.setPosition(p.x, 0, p.z);
            this.shadows.setMatrixAt(shadow++, m4);
          }
        }
      }
    }
    for (const p of this.giants) {
      if (p.x + p.reach < x0 || p.x - p.reach > x1 || p.z + p.reach < z0 || p.z - p.reach > z1) continue;
      let w = want.get(p.m);
      if (!w) {
        w = [];
        want.set(p.m, w);
      }
      w.push(p);
      if (p.shadow > 0 && shadow < 600) {
        const size = p.shadow * 1.6;
        m4.makeScale(size, 1, size * (p.shadowD ?? 1));
        m4.setPosition(p.x, 0, p.z);
        this.shadows.setMatrixAt(shadow++, m4);
      }
    }
    this.shadows.count = shadow;
    this.shadows.instanceMatrix.needsUpdate = true;
    for (const [id, s] of this.stands) {
      if (want.has(id)) continue;
      s.begin();
      s.end();
    }
    for (const [id, list] of want) {
      let s = this.standOf(id, list.length + 40);
      if (!s) continue;
      if (list.length > (s as unknown as { cap: number }).cap) {
        s.dispose();
        this.stands.delete(id);
        s = this.standOf(id, list.length * 2)!;
      }
      s.begin();
      for (const p of list) s.put(p.x, p.y, p.z, p.rot, p.sx, p.sy, p.sz, p.r, p.g, p.b, p.sway, p.tipX ?? 0, p.tipZ ?? 0);
      s.end();
    }
  }

  /** Doors rise and sink as the rules open and shut them; a cracked wall is there until it is broken. */
  updateDoors(dt: number): void {
    const look = this.look;
    const tall = look.indoor ? 1.45 : 1.3;
    this.doorStand.begin();
    for (const d of this.doors) {
      const solid = this.map.solid[d.i] ? 1 : 0;
      const kind = this.map.kind[d.i];
      const target = kind === d.k ? solid : 0;
      d.h += (target - d.h) * Math.min(1, dt * 6);
      if (d.h < 0.02) continue;
      this.doorStand.put(d.x + 0.5, 0, d.y + 0.5, 0, 1, d.h * tall, 1, 1, 1, 1, 0);
    }
    this.doorStand.end();
  }

  dispose(): void {
    for (const s of this.stands.values()) s.dispose();
    this.stands.clear();
    this.doorStand.dispose();
    this.ground.geometry.dispose();
    const mat = this.ground.material as THREE.ShaderMaterial;
    (mat.uniforms.uMask!.value as THREE.Texture).dispose();
    mat.dispose();
    this.blocks.geometry.dispose();
    (this.blocks as THREE.InstancedMesh).dispose();
    this.planks.geometry.dispose();
    (this.planks as THREE.InstancedMesh).dispose();
    this.shadows.geometry.dispose();
    this.shadows.dispose();
    this.group.clear();
    this.under.clear();
  }
}

/** A unit block standing on the ground. */
function boxMesh(c: readonly number[]): MeshData {
  const b = new THREE.BoxGeometry(1, 1, 1);
  b.translate(0, 0.5, 0);
  const pos = b.getAttribute('position');
  const nor = b.getAttribute('normal');
  const n = pos.count;
  const out: MeshData = {
    n,
    i: b.index!.count,
    min: [-0.5, 0, -0.5],
    max: [0.5, 1, 0.5],
    pos: Float32Array.from(pos.array as Float32Array),
    nor: Int8Array.from(nor.array as Float32Array, (x) => x * 127),
    sn: Int8Array.from(nor.array as Float32Array, (x) => x * 127),
    col: new Uint8Array(n * 3),
    idx: Uint16Array.from(b.index!.array as Uint16Array),
  };
  for (let i = 0; i < n; i++) {
    const t = pos.getY(i) > 0.5 ? 1.1 : 0.82;
    out.col[i * 3] = Math.min(255, c[0]! * 255 * t);
    out.col[i * 3 + 1] = Math.min(255, c[1]! * 255 * t);
    out.col[i * 3 + 2] = Math.min(255, c[2]! * 255 * t);
  }
  return out;
}
