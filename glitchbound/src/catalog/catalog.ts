import { GAMES } from './games.ts';
import { CATEGORIES, type CategoryId, type GameEntry } from './types.ts';

export type SortId = 'newest' | 'az';
export const SORTS: Record<SortId, string> = { newest: 'Newest', az: 'A to Z' };

/** A game counts as NEW for this many days after release. */
export const NEW_FOR_DAYS = 30;

/**
 * Old slugs of renamed games (Unhinged is Crass Act since 2026-10-19, Riftbound is Sigilfall since 2026-10-22):
 * old links, saves and favorites still work.
 */
export const RENAMED_SLUGS: Readonly<Record<string, string>> = { unhinged: 'crass-act', riftbound: 'sigilfall' };
export const currentSlug = (slug: string): string => RENAMED_SLUGS[slug] ?? slug;

export function getGame(slug: string, games: GameEntry[] = GAMES): GameEntry | undefined {
  return games.find((g) => g.slug === slug);
}

/** Whether a game is listed in the arcade (Party Mode games and games with a section of their own are not). */
export const inArcade = (g: GameEntry): boolean => !g.partyOnly && !g.section;

/** Games with a section of their own (a tab next to Arcade and Party). */
export const SECTION_GAMES: readonly GameEntry[] = GAMES.filter((g) => g.section);

/** The game whose section lives at this path ("/sigilfall", or a renamed game's old one: "/riftbound"), if any. */
export function sectionGame(path: string): GameEntry | undefined {
  const g = SECTION_GAMES.find((x) => x.section?.path === path);
  const old = g ? undefined : /^\/([a-z0-9-]+)$/.exec(path)?.[1];
  return g ?? (old && RENAMED_SLUGS[old] ? SECTION_GAMES.find((x) => x.slug === RENAMED_SLUGS[old]) : undefined);
}

/** Where a game's page lives: its section, or /games/<slug>. */
export const gamePath = (g: GameEntry): string => g.section?.path ?? `/games/${g.slug}`;

export function isCategory(value: string | null | undefined): value is CategoryId {
  return !!value && Object.hasOwn(CATEGORIES, value);
}

export function isNew(game: GameEntry, today: Date = new Date(), days = NEW_FOR_DAYS): boolean {
  const released = Date.parse(`${game.released}T00:00:00Z`);
  const age = (today.getTime() - released) / 86_400_000;
  return age >= -1 && age < days;
}

/** At most this many games carry the automatic NEW badge, so it still means something when many launch together. */
export const NEW_MAX = 3;

/**
 * The games with an automatic NEW badge: the latest releases still within their 30 days, newest first
 * (games released the same day: the one added to the catalog last counts as newer).
 */
export function autoNewSlugs(games: readonly GameEntry[], today: Date = new Date(), max = NEW_MAX): Set<string> {
  const fresh = games.map((g, i) => ({ g, i })).filter(({ g }) => isNew(g, today));
  fresh.sort((a, b) => b.g.released.localeCompare(a.g.released) || b.i - a.i);
  return new Set(fresh.slice(0, max).map(({ g }) => g.slug));
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Relevance of a game for a query: 0 means no match. Every query word must match somewhere. */
export function matchScore(game: GameEntry, query: string): number {
  const words = normalize(query).split(' ').filter(Boolean);
  if (words.length === 0) return 1;
  const title = normalize(game.title);
  const cats = game.categories.map((c) => normalize(CATEGORIES[c].label)).join(' ');
  const tags = game.tags.map(normalize).join(' ');
  const text = normalize(`${game.tagline} ${game.description}`);
  let score = 0;
  for (const w of words) {
    if (title.startsWith(w)) score += 12;
    else if (title.includes(w)) score += 8;
    else if (cats.includes(w)) score += 5;
    else if (tags.includes(w)) score += 4;
    else if (text.includes(w)) score += 1;
    else return 0;
  }
  return score;
}

export interface Query {
  q?: string;
  category?: CategoryId | null;
  sort?: SortId;
}

export function queryGames({ q = '', category = null, sort = 'newest' }: Query, games: GameEntry[] = GAMES): GameEntry[] {
  const hits = games
    .filter((g) => !category || g.categories.includes(category))
    .map((g) => ({ g, s: matchScore(g, q) }))
    .filter((x) => x.s > 0);
  hits.sort((a, b) => {
    if (q.trim() && b.s !== a.s) return b.s - a.s;
    if (sort === 'az') return a.g.title.localeCompare(b.g.title);
    return b.g.released.localeCompare(a.g.released) || a.g.title.localeCompare(b.g.title);
  });
  return hits.map((x) => x.g);
}

/** Categories that contain at least one game, with counts, in CATEGORIES order. */
export function categoryCounts(games: GameEntry[] = GAMES): { id: CategoryId; label: string; count: number }[] {
  return (Object.keys(CATEGORIES) as CategoryId[])
    .map((id) => ({ id, label: CATEGORIES[id].label, count: games.filter((g) => g.categories.includes(id)).length }))
    .filter((c) => c.count > 0);
}

/** Other games that share a category, best matches first. */
export function relatedGames(game: GameEntry, limit = 4, games: GameEntry[] = GAMES): GameEntry[] {
  return games
    .filter((g) => g.slug !== game.slug)
    .map((g) => ({ g, shared: g.categories.filter((c) => game.categories.includes(c)).length }))
    .sort((a, b) => b.shared - a.shared || b.g.released.localeCompare(a.g.released))
    .slice(0, limit)
    .map((x) => x.g);
}

export function latestGame(games: GameEntry[] = GAMES): GameEntry | undefined {
  return queryGames({ sort: 'newest' }, games)[0];
}

/** Paths of the site's own pages, which a section can never take. */
const RESERVED_PATHS = new Set(['/daily', '/privacy', '/terms', '/about', '/contact', '/leaderboards', '/me', '/party', '/admin', '/signin', '/discord', '/games', '/play', '/api', '/index']);

/** Returns a list of problems with the registry; empty when everything is valid. Runs in tests and at build time. */
export function validateCatalog(games: GameEntry[] = GAMES): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const g of games) {
    const at = `game "${g.slug}"`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.slug)) errors.push(`${at}: slug must be lowercase-kebab`);
    if (seen.has(g.slug)) errors.push(`${at}: duplicate slug`);
    seen.add(g.slug);
    if (!g.title.trim()) errors.push(`${at}: missing title`);
    if (g.tagline.length > 110) errors.push(`${at}: tagline longer than 110 characters`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g.released) || Number.isNaN(Date.parse(g.released))) errors.push(`${at}: released must be YYYY-MM-DD`);
    for (const c of g.categories) if (!isCategory(c)) errors.push(`${at}: unknown category "${c}"`);
    if (!g.stats.some((s) => s.key === 'score')) errors.push(`${at}: stats must include "score"`);
    for (const d of g.daily ?? []) {
      if (!g.stats.some((s) => s.key === d.metric)) errors.push(`${at}: daily metric "${d.metric}" is not in stats`);
      if (d.targets.length === 0 || d.targets.some((t) => !(t > 0))) errors.push(`${at}: daily targets must be positive`);
      if (!d.label.includes('{n}')) errors.push(`${at}: daily label must contain {n}`);
      if (d.one !== undefined && !d.one.includes('{n}')) errors.push(`${at}: daily "one" text must contain {n}`);
    }
    if (g.ownDaily && !g.ownDaily.label.trim()) errors.push(`${at}: ownDaily needs a label`);
    if (g.menu && g.menu !== 'own' && [g.menu.x ?? 0, g.menu.y ?? 0].some((n) => !(n >= 0 && n <= 240))) errors.push(`${at}: menu offsets must be 0-240 px`);
    if (g.runtime.kind === 'embed') {
      if (g.runtime.url.startsWith('/')) {
        if (!g.runtime.origins.includes('self')) errors.push(`${at}: a same-site embed must list 'self' in origins`);
      } else {
        try {
          const origin = new URL(g.runtime.url).origin;
          if (!g.runtime.origins.includes(origin)) errors.push(`${at}: embed origins must include ${origin}`);
        } catch {
          errors.push(`${at}: embed url is not a valid URL`);
        }
      }
    }
    for (const p of [g.art.tile, g.art.wide]) if (!p.startsWith('/')) errors.push(`${at}: art paths must start with /`);
    if (g.section) {
      if (!/^\/[a-z]{3,20}$/.test(g.section.path) || RESERVED_PATHS.has(g.section.path)) errors.push(`${at}: section path must be a free /word`);
      if (!g.section.label.trim()) errors.push(`${at}: section needs a label`);
      if (g.partyOnly) errors.push(`${at}: a game is either in Party Mode or a section of its own`);
    }
  }
  return errors;
}
