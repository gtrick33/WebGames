import type { Comp, Format } from './ladder';
import type { MatchSetup, Snapshot } from './sim';

/*
 * A rated Ring match being fought, kept in this browser as it goes: a player who leaves it while it's going (a closed
 * tab, a lost connection, a page left) is asked to come back to it, or loses as a leaver (ladder.ts forfeitLive).
 * Small, for the title screen to read without bringing the Ring with it.
 */

/** A loss by walking out of a rated match, or not coming back to it, costs this many times a loss. */
export const LEAVER_K = 1.5;

const LIVE_KEY = 'rb-ring-live';
/** How long a match left (a closed tab, a lost connection, a page left) waits for its player to come back. */
export const LIVE_WAIT = 3 * 60 * 1000;

/** A rated match being fought, kept as it goes so that a player who leaves it can come back to it. */
export interface LiveMatch {
  setup: MatchSetup;
  rival: Comp;
  skill: number;
  rivalRating: number;
  /** Against people in 2v2 and 3v3: the mean rating of the player's own side, which the stakes are worked from. */
  ourRating?: number;
  format: Format;
  stakes: { format: number; rating: number; rank: string; color: string; win: number; lose: number; rival: string; blurb: string; rivalRating: number };
  /** When it was last seen going (ms). */
  at: number;
  snap?: Snapshot;
  /** Fought against other players, found by a search: it runs on without whoever leaves, so there is no going back. */
  people?: boolean;
}

export function readLive(): LiveMatch | null {
  try {
    const raw = JSON.parse(localStorage.getItem(LIVE_KEY) ?? 'null') as LiveMatch | null;
    return raw && typeof raw.at === 'number' && raw.setup && raw.rival ? raw : null;
  } catch {
    return null;
  }
}

export function writeLive(l: LiveMatch): void {
  try {
    localStorage.setItem(LIVE_KEY, JSON.stringify(l));
  } catch {
    /* nothing kept: a leaver can't be caught, nor come back */
  }
}

export function clearLive(): void {
  try {
    localStorage.removeItem(LIVE_KEY);
  } catch {
    /* (as above) */
  }
}

/** Whether a match left behind can still be gone back to. */
export const liveGoing = (l: LiveMatch, now = Date.now()): boolean => !l.people && now - l.at < LIVE_WAIT && l.snap?.p !== 'over';

