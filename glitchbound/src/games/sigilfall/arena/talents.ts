import type { ClassId } from '../data/types';
import type { Build, Effect, Give, Points, Spend, Use } from './abilities';

/**
 * The Ring's talents: three rows, one choice from each, and the only thing a player changes about a playstyle (the
 * owner, 2026-11-16: "fixed spells per playstyle, only talents need to be changed", "talents should be played around
 * the combos and make the spells more fun ... make talents very fun and defining").
 *
 * The first two rows are the playstyle's own. "Combo" is how its combo is made: one choice lights an ability up for a
 * single use now and then (a boon, drawn at the edges of the screen), one gives the playstyle points that its basic
 * ability builds and its hard one spends, and one is plain, for whoever would rather not count. "Tricks" is what its
 * utility and its hold do besides. The third row, "Staying alive", is the whole class's.
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
  | { k: 'wildfire'; share: number; dur: number }
  | { k: 'third'; n: number; within: number; dur: number; every: number }
  | { k: 'skin'; share: number; above: number }
  | { k: 'rewind'; back: number; share: number; every: number }
  | { k: 'vanish'; dist: number; every: number }
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

export const ROW_NAMES = ['Combo', 'Tricks', 'Staying alive'] as const;
/** What each row is for, in a line (the setup page says it over the row). */
export const ROW_HINTS = ['How your combo is made.', 'What your utility and your hold do besides.', 'For the whole class.'] as const;

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
        { name: 'Red Mist', text: 'Hew has a 30% chance, and always on a critical hit, to bring on the Red Mist: your next Festering Gash is ready at once and hits 50% harder.', icon: 'rage_status_red_eye_on_red', tune: { 'w-hew': { gives: [{ boon: 'mist', chance: 0.3, crit: true }] }, 'w-gash': { uses: [{ boon: 'mist', nocd: true, mult: 1.5 }] } } },
        { name: 'Butcher’s Tally', text: 'Each Hew cuts a Notch, up to 4. Festering Gash spends them: 20% harder for each, the bleed too.', icon: 'sword_with_three_stacked_chevrons_on_red', points: { name: 'Notches', one: 'Notch', max: 4, color: '#ff8a7a' }, tune: { 'w-hew': { build: { n: 1 } }, 'w-gash': { spend: { per: 0.2 } } } },
        { name: 'Headsman', text: 'Deal 25% more damage to anyone under 35% health.', icon: 'death_mark_target_on_black', exec: 0.25 },
      ],
      [
        { name: 'Thunderous Rush', text: 'Bull Rush also stuns for 0.8 seconds.', icon: 'charging_bull_head_in_steel_on_red', tune: { 'w-rush': { extra: [{ k: 'cc', cc: 'stun', dur: 0.8 }] } } },
        { name: 'Ricochet', text: 'Hurled Maul leaps on to the nearest other enemy, and is back a quarter sooner.', icon: 'shield_bash_with_impact_rays_on_red', tune: { 'w-hurl': { bounce: true, cd: 0.75 } } },
        { name: 'Warpath', text: 'Bull Rush is back 3 seconds sooner, shakes off roots and slows, and for 3 seconds after it nothing slows or roots you and you run 30% faster.', icon: 'running_boot_with_speed_lines_on_red', tune: { 'w-rush': { cd: 0.7, self: [{ k: 'break' }, { k: 'free', dur: 3 }, { k: 'speed', pct: 30, dur: 3 }] } } },
      ],
    ]),
    ...styleRows('warrior', 'w', 'pin', [
      [
        { name: 'Mounting Ire', text: 'Each Hock Cut builds Ire, up to 5. Rending Cut spends it: 20% harder for each, the bleed too. Run Them Down fills it.', icon: 'angry_status_steam_cloud_on_red', points: { name: 'Ire', one: 'Ire', max: 5, color: '#ff6a4a' }, tune: { 'w-hamstring': { build: { n: 1 } }, 'w-bleed': { spend: { per: 0.2 } }, 'w-super2': { build: { n: 5, on: 'cast' } } } },
        { name: 'Blood Up', text: 'Each time your Rending Cut’s wound bleeds there is a 30% chance your blood is up, twice over at most: your next Hock Cut hits twice as hard.', icon: 'berserk_status_red_horned_mask_on_red', tune: { 'w-bleed': { gives: [{ boon: 'bloodup', chance: 0.3, on: 'tick' }] }, 'w-hamstring': { uses: [{ boon: 'bloodup', mult: 2 }] } } },
        { name: 'Grudge', text: 'Each blow in a row on the same enemy hits 3% harder, up to 15%. Turning on someone else starts it over.', icon: 'crossed_sword_and_axe_on_red', does: { k: 'grudge', step: 0.03, max: 5 } },
      ],
      [
        { name: 'Crippling Blows', text: 'Hock Cut slows by 60%, for 4 seconds.', icon: 'slowed_status_snail_on_teal', tune: { 'w-hamstring': { extra: [{ k: 'slow', pct: 60, dur: 4 }] } } },
        { name: 'Bonebreaker', text: 'Skull Crack hits three times as hard, and is back a quarter sooner.', icon: 'stunned_status_stars_on_yellow', tune: { 'w-crack': { power: 3, cd: 0.75 } } },
        { name: 'Run Down', text: 'Bull Rush is back 4 seconds sooner, and you run 30% faster for 3 seconds after it.', icon: 'burning_boot_with_speed_flames_on_red', tune: { 'w-rush': { cd: 0.6, self: [{ k: 'speed', pct: 30, dur: 3 }] } } },
      ],
    ]),
    ...classRow('warrior', 'w', [
      { name: 'Scar Tissue', text: 'Every blow that lands on you hardens you: 2% less damage taken for 6 seconds, up to 10%.', icon: 'rock_armour_skin_on_brown', does: { k: 'scar', step: 0.02, max: 0.1, dur: 6 } },
      { name: 'Break Loose', text: 'When a hold on you ends, you run 50% faster for 3 seconds.', icon: 'broken_chain_links_snapping_on_grey', does: { k: 'loose', pct: 50, dur: 3 } },
      { name: 'Second Wind', text: 'Fall under 35% health and you heal 12% of your health at once, at most every 45 seconds.', icon: 'burning_heart_on_red', rally: { pct: 0.12, every: 45 } },
    ]),
  ],
  // glass that bends space: fire that spreads, frost that counts
  mage: [
    ...styleRows('mage', 'm', 'fire', [
      [
        { name: 'Cinderheart', text: 'Ember Lash has a 30% chance, and always on a critical hit, to light your Cinderheart: your next Flashburn is ready at once and is a critical hit.', icon: 'fire_orb_in_an_open_palm_on_red', tune: { 'm-lash': { gives: [{ boon: 'cinder', chance: 0.3, crit: true }] }, 'm-burn': { uses: [{ boon: 'cinder', nocd: true, crit: true }] } } },
        { name: 'Banked Embers', text: 'Each Ember Lash banks an Ember, up to 3. Flashburn spends them: 30% harder for each.', icon: 'red_hot_coal_on_dark_red', points: { name: 'Embers', one: 'Ember', max: 3, color: '#ff8a2a' }, tune: { 'm-lash': { build: { n: 1 } }, 'm-burn': { spend: { per: 0.3 } } } },
        { name: 'Wildfire', text: 'Your critical hits set them burning: 40% of the hit again over 4 seconds.', icon: 'fire_eye_on_red', does: { k: 'wildfire', share: 0.4, dur: 4 } },
      ],
      [
        { name: 'Blazing Trail', text: 'Flicker scorches every enemy near where you left: 50, and slowed by 40% for 2 seconds.', icon: 'spiral_of_fire_on_orange', tune: { 'm-blink': { foes: [{ k: 'dmg', n: 70 }, { k: 'slow', pct: 40, dur: 2 }] } } },
        { name: 'Long Hex', text: 'Toad Hex casts twice as fast and lasts a third longer.', icon: 'confused_status_spiral_on_violet', tune: { 'm-toad': { cast: 0.5, dur: 1.33 } } },
        { name: 'Quickfold', text: 'Flicker is back 3 seconds sooner, and you run 40% faster for 2 seconds after it.', icon: 'spirit_swap_arrows_on_teal', tune: { 'm-blink': { cd: 0.7, self: [{ k: 'speed', pct: 40, dur: 2 }] } } },
      ],
    ]),
    ...styleRows('mage', 'm', 'frost', [
      [
        // (the owner: "orb could give you on screen effects ... where the ice lance like spell deals 3x dmg")
        { name: 'Hoarfrost', text: 'Each time your Rimeglobe chills someone there is a 35% chance of Hoarfrost, twice over at most: your next Frostfang is ready at once and shatters as if they were frozen, three times as hard.', icon: 'frozen_status_snowflake_on_blue', tune: { 'm-globe': { gives: [{ boon: 'hoar', chance: 0.35, on: 'tick' }] }, 'm-fang': { uses: [{ boon: 'hoar', nocd: true, asCombo: true }] } } },
        // (the owner: "have the icicles stacked every time u deal frost bolt and launching ice lance fires them")
        { name: 'Rimeshards', text: 'Each Rime Spear leaves a Rimeshard hanging beside you, up to 5. Frostfang looses them all: 40% harder for each.', icon: 'icicle_rain_on_navy', points: { name: 'Rimeshards', one: 'Rimeshard', max: 5, color: '#bfeaff' }, tune: { 'm-spear': { build: { n: 1 } }, 'm-fang': { spend: { per: 0.4 } } } },
        { name: 'Deep Winter', text: 'Your Rimeglobe stays half again as long, and while it is out Rime Spear is instant.', icon: 'snow_storm_cloud_on_grey', tune: { 'm-globe': { linger: 1.5 }, 'm-spear': { uses: [{ boon: 'globe', instant: true, keep: true }] } } },
      ],
      [
        { name: 'Long Winter', text: 'Holds and slows you put on an enemy last 25% longer, your super’s too.', icon: 'frozen_chain_on_navy', hold: 0.25 },
        { name: 'Third Chill', text: 'Every third hit on the same enemy within 6 seconds freezes them to the ground for 1.2 seconds. Once every 20 seconds.', icon: 'frozen_heart_on_blue', does: { k: 'third', n: 3, within: 6, dur: 1.2, every: 20 } },
        { name: 'Ice Step', text: 'Frost Snare also springs you back, out of their reach.', icon: 'frost_aura_around_a_figure_on_blue', tune: { 'm-ring': { self: [{ k: 'leap', dist: 70 }] } } },
      ],
    ]),
    ...classRow('mage', 'm', [
      { name: 'Arcane Skin', text: 'While your health is above 50%, you take 20% less damage.', icon: 'shield_status_bubble_on_blue', does: { k: 'skin', share: 0.2, above: 0.5 } },
      { name: 'Rewind', text: 'Fall under 35% health and time runs back: half the damage you took in the 3 seconds before is healed. Once every 30 seconds.', icon: 'frozen_hourglass_on_navy', does: { k: 'rewind', back: 3, share: 0.5, every: 30 } },
      { name: 'Vanishing Point', text: 'Fall under 35% health and you vanish, to appear away from the nearest enemy, out of roots and slows. Once every 30 seconds.', icon: 'vanish_puff_of_smoke_on_violet', does: { k: 'vanish', dist: 100, every: 30 } },
    ]),
  ],
  // the kiter: a held breath, a baited trap, and healing where nobody can see
  ranger: [
    ...styleRows('ranger', 'r', 'sniper', [
      [
        { name: 'Still Breath', text: 'Every third Swift Shot stills your breath: your next Long Draw is instant and ready at once.', icon: 'focus_status_calm_eye_on_teal', tune: { 'r-swift': { gives: [{ boon: 'breath', every: 3 }] }, 'r-aimed': { uses: [{ boon: 'breath', instant: true, nocd: true }] } } },
        { name: 'Full Draw', text: 'Each Swift Shot adds Tension to the string, up to 4. Long Draw looses it: 20% harder for each.', icon: 'bow_mastery_crest_on_green', points: { name: 'Tension', one: 'Tension', max: 4, color: '#d8ff9a' }, tune: { 'r-swift': { build: { n: 1 } }, 'r-aimed': { spend: { per: 0.2 } } } },
        { name: 'Long Shot', text: 'Hits from farther than half their reach away hit 15% harder.', icon: 'long_range_arrow_with_a_scope_ring_on_teal', does: { k: 'far', pct: 0.15 } },
      ],
      [
        { name: 'Talon Rake', text: 'Hawk’s Dive rakes them too, 47 over 6 seconds, and is back a fifth sooner.', icon: 'eagle_eye_on_teal', tune: { 'r-hawk': { extra: [{ k: 'dot', n: 60, dur: 6 }], cd: 0.8 } } },
        { name: 'Roll and Nock', text: 'Spring Away nocks an arrow as you land: your next Swift Shot hits twice as hard.', icon: 'dodge_roll_arrow_on_teal', tune: { 'r-leap': { gives: [{ boon: 'nocked', on: 'cast' }] }, 'r-swift': { uses: [{ boon: 'nocked', mult: 2 }] } } },
        { name: 'Burr Scatter', text: 'Spring Away scatters burrs where you stood: every enemy near is slowed by 50% for 3 seconds.', icon: 'spike_trap_on_brown', tune: { 'r-leap': { foes: [{ k: 'slow', pct: 50, dur: 3 }] } } },
      ],
    ]),
    ...styleRows('ranger', 'r', 'trapper', [
      [
        { name: 'Baited', text: 'An enemy caught in your Snapjaw Trap is Baited: your next Serpent Volley is ready at once and hits 50% harder.', icon: 'hunter_mark_claw_on_brown', tune: { 'r-trap': { gives: [{ boon: 'baited' }] }, 'r-wind': { uses: [{ boon: 'baited', nocd: true, mult: 1.5 }] } } },
        { name: 'Quiver of Quills', text: 'Each Hobbling Shot readies a Quill, up to 5. Serpent Volley looses them: 12% harder for each, the poison too.', icon: 'quiver_full_of_arrows_on_green', points: { name: 'Quills', one: 'Quill', max: 5, color: '#9be86a' }, tune: { 'r-hobble': { build: { n: 1 } }, 'r-wind': { spend: { per: 0.12 } } } },
        { name: 'Quarry', text: 'Your hits mark one enemy at a time: your whole side deals 10% more damage to them.', icon: 'marked_status_target_on_red', does: { k: 'quarry', pct: 0.1 } },
      ],
      [
        { name: 'Wild Snare', text: 'Your Snapjaw Trap holds 40% longer.', icon: 'snare_loop_on_green', tune: { 'r-trap': { dur: 1.4 } } },
        { name: 'Twin Traps', text: 'Snapjaw Trap is back in a little over half the time.', icon: 'nature_vine_trap_on_green', tune: { 'r-trap': { cd: 0.6 } } },
        { name: 'Slow Venom', text: 'Adder’s Kiss also slows by 30% and cuts healing on them by 25% while it lasts.', icon: 'venom_fang_on_black', tune: { 'r-venom': { extra: [{ k: 'slow', pct: 30, dur: 8 }, { k: 'antiheal', pct: 25, dur: 8 }] } } },
      ],
    ]),
    ...classRow('ranger', 'r', [
      { name: 'Cover', text: 'After 1.5 seconds out of every enemy’s sight, you heal 4% of your health each second.', icon: 'hidden_glade_on_green', does: { k: 'cover', after: 1.5, pct: 0.04 } },
      { name: 'Forager', text: 'Healing spheres and the sigil heal you 20% more, and quicken you by 15% for 3 seconds.', icon: 'fruit_of_life_on_green', does: { k: 'forage', more: 0.2, pct: 15, dur: 3 } },
      { name: 'Antivenom', text: 'Burns, bleeds, curses and poisons hurt you 25% less.', icon: 'poison_vial_on_green', does: { k: 'antivenom', pct: 0.25 } },
    ]),
  ],
  // heals between blows, or gnaws at a curse; and keeps on after falling
  priest: [
    ...styleRows('priest', 'p', 'healer', [
      [
        { name: 'Answered Prayer', text: 'Bright Rebuke is answered, twice over at most: your next Knit Wounds is instant and heals 30% more.', icon: 'white_dove_with_spread_wings_on_gold', tune: { 'p-smite': { gives: [{ boon: 'answer' }] }, 'p-mend': { uses: [{ boon: 'answer', instant: true, mult: 1.3 }] } } },
        { name: 'Counted Prayers', text: 'Each Knit Wounds counts a Prayer, up to 3. Ward of Faith spends them: 40% stronger for each.', icon: 'golden_bell_ringing_with_rings_on_gold', points: { name: 'Prayers', one: 'Prayer', max: 3, color: '#fff0a8' }, tune: { 'p-mend': { build: { n: 1 } }, 'p-ward': { spend: { per: 0.4 } } } },
        { name: 'Brimming Grace', text: 'Your healing past full health becomes a shield, up to 12% of their health, for 8 seconds.', icon: 'golden_chalice_with_a_light_glow_on_gold', does: { k: 'overflow', cap: 0.12, dur: 8 } },
      ],
      [
        { name: 'Halo of Dread', text: 'Once every 25 seconds, the next enemy to hit you flees in fear for 1 second.', icon: 'blessed_status_halo_on_gold', does: { k: 'halo', dur: 1, every: 25 } },
        { name: 'Chorus of Dread', text: 'Wail of Dread holds a quarter longer, and is back a fifth sooner.', icon: 'feared_status_face_on_violet', tune: { 'p-wail': { dur: 1.25, cd: 0.8 } } },
        { name: 'Sheltering Ward', text: 'Ward of Faith also takes 15% off all damage on them for 5 seconds.', icon: 'winged_shield_with_a_sun_boss_on_gold', tune: { 'p-ward': { extra: [{ k: 'guard', pct: 15, dur: 5 }] } } },
      ],
    ]),
    ...styleRows('priest', 'p', 'shadow', [
      [
        { name: 'Dire Portent', text: 'Each time your Word of Decay burns there is a 20% chance of a Dire Portent, twice over at most: your next Gnawing Word is instant and hits 80% harder.', icon: 'dark_eye_on_violet', tune: { 'p-curse': { gives: [{ boon: 'omen', chance: 0.2, on: 'tick' }] }, 'p-gnaw': { uses: [{ boon: 'omen', instant: true, mult: 1.8 }] } } },
        { name: 'Litany', text: 'Each Gnawing Word adds a Verse, up to 4. Word of Decay spends them: 25% stronger for each.', icon: 'dark_tome_open_on_black', points: { name: 'Verses', one: 'Verse', max: 4, color: '#b06aff' }, tune: { 'p-gnaw': { build: { n: 1 } }, 'p-curse': { spend: { per: 0.25 } } } },
        { name: 'Feast of Shadows', text: '15% of the damage you deal heals whichever friend is most hurt (you, if nobody is hurt more).', icon: 'life_drain_beam_on_violet', does: { k: 'returned', share: 0.15 } },
      ],
      [
        { name: 'Sapping Word', text: 'Enemies you hurt are healed 12% less for 3 seconds.', icon: 'anti_heal_status_broken_heart_on_black', does: { k: 'sap', pct: 12, dur: 3 } },
        { name: 'Echoing Silence', text: 'Word of Silence also slows by 50% for 3 seconds, and is back a fifth sooner.', icon: 'cursed_ribbon_on_violet', tune: { 'p-hush': { extra: [{ k: 'slow', pct: 50, dur: 3 }], cd: 0.8 } } },
        { name: 'Dusk Step', text: 'Duskwalk also blinks you a short way the way you’re facing.', icon: 'shadow_dash_streak_on_black', tune: { 'p-dusk': { self: [{ k: 'blink', dist: 70 }] } } },
      ],
    ]),
    ...classRow('priest', 'p', [
      { name: 'Lingering Spirit', text: 'When you fall, you linger 3 seconds as a spirit: nothing can hurt or heal you, and you can still fight. Once a match.', icon: 'white_wing_over_a_heart_on_gold', does: { k: 'spirit', dur: 3 } },
      { name: 'Morning Ward', text: 'Every 20 seconds a ward forms on you that soaks up 5% of your health.', icon: 'holy_resist_status_sun_shield_on_gold', does: { k: 'ward', pct: 0.05, every: 20 } },
      { name: 'Open Heart', text: 'All healing you are given is 10% stronger: your own, your friends’, the spheres and the sigil.', icon: 'heart_with_green_gold_sparkles_on_gold', does: { k: 'open', pct: 0.1 } },
    ]),
  ],
  // the protector: oaths sworn and spent, and auras that his friends stand in
  paladin: [
    ...styleRows('paladin', 'd', 'holy', [
      [
        { name: 'Oathsworn', text: 'Each Dawn’s Touch swears an Oath, up to 3. Verdict spends them: 40% harder for each, and the friend most hurt is healed for what it dealt.', icon: 'sword_and_shield_crossed_on_gold', points: { name: 'Oaths', one: 'Oath', max: 3, color: '#ffe48a' }, tune: { 'd-flash': { build: { n: 1 } }, 'd-judge': { spend: { per: 0.4, mend: 1 } } } },
        { name: 'Shared Dawn', text: 'Dawn’s Touch also heals every other friend for 35% as much.', icon: 'light_chain_binding_on_gold', tune: { 'd-flash': { spread: 0.35 } } },
        { name: 'Aura of Wrath', text: 'You and friends near you deal 6% more damage.', icon: 'golden_armoured_fist_with_a_light_burst_on_gold', does: { k: 'wrath', pct: 0.06 } },
      ],
      [
        { name: 'Aura of Resolve', text: 'Holds on you and friends near you last 20% shorter.', icon: 'radiant_crown_of_light_on_gold', does: { k: 'resolve', pct: 0.2 } },
        { name: 'Hand of Freedom', text: 'Once every 20 seconds, a root or slow put on you or a friend near you is shaken off at once.', icon: 'open_hand_of_light_with_a_white_star_on_gold', does: { k: 'freedom', every: 20 } },
        { name: 'Stern Hammer', text: 'Hammer of Oaths stuns a third longer, and is back a quarter sooner.', icon: 'sword_planted_with_a_light_circle_on_gold', tune: { 'd-hammer': { cd: 0.75, dur: 1.33 } } },
      ],
    ]),
    ...styleRows('paladin', 'd', 'ret', [
      [
        { name: 'Mounting Ardor', text: 'Each Oath Blow builds Ardor, up to 4. Hammerfall spends it: 25% harder for each.', icon: 'massive_light_explosion_with_rays_on_gold', points: { name: 'Ardor', one: 'Ardor', max: 4, color: '#ffd84a' }, tune: { 'd-blow': { build: { n: 1 } }, 'd-fall': { spend: { per: 0.25 } } } },
        { name: 'Dawnfire', text: 'Oath Blow has a 25% chance, and always on a critical hit, to kindle Dawnfire: your next Hammerfall is ready at once and sets them ablaze, 79 more over 4 seconds.', icon: 'burning_sun_disc_on_orange', tune: { 'd-blow': { gives: [{ boon: 'dawnfire', chance: 0.25, crit: true }] }, 'd-fall': { uses: [{ boon: 'dawnfire', nocd: true, extra: [{ k: 'dot', n: 90, dur: 4 }] }] } } },
        { name: 'Verdict of Light', text: 'Every fourth hit you land calls down light: 25 more damage, and 25 healing for whichever friend is most hurt.', icon: 'beam_of_light_from_the_sky_on_gold', does: { k: 'verdict', every: 4, n: 25 } },
      ],
      [
        { name: 'Stern Blows', text: 'Your hits knock a cast back three times as far, as often as they land.', icon: 'golden_scales_of_justice_on_gold', does: { k: 'stern', push: 0.75 } },
        { name: 'Leaping Hammer', text: 'Hammer of Oaths leaps on to the nearest other enemy and stuns them too.', icon: 'divine_eye_with_light_rays_on_gold', tune: { 'd-hammer': { bounce: true } } },
        { name: 'Wings of Dawn', text: 'Dawnstride also wards you for 100 damage for 6 seconds, and is back a fifth sooner.', icon: 'white_feather_floating_on_gold', tune: { 'd-stride': { self: [{ k: 'absorb', n: 100, dur: 6 }], cd: 0.8 } } },
      ],
    ]),
    ...classRow('paladin', 'd', [
      { name: 'Shared Burden', text: 'A fifth of the damage friends near you take is yours instead, and you take 6% less.', icon: 'golden_heart_with_white_wings_on_gold', guard: 0.06, does: { k: 'burden', share: 0.2 } },
      { name: 'Plate and Prayer', text: 'Blows and arrows hurt you 15% less.', icon: 'shining_tower_shield_with_a_lion_on_gold', does: { k: 'plate', pct: 0.15 } },
      { name: 'Unbroken Vow', text: 'The first time each match you fall under 20% health, nothing can touch you for 2 seconds.', icon: 'invincible_status_gold_shield_on_gold', does: { k: 'vow', under: 0.2, dur: 2 } },
    ]),
  ],
  // bargains: an agony that ripens, the dead that chill, an imp on the shoulder
  warlock: [
    ...styleRows('warlock', 'k', 'curses', [
      [
        { name: 'Ripening', text: 'Each time the Creeping Agony your Blight Dart leaves burns, a point of Rot ripens, up to 5. Hex Bloom spends it: 20% harder for each.', icon: 'plague_cloud_on_dark_green', points: { name: 'Rot', one: 'Rot', max: 5, color: '#9ae85a' }, tune: { 'k-dart': { build: { n: 1, on: 'tick' } }, 'k-bloom': { spend: { per: 0.2 } } } },
        { name: 'Gathering Dark', text: 'Each time the Creeping Agony your Blight Dart leaves burns there is a 20% chance the dark gathers, twice over at most: your next Blight Dart is instant and hits twice as hard.', icon: 'dark_lotus_on_black', tune: { 'k-dart': { gives: [{ boon: 'gathering', chance: 0.2, on: 'tick' }], uses: [{ boon: 'gathering', instant: true, mult: 2 }] } } },
        { name: 'Pit Imp', text: 'An imp rides on your shoulder and spits shadow at your enemy every 3 seconds: 10 damage.', icon: 'shadow_imp_summon_on_black', does: { k: 'imp', n: 10, every: 3, range: 185 } },
      ],
      [
        { name: 'Enfeeble', text: 'Enemies you hurt deal 8% less damage for 3 seconds.', icon: 'cursed_status_dark_cloud_on_violet', does: { k: 'enfeeble', pct: 8, dur: 3 } },
        { name: 'Lingering Dread', text: 'Dread Gaze is instant, and half again as long coming back.', icon: 'hex_mark_eye_on_black', tune: { 'k-dread': { cast: 0, cd: 1.5 } } },
        { name: 'Thirsting', text: 'Soul Drink drinks 30% more, and you take 20% less damage while you drink.', icon: 'soul_burst_on_teal', tune: { 'k-drain': { power: 1.3, self: [{ k: 'guard', pct: 20, dur: 3 }] } } },
      ],
    ]),
    ...styleRows('warlock', 'k', 'grave', [
      [
        { name: 'Grave Chill', text: 'Each claw of the dead you raise, with Call the Ashbound or Grave Legion, has a 15% chance to send a Grave Chill up your arm, twice over at most: your next Gloom Bolt is instant and hits 50% harder.', icon: 'ghoul_claw_on_green', tune: { 'k-raise': { gives: [{ boon: 'chill', chance: 0.15, on: 'tick' }] }, 'k-super2': { gives: [{ boon: 'chill', chance: 0.15, on: 'tick' }] }, 'k-bolt': { uses: [{ boon: 'chill', instant: true, mult: 1.5 }] } } },
        { name: 'Third Grave', text: 'Call the Ashbound raises a third.', icon: 'twin_summon_of_two_spirits_on_teal', tune: { 'k-raise': { more: 1 } } },
        { name: 'Ashburst', text: 'When one of your ashbound falls or crumbles, it bursts: 54 to every enemy beside it.', icon: 'dark_crystal_skull_on_violet', does: { k: 'corpse', n: 60, reach: 46 } },
      ],
      [
        { name: 'Mirror Curse', text: 'Once every 20 seconds, the first hold put on you is turned back on whoever put it, for half as long.', icon: 'cursed_mirror_on_violet', does: { k: 'mirror', share: 0.5, every: 20 } },
        { name: 'Barrow Howl', text: 'Dread Gaze also sets your ashbound howling: for 4 seconds they hit 40% harder and run a third faster.', icon: 'beast_roar_on_green', tune: { 'k-dread': { self: [{ k: 'frenzy', pct: 40, dur: 4 }] } } },
        { name: 'Hungering Dead', text: 'Grave Hunger also wards you for 100 damage for 6 seconds, and is back 5 seconds sooner.', icon: 'black_candle_on_violet', tune: { 'k-frenzy': { cd: 0.7, self: [{ k: 'absorb', n: 100, dur: 6 }] } } },
      ],
    ]),
    ...classRow('warlock', 'k', [
      { name: 'Hollow Pact', text: 'Fall under 35% health and heal 25% of your health. Once every 45 seconds.', icon: 'dark_heart_beating_on_black', does: { k: 'pact', pct: 0.25, every: 45 } },
      { name: 'Unholy Bargain', text: 'Take 12% less damage, but all healing on you is 25% weaker.', icon: 'cursed_silver_coin_on_black', guard: 0.12, does: { k: 'bargain', pct: 0.25 } },
      { name: 'Soul Shield', text: 'Every 2 seconds that you deal damage, a hit or a burn, you are warded for 1% of your health, up to 4%, for 5 seconds.', icon: 'soul_orb_rising_on_violet', does: { k: 'soulward', pct: 0.01, max: 0.04, dur: 5, every: 2 } },
    ]),
  ],
  // the wild: buds and blooms, stars that fall, and an old oak when it goes badly
  druid: [
    ...styleRows('druid', 'l', 'heal', [
      [
        { name: 'Bud and Bloom', text: 'Each Green Mending sets a Bud, up to 3. Quick Bloom opens them: 30% more healing for each.', icon: 'healing_flower_on_green', points: { name: 'Buds', one: 'Bud', max: 3, color: '#9be86a' }, tune: { 'l-regrow': { build: { n: 1 } }, 'l-bloom': { spend: { per: 0.3 } } } },
        { name: 'Verdant Surge', text: 'Each time your Stinging Petals burn there is a 25% chance of a Verdant Surge: your next Green Mending is instant and heals 30% more.', icon: 'wild_growth_of_three_sprouts_on_green', tune: { 'l-petal': { gives: [{ boon: 'surge', chance: 0.25, on: 'tick' }] }, 'l-regrow': { uses: [{ boon: 'surge', instant: true, mult: 1.3 }] } } },
        { name: 'Sun and Moon', text: 'Dealing damage makes your next heal 25% stronger; healing makes your next hit 25% stronger.', icon: 'eclipse_sun_on_black', does: { k: 'tides', pct: 0.25 } },
      ],
      [
        { name: 'Bramble Hide', text: 'Anyone who strikes you with a blow takes 12 damage back and is slowed by 20% for 2 seconds.', icon: 'thorn_shield_on_dark_green', does: { k: 'bramble', n: 12, pct: 20, dur: 2 } },
        { name: 'Gripping Roots', text: 'Grasping Roots is instant, and half again as long coming back.', icon: 'root_grab_from_the_ground_on_brown', tune: { 'l-roots': { cast: 0, cd: 1.5 } } },
        { name: 'Long Seasons', text: 'Your heals and burns over time last 30% longer.', icon: 'fern_unfurling_on_teal', does: { k: 'seasons', pct: 0.3 } },
      ],
    ]),
    ...styleRows('druid', 'l', 'star', [
      [
        { name: 'Falling Star', text: 'Each time your Moonburn burns there is a 20% chance a star falls for you, twice over at most: your next Starlash is instant and hits 60% harder.', icon: 'star_summon_on_navy', tune: { 'l-moon': { gives: [{ boon: 'star', chance: 0.2, on: 'tick' }] }, 'l-lash': { uses: [{ boon: 'star', instant: true, mult: 1.6 }] } } },
        { name: 'Fourth Star', text: 'Every fourth Starlash brings a star down with it: 77 more.', icon: 'star_seed_on_navy', tune: { 'l-lash': { nth: { n: 4, extra: [{ k: 'dmg', n: 90 }], name: 'Fourth Star' } } } },
        { name: 'Wandering Light', text: 'Starlash can be cast on the move, at full speed.', icon: 'moon_spirit_summon_on_navy', tune: { 'l-lash': { swift: true } } },
      ],
      [
        { name: 'Deep Roots', text: 'Grasping Roots holds 40% longer.', icon: 'entangle_vines_on_green', tune: { 'l-roots': { dur: 1.4 } } },
        { name: 'Antler Rush', text: 'Stag’s Bound throws back every enemy near you as you break away.', icon: 'stampede_of_hooves_on_brown', tune: { 'l-bound': { foes: [{ k: 'knock', dist: 60 }] } } },
        { name: 'Moonlit Path', text: 'Moonburn also slows by 30% for 4 seconds.', icon: 'moonlight_arrow_on_navy', tune: { 'l-moon': { extra: [{ k: 'slow', pct: 30, dur: 4 }] } } },
      ],
    ]),
    ...classRow('druid', 'l', [
      { name: 'Heartwood', text: 'Fall under 35% health and you take root as an old oak for 4 seconds: 40% less damage taken, 4% of your health back each second. Once a minute.', icon: 'treant_face_on_green', does: { k: 'oak', dur: 4, guard: 0.4, pct: 0.04, every: 60 } },
      { name: 'Wild Vigor', text: 'You heal 2% of your health every 5 seconds.', icon: 'regeneration_leaf_mastery_on_green', does: { k: 'vigor', pct: 0.02, every: 5 } },
      { name: 'Gale Ward', text: 'Once every 18 seconds, an enemy who comes within arm’s reach is thrown back by a gust.', icon: 'wind_leaf_on_teal', does: { k: 'gale', dist: 60, every: 18 } },
    ]),
  ],
  // the dark that drinks: tithes taken in blood, a second dusk, and a grave he won't stay in
  gloamknight: [
    ...styleRows('gloamknight', 'g', 'reaver', [
      [
        { name: 'Blood Tithe', text: 'Each Gloam Cleave takes a Tithe, up to 5. Night Reaping spends them: 18% harder for each, and it drinks as much more.', icon: 'red_flame_aura_around_a_sword_on_black', points: { name: 'Tithes', one: 'Tithe', max: 5, color: '#e0508a' }, tune: { 'g-cleave': { build: { n: 1 } }, 'g-reap': { spend: { per: 0.18 } } } },
        { name: 'Hungering Edge', text: 'Gloam Cleave has a 25% chance, and always on a critical hit, to whet a Hungering Edge: your next Night Reaping is ready at once and drinks half of what it deals.', icon: 'lifesteal_status_heart_drop_on_red', tune: { 'g-cleave': { gives: [{ boon: 'hunger', chance: 0.25, crit: true }] }, 'g-reap': { uses: [{ boon: 'hunger', nocd: true, drink: 0.5 }] } } },
        { name: 'Blood Price', text: 'Each attack you make costs 1% of your health and hits 20% harder.', icon: 'heart_pierced_by_a_dagger_on_black', does: { k: 'price', cost: 0.01, pct: 0.2 } },
      ],
      [
        { name: 'Iron Grip', text: 'Grave Chain also holds them to the ground for 1.5 seconds once they are dragged in.', icon: 'burning_chain_link_on_black', tune: { 'g-chain': { extra: [{ k: 'cc', cc: 'root', dur: 1.5 }] } } },
        { name: 'Dusk Mantle', text: 'Enemies within arm’s reach of you move 15% slower.', icon: 'shadow_veil_curtain_on_violet', does: { k: 'mantle', pct: 0.15 } },
        { name: 'Crushing Hand', text: 'Grave Hand crushes as it holds: 54, and healing on them cut by 30% for 6 seconds.', icon: 'stone_smash_with_a_fist_on_grey', tune: { 'g-hand': { extra: [{ k: 'dmg', n: 60 }, { k: 'antiheal', pct: 30, dur: 6 }] } } },
      ],
    ]),
    ...styleRows('gloamknight', 'g', 'shadow', [
      [
        { name: 'Second Dusk', text: 'A Closing Cut that spends 5 Nicks brings a Second Dusk: your next Nightknife cuts as if from behind and leaves 2 Nicks.', icon: 'crescent_moon_behind_clouds_on_navy', tune: { 'g-cut': { gives: [{ boon: 'dusk', full: true }] }, 'g-knife': { uses: [{ boon: 'dusk', asCombo: true, build: 1 }] } } },
        { name: 'Bloodied Edge', text: 'Closing Cut leaves them bleeding over 6 seconds: 18, and 80% more for every Nick, as the cut itself.', icon: 'damage_over_time_status_red_spark_on_red', tune: { 'g-cut': { extra: [{ k: 'dot', n: 20, dur: 6 }] } } },
        { name: 'Night’s Embrace', text: 'Hidden, you move at full speed, and the first blow you strike out of the shroud hits 30% harder.', icon: 'shadow_fox_mask_on_violet', does: { k: 'shade', pct: 0.3 } },
      ],
      [
        { name: 'Throat Cut', text: 'Dusk Ambush also silences for 3 seconds.', icon: 'hidden_blade_from_a_sleeve_on_violet', tune: { 'g-ambush': { extra: [{ k: 'cc', cc: 'silence', dur: 3 }] } } },
        { name: 'Smoke Step', text: 'In a fight, Shroud of Dusk is back a third sooner, and you run 30% faster for 3 seconds as you take it.', icon: 'shadow_clone_of_two_figures_on_black', tune: { 'g-veil': { cd: 0.66, self: [{ k: 'speed', pct: 30, dur: 3 }] } } },
        { name: 'Death Knell', text: 'Enemies under 35% health near you are healed 40% less.', icon: 'skull_lantern_on_black', does: { k: 'knell', pct: 0.4 } },
      ],
    ]),
    ...classRow('gloamknight', 'g', [
      { name: 'Unquiet Grave', text: 'Once a match, a killing blow makes you a revenant for 5 seconds: you drink all you deal, and nobody else can heal you. End it above 25% health and you live.', icon: 'ghost_face_screaming_on_teal', does: { k: 'revenant', dur: 5, live: 0.25 } },
      { name: 'Thirst of Dusk', text: 'You and friends near you drink 12% of the damage you deal.', icon: 'vampire_bat_on_black', does: { k: 'thirst', pct: 0.12 } },
      { name: 'Bone Shield', text: 'Three plates of bone each take 30% off one hit and break. One grows back every 8 seconds.', icon: 'bone_heap_on_grey', does: { k: 'bones', n: 3, pct: 0.3, every: 8 } },
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
