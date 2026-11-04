/**
 * Which of the game's sounds are recordings, and how they are mixed (the files: public/games/sigilfall/audio, built by
 * scripts/sigilfall-sounds.mjs). Everything here still has its synthesized sound in audio/sound.ts, which plays until
 * the file has come in, or if it never does; a sound not named here is only ever synthesized (fire, thunder, a quake,
 * the bell, the fanfares).
 *
 * This table is the place to tune by ear: `gain` is how loud, `rate` how far its pitch may wander each time (so a
 * hundred swings don't sound like one), and `layer` keeps the synthesized sound underneath for weight.
 */
export interface SampleDef {
  files: readonly string[];
  gain: number;
  rate: readonly [number, number];
  layer?: boolean;
}

const beasts = ['beast1', 'beast2', 'beast3', 'beast4', 'beast5', 'beast6', 'beast7'];
const shades = ['shade1', 'shade2', 'shade3', 'shade4', 'shade5'];
const slimes = ['slime1', 'slime2', 'slime3', 'slime4', 'slime5'];
const giants = ['giant1', 'giant2', 'giant3', 'giant4', 'giant5'];
const ogres = ['ogre1', 'ogre2', 'ogre3', 'ogre4', 'ogre5'];
const swings = ['swing1', 'swing2', 'swing3'];
const clashes = ['clash1', 'clash2', 'clash3', 'clash4', 'clash5'];

export const SAMPLES: Readonly<Record<string, SampleDef>> = {
  // the blade: a swing through the air, and steel where it lands
  swing: { files: swings, gain: 0.45, rate: [0.95, 1.1] },
  swingBig: { files: ['swing1'], gain: 0.55, rate: [0.78, 0.88], layer: true },
  heavy: { files: ['swing1'], gain: 0.6, rate: [0.68, 0.76], layer: true },
  whirl: { files: ['swing1', 'swing2'], gain: 0.45, rate: [0.7, 0.85] },
  spear: { files: ['swing3'], gain: 0.4, rate: [1.15, 1.3] },
  enemySwing: { files: ['swing2', 'swing3'], gain: 0.25, rate: [0.85, 1] },
  bow: { files: ['swing3'], gain: 0.22, rate: [1.5, 1.7], layer: true },
  volley: { files: ['swing2', 'swing3'], gain: 0.25, rate: [1.4, 1.7], layer: true },
  clash: { files: clashes, gain: 0.32, rate: [0.95, 1.15] },
  critBlade: { files: clashes, gain: 0.45, rate: [0.85, 1], layer: true },
  shield: { files: ['metal1'], gain: 0.5, rate: [0.95, 1.05] },
  shieldBreak: { files: ['ring'], gain: 0.45, rate: [0.8, 0.9], layer: true },
  // on the move
  dash: { files: ['cloth-heavy'], gain: 0.35, rate: [0.95, 1.1] },
  dodge: { files: ['cloth'], gain: 0.35, rate: [1, 1.2] },
  dismount: { files: ['cloth-heavy'], gain: 0.3, rate: [0.85, 0.95] },
  puff: { files: ['cloth-heavy'], gain: 0.3, rate: [0.75, 0.9] },
  // spells
  bolt: { files: ['magic'], gain: 0.32, rate: [1.3, 1.5] },
  fireball: { files: ['magic'], gain: 0.45, rate: [0.78, 0.9], layer: true },
  shadow: { files: ['magic'], gain: 0.35, rate: [0.58, 0.66] },
  nova: { files: ['magic-long'], gain: 0.5, rate: [0.95, 1.05], layer: true },
  blink: { files: ['magic'], gain: 0.3, rate: [1.6, 1.8] },
  summon: { files: ['spell'], gain: 0.4, rate: [0.85, 0.95] },
  shapeshift: { files: ['spell'], gain: 0.35, rate: [0.7, 0.8], layer: true },
  // those who fight
  roar: { files: giants, gain: 0.75, rate: [0.88, 1] },
  snort: { files: ['beast1', 'beast5', 'beast7'], gain: 0.5, rate: [0.95, 1.1] },
  squish: { files: slimes, gain: 0.55, rate: [0.9, 1.15] },
  soul: { files: shades, gain: 0.45, rate: [0.95, 1.1] },
  // how each kind falls (data/voices.ts)
  die: { files: ['armor', 'cloth-heavy'], gain: 0.3, rate: [0.85, 1], layer: true },
  dieBone: { files: ['beads', 'wood'], gain: 0.5, rate: [0.8, 1] },
  dieGhost: { files: shades, gain: 0.4, rate: [1, 1.2] },
  dieSlime: { files: slimes, gain: 0.55, rate: [0.8, 1] },
  dieBug: { files: ['bite1', 'bite2', 'bite3'], gain: 0.55, rate: [0.85, 1.1] },
  dieOgre: { files: ogres, gain: 0.6, rate: [0.9, 1.05] },
  dieBeast: { files: [...beasts, 'wolf'], gain: 0.5, rate: [0.95, 1.1] },
  bossDie: { files: ['giant2', 'giant5'], gain: 0.9, rate: [0.62, 0.72], layer: true },
  // things in the hand
  coin: { files: ['coin1', 'coin3'], gain: 0.4, rate: [0.98, 1.05] },
  buy: { files: ['coin2'], gain: 0.5, rate: [0.98, 1.02] },
  potion: { files: ['bottle', 'bubble1'], gain: 0.5, rate: [0.95, 1.05] },
  heal: { files: ['bubble2', 'bubble3'], gain: 0.35, rate: [1.1, 1.25] },
  orb: { files: ['bubble2'], gain: 0.3, rate: [1.3, 1.5] },
  pickup: { files: ['cloth', 'wood'], gain: 0.35, rate: [1.05, 1.2] },
  pickupBig: { files: ['ring'], gain: 0.3, rate: [1.05, 1.15], layer: true },
  chest: { files: ['wood'], gain: 0.55, rate: [0.8, 0.9], layer: true },
  equip: { files: ['armor', 'chain1', 'chain2'], gain: 0.5, rate: [0.95, 1.05] },
  trapSet: { files: ['metal2'], gain: 0.4, rate: [1, 1.1] },
  trapSpring: { files: ['metal3'], gain: 0.45, rate: [0.8, 0.9], layer: true },
  // doors and menus
  doorOpen: { files: ['door'], gain: 0.5, rate: [0.95, 1.05] },
  doorSlam: { files: ['door'], gain: 0.7, rate: [0.72, 0.8], layer: true },
  click: { files: ['click'], gain: 0.25, rate: [0.98, 1.02] },
  open: { files: ['page1'], gain: 0.3, rate: [0.98, 1.05] },
  close: { files: ['page2'], gain: 0.25, rate: [0.98, 1.05] },
};

/** Every file the table names, most used first (they come in in this order). */
export const sampleFiles = (): string[] => [...new Set(Object.values(SAMPLES).flatMap((s) => s.files))];
