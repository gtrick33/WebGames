/**
 * Rock Paper Scissors in a live room, for 2 to 12 players on their own phones. Everyone throws in
 * secret, then all hands are revealed together.
 *
 * - Last hand standing: when exactly two different hands are thrown, everyone with the losing hand is
 *   out; one hand (or all three) is a draw and you throw again. The last one in wins.
 * - Points race: every throw, you score a point for each player your hand beats. First to the target wins.
 *
 * Nobody stalls a round: when the throw clock runs out, a random hand is thrown for you.
 * Phases: lobby → throw → reveal → throw … → result.
 */
import { joinSeat, kickSeat, leaveSeat, nextRandom, online, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from './seats';

export { validKey } from './seats';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
export const THROW_SECONDS = 10;
const REVEAL_SECONDS = 4;
export const TARGETS = [3, 5, 10] as const;

export const HANDS = ['rock', 'paper', 'scissors'] as const;
export type Hand = (typeof HANDS)[number];
const BEATS: Record<Hand, Hand> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
export const beats = (a: Hand, b: Hand): boolean => BEATS[a] === b;

export type Phase = 'lobby' | 'throw' | 'reveal' | 'result';

export interface Settings {
  mode: 'knockout' | 'points';
  /** Points race: points to win. */
  target: (typeof TARGETS)[number];
}

export interface State extends RoomBase {
  game: 'rps';
  phase: Phase;
  settings: Settings;
  playing: number[];
  /** Knockout: seats still in. */
  alive: number[];
  points: Record<string, number>;
  /** This throw: seat → hand (secret until the reveal). */
  throws: Record<string, Hand>;
  /** Thrown for them when the clock ran out. */
  auto: number[];
  last: { throws: Record<string, Hand>; out: number[]; gained: Record<string, number>; draw: boolean } | null;
  round: number;
  winners: number[];
}

export function newRoom(code: string, now: number, seed: number): State {
  return {
    game: 'rps',
    code,
    created: now,
    updated: now,
    phase: 'lobby',
    seats: [],
    nextSeat: 1,
    host: 0,
    deadline: null,
    seed,
    settings: { mode: 'knockout', target: 5 },
    playing: [],
    alive: [],
    points: {},
    throws: {},
    auto: [],
    last: null,
    round: 0,
    winners: [],
  };
}

const inGame = (s: State): boolean => s.phase === 'throw' || s.phase === 'reveal';
const isHere = (s: State, n: number): boolean => s.seats.some((x) => x.n === n && x.online);
/** Who throws this round. */
const throwers = (s: State): number[] => (s.settings.mode === 'knockout' ? s.alive : s.playing);

export function join(s: State, key: string, name: string, now: number): string | null {
  return joinSeat(s, key, name, now, MAX_PLAYERS, inGame(s));
}

export function leave(s: State, key: string, now: number): void {
  if (!leaveSeat(s, key, now)) return;
  settle(s, now);
}

function nextThrow(s: State, now: number): void {
  s.round++;
  s.throws = {};
  s.auto = [];
  s.phase = 'throw';
  s.deadline = now + THROW_SECONDS * 1000;
}

function reveal(s: State, now: number): void {
  for (const n of throwers(s))
    if (!s.throws[n]) {
      s.throws[n] = HANDS[nextRandom(s) % 3]!;
      s.auto.push(n);
    }
  const who = throwers(s);
  const hands = new Set(who.map((n) => s.throws[n]!));
  const gained: Record<string, number> = {};
  let out: number[] = [];
  const draw = hands.size !== 2;
  if (s.settings.mode === 'knockout') {
    if (!draw) {
      const [a, b] = [...hands] as [Hand, Hand];
      const loser = beats(a, b) ? b : a;
      out = who.filter((n) => s.throws[n] === loser);
      s.alive = s.alive.filter((n) => !out.includes(n));
    }
  } else {
    for (const n of who) {
      const mine = s.throws[n]!;
      gained[n] = who.filter((m) => m !== n && beats(mine, s.throws[m]!)).length;
      s.points[n] = (s.points[n] ?? 0) + gained[n]!;
    }
  }
  s.last = { throws: { ...s.throws }, out, gained, draw };
  s.phase = 'reveal';
  s.deadline = now + REVEAL_SECONDS * 1000;
}

function finish(s: State, winners: number[]): void {
  s.winners = winners;
  for (const x of s.seats) if (winners.includes(x.n)) x.score++;
  s.phase = 'result';
  s.deadline = null;
}

/** After a reveal: is there a winner, or another throw? */
function afterReveal(s: State, now: number): void {
  if (s.settings.mode === 'knockout') {
    const left = s.alive.filter((n) => isHere(s, n));
    if (s.alive.length <= 1 || left.length <= 1) return finish(s, left.length === 1 ? left : s.alive);
  } else {
    const top = Math.max(0, ...s.playing.map((n) => s.points[n] ?? 0));
    if (top >= s.settings.target) return finish(s, s.playing.filter((n) => (s.points[n] ?? 0) === top));
  }
  nextThrow(s, now);
}

function settle(s: State, now: number): void {
  if (!inGame(s)) return;
  const here = s.playing.filter((n) => isHere(s, n));
  if (here.length < 2) {
    s.phase = 'lobby';
    s.deadline = null;
    return;
  }
  if (s.settings.mode === 'knockout') {
    // Someone who left is out; if only one is still in, they win.
    s.alive = s.alive.filter((n) => isHere(s, n));
    if (s.alive.length <= 1) return finish(s, s.alive);
  }
  if (s.phase === 'throw' && throwers(s).every((n) => s.throws[n])) reveal(s, now);
}

export function tick(s: State, now: number): void {
  if (s.deadline === null || now < s.deadline) return;
  if (s.phase === 'throw') reveal(s, now);
  else if (s.phase === 'reveal') afterReveal(s, now);
  s.updated = now;
}

export type Action =
  | { t: 'settings'; settings: Partial<Settings> }
  | { t: 'start' }
  | { t: 'throw'; hand: Hand }
  | { t: 'lobby' }
  | { t: 'kick'; seat: number };

export function act(s: State, key: string, a: Action, now: number): string | null {
  const me = seatOf(s, key);
  if (!me) return 'Join the room first.';
  const isHost = me.n === s.host;
  s.updated = now;
  switch (a?.t) {
    case 'settings': {
      if (!isHost) return 'Only the host can change the settings.';
      if (inGame(s)) return 'Change settings between games.';
      const p = a.settings ?? {};
      if (p.mode === 'knockout' || p.mode === 'points') s.settings.mode = p.mode;
      if ((TARGETS as readonly unknown[]).includes(p.target)) s.settings.target = p.target as Settings['target'];
      return null;
    }
    case 'start': {
      if (!isHost) return 'The host starts the game.';
      if (inGame(s)) return null;
      const here = online(s);
      if (here.length < MIN_PLAYERS) return `You need at least ${MIN_PLAYERS} players.`;
      for (const x of s.seats) x.waiting = false;
      s.playing = here.map((x) => x.n);
      s.alive = [...s.playing];
      s.points = {};
      s.last = null;
      s.round = 0;
      s.winners = [];
      nextThrow(s, now);
      return null;
    }
    case 'throw':
      if (s.phase !== 'throw' || !throwers(s).includes(me.n) || !(HANDS as readonly unknown[]).includes(a.hand)) return null;
      s.throws[me.n] = a.hand;
      settle(s, now);
      return null;
    case 'lobby':
      if (!isHost) return null;
      s.phase = 'lobby';
      s.deadline = null;
      return null;
    case 'kick':
      if (kickSeat(s, me, a.seat)) {
        s.playing = s.playing.filter((n) => n !== a.seat);
        s.alive = s.alive.filter((n) => n !== a.seat);
        settle(s, now);
      }
      return null;
    default:
      return 'Unknown action.';
  }
}

export interface RoomView {
  game: 'rps';
  code: string;
  phase: Phase;
  settings: Settings;
  players: SeatView[];
  you: number;
  host: boolean;
  deadline: number | null;
  round: number;
  playing: number[];
  alive: number[];
  points: Record<string, number>;
  /** Whether you throw this round. */
  throwing: boolean;
  myThrow: Hand | null;
  /** Reveal and result: the last throw, everyone's hands. */
  last: State['last'];
  auto: number[];
  winners: number[];
}

export function viewFor(s: State, key: string): RoomView | null {
  const me = seatOf(s, key);
  if (!me) return null;
  return {
    game: 'rps',
    code: s.code,
    phase: s.phase,
    settings: s.settings,
    players: seatViews(s, me, (n) => s.phase === 'throw' && !!s.throws[n]),
    you: me.n,
    host: me.n === s.host,
    deadline: s.deadline,
    round: s.round,
    playing: s.playing,
    alive: s.alive,
    points: s.points,
    throwing: s.phase === 'throw' && throwers(s).includes(me.n),
    myThrow: s.throws[me.n] ?? null,
    last: s.phase === 'reveal' || s.phase === 'result' ? s.last : null,
    auto: s.phase === 'reveal' ? s.auto : [],
    winners: s.phase === 'result' ? s.winners : [],
  };
}

export function summary(s: State) {
  return summaryOf(s, 'rps', MAX_PLAYERS);
}
