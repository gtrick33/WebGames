/**
 * The game registry schema. Everything the arcade shell knows about a game lives in one GameEntry.
 * This file must stay free of React and browser APIs: vite.config.ts imports the catalog at build
 * time to generate per-game HTML pages, the sitemap and robots.txt.
 */
import type { ContentLang } from '../platform/contentLang.ts';

export const CATEGORIES = {
  arcade: { label: 'Arcade', blurb: 'Fast hands, short rounds.' },
  racing: { label: 'Racing', blurb: 'Speed, lanes and near misses.' },
  puzzle: { label: 'Puzzle', blurb: 'Logic and visual brain teasers.' },
  word: { label: 'Word', blurb: 'Letters, guesses and daily words.' },
  trivia: { label: 'Trivia', blurb: 'Facts, flags and geography.' },
  strategy: { label: 'Strategy', blurb: 'Plan a few moves ahead.' },
  party: { label: 'Party', blurb: 'Play together with friends, online.' },
  experimental: { label: 'Experimental', blurb: 'Odd ideas that turned out fun.' },
} as const;

export type CategoryId = keyof typeof CATEGORIES;

/**
 * Moods: the simple way into the arcade on the home page ("what do you feel like?"), wider than
 * categories and written for players, not librarians. A game can have several.
 */
export const MOODS = {
  quick: { emoji: '⚡', label: 'Quick rounds' },
  brainy: { emoji: '🧠', label: 'Brain teasers' },
  chill: { emoji: '🌿', label: 'Chill' },
  action: { emoji: '🔥', label: 'Action' },
  friends: { emoji: '🎉', label: 'With friends' },
} as const;

export type MoodId = keyof typeof MOODS;

/** Brand accent used for the game's tile, stickers and page highlights. */
export type Accent = 'cyan' | 'magenta' | 'blue' | 'orange' | 'lime' | 'coral' | 'yellow' | 'teal' | 'violet';

/** A number the game reports at the end of a round, e.g. score or distance. */
export interface StatDef {
  /** "score" is the main result; other keys must match the `stats` object the game reports. */
  key: string;
  label: string;
  /** Unit suffix shown after the number, e.g. "m". */
  unit?: string;
  /** Whether a lower value is better (e.g. time in seconds). Defaults to higher is better. */
  lowerIsBetter?: boolean;
}

/** A daily challenge the platform may pick for this game on a given day. */
export interface DailyTemplate {
  /** Stat key from `stats` (or "score") that the run must reach. */
  metric: string;
  /** Candidate targets; one is picked deterministically per day. */
  targets: number[];
  /** Human text. `{n}` is replaced with the formatted target. */
  label: string;
  /** The text for a target of 1, when `label` would read wrong ("Clear {n} picture" for "Clear {n} pictures"). */
  one?: string;
}

/**
 * How the arcade runs the game.
 * - `embed`: the game is its own deployed site, shown in an iframe. It reports rounds with postMessage
 *   (see src/platform/bridge.ts and docs/ADDING-A-GAME.md).
 * - `module`: the game is a React component inside this repo, lazy-loaded from src/catalog/modules.ts.
 */
export type GameRuntime =
  | {
      kind: 'embed';
      /** Path under this site (e.g. /play/<slug>/, built by scripts/build-games.mjs) or an absolute URL. */
      url: string;
      /** Allowed postMessage origins; 'self' means this site's own origin. */
      origins: string[];
    }
  | { kind: 'module' };

export interface GameEntry {
  /** URL slug, unique, lowercase-kebab: /games/<slug>. Never change it after release (it breaks shared links). */
  slug: string;
  title: string;
  /** One line for tiles and search results (max ~90 characters). */
  tagline: string;
  /** Two or three sentences for the game page and meta description. */
  description: string;
  /** First category is the primary one. */
  categories: [CategoryId, ...CategoryId[]];
  /** Moods this game fits (see MOODS), for the home page's quick picker. */
  moods?: MoodId[];
  /** Extra search keywords. */
  tags: string[];
  /** ISO date (YYYY-MM-DD) of public release. Drives "Newest" sort and the NEW badge. */
  released: string;
  accent: Accent;
  /** One emoji that stands for the game in share texts (the Daily Sweep row). */
  emoji?: string;
  art: {
    /** Square-ish artwork (used in tiles), path under /public. */
    tile: string;
    /** Wide artwork (used in editorial features and social cards). */
    wide: string;
    /** Alt text describing the artwork. */
    alt: string;
    /** Background color behind the artwork while it loads. */
    bg: string;
  };
  runtime: GameRuntime;
  /** Screen shape the game prefers; the stage is sized to it. */
  aspect: 'portrait' | 'landscape' | 'square';
  controls: { keyboard?: string[]; touch?: string[] };
  /** Stats the game reports, best values are kept per player on this device. */
  stats: StatDef[];
  /** Factual feature bullets for the game page. */
  highlights?: string[];
  daily?: DailyTemplate[];
  /**
   * The game has its own daily puzzle (same for everyone on a date). It is listed in "Today's dailies"
   * and counts toward the arcade streak when the game reports `{ type: 'end', daily: true, ... }`.
   */
  ownDaily?: {
    /** Short name of the daily round, e.g. "Today's grid". */
    label: string;
  };
  /**
   * Friends' challenges (up to 6 players, same seed, one attempt each per round). The game plays the
   * round when it gets a `challenge` prop and reports its end with the challenge id.
   */
  challenge?: {
    /** What a round is, e.g. "One flight: most gaps wins". */
    label: string;
    /** Lower scores win (e.g. times). */
    lowerIsBetter?: boolean;
  };
  /** Optional link to play the game on its own site. */
  homepage?: string;
  /** Server-side plausibility limits for leaderboard submissions. */
  limits?: {
    /** Highest score a legitimate player can gain per second of play. */
    scorePerSecond: number;
    /** Shortest real round, in seconds. */
    minSeconds?: number;
  };
  /**
   * A Party Mode game (e.g. Crass Act): featured in Party Mode instead of the arcade, so it is left out of
   * the arcade's lists, search, home page and rotations. Its own page and room links still work.
   */
  partyOnly?: boolean;
  /**
   * Live multiplayer: friends play together at the same moment in a live room (rooms/worker.ts), each
   * on their own device. Wherever the game is listed it carries the "Live multiplayer" label.
   */
  live?: {
    /** How many play in one room, e.g. "2" or "2–4". */
    players: string;
  };
  /**
   * Adults-only content (18+). Wherever the game is listed it carries the "18+ Adults only" label (never
   * replaced by a sticker), its page is marked `rating: adult` for search engines, and the game itself
   * asks players to confirm their age before it starts.
   */
  adult?: boolean;
  /**
   * Languages the game's own content comes in (questions, cards, its in-game text), English first.
   * Missing = English only. The game gets the one matching the site's language as `lang` (see
   * src/platform/contentLang.ts).
   */
  contentLangs?: ContentLang[];
  /**
   * The game keeps a coin wallet, so QA and admins can give a player coins for it. The game collects
   * them with claimCoins() (src/platform/coins.ts) when a signed-in player opens it.
   */
  wallet?: boolean;
  /**
   * The arcade's full-screen menu button (continue, exit full screen, exit game, report a bug). By
   * default ('own') every game shows it inside its own UI, in its top row: module games render
   * <GameMenuButton>, embedded games answer the 'menu' host command (see contract.ts). A corner
   * makes the arcade draw a floating button there instead, moved `x` px inward and `y` px down:
   * only for an embedded game that can't show its own.
   */
  menu?: 'own' | { corner: 'top-left' | 'top-right' | 'top-center'; x?: number; y?: number };
  /** Free-form game-specific data. */
  meta?: Record<string, unknown>;
}
