import type { ClassId } from '../data/types';
import { fullBar, PRESETS, SLOTS, takes } from './abilities';
import { forgetBest, mmrOf, NEW_STANDING, rankOf, RING_KEY, type Format, type Standing } from './ranks';
import type { FighterSetup } from './sim';
import { clearLive, LEAVER_K, type LiveMatch } from './live';
import { recordOf, type RingRecord } from './record';
export { clearLive, LEAVER_K, liveGoing, LIVE_WAIT, readLive, writeLive, type LiveMatch } from './live';

export { FORMATS, mmrOf, NEW_STANDING, nextRank, rankOf, RANKS, type Format, type Standing } from './ranks';

/**
 * The Ring's standing: a rating for each format, ranks with a name worth earning, and who you're drawn against. It is
 * kept on this device: the ring fights the computer, so this isn't a public ranking and never says it is. The rules
 * for changing a rating are pure so they can be tested.
 */

/** How far a match moves a rating at most (K). */
export const K_BASE = 32;
/** ...in a player's first PLACEMENT matches of a format, while the ladder is still finding where they belong. */
export const K_NEW = 48;
export const PLACEMENT = 10;
export const kFor = (s: Standing): number => (s.wins + s.losses < PLACEMENT ? K_NEW : K_BASE);
/**
 * The matchmaking rating moves further still in those first matches (and by K_BASE after): it finds where a newcomer
 * belongs within a few matches, and the rating shown follows it there (catchUp).
 */
export const K_MMR_NEW = 64;
export const kMmrFor = (s: Standing): number => (s.wins + s.losses < PLACEMENT ? K_MMR_NEW : K_BASE);

/** The elo rule before rounding: what a match moves a rating worked from `mine`, at `kf`. */
const eloOf = (mine: number, theirs: number, won: boolean, kf: number): number => kf * ((won ? 1 : 0) - 1 / (1 + 10 ** ((theirs - mine) / 400)));

/**
 * The elo rule, as rated arenas use it: what you stood to win against what you were expected to. Against a side rated
 * below yours a win is expected, so it pays little and a loss costs a lot; against an even side both are about half
 * of K; against a side above yours a win pays a lot and a loss costs little (the owner: "queuing vs lower players
 * should give less rate on win and take more on loss ... vs higher players should let u lose less and win more").
 */
export function ratingChange(mine: number, theirs: number, won: boolean, kf = K_BASE): number {
  return Math.round(eloOf(mine, theirs, won, kf));
}

/** The rating shown never falls below this: a bad night doesn't dig a hole that takes a week to climb out of. */
export const RATING_FLOOR = 800;
/**
 * The matchmaking rating can fall further: a player who keeps losing is drawn against easier sides still (and the
 * computer plays them more gently: skillAt), while the rating they show stays where it is.
 */
export const MMR_FLOOR = 600;
/** How far the rating shown has to trail the matchmaking rating for a win to pay double and a loss to cost half. */
export const CATCH_UP = 400;

/**
 * As rated arenas do it: while the rating shown is below the matchmaking rating, wins pay more and losses cost less,
 * so that it climbs to where the player is matched (twice as much, and half, CATCH_UP below it); above it, the other
 * way round (half as much at most, and half again). Equal, a match moves both alike.
 */
export function catchUp(rating: number, mmr: number, won: boolean): number {
  const gap = (mmr - rating) / CATCH_UP;
  return won ? 1 + Math.max(-0.5, Math.min(1, gap)) : 1 - Math.max(-0.5, Math.min(0.5, gap));
}

/** What a match moves the rating shown, before the floor. `k` and `ours`: as afterMatch. */
function shownChange(s: Standing, theirs: number, won: boolean, k: number, ours: number): number {
  return Math.round(Math.round(eloOf(ours, theirs, won, kFor(s)) * catchUp(s.rating, mmrOf(s), won)) * (won ? 1 : k));
}

/**
 * What a match stands to win and lose, before it begins. `ours`: the rating the expectation is worked from: the
 * player's matchmaking rating, or in 2v2 and 3v3 against people, the mean of their own side's (their team's
 * matchmaking rating), as against the other side's.
 */
export function stakesOf(s: Standing, theirs: number, ours = mmrOf(s)): { win: number; lose: number } {
  return { win: shownChange(s, theirs, true, 1, ours), lose: -shownChange(s, theirs, false, 1, ours) };
}

/**
 * A match settled. `k`: a loss counts this many times over (a leaver's: LEAVER_K). `ours`: as stakesOf. The
 * matchmaking rating moves by the plain elo rule (kMmrFor); the rating shown by the same at kFor, scaled toward the
 * matchmaking rating (catchUp).
 */
export function afterMatch(s: Standing, theirs: number, won: boolean, k = 1, ours = mmrOf(s)): { next: Standing; change: number; rankUp: string | null } {
  const rating = Math.max(RATING_FLOOR, s.rating + shownChange(s, theirs, won, k, ours));
  const mmr = Math.max(MMR_FLOOR, mmrOf(s) + Math.round(Math.round(eloOf(ours, theirs, won, kMmrFor(s))) * (won ? 1 : k)));
  const before = rankOf(s.best);
  const best = Math.max(s.best, rating);
  const after = rankOf(best);
  return {
    next: { rating, best, wins: s.wins + (won ? 1 : 0), losses: s.losses + (won ? 0 : 1), streak: won ? Math.max(1, s.streak + 1) : Math.min(-1, s.streak - 1), mmr },
    change: rating - s.rating,
    rankUp: after.at > before.at ? after.name : null,
  };
}

/**
 * The rating of the computer's side drawn against a standing: either way of its matchmaking rating, up to 150 (what
 * the match pays and costs follows, stakesOf, and so does how sharply the computer plays, skillAt).
 */
export const rivalFor = (s: Standing, seed: number): number => Math.max(MMR_FLOOR, Math.round(mmrOf(s)) + (seed % 301) - 150);

/**
 * How sharp the computer is at a rating, from 0 to 1 (arena/bot.ts, arena/tactics.ts). The owner, 2026-11-14: "they
 * should be bad when you first start and get progressively harder and harder". A straight climb from SKILL_FROM, where
 * it is at its clumsiest, to SKILL_TOP, where it plays everything it knows: about 0.1 at the starting 1000, where it
 * stands about and wastes its cooldowns (less and less as the rating climbs, and not at all from about 1720); a
 * practised player's habits from about 1500, more of them the higher; 0.86 at 2100, the top rank; all of it from 2300.
 */
export const SKILL_FROM = 850;
export const SKILL_TOP = 2300;
export const skillAt = (rating: number): number => Math.max(0, Math.min(1, (rating - SKILL_FROM) / (SKILL_TOP - SKILL_FROM)));

/**
 * How sharp the computer plays on the player's own side in 2v2 and 3v3: as the ladder does at their matchmaking
 * rating, but never as clumsy as a newcomer's opponents (a friend who stands about would make the first matches a
 * chore rather than easy).
 */
export const MATE_FLOOR = 0.3;
export const mateSkill = (mmr: number): number => Math.max(MATE_FLOOR, skillAt(mmr));

export interface Comp {
  name: string;
  blurb: string;
  team: { cls: ClassId; preset: number }[];
}

/** Teams that work, for the computer to bring and for a player to look at. */
export const COMPS: Record<Format, Comp[]> = {
  1: [
    { name: 'The Reaper', blurb: 'A warrior who closes in and doesn’t let go.', team: [{ cls: 'warrior', preset: 0 }] },
    { name: 'The Pyre', blurb: 'A mage who needs you standing still for three seconds.', team: [{ cls: 'mage', preset: 0 }] },
    { name: 'The Rime', blurb: 'A mage who holds you in place and takes their time.', team: [{ cls: 'mage', preset: 1 }] },
    { name: 'The Longbow', blurb: 'A ranger who never stops moving.', team: [{ cls: 'ranger', preset: 0 }] },
    { name: 'The Hexer', blurb: 'A warlock who only has to wait.', team: [{ cls: 'warlock', preset: 0 }] },
    { name: 'The Zealot', blurb: 'A paladin who hits like a door and won’t fall down.', team: [{ cls: 'paladin', preset: 1 }] },
    { name: 'The Starseer', blurb: 'A druid who shuts you out and burns you from afar.', team: [{ cls: 'druid', preset: 1 }] },
    { name: 'The Curse-speaker', blurb: 'A priest who has given up on healing anyone.', team: [{ cls: 'priest', preset: 1 }] },
    { name: 'The Bloodsworn', blurb: 'A gloamknight who pays in blood and drinks it back.', team: [{ cls: 'gloamknight', preset: 0 }] },
    { name: 'The Nightblade', blurb: 'A gloamknight you won’t see until the knife is in.', team: [{ cls: 'gloamknight', preset: 1 }] },
    { name: 'The Gravecaller', blurb: 'A warlock who sends the dead to you and waits.', team: [{ cls: 'warlock', preset: 1 }] },
  ],
  2: [
    { name: 'Blade and Dawn', blurb: 'A warrior in your face and a priest behind them. Stop the heals.', team: [{ cls: 'warrior', preset: 0 }, { cls: 'priest', preset: 0 }] },
    { name: 'Ash and Oak', blurb: 'Curses that never stop and a druid no one can hold.', team: [{ cls: 'warlock', preset: 0 }, { cls: 'druid', preset: 0 }] },
    { name: 'Long Shadows', blurb: 'A ranger and a healing paladin. They only need one good stun.', team: [{ cls: 'ranger', preset: 0 }, { cls: 'paladin', preset: 0 }] },
    { name: 'Fire and Fury', blurb: 'Two killers and no healer. Live ten seconds longer than they can.', team: [{ cls: 'warrior', preset: 0 }, { cls: 'mage', preset: 0 }] },
    { name: 'Frost and Leaf', blurb: 'A mage who locks you down while a druid keeps them standing.', team: [{ cls: 'mage', preset: 1 }, { cls: 'druid', preset: 0 }] },
  ],
  3: [
    { name: 'The Old Guard', blurb: 'A warrior, a mage and a priest. It has always worked.', team: [{ cls: 'warrior', preset: 0 }, { cls: 'mage', preset: 1 }, { cls: 'priest', preset: 0 }] },
    { name: 'Rot and Roots', blurb: 'Curses, a stun at the right moment, and a druid in the back.', team: [{ cls: 'warlock', preset: 0 }, { cls: 'ranger', preset: 0 }, { cls: 'druid', preset: 0 }] },
    { name: 'Oath and Arrow', blurb: 'They all go for one target at once, and a paladin stands behind them.', team: [{ cls: 'ranger', preset: 0 }, { cls: 'warrior', preset: 1 }, { cls: 'paladin', preset: 0 }] },
    { name: 'The Pale Choir', blurb: 'Two casters and a warlock’s dead between you and them.', team: [{ cls: 'mage', preset: 0 }, { cls: 'warlock', preset: 1 }, { cls: 'priest', preset: 0 }] },
  ],
};

const NAMES: Record<ClassId, string[]> = {
  warrior: ['Brannoch', 'Hild the Red', 'Torvald', 'Ysolde Ironhand'],
  mage: ['Selvine', 'Orrin Vael', 'Ilsabet', 'Quill'],
  ranger: ['Tamsin', 'Corvane', 'Wren Ashby', 'Odrik'],
  priest: ['Sister Maud', 'Aurelis', 'Brother Tann', 'Ione'],
  paladin: ['Ser Galen', 'Dame Oriel', 'Ser Hask', 'Maerwen'],
  warlock: ['Nyx Morrow', 'Sorrel', 'Hask the Grey', 'Veska'],
  druid: ['Eirlys', 'Old Fen', 'Bramble', 'Thessaly'],
  gloamknight: ['Ser Aldane', 'Dame Vesper', 'Corwin Ashgrave', 'Sable'],
};

export const nameFor = (cls: ClassId, i: number): string => NAMES[cls][i % NAMES[cls].length]!;

/** Nobody in a match shares a name: a nameplate is how you tell who's who. People keep theirs, the bots give way. */
export function namedApart(fighters: FighterSetup[]): FighterSetup[] {
  const isPerson = (f: FighterSetup): boolean => !!f.human || f.seat !== undefined;
  const taken = new Set(fighters.filter(isPerson).map((f) => f.name));
  return fighters.map((f) => {
    if (isPerson(f)) return f;
    let name = f.name;
    for (let i = 0; taken.has(name) && i < NAMES[f.cls].length; i++) name = nameFor(f.cls, i);
    taken.add(name);
    return name === f.name ? f : { ...f, name };
  });
}

/** The team you are drawn against, set against your own. */
export function drawOpponents(format: Format, seed: number): { comp: Comp; fighters: FighterSetup[] } {
  const list = COMPS[format];
  const comp = list[seed % list.length]!;
  return {
    comp,
    fighters: comp.team.map((t, i) => ({ team: 1, cls: t.cls, name: nameFor(t.cls, seed + i), bar: PRESETS[t.cls][t.preset]!.bar, talents: PRESETS[t.cls][t.preset]!.talents })),
  };
}

/* ------------------------------------------------------------------ on this device */

/**
 * What a hero brings into a match: their abilities, talents and super. (An oath and the Unbinding Charm were kept with
 * these until 2026-11-15; a setup kept from then still has them written down, and they are left unread.)
 */
export interface RingSetup {
  bar: string[];
  talents: string[];
  /** Which of its class's two supers (abilities.ts ultsOf); nothing said: the one that goes with its bar (ultFor). */
  ult?: string;
}

/** A class's saved set ups, and which is in hand. */
export interface ClassSets {
  active: number;
  list: RingSetup[];
  /**
   * When they last changed (ms): two devices' copies of a class's setups are joined by it, the later whole
   * (platform/mergeRules.ts mergeRing).
   */
  at?: number;
  /**
   * How many abilities a bar held when these were kept (abilities.ts SLOTS); nothing said: four, as before bars held
   * five. A bar that was full then is filled up to the new size when it is read; one still being filled is left be.
   */
  n?: number;
}

/** How many abilities a bar held before it was written down with the setups (ClassSets.n). */
const OLD_SLOTS = 4;

export const SET_COUNT = 3;

export interface RingSave {
  standings: Record<string, Standing>;
  sets: Partial<Record<ClassId, ClassSets>>;
  /** What a fighter with no campaign hero behind them wears: Ring armor (arena/rewards.ts looks) and a Ring title. */
  plain?: { head?: string; chest?: string; title?: string };
  /** The computer teammates chosen for each format's empty places (arena/teammates.ts reads them). */
  mates?: Partial<Record<string, unknown[]>>;
  /**
   * What the Ring has taught on this device: whether the tutorial was offered (`asked`) and finished (`done`), and the
   * one-time hints already shown in a match (arena/lessons.ts).
   */
  learn?: RingLearn;
  /** Challenges, class mastery, the season and the history (arena/record.ts). */
  record?: RingRecord;
}

export interface RingLearn {
  asked?: boolean;
  done?: boolean;
  hints?: string[];
}

/** What was taught, as far as it can be trusted. */
function learnOf(v: unknown): RingLearn | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  return { asked: o.asked === true, done: o.done === true, hints: Array.isArray(o.hints) ? o.hints.filter((h): h is string => typeof h === 'string').slice(0, 32) : [] };
}

const presetSetup = (cls: ClassId, i: number): RingSetup => {
  const p = PRESETS[cls][i % PRESETS[cls].length]!;
  return { bar: [...p.bar], talents: [...p.talents], ult: p.ult };
};

/** A class's set ups: what the player has kept, or the ready-made ones to start from. */
export function setsOf(save: RingSave, cls: ClassId): ClassSets {
  const kept = save.sets[cls];
  const list = Array.from({ length: SET_COUNT }, (_, i) => {
    const k = kept?.list[i];
    if (!(k && Array.isArray(k.bar) && Array.isArray(k.talents))) return presetSetup(cls, i);
    // (a setup kept from when a bar held six keeps its first five; one holding an ability since taken out of the game, or
    // renamed, loses it and is filled up again, so that it is never left short; one that was full when bars held fewer
    // gets the rest from the ready-made bar it is closest to. A bar its player is still filling is left as it is)
    const own = k.bar.filter((id) => takes(cls, id));
    const was = typeof kept.n === 'number' ? kept.n : OLD_SLOTS;
    const grown = was < SLOTS && own.length >= was;
    // (only what a setup holds now: an oath or a charm written down from before is left behind)
    return { bar: own.length < k.bar.length || grown ? fullBar(cls, own) : k.bar.slice(0, SLOTS), talents: k.talents, ...(typeof k.ult === 'string' ? { ult: k.ult } : {}) };
  });
  const active = kept && kept.active >= 0 && kept.active < SET_COUNT ? kept.active : 0;
  return { active, list };
}

export function readRing(): RingSave {
  try {
    const raw = JSON.parse(localStorage.getItem(RING_KEY) ?? 'null') as Partial<RingSave> | null;
    const plain = raw?.plain && typeof raw.plain === 'object' ? raw.plain : undefined;
    const mates = raw?.mates && typeof raw.mates === 'object' ? raw.mates : undefined;
    const learn = learnOf(raw?.learn);
    const record = recordOf(raw?.record);
    return { standings: raw?.standings ?? {}, sets: raw?.sets ?? {}, ...(plain ? { plain } : {}), ...(mates ? { mates } : {}), ...(learn ? { learn } : {}), ...(record ? { record } : {}) };
  } catch {
    return { standings: {}, sets: {} };
  }
}

export function writeRing(s: RingSave): void {
  try {
    localStorage.setItem(RING_KEY, JSON.stringify(s));
  } catch {
    /* a browser that keeps nothing: the match still happened */
  }
  // (what the rating has earned is asked afresh)
  forgetBest();
}

export const standingOf = (s: RingSave, f: Format): Standing => s.standings[f] ?? NEW_STANDING;

/** What not going back costs: a leaver's loss, taken now. Returns the rating change (negative). */
export function forfeitLive(l: LiveMatch): number {
  // (left before the gates lifted: that costs nothing, as walking out then does)
  if (!l.snap || l.snap.p === 'gates') {
    clearLive();
    return 0;
  }
  const save = readRing();
  const was = standingOf(save, l.format);
  const out = afterMatch(was, l.rivalRating, false, LEAVER_K, l.ourRating ?? mmrOf(was));
  writeRing({ ...save, standings: { ...save.standings, [l.format]: out.next } });
  clearLive();
  return out.change;
}
