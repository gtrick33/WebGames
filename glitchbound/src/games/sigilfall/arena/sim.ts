import type { ClassId } from '../data/types';
import { ABILITIES, BODY, DASH, GCD, OATHS, SIGIL, SLOTS, superOf, type Ability, type CcKind, type Effect } from './abilities';
import { ARENA_H, ARENA_W, ENTRY_GATES, MAPS, type Pillar } from './maps';
import { cleanTalents, type Tune } from './talents';

/**
 * The Ring's simulation: everything about a match but the drawing, so it can be tested, run by a bot at speed, and run
 * by a host for a room of players. A brawl: always on the move (casting only slows you), shots that fly where the
 * target is going and can be dodged with a step, short holds that wear off harder each time, a super filled by
 * fighting, a sigil in the middle worth running for, and the Gloam closing in from the edges so that no match drags.
 * Line of sight still matters (pillars block shots and new casts), and healing fades the longer a match goes.
 */

export const HERO_R = 7;
export const BASE_SPEED = 66;
/** Seconds to prepare in the entry before the gates open. */
export const GATES = 30;
/** Everyone's ready: this long and they lift. */
const GATES_READY = 3;
export const MATCH_LIMIT = 150;
/** How long crowd control's returns stay diminished after one wears off. */
const DR_RESET = 18;
const DR_STEPS = [1, 0.5, 0.25];
/** Shots fly this fast, aimed at where the target will be if they keep on, and land on the first enemy they touch. */
export const BOLT_SPEED = 300;
export const BOLT_R = 6;
/** How much of the target's stride a shot allows for: nearly all, so only a change of step (or a Swift Step) dodges it. */
const LEAD = 0.9;
const QUEUE = 0.35;
/** Casting doesn't stop you, but it slows you to this. */
export const CAST_SLOW = 0.55;
/** Dampening: none for this long, then healing fades, to this share gone at DAMP_FULL. */
const DAMP_FROM = 35;
const DAMP_FULL = 95;
const DAMP_MAX = 0.75;
/** The Gloam: from CLOSE_FROM to CLOSE_TO it closes from past the corners to a small oval in the middle (the oval's
 * size over the ground's half-width and half-height), then over CLOSE_LAST more seconds to nothing; it burns this share
 * of a life a second out in it, and more the longer it goes. */
export const CLOSE_FROM = 40;
export const CLOSE_TO = 80;
const CLOSE_LAST = 30;
export const ZONE_START = 1.45;
export const ZONE_END = 0.32;
const ZONE_BURN = 0.06;
/** The sigil in the middle: first at this, then this long after it's taken. */
export const SIGIL_FIRST = 15;
const SIGIL_EVERY = 22;
/** The super meter fills by this much dealt (healing counts the same), and a little by what's taken. */
const SUPER_DEALT = 900;
const SUPER_TAKEN = 2600;
const CRIT = 0.1;
/** Direct damage over its ability's number; a burst ability's over that; a critical hit's. */
export const HIT_K = 1.12;
export const BURST_K = 1.25;
export const CRIT_K = 1.7;
/** Healing over its ability's number: a little under, so that a healer slows a kill rather than stopping it. */
export const HEAL_K = 0.85;

export interface FighterSetup {
  team: 0 | 1;
  cls: ClassId;
  name: string;
  bar: string[];
  oath?: string;
  talents?: string[];
  /** The room seat playing them (null or missing: the computer, or the local player if `human`). */
  seat?: number | null;
  human?: boolean;
}

export interface MatchSetup {
  seed: number;
  map: string;
  fighters: FighterSetup[];
}

export type AuraKind = 'dot' | 'hot' | 'cc' | 'slow' | 'antiheal' | 'absorb' | 'guard' | 'fury' | 'speed' | 'immune' | 'free' | 'reflect' | 'lastgrace';

export interface Aura {
  /** The ability it came from. */
  ab: string;
  kind: AuraKind;
  src: number;
  t: number;
  dur: number;
  harmful: boolean;
  magic: boolean;
  /** dot and hot: per second. absorb: left. slow, guard, fury, speed, antiheal: the share. lastgrace: the heal. */
  n: number;
  cc?: CcKind;
  still?: boolean;
  phys?: boolean;
  /** A held target: damage taken so far, against what breaks it. */
  took?: number;
  backlash?: number;
  next?: number;
}

export interface Cast {
  ab: string;
  target: number;
  t: number;
  dur: number;
  channel: boolean;
  next: number;
  pushed: number;
}

export interface Fighter {
  id: number;
  team: 0 | 1;
  cls: ClassId;
  name: string;
  bar: string[];
  seat: number | null;
  human: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dirX: number;
  dirY: number;
  walk: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  dead: boolean;
  /** Who they aim harm at, and who they aim help at (themselves if nobody). */
  target: number | null;
  friend: number | null;
  gcd: number;
  cds: Record<string, number>;
  cast: Cast | null;
  auras: Aura[];
  locks: Partial<Record<string, number>>;
  dr: Partial<Record<CcKind, { n: number; until: number }>>;
  dash: { x: number; y: number; speed: number } | null;
  queued: { ab: string; t: number } | null;
  fearX: number;
  fearY: number;
  oath: string | null;
  talents: string[];
  mods: { dmg: number; heal: number; speed: number; tenacity: number; cool: number; regen: number };
  tune: Record<string, Tune>;
  score: { dmg: number; heal: number; cc: number; kicks: number; combos?: number; supers?: number };
  /** The super meter, 0 to 1. */
  charge: number;
}

export interface Bolt {
  ab: string;
  src: number;
  /** Who it was aimed at (it lands on whichever enemy it touches first). */
  tgt: number;
  /** Where it is: `y` is its height in the air over the ground, 8 up. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** How much further it flies before it falls. */
  left: number;
}

export interface SigilStone {
  x: number;
  y: number;
}

export interface Trap {
  ab: string;
  src: number;
  team: 0 | 1;
  x: number;
  y: number;
  arm: number;
  life: number;
  cc: CcKind;
  dur: number;
}

/** What happened this frame, for the drawing and the sounds to take. */
export type MatchEvent =
  | { k: 'num'; id: number; n: number; kind: 'dmg' | 'heal' | 'absorb'; crit: boolean }
  | { k: 'word'; id: number; word: string; bad?: boolean; combo?: boolean }
  | { k: 'ab'; id: number; ab: string }
  | { k: 'land'; id: number; ab: string }
  | { k: 'death'; id: number }
  /** A shot that hit nothing (stone, or the air past its reach). */
  | { k: 'miss'; x: number; y: number; ab: string }
  /** The sigil rises (id -1), or someone takes it. */
  | { k: 'sigil'; id: number; x: number; y: number }
  /** A super goes off. */
  | { k: 'super'; id: number; ab: string };

export type Phase = 'gates' | 'fight' | 'over';

export interface MoveInput {
  mx: number;
  my: number;
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

/** Does the straight line between two points pass clear of every pillar? */
export function clearLine(pillars: Pillar[], ax: number, ay: number, bx: number, by: number): boolean {
  for (const p of pillars) {
    // the slab test: a segment against a box
    let t0 = 0;
    let t1 = 1;
    const dx = bx - ax;
    const dy = by - ay;
    let hit = true;
    for (const [d, a, lo, hi] of [
      [dx, ax, p.x, p.x + p.w],
      [dy, ay, p.y, p.y + p.h],
    ] as const) {
      if (Math.abs(d) < 1e-6) {
        if (a < lo || a > hi) hit = false;
      } else {
        const u0 = (lo - a) / d;
        const u1 = (hi - a) / d;
        t0 = Math.max(t0, Math.min(u0, u1));
        t1 = Math.min(t1, Math.max(u0, u1));
        if (t0 > t1) hit = false;
      }
      if (!hit) break;
    }
    if (hit) return false;
  }
  return true;
}

/** What an oath and talents add up to. */
function built(cls: ClassId, oathId: string | undefined, talentIds: readonly string[] | undefined): Pick<Fighter, 'mods' | 'tune' | 'maxHp' | 'talents' | 'oath'> {
  const oath = OATHS.find((o) => o.id === oathId);
  const list = cleanTalents(cls, talentIds);
  const sum = (key: 'hp' | 'dmg' | 'heal' | 'speed' | 'tenacity' | 'regen'): number => list.reduce((n, x) => n + (x[key] ?? 0), 0);
  const tune: Record<string, Tune> = {};
  for (const x of list) Object.assign(tune, x.tune);
  return {
    oath: oath?.id ?? null,
    talents: list.map((x) => x.id),
    tune,
    maxHp: Math.round(BODY[cls].hp * (1 + (oath?.hp ?? 0) + sum('hp'))),
    mods: {
      dmg: 1 + (oath?.dmg ?? 0) + sum('dmg'),
      heal: 1 + (oath?.heal ?? 0) + sum('heal'),
      speed: 1 + (oath?.speed ?? 0) + sum('speed'),
      tenacity: 1 - Math.min(0.6, (oath?.tenacity ?? 0) + sum('tenacity')),
      cool: 1 - (oath?.cool ?? 0),
      regen: 1 + sum('regen'),
    },
  };
}

export class Match {
  readonly pillars: Pillar[];
  readonly map: string;
  phase: Phase = 'gates';
  t = 0;
  /** When the gates lift. */
  gateAt = GATES;
  clock = 0;
  winner: 0 | 1 | null = null;
  /** Both fell, or nobody did by the end. */
  draw = false;
  fighters: Fighter[];
  bolts: Bolt[] = [];
  traps: Trap[] = [];
  /** The sigil, while it stands waiting to be taken, and when the next one rises. */
  sigil: SigilStone | null = null;
  sigilAt = SIGIL_FIRST;
  events: MatchEvent[] = [];
  private rand: () => number;
  private burnT = 0;
  private warned = false;

  constructor(setup: MatchSetup) {
    this.rand = rng(setup.seed);
    this.map = setup.map;
    const map = MAPS[setup.map] ?? Object.values(MAPS)[0]!;
    this.pillars = map.pillars;
    const count: [number, number] = [0, 0];
    this.fighters = setup.fighters.map((s, id) => {
      const i = count[s.team]++;
      const spot = map.spawns[s.team]![i % map.spawns[s.team]!.length]!;
      const body = BODY[s.cls];
      const made = built(s.cls, s.oath, s.talents);
      return {
        id,
        team: s.team,
        cls: s.cls,
        name: s.name,
        bar: s.bar.filter((b) => ABILITIES[b]?.cls === s.cls && !ABILITIES[b]!.super).slice(0, SLOTS),
        seat: s.seat ?? null,
        human: !!s.human,
        x: spot[0],
        y: spot[1],
        vx: 0,
        vy: 0,
        dirX: s.team === 0 ? 1 : -1,
        dirY: 0,
        walk: 0,
        hp: made.maxHp,
        ...made,
        mana: body.mana,
        maxMana: body.mana,
        dead: false,
        target: null,
        friend: null,
        gcd: 0,
        cds: {},
        cast: null,
        auras: [],
        locks: {},
        dr: {},
        dash: null,
        queued: null,
        fearX: 0,
        fearY: 0,
        score: { dmg: 0, heal: 0, cc: 0, kicks: 0 },
        charge: 0,
      };
    });
  }

  /* -------------------------------------------------------------- what can be asked */

  /** A share of healing gone. Grows through the match so that healers can't hold forever. */
  get dampening(): number {
    return Math.max(0, Math.min(DAMP_MAX, ((this.clock - DAMP_FROM) / (DAMP_FULL - DAMP_FROM)) * DAMP_MAX));
  }

  /** How far the Gloam has closed: the safe oval's size over the ground's half-width and half-height. */
  get zone(): number {
    if (this.clock <= CLOSE_FROM) return ZONE_START;
    if (this.clock <= CLOSE_TO) return ZONE_START + (ZONE_END - ZONE_START) * ((this.clock - CLOSE_FROM) / (CLOSE_TO - CLOSE_FROM));
    // sudden death: on to nothing
    return Math.max(0.001, ZONE_END * (1 - (this.clock - CLOSE_TO) / CLOSE_LAST));
  }

  /** How far out a point is: under 1 is inside the safe oval, over 1 is in the Gloam. */
  zoneAt(x: number, y: number, k = this.zone): number {
    const cx = ARENA_W / 2;
    const cy = ARENA_H / 2;
    return Math.hypot((x - cx) / (cx * k), (y - cy) / (cy * k));
  }

  /** Is this fighter out in the Gloam? */
  inGloam(f: { x: number; y: number }): boolean {
    return this.phase === 'fight' && this.zoneAt(f.x, f.y) > 1;
  }

  /** The abilities everyone has besides their bar: the Swift Step and their class's super. */
  extras(f: Fighter): Ability[] {
    return [DASH, superOf(f.cls)];
  }

  /** Everything solid right now: the stone, and the gates until they lift. */
  private get solid(): Pillar[] {
    return this.phase === 'gates' ? [...this.pillars, ...ENTRY_GATES] : this.pillars;
  }

  sees(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
    return clearLine(this.solid, a.x, a.y - 4, b.x, b.y - 4);
  }

  /** In the entry, a player can still change what they brought. */
  equip(id: number, s: { bar: string[]; oath?: string; talents?: string[] }): boolean {
    const f = this.fighters[id];
    if (!f || this.phase !== 'gates') return false;
    const bar = s.bar.filter((b, i) => ABILITIES[b]?.cls === f.cls && !ABILITIES[b]!.super && s.bar.indexOf(b) === i).slice(0, SLOTS);
    if (bar.length < SLOTS) return false;
    const made = built(f.cls, s.oath, s.talents);
    Object.assign(f, made);
    f.bar = bar;
    f.hp = made.maxHp;
    return true;
  }

  /** Everyone's ready: the gates lift in a moment rather than at the end of the wait. */
  openSoon(): void {
    if (this.phase === 'gates') this.gateAt = Math.min(this.gateAt, this.t + GATES_READY);
  }

  enemiesOf(f: Fighter): Fighter[] {
    return this.fighters.filter((o) => o.team !== f.team && !o.dead);
  }
  friendsOf(f: Fighter): Fighter[] {
    return this.fighters.filter((o) => o.team === f.team && !o.dead);
  }

  held(f: Fighter): Aura | undefined {
    return f.auras.find((a) => a.cc === 'stun' || a.cc === 'fear' || a.cc === 'incap' || a.still);
  }
  rooted(f: Fighter): boolean {
    return f.auras.some((a) => a.cc === 'root') && !f.auras.some((a) => a.kind === 'free');
  }
  silenced(f: Fighter): boolean {
    return f.auras.some((a) => a.cc === 'silence');
  }
  moving(f: Fighter): boolean {
    return Math.hypot(f.vx, f.vy) > 1;
  }

  /** Why this fighter can't use this right now, or null if they can. Doesn't change anything. */
  blocked(f: Fighter, ab: Ability, target?: Fighter | null): string | null {
    if (this.phase !== 'fight') return 'Wait for the gates';
    if (f.dead) return 'You have fallen';
    if (f.auras.some((a) => a.still)) return 'Sealed in ice';
    if (f.cast?.ab === ab.id) return 'Already casting';
    // as in the classic arenas: a cast runs to its end, and what's pressed meanwhile waits (a channel can be cut short)
    if (f.cast && !f.cast.channel && !ab.free) return 'Casting';
    if (!ab.anyState && this.held(f)) return 'You can’t do that now';
    if (ab.school !== 'physical') {
      if (this.silenced(f)) return 'Silenced';
      if ((f.locks[ab.school] ?? 0) > 0) return `${ab.school[0]!.toUpperCase()}${ab.school.slice(1)} is locked`;
    }
    if (ab.super && f.charge < 1) return 'Your super isn’t charged';
    if (ab.effects.some((e) => e.k === 'dash') && this.rooted(f)) return 'Rooted';
    if ((f.cds[ab.id] ?? 0) > 0) return 'Not ready yet';
    if (!ab.free && f.gcd > 0) return 'Not ready yet';
    if (ab.mana > f.mana) return 'Not enough mana';
    if (ab.aim === 'enemy' || ab.aim === 'friend') {
      const t = target === undefined ? this.aimOf(f, ab) : target;
      if (!t) return ab.aim === 'enemy' ? 'Nobody to aim at' : 'Nobody to help';
      if (t.dead) return 'They have fallen';
      if (Math.hypot(t.x - f.x, t.y - f.y) > ab.range + HERO_R) return 'Too far away';
      if (t !== f && !this.sees(f, t)) return 'Out of sight';
    }
    return null;
  }

  /** Who an ability would land on. Without a chosen enemy, the nearest one in sight. */
  aimOf(f: Fighter, ab: Ability): Fighter | null {
    if (ab.aim === 'self' || ab.aim === 'near') return f;
    if (ab.aim === 'friend') {
      const t = f.friend === null ? null : this.fighters[f.friend];
      return t && !t.dead && t.team === f.team ? t : f;
    }
    const t = f.target === null ? null : this.fighters[f.target];
    if (t && !t.dead && t.team !== f.team) return t;
    let best: Fighter | null = null;
    let bd = Infinity;
    for (const o of this.enemiesOf(f)) {
      const d = Math.hypot(o.x - f.x, o.y - f.y) + (this.sees(f, o) ? 0 : 1000);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  /* -------------------------------------------------------------- asking */

  /** A player presses an ability. Null if it went off (or was queued); otherwise why not, in words. */
  press(id: number, abId: string): string | null {
    const f = this.fighters[id];
    const ab = ABILITIES[abId];
    if (!f || !ab || (!f.bar.includes(abId) && !this.extras(f).includes(ab))) return 'You don’t have that';
    const why = this.blocked(f, ab);
    if (!why) {
      this.begin(f, ab);
      return null;
    }
    // a press in the last moments of a cast goes off the moment it lands
    if (why === 'Casting' && f.cast && f.cast.dur - f.cast.t <= QUEUE) {
      f.queued = { ab: ab.id, t: f.cast.dur - f.cast.t + QUEUE };
      return null;
    }
    // a press in the last moments of the global cooldown waits for it, so that a player never feels a dropped key
    if (why === 'Not ready yet' && !ab.free && !ab.super && (f.cds[ab.id] ?? 0) <= QUEUE && f.gcd <= QUEUE) {
      f.queued = { ab: ab.id, t: QUEUE };
      return null;
    }
    return why;
  }

  setTarget(id: number, target: number | null): void {
    const f = this.fighters[id];
    const t = target === null ? null : this.fighters[target];
    if (!f) return;
    if (t && t.team !== f.team) f.target = t.id;
    else if (t && t.team === f.team) f.friend = t.id;
    else f.target = null;
  }

  private begin(f: Fighter, ab: Ability): void {
    const t = this.aimOf(f, ab) ?? f;
    if (!ab.free) f.gcd = GCD;
    f.queued = null;
    // starting something else lets go of the last cast (a free ability goes off alongside it)
    if (!ab.free && f.cast) this.endCast(f);
    if (ab.cast > 0 || ab.channel) {
      f.cast = { ab: ab.id, target: t.id, t: 0, dur: ab.channel ?? ab.cast * (f.tune[ab.id]?.cast ?? 1), channel: !!ab.channel, next: ab.tick ?? 0, pushed: 0 };
      this.events.push({ k: 'ab', id: f.id, ab: ab.id });
      if (ab.channel) this.spend(f, ab);
      return;
    }
    this.spend(f, ab);
    this.fire(f, ab, t);
  }

  private spend(f: Fighter, ab: Ability): void {
    f.mana = Math.max(0, f.mana - ab.mana);
    if (ab.super) {
      f.charge = 0;
      f.score.supers = (f.score.supers ?? 0) + 1;
      this.events.push({ k: 'super', id: f.id, ab: ab.id });
    }
    if (ab.cd > 0) f.cds[ab.id] = ab.cd * f.mods.cool * (f.tune[ab.id]?.cd ?? 1);
  }

  private endCast(f: Fighter): void {
    f.cast = null;
  }

  /** A cast (or an instant) goes off. */
  private fire(f: Fighter, ab: Ability, t: Fighter): void {
    this.events.push({ k: 'ab', id: f.id, ab: ab.id });
    if (ab.aim === 'near') {
      for (const o of this.enemiesOf(f)) {
        if (Math.hypot(o.x - f.x, o.y - f.y) <= ab.range + HERO_R && this.sees(f, o)) this.land(f, ab, o, true);
      }
      return;
    }
    if (ab.bolt && t !== f) {
      this.bolts.push(this.aim(f, ab, t));
      return;
    }
    this.land(f, ab, t, false);
  }

  /** A shot leaves: at where they'll be when it gets there, if they keep going the way they are. */
  private aim(f: Fighter, ab: Ability, t: Fighter): Bolt {
    let ax = t.x;
    let ay = t.y;
    for (let i = 0; i < 2; i++) {
      const time = Math.hypot(ax - f.x, ay - f.y) / BOLT_SPEED;
      ax = t.x + t.vx * time * LEAD;
      ay = t.y + t.vy * time * LEAD;
    }
    const d = Math.hypot(ax - f.x, ay - f.y) || 1;
    return { ab: ab.id, src: f.id, tgt: t.id, x: f.x, y: f.y - 8, vx: ((ax - f.x) / d) * BOLT_SPEED, vy: ((ay - f.y) / d) * BOLT_SPEED, left: ab.range + HERO_R + 40 };
  }

  /** It reaches them. A blow already in the air lands whatever has come between: the time to dodge was before it left. */
  private land(f: Fighter, ab: Ability, target: Fighter, area: boolean): void {
    let t = target;
    const harmful = ab.aim === 'enemy' || ab.aim === 'near';
    if (harmful && !area && ab.school !== 'physical') {
      const mirror = t.auras.find((a) => a.kind === 'reflect');
      if (mirror) {
        t.auras.splice(t.auras.indexOf(mirror), 1);
        this.events.push({ k: 'word', id: t.id, word: 'Reflected' });
        if (f.dead) return;
        t = f;
      }
    }
    this.events.push({ k: 'land', id: t.id, ab: ab.id });
    if (harmful && this.immuneTo(t, ab)) {
      this.events.push({ k: 'word', id: t.id, word: 'Immune' });
      return;
    }
    // a combo: what this hero set up on them (or the hold they're in) makes this land harder
    let boost = 1;
    let combo: Ability['combo'] | null = null;
    const c = ab.combo;
    if (c && !t.dead) {
      const mine = (a: Aura): boolean => !!c.ab?.includes(a.ab) && a.src === f.id;
      if (t.auras.some((a) => mine(a) || (!!a.cc && !!c.cc?.includes(a.cc)))) {
        combo = c;
        boost = c.mult;
        if (c.consume) t.auras = t.auras.filter((a) => !mine(a));
        f.score.combos = (f.score.combos ?? 0) + 1;
        this.events.push({ k: 'word', id: t.id, word: c.name, combo: true });
      }
    }
    for (const e of ab.effects) {
      if (t.dead && e.k !== 'heal') break;
      if (this.apply(f, ab, t, e, boost) === 'stop') break;
    }
    if (combo?.extra) for (const e of combo.extra) if (!t.dead || e.k === 'heal') this.apply(f, ab, t, e);
  }

  private immuneTo(t: Fighter, ab: Ability): boolean {
    return t.auras.some((a) => a.kind === 'immune' && (!a.phys || ab.school === 'physical'));
  }

  private addAura(t: Fighter, a: Omit<Aura, 't'>): Aura {
    // the same thing from the same hand refreshes rather than stacks
    const same = t.auras.findIndex((o) => o.ab === a.ab && o.kind === a.kind && o.src === a.src);
    if (same >= 0) t.auras.splice(same, 1);
    const aura: Aura = { ...a, t: a.dur };
    t.auras.push(aura);
    return aura;
  }

  private apply(f: Fighter, ab: Ability, t: Fighter, e: Effect, boost = 1): 'stop' | void {
    const magic = ab.school !== 'physical' && !ab.sticky;
    const base = { ab: ab.id, src: f.id, dur: 0, magic, n: 0 };
    const power = (f.tune[ab.id]?.power ?? 1) * boost;
    switch (e.k) {
      case 'dmg':
        this.damage(f, t, e.n * power, true, ab);
        // what drains gives back: an ability with both heals its user
        return;
      case 'heal':
        this.heal(f, ab.aim === 'enemy' ? f : t, e.n * power);
        return;
      case 'dot':
        this.addAura(t, { ...base, kind: 'dot', harmful: true, dur: e.dur, n: (e.n * power) / e.dur, next: 1 });
        return;
      case 'hot':
        this.addAura(t, { ...base, kind: 'hot', harmful: false, dur: e.dur, n: (e.n * power) / e.dur, next: 1 });
        return;
      case 'cc':
        return this.crowd(f, ab, t, e.cc, e.dur * (f.tune[ab.id]?.dur ?? 1)) ? undefined : 'stop';
      case 'slow':
        this.addAura(t, { ...base, kind: 'slow', harmful: true, dur: e.dur * t.mods.tenacity, n: e.pct / 100 });
        return;
      case 'antiheal':
        this.addAura(t, { ...base, kind: 'antiheal', harmful: true, dur: e.dur, n: e.pct / 100 });
        return;
      case 'absorb':
        this.addAura(t, { ...base, kind: 'absorb', harmful: false, dur: e.dur, n: e.n * power });
        return;
      case 'guard':
        this.addAura(t, { ...base, kind: 'guard', harmful: false, dur: e.dur, n: e.pct / 100 });
        return;
      case 'fury':
        this.addAura(t, { ...base, kind: 'fury', harmful: false, dur: e.dur, n: e.pct / 100 });
        return;
      case 'speed':
        this.addAura(t, { ...base, kind: 'speed', harmful: false, dur: e.dur, n: e.pct / 100 });
        return;
      case 'immune':
        // can't be torn off, and sealing yourself in ice stops what you were casting
        this.addAura(t, { ...base, magic: false, kind: 'immune', harmful: false, dur: e.dur, still: e.still, phys: e.phys });
        if (e.still) this.endCast(t);
        return;
      case 'free':
        this.addAura(t, { ...base, kind: 'free', harmful: false, dur: e.dur });
        return;
      case 'reflect':
        this.addAura(t, { ...base, kind: 'reflect', harmful: false, dur: e.dur });
        return;
      case 'lastgrace':
        this.addAura(t, { ...base, kind: 'lastgrace', harmful: false, dur: e.dur, n: e.heal / 100 });
        return;
      case 'interrupt': {
        const c = t.cast;
        if (!c) return;
        const school = ABILITIES[c.ab]?.school;
        this.endCast(t);
        f.score.kicks++;
        this.events.push({ k: 'word', id: t.id, word: 'Interrupted', bad: true });
        if (school && e.lock > 0) t.locks[school] = e.lock * t.mods.tenacity;
        return;
      }
      case 'dispel':
        this.dispel(f, t);
        return;
      case 'charge': {
        const d = Math.hypot(t.x - f.x, t.y - f.y) || 1;
        const stop = HERO_R * 2;
        f.dash = { x: t.x - ((t.x - f.x) / d) * stop, y: t.y - ((t.y - f.y) / d) * stop, speed: 340 };
        this.endCast(f);
        return;
      }
      case 'blink':
        this.blink(f, e.dist);
        return;
      case 'leap': {
        const near = this.enemiesOf(f).sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
        const dx = near ? f.x - near.x : f.dirX;
        const dy = near ? f.y - near.y : f.dirY;
        const d = Math.hypot(dx, dy) || 1;
        f.dash = { x: f.x + (dx / d) * e.dist, y: f.y + (dy / d) * e.dist, speed: 300 };
        this.endCast(f);
        return;
      }
      case 'break':
        t.auras = t.auras.filter((a) => a.kind !== 'slow' && a.cc !== 'root');
        return;
      case 'token':
        t.auras = t.auras.filter((a) => !a.cc && a.kind !== 'slow');
        this.events.push({ k: 'word', id: t.id, word: 'Free!' });
        return;
      case 'trap':
        this.traps = this.traps.filter((x) => !(x.src === f.id && x.ab === ab.id));
        this.traps.push({ ab: ab.id, src: f.id, team: f.team, x: f.x, y: f.y, arm: 1, life: 30, cc: e.cc, dur: e.dur });
        return;
      case 'backlash': {
        const dot = t.auras.find((a) => a.ab === ab.id && a.kind === 'dot');
        if (dot) dot.backlash = e.dur;
        return;
      }
      case 'price': {
        // the user pays, whoever it is aimed at; it never takes the last of their health
        const n = Math.round(Math.min(e.n, f.hp - 1));
        if (n <= 0) return;
        f.hp -= n;
        this.events.push({ k: 'num', id: f.id, n, kind: 'dmg', crit: false });
        return;
      }
      case 'knock': {
        if (t === f || t.dead) return;
        const dx = t.x - f.x;
        const dy = t.y - f.y;
        const d = Math.hypot(dx, dy) || 1;
        t.dash = { x: t.x + (dx / d) * e.dist, y: t.y + (dy / d) * e.dist, speed: 380 };
        if (t.cast) this.endCast(t);
        this.events.push({ k: 'word', id: t.id, word: 'Knocked back', bad: true });
        return;
      }
      case 'dash': {
        const d = Math.hypot(f.dirX, f.dirY) || 1;
        f.dash = { x: f.x + (f.dirX / d) * e.dist, y: f.y + (f.dirY / d) * e.dist, speed: 430 };
        this.endCast(f);
        return;
      }
    }
  }

  /** Crowd control, with its diminishing returns. False if it did nothing. */
  private crowd(f: Fighter, ab: Ability, t: Fighter, cc: CcKind, dur: number): boolean {
    const dr = t.dr[cc] && t.dr[cc]!.until > this.clock ? t.dr[cc]! : { n: 0, until: 0 };
    if (dr.n >= DR_STEPS.length) {
      this.events.push({ k: 'word', id: t.id, word: 'Immune' });
      return false;
    }
    const lasts = dur * DR_STEPS[dr.n]! * t.mods.tenacity;
    t.dr[cc] = { n: dr.n + 1, until: this.clock + lasts + DR_RESET };
    t.auras = t.auras.filter((a) => a.cc !== cc);
    this.addAura(t, { ab: ab.id, src: f.id, dur: lasts, magic: ab.school !== 'physical', n: 0, kind: 'cc', harmful: true, cc, took: 0 });
    f.score.cc += lasts;
    t.dash = null;
    if (cc !== 'root' && t.cast) this.endCast(t);
    if (cc === 'fear') {
      const a = this.rand() * Math.PI * 2;
      t.fearX = Math.cos(a);
      t.fearY = Math.sin(a);
    }
    this.events.push({ k: 'word', id: t.id, word: cc === 'stun' ? 'Stunned' : cc === 'fear' ? 'Feared' : cc === 'incap' ? 'Dazed' : cc === 'root' ? 'Rooted' : 'Silenced', bad: true });
    return true;
  }

  private dispel(f: Fighter, t: Fighter): void {
    const friend = t.team === f.team;
    // a friend: what holds them first, then the rest. An enemy: their best blessing.
    const candidates = t.auras.filter((a) => a.magic && a.harmful === friend);
    const pick = candidates.find((a) => a.cc) ?? candidates[candidates.length - 1];
    if (!pick) {
      this.events.push({ k: 'word', id: f.id, word: 'Nothing to take off' });
      return;
    }
    t.auras.splice(t.auras.indexOf(pick), 1);
    this.events.push({ k: 'word', id: t.id, word: 'Dispelled' });
    if (pick.backlash && friend) this.crowd(this.fighters[pick.src]!, ABILITIES[pick.ab]!, f, 'silence', pick.backlash);
  }

  private blink(f: Fighter, dist: number): void {
    const d = Math.hypot(f.dirX, f.dirY) || 1;
    const ux = f.dirX / d;
    const uy = f.dirY / d;
    let at = 0;
    // as far as it can go without ending inside a pillar
    for (let s = dist; s > 0; s -= 4) {
      const x = f.x + ux * s;
      const y = f.y + uy * s;
      if (!this.hits(x, y) && x > HERO_R && y > HERO_R && x < ARENA_W - HERO_R && y < ARENA_H - HERO_R) {
        at = s;
        break;
      }
    }
    f.x += ux * at;
    f.y += uy * at;
    this.endCast(f);
  }

  /* -------------------------------------------------------------- hurting and mending */

  private damage(src: Fighter, t: Fighter, amount: number, direct: boolean, ab?: Ability): void {
    if (t.dead) return;
    if (ab && t.auras.some((a) => a.kind === 'immune' && (!a.phys || ab.school === 'physical'))) return;
    let n = amount * src.mods.dmg;
    // (fights turn on bursts: a blow hits a little harder than its number, a burst ability harder still, a crit a lot)
    if (direct) n *= HIT_K;
    if (direct && ab?.role === 'burst') n *= BURST_K;
    let crit = false;
    if (direct && this.rand() < CRIT) {
      n *= CRIT_K;
      crit = true;
    }
    for (const a of src.auras) if (a.kind === 'fury') n *= 1 + a.n;
    for (const a of t.auras) if (a.kind === 'guard') n *= 1 - a.n;
    n = Math.round(n);
    src.score.dmg += n;
    if (src !== t) {
      // (a super's own blow doesn't fill the meter it just emptied)
      if (!ab?.super) src.charge = Math.min(1, src.charge + n / SUPER_DEALT);
      t.charge = Math.min(1, t.charge + n / SUPER_TAKEN);
    }
    for (const a of t.auras) {
      if (a.kind !== 'absorb' || n <= 0) continue;
      const soak = Math.min(a.n, n);
      a.n -= soak;
      n -= soak;
      this.events.push({ k: 'num', id: t.id, n: soak, kind: 'absorb', crit: false });
    }
    t.auras = t.auras.filter((a) => a.kind !== 'absorb' || a.n > 0);
    if (n <= 0) return;
    this.wound(t, n, crit);
    if (t.dead) return;
    // what holds you breaks with hurt: at once when dazed, after a while when feared or rooted
    for (let i = t.auras.length - 1; i >= 0; i--) {
      const a = t.auras[i]!;
      if (a.cc !== 'incap' && a.cc !== 'fear' && a.cc !== 'root') continue;
      a.took = (a.took ?? 0) + n;
      const limit = a.cc === 'incap' ? 0 : t.maxHp * (a.cc === 'fear' ? 0.1 : 0.14);
      if (a.took > limit) {
        t.auras.splice(i, 1);
        this.events.push({ k: 'word', id: t.id, word: 'Broke free' });
      }
    }
    // a blow knocks a cast back (twice at most)
    if (direct && t.cast && !t.cast.channel && t.cast.pushed < 2) {
      t.cast.pushed++;
      t.cast.t = Math.max(0, t.cast.t - 0.25);
    }
  }

  /** Life lost, and maybe the end of them. */
  private wound(t: Fighter, n: number, crit: boolean): void {
    t.hp -= n;
    this.events.push({ k: 'num', id: t.id, n, kind: 'dmg', crit });
    if (t.hp > 0) return;
    const grace = t.auras.find((a) => a.kind === 'lastgrace');
    if (grace) {
      t.auras.splice(t.auras.indexOf(grace), 1);
      t.hp = Math.round(t.maxHp * grace.n);
      this.events.push({ k: 'word', id: t.id, word: 'Saved by grace' });
      return;
    }
    t.hp = 0;
    t.dead = true;
    t.cast = null;
    t.auras = [];
    t.dash = null;
    this.events.push({ k: 'death', id: t.id });
  }

  private heal(src: Fighter, t: Fighter, amount: number): void {
    if (t.dead) return;
    let n = amount * HEAL_K * src.mods.heal * (1 - this.dampening);
    if (this.rand() < CRIT) n *= 1.5;
    for (const a of t.auras) if (a.kind === 'antiheal') n *= 1 - a.n;
    n = Math.round(Math.min(n, t.maxHp - t.hp));
    if (n <= 0) return;
    t.hp += n;
    src.score.heal += n;
    src.charge = Math.min(1, src.charge + n / SUPER_DEALT);
    this.events.push({ k: 'num', id: t.id, n, kind: 'heal', crit: false });
  }

  /* -------------------------------------------------------------- the frame */

  /** Moves the match on. `moves[id]`: where each fighter wants to go. Nothing stops a host stepping by any dt. */
  step(dt: number, moves: Record<number, MoveInput | undefined>): void {
    if (!(dt > 0) || this.phase === 'over') return;
    this.t += dt;
    if (this.phase === 'gates') {
      // a stretch of the legs in the entry, while choosing
      for (const f of this.fighters) this.moveFighter(f, dt, moves[f.id]);
      if (this.t >= this.gateAt) {
        this.phase = 'fight';
        this.events.push({ k: 'word', id: -1, word: 'Fight!' });
      }
      return;
    }
    this.clock += dt;
    for (const f of this.fighters) {
      if (f.dead) continue;
      this.tickFighter(f, dt, moves[f.id]);
    }
    this.moveBolts(dt);
    this.tripTraps(dt);
    this.tendSigil();
    this.closeIn(dt);
    this.judge();
  }

  /** The sigil rises in the middle now and then; the first to reach it takes it. */
  private tendSigil(): void {
    if (!this.sigil) {
      if (this.clock < this.sigilAt) return;
      this.sigil = this.sigilSpot();
      this.events.push({ k: 'sigil', id: -1, x: this.sigil.x, y: this.sigil.y });
      this.events.push({ k: 'word', id: -1, word: 'A sigil rises' });
      return;
    }
    const s = this.sigil;
    const by = this.fighters.find((f) => !f.dead && Math.hypot(f.x - s.x, f.y - s.y) < HERO_R + 8);
    if (!by) return;
    this.sigil = null;
    this.sigilAt = this.clock + SIGIL_EVERY;
    const n = Math.round(Math.min(by.maxHp * 0.2, by.maxHp - by.hp));
    if (n > 0) {
      by.hp += n;
      this.events.push({ k: 'num', id: by.id, n, kind: 'heal', crit: false });
    }
    by.charge = Math.min(1, by.charge + 0.34);
    this.addAura(by, { ab: SIGIL.id, src: by.id, dur: 4, magic: false, n: 0.3, kind: 'speed', harmful: false });
    this.events.push({ k: 'sigil', id: by.id, x: s.x, y: s.y });
    this.events.push({ k: 'word', id: by.id, word: 'Sigil of Might' });
  }

  /** The middle of the ground, or beside the stone that stands there. */
  sigilSpot(): SigilStone {
    const cx = ARENA_W / 2;
    const cy = ARENA_H / 2;
    for (const [x, y] of [
      [cx, cy],
      [cx, cy - 46],
      [cx, cy + 46],
      [cx - 70, cy],
    ] as const) {
      if (!this.pillars.some((p) => x > p.x - 12 && x < p.x + p.w + 12 && y > p.y - 12 && y < p.y + p.h + 12)) return { x, y };
    }
    return { x: cx, y: cy };
  }

  /** The Gloam: a warning, then it closes, burning whoever is out in it. */
  private closeIn(dt: number): void {
    if (!this.warned && this.clock >= CLOSE_FROM - 5) {
      this.warned = true;
      this.events.push({ k: 'word', id: -1, word: 'The Gloam closes in' });
    }
    if (this.clock <= CLOSE_FROM) return;
    this.burnT += dt;
    if (this.burnT < 0.5) return;
    this.burnT -= 0.5;
    // it bites harder the longer the match goes past its closing
    const k = 1 + Math.max(0, this.clock - CLOSE_TO) / 20;
    for (const f of this.fighters) {
      if (f.dead || !this.inGloam(f)) continue;
      this.wound(f, Math.round(f.maxHp * ZONE_BURN * 0.5 * k), false);
    }
  }

  private tickFighter(f: Fighter, dt: number, m: MoveInput | undefined): void {
    f.gcd = Math.max(0, f.gcd - dt);
    for (const k of Object.keys(f.cds)) {
      const left = (f.cds[k] ?? 0) - dt;
      if (left <= 0) delete f.cds[k];
      else f.cds[k] = left;
    }
    for (const k of Object.keys(f.locks)) {
      const left = (f.locks[k] ?? 0) - dt;
      if (left <= 0) delete f.locks[k];
      else f.locks[k] = left;
    }
    if (f.maxMana) f.mana = Math.min(f.maxMana, f.mana + dt * 1.5 * f.mods.regen);
    this.tickAuras(f, dt);
    if (f.dead) return;
    this.moveFighter(f, dt, m);
    this.tickCast(f, dt);
    if (f.queued) {
      f.queued.t -= dt;
      const ab = ABILITIES[f.queued.ab];
      if (f.queued.t <= 0 || !ab) f.queued = null;
      else if (f.gcd <= 0 && !this.blocked(f, ab)) this.begin(f, ab);
    }
  }

  private tickAuras(f: Fighter, dt: number): void {
    for (const a of f.auras) {
      a.t -= dt;
      if (a.next !== undefined) {
        a.next -= dt;
        if (a.next <= 0) {
          a.next += 1;
          const src = this.fighters[a.src]!;
          if (a.kind === 'dot') this.damage(src, f, a.n, false, ABILITIES[a.ab]);
          else if (a.kind === 'hot') this.heal(src, f, a.n);
          if (f.dead) return;
        }
      }
    }
    f.auras = f.auras.filter((a) => a.t > 0);
  }

  private speedOf(f: Fighter): number {
    let k = f.mods.speed;
    if (f.cast) k *= CAST_SLOW;
    for (const a of f.auras) if (a.kind === 'speed') k *= 1 + a.n;
    if (!f.auras.some((a) => a.kind === 'free')) {
      let slow = 0;
      for (const a of f.auras) if (a.kind === 'slow') slow = Math.max(slow, a.n);
      k *= 1 - slow;
    }
    return BASE_SPEED * k;
  }

  private hits(x: number, y: number): boolean {
    for (const p of this.solid) {
      const nx = Math.max(p.x, Math.min(p.x + p.w, x));
      const ny = Math.max(p.y, Math.min(p.y + p.h, y));
      if ((nx - x) ** 2 + (ny - y) ** 2 < HERO_R * HERO_R) return true;
    }
    return false;
  }

  private moveFighter(f: Fighter, dt: number, m: MoveInput | undefined): void {
    let mx = 0;
    let my = 0;
    let sp = this.speedOf(f);
    if (f.dash) {
      const dx = f.dash.x - f.x;
      const dy = f.dash.y - f.y;
      const d = Math.hypot(dx, dy);
      const step = f.dash.speed * dt;
      if (d <= step) {
        this.slide(f, dx, dy);
        f.dash = null;
      } else {
        const before = { x: f.x, y: f.y };
        this.slide(f, (dx / d) * step, (dy / d) * step);
        // blocked: it stops here rather than pushing against the stone forever
        if (Math.hypot(f.x - before.x, f.y - before.y) < step * 0.3) f.dash = null;
      }
      f.vx = 0;
      f.vy = 0;
      return;
    }
    const fear = f.auras.some((a) => a.cc === 'fear');
    if (fear) {
      // running blind: round pillars and along walls, turning now and then
      if (this.rand() < dt * 0.9) {
        const a = this.rand() * Math.PI * 2;
        f.fearX = Math.cos(a);
        f.fearY = Math.sin(a);
      }
      mx = f.fearX;
      my = f.fearY;
      sp *= 0.75;
    } else if (m && !this.held(f) && !this.rooted(f)) {
      const len = Math.hypot(m.mx, m.my);
      if (len > 0.05) {
        const k = len > 1 ? 1 / len : 1;
        mx = m.mx * k;
        my = m.my * k;
      }
    }
    f.vx = mx * sp;
    f.vy = my * sp;
    if (mx || my) {
      f.dirX = mx;
      f.dirY = my;
      f.walk += dt;
      const bx = f.x;
      const by = f.y;
      this.slide(f, f.vx * dt, f.vy * dt);
      if (fear && Math.hypot(f.x - bx, f.y - by) < sp * dt * 0.4) {
        const a = this.rand() * Math.PI * 2;
        f.fearX = Math.cos(a);
        f.fearY = Math.sin(a);
      }
    }
  }

  private slide(f: Fighter, dx: number, dy: number): void {
    const nx = Math.max(HERO_R, Math.min(ARENA_W - HERO_R, f.x + dx));
    if (!this.hits(nx, f.y)) f.x = nx;
    const ny = Math.max(HERO_R + 4, Math.min(ARENA_H - HERO_R, f.y + dy));
    if (!this.hits(f.x, ny)) f.y = ny;
  }

  private tickCast(f: Fighter, dt: number): void {
    const c = f.cast;
    if (!c) return;
    const ab = ABILITIES[c.ab]!;
    const t = this.fighters[c.target];
    c.t += dt;
    if (!t || t.dead) {
      this.endCast(f);
      return;
    }
    const gone = t !== f && (Math.hypot(t.x - f.x, t.y - f.y) > ab.range + HERO_R + 14 || !this.sees(f, t));
    if (c.channel) {
      if (gone) {
        this.endCast(f);
        this.events.push({ k: 'word', id: f.id, word: 'Lost sight', bad: true });
        return;
      }
      c.next -= dt;
      if (c.next <= 0) {
        c.next += ab.tick ?? 1;
        this.land(f, ab, t, false);
      }
      if (c.t >= c.dur) this.endCast(f);
      return;
    }
    if (c.t >= c.dur) {
      this.endCast(f);
      if (gone) {
        this.events.push({ k: 'word', id: f.id, word: 'Lost sight', bad: true });
        return;
      }
      this.spend(f, ab);
      this.fire(f, ab, t);
    }
  }

  /** Shots fly straight: into the first enemy they touch, into stone, or on until they fall. */
  private moveBolts(dt: number): void {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]!;
      const src = this.fighters[b.src]!;
      const ab = ABILITIES[b.ab]!;
      // in two halves, so that nothing slips between frames
      let end: 'hit' | 'miss' | null = null;
      for (let k = 0; k < 2 && !end; k++) {
        b.x += b.vx * dt * 0.5;
        b.y += b.vy * dt * 0.5;
        b.left -= Math.hypot(b.vx, b.vy) * dt * 0.5;
        const gx = b.x;
        const gy = b.y + 8;
        const hit = this.fighters.find((o) => !o.dead && o.team !== src.team && Math.hypot(o.x - gx, o.y - gy) <= HERO_R + BOLT_R);
        if (hit) {
          this.land(src, ab, hit, false);
          end = 'hit';
        } else if (this.solid.some((p) => gx > p.x && gx < p.x + p.w && gy > p.y && gy < p.y + p.h) || b.left <= 0 || gx < 0 || gy < 0 || gx > ARENA_W || gy > ARENA_H) {
          end = 'miss';
        }
      }
      if (!end) continue;
      this.bolts.splice(i, 1);
      if (end === 'miss') this.events.push({ k: 'miss', x: b.x, y: b.y, ab: b.ab });
    }
  }

  private tripTraps(dt: number): void {
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const tr = this.traps[i]!;
      tr.arm -= dt;
      tr.life -= dt;
      if (tr.life <= 0) {
        this.traps.splice(i, 1);
        continue;
      }
      if (tr.arm > 0) continue;
      for (const f of this.fighters) {
        if (f.dead || f.team === tr.team || Math.hypot(f.x - tr.x, f.y - tr.y) > 15 || f.auras.some((a) => a.kind === 'immune')) continue;
        this.traps.splice(i, 1);
        this.events.push({ k: 'land', id: f.id, ab: tr.ab });
        const src = this.fighters[tr.src]!;
        this.crowd(src, ABILITIES[tr.ab]!, f, tr.cc, tr.dur);
        break;
      }
    }
  }

  private judge(): void {
    const alive: [number, number] = [0, 0];
    const life: [number, number] = [0, 0];
    for (const f of this.fighters) {
      if (!f.dead) alive[f.team]++;
      life[f.team] += f.hp / f.maxHp;
    }
    if (alive[0] === 0 || alive[1] === 0) {
      this.phase = 'over';
      if (alive[0] === alive[1]) this.draw = true;
      else this.winner = alive[0] > 0 ? 0 : 1;
      return;
    }
    if (this.clock >= MATCH_LIMIT) {
      this.phase = 'over';
      // the time ran out: whoever has more life left in them takes it
      if (Math.abs(life[0] - life[1]) < 0.001) this.draw = true;
      else this.winner = life[0] > life[1] ? 0 : 1;
    }
  }

  /* -------------------------------------------------------------- over the wire */

  /** What a host sends: everything anyone's screen shows. */
  snapshot(): Snapshot {
    return {
      p: this.phase,
      t: this.t,
      ga: this.gateAt,
      c: this.clock,
      w: this.winner,
      dr: this.draw,
      f: this.fighters.map((f) => ({
        x: Math.round(f.x * 10) / 10,
        y: Math.round(f.y * 10) / 10,
        vx: Math.round(f.vx),
        vy: Math.round(f.vy),
        dx: Math.round(f.dirX * 100) / 100,
        dy: Math.round(f.dirY * 100) / 100,
        hp: f.hp,
        mh: f.maxHp,
        m: Math.round(f.mana),
        d: f.dead,
        tg: f.target,
        fr: f.friend,
        g: Math.round(f.gcd * 100) / 100,
        cd: f.cds,
        c: f.cast,
        a: f.auras,
        l: f.locks,
        sc: f.score,
        ch: Math.round(f.charge * 1000) / 1000,
      })),
      b: this.bolts,
      tr: this.traps,
      sg: this.sigil,
      sa: this.sigilAt,
    };
  }

  /** A player's own copy takes the host's word for everything. */
  restore(s: Snapshot, mine: number | null = null): void {
    this.phase = s.p;
    this.t = s.t;
    this.gateAt = s.ga;
    this.clock = s.c;
    this.winner = s.w;
    this.draw = s.dr;
    this.bolts = s.b;
    this.traps = s.tr;
    this.sigil = s.sg ?? null;
    this.sigilAt = s.sa ?? this.sigilAt;
    s.f.forEach((n, i) => {
      const f = this.fighters[i];
      if (!f) return;
      // your own feet are yours between messages, unless the host disagrees by more than a stride
      const far = Math.hypot(f.x - n.x, f.y - n.y) > 26;
      if (i !== mine || far) {
        f.x = n.x;
        f.y = n.y;
      } else {
        f.x += (n.x - f.x) * 0.12;
        f.y += (n.y - f.y) * 0.12;
      }
      if (i !== mine) {
        f.vx = n.vx;
        f.vy = n.vy;
        f.dirX = n.dx;
        f.dirY = n.dy;
      }
      f.hp = n.hp;
      f.maxHp = n.mh;
      f.mana = n.m;
      f.dead = n.d;
      f.target = n.tg;
      f.friend = n.fr;
      f.gcd = n.g;
      f.cds = n.cd;
      f.cast = n.c;
      f.auras = n.a;
      f.locks = n.l;
      f.score = n.sc;
      f.charge = n.ch ?? 0;
    });
  }

  /** Between a host's messages, a player's own copy moves their hero and everything else along in straight lines. */
  coast(dt: number, mine: number | null, m: MoveInput | null): void {
    if (this.phase === 'over' || !(dt > 0)) return;
    if (this.phase === 'gates') {
      this.t += dt;
      const me = mine === null ? null : this.fighters[mine];
      if (me) this.moveFighter(me, dt, m ?? undefined);
      return;
    }
    for (const f of this.fighters) {
      if (f.dead) continue;
      if (f.id === mine) {
        this.moveFighter(f, dt, m ?? undefined);
      } else if (f.vx || f.vy) {
        f.walk += dt;
        this.slide(f, f.vx * dt, f.vy * dt);
      }
      if (f.cast) f.cast.t += dt;
      f.gcd = Math.max(0, f.gcd - dt);
      for (const k of Object.keys(f.cds)) f.cds[k] = Math.max(0, (f.cds[k] ?? 0) - dt);
      for (const a of f.auras) a.t = Math.max(0, a.t - dt);
    }
    // shots fly on in their straight lines
    for (const b of this.bolts) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
  }
}

export interface Snapshot {
  p: Phase;
  t: number;
  ga: number;
  c: number;
  w: 0 | 1 | null;
  dr: boolean;
  f: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    dx: number;
    dy: number;
    hp: number;
    mh: number;
    m: number;
    d: boolean;
    tg: number | null;
    fr: number | null;
    g: number;
    cd: Record<string, number>;
    c: Cast | null;
    a: Aura[];
    l: Partial<Record<string, number>>;
    sc: Fighter['score'];
    ch?: number;
  }[];
  b: Bolt[];
  tr: Trap[];
  sg?: SigilStone | null;
  sa?: number;
}
