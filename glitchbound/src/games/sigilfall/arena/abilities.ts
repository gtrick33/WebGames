import type { ClassId } from '../data/types';

/**
 * The Ring: Sigilfall's arena. Its abilities are its own, apart from the campaign's: the numbers are flat and equal for
 * everyone so that a level 1 hero and a level 60 hero fight the same fight. Every class has twelve and takes four into
 * each match (plus the Swift Step and its super), so choosing them is half the game. Plain data with no imports but types: the icon build
 * reads it. The rules are the classic arena's; the names and the art are ours.
 */

export type School = 'physical' | 'fire' | 'frost' | 'arcane' | 'holy' | 'shadow' | 'nature';
/** Crowd control. Each kind wears off harder the more it is used: see DR in sim.ts. */
export type CcKind = 'stun' | 'fear' | 'incap' | 'root' | 'silence';

export type Effect =
  | { k: 'dmg'; n: number }
  /** Damage over time: `n` in all, ticking each second. */
  | { k: 'dot'; n: number; dur: number }
  | { k: 'heal'; n: number }
  | { k: 'hot'; n: number; dur: number }
  | { k: 'cc'; cc: CcKind; dur: number }
  | { k: 'slow'; pct: number; dur: number }
  /** Healing taken is cut by this much (a deep wound). */
  | { k: 'antiheal'; pct: number; dur: number }
  | { k: 'absorb'; n: number; dur: number }
  /** A share taken off all damage. */
  | { k: 'guard'; pct: number; dur: number }
  | { k: 'fury'; pct: number; dur: number }
  | { k: 'speed'; pct: number; dur: number }
  /** Nothing harmful lands. `still`: and you can't act either (an ice prison). `phys`: only blows are stopped. */
  | { k: 'immune'; dur: number; still?: boolean; phys?: boolean }
  /** Roots and slows don't hold. */
  | { k: 'free'; dur: number }
  /** The next harmful spell aimed at you goes back at its caster. */
  | { k: 'reflect'; dur: number }
  /** The next killing blow leaves you alive and heals you this much. */
  | { k: 'lastgrace'; dur: number; heal: number }
  /** A cast is cut off and its school locked for this long. */
  | { k: 'interrupt'; lock: number }
  /** A friend: one curse, or spell, comes off. An enemy: one blessing comes off. */
  | { k: 'dispel' }
  /** Rush to the target. */
  | { k: 'charge' }
  /** Vanish and appear this far ahead. */
  | { k: 'blink'; dist: number }
  /** Spring back this far, away from the nearest enemy. */
  | { k: 'leap'; dist: number }
  /** Roots and slows come off. */
  | { k: 'break' }
  /** All crowd control comes off. */
  | { k: 'token' }
  /** A snare left on the ground: the first enemy to step on it is caught. */
  | { k: 'trap'; cc: CcKind; dur: number }
  /** If this curse is taken off, whoever took it is silenced. */
  | { k: 'backlash'; dur: number }
  /** Costs its user this much of their own health (never the last of it). */
  | { k: 'price'; n: number }
  /** Throws them this far back, away from whoever hit them, and cuts off what they were casting. */
  | { k: 'knock'; dist: number }
  /** A quick step this far the way you're going. */
  | { k: 'dash'; dist: number }
  /**
   * Raises `n` of the dead beside their master, to fight for them for `life` seconds: each with `hp` of its own and a
   * blow of `dmg` (before its master's share) every so often that slows by `slow`% for a moment (their master's
   * doing, as far as a combo is concerned). They can be struck, held and killed like anyone.
   */
  | { k: 'raise'; n: number; hp: number; dmg: number; life: number; slow: number };

/**
 * A combo: when the target carries something this hero put on them (`ab`, by ability) or is held a certain way (`cc`),
 * this ability's numbers are multiplied by `mult`, `extra` lands too, and with `consume` what it needed is used up.
 */
export interface Combo {
  name: string;
  /** What it does, in words (shown under the ability's own text). */
  text: string;
  ab?: string[];
  cc?: CcKind[];
  mult: number;
  consume?: boolean;
  extra?: Effect[];
}

/**
 * Where an ability goes. `enemy` and `friend`: on one fighter, and it always lands. `near`: on every enemy round its
 * user. `ground`: on a patch of ground its user places, which everyone can see coming and step out of.
 */
export type Aim = 'enemy' | 'friend' | 'self' | 'near' | 'ground';
/** What the computer players read an ability as. */
export type Role = 'damage' | 'heal' | 'cc' | 'interrupt' | 'defense' | 'mobility' | 'dispel' | 'burst' | 'summon';

export interface Ability {
  id: string;
  cls: ClassId | 'any';
  name: string;
  text: string;
  /** Its icon, by its name in the pack. */
  icon: string;
  color: string;
  school: School;
  role: Role;
  aim: Aim;
  /** How far it reaches; for `near`, the circle around the caster. */
  range: number;
  /** Seconds to cast (standing still). */
  cast: number;
  /** Seconds a channel holds, ticking each `tick` (its effects land each tick). */
  channel?: number;
  tick?: number;
  cd: number;
  mana: number;
  /** Doesn't start or wait for the global cooldown. */
  free?: boolean;
  /** Can be used while stunned, feared or caught. */
  anyState?: boolean;
  /** Flies to its target and then lands (it follows them: nothing dodges it, and stone doesn't stop it once thrown). */
  bolt?: boolean;
  /** Lands at once, and is drawn crossing to its target in a streak (an arrow, a thrown hammer). */
  zip?: boolean;
  /**
   * `ground`: how wide the patch is (its radius), and how long it takes to land once placed. A patch is at least as
   * wide as a fighter walks in that time, so one placed on somebody lands on them unless they step (Swift Step) or
   * are quickened out of it: what is placed by a tap does not miss someone who only walks.
   */
  area?: number;
  fall?: number;
  /** Can't be taken off by a dispel. */
  sticky?: boolean;
  effects: Effect[];
  /** Two or three abilities working together: this one lands harder (and maybe more) when its conditions are met. */
  combo?: Combo;
  /** A class's super: no clock of its own, it's ready when the meter filled by fighting is full. */
  super?: boolean;
}

const MELEE = 30;
const SHORT = 80;
const MID = 130;
const FAR = 185;

const a = (d: Ability): Ability => d;

export const GCD = 0.75;
export const SLOTS = 4;


/** Everyone's, besides their four: a quick step out from under what is about to fall, or out of reach. */
export const DASH: Ability = a({ id: 'dash', cls: 'any', name: 'Swift Step', text: 'A quick step the way you’re going: out from under what is about to fall on you, or out of a blade’s reach.', icon: 'dodge_roll_arrow_on_teal', color: '#bff4ff', school: 'physical', role: 'mobility', aim: 'self', range: 0, cast: 0, cd: 5, mana: 0, free: true, effects: [{ k: 'dash', dist: 62 }] });

/** The sigil in the middle of the ground (not an ability anyone has: what it gives, for the pictures and the words). */
export const SIGIL: Ability = a({ id: 'sigil', cls: 'any', name: 'Sigil of Might', text: 'Heals a fifth of your life, fills your super meter by a third and quickens you.', icon: 'radiant_star_burst_on_gold', color: '#ffe27a', school: 'holy', role: 'heal', aim: 'self', range: 0, cast: 0, cd: 0, mana: 0, effects: [{ k: 'speed', pct: 30, dur: 4 }] });

/** Each class's super: one big, bright blow, ready when the meter filled by dealing and taking hurt is full. */
export const SUPERS: Record<ClassId, Ability> = {
  warrior: a({ id: 'w-super', cls: 'warrior', name: 'Quakebreaker', text: 'Slam the ground: 138 to everyone near you, thrown back and slowed by half for 3 seconds.', icon: 'ground_slam_crack_with_flying_rocks_on_brown', color: '#ffb45c', school: 'physical', role: 'burst', aim: 'near', range: 66, cast: 0, cd: 0, mana: 0, free: true, super: true, effects: [{ k: 'dmg', n: 150 }, { k: 'slow', pct: 50, dur: 3 }, { k: 'knock', dist: 70 }] }),
  mage: a({ id: 'm-super', cls: 'mage', name: 'Cinder Comet', text: 'Call a comet down on a patch of ground: 178 to everyone under it, stunned for 1 second. It takes a moment to fall.', icon: 'meteor_falling_with_flames_on_orange', color: '#ff7a1e', school: 'fire', role: 'burst', aim: 'ground', range: FAR, cast: 0, cd: 0, mana: 0, free: true, super: true, area: 60, fall: 0.8, effects: [{ k: 'dmg', n: 240 }, { k: 'cc', cc: 'stun', dur: 1 }] }),
  ranger: a({ id: 'r-super', cls: 'ranger', name: 'Skypierce Arrow', text: 'One great arrow: 172, and thrown back.', icon: 'piercing_arrow_through_a_shield_on_green', color: '#d8ff9a', school: 'physical', role: 'burst', aim: 'enemy', range: FAR, cast: 0, cd: 0, mana: 0, free: true, bolt: true, super: true, effects: [{ k: 'dmg', n: 220 }, { k: 'knock', dist: 60 }] }),
  priest: a({ id: 'p-super', cls: 'priest', name: 'Dawnward', text: 'Wings of light on a friend: heals 300 and soaks up 200 damage for 10 seconds.', icon: 'pair_of_white_wings_opening_on_gold', color: '#fff2b0', school: 'holy', role: 'heal', aim: 'friend', range: FAR, cast: 0, cd: 0, mana: 0, free: true, super: true, effects: [{ k: 'heal', n: 300 }, { k: 'absorb', n: 200, dur: 10 }] }),
  paladin: a({ id: 'd-super', cls: 'paladin', name: 'Sunhammer', text: 'A hammer of the sun: 167, and stunned for 1.5 seconds.', icon: 'hammer_of_light_with_golden_rays_on_gold', color: '#ffd84a', school: 'holy', role: 'burst', aim: 'enemy', range: MID, cast: 0, cd: 0, mana: 0, free: true, bolt: true, super: true, effects: [{ k: 'dmg', n: 190 }, { k: 'cc', cc: 'stun', dur: 1.5 }] }),
  warlock: a({ id: 'k-super', cls: 'warlock', name: 'Riftmaw', text: 'A rift tears the ground open where you choose: 90 to everyone on it, 108 more over 6 seconds, and slowed by half.', icon: 'dark_portal_on_black', color: '#b06aff', school: 'shadow', role: 'burst', aim: 'ground', range: FAR, cast: 0, cd: 0, mana: 0, free: true, super: true, area: 60, fall: 0.8, effects: [{ k: 'dmg', n: 100 }, { k: 'dot', n: 120, dur: 6 }, { k: 'slow', pct: 50, dur: 4 }] }),
  druid: a({ id: 'l-super', cls: 'druid', name: 'Thornstorm', text: 'Thorns burst up where you choose: 111 to everyone there, held to the ground for 1.5 seconds.', icon: 'thorn_burst_on_dark_green', color: '#9be86a', school: 'nature', role: 'burst', aim: 'ground', range: FAR, cast: 0, cd: 0, mana: 0, free: true, super: true, area: 60, fall: 0.8, effects: [{ k: 'dmg', n: 130 }, { k: 'cc', cc: 'root', dur: 1.5 }] }),
  gloamknight: a({ id: 'g-super', cls: 'gloamknight', name: 'Eclipse Reaping', text: 'Lunge through the dark and reap: 189, and you drink 100 of it.', icon: 'eclipse_sun_on_black', color: '#c8a8ff', school: 'shadow', role: 'burst', aim: 'enemy', range: FAR, cast: 0, cd: 0, mana: 0, free: true, sticky: true, super: true, effects: [{ k: 'charge' }, { k: 'dmg', n: 210 }, { k: 'heal', n: 100 }] }),
};
export const superOf = (cls: ClassId): Ability => SUPERS[cls];

const KITS: Record<ClassId, Ability[]> = {
  warrior: [
    a({ id: 'w-hew', cls: 'warrior', name: 'Hew', text: 'A heavy blow. The bread and butter.', icon: 'great_axe_with_a_bright_red_edge_on_red', color: '#f2ece0', school: 'physical', role: 'damage', aim: 'enemy', range: MELEE, cast: 0, cd: 0, mana: 0, combo: { name: 'Open Wound', text: 'Against a target bleeding from your Festering Gash or Rending Cut: 60% harder.', ab: ['w-gash', 'w-bleed'], mult: 1.6 }, effects: [{ k: 'dmg', n: 32 }] }),
    a({ id: 'w-gash', cls: 'warrior', name: 'Festering Gash', text: 'Hard blow. Healing on them is cut by 35% for 8 seconds.', icon: 'cut_status_scratch_on_red', color: '#c8324a', school: 'physical', role: 'burst', aim: 'enemy', range: MELEE, cast: 0, cd: 7, mana: 0, sticky: true, combo: { name: 'Executioner', text: 'Against a stunned target: 25% harder.', cc: ['stun'], mult: 1.25 }, effects: [{ k: 'dmg', n: 42 }, { k: 'antiheal', pct: 35, dur: 8 }] }),
    a({ id: 'w-rush', cls: 'warrior', name: 'Bull Rush', text: 'Rush to an enemy and slow them by 40% for 2 seconds.', icon: 'stomping_boot_with_a_quake_ring_on_brown', color: '#d8a860', school: 'physical', role: 'mobility', aim: 'enemy', range: FAR, cast: 0, cd: 9, mana: 0, free: true, effects: [{ k: 'charge' }, { k: 'slow', pct: 40, dur: 2 }] }),
    a({ id: 'w-crack', cls: 'warrior', name: 'Skull Crack', text: 'Cuts off a cast and locks that school for 4 seconds.', icon: 'sword_breaking_through_a_stone_wall_on_grey', color: '#ffb45c', school: 'physical', role: 'interrupt', aim: 'enemy', range: MELEE, cast: 0, cd: 7, mana: 0, free: true, effects: [{ k: 'interrupt', lock: 4 }] }),
    a({ id: 'w-hurl', cls: 'warrior', name: 'Hurled Maul', text: 'A thrown maul that stuns for 1 second.', icon: 'spinning_thrown_axe_with_motion_arcs_on_red', color: '#d8dce6', school: 'physical', role: 'cc', aim: 'enemy', range: MID, cast: 0, cd: 20, mana: 0, zip: true, effects: [{ k: 'dmg', n: 15 }, { k: 'cc', cc: 'stun', dur: 1 }] }),
    a({ id: 'w-hamstring', cls: 'warrior', name: 'Hock Cut', text: 'Slows them by 40% for 6 seconds, so they can’t get away.', icon: 'whirlwind_spin_of_three_blade_arcs_on_red', color: '#e8e8f4', school: 'physical', role: 'damage', aim: 'enemy', range: MELEE, cast: 0, cd: 5, mana: 0, combo: { name: 'Hamstrung', text: 'Against a target slowed by your Bull Rush: three times as hard.', ab: ['w-rush'], mult: 3 }, effects: [{ k: 'dmg', n: 23 }, { k: 'slow', pct: 40, dur: 6 }] }),
    a({ id: 'w-shout', cls: 'warrior', name: 'War Bellow', text: 'Every enemy near you flees in fear for 1.5 seconds.', icon: 'feared_status_face_on_violet', color: '#ff7a3d', school: 'physical', role: 'cc', aim: 'near', range: 54, cast: 0, cd: 25, mana: 0, effects: [{ k: 'cc', cc: 'fear', dur: 1.5 }] }),
    a({ id: 'w-stand', cls: 'warrior', name: 'Iron Stance', text: 'Take half damage for 8 seconds.', icon: 'defense_up_status_shield_arrow_up_on_blue', color: '#d8dce6', school: 'physical', role: 'defense', aim: 'self', range: 0, cast: 0, cd: 44, mana: 0, free: true, anyState: true, effects: [{ k: 'guard', pct: 50, dur: 8 }] }),
    a({ id: 'w-ward', cls: 'warrior', name: 'Mirror Guard', text: 'The next spell aimed at you within 5 seconds flies back.', icon: 'ice_mirror_on_cyan', color: '#bfeaff', school: 'physical', role: 'defense', aim: 'self', range: 0, cast: 0, cd: 12, mana: 0, free: true, effects: [{ k: 'reflect', dur: 5 }] }),
    a({ id: 'w-rage', cls: 'warrior', name: 'Red Mist', text: 'Deal 30% more damage for 10 seconds.', icon: 'strength_up_status_flexed_arm_on_red', color: '#ff4f6a', school: 'physical', role: 'burst', aim: 'self', range: 0, cast: 0, cd: 33, mana: 0, free: true, effects: [{ k: 'fury', pct: 30, dur: 10 }] }),
    a({ id: 'w-bleed', cls: 'warrior', name: 'Rending Cut', text: 'Opens a wound that bleeds 169 over 8 seconds.', icon: 'chain_of_three_slash_marks_on_red', color: '#c8324a', school: 'physical', role: 'damage', aim: 'enemy', range: MELEE, cast: 0, cd: 10, mana: 0, sticky: true, effects: [{ k: 'dot', n: 184, dur: 8 }] }),
    a({ id: 'w-free', cls: 'warrior', name: 'Unbowed', text: 'Shake off roots and slows, and be free of them for 6 seconds.', icon: 'haste_status_winged_boot_on_teal', color: '#ffe39a', school: 'physical', role: 'mobility', aim: 'self', range: 0, cast: 0, cd: 17, mana: 0, free: true, effects: [{ k: 'break' }, { k: 'free', dur: 6 }] }),
  ],
  // (every cast here is about 30% quicker than it was, and lands a little lighter for it, so a mage fires more often
  // without the damage running away: the owner, "mages cast time should definitely be reduced by at least 25%". Ember
  // Lash was 1.1 seconds and 92, Rime Spear 0.9 and 86, Toad Hex 0.9, Great Pyre 1 and 260. A cast under the global
  // cooldown's 0.75 is no quicker to follow, so Rime Spear lost the least)
  mage: [
    a({ id: 'm-lash', cls: 'mage', name: 'Ember Lash', text: 'A heavy lash of fire that leaves them Kindled: 23 more over 6 seconds.', icon: 'fire_comet_with_a_long_tail_on_navy', color: '#ff7a1e', school: 'fire', role: 'damage', aim: 'enemy', range: FAR, cast: 0.8, cd: 0, mana: 5, bolt: true, effects: [{ k: 'dmg', n: 77 }, { k: 'dot', n: 31, dur: 6 }] }),
    a({ id: 'm-spear', cls: 'mage', name: 'Rime Spear', text: 'A spear of ice that slows by 40% for 5 seconds.', icon: 'ice_spear_on_cyan', color: '#9fdcff', school: 'frost', role: 'damage', aim: 'enemy', range: FAR, cast: 0.6, cd: 0, mana: 4, bolt: true, combo: { name: 'Shatter', text: 'Against a target frozen to the ground or stunned: 80% harder.', cc: ['root', 'stun'], mult: 1.8 }, effects: [{ k: 'dmg', n: 71 }, { k: 'slow', pct: 40, dur: 5 }] }),
    a({ id: 'm-burn', cls: 'mage', name: 'Flashburn', text: 'An instant bolt of fire, on the move.', icon: 'flame_circle_on_the_ground_on_dark_red', color: '#ff6a2a', school: 'fire', role: 'damage', aim: 'enemy', range: MID, cast: 0, cd: 5, mana: 4, zip: true, combo: { name: 'Flashover', text: 'Against a target Kindled by your Ember Lash: 70% harder, and the Kindling is used up.', ab: ['m-lash'], mult: 1.7, consume: true }, effects: [{ k: 'dmg', n: 91 }] }),
    a({ id: 'm-toad', cls: 'mage', name: 'Toad Hex', text: 'A hex that flies at them and turns them into a toad for 3 seconds. Any damage breaks it.', icon: 'frog_jumping_on_teal', color: '#8bff6a', school: 'arcane', role: 'cc', aim: 'enemy', range: FAR, cast: 0.6, cd: 0, mana: 6, bolt: true, effects: [{ k: 'cc', cc: 'incap', dur: 3 }] }),
    a({ id: 'm-ring', cls: 'mage', name: 'Frost Snare', text: 'Everyone near you is frozen to the ground for 2 seconds.', icon: 'frost_nova_ring_on_blue', color: '#bfeaff', school: 'frost', role: 'cc', aim: 'near', range: 58, cast: 0, cd: 13, mana: 5, effects: [{ k: 'dmg', n: 14 }, { k: 'cc', cc: 'root', dur: 2 }] }),
    a({ id: 'm-snap', cls: 'mage', name: 'Spell Snap', text: 'Cuts off a cast at range and locks that school for 5 seconds.', icon: 'chain_lightning_between_three_dots_on_violet', color: '#b48cff', school: 'arcane', role: 'interrupt', aim: 'enemy', range: FAR, cast: 0, cd: 11, mana: 2, free: true, effects: [{ k: 'interrupt', lock: 5 }] }),
    a({ id: 'm-blink', cls: 'mage', name: 'Flicker', text: 'Vanish and appear ahead of you, free of what held you.', icon: 'three_small_fireballs_orbiting_on_red', color: '#c9b8ff', school: 'arcane', role: 'mobility', aim: 'self', range: 0, cast: 0, cd: 9, mana: 3, free: true, anyState: true, effects: [{ k: 'break' }, { k: 'blink', dist: 96 }] }),
    a({ id: 'm-prison', cls: 'mage', name: 'Ice Prison', text: 'Seal yourself in ice for 4 seconds: nothing touches you, and you can’t act.', icon: 'ice_prison_cage_on_cyan', color: '#bfeaff', school: 'frost', role: 'defense', aim: 'self', range: 0, cast: 0, cd: 45, mana: 0, free: true, anyState: true, effects: [{ k: 'immune', dur: 4, still: true }, { k: 'token' }] }),
    a({ id: 'm-shield', cls: 'mage', name: 'Mana Veil', text: 'Soaks up 170 damage for 15 seconds.', icon: 'water_bubble_shield_on_cyan', color: '#8fd8ff', school: 'arcane', role: 'defense', aim: 'self', range: 0, cast: 0, cd: 14, mana: 6, effects: [{ k: 'absorb', n: 170, dur: 15 }] }),
    a({ id: 'm-pyre', cls: 'mage', name: 'Great Pyre', text: 'A cast that brings a pyre down on a patch of ground: 192 to everyone under it. Don’t let them finish it.', icon: 'meteor_falling_with_flames_on_orange', color: '#ffb45c', school: 'fire', role: 'burst', aim: 'ground', range: FAR, cast: 0.7, cd: 9, mana: 12, combo: { name: 'Conflagration', text: 'Against a target Kindled by your Ember Lash: 40% harder.', ab: ['m-lash'], mult: 1.4 }, area: 48, fall: 0.4, effects: [{ k: 'dmg', n: 259 }] }),
    a({ id: 'm-steal', cls: 'mage', name: 'Arcane Shards', text: 'Instant shards of raw arcane, on the move.', icon: 'lightning_hourglass_on_violet', color: '#c9b8ff', school: 'arcane', role: 'damage', aim: 'enemy', range: FAR, cast: 0, cd: 8, mana: 4, zip: true, combo: { name: 'Fracture', text: 'Against a target slowed by your Rime Spear: 60% harder.', ab: ['m-spear'], mult: 1.6 }, effects: [{ k: 'dmg', n: 67 }] }),
    a({ id: 'm-chill', cls: 'mage', name: 'Hoar Grip', text: 'A shard of ice that stuns for 1.5 seconds.', icon: 'frost_hand_with_ice_on_blue', color: '#9fdcff', school: 'frost', role: 'cc', aim: 'enemy', range: MID, cast: 0, cd: 17, mana: 5, zip: true, effects: [{ k: 'cc', cc: 'stun', dur: 1.5 }] }),
  ],
  ranger: [
    a({ id: 'r-swift', cls: 'ranger', name: 'Swift Shot', text: 'An instant arrow, on the move.', icon: 'arrow_shot_with_a_speed_trail_on_green', color: '#d8ffb0', school: 'physical', role: 'damage', aim: 'enemy', range: FAR, cast: 0, cd: 0, mana: 0, zip: true, combo: { name: 'Falconer', text: 'Against a target your hawk has stunned: twice as hard.', ab: ['r-hawk'], mult: 2 }, effects: [{ k: 'dmg', n: 36 }] }),
    a({ id: 'r-aimed', cls: 'ranger', name: 'Long Draw', text: 'A long, heavy shot. Healing on them is cut by 35% for 6 seconds.', icon: 'piercing_arrow_through_a_shield_on_green', color: '#f6f2c8', school: 'physical', role: 'burst', aim: 'enemy', range: FAR, cast: 1.1, cd: 9, mana: 0, sticky: true, bolt: true, combo: { name: 'Venom Draw', text: 'Against a target poisoned by your Adder’s Kiss: 50% harder.', ab: ['r-venom'], mult: 1.5 }, effects: [{ k: 'dmg', n: 94 }, { k: 'antiheal', pct: 35, dur: 6 }] }),
    a({ id: 'r-venom', cls: 'ranger', name: 'Adder’s Kiss', text: 'Poisons them for 59 over 8 seconds.', icon: 'poison_arrow_with_green_drip_on_green', color: '#9ae85a', school: 'nature', role: 'damage', aim: 'enemy', range: FAR, cast: 0, cd: 8, mana: 0, zip: true, effects: [{ k: 'dot', n: 75, dur: 8 }] }),
    a({ id: 'r-trap', cls: 'ranger', name: 'Snapjaw Trap', text: 'Drop a trap at your feet: the first enemy on it is caught for 2.5 seconds.', icon: 'hunter_trap_with_jaws_on_brown', color: '#9a8a68', school: 'physical', role: 'cc', aim: 'self', range: 0, cast: 0, cd: 14, mana: 0, effects: [{ k: 'trap', cc: 'incap', dur: 2.5 }] }),
    a({ id: 'r-hush', cls: 'ranger', name: 'Hushing Arrow', text: 'Silences for 1.5 seconds, and cuts off a cast.', icon: 'rapid_fire_arrows_on_green', color: '#cfe0ff', school: 'physical', role: 'interrupt', aim: 'enemy', range: FAR, cast: 0, cd: 12, mana: 0, free: true, zip: true, effects: [{ k: 'interrupt', lock: 0 }, { k: 'cc', cc: 'silence', dur: 1.5 }] }),
    a({ id: 'r-hobble', cls: 'ranger', name: 'Hobbling Shot', text: 'An arrow that slows by 60% for 6 seconds.', icon: 'slowed_status_snail_on_teal', color: '#e8e0a8', school: 'physical', role: 'damage', aim: 'enemy', range: FAR, cast: 0, cd: 6, mana: 0, zip: true, combo: { name: 'Snare Shot', text: 'Against a target caught in your trap: 80% harder.', ab: ['r-trap'], mult: 1.8 }, effects: [{ k: 'dmg', n: 24 }, { k: 'slow', pct: 60, dur: 6 }] }),
    a({ id: 'r-leap', cls: 'ranger', name: 'Spring Away', text: 'Leap back, away from the nearest enemy.', icon: 'haste_status_winged_boot_on_teal', color: '#d8ffb0', school: 'physical', role: 'mobility', aim: 'self', range: 0, cast: 0, cd: 8, mana: 0, free: true, effects: [{ k: 'leap', dist: 92 }] }),
    a({ id: 'r-hawk', cls: 'ranger', name: 'Hawk’s Dive', text: 'Your hawk dives at them and stuns them for 1.5 seconds.', icon: 'hawk_companion_diving_on_teal', color: '#ffe39a', school: 'physical', role: 'cc', aim: 'enemy', range: FAR, cast: 0, cd: 17, mana: 0, zip: true, effects: [{ k: 'cc', cc: 'stun', dur: 1.5 }] }),
    a({ id: 'r-wind', cls: 'ranger', name: 'Serpent Volley', text: 'A volley of barbed arrows falls on a patch of ground: 76 to everyone under it, and 87 more over 6 seconds.', icon: 'wolf_howl_on_navy', color: '#8fe07a', school: 'nature', role: 'damage', aim: 'ground', range: FAR, cast: 0, cd: 10, mana: 0, combo: { name: 'Coiled Strike', text: 'Against a target slowed by your Hobbling Shot: 60% harder.', ab: ['r-hobble'], mult: 1.6 }, area: 42, fall: 0.55, effects: [{ k: 'dmg', n: 97 }, { k: 'dot', n: 112, dur: 6 }] }),
    a({ id: 'r-deter', cls: 'ranger', name: 'Turn Aside', text: 'Blows and arrows can’t touch you for 3 seconds.', icon: 'wolf_pack_on_navy', color: '#c8c8d8', school: 'physical', role: 'defense', aim: 'self', range: 0, cast: 0, cd: 44, mana: 0, free: true, anyState: true, effects: [{ k: 'immune', dur: 3, phys: true }] }),
    a({ id: 'r-scatter', cls: 'ranger', name: 'Blinding Powder', text: 'Blinds them for 1.5 seconds, at close range. Damage breaks it.', icon: 'blinded_status_eye_with_a_bar_on_black', color: '#f6e8a0', school: 'physical', role: 'cc', aim: 'enemy', range: SHORT, cast: 0, cd: 13, mana: 0, effects: [{ k: 'cc', cc: 'incap', dur: 1.5 }] }),
    a({ id: 'r-volley', cls: 'ranger', name: 'Arrow Storm', text: 'Pour arrows into them for 2.5 seconds, even on the move.', icon: 'rain_of_arrows_from_the_sky_on_brown', color: '#e8e0a8', school: 'physical', role: 'burst', aim: 'enemy', range: FAR, cast: 0, channel: 2.5, tick: 0.5, cd: 8, mana: 0, effects: [{ k: 'dmg', n: 42 }] }),
  ],
  priest: [
    a({ id: 'p-smite', cls: 'priest', name: 'Bright Rebuke', text: 'A lance of light at an enemy.', icon: 'golden_spear_of_light_on_gold', color: '#fff0a8', school: 'holy', role: 'damage', aim: 'enemy', range: FAR, cast: 1, cd: 0, mana: 4, bolt: true, combo: { name: 'Rotting Light', text: 'Against a target under your Word of Decay: 50% harder.', ab: ['p-curse'], mult: 1.5 }, effects: [{ k: 'dmg', n: 56 }] }),
    a({ id: 'p-mend', cls: 'priest', name: 'Knit Wounds', text: 'A steady heal.', icon: 'two_open_hands_holding_light_on_gold', color: '#b8ffb8', school: 'holy', role: 'heal', aim: 'friend', range: FAR, cast: 0.9, cd: 0, mana: 5, combo: { name: 'Mending Light', text: 'On a friend under your Dawnlight: heals 40% more.', ab: ['p-renew'], mult: 1.4 }, effects: [{ k: 'heal', n: 95 }] }),
    a({ id: 'p-greater', cls: 'priest', name: 'Deep Mending', text: 'A long cast and a great heal. A target for their interrupt.', icon: 'golden_heart_with_white_wings_on_gold', color: '#ffe9a0', school: 'holy', role: 'heal', aim: 'friend', range: FAR, cast: 1.2, cd: 5, mana: 10, effects: [{ k: 'heal', n: 230 }] }),
    a({ id: 'p-renew', cls: 'priest', name: 'Dawnlight', text: 'Heals 114 over 10 seconds, on the move.', icon: 'sunrise_over_a_hill_on_gold', color: '#fff0a8', school: 'holy', role: 'heal', aim: 'friend', range: FAR, cast: 0, cd: 0, mana: 4, effects: [{ k: 'hot', n: 114, dur: 10 }] }),
    a({ id: 'p-ward', cls: 'priest', name: 'Ward of Faith', text: 'Soaks up 98 damage on a friend.', icon: 'golden_halo_ring_over_a_helmet_on_gold', color: '#fff2b0', school: 'holy', role: 'defense', aim: 'friend', range: FAR, cast: 0, cd: 7, mana: 5, effects: [{ k: 'absorb', n: 98, dur: 15 }] }),
    a({ id: 'p-wail', cls: 'priest', name: 'Wail of Dread', text: 'Every enemy near you flees for 2 seconds.', icon: 'frightened_status_bat_on_black', color: '#a060ff', school: 'shadow', role: 'cc', aim: 'near', range: 58, cast: 0, cd: 18, mana: 4, effects: [{ k: 'cc', cc: 'fear', dur: 2 }] }),
    a({ id: 'p-cleanse', cls: 'priest', name: 'Clearing Word', text: 'Takes one curse, poison or hex off a friend.', icon: 'holy_ground_status_light_circle_on_gold', color: '#e8fff8', school: 'holy', role: 'dispel', aim: 'friend', range: FAR, cast: 0, cd: 6, mana: 3, effects: [{ k: 'dispel' }] }),
    a({ id: 'p-curse', cls: 'priest', name: 'Word of Decay', text: 'A curse that burns 101 over 10 seconds.', icon: 'dark_flame_on_violet', color: '#a060ff', school: 'shadow', role: 'damage', aim: 'enemy', range: FAR, cast: 0, cd: 6, mana: 3, effects: [{ k: 'dot', n: 130, dur: 10 }] }),
    a({ id: 'p-hush', cls: 'priest', name: 'Word of Silence', text: 'Silences for 2 seconds, and cuts off a cast.', icon: 'silenced_status_muted_bell_on_violet', color: '#c88aff', school: 'shadow', role: 'interrupt', aim: 'enemy', range: MID, cast: 0, cd: 20, mana: 3, free: true, effects: [{ k: 'interrupt', lock: 0 }, { k: 'cc', cc: 'silence', dur: 2 }] }),
    a({ id: 'p-tear', cls: 'priest', name: 'Strip Bare', text: 'Tears one blessing off an enemy.', icon: 'beam_of_light_from_the_sky_on_gold', color: '#fff0a8', school: 'holy', role: 'dispel', aim: 'enemy', range: FAR, cast: 0, cd: 10, mana: 3, effects: [{ k: 'dispel' }] }),
    a({ id: 'p-grace', cls: 'priest', name: 'Last Grace', text: 'For 10 seconds a friend’s killing blow leaves them alive, with a third of their life.', icon: 'radiant_star_burst_on_gold', color: '#ffe48a', school: 'holy', role: 'defense', aim: 'friend', range: FAR, cast: 0, cd: 45, mana: 5, free: true, effects: [{ k: 'lastgrace', dur: 10, heal: 33 }] }),
    a({ id: 'p-lance', cls: 'priest', name: 'Sun Lance', text: 'A lance of sun falls on a patch of ground: 42 to everyone under it.', icon: 'golden_scales_of_justice_on_gold', color: '#ffe48a', school: 'holy', role: 'damage', aim: 'ground', range: MID, cast: 0, cd: 8, mana: 4, combo: { name: 'Judgment', text: 'Against a target fleeing your Wail of Dread: 80% harder.', ab: ['p-wail'], mult: 1.8 }, area: 38, fall: 0.5, effects: [{ k: 'dmg', n: 54 }] }),
  ],
  paladin: [
    a({ id: 'd-blow', cls: 'paladin', name: 'Oath Blow', text: 'A heavy blow, full of light.', icon: 'holy_sword_with_light_rays_on_gold', color: '#fff2b0', school: 'holy', role: 'damage', aim: 'enemy', range: MELEE, cast: 0, cd: 0, mana: 0, combo: { name: 'Righteous Blow', text: 'Against a target slowed by your Verdict: 60% harder.', ab: ['d-judge'], mult: 1.6 }, effects: [{ k: 'dmg', n: 29 }] }),
    a({ id: 'd-judge', cls: 'paladin', name: 'Verdict', text: 'Light strikes them from afar. Slows by 30% for 4 seconds.', icon: 'golden_scales_of_justice_on_gold', color: '#fff0a8', school: 'holy', role: 'damage', aim: 'enemy', range: MID, cast: 0, cd: 6, mana: 2, zip: true, combo: { name: 'Final Verdict', text: 'Against a stunned target: 80% harder.', cc: ['stun'], mult: 1.8 }, effects: [{ k: 'dmg', n: 44 }, { k: 'slow', pct: 30, dur: 4 }] }),
    a({ id: 'd-flash', cls: 'paladin', name: 'Dawn’s Touch', text: 'A quick heal.', icon: 'healing_hand_with_green_gold_sparkles_on_gold', color: '#b8ffb8', school: 'holy', role: 'heal', aim: 'friend', range: FAR, cast: 0.8, cd: 0, mana: 5, effects: [{ k: 'heal', n: 99 }] }),
    a({ id: 'd-hammer', cls: 'paladin', name: 'Hammer of Oaths', text: 'A thrown hammer that stuns for 1.5 seconds.', icon: 'hammer_of_light_with_golden_rays_on_gold', color: '#ffe48a', school: 'holy', role: 'cc', aim: 'enemy', range: MID, cast: 0, cd: 20, mana: 3, zip: true, effects: [{ k: 'cc', cc: 'stun', dur: 1.5 }] }),
    a({ id: 'd-shell', cls: 'paladin', name: 'Dawn Shell', text: 'Nothing can touch you for 4 seconds.', icon: 'white_light_shield_bubble_on_gold', color: '#ffe9a0', school: 'holy', role: 'defense', aim: 'self', range: 0, cast: 0, cd: 45, mana: 0, free: true, anyState: true, effects: [{ k: 'token' }, { k: 'immune', dur: 4 }] }),
    a({ id: 'd-unchain', cls: 'paladin', name: 'Blessed Hammer', text: 'A hammer of light thrown at an enemy.', icon: 'radiant_crown_of_light_on_gold', color: '#ffe39a', school: 'holy', role: 'damage', aim: 'enemy', range: MID, cast: 0, cd: 8, mana: 2, zip: true, combo: { name: 'Hammerfall', text: 'Against a target stunned by your Hammer of Oaths: twice as hard.', ab: ['d-hammer'], mult: 2 }, effects: [{ k: 'dmg', n: 58 }] }),
    a({ id: 'd-shelter', cls: 'paladin', name: 'Oath of Shelter', text: 'Blows can’t touch a friend for 4 seconds.', icon: 'raised_shield_blocking_an_arrow_on_blue', color: '#ffe9a0', school: 'holy', role: 'defense', aim: 'friend', range: FAR, cast: 0, cd: 45, mana: 4, free: true, effects: [{ k: 'immune', dur: 4, phys: true }] }),
    a({ id: 'd-cleanse', cls: 'paladin', name: 'Cleansing Oath', text: 'Takes one curse, poison or hex off a friend.', icon: 'holy_ground_status_light_circle_on_gold', color: '#e8fff8', school: 'holy', role: 'dispel', aim: 'friend', range: FAR, cast: 0, cd: 6, mana: 3, effects: [{ k: 'dispel' }] }),
    a({ id: 'd-rebuke', cls: 'paladin', name: 'Stern Word', text: 'Cuts off a cast and locks that school for 4 seconds.', icon: 'sword_planted_with_a_light_circle_on_gold', color: '#ffc76a', school: 'holy', role: 'interrupt', aim: 'enemy', range: MELEE, cast: 0, cd: 8, mana: 0, free: true, effects: [{ k: 'interrupt', lock: 4 }] }),
    a({ id: 'd-repent', cls: 'paladin', name: 'Moment of Shame', text: 'Dazes them for 2.5 seconds. Any damage breaks it.', icon: 'light_pillar_on_a_round_altar_on_gold', color: '#fff0a8', school: 'holy', role: 'cc', aim: 'enemy', range: MID, cast: 0.7, cd: 12, mana: 4, bolt: true, effects: [{ k: 'cc', cc: 'incap', dur: 2.5 }] }),
    a({ id: 'd-wrath', cls: 'paladin', name: 'Wave of Dawn', text: 'Burns everyone near you and throws them back.', icon: 'radiant_star_burst_on_gold', color: '#ffc76a', school: 'holy', role: 'burst', aim: 'near', range: 54, cast: 0, cd: 10, mana: 3, combo: { name: 'Dawnbreak', text: 'Against a stunned target: 50% harder.', cc: ['stun'], mult: 1.5 }, effects: [{ k: 'dmg', n: 52 }, { k: 'knock', dist: 46 }] }),
    a({ id: 'd-hands', cls: 'paladin', name: 'Laying On', text: 'Heals a friend for a third of a life, once in a long while.', icon: 'golden_heart_with_white_wings_on_gold', color: '#fff2b0', school: 'holy', role: 'heal', aim: 'friend', range: MID, cast: 0, cd: 45, mana: 0, free: true, anyState: false, effects: [{ k: 'heal', n: 333 }] }),
  ],
  warlock: [
    a({ id: 'k-bolt', cls: 'warlock', name: 'Gloom Bolt', text: 'A heavy bolt of shadow.', icon: 'dark_meteor_on_violet', color: '#a060ff', school: 'shadow', role: 'damage', aim: 'enemy', range: FAR, cast: 1.1, cd: 0, mana: 5, bolt: true, combo: { name: 'Gloomfire', text: 'Against a fleeing target: 60% harder.', cc: ['fear'], mult: 1.6 }, effects: [{ k: 'dmg', n: 70 }] }),
    a({ id: 'k-agony', cls: 'warlock', name: 'Creeping Agony', text: 'A curse that burns 167 over 12 seconds.', icon: 'poison_cloud_on_green', color: '#9ae85a', school: 'shadow', role: 'damage', aim: 'enemy', range: FAR, cast: 0, cd: 4, mana: 3, effects: [{ k: 'dot', n: 185, dur: 12 }] }),
    a({ id: 'k-wither', cls: 'warlock', name: 'Wither', text: 'A curse that burns 82 over 8 seconds and slows by 30%.', icon: 'dark_flame_on_violet', color: '#c88aff', school: 'shadow', role: 'damage', aim: 'enemy', range: FAR, cast: 0, cd: 8, mana: 3, combo: { name: 'Deep Rot', text: 'Against a target with your Barbed Curse on them: 50% harder.', ab: ['k-unstable'], mult: 1.5 }, effects: [{ k: 'dot', n: 91, dur: 8 }, { k: 'slow', pct: 30, dur: 8 }] }),
    a({ id: 'k-dread', cls: 'warlock', name: 'Dread Gaze', text: 'A bolt of dread sends them fleeing for 1.5 seconds. Hurt them enough and it breaks.', icon: 'dark_star_on_black', color: '#a060ff', school: 'shadow', role: 'cc', aim: 'enemy', range: FAR, cast: 0.9, cd: 0, mana: 6, bolt: true, effects: [{ k: 'cc', cc: 'fear', dur: 1.5 }] }),
    a({ id: 'k-howl', cls: 'warlock', name: 'Howl of the Pit', text: 'Every enemy near you flees for 2 seconds.', icon: 'shadow_imp_summon_on_black', color: '#ff7a3d', school: 'shadow', role: 'cc', aim: 'near', range: 58, cast: 0, cd: 20, mana: 4, effects: [{ k: 'cc', cc: 'fear', dur: 2 }] }),
    a({ id: 'k-drain', cls: 'warlock', name: 'Soul Drink', text: 'Drain their life into yours for 3 seconds.', icon: 'bound_spirit_chain_on_teal', color: '#c88aff', school: 'shadow', role: 'heal', aim: 'enemy', range: FAR, cast: 0, channel: 3, tick: 0.5, cd: 10, mana: 5, effects: [{ k: 'dmg', n: 26 }, { k: 'heal', n: 26 }] }),
    a({ id: 'k-lock', cls: 'warlock', name: 'Spell Seal', text: 'Cuts off a cast at range and locks that school for 5 seconds.', icon: 'summoning_circle_on_violet', color: '#c88aff', school: 'shadow', role: 'interrupt', aim: 'enemy', range: FAR, cast: 0, cd: 12, mana: 2, free: true, effects: [{ k: 'interrupt', lock: 5 }] }),
    a({ id: 'k-step', cls: 'warlock', name: 'Darkstride', text: 'Step through the dark and appear ahead of you.', icon: 'dark_portal_on_black', color: '#7a50c8', school: 'shadow', role: 'mobility', aim: 'self', range: 0, cast: 0, cd: 12, mana: 3, free: true, anyState: false, effects: [{ k: 'break' }, { k: 'blink', dist: 110 }] }),
    a({ id: 'k-unstable', cls: 'warlock', name: 'Barbed Curse', text: 'Burns 92 over 8 seconds. Whoever takes it off is silenced for 4 seconds.', icon: 'ring_of_fire_on_black', color: '#ff7a3d', school: 'shadow', role: 'damage', aim: 'enemy', range: FAR, cast: 0.7, cd: 10, mana: 4, combo: { name: 'Hex Bloom', text: 'Against a target with your Creeping Agony on them: 80% harder, and 54 more at once.', ab: ['k-agony'], mult: 1.8, extra: [{ k: 'dmg', n: 60 }] }, effects: [{ k: 'dot', n: 102, dur: 8 }, { k: 'backlash', dur: 4 }] }),
    a({ id: 'k-chaos', cls: 'warlock', name: 'Ruin', text: 'A long cast that lands like a hammer.', icon: 'dark_meteor_on_violet', color: '#8bff6a', school: 'fire', role: 'burst', aim: 'enemy', range: FAR, cast: 1.5, cd: 8, mana: 10, bolt: true, combo: { name: 'Doom', text: 'Against a target with your Creeping Agony on them: 50% harder.', ab: ['k-agony'], mult: 1.5 }, effects: [{ k: 'dmg', n: 171 }] }),
    a({ id: 'k-pact', cls: 'warlock', name: 'Black Bargain', text: 'Soaks up 190 damage for 15 seconds.', icon: 'cursed_amulet_on_violet', color: '#7a50c8', school: 'shadow', role: 'defense', aim: 'self', range: 0, cast: 0, cd: 17, mana: 6, effects: [{ k: 'absorb', n: 190, dur: 15 }] }),
    a({ id: 'k-resolve', cls: 'warlock', name: 'Dread Resolve', text: 'Take 40% less damage for 8 seconds.', icon: 'dark_star_on_black', color: '#a060ff', school: 'shadow', role: 'defense', aim: 'self', range: 0, cast: 0, cd: 44, mana: 0, free: true, anyState: true, effects: [{ k: 'guard', pct: 40, dur: 8 }] }),
  ],
  druid: [
    a({ id: 'l-lash', cls: 'druid', name: 'Starlash', text: 'A bolt of cold starlight.', icon: 'moonfire_beam_on_navy', color: '#cfe0ff', school: 'nature', role: 'damage', aim: 'enemy', range: FAR, cast: 1, cd: 0, mana: 5, bolt: true, combo: { name: 'Eclipse', text: 'Against a target with your Moonburn on them: 50% harder.', ab: ['l-moon'], mult: 1.5 }, effects: [{ k: 'dmg', n: 83 }] }),
    a({ id: 'l-regrow', cls: 'druid', name: 'Green Mending', text: 'A heal that keeps on healing: 90, and 72 more over 6 seconds.', icon: 'rejuvenate_leaf_drop_on_green', color: '#b8ffb8', school: 'nature', role: 'heal', aim: 'friend', range: FAR, cast: 0.9, cd: 0, mana: 6, effects: [{ k: 'heal', n: 90 }, { k: 'hot', n: 72, dur: 6 }] }),
    a({ id: 'l-rejuv', cls: 'druid', name: 'Budding', text: 'Heals 168 over 12 seconds, on the move.', icon: 'regeneration_status_green_leaf_on_green', color: '#a8e85a', school: 'nature', role: 'heal', aim: 'friend', range: FAR, cast: 0, cd: 0, mana: 4, effects: [{ k: 'hot', n: 168, dur: 12 }] }),
    a({ id: 'l-bloom', cls: 'druid', name: 'Quick Bloom', text: 'An instant heal in a tight spot.', icon: 'heart_with_green_gold_sparkles_on_gold', color: '#ffb8e8', school: 'nature', role: 'heal', aim: 'friend', range: FAR, cast: 0, cd: 8, mana: 7, combo: { name: 'Blossom', text: 'On a friend under your Budding: heals 60% more, and the Budding is used up.', ab: ['l-rejuv'], mult: 1.6, consume: true }, effects: [{ k: 'heal', n: 180 }] }),
    a({ id: 'l-bark', cls: 'druid', name: 'Oakhide', text: 'Take 40% less damage for 10 seconds, even held.', icon: 'stag_head_with_antlers_on_green', color: '#c8a868', school: 'nature', role: 'defense', aim: 'self', range: 0, cast: 0, cd: 28, mana: 0, free: true, anyState: true, effects: [{ k: 'guard', pct: 40, dur: 10 }] }),
    a({ id: 'l-roots', cls: 'druid', name: 'Grasping Roots', text: 'Holds them to the ground for 2.5 seconds. Hurt them enough and it breaks.', icon: 'rooted_status_vines_on_green', color: '#7ad65a', school: 'nature', role: 'cc', aim: 'enemy', range: FAR, cast: 0.8, cd: 3, mana: 4, effects: [{ k: 'cc', cc: 'root', dur: 2.5 }] }),
    a({ id: 'l-gale', cls: 'druid', name: 'Whirling Gale', text: 'Lifts them into a wind for 2 seconds: they can’t act, and nothing touches them.', icon: 'crescent_moon_behind_clouds_on_navy', color: '#e8e8f4', school: 'nature', role: 'cc', aim: 'enemy', range: FAR, cast: 1, cd: 7, mana: 5, sticky: true, effects: [{ k: 'cc', cc: 'incap', dur: 2 }, { k: 'immune', dur: 2 }] }),
    a({ id: 'l-bash', cls: 'druid', name: 'Great Paw', text: 'Stuns for 1.5 seconds, at close range.', icon: 'bear_form_claw_on_brown', color: '#e8d0a8', school: 'physical', role: 'cc', aim: 'enemy', range: SHORT, cast: 0, cd: 14, mana: 2, effects: [{ k: 'cc', cc: 'stun', dur: 1.5 }] }),
    a({ id: 'l-snap', cls: 'druid', name: 'Thornsnap', text: 'Cuts off a cast at range and locks that school for 4 seconds.', icon: 'thorn_arrow_on_dark_green', color: '#a8e85a', school: 'nature', role: 'interrupt', aim: 'enemy', range: FAR, cast: 0, cd: 10, mana: 2, free: true, effects: [{ k: 'interrupt', lock: 4 }] }),
    a({ id: 'l-bound', cls: 'druid', name: 'Stag’s Bound', text: 'Run 60% faster for 4 seconds, free of roots.', icon: 'stag_head_with_antlers_on_green', color: '#c8ffb0', school: 'nature', role: 'mobility', aim: 'self', range: 0, cast: 0, cd: 13, mana: 2, free: true, anyState: false, effects: [{ k: 'break' }, { k: 'speed', pct: 60, dur: 4 }, { k: 'free', dur: 4 }] }),
    a({ id: 'l-moon', cls: 'druid', name: 'Moonburn', text: 'Instant: burns 145 over 10 seconds.', icon: 'moonfire_beam_on_navy', color: '#cfe0ff', school: 'nature', role: 'damage', aim: 'enemy', range: FAR, cast: 0, cd: 5, mana: 3, combo: { name: 'Lunar Wind', text: 'Against a target lifted in your Whirling Gale: burns twice as much.', ab: ['l-gale'], mult: 2 }, effects: [{ k: 'dot', n: 170, dur: 10 }] }),
    a({ id: 'l-cure', cls: 'druid', name: 'Forest’s Cure', text: 'Takes one curse, poison or hex off a friend.', icon: 'rejuvenate_leaf_drop_on_green', color: '#e8fff8', school: 'nature', role: 'dispel', aim: 'friend', range: FAR, cast: 0, cd: 6, mana: 3, effects: [{ k: 'dispel' }] }),
  ],
  // (its pictures are all of the dark and the violet: one look for the whole bar, where it had a red sword, a green
  // grave and an orange lantern among them)
  gloamknight: [
    a({ id: 'g-cleave', cls: 'gloamknight', name: 'Gloam Cleave', text: 'A heavy two-handed blow that drinks a little of what it spills.', icon: 'dark_scythe_on_violet', color: '#c8a8ff', school: 'shadow', role: 'damage', aim: 'enemy', range: MELEE, cast: 0, cd: 0, mana: 0, sticky: true, combo: { name: 'Grave Cut', text: 'Against a stunned target: twice as hard.', cc: ['stun'], mult: 2 }, effects: [{ k: 'dmg', n: 31 }, { k: 'heal', n: 4 }] }),
    a({ id: 'g-reap', cls: 'gloamknight', name: 'Night Reaping', text: 'A great blow that heals you for a fifth of what it deals.', icon: 'giant_reaper_silhouette_on_black', color: '#9a6ae0', school: 'shadow', role: 'burst', aim: 'enemy', range: MELEE, cast: 0, cd: 9, mana: 0, sticky: true, combo: { name: 'Harvest', text: 'Against a target slowed by your Shadow Lunge: 60% harder.', ab: ['g-lunge'], mult: 1.6 }, effects: [{ k: 'dmg', n: 62 }, { k: 'heal', n: 12 }] }),
    // (the dead at his call, in Blood Price's place: the owner, "gloamknight's idea is to summon undeads". What they
    // are and how they fight is the rules' own: THRALL in sim.ts)
    a({ id: 'g-ashbound', cls: 'gloamknight', name: 'Call the Ashbound', text: 'Two of the ashbound dead claw up out of the ground to fight beside you for 12 seconds. They go for your target, and each claw does 9 and slows by 20%. They can be cut down.', icon: 'dark_crystal_skull_on_violet', color: '#9a6ae0', school: 'shadow', role: 'summon', aim: 'self', range: 0, cast: 0, cd: 35, mana: 0, effects: [{ k: 'raise', n: 2, hp: 140, dmg: 10, life: 12, slow: 20 }] }),
    a({ id: 'g-gloom', cls: 'gloamknight', name: 'Clinging Gloom', text: 'Shadow clings to them: 95 over 9 seconds, and slows by 30%.', icon: 'cursed_status_dark_cloud_on_violet', color: '#b48cff', school: 'shadow', role: 'damage', aim: 'enemy', range: MID, cast: 0, cd: 9, mana: 0, effects: [{ k: 'dot', n: 105, dur: 9 }, { k: 'slow', pct: 30, dur: 9 }] }),
    a({ id: 'g-lunge', cls: 'gloamknight', name: 'Shadow Lunge', text: 'Lunge through the dark to an enemy and slow them by half for 4 seconds.', icon: 'shadow_dash_streak_on_black', color: '#7a52b0', school: 'shadow', role: 'mobility', aim: 'enemy', range: FAR, cast: 0, cd: 10, mana: 0, free: true, effects: [{ k: 'charge' }, { k: 'slow', pct: 50, dur: 4 }] }),
    a({ id: 'g-sever', cls: 'gloamknight', name: 'Severing Edge', text: 'Cuts off a cast and locks that school for 4 seconds.', icon: 'hidden_blade_from_a_sleeve_on_violet', color: '#c8a8ff', school: 'physical', role: 'interrupt', aim: 'enemy', range: MELEE, cast: 0, cd: 8, mana: 0, free: true, effects: [{ k: 'interrupt', lock: 4 }] }),
    a({ id: 'g-hand', cls: 'gloamknight', name: 'Grave Hand', text: 'A hand of shadow holds them fast: stunned for 1.5 seconds.', icon: 'shadow_hand_grabbing_on_violet', color: '#9a6ae0', school: 'shadow', role: 'cc', aim: 'enemy', range: MID, cast: 0, cd: 17, mana: 0, effects: [{ k: 'cc', cc: 'stun', dur: 1.5 }] }),
    a({ id: 'g-toll', cls: 'gloamknight', name: 'Dread Toll', text: 'A toll of dusk: every enemy near you flees for 2 seconds.', icon: 'bat_swarm_on_violet', color: '#b48cff', school: 'shadow', role: 'cc', aim: 'near', range: 54, cast: 0, cd: 22, mana: 0, effects: [{ k: 'cc', cc: 'fear', dur: 2 }] }),
    a({ id: 'g-ward', cls: 'gloamknight', name: 'Hollow Ward', text: 'Pay 100 of your own health for a ward that soaks up 260 damage for 10 seconds.', icon: 'dark_orb_on_violet', color: '#c0344e', school: 'shadow', role: 'defense', aim: 'self', range: 0, cast: 0, cd: 18, mana: 0, free: true, effects: [{ k: 'price', n: 100 }, { k: 'absorb', n: 260, dur: 10 }] }),
    a({ id: 'g-mantle', cls: 'gloamknight', name: 'Night Mantle', text: 'Take 40% less damage for 8 seconds, even held.', icon: 'shadow_veil_curtain_on_violet', color: '#7a52b0', school: 'shadow', role: 'defense', aim: 'self', range: 0, cast: 0, cd: 44, mana: 0, free: true, anyState: true, effects: [{ k: 'guard', pct: 40, dur: 8 }] }),
    a({ id: 'g-devour', cls: 'gloamknight', name: 'Umbral Burst', text: 'Shadow bursts out of them at once.', icon: 'dark_explosion_on_violet', color: '#9a6ae0', school: 'shadow', role: 'damage', aim: 'enemy', range: MID, cast: 0, cd: 8, mana: 0, combo: { name: 'Consume', text: 'Against a target under your Clinging Gloom: 80% harder, and the Gloom is used up.', ab: ['g-gloom'], mult: 1.8, consume: true }, effects: [{ k: 'dmg', n: 72 }] }),
    a({ id: 'g-slip', cls: 'gloamknight', name: 'Dusk Rend', text: 'A tearing blow: 41, and 63 more over 6 seconds.', icon: 'shadow_claw_slash_on_black', color: '#c8a8ff', school: 'shadow', role: 'damage', aim: 'enemy', range: MELEE, cast: 0, cd: 10, mana: 0, sticky: true, combo: { name: 'Gloomfall', text: 'Against a fleeing target, or one your ashbound are clawing at: twice as hard.', ab: ['g-ashbound'], cc: ['fear'], mult: 2 }, effects: [{ k: 'dmg', n: 45 }, { k: 'dot', n: 70, dur: 6 }] }),
  ],
};

export const ABILITIES: Record<string, Ability> = Object.fromEntries([...Object.values(KITS).flat(), ...Object.values(SUPERS), DASH, SIGIL].map((x) => [x.id, x]));
export const kitOf = (cls: ClassId): Ability[] => KITS[cls];

/**
 * How each class is built before anything is chosen. (The three who fight at arm's length carry about 5% more than
 * they did: the owner found them a little behind, and they spend part of every fight walking to it.)
 */
export const BODY: Record<ClassId, { hp: number; mana: number }> = {
  warrior: { hp: 1320, mana: 0 },
  paladin: { hp: 1310, mana: 100 },
  druid: { hp: 1280, mana: 100 },
  ranger: { hp: 1260, mana: 0 },
  priest: { hp: 1070, mana: 100 },
  warlock: { hp: 1200, mana: 100 },
  mage: { hp: 1200, mana: 100 },
  gloamknight: { hp: 1290, mana: 0 },
};

/** Ready-made bars: what a hero brings before their player changes anything, and what the computer plays. */
export const PRESETS: Record<ClassId, { id: string; name: string; bar: string[]; talents: string[] }[]> = {
  warrior: [{ id: 'arms', name: 'Reaper', bar: ['w-hew', 'w-gash', 'w-rush', 'w-hurl'], talents: ['w-1b', 'w-2c', 'w-3c'] }, { id: 'pin', name: 'Hound', bar: ['w-hew', 'w-bleed', 'w-hamstring', 'w-rush'], talents: ['w-1a', 'w-2a', 'w-3b'] }],
  mage: [{ id: 'fire', name: 'Pyre', bar: ['m-lash', 'm-burn', 'm-pyre', 'm-blink'], talents: ['m-1a', 'm-2b', 'm-3b'] }, { id: 'frost', name: 'Rime', bar: ['m-spear', 'm-steal', 'm-ring', 'm-chill'], talents: ['m-1b', 'm-2a', 'm-3a'] }],
  ranger: [{ id: 'sniper', name: 'Longbow', bar: ['r-swift', 'r-aimed', 'r-venom', 'r-hawk'], talents: ['r-1b', 'r-2c', 'r-3a'] }, { id: 'trapper', name: 'Trapper', bar: ['r-swift', 'r-hobble', 'r-wind', 'r-trap'], talents: ['r-1a', 'r-2a', 'r-3b'] }],
  priest: [{ id: 'healer', name: 'Lifegiver', bar: ['p-mend', 'p-renew', 'p-ward', 'p-lance'], talents: ['p-1a', 'p-2b', 'p-3a'] }, { id: 'shadow', name: 'Curse-speaker', bar: ['p-smite', 'p-curse', 'p-lance', 'p-wail'], talents: ['p-1a', 'p-2c', 'p-3c'] }],
  paladin: [{ id: 'holy', name: 'Oathkeeper', bar: ['d-flash', 'd-hands', 'd-hammer', 'd-judge'], talents: ['d-1b', 'd-2c', 'd-3b'] }, { id: 'ret', name: 'Zealot', bar: ['d-blow', 'd-judge', 'd-wrath', 'd-hammer'], talents: ['d-1a', 'd-2a', 'd-3a'] }],
  warlock: [{ id: 'curses', name: 'Hexer', bar: ['k-agony', 'k-wither', 'k-unstable', 'k-dread'], talents: ['k-1b', 'k-2a', 'k-3a'] }, { id: 'ruin', name: 'Doomcaller', bar: ['k-bolt', 'k-chaos', 'k-agony', 'k-howl'], talents: ['k-1a', 'k-2c', 'k-3c'] }],
  druid: [{ id: 'heal', name: 'Grovekeeper', bar: ['l-regrow', 'l-rejuv', 'l-bloom', 'l-moon'], talents: ['l-1a', 'l-2b', 'l-3a'] }, { id: 'star', name: 'Starseer', bar: ['l-lash', 'l-moon', 'l-gale', 'l-roots'], talents: ['l-1a', 'l-2a', 'l-3c'] }],
  gloamknight: [{ id: 'reaver', name: 'Bloodsworn', bar: ['g-cleave', 'g-reap', 'g-lunge', 'g-hand'], talents: ['g-1a', 'g-2a', 'g-3b'] }, { id: 'dread', name: 'Dreadbinder', bar: ['g-gloom', 'g-devour', 'g-slip', 'g-ashbound'], talents: ['g-1b', 'g-2b', 'g-3a'] }],
};

/**
 * A bar as it can be fought with: only its class's own abilities (an id from an older game, or one taken out since, is
 * dropped), each once, four at most, topped up from the class's first ready-made bar and then its kit so that it is
 * always full. What a saved setup and a room's pick are read through, at both ends of a room alike.
 */
export function fullBar(cls: ClassId, bar: readonly unknown[] | undefined): string[] {
  const own = (id: unknown): id is string => typeof id === 'string' && ABILITIES[id]?.cls === cls && !ABILITIES[id]!.super;
  const out: string[] = [];
  for (const id of [...(Array.isArray(bar) ? bar : []), ...PRESETS[cls][0]!.bar, ...KITS[cls].map((x) => x.id)]) {
    if (out.length >= SLOTS) break;
    if (own(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Does `from` set up the combo `to` lands: by leaving its own mark on the target, or by holding them the way it needs? */
const setsUpCombo = (from: Ability, to: Ability): boolean => {
  const c = to.combo;
  return !!c && from !== to && (!!c.ab?.includes(from.id) || from.effects.some((e) => (e.k === 'cc' || e.k === 'trap') && !!c.cc?.includes(e.cc)));
};

/** A combo a bar can make: the ability that sets it up, the one that lands it, and its name. */
export interface BarCombo {
  name: string;
  text: string;
  from: Ability;
  to: Ability;
}

/**
 * The combos a bar holds: every ability on it whose combo another ability on it (or the class's super) sets up, by
 * leaving its mark on the target or by holding them the way the combo needs. A setup shows these, so its player knows
 * what to press after what.
 */
export function barCombos(cls: ClassId, bar: readonly string[]): BarCombo[] {
  const have = [...bar.map((id) => ABILITIES[id]).filter((x): x is Ability => !!x), SUPERS[cls]];
  const out: BarCombo[] = [];
  for (const to of have) {
    const c = to.combo;
    if (!c) continue;
    const from = have.find((x) => setsUpCombo(x, to));
    if (from) out.push({ name: c.name, text: c.text, from, to });
  }
  return out;
}

/** What an ability has to do with its class's combos: the ones it lands (and after what), and the ones it sets up. */
export interface AbilityCombos {
  /** The combo this ability lands, and what from the class's kit sets it up (a hold of the right kind counts). */
  lands: { name: string; text: string; after: Ability[] } | null;
  /** The combos of other abilities that this one sets up. */
  setsUp: { name: string; text: string; then: Ability }[];
}

export function combosOf(cls: ClassId, ab: Ability): AbilityCombos {
  const all = [...KITS[cls], SUPERS[cls]];
  return {
    lands: ab.combo ? { name: ab.combo.name, text: ab.combo.text, after: all.filter((x) => setsUpCombo(x, ab)) } : null,
    setsUp: all.filter((y) => setsUpCombo(ab, y)).map((y) => ({ name: y.combo!.name, text: y.combo!.text, then: y })),
  };
}

/** One passive taken into the match, on top of the bar. */
export interface Oath {
  id: string;
  name: string;
  text: string;
  icon: string;
  hp?: number;
  dmg?: number;
  heal?: number;
  speed?: number;
  /** A share off how long anything holds you. */
  tenacity?: number;
  /** A share off every cooldown. */
  cool?: number;
}

export const OATHS: Oath[] = [
  { id: 'iron', name: 'Oath of Iron', text: '+12% health', icon: 'toughness_heart_mastery_on_red', hp: 0.12 },
  { id: 'fury', name: 'Oath of Fury', text: '+8% damage', icon: 'strength_up_status_flexed_arm_on_red', dmg: 0.08 },
  { id: 'life', name: 'Oath of Life', text: '+15% healing', icon: 'regeneration_status_green_leaf_on_green', heal: 0.15 },
  { id: 'wind', name: 'Oath of Wind', text: '+10% move speed', icon: 'haste_status_winged_boot_on_teal', speed: 0.1 },
  { id: 'will', name: 'Oath of Will', text: 'Held 25% shorter', icon: 'broken_chain_on_black', tenacity: 0.25 },
  { id: 'hours', name: 'Oath of Hours', text: 'Cooldowns 12% shorter', icon: 'lightning_hourglass_on_violet', cool: 0.12 },
];

/** Every icon The Ring shows, for the icon build. */
export const ringIcons = (): string[] => [DASH.icon, SIGIL.icon, ...Object.values(SUPERS).map((x) => x.icon), ...Object.values(KITS).flat().map((x) => x.icon), ...OATHS.map((o) => o.icon)];
