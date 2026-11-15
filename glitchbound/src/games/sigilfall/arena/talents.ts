import type { ClassId } from '../data/types';
import type { Effect } from './abilities';

/**
 * The Ring's talents: three rows, one choice from each, on top of the bar. Every one of them is the whole
 * class's, never one ability's: it works on any hit, any heal, the trinket, the class's super, the spheres and the
 * sigil, falling low or being held, whatever is on the bar (the owner: "if you pick certain spells, the talent options
 * are useless, they should be general for the class").
 *
 * And none of them is an oath again (the owner, 2026-11-13: "most of the talents in the ring are the same as the oath
 * talents, please make them very unique"). Before, 30 of the 72 were an oath's number (more health, more damage, more
 * speed, held shorter, shorter cooldowns) and most of the rest were the same few shared out among the classes. Now each
 * one changes how its class fights, and no two classes have the same one: a warrior's grudge, a mage's blink, a
 * ranger's quarry, a priest's lingering spirit, a paladin's auras, a warlock's imp, a druid's oak, a Gloamknight's
 * plates of bone. What each does is `does` (or `tune`, for the super); arena/sim.ts carries it out.
 *
 * The ids are the ones the old talents had, so a saved setup keeps a talent in each row. Plain data with no imports
 * but types: the icon build reads it.
 */

/** How a talent changes one ability (only the class's super): its strength, cooldown, cast time, or how long what it does lasts, or what it does. */
export interface Tune {
  power?: number;
  cd?: number;
  cast?: number;
  dur?: number;
  /** What throws back pulls in instead (Quakebreaker); what lands on the ground drags everyone on it to its middle (Riftmaw). */
  pull?: boolean;
  /** More that it does to everyone it lands on. */
  extra?: Effect[];
  /** It flies on through everyone in a line behind whoever it is aimed at. */
  line?: boolean;
  /** A friend's spell: it lands on every other friend too, at this share. */
  spread?: number;
  /** It strikes the nearest other enemy as well. */
  bounce?: boolean;
  /** Its user drinks this share of the damage it deals (in place of what it heals by its own words). */
  drink?: number;
  /** What it does to its user as well, as it goes off. */
  self?: Effect[];
  /** What it does to every friend in reach and sight as it goes off, its user among them. */
  friends?: Effect[];
  /** What it does to every enemy near its user (NEAR) as it goes off. */
  foes?: Effect[];
}

/**
 * What a talent does that isn't a number on its class: each kind is one talent's, and its numbers are here so that its
 * words and what it does can't drift apart.
 */
export type Doing =
  // the warrior
  | { k: 'grudge'; step: number; max: number }
  | { k: 'check'; dur: number; every: number; reach: number }
  | { k: 'scar'; step: number; max: number; dur: number }
  | { k: 'loose'; pct: number; dur: number }
  // the mage
  | { k: 'wildfire'; share: number; dur: number }
  | { k: 'brim'; over: number; pct: number }
  | { k: 'fold'; far: number }
  | { k: 'third'; n: number; within: number; dur: number; every: number }
  | { k: 'skin'; share: number; above: number }
  | { k: 'rewind'; back: number; share: number; every: number }
  | { k: 'vanish'; dist: number; every: number }
  // the ranger
  | { k: 'quarry'; pct: number }
  | { k: 'far'; pct: number }
  | { k: 'pin'; dur: number; every: number }
  | { k: 'cry'; lock: number; every: number }
  | { k: 'cover'; after: number; pct: number }
  | { k: 'forage'; more: number; pct: number; dur: number }
  | { k: 'antivenom'; pct: number }
  // the priest
  | { k: 'returned'; share: number }
  | { k: 'overflow'; cap: number; dur: number }
  | { k: 'leap'; far: number; reach: number }
  | { k: 'sap'; pct: number; dur: number }
  | { k: 'halo'; dur: number; every: number }
  | { k: 'spirit'; dur: number }
  | { k: 'ward'; pct: number; every: number }
  | { k: 'open'; pct: number }
  // the paladin
  | { k: 'verdict'; every: number; n: number }
  | { k: 'wrath'; pct: number }
  | { k: 'resolve'; pct: number }
  | { k: 'freedom'; every: number }
  | { k: 'stern'; push: number }
  | { k: 'burden'; share: number }
  | { k: 'plate'; pct: number }
  | { k: 'vow'; under: number; dur: number }
  // the warlock
  | { k: 'imp'; n: number; every: number; range: number }
  | { k: 'desperate'; pct: number }
  | { k: 'enfeeble'; pct: number; dur: number }
  | { k: 'shadeward'; pct: number; dur: number }
  | { k: 'mirror'; share: number; every: number }
  | { k: 'pact'; pct: number; every: number }
  | { k: 'bargain'; pct: number }
  | { k: 'soulward'; pct: number; max: number; dur: number; every: number }
  // the druid
  | { k: 'tides'; pct: number }
  | { k: 'seasons'; pct: number }
  | { k: 'stag'; pct: number; dur: number }
  | { k: 'bramble'; n: number; pct: number; dur: number }
  | { k: 'gale'; dist: number; every: number }
  | { k: 'oak'; dur: number; guard: number; pct: number; every: number }
  | { k: 'vigor'; pct: number; every: number }
  | { k: 'shed'; heal: number }
  // the Gloamknight
  | { k: 'price'; cost: number; pct: number }
  | { k: 'shade'; pct: number }
  | { k: 'drag'; reach: number; every: number; pct: number; dur: number }
  | { k: 'mantle'; pct: number }
  | { k: 'knell'; pct: number }
  | { k: 'revenant'; dur: number; live: number }
  | { k: 'thirst'; pct: number }
  | { k: 'bones'; n: number; pct: number; every: number };

/** A fighter's doings, by kind (a fighter has one talent a row, so three at most). */
export type Does = { [K in Doing['k']]?: Extract<Doing, { k: K }> };

export interface Talent {
  id: string;
  cls: ClassId;
  row: 0 | 1 | 2;
  name: string;
  text: string;
  /** Its own icon; without one it wears the ability it changes. */
  icon?: string;
  /** The class's super, by id: what every hero of the class carries, whatever is on their bar. */
  tune?: Record<string, Tune>;
  does?: Doing;
  /** A share off all damage taken. */
  guard?: number;
  /** Holds and slows put on others last this share longer. */
  hold?: number;
  /** This share more damage to anyone under EXECUTE of their health. */
  exec?: number;
  /** What is hit (a blow or a spell landing, not what burns over time) is slowed by `pct`% for `dur` seconds. */
  slow?: { pct: number; dur: number };
  /** A blow stuns for `dur` seconds, at most once every `every`. */
  stun?: { dur: number; every: number };
  /** The trinket leaves a snare where they stand that holds the first enemy on it `dur` seconds, at most once every `every`. */
  snare?: { dur: number; every: number };
  /** Falling under RALLY of your health heals `pct` of it at once, at most once every `every` seconds. */
  rally?: { pct: number; every: number };
}

export const ROW_NAMES = ['Power', 'Control', 'Staying alive'] as const;

/** Under this share of their health a fighter counts as low: a Headsman's mark, and when a Second Wind, an oak or a pact comes. */
export const EXECUTE = 0.35;
export const RALLY = 0.35;
/** How far "near you" reaches, for a talent that helps friends or hinders enemies round its hero (a paladin's aura). */
export const NEAR = 100;
/** How far "within arm's reach" is (a little past a blow's own reach). */
export const ARM = 40;

const rowOf = (cls: ClassId, row: 0 | 1 | 2, list: Omit<Talent, 'cls' | 'row' | 'id'>[], prefix: string): Talent[] => list.map((x, i) => ({ ...x, cls, row, id: `${prefix}-${row + 1}${'abc'[i]}` }));

export const TALENTS: Record<ClassId, Talent[]> = {
  // a brawler who won't let go: the longer he stays on someone, the worse it gets for them
  warrior: [
    ...rowOf('warrior', 0, [
      { name: 'Grudge', text: 'Each blow in a row on the same enemy hits 2% harder, up to 10%. Turning on someone else starts it over.', icon: 'sword_with_three_stacked_chevrons_on_red', does: { k: 'grudge', step: 0.02, max: 5 } },
      { name: 'Headsman', text: 'Deal 25% more damage to anyone under 35% health.', icon: 'death_mark_target_on_black', exec: 0.25 },
      { name: 'Warpath', text: 'Your super hits 15% harder, and for 4 seconds after it nothing slows or roots you and you run 30% faster.', icon: 'stomping_boot_with_a_quake_ring_on_brown', tune: { super: { power: 1.15, self: [{ k: 'break' }, { k: 'free', dur: 4 }, { k: 'speed', pct: 30, dur: 4 }] } } },
    ], 'w'),
    // (the warrior's holds were too many and too long, one after another: the owner, "warriors have too much cc ...
    // or maybe make cc into talent options". Its bar holds less, and a stun or a slow on every blow is chosen here)
    ...rowOf('warrior', 1, [
      { name: 'Crippling Blows', text: 'What you hit is slowed by 20% for 2 seconds.', icon: 'slowed_status_snail_on_teal', slow: { pct: 20, dur: 2 } },
      { name: 'Bonebreaker', text: 'Once every 12 seconds, a blow stuns for 1 second.', icon: 'stunned_status_stars_on_yellow', stun: { dur: 1, every: 12 } },
      { name: 'Shoulder Check', text: 'Your trinket knocks the nearest enemy beside you off their feet: stunned for 1.5 seconds.', icon: 'shield_bash_with_impact_rays_on_red', does: { k: 'check', dur: 1.5, every: 10, reach: 60 } },
    ], 'w'),
    ...rowOf('warrior', 2, [
      { name: 'Scar Tissue', text: 'Every blow that lands on you hardens you: 2% less damage taken for 6 seconds, up to 10%.', icon: 'rock_armour_skin_on_brown', does: { k: 'scar', step: 0.02, max: 0.1, dur: 6 } },
      { name: 'Break Loose', text: 'When a hold on you ends, you run 50% faster for 3 seconds.', icon: 'broken_chain_links_snapping_on_grey', does: { k: 'loose', pct: 50, dur: 3 } },
      { name: 'Second Wind', text: 'Fall under 35% health and you heal 12% of your health at once, at most every 45 seconds.', icon: 'burning_heart_on_red', rally: { pct: 0.12, every: 45 } },
    ], 'w'),
  ],
  // glass that bends space: fire that spreads, frost that counts, and never where the blow lands
  mage: [
    ...rowOf('mage', 0, [
      { name: 'Wildfire', text: 'Your critical hits set them burning: 40% of the hit again over 4 seconds.', icon: 'fire_eye_on_red', does: { k: 'wildfire', share: 0.4, dur: 4 } },
      { name: 'Brimming Power', text: 'While your health is above 80%, your spells hit 12% harder.', icon: 'magic_up_status_star_arrow_up_on_violet', does: { k: 'brim', over: 0.8, pct: 0.12 } },
      { name: 'Spellscar', text: 'Everyone your super hits is left spellscarred: 72 more over 6 seconds. And you come out of it quickened, 25% faster for 4 seconds.', icon: 'lightning_hourglass_on_violet', tune: { super: { extra: [{ k: 'dot', n: 100, dur: 6 }], self: [{ k: 'speed', pct: 25, dur: 4 }] } } },
    ], 'm'),
    ...rowOf('mage', 1, [
      { name: 'Long Winter', text: 'Holds and slows you put on an enemy last 25% longer, your super’s too.', icon: 'frozen_chain_on_navy', hold: 0.25 },
      { name: 'Fold Space', text: 'Your trinket also blinks you a short way the way you’re facing.', icon: 'spirit_swap_arrows_on_teal', does: { k: 'fold', far: 70 } },
      { name: 'Third Chill', text: 'Every third hit on the same enemy within 6 seconds freezes them to the ground for 1.2 seconds. Once every 20 seconds.', icon: 'frozen_status_snowflake_on_blue', does: { k: 'third', n: 3, within: 6, dur: 1.2, every: 20 } },
    ], 'm'),
    ...rowOf('mage', 2, [
      { name: 'Arcane Skin', text: 'While your health is above 50%, you take 20% less damage.', icon: 'shield_status_bubble_on_blue', does: { k: 'skin', share: 0.2, above: 0.5 } },
      { name: 'Rewind', text: 'Your trinket also takes back half the damage you took in the 3 seconds before it.', icon: 'frozen_hourglass_on_navy', does: { k: 'rewind', back: 3, share: 0.5, every: 30 } },
      { name: 'Vanishing Point', text: 'Fall under 35% health and you vanish, to appear away from the nearest enemy, out of roots and slows. Once every 30 seconds.', icon: 'vanish_puff_of_smoke_on_violet', does: { k: 'vanish', dist: 100, every: 30 } },
    ], 'm'),
  ],
  // the kiter: marks a quarry, hits hardest from far off, and heals where nobody can see
  ranger: [
    ...rowOf('ranger', 0, [
      { name: 'Quarry', text: 'Your hits mark one enemy at a time: your whole side deals 10% more damage to them.', icon: 'marked_status_target_on_red', does: { k: 'quarry', pct: 0.1 } },
      { name: 'Long Shot', text: 'Hits from farther than half their reach away hit 15% harder.', icon: 'long_range_arrow_with_a_scope_ring_on_teal', does: { k: 'far', pct: 0.15 } },
      { name: 'Doomed Prey', text: 'Everyone your super hits is marked for 8 seconds: your whole side deals them 15% more damage.', icon: 'death_mark_target_on_black', tune: { super: { extra: [{ k: 'mark', pct: 15, dur: 8 }] } } },
    ], 'r'),
    ...rowOf('ranger', 1, [
      { name: 'Pinning Shot', text: 'A critical hit pins them to the ground for 1.5 seconds. Once every 12 seconds.', icon: 'rope_arrow_with_a_hook_on_brown', does: { k: 'pin', dur: 1.5, every: 12 } },
      { name: 'Wild Snare', text: 'Your trinket leaves a snare where you stand: the first enemy on it is held for 1.5 seconds.', icon: 'snare_loop_on_green', snare: { dur: 1.5, every: 15 } },
      { name: 'Hawk’s Cry', text: 'Once every 20 seconds, hitting someone mid-cast cuts the cast off and locks its school for 2 seconds.', icon: 'eagle_eye_on_teal', does: { k: 'cry', lock: 2, every: 20 } },
    ], 'r'),
    ...rowOf('ranger', 2, [
      { name: 'Cover', text: 'After 1.5 seconds out of every enemy’s sight, you heal 4% of your health each second.', icon: 'hidden_glade_on_green', does: { k: 'cover', after: 1.5, pct: 0.04 } },
      { name: 'Forager', text: 'Healing spheres and the sigil heal you 20% more, and quicken you by 15% for 3 seconds.', icon: 'fruit_of_life_on_green', does: { k: 'forage', more: 0.2, pct: 15, dur: 3 } },
      { name: 'Antivenom', text: 'Burns, bleeds, curses and poisons hurt you 25% less.', icon: 'poison_vial_on_green', does: { k: 'antivenom', pct: 0.25 } },
    ], 'r'),
  ],
  // heals by fighting, shields by overflowing, and keeps on after falling
  priest: [
    ...rowOf('priest', 0, [
      { name: 'Light Returned', text: '10% of the damage you deal heals whichever friend is most hurt (you, if nobody is hurt more).', icon: 'light_crescent_and_a_sun_on_gold', does: { k: 'returned', share: 0.1 } },
      { name: 'Bright Wings', text: 'When your super goes off, every friend in reach is touched by it: healed 100, and freed of one curse, poison or hex.', icon: 'pair_of_white_wings_opening_on_gold', tune: { super: { friends: [{ k: 'heal', n: 100 }, { k: 'dispel' }] } } },
      { name: 'Brimming Grace', text: 'Your healing past full health becomes a shield, up to 12% of their health, for 8 seconds.', icon: 'golden_chalice_with_a_light_glow_on_gold', does: { k: 'overflow', cap: 0.12, dur: 8 } },
    ], 'p'),
    ...rowOf('priest', 1, [
      { name: 'Guardian Leap', text: 'With a friend chosen within reach, your trinket also leaps you to their side.', icon: 'winged_golden_boot_on_gold', does: { k: 'leap', far: 1.3, reach: 200 } },
      { name: 'Sapping Word', text: 'Enemies you hurt are healed 12% less for 3 seconds.', icon: 'anti_heal_status_broken_heart_on_black', does: { k: 'sap', pct: 12, dur: 3 } },
      { name: 'Halo of Dread', text: 'Once every 25 seconds, the next enemy to hit you flees in fear for 1 second.', icon: 'blessed_status_halo_on_gold', does: { k: 'halo', dur: 1, every: 25 } },
    ], 'p'),
    ...rowOf('priest', 2, [
      { name: 'Lingering Spirit', text: 'When you fall, you linger 3 seconds as a spirit: nothing can hurt or heal you, and you can still fight. Once a match.', icon: 'white_wing_over_a_heart_on_gold', does: { k: 'spirit', dur: 3 } },
      { name: 'Morning Ward', text: 'Every 20 seconds a ward forms on you that soaks up 5% of your health.', icon: 'holy_resist_status_sun_shield_on_gold', does: { k: 'ward', pct: 0.05, every: 20 } },
      { name: 'Open Heart', text: 'All healing you are given is 10% stronger: your own, your friends’, the spheres and the sigil.', icon: 'heart_with_green_gold_sparkles_on_gold', does: { k: 'open', pct: 0.1 } },
    ], 'p'),
  ],
  // the protector: light every few blows, and auras that his friends stand in
  paladin: [
    ...rowOf('paladin', 0, [
      { name: 'Verdict of Light', text: 'Every fifth hit you land calls down light: 15 more damage, and 15 healing for whichever friend is most hurt.', icon: 'beam_of_light_from_the_sky_on_gold', does: { k: 'verdict', every: 5, n: 15 } },
      { name: 'Aura of Wrath', text: 'You and friends near you deal 6% more damage.', icon: 'golden_armoured_fist_with_a_light_burst_on_gold', does: { k: 'wrath', pct: 0.06 } },
      { name: 'Blinding Dawn', text: 'When your super goes off, light bursts round you: every enemy near you is dazed for 2 seconds (any damage breaks it).', icon: 'divine_eye_with_light_rays_on_gold', tune: { super: { foes: [{ k: 'cc', cc: 'incap', dur: 2 }] } } },
    ], 'd'),
    ...rowOf('paladin', 1, [
      { name: 'Aura of Resolve', text: 'Holds on you and friends near you last 20% shorter.', icon: 'radiant_crown_of_light_on_gold', does: { k: 'resolve', pct: 0.2 } },
      { name: 'Hand of Freedom', text: 'Once every 20 seconds, a root or slow put on you or a friend near you is shaken off at once.', icon: 'open_hand_of_light_with_a_white_star_on_gold', does: { k: 'freedom', every: 20 } },
      { name: 'Stern Blows', text: 'Your hits knock a cast back three times as far, as often as they land.', icon: 'golden_scales_of_justice_on_gold', does: { k: 'stern', push: 0.75 } },
    ], 'd'),
    ...rowOf('paladin', 2, [
      { name: 'Shared Burden', text: 'A fifth of the damage friends near you take is yours instead, and you take 6% less.', icon: 'golden_heart_with_white_wings_on_gold', guard: 0.06, does: { k: 'burden', share: 0.2 } },
      { name: 'Plate and Prayer', text: 'Blows and arrows hurt you 15% less.', icon: 'shining_tower_shield_with_a_lion_on_gold', does: { k: 'plate', pct: 0.15 } },
      { name: 'Unbroken Vow', text: 'The first time each match you fall under 20% health, nothing can touch you for 2 seconds.', icon: 'invincible_status_gold_shield_on_gold', does: { k: 'vow', under: 0.2, dur: 2 } },
    ], 'd'),
  ],
  // bargains: an imp on the shoulder, power bought with blood, curses thrown back
  warlock: [
    ...rowOf('warlock', 0, [
      { name: 'Pit Imp', text: 'An imp rides on your shoulder and spits shadow at your enemy every 3 seconds: 10 damage.', icon: 'shadow_imp_summon_on_black', does: { k: 'imp', n: 10, every: 3, range: 185 } },
      { name: 'Black Desperation', text: 'The lower your health, the harder you hit: up to 20% harder at the very end.', icon: 'burning_red_eye_of_rage_on_black', does: { k: 'desperate', pct: 0.2 } },
      { name: 'Doom’s Herald', text: 'When your super goes off, every enemy near you is cursed: 108 over 8 seconds.', icon: 'hex_mark_eye_on_black', tune: { super: { foes: [{ k: 'dot', n: 120, dur: 8 }] } } },
    ], 'k'),
    ...rowOf('warlock', 1, [
      { name: 'Enfeeble', text: 'Enemies you hurt deal 8% less damage for 3 seconds.', icon: 'cursed_status_dark_cloud_on_violet', does: { k: 'enfeeble', pct: 8, dur: 3 } },
      { name: 'Shadow Ward', text: 'Your trinket also wards you for 12% of your health, for 6 seconds.', icon: 'dark_portal_on_black', does: { k: 'shadeward', pct: 0.12, dur: 6 } },
      { name: 'Mirror Curse', text: 'Once every 20 seconds, the first hold put on you is turned back on whoever put it, for half as long.', icon: 'cursed_mirror_on_violet', does: { k: 'mirror', share: 0.5, every: 20 } },
    ], 'k'),
    ...rowOf('warlock', 2, [
      { name: 'Hollow Pact', text: 'Fall under 35% health and heal 25% of your health. Once every 45 seconds.', icon: 'dark_heart_beating_on_black', does: { k: 'pact', pct: 0.25, every: 45 } },
      { name: 'Unholy Bargain', text: 'Take 12% less damage, but all healing on you is 25% weaker.', icon: 'cursed_silver_coin_on_black', guard: 0.12, does: { k: 'bargain', pct: 0.25 } },
      { name: 'Soul Shield', text: 'Every 2 seconds that you deal damage, a hit or a burn, you are warded for 1% of your health, up to 4%, for 5 seconds.', icon: 'soul_orb_rising_on_violet', does: { k: 'soulward', pct: 0.01, max: 0.04, dur: 5, every: 2 } },
    ], 'k'),
  ],
  // the wild: sun and moon in turn, the shapes of beasts, and an old oak when it goes badly
  druid: [
    ...rowOf('druid', 0, [
      { name: 'Sun and Moon', text: 'Dealing damage makes your next heal 25% stronger; healing makes your next hit 25% stronger.', icon: 'eclipse_sun_on_black', does: { k: 'tides', pct: 0.25 } },
      { name: 'Grove’s Bloom', text: 'When your super goes off, every friend in reach blooms: 80 healing over 6 seconds, and 15% faster for 4.', icon: 'nature_spirit_on_teal', tune: { super: { friends: [{ k: 'hot', n: 80, dur: 6 }, { k: 'speed', pct: 15, dur: 4 }] } } },
      { name: 'Long Seasons', text: 'Your heals and burns over time last 30% longer.', icon: 'fern_unfurling_on_teal', does: { k: 'seasons', pct: 0.3 } },
    ], 'l'),
    ...rowOf('druid', 1, [
      { name: 'Stag Form', text: 'Your trinket also makes you a stag for 2 seconds: 40% faster and free of roots and slows.', icon: 'stag_head_with_antlers_on_green', does: { k: 'stag', pct: 40, dur: 2 } },
      { name: 'Bramble Hide', text: 'Anyone who strikes you with a blow takes 12 damage back and is slowed by 20% for 2 seconds.', icon: 'thorn_shield_on_dark_green', does: { k: 'bramble', n: 12, pct: 20, dur: 2 } },
      { name: 'Gale Ward', text: 'Once every 18 seconds, an enemy who comes within arm’s reach is thrown back by a gust.', icon: 'wind_leaf_on_teal', does: { k: 'gale', dist: 60, every: 18 } },
    ], 'l'),
    ...rowOf('druid', 2, [
      { name: 'Heartwood', text: 'Fall under 35% health and you take root as an old oak for 4 seconds: 40% less damage taken, 4% of your health back each second. Once a minute.', icon: 'treant_face_on_green', does: { k: 'oak', dur: 4, guard: 0.4, pct: 0.04, every: 60 } },
      { name: 'Wild Vigor', text: 'You heal 2% of your health every 5 seconds.', icon: 'regeneration_leaf_mastery_on_green', does: { k: 'vigor', pct: 0.02, every: 5 } },
      { name: 'Shed Skin', text: 'Your trinket also takes one more curse off you (a weakness, a mark or the like), and mends 4% of your health.', icon: 'falling_leaves_on_orange', does: { k: 'shed', heal: 0.04 } },
    ], 'l'),
  ],
  // the dark that drinks: blows bought with blood, a blade out of the shroud, and a grave he won't stay in
  gloamknight: [
    ...rowOf('gloamknight', 0, [
      { name: 'Blood Price', text: 'Each attack you make costs 1% of your health and hits 20% harder.', icon: 'heart_pierced_by_a_dagger_on_black', does: { k: 'price', cost: 0.01, pct: 0.2 } },
      { name: 'Night’s Embrace', text: 'Hidden, you move at full speed, and the first blow you strike out of the shroud hits 30% harder.', icon: 'shadow_fox_mask_on_violet', does: { k: 'shade', pct: 0.3 } },
      { name: 'Eclipse Hunger', text: 'Your super drinks 80% of what it deals.', icon: 'eclipse_sun_on_black', tune: { super: { drink: 0.8 } } },
    ], 'g'),
    ...rowOf('gloamknight', 1, [
      { name: 'Drag Below', text: 'Your trinket also drags the nearest enemy within reach to your side, slowed by half for 2 seconds.', icon: 'chain_with_a_hook_pulling_on_grey', does: { k: 'drag', reach: 120, every: 10, pct: 50, dur: 2 } },
      { name: 'Dusk Mantle', text: 'Enemies within arm’s reach of you move 15% slower.', icon: 'shadow_veil_curtain_on_violet', does: { k: 'mantle', pct: 0.15 } },
      { name: 'Death Knell', text: 'Enemies under 35% health near you are healed 40% less.', icon: 'skull_lantern_on_black', does: { k: 'knell', pct: 0.4 } },
    ], 'g'),
    ...rowOf('gloamknight', 2, [
      { name: 'Unquiet Grave', text: 'Once a match, a killing blow makes you a revenant for 5 seconds: you drink all you deal, and nobody else can heal you. End it above 25% health and you live.', icon: 'ghost_face_screaming_on_teal', does: { k: 'revenant', dur: 5, live: 0.25 } },
      { name: 'Thirst of Dusk', text: 'You and friends near you drink 12% of the damage you deal.', icon: 'vampire_bat_on_black', does: { k: 'thirst', pct: 0.12 } },
      { name: 'Bone Shield', text: 'Three plates of bone each take 30% off one hit and break. One grows back every 8 seconds.', icon: 'bone_heap_on_grey', does: { k: 'bones', n: 3, pct: 0.3, every: 8 } },
    ], 'g'),
  ],
};

export const TALENT_BY_ID: Record<string, Talent> = Object.fromEntries(Object.values(TALENTS).flat().map((x) => [x.id, x]));

/** One from each row at most: anything else in a list of choices is dropped. */
export function cleanTalents(cls: ClassId, ids: readonly string[] | undefined): Talent[] {
  const out: Talent[] = [];
  for (const id of ids ?? []) {
    const x = TALENT_BY_ID[id];
    if (x && x.cls === cls && !out.some((o) => o.row === x.row)) out.push(x);
  }
  return out;
}

/** The icons that aren't an ability's (the talents' own, and the new-rank banner's), for the icon build. */
export const talentIcons = (): string[] => [...new Set(['crit_up_status_star_burst_on_gold', ...Object.values(TALENTS).flatMap((list) => list.flatMap((t) => (t.icon ? [t.icon] : [])))])];
