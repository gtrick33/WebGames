import type { ClassId, RegionId } from '../data/types';

/**
 * Sigilfall: The Vigil's own spells and strengths: none of them exist in the campaign. Hold the line against the
 * Ashen Host as long as you can. Each spell fires by itself; the player's choices are where to stand and what to
 * take when they level up. Every class has six spells of its own, built from the kinds sim.ts knows, and two of
 * them can evolve. Plain data with no imports but types, so the icon build script can read it.
 */

export type SpellKind = 'bolt' | 'nova' | 'chain' | 'orbit' | 'strike' | 'field' | 'cone' | 'lance' | 'rain' | 'pet' | 'aura' | 'pulse' | 'boomerang';
export type StrengthId = 'might' | 'haste' | 'reach' | 'swift' | 'vigor' | 'mend' | 'magnet' | 'fortune';

export const MAX_SPELL = 5;
export const MAX_STRENGTH = 5;
/** How many spells and strengths one run can hold. */
export const SPELL_SLOTS = 5;
export const STRENGTH_SLOTS = 5;

/** A base and how much each level adds. */
type Grow = readonly [number, number];

export interface Evolve {
  with: StrengthId;
  name: string;
  text: string;
  icon: string;
  dmg?: number;
  every?: number;
  size?: number;
  /** More of them. */
  more?: number;
  pierce?: number;
  /** Bursts where it lands, this big. */
  burst?: number;
  freeze?: boolean;
}

export interface SpellDef {
  id: string;
  cls: ClassId;
  name: string;
  text: string;
  /** What each level adds. */
  next: string;
  /** The icon, by its name in the pack (render/art/iconPicks.ts). */
  icon: string;
  kind: SpellKind;
  /** What it looks like in the world. */
  color: string;
  /** Damage: a hit, or per second for what keeps touching (orbit, field, pet, aura). */
  dmg: Grow;
  /** Seconds between casts: base, taken off each level, and the least it can be. */
  every?: readonly [number, number, number];
  /** How many, at level 1, and one more every this many levels. */
  n?: readonly [number, number];
  size?: Grow;
  /** Slows what it touches. */
  slow?: boolean;
  /** Share of the hero's health it gives back when it fires. */
  heal?: Grow;
  /** A companion's picture (the campaign's creature art). */
  sprite?: string;
  pierce?: number;
  evolve?: Evolve;
}

const spell = (d: SpellDef): SpellDef => d;

const KITS: Record<ClassId, SpellDef[]> = {
  mage: [
    spell({ id: 'ember-bolt', cls: 'mage', name: 'Ember Bolt', text: 'Flings a seeking ember at the nearest foe.', next: 'More embers, more damage', icon: 'fire_comet_with_a_long_tail_on_navy', kind: 'bolt', color: '#ff7a1e', dmg: [11, 4], every: [1.05, 0.09, 0.42], n: [1, 2], evolve: { with: 'haste', name: 'Phoenix Bolt', text: 'Embers pierce everything and burst where they land.', icon: 'fire_bird_spreading_wings_on_red', dmg: 1.5, more: 2, pierce: 99, burst: 22 } }),
    spell({ id: 'frost-ring', cls: 'mage', name: 'Frost Ring', text: 'A ring of cold bursts out from you and slows what it touches.', next: 'Wider, colder, more often', icon: 'blizzard_swirl_of_snow_on_white', kind: 'nova', color: '#9fdcff', dmg: [9, 4], every: [4.2, 0.4, 1.8], size: [46, 9], slow: true, evolve: { with: 'reach', name: 'Absolute Zero', text: 'The ring freezes everything it touches solid.', icon: 'frozen_block_with_a_shape_inside_on_blue', size: 1.3, freeze: true } }),
    spell({ id: 'chain-spark', cls: 'mage', name: 'Chain Spark', text: 'Lightning leaps from foe to foe.', next: 'More leaps, more damage', icon: 'chain_lightning_between_three_dots_on_violet', kind: 'chain', color: '#dff2ff', dmg: [12, 5], every: [1.9, 0.2, 0.8], n: [3, 1] }),
    spell({ id: 'orbit-motes', cls: 'mage', name: 'Arcane Motes', text: 'Motes circle you and burn what they pass through.', next: 'More motes, faster', icon: 'three_small_fireballs_orbiting_on_red', kind: 'orbit', color: '#b48cff', dmg: [26, 10], n: [2, 1] }),
    spell({ id: 'meteor', cls: 'mage', name: 'Falling Star', text: 'A star falls where the Host is thickest.', next: 'Bigger, and more often', icon: 'meteor_falling_with_flames_on_orange', kind: 'strike', color: '#ffb45c', dmg: [42, 18], every: [5.2, 0.5, 2.2], size: [34, 6] }),
    spell({ id: 'ash-field', cls: 'mage', name: 'Burning Ground', text: 'Leaves a patch of burning ground where you stand.', next: 'Hotter, wider, longer', icon: 'flame_circle_on_the_ground_on_dark_red', kind: 'field', color: '#ff6a2a', dmg: [12, 7], every: [3, 0.28, 1.4], size: [22, 4] }),
  ],
  warrior: [
    spell({ id: 'reaping-arc', cls: 'warrior', name: 'Reaping Arc', text: 'A great swing through everything in front of you.', next: 'Wider and heavier', icon: 'great_axe_with_a_bright_red_edge_on_red', kind: 'cone', color: '#f2ece0', dmg: [15, 6], every: [1.15, 0.08, 0.6], size: [46, 6], evolve: { with: 'might', name: 'The Headsman', text: 'The swing reaches twice as far and hits twice as hard.', icon: 'giant_sword_falling_from_the_sky_on_red', dmg: 2, size: 1.6 } }),
    spell({ id: 'thrown-axe', cls: 'warrior', name: 'Hurled Axe', text: 'An axe flies out through the Host and comes back to you.', next: 'More axes, more damage', icon: 'spinning_thrown_axe_with_motion_arcs_on_red', kind: 'boomerang', color: '#d8dce6', dmg: [13, 5], every: [1.8, 0.14, 0.9], n: [1, 2], size: [6, 0.5], evolve: { with: 'haste', name: 'Storm of Axes', text: 'A ring of axes spins out in every direction.', icon: 'crossed_sword_and_axe_on_red', more: 3, dmg: 1.25 } }),
    spell({ id: 'war-stomp', cls: 'warrior', name: 'Earth Stamp', text: 'You stamp, and the ground throws back what stands near.', next: 'Wider and harder', icon: 'stomping_boot_with_a_quake_ring_on_brown', kind: 'nova', color: '#d8a860', dmg: [12, 5], every: [3.8, 0.34, 1.7], size: [48, 8], slow: true }),
    spell({ id: 'steel-tempest', cls: 'warrior', name: 'Steel Tempest', text: 'Blades whirl around you, cutting whatever comes close.', next: 'Faster and wider', icon: 'whirlwind_spin_of_three_blade_arcs_on_red', kind: 'aura', color: '#e8e8f4', dmg: [24, 9], size: [28, 5] }),
    spell({ id: 'giants-blade', cls: 'warrior', name: 'Giant’s Blade', text: 'A sword of old iron falls where the Host is thickest.', next: 'Bigger, and more often', icon: 'sword_breaking_through_a_stone_wall_on_grey', kind: 'strike', color: '#c8d0e0', dmg: [46, 18], every: [5.2, 0.5, 2.2], size: [32, 6] }),
    spell({ id: 'blood-banner', cls: 'warrior', name: 'Blood Banner', text: 'Plants a banner: the ground around it bleeds your enemies.', next: 'Hotter, wider, longer', icon: 'war_banner_on_a_pole_with_a_red_pattern_on_red', kind: 'field', color: '#c8324a', dmg: [14, 7], every: [3.2, 0.3, 1.5], size: [24, 4] }),
  ],
  ranger: [
    spell({ id: 'seeking-arrow', cls: 'ranger', name: 'Seeking Arrow', text: 'Looses an arrow at the nearest foe.', next: 'More arrows, more damage', icon: 'arrow_shot_with_a_speed_trail_on_green', kind: 'bolt', color: '#d8ffb0', dmg: [10, 4], every: [0.82, 0.07, 0.34], n: [1, 2], pierce: 1, evolve: { with: 'haste', name: 'Ceaseless Volley', text: 'Arrows pour out and pass through everything.', icon: 'rapid_fire_arrows_on_green', more: 3, pierce: 99 } }),
    spell({ id: 'arrow-storm', cls: 'ranger', name: 'Arrow Storm', text: 'Arrows rain down on the Host all around you.', next: 'More arrows', icon: 'rain_of_arrows_from_the_sky_on_brown', kind: 'rain', color: '#e8e0a8', dmg: [11, 4], every: [1.7, 0.12, 0.9], n: [3, 1], size: [14, 1] }),
    spell({ id: 'wolf-pack', cls: 'ranger', name: 'Wolf Pack', text: 'A wolf runs at your side and tears at the Host.', next: 'More wolves', icon: 'wolf_pack_on_navy', kind: 'pet', color: '#c8c8d8', dmg: [20, 9], n: [1, 2], sprite: 'wolf', evolve: { with: 'might', name: 'Alpha’s Howl', text: 'The pack doubles, and bites twice as hard.', icon: 'wolf_howl_on_navy', more: 2, dmg: 1.8 } }),
    spell({ id: 'snapjaw', cls: 'ranger', name: 'Snapjaw Traps', text: 'Drops iron jaws where you walk: what steps in bleeds.', next: 'Sharper, wider, longer', icon: 'hunter_trap_with_jaws_on_brown', kind: 'field', color: '#9a8a68', dmg: [15, 7], every: [2.8, 0.26, 1.3], size: [20, 3.5], slow: true }),
    spell({ id: 'long-shot', cls: 'ranger', name: 'Long Shot', text: 'A heavy arrow that flies through a whole line of them.', next: 'Heavier, and more often', icon: 'piercing_arrow_through_a_shield_on_green', kind: 'lance', color: '#f6f2c8', dmg: [20, 8], every: [1.9, 0.16, 0.95], size: [10, 1] }),
    spell({ id: 'hawk-wheel', cls: 'ranger', name: 'Wheeling Hawks', text: 'Hawks circle you and strike what passes under them.', next: 'More hawks, faster', icon: 'hawk_companion_diving_on_teal', kind: 'orbit', color: '#ffe39a', dmg: [24, 9], n: [2, 1] }),
  ],
  priest: [
    spell({ id: 'lance-of-dawn', cls: 'priest', name: 'Lance of Dawn', text: 'A spear of light through everything in its way.', next: 'Heavier, and more often', icon: 'golden_spear_of_light_on_gold', kind: 'lance', color: '#fff0a8', dmg: [17, 7], every: [1.35, 0.12, 0.62], size: [10, 1], evolve: { with: 'reach', name: 'Noonday', text: 'The lance widens into a beam that burns the whole line.', icon: 'beam_of_light_from_the_sky_on_gold', size: 2.4, dmg: 1.6 } }),
    spell({ id: 'radiant-wave', cls: 'priest', name: 'Radiant Wave', text: 'A wave of light rolls out from you and mends you a little.', next: 'Wider and brighter', icon: 'radiant_star_burst_on_gold', kind: 'nova', color: '#ffe9a0', dmg: [10, 4], every: [3.9, 0.36, 1.8], size: [48, 9], heal: [1, 0.3] }),
    spell({ id: 'mending-light', cls: 'priest', name: 'Mending Light', text: 'Every so often light knits your wounds closed.', next: 'Heals more, more often', icon: 'two_open_hands_holding_light_on_gold', kind: 'pulse', color: '#b8ffb8', dmg: [0, 0], every: [7, 0.5, 3.5], heal: [7, 1.5], evolve: { with: 'vigor', name: 'Second Dawn', text: 'The light also burns everything near you when it comes.', icon: 'sunrise_over_a_hill_on_gold', dmg: 1, size: 1 } }),
    spell({ id: 'halo-ring', cls: 'priest', name: 'Ring of Halos', text: 'Rings of light circle you, burning what they touch.', next: 'More rings, faster', icon: 'golden_halo_ring_over_a_helmet_on_gold', kind: 'orbit', color: '#fff2b0', dmg: [25, 10], n: [2, 1] }),
    spell({ id: 'sunfall', cls: 'priest', name: 'Sunfall', text: 'A column of light falls where the Host is thickest.', next: 'Bigger, and more often', icon: 'light_pillar_on_a_round_altar_on_gold', kind: 'strike', color: '#fff0a8', dmg: [42, 17], every: [5, 0.48, 2.1], size: [34, 6] }),
    spell({ id: 'hallowed-ground', cls: 'priest', name: 'Blessed Earth', text: 'Holy ground under your feet burns all that isn’t you.', next: 'Hotter, wider, longer', icon: 'holy_ground_status_light_circle_on_gold', kind: 'field', color: '#ffe48a', dmg: [12, 7], every: [3, 0.28, 1.4], size: [24, 4] }),
  ],
  paladin: [
    spell({ id: 'thrown-hammer', cls: 'paladin', name: 'Oath Hammer', text: 'A hammer of light flies out and comes back to your hand.', next: 'More hammers, more damage', icon: 'hammer_of_light_with_golden_rays_on_gold', kind: 'boomerang', color: '#ffe48a', dmg: [14, 5], every: [1.8, 0.14, 0.9], n: [1, 2], size: [7, 0.5], evolve: { with: 'might', name: 'Twelve Hammers', text: 'Hammers wheel out in every direction and burst where they land.', icon: 'golden_armoured_fist_with_a_light_burst_on_gold', more: 3, burst: 18 } }),
    spell({ id: 'judging-light', cls: 'paladin', name: 'Judging Light', text: 'Judgment falls on the worst of them, from above.', next: 'Bigger, and more often', icon: 'golden_scales_of_justice_on_gold', kind: 'strike', color: '#fff0a8', dmg: [44, 17], every: [4.8, 0.45, 2], size: [30, 6] }),
    spell({ id: 'sun-ring', cls: 'paladin', name: 'Ring of the Sun', text: 'A ring of fire burns around you, always.', next: 'Hotter and wider', icon: 'sun_disc_with_rays_on_gold', kind: 'aura', color: '#ffc76a', dmg: [22, 9], size: [30, 5] }),
    spell({ id: 'blessed-ground', cls: 'paladin', name: 'Sworn Ground', text: 'The ground you stood on stays hallowed for a while.', next: 'Hotter, wider, longer', icon: 'sword_planted_with_a_light_circle_on_gold', kind: 'field', color: '#ffe9a0', dmg: [13, 7], every: [3, 0.28, 1.4], size: [24, 4] }),
    spell({ id: 'dawn-swing', cls: 'paladin', name: 'Dawn Swing', text: 'A broad swing of light through what is in front of you.', next: 'Wider and heavier', icon: 'holy_sword_with_light_rays_on_gold', kind: 'cone', color: '#fff2b0', dmg: [15, 6], every: [1.25, 0.09, 0.65], size: [44, 6], evolve: { with: 'reach', name: 'Crescent of Dawn', text: 'The swing becomes a full circle of light.', icon: 'radiant_crown_of_light_on_gold', size: 1.3, dmg: 1.5, more: 1 } }),
    spell({ id: 'aegis-pulse', cls: 'paladin', name: 'Oath’s Mending', text: 'Every so often your oath closes your wounds.', next: 'Heals more, more often', icon: 'golden_heart_with_white_wings_on_gold', kind: 'pulse', color: '#ffe48a', dmg: [0, 0], every: [7.5, 0.5, 3.8], heal: [8, 1.5] }),
  ],
  warlock: [
    spell({ id: 'soulfire', cls: 'warlock', name: 'Soulfire', text: 'A bolt of green fire seeks the nearest foe.', next: 'More bolts, more damage', icon: 'dark_flame_on_violet', kind: 'bolt', color: '#8bff6a', dmg: [12, 4], every: [1.1, 0.09, 0.44], n: [1, 2], evolve: { with: 'might', name: 'Ruinfire', text: 'Bolts burst where they land, and pass on through.', icon: 'dark_meteor_on_violet', burst: 24, pierce: 99, dmg: 1.4 } }),
    spell({ id: 'pit-imps', cls: 'warlock', name: 'Pit Imps', text: 'An imp fights at your side, clawing at the Host.', next: 'More imps', icon: 'shadow_imp_summon_on_black', kind: 'pet', color: '#ff7a3d', dmg: [20, 9], n: [1, 2], sprite: 'cinder-imp', evolve: { with: 'fortune', name: 'Open the Pit', text: 'The pit gives up twice as many, and they bite harder.', icon: 'summoning_circle_on_violet', more: 3, dmg: 1.5 } }),
    spell({ id: 'plague-rain', cls: 'warlock', name: 'Blight Rain', text: 'A sick green rain falls on the Host all around you.', next: 'More of it', icon: 'plague_cloud_on_dark_green', kind: 'rain', color: '#9ae85a', dmg: [11, 4], every: [1.7, 0.12, 0.9], n: [3, 1], size: [15, 1], slow: true }),
    spell({ id: 'soul-chain', cls: 'warlock', name: 'Soul Chain', text: 'A curse leaps from foe to foe.', next: 'More leaps, more damage', icon: 'bound_spirit_chain_on_teal', kind: 'chain', color: '#c88aff', dmg: [12, 5], every: [1.9, 0.2, 0.8], n: [3, 1] }),
    spell({ id: 'doom-ring', cls: 'warlock', name: 'Doom Ring', text: 'A black ring bursts out and slows all it touches.', next: 'Wider, more often', icon: 'ring_of_fire_on_black', kind: 'nova', color: '#a060ff', dmg: [10, 4], every: [4, 0.38, 1.8], size: [46, 9], slow: true }),
    spell({ id: 'black-star', cls: 'warlock', name: 'Black Star', text: 'A dead star falls where the Host is thickest.', next: 'Bigger, and more often', icon: 'dark_star_on_black', kind: 'strike', color: '#b080ff', dmg: [44, 18], every: [5.2, 0.5, 2.2], size: [34, 6] }),
  ],
  druid: [
    spell({ id: 'thorn-volley', cls: 'druid', name: 'Thorn Volley', text: 'Throws a thorn at the nearest foe.', next: 'More thorns, more damage', icon: 'thorn_arrow_on_dark_green', kind: 'bolt', color: '#a8e85a', dmg: [10, 4], every: [0.95, 0.08, 0.38], n: [1, 2], pierce: 1, evolve: { with: 'haste', name: 'Bramble Storm', text: 'Thorns burst into more thorns where they land.', icon: 'thorn_burst_on_dark_green', burst: 20, more: 2 } }),
    spell({ id: 'bear-swipe', cls: 'druid', name: 'Bear’s Swipe', text: 'A great paw swipes through what is in front of you.', next: 'Wider and heavier', icon: 'bear_form_claw_on_brown', kind: 'cone', color: '#e8d0a8', dmg: [15, 6], every: [1.25, 0.09, 0.62], size: [44, 6] }),
    spell({ id: 'spirit-stag', cls: 'druid', name: 'Spirit Beasts', text: 'A spirit of the wood runs beside you and gores the Host.', next: 'More of them', icon: 'stag_head_with_antlers_on_green', kind: 'pet', color: '#c8ffb0', dmg: [20, 9], n: [1, 2], sprite: 'blighted-stag' }),
    spell({ id: 'moonbeams', cls: 'druid', name: 'Moonbeams', text: 'Moonlight stabs down at the Host all around you.', next: 'More of them', icon: 'moonfire_beam_on_navy', kind: 'rain', color: '#cfe0ff', dmg: [12, 4.5], every: [1.7, 0.12, 0.9], n: [3, 1], size: [15, 1], evolve: { with: 'reach', name: 'Full Moon', text: 'The beams widen, and there are twice as many.', icon: 'crescent_moon_behind_clouds_on_navy', more: 4, size: 1.5 } }),
    spell({ id: 'living-roots', cls: 'druid', name: 'Living Roots', text: 'Roots rise where you stood, holding and crushing what crosses them.', next: 'Stronger, wider, longer', icon: 'root_grab_from_the_ground_on_brown', kind: 'field', color: '#7ad65a', dmg: [13, 7], every: [3, 0.28, 1.4], size: [24, 4], slow: true }),
    spell({ id: 'verdant-pulse', cls: 'druid', name: 'Verdant Pulse', text: 'Life wells up in you every so often and closes your wounds.', next: 'Heals more, more often', icon: 'rejuvenate_leaf_drop_on_green', kind: 'pulse', color: '#b8ffb8', dmg: [0, 0], every: [7, 0.5, 3.6], heal: [7, 1.5] }),
  ],
};

export const SPELLS: Record<string, SpellDef> = Object.fromEntries(Object.values(KITS).flat().map((s) => [s.id, s]));
export const spellsOf = (cls: ClassId): SpellDef[] => KITS[cls];
/** What a run starts with: the class's first spell. */
export const firstSpell = (cls: ClassId): SpellDef => KITS[cls][0]!;
export const ALL_SPELLS: SpellDef[] = Object.values(KITS).flat();

/** Each class starts a little differently: the heavy ones slower and sturdier. */
export const CLASS_BODY: Record<ClassId, { hp: number; speed: number }> = {
  warrior: { hp: 170, speed: 74 },
  paladin: { hp: 160, speed: 74 },
  druid: { hp: 130, speed: 80 },
  priest: { hp: 125, speed: 78 },
  mage: { hp: 130, speed: 78 },
  warlock: { hp: 128, speed: 78 },
  ranger: { hp: 112, speed: 84 },
};

export const STRENGTHS: Record<StrengthId, { id: StrengthId; name: string; text: string; icon: string }> = {
  might: { id: 'might', name: 'Might', text: '+15% damage', icon: 'strength_up_status_flexed_arm_on_red' },
  haste: { id: 'haste', name: 'Haste', text: 'Spells come 10% faster', icon: 'lightning_hourglass_on_violet' },
  reach: { id: 'reach', name: 'Reach', text: '+12% spell size', icon: 'shock_wave_ring_on_navy' },
  swift: { id: 'swift', name: 'Swift Feet', text: '+8% move speed', icon: 'haste_status_winged_boot_on_teal' },
  vigor: { id: 'vigor', name: 'Vigor', text: '+20% health', icon: 'toughness_heart_mastery_on_red' },
  mend: { id: 'mend', name: 'Mending', text: 'Regain 1 health a second', icon: 'regeneration_status_green_leaf_on_green' },
  magnet: { id: 'magnet', name: 'Lodestone', text: 'Pick up sparks from farther away', icon: 'magnetized_status_magnet_on_red' },
  fortune: { id: 'fortune', name: 'Fortune', text: '+10% experience', icon: 'exp_up_status_book_with_arrow_on_gold' },
};
export const REST_ICON = 'regeneration_status_green_leaf_on_green';

/** Every icon The Vigil shows, for the icon build. */
export const vigilIcons = (): string[] => [REST_ICON, ...Object.values(STRENGTHS).map((s) => s.icon), ...ALL_SPELLS.flatMap((s) => (s.evolve ? [s.icon, s.evolve.icon] : [s.icon]))];

/**
 * The Host through the night: how tough each wave is and when it comes. A land gives the waves their faces.
 * `from` and `to` are in seconds; the tide mixes what is in season.
 */
export interface FoeDef {
  sprite: string;
  hp: number;
  dmg: number;
  speed: number;
  r: number;
  xp: number;
  from: number;
  to: number;
  weight: number;
}

const WAVES: Omit<FoeDef, 'sprite'>[] = [
  { hp: 12, dmg: 6, speed: 46, r: 6, xp: 1, from: 0, to: 150, weight: 5 },
  { hp: 22, dmg: 7, speed: 40, r: 7, xp: 1, from: 30, to: 240, weight: 3 },
  { hp: 18, dmg: 8, speed: 82, r: 6, xp: 1, from: 60, to: 360, weight: 3 },
  { hp: 46, dmg: 10, speed: 50, r: 7, xp: 2, from: 110, to: 520, weight: 5 },
  { hp: 110, dmg: 14, speed: 60, r: 9, xp: 4, from: 200, to: 700, weight: 2 },
  { hp: 130, dmg: 16, speed: 66, r: 7, xp: 4, from: 300, to: 900, weight: 4 },
  { hp: 320, dmg: 22, speed: 52, r: 9, xp: 8, from: 460, to: 99999, weight: 3 },
  { hp: 620, dmg: 30, speed: 56, r: 10, xp: 14, from: 640, to: 99999, weight: 3 },
];

export interface VigilMap {
  id: string;
  /** The campaign's land it is fought on. */
  region: RegionId;
  name: string;
  blurb: string;
  color: string;
  /** The faces of the waves, in the order they come (the last repeats). */
  foes: string[];
  /** Its champions, in turn. */
  champions: { sprite: string; name: string }[];
}

export const VIGIL_MAPS: VigilMap[] = [
  { id: 'whisperwood', region: 'whisperwood', name: 'Whisperwood', blurb: 'Where every watch begins.', color: '#3f8f5a', foes: ['slime', 'beetle', 'goblin', 'sprite', 'boar', 'enforcer', 'guardian'], champions: [{ sprite: 'guardian', name: 'The Gravewarden' }, { sprite: 'boar', name: 'The Bone Tusk' }, { sprite: 'enforcer', name: 'The Ash Captain' }] },
  { id: 'thornvale', region: 'thornvale', name: 'Thornvale', blurb: 'Bandits and wolves, and worse behind them.', color: '#a8863a', foes: ['wolf', 'cutthroat', 'bandit-archer', 'spider', 'hedge-witch', 'enforcer'], champions: [{ sprite: 'enforcer', name: 'The Gallows Boss' }, { sprite: 'wolf', name: 'Old Greymane' }] },
  { id: 'brackenridge', region: 'brackenridge', name: 'Brackenridge', blurb: 'Kobolds in the hills, and shades under them.', color: '#c86a2a', foes: ['ridge-kobold', 'kobold-candler', 'russet-boar', 'restless-shade', 'barrow-skeleton', 'wolf'], champions: [{ sprite: 'king-snagtooth', name: 'King Snagtooth' }, { sprite: 'the-grey-lady', name: 'The Grey Lady' }] },
  { id: 'greyfen', region: 'greyfen', name: 'Greyfen Marsh', blurb: 'The drowned don’t stay down here.', color: '#5a7a5a', foes: ['marsh-wisp', 'drowned-villager', 'bog-ghoul', 'marsh-strider', 'bloated-drowned', 'bog-hag'], champions: [{ sprite: 'mother-mire', name: 'Mother Mire' }, { sprite: 'bog-hag', name: 'The Bog Hag' }] },
  { id: 'saltmarsh', region: 'saltmarsh', name: 'Saltmarsh Coast', blurb: 'The tide brings them in, and keeps on bringing them.', color: '#3a8fb0', foes: ['crab', 'mirefin', 'harpy', 'smuggler', 'mirefin-oracle', 'spider'], champions: [{ sprite: 'crab', name: 'Old Snapjaw' }, { sprite: 'smuggler', name: 'The Wrecker' }] },
  { id: 'ironpeak', region: 'ironpeak', name: 'Ironpeak', blurb: 'Thin air, and bone-steel in the mines.', color: '#7a8a9a', foes: ['frost-ram', 'griffon', 'legion-miner', 'legion-slagthrower', 'legion-bonecaller', 'bone-golem'], champions: [{ sprite: 'bone-golem', name: 'The Slag King' }, { sprite: 'griffon', name: 'The Peak Tyrant' }] },
  { id: 'ashen-barrows', region: 'ashen-barrows', name: 'Ashen Barrows', blurb: 'Grey kings under grey hills.', color: '#6a6a7a', foes: ['corpse-candle', 'barrow-hound', 'barrow-wight', 'wight-archer', 'wight-knight', 'banshee'], champions: [{ sprite: 'the-headless-lord', name: 'The Headless Lord' }, { sprite: 'banshee', name: 'The Keening' }] },
  { id: 'sunscorch', region: 'sunscorch', name: 'Sunscorch', blurb: 'Nothing lives out here. A lot still walks.', color: '#d8a860', foes: ['tomb-scarab', 'sand-scorpion', 'dune-raider', 'sun-mummy', 'dune-javelineer', 'bone-golem'], champions: [{ sprite: 'sand-wurm', name: 'The Sand Wurm' }, { sprite: 'khamsin', name: 'Khamsin' }] },
  { id: 'rimeheld', region: 'rimeheld', name: 'Rimeheld', blurb: 'Keep moving. The cold is also trying to kill you.', color: '#9fd0ee', foes: ['ice-wolf', 'legion-spearman', 'rime-wraith', 'legion-huscarl', 'yeti', 'frost-giant'], champions: [{ sprite: 'frost-giant', name: 'The Frost Jarl' }, { sprite: 'yeti', name: 'Old Whiteback' }] },
  { id: 'vinecoil', region: 'vinecoil', name: 'Vinecoil Jungle', blurb: 'Everything here bites.', color: '#3a8a4a', foes: ['blood-mosquito', 'temple-viper', 'jungle-panther', 'serpent-cultist', 'vine-strangler', 'naga-warrior'], champions: [{ sprite: 'the-coiled-queen', name: 'The Coiled Queen' }, { sprite: 'naga-warrior', name: 'The Naga Warlord' }] },
  { id: 'emberdeep', region: 'emberdeep', name: 'Emberdeep Caldera', blurb: 'Hot enough to melt a sword. Hold anyway.', color: '#c8481e', foes: ['cinder-imp', 'magma-hound', 'legion-forgeslave', 'legion-flamecaller', 'fire-elemental', 'ash-drake'], champions: [{ sprite: 'pyrebrand', name: 'Pyrebrand' }, { sprite: 'ash-drake', name: 'The Ash Drake' }] },
  { id: 'pale-reach', region: 'pale-reach', name: 'The Pale Reach', blurb: 'The last line. Nobody has held it long.', color: '#a8a0c8', foes: ['pale-hound', 'frost-wraith', 'hollow-legionnaire', 'soul-reaver', 'pale-knight', 'bone-drake'], champions: [{ sprite: 'bone-drake', name: 'The Bone Drake' }, { sprite: 'pale-knight', name: 'The Pale Knight' }] },
];

/** The next land opens when you've held this long on the one before it. */
export const UNLOCK_HOLD = 300;
export const mapOpen = (i: number, best: Record<string, number>): boolean => i === 0 || (best[VIGIL_MAPS[i - 1]!.id] ?? 0) >= UNLOCK_HOLD;

export const mapIndex = (m: VigilMap): number => VIGIL_MAPS.indexOf(m);
export const foesOf = (m: VigilMap): FoeDef[] => WAVES.map((w, i) => ({ ...w, sprite: m.foes[Math.min(i, m.foes.length - 1)]! }));
/** Each land further on is a little tougher from the first wave. */
export const landTough = (m: VigilMap): number => 1 + mapIndex(m) * 0.07;

/** The champion at each of these times: bigger, slower, and its fall is a free choice. */
export const BOSS_EVERY = 150;
