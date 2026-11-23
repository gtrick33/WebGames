import { keyLoot } from '../data/keystones';
import { ITEM_DEFS } from '../data/items';
import { SETS } from '../data/riftgear';
import { greedCache, greedMarks, heartRank, HEARTS, JOURNEY, seasonDef, type HeartId, type JourneyChapter } from '../data/seasons';
import type { Item, Mod } from '../data/types';
import { bagSize, type Character } from './character';
import { makeItem } from './items';

/**
 * A hero's part in a Rift season (data/seasons.ts): their Season Heart, the season's best stone, and how far their
 * Journey has come. Kept on the hero; a new season starts it over (what was earned, a title and its mount, stays:
 * `rtitles`). Only the Riftstones count, and only a run that beats the clock.
 */
export interface RiftSeason {
  /** The season this is the progress of. */
  n: number;
  /** The Season Heart chosen (the Season of Hearts); null until one is. */
  heart: string | null;
  /** The highest stone beaten in time this season, anywhere. */
  best: number;
  /** Runs beaten in time this season. */
  runs: number;
  /** The dungeons beaten in time this season. */
  dungeons: string[];
  /** Runs beaten in time without falling once. */
  flawless: number;
  /** Journey chapters claimed (0 to 5). */
  claimed: number;
  /** The Rift set the Journey's pieces are of, chosen at the first chapter that gives one. */
  set: string | null;
}

export const freshSeason = (n: number): RiftSeason => ({ n, heart: null, best: 0, runs: 0, dungeons: [], flawless: 0, claimed: 0, set: null });

/** The hero's progress in season `n` (a fresh one if what they hold is from another season), without changing them. */
export const seasonOf = (c: Pick<Character, 'rseason'>, n: number): RiftSeason => (c.rseason?.n === n ? c.rseason : freshSeason(n));

/** The hero's progress in season `n`, kept on them (started over if what they held was from another season). */
export function ensureSeason(c: Character, n: number): RiftSeason {
  if (c.rseason?.n !== n) c.rseason = freshSeason(n);
  return c.rseason;
}

/** A Riftstone run's end, as the season counts it: only a run in time counts. */
export function recordRun(c: Character, n: number, region: string, stone: number, up: number, deaths: number): void {
  if (n <= 0 || up <= 0) return;
  const s = ensureSeason(c, n);
  s.runs += 1;
  s.best = Math.max(s.best, stone);
  if (!s.dungeons.includes(region)) s.dungeons.push(region);
  if (deaths === 0) s.flawless += 1;
}

/** Whether the hero has used the season's power (what the Journey's first chapter asks): a mechanic not built yet asks nothing. */
export function mechanicUsed(c: Pick<Character, 'rseason'>, n: number): boolean {
  const def = seasonDef(n);
  if (!def.built) return true;
  if (def.mechanic === 'heart') return !!seasonOf(c, n).heart;
  return true;
}

/* --------------------------------------------------------------- the Season Heart */

/** The heart the hero has chosen this season, if this is the Season of Hearts. */
export function heartOf(c: Pick<Character, 'rseason'>, n: number): HeartId | null {
  if (n <= 0 || seasonDef(n).mechanic !== 'heart') return null;
  const h = seasonOf(c, n).heart;
  return h && h in HEARTS ? (h as HeartId) : null;
}

/** Chooses the Season Heart (any time, in the Riftward). */
export function chooseHeart(c: Character, n: number, id: string): boolean {
  if (n <= 0 || seasonDef(n).mechanic !== 'heart' || !(id in HEARTS)) return false;
  ensureSeason(c, n).heart = id;
  return true;
}

/** What the season adds to a hero in a Riftstone run (sim/world.ts builds it in): nothing outside one, or out of season. */
export function seasonMods(c: Pick<Character, 'rseason'>, n: number): Mod[] {
  const heart = heartOf(c, n);
  return heart ? HEARTS[heart].mods(heartRank(seasonOf(c, n).best)) : [];
}

/** The Heart of Greed's share of a run's end: more Sigil Marks (a share) and items in the cache. */
export function greedOf(c: Pick<Character, 'rseason'>, n: number): { marks: number; cache: number } {
  if (heartOf(c, n) !== 'greed') return { marks: 0, cache: 0 };
  const r = heartRank(seasonOf(c, n).best);
  return { marks: greedMarks(r), cache: greedCache(r) };
}

/* --------------------------------------------------------------- the Journey */

export interface ChapterState {
  chapter: JourneyChapter;
  goals: { id: string; text: string; have: number; need: number; done: boolean }[];
  done: boolean;
  claimed: boolean;
  /** Claimable now: done, the chapters before it claimed, and it not yet. */
  ready: boolean;
}

export function journeyOf(c: Pick<Character, 'rseason'>, n: number): ChapterState[] {
  const s = seasonOf(c, n);
  const counts = { best: s.best, runs: s.runs, dungeons: s.dungeons.length, flawless: s.flawless, mechanic: mechanicUsed(c, n) };
  return JOURNEY.map((chapter, i) => {
    const goals = chapter.goals.map((g) => {
      const have = Math.min(g.need, g.of(counts));
      return { id: g.id, text: g.text, have, need: g.need, done: have >= g.need };
    });
    const done = goals.every((x) => x.done);
    return { chapter, goals, done, claimed: s.claimed > i, ready: done && s.claimed === i };
  });
}

/** The Rift sets a hero may take the Journey's pieces of: their calling's own, and each specialization's. */
export const journeySets = (c: Pick<Character, 'cls'>): string[] => Object.values(SETS).filter((x) => x.cls === c.cls).map((x) => x.id);

export interface Claimed {
  ok: boolean;
  why?: string;
  marks?: number;
  items?: Item[];
  title?: string;
}

/** Takes a finished chapter's reward (the next one in order): Sigil Marks, two pieces of the chosen set, or the title. */
export function claimChapter(c: Character, n: number, i: number, setId?: string): Claimed {
  const s = ensureSeason(c, n);
  const state = journeyOf(c, n)[i];
  if (!state?.ready) return { ok: false, why: 'Not yet' };
  const r = state.chapter.reward;
  const items: Item[] = [];
  if (r.pieces) {
    const set = s.set ?? setId ?? null;
    if (!set || !journeySets(c).includes(set)) return { ok: false, why: 'Choose a set first' };
    if (c.bag.length + r.pieces > bagSize(c)) return { ok: false, why: 'Your bag is full' };
    // the pieces in slot order, two a chapter: head and chest, legs and hands, feet and ring
    const done = JOURNEY.slice(0, i).reduce((a, ch) => a + (ch.reward.pieces ?? 0), 0);
    const il = keyLoot(Math.max(1, s.best));
    for (const id of SETS[set]!.pieces.slice(done, done + r.pieces)) {
      const it = ITEM_DEFS[id] ? makeItem(id, il) : null;
      if (it) items.push(it);
    }
    s.set = set;
  }
  for (const it of items) c.bag.push(it);
  if (r.marks) c.marks += r.marks;
  let title: string | undefined;
  if (r.title) {
    const t = seasonDef(n).title;
    c.rtitles = [...new Set([...(c.rtitles ?? []), t.id])];
    title = t.name;
  }
  s.claimed = i + 1;
  return { ok: true, items, ...(r.marks ? { marks: r.marks } : {}), ...(title ? { title } : {}) };
}
