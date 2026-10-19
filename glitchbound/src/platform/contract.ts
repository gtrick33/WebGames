/**
 * The contract between the arcade shell and a game. Both runtimes report the same events:
 * - module games call `host.report(event)` directly;
 * - embedded games post `{ source: 'glitchbound-game', version: 1, ...event }` to `window.parent`.
 */

/** A round started (first input after a menu, or a restart). */
export interface StartEvent {
  type: 'start';
}

/** A round ended. `score` is the main result; `stats` carries any extra numbers declared in the registry. */
export interface EndEvent {
  type: 'end';
  score: number;
  stats?: Record<string, number>;
  /** True when this round was the game's own daily puzzle (games with `ownDaily` in the registry). */
  daily?: boolean;
  /** Set when this round was a friends' challenge round (the game got a `challenge` prop). */
  challenge?: { id: string; round: number; replay?: string };
}

/** The game is listening for host commands (identity, pause). */
export interface ReadyEvent {
  type: 'ready';
}

export type GameEvent = ReadyEvent | StartEvent | EndEvent;

export interface GameHost {
  report(event: GameEvent): void;
}

/** Props for a game's looping catalogue preview (src/games/<slug>/Preview.tsx). */
export interface GamePreviewProps {
  /** Pause when false (e.g. tile not hovered on desktop). The preview also pauses offscreen. */
  playing?: boolean;
}

export interface GameModuleProps {
  host: GameHost;
  /** Changes whenever the player presses Restart; reset the game when it does. */
  restartKey: number;
  /**
   * Increments whenever the arcade wants the game paused: the player left full screen (Escape or the
   * menu) or scrolled the game mostly out of view. Pause play, timers and music when it changes.
   */
  pauseKey?: number;
  /** Play this friends' challenge round (same seed for every player, one attempt). */
  challenge?: ChallengeSpec;
  /** The player's name on the site (member or guest), for games that show it to others. */
  playerName?: string;
  /**
   * The language to play the game's own content in: the site's language when the game lists it in
   * `contentLangs`, else English. Games without translations can ignore it.
   */
  lang?: ContentLang;
}

import type { ChallengeSpec } from './challenge';
import type { ContentLang } from './contentLang';

export const MESSAGE_SOURCE = 'glitchbound-game';
export const PROTOCOL_VERSION = 1;

const MAX_VALUE = 1e9;

function cleanNumber(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.min(MAX_VALUE, Math.max(0, Math.floor(v)));
}

/**
 * Validates an untrusted value (a postMessage payload) and returns a clean GameEvent, or null.
 * Unknown stat keys are dropped later by the stats store; here we only enforce types and ranges.
 */
export function parseGameMessage(data: unknown): GameEvent | null {
  if (!data || typeof data !== 'object') return null;
  const m = data as Record<string, unknown>;
  if (m.source !== MESSAGE_SOURCE || m.version !== PROTOCOL_VERSION) return null;
  if (m.type === 'start') return { type: 'start' };
  if (m.type === 'ready') return { type: 'ready' };
  if (m.type !== 'end') return null;
  const score = cleanNumber(m.score);
  if (score === null) return null;
  const stats: Record<string, number> = {};
  if (m.stats && typeof m.stats === 'object') {
    for (const [k, v] of Object.entries(m.stats as Record<string, unknown>).slice(0, 16)) {
      const n = cleanNumber(v);
      if (n !== null && /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(k)) stats[k] = n;
    }
  }
  return m.daily === true ? { type: 'end', score, stats, daily: true } : { type: 'end', score, stats };
}
