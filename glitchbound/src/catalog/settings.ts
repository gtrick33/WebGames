/**
 * Admin overrides for the catalog: how each game is shown (hidden, NEW badge, pinned, spotlight,
 * text), which games the daily challenge may pick, hand-picked daily challenges and a site notice.
 * Games themselves still come from games.ts; these settings live in D1 and are applied at runtime,
 * so admins can change them without a rebuild. Pure: shared by the browser and the server.
 */
import type { SeasonSetting } from '../platform/seasons';
import type { Accent, GameEntry } from './types';

export type NewBadge = 'auto' | 'on' | 'off';

export interface GameSettings {
  /** Not listed anywhere; the game page is closed to players (admins can still preview it). */
  hidden: boolean;
  /** NEW badge: automatic (the three newest games, for 30 days after release), always or never. */
  newBadge: NewBadge;
  /** Shown first in the arcade grid. */
  pinned: boolean;
  /** The big featured game on the home page (one at a time). */
  spotlight: boolean;
  /**
   * Before the best games became a list of their own (PublicCatalog.flagships): one of the "Start here"
   * games. Still read when no list was saved; never written any more.
   */
  flagship: boolean;
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
  flagship: false,
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

/** Banner sizes in the arcade grid (12 columns): small 1/4, wide 1/2, tall 1/4 double height, big 1/2 double height (a third, half, third and two thirds on mid-size screens). */
export type TileSize = 'md' | 'wide' | 'tall' | 'xl';
export const TILE_SIZES: TileSize[] = ['md', 'wide', 'tall', 'xl'];

/** Shape rhythm used for games without a chosen size, so the grid never looks like identical boxes. */
export const TILE_RHYTHM: TileSize[] = ['xl', 'md', 'md', 'md', 'md', 'wide', 'md', 'md', 'md', 'md', 'md', 'tall', 'md', 'md'];

export const ACCENTS: Accent[] = ['cyan', 'magenta', 'blue', 'orange', 'lime', 'coral', 'yellow', 'teal', 'violet'];

/** How the arcade on the home page lays out its banners (set in the admin Games tab). */
export interface HomeLayout {
  /** Game slugs in display order; games not listed follow, newest first. */
  order: string[];
  /** Banner size per game (missing = the automatic rhythm). */
  sizes: Record<string, TileSize>;
  /** Banner color per game (missing = the game's own). */
  accents: Record<string, Accent>;
  /** Short sticker on the banner, e.g. "Hot" (missing = none, or NEW when due). */
  stickers: Record<string, string>;
}

export const STICKER_MAX = 14;

/** How a Party Mode game is shown on the party page (set in the admin's Party view). */
export interface PartySettings {
  /** Left out of Party Mode entirely. */
  hidden: boolean;
  /** One of the big cards at the top (none chosen = Impostor and Crass Act). */
  featured: boolean;
  /** Its live room can be opened (games that have one). */
  room: boolean;
  /** Short sticker on its cards, e.g. "Hot" ('' = none, or the game's own on a featured card). */
  sticker: string;
  /** Text overrides ('' = the text from src/party/catalog.ts). */
  title: string;
  blurb: string;
}

export const DEFAULT_PARTY_SETTINGS: PartySettings = { hidden: false, featured: false, room: true, sticker: '', title: '', blurb: '' };

/** What GET /api/catalog returns. */
export interface PublicCatalog {
  /** Party Mode games by id (older cached copies may not have it). */
  party?: Record<string, Partial<PartySettings>>;
  settings: Record<string, Partial<GameSettings>>;
  picks: Record<string, DailyPick>;
  notice: Notice | null;
  /** Older cached copies may not have it. */
  layout?: HomeLayout | null;
  /** The holiday look (missing = automatic, by the calendar). */
  season?: SeasonSetting;
  /** The home page's "Start here" games in order (missing or null = the house picks). */
  flagships?: string[] | null;
  /** The home page's "Live multiplayer games" in order (missing or null = every live game, [] = hidden). */
  multiplayer?: string[] | null;
}

export const EMPTY_CATALOG: PublicCatalog = { settings: {}, picks: {}, notice: null, layout: null };

/** Orders games for the arcade's default view: the admins' order first, then the rest as given. */
export function orderByLayout<T extends { slug: string }>(games: readonly T[], layout: HomeLayout | null | undefined): T[] {
  if (!layout?.order.length) return [...games];
  const at = new Map(layout.order.map((slug, i) => [slug, i]));
  return games
    .map((g, i) => ({ g, i, k: at.get(g.slug) }))
    .sort((a, b) => (a.k ?? Infinity) - (b.k ?? Infinity) || a.i - b.i)
    .map((x) => x.g);
}

/** The banner size for the game at position `index` of the grid. */
export const tileSizeFor = (layout: HomeLayout | null | undefined, slug: string, index: number): TileSize => layout?.sizes[slug] ?? TILE_RHYTHM[index % TILE_RHYTHM.length]!;

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

export function partySettingsFor(cat: PublicCatalog, id: string): PartySettings {
  return { ...DEFAULT_PARTY_SETTINGS, ...cat.party?.[id] };
}

/**
 * The games players see in the arcade: text overrides applied, hidden, party-only and section games removed,
 * pinned games first. `includeHidden` keeps them all (game pages, admin views).
 */
export function applySettings(games: readonly GameEntry[], cat: PublicCatalog, includeHidden = false): GameEntry[] {
  const out: { g: GameEntry; pinned: boolean; i: number }[] = [];
  games.forEach((g, i) => {
    const s = settingsFor(cat, g.slug);
    if ((s.hidden || g.partyOnly || g.section) && !includeHidden) return;
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

/** Keeps only valid fields of a Party Mode settings patch. */
export function sanitizePartyPatch(body: unknown): Partial<PartySettings> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const out: Partial<PartySettings> = {};
  for (const k of ['hidden', 'featured', 'room'] as const) if (typeof b[k] === 'boolean') out[k] = b[k];
  if (typeof b.sticker === 'string') out.sticker = clean(b.sticker, STICKER_MAX).replace(/\n+/g, ' ');
  if (typeof b.title === 'string') out.title = clean(b.title, TEXT_LIMITS.title).replace(/\n+/g, ' ');
  if (typeof b.blurb === 'string') out.blurb = clean(b.blurb, TEXT_LIMITS.tagline).replace(/\n+/g, ' ');
  return out;
}

/** Stored form of Party Mode settings: only what differs from the defaults. */
export function compactParty(s: PartySettings): Partial<PartySettings> {
  const out: Partial<PartySettings> = {};
  for (const k of Object.keys(DEFAULT_PARTY_SETTINGS) as (keyof PartySettings)[]) if (s[k] !== DEFAULT_PARTY_SETTINGS[k]) (out as Record<string, unknown>)[k] = s[k];
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

/** A valid best games list: known arcade games, no repeats, at most four (null when empty). */
export function sanitizeFlagships(body: unknown, games: readonly GameEntry[], max = 4): string[] | null {
  if (!Array.isArray(body)) return null;
  const ok = new Set(games.filter((g) => !g.partyOnly && !g.section).map((g) => g.slug));
  const out = [...new Set(body.filter((x): x is string => typeof x === 'string' && ok.has(x)))].slice(0, max);
  return out.length ? out : null;
}

/** A valid layout for known games (unknown slugs, sizes and colors are dropped), or null when empty. */
export function sanitizeLayout(body: unknown, games: readonly GameEntry[]): HomeLayout | null {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const known = new Set(games.map((g) => g.slug));
  const order = Array.isArray(b.order) ? [...new Set(b.order.filter((x): x is string => typeof x === 'string' && known.has(x)))] : [];
  const pickMap = <T>(v: unknown, ok: (x: unknown) => x is T): Record<string, T> => {
    const out: Record<string, T> = {};
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (known.has(k) && ok(x)) out[k] = x;
    return out;
  };
  const sizes = pickMap(b.sizes, (x): x is TileSize => TILE_SIZES.includes(x as TileSize));
  const accents = pickMap(b.accents, (x): x is Accent => ACCENTS.includes(x as Accent));
  const stickers: Record<string, string> = {};
  for (const [k, v] of Object.entries(pickMap(b.stickers, (x): x is string => typeof x === 'string'))) {
    const t = clean(v, STICKER_MAX).replace(/\n+/g, ' ');
    if (t) stickers[k] = t;
  }
  const empty = !order.length && !Object.keys(sizes).length && !Object.keys(accents).length && !Object.keys(stickers).length;
  return empty ? null : { order, sizes, accents, stickers };
}

export const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
