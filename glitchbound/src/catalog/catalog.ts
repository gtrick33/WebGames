import { GAMES } from './games.ts';
import { CATEGORIES, type CategoryId, type GameEntry } from './types.ts';

export type SortId = 'newest' | 'az';
export const SORTS: Record<SortId, string> = { newest: 'Newest', az: 'A to Z' };

/** A game counts as NEW for this many days after release. */
export const NEW_FOR_DAYS = 30;

export function getGame(slug: string, games: GameEntry[] = GAMES): GameEntry | undefined {
  return games.find((g) => g.slug === slug);
}

export function isCategory(value: string | null | undefined): value is CategoryId {
  return !!value && Object.hasOwn(CATEGORIES, value);
}

export function isNew(game: GameEntry, today: Date = new Date(), days = NEW_FOR_DAYS): boolean {
  const released = Date.parse(`${game.released}T00:00:00Z`);
  const age = (today.getTime() - released) / 86_400_000;
  return age >= -1 && age < days;
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
    }
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
  }
  return errors;
}
