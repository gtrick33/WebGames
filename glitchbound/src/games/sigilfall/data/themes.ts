import type { Theme } from './types';

/**
 * How every land looks: the ground's colors (grass, paths, water, sand, the canopy of woods and cliffs
 * seen from above), the stone of indoor places, which trees grow, what drifts in the air, and its
 * colors on the minimap and the map screen. The ground painter, the scenery and the UI all read this,
 * so a new biome is one entry here.
 */

export type TreeKind = 'oak' | 'pine' | 'palm' | 'snowpine' | 'dead' | 'cactus' | 'mushroom' | 'crystal' | 'willow' | 'jungle';
export type Ambient = 'leaves' | 'seeds' | 'spray' | 'snow' | 'ash' | 'spores' | 'motes' | 'embers' | 'dust';

/** Outdoor ground, darkest to lightest within each list. */
export interface GroundColors {
  grass: [string, string, string, string, string];
  blade: string;
  bladeHi: string;
  flowers: [string, string, string, string, string];
  path: [string, string, string, string];
  pebble: string;
  /** The canopy (woods, or cliffs and outcrops in bare lands). */
  leaf: [string, string, string, string, string, string];
  water: { deep: string; mid: string; shallow: string; light: string; foam: string; bank: string; bankDark: string };
  sand: [string, string, string, string, string];
  shell: [string, string];
}

/** Indoor stone: worn floor slabs, wall tops and brick faces. */
export interface StoneColors {
  slab: [string, string, string, string];
  mortar: string;
  top: string;
  topHi: string;
  lip: string;
  lip2: string;
  brick: [string, string, string];
  brickMortar: string;
  moss: string;
  crack: string;
}

export interface ThemeLook {
  indoor: boolean;
  /** Behind the map (outside its edge). */
  bg: string;
  ground: GroundColors;
  stone?: StoneColors;
  /** Trees on tree tiles, picked by weight (repeat a kind to weigh it). */
  trees: TreeKind[];
  /** Leaves of trees and bushes, and their bark. */
  leaves: [string, string, string, string, string, string];
  bark: string;
  ambient?: Ambient;
  /** Its water is lava. */
  lava?: boolean;
  /** A color laid thin over everything (gloomy lands). */
  tint?: string;
}

/* ---------------------------------------------------------------- shared */

const SAND: GroundColors['sand'] = ['#c8a868', '#d8b878', '#e4c88a', '#efd69c', '#f6e2b0'];
const SHELL: GroundColors['shell'] = ['#fff2e8', '#d8a898'];
const DIRT: GroundColors['path'] = ['#a07648', '#b58a58', '#c99d66', '#d6ab74'];
const LAKE: GroundColors['water'] = { deep: '#2a62b4', mid: '#3478cc', shallow: '#4a92e0', light: '#7ab8f0', foam: '#d8f0ff', bank: '#5a4430', bankDark: '#3e2e22' };
const GREEN_LEAVES: ThemeLook['leaves'] = ['#174a22', '#22602e', '#2f7a3a', '#3c9445', '#56ac52', '#86d070'];

const CRYPT_STONE: StoneColors = {
  slab: ['#55536a', '#5b5970', '#504e65', '#58566d'],
  mortar: '#34324a',
  top: '#17152a',
  topHi: '#221f38',
  lip: '#3e3a5c',
  lip2: '#2c2844',
  brick: ['#6a6488', '#5e587c', '#726c90'],
  brickMortar: '#2a263e',
  moss: '#4e6e4a',
  crack: '#16132a',
};

/** An indoor theme: its stone, and ground colors only for the odd outdoor-looking tile. */
const indoor = (bg: string, stone: StoneColors, ambient?: Ambient): ThemeLook => ({
  indoor: true,
  bg,
  stone,
  ground: THEME_GROUND.village,
  trees: ['dead'],
  leaves: GREEN_LEAVES,
  bark: '#56381e',
  ...(ambient ? { ambient } : {}),
});

/* ---------------------------------------------------------------- ground */

const THEME_GROUND: Record<'village', GroundColors> = {
  village: {
    grass: ['#3f8a3c', '#4f9c45', '#5aaa4a', '#66b654', '#72c25e'],
    blade: '#86d066',
    bladeHi: '#a8e07e',
    flowers: ['#ff5a6c', '#ffd84d', '#ffffff', '#8ab4ff', '#ff9ad8'],
    path: DIRT,
    pebble: '#9a8a72',
    leaf: ['#184a24', '#22602e', '#2d7a3a', '#3c9447', '#5cb15c', '#7ccc6e'],
    water: LAKE,
    sand: SAND,
    shell: SHELL,
  },
};

export const THEMES: Record<Theme, ThemeLook> = {
  village: { indoor: false, bg: '#1f5a2a', ground: THEME_GROUND.village, trees: ['oak', 'oak', 'oak'], leaves: GREEN_LEAVES, bark: '#6a4424' },
  forest: {
    indoor: false,
    bg: '#123a22',
    ground: {
      grass: ['#357a42', '#44904e', '#4f9e58', '#58a862', '#64b46c'],
      blade: '#6cbe76',
      bladeHi: '#8ed690',
      flowers: ['#b0e05a', '#ffe07a', '#d8f0ff', '#ff9ad8', '#9ad0ff'],
      path: ['#806040', '#937046', '#a27e52', '#b08c5e'],
      pebble: '#7a6a58',
      leaf: ['#0f2c1b', '#163d25', '#1f5233', '#2b6a42', '#3f8a55', '#5aa86a'],
      water: { deep: '#20508e', mid: '#2a68b0', shallow: '#3a80cc', light: '#6aa8e6', foam: '#c8eaff', bank: '#4a3826', bankDark: '#30241a' },
      sand: ['#b89a62', '#c8a870', '#d4b680', '#e0c490', '#ead2a4'],
      shell: ['#f2ead8', '#b89a88'],
    },
    trees: ['oak', 'pine'],
    leaves: ['#0f3420', '#174a2c', '#1f5e35', '#2c7a44', '#45995a', '#6cbc7a'],
    bark: '#56381e',
    ambient: 'leaves',
  },
  farm: {
    indoor: false,
    bg: '#2a5a22',
    ground: {
      grass: ['#5a8a34', '#6a9a3c', '#78a844', '#86b64e', '#94c25a'],
      blade: '#a4cc5e',
      bladeHi: '#c4e07a',
      flowers: ['#ffd84d', '#ffffff', '#ff6a5a', '#8ab4ff', '#c88aff'],
      path: DIRT,
      pebble: '#9a8a72',
      leaf: ['#1e4a1e', '#2a6226', '#367a30', '#46923a', '#64ac4a', '#84c45e'],
      water: { ...LAKE, bank: '#6a4a2c', bankDark: '#4a3220' },
      sand: SAND,
      shell: SHELL,
    },
    trees: ['oak', 'oak', 'oak', 'pine'],
    leaves: ['#1e4a1e', '#2a6226', '#367a30', '#46923a', '#64ac4a', '#84c45e'],
    bark: '#6a4424',
    ambient: 'seeds',
  },
  coast: {
    indoor: false,
    bg: '#1e6a8a',
    ground: {
      grass: ['#7a9a4a', '#8aa852', '#98b45c', '#a6c066', '#b4ca72'],
      blade: '#c2d27a',
      bladeHi: '#d8e29a',
      flowers: ['#ff9ab8', '#ffffff', '#ffe07a', '#b8d8ff', '#ffb07a'],
      path: ['#a88a5a', '#b89a68', '#c8a878', '#d4b486'],
      pebble: '#a89a82',
      leaf: ['#16402a', '#1e5634', '#286c40', '#36844c', '#52a060', '#74b874'],
      water: { deep: '#1e6a8a', mid: '#2a82a4', shallow: '#3a9cbc', light: '#8ad8e8', foam: '#f0fbff', bank: '#b8986a', bankDark: '#8a7048' },
      sand: ['#d4bc84', '#e0ca94', '#eacfa0', '#f2dcae', '#f8e8c4'],
      shell: ['#ffe8f0', '#e09ab0'],
    },
    trees: ['palm', 'palm', 'oak'],
    leaves: ['#16402a', '#1e5634', '#286c40', '#36844c', '#52a060', '#74b874'],
    bark: '#7a5a34',
    ambient: 'spray',
  },
  autumn: {
    indoor: false,
    bg: '#5a3a1a',
    ground: {
      grass: ['#7a7a34', '#8a8a3c', '#9a9446', '#aaa052', '#bcae5e'],
      blade: '#c8b860',
      bladeHi: '#e0cc78',
      flowers: ['#ff8a3d', '#ffd84d', '#ffffff', '#c84a3a', '#e8a0ff'],
      path: DIRT,
      pebble: '#9a8a72',
      leaf: ['#4a1e10', '#6e2c14', '#9a4418', '#c4661e', '#e08a2a', '#f2b44a'],
      water: LAKE,
      sand: SAND,
      shell: SHELL,
    },
    trees: ['oak', 'oak', 'pine'],
    leaves: ['#4a1e10', '#6e2c14', '#9a4418', '#c4661e', '#e08a2a', '#f2b44a'],
    bark: '#5a3a22',
    ambient: 'leaves',
  },
  marsh: {
    indoor: false,
    bg: '#24382a',
    ground: {
      grass: ['#3e5a3a', '#4a6a42', '#56784a', '#628652', '#70925c'],
      blade: '#7a9a62',
      bladeHi: '#94b07a',
      flowers: ['#e8e0c8', '#c8d8a0', '#a8b8e8', '#ffffff', '#d8c070'],
      path: ['#5a4a34', '#6a5a40', '#7a6a4c', '#8a7a58'],
      pebble: '#6a6a5a',
      leaf: ['#14261c', '#1c3424', '#26442e', '#32563a', '#46704a', '#5e8a5e'],
      water: { deep: '#2a4a44', mid: '#345a50', shallow: '#40705e', light: '#6a9a84', foam: '#b8d0c0', bank: '#4a3c2a', bankDark: '#30261a' },
      sand: ['#5a4a34', '#665640', '#72624c', '#7e6e58', '#8a7a64'],
      shell: ['#c8c0a0', '#8a8068'],
    },
    trees: ['willow', 'willow', 'dead'],
    leaves: ['#14261c', '#1c3424', '#26442e', '#32563a', '#46704a', '#5e8a5e'],
    bark: '#4a3e2e',
    ambient: 'motes',
  },
  plague: {
    indoor: false,
    bg: '#26301a',
    ground: {
      grass: ['#4a5a2a', '#566a30', '#647838', '#72863e', '#829446'],
      blade: '#94a44a',
      bladeHi: '#b0c060',
      flowers: ['#c8ff6a', '#9a6aff', '#e8e0a0', '#ffffff', '#7a3a8a'],
      path: ['#4a3c28', '#5a4a30', '#6a583a', '#7a6644'],
      pebble: '#6a6a4a',
      leaf: ['#1a2412', '#243218', '#30421e', '#3e5426', '#566e30', '#748a3e'],
      water: { deep: '#3a5a1a', mid: '#4a6e22', shallow: '#5e8a2a', light: '#9ac04a', foam: '#d8f08a', bank: '#3a2e1e', bankDark: '#261e12' },
      sand: ['#4a3c28', '#56462e', '#625036', '#6e5a3e', '#7a6446'],
      shell: ['#d8d0a0', '#8a8058'],
    },
    trees: ['willow', 'dead', 'mushroom'],
    leaves: ['#1a2412', '#243218', '#30421e', '#3e5426', '#566e30', '#748a3e'],
    bark: '#3e3424',
    ambient: 'spores',
  },
  plains: {
    indoor: false,
    bg: '#5a5a2a',
    ground: {
      grass: ['#8a8a3a', '#9a9a42', '#aaa84c', '#bab656', '#cac462'],
      blade: '#d4cc6a',
      bladeHi: '#e8de86',
      flowers: ['#ffffff', '#ffd84d', '#c88aff', '#ff8a8a', '#8ab4ff'],
      path: DIRT,
      pebble: '#9a8a72',
      leaf: ['#1e4a1e', '#2a6226', '#367a30', '#46923a', '#64ac4a', '#84c45e'],
      water: LAKE,
      sand: SAND,
      shell: SHELL,
    },
    trees: ['oak', 'oak', 'pine'],
    leaves: ['#2a4a1a', '#365e20', '#447428', '#548a30', '#6aa23c', '#8abc52'],
    bark: '#6a4424',
    ambient: 'seeds',
  },
  mountain: {
    indoor: false,
    bg: '#3a3a44',
    ground: {
      grass: ['#4a6a4a', '#567652', '#62825a', '#6e8e64', '#7c9a70'],
      blade: '#88a678',
      bladeHi: '#a4bc90',
      flowers: ['#ffffff', '#a8b8ff', '#ffd84d', '#ff8ab8', '#c8e8ff'],
      path: ['#6a6a6e', '#7a7a7e', '#8a8a8e', '#9a9a9e'],
      pebble: '#8a8a90',
      leaf: ['#2a2a32', '#3a3a44', '#4a4a56', '#5c5c6a', '#72727e', '#8e8e9a'],
      water: { deep: '#2a5a8a', mid: '#3470a4', shallow: '#4a8ac0', light: '#8ac0e8', foam: '#e8f6ff', bank: '#5a5a62', bankDark: '#3e3e46' },
      sand: ['#7a7a7e', '#8a8a8e', '#9a9a9e', '#aaaaae', '#babac0'],
      shell: ['#d8d8e0', '#8a8a96'],
    },
    trees: ['pine', 'pine', 'snowpine'],
    leaves: ['#0f3420', '#174a2c', '#1f5e35', '#2c7a44', '#45995a', '#6cbc7a'],
    bark: '#4a3a2a',
  },
  barrow: {
    indoor: false,
    bg: '#2a2e2a',
    ground: {
      grass: ['#4a4e44', '#565a4e', '#626658', '#6e7262', '#7a7e6c'],
      blade: '#8a8e78',
      bladeHi: '#a4a890',
      flowers: ['#d8d0c0', '#a8a0b8', '#e8e0a0', '#ffffff', '#c8b8d8'],
      path: ['#4a443c', '#5a5448', '#6a6454', '#7a7460'],
      pebble: '#7a7468',
      leaf: ['#1e1e22', '#2a2a2e', '#36363c', '#44444a', '#56565e', '#6c6c74'],
      water: { deep: '#1e2a3a', mid: '#26364a', shallow: '#30445a', light: '#5a7090', foam: '#a8b8d0', bank: '#3a342c', bankDark: '#28241e' },
      sand: ['#5a564c', '#666258', '#726e64', '#7e7a70', '#8a867c'],
      shell: ['#e8e0d0', '#a8a090'],
    },
    trees: ['dead', 'dead', 'pine'],
    leaves: ['#1e2a1e', '#283628', '#344434', '#425442', '#566a56', '#6e826e'],
    bark: '#4a4440',
    ambient: 'ash',
    tint: '#1a2430',
  },
  storm: {
    indoor: false,
    bg: '#1a2a34',
    ground: {
      grass: ['#3a5a3a', '#466a42', '#52784a', '#5e8652', '#6c925c'],
      blade: '#7a9a68',
      bladeHi: '#98b484',
      flowers: ['#ffffff', '#c8d8ff', '#ffd84d', '#ff9ab8', '#a8e8ff'],
      path: ['#5a5a54', '#6a6a62', '#7a7a70', '#8a8a7e'],
      pebble: '#7a7a74',
      leaf: ['#142a24', '#1c3a30', '#264a3c', '#325c4a', '#48765e', '#629078'],
      water: { deep: '#16384a', mid: '#1e4a5e', shallow: '#2a5e72', light: '#6a9ab0', foam: '#e0f0f8', bank: '#5a5248', bankDark: '#3e3832' },
      sand: ['#8a8478', '#9a9488', '#aaa498', '#bab4a8', '#cac4b8'],
      shell: ['#f0f0f0', '#a8a8b0'],
    },
    trees: ['pine', 'pine', 'dead'],
    leaves: ['#142a24', '#1c3a30', '#264a3c', '#325c4a', '#48765e', '#629078'],
    bark: '#4a3e34',
    ambient: 'spray',
    tint: '#14202a',
  },
  moor: {
    indoor: false,
    bg: '#2a2232',
    ground: {
      grass: ['#4a3a4a', '#584452', '#66505c', '#745c68', '#826a74'],
      blade: '#9a7a8a',
      bladeHi: '#b894a4',
      flowers: ['#c86aff', '#e8a0ff', '#ffffff', '#a8b8ff', '#ffd8f0'],
      path: ['#4a3a2a', '#5a4a34', '#6a5a40', '#7a6a4c'],
      pebble: '#6a5a5a',
      leaf: ['#141420', '#1e1e2c', '#2a2a3a', '#383848', '#4c4c5e', '#666678'],
      water: { deep: '#1a2430', mid: '#22303e', shallow: '#2c3c4c', light: '#5a6a80', foam: '#a8b0c0', bank: '#3a2e26', bankDark: '#28201a' },
      sand: ['#5a4a3e', '#665648', '#726252', '#7e6e5c', '#8a7a66'],
      shell: ['#d8d0d8', '#9a8a9a'],
    },
    trees: ['dead', 'pine', 'dead'],
    leaves: ['#1a1a26', '#242434', '#303042', '#3e3e52', '#525268', '#6a6a82'],
    bark: '#3a3434',
    ambient: 'motes',
    tint: '#1a1428',
  },
  desert: {
    indoor: false,
    bg: '#a87a4a',
    ground: {
      grass: ['#9a8a4a', '#a89852', '#b6a65c', '#c4b466', '#d0c070'],
      blade: '#d8c878',
      bladeHi: '#ece094',
      flowers: ['#ff6a3d', '#ffd84d', '#ffffff', '#ff9ab8', '#c88aff'],
      path: ['#a0603a', '#b07044', '#c0804e', '#d09058'],
      pebble: '#b08a62',
      leaf: ['#4a2414', '#6a341c', '#8a4824', '#a85e2e', '#c47a3e', '#dc9a5a'],
      water: { deep: '#1a6a7a', mid: '#228a9a', shallow: '#2aaab8', light: '#8ae0e8', foam: '#f0ffff', bank: '#a87a4a', bankDark: '#7a5430' },
      sand: ['#d0a868', '#dcb878', '#e6c688', '#efd49a', '#f6e2b0'],
      shell: ['#fff8e8', '#c8a080'],
    },
    trees: ['palm', 'cactus', 'cactus'],
    leaves: ['#2a4a1a', '#365e20', '#447428', '#548a30', '#6aa23c', '#8abc52'],
    bark: '#8a6a3a',
    ambient: 'dust',
  },
  fey: {
    indoor: false,
    bg: '#1e2a4a',
    ground: {
      grass: ['#2a5a5a', '#326a66', '#3a7a72', '#448a7e', '#4e9a8a'],
      blade: '#6ac0a8',
      bladeHi: '#9ae8d0',
      flowers: ['#ff8aff', '#8affff', '#ffff8a', '#c8a8ff', '#ffffff'],
      path: ['#5a4a6a', '#6a5a7a', '#7a6a8a', '#8a7a9a'],
      pebble: '#8a7a9a',
      leaf: ['#1a1a3a', '#242a52', '#2e3a6a', '#3a4e84', '#5a72aa', '#8aa8d8'],
      water: { deep: '#2a3a8a', mid: '#3a4aa8', shallow: '#4a62c8', light: '#9ab0ff', foam: '#e0e8ff', bank: '#3a3058', bankDark: '#28203e' },
      sand: ['#8a7aa8', '#9a8ab4', '#aa9ac0', '#baaacc', '#cabad8'],
      shell: ['#ffffff', '#c8a8ff'],
    },
    trees: ['mushroom', 'oak', 'mushroom'],
    leaves: ['#1a1a3a', '#242a52', '#2e3a6a', '#3a4e84', '#5a72aa', '#8aa8d8'],
    bark: '#3a3048',
    ambient: 'motes',
  },
  snow: {
    indoor: false,
    bg: '#c8d6e4',
    ground: {
      grass: ['#b8c8d8', '#c8d6e4', '#d6e2ee', '#e4eef6', '#f2f8fc'],
      blade: '#a8bcd0',
      bladeHi: '#ffffff',
      flowers: ['#a8d8ff', '#ffffff', '#c8e8ff', '#e0d0ff', '#ffffff'],
      path: ['#8a98a8', '#9aa8b8', '#aab8c6', '#bac6d2'],
      pebble: '#8a98a8',
      leaf: ['#1e3a3a', '#2a4e4a', '#3a6460', '#c8dae8', '#e0ecf4', '#ffffff'],
      water: { deep: '#4a7aa8', mid: '#6a96c0', shallow: '#8ab4d8', light: '#c8e4f8', foam: '#ffffff', bank: '#8a98a8', bankDark: '#6a7888' },
      sand: ['#c8d6e4', '#d2dee8', '#dce6ee', '#e6eef4', '#f0f6fa'],
      shell: ['#ffffff', '#a8bcd0'],
    },
    trees: ['snowpine', 'snowpine', 'dead'],
    leaves: ['#1e3a3a', '#2a4e4a', '#3a6460', '#4e7a72', '#c8dae8', '#ffffff'],
    bark: '#4a3e38',
    ambient: 'snow',
  },
  rift: {
    indoor: false,
    bg: '#140c22',
    ground: {
      grass: ['#2a1e3a', '#34244a', '#3e2c58', '#4a3468', '#563e78'],
      blade: '#7a5aa8',
      bladeHi: '#a888d8',
      flowers: ['#ff3fd2', '#22e4ff', '#ffffff', '#c88aff', '#8affff'],
      path: ['#3a3248', '#4a4058', '#5a4e68', '#6a5c78'],
      pebble: '#5a4e68',
      leaf: ['#1a0e2a', '#2a1844', '#3e2460', '#5a3488', '#8a5ab8', '#c896ff'],
      water: { deep: '#120a24', mid: '#1e1038', shallow: '#2e1850', light: '#ff3fd2', foam: '#ffb0f0', bank: '#2a2238', bankDark: '#1a1428' },
      sand: ['#3a3248', '#463c56', '#524664', '#5e5072', '#6a5a80'],
      shell: ['#22e4ff', '#ff3fd2'],
    },
    trees: ['crystal', 'dead', 'crystal'],
    leaves: ['#1a0e2a', '#2a1844', '#3e2460', '#5a3488', '#8a5ab8', '#c896ff'],
    bark: '#2a2234',
    ambient: 'motes',
  },
  jungle: {
    indoor: false,
    bg: '#0e2a16',
    ground: {
      grass: ['#1e5a2a', '#246a30', '#2c7a38', '#348a40', '#3e9a48'],
      blade: '#4eae58',
      bladeHi: '#72c876',
      flowers: ['#ff3f6a', '#ffd84d', '#ff8aff', '#ffffff', '#ff9a3d'],
      path: ['#5a4028', '#6a4c30', '#7a5838', '#8a6440'],
      pebble: '#6a5a44',
      leaf: ['#0a2a14', '#10381c', '#184a26', '#225e30', '#32783e', '#4a9650'],
      water: { deep: '#1a4a4a', mid: '#22605e', shallow: '#2a7872', light: '#6ab0a0', foam: '#c8f0e0', bank: '#4a3a24', bankDark: '#30261a' },
      sand: ['#8a7048', '#9a7e54', '#aa8c60', '#ba9a6c', '#caa878'],
      shell: ['#fff2e8', '#d8a898'],
    },
    trees: ['jungle', 'jungle', 'palm'],
    leaves: ['#0a2a14', '#10381c', '#184a26', '#225e30', '#32783e', '#4a9650'],
    bark: '#4a3424',
    ambient: 'motes',
  },
  warfront: {
    indoor: false,
    bg: '#3a3424',
    ground: {
      grass: ['#4a5034', '#565c3a', '#626840', '#6e7446', '#7a804e'],
      blade: '#86885a',
      bladeHi: '#a0a072',
      flowers: ['#c8c0a0', '#a89a80', '#ffffff', '#d8b070', '#8a8070'],
      path: ['#4a3a2a', '#5a4834', '#6a563e', '#7a6448'],
      pebble: '#6a5e4e',
      leaf: ['#1e1a14', '#2a241c', '#383024', '#46402e', '#5a5440', '#746c54'],
      water: { deep: '#3a3424', mid: '#4a422e', shallow: '#5a5238', light: '#8a7a5a', foam: '#c8b898', bank: '#3a2e20', bankDark: '#281e14' },
      sand: ['#6a5a42', '#76664c', '#827256', '#8e7e60', '#9a8a6a'],
      shell: ['#d8d0c0', '#8a8070'],
    },
    trees: ['dead', 'dead', 'oak'],
    leaves: ['#2a3418', '#36421e', '#425026', '#50602e', '#66763a', '#808e4a'],
    bark: '#3a2e24',
    ambient: 'ash',
  },
  blight: {
    indoor: false,
    bg: '#201824',
    ground: {
      grass: ['#3a3442', '#463e4e', '#52485a', '#5e5266', '#6a5c72'],
      blade: '#7a6a86',
      bladeHi: '#9886a4',
      flowers: ['#a8ff6a', '#ff6aa8', '#c8c0d8', '#8affc8', '#ffffff'],
      path: ['#3a2e34', '#4a3c42', '#5a4a50', '#6a585e'],
      pebble: '#5a4a56',
      leaf: ['#140e18', '#201624', '#2e2034', '#3e2c46', '#523c5c', '#6a5076'],
      water: { deep: '#2a4a1a', mid: '#3a6022', shallow: '#4c782c', light: '#8ac84a', foam: '#d0ff8a', bank: '#2e2430', bankDark: '#1e1820' },
      sand: ['#4a3e4a', '#564856', '#625262', '#6e5c6e', '#7a667a'],
      shell: ['#c8ffa0', '#8a6a8a'],
    },
    trees: ['dead', 'dead', 'mushroom'],
    leaves: ['#140e18', '#201624', '#2e2034', '#3e2c46', '#523c5c', '#6a5076'],
    bark: '#2e2630',
    ambient: 'spores',
    tint: '#1a1020',
  },
  haunted: {
    indoor: false,
    bg: '#121e28',
    ground: {
      grass: ['#2a3a44', '#324650', '#3a525c', '#445e68', '#4e6a74'],
      blade: '#5e7e88',
      bladeHi: '#82a2aa',
      flowers: ['#c8e8ff', '#ffffff', '#a8c8ff', '#e0e0ff', '#88ffd8'],
      path: ['#3a3a44', '#4a4a54', '#5a5a64', '#6a6a74'],
      pebble: '#5a5a64',
      leaf: ['#121a22', '#1a2630', '#24343e', '#30424e', '#46586a', '#647a8a'],
      water: { deep: '#0e1a26', mid: '#162432', shallow: '#1e2e3e', light: '#5a7a9a', foam: '#b8d0e8', bank: '#2a2e36', bankDark: '#1a1e24' },
      sand: ['#4a525a', '#565e66', '#626a72', '#6e767e', '#7a828a'],
      shell: ['#e0f0ff', '#8aa0b8'],
    },
    trees: ['dead', 'pine', 'dead'],
    leaves: ['#121a22', '#1a2630', '#24343e', '#30424e', '#46586a', '#647a8a'],
    bark: '#3a3e46',
    ambient: 'motes',
    tint: '#081420',
  },
  volcanic: {
    indoor: false,
    bg: '#1a1212',
    ground: {
      grass: ['#2a2626', '#343030', '#3e3838', '#484242', '#524c4a'],
      blade: '#5e5654',
      bladeHi: '#7a706c',
      flowers: ['#ff7a3d', '#ffd84d', '#ff3f3f', '#ffb07a', '#ffe0a0'],
      path: ['#1e1c1e', '#2a2628', '#363234', '#423e40'],
      pebble: '#4a4446',
      leaf: ['#0e0c0e', '#1a1618', '#262224', '#34302e', '#48423e', '#5e5650'],
      water: { deep: '#c8401a', mid: '#e85a1e', shallow: '#ff7a2a', light: '#ffcf5a', foam: '#fff2a0', bank: '#2a1a14', bankDark: '#1a100c' },
      sand: ['#3a3434', '#443e3e', '#4e4848', '#585252', '#625c5c'],
      shell: ['#ffcf5a', '#c8401a'],
    },
    trees: ['dead'],
    leaves: ['#2a1a14', '#3a221a', '#4a2c20', '#5c3626', '#72442e', '#8a5636'],
    bark: '#1e1a1a',
    ambient: 'embers',
    lava: true,
  },
  deadlake: {
    indoor: false,
    bg: '#14161c',
    ground: {
      grass: ['#5a5e64', '#666a70', '#72767c', '#7e8288', '#8a8e94'],
      blade: '#9a9ea4',
      bladeHi: '#b8bcc0',
      flowers: ['#ffffff', '#c8d0e0', '#a8b0c8', '#e0e8ff', '#88a0c0'],
      path: ['#4a4c52', '#5a5c62', '#6a6c72', '#7a7c82'],
      pebble: '#6a6c72',
      leaf: ['#1a1c22', '#24262e', '#30323c', '#3e404c', '#525462', '#6a6c7c'],
      water: { deep: '#0a0c12', mid: '#12161e', shallow: '#1a202a', light: '#4a5a70', foam: '#9aa8c0', bank: '#3a3c42', bankDark: '#2a2c30' },
      sand: ['#6a6c72', '#76787e', '#82848a', '#8e9096', '#9a9ca2'],
      shell: ['#ffffff', '#9aa0b0'],
    },
    trees: ['dead'],
    leaves: ['#1a1c22', '#24262e', '#30323c', '#3e404c', '#525462', '#6a6c7c'],
    bark: '#3a3c42',
    ambient: 'motes',
    tint: '#0a0c18',
  },
  crypt: indoor('#0e0c18', CRYPT_STONE),
  cave: indoor('#0c0a08', {
    slab: ['#5a5048', '#625850', '#564c44', '#5e544c'],
    mortar: '#3a322c',
    top: '#16120e',
    topHi: '#221c16',
    lip: '#4a3e34',
    lip2: '#342c24',
    brick: ['#6a5a4a', '#5e5042', '#726252'],
    brickMortar: '#2a221c',
    moss: '#5a6a3a',
    crack: '#14100c',
  }),
  keep: indoor('#101218', {
    slab: ['#5a5e6a', '#626672', '#565a66', '#5e626e'],
    mortar: '#363a46',
    top: '#181a22',
    topHi: '#22252e',
    lip: '#464a58',
    lip2: '#30343e',
    brick: ['#7a7e8a', '#6e727e', '#82868e'],
    brickMortar: '#2a2e38',
    moss: '#4e6a4a',
    crack: '#14161e',
  }),
  icecave: indoor(
    '#0e1a28',
    {
      slab: ['#8aa8c0', '#96b2c8', '#82a0b8', '#90acc4'],
      mortar: '#5a7890',
      top: '#16283a',
      topHi: '#20364a',
      lip: '#6a90b0',
      lip2: '#4a6a88',
      brick: ['#a8c8e0', '#9abcd6', '#b6d4ea'],
      brickMortar: '#4a6880',
      moss: '#e0f4ff',
      crack: '#2a4a68',
    },
    'snow',
  ),
  temple: indoor('#1a140c', {
    slab: ['#a88a5a', '#b0925e', '#a08254', '#a88c5a'],
    mortar: '#6a5434',
    top: '#2a2014',
    topHi: '#3a2c1c',
    lip: '#8a6e44',
    lip2: '#6a5434',
    brick: ['#c8a06a', '#bc9460', '#d4ac76'],
    brickMortar: '#5a4428',
    moss: '#6a8a4a',
    crack: '#3a2c1a',
  }),
  lavacave: indoor(
    '#120a08',
    {
      slab: ['#3a3030', '#423636', '#362c2c', '#3e3434'],
      mortar: '#ff5a1e',
      top: '#120c0c',
      topHi: '#1e1414',
      lip: '#5a2a1a',
      lip2: '#3a1c12',
      brick: ['#4a3a38', '#423432', '#52423e'],
      brickMortar: '#c8401a',
      moss: '#ff7a2a',
      crack: '#ff5a1e',
    },
    'embers',
  ),
  citadel: indoor(
    '#08060e',
    {
      slab: ['#2a2834', '#302e3a', '#26242e', '#2c2a36'],
      mortar: '#4a3a6a',
      top: '#0c0a14',
      topHi: '#16121e',
      lip: '#6a4aa8',
      lip2: '#3a2a5a',
      brick: ['#3a3848', '#34323e', '#403e4e'],
      brickMortar: '#1a1626',
      moss: '#a8c8ff',
      crack: '#8a5ad8',
    },
    'motes',
  ),
};

/** Colors for the minimap and the map screen, worked out from a theme's ground or stone. */
export function mapColors(t: Theme): { floor: string; wall: string; path: string; cobble: string; water: string; solid: string; sand: string; house: string } {
  const look = THEMES[t];
  if (look.indoor && look.stone) {
    const s = look.stone;
    return { floor: s.slab[0], wall: s.top, path: s.brick[1], cobble: s.brick[1], water: '#24406a', solid: s.lip2, sand: s.slab[1], house: s.lip2 };
  }
  const g = look.ground;
  return { floor: g.grass[1], wall: g.leaf[1], path: g.path[2], cobble: '#8a8a96', water: g.water.mid, solid: g.leaf[3], sand: g.sand[2], house: '#b04a3a' };
}
