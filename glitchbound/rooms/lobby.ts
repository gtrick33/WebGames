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
  /**
   * Which of a game's queues a quick-match room belongs to, for a game with more than one (The Ring's 1v1, 2v2 and
   * 3v3: a room for two is no use to someone looking for six). Searchers only meet in rooms of their own kind.
   */
  kind?: string;
  /**
   * A rated queue's rooms: the mean rating of the searchers sent here (`rated` of them), and when quick match opened
   * it. A searcher with a rating is sent to the room nearest their own, within a window that widens the longer the
   * room has waited (RATING_WINDOW, RATING_GROW, RATING_ANY_MS), and to any room at all when the queue is thin.
   */
  mmr?: number;
  rated?: number;
  since?: number;
}

/** A queue's name within a game: short and plain, or none. */
export const cleanKind = (v: unknown): string => (typeof v === 'string' && /^[a-z0-9-]{1,12}$/.test(v) ? v : '');

export type Lobby = Record<string, Listed>;

/** A room that stops reporting is dropped after this (rooms report on every change, and close after three quiet hours). */
export const STALE_MS = 3 * 60 * 60 * 1000;
/** How long a quick-match seat is held for a player on their way into the room. */
export const CLAIM_MS = 20_000;
/** A room quick match just opened, before its first player is in. */
export const RESERVE_MS = 30_000;
export const LIST_MAX = 60;

/** A rated search first looks this far either way of its own rating. */
export const RATING_WINDOW = 150;
/** ...and this much further for each second the room it would join has been waiting. */
export const RATING_GROW = 60;
/** A room that has waited this long takes anyone of its queue: a fight now beats a fair fight never. */
export const RATING_ANY_MS = 8_000;
/** Who counts as around: someone who searched a queue this recently (a match and a look at its result, and back). */
export const ACTIVE_MS = 3 * 60 * 1000;

/** How far from a room's rating a searcher may be to join it: wider the longer it has waited, and no limit when the queue is thin. */
export function ratingWindow(waitedMs: number, openRooms: number): number {
  if (openRooms <= 1 || waitedMs >= RATING_ANY_MS) return Infinity;
  return RATING_WINDOW + (RATING_GROW * Math.max(0, waitedMs)) / 1000;
}

/** Who has searched each queue lately, by `game|kind|who`: when last seen. */
export type Seekers = Record<string, number>;

const seekerKey = (game: string, kind: string, who: string): string => `${game}|${kind}|${who}`;

/** A search in a queue was seen: its searcher is around. Forgets those gone quiet. Returns how many others are. */
export function seen(seekers: Seekers, game: string, kind: string, who: string, now: number): number {
  for (const [k, at] of Object.entries(seekers)) if (now - at >= ACTIVE_MS) delete seekers[k];
  const prefix = `${game}|${kind}|`;
  const others = Object.keys(seekers).filter((k) => k.startsWith(prefix) && k !== seekerKey(game, kind, who)).length;
  if (who) seekers[seekerKey(game, kind, who)] = now;
  return others;
}

/** A searcher's name for themselves (kept on their device), short and plain. */
export const cleanWho = (v: unknown): string => (typeof v === 'string' && /^[a-z0-9]{6,24}$/i.test(v) ? v : '');

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
  const kind = cleanKind(r.kind) || before?.kind;
  // (what quick match knows of a rated room's searchers stays: the room itself doesn't report it)
  const rated = before && typeof before.mmr === 'number' ? { mmr: before.mmr, rated: before.rated ?? 1, since: before.since ?? before.at } : {};
  // whoever has just sat down was on their way: their claim (the oldest) is met. Without this the one a new room was
  // opened for counted twice, as a player and as still coming, and a room for two looked full to the next searcher
  // for the twenty seconds a claim lasts.
  const arrived = before ? Math.max(0, r.players - before.players) : 0;
  lobby[r.code] = { ...r, ...(kind ? { kind } : {}), ...rated, claims: before ? before.claims.slice(arrived).filter((t) => t > r.at - 1500 && now - t < CLAIM_MS) : [] };
}

export function drop(lobby: Lobby, code: string): void {
  delete lobby[code];
}

/** Rooms worth showing, for one game or all: open seats first, then the busiest. */
export function list(lobby: Lobby, now: number, game?: string): Listed[] {
  return Object.values(lobby)
    // (a queue's rooms are found by searching that queue, never picked from a list)
    .filter((r) => fresh(r, now) && r.players > 0 && !r.full && !r.kind && (!game || r.game === game))
    .sort((a, b) => Number(isOpenPhase(b.phase)) - Number(isOpenPhase(a.phase)) || b.players - a.players || b.at - a.at)
    .slice(0, LIST_MAX);
}

/**
 * Quick match: the public room of this game (and of this queue of it, `kind`) a newcomer can sit down in before it
 * starts, with the most players (quick-match rooms first), skipping codes the player already found full. Claims a
 * seat in it.
 *
 * `rating`: a rated search (The Ring). It goes to the room whose searchers' rating is nearest its own, and only within
 * `ratingWindow` of it: wide when the room has waited, open to all when it is the only one waiting. Nobody near
 * enough: no room, and the searcher opens their own for those nearer to come to.
 */
export function match(lobby: Lobby, game: string, now: number, skip: readonly string[] = [], kind = '', rating?: number): Listed | null {
  const open = Object.values(lobby).filter((r) => r.game === game && (r.kind ?? '') === kind && fresh(r, now) && isOpenPhase(r.phase) && !r.full && !skip.includes(r.code) && seatsTaken(r, now) < r.max);
  const rated = typeof rating === 'number' && Number.isFinite(rating);
  const gap = (r: Listed): number => (rated && typeof r.mmr === 'number' ? Math.abs(r.mmr - rating) : 0);
  const best = open
    .filter((r) => !rated || gap(r) <= ratingWindow(now - (r.since ?? r.at), open.length))
    // (the nearest rating first, by steps of 50 so a fuller room still wins between two about as near)
    .sort((a, b) => Math.floor(gap(a) / 50) - Math.floor(gap(b) / 50) || Number(b.matched) - Number(a.matched) || seatsTaken(b, now) - seatsTaken(a, now) || a.at - b.at)[0];
  if (!best) return null;
  best.claims = [...best.claims.filter((t) => now - t < CLAIM_MS), now];
  if (rated && typeof best.mmr === 'number') {
    const n = best.rated ?? 1;
    best.mmr = Math.round((best.mmr * n + rating) / (n + 1));
    best.rated = n + 1;
  }
  return best;
}

/** A room quick match is opening, held for the searcher (and anyone searching right behind them). */
export function reserve(lobby: Lobby, code: string, game: string, max: number, now: number, kind = '', rating?: number): Listed {
  const mmr = typeof rating === 'number' && Number.isFinite(rating) ? { mmr: Math.round(rating), rated: 1, since: now } : {};
  const r: Listed = { code, game, phase: 'lobby', players: 0, max, host: '', full: false, matched: true, at: now, claims: [now], ...(kind ? { kind } : {}), ...mmr };
  lobby[code] = r;
  return r;
}
