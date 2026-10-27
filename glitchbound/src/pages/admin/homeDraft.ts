import { queryGames } from '../../catalog/catalog';
import { toggleFlagship } from '../../catalog/flagships';
import { GAMES } from '../../catalog/games';
import { applySettings, compactSettings, DEFAULT_SETTINGS, orderByLayout, settingsFor, type GameSettings, type HomeLayout, type PublicCatalog } from '../../catalog/settings';
import type { GameEntry } from '../../catalog/types';
import type { AdminCatalog } from '../../platform/apiTypes';
import { bestPool, savedBest } from '../AdminBest';
import { savedMultiplayer } from '../AdminMultiplayer';

/**
 * Admin › Home page edits one draft of everything the home page shows: the banners' order and looks, every
 * arcade game's settings (visible, pinned, spotlight, NEW badge, daily rotation, texts, pause), Our best games
 * and the live games row. Nothing reaches players until Publish, which sends the differences in one go
 * ({ action: 'publish' }, functions/api/admin/catalog.ts). The preview shows the draft as players would.
 */
export interface HomeDraft {
  /** The banners' order, sizes, colors and stickers (null: the automatic layout). */
  layout: HomeLayout | null;
  /** Every arcade game's settings as they will be. */
  games: Record<string, GameSettings>;
  /** Our best games, in order. */
  flagships: string[];
  /** The live games row, in order ([] hides it). */
  multiplayer: string[];
}

export const emptyLayout = (): HomeLayout => ({ order: [], sizes: {}, accents: {}, stickers: {} });

/** The games the banner editor shows: every arcade game (hidden ones too), newest first. */
export const editableGames = (cat: PublicCatalog): GameEntry[] => queryGames({ sort: 'newest' }, applySettings(GAMES, cat, true).filter((g) => !g.partyOnly && !g.section));

/** What is live now, as a draft to start from. */
export function savedDraft(data: AdminCatalog): HomeDraft {
  const games: Record<string, GameSettings> = {};
  for (const g of editableGames(data)) games[g.slug] = settingsFor(data, g.slug);
  return { layout: data.layout ?? null, games, flagships: savedBest(data), multiplayer: savedMultiplayer(data) };
}

/** The stored form of a layout: the full order of the games shown, and only real choices in the maps. */
export const normalLayout = (l: HomeLayout, games: readonly GameEntry[]): HomeLayout => ({ order: orderByLayout(games, l).map((g) => g.slug), sizes: l.sizes, accents: l.accents, stickers: l.stickers });

/** The catalog players would get if the draft were published (the preview frame shows exactly this). */
export function draftCatalog(data: AdminCatalog, draft: HomeDraft): PublicCatalog {
  const { log: _log, ...cat } = data;
  void _log;
  const settings = { ...cat.settings };
  for (const [slug, s] of Object.entries(draft.games)) {
    const c = compactSettings(s);
    if (Object.keys(c).length) settings[slug] = c;
    else delete settings[slug];
  }
  return { ...cat, settings, layout: draft.layout, flagships: draft.flagships, multiplayer: draft.multiplayer };
}

export interface HomeChanges {
  /** Per game, only the fields that change. */
  games: Record<string, Partial<GameSettings>>;
  /** Present when it changes (null: back to the automatic layout). */
  layout?: HomeLayout | null;
  flagships?: string[];
  multiplayer?: string[];
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The difference between the draft and what is live: what Publish sends. */
export function draftChanges(data: AdminCatalog, draft: HomeDraft): HomeChanges {
  const saved = savedDraft(data);
  const out: HomeChanges = { games: {} };
  for (const [slug, s] of Object.entries(draft.games)) {
    const before = saved.games[slug] ?? DEFAULT_SETTINGS;
    const patch: Partial<GameSettings> = {};
    for (const k of Object.keys(s) as (keyof GameSettings)[]) if (s[k] !== before[k] && k !== 'flagship') (patch as Record<string, unknown>)[k] = s[k];
    if (Object.keys(patch).length) out.games[slug] = patch;
  }
  const games = editableGames(draftCatalog(data, draft));
  const layout = draft.layout && normalLayout(draft.layout, games);
  const savedLayout = saved.layout && normalLayout(saved.layout, games);
  if (!same(layout, savedLayout)) out.layout = layout;
  if (!same(draft.flagships, saved.flagships)) out.flagships = draft.flagships;
  if (!same(draft.multiplayer, saved.multiplayer)) out.multiplayer = draft.multiplayer;
  return out;
}

const LABEL: Partial<Record<keyof GameSettings, (v: unknown) => string>> = {
  hidden: (v) => (v ? 'hidden' : 'visible'),
  pinned: (v) => (v ? 'pinned' : 'unpinned'),
  spotlight: (v) => (v ? 'today’s pick' : 'not today’s pick'),
  inDaily: (v) => (v ? 'in the daily rotation' : 'out of the daily rotation'),
  newBadge: (v) => `NEW badge ${v === 'auto' ? 'automatic' : v}`,
  maintenance: (v) => (v ? 'paused' : 'playable'),
  title: () => 'title',
  tagline: () => 'tagline',
  description: () => 'description',
};

/** The changes in a few words each, for the publish bar ("Gloop: pinned, hidden"). */
export function describeChanges(changes: HomeChanges, data: AdminCatalog): string[] {
  const title = (slug: string): string => GAMES.find((g) => g.slug === slug)?.title ?? slug;
  const lines = Object.entries(changes.games).map(([slug, p]) => `${title(slug)}: ${(Object.entries(p) as [keyof GameSettings, unknown][]).map(([k, v]) => LABEL[k]?.(v) ?? k).join(', ')}`);
  if ('layout' in changes) lines.push(changes.layout ? 'Banners: order and looks' : 'Banners: back to automatic');
  if (changes.flagships) lines.push(`Our best games: ${changes.flagships.map(title).join(', ')}`);
  if (changes.multiplayer) lines.push(changes.multiplayer.length ? `Live games row: ${changes.multiplayer.map(title).join(', ')}` : 'Live games row: hidden');
  void data;
  return lines;
}

/** One game's settings changed in the draft (one spotlight at a time, as on the server). */
export function withGame(draft: HomeDraft, slug: string, patch: Partial<GameSettings>): HomeDraft {
  const games = { ...draft.games, [slug]: { ...(draft.games[slug] ?? DEFAULT_SETTINGS), ...patch } };
  if (patch.spotlight) for (const k of Object.keys(games)) if (k !== slug && games[k]!.spotlight) games[k] = { ...games[k]!, spotlight: false };
  // a hidden game can't be one of the best games
  const flagships = patch.hidden ? draft.flagships.filter((s) => s !== slug) : draft.flagships;
  return { ...draft, games, flagships };
}

/** A game switched in or out of Our best games (in takes the last card; out lets a house pick fill in). */
export function withBest(data: AdminCatalog, draft: HomeDraft, slug: string, on: boolean): HomeDraft {
  const pool = bestPool(draftCatalog(data, draft) as AdminCatalog);
  return { ...draft, flagships: toggleFlagship(pool, draft.flagships, slug, on) };
}
