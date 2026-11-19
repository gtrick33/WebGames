import type { ClassId } from '../data/types';

/**
 * The Ring: Sigilfall's arena. Its abilities are its own, apart from the campaign's: the numbers are flat and equal for
 * everyone so that a level 1 hero and a level 60 hero fight the same fight.
 *
 * Every class has two playstyles, and a playstyle's abilities are fixed (2026-11-16, the owner: "1 base spell 1 ult 3
 * other spells (like before)", "fixed spells per playstyle, only talents need to be changed", "1 utility spell
 * (defensive, mobility, dmg), 1 cc spell"): a basic one with no cooldown, the one its combo is made with, one utility
 * and one hold, and its super. What a player chooses is the playstyle and its talents (arena/talents.ts). Before that
 * a class had twelve abilities and a trinket to pick five from, and a combo was one ability after another; now a combo
 * is made with the basic ability or the super ("combos to be done with your basic spell or even ur ult"), and it can be
 * more than an order to press things in: points that one ability builds and another spends, a boon that lights an
 * ability up for one use, a spell that makes another stronger while it lasts.
 *
 * Plain data with no imports but types: the icon build reads it. The rules are the classic arena's; the names and the
 * art are ours.
 */

export type School = 'physical' | 'fire' | 'frost' | 'arcane' | 'holy' | 'shadow' | 'nature';
/**
 * Crowd control. Every hold lands for its whole length each time: there are no diminishing returns, and each hold has
 * a cooldown long enough that no one player can keep anyone held most of the time (sim.ts crowd).
 */
export type CcKind = 'stun' | 'fear' | 'incap' | 'root' | 'silence';

/**
 * What an ability does. (A few of these no playstyle's four use since they became fixed on 2026-11-16: a spell turned
 * back, a full immunity, a dispel, a last grace, a price in health, a mark, a school locked by an interrupt. The rules
 * still carry them out, and tests/sigilfall-ring.test.ts tries each with a stand-in, so an ability to come can.)
 */
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
  /**
   * Bound this far forward, the way its user faces (the way they last moved), always: a ranger's Spring Away (the owner,
   * 2026-11-17: "rangers leap should always be a dash forward, currently its a bit random"). It went away from the
   * nearest enemy, which turned with whoever happened to be nearest.
   */
  | { k: 'bound'; dist: number }
  /** Roots and slows come off. */
  | { k: 'break' }
  /** All crowd control comes off. */
  | { k: 'token' }
  /** A snare left on the ground: the first enemy to step on it is caught. */
  | { k: 'trap'; cc: CcKind; dur: number }
  /** Costs its user this much of their own health (never the last of it). */
  | { k: 'price'; n: number }
  /** Throws them this far back, away from whoever hit them, and cuts off what they were casting. */
  | { k: 'knock'; dist: number }
  /**
   * Raises `n` of the dead beside their master, to fight for them for `life` seconds: each with `hp` of its own and a
   * blow of `dmg` (before its master's share) every so often that slows by `slow`% for a moment (their master's
   * doing, as far as a combo is concerned). They can be struck, held and killed like anyone.
   */
  | { k: 'raise'; n: number; hp: number; dmg: number; life: number; slow: number }
  /**
   * Into the shroud: hidden from the other side until its user strikes or is struck (Match.veil). Out of a fight it is
   * back in moments; in one, it is the long way out, and what lands in its first moments doesn't break it.
   */
  | { k: 'veil' }
  /** Step out of the dark at the target's back, facing them. */
  | { k: 'behind' }
  /** Drags the target in to arm's length of its user, and cuts off what they were casting. */
  | { k: 'pull' }
  /** Its user's raised dead hit this much harder and run a third faster for a while. */
  | { k: 'frenzy'; pct: number; dur: number }
  /** Everything burning or rotting on the target comes off (so that a hold which damage breaks can hold). */
  | { k: 'undot' }
  /** Marked: their user's whole side deals them this much more damage for a while. */
  | { k: 'mark'; pct: number; dur: number };

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
  /** Or its user strikes from behind them (their back is turned: the way they last faced). */
  behind?: boolean;
  mult: number;
  consume?: boolean;
  extra?: Effect[];
}

/**
 * Points: what one ability builds and another spends (the owner: "nightknife basic spells - increases combo points
 * ... eviscerate spell that consumes those combo points, the more the points the bigger the dmg"). A playstyle has
 * them of itself (the Nightblade's Nicks) or by a talent (a Rime's Rimeshards). Shown as pips over the bar.
 */
export interface Points {
  /** What they are called, many and one. */
  name: string;
  one: string;
  max: number;
  color: string;
}

/**
 * How a boon is drawn at the edges of the screen while its hero carries it (the owner: "instant procs should have
 * similar to wows fingers of frost screen visuals, make them unique for each class"): one shape to a class's manner
 * (ui/RingBoons.tsx).
 */
export type BoonLook = 'slash' | 'flame' | 'ice' | 'feather' | 'halo' | 'void' | 'sun' | 'hex' | 'skull' | 'leaf' | 'moon' | 'fang';

/**
 * A boon: something its hero carries for a while that changes one of their abilities the next time it is used (it is
 * instant, ready at once, far stronger), or for as long as the boon lasts (`quiet`: a spell's own while it is out,
 * shown small and without the light at the screen's edges).
 */
export interface Boon {
  id: string;
  name: string;
  /** What it does, in words. */
  text: string;
  color: string;
  icon: string;
  look: BoonLook;
  /** Seconds it is kept if not used. */
  dur: number;
  /** How many can be held at once (1 when not said). */
  max?: number;
  quiet?: boolean;
}

/** An ability gives its user a boon. */
export interface Give {
  boon: string;
  /** How likely, 0 to 1 (always, when not said). */
  chance?: number;
  /** Always on a critical hit, whatever the chance. */
  crit?: boolean;
  /** How many at once (1 when not said). */
  n?: number;
  /**
   * When: as it lands on someone (`land`, when not said), each time its burn, its patch of ground or its channel ticks
   * (`tick`; a summons' blows are its ticks too), or as it goes off (`cast`).
   */
  on?: 'land' | 'tick' | 'cast';
  /** Only every so many of its landings (the third Swift Shot). */
  every?: number;
  /** Only when it spent as many points as can be held. */
  full?: boolean;
}

/** An ability uses a boon its user carries: what the boon makes of it. One of the boon is used up, unless kept. */
export interface Use {
  boon: string;
  /** Its numbers are multiplied by this. */
  mult?: number;
  /** It has no cast time. */
  instant?: boolean;
  /** It can be used whatever its cooldown, and starts none. */
  nocd?: boolean;
  /** It is a critical hit. */
  crit?: boolean;
  /** It lands its combo whatever the target carries. */
  asCombo?: boolean;
  /** More that it does to whoever it lands on. */
  extra?: Effect[];
  /** Its user drinks this share of the damage it deals. */
  drink?: number;
  /** It builds this many more points. */
  build?: number;
  /** The boon isn't used up: it works for as long as the boon lasts. */
  keep?: boolean;
}

/** An ability builds points: how many, and when (as `Give.on`). */
export interface Build {
  n: number;
  on?: 'land' | 'tick' | 'cast';
}

/**
 * An ability spends every point its user holds: each makes its numbers `per` stronger (and with `hold`, a hold it puts
 * on that many seconds longer). With `mend`, the friend most hurt is healed that share of what it dealt.
 */
export interface Spend {
  per: number;
  hold?: number;
  mend?: number;
  /** It can't be used with fewer points than this. */
  need?: number;
}

/**
 * What a placed ability leaves on the ground: a patch that stays `dur` seconds and lands the ability's effects on
 * everyone of the other side standing in it every `tick`. It drifts on the way it was thrown at `drift` a second, or
 * goes after whoever of the other side is nearest it at `seek` of a walk (the owner, 2026-11-17: "the orb should follow
 * the closest target and keep hitting them otherwise its always a miss").
 */
export interface Field {
  dur: number;
  tick: number;
  drift?: number;
  seek?: number;
}

/**
 * Where an ability goes. `enemy` and `friend`: on one fighter, and it always lands. `near`: on every enemy round its
 * user. `ground`: on a patch of ground its user places, which everyone can see coming and step out of.
 */
export type Aim = 'enemy' | 'friend' | 'self' | 'near' | 'ground';
/** What the computer players read an ability as. */
export type Role = 'damage' | 'heal' | 'cc' | 'interrupt' | 'defense' | 'mobility' | 'dispel' | 'burst' | 'summon' | 'stealth';

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
  /** Doesn't start or wait for the global cooldown. */
  free?: boolean;
  /** Can be used while stunned, feared or caught. */
  anyState?: boolean;
  /** Flies to its target and then lands (it follows them: nothing dodges it, and stone doesn't stop it once thrown). */
  bolt?: boolean;
  /** Lands at once, and is drawn crossing to its target in a streak (an arrow, a thrown hammer). */
  zip?: boolean;
  /**
   * A `bolt` thrown to be watched: it crosses in a set time, `per` world pixels a second but never sooner than `least`
   * seconds nor later than `most`, and lands as it gets there (Frostfang: the owner, 2026-11-17, "idk if the dmg and the
   * spell cast is desynced", as it was: what it did had landed long before the picture of it got there). Like any bolt
   * it follows its target and nothing dodges it; and a combo ready as it leaves the hand lands with it, whatever wears
   * off on the way.
   */
  flight?: { per: number; least: number; most: number };
  /**
   * `ground`: how wide the patch is (its radius), and how long it takes to land once placed. A patch is at least as
   * wide as a fighter walks in that time, so one placed on somebody lands on them unless they are quickened out of
   * it: what is placed by a tap does not miss someone who only walks.
   */
  area?: number;
  fall?: number;
  /** `ground`: what it leaves there once it has landed (a globe of rime drifting on). */
  field?: Field;
  /** Can't be taken off by a dispel. */
  sticky?: boolean;
  effects: Effect[];
  /** Two or three abilities working together: this one lands harder (and maybe more) when its conditions are met. */
  combo?: Combo;
  /** The points it builds, and whether it spends them. */
  build?: Build;
  spend?: Spend;
  /** The boons it gives its user, and the ones it uses. */
  gives?: Give[];
  uses?: Use[];
  /** A class's super: no clock of its own, it's ready when the meter filled by fighting is full. */
  super?: boolean;
  /** Only from the shroud: it can be used only while its user is hidden. */
  veiled?: boolean;
  /** Doesn't bring its user out of the shroud. */
  quiet?: boolean;
  /**
   * Its root is ice that shatters: this many Shatters against it (Frostfang's combo, from anyone) and it breaks,
   * the last of them freeing the target (the owner: "the frost roots should only apply for 1 rime spear except ult
   * that applies for 2").
   */
  shatter?: number;
  /**
   * Its user goes up into the dark for this long first, where nothing can reach them, and comes down on the target
   * with it (the owner: "become untargetable for 1s then land from above on the enemy").
   */
  dive?: number;
  /** What it does to its user as well, as it goes off (a super's own strength). */
  self?: Effect[];
  /** A friend's spell that lands on every friend in reach and sight, not one. */
  allies?: boolean;
}

const MELEE = 30;
const SHORT = 80;
const MID = 130;
const FAR = 185;

const a = (d: Ability): Ability => d;

export const GCD = 0.75;
/** A bar: the playstyle's basic ability and its three others. The super stands beside it. */
export const SLOTS = 4;

/**
 * A healer's playstyle: its basic ability, the first on its bar, is a heal for a friend. (Said here, by what a bar
 * holds, so that the rules, the computer players and the lobby all mean the same three: the Lifegiver, the Oathkeeper
 * and the Grovekeeper.)
 */
export const healerBar = (bar: readonly string[]): boolean => {
  const first = ABILITIES[bar[0] ?? ''];
  return first?.role === 'heal' && first.aim === 'friend';
};

/**
 * The share of its abilities' numbers each class deals (their abilities' own words give what lands after this). Those
 * who fight from range deal less than those at arm's length; within that, each class is set so that none wins or loses
 * much more than half its matches when the computer plays every setup against every other (see the measures in
 * tests/sigilfall-ring-balance.test.ts). Kept here, with the numbers it scales, so that an ability's words are worked
 * from both and can't drift from what it does. (The warrior's came down from 0.92 by players' word, 2026-11-17: "they
 * have the best dps, most amount of cc, same mobility as everyone and are the tankiest spec"; to 0.82 first, then 0.87,
 * the owner: "maybe bring dmg to 0.87".)
 */
export const CLASS_DMG: Readonly<Record<ClassId, number>> = { warrior: 0.87, paladin: 0.82, gloamknight: 0.88, mage: 0.72, ranger: 0.78, warlock: 0.9, priest: 0.78, druid: 0.85 };

/** What a number of a class's lands as, for its ability's words. */
const share = (cls: ClassId) => (n: number): number => Math.round(n * CLASS_DMG[cls]);
const W = share('warrior');
const M = share('mage');
const R = share('ranger');
const P = share('priest');
const D = share('paladin');
const K = share('warlock');
const L = share('druid');
const G = share('gloamknight');

/**
 * Every boon, by id. A playstyle's own (the Rime's globe) and the ones its talents give (arena/talents.ts); each
 * class's are drawn in its own manner at the edges of the screen (BoonLook).
 */
export const BOONS: Record<string, Boon> = Object.fromEntries(
  (
    [
      // the warrior
      { id: 'mist', name: 'Red Mist', text: 'Your next Festering Gash has no cooldown and deals 50% more damage.', color: '#ff4f5a', icon: 'rage_status_red_eye_on_red', look: 'slash', dur: 10 },
      { id: 'bloodup', name: 'Blood Up', text: 'Your next Hock Cut deals double damage.', color: '#ff7a3d', icon: 'berserk_status_red_horned_mask_on_red', look: 'slash', dur: 8, max: 2 },
      // the mage
      { id: 'cinder', name: 'Cinderheart', text: 'Your next Flashburn has no cooldown and critically hits.', color: '#ff8a2a', icon: 'burning_heart_on_red', look: 'flame', dur: 10 },
      { id: 'globe', name: 'Rimeglobe', text: 'While your Rimeglobe is active, Rime Spear deals double damage.', color: '#9fdcff', icon: 'ice_orb_in_a_palm_on_navy', look: 'ice', dur: 6.4, quiet: true },
      { id: 'hoar', name: 'Hoarfrost', text: 'Your next Frostfang has no cooldown and deals 3.3 times the damage.', color: '#bfeaff', icon: 'frozen_status_snowflake_on_blue', look: 'ice', dur: 10, max: 2 },
      // the ranger
      { id: 'breath', name: 'Still Breath', text: 'Your next Long Draw is instant and has no cooldown.', color: '#d8ff9a', icon: 'focus_status_calm_eye_on_teal', look: 'feather', dur: 10 },
      { id: 'nocked', name: 'Nocked', text: 'Your next Swift Shot deals double damage.', color: '#f6f2c8', icon: 'bow_drawn_on_brown', look: 'feather', dur: 6, quiet: true },
      { id: 'baited', name: 'Baited', text: 'Your next Serpent Volley has no cooldown and deals 50% more damage.', color: '#9be86a', icon: 'hunter_mark_claw_on_brown', look: 'feather', dur: 8 },
      // the priest
      { id: 'answer', name: 'Answered Prayer', text: 'Your next Knit Wounds is instant and heals 30% more.', color: '#fff0a8', icon: 'white_dove_with_spread_wings_on_gold', look: 'halo', dur: 10, max: 2 },
      { id: 'omen', name: 'Dire Portent', text: 'Your next Gnawing Word is instant and deals 80% more damage.', color: '#b06aff', icon: 'dark_eye_on_violet', look: 'void', dur: 10, max: 2 },
      // the paladin
      { id: 'oath', name: 'Kept Oath', text: 'Your next Dawn’s Touch heals 30% more.', color: '#ffe48a', icon: 'white_flame_on_a_candle_on_gold', look: 'sun', dur: 8, quiet: true },
      { id: 'dawnfire', name: 'Dawnfire', text: 'Your next Hammerfall has no cooldown and burns the target.', color: '#ffd84a', icon: 'burning_sun_disc_on_orange', look: 'sun', dur: 10 },
      // the warlock
      { id: 'gathering', name: 'Gathering Dark', text: 'Your next Blight Dart is instant and deals double damage.', color: '#c88aff', icon: 'dark_lotus_on_black', look: 'hex', dur: 10, max: 2 },
      { id: 'chill', name: 'Grave Chill', text: 'Your next Gloom Bolt is instant and deals 50% more damage.', color: '#9ae85a', icon: 'ghoul_claw_on_green', look: 'skull', dur: 10, max: 2 },
      // the druid
      { id: 'surge', name: 'Verdant Surge', text: 'Your next Green Mending is instant and heals 30% more.', color: '#9be86a', icon: 'wild_growth_of_three_sprouts_on_green', look: 'leaf', dur: 10 },
      { id: 'star', name: 'Falling Star', text: 'Your next Starlash is instant and deals 60% more damage.', color: '#cfe0ff', icon: 'star_summon_on_navy', look: 'moon', dur: 10, max: 2 },
      // the Gloamknight
      { id: 'hunger', name: 'Hungering Edge', text: 'Your next Night Reaping has no cooldown and heals you for half its damage.', color: '#c8a8ff', icon: 'lifesteal_status_heart_drop_on_red', look: 'fang', dur: 10 },
      { id: 'dusk', name: 'Second Dusk', text: 'Your next Nightknife counts as striking from behind and generates 2 Nicks.', color: '#b48cff', icon: 'crescent_moon_behind_clouds_on_navy', look: 'fang', dur: 8 },
    ] satisfies Boon[]
  ).map((b) => [b.id, b]),
);

/** The sigil in the middle of the ground (not an ability anyone has: what it gives, for the pictures and the words). */
export const SIGIL: Ability = a({ id: 'sigil', cls: 'any', name: 'Sigil of Might', text: 'Heals a fifth of your life, fills your super meter by a third and quickens you.', icon: 'radiant_star_burst_on_gold', color: '#ffe27a', school: 'holy', role: 'heal', aim: 'self', range: 0, cast: 0, cd: 0, effects: [{ k: 'speed', pct: 30, dur: 4 }] });

/**
 * Each class's first super: one big, bright blow, ready when the meter filled by dealing and taking hurt is full. Each
 * belongs to one playstyle (PLAYSTYLES), and works with its combo: it lands harder on a target its abilities have set
 * up, or sets one up itself.
 */
export const SUPERS: Record<ClassId, Ability> = {
  warrior: a({ id: 'w-super', cls: 'warrior', name: 'Quakebreaker', text: `Slams the ground for ${W(148)} damage to all nearby enemies, knocking them back and slowing them by 50% for 3 sec.`, icon: 'ground_slam_crack_with_flying_rocks_on_brown', color: '#ffb45c', school: 'physical', role: 'burst', aim: 'near', range: 66, cast: 0, cd: 0, free: true, super: true, combo: { name: 'Aftershock', text: 'Deals 60% more damage to targets bleeding from your Festering Gash.', ab: ['w-gash'], mult: 1.6 }, effects: [{ k: 'dmg', n: 148 }, { k: 'slow', pct: 50, dur: 3 }, { k: 'knock', dist: 70 }] }),
  mage: a({ id: 'm-super', cls: 'mage', name: 'Cinder Comet', text: `Calls a comet down on a patch of ground after a short delay, dealing ${M(181)} damage to all enemies under it and stunning them for 1 sec.`, icon: 'meteor_falling_with_flames_on_orange', color: '#ff7a1e', school: 'fire', role: 'burst', aim: 'ground', range: FAR, cast: 0, cd: 0, free: true, super: true, area: 39, fall: 0.78, combo: { name: 'Conflagration', text: 'Deals 60% more damage to targets Kindled by your Ember Lash.', ab: ['m-lash'], mult: 1.6 }, effects: [{ k: 'dmg', n: 181 }, { k: 'cc', cc: 'stun', dur: 1 }] }),
  ranger: a({ id: 'r-super', cls: 'ranger', name: 'Skypierce Arrow', text: `Deals ${R(207)} damage and knocks the target back.`, icon: 'exploding_arrow_on_brown', color: '#d8ff9a', school: 'physical', role: 'burst', aim: 'enemy', range: FAR, cast: 0, cd: 0, free: true, bolt: true, super: true, combo: { name: 'Pinned Down', text: 'Deals 60% more damage to stunned targets.', cc: ['stun'], mult: 1.6 }, effects: [{ k: 'dmg', n: 207 }, { k: 'knock', dist: 60 }] }),
  priest: a({ id: 'p-super', cls: 'priest', name: 'Dawnward', text: 'Heals a friend for 242 and absorbs 194 damage on them for 10 sec.', icon: 'pair_of_white_wings_opening_on_gold', color: '#fff2b0', school: 'holy', role: 'heal', aim: 'friend', range: FAR, cast: 0, cd: 0, free: true, super: true, effects: [{ k: 'heal', n: 242 }, { k: 'absorb', n: 194, dur: 10 }] }),
  paladin: a({ id: 'd-super', cls: 'paladin', name: 'Sunhammer', text: `Deals ${D(243)} damage and stuns the target for 1 sec.`, icon: 'sun_flare_on_orange', color: '#ffd84a', school: 'holy', role: 'burst', aim: 'enemy', range: MID, cast: 0, cd: 0, free: true, bolt: true, super: true, effects: [{ k: 'dmg', n: 243 }, { k: 'cc', cc: 'stun', dur: 1 }] }),
  warlock: a({ id: 'k-super', cls: 'warlock', name: 'Riftmaw', text: `Tears a rift open where you choose, dealing ${K(86)} damage to all enemies on it and ${K(103)} more over 6 sec, and slowing them by 50%.`, icon: 'dark_portal_on_black', color: '#b06aff', school: 'shadow', role: 'burst', aim: 'ground', range: FAR, cast: 0, cd: 0, free: true, super: true, area: 52, fall: 0.8, effects: [{ k: 'dmg', n: 86 }, { k: 'dot', n: 103, dur: 6 }, { k: 'slow', pct: 50, dur: 4 }] }),
  druid: a({ id: 'l-super', cls: 'druid', name: 'Thornstorm', text: `Thorns erupt where you choose, dealing ${L(121)} damage to all enemies there and rooting them for 1.5 sec.`, icon: 'thorn_burst_on_dark_green', color: '#9be86a', school: 'nature', role: 'burst', aim: 'ground', range: FAR, cast: 0, cd: 0, free: true, super: true, area: 52, fall: 0.8, combo: { name: 'Moonlit Thorns', text: 'Deals 60% more damage to targets affected by your Moonburn.', ab: ['l-moon'], mult: 1.6 }, effects: [{ k: 'dmg', n: 121 }, { k: 'cc', cc: 'root', dur: 1.5 }] }),
  gloamknight: a({ id: 'g-super', cls: 'gloamknight', name: 'Eclipse Reaping', text: `Lunges at the target for ${G(237)} damage and heals you for 125.`, icon: 'eclipse_sun_on_black', color: '#c8a8ff', school: 'shadow', role: 'burst', aim: 'enemy', range: FAR, cast: 0, cd: 0, free: true, sticky: true, super: true, combo: { name: 'Last Harvest', text: 'Deals 60% more damage to stunned targets and targets slowed by your Grave Chain.', ab: ['g-chain'], cc: ['stun'], mult: 1.6 }, effects: [{ k: 'charge' }, { k: 'dmg', n: 237 }, { k: 'heal', n: 125 }] }),
};

/**
 * Each class's second super, for its other way to fight (the owner: "let's also add unique ultimates for each loadout
 * ... make every ultimate fun to use, very impactful and cool").
 */
export const SUPERS2: Record<ClassId, Ability> = {
  // the Hound: run them down and don't let go
  warrior: a({ id: 'w-super2', cls: 'warrior', name: 'Run Them Down', text: `Charges an enemy for ${W(80)} damage and ${W(120)} more over 6 sec, slowing them by 50% for 3 sec. For 4 sec you deal 15% more damage and cannot be slowed or rooted.`, icon: 'fire_wolf_head_on_black', color: '#ff6a4a', school: 'physical', role: 'burst', aim: 'enemy', range: FAR, cast: 0, cd: 0, free: true, sticky: true, super: true, self: [{ k: 'break' }, { k: 'free', dur: 4 }, { k: 'fury', pct: 15, dur: 4 }], effects: [{ k: 'charge' }, { k: 'dmg', n: 80 }, { k: 'dot', n: 120, dur: 6 }, { k: 'slow', pct: 50, dur: 3 }] }),
  // the Rime: the whole ring frozen round her, and her Frostfang shattering each of them
  mage: a({ id: 'm-super2', cls: 'mage', name: 'Winter’s Grasp', text: `Deals ${M(83)} damage to all nearby enemies, roots them for 3 sec, then slows them by 50% for 6 sec. You gain a shield of 180 for 10 sec. Two Frostfangs shatter the root.`, icon: 'frost_crown_on_navy', color: '#bfeaff', school: 'frost', role: 'burst', aim: 'near', range: 76, cast: 0, cd: 0, free: true, super: true, shatter: 2, self: [{ k: 'absorb', n: 180, dur: 10 }], effects: [{ k: 'dmg', n: 83 }, { k: 'cc', cc: 'root', dur: 3 }, { k: 'slow', pct: 50, dur: 6 }] }),
  // the Trapper: a whole patch of the ring made a snare
  ranger: a({ id: 'r-super2', cls: 'ranger', name: 'Thicket of Snares', text: `Covers a wide patch of ground in snares, dealing ${R(75)} damage to all enemies on it, rooting them for 2.5 sec and poisoning them for ${R(167)} more over 6 sec.`, icon: 'net_trap_on_green', color: '#9be86a', school: 'nature', role: 'burst', aim: 'ground', range: FAR, cast: 0, cd: 0, free: true, super: true, area: 72, fall: 1.1, effects: [{ k: 'dmg', n: 75 }, { k: 'cc', cc: 'root', dur: 2.5 }, { k: 'dot', n: 167, dur: 6 }] }),
  // the Curse-speaker: a word that empties the ground of sound and of healing
  priest: a({ id: 'p-super2', cls: 'priest', name: 'Voidburst', text: `Opens the void where you choose, dealing ${P(117)} damage to all enemies in it, silencing them for 2.5 sec and reducing healing on them by 40% for 8 sec. Heals you for 150 and shields you for 200 for 10 sec.`, icon: 'anti_heal_status_broken_heart_on_black', color: '#a060ff', school: 'shadow', role: 'burst', aim: 'ground', range: FAR, cast: 0, cd: 0, free: true, super: true, self: [{ k: 'heal', n: 150 }, { k: 'absorb', n: 200, dur: 10 }], area: 58, fall: 0.9, effects: [{ k: 'dmg', n: 117 }, { k: 'cc', cc: 'silence', dur: 2.5 }, { k: 'antiheal', pct: 40, dur: 8 }] }),
  // the Oathkeeper: the whole side lifted up at once
  paladin: a({ id: 'd-super2', cls: 'paladin', name: 'Dawn’s Covenant', text: 'Heals all allies in range for 170, frees them from crowd control and absorbs 165 damage on each for 10 sec.', icon: 'gate_opening_with_light_on_gold', color: '#ffe9a0', school: 'holy', role: 'heal', aim: 'friend', range: FAR, cast: 0, cd: 0, free: true, anyState: true, super: true, allies: true, effects: [{ k: 'token' }, { k: 'heal', n: 170 }, { k: 'absorb', n: 165, dur: 10 }] }),
  // the Gravecaller: the barrow empties
  warlock: a({ id: 'k-super2', cls: 'warlock', name: 'Grave Legion', text: 'Summons 3 ashbound dead for 12 sec, replacing any you already have.', icon: 'graveyard_gate_on_black', color: '#9ae85a', school: 'shadow', role: 'summon', aim: 'self', range: 0, cast: 0, cd: 0, free: true, super: true, effects: [{ k: 'raise', n: 3, hp: 170, dmg: 9, life: 12, slow: 10 }] }),
  // the Grovekeeper: the old wood's heart beating in every friend
  druid: a({ id: 'l-super2', cls: 'druid', name: 'Heart of the Grove', text: 'Heals all allies in range for 50 and 92 more over 8 sec. They take 10% less damage while it lasts.', icon: 'tree_of_life_on_green', color: '#9be86a', school: 'nature', role: 'heal', aim: 'friend', range: FAR, cast: 0, cd: 0, free: true, super: true, allies: true, effects: [{ k: 'heal', n: 50 }, { k: 'hot', n: 92, dur: 8 }, { k: 'guard', pct: 10, dur: 8 }] }),
  // the Nightblade: up into the dark, and down on them out of it
  gloamknight: a({ id: 'g-super2', cls: 'gloamknight', name: 'Night’s Ruin', text: `You leap into the dark and cannot be targeted for 1 sec, then land on the target for ${G(127)} damage, increased by 25% per Nick spent, and stun for 1.5 sec. You return to stealth, which cannot be broken for 3 sec.`, icon: 'bone_wings_on_violet', color: '#b48cff', school: 'physical', role: 'burst', aim: 'enemy', range: MID, cast: 0, cd: 0, free: true, quiet: true, super: true, dive: 1, spend: { per: 0.25 }, effects: [{ k: 'behind' }, { k: 'dmg', n: 127 }, { k: 'cc', cc: 'stun', dur: 1.5 }, { k: 'veil' }] }),
};

/** A class's two supers, the first first. */
export const ultsOf = (cls: ClassId): [Ability, Ability] => [SUPERS[cls], SUPERS2[cls]];
/** The super a setup carries (`id`), or the class's first. */
export const ultOf = (cls: ClassId, id: string | undefined): Ability => ultsOf(cls).find((x) => x.id === id) ?? SUPERS[cls];
export const superOf = (cls: ClassId): Ability => SUPERS[cls];

/**
 * Every class's abilities: eight or so, four to a playstyle (some the class's own way of doing a thing, on both). In
 * each playstyle's four: the basic one first, then the one its combo is made with, its utility and its hold.
 */
const KITS: Record<ClassId, Ability[]> = {
  warrior: [
    // the Reaper: a wound opened, and hewn at
    a({ id: 'w-hew', cls: 'warrior', name: 'Hew', text: `Strikes for ${W(27)} damage.`, icon: 'great_axe_with_a_bright_red_edge_on_red', color: '#f2ece0', school: 'physical', role: 'damage', aim: 'enemy', range: MELEE, cast: 0, cd: 0, combo: { name: 'Open Wound', text: 'Deals 75% more damage to targets bleeding from your Festering Gash.', ab: ['w-gash'], mult: 1.75 }, effects: [{ k: 'dmg', n: 27 }] }),
    a({ id: 'w-gash', cls: 'warrior', name: 'Festering Gash', text: `Deals ${W(36)} damage and ${W(56)} more over 8 sec. Healing on the target is reduced by 20% while it bleeds.`, icon: 'cut_status_scratch_on_red', color: '#c8324a', school: 'physical', role: 'burst', aim: 'enemy', range: MELEE, cast: 0, cd: 8, sticky: true, effects: [{ k: 'dmg', n: 36 }, { k: 'dot', n: 56, dur: 8 }, { k: 'antiheal', pct: 20, dur: 8 }] }),
    // (the class's way in, on both)
    a({ id: 'w-rush', cls: 'warrior', name: 'Bull Rush', text: 'Charges to an enemy and slows them by 40% for 2 sec.', icon: 'stomping_boot_with_a_quake_ring_on_brown', color: '#d8a860', school: 'physical', role: 'mobility', aim: 'enemy', range: FAR, cast: 0, cd: 15, free: true, effects: [{ k: 'charge' }, { k: 'slow', pct: 40, dur: 2 }] }),
    a({ id: 'w-hurl', cls: 'warrior', name: 'Hurled Maul', text: `Throws your maul for ${W(11)} damage and stuns the target for 1 sec.`, icon: 'spinning_thrown_axe_with_motion_arcs_on_red', color: '#d8dce6', school: 'physical', role: 'cc', aim: 'enemy', range: MID, cast: 0, cd: 18, zip: true, effects: [{ k: 'dmg', n: 11 }, { k: 'cc', cc: 'stun', dur: 1 }] }),
    // the Hound: hobbled, then bled
    a({ id: 'w-hamstring', cls: 'warrior', name: 'Hock Cut', text: `Deals ${W(22)} damage and slows the target by 30% for 3 sec.`, icon: 'whirlwind_spin_of_three_blade_arcs_on_red', color: '#e8e8f4', school: 'physical', role: 'damage', aim: 'enemy', range: MELEE, cast: 0, cd: 0, effects: [{ k: 'dmg', n: 22 }, { k: 'slow', pct: 30, dur: 3 }] }),
    a({ id: 'w-bleed', cls: 'warrior', name: 'Rending Cut', text: `Deals ${W(19)} damage and ${W(96)} more over 8 sec.`, icon: 'chain_of_three_slash_marks_on_red', color: '#c8324a', school: 'physical', role: 'burst', aim: 'enemy', range: MELEE, cast: 0, cd: 6, sticky: true, combo: { name: 'Hamstrung', text: 'Deals 90% more damage, bleed included, to targets slowed by your Hock Cut.', ab: ['w-hamstring'], mult: 1.9 }, effects: [{ k: 'dmg', n: 19 }, { k: 'dot', n: 96, dur: 8 }] }),
    a({ id: 'w-crack', cls: 'warrior', name: 'Skull Crack', text: `Deals ${W(16)} damage and stuns the target for 1 sec.`, icon: 'sword_breaking_through_a_stone_wall_on_grey', color: '#ffb45c', school: 'physical', role: 'cc', aim: 'enemy', range: MELEE, cast: 0, cd: 16, effects: [{ k: 'dmg', n: 16 }, { k: 'cc', cc: 'stun', dur: 1 }] }),
  ],
  mage: [
    // the Pyre: kindled, then burst into flame
    a({ id: 'm-lash', cls: 'mage', name: 'Ember Lash', text: `Deals ${M(41)} damage and Kindles the target, burning for ${M(28)} more over 6 sec.`, icon: 'fire_comet_with_a_long_tail_on_navy', color: '#ff7a1e', school: 'fire', role: 'damage', aim: 'enemy', range: FAR, cast: 0.8, cd: 0, bolt: true, effects: [{ k: 'dmg', n: 41 }, { k: 'dot', n: 28, dur: 6 }] }),
    a({ id: 'm-burn', cls: 'mage', name: 'Flashburn', text: `Deals ${M(60)} damage. Usable while moving.`, icon: 'flame_circle_on_the_ground_on_dark_red', color: '#ff6a2a', school: 'fire', role: 'burst', aim: 'enemy', range: FAR, cast: 0, cd: 5, zip: true, combo: { name: 'Flashover', text: 'Deals 110% more damage to targets Kindled by your Ember Lash, consuming the Kindle.', ab: ['m-lash'], mult: 2.1, consume: true }, effects: [{ k: 'dmg', n: 60 }] }),
    a({ id: 'm-blink', cls: 'mage', name: 'Flicker', text: 'Teleports you forward and frees you from stuns, roots and slows. Usable while crowd controlled.', icon: 'three_small_fireballs_orbiting_on_red', color: '#c9b8ff', school: 'arcane', role: 'mobility', aim: 'self', range: 0, cast: 0, cd: 10, free: true, anyState: true, effects: [{ k: 'token' }, { k: 'blink', dist: 96 }] }),
    a({ id: 'm-toad', cls: 'mage', name: 'Toad Hex', text: 'Turns the target into a toad for 3 sec and removes damage-over-time effects from them. Any damage breaks it.', icon: 'frog_jumping_on_teal', color: '#8bff6a', school: 'arcane', role: 'cc', aim: 'enemy', range: FAR, cast: 0.6, cd: 12, bolt: true, effects: [{ k: 'undot' }, { k: 'cc', cc: 'incap', dur: 3 }] }),
    // the Rime: slowed, frozen, shattered
    a({ id: 'm-spear', cls: 'mage', name: 'Rime Spear', text: `Deals ${M(41)} damage and slows the target by 30% for 2.5 sec. Deals double damage while your Rimeglobe is active.`, icon: 'ice_spear_on_cyan', color: '#9fdcff', school: 'frost', role: 'damage', aim: 'enemy', range: FAR, cast: 0.6, cd: 0, bolt: true, uses: [{ boon: 'globe', mult: 2, keep: true }], effects: [{ k: 'dmg', n: 41 }, { k: 'slow', pct: 30, dur: 2.5 }] }),
    a({ id: 'm-fang', cls: 'mage', name: 'Frostfang', text: `Deals ${M(29)} damage. Usable while moving.`, icon: 'ice_shard_flying_on_blue', color: '#bfeaff', school: 'frost', role: 'burst', aim: 'enemy', range: FAR, cast: 0, cd: 3, bolt: true, flight: { per: 320, least: 0.28, most: 0.42 }, combo: { name: 'Shatter', text: 'Deals 3.3 times the damage to rooted or stunned targets. The second one to hit your Winter’s Grasp shatters it, freeing the target.', cc: ['root', 'stun'], mult: 3.3 }, effects: [{ k: 'dmg', n: 29 }] }),
    a({ id: 'm-globe', cls: 'mage', name: 'Rimeglobe', text: `Throws a globe of rime where you choose. For 6 sec it slowly follows the nearest enemy, dealing ${M(13)} damage each sec to enemies inside it and slowing them by 30%. While it is active, Rime Spear deals double damage.`, icon: 'ice_orb_in_a_palm_on_navy', color: '#9fdcff', school: 'frost', role: 'damage', aim: 'ground', range: MID, cast: 0, cd: 16, area: 41, fall: 0.3, field: { dur: 6, tick: 1, seek: 0.45 }, gives: [{ boon: 'globe', on: 'cast' }], effects: [{ k: 'dmg', n: 13 }, { k: 'slow', pct: 30, dur: 1.5 }] }),
    // (its id is the Frost Snare's, whose place it took on 2026-11-17, so that a kept setup still reads as the Rime's)
    a({ id: 'm-ring', cls: 'mage', name: 'Frostclasp', text: 'Stuns the target for 1.5 sec.', icon: 'ice_prison_cage_on_cyan', color: '#bfeaff', school: 'frost', role: 'cc', aim: 'enemy', range: FAR, cast: 0.6, cd: 18, bolt: true, effects: [{ k: 'cc', cc: 'stun', dur: 1.5 }] }),
  ],
  ranger: [
    // the Longbow: stunned by the hawk, then the long shot
    a({ id: 'r-swift', cls: 'ranger', name: 'Swift Shot', text: `Deals ${R(27)} damage. Usable while moving.`, icon: 'arrow_shot_with_a_speed_trail_on_green', color: '#d8ffb0', school: 'physical', role: 'damage', aim: 'enemy', range: FAR, cast: 0, cd: 0, zip: true, effects: [{ k: 'dmg', n: 27 }] }),
    a({ id: 'r-aimed', cls: 'ranger', name: 'Long Draw', text: `Deals ${R(82)} damage and reduces healing on the target by 35% for 6 sec.`, icon: 'piercing_arrow_through_a_shield_on_green', color: '#f6f2c8', school: 'physical', role: 'burst', aim: 'enemy', range: FAR, cast: 1.1, cd: 8, sticky: true, bolt: true, combo: { name: 'Falconer', text: 'Deals 90% more damage to stunned targets.', cc: ['stun'], mult: 1.9 }, effects: [{ k: 'dmg', n: 82 }, { k: 'antiheal', pct: 35, dur: 6 }] }),
    a({ id: 'r-leap', cls: 'ranger', name: 'Spring Away', text: 'Dashes you forward, the way you are facing, and removes roots and slows.', icon: 'haste_status_winged_boot_on_teal', color: '#d8ffb0', school: 'physical', role: 'mobility', aim: 'self', range: 0, cast: 0, cd: 9, free: true, effects: [{ k: 'break' }, { k: 'bound', dist: 92 }] }),
    a({ id: 'r-hawk', cls: 'ranger', name: 'Hawk’s Dive', text: 'Your hawk stuns the target for 1.5 sec. Usable while casting.', icon: 'hawk_companion_diving_on_teal', color: '#ffe39a', school: 'physical', role: 'cc', aim: 'enemy', range: FAR, cast: 0, cd: 17, free: true, zip: true, effects: [{ k: 'cc', cc: 'stun', dur: 1.5 }] }),
    // the Trapper: hobbled or caught, and the volley comes down
    a({ id: 'r-hobble', cls: 'ranger', name: 'Hobbling Shot', text: `Deals ${R(19)} damage and slows the target by 40% for 3 sec. Usable while moving.`, icon: 'slowed_status_snail_on_teal', color: '#e8e0a8', school: 'physical', role: 'damage', aim: 'enemy', range: FAR, cast: 0, cd: 0, zip: true, effects: [{ k: 'dmg', n: 19 }, { k: 'slow', pct: 40, dur: 3 }] }),
    a({ id: 'r-wind', cls: 'ranger', name: 'Serpent Volley', text: `Rains arrows on a patch of ground, dealing ${R(89)} damage to all enemies under it and ${R(96)} more over 6 sec.`, icon: 'wolf_howl_on_navy', color: '#8fe07a', school: 'nature', role: 'burst', aim: 'ground', range: FAR, cast: 0, cd: 9, combo: { name: 'Coiled Strike', text: 'Deals 90% more damage to targets slowed by your Hobbling Shot, caught in your Snapjaw Trap or rooted.', ab: ['r-hobble', 'r-trap'], cc: ['root'], mult: 1.9 }, area: 36, fall: 0.55, effects: [{ k: 'dmg', n: 89 }, { k: 'dot', n: 96, dur: 6 }] }),
    a({ id: 'r-venom', cls: 'ranger', name: 'Adder’s Kiss', text: `Poisons the target for ${R(61)} damage over 8 sec. Usable while moving.`, icon: 'poison_arrow_with_green_drip_on_green', color: '#9ae85a', school: 'nature', role: 'damage', aim: 'enemy', range: FAR, cast: 0, cd: 8, zip: true, effects: [{ k: 'dot', n: 61, dur: 8 }] }),
    a({ id: 'r-trap', cls: 'ranger', name: 'Snapjaw Trap', text: 'Places a trap at your feet. The first enemy to step on it is trapped for 2.5 sec. Any damage frees them.', icon: 'hunter_trap_with_jaws_on_brown', color: '#9a8a68', school: 'physical', role: 'cc', aim: 'self', range: 0, cast: 0, cd: 14, effects: [{ k: 'trap', cc: 'incap', dur: 2.5 }] }),
  ],
  priest: [
    // the Lifegiver: a ward, and the mending under it
    a({ id: 'p-mend', cls: 'priest', name: 'Knit Wounds', text: 'Heals a friend for 59.', icon: 'two_open_hands_holding_light_on_gold', color: '#b8ffb8', school: 'holy', role: 'heal', aim: 'friend', range: FAR, cast: 0.9, cd: 0, combo: { name: 'Mending Light', text: 'Heals 60% more on a friend shielded by your Ward of Faith or Dawnward.', ab: ['p-ward', 'p-super'], mult: 1.6 }, effects: [{ k: 'heal', n: 59 }] }),
    a({ id: 'p-smite', cls: 'priest', name: 'Bright Rebuke', text: `Deals ${P(83)} damage. Usable while moving.`, icon: 'golden_spear_of_light_on_gold', color: '#fff0a8', school: 'holy', role: 'damage', aim: 'enemy', range: FAR, cast: 0, cd: 4, zip: true, effects: [{ k: 'dmg', n: 83 }] }),
    a({ id: 'p-ward', cls: 'priest', name: 'Ward of Faith', text: 'Absorbs 87 damage on a friend for 15 sec.', icon: 'golden_halo_ring_over_a_helmet_on_gold', color: '#fff2b0', school: 'holy', role: 'defense', aim: 'friend', range: FAR, cast: 0, cd: 7, effects: [{ k: 'absorb', n: 87, dur: 15 }] }),
    a({ id: 'p-wail', cls: 'priest', name: 'Wail of Dread', text: 'Fears all nearby enemies for 2 sec. Enough damage breaks it.', icon: 'frightened_status_bat_on_black', color: '#a060ff', school: 'shadow', role: 'cc', aim: 'near', range: 58, cast: 0, cd: 18, effects: [{ k: 'cc', cc: 'fear', dur: 2 }] }),
    // the Curse-speaker: a curse laid, and the word that gnaws at it
    a({ id: 'p-gnaw', cls: 'priest', name: 'Gnawing Word', text: `Deals ${P(33)} damage.`, icon: 'shadow_bolt_on_black', color: '#b48cff', school: 'shadow', role: 'damage', aim: 'enemy', range: FAR, cast: 0.8, cd: 0, bolt: true, combo: { name: 'Rotting Word', text: 'Deals 75% more damage to targets affected by your Word of Decay or Voidburst.', ab: ['p-curse', 'p-super2'], mult: 1.75 }, effects: [{ k: 'dmg', n: 33 }] }),
    a({ id: 'p-curse', cls: 'priest', name: 'Word of Decay', text: `Curses the target for ${P(85)} damage over 10 sec. Usable while moving.`, icon: 'dark_flame_on_violet', color: '#a060ff', school: 'shadow', role: 'damage', aim: 'enemy', range: FAR, cast: 0, cd: 6, effects: [{ k: 'dot', n: 85, dur: 10 }] }),
    a({ id: 'p-dusk', cls: 'priest', name: 'Duskwalk', text: 'For 5 sec you take 30% less damage and move 30% faster. Removes roots and slows.', icon: 'hooded_figure_fading_on_black', color: '#7a50c8', school: 'shadow', role: 'defense', aim: 'self', range: 0, cast: 0, cd: 20, free: true, effects: [{ k: 'break' }, { k: 'guard', pct: 30, dur: 5 }, { k: 'speed', pct: 30, dur: 5 }] }),
    a({ id: 'p-hush', cls: 'priest', name: 'Word of Silence', text: 'Silences the target for 2 sec and interrupts their cast.', icon: 'silenced_status_muted_bell_on_violet', color: '#c88aff', school: 'shadow', role: 'cc', aim: 'enemy', range: FAR, cast: 0, cd: 18, free: true, effects: [{ k: 'interrupt', lock: 0 }, { k: 'cc', cc: 'silence', dur: 2 }] }),
  ],
  paladin: [
    // the Oathkeeper: heals, and a verdict on whoever the hammer stuns
    a({ id: 'd-flash', cls: 'paladin', name: 'Dawn’s Touch', text: 'Heals a friend for 64.', icon: 'healing_hand_with_green_gold_sparkles_on_gold', color: '#b8ffb8', school: 'holy', role: 'heal', aim: 'friend', range: FAR, cast: 0.8, cd: 0, uses: [{ boon: 'oath', mult: 1.3 }], effects: [{ k: 'heal', n: 64 }] }),
    a({ id: 'd-judge', cls: 'paladin', name: 'Verdict', text: `Deals ${D(39)} damage and slows the target by 30% for 4 sec. Your next Dawn’s Touch heals 30% more.`, icon: 'golden_scales_of_justice_on_gold', color: '#fff0a8', school: 'holy', role: 'damage', aim: 'enemy', range: FAR, cast: 0, cd: 5, zip: true, gives: [{ boon: 'oath' }], combo: { name: 'Final Verdict', text: 'Deals 125% more damage to stunned targets.', cc: ['stun'], mult: 2.25 }, effects: [{ k: 'dmg', n: 39 }, { k: 'slow', pct: 30, dur: 4 }] }),
    a({ id: 'd-hands', cls: 'paladin', name: 'Laying On', text: 'Instantly heals a friend for 186.', icon: 'golden_heart_with_white_wings_on_gold', color: '#fff2b0', school: 'holy', role: 'heal', aim: 'friend', range: FAR, cast: 0, cd: 40, free: true, effects: [{ k: 'heal', n: 186 }] }),
    // (the class's hammer, on both)
    a({ id: 'd-hammer', cls: 'paladin', name: 'Hammer of Oaths', text: `Throws a hammer for ${D(18)} damage and stuns the target for 1.5 sec.`, icon: 'hammer_of_light_with_golden_rays_on_gold', color: '#ffe48a', school: 'holy', role: 'cc', aim: 'enemy', range: MID, cast: 0, cd: 18, zip: true, effects: [{ k: 'dmg', n: 18 }, { k: 'cc', cc: 'stun', dur: 1.5 }] }),
    // the Zealot: the hammer, then the fall of the blade
    a({ id: 'd-blow', cls: 'paladin', name: 'Oath Blow', text: `Strikes for ${D(30)} damage.`, icon: 'holy_sword_with_light_rays_on_gold', color: '#fff2b0', school: 'holy', role: 'damage', aim: 'enemy', range: MELEE, cast: 0, cd: 0, combo: { name: 'Righteous Blow', text: 'Deals 75% more damage to stunned targets.', cc: ['stun'], mult: 1.75 }, effects: [{ k: 'dmg', n: 30 }] }),
    a({ id: 'd-fall', cls: 'paladin', name: 'Hammerfall', text: `Deals ${D(78)} damage.`, icon: 'falling_golden_meteor_of_light_on_gold', color: '#ffc76a', school: 'holy', role: 'burst', aim: 'enemy', range: MELEE, cast: 0, cd: 6, combo: { name: 'Judgment', text: 'Deals 100% more damage to stunned targets.', cc: ['stun'], mult: 2 }, effects: [{ k: 'dmg', n: 78 }] }),
    a({ id: 'd-stride', cls: 'paladin', name: 'Dawnstride', text: 'Increases your movement speed by 70% for 3 sec. You cannot be slowed or rooted while it lasts.', icon: 'white_horse_head_in_light_on_gold', color: '#ffe39a', school: 'holy', role: 'mobility', aim: 'self', range: 0, cast: 0, cd: 14, free: true, effects: [{ k: 'break' }, { k: 'speed', pct: 70, dur: 3 }, { k: 'free', dur: 3 }] }),
  ],
  warlock: [
    // the Hexer: an agony laid with every dart, and bloomed
    a({ id: 'k-dart', cls: 'warlock', name: 'Blight Dart', text: `Deals ${K(24)} damage and applies Creeping Agony, dealing ${K(62)} more over 9 sec.`, icon: 'necrotic_beam_on_dark_green', color: '#9ae85a', school: 'shadow', role: 'damage', aim: 'enemy', range: FAR, cast: 0.7, cd: 0, bolt: true, effects: [{ k: 'dmg', n: 24 }, { k: 'dot', n: 62, dur: 9 }] }),
    a({ id: 'k-bloom', cls: 'warlock', name: 'Hex Bloom', text: `Deals ${K(48)} damage. Usable while moving.`, icon: 'dark_explosion_on_violet', color: '#c88aff', school: 'shadow', role: 'burst', aim: 'enemy', range: FAR, cast: 0, cd: 5, combo: { name: 'Full Bloom', text: 'Deals 110% more damage to targets affected by your Creeping Agony or Riftmaw.', ab: ['k-dart', 'k-super'], mult: 2.1 }, effects: [{ k: 'dmg', n: 48 }] }),
    a({ id: 'k-drain', cls: 'warlock', name: 'Soul Drink', text: `Channeled for 3 sec. Every 0.5 sec it deals ${K(21)} damage and heals you for 28. Blight Dart pressed meanwhile goes off after it; pressed twice quickly, it stops the drinking.`, icon: 'bound_spirit_chain_on_teal', color: '#c88aff', school: 'shadow', role: 'heal', aim: 'enemy', range: FAR, cast: 0, channel: 3, tick: 0.5, cd: 12, effects: [{ k: 'dmg', n: 21 }, { k: 'heal', n: 28 }] }),
    // (the class's hold, on both)
    a({ id: 'k-dread', cls: 'warlock', name: 'Dread Gaze', text: 'Fears the target for 1.5 sec. Enough damage breaks it.', icon: 'dark_star_on_black', color: '#a060ff', school: 'shadow', role: 'cc', aim: 'enemy', range: FAR, cast: 0.9, cd: 10, bolt: true, effects: [{ k: 'cc', cc: 'fear', dur: 1.5 }] }),
    // the Gravecaller: the dead sent in, and the bolt after them
    // (the dead at her call. They were the Gloamknight's until he became a death knight and a blade in the dark, the
    // owner's friend: "leave summons for a necro warlock spec". What they are and how they fight is THRALL in sim.ts)
    a({ id: 'k-bolt', cls: 'warlock', name: 'Gloom Bolt', text: `Deals ${K(50)} damage.`, icon: 'dark_meteor_on_violet', color: '#a060ff', school: 'shadow', role: 'damage', aim: 'enemy', range: FAR, cast: 1, cd: 0, bolt: true, combo: { name: 'Gloomfire', text: 'Deals 90% more damage to feared targets and targets your ashbound are attacking.', ab: ['k-raise', 'k-super2'], cc: ['fear'], mult: 1.9 }, effects: [{ k: 'dmg', n: 50 }] }),
    a({ id: 'k-raise', cls: 'warlock', name: 'Call the Ashbound', text: `Summons 2 ashbound dead for 14 sec. They attack your target for ${K(9)} damage a hit and slow it by 10%. They can be killed.`, icon: 'raise_dead_grave_with_bones_on_dark_green', color: '#9ae85a', school: 'shadow', role: 'summon', aim: 'self', range: 0, cast: 0, cd: 26, effects: [{ k: 'raise', n: 2, hp: 170, dmg: 9, life: 14, slow: 10 }] }),
    a({ id: 'k-frenzy', cls: 'warlock', name: 'Grave Hunger', text: 'For 6 sec your ashbound deal 40% more damage and move 33% faster. Requires an ashbound.', icon: 'skull_with_green_eyes_on_black', color: '#9ae85a', school: 'shadow', role: 'damage', aim: 'self', range: 0, cast: 0, cd: 16, free: true, effects: [{ k: 'frenzy', pct: 40, dur: 6 }] }),
  ],
  druid: [
    // the Grovekeeper: a mending that keeps on, and the bloom that spends it
    a({ id: 'l-regrow', cls: 'druid', name: 'Green Mending', text: 'Heals a friend for 61 and 54 more over 6 sec.', icon: 'rejuvenate_leaf_drop_on_green', color: '#b8ffb8', school: 'nature', role: 'heal', aim: 'friend', range: FAR, cast: 0.9, cd: 0, effects: [{ k: 'heal', n: 61 }, { k: 'hot', n: 54, dur: 6 }] }),
    a({ id: 'l-bloom', cls: 'druid', name: 'Quick Bloom', text: 'Instantly heals a friend for 100.', icon: 'heart_with_green_gold_sparkles_on_gold', color: '#ffb8e8', school: 'nature', role: 'heal', aim: 'friend', range: FAR, cast: 0, cd: 7, combo: { name: 'Blossom', text: 'Heals 90% more on a friend affected by your Green Mending or Heart of the Grove.', ab: ['l-regrow', 'l-super2'], mult: 1.9 }, effects: [{ k: 'heal', n: 100 }] }),
    // (the class's moon and its roots, on both)
    a({ id: 'l-petal', cls: 'druid', name: 'Stinging Petals', text: `Deals ${L(36)} damage and ${L(86)} more over 8 sec. Usable while moving.`, icon: 'petal_storm_on_teal', color: '#ffb8e8', school: 'nature', role: 'damage', aim: 'enemy', range: FAR, cast: 0, cd: 4, combo: { name: 'Snagged', text: 'Deals 90% more damage to rooted targets.', cc: ['root'], mult: 1.9 }, effects: [{ k: 'dmg', n: 36 }, { k: 'dot', n: 86, dur: 8 }] }),
    a({ id: 'l-moon', cls: 'druid', name: 'Moonburn', text: `Burns the target for ${L(143)} damage over 10 sec. Usable while moving.`, icon: 'moonfire_beam_on_navy', color: '#cfe0ff', school: 'nature', role: 'damage', aim: 'enemy', range: FAR, cast: 0, cd: 5, effects: [{ k: 'dot', n: 143, dur: 10 }] }),
    a({ id: 'l-roots', cls: 'druid', name: 'Grasping Roots', text: 'Roots the target for 2.5 sec. Enough damage breaks it.', icon: 'rooted_status_vines_on_green', color: '#7ad65a', school: 'nature', role: 'cc', aim: 'enemy', range: FAR, cast: 0.8, cd: 10, effects: [{ k: 'cc', cc: 'root', dur: 2.5 }] }),
    // the Starseer: the moon's burn, and starlight on it
    a({ id: 'l-lash', cls: 'druid', name: 'Starlash', text: `Deals ${L(48)} damage.`, icon: 'star_arrow_on_navy', color: '#cfe0ff', school: 'nature', role: 'damage', aim: 'enemy', range: FAR, cast: 0.9, cd: 0, bolt: true, combo: { name: 'Eclipse', text: 'Deals 75% more damage to targets affected by your Moonburn.', ab: ['l-moon'], mult: 1.75 }, effects: [{ k: 'dmg', n: 48 }] }),
    a({ id: 'l-bound', cls: 'druid', name: 'Stag’s Bound', text: 'Increases your movement speed by 60% for 4 sec and removes roots and slows.', icon: 'stag_head_with_antlers_on_green', color: '#c8ffb0', school: 'nature', role: 'mobility', aim: 'self', range: 0, cast: 0, cd: 13, free: true, effects: [{ k: 'break' }, { k: 'speed', pct: 60, dur: 4 }, { k: 'free', dur: 4 }] }),
  ],
  // (its pictures are all of the dark and the violet: one look for the whole bar)
  gloamknight: [
    // the Bloodsworn, a death knight: dragged in, held, reaped
    a({ id: 'g-cleave', cls: 'gloamknight', name: 'Gloam Cleave', text: `Strikes for ${G(31)} damage and heals you for 4.`, icon: 'dark_scythe_on_violet', color: '#c8a8ff', school: 'shadow', role: 'damage', aim: 'enemy', range: MELEE, cast: 0, cd: 0, sticky: true, effects: [{ k: 'dmg', n: 31 }, { k: 'heal', n: 4 }] }),
    a({ id: 'g-reap', cls: 'gloamknight', name: 'Night Reaping', text: `Deals ${G(72)} damage and heals you for 15.`, icon: 'giant_reaper_silhouette_on_black', color: '#9a6ae0', school: 'shadow', role: 'burst', aim: 'enemy', range: MELEE, cast: 0, cd: 8, sticky: true, combo: { name: 'Harvest', text: 'Deals 90% more damage to stunned targets and targets slowed by your Grave Chain.', ab: ['g-chain'], cc: ['stun'], mult: 1.9 }, effects: [{ k: 'dmg', n: 72 }, { k: 'heal', n: 15 }] }),
    a({ id: 'g-chain', cls: 'gloamknight', name: 'Grave Chain', text: 'Pulls an enemy to you, interrupts their cast and slows them by 40% for 3 sec.', icon: 'chain_with_a_hook_pulling_on_grey', color: '#9a8ab8', school: 'shadow', role: 'mobility', aim: 'enemy', range: FAR, cast: 0, cd: 14, free: true, effects: [{ k: 'pull' }, { k: 'slow', pct: 40, dur: 3 }] }),
    a({ id: 'g-hand', cls: 'gloamknight', name: 'Grave Hand', text: 'Stuns the target for 1.5 sec.', icon: 'shadow_hand_grabbing_on_violet', color: '#9a6ae0', school: 'shadow', role: 'cc', aim: 'enemy', range: MID, cast: 0, cd: 17, effects: [{ k: 'cc', cc: 'stun', dur: 1.5 }] }),
    // the Nightblade, a blade in the dark (the owner's friend: "typical dk and a shadow rogue"; and the owner,
    // 2026-11-16: "nightknife basic spells - increases combo points ... the more the points the bigger the dmg")
    a({ id: 'g-knife', cls: 'gloamknight', name: 'Nightknife', text: `Deals ${G(28)} damage, generates 1 Nick and carries your venom.`, icon: 'heart_pierced_by_a_dagger_on_black', color: '#d8c8ff', school: 'physical', role: 'damage', aim: 'enemy', range: MELEE, cast: 0, cd: 0, build: { n: 1 }, combo: { name: 'Unseen Edge', text: 'Deals 90% more damage from behind, or to targets stunned by your Dusk Ambush.', ab: ['g-ambush'], behind: true, mult: 1.9 }, effects: [{ k: 'dmg', n: 28 }] }),
    a({ id: 'g-cut', cls: 'gloamknight', name: 'Closing Cut', text: `Spends all your Nicks to deal ${G(22)} damage, increased by 80% per Nick. Requires at least 1 Nick.`, icon: 'shadow_claw_slash_on_black', color: '#b48cff', school: 'physical', role: 'burst', aim: 'enemy', range: MELEE, cast: 0, cd: 0, spend: { per: 0.8, need: 1 }, effects: [{ k: 'dmg', n: 22 }] }),
    a({ id: 'g-veil', cls: 'gloamknight', name: 'Shroud of Dusk', text: 'Stealth: enemies cannot see you until you attack or take damage, and you move a little slower. In combat it removes roots and slows, cannot be broken for 3 sec and has a 30 sec cooldown; out of combat, 3 sec. You start each match in stealth.', icon: 'vanish_puff_of_smoke_on_violet', color: '#8a6ac8', school: 'physical', role: 'stealth', aim: 'self', range: 0, cast: 0, cd: 30, free: true, quiet: true, effects: [{ k: 'break' }, { k: 'veil' }] }),
    a({ id: 'g-ambush', cls: 'gloamknight', name: 'Dusk Ambush', text: `Requires stealth. Steps behind the target, dealing ${G(37)} damage, stunning for 2 sec and generating 2 Nicks.`, icon: 'blackout_eye_on_violet', color: '#b48cff', school: 'physical', role: 'cc', aim: 'enemy', range: SHORT, cast: 0, cd: 15, veiled: true, sticky: true, build: { n: 2 }, effects: [{ k: 'behind' }, { k: 'dmg', n: 37 }, { k: 'cc', cc: 'stun', dur: 2 }] }),
  ],
};

export const ABILITIES: Record<string, Ability> = Object.fromEntries([...Object.values(KITS).flat(), ...Object.values(SUPERS), ...Object.values(SUPERS2), SIGIL].map((x) => [x.id, x]));
/** Everything a class has besides its supers: both its playstyles' abilities. */
export const kitOf = (cls: ClassId): Ability[] => KITS[cls];
/** Is this one of a class's own abilities (not a super)? */
export const takes = (cls: ClassId, id: unknown): id is string => typeof id === 'string' && !!ABILITIES[id] && !ABILITIES[id]!.super && ABILITIES[id]!.cls === cls;

/**
 * How each class is built before anything is chosen. (The three who fight at arm's length carry about 5% more than
 * they did: the owner found them a little behind, and they spend part of every fight walking to it.) There is no mana
 * in the Ring: an ability waits only on its own cooldown (the owner, 2026-11-15: "remove the mana completely").
 */
export const BODY: Record<ClassId, { hp: number }> = {
  warrior: { hp: 1240 },
  paladin: { hp: 1310 },
  druid: { hp: 1280 },
  ranger: { hp: 1260 },
  priest: { hp: 1130 },
  warlock: { hp: 1200 },
  mage: { hp: 1200 },
  gloamknight: { hp: 1290 },
};

/**
 * A playstyle: one of a class's two ways to fight, with its four abilities (the basic one first, then the one its
 * combo is made with, its utility and its hold), its super, the talents it comes with, and how its combo goes, in
 * words. A player picks one and changes only its talents.
 */
export interface Playstyle {
  id: string;
  name: string;
  bar: string[];
  talents: string[];
  ult: string;
  /** Its heals are for friends: the computer's team-making and its play read it as a healer. */
  healer?: boolean;
  /** The points it builds and spends of itself (a talent may give a playstyle its own instead: arena/talents.ts). */
  points?: Points;
}

export const PRESETS: Record<ClassId, Playstyle[]> = {
  warrior: [
    { id: 'arms', name: 'Reaper', bar: ['w-hew', 'w-gash', 'w-rush', 'w-hurl'], talents: ['w-arms-1a', 'w-arms-2c', 'w-3c'], ult: 'w-super' },
    { id: 'pin', name: 'Hound', bar: ['w-hamstring', 'w-bleed', 'w-rush', 'w-crack'], talents: ['w-pin-1a', 'w-pin-2a', 'w-3a'], ult: 'w-super2' },
  ],
  mage: [
    { id: 'fire', name: 'Pyre', bar: ['m-lash', 'm-burn', 'm-blink', 'm-toad'], talents: ['m-fire-1a', 'm-fire-2c', 'm-3a'], ult: 'm-super' },
    { id: 'frost', name: 'Rime', bar: ['m-spear', 'm-fang', 'm-globe', 'm-ring'], talents: ['m-frost-1a', 'm-frost-2a', 'm-3a'], ult: 'm-super2' },
  ],
  ranger: [
    { id: 'sniper', name: 'Longbow', bar: ['r-swift', 'r-aimed', 'r-leap', 'r-hawk'], talents: ['r-sniper-1a', 'r-sniper-2b', 'r-3a'], ult: 'r-super' },
    { id: 'trapper', name: 'Trapper', bar: ['r-hobble', 'r-wind', 'r-venom', 'r-trap'], talents: ['r-trapper-1a', 'r-trapper-2a', 'r-3b'], ult: 'r-super2' },
  ],
  priest: [
    { id: 'healer', name: 'Lifegiver', healer: true, bar: ['p-mend', 'p-smite', 'p-ward', 'p-wail'], talents: ['p-healer-1a', 'p-healer-2c', 'p-3b'], ult: 'p-super' },
    { id: 'shadow', name: 'Curse-speaker', bar: ['p-gnaw', 'p-curse', 'p-dusk', 'p-hush'], talents: ['p-shadow-1a', 'p-shadow-2a', 'p-3c'], ult: 'p-super2' },
  ],
  paladin: [
    { id: 'holy', name: 'Oathkeeper', healer: true, bar: ['d-flash', 'd-judge', 'd-hands', 'd-hammer'], talents: ['d-holy-1a', 'd-holy-2b', 'd-3a'], ult: 'd-super2' },
    { id: 'ret', name: 'Zealot', bar: ['d-blow', 'd-fall', 'd-stride', 'd-hammer'], talents: ['d-ret-1a', 'd-ret-2a', 'd-3c'], ult: 'd-super' },
  ],
  warlock: [
    { id: 'curses', name: 'Hexer', bar: ['k-dart', 'k-bloom', 'k-drain', 'k-dread'], talents: ['k-curses-1a', 'k-curses-2a', 'k-3c'], ult: 'k-super' },
    { id: 'grave', name: 'Gravecaller', bar: ['k-bolt', 'k-raise', 'k-frenzy', 'k-dread'], talents: ['k-grave-1a', 'k-grave-2b', 'k-3a'], ult: 'k-super2' },
  ],
  druid: [
    { id: 'heal', name: 'Grovekeeper', healer: true, bar: ['l-regrow', 'l-bloom', 'l-petal', 'l-roots'], talents: ['l-heal-1a', 'l-heal-2c', 'l-3a'], ult: 'l-super2' },
    { id: 'star', name: 'Starseer', bar: ['l-lash', 'l-moon', 'l-bound', 'l-roots'], talents: ['l-star-1a', 'l-star-2c', 'l-3b'], ult: 'l-super' },
  ],
  gloamknight: [
    { id: 'reaver', name: 'Bloodsworn', bar: ['g-cleave', 'g-reap', 'g-chain', 'g-hand'], talents: ['g-reaver-1a', 'g-reaver-2b', 'g-3b'], ult: 'g-super' },
    { id: 'shadow', name: 'Nightblade', points: { name: 'Nicks', one: 'Nick', max: 5, color: '#d8c8ff' }, bar: ['g-knife', 'g-cut', 'g-veil', 'g-ambush'], talents: ['g-shadow-1b', 'g-shadow-2a', 'g-3c', 'g-shadow-4a'], ult: 'g-super2' },
  ],
};

/** A class's playstyle by its id, or its first. */
export const styleById = (cls: ClassId, id: string | undefined): Playstyle => PRESETS[cls].find((p) => p.id === id) ?? PRESETS[cls][0]!;

/**
 * The playstyle a bar is: the one it shares most abilities with (the first on a tie). A bar kept from when abilities
 * were chosen one by one, or sent by an older game, becomes the playstyle nearest it.
 */
export function styleOfBar(cls: ClassId, bar: readonly unknown[] | undefined): Playstyle {
  const mine = Array.isArray(bar) ? bar : [];
  let best = PRESETS[cls][0]!;
  let most = -1;
  for (const p of PRESETS[cls]) {
    const n = p.bar.filter((id) => mine.includes(id)).length;
    if (n > most) {
      most = n;
      best = p;
    }
  }
  return best;
}

/** The super that goes with a bar: its playstyle's. */
export function ultFor(cls: ClassId, bar: readonly string[]): string {
  return styleOfBar(cls, bar).ult;
}

/**
 * A bar as it can be fought with: its playstyle's own four, in their own order. What a saved setup and a room's pick
 * are read through, at both ends of a room alike.
 */
export function fullBar(cls: ClassId, bar: readonly unknown[] | undefined): string[] {
  return [...styleOfBar(cls, bar).bar];
}

/**
 * Does `from` set up something `to` lands: by leaving its own mark on the target, by holding them the way a combo
 * needs, by building the points it spends, or by giving the boon it uses?
 */
const setsUp = (from: Ability, to: Ability): boolean => {
  if (from === to) return false;
  const c = to.combo;
  if (c && (!!c.ab?.includes(from.id) || from.effects.some((e) => ((e.k === 'cc' || e.k === 'trap') && !!c.cc?.includes(e.cc)) || (e.k === 'behind' && !!c.behind)))) return true;
  if (to.spend && from.build) return true;
  return !!to.uses?.some((u) => from.gives?.some((g) => g.boon === u.boon));
};

/** How two abilities work together: one sets the target up for the other, builds the points it spends, or gives the boon it uses. */
export type LinkKind = 'combo' | 'points' | 'boon';

/** What two abilities make together, by name and in words: a combo, the points one builds for the other, or a boon. */
const linkOf = (from: Ability, to: Ability, points: Points | undefined): { name: string; text: string; kind: LinkKind } => {
  const c = to.combo;
  if (c && (!!c.ab?.includes(from.id) || from.effects.some((e) => ((e.k === 'cc' || e.k === 'trap') && !!c.cc?.includes(e.cc)) || (e.k === 'behind' && !!c.behind)))) return { name: c.name, text: c.text, kind: 'combo' };
  const boon = to.uses?.map((u) => BOONS[u.boon]).find((b) => b && from.gives?.some((g) => g.boon === b.id));
  if (boon) return { name: boon.name, text: boon.text, kind: 'boon' };
  return { name: points?.name ?? 'Points', text: `${from.name} generates ${points?.name ?? 'points'}. ${to.name} spends them and is stronger for each.`, kind: 'points' };
};

/** A combo a bar can make: the ability that sets it up, the one that lands it, its name, and what kind of thing it is. */
export interface BarCombo {
  name: string;
  text: string;
  kind: LinkKind;
  from: Ability;
  to: Ability;
}

/**
 * The combos a bar holds: every ability on it (its super among them) that lands harder for what another sets up. A
 * setup shows these, so its player knows what to press after what.
 */
export function barCombos(cls: ClassId, bar: readonly string[], ult?: string): BarCombo[] {
  const style = styleOfBar(cls, bar);
  const have = [...bar.map((id) => ABILITIES[id]).filter((x): x is Ability => !!x), ultOf(cls, ult ?? style.ult)];
  const out: BarCombo[] = [];
  for (const to of have) {
    const from = have.find((x) => setsUp(x, to));
    if (from) out.push({ ...linkOf(from, to, style.points), from, to });
  }
  return out;
}

/** What an ability has to do with its playstyle's combos: the ones it lands (and after what), and the ones it sets up. */
export interface AbilityCombos {
  /** The combo this ability lands, and what from its playstyle sets it up (a hold of the right kind counts). */
  lands: { name: string; text: string; kind: LinkKind; after: Ability[] } | null;
  /** The combos of other abilities that this one sets up. */
  setsUp: { name: string; text: string; kind: LinkKind; then: Ability }[];
}

export function combosOf(cls: ClassId, ab: Ability, bar?: readonly string[]): AbilityCombos {
  const style = bar ? styleOfBar(cls, bar) : (PRESETS[cls].find((p) => p.bar.includes(ab.id) || p.ult === ab.id) ?? PRESETS[cls][0]!);
  const all = [...style.bar.map((id) => ABILITIES[id]!), ultOf(cls, style.ult)];
  const after = all.filter((x) => setsUp(x, ab));
  return {
    lands: after.length ? { ...linkOf(after[0]!, ab, style.points), after } : ab.combo ? { name: ab.combo.name, text: ab.combo.text, kind: 'combo', after: [] } : null,
    setsUp: all.filter((y) => setsUp(ab, y)).map((y) => ({ ...linkOf(ab, y, style.points), then: y })),
  };
}

/** Every icon The Ring's abilities and boons show, for the icon build. */
export const ringIcons = (): string[] => [SIGIL.icon, ...Object.values(SUPERS).map((x) => x.icon), ...Object.values(SUPERS2).map((x) => x.icon), ...Object.values(KITS).flat().map((x) => x.icon), ...Object.values(BOONS).map((b) => b.icon)];
