/**
 * Friends' challenges, the shared rules (browser and server): up to 6 players play the same seed,
 * one attempt each per round; a rematch moves everyone to the next round with a new seed.
 */
import { hashString } from './dates';

export const MAX_PLAYERS = 6;
export const MAX_ROUNDS = 25;
export const NAME_MAX = 20;

export type ChallengeMode = 'daily' | 'fresh';

/** What a game needs to play a challenge round (passed to the game as its `challenge` prop). */
export interface ChallengeSpec {
  id: string;
  round: number;
  /** The round's seed: every player gets the same content from it. */
  seed: number;
  mode: ChallengeMode;
  /** The day of a daily challenge (YYYY-MM-DD). */
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
  host: string;
  createdAt: number;
  updatedAt: number;
  players: PlayerView[];
  rounds: RoundView[];
  /** Whether the requesting player has joined, and still has to play the current round. */
  joined: boolean;
  yourTurn: boolean;
  full: boolean;
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
