import type { ClassId } from '../data/types';
import { ABILITIES, fullBar, PRESETS, SLOTS } from './abilities';
import { forgetBest, NEW_STANDING, rankOf, RING_KEY, type Format, type Standing } from './ranks';
import type { FighterSetup } from './sim';
import { clearLive, LEAVER_K, type LiveMatch } from './live';
export { clearLive, LEAVER_K, liveGoing, LIVE_WAIT, readLive, writeLive, type LiveMatch } from './live';

export { FORMATS, NEW_STANDING, nextRank, rankOf, RANKS, type Format, type Standing } from './ranks';

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
 * The elo rule, as rated arenas use it: what you stood to win against what you were expected to. Against a side rated
 * below yours a win is expected, so it pays little and a loss costs a lot; against an even side both are about half
 * of K; against a side above yours a win pays a lot and a loss costs little (the owner: "queuing vs lower players
 * should give less rate on win and take more on loss ... vs higher players should let u lose less and win more").
 */
export function ratingChange(mine: number, theirs: number, won: boolean, kf = K_BASE): number {
  const expected = 1 / (1 + 10 ** ((theirs - mine) / 400));
  return Math.round(kf * ((won ? 1 : 0) - expected));
}

/**
 * What a match stands to win and lose, before it begins. `ours`: the rating the expectation is worked from: in 2v2 and
 * 3v3 against people, the mean of the player's own side (their team's matchmaking rating), as against the other side's.
 */
export function stakesOf(s: Standing, theirs: number, ours = s.rating): { win: number; lose: number } {
  return { win: ratingChange(ours, theirs, true, kFor(s)), lose: -ratingChange(ours, theirs, false, kFor(s)) };
}

/** `k`: a loss counts this many times over (a leaver's: LEAVER_K). `ours`: as stakesOf. */
export function afterMatch(s: Standing, theirs: number, won: boolean, k = 1, ours = s.rating): { next: Standing; change: number; rankUp: string | null } {
  const change = Math.round(ratingChange(ours, theirs, won, kFor(s)) * (won ? 1 : k));
  // never below the floor: a bad night doesn't dig a hole that takes a week to climb out of
  const rating = Math.max(800, s.rating + change);
  const before = rankOf(s.best);
  const best = Math.max(s.best, rating);
  const after = rankOf(best);
  return {
    next: { rating, best, wins: s.wins + (won ? 1 : 0), losses: s.losses + (won ? 0 : 1), streak: won ? Math.max(1, s.streak + 1) : Math.min(-1, s.streak - 1) },
    change: rating - s.rating,
    rankUp: after.at > before.at ? after.name : null,
  };
}

/** How sharp the computer is at a rating. A newcomer gets slow hands; the top of the ladder gets everything it has. */
export const skillAt = (rating: number): number => Math.max(0.12, Math.min(1, 0.12 + (rating - 800) / 1300));

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
    fighters: comp.team.map((t, i) => ({ team: 1, cls: t.cls, name: nameFor(t.cls, seed + i), bar: PRESETS[t.cls][t.preset]!.bar, talents: PRESETS[t.cls][t.preset]!.talents, oath: ['iron', 'fury', 'will'][(seed + i) % 3] })),
  };
}

/* ------------------------------------------------------------------ on this device */

/** What a hero brings into a match. */
export interface RingSetup {
  bar: string[];
  oath: string;
  talents: string[];
}

/** A class's saved set ups, and which is in hand. */
export interface ClassSets {
  active: number;
  list: RingSetup[];
}

export const SET_COUNT = 3;

export interface RingSave {
  standings: Record<string, Standing>;
  sets: Partial<Record<ClassId, ClassSets>>;
  /** What a fighter with no campaign hero behind them wears: Ring armor (arena/rewards.ts looks) and a Ring title. */
  plain?: { head?: string; chest?: string; title?: string };
  /** The computer teammates chosen for each format's empty places (arena/teammates.ts reads them). */
  mates?: Partial<Record<string, unknown[]>>;
}

const presetSetup = (cls: ClassId, i: number): RingSetup => {
  const p = PRESETS[cls][i % PRESETS[cls].length]!;
  return { bar: [...p.bar], oath: 'iron', talents: [...p.talents] };
};

/** A class's set ups: what the player has kept, or the ready-made ones to start from. */
export function setsOf(save: RingSave, cls: ClassId): ClassSets {
  const kept = save.sets[cls];
  const list = Array.from({ length: SET_COUNT }, (_, i) => {
    const k = kept?.list[i];
    if (!(k && Array.isArray(k.bar) && Array.isArray(k.talents) && typeof k.oath === 'string')) return presetSetup(cls, i);
    // (a setup kept from when a bar held six keeps its first four; one holding an ability since taken out of the game, or
    // renamed, loses it and is filled up again, so that it is never left short. A bar its player is still filling is left
    // as it is)
    const own = k.bar.filter((id) => ABILITIES[id]?.cls === cls && !ABILITIES[id]!.super);
    return { ...k, bar: own.length < k.bar.length ? fullBar(cls, own) : k.bar.slice(0, SLOTS) };
  });
  const active = kept && kept.active >= 0 && kept.active < SET_COUNT ? kept.active : 0;
  return { active, list };
}

export function readRing(): RingSave {
  try {
    const raw = JSON.parse(localStorage.getItem(RING_KEY) ?? 'null') as Partial<RingSave> | null;
    const plain = raw?.plain && typeof raw.plain === 'object' ? raw.plain : undefined;
    const mates = raw?.mates && typeof raw.mates === 'object' ? raw.mates : undefined;
    return { standings: raw?.standings ?? {}, sets: raw?.sets ?? {}, ...(plain ? { plain } : {}), ...(mates ? { mates } : {}) };
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
  const out = afterMatch(was, l.rivalRating, false, LEAVER_K, l.ourRating ?? was.rating);
  writeRing({ ...save, standings: { ...save.standings, [l.format]: out.next } });
  clearLive();
  return out.change;
}
