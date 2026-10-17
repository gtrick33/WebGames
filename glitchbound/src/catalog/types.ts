/**
 * The game registry schema. Everything the arcade shell knows about a game lives in one GameEntry.
 * This file must stay free of React and browser APIs: vite.config.ts imports the catalog at build
 * time to generate per-game HTML pages, the sitemap and robots.txt.
 */

export const CATEGORIES = {
  arcade: { label: 'Arcade', blurb: 'Fast hands, short rounds.' },
  racing: { label: 'Racing', blurb: 'Speed, lanes and near misses.' },
  puzzle: { label: 'Puzzle', blurb: 'Logic and visual brain teasers.' },
  word: { label: 'Word', blurb: 'Letters, guesses and daily words.' },
  trivia: { label: 'Trivia', blurb: 'Facts, flags and geography.' },
  strategy: { label: 'Strategy', blurb: 'Plan a few moves ahead.' },
  experimental: { label: 'Experimental', blurb: 'Odd ideas that turned out fun.' },
} as const;

export type CategoryId = keyof typeof CATEGORIES;

/** Brand accent used for the game's tile, stickers and page highlights. */
export type Accent = 'blue' | 'orange' | 'lime' | 'coral' | 'yellow' | 'teal' | 'violet';

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
}

/**
 * How the arcade runs the game.
 * - `embed`: the game is its own deployed site, shown in an iframe. It reports rounds with postMessage
 *   (see src/platform/bridge.ts and docs/ADDING-A-GAME.md).
 * - `module`: the game is a React component inside this repo, lazy-loaded from src/catalog/modules.ts.
 */
export type GameRuntime =
  | { kind: 'embed'; url: string; /** Allowed postMessage origins. */ origins: string[] }
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
  /** Extra search keywords. */
  tags: string[];
  /** ISO date (YYYY-MM-DD) of public release. Drives "Newest" sort and the NEW badge. */
  released: string;
  accent: Accent;
  art: {
    /** Square-ish artwork (used in tiles), path under /public. */
    tile: string;
    /** Wide artwork (used in editorial features and social cards). */
    wide: string;
    /** Alt text describing the artwork. */
    alt: string;
    /** Background colour behind the artwork while it loads. */
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
  /** Optional link to play the game on its own site. */
  homepage?: string;
  /** Free-form game-specific data. */
  meta?: Record<string, unknown>;
}
