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
    title: 'Alpha of the Whisperwood',
    sprite: 'grimtusk',
    hp: 640,
    dmg: 15,
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
  ossric: {
    id: 'ossric',
    name: 'Warden Ossric',
    title: 'Keeper of the Hollow Gate',
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
        patterns: [
          { id: 'charge', w: 3, cd: 4, p: { stun: 1.6 } },
          { id: 'slam', w: 2, cd: 4 },
          { id: 'spearFan', w: 2, cd: 3, p: { count: 3 } },
        ],
      },
      {
        at: 0.5,
        banner: 'The Warden calls the dead to arms!',
        speed: 42,
        rest: [0.6, 1],
        enter: [{ id: 'summon', w: 1, cd: 0, p: { enemies: ['skeleton', 'skeleton'] } }],
        patterns: [
          { id: 'slamRings', w: 3, cd: 5 },
          { id: 'charge', w: 2, cd: 4, p: { stun: 1.3 } },
          { id: 'spearFan', w: 2, cd: 3, p: { count: 5 } },
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
    title: 'the Rift-Touched',
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
        banner: 'The Rift tears open!',
        speed: 34,
        rest: [0.6, 1.1],
        enter: [{ id: 'teleport', w: 1, cd: 0, p: { center: 1 } }, { id: 'riftSpiral', w: 1, cd: 0, p: { arms: 3, time: 3 } }],
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
        enter: [{ id: 'teleport', w: 1, cd: 0, p: { center: 1 } }, { id: 'collapse', w: 1, cd: 0 }],
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
    intro: 'A sorcerer who opened the Rift to live forever. It is working, sort of.',
  },
  /* ------------------------------------------------------------ Gallows Keep */
  hangman: {
    id: 'hangman',
    name: 'The Hangman',
    title: 'Headsman of the Gallows Gang',
    sprite: 'hangman',
    hp: 1500,
    dmg: 20,
    radius: 10,
    xp: 420,
    gold: [70, 100],
    phases: [
      {
        at: 1,
        speed: 34,
        rest: [0.8, 1.2],
        patterns: [
          // the axe in a wide arc in front of him, then straight down along a line
          { id: 'cleave', w: 3, cd: 3.5, p: { r: 54, arc: 1, wind: 0.8, mul: 1.4 } },
          { id: 'chop', w: 3, cd: 4, p: { len: 130, width: 20, wind: 0.9, mul: 1.6 } },
          // the noose: caught in its line, you are dragged in for the axe
          { id: 'hook', w: 2, cd: 7, p: { len: 150, width: 12, wind: 0.85 } },
        ],
      },
      {
        at: 0.5,
        banner: 'The Hangman takes up a second axe!',
        speed: 40,
        rest: [0.6, 1],
        enter: [{ id: 'roar', w: 1, cd: 0 }],
        patterns: [
          { id: 'chop', w: 3, cd: 5, p: { lines: 3, spread: 0.55, len: 140, width: 18, wind: 0.95, mul: 1.6 } },
          // a chain of thrown axes, each one shown before it flies
          { id: 'volley', w: 3, cd: 6, p: { shots: 3, wind: 0.5, interval: 0.15, speed: 200, r: 5, mul: 1.2, color: '#c8ccd8', range: 320 } },
          { id: 'cleave', w: 2, cd: 4, p: { swings: 2, r: 54, arc: 1, wind: 0.65, lunge: 30, mul: 1.4 } },
          { id: 'hook', w: 2, cd: 6, p: { len: 160, width: 12, wind: 0.8 } },
        ],
      },
    ],
    first: { any: ['second-wind-ring'] },
    drops: { items: { any: ['second-wind-ring', 'thornmail', 'static-band', 'zephyr-boots'], warrior: ['sunder-band'], mage: ['piercing-catalyst'], ranger: ['ricochet-longbow'] }, chance: [0.3, 0.45, 0.65] },
    intro: 'The gang’s executioner. He has never needed a second swing, but he brought a second axe.',
  },
  varric: {
    id: 'varric',
    name: 'Varric Blackhand',
    title: 'King of the Gallows Gang',
    sprite: 'varric',
    hp: 3000,
    dmg: 21,
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
          { id: 'volley', w: 3, cd: 4, p: { shots: 2, fan: 5, spread: 1, wind: 0.55, interval: 0.3, speed: 170, r: 3, mul: 0.8, look: 'enemyArrow', color: '#d8dce6', len: 110 } },
          // quick dashes along a lane: no wall stops him for long
          { id: 'tripleCharge', w: 2, cd: 5, p: { count: 2, wind: 0.5, speed: 330, len: 160, stun: 0, mul: 1.1 } },
        ],
      },
      {
        at: 0.6,
        banner: 'Blackhand whistles for his cutthroats!',
        speed: 50,
        rest: [0.5, 0.9],
        enter: [{ id: 'summon', w: 1, cd: 0, p: { enemies: ['bandit-cutthroat', 'bandit-cutthroat'] } }, { id: 'vanish', w: 1, cd: 0, p: { r: 44, arc: 1, wind: 0.6, mul: 1.3 } }],
        patterns: [
          // a smoke bomb: gone, then behind you with both knives
          { id: 'vanish', w: 3, cd: 6, p: { r: 44, arc: 1, wind: 0.6, mul: 1.3 } },
          { id: 'cleave', w: 3, cd: 2.5, p: { swings: 2, r: 38, arc: 0.85, wind: 0.45, gap: 0.08, lunge: 26, mul: 1 } },
          { id: 'volley', w: 2, cd: 4, p: { shots: 2, fan: 7, spread: 1.3, wind: 0.55, interval: 0.3, speed: 170, r: 3, mul: 0.8, look: 'enemyArrow', color: '#d8dce6', len: 110 } },
          { id: 'tripleCharge', w: 2, cd: 5, p: { count: 3, wind: 0.45, speed: 340, len: 160, stun: 0, mul: 1.1 } },
          { id: 'summon', w: 1, cd: 16, p: { enemies: ['bandit-cutthroat', 'bandit-cutthroat'] } },
        ],
      },
      {
        at: 0.25,
        banner: 'Nobody takes the Gallows from me!',
        speed: 54,
        rest: [0.45, 0.8],
        enter: [{ id: 'vanish', w: 1, cd: 0, p: { r: 46, arc: 1.1, wind: 0.55, mul: 1.3 } }],
        patterns: [
          { id: 'vanish', w: 3, cd: 5, p: { r: 46, arc: 1.1, wind: 0.55, mul: 1.3 } },
          { id: 'volley', w: 3, cd: 4, p: { shots: 3, fan: 5, spread: 1, wind: 0.5, interval: 0.25, speed: 180, r: 3, mul: 0.8, look: 'enemyArrow', color: '#d8dce6', len: 110 } },
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
    hp: 1120,
    dmg: 20,
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
          // slow water orbs that seek you out
          { id: 'orbs', w: 3, cd: 4, p: { count: 4, speed: 55, homing: 1, mul: 0.9, color: '#7ad8ff' } },
          // whirlpools open under you
          { id: 'graveGrasp', w: 3, cd: 3.5, p: { count: 4 } },
          // a wall of water rolls across the shrine: find the gap
          { id: 'tide', w: 2, cd: 7, p: { speed: 70, gap: 3, form: 1.1 } },
        ],
      },
      {
        at: 0.5,
        banner: 'The Drowned calls her children from the deep!',
        speed: 34,
        rest: [0.6, 1.1],
        enter: [{ id: 'summon', w: 1, cd: 0, p: { enemies: ['mirefin-skirmisher', 'mirefin-skirmisher', 'mirefin-spearthrower'] } }],
        patterns: [
          { id: 'tide', w: 3, cd: 6, p: { speed: 75, gap: 3, form: 1, waves: 2, gapT: 1.3 } },
          { id: 'orbs', w: 3, cd: 4, p: { count: 6, speed: 58, homing: 1.1, mul: 0.9, color: '#7ad8ff' } },
          { id: 'graveGrasp', w: 2, cd: 3.5, p: { count: 5 } },
          { id: 'teleport', w: 1, cd: 8 },
          { id: 'summon', w: 1, cd: 18, p: { enemies: ['mirefin-skirmisher', 'mirefin-oracle'] } },
        ],
      },
    ],
    first: { any: ['menders-charm'] },
    drops: { items: { any: ['menders-charm', 'second-wind-ring', 'static-band', 'amulet-of-echoes'], mage: ['glacier-staff'], warrior: ['bulwark-of-dawn'], ranger: ['viper-quiver'] }, chance: [0.3, 0.45, 0.65] },
    intro: 'The mirefins pray to her. The smugglers pay her. Nobody remembers what she was before the sea.',
  },
  saltbeard: {
    id: 'saltbeard',
    name: 'Captain Saltbeard',
    title: 'Master of the Smugglers’ Grotto',
    sprite: 'saltbeard',
    hp: 2170,
    dmg: 22,
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
        ],
      },
      {
        at: 0.6,
        banner: 'All hands! Repel boarders!',
        speed: 44,
        rest: [0.6, 1],
        enter: [{ id: 'summon', w: 1, cd: 0, p: { enemies: ['smuggler-cutlass', 'smuggler-cutlass', 'smuggler-bomber'] } }, { id: 'barrage', w: 1, cd: 0, p: { salvos: 3, count: 6, r: 24, dur: 1.1, gap: 0.5, mul: 1.2 } }],
        patterns: [
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
