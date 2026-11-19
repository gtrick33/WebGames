/**
 * Which of the game's sounds are recordings, and how they are mixed (the files: public/games/sigilfall/audio, built by
 * scripts/sigilfall-sounds.mjs; where each comes from is in CREDITS_AND_LICENSES.md). Nearly everything heard in a
 * fight is one: the blows that land, the spells by what they are made of, the menus, the moments (a level, a quest,
 * a boss down). A sound named here is only ever its recording: until the file has come in it is silent, never a
 * synthesized stand-in, which is what the game used to be full of. The two not named here (a war horn, a scene's two
 * low notes) are still synthesized, quietly, in audio/sound.ts.
 *
 * This table is the place to tune by ear: `gain` is how loud, and `rate` how far its pitch may wander each time (so a
 * hundred swings don't sound like one).
 */
export interface SampleDef {
  files: readonly string[];
  gain: number;
  rate: readonly [number, number];
}

const beasts = ['beast1', 'beast2', 'beast3', 'beast4', 'beast5', 'beast6', 'beast7'];
const shades = ['shade1', 'shade2', 'shade3', 'shade4', 'shade5'];
const slimes = ['slime1', 'slime2', 'slime3', 'slime4', 'slime5'];
const giants = ['giant1', 'giant2', 'giant3', 'giant4', 'giant5'];
const ogres = ['ogre1', 'ogre2', 'ogre3', 'ogre4', 'ogre5'];
const swings = ['swing1', 'swing2', 'swing3'];
const clashes = ['clash1', 'clash2', 'clash3', 'clash4', 'clash5'];
const hits = ['hit1', 'hit2', 'hit3', 'hit4', 'hit5', 'hit6'];
const thuds = ['thud1', 'thud2', 'thud3'];
const steel = ['steel1', 'steel2', 'steel3', 'steel4'];
const whooshes = ['whoosh1', 'whoosh2', 'whoosh3'];
const arrows = ['arrow1', 'arrow2', 'arrow3'];
const slams = ['slam1', 'slam2', 'slam3'];

export const SAMPLES: Readonly<Record<string, SampleDef>> = {
  // the blade: a swing through the air, and what it meets
  swing: { files: swings, gain: 0.4, rate: [0.95, 1.1] },
  swingBig: { files: ['swing1'], gain: 0.5, rate: [0.78, 0.88] },
  heavy: { files: ['swing1'], gain: 0.55, rate: [0.68, 0.76] },
  whirl: { files: ['swing1', 'swing2'], gain: 0.4, rate: [0.7, 0.85] },
  spear: { files: ['swing3'], gain: 0.38, rate: [1.15, 1.3] },
  windup: { files: ['whoosh3'], gain: 0.22, rate: [0.6, 0.7] },
  hit: { files: hits, gain: 0.34, rate: [0.92, 1.12] },
  crit: { files: ['metalhit1', 'metalhit2', 'metalhit3', 'metalhit4'], gain: 0.4, rate: [0.9, 1.05] },
  clash: { files: clashes, gain: 0.3, rate: [0.95, 1.15] },
  critBlade: { files: steel, gain: 0.42, rate: [0.9, 1.05] },
  hurt: { files: thuds, gain: 0.5, rate: [0.72, 0.84] },
  shield: { files: ['block1', 'block2', 'block3'], gain: 0.45, rate: [0.95, 1.05] },
  shieldBreak: { files: ['shatter1', 'ring'], gain: 0.4, rate: [0.8, 0.9] },
  // those who fight back
  enemyWindup: { files: whooshes, gain: 0.2, rate: [0.75, 0.95] },
  enemySwing: { files: ['swing2', 'swing3'], gain: 0.25, rate: [0.85, 1] },
  enemyBow: { files: arrows, gain: 0.28, rate: [0.9, 1.05] },
  sling: { files: ['whoosh1'], gain: 0.24, rate: [1.2, 1.4] },
  rush: { files: ['whoosh1', 'whoosh2'], gain: 0.32, rate: [0.6, 0.75] },
  roar: { files: giants, gain: 0.7, rate: [0.88, 1] },
  snort: { files: ['beast1', 'beast5', 'beast7'], gain: 0.45, rate: [0.95, 1.1] },
  squish: { files: slimes, gain: 0.5, rate: [0.9, 1.15] },
  soul: { files: shades, gain: 0.4, rate: [0.95, 1.1] },
  slam: { files: slams, gain: 0.55, rate: [0.8, 0.95] },
  // the bow
  bow: { files: arrows, gain: 0.34, rate: [1, 1.15] },
  volley: { files: arrows, gain: 0.3, rate: [0.85, 1] },
  arrowRain: { files: arrows, gain: 0.3, rate: [0.8, 0.95] },
  // on the move
  dash: { files: ['cloth-heavy'], gain: 0.32, rate: [0.95, 1.1] },
  dodge: { files: ['cloth'], gain: 0.32, rate: [1, 1.2] },
  // footsteps, by the ground underfoot (audio/steps.ts): quiet, under everything, never the same twice running
  stepGrass: { files: ['step-grass1', 'step-grass2', 'step-grass3', 'step-grass4'], gain: 0.16, rate: [0.9, 1.1] },
  stepStone: { files: ['step-stone1', 'step-stone2', 'step-stone3', 'step-stone4'], gain: 0.18, rate: [0.9, 1.08] },
  stepWood: { files: ['step-wood1', 'step-wood2', 'step-wood3', 'step-wood4'], gain: 0.18, rate: [0.92, 1.08] },
  stepSnow: { files: ['step-snow1', 'step-snow2', 'step-snow3', 'step-snow4'], gain: 0.17, rate: [0.92, 1.08] },
  stepSand: { files: ['step-snow1', 'step-snow2', 'step-snow3', 'step-snow4'], gain: 0.16, rate: [1.25, 1.4] },
  dismount: { files: ['cloth-heavy'], gain: 0.3, rate: [0.85, 0.95] },
  mount: { files: ['cloth-heavy'], gain: 0.3, rate: [1, 1.1] },
  whistle: { files: ['whoosh3'], gain: 0.25, rate: [1.5, 1.7] },
  puff: { files: ['cloth-heavy'], gain: 0.28, rate: [0.75, 0.9] },
  // spells, by what they are made of
  bolt: { files: ['arc1', 'arc2'], gain: 0.28, rate: [1.02, 1.2] },
  fireball: { files: ['fire1', 'fire2', 'fire4', 'fire5'], gain: 0.4, rate: [0.95, 1.08] },
  explode: { files: ['boom', 'firebig1'], gain: 0.5, rate: [0.9, 1.05] },
  meteorCall: { files: ['fire3'], gain: 0.3, rate: [0.7, 0.8] },
  meteor: { files: ['firebig2', 'boom'], gain: 0.6, rate: [0.78, 0.88] },
  nova: { files: ['chime1'], gain: 0.36, rate: [0.95, 1.05] },
  freeze: { files: ['frost', 'shatter2'], gain: 0.36, rate: [0.95, 1.1] },
  // (ice that someone was held in, breaking: the Ring's Shatter. Lower and louder than a ward giving way)
  shatter: { files: ['shatter1', 'shatter2'], gain: 0.6, rate: [0.7, 0.8] },
  zap: { files: ['zap1', 'zap2'], gain: 0.3, rate: [0.95, 1.15] },
  thunder: { files: ['thunder'], gain: 0.5, rate: [0.9, 1.05] },
  holy: { files: ['chime2'], gain: 0.34, rate: [1.05, 1.15] },
  shadow: { files: ['dark'], gain: 0.34, rate: [0.8, 0.9] },
  nature: { files: ['chime2'], gain: 0.3, rate: [0.78, 0.88] },
  fieldCast: { files: ['chime1'], gain: 0.3, rate: [0.82, 0.92] },
  heal: { files: ['cure1', 'cure2', 'cure3'], gain: 0.34, rate: [0.98, 1.08] },
  buff: { files: ['chime2'], gain: 0.26, rate: [1.2, 1.32] },
  drain: { files: ['breath'], gain: 0.34, rate: [0.95, 1.05] },
  blink: { files: ['teleport'], gain: 0.3, rate: [1.1, 1.25] },
  summon: { files: ['conjure'], gain: 0.38, rate: [0.9, 1] },
  shapeshift: { files: ['conjure'], gain: 0.34, rate: [1.15, 1.25] },
  rift: { files: ['riftcall'], gain: 0.4, rate: [0.9, 1] },
  riftShot: { files: ['dark'], gain: 0.28, rate: [1.2, 1.3] },
  beamCharge: { files: ['riftcall'], gain: 0.3, rate: [1.2, 1.3] },
  beam: { files: ['zap2'], gain: 0.3, rate: [0.7, 0.8] },
  quake: { files: [...slams, 'stones1', 'stones2'], gain: 0.55, rate: [0.72, 0.86] },
  crumble: { files: ['rock1', 'rock2', 'rock3', 'stones3'], gain: 0.5, rate: [0.85, 1] },
  // how each kind falls (data/voices.ts)
  die: { files: ['armor', 'cloth-heavy'], gain: 0.3, rate: [0.85, 1] },
  dieBone: { files: ['beads', 'wood'], gain: 0.5, rate: [0.8, 1] },
  dieGhost: { files: shades, gain: 0.4, rate: [1, 1.2] },
  dieSlime: { files: slimes, gain: 0.5, rate: [0.8, 1] },
  dieBug: { files: ['bite1', 'bite2', 'bite3'], gain: 0.5, rate: [0.85, 1.1] },
  dieOgre: { files: ogres, gain: 0.55, rate: [0.9, 1.05] },
  dieBeast: { files: [...beasts, 'wolf'], gain: 0.45, rate: [0.95, 1.1] },
  bossDie: { files: ['growl1', 'growl2'], gain: 0.8, rate: [0.8, 0.9] },
  // things in the hand
  coin: { files: ['coin1', 'coin3'], gain: 0.36, rate: [0.98, 1.05] },
  buy: { files: ['coin2'], gain: 0.45, rate: [0.98, 1.02] },
  potion: { files: ['bottle', 'bubble1'], gain: 0.45, rate: [0.95, 1.05] },
  orb: { files: ['bubble2'], gain: 0.28, rate: [1.3, 1.5] },
  pickup: { files: ['cloth', 'wood'], gain: 0.32, rate: [1.05, 1.2] },
  pickupBig: { files: ['gem2'], gain: 0.4, rate: [0.95, 1.05] },
  shard: { files: ['gem1', 'gem2'], gain: 0.4, rate: [1, 1.15] },
  epic: { files: ['gem3'], gain: 0.5, rate: [0.92, 1] },
  legendary: { files: ['gem3'], gain: 0.6, rate: [0.74, 0.8] },
  chest: { files: ['bag', 'wood'], gain: 0.5, rate: [0.85, 0.95] },
  equip: { files: ['armor', 'chain1', 'chain2'], gain: 0.45, rate: [0.95, 1.05] },
  trapSet: { files: ['metal2'], gain: 0.38, rate: [1, 1.1] },
  trapSpring: { files: ['trap1', 'metal3'], gain: 0.42, rate: [0.9, 1] },
  // the moments
  levelup: { files: ['jingle'], gain: 0.5, rate: [1, 1] },
  questDone: { files: ['win-short'], gain: 0.42, rate: [1, 1] },
  victory: { files: ['win'], gain: 0.5, rate: [1, 1] },
  playerDie: { files: ['lose'], gain: 0.45, rate: [1, 1] },
  quest: { files: ['ui-confirm'], gain: 0.38, rate: [0.98, 1.02] },
  discover: { files: ['ui-bong'], gain: 0.38, rate: [0.95, 1] },
  checkpoint: { files: ['gong'], gain: 0.26, rate: [1.3, 1.4] },
  bell: { files: ['bell'], gain: 0.6, rate: [0.52, 0.56] },
  'bell-toll': { files: ['bell'], gain: 0.8, rate: [0.4, 0.4] },
  reset: { files: ['ui-pluck'], gain: 0.4, rate: [1, 1.08] },
  talent: { files: ['ui-select'], gain: 0.34, rate: [1, 1.05] },
  mark: { files: ['ui-tick'], gain: 0.3, rate: [0.95, 1.05] },
  nomana: { files: ['ui-error'], gain: 0.22, rate: [0.95, 1] },
  // doors and menus
  doorOpen: { files: ['door'], gain: 0.45, rate: [0.95, 1.05] },
  doorSlam: { files: ['door'], gain: 0.6, rate: [0.72, 0.8] },
  click: { files: ['ui-click'], gain: 0.28, rate: [0.98, 1.02] },
  open: { files: ['ui-open'], gain: 0.28, rate: [0.98, 1.03] },
  close: { files: ['ui-close'], gain: 0.26, rate: [0.98, 1.03] },
};

/**
 * The Ring's own sounds, made for it by scripts/sigilfall-ring-sounds.mjs, the game's own work. The owner, 2026-11-19,
 * on the cartoony set before: "its like jungle bells ... make them similar to wow pls, frost mage feels like santa claus
 * with bells". So a fantasy fight's weight: frost a cold hiss and crunching ice, fire a roar with embers in it, holy and
 * healing a choir, shadow a growl, blows a thud with a crunch, steel a short scrape, a win brass over drums; no bells.
 * The Ring asks for its sounds by their usual names; render/ring.ts `ringSound` turns each into its own here.
 */
const RING_GAIN: Record<string, number> = { hit: 0.26, clash: 0.26, swing: 0.24, hurt: 0.32, talent: 0.24, victory: 0.4, playerDie: 0.38, levelup: 0.42, checkpoint: 0.32 };
const RING_RATE: Record<string, readonly [number, number]> = { victory: [1, 1], playerDie: [1, 1], levelup: [1, 1], checkpoint: [1, 1], holy: [1, 1], nova: [1, 1], heal: [1, 1], buff: [1, 1], nature: [1, 1] };
export const RING_SOUNDS = ['swing', 'swingBig', 'spear', 'hit', 'clash', 'critBlade', 'hurt', 'bow', 'shield', 'shieldBreak', 'blink', 'buff', 'bolt', 'zap', 'fireball', 'explode', 'freeze', 'shatter', 'shard', 'thunder', 'holy', 'shadow', 'nature', 'heal', 'rift', 'quake', 'meteor', 'nova', 'die', 'slam', 'roar', 'epic', 'pickupBig', 'orb', 'talent', 'checkpoint', 'victory', 'playerDie', 'levelup'] as const;
const RING: Record<string, SampleDef> = Object.fromEntries(RING_SOUNDS.map((id) => [`ring-${id}`, { files: [`ring-${id}`], gain: RING_GAIN[id] ?? 0.3, rate: RING_RATE[id] ?? [0.94, 1.08] }]));
Object.assign(SAMPLES as Record<string, SampleDef>, RING);

/** The air of a place (audio/ambience.ts says which is where): one loop each, fetched when first wanted. */
export const AMBIENCE_FILES = ['cave', 'forest', 'day', 'wind', 'water'] as const;
export type AmbienceId = (typeof AMBIENCE_FILES)[number];

/** Every file the table names, most used first (they come in in this order). */
export const sampleFiles = (): string[] => [...new Set(Object.values(SAMPLES).flatMap((s) => s.files))];
