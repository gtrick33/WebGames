/**
 * Who plays whom. Every creature name in the game's data has a line here, chosen against the story: the Ashen Host are
 * the dead of Vaelmoor, so its soldiers, smiths and casters are skeletons in the Host's ash-grey; the Gallows Gang and
 * the smugglers are living people; beasts are beasts.
 */

export interface Kit {
  /** The model's file (public/games/sigilfall/3d/k/). */
  k: string;
  /** Multiplied into its colors. */
  tint?: string;
  /** Its size next to what its body radius would give it. */
  size?: number;
  /** Floats this far off the ground, in old-grid tiles (16 world pixels). */
  float?: number;
  /** Its attack clip. */
  atk?: 'chop' | 'chop2' | 'stab' | 'cast' | 'bow' | 'spin' | 'punch' | 'smash';
  /** Brightens its colors (some models are painted dark). */
  gain?: number;
  /** See-through, for what is hardly there. */
  ghost?: number;
  /** Clip to walk with, where a figure has its own way of moving. */
  walk?: string;
  /** Someone on its back (a rider, a centaur's or naga's upper half). */
  top?: { k: string; tint?: string; clip: string; y: number; size: number };
  /** Worn as a person from the wardrobe instead (the story's own people, when they fight). */
  look?: string;
  /** What a person from the wardrobe holds (render3d/dress.ts WEAPONS), and a shield. */
  held?: { kind: string; tint?: string };
  shield?: boolean;
}

const ASH = '#b9b4bf';
const COLD = '#bcd0d6';
const ICE = '#a9dcff';
const FIRE = '#ff9c6b';
const ROT = '#a7cf85';
const VOID = '#a48bdc';
const BONE = '#efe7d2';
const SAND = '#e8cf95';
const SEA = '#87cfc4';
const GOLD = '#ffd98a';
const PALE = '#e4e0f2';
const MOSS = '#8ea06a';
const BARK = '#b8905f';
const DARK = '#6c6878';

const TABLE: Record<string, Kit> = {};
const put = (ids: string, kit: Kit): void => {
  for (const id of ids.split(/\s+/)) if (id) TABLE[id] = kit;
};

const CASTER = { atk: 'cast' } as const;
const BOWMAN = { atk: 'bow' } as const;
const SMASH = { atk: 'smash' } as const;

/* ------------------------------------------------------------------ the Ashen Host */
put('skeleton legion-soldier', { k: 'sk_warrior', tint: ASH });
put('legion-spearman hollow-legionnaire', { k: 'sk_spear', tint: ASH, atk: 'stab' });
put('legion-huscarl legion-shieldbearer hollow-guardsman oathsworn-guard', { k: 'sk_guard', tint: ASH });
put('legion-crossbowman legion-arbalester legion-wagon-guard hollow-hunter archer', { k: 'sk_archer', tint: ASH, ...BOWMAN });
put('legion-bonecaller legion-necromancer', { k: 'sk_necro', ...CASTER });
put('legion-flamecaller legion-pyrebinder', { k: 'sk_mage', tint: FIRE, ...CASTER });
put('legion-slagthrower legion-sapper', { k: 'sk_minion', tint: FIRE, atk: 'chop' });
put('legion-miner legion-smith legion-teamster legion-woodsman', { k: 'sk_worker', tint: ASH });
put('legion-forgeslave', { k: 'sk_minion', tint: DARK });
put('legion-ensign legion-standard-bearer legion-war-banner', { k: 'sk_banner', tint: ASH, atk: 'cast' });
put('legion-overseer', { k: 'sk_golem', tint: ASH, size: 0.85, ...CASTER });
put('legion-scout', { k: 'a_horse_white', tint: '#58545f', top: { k: 'sk_warrior', tint: ASH, clip: 'sit', y: 0.62, size: 0.74 } });
put('legion-lancer', { k: 'a_horse_white', tint: '#6c6470', top: { k: 'sk_spear', tint: ASH, clip: 'sit', y: 0.62, size: 0.74 } });
put('border-reaver', { k: 'a_horse_white', tint: '#47505a', top: { k: 'sk_warrior', tint: COLD, clip: 'sit', y: 0.62, size: 0.74 } });
put('death-knight death-knight-initiate death-knight-squire pale-knight revenant-knight hollow-sentinel the-gatewarden the-headless-lord sir-corvane sir-corvane-foot general-morvain hollow-guard', { k: 'black_knight', tint: '#8a8698', atk: 'chop2' });
put('vaelor', { k: 'vaelor', tint: '#6e6a7c', size: 1.1, atk: 'chop2' });
put('captain-hollowbane captain-gloam', { k: 'sk_guard', tint: COLD, size: 1.12 });
put('quartermaster-vane', { k: 'paladin', tint: DARK, ...CASTER });

/* ------------------------------------------------------------------ the old dead */
put('barrow-skeleton kneeling-dead', { k: 'sk_minion' });
put('barrow-wight wight-knight', { k: 'sk_warrior', tint: COLD });
put('bog-wight', { k: 'sk_warrior', tint: ROT });
put('wight-archer', { k: 'sk_archer', tint: COLD, ...BOWMAN });
put('rime-archer', { k: 'sk_archer', tint: ICE, ...BOWMAN });
put('guardian necropolis-guard bone-steel-sentinel the-bell-ringer ossric', { k: 'sk_guard', size: 1.12 });
put('acolyte', { k: 'sk_mage', tint: VOID, ...CASTER });
put('tomb-priest embalmer-priest', { k: 'sk_mage', tint: SAND, ...CASTER });
put('bone-weaver', { k: 'sk_mage', ...CASTER });
put('pale-acolyte', { k: 'sk_mage', tint: PALE, atk: 'chop' });
put('cistern-acolyte', { k: 'sk_mage', tint: ROT, ...CASTER });
put('lich-acolyte morgrave', { k: 'sk_necro', ...CASTER });
put('the-lich-of-hollowmere', { k: 'sk_necro', size: 1.18, ...CASTER });
put('the-sun-king', { k: 'sk_necro', tint: GOLD, size: 1.16, ...CASTER });
put('the-pale-crown', { k: 'sk_necro', tint: VOID, float: 0.45, ...CASTER });
put('the-ash-crown', { k: 'sk_necro', tint: ASH, size: 1.35, float: 0.35, ...CASTER });
put('king-hrodric', { k: 'sk_king' });
put('bone-golem bone-hauler', { k: 'sk_golem' });
put('the-sand-warden', { k: 'sk_golem', tint: SAND });
put('bone-giant the-bone-colossus', { k: 'sk_golem', size: 1.2 });
put('forgemaster-grold', { k: 'sk_golem', tint: FIRE, ...SMASH });
put('bone-catapult', { k: 'catapult', tint: BONE });
put('throne-chain', { k: 'chain_post', tint: DARK });
put('the-siege-breaker', { k: 'siege_ram', tint: ASH });
put('the-pale-standard', { k: 'sk_banner', tint: PALE, size: 1.18, ...CASTER });
put('hanged-man', { k: 'sk_minion', tint: COLD, float: 0.6, walk: 'idle' });
// the walking dead, by how they died
put('plague-ghoul bog-ghoul carrion-ghoul ghoul-swarm plaguebearer', { k: 'sk_minion', tint: ROT });
put('sun-mummy wrapped-dead', { k: 'sk_minion', tint: SAND, walk: 'skelwalk' });
put('drowned-villager drowned-sailor drowned-dead', { k: 'sk_minion', tint: SEA });
put('drowned-marine admiral-blackwake', { k: 'sk_warrior', tint: SEA });
put('drowned-gunner', { k: 'sk_archer', tint: SEA, ...BOWMAN });
put('drowned-chanter the-drowned', { k: 'sk_mage', tint: SEA, ...CASTER });
put('ushabti-guardian', { k: 'sk_guard', tint: GOLD });
put('ashkar-cinderguard', { k: 'sk_warrior', tint: FIRE });
put('crypt-stalker', { k: 'sk_minion', tint: DARK, float: 0.25 });
// what is hardly there
put('restless-shade banshee wailing-soul soul-shackle torn-soul', { k: 'ghost', tint: '#c3b9ec', float: 0.45, ghost: 0.78, walk: 'skelidle' });
put('rime-wraith frost-wraith', { k: 'ghost', tint: ICE, float: 0.45, ghost: 0.78, walk: 'skelidle' });
put('lake-wraith', { k: 'ghost', tint: SEA, float: 0.45, ghost: 0.78, walk: 'skelidle' });
put('sand-wraith khamsin', { k: 'ghost', tint: SAND, float: 0.45, ghost: 0.78, walk: 'skelidle' });
put('soul-reaver', { k: 'ghost', tint: VOID, float: 0.45, ghost: 0.82, walk: 'skelidle' });
put('weeping-specter tear-wraith', { k: 'ghost', tint: '#bfd8f0', float: 0.45, ghost: 0.78, walk: 'skelidle' });
put('the-weeping-lord the-tearborn', { k: 'ghost', tint: '#bfd8f0', float: 0.45, size: 1.25, ghost: 0.82, walk: 'skelidle' });
put('corpse-candle candle-wraith', { k: 'wisp', tint: FIRE, size: 0.7, float: 0.35 });
put('marsh-light marsh-wisp', { k: 'wisp', tint: '#c8f0a0', size: 0.7, float: 0.35 });
put('storm-wisp', { k: 'wisp', tint: ICE, size: 0.7, float: 0.35 });
put('spire-mote', { k: 'wisp', tint: VOID, size: 0.7, float: 0.35 });
put('spire-echo', { k: 'vampire', tint: VOID, ghost: 0.7, float: 0.3, ...CASTER });
put('the-grey-lady', { k: 'witch', tint: PALE, ghost: 0.72, float: 0.3, ...CASTER });
// the risen beasts of the Host
put('hound grave-hound barrow-hound pale-hound grave-wolf', { k: 'a_wolf', tint: BONE, gain: 1.5 });
put('blight-wolf', { k: 'a_wolf', tint: ROT, gain: 1.4 });
put('magma-hound', { k: 'a_wolf', tint: FIRE, gain: 1.4 });
put('rime-hound ice-wolf', { k: 'a_husky', tint: ICE });
put('bone-drake', { k: 'wyrm', tint: BONE, float: 0.5, size: 1.15 });
put('ash-drake', { k: 'wyrm', tint: ASH, float: 0.5 });
put('rotwing', { k: 'wyrm', tint: ROT, float: 0.5 });
put('rift-wyrm', { k: 'wyrm', tint: VOID, float: 0.5 });
put('the-rime-wyrm', { k: 'wyrm', tint: ICE, float: 0.6 });

/* ------------------------------------------------------------------ the Pale Herald's own */
put('herald-in-the-spire', { k: 'vampire', tint: PALE, float: 0.25, ...CASTER });
put('voidcaller spire-cantor veil-weaver', { k: 'tiefling', tint: VOID, ...CASTER });
put('spire-lancer', { k: 'tiefling', atk: 'stab' });
put('spire-halfborn', { k: 'tiefling', tint: PALE, float: 0.35 });
put('rift-stalker void-stalker', { k: 'tiefling', tint: '#6c5c9c' });
put('rift-horror the-unmade', { k: 'monstrosity', tint: VOID, ...SMASH });
put('rift-shardling spire-anchor', { k: 'golem', tint: VOID, size: 0.62 });
put('shard-golem', { k: 'golem', tint: '#d6c6ff', ...SMASH });
put('veil-sentinel', { k: 'golem', tint: VOID, ...SMASH });

/* ------------------------------------------------------------------ the living */
put('cutthroat', { k: 'rogue_hooded', look: 'foe-cutthroat', held: { kind: 'dagger' } });
put('bandit-archer', { k: 'ranger', tint: '#b0a090', look: 'foe-bandit-archer', held: { kind: 'bow' }, ...BOWMAN });
put('enforcer', { k: 'barbarian', look: 'foe-enforcer', held: { kind: 'axe' }, atk: 'chop2' });
put('hangman', { k: 'barbarian', tint: DARK, look: 'foe-hangman', held: { kind: 'greatsword' }, atk: 'chop2' });
put('varric', { k: 'survivalist', size: 1.12 });
put('saltbeard', { k: 'survivalist', tint: '#c9b48c', size: 1.14 });
put('smuggler', { k: 'rogue', look: 'foe-smuggler', held: { kind: 'sword' } });
put('dune-raider', { k: 'rogue_hooded', tint: SAND, look: 'foe-dune-raider', held: { kind: 'sword' } });
put('dune-javelineer', { k: 'ranger', tint: SAND, look: 'foe-dune-javelineer', held: { kind: 'spear' }, ...BOWMAN });
put('serpent-cultist', { k: 'rogue_hooded', tint: '#8fc78a', look: 'foe-serpent-cultist', held: { kind: 'staff' }, ...CASTER });
put('hedge-witch bog-hag rotbloom-matron', { k: 'witch', look: 'foe-hedge-witch', held: { kind: 'staff' }, ...CASTER });
put('rot-sister blight-witch', { k: 'witch', tint: ROT, look: 'foe-blight-witch', held: { kind: 'staff' }, ...CASTER });
put('the-withered-queen', { k: 'vampire', tint: ROT, size: 1.12, ...CASTER });
put('brother-pustule', { k: 'cleric', tint: ROT, look: 'foe-brother-pustule', held: { kind: 'staff' }, ...CASTER });
put('maelis-crane', { k: 'cleric', look: 'chancellor-crane', ...CASTER });
put('goblin', { k: 'ranger', tint: '#9aa878', look: 'foe-briar-poacher', held: { kind: 'bow' }, ...BOWMAN });
put('ridge-kobold kobold-candler', { k: 'caveman', tint: '#d0a070', size: 0.72 });
put('king-snagtooth', { k: 'orc_brute', tint: '#d0b890', size: 0.9, ...SMASH });
put('butcher-krogg swamp-troll', { k: 'orc_brute', tint: '#a8c090', ...SMASH });
put('smith', { k: 'engineer' });
put('villager', { k: 'farmer_b' });
put('elder', { k: 'lorekeeper' });
put('mystic', { k: 'witch', ...CASTER });

/* ------------------------------------------------------------------ giants and things of the land */
put('frost-giant giant-huscarl giant-hurler jarl-hrimfang', { k: 'barbarian_large', tint: ICE, atk: 'chop2' });
put('yeti', { k: 'golem', tint: '#eef4ff', ...SMASH });
put('wolf', { k: 'a_wolf' });
put('werewolf werewolf-howler moonfang', { k: 'werewolf' });
put('boar', { k: 'a_wolf', tint: '#c8b8a8' });
put('russet-boar', { k: 'fbx_pig', tint: '#b5683f', size: 0.86 });
put('grimtusk', { k: 'orc_brute', tint: '#8a7a6c', size: 1.4, ...SMASH });
put('stag', { k: 'a_stag' });
put('blighted-stag', { k: 'a_stag', tint: ROT });
put('frost-ram', { k: 'fbx_sheep', tint: ICE });
put('plains-lion', { k: 'a_fox', tint: '#f2c67c', size: 1.2 });
put('jungle-panther', { k: 'a_fox', tint: '#57535f', size: 1.15 });
put('griffon', { k: 'avian', tint: '#e0b868', size: 1.12 });
put('cliff-roc', { k: 'avian', tint: '#b8895f', size: 1.25 });
put('harpy storm-harpy', { k: 'avian' });
put('carrion-crow gibbet-crow plague-crow', { k: 'bird', tint: '#57536c', size: 0.8, float: 0.45 });
put('canyon-raptor', { k: 'fbx_raptor' });
put('centaur-outrider', { k: 'a_horse', tint: '#caa27f', top: { k: 'top_centaur', clip: 'bow', y: 0.5, size: 0.72 } });
put('centaur-warbringer', { k: 'a_horse', tint: '#8f6b52', top: { k: 'top_centaur', clip: 'idle', y: 0.5, size: 0.72 } });
// small crawling things
put('spider cistern-broodling', { k: 'spider', size: 0.74 });
put('gloam-lurker', { k: 'spider', tint: '#7a7a9a', size: 0.86 });
put('tide-lurker', { k: 'crab', tint: SEA, size: 0.86 });
put('crab', { k: 'crab', size: 0.8 });
put('sand-scorpion', { k: 'scorpion' });
// (a barkling: a knot of living wood with bark for a shell, not a beetle of another art set)
put('beetle', { k: 'treant', tint: BARK, size: 0.6, ...SMASH });
put('scarab-swarm tomb-scarab', { k: 'scarab', size: 0.72 });
put('marsh-strider', { k: 'strider' });
put('blood-mosquito glimmer-moth rotwood-pod', { k: 'moth', size: 0.8, float: 0.4 });
put('cistern-rat', { k: 'a_fox', tint: '#8a8880', size: 0.5 });
put('slime', { k: 'plant_warrior', tint: MOSS, size: 0.78 });
put('slag-lump', { k: 'slime', tint: FIRE });
put('cursed-hoard', { k: 'mimic' });
put('kraken-spawn', { k: 'spider', tint: SEA, size: 0.8 });
put('temple-viper', { k: 'viper' });
put('mere-serpent', { k: 'serpent' });
put('sand-wurm', { k: 'wurm' });
put('naga-warrior', { k: 'naga_coil', top: { k: 'top_naga', clip: 'idle', y: 0.52, size: 0.66 } });
put('the-coiled-queen', { k: 'naga_coil', size: 1.25, top: { k: 'top_naga', tint: GOLD, clip: 'cast', y: 0.52, size: 0.66 } });
put('mirefin mirefin-oracle barnacle-brute deep-siren old-barnacle the-tide-lord', { k: 'monster', tint: SEA });
// what grows
put('treant old-rotbark rotwood-colossus', { k: 'treant', tint: BARK, ...SMASH });
put('blight-treant heartrot-treant', { k: 'treant', tint: MOSS, ...SMASH });
put('mourning-willow', { k: 'treant', tint: '#9aa39a', ...CASTER });
put('thornling', { k: 'plant_warrior', tint: MOSS, size: 0.72 });
put('blight-bloom rotspore-shambler', { k: 'slime', tint: '#b890d8' });
put('blighted-dryad', { k: 'plant_warrior', tint: ROT, ...CASTER });
put('briar-lasher vine-strangler', { k: 'plant_warrior', tint: MOSS, atk: 'stab' });
put('thorn-archer', { k: 'plant_archer', ...BOWMAN });
put('fey-knight thorn-court-knight prince-thistlemourn', { k: 'plant_warrior' });
put('sprite thorn-court-sprite', { k: 'wisp', tint: '#a8f0b0', size: 0.72, float: 0.35 });
put('mother-mire the-rot-mother bloated-corpse cistern-bloat cistern-vatborn abomination mire-horror', { k: 'monstrosity', tint: ROT, ...SMASH });
put('bloated-drowned', { k: 'monstrosity', tint: SEA, size: 0.85, ...SMASH });
// fire, frost and storm
put('fire-elemental magma-sentry magma-warden slag-colossus furnace-warden infernal', { k: 'golem', tint: FIRE, ...SMASH });
put('rime-elemental icebound-warden', { k: 'golem', tint: ICE, ...SMASH });
put('storm-elemental', { k: 'golem', tint: '#bcd4ff', float: 0.3, ...SMASH });
put('coral-golem', { k: 'golem', tint: '#f0a59a', ...SMASH });
put('cinder-imp slag-imp imp chained-emberkin', { k: 'tiefling', tint: FIRE, size: 0.72 });
put('pyrebrand', { k: 'tiefling', tint: FIRE, float: 0.3, ...CASTER });
put('felguard', { k: 'orc_brute', tint: FIRE, ...SMASH });
put('voidwalker', { k: 'ghost', tint: VOID, float: 0.3, ghost: 0.85, walk: 'skelidle' });
put('ashkar-the-bound', { k: 'golem', tint: FIRE, size: 1.3, ...SMASH });
// a druid's shapes
put('bear', { k: 'werewolf', tint: '#b08560', size: 1.1 });
put('cat', { k: 'a_fox', tint: '#d9b98c' });
put('moonkin', { k: 'avian', tint: '#a7a0d6' });
// small folk
put('chicken', { k: 'bird', size: 0.9 });

/** Those who fight under another's name, set apart from the creature they borrow. */
const BY_ENEMY: Record<string, Kit> = {
  'captain-vosk': { k: 'a_horse_white', tint: '#3e3a44', top: { k: 'sk_guard', tint: DARK, clip: 'sit', y: 0.62, size: 0.76 } },
  'vosk-the-hollowed': { k: 'a_horse_white', tint: '#3e3a44', top: { k: 'sk_warrior', tint: ASH, clip: 'sit', y: 0.62, size: 0.74 } },
  'the-pale-herald': TABLE['herald-in-the-spire']!,
  'the-heralds-voice': TABLE['herald-in-the-spire']!,
  'the-heralds-first-face': TABLE['herald-in-the-spire']!,
  'ash-raider': TABLE.skeleton!,
  'ash-archer': TABLE['hollow-hunter']!,
  'black-bess': { k: 'rogue_hooded', tint: DARK, size: 1.1 },
  hob: { k: 'werewolf', tint: '#b08a60', size: 1.1 },
  barghest: { k: 'a_wolf', tint: DARK, size: 1.15 },
  'obsidian-golem': { k: 'golem', tint: '#5c5868', ...SMASH },
  'the-drowned-mother': { k: 'ghost', tint: SEA, float: 0.45, ghost: 0.82, size: 1.15, walk: 'skelidle' },
};

const FALLBACK: Kit = { k: 'sk_minion', tint: ASH };

export function kitOf(sprite: string, enemy?: string): Kit {
  return (enemy ? BY_ENEMY[enemy] : undefined) ?? TABLE[sprite] ?? FALLBACK;
}

/** Whether a creature has a place of its own in the table (a test holds the data to this). */
export const hasKit = (sprite: string): boolean => sprite in TABLE;

export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
