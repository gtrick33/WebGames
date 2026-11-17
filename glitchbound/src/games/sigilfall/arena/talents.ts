import type { ClassId } from '../data/types';
import type { Build, Effect, Give, Points, Spend, Use } from './abilities';

/**
 * The Ring's talents: three rows, one choice from each, and the only thing a player changes about a playstyle (the
 * owner, 2026-11-16: "fixed spells per playstyle, only talents need to be changed", "talents should be played around
 * the combos and make the spells more fun ... make talents very fun and defining").
 *
 * The first two rows are the playstyle's own. "Core" is how its combo is made: one choice lights an ability up for a
 * single use now and then (a boon, its sign drawn beside the hero), one gives the playstyle points that its basic
 * ability builds and its hard one spends, and one is plain, for whoever would rather not count. "Utility" is what its
 * utility and its hold do besides. The third row, "Defensive", is the whole class's.
 *
 * Before, all three rows were the whole class's and none could name an ability, since any ability might be left off
 * the bar (the owner then: "if you pick certain spells, the talent options are useless"). With the bar fixed, a
 * talent works on the abilities by name: `tune`. What isn't an ability's is `does`; arena/sim.ts carries both out.
 *
 * Plain data with no imports but types: the icon build reads it.
 */

/** How a talent changes one ability of its playstyle (by id), or its super. */
export interface Tune {
  /** Its numbers, its cooldown, its cast time and how long its hold lasts: each multiplied by this. */
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
  /** It builds points (in place of what it builds by its own words). */
  build?: Build;
  /** It spends its user's points. */
  spend?: Spend;
  /** Boons it gives its user, besides its own. */
  gives?: Give[];
  /** Boons it uses, besides its own (one it uses already takes on what is said here as well). */
  uses?: Use[];
  /** Every `n`th of its landings does `extra` as well, called out by `name`. */
  nth?: { n: number; extra: Effect[]; name: string };
  /** It can be cast on the move at full speed. */
  swift?: boolean;
  /** It raises this many more. */
  more?: number;
  /** What it leaves on the ground stays this many times as long. */
  linger?: number;
}

/**
 * What a talent does that isn't a change to one ability: each kind is one talent's, and its numbers are here so that
 * its words and what it does can't drift apart.
 */
export type Doing =
  // the warrior
  | { k: 'grudge'; step: number; max: number }
  | { k: 'scar'; step: number; max: number; dur: number }
  | { k: 'loose'; pct: number; dur: number }
  // the mage
  | { k: 'wildfire'; share: number; dur: number; crit: number }
  | { k: 'third'; n: number; within: number; dur: number; every: number }
  | { k: 'skin'; share: number; above: number }
  | { k: 'rewind'; back: number; share: number; every: number }
  | { k: 'vanish'; dur: number; haste: number; every: number }
  // the ranger
  | { k: 'quarry'; pct: number }
  | { k: 'far'; pct: number }
  | { k: 'cover'; after: number; pct: number }
  | { k: 'forage'; more: number; pct: number; dur: number }
  | { k: 'antivenom'; pct: number }
  // the priest
  | { k: 'returned'; share: number }
  | { k: 'overflow'; cap: number; dur: number }
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
  | { k: 'enfeeble'; pct: number; dur: number }
  | { k: 'mirror'; share: number; every: number }
  | { k: 'corpse'; n: number; reach: number }
  | { k: 'pact'; pct: number; every: number }
  | { k: 'bargain'; pct: number }
  | { k: 'soulward'; pct: number; max: number; dur: number; every: number }
  // the druid
  | { k: 'tides'; pct: number }
  | { k: 'seasons'; pct: number }
  | { k: 'bramble'; n: number; pct: number; dur: number }
  | { k: 'gale'; dist: number; every: number }
  | { k: 'oak'; dur: number; guard: number; pct: number; every: number }
  | { k: 'vigor'; pct: number; every: number }
  // the Gloamknight
  | { k: 'price'; cost: number; pct: number }
  | { k: 'shade'; pct: number }
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
  /** The playstyle it belongs to (abilities.ts PRESETS, by id); without one it is the whole class's. */
  spec?: string;
  row: 0 | 1 | 2;
  name: string;
  text: string;
  /** Its own icon; without one it wears the ability it changes. */
  icon?: string;
  /** What it changes, by ability id (`super`: whichever super its hero carries). */
  tune?: Record<string, Tune>;
  /** The points it gives its playstyle (what builds and spends them is in `tune`). */
  points?: Points;
  does?: Doing;
  /** A share off all damage taken. */
  guard?: number;
  /** Holds and slows put on others last this share longer. */
  hold?: number;
  /** This share more damage to anyone under EXECUTE of their health. */
  exec?: number;
  /** Falling under RALLY of your health heals `pct` of it at once, at most once every `every` seconds. */
  rally?: { pct: number; every: number };
}

/** (They were "Combo", "Tricks" and "Staying alive" until the owner, 2026-11-16: "rename combo to core, tricks to utility" and the third to defensive.) */
export const ROW_NAMES = ['Core', 'Utility', 'Defensive'] as const;
/** What each row is for, in a line (the setup page says it over the row). */

/** Under this share of their health a fighter counts as low: a Headsman's mark, and when a Second Wind, an oak or a pact comes. */
export const EXECUTE = 0.35;
export const RALLY = 0.35;
/** How far "near you" reaches, for a talent that helps friends or hinders enemies round its hero (a paladin's aura). */
export const NEAR = 100;
/** How far "within arm's reach" is (a little past a blow's own reach). */
export const ARM = 40;

type Row = Omit<Talent, 'cls' | 'row' | 'id' | 'spec'>[];
/** A playstyle's own two rows: ids `<class letter>-<playstyle>-<row><a|b|c>`. */
const styleRows = (cls: ClassId, prefix: string, spec: string, rows: [Row, Row]): Talent[] => rows.flatMap((list, row) => list.map((x, i) => ({ ...x, cls, spec, row: row as 0 | 1, id: `${prefix}-${spec}-${row + 1}${'abc'[i]}` })));
/** The class's own row, the third: ids `<class letter>-3<a|b|c>`, as they have always been. */
const classRow = (cls: ClassId, prefix: string, list: Row): Talent[] => list.map((x, i) => ({ ...x, cls, row: 2, id: `${prefix}-3${'abc'[i]}` }));

export const TALENTS: Record<ClassId, Talent[]> = {
  // a brawler who won't let go
  warrior: [
    ...styleRows('warrior', 'w', 'arms', [
      [
        { name: 'Red Mist', text: 'Hew has a 30% chance, and always on a critical hit, to trigger Red Mist: your next Festering Gash has no cooldown and deals 50% more damage.', icon: 'rage_status_red_eye_on_red', tune: { 'w-hew': { gives: [{ boon: 'mist', chance: 0.3, crit: true }] }, 'w-gash': { uses: [{ boon: 'mist', nocd: true, mult: 1.5 }] } } },
        { name: 'Butcher’s Tally', text: 'Hew generates a Notch, up to 4. Festering Gash spends them to deal 25% more damage per Notch, bleed included.', icon: 'sword_with_three_stacked_chevrons_on_red', points: { name: 'Notches', one: 'Notch', max: 4, color: '#ff8a7a' }, tune: { 'w-hew': { build: { n: 1 } }, 'w-gash': { spend: { per: 0.25 } } } },
        { name: 'Headsman', text: 'Deal 75% more damage to enemies below 35% health.', icon: 'death_mark_target_on_black', exec: 0.75 },
      ],
      [
        { name: 'Thunderous Rush', text: 'Bull Rush also stuns for 0.8 sec.', icon: 'charging_bull_head_in_steel_on_red', tune: { 'w-rush': { extra: [{ k: 'cc', cc: 'stun', dur: 0.8 }] } } },
        { name: 'Ricochet', text: 'Hurled Maul bounces to the nearest other enemy. Cooldown reduced by 25%.', icon: 'shield_bash_with_impact_rays_on_red', tune: { 'w-hurl': { bounce: true, cd: 0.75 } } },
        { name: 'Warpath', text: 'Bull Rush cooldown reduced by 3 sec. It removes roots and slows, and for 3 sec afterward you move 30% faster and cannot be slowed or rooted.', icon: 'running_boot_with_speed_lines_on_red', tune: { 'w-rush': { cd: 0.7, self: [{ k: 'break' }, { k: 'free', dur: 3 }, { k: 'speed', pct: 30, dur: 3 }] } } },
      ],
    ]),
    ...styleRows('warrior', 'w', 'pin', [
      [
        { name: 'Mounting Ire', text: 'Hock Cut generates Ire, up to 5. Rending Cut spends it to deal 20% more damage per Ire, bleed included. Run Them Down fills your Ire.', icon: 'angry_status_steam_cloud_on_red', points: { name: 'Ire', one: 'Ire', max: 5, color: '#ff6a4a' }, tune: { 'w-hamstring': { build: { n: 1 } }, 'w-bleed': { spend: { per: 0.2 } }, 'w-super2': { build: { n: 5, on: 'cast' } } } },
        { name: 'Blood Up', text: 'Each tick of your Rending Cut bleed has a 50% chance to trigger Blood Up (stacks twice): your next Hock Cut deals triple damage.', icon: 'berserk_status_red_horned_mask_on_red', tune: { 'w-bleed': { gives: [{ boon: 'bloodup', chance: 0.5, on: 'tick' }] }, 'w-hamstring': { uses: [{ boon: 'bloodup', mult: 3 }] } } },
        { name: 'Grudge', text: 'Each consecutive hit on the same enemy deals 11% more damage, up to 55%. Switching targets resets it.', icon: 'crossed_sword_and_axe_on_red', does: { k: 'grudge', step: 0.11, max: 5 } },
      ],
      [
        { name: 'Crippling Blows', text: 'Hock Cut slows by 60% for 4 sec.', icon: 'slowed_status_snail_on_teal', tune: { 'w-hamstring': { extra: [{ k: 'slow', pct: 60, dur: 4 }] } } },
        { name: 'Bonebreaker', text: 'Skull Crack deals triple damage. Cooldown reduced by 25%.', icon: 'stunned_status_stars_on_yellow', tune: { 'w-crack': { power: 3, cd: 0.75 } } },
        { name: 'Run Down', text: 'Bull Rush cooldown reduced by 4 sec. You move 30% faster for 3 sec afterward.', icon: 'burning_boot_with_speed_flames_on_red', tune: { 'w-rush': { cd: 0.6, self: [{ k: 'speed', pct: 30, dur: 3 }] } } },
      ],
    ]),
    ...classRow('warrior', 'w', [
      { name: 'Scar Tissue', text: 'Each hit you take reduces your damage taken by 2% for 6 sec, up to 10%.', icon: 'rock_armour_skin_on_brown', does: { k: 'scar', step: 0.02, max: 0.1, dur: 6 } },
      { name: 'Break Loose', text: 'When crowd control on you ends, you move 50% faster for 3 sec.', icon: 'broken_chain_links_snapping_on_grey', does: { k: 'loose', pct: 50, dur: 3 } },
      { name: 'Second Wind', text: 'Falling below 35% health heals you for 12% of your health. 45 sec cooldown.', icon: 'burning_heart_on_red', rally: { pct: 0.12, every: 45 } },
    ]),
  ],
  // glass that bends space: fire that spreads, frost that counts
  mage: [
    ...styleRows('mage', 'm', 'fire', [
      [
        { name: 'Cinderheart', text: 'Ember Lash has a 30% chance, and always on a critical hit, to trigger Cinderheart: your next Flashburn has no cooldown and critically hits.', icon: 'fire_orb_in_an_open_palm_on_red', tune: { 'm-lash': { gives: [{ boon: 'cinder', chance: 0.3, crit: true }] }, 'm-burn': { uses: [{ boon: 'cinder', nocd: true, crit: true }] } } },
        { name: 'Banked Embers', text: 'Ember Lash generates an Ember, up to 3. Flashburn spends them to deal 38% more damage per Ember.', icon: 'red_hot_coal_on_dark_red', points: { name: 'Embers', one: 'Ember', max: 3, color: '#ff8a2a' }, tune: { 'm-lash': { build: { n: 1 } }, 'm-burn': { spend: { per: 0.38 } } } },
        { name: 'Wildfire', text: 'You critically hit 15% more often, and your critical hits burn the target for 100% of the damage dealt, over 4 sec.', icon: 'fire_eye_on_red', does: { k: 'wildfire', share: 1, dur: 4, crit: 0.15 } },
      ],
      [
        { name: 'Blazing Trail', text: 'Flicker deals 50 damage to enemies near where you left and slows them by 40% for 2 sec.', icon: 'spiral_of_fire_on_orange', tune: { 'm-blink': { foes: [{ k: 'dmg', n: 70 }, { k: 'slow', pct: 40, dur: 2 }] } } },
        { name: 'Long Hex', text: 'Toad Hex casts twice as fast and lasts 33% longer.', icon: 'confused_status_spiral_on_violet', tune: { 'm-toad': { cast: 0.5, dur: 1.33 } } },
        { name: 'Quickfold', text: 'Flicker cooldown reduced by 3 sec. You move 40% faster for 2 sec afterward.', icon: 'spirit_swap_arrows_on_teal', tune: { 'm-blink': { cd: 0.7, self: [{ k: 'speed', pct: 40, dur: 2 }] } } },
      ],
    ]),
    ...styleRows('mage', 'm', 'frost', [
      [
        // (the owner: "orb could give you on screen effects ... where the ice lance like spell deals 3x dmg")
        { name: 'Hoarfrost', text: 'Each tick of your Rimeglobe has a 35% chance to trigger Hoarfrost (stacks twice): your next Frostfang has no cooldown and deals triple damage, as if the target were rooted.', icon: 'frozen_status_snowflake_on_blue', tune: { 'm-globe': { gives: [{ boon: 'hoar', chance: 0.35, on: 'tick' }] }, 'm-fang': { uses: [{ boon: 'hoar', nocd: true, asCombo: true }] } } },
        // (the owner: "have the icicles stacked every time u deal frost bolt and launching ice lance fires them")
        { name: 'Rimeshards', text: 'Rime Spear generates a Rimeshard, up to 5. Frostfang spends them to deal 30% more damage per Rimeshard.', icon: 'icicle_rain_on_navy', points: { name: 'Rimeshards', one: 'Rimeshard', max: 5, color: '#bfeaff' }, tune: { 'm-spear': { build: { n: 1 } }, 'm-fang': { spend: { per: 0.3 } } } },
        { name: 'Deep Winter', text: 'While your Rimeglobe is active, Rime Spear is instant.', icon: 'snow_storm_cloud_on_grey', tune: { 'm-spear': { uses: [{ boon: 'globe', instant: true, keep: true }] } } },
      ],
      [
        { name: 'Long Winter', text: 'Your crowd control and slows last 25% longer, your super’s included.', icon: 'frozen_chain_on_navy', hold: 0.25 },
        { name: 'Third Chill', text: 'Every third hit on the same enemy within 6 sec roots them for 1.2 sec. 20 sec cooldown.', icon: 'frozen_heart_on_blue', does: { k: 'third', n: 3, within: 6, dur: 1.2, every: 20 } },
        { name: 'Ice Step', text: 'Frostclasp also launches you backward, out of melee range.', icon: 'frost_aura_around_a_figure_on_blue', tune: { 'm-ring': { self: [{ k: 'leap', dist: 70 }] } } },
      ],
    ]),
    ...classRow('mage', 'm', [
      { name: 'Arcane Skin', text: 'Take 20% less damage while above 50% health.', icon: 'shield_status_bubble_on_blue', does: { k: 'skin', share: 0.2, above: 0.5 } },
      { name: 'Rewind', text: 'Falling below 35% health heals you for half the damage you took in the last 3 sec. 30 sec cooldown.', icon: 'frozen_hourglass_on_navy', does: { k: 'rewind', back: 3, share: 0.5, every: 30 } },
      { name: 'Vanishing Point', text: 'Falling below 35% health, you vanish for 2.5 sec: enemies cannot see or target you, roots and slows are removed and you move 30% faster. Using an ability ends it. 30 sec cooldown.', icon: 'vanish_puff_of_smoke_on_violet', does: { k: 'vanish', dur: 2.5, haste: 0.3, every: 30 } },
    ]),
  ],
  // the kiter: a held breath, a baited trap, and healing where nobody can see
  ranger: [
    ...styleRows('ranger', 'r', 'sniper', [
      [
        { name: 'Still Breath', text: 'Every third Swift Shot triggers Still Breath: your next Long Draw is instant and has no cooldown.', icon: 'focus_status_calm_eye_on_teal', tune: { 'r-swift': { gives: [{ boon: 'breath', every: 3 }] }, 'r-aimed': { uses: [{ boon: 'breath', instant: true, nocd: true }] } } },
        { name: 'Full Draw', text: 'Swift Shot generates Tension, up to 4. Long Draw spends it to deal 40% more damage per Tension.', icon: 'bow_mastery_crest_on_green', points: { name: 'Tension', one: 'Tension', max: 4, color: '#d8ff9a' }, tune: { 'r-swift': { build: { n: 1 } }, 'r-aimed': { spend: { per: 0.4 } } } },
        { name: 'Long Shot', text: 'Deal 55% more damage to enemies farther away than half your range.', icon: 'long_range_arrow_with_a_scope_ring_on_teal', does: { k: 'far', pct: 0.55 } },
      ],
      [
        { name: 'Talon Rake', text: 'Hawk’s Dive also deals 47 damage over 6 sec. Cooldown reduced by 20%.', icon: 'eagle_eye_on_teal', tune: { 'r-hawk': { extra: [{ k: 'dot', n: 60, dur: 6 }], cd: 0.8 } } },
        { name: 'Roll and Nock', text: 'Spring Away nocks an arrow: your next Swift Shot deals double damage.', icon: 'dodge_roll_arrow_on_teal', tune: { 'r-leap': { gives: [{ boon: 'nocked', on: 'cast' }] }, 'r-swift': { uses: [{ boon: 'nocked', mult: 2 }] } } },
        { name: 'Burr Scatter', text: 'Spring Away slows enemies near where you left by 50% for 3 sec.', icon: 'spike_trap_on_brown', tune: { 'r-leap': { foes: [{ k: 'slow', pct: 50, dur: 3 }] } } },
      ],
    ]),
    ...styleRows('ranger', 'r', 'trapper', [
      [
        { name: 'Baited', text: 'Catching an enemy in your Snapjaw Trap triggers Baited: your next Serpent Volley has no cooldown and deals 50% more damage.', icon: 'hunter_mark_claw_on_brown', tune: { 'r-trap': { gives: [{ boon: 'baited' }] }, 'r-wind': { uses: [{ boon: 'baited', nocd: true, mult: 1.5 }] } } },
        { name: 'Quiver of Quills', text: 'Hobbling Shot generates a Quill, up to 5. Serpent Volley spends them to deal 4% more damage per Quill, poison included.', icon: 'quiver_full_of_arrows_on_green', points: { name: 'Quills', one: 'Quill', max: 5, color: '#9be86a' }, tune: { 'r-hobble': { build: { n: 1 } }, 'r-wind': { spend: { per: 0.04 } } } },
        { name: 'Quarry', text: 'Your hits mark one enemy at a time. Your team deals 6% more damage to the marked enemy.', icon: 'marked_status_target_on_red', does: { k: 'quarry', pct: 0.06 } },
      ],
      [
        { name: 'Wild Snare', text: 'Snapjaw Trap lasts 40% longer.', icon: 'snare_loop_on_green', tune: { 'r-trap': { dur: 1.4 } } },
        { name: 'Twin Traps', text: 'Snapjaw Trap cooldown reduced by 40%.', icon: 'nature_vine_trap_on_green', tune: { 'r-trap': { cd: 0.6 } } },
        { name: 'Slow Venom', text: 'Adder’s Kiss also slows by 30% and reduces healing on the target by 25% while it lasts.', icon: 'venom_fang_on_black', tune: { 'r-venom': { extra: [{ k: 'slow', pct: 30, dur: 8 }, { k: 'antiheal', pct: 25, dur: 8 }] } } },
      ],
    ]),
    ...classRow('ranger', 'r', [
      { name: 'Cover', text: 'After 1.5 sec out of every enemy’s line of sight, you heal 4% of your health each sec.', icon: 'hidden_glade_on_green', does: { k: 'cover', after: 1.5, pct: 0.04 } },
      { name: 'Forager', text: 'Healing spheres and the sigil heal you for 20% more and increase your movement speed by 15% for 3 sec.', icon: 'fruit_of_life_on_green', does: { k: 'forage', more: 0.2, pct: 15, dur: 3 } },
      { name: 'Antivenom', text: 'Damage-over-time effects deal 25% less damage to you.', icon: 'poison_vial_on_green', does: { k: 'antivenom', pct: 0.25 } },
    ]),
  ],
  // heals between blows, or gnaws at a curse; and keeps on after falling
  priest: [
    ...styleRows('priest', 'p', 'healer', [
      [
        { name: 'Answered Prayer', text: 'Bright Rebuke triggers Answered Prayer (stacks twice): your next Knit Wounds is instant and heals 30% more.', icon: 'white_dove_with_spread_wings_on_gold', tune: { 'p-smite': { gives: [{ boon: 'answer' }] }, 'p-mend': { uses: [{ boon: 'answer', instant: true, mult: 1.3 }] } } },
        { name: 'Counted Prayers', text: 'Knit Wounds generates a Prayer, up to 3. Ward of Faith spends them to absorb 20% more per Prayer.', icon: 'golden_bell_ringing_with_rings_on_gold', points: { name: 'Prayers', one: 'Prayer', max: 3, color: '#fff0a8' }, tune: { 'p-mend': { build: { n: 1 } }, 'p-ward': { spend: { per: 0.2 } } } },
        { name: 'Brimming Grace', text: 'Your overhealing becomes a shield on the target, up to 12% of their health, for 8 sec.', icon: 'golden_chalice_with_a_light_glow_on_gold', does: { k: 'overflow', cap: 0.12, dur: 8 } },
      ],
      [
        { name: 'Halo of Dread', text: 'The next enemy to hit you is feared for 1 sec. 25 sec cooldown.', icon: 'blessed_status_halo_on_gold', does: { k: 'halo', dur: 1, every: 25 } },
        { name: 'Chorus of Dread', text: 'Wail of Dread lasts 25% longer. Cooldown reduced by 20%.', icon: 'feared_status_face_on_violet', tune: { 'p-wail': { dur: 1.25, cd: 0.8 } } },
        { name: 'Sheltering Ward', text: 'Ward of Faith also reduces damage taken by 15% for 5 sec.', icon: 'winged_shield_with_a_sun_boss_on_gold', tune: { 'p-ward': { extra: [{ k: 'guard', pct: 15, dur: 5 }] } } },
      ],
    ]),
    ...styleRows('priest', 'p', 'shadow', [
      [
        { name: 'Dire Portent', text: 'Each tick of your Word of Decay has a 20% chance to trigger Dire Portent (stacks twice): your next Gnawing Word is instant and deals 80% more damage.', icon: 'dark_eye_on_violet', tune: { 'p-curse': { gives: [{ boon: 'omen', chance: 0.2, on: 'tick' }] }, 'p-gnaw': { uses: [{ boon: 'omen', instant: true, mult: 1.8 }] } } },
        { name: 'Litany', text: 'Gnawing Word generates a Verse, up to 4. Word of Decay spends them to deal 25% more damage per Verse.', icon: 'dark_tome_open_on_black', points: { name: 'Verses', one: 'Verse', max: 4, color: '#b06aff' }, tune: { 'p-gnaw': { build: { n: 1 } }, 'p-curse': { spend: { per: 0.25 } } } },
        { name: 'Feast of Shadows', text: '25% of the damage you deal heals your most injured ally, or you.', icon: 'life_drain_beam_on_violet', does: { k: 'returned', share: 0.25 } },
      ],
      [
        { name: 'Sapping Word', text: 'Enemies you damage receive 12% less healing for 3 sec.', icon: 'anti_heal_status_broken_heart_on_black', does: { k: 'sap', pct: 12, dur: 3 } },
        { name: 'Echoing Silence', text: 'Word of Silence also slows by 50% for 3 sec. Cooldown reduced by 20%.', icon: 'cursed_ribbon_on_violet', tune: { 'p-hush': { extra: [{ k: 'slow', pct: 50, dur: 3 }], cd: 0.8 } } },
        { name: 'Dusk Step', text: 'Duskwalk also teleports you a short distance forward.', icon: 'shadow_dash_streak_on_black', tune: { 'p-dusk': { self: [{ k: 'blink', dist: 70 }] } } },
      ],
    ]),
    ...classRow('priest', 'p', [
      { name: 'Lingering Spirit', text: 'When you die, you fight on as a spirit for 3 sec, immune to damage and healing. Once per match.', icon: 'white_wing_over_a_heart_on_gold', does: { k: 'spirit', dur: 3 } },
      { name: 'Morning Ward', text: 'Every 20 sec you gain a shield that absorbs 5% of your health.', icon: 'holy_resist_status_sun_shield_on_gold', does: { k: 'ward', pct: 0.05, every: 20 } },
      { name: 'Open Heart', text: 'All healing you receive is increased by 10%.', icon: 'heart_with_green_gold_sparkles_on_gold', does: { k: 'open', pct: 0.1 } },
    ]),
  ],
  // the protector: oaths sworn and spent, and auras that his friends stand in
  paladin: [
    ...styleRows('paladin', 'd', 'holy', [
      [
        { name: 'Oathsworn', text: 'Dawn’s Touch generates an Oath, up to 3. Verdict spends them to deal 30% more damage per Oath, and heals your most injured ally for the damage dealt.', icon: 'sword_and_shield_crossed_on_gold', points: { name: 'Oaths', one: 'Oath', max: 3, color: '#ffe48a' }, tune: { 'd-flash': { build: { n: 1 } }, 'd-judge': { spend: { per: 0.3, mend: 1 } } } },
        { name: 'Shared Dawn', text: 'Dawn’s Touch heals 30% more, and also heals every other ally for 80% of the amount.', icon: 'light_chain_binding_on_gold', tune: { 'd-flash': { spread: 0.8, power: 1.3 } } },
        { name: 'Aura of Wrath', text: 'You and your allies deal 12% more damage.', icon: 'golden_armoured_fist_with_a_light_burst_on_gold', does: { k: 'wrath', pct: 0.12 } },
      ],
      [
        { name: 'Aura of Resolve', text: 'Crowd control on you and nearby allies lasts 20% shorter.', icon: 'radiant_crown_of_light_on_gold', does: { k: 'resolve', pct: 0.2 } },
        { name: 'Hand of Freedom', text: 'A root or slow applied to you or a nearby ally is removed at once. 20 sec cooldown.', icon: 'open_hand_of_light_with_a_white_star_on_gold', does: { k: 'freedom', every: 20 } },
        { name: 'Stern Hammer', text: 'Hammer of Oaths stuns for 33% longer. Cooldown reduced by 25%.', icon: 'sword_planted_with_a_light_circle_on_gold', tune: { 'd-hammer': { cd: 0.75, dur: 1.33 } } },
      ],
    ]),
    ...styleRows('paladin', 'd', 'ret', [
      [
        { name: 'Mounting Ardor', text: 'Oath Blow generates Ardor, up to 4. Hammerfall spends it to deal 30% more damage per Ardor.', icon: 'massive_light_explosion_with_rays_on_gold', points: { name: 'Ardor', one: 'Ardor', max: 4, color: '#ffd84a' }, tune: { 'd-blow': { build: { n: 1 } }, 'd-fall': { spend: { per: 0.3 } } } },
        { name: 'Dawnfire', text: 'Oath Blow has a 18% chance, and always on a critical hit, to trigger Dawnfire: your next Hammerfall has no cooldown and burns the target for 74 damage over 4 sec.', icon: 'burning_sun_disc_on_orange', tune: { 'd-blow': { gives: [{ boon: 'dawnfire', chance: 0.18, crit: true }] }, 'd-fall': { uses: [{ boon: 'dawnfire', nocd: true, extra: [{ k: 'dot', n: 90, dur: 4 }] }] } } },
        { name: 'Verdict of Light', text: 'Every third hit deals 35 extra damage and heals your most injured ally for 35.', icon: 'beam_of_light_from_the_sky_on_gold', does: { k: 'verdict', every: 3, n: 35 } },
      ],
      [
        { name: 'Stern Blows', text: 'Your hits push back enemy casts three times as far, every time.', icon: 'golden_scales_of_justice_on_gold', does: { k: 'stern', push: 0.75 } },
        { name: 'Leaping Hammer', text: 'Hammer of Oaths bounces to the nearest other enemy and stuns them too.', icon: 'divine_eye_with_light_rays_on_gold', tune: { 'd-hammer': { bounce: true } } },
        { name: 'Wings of Dawn', text: 'Dawnstride also shields you for 100 for 6 sec. Cooldown reduced by 20%.', icon: 'white_feather_floating_on_gold', tune: { 'd-stride': { self: [{ k: 'absorb', n: 100, dur: 6 }], cd: 0.8 } } },
      ],
    ]),
    ...classRow('paladin', 'd', [
      { name: 'Shared Burden', text: 'You take 20% of the damage dealt to nearby allies in their place, and take 6% less damage yourself.', icon: 'golden_heart_with_white_wings_on_gold', guard: 0.06, does: { k: 'burden', share: 0.2 } },
      { name: 'Plate and Prayer', text: 'Physical attacks deal 15% less damage to you.', icon: 'shining_tower_shield_with_a_lion_on_gold', does: { k: 'plate', pct: 0.15 } },
      { name: 'Unbroken Vow', text: 'The first time each match you fall below 20% health, you are immune to damage for 2 sec.', icon: 'invincible_status_gold_shield_on_gold', does: { k: 'vow', under: 0.2, dur: 2 } },
    ]),
  ],
  // bargains: an agony that ripens, the dead that chill, an imp on the shoulder
  warlock: [
    ...styleRows('warlock', 'k', 'curses', [
      [
        { name: 'Ripening', text: 'Each tick of the Creeping Agony from your Blight Dart generates Rot, up to 5. Hex Bloom spends it to deal 20% more damage per Rot.', icon: 'plague_cloud_on_dark_green', points: { name: 'Rot', one: 'Rot', max: 5, color: '#9ae85a' }, tune: { 'k-dart': { build: { n: 1, on: 'tick' } }, 'k-bloom': { spend: { per: 0.2 } } } },
        { name: 'Gathering Dark', text: 'Each tick of the Creeping Agony from your Blight Dart has a 50% chance to trigger Gathering Dark (stacks twice): your next Blight Dart is instant and deals double damage.', icon: 'dark_lotus_on_black', tune: { 'k-dart': { gives: [{ boon: 'gathering', chance: 0.5, on: 'tick' }], uses: [{ boon: 'gathering', instant: true, mult: 2 }] } } },
        { name: 'Pit Imp', text: 'An imp on your shoulder attacks your target every 2 sec for 36 damage.', icon: 'shadow_imp_summon_on_black', does: { k: 'imp', n: 36, every: 2, range: 185 } },
      ],
      [
        { name: 'Enfeeble', text: 'Enemies you damage deal 8% less damage for 3 sec.', icon: 'cursed_status_dark_cloud_on_violet', does: { k: 'enfeeble', pct: 8, dur: 3 } },
        { name: 'Lingering Dread', text: 'Dread Gaze is instant, but its cooldown is 50% longer.', icon: 'hex_mark_eye_on_black', tune: { 'k-dread': { cast: 0, cd: 1.5 } } },
        { name: 'Thirsting', text: 'Soul Drink drains 30% more, and you take 20% less damage while channeling it.', icon: 'soul_burst_on_teal', tune: { 'k-drain': { power: 1.3, self: [{ k: 'guard', pct: 20, dur: 3 }] } } },
      ],
    ]),
    ...styleRows('warlock', 'k', 'grave', [
      [
        { name: 'Grave Chill', text: 'Each hit by an ashbound from your Call the Ashbound or Grave Legion has a 15% chance to trigger Grave Chill (stacks twice): your next Gloom Bolt is instant and deals 50% more damage.', icon: 'ghoul_claw_on_green', tune: { 'k-raise': { gives: [{ boon: 'chill', chance: 0.15, on: 'tick' }] }, 'k-super2': { gives: [{ boon: 'chill', chance: 0.15, on: 'tick' }] }, 'k-bolt': { uses: [{ boon: 'chill', instant: true, mult: 1.5 }] } } },
        { name: 'Third Grave', text: 'Call the Ashbound summons a third ashbound, and they hit twice as hard. Cooldown reduced by 8 sec.', icon: 'twin_summon_of_two_spirits_on_teal', tune: { 'k-raise': { more: 1, cd: 0.7, power: 2 } } },
        { name: 'Ashburst', text: 'When one of your ashbound dies or expires, it explodes for 54 damage to nearby enemies.', icon: 'dark_crystal_skull_on_violet', does: { k: 'corpse', n: 60, reach: 46 } },
      ],
      [
        { name: 'Mirror Curse', text: 'The first crowd control used on you is reflected at its caster for half the duration. 20 sec cooldown.', icon: 'cursed_mirror_on_violet', does: { k: 'mirror', share: 0.5, every: 20 } },
        { name: 'Barrow Howl', text: 'Dread Gaze also enrages your ashbound: for 4 sec they deal 40% more damage and move 33% faster.', icon: 'beast_roar_on_green', tune: { 'k-dread': { self: [{ k: 'frenzy', pct: 40, dur: 4 }] } } },
        { name: 'Hungering Dead', text: 'Grave Hunger also shields you for 100 for 6 sec. Cooldown reduced by 5 sec.', icon: 'black_candle_on_violet', tune: { 'k-frenzy': { cd: 0.7, self: [{ k: 'absorb', n: 100, dur: 6 }] } } },
      ],
    ]),
    ...classRow('warlock', 'k', [
      { name: 'Hollow Pact', text: 'Falling below 35% health heals you for 25% of your health. 45 sec cooldown.', icon: 'dark_heart_beating_on_black', does: { k: 'pact', pct: 0.25, every: 45 } },
      { name: 'Unholy Bargain', text: 'Take 12% less damage, but receive 25% less healing.', icon: 'cursed_silver_coin_on_black', guard: 0.12, does: { k: 'bargain', pct: 0.25 } },
      { name: 'Soul Shield', text: 'Every 2 sec in which you deal damage, you gain a shield for 1% of your health, up to 4%, lasting 5 sec.', icon: 'soul_orb_rising_on_violet', does: { k: 'soulward', pct: 0.01, max: 0.04, dur: 5, every: 2 } },
    ]),
  ],
  // the wild: buds and blooms, stars that fall, and an old oak when it goes badly
  druid: [
    ...styleRows('druid', 'l', 'heal', [
      [
        { name: 'Bud and Bloom', text: 'Green Mending generates a Bud, up to 3. Quick Bloom spends them to heal 30% more per Bud.', icon: 'healing_flower_on_green', points: { name: 'Buds', one: 'Bud', max: 3, color: '#9be86a' }, tune: { 'l-regrow': { build: { n: 1 } }, 'l-bloom': { spend: { per: 0.3 } } } },
        { name: 'Verdant Surge', text: 'Each tick of your Stinging Petals has a 50% chance to trigger Verdant Surge: your next Green Mending is instant and heals 50% more.', icon: 'wild_growth_of_three_sprouts_on_green', tune: { 'l-petal': { gives: [{ boon: 'surge', chance: 0.5, on: 'tick' }] }, 'l-regrow': { uses: [{ boon: 'surge', instant: true, mult: 1.5 }] } } },
        { name: 'Sun and Moon', text: 'Dealing damage increases your next heal by 65%. Healing increases your next damaging hit by 65%.', icon: 'eclipse_sun_on_black', does: { k: 'tides', pct: 0.65 } },
      ],
      [
        { name: 'Bramble Hide', text: 'Melee attackers take 12 damage and are slowed by 20% for 2 sec.', icon: 'thorn_shield_on_dark_green', does: { k: 'bramble', n: 12, pct: 20, dur: 2 } },
        { name: 'Gripping Roots', text: 'Grasping Roots is instant, but its cooldown is 50% longer.', icon: 'root_grab_from_the_ground_on_brown', tune: { 'l-roots': { cast: 0, cd: 1.5 } } },
        { name: 'Long Seasons', text: 'Your heal-over-time and damage-over-time effects last 30% longer.', icon: 'fern_unfurling_on_teal', does: { k: 'seasons', pct: 0.3 } },
      ],
    ]),
    ...styleRows('druid', 'l', 'star', [
      [
        { name: 'Falling Star', text: 'Each tick of your Moonburn has a 20% chance to trigger Falling Star (stacks twice): your next Starlash is instant and deals 60% more damage.', icon: 'star_summon_on_navy', tune: { 'l-moon': { gives: [{ boon: 'star', chance: 0.2, on: 'tick' }] }, 'l-lash': { uses: [{ boon: 'star', instant: true, mult: 1.6 }] } } },
        { name: 'Fourth Star', text: 'Every fourth Starlash deals 111 extra damage.', icon: 'star_seed_on_navy', tune: { 'l-lash': { nth: { n: 4, extra: [{ k: 'dmg', n: 130 }], name: 'Fourth Star' } } } },
        { name: 'Wandering Light', text: 'Starlash can be cast while moving, at full speed, and deals 20% more damage.', icon: 'moon_spirit_summon_on_navy', tune: { 'l-lash': { swift: true, power: 1.2 } } },
      ],
      [
        { name: 'Deep Roots', text: 'Grasping Roots lasts 40% longer.', icon: 'entangle_vines_on_green', tune: { 'l-roots': { dur: 1.4 } } },
        { name: 'Antler Rush', text: 'Stag’s Bound also knocks back all nearby enemies.', icon: 'stampede_of_hooves_on_brown', tune: { 'l-bound': { foes: [{ k: 'knock', dist: 60 }] } } },
        { name: 'Moonlit Path', text: 'Moonburn also slows by 30% for 4 sec.', icon: 'moonlight_arrow_on_navy', tune: { 'l-moon': { extra: [{ k: 'slow', pct: 30, dur: 4 }] } } },
      ],
    ]),
    ...classRow('druid', 'l', [
      { name: 'Heartwood', text: 'Falling below 35% health turns you into an oak for 4 sec: you take 40% less damage and heal 4% of your health each sec. 60 sec cooldown.', icon: 'treant_face_on_green', does: { k: 'oak', dur: 4, guard: 0.4, pct: 0.04, every: 60 } },
      { name: 'Wild Vigor', text: 'Heal 2% of your health every 5 sec.', icon: 'regeneration_leaf_mastery_on_green', does: { k: 'vigor', pct: 0.02, every: 5 } },
      { name: 'Gale Ward', text: 'An enemy that comes into melee range is knocked back. 18 sec cooldown.', icon: 'wind_leaf_on_teal', does: { k: 'gale', dist: 60, every: 18 } },
    ]),
  ],
  // the dark that drinks: tithes taken in blood, a second dusk, and a grave he won't stay in
  gloamknight: [
    ...styleRows('gloamknight', 'g', 'reaver', [
      [
        { name: 'Blood Tithe', text: 'Gloam Cleave generates a Tithe, up to 5. Night Reaping spends them to deal 18% more damage and heal 18% more per Tithe.', icon: 'red_flame_aura_around_a_sword_on_black', points: { name: 'Tithes', one: 'Tithe', max: 5, color: '#e0508a' }, tune: { 'g-cleave': { build: { n: 1 } }, 'g-reap': { spend: { per: 0.18 } } } },
        { name: 'Hungering Edge', text: 'Gloam Cleave has a 10% chance, and always on a critical hit, to trigger Hungering Edge: your next Night Reaping has no cooldown and heals you for 20% of the damage it deals.', icon: 'lifesteal_status_heart_drop_on_red', tune: { 'g-cleave': { gives: [{ boon: 'hunger', chance: 0.1, crit: true }] }, 'g-reap': { uses: [{ boon: 'hunger', nocd: true, drink: 0.2 }] } } },
        { name: 'Blood Price', text: 'Your attacks cost 1% of your health and deal 30% more damage.', icon: 'heart_pierced_by_a_dagger_on_black', does: { k: 'price', cost: 0.01, pct: 0.3 } },
      ],
      [
        { name: 'Iron Grip', text: 'Grave Chain also roots the target for 1.5 sec after the pull.', icon: 'burning_chain_link_on_black', tune: { 'g-chain': { extra: [{ k: 'cc', cc: 'root', dur: 1.5 }] } } },
        { name: 'Dusk Mantle', text: 'Enemies in melee range of you move 15% slower.', icon: 'shadow_veil_curtain_on_violet', does: { k: 'mantle', pct: 0.15 } },
        { name: 'Crushing Hand', text: 'Grave Hand also deals 53 damage and reduces healing on the target by 30% for 6 sec.', icon: 'stone_smash_with_a_fist_on_grey', tune: { 'g-hand': { extra: [{ k: 'dmg', n: 60 }, { k: 'antiheal', pct: 30, dur: 6 }] } } },
      ],
    ]),
    ...styleRows('gloamknight', 'g', 'shadow', [
      [
        { name: 'Second Dusk', text: 'A Closing Cut that spends 5 Nicks triggers Second Dusk: your next Nightknife counts as striking from behind and generates 3 Nicks.', icon: 'crescent_moon_behind_clouds_on_navy', tune: { 'g-cut': { gives: [{ boon: 'dusk', full: true }] }, 'g-knife': { uses: [{ boon: 'dusk', asCombo: true, build: 2 }] } } },
        { name: 'Bloodied Edge', text: 'Closing Cut also makes the target bleed for 18 damage over 6 sec, increased by 80% per Nick spent.', icon: 'damage_over_time_status_red_spark_on_red', tune: { 'g-cut': { extra: [{ k: 'dot', n: 20, dur: 6 }] } } },
        { name: 'Night’s Embrace', text: 'You move at full speed in stealth, and your first attack from stealth deals 150% more damage.', icon: 'shadow_fox_mask_on_violet', does: { k: 'shade', pct: 1.5 } },
      ],
      [
        { name: 'Throat Cut', text: 'Dusk Ambush also silences for 3 sec.', icon: 'hidden_blade_from_a_sleeve_on_violet', tune: { 'g-ambush': { extra: [{ k: 'cc', cc: 'silence', dur: 3 }] } } },
        { name: 'Smoke Step', text: 'In combat, Shroud of Dusk has a 33% shorter cooldown, and you move 30% faster for 3 sec after using it.', icon: 'shadow_clone_of_two_figures_on_black', tune: { 'g-veil': { cd: 0.66, self: [{ k: 'speed', pct: 30, dur: 3 }] } } },
        { name: 'Death Knell', text: 'Nearby enemies below 35% health receive 40% less healing.', icon: 'skull_lantern_on_black', does: { k: 'knell', pct: 0.4 } },
      ],
    ]),
    ...classRow('gloamknight', 'g', [
      { name: 'Unquiet Grave', text: 'Once per match, a killing blow instead makes you a revenant for 5 sec: your damage heals you for its full amount and no one else can heal you. End above 25% health and you survive.', icon: 'ghost_face_screaming_on_teal', does: { k: 'revenant', dur: 5, live: 0.25 } },
      { name: 'Thirst of Dusk', text: 'You and nearby allies each heal for 12% of the damage you deal.', icon: 'vampire_bat_on_black', does: { k: 'thirst', pct: 0.12 } },
      { name: 'Bone Shield', text: '3 bone plates each reduce one hit by 30%, then break. One regrows every 8 sec.', icon: 'bone_heap_on_grey', does: { k: 'bones', n: 3, pct: 0.3, every: 8 } },
    ]),
  ],
};

export const TALENT_BY_ID: Record<string, Talent> = Object.fromEntries(Object.values(TALENTS).flat().map((x) => [x.id, x]));

/** The talents a playstyle chooses from: its own two rows, and its class's third. */
export const talentsFor = (cls: ClassId, spec: string): Talent[] => TALENTS[cls].filter((t) => !t.spec || t.spec === spec);

/**
 * One from each row at most, and only what the playstyle can take (its own and its class's): anything else in a list
 * of choices is dropped. With no playstyle said, any of the class's.
 */
export function cleanTalents(cls: ClassId, ids: readonly string[] | undefined, spec?: string): Talent[] {
  const out: Talent[] = [];
  for (const id of ids ?? []) {
    const x = TALENT_BY_ID[id];
    if (x && x.cls === cls && (!x.spec || !spec || x.spec === spec) && !out.some((o) => o.row === x.row)) out.push(x);
  }
  return out;
}

/**
 * A playstyle's talents as they are fought with: the choices that are its own to make, and for any row left empty (a
 * setup kept from before the talents were each playstyle's own names talents that are gone) the one it comes with.
 */
export function fullTalents(cls: ClassId, spec: string, ids: readonly string[] | undefined, own: readonly string[]): string[] {
  const got = cleanTalents(cls, ids, spec);
  for (const t of cleanTalents(cls, own, spec)) if (!got.some((o) => o.row === t.row)) got.push(t);
  return got.sort((a, b) => a.row - b.row).map((t) => t.id);
}

/** The icons that aren't an ability's (the talents' own, and the new-rank banner's), for the icon build. */
export const talentIcons = (): string[] => [...new Set(['crit_up_status_star_burst_on_gold', ...Object.values(TALENTS).flatMap((list) => list.flatMap((t) => (t.icon ? [t.icon] : [])))])];
