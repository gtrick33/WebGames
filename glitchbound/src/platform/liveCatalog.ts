/**
 * The catalog as players should see it right now: games.ts plus the admins' settings from
 * /api/catalog (hidden games, NEW badges, pinned order, spotlight, text, daily picks, site notice).
 * The last copy is kept in localStorage so pages render with it instantly; a fresh copy is fetched
 * on load and when the tab comes back into view.
 */
import { useSyncExternalStore } from 'react';
import { autoNewSlugs } from '../catalog/catalog';
import { GAMES } from '../catalog/games';
import { applySettings, dailyRules, EMPTY_CATALOG, settingsFor, spotlightGame, type GameSettings, type HomeLayout, type PublicCatalog } from '../catalog/settings';
import type { GameEntry } from '../catalog/types';
import { setDefaultDailyRules } from './daily';

const KEY = 'glitchbound.catalog';

export interface LiveCatalog {
  raw: PublicCatalog;
  /** What players see: hidden games removed, pinned first, text overrides applied. */
  games: GameEntry[];
  /** Every game with overrides applied (admin views and hidden-game previews). */
  all: GameEntry[];
  settings: (slug: string) => GameSettings;
  spotlight: GameEntry | undefined;
  /** The admins' home page banner layout, or null for the automatic one. */
  layout: HomeLayout | null;
}

function derive(raw: PublicCatalog): LiveCatalog {
  setDefaultDailyRules(dailyRules(raw));
  return {
    raw,
    games: applySettings(GAMES, raw),
    all: applySettings(GAMES, raw, true),
    settings: (slug) => settingsFor(raw, slug),
    spotlight: spotlightGame(applySettings(GAMES, raw), raw),
    layout: raw.layout ?? null,
  };
}

function readCache(): PublicCatalog {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as PublicCatalog | null;
    if (v && typeof v === 'object' && v.settings && v.picks) return v;
  } catch {
    /* no cache */
  }
  return EMPTY_CATALOG;
}

let state: LiveCatalog = derive(typeof window === 'undefined' ? EMPTY_CATALOG : readCache());
const listeners = new Set<() => void>();

export function setCatalog(raw: PublicCatalog): void {
  state = derive(raw);
  try {
    localStorage.setItem(KEY, JSON.stringify(raw));
  } catch {
    /* blocked storage */
  }
  for (const fn of listeners) fn();
}

let inflight: Promise<void> | null = null;

/** Fetches the latest settings (never throws; the cached copy stays on failure). */
export function refreshCatalog(): Promise<void> {
  inflight ??= fetch('/api/catalog', { credentials: 'same-origin', cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<PublicCatalog>) : null))
    .then((raw) => {
      if (raw && raw.settings && raw.picks) setCatalog(raw);
    })
    .catch(() => undefined)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Starts fetching and keeps the copy fresh when the player returns to the tab. */
export function startLiveCatalog(): void {
  if (typeof window === 'undefined') return;
  void refreshCatalog();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void refreshCatalog();
  });
}

export const getLiveCatalog = (): LiveCatalog => state;

export function useLiveCatalog(): LiveCatalog {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
    () => state,
  );
}

/** The games players can see, in display order. */
export const useGames = (): GameEntry[] => useLiveCatalog().games;

/** NEW badge for a game: the admins' choice, or automatic (the three newest games, for 30 days after release). */
export function isNewLive(cat: LiveCatalog, game: GameEntry, today?: Date): boolean {
  const badge = cat.settings(game.slug).newBadge;
  return badge === 'on' ? true : badge === 'off' ? false : autoNewSlugs(cat.games, today).has(game.slug);
}
