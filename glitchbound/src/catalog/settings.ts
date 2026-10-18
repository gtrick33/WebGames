/**
 * Admin overrides for the catalog: how each game is shown (hidden, NEW badge, pinned, spotlight,
 * text), which games the daily challenge may pick, hand-picked daily challenges and a site notice.
 * Games themselves still come from games.ts; these settings live in D1 and are applied at runtime,
 * so admins can change them without a rebuild. Pure: shared by the browser and the server.
 */
import type { GameEntry } from './types';

export type NewBadge = 'auto' | 'on' | 'off';

export interface GameSettings {
  /** Not listed anywhere; the game page is closed to players (admins can still preview it). */
  hidden: boolean;
  /** NEW badge: automatic (first 30 days after release), always or never. */
  newBadge: NewBadge;
  /** Shown first in the arcade grid. */
  pinned: boolean;
  /** The big featured game on the home page (one at a time). */
  spotlight: boolean;
  /** May be picked as "Today's challenge". */
  inDaily: boolean;
  /** Non-empty: the game is temporarily unavailable and players see this message. */
  maintenance: string;
  /** Text overrides ('' = the text from games.ts). */
  title: string;
  tagline: string;
  description: string;
}

export const DEFAULT_SETTINGS: GameSettings = {
  hidden: false,
  newBadge: 'auto',
  pinned: false,
  spotlight: false,
  inDaily: true,
  maintenance: '',
  title: '',
  tagline: '',
  description: '',
};

/** A daily challenge chosen by an admin for one date. */
export interface DailyPick {
  slug: string;
  /** Index into the game's daily templates; null = automatic. */
  template: number | null;
  /** Target to reach; null = the template's automatic target. */
  target: number | null;
}

export type NoticeTone = 'info' | 'warning' | 'party';

/** A banner shown across the site (players can dismiss it). */
export interface Notice {
  /** Changes whenever the notice is edited, so a dismissed banner comes back when it changes. */
  id: string;
  text: string;
  /** Optional link: a site path (/games/...) or an https URL. */
  link: string;
  tone: NoticeTone;
}

/** What GET /api/catalog returns. */
export interface PublicCatalog {
  settings: Record<string, Partial<GameSettings>>;
  picks: Record<string, DailyPick>;
  notice: Notice | null;
}

export const EMPTY_CATALOG: PublicCatalog = { settings: {}, picks: {}, notice: null };

/** Rules for the daily challenge rotation. */
export interface DailyRules {
  /** Hand-picked challenges by date. */
  picks: Record<string, DailyPick>;
  /** Games the rotation must skip (hidden, paused or taken out of the daily). */
  exclude: ReadonlySet<string>;
}

export function settingsFor(cat: PublicCatalog, slug: string): GameSettings {
  return { ...DEFAULT_SETTINGS, ...cat.settings[slug] };
}

/** The games players see: text overrides applied, hidden games removed, pinned games first. */
export function applySettings(games: readonly GameEntry[], cat: PublicCatalog, includeHidden = false): GameEntry[] {
  const out: { g: GameEntry; pinned: boolean; i: number }[] = [];
  games.forEach((g, i) => {
    const s = settingsFor(cat, g.slug);
    if (s.hidden && !includeHidden) return;
    const merged = s.title || s.tagline || s.description ? { ...g, title: s.title || g.title, tagline: s.tagline || g.tagline, description: s.description || g.description } : g;
    out.push({ g: merged, pinned: s.pinned, i });
  });
  out.sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.i - b.i);
  return out.map((x) => x.g);
}

export function dailyRules(cat: PublicCatalog): DailyRules {
  const exclude = new Set<string>();
  for (const [slug, s] of Object.entries(cat.settings)) if (s.hidden || s.inDaily === false || s.maintenance) exclude.add(slug);
  return { picks: cat.picks, exclude };
}

/** The spotlight game for the home page, if an admin chose one that players can see. */
export function spotlightGame(games: readonly GameEntry[], cat: PublicCatalog): GameEntry | undefined {
  return games.find((g) => settingsFor(cat, g.slug).spotlight);
}

/* -------------------------------------------------------------- validation */

const clean = (v: unknown, max: number): string =>
  typeof v === 'string'
    ? [...v]
        .filter((ch) => ch.charCodeAt(0) >= 32 || ch === '\n')
        .join('')
        .trim()
        .slice(0, max)
    : '';

export const TEXT_LIMITS = { title: 40, tagline: 110, description: 600, maintenance: 200, notice: 220 } as const;

/** Keeps only valid fields of a settings patch from the admin panel. */
export function sanitizePatch(body: unknown): Partial<GameSettings> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const out: Partial<GameSettings> = {};
  for (const k of ['hidden', 'pinned', 'spotlight', 'inDaily'] as const) if (typeof b[k] === 'boolean') out[k] = b[k];
  if (b.newBadge === 'auto' || b.newBadge === 'on' || b.newBadge === 'off') out.newBadge = b.newBadge;
  for (const k of ['maintenance', 'title', 'tagline', 'description'] as const) if (typeof b[k] === 'string') out[k] = clean(b[k], TEXT_LIMITS[k]);
  return out;
}

/** Stored form: only fields that differ from the defaults. */
export function compactSettings(s: GameSettings): Partial<GameSettings> {
  const out: Partial<GameSettings> = {};
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof GameSettings)[]) if (s[k] !== DEFAULT_SETTINGS[k]) (out as Record<string, unknown>)[k] = s[k];
  return out;
}

/** A valid pick for a game that offers daily challenges, or null. */
export function sanitizePick(body: unknown, games: readonly GameEntry[]): DailyPick | null {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const game = games.find((g) => g.slug === b.slug);
  if (!game?.daily?.length) return null;
  const template = typeof b.template === 'number' && Number.isInteger(b.template) && b.template >= 0 && b.template < game.daily.length ? b.template : null;
  const target = typeof b.target === 'number' && Number.isFinite(b.target) && b.target > 0 && b.target < 1e9 ? Math.round(b.target * 100) / 100 : null;
  return { slug: game.slug, template, target };
}

export function sanitizeNotice(body: unknown, now: number): Notice | null {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const text = clean(b.text, TEXT_LIMITS.notice).replace(/\n+/g, ' ');
  if (!text) return null;
  const rawLink = clean(b.link, 300);
  const link = /^\/[a-z0-9/_\-?=&#.]*$/i.test(rawLink) || /^https:\/\/[^\s"'<>]+$/i.test(rawLink) ? rawLink : '';
  const tone: NoticeTone = b.tone === 'warning' || b.tone === 'party' ? b.tone : 'info';
  return { id: now.toString(36), text, link, tone };
}

export const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
