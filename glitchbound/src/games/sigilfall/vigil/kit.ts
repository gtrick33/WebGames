import type { ClassId, RegionId } from '../data/types';

/**
 * Sigilfall: The Vigil's own spells and strengths: none of them exist in the campaign. Hold the line against the
 * Ashen Host as long as you can. Each spell fires by itself; the player's choices are where to stand and what to take
 * when they level up. Every class has six spells of its own, built from the kinds sim.ts knows. Every level of a spell
 * is a choice between upgrades that change how that spell plays, and some spells evolve at the top. Plain data with no
 * imports but types, so the icon build script can read it.
 */

export type SpellKind = 'bolt' | 'nova' | 'chain' | 'orbit' | 'strike' | 'field' | 'cone' | 'lance' | 'rain' | 'pet' | 'aura' | 'pulse' | 'boomerang';
export type StrengthId = 'might' | 'haste' | 'reach' | 'swift' | 'vigor' | 'mend' | 'magnet' | 'fortune' | 'fang' | 'keg' | 'thorns' | 'coin' | 'ghost' | 'wind' | 'glass' | 'drum';
/** Which of the spell pack's ten colors a spell's effects come in (render/vigil.ts). */
export type Element = 'fire' | 'ice' | 'lightning' | 'arcane' | 'nature' | 'poison' | 'holy' | 'shadow' | 'water' | 'blood';

export const MAX_SPELL = 6;
export const MAX_STRENGTH = 5;
/** How many spells and strengths one run can hold. */
export const SPELL_SLOTS = 5;
export const STRENGTH_SLOTS = 6;

/** A base and how much each level adds. */
type Grow = readonly [number, number];

/** What an upgrade or evolution changes about a spell. Shares unless it says otherwise. */
export interface Mod {
  /** +share of damage (or, on a mend, of healing). */
  dmg?: number;
  /** ±share of the time between casts. */
  every?: number;
  /** +share of size. */
  size?: number;
  /** More of them (a whole number). */
  more?: number;
  /** Goes through this many more. */
  pierce?: number;
  /** Explodes where it lands, this big. */
  burst?: number;
  /** Goes on to this many more foes. */
  bounce?: number;
  /** Curves after its target. */
  homing?: boolean;
  /** Slows what it touches. */
  slow?: boolean;
  /** Freezes what it touches solid. */
  freeze?: boolean;
  /** Stops what it touches for this many seconds. */
  stun?: number;
  /** +chance of a critical hit. */
  crit?: number;
  /** Throws what it hits back, this hard. */
  knock?: number;
  /** Heals its caster this much per hit. */
  leech?: number;
  /** Leaves burning ground behind. */
  trail?: boolean;
  /** Draws foes to its middle. */
  pull?: boolean;
  /** Happens again a moment later. */
  echo?: boolean;
  /** +seconds it lasts. */
  last?: number;
  /** +share of speed. */
  speed?: number;
  /** Seconds nothing can touch the hero when it goes off. */
  guard?: number;
}

export interface Upgrade extends Mod {
  id: string;
  name: string;
  text: string;
}

export interface Evolve extends Mod {
  with: StrengthId;
  name: string;
  text: string;
  icon: string;
}

export interface SpellDef {
  id: string;
  cls: ClassId;
  name: string;
  text: string;
  /** The icon, by its name in the pack (render/art/iconPicks.ts). */
  icon: string;
  kind: SpellKind;
  /** The color of its effects. */
  el: Element;
  /** What to call them on an upgrade's card. */
  noun: string;
  one: string;
  /** Glow where the pack has no picture. */
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
  /** What a thrown one is (the campaign's weapon art). */
  weapon?: string;
  /** How it falls or rises, for a strike: a falling star, a column of light, a sword from the sky. */
  look?: 'star' | 'column' | 'blade' | 'portal' | 'lightning';
  pierce?: number;
  /** The upgrade only this spell has. */
  sig: Omit<Upgrade, 'id'>;
  evolve?: Evolve;
}

const spell = (d: SpellDef): SpellDef => d;

const KITS: Record<ClassId, SpellDef[]> = {
  mage: [
    spell({ id: 'ember-bolt', cls: 'mage', name: 'Ember Bolt', text: 'Flings a seeking ember at the nearest foe.', icon: 'fire_comet_with_a_long_tail_on_navy', kind: 'bolt', el: 'fire', noun: 'Embers', one: 'ember', color: '#ff7a1e', dmg: [13, 5], every: [1.05, 0.09, 0.42], n: [1, 3], sig: { name: 'Cinder Wake', text: 'Embers leave burning ground where they land', trail: true }, evolve: { with: 'haste', name: 'Phoenix Bolt', text: 'Embers pierce everything and burst where they land.', icon: 'fire_bird_spreading_wings_on_red', dmg: 0.5, more: 2, pierce: 99, burst: 22 } }),
    spell({ id: 'frost-ring', cls: 'mage', name: 'Frost Ring', text: 'A ring of cold bursts out from you and slows what it touches.', icon: 'blizzard_swirl_of_snow_on_white', kind: 'nova', el: 'ice', noun: 'Frost Ring', one: 'ring', color: '#9fdcff', dmg: [12, 5], every: [4.2, 0.4, 1.8], size: [46, 9], slow: true, sig: { name: 'Deep Winter', text: 'Foes it touches are stopped dead for a moment', stun: 0.7 }, evolve: { with: 'reach', name: 'Absolute Zero', text: 'The ring freezes everything it touches solid.', icon: 'frozen_block_with_a_shape_inside_on_blue', size: 0.3, freeze: true } }),
    spell({ id: 'chain-spark', cls: 'mage', name: 'Chain Spark', text: 'Lightning leaps from foe to foe.', icon: 'chain_lightning_between_three_dots_on_violet', kind: 'chain', el: 'lightning', noun: 'Sparks', one: 'spark', color: '#dff2ff', dmg: [14, 6], every: [1.9, 0.2, 0.8], n: [3, 1], sig: { name: 'Overcharge', text: 'Each leap has a 25% chance to crit', crit: 0.25 } }),
    spell({ id: 'orbit-motes', cls: 'mage', name: 'Arcane Motes', text: 'Motes circle you and burn what they pass through.', icon: 'three_small_fireballs_orbiting_on_red', kind: 'orbit', el: 'arcane', noun: 'Motes', one: 'mote', color: '#b48cff', dmg: [26, 10], n: [2, 2], sig: { name: 'Mana Drinkers', text: 'Motes feed a little of what they burn back to you', leech: 0.6 } }),
    spell({ id: 'meteor', cls: 'mage', name: 'Falling Star', text: 'A star falls where the Host is thickest.', icon: 'meteor_falling_with_flames_on_orange', kind: 'strike', el: 'fire', look: 'star', noun: 'Stars', one: 'star', color: '#ffb45c', dmg: [42, 18], every: [5.2, 0.5, 2.2], size: [34, 6], sig: { name: 'Crater', text: 'Leaves a pool of burning ground where it hits', trail: true } }),
    spell({ id: 'ash-field', cls: 'mage', name: 'Burning Ground', text: 'Leaves a rune of burning ground where you stand.', icon: 'flame_circle_on_the_ground_on_dark_red', kind: 'field', el: 'fire', noun: 'Runes', one: 'rune', color: '#ff6a2a', dmg: [12, 7], every: [3, 0.28, 1.4], size: [22, 4], sig: { name: 'Fire Walker', text: 'Runes come far more often', every: -0.3 } }),
  ],
  warrior: [
    spell({ id: 'reaping-arc', cls: 'warrior', name: 'Reaping Arc', text: 'A great swing through everything in front of you.', icon: 'great_axe_with_a_bright_red_edge_on_red', kind: 'cone', el: 'blood', noun: 'Arc', one: 'swing', color: '#f2ece0', dmg: [15, 6], every: [1.15, 0.08, 0.6], size: [46, 6], sig: { name: 'Bloodletter', text: 'Every foe cut heals you a little', leech: 0.5 }, evolve: { with: 'might', name: 'The Headsman', text: 'The swing reaches much farther and hits twice as hard.', icon: 'giant_sword_falling_from_the_sky_on_red', dmg: 1, size: 0.6 } }),
    spell({ id: 'thrown-axe', cls: 'warrior', name: 'Hurled Axe', text: 'An axe flies out through the Host and comes back to you.', icon: 'spinning_thrown_axe_with_motion_arcs_on_red', kind: 'boomerang', el: 'blood', weapon: 'axe', noun: 'Axes', one: 'axe', color: '#d8dce6', dmg: [13, 5], every: [1.8, 0.14, 0.9], n: [1, 3], size: [6, 0.5], sig: { name: 'Stumbling Blow', text: 'Whatever the axe hits staggers to a stop', stun: 0.35 }, evolve: { with: 'haste', name: 'Storm of Axes', text: 'A ring of axes spins out in every direction.', icon: 'crossed_sword_and_axe_on_red', more: 3, dmg: 0.25 } }),
    spell({ id: 'war-stomp', cls: 'warrior', name: 'Earth Stamp', text: 'You stamp, and the ground throws back what stands near.', icon: 'stomping_boot_with_a_quake_ring_on_brown', kind: 'nova', el: 'blood', noun: 'Stamp', one: 'stamp', color: '#d8a860', dmg: [12, 5], every: [3.8, 0.34, 1.7], size: [48, 8], slow: true, sig: { name: 'Quake', text: 'Foes are thrown far back', knock: 150 } }),
    spell({ id: 'steel-tempest', cls: 'warrior', name: 'Steel Tempest', text: 'Blades whirl around you, cutting whatever comes close.', icon: 'whirlwind_spin_of_three_blade_arcs_on_red', kind: 'aura', el: 'blood', noun: 'Tempest', one: 'blade', color: '#e8e8f4', dmg: [24, 9], size: [28, 5], sig: { name: 'Eye of the Storm', text: 'What it cuts is thrown clear of you', knock: 50 } }),
    spell({ id: 'giants-blade', cls: 'warrior', name: 'Giant’s Blade', text: 'A sword of old iron falls where the Host is thickest.', icon: 'sword_breaking_through_a_stone_wall_on_grey', kind: 'strike', el: 'blood', look: 'blade', noun: 'Blades', one: 'blade', color: '#c8d0e0', dmg: [46, 18], every: [5.2, 0.5, 2.2], size: [32, 6], sig: { name: 'Shockblade', text: 'A second sword follows the first', echo: true } }),
    spell({ id: 'blood-banner', cls: 'warrior', name: 'Blood Banner', text: 'Plants a banner: the ground around it bleeds your enemies.', icon: 'war_banner_on_a_pole_with_a_red_pattern_on_red', kind: 'field', el: 'blood', noun: 'Banners', one: 'banner', color: '#c8324a', dmg: [14, 7], every: [3.2, 0.3, 1.5], size: [24, 4], sig: { name: 'Rally', text: 'What bleeds there heals you', leech: 0.3 } }),
  ],
  ranger: [
    spell({ id: 'seeking-arrow', cls: 'ranger', name: 'Seeking Arrow', text: 'Looses an arrow at the nearest foe.', icon: 'arrow_shot_with_a_speed_trail_on_green', kind: 'bolt', el: 'nature', noun: 'Arrows', one: 'arrow', color: '#d8ffb0', dmg: [10, 4], every: [0.82, 0.07, 0.34], n: [1, 3], pierce: 1, sig: { name: 'Called Shot', text: 'Arrows have a 25% chance to crit', crit: 0.25 }, evolve: { with: 'haste', name: 'Ceaseless Volley', text: 'Arrows pour out and pass through everything.', icon: 'rapid_fire_arrows_on_green', more: 3, pierce: 99 } }),
    spell({ id: 'arrow-storm', cls: 'ranger', name: 'Arrow Storm', text: 'Arrows rain down on the Host all around you.', icon: 'rain_of_arrows_from_the_sky_on_brown', kind: 'rain', el: 'nature', noun: 'Arrows', one: 'arrow', color: '#e8e0a8', dmg: [11, 4], every: [1.7, 0.12, 0.9], n: [3, 1], size: [14, 1], sig: { name: 'Pinning Shots', text: 'What they hit is stopped for a moment', stun: 0.4 } }),
    spell({ id: 'wolf-pack', cls: 'ranger', name: 'Wolf Pack', text: 'A wolf runs at your side and tears at the Host.', icon: 'wolf_pack_on_navy', kind: 'pet', el: 'nature', sprite: 'wolf', noun: 'Wolves', one: 'wolf', color: '#c8c8d8', dmg: [20, 9], n: [1, 3], sig: { name: 'Hunting Howl', text: 'Wolves run a third faster', speed: 0.34 }, evolve: { with: 'might', name: 'Alpha’s Howl', text: 'The pack doubles, and bites twice as hard.', icon: 'wolf_howl_on_navy', more: 2, dmg: 0.8 } }),
    spell({ id: 'snapjaw', cls: 'ranger', name: 'Snapjaw Traps', text: 'Drops iron jaws where you walk: what steps in bleeds.', icon: 'hunter_trap_with_jaws_on_brown', kind: 'field', el: 'nature', noun: 'Traps', one: 'trap', color: '#9a8a68', dmg: [15, 7], every: [2.8, 0.26, 1.3], size: [20, 3.5], slow: true, sig: { name: 'Bear Trap', text: 'Traps hold what steps in them fast', stun: 0.8 } }),
    spell({ id: 'long-shot', cls: 'ranger', name: 'Long Shot', text: 'A heavy arrow that flies through a whole line of them.', icon: 'piercing_arrow_through_a_shield_on_green', kind: 'lance', el: 'nature', noun: 'Long Shots', one: 'shot', color: '#f6f2c8', dmg: [20, 8], every: [1.9, 0.16, 0.95], size: [10, 1], sig: { name: 'Clean Through', text: 'A 30% chance to crit', crit: 0.3 } }),
    spell({ id: 'hawk-wheel', cls: 'ranger', name: 'Wheeling Hawks', text: 'Hawks circle you and strike what passes under them.', icon: 'hawk_companion_diving_on_teal', kind: 'orbit', el: 'lightning', noun: 'Hawks', one: 'hawk', color: '#ffe39a', dmg: [24, 9], n: [2, 2], sig: { name: 'Talons', text: 'Their strike throws foes back', knock: 90 } }),
  ],
  priest: [
    spell({ id: 'lance-of-dawn', cls: 'priest', name: 'Lance of Dawn', text: 'A spear of light through everything in its way.', icon: 'golden_spear_of_light_on_gold', kind: 'lance', el: 'holy', noun: 'Lances', one: 'lance', color: '#fff0a8', dmg: [17, 7], every: [1.35, 0.12, 0.62], size: [10, 1], sig: { name: 'Blessed Spear', text: 'Each foe it pierces heals you a little', leech: 0.3 }, evolve: { with: 'reach', name: 'Noonday', text: 'The lance widens into a beam that burns the whole line.', icon: 'beam_of_light_from_the_sky_on_gold', size: 1.4, dmg: 0.6 } }),
    spell({ id: 'radiant-wave', cls: 'priest', name: 'Radiant Wave', text: 'A wave of light rolls out from you and mends you a little.', icon: 'radiant_star_burst_on_gold', kind: 'nova', el: 'holy', noun: 'Wave', one: 'wave', color: '#ffe9a0', dmg: [10, 4], every: [3.9, 0.36, 1.8], size: [48, 9], heal: [1, 0.3], sig: { name: 'Blinding Light', text: 'Foes it touches stand stunned for a moment', stun: 0.6 } }),
    spell({ id: 'mending-light', cls: 'priest', name: 'Mending Light', text: 'Every so often light knits your wounds closed.', icon: 'two_open_hands_holding_light_on_gold', kind: 'pulse', el: 'holy', noun: 'Mending', one: 'mending', color: '#b8ffb8', dmg: [0, 0], every: [7, 0.5, 3.5], heal: [7, 1.5], sig: { name: 'Sanctuary', text: 'Nothing can touch you for a moment when it comes', guard: 1.4 }, evolve: { with: 'vigor', name: 'Second Dawn', text: 'The light also burns everything near you when it comes.', icon: 'sunrise_over_a_hill_on_gold', burst: 70 } }),
    spell({ id: 'halo-ring', cls: 'priest', name: 'Ring of Halos', text: 'Rings of light circle you, burning what they touch.', icon: 'golden_halo_ring_over_a_helmet_on_gold', kind: 'orbit', el: 'holy', noun: 'Halos', one: 'halo', color: '#fff2b0', dmg: [25, 10], n: [2, 2], sig: { name: 'Purity', text: 'Halos slow whatever they touch', slow: true } }),
    spell({ id: 'sunfall', cls: 'priest', name: 'Sunfall', text: 'A column of light falls where the Host is thickest.', icon: 'light_pillar_on_a_round_altar_on_gold', kind: 'strike', el: 'holy', look: 'column', noun: 'Sunfalls', one: 'sunfall', color: '#fff0a8', dmg: [42, 17], every: [5, 0.48, 2.1], size: [34, 6], sig: { name: 'Judgment Day', text: 'A second column follows the first', echo: true } }),
    spell({ id: 'hallowed-ground', cls: 'priest', name: 'Blessed Earth', text: 'Holy ground under your feet burns all that isn’t you.', icon: 'holy_ground_status_light_circle_on_gold', kind: 'field', el: 'holy', noun: 'Earth', one: 'circle', color: '#ffe48a', dmg: [12, 7], every: [3, 0.28, 1.4], size: [24, 4], sig: { name: 'Pilgrim’s Rest', text: 'What burns there mends you', leech: 0.3 } }),
  ],
  paladin: [
    spell({ id: 'thrown-hammer', cls: 'paladin', name: 'Oath Hammer', text: 'A hammer of light flies out and comes back to your hand.', icon: 'hammer_of_light_with_golden_rays_on_gold', kind: 'boomerang', el: 'holy', weapon: 'hammer', noun: 'Hammers', one: 'hammer', color: '#ffe48a', dmg: [14, 5], every: [1.8, 0.14, 0.9], n: [1, 3], size: [7, 0.5], sig: { name: 'Thunderclap', text: 'Whatever the hammer hits is thrown back', knock: 110 }, evolve: { with: 'might', name: 'Twelve Hammers', text: 'Hammers wheel out in every direction and burst where they land.', icon: 'golden_armoured_fist_with_a_light_burst_on_gold', more: 3, burst: 18 } }),
    spell({ id: 'judging-light', cls: 'paladin', name: 'Judging Light', text: 'Judgment falls on the worst of them, from above.', icon: 'golden_scales_of_justice_on_gold', kind: 'strike', el: 'holy', look: 'column', noun: 'Judgments', one: 'judgment', color: '#fff0a8', dmg: [44, 17], every: [4.8, 0.45, 2], size: [30, 6], sig: { name: 'Final Word', text: 'A 35% chance to crit', crit: 0.35 } }),
    spell({ id: 'sun-ring', cls: 'paladin', name: 'Ring of the Sun', text: 'A ring of fire burns around you, always.', icon: 'sun_disc_with_rays_on_gold', kind: 'aura', el: 'fire', noun: 'Sun Ring', one: 'ring', color: '#ffc76a', dmg: [22, 9], size: [30, 5], sig: { name: 'Solar Flare', text: 'It pushes foes away from you', knock: 40 } }),
    spell({ id: 'blessed-ground', cls: 'paladin', name: 'Sworn Ground', text: 'The ground you stood on stays hallowed for a while.', icon: 'sword_planted_with_a_light_circle_on_gold', kind: 'field', el: 'holy', noun: 'Ground', one: 'circle', color: '#ffe9a0', dmg: [13, 7], every: [3, 0.28, 1.4], size: [24, 4], sig: { name: 'Hold the Line', text: 'What crosses it is stopped for a moment', stun: 0.5 } }),
    spell({ id: 'dawn-swing', cls: 'paladin', name: 'Dawn Swing', text: 'A broad swing of light through what is in front of you.', icon: 'holy_sword_with_light_rays_on_gold', kind: 'cone', el: 'holy', noun: 'Swing', one: 'swing', color: '#fff2b0', dmg: [15, 6], every: [1.25, 0.09, 0.65], size: [44, 6], sig: { name: 'Blinding Edge', text: 'Foes it cuts are slowed', slow: true }, evolve: { with: 'reach', name: 'Crescent of Dawn', text: 'The swing becomes a full circle of light.', icon: 'radiant_crown_of_light_on_gold', size: 0.3, dmg: 0.5, more: 1 } }),
    spell({ id: 'aegis-pulse', cls: 'paladin', name: 'Oath’s Mending', text: 'Every so often your oath closes your wounds.', icon: 'golden_heart_with_white_wings_on_gold', kind: 'pulse', el: 'holy', noun: 'Mending', one: 'mending', color: '#ffe48a', dmg: [0, 0], every: [7.5, 0.5, 3.8], heal: [8, 1.5], sig: { name: 'Shield of Faith', text: 'Nothing can touch you for a moment when it comes', guard: 1.6 } }),
  ],
  warlock: [
    spell({ id: 'soulfire', cls: 'warlock', name: 'Soulfire', text: 'A bolt of green fire seeks the nearest foe.', icon: 'dark_flame_on_violet', kind: 'bolt', el: 'poison', noun: 'Soulfires', one: 'bolt', color: '#8bff6a', dmg: [12, 4], every: [1.1, 0.09, 0.44], n: [1, 3], sig: { name: 'Soul Harvest', text: 'Each hit feeds you a little', leech: 0.4 }, evolve: { with: 'might', name: 'Ruinfire', text: 'Bolts burst where they land, and pass on through.', icon: 'dark_meteor_on_violet', burst: 24, pierce: 99, dmg: 0.4 } }),
    spell({ id: 'pit-imps', cls: 'warlock', name: 'Pit Imps', text: 'An imp fights at your side, clawing at the Host.', icon: 'shadow_imp_summon_on_black', kind: 'pet', el: 'fire', sprite: 'cinder-imp', noun: 'Imps', one: 'imp', color: '#ff7a3d', dmg: [20, 9], n: [1, 3], sig: { name: 'Fire Bellies', text: 'Imps throw back what they hit', knock: 80 }, evolve: { with: 'fortune', name: 'Open the Pit', text: 'The pit gives up twice as many, and they bite harder.', icon: 'summoning_circle_on_violet', more: 3, dmg: 0.5 } }),
    spell({ id: 'plague-rain', cls: 'warlock', name: 'Blight Rain', text: 'A sick green rain falls on the Host all around you.', icon: 'plague_cloud_on_dark_green', kind: 'rain', el: 'poison', noun: 'Blight', one: 'drop', color: '#9ae85a', dmg: [11, 4], every: [1.7, 0.12, 0.9], n: [3, 1], size: [15, 1], slow: true, sig: { name: 'Lingering Rot', text: 'Each drop leaves a pool of poison', trail: true } }),
    spell({ id: 'soul-chain', cls: 'warlock', name: 'Soul Chain', text: 'A curse leaps from foe to foe.', icon: 'bound_spirit_chain_on_teal', kind: 'chain', el: 'shadow', noun: 'Chains', one: 'chain', color: '#c88aff', dmg: [12, 5], every: [1.9, 0.2, 0.8], n: [3, 1], sig: { name: 'Bound Souls', text: 'Every foe it touches feeds you', leech: 0.4 } }),
    spell({ id: 'doom-ring', cls: 'warlock', name: 'Doom Ring', text: 'A black ring bursts out and slows all it touches.', icon: 'ring_of_fire_on_black', kind: 'nova', el: 'shadow', noun: 'Doom Ring', one: 'ring', color: '#a060ff', dmg: [10, 4], every: [4, 0.38, 1.8], size: [46, 9], slow: true, sig: { name: 'Event Horizon', text: 'It drags foes toward you instead of pushing', pull: true } }),
    spell({ id: 'black-star', cls: 'warlock', name: 'Black Star', text: 'A dead star falls where the Host is thickest.', icon: 'dark_star_on_black', kind: 'strike', el: 'shadow', look: 'portal', noun: 'Black Stars', one: 'star', color: '#b080ff', dmg: [44, 18], every: [5.2, 0.5, 2.2], size: [34, 6], sig: { name: 'Gravity Well', text: 'It drags everything nearby into the blast', pull: true } }),
  ],
  druid: [
    spell({ id: 'thorn-volley', cls: 'druid', name: 'Thorn Volley', text: 'Throws a thorn at the nearest foe.', icon: 'thorn_arrow_on_dark_green', kind: 'bolt', el: 'nature', noun: 'Thorns', one: 'thorn', color: '#a8e85a', dmg: [10, 4], every: [0.95, 0.08, 0.38], n: [1, 3], pierce: 1, sig: { name: 'Barbed', text: 'Whatever a thorn hits is slowed', slow: true }, evolve: { with: 'haste', name: 'Bramble Storm', text: 'Thorns burst into more thorns where they land.', icon: 'thorn_burst_on_dark_green', burst: 20, more: 2 } }),
    spell({ id: 'bear-swipe', cls: 'druid', name: 'Bear’s Swipe', text: 'A great paw swipes through what is in front of you.', icon: 'bear_form_claw_on_brown', kind: 'cone', el: 'nature', noun: 'Swipe', one: 'swipe', color: '#e8d0a8', dmg: [15, 6], every: [1.25, 0.09, 0.62], size: [44, 6], sig: { name: 'Mauling', text: 'Foes are knocked sprawling', knock: 120 } }),
    spell({ id: 'spirit-stag', cls: 'druid', name: 'Spirit Beasts', text: 'A spirit of the wood runs beside you and gores the Host.', icon: 'stag_head_with_antlers_on_green', kind: 'pet', el: 'nature', sprite: 'blighted-stag', noun: 'Beasts', one: 'beast', color: '#c8ffb0', dmg: [20, 9], n: [1, 3], sig: { name: 'Gentle Herd', text: 'Your beasts heal you as they fight', leech: 0.3 } }),
    spell({ id: 'moonbeams', cls: 'druid', name: 'Moonbeams', text: 'Moonlight stabs down at the Host all around you.', icon: 'moonfire_beam_on_navy', kind: 'rain', el: 'water', noun: 'Moonbeams', one: 'beam', color: '#cfe0ff', dmg: [12, 4.5], every: [1.7, 0.12, 0.9], n: [3, 1], size: [15, 1], sig: { name: 'Moonstruck', text: 'What they touch stands dazed for a moment', stun: 0.4 }, evolve: { with: 'reach', name: 'Full Moon', text: 'The beams widen, and there are twice as many.', icon: 'crescent_moon_behind_clouds_on_navy', more: 4, size: 0.5 } }),
    spell({ id: 'living-roots', cls: 'druid', name: 'Living Roots', text: 'Roots rise where you stood, holding and crushing what crosses them.', icon: 'root_grab_from_the_ground_on_brown', kind: 'field', el: 'nature', noun: 'Roots', one: 'root', color: '#7ad65a', dmg: [13, 7], every: [3, 0.28, 1.4], size: [24, 4], slow: true, sig: { name: 'Stranglehold', text: 'Roots hold what crosses them fast', stun: 0.7 } }),
    spell({ id: 'verdant-pulse', cls: 'druid', name: 'Verdant Pulse', text: 'Life wells up in you every so often and closes your wounds.', icon: 'rejuvenate_leaf_drop_on_green', kind: 'pulse', el: 'nature', noun: 'Pulse', one: 'pulse', color: '#b8ffb8', dmg: [0, 0], every: [7, 0.5, 3.6], heal: [7, 1.5], sig: { name: 'Bloom', text: 'It also bursts outward and burns what is near', burst: 60 } }),
  ],
};

const ADJECTIVE: Record<Element, string> = { fire: 'Searing', ice: 'Bitter', lightning: 'Crackling', arcane: 'Arcane', nature: 'Wild', poison: 'Venomous', holy: 'Radiant', shadow: 'Cursed', water: 'Surging', blood: 'Savage' };

const cap = (s: string): string => `${s[0]!.toUpperCase()}${s.slice(1)}`;

const TEMPLATES: Record<SpellKind, (d: SpellDef) => Omit<Upgrade, 'id'>[]> = {
  bolt: (d) => [
    { name: `Twin ${d.noun}`, text: `One more ${d.one} with each cast`, more: 1 },
    { name: `${ADJECTIVE[d.el]} ${d.noun}`, text: 'Hit 35% harder', dmg: 0.35 },
    { name: `Hungry ${d.noun}`, text: 'They curve after their target', homing: true },
    { name: `Bouncing ${d.noun}`, text: 'Each goes on to hit a second foe', bounce: 1 },
    { name: `Bursting ${d.noun}`, text: 'They explode where they land', burst: 20 },
    { name: `Rapid ${d.noun}`, text: 'Cast 20% faster', every: -0.2 },
  ],
  nova: (d) => [
    { name: `Wider ${d.noun}`, text: '+30% size', size: 0.3 },
    { name: `${ADJECTIVE[d.el]} ${d.noun}`, text: 'Hit 35% harder', dmg: 0.35 },
    { name: `Quick ${d.noun}`, text: 'Comes 20% more often', every: -0.2 },
    { name: 'Shockwave', text: 'Throws foes back', knock: 110 },
    { name: 'Aftershock', text: 'A second wave follows a moment later', echo: true },
  ],
  chain: (d) => [
    { name: `Longer ${d.noun}`, text: 'Two more leaps', more: 2 },
    { name: `${ADJECTIVE[d.el]} ${d.noun}`, text: 'Hit 35% harder', dmg: 0.35 },
    { name: `Quick ${d.noun}`, text: 'Comes 20% more often', every: -0.2 },
    { name: 'Forked', text: 'A second one follows a moment later', echo: true },
    { name: 'Stunning Current', text: 'What it touches stops for a moment', stun: 0.4 },
  ],
  orbit: (d) => [
    { name: `Another ${cap(d.one)}`, text: `One more ${d.one} circling you`, more: 1 },
    { name: `Whirling ${d.noun}`, text: 'They go round 35% faster', speed: 0.35 },
    { name: `Great ${d.noun}`, text: '+35% size', size: 0.35 },
    { name: `${ADJECTIVE[d.el]} ${d.noun}`, text: 'Hit 35% harder', dmg: 0.35 },
    { name: `Heavy ${d.noun}`, text: 'They throw back what they hit', knock: 70 },
  ],
  strike: (d) => [
    { name: `Great ${d.noun}`, text: '+30% size', size: 0.3 },
    { name: `${ADJECTIVE[d.el]} ${d.noun}`, text: 'Hit 35% harder', dmg: 0.35 },
    { name: `Quick ${d.noun}`, text: 'Comes 20% more often', every: -0.2 },
    { name: `Twin ${d.noun}`, text: 'A second one falls elsewhere', more: 1 },
    { name: `Heavy ${d.noun}`, text: 'Throws everything nearby back', knock: 110 },
  ],
  field: (d) => [
    { name: `Wide ${d.noun}`, text: '+30% size', size: 0.3 },
    { name: `${ADJECTIVE[d.el]} ${d.noun}`, text: 'Hit 35% harder', dmg: 0.35 },
    { name: `Lasting ${d.noun}`, text: 'Stays 2 seconds longer', last: 2 },
    { name: `Quick ${d.noun}`, text: 'Comes 20% more often', every: -0.2 },
    { name: `Drawing ${d.noun}`, text: 'Pulls foes into the middle', pull: true },
  ],
  cone: (d) => [
    { name: `Wide ${d.noun}`, text: '+25% reach', size: 0.25 },
    { name: `${ADJECTIVE[d.el]} ${d.noun}`, text: 'Hit 35% harder', dmg: 0.35 },
    { name: `Quick ${d.noun}`, text: 'Comes 20% more often', every: -0.2 },
    { name: 'Both Ways', text: 'Cuts all the way around you', more: 1 },
    { name: `Heavy ${d.noun}`, text: 'Throws what it hits back', knock: 100 },
  ],
  lance: (d) => [
    { name: `Broad ${d.noun}`, text: '+40% width', size: 0.4 },
    { name: `${ADJECTIVE[d.el]} ${d.noun}`, text: 'Hit 35% harder', dmg: 0.35 },
    { name: `Quick ${d.noun}`, text: 'Comes 20% more often', every: -0.2 },
    { name: `Twin ${d.noun}`, text: 'A second one, the other way', more: 1 },
    { name: 'Numbing Touch', text: 'Slows everything it passes through', slow: true },
  ],
  rain: (d) => [
    { name: `Heavy ${d.noun}`, text: 'Two more each time', more: 2 },
    { name: `Wide ${d.noun}`, text: '+30% size', size: 0.3 },
    { name: `${ADJECTIVE[d.el]} ${d.noun}`, text: 'Hit 35% harder', dmg: 0.35 },
    { name: `Quick ${d.noun}`, text: 'Comes 20% more often', every: -0.2 },
    { name: `Bursting ${d.noun}`, text: 'Each explodes where it lands', burst: 16 },
  ],
  pet: (d) => [
    { name: `Another ${cap(d.one)}`, text: `One more ${d.one} at your side`, more: 1 },
    { name: `${ADJECTIVE[d.el]} ${d.noun}`, text: 'Bite 40% harder', dmg: 0.4 },
    { name: `Swift ${d.noun}`, text: 'Run 35% faster', speed: 0.35 },
    { name: `Heavy ${d.noun}`, text: 'They throw back what they hit', knock: 60 },
  ],
  aura: (d) => [
    { name: `Wide ${d.noun}`, text: '+25% reach', size: 0.25 },
    { name: `${ADJECTIVE[d.el]} ${d.noun}`, text: 'Hit 40% harder', dmg: 0.4 },
    { name: `Thirsty ${d.noun}`, text: 'What it burns heals you a little', leech: 0.3 },
    { name: `Numbing ${d.noun}`, text: 'Slows whatever it touches', slow: true },
  ],
  pulse: (d) => [
    { name: `Deep ${d.noun}`, text: 'Heals 40% more', dmg: 0.4 },
    { name: `Quick ${d.noun}`, text: 'Comes 20% more often', every: -0.2 },
    { name: `Blazing ${d.noun}`, text: 'Burns what is near you when it comes', burst: 50 },
  ],
  boomerang: (d) => [
    { name: `Another ${cap(d.one)}`, text: `One more ${d.one} with each throw`, more: 1 },
    { name: `${ADJECTIVE[d.el]} ${d.noun}`, text: 'Hit 35% harder', dmg: 0.35 },
    { name: `Great ${d.noun}`, text: '+35% size', size: 0.35 },
    { name: `Quick ${d.noun}`, text: 'Thrown 20% more often', every: -0.2 },
    { name: `Bursting ${d.noun}`, text: 'They explode on whatever they hit', burst: 16 },
  ],
};

const upgradeMemo = new Map<string, Upgrade[]>();
/** The upgrades a spell can be given: the ones its kind has, and its own. */
export function upgradesOf(def: SpellDef): Upgrade[] {
  const hit = upgradeMemo.get(def.id);
  if (hit) return hit;
  const list = [...TEMPLATES[def.kind](def), def.sig].map((u, i) => ({ ...u, id: `${def.id}:${i}` }));
  upgradeMemo.set(def.id, list);
  return list;
}

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

export const STRENGTHS: Record<StrengthId, { id: StrengthId; name: string; text: string; icon: string; max?: number }> = {
  might: { id: 'might', name: 'Might', text: '+15% damage', icon: 'strength_up_status_flexed_arm_on_red' },
  haste: { id: 'haste', name: 'Haste', text: 'Spells come 10% faster', icon: 'lightning_hourglass_on_violet' },
  reach: { id: 'reach', name: 'Reach', text: '+12% spell size', icon: 'shock_wave_ring_on_navy' },
  swift: { id: 'swift', name: 'Swift Feet', text: '+8% move speed', icon: 'haste_status_winged_boot_on_teal' },
  vigor: { id: 'vigor', name: 'Vigor', text: '+20% health', icon: 'toughness_heart_mastery_on_red' },
  mend: { id: 'mend', name: 'Mending', text: 'Regain 1 health a second', icon: 'regeneration_status_green_leaf_on_green' },
  magnet: { id: 'magnet', name: 'Lodestone', text: 'Pick up sparks from farther away', icon: 'magnetized_status_magnet_on_red' },
  fortune: { id: 'fortune', name: 'Fortune', text: '+10% experience', icon: 'exp_up_status_book_with_arrow_on_gold' },
  fang: { id: 'fang', name: 'Vampire Fang', text: 'Every kill heals you a little', icon: 'venom_fang_on_black' },
  keg: { id: 'keg', name: 'Powder Keg', text: '8% of foes blow up when they die', icon: 'ice_bomb_on_cyan' },
  thorns: { id: 'thorns', name: 'Thorn Mail', text: 'What touches you takes 40 damage', icon: 'thorn_burst_on_dark_green' },
  coin: { id: 'coin', name: 'Lucky Coin', text: '+8% critical hits', icon: 'crit_up_status_star_burst_on_gold' },
  ghost: { id: 'ghost', name: 'Ghost Step', text: 'Dash 25% sooner, and it burns what you pass through', icon: 'evasion_up_status_feather_on_white' },
  wind: { id: 'wind', name: 'Second Wind', text: 'Once a run, get back up with half your health', icon: 'golden_heart_with_white_wings_on_gold', max: 1 },
  glass: { id: 'glass', name: 'Glass Cannon', text: '+40% damage, but 25% less health', icon: 'armour_broken_status_cracked_shield_on_grey', max: 1 },
  drum: { id: 'drum', name: 'War Drum', text: 'Frenzy fills 25% faster', icon: 'war_banner_on_a_pole_with_a_red_pattern_on_red' },
};
export const REST_ICON = 'regeneration_status_green_leaf_on_green';
/** The pickups' and the dash's pictures. */
export const FIELD_ICONS = { dash: 'haste_status_winged_boot_on_teal', meat: 'heart_with_green_gold_sparkles_on_gold', magnet: 'magnetized_status_magnet_on_red', bomb: 'ice_bomb_on_cyan', frenzy: 'strength_up_status_flexed_arm_on_red', chest: 'crit_up_status_star_burst_on_gold' } as const;

/** Every icon The Vigil shows, for the icon build. */
export const vigilIcons = (): string[] => [REST_ICON, ...Object.values(FIELD_ICONS), ...Object.values(STRENGTHS).map((s) => s.icon), ...ALL_SPELLS.flatMap((s) => (s.evolve ? [s.icon, s.evolve.icon] : [s.icon]))];

/** How a wave's foes behave. */
export type FoeAi = 'walk' | 'rush' | 'shoot' | 'charge';

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
  ai: FoeAi;
}

const WAVES: Omit<FoeDef, 'sprite'>[] = [
  { hp: 12, dmg: 6, speed: 46, r: 6, xp: 1, from: 0, to: 150, weight: 5, ai: 'walk' },
  { hp: 22, dmg: 7, speed: 40, r: 7, xp: 1, from: 30, to: 240, weight: 3, ai: 'walk' },
  { hp: 18, dmg: 8, speed: 82, r: 6, xp: 1, from: 60, to: 360, weight: 3, ai: 'rush' },
  { hp: 46, dmg: 10, speed: 50, r: 7, xp: 2, from: 90, to: 520, weight: 3, ai: 'shoot' },
  { hp: 110, dmg: 14, speed: 60, r: 9, xp: 4, from: 170, to: 700, weight: 2, ai: 'charge' },
  { hp: 130, dmg: 16, speed: 66, r: 7, xp: 4, from: 300, to: 900, weight: 4, ai: 'walk' },
  { hp: 320, dmg: 22, speed: 52, r: 9, xp: 8, from: 460, to: 99999, weight: 3, ai: 'shoot' },
  { hp: 620, dmg: 30, speed: 56, r: 10, xp: 14, from: 640, to: 99999, weight: 3, ai: 'charge' },
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

/** The champion at each of these times: bigger, slower, and its fall leaves a chest. */
export const BOSS_EVERY = 150;

/**
 * A party's night is harder the more of them there are: more foes, each tougher and hitting harder. It has to be a lot
 * harder, since four heroes each level up with every level the party earns and get each other back on their feet.
 */
export interface PartyScale {
  /** × how many foes come. */
  count: number;
  /** × each foe's health. */
  hp: number;
  /** × what each foe's blow does. */
  dmg: number;
  /** × a champion's health, on top of that. */
  boss: number;
  /** × experience. */
  xp: number;
}
export const partyScale = (players: number): PartyScale => {
  const extra = Math.max(0, Math.min(3, players - 1));
  return { count: 1 + extra * 0.7, hp: 1 + extra * 0.8, dmg: 1 + extra * 0.2, boss: 1 + extra * 0.3, xp: 1 };
};
