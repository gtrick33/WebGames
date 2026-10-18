/**
 * Friends' challenges, the shared rules (browser and server): up to 6 players play the same seed,
 * one attempt each per round; a rematch moves everyone to the next round with a new seed.
 */
import { hashString } from './dates';

export const MAX_PLAYERS = 6;
export const MAX_ROUNDS = 25;
export const NAME_MAX = 20;
/** Longest replay a score may carry (Mini Racer: a lap of about a minute). Longer ones are not sent. */
export const REPLAY_MAX = 20_000;
/** A challenge nobody else joined (and nobody played) closes after a day. */
export const CHALLENGE_LOBBY_MS = 24 * 3600_000;
/** Any other challenge closes after a week without a join, a score or a rematch. */
export const CHALLENGE_IDLE_MS = 7 * 86400_000;
/** Ended challenges stay readable (the final results) for this long, then they are deleted. */
export const CHALLENGE_KEEP_MS = 30 * 86400_000;

/** When a challenge closes by itself if nothing more happens. */
export const closesAt = (updatedAt: number, lobby: boolean): number => updatedAt + (lobby ? CHALLENGE_LOBBY_MS : CHALLENGE_IDLE_MS);

export type ChallengeMode = 'daily' | 'fresh';

/** What a game needs to play a challenge round (passed to the game as its `challenge` prop). */
export interface ChallengeSpec {
  id: string;
  round: number;
  /** The round's seed: every player gets the same content from it. */
  seed: number;
  mode: ChallengeMode;
  /** The challenge's day (YYYY-MM-DD): the daily's date, or the day a fresh challenge started (empty for older ones). */
  day: string;
  /** Replays from the other players this round (e.g. Mini Racer ghosts), when the game uses them. */
  replays?: { name: string; replay: string }[];
}

/** The seed for a round: round 1 uses the challenge's own seed, later rounds derive new ones. */
export const roundSeed = (base: number, round: number): number => (round <= 1 ? base >>> 0 : hashString(`challenge:${base}:${round}`));

/** A daily challenge's seed: the same for every group on that day (so it matches the day's content). */
export const dailySeed = (game: string, day: string): number => hashString(`challenge-daily:${game}:${day}`);

export interface PlayerView {
  name: string;
  you: boolean;
  /** Rounds this player won (ties share the win). */
  wins: number;
  total: number;
  /** Whether they have played the current round. */
  played: boolean;
}

export interface RoundView {
  round: number;
  scores: { name: string; score: number; stats: Record<string, number>; you: boolean; at: number }[];
}

export interface ChallengeView {
  id: string;
  game: string;
  mode: ChallengeMode;
  day: string;
  round: number;
  seed: number;
  createdAt: number;
  updatedAt: number;
  players: PlayerView[];
  rounds: RoundView[];
  /** Whether the requesting player has joined, and still has to play the current round. */
  joined: boolean;
  yourTurn: boolean;
  full: boolean;
  /** You started it (and may end it for everyone); the others may leave it. */
  host: boolean;
  /** Ended by the host, by everyone leaving, or by being quiet too long: results only, no more play. */
  closed: boolean;
  /** When it closes by itself if nothing more happens (0 once closed). */
  closesAt: number;
}

export interface ChallengeListItem {
  id: string;
  game: string;
  round: number;
  players: number;
  yourTurn: boolean;
  /** Names of players who still have to play the current round. */
  waitingFor: string[];
  leader: string;
  updatedAt: number;
  host: boolean;
  /** Nobody else has joined yet (it closes sooner: see CHALLENGE_LOBBY_MS). */
  lobby: boolean;
  closesAt: number;
}

/** Ranks a round's scores (higher first, or lower first for games where lower is better); returns winners. */
export function roundWinners(scores: { name: string; score: number }[], lowerIsBetter = false): string[] {
  if (scores.length < 2) return [];
  const best = lowerIsBetter ? Math.min(...scores.map((s) => s.score)) : Math.max(...scores.map((s) => s.score));
  return scores.filter((s) => s.score === best).map((s) => s.name);
}

export const cleanName = (v: unknown): string =>
  typeof v === 'string'
    ? [...v]
        .filter((ch) => ch.charCodeAt(0) >= 32)
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, NAME_MAX)
    : '';

/** Asked by a game's "See the scoreboard" button: the game page shows the challenge scoreboard on the stage. */
export const SCORES_EVENT = 'glitchbound:challenge-scores';

/** Click handler for in-game scoreboard links (the link itself still works without the arcade around it). */
export function openChallengeScores(e?: { preventDefault: () => void }): void {
  e?.preventDefault();
  window.dispatchEvent(new Event(SCORES_EVENT));
}
