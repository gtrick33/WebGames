import type { ClassId } from '../data/types';
import { PRESETS } from './abilities';
import { NEW_STANDING, rankOf, RING_KEY, type Format, type Standing } from './ranks';
import type { FighterSetup } from './sim';
import { clearLive, LEAVER_K, type LiveMatch } from './live';
export { clearLive, LEAVER_K, liveGoing, LIVE_WAIT, readLive, writeLive, type LiveMatch } from './live';

export { FORMATS, NEW_STANDING, nextRank, rankOf, RANKS, type Format, type Standing } from './ranks';

/**
 * The Ring's standing: a rating for each format, ranks with a name worth earning, and who you're drawn against. It is
 * kept on this device: the ring fights the computer, so this isn't a public ranking and never says it is. The rules
 * for changing a rating are pure so they can be tested.
 */

/** The elo rule: what you stood to win against what you were expected to. */
export function ratingChange(mine: number, theirs: number, won: boolean): number {
  const expected = 1 / (1 + 10 ** ((theirs - mine) / 400));
  return Math.round(32 * ((won ? 1 : 0) - expected));
}

/** `k`: a loss counts this many times over (a leaver's: LEAVER_K). */
export function afterMatch(s: Standing, theirs: number, won: boolean, k = 1): { next: Standing; change: number; rankUp: string | null } {
  const change = Math.round(ratingChange(s.rating, theirs, won) * (won ? 1 : k));
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
    { name: 'The Pale Choir', blurb: 'Three casters who never want you to come close.', team: [{ cls: 'mage', preset: 0 }, { cls: 'warlock', preset: 1 }, { cls: 'priest', preset: 0 }] },
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
    return k && Array.isArray(k.bar) && Array.isArray(k.talents) && typeof k.oath === 'string' ? k : presetSetup(cls, i);
  });
  const active = kept && kept.active >= 0 && kept.active < SET_COUNT ? kept.active : 0;
  return { active, list };
}

export function readRing(): RingSave {
  try {
    const raw = JSON.parse(localStorage.getItem(RING_KEY) ?? 'null') as Partial<RingSave> | null;
    return { standings: raw?.standings ?? {}, sets: raw?.sets ?? {} };
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
  const out = afterMatch(was, l.rivalRating, false, LEAVER_K);
  writeRing({ ...save, standings: { ...save.standings, [l.format]: out.next } });
  clearLive();
  return out.change;
}
