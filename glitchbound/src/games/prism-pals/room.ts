/**
 * Prism Pals live: a room on the rooms worker (rooms/worker.ts) where 2 to 4 friends play a level
 * together, each on their own device. The room keeps the party: everyone's favorite color, the host's
 * level, who runs which critter (with fewer people than critters, some run two and switch), the run
 * counter (bumped to start or replay a level for everyone) and the team's points. The level itself never
 * touches the room's storage: every game runs its own critters and the host's game runs the world, all
 * through `relay` (net.ts). The host's game reports the clear; the room scores it. Pure, and free of the
 * level maps (rules.ts only), so the rooms worker stays small.
 *
 * Phases: lobby → play → result → (next level or replay) play, or (lobby) lobby.
 */
import { joinSeat, kickSeat, leaveSeat, online, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from '../../party/rooms/seats';
import { critters, LEVEL_COUNT, LEVEL_META, levelScore, packLevels } from './rules';

export { validKey } from '../../party/rooms/seats';

export const MAX_PLAYERS = 4;
/** The largest message a game sends (a host's world frame is well under 1 KB). */
export const maxMessage = 4096;

/** `result`: a level was cleared (the room shows the score until the host goes on). */
export type Phase = 'lobby' | 'play' | 'result';

export interface Result {
  level: number;
  secs: number;
  gems: number;
  tries: number;
  score: number;
}

export interface State extends RoomBase {
  game: 'prism-pals';
  phase: Phase;
  /** Each seat's favorite color (0 tangerine, 1 mint, 2 lilac, 3 lemon), by seat number. */
  picks: Record<number, number>;
  level: number;
  /** Who runs each of the level's critters (a seat number). */
  own: number[];
  run: number;
  result: Result | null;
  /** The team's points in this room, and the levels it cleared. */
  total: number;
  cleared: number[];
}

export function newRoom(code: string, now: number, seed: number): State {
  return { game: 'prism-pals', code, created: now, updated: now, phase: 'lobby', seats: [], nextSeat: 1, host: 0, deadline: null, seed, picks: {}, level: 0, own: [], run: 0, result: null, total: 0, cleared: [] };
}

const here = (s: State): number[] => online(s).map((x) => x.n);

/** A color nobody here has picked, starting from `want`. */
function freeColor(s: State, n: number, want: number): number {
  const taken = new Set(here(s).filter((m) => m !== n).map((m) => s.picks[m]));
  for (let k = 0; k < 4; k++) if (!taken.has((want + k) % 4)) return (want + k) % 4;
  return want % 4;
}

/**
 * Shares `n` critters among `people` (seat numbers, in seat order): everyone first gets the critter of their
 * favorite color if the level has it, then the rest go to whoever runs the fewest.
 */
export function shareCritters(people: readonly number[], picks: Record<number, number>, n: number): number[] {
  const own: number[] = Array.from({ length: n }, () => -1);
  if (!people.length) return own;
  for (const p of people) {
    const c = picks[p];
    if (c !== undefined && c < n && own[c] === -1) own[c] = p;
  }
  for (let i = 0; i < n; i++) {
    if (own[i] !== -1) continue;
    const count = (p: number): number => own.filter((o) => o === p).length;
    own[i] = people.reduce((best, p) => (count(p) < count(best) ? p : best), people[0]!);
  }
  return own;
}

/** The level's critters shared among those here (nobody here: it stays as it was). */
export function assign(s: State): void {
  const people = here(s);
  if (people.length) s.own = shareCritters(people, s.picks, critters(s.level));
}

export function join(s: State, key: string, name: string, now: number): string | null {
  const host = s.host;
  const err = joinSeat(s, key, name, now, MAX_PLAYERS, false);
  if (err) return err;
  const me = seatOf(s, key)!;
  if (s.picks[me.n] === undefined) s.picks[me.n] = freeColor(s, me.n, (me.n - 1) % 4);
  // mid-level the host role stays where it is (its game holds the world); a newcomer gets critters
  if (s.phase === 'play') {
    if (s.seats.some((x) => x.n === host && x.online)) s.host = host;
    assign(s);
  }
  return null;
}

export function leave(s: State, key: string, now: number): void {
  const seat = leaveSeat(s, key, now);
  if (!seat) return;
  if (!s.seats.some((x) => x.n === seat.n)) delete s.picks[seat.n];
  // their critters go to those still here (the host role has passed already: seats.ts)
  if (s.phase === 'play') assign(s);
}

export function tick(): void {}

/** The level to play with this many people: this one if it has a critter for each, else the first of their set. */
const fitting = (level: number, people: number): number => (critters(level) >= people ? level : (packLevels(Math.min(4, Math.max(2, people)))[0] ?? 0));

function play(s: State, level: number, now: number): void {
  s.level = fitting(level, here(s).length);
  s.phase = 'play';
  s.run++;
  s.result = null;
  for (const seat of s.seats) seat.waiting = false;
  assign(s);
  s.updated = now;
}

export type Action =
  | { t: 'color'; c: number }
  | { t: 'level'; i: number }
  | { t: 'start' }
  | { t: 'clear'; run: number; secs: number; gems: number; tries: number }
  | { t: 'next' }
  | { t: 'again' }
  | { t: 'lobby' }
  | { t: 'kick'; n: number }
  | { t: 'r'; d: unknown };

const int = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

export function act(s: State, key: string, a: Action, now: number): string | null {
  const me = seatOf(s, key);
  if (!me) return 'Join the room first.';
  if (!a || typeof a !== 'object') return 'Unknown action.';
  const host = me.n === s.host;
  s.updated = now;
  switch (a.t) {
    case 'color': {
      if (!int(a.c, 0, 3)) return null;
      if (here(s).some((n) => n !== me.n && s.picks[n] === a.c)) return 'Someone already picked that color.';
      s.picks[me.n] = a.c;
      if (s.phase === 'play') assign(s);
      return null;
    }
    case 'level':
      if (!host || s.phase === 'play' || !int(a.i, 0, LEVEL_COUNT - 1)) return null;
      if (critters(a.i) < here(s).length) return 'That level has fewer critters than there are players.';
      s.level = a.i;
      return null;
    case 'start':
      if (!host || s.phase !== 'lobby') return null;
      play(s, s.level, now);
      return null;
    case 'clear': {
      // the host's game saw every critter home: the room scores it once
      if (!host || s.phase !== 'play' || a.run !== s.run) return null;
      const meta = LEVEL_META[s.level]!;
      if (typeof a.secs !== 'number' || !Number.isFinite(a.secs) || a.secs < 0 || a.secs > 36_000 || !int(a.gems, 0, meta[2]) || !int(a.tries, 0, 9999)) return 'That clear didn’t make sense.';
      const score = levelScore(meta[1], a.secs, a.gems, a.tries);
      s.result = { level: s.level, secs: Math.round(a.secs * 10) / 10, gems: a.gems, tries: a.tries, score };
      s.total += score;
      if (!s.cleared.includes(s.level)) s.cleared = [...s.cleared, s.level].slice(-LEVEL_COUNT);
      for (const n of s.own) {
        const seat = s.seats.find((x) => x.n === n);
        if (seat) seat.score += score;
      }
      s.phase = 'result';
      return null;
    }
    case 'next':
    case 'again': {
      if (!host || s.phase !== 'result') return null;
      if (a.t === 'again') {
        play(s, s.level, now);
        return null;
      }
      // on to the next level that has a critter for everyone here
      let next = (s.level + 1) % LEVEL_COUNT;
      while (critters(next) < here(s).length) next = (next + 1) % LEVEL_COUNT;
      play(s, next, now);
      return null;
    }
    case 'lobby':
      if (!host || s.phase === 'lobby') return null;
      s.phase = 'lobby';
      s.result = null;
      return null;
    case 'kick':
      if (s.phase === 'play' || !kickSeat(s, me, a.n)) return null;
      delete s.picks[a.n];
      return null;
    default:
      return 'Unknown action.';
  }
}

/** The level's traffic: passed to everyone else as it is, tagged with the sender's seat, never stored. */
export function relay(s: State, key: string, a: Action): { others?: unknown; save: false } | null {
  if (!a || typeof a !== 'object' || a.t !== 'r') return null;
  const me = seatOf(s, key);
  if (!me || s.phase !== 'play') return { save: false };
  return { others: { n: me.n, d: a.d }, save: false };
}

export interface View {
  game: 'prism-pals';
  code: string;
  phase: Phase;
  /** Your seat number, and whose game hosts. */
  me: number;
  host: number;
  players: SeatView[];
  picks: Record<number, number>;
  level: number;
  own: number[];
  run: number;
  result: Result | null;
  total: number;
  cleared: number[];
}

export function viewFor(s: State, key: string): View | null {
  const me = seatOf(s, key);
  if (!me) return null;
  return {
    game: 'prism-pals',
    code: s.code,
    phase: s.phase,
    me: me.n,
    host: s.host,
    players: seatViews(s, me),
    picks: s.picks,
    level: s.level,
    own: s.own,
    run: s.run,
    result: s.result,
    total: s.total,
    cleared: s.cleared,
  };
}

export const summary = (s: State): ReturnType<typeof summaryOf> => summaryOf(s, 'prism-pals', MAX_PLAYERS);
