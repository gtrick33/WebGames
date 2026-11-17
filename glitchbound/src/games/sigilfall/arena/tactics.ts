import { ABILITIES, type Ability, type CcKind } from './abilities';
import type { Brain } from './bot';
import { RANGED, type Fighter, type Match } from './sim';

/**
 * What separates a computer player at the top of The Ring's ladder from one at the bottom, beyond quick hands
 * (arena/bot.ts). The owner, 2026-11-14: "they should be bad when you first start and get progressively harder and
 * harder, they should feel like real players". So, by `skill` from 0 to 1:
 *
 * - near 0 it plays like someone in their first matches: it stands about now and then (`lapse`, about one look in four,
 *   fewer and fewer up the ladder, none from the middle of it) and wastes a cooldown at the wrong moment (`fumble`);
 * - from the middle of the ladder the habits of a practised player come in, each a little more often the sharper it is,
 *   and all but always at the top: the super kept for a moment that counts (`holdSuper`, from 0.35), interrupts kept for
 *   what is worth one and thrown late in the cast (`lateKick`), a swap onto a healer in trouble and off whoever is
 *   behind a wall of defensives (`focusBias`, `armored`), defensives kept for real danger and used even while stunned
 *   (`guard`, `brace`), holds on the healer timed with the kill and chained one after another as each wears off
 *   (`chainHealer`), and holds on whoever is on a friend in trouble (`peel`);
 * - and all the way up, the next button is pressed sooner after the global cooldown comes up (`nextLook`).
 *
 * Each was measured, the computer against itself with one habit taken from one side: what made it lose more was
 * changed or left out (all on one target, and a caster kiting a blade round the stone in place of plain running, both
 * cost more than they won). The computer's ready-made bars carry few interrupts and defensives, so with them it is the
 * hands, the super, the holds and the slips that tell the ladder's rungs apart (tests/sigilfall-ring-ladder.test.ts
 * has what was measured). In a duel from 0.6 up, where the classes' balance is measured, next to nothing here but the
 * hands changes what happens: the slips are over, the super isn't held, and a habit with nothing to do (no healer to
 * hold, no defensive on the bar) is never even weighed.
 *
 * Nothing here is frame perfect: a sharp player still takes a quarter of a second to see a cast, and picks its moment
 * a little differently each time.
 */

/** 0 below `from`, 1 above `to`, and a straight line between. */
export const ramp = (skill: number, from: number, to: number): number => Math.max(0, Math.min(1, (skill - from) / (to - from)));

/** Where the habits of a practised player begin to show. */
export const SHARP_FROM = 0.45;

/** Whether a practised player's habit is in its head this time (more often the sharper it is; always near the top). */
export const knows = (b: Brain, skill: number, from = SHARP_FROM, to = 0.95): boolean => {
  const p = ramp(skill, from, to);
  return p >= 1 || (p > 0 && b.rand() < p);
};

interface Mind {
  /**
   * The cast each enemy is in (by their id): whether it will be kicked, how little of it must be left when it is, how
   * long it has been seen, and how far along it was last seen (less than that: a new one).
   */
  casts: Map<number, { ab: string; will: boolean; at: number; seen: number; t: number }>;
  /** When the super was found full. */
  full: number | null;
}

const minds = new WeakMap<Brain, Mind>();
const mindOf = (b: Brain): Mind => {
  let m = minds.get(b);
  if (!m) {
    m = { casts: new Map(), full: null };
    minds.set(b, m);
  }
  return m;
};

/** A fighter's bar as abilities, and the interrupts on it (kept per bar: the interrupts are asked every frame). */
const bars = new WeakMap<string[], { all: Ability[]; kicks: Ability[] }>();
const barOf = (f: Fighter): { all: Ability[]; kicks: Ability[] } => {
  let got = bars.get(f.bar);
  if (!got) {
    const all = f.bar.map((x) => ABILITIES[x]!).filter(Boolean);
    got = { all, kicks: all.filter((a) => a.role === 'interrupt') };
    bars.set(f.bar, got);
  }
  return got;
};
const bar = (f: Fighter): Ability[] => barOf(f).all;
const hp = (f: Fighter): number => f.hp / f.maxHp;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
const healerLike = (f: Fighter): boolean => ABILITIES[f.bar[0] ?? '']?.role === 'heal' && ABILITIES[f.bar[0] ?? '']?.aim === 'friend';
const ccOf = (a: Ability): CcKind | null => {
  const e = a.effects.find((x) => x.k === 'cc');
  return e && e.k === 'cc' ? e.cc : null;
};
const holdLeft = (o: Fighter): number => Math.max(0, ...o.auras.filter((a) => a.cc && a.cc !== 'root' && a.cc !== 'silence').map((a) => a.t));

/** Under something that makes a burst wasted: immune, or behind a big guard or ward. */
export const armored = (t: Fighter): boolean => t.auras.some((a) => (a.kind === 'immune' && !a.phys) || (a.kind === 'guard' && a.n >= 0.4) || (a.kind === 'absorb' && a.n >= 120));

/* ------------------------------------------------------------------ hands */

/**
 * When to look at the bar again: as the global cooldown (or the cast in hand) comes up, after a reaction of one's own,
 * if that is sooner than the next look would have been. A person presses the next button when it lights up, quicker
 * the more practised they are (about a third of a second for a newcomer, a fifteenth at the top). Before, a look came
 * on a beat of its own, and a beat that happened to fall just after the global cooldown left a duller player's hands
 * busier than a sharper one's: the ladder's middle rungs beat each other about half the time.
 */
export function nextLook(f: Fighter, wait: number, skill: number): number {
  const up = Math.max(f.gcd, f.cast && !f.cast.channel ? f.cast.dur - f.cast.t : 0);
  return up > 0 ? Math.min(wait, up + 0.06 + (1 - skill) * 0.28) : wait;
}

/* ------------------------------------------------------------------ the new player */

/** Where a newcomer's slips are gone: the practised player makes none. */
export const SLIPS_TO = 0.6;

/**
 * A moment of standing about, looking at the bar: abilities aren't pressed this time round (the feet still go). About
 * one look in four for a newcomer, fewer and fewer up the ladder, and none from SLIPS_TO (a slip costs a fighter who
 * has to close in more than one who shoots from afar, so a sharp player's match is left as it was balanced).
 */
export function lapse(b: Brain, skill: number): boolean {
  return skill < SLIPS_TO && b.rand() < 0.3 * (1 - skill / SLIPS_TO) ** 1.3;
}

/** A newcomer's mistake: a cooldown pressed for nothing (a defensive at full health, a hold on whoever is nearest). */
export function fumble(m: Match, f: Fighter, b: Brain, skill: number): void {
  if (skill >= SLIPS_TO || b.rand() > 0.07 * (1 - skill / SLIPS_TO) ** 2) return;
  const spare = bar(f).filter((a) => a.role === 'defense' || a.role === 'cc' || a.role === 'mobility' || a.role === 'burst');
  const ab = spare[Math.floor(b.rand() * spare.length)];
  if (!ab || m.blocked(f, ab)) return;
  if (ab.aim === 'friend') f.friend = f.id;
  m.press(f.id, ab.id);
}

/* ------------------------------------------------------------------ interrupts */

/** What cutting a cast off is worth: a heal most, then a hold, a big hit, a long drain; a filler least. */
function castWorth(m: Match, e: Fighter): number {
  const c = e.cast!;
  const ab = ABILITIES[c.ab];
  if (!ab) return 0;
  if (ab.role === 'heal' && ab.aim === 'friend') {
    const on = m.fighters[c.target];
    return on && hp(on) < 0.6 ? 4 : 3;
  }
  if (ab.role === 'cc') return 2.5;
  if (ab.role === 'burst' || c.channel) return 2;
  return c.dur >= 1 ? 1.5 : 1;
}

/**
 * A sharp player's interrupt, watched for every moment like a cast bar is: it sees a cast after a reaction of its own
 * (a quarter of a second at the top), keeps the kick for what is worth it (a heal, a hold or a long cast, while the
 * other side has a healer to kick), and throws it late in the cast, when the caster can no longer stop and do
 * something else; how late differs a little from cast to cast. True if it kicked.
 */
export function lateKick(m: Match, f: Fighter, b: Brain, skill: number, dt: number): boolean {
  const kicks = barOf(f).kicks;
  if (!kicks.length) return false;
  const enemies = m.enemiesOf(f).filter((o) => !o.pet && !m.unseen(o, f));
  const mind = mindOf(b);
  const react = 0.22 + (1 - skill) * 0.5;
  const healerFree = enemies.some((e) => healerLike(e) && !e.dead && holdLeft(e) < 1);
  for (const e of enemies) {
    const c = e.cast;
    if (!c) {
      mind.casts.delete(e.id);
      continue;
    }
    let plan = mind.casts.get(e.id);
    if (!plan || plan.ab !== c.ab || c.t < plan.t) {
      const worth = castWorth(m, e);
      const wanted = worth >= 1.5 || !healerFree || (f.target === e.id && hp(e) < 0.4);
      plan = { ab: c.ab, will: wanted && b.rand() < 0.35 + 0.62 * ramp(skill, SHARP_FROM, 1), at: 0.1 + b.rand() * 0.18 + (1 - skill) * 0.25, seen: 0, t: c.t };
      mind.casts.set(e.id, plan);
    }
    plan.t = c.t;
    plan.seen += dt;
    if (!plan.will || plan.seen < react) continue;
    // (a channel is cut whenever it's seen; a cast late, but never so late that it lands first)
    if (!c.channel && c.dur - c.t > plan.at) continue;
    for (const ab of kicks) {
      if (m.blocked(f, ab, e)) continue;
      const before = f.target;
      f.target = e.id;
      const why = m.press(f.id, ab.id);
      f.target = before;
      if (!why) {
        plan.will = false;
        return true;
      }
    }
  }
  return false;
}

/* ------------------------------------------------------------------ who to kill */

/**
 * What a sharp player adds to the choice of whom to hit (lower is sooner): the healer when they're in
 * trouble, someone held by their own side, and not whoever is behind a wall of defensives.
 */
export function focusBias(skill: number): ((o: Fighter) => number) | undefined {
  const k = ramp(skill, SHARP_FROM, 1);
  if (k <= 0) return undefined;
  return (o) => {
    if (o.pet) return 0;
    let s = 0;
    if (healerLike(o) && hp(o) < 0.55) s -= 30 * k;
    if (o.auras.some((a) => a.cc === 'stun' && a.harmful)) s -= 12 * k;
    if (armored(o)) s += 40 * k;
    return s;
  };
}

/* ------------------------------------------------------------------ staying alive */

/** How much trouble they are in: hurt, with several on them, no healer free to help, held. 0 calm, 1 and up dire. */
function danger(m: Match, f: Fighter, enemies: Fighter[]): number {
  const on = enemies.filter((e) => e.target === f.id && !m.held(e) && (dist(e, f) < 60 || (RANGED.has(e.cls) && m.sees(e, f)))).length;
  if (!on) return 0;
  const friends = m.friendsOf(f).filter((a) => a !== f && !a.pet && !a.dead);
  const help = friends.some((a) => healerLike(a) && !m.held(a) && m.sees(a, f));
  return 1 - hp(f) + (on - 1) * 0.15 + (help ? 0 : 0.1) + (m.held(f) ? 0.12 : 0);
}

const covered = (f: Fighter): boolean => f.auras.some((a) => a.kind === 'immune' || (a.kind === 'guard' && a.n >= 0.3) || (a.kind === 'absorb' && a.n > 60));

/**
 * A sharp player's defensives: never two at once, the small ones when it's getting warm, the big ones only when it's
 * dire, and a friend's when they are the one about to fall. Used in place of the plain rule (arena/bot.ts `defend`).
 */
export function guard(m: Match, f: Fighter, b: Brain, skill: number, enemies: Fighter[]): void {
  const d = danger(m, f, enemies);
  for (const ab of bar(f)) {
    if (ab.role !== 'defense') continue;
    if (ab.aim === 'friend') {
      const ally = m.friendsOf(f).find((a) => !a.pet && !a.dead && !covered(a) && danger(m, a, enemies) > (ab.cd > 30 ? 0.75 : 0.45));
      if (ally && !m.blocked(f, ab, ally)) {
        f.friend = ally.id;
        if (!m.press(f.id, ab.id)) return;
      }
      continue;
    }
    if (ab.effects.some((e) => e.k === 'reflect')) {
      const casting = enemies.find((e) => e.cast && e.cast.target === f.id && !e.cast.channel && e.cast.dur - e.cast.t < 0.5 && ABILITIES[e.cast.ab]?.role !== 'heal');
      if (casting && !m.blocked(f, ab)) m.press(f.id, ab.id);
      continue;
    }
    if (covered(f)) continue;
    // (a shield that seals its user in ice is the last resort: it also stops them doing anything. Not quite the same
    // line every time: the less sharp, the more it wavers)
    const still = ab.effects.some((e) => e.k === 'immune' && e.still);
    const line = still ? 0.85 : ab.cd > 30 ? 0.62 : 0.4;
    if (d >= line + (b.rand() - 0.5) * (0.04 + (1 - skill) * 0.2) && !m.blocked(f, ab)) {
      if (!m.press(f.id, ab.id)) return;
    }
  }
}

/** Stunned with a kill being tried on them: what can be used while held (arena/abilities.ts `anyState`). */
export function brace(m: Match, f: Fighter, b: Brain, skill: number, enemies: Fighter[]): void {
  const ab = bar(f).find((a) => a.anyState && a.role === 'defense' && a.aim === 'self' && !m.blocked(f, a));
  if (!ab || covered(f) || danger(m, f, enemies) < 0.6 || !knows(b, skill, 0.55)) return;
  m.press(f.id, ab.id);
}

/* ------------------------------------------------------------------ holds */

/** A hold of theirs of one of these kinds that could land on `on` now. */
function holdFor(m: Match, f: Fighter, on: Fighter, kinds: CcKind[]): Ability | null {
  for (const ab of bar(f)) {
    if (ab.role !== 'cc' || ab.aim === 'self' || ab.aim === 'ground') continue;
    const kind = ccOf(ab);
    if (!kind || !kinds.includes(kind)) continue;
    if (ab.aim === 'near' ? dist(on, f) > ab.range : m.blocked(f, ab, on)) continue;
    if (ab.aim === 'near' && m.blocked(f, ab)) continue;
    return ab;
  }
  return null;
}

function holdOn(m: Match, f: Fighter, on: Fighter, ab: Ability): boolean {
  const before = f.target;
  f.target = on.id;
  const why = m.press(f.id, ab.id);
  f.target = before;
  return !why;
}

/**
 * The healer held while the kill is on: when the target is low, or held and hurt, the other side's healer gets a hold,
 * and as one wears off the next goes on, never into immunity, never on top of a hold still running, and nothing broken
 * by damage on someone burning. True if it held someone.
 */
export function chainHealer(m: Match, f: Fighter, b: Brain, skill: number, enemies: Fighter[], target: Fighter): boolean {
  const healer = enemies.find((e) => healerLike(e) && e !== target && !e.pet);
  if (!healer || healer.auras.some((a) => a.kind === 'immune')) return false;
  const kill = hp(target) < 0.45 || (!!m.held(target) && hp(target) < 0.7);
  // (still held for a while: the next one waits until this one is nearly over)
  if (!kill || holdLeft(healer) > 0.35 || !knows(b, skill)) return false;
  // (a hold broken by damage only on someone nobody is hitting)
  const kinds: CcKind[] = healer.auras.some((a) => a.kind === 'dot') ? ['stun', 'silence'] : ['stun', 'incap', 'fear', 'silence'];
  const ab = holdFor(m, f, healer, kinds);
  return !!ab && holdOn(m, f, healer, ab);
}

/** A friend in trouble with a blade on them: whoever it is gets held, or rooted, or thrown off. True if it did. */
export function peel(m: Match, f: Fighter, b: Brain, skill: number, enemies: Fighter[], friends: Fighter[]): boolean {
  for (const a of friends) {
    if (a === f || a.dead || hp(a) > 0.35) continue;
    const on = enemies.find((e) => !e.pet && e.target === a.id && dist(e, a) < 50 && !m.held(e) && !e.auras.some((x) => x.kind === 'immune'));
    if (!on || !knows(b, skill, 0.5)) continue;
    const ab = holdFor(m, f, on, ['stun', 'root', 'fear', 'incap']);
    if (ab && holdOn(m, f, on, ab)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ the super */

/**
 * Whether a sharp player keeps its full super for now, in a team fight: for a kill (the target hurt or held, their
 * healer held), for several caught at once, never into immunity, and not for long (two to five seconds: a super sat
 * on is a super wasted). True: don't use it yet.
 */
export function holdSuper(m: Match, f: Fighter, b: Brain, skill: number, enemies: Fighter[], target: Fighter): boolean {
  const mind = mindOf(b);
  if (f.charge < 1) {
    mind.full = null;
    return false;
  }
  mind.full ??= m.clock;
  // (in a duel there's nobody else to wait for, and a heal for a friend is best not waited on; and sat on long enough)
  // (the super they carry: one of their class's two)
  const sup = m.extras(f)[0]!;
  if (enemies.length < 2 || sup.aim === 'friend' || m.clock - mind.full > 2 + skill * 3 || !knows(b, skill, 0.35, 0.85)) return false;
  if (armored(target)) return true;
  const healer = enemies.find((e) => healerLike(e) && e !== target);
  const window = hp(target) < 0.7 || !!m.held(target) || (healer && holdLeft(healer) > 1) || enemies.filter((e) => dist(e, target) < (sup.area ?? 40)).length >= 2;
  return !window;
}
