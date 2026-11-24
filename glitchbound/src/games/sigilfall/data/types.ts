/**
 * The content schema: classes, skills, the modifiers that items and talents apply to skills, items,
 * talents, enemies, bosses, regions and quests. Everything here is plain data with stable string ids,
 * so content can grow without touching the simulation, and saves only ever store ids.
 */

import type { ShopId } from './vendors';

export type ClassId = 'mage' | 'warrior' | 'ranger' | 'warlock' | 'priest' | 'paladin' | 'druid' | 'gloamknight';
export type DmgType = 'physical' | 'fire' | 'frost' | 'lightning' | 'poison' | 'arcane' | 'shadow' | 'holy' | 'nature';
export type StatusId = 'burn' | 'poison' | 'chill' | 'freeze' | 'shock' | 'stun' | 'root' | 'armorBreak' | 'mark' | 'weaken' | 'bleed' | 'curse' | 'fear';
export type SlotId = 'weapon' | 'offhand' | 'head' | 'chest' | 'legs' | 'hands' | 'feet' | 'amulet' | 'ring' | 'relic';
/**
 * How rare a piece is. `set`: a piece of a set (data/riftgear.ts), above a legendary, in its own green (the owner,
 * 2026-11-22: "legendsry could be orange set could be green").
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'set';

export const SLOTS: SlotId[] = ['weapon', 'offhand', 'head', 'chest', 'legs', 'hands', 'feet', 'amulet', 'ring', 'relic'];

/** What a worn piece is made of (it decides how it looks on the hero). */
export type Material = 'cloth' | 'leather' | 'mail' | 'plate' | 'gold';
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'set'];

/**
 * Character stats. Percentages are whole numbers (power 25 = +25% damage).
 * - hp: flat max health · hpPct: % max health · power: % damage · crit: % chance · critDmg: % extra crit damage
 * - haste: cooldowns recover (100 + haste)% as fast · armor: flat, cuts damage taken (armor / (armor + 60), max 60%)
 * - speed: % move speed · regen: health per second · ultCharge: % faster ultimate charge · potion: % potion healing
 * - healing: % more from your heals and healing over time · pet: % more damage and health for companions
 * - fire / frost / lightning / poison / physical / arcane / shadow / holy / nature: % damage of that type
 */
export type StatKey = 'hp' | 'hpPct' | 'power' | 'crit' | 'critDmg' | 'haste' | 'armor' | 'speed' | 'regen' | 'ultCharge' | 'potion' | 'healing' | 'pet' | DmgType;
export type Stats = Record<StatKey, number>;

/** Skill slots on the action bar. */
export type SlotKey = 'basic' | 's1' | 's2' | 's3' | 's4' | 'ult' | 'dodge';
export const ACTION_SLOTS: SlotKey[] = ['basic', 's1', 's2', 's3', 's4', 'ult', 'dodge'];
/** The skill slots a player fills (four since blueprint V2.9; saves with three get an empty fourth). */
export const SKILL_SLOTS = ['s1', 's2', 's3', 's4'] as const;
export type SkillIndex = 0 | 1 | 2 | 3;

/* ------------------------------------------------------------------ skills */

/**
 * How a skill acts when cast.
 * - projectile: flies along the aim (count / spread / pierce / bounce)
 * - melee: an arc in front of the caster (reach = area, width = arc)
 * - nova: a burst around the caster
 * - chain: an instant bolt that jumps between enemies
 * - blink: a teleport along the aim
 * - dash: the caster rushes along the aim, hitting what it touches (also the dodge)
 * - ground: lands at a point after a delay (meteor), or leaves a field there (rain of arrows)
 * - trap: placed at a point, arms, springs on the first enemy near it
 * - channel: repeats a nova around the caster while it lasts (whirlwind)
 * - mark: picks one enemy and applies its effects
 * - buff: on the caster only (shields, shouts, heals): its cast effects are the skill
 * - drain: a channel on one enemy that hits it every tick and heals the caster for a share
 * - summon: like buff, its cast effects are the skill (a { kind: 'summon' } effect calls companions; casting again heals the ones that stay)
 * - form: takes on a shape (druids): the bar changes until the form is cast again
 */
export type CastKind = 'projectile' | 'melee' | 'nova' | 'chain' | 'blink' | 'dash' | 'ground' | 'trap' | 'channel' | 'mark' | 'buff' | 'drain' | 'summon' | 'form';

/** A field left on the ground (burning ground, poison cloud, arrow rain). Damage is a share of the skill's hit. */
export interface GroundSpec {
  radius: number;
  dur: number;
  /** Seconds between damage ticks. */
  tick: number;
  /** Damage per tick as a share of the skill's damage. */
  mul: number;
  dmgType: DmgType;
  status?: { status: StatusId; dur: number; power: number };
  /** Visual style. */
  look: 'fire' | 'poison' | 'frost' | 'arrows' | 'lightning' | 'rift' | 'shadow' | 'holy' | 'nature';
  /** Each tick drags enemies inside toward the middle by this much (a gravity well, a vine vortex). */
  pull?: number;
  /** Each tick heals the hero standing in it this share (%) of max health (a sanctuary, a bloom). */
  heal?: number;
}

/** Something that happens because of a hit, an impact, a kill or a cast. */
export type Effect =
  /** A status on the enemy hit. Damage over time (burn, poison, bleed, curse) is `power` × the hit per second; a curse deals `dmgType` (shadow unless set). */
  | { kind: 'status'; status: StatusId; dur: number; power: number; chance?: number; dmgType?: DmgType }
  /** A burst at the impact point: `mul` of the skill's damage to every enemy within `radius`. */
  | { kind: 'explode'; radius: number; mul: number; dmgType?: DmgType; status?: { status: StatusId; dur: number; power: number } }
  /** The projectile bursts into `count` smaller ones flying outward, each with `mul` of its damage. */
  | { kind: 'split'; count: number; mul: number }
  /** Lightning leaps to `jumps` more enemies within `range`, each hit `mul` of the last. */
  | { kind: 'chain'; jumps: number; range: number; mul: number; dmgType?: DmgType }
  /** Heals the caster for `pct`% of max health. */
  | { kind: 'heal'; pct: number }
  /** A shield absorbing `pct`% of max health, for `dur` seconds. */
  | { kind: 'shield'; pct: number; dur: number }
  /** A burst around the caster. */
  | { kind: 'nova'; radius: number; mul: number; dmgType?: DmgType; status?: { status: StatusId; dur: number; power: number }; /** Of the class's reference damage, not the skill's (a skill that deals none itself: a dodge). */ ref?: boolean }
  /** A wave that rolls forward from the impact along the aim, through every enemy. */
  | { kind: 'shockwave'; length: number; width: number; mul: number }
  /** Leaves a field on the ground. */
  | { kind: 'ground'; ground: GroundSpec }
  /** Pulls enemies within `radius` toward the point. */
  | { kind: 'pull'; radius: number; force: number }
  /** Resets the cooldown of one skill (or a random skill on cooldown; never the ultimate). */
  | { kind: 'resetCd'; skill?: string }
  /** Takes `s` seconds off every cooldown (not the ultimate). */
  | { kind: 'cdr'; s: number }
  /** Adds `pct` points of ultimate charge. */
  | { kind: 'charge'; pct: number }
  /** Delayed burst at the point (the dodge's rift): `mul` of the class's reference damage after `delay` s. */
  | { kind: 'riftBurst'; radius: number; mul: number; delay: number }
  /** A buff on the caster for `dur` seconds (stats, damage taken cut, healing over time). */
  | { kind: 'buff'; buff: BuffDef }
  /** Gains `n` of the class's resource (rage, holy power; mana in % of the maximum). */
  | { kind: 'resource'; n: number }
  /** Gains `n` of the specialization's points (PointsDef). */
  | { kind: 'points'; n: number }
  /** Enemies within `radius` run away in fear for `dur` seconds (bosses are slowed instead). */
  | { kind: 'fear'; radius: number; dur: number }
  /** Calls `count` companions (PETS by id) for `dur` seconds (0 = until they fall). */
  | { kind: 'summon'; pet: string; count: number; dur: number }
  /** Costs the caster `pct`% of their max health (never below 1). */
  | { kind: 'sacrifice'; pct: number }
  /** Clears every harmful status from the hero (burning, poison, chill, curses, stuns). */
  | { kind: 'cleanse' }
  /** Enemies within `radius` turn on the hero for `dur` seconds, whatever else they wanted. */
  | { kind: 'taunt'; radius: number; dur: number }
  /** Drags the enemy hit `dist` toward the caster (elites half as far, bosses not at all). */
  | { kind: 'yank'; dist: number }
  /**
   * Sets off a damage-over-time status on the enemy hit: everything it still had to deal lands at once, times `mul`,
   * and the status is gone. With `radius`, every enemy that near takes it too.
   */
  | { kind: 'detonate'; status: StatusId; mul: number; radius?: number }
  /**
   * An echo casts one of the hero's own skills (`skill`: its id, or 'basic') at the nearest enemy, for nothing and with
   * no cooldown, at `mul` of its damage; `times` casts, `gap` seconds apart. An echo never calls up another echo.
   */
  | { kind: 'cast'; skill: string; mul: number; times?: number; gap?: number };

/** A timed buff on the hero. The same id refreshes instead of stacking. */
export interface BuffDef {
  id: string;
  name: string;
  dur: number;
  /** Stats added while it lasts. */
  stats?: Partial<Record<StatKey, number>>;
  /** Damage taken cut by this share (%), on top of armor. */
  dr?: number;
  /** Healing per second, as a share (%) of max health. */
  hot?: number;
  /** Strikes back at whatever hits the hero for this share of the class's reference damage. */
  thorns?: number;
  /** More damage dealt while it lasts, % (multiplying the rest, once a stack where it stacks): a shrine's, a streak's. */
  dmg?: number;
  color: string;
  /** It stacks this high: gaining it again adds one and renews its time, and its stats count once a stack. */
  max?: number;
  /** It makes the hero's next cast of one skill more than it is (a specialization's combo): that cast uses it up. */
  empower?: Empower;
}

/**
 * What a combo does to the cast it waits for. Where its buff stacks, the damage counts once a stack and `instant` and
 * `ready` hold only at full stacks; the cast takes every stack. Where it doesn't, it lasts `casts` casts.
 */
export interface Empower {
  /** The skill it waits for; '*' with `type`: the next skill of that damage type that isn't the basic attack. */
  skill: string;
  type?: DmgType;
  /** +% damage. */
  pct?: number;
  /** It costs nothing. */
  free?: boolean;
  /** It has no cast time. */
  instant?: boolean;
  /** Gaining it makes the skill ready at once, whatever its cooldown. */
  ready?: boolean;
  /** How many casts it lasts (1 where not said). */
  casts?: number;
  /**
   * It isn't used up: every cast of the skill takes it for as long as the buff lasts (a spell that makes another stronger
   * while it is out, the Ring's Rimeglobe). Only on a buff that doesn't stack.
   */
  keep?: boolean;
}

/**
 * What a combo blow needs of its target (the Ring's combos, arena/abilities.ts Combo): a status on it, below 30% health
 * (`lowHp`), or held (`held`: stunned, frozen, rooted or terrified).
 */
export type ComboCond = StatusId | 'lowHp' | 'held';

/**
 * A combo blow: a skill that lands far harder on a target another skill has set up (the owner, 2026-11-19: "make the
 * spells and specs very similar to the ring's - combos, ults, casting while moving"). Its damage is multiplied by `mult`
 * on a target that meets any of `vs`, its name goes up over the target, `extra` lands too, and with `consume` the
 * statuses it needed come off.
 */
export interface ComboSpec {
  name: string;
  vs: ComboCond[];
  mult: number;
  consume?: boolean;
  extra?: Effect[];
}

/**
 * A specialization's points (the Ring's Points, arena/abilities.ts): built a few at a time by some skills (SkillSpec.build)
 * and all spent by one (SkillSpec.spend), each making its blow that much stronger. Shown as pips under the health bar.
 */
export interface PointsDef {
  /** What they are called, many and one. */
  name: string;
  one: string;
  max: number;
  color: string;
}

/**
 * A skill's full behaviour after every modifier is applied. Items and talents never touch the
 * simulation directly: they change this spec, and the simulation only ever reads the spec.
 */
export interface SkillSpec {
  id: string;
  cast: CastKind;
  /** direction: aim a heading · ground: aim a point · self: no aim. */
  aim: 'direction' | 'ground' | 'self';
  /**
   * A tapped skill with "Skills aim at the nearest enemy" on: 'target' turns it at that enemy, 'facing' keeps
   * the hero's facing. Unset: blinks and dashes keep the facing (never blink into a pack), the rest aim.
   */
  autoAim?: 'target' | 'facing';
  /** Travel distance (projectiles, dashes, blink) or the farthest point a ground skill can be aimed. */
  range: number;
  cooldown: number;
  charges: number;
  damage: number;
  dmgType: DmgType;
  /** Seconds between pressing and the effect (a wind-up the player can see). */
  windup: number;
  /**
   * Seconds of casting before the spell goes off (the campaign's cast bar; unset or 0: at once). The hero
   * gathers it on the move, slowed to CAST_SLOW (sim/cast.ts) unless the skill is `extra.swift`, as in the Ring;
   * nothing is spent until it goes off, and another skill, a dodge or a stun stops it. Only the campaign reads it
   * (the Vigil and the Ring have kits of their own).
   */
  castTime?: number;
  speed: number;
  radius: number;
  count: number;
  /** Total fan angle in radians for count > 1. */
  spread: number;
  pierce: number;
  bounce: number;
  /** Nova / explosion / melee reach / ground radius. */
  area: number;
  /** Melee arc, radians. */
  arc: number;
  /** Channel length, ground field length, trap lifetime, dash time. */
  duration: number;
  /** Seconds between ticks for channels and fields. */
  tick: number;
  knock: number;
  onHit: Effect[];
  onImpact: Effect[];
  onKill: Effect[];
  onCast: Effect[];
  trail?: GroundSpec;
  /** Extra damage against enemies with a status, below 30% health ('lowHp'), or a long way off ('far': a ranger's eye). */
  bonusVs: { status: StatusId | 'lowHp' | 'far'; pct: number }[];
  /** Extra damage when cast soon after a dodge. */
  afterDodge?: { window: number; pct: number };
  /** A combo blow: far harder on a target set up for it (ComboSpec). */
  combo?: ComboSpec;
  /** Points of the specialization's (PointsDef) it builds when it lands (or is cast, if it deals no damage). */
  build?: number;
  /** It spends all its user's points: each makes it `per` stronger (0.2 = +20% a point). */
  spend?: { per: number; need?: number };
  /** Skill-specific knobs: chain jumps and range, trap limit, echo waves, pull, mana per hit, etc. */
  extra: Record<string, number>;
  /**
   * Resource cost: for mana a share (%) of the maximum; for rage, energy, focus and holy power the
   * points themselves. 0 for classes without a resource.
   */
  cost: number;
  /** Resource gained when used (rage from a swing that hits, holy power from a builder). */
  gen: number;
  /** Visual variant (e.g. Arcane Bolt turned to lightning). */
  look?: string;
  tags: string[];
}

export interface SkillDef {
  id: string;
  name: string;
  cls: ClassId;
  kind: 'basic' | 'skill' | 'ultimate' | 'dodge';
  /** Character level that unlocks it. */
  unlock: number;
  /** One line shown on the button's details. */
  blurb: string;
  base: SkillSpec;
}

/** What an item or talent does to one skill. Numbers add up across sources, then apply (see build.ts). */
export type SkillOp =
  | { op: 'damage'; pct: number }
  | { op: 'cooldown'; pct: number }
  | { op: 'area'; pct: number }
  | { op: 'range'; pct: number }
  | { op: 'duration'; pct: number }
  | { op: 'arc'; pct: number }
  | { op: 'pierce'; n: number }
  | { op: 'bounce'; n: number }
  | { op: 'projectiles'; n: number; spread?: number }
  | { op: 'charges'; n: number }
  | { op: 'extra'; key: string; n: number; label: string }
  | { op: 'convert'; dmgType: DmgType; look?: string }
  | { op: 'onHit' | 'onImpact' | 'onKill' | 'onCast'; effect: Effect }
  | { op: 'trail'; ground: GroundSpec }
  | { op: 'bonusVs'; status: StatusId | 'lowHp' | 'far'; pct: number }
  | { op: 'afterDodge'; window: number; pct: number }
  /** More of the resource gained when used. */
  | { op: 'gen'; n: number }
  /** Costs `pct`% less of the resource. */
  | { op: 'cost'; pct: number }
  /**
   * Makes it a combo blow (it takes `combo` whole: name, what it needs, multiplier), or changes the one it is: what it
   * needs is added to, `consume` and `extra` are taken on, and `add` goes on its multiplier a rank (0.3: ×2 becomes ×2.3).
   */
  | { op: 'combo'; combo: Partial<ComboSpec>; add?: number }
  /** It builds this many more of the specialization's points. */
  | { op: 'build'; n: number }
  /** It spends the specialization's points (SkillSpec.spend); `per` adds to what each is worth. */
  | { op: 'spend'; per: number };

/** A triggered effect with its own chance and internal cooldown. */
export interface ProcDef {
  /** Unique id: the internal cooldown is tracked per proc. */
  id: string;
  /** `tick`: every `icd` seconds while an enemy is near (in a fight), by itself. */
  on: 'hit' | 'crit' | 'kill' | 'dodge' | 'hurt' | 'ult' | 'block' | 'tick';
  /** Only hits of this damage type / from this skill / against enemies with this status count. */
  dmgType?: DmgType;
  skill?: string;
  status?: StatusId;
  chance: number;
  icd: number;
  effect: Effect;
  /** Plain-language description shown on the item. */
  text: string;
  /** On a talent of more than one rank, what each rank adds: its effect (the default), or its chance. */
  perRank?: 'effect' | 'chance';
}

/**
 * What an item or talent changes. A stat mod with `when` counts only then (below half health, or for
 * 3 s after a dodge). A skill mod's `skill` is a skill id, or '*' for every skill the hero has.
 */
export type Mod = { t: 'stat'; stat: StatKey; v: number; when?: 'lowHp' | 'afterDodge' } | { t: 'skill'; skill: string; op: SkillOp } | { t: 'proc'; proc: ProcDef };

/* ------------------------------------------------------------------- items */

/** The shape of a slot's artwork. */
export type ItemIcon =
  | 'staff'
  | 'wand'
  | 'sword'
  | 'axe'
  | 'hammer'
  | 'bow'
  | 'orb'
  | 'tome'
  | 'shield'
  | 'quiver'
  | 'hood'
  | 'helm'
  | 'cap'
  | 'crown'
  | 'robe'
  | 'plate'
  | 'jerkin'
  | 'legs'
  | 'gloves'
  | 'boots'
  | 'amulet'
  | 'ring'
  | 'relic'
  | 'shard'
  | 'potion';

/** A hand-made item: fixed mods, stats that scale with the item level. */
export interface ItemDef {
  id: string;
  name: string;
  slot: SlotId;
  rarity: Rarity;
  /** Class-only items (weapons, off-hands); missing = anyone. */
  cls?: ClassId;
  icon: ItemIcon;
  /** Main color of the artwork. */
  tint: string;
  /** What it's made of, when the icon alone doesn't say (chain is mail, gauntlets are plate). */
  mat?: Material;
  /** Stats at item level 1 and how much they grow per level. */
  stats: { stat: StatKey; base: number; per: number }[];
  mods: Mod[];
  /** One flavour line. */
  lore: string;
  /** Lowest item level it can drop at. */
  minLevel: number;
  /** Only from a quest or a boss (never random drops). */
  special?: boolean;
  /** One of a set (data/riftgear.ts SETS): worn with its fellows it does more. */
  set?: string;
  /** Rift-forged: it comes only out of the Rift, to a hero whose Riftstone has opened this level. */
  rift?: number;
  /** Made for one of its class's three specializations: what it changes is that one's own skill. */
  forSpec?: 0 | 1 | 2;
}

/** A base type for generated gear: a slot, a look and the stats it can roll. */
export interface ItemBase {
  id: string;
  name: string;
  slot: SlotId;
  cls?: ClassId;
  icon: ItemIcon;
  tint: string;
  mat?: Material;
  /** Always-on stat (weapons: power). */
  implicit?: { stat: StatKey; base: number; per: number };
}

/** An item in a bag or worn: authored items store their def, generated ones their rolls. */
export interface Item {
  uid: string;
  /** ItemDef id or ItemBase id. */
  base: string;
  r: Rarity;
  /** Item level. */
  il: number;
  /** Rolled stats (generated items). */
  st: [StatKey, number][];
  /** Index of a rolled skill modifier (generated rare items). */
  sm?: number;
  /** Generated name. */
  n?: string;
  /** Not looked at yet. */
  fresh?: boolean;
  /** Gold paid for it at a vendor: it sells back for a share of that, never for more (progress/items.ts salvageValue). */
  paid?: number;
}

/* ----------------------------------------------------------------- talents */

export interface TalentNode {
  id: string;
  name: string;
  /** Tree index within the class (0, 1 or 2: the specializations, in order). */
  tree: 0 | 1 | 2;
  /** Row (0-6): points spent in this tree needed = row × ROW_COST (row 0 is free). */
  row: number;
  col: number;
  ranks: number;
  /** Mods per rank (numeric values multiply by the rank). */
  mods: Mod[];
  /** Another node that needs at least one point first. */
  requires?: string;
  /**
   * One of a choice (the Ring's talent rows: one choice from each): the nodes of a tree with the same `pick` are three ways
   * of doing one thing, and only one of them is taken. It counts one point; another of them can be chosen instead at any
   * time, for free (progress/character.ts swapPick).
   */
  pick?: string;
  /** Text with {r} for the rank's value where it changes. */
  text: string;
  icon: string;
}

/**
 * A specialization: one of a class's three talent trees. Choosing it (from level 10) grants its
 * ability and its passive, and its tree is where the points go first.
 */
export interface SpecDef {
  name: string;
  blurb: string;
  color: string;
  /** How it plays, in a few words (damage, tank, healing hybrid). */
  role: string;
  /** The ability the specialization grants: it joins the skills you can put on the bar. */
  skill: string;
  /** Always on while this is your specialization. */
  passive: { name: string; text: string; mods: Mod[] };
  /**
   * Its combo: the one thing its skills do together that no other specialization's do (one skill setting up
   * another, charges built and spent, a status set off). Its mods are always on, as the passive's are.
   */
  combo?: { name: string; text: string; mods: Mod[] };
  /**
   * Its own ultimate (as each of the Ring's playstyles has its own super): it takes the class's place on the bar once the
   * specialization is chosen. Without one the class's stays.
   */
  ult?: string;
  /** Its points, if its skills build and spend any (PointsDef). */
  points?: PointsDef;
  /** The ability belongs to a druid shape: it is used there, not put on the normal bar. */
  formOnly?: boolean;
  /**
   * The skills it plays with, its own ability among them: they take the bar when it is chosen, and each one learned
   * later takes the place of a skill that isn't one of them (progress/character.ts seatSpecBar). Without it, the bar
   * fills in the order skills are learned, which left a Cryomancer with no Ice Javelin (2026-11-23).
   */
  bar?: string[];
}

/**
 * A druid shape: while in it, the basic attack and the other two skill slots become the form's, and
 * its stats apply. Casting the form's skill again returns to normal.
 */
export interface FormDef {
  id: string;
  name: string;
  /** The skill that takes this shape. */
  skill: string;
  basic: string;
  skills: [string, string];
  /** A specialization (tree) that swaps one of the shape's skills for its own ability. */
  specSwap?: { tree: 0 | 1 | 2; slot: 0 | 1; skill: string };
  /** The dodge while in this shape. */
  dodge: string;
  stats: Partial<Record<StatKey, number>>;
  /** Max health share while in shape (%, bears are big). */
  hpPct?: number;
}

/* ----------------------------------------------------------------- classes */

/**
 * A class's resource.
 * - mana: a pool that grows with level; costs are shares of it; it trickles back in a fight and
 *   refills fast out of one.
 * - rage: 0-100, earned by hitting and being hit, spent on skills, fades out of combat.
 * - energy / focus: 0-100, comes back quickly at a fixed rate; skills spend it.
 * - holy: Zeal, 0-5 points built by some skills and spent by others; fades out of combat.
 */
export interface ResourceDef {
  kind: 'mana' | 'rage' | 'energy' | 'focus' | 'holy';
  name: string;
  color: string;
  /** Maximum at level 1, and per level after (mana); the fixed maximum otherwise (perLevel 0). */
  base: number;
  perLevel: number;
  /** Mana: regained per second in a fight, as a share (%) of the maximum. Energy and focus: points per second. Rage: points lost per second out of combat. */
  regen: number;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  blurb: string;
  /** How hard it is to play well, 1-3. */
  difficulty: number;
  base: Stats;
  /** Health per level. */
  hpPer: number;
  /** Basic, the skill pool (choose three), the ultimate and the dodge. */
  basic: string;
  skills: string[];
  ult: string;
  dodge: string;
  /** The skills equipped when a new hero starts (by slot). */
  start: [string, string | null, string | null];
  trees: [SpecDef, SpecDef, SpecDef];
  /** Druids: the shapes they can take. */
  forms?: FormDef[];
  /** Damage a typical hit deals at level 1 (scales item procs and ultimate charge). */
  refDamage: number;
  /**
   * Ultimate charge per hit against refDamage (default 1): classes that spend their time mending or
   * striking one foe at a time earn more from each hit, so every class's ultimate comes about as often.
   */
  ultRate?: number;
  /** A spell resource (mana): skills cost a share of it. Classes without one cast on cooldowns alone. */
  resource?: ResourceDef;
  colors: { main: string; dark: string; accent: string };
}

/* ----------------------------------------------------------------- enemies */

/**
 * Divers keep their distance, then swoop along a marked line. Exploders run at you, swell, and burst
 * (they die doing it).
 */
export type EnemyAi = 'melee' | 'hopper' | 'ranged' | 'charger' | 'armored' | 'caster' | 'diver' | 'exploder';

export interface EnemyDef {
  id: string;
  name: string;
  sprite: string;
  /**
   * A thing, not a creature: drawn as this prop (`m`, `h` px tall) and standing still, like a boss fight's
   * candles, coffins or posts (data/bosses.ts): it shakes and flashes when struck.
   */
  prop?: { m: string; h: number; tint?: [number, number, number]; /** It hangs this far off the ground (tiles), bobbing: a thing that floats (a sigil torn loose). */ lift?: number };
  ai: EnemyAi;
  hp: number;
  dmg: number;
  speed: number;
  radius: number;
  /** Heavier enemies are pushed less. */
  mass: number;
  xp: number;
  gold: [number, number];
  aggro: number;
  /** Distance at which it starts its attack. */
  reach: number;
  windup: number;
  recover: number;
  /** Seconds between attacks. */
  attackCd: number;
  /** Physical damage taken is cut by this share unless its armor is broken (armored). */
  armor?: number;
  /** Ranged and caster attacks. `lead` aims ahead of a moving target (0-1: how far ahead). */
  shot?: { speed: number; radius: number; count: number; spread: number; color: string; homing?: number; lead?: number; look?: string; status?: { status: StatusId; dur: number; power: number } };
  /** Melee packs circle in from the sides instead of walking straight at you. */
  flank?: boolean;
  /** Mends a hurt ally nearby (this share of its health) instead of attacking. */
  heals?: number;
  /** Drawn floating above its shadow. */
  floats?: boolean;
  /** A named enemy: its name shows, it comes back slowly, and it carries better loot. */
  named?: boolean;
  /** Colors swapped on its sprite (one drawing, several creatures). */
  pal?: Record<string, string>;
  /** Raises these minions (up to `max` alive at once) instead of attacking, now and then. */
  /** Raises `count` of `enemy` at a time, never more than `max` alive, then rests `cd` seconds (default 7). */
  summons?: { enemy: string; count: number; max: number; cd?: number };
  /** Slips away this far when the hero gets close (a few seconds between blinks). */
  blink?: number;
  /** Heals this share of its health a second once it hasn't been hit for a few seconds. */
  regen?: number;
  /** Exploders: the poison left where they burst (seconds, 0 for none). */
  burst?: {
    radius: number;
    /** Seconds a poison pool stays where it burst (0: none). */
    pool: number;
    /** The burst's color (default sickly green). */
    color?: string;
    /** It also bursts when killed (shown on the ground first): exploders and anything else bloated. */
    onDeath?: boolean;
  };
  /** Charger rush. */
  rush?: { speed: number; dist: number };
  /** A siege engine: it goes for what an event's defenders protect (a gate, a door), never the hero. */
  siege?: boolean;
  /** Armored slam and caster circles. */
  slam?: { radius: number };
  /** Ranged enemies try to stay this far away. */
  keep?: number;
  resist?: Partial<Record<DmgType, number>>;
  /** Drawn bigger (elites are 1.25 on top). */
  scale?: number;
  /** Where it lives, for the bestiary text. */
  blurb: string;
}

export type EliteAffix = 'frenzied' | 'molten' | 'vampiric' | 'shielded' | 'volatile';

/* ----------------------------------------------------------------- regions */

export type RegionId =
  /** The finale's memory of Vaelmoor and the postgame's catacombs. */
  | 'vaelmoor-remembered'
  | 'crown-catacombs'
  /** The postgame's sanctuary round the Rift Gate, where the Riftstone is run (data/zones/riftward.ts). */
  | 'riftward'
  | 'emberwick'
  | 'briarhollow'
  /** Interiors (data/interiors.ts). */
  | 'bramble-and-barrel'
  | 'chapel-of-the-bell'
  | 'elders-hall'
  | 'ember-hearth'
  | 'great-hall'
  | 'brannocs-forge'
  | 'whisperwood'
  | 'crypt'
  | 'thornvale'
  | 'gallows-keep'
  | 'saltmarsh'
  | 'smugglers-grotto'
  /* Acts I and II of the Hollow King (see WORLD.md) */
  | 'brackenridge'
  | 'greyfen'
  | 'amberfield'
  | 'duskfen'
  | 'rotmother-cistern'
  | 'ironpeak'
  | 'deepforge-halls'
  | 'ashen-barrows'
  | 'barrow-of-kings'
  | 'stormwatch'
  /* Act III */
  | 'grimward'
  | 'sunscorch'
  | 'tomb-of-the-sun-king'
  | 'glimmerwood'
  | 'rimeheld'
  | 'rimeheld-vault'
  | 'shattered-vale'
  | 'sablewind'
  | 'vinecoil'
  | 'highwall'
  | 'siege-of-highwall'
  /* Act IV */
  | 'blightwood'
  | 'blightheart'
  | 'frostfang'
  | 'sunken-reaches'
  | 'bonefields'
  | 'weeping-woods'
  | 'emberdeep'
  | 'molten-throne'
  | 'riftscar'
  | 'spire-of-the-rift'
  | 'gloamhollow'
  | 'hollowmere'
  | 'pale-reach'
  | 'duskspire';
/** How a region looks (see data/themes.ts): outdoor biomes, and the stone of indoor places. */
export type Theme =
  | 'village'
  | 'forest'
  | 'farm'
  | 'coast'
  | 'autumn'
  | 'marsh'
  | 'plague'
  | 'plains'
  | 'mountain'
  | 'barrow'
  | 'storm'
  | 'moor'
  | 'desert'
  | 'fey'
  | 'snow'
  | 'rift'
  | 'jungle'
  | 'warfront'
  | 'blight'
  | 'haunted'
  | 'volcanic'
  | 'deadlake'
  | 'peaks'
  | 'sunken'
  | 'bonefield'
  | 'gloam'
  | 'pale'
  | 'crypt'
  | 'cave'
  | 'keep'
  | 'icecave'
  | 'temple'
  | 'lavacave'
  | 'citadel'
  | 'cistern'
  | 'roots'
  | 'riftspire'
  /** Interiors: timber and plaster (inns, houses, a forge), and a lord's stone hall. */
  | 'tavern'
  | 'greathall';

/** What a letter on a region map stands for (the terrain under it is the region's floor). */
/**
 * A condition on the story (STORY_BIBLE.md §4): a quest's state, or a combination. `offered` is a
 * quest its giver is waiting to hand over; `started` means offered, active or done.
 */
export type StoryCond =
  /** 'taken': done, and not a path closed by another answer to its choice. */
  | { quest: string; is: 'locked' | 'offered' | 'active' | 'ready' | 'done' | 'started' | 'taken' }
  | { all: StoryCond[] }
  | { any: StoryCond[] }
  | { not: StoryCond };

/** A line a person says over their head during play (a companion's bark, a villager's cry). */
export interface Bark {
  /** An NPC id, a companion's pet id, an enemy id (a villain in the field), or 'hero'. */
  who: string;
  text: string;
}

/**
 * A scripted moment a quest asks for, played with the ordinary fighting (blueprint §4.2, no fake
 * cutscenes): raiders pour in, a door must hold, people must be led to safety.
 */
export interface StoryEventDef {
  id: string;
  region: RegionId;
  kind: 'raid' | 'defend' | 'rescue' | 'arrival' | 'escort';
  /** Where it happens (a spot id): it starts when the hero comes within `radius` tiles. */
  at: string;
  radius: number;
  /** Enemy level (else the region's). */
  level?: number;
  /**
   * Waves, one after another: each comes from its spots once the last is beaten. A `hint` shows the hero the
   * control the wave asks for (the Prologue's first fight teaches by fighting).
   */
  waves: { enemies: string[]; from: string[]; barks?: Bark[]; leave?: string[]; hint?: 'attack' | 'skill' | 'dodge' }[];
  /** A fight that is not won: it ends by itself this many seconds in, whatever is still standing. */
  ends?: number;
  /** Companions (pet ids) the event takes away at its end instead of letting them go (the one carried off). */
  taken?: string[];
  /** Its companions stay on this many seconds after its last words (a scene that follows has them speak). */
  stay?: number;
  /**
   * Its waves come in from just beyond the hero's view, from the way of their spots, rather than from the
   * spots themselves: a fight with no walk in it.
   */
  close?: boolean;
  /** Companions who fight beside the hero while it lasts (PETS ids). */
  allies?: string[];
  /** Allies who come only if the story says so (a faction the hero helped, the answer they chose). */
  alliesIf?: { pet: string; when: StoryCond }[];
  /**
   * Where allies who aren't already at hand come from (a spot id): they run in from that side, from just
   * beyond the hero's view (else from the event's own spot, else from anywhere). Whoever stayed on from the
   * last event, or was standing there a moment ago, is already here.
   */
  enter?: string;
  /** Defend: what must not fall (a PETS id standing at a spot). */
  ward?: { pet: string; at: string; name: string };
  /** Rescue: people (PETS ids) found at a spot, who follow the hero to another (and go in at `into`, after). */
  rescue?: { pets: string[]; at: string; to: string; into?: string };
  /** Arrival: people (PETS ids) who walk in from one spot to another on their own (a camp filling up). */
  arrive?: { pets: string[]; from: string; to: string };
  /**
   * Escort: a wagon (a ward that walks, PETS id) and the people walking with it go from one spot to
   * another; they stop while foes are near, and the waves find them on the road.
   */
  escort?: { wagon: string; walkers?: string[]; from: string; to: string };
  /** The banner when it begins (else by kind: Raid!, Hold!, Rescue!). */
  banner?: string;
  start?: Bark[];
  end?: Bark[];
  /** Said when the ward falls or the hero does, before the event starts over. */
  retry?: Bark[];
}

/** The way a prop's front looks when it isn't south. */
export type PropFace = 'n' | 'e' | 'w';

export type Marker =
  | { kind: 'start' }
  | { kind: 'pack'; enemies: string[]; elite?: boolean; named?: string; level?: number; rare?: boolean; /** One of a land's wandering packs, not a place's own: it has nowhere it must be. */ roam?: boolean }
  | { kind: 'chest'; id: string; tier: 'common' | 'rare' | 'epic'; once?: boolean }
  | { kind: 'npc'; npc: string }
  /** A way to another region; a `door` is walked straight through (into or out of a building), no road sign. */
  | { kind: 'exit'; to: RegionId; label: string; minLevel?: number; needs?: string; door?: boolean }
  | { kind: 'waystone' }
  | { kind: 'boss'; boss: string }
  | { kind: 'secret'; id: string }
  | { kind: 'shrine'; id: string }
  | { kind: 'dummy'; shooter?: boolean }
  | {
      kind: 'prop';
      prop: string;
      solid?: boolean;
      /** Only seen: nobody bumps into it (a boss chamber's dressing out on its floor, where its fight is). */
      through?: boolean;
      /**
       * Which way its front looks, when not south (toward the camera, as everything is made): a market stall on the
       * west side of a square looks east across it, a camp's tents open on its fire.
       */
      face?: PropFace;
    }
  | { kind: 'torch' }
  | { kind: 'checkpoint' }
  | { kind: 'hazard'; hazard: 'bramble' | 'spore' }
  /** A building drawn over its footprint (w x h tiles, the marker at its bottom-left), with a name over the door. */
  | {
      kind: 'building';
      style: 'house' | 'tavern' | 'inn' | 'shop' | 'smithy' | 'temple' | 'keep' | 'tower' | 'hall' | 'lighthouse';
      w: number;
      h: number;
      name?: string;
      art?: string;
      /** Drawn this many times its picture's size, and as solid (the capital's keep). */
      scale?: number;
      /** In dark stone, its windows lit and its banners red: a fortress to fear. */
      grim?: boolean;
      /** The building comes to fill its lot, however big the lot is. */
      fit?: boolean;
    }
  /** A place to discover (an explore objective, a line in the log): walking within `r` tiles finds it. */
  | { kind: 'spot'; id: string; name: string; r: number }
  /**
   * A flame on a roof or a beam while the region burns (a world state's dressing). A roof that starts
   * burning while the hero is there catches `delay` seconds after the burning begins.
   */
  | { kind: 'fire'; size: number; delay?: number }
  /** A plume of colored vapor while it shows: grieflight over a corrupted shrine, marsh-rot over a well. */
  | { kind: 'wisp'; color: string; size: number }
  /** A named point the story uses (where an event happens, where raiders come from); nothing to find. */
  | { kind: 'place'; id: string };

/** A marker put at a tile by a zone generator, instead of a letter on the map. */
export interface PlacedMarkerDef {
  tx: number;
  ty: number;
  marker: Marker;
  /** Only while this story condition holds (a person who comes later, a fire, a tent at the camp). */
  when?: StoryCond;
}

/**
 * A region's state by the story (STORY_BIBLE.md §4): the first whose condition holds is the one the
 * hero sees. Markers can carry `when` (MarkerWhen) to appear only in some states.
 */
export interface RegionStateDef {
  id: string;
  when: StoryCond;
  /** Night falls: the land is dark but for lamps, fires and the hero's light. */
  night?: boolean;
  /** Fire markers burn; embers and smoke drift. */
  burning?: boolean;
  /** After a fire: scorched ground and smoke from the ruins. */
  smoke?: boolean;
  /** Late light: a warm low sun over everything. */
  dusk?: boolean;
  /** The lamps are out: a cold early dark over everything (lighter than night). */
  gloom?: boolean;
  /** The music while it lasts. */
  music?: MusicTrack;
}

/** A room that seals its doors and spawns waves when the player walks in (dungeons). */
/**
 * What a dungeon's room does while its fight is on, besides its foes (POLISH_PLAN.md piece 18): one to a room, warned
 * on the ground before it lands as a boss's blows are (sim/rooms.ts).
 * - `rockfall`: stones (icicles, slag, glass) come down about the hero.
 * - `vents`: vents in the floor breathe in turns.
 * - `blades`: something sweeps the room along a line, across it or down it.
 * - `volley`: shots from the room's walls along lines to where the hero stands.
 * - `rift`: the Rift opens under the hero's feet.
 */
export type RoomMechanic = 'rockfall' | 'vents' | 'blades' | 'volley' | 'rift';
/** How a room's mechanic looks and what it leaves (when not the dungeon's own: sim/rooms.ts lookOf). */
export type RoomLook = 'stone' | 'brick' | 'ice' | 'slag' | 'glass' | 'bough' | 'fire' | 'bile' | 'spore' | 'frost' | 'steam' | 'sand' | 'blade' | 'chain' | 'water' | 'bolt' | 'dart' | 'spear' | 'riftbolt' | 'rift';

export interface Encounter {
  id: string;
  /** The map letter used for this room's floor. */
  floor: string;
  waves: { enemies: string[]; elite?: boolean }[];
  /** Plays the boss fight instead of waves. */
  boss?: string;
  /** Respawn point after a defeat in or after this room. */
  checkpoint?: boolean;
  title?: string;
  /** What the room does while its waves are fought (a boss's room has the boss's own). */
  mechanic?: { kind: RoomMechanic; look?: RoomLook };
}

export interface RegionDef {
  id: RegionId;
  name: string;
  subtitle: string;
  theme: Theme;
  /** A town (safe), the wilds, or a dungeon (rooms, a boss at the end, difficulty tiers). */
  kind: 'town' | 'wild' | 'dungeon';
  /** Inside a building of a town (safe, entered by its door, never on the world map; no riding). */
  interior?: boolean;
  /**
   * A dungeon whose story ends in a deed rather than a fight (the Ash Crown unmade in its own memory): when this
   * quest is done here, the way home opens where the hero stands, as it does when a last boss falls.
   */
  homeAfter?: string;
  /** Enemy level on Normal (in the wilds, at the way in; packs carry their own). */
  level: number;
  /** The levels the region is for, shown on the world map. */
  levels: [number, number];
  /** Where it sits on the world map (0-100 across, 0-100 down). */
  at: [number, number];
  dark: boolean;
  safe: boolean;
  music: MusicTrack;
  map: string[];
  markers: Record<string, Marker>;
  /** Markers a generator put at tiles (wild zones). */
  placed?: PlacedMarkerDef[];
  /** Markers (by map letter) that appear only while a story condition holds. */
  when?: Record<string, StoryCond>;
  /** The region's states by the story, first match wins (none: always as built). */
  states?: RegionStateDef[];
  /** What a generated zone holds, known without generating it (for routes between regions). */
  holds?: {
    exits: RegionId[];
    npcs: string[];
    spots: string[];
    needs?: Partial<Record<RegionId, string>>;
    npcWhen?: Record<string, StoryCond>;
    /** Where its ways out are (0-1 across, 0-1 down) and what their signs say: which way each land lies (the world map). */
    ways?: { to: RegionId; at: [number, number]; label: string }[];
  };
  encounters: Encounter[];
  /** Where the camera starts when entering from the waystone / another region. */
  blurb: string;
}

/** A place's song (audio/songs.ts): every land has its own; indoors, the story's nights and underground share a few. */
export type MusicTrack =
  | 'emberwick'
  | 'briarhollow'
  | 'whisperwood'
  | 'thornvale'
  | 'saltmarsh'
  | 'brackenridge'
  | 'greyfen'
  | 'amberfield'
  | 'duskfen'
  | 'ironpeak'
  | 'ashen-barrows'
  | 'stormwatch'
  | 'grimward'
  | 'sunscorch'
  | 'glimmerwood'
  | 'rimeheld'
  | 'shattered-vale'
  | 'sablewind'
  | 'vinecoil'
  | 'highwall'
  | 'gloamhollow'
  | 'bonefields'
  | 'weeping-woods'
  | 'sunken-reaches'
  | 'blightwood'
  | 'emberdeep'
  | 'hollowmere'
  | 'riftward'
  | 'riftscar'
  | 'pale-reach'
  | 'tavern'
  | 'chapel'
  | 'court'
  | 'siege'
  | 'village'
  | 'crypt'
  | 'cave'
  | 'frost-vault'
  | 'molten'
  | 'rootdeep'
  | 'tomb'
  | 'deepforge';

/* ------------------------------------------------------------------ quests */

export type Objective =
  | { kind: 'tutorial'; step: 'attack' | 'skill' | 'dodge'; count: number; label: string }
  | { kind: 'kill'; region: RegionId; count: number; label: string; enemies?: string[] }
  /** Things carried by some enemies: each kill of one of `from` has `chance` to give one. */
  | { kind: 'loot'; region: RegionId; item: string; from: string[]; chance: number; count: number; label: string }
  | { kind: 'talk'; npc: string; label: string }
  | { kind: 'boss'; boss: string; label: string }
  | { kind: 'collect'; item: 'shard'; count: number; label: string }
  | { kind: 'explore'; spot: string; label: string }
  | { kind: 'clear'; region: RegionId; tier: number; label: string }
  /** A story event (raid, defense, rescue) the hero plays through. */
  | { kind: 'event'; event: string; label: string };

/** Lasting gifts from the ends of quest chains; the seven sigils are the main story's. */
export type PerkId = 'mount' | 'satchel' | 'flask' | 'hearth' | SigilId;
export type SigilId = 'sigil-embers' | 'sigil-tides' | 'sigil-stone' | 'sigil-sun' | 'sigil-frost' | 'sigil-thorns' | 'sigil-veil';

/**
 * Something the hero finds and keeps: a letter, an order, a page torn from a book, a relic. It comes up as a page of
 * its own the moment it is found (the words on it as they are written), and stays in the Journal to be read again.
 * A quest that sends the hero to look somewhere has one, so the hero always knows what they found and why it matters.
 */
export interface Keepsake {
  name: string;
  kind: 'letter' | 'note' | 'orders' | 'page' | 'map' | 'relic' | 'token';
  /** What it is, where it was and why it matters, plainly: one to three short sentences. */
  about: string;
  /** The words on it (a letter, a note, a carving): each a paragraph, shown as written. */
  body?: string[];
  /** Who wrote it, under the words. */
  sign?: string;
  /** Which step of the quest finds it (0 is its objective); else it is found when the quest's work is done. */
  step?: number;
}

export interface QuestDef {
  id: string;
  name: string;
  giver: string;
  /** What the hero finds doing it (shown as it is found, kept in the Journal). */
  find?: Keepsake;
  /** Comes and goes without a toast: a beat its own talk or banner already announces (the Prologue's first moments). */
  quiet?: boolean;
  /** Shown in the quest log. */
  text: string;
  objective: Objective;
  /** Further steps after the objective, one at a time (the quest log shows each as it comes). */
  then?: Objective[];
  /** Who it is handed in to (else the giver, when the giver is near where it is done: progress/handin.ts); false: it pays out at once. */
  turnIn?: string | false;
  /** What the one it is handed in to says, before the reward. */
  thanks?: string[];
  /** Quests that must be done first (it starts by itself once they are). */
  after?: string[];
  /** Only once the hero has been to this region (its quests start when they first arrive). */
  zone?: RegionId;
  /** Only from this level. */
  level?: number;
  /** The level it pays its full XP to (set by the rebalance, data/progression.ts; the hero past it gets less). */
  xpLevel?: number;
  /**
   * Starts by itself (the story's own beats, tutorials) instead of waiting for the hero to accept it from
   * its giver.
   */
  auto?: boolean;
  /** What the giver says when offering it (else the quest's text). */
  offer?: string[];
  /**
   * One of a choice: the quests sharing this name are different answers to the same question, offered at
   * once; taking one closes the others for good (they count as done, so what comes after opens either way,
   * and the story remembers which was taken).
   */
  choice?: string;
  /**
   * What it pays. An item is a hand-made one (by its id), the smith's epic for the class, or one rolled for the class at
   * a rarity; a rolled one of the story can carry a name of its own (POLISH_PLAN.md piece 22: "Promise of the Held
   * Door", not "a rare item"), shown on the quest's page and given to the piece.
   */
  reward: { xp: number; gold: number; item?: string | { rarity: Rarity; name?: string }; unlock?: RegionId; tier?: number; text?: string; perk?: PerkId; keystone?: number };
  /** A land opened the moment the quest is taken (the way to where it leads: the Riftward, for the stone's quest). */
  opens?: RegionId;
}

/* -------------------------------------------------------------------- npcs */

export interface NpcDef {
  id: string;
  name: string;
  title: string;
  sprite: string;
  /** Lines by quest state, first matching wins ('started': offered, active or done). */
  talk: { when?: { quest: string; state: 'locked' | 'offered' | 'active' | 'ready' | 'done' | 'started' | 'taken' }; lines: string[] }[];
  /** What the NPC offers besides talk. */
  service?: 'respec' | 'smith' | 'waystone' | 'rift';
  /** A vendor: the shop they open, and its name over the door (else the shop's own name). */
  shop?: ShopId;
  shopName?: string;
  /** Colors swapped on the base sprite, so one sprite can dress several people. */
  pal?: Record<string, string>;
  /** Lies where they fell (the dying courier): drawn on the ground, and a long, slow fade when they go. */
  down?: boolean;
}
