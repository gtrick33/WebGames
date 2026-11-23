import { CLASSES } from '../data/classes';
import { keyLoot } from '../data/keystones';
import { ITEM_DEFS } from '../data/items';
import { SETS } from '../data/riftgear';
import { BLESSINGS, greedCache, greedMarks, heartRank, HEARTS, HUNT_MAX, JOURNEY, KINSHIP_EXTRA, seasonDef, type HeartId, type JourneyChapter } from '../data/seasons';
import { SKILLS } from '../data/skills';
import { SPEC_LEVEL } from '../data/talents';
import type { Item, Mod } from '../data/types';
import type { SeasonShape } from './build';
import { allItems, bagSize, slotOpen, type Character } from './character';
import { itemMods, makeItem, usableBy } from './items';

/**
 * A hero's part in a Rift season (data/seasons.ts): what they chose for the season's mechanic, the season's best stone,
 * and how far their Journey has come. Kept on the hero; a new season starts it over (what was earned, a title and its
 * mount, stays: `rtitles`). Only the Riftstones count, and only a run that beats the clock.
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
  /** The legendary lending its power, by the uid of the piece (the Season of Borrowed Legends). */
  borrowed?: string | null;
  /** Another specialization's skill, and the bar's slot it takes in a run (the Season of Twin Paths). */
  twin?: { skill: string; slot: number } | null;
  /** Blessings lit at the altar (the Season of Offerings). */
  altar?: number;
  /** Hunters beaten (the Season of the Hunter). */
  hunted?: number;
  /** The season's power was felt in a run (a shrine walked through, a boon taken, a streak, an echo, a set made whole). */
  used?: boolean;
  /** What the season's page tells of it: the longest streak, shrines walked through, echoes, boons taken. */
  streak?: number;
  shrines?: number;
  echoes?: number;
  boons?: number;
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

/** Whether the hero has used the season's power (what the Journey's first chapter asks). */
export function mechanicUsed(c: Pick<Character, 'rseason' | 'equip' | 'bag' | 'cls'>, n: number): boolean {
  const s = seasonOf(c, n);
  switch (seasonDef(n).mechanic) {
    case 'heart':
      return !!s.heart;
    case 'borrowed':
      return !!borrowedItem(c, n);
    case 'twin':
      return !!s.twin;
    case 'altar':
      return (s.altar ?? 0) > 0;
    default:
      return !!s.used;
  }
}

/* --------------------------------------------------------------- what the season makes of the hero in a run */

/** The heart the hero has chosen this season, if this is the Season of Hearts. */
export function heartOf(c: Pick<Character, 'rseason'>, n: number): HeartId | null {
  if (n <= 0 || seasonDef(n).mechanic !== 'heart') return null;
  const h = seasonOf(c, n).heart;
  return h && h in HEARTS ? (h as HeartId) : null;
}

/** Chooses the Season Heart (any time, out of a run). */
export function chooseHeart(c: Character, n: number, id: string): boolean {
  if (n <= 0 || seasonDef(n).mechanic !== 'heart' || !(id in HEARTS)) return false;
  ensureSeason(c, n).heart = id;
  return true;
}

/** The legendaries of their calling a hero owns whose power can be lent (worn or carried, with a power of their own). */
export function lendable(c: Pick<Character, 'equip' | 'bag' | 'cls'>): Item[] {
  return allItems(c as Character).filter((it) => it.r === 'legendary' && usableBy(it, c.cls) && itemMods(it).length > 0);
}

/** Whether the hero wears the piece (a borrowed legend worn lends nothing more: its power is already theirs). */
export const wearing = (c: Pick<Character, 'equip'>, uid: string): boolean => Object.values(c.equip).some((it) => it?.uid === uid);

/** The legendary lending its power this season, if this is the Season of Borrowed Legends and the hero still owns it. */
export function borrowedItem(c: Pick<Character, 'rseason' | 'equip' | 'bag' | 'cls'>, n: number): Item | null {
  if (n <= 0 || seasonDef(n).mechanic !== 'borrowed') return null;
  const uid = seasonOf(c, n).borrowed;
  return uid ? (lendable(c).find((it) => it.uid === uid) ?? null) : null;
}

export function chooseBorrowed(c: Character, n: number, uid: string): boolean {
  if (n <= 0 || seasonDef(n).mechanic !== 'borrowed' || !lendable(c).some((it) => it.uid === uid)) return false;
  ensureSeason(c, n).borrowed = uid;
  return true;
}

/** The skills another of the hero's specializations brings, that one of theirs could take for a run (not a shape's). */
export function twinSkills(c: Pick<Character, 'cls' | 'spec' | 'level'>): string[] {
  if (c.spec === null || c.level < SPEC_LEVEL) return [];
  return CLASSES[c.cls].trees.filter((t, i) => i !== c.spec && !t.formOnly && !!SKILLS[t.skill]).map((t) => t.skill);
}

export function chooseTwin(c: Character, n: number, skill: string, slot: number): boolean {
  if (n <= 0 || seasonDef(n).mechanic !== 'twin' || !twinSkills(c).includes(skill) || slot < 0 || slot > 3 || !slotOpen(c, slot as 0)) return false;
  ensureSeason(c, n).twin = { skill, slot };
  return true;
}

/** The altar's next blessing and what it takes, or null once all ten are lit. */
export function nextBlessing(c: Pick<Character, 'rseason'>, n: number): { i: number; cost: number } | null {
  const lit = seasonOf(c, n).altar ?? 0;
  const b = BLESSINGS[lit];
  return b ? { i: lit, cost: b.cost } : null;
}

/** Lights the altar's next blessing for its Sigil Marks. */
export function offerAltar(c: Character, n: number): boolean {
  if (n <= 0 || seasonDef(n).mechanic !== 'altar') return false;
  const next = nextBlessing(c, n);
  if (!next || c.marks < next.cost) return false;
  c.marks -= next.cost;
  ensureSeason(c, n).altar = next.i + 1;
  return true;
}

/** The blessings lit, in the order they were. */
export const blessingsLit = (c: Pick<Character, 'rseason'>, n: number) => (seasonDef(n).mechanic === 'altar' ? BLESSINGS.slice(0, seasonOf(c, n).altar ?? 0) : []);

/** More damage on every skill. */
const harder = (pct: number): Mod => ({ t: 'skill', skill: '*', op: { op: 'damage', pct } });

/**
 * What the season makes of the hero in a Riftstone run (sim/world.ts builds it in): modifiers, set pieces counted beyond
 * those worn, a borrowed skill. Nothing out of a run, or out of season. (The run's own: a shrine, a streak, a boon, the
 * hunter, an echo, are sim/season.ts's.)
 */
export function seasonBuild(c: Pick<Character, 'rseason' | 'equip' | 'bag' | 'cls' | 'spec' | 'level'>, n: number): { mods: Mod[]; shape: SeasonShape } {
  if (n <= 0) return { mods: [], shape: {} };
  const s = seasonOf(c, n);
  switch (seasonDef(n).mechanic) {
    case 'heart': {
      const heart = heartOf(c, n);
      return { mods: heart ? HEARTS[heart].mods(heartRank(s.best)) : [], shape: {} };
    }
    case 'kinship':
      return { mods: [], shape: { sets: KINSHIP_EXTRA } };
    case 'borrowed': {
      const it = borrowedItem(c, n);
      return { mods: it && !wearing(c, it.uid) ? itemMods(it) : [], shape: {} };
    }
    case 'altar':
      return { mods: blessingsLit(c, n).flatMap((b) => b.mods ?? []), shape: {} };
    case 'nemesis': {
      const h = Math.min(HUNT_MAX, s.hunted ?? 0);
      return { mods: h ? [harder(h)] : [], shape: {} };
    }
    case 'twin':
      return { mods: [], shape: s.twin && twinSkills(c).includes(s.twin.skill) ? { twin: s.twin } : {} };
    default:
      return { mods: [], shape: {} };
  }
}

/** What the season makes of a hero in a run: its modifiers alone. */
export const seasonMods = (c: Pick<Character, 'rseason' | 'equip' | 'bag' | 'cls' | 'spec' | 'level'>, n: number): Mod[] => seasonBuild(c, n).mods;

/** What the season adds to a run's end: Sigil Marks (a share), items in the cache, stones opened; and a longer clock. */
export function seasonRunEnd(c: Pick<Character, 'rseason'>, n: number): { marks: number; cache: number; up: number; clock: number } {
  const out = { marks: 0, cache: 0, up: 0, clock: 0 };
  if (heartOf(c, n) === 'greed') {
    const r = heartRank(seasonOf(c, n).best);
    out.marks += greedMarks(r);
    out.cache += greedCache(r);
  }
  for (const b of blessingsLit(c, n)) {
    out.marks += b.marks ?? 0;
    out.cache += b.cache ?? 0;
    out.up += b.up ?? 0;
    out.clock += b.clock ?? 0;
  }
  return out;
}

/** The Heart of Greed's share of a run's end (kept for the tests and the page). */
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

export function journeyOf(c: Pick<Character, 'rseason' | 'equip' | 'bag' | 'cls'>, n: number): ChapterState[] {
  const s = seasonOf(c, n);
  const counts = { best: s.best, runs: s.runs, dungeons: s.dungeons.length, flawless: s.flawless, mechanic: mechanicUsed(c, n) };
  return JOURNEY.map((chapter, i) => {
    const goals = chapter.goals.map((g) => {
      const have = Math.min(g.need, g.of(counts));
      return { id: g.id, text: g.id === 'mechanic' ? seasonDef(n).goal : g.text, have, need: g.need, done: have >= g.need };
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
