import { DUNGEONS } from './dungeons';
import type { ClassId } from './types';

/**
 * Bosses: stats, phases and the attack patterns each phase draws from. The patterns themselves are
 * reusable pieces in sim/boss.ts (charge, slam, fans, circles, beams, spirals...), so a new boss is
 * mostly a new list here.
 */

export type PatternId =
  | 'charge'
  | 'tripleCharge'
  | 'stomp'
  | 'gore'
  | 'summon'
  | 'slam'
  | 'slamRings'
  | 'spearFan'
  | 'soulVolley'
  | 'graveGrasp'
  | 'riftSpiral'
  | 'riftBeams'
  | 'teleport'
  | 'riftNova'
  | 'collapse'
  | 'roar'
  | 'cleave'
  | 'chop'
  | 'hook'
  | 'volley'
  | 'vanish'
  | 'tide'
  | 'orbs'
  | 'barrage'
  | 'kegs';

/** A dungeon's own attack (sim/patterns/): its prefix and a name, like 'rot:bile-wave'. */
export type ExtraPatternId = `${string}:${string}`;

export interface PatternUse {
  id: PatternId | ExtraPatternId;
  /** How often it is picked relative to the others. */
  w: number;
  /** Seconds before the same pattern can come again. */
  cd: number;
  /** Pattern knobs (counts, enemies to summon, speeds, a projectile's look and color). */
  p?: Record<string, number | string | string[]>;
}

export interface BossPhase {
  /** The phase starts when health falls to this share (1 = from the start). */
  at: number;
  /** Shown when the phase begins. */
  banner?: string;
  speed: number;
  /** Seconds of walking between patterns. */
  rest: [number, number];
  patterns: PatternUse[];
  /** Run once at the start of the phase. */
  enter?: PatternUse[];
}

export interface BossDef {
  id: string;
  name: string;
  title: string;
  sprite: string;
  hp: number;
  dmg: number;
  radius: number;
  xp: number;
  gold: [number, number];
  floats?: boolean;
  phases: BossPhase[];
  /** First defeat: these items for sure (by class, or for everyone). */
  first: Partial<Record<ClassId | 'any', string[]>>;
  /** Later defeats: a chance for each of these. */
  drops: { items: Partial<Record<ClassId | 'any', string[]>>; chance: number[] };
  intro: string;
}

export const BOSSES: Record<string, BossDef> = {
  grimtusk: {
    id: 'grimtusk',
    name: 'Grimtusk',
    title: 'Warlord of the Whisperwood',
    sprite: 'grimtusk',
    hp: 820,
    dmg: 18,
    radius: 11,
    xp: 220,
    gold: [40, 60],
    phases: [
      {
        at: 1,
        speed: 42,
        rest: [0.7, 1.2],
        patterns: [
          { id: 'charge', w: 3, cd: 3 },
          { id: 'stomp', w: 2, cd: 4 },
          { id: 'gore', w: 2, cd: 2.5 },
        ],
      },
      {
        at: 0.5,
        banner: 'Grimtusk is enraged!',
        speed: 52,
        rest: [0.5, 0.9],
        enter: [{ id: 'roar', w: 1, cd: 0 }, { id: 'summon', w: 1, cd: 0, p: { enemies: ['boarlet', 'boarlet', 'boarlet'] } }],
        patterns: [
          { id: 'tripleCharge', w: 3, cd: 6 },
          { id: 'stomp', w: 2, cd: 4 },
          { id: 'gore', w: 2, cd: 2.5 },
          { id: 'summon', w: 1, cd: 16, p: { enemies: ['boarlet', 'boarlet'] } },
        ],
      },
    ],
    first: { any: ['zephyr-boots'] },
    drops: { items: { mage: ['ember-staff', 'cinder-amulet'], warrior: ['cleaverfang', 'riposte-gauntlets'], ranger: ['splitwood-bow', 'viper-quiver'], any: ['zephyr-boots'] }, chance: [0.35, 0.5, 0.7] },
    intro: 'A boar the size of a cart, with a rift glowing in its eyes.',
  },
  /* ------------------------------------------------------------ the Chapel Crypt (sim/patterns/crypt.ts) */
  'coffin-matron': {
    id: 'coffin-matron',
    name: 'The Coffin Matron',
    title: 'Mother of the Ossuary',
    sprite: 'coffin-matron',
    hp: 850,
    dmg: 14,
    radius: 9,
    xp: 300,
    gold: [50, 80],
    phases: [
      {
        at: 1,
        speed: 34,
        rest: [0.9, 1.3],
        enter: [{ id: 'crypt:coffins', w: 1, cd: 0, p: { n: 4, swaps: 3, swap: 0.95, wait: 11 } }],
        patterns: [
          { id: 'crypt:coffins', w: 3, cd: 16, p: { n: 4, swaps: 3, swap: 0.95, wait: 11 } },
          // grave-candle wisps that drift after the hero
          { id: 'spell:seekers', w: 3, cd: 3, p: { count: 3, speed: 50, homing: 1.2, look: 'shadow', color: '#9cff9c', type: 'shadow', mul: 0.8 } },
          // a coffin closing round the hero, one side left open
          { id: 'spell:cage', w: 2, cd: 4, p: { color: '#9cff9c', type: 'shadow', size: 36, dur: 1.1, mul: 1 } },
        ],
      },
      {
        at: 0.5,
        banner: 'The Matron wakes her children!',
        speed: 38,
        rest: [0.7, 1.1],
        enter: [{ id: 'summon', w: 1, cd: 0, p: { enemies: ['skeleton', 'skeleton'] } }, { id: 'crypt:coffins', w: 1, cd: 0, p: { n: 5, swaps: 5, swap: 0.75, wait: 9 } }],
        patterns: [
          { id: 'crypt:coffins', w: 3, cd: 14, p: { n: 5, swaps: 5, swap: 0.75, wait: 9 } },
          // grave-candle wisps that drift after the hero
          { id: 'spell:seekers', w: 2, cd: 3, p: { count: 3, speed: 50, homing: 1.2, look: 'shadow', color: '#9cff9c', type: 'shadow', mul: 0.8 } },
          // a coffin closing round the hero, one side left open
          { id: 'spell:cage', w: 2, cd: 3.5, p: { color: '#9cff9c', type: 'shadow', size: 36, dur: 1.1, mul: 1 } },
        ],
      },
    ],
    first: { any: ['static-band'] },
    drops: { items: { any: ['static-band', 'thornmail', 'wardens-aegis'] }, chance: [0.25, 0.4, 0.6] },
    intro: 'She tucks the dead in every night. Tonight she has room for one more.',
  },
  ossric: {
    id: 'ossric',
    name: 'Warden Ossric',
    title: 'Keeper of the Crypt Gate',
    sprite: 'ossric',
    hp: 1150,
    dmg: 18,
    radius: 10,
    xp: 420,
    gold: [70, 100],
    phases: [
      {
        at: 1,
        speed: 36,
        rest: [0.8, 1.2],
        enter: [{ id: 'crypt:candles', w: 1, cd: 0, p: { n: 3, relight: 3 } }],
        patterns: [
          { id: 'charge', w: 3, cd: 4, p: { stun: 1.6 } },
          { id: 'slam', w: 2, cd: 4 },
          { id: 'spearFan', w: 2, cd: 3, p: { count: 3 } },
          { id: 'crypt:candles', w: 2, cd: 18, p: { n: 3, relight: 1 } },
        ],
      },
      {
        at: 0.5,
        banner: 'The Warden relights every grave!',
        speed: 42,
        rest: [0.6, 1],
        enter: [{ id: 'summon', w: 1, cd: 0, p: { enemies: ['skeleton', 'skeleton'] } }, { id: 'crypt:candles', w: 1, cd: 0, p: { n: 3, relight: 3 } }],
        patterns: [
          { id: 'slamRings', w: 3, cd: 5 },
          { id: 'charge', w: 2, cd: 4, p: { stun: 1.3 } },
          { id: 'spearFan', w: 2, cd: 3, p: { count: 5 } },
          { id: 'crypt:candles', w: 3, cd: 14, p: { n: 3, relight: 2 } },
        ],
      },
    ],
    first: { any: ['wardens-aegis'] },
    drops: { items: { any: ['wardens-aegis', 'thornmail', 'static-band'], mage: ['twin-flame-circlet'], warrior: ['bulwark-of-dawn'], ranger: ['trappers-satchel'] }, chance: [0.3, 0.45, 0.65] },
    intro: 'He has guarded this gate for three hundred years and sees no reason to stop.',
  },
  morgrave: {
    id: 'morgrave',
    name: 'Morgrave',
    title: 'the Ash-Scholar',
    sprite: 'morgrave',
    hp: 2200,
    dmg: 18,
    radius: 10,
    xp: 900,
    gold: [150, 220],
    floats: true,
    phases: [
      {
        at: 1,
        speed: 30,
        rest: [0.8, 1.3],
        patterns: [
          { id: 'soulVolley', w: 3, cd: 3, p: { count: 5, waves: 2 } },
          { id: 'graveGrasp', w: 3, cd: 3.5, p: { count: 4 } },
          { id: 'summon', w: 1, cd: 18, p: { enemies: ['skeleton', 'skeleton', 'skeleton-archer'] } },
        ],
      },
      {
        at: 0.65,
        banner: 'Grieflight floods the crypt!',
        speed: 34,
        rest: [0.6, 1.1],
        enter: [{ id: 'crypt:soul-split', w: 1, cd: 0, p: { n: 3, time: 12, heal: 0.1, rage: 1.12 } }],
        patterns: [
          { id: 'riftSpiral', w: 3, cd: 7, p: { arms: 3, time: 3 } },
          { id: 'riftBeams', w: 3, cd: 5, p: { beams: 4 } },
          { id: 'graveGrasp', w: 2, cd: 3.5, p: { count: 5 } },
          { id: 'teleport', w: 2, cd: 6 },
          { id: 'soulVolley', w: 1, cd: 4, p: { count: 7, waves: 2 } },
        ],
      },
      {
        at: 0.3,
        banner: 'Reality crumbles! Stay inside the light!',
        speed: 38,
        rest: [0.5, 0.9],
        enter: [{ id: 'crypt:soul-split', w: 1, cd: 0, p: { n: 4, time: 13, heal: 0.12, rage: 1.15 } }, { id: 'collapse', w: 1, cd: 0 }],
        patterns: [
          { id: 'riftNova', w: 3, cd: 6 },
          { id: 'riftBeams', w: 2, cd: 5, p: { beams: 5 } },
          { id: 'soulVolley', w: 2, cd: 4, p: { count: 7, waves: 3 } },
          { id: 'riftSpiral', w: 2, cd: 7, p: { arms: 4, time: 2.6 } },
          { id: 'summon', w: 1, cd: 20, p: { enemies: ['skeleton', 'bone-hound'] } },
        ],
      },
    ],
    first: { mage: ['heart-of-the-inferno'], warrior: ['quakehammer'], ranger: ['galeheart-bow'] },
    drops: {
      items: { mage: ['heart-of-the-inferno', 'stormcaller-rod'], warrior: ['quakehammer', 'whirling-greaves'], ranger: ['galeheart-bow', 'splitwood-bow'], any: ['riftwalker-mantle', 'crown-of-the-hollow-king'] },
      chance: [0.35, 0.6, 1],
    },
    intro: 'A scholar of the Ash Crown who came for the reliquary under the chapel. He has read every book about the Starlight Crown, and burned most of them.',
  },
  /* ------------------------------------------------------------ Gallows Keep */
  hangman: {
    id: 'hangman',
    name: 'The Hangman',
    title: 'Headsman of the Gallows Gang',
    sprite: 'hangman',
    hp: 3000,
    dmg: 28,
    radius: 10,
    xp: 420,
    gold: [70, 100],
    phases: [
      {
        at: 1,
        speed: 34,
        rest: [0.8, 1.2],
        // the gallows floor: its boards drop, half and then the other half (sim/patterns/gallows.ts)
        enter: [{ id: 'gallows:trapdoors', w: 1, cd: 0, p: { waves: 2, wind: 1.5 } }],
        patterns: [
          // the axe in a wide arc in front of him, then straight down along a line
          { id: 'cleave', w: 3, cd: 3.5, p: { r: 54, arc: 1, wind: 0.8, mul: 1.4 } },
          { id: 'chop', w: 3, cd: 4, p: { len: 130, width: 20, wind: 0.9, mul: 1.6 } },
          // the noose: caught in its line, you are dragged in for the axe
          { id: 'hook', w: 2, cd: 7, p: { len: 150, width: 12, wind: 0.85 } },
          { id: 'gallows:trapdoors', w: 3, cd: 10, p: { waves: 3, wind: 1.3 } },
        ],
      },
      {
        at: 0.5,
        banner: 'The Hangman takes up a second axe!',
        speed: 40,
        rest: [0.6, 1],
        enter: [{ id: 'roar', w: 1, cd: 0 }, { id: 'gallows:trapdoors', w: 1, cd: 0, p: { waves: 4, wind: 1.15 } }],
        patterns: [
          { id: 'chop', w: 3, cd: 5, p: { lines: 3, spread: 0.55, len: 140, width: 18, wind: 0.95, mul: 1.6 } },
          // a chain of thrown axes, each one shown before it flies
          { id: 'volley', w: 3, cd: 6, p: { shots: 3, wind: 0.5, interval: 0.15, speed: 200, r: 5, mul: 1.2, color: '#c8ccd8', range: 320 } },
          { id: 'cleave', w: 2, cd: 4, p: { swings: 2, r: 54, arc: 1, wind: 0.65, lunge: 30, mul: 1.4 } },
          // the hook drags whoever it catches onto the boards in front of him, and they drop
          { id: 'gallows:hook-drop', w: 3, cd: 7, p: { len: 170, width: 13, wind: 0.8, drop: 0.9 } },
          { id: 'gallows:trapdoors', w: 3, cd: 9, p: { waves: 4, wind: 1.1 } },
        ],
      },
    ],
    first: { any: ['second-wind-ring'] },
    drops: { items: { any: ['second-wind-ring', 'thornmail', 'static-band', 'zephyr-boots'], warrior: ['sunder-band'], mage: ['piercing-catalyst'], ranger: ['ricochet-longbow'] }, chance: [0.3, 0.45, 0.65] },
    intro: 'The gang’s executioner. He has never needed a second swing, but he brought a second axe.',
  },
  gnasher: {
    id: 'gnasher',
    name: 'Gnasher',
    title: 'War-Hound of the Gallows Gang',
    sprite: 'gnasher',
    hp: 3800,
    dmg: 29,
    radius: 14,
    xp: 600,
    gold: [90, 140],
    phases: [
      {
        at: 1,
        speed: 52,
        rest: [0.7, 1.1],
        patterns: [
          // two bites, a lunge with each, from his jaws (`ahead`), wide enough to see past his own body
          { id: 'cleave', w: 3, cd: 2.6, p: { swings: 2, r: 52, arc: 0.85, ahead: 30, wind: 0.5, gap: 0.12, lunge: 30, mul: 1 } },
          { id: 'charge', w: 2, cd: 5, p: { stun: 0.8 } },
          // under the floor after the hero (bone heaps in the kennels draw him up: sim/patterns/gallows.ts)
          { id: 'gallows:burrow', w: 3, cd: 11, p: { time: 4.5, speed: 92, erupt: 0.6 } },
        ],
      },
      {
        at: 0.5,
        banner: 'Gnasher howls for the pack!',
        speed: 58,
        rest: [0.55, 0.9],
        enter: [{ id: 'summon', w: 1, cd: 0, p: { enemies: ['hill-wolf', 'hill-wolf'] } }, { id: 'gallows:burrow', w: 1, cd: 0, p: { time: 5, speed: 100, erupt: 0.55 } }],
        patterns: [
          { id: 'cleave', w: 3, cd: 2.2, p: { swings: 3, r: 52, arc: 0.85, ahead: 30, wind: 0.45, gap: 0.1, lunge: 30, mul: 1 } },
          { id: 'tripleCharge', w: 2, cd: 6, p: { count: 2, wind: 0.6, speed: 320, len: 150, stun: 0, mul: 1.2 } },
          { id: 'gallows:burrow', w: 3, cd: 9, p: { time: 4.5, speed: 102, r: 46, erupt: 0.55 } },
          { id: 'summon', w: 1, cd: 22, p: { enemies: ['hill-wolf'] } },
        ],
      },
    ],
    first: { any: ['zephyr-boots'] },
    drops: { items: { any: ['zephyr-boots', 'thornmail', 'second-wind-ring'] }, chance: [0.3, 0.45, 0.65] },
    intro: 'The gang feeds him what the Hangman leaves. He has gone hungry all week.',
  },
  varric: {
    id: 'varric',
    name: 'Harlan Blackglove',
    title: 'King of the Gallows Gang',
    sprite: 'varric',
    hp: 5000,
    dmg: 27,
    radius: 10,
    xp: 900,
    gold: [150, 220],
    phases: [
      {
        at: 1,
        speed: 46,
        rest: [0.6, 1],
        patterns: [
          // two long knives: he steps in and cuts twice
          { id: 'cleave', w: 3, cd: 2.5, p: { swings: 2, r: 38, arc: 0.85, wind: 0.45, gap: 0.08, lunge: 26, mul: 1 } },
          // fans of thrown knives
          { id: 'volley', w: 3, cd: 4, p: { shots: 2, fan: 5, spread: 1, wind: 0.55, interval: 0.3, speed: 170, r: 3, mul: 0.7, look: 'enemyArrow', color: '#d8dce6', len: 110 } },
          // quick dashes along a lane: no wall stops him for long
          { id: 'tripleCharge', w: 2, cd: 5, p: { count: 2, wind: 0.5, speed: 330, len: 160, stun: 0, mul: 1.1 } },
        ],
      },
      {
        at: 0.6,
        banner: 'Blackglove whistles for his cutthroats!',
        speed: 50,
        rest: [0.5, 0.9],
        enter: [{ id: 'summon', w: 1, cd: 0, p: { enemies: ['bandit-cutthroat', 'bandit-cutthroat'] } }, { id: 'gallows:hostages', w: 1, cd: 0, p: { n: 1, time: 9 } }, { id: 'vanish', w: 1, cd: 0, p: { r: 44, arc: 1, wind: 0.6, mul: 1.3 } }],
        patterns: [
          // captives in cages over the fire pits: break them out in time (sim/patterns/gallows.ts)
          { id: 'gallows:hostages', w: 2, cd: 16, p: { n: 1, time: 9 } },
          // a smoke bomb: gone, then behind you with both knives
          { id: 'vanish', w: 3, cd: 6, p: { r: 44, arc: 1, wind: 0.6, mul: 1.3 } },
          { id: 'cleave', w: 3, cd: 2.5, p: { swings: 2, r: 38, arc: 0.85, wind: 0.45, gap: 0.08, lunge: 26, mul: 1 } },
          { id: 'volley', w: 2, cd: 4, p: { shots: 2, fan: 7, spread: 1.3, wind: 0.55, interval: 0.3, speed: 170, r: 3, mul: 0.7, look: 'enemyArrow', color: '#d8dce6', len: 110 } },
          { id: 'tripleCharge', w: 2, cd: 5, p: { count: 3, wind: 0.45, speed: 340, len: 160, stun: 0, mul: 1.1 } },
          { id: 'summon', w: 1, cd: 16, p: { enemies: ['bandit-cutthroat', 'bandit-cutthroat'] } },
        ],
      },
      {
        at: 0.25,
        banner: 'Nobody takes the Gallows from me!',
        speed: 54,
        rest: [0.45, 0.8],
        enter: [{ id: 'gallows:hostages', w: 1, cd: 0, p: { n: 2, time: 8.5 } }, { id: 'vanish', w: 1, cd: 0, p: { r: 46, arc: 1.1, wind: 0.55, mul: 1.3 } }],
        patterns: [
          { id: 'gallows:hostages', w: 2, cd: 14, p: { n: 2, time: 8.5 } },
          { id: 'vanish', w: 3, cd: 5, p: { r: 46, arc: 1.1, wind: 0.55, mul: 1.3 } },
          { id: 'volley', w: 3, cd: 4, p: { shots: 3, fan: 5, spread: 1, wind: 0.5, interval: 0.25, speed: 180, r: 3, mul: 0.7, look: 'enemyArrow', color: '#d8dce6', len: 110 } },
          { id: 'tripleCharge', w: 2, cd: 5, p: { count: 3, wind: 0.42, speed: 350, len: 170, stun: 0, mul: 1.1 } },
          { id: 'cleave', w: 2, cd: 2.5, p: { swings: 3, r: 38, arc: 0.85, wind: 0.42, gap: 0.06, lunge: 24, mul: 1 } },
          { id: 'summon', w: 1, cd: 18, p: { enemies: ['bandit-cutthroat', 'hill-wolf'] } },
        ],
      },
    ],
    first: { any: ['glitch-shard'] },
    drops: {
      items: { warrior: ['bloodthirst-blade', 'riposte-gauntlets'], mage: ['glacier-staff', 'tome-of-blinking'], ranger: ['ricochet-longbow', 'huntmasters-hood'], any: ['glitch-shard', 'amulet-of-echoes', 'riftwalker-mantle'] },
      chance: [0.35, 0.6, 1],
    },
    intro: 'He took the hill with two knives and a grin. He has kept it with the same.',
  },
  /* ------------------------------------------------------------ the Smugglers' Grotto */
  'the-drowned': {
    id: 'the-drowned',
    name: 'The Drowned Priestess',
    title: 'Voice of the Deep Tide',
    sprite: 'the-drowned',
    hp: 3400,
    dmg: 25,
    radius: 10,
    xp: 420,
    gold: [70, 100],
    floats: true,
    phases: [
      {
        at: 1,
        speed: 30,
        rest: [0.8, 1.3],
        patterns: [
          // a wave of brine rolling across the shrine, a gap or two in it
          { id: 'spell:wall', w: 3, cd: 4, p: { look: 'water', color: '#7ad8ff', type: 'frost', speed: 65, gaps: 2, mul: 0.8 } },
          // the undertow drags the hero in while she brings the sea down round her
          { id: 'spell:undertow', w: 3, cd: 3.5, p: { color: '#7ad8ff', type: 'frost', time: 2.4, pull: 46, rr: 58, mul: 1.4 } },
          // a wall of water rolls across the shrine: find the gap
          { id: 'tide', w: 2, cd: 7, p: { speed: 70, gap: 3, form: 1.1 } },
          // the shrine goes under the sea: breathe at the vents (sim/patterns/grotto.ts)
          { id: 'grotto:flood', w: 2, cd: 16, p: { time: 8, air: 6, vents: 3 } },
        ],
      },
      {
        at: 0.5,
        banner: 'The Drowned calls her children from the deep!',
        speed: 34,
        rest: [0.6, 1.1],
        enter: [{ id: 'summon', w: 1, cd: 0, p: { enemies: ['mirefin-skirmisher', 'mirefin-skirmisher', 'mirefin-spearthrower'] } }, { id: 'grotto:flood', w: 1, cd: 0, p: { time: 10, air: 5, vents: 3 } }],
        patterns: [
          { id: 'grotto:flood', w: 2, cd: 15, p: { time: 9, air: 5, vents: 3 } },
          { id: 'tide', w: 3, cd: 6, p: { speed: 75, gap: 3, form: 1, waves: 2, gapT: 1.3 } },
          // a wave of brine rolling across the shrine, a gap or two in it
          { id: 'spell:wall', w: 3, cd: 4, p: { look: 'water', color: '#7ad8ff', type: 'frost', speed: 65, gaps: 2, mul: 0.8 } },
          // the undertow drags the hero in while she brings the sea down round her
          { id: 'spell:undertow', w: 2, cd: 3.5, p: { color: '#7ad8ff', type: 'frost', time: 2.4, pull: 46, rr: 58, mul: 1.4 } },
          { id: 'summon', w: 1, cd: 18, p: { enemies: ['mirefin-skirmisher', 'mirefin-oracle'] } },
        ],
      },
    ],
    first: { any: ['menders-charm'] },
    drops: { items: { any: ['menders-charm', 'second-wind-ring', 'static-band', 'amulet-of-echoes'], mage: ['glacier-staff'], warrior: ['bulwark-of-dawn'], ranger: ['viper-quiver'] }, chance: [0.3, 0.45, 0.65] },
    intro: 'The mirefins pray to her. The smugglers pay her. Nobody remembers what she was before the sea.',
  },
  clatterclaw: {
    id: 'clatterclaw',
    name: 'Mother Clatterclaw',
    title: 'Matriarch of the Shore Crabs',
    sprite: 'clatterclaw',
    hp: 3600,
    dmg: 27,
    radius: 18,
    xp: 700,
    gold: [110, 160],
    phases: [
      {
        at: 1,
        speed: 30,
        rest: [0.7, 1.1],
        // her shell turns blows to her face: get round her (sim/patterns/grotto.ts)
        enter: [{ id: 'grotto:shell', w: 1, cd: 0, p: { cut: 0.7, turn: 1.4 } }],
        patterns: [
          { id: 'grotto:pincers', w: 3, cd: 3, p: { snaps: 2, wind: 0.6 } },
          { id: 'grotto:scuttle', w: 2, cd: 6, p: { len: 150, wind: 0.7 } },
          { id: 'grotto:froth', w: 2, cd: 5, p: { count: 5 } },
        ],
      },
      {
        at: 0.5,
        banner: 'Mother Clatterclaw molts!',
        speed: 46,
        rest: [0.5, 0.85],
        enter: [{ id: 'grotto:molt', w: 1, cd: 0, p: { turn: 3.2 } }, { id: 'summon', w: 1, cd: 0, p: { enemies: ['shore-crab', 'shore-crab'] } }],
        patterns: [
          { id: 'grotto:pincers', w: 3, cd: 2.2, p: { snaps: 3, wind: 0.5, mul: 1.4 } },
          { id: 'grotto:scuttle', w: 3, cd: 4.5, p: { len: 170, wind: 0.55, speed: 320 } },
          { id: 'grotto:froth', w: 2, cd: 4, p: { count: 7 } },
          { id: 'summon', w: 1, cd: 20, p: { enemies: ['shore-crab'] } },
        ],
      },
    ],
    first: { any: ['amulet-of-echoes'] },
    drops: { items: { any: ['amulet-of-echoes', 'thornmail', 'menders-charm'], warrior: ['bulwark-of-dawn'] }, chance: [0.3, 0.45, 0.65] },
    intro: 'The smugglers built their powder store on her pools. She has been waiting for them to leave.',
  },
  saltbeard: {
    id: 'saltbeard',
    name: 'Captain Saltbeard',
    title: 'Master of the Smugglers’ Grotto',
    sprite: 'saltbeard',
    hp: 5600,
    dmg: 27,
    radius: 10,
    xp: 900,
    gold: [150, 220],
    phases: [
      {
        at: 1,
        speed: 40,
        rest: [0.7, 1.1],
        patterns: [
          // the cutlass: two quick cuts, stepping in
          { id: 'cleave', w: 3, cd: 3, p: { swings: 2, r: 42, arc: 0.95, wind: 0.5, gap: 0.1, lunge: 24, mul: 1.15 } },
          // the flintlock aims where you are going, not where you are
          { id: 'volley', w: 3, cd: 4.5, p: { wind: 0.85, speed: 330, lead: 1, r: 3, mul: 1.7, color: '#ffd27a', len: 240, width: 6, sfx: 'thunder' } },
          // powder kegs: the circle is the fuse
          { id: 'kegs', w: 2, cd: 7, p: { count: 3, fuse: 2.2, r: 34, mul: 1.6 } },
          // the cannons on the cliff: shells across the cove, salvo after salvo
          { id: 'barrage', w: 2, cd: 8, p: { salvos: 3, count: 5, r: 24, dur: 1.1, gap: 0.5, mul: 1.2 } },
          // the Black Spot: pass it on with a blow (sim/patterns/grotto.ts)
          { id: 'grotto:black-spot', w: 2, cd: 18, p: { time: 8, mul: 0.4 } },
        ],
      },
      {
        at: 0.6,
        banner: 'All hands! Repel boarders!',
        speed: 44,
        rest: [0.6, 1],
        enter: [{ id: 'summon', w: 1, cd: 0, p: { enemies: ['smuggler-cutlass', 'smuggler-cutlass', 'smuggler-bomber'] } }, { id: 'grotto:black-spot', w: 1, cd: 0, p: { time: 7, mul: 0.4 } }, { id: 'barrage', w: 1, cd: 0, p: { salvos: 3, count: 6, r: 24, dur: 1.1, gap: 0.5, mul: 1.2 } }],
        patterns: [
          { id: 'grotto:black-spot', w: 2, cd: 15, p: { time: 7, mul: 0.4 } },
          { id: 'cleave', w: 3, cd: 3, p: { swings: 3, r: 42, arc: 0.95, wind: 0.48, gap: 0.08, lunge: 24, mul: 1.15 } },
          { id: 'volley', w: 3, cd: 4.5, p: { shots: 2, interval: 0.3, wind: 0.8, speed: 330, lead: 1, r: 3, mul: 1.7, color: '#ffd27a', len: 240, width: 6, sfx: 'thunder' } },
          { id: 'kegs', w: 2, cd: 7, p: { count: 4, fuse: 2.2, r: 34, mul: 1.6 } },
          { id: 'barrage', w: 2, cd: 8, p: { salvos: 4, count: 6, r: 24, dur: 1.1, gap: 0.5, mul: 1.2 } },
          { id: 'summon', w: 1, cd: 18, p: { enemies: ['smuggler-cutlass', 'smuggler-bomber'] } },
        ],
      },
      {
        at: 0.25,
        banner: 'Fire everything we have!',
        speed: 46,
        rest: [0.5, 0.9],
        enter: [{ id: 'kegs', w: 1, cd: 0, p: { count: 6, fuse: 2.4, r: 32, spread: 50, mul: 1.6 } }],
        patterns: [
          { id: 'grotto:black-spot', w: 2, cd: 12, p: { time: 6, mul: 0.45 } },
          { id: 'barrage', w: 3, cd: 6, p: { salvos: 4, count: 7, r: 24, dur: 1, gap: 0.45, mul: 1.2 } },
          { id: 'volley', w: 3, cd: 4, p: { shots: 3, interval: 0.25, wind: 0.75, speed: 340, lead: 1, r: 3, mul: 1.7, color: '#ffd27a', len: 240, width: 6, sfx: 'thunder' } },
          { id: 'kegs', w: 2, cd: 6, p: { count: 5, fuse: 2.2, r: 32, spread: 50, mul: 1.6 } },
          { id: 'cleave', w: 2, cd: 3, p: { swings: 3, r: 42, arc: 0.95, wind: 0.45, gap: 0.08, lunge: 24, mul: 1.15 } },
        ],
      },
    ],
    first: { any: ['amulet-of-echoes'] },
    drops: {
      items: { warrior: ['quakehammer', 'whirling-greaves'], mage: ['stormcaller-rod', 'heart-of-the-inferno'], ranger: ['galeheart-bow', 'trappers-satchel'], any: ['amulet-of-echoes', 'crown-of-the-hollow-king', 'riftwalker-mantle', 'glitch-shard'] },
      chance: [0.35, 0.6, 1],
    },
    intro: 'Forty years a smuggler, twenty a captain, and he has never once paid a harbor fee.',
  },
};

for (const d of DUNGEONS) Object.assign(BOSSES, d.bosses);
