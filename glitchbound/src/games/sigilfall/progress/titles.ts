import { cleanTitle, isTitleFx, titleGoesAfter, type TitleFxId } from '../../../catalog/titleFx';
import type { SigilTitleGrant } from '../../../platform/apiTypes';
import { bestRating, RANKS } from '../arena/ranks';
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
 * A title that names what it is of reads after the name ("Ash the Kingslayer", "Ash, Champion of the Starfall"); any
 * other before it ("Blooded Ash", "Stablemaster Ash"): the owner, "titles should be before the name, e.g. Unblooded
 * Guitartrick, Blooded Guitartrick". Every title wears a light over its letters (catalog/titleFx.ts), finer the harder
 * it is to earn, the finest of all for the top of the Ring.
 *
 * An admin can give a member a title of their own words and light (Admin › Sigilfall): the account brings them
 * (`Me.sigilTitles`), every hero of the account can wear them, and they last while the account has them.
 */

export interface TitleDef {
  id: string;
  name: string;
  /** How it is earned, as the list of titles says it (never a spoiler for what it names). */
  how: string;
  /** One few heroes will ever carry. */
  rare?: boolean;
  /** The light over its letters. */
  fx: TitleFxId;
  /** Read before the name, or after it; unsaid, as its words read (catalog/titleFx.ts titleGoesAfter). */
  before?: boolean;
  /** Given by an admin, not earned in the game. */
  given?: true;
  earned: (c: Character, rating?: number) => boolean;
}

/** A title as it is shown: its words, its light, and which side of the name it stands on. */
export interface TitleShown {
  text: string;
  fx: TitleFxId;
  before: boolean;
}

const done = (c: Character, quest: string): boolean => c.quests[quest]?.state === 'done';
const cleared = (c: Character, region: string, tier: number): boolean => Object.entries(c.clears).some(([k, n]) => n > 0 && k.startsWith(`${region}:`) && Number(k.slice(region.length + 1)) >= tier);
/** The story's own dungeons (not a memory with no last boss, not an interior). */
const DUNGEONS = (Object.values(REGIONS) as RegionDef[]).filter((r) => r.kind === 'dungeon' && !r.interior && r.encounters.some((e) => !!e.boss)).map((r) => r.id);

/** Each rank's light, climbing with it: a gleam for where everyone starts, Ashfire, the finest, for the top. */
const RANK_FX: Record<number, TitleFxId> = { 0: 'gleam', 1150: 'blood', 1300: 'ember', 1500: 'frost', 1700: 'arcane', 1900: 'radiant', 2100: 'ashfire' };

/** The light a rank's name wears (arena/ranks.ts), wherever it is shown. */
export const rankFx = (at: number): TitleFxId => RANK_FX[at] ?? 'gleam';

/** A rank as a title, before the name ("Unblooded Ash"): what the Ring shows of a fighter who wears none. */
export const rankTitle = (r: { at: number; name: string }): TitleShown => ({ text: r.name, fx: rankFx(r.at), before: true });

/** The Ring's ranks are titles too: each is earned at its rating and kept once reached (arena/ranks.ts; the first is where everyone starts). */
export const RING_TITLES: readonly { rating: number; id: string; name: string; fx: TitleFxId }[] = RANKS.filter((r) => r.at > 0).map((r) => ({ rating: r.at, id: `ring-${r.at}`, name: r.name, fx: rankFx(r.at) }));

export const TITLES: readonly TitleDef[] = [
  // the story
  { id: 'briarhollow', name: 'of Briarhollow', fx: 'verdant', how: 'Close the rift under the chapel.', earned: (c) => done(c, 'close-the-rift') },
  { id: 'champion', name: 'Champion of the Starfall', fx: 'gilded', how: 'Win the Starfall Festival.', earned: (c) => done(c, 'festival-the-champion') },
  { id: 'siegebreaker', name: 'the Siegebreaker', fx: 'ember', how: 'Break the siege of Highwall.', earned: (c) => done(c, 'general-morvain') },
  { id: 'seven', name: 'of the Seven Sigils', fx: 'arcane', how: 'Carry all seven Crown Sigils.', earned: (c) => SIGILS.every((s) => c.perks.includes(s)) },
  { id: 'kingslayer', name: 'the Kingslayer', fx: 'blood', how: 'Bring down the Hallow King.', earned: (c) => (c.bosses.vaelor ?? 0) > 0 },
  { id: 'warden', name: '', fx: 'radiant', how: 'See the whole story through: your class’s own.', earned: (c) => done(c, CAMPAIGN_END) },
  // the rare ones
  { id: 'well-travelled', name: 'the Well-Travelled', fx: 'gilded', how: 'Finish every quest in the land, the small ones too.', rare: true, earned: (c) => QUESTS.every((q) => done(c, q.id) || (c.quests[q.id]?.n ?? 0) < 0) && done(c, CAMPAIGN_END) },
  { id: 'unbowed', name: 'the Unbowed', fx: 'frost', how: 'See the story through having fallen fewer than ten times.', rare: true, earned: (c) => done(c, CAMPAIGN_END) && c.stats.deaths < 10 },
  { id: 'deathless', name: 'the Deathless', fx: 'void', how: `Reach level ${MAX_LEVEL} without ever falling.`, rare: true, earned: (c) => c.level >= MAX_LEVEL && c.stats.deaths === 0 },
  { id: 'kings-bane', name: 'Bane of the Hallow King', fx: 'storm', how: 'Clear Duskspire on Mythic.', rare: true, earned: (c) => cleared(c, 'duskspire', 2) },
  { id: 'deep-conqueror', name: 'Conqueror of the Deep', fx: 'void', how: 'Clear every dungeon of the story on Mythic.', rare: true, earned: (c) => DUNGEONS.every((r) => cleared(c, r, 2)) },
  { id: 'ten-thousand', name: 'Bane of Ten Thousand', fx: 'blood', how: 'Defeat ten thousand enemies.', rare: true, earned: (c) => c.stats.kills >= 10000 },
  { id: 'stablemaster', name: 'Stablemaster', fx: 'tide', how: 'Own eight mounts.', earned: (c) => c.mounts.length >= 8 },
  // the Rift
  { id: 'riftwalker', name: 'Riftwalker', fx: 'tide', how: 'Open Riftstone +5.', earned: (c) => c.keystone >= 5 },
  { id: 'riftbreaker', name: 'the Riftbreaker', fx: 'storm', how: 'Open Riftstone +15.', rare: true, earned: (c) => c.keystone >= 15 },
  { id: 'last-memory', name: 'Keeper of the Last Memory', fx: 'starfall', how: 'Open Riftstone +25.', rare: true, earned: (c) => c.keystone >= 25 },
  { id: 'exalted', name: 'the Exalted', fx: 'radiant', how: 'Reach Paragon 25.', rare: true, earned: (c) => c.para.l >= 25 },
  // the Ring (the best rating this device has seen the player reach)
  ...RING_TITLES.map((t): TitleDef => ({ id: t.id, name: t.name, fx: t.fx, before: true, how: `Reach ${t.rating} rating in The Ring.`, rare: t.rating >= 1700, earned: (_c, rating) => (rating ?? bestRating()) >= t.rating })),
];

const BY_ID: Record<string, TitleDef> = Object.fromEntries(TITLES.map((t) => [t.id, t]));

/* ------------------------------------------------------------------ given by an admin */

let given: TitleDef[] = [];

/** The titles the account has been given, as the site last heard (none for a guest). */
export function setGivenTitles(list: readonly SigilTitleGrant[] | null | undefined): void {
  given = (list ?? []).flatMap((g): TitleDef[] => {
    const name = cleanTitle(g?.name);
    if (!name || typeof g.id !== 'string' || !g.id) return [];
    return [{ id: `given-${g.id}`, name, fx: isTitleFx(g.fx) ? g.fx : 'gleam', before: !!g.before, given: true, rare: true, how: 'Given to you by the GlitchBound team.', earned: () => true }];
  });
}

/** Every title there is for this account: the game's own, then any it was given. */
export const allTitles = (): readonly TitleDef[] => (given.length ? [...TITLES, ...given] : TITLES);

const titleById = (id: string): TitleDef | undefined => BY_ID[id] ?? given.find((t) => t.id === id);

/* ------------------------------------------------------------------ wearing them */

/** A title's words for this hero (the warden's is their class's own). */
export const titleName = (t: TitleDef, c: Pick<Character, 'cls'>): string => (t.id === 'warden' ? WARDENS[c.cls].title : t.name);

/** A title as this hero shows it. */
export function titleShown(t: TitleDef, c: Pick<Character, 'cls'>): TitleShown {
  const text = titleName(t, c);
  return { text, fx: t.fx, before: t.before ?? !titleGoesAfter(text) };
}

/** The titles a hero has earned (and the account's given ones), in the list's order. */
export const earnedTitles = (c: Character, rating?: number): TitleDef[] => allTitles().filter((t) => t.earned(c, rating));

/** The title the hero wears, as shown: the one they chose while it stands, else their warden's once the story is done, else none. */
export function wornTitleShown(c: Character, rating?: number): TitleShown | null {
  if (c.title === '') return null;
  const chosen = c.title ? titleById(c.title) : undefined;
  if (chosen?.earned(c, rating)) return titleShown(chosen, c);
  return BY_ID.warden!.earned(c) ? titleShown(BY_ID.warden!, c) : null;
}

/** The words of the title the hero wears (see wornTitleShown). */
export const wornTitle = (c: Character, rating?: number): string | null => wornTitleShown(c, rating)?.text ?? null;

/** Chooses the title to wear ('' for none). Refused for one not earned. */
export function chooseTitle(c: Character, id: string, rating?: number): boolean {
  if (id !== '' && !titleById(id)?.earned(c, rating)) return false;
  c.title = id;
  return true;
}

/** Which way a title joins a name after it: "Ash the Kingslayer", "Ash, Champion of the Starfall". */
const joinAfter = (text: string): string => (/^(the|of) /i.test(text) ? ' ' : ', ');

/** A title given as words alone stands where its words say it does. */
const asShown = (title: TitleShown | string): TitleShown => (typeof title === 'string' ? { text: title, fx: 'plain', before: !titleGoesAfter(title) } : title);

/** A hero's name with their title, as it is written in words: "Blooded Ash", "Ash the Kingslayer", "Ash, Champion of the Starfall". */
export function titled(name: string, title: TitleShown | string | null): string {
  if (!title) return name;
  const t = asShown(title);
  if (!t.text) return name;
  return t.before ? `${t.text} ${name}` : `${name}${joinAfter(t.text)}${t.text}`;
}

/** The pieces of a titled name, for drawing the title in its light (ui/Titled.tsx): what comes before it, and after. */
export function titledParts(name: string, title: TitleShown | string): { title: TitleShown; before: string; after: string } {
  const t = asShown(title);
  return t.before ? { title: t, before: '', after: ` ${name}` } : { title: t, before: `${name}${joinAfter(t.text)}`, after: '' };
}

const seen = (id: string): string => `title:${id}`;

/**
 * The titles earned since the hero was last told of any (each is told once); marks them told. A title the account was
 * given is told of when it arrives, by the site (not once per hero, as each is first played).
 */
export function newTitles(c: Character, rating?: number): TitleDef[] {
  const fresh = TITLES.filter((t) => t.earned(c, rating) && !c.opened.includes(seen(t.id)));
  for (const t of fresh) c.opened.push(seen(t.id));
  return fresh;
}
