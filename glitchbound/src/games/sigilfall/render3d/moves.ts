/**
 * How the hero's body makes each skill.
 *
 * Every class used to make every skill with one of five clips, and a melee class's whole kit was the same chop. Here
 * each skill has a move of its own from what the rig can do: a fighter's basic swing is a chain of three different
 * cuts, a thrust lunges, a slam leaves the ground, a mage's fire is swung from the staff where frost is thrust and
 * lightning thrown from the open hand. Which stretch of the clip is the blow itself comes from strike.ts, so the
 * weapon lands as the hit does.
 */

import type { ClassId } from '../data/types';

export interface Move {
  clip: string;
  /** Times the clip's own speed (1 unless given). */
  rate?: number;
  /** Tiles the body steps into the blow, and back. */
  lunge?: number;
  /** Tiles off the ground at the top of it. */
  hop?: number;
  /** What a skill with a wind-up shows while it winds up (unset: this clip's own lift). */
  wind?: string;
  /** Played from here to there, where the clip isn't a blow to be measured (a guard held up). */
  from?: number;
  to?: number;
  /**
   * A skill that carries them across the ground first (a charge, a leap): how the weapon is held on the way, 'out'
   * at the end of its blow or 'up' at the top of its lift; the rest of the clip plays as they arrive.
   */
  carried?: 'out' | 'up';
}

export type ActKind = 'swing' | 'cast' | 'shoot' | 'heavy' | 'spin';

/* ------------------------------------------------------------------ the moves */

/** A quick cut across. */
const slice: Move = { clip: 'slice', rate: 1.25, lunge: 0.2 };
/** A cut down. */
const chop: Move = { clip: 'chop', rate: 1.25, lunge: 0.2 };
/** The big one: from overhead, with the body behind it. */
const hew: Move = { clip: 'chop2', rate: 1.45, lunge: 0.3 };
/** The point, with a long step in. */
const thrust: Move = { clip: 'stab', rate: 1.3, lunge: 0.45 };
/** Off the ground and down on it. */
const slam: Move = { clip: 'chop2', rate: 1.35, hop: 0.32, lunge: 0.12 };
/** All the way round, blade out. */
const whirl: Move = { clip: 'spin', rate: 2 };
/** The shield, or the off hand, driven into them. */
const bash: Move = { clip: 'bash', rate: 1.2, lunge: 0.32 };
/** Something thrown overhand. */
const hurl: Move = { clip: 'throw', rate: 1.35 };
/** An arrow loosed. */
const loose: Move = { clip: 'bow' };
/** An arrow held at full draw, then loosed. */
const drawn: Move = { clip: 'bow', wind: 'bowdraw' };
/** A spell from the open hand. */
const flick: Move = { clip: 'cast', rate: 1.15 };
/** A spell swung out of the staff. */
const sweep: Move = { clip: 'chop', rate: 1.2 };
/** A spell driven out of the staff's point. */
const jab: Move = { clip: 'stab', rate: 1.3, lunge: 0.1 };
/** The staff brought down on the ground. */
const plant: Move = { clip: 'chop2', rate: 1.3 };
/** Arms up: something called down, or given. */
const call: Move = { clip: 'cheer', rate: 1.1 };
/** The same, off their feet with it. */
const exalt: Move = { clip: 'cheer', rate: 1.1, hop: 0.3 };
/** A shout at them. */
const roar: Move = { clip: 'taunt', rate: 1.1 };
/** A guard held up. */
const ward: Move = { clip: 'block', from: 0, to: 0.55 };
/** Something drawn up out of the ground. */
const conjure: Move = { clip: 'summon', rate: 1.2 };
/** A leap that comes down as a blow (the blade is overhead while they're in the air). */
const leap: Move = { clip: 'chop2', rate: 1.4, hop: 0.7, carried: 'up' };
/** A rush behind the point. */
const rush: Move = { clip: 'stab', rate: 1.3, carried: 'out' };
/** A rush behind the shield. */
const ram: Move = { clip: 'bash', rate: 1.2, carried: 'out' };

/** A fighter's basic swing: three cuts in a row, each its own, the third the big one. */
const CHAIN: Partial<Record<ClassId, readonly [Move, Move, Move]>> = {
  warrior: [slice, chop, hew],
  paladin: [chop, bash, hew],
  gloamknight: [chop, slice, whirl],
};

const BASIC = new Set(['cleave', 'crusader-strike', 'gloam-cleave']);

/** What each skill is, as a move. A skill not here moves as its kind does (see `BY_KIND`). */
const BY_SKILL: Record<string, Move> = {
  // warrior
  'heavy-strike': hew,
  'mortal-strike': slam,
  bloodthirst: thrust,
  'last-word': thrust,
  'thunder-clap': slam,
  challenge: roar,
  'battle-shout': roar,
  'rallying-roar': roar,
  'shield-wall': ward,
  hookchain: hurl,
  earthsplitter: slam,
  'shield-bash': ram,
  charge: rush,
  'ground-breaker': leap,
  // paladin
  judgment: hurl,
  'hammer-of-justice': hurl,
  'oath-chain': hurl,
  'avengers-shield': bash,
  'shield-of-the-righteous': bash,
  'templars-verdict': hew,
  sentence: slam,
  'divine-storm': whirl,
  consecration: plant,
  'word-of-glory': call,
  'cleansing-light': call,
  bulwark: ward,
  'holy-shock': flick,
  'avenging-wrath': exalt,
  'dawn-leap': leap,
  // gloam knight
  'umbral-rend': hew,
  'sundering-dark': slam,
  evenfall: hurl,
  'dread-toll': plant,
  'black-oath': roar,
  'blood-price': roar,
  'cast-off': roar,
  'night-mantle': ward,
  'hollow-ward': ward,
  'night-tether': flick,
  'grasping-gloom': flick,
  'creeping-dread': flick,
  duskfall: slam,
  'shadow-lunge': rush,
  'dread-leap': plant,
  // ranger
  'aimed-shot': drawn,
  'poison-trap': hurl,
  'bear-trap': hurl,
  'tar-pit': hurl,
  'snare-net': hurl,
  'hunters-mark': flick,
  'call-wolf': call,
  'hawk-call': call,
  // mage: fire is swung, frost thrust, lightning thrown from the hand
  fireball: sweep,
  'ice-lance': jab,
  'frost-nova': plant,
  'chain-lightning': flick,
  'ball-lightning': flick,
  'arcane-barrier': ward,
  purge: call,
  'gravity-well': call,
  'frost-ring': plant,
  blizzard: call,
  flamestrike: plant,
  meteor: slam,
  'starfall-lance': jab,
  'mirror-self': conjure,
  // priest
  'holy-fire': sweep,
  'power-word-shield': call,
  'holy-nova': exalt,
  'mind-blast': jab,
  'psychic-scream': roar,
  renew: call,
  purify: call,
  halo: exalt,
  'shadow-fiend': conjure,
  sanctuary: plant,
  'grasp-of-faith': hurl,
  // warlock
  harvest: jab,
  'summon-imp': conjure,
  'summon-felguard': conjure,
  'life-tap': roar,
  'blood-pact': roar,
  'rain-of-fire': call,
  'chaos-bolt': sweep,
  'summon-infernal': slam,
  'shadow-snare': hurl,
  // druid
  moonfire: call,
  rejuvenation: call,
  bloom: call,
  thornhide: roar,
  starfire: { ...sweep, wind: 'channel' },
  starsurge: jab,
  'vine-vortex': plant,
  starfall: exalt,
  gale: sweep,
};

const BY_KIND: Record<ActKind, Move> = {
  swing: chop,
  heavy: hew,
  spin: whirl,
  shoot: loose,
  cast: flick,
};

/**
 * The move for what the hero just did: the skill's own, a basic swing's place in its chain (`step` counts the swings
 * in a row from 0, `big` is the rules' own third swing), or what its kind does.
 */
export function moveOf(cls: ClassId, skill: string | null, kind: ActKind, step: number, big: boolean): Move {
  if (skill && BASIC.has(skill)) {
    const chain = CHAIN[cls];
    if (chain) return big ? chain[2] : chain[step % 3]!;
  }
  if (skill && BY_SKILL[skill]) return BY_SKILL[skill]!;
  // (an archer's skills are shots: an arrow that pierces or bursts is loosed like any other)
  if (cls === 'ranger') return loose;
  // (a staff or a bow never chops: whatever a caster or an archer does that has no move of its own is a cast or a shot)
  if (kind === 'swing' || kind === 'heavy') return CHAIN[cls] ? BY_KIND[kind] : flick;
  return BY_KIND[kind];
}

/** Is this one of the three-cut basic swings? */
export function chained(skill: string | null): boolean {
  return !!skill && BASIC.has(skill);
}

/** Every skill that has a move of its own (for the test that they are all real skills). */
export const MOVE_SKILLS: readonly string[] = [...Object.keys(BY_SKILL), ...BASIC];
/** Every clip a move uses (for the test that the rig has them). */
export const MOVE_CLIPS: readonly string[] = [...new Set([...Object.values(BY_SKILL), ...Object.values(BY_KIND), ...Object.values(CHAIN).flatMap((c) => [...c])].flatMap((m) => (m.wind ? [m.clip, m.wind] : [m.clip])))];
