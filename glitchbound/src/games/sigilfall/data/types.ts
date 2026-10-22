/**
 * The content schema: classes, skills, the modifiers that items and talents apply to skills, items,
 * talents, enemies, bosses, regions and quests. Everything here is plain data with stable string ids,
 * so content can grow without touching the simulation, and saves only ever store ids.
 */

import type { ShopId } from './vendors';

export type ClassId = 'mage' | 'warrior' | 'ranger' | 'warlock' | 'priest' | 'paladin' | 'druid';
export type DmgType = 'physical' | 'fire' | 'frost' | 'lightning' | 'poison' | 'arcane' | 'shadow' | 'holy' | 'nature';
export type StatusId = 'burn' | 'poison' | 'chill' | 'freeze' | 'shock' | 'stun' | 'root' | 'armorBreak' | 'mark' | 'weaken' | 'bleed' | 'curse' | 'fear';
export type SlotId = 'weapon' | 'offhand' | 'head' | 'chest' | 'legs' | 'hands' | 'feet' | 'amulet' | 'ring' | 'relic';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const SLOTS: SlotId[] = ['weapon', 'offhand', 'head', 'chest', 'legs', 'hands', 'feet', 'amulet', 'ring', 'relic'];

/** What a worn piece is made of (it decides how it looks on the hero). */
export type Material = 'cloth' | 'leather' | 'mail' | 'plate' | 'gold';
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

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
export type SlotKey = 'basic' | 's1' | 's2' | 's3' | 'ult' | 'dodge';
export const ACTION_SLOTS: SlotKey[] = ['basic', 's1', 's2', 's3', 'ult', 'dodge'];

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
  | { kind: 'nova'; radius: number; mul: number; dmgType?: DmgType; status?: { status: StatusId; dur: number; power: number } }
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
  /** Enemies within `radius` run away in fear for `dur` seconds (bosses are slowed instead). */
  | { kind: 'fear'; radius: number; dur: number }
  /** Calls `count` companions (PETS by id) for `dur` seconds (0 = until they fall). */
  | { kind: 'summon'; pet: string; count: number; dur: number }
  /** Costs the caster `pct`% of their max health (never below 1). */
  | { kind: 'sacrifice'; pct: number };

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
  /** Travel distance (projectiles, dashes, blink) or the farthest point a ground skill can be aimed. */
  range: number;
  cooldown: number;
  charges: number;
  damage: number;
  dmgType: DmgType;
  /** Seconds between pressing and the effect (a wind-up the player can see). */
  windup: number;
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
  /** Extra damage against enemies with a status, or below 30% health ('lowHp'). */
  bonusVs: { status: StatusId | 'lowHp'; pct: number }[];
  /** Extra damage when cast soon after a dodge. */
  afterDodge?: { window: number; pct: number };
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
  | { op: 'bonusVs'; status: StatusId | 'lowHp'; pct: number }
  | { op: 'afterDodge'; window: number; pct: number }
  /** More of the resource gained when used. */
  | { op: 'gen'; n: number }
  /** Costs `pct`% less of the resource. */
  | { op: 'cost'; pct: number };

/** A triggered effect with its own chance and internal cooldown. */
export interface ProcDef {
  /** Unique id: the internal cooldown is tracked per proc. */
  id: string;
  on: 'hit' | 'crit' | 'kill' | 'dodge' | 'hurt' | 'ult';
  /** Only hits of this damage type / from this skill / against enemies with this status count. */
  dmgType?: DmgType;
  skill?: string;
  status?: StatusId;
  chance: number;
  icd: number;
  effect: Effect;
  /** Plain-language description shown on the item. */
  text: string;
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
  /** The ability belongs to a druid shape: it is used there, not put on the normal bar. */
  formOnly?: boolean;
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
 * - holy: Holy Power, 0-5 points built by some skills and spent by others; fades out of combat.
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
  | 'emberwick'
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
  | 'riftspire';

/** What a letter on a region map stands for (the terrain under it is the region's floor). */
export type Marker =
  | { kind: 'start' }
  | { kind: 'pack'; enemies: string[]; elite?: boolean; named?: string; level?: number; rare?: boolean }
  | { kind: 'chest'; id: string; tier: 'common' | 'rare' | 'epic'; once?: boolean }
  | { kind: 'npc'; npc: string }
  | { kind: 'exit'; to: RegionId; label: string; minLevel?: number }
  | { kind: 'waystone' }
  | { kind: 'boss'; boss: string }
  | { kind: 'secret'; id: string }
  | { kind: 'shrine'; id: string }
  | { kind: 'dummy'; shooter?: boolean }
  | { kind: 'prop'; prop: string; solid?: boolean }
  | { kind: 'torch' }
  | { kind: 'checkpoint' }
  | { kind: 'hazard'; hazard: 'bramble' | 'spore' }
  /** A building drawn over its footprint (w x h tiles, the marker at its bottom-left), with a name over the door. */
  | { kind: 'building'; style: 'house' | 'tavern' | 'inn' | 'shop' | 'smithy' | 'temple' | 'keep' | 'tower' | 'hall' | 'lighthouse'; w: number; h: number; name?: string }
  /** A place to discover (an explore objective, a line in the log): walking within `r` tiles finds it. */
  | { kind: 'spot'; id: string; name: string; r: number };

/** A marker put at a tile by a zone generator, instead of a letter on the map. */
export interface PlacedMarkerDef {
  tx: number;
  ty: number;
  marker: Marker;
}

/** A room that seals its doors and spawns waves when the player walks in (dungeons). */
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
}

export interface RegionDef {
  id: RegionId;
  name: string;
  subtitle: string;
  theme: Theme;
  /** A town (safe), the wilds, or a dungeon (rooms, a boss at the end, difficulty tiers). */
  kind: 'town' | 'wild' | 'dungeon';
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
  /** What a generated zone holds, known without generating it (for routes between regions). */
  holds?: { exits: RegionId[]; npcs: string[]; spots: string[] };
  encounters: Encounter[];
  /** Where the camera starts when entering from the waystone / another region. */
  blurb: string;
}

export type MusicTrack = 'village' | 'forest' | 'crypt' | 'plains' | 'coast' | 'cave';

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
  | { kind: 'clear'; region: RegionId; tier: number; label: string };

/** Lasting gifts from the ends of quest chains; the seven sigils are the main story's. */
export type PerkId = 'mount' | 'satchel' | 'flask' | 'hearth' | SigilId;
export type SigilId = 'sigil-embers' | 'sigil-tides' | 'sigil-stone' | 'sigil-sun' | 'sigil-frost' | 'sigil-thorns' | 'sigil-veil';

export interface QuestDef {
  id: string;
  name: string;
  giver: string;
  /** Shown in the quest log. */
  text: string;
  objective: Objective;
  /** Quests that must be done first (it starts by itself once they are). */
  after?: string[];
  /** Only once the hero has been to this region (its quests start when they first arrive). */
  zone?: RegionId;
  /** Only from this level. */
  level?: number;
  reward: { xp: number; gold: number; item?: string | { rarity: Rarity }; unlock?: RegionId; tier?: number; text?: string; perk?: PerkId };
}

/* -------------------------------------------------------------------- npcs */

export interface NpcDef {
  id: string;
  name: string;
  title: string;
  sprite: string;
  /** Lines by quest state, first matching wins. */
  talk: { when?: { quest: string; state: 'locked' | 'active' | 'done' }; lines: string[] }[];
  /** What the NPC offers besides talk. */
  service?: 'respec' | 'smith' | 'waystone';
  /** A vendor: the shop they open, and its name over the door (else the shop's own name). */
  shop?: ShopId;
  shopName?: string;
  /** Colors swapped on the base sprite, so one sprite can dress several people. */
  pal?: Record<string, string>;
}
