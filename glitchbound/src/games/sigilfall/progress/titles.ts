import { RANKS } from '../arena/ranks';
import { MAX_LEVEL } from '../data/classes';
import { QUESTS } from '../data/quests';
import { REGIONS } from '../data/regions';
import type { RegionDef } from '../data/types';
import { CAMPAIGN_END, WARDENS } from '../data/wardens';
import { SIGILS, type Character } from './character';

/**
 * Titles: a few words a hero carries after their name, for something rare they did. Every one is earned by what the
 * hero's own record already says (the bosses they brought down, the stones they opened, how often they fell), so a
 * hero from before titles has theirs the moment they load, and nothing can give one that wasn't earned. The hero
 * wears one at a time, chosen under their name on the Hero page; the Ring and the Vigil show it too.
 *
 * A title reads "Name the Kingslayer" when it starts small ("the", "of"), and "Name, Stablemaster" when it doesn't.
 */

export interface TitleDef {
  id: string;
  name: string;
  /** How it is earned, as the list of titles says it (never a spoiler for what it names). */
  how: string;
  /** One few heroes will ever carry. */
  rare?: boolean;
  earned: (c: Character, rating?: number) => boolean;
}

const done = (c: Character, quest: string): boolean => c.quests[quest]?.state === 'done';
const cleared = (c: Character, region: string, tier: number): boolean => Object.entries(c.clears).some(([k, n]) => n > 0 && k.startsWith(`${region}:`) && Number(k.slice(region.length + 1)) >= tier);
/** The story's own dungeons (not a memory with no last boss, not an interior). */
const DUNGEONS = (Object.values(REGIONS) as RegionDef[]).filter((r) => r.kind === 'dungeon' && !r.interior && r.encounters.some((e) => !!e.boss)).map((r) => r.id);

/** The Ring's ranks are titles too: each is earned at its rating and kept once reached (arena/ranks.ts; the first is where everyone starts). */
export const RING_TITLES: readonly { rating: number; id: string; name: string }[] = RANKS.filter((r) => r.at > 0).map((r) => ({ rating: r.at, id: `ring-${r.at}`, name: r.name }));

export const TITLES: readonly TitleDef[] = [
  // the story
  { id: 'briarhollow', name: 'of Briarhollow', how: 'Close the rift under the chapel.', earned: (c) => done(c, 'close-the-rift') },
  { id: 'champion', name: 'Champion of the Starfall', how: 'Win the Starfall Festival.', earned: (c) => done(c, 'festival-the-champion') },
  { id: 'siegebreaker', name: 'the Siegebreaker', how: 'Break the siege of Highwall.', earned: (c) => done(c, 'general-morvain') },
  { id: 'seven', name: 'of the Seven Sigils', how: 'Carry all seven Crown Sigils.', earned: (c) => SIGILS.every((s) => c.perks.includes(s)) },
  { id: 'kingslayer', name: 'the Kingslayer', how: 'Bring down the Hallow King.', earned: (c) => (c.bosses.vaelor ?? 0) > 0 },
  { id: 'warden', name: '', how: 'See the whole story through: your class’s own.', earned: (c) => done(c, CAMPAIGN_END) },
  // the rare ones
  { id: 'well-travelled', name: 'the Well-Travelled', how: 'Finish every quest in the land, the small ones too.', rare: true, earned: (c) => QUESTS.every((q) => done(c, q.id) || (c.quests[q.id]?.n ?? 0) < 0) && done(c, CAMPAIGN_END) },
  { id: 'unbowed', name: 'the Unbowed', how: 'See the story through having fallen fewer than ten times.', rare: true, earned: (c) => done(c, CAMPAIGN_END) && c.stats.deaths < 10 },
  { id: 'deathless', name: 'the Deathless', how: `Reach level ${MAX_LEVEL} without ever falling.`, rare: true, earned: (c) => c.level >= MAX_LEVEL && c.stats.deaths === 0 },
  { id: 'kings-bane', name: 'Bane of the Hallow King', how: 'Clear Duskspire on Mythic.', rare: true, earned: (c) => cleared(c, 'duskspire', 2) },
  { id: 'deep-conqueror', name: 'Conqueror of the Deep', how: 'Clear every dungeon of the story on Mythic.', rare: true, earned: (c) => DUNGEONS.every((r) => cleared(c, r, 2)) },
  { id: 'ten-thousand', name: 'Bane of Ten Thousand', how: 'Defeat ten thousand enemies.', rare: true, earned: (c) => c.stats.kills >= 10000 },
  { id: 'stablemaster', name: 'Stablemaster', how: 'Own eight mounts.', earned: (c) => c.mounts.length >= 8 },
  // the Rift
  { id: 'riftwalker', name: 'Riftwalker', how: 'Open Riftstone +5.', earned: (c) => c.keystone >= 5 },
  { id: 'riftbreaker', name: 'the Riftbreaker', how: 'Open Riftstone +15.', rare: true, earned: (c) => c.keystone >= 15 },
  { id: 'last-memory', name: 'Keeper of the Last Memory', how: 'Open Riftstone +25.', rare: true, earned: (c) => c.keystone >= 25 },
  { id: 'exalted', name: 'the Exalted', how: 'Reach Paragon 25.', rare: true, earned: (c) => c.para.l >= 25 },
  // the Ring (the best rating this device has seen the player reach)
  ...RING_TITLES.map((t): TitleDef => ({ id: t.id, name: t.name, how: `Reach ${t.rating} rating in The Ring.`, rare: t.rating >= 1700, earned: (_c, rating) => (rating ?? 0) >= t.rating })),
];

const BY_ID: Record<string, TitleDef> = Object.fromEntries(TITLES.map((t) => [t.id, t]));

/** A title's words for this hero (the warden's is their class's own). */
export const titleName = (t: TitleDef, c: Pick<Character, 'cls'>): string => (t.id === 'warden' ? WARDENS[c.cls].title : t.name);

/** The titles a hero has earned, in the list's order. */
export const earnedTitles = (c: Character, rating?: number): TitleDef[] => TITLES.filter((t) => t.earned(c, rating));

/** The title the hero wears: the one they chose while it stands, else their warden's once the story is done, else none. */
export function wornTitle(c: Character, rating?: number): string | null {
  if (c.title === '') return null;
  const chosen = c.title ? BY_ID[c.title] : undefined;
  if (chosen?.earned(c, rating)) return titleName(chosen, c);
  return BY_ID.warden!.earned(c) ? titleName(BY_ID.warden!, c) : null;
}

/** Chooses the title to wear ('' for none). Refused for one not earned. */
export function chooseTitle(c: Character, id: string, rating?: number): boolean {
  if (id !== '' && !BY_ID[id]?.earned(c, rating)) return false;
  c.title = id;
  return true;
}

/** A hero's name with their title, as it is written everywhere: "Ash the Kingslayer", "Ash, Stablemaster". */
export function titled(name: string, title: string | null): string {
  if (!title) return name;
  return /^(the|of) /.test(title) ? `${name} ${title}` : `${name}, ${title}`;
}

const seen = (id: string): string => `title:${id}`;

/** The titles earned since the hero was last told of any (each is told once); marks them told. */
export function newTitles(c: Character, rating?: number): TitleDef[] {
  const fresh = earnedTitles(c, rating).filter((t) => !c.opened.includes(seen(t.id)));
  for (const t of fresh) c.opened.push(seen(t.id));
  return fresh;
}
