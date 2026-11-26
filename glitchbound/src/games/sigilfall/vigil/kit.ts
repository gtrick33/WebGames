import type { ClassId, RegionId } from '../data/types';

/**
 * Sigilfall: The Vigil's spells and strengths. Hold the line against the Ashen Host as long as you can. Each spell
 * fires by itself; the player's choices are where to stand and what to take when they level up. Every class brings
 * six of its own spells from the campaign (the same names and pictures: a mage's Fireball and Meteor, a warrior's
 * Cleave and Whirlwind), each made to fire by itself in one of the kinds sim.ts knows; their numbers are the Vigil's
 * own, so a hero's level in the story changes nothing here. Every level of a spell
 * is a choice between upgrades that change how that spell plays, and some spells evolve at the top. Plain data with no
 * imports but types, so the icon build script can read it.
 */

/**
 * How a spell goes off. Beside the kinds that fire by themselves at what is near: a `mine` is thrown down and waits to
 * be stepped on, a `totem` is planted and shoots from where it stands, a `dash` spell goes off where the hero's dash
 * ends (the one kind the player sets off), a `sweep` is a beam that goes all the way round, and a `ward` is a shield
 * that takes blows and bursts when it breaks.
 */
export type SpellKind = 'bolt' | 'nova' | 'chain' | 'orbit' | 'strike' | 'field' | 'cone' | 'lance' | 'rain' | 'pet' | 'aura' | 'pulse' | 'boomerang' | 'mine' | 'totem' | 'dash' | 'sweep' | 'ward';
export type StrengthId = 'might' | 'haste' | 'reach' | 'swift' | 'vigor' | 'mend' | 'magnet' | 'fortune' | 'fang' | 'keg' | 'thorns' | 'coin' | 'ghost' | 'wind' | 'glass' | 'drum' | 'craft' | 'stout';
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
  /** Stops what it touches for this many seconds, draws it in, or feeds its caster, from the first level. */
  stun?: number;
  pull?: boolean;
  leech?: number;
  /** A bolt that is a slow heavy ball rolling through everything. */
  orb?: boolean;
  /** Ground laid out where the Host is thickest, not underfoot. */
  far?: boolean;
  /** Share of the hero's health it gives back when it fires (or, for a ward, holds). */
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
    spell({ id: 'ember-bolt', cls: 'mage', name: 'Fireball', text: 'Flings a seeking fireball at the nearest foe.', icon: 'fireball_with_a_flame_tail_on_red', kind: 'bolt', el: 'fire', noun: 'Fireballs', one: 'fireball', color: '#ff7a1e', dmg: [13, 5], every: [1.05, 0.09, 0.42], n: [1, 3], sig: { name: 'Cinder Wake', text: 'Fireballs leave burning ground where they land', trail: true }, evolve: { with: 'haste', name: 'Phoenix Bolt', text: 'Fireballs pierce everything and burst where they land.', icon: 'fire_bird_spreading_wings_on_red', dmg: 0.5, more: 2, pierce: 99, burst: 22 } }),
    spell({ id: 'frost-ring', cls: 'mage', name: 'Rime Burst', text: 'A burst of cold rolls out from you and slows what it touches.', icon: 'ice_explosion_burst_on_cyan', kind: 'nova', el: 'ice', noun: 'Rime Burst', one: 'burst', color: '#9fdcff', dmg: [12, 5], every: [4.2, 0.4, 1.8], size: [46, 9], slow: true, sig: { name: 'Deep Winter', text: 'Foes it touches are stopped dead for a moment', stun: 0.7 }, evolve: { with: 'reach', name: 'Absolute Zero', text: 'The burst freezes everything it touches solid.', icon: 'frozen_block_with_a_shape_inside_on_blue', size: 0.3, freeze: true } }),
    spell({ id: 'chain-spark', cls: 'mage', name: 'Chain Lightning', text: 'Lightning leaps from foe to foe.', icon: 'lightning_chain_on_navy', kind: 'chain', el: 'lightning', noun: 'Lightning', one: 'leap', color: '#dff2ff', dmg: [14, 6], every: [1.9, 0.2, 0.8], n: [3, 1], sig: { name: 'Overcharge', text: 'Each leap has a 25% chance to crit', crit: 0.25 } }),
    spell({ id: 'orbit-motes', cls: 'mage', name: 'Arcane Bolts', text: 'Arcane bolts circle you and burn what they pass through.', icon: 'dark_orb_on_violet', kind: 'orbit', el: 'arcane', noun: 'Bolts', one: 'bolt', color: '#b48cff', dmg: [26, 10], n: [2, 2], sig: { name: 'Mana Drinkers', text: 'Bolts feed a little of what they burn back to you', leech: 0.6 } }),
    spell({ id: 'meteor', cls: 'mage', name: 'Meteor', text: 'A meteor falls where the Host is thickest.', icon: 'meteor_falling_with_flames_on_orange', kind: 'strike', el: 'fire', look: 'star', noun: 'Meteors', one: 'meteor', color: '#ffb45c', dmg: [42, 18], every: [5.2, 0.5, 2.2], size: [34, 6], sig: { name: 'Crater', text: 'Leaves a pool of burning ground where it hits', trail: true } }),
    spell({ id: 'ash-field', cls: 'mage', name: 'Flame Pillar', text: 'Leaves a pillar of flame burning where you stand.', icon: 'fire_pillar_from_the_ground_on_red', kind: 'field', el: 'fire', noun: 'Pillars', one: 'pillar', color: '#ff6a2a', dmg: [12, 7], every: [3, 0.28, 1.4], size: [22, 4], sig: { name: 'Fire Walker', text: 'Pillars come far more often', every: -0.3 } }),
    spell({ id: 'ice-javelin', cls: 'mage', name: 'Ice Javelin', text: 'A javelin of ice through everything in a line, slowing what it passes.', icon: 'ice_spear_on_cyan', kind: 'lance', el: 'ice', noun: 'Javelins', one: 'javelin', color: '#bfefff', dmg: [18, 7], every: [1.5, 0.12, 0.7], size: [9, 1], slow: true, sig: { name: 'Shatterpoint', text: 'A 30% chance to crit', crit: 0.3 }, evolve: { with: 'reach', name: 'Glacierfall', text: 'The javelin is a wall of ice that freezes the whole line solid.', icon: 'giant_ice_crystal_comet_on_navy', size: 1.2, dmg: 0.4, freeze: true } }),
    spell({ id: 'ball-lightning', cls: 'mage', name: 'Ball Lightning', text: 'A slow ball of lightning rolls out through the whole crowd.', icon: 'lightning_orb_on_navy', kind: 'bolt', orb: true, el: 'lightning', noun: 'Balls', one: 'ball', color: '#a8e0ff', dmg: [15, 6], every: [2.8, 0.22, 1.3], n: [1, 3], sig: { name: 'Live Wire', text: 'What it rolls through stops for a moment', stun: 0.5 }, evolve: { with: 'haste', name: 'Thunderhead', text: 'Three more balls, each bursting on everything it touches.', icon: 'giant_thunderstorm_over_a_mountain_on_navy', more: 3, burst: 20, dmg: 0.3 } }),
    spell({ id: 'arcane-ward', cls: 'mage', name: 'Arcane Ward', text: 'A ward of arcana takes the blows meant for you, and bursts when it breaks.', icon: 'lightning_dome_on_violet', kind: 'ward', el: 'arcane', noun: 'Ward', one: 'ward', color: '#c58cff', dmg: [28, 11], every: [13, 0.6, 9], size: [46, 5], heal: [12, 1.6], sig: { name: 'Backlash', text: 'Breaking, it throws everything far back', knock: 160 } }),
    spell({ id: 'gravity-well', cls: 'mage', name: 'Gravity Well', text: 'Opens a well where the Host is thickest that drags them to its middle.', icon: 'storm_eye_spiral_on_violet', kind: 'field', far: true, pull: true, el: 'arcane', noun: 'Wells', one: 'well', color: '#a05aff', dmg: [9, 5], every: [4.6, 0.36, 2.2], size: [30, 4], sig: { name: 'Crushing Depth', text: 'What it holds is slowed as well', slow: true } }),
  ],
  warrior: [
    spell({ id: 'reaping-arc', cls: 'warrior', name: 'Cleave', text: 'A great swing through everything in front of you.', icon: 'great_axe_with_a_bright_red_edge_on_red', kind: 'cone', el: 'blood', noun: 'Cleave', one: 'swing', color: '#f2ece0', dmg: [15, 6], every: [1.15, 0.08, 0.6], size: [46, 6], sig: { name: 'Bloodletter', text: 'Every foe cut heals you a little', leech: 0.5 }, evolve: { with: 'might', name: 'The Headsman', text: 'The swing reaches much farther and hits twice as hard.', icon: 'giant_sword_falling_from_the_sky_on_red', dmg: 1, size: 0.6 } }),
    spell({ id: 'thrown-axe', cls: 'warrior', name: 'Hookchain', text: 'A hooked axe on a chain flies out through the Host and tears back to you.', icon: 'chain_with_a_hook_pulling_on_grey', kind: 'boomerang', el: 'blood', weapon: 'axe', noun: 'Hooks', one: 'hook', color: '#d8dce6', dmg: [13, 5], every: [1.8, 0.14, 0.9], n: [1, 3], size: [6, 0.5], sig: { name: 'Stumbling Blow', text: 'Whatever the hook hits staggers to a stop', stun: 0.35 }, evolve: { with: 'haste', name: 'Storm of Axes', text: 'A ring of hooked axes spins out in every direction.', icon: 'crossed_sword_and_axe_on_red', more: 3, dmg: 0.25 } }),
    spell({ id: 'war-stomp', cls: 'warrior', name: 'Thunder Stomp', text: 'You stomp, and the ground throws back what stands near.', icon: 'stomping_boot_with_a_quake_ring_on_brown', kind: 'nova', el: 'blood', noun: 'Stomp', one: 'stomp', color: '#d8a860', dmg: [12, 5], every: [3.8, 0.34, 1.7], size: [48, 8], slow: true, sig: { name: 'Quake', text: 'Foes are thrown far back', knock: 150 } }),
    spell({ id: 'steel-tempest', cls: 'warrior', name: 'Whirlwind', text: 'Blades whirl around you, cutting whatever comes close.', icon: 'whirlwind_spin_of_three_blade_arcs_on_red', kind: 'aura', el: 'blood', noun: 'Whirlwind', one: 'blade', color: '#e8e8f4', dmg: [24, 9], size: [28, 5], sig: { name: 'Eye of the Storm', text: 'What it cuts is thrown clear of you', knock: 50 } }),
    spell({ id: 'giants-blade', cls: 'warrior', name: 'Earthsplitter', text: 'A sword of old iron falls and splits the earth where the Host is thickest.', icon: 'ground_slam_crack_with_flying_rocks_on_brown', kind: 'strike', el: 'blood', look: 'blade', noun: 'Blades', one: 'blade', color: '#c8d0e0', dmg: [46, 18], every: [5.2, 0.5, 2.2], size: [32, 6], sig: { name: 'Shockblade', text: 'A second sword follows the first', echo: true } }),
    spell({ id: 'blood-banner', cls: 'warrior', name: 'Challenge', text: 'Plants your banner and calls the Host to it: the ground around it bleeds them.', icon: 'taunt_pointing_gauntlet_with_a_red_mark_on_red', kind: 'field', el: 'blood', noun: 'Banners', one: 'banner', color: '#c8324a', dmg: [14, 7], every: [3.2, 0.3, 1.5], size: [24, 4], sig: { name: 'Rally', text: 'What bleeds there heals you', leech: 0.3 } }),
    spell({ id: 'war-charge', cls: 'warrior', name: 'Charge', text: 'Your dash is a charge: it tramples what stands where it ends.', icon: 'charging_bull_head_in_steel_on_red', kind: 'dash', el: 'blood', noun: 'Charge', one: 'charge', color: '#e8c8a0', dmg: [38, 15], size: [34, 5], sig: { name: 'Unstoppable', text: 'Nothing can touch you for a moment after it', guard: 0.8 } }),
    spell({ id: 'shield-wall', cls: 'warrior', name: 'Shield Wall', text: 'A wall of shields takes the blows meant for you, and bursts when it breaks.', icon: 'tower_shield_wall_of_three_shields_on_blue', kind: 'ward', el: 'blood', noun: 'Wall', one: 'wall', color: '#9ab8e8', dmg: [30, 12], every: [13, 0.6, 9], size: [46, 5], heal: [14, 1.6], sig: { name: 'Shield Slam', text: 'Breaking, it stops everything near for a moment', stun: 1 }, evolve: { with: 'stout', name: 'Iron Legion', text: 'The wall holds half again as much and comes back far sooner.', icon: 'shield_mastery_crest_on_blue', dmg: 0.5, every: -0.35 } }),
    spell({ id: 'ground-breaker', cls: 'warrior', name: 'Ground Breaker', text: 'A crack runs through the ground and everything standing along it.', icon: 'leaping_knight_silhouette_with_a_ground_crack_on_red', kind: 'lance', el: 'blood', noun: 'Cracks', one: 'crack', color: '#d8a860', dmg: [18, 7], every: [1.6, 0.13, 0.75], size: [11, 1], sig: { name: 'Fault Line', text: 'What stands along it is stopped for a moment', stun: 0.5 } }),
    spell({ id: 'thousand-cuts', cls: 'warrior', name: 'Thousand Cuts', text: 'Your blade goes all the way round you in one long cut.', icon: 'chain_of_three_slash_marks_on_red', kind: 'sweep', el: 'blood', noun: 'Cuts', one: 'cut', color: '#ffb0a0', dmg: [21, 8], every: [3.2, 0.25, 1.6], size: [66, 7], sig: { name: 'Bleed Out', text: 'Every foe cut heals you a little', leech: 0.4 }, evolve: { with: 'haste', name: 'Red Tempest', text: 'A blade each way, and they cut half again as hard.', icon: 'berserker_face_mask_with_red_eyes_on_black', more: 1, dmg: 0.5 } }),
  ],
  ranger: [
    spell({ id: 'seeking-arrow', cls: 'ranger', name: 'Multishot', text: 'Looses arrows at the nearest of the Host.', icon: 'three_arrows_fanned_on_green', kind: 'bolt', el: 'nature', noun: 'Arrows', one: 'arrow', color: '#d8ffb0', dmg: [10, 4], every: [0.82, 0.07, 0.34], n: [1, 3], pierce: 1, sig: { name: 'Called Shot', text: 'Arrows have a 25% chance to crit', crit: 0.25 }, evolve: { with: 'haste', name: 'Ceaseless Volley', text: 'Arrows pour out and pass through everything.', icon: 'rapid_fire_arrows_on_green', more: 3, pierce: 99 } }),
    spell({ id: 'arrow-storm', cls: 'ranger', name: 'Rain of Arrows', text: 'Arrows rain down on the Host all around you.', icon: 'rain_of_arrows_from_the_sky_on_brown', kind: 'rain', el: 'nature', noun: 'Arrows', one: 'arrow', color: '#e8e0a8', dmg: [11, 4], every: [1.7, 0.12, 0.9], n: [3, 1], size: [14, 1], sig: { name: 'Pinning Shots', text: 'What they hit is stopped for a moment', stun: 0.4 } }),
    spell({ id: 'wolf-pack', cls: 'ranger', name: 'Call Wolf', text: 'A wolf runs at your side and tears at the Host.', icon: 'wolf_howl_on_navy', kind: 'pet', el: 'nature', sprite: 'wolf', noun: 'Wolves', one: 'wolf', color: '#c8c8d8', dmg: [20, 9], n: [1, 3], sig: { name: 'Hunting Howl', text: 'Wolves run a third faster', speed: 0.34 }, evolve: { with: 'might', name: 'Alpha’s Howl', text: 'The pack doubles, and bites twice as hard.', icon: 'wolf_howl_on_navy', more: 2, dmg: 0.8 } }),
    spell({ id: 'snapjaw', cls: 'ranger', name: 'Bear Trap', text: 'Drops iron jaws where you walk: what steps in bleeds.', icon: 'hunter_trap_with_jaws_on_brown', kind: 'field', el: 'nature', noun: 'Traps', one: 'trap', color: '#9a8a68', dmg: [15, 7], every: [2.8, 0.26, 1.3], size: [20, 3.5], slow: true, sig: { name: 'Iron Grip', text: 'Traps hold what steps in them fast', stun: 0.8 } }),
    spell({ id: 'long-shot', cls: 'ranger', name: 'Long Draw', text: 'A heavy arrow that flies through a whole line of them.', icon: 'bow_drawn_on_brown', kind: 'lance', el: 'nature', noun: 'Long Draws', one: 'shot', color: '#f6f2c8', dmg: [20, 8], every: [1.9, 0.16, 0.95], size: [10, 1], sig: { name: 'Clean Through', text: 'A 30% chance to crit', crit: 0.3 } }),
    spell({ id: 'hawk-wheel', cls: 'ranger', name: 'Hawk Call', text: 'Hawks circle you and strike what passes under them.', icon: 'hawk_companion_diving_on_teal', kind: 'orbit', el: 'lightning', noun: 'Hawks', one: 'hawk', color: '#ffe39a', dmg: [24, 9], n: [2, 2], sig: { name: 'Talons', text: 'Their strike throws foes back', knock: 90 } }),
    spell({ id: 'poison-trap', cls: 'ranger', name: 'Poison Trap', text: 'Throws down a trap that bursts in a poison cloud when something steps on it.', icon: 'poison_cloud_on_green', kind: 'mine', el: 'poison', noun: 'Traps', one: 'trap', color: '#9ae85a', dmg: [30, 12], every: [2.6, 0.2, 1.3], n: [1, 3], size: [26, 3], sig: { name: 'Lingering Cloud', text: 'The cloud stays where it burst', trail: true }, evolve: { with: 'craft', name: 'Horn of the Hunt', text: 'Three more traps each time, and they burst far wider.', icon: 'stag_head_with_antlers_on_green', more: 3, size: 0.4 } }),
    spell({ id: 'tumble', cls: 'ranger', name: 'Tumble', text: 'Your dash is a tumble: arrows burst from where you come up.', icon: 'dodge_roll_arrow_on_teal', kind: 'dash', el: 'nature', noun: 'Tumble', one: 'tumble', color: '#d8ffb0', dmg: [34, 14], size: [36, 5], sig: { name: 'Caltrops', text: 'What it hits is stopped for a moment', stun: 0.7 } }),
    spell({ id: 'viper-arrow', cls: 'ranger', name: 'Viper Arrow', text: 'A venomed arrow whose poison leaps from foe to foe.', icon: 'poison_arrow_with_green_drip_on_green', kind: 'chain', el: 'poison', noun: 'Vipers', one: 'leap', color: '#b8f06a', dmg: [13, 5.5], every: [1.9, 0.2, 0.8], n: [3, 1], slow: true, sig: { name: 'Neurotoxin', text: 'Each leap has a 25% chance to crit', crit: 0.25 } }),
    spell({ id: 'blast-arrow', cls: 'ranger', name: 'Blast Arrow', text: 'An arrow with a charge on it comes down where the Host is thickest.', icon: 'exploding_arrow_on_brown', kind: 'strike', el: 'fire', look: 'star', noun: 'Blast Arrows', one: 'arrow', color: '#ffb45c', dmg: [40, 16], every: [4.8, 0.45, 2], size: [30, 6], sig: { name: 'Scorched Earth', text: 'Leaves the ground burning where it lands', trail: true }, evolve: { with: 'might', name: 'Quarry’s End', text: 'Two more arrows, and each hits half again as hard.', icon: 'legendary_golden_bow_on_gold', more: 2, dmg: 0.5 } }),
  ],
  priest: [
    spell({ id: 'lance-of-dawn', cls: 'priest', name: 'Atoning Light', text: 'A lance of light through everything in its way.', icon: 'beam_of_light_from_the_sky_on_gold', kind: 'lance', el: 'holy', noun: 'Lances', one: 'lance', color: '#fff0a8', dmg: [17, 7], every: [1.35, 0.12, 0.62], size: [10, 1], sig: { name: 'Blessed Spear', text: 'Each foe it pierces heals you a little', leech: 0.3 }, evolve: { with: 'reach', name: 'Noonday', text: 'The lance widens into a beam that burns the whole line.', icon: 'beam_of_light_from_the_sky_on_gold', size: 1.4, dmg: 0.6 } }),
    spell({ id: 'radiant-wave', cls: 'priest', name: 'Radiant Burst', text: 'A burst of light rolls out from you and mends you a little.', icon: 'radiant_star_burst_on_gold', kind: 'nova', el: 'holy', noun: 'Burst', one: 'burst', color: '#ffe9a0', dmg: [10, 4], every: [3.9, 0.36, 1.8], size: [48, 9], heal: [1, 0.3], sig: { name: 'Blinding Light', text: 'Foes it touches stand stunned for a moment', stun: 0.6 } }),
    spell({ id: 'mending-light', cls: 'priest', name: 'Renew', text: 'Every so often light knits your wounds closed.', icon: 'heal_over_time_status_green_sparkle_on_green', kind: 'pulse', el: 'holy', noun: 'Renewal', one: 'mending', color: '#b8ffb8', dmg: [0, 0], every: [7, 0.5, 3.5], heal: [7, 1.5], sig: { name: 'Guarded Prayer', text: 'Nothing can touch you for a moment when it comes', guard: 1.4 }, evolve: { with: 'vigor', name: 'Second Dawn', text: 'The light also burns everything near you when it comes.', icon: 'sunrise_over_a_hill_on_gold', burst: 70 } }),
    spell({ id: 'halo-ring', cls: 'priest', name: 'Halo', text: 'Rings of light circle you, burning what they touch.', icon: 'golden_halo_ring_over_a_helmet_on_gold', kind: 'orbit', el: 'holy', noun: 'Halos', one: 'halo', color: '#fff2b0', dmg: [25, 10], n: [2, 2], sig: { name: 'Purity', text: 'Halos slow whatever they touch', slow: true } }),
    spell({ id: 'sunfall', cls: 'priest', name: 'Smite', text: 'Light falls from above where the Host is thickest.', icon: 'golden_spear_of_light_on_gold', kind: 'strike', el: 'holy', look: 'column', noun: 'Smites', one: 'smite', color: '#fff0a8', dmg: [42, 17], every: [5, 0.48, 2.1], size: [34, 6], sig: { name: 'Judgment Day', text: 'A second column follows the first', echo: true } }),
    spell({ id: 'hallowed-ground', cls: 'priest', name: 'Sanctuary', text: 'Holy ground under your feet burns all that isn’t you.', icon: 'light_pillar_on_a_round_altar_on_gold', kind: 'field', el: 'holy', noun: 'Earth', one: 'circle', color: '#ffe48a', dmg: [12, 7], every: [3, 0.28, 1.4], size: [24, 4], sig: { name: 'Pilgrim’s Rest', text: 'What burns there mends you', leech: 0.3 } }),
    spell({ id: 'ward-of-grace', cls: 'priest', name: 'Ward of Grace', text: 'A ward of light takes the blows meant for you, and bursts when it breaks.', icon: 'white_light_shield_bubble_on_gold', kind: 'ward', el: 'holy', noun: 'Ward', one: 'ward', color: '#fff6d8', dmg: [26, 10], every: [12.5, 0.6, 8.5], size: [46, 5], heal: [13, 1.6], sig: { name: 'Grace Under Fire', text: 'Nothing can touch you for a moment when it breaks', guard: 1.2 } }),
    spell({ id: 'searing-hymn', cls: 'priest', name: 'Searing Hymn', text: 'Plants a white flame where you stand: it stays, and sears whatever comes near.', icon: 'white_flame_on_a_candle_on_gold', kind: 'totem', el: 'holy', noun: 'Flames', one: 'flame', color: '#fff0c8', dmg: [9, 4], every: [7, 0.4, 4], n: [1, 4], sig: { name: 'Choir', text: 'Its fire passes through two more', pierce: 2 }, evolve: { with: 'craft', name: 'Vigil Candles', text: 'Two more flames each time, and they sear faster.', icon: 'light_pillar_on_a_round_altar_on_gold', more: 2, speed: 0.5 } }),
    spell({ id: 'thought-lash', cls: 'priest', name: 'Thought Lash', text: 'A lash of shadow seeks the nearest foe.', icon: 'blackout_eye_on_violet', kind: 'bolt', el: 'shadow', noun: 'Lashes', one: 'lash', color: '#c88aff', dmg: [12, 4.5], every: [1.05, 0.09, 0.44], n: [1, 3], sig: { name: 'Frayed Thought', text: 'What it strikes is slowed', slow: true }, evolve: { with: 'haste', name: 'Night’s Maw', text: 'Lashes pass through everything and burst where they strike.', icon: 'dark_star_on_black', pierce: 99, burst: 22, dmg: 0.4 } }),
    spell({ id: 'seraph-lance', cls: 'priest', name: 'Seraph Lance', text: 'A lance of light turns all the way round you.', icon: 'light_angel_summon_on_gold', kind: 'sweep', el: 'holy', noun: 'Seraph Lances', one: 'lance', color: '#fff0a8', dmg: [19, 8], every: [3.2, 0.25, 1.6], size: [72, 7], sig: { name: 'Wings of Mercy', text: 'Every foe it crosses heals you a little', leech: 0.4 } }),
  ],
  paladin: [
    spell({ id: 'thrown-hammer', cls: 'paladin', name: 'Gavel of Dawn', text: 'A hammer of light flies out and comes back to your hand.', icon: 'hammer_of_light_with_golden_rays_on_gold', kind: 'boomerang', el: 'holy', weapon: 'hammer', noun: 'Hammers', one: 'hammer', color: '#ffe48a', dmg: [14, 5], every: [1.8, 0.14, 0.9], n: [1, 3], size: [7, 0.5], sig: { name: 'Thunderclap', text: 'Whatever the hammer hits is thrown back', knock: 110 }, evolve: { with: 'might', name: 'Twelve Hammers', text: 'Hammers wheel out in every direction and burst where they land.', icon: 'golden_armoured_fist_with_a_light_burst_on_gold', more: 3, burst: 18 } }),
    spell({ id: 'judging-light', cls: 'paladin', name: 'Sunbrand', text: 'The sun’s brand falls on the worst of them, from above.', icon: 'sword_planted_with_a_light_circle_on_gold', kind: 'strike', el: 'holy', look: 'column', noun: 'Brands', one: 'brand', color: '#fff0a8', dmg: [44, 17], every: [4.8, 0.45, 2], size: [30, 6], sig: { name: 'Final Word', text: 'A 35% chance to crit', crit: 0.35 } }),
    spell({ id: 'sun-ring', cls: 'paladin', name: 'Radiant Sweep', text: 'A storm of light sweeps around you, always.', icon: 'massive_light_explosion_with_rays_on_gold', kind: 'aura', el: 'fire', noun: 'Sweep', one: 'ring', color: '#ffc76a', dmg: [22, 9], size: [30, 5], sig: { name: 'Solar Flare', text: 'It pushes foes away from you', knock: 40 } }),
    spell({ id: 'blessed-ground', cls: 'paladin', name: 'Blessed Circle', text: 'The ground you stood on stays hallowed for a while.', icon: 'holy_ground_status_light_circle_on_gold', kind: 'field', el: 'holy', noun: 'Ground', one: 'circle', color: '#ffe9a0', dmg: [13, 7], every: [3, 0.28, 1.4], size: [24, 4], sig: { name: 'Hold the Line', text: 'What crosses it is stopped for a moment', stun: 0.5 } }),
    spell({ id: 'dawn-swing', cls: 'paladin', name: 'Oath Strike', text: 'A broad swing of light through what is in front of you.', icon: 'sword_and_shield_crossed_on_gold', kind: 'cone', el: 'holy', noun: 'Strike', one: 'swing', color: '#fff2b0', dmg: [15, 6], every: [1.25, 0.09, 0.65], size: [44, 6], sig: { name: 'Blinding Edge', text: 'Foes it cuts are slowed', slow: true }, evolve: { with: 'reach', name: 'Crescent of Dawn', text: 'The swing becomes a full circle of light.', icon: 'radiant_crown_of_light_on_gold', size: 0.3, dmg: 0.5, more: 1 } }),
    spell({ id: 'aegis-pulse', cls: 'paladin', name: 'Mending Vow', text: 'Every so often your oath closes your wounds.', icon: 'golden_heart_with_white_wings_on_gold', kind: 'pulse', el: 'holy', noun: 'Mending', one: 'mending', color: '#ffe48a', dmg: [0, 0], every: [7.5, 0.5, 3.8], heal: [8, 1.5], sig: { name: 'Shield of Faith', text: 'Nothing can touch you for a moment when it comes', guard: 1.6 } }),
    spell({ id: 'thrown-aegis', cls: 'paladin', name: 'Thrown Aegis', text: 'Your shield flies from foe to foe.', icon: 'golden_sun_shield_blocking_fire_on_gold', kind: 'chain', el: 'holy', noun: 'Aegis', one: 'bounce', color: '#ffe48a', dmg: [14, 6], every: [2, 0.2, 0.85], n: [3, 1], sig: { name: 'Ringing Blow', text: 'Whatever it strikes stops for a moment', stun: 0.5 } }),
    spell({ id: 'bulwark', cls: 'paladin', name: 'Bulwark', text: 'A bulwark of light takes the blows meant for you, and bursts when it breaks.', icon: 'shining_tower_shield_with_a_lion_on_gold', kind: 'ward', el: 'holy', noun: 'Bulwark', one: 'bulwark', color: '#fff0a8', dmg: [28, 11], every: [13, 0.6, 9], size: [46, 5], heal: [14, 1.6], sig: { name: 'Martyr’s Light', text: 'Nothing can touch you for a moment when it breaks', guard: 1.2 }, evolve: { with: 'stout', name: 'Rampart of Light', text: 'The bulwark holds half again as much and bursts far wider.', icon: 'holy_resist_status_sun_shield_on_gold', dmg: 0.5, size: 0.5 } }),
    spell({ id: 'lance-of-noon', cls: 'paladin', name: 'Lance of Noon', text: 'A lance of noon light through everything in its way.', icon: 'holy_sword_with_light_rays_on_gold', kind: 'lance', el: 'holy', noun: 'Lances', one: 'lance', color: '#fff2b0', dmg: [17, 7], every: [1.45, 0.12, 0.66], size: [10, 1], sig: { name: 'High Sun', text: 'A 30% chance to crit', crit: 0.3 }, evolve: { with: 'might', name: 'Sentence', text: 'The lance widens and hits twice as hard.', icon: 'falling_golden_meteor_of_light_on_gold', size: 1, dmg: 1 } }),
    spell({ id: 'halting-word', cls: 'paladin', name: 'Halting Word', text: 'A word of command rolls out from you and stops what hears it.', icon: 'radiant_crown_of_light_on_gold', kind: 'nova', el: 'holy', noun: 'Word', one: 'word', color: '#ffe9a0', dmg: [9, 4], every: [4.4, 0.38, 2], size: [46, 9], stun: 0.6, sig: { name: 'Kneel', text: 'What hears it is slowed long after', slow: true } }),
  ],
  warlock: [
    spell({ id: 'soulfire', cls: 'warlock', name: 'Shadow Bolt', text: 'A bolt of shadow seeks the nearest foe.', icon: 'shadow_bolt_on_black', kind: 'bolt', el: 'shadow', noun: 'Shadow Bolts', one: 'bolt', color: '#8bff6a', dmg: [12, 4], every: [1.1, 0.09, 0.44], n: [1, 3], sig: { name: 'Soul Harvest', text: 'Each hit feeds you a little', leech: 0.4 }, evolve: { with: 'might', name: 'Ruinfire', text: 'Bolts burst where they land, and pass on through.', icon: 'dark_meteor_on_violet', burst: 24, pierce: 99, dmg: 0.4 } }),
    spell({ id: 'pit-imps', cls: 'warlock', name: 'Summon Imp', text: 'An imp fights at your side, clawing at the Host.', icon: 'shadow_imp_summon_on_black', kind: 'pet', el: 'fire', sprite: 'cinder-imp', noun: 'Imps', one: 'imp', color: '#ff7a3d', dmg: [20, 9], n: [1, 3], sig: { name: 'Fire Bellies', text: 'Imps throw back what they hit', knock: 80 }, evolve: { with: 'fortune', name: 'Open the Pit', text: 'The pit gives up twice as many, and they bite harder.', icon: 'summoning_circle_on_violet', more: 3, dmg: 0.5 } }),
    spell({ id: 'plague-rain', cls: 'warlock', name: 'Rain of Fire', text: 'Fire rains on the Host all around you.', icon: 'rain_of_fire_drops_on_orange', kind: 'rain', el: 'fire', noun: 'Fire', one: 'drop', color: '#9ae85a', dmg: [11, 4], every: [1.7, 0.12, 0.9], n: [3, 1], size: [15, 1], slow: true, sig: { name: 'Brimstone', text: 'Each drop leaves a pool of fire', trail: true } }),
    spell({ id: 'soul-chain', cls: 'warlock', name: 'Soul Tether', text: 'A curse leaps from foe to foe.', icon: 'spirit_link_of_two_orbs_on_teal', kind: 'chain', el: 'shadow', noun: 'Tethers', one: 'tether', color: '#c88aff', dmg: [12, 5], every: [1.9, 0.2, 0.8], n: [3, 1], sig: { name: 'Bound Souls', text: 'Every foe it touches feeds you', leech: 0.4 } }),
    spell({ id: 'doom-ring', cls: 'warlock', name: 'Harvest', text: 'A black ring bursts out, reaping all it touches and slowing them.', icon: 'dark_scythe_on_violet', kind: 'nova', el: 'shadow', noun: 'Harvest', one: 'ring', color: '#a060ff', dmg: [10, 4], every: [4, 0.38, 1.8], size: [46, 9], slow: true, sig: { name: 'Event Horizon', text: 'It drags foes toward you instead of pushing', pull: true } }),
    spell({ id: 'black-star', cls: 'warlock', name: 'Ruin Bolt', text: 'A bolt of ruin falls where the Host is thickest.', icon: 'dark_meteor_on_violet', kind: 'strike', el: 'shadow', look: 'portal', noun: 'Ruin Bolts', one: 'bolt', color: '#b080ff', dmg: [44, 18], every: [5.2, 0.5, 2.2], size: [34, 6], sig: { name: 'Gravity Well', text: 'It drags everything nearby into the blast', pull: true } }),
    spell({ id: 'drain-life', cls: 'warlock', name: 'Drain Life', text: 'A beam through a line of them that drinks what it takes.', icon: 'life_drain_beam_on_violet', kind: 'lance', el: 'shadow', leech: 0.3, noun: 'Drains', one: 'drain', color: '#c88aff', dmg: [15, 6], every: [1.5, 0.12, 0.7], size: [9, 1], sig: { name: 'Deep Draught', text: 'It drinks twice as much', leech: 0.3 } }),
    spell({ id: 'hellbrand', cls: 'warlock', name: 'Hellbrand', text: 'Brands the ground where you stand: the brand stays, and spits fire at what comes near.', icon: 'burning_magic_circle_on_black', kind: 'totem', el: 'fire', noun: 'Brands', one: 'brand', color: '#ff7a3d', dmg: [9, 4], every: [7, 0.4, 4], n: [1, 4], sig: { name: 'Brimstone Spit', text: 'Its fire bursts where it lands', burst: 16 }, evolve: { with: 'craft', name: 'Ruin Unbound', text: 'Two more brands each time, and their fire bursts wide.', icon: 'giant_fire_explosion_mushroom_cloud_on_orange', more: 2, burst: 22 } }),
    spell({ id: 'demonic-step', cls: 'warlock', name: 'Demonic Step', text: 'Your dash is a step through the dark: shadow bursts where you come out.', icon: 'shadow_dash_streak_on_black', kind: 'dash', el: 'shadow', noun: 'Step', one: 'step', color: '#b080ff', dmg: [34, 14], size: [36, 5], sig: { name: 'Left Behind', text: 'A second burst where you set out from', echo: true } }),
    spell({ id: 'rotting-curse', cls: 'warlock', name: 'Rotting Curse', text: 'A curse hangs about you, rotting whatever comes close.', icon: 'dark_curse_cloud_on_violet', kind: 'aura', el: 'poison', noun: 'Curse', one: 'curse', color: '#9ae85a', dmg: [20, 8], size: [30, 5], sig: { name: 'Feast of Rot', text: 'What it rots feeds you', leech: 0.3 }, evolve: { with: 'reach', name: 'Withering Dark', text: 'The curse reaches far wider, and slows what it rots.', icon: 'withering_flower_on_grey', size: 0.5, dmg: 0.3, slow: true } }),
  ],
  druid: [
    spell({ id: 'thorn-volley', cls: 'druid', name: 'Wrath', text: 'Hurls a thorn of wrath at the nearest foe.', icon: 'sunbeam_on_leaves_on_gold', kind: 'bolt', el: 'nature', noun: 'Thorns', one: 'thorn', color: '#a8e85a', dmg: [10, 4], every: [0.95, 0.08, 0.38], n: [1, 3], pierce: 1, sig: { name: 'Barbed', text: 'Whatever a thorn hits is slowed', slow: true }, evolve: { with: 'haste', name: 'Bramble Storm', text: 'Thorns burst into more thorns where they land.', icon: 'thorn_burst_on_dark_green', burst: 20, more: 2 } }),
    spell({ id: 'bear-swipe', cls: 'druid', name: 'Thrash', text: 'A great paw swipes through what is in front of you.', icon: 'cut_status_scratch_on_red', kind: 'cone', el: 'nature', noun: 'Swipe', one: 'swipe', color: '#e8d0a8', dmg: [15, 6], every: [1.25, 0.09, 0.62], size: [44, 6], sig: { name: 'Mauling', text: 'Foes are knocked sprawling', knock: 120 } }),
    spell({ id: 'spirit-stag', cls: 'druid', name: 'Stampede', text: 'A spirit of the wood runs beside you and gores the Host.', icon: 'stampede_of_hooves_on_brown', kind: 'pet', el: 'nature', sprite: 'blighted-stag', noun: 'Beasts', one: 'beast', color: '#c8ffb0', dmg: [20, 9], n: [1, 3], sig: { name: 'Gentle Herd', text: 'Your beasts heal you as they fight', leech: 0.3 } }),
    spell({ id: 'moonbeams', cls: 'druid', name: 'Starfall', text: 'Starlight stabs down at the Host all around you.', icon: 'star_summon_on_navy', kind: 'rain', el: 'water', noun: 'Stars', one: 'star', color: '#cfe0ff', dmg: [12, 4.5], every: [1.7, 0.12, 0.9], n: [3, 1], size: [15, 1], sig: { name: 'Starstruck', text: 'What they touch stands dazed for a moment', stun: 0.4 }, evolve: { with: 'reach', name: 'Full Moon', text: 'The stars widen, and there are twice as many.', icon: 'crescent_moon_behind_clouds_on_navy', more: 4, size: 0.5 } }),
    spell({ id: 'living-roots', cls: 'druid', name: 'Grasping Roots', text: 'Roots rise where you stood, holding and crushing what crosses them.', icon: 'root_grab_from_the_ground_on_brown', kind: 'field', el: 'nature', noun: 'Roots', one: 'root', color: '#7ad65a', dmg: [13, 7], every: [3, 0.28, 1.4], size: [24, 4], slow: true, sig: { name: 'Stranglehold', text: 'Roots hold what crosses them fast', stun: 0.7 } }),
    spell({ id: 'verdant-pulse', cls: 'druid', name: 'Renewal Bloom', text: 'Life wells up in you every so often and closes your wounds.', icon: 'rejuvenate_leaf_drop_on_green', kind: 'pulse', el: 'nature', noun: 'Pulse', one: 'pulse', color: '#b8ffb8', dmg: [0, 0], every: [7, 0.5, 3.6], heal: [7, 1.5], sig: { name: 'Overgrowth', text: 'It also bursts outward and burns what is near', burst: 60 } }),
    spell({ id: 'moonburn', cls: 'druid', name: 'Moonburn', text: 'A beam of moonlight turns all the way round you.', icon: 'moonfire_beam_on_navy', kind: 'sweep', el: 'water', noun: 'Moonbeams', one: 'beam', color: '#cfe0ff', dmg: [19, 8], every: [3.2, 0.25, 1.6], size: [72, 7], sig: { name: 'Cold Light', text: 'What it crosses is slowed', slow: true } }),
    spell({ id: 'briar-burst', cls: 'druid', name: 'Briar Burst', text: 'Sows a briar seed that bursts in thorns when something steps on it.', icon: 'thorn_burst_on_dark_green', kind: 'mine', el: 'nature', noun: 'Briars', one: 'briar', color: '#8ad65a', dmg: [30, 12], every: [2.6, 0.2, 1.3], n: [1, 3], size: [26, 3], sig: { name: 'Taproot', text: 'What it bursts on is held fast', stun: 0.8 }, evolve: { with: 'craft', name: 'Vine Vortex', text: 'Briars drag the Host into the burst, and burst far wider.', icon: 'entangle_vines_on_green', pull: true, size: 0.5, dmg: 0.3 } }),
    spell({ id: 'thornhide', cls: 'druid', name: 'Thornhide', text: 'A hide of thorns takes the blows meant for you, and bursts when it breaks.', icon: 'thorn_shield_on_dark_green', kind: 'ward', el: 'nature', noun: 'Hide', one: 'hide', color: '#a8e85a', dmg: [30, 12], every: [13, 0.6, 9], size: [46, 5], heal: [12, 1.6], sig: { name: 'Briar Coat', text: 'Breaking, it slows everything near', slow: true }, evolve: { with: 'stout', name: 'Ironpelt', text: 'The hide holds half again as much and comes back far sooner.', icon: 'bark_skin_on_brown', dmg: 0.5, every: -0.35 } }),
    spell({ id: 'wild-dash', cls: 'druid', name: 'Wild Dash', text: 'Your dash is a beast’s bound: the ground bursts where you land.', icon: 'rabbit_dashing_on_green', kind: 'dash', el: 'nature', noun: 'Dash', one: 'bound', color: '#c8ffb0', dmg: [34, 14], size: [36, 5], sig: { name: 'Overgrown Path', text: 'Roots rise along the way you came', trail: true } }),
  ],
  gloamknight: [
    spell({ id: 'gloam-sweep', cls: 'gloamknight', name: 'Gloam Cleave', text: 'A two-handed sweep of shadow through everything in front of you.', icon: 'two_handed_sword_mastery_on_red', kind: 'cone', el: 'shadow', noun: 'Cleave', one: 'sweep', color: '#c8a8ff', dmg: [16, 6], every: [1.2, 0.08, 0.62], size: [46, 6], sig: { name: 'Drinking Edge', text: 'Every foe cut gives back a little of your health', leech: 0.4 }, evolve: { with: 'vigor', name: 'Duskreaver', text: 'The sweep cuts all the way around you and hits half again as hard.', icon: 'giant_reaper_silhouette_on_black', dmg: 0.5, more: 1 } }),
    spell({ id: 'circling-shades', cls: 'gloamknight', name: 'Creeping Dread', text: 'Shades of old knights circle you and cut what they pass through.', icon: 'dark_eye_on_violet', kind: 'orbit', el: 'shadow', noun: 'Shades', one: 'shade', color: '#9a6ae0', dmg: [24, 9], n: [2, 2], sig: { name: 'Cold Touch', text: 'Shades slow whatever they touch', slow: true }, evolve: { with: 'haste', name: 'Host of Shades', text: 'Two more shades, and they cut harder.', icon: 'shadow_wolf_on_violet', more: 2, dmg: 0.3 } }),
    spell({ id: 'dusk-toll', cls: 'gloamknight', name: 'Dread Toll', text: 'A toll of dusk rings out from you and slows what it touches.', icon: 'skull_lantern_on_black', kind: 'nova', el: 'shadow', noun: 'Toll', one: 'toll', color: '#b48cff', dmg: [11, 4.5], every: [4, 0.38, 1.8], size: [48, 9], slow: true, sig: { name: 'Terror', text: 'Foes it touches stand frozen in dread for a moment', stun: 0.6 } }),
    spell({ id: 'duskblade', cls: 'gloamknight', name: 'Duskfall', text: 'A black greatsword falls where the Host is thickest.', icon: 'eclipse_sun_on_black', kind: 'strike', el: 'shadow', look: 'blade', noun: 'Duskfalls', one: 'blade', color: '#9a6ae0', dmg: [46, 18], every: [5.2, 0.5, 2.2], size: [32, 6], sig: { name: 'Grave Pull', text: 'It drags everything nearby into the blow', pull: true } }),
    spell({ id: 'gloom-pool', cls: 'gloamknight', name: 'Grasping Gloom', text: 'Shadow pools where you stood and bites what crosses it.', icon: 'cursed_status_dark_cloud_on_violet', kind: 'field', el: 'shadow', noun: 'Gloom', one: 'pool', color: '#7a52b0', dmg: [13, 7], every: [3, 0.28, 1.4], size: [24, 4], slow: true, sig: { name: 'Feeding Dark', text: 'What it bites heals you', leech: 0.3 } }),
    spell({ id: 'blood-remembers', cls: 'gloamknight', name: 'Blood Price', text: 'Every so often the blood you have paid finds its way home and closes your wounds.', icon: 'burning_heart_on_red', kind: 'pulse', el: 'blood', noun: 'Mending', one: 'mending', color: '#c0344e', dmg: [0, 0], every: [7.5, 0.5, 3.8], heal: [7, 1.5], sig: { name: 'Black Mantle', text: 'Nothing can touch you for a moment when it comes', guard: 1.4 } }),
    spell({ id: 'hollow-ward', cls: 'gloamknight', name: 'Hollow Ward', text: 'A hollow ward takes the blows meant for you, and bursts when it breaks.', icon: 'heart_inside_a_shield_on_red', kind: 'ward', el: 'shadow', noun: 'Ward', one: 'ward', color: '#c0344e', dmg: [30, 12], every: [13, 0.6, 9], size: [46, 5], heal: [14, 1.6], sig: { name: 'Debt Repaid', text: 'Breaking, it drags everything near in to you', pull: true }, evolve: { with: 'stout', name: 'Night Mantle', text: 'The ward holds half again as much and bursts far wider.', icon: 'shadow_veil_curtain_on_violet', dmg: 0.5, size: 0.5 } }),
    spell({ id: 'shadow-lunge', cls: 'gloamknight', name: 'Shadow Lunge', text: 'Your dash is a lunge through shadow: it cuts down what stands where it ends.', icon: 'shadow_clone_of_two_figures_on_black', kind: 'dash', el: 'shadow', noun: 'Lunge', one: 'lunge', color: '#9a6ae0', dmg: [38, 15], size: [34, 5], sig: { name: 'Afterimage', text: 'A second cut where you set out from', echo: true } }),
    spell({ id: 'mourning-arc', cls: 'gloamknight', name: 'Mourning Arc', text: 'Your blade goes all the way round you, trailing dusk.', icon: 'black_candle_on_violet', kind: 'sweep', el: 'shadow', noun: 'Arcs', one: 'arc', color: '#b48cff', dmg: [21, 8], every: [3.2, 0.25, 1.6], size: [66, 7], sig: { name: 'Wake', text: 'Every foe cut gives back a little of your health', leech: 0.4 }, evolve: { with: 'haste', name: 'Nightbreaker', text: 'A blade each way, and they cut half again as hard.', icon: 'shadow_storm_on_black', more: 1, dmg: 0.5 } }),
    spell({ id: 'night-tether', cls: 'gloamknight', name: 'Night Tether', text: 'A chain of night leaps from foe to foe.', icon: 'burning_chain_link_on_black', kind: 'chain', el: 'shadow', noun: 'Tethers', one: 'leap', color: '#c8a8ff', dmg: [13, 5.5], every: [1.9, 0.2, 0.8], n: [3, 1], sig: { name: 'Dragged Down', text: 'Each link is hauled toward you', pull: true } }),
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
  mine: (d) => [
    { name: `Another ${cap(d.one)}`, text: `One more ${d.one} each time`, more: 1 },
    { name: `${ADJECTIVE[d.el]} ${d.noun}`, text: 'Burst 35% harder', dmg: 0.35 },
    { name: `Wide ${d.noun}`, text: '+30% size', size: 0.3 },
    { name: `Quick ${d.noun}`, text: 'Thrown down 20% more often', every: -0.2 },
    { name: `Patient ${d.noun}`, text: 'They wait 8 seconds longer', last: 8 },
  ],
  totem: (d) => [
    { name: `Another ${cap(d.one)}`, text: `One more ${d.one} each time`, more: 1 },
    { name: `${ADJECTIVE[d.el]} ${d.noun}`, text: 'Hit 35% harder', dmg: 0.35 },
    { name: `Lasting ${d.noun}`, text: 'They stand 3 seconds longer', last: 3 },
    { name: `Rapid ${d.noun}`, text: 'They fire 35% faster', speed: 0.35 },
    { name: `Quick ${d.noun}`, text: 'Planted 20% more often', every: -0.2 },
  ],
  dash: (d) => [
    { name: `Wide ${d.noun}`, text: '+30% size', size: 0.3 },
    { name: `${ADJECTIVE[d.el]} ${d.noun}`, text: 'Hits 40% harder', dmg: 0.4 },
    { name: 'Restless', text: 'Your dash comes back 20% sooner', every: -0.2 },
    { name: `Heavy ${d.noun}`, text: 'Throws everything it hits far back', knock: 150 },
    { name: `Numbing ${d.noun}`, text: 'Slows everything it hits', slow: true },
  ],
  sweep: (d) => [
    { name: `Long ${d.noun}`, text: '+25% reach', size: 0.25 },
    { name: `${ADJECTIVE[d.el]} ${d.noun}`, text: 'Hit 35% harder', dmg: 0.35 },
    { name: `Quick ${d.noun}`, text: 'Comes 20% more often', every: -0.2 },
    { name: 'Both Ways', text: 'A second one, the other way', more: 1 },
    { name: `Heavy ${d.noun}`, text: 'Throws what it crosses back', knock: 90 },
  ],
  ward: (d) => [
    { name: `Thick ${d.noun}`, text: 'Holds and bursts 35% more', dmg: 0.35 },
    { name: `Quick ${d.noun}`, text: 'Comes back 20% sooner', every: -0.2 },
    { name: `Wide ${d.noun}`, text: 'Its burst is 30% wider', size: 0.3 },
    { name: `Jagged ${d.noun}`, text: 'Its burst has a 40% chance to crit', crit: 0.4 },
    { name: 'Second Skin', text: 'Its burst heals you a little for each foe', leech: 0.6 },
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
  gloamknight: { hp: 165, speed: 74 },
};

/**
 * Each class's edge: what evens the classes out. A class's spells hit this much harder (or softer) and its health is
 * the square root of it more (or less), so that the same bot, keeping many nights with each class, holds five minutes
 * about half the time with every one of them (the owner, 2026-11-26: "keep them in the 48-52% win rate zone ...
 * deviation up to 5% is ok"). Found by `VIGIL_TUNE=1 npx vitest run tests/sigilfall-vigil-balance` and checked on
 * other nights by the same file; docs/review/sf9-vigil-spells/balance.md has the table. Change a spell's numbers and
 * these want finding again.
 */
export const CLASS_EDGE: Record<ClassId, number> = {
  warrior: 0.98,
  paladin: 1.32,
  druid: 1.52,
  priest: 0.8,
  mage: 2.12,
  warlock: 1.86,
  ranger: 2.41,
  gloamknight: 0.8,
};
/** A class's health as a night begins, its edge in. */
export const classHealth = (cls: ClassId): number => CLASS_BODY[cls].hp * Math.sqrt(CLASS_EDGE[cls]);

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
  craft: { id: 'craft', name: 'Fieldcraft', text: 'Traps, totems and ground last longer and reach 6% wider', icon: 'spike_trap_on_brown' },
  stout: { id: 'stout', name: 'Stout Heart', text: 'Wards hold 20% more, and you take 4% less from every blow', icon: 'defense_up_status_shield_arrow_up_on_blue' },
};
export const REST_ICON = 'regeneration_status_green_leaf_on_green';
/** The pickups' and the dash's pictures. */
export const FIELD_ICONS = { dash: 'haste_status_winged_boot_on_teal', meat: 'heart_with_green_gold_sparkles_on_gold', magnet: 'magnetized_status_magnet_on_red', bomb: 'ice_bomb_on_cyan', frenzy: 'strength_up_status_flexed_arm_on_red', chest: 'crit_up_status_star_burst_on_gold' } as const;

/** Every icon The Vigil shows, for the icon build. */
export const vigilIcons = (): string[] => [REST_ICON, ...Object.values(FIELD_ICONS), ...Object.values(STRENGTHS).map((s) => s.icon), ...ALL_SPELLS.flatMap((s) => (s.evolve ? [s.icon, s.evolve.icon] : [s.icon]))];

/**
 * How a wave's foes behave. The first four are the plain Host; each of the others asks for a different answer:
 * `split` breaks into two small quick ones when it falls, `burst` blows up where it dies (and dies on reaching you),
 * `guard` shrugs off more than half of what comes at its front, and `rally` hangs back making those near it faster and tougher.
 */
export type FoeAi = 'walk' | 'rush' | 'shoot' | 'charge' | 'split' | 'burst' | 'guard' | 'rally';
export const PLAIN_AI: readonly FoeAi[] = ['walk', 'rush', 'shoot', 'charge'];
/** What each of the others is called, and what to do about it (the first one a keeper meets says so). */
export const FOE_KINDS: Partial<Record<FoeAi, { name: string; text: string; color: string }>> = {
  split: { name: 'Twinhusks', text: 'They break in two when they fall.', color: '#9ae85a' },
  burst: { name: 'Cinderbloats', text: 'They burst where they die. Fell them at arm’s length.', color: '#ff7a3d' },
  guard: { name: 'Wallbearers', text: 'Their fronts turn more than half of every blow. Strike from the side or from above.', color: '#b8c8e8' },
  rally: { name: 'Hostcallers', text: 'They make those near them faster and tougher. Fell them first.', color: '#ffd257' },
};

/** The rule a land plays by (vigil/night.ts has what each one says and does). */
export type RuleId = 'glade' | 'bramble' | 'rockfall' | 'mire' | 'tide' | 'gale' | 'graves' | 'storm' | 'cold' | 'venom' | 'vents' | 'fade';
/**
 * A champion's own attack, beside its slam, each shown before it lands: `volley` a ring of slow shots, `charge` a
 * marked line it then runs down, `ring` a blast that is safe close in, `rake` three marked lines, `call` more of the
 * Host called to its side.
 */
export type ChampMove = 'volley' | 'charge' | 'ring' | 'rake' | 'call';

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
  /** A small one of this kind (what a Twinhusk leaves, what gets up from a grave): the kind it came from. */
  base?: FoeDef;
}

const WAVES: (Omit<FoeDef, 'sprite'> & { face?: number })[] = [
  { hp: 12, dmg: 6, speed: 46, r: 6, xp: 1, from: 0, to: 150, weight: 5, ai: 'walk' },
  { hp: 22, dmg: 7, speed: 40, r: 7, xp: 1, from: 30, to: 240, weight: 3, ai: 'walk' },
  { hp: 18, dmg: 8, speed: 82, r: 6, xp: 1, from: 60, to: 360, weight: 3, ai: 'rush' },
  { hp: 46, dmg: 10, speed: 50, r: 7, xp: 2, from: 90, to: 520, weight: 3, ai: 'shoot' },
  { hp: 110, dmg: 14, speed: 60, r: 9, xp: 4, from: 170, to: 700, weight: 2, ai: 'charge' },
  { hp: 130, dmg: 16, speed: 66, r: 7, xp: 4, from: 300, to: 900, weight: 4, ai: 'walk' },
  { hp: 320, dmg: 22, speed: 52, r: 9, xp: 8, from: 460, to: 99999, weight: 3, ai: 'shoot' },
  { hp: 620, dmg: 30, speed: 56, r: 10, xp: 14, from: 640, to: 99999, weight: 3, ai: 'charge' },
  // the ones that ask for a different answer, each wearing the face of one of the waves above (`face`)
  { hp: 30, dmg: 7, speed: 42, r: 9, xp: 2, from: 45, to: 400, weight: 2, ai: 'split', face: 1 },
  { hp: 20, dmg: 12, speed: 60, r: 7.5, xp: 2, from: 110, to: 560, weight: 2, ai: 'burst', face: 0 },
  { hp: 70, dmg: 12, speed: 42, r: 8.5, xp: 4, from: 200, to: 760, weight: 2, ai: 'guard', face: 4 },
  { hp: 60, dmg: 8, speed: 50, r: 9, xp: 5, from: 250, to: 99999, weight: 1, ai: 'rally', face: 3 },
  { hp: 240, dmg: 18, speed: 48, r: 10.5, xp: 8, from: 420, to: 99999, weight: 2, ai: 'split', face: 5 },
  { hp: 150, dmg: 24, speed: 66, r: 8.5, xp: 6, from: 560, to: 99999, weight: 2, ai: 'burst', face: 2 },
  { hp: 420, dmg: 24, speed: 46, r: 9.5, xp: 10, from: 700, to: 99999, weight: 2, ai: 'guard', face: 5 },
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
  /** Its champions, in turn, and the attack each has beside its slam. */
  champions: { sprite: string; name: string; move: ChampMove }[];
  /** The rule this land plays by. */
  rule: RuleId;
}

export const VIGIL_MAPS: VigilMap[] = [
  { id: 'whisperwood', rule: 'glade', region: 'whisperwood', name: 'Whisperwood', blurb: 'Where every watch begins.', color: '#3f8f5a', foes: ['slime', 'beetle', 'goblin', 'sprite', 'boar', 'enforcer', 'guardian'], champions: [{ sprite: 'guardian', name: 'The Gravewarden', move: 'rake' }, { sprite: 'boar', name: 'The Bone Tusk', move: 'charge' }, { sprite: 'enforcer', name: 'The Ash Captain', move: 'call' }] },
  { id: 'thornvale', rule: 'bramble', region: 'thornvale', name: 'Thornvale', blurb: 'Bandits and wolves, and worse behind them.', color: '#a8863a', foes: ['wolf', 'cutthroat', 'bandit-archer', 'spider', 'hedge-witch', 'enforcer'], champions: [{ sprite: 'enforcer', name: 'The Gallows Boss', move: 'volley' }, { sprite: 'wolf', name: 'Old Greymane', move: 'charge' }] },
  { id: 'brackenridge', rule: 'rockfall', region: 'brackenridge', name: 'Brackenridge', blurb: 'Kobolds in the hills, and shades under them.', color: '#c86a2a', foes: ['ridge-kobold', 'kobold-candler', 'russet-boar', 'restless-shade', 'barrow-skeleton', 'wolf'], champions: [{ sprite: 'king-snagtooth', name: 'King Snagtooth', move: 'call' }, { sprite: 'the-grey-lady', name: 'The Grey Lady', move: 'ring' }] },
  { id: 'greyfen', rule: 'mire', region: 'greyfen', name: 'Greyfen Marsh', blurb: 'The drowned don’t stay down here.', color: '#5a7a5a', foes: ['marsh-wisp', 'drowned-villager', 'bog-ghoul', 'marsh-strider', 'bloated-drowned', 'bog-hag'], champions: [{ sprite: 'mother-mire', name: 'Mother Mire', move: 'ring' }, { sprite: 'bog-hag', name: 'The Bog Hag', move: 'volley' }] },
  { id: 'saltmarsh', rule: 'tide', region: 'saltmarsh', name: 'Saltmarsh Coast', blurb: 'The tide brings them in, and keeps on bringing them.', color: '#3a8fb0', foes: ['crab', 'mirefin', 'harpy', 'smuggler', 'mirefin-oracle', 'spider'], champions: [{ sprite: 'crab', name: 'Old Snapjaw', move: 'rake' }, { sprite: 'smuggler', name: 'The Wrecker', move: 'volley' }] },
  { id: 'ironpeak', rule: 'gale', region: 'ironpeak', name: 'Ironpeak', blurb: 'Thin air, and bone-steel in the mines.', color: '#7a8a9a', foes: ['frost-ram', 'griffon', 'legion-miner', 'legion-slagthrower', 'legion-bonecaller', 'bone-golem'], champions: [{ sprite: 'bone-golem', name: 'The Slag King', move: 'rake' }, { sprite: 'griffon', name: 'The Peak Tyrant', move: 'charge' }] },
  { id: 'ashen-barrows', rule: 'graves', region: 'ashen-barrows', name: 'Ashen Barrows', blurb: 'Grey kings under grey hills.', color: '#6a6a7a', foes: ['corpse-candle', 'barrow-hound', 'barrow-wight', 'wight-archer', 'wight-knight', 'banshee'], champions: [{ sprite: 'the-headless-lord', name: 'The Headless Lord', move: 'charge' }, { sprite: 'banshee', name: 'The Keening', move: 'ring' }] },
  { id: 'sunscorch', rule: 'storm', region: 'sunscorch', name: 'Sunscorch', blurb: 'Nothing lives out here. A lot still walks.', color: '#d8a860', foes: ['tomb-scarab', 'sand-scorpion', 'dune-raider', 'sun-mummy', 'dune-javelineer', 'bone-golem'], champions: [{ sprite: 'sand-wurm', name: 'The Sand Wurm', move: 'rake' }, { sprite: 'khamsin', name: 'Khamsin', move: 'volley' }] },
  { id: 'rimeheld', rule: 'cold', region: 'rimeheld', name: 'Rimeheld', blurb: 'Keep moving. The cold is also trying to kill you.', color: '#9fd0ee', foes: ['ice-wolf', 'legion-spearman', 'rime-wraith', 'legion-huscarl', 'yeti', 'frost-giant'], champions: [{ sprite: 'frost-giant', name: 'The Frost Jarl', move: 'ring' }, { sprite: 'yeti', name: 'Old Whiteback', move: 'charge' }] },
  { id: 'vinecoil', rule: 'venom', region: 'vinecoil', name: 'Vinecoil Jungle', blurb: 'Everything here bites.', color: '#3a8a4a', foes: ['blood-mosquito', 'temple-viper', 'jungle-panther', 'serpent-cultist', 'vine-strangler', 'naga-warrior'], champions: [{ sprite: 'the-coiled-queen', name: 'The Coiled Queen', move: 'volley' }, { sprite: 'naga-warrior', name: 'The Naga Warlord', move: 'rake' }] },
  { id: 'emberdeep', rule: 'vents', region: 'emberdeep', name: 'Emberdeep Caldera', blurb: 'Hot enough to melt a sword. Hold anyway.', color: '#c8481e', foes: ['cinder-imp', 'magma-hound', 'legion-forgeslave', 'legion-flamecaller', 'fire-elemental', 'ash-drake'], champions: [{ sprite: 'pyrebrand', name: 'Pyrebrand', move: 'volley' }, { sprite: 'ash-drake', name: 'The Ash Drake', move: 'rake' }] },
  { id: 'pale-reach', rule: 'fade', region: 'pale-reach', name: 'The Pale Reach', blurb: 'The last line. Nobody has held it long.', color: '#a8a0c8', foes: ['pale-hound', 'frost-wraith', 'hollow-legionnaire', 'soul-reaver', 'pale-knight', 'bone-drake'], champions: [{ sprite: 'bone-drake', name: 'The Bone Drake', move: 'rake' }, { sprite: 'pale-knight', name: 'The Pale Knight', move: 'charge' }] },
];

/** The next land opens when you've held this long on the one before it. */
export const UNLOCK_HOLD = 300;
export const mapOpen = (i: number, best: Record<string, number>): boolean => i === 0 || (best[VIGIL_MAPS[i - 1]!.id] ?? 0) >= UNLOCK_HOLD;

export const mapIndex = (m: VigilMap): number => VIGIL_MAPS.indexOf(m);
export const foesOf = (m: VigilMap): FoeDef[] => WAVES.map(({ face, ...w }, i) => ({ ...w, sprite: m.foes[Math.min(face ?? i, m.foes.length - 1)]! }));

const smalls = new Map<FoeDef, FoeDef>();
/** The small one of a kind: quick, frail, and worth a single spark. */
export function smallOf(def: FoeDef): FoeDef {
  const of = def.base ?? def;
  let s = smalls.get(of);
  if (!s) {
    s = { ...of, hp: of.hp * 0.3, dmg: of.dmg * 0.7, speed: Math.min(96, of.speed * 1.6), r: of.r * 0.62, xp: 1, ai: 'walk', base: of };
    smalls.set(of, s);
  }
  return s;
}
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
