import type { ClassId } from '../data/types';
import { ABILITIES, BODY, BOONS, CLASS_DMG, GCD, SIGIL, styleOfBar, superOf, ultOf, type Ability, type Build, type CcKind, type Effect, type Give, type Points, type Spend, type Use } from './abilities';
import { ARENA_H, ARENA_W, ENTRY_GATES, MAPS, type Pillar } from './maps';
import { ARM, cleanTalents, EXECUTE, NEAR, RALLY, TALENT_BY_ID, type Does, type Tune } from './talents';

export { CLASS_DMG };

/**
 * The Ring's simulation: everything about a match but the drawing, so it can be tested, run by a bot at speed, and run
 * by a host for a room of players. A brawl: always on the move (casting only slows you), shots that fly where the
 * target is going and can be dodged with a step, short holds that wear off harder each time, a super filled by
 * fighting, and a sigil in the middle worth running for. Line of sight still matters (pillars block shots and new
 * casts), and healing fades the longer a match goes, to nothing in the end, so that no match drags. (The Gloam, which
 * closed in from the edges from forty seconds and burned whoever stood in it, went on 2026-11-16, the owner: "remove
 * the 'gloam' and leave the damp only".)
 */

export const HERO_R = 7;
export const BASE_SPEED = 66;
/** Seconds to prepare in the entry before the gates open. */
export const GATES = 30;
/** Everyone's ready: this long and they lift. */
const GATES_READY = 3;
export const MATCH_LIMIT = 150;
/** How long crowd control's returns stay diminished after one wears off. */
export const DR_RESET = 18;
export const DR_STEPS = [1, 0.5, 0.25];
/** One kind of hold's diminishing returns on a fighter (Fighter.dr): how many, until when, and since when, and by what. */
export interface DrState {
  n: number;
  until: number;
  at?: number;
  ab?: string;
}
/**
 * Hurt breaks a hold, as in the classic arena: a daze at once, a fear after this share of its target's health, a root
 * after this (the owner, 2026-11-14: "roots should break after some dmg has been done, similar to wows roots, same
 * for fears", the shares they had before that morning's "shouldnt be breakable by dmg"). A stun holds through anything.
 */
export const FEAR_BREAK = 0.1;
export const ROOT_BREAK = 0.14;
/**
 * A shot flies this fast and follows its target: it always lands (the owner: "the misses are a bit annoying ... let's
 * make all the spells hit the target, without any misses"). It quickens as it goes, so nobody outruns one for long.
 */
export const BOLT_SPEED = 300;
const BOLT_QUICKEN = 260;
export const BOLT_R = 6;
/**
 * Healing is this much stronger by how many fight on a side: there is more than one enemy's damage to answer. Raised
 * from 1.2 and 1.35 on the owner's "increase the healing a tad bit more for the healers in the 2v2/3v3" (2026-11-13).
 */
export const HEAL_BY_SIZE: readonly number[] = [1, 1, 1.3, 1.45];
/** Healing spheres: the first rise at this, each comes back this long after it's taken, and gives this share of a life. */
export const ORB_FIRST = 12;
export const ORB_EVERY = 24;
export const ORB_HEAL = 0.14;
const QUEUE = 0.35;
/** Casting doesn't stop you, but it slows you to this. */
export const CAST_SLOW = 0.55;
/**
 * Dampening: none for this long, then healing fades by this share each second until none is left (all of it gone at
 * DAMP_FROM + 1 / DAMP_RATE, 115 seconds in). It stopped at three quarters gone while the Gloam was there to end a
 * match; now it is what ends one.
 */
export const DAMP_FROM = 35;
export const DAMP_RATE = 0.0125;
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
/** The gates of a ladder match against the computer lift sooner: there is nobody to wait for. */
export const GATES_SOLO = 15;
/**
 * The warlock's ashbound dead (Call the Ashbound, the Gravecaller's; they were the Gloamknight's): what they are called over their heads, how fast they walk
 * beside a hero, how often they strike and from how near, and how little of a super they are worth (dealt to them, or
 * by them, it fills a meter at this share).
 */
export const THRALL = { name: 'Ashbound', speed: 0.9, every: 1.25, reach: HERO_R * 2 + 4, charge: 0.5 } as const;
/** An ashbound's blow: a claw, a blow like any other. Not on anyone's bar. */
const CLAW: Ability = { id: 'k-claw', cls: 'warlock', name: 'Grave Claw', text: '', icon: 'dark_crystal_skull_on_violet', color: '#9a6ae0', school: 'physical', role: 'damage', aim: 'enemy', range: THRALL.reach, cast: 0, cd: 0, effects: [] };

/**
 * The shroud (Shroud of Dusk): how long it stays on if nothing breaks it (longer than any match), how much slower its
 * wearer walks, how long nothing that lands breaks it when it was taken in a fight, how soon it is back when taken out
 * of one, and how long without hurting or being hurt counts as out of a fight.
 */
/** How far a super's blessing reaches the user's friends, by a talent: a long spell's reach. */
const TALENT_REACH = 185;

export const VEIL = { t: 999, slow: 0.15, grace: 3, rest: 3, calm: 5 } as const;

export interface FighterSetup {
  team: 0 | 1;
  cls: ClassId;
  name: string;
  bar: string[];
  talents?: string[];
  /** Which of their class's two supers (abilities.ts ultsOf); without it, the one that goes with their bar. */
  ult?: string;
  /** The room seat playing them (null or missing: the computer, or the local player if `human`). */
  seat?: number | null;
  human?: boolean;
  /**
   * The title they wear, shown over their head in its light (ui/RingMatch.tsx): a player's own, or for one of the
   * computer's rivals the rank of its rating. The rules never read it.
   */
  title?: { text: string; fx: string; before?: boolean };
  /** The nameplate frame they wear (arena/record.ts frameOf), drawn round their nameplate. The rules never read it. */
  frame?: string;
}

export interface MatchSetup {
  seed: number;
  map: string;
  fighters: FighterSetup[];
  /** Seconds in the entry before the gates lift (GATES when not said). */
  gates?: number;
}

/**
 * What can be on a fighter. Besides the abilities' own: a ranger's `mark` (their side hits its wearer harder), a
 * warlock's `weak` (its wearer hits softer), a druid's `oak` (rooted where they stand, by their own doing), a priest's
 * `spirit` (fallen, but lingering on), a Gloamknight's `revenant` (fallen, and fighting to stay), his `veil` (hidden
 * from the other side: Match.veil) and `aloft` (up in the dark before a Night's Ruin comes down: nothing reaches them).
 */
export type AuraKind = 'dot' | 'hot' | 'cc' | 'slow' | 'antiheal' | 'absorb' | 'guard' | 'fury' | 'speed' | 'immune' | 'free' | 'reflect' | 'lastgrace' | 'mark' | 'weak' | 'oak' | 'spirit' | 'revenant' | 'veil' | 'aloft';

/**
 * How fast a live match runs against the clock on the wall: a little under it, so there is time to read what is on
 * whom and answer it (the owner: "make the combat a tiny bit slower, like 5-10% max"). Everything slows together,
 * moving, casting and cooling, so nothing about the balance changes. The rules themselves, the bots' practice runs and
 * the tests keep their own time.
 */
export const PACE = 0.93;

/** The classes that fight from range. */
export const RANGED: ReadonlySet<ClassId> = new Set<ClassId>(['mage', 'ranger', 'warlock', 'priest', 'druid']);
export interface Aura {
  /** The ability it came from. */
  ab: string;
  kind: AuraKind;
  src: number;
  t: number;
  dur: number;
  harmful: boolean;
  magic: boolean;
  /** dot and hot: per second. absorb: left. slow, guard, fury, speed, antiheal, mark, weak: the share. lastgrace: the heal. */
  n: number;
  cc?: CcKind;
  still?: boolean;
  phys?: boolean;
  /** A held target: damage taken so far, against what breaks it. */
  took?: number;
  /** A root of ice (Ability.shatter): how many more Shatters break it. */
  shatters?: number;
  next?: number;
  /** The shroud: nothing that lands breaks it while `t` is above this (it was taken in a fight, a moment ago). */
  keep?: number;
}

export interface Cast {
  ab: string;
  target: number;
  /** A placed ability: where its user put it. */
  at?: { x: number; y: number };
  t: number;
  dur: number;
  channel: boolean;
  next: number;
  pushed: number;
  /** A channel: what its user's boons and points made of it as it began. */
  p?: Punch;
}

/**
 * What its user's boons and points make of one use of an ability, worked out as it goes off and carried with it until
 * it lands (in a shot, in a patch of ground, through a leap into the dark): how much stronger, whether it is a
 * critical hit or lands its combo come what may, what more it does, and what was spent on it.
 */
export interface Punch {
  k: number;
  crit?: boolean;
  combo?: boolean;
  extra?: Effect[];
  drink?: number;
  /** More points it builds as it lands. */
  build?: number;
  /** The points spent on it, whether that was as many as can be held, how much longer its hold lasts for them, and the share of what it deals that mends a friend. */
  pts?: number;
  full?: boolean;
  hold?: number;
  mend?: number;
  /** The boon used up on it, by name (called out as it lands). */
  said?: string;
  /** It has landed on someone already: what happens once a use (points built, a boon given) has happened. */
  landed?: boolean;
}

/** A boon a fighter carries (abilities.ts BOONS): how many, and for how much longer. */
export interface BoonOn {
  id: string;
  n: number;
  t: number;
}

/** What an ability is for one fighter, their talents counted in: its tune, the boons it gives and uses, the points it builds and spends. */
export interface Wired {
  tune?: Tune;
  uses: Use[];
  gives: Give[];
  build?: Build;
  spend?: Spend;
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
  dead: boolean;
  /** Who they aim harm at, and who they aim help at (themselves if nobody). */
  target: number | null;
  friend: number | null;
  gcd: number;
  cds: Record<string, number>;
  cast: Cast | null;
  auras: Aura[];
  locks: Partial<Record<string, number>>;
  /**
   * Diminishing returns, by kind of hold: how many have landed (DR_STEPS), until when they count, and the ability that
   * put the last on them (its picture on their nameplate: a Toad Hex for a daze).
   */
  dr: Partial<Record<CcKind, DrState>>;
  /** A rush, a throw or a step on its way: where to, and how fast. */
  dash: { x: number; y: number; speed: number } | null;
  queued: { ab: string; t: number; at?: { x: number; y: number } } | null;
  fearX: number;
  fearY: number;
  talents: string[];
  /** Their playstyle (abilities.ts PRESETS, by id): what their bar and their super are. */
  spec: string;
  /** Their super: their playstyle's. */
  ult: string;
  /** The points they build and spend, if their playstyle or a talent gives them any, and how many they hold. */
  points: Points | null;
  pts: number;
  /** The boons they carry. */
  boons: BoonOn[];
  /** Each of their abilities as their talents make it (Match.how). */
  wired: Record<string, Wired>;
  /** Landings counted, for what happens every so many (by ability and what it is counted for). */
  counts: Record<string, number>;
  /** Up in the dark, about to come down on someone with an ability (Ability.dive). */
  dive: { ab: string; target: number; t: number; p: Punch } | null;
  /**
   * What their talents make of them, as multipliers: damage, healing, speed, how long they are held, cooldowns,
   * how long their own holds and slows last, damage taken, how fast their super fills, and the chance of a
   * critical hit.
   */
  mods: { dmg: number; heal: number; speed: number; tenacity: number; cool: number; hold: number; guard: number; charge: number; crit: number };
  /** What their talents do now and then (arena/talents.ts), when each can next (by kind), and what they keep count of. */
  perks: Perks;
  procs: Partial<Record<string, number>>;
  tal: TalentState;
  tune: Record<string, Tune>;
  score: { dmg: number; heal: number; cc: number; kicks: number; combos?: number; supers?: number; best?: BestMoment };
  /** The super meter, 0 to 1. */
  charge: number;
  /** The last combo landed (the next link of a chain has to be a different one). */
  /** One of the raised dead, fighting for whoever raised them (not a hero: it has no bar, no seat and no say in who wins). */
  pet?: Pet;
  /** When they last hurt someone or were hurt, by the match's clock: a while after, they are out of the fight (the shroud's). */
  fought?: number;
}

/** A talent's doings that aren't a plain number (arena/talents.ts), as one fighter has them. */
/**
 * A fighter's biggest moment of the match, for the result screen: the combo or super that did the most to one fighter
 * in one landing (damage, or healing for one that heals), and what it was.
 */
export interface BestMoment {
  ab: string;
  n: number;
  /** The combo's name, when it was one. */
  combo?: string;
}

export interface Perks {
  exec: number;
  rally: { pct: number; every: number; name: string } | null;
  /** The rest of what their talents do, by kind (arena/talents.ts, Doing). */
  does: Does;
}
const NO_PERKS: Perks = { exec: 0, rally: null, does: {} };

/**
 * What a fighter's talents keep count of as the match goes: whom a grudge is against and how deep it runs, the hits
 * toward a third chill or a verdict, what was taken lately (a rewind gives some back), how long they've been out of
 * sight, which way sun and moon are turned, the imp's next spit, the ward's and the vigor's next, the plates of bone,
 * and what is spent once a match. Only the host's copy counts.
 */
export interface TalentState {
  grudge?: { on: number; n: number };
  third?: { on: number; n: number; at: number };
  verdict?: number;
  hurt?: { at: number; n: number }[];
  hidden?: number;
  coverT?: number;
  wasHeld?: boolean;
  /** Sun and moon: a heal is owed its share (`heal`), and a hit is (`hit`). */
  heal?: boolean;
  hit?: boolean;
  impT?: number;
  wardT?: number;
  vigorT?: number;
  bones?: number;
  boneT?: number;
  /** Spent once a match: a lingering spirit, an unbroken vow, an unquiet grave. */
  spent?: string[];
  /** The blow that is bringing them out of the shroud is being struck (a night's embrace makes it hit harder). */
  opening?: boolean;
}

/** What makes one of the raised dead what it is: whose it is, how long it has, and its blow. */
export interface Pet {
  owner: number;
  /** The ability that raised it: its blow's slow is put on as that ability's, by its master. */
  ab: string;
  /** Seconds left, of `max`. */
  life: number;
  max: number;
  /** Its blow (before its master's share) and the slow it leaves, and seconds to the next. */
  dmg: number;
  slow: number;
  next: number;
  /** Blows struck so far: the drawing swings at each new one. */
  hits: number;
  /** When it fell or crumbled, by the match's clock (the drawing lets it sink back into the ground). */
  end?: number;
}

export interface Bolt {
  ab: string;
  src: number;
  /** Who it is going to: it follows them and lands on them. */
  tgt: number;
  /** What its user's boons and points made of it. */
  p?: Punch;
  /** Where it is: `y` is its height in the air over the ground, 8 up. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** How long it has flown. */
  age: number;
}

/** A placed ability on its way down: a patch of ground everyone can see, that lands on whoever of the other side is in it. */
export interface Zone {
  ab: string;
  src: number;
  team: 0 | 1;
  x: number;
  y: number;
  r: number;
  /** Seconds until it lands, of `dur`. */
  t: number;
  dur: number;
  /** What its user's boons and points made of it. */
  p?: Punch;
  /** Which way it was thrown (a unit vector): what it leaves on the ground drifts on that way. */
  ux?: number;
  uy?: number;
}

/**
 * What a placed ability leaves on the ground (Ability.field): a patch that lands on everyone of the other side standing
 * in it every so often, drifting as it goes. Everyone sees it, as they see a patch coming down.
 */
export interface Field {
  ab: string;
  src: number;
  team: 0 | 1;
  x: number;
  y: number;
  r: number;
  /** Seconds left, of `dur`, and until it next lands. */
  t: number;
  dur: number;
  next: number;
  vx: number;
  vy: number;
  /** How strong it lands (what its user's boons and points made of it). */
  k: number;
}

/** A healing sphere's place, and when it next rises (it is there to take once the clock has passed this). */
export interface Orb {
  x: number;
  y: number;
  at: number;
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
  /** A shot whose target fell before it got there. */
  | { k: 'miss'; x: number; y: number; ab: string }
  /** A placed ability lands on its patch of ground. */
  | { k: 'zone'; x: number; y: number; r: number; ab: string }
  /** Someone takes a healing sphere. */
  | { k: 'orb'; id: number; x: number; y: number }
  /** The sigil rises (id -1), or someone takes it. */
  | { k: 'sigil'; id: number; x: number; y: number }
  /** A super goes off. */
  | { k: 'super'; id: number; ab: string }
  /** One of the raised dead strikes at someone. */
  | { k: 'claw'; id: number; to: number }
  /** Something a talent throws crosses from one fighter to another (an imp's spit, a hammer leaping on): drawn as `ab` (an ability's or a talent's id). */
  | { k: 'streak'; id: number; to: number; ab: string }
  /** Someone is given a boon (abilities.ts BOONS). */
  | { k: 'boon'; id: number; boon: string };

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

/** Two changes to one ability, as one: numbers multiplied, lists joined, the later's word where there can be only one. */
function mergeTune(a: Tune | undefined, b: Tune): Tune {
  if (!a) return b;
  const mul = (x: number | undefined, y: number | undefined): number | undefined => (x === undefined && y === undefined ? undefined : (x ?? 1) * (y ?? 1));
  const cat = <T>(x: T[] | undefined, y: T[] | undefined): T[] | undefined => (x || y ? [...(x ?? []), ...(y ?? [])] : undefined);
  return {
    ...a,
    ...b,
    power: mul(a.power, b.power),
    cd: mul(a.cd, b.cd),
    cast: mul(a.cast, b.cast),
    dur: mul(a.dur, b.dur),
    linger: mul(a.linger, b.linger),
    more: a.more === undefined && b.more === undefined ? undefined : (a.more ?? 0) + (b.more ?? 0),
    extra: cat(a.extra, b.extra),
    self: cat(a.self, b.self),
    friends: cat(a.friends, b.friends),
    foes: cat(a.foes, b.foes),
    gives: cat(a.gives, b.gives),
    uses: cat(a.uses, b.uses),
  };
}

/** The boons an ability uses, one entry to a boon: what its own words and a talent's say of the same boon, together. */
function mergeUses(list: Use[]): Use[] {
  const out: Use[] = [];
  for (const u of list) {
    const i = out.findIndex((o) => o.boon === u.boon);
    if (i < 0) {
      out.push(u);
      continue;
    }
    const o = out[i]!;
    out[i] = {
      boon: o.boon,
      mult: o.mult === undefined && u.mult === undefined ? undefined : (o.mult ?? 1) * (u.mult ?? 1),
      instant: o.instant || u.instant,
      nocd: o.nocd || u.nocd,
      crit: o.crit || u.crit,
      asCombo: o.asCombo || u.asCombo,
      extra: o.extra || u.extra ? [...(o.extra ?? []), ...(u.extra ?? [])] : undefined,
      drink: Math.max(o.drink ?? 0, u.drink ?? 0) || undefined,
      build: (o.build ?? 0) + (u.build ?? 0) || undefined,
      keep: o.keep || u.keep,
    };
  }
  return out;
}

/**
 * What a hero's playstyle and talents add up to. (An oath beside them, a small bonus for the whole match, was taken
 * out with the Unbinding Charm on 2026-11-15, the owner: "remove oaths and the extras, leave only spells, talents and
 * ults". The trinket that took the charm's place went with the choosing of abilities, 2026-11-16.)
 */
function built(cls: ClassId, bar: readonly unknown[] | undefined, talentIds: readonly string[] | undefined): Pick<Fighter, 'bar' | 'spec' | 'ult' | 'points' | 'wired' | 'mods' | 'perks' | 'procs' | 'tune' | 'maxHp' | 'talents' | 'tal'> {
  const style = styleOfBar(cls, bar);
  const list = cleanTalents(cls, talentIds, style.id);
  const sum = (key: 'guard' | 'hold' | 'exec'): number => list.reduce((n, x) => n + (x[key] ?? 0), 0);
  const rally = list.find((x) => x.rally);
  const tune: Record<string, Tune> = {};
  for (const x of list) for (const [id, t] of Object.entries(x.tune ?? {})) tune[id] = mergeTune(tune[id], t);
  const does: Does = {};
  for (const x of list) if (x.does) Object.assign(does, { [x.does.k]: x.does });
  const wired: Record<string, Wired> = {};
  for (const id of [...style.bar, style.ult]) {
    const ab = ABILITIES[id]!;
    const t = ab.super && tune.super ? mergeTune(tune.super, tune[id] ?? {}) : tune[id];
    wired[id] = { tune: t, uses: mergeUses([...(ab.uses ?? []), ...(t?.uses ?? [])]), gives: [...(ab.gives ?? []), ...(t?.gives ?? [])], build: t?.build ?? ab.build, spend: t?.spend ?? ab.spend };
  }
  return {
    bar: [...style.bar],
    spec: style.id,
    ult: style.ult,
    points: list.find((x) => x.points)?.points ?? style.points ?? null,
    wired,
    talents: list.map((x) => x.id),
    tune,
    maxHp: BODY[cls].hp,
    mods: {
      // (each class deals its own share, supers and all: CLASS_DMG)
      dmg: CLASS_DMG[cls],
      heal: 1,
      speed: 1,
      tenacity: 1,
      cool: 1,
      hold: 1 + sum('hold'),
      guard: 1 - Math.min(0.5, sum('guard')),
      charge: 1,
      crit: CRIT,
    },
    perks: { exec: sum('exec'), rally: rally?.rally ? { ...rally.rally, name: rally.name } : null, does },
    procs: {},
    tal: does.bones ? { bones: does.bones.n } : {},
  };
}

/**
 * A talent as an ability, for what it puts on someone (a hold, a burn, a ward): its name and its class's school, so that
 * a dispel, an immunity and a combo read it as they read any ability's. Not on anyone's bar.
 */
const TALENT_ABS = new Map<string, Ability>();
function talentAb(id: string): Ability {
  let ab = TALENT_ABS.get(id);
  if (!ab) {
    const t = TALENT_BY_ID[id]!;
    const sup = superOf(t.cls);
    ab = { id, cls: t.cls, name: t.name, text: t.text, icon: t.icon ?? sup.icon, color: sup.color, school: sup.school, role: 'damage', aim: 'enemy', range: 0, cast: 0, cd: 0, effects: [] };
    TALENT_ABS.set(id, ab);
  }
  return ab;
}
/** Which talent of a class does each kind of thing (no two of a class do the same). */
const TALENTS_BY_DOING: Record<string, string> = Object.fromEntries(Object.values(TALENT_BY_ID).flatMap((t) => (t.does ? [[`${t.cls}:${t.does.k}`, t.id]] : [])));
/** The talent behind a doing, as an ability (see talentAb). */
const abOfDoing = (cls: ClassId, k: keyof Does): Ability => talentAb(TALENTS_BY_DOING[`${cls}:${k}`] ?? '');

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
  zones: Zone[] = [];
  fields: Field[] = [];
  orbs: Orb[] = [];
  /** How much stronger healing is in this match (HEAL_BY_SIZE, by the bigger side). */
  readonly healK: number;
  /** The sigil, while it stands waiting to be taken, and when the next one rises. */
  sigil: SigilStone | null = null;
  sigilAt = SIGIL_FIRST;
  /**
   * The clock stands still while this is set: no fading of healing, no sigil or sphere rising by itself and no end by
   * time. The Ring's tutorial (arena/tutorial.ts) holds it while it teaches, and lets it go for the last fight.
   */
  hold = false;
  events: MatchEvent[] = [];
  private rand: () => number;

  constructor(setup: MatchSetup) {
    this.rand = rng(setup.seed);
    if (setup.gates && setup.gates > 0) this.gateAt = setup.gates;
    this.map = setup.map;
    const map = MAPS[setup.map] ?? Object.values(MAPS)[0]!;
    this.pillars = map.pillars;
    this.orbs = map.orbs.map(([x, y]) => ({ x, y, at: ORB_FIRST }));
    const size = Math.max(setup.fighters.filter((f) => f.team === 0).length, setup.fighters.filter((f) => f.team === 1).length);
    this.healK = HEAL_BY_SIZE[Math.min(size, HEAL_BY_SIZE.length - 1)] ?? 1;
    const count: [number, number] = [0, 0];
    this.fighters = setup.fighters.map((s, id) => {
      const i = count[s.team]++;
      const spot = map.spawns[s.team]![i % map.spawns[s.team]!.length]!;
      // (a playstyle's own four and its super: whatever bar was sent is read as the playstyle nearest it, and of the
      // talents sent, those that are its to take. A row left empty stays empty here: what is kept on a device, and what
      // comes over a room's wire, is filled up before it gets this far, ladder.ts setsOf and ui/RingScreen.tsx)
      const made = built(s.cls, s.bar, s.talents);
      return {
        id,
        team: s.team,
        cls: s.cls,
        name: s.name,
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
        pts: 0,
        boons: [],
        counts: {},
        dive: null,
      };
    });
  }

  /* -------------------------------------------------------------- what can be asked */

  /** A share of healing gone. Grows through the match, to all of it, so that healers can't hold forever. */
  get dampening(): number {
    return Math.max(0, Math.min(1, (this.clock - DAMP_FROM) * DAMP_RATE));
  }

  /** What everyone has besides their bar: their playstyle's super. */
  extras(f: Fighter): Ability[] {
    return [ultOf(f.cls, f.ult)];
  }

  /** Everything solid right now: the stone, and the gates until they lift. */
  private get solid(): Pillar[] {
    return this.phase === 'gates' ? [...this.pillars, ...ENTRY_GATES] : this.pillars;
  }

  sees(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
    return clearLine(this.solid, a.x, a.y - 4, b.x, b.y - 4);
  }

  /** In the entry, a player can still change what they brought: their playstyle and its talents. */
  equip(id: number, s: { bar: string[]; talents?: string[]; ult?: string }): boolean {
    const f = this.fighters[id];
    if (!f || this.phase !== 'gates' || !Array.isArray(s.bar)) return false;
    const made = built(f.cls, s.bar, s.talents);
    Object.assign(f, made);
    f.hp = made.maxHp;
    f.pts = 0;
    f.boons = [];
    f.counts = {};
    return true;
  }

  /** Everyone's ready: the gates lift in a moment rather than at the end of the wait. */
  openSoon(): void {
    if (this.phase === 'gates') this.gateAt = Math.min(this.gateAt, this.t + GATES_READY);
  }

  /** Everyone standing on the other side, the raised dead among them (what hits everyone near hits them too). */
  enemiesOf(f: Fighter): Fighter[] {
    return this.fighters.filter((o) => o.team !== f.team && !o.dead);
  }
  friendsOf(f: Fighter): Fighter[] {
    return this.fighters.filter((o) => o.team === f.team && !o.dead);
  }
  /** The heroes of the match, without anyone's raised dead: who the match is between. */
  get heroes(): Fighter[] {
    return this.fighters.filter((o) => !o.pet);
  }
  /** Who is behind a fighter: the hero who raised them, or themself. */
  masterOf(f: Fighter): Fighter {
    return f.pet ? (this.fighters[f.pet.owner] ?? f) : f;
  }

  /**
   * The combo this ability would land on this target right now: what its user set up is on them, or they are held
   * the way it needs. The same test the blow itself makes, so the bar can light the ability up beforehand.
   */
  comboReady(f: Fighter, ab: Ability, t: Fighter | null): NonNullable<Ability['combo']> | null {
    const c = ab.combo;
    if (!c || !t || t.dead) return null;
    if (c.behind && t !== f && this.behind(f, t)) return c;
    return t.auras.some((a) => (!!c.ab?.includes(a.ab) && a.src === f.id) || (!!a.cc && !!c.cc?.includes(a.cc))) ? c : null;
  }

  /** What an ability is for this fighter, their talents counted in (for one that isn't theirs, the ability as it is). */
  how(f: Fighter, ab: Ability): Wired {
    return f.wired[ab.id] ?? { uses: ab.uses ?? [], gives: ab.gives ?? [], build: ab.build, spend: ab.spend };
  }

  /** The boon of theirs that an ability would use right now, if they carry one it uses. */
  boonFor(f: Fighter, ab: Ability): Use | null {
    if (!f.boons.length) return null;
    return this.how(f, ab).uses.find((u) => f.boons.some((b) => b.id === u.boon)) ?? null;
  }

  /**
   * Why an ability's button is lit, in a word or two, or null: a boon of theirs it would use, as many points as can be
   * held for it to spend, or its combo ready on whoever it would go to. The next thing to press is the thing that
   * shines.
   */
  lit(f: Fighter, ab: Ability, t: Fighter | null): string | null {
    if (this.phase !== 'fight' || f.dead) return null;
    const use = this.boonFor(f, ab);
    if (use) return BOONS[use.boon]?.name ?? null;
    if (f.points && f.pts >= f.points.max && this.how(f, ab).spend) return `${f.pts} ${f.points.name}`;
    return this.comboReady(f, ab, t)?.name ?? null;
  }

  /** How many points an ability needs before it can be used at all (a Closing Cut wants a Nick). */
  private needs(f: Fighter, ab: Ability): number {
    return f.points ? (this.how(f, ab).spend?.need ?? 0) : 0;
  }

  /**
   * A combo that landed for a hold of ice (Ability.shatter) uses one of its Shatters, and the last breaks it. Not when
   * something else it needs was there anyway: what its user set up, a stun, or a root that isn't ice. The ice, if it
   * still stands after this one.
   */
  private shatter(f: Fighter, c: NonNullable<Ability['combo']>, t: Fighter): Aura | null {
    const fits = (a: Aura): boolean => !!a.cc && !!c.cc?.includes(a.cc);
    if (t.auras.some((a) => (!!c.ab?.includes(a.ab) && a.src === f.id) || (fits(a) && a.shatters === undefined))) return null;
    const ice = t.auras.find((a) => fits(a) && (a.shatters ?? 0) > 0);
    if (!ice) return null;
    ice.shatters = ice.shatters! - 1;
    if (ice.shatters > 0) return ice;
    t.auras = t.auras.filter((a) => a !== ice);
    this.events.push({ k: 'word', id: t.id, word: 'Shattered' });
    return null;
  }
  /** The ice a spear is shattering this moment: its blow doesn't count toward breaking it (land). */
  private sparing: Aura | null = null;

  /** Is `f` at `t`'s back: behind the way they last faced? */
  behind(f: { x: number; y: number }, t: Fighter): boolean {
    const fd = Math.hypot(t.dirX, t.dirY) || 1;
    const dx = f.x - t.x;
    const dy = f.y - t.y;
    const d = Math.hypot(dx, dy) || 1;
    return (dx * t.dirX + dy * t.dirY) / (d * fd) < -0.3;
  }

  /** What talents make of an ability for this fighter. */
  private tuneOf(f: Fighter, ab: Ability | undefined): Tune | undefined {
    if (!ab) return undefined;
    return f.wired[ab.id]?.tune;
  }

  /** How long an ability takes this fighter to cast right now: none with a boon that makes it instant. */
  castOf(f: Fighter, ab: Ability): number {
    if (ab.cast <= 0 || this.boonFor(f, ab)?.instant) return 0;
    return ab.cast * (this.tuneOf(f, ab)?.cast ?? 1);
  }

  /** Up in the dark before a Night's Ruin comes down: nothing reaches them, and nobody can aim at them. */
  aloft(f: Fighter): boolean {
    return f.auras.some((a) => a.kind === 'aloft');
  }

  /** In the shroud: hidden from the other side. */
  hidden(f: Fighter): boolean {
    return f.auras.some((a) => a.kind === 'veil');
  }

  /** Can't be seen by `by` at all: one of the other side, in the shroud or up in the dark. Nothing of theirs can be aimed at them. */
  unseen(o: Fighter, by: { team: 0 | 1 }): boolean {
    return o.team !== by.team && (this.hidden(o) || this.aloft(o));
  }

  /** Out of the fight: a while since they hurt anyone or were hurt. */
  calm(f: Fighter): boolean {
    return this.clock - (f.fought ?? -Infinity) >= VEIL.calm;
  }

  held(f: Fighter): Aura | undefined {
    return f.auras.find((a) => a.cc === 'stun' || a.cc === 'fear' || a.cc === 'incap' || a.still || a.kind === 'aloft');
  }
  rooted(f: Fighter): boolean {
    return f.auras.some((a) => a.cc === 'root' || a.kind === 'oak') && !f.auras.some((a) => a.kind === 'free');
  }
  silenced(f: Fighter): boolean {
    return f.auras.some((a) => a.cc === 'silence');
  }
  moving(f: Fighter): boolean {
    return Math.hypot(f.vx, f.vy) > 1;
  }

  /** Why this fighter can't use this right now, or null if they can. Doesn't change anything. */
  blocked(f: Fighter, ab: Ability, target?: Fighter | null, at?: { x: number; y: number }): string | null {
    if (this.phase !== 'fight') return 'Wait for the gates';
    if (f.dead) return 'You have fallen';
    if (f.auras.some((a) => a.still)) return 'Sealed in ice';
    if (this.aloft(f)) return 'You can’t do that now';
    if (f.cast?.ab === ab.id) return 'Already casting';
    // as in the classic arenas: a cast runs to its end, and what's pressed meanwhile waits (a channel can be cut short)
    if (f.cast && !f.cast.channel && !ab.free) return 'Casting';
    if (!ab.anyState && this.held(f)) return 'You can’t do that now';
    if (ab.school !== 'physical') {
      if (this.silenced(f)) return 'Silenced';
      if ((f.locks[ab.school] ?? 0) > 0) return `${ab.school[0]!.toUpperCase()}${ab.school.slice(1)} is locked`;
    }
    if (ab.super && f.charge < 1) return 'Your super isn’t charged';
    if (ab.veiled && !this.hidden(f)) return 'Only from the shroud';
    if (f.pts < this.needs(f, ab)) return `No ${f.points!.name} yet`;
    // (rousing the dead wants some standing, unless it calls them up first)
    if (ab.effects.some((e) => e.k === 'frenzy') && !ab.effects.some((e) => e.k === 'raise') && !this.fighters.some((o) => o.pet?.owner === f.id && !o.dead)) return 'None of your dead stand';
    // (a boon that makes it ready at once: whatever its cooldown)
    if ((f.cds[ab.id] ?? 0) > 0 && !this.boonFor(f, ab)?.nocd) return 'Not ready yet';
    if (!ab.free && f.gcd > 0) return 'Not ready yet';
    if (ab.aim === 'ground' && at) {
      // placed by hand: anywhere in reach that its user can see (it is brought back into reach if put past it)
      const p = this.reach(f, ab, at);
      return this.sees(f, { x: p.x, y: p.y + 4 }) ? null : 'Out of sight';
    }
    if (ab.aim === 'enemy' || ab.aim === 'friend' || ab.aim === 'ground') {
      const t = target === undefined ? this.aimOf(f, ab) : target;
      if (!t) return ab.aim === 'enemy' ? 'Nobody to aim at' : 'Nobody to help';
      if (t.dead) return 'They have fallen';
      if (this.unseen(t, f)) return 'Out of sight';
      if (Math.hypot(t.x - f.x, t.y - f.y) > ab.range + HERO_R) return 'Too far away';
      if (t !== f && !this.sees(f, t)) return 'Out of sight';
    }
    return null;
  }

  /** A placed ability's point, brought back into its reach and onto the ground. */
  reach(f: Fighter, ab: Ability, at: { x: number; y: number }): { x: number; y: number } {
    const dx = at.x - f.x;
    const dy = at.y - f.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, ab.range / d);
    return { x: Math.max(0, Math.min(ARENA_W, f.x + dx * k)), y: Math.max(0, Math.min(ARENA_H, f.y + dy * k)) };
  }

  /** Who an ability would land on. Without a chosen enemy, the nearest one in sight. */
  aimOf(f: Fighter, ab: Ability): Fighter | null {
    if (ab.aim === 'self' || ab.aim === 'near') return f;
    if (ab.aim === 'friend') {
      const t = f.friend === null ? null : this.fighters[f.friend];
      return t && !t.dead && t.team === f.team ? t : f;
    }
    const t = f.target === null ? null : this.fighters[f.target];
    if (t && !t.dead && t.team !== f.team && !this.unseen(t, f)) return t;
    let best: Fighter | null = null;
    let bd = Infinity;
    for (const o of this.enemiesOf(f)) {
      if (this.unseen(o, f)) continue;
      // (a hero before somebody's raised dead, unless the dead are a good deal nearer: chosen, they are hit like anyone)
      const d = Math.hypot(o.x - f.x, o.y - f.y) + (this.sees(f, o) ? 0 : 1000) + (o.pet ? 120 : 0);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  /* -------------------------------------------------------------- asking */

  /** A player presses an ability. Null if it went off (or was queued); otherwise why not, in words. */
  press(id: number, abId: string, point?: { x: number; y: number }): string | null {
    const f = this.fighters[id];
    const ab = ABILITIES[abId];
    if (!f || !ab || (!f.bar.includes(abId) && !this.extras(f).includes(ab))) return 'You don’t have that';
    // (a point means something only to an ability that is placed)
    const at = ab.aim === 'ground' && point && Number.isFinite(point.x) && Number.isFinite(point.y) ? { x: point.x, y: point.y } : undefined;
    const why = this.blocked(f, ab, undefined, at);
    if (!why) {
      this.begin(f, ab, at);
      return null;
    }
    // a press in the last moments of a cast goes off the moment it lands
    if (why === 'Casting' && f.cast && f.cast.dur - f.cast.t <= QUEUE) {
      f.queued = { ab: ab.id, t: f.cast.dur - f.cast.t + QUEUE, at };
      return null;
    }
    // a press in the last moments of the global cooldown waits for it, so that a player never feels a dropped key
    if (why === 'Not ready yet' && !ab.free && !ab.super && (f.cds[ab.id] ?? 0) <= QUEUE && f.gcd <= QUEUE) {
      f.queued = { ab: ab.id, t: QUEUE, at };
      return null;
    }
    return why;
  }

  setTarget(id: number, target: number | null): void {
    const f = this.fighters[id];
    const t = target === null ? null : this.fighters[target];
    if (!f) return;
    // (nobody chooses what they can't see)
    if (t && this.unseen(t, f)) return;
    if (t && t.team !== f.team) f.target = t.id;
    else if (t && t.team === f.team) f.friend = t.id;
    else f.target = null;
  }

  private begin(f: Fighter, ab: Ability, point?: { x: number; y: number }): void {
    const t = this.aimOf(f, ab) ?? f;
    const cast = this.castOf(f, ab);
    // (a placed ability with a cast is aimed when the cast begins: the ground is chosen, then the wait)
    const at = point ?? (ab.aim === 'ground' && cast > 0 ? { x: t.x, y: t.y } : undefined);
    if (!ab.free) f.gcd = GCD;
    f.queued = null;
    // starting something else lets go of the last cast (a free ability goes off alongside it)
    if (!ab.free && f.cast) this.endCast(f);
    // (out of the shroud with anything but a quiet one: a cast at once, a blow as it lands)
    const opens = this.hidden(f) && !ab.quiet;
    // (whatever brings them out of the shroud starts a fight: they don't slip back in at once)
    if (opens) f.fought = this.clock;
    if (cast > 0 || ab.channel) {
      if (opens) this.unveil(f);
      f.cast = { ab: ab.id, target: t.id, at, t: 0, dur: ab.channel ?? cast, channel: !!ab.channel, next: ab.tick ?? 0, pushed: 0 };
      this.events.push({ k: 'ab', id: f.id, ab: ab.id });
      if (ab.channel) {
        this.spend(f, ab);
        f.cast.p = this.arm(f, ab);
        this.went(f, ab);
        this.started(f, ab);
      }
      return;
    }
    this.spend(f, ab);
    f.tal.opening = opens;
    this.fire(f, ab, t, at);
    f.tal.opening = false;
    if (opens) this.unveil(f);
  }

  private spend(f: Fighter, ab: Ability): void {
    // (a blood price: every attack costs a little life, never the last of it)
    const price = f.perks.does.price;
    if (price && (ab.aim === 'enemy' || ab.aim === 'near' || ab.aim === 'ground')) {
      const n = Math.round(Math.min(f.maxHp * price.cost, f.hp - 1));
      if (n > 0) {
        f.hp -= n;
        this.events.push({ k: 'num', id: f.id, n, kind: 'dmg', crit: false });
      }
    }
    if (ab.super) {
      f.charge = 0;
      f.score.supers = (f.score.supers ?? 0) + 1;
      this.events.push({ k: 'super', id: f.id, ab: ab.id });
    }
    // (with a boon that makes it ready at once, it starts no cooldown, and leaves the one it has running)
    if (ab.cd > 0 && !this.boonFor(f, ab)?.nocd) f.cds[ab.id] = ab.cd * f.mods.cool * (this.tuneOf(f, ab)?.cd ?? 1);
  }

  private endCast(f: Fighter): void {
    f.cast = null;
  }

  /* -------------------------------------------------------------- points and boons */

  /** Points built: up to as many as can be held. */
  private gain(f: Fighter, n: number): void {
    if (!f.points || n <= 0 || f.dead) return;
    f.pts = Math.min(f.points.max, f.pts + n);
  }

  /** A boon given: one more of it, up to as many as can be held, and its time started over. */
  private grant(f: Fighter, id: string, n = 1): void {
    const def = BOONS[id];
    if (!def || f.dead) return;
    const had = f.boons.find((b) => b.id === id);
    if (had) {
      had.n = Math.min(def.max ?? 1, had.n + n);
      had.t = def.dur;
    } else f.boons.push({ id, n: Math.min(def.max ?? 1, n), t: def.dur });
    this.events.push({ k: 'boon', id: f.id, boon: id });
  }

  /** The boons an ability gives its user at one moment (`on`), each by its own chance and count. */
  private give(f: Fighter, ab: Ability, on: 'land' | 'tick' | 'cast', crit = false, full = false): void {
    for (const g of this.how(f, ab).gives) {
      if ((g.on ?? 'land') !== on) continue;
      if (g.full && !full) continue;
      if (g.every) {
        const key = `${ab.id}:${g.boon}`;
        f.counts[key] = (f.counts[key] ?? 0) + 1;
        if (f.counts[key]! % g.every !== 0) continue;
      } else if (g.chance !== undefined && !(g.crit && crit) && this.rand() >= g.chance) continue;
      this.grant(f, g.boon, g.n ?? 1);
    }
  }

  /**
   * What their boons and points make of this use of an ability, as it goes off: the boons it uses are used up (unless
   * kept), every point is spent, and what they were worth is carried with it until it lands.
   */
  private arm(f: Fighter, ab: Ability): Punch {
    const p: Punch = { k: 1 };
    const how = this.how(f, ab);
    for (const u of how.uses) {
      const b = f.boons.find((x) => x.id === u.boon);
      if (!b) continue;
      if (u.mult) p.k *= u.mult;
      if (u.crit) p.crit = true;
      if (u.asCombo) p.combo = true;
      if (u.extra) p.extra = [...(p.extra ?? []), ...u.extra];
      if (u.drink) p.drink = u.drink;
      if (u.build) p.build = (p.build ?? 0) + u.build;
      if (u.keep) continue;
      b.n--;
      if (b.n <= 0) f.boons = f.boons.filter((x) => x !== b);
      p.said = BOONS[u.boon]?.name;
    }
    if (how.spend && f.points) {
      p.pts = f.pts;
      p.full = f.pts >= f.points.max;
      p.k *= 1 + how.spend.per * f.pts;
      p.hold = (how.spend.hold ?? 0) * f.pts;
      p.mend = how.spend.mend;
      f.pts = 0;
    }
    return p;
  }

  /** An ability has gone off: what it builds and gives as it does (not what waits for it to land). */
  private went(f: Fighter, ab: Ability): void {
    const b = this.how(f, ab).build;
    if (b && b.on === 'cast') this.gain(f, b.n);
    this.give(f, ab, 'cast');
  }

  /** An ability of theirs ticks (a burn, a patch of ground, a channel, a claw of the dead they raised with it). */
  private ticked(f: Fighter, ab: Ability | undefined): void {
    if (!ab || f.dead || f.pet) return;
    const b = this.how(f, ab).build;
    if (b && b.on === 'tick') this.gain(f, b.n);
    this.give(f, ab, 'tick');
  }

  /** A cast (or an instant) goes off. */
  private fire(f: Fighter, ab: Ability, t: Fighter, at?: { x: number; y: number }): void {
    this.events.push({ k: 'ab', id: f.id, ab: ab.id });
    const p = this.arm(f, ab);
    this.went(f, ab);
    this.started(f, ab);
    if (ab.dive && t !== f) {
      // up into the dark: nothing reaches them until they come down on whoever it was aimed at
      f.dive = { ab: ab.id, target: t.id, t: ab.dive, p };
      f.auras.push({ ab: ab.id, kind: 'aloft', src: f.id, t: ab.dive + 0.2, dur: ab.dive, harmful: false, magic: false, n: 0 });
      f.dash = null;
      this.lose(f);
      return;
    }
    if (ab.allies) {
      // (on every friend in reach and sight, its user among them)
      for (const o of this.friendsOf(f)) if (!o.pet && Math.hypot(o.x - f.x, o.y - f.y) <= ab.range + HERO_R && (o === f || this.sees(f, o))) this.land(f, ab, o, true, 1, p);
      return;
    }
    if (ab.aim === 'ground') {
      // placed: where its user put it, or under whoever it is aimed at. Everyone sees the patch before it lands.
      const to = this.reach(f, ab, at ?? t);
      const dur = ab.fall ?? 0.6;
      const dx = to.x - f.x;
      const dy = to.y - f.y;
      const d = Math.hypot(dx, dy);
      const fd = Math.hypot(f.dirX, f.dirY) || 1;
      this.zones.push({ ab: ab.id, src: f.id, team: f.team, x: to.x, y: to.y, r: ab.area ?? 40, t: dur, dur, p, ux: d > 4 ? dx / d : f.dirX / fd, uy: d > 4 ? dy / d : f.dirY / fd });
      return;
    }
    if (ab.aim === 'near') {
      for (const o of this.enemiesOf(f)) {
        if (Math.hypot(o.x - f.x, o.y - f.y) <= ab.range + HERO_R && this.sees(f, o)) this.land(f, ab, o, true, 1, p);
      }
      return;
    }
    if (ab.bolt && t !== f) {
      this.bolts.push(this.aim(f, ab, t, p));
      return;
    }
    this.land(f, ab, t, false, 1, p);
  }

  /**
   * An ability goes off (or a channel begins): what it does to its own user as it goes, and what a talent makes of it,
   * on every enemy near its user, on its user, and on every friend in reach.
   */
  private started(f: Fighter, ab: Ability): void {
    for (const e of ab.self ?? []) this.apply(f, ab, f, e);
    const tn = this.tuneOf(f, ab);
    if (!tn) return;
    if (tn.foes) for (const o of this.enemiesOf(f)) if (!o.dead && !this.unseen(o, f) && Math.hypot(o.x - f.x, o.y - f.y) <= NEAR + HERO_R && this.sees(f, o)) for (const e of tn.foes) if (!o.dead) this.apply(f, ab, o, e);
    for (const e of tn.self ?? []) this.apply(f, ab, f, e);
    if (tn.friends) for (const o of this.friendsOf(f)) if (!o.pet && Math.hypot(o.x - f.x, o.y - f.y) <= TALENT_REACH + HERO_R && (o === f || this.sees(f, o))) for (const e of tn.friends) this.apply(f, ab, o, e);
  }

  /** A shot leaves for its target. */
  private aim(f: Fighter, ab: Ability, t: Fighter, p?: Punch): Bolt {
    const d = Math.hypot(t.x - f.x, t.y - f.y) || 1;
    return { ab: ab.id, src: f.id, tgt: t.id, x: f.x, y: f.y - 8, vx: ((t.x - f.x) / d) * BOLT_SPEED, vy: ((t.y - f.y) / d) * BOLT_SPEED, age: 0, ...(p ? { p } : {}) };
  }

  /**
   * It reaches them. A blow already in the air lands whatever has come between: the time to stop it was before it left.
   * `area`: one of many it lands on at once (nothing reflects it). `scale`: how strong it lands, a talent's share.
   */
  private land(f: Fighter, ab: Ability, target: Fighter, area: boolean, scale = 1, p: Punch = { k: 1 }): void {
    let t = target;
    const harmful = ab.aim === 'enemy' || ab.aim === 'near' || ab.aim === 'ground';
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
    // a combo: what this hero set up on them (or the hold they're in) makes this land harder; a boon can stand in for it
    let boost = p.k;
    let combo: Ability['combo'] | null = null;
    let iced: Aura | null = null;
    const c = ab.combo;
    if (c && !t.dead) {
      const ready = !!this.comboReady(f, ab, t);
      if (ready || p.combo) {
        combo = c;
        // (no Momentum: a combo hits as hard the tenth time in a row as the first. The owner: "i dont like the momentum
        // idea, too much stuff on screen")
        boost *= c.mult;
        if (ready) {
          if (c.consume) t.auras = t.auras.filter((a) => !(!!c.ab?.includes(a.ab) && a.src === f.id));
          iced = this.shatter(f, c, t);
        }
      }
    }
    // (called out over them: the combo, or the boon that was used up on it; once for a use, however many it lands on)
    const word = combo?.name ?? (p.landed ? undefined : p.said);
    const counts = !!combo || (!p.landed && (!!p.said || (!!f.points && (p.pts ?? 0) >= Math.ceil(f.points.max / 2))));
    if (counts && !f.pet) f.score.combos = (f.score.combos ?? 0) + 1;
    if (word) this.events.push({ k: 'word', id: t.id, word, combo: true });
    // (the spear that shatters the ice isn't counted toward breaking it as well: its Shatters are its own limit)
    this.sparing = iced;
    this.forced = !!p.crit;
    this.critted = false;
    this.holdMore = p.hold ?? 0;
    const hp0 = t.hp;
    const dealt0 = f.score.dmg;
    for (const e of ab.effects) {
      if (t.dead && e.k !== 'heal') break;
      if (this.apply(f, ab, t, e, boost * scale) === 'stop') break;
    }
    this.sparing = null;
    this.holdMore = 0;
    if (combo?.extra) for (const e of combo.extra) if (!t.dead || e.k === 'heal') this.apply(f, ab, t, e);
    if (p.extra) for (const e of p.extra) if (!t.dead || e.k === 'heal') this.apply(f, ab, t, e, scale);
    this.forced = false;
    const crit = this.critted;
    // (what a boon or a spending of points makes it drink or mend, of what it dealt)
    const dealt = f.score.dmg - dealt0;
    if (dealt > 0 && p.drink) this.mend(f, dealt * p.drink);
    if (dealt > 0 && p.mend) {
      const to = this.mostHurt(f);
      if (to) this.heal(f, to, dealt * p.mend, false);
    }
    // (a combo's or a super's landing, the hero's best of the match if it did the most yet)
    if ((counts || ab.super) && !f.pet) {
      const n = Math.round(Math.abs(t.hp - hp0));
      if (n > (f.score.best?.n ?? 0)) f.score.best = { ab: ab.id, n, ...(word ? { combo: word } : {}) };
    }
    // what a use does once, as it first lands on someone: the points it builds and the boons it gives (a trap laid
    // has landed on nobody yet: what waits on it waits for the trap to catch someone, tripTraps)
    if (!p.landed && !ab.effects.some((e) => e.k === 'trap')) {
      p.landed = true;
      const how = this.how(f, ab);
      if (how.build && (how.build.on ?? 'land') === 'land') this.gain(f, how.build.n);
      if (p.build) this.gain(f, p.build);
      this.give(f, ab, 'land', crit, !!p.full);
    }
    const tune = this.tuneOf(f, ab);
    if (!tune) return;
    // what a talent adds to an ability: more that it does (as strong as what was spent on it), and others it reaches
    if (tune.extra) for (const e of tune.extra) if (!t.dead) this.apply(f, ab, t, e, scale * p.k);
    if (tune.nth && !area) {
      const key = `${ab.id}:nth`;
      f.counts[key] = (f.counts[key] ?? 0) + 1;
      if (f.counts[key]! % tune.nth.n === 0) {
        this.events.push({ k: 'word', id: t.id, word: tune.nth.name, combo: true });
        for (const e of tune.nth.extra) if (!t.dead) this.apply(f, ab, t, e);
      }
    }
    if (area) return;
    if (tune.line) {
      // (on through everyone in a line behind them, as far again as half its reach)
      const dx = t.x - f.x;
      const dy = t.y - f.y;
      const len = Math.hypot(dx, dy) || 1;
      for (const o of this.enemiesOf(f)) {
        if (o === t || this.unseen(o, f)) continue;
        const along = ((o.x - f.x) * dx + (o.y - f.y) * dy) / len;
        const off = Math.abs((o.x - f.x) * dy - (o.y - f.y) * dx) / len;
        if (along > 0 && along < len + ab.range / 2 && off < HERO_R * 2) this.land(f, ab, o, true, 1, p);
      }
    }
    if (tune.bounce) {
      const next = this.enemiesOf(f)
        .filter((o) => o !== t && !o.pet && !this.unseen(o, f) && Math.hypot(o.x - t.x, o.y - t.y) < NEAR * 1.5 && this.sees(t, o))
        .sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
      if (next) {
        this.events.push({ k: 'streak', id: t.id, to: next.id, ab: ab.id });
        this.land(f, ab, next, true, 1, p);
      }
    }
    if (tune.spread && ab.aim === 'friend') for (const o of this.friendsOf(f)) if (o !== t && !o.pet) this.land(f, ab, o, true, tune.spread, p);
  }

  /** While something lands: its hit is a critical one come what may, whether it was one, and how much longer its hold lasts. */
  private forced = false;
  private critted = false;
  private holdMore = 0;

  /**
   * Whoever was casting at them loses them, whoever had them chosen loses them, and what was flying at them goes
   * astray: they have gone where nobody can aim (into the shroud, up into the dark).
   */
  private lose(f: Fighter): void {
    this.endCast(f);
    for (const o of this.fighters) {
      if (o.team === f.team || o.dead) continue;
      if (o.target === f.id) o.target = null;
      if (o.cast && o.cast.target === f.id && !o.cast.at) {
        this.endCast(o);
        this.events.push({ k: 'word', id: o.id, word: 'Lost sight', bad: true });
      }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]!;
      if (b.tgt !== f.id) continue;
      this.bolts.splice(i, 1);
      this.events.push({ k: 'miss', x: b.x, y: b.y, ab: b.ab });
    }
  }

  private immuneTo(t: Fighter, ab: Ability): boolean {
    return t.auras.some((a) => a.kind === 'aloft' || (a.kind === 'immune' && (!a.phys || ab.school === 'physical')));
  }

  private addAura(t: Fighter, a: Omit<Aura, 't'>): Aura {
    // (what the other side puts on someone brings them out of the shroud)
    if (a.harmful) {
      const by = this.fighters[a.src];
      if (by) this.exposed(t, by);
      // (held, slowed or cursed by the other side is in the fight, as is whoever did it)
      if (by && by.team !== t.team) {
        t.fought = this.clock;
        this.masterOf(by).fought = this.clock;
      }
    }
    // (a paladin's hand of freedom shakes a slow off at once, now and then)
    if (a.kind === 'slow' && a.harmful && this.freed(t)) return { ...a, t: 0 };
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
    const power = (this.tuneOf(f, ab)?.power ?? 1) * boost;
    // (a druid's long seasons: what burns or mends over time goes on longer, as strong each second)
    const season = 1 + (f.perks.does.seasons?.pct ?? 0);
    switch (e.k) {
      case 'dmg': {
        const dealt = this.damage(f, t, e.n * power, true, ab);
        // what drains gives back: an ability with both heals its user (or, sharpened, a share of all it dealt)
        const drink = this.tuneOf(f, ab)?.drink;
        if (drink && dealt > 0) this.mend(f, dealt * drink);
        return;
      }
      case 'heal':
        if (this.tuneOf(f, ab)?.drink && ab.aim === 'enemy') return;
        this.heal(f, ab.aim === 'enemy' ? f : t, e.n * power);
        return;
      case 'dot':
        this.addAura(t, { ...base, kind: 'dot', harmful: true, dur: e.dur * season, n: (e.n * power) / e.dur, next: 1 });
        return;
      case 'hot':
        this.addAura(t, { ...base, kind: 'hot', harmful: false, dur: e.dur * season, n: (e.n * power) / e.dur, next: 1 });
        return;
      case 'cc':
        return this.crowd(f, ab, t, e.cc, (e.dur + this.holdMore) * (this.tuneOf(f, ab)?.dur ?? 1) * f.mods.hold) ? undefined : 'stop';
      case 'slow':
        this.addAura(t, { ...base, kind: 'slow', harmful: true, dur: e.dur * t.mods.tenacity * f.mods.hold, n: e.pct / 100 });
        return;
      case 'antiheal':
        this.addAura(t, { ...base, kind: 'antiheal', harmful: true, dur: e.dur, n: e.pct / 100 });
        return;
      case 'absorb':
        // (a shield fades as healing does, the longer the match goes: or a warded healer never falls)
        if (this.dampening < 1) this.addAura(t, { ...base, kind: 'absorb', harmful: false, dur: e.dur, n: e.n * power * (1 - this.dampening) });
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
        this.traps.push({ ab: ab.id, src: f.id, team: f.team, x: f.x, y: f.y, arm: 1, life: 30, cc: e.cc, dur: e.dur * (this.tuneOf(f, ab)?.dur ?? 1) * f.mods.hold });
        return;
      case 'raise':
        this.raise(f, ab, e);
        return;
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
        // (a fault line: dragged in to arm's length, where it would throw them out)
        if (this.tuneOf(f, ab)?.pull) {
          this.drag(t, f.x, f.y, HERO_R * 2 + 2);
          return;
        }
        t.dash = { x: t.x + (dx / d) * e.dist, y: t.y + (dy / d) * e.dist, speed: 380 };
        if (t.cast) this.endCast(t);
        this.events.push({ k: 'word', id: t.id, word: 'Knocked back', bad: true });
        return;
      }
      case 'veil':
        this.veil(f, ab);
        return;
      case 'behind':
        if (t !== f) this.stepBehind(f, t);
        return;
      case 'pull':
        if (t !== f && !t.dead) this.drag(t, f.x, f.y, HERO_R * 2 + 2);
        return;
      case 'mark':
        this.addAura(t, { ...base, kind: 'mark', harmful: true, magic: false, dur: e.dur, n: e.pct / 100 });
        return;
      case 'undot':
        t.auras = t.auras.filter((a) => a.kind !== 'dot');
        return;
      case 'frenzy':
        for (const o of this.fighters) {
          if (o.pet?.owner !== f.id || o.dead) continue;
          this.addAura(o, { ...base, kind: 'fury', harmful: false, magic: false, dur: e.dur, n: e.pct / 100 });
          this.addAura(o, { ...base, kind: 'speed', harmful: false, magic: false, dur: e.dur, n: 1 / 3 });
        }
        return;
    }
  }

  /**
   * Into the shroud. Whoever had them chosen loses them, what was being cast at them is lost, and what was flying at
   * them goes astray. Taken out of a fight (Match.calm) it is back in moments; in one, it shakes off roots and slows
   * (the ability's own `break`), nothing that lands breaks it for a moment, and it is the long way back.
   */
  private veil(f: Fighter, ab: Ability | null): void {
    const calm = this.calm(f);
    f.auras = f.auras.filter((a) => a.kind !== 'veil');
    f.auras.push({ ab: ab?.id ?? 'g-veil', kind: 'veil', src: f.id, t: VEIL.t, dur: 0, harmful: false, magic: false, n: VEIL.slow, keep: calm ? VEIL.t : VEIL.t - VEIL.grace });
    if (ab && calm) f.cds[ab.id] = VEIL.rest * f.mods.cool;
    this.lose(f);
  }

  /** Out of the shroud (they struck, or were struck once it could break). */
  private unveil(f: Fighter): void {
    if (!this.hidden(f)) return;
    f.auras = f.auras.filter((a) => a.kind !== 'veil');
  }

  /** Something of the other side lands on them: out of the shroud, unless it was taken a moment ago in a fight. */
  private exposed(t: Fighter, src: Fighter): void {
    if (src.team === t.team) return;
    const v = t.auras.find((a) => a.kind === 'veil');
    if (!v || v.t > (v.keep ?? VEIL.t)) return;
    this.unveil(t);
    this.events.push({ k: 'word', id: t.id, word: 'Revealed', bad: true });
  }

  /** Out of the dark at their back, facing them (beside them, if stone stands behind them). */
  private stepBehind(f: Fighter, t: Fighter): void {
    const fd = Math.hypot(t.dirX, t.dirY);
    const back = fd > 0.01 ? Math.atan2(-t.dirY / fd, -t.dirX / fd) : Math.atan2(f.y - t.y, f.x - t.x);
    const r = HERO_R * 2 + 2;
    for (const off of [0, 0.5, -0.5, 1, -1, 1.6, -1.6]) {
      const x = t.x + Math.cos(back + off) * r;
      const y = t.y + Math.sin(back + off) * r;
      if (this.hits(x, y) || x < HERO_R || y < HERO_R + 4 || x > ARENA_W - HERO_R || y > ARENA_H - HERO_R) continue;
      f.x = x;
      f.y = y;
      break;
    }
    const d = Math.hypot(t.x - f.x, t.y - f.y) || 1;
    f.dirX = (t.x - f.x) / d;
    f.dirY = (t.y - f.y) / d;
    f.dash = null;
    f.target = t.id;
    this.endCast(f);
  }

  /** Crowd control, with its diminishing returns. False if it did nothing. */
  private crowd(f: Fighter, ab: Ability, t: Fighter, cc: CcKind, dur: number): boolean {
    // (a hold that never wears off with use is counted as a first one, and counts toward nothing)
    const dr = !ab.noDr && t.dr[cc] && t.dr[cc]!.until > this.clock ? t.dr[cc]! : { n: 0, until: 0 };
    if (dr.n >= DR_STEPS.length) {
      this.events.push({ k: 'word', id: t.id, word: 'Immune' });
      return false;
    }
    // a warlock's mirror curse: the first hold now and then goes back on whoever put it, for less
    const mirror = t.perks.does.mirror;
    if (mirror && f !== t && f.team !== t.team && !f.dead && this.ready(t, 'mirror')) {
      t.procs.mirror = this.clock + mirror.every;
      this.events.push({ k: 'word', id: t.id, word: abOfDoing(t.cls, 'mirror').name });
      this.crowd(t, ab, f, cc, dur * mirror.share);
      return false;
    }
    // a paladin's hand of freedom: a root shaken off at once
    if (cc === 'root' && this.freed(t)) return false;
    // (and his aura of resolve: shorter, near him)
    const resolve = this.near(t, 'resolve', 'friend');
    const lasts = dur * DR_STEPS[dr.n]! * t.mods.tenacity * (1 - (resolve?.d.pct ?? 0));
    if (!ab.noDr) t.dr[cc] = { n: dr.n + 1, until: this.clock + lasts + DR_RESET, at: this.clock, ab: ab.id };
    t.auras = t.auras.filter((a) => a.cc !== cc);
    this.addAura(t, { ab: ab.id, src: f.id, dur: lasts, magic: ab.school !== 'physical', n: 0, kind: 'cc', harmful: true, cc, took: 0, ...(cc === 'root' && ab.shatter ? { shatters: ab.shatter } : {}) });
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
  }

  private blink(f: Fighter, dist: number): void {
    const d = Math.hypot(f.dirX, f.dirY) || 1;
    this.blinkTo(f, f.dirX / d, f.dirY / d, dist);
  }

  /** Vanish and appear this far along (ux, uy), or as far as it can go without ending inside a pillar. */
  private blinkTo(f: Fighter, ux: number, uy: number, dist: number): void {
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

  /** A paladin's hand of freedom near them, if it is ready: it shakes off what was about to slow or root them. */
  private freed(t: Fighter): boolean {
    const hand = this.near(t, 'freedom', 'friend');
    if (!hand || !this.ready(hand.by, 'freedom')) return false;
    hand.by.procs.freedom = this.clock + hand.d.every;
    this.events.push({ k: 'word', id: t.id, word: abOfDoing(hand.by.cls, 'freedom').name });
    return true;
  }

  /** Pulled toward a point, to stop this far short of it, and cut off from what they were casting. */
  private drag(t: Fighter, x: number, y: number, stop: number): void {
    const dx = x - t.x;
    const dy = y - t.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d <= stop) return;
    t.dash = { x: t.x + (dx / d) * (d - stop), y: t.y + (dy / d) * (d - stop), speed: 400 };
    if (t.cast) this.endCast(t);
    this.events.push({ k: 'word', id: t.id, word: 'Dragged in', bad: true });
  }

  /* -------------------------------------------------------------- the raised dead */

  /**
   * The dead come up out of the ground at their master's sides, a little ahead (on the stone's near side if that's
   * where the side is). Whatever of theirs still stood from the last calling crumbles first: a master has only so many.
   */
  private raise(f: Fighter, ab: Ability, e: Extract<Effect, { k: 'raise' }>): void {
    for (const o of this.fighters) if (o.pet?.owner === f.id && !o.dead) this.crumble(o);
    const n = e.n + (this.tuneOf(f, ab)?.more ?? 0);
    for (let i = 0; i < n; i++) {
      const [x, y] = this.besideOf(f, i);
      this.fighters.push(this.makePet(f, x, y, { ab: ab.id, hp: e.hp, dmg: e.dmg, slow: e.slow, life: e.life, max: e.life, next: 0.5, hits: 0 }));
    }
  }

  /** Where the `i`th of the raised dead comes up: at its master's side, a little ahead (or on them, if the stone is there). */
  private besideOf(f: Fighter, i: number): [number, number] {
    const d = Math.hypot(f.dirX, f.dirY) || 1;
    const ux = f.dirX / d;
    const uy = f.dirY / d;
    const side = (i % 2 ? 1 : -1) * (14 + Math.floor(i / 2) * 10);
    const x = f.x + ux * 8 - uy * side;
    const y = f.y + uy * 8 + ux * side;
    return this.hits(x, y) || x < HERO_R || y < HERO_R + 4 || x > ARENA_W - HERO_R || y > ARENA_H - HERO_R ? [f.x, f.y] : [x, y];
  }

  /** One of the raised dead, as a fighter: the next place in the match, on its master's side and with their share. */
  private makePet(owner: Fighter, x: number, y: number, p: Omit<Pet, 'owner' | 'end'> & { hp: number }): Fighter {
    return {
      id: this.fighters.length,
      team: owner.team,
      cls: owner.cls,
      name: THRALL.name,
      bar: [],
      seat: null,
      human: false,
      x,
      y,
      vx: 0,
      vy: 0,
      dirX: owner.dirX,
      dirY: owner.dirY,
      walk: 0,
      hp: p.hp,
      maxHp: p.hp,
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
      talents: [],
      ult: owner.ult,
      // (they hit with their master's share, and none of the rest of their talents)
      mods: { dmg: owner.mods.dmg, heal: 1, speed: THRALL.speed, tenacity: 1, cool: 1, hold: 1, guard: 1, charge: 0, crit: CRIT },
      perks: NO_PERKS,
      procs: {},
      tal: {},
      tune: {},
      spec: owner.spec,
      points: null,
      pts: 0,
      boons: [],
      wired: {},
      counts: {},
      dive: null,
      score: { dmg: 0, heal: 0, cc: 0, kicks: 0 },
      charge: 0,
      pet: { owner: owner.id, ab: p.ab, life: p.life, max: p.max, dmg: p.dmg, slow: p.slow, next: p.next, hits: p.hits },
    };
  }

  /** Its time is up, or its master has fallen: back into the ground. */
  private crumble(p: Fighter): void {
    if (p.dead || !p.pet) return;
    p.dead = true;
    p.hp = 0;
    p.auras = [];
    p.dash = null;
    p.pet.end = this.clock;
    this.events.push({ k: 'death', id: p.id });
    this.ashburst(p);
  }

  /** One of the dead is gone, cut down or crumbled: with its master's Ashburst it bursts on every enemy beside it. */
  private ashburst(p: Fighter): void {
    const owner = p.pet ? this.fighters[p.pet.owner] : undefined;
    const burst = owner?.perks.does.corpse;
    if (!owner || !burst || owner.dead) return;
    const ab = abOfDoing(owner.cls, 'corpse');
    this.events.push({ k: 'zone', x: p.x, y: p.y, r: burst.reach, ab: p.pet!.ab });
    for (const o of this.enemiesOf(owner)) if (Math.hypot(o.x - p.x, o.y - p.y) <= burst.reach + HERO_R) this.damage(owner, o, burst.n, false, ab);
  }

  /**
   * One of the raised dead, for a moment: it goes for its master's enemy (whoever they have chosen, else the nearest
   * of the other side it can see, a hero before somebody else's dead), walks round the stone to them, and strikes when
   * it is close. Held, it does nothing; afraid, it runs like anyone. With no one to fight it keeps to its master's side.
   */
  private tickPet(p: Fighter, dt: number): void {
    const pet = p.pet!;
    const owner = this.fighters[pet.owner];
    pet.life -= dt;
    if (pet.life <= 0 || !owner || owner.dead) {
      this.crumble(p);
      return;
    }
    this.tickAuras(p, dt);
    if (p.dead) return;
    pet.next = Math.max(0, pet.next - dt);
    const t = this.petTarget(p, owner);
    p.target = t?.id ?? null;
    let move: MoveInput = { mx: 0, my: 0 };
    if (t) {
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > THRALL.reach) move = this.petStep(p, dx / d, dy / d);
      else if (!this.held(p)) {
        p.dirX = dx / d;
        p.dirY = dy / d;
      }
      if (d <= THRALL.reach + HERO_R && pet.next <= 0 && !this.held(p) && this.sees(p, t)) this.claw(p, t);
    } else {
      const dx = owner.x - p.x;
      const dy = owner.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 28) move = this.petStep(p, dx / d, dy / d);
    }
    this.moveFighter(p, dt, move);
  }

  private petTarget(p: Fighter, owner: Fighter): Fighter | null {
    const open = (o: Fighter): boolean => !this.immuneTo(o, CLAW);
    const want = owner.target === null ? null : this.fighters[owner.target];
    if (want && !want.dead && want.team !== p.team && !this.unseen(want, p) && open(want) && this.sees(p, want)) return want;
    let best: Fighter | null = null;
    let bd = Infinity;
    for (const o of this.enemiesOf(p)) {
      if (this.unseen(o, p)) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y) + (o.pet ? 60 : 0) + (this.sees(p, o) ? 0 : 400) + (open(o) ? 0 : 600);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  /** The way to walk toward somewhere, turned aside for the stone in the way. */
  private petStep(p: Fighter, ux: number, uy: number): MoveInput {
    const a0 = Math.atan2(uy, ux);
    for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
      const a = a0 + off;
      const x = p.x + Math.cos(a) * 14;
      const y = p.y + Math.sin(a) * 14;
      if (!this.hits(x, y) && x > HERO_R && y > HERO_R + 4 && x < ARENA_W - HERO_R && y < ARENA_H - HERO_R) return { mx: Math.cos(a), my: Math.sin(a) };
    }
    return { mx: ux, my: uy };
  }

  private claw(p: Fighter, t: Fighter): void {
    const pet = p.pet!;
    pet.next = THRALL.every;
    pet.hits++;
    this.events.push({ k: 'claw', id: p.id, to: t.id });
    if (this.immuneTo(t, CLAW)) {
      this.events.push({ k: 'word', id: t.id, word: 'Immune' });
      return;
    }
    this.damage(p, t, pet.dmg, true, CLAW);
    // (the slow is its master's, put on with the ability that raised it: what a combo of theirs looks for)
    if (!t.dead && pet.slow > 0) this.addAura(t, { ab: pet.ab, src: pet.owner, dur: 2 * t.mods.tenacity, magic: false, n: pet.slow / 100, kind: 'slow', harmful: true });
    // (and each claw is a tick of that ability, to whatever of its master's waits on one)
    const owner = this.fighters[pet.owner];
    if (owner) this.ticked(owner, ABILITIES[pet.ab]);
  }

  /* -------------------------------------------------------------- hurting and mending */

  /** What a hit does, all told: what it was worth before any shield took it (for what drinks it), or 0 if it did nothing. */
  private damage(src: Fighter, t: Fighter, amount: number, direct: boolean, ab?: Ability): number {
    if (t.dead) return 0;
    if (ab && this.immuneTo(t, ab)) return 0;
    // (what the raised dead do is their master's doing, and they are worth less to a meter, striking or struck)
    const by = this.masterOf(src);
    if (src !== t && amount > 0) {
      by.fought = this.clock;
      t.fought = this.clock;
      this.exposed(t, src);
    }
    let n = amount * src.mods.dmg;
    // (fights turn on bursts: a blow hits a little harder than its number, a burst ability harder still, a crit a lot)
    if (direct) n *= HIT_K;
    if (direct && ab?.role === 'burst') n *= BURST_K;
    // (a headsman's talent: harder on whoever is low)
    if (src.perks.exec && t.hp < t.maxHp * EXECUTE) n *= 1 + src.perks.exec;
    if (direct) n *= this.sharpen(src, t, ab);
    let crit = false;
    if (direct && (this.forced || this.rand() < src.mods.crit)) {
      n *= CRIT_K;
      crit = true;
      this.critted = true;
    }
    for (const a of src.auras) {
      if (a.kind === 'fury') n *= 1 + a.n;
      else if (a.kind === 'weak') n *= 1 - a.n;
    }
    // (a ranger's quarry: their whole side hits it harder; a paladin's wrath: all who stand near him)
    for (const a of t.auras) if (a.kind === 'mark' && this.fighters[a.src]?.team === by.team) n *= 1 + a.n;
    const wrath = this.near(src, 'wrath', 'friend');
    if (wrath) n *= 1 + wrath.d.pct;
    for (const a of t.auras) if (a.kind === 'guard') n *= 1 - a.n;
    n = Math.round(n * t.mods.guard * this.toughness(t, direct, ab));
    by.score.dmg += n;
    if (src !== t) {
      const k = src.pet || t.pet ? THRALL.charge : 1;
      // (a super's own blow doesn't fill the meter it just emptied)
      if (!ab?.super) by.charge = Math.min(1, by.charge + (n / SUPER_DEALT) * k * by.mods.charge);
      if (!t.pet) t.charge = Math.min(1, t.charge + (n / SUPER_TAKEN) * t.mods.charge);
      // what the striker's talents make of it, what it does to whoever is hit, and what theirs answer with
      if (n > 0) this.dealt(src, t, n, direct, crit);
      if (direct && ab) this.onHit(src, t);
      if (direct && !t.dead) this.struck(t, src, ab);
    }
    const worth = n;
    n = this.arcaneSkin(t, this.shoulder(t, n));
    for (const a of t.auras) {
      if (a.kind !== 'absorb' || n <= 0) continue;
      const soak = Math.min(a.n, n);
      a.n -= soak;
      n -= soak;
      this.events.push({ k: 'num', id: t.id, n: soak, kind: 'absorb', crit: false });
    }
    t.auras = t.auras.filter((a) => a.kind !== 'absorb' || a.n > 0);
    if (n <= 0) return worth;
    // (a rewind keeps a few seconds of what was taken, to give some of it back)
    if (t.perks.does.rewind) t.tal.hurt = [...(t.tal.hurt ?? []).filter((h) => h.at >= this.clock - t.perks.does.rewind!.back), { at: this.clock, n }];
    this.wound(t, n, crit);
    if (t.dead) return worth;
    // what holds them breaks with hurt: a daze at once, a fear or a root once enough has landed; a stun never
    for (let i = t.auras.length - 1; i >= 0; i--) {
      const a = t.auras[i]!;
      if ((a.cc !== 'incap' && a.cc !== 'fear' && a.cc !== 'root') || a === this.sparing) continue;
      a.took = (a.took ?? 0) + n;
      const limit = a.cc === 'incap' ? 0 : t.maxHp * (a.cc === 'fear' ? FEAR_BREAK : ROOT_BREAK);
      if (a.took <= limit) continue;
      t.auras.splice(i, 1);
      this.events.push({ k: 'word', id: t.id, word: 'Broke free' });
    }
    // a blow knocks a cast back (twice at most; as far again and as often as they land, from a paladin's stern blows)
    if (direct && t.cast && !t.cast.channel) {
      const stern = src.perks.does.stern;
      if (stern) t.cast.t = Math.max(0, t.cast.t - stern.push);
      else if (t.cast.pushed < 2) {
        t.cast.pushed++;
        t.cast.t = Math.max(0, t.cast.t - 0.25);
      }
    }
    return worth;
  }

  /** What makes a striker's own hit land harder, by their talents: a grudge, a long shot, a blood price, the first blow out of the shroud, the moon's turn. */
  private sharpen(src: Fighter, t: Fighter, ab?: Ability): number {
    const does = src.perks.does;
    let k = 1;
    if (does.grudge) {
      const g = src.tal.grudge?.on === t.id ? src.tal.grudge : { on: t.id, n: -1 };
      g.n = Math.min(does.grudge.max, g.n + 1);
      src.tal.grudge = g;
      k *= 1 + does.grudge.step * g.n;
    }
    if (does.far && ab && ab.range > ARM && Math.hypot(t.x - src.x, t.y - src.y) > ab.range / 2) k *= 1 + does.far.pct;
    if (does.price) k *= 1 + does.price.pct;
    if (does.shade && src.tal.opening) k *= 1 + does.shade.pct;
    if (does.tides && src.tal.hit) {
      k *= 1 + does.tides.pct;
      src.tal.hit = false;
    }
    return k;
  }

  /** What takes some of a hit off whoever it lands on, by their talents: plate against blows, antivenom against what burns, bone. */
  private toughness(t: Fighter, direct: boolean, ab?: Ability): number {
    const does = t.perks.does;
    let k = 1;
    if (does.plate && ab?.school === 'physical') k *= 1 - does.plate.pct;
    if (does.antivenom && !direct) k *= 1 - does.antivenom.pct;
    if (does.bones && direct && (t.tal.bones ?? 0) > 0) {
      k *= 1 - does.bones.pct;
      t.tal.bones = (t.tal.bones ?? 0) - 1;
    }
    return k;
  }

  /** A paladin near them takes a share of it (their shared burden): what is left for them. */
  private shoulder(t: Fighter, n: number): number {
    if (n <= 0 || t.pet) return n;
    for (const p of this.fighters) {
      const b = p.perks.does.burden;
      if (!b || p === t || p.dead || p.pet || p.team !== t.team || Math.hypot(p.x - t.x, p.y - t.y) > NEAR) continue;
      if (p.auras.some((a) => a.kind === 'immune' || a.kind === 'spirit')) continue;
      const part = Math.round(n * b.share);
      if (part <= 0) return n;
      this.wound(p, Math.max(1, Math.round(part * p.mods.guard)), false);
      return n - part;
    }
    return n;
  }

  /** A mage's arcane skin turns a share of it aside while they stand over a share of their health: what is left for it. */
  private arcaneSkin(t: Fighter, n: number): number {
    const skin = t.perks.does.skin;
    if (!skin || n <= 0 || t.hp < t.maxHp * skin.above) return n;
    return n - Math.round(n * skin.share);
  }

  /** What the striker's talents make of damage dealt: a revenant's drink, light returned, a thirst, a soul's ward, wildfire, sun and moon, a verdict. */
  private dealt(src: Fighter, t: Fighter, n: number, direct: boolean, crit: boolean): void {
    const does = src.perks.does;
    if (src.auras.some((a) => a.kind === 'revenant')) this.mend(src, n);
    if (does.returned) {
      const to = this.mostHurt(src);
      if (to) this.heal(src, to, n * does.returned.share, false);
    }
    const thirst = this.near(src, 'thirst', 'friend');
    if (thirst) this.mend(src, n * thirst.d.pct);
    if (does.soulward && this.ready(src, 'soulward')) {
      src.procs.soulward = this.clock + does.soulward.every;
      if (this.dampening < 1) this.stack(src, src, abOfDoing(src.cls, 'soulward').id, 'absorb', Math.round(src.maxHp * does.soulward.pct * (1 - this.dampening)), Math.round(src.maxHp * does.soulward.max), does.soulward.dur);
    }
    if (!direct) return;
    if (does.tides) src.tal.heal = true;
    if (does.wildfire && crit && !t.dead) {
      // (it burns as their own spells do: a third of the hit, before their share of damage is taken again)
      const total = (n * does.wildfire.share) / src.mods.dmg;
      this.addAura(t, { ab: abOfDoing(src.cls, 'wildfire').id, src: src.id, kind: 'dot', harmful: true, magic: true, dur: does.wildfire.dur, n: total / does.wildfire.dur, next: 1 });
    }
    if (does.verdict) {
      src.tal.verdict = (src.tal.verdict ?? 0) + 1;
      if (src.tal.verdict % does.verdict.every === 0) {
        const vab = abOfDoing(src.cls, 'verdict');
        this.events.push({ k: 'streak', id: src.id, to: t.id, ab: vab.id });
        this.damage(src, t, does.verdict.n, false, vab);
        const to = this.mostHurt(src);
        if (to) this.heal(src, to, does.verdict.n, false);
      }
    }
  }

  /** A blow or spell lands: what the striker's talents do to whoever it hit (a chill, a curse, a mark). Never a hold on one of the raised dead. */
  private onHit(src: Fighter, t: Fighter): void {
    const { does } = src.perks;
    if (t.dead) return;
    if (does.third) {
      // (counted from the first of the three: too slow and it starts over)
      const was = src.tal.third;
      const th = was && was.on === t.id && this.clock - was.at <= does.third.within ? was : { on: t.id, n: 0, at: this.clock };
      th.n++;
      src.tal.third = th;
      if (th.n >= does.third.n) {
        src.tal.third = undefined;
        if (!t.pet && this.ready(src, 'third') && this.crowd(src, abOfDoing(src.cls, 'third'), t, 'root', does.third.dur * src.mods.hold)) src.procs.third = this.clock + does.third.every;
      }
    }
    if (t.dead) return;
    if (does.sap) this.addAura(t, { ab: abOfDoing(src.cls, 'sap').id, src: src.id, kind: 'antiheal', harmful: true, magic: true, dur: does.sap.dur, n: does.sap.pct / 100 });
    if (does.enfeeble) this.addAura(t, { ab: abOfDoing(src.cls, 'enfeeble').id, src: src.id, kind: 'weak', harmful: true, magic: true, dur: does.enfeeble.dur, n: does.enfeeble.pct / 100 });
    if (does.quarry) {
      // one quarry at a time: the mark goes to whoever was hit last
      const id = abOfDoing(src.cls, 'quarry').id;
      for (const o of this.fighters) if (o !== t) o.auras = o.auras.filter((a) => !(a.kind === 'mark' && a.src === src.id));
      this.addAura(t, { ab: id, src: src.id, kind: 'mark', harmful: true, magic: false, dur: 30, n: does.quarry.pct });
    }
  }

  /** What the talents of whoever is hit answer a hit with: scar tissue, a halo of dread, a hide of brambles. */
  private struck(t: Fighter, src: Fighter, ab: Ability | undefined): void {
    const does = t.perks.does;
    if (does.scar) this.stack(t, t, abOfDoing(t.cls, 'scar').id, 'guard', does.scar.step, does.scar.max, does.scar.dur);
    if (src.team === t.team || src.dead) return;
    if (does.halo && this.ready(t, 'halo') && this.crowd(t, abOfDoing(t.cls, 'halo'), src, 'fear', does.halo.dur * t.mods.hold)) t.procs.halo = this.clock + does.halo.every;
    if (does.bramble && ab && ab.range <= ARM && !src.dead) {
      const bab = abOfDoing(t.cls, 'bramble');
      this.damage(t, src, does.bramble.n, false, bab);
      if (!src.dead) this.addAura(src, { ab: bab.id, src: t.id, kind: 'slow', harmful: true, magic: false, dur: does.bramble.dur * src.mods.tenacity, n: does.bramble.pct / 100 });
    }
  }

  /** A talent's aura that grows with each time (a scar, a soul's ward, an overflow of healing), up to its most, and starts its clock over. */
  private stack(t: Fighter, src: Fighter, id: string, kind: 'absorb' | 'guard', add: number, most: number, dur: number): void {
    const had = t.auras.find((a) => a.ab === id && a.kind === kind && a.src === src.id)?.n ?? 0;
    this.addAura(t, { ab: id, src: src.id, kind, harmful: false, magic: false, dur, n: Math.min(most, had + add) });
  }

  /** Can this talent's doing (or this kind of thing it does now and then) go off yet? */
  private ready(f: Fighter, k: string): boolean {
    return (f.procs[k] ?? 0) <= this.clock;
  }

  /** Something once a match: true the first time (and it's spent), false after. */
  private once(f: Fighter, k: string): boolean {
    if (f.tal.spent?.includes(k)) return false;
    f.tal.spent = [...(f.tal.spent ?? []), k];
    return true;
  }

  /** A hero near `f` (on its side, `f` among them, or the other side) whose talent does `k`: a paladin's aura, a Gloamknight's thirst, mantle or knell. */
  private near<K extends keyof Does>(f: Fighter, k: K, side: 'friend' | 'foe', r = NEAR): { by: Fighter; d: NonNullable<Does[K]> } | null {
    for (const o of this.fighters) {
      if (o.dead || o.pet || (side === 'friend') !== (o.team === f.team)) continue;
      const d = o.perks.does[k];
      if (d && Math.hypot(o.x - f.x, o.y - f.y) <= r) return { by: o, d: d as NonNullable<Does[K]> };
    }
    return null;
  }

  /** The friend (a hero, `f` among them) with the smallest share of their health left, who can be healed: `f` if nobody is lower. */
  private mostHurt(f: Fighter): Fighter | null {
    const me = this.masterOf(f);
    let best: Fighter | null = this.healable(me, f) ? me : null;
    for (const o of this.friendsOf(f)) {
      if (o.pet || !this.healable(o, f)) continue;
      if (!best || o.hp / o.maxHp < best.hp / best.maxHp) best = o;
    }
    return best;
  }

  /** Nobody heals a lingering spirit, nor a revenant but the revenant (`by` null: a sphere, the sigil). */
  private healable(t: Fighter, by: Fighter | null): boolean {
    return !t.dead && !t.auras.some((a) => a.kind === 'spirit' || (a.kind === 'revenant' && by !== t));
  }

  /** How much of what heals them reaches them, by talents: an open heart, an unholy bargain, a death knell tolling near. */
  private taken(t: Fighter): number {
    const does = t.perks.does;
    let k = (1 + (does.open?.pct ?? 0)) * (1 - (does.bargain?.pct ?? 0));
    const knell = t.hp < t.maxHp * EXECUTE ? this.near(t, 'knell', 'foe') : null;
    if (knell) k *= 1 - knell.d.pct;
    return k;
  }

  /** Healing from a talent: no critical, but what cuts healing cuts it, and it fades with the match as all healing does. */
  private mend(t: Fighter, amount: number, word?: string): void {
    if (t.dead || t.pet || t.auras.some((a) => a.kind === 'spirit')) return;
    let n = amount * (1 - this.dampening) * this.taken(t);
    for (const a of t.auras) if (a.kind === 'antiheal') n *= 1 - a.n;
    n = Math.round(Math.min(n, t.maxHp - t.hp));
    if (word) this.events.push({ k: 'word', id: t.id, word });
    if (n <= 0) return;
    t.hp += n;
    t.score.heal += n;
    this.events.push({ k: 'num', id: t.id, n, kind: 'heal', crit: false });
  }

  /** Life lost, and maybe the end of them. */
  private wound(t: Fighter, n: number, crit: boolean): void {
    // (nothing touches a lingering spirit)
    if (t.auras.some((a) => a.kind === 'spirit')) return;
    t.hp -= n;
    this.events.push({ k: 'num', id: t.id, n, kind: 'dmg', crit });
    if (t.hp > 0) {
      this.low(t);
      return;
    }
    if (t.pet) {
      t.pet.end = this.clock;
      this.die(t);
      this.ashburst(t);
      return;
    }
    const grace = t.auras.find((a) => a.kind === 'lastgrace');
    if (grace) {
      t.auras.splice(t.auras.indexOf(grace), 1);
      t.hp = Math.round(t.maxHp * grace.n);
      this.events.push({ k: 'word', id: t.id, word: 'Saved by grace' });
      return;
    }
    // once a match: a priest lingers on as a spirit, a Gloamknight rises a revenant
    const { spirit, revenant } = t.perks.does;
    if ((spirit || revenant) && this.once(t, spirit ? 'spirit' : 'revenant')) {
      const { id, name } = abOfDoing(t.cls, spirit ? 'spirit' : 'revenant');
      const dur = spirit?.dur ?? revenant!.dur;
      t.hp = 1;
      t.auras = t.auras.filter((a) => !a.harmful);
      this.addAura(t, { ab: id, src: t.id, kind: spirit ? 'spirit' : 'revenant', harmful: false, magic: false, dur, n: 0 });
      if (spirit) this.addAura(t, { ab: id, src: t.id, kind: 'immune', harmful: false, magic: false, dur, n: 0 });
      this.events.push({ k: 'word', id: t.id, word: name });
      return;
    }
    this.die(t);
  }

  private die(t: Fighter): void {
    t.hp = 0;
    t.dead = true;
    t.cast = null;
    t.auras = [];
    t.dash = null;
    this.events.push({ k: 'death', id: t.id });
  }

  /**
   * They've been hurt and live: what falling low brings, by talents. A second wind, an unbroken vow, time run back, a
   * vanishing, a hollow pact, an old oak.
   */
  private low(t: Fighter): void {
    const line = t.maxHp * RALLY;
    const rally = t.perks.rally;
    if (rally && t.hp < line && this.ready(t, 'rally')) {
      t.procs.rally = this.clock + rally.every;
      this.mend(t, t.maxHp * rally.pct, rally.name);
    }
    const does = t.perks.does;
    if (does.vow && t.hp < t.maxHp * does.vow.under && this.once(t, 'vow')) {
      const { id, name } = abOfDoing(t.cls, 'vow');
      this.addAura(t, { ab: id, src: t.id, kind: 'immune', harmful: false, magic: false, dur: does.vow.dur, n: 0 });
      this.events.push({ k: 'word', id: t.id, word: name });
    }
    if (t.hp < line) {
      if (does.rewind && this.ready(t, 'rewind')) {
        const back = (t.tal.hurt ?? []).filter((h) => h.at >= this.clock - does.rewind!.back).reduce((n, h) => n + h.n, 0);
        if (back > 0) {
          t.procs.rewind = this.clock + does.rewind.every;
          t.tal.hurt = [];
          this.mend(t, back * does.rewind.share, abOfDoing(t.cls, 'rewind').name);
        }
      }
      if (does.vanish && this.ready(t, 'vanish')) {
        t.procs.vanish = this.clock + does.vanish.every;
        this.vanish(t, does.vanish.dist);
      }
      if (does.pact && this.ready(t, 'pact')) {
        t.procs.pact = this.clock + does.pact.every;
        this.mend(t, Math.round(t.maxHp * does.pact.pct), abOfDoing(t.cls, 'pact').name);
      }
      if (does.oak && this.ready(t, 'oak')) {
        t.procs.oak = this.clock + does.oak.every;
        const { id, name } = abOfDoing(t.cls, 'oak');
        const base = { ab: id, src: t.id, harmful: false, magic: false, dur: does.oak.dur };
        this.addAura(t, { ...base, kind: 'oak', n: 0 });
        this.addAura(t, { ...base, kind: 'guard', n: does.oak.guard });
        this.addAura(t, { ...base, kind: 'hot', n: t.maxHp * does.oak.pct, next: 1 });
        t.dash = null;
        this.endCast(t);
        this.events.push({ k: 'word', id: t.id, word: name });
      }
    }
  }

  /** Gone from where they stood, to appear away from the nearest enemy, free of roots and slows (Vanishing Point). */
  private vanish(t: Fighter, dist: number): void {
    const foe = this.enemiesOf(t)
      .filter((o) => !o.pet)
      .sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
    const dx = foe ? t.x - foe.x : t.dirX;
    const dy = foe ? t.y - foe.y : t.dirY;
    const d = Math.hypot(dx, dy) || 1;
    t.auras = t.auras.filter((a) => a.kind !== 'slow' && a.cc !== 'root');
    t.dash = null;
    this.blinkTo(t, dx / d, dy / d, dist);
    this.events.push({ k: 'word', id: t.id, word: abOfDoing(t.cls, 'vanish').name });
  }

  private heal(src: Fighter, t: Fighter, amount: number, direct = true): void {
    if (!this.healable(t, src)) return;
    let n = amount * HEAL_K * src.mods.heal * this.healK * (1 - this.dampening) * this.taken(t);
    // (sun and moon: a heal after a hit is stronger, and makes the next hit so)
    const tides = src.perks.does.tides;
    if (tides && direct) {
      if (src.tal.heal) n *= 1 + tides.pct;
      src.tal.heal = false;
      src.tal.hit = true;
    }
    if (this.rand() < CRIT) n *= 1.5;
    for (const a of t.auras) if (a.kind === 'antiheal') n *= 1 - a.n;
    const room = t.maxHp - t.hp;
    // (brimming grace: what spills over stays on them as a shield)
    const flow = src.perks.does.overflow;
    if (flow && n > room) this.stack(t, src, abOfDoing(src.cls, 'overflow').id, 'absorb', Math.round(n - room), t.maxHp * flow.cap, flow.dur);
    n = Math.round(Math.min(n, room));
    if (n <= 0) return;
    t.hp += n;
    src.score.heal += n;
    src.charge = Math.min(1, src.charge + (n / SUPER_DEALT) * (t.pet ? THRALL.charge : 1) * src.mods.charge);
    this.events.push({ k: 'num', id: t.id, n, kind: 'heal', crit: false });
  }

  /* -------------------------------------------------------------- what talents do as time goes */

  /**
   * Each frame, for one fighter: what their talents do of themselves. Running free when a hold ends, healing out of
   * sight or with vigor, a ward forming, bone growing back, an imp spitting, a gust for whoever comes too close.
   */
  private tickTalents(f: Fighter, dt: number): void {
    const does = f.perks.does;
    const tal = f.tal;
    if (does.loose) {
      const held = f.auras.some((a) => !!a.cc && a.cc !== 'silence');
      if (tal.wasHeld && !held) {
        this.addAura(f, { ab: abOfDoing(f.cls, 'loose').id, src: f.id, kind: 'speed', harmful: false, magic: false, dur: does.loose.dur, n: does.loose.pct / 100 });
        this.events.push({ k: 'word', id: f.id, word: abOfDoing(f.cls, 'loose').name });
      }
      tal.wasHeld = held;
    }
    if (does.cover) {
      const seen = this.enemiesOf(f).some((o) => !o.pet && this.sees(o, f));
      tal.hidden = seen ? 0 : (tal.hidden ?? 0) + dt;
      if (tal.hidden >= does.cover.after) {
        tal.coverT = (tal.coverT ?? 0) + dt;
        if (tal.coverT >= 1) {
          tal.coverT -= 1;
          this.mend(f, f.maxHp * does.cover.pct);
        }
      } else tal.coverT = 0;
    }
    if (does.vigor) {
      tal.vigorT = (tal.vigorT ?? 0) + dt;
      if (tal.vigorT >= does.vigor.every) {
        tal.vigorT -= does.vigor.every;
        this.mend(f, f.maxHp * does.vigor.pct);
      }
    }
    if (does.ward) {
      tal.wardT = (tal.wardT ?? 0) - dt;
      if (tal.wardT <= 0) {
        tal.wardT += does.ward.every;
        if (this.dampening < 1) this.addAura(f, { ab: abOfDoing(f.cls, 'ward').id, src: f.id, kind: 'absorb', harmful: false, magic: false, dur: does.ward.every, n: Math.round(f.maxHp * does.ward.pct * (1 - this.dampening)) });
      }
    }
    if (does.bones && (tal.bones ?? 0) < does.bones.n) {
      tal.boneT = (tal.boneT ?? 0) + dt;
      if (tal.boneT >= does.bones.every) {
        tal.boneT = 0;
        tal.bones = (tal.bones ?? 0) + 1;
      }
    }
    if (does.imp) {
      tal.impT = (tal.impT ?? 0) - dt;
      if (tal.impT <= 0 && !this.held(f)) {
        const foe = this.foeOf(f, does.imp.range);
        if (foe) {
          tal.impT = does.imp.every;
          const ab = { ...abOfDoing(f.cls, 'imp'), range: does.imp.range };
          this.events.push({ k: 'streak', id: f.id, to: foe.id, ab: ab.id });
          // (a spit, not a blow: it doesn't knock a cast back, and is never a critical)
          this.damage(f, foe, does.imp.n, false, ab);
        } else tal.impT = 0.25;
      }
    }
    if (does.gale && this.ready(f, 'gale')) {
      const foe = this.enemiesOf(f).find((o) => !o.pet && !this.unseen(o, f) && Math.hypot(o.x - f.x, o.y - f.y) <= ARM && !o.auras.some((a) => a.kind === 'immune'));
      if (foe) {
        f.procs.gale = this.clock + does.gale.every;
        const dx = foe.x - f.x;
        const dy = foe.y - f.y;
        const d = Math.hypot(dx, dy) || 1;
        foe.dash = { x: foe.x + (dx / d) * does.gale.dist, y: foe.y + (dy / d) * does.gale.dist, speed: 380 };
        if (foe.cast) this.endCast(foe);
        this.events.push({ k: 'word', id: f.id, word: abOfDoing(f.cls, 'gale').name });
        this.events.push({ k: 'word', id: foe.id, word: 'Knocked back', bad: true });
      }
    }
  }

  /** Whom something of theirs that needs no aiming goes for (an imp): the enemy they've chosen if in reach and sight, else the nearest hero who is. */
  private foeOf(f: Fighter, range: number): Fighter | null {
    const ok = (o: Fighter): boolean => !o.dead && o.team !== f.team && !this.unseen(o, f) && Math.hypot(o.x - f.x, o.y - f.y) <= range + HERO_R && this.sees(f, o) && !o.auras.some((a) => a.kind === 'immune');
    const want = f.target === null ? null : this.fighters[f.target];
    if (want && ok(want)) return want;
    return (
      this.enemiesOf(f)
        .filter((o) => !o.pet && ok(o))
        .sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0] ?? null
    );
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
        // (with the shroud on their bar, they come through the gates in it)
        for (const f of this.fighters) if (!f.pet && f.bar.some((id) => ABILITIES[id]?.effects.some((e) => e.k === 'veil'))) this.veil(f, null);
      }
      return;
    }
    if (!this.hold) this.clock += dt;
    // (the raised dead think for themselves: nobody's moves are theirs. Any raised in this frame take their first step in it)
    for (const f of this.fighters) {
      if (f.dead) continue;
      if (f.pet) this.tickPet(f, dt);
      else this.tickFighter(f, dt, moves[f.id]);
    }
    this.moveBolts(dt);
    this.fallZones(dt);
    this.tendFields(dt);
    this.tripTraps(dt);
    this.tendSigil();
    this.tendOrbs();
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
    const by = this.fighters.find((f) => !f.dead && !f.pet && Math.hypot(f.x - s.x, f.y - s.y) < HERO_R + 8);
    if (!by) return;
    this.sigil = null;
    this.sigilAt = this.clock + SIGIL_EVERY;
    // (a forager takes more of it, and is quickened again by their own talent)
    const forage = by.perks.does.forage;
    // (its healing fades as all healing does: its might and its speed don't)
    const n = this.healable(by, null) ? Math.round(Math.min(by.maxHp * 0.2 * (1 + (forage?.more ?? 0)) * (1 - this.dampening) * this.taken(by), by.maxHp - by.hp)) : 0;
    if (n > 0) {
      by.hp += n;
      this.events.push({ k: 'num', id: by.id, n, kind: 'heal', crit: false });
    }
    by.charge = Math.min(1, by.charge + 0.34);
    this.addAura(by, { ab: SIGIL.id, src: by.id, dur: 4, magic: false, n: 0.3, kind: 'speed', harmful: false });
    if (forage) this.addAura(by, { ab: abOfDoing(by.cls, 'forage').id, src: by.id, dur: forage.dur, magic: false, n: forage.pct / 100, kind: 'speed', harmful: false });
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
    this.tickAuras(f, dt);
    if (f.dead) return;
    // (a boon not used runs out)
    if (f.boons.length) {
      for (const b of f.boons) b.t -= dt;
      if (f.boons.some((b) => b.t <= 0)) f.boons = f.boons.filter((b) => b.t > 0);
    }
    this.tickTalents(f, dt);
    if (f.dead) return;
    if (f.dive) {
      this.comeDown(f, dt);
      return;
    }
    // (one who carries the shroud slips back into it by themself once out of the fight a while: the owner, "it should
    // put u to stealth auto if u are not damaged for 5s")
    if (!this.hidden(f) && !f.cast && !this.held(f) && this.calm(f) && f.bar.some((id) => ABILITIES[id]?.effects.some((e) => e.k === 'veil'))) {
      this.veil(f, null);
      this.events.push({ k: 'ab', id: f.id, ab: f.bar.find((id) => ABILITIES[id]?.effects.some((e) => e.k === 'veil'))! });
    }
    this.moveFighter(f, dt, m);
    this.tickCast(f, dt);
    if (f.queued) {
      f.queued.t -= dt;
      const ab = ABILITIES[f.queued.ab];
      if (f.queued.t <= 0 || !ab) f.queued = null;
      else if (f.gcd <= 0 && !this.blocked(f, ab, undefined, f.queued.at)) this.begin(f, ab, f.queued.at);
    }
  }

  /**
   * Up in the dark, and then down on whoever it was aimed at (Ability.dive): beside them wherever they have gone, with
   * everything the ability does. If they fell meanwhile, or went where nobody can aim, down where its user went up.
   */
  private comeDown(f: Fighter, dt: number): void {
    const d = f.dive!;
    d.t -= dt;
    if (d.t > 0) return;
    f.dive = null;
    f.auras = f.auras.filter((a) => a.kind !== 'aloft');
    const ab = ABILITIES[d.ab]!;
    const t = this.fighters[d.target];
    this.events.push({ k: 'ab', id: f.id, ab: ab.id });
    if (!t || t.dead || this.unseen(t, f)) return;
    // (to their side first, so that it lands from where its user stands; what it does may put them at their back)
    const dx = f.x - t.x;
    const dy = f.y - t.y;
    const len = Math.hypot(dx, dy) || 1;
    const x = t.x + (dx / len) * (HERO_R * 2 + 2);
    const y = t.y + (dy / len) * (HERO_R * 2 + 2);
    if (!this.hits(x, y)) {
      f.x = x;
      f.y = y;
    } else {
      f.x = t.x;
      f.y = t.y;
    }
    this.events.push({ k: 'zone', x: t.x, y: t.y, r: 26, ab: ab.id });
    this.land(f, ab, t, false, 1, d.p);
  }

  private tickAuras(f: Fighter, dt: number): void {
    for (const a of f.auras) {
      a.t -= dt;
      if (a.next !== undefined) {
        a.next -= dt;
        if (a.next <= 0) {
          a.next += 1;
          const src = this.fighters[a.src]!;
          // (a talent's: an old oak mends as a talent mends, a wildfire burns as the mage's own spells do)
          const talent = !ABILITIES[a.ab] && !!TALENT_BY_ID[a.ab];
          if (a.kind === 'dot') {
            this.damage(src, f, a.n, false, talent ? talentAb(a.ab) : ABILITIES[a.ab]);
            // (each burn is a tick of the ability that lit it, to whatever of its user's waits on one)
            if (!talent) this.ticked(src, ABILITIES[a.ab]);
          } else if (a.kind === 'hot' && talent) this.mend(f, a.n);
          else if (a.kind === 'hot') this.heal(src, f, a.n, false);
          if (f.dead) return;
        }
      }
    }
    // a lingering spirit's time is up; a revenant's too, and only one who has drunk enough stays
    const ending = f.auras.filter((a) => a.t <= 0 && (a.kind === 'spirit' || a.kind === 'revenant'));
    f.auras = f.auras.filter((a) => a.t > 0);
    for (const a of ending) {
      if (a.kind === 'spirit' || f.hp < f.maxHp * (f.perks.does.revenant?.live ?? 0)) {
        this.die(f);
        return;
      }
      this.events.push({ k: 'word', id: f.id, word: 'Lives on' });
    }
  }

  private speedOf(f: Fighter): number {
    let k = f.mods.speed;
    // (casting slows, but for a spell a talent lets its user cast on the move)
    if (f.cast && !this.tuneOf(f, ABILITIES[f.cast.ab])?.swift) k *= CAST_SLOW;
    // (a Gloamknight's dusk mantle drags at whoever is close to him)
    const mantle = this.near(f, 'mantle', 'foe', ARM);
    if (mantle) k *= 1 - mantle.d.pct;
    for (const a of f.auras) if (a.kind === 'speed') k *= 1 + a.n;
    // (the shroud is a careful step, unless the night holds them)
    if (!f.perks.does.shade) for (const a of f.auras) if (a.kind === 'veil') k *= 1 - a.n;
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
    // (placed by hand, it needs nobody: the ground is still there)
    const placed = ab.aim === 'ground' && !!c.at;
    if (!t || (t.dead && !placed)) {
      this.endCast(f);
      return;
    }
    const gone = !placed && t !== f && (Math.hypot(t.x - f.x, t.y - f.y) > ab.range + HERO_R + 14 || !this.sees(f, t) || this.unseen(t, f));
    if (c.channel) {
      if (gone) {
        this.endCast(f);
        this.events.push({ k: 'word', id: f.id, word: 'Lost sight', bad: true });
        return;
      }
      c.next -= dt;
      if (c.next <= 0) {
        c.next += ab.tick ?? 1;
        this.land(f, ab, t, false, 1, c.p);
        this.ticked(f, ab);
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
      this.fire(f, ab, t, c.at);
    }
  }

  /** Shots follow whoever they were thrown at, and land on them. Only a target who has fallen is spared. */
  private moveBolts(dt: number): void {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]!;
      const src = this.fighters[b.src]!;
      const t = this.fighters[b.tgt];
      if (!t || t.dead || this.unseen(t, src)) {
        this.bolts.splice(i, 1);
        this.events.push({ k: 'miss', x: b.x, y: b.y, ab: b.ab });
        continue;
      }
      b.age += dt;
      const speed = BOLT_SPEED + BOLT_QUICKEN * b.age;
      const dx = t.x - b.x;
      const dy = t.y - 8 - b.y;
      const d = Math.hypot(dx, dy);
      if (d <= speed * dt + HERO_R) {
        this.bolts.splice(i, 1);
        this.land(src, ABILITIES[b.ab]!, t, false, 1, b.p);
        continue;
      }
      b.vx = (dx / d) * speed;
      b.vy = (dy / d) * speed;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
  }

  /** What was placed comes down: on everyone of the other side still standing on its patch. */
  private fallZones(dt: number): void {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i]!;
      z.t -= dt;
      if (z.t > 0) continue;
      this.zones.splice(i, 1);
      const src = this.fighters[z.src]!;
      const ab = ABILITIES[z.ab]!;
      this.events.push({ k: 'zone', x: z.x, y: z.y, r: z.r, ab: z.ab });
      if (ab.field) {
        // (what stays on the ground: it lands for the first time at once, and then every so often as it drifts)
        const dur = ab.field.dur * (this.tuneOf(src, ab)?.linger ?? 1);
        const drift = ab.field.drift ?? 0;
        this.fields.push({ ab: ab.id, src: z.src, team: z.team, x: z.x, y: z.y, r: z.r, t: dur, dur, next: 0, vx: (z.ux ?? 0) * drift, vy: (z.uy ?? 0) * drift, k: z.p?.k ?? 1 });
        continue;
      }
      for (const o of this.fighters) {
        if (o.dead || o.team === z.team || Math.hypot(o.x - z.x, o.y - z.y) > z.r) continue;
        this.land(src, ab, o, true, 1, z.p);
        // (a riftcaller's maw drags all it opens under into its middle)
        if (this.tuneOf(src, ab)?.pull && !o.dead && !this.immuneTo(o, ab)) this.drag(o, z.x, z.y, 0);
      }
    }
  }

  /**
   * What was left on the ground (Ability.field) drifts on, and every so often lands on everyone of the other side
   * standing in it: each landing a tick of its ability. It stops at the walls, and is gone when its time is up or its
   * user has fallen.
   */
  private tendFields(dt: number): void {
    for (let i = this.fields.length - 1; i >= 0; i--) {
      const fd = this.fields[i]!;
      const src = this.fighters[fd.src];
      const ab = ABILITIES[fd.ab];
      fd.t -= dt;
      if (fd.t <= 0 || !src || src.dead || !ab?.field) {
        this.fields.splice(i, 1);
        continue;
      }
      fd.x = Math.max(fd.r * 0.5, Math.min(ARENA_W - fd.r * 0.5, fd.x + fd.vx * dt));
      fd.y = Math.max(fd.r * 0.5, Math.min(ARENA_H - fd.r * 0.5, fd.y + fd.vy * dt));
      fd.next -= dt;
      if (fd.next > 0) continue;
      fd.next += ab.field.tick;
      for (const o of this.fighters) {
        if (o.dead || o.team === fd.team || this.unseen(o, src) || Math.hypot(o.x - fd.x, o.y - fd.y) > fd.r + HERO_R) continue;
        // (each landing its own: nothing a use does once is done again, and nothing is called out over them each second)
        this.land(src, ab, o, true, 1, { k: fd.k, landed: true });
        this.ticked(src, ab);
      }
    }
  }

  /** The healing spheres: whoever is hurt and walks into one takes it, and it rises again later. */
  private tendOrbs(): void {
    // (they fade as all healing does, and with none left there is nothing in them to take)
    if (this.dampening >= 1) return;
    for (const o of this.orbs) {
      if (this.clock < o.at) continue;
      const by = this.fighters.find((f) => !f.pet && this.healable(f, null) && f.hp < f.maxHp && Math.hypot(f.x - o.x, f.y - o.y) < HERO_R + 9);
      if (!by) continue;
      o.at = this.clock + ORB_EVERY;
      const forage = by.perks.does.forage;
      const n = Math.round(Math.min(by.maxHp * ORB_HEAL * (1 + (forage?.more ?? 0)) * (1 - this.dampening) * this.taken(by), by.maxHp - by.hp));
      by.hp += n;
      this.events.push({ k: 'num', id: by.id, n, kind: 'heal', crit: false });
      this.events.push({ k: 'orb', id: by.id, x: o.x, y: o.y });
      if (forage) this.addAura(by, { ab: abOfDoing(by.cls, 'forage').id, src: by.id, dur: forage.dur, magic: false, n: forage.pct / 100, kind: 'speed', harmful: false });
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
        // (a trap is for a hero: the raised dead walk over it)
        if (f.dead || f.pet || f.team === tr.team || Math.hypot(f.x - tr.x, f.y - tr.y) > 15 || f.auras.some((a) => a.kind === 'immune')) continue;
        this.traps.splice(i, 1);
        this.events.push({ k: 'land', id: f.id, ab: tr.ab });
        const src = this.fighters[tr.src]!;
        // (a trap that catches someone has landed, for whatever of its user's waits on that)
        if (this.crowd(src, ABILITIES[tr.ab]!, f, tr.cc, tr.dur) && !src.dead) this.give(src, ABILITIES[tr.ab]!, 'land');
        break;
      }
    }
  }

  private judge(): void {
    const alive: [number, number] = [0, 0];
    const life: [number, number] = [0, 0];
    // (the match is between the heroes: the raised dead keep no side standing)
    for (const f of this.heroes) {
      if (!f.dead) alive[f.team]++;
      life[f.team] += f.hp / f.maxHp;
    }
    if (alive[0] === 0 || alive[1] === 0) {
      this.phase = 'over';
      if (alive[0] === alive[1]) this.draw = true;
      else this.winner = alive[0] > 0 ? 0 : 1;
    } else if (this.clock >= MATCH_LIMIT) {
      this.phase = 'over';
      // the time ran out: whoever has more life left in them takes it
      if (Math.abs(life[0] - life[1]) < 0.001) this.draw = true;
      else this.winner = life[0] > life[1] ? 0 : 1;
    }
    // over: the dead go back into the ground, and what is left to read (the results, the scores) is the heroes'
    if (this.phase === 'over') this.fighters = this.heroes;
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
        d: f.dead,
        tg: f.target,
        fr: f.friend,
        g: Math.round(f.gcd * 100) / 100,
        cd: f.cds,
        c: f.cast,
        a: f.auras,
        l: f.locks,
        r: f.dr,
        sc: f.score,
        ch: Math.round(f.charge * 1000) / 1000,
        ...(f.pts ? { ps: f.pts } : {}),
        ...(f.boons.length ? { bn: f.boons.map((b) => ({ id: b.id, n: b.n, t: Math.round(b.t * 100) / 100 })) } : {}),
        ...(f.pet ? { pt: { o: f.pet.owner, a: f.pet.ab, l: Math.round(f.pet.life * 100) / 100, m: f.pet.max, dm: f.pet.dmg, s: f.pet.slow, n: Math.round(f.pet.next * 100) / 100, h: f.pet.hits, ...(f.pet.end !== undefined ? { e: f.pet.end } : {}) } } : {}),
      })),
      b: this.bolts,
      tr: this.traps,
      z: this.zones,
      ...(this.fields.length ? { fl: this.fields } : {}),
      o: this.orbs.map((o) => Math.round(o.at * 10) / 10),
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
    this.zones = s.z ?? [];
    this.fields = s.fl ?? [];
    s.o?.forEach((at, i) => {
      if (this.orbs[i]) this.orbs[i]!.at = at;
    });
    this.sigil = s.sg ?? null;
    this.sigilAt = s.sa ?? this.sigilAt;
    // the raised dead come and go with the host's word: raised here as they are there, and gone when they are
    // (always after the heroes, so no hero's place moves)
    while (this.fighters.length > s.f.length && this.fighters[this.fighters.length - 1]!.pet) this.fighters.pop();
    s.f.forEach((n, i) => {
      const pt = n.pt;
      if (!this.fighters[i] && pt && i === this.fighters.length && this.fighters[pt.o]) this.fighters.push(this.makePet(this.fighters[pt.o]!, n.x, n.y, { ab: pt.a, hp: n.mh, dmg: pt.dm, slow: pt.s, life: pt.l, max: pt.m, next: pt.n, hits: pt.h }));
      const f = this.fighters[i];
      if (!f) return;
      if (f.pet && pt) Object.assign(f.pet, { life: pt.l, next: pt.n, hits: pt.h, end: pt.e });
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
      f.dead = n.d;
      f.target = n.tg;
      f.friend = n.fr;
      f.gcd = n.g;
      f.cds = n.cd;
      f.cast = n.c;
      f.auras = n.a;
      f.locks = n.l;
      if (n.r) f.dr = n.r;
      f.score = n.sc;
      f.charge = n.ch ?? 0;
      f.pts = n.ps ?? 0;
      f.boons = n.bn ?? [];
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
      for (const b of f.boons) b.t = Math.max(0, b.t - dt);
      if (f.pet) f.pet.life = Math.max(0, f.pet.life - dt);
    }
    // shots fly on, and what was placed keeps falling
    for (const b of this.bolts) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    for (const z of this.zones) z.t = Math.max(0, z.t - dt);
    for (const fd of this.fields) {
      fd.x += fd.vx * dt;
      fd.y += fd.vy * dt;
      fd.t = Math.max(0, fd.t - dt);
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
    /** (mana, sent by a host from before there was none: unread) */
    m?: number;
    d: boolean;
    tg: number | null;
    fr: number | null;
    g: number;
    cd: Record<string, number>;
    c: Cast | null;
    a: Aura[];
    l: Partial<Record<string, number>>;
    /** Diminishing returns (a host from before they were sent says nothing, and they stay as the player's copy has them). */
    r?: Fighter['dr'];
    sc: Fighter['score'];
    ch?: number;
    /** The points they hold, and the boons they carry (a host from before either says nothing: none). */
    ps?: number;
    bn?: BoonOn[];
    /** Momentum's chain, from a host from before it went: left unread. */
    st?: number;
    stt?: number;
    /** One of the raised dead: whose (`o`), raised by what, life left and in all, its blow and slow, time to the next, blows struck, and when it fell. */
    pt?: { o: number; a: string; l: number; m: number; dm: number; s: number; n: number; h: number; e?: number };
  }[];
  b: Bolt[];
  tr: Trap[];
  z?: Zone[];
  /** What is left on the ground (Field). */
  fl?: Field[];
  /** When each healing sphere next rises, in the map's order. */
  o?: number[];
  sg?: SigilStone | null;
  sa?: number;
}
