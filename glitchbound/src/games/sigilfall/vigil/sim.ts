import type { ClassId } from '../data/types';
import { BOSS_EVERY, CLASS_BODY, firstSpell, foesOf, landTough, MAX_SPELL, MAX_STRENGTH, partyScale, SPELL_SLOTS, SPELLS, spellsOf, STRENGTH_SLOTS, STRENGTHS, upgradesOf, VIGIL_MAPS, type Element, type FoeDef, type PartyScale, type SpellDef, type StrengthId, type VigilMap } from './kit';

/**
 * The Vigil's simulation, apart from all drawing so it can be tested and run fast: hundreds of foes come at the heroes
 * (a grid keeps them from piling up and finds targets), spells fire by themselves, sparks give experience, and every
 * level offers three cards. Up to four heroes share one night: the host's game runs it and the others watch and steer
 * (vigil/snapshot.ts). Seeded, so a run replays the same given the same input.
 */

export const MAX_FOES = 320;
/** A party's night goes over the wire, so it holds a few less. */
export const MAX_FOES_PARTY = 240;
/** The strength a spell at its top needs, this many levels of it, to evolve. */
export const EVOLVE_AT = 2;
/** How long a party's player has to choose before the first card is taken for them. */
export const CARD_SECONDS = 12;
const CELL = 24;
const OB_CELL = 48;
const HERO_R = 7;
const MAX_FIELDS = 36;
const MAX_SHOTS = 140;
const MAX_FX = 140;
const REVIVE_REACH = 30;
const REVIVE_SECONDS = 3;
const DASH_SECONDS = 0.18;
const DASH_SPEED = 3.2;
const DASH_EVERY = 4;
const FRENZY_SECONDS = 6;

export interface Foe {
  id: number;
  def: FoeDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dmg: number;
  speed: number;
  r: number;
  xp: number;
  face: number;
  walk: number;
  flash: number;
  slow: number;
  frozen: number;
  stun: number;
  /** Can't be stopped again until this runs out: nothing is held forever. */
  immune: number;
  /** How hard it is being thrown. */
  kx: number;
  ky: number;
  /** Where the host last said it was (a follower's game slides it there). */
  tx: number;
  ty: number;
  /** A charger: 0 walking, 1 winding up, 2 charging, 3 getting its breath back. */
  mode: number;
  modeT: number;
  aimX: number;
  aimY: number;
  /** Until it next shoots, or a champion next slams. */
  fireT: number;
  elite: boolean;
  boss: string | null;
  bossSprite: string | null;
  dead: boolean;
}

export interface Shot {
  owner: number;
  spell: string;
  el: Element;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  pierce: number;
  bounce: number;
  color: string;
  /** Comes back to the hero (an axe, a hammer). */
  back: boolean;
  spin: number;
  st: SpellStats;
  hit: Set<number>;
  dead: boolean;
}

/** What the Host throws: slow enough to step out of. */
export interface FoeShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  dead: boolean;
}

/** A champion's blow on its way: stand clear of the ring before it lands. */
export interface Slam {
  x: number;
  y: number;
  r: number;
  dmg: number;
  t: number;
  dur: number;
}

export interface Spark {
  x: number;
  y: number;
  xp: number;
  pulled: boolean;
  dead: boolean;
}

export interface Field {
  owner: number;
  spell: string;
  el: Element;
  x: number;
  y: number;
  r: number;
  dps: number;
  life: number;
  max: number;
  color: string;
  st: SpellStats;
}

export interface Pet {
  owner: number;
  spell: string;
  sprite: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  face: number;
  walk: number;
}

export type PickupKind = 'meat' | 'magnet' | 'bomb' | 'frenzy' | 'chest';

export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  t: number;
  dead: boolean;
}

/** Something to draw for a moment; the drawing picks its picture from the kind and the element. */
export interface Fx {
  kind: 'nova' | 'chain' | 'strike' | 'drop' | 'burst' | 'hit' | 'cone' | 'beam' | 'heal' | 'guard' | 'cast' | 'dash' | 'level' | 'frenzy' | 'summon' | 'slam' | 'bomb';
  x: number;
  y: number;
  t: number;
  dur: number;
  el: Element;
  color: string;
  r?: number;
  /** The way it points. */
  a?: number;
  arc?: number;
  len?: number;
  w?: number;
  /** When a falling thing lands, within its time. */
  at?: number;
  look?: SpellDef['look'];
  freeze?: boolean;
  pts?: [number, number][];
}

export type Card = { kind: 'spell'; id: string; level: number; evolve?: boolean } | { kind: 'up'; id: string; up: string; level: number } | { kind: 'strength'; id: StrengthId; level: number };

export interface VigilInput {
  mx: number;
  my: number;
  dash?: boolean;
}

/** A spell's numbers now: its level, the upgrades taken, its evolution and the hero's strengths, all in. */
export interface SpellStats {
  l: number;
  dmg: number;
  every: number;
  n: number;
  size: number;
  /** × the size of what has no size of its own (a mote, an ember). */
  grow: number;
  pierce: number;
  burst: number;
  bounce: number;
  homing: boolean;
  slow: boolean;
  freeze: boolean;
  stun: number;
  crit: number;
  knock: number;
  leech: number;
  trail: boolean;
  pull: boolean;
  echo: boolean;
  last: number;
  speed: number;
  guard: number;
  heal: number;
  evo: boolean;
}

/** A blast with nothing else about it (a keg, a bomb). */
const PLAIN: SpellStats = { l: 1, dmg: 0, every: 0, n: 1, size: 0, grow: 1, pierce: 0, burst: 0, bounce: 0, homing: false, slow: false, freeze: false, stun: 0, crit: 0, knock: 0, leech: 0, trail: false, pull: false, echo: false, last: 0, speed: 0, guard: 0, heal: 0, evo: false };

export interface Hero {
  id: number;
  cls: ClassId;
  name: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  dirX: number;
  dirY: number;
  hp: number;
  iframe: number;
  spells: Record<string, number>;
  /** The upgrades taken, for each spell. */
  took: Record<string, string[]>;
  evolved: Set<string>;
  strengths: Partial<Record<StrengthId, number>>;
  /** Waiting for this player's pick. */
  cards: Card[] | null;
  /** Level-ups still owed (a burst of sparks can give more than one). */
  owed: number;
  rerolls: number;
  cardT: number;
  cool: Record<string, number>;
  spin: Record<string, number>;
  built: Record<string, SpellStats>;
  dashT: number;
  dashCd: number;
  dashX: number;
  dashY: number;
  dashHit: Set<number>;
  /** Fills with kills; when full the hero goes into a frenzy for a few seconds. */
  frenzy: number;
  frenzyT: number;
  frenzies: number;
  leechLeft: number;
  down: boolean;
  reviveT: number;
  windUsed: boolean;
  /** Set for a moment when struck. */
  struck: number;
  /** Goes up whenever what the hero holds changes, so a party only hears about it then. */
  rev: number;
}

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Quick at first, then a long way between levels: late on, the Host falls by the hundred, and a level stops the night. */
export const xpForLevel = (level: number): number => Math.round(4 + level * 3.1 + level ** 1.5 * 0.8 + (level / 10) ** 3 * 21);
/** The tide: how many of the Host come each second at the start of the night, and at most. */
export const TIDE_START = 2.3;
export const TIDE_MAX = 26;

/** How high a spell goes: its top, or as many upgrades as it has. */
export const topLevel = (def: SpellDef): number => Math.min(MAX_SPELL, 1 + upgradesOf(def).length);

export interface Obstacle {
  x: number;
  y: number;
  r: number;
}

export interface VigilOptions {
  cls?: ClassId;
  map?: VigilMap;
  solid?: (x: number, y: number) => boolean;
  bounds?: { x0: number; y0: number; x1: number; y1: number };
  /** What stands on the land and has to be walked around: the trees the land keeps. */
  obstacles?: Obstacle[];
  /** Who keeps the watch, when it's more than one. */
  party?: { id: number; cls: ClassId; name: string }[];
}

const STILL: VigilInput = { mx: 0, my: 0 };

function newHero(id: number, cls: ClassId, name: string, x: number, y: number): Hero {
  return {
    id,
    cls,
    name,
    x,
    y,
    tx: x,
    ty: y,
    vx: 0,
    vy: 0,
    dirX: 0,
    dirY: 1,
    hp: CLASS_BODY[cls].hp,
    iframe: 0,
    spells: { [firstSpell(cls).id]: 1 },
    took: {},
    evolved: new Set(),
    strengths: {},
    cards: null,
    owed: 0,
    rerolls: 3,
    cardT: 0,
    cool: {},
    spin: {},
    built: {},
    dashT: 0,
    dashCd: 0,
    dashX: 0,
    dashY: 1,
    dashHit: new Set(),
    frenzy: 0,
    frenzyT: 0,
    frenzies: 0,
    leechLeft: 0,
    down: false,
    reviveT: 0,
    windUsed: false,
    struck: 0,
    rev: 0,
  };
}

export class Vigil {
  readonly map: VigilMap;
  readonly heroes: Hero[];
  readonly scale: PartyScale;
  readonly maxFoes: number;
  t = 0;
  level = 1;
  xp = 0;
  kills = 0;
  over = false;
  foes: Foe[] = [];
  shots: Shot[] = [];
  foeShots: FoeShot[] = [];
  slams: Slam[] = [];
  sparks: Spark[] = [];
  fields: Field[] = [];
  pets: Pet[] = [];
  pickups: Pickup[] = [];
  fx: Fx[] = [];
  /** What just happened, for a banner. */
  banner: { text: string; t: number } | null = null;
  /** For the drawing to take as they happen: numbers, deaths and how hard the screen should kick. */
  pops: { x: number; y: number; n: number; big: boolean; crit: boolean }[] = [];
  falls: { x: number; y: number; boss: boolean; elite: boolean }[] = [];
  shake = 0;
  levelFlash = 0;
  /** The host keeps what's new here to send on. */
  fxOut: Fx[] | null = null;

  private rand: () => number;
  private nextId = 1;
  private spawnT = 0;
  private bossesDone = 0;
  private nextEvent = 60;
  private events = 0;
  private grid = new Map<number, Foe[]>();
  private obstacles = new Map<number, Obstacle[]>();
  private beamHit = new Set<number>();
  private later: { at: number; run: () => void }[] = [];
  readonly waves: FoeDef[];
  private readonly solid: (x: number, y: number) => boolean;
  private readonly bounds: { x0: number; y0: number; x1: number; y1: number };

  constructor(seed: number, x: number, y: number, o: VigilOptions = {}) {
    this.rand = rng(seed);
    this.map = o.map ?? VIGIL_MAPS[0]!;
    this.solid = o.solid ?? (() => false);
    this.bounds = o.bounds ?? { x0: 0, y0: 0, x1: 4000, y1: 4000 };
    this.waves = foesOf(this.map);
    const party = o.party?.length ? o.party : [{ id: 0, cls: o.cls ?? ('mage' as ClassId), name: 'You' }];
    this.heroes = party.map((p, i) => newHero(p.id, p.cls, p.name, x + (i - (party.length - 1) / 2) * 22, y));
    this.scale = partyScale(party.length);
    this.maxFoes = party.length > 1 ? MAX_FOES_PARTY : MAX_FOES;
    for (const ob of o.obstacles ?? []) this.addObstacle(ob);
  }

  /* -------------------------------------------------------------- one hero, for a night kept alone */

  get me(): Hero {
    return this.heroes[0]!;
  }
  get cls(): ClassId {
    return this.me.cls;
  }
  get x(): number {
    return this.me.x;
  }
  get y(): number {
    return this.me.y;
  }
  get hp(): number {
    return this.me.hp;
  }
  set hp(n: number) {
    this.me.hp = n;
  }
  get spells(): Record<string, number> {
    return this.me.spells;
  }
  set spells(s: Record<string, number>) {
    this.me.spells = s;
  }
  get evolved(): Set<string> {
    return this.me.evolved;
  }
  get strengths(): Partial<Record<StrengthId, number>> {
    return this.me.strengths;
  }
  get cards(): Card[] | null {
    return this.me.cards;
  }
  get rerolls(): number {
    return this.me.rerolls;
  }
  get owed(): number {
    return this.me.owed;
  }
  set owed(n: number) {
    this.me.owed = n;
  }
  get maxHp(): number {
    return this.maxHpOf(this.me);
  }
  heroOf(id: number): Hero | undefined {
    return this.heroes.find((h) => h.id === id);
  }

  /* -------------------------------------------------------------- what it all adds up to */

  private str(h: Hero, id: StrengthId): number {
    return h.strengths[id] ?? 0;
  }
  maxHpOf(h: Hero): number {
    return CLASS_BODY[h.cls].hp * (1 + this.str(h, 'vigor') * 0.2) * (this.str(h, 'glass') ? 0.75 : 1);
  }
  private powerOf(h: Hero): number {
    return 1 + this.str(h, 'might') * 0.15 + this.str(h, 'glass') * 0.4;
  }
  private paceOf(h: Hero): number {
    return Math.max(0.45, 1 - this.str(h, 'haste') * 0.1);
  }
  private areaOf(h: Hero): number {
    return 1 + this.str(h, 'reach') * 0.12;
  }
  private speedOf(h: Hero): number {
    return CLASS_BODY[h.cls].speed * (1 + this.str(h, 'swift') * 0.08) * (h.frenzyT > 0 ? 1.15 : 1);
  }
  private pickupOf(h: Hero): number {
    return 46 + this.str(h, 'magnet') * 18;
  }
  /** How long until a dash, from empty. */
  dashEvery(h: Hero): number {
    return Math.max(1, DASH_EVERY * 0.75 ** this.str(h, 'ghost'));
  }
  /** How many kills fill the frenzy meter: it never gets too easy, however fast they fall. */
  private frenzyNeed(h: Hero): number {
    return Math.min(400, 30 + h.frenzies * 20 + this.t / 5);
  }
  get xpNext(): number {
    return xpForLevel(this.level);
  }
  /** The Host grows with time and never stops growing: that is the Vigil. */
  private get toughness(): number {
    const m = this.t / 60;
    return (1 + m * 0.14 + (m * m) / 70) * landTough(this.map);
  }

  /** A spell's numbers, right now. */
  statsOf(h: Hero, def: SpellDef): SpellStats {
    const l = h.spells[def.id] ?? 1;
    let dmg = 0;
    let every = 0;
    let size = 0;
    const s: SpellStats = { ...PLAIN, l, slow: !!def.slow, pierce: def.pierce ?? 0 };
    const add = (m: (typeof upgradesOf extends (d: SpellDef) => (infer U)[] ? U : never) | NonNullable<SpellDef['evolve']>): void => {
      dmg += m.dmg ?? 0;
      every += m.every ?? 0;
      size += m.size ?? 0;
      s.n += m.more ?? 0;
      s.pierce += m.pierce ?? 0;
      s.burst += m.burst ?? 0;
      s.bounce += m.bounce ?? 0;
      s.homing ||= !!m.homing;
      s.slow ||= !!m.slow;
      s.freeze ||= !!m.freeze;
      s.stun += m.stun ?? 0;
      s.crit += m.crit ?? 0;
      s.knock += m.knock ?? 0;
      s.leech += m.leech ?? 0;
      s.trail ||= !!m.trail;
      s.pull ||= !!m.pull;
      s.echo ||= !!m.echo;
      s.last += m.last ?? 0;
      s.speed += m.speed ?? 0;
      s.guard += m.guard ?? 0;
    };
    const took = h.took[def.id];
    if (took) {
      const all = upgradesOf(def);
      for (const id of took) {
        const u = all.find((x) => x.id === id);
        if (u) add(u);
      }
    }
    const evo = h.evolved.has(def.id) ? def.evolve : undefined;
    if (evo) add(evo);
    const area = this.areaOf(h);
    const grow = (1 + size) * area;
    s.evo = !!evo;
    s.grow = grow;
    s.dmg = (def.dmg[0] + l * def.dmg[1]) * (1 + dmg) * this.powerOf(h);
    const base = def.every ? Math.max(def.every[2], def.every[0] - l * def.every[1]) : 0;
    s.every = Math.max(0.15, base * (1 + every) * this.paceOf(h));
    s.n += (def.n ? def.n[0] + Math.floor((l - 1) / def.n[1]) : 1) - 1;
    s.size = def.size ? (def.size[0] + l * def.size[1]) * grow : 0;
    s.burst *= area;
    s.crit += this.str(h, 'coin') * 0.08;
    s.heal = def.heal ? ((def.heal[0] + l * def.heal[1]) / 100) * (1 + dmg) : 0;
    return s;
  }

  /* -------------------------------------------------------------- the frame */

  /** Everyone has to have chosen before the night goes on. */
  get choosing(): boolean {
    return this.heroes.some((h) => h.cards);
  }

  /** Input for the one hero, or for each by their id. */
  step(dt: number, input: VigilInput | Record<number, VigilInput>): void {
    if (this.over) return;
    // a browser's first frame can be stamped before the run began: time only goes forward
    if (!(dt > 0)) return;
    if (this.choosing) {
      // a party can't be kept waiting forever by someone who has gone to make tea
      if (this.heroes.length > 1) {
        for (const h of this.heroes) {
          if (h.cards && (h.cardT -= dt) <= 0) this.choose(0, h.id);
        }
      }
      return;
    }
    this.t += dt;
    for (const h of this.heroes) {
      const i = 'mx' in input ? (h === this.me ? (input as VigilInput) : STILL) : ((input as Record<number, VigilInput>)[h.id] ?? STILL);
      this.tickHero(h, dt, i);
    }
    this.spawn(dt);
    this.buildGrid();
    this.moveFoes(dt);
    this.moveFoeShots(dt);
    this.landSlams(dt);
    for (const h of this.heroes) if (!h.down) this.castSpells(h, dt);
    this.runLater();
    this.moveShots(dt);
    this.burnFields(dt);
    this.movePets(dt);
    this.moveSparks(dt);
    this.takePickups(dt);
    this.revive(dt);
    this.fx = this.fx.filter((f) => (f.t += dt) < f.dur);
    this.shake = Math.max(0, this.shake - dt * 32);
    this.levelFlash = Math.max(0, this.levelFlash - dt * 1.2);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    if (this.foes.some((f) => f.dead)) this.foes = this.foes.filter((f) => !f.dead);
    if (this.shots.some((s) => s.dead)) this.shots = this.shots.filter((s) => !s.dead);
    if (this.foeShots.some((s) => s.dead)) this.foeShots = this.foeShots.filter((s) => !s.dead);
    if (this.sparks.some((s) => s.dead)) this.sparks = this.sparks.filter((s) => !s.dead);
    if (this.pickups.some((p) => p.dead)) this.pickups = this.pickups.filter((p) => !p.dead);
    for (const h of this.heroes) while (h.owed > 0 && !h.cards) this.offerCards(h);
    if (this.heroes.every((h) => h.down)) this.over = true;
  }

  private tickHero(h: Hero, dt: number, i: VigilInput): void {
    h.iframe = Math.max(0, h.iframe - dt);
    h.struck = Math.max(0, h.struck - dt * 2.6);
    h.dashCd = Math.max(0, h.dashCd - dt);
    h.frenzyT = Math.max(0, h.frenzyT - dt);
    if (h.down) {
      h.vx = 0;
      h.vy = 0;
      return;
    }
    const max = this.maxHpOf(h);
    h.leechLeft = Math.min(max * 0.08, h.leechLeft + max * 0.05 * dt);
    const mend = this.str(h, 'mend');
    if (mend) h.hp = Math.min(max, h.hp + mend * dt);
    this.moveHero(h, dt, i);
  }

  private moveHero(h: Hero, dt: number, i: VigilInput): void {
    const len = Math.hypot(i.mx, i.my);
    const k = len > 1 ? 1 / len : 1;
    if (len > 0.05) {
      h.dirX = i.mx;
      h.dirY = i.my;
    }
    if (i.dash && h.dashCd <= 0 && h.dashT <= 0) {
      const dl = Math.hypot(h.dirX, h.dirY) || 1;
      h.dashX = h.dirX / dl;
      h.dashY = h.dirY / dl;
      h.dashT = DASH_SECONDS;
      h.dashCd = this.dashEvery(h);
      h.iframe = Math.max(h.iframe, DASH_SECONDS + 0.08);
      h.dashHit.clear();
      this.addFx({ kind: 'dash', x: h.x, y: h.y, t: 0, dur: 0.4, el: 'water', color: '#cfe8ff', a: Math.atan2(h.dashY, h.dashX) });
    }
    const speed = this.speedOf(h);
    if (h.dashT > 0) {
      h.dashT -= dt;
      h.vx = h.dashX * speed * DASH_SPEED;
      h.vy = h.dashY * speed * DASH_SPEED;
      const ghost = this.str(h, 'ghost');
      if (ghost) {
        const burn = (20 + ghost * 14) * (1 + this.t / 240);
        this.around(h.x, h.y, 22, (f) => {
          if (h.dashHit.has(f.id) || Math.hypot(f.x - h.x, f.y - h.y) > 12 + f.r) return;
          h.dashHit.add(f.id);
          this.hurt(f, burn, h);
        });
      }
    } else {
      h.vx = i.mx * k * speed;
      h.vy = i.my * k * speed;
    }
    const nx = h.x + h.vx * dt;
    const ny = h.y + h.vy * dt;
    if (!this.solid(nx, h.y)) h.x = nx;
    if (!this.solid(h.x, ny)) h.y = ny;
    this.avoid(h, HERO_R * 0.8, 0);
    h.x = Math.max(this.bounds.x0, Math.min(this.bounds.x1, h.x));
    h.y = Math.max(this.bounds.y0, Math.min(this.bounds.y1, h.y));
  }

  /* -------------------------------------------------------------- a follower's frame */

  /**
   * On a player's game who isn't the host, the night is run elsewhere and heard about a few times a second
   * (vigil/snapshot.ts). In between, their own hero moves at once and everything else slides to where it last was.
   */
  follow(dt: number, meId: number, input: VigilInput): void {
    if (!(dt > 0)) return;
    const k = Math.min(1, dt * 10);
    const stopped = this.choosing || this.over;
    for (const h of this.heroes) {
      if (h.id === meId && !h.down && !stopped) {
        this.moveHero(h, dt, input);
        // the host has the last word, gently, unless it has been a long way off
        const dx = h.tx - h.x;
        const dy = h.ty - h.y;
        const far = Math.hypot(dx, dy) > 48;
        h.x += far ? dx : dx * Math.min(1, dt * 3);
        h.y += far ? dy : dy * Math.min(1, dt * 3);
      } else {
        h.x += (h.tx - h.x) * k;
        h.y += (h.ty - h.y) * k;
      }
      h.iframe = Math.max(0, h.iframe - dt);
      h.struck = Math.max(0, h.struck - dt * 2.6);
      h.dashCd = Math.max(0, h.dashCd - dt);
      if (stopped) continue;
      for (const id of Object.keys(h.spells)) {
        const def = SPELLS[id];
        if (def?.kind === 'orbit') this.spinOrbit(h, def, (h.built[id] ??= this.statsOf(h, def)), dt);
      }
    }
    if (stopped) return;
    for (const f of this.foes) {
      const mx = f.tx - f.x;
      const my = f.ty - f.y;
      f.x += mx * k;
      f.y += my * k;
      f.flash = Math.max(0, f.flash - dt);
      if (Math.abs(mx) + Math.abs(my) > 0.5 && f.frozen <= 0 && f.stun <= 0) f.walk += dt;
      if (f.modeT > 0) f.modeT -= dt;
    }
    for (const p of this.pets) {
      const mx = p.tx - p.x;
      const my = p.ty - p.y;
      p.x += mx * k;
      p.y += my * k;
      if (Math.abs(mx) + Math.abs(my) > 0.5) p.walk += dt;
    }
    for (const s of this.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.spin += dt * 16;
    }
    for (const s of this.foeShots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    for (const s of this.slams) s.t += dt;
    for (const f of this.fields) f.life = Math.max(0, f.life - dt);
    for (const p of this.pickups) p.t += dt;
    this.t += dt;
    this.fx = this.fx.filter((f) => (f.t += dt) < f.dur);
    this.shake = Math.max(0, this.shake - dt * 32);
    this.levelFlash = Math.max(0, this.levelFlash - dt * 1.2);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
  }

  /* -------------------------------------------------------------- the trees */

  /** What stands on the land, once it's known: the land is built after the night is set up. */
  setObstacles(list: Obstacle[]): void {
    this.obstacles.clear();
    for (const ob of list) this.addObstacle(ob);
  }

  private obKey(cx: number, cy: number): number {
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  /** In every cell a thing could touch it from, so a walker only looks in its own. */
  private addObstacle(ob: Obstacle): void {
    const m = ob.r + 18;
    for (let cx = Math.floor((ob.x - m) / OB_CELL); cx <= Math.floor((ob.x + m) / OB_CELL); cx++) {
      for (let cy = Math.floor((ob.y - m) / OB_CELL); cy <= Math.floor((ob.y + m) / OB_CELL); cy++) {
        const k = this.obKey(cx, cy);
        const cell = this.obstacles.get(k);
        if (cell) cell.push(ob);
        else this.obstacles.set(k, [ob]);
      }
    }
  }

  /** Out of whatever it walked into, and along it: `side` is the way a foe goes around. */
  private avoid(o: { x: number; y: number }, r: number, side: number): void {
    if (!this.obstacles.size) return;
    const cell = this.obstacles.get(this.obKey(Math.floor(o.x / OB_CELL), Math.floor(o.y / OB_CELL)));
    if (!cell) return;
    for (const ob of cell) {
      const dx = o.x - ob.x;
      const dy = o.y - ob.y;
      const min = ob.r + r;
      const d = Math.hypot(dx, dy);
      if (d >= min) continue;
      const nx = d > 0.01 ? dx / d : 1;
      const ny = d > 0.01 ? dy / d : 0;
      o.x = ob.x + nx * min - ny * side;
      o.y = ob.y + ny * min + nx * side;
    }
  }

  /* -------------------------------------------------------------- the Host */

  private standing(): Hero[] {
    return this.heroes.filter((h) => !h.down);
  }

  private anyStanding(): Hero | undefined {
    const up = this.standing();
    return up[Math.floor(this.rand() * up.length)];
  }

  private nearestHero(x: number, y: number): Hero | null {
    let best: Hero | null = null;
    let bd = Infinity;
    for (const h of this.heroes) {
      if (h.down) continue;
      const d = (h.x - x) ** 2 + (h.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  }

  private inSeason(): FoeDef[] {
    return this.waves.filter((f) => this.t >= f.from && this.t < f.to);
  }

  private spawn(dt: number): void {
    // a champion on the hour
    const due = Math.floor(this.t / BOSS_EVERY);
    if (due > this.bossesDone) {
      this.bossesDone = due;
      const list = this.map.champions;
      const b = list[(due - 1) % list.length]!;
      const season = this.inSeason();
      this.addFoe(season[season.length - 1] ?? this.waves[0]!, b.name, b.sprite);
      this.banner = { text: `${b.name} comes`, t: 3 };
    }
    if (this.t >= this.nextEvent) {
      this.nextEvent += 75;
      this.wave();
    }
    // the tide: a crowd from the first seconds, then a flood
    const rate = Math.min(TIDE_MAX, TIDE_START + this.t * 0.022 + (this.t / 60) ** 1.7 * 0.34) * this.scale.count;
    this.spawnT += dt * rate;
    const pool = this.inSeason();
    const total = pool.reduce((a, f) => a + f.weight, 0);
    while (this.spawnT >= 1 && this.foes.length < this.maxFoes) {
      this.spawnT -= 1;
      let n = this.rand() * total;
      const def = pool.find((f) => (n -= f.weight) < 0) ?? pool[0]!;
      // from a while in, one now and then stands out from the crowd: big, tough, and worth stopping for
      this.addFoe(def, null, null, undefined, this.t > 45 && this.rand() < 0.03);
    }
    if (this.spawnT > 1) this.spawnT = 1;
  }

  /** Every so often the tide changes its mind: the Host closes in all around, or pours in from one side. */
  private wave(): void {
    const h = this.anyStanding();
    const pool = this.inSeason();
    if (!h || !pool.length) return;
    const cheap = pool.reduce((a, f) => (f.hp < a.hp ? f : a));
    const room = this.maxFoes - this.foes.length;
    const n = Math.min(room, Math.round((6 + this.t / 8) * this.scale.count));
    if (this.events++ % 2 === 0) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.addFoe(cheap, null, null, { x: h.x + Math.cos(a) * 190, y: h.y + Math.sin(a) * 150 });
      }
      this.banner = { text: 'They’re closing in!', t: 2.4 };
    } else {
      const rush = pool.find((f) => f.ai === 'rush') ?? cheap;
      const a0 = this.rand() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = a0 + (this.rand() - 0.5) * 0.9;
        const d = 215 + this.rand() * 60;
        this.addFoe(rush, null, null, { x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d });
      }
      this.banner = { text: 'A swarm, out of the dark!', t: 2.4 };
    }
  }

  private addFoe(def: FoeDef, boss: string | null, bossSprite: string | null, at?: { x: number; y: number }, elite = false): void {
    const anchor = this.anyStanding() ?? this.me;
    const a = this.rand() * Math.PI * 2;
    const d = 210 + this.rand() * 50;
    const tough = this.toughness;
    // a champion is worth a fight whatever wave it comes with (the night's first a little less: it is where a new
    // keeper learns to step out of a slam)
    const first = !!boss && this.bossesDone <= 1;
    let hp = (boss ? Math.max(def.hp, 90) * tough * (first ? 30 : 38) * this.scale.boss : def.hp * tough) * this.scale.hp;
    if (elite) hp *= 5;
    this.foes.push({
      id: this.nextId++,
      def,
      x: at?.x ?? anchor.x + Math.cos(a) * d,
      y: at?.y ?? anchor.y + Math.sin(a) * d,
      hp,
      maxHp: hp,
      dmg: def.dmg * (1 + (tough - 1) * 0.45) * (boss ? (first ? 1.45 : 1.8) : elite ? 1.25 : 1) * this.scale.dmg,
      speed: def.speed * (boss ? 0.8 : elite ? 0.92 : 1),
      r: def.r * (boss ? 2 : elite ? 1.35 : 1),
      xp: def.xp * (boss ? 25 : elite ? 6 : 1),
      face: 0,
      walk: 0,
      flash: 0,
      slow: 0,
      frozen: 0,
      stun: 0,
      immune: 0,
      kx: 0,
      ky: 0,
      tx: 0,
      ty: 0,
      mode: 0,
      modeT: 0,
      aimX: 0,
      aimY: 0,
      fireT: boss ? 3 : 1 + this.rand() * 2,
      elite,
      boss,
      bossSprite,
      dead: false,
    });
  }

  private buildGrid(): void {
    this.grid.clear();
    for (const f of this.foes) {
      if (f.dead) continue;
      const k = this.key(f.x, f.y);
      const cell = this.grid.get(k);
      if (cell) cell.push(f);
      else this.grid.set(k, [f]);
    }
  }

  private key(x: number, y: number): number {
    return (Math.floor(x / CELL) + 32768) * 65536 + (Math.floor(y / CELL) + 32768);
  }

  /** Every foe near a point (within r plus their own size is the caller's check). */
  private around(x: number, y: number, r: number, visit: (f: Foe) => void): void {
    const x0 = Math.floor((x - r) / CELL);
    const x1 = Math.floor((x + r) / CELL);
    const y0 = Math.floor((y - r) / CELL);
    const y1 = Math.floor((y + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const cell = this.grid.get((cx + 32768) * 65536 + (cy + 32768));
        if (cell) for (const f of cell) if (!f.dead) visit(f);
      }
    }
  }

  private moveFoes(dt: number): void {
    const settle = Math.exp(-7 * dt);
    for (const f of this.foes) {
      if (f.dead) continue;
      f.flash = Math.max(0, f.flash - dt);
      f.slow = Math.max(0, f.slow - dt);
      f.immune = Math.max(0, f.immune - dt);
      if (f.kx || f.ky) {
        f.x += f.kx * dt;
        f.y += f.ky * dt;
        f.kx *= settle;
        f.ky *= settle;
        if (Math.abs(f.kx) + Math.abs(f.ky) < 2) {
          f.kx = 0;
          f.ky = 0;
        }
      }
      if (f.frozen > 0) {
        f.frozen -= dt;
        continue;
      }
      if (f.stun > 0) {
        f.stun -= dt;
        continue;
      }
      const h = this.nearestHero(f.x, f.y);
      if (!h) continue;
      const dx = h.x - f.x;
      const dy = h.y - f.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d;
      const uy = dy / d;
      const sp = f.speed * (f.slow > 0 ? 0.55 : 1);
      let mx = ux * sp;
      let my = uy * sp;
      let hits = f.dmg;
      if (f.boss) {
        // a champion walks and slams: the ring shows where, and there is time to leave it
        if ((f.fireT -= dt) <= 0 && d < 170) {
          f.fireT = 5.5;
          this.slams.push({ x: h.x, y: h.y, r: 46 + f.r, dmg: f.dmg * 1.3, t: 0, dur: 1.1 });
        }
      } else if (f.def.ai === 'rush') {
        // low and weaving
        const weave = Math.sin(this.t * 7 + f.id) * 0.45 * sp;
        mx += -uy * weave;
        my += ux * weave;
      } else if (f.def.ai === 'shoot') {
        // keeps its distance and throws
        if (d < 80) {
          mx *= -0.5;
          my *= -0.5;
        } else if (d < 118) {
          mx = 0;
          my = 0;
        }
        if ((f.fireT -= dt) <= 0 && d < 190) {
          f.fireT = 2.4 + this.rand() * 1.2;
          this.foeShots.push({ x: f.x, y: f.y - f.r, vx: ux * 72, vy: uy * 72, r: 3.5, dmg: f.dmg * 0.8, life: 3.6, dead: false });
        }
      } else if (f.def.ai === 'charge') {
        // stops, lowers its head (the drawing shows which way) and comes, fast, in a straight line
        f.modeT -= dt;
        if (f.mode === 0 && f.modeT <= 0 && d < 130) {
          f.mode = 1;
          f.modeT = 0.7;
          f.aimX = ux;
          f.aimY = uy;
        } else if (f.mode === 1) {
          mx = 0;
          my = 0;
          if (f.modeT <= 0) {
            f.mode = 2;
            f.modeT = 0.55;
          }
        } else if (f.mode === 2) {
          mx = f.aimX * sp * 3.4;
          my = f.aimY * sp * 3.4;
          hits = f.dmg * 1.4;
          if (f.modeT <= 0) {
            f.mode = 3;
            f.modeT = 0.9;
          }
        } else if (f.mode === 3) {
          mx *= 0.35;
          my *= 0.35;
          if (f.modeT <= 0) {
            f.mode = 0;
            f.modeT = 1.5;
          }
        }
      }
      // shoulder apart from neighbors, so the Host spreads into a crowd rather than a stack
      this.around(f.x, f.y, f.r + 10, (o) => {
        if (o === f) return;
        const ox = f.x - o.x;
        const oy = f.y - o.y;
        const od = Math.hypot(ox, oy);
        const reach = f.r + o.r;
        if (od > 0.01 && od < reach) {
          const push = ((reach - od) / reach) * 60;
          mx += (ox / od) * push;
          my += (oy / od) * push;
        }
      });
      f.x += mx * dt;
      f.y += my * dt;
      // around a tree, not through it: odd ones go left of it and even ones right, so a crowd splits
      this.avoid(f, f.r * 0.6, (f.id % 2 ? 1 : -1) * sp * dt);
      if (mx || my) {
        f.face = Math.atan2(my, mx);
        f.walk += dt;
      }
      // the hero far outrun: it comes around again on the near side instead of trailing forever
      if (d > 430 && !f.boss) {
        const a = this.rand() * Math.PI * 2;
        f.x = h.x + Math.cos(a) * 240;
        f.y = h.y + Math.sin(a) * 240;
      }
      if (d < f.r + HERO_R) this.wound(h, hits, f);
    }
  }

  private moveFoeShots(dt: number): void {
    for (const s of this.foeShots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if ((s.life -= dt) <= 0) {
        s.dead = true;
        continue;
      }
      for (const h of this.heroes) {
        if (h.down || Math.hypot(h.x - s.x, h.y - 5 - s.y) > HERO_R + s.r) continue;
        s.dead = true;
        this.wound(h, s.dmg);
        break;
      }
    }
  }

  private landSlams(dt: number): void {
    if (!this.slams.length) return;
    for (const s of this.slams) {
      s.t += dt;
      if (s.t < s.dur) continue;
      this.addFx({ kind: 'slam', x: s.x, y: s.y, t: 0, dur: 0.45, el: 'shadow', color: '#ff6a4a', r: s.r });
      this.shake = Math.max(this.shake, 8);
      for (const h of this.heroes) {
        if (Math.hypot(h.x - s.x, h.y - s.y) < s.r) this.wound(h, s.dmg);
      }
    }
    this.slams = this.slams.filter((s) => s.t < s.dur);
  }

  /** A foe (or what it threw) reaches a hero. */
  private wound(h: Hero, dmg: number, f?: Foe): void {
    if (h.down || h.iframe > 0) return;
    h.hp -= dmg;
    h.iframe = 0.6;
    h.struck = 1;
    this.shake = Math.max(this.shake, 4);
    const thorns = this.str(h, 'thorns');
    if (f && thorns) this.hurt(f, 40 * thorns, h);
    if (h.hp <= 0) this.fall(h);
  }

  private fall(h: Hero): void {
    if (this.str(h, 'wind') && !h.windUsed) {
      h.windUsed = true;
      h.hp = this.maxHpOf(h) * 0.5;
      h.iframe = 2;
      this.banner = { text: 'Second Wind!', t: 2.4 };
      this.blast(h, PLAIN, h.x, h.y, 90, 60 + this.t / 2, 'holy', '#fff0a8');
      return;
    }
    h.hp = 0;
    h.down = true;
    h.reviveT = 0;
    h.dashT = 0;
    if (this.heroes.length > 1 && this.standing().length) this.banner = { text: `${h.name} is down!`, t: 2.4 };
  }

  /** A friend standing close gets a downed hero back on their feet. */
  private revive(dt: number): void {
    if (this.heroes.length < 2) return;
    for (const h of this.heroes) {
      if (!h.down) continue;
      const near = this.heroes.some((o) => !o.down && Math.hypot(o.x - h.x, o.y - h.y) < REVIVE_REACH);
      h.reviveT = near ? h.reviveT + dt : Math.max(0, h.reviveT - dt);
      if (h.reviveT >= REVIVE_SECONDS) {
        h.down = false;
        h.hp = this.maxHpOf(h) * 0.4;
        h.iframe = 2;
        h.reviveT = 0;
        this.addFx({ kind: 'heal', x: h.x, y: h.y, t: 0, dur: 0.7, el: 'holy', color: '#fff0a8', r: 28 });
      }
    }
  }

  /** `trickle` for what keeps touching, frame after frame: burning ground, motes. It neither flashes nor gets a number. */
  private hurt(f: Foe, dmg: number, by?: Hero, crit = false, trickle = false): void {
    if (f.dead) return;
    f.hp -= dmg;
    if (!trickle) {
      f.flash = 0.08;
      if (dmg >= 6 && this.pops.length < 60) this.pops.push({ x: f.x, y: f.y - f.r - 6, n: Math.round(dmg), big: dmg >= 40 || crit, crit });
    }
    if (f.hp <= 0) this.kill(f, by ?? this.me);
  }

  private kill(f: Foe, by: Hero): void {
    f.dead = true;
    this.kills++;
    if (this.falls.length < 60) this.falls.push({ x: f.x, y: f.y - f.r * 0.6, boss: !!f.boss, elite: f.elite });
    if (f.boss) this.shake = Math.max(this.shake, 14);
    this.sparks.push({ x: f.x, y: f.y, xp: f.xp, pulled: false, dead: false });
    // a champion leaves a chest, for whoever gets to it first and everyone with them; a marked foe always leaves
    // something, and the crowd only now and then
    if (f.boss) this.pickups.push({ kind: 'chest', x: f.x, y: f.y, t: 0, dead: false });
    else if (f.elite || this.rand() < 0.005) this.drop(f.x, f.y);
    const fang = this.str(by, 'fang');
    if (fang) this.heal(by, fang * 0.5);
    const keg = this.str(by, 'keg');
    if (keg && this.rand() < keg * 0.08) {
      const dmg = f.maxHp * 0.6 + 15;
      const { x, y } = f;
      this.after(0.06, () => this.blast(by, PLAIN, x, y, 30, dmg, 'fire', '#ffb45c'));
    }
    if (!by.down) {
      by.frenzy += (1 + this.str(by, 'drum') * 0.25) / this.frenzyNeed(by);
      if (by.frenzy >= 1) this.goFrenzy(by);
    }
  }

  private goFrenzy(h: Hero): void {
    h.frenzy = 0;
    h.frenzies++;
    h.frenzyT = FRENZY_SECONDS;
    this.addFx({ kind: 'frenzy', x: h.x, y: h.y, t: 0, dur: 0.8, el: 'fire', color: '#ffb45c', r: 40 });
  }

  private drop(x: number, y: number): void {
    const roll = this.rand() * 12;
    const kind: PickupKind = roll < 5 ? 'meat' : roll < 8 ? 'magnet' : roll < 10 ? 'bomb' : 'frenzy';
    this.pickups.push({ kind, x, y, t: 0, dead: false });
  }

  private nearest(h: Hero, range: number, skip?: Set<number>): Foe | null {
    let best: Foe | null = null;
    let bd = range * range;
    for (const f of this.foes) {
      if (f.dead || skip?.has(f.id)) continue;
      const d = (f.x - h.x) ** 2 + (f.y - h.y) ** 2;
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  /** The closest foe to a point, by way of the grid, for what steers or bounces in flight. */
  private closest(x: number, y: number, range: number, skip?: Set<number>): Foe | null {
    let best: Foe | null = null;
    let bd = range * range;
    this.around(x, y, range, (f) => {
      if (skip?.has(f.id)) return;
      const d = (f.x - x) ** 2 + (f.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = f;
      }
    });
    return best;
  }

  /** Where the Host is thickest, of a few places within reach. */
  private thickest(h: Hero): { x: number; y: number } | null {
    let best: { x: number; y: number; n: number } | null = null;
    for (let i = 0; i < 6; i++) {
      const f = this.foes[Math.floor(this.rand() * this.foes.length)];
      if (!f || Math.hypot(f.x - h.x, f.y - h.y) > 220) continue;
      let n = 0;
      this.around(f.x, f.y, 40, () => n++);
      if (!best || n > best.n) best = { x: f.x, y: f.y, n };
    }
    return best;
  }

  /* -------------------------------------------------------------- effects */

  private addFx(f: Fx): void {
    if (this.fx.length >= MAX_FX) return;
    this.fx.push(f);
    this.fxOut?.push(f);
  }

  private after(seconds: number, run: () => void): void {
    this.later.push({ at: this.t + seconds, run });
  }

  private runLater(): void {
    if (!this.later.length) return;
    const due = this.later.filter((l) => l.at <= this.t);
    if (!due.length) return;
    this.later = this.later.filter((l) => l.at > this.t);
    for (const l of due) l.run();
  }

  private heal(h: Hero, amount: number): void {
    h.hp = Math.min(this.maxHpOf(h), h.hp + amount);
  }

  private healBy(h: Hero, share: number, el: Element, color: string): void {
    const max = this.maxHpOf(h);
    if (h.hp >= max) return;
    this.heal(h, max * share);
    this.addFx({ kind: 'heal', x: h.x, y: h.y, t: 0, dur: 0.7, el, color, r: 24 });
  }

  /** What a spell does to whatever it touches: its damage and everything its upgrades added. `dt` for what keeps touching. */
  private land(h: Hero, f: Foe, st: SpellStats, dmg: number, fromX: number, fromY: number, dt = 0): void {
    if (f.dead) return;
    const crit = st.crit > 0 && this.rand() < st.crit;
    this.hurt(f, dmg * (h.frenzyT > 0 ? 1.2 : 1) * (crit ? 2 : 1), h, crit, dt > 0);
    if (st.slow) f.slow = Math.max(f.slow, dt ? 0.5 : 2);
    if (st.freeze && !f.boss && f.immune <= 0) {
      f.frozen = 1.6;
      f.immune = 2.8;
    }
    if (st.stun && f.immune <= 0) {
      const d = st.stun * (f.boss ? 0.3 : 1);
      f.stun = d;
      f.immune = d + 1.2;
    }
    const heavy = f.boss ? 0.15 : f.elite ? 0.5 : 1;
    const away = st.pull ? -90 : st.knock || (dt ? 0 : 16);
    if (away) {
      const dx = f.x - fromX;
      const dy = f.y - fromY;
      const d = Math.hypot(dx, dy) || 1;
      const force = away * heavy * (dt ? dt * 5 : 1);
      f.kx += (dx / d) * force;
      f.ky += (dy / d) * force;
    }
    if (st.leech) {
      // however many it hits, it heals only so fast
      const take = Math.min(h.leechLeft, st.leech * (dt ? dt * 2 : 1));
      h.leechLeft -= take;
      this.heal(h, take);
    }
  }

  private blast(h: Hero, st: SpellStats, x: number, y: number, r: number, dmg: number, el: Element, color: string, skip?: Foe): void {
    this.addFx({ kind: 'burst', x, y, t: 0, dur: 0.42, el, color, r });
    this.around(x, y, r + 12, (o) => {
      if (o !== skip && Math.hypot(o.x - x, o.y - y) < r + o.r) this.land(h, o, st, dmg, x, y);
    });
  }

  /** Burning ground left behind by a spell that lands. */
  private scorch(h: Hero, def: SpellDef, st: SpellStats, x: number, y: number, r: number, dps: number, life: number): void {
    if (this.fields.length >= MAX_FIELDS) this.fields.shift();
    this.fields.push({ owner: h.id, spell: def.id, el: def.el, x, y, r, dps, life, max: life, color: def.color, st });
  }

  /* -------------------------------------------------------------- spells */

  private castSpells(h: Hero, dt: number): void {
    const pace = h.frenzyT > 0 ? 1.4 : 1;
    for (const id of Object.keys(h.spells)) {
      const def = SPELLS[id];
      if (!def) continue;
      const s = this.statsOf(h, def);
      h.built[id] = s;
      if (def.kind === 'orbit') this.castOrbit(h, def, s, dt);
      else if (def.kind === 'aura') this.castAura(h, s, dt);
      else if (def.kind === 'pet') this.syncPets(h, def, s.n);
      // the rest come round on a clock, and wait for something to hit
      else {
        const left = (h.cool[id] ?? 0) - dt * pace;
        if (left > 0) {
          h.cool[id] = left;
          continue;
        }
        h.cool[id] = 0;
        if (this.cast(h, def, s)) {
          h.cool[id] = s.every;
          if (s.echo) this.after(0.28, () => this.cast(h, def, s));
        }
      }
    }
  }

  private cast(h: Hero, def: SpellDef, s: SpellStats): boolean {
    switch (def.kind) {
      case 'bolt':
        return this.castBolt(h, def, s);
      case 'nova':
        return this.castNova(h, def, s);
      case 'chain':
        return this.castChain(h, def, s);
      case 'strike':
        return this.castStrike(h, def, s);
      case 'field':
        return this.castField(h, def, s);
      case 'cone':
        return this.castCone(h, def, s);
      case 'lance':
        return this.castLance(h, def, s);
      case 'rain':
        return this.castRain(h, def, s);
      case 'pulse':
        return this.castPulse(h, def, s);
      case 'boomerang':
        return this.castBoomerang(h, def, s);
      default:
        return false;
    }
  }

  private shoot(h: Hero, def: SpellDef, s: SpellStats, ang: number, speed: number, r: number, life: number, back: boolean, pierce: number): void {
    if (this.shots.length >= MAX_SHOTS) return;
    this.shots.push({ owner: h.id, spell: def.id, el: def.el, x: h.x, y: h.y - 6, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r, dmg: s.dmg, life, pierce, bounce: s.bounce, color: def.color, back, spin: 0, st: s, hit: new Set(), dead: false });
  }

  private castBolt(h: Hero, def: SpellDef, s: SpellStats): boolean {
    const taken = new Set<number>();
    let any = false;
    for (let i = 0; i < s.n; i++) {
      const t = this.nearest(h, 240, taken) ?? this.nearest(h, 240);
      if (!t) break;
      any = true;
      taken.add(t.id);
      const ang = Math.atan2(t.y - h.y, t.x - h.x) + (i ? (this.rand() - 0.5) * 0.25 : 0);
      this.shoot(h, def, s, ang, 210, 4 * s.grow, 1.5, false, s.pierce);
    }
    return any;
  }

  private castNova(h: Hero, def: SpellDef, s: SpellStats): boolean {
    if (!this.nearest(h, s.size + 8)) return false;
    this.addFx({ kind: 'nova', x: h.x, y: h.y, t: 0, dur: 0.5, el: def.el, color: def.color, r: s.size, freeze: s.freeze });
    if (s.heal) this.healParty(h, s.heal, def);
    this.around(h.x, h.y, s.size + 12, (f) => {
      if (Math.hypot(f.x - h.x, f.y - h.y) <= s.size + f.r) this.land(h, f, s, s.dmg, h.x, h.y);
    });
    return true;
  }

  private castChain(h: Hero, def: SpellDef, s: SpellStats): boolean {
    const seen = new Set<number>();
    const pts: [number, number][] = [[h.x, h.y - 8]];
    let from: { x: number; y: number } = h;
    for (let i = 0; i < s.n; i++) {
      const f: Foe | null = this.closest(from.x, from.y, i === 0 ? 200 : 90, seen);
      if (!f) break;
      seen.add(f.id);
      pts.push([f.x, f.y - 6]);
      this.land(h, f, s, s.dmg, from.x, from.y);
      from = f;
    }
    if (pts.length < 2) return false;
    this.addFx({ kind: 'chain', x: h.x, y: h.y, t: 0, dur: 0.3, el: def.el, color: def.color, pts });
    return true;
  }

  /** Where each circling thing is now (the drawing asks too). */
  orbitPoints(h: Hero): { x: number; y: number; r: number; color: string; spell: string; el: Element }[] {
    const out: { x: number; y: number; r: number; color: string; spell: string; el: Element }[] = [];
    let at = 0;
    for (const id of Object.keys(h.spells)) {
      const def = SPELLS[id];
      if (def?.kind !== 'orbit') continue;
      const s = h.built[id] ?? this.statsOf(h, def);
      const R = (34 + at * 14) * this.areaOf(h);
      const spin = h.spin[id] ?? 0;
      for (let i = 0; i < s.n; i++) {
        const a = spin + (i / s.n) * Math.PI * 2;
        out.push({ x: h.x + Math.cos(a) * R, y: h.y - 4 + Math.sin(a) * R * 0.8, r: 7 * s.grow, color: def.color, spell: id, el: def.el });
      }
      at++;
    }
    return out;
  }

  /** Turns what circles a hero: a follower's game does this too. */
  spinOrbit(h: Hero, def: SpellDef, s: SpellStats, dt: number): void {
    h.spin[def.id] = (h.spin[def.id] ?? 0) + dt * (2.2 + s.l * 0.25) * (1 + s.speed);
  }

  private castOrbit(h: Hero, def: SpellDef, s: SpellStats, dt: number): void {
    this.spinOrbit(h, def, s, dt);
    for (const p of this.orbitPoints(h)) {
      if (p.spell !== def.id) continue;
      this.around(p.x, p.y, p.r + 10, (f) => {
        if (Math.hypot(f.x - p.x, f.y - p.y) < p.r + f.r) this.land(h, f, s, s.dmg * dt, h.x, h.y, dt);
      });
    }
  }

  private castStrike(h: Hero, def: SpellDef, s: SpellStats): boolean {
    let at = this.thickest(h);
    if (!at) return false;
    for (let i = 0; i < s.n; i++) {
      const { x, y } = at;
      const delay = i * 0.14;
      const fall = 0.3;
      this.after(delay, () => {
        this.addFx({ kind: 'strike', x, y, t: 0, dur: 0.72, el: def.el, color: def.color, r: s.size, at: fall, look: def.look ?? 'star' });
        // it draws them in as it falls, so there's more under it when it lands
        if (s.pull) {
          this.around(x, y, s.size * 2.4, (f) => {
            const d = Math.hypot(f.x - x, f.y - y) || 1;
            const heavy = f.boss ? 0.15 : 1;
            f.kx += ((x - f.x) / d) * 150 * heavy;
            f.ky += ((y - f.y) / d) * 150 * heavy;
          });
        }
      });
      this.after(delay + fall, () => {
        this.shake = Math.max(this.shake, 6);
        this.around(x, y, s.size + 12, (f) => {
          if (Math.hypot(f.x - x, f.y - y) < s.size + f.r) this.land(h, f, s, s.dmg, x, y);
        });
        if (s.trail) this.scorch(h, def, s, x, y, s.size * 0.7, s.dmg * 0.25, 3);
      });
      at = this.thickest(h) ?? at;
    }
    return true;
  }

  private castField(h: Hero, def: SpellDef, s: SpellStats): boolean {
    if (!this.nearest(h, 150)) return false;
    const life = 2.4 + s.l * 0.4 + s.last;
    this.scorch(h, def, s, h.x, h.y, s.size, s.dmg, life);
    return true;
  }

  /** The way to swing: at the nearest foe. */
  private aimAt(h: Hero, range: number): number | null {
    const t = this.nearest(h, range);
    return t ? Math.atan2(t.y - h.y, t.x - h.x) : null;
  }

  private castCone(h: Hero, def: SpellDef, s: SpellStats): boolean {
    const a = this.aimAt(h, s.size * 1.2);
    if (a === null) return false;
    // one with `more` goes all the way round
    const arc = s.n > 1 ? Math.PI * 2 : 1.9;
    this.addFx({ kind: 'cone', x: h.x, y: h.y - 4, t: 0, dur: 0.26, el: def.el, color: def.color, a, r: s.size, arc });
    this.around(h.x, h.y, s.size + 12, (f) => {
      const d = Math.hypot(f.x - h.x, f.y - h.y);
      if (d > s.size + f.r) return;
      let da = Math.atan2(f.y - h.y, f.x - h.x) - a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) <= arc / 2 || d < f.r + 6) this.land(h, f, s, s.dmg, h.x, h.y);
    });
    return true;
  }

  private castLance(h: Hero, def: SpellDef, s: SpellStats): boolean {
    const a = this.aimAt(h, 220);
    if (a === null) return false;
    this.beam(h, def, s, a);
    if (s.n > 1) this.beam(h, def, s, a + Math.PI);
    return true;
  }

  private beam(h: Hero, def: SpellDef, s: SpellStats, a: number): void {
    const len = 230;
    this.addFx({ kind: 'beam', x: h.x, y: h.y - 6, t: 0, dur: 0.34, el: def.el, color: def.color, a, len, w: s.size });
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    this.beamHit.clear();
    for (let d = 0; d < len; d += CELL) {
      this.around(h.x + cx * d, h.y + cy * d, CELL + s.size, (f) => {
        if (this.beamHit.has(f.id)) return;
        const px = f.x - h.x;
        const py = f.y - h.y;
        const along = px * cx + py * cy;
        const off = Math.abs(px * cy - py * cx);
        if (along > 0 && along < len && off < s.size + f.r) {
          this.beamHit.add(f.id);
          this.land(h, f, s, s.dmg, h.x, h.y);
        }
      });
    }
  }

  private castRain(h: Hero, def: SpellDef, s: SpellStats): boolean {
    if (!this.nearest(h, 200)) return false;
    for (let i = 0; i < s.n; i++) {
      const f = this.foes[Math.floor(this.rand() * this.foes.length)];
      const near = f && Math.hypot(f.x - h.x, f.y - h.y) < 200;
      const a = this.rand() * Math.PI * 2;
      const d = 30 + this.rand() * 110;
      const x = near ? f.x : h.x + Math.cos(a) * d;
      const y = near ? f.y : h.y + Math.sin(a) * d;
      const delay = i * 0.06;
      const fall = 0.18;
      this.after(delay, () => this.addFx({ kind: 'drop', x, y, t: 0, dur: 0.5, el: def.el, color: def.color, r: s.size, at: fall }));
      this.after(delay + fall, () => {
        this.around(x, y, s.size + 12, (o) => {
          if (Math.hypot(o.x - x, o.y - y) < s.size + o.r) this.land(h, o, s, s.dmg, x, y);
        });
        if (s.burst) this.blast(h, PLAIN, x, y, s.burst, s.dmg * 0.5, def.el, def.color);
        if (s.trail) this.scorch(h, def, s, x, y, s.size, s.dmg * 0.3, 2.2);
      });
    }
    return true;
  }

  private castAura(h: Hero, s: SpellStats, dt: number): void {
    this.around(h.x, h.y, s.size + 12, (f) => {
      if (Math.hypot(f.x - h.x, f.y - h.y) < s.size + f.r) this.land(h, f, s, s.dmg * dt, h.x, h.y, dt);
    });
  }

  /** What burns around a hero all the time, for the drawing. */
  auras(h: Hero): { r: number; color: string; spell: string; el: Element }[] {
    return Object.keys(h.spells).flatMap((id) => {
      const def = SPELLS[id];
      return def?.kind === 'aura' ? [{ r: (h.built[id] ?? this.statsOf(h, def)).size, color: def.color, spell: id, el: def.el }] : [];
    });
  }

  /** Mends the hero, and at half the strength whoever stands close by. */
  private healParty(h: Hero, share: number, def: SpellDef): void {
    this.healBy(h, share, def.el, def.color);
    for (const o of this.heroes) {
      if (o !== h && !o.down && Math.hypot(o.x - h.x, o.y - h.y) < 120) this.healBy(o, share * 0.5, def.el, def.color);
    }
  }

  private castPulse(h: Hero, def: SpellDef, s: SpellStats): boolean {
    const hurt = this.heroes.some((o) => !o.down && o.hp < this.maxHpOf(o) && (o === h || Math.hypot(o.x - h.x, o.y - h.y) < 120));
    if (!hurt && !(s.burst && this.nearest(h, s.burst))) return false;
    this.healParty(h, s.heal, def);
    if (s.guard) {
      h.iframe = Math.max(h.iframe, s.guard);
      this.addFx({ kind: 'guard', x: h.x, y: h.y, t: 0, dur: s.guard, el: def.el, color: def.color, r: 22 });
    }
    // what also burns what is near
    if (s.burst) this.blast(h, s, h.x, h.y, s.burst, (18 + s.l * 9) * this.powerOf(h), def.el, def.color);
    return true;
  }

  private castBoomerang(h: Hero, def: SpellDef, s: SpellStats): boolean {
    const a0 = this.aimAt(h, 220);
    if (a0 === null) return false;
    for (let i = 0; i < s.n; i++) this.shoot(h, def, s, a0 + (i / s.n) * Math.PI * 2, 190, s.size, 1.5, true, 99);
    return true;
  }

  private syncPets(h: Hero, def: SpellDef, n: number): void {
    let have = 0;
    for (const p of this.pets) if (p.owner === h.id && p.spell === def.id) have++;
    for (let i = have; i < n; i++) {
      const x = h.x + (i - n / 2) * 12;
      const y = h.y + 10;
      this.pets.push({ owner: h.id, spell: def.id, sprite: def.sprite ?? 'wolf', x, y, tx: x, ty: y, face: 0, walk: 0 });
      this.addFx({ kind: 'summon', x, y, t: 0, dur: 0.7, el: def.el, color: def.color });
    }
  }

  private movePets(dt: number): void {
    const many = Math.max(1, this.pets.length);
    this.pets.forEach((p, i) => {
      const def = SPELLS[p.spell];
      const h = this.heroOf(p.owner);
      if (!def || !h) return;
      const s = h.built[p.spell] ?? this.statsOf(h, def);
      // each goes for a different foe where it can
      let target: Foe | null = null;
      let best = 200 ** 2;
      for (const f of this.foes) {
        if (f.dead || f.id % many !== i % many) continue;
        const d = (f.x - p.x) ** 2 + (f.y - p.y) ** 2;
        if (d < best) {
          best = d;
          target = f;
        }
      }
      const tx = target ? (target as Foe).x : h.x + Math.cos(this.t + i * 2) * 26;
      const ty = target ? (target as Foe).y : h.y + Math.sin(this.t + i * 2) * 18;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 8) {
        const sp = 130 * (1 + s.speed);
        p.x += (dx / d) * sp * dt;
        p.y += (dy / d) * sp * dt;
        p.walk += dt;
        p.face = Math.atan2(dy, dx);
      }
      this.around(p.x, p.y, 22, (f) => {
        if (Math.hypot(f.x - p.x, f.y - p.y) < 11 + f.r) this.land(h, f, s, s.dmg * dt, p.x, p.y, dt);
      });
    });
  }

  private moveShots(dt: number): void {
    for (const s of this.shots) {
      const h = this.heroOf(s.owner) ?? this.me;
      if (s.back) {
        // out, slowing, then home to the hero's hand
        s.spin += dt * 16;
        const dx = h.x - s.x;
        const dy = h.y - s.y;
        const d = Math.hypot(dx, dy) || 1;
        s.vx += (dx / d) * 300 * dt;
        s.vy += (dy / d) * 300 * dt;
        if (s.life < 1.1 && d < 14) s.dead = true;
      } else if (s.st.homing) {
        const t = this.closest(s.x, s.y, 110, s.hit);
        if (t) {
          let da = Math.atan2(t.y - s.y, t.x - s.x) - Math.atan2(s.vy, s.vx);
          da = Math.atan2(Math.sin(da), Math.cos(da));
          const turn = Math.max(-1, Math.min(1, da)) * 7 * dt;
          const c = Math.cos(turn);
          const n = Math.sin(turn);
          const vx = s.vx * c - s.vy * n;
          s.vy = s.vx * n + s.vy * c;
          s.vx = vx;
        }
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) {
        s.dead = true;
        continue;
      }
      this.around(s.x, s.y, s.r + 12, (f) => {
        if (s.dead || s.hit.has(f.id) || Math.hypot(f.x - s.x, f.y - s.y) > s.r + f.r) return;
        s.hit.add(f.id);
        this.land(h, f, s.st, s.dmg, s.x - s.vx * 0.05, s.y - s.vy * 0.05);
        if (s.st.burst) this.blast(h, PLAIN, f.x, f.y, s.st.burst, s.dmg * 0.5, s.el, s.color, f);
        else if (!s.back) this.addFx({ kind: 'hit', x: f.x, y: f.y - f.r * 0.5, t: 0, dur: 0.3, el: s.el, color: s.color, r: 10 * s.st.grow });
        if (s.st.trail && !s.back) this.scorch(h, SPELLS[s.spell]!, s.st, f.x, f.y, 12 * s.st.grow, s.dmg * 0.5, 1.8);
        if (s.bounce > 0) {
          const next = this.closest(f.x, f.y, 110, s.hit);
          if (next) {
            // on to the next one
            s.bounce--;
            const sp = Math.hypot(s.vx, s.vy);
            const a = Math.atan2(next.y - s.y, next.x - s.x);
            s.vx = Math.cos(a) * sp;
            s.vy = Math.sin(a) * sp;
            s.life = Math.max(s.life, 0.8);
            return;
          }
        }
        if (s.pierce-- <= 0) s.dead = true;
      });
    }
  }

  private burnFields(dt: number): void {
    for (const b of this.fields) {
      b.life -= dt;
      const h = this.heroOf(b.owner) ?? this.me;
      this.around(b.x, b.y, b.r + 12, (f) => {
        if (Math.hypot(f.x - b.x, f.y - b.y) < b.r + f.r) this.land(h, f, b.st, b.dps * dt, b.x, b.y, dt);
      });
    }
    this.fields = this.fields.filter((b) => b.life > 0);
  }

  private moveSparks(dt: number): void {
    for (const g of this.sparks) {
      const h = this.nearestHero(g.x, g.y);
      if (!h) break;
      const d = Math.hypot(h.x - g.x, h.y - g.y) || 1;
      if (d < this.pickupOf(h)) g.pulled = true;
      if (g.pulled) {
        const sp = 240 * dt;
        g.x += ((h.x - g.x) / d) * sp;
        g.y += ((h.y - g.y) / d) * sp;
      }
      if (d < 12) {
        g.dead = true;
        this.gain(g.xp, h);
      }
    }
    // a long night leaves a lot lying around: the oldest go to the heroes rather than being lost
    if (this.sparks.length > 260) {
      for (const g of this.sparks.slice(0, this.sparks.length - 260)) {
        if (g.dead) continue;
        g.dead = true;
        this.gain(g.xp, this.me);
      }
    }
  }

  private takePickups(dt: number): void {
    for (const p of this.pickups) {
      p.t += dt;
      // what lies around only lies around so long, but a chest waits for you
      if (p.kind !== 'chest' && p.t > 40) {
        p.dead = true;
        continue;
      }
      for (const h of this.heroes) {
        if (h.down || Math.hypot(h.x - p.x, h.y - p.y) > 15) continue;
        p.dead = true;
        this.take(p, h);
        break;
      }
    }
  }

  private take(p: Pickup, h: Hero): void {
    if (p.kind === 'meat') {
      this.healBy(h, 0.25, 'nature', '#b8ffb8');
    } else if (p.kind === 'magnet') {
      for (const g of this.sparks) g.pulled = true;
      this.addFx({ kind: 'nova', x: h.x, y: h.y, t: 0, dur: 0.5, el: 'water', color: '#8fd8ff', r: 70 });
    } else if (p.kind === 'bomb') {
      this.shake = Math.max(this.shake, 12);
      this.addFx({ kind: 'bomb', x: h.x, y: h.y, t: 0, dur: 0.6, el: 'fire', color: '#ffb45c', r: 200 });
      this.around(h.x, h.y, 212, (f) => {
        if (Math.hypot(f.x - h.x, f.y - h.y) < 200 + f.r) this.hurt(f, f.boss ? f.maxHp * 0.08 : f.maxHp + 1, h);
      });
    } else if (p.kind === 'frenzy') {
      this.goFrenzy(h);
    } else {
      // a chest is for everyone, whoever got there first
      for (const o of this.heroes) {
        o.owed++;
        o.rerolls++;
      }
      this.banner = { text: 'A chest! Everyone chooses', t: 2 };
      this.addFx({ kind: 'level', x: p.x, y: p.y, t: 0, dur: 0.8, el: 'holy', color: '#ffe39a' });
    }
  }

  private gain(xp: number, h: Hero): void {
    this.xp += xp * (1 + this.str(h, 'fortune') * 0.1) * this.scale.xp;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.levelFlash = 1;
      for (const o of this.heroes) {
        o.owed++;
        this.addFx({ kind: 'level', x: o.x, y: o.y, t: 0, dur: 0.8, el: 'holy', color: '#ffe39a' });
      }
    }
  }

  /* -------------------------------------------------------------- level-ups */

  /** What could be offered now. */
  private pool(h: Hero): Card[] {
    const out: Card[] = [];
    const held = Object.keys(h.spells).length;
    for (const def of spellsOf(h.cls)) {
      const l = h.spells[def.id] ?? 0;
      if (h.evolved.has(def.id)) continue;
      if (l === 0) {
        if (held < SPELL_SLOTS) out.push({ kind: 'spell', id: def.id, level: 1 });
        continue;
      }
      if (l >= topLevel(def)) {
        if (def.evolve && this.str(h, def.evolve.with) >= EVOLVE_AT) out.push({ kind: 'spell', id: def.id, level: l, evolve: true });
        continue;
      }
      // a couple of what it hasn't had yet, different each time
      const took = h.took[def.id] ?? [];
      const open = upgradesOf(def).filter((u) => !took.includes(u.id));
      for (let i = 0; i < 2 && open.length; i++) {
        const u = open.splice(Math.floor(this.rand() * open.length), 1)[0]!;
        out.push({ kind: 'up', id: def.id, up: u.id, level: l + 1 });
      }
    }
    const heldStr = Object.keys(h.strengths).length;
    for (const def of Object.values(STRENGTHS)) {
      const l = h.strengths[def.id] ?? 0;
      if (l >= (def.max ?? MAX_STRENGTH) || (l === 0 && heldStr >= STRENGTH_SLOTS)) continue;
      out.push({ kind: 'strength', id: def.id, level: l + 1 });
    }
    return out;
  }

  private offerCards(h: Hero): void {
    const pool = this.pool(h);
    const picks: Card[] = [];
    const take = (c: Card | undefined): void => {
      if (!c) return;
      picks.push(c);
      pool.splice(pool.indexOf(c), 1);
    };
    const any = (list: Card[]): Card | undefined => list[Math.floor(this.rand() * list.length)];
    // an evolution ready to take is always on the table
    take(pool.find((c) => c.kind === 'spell' && c.evolve));
    // early on there is always a new spell to take: a run of nothing but strengths isn't a run
    if (Object.keys(h.spells).length < 3) take(any(pool.filter((c) => c.kind === 'spell' && c.level === 1)));
    // and something for what you already hold: that's where a run becomes yours
    if (picks.length < 3) take(any(pool.filter((c) => c.kind === 'up')));
    while (picks.length < 3 && pool.length) {
      // two choices about the same spell only if there is nothing else to offer, and spells a little ahead of strengths
      const open = pool.filter((c) => !(c.kind === 'up' && picks.some((p) => p.kind === 'up' && p.id === c.id)));
      const from = open.length ? open : pool;
      const spells = from.filter((c) => c.kind !== 'strength');
      const strengths = from.filter((c) => c.kind === 'strength');
      take(any(this.rand() < 0.55 ? (spells.length ? spells : strengths) : strengths.length ? strengths : spells));
    }
    h.cardT = CARD_SECONDS;
    if (picks.length) {
      h.cards = picks;
      return;
    }
    // nothing left to take: it isn't worth stopping the night for
    h.owed = Math.max(0, h.owed - 1);
    this.healBy(h, 0.3, 'nature', '#b8ffb8');
  }

  reroll(id = this.me.id): void {
    const h = this.heroOf(id);
    if (!h?.cards || h.rerolls <= 0) return;
    h.rerolls--;
    h.rev++;
    this.offerCards(h);
  }

  choose(i: number, id = this.me.id): void {
    const h = this.heroOf(id);
    const c = h?.cards?.[i];
    if (!h || !c) return;
    if (c.kind === 'spell') {
      if (c.evolve) h.evolved.add(c.id);
      else h.spells[c.id] = c.level;
    } else if (c.kind === 'up') {
      h.spells[c.id] = c.level;
      (h.took[c.id] ??= []).push(c.up);
    } else if (c.kind === 'strength') {
      const before = this.maxHpOf(h);
      h.strengths[c.id] = c.level;
      // new health comes filled, and health taken away is gone
      h.hp = Math.min(this.maxHpOf(h), h.hp + Math.max(0, this.maxHpOf(h) - before));
    }
    h.cards = null;
    h.owed = Math.max(0, h.owed - 1);
    h.rev++;
    while (h.owed > 0 && !h.cards) this.offerCards(h);
  }
}
