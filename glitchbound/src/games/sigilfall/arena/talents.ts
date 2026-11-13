import type { ClassId } from '../data/types';

/**
 * The Ring's talents: three rows, one choice from each, on top of the bar and the oath. Every one of them is the whole
 * class's, never one ability's: more health, harder blows, shorter cooldowns, a slow on every hit, a heal when life runs
 * low, the class's super or its Swift Step, which every hero carries. So no choice is wasted on a bar without the
 * ability it would have sharpened (the owner: "if you pick certain spells, the talent options are useless, they should
 * be general for the class"). The ids are the ones the old talents had, so a saved setup keeps a talent in each row.
 * Plain data with no imports but types: the icon build reads it.
 */

/** How a talent changes one ability (only the class's super or the Swift Step): its strength, cooldown, cast time, or how long what it does lasts. */
export interface Tune {
  power?: number;
  cd?: number;
  cast?: number;
  dur?: number;
}

export interface Talent {
  id: string;
  cls: ClassId;
  row: 0 | 1 | 2;
  name: string;
  text: string;
  /** Its own icon; without one it wears the ability it sharpens. */
  icon?: string;
  /** The class's super or the Swift Step, by id: what every hero of the class carries, whatever is on their bar. */
  tune?: Record<string, Tune>;
  hp?: number;
  dmg?: number;
  heal?: number;
  speed?: number;
  tenacity?: number;
  /** More mana back each second. */
  regen?: number;
  /** A share off every cooldown, the Swift Step's among them. */
  cool?: number;
  /** A share off all damage taken. */
  guard?: number;
  /** Holds and slows put on others last this share longer. */
  hold?: number;
  /** This share of all damage dealt comes back as healing. */
  leech?: number;
  /** The super meter fills this share faster. */
  charge?: number;
  /** More chance of a critical hit (a share, on top of everyone's). */
  crit?: number;
  /** This share more damage to anyone under EXECUTE of their health. */
  exec?: number;
  /** What is hit (a blow or a spell landing, not what burns over time) is slowed by `pct`% for `dur` seconds. */
  slow?: { pct: number; dur: number };
  /** A blow stuns for `dur` seconds, at most once every `every`. */
  stun?: { dur: number; every: number };
  /** The Swift Step leaves a snare where it started that holds the first enemy on it `dur` seconds, at most once every `every`. */
  snare?: { dur: number; every: number };
  /** Falling under RALLY of your health heals `pct` of it at once, at most once every `every` seconds. */
  rally?: { pct: number; every: number };
}

export const ROW_NAMES = ['Power', 'Control', 'Staying alive'] as const;

/** Under this share of their health a fighter counts as low: a Headsman's mark, and when a Second Wind comes. */
export const EXECUTE = 0.35;
export const RALLY = 0.35;

const HP = 'toughness_heart_mastery_on_red';
const WILL = 'broken_chain_on_black';
const MIND = 'magic_up_status_star_arrow_up_on_violet';
const CLOCK = 'cooldown_status_clock_on_grey';

const rowOf = (cls: ClassId, row: 0 | 1 | 2, list: Omit<Talent, 'cls' | 'row' | 'id'>[], prefix: string): Talent[] => list.map((x, i) => ({ ...x, cls, row, id: `${prefix}-${row + 1}${'abc'[i]}` }));

// (what every class may take, each in its own words: the cooldowns, the Swift Step, a second wind, the super)
const COOL = 'Cooldowns 12% shorter, your Swift Step’s too.';
const STEP = 'Your Swift Step comes back 40% sooner.';
const HOLD = 'Holds and slows you put on an enemy last 20% longer, your super’s too.';
const WIND = 'Fall under 35% health and you heal 12% of your health at once, at most every 45 seconds.';
const rally = { pct: 0.12, every: 45 };
const superUp = (id: string, name: string, what = 'hits 25% harder'): Pick<Talent, 'text' | 'tune' | 'charge'> => ({ text: `${name} ${what}, and your meter fills 20% faster.`, tune: { [id]: { power: 1.25 } }, charge: 0.2 });

export const TALENTS: Record<ClassId, Talent[]> = {
  warrior: [
    ...rowOf('warrior', 0, [
      { name: 'Butcher’s Edge', text: 'Your blows hit 8% harder.', icon: 'double_damage_status_two_swords_on_red', dmg: 0.08 },
      { name: 'Headsman', text: 'Deal 20% more damage to anyone under 35% health.', icon: 'death_mark_target_on_black', exec: 0.2 },
      { name: 'Earthbreaker', ...superUp('w-super', 'Quakebreaker') },
    ], 'w'),
    // (the warrior's holds were too many and too long, one after another: the owner, "warriors have too much cc ...
    // or maybe make cc into talent options". Its bar holds less now, and a stun or a slow on every blow is chosen
    // here, against a shorter clock on everything)
    ...rowOf('warrior', 1, [
      { name: 'Crippling Blows', text: 'What you hit is slowed by 30% for 3 seconds.', icon: 'slowed_status_snail_on_teal', slow: { pct: 30, dur: 3 } },
      { name: 'Bonebreaker', text: 'Once every 20 seconds, a blow stuns for 1 second.', icon: 'stunned_status_stars_on_yellow', stun: { dur: 1, every: 20 } },
      { name: 'Relentless', text: COOL, icon: CLOCK, cool: 0.12 },
    ], 'w'),
    ...rowOf('warrior', 2, [
      { name: 'Thick Hide', text: '+10% health.', icon: HP, hp: 0.1 },
      { name: 'Stubborn', text: 'Held 20% shorter.', icon: WILL, tenacity: 0.2 },
      { name: 'Second Wind', text: WIND, icon: 'burning_heart_on_red', rally },
    ], 'w'),
  ],
  mage: [
    ...rowOf('mage', 0, [
      { name: 'Searing Mind', text: 'Your spells hit 8% harder.', icon: 'fire_eye_on_red', dmg: 0.08 },
      { name: 'Deep Wells', text: 'Mana comes back 50% faster.', icon: MIND, regen: 0.5 },
      { name: 'Comet Caller', ...superUp('m-super', 'Cinder Comet') },
    ], 'm'),
    ...rowOf('mage', 1, [
      { name: 'Long Winter', text: HOLD, icon: 'frozen_chain_on_navy', hold: 0.2 },
      { name: 'Quick Mind', text: COOL, icon: 'frozen_hourglass_on_navy', cool: 0.12 },
      { name: 'Chilling Touch', text: 'What you hit is slowed by 25% for 2 seconds.', icon: 'frost_breath_cloud_on_blue', slow: { pct: 25, dur: 2 } },
    ], 'm'),
    ...rowOf('mage', 2, [
      { name: 'Mana Skin', text: 'Take 8% less damage.', icon: 'shield_status_bubble_on_blue', guard: 0.08 },
      { name: 'Restless', text: STEP, tune: { dash: { cd: 0.6 } } },
      { name: 'Winter’s Keep', text: '+10% health.', icon: HP, hp: 0.1 },
    ], 'm'),
  ],
  ranger: [
    ...rowOf('ranger', 0, [
      { name: 'Fletcher’s Eye', text: 'Your shots hit 8% harder.', icon: 'arrow_hitting_a_bullseye_target_on_green', dmg: 0.08 },
      { name: 'Keen Eye', text: 'Critical hits twice as often.', icon: 'eagle_eye_on_teal', crit: 0.1 },
      { name: 'Skypiercer', ...superUp('r-super', 'Skypierce Arrow') },
    ], 'r'),
    ...rowOf('ranger', 1, [
      { name: 'Barbed Shots', text: 'What you hit is slowed by 25% for 2 seconds.', icon: 'rope_arrow_with_a_hook_on_brown', slow: { pct: 25, dur: 2 } },
      { name: 'Wild Snare', text: 'Your Swift Step leaves a snare behind: the first enemy on it is held for 1.5 seconds. Once every 15 seconds.', icon: 'snare_loop_on_green', snare: { dur: 1.5, every: 15 } },
      { name: 'Quick Quiver', text: COOL, icon: 'quiver_full_of_arrows_on_green', cool: 0.12 },
    ], 'r'),
    ...rowOf('ranger', 2, [
      { name: 'Light Feet', text: STEP, tune: { dash: { cd: 0.6 } } },
      { name: 'Old Instinct', text: WIND, icon: 'heal_over_time_status_green_sparkle_on_green', rally },
      { name: 'Trail Hardened', text: '+10% health.', icon: HP, hp: 0.1 },
    ], 'r'),
  ],
  priest: [
    ...rowOf('priest', 0, [
      { name: 'Twofold Light', text: 'Your healing and damage are 8% stronger.', icon: 'light_crescent_and_a_sun_on_gold', dmg: 0.08, heal: 0.08 },
      { name: 'Bright Wings', ...superUp('p-super', 'Dawnward', 'heals and shields 25% more') },
      { name: 'Quiet Mind', text: 'Mana comes back 50% faster.', icon: MIND, regen: 0.5 },
    ], 'p'),
    ...rowOf('priest', 1, [
      { name: 'Fleet Prayer', text: '+10% move speed.', icon: 'winged_golden_boot_on_gold', speed: 0.1 },
      { name: 'Patient Vows', text: COOL, icon: CLOCK, cool: 0.12 },
      { name: 'Clear Mind', text: 'Held 25% shorter.', icon: 'broken_chain_links_snapping_on_grey', tenacity: 0.25 },
    ], 'p'),
    ...rowOf('priest', 2, [
      { name: 'Unshaken Faith', text: 'Take 8% less damage.', icon: 'holy_resist_status_sun_shield_on_gold', guard: 0.08 },
      { name: 'Answered Prayer', text: WIND, icon: 'white_wing_over_a_heart_on_gold', rally },
      { name: 'Steadfast', text: '+10% health.', icon: HP, hp: 0.1 },
    ], 'p'),
  ],
  paladin: [
    ...rowOf('paladin', 0, [
      { name: 'Heavy Oath', text: 'Your blows and spells hit 8% harder.', icon: 'golden_armoured_fist_with_a_light_burst_on_gold', dmg: 0.08 },
      { name: 'Zeal', text: 'Heal for 10% of the damage you deal.', icon: 'golden_chalice_with_a_light_glow_on_gold', leech: 0.1 },
      { name: 'Sun’s Verdict', ...superUp('d-super', 'Sunhammer') },
    ], 'd'),
    ...rowOf('paladin', 1, [
      { name: 'Binding Light', text: HOLD, icon: 'light_chain_binding_on_gold', hold: 0.2 },
      { name: 'Devotion', text: COOL, icon: CLOCK, cool: 0.12 },
      { name: 'Open Hands', text: 'Mana comes back 50% faster.', icon: 'mana_regen_status_blue_drop_on_blue', regen: 0.5 },
    ], 'd'),
    ...rowOf('paladin', 2, [
      { name: 'Unbroken Vow', text: 'Take 8% less damage.', icon: 'shining_tower_shield_with_a_lion_on_gold', guard: 0.08 },
      { name: 'Lay of Mercy', text: WIND, icon: 'golden_heart_with_white_wings_on_gold', rally },
      { name: 'Plate and Prayer', text: '+10% health.', icon: HP, hp: 0.1 },
    ], 'd'),
  ],
  warlock: [
    ...rowOf('warlock', 0, [
      { name: 'Black Hunger', text: 'Your spells and curses hit 8% harder.', icon: 'burning_magic_circle_on_black', dmg: 0.08 },
      { name: 'Soul Leech', text: 'Heal for 10% of the damage you deal.', icon: 'life_drain_beam_on_violet', leech: 0.1 },
      { name: 'Riftcaller', ...superUp('k-super', 'Riftmaw') },
    ], 'k'),
    ...rowOf('warlock', 1, [
      { name: 'Lingering Dread', text: HOLD, icon: 'hex_mark_eye_on_black', hold: 0.2 },
      { name: 'Dark Tempo', text: COOL, icon: 'hourglass_of_black_sand_on_violet', cool: 0.12 },
      { name: 'Deep Pact', text: 'Mana comes back 50% faster.', icon: MIND, regen: 0.5 },
    ], 'k'),
    ...rowOf('warlock', 2, [
      { name: 'Hollow Flesh', text: 'Take 8% less damage.', icon: 'half_damage_status_split_shield_on_blue', guard: 0.08 },
      { name: 'Unholy Vigor', text: '+10% health.', icon: HP, hp: 0.1 },
      { name: 'Old Resolve', text: 'Held 20% shorter.', icon: WILL, tenacity: 0.2 },
    ], 'k'),
  ],
  druid: [
    ...rowOf('druid', 0, [
      { name: 'Wild Bloom', text: 'Your healing and damage are 8% stronger.', icon: 'wild_growth_of_three_sprouts_on_green', dmg: 0.08, heal: 0.08 },
      { name: 'Gathering Storm', ...superUp('l-super', 'Thornstorm') },
      { name: 'Green Thumb', text: 'Mana comes back 50% faster.', icon: 'dew_drop_on_a_leaf_on_teal', regen: 0.5 },
    ], 'l'),
    ...rowOf('druid', 1, [
      { name: 'Old Roots', text: HOLD, icon: 'entangle_vines_on_green', hold: 0.2 },
      { name: 'Quick Thorn', text: COOL, icon: 'fern_unfurling_on_teal', cool: 0.12 },
      { name: 'Stag’s Stride', text: '+10% move speed.', icon: 'speed_feather_boots_on_teal', speed: 0.1 },
    ], 'l'),
    ...rowOf('druid', 2, [
      { name: 'Ironbark', text: 'Take 8% less damage.', icon: 'bark_skin_on_brown', guard: 0.08 },
      { name: 'Green Renewal', text: WIND, icon: 'tree_root_heart_on_brown', rally },
      { name: 'Deep Roots', text: '+10% health.', icon: HP, hp: 0.1 },
    ], 'l'),
  ],
  gloamknight: [
    ...rowOf('gloamknight', 0, [
      { name: 'Deep Draught', text: 'Heal for 10% of the damage you deal.', icon: 'lifesteal_status_heart_drop_on_red', leech: 0.1 },
      { name: 'Reaper’s Due', text: 'Deal 20% more damage to anyone under 35% health.', icon: 'skull_lantern_on_black', exec: 0.2 },
      { name: 'Eclipse Hunger', ...superUp('g-super', 'Eclipse Reaping') },
    ], 'g'),
    ...rowOf('gloamknight', 1, [
      { name: 'Grasping Dark', text: 'What you hit is slowed by 25% for 2 seconds.', icon: 'dark_tentacle_on_violet', slow: { pct: 25, dur: 2 } },
      { name: 'Restless Dusk', text: COOL, icon: 'doom_clock_on_violet', cool: 0.12 },
      { name: 'Dusk Stride', text: '+10% move speed.', icon: 'bone_wings_on_violet', speed: 0.1 },
    ], 'g'),
    ...rowOf('gloamknight', 2, [
      { name: 'Night’s Embrace', text: 'Take 8% less damage.', icon: 'iron_skin_armoured_chest_on_grey', guard: 0.08 },
      { name: 'Iron Dusk', text: '+10% health.', icon: HP, hp: 0.1 },
      { name: 'Unyielding Dark', text: 'Held 20% shorter.', icon: WILL, tenacity: 0.2 },
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
export const talentIcons = (): string[] => [...new Set([HP, WILL, MIND, 'crit_up_status_star_burst_on_gold', ...Object.values(TALENTS).flatMap((list) => list.flatMap((t) => (t.icon ? [t.icon] : [])))])];
