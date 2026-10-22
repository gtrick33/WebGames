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
  | 'roar';

export interface PatternUse {
  id: PatternId;
  /** How often it is picked relative to the others. */
  w: number;
  /** Seconds before the same pattern can come again. */
  cd: number;
  /** Pattern knobs (counts, enemies to summon, speeds). */
  p?: Record<string, number | string[]>;
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
};
