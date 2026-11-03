/**
 * Which model plays which creature. The game names about 280 of them; here each family is one line, with a color
 * for what sets it apart. Every id gets something, so a new creature in the data never turns up invisible.
 */

export interface Kit {
  /** The model's file (public/games/sigilfall/3d/k/). */
  k: string;
  /** Multiplied into its colors. */
  tint?: string;
  /** Its size next to what its body radius would give it. */
  size?: number;
  /** Floats this far off the ground, in tiles. */
  float?: number;
  /** Brightens its colors (some models are painted dark). */
  gain?: number;
  /** Its attack clip. */
  atk?: 'chop' | 'chop2' | 'stab' | 'cast' | 'bow' | 'spin' | 'punch' | 'smash';
}

const ICE = '#a9dcff';
const FIRE = '#ff9c6b';
const ROT = '#a7cf85';
const VOID = '#a48bdc';
const ASH = '#9a8f8f';
const BONE = '#efe7d2';
const SAND = '#e8cf95';
const SEA = '#87cfc4';
const BLOOD = '#e0817a';
const LEGION = '#d98a84';

const RULES: [RegExp, Kit][] = [
  // the mounts, and small things of the land
  [/^mount-horse/, { k: 'a_horse_white' }],
  [/^mount-deer/, { k: 'a_stag' }],
  [/^mount-boar/, { k: 'a_bull' }],
  [/^mount-drake/, { k: 'f_dragon2' }],
  [/^chicken/, { k: 'b_chicken' }],
  // shapes a druid takes
  [/bear/, { k: 'm_yeti', tint: '#b08560' }],
  [/cat|feline/, { k: 'a_fox', tint: '#d9b98c' }],
  [/owl|moon/, { k: 'f_pigeon', tint: '#a7a0d6' }],
  // the great bosses
  [/the-bone-colossus|bone-giant|bone-golem|bone-hauler|bone-catapult/, { k: 'skeleton_golem' }],
  [/the-rime-wyrm/, { k: 'f_dragon2', tint: ICE, float: 0.6 }],
  [/rift-wyrm/, { k: 'f_dragon2', tint: VOID, float: 0.6 }],
  [/bone-drake/, { k: 'f_dragon2', tint: BONE, float: 0.5 }],
  [/ash-drake|rotwing/, { k: 'f_dragon', tint: ASH, float: 0.5 }],
  [/sand-wurm|mere-serpent|the-coiled-queen|temple-viper|serpent-cultist/, { k: 'm_fish', tint: SAND }],
  [/the-tide-lord|old-barnacle|barnacle-brute|deep-siren|naga|mirefin|tide-lurker/, { k: 'm_fish', tint: SEA }],
  [/kraken/, { k: 'f_squidle', tint: SEA, float: 0.2 }],
  [/the-rot-mother|mother-mire|rotwood-colossus|heartrot|old-rotbark|mourning-willow/, { k: 'frost_golem', tint: '#a58f5e', atk: 'smash' }],
  [/blight-treant|treant/, { k: 'frost_golem', tint: '#a0b86a', atk: 'smash' }],
  [/slag-colossus|forgemaster|furnace-warden|magma-warden|magma-sentry|infernal|fire-elemental|the-siege-breaker/, { k: 'frost_golem', tint: FIRE, atk: 'smash' }],
  [/rime-elemental|icebound|storm-elemental/, { k: 'frost_golem', tint: ICE, atk: 'smash' }],
  [/shard-golem|coral-golem|ushabti|veil-sentinel/, { k: 'f_goleling2', tint: '#d6c6ff' }],
  [/the-sand-warden|the-sun-king|khamsin/, { k: 'necromancer', tint: '#ffd98a', atk: 'cast' }],
  [/lich|the-pale-crown|the-ash-crown|morgrave|legion-necromancer|legion-bonecaller/, { k: 'necromancer', atk: 'cast' }],
  [/the-withered-queen|the-grey-lady|bog-hag|blight-witch|rot-sister|hedge-witch|rotbloom/, { k: 'witch', atk: 'cast' }],
  [/the-weeping-lord|the-tearborn|tear-wraith|weeping-specter/, { k: 'f_ghost', tint: '#bfd8f0', float: 0.5 }],
  [/death-knight|the-headless-lord|pale-knight|sir-corvane|general-morvain|vaelor|revenant-knight|hollow-sentinel|the-gatewarden/, { k: 'black_knight', atk: 'chop2' }],
  [/frost-giant|giant-huscarl|giant-hurler|jarl-hrimfang|yeti/, { k: 'm_yeti' }],
  [/swamp-troll|butcher-krogg|king-snagtooth/, { k: 'orc_brute', atk: 'smash' }],
  [/abomination|mire-horror|rift-horror|the-unmade|cistern-vatborn|bloated-corpse|cistern-bloat/, { k: 'monstrosity', tint: ROT, atk: 'smash' }],
  [/the-drowned|drowned-gunner|drowned-marine|drowned-sailor|drowned-villager|bloated-drowned|drowned-dead|drowned-chanter|saltbeard|admiral-blackwake/, { k: 'skeleton_minion', tint: SEA }],

  // the restless
  [/skeleton|necropolis|kneeling-dead|ossric|bone-steel|barrow-|throne-chain/, { k: 'skeleton_warrior' }],
  [/wight-archer|rime-archer|bandit-archer|hollow-hunter|thorn-archer/, { k: 'skeleton_rogue', atk: 'bow' }],
  [/wight|hollow-|bog-wight/, { k: 'skeleton_warrior', tint: '#c7d3cf' }],
  [/bone-weaver|embalmer|tomb-priest|cistern-acolyte|lich-acolyte|pale-acolyte|acolyte|cultist/, { k: 'skeleton_mage', atk: 'cast' }],
  [/wraith|banshee|shade|soul|specter|wailing|the-bell-ringer|spire-echo|the-pale-standard/, { k: 'f_ghostskull', tint: '#c3b9ec', float: 0.5 }],
  [/marsh-light|marsh-wisp|storm-wisp|corpse-candle|spire-mote|sprite$|candle-wraith/, { k: 'f_ghost', size: 0.62, float: 0.5 }],
  [/ghoul|corpse|mummy|wrapped|plague|hanged|rotspore|brother-pustule|plaguebearer|sun-mummy/, { k: 'wolfman', tint: ROT }],

  // beasts
  [/werewolf/, { k: 'werewolf' }],
  [/ice-wolf|rime-hound/, { k: 'a_husky', tint: ICE }],
  [/magma-hound/, { k: 'a_wolf', tint: FIRE }],
  [/blight-wolf|moonfang|grave-wolf|grave-hound|pale-hound|barrow-hound/, { k: 'a_wolf', tint: '#b9c4b0' }],
  [/wolf|hound/, { k: 'a_wolf' }],
  [/boar|grimtusk/, { k: 'a_bull', tint: '#a6836e', size: 0.74 }],
  [/stag/, { k: 'a_stag' }],
  [/ram$|frost-ram/, { k: 'a_alpaca', tint: ICE, size: 0.9 }],
  [/lion|panther/, { k: 'a_fox', tint: '#f2c67c', size: 1.2 }],
  [/griffon|cliff-roc|harpy/, { k: 'avian' }],
  [/crow/, { k: 'f_pigeon', tint: '#67637c', size: 0.7, float: 0.5 }],
  [/raptor/, { k: 'm_dino' }],
  [/centaur/, { k: 'a_horse', tint: '#caa27f' }],

  // small crawling things
  [/spider|lurker/, { k: 'f_squidle', tint: '#6b5a7e', size: 0.72 }],
  [/scarab|beetle|sand-scorpion|crab/, { k: 'f_armabee2', tint: SAND, size: 0.72 }],
  [/mosquito|moth|rotwood-pod/, { k: 'f_armabee', size: 0.62, float: 0.45 }],
  [/rat$|cistern-broodling|ghoul-swarm/, { k: 'b_dog', tint: '#90887e', size: 0.5 }],
  [/slime|cursed-hoard|slag-lump/, { k: 'b_green', gain: 1.75 }],

  // growing things
  [/thornling/, { k: 'b_cactoro', size: 0.82 }],
  [/bloom|shambler|dryad/, { k: 'b_mushnub2' }],
  [/briar|vine|thorn|lasher|fey-knight|prince-thistlemourn/, { k: 'plant_warrior' }],

  // burning and hollow things
  [/cinder-imp|slag-imp|imp$|chained-emberkin|pyrebrand/, { k: 'm_bluedemon', tint: FIRE, size: 0.74 }],
  [/felguard|voidcaller|voidwalker|void-stalker|rift-stalker|gloam-lurker/, { k: 'm_demon', tint: VOID }],
  [/rift-shardling|soul-shackle|spire-anchor/, { k: 'f_goleling', tint: VOID, float: 0.3 }],
  [/spire-cantor|spire-halfborn|spire-lancer|herald-in-the-spire|veil-weaver/, { k: 'tiefling', atk: 'cast' }],

  // people
  [/goblin/, { k: 'b_orc', size: 0.84 }],
  [/kobold/, { k: 'm_monkroose', size: 0.72 }],
  [/legion-(arbalester|crossbowman|scout)/, { k: 'ranger', tint: LEGION, atk: 'bow' }],
  [/legion-(flamecaller|pyrebinder)/, { k: 'mage', tint: LEGION, atk: 'cast' }],
  [/legion-(forgeslave|miner|sapper|smith|teamster|woodsman)/, { k: 'engineer', tint: LEGION }],
  [/legion-(huscarl|overseer|standard-bearer|ensign|war-banner|lancer|spearman)/, { k: 'barbarian', tint: LEGION, atk: 'chop2' }],
  [/legion/, { k: 'knight', tint: LEGION }],
  [/oathsworn|guardian|captain-|enforcer|border-reaver|quartermaster|varric|king-hrodric/, { k: 'paladin' }],
  [/dune-|cutthroat|smuggler/, { k: 'rogue_hooded', tint: SAND }],
  [/archer|hunter/, { k: 'ranger', atk: 'bow' }],
  [/mystic|elder|maelis/, { k: 'lorekeeper', atk: 'cast' }],
  [/smith/, { k: 'engineer' }],
  [/hangman/, { k: 'rogue_hooded', tint: BLOOD }],
  [/villager/, { k: 'farmer_a' }],
];

const memo = new Map<string, Kit>();

export function kitOf(sprite: string): Kit {
  let hit = memo.get(sprite);
  if (!hit) {
    hit = RULES.find(([re]) => re.test(sprite))?.[1] ?? { k: 'skeleton_minion' };
    memo.set(sprite, hit);
  }
  return hit;
}

/** Every file the game's creatures can ask for. */
export const ALL_KITS: readonly string[] = [...new Set(RULES.map(([, k]) => k.k))];

export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
