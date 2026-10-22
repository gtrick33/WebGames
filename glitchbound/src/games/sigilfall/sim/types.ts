import type { BossDef, PatternUse } from '../data/bosses';
import type { PetDef } from '../data/pets';
import type { BuffDef, DmgType, EliteAffix, EnemyDef, GroundSpec, Item, SkillSpec, SlotKey, StatusId } from '../data/types';

/** Runtime state of everything in a region. Positions are pixels; times are seconds. */

export interface Status {
  id: StatusId;
  t: number;
  /** Damage per second (burn, poison stacks), slow share (chill), or percent (shock, mark, armorBreak, weaken). */
  power: number;
  /** Seconds until the next damage tick (burn, poison). */
  tick: number;
  /** Poison stacks are separate entries; this numbers them. */
  stack?: number;
  /** Damage over time came from the player. */
  fromPlayer?: boolean;
  /** A curse's damage type. */
  dtype?: DmgType;
  /** The skill a curse came from (each skill's curse is its own). */
  src?: string;
}

export interface Cooldown {
  /** Seconds until the next charge (counting down with haste). */
  t: number;
  charges: number;
  max: number;
  /** Full recharge time of one charge, before haste. */
  cd: number;
}

export interface Player {
  x: number;
  y: number;
  /** The class's resource (mana, rage, energy, focus or Holy Power; 0 / 0 for a class without one). */
  mana: number;
  maxMana: number;
  vx: number;
  vy: number;
  r: number;
  /** Aim angle (where the hero faces when acting). */
  aim: number;
  /** Sprite facing: 0 down, 1 left, 2 right, 3 up. */
  dir: number;
  hp: number;
  maxHp: number;
  shield: number;
  shieldT: number;
  iframe: number;
  dash: { vx: number; vy: number; t: number; spec: SkillSpec | null; hit: Set<number>; dodge: boolean } | null;
  windup: { slot: SlotKey; spec: SkillSpec; t: number; total: number; angle: number; tx: number; ty: number } | null;
  /** A channel: whirlwinds around the hero, or a drain on one enemy (`target`). */
  channel: { spec: SkillSpec; t: number; tickT: number; target?: number } | null;
  /** Timed buffs (shouts, walls, wings, healing over time). */
  buffs: { def: BuffDef; t: number }[];
  /** A druid's shape (a FormDef id), or null. */
  form: string | null;
  cds: Record<SlotKey, Cooldown>;
  ult: number;
  /** How much ultimate charge hits may still add right now (refills over seconds: see ultFloor in world.ts). */
  ultBudget: number;
  combo: number;
  comboT: number;
  lastDodge: number;
  lastHurt: number;
  /** Seconds since the last fight (regen, music). */
  calm: number;
  statuses: Status[];
  potionT: number;
  /** Healing from hits allowed this second (on-hit healing can't run away). */
  healBudget: number;
  healBudgetT: number;
  dead: boolean;
  deadT: number;
  walkT: number;
  /** Attack animation: seconds left and its angle. */
  actT: number;
  actAngle: number;
  actKind: 'swing' | 'cast' | 'shoot' | 'heavy' | 'spin' | null;
  /** Bigger swing for the combo finisher. */
  actBig: boolean;
  /** Seconds left on the hit flash. */
  flash: number;
}

export type AiState = 'idle' | 'chase' | 'windup' | 'act' | 'recover' | 'spawn' | 'return' | 'dead';

export interface BossState {
  def: BossDef;
  phase: number;
  /** Seconds of rest before the next pattern. */
  rest: number;
  pattern: { use: PatternUse; t: number; step: number; data: Record<string, number> } | null;
  /** Seconds until each pattern may come again. */
  cds: Record<string, number>;
  /** Patterns queued by a phase start. */
  queue: PatternUse[];
  /** Invulnerable while changing phase. */
  shift: number;
  /** Stunned after hitting a wall. */
  dazed: number;
  /** Death animation time. */
  dying: number;
  /** Arena center (for teleports, collapse). */
  cx: number;
  cy: number;
  /** Radius of the safe circle while the arena collapses (0 = not collapsing). */
  collapse: number;
  /** Small counters patterns keep between runs (alternating novas, damage ticks). */
  misc: Record<string, number>;
}

export interface Enemy {
  id: number;
  def: EnemyDef;
  level: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  dmg: number;
  speedMul: number;
  /** Faster attacks (frenzied, hasted). */
  atkMul: number;
  shield: number;
  elite: EliteAffix[];
  boss: BossState | null;
  state: AiState;
  t: number;
  atkCd: number;
  /** Attack direction locked at the start of a wind-up. */
  aimA: number;
  aimX: number;
  aimY: number;
  /** Rush progress (chargers). */
  rushLeft: number;
  rushHit: boolean;
  homeX: number;
  homeY: number;
  aggro: boolean;
  lostT: number;
  pack: number;
  /** Encounter index (rooms) or -1. */
  room: number;
  statuses: Status[];
  flash: number;
  face: number;
  walkT: number;
  hopT: number;
  trailT: number;
  /** A training dummy: takes hits, never dies, shooter dummies fire slow bolts. */
  dummy: 0 | 1 | 2;
  dead: boolean;
  deathT: number;
  /** Damage-type of the killing blow and statuses at death (for kill procs). */
  scale: number;
  strafe: number;
  name: string;
  /** Who it is after: 0 the hero, otherwise a pet's id; re-chosen every `victimT` seconds. */
  victim: number;
  /** A healer's wind-up is for mending this ally (0: an attack). */
  mend: number;
  /** A summoner's wind-up raises its minions; minions know their master. */
  raising: boolean;
  master: number;
  /** Seconds until it can blink again; seconds since it was last hit. */
  blinkT: number;
  /** Seconds before a summoner may raise again. */
  raiseT: number;
  hurtT: number;
  victimT: number;
}

/** A companion fighting for the hero. */
export interface Pet {
  id: number;
  def: PetDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  /** Base damage per attack (the hero's multipliers apply on top). */
  dmg: number;
  atkCd: number;
  /** Seconds it has left (summons that fade), Infinity for one that stays. */
  life: number;
  target: number | null;
  face: number;
  walkT: number;
  flash: number;
  /** Swing or shot animation. */
  actT: number;
  dead: boolean;
  deathT: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Distance it can still travel. */
  life: number;
  hostile: boolean;
  /** Base damage before the hero's multipliers (friendly) or final damage (hostile). */
  dmg: number;
  type: DmgType;
  spec: SkillSpec | null;
  depth: number;
  pierce: number;
  bounce: number;
  hit: number[];
  look: string;
  color: string;
  child: boolean;
  splitDone: boolean;
  trailT: number;
  homing: number;
  age: number;
  knock: number;
  /** Rolls through walls' edges for a moment (quakes). */
  wide: boolean;
  /** Zaps the nearest enemy every `zap` seconds as it flies (Ball Lightning). */
  zapT?: number;
  /** An enemy shot's status on the hero (a web slows). */
  status?: { status: StatusId; dur: number; power: number };
  dead: boolean;
}

export interface Field {
  id: number;
  x: number;
  y: number;
  r: number;
  t: number;
  dur: number;
  tick: number;
  tickT: number;
  dmg: number;
  type: DmgType;
  status?: { status: StatusId; dur: number; power: number };
  look: GroundSpec['look'];
  hostile: boolean;
  depth: number;
  spec: SkillSpec | null;
  /** Hits apply the skill's on-hit effects (arrow rain marks). */
  onHit: boolean;
}

/** A warning shape on the ground that deals its damage when it fills up. */
export interface Telegraph {
  id: number;
  shape: 'circle' | 'ring' | 'line' | 'cone' | 'donut';
  x: number;
  y: number;
  /** Circle/cone radius, ring/donut outer radius. */
  r: number;
  /** Ring/donut inner radius, line width, cone half-angle. */
  r2: number;
  angle: number;
  len: number;
  t: number;
  dur: number;
  dmg: number;
  status?: { status: StatusId; dur: number; power: number };
  knock: number;
  /** Visual: enemy attacks are red; the rift is magenta. */
  tone: 'enemy' | 'rift' | 'player';
  /** For a moving owner: the shape follows it (slams). */
  owner: number;
  /** Friendly telegraphs (meteor) hit enemies instead, via `then`. */
  then?: () => void;
  /** After resolving, leave a lingering beam this long (hits each frame). */
  linger: number;
  dead: boolean;
}

/** An expanding ring hazard (slam shockwaves): touching its edge hurts unless you dodge through. */
export interface Wave {
  id: number;
  x: number;
  y: number;
  r: number;
  speed: number;
  max: number;
  width: number;
  dmg: number;
  hitPlayer: boolean;
  dead: boolean;
}

export interface Trap {
  id: number;
  x: number;
  y: number;
  arm: number;
  life: number;
  spec: SkillSpec;
  dead: boolean;
}

export interface Drop {
  id: number;
  kind: 'gold' | 'item' | 'orb' | 'shard';
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  amount: number;
  item?: Item;
  t: number;
  dead: boolean;
  /** Bag was full: don't keep telling. */
  nagged?: boolean;
}

export interface Chest {
  id: string;
  key: string;
  x: number;
  y: number;
  tier: 'common' | 'rare' | 'epic';
  once: boolean;
  open: boolean;
  openT: number;
}

export interface NpcActor {
  id: string;
  x: number;
  y: number;
  face: number;
  bob: number;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
  big: boolean;
  vy: number;
}

/** Visual-only particles and flashes (never affect play). */
export interface Fx {
  kind: 'spark' | 'smoke' | 'ring' | 'slash' | 'bolt' | 'burst' | 'ember' | 'shard' | 'rubble' | 'ghost' | 'coin' | 'beam' | 'text' | 'rift' | 'leaf' | 'zap' | 'glow';
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  size: number;
  color: string;
  a: number;
  a2: number;
  r2: number;
  /** Chain lightning: the other end. */
  x2: number;
  y2: number;
  sprite?: string;
}

/** What the world tells the engine and the UI after a step. */
export type WorldEvent =
  | { t: 'sfx'; id: string; vol?: number }
  | { t: 'shake'; amount: number }
  | { t: 'toast'; text: string; tone?: 'info' | 'good' | 'warn' | 'loot'; item?: Item }
  | { t: 'loot'; item: Item }
  | { t: 'levelup'; level: number }
  | { t: 'questDone'; quest: string }
  | { t: 'questStart'; quest: string }
  | { t: 'quest' }
  | { t: 'bossStart'; boss: string }
  | { t: 'bossPhase'; banner: string }
  | { t: 'bossDown'; boss: string }
  | { t: 'banner'; text: string; sub?: string }
  | { t: 'death' }
  | { t: 'cleared' }
  | { t: 'hero' }
  | { t: 'save' }
  | { t: 'checkpoint' }
  | { t: 'hint'; id: 'equip' | 'talent' | 'skill' | 'ult' | 'potion' }
  | { t: 'discover'; spot: string };

export type Interactable =
  | { kind: 'npc'; id: string; x: number; y: number; label: string }
  | { kind: 'waystone'; x: number; y: number; label: string }
  | { kind: 'exit'; to: string; x: number; y: number; label: string; locked: string | null };
