/**
 * Looking for a match in The Ring. The owner: "if you are looking for a match, try to find existing players for a
 * while and after 10 secs of loading screen, load bots if noone is queing". A search asks the arcade's quick match
 * for a room of its own format (1v1, 2v2 and 3v3 each have a queue), sits down in it and waits: the first one in runs
 * the room, and says go as soon as both sides are full of people, or when their own ten seconds are up and at least
 * one other person came (the computer takes the empty places). Nobody in ten seconds: the computer's teams, as before.
 *
 * Rated since the owner's notes of 2026-11-13 ("a better mmr matchmaking ... dynamic, if there's no people at all or
 * their number is unsufficient for queue, start the bots match instantly"): a search says its rating and is sent to
 * the waiting room nearest it, within a window that widens as rooms wait and is open to all while the queue is thin
 * (rooms/lobby.ts `match`). When nobody else has searched that queue in the last few minutes there is nobody to wait
 * for, and the computer's teams come at once. What a match is worth is arena/ladder.ts `stakesOf`.
 *
 * This file is the deciding, pure: what a searcher does next, given what the room shows. net/ringSeek.ts does it.
 */
import type { View } from '../net/ringRoom';
import type { Format } from './ranks';

/** How long a search looks for people before it settles for the computer. */
export const SEEK_MS = 10_000;
/** How much longer someone who found a room gives its host to say go (their ten seconds began first). */
export const SEEK_GRACE_MS = 2_500;
/** Both sides full: a moment to read who was found, then the gates. */
export const FOUND_MS = 1_200;
/** A room of another format: how long before moving on (its host may only be about to set it). */
export const WRONG_MS = 900;
/** In a match: a player whose connection has been gone this long has left it. */
export const DROP_MS = 12_000;

export type SeekStep =
  | { do: 'wait' }
  /** The host makes the room this search's format. */
  | { do: 'setup' }
  /** Sit down on a side (or move to the other one, to even them). */
  | { do: 'pick'; team: 0 | 1 }
  | { do: 'start' }
  /** Give the room up and fight the computer's teams. */
  | { do: 'bots' }
  /** This room is no use (another format, or no place left): on to another. */
  | { do: 'next' };

export interface SeekFacts {
  host: boolean;
  /** Everyone seated on a side and connected, the searcher included. */
  people: number;
  /** The others, by name, for the waiting screen. */
  others: string[];
  /** Both sides are all people. */
  full: boolean;
  /** The room is for another format. */
  wrong: boolean;
  /** Which side the searcher is on, if any. */
  mine: 0 | 1 | null;
  /** Where they should be: the side with fewer people, never one with no room; null when neither has room. */
  side: 0 | 1 | null;
}

export function seekFacts(v: View, format: Format): SeekFacts {
  const me = v.seats.find((s) => s.n === v.you);
  const on = v.seats.filter((s) => s.pick && s.online);
  const others = on.filter((s) => s.n !== v.you);
  const count = (t: 0 | 1): number => others.filter((s) => s.pick!.team === t).length;
  const mine = me?.pick ? me.pick.team : null;
  const [a, b] = [count(0), count(1)];
  let side: 0 | 1 | null;
  if (mine !== null) {
    // seated: stay, unless this side has two more than the other and this is the last one to have sat down on it
    const here = mine === 0 ? a : b;
    const there = mine === 0 ? b : a;
    const last = !others.some((s) => s.pick!.team === mine && s.n > v.you);
    side = here + 1 - there >= 2 && last && there < format ? ((1 - mine) as 0 | 1) : mine;
  } else if (a >= format && b >= format) side = null;
  else if (a >= format) side = 1;
  else if (b >= format) side = 0;
  else side = b < a ? 1 : 0;
  const total = (t: 0 | 1): number => count(t) + (mine === t ? 1 : 0);
  return { host: v.host === v.you, people: on.length, others: others.map((s) => s.name), full: total(0) >= format && total(1) >= format, wrong: v.format !== format, mine, side };
}

/**
 * What a searcher does now. `waited`: since the search began. `fullFor`: how long both sides have been full (0: they
 * aren't). `wrongFor`: how long the room has shown another format.
 */
export function seekStep(f: SeekFacts, waited: number, fullFor: number, wrongFor: number): SeekStep {
  if (f.wrong) return f.host ? { do: 'setup' } : wrongFor >= WRONG_MS ? { do: 'next' } : { do: 'wait' };
  if (f.side === null) return { do: 'next' };
  if (f.mine !== f.side) return { do: 'pick', team: f.side };
  if (f.host) {
    if (f.full) return fullFor >= FOUND_MS ? { do: 'start' } : { do: 'wait' };
    if (waited >= SEEK_MS) return f.people >= 2 ? { do: 'start' } : { do: 'bots' };
    return { do: 'wait' };
  }
  return waited >= SEEK_MS + SEEK_GRACE_MS ? { do: 'bots' } : { do: 'wait' };
}

/**
 * Who a searcher is up against once the room has begun: the people on the other side, by name, and their rating (the
 * mean of those who gave one). A match against people is rated as one against the computer's teams is: by the same
 * rule, against that number (the owner: "same logic as the leaver penalty").
 */
export function rivalsOf(v: View): { names: string[]; rating: number | null; ours: number | null } {
  const mine = v.seats.find((s) => s.n === v.you)?.pick?.team;
  const mean = (list: typeof v.seats): number | null => {
    const rated = list.map((s) => s.pick!.rating).filter((r): r is number => typeof r === 'number');
    return rated.length ? Math.round(rated.reduce((a, b) => a + b, 0) / rated.length) : null;
  };
  const them = v.seats.filter((s) => s.pick && s.pick.team !== mine);
  // (the side's matchmaking rating: the people on it who gave one; the computer's places on it don't count)
  const us = v.seats.filter((s) => s.pick && s.pick.team === mine);
  return { names: them.map((s) => s.name), rating: mean(them), ours: mean(us) };
}

/**
 * Whether a match found by a search is over for this player because someone else left it: a seat that was in it is
 * gone from the room, or has been without its connection for DROP_MS. `away`: since when each seat has been seen
 * without one (kept by the caller between looks). Whoever leaves takes a leaver's loss; for everyone else the match
 * ends there and nothing changes.
 */
export function leftBehind(v: View, seats: readonly number[], away: Map<number, number>, now: number): boolean {
  for (const n of seats) {
    if (n === v.you) continue;
    const s = v.seats.find((x) => x.n === n);
    if (!s) return true;
    if (s.online) away.delete(n);
    else {
      const since = away.get(n) ?? now;
      away.set(n, since);
      if (now - since >= DROP_MS) return true;
    }
  }
  return false;
}
