/**
 * The public room list and quick match, kept by one Durable Object named "lobby" (see worker.ts). Rooms
 * whose host left them public report themselves here whenever their player count or phase changes;
 * private rooms never do. Quick match picks the fullest public room still in its lobby, or reserves a
 * new one, in a single step of the lobby object, so two players searching at once end up together.
 * Pure: the worker keeps the list in storage and calls these.
 */
export interface Listed {
  code: string;
  game: string;
  phase: string;
  players: number;
  max: number;
  host: string;
  full: boolean;
  /** Opened by quick match (starts by itself once enough have joined). */
  matched: boolean;
  /** When the room last reported. */
  at: number;
  /** Quick match sent players here who have not shown up in the room yet (time of each). */
  claims: number[];
}

export type Lobby = Record<string, Listed>;

/** A room that stops reporting is dropped after this (rooms report on every change, and close after three quiet hours). */
export const STALE_MS = 3 * 60 * 60 * 1000;
/** How long a quick-match seat is held for a player on their way into the room. */
export const CLAIM_MS = 20_000;
/** A room quick match just opened, before its first player is in. */
export const RESERVE_MS = 30_000;
export const LIST_MAX = 60;

/** Phases where a newcomer gets a seat before the game starts. */
const OPEN_PHASES = new Set(['lobby', 'waiting', 'over', 'result']);
export const isOpenPhase = (phase: string): boolean => OPEN_PHASES.has(phase);

const fresh = (r: Listed, now: number): boolean => (r.players > 0 ? now - r.at < STALE_MS : now - r.at < RESERVE_MS);
const seatsTaken = (r: Listed, now: number): number => r.players + r.claims.filter((t) => now - t < CLAIM_MS).length;

export function prune(lobby: Lobby, now: number): void {
  for (const [code, r] of Object.entries(lobby)) if (!fresh(r, now)) delete lobby[code];
}

/**
 * A room's report. It settles the claims made a while before it: those players are in `players` by now
 * (or gave up). An empty room leaves the list, except one quick match has just opened for a searcher.
 */
export function put(lobby: Lobby, r: Omit<Listed, 'claims'>, now: number): void {
  const before = lobby[r.code];
  if (r.players <= 0) {
    if (!(before && before.players === 0 && now - before.at < RESERVE_MS)) delete lobby[r.code];
    return;
  }
  lobby[r.code] = { ...r, claims: before ? before.claims.filter((t) => t > r.at - 1500 && now - t < CLAIM_MS) : [] };
}

export function drop(lobby: Lobby, code: string): void {
  delete lobby[code];
}

/** Rooms worth showing, for one game or all: open seats first, then the busiest. */
export function list(lobby: Lobby, now: number, game?: string): Listed[] {
  return Object.values(lobby)
    .filter((r) => fresh(r, now) && r.players > 0 && !r.full && (!game || r.game === game))
    .sort((a, b) => Number(isOpenPhase(b.phase)) - Number(isOpenPhase(a.phase)) || b.players - a.players || b.at - a.at)
    .slice(0, LIST_MAX);
}

/**
 * Quick match: the public room of this game a newcomer can sit down in before it starts, with the most
 * players (quick-match rooms first), skipping codes the player already found full. Claims a seat in it.
 */
export function match(lobby: Lobby, game: string, now: number, skip: readonly string[] = []): Listed | null {
  const best = Object.values(lobby)
    .filter((r) => r.game === game && fresh(r, now) && isOpenPhase(r.phase) && !r.full && !skip.includes(r.code) && seatsTaken(r, now) < r.max)
    .sort((a, b) => Number(b.matched) - Number(a.matched) || seatsTaken(b, now) - seatsTaken(a, now) || a.at - b.at)[0];
  if (!best) return null;
  best.claims = [...best.claims.filter((t) => now - t < CLAIM_MS), now];
  return best;
}

/** A room quick match is opening, held for the searcher (and anyone searching right behind them). */
export function reserve(lobby: Lobby, code: string, game: string, max: number, now: number): Listed {
  const r: Listed = { code, game, phase: 'lobby', players: 0, max, host: '', full: false, matched: true, at: now, claims: [now] };
  lobby[code] = r;
  return r;
}
