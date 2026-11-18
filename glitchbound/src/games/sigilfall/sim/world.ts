import { campaignDone } from '../progress/wardrobe';
import { RIFT_CAP_UNFINISHED } from '../data/wardens';
import { SYNC_BELOW } from '../data/keystones';
import { dist, dist2, rng, TAU } from '../core/math';
import { BOSSES } from '../data/bosses';
import { CLASSES, hardening, HERO_DAMAGE, heroDamage, MAX_LEVEL, xpToNext } from '../data/classes';
import { ELITE_AFFIXES, ENEMIES, enemyScale } from '../data/enemies';
import { ITEM_DEFS, ITEMS } from '../data/items';
import { KEY_DEATH, keyLevelFor, KEY_MIN, keyCache, keyLoot, keyMarks, keyParFor, keyScale, keyUpgrade, type KeyAffix } from '../data/keystones';
import { QUEST_DEFS, QUESTS } from '../data/quests';
import { outlevelled } from '../data/progression';
import { SPEC_LEVEL } from '../data/talents';
import { REGIONS, RIFT_MODS, TIERS, type RiftMod } from '../data/regions';
import { isRetired } from '../data/retired';
import { THEMES } from '../data/themes';
import { BOSS_MARKS, GOLD_FIND } from '../data/vendors';
import type { ClassId, EliteAffix, Encounter, Item, Objective, QuestDef, RegionDef, RegionId, SkillSpec, SlotKey, StatusId } from '../data/types';
import { ACTION_SLOTS, SKILL_SLOTS } from '../data/types';
import type { Marker, RegionStateDef, StoryCond } from '../data/types';
import { holds, regionState, StoryDirector } from './story';
import { maybeStartScene, revealBoss, scenesPlayHere, updateScene, type ScenePlay } from './scene';
import { buildHero, type HeroBuild } from '../progress/build';
import { fogOpen, fogShare, loadFog, revealFog, storeFog, type Fog } from '../progress/fog';
import { turnInNpc } from '../progress/handin';
import { activeQuests, addItem, addXp, BAG_OVERFLOW, bagFull, bagSize, deliverHeld, giveReward, PERKS, potionCap, questEvent, sigilCount, SIGILS, startQuests, type Character, questState, HOME, currentObjective } from '../progress/character';
import { potionPrice } from '../progress/shop';
import { goldDrop, itemName, makeItem, rollLoot, rollRarity, salvageValue, type LootSource } from '../progress/items';
import { riftFirsts } from '../progress/rift';
import type { Settings } from '../progress/save';
import { learnLooks, riddenMount, ridingLocked, ridingOpen, shopMountsFor } from '../progress/wardrobe';
import { addParagonXp, paragonXp } from '../progress/paragon';
import { deathSound } from '../data/voices';
import { separate, updateEnemy, updatePuppet } from './ai';
import { refreshPets, summonPet, updatePets } from './pets';
import { spawnFolk, updateFolk, type Folk } from './folk';
import { herdOf, letOut, updateCritters, type Critter } from './critters';
import { updateCasting, updateChannel, updateDash, updateFields, updateProjectiles, updateTraps, updateWindup, tryCast, type CastRequest } from './cast';
import { blowFloor, healPlayer, hurtPlayer, playerSlow, playerStunned, tickPlayerStatuses } from './combat';
import { breakWall, circleHitsWall, flowField, K, markerPos, moveCircle, parseRegion, pushOut, setDoors, TILE, tileAt, type PlacedMarker, type TileMap } from './map';
import type { Chest, CoopSide, Drop, Enemy, Field, FloatText, Fx, Ghost, Interactable, NpcActor, Pet, Player, Projectile, Telegraph, Trap, Wave, WorldEvent, Callout } from './types';
import { inCone, inLine } from '../core/math';

/** What the input adapters hand the world every frame. */
export interface InputFrame {
  /** Movement, length 0..1. */
  mx: number;
  my: number;
  /** Aim angle from the mouse (desktop) or null (touch: the hero faces where they move). */
  aim: number | null;
  /** World point under the mouse (desktop ground aiming). */
  aimX: number | null;
  aimY: number | null;
  casts: CastRequest[];
  /** Basic attack held down: keeps attacking as its cooldown allows. */
  holdBasic: CastRequest | null;
  potion: boolean;
  interact: boolean;
  /** The mount key or button was pressed. */
  mount?: boolean;
}

export const emptyInput = (): InputFrame => ({ mx: 0, my: 0, aim: null, aimX: null, aimY: null, casts: [], holdBasic: null, potion: false, interact: false });

export interface WorldOptions {
  region: RegionId;
  tier: number;
  mods: RiftMod[];
  hero: Character;
  settings: Settings;
  seed: number;
  /** The region the hero came from (arrive at the exit that leads back there). */
  from?: RegionId;
  /** Finished quests wait to be handed in (the game); false pays them out at once (story tests that skip the talk). */
  handIns?: boolean;
  /** A Riftstone run at this stone level (dungeons only), with the week's affixes for it. */
  key?: number;
  affixes?: KeyAffix[];
  /** In a co-op party (net/coop.ts): the host's world runs the enemies; a guest's mirrors them. */
  coop?: 'host' | 'guest';
  /** Stages each step of the main story with a beat of its own (sim/scene.ts questBeat): the game; tests leave it off. */
  beats?: boolean;
  /**
   * Nothing found here is kept, so nothing is dropped: no gear, no Rift cache, no Rift-forged pieces. A Rift Trial's
   * ready hero is thrown away at the end of the run (progress/trial.ts; the owner: "make it so the insta riftstone mode
   * doesnt drop items").
   */
  noLoot?: boolean;
}

/** Seconds as m:ss. */
export const clockText = (t: number): string => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** A Riftstone run: its clock (seconds so far and falls), and how it ended. */
export interface KeyRun {
  key: number;
  affixes: KeyAffix[];
  par: number;
  t: number;
  deaths: number;
  end: { time: number; up: number; marks: number; stone: number; best: boolean; forged?: string[] } | null;
  /** The hero's level when the run began: below SYNC_BELOW the stone meets them at their own strength. */
  heroLevel: number;
  /** The clock is running: from the hero's first step or blow, not while the land loads and the run's card is read. */
  going?: boolean;
}

interface EncounterState {
  def: Encounter;
  index: number;
  state: 'idle' | 'active' | 'cleared';
  wave: number;
  waveT: number;
}

interface Spore {
  x: number;
  y: number;
  ripe: boolean;
  t: number;
  fuse: number;
  friendly: boolean;
}

/** Seconds the people the story takes away are remembered: long enough for the slowest fade (a death). */
const LEFT_FOR = 4;
/** How slow slow motion is. */
const SLOW = 0.3;
const POTION_HEAL = 40;
/** Seconds without fighting before the fast out-of-combat regeneration starts. */
const CALM_AFTER = 3;
/** Enemies further than this from the hero (and not fighting) sleep. */
const SLEEP_X = 460;
const SLEEP_Y = 320;
/** A wiped-out pack comes back only out of sight. */
const RESPAWN_CLEAR_X = 300;
const RESPAWN_CLEAR_Y = 220;
/** Seconds before a wiped-out pack comes back (named enemies take longer). */
const RESPAWN_TIME = 100;
const RESPAWN_RARE = 300;
/** A named foe a quest is waiting for (killed before the quest asked) is back this soon. */
const RESPAWN_WANTED = 20;
/** Discovering a sight pays this share of a level. */
const EXPLORE_XP = 0.03;
/**
 * The fewest seconds a full ultimate bar can take in sustained combat: 40 at level 3, 60 at 30, 70 from 50. Hits charge
 * the bar against a typical attack of the hero's level, and from the 20s on gear and talents make hits far bigger than
 * that: without a floor the ultimate would come every couple of hits. The charge budget refills at one bar per this
 * many seconds, and everything that charges the bar (hits, the trickle in a fight, procs) draws on it. Two thirds
 * slower than it was (the owner: "it seems the ultimate fills fast as heck"): at 36 s, with the trickle on top and 70%
 * of a bar banked by any lull, it came round every half minute, and a pack seldom lasted longer than that.
 */
export const ultFloor = (level: number): number => (level <= 3 ? 40 : level <= 30 ? 40 + ((level - 3) * 20) / 27 : Math.min(70, 60 + ((level - 30) * 10) / 20));
/** The most of a bar of ultimate charge (%) a lull banks for the next fight (the rest is earned at the usual pace). */
export const ULT_BANK = 35;
/** Ultimate charge (% of a bar) a second of fighting brings by itself, out of the same budget. */
export const ULT_TRICKLE = 0.5;
/**
 * How much faster a skill's cooldown runs with the hero's haste: half of it, and no more than 50% faster. Gear brings
 * haste to 80% by level 30 and 160% at the top; counted in full it took a Fireball's three seconds down to under one,
 * and a skill came round as often as the basic attack (the owner: "cooldowns are short and makes me feel like fireball
 * for example is not that great and different than the basic attack"). The basic attack keeps its own rule (BASIC_HASTE),
 * the dodge is sped by haste in full as it always was (every boss's dance was set against it: a level 60 mage on a
 * slower dodge died eight to fourteen times to Vaelor where it had died none), and mana, focus and energy come back as
 * fast as ever.
 */
export const SKILL_HASTE_SHARE = 0.5;
export const SKILL_HASTE_MAX = 50;
export const skillHaste = (haste: number): number => 1 + Math.min(SKILL_HASTE_MAX, Math.max(0, haste) * SKILL_HASTE_SHARE) / 100;
/** How fast a slot's cooldown runs with this much haste (what the bars count down by). */
export const slotHaste = (slot: string, haste: number): number => (slot === 'basic' ? 1 + Math.min(Math.max(0, haste), BASIC_HASTE) / 100 : slot === 'dodge' ? 1 + Math.max(0, haste) / 100 : skillHaste(haste));
/** The most haste (%) speeds the basic attack: a quarter (it was 60, and gear made the bolts a machine gun). */
export const BASIC_HASTE = 25;
/**
 * How fast a hero goes on foot, in world pixels a second, before what their gear adds. Walking the land is a twelfth
 * slower than it was (the owner: "slow down the character a bit but keep mount speed the same"). In a fight a hero
 * is as quick as ever: every boss's dance and every pack's chase was set against 78, and with a slower hero the
 * play-throughs lost fights they had won (a mage fell to the Royal Auditor fifty times). A fight is a boss on the
 * field, or a blow given or taken in the last few seconds (Player.calm); the pace eases down as it ends. A mount is
 * as fast as it ever was (78 × 1.3), so riding is worth more than it was.
 */
export const WALK_SPEED = 72;
export const FIGHT_SPEED = 78;
export const RIDE_SPEED = 78 * 1.3;
/** How long after the last blow the pace takes to ease from a fight's to a walk's. */
const PACE_EASES = 1.5;
/** Riding: one speed for every mount (blueprint §6.4: no "best mount"), as a share of walking. */
export const MOUNT_SPEED = RIDE_SPEED / WALK_SPEED;
/** A quest's thing on the ground comes to a hero this near (world pixels), and to one anywhere after this long (seconds). */
export const QUEST_DRAW = 70;
export const QUEST_WAIT = 8;
/** Calling a mount takes this long, standing still. */
export const SUMMON_TIME = 0.6;
/**
 * The packs of the open lands are tougher than a dungeon's and pay less each: they come back, and the
 * road to 60 is meant to be long (quests and dungeons are the way up, not standing in a field).
 */
const WILD = { hp: 1.8, dmg: 1.15, xp: 0.5 };

/**
 * How hard foes hit, on top of their level, the difficulty and the measures below. The owner (2026-11-15): "all the
 * different bosses' abilities don't really matter whether they hit you or not, we want this to matter ... the beam
 * spell he did hurt me for around 10% of my health, we want every boss, every mob to feel challenging and intimidating
 * with huge damage spike". A boss does everything it does through its patterns, each one shown before it lands, so a
 * boss's blows are the kind a player can step out of: they are raised the most, and each takes at least its floor of the
 * hero's own health however well they are dressed (sim/combat.ts BLOW_FLOOR: a third or more for a heavy one), so two in
 * a row can end the fight. What wears a hero down instead stays as it was: its
 * barrages (a fan of spears, a ring of orbs: many shots to weave through), the ground it leaves burning or poisoned,
 * and the burns and poisons its blows leave on the hero (spawnProjectile, spawnField, wearing). Raised with the rest,
 * those were what the play-bot fell to dozens of times over, a chip at a time, not a blow it could have stepped out of.
 * The rank and file hit harder too, and the blows they wind up for (a caster's circle, a brute's slam, a swell about to
 * burst, sim/ai.ts) harder still; but not those standing in a boss's room, whose threat is the boss.
 */
export const BOSS_DAMAGE = 1.5;
export const MOB_DAMAGE = 1.5;
/**
 * A boss's health against the hero's blows (HERO_DAMAGE): every hero hits half as hard as they did, and a boss, with
 * everything in its room, has half the health it had, so its fight lasts as long as it always did. What changed is how
 * much its blows hurt. Not longer as well: what a fight takes out of a hero is how hard the boss hits times how long it
 * lasts, and a boss's own clock (leeches that drink while they cling, adds that come every so often, a ward to break in
 * time) was set against fights of this length. The play-bot that walked every dungeon fell dozens of times in each with
 * both raised at once.
 */
export const BOSS_HEALTH = HERO_DAMAGE;
/**
 * The three at a foe's level, as far into the harder game as it is (data/classes.ts hardening). A boss's blows grow to
 * all of BOSS_DAMAGE more slowly, by level 30: the first dungeons' bosses already hit a hero hard for their health.
 */
export const bossDamage = (level: number): number => 1 + (BOSS_DAMAGE - 1) * Math.max(0, Math.min(1, (level - 4) / 26));
export const mobDamage = (level: number): number => 1 + (MOB_DAMAGE - 1) * hardening(level);
/** The potions a hero rises with, at least, in a story dungeon (World.respawn). */
export const RISE_POTIONS = 2;

export const bossHealth = (level: number): number => 1 - (1 - BOSS_HEALTH) * hardening(level);

/**
 * The campaign is meant to be hard: a fight can be lost, and done again from the last checkpoint. The first levels
 * (the night Briarhollow burns, the first wood) stay as they were, to learn in; from level 4 foes grow tougher, to
 * 30% more health and 40% more damage by level 7 (bosses 40% and 45%). Heroic, Mythic and Riftstone runs, hard by
 * choice, keep their own measure.
 */
export function challenge(level: number, boss: boolean): { hp: number; dmg: number } {
  const k = Math.max(0, Math.min(1, (level - 3) / 4));
  return boss ? { hp: 1 + 0.4 * k, dmg: 1 + 0.45 * k } : { hp: 1 + 0.3 * k, dmg: 1 + 0.4 * k };
}
const NO_CHALLENGE = { hp: 1, dmg: 1 };

/** The first dungeon a hero meets (the crypt under Briarhollow's chapel, on the first night). */
export const FIRST_DUNGEON: RegionId = 'crypt';
/**
 * A dungeon asks a little more than the road to it, and more the deeper into the story it lies (the owner's call
 * after the first full play-through, 2026-11-12). Measured with the play-bot at the level the story brings a hero in:
 * the early dungeons already cost it falls, and from the Rimeheld Vault on it walked every one without a fall, often
 * never under half its health. So everything in an early dungeon hits 3% harder and has 2% more health, and from
 * level 26 that grows, to 15% and 12% by the level-50 dungeons. The Chapel Crypt goes the other way: a new hero
 * meets their first boss there at level 4 in what they were given, and its blows land 5% lighter. As with
 * `challenge`, this is the campaign's own measure: Heroic, Mythic and Riftstone runs keep theirs.
 */
export function depth(region: Pick<RegionDef, 'id' | 'kind' | 'level'>): { hp: number; dmg: number } {
  if (region.kind !== 'dungeon') return NO_CHALLENGE;
  if (region.id === FIRST_DUNGEON) return { hp: 1, dmg: 0.95 };
  const k = Math.max(0, Math.min(1, (region.level - 26) / 24));
  return { hp: 1.02 + 0.1 * k, dmg: 1.03 + 0.12 * k };
}

/** A pack in the open: where it stands, what it is, and when it comes back. */
interface PackState {
  index: number;
  enemies: string[];
  x: number;
  y: number;
  level: number;
  elite: boolean;
  rare: boolean;
  ids: number[];
  /** Seconds until it comes back once wiped out (−1 while any of it lives). */
  respawnT: number;
  /** Only while the story allows (a blockade, the dead at a shrine): once not, it is gone for good. */
  cond?: StoryCond;
  gone?: boolean;
  /** A quest wants it back: it returns soon, and even in sight of the hero (it rises out of the ground). */
  called?: boolean;
}
/** Out of combat: health and mana regained per second, as a share of the maximum. */
const OUT_OF_COMBAT_HP = 0.1;
const OUT_OF_COMBAT_MANA = 0.2;

export class World {
  region: RegionDef;
  map: TileMap;
  tier: number;
  mods: RiftMod[];
  level: number;
  hero: Character;
  settings: Settings;
  build: HeroBuild;
  player: Player;
  input: InputFrame = emptyInput();

  enemies: Enemy[] = [];
  pets: Pet[] = [];
  projectiles: Projectile[] = [];
  fields: Field[] = [];
  telegraphs: Telegraph[] = [];
  waves: Wave[] = [];
  traps: Trap[] = [];
  drops: Drop[] = [];
  chests: Chest[] = [];
  npcs: NpcActor[] = [];
  /** The people the story has just taken from where they stood, and when (World.time): they fade out. */
  leftNpcs: (NpcActor & { left: number })[] = [];
  spores: Spore[] = [];
  texts: FloatText[] = [];
  /** What the boss is doing, as its bar says it (callout below). */
  shout: Callout | null = null;
  fx: Fx[] = [];
  encounters: EncounterState[] = [];
  /** The boss whose turn it is, while its patterns run (sim/ai.ts): what it shoots is a barrage, not a blow (spawnProjectile). */
  bossActing: Enemy | null = null;
  /** The boss patterns whose blow has already taken its floor of the hero's health (sim/combat.ts BLOW_FLOOR), and a count to number them. */
  floorPaid = new Set<number>();
  private floorSerial = 0;
  delayed: { t: number; fn: () => void }[] = [];
  /** How far a boss fight has the room under water (0 dry, 1 flooded): the Drowned Priestess's flood, drawn as a sea-green wash. */
  flooded = 0;
  /** How dark a boss fight has the hero's corner of the room (0 lit, 1 dark): Gloomwing's devoured lamps, drawn as a gloom. */
  dimmed = 0;
  /**
   * A boss's standing order to the hero, while it is called and while it holds: 'hold' (not a step until it ends) or
   * 'march' (no standing still). Hallvor's watch (sim/patterns/rimeheld-vault.ts); shown under the boss bar.
   */
  order: { kind: 'hold' | 'march'; from: number; until: number } | null = null;
  /**
   * What a boss fight casts of the hero, walking where the hero walked a moment ago (Ossa's likenesses,
   * sim/patterns/molten-throne.ts): drawn as the hero in white-hot bone-steel.
   */
  likenesses: { x: number; y: number; vx: number; vy: number; face: number }[] = [];
  /**
   * How weightless a boss fight has made the hero (0 not at all, 1 adrift): Ilvane's gallery (sim/patterns/spire-of-the-rift.ts).
   * Adrift, the hero is slow to start and slow to stop (a dodge still pushes off the air at once).
   */
  unmoored = 0;
  /** Seconds left of grief turning the hero around (Lady Cendre's keening): their movement goes the other way. */
  inverted = 0;
  /** Seconds the hero has pushed to move and been held fast on every side (see updatePlayer). */
  private snagT = 0;
  /** Where the hero was last eased out to (updatePlayer): they are eased out once for a place. */
  private snagAt: { x: number; y: number } | null = null;
  /** Things a boss fight floats in the air (Ilvane's stones): drawn as props off the ground. */
  floaters: { m: string; x: number; y: number; lift: number; h: number; rot: number; tint?: readonly [number, number, number] }[] = [];
  /**
   * The people of a memory a boss fight walks through the hall (the Hallow King's queen and children, coming to him in
   * his summer hour: sim/patterns/hallow-king.ts), wearing the looks of the NPCs named: drawn pale, as echoes are.
   */
  kin: { look: string; x: number; y: number; /** Which way they walk (radians, as an enemy faces). */ face: number; since: number }[] = [];
  /** The sigils set in a boss's crown while it holds them (the Hallow King's: sigil ids), shown under its bar. */
  crown: string[] | null = null;
  events: WorldEvent[] = [];
  procCd: Record<string, number> = {};
  flow: Int16Array;
  private flowTile = -1;
  private flowT = 0;

  time = 0;
  nextId = 1;
  rand: () => number;
  shakeAmt = 0;
  hitstopT = 0;
  /** Slow motion (a boss's last blow, a story fight's last foe): seconds left (real time), and what it's on. */
  slowT = 0;
  slowAt: { x: number; y: number } | null = null;
  /** Someone telling the hero their part of the story, face to face (the camera frames the two of them). */
  talkTo: { x: number; y: number } | null = null;
  checkpoint: { x: number; y: number };
  /** The final boss is down: the exit portal is open. */
  cleared = false;
  portal: { x: number; y: number } | null = null;
  /** The boss being fought (for the health bar). */
  bossId: number | null = null;
  interactable: Interactable | null = null;
  /** When "Not enough mana" was last said (it isn't repeated every frame). */
  noManaAt = -99;
  /** When "Stand still to cast" was last said. */
  castHintAt = -99;
  /** How the last cast ended, for the cast bar's last moment: when, and whether the spell went off. */
  castEnd: { at: number; fired: boolean } | null = null;
  private exitInside = -1;
  /** The hero just stepped onto an exit: the engine offers to travel. */
  pendingExit: Interactable | null = null;
  /** The scene playing (sim/scene.ts), or null. */
  scene: ScenePlay | null = null;
  private sceneCheck = 0;
  waystones: { x: number; y: number }[] = [];
  exits: { x: number; y: number; to: RegionId; label: string; minLevel?: number; needs?: string; door?: boolean }[] = [];
  shrines: { x: number; y: number; id: string }[] = [];
  /** Places to discover (sights in the wilds). */
  spots: { x: number; y: number; id: string; name: string; r: number }[] = [];
  /** Packs in the open, so they can come back a while after they are killed. */
  packs: PackState[] = [];
  /** Finished quests wait to be handed in (WorldOptions.handIns). */
  readonly handIns: boolean;
  /** Story beats for the main quests (WorldOptions.beats). */
  readonly beats: boolean;
  /**
   * The story's pages are waiting to be read (what just happened, a letter found, a sigil won: engine.ts): no scene
   * starts until they have been, so the tale is told in its order.
   */
  holdScenes = false;
  /** The maps' fog of war here (progress/fog.ts), and the cells with ground under them. */
  fog!: Fog;
  private fogOpen!: Uint8Array;
  private fogT = 0;
  /** The pack markers that have their enemies (a conditional one gets them when it first shows). */
  private readonly packed = new Set<TileMap['markers'][number]>();
  props: { x: number; y: number; prop: string }[] = [];
  /** The animals of the place (sim/critters.ts): hens, sheep, a dog about the square. Decoration, on their own random numbers. */
  critters: Critter[] = [];
  /** Where the place is under attack this frame, for its animals to run from (updateAmbient). */
  private readonly trouble: { x: number; y: number }[] = [];
  private readonly critterRand: () => number;
  /** The weather's own dice: what falls through the air is only a picture, and never moves the fight's. */
  private readonly weatherRand: () => number;
  /** The people of the place going about their day (sim/folk.ts): decoration, on their own random numbers. */
  folk: Folk[] = [];
  private folkRand: () => number = () => 0.5;
  private readonly folkAround: { x: number; y: number }[] = [];
  private readonly folkSeed: number;
  /** This run's tallies (for the report and the reward screen). */
  run = { xp: 0, gold: 0, kills: 0, bosses: 0, items: [] as Item[] };
  /** The story here: the region's state, its events, the lines people say (sim/story.ts). */
  story!: StoryDirector;
  storyState: RegionStateDef | null = null;
  /** Goes up whenever the story changes what stands in the region (the renderer rebuilds its scenery). */
  stateVersion = 0;
  /** Which conditional markers are showing (by map letter), so a change is noticed. */
  private shownKey = '';
  /** Flames on roofs and beams while the region burns. */
  /** Burning roofs; `born` is when each caught (world seconds), so a roof catching is seen to catch. */
  fires: { x: number; y: number; size: number; born: number }[] = [];
  /** When each roof (by tile) first caught here: a story state rebuilt keeps a fire already burning. */
  private fireBorn = new Map<number, number>();
  /** Flocks of hens already let out (by marker tile). */
  private readonly flocks = new Set<number>();
  /** Enemies hit so far this step (an area that strikes many charges the ultimate for the first one only). */
  ultHits = 0;
  /** Plumes the story shows (wisp markers): grieflight, marsh-rot. */
  wisps: { x: number; y: number; color: string; size: number }[] = [];
  /** Named points the story uses (events' places). */
  places: Record<string, { x: number; y: number }> = {};
  private bramble = 0;
  private hpBefore = 0;
  /** A Riftstone run, if this is one. */
  keyRun: KeyRun | null = null;
  /** Nothing found is kept, so nothing drops (WorldOptions.noLoot: a Rift Trial). */
  readonly noLoot: boolean;
  /** A co-op party (net/coop.ts): the other heroes, and what to send them. Null playing alone. */
  coop: CoopSide | null = null;
  /**
   * Questing together (net/coop.ts): the leader's story, which this world shows (who stands where, what is
   * built, which foes are out), so a hero ahead in the story is phased into the world of the one behind.
   * Null: the hero's own. Only what is shown follows it; quests, rewards and talk stay the hero's own.
   */
  layer: Character | null = null;

  /** Whose story the land shows: the leader's when questing together, else the hero's. */
  get storyHero(): Character {
    return this.layer ?? this.hero;
  }

  /** A co-op guest's world: its enemies are the host's, mirrored (none of its own spawn, think or strike). */
  get puppet(): boolean {
    return this.coop?.role === 'guest';
  }
  /** Festering pools: blood that heals enemies standing in it. */
  private pools: { x: number; y: number; r: number; t: number }[] = [];
  /** Enemies already in a rage (Cornered). */
  private raged = new WeakSet<Enemy>();

  constructor(o: WorldOptions) {
    this.noLoot = !!o.noLoot;
    this.handIns = o.handIns ?? true;
    this.beats = o.beats ?? false;
    if (o.coop) this.coop = { role: o.coop, ghosts: [], out: [] };
    this.region = REGIONS[o.region];
    this.map = parseRegion(this.region);
    this.tier = this.region.safe ? 0 : o.tier;
    this.mods = this.region.safe ? [] : o.mods;
    this.level = this.region.level + TIERS[this.tier]!.levels;
    // Riftstone: the dungeon at Mythic's top level, the stone's might and the week's affixes
    if (o.key && o.key >= KEY_MIN && this.region.kind === 'dungeon') {
      const affixes = o.affixes ?? [];
      this.keyRun = { key: o.key, affixes, par: keyParFor(this.region, o.hero.level), t: 0, deaths: 0, end: null, heroLevel: o.hero.level };
      this.tier = 2;
      this.level = keyLevelFor(o.hero.level);
      this.mods = affixes.filter((a): a is 'volatile' | 'hasted' => a === 'volatile' || a === 'hasted');
    }
    this.hero = o.hero;
    this.settings = o.settings;
    this.rand = rng(o.seed);
    this.folkSeed = o.seed;
    this.critterRand = rng(o.seed ^ 0x3c1d);
    this.weatherRand = rng(o.seed ^ 0x5eed);
    this.build = buildHero(o.hero);
    this.flow = new Int16Array(this.map.w * this.map.h);
    this.encounters = this.region.encounters.map((def, index) => ({ def, index, state: 'idle', wave: 0, waveT: 0 }));
    const start = this.map.markers.find((m) => m.marker.kind === 'start');
    let spawn = start ? markerPos(start) : { x: this.map.w * 8, y: this.map.h * 8 };
    // arriving through an exit: appear just inside the exit that leads back where we came from
    if (o.from) {
      const back = this.map.markers.find((m) => m.marker.kind === 'exit' && m.marker.to === o.from);
      // (out of a house, or up out of a deep place: in front of its door, which faces south. Beside it, the way on can
      // lie straight back across the door's own tile, and the hero walks in again)
      const south = back?.marker.kind === 'exit' && (back.marker.door ? !this.region.interior : this.region.kind !== 'dungeon' && REGIONS[o.from]?.kind === 'dungeon');
      if (back) spawn = this.insideOf(markerPos(back), south ? [0, 1] : back.marker.kind === 'exit' && back.marker.door ? [0, -1] : undefined);
    }
    this.checkpoint = { ...spawn };
    this.storyState = regionState(this.region, this.storyHero);
    this.story = new StoryDirector(this);
    this.shownKey = this.shownMarkers();
    this.player = this.newPlayer(spawn.x, spawn.y);
    this.spawnContent();
    this.resetFolk();
    this.callCompanions();
    // the maps' fog of war: rooms indoors are small enough to know at a glance
    this.fog = loadFog(this.hero, this.region.id, this.map.w, this.map.h);
    if (this.region.interior) this.fog.all = true;
    this.fogOpen = fogOpen(this.fog, this.map.solid, this.map.w);
    this.lookAround();
  }

  /** Lifts the maps' fog round the hero, and keeps what was seen on the hero (saved with them). */
  private lookAround(): void {
    if (revealFog(this.fog, this.player.x / TILE, this.player.y / TILE)) storeFog(this.hero, this.region.id, this.fog);
  }

  /** How much of this land the hero has explored (0..1). */
  explored(): number {
    return fogShare(this.fog, this.fogOpen);
  }

  /** Companions that stay (the wolf, the imp) come along into every region: the ones on the bar are called at once. */
  private callCompanions(): void {
    for (const slot of SKILL_SLOTS) {
      const id = this.build.bar[slot];
      const spec = id ? this.build.skills[id]?.spec : undefined;
      if (spec?.cast !== 'summon') continue;
      for (const e of spec.onCast) if (e.kind === 'summon' && e.dur === 0) summonPet(this, e.pet, e.count, 0);
    }
  }

  /* ------------------------------------------------------------- setup */

  private newPlayer(x: number, y: number): Player {
    const cds = {} as Player['cds'];
    for (const slot of ACTION_SLOTS) cds[slot] = { t: 0, charges: 1, max: 1, cd: 1 };
    const p: Player = {
      x,
      y,
      vx: 0,
      vy: 0,
      r: 5,
      aim: 0,
      dir: 0,
      hp: this.build.maxHp,
      maxHp: this.build.maxHp,
      // mana, energy and focus start full; rage and Zeal are earned in the fight
      mana: this.build.resource?.kind === 'rage' || this.build.resource?.kind === 'holy' ? 0 : this.build.maxMana,
      maxMana: this.build.maxMana,
      shield: 0,
      shieldT: 0,
      iframe: 0.5,
      guard: 0,
      guardPow: 0,
      dash: null,
      windup: null,
      casting: null,
      channel: null,
      buffs: [],
      form: null,
      cds,
      ult: 0,
      // what a hero carries into a land (the engine passes on what was left from the last one)
      ultBudget: ULT_BANK,
      combo: 0,
      comboT: 0,
      lastDodge: -99,
      lastHurt: -99,
      calm: 99,
      statuses: [],
      potionT: 0,
      healBudget: 0,
      healBudgetT: 0,
      dead: false,
      deadT: 0,
      walkT: 0,
      actT: 0,
      actAngle: 0,
      actKind: null,
      actBig: false,
      actN: 0,
      actSkill: null,
      flash: 0,
      riding: null,
      summon: 0,
    };
    this.player = p;
    this.syncCooldowns(true);
    return p;
  }

  /** A walkable spot a tile or so in from an exit tile. */
  /** A free spot a step from an exit, toward the middle of the map (so arriving doesn't stand on it). */
  private insideOf(pt: { x: number; y: number }, first?: [number, number]): { x: number; y: number } {
    const cx = (this.map.w * TILE) / 2 - pt.x;
    const cy = (this.map.h * TILE) / 2 - pt.y;
    const dirs = (
      [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ] as const
    )
      .map(([dx, dy]) => ({ dx, dy, toward: first && dx === first[0] && dy === first[1] ? Infinity : dx * cx + dy * cy }))
      .sort((a, b) => b.toward - a.toward);
    for (const step of [2.5, 1.5]) {
      for (const { dx, dy } of dirs) {
        const x = pt.x + dx * TILE * step;
        const y = pt.y + dy * TILE * step;
        const i = tileAt(this.map, x, y);
        if (i >= 0 && !this.map.solid[i] && this.map.kind[i] !== K.Water) return { x, y };
      }
    }
    return pt;
  }

  /** Whether a marker shows in the story's current state (markers without a condition always do). */
  /** Whether a marker stands in the story's current state (the renderer asks too). */
  isShown(pm: { ch: string; when?: StoryCond }): boolean {
    return this.shown(pm);
  }

  private shown(pm: { ch: string; when?: StoryCond }): boolean {
    const cond = pm.when ?? this.region.when?.[pm.ch];
    return !cond || holds(this.storyHero, cond);
  }

  private shownMarkers(): string {
    return this.map.markers.map((pm) => (pm.when || this.region.when?.[pm.ch] ? (this.shown(pm) ? '1' : '0') : '')).join('');
  }

  /**
   * The story moved on: the region's state and which conditional markers show. People come and go at
   * once; what is built (props, fires, ruins) is redrawn by the renderer when `stateVersion` changes.
   */
  refreshStoryState(): void {
    const s = regionState(this.region, this.storyHero);
    const key = this.shownMarkers();
    if (s?.id === this.storyState?.id && key === this.shownKey) return;
    this.storyState = s;
    this.shownKey = key;
    this.stateVersion += 1;
    const was = this.npcs;
    this.npcs = [];
    this.fires = [];
    this.wisps = [];
    this.props = [];
    this.spots = [];
    this.exits = [];
    for (const pm of this.map.markers) {
      const m = pm.marker;
      const on = this.shown(pm);
      // a conditional prop blocks only while it stands
      if (pm.body) pm.body.off = !on;
      if (m.kind === 'prop' && m.solid && this.map.kind[pm.ty * this.map.w + pm.tx] === K.Prop && (pm.when || this.region.when?.[pm.ch])) {
        const i = pm.ty * this.map.w + pm.tx;
        this.map.solid[i] = on ? 1 : 0;
        this.map.block[i] = on ? 1 : 0;
      }
      if (!on) continue;
      const pos = markerPos(pm);
      if (m.kind === 'npc') this.npcs.push({ id: m.npc, ...this.besideThings(pos), face: 0, bob: this.rand() * TAU });
      if (m.kind === 'prop') this.addProp(pm, pos);
      // a stair that opens, a road that comes with the story, a place to find
      if (m.kind === 'spot') this.spots.push({ ...pos, id: m.id, name: m.name, r: m.r });
      if (m.kind === 'exit') this.exits.push({ ...pos, to: m.to, label: m.label, ...(m.minLevel ? { minLevel: m.minLevel } : {}), ...(m.needs ? { needs: m.needs } : {}), ...(m.door ? { door: true } : {}) });
      if (m.kind === 'fire' && s?.burning) this.addFire(pm, pos, m.size, m.delay);
      if (m.kind === 'wisp') this.wisps.push({ ...pos, color: m.color, size: m.size });
      // a foe the story brings in now (Vosk at the head of the Host, once the Standard falls)
      if (m.kind === 'pack' && !this.packed.has(pm)) this.addPack(pm, pos, true);
    }
    // who stays keeps their footing; who comes, comes in (a fade); who goes, goes out (sim/story.ts takes the
    // ones stepping out to fight)
    const same = (a: NpcActor, b: NpcActor): boolean => a.id === b.id && a.x === b.x && a.y === b.y;
    for (const n of this.npcs) {
      const kept = was.find((m) => same(m, n));
      if (kept) Object.assign(n, { face: kept.face, bob: kept.bob, since: kept.since, fell: kept.fell });
      else n.since = this.time;
    }
    const gone = was.filter((n) => !this.npcs.some((m) => same(m, n))).map((n) => ({ ...n, left: this.time }));
    this.leftNpcs = [...this.leftNpcs.filter((n) => this.time - n.left < LEFT_FOR), ...gone];
    this.resetFolk();
    // those the story has sent away (the blockade broken, the dead laid to rest) go now
    for (const st of this.packs) {
      if (!st.cond || st.gone || holds(this.storyHero, st.cond)) continue;
      st.gone = true;
      for (const e of this.enemies) {
        if (!st.ids.includes(e.id) || e.dead || e.aggro) continue;
        e.dead = true;
        e.deathT = 0;
        this.addFx({ kind: 'smoke', x: e.x, y: e.y, life: 0.6, size: 8, color: '#8a8494' });
      }
    }
  }

  /**
   * The people come out (or go in): in a town, or round a village's square, while the place is calm (not at
   * night, burning or under a gloom; never indoors or underground).
   */
  private resetFolk(): void {
    const st = this.storyState;
    const calm = !this.region.interior && this.region.kind !== 'dungeon' && !this.dark && !st?.burning && !st?.gloom;
    if (this.region.interior || this.region.kind === 'dungeon') {
      this.folk = [];
      return;
    }
    const squares = this.map.markers.filter((pm) => pm.marker.kind === 'waystone').map(markerPos);
    const r = spawnFolk(this.map, this.folkSeed, this.region.kind === 'town', this.region.kind === 'town' ? null : squares, (pm) => this.shown(pm));
    // (villagers keep indoors at night and while a place burns: a camp's guards stand their posts through both)
    // (and the people at their work go in with the rest: only the soldiers stay out)
    this.folk = calm ? r.folk : r.folk.filter((f) => f.posted && f.soldier);
    this.folkRand = r.rand;
  }

  /** Is the region at peace right now? (A village under attack is not.) */
  get safe(): boolean {
    return this.region.safe && !this.story.fighting;
  }

  /** Night has fallen here (the story's state), or the place is dark anyway. */
  get dark(): boolean {
    return this.region.dark || !!this.storyState?.night;
  }

  /** The label of the quest objective an event belongs to (for its banner). */
  questLabel(event: string): string {
    for (const id of Object.keys(this.hero.quests)) {
      const d = QUEST_DEFS[id];
      const o = d && [d.objective, ...(d.then ?? [])].find((x) => x.kind === 'event' && x.event === event);
      if (o) return o.label;
    }
    return '';
  }

  /** A pack marker's enemies, kept track of so they come back (rising out of the ground when the story calls them in). */
  private addPack(pm: TileMap['markers'][number], pos: { x: number; y: number }, rise: boolean): void {
    const m = pm.marker as Extract<Marker, { kind: 'pack' }>;
    const level = this.keyRun ? this.level : m.level !== undefined ? m.level + TIERS[this.tier]!.levels : this.level;
    const cond = pm.when ?? this.region.when?.[pm.ch];
    const st: PackState = { index: this.packs.length + 1, enemies: m.enemies, x: pos.x, y: pos.y, level, elite: !!m.elite, rare: !!m.rare, ids: [], respawnT: -1, ...(cond ? { cond } : {}) };
    this.packs.push(st);
    this.packed.add(pm);
    this.spawnPack(st, rise);
  }

  private spawnContent(): void {
    for (const pm of this.map.markers) {
      const m = pm.marker;
      const pos = markerPos(pm);
      if (!this.shown(pm)) {
        // a conditional prop that isn't standing doesn't block
        if (pm.body) pm.body.off = true;
        if (m.kind === 'prop' && m.solid) {
          this.map.solid[pm.ty * this.map.w + pm.tx] = 0;
          this.map.block[pm.ty * this.map.w + pm.tx] = 0;
        }
        continue;
      }
      switch (m.kind) {
        case 'npc':
          this.npcs.push({ id: m.npc, ...this.besideThings(pos), face: 0, bob: this.rand() * TAU });
          break;
        case 'chest': {
          const key = `${this.region.id}:${m.id}:${pm.tx}:${pm.ty}`;
          const done = m.once && this.hero.opened.includes(key);
          this.chests.push({ id: m.id, key, x: pos.x, y: pos.y, tier: m.tier, once: !!m.once, open: !!done, openT: done ? 1 : 0 });
          break;
        }
        case 'pack':
          this.addPack(pm, pos, false);
          break;
        case 'spot':
          this.spots.push({ ...pos, id: m.id, name: m.name, r: m.r });
          break;
        case 'dummy': {
          if (this.puppet) break;
          const e = this.addEnemy('moss-slime', pos.x, pos.y, 1, { room: -1, pack: -1, post: true });
          e.dummy = m.shooter ? 2 : 1;
          e.name = m.shooter ? 'Bolt Dummy' : 'Training Dummy';
          e.hp = e.maxHp = 9999;
          e.r = 6;
          e.atkCd = 1.5;
          break;
        }
        case 'waystone':
          this.waystones.push(pos);
          break;
        case 'exit':
          this.exits.push({ ...pos, to: m.to, label: m.label, ...(m.minLevel ? { minLevel: m.minLevel } : {}), ...(m.needs ? { needs: m.needs } : {}), ...(m.door ? { door: true } : {}) });
          break;
        case 'shrine':
          this.shrines.push({ ...pos, id: m.id });
          break;
        case 'prop':
          this.addProp(pm, pos);
          break;
        case 'hazard':
          if (m.hazard === 'spore') this.spores.push({ ...pos, ripe: true, t: 0, fuse: 0, friendly: false });
          break;
        case 'fire':
          if (this.storyState?.burning) this.addFire(pm, pos, m.size, m.delay);
          break;
        case 'wisp':
          this.wisps.push({ ...pos, color: m.color, size: m.size });
          break;
        case 'place':
          this.places[m.id] = pos;
          break;
        default:
          break;
      }
    }
  }

  /** A prop that stands (lights, wells); a flock of hens (or any animals: sim/critters.ts) is let out once, wherever it is first shown. */
  private addProp(pm: { tx: number; ty: number; marker: { kind: string } }, pos: { x: number; y: number }): void {
    const m = pm.marker as Extract<Marker, { kind: 'prop' }>;
    const herd = herdOf(m.prop);
    if (!herd) {
      this.props.push({ ...pos, prop: m.prop });
      return;
    }
    const key = pm.ty * this.map.w + pm.tx;
    if (this.flocks.has(key)) return;
    this.flocks.add(key);
    this.critters.push(...letOut(herd, pos.x, pos.y, this.critterRand));
  }

  /** A pack's enemies, around its spot (again, when it comes back). */
  private spawnPack(st: PackState, rise = false): void {
    if (this.puppet) {
      st.ids = [];
      return;
    }
    st.ids = st.enemies.map((id, i) => {
      const a = (TAU * i) / st.enemies.length + this.rand();
      const r = st.enemies.length > 1 ? 10 + this.rand() * 10 : 0;
      const lvl = st.level + (!st.rare && this.rand() < 0.3 ? 1 : 0);
      return this.addEnemy(id, st.x + Math.cos(a) * r, st.y + Math.sin(a) * r, lvl, { elite: st.elite && i === 0, room: -1, pack: st.index, ...(rise ? { spawn: true } : {}) }).id;
    });
    st.respawnT = -1;
  }

  /** In the wilds, a pack that was wiped out comes back after a while, never in sight of the hero. */
  private updatePacks(dt: number): void {
    // the generated wilds; the first wood, with its boss at the end, stays cleared once cleared
    if (this.region.kind !== 'wild' || !this.region.holds) return;
    const p = this.player;
    // once a second: a named foe some quest still wants doesn't keep the hero waiting five minutes
    const look = Math.floor(this.time) !== Math.floor(this.time - dt);
    const wanted = look && this.packs.some((st) => st.rare && st.respawnT > RESPAWN_WANTED) ? new Set(activeQuests(this.hero).flatMap((q) => { const o = currentObjective(this.hero, q); return o.kind === 'kill' ? (o.enemies ?? []) : o.kind === 'loot' ? o.from : []; })) : null;
    for (const st of this.packs) {
      if (st.respawnT < 0 || st.gone) continue;
      if (wanted && st.rare && st.enemies.some((id) => wanted.has(id))) {
        st.respawnT = Math.min(st.respawnT, RESPAWN_WANTED);
        st.called = true;
      }
      // the timer stops at zero (−1 means the pack is alive), waiting for the hero to look away
      st.respawnT = Math.max(0, st.respawnT - dt);
      if (st.respawnT > 0 || (!st.called && Math.abs(p.x - st.x) < RESPAWN_CLEAR_X && Math.abs(p.y - st.y) < RESPAWN_CLEAR_Y)) continue;
      const rise = !!st.called;
      st.called = false;
      this.spawnPack(st, rise);
    }
  }

  /** Health on top of an enemy's level: the difficulty tier and rift modifiers, or a Riftstone level's might. */
  private hpMul(boss: boolean): number {
    const k = this.keyRun;
    if (!k) return TIERS[this.tier]!.hp * (this.mods.includes('fortified') ? 1.4 : 1);
    return keyScale(k.key, k.heroLevel).hp * (k.affixes.includes(boss ? 'tyrannical' : 'fortified') ? 1.3 : 1);
  }

  /** Damage on top of an enemy's level, likewise. */
  private dmgMul(boss: boolean): number {
    const k = this.keyRun;
    if (!k) return TIERS[this.tier]!.dmg;
    return keyScale(k.key, k.heroLevel).dmg * (k.affixes.includes(boss ? 'tyrannical' : 'fortified') ? 1.15 : 1);
  }

  /**
   * A Riftstone run keeps its own measure: its clock (data/keystones.ts KEY_PARS) was set against the old blows, so
   * everything in it has health to match the hero's halved blows (HERO_DAMAGE), and its foes hit as they did. Heroic and
   * Mythic are the campaign's dungeons made harder, so they take the campaign's harder blows with their own measure on
   * top (TIERS): each stays harder than the one below in every way.
   */
  get ownMeasure(): boolean {
    return !!this.keyRun;
  }

  /** A boss's BOSS_DAMAGE at its level, in the campaign (ownMeasure). */
  bossBoost(level: number): number {
    return this.ownMeasure ? 1 : bossDamage(level);
  }

  /** The health of everything in a run that keeps its own measure: to match the hero's blows (ownMeasure). */
  private ownHealth(): number {
    return heroDamage(this.hero.level);
  }

  /** Creates an enemy (scaled to its level, the difficulty tier and rift modifiers). */
  addEnemy(id: string, x: number, y: number, level: number, o: { elite?: boolean; room: number; pack: number; spawn?: boolean; post?: boolean }): Enemy {
    const def = ENEMIES[id] ?? ENEMIES['moss-slime']!;
    const sc = enemyScale(level);
    const elite: EliteAffix[] = [];
    if (o.elite) {
      const pool: EliteAffix[] = ['frenzied', 'molten', 'vampiric', 'shielded', ...(this.tier > 0 ? (['volatile'] as EliteAffix[]) : [])];
      const n = this.tier >= 2 ? 3 : this.tier >= 1 ? 2 : 1;
      while (elite.length < n) {
        const a = pool[Math.floor(this.rand() * pool.length)]!;
        if (!elite.includes(a)) elite.push(a);
      }
    }
    const hasted = this.mods.includes('hasted') ? 1.2 : 1;
    const wild = o.pack >= 0 && !!this.region.holds;
    const ch = this.keyRun || this.tier > 0 ? NO_CHALLENGE : challenge(level, false);
    const deep = this.keyRun || this.tier > 0 ? NO_CHALLENGE : depth(this.region);
    // (whatever stands in a boss's room, its guards, what it calls up and the things its fight is fought over, stands as
    // long against the hero's blows as the boss does: a fight's own clock, adds to kill before they reach the boss or a
    // ward to break in time, was set against the hero's old blows)
    const bossRoom = o.room >= 0 && !!this.encounters[o.room]?.def.boss;
    const hp = Math.round(def.hp * sc.hp * this.hpMul(false) * ch.hp * deep.hp * (o.elite ? 3.2 : 1) * (wild ? WILD.hp : 1) * (this.ownMeasure ? this.ownHealth() : bossRoom ? bossHealth(level) : 1));
    const e: Enemy = {
      id: this.nextId++,
      def,
      level,
      x,
      y,
      vx: 0,
      vy: 0,
      r: def.radius * (def.scale ?? 1) * (o.elite ? 1.25 : 1),
      hp,
      maxHp: hp,
      dmg: def.dmg * sc.dmg * this.dmgMul(false) * ch.dmg * deep.dmg * (o.elite ? 1.35 : 1) * (wild ? WILD.dmg : 1) * (bossRoom || this.ownMeasure ? 1 : mobDamage(level)),
      speedMul: hasted * (elite.includes('frenzied') ? 1.35 : 1),
      atkMul: hasted * (elite.includes('frenzied') ? 1.4 : 1),
      shield: elite.includes('shielded') ? hp * 0.4 : 0,
      elite,
      boss: null,
      state: o.spawn ? 'spawn' : 'idle',
      t: o.spawn ? 0.7 : this.rand() * 2,
      atkCd: 0.5,
      aimA: 0,
      aimX: 0,
      aimY: 0,
      rushLeft: 0,
      rushHit: false,
      homeX: x,
      homeY: y,
      aggro: !!o.spawn,
      lostT: 0,
      pack: o.pack,
      room: o.room,
      statuses: [],
      flash: 0,
      face: this.rand() < 0.5 ? 0 : Math.PI,
      walkT: this.rand(),
      hopT: this.rand(),
      trailT: 0,
      dummy: 0,
      dead: false,
      deathT: 0,
      scale: (def.scale ?? 1) * (o.elite ? 1.3 : 1),
      strafe: this.rand() * 2,
      victim: 0,
      victimT: 0,
      mend: 0,
      raising: false,
      master: 0,
      blinkT: 0,
      raiseT: 0,
      hurtT: 99,
      name: o.elite ? `${ELITE_AFFIXES[elite[0]!].name} ${def.name}` : def.name,
    };
    // nothing starts overlapping a wall, a pillar or a prop (a pack member landing on a camp's crate
    // would be stuck in it); training dummies stand on their own post on purpose
    const free = o.post ? null : pushOut(this.map, x, y, e.r, o.room);
    if (free) {
      e.x = e.homeX = free.x;
      e.y = e.homeY = free.y;
    }
    this.enemies.push(e);
    if (o.spawn) this.addFx({ kind: 'rift', x: e.x, y: e.y, life: 0.7, size: e.r + 4, color: '#ff3fd2' });
    return e;
  }

  private addBoss(id: string, x: number, y: number, room: number): Enemy {
    const def = BOSSES[id]!;
    const level = this.level + 1;
    const sc = enemyScale(level);
    const bch = this.keyRun || this.tier > 0 ? NO_CHALLENGE : challenge(level, true);
    const deep = this.keyRun || this.tier > 0 ? NO_CHALLENGE : depth(this.region);
    const hp = Math.round(def.hp * sc.hp * this.hpMul(true) * bch.hp * deep.hp * (this.ownMeasure ? this.ownHealth() : bossHealth(level)));
    const e = this.addEnemy('skeleton', x, y, level, { room, pack: -1 });
    e.def = { ...ENEMIES.skeleton!, id: def.id, name: def.name, sprite: def.sprite, radius: def.radius, mass: 99, resist: {}, armor: 0, xp: def.xp, gold: def.gold, scale: 1 };
    e.r = def.radius;
    e.hp = e.maxHp = hp;
    e.dmg = def.dmg * sc.dmg * this.dmgMul(true) * bch.dmg * deep.dmg * this.bossBoost(level);
    e.name = def.name;
    e.scale = 1;
    e.state = 'chase';
    e.aggro = true;
    const room0 = this.map.roomTiles[room] ?? [];
    let cx = x;
    let cy = y;
    if (room0.length) {
      cx = (room0.reduce((a, i) => a + (i % this.map.w), 0) / room0.length + 0.5) * TILE;
      cy = (room0.reduce((a, i) => a + Math.floor(i / this.map.w), 0) / room0.length + 0.5) * TILE;
    }
    // a boss may open with something (its first phase's `enter`)
    e.boss = { def, phase: 0, rest: 1.4, pattern: null, cds: {}, queue: [...(def.phases[0]?.enter ?? [])], shift: 0, dazed: 0, dying: 0, cx, cy, collapse: 0, misc: {} };
    this.bossId = e.id;
    return e;
  }

  /**
   * A boss for a scene to look at, where there is none yet: it only comes when its ground is entered, so a shot of
   * its den showed an empty den. A figure of it stands at its mark, held (it does nothing and can't be fought), and is
   * taken away when the scene ends (`unstage`). The boss itself, if it is already here, is what the scene looks at.
   */
  stageBoss(id: string): Enemy | null {
    const have = this.enemies.find((e) => !e.dead && e.def.id === id);
    if (have) return have;
    const m = this.map.markers.find((pm) => pm.marker.kind === 'boss' && pm.marker.boss === id);
    if (!m || !BOSSES[id]) return null;
    const pos = markerPos(m);
    const was = this.bossId;
    const e = this.addBoss(id, pos.x, pos.y, -1);
    // (no boss bar, no fight: it is a picture of what waits there)
    this.bossId = was;
    e.boss!.queue = [];
    e.held = true;
    e.aggro = false;
    e.staged = true;
    e.state = 'idle';
    return e;
  }

  /** Takes away what a scene stood up to look at. */
  unstage(): void {
    if (this.enemies.some((e) => e.staged)) this.enemies = this.enemies.filter((e) => !e.staged);
  }

  /** The packs camped round a spot that were cut down and haven't come back: they come back now (a scene is about to look). */
  callPacks(x: number, y: number): void {
    for (const st of this.packs) {
      if (st.gone || st.respawnT < 0 || Math.hypot(st.x - x, st.y - y) > 6 * TILE) continue;
      st.respawnT = 0;
      st.called = true;
    }
  }

  /** Adds summoned by a boss (they appear with a short rise). */
  spawnAdd(id: string, x: number, y: number, room: number): void {
    const free = this.freeSpot(x, y, 6);
    this.addEnemy(id, free.x, free.y, this.level, { room, pack: -1, spawn: true });
  }

  /** The nearest spot (within a tile or so) where a circle of radius r stands clear of everything, with room to spare. */
  private openNear(x: number, y: number, r: number): { x: number; y: number } | null {
    for (let d = 2; d <= 26; d += 2) {
      for (let i = 0; i < 16; i++) {
        const a = (Math.PI * 2 * i) / 16;
        const nx = x + Math.cos(a) * d;
        const ny = y + Math.sin(a) * d;
        if (!circleHitsWall(this.map, nx, ny, r + 2)) return { x: nx, y: ny };
      }
    }
    return null;
  }

  /** Where someone can stand at a spot: there, or just beside whatever stands on it. */
  private besideThings(pos: { x: number; y: number }): { x: number; y: number } {
    return pushOut(this.map, pos.x, pos.y, 6) ?? pos;
  }

  /**
   * The hero eases round the people who stand in a place rather than through them; never so hard that someone in a
   * narrow way can stop them getting past.
   */
  private keepOffPeople(dt: number): void {
    const p = this.player;
    const keep = p.r + 9;
    for (const n of this.npcs) {
      const dx = p.x - n.x;
      const dy = p.y - n.y;
      if (Math.abs(dx) >= keep || Math.abs(dy) >= keep) continue;
      const d = Math.hypot(dx, dy);
      if (d >= keep || d < 0.01) continue;
      const push = Math.min(keep - d, 75 * dt);
      const res = moveCircle(this.map, p.x, p.y, p.r, (dx / d) * push, (dy / d) * push);
      p.x = res.x;
      p.y = res.y;
    }
  }

  private freeSpot(x: number, y: number, r: number): { x: number; y: number } {
    for (let i = 0; i < 16; i++) {
      const a = this.rand() * TAU;
      const d = i * 4;
      const nx = x + Math.cos(a) * d;
      const ny = y + Math.sin(a) * d;
      const res = moveCircle(this.map, nx, ny, r, 0, 0);
      if (!this.map.solid[tileAt(this.map, res.x, res.y)] && !wallNear(this.map, nx, ny, r)) return { x: nx, y: ny };
    }
    return { x, y };
  }

  /* ------------------------------------------------------- shared helpers */

  emit(ev: WorldEvent): void {
    this.events.push(ev);
  }
  sfx(id: string, vol?: number): void {
    this.events.push({ t: 'sfx', id, vol });
  }
  /**
   * A roof on fire. One that catches while the hero is here does so `delay` seconds after the burning begins;
   * one burning when they came is burning already.
   */
  private addFire(pm: PlacedMarker, pos: { x: number; y: number }, size: number, delay = 0): void {
    const key = pm.ty * this.map.w + pm.tx;
    let born = this.fireBorn.get(key);
    if (born === undefined) {
      born = this.time < 0.5 ? -99 : this.time + delay;
      this.fireBorn.set(key, born);
    }
    this.fires.push({ ...pos, size, born });
  }

  /** How far a fire has caught, 0 (not yet) to 1 (ablaze). */
  fireLit(f: { born: number }): number {
    return Math.max(0, Math.min(1, (this.time - f.born) / 1.4));
  }

  shake(amount: number): void {
    if (this.settings.shake) this.shakeAmt = Math.min(8, Math.max(this.shakeAmt, amount));
  }
  hitstop(t: number): void {
    this.hitstopT = Math.max(this.hitstopT, t);
  }
  /** Time slows for `t` seconds, the camera drawn to `at` (never in a co-op party: the worlds keep one pace). */
  slowmo(t: number, at: { x: number; y: number } | null): void {
    if (this.coop) return;
    this.slowT = Math.max(this.slowT, t);
    this.slowAt = at;
  }
  after(t: number, fn: () => void): void {
    // (what a boss's pattern leaves to happen a moment later, a pool where its bile lands, is still that boss's doing:
    // it is run as the boss's turn, bossActing, whenever it comes)
    const by = this.bossActing;
    this.delayed.push({ t, fn: by ? () => this.asBoss(by, fn) : fn });
  }
  /** Runs `fn` as the boss's turn (bossActing), as sim/ai.ts runs its patterns. */
  asBoss(by: Enemy, fn: () => void): void {
    const was = this.bossActing;
    this.bossActing = by;
    try {
      fn();
    } finally {
      this.bossActing = was;
    }
  }
  text(x: number, y: number, text: string, color: string, big: boolean): void {
    // words said again while they are still rising from the same place aren't laid over themselves (a boss's shell
    // rang "CLANG! Get behind her!" twice a second, each on top of the last: the owner, "boss callouts can stack on
    // top of each other"). Numbers stack as they always have: each is its own blow
    if (/[a-z]/i.test(text) && this.texts.some((o) => o.text === text && o.t < 1 && Math.abs(o.x - x) < 60 && Math.abs(o.y + o.vy * o.t - y) < 60)) return;
    if (this.texts.length > 60) this.texts.shift();
    this.texts.push({ x, y, text, color, t: 0, big, vy: -26 });
  }
  addFx(f: Partial<Fx> & Pick<Fx, 'kind' | 'x' | 'y' | 'life'>): void {
    if (this.fx.length > 420) return;
    this.fx.push({ vx: 0, vy: 0, t: 0, size: 2, color: '#fff', a: 0, a2: 0, r2: 0, x2: 0, y2: 0, ...f });
  }
  /**
   * A drawn spell effect (`impact:fire`, `blast:frost`, `cast:holy`, `pillar:fire`...: render/effects.ts). Only a
   * picture: it touches nothing. `angle`: which way it was aimed, for the ones that care (a blow's swing).
   */
  vfx(sprite: string, x: number, y: number, size = 0, life = 0.9, angle = 0): void {
    this.addFx({ kind: 'glow', x, y, life, size, color: 'rgba(0,0,0,0)', sprite, a: angle });
  }
  fxBurst(x: number, y: number, color: string, n: number, radius = 12): void {
    for (let i = 0; i < n; i++) {
      const a = this.rand() * TAU;
      const s = (0.4 + this.rand() * 0.8) * radius * 3;
      this.addFx({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, life: 0.25 + this.rand() * 0.3, size: 1 + Math.floor(this.rand() * 2), color });
    }
  }
  spawnProjectile(p: Partial<Projectile> & Pick<Projectile, 'x' | 'y' | 'vx' | 'vy' | 'r' | 'life' | 'dmg' | 'type' | 'spec' | 'depth' | 'pierce' | 'bounce' | 'hit' | 'look' | 'color' | 'child' | 'knock'>): void {
    if (this.projectiles.length > 260) return;
    // (a boss's barrage, many shots to weave through, hurts shot for shot as it did: BOSS_DAMAGE is for its blows)
    const by = this.bossActing;
    if (p.hostile && by) p = { ...p, dmg: p.dmg / this.bossBoost(by.level), ...(p.status ? { status: this.wearing(p.status) } : {}) };
    this.projectiles.push({ id: this.nextId++, hostile: false, splitDone: false, trailT: 0, homing: 0, age: 0, wide: false, dead: false, ...p });
  }
  /** Lays a field on the ground and returns it (a pattern may grow it or take it away). */
  spawnField(f: Omit<Field, 'id' | 't' | 'tickT'>): Field {
    if (this.fields.length > 200) this.fields.shift();
    // (the ground a boss leaves burning or poisoned wears a hero down as it did: BOSS_DAMAGE is for its blows)
    const by = this.bossActing;
    if (f.hostile && by) f = { ...f, dmg: f.dmg / this.bossBoost(by.level), ...(f.status ? { status: this.wearing(f.status) } : {}) };
    const field: Field = { ...f, id: this.nextId++, t: f.dur, tickT: f.hostile ? 0.25 : 0 };
    this.fields.push(field);
    return field;
  }
  /**
   * A boss's mechanic, called out in the slot under its bar and not over its head (where it sat on the fight and
   * was gone in a second): up to six words, held `dur` seconds, with what to do about it for a hero's first meeting.
   */
  callout(text: string, color: string, hint?: string, dur = 3): void {
    this.shout = { text, color, t: 0, dur, ...(hint ? { hint } : {}) };
  }
  /** Shows an attack on the ground and returns it. */
  addTelegraph(t: Omit<Telegraph, 'id' | 't' | 'dead'>): Telegraph {
    // (a boss's blow lands at its full weight, and at least its floor of the hero's health, sim/combat.ts BLOW_FLOOR; the
    // burn or poison it leaves on the hero wears them down as it did)
    const by = this.bossActing;
    if (by && t.status) t = { ...t, status: this.wearing(t.status) };
    if (by && !this.ownMeasure && t.dmg > 0 && t.floor === undefined) {
      const pat = by.boss?.pattern;
      if (pat) pat.data.floorOf ??= ++this.floorSerial;
      t = { ...t, floor: blowFloor(t.dmg, by.dmg), ...(pat ? { floorOf: pat.data.floorOf } : {}) };
    }
    const tg: Telegraph = { ...t, id: this.nextId++, t: 0, dead: false };
    this.telegraphs.push(tg);
    return tg;
  }
  /**
   * Damage over time a boss lays on the hero, taken back to what it was before BOSS_DAMAGE: the owner asked for blows
   * that matter, and burning, poison and bleeding that grew with them were what the play-bot fell to again and again,
   * a tick at a time, not a blow it could have stepped out of. Other statuses (a chill, a stun) are left as they are.
   */
  private wearing(st: { status: StatusId; dur: number; power: number }): { status: StatusId; dur: number; power: number } {
    const by = this.bossActing;
    return by && (st.status === 'burn' || st.status === 'poison' || st.status === 'bleed') ? { ...st, power: st.power / this.bossBoost(by.level) } : st;
  }
  spawnWave(x: number, y: number, speed: number, max: number, width: number, dmg: number): void {
    // (a boss's ring of force is gone through with a well-timed dodge, not stepped out of: like a barrage, it hurts as it did)
    if (this.bossActing) dmg /= this.bossBoost(this.bossActing.level);
    this.waves.push({ id: this.nextId++, x, y, r: 8, speed, max, width, dmg, hitPlayer: false, dead: false });
  }
  /** Clears enemy attacks in flight (phase changes, respawns). */
  clearHostile(): void {
    this.projectiles = this.projectiles.filter((p) => !p.hostile);
    this.telegraphs = this.telegraphs.filter((t) => t.tone === 'player');
    this.fields = this.fields.filter((f) => !f.hostile);
    this.waves = [];
  }
  enemyById(id: number): Enemy | undefined {
    return this.enemies.find((e) => e.id === id);
  }

  /** The pack wakes up together. */
  alertPack(e: Enemy): void {
    e.aggro = true;
    if (e.pack < 0) return;
    for (const o of this.enemies) if (o.pack === e.pack && !o.dead && !o.aggro && dist(o.x, o.y, e.x, e.y) < 120) o.aggro = true;
  }

  /** Breaks cracked walls a hit touched. */
  breakWalls(x: number, y: number, r: number): void {
    const m = this.map;
    const x0 = Math.floor((x - r - 2) / TILE);
    const x1 = Math.floor((x + r + 2) / TILE);
    const y0 = Math.floor((y - r - 2) / TILE);
    const y1 = Math.floor((y + r + 2) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue;
        const i = ty * m.w + tx;
        if (m.kind[i] !== K.Cracked) continue;
        breakWall(m, i);
        const cx = (tx + 0.5) * TILE;
        const cy = (ty + 0.5) * TILE;
        for (let k = 0; k < 14; k++) this.addFx({ kind: 'rubble', x: cx, y: cy, vx: (this.rand() - 0.5) * 120, vy: (this.rand() - 0.8) * 120, life: 0.6, size: 2 + Math.floor(this.rand() * 2), color: '#6a6680' });
        this.sfx('crumble');
        this.shake(3);
        this.emit({ t: 'banner', text: 'A hidden passage!', sub: 'Something glints inside' });
      }
    }
  }

  resetCooldown(skill?: string): void {
    const p = this.player;
    const slots = ([...SKILL_SLOTS] as SlotKey[]).filter((s) => this.build.bar[s] && p.cds[s].charges < p.cds[s].max);
    const pick = skill ? slots.find((s) => this.build.bar[s] === skill) : slots[Math.floor(this.rand() * slots.length)];
    if (!pick) return;
    const cd = p.cds[pick];
    cd.charges = cd.max;
    cd.t = 0;
    this.addFx({ kind: 'glow', x: p.x, y: p.y, life: 0.4, size: 10, color: '#22e4ff' });
    this.sfx('reset');
  }

  reduceCooldowns(s: number): void {
    const p = this.player;
    for (const slot of [...SKILL_SLOTS, 'dodge'] as SlotKey[]) {
      const cd = p.cds[slot];
      if (cd.charges >= cd.max) continue;
      cd.t -= s;
      while (cd.t <= 0 && cd.charges < cd.max) {
        cd.charges += 1;
        cd.t += cd.charges < cd.max ? cd.cd : 0;
      }
      if (cd.charges >= cd.max) cd.t = 0;
    }
  }

  /** Re-reads the hero after gear, talents, skills or a shape changed (keeps health as a share). */
  rebuild(): void {
    const p = this.player;
    const share = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    this.build = buildHero(this.hero, p.form);
    p.maxHp = this.build.maxHp;
    p.hp = Math.max(1, Math.min(this.build.maxHp, Math.round(this.build.maxHp * share)));
    if (this.build.resource?.kind === 'mana') {
      const mShare = p.maxMana > 0 ? p.mana / p.maxMana : 1;
      p.maxMana = this.build.maxMana;
      p.mana = Math.min(this.build.maxMana, this.build.maxMana * mShare);
    } else {
      p.maxMana = this.build.maxMana;
      p.mana = Math.min(p.mana, p.maxMana);
    }
    this.syncCooldowns(false);
    refreshPets(this);
    this.dropLeftovers();
  }

  /**
   * What a skill keeps going (its companions, its buffs, the shape it took, its channel) ends when the skill
   * leaves the bar: a warlock who swaps Summon Imp for another skill loses the imp. "On the bar" means the
   * skills the hero chose plus the bar of the shape they are in, so shapeshifting itself drops nothing.
   */
  private dropLeftovers(): void {
    const p = this.player;
    const kept = new Set<string>(this.hero.skills.filter((id): id is string => !!id));
    for (const id of Object.values(this.build.bar)) if (id) kept.add(id);
    const before = this.barSkills;
    this.barSkills = kept;
    for (const pet of this.pets) {
      if (pet.dead || !pet.skill || kept.has(pet.skill)) continue;
      pet.dead = true;
      pet.deathT = 0;
      this.fxBurst(pet.x, pet.y, '#b58aff', 10, 10);
    }
    p.buffs = p.buffs.filter((b) => !b.skill || kept.has(b.skill));
    if (p.channel && !kept.has(p.channel.spec.id)) p.channel = null;
    const shape = p.form ? CLASSES[this.hero.cls].forms?.find((f) => f.id === p.form) : undefined;
    // the shape's own skill was on the bar and has been taken off: back to the hero's own shape (rebuilds again)
    if (shape && before.has(shape.skill) && !kept.has(shape.skill)) this.setForm(null);
  }

  /** The skills on the bar at the last rebuild (dropLeftovers). */
  private barSkills = new Set<string>();

  /** A druid takes a shape (or returns to their own, null): the bar changes with it. */
  setForm(form: string | null): void {
    const p = this.player;
    if (p.form === form) return;
    p.form = form;
    p.channel = null;
    this.rebuild();
    this.fxBurst(p.x, p.y, form === 'bear' ? '#a0703f' : form === 'cat' ? '#ffb04d' : '#7bd65a', 14, 14);
    this.addFx({ kind: 'ring', x: p.x, y: p.y, life: 0.35, size: 16, color: '#7bd65a' });
    this.sfx('shapeshift');
    this.emit({ t: 'hero' });
  }

  private syncCooldowns(fresh: boolean): void {
    const p = this.player;
    for (const slot of ACTION_SLOTS) {
      const id = this.build.bar[slot];
      const spec = id ? this.build.skills[id]?.spec : undefined;
      const cd = p.cds[slot];
      const max = spec ? spec.charges : 1;
      cd.cd = spec ? spec.cooldown : 1;
      if (fresh || cd.max !== max) {
        cd.max = max;
        cd.charges = fresh ? max : Math.min(cd.charges, max);
        if (cd.charges >= max) cd.t = 0;
        else if (cd.t <= 0) cd.t = cd.cd;
      }
    }
  }

  /* ------------------------------------------------------------- step */

  step(rawDt: number): void {
    // hit-stop: a few frames nearly frozen on heavy hits
    let dt = rawDt;
    if (this.hitstopT > 0) {
      this.hitstopT -= rawDt;
      dt = rawDt * 0.08;
    }
    if (this.player.dead) dt *= 0.35;
    if (this.slowT > 0) {
      this.slowT -= rawDt;
      dt *= SLOW;
      if (this.slowT <= 0) this.slowAt = null;
    }
    this.time += dt;
    if (this.keyRun) this.updateKeyRun(rawDt, dt);
    this.shakeAmt = Math.max(0, this.shakeAmt - rawDt * 18);
    // the story's staged beats: looked for twice a second, played while the hero stands still
    this.sceneCheck -= rawDt;
    // a staged scene stops one world while the others play on: in a party only the leader's world plays
    // them (the others are told, and play on), and never on a Riftstone run's clock
    if (!this.scene && scenesPlayHere(this) && this.sceneCheck <= 0) {
      this.sceneCheck = 0.5;
      maybeStartScene(this);
    }
    if (this.scene) updateScene(this, rawDt);
    this.updatePlayer(dt);
    // rewards held for a full bag come in as soon as there is room
    if (this.hero.held?.length && !bagFull(this.hero)) for (const item of deliverHeld(this.hero)) this.emit({ t: 'loot', item });
    this.updateFlow(dt);
    // in the wilds, enemies far away and minding their own business sleep (a zone holds hundreds)
    const awake: Enemy[] = [];
    const wild = this.region.kind === 'wild';
    const px = this.player.x;
    const py = this.player.y;
    // a co-op guest's enemies are the host's: they move by its frames (net/coop.ts), not here
    if (this.puppet) for (const e of this.enemies) updatePuppet(this, e, dt);
    else
      for (const e of this.enemies) {
        if (wild && !e.aggro && !e.dead && e.state === 'idle' && (Math.abs(e.x - px) > SLEEP_X || Math.abs(e.y - py) > SLEEP_Y) && !this.nearGhost(e.x, e.y)) continue;
        // a scene holds the land still: a pack wandering into sight doesn't notice the hero and break it off mid-line
        // (the owner: "sometimes the cinematics cut abruptly"). A foe already in a fight still is, and ends it; those
        // the scene holds in its shot (a wave mustering, a boss in its den) are its own
        if (this.scene && !e.aggro && !e.held && !e.dead) continue;
        updateEnemy(this, e, dt);
        awake.push(e);
      }
    updatePets(this, dt);
    separate(this, dt, awake);
    if (!this.puppet) this.updatePacks(dt);
    this.fogT -= dt;
    if (this.fogT <= 0) {
      this.fogT = 0.25;
      this.lookAround();
    }
    updateProjectiles(this, dt);
    updateFields(this, dt);
    updateTraps(this, dt);
    this.updateTelegraphs(dt);
    this.updateWaves(dt);
    this.updateDrops(dt);
    this.updateChests(dt);
    if (!this.puppet) this.updateEncounters(dt);
    this.updateHazards(dt);
    this.updateAmbient(dt);
    this.story.update(dt);
    // delayed actions (meteors, echoes, rift bursts)
    if (this.delayed.length) {
      const due: (() => void)[] = [];
      for (const d of this.delayed) {
        d.t -= dt;
        if (d.t <= 0) due.push(d.fn);
      }
      this.delayed = this.delayed.filter((d) => d.t > 0);
      for (const fn of due) fn();
    }
    // corpses fade, effects age
    this.enemies = this.enemies.filter((e) => !e.dead || e.deathT < 0.6);
    if (this.shout && (this.shout.t += rawDt) >= this.shout.dur) this.shout = null;
    for (const t of this.texts) {
      t.t += rawDt;
      t.y += t.vy * rawDt;
      t.vy *= Math.exp(-3 * rawDt);
    }
    this.texts = this.texts.filter((t) => t.t < (t.big ? 1.1 : 0.8));
    for (const f of this.fx) {
      f.t += dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.kind === 'spark' || f.kind === 'rubble' || f.kind === 'coin') f.vy += 220 * dt;
      // drifting air (leaves, snow, ash) keeps its pace; smoke and embers slow down
      if (f.kind === 'smoke' || f.kind === 'ember') {
        f.vx *= Math.exp(-2 * dt);
        if (f.kind !== 'ember' || !f.sprite) f.vy *= Math.exp(-2 * dt);
      }
    }
    this.fx = this.fx.filter((f) => f.t < f.life);
    this.updateInteractable();
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    // nobody acts while a scene plays
    const raw = this.scene ? emptyInput() : this.input;
    // (grief turns the hero around: left is right, up is down)
    this.inverted = Math.max(0, this.inverted - dt);
    const inp = this.inverted > 0 ? { ...raw, mx: -raw.mx, my: -raw.my } : raw;
    // the ultimate's charge budget refills at one full bar per ultFloor seconds, and banks at most ULT_BANK of
    // a bar: after a lull, a stream of fast hits fills that much at once and earns the rest at the usual pace
    const ultRate = 100 / ultFloor(this.hero.level);
    p.ultBudget = Math.min(ULT_BANK, p.ultBudget + dt * ultRate);
    this.ultHits = 0;
    if (p.dead) {
      p.deadT += dt / 0.35;
      return;
    }
    const stats = this.build.stats;
    p.iframe = Math.max(0, p.iframe - dt);
    p.guard = Math.max(0, p.guard - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.potionT = Math.max(0, p.potionT - dt);
    p.actT = Math.max(0, p.actT - dt);
    if (p.actT <= 0) {
      p.actKind = null;
      p.actBig = false;
    }
    p.comboT = Math.max(0, p.comboT - dt);
    p.calm += dt;
    p.healBudgetT -= dt;
    if (p.healBudgetT <= 0) {
      p.healBudgetT = 1;
      p.healBudget = p.maxHp * 0.1;
    }
    if (p.shieldT > 0) {
      p.shieldT -= dt;
      if (p.shieldT <= 0) p.shield = 0;
    }
    // buffs run out; healing over time ticks (it is not limited like healing from hits)
    if (p.buffs.length) {
      for (const b of p.buffs) {
        b.t -= dt;
        if (b.def.hot) healPlayer(this, b.def.hot * dt, false, true);
      }
      p.buffs = p.buffs.filter((b) => b.t > 0);
    }
    tickPlayerStatuses(this, dt);
    if (p.dead) return;
    // regeneration: the regen stat always; out of combat (3 s without hitting or being hit) health and
    // mana come back fast, so potions are for trouble inside a fight, not for topping up between them
    const calm = p.calm > CALM_AFTER;
    const regen = stats.regen + (calm ? p.maxHp * (this.region.safe ? 0.3 : OUT_OF_COMBAT_HP) : 0);
    if (regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + regen * dt);
    // the resource: mana trickles back (fast out of combat), energy and focus come back at a fixed rate,
    // rage and Zeal fade once the fight is over
    const res = this.build.resource;
    if (res && p.maxMana > 0) {
      if (res.kind === 'mana') {
        const rate = calm ? OUT_OF_COMBAT_MANA : res.regen / 100;
        p.mana = Math.min(p.maxMana, p.mana + p.maxMana * rate * dt);
      } else if (res.kind === 'energy' || res.kind === 'focus') {
        p.mana = Math.min(p.maxMana, p.mana + res.regen * (1 + stats.haste / 100) * dt);
      } else if (calm && p.calm > CALM_AFTER + 2) {
        p.mana = Math.max(0, p.mana - res.regen * dt);
      }
    }
    // cooldowns recharge faster with haste (slotHaste): skills by skillHaste, the basic attack only up to BASIC_HASTE
    // (held down, it would otherwise turn into a stream of bolts), the dodge with all of it
    for (const slot of ACTION_SLOTS) {
      const cd = p.cds[slot];
      if (slot === 'ult' || cd.charges >= cd.max) continue;
      cd.t -= dt * slotHaste(slot, stats.haste);
      if (cd.t <= 0) {
        cd.charges += 1;
        cd.t = cd.charges < cd.max ? cd.t + cd.cd : 0;
      }
    }
    // a slow trickle of ultimate charge while fighting (out of the charge budget: it never beats the floor)
    if (p.calm < 3 && this.build.bar.ult && p.ult < 100) {
      const gain = Math.min(dt * ULT_TRICKLE, p.ultBudget);
      p.ultBudget -= gain;
      p.ult = Math.min(100, p.ult + gain);
    }
    // aim: the mouse, or where you move (touch)
    const moving = Math.hypot(inp.mx, inp.my) > 0.15;
    if (inp.aim !== null) p.aim = inp.aim;
    else if (moving && p.actT <= 0 && !p.windup) p.aim = Math.atan2(inp.my, inp.mx);
    // the mount: called standing still; moving, acting or a fight stops the call. Acting while riding
    // gets the hero down first, and the action happens
    if (inp.mount) this.toggleMount();
    // indoors is peaceful: no spells or blows in an inn or a chapel (the skill bar is put away: ui/DesktopBar.tsx, ui/Touch.tsx)
    const peace = !!this.region.interior;
    const acting = !peace && (inp.casts.length > 0 || !!inp.holdBasic);
    if (p.summon > 0) {
      if (moving || acting || this.mountRefusal()) p.summon = 0;
      else {
        p.summon += dt;
        if (p.summon >= SUMMON_TIME) {
          // the call ends in a flash, and they're up on it (no animal comes trotting: render3d/worldCast.ts)
          p.summon = 0;
          p.riding = riddenMount(this.hero);
          this.sfx('mount');
          this.addFx({ kind: 'burst', x: p.x, y: p.y, life: 0.3, size: 16, color: '#fff0c8' });
          this.addFx({ kind: 'ring', x: p.x, y: p.y + 4, life: 0.35, size: 14, color: 'rgba(232,220,190,0.7)' });
        }
      }
    }
    if (p.riding && acting) this.dismount();
    // skills
    let began = false;
    for (const req of peace ? [] : inp.casts) {
      // a cast begun this frame keeps it: what else was pressed with it doesn't stop it (a dodge still does)
      if (began && req.slot !== 'dodge') continue;
      const was = p.casting;
      const r = this.withMouse(req);
      if (tryCast(this, r) && req.slot !== 'basic' && req.slot !== 'dodge') this.tutorialSkillCast();
      began = !!p.casting && p.casting !== was;
    }
    if (!peace && inp.holdBasic && p.cds.basic.charges > 0) tryCast(this, this.withMouse(inp.holdBasic));
    // a cast needs the hero to stand: stepping away stops it (said once in a while, for whoever didn't know)
    if (p.casting && moving && p.casting.t <= 0 && this.time - this.castHintAt > 6) {
      this.castHintAt = this.time;
      this.text(p.x, p.y - 20, 'Stand still to cast', '#c9c3e6', false);
    }
    updateCasting(this, dt, moving || peace || !!this.scene);
    updateWindup(this, dt);
    updateChannel(this, dt);
    if (inp.potion) this.drinkPotion();
    // movement: quick to start, quick to stop
    if (p.dash) {
      updateDash(this, dt);
    } else {
      const stunned = playerStunned(this);
      let speed = (p.riding ? RIDE_SPEED : this.footPace()) * (1 + stats.speed / 100) * playerSlow(this);
      if (p.channel) speed *= 0.8;
      if (p.windup) speed *= 0.35;
      if (stunned) speed = 0;
      const tx = inp.mx * speed;
      const ty = inp.my * speed;
      // (adrift in a weightless gallery, slow to start and slow to stop)
      const accel = (moving ? 16 : 20) * (1 - this.unmoored * 0.86);
      const k = 1 - Math.exp(-accel * dt);
      p.vx += (tx - p.vx) * k;
      p.vy += (ty - p.vy) * k;
      // never left inside a wall (moveCircle can't move a circle that already overlaps one)
      if (circleHitsWall(this.map, p.x, p.y, p.r)) {
        const to = pushOut(this.map, p.x, p.y, p.r);
        if (to) {
          p.x = to.x;
          p.y = to.y;
        }
      }
      const res = moveCircle(this.map, p.x, p.y, p.r, p.vx * dt, p.vy * dt);
      // snagged: pressing to move but stopped both ways, wedged between the bodies of a crate and a cask: eased out
      // onto the nearest open ground. Only among things that stand (a wedge has something small in it to get round),
      // and once for a place. A hero pressed into the corner of a room is stopped both ways too, and is not stuck:
      // they were "eased out" of every corner they leaned into, walked back into it and were eased out again, two or
      // three times a second, and the camera, which is on the hero, went with them. The whole picture shook, and what
      // showed it was the walls and the gates (the owner: "some walls still jitter in campaign mode, walls, gates")
      if (this.snagAt && Math.hypot(p.x - this.snagAt.x, p.y - this.snagAt.y) > 12) this.snagAt = null;
      if (moving && !stunned && res.bx && res.by && !this.snagAt && this.amongThings(res.x, res.y, p.r)) {
        this.snagT += dt;
        if (this.snagT > 0.4) {
          this.snagT = 0;
          const free = this.openNear(p.x, p.y, p.r);
          if (free) {
            // (where they were set down: pressing on from there into the same place, they are left to stand in it)
            this.snagAt = { x: free.x, y: free.y };
            res.x = free.x;
            res.y = free.y;
          }
        }
      } else this.snagT = 0;
      if (res.bx) p.vx = 0;
      if (res.by) p.vy = 0;
      p.x = res.x;
      p.y = res.y;
      if (Math.hypot(p.vx, p.vy) > 8) p.walkT += dt * (Math.hypot(p.vx, p.vy) / 70);
      this.keepOffPeople(dt);
    }
    // facing for the sprite
    const fa = p.actT > 0 || inp.aim !== null ? p.aim : moving ? Math.atan2(inp.my, inp.mx) : null;
    if (fa !== null) {
      const c = Math.cos(fa);
      const s = Math.sin(fa);
      p.dir = Math.abs(c) > Math.abs(s) * 1.1 ? (c < 0 ? 1 : 2) : s < 0 ? 3 : 0;
    }
    if (p.hp < p.maxHp * 0.3 && this.hpBefore >= p.maxHp * 0.3 && this.hero.potions > 0) this.emit({ t: 'hint', id: 'potion' });
    this.hpBefore = p.hp;
  }

  /** How fast the hero goes on foot just now: a fight's pace, a walk's, or between them as a fight ends (WALK_SPEED). */
  footPace(): number {
    if (this.boss()) return FIGHT_SPEED;
    const k = Math.max(0, Math.min(1, (this.player.calm - CALM_AFTER) / PACE_EASES));
    return FIGHT_SPEED + (WALK_SPEED - FIGHT_SPEED) * k;
  }

  /** Something that stands (a crate, a trunk, a building's own wall) is at their elbow: not only the land's walls. */
  private amongThings(x: number, y: number, r: number): boolean {
    const m = this.map;
    const reach = r + 2;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
        for (const b of m.bodies[ny * m.w + nx] ?? []) {
          if (b.off) continue;
          const px = Math.max(b.x0, Math.min(x, b.x1));
          const py = Math.max(b.y0, Math.min(y, b.y1));
          if ((px - x) * (px - x) + (py - y) * (py - y) < reach * reach) return true;
        }
      }
    }
    return false;
  }

  /** Desktop ground skills aim at the exact mouse distance. */
  private withMouse(req: CastRequest): CastRequest {
    if (req.angle === null || this.input.aimX === null || this.input.aimY === null || req.dist !== null) return req;
    const id = this.build.bar[req.slot];
    const spec = id ? this.build.skills[id]?.spec : undefined;
    if (!spec || spec.aim !== 'ground') return req;
    const d = dist(this.player.x, this.player.y, this.input.aimX, this.input.aimY);
    return { ...req, dist: Math.min(1, d / spec.range) };
  }

  drinkPotion(): void {
    const p = this.player;
    if (p.dead || p.potionT > 0 || this.hero.potions <= 0 || p.hp >= p.maxHp) return;
    this.hero.potions -= 1;
    p.potionT = 1;
    healPlayer(this, POTION_HEAL * (1 + this.build.stats.potion / 100), false);
    this.addFx({ kind: 'glow', x: p.x, y: p.y, life: 0.5, size: 12, color: '#ff5a7a' });
    this.sfx('potion');
    this.emit({ t: 'hero' });
  }

  private updateFlow(dt: number): void {
    this.flowT -= dt;
    const i = tileAt(this.map, this.player.x, this.player.y);
    if (i === this.flowTile && this.flowT > 0) return;
    this.flowTile = i;
    this.flowT = 0.4;
    flowField(this.map, i % this.map.w, Math.floor(i / this.map.w), 34, this.flow);
  }

  private updateTelegraphs(dt: number): void {
    const p = this.player;
    for (const t of this.telegraphs) {
      t.t += dt;
      // slams follow their owner until they land
      if (t.owner >= 0 && t.shape !== 'line' && t.shape !== 'cone') {
        const o = this.enemyById(t.owner);
        if (o && !o.dead && o.boss) {
          t.x = o.x;
          t.y = o.y;
        }
      }
      if (t.t < t.dur) continue;
      // the host's attacks strike the other heroes too (their games take the hit)
      if (this.coop?.role === 'host' && t.tone !== 'player' && t.dmg > 0 && (t.kind ?? 'danger') === 'danger' && (t.t - dt < t.dur || t.linger > 0) && !t.dead)
        for (const g of this.coop.ghosts) {
          if (g.dead || t.struck?.includes(g.n) || !inside(t, g.x, g.y, g.r)) continue;
          (t.struck ??= []).push(g.n);
          this.ghostHit(g, t.dmg, { fromX: t.x, fromY: t.y, knock: t.knock, ...(t.status ? { status: t.status } : {}), ...(t.owner >= 0 ? { src: t.owner } : {}) });
        }
      if (t.tone !== 'player' && !t.remote && t.dmg > 0 && (t.kind ?? 'danger') === 'danger' && !p.dead && (t.t - dt < t.dur || t.linger > 0) && !t.dead) {
        if (inside(t, p.x, p.y, p.r)) {
          // (a pattern's floor is paid once: the second swing of a double cleave lands at its own weight)
          const paid = t.floorOf !== undefined && this.floorPaid.has(t.floorOf);
          if (hurtPlayer(this, t.dmg, { fromX: t.x, fromY: t.y, knock: t.knock, status: t.status, source: t.owner >= 0 ? this.enemyById(t.owner) : undefined, floor: paid ? 0 : (t.floor ?? 0) })) {
            if (t.floor && t.floorOf !== undefined) {
              this.floorPaid.add(t.floorOf);
              if (this.floorPaid.size > 64) this.floorPaid.delete(this.floorPaid.values().next().value!);
            }
            t.dmg = 0;
          }
        }
        if (t.t - dt < t.dur) {
          if (t.shape === 'circle' || t.shape === 'donut' || t.shape === 'ring') this.fxBurst(t.x, t.y, t.tone === 'rift' ? '#ff3fd2' : '#ff6a4d', 10, t.r * 0.6);
        }
      }
      if (t.t >= t.dur + t.linger) t.dead = true;
    }
    this.telegraphs = this.telegraphs.filter((t) => !t.dead);
  }

  private updateWaves(dt: number): void {
    const p = this.player;
    for (const w of this.waves) {
      w.r += w.speed * dt;
      if (w.r > w.max) w.dead = true;
      if (this.coop?.role === 'host')
        for (const g of this.coop.ghosts) {
          if (g.dead || w.struck?.includes(g.n) || Math.abs(dist(g.x, g.y, w.x, w.y) - w.r) >= w.width / 2 + g.r * 0.6) continue;
          (w.struck ??= []).push(g.n);
          this.ghostHit(g, w.dmg, { fromX: w.x, fromY: w.y, knock: 120 });
        }
      if (w.hitPlayer || w.remote || p.dead) continue;
      const d = dist(p.x, p.y, w.x, w.y);
      if (Math.abs(d - w.r) < w.width / 2 + p.r * 0.6) {
        if (hurtPlayer(this, w.dmg, { fromX: w.x, fromY: w.y, knock: 120 })) w.hitPlayer = true;
        else if (p.iframe > 0) w.hitPlayer = true;
      }
    }
    this.waves = this.waves.filter((w) => !w.dead);
  }

  /* ----------------------------------------------------------- loot */

  private dropAt(kind: Drop['kind'], x: number, y: number, amount: number, item?: Item): void {
    const a = this.rand() * TAU;
    const s = 20 + this.rand() * 40;
    this.drops.push({ id: this.nextId++, kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, z: 0, vz: 70 + this.rand() * 40, amount, item, t: 0, dead: false });
  }

  dropGold(x: number, y: number, amount: number): void {
    const coins = Math.min(5, Math.max(1, Math.round(amount / 4)));
    let left = amount;
    for (let i = 0; i < coins; i++) {
      const v = i === coins - 1 ? left : Math.max(1, Math.round(amount / coins));
      left -= v;
      if (v > 0) this.dropAt('gold', x, y, v);
    }
  }

  dropItem(x: number, y: number, item: Item): void {
    if (this.noLoot) return;
    this.dropAt('item', x, y, 1, item);
    if (item.r === 'legendary') this.sfx('legendary');
    else if (item.r === 'epic') this.sfx('epic');
  }

  /** A piece of gear; one the hero already carries (bag or worn) rolls again, twice at most. */
  private rollItem(source: LootSource, level: number): Item {
    const h = this.hero;
    const have = new Set([...h.bag, ...Object.values(h.equip)].flatMap((i) => (i ? [itemName(i)] : [])));
    // (Rift-forged pieces come only out of the Rift, by the highest stone the hero has opened)
    const stone = this.keyRun ? h.keystone : 0;
    let item = rollLoot(h.cls as ClassId, level, source, this.tier, this.rand, stone);
    for (let i = 0; i < 2 && have.has(itemName(item)); i++) item = rollLoot(h.cls as ClassId, level, source, this.tier, this.rand, stone);
    return item;
  }

  private updateDrops(dt: number): void {
    const p = this.player;
    for (const d of this.drops) {
      d.t += dt;
      if (d.z > 0 || d.vz > 0) {
        d.vz -= 260 * dt;
        d.z = Math.max(0, d.z + d.vz * dt);
        if (d.z === 0 && d.vz < 0) d.vz = Math.abs(d.vz) > 40 ? -d.vz * 0.35 : 0;
        const r = moveCircle(this.map, d.x, d.y, 2, d.vx * dt, d.vy * dt);
        d.x = r.x;
        d.y = r.y;
        d.vx *= Math.exp(-3 * dt);
        d.vy *= Math.exp(-3 * dt);
      }
      if (p.dead || d.t < 0.35) continue;
      const dd = dist(d.x, d.y, p.x, p.y);
      const called = d.kind === 'quest' && d.t > QUEST_WAIT;
      const magnet = called ? Infinity : d.kind === 'quest' ? QUEST_DRAW : d.kind === 'gold' || d.kind === 'orb' || d.kind === 'shard' || d.kind === 'potion' ? 40 : 0;
      if (dd < magnet) {
        const a = Math.atan2(p.y - d.y, p.x - d.x);
        const sp = Math.min(dd, (called ? 300 : d.kind === 'quest' ? 200 : 160) * dt);
        d.x += Math.cos(a) * sp;
        d.y += Math.sin(a) * sp;
      }
      if (dd > (d.kind === 'item' ? 13 : 8)) continue;
      this.pickUp(d);
    }
    this.drops = this.drops.filter((d) => !d.dead);
  }

  /**
   * The fight is won or the hero is leaving: everything still on the ground is theirs. Items go to
   * the bag even past its size (by up to BAG_OVERFLOW); anything beyond that is salvaged into gold,
   * so loot is never lost. Returns how many items and how much salvage gold it took.
   */
  collectAll(): { items: number; salvaged: number } {
    const h = this.hero;
    let items = 0;
    let salvaged = 0;
    for (const d of this.drops) {
      if (d.dead) continue;
      if (d.kind === 'gold' || d.kind === 'shard' || d.kind === 'potion' || d.kind === 'quest') this.pickUp(d);
      else if (d.kind === 'item') {
        const item = d.item!;
        d.dead = true;
        if (h.bag.some((i) => i.uid === item.uid)) continue;
        if (h.bag.length < bagSize(h) + BAG_OVERFLOW) {
          h.bag.push(item);
          learnLooks(h, [item]);
          this.run.items.push(item);
          items += 1;
        } else {
          const g = salvageValue(item);
          h.gold += g;
          this.run.gold += g;
          salvaged += g;
        }
      }
    }
    this.drops = this.drops.filter((d) => !d.dead);
    return { items, salvaged };
  }

  private pickUp(d: Drop): void {
    const h = this.hero;
    switch (d.kind) {
      case 'gold':
        h.gold += d.amount;
        this.run.gold += d.amount;
        this.sfx('coin', 0.6);
        d.dead = true;
        break;
      case 'orb':
        healPlayer(this, 20, false);
        this.sfx('orb');
        d.dead = true;
        break;
      case 'potion': {
        d.dead = true;
        // a full belt takes it as its price in coin
        if (h.potions >= potionCap(h)) {
          const g = Math.max(1, Math.round(potionPrice(h.level) * GOLD_FIND));
          h.gold += g;
          this.run.gold += g;
          this.sfx('coin', 0.6);
          break;
        }
        h.potions += 1;
        this.sfx('potion', 0.5);
        this.emit({ t: 'toast', text: `Potion (${h.potions}/${potionCap(h)})`, tone: 'loot' });
        this.emit({ t: 'save' });
        break;
      }
      case 'quest': {
        d.dead = true;
        // (still wanted: the quest may have been finished, or given up, while this lay there)
        const def = d.quest ? QUEST_DEFS[d.quest] : undefined;
        const o = def && h.quests[d.quest!]?.state === 'active' ? currentObjective(h, def) : undefined;
        if (o?.kind !== 'loot' || o.item !== d.label) break;
        this.text(this.player.x, this.player.y - 26, `+ ${o.item}`, '#ffe066', false);
        this.sfx('pickup', 0.6);
        this.questProgress((x) => x === o);
        break;
      }
      case 'shard': {
        h.shards += 1;
        d.dead = true;
        this.sfx('shard');
        this.emit({ t: 'toast', text: `Rift Shard (${Math.min(3, h.shards)}/3)`, tone: 'loot' });
        this.questProgress((o) => o.kind === 'collect');
        this.emit({ t: 'save' });
        break;
      }
      case 'item': {
        const item = d.item!;
        if (bagFull(h)) {
          if (!d.nagged) {
            d.nagged = true;
            this.emit({ t: 'toast', text: 'Your bag is full. Salvage something to pick this up.', tone: 'warn' });
          }
          return;
        }
        addItem(h, item);
        this.run.items.push(item);
        d.dead = true;
        this.sfx(item.r === 'legendary' || item.r === 'epic' ? 'pickupBig' : 'pickup');
        this.emit({ t: 'loot', item });
        this.emit({ t: 'save' });
        break;
      }
    }
  }

  private updateChests(dt: number): void {
    const p = this.player;
    for (const c of this.chests) {
      if (c.open) {
        c.openT = Math.min(1, c.openT + dt * 3);
        continue;
      }
      if (p.dead || dist(p.x, p.y, c.x, c.y) > 16) continue;
      c.open = true;
      this.sfx('chest');
      this.fxBurst(c.x, c.y - 4, '#ffd36b', 16, 14);
      const source: LootSource = c.tier === 'epic' ? 'chest-epic' : c.tier === 'rare' ? 'chest-rare' : 'chest-common';
      // one piece (a better one from a rare or an epic chest); an ordinary chest, every other time, only coin
      // (the owner, 2026-10-29: "items drop rate is still massive")
      const n = c.tier === 'common' ? (this.rand() < 0.5 ? 1 : 0) : 1;
      for (let i = 0; i < n; i++) this.dropItem(c.x, c.y, this.rollItem(source, this.level));
      this.dropGold(c.x, c.y, goldDrop([8, 14], this.level, this.rand));
      if (this.rand() < 0.5) this.dropAt('orb', c.x, c.y, 1);
      if (c.once) {
        this.hero.opened.push(c.key);
        this.emit({ t: 'save' });
      }
    }
  }

  /* --------------------------------------------------------- dying */

  /** An enemy just died (called by combat). */
  onKill(e: Enemy): void {
    const h = this.hero;
    if (this.coop?.role === 'host') this.coop.out.push({ t: 'kill', id: e.id });
    this.fxBurst(e.x, e.y, e.elite.length ? '#ffd36b' : '#e8e0ff', e.elite.length ? 18 : 9, e.r);
    this.sfx(e.boss ? 'bossDie' : deathSound(e.def), 0.6);
    if (e.boss) {
      e.dead = false;
      e.hp = 1;
      e.state = 'chase';
      e.boss.dying = 1.8;
      e.boss.pattern = null;
      this.clearHostile();
      // what the fight left ticking on the hero ends with it: a burn must not kill them during the throes
      this.player.statuses = this.player.statuses.filter((st) => st.id !== 'burn' && st.id !== 'poison' && st.id !== 'bleed');
      this.shake(6);
      this.hitstop(0.25);
      // the last blow, slowed, the camera on it
      this.slowmo(1.6, { x: e.x, y: e.y });
      // the other enemies in the room crumble with their master
      for (const o of this.enemies) if (!o.boss && !o.dead && o.room === e.room) o.hp = 0;
      for (const o of this.enemies) if (!o.boss && o.hp <= 0) o.dead = true;
      return;
    }
    // a fight's thing (a candle snuffed, a coffin or a cage broken open) is part of the fight, not a foe: no kill, no loot
    if (e.def.prop) return;
    h.stats.kills += 1;
    this.run.kills += 1;
    if (this.keyRun && !e.master) this.keyOnKill(e);
    const tier = TIERS[this.tier]!;
    const bonus = 1 + this.mods.reduce((a, m) => a + RIFT_MODS[m].bonus, 0);
    // raised minions are worth little: a necromancer is not a farm
    const wild = e.pack >= 0 && this.region.holds ? WILD.xp : 1;
    // and so does an enemy far below the hero
    const xp = e.def.xp * enemyScale(e.level).xp * tier.xp * (e.elite.length ? 4 : 1) * (e.master ? 0.25 : 1) * bonus * wild * outlevelled(h.level, e.level, 2);
    this.giveXp(xp);
    const big = e.elite.length > 0 || !!e.def.named;
    const gold = goldDrop(e.def.gold, e.level, this.rand) * (big ? 3 : 1);
    if (gold > 0) this.dropGold(e.x, e.y, gold);
    // Gear comes from chests, bosses, quests and shops, never from the enemies on the way (a playtester had
    // the same staff drop six times). What a piece would have been worth comes as a purse of coin instead,
    // every time from an elite or a named foe, now and then from the rest; and a potion now and then.
    const chance = (big ? 1 : 0.075) * tier.loot * bonus;
    if (this.rand() < chance) {
      const r = rollRarity(big ? 'elite' : 'enemy', this.tier, this.rand);
      this.dropAt('gold', e.x, e.y, salvageValue({ il: this.keyRun ? keyLoot(this.keyRun.key, this.keyRun.heroLevel) : e.level, r }));
    }
    if (this.rand() < (big ? 0.5 : 0.04)) this.dropAt('potion', e.x, e.y, 1);
    if (this.rand() < (e.elite.length ? 0.4 : 0.07)) this.dropAt('orb', e.x, e.y, 1);
    if (e.elite.length && h.quests['rift-shards']?.state === 'active' && h.shards < 3) this.dropAt('shard', e.x, e.y, 1);
    // what a death throws at the heroes is the host's (a guest sees its copy)
    if (!this.puppet && (e.elite.includes('volatile') || this.mods.includes('volatile'))) {
      const r = e.elite.includes('volatile') ? 34 : 24;
      this.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r, r2: 0, angle: 0, len: 0, dur: 1, dmg: e.dmg * (e.elite.length ? 1.6 : 0.9), knock: 120, tone: 'enemy', owner: -1, linger: 0 });
    }
    // things that burst when they die (a bloated corpse): step away from the body
    const b = e.def.burst;
    if (b?.onDeath && !this.puppet) {
      this.addTelegraph({ shape: 'circle', x: e.x, y: e.y, r: b.radius, r2: 0, angle: 0, len: 0, dur: 0.8, dmg: e.dmg * 1.6, knock: 120, tone: 'enemy', owner: -1, linger: 0 });
      if (b.pool > 0) this.after(0.8, () => this.spawnField({ x: e.x, y: e.y, r: b.radius * 0.8, dur: b.pool, tick: 0.5, dmg: e.dmg * 0.3, type: 'poison', status: { status: 'poison', dur: 2, power: e.dmg * 0.3 }, look: 'poison', hostile: true, depth: 0, spec: null, onHit: false }));
    }
    this.enemyGone(e);
    const here = this.region.id;
    this.questProgress((o) => o.kind === 'kill' && o.region === here && (!o.enemies || o.enemies.includes(e.def.id)));
    // quest items some enemies carry
    for (const [id, q] of Object.entries(h.quests)) {
      if (q.state !== 'active') continue;
      const d = QUEST_DEFS[id];
      const o = d ? currentObjective(h, d) : undefined;
      if (o?.kind !== 'loot' || o.region !== here || !o.from.includes(e.def.id) || this.rand() >= o.chance) continue;
      this.dropQuestItem(e, id, o.item);
    }
  }

  /**
   * What a quest asks for falls from the foe that carried it and lies where it fell, alight, for the hero to take
   * (the owner: "itd be cool if the things you find where droppable or visible on the ground with some glow for the
   * quests, currently i cant see some of the quest items im collecting"): it used to be counted the moment the foe
   * died, a line of text over a body and nothing to see. It counts when it is picked up. It can't be lost: it comes
   * to a hero who is near (QUEST_DRAW), to one anywhere after a while (QUEST_WAIT), and to one who is leaving
   * (collectAll). Which way it falls goes by the foe, not by the dice, so the land's luck is what it was.
   */
  private dropQuestItem(e: Enemy, quest: string, label: string): void {
    const a = e.id * 2.399963;
    this.drops.push({ id: this.nextId++, kind: 'quest', x: e.x, y: e.y, vx: Math.cos(a) * 34, vy: Math.sin(a) * 34 * 0.6, z: 0, vz: 95, amount: 1, t: 0, dead: false, label, quest });
  }

  giveXp(n: number): void {
    const before = this.hero.level;
    // past the cap, experience goes to Paragon levels (progress/paragon.ts)
    if (before >= MAX_LEVEL && this.hero.para) {
      this.run.xp += Math.round(n);
      for (const l of addParagonXp(this.hero.para, n)) this.emit({ t: 'paragon', level: l });
      return;
    }
    const paragon: number[] = [];
    const levels = addXp(this.hero, n, (rest) => paragon.push(...addParagonXp(this.hero.para, rest)));
    this.run.xp += Math.round(n);
    for (const l of paragon) this.emit({ t: 'paragon', level: l });
    if (!levels.length) return;
    this.rebuild();
    this.player.hp = this.player.maxHp;
    this.addFx({ kind: 'beam', x: this.player.x, y: this.player.y, life: 0.9, size: 10, color: '#ffe066' });
    this.fxBurst(this.player.x, this.player.y, '#ffe066', 24, 20);
    this.sfx('levelup');
    for (const l of levels) this.emit({ t: 'levelup', level: l });
    // talents open with the specialization at level 10, not before
    if (before < SPEC_LEVEL && this.hero.level >= SPEC_LEVEL) this.emit({ t: 'hint', id: 'spec' });
    this.emit({ t: 'save' });
  }

  /** The boss's death animation finished: rewards and the way out. */
  bossFinished(e: Enemy): void {
    const def = e.boss!.def;
    const h = this.hero;
    if (this.coop?.role === 'host') this.coop.out.push({ t: 'bossDone', id: e.id });
    e.dead = true;
    e.deathT = 0;
    this.bossId = null;
    this.run.bosses += 1;
    const first = !h.bosses[def.id];
    h.bosses[def.id] = (h.bosses[def.id] ?? 0) + 1;
    // Sigil Marks for the quartermaster: more on harder tiers
    const marks = (BOSS_MARKS[def.id] ?? 1) * (1 + this.tier);
    h.marks += marks;
    this.emit({ t: 'toast', text: `+${marks} Sigil Mark${marks === 1 ? '' : 's'}`, tone: 'loot' });
    this.fxBurst(e.x, e.y, '#ffe066', 40, 40);
    this.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.8, size: 80, color: '#ffffff' });
    this.shake(7);
    this.sfx('victory');
    const tier = TIERS[this.tier]!;
    this.giveXp(def.xp * enemyScale(e.level).xp * tier.xp);
    this.dropGold(e.x, e.y, Math.round((def.gold[0] + this.rand() * (def.gold[1] - def.gold[0])) * (1 + 0.2 * (e.level - 1)) * GOLD_FIND));
    const cls = h.cls as ClassId;
    const il = this.keyRun ? keyLoot(this.keyRun.key, this.keyRun.heroLevel) : e.level;
    if (first) {
      for (const id of [...(def.first[cls] ?? []), ...(def.first.any ?? [])]) {
        const it = makeItem(id, il, this.rand);
        if (it) this.dropItem(e.x, e.y, it);
      }
    }
    const pool = [...(def.drops.items[cls] ?? []), ...(def.drops.items.any ?? [])];
    if (pool.length && this.rand() < (def.drops.chance[this.tier] ?? 0.3)) {
      const it = makeItem(pool[Math.floor(this.rand() * pool.length)]!, il, this.rand);
      if (it) this.dropItem(e.x, e.y, it);
    }
    for (let i = 0; i < 1 + this.tier; i++) this.dropItem(e.x, e.y, this.rollItem('boss', il));
    for (let i = 0; i < 3; i++) this.dropAt('orb', e.x, e.y, 1);
    this.emit({ t: 'bossDown', boss: def.id });
    this.questProgress((o) => o.kind === 'boss' && o.boss === def.id);
    // the room opens
    const enc = this.encounters[e.room];
    if (enc) this.clearEncounter(enc);
    // a dungeon's last boss (the one in its last boss room): the way home opens
    const last = [...this.encounters].reverse().find((x) => !!x.def.boss)?.def.boss;
    if (this.region.kind === 'dungeon' && def.id === last) {
      this.cleared = true;
      this.portal = { x: e.x, y: e.y };
      // the Rift's memory of a dungeon is not the dungeon: a young hero's trial earns no Mythic clear, and moves no quest on
      const trial = !!this.keyRun && this.keyRun.heroLevel < SYNC_BELOW;
      const key = `${this.region.id}:${this.tier}`;
      if (!trial) h.clears[key] = (h.clears[key] ?? 0) + 1;
      if (!trial) this.questProgress((o) => o.kind === 'clear' && o.region === this.region.id && o.tier <= this.tier);
      // a guest's clock stops when the host's does (applyKeyEnd)
      if (this.keyRun && !this.puppet) this.endKeyRun(e.x, e.y);
      this.emit({ t: 'cleared' });
    }
    this.emit({ t: 'save' });
  }

  /**
   * A place found before its quest asked for it: going back there still counts (found once, a quest given
   * later could otherwise never be finished).
   */
  private revisit(spot: string): void {
    const h = this.hero;
    if (!QUESTS.some((q) => { if (h.quests[q.id]?.state !== 'active') return false; const o = currentObjective(h, q); return o.kind === 'explore' && o.spot === spot; })) return;
    this.questProgress((o) => o.kind === 'explore' && o.spot === spot);
    this.emit({ t: 'save' });
  }

  /* ------------------------------------------------------------ co-op */

  /** On the host: one of the enemies' attacks struck another player's hero (their game takes the hit). */
  ghostHit(g: Ghost, dmg: number, o: { fromX?: number; fromY?: number; knock?: number; status?: { status: StatusId; dur: number; power: number }; src?: number } = {}): void {
    if (!this.coop || g.dead || g.untouchable || dmg <= 0) return;
    this.coop.out.push({ t: 'hit', n: g.n, dmg: Math.round(dmg), ...o });
  }

  /** Whether another hero of the party is near (enemies in the wilds wake for them as for the hero). */
  nearGhost(x: number, y: number): boolean {
    for (const g of this.coop?.ghosts ?? []) if (!g.dead && Math.abs(x - g.x) <= SLEEP_X && Math.abs(y - g.y) <= SLEEP_Y) return true;
    return false;
  }

  /** Where a hero in a party comes back: the checkpoint, or inside the fight their friends are still in. */
  private coopRespawnAt(): { x: number; y: number } {
    const active = this.encounters.find((enc) => enc.state === 'active');
    if (!active) return this.checkpoint;
    return this.freeTileIn(active.index, this.checkpoint.x, this.checkpoint.y);
  }

  /** The free tile of a room nearest a point. */
  freeTileIn(room: number, x: number, y: number): { x: number; y: number } {
    let best = { x, y };
    let bd = Infinity;
    for (const i of this.map.roomTiles[room] ?? []) {
      if (this.map.solid[i]) continue;
      const tx = ((i % this.map.w) + 0.5) * TILE;
      const ty = (Math.floor(i / this.map.w) + 0.5) * TILE;
      const d = dist2(tx, ty, x, y);
      if (d < bd && !wallNear(this.map, tx, ty, 6)) {
        bd = d;
        best = { x: tx, y: ty };
      }
    }
    return best;
  }

  /**
   * A co-op guest's rooms follow the host's (net/coop.ts): a fight starting seals the doors (and draws
   * in a hero still outside, so nobody is shut out), a cleared one opens them and sets the checkpoint.
   */
  mirrorEncounter(index: number, state: 'idle' | 'active' | 'cleared'): void {
    const enc = this.encounters[index];
    if (!enc || enc.state === state) return;
    if (state === 'active') {
      enc.state = 'active';
      setDoors(this.map, enc.index, true);
      const p = this.player;
      const here = this.map.room[tileAt(this.map, p.x, p.y)] ?? 0;
      if (here !== enc.index + 1 || circleHitsWall(this.map, p.x, p.y, p.r)) {
        const host = this.coop?.ghosts[0];
        const to = this.freeTileIn(enc.index, host?.x ?? p.x, host?.y ?? p.y);
        p.x = to.x;
        p.y = to.y;
        this.addFx({ kind: 'rift', x: p.x, y: p.y, life: 0.6, size: 12, color: '#7fd8ff' });
      }
      this.sfx('doorSlam');
      if (enc.def.title && !enc.def.boss) this.emit({ t: 'banner', text: enc.def.title, sub: `${enc.def.waves.length} waves` });
    } else if (state === 'cleared') this.clearEncounter(enc);
    else {
      enc.state = 'idle';
      setDoors(this.map, enc.index, false);
    }
  }

  /**
   * A co-op guest's copy of one of the host's enemies, under the host's id (its hits and death come and go
   * by it). A boss gets its bar.
   */
  puppetEnemy(id: number, def: string, boss: boolean, x: number, y: number, level: number, room: number): Enemy | null {
    if (boss ? !BOSSES[def] : !ENEMIES[def]) return null;
    const e = boss ? this.addBoss(def, x, y, room) : this.addEnemy(def, x, y, level, { room, pack: -1 });
    e.id = id;
    e.x = x;
    e.y = y;
    e.aggro = true;
    if (boss) {
      this.bossId = id;
      this.emit({ t: 'bossStart', boss: def });
    }
    return e;
  }

  /** Each room's state in one letter (i idle, a active, c cleared), as the host sends it. */
  encounterCode(): string {
    return this.encounters.map((e) => (e.state === 'active' ? 'a' : e.state === 'cleared' ? 'c' : 'i')).join('');
  }

  /* ---------------------------------------------------------- Riftstone */

  /** The clock runs (at full speed even while the hero is down), enemies rage, blood pools heal. */
  private updateKeyRun(rawDt: number, dt: number): void {
    const k = this.keyRun!;
    // (the clock waits for the hero to set off: a step, a blow, a skill, or a fight starting by itself)
    if (!k.going) {
      const i = this.input;
      k.going = !!(i.mx || i.my || i.holdBasic || i.casts.length || this.encounters.some((e) => e.state !== 'idle') || this.coop);
    }
    if (!k.end && k.going) k.t += rawDt;
    if (k.affixes.includes('raging')) {
      for (const e of this.enemies) {
        if (e.dead || e.boss || e.dummy || this.raged.has(e) || e.hp > e.maxHp * 0.3) continue;
        this.raged.add(e);
        e.dmg *= 1.5;
        e.atkMul *= 1.2;
        this.text(e.x, e.y - e.r - 10, 'ENRAGED', '#ff4a4a', false);
        this.addFx({ kind: 'ring', x: e.x, y: e.y, life: 0.4, size: e.r + 10, color: '#ff4a4a' });
      }
    }
    if (this.pools.length) {
      for (const pl of this.pools) {
        pl.t -= dt;
        for (const e of this.enemies) if (!e.dead && !e.boss && dist(e.x, e.y, pl.x, pl.y) < pl.r + e.r && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.05 * dt);
      }
      this.pools = this.pools.filter((pl) => pl.t > 0);
    }
  }

  /** An enemy falls in a Riftstone run: what the week's affixes do with it. */
  private keyOnKill(e: Enemy): void {
    const k = this.keyRun!;
    const p = this.player;
    if (k.affixes.includes('bolstering')) {
      for (const o of this.enemies) {
        if (o === e || o.dead || o.boss || o.dummy || o.room !== e.room || dist(o.x, o.y, e.x, e.y) > 140) continue;
        o.maxHp *= 1.15;
        o.hp *= 1.15;
        o.dmg *= 1.1;
        this.addFx({ kind: 'zap', x: e.x, y: e.y - 4, x2: o.x, y2: o.y - 6, life: 0.25, size: 1, color: '#ffb04d' });
      }
    }
    if (k.affixes.includes('sanguine') && !e.boss) {
      this.pools.push({ x: e.x, y: e.y, r: 26, t: 10 });
      this.spawnField({ x: e.x, y: e.y, r: 26, dur: 10, tick: 0.5, dmg: e.dmg * 0.15, type: 'shadow', look: 'shadow', hostile: true, depth: 0, spec: null, onHit: false });
    }
    if (k.affixes.includes('bursting') && !p.dead && dist(p.x, p.y, e.x, e.y) < 400) {
      // a stack of bleeding: 1.5% of the hero's health a second, for 4 s from the last
      const per = p.maxHp * 0.015;
      const cur = p.statuses.find((x) => x.id === 'bleed');
      if (cur) {
        cur.t = 4;
        cur.power += per;
      } else p.statuses.push({ id: 'bleed', t: 4, power: per, tick: 0.5 });
    }
  }

  /** The last boss falls: the clock stops, the stone grows or drops, and the Rift's cache opens. */
  private endKeyRun(x: number, y: number): void {
    const k = this.keyRun!;
    if (k.end) return;
    const time = k.t + k.deaths * KEY_DEATH;
    const up = keyUpgrade(time, k.par);
    if (this.coop?.role === 'host') this.coop.out.push({ t: 'end', time, up });
    this.finishKeyRun(time, up, x, y);
  }

  /** A co-op guest's run ends with the host's clock: the same time, its own rewards. */
  applyKeyEnd(time: number, up: number): void {
    if (!this.keyRun || this.keyRun.end) return;
    this.finishKeyRun(time, up, this.player.x, this.player.y);
  }

  private finishKeyRun(time: number, up: number, x: number, y: number): void {
    const k = this.keyRun!;
    const h = this.hero;
    const marks = keyMarks(k.key, up > 0);
    // beaten in time, the levels above it open (as in Diablo's rifts, nothing is lost by being late)
    const before = h.keystone;
    // past the cap the stones ask for someone who has stood at Duskspire themselves
    if (up > 0) h.keystone = Math.max(h.keystone, campaignDone(h) ? k.key + up : Math.min(k.key + up, RIFT_CAP_UNFINISHED));
    const best = up > 0 && k.key > (h.bestKeys[this.region.id] ?? 0);
    if (best) h.bestKeys[this.region.id] = k.key;
    k.end = { time, up, marks, stone: h.keystone, best };
    h.marks += marks;
    // the Rift's cache: more the higher the stone, and only in time
    if (up > 0) for (let i = 0; i < keyCache(k.key); i++) this.dropItem(x, y, this.rollItem('boss', keyLoot(k.key, k.heroLevel)));
    // every new stone opened gives one Rift-forged piece the hero doesn't have yet (sets first, as the stones open them)
    const firsts = this.noLoot ? [] : riftFirsts(h, h.keystone, h.keystone - before);
    for (const d of firsts) {
      const it = makeItem(d.id, keyLoot(k.key, k.heroLevel), this.rand);
      if (it) this.dropItem(x, y, it);
    }
    k.end.forged = firsts.map((d) => d.name);
    this.emit({
      t: 'banner',
      text: up > 0 ? `In time: ${clockText(time)}` : `Out of time: ${clockText(time)}`,
      sub: up > 0 ? (h.keystone > before ? `Riftstone +${k.key} · up to Riftstone +${h.keystone} open` : `Riftstone +${k.key}`) : `Riftstone +${k.key} · the clock was ${clockText(k.par)}`,
    });
  }

  /** An enemy is gone (killed, or burst by itself): when the last of its pack is gone, the pack comes back in a while. */
  enemyGone(e: Enemy): void {
    const st = e.pack > 0 ? this.packs[e.pack - 1] : undefined;
    if (st && st.respawnT < 0 && !this.enemies.some((x) => x !== e && !x.dead && st.ids.includes(x.id))) st.respawnT = st.rare ? RESPAWN_RARE : RESPAWN_TIME * (0.8 + this.rand() * 0.5);
  }

  playerDies(): void {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    p.deadT = 0;
    p.hp = 0;
    p.dash = null;
    p.channel = null;
    p.windup = null;
    p.casting = null;
    this.hero.stats.deaths += 1;
    // a guest's fall costs the host's clock (which everyone's shows)
    if (this.puppet) this.coop!.out.push({ t: 'died' });
    if (this.keyRun && !this.keyRun.end) {
      this.keyRun.deaths += 1;
      this.text(p.x, p.y - 30, `-${KEY_DEATH} s`, '#ff4a8a', true);
    }
    this.sfx('playerDie');
    this.shake(5);
    this.emit({ t: 'death' });
  }

  /**
   * Back at the last checkpoint: the room you died in resets. Potions don't come back, but in a story dungeon a hero
   * rises with at least two (RISE_POTIONS): one who spent them all on the boss used to try it again with none, and no
   * vendor between. A Riftstone run keeps its own measure.
   */
  respawn(): void {
    // with friends still fighting, the room stays as it is and the hero comes back into it
    if (this.coop) {
      const at = this.coopRespawnAt();
      const p = this.newPlayer(at.x, at.y);
      p.ult = 0;
      p.iframe = 1.5;
      this.emit({ t: 'hero' });
      return;
    }
    // a boss already in its death throes is felled: the blow that killed it counts
    for (const e of this.enemies) if (e.boss && e.boss.dying > 0 && !e.dead) this.bossFinished(e);
    for (const enc of this.encounters) {
      if (enc.state !== 'active') continue;
      enc.state = 'idle';
      enc.wave = 0;
      setDoors(this.map, enc.index, false);
      this.enemies = this.enemies.filter((e) => e.room !== enc.index);
      if (this.bossId !== null && !this.enemies.some((e) => e.id === this.bossId)) this.bossId = null;
    }
    this.clearHostile();
    this.traps = [];
    for (const e of this.enemies) {
      if (e.aggro && e.room < 0 && !e.dummy) {
        e.state = 'return';
        e.statuses = [];
      }
    }
    const p = this.newPlayer(this.checkpoint.x, this.checkpoint.y);
    if (this.risesWithPotions()) this.hero.potions = Math.max(this.hero.potions, Math.min(RISE_POTIONS, potionCap(this.hero)));
    p.ult = 0;
    p.iframe = 1.5;
    this.emit({ t: 'hero' });
  }

  /** A fall here tops the flask up (respawn): a story dungeon, not a Riftstone run. */
  risesWithPotions(): boolean {
    return !this.coop && !this.keyRun && this.region.kind === 'dungeon';
  }

  /* ----------------------------------------------------------- rooms */

  private updateEncounters(dt: number): void {
    const p = this.player;
    // in a party a room starts with whichever hero walks in first
    const rooms = new Set<number>();
    if (!p.dead) rooms.add(this.map.room[tileAt(this.map, p.x, p.y)] ?? 0);
    for (const g of this.coop?.ghosts ?? []) if (!g.dead) rooms.add(this.map.room[tileAt(this.map, g.x, g.y)] ?? 0);
    if (!rooms.size) return;
    for (const enc of this.encounters) {
      if (enc.state === 'idle' && rooms.has(enc.index + 1)) this.startEncounter(enc);
      if (enc.state !== 'active') continue;
      if (enc.def.boss) continue;
      const alive = this.enemies.some((e) => e.room === enc.index && !e.dead);
      if (alive) continue;
      enc.waveT -= dt;
      if (enc.waveT > 0) continue;
      if (enc.wave < enc.def.waves.length) this.spawnRoomWave(enc);
      else this.clearEncounter(enc);
    }
  }

  private startEncounter(enc: EncounterState): void {
    enc.state = 'active';
    enc.wave = 0;
    enc.waveT = 0.6;
    setDoors(this.map, enc.index, true);
    // the doors may close on someone standing in the doorway: nudge them into the room
    for (const a of [this.player, ...this.enemies]) {
      if (!circleHitsWall(this.map, a.x, a.y, a.r)) continue;
      const to = pushOut(this.map, a.x, a.y, a.r, enc.index);
      if (to) {
        a.x = to.x;
        a.y = to.y;
      }
    }
    this.sfx('doorSlam');
    this.shake(2);
    if (enc.def.boss) {
      const m = this.map.markers.find((pm) => pm.marker.kind === 'boss' && pm.marker.boss === enc.def.boss);
      const pos = m ? markerPos(m) : { x: this.player.x, y: this.player.y - 60 };
      const boss = this.addBoss(enc.def.boss, pos.x, pos.y, enc.index);
      this.addFx({ kind: 'rift', x: boss.x, y: boss.y, life: 1, size: 18, color: '#ff3fd2' });
      this.emit({ t: 'bossStart', boss: enc.def.boss });
      revealBoss(this, boss);
    } else if (enc.def.title) this.emit({ t: 'banner', text: enc.def.title, sub: `${enc.def.waves.length} waves` });
  }

  private spawnRoomWave(enc: EncounterState): void {
    const wave = enc.def.waves[enc.wave]!;
    enc.wave += 1;
    enc.waveT = 0.9;
    const tiles = this.map.roomTiles[enc.index] ?? [];
    const p = this.player;
    const spots = tiles.filter((i) => {
      const x = ((i % this.map.w) + 0.5) * TILE;
      const y = (Math.floor(i / this.map.w) + 0.5) * TILE;
      return !this.map.solid[i] && dist(x, y, p.x, p.y) > 70 && !wallNear(this.map, x, y, 7);
    });
    const used: { x: number; y: number }[] = [];
    wave.enemies.forEach((id, k) => {
      let pos = { x: p.x, y: p.y - 80 };
      for (let tries = 0; tries < 20 && spots.length; tries++) {
        const i = spots[Math.floor(this.rand() * spots.length)]!;
        const c = { x: ((i % this.map.w) + 0.5) * TILE, y: (Math.floor(i / this.map.w) + 0.5) * TILE };
        if (used.every((u) => dist2(u.x, u.y, c.x, c.y) > 26 * 26)) {
          pos = c;
          break;
        }
      }
      used.push(pos);
      this.addEnemy(id, pos.x, pos.y, this.level + (this.rand() < 0.3 ? 1 : 0), { elite: !!wave.elite && k === 0, room: enc.index, pack: -1, spawn: true });
    });
    this.sfx('summon', 0.5);
    if (enc.wave > 1) this.emit({ t: 'banner', text: `Wave ${enc.wave} of ${enc.def.waves.length}` });
  }

  private clearEncounter(enc: EncounterState): void {
    if (enc.state === 'cleared') return;
    enc.state = 'cleared';
    setDoors(this.map, enc.index, false);
    this.sfx('doorOpen');
    if (!enc.def.boss) this.emit({ t: 'banner', text: 'Room cleared', sub: enc.def.title });
    if (enc.def.checkpoint) {
      const tiles = this.map.roomTiles[enc.index] ?? [];
      const p = this.player;
      // the nearest free tile to the hero inside this room
      let best = { x: p.x, y: p.y };
      let bd = Infinity;
      for (const i of tiles) {
        if (this.map.solid[i]) continue;
        const x = ((i % this.map.w) + 0.5) * TILE;
        const y = (Math.floor(i / this.map.w) + 0.5) * TILE;
        const d = dist2(x, y, p.x, p.y);
        if (d < bd) {
          bd = d;
          best = { x, y };
        }
      }
      this.checkpoint = best;
      p.hp = p.maxHp;
      p.mana = p.maxMana;
      this.emit({ t: 'checkpoint' });
      this.emit({ t: 'hero' });
    }
  }

  /** Encounter state for the UI: the active room's title and how many waves are left. */
  activeEncounter(): { title: string; wave: number; waves: number } | null {
    const e = this.encounters.find((x) => x.state === 'active' && !x.def.boss);
    return e ? { title: e.def.title ?? 'Fight!', wave: e.wave, waves: e.def.waves.length } : null;
  }

  /* --------------------------------------------------- hazards, ambience */

  private updateHazards(dt: number): void {
    const p = this.player;
    if (p.dead) return;
    // brambles bite and slow
    const i = tileAt(this.map, p.x, p.y);
    if (i >= 0 && this.map.kind[i] === K.Bramble && !p.dash) {
      this.bramble -= dt;
      if (this.bramble <= 0) {
        this.bramble = 0.6;
        hurtPlayer(this, Math.max(2, p.maxHp * 0.035), {});
        const cur = p.statuses.find((s) => s.id === 'chill');
        if (cur) cur.t = Math.max(cur.t, 0.7);
        else p.statuses.push({ id: 'chill', t: 0.7, power: 0.35, tick: 0 });
      }
    } else this.bramble = 0;
    // spore puffs: step near and they burst; hit them first and the cloud is yours
    for (const s of this.spores) {
      if (!s.ripe) {
        s.t -= dt;
        if (s.t <= 0) s.ripe = true;
        continue;
      }
      if (s.fuse > 0) {
        s.fuse -= dt;
        if (s.fuse <= 0) this.burstSpore(s);
        continue;
      }
      if (dist(p.x, p.y, s.x, s.y) < 18) {
        s.fuse = 0.45;
        s.friendly = false;
        this.addTelegraph({ shape: 'circle', x: s.x, y: s.y, r: 26, r2: 0, angle: 0, len: 0, dur: 0.45, dmg: 0, knock: 0, tone: 'enemy', owner: -1, linger: 0 });
        this.sfx('puff', 0.5);
        continue;
      }
      for (const pr of this.projectiles) {
        if (pr.hostile || pr.dead || dist2(pr.x, pr.y, s.x, s.y) > 64) continue;
        pr.dead = true;
        s.friendly = true;
        this.burstSpore(s);
        break;
      }
    }
    // shrines: discovered by walking up to them
    for (const s of this.shrines) {
      const key = `found:${s.id}`;
      if (dist(p.x, p.y, s.x, s.y) > 34) continue;
      if (this.hero.opened.includes(key)) {
        this.revisit(s.id);
        continue;
      }
      this.hero.opened.push(key);
      this.fxBurst(s.x, s.y, '#9cffd0', 30, 30);
      this.sfx('discover');
      this.emit({ t: 'banner', text: 'The Hidden Grove', sub: 'A secret place', place: true });
      this.emit({ t: 'discover', spot: s.id });
      this.questProgress((o) => o.kind === 'explore' && o.spot === s.id);
      this.emit({ t: 'save' });
    }
    // sights in the wilds: found by walking near; exploring pays a little
    for (const sp of this.spots) {
      const key = `spot:${this.region.id}:${sp.id}`;
      if (dist(p.x, p.y, sp.x, sp.y) > sp.r * TILE) continue;
      if (this.hero.opened.includes(key)) {
        this.revisit(sp.id);
        continue;
      }
      this.hero.opened.push(key);
      this.sfx('discover');
      this.emit({ t: 'banner', text: sp.name, sub: 'Discovered', place: true });
      this.emit({ t: 'discover', spot: sp.id });
      this.giveXp(Math.round(xpToNext(this.hero.level) * EXPLORE_XP));
      this.questProgress((o) => o.kind === 'explore' && o.spot === sp.id);
      this.emit({ t: 'save' });
    }
    // waystones: checkpoints (you come back here if you fall)
    for (const ws of this.waystones) {
      if (dist(p.x, p.y, ws.x, ws.y) > 30) continue;
      if (dist(this.checkpoint.x, this.checkpoint.y, ws.x, ws.y) > 34) {
        this.checkpoint = { x: ws.x, y: ws.y + 18 };
        if (!this.region.safe) this.emit({ t: 'toast', text: 'Waystone attuned: you will return here if you fall', tone: 'info' });
      }
    }
  }

  private burstSpore(s: Spore): void {
    s.ripe = false;
    s.t = 8;
    s.fuse = 0;
    this.fxBurst(s.x, s.y, '#b6e36b', 18, 20);
    this.sfx('puff');
    this.spawnField({ x: s.x, y: s.y, r: 26, dur: 3, tick: 0.5, dmg: s.friendly ? CLASSES[this.hero.cls].refDamage * 0.6 : this.level * 2 + 3, type: 'poison', status: s.friendly ? { status: 'poison', dur: 3, power: 0.3 } : { status: 'poison', dur: 2, power: this.level + 2 }, look: 'poison', hostile: !s.friendly, depth: 1, spec: null, onHit: false });
  }

  private updateAmbient(dt: number): void {
    // villagers keep indoors while the story fights in the streets
    if (this.folk.length && !this.story.fighting) {
      this.folkAround.length = 0;
      this.folkAround.push(this.player);
      for (const n of this.npcs) this.folkAround.push(n);
      for (const q of this.pets) if (!q.dead) this.folkAround.push(q);
      updateFolk(this.folk, this.map, this.folkRand, dt, this.folkAround);
    }
    if (this.critters.length) {
      // the animals bolt from an attack: the hero in a story fight, a roof alight near their home
      const trouble = this.trouble;
      trouble.length = 0;
      if (this.story.fighting) trouble.push(this.player);
      for (const f of this.fires) if (this.time >= f.born) trouble.push(f);
      updateCritters(this.critters, this.map, this.player, this.critterRand, dt, trouble);
    }
    for (const n of this.npcs) {
      n.bob += dt;
      const p = this.player;
      if (dist(n.x, n.y, p.x, p.y) < 60) n.face = p.x < n.x ? -1 : 1;
    }
    // the air of each land: falling leaves, seeds and petals, sea spray, snow, ash, spores, motes, embers, dust. It rolls
    // its own dice (weatherRand): drawn from the fight's, how many flakes the screen had room for (fewer with more spells
    // going off, a third of them with reduced motion) changed every roll after it, and a fight played out differently
    const look = THEMES[this.region.theme];
    const p = this.player;
    const pick = <T,>(l: readonly T[]): T => l[Math.floor(this.weatherRand() * l.length)]!;
    const sx = p.x + (this.weatherRand() - 0.5) * 380;
    const sy = p.y + (this.weatherRand() - 0.5) * 230;
    const a = this.weatherRand() * TAU;
    // reduced motion: a third of the weather
    if (this.settings.reducedMotion && this.weatherRand() > 0.35) return;
    switch (look.ambient) {
      case 'leaves':
        if (this.weatherRand() < dt * 2.2) this.addFx({ kind: 'leaf', x: sx, y: p.y - 130, vx: 12 + this.weatherRand() * 10, vy: 18 + this.weatherRand() * 10, life: 6, size: 1, color: pick([look.leaves[3], look.leaves[4], '#d8b44a']), a });
        break;
      case 'seeds':
        if (this.weatherRand() < dt * 1.6) this.addFx({ kind: 'leaf', x: p.x - 200 + this.weatherRand() * 120, y: sy, vx: 22 + this.weatherRand() * 14, vy: -3 + this.weatherRand() * 6, life: 7, size: 1, color: pick(['#f2ead8', '#ffd84d', '#f2ead8']), a });
        break;
      case 'spray':
        if (this.weatherRand() < dt * 2.4) this.addFx({ kind: 'leaf', x: p.x + 200 - this.weatherRand() * 80, y: sy, vx: -40 - this.weatherRand() * 25, vy: 4 + this.weatherRand() * 4, life: 6, size: 1, color: pick(['#f0fbff', '#e8d4a0']), a });
        break;
      case 'snow':
        // flakes of every size: a few big near ones coming down faster, many small far ones drifting (never so many
        // that a fight's own effects are crowded out)
        for (let n = 0; n < 2 && this.fx.length < 260; n++) {
          if (this.weatherRand() >= dt * 13) continue;
          const big = this.weatherRand() < 0.2;
          this.addFx({ kind: 'flake', x: p.x + (this.weatherRand() - 0.5) * 420, y: p.y - 130 - this.weatherRand() * 50, vx: -9 + this.weatherRand() * 7, vy: (big ? 30 : 19) + this.weatherRand() * 12, life: 7.5, size: big ? 1.7 + this.weatherRand() * 0.9 : 0.6 + this.weatherRand() * 0.6, color: pick(['#ffffff', '#f0f6ff', '#e2ecff']), a: this.weatherRand() });
        }
        break;
      case 'ash':
        if (this.weatherRand() < dt * 3) this.addFx({ kind: 'leaf', x: sx, y: p.y - 130, vx: 6 + this.weatherRand() * 8, vy: 12 + this.weatherRand() * 8, life: 9, size: 1, color: pick(['#8a8a8a', '#b8b0a8', '#5a5a5a']), a });
        break;
      case 'spores':
        if (this.weatherRand() < dt * 2.5) this.addFx({ kind: 'leaf', x: sx, y: sy + 60, vx: -3 + this.weatherRand() * 6, vy: -8 - this.weatherRand() * 6, life: 6, size: 1, color: pick([look.ground.flowers[0], look.ground.flowers[1], look.ground.water.light]), a });
        break;
      case 'motes':
        if (this.weatherRand() < dt * 2) this.addFx({ kind: 'leaf', x: sx, y: sy, vx: -4 + this.weatherRand() * 8, vy: -4 - this.weatherRand() * 4, life: 5, size: 1, color: pick([look.ground.flowers[0], look.ground.flowers[1], look.ground.flowers[3]]), a });
        break;
      case 'embers':
        if (this.weatherRand() < dt * 4) this.addFx({ kind: 'leaf', x: sx, y: p.y + 120, vx: -6 + this.weatherRand() * 12, vy: -26 - this.weatherRand() * 20, life: 5, size: 1, color: pick(['#ff7a2a', '#ffcf5a', '#ff3f1e']), a });
        break;
      case 'dust':
        if (this.weatherRand() < dt * 3) this.addFx({ kind: 'leaf', x: p.x - 200, y: sy, vx: 60 + this.weatherRand() * 30, vy: -2 + this.weatherRand() * 4, life: 6, size: 1, color: pick([look.ground.sand[3], look.ground.sand[1]]), a });
        break;
      default:
        break;
    }
  }

  /* --------------------------------------------------- interactions */

  private updateInteractable(): void {
    const p = this.player;
    let best: Interactable | null = null;
    let bd = 26;
    for (const n of this.npcs) {
      const d = dist(p.x, p.y, n.x, n.y);
      if (d < bd) {
        bd = d;
        best = { kind: 'npc', id: n.id, x: n.x, y: n.y, label: 'Talk' };
      }
    }
    for (const w of this.waystones) {
      const d = dist(p.x, p.y, w.x, w.y);
      if (d < bd + 6) {
        bd = d;
        best = { kind: 'waystone', x: w.x, y: w.y, label: 'Travel' };
      }
    }
    let onExit = -1;
    const mw = this.map.w * TILE;
    const mh = this.map.h * TILE;
    this.exits.forEach((x, i) => {
      const d = dist(p.x, p.y, x.x, x.y);
      // a door is a step away. A road's end is its whole gate: anywhere under the arch, from tower to tower, and
      // not a spot in the middle of it (the owner: "increase the collider of where u enter the gate ... currently u
      // have to hit a specific point within the gate"). Along the land's edge it reaches two tiles and a half either
      // side of the way out, and into the land as far as the gate stands
      let on = d < (x.door ? 15 : 20);
      const least = Math.min(x.x, x.y, mw - x.x, mh - x.y);
      if (!on && !x.door && least < TILE * 2) {
        const across = least === x.y || least === mh - x.y;
        const along = across ? Math.abs(p.x - x.x) : Math.abs(p.y - x.y);
        const deep = across ? Math.abs(p.y - x.y) : Math.abs(p.x - x.x);
        on = along < TILE * 2.5 && deep < TILE * 1.5;
      }
      if (on) {
        onExit = i;
        best = { kind: 'exit', to: x.to, x: x.x, y: x.y, label: x.label, locked: this.exitLock(x), ...(x.door ? { door: true } : {}) };
      }
    });
    // the portal after the final boss
    if (this.portal && dist(p.x, p.y, this.portal.x, this.portal.y) < 22) best = { kind: 'exit', ...this.portalWay(), x: this.portal.x, y: this.portal.y, locked: null };
    this.interactable = p.dead ? null : best;
    // walking onto an exit offers to travel once; stepping off and back on offers again
    if (onExit !== this.exitInside) {
      this.exitInside = onExit;
      if (onExit >= 0 && this.interactable) this.pendingExit = this.interactable;
    }
  }

  /** Why an exit won't take the hero yet (the old roads need a quest, Duskspire all seven sigils; new lands warn the too-young), or null. */
  /**
   * Where the portal after a dungeon's last boss leads: out to the land the dungeon is entered from, at its door
   * (the owner: "once you finish dungeon, portal should teleport you out at the entrance of the dungeon if possible";
   * it used to drop every hero in Briarhollow, a long walk from the next thing to do). Briarhollow still, where
   * there is no such land to stand in: one the story no longer goes through, or one this hero has never found (a
   * Riftstone run is entered from anywhere).
   */
  portalWay(): { to: RegionId; label: string } {
    const out = this.region.kind === 'dungeon' ? this.exits.find((x) => !x.door && !isRetired(x.to) && !!REGIONS[x.to] && this.hero.unlocked.includes(x.to)) : undefined;
    if (!out || out.to === HOME) return { to: HOME, label: 'Portal to Briarhollow' };
    return { to: out.to, label: `Portal out to ${REGIONS[out.to].name}` };
  }

  private exitLock(x: World['exits'][number]): string | null {
    const h = this.hero;
    if ((x.to === 'whisperwood' || x.to === 'crypt') && !h.unlocked.includes(x.to)) return x.to === 'crypt' ? 'The crypt stair is sealed under the chapel floor.' : 'Not open yet.';
    // roads the story opens (the King’s Road to the Crown City)
    if (x.needs && questState(h, x.needs) !== 'done') return `The way is shut: ${QUEST_DEFS[x.needs]?.name ?? 'the story'} first.`;
    // Duskspire's last door: seven locks, one for each sigil. Six turn for the six Elyra carries; the seventh is the
    // Stone's, and the Stone is on the King's brow (Vosk brought it him), so it answers only to his own blood: his
    // brother Aurel, the Herald, opens it from the inside once his voice in the gate is silenced
    if (x.to === 'duskspire' && sigilCount(h) < SIGILS.length) {
      const six = SIGILS.filter((id) => id !== 'sigil-stone' && h.perks.includes(id)).length;
      if (six < SIGILS.length - 1) return `Seven locks bar the gate, one for each sigil. You carry ${six} of the six Elyra can bring.`;
      if (questState(h, 'march-the-voice') !== 'done') return 'Seven locks bar the gate. Six would turn for the sigils Elyra carries; the seventh is the Stone’s, and the Stone is on the King’s brow. It answers only to his own blood.';
    }
    if (x.minLevel && h.level < x.minLevel) {
      const r = REGIONS[x.to];
      return `Too dangerous before level ${x.minLevel}: ${r.name} is for levels ${r.levels[0]}-${r.levels[1]}.`;
    }
    return null;
  }

  /* ----------------------------------------------------- quests */

  questProgress(match: (o: Objective) => boolean, amount = 1): void {
    const news = questEvent(this.hero, match, amount, this.handIns ? turnInNpc : () => null);
    this.emit({ t: 'quest' });
    for (const q of news.stepped) this.emit({ t: 'questStep', quest: q.id });
    for (const q of news.ready) this.emit({ t: 'questReady', quest: q.id });
    if (news.done.length) this.completeQuests(news.done);
  }

  completeQuests(list: QuestDef[]): void {
    const h = this.hero;
    for (const q of list) {
      const r = q.reward;
      this.emit({ t: 'questDone', quest: q.id });
      h.gold += r.gold;
      this.run.gold += r.gold;
      if (r.unlock && !h.unlocked.includes(r.unlock)) h.unlocked.push(r.unlock);
      if (r.tier !== undefined) h.tier = Math.max(h.tier, r.tier);
      // the Riftstone (data/keystones.ts): Riftstone opens
      if (r.keystone && h.keystone < r.keystone) {
        h.keystone = r.keystone;
        this.emit({ t: 'toast', text: `Riftstone +${h.keystone} is open: any dungeon, against the clock. Choose it at a waystone`, tone: 'good' });
      }
      if (r.item) {
        let item: Item | null;
        if (r.item === 'class-epic') {
          // the smith's masterwork: the class's signature epic weapon
          const epic = ITEMS.find((i) => i.cls === h.cls && i.slot === 'weapon' && i.rarity === 'epic');
          item = epic ? makeItem(epic.id, Math.max(3, h.level), this.rand) : rollLoot(h.cls as ClassId, Math.max(3, h.level), 'chest-epic', 0, this.rand);
        }
        else if (typeof r.item === 'string') item = makeItem(r.item, Math.max(ITEM_DEFS[r.item]?.minLevel ?? 1, h.level), this.rand);
        else item = rollLoot(h.cls as ClassId, Math.max(1, h.level), r.item.rarity === 'rare' ? 'chest-rare' : 'quest', 0, this.rand);
        if (item) {
          // quest rewards go straight to the bag (over-full if need be, else they wait for room: never on the ground)
          const full = bagFull(h);
          const got = giveReward(h, item);
          this.run.items.push(item);
          if (got === 'bag') {
            this.emit({ t: 'loot', item });
            if (full) this.emit({ t: 'toast', text: 'Your bag is over-full: salvage or wear something to pick up more.', tone: 'warn' });
            if (h.bag.length === 1 && Object.keys(h.equip).length === 0) this.emit({ t: 'hint', id: 'equip' });
          } else if (got === 'held') this.emit({ t: 'toast', text: `Your bag is full: ${itemName(item)} waits for you and comes into your bag when there is room.`, tone: 'warn' });
          else {
            const g = salvageValue(item);
            h.gold += g;
            this.run.gold += g;
            this.emit({ t: 'toast', text: `Your bag is full: ${itemName(item)} became ${g} gold`, tone: 'warn' });
          }
        }
      }
      if (r.perk && !h.perks.includes(r.perk)) {
        h.perks.push(r.perk);
        // a sigil of the Crown is the story's own moment (the Sigil Rite); the road's gifts are a line of news
        if (r.perk.startsWith('sigil-')) this.emit({ t: 'sigil', id: r.perk });
        else this.emit({ t: 'toast', text: `${PERKS[r.perk].name}: ${PERKS[r.perk].text}`, tone: 'good' });
        this.rebuild();
      }
      // a quest the hero has long out-grown pays less (data/progression.ts)
      this.giveXp(Math.round(r.xp * outlevelled(h.level, q.xpLevel ?? h.level, 1)));
      // a land whose story ends in a deed, not a fight (the Ash Crown unmade in its own memory): the way home opens
      if (this.region.homeAfter === q.id && !this.portal) {
        this.cleared = true;
        this.portal = { x: this.player.x, y: this.player.y - TILE * 1.5 };
        this.fxBurst(this.portal.x, this.portal.y, '#ffe9b0', 30, 24);
      }
      if (q.id === 'rift-shards') h.shards = Math.max(0, h.shards - 3);
    }
    const started = startQuests(h);
    for (const q of started) this.emit({ t: 'questStart', quest: q.id });
    this.creditEarly(started);
    this.emit({ t: 'save' });
  }

  /**
   * A boss beaten before its quest asked for it (Grimtusk felled before the fifteenth kill in the wood) still
   * counts, a moment after the quest begins: its den is empty now, and the hero did what was asked.
   */
  creditEarly(started: QuestDef[]): void {
    const h = this.hero;
    const early = started.filter((q) => { const o = currentObjective(h, q); return o.kind === 'boss' && (h.bosses[o.boss] ?? 0) > 0; });
    if (early.length) this.after(1, () => this.questProgress((o) => early.some((q) => currentObjective(h, q) === o)));
  }

  /* -------------------------------------------------- tutorial hooks */

  dummyHit(spec: SkillSpec | null): void {
    if (!spec) return;
    if (spec.tags.includes('basic')) this.questProgress((o) => o.kind === 'tutorial' && o.step === 'attack');
    else if (!spec.tags.includes('dodge')) this.questProgress((o) => o.kind === 'tutorial' && o.step === 'skill');
  }

  private tutorialSkillCast(): void {
    // skills that don't hit (blink, a trap) still count when used near a dummy
    const near = this.enemies.some((e) => e.dummy && dist(e.x, e.y, this.player.x, this.player.y) < 120);
    const yard = QUEST_DEFS['first-steps'];
    const o = yard && this.hero.quests[yard.id]?.state === 'active' ? currentObjective(this.hero, yard) : null;
    if (near && o?.kind === 'tutorial' && o.step === 'skill') {
      const id = this.input.casts.find((c) => c.slot !== 'basic' && c.slot !== 'dodge')?.slot;
      const spec = id ? this.build.skills[this.build.bar[id] ?? '']?.spec : undefined;
      if (spec && (spec.cast === 'blink' || spec.cast === 'trap' || spec.cast === 'channel')) this.questProgress((o) => o.kind === 'tutorial' && o.step === 'skill');
    }
  }

  /** Why the hero can't call their mount right now, or null. */
  mountRefusal(): string | null {
    const p = this.player;
    const h = this.hero;
    if (!ridingOpen(h)) return `${ridingLocked()}.`;
    if (!riddenMount(h)) return h.mounts.length || shopMountsFor(h).length ? 'Choose a mount in the Wardrobe.' : 'You have no mount yet.';
    if (p.dead || p.channel || p.windup || p.casting || p.dash) return 'Not now.';
    if (this.region.kind === 'dungeon') return 'There is no room to ride down here.';
    if (this.region.interior) return 'Not indoors.';
    if (p.form) return 'Not in beast form.';
    if (this.story.fighting || p.calm < CALM_AFTER) return 'Not in the middle of a fight.';
    return null;
  }

  /** The mount key: call the mount, stop calling it, or get down. */
  toggleMount(): void {
    const p = this.player;
    if (p.riding) {
      this.dismount();
      return;
    }
    if (p.summon > 0) {
      p.summon = 0;
      return;
    }
    const why = this.mountRefusal();
    if (why) {
      this.emit({ t: 'toast', text: why, tone: 'warn' });
      return;
    }
    p.summon = 0.001;
    this.sfx('whistle');
  }

  /** Off the mount (a hit, an action, the story's fight), and any call stops. */
  dismount(): void {
    const p = this.player;
    p.summon = 0;
    if (!p.riding) return;
    p.riding = null;
    this.sfx('dismount');
    for (let i = 0; i < 6; i++) this.addFx({ kind: 'smoke', x: p.x + (this.rand() - 0.5) * 16, y: p.y + 5, vx: (this.rand() - 0.5) * 20, vy: -6, life: 0.5, size: 3, color: 'rgba(200,184,150,0.55)' });
  }

  dodgedSomething(): void {
    this.text(this.player.x, this.player.y - 20, 'DODGED', '#9cf0ff', false);
    this.questProgress((o) => o.kind === 'tutorial' && o.step === 'dodge');
  }

  /** How full the experience bar is. */
  xpShare(): number {
    const h = this.hero;
    if (h.level >= MAX_LEVEL) return h.para ? h.para.x / paragonXp(h.para.l) : 1;
    return h.xp / xpToNext(h.level);
  }

  /** The current boss (for the health bar). */
  boss(): Enemy | null {
    return this.bossId === null ? null : (this.enemyById(this.bossId) ?? null);
  }

  /** Item name helper for events. */
  itemLabel(item: Item): string {
    return itemName(item);
  }
}

function wallNear(m: TileMap, x: number, y: number, r: number): boolean {
  if (circleHitsWall(m, x, y, r)) return true;
  for (const [dx, dy] of [
    [r, 0],
    [-r, 0],
    [0, r],
    [0, -r],
  ] as const) {
    const i = tileAt(m, x + dx, y + dy);
    if (i < 0 || m.solid[i]) return true;
  }
  return false;
}

/** Whether a point (with radius) is inside a telegraph's shape. */
export function inside(t: Telegraph, x: number, y: number, r: number): boolean {
  const d = dist(x, y, t.x, t.y);
  switch (t.shape) {
    case 'circle':
      return d <= t.r + r * 0.5;
    case 'ring':
    case 'donut':
      return d >= t.r2 - r * 0.3 && d <= t.r + r * 0.5;
    case 'line':
      return inLine(x, y, r * 0.5, t.x, t.y, t.angle, t.len, t.r2);
    case 'cone':
      return inCone(x, y, t.x, t.y, t.angle, t.r2, t.r + r * 0.5);
  }
}
