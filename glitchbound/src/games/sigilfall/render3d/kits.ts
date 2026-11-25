import type { MountDef } from '../data/mounts';
import type { Beast } from './beast';
import type { Paint, Wear } from './repaint';

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
/**
   * A boss drawn with a shared creature (no file or form of its own: render3d/bossKit.ts): the clip of that creature's
   * skeleton it makes for each of its attack patterns, so that a charge is not a bite and a howl is not a bite either.
   * Every boss has a move for every pattern, one way or the other (the owner, 2026-11-24: bosses are animated, never
   * gliding in one pose; tests/sigilfall-bosses-move.test.ts).
   */
  moves?: Readonly<Record<string, { clip: string; rate?: number }>>;
    float?: number;
  /** Its attack clip. */
  atk?: 'chop' | 'chop2' | 'stab' | 'cast' | 'bow' | 'spin' | 'punch' | 'smash';
  /** Brightens its colors (some models are painted dark). */
  gain?: number;
  /** See-through, for what is hardly there. */
  ghost?: number;
  /** Clip to walk with, where a figure has its own way of moving. */
  walk?: string;
  /** The pose it holds while it stands still, where that is not just standing (the Hallow King's court, on its knees). */
  rest?: string;
  /** Someone on its back (a rider, a centaur's or naga's upper half). */
  top?: { k: string; tint?: string; clip: string; y: number; size: number };
  /** Worn as a person from the wardrobe instead (the story's own people, when they fight). */
  look?: string;
  /** What a person from the wardrobe holds (render3d/dress.ts WEAPONS), and a shield. */
  held?: { kind: string; tint?: string };
  shield?: boolean;
  /**
   * What a great beast wears or carries (a boss's barding, trophies, a shell): props fixed to it, turned with it. Each
   * is placed `x` to its right, `y` up and `z` forward and sized `h` long (its longest side), all as shares of the
   * beast's own height;
   * `turn` turns it about its own upright (radians), `tipX`/`tipZ` tip it forward and sideways; `both` draws it
   * from behind as well (a wall banner has only a front, and vanished when the beast turned away).
   */
  gear?: { m: string; x?: number; y: number; z?: number; h: number; tint?: string; turn?: number; tipX?: number; tipZ?: number; both?: boolean }[];
  /**
   * Built as a mount is (render3d/mountKit.ts): a great beast made the way the drakes are made, with their horns,
   * blades, wings, plates and light, sized and moved as a creature (it walks, strikes and falls as one).
   */
  steed?: MountDef;
  /**
   * Its model painted part by part (render3d/repaint.ts): each part found by its color in the file or the bone it hangs
   * from, and recolored, cut away or set alight. A model so painted needs a file of its own (`k`), since a file is
   * loaded once.
   */
  paint?: readonly Paint[];
  /** What is built onto it, on its head: a crown, eyes alight. They move with the head, as its own. */
  wears?: readonly Wear[];
  /** An animal's coat, markings, eyes and what it has that its plain model hasn't (render3d/beast.ts). */
  beast?: Beast;
  /**
   * A boss of its own (render3d/bossKit.ts): what is built onto its file's model in the browser, how it carries itself
   * and the moves it makes for what the rules have it do. Its file is `k/boss_<id>.pack`.
   */
  form?: string;
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
// Vaelor, the Hallow King, last holder of the last sigil: black plate rimed over with three hundred winters, its old
// gilding gone to pale silver, an ice greatsword alight in his hand; and the Ash Crown on his brow, his old circlet grown
// into nine points of ice, his eyes two cold lights under it. No plume: nothing of his has had color for three centuries.
put('vaelor', {
  k: 'vaelor',
  size: 1.6,
  atk: 'chop2',
  paint: [
    // the plume and the old bone crown come off the helm
    { joint: 'head', hue: [320, 20], sat: [0.5, 1], cut: true },
    { joint: 'head', hue: [20, 60], lum: [0.7, 1], cut: true },
    // the greatsword: ice, alight along its length
    { joint: 'handslot.r', lum: [0.42, 1], to: '#bfe6ff' },
    { joint: 'handslot.r', to: '#4a78c4' },
    // the red of his arms: what's left of the royal gilding
    { hue: [320, 20], sat: [0.5, 1], to: '#c2cee4' },
    // leather and cloth: frozen stiff, the blue-black of the citadel
    { hue: [10, 50], to: '#3c4668', keep: 0.8 },
    // the plate: its dark as it was, its lit faces frosted
    { hue: [190, 270], lum: [0.5, 1], to: '#9db6da' },
    { hue: [190, 270], lum: [0.24, 0.5], to: '#34446e', keep: 0.9 },
    { hue: [190, 270], to: '#141b34', keep: 0.6 },
  ],
  wears: [
    { piece: 'ice-crown', a: '#5d9ae6', b: '#f2fcff', size: 1.12 },
    { piece: 'eyes', b: '#dff6ff', lift: 0.3 },
  ],
});
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
put('king-hrodric', { k: 'sk_king' });
put('bone-golem bone-hauler', { k: 'sk_golem' });
put('the-sand-warden', { k: 'sk_golem', tint: SAND });
put('bone-giant the-bone-colossus', { k: 'sk_golem', size: 1.2 });
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
put('drowned-chanter', { k: 'sk_mage', tint: SEA, ...CASTER });
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
// the Chapel Crypt's boss fights (sim/patterns/crypt.ts): the Matron of the Ossuary, a pale old witch of the dead, and Morgrave's soul-shards
// the first of the Sigil-wardens, frozen at her post: rime-white plate, a helm of ice, the halberd of the watch
// the Host's chaplain in Highwall's chapel: a prior's grey robe and hood, the censer-staff glowing with his dirge
// Highwall's own dead, sung up again: grey-green, in what is left of their mail
put('risen-defender', { k: 'sk_guard', tint: '#a8c0a0' });
// the Faded Lights' lamp-wardens: Elowen in the morning's gold with her lamp-staff, her sister Merrin in the evening's violet
put('merrin-of-the-dusk', { k: 'witch', look: 'foe-merrin', held: { kind: 'wand', tint: '#b48aff' }, size: 1.22, float: 0.2, ...CASTER });
// the Weightless Gallery's astronomer: a robe of night and starlight, a star-crowned hat, floating well off her floor
// Duskspire's Last Mourner in black, veiled, her staff's light violet; and the dead she bids keep vigil, ash-grey
put('mourning-dead', { k: 'sk_minion', tint: '#c8c4d0' });
// The Coffin Matron, Mother of the Ossuary: an old woman of the dead, pale as her charges, white-haired under a
// mourner's veil, in grave linen and black; the dead's own arms; the coffin she hides in strapped to her back, a
// sexton's spade beside it, and eyes of the crypt's green light (her file: scripts/sigilfall-3d-assets.mjs
// BOSS_KITS; the veil, the candles on her crown and the straps: render3d/bossKit.ts).
put('coffin-matron', {
  k: 'boss_matron',
  form: 'matron',
  size: 1.5,
  // (she walks the crypt's floor: she was lifted a hand's breadth off it, and her feet went through their walk in the air)
  ...CASTER,
  paint: [
    // her eyes: the same light
    { joint: 'head', lum: [0, 0.32], to: '#9cff9c', glow: true, keep: 0.2 },
    // her hair, gone white
    { joint: 'head', hue: [335, 14], sat: [0.4, 1], to: '#dedad0', keep: 0.9 },
    // her face: the pallor of the dead
    { joint: 'head', hue: [14, 40], sat: [0.2, 0.7], to: '#cfd3c2', keep: 0.9 },
    // the bodice and the sleeves: mourning black
    { hue: [20, 36], sat: [0.7, 1], to: '#2b2632', keep: 0.9 },
    { hue: [215, 255], sat: [0.3, 1], to: '#2b2632', keep: 0.9 },
    // the skirt: grave linen
    { hue: [50, 95], sat: [0.4, 1], to: '#d6d0bd', keep: 0.9 },
    // stockings and shoes
    { hue: [5, 26], sat: [0.45, 0.75], lum: [0.3, 0.78], to: '#3a343c', keep: 0.9 },
  ],
});
put('morgrave-soul', { k: 'ghost', tint: '#9cff9c', float: 0.6, size: 0.7, ghost: 0.7, walk: 'skelidle' });
put('the-weeping-lord the-tearborn', { k: 'ghost', tint: '#bfd8f0', float: 0.45, size: 1.25, ghost: 0.82, walk: 'skelidle' });
put('corpse-candle candle-wraith', { k: 'wisp', tint: FIRE, size: 0.7, float: 0.35 });
put('marsh-light marsh-wisp', { k: 'wisp', tint: '#c8f0a0', size: 0.7, float: 0.35 });
put('storm-wisp', { k: 'wisp', tint: ICE, size: 0.7, float: 0.35 });
put('spire-mote', { k: 'wisp', tint: VOID, size: 0.7, float: 0.35 });
put('spire-echo', { k: 'vampire', tint: VOID, ghost: 0.7, float: 0.3, ...CASTER });
put('the-grey-lady', { k: 'witch', tint: PALE, ghost: 0.72, float: 0.3, ...CASTER });
/*
 * The animals, each painted and dressed as its kind (render3d/beast.ts): a coat with its belly, back, socks and muzzle,
 * eyes, and what the plain model hasn't (tusks, a bristled ridge, a mane, curled horns). A model so made is no longer
 * tinted whole.
 */
const WOLF: Beast = { coat: '#8f8c92', under: '#ddd6ca', back: '#4b4850', legs: '#6c676a', muzzle: '#e6dfd2', ears: '#37333a', tail: '#3b383e', eyes: { color: '#ffc23a' }, ridge: { color: '#3d3a42', size: 0.75 }, fangs: true };
const BEASTS = {
  wolf: WOLF,
  boneHound: { coat: '#cfc6b4', under: '#efe8d8', back: '#8f8676', legs: '#9a917f', muzzle: '#f2ecde', nose: '#3a2e2a', ears: '#6f6656', tail: '#8f8676', eyes: { color: '#ff5a3a' }, ridge: { color: '#f2ead2', size: 1.05 }, fangs: true },
  blightWolf: { coat: '#5c6a48', under: '#8a9a6a', back: '#2f3a26', legs: '#3a4630', muzzle: '#93a274', eyes: { color: '#c8ff5a' }, pattern: { kind: 'seams', color: '#a8ff5a', lit: true, amount: 0.9 }, ridge: { color: '#263020', size: 0.9 }, fangs: true },
  magmaHound: { coat: '#2b2325', under: '#4a3230', back: '#151012', legs: '#1c1516', muzzle: '#5a3a30', eyes: { color: '#ffd23a', size: 1.15 }, pattern: { kind: 'seams', color: '#ff7a1e', lit: true }, ridge: { color: '#ff9a3a', size: 1, lit: true }, fangs: true },
  warHound: { coat: '#bdb6ae', under: '#e6e0d8', back: '#6f6862', legs: '#8a837c', muzzle: '#ebe5dc', ears: '#4a4440', tail: '#5f5852', eyes: { color: '#ff4a2a', size: 1.1 }, ridge: { color: '#4f4944', size: 1.1 }, fangs: true },
  barghest: { coat: '#232028', under: '#3a3440', back: '#0f0d12', legs: '#15131a', muzzle: '#403848', eyes: { color: '#ff3a2a', size: 1.2 }, pattern: { kind: 'seams', color: '#c02a3a', lit: true, amount: 0.7 }, ridge: { color: '#0c0a0f', size: 1.2 }, fangs: true },
  rimeHound: { coat: '#a9c8de', under: '#f6fcff', back: '#5d84a6', legs: '#7fa2be', muzzle: '#ffffff', nose: '#27384a', ears: '#3f6282', tail: '#f6fcff', eyes: { color: '#7fe0ff', size: 1.1 }, ridge: { color: '#e2f8ff', size: 0.85, lit: true } },
  boar: { coat: '#4b3a30', under: '#7c6454', back: '#261c17', legs: '#1f1714', muzzle: '#6e5048', nose: '#8f6660', ears: '#2a1f1a', eyes: { color: '#ff9a3a', size: 0.9 }, tusks: 1.35, ridge: { color: '#19120f', size: 1.6 } },
  russetBoar: { coat: '#b5683f', under: '#e2ac84', back: '#7a3f22', legs: '#4a2a1a', muzzle: '#c98a68', nose: '#8a4a3a', ears: '#6a3620', eyes: { color: '#2a1810', size: 0.9, dark: true }, tusks: 1, ridge: { color: '#5a2e18', size: 1.15 } },
  frostRam: { coat: '#dfeefa', under: '#ffffff', back: '#bdd8ee', legs: '#3a4a5c', muzzle: '#33414f', nose: '#1a222c', ears: '#33414f', eyes: { color: '#7fe0ff' }, horns: { kind: 'ram', color: '#8fb6d8', size: 1.15 } },
  stag: { coat: '#a8744a', under: '#eedfc4', back: '#7a5030', legs: '#4a3424', muzzle: '#eadac0', tail: '#ffffff', ears: '#5a3a22', eyes: { color: '#2a1c14', dark: true }, antlers: { skull: 0.42, color: '#e6d6b4' } },
  blightedStag: { coat: '#6f7a58', under: '#9aa67c', back: '#3c4630', legs: '#2c3424', muzzle: '#a4ae86', eyes: { color: '#c8ff5a' }, pattern: { kind: 'seams', color: '#a8ff5a', lit: true, amount: 0.8 }, antlers: { skull: 0.42, color: '#3a3428' } },
  lion: { coat: '#d9a45a', under: '#f6e2b4', back: '#b07a38', legs: '#c08a48', muzzle: '#f8ecd0', nose: '#5a3028', ears: '#8a5a2a', tail: '#d9a45a', tuft: '#5a3418', mane: { color: '#7a4a22', size: 1.25 }, eyes: { color: '#ffb02e' }, fangs: true },
  panther: { coat: '#2d2b37', under: '#46424f', back: '#16151c', legs: '#201e28', muzzle: '#4a4654', nose: '#0c0b10', eyes: { color: '#7dff8a', size: 1.1 }, pattern: { kind: 'spots', color: '#0d0c12', amount: 0.85 }, fangs: true },
  rat: { coat: '#7b756c', under: '#b9b1a5', back: '#4e4943', legs: '#c59a94', muzzle: '#a99f93', nose: '#e09a98', ears: '#d6a09a', tail: '#d9a6a0', eyes: { color: '#ff4a3a', size: 0.85 } },
  cat: { coat: '#d9b98c', under: '#f4e6cc', back: '#a8824e', legs: '#c8a674', muzzle: '#f8eeda', nose: '#c8807a', eyes: { color: '#8aff9a' }, pattern: { kind: 'stripes', color: '#8a683c', amount: 0.75 } },
  raptor: { coat: '#b8894e', under: '#ecd8a8', back: '#6a4526', legs: '#5a4030', muzzle: '#b8894e', nose: 'none', tail: '#3a2616', eyes: { color: '#ffe03a', size: 1.1 }, pattern: { kind: 'stripes', color: '#4a2e18', amount: 0.85 }, ridge: { color: '#c8402a', size: 1 }, fangs: true },
  griffon: { coat: '#c89a52', under: '#ead7a6', back: '#8a6430', legs: '#7a5628', head: '#f4efe2', muzzle: '#f4efe2', nose: 'none', ears: '#d8d0c0', tail: '#5a3a18', tuft: '#4a2e12', eyes: { color: '#ffb428', size: 1.25 }, beak: '#f0b030', wings: { color: '#b08040', tip: '#f4efe2', size: 1.05 } },
} satisfies Record<string, Beast>;

// the risen beasts of the Host
put('hound grave-hound barrow-hound pale-hound grave-wolf', { k: 'a_wolf', beast: BEASTS.boneHound });
put('blight-wolf', { k: 'a_wolf', beast: BEASTS.blightWolf });
put('magma-hound', { k: 'a_wolf', beast: BEASTS.magmaHound });
// Gallows Keep's war-hound: a scarred brute twice a wolf's size
put('gnasher', {
  k: 'a_wolf',
  beast: BEASTS.warHound,
  // his bites are the wolf's bite; he leaps into his charges, digs to go under the floor, and stands low and
  // bristling to call the pack (the wolf's own clips: scripts/sigilfall-3d-assets.mjs MORE_CLIPS)
  moves: {
    cleave: { clip: 'chop', rate: 1.2 },
    charge: { clip: 'leap' },
    tripleCharge: { clip: 'leap', rate: 1.3 },
    'gallows:burrow': { clip: 'dig' },
    summon: { clip: 'low', rate: 1.4 },
  },
  // (he was 2.3 of a wolf: eight tiles of hound, too long to see his own attacks past, and too big to stride)
  size: 1.3,
  gear: [
    // (the wolf stands 1 tall and runs from 1.1 behind to 0.95 ahead: its neck about 0.5 ahead, 0.7 up)
    // a great ash-pale war-wolf in the gang's black iron: a spiked collar, pauldrons, and the skulls of what he has
    // run down slung at his hips and shoulders (the gang's banner stood from his back until the owner had it off:
    // "we can remove gnashers banners as they seem floating with his body, can you add big skulls to the side of
    // his hips")
    { m: 'w_shield_spikes', y: 0.42, z: 0.6, h: 0.4, tint: '#5a5660' },
    { m: 'BlackKnight_ShoulderLeft', x: 0.19, y: 0.46, z: 0.32, h: 0.32, tint: '#5a5660' },
    { m: 'BlackKnight_ShoulderRight', x: -0.19, y: 0.46, z: 0.32, h: 0.32, tint: '#5a5660' },
    // the great ones, one on each haunch, looking outward, set half into his side so they rest on him (measured on
    // the model: his body is 0.17 of his height to each side there; further back is only his tail, and skulls hung
    // there floated beside it)
    { m: 'skull', x: 0.165, y: 0.5, z: -0.3, h: 0.22, turn: Math.PI / 2, tint: BONE },
    { m: 'skull', x: -0.165, y: 0.5, z: -0.3, h: 0.22, turn: -Math.PI / 2, tint: BONE },
    // and the lesser, at his flanks
    { m: 'skull', x: 0.16, y: 0.55, z: 0.02, h: 0.13, turn: Math.PI / 2, tint: BONE },
    { m: 'skull', x: -0.16, y: 0.55, z: 0.02, h: 0.13, turn: -Math.PI / 2, tint: BONE },
  ],
});
put('rime-hound ice-wolf', { k: 'a_husky', beast: BEASTS.rimeHound });
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
// the Deepforge's Runewarden: dwarven stone, the Host's pale binding-crown on its brow, the dwarves' great hammer on its
// back, rune-stones glowing gold in its shoulders
// the Host's founder in the Bone-Steel Foundry: a giant of fused bone, her anvil slung on her back, the founder's hammer
// and her crucible white-hot

/* ------------------------------------------------------------------ the living */
put('cutthroat', { k: 'rogue_hooded', look: 'foe-cutthroat', held: { kind: 'dagger' } });
put('bandit-archer', { k: 'ranger', tint: '#b0a090', look: 'foe-bandit-archer', held: { kind: 'bow' }, ...BOWMAN });
put('enforcer', { k: 'barbarian', look: 'foe-enforcer', held: { kind: 'axe' }, atk: 'chop2' });
put('hangman', { k: 'barbarian', tint: DARK, look: 'foe-hangman', held: { kind: 'greatsword' }, atk: 'chop2' });
put('varric', { k: 'survivalist', size: 1.12, look: 'foe-varric', held: { kind: 'axe' } });
put('smuggler', { k: 'rogue', look: 'foe-smuggler', held: { kind: 'sword' } });
put('dune-raider', { k: 'rogue_hooded', tint: SAND, look: 'foe-dune-raider', held: { kind: 'sword' } });
put('dune-javelineer', { k: 'ranger', tint: SAND, look: 'foe-dune-javelineer', held: { kind: 'spear' }, ...BOWMAN });
put('serpent-cultist', { k: 'rogue_hooded', tint: '#8fc78a', look: 'foe-serpent-cultist', held: { kind: 'staff' }, ...CASTER });
put('hedge-witch bog-hag rotbloom-matron', { k: 'witch', look: 'foe-hedge-witch', held: { kind: 'staff' }, ...CASTER });
put('rot-sister blight-witch', { k: 'witch', tint: ROT, look: 'foe-blight-witch', held: { kind: 'staff' }, ...CASTER });
// the Charnel Drain's warden: the cistern's own stone, the brew grown into every crack of him, the drain's valve-wheel on
// his back
// the catacombs: the Herald's spymaster in a dark hood and oiled leathers, daggers in hand; the old kings' Auditor, a clerk's ghost in ink-black and gold
put('maelis-crane', { k: 'cleric', look: 'chancellor-crane', ...CASTER });
put('goblin', { k: 'ranger', tint: '#9aa878', look: 'foe-briar-poacher', held: { kind: 'bow' }, ...BOWMAN });
put('ridge-kobold kobold-candler', { k: 'caveman', tint: '#d0a070', size: 0.72 });
put('king-snagtooth', { k: 'orc_brute', tint: '#d0b890', size: 0.9, ...SMASH });
put('butcher-krogg swamp-troll', { k: 'orc_brute', tint: '#a8c090', ...SMASH });
// (the land's people in the heroes' own clothes: the set's farmer, engineer and old scholar wore overalls, goggles and spectacles)
put('smith', { k: 'engineer', look: 'folk-smith', held: { kind: 'hammer' } });
put('villager', { k: 'farmer_b', look: 'folk-villager' });
put('elder', { k: 'lorekeeper', look: 'folk-elder', held: { kind: 'staff' } });
put('mystic', { k: 'witch', look: 'folk-mystic', held: { kind: 'staff' }, ...CASTER });

/* ------------------------------------------------------------------ giants and things of the land */
put('frost-giant giant-huscarl giant-hurler jarl-hrimfang', { k: 'barbarian_large', tint: ICE, atk: 'chop2' });
put('yeti', { k: 'golem', tint: '#eef4ff', ...SMASH });
put('wolf', { k: 'a_wolf', beast: BEASTS.wolf });
put('werewolf werewolf-howler moonfang', { k: 'werewolf' });
// (a boar is a boar: it was the wolf in a paler coat)
put('boar', { k: 'fbx_pig', beast: BEASTS.boar });
put('russet-boar', { k: 'fbx_pig', beast: BEASTS.russetBoar, size: 0.86 });
// Grimtusk, Warlord of the Whisperwood: "a boar the size of a cart", the Host's violet light in its eyes and in the
// motes that hang about it. Built as the great boars are (render3d/mountKit.ts), bare of any saddle: black bristle
// unbroken down its spine, tusks grown long and wide.
put('grimtusk', {
  k: 'a_bull',
  size: 1.12,
  form: 'grimtusk',
  steed: { id: 'boss-grimtusk', name: 'Grimtusk', lore: '', from: '', source: { kind: 'clears', regions: ['whisperwood'], tier: 0 }, body: 'boar', bare: true, coat: '#2e2622', mane: '#120e0c', tack: '#2e2622', tusks: true, plate: '#3a2e3e', glow: { kind: 'motes', color: '#b48cff' }, tier: 'shop' },
});
put('stag', { k: 'a_stag', beast: BEASTS.stag });
put('blighted-stag', { k: 'a_stag', beast: BEASTS.blightedStag });
put('frost-ram', { k: 'fbx_sheep', beast: BEASTS.frostRam });
// (no great cat in the art set: a big hunter's body, its coat tawny, reads truer than a fox grown large)
put('plains-lion', { k: 'a_wolf', beast: BEASTS.lion, size: 1.3 });
put('jungle-panther', { k: 'a_wolf', beast: BEASTS.panther, size: 1.2 });
// (a griffon is a lion with an eagle's head and wings, not a man in feathers: it was the bird-folk's model in gold)
put('griffon', { k: 'a_wolf', beast: BEASTS.griffon, size: 1.25 });
// (a great bird, not a bird-man: the feathered bird of the built creatures, big and on the wing)
put('cliff-roc', { k: 'bird', tint: '#c89a68', size: 1.3, float: 0.5 });
put('harpy storm-harpy', { k: 'avian' });
put('carrion-crow gibbet-crow plague-crow', { k: 'bird', tint: '#57536c', size: 0.8, float: 0.45 });
put('canyon-raptor', { k: 'fbx_raptor', beast: BEASTS.raptor });
put('centaur-outrider', { k: 'a_horse', tint: '#caa27f', top: { k: 'top_centaur', clip: 'bow', y: 0.5, size: 0.72 } });
put('centaur-warbringer', { k: 'a_horse', tint: '#8f6b52', top: { k: 'top_centaur', clip: 'idle', y: 0.5, size: 0.72 } });
// small crawling things
put('spider cistern-broodling', { k: 'spider', size: 0.74 });
put('gloam-lurker', { k: 'spider', tint: '#7a7a9a', size: 0.86 });
put('tide-lurker', { k: 'crab', tint: SEA, size: 0.86 });
put('crab', { k: 'crab', size: 0.8 });
// the shore crabs' matriarch, shell crusted with barnacles
// Mother Clatterclaw: a matriarch the size of a boat, her shell gone blood-dark with age, the bones of a leviathan grown
// into it (its ribs arched over her back, its skull behind, sockets up), crusted with barnacles, kelp hanging from the ribs
put('clatterclaw', {
  k: 'crab',
  tint: '#6a1c14',
  gain: 1.15,
  // (2.1 until the bosses were looked over: his legs reached a dozen tiles, three times the ground the rules give him)
  size: 1.6,
  gear: [
    { m: 'ribcage', y: 0.3, z: -0.15, h: 1.35, tint: '#e0d6c0' },
    { m: 'skull', y: 0.25, z: -0.75, h: 0.85, turn: Math.PI, tipX: -0.6, tint: '#d8ccb0' },
    { m: 'Rock_1_A', x: -0.25, y: 0.9, z: -0.45, h: 0.32, tint: '#8a9a98' },
    { m: 'Rock_1_A', x: 0.4, y: 0.75, z: 0.1, h: 0.26, tint: '#7a8a88' },
    { m: 'Rock_1_A', x: 0.1, y: 1.05, z: -0.1, h: 0.2, tint: '#9aaaa8' },
    { m: 'hanging_moss', x: 0.55, y: 0.3, z: -0.1, h: 0.9, tint: '#2e6e4a' },
    { m: 'hanging_moss', x: -0.55, y: 0.3, z: -0.25, h: 0.85, tint: '#2e6e4a' },
  ],
});
put('sand-scorpion', { k: 'scorpion' });
// (a barkling: a knot of living wood with bark for a shell, not a beetle of another art set)
put('beetle', { k: 'treant', tint: BARK, size: 0.6, ...SMASH });
put('scarab-swarm tomb-scarab', { k: 'scarab', size: 0.72 });
put('marsh-strider', { k: 'strider' });
put('blood-mosquito glimmer-moth rotwood-pod', { k: 'moth', size: 0.8, float: 0.4 });
// the Tomb's Vizier Khepset: the dead king's vizier in the sun's gold, his crown of office on his brow, a gold staff
// the Barrow's Lamp-Eater: a drake built as the great drake mounts are, blacked out by a thousand years of devoured
// lamplight: black plate, a crown of horns, wings veined with the pale fire of the lamps it has eaten
put('gloomwing', {
  k: 'fbx_trex',
  size: 1.75,
  steed: {
    id: 'boss-gloomwing',
    name: 'Gloomwing',
    lore: '',
    from: '',
    source: { kind: 'clears', regions: ['barrow-of-kings'], tier: 0 },
    body: 'drake',
    coat: '#18141e',
    mane: '#221a2c',
    tack: '#0e0c12',
    plate: '#2a2434',
    extras: ['plates', 'crown', 'veins', 'runes'],
    glow: { kind: 'motes', color: '#b8a8ff' },
    tier: 'shop',
  },
});
put('cistern-rat', { k: 'a_fox', beast: BEASTS.rat, size: 0.5 });
put('slime', { k: 'plant_warrior', tint: MOSS, size: 0.78 });
put('slag-lump', { k: 'slime', tint: FIRE });
put('cursed-hoard', { k: 'mimic' });
put('kraken-spawn', { k: 'spider', tint: SEA, size: 0.8 });
put('temple-viper', { k: 'viper', size: 0.72 });
put('mere-serpent', { k: 'serpent', size: 0.8 });
put('sand-wurm', { k: 'wurm', size: 0.85 });
put('naga-warrior', { k: 'naga_coil', top: { k: 'top_naga', clip: 'idle', y: 0.52, size: 0.66 } });
put('the-coiled-queen', { k: 'naga_coil', size: 1.25, top: { k: 'top_naga', tint: GOLD, clip: 'cast', y: 0.52, size: 0.66 } });
put('mirefin mirefin-oracle barnacle-brute deep-siren old-barnacle the-tide-lord', { k: 'monster', tint: SEA });
// what grows
put('treant old-rotbark', { k: 'treant', tint: BARK, ...SMASH });
put('blight-treant heartrot-treant', { k: 'treant', tint: MOSS, ...SMASH });
put('mourning-willow', { k: 'treant', tint: '#9aa39a', ...CASTER });
put('thornling', { k: 'plant_warrior', tint: MOSS, size: 0.72 });
put('blight-bloom rotspore-shambler', { k: 'slime', tint: '#b890d8' });
put('blighted-dryad', { k: 'plant_warrior', tint: ROT, ...CASTER });
put('briar-lasher vine-strangler', { k: 'plant_warrior', tint: MOSS, atk: 'stab' });
put('thorn-archer', { k: 'plant_archer', ...BOWMAN });
put('fey-knight thorn-court-knight prince-thistlemourn', { k: 'plant_warrior' });
put('sprite thorn-court-sprite', { k: 'wisp', tint: '#a8f0b0', size: 0.72, float: 0.35 });
put('mother-mire bloated-corpse cistern-bloat cistern-vatborn abomination mire-horror', { k: 'monstrosity', tint: ROT, ...SMASH });
put('bloated-drowned', { k: 'monstrosity', tint: SEA, size: 0.85, ...SMASH });
// fire, frost and storm
put('fire-elemental magma-sentry magma-warden furnace-warden infernal', { k: 'golem', tint: FIRE, ...SMASH });
put('rime-elemental icebound-warden', { k: 'golem', tint: ICE, ...SMASH });
put('storm-elemental', { k: 'golem', tint: '#bcd4ff', float: 0.3, ...SMASH });
put('coral-golem', { k: 'golem', tint: '#f0a59a', ...SMASH });
put('cinder-imp slag-imp imp chained-emberkin', { k: 'tiefling', tint: FIRE, size: 0.72 });
put('pyrebrand', { k: 'tiefling', tint: FIRE, float: 0.3, ...CASTER });
put('felguard', { k: 'orc_brute', tint: FIRE, ...SMASH });
put('voidwalker', { k: 'ghost', tint: VOID, float: 0.3, ghost: 0.85, walk: 'skelidle' });
// a druid's shapes
// (its own model, built in scripts/sigilfall-3d-assets.mjs bearKit: it was a werewolf in brown)
put('bear', { k: 'bear', size: 1.2 });
put('cat', { k: 'a_fox', beast: BEASTS.cat });
put('moonkin', { k: 'avian', tint: '#a7a0d6' });
// small folk
put('chicken', { k: 'bird', size: 0.9 });
// the animals of a farm and a village (sim/critters.ts): a white sheep, a pink pig, a brown dog, a bay horse
put('farm-sheep', { k: 'fbx_sheep', beast: { coat: '#efe9dc', under: '#ffffff', back: '#ddd5c4', legs: '#3a3028', muzzle: '#3a3028', nose: '#241c18', ears: '#3a3028', eyes: { color: '#1c1410', dark: true } } });
put('farm-pig', { k: 'fbx_pig', beast: { coat: '#e9a9a0', under: '#f6cdc4', back: '#d98f86', legs: '#c8807a', muzzle: '#f2b6ac', nose: '#d07a72', ears: '#d98f86', eyes: { color: '#2a1810', size: 0.9, dark: true } } });
put('farm-dog', { k: 'a_husky', beast: { coat: '#b9884f', under: '#f1deba', back: '#7c5429', legs: '#a57842', muzzle: '#f4e6cc', nose: '#2a1e1a', ears: '#6a4622', tail: '#f1deba', eyes: { color: '#2a1c14', dark: true } } });
put('farm-horse', { k: 'a_horse', tint: '#9a6844' });

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
  barghest: { k: 'a_wolf', beast: BEASTS.barghest, size: 1.15 },
  'obsidian-golem': { k: 'golem', tint: '#5c5868', ...SMASH },
  'the-drowned-mother': { k: 'ghost', tint: SEA, float: 0.45, ghost: 0.82, size: 1.15, walk: 'skelidle' },
  // the Hallow King's remembered (sim/patterns/hallow-king.ts): the hero's own beaten foes as the Ash Crown keeps them,
  // ash-grey and not quite here
  'echo-of-corvane': { k: 'black_knight', tint: '#a8a4b4', ghost: 0.74, atk: 'chop2' },
  'echo-of-morvain': { k: 'black_knight', tint: '#b4b0bc', ghost: 0.74, size: 1.08, atk: 'chop2' },
  'echo-of-the-gatewarden': { k: 'black_knight', tint: '#9c98a8', ghost: 0.74, size: 1.15, atk: 'chop2' },
  'echo-of-the-weeping-lord': { k: 'ghost', tint: '#c8c4d4', float: 0.45, ghost: 0.7, size: 1.2, walk: 'skelidle' },
  'echo-of-ashkar': { k: 'golem', tint: '#a8a4ac', ghost: 0.74, size: 1.2, ...SMASH },
  'echo-of-vosk': { k: 'a_horse_white', tint: '#8e8a98', ghost: 0.74, top: { k: 'sk_warrior', tint: ASH, clip: 'sit', y: 0.62, size: 0.74 } },
  // his court, kneeling below the throne: the lords of Vaelmoor in their grave-silks
  'court-of-the-dead': { k: 'sk_warrior', tint: '#b4aed0', rest: 'sit' },
};

/*
 * The bosses: each is its soldiers' model only in its bones. It stands taller than they do, its eyes are alight, and it
 * wears what its story gives it (a crown, horns, a disc of rays), built onto its head so it moves as its own; where its
 * model was one flat tint it is painted in two (render3d/repaint.ts).
 */
// Warden Ossric, Keeper of the Crypt Gate: a warden of Aster who died at this gate three hundred years ago, woken by
// the raiders' grieflight. His own plate gone to verdigris, the Regent's blue faded on his cape, his skull bare
// with two grave candles burning gold on it (the candles of his fight), a halberd and a great shield.
TABLE.ossric = {
  k: 'boss_ossric',
  form: 'ossric',
  size: 1.42,
  atk: 'chop2',
  paint: [
    // his eyes: candle gold
    { joint: 'head', lum: [0, 0.3], hue: [0, 360], to: '#ffd88a', glow: true, keep: 0.2 },
    // the cape and what cloth he wears: the Regent's blue, three hundred years faded
    { hue: [330, 25], sat: [0.45, 1], to: '#3d4f78', keep: 0.9 },
    // the plate: old bronze gone green-grey (his bones are left bone)
    { joint: 'head', lum: [0.3, 1], to: '#e6dfc8', keep: 0.9 },
    { hue: [190, 260], sat: [0.08, 1], to: '#6f7d74', keep: 1 },
  ],
};
// Morgrave, the Ash-Scholar: a scholar thrown out of the Crown City's college, who sold himself to the Host. Ash-grey
// in the face behind his spectacles, his robes the Host's ash and violet, his pack of books still on his back, the
// rift's light in the book he reads from and in the crown the Host gave him.
TABLE.morgrave = {
  k: 'boss_morgrave',
  form: 'morgrave',
  size: 1.38,
  atk: 'cast',
  paint: [
    // the open book's pages: alight with the rift
    { joint: 'handslot.l', lum: [0.82, 1], to: '#ff9af0', glow: true, keep: 0.3 },
    { joint: 'handslot.l', to: '#3a2f48', keep: 0.9 },
    // his face: ash
    { joint: 'head', hue: [10, 40], sat: [0.2, 0.75], to: '#b9b4bf', keep: 0.9 },
    // the robes: the Host's ash, and violet where they were bright
    { hue: [240, 330], sat: [0.25, 1], to: '#5a3f7a', keep: 0.9 },
    { hue: [60, 180], sat: [0.2, 1], to: '#4a4654', keep: 0.9 },
  ],
  wears: [{ piece: 'ice-crown', a: '#7a2ab8', b: '#ff9af0', band: '#4a3a5c' }],
};
// The Hangman, Headsman of the Gallows Gang: "He hangs the people of Millbrook who can't pay the rope tax." A giant
// bare to the waist, pale as tallow, under a headsman's black hood with only a slit to see by; the apron and breeches
// of his trade the brown of old blood, the gang's iron on his axe.
TABLE.hangman = {
  k: 'boss_hangman',
  form: 'hangman',
  // (his axe held out makes him wider than he is tall, and a figure is sized by the greater: this stands him on his
  // circle)
  size: 1.5,
  atk: 'chop2',
  paint: [
    // the slit of his hood: what looks out of it catches the light of the fire pits
    { joint: 'head', hue: [5, 45], sat: [0.2, 0.9], lum: [0.35, 1], to: '#ff8a4a', glow: true, keep: 0.2 },
    // the hood and mask: black
    { joint: 'head', to: '#17131b', keep: 0.85 },
    // his hide: tallow-pale
    { hue: [8, 42], sat: [0.25, 0.8], lum: [0.4, 1], to: '#b89274', keep: 0.75 },
    // what cloth and fur he wears: old blood
    { hue: [200, 360], sat: [0.15, 1], to: '#4a2222', keep: 0.9 },
    { hue: [45, 200], sat: [0.15, 1], to: '#3a2a26', keep: 0.9 },
  ],
};
// Harlan Blackglove, King of the Gallows Gang: a bandit who crowned himself. Road leathers gone black with use, a
// cape the red of the gang's banners, the black gauntlet on his left arm, a crown of stolen gold with a shard of
// rift-glass for its jewel (the only magic he owns, and he doesn't know what it is).
TABLE.varric = {
  k: 'boss_harlan',
  form: 'harlan',
  size: 1.3,
  atk: 'chop',
  paint: [
    // the black glove: black iron over the Knight's plate arm
    { joint: 'upperarm.l', to: '#1d1a22', keep: 0.9 },
    { joint: 'lowerarm.l', to: '#1d1a22', keep: 0.9 },
    { joint: 'wrist.l', to: '#1d1a22', keep: 0.9 },
    { joint: 'hand.l', to: '#141218', keep: 0.9 },
    // the cape and what was bright on him: the gang's red
    { hue: [80, 200], sat: [0.25, 1], to: '#7a1e22', keep: 0.9 },
    // a sash of the same red at his waist
    { joint: 'spine', to: '#8a2226', keep: 0.9 },
    // his road leathers, which the pack has near black: worn brown, so he is a man and not a shadow from above
    ...['chest', 'hips', 'upperarm.r', 'lowerarm.r', 'upperleg.l', 'upperleg.r', 'lowerleg.l', 'lowerleg.r'].map((joint) => ({ joint, lum: [0, 0.5] as [number, number], to: '#7a5638', keep: 0.9 })),
    { joint: 'foot.l', to: '#3a2c24', keep: 0.9 },
    { joint: 'foot.r', to: '#3a2c24', keep: 0.9 },
  ],
};
// Silas Vey, the Herald's Last Hand: the Pale Herald's spymaster in Aster for twenty years. Nobody in the city could
// have described him: a grey hood, a grey mask, the purses of the Herald's payroll hung about him, and in his off
// hand the ash-gold itself, the only thing on him with any light in it.
TABLE['silas-vey'] = {
  k: 'boss_silas',
  form: 'silas',
  size: 1.3,
  atk: 'chop',
  paint: [
    // the ash-gold in his hand: pale, and alight
    { joint: 'handslot.l', to: '#f0e0a0', glow: true, keep: 0.25 },
    // the mask and what shows under the hood: dark
    { joint: 'head', lum: [0, 0.45], to: '#1c1a22', keep: 0.85 },
    // hood, cloak and leathers: the grey nobody remembers
    { hue: [70, 200], sat: [0.18, 1], to: '#5c5a68', keep: 0.9 },
    { hue: [200, 330], sat: [0.18, 1], to: '#4a4654', keep: 0.9 },
    // the purses: worn leather
    { joint: 'hips', hue: [10, 60], to: '#7a5a3a', keep: 0.85 },
  ],
};
// The Royal Auditor, Keeper of the Old Kings' Accounts: dead at his desk after forty years and still at his sums. The
// robes of the old kings' household gone the blue-black of old ink, his skull bare with his spectacles on it, the
// ledger open in his hand with its page alight: every blow struck is being written there.
TABLE['the-royal-auditor'] = {
  k: 'boss_auditor',
  form: 'auditor',
  // (a gaunt figure in narrow robes: he is sized to stand on his circle, and so stands tall)
  size: 1.66,
  atk: 'cast',
  paint: [
    // the open ledger's page
    { joint: 'handslot.l', lum: [0.8, 1], to: '#f0e0a0', glow: true, keep: 0.3 },
    { joint: 'handslot.l', to: '#3a3040', keep: 0.9 },
    // his skull
    { joint: 'head', lum: [0.35, 1], sat: [0, 0.45], to: '#cfc6aa', keep: 0.9 },
    // the robes: old ink, with what was bright on them left a dull gold
    { hue: [25, 65], sat: [0.45, 1], to: '#b8963e', keep: 0.85 },
    { hue: [65, 360], sat: [0.15, 1], to: '#2e3550', keep: 0.9 },
    { hue: [0, 25], sat: [0.15, 1], to: '#2e3550', keep: 0.9 },
  ],
  wears: [{ piece: 'eyes', b: '#f0e0a0' }],
};
// King Hrodric, the Barrow King: "the first king buried on the downs", woken with his whole court. A king of the old
// north, a head taller than the men of now, three hundred years in the cold: his hide gone the grey-blue of the frost
// he strikes with, his skull bare under the crown he was buried in, the mound's cold alight in his eyes.
TABLE['king-hrodric'] = {
  k: 'boss_hrodric',
  form: 'hrodric',
  size: 1.76,
  atk: 'chop2',
  paint: [
    // the great sword's bright edge: rimed, and alight with the cold he strikes the floor with
    { joint: 'handslot.r', sat: [0, 0.2], lum: [0.4, 1], to: '#bfe8ff', glow: true, keep: 0.3 },
    // the crown he was buried in: old gold
    { joint: 'head', hue: [25, 65], sat: [0.4, 1], to: '#c9a24a', keep: 0.85 },
    { joint: 'head', hue: [240, 330], sat: [0.2, 1], to: '#c9a24a', keep: 0.85 },
    // his skull
    { joint: 'head', lum: [0.3, 1], to: '#e6dfc8', keep: 0.9 },
    // his hide: frost-grey, dead
    { hue: [8, 42], sat: [0.25, 0.8], lum: [0.4, 1], to: '#8fa3b8', keep: 0.75 },
    // what was bright in his gear: the tarnish of the mound
    { hue: [330, 8], sat: [0.3, 1], to: '#4a5a78', keep: 0.9 },
  ],
  wears: [{ piece: 'ice-crown', a: '#8a6a22', b: '#f0d27a', band: '#c9a24a' }, { piece: 'eyes', b: '#bfe8ff' }],
};
/* The Tomb of the Sun King and the Vault of Rime (Act III) */
// The Sun King, Risen Lord of the Old Kingdom: a warden of the seven, three hundred years sealed in with his sigil. A
// king's long coat gone the white and gold of his house, his skull bare, the sun-disc behind his head alight, a crown
// and a ring of light over it: the one boss of the game who is all noon.
TABLE['the-sun-king'] = {
  k: 'boss_sunking',
  form: 'sunking',
  size: 1.5,
  atk: 'cast',
  paint: [
    // the sun-disc behind him: its bright face alight
    { joint: 'chest', lum: [0.55, 1], sat: [0.3, 1], to: '#ffe9a0', glow: true, keep: 0.3 },
    // the rest of the disc: beaten gold, not the grey steel of the shield it is made from
    { joint: 'chest', lum: [0.5, 1], sat: [0, 0.3], to: '#e0b040', keep: 0.8 },
    // his skull
    { joint: 'head', lum: [0.35, 1], sat: [0, 0.45], to: '#e6dfc8', keep: 0.9 },
    // the coat: what was red or dark on it, the old kingdom's white linen and gold
    { hue: [330, 30], sat: [0.3, 1], to: '#d8a830', keep: 0.9 },
    { lum: [0, 0.3], to: '#efe4c8', keep: 0.6 },
    { hue: [190, 330], sat: [0.15, 1], to: '#c8a050', keep: 0.9 },
  ],
  wears: [{ piece: 'halo', a: '#e8a030', b: '#fff4c0', size: 1.1 }, { piece: 'ice-crown', a: '#d89a2a', b: '#fff6c8', band: '#b8862a' }, { piece: 'eyes', b: '#fff2a0' }],
};
// Vizier Khepset, Keeper of the Last Hour: buried with his king to serve him after death. Court robes of sand-white
// and a cape of the house's gold on a hooded skull, and in his left hand the sand-glass whose turning undoes every
// wound given him: the glass is the one thing on him with light in it, and the thing to break.
TABLE['vizier-khepset'] = {
  k: 'boss_khepset',
  form: 'khepset',
  size: 1.5,
  atk: 'cast',
  paint: [
    // his skull: only the bone, which is the palest thing on his head
    { joint: 'head', lum: [0.72, 1], sat: [0, 0.4], to: '#e6dfc8', keep: 0.9 },
    // his hood: the house's gold. His robes and cape: the deep blue-green of the tomb's glazed tiles, so that he
    // stands dark on the sand floor (in sand-white he was a pale heap on it)
    { joint: 'head', to: '#c8962a', keep: 0.85 },
    { hue: [330, 40], sat: [0.3, 1], to: '#d8a830', keep: 0.9 },
    { hue: [190, 330], sat: [0.2, 1], to: '#1f5666', keep: 0.85 },
  ],
  wears: [{ piece: 'eyes', b: '#ffd27a' }],
};
// The Sand Warden, Guardian of the Sun King's Tomb: built, not buried. Red sandstone, the joints and the cut
// lines of it dark, a mace of the house's gold, the sun-disc on its back alight and its eyes the same.
TABLE['the-sand-warden'] = {
  k: 'boss_sandwarden',
  form: 'sandwarden',
  size: 1.82,
  atk: 'chop2',
  paint: [
    // the sun-disc in its chest
    { joint: 'chest', hue: [0, 360], sat: [0.6, 1], lum: [0.35, 1], to: '#ffe08a', glow: true, keep: 0.3 },
    // its mace: the house's gold
    { joint: 'handslot.r', to: '#d8a830', keep: 0.9 },
    // red sandstone, dark in the joints: it stands on a floor of pale sand, and in pale stone it was lost on it
    { lum: [0.55, 1], to: '#b06c3c', keep: 0.9 },
    { lum: [0.3, 0.55], to: '#7c4426', keep: 0.9 },
    { to: '#2e1a10', keep: 0.85 },
  ],
  wears: [{ piece: 'eyes', b: '#ffe08a' }],
};
// Jarl Hrimfang, Jarl of the Rime Giants: two hundred years of treaty, sold for ash-gold. A frost giant's hide
// ice-blue under a white bear's pelt, rime on his maul, and at his belt the pale gold he was paid in, alight as that
// gold is: what he did is on him where everyone can see it.
TABLE['jarl-hrimfang'] = {
  k: 'boss_hrimfang',
  form: 'hrimfang',
  size: 1.82,
  atk: 'chop2',
  paint: [
    // the ash-gold at his belt
    { joint: 'hips', hue: [30, 65], sat: [0.6, 1], lum: [0.5, 1], to: '#f0e0a0', glow: true, keep: 0.25 },
    // his hide: ice
    { hue: [8, 42], sat: [0.25, 0.8], lum: [0.4, 1], to: '#a9c8e6', keep: 0.75 },
    // the maul's color, and what else was bright: rime
    { hue: [190, 260], sat: [0.3, 1], to: '#d8f2ff', keep: 0.85 },
  ],
  wears: [{ piece: 'horns', a: '#5a86b8', b: '#eefaff', size: 1.1 }, { piece: 'eyes', b: '#bfe8ff' }],
};
// Hallvor, Ingrith's Shield-Thane: she let the ice take her rather than leave her jarl. Her plate rimed pale blue
// from helm to heel, the cape Frostgate's deep blue, the edge of her halberd alight with the cold that kept her.
TABLE['hallvor-the-unthawed'] = {
  k: 'boss_hallvor',
  form: 'hallvor',
  size: 1.45,
  atk: 'chop2',
  paint: [
    // the halberd's bright edge
    { joint: 'handslot.r', lum: [0.72, 1], sat: [0, 0.4], to: '#d8f2ff', glow: true, keep: 0.3 },
    // the cape and what cloth she wears: Frostgate's blue
    { hue: [330, 40], sat: [0.35, 1], to: '#2a5a8a', keep: 0.9 },
    // the plate: rimed
    { lum: [0.45, 1], to: '#cfe6f6', keep: 0.7 },
    { to: '#7fa6c8', keep: 0.7 },
  ],
  wears: [{ piece: 'eyes', b: '#dff6ff' }],
};
/* The Siege of Highwall (Act IV) */
// Prior Vessant, Chaplain of the Host: thirty years burying Highwall's dead, and then the Herald promised him his
// brother back. Still a living man, in a chaplain's black habit; the hymnal he raises the dead from is open in his
// hand, its page the grave's green.
TABLE['prior-vessant'] = {
  k: 'boss_vessant',
  form: 'vessant',
  size: 1.5,
  atk: 'cast',
  paint: [
    { joint: 'handslot.l', lum: [0.7, 1], to: '#9cff9c', glow: true, keep: 0.3 },
    { joint: 'handslot.l', to: '#2a2630', keep: 0.9 },
    // the habit: black, its trim a tarnished silver
    { hue: [60, 200], sat: [0.15, 1], to: '#26232c', keep: 0.9 },
    { hue: [200, 360], sat: [0.2, 1], to: '#3a3442', keep: 0.9 },
    { hue: [0, 25], sat: [0.45, 1], to: '#3a3442', keep: 0.9 },
  ],
};
// General Morvain, Lieutenant of the Hallow King: a death knight who has never lost a siege. Black plate with the
// Host's red at plume and cape, the war banner he plants on his back, and an ember's light along his blade.
TABLE['general-morvain'] = {
  k: 'boss_morvain',
  form: 'morvain',
  // (his banner stands over him: sized so that the man keeps his size)
  size: 1.85,
  atk: 'chop2',
  paint: [
    { joint: 'handslot.r', lum: [0.4, 1], sat: [0, 0.4], to: '#ff8a4a', glow: true, keep: 0.3 },
    { hue: [320, 20], sat: [0.5, 1], to: '#c8242c' },
    { hue: [190, 270], lum: [0.5, 1], to: '#7a7480' },
    { hue: [190, 270], to: '#1e1c24', keep: 0.9 },
  ],
  wears: [{ piece: 'horns', a: '#1a181c', b: '#8a8490', size: 0.8 }, { piece: 'eyes', b: '#ff6a3a' }],
};
/* The Molten Throne (Act V) */
// The Magma Warden, Keeper of the Host's Forges: bone-steel with molten rock for a heart. A body of dark rock with
// its cracks alight, and on it a skull of the Host's pale bone-steel: nobody mistakes whose it is.
TABLE['magma-warden'] = {
  k: 'boss_magmawarden',
  form: 'magmawarden',
  size: 2.1,
  atk: 'smash',
  paint: [
    { joint: 'head', lum: [0.3, 1], to: '#d8d0c0', keep: 0.9 },
    // (the pack's golem is ice, and nothing of it is dark: what was its brightest is where the fire shows)
    { lum: [0.935, 1], to: '#ff6a2a', glow: true, keep: 0 },
    { lum: [0.6, 0.88], to: '#4a3432', keep: 0.9 },
    { to: '#2c2224', keep: 0.9 },
  ],
  wears: [{ piece: 'horns', a: '#2a2020', b: '#ff8a3a', size: 0.8 }, { piece: 'eyes', b: '#ffe08a' }],
};
// Ossa the Founder, Mistress of the Bone-Steel Foundry: she pours the bone-steel for every blade and chain the Host
// makes. Pale bone-steel herself from skull to heel, a founder's goggles over her eye-pits, and a hammer whose head
// is still hot from the pour.
TABLE['ossa-the-founder'] = {
  k: 'boss_ossa',
  form: 'ossa',
  size: 1.95,
  atk: 'smash',
  paint: [
    // the hammer's head: hot
    { joint: 'handslot.r', hue: [25, 75], sat: [0.4, 1], to: '#ffb070', glow: true, keep: 0.3 },
    // bone-steel
    { lum: [0.5, 1], to: '#e8dcc8', keep: 0.8 },
    { lum: [0, 0.5], to: '#8a8274', keep: 0.8 },
  ],
  wears: [{ piece: 'eyes', b: '#fff6e0' }],
};
// Ashkar the Bound, Fire Lord of Emberdeep: chained to his own throne and made to forge the Pale Crown. Rock near
// black with the fire showing through every crack, great horns, and the Host's pale shackles on his wrists: the only
// cold thing on him.
TABLE['ashkar-the-bound'] = {
  k: 'boss_ashkar',
  form: 'ashkar',
  size: 2.15,
  atk: 'smash',
  paint: [
    // the shackles and chain: the Host's bone-steel
    { joint: 'lowerarm.l', hue: [0, 360], sat: [0, 0.25], lum: [0.3, 1], to: '#d8d0c0', keep: 0.9 },
    { joint: 'lowerarm.r', hue: [0, 360], sat: [0, 0.25], lum: [0.3, 1], to: '#d8d0c0', keep: 0.9 },
    { lum: [0.935, 1], to: '#ff5a1e', glow: true, keep: 0 },
    { lum: [0.6, 0.88], to: '#3a2a2c', keep: 0.9 },
    { to: '#221a1e', keep: 0.9 },
  ],
  wears: [{ piece: 'horns', a: '#1e181a', b: '#ff9a3a', size: 1.15 }, { piece: 'eyes', b: '#fff0a0' }],
};
/* Duskspire (the finale) */
// Lady Cendre, the Last Mourner: three hundred years keeping vigil over the King's dead. Mourning black gone violet
// with age, a court cape, a face as pale as the dead she watches, and the vigil's three candles in her hand burning
// the violet of the grief she casts.
TABLE['lady-cendre'] = {
  k: 'boss_cendre',
  form: 'cendre',
  size: 1.5,
  atk: 'cast',
  paint: [
    { joint: 'handslot.l', lum: [0.6, 1], to: '#c08aff', glow: true, keep: 0.3 },
    { joint: 'head', hue: [5, 45], sat: [0.15, 0.9], to: '#d8d0dc', keep: 0.8 },
    { hue: [45, 200], sat: [0.15, 1], to: '#2a2233', keep: 0.9 },
    { hue: [200, 360], sat: [0.15, 1], to: '#3a2a4a', keep: 0.9 },
    { hue: [0, 5], sat: [0.3, 1], to: '#3a2a4a', keep: 0.9 },
  ],
};
// Captain Ser Maltheus, First of the Ashen Guard: he held this court nine days and has not left his post since. Plate
// the pale blue of Vaelor's court over its deep blue, no cape, the guard's great shield, and a spear with the court's cold light at its point.
TABLE['hollow-guard'] = {
  k: 'boss_maltheus',
  form: 'maltheus',
  // (his spear makes him longer than he is tall: sized so that he stands on his circle)
  size: 1.95,
  atk: 'chop2',
  paint: [
    { joint: 'handslot.r', lum: [0.36, 1], sat: [0, 0.35], to: '#cfe0ff', glow: true, keep: 0.3 },
    // (his colors as they were: the court's pale blue over deep blue)
    { hue: [320, 20], sat: [0.5, 1], to: '#e4ecfa' },
    { hue: [190, 270], lum: [0.5, 1], to: '#a4b8d8' },
    { hue: [190, 270], to: '#3a4a70', keep: 0.9 },
  ],
  wears: [{ piece: 'eyes', b: '#cfe0ff' }],
};
// the Host's knights: black plate, each with their own color where the pack's knight wears red
// Sir Corvane the Fallen, First Grave Knight of the Hallow King: he held the downs nine days for a relief that was
// called off, then knelt to get his dead knights back. Black plate rimed pale at its edges, a plume gone from red to
// the Host's cold blue, and on his back still the banner of the Ninefold Watch in Aster's faded blue: the one thing
// of his old oath he would not put down. (Mounted and on foot he is the same figure.)
const CORVANE: Kit = {
  k: 'boss_corvane',
  form: 'corvane',
  // (his banner stands over him and a figure is sized by its greatest measure: this keeps the man his size)
  size: 1.62,
  atk: 'chop2',
  paint: [
    // the bright of his blade: the frost his lances are thrown from
    { joint: 'handslot.r', lum: [0.52, 1], sat: [0, 0.4], to: '#a8c8ff', glow: true, keep: 0.3 },
    // the Watch's banner on his back: Aster's blue, ten years faded
    { joint: 'chest', hue: [190, 270], sat: [0.3, 1], lum: [0.3, 1], to: '#2e3c66', keep: 0.2 },
    { hue: [320, 20], sat: [0.5, 1], to: '#5a7ad8' },
    { hue: [190, 270], lum: [0.5, 1], to: '#8a8ea8' },
    { hue: [190, 270], to: '#2c2c3c', keep: 0.9 },
  ],
  wears: [{ piece: 'eyes', b: '#a8c8ff' }],
};
TABLE['sir-corvane'] = CORVANE;
TABLE['sir-corvane-foot'] = CORVANE;

/* The Rift's bosses */
// The Drowned Priestess, Voice of the Deep Tide: the sea's own colors on her, her skin gone the green of deep water,
// the shrine's bell gone to verdigris in her hand, and the head of her staff alight.
TABLE['the-drowned'] = {
  k: 'boss_drowned',
  form: 'drowned',
  size: 1.62,
  atk: 'cast',
  paint: [
    // (the bell is too finely made to be alight whole: a boss glows only where the magic is, and that is the staff's head)
    { joint: 'handslot.r', lum: [0.75, 1], to: '#9afff0', glow: true, keep: 0.3 },
    { joint: 'handslot.l', to: '#6aa8a0', keep: 0.9 },
    { joint: 'head', hue: [5, 45], sat: [0.15, 0.9], to: '#9ad0c8', keep: 0.8 },
    { joint: 'head', to: '#1c3a3c', keep: 0.9 },
    { hue: [330, 60], sat: [0.3, 1], to: '#c8b070', keep: 0.9 },
    { lum: [0.6, 1], to: '#7ab8b0', keep: 0.9 },
    { to: '#1f4a52', keep: 0.9 },
  ],
  wears: [{ piece: 'eyes', b: '#9afff0' }],
};
// Captain Saltbeard, Master of the Smugglers' Grotto: his own colors, and his signal lantern lit.
TABLE.saltbeard = {
  k: 'boss_saltbeard',
  form: 'saltbeard',
  size: 1.75,
  atk: 'chop',
  paint: [
    { joint: 'handslot.l', lum: [0.55, 1], to: '#ffd27a', glow: true, keep: 0.3 },
    { joint: 'chest', hue: [10, 50], sat: [0.3, 1], lum: [0, 0.6], to: '#6a4a2a', keep: 0.9 },
  ],
};
// Brother Pustule, Keeper of the Vats: sick greens and a stained habit, the brew alight in its bottle.
TABLE['brother-pustule'] = {
  k: 'boss_pustule',
  form: 'pustule',
  size: 1.68,
  atk: 'cast',
  paint: [
    { joint: 'handslot.l', to: '#c8ff70', glow: true, keep: 0.3 },
    { joint: 'head', hue: [5, 45], sat: [0.15, 0.9], to: '#a8b878', keep: 0.8 },
    { hue: [330, 70], sat: [0.25, 1], to: '#6a7a3a', keep: 0.9 },
    { lum: [0.6, 1], to: '#b8b890', keep: 0.9 },
    { to: '#3a4424', keep: 0.9 },
  ],
  wears: [{ piece: 'eyes', b: '#e8ff70' }],
};
// Old Sluicegut, Warden of the Charnel Drain: the cistern's own wet stone, and her brew alight in every crack of him.
TABLE['old-sluicegut'] = {
  k: 'boss_sluicegut',
  form: 'sluicegut',
  size: 2.2,
  atk: 'smash',
  paint: [
    { joint: 'chest', hue: [10, 50], sat: [0.3, 1], to: '#7a5a3a', keep: 0.9 },
    { joint: 'upperarm.l', hue: [330, 50], sat: [0.3, 1], to: '#d8e0a0', keep: 0.9 },
    { joint: 'handslot.r', to: '#5a5a50', keep: 0.9 },
    { lum: [0.935, 1], to: '#c8ff70', glow: true, keep: 0 },
    { lum: [0.6, 0.88], to: '#6a7a6a', keep: 0.9 },
    { to: '#3a4a44', keep: 0.9 },
  ],
  wears: [{ piece: 'eyes', b: '#e8ff70' }],
};
// The Rot-Mother, Brewer of the Plague: the green of her own brew, the purple of what it does to flesh, her ladle
// alight with it.
TABLE['the-rot-mother'] = {
  k: 'boss_rotmother',
  form: 'rotmother',
  size: 2.2,
  atk: 'smash',
  paint: [
    { joint: 'handslot.r', lum: [0.9, 1], to: '#e8ff70', glow: true, keep: 0.3 },
    { joint: 'handslot.r', to: '#6a5a3a', keep: 0.9 },
    { hue: [330, 60], sat: [0.3, 1], to: '#8a3a5a', keep: 0.9 },
    { hue: [60, 180], to: '#5a7a2a', keep: 0.9 },
  ],
  wears: [{ piece: 'horns', a: '#3a4a22', b: '#c8e070' }, { piece: 'eyes', b: '#e8ff70' }],
};
// The Runewarden, Bound Guardian of the Deepforge: sandstone with its runes alight, a brass helm, a brass hammer.
TABLE['the-runewarden'] = {
  k: 'boss_runewarden',
  form: 'runewarden',
  size: 2.2,
  atk: 'smash',
  paint: [
    { joint: 'head', to: '#a8823a', keep: 0.9 },
    { joint: 'handslot.r', to: '#a8823a', keep: 0.9 },
    { lum: [0.935, 1], to: '#ffd27a', glow: true, keep: 0 },
    { lum: [0.6, 0.88], to: '#8a7a60', keep: 0.9 },
    { to: '#5a4c3a', keep: 0.9 },
  ],
  wears: [{ piece: 'eyes', b: '#fff2c0' }],
};
// The Slag Colossus, Poured in the Rendering Pit: dark slag, still alight where it has not set.
TABLE['slag-colossus'] = {
  k: 'boss_slag',
  form: 'slag',
  size: 2.15,
  atk: 'smash',
  paint: [
    { joint: 'head', to: '#4a3a36', keep: 0.8 },
    { lum: [0, 0.3], to: '#ff9a3a', glow: true, keep: 0 },
    { to: '#4a3a36', keep: 0.8 },
  ],
  wears: [{ piece: 'eyes', b: '#fff0a0' }],
};
// Forgemaster Grold, Master of the Deepforge: leather and soot, and the head of his hammer straight from the fire.
TABLE['forgemaster-grold'] = {
  k: 'boss_grold',
  form: 'grold',
  size: 1.62,
  atk: 'chop2',
  paint: [
    { joint: 'handslot.r', lum: [0.5, 1], sat: [0, 0.35], to: '#ff9a4a', glow: true, keep: 0.3 },
    { hue: [190, 270], to: '#3a2a22', keep: 0.9 },
    { hue: [330, 10], sat: [0.4, 1], to: '#8a3a22', keep: 0.9 },
  ],
  wears: [{ piece: 'eyes', b: '#ffd27a' }],
};
// The Rotwood Colossus, Warden of the Hollow Bole: bark, the blight green in the grain of it, its mushrooms alight.
TABLE['rotwood-colossus'] = {
  k: 'boss_rotwood',
  form: 'rotwood',
  size: 2.35,
  atk: 'smash',
  paint: [
    { joint: 'upperarm.l', hue: [330, 60], sat: [0.3, 1], to: '#c8ff70', glow: true, keep: 0.3 },
    { joint: 'upperarm.r', hue: [330, 60], sat: [0.3, 1], to: '#c8ff70', glow: true, keep: 0.3 },
    { hue: [10, 60], sat: [0.25, 1], to: '#4a3a22', keep: 0.9 },
    { lum: [0.935, 1], to: '#8ab04a', keep: 0.5 },
    { lum: [0.6, 0.88], to: '#5a4630', keep: 0.9 },
    { to: '#3a2c1c', keep: 0.9 },
  ],
  wears: [{ piece: 'horns', a: '#4a3a22', b: '#8ab04a', size: 1.2 }, { piece: 'eyes', b: '#c8ff70' }],
};
// Elowen of the Dawn, Lamp-Warden of the Faded Lights: a warden's white and gold, fair hair, and the one lamp in the
// wood that is still lit.
TABLE['elowen-of-the-dawn'] = {
  k: 'boss_elowen',
  form: 'elowen',
  size: 1.78,
  atk: 'cast',
  paint: [
    { joint: 'handslot.l', hue: [25, 70], sat: [0.35, 1], lum: [0.8, 1], to: '#ffe08a', glow: true, keep: 0.3 },
    { joint: 'head', hue: [5, 45], sat: [0.15, 0.9], lum: [0.6, 1], to: '#f0d8c0', keep: 0.8 },
    { joint: 'head', to: '#e8c060', keep: 0.9 },
    { hue: [190, 270], to: '#e8dcc0', keep: 0.9 },
    { hue: [330, 5], sat: [0.3, 1], to: '#d8a030', keep: 0.9 },
    { lum: [0, 0.35], to: '#8a6a3a', keep: 0.9 },
  ],
  wears: [{ piece: 'halo', a: '#e8a030', b: '#fff4c0', size: 0.8 }],
};
// The Withered Queen, Lieutenant of the Hallow King: a court dress gone the colors of dead leaves, a crown of moss
// green, the edge of her scythe alight.
TABLE['the-withered-queen'] = {
  k: 'boss_witheredqueen',
  form: 'witheredqueen',
  size: 1.95,
  atk: 'chop',
  paint: [
    { joint: 'handslot.r', lum: [0.6, 1], sat: [0, 0.35], to: '#d8ff8a', glow: true, keep: 0.3 },
    { joint: 'head', hue: [30, 70], sat: [0.3, 1], to: '#8aa04a', keep: 0.9 },
    { joint: 'head', lum: [0.6, 1], to: '#c8c8a0', keep: 0.9 },
    { hue: [330, 20], sat: [0.3, 1], to: '#5a6a2a', keep: 0.9 },
    { lum: [0, 0.4], to: '#2a2a1c', keep: 0.9 },
    { to: '#6a6a4a', keep: 0.9 },
  ],
  wears: [{ piece: 'eyes', b: '#e0ff9a' }],
};
// The Veil Sentinel, Warden of the Stair: plate the dark of the rift, a great pale skull, the edge of its axe alight.
TABLE['veil-sentinel'] = {
  k: 'boss_veilsentinel',
  form: 'veilsentinel',
  size: 2.2,
  atk: 'chop2',
  paint: [
    { joint: 'head', lum: [0.3, 1], to: '#d8c8f0', keep: 0.9 },
    { joint: 'handslot.r', lum: [0.6, 1], sat: [0, 0.35], to: '#d8a8ff', glow: true, keep: 0.3 },
    { hue: [320, 20], sat: [0.5, 1], to: '#a060e0', keep: 0.9 },
    { hue: [190, 270], lum: [0.5, 1], to: '#6a5a90', keep: 0.9 },
    { to: '#2a2040', keep: 0.9 },
  ],
  wears: [{ piece: 'eyes', b: '#f4e0ff' }, { piece: 'halo', a: '#8a4ae0', b: '#f0d8ff', size: 0.85 }],
};
// Ilvane the Unmoored, Keeper of the Weightless Gallery: the Spire's violet, and her book alight. She is off the
// floor: it is her name and her fight.
TABLE['ilvane-the-unmoored'] = {
  k: 'boss_ilvane',
  form: 'ilvane',
  size: 1.78,
  float: 0.7,
  atk: 'cast',
  paint: [
    { joint: 'handslot.l', lum: [0.6, 1], to: '#c8b8ff', glow: true, keep: 0.3 },
    { joint: 'head', hue: [5, 45], sat: [0.15, 0.9], lum: [0.6, 1], to: '#e8dcf0', keep: 0.8 },
    { joint: 'head', to: '#b8a8e8', keep: 0.9 },
    { hue: [190, 330], to: '#4a3a7a', keep: 0.9 },
    { hue: [330, 60], sat: [0.3, 1], to: '#c8b8ff', keep: 0.9 },
  ],
};
// The Pale Herald, Voice of the Hallow King: pale all over, as his name says; the King's white banner; a silver bell;
// the head of his staff alight. He is not wholly here, and drifts.
TABLE['herald-in-the-spire'] = {
  k: 'boss_herald',
  form: 'herald',
  size: 2.0,
  float: 0.25,
  atk: 'cast',
  paint: [
    { joint: 'handslot.r', lum: [0.8, 1], to: '#ffd0ff', glow: true, keep: 0.3 },
    { joint: 'handslot.l', to: '#c8c0d8', keep: 0.9 },
    { joint: 'head', lum: [0.5, 1], to: '#e8e4f0', keep: 0.9 },
    { hue: [330, 20], sat: [0.3, 1], to: '#8a4ac0', keep: 0.9 },
    { lum: [0, 0.4], to: '#d8d4e4', keep: 0.5 },
    { to: '#b8b0cc', keep: 0.9 },
  ],
  wears: [{ piece: 'halo', a: '#a03ae0', b: '#ffd0ff', size: 0.9 }, { piece: 'eyes', b: '#ff9af0' }],
};
// (he is one man wherever the story meets him)
for (const id of ['the-pale-herald', 'the-heralds-voice', 'the-heralds-first-face']) BY_ENEMY[id] = TABLE['herald-in-the-spire'];

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
