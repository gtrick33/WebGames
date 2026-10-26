import type { Theme } from '../../data/types';
import type { Derived, Grade, LookKey } from './atlas';

/**
 * Every land's look in the packed art (VISUAL_BIBLE.md): which Royal Keep season it starts from, the
 * grade that gives it its own palette, the ground it lies on, which trees, bushes and rocks grow
 * there, and what its water is. Indoor places use the castle-interior pieces with their own grade.
 *
 * One family of art for the whole kingdom; the regions differ by season, grade, vegetation and
 * dressing rather than by mixing packs.
 */

export type BaseGround = 'grass' | 'sand' | 'ash' | 'snow';

export interface Biome {
  look: LookKey;
  /** What most of the open land is. */
  base: BaseGround;
  /** Patches of a second ground over the base (darker grass in woods, mud in marshes), by share of the land. */
  patches?: { set: string; share: number };
  /** The open-ground decals scattered on Deco tiles. */
  decals: string[];
  trees: string[];
  bushes: string[];
  rocks: string[];
  /** Woods and walls at the map's edge: a forest of trees, or rock ledges (bare lands), or the stone of a wall. */
  edge: 'forest' | 'ledge';
  /** Small plants dotted about the open ground (never in the way: drawn flat). */
  flora: string[];
}

/** Indoor places: floors and walls from the castle-interior pieces. */
export interface Interior {
  grade: Grade;
  floor: string[];
  wall: string;
  /** Floor decals and dressing set along walls. */
  dressing: string[];
}

const LEAF = ['tree_big_leaf', 'tree_mid_leaf', 'tree_small_leaf', 'tree_big2_leaf', 'tree_tall_leaf', 'tree_apple'];
const TEAL = ['tree_big_teal', 'tree_mid_teal', 'tree_small_teal', 'tree_big_mint', 'tree_mid_mint', 'tree_tall_mint'];
const PINES = ['pine_big_green', 'pine_mid_green', 'pine_big', 'pine_mid', 'pine_small'];
const DEAD = ['tree_dead'];
const BUSH = ['bush_leaf', 'bush_small_leaf', 'bush_wide', 'bush_berry'];
const ROCK = ['rock_1', 'rock_2', 'rock_3', 'rock_4', 'rock_5'];
const MOSSY = ['rock_mossy_1', 'rock_mossy_2', 'rock_3', 'rock_tall'];
const FLOWERS = ['decal_flowers_1', 'decal_flowers_2', 'decal_flowers_3', 'decal_clover_1', 'decal_clover_2', 'decal_tuft_1', 'decal_tuft_2'];
const DRY = ['decal_pebbles_1', 'decal_pebbles_2', 'decal_pebbles_3', 'decal_crack_1', 'decal_worn_1', 'decal_tuft_3'];
const GLOOM = ['decal_moss_1', 'decal_moss_2', 'decal_leaves_1', 'decal_leaves_2', 'decal_tuft_2', 'decal_puddle_1'];

/** Sand and ash are made from the dirt tiles at load; snow is the winter season's own grass. */
const SAND: Derived = { name: 'sand', from: 'dirt', grade: { tint: ['#f0d28c', 0.55], bright: 0.08, sat: 1.1 } };
const ASH: Derived = { name: 'ash', from: 'dirt', grade: { sat: 0.12, bright: -0.04, tint: ['#8a8480', 0.3], contrast: 0.85 } };
const MUD: Derived = { name: 'mud', from: 'dirt', grade: { tint: ['#6a6a44', 0.5], bright: -0.04, sat: 0.7 } };

const MURK: Grade = { tint: ['#5a7a52', 0.5], bright: -0.08, sat: 0.8 };
const TOXIC: Grade = { tint: ['#8ad04a', 0.55], bright: -0.04 };
const LAVA: Grade = { hue: 165, tint: ['#ff7a2a', 0.7], bright: 0.08, sat: 1.4 };
const DEEP: Grade = { tint: ['#2a4a7a', 0.45], bright: -0.12 };

const biome = (b: Omit<Biome, 'decals' | 'flora'> & Partial<Pick<Biome, 'decals' | 'flora'>>): Biome => ({ decals: FLOWERS, flora: ['flowers_white', 'flowers_yellow', 'tall_grass_1', 'tall_grass_2'], ...b });

export const BIOMES: Partial<Record<Theme, Biome>> = {
  village: biome({ look: { season: 'summer', grade: {} }, base: 'grass', patches: { set: 'lgrass', share: 0.18 }, trees: LEAF, bushes: BUSH, rocks: ROCK, edge: 'forest' }),
  forest: biome({
    look: { season: 'summer', grade: { sat: 0.95, bright: -0.06 } },
    base: 'grass',
    patches: { set: 'dgrass', share: 0.45 },
    trees: [...TEAL, ...PINES.slice(0, 2), 'tree_big_leaf'],
    bushes: ['bush_teal', 'bush_small_teal', 'bush_mint', 'bush_leaf'],
    rocks: MOSSY,
    edge: 'forest',
    flora: ['mushroom_brown', 'mushroom_red', 'tall_grass_2', 'tall_grass_3', 'flowers_blue'],
  }),
  farm: biome({ look: { season: 'summer', grade: { tint: ['#e8d070', 0.08], sat: 1.05 } }, base: 'grass', patches: { set: 'lgrass', share: 0.3 }, trees: [...LEAF, 'tree_orange'], bushes: BUSH, rocks: ROCK, edge: 'forest', flora: ['flowers_yellow', 'flowers_white', 'tall_grass_1', 'hay_pile'] }),
  coast: biome({ look: { season: 'summer', grade: { tint: ['#d8f0e0', 0.08], bright: 0.03 }, derived: [SAND] }, base: 'grass', patches: { set: 'sand', share: 0.35 }, trees: ['tree_big_mint', 'tree_mid_mint', 'pine_mid_green'], bushes: ['bush_mint', 'bush_small_mint', 'bush_wide'], rocks: ROCK, edge: 'forest', flora: ['reeds', 'reeds_2', 'tall_grass_1'] }),
  autumn: biome({ look: { season: 'autumn', grade: {} }, base: 'grass', patches: { set: 'dgrass', share: 0.25 }, trees: ['tree_big_amber', 'tree_big_coral', 'tree_mid_amber', 'tree_mid_coral', 'tree_orange', 'pine_mid'], bushes: ['bush_amber', 'bush_coral', 'bush_small_amber'], rocks: MOSSY, edge: 'forest', decals: [...FLOWERS, 'decal_leaves_1', 'decal_leaves_2'] }),
  marsh: biome({
    look: { season: 'summer', grade: { sat: 0.72, tint: ['#7a8a5a', 0.18], bright: -0.06 }, water: MURK, derived: [MUD] },
    base: 'grass',
    patches: { set: 'mud', share: 0.18 },
    trees: ['tree_dead', 'tree_tall_mint', 'tree_big_teal', 'pine_mid'],
    bushes: ['bush_teal', 'bush_wide'],
    rocks: MOSSY,
    edge: 'forest',
    decals: GLOOM,
    flora: ['reeds', 'reeds_2', 'lilypad', 'mushroom_brown'],
  }),
  plague: biome({
    look: { season: 'autumn', grade: { sat: 0.6, tint: ['#8a9a40', 0.22], bright: -0.08 }, water: TOXIC, derived: [MUD] },
    base: 'grass',
    patches: { set: 'mud', share: 0.35 },
    trees: ['tree_dead', 'tree_dead', 'tree_mid_amber', 'tree_small_amber'],
    bushes: ['bush_small_amber', 'bush_wide'],
    rocks: MOSSY,
    edge: 'forest',
    decals: GLOOM,
    flora: ['mushroom_red', 'mushroom_blue', 'mushroom_brown', 'reeds'],
  }),
  plains: biome({ look: { season: 'summer', grade: { tint: ['#f0d860', 0.14], sat: 1.05, bright: 0.02 } }, base: 'grass', patches: { set: 'lgrass', share: 0.4 }, trees: ['tree_big_leaf', 'tree_orange', 'tree_mid_leaf', 'pine_mid_green'], bushes: BUSH, rocks: ROCK, edge: 'forest', flora: ['flowers_yellow', 'tall_grass_1', 'tall_grass_2', 'hay_pile'] }),
  mountain: biome({ look: { season: 'summer', grade: { sat: 0.82, tint: ['#9ab0c0', 0.1] } }, base: 'grass', patches: { set: 'dgrass', share: 0.35 }, trees: PINES, bushes: ['bush_small_teal', 'bush_teal'], rocks: [...ROCK, 'rock_tall'], edge: 'ledge', decals: DRY }),
  barrow: biome({ look: { season: 'autumn', grade: { sat: 0.45, bright: -0.12, tint: ['#8a8a9a', 0.15] } }, base: 'grass', patches: { set: 'dgrass', share: 0.4 }, trees: ['tree_dead', 'tree_dead', 'pine_mid'], bushes: ['bush_small_amber'], rocks: MOSSY, edge: 'ledge', decals: [...GLOOM, 'decal_crack_2'], flora: ['tall_grass_3', 'mushroom_brown'] }),
  storm: biome({ look: { season: 'summer', grade: { sat: 0.7, bright: -0.14, tint: ['#5a7aa0', 0.18] }, water: DEEP }, base: 'grass', patches: { set: 'dgrass', share: 0.4 }, trees: [...PINES, 'tree_dead'], bushes: ['bush_teal'], rocks: MOSSY, edge: 'ledge', decals: GLOOM }),
  moor: biome({ look: { season: 'autumn', grade: { sat: 0.55, bright: -0.12, tint: ['#8a6a9a', 0.2] } }, base: 'grass', patches: { set: 'dgrass', share: 0.45 }, trees: ['tree_dead', 'pine_mid', 'tree_dead'], bushes: ['bush_small_coral', 'bush_wide'], rocks: MOSSY, edge: 'ledge', decals: GLOOM, flora: ['tall_grass_3', 'flowers_violet'] }),
  desert: biome({ look: { season: 'summer', grade: { tint: ['#f0c070', 0.18], bright: 0.04 }, derived: [SAND] }, base: 'sand', patches: { set: 'dirt', share: 0.15 }, trees: ['tree_dead', 'tree_small_amber'], bushes: ['bush_small_amber'], rocks: ['rock_sand', 'rock_tall', 'rock_4', 'rock_5'], edge: 'ledge', decals: DRY, flora: ['tall_grass_1'] }),
  fey: biome({ look: { season: 'summer', grade: { hue: -18, sat: 1.15, tint: ['#9af0e0', 0.08] } }, base: 'grass', patches: { set: 'lgrass', share: 0.3 }, trees: ['tree_blossom', 'tree_big_mint', 'tree_big_coral', 'tree_big2_mint', 'tree_tall_coral'], bushes: ['bush_rose', 'bush_coral', 'bush_mint'], rocks: MOSSY, edge: 'forest', flora: ['mushroom_blue', 'flowers_pink', 'flowers_violet', 'flowers_blue'] }),
  snow: biome({ look: { season: 'winter', grade: {} }, base: 'snow', trees: ['pine_snowy', 'pine_big', 'pine_mid', 'tree_dead'], bushes: ['bush_small_leaf', 'bush_wide'], rocks: ROCK, edge: 'ledge', decals: ['decal_pebbles_1', 'decal_tuft_3'], flora: ['tall_grass_3'] }),
  rift: biome({ look: { season: 'autumn', grade: { hue: 70, sat: 0.8, bright: -0.1, tint: ['#7a4ab0', 0.25] } }, base: 'grass', patches: { set: 'dgrass', share: 0.5 }, trees: ['tree_dead', 'tree_big_coral', 'tree_mid_coral'], bushes: ['bush_coral'], rocks: ['rock_tall', 'rock_mossy_1', 'rock_3'], edge: 'ledge', decals: GLOOM, flora: ['mushroom_blue', 'flowers_violet'] }),
  jungle: biome({ look: { season: 'summer', grade: { sat: 1.2, bright: -0.04, tint: ['#30a050', 0.1] } }, base: 'grass', patches: { set: 'dgrass', share: 0.55 }, trees: ['tree_big2_mint', 'tree_big_teal', 'tree_tall_mint', 'tree_big_mint', 'tree_big2_leaf'], bushes: ['bush_teal', 'bush_mint', 'bush_berry'], rocks: MOSSY, edge: 'forest', flora: ['tall_grass_2', 'tall_grass_3', 'flowers_red', 'mushroom_red'] }),
  warfront: biome({ look: { season: 'autumn', grade: { sat: 0.6, bright: -0.08, tint: ['#9a7a5a', 0.15] }, derived: [ASH] }, base: 'grass', patches: { set: 'ash', share: 0.35 }, trees: ['tree_dead', 'tree_dead', 'tree_mid_amber'], bushes: ['bush_small_amber'], rocks: ROCK, edge: 'ledge', decals: [...DRY, 'decal_straw_1'], flora: ['tall_grass_3'] }),
  blight: biome({ look: { season: 'autumn', grade: { sat: 0.4, bright: -0.16, tint: ['#6a4a7a', 0.2] }, water: TOXIC, derived: [MUD] }, base: 'grass', patches: { set: 'mud', share: 0.45 }, trees: DEAD, bushes: ['bush_small_coral'], rocks: MOSSY, edge: 'ledge', decals: GLOOM, flora: ['mushroom_red', 'mushroom_blue'] }),
  haunted: biome({ look: { season: 'winter', grade: { sat: 0.5, bright: -0.2, tint: ['#4a6a8a', 0.25] }, water: DEEP }, base: 'snow', trees: ['tree_dead', 'pine_mid', 'tree_dead'], bushes: ['bush_wide'], rocks: MOSSY, edge: 'ledge', decals: GLOOM, flora: ['tall_grass_3'] }),
  volcanic: biome({ look: { season: 'autumn', grade: { sat: 0.5, bright: -0.18, tint: ['#5a3a30', 0.3] }, water: LAVA, derived: [ASH] }, base: 'ash', patches: { set: 'dirt', share: 0.2 }, trees: DEAD, bushes: ['bush_small_amber'], rocks: ['rock_tall', 'rock_4', 'rock_5', 'rock_sand'], edge: 'ledge', decals: DRY, flora: [] }),
  deadlake: biome({ look: { season: 'winter', grade: { sat: 0.35, bright: -0.18, tint: ['#5a6a7a', 0.2] }, water: DEEP }, base: 'snow', trees: DEAD, bushes: ['bush_wide'], rocks: ROCK, edge: 'ledge', decals: GLOOM, flora: [] }),
  peaks: biome({ look: { season: 'winter', grade: { tint: ['#c0d8f0', 0.08] } }, base: 'snow', trees: ['pine_snowy', 'pine_snowy', 'pine_big'], bushes: ['bush_wide'], rocks: ['rock_tall', 'rock_1', 'rock_2'], edge: 'ledge', decals: ['decal_pebbles_2'], flora: [] }),
  sunken: biome({ look: { season: 'summer', grade: { sat: 0.7, bright: -0.12, tint: ['#3a8a8a', 0.25] }, water: DEEP, derived: [MUD] }, base: 'grass', patches: { set: 'mud', share: 0.3 }, trees: ['tree_dead', 'tree_tall_mint', 'tree_big_teal'], bushes: ['bush_teal'], rocks: MOSSY, edge: 'forest', decals: GLOOM, flora: ['reeds', 'lilypad', 'reeds_2'] }),
  bonefield: biome({ look: { season: 'autumn', grade: { sat: 0.35, bright: -0.04, tint: ['#c0b08a', 0.25] }, derived: [SAND] }, base: 'sand', patches: { set: 'dirt', share: 0.3 }, trees: DEAD, bushes: ['bush_small_amber'], rocks: ['rock_sand', 'rock_tall', 'rock_4'], edge: 'ledge', decals: DRY, flora: [] }),
  gloam: biome({ look: { season: 'summer', grade: { sat: 0.6, bright: -0.24, tint: ['#2a6a5a', 0.3] }, water: DEEP }, base: 'grass', patches: { set: 'dgrass', share: 0.6 }, trees: ['tree_tall_mint', 'tree_dead', 'tree_big_teal'], bushes: ['bush_teal'], rocks: MOSSY, edge: 'forest', decals: GLOOM, flora: ['mushroom_blue', 'reeds'] }),
  pale: biome({ look: { season: 'winter', grade: { sat: 0.3, bright: -0.08, tint: ['#9a9ac0', 0.2] } }, base: 'snow', trees: ['tree_dead', 'pine_snowy'], bushes: ['bush_wide'], rocks: ['rock_tall', 'rock_2'], edge: 'ledge', decals: GLOOM, flora: [] }),
};

const STONE = ['floor/stone_floor_1', 'floor/stone_floor_2', 'floor/stone_floor_3'];

export const INTERIORS: Partial<Record<Theme, Interior>> = {
  crypt: { grade: { tint: ['#7a70a0', 0.25], bright: -0.06 }, floor: ['floor/dungeon_floor', 'floor/flagstone', ...STONE], wall: 'walls/dark_stone_wall', dressing: ['props/skull_pile', 'props/candelabra', 'props/clay_pot'] },
  cave: { grade: { tint: ['#8a7a60', 0.3], bright: -0.04 }, floor: ['floor/dark_stone_floor', 'floor/dungeon_floor', 'floor/moss_floor'], wall: 'walls/mossy_wall', dressing: ['props/wooden_crate', 'props/barrel', 'props/skull_pile'] },
  cistern: { grade: { tint: ['#6a9a5a', 0.3], bright: -0.06 }, floor: ['floor/moss_floor', 'floor/dungeon_floor', 'floor/flagstone'], wall: 'walls/mossy_wall', dressing: ['props/clay_pot', 'props/skull_pile'] },
  keep: { grade: { tint: ['#9a8070', 0.18] }, floor: ['floor/flagstone', ...STONE], wall: 'walls/brick_wall', dressing: ['props/weapon_rack', 'props/barrel', 'props/knight_armor_stand', 'props/wooden_crate'] },
  icecave: { grade: { tint: ['#a8d0f0', 0.4], bright: 0.04 }, floor: ['floor/stone_floor_2', 'floor/flagstone'], wall: 'walls/blue_stone_wall', dressing: ['props/skull_pile', 'props/clay_pot'] },
  temple: { grade: { tint: ['#e0b860', 0.28] }, floor: ['floor/checker_floor', 'floor/flagstone', ...STONE], wall: 'walls/brick_wall', dressing: ['props/candelabra', 'props/golden_goblet', 'props/clay_pot'] },
  lavacave: { grade: { tint: ['#a04a30', 0.35], bright: -0.06 }, floor: ['floor/dark_stone_floor', 'floor/dungeon_floor'], wall: 'walls/cracked_wall', dressing: ['props/brazier', 'props/skull_pile'] },
  citadel: { grade: { tint: ['#6a5a8a', 0.3], bright: -0.08 }, floor: ['floor/dark_stone_floor', 'floor/flagstone'], wall: 'walls/dark_stone_wall', dressing: ['props/candelabra', 'props/heraldic_shield'] },
  roots: { grade: { tint: ['#6a8a40', 0.35], bright: -0.08 }, floor: ['floor/moss_floor', 'floor/dark_stone_floor'], wall: 'walls/mossy_wall', dressing: ['props/clay_pot'] },
  riftspire: { grade: { tint: ['#8a4ac0', 0.35], bright: -0.06 }, floor: ['floor/dark_stone_floor', 'floor/checker_floor'], wall: 'walls/dark_stone_wall', dressing: ['props/candelabra', 'props/globe'] },
};
