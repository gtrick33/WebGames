/**
 * Hue Knew? in a live room: the cue giver picks the secret color on their own phone and types a
 * one-word clue (or, with Real life on, says it out loud and taps a button); everyone else taps their guess on their own color board. Guesses stay hidden until
 * everyone has placed one, then show together. With the second clue on, the cue giver then adds up
 * to two more words and everyone guesses again. Scored by how alike the colors look (../hues.ts):
 * guessers by closeness, the cue giver one point per close guess.
 *
 * Phases: lobby → pick → guess → (clue2 → guess) → reveal → pick … → result.
 */
import { cleanClue } from '../unique';
import { COLS, huePoints, offerColours, ROWS } from '../hues';
import { rng } from '../engine';
import { joinSeat, kickSeat, leaveSeat, nextRandom, online, seatByN, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from './seats';

export { validKey } from './seats';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
/** How many times everyone gives the cue. */
export const LAPS = [1, 2, 3] as const;
/** Seconds to place a guess. */
export const CLOCKS = [30, 60, 90] as const;
export const PICK_SECONDS = 90;
export const CLUE2_SECONDS = 60;
export const REVEAL_SECONDS = 15;
/** A cue giver who drops out while choosing gets this long to come back before the round moves on. */
export const CUE_GRACE_MS = 15_000;
const CELLS = COLS * ROWS;

export type Phase = 'lobby' | 'pick' | 'guess' | 'clue2' | 'reveal' | 'result';

export interface Settings {
  /** After the first guesses, the cue giver adds up to two more words and everyone guesses again. */
  second: boolean;
  laps: (typeof LAPS)[number];
  clock: (typeof CLOCKS)[number];
  /** Real life: everyone is in the same room, so the cue giver says the clues out loud instead of typing them. */
  real: boolean;
}

export interface Round {
  cue: number;
  /** The four colors the cue giver chooses from. */
  offer: number[];
  target: number | null;
  /** Empty when the cue giver ran out of time (or said it out loud). */
  clue: string;
  clue2: string;
  /** Real life: the cue giver said the first clue out loud. */
  said?: boolean;
  pass: 1 | 2;
  /** Seat → board cell, for the first and the second clue. */
  marks: Record<string, number>;
  marks2: Record<string, number>;
  gained: Record<string, number>;
  /** The clock the cue giver had before dropping out (given back if they return in time). */
  cueBack?: number;
}

export interface State extends RoomBase {
  game: 'hues';
  phase: Phase;
  settings: Settings;
  playing: number[];
  /** Where in `playing` to look for the next cue giver. */
  next: number;
  count: number;
  total: number;
  round: Round | null;
  /** Seat → points this game. */
  points: Record<string, number>;
  games: number;
}

export function newRoom(code: string, now: number, seed: number): State {
  return {
    game: 'hues',
    code,
    created: now,
    updated: now,
    phase: 'lobby',
    seats: [],
    nextSeat: 1,
    host: 0,
    deadline: null,
    seed,
    settings: { second: true, laps: 1, clock: 60, real: false },
    playing: [],
    next: 0,
    count: 0,
    total: 0,
    round: null,
    points: {},
    games: 0,
  };
}

const inGame = (s: State): boolean => s.phase === 'pick' || s.phase === 'guess' || s.phase === 'clue2' || s.phase === 'reveal';
const isHere = (s: State, n: number): boolean => s.seats.some((x) => x.n === n && x.online);
const guessers = (s: State): number[] => s.playing.filter((n) => n !== s.round?.cue);
const current = (r: Round): Record<string, number> => (r.pass === 1 ? r.marks : r.marks2);

const choosing = (s: State): boolean => s.phase === 'pick' || s.phase === 'clue2';

export function join(s: State, key: string, name: string, now: number): string | null {
  const err = joinSeat(s, key, name, now, MAX_PLAYERS, inGame(s));
  const r = s.round;
  // The cue giver is back in time: their clock as it was.
  if (!err && r?.cueBack !== undefined && choosing(s) && seatOf(s, key)?.n === r.cue) {
    s.deadline = Math.max(s.deadline ?? 0, r.cueBack);
    delete r.cueBack;
  }
  return err;
}

export function leave(s: State, key: string, now: number): void {
  const seat = leaveSeat(s, key, now);
  if (!seat) return;
  const r = s.round;
  // The cue giver left while choosing: the round moves on by itself after a short grace (a reload).
  if (r && choosing(s) && seat.n === r.cue && s.deadline !== null && s.deadline > now + CUE_GRACE_MS) {
    r.cueBack = s.deadline;
    s.deadline = now + CUE_GRACE_MS;
  }
  advance(s, now);
}

function deal(s: State, now: number): void {
  if (s.count >= s.total) return finish(s);
  // Players who joined mid-game guess from the next round on.
  for (const x of s.seats)
    if (x.waiting && x.online) {
      x.waiting = false;
      s.playing.push(x.n);
    }
  const count = s.playing.length;
  // Someone who isn't here misses their turn as cue giver (it is used up, not handed on).
  let pick = s.next % count;
  while (s.count < s.total && !isHere(s, s.playing[pick]!)) {
    s.count++;
    pick = (pick + 1) % count;
  }
  if (s.count >= s.total) return finish(s);
  s.next = pick + 1;
  s.round = { cue: s.playing[pick]!, offer: offerColours(rng(nextRandom(s))), target: null, clue: '', clue2: '', pass: 1, marks: {}, marks2: {}, gained: {} };
  s.count++;
  s.phase = 'pick';
  s.deadline = now + PICK_SECONDS * 1000;
}

/** Everyone has guessed (or time is up): on to the second clue, or the reveal. */
function endGuess(s: State, now: number): void {
  const r = s.round!;
  if (r.pass === 1 && s.settings.second && isHere(s, r.cue)) {
    s.phase = 'clue2';
    s.deadline = now + CLUE2_SECONDS * 1000;
  } else reveal(s, now);
}

function reveal(s: State, now: number): void {
  const r = s.round!;
  const g: Record<string, number> = {};
  if (r.target !== null && (r.clue || r.said)) {
    let cuePoints = 0;
    for (const marks of [r.marks, r.marks2])
      for (const [n, cell] of Object.entries(marks)) {
        const p = huePoints(r.target, cell);
        g[n] = (g[n] ?? 0) + p;
        if (p >= 2) cuePoints++;
      }
    g[r.cue] = (g[r.cue] ?? 0) + cuePoints;
  }
  r.gained = g;
  for (const [n, p] of Object.entries(g)) {
    s.points[n] = (s.points[n] ?? 0) + p;
    const seat = seatByN(s, Number(n));
    if (seat) seat.score += p;
  }
  s.phase = 'reveal';
  s.deadline = now + REVEAL_SECONDS * 1000;
}

function finish(s: State): void {
  s.phase = 'result';
  s.deadline = null;
}

function advance(s: State, now: number): void {
  if (!inGame(s)) return;
  if (s.playing.filter((n) => isHere(s, n)).length < 2) {
    s.phase = 'lobby';
    s.deadline = null;
    return;
  }
  const r = s.round;
  if (s.phase === 'guess' && r && guessers(s).every((n) => !isHere(s, n) || n in current(r))) endGuess(s, now);
}

export function tick(s: State, now: number): void {
  if (s.deadline === null || now < s.deadline) return;
  // A cue giver who runs out of time gives nobody points this round.
  if (s.phase === 'pick') reveal(s, now);
  else if (s.phase === 'guess') endGuess(s, now);
  else if (s.phase === 'clue2') reveal(s, now);
  else if (s.phase === 'reveal') deal(s, now);
  s.updated = now;
}

export type Action =
  | { t: 'settings'; settings: Partial<Settings> }
  | { t: 'start' }
  | { t: 'pick'; cell: number }
  | { t: 'clue'; text: string }
  | { t: 'mark'; cell: number }
  | { t: 'done' }
  | { t: 'next' }
  | { t: 'lobby' }
  | { t: 'kick'; seat: number };

const choose = <T>(list: readonly T[], v: unknown): T | undefined => ((list as readonly unknown[]).includes(v) ? (v as T) : undefined);

/** The second clue: up to two words. */
export const cleanClue2 = (raw: string): string => raw.trim().split(/\s+/).slice(0, 2).map((w) => w.slice(0, 24)).join(' ');

export function act(s: State, key: string, a: Action, now: number): string | null {
  const me = seatOf(s, key);
  if (!me) return 'Join the room first.';
  const isHost = me.n === s.host;
  const r = s.round;
  const isCue = !!r && inGame(s) && me.n === r.cue;
  s.updated = now;
  switch (a?.t) {
    case 'settings': {
      if (!isHost) return 'Only the host can change the settings.';
      if (inGame(s)) return 'Change settings between games.';
      const p = a.settings ?? {};
      if (typeof p.second === 'boolean') s.settings.second = p.second;
      if (typeof p.real === 'boolean') s.settings.real = p.real;
      s.settings.laps = choose(LAPS, p.laps) ?? s.settings.laps;
      s.settings.clock = choose(CLOCKS, p.clock) ?? s.settings.clock;
      return null;
    }
    case 'start': {
      if (!isHost) return 'The host starts the game.';
      if (inGame(s)) return null;
      const here = online(s);
      if (here.length < MIN_PLAYERS) return `You need at least ${MIN_PLAYERS} players.`;
      for (const x of s.seats) x.waiting = false;
      s.playing = here.map((x) => x.n);
      s.next = 0;
      s.count = 0;
      s.total = s.playing.length * s.settings.laps;
      s.points = {};
      s.games++;
      deal(s, now);
      return null;
    }
    case 'pick':
      if (s.phase !== 'pick' || !isCue || !r!.offer.includes(a.cell)) return null;
      r!.target = a.cell;
      return null;
    case 'clue': {
      if (!isCue) return null;
      if (s.phase === 'pick') {
        if (r!.target === null) return 'Pick your color first.';
        if (s.settings.real) r!.said = true;
        else {
          const clue = cleanClue(String(a.text ?? ''));
          if (!clue) return 'Type a one-word clue.';
          r!.clue = clue;
        }
      } else if (s.phase === 'clue2') {
        if (!s.settings.real) {
          const clue = cleanClue2(String(a.text ?? ''));
          if (!clue) return 'Type your second clue.';
          r!.clue2 = clue;
        }
        r!.pass = 2;
      } else return null;
      s.phase = 'guess';
      s.deadline = now + s.settings.clock * 1000;
      return null;
    }
    case 'mark': {
      if (s.phase !== 'guess' || !r || !guessers(s).includes(me.n)) return null;
      const cell = Number(a.cell);
      if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) return null;
      current(r)[me.n] = cell;
      advance(s, now);
      return null;
    }
    case 'done':
      // No second clue this time: straight to the reveal.
      if (s.phase === 'clue2' && isCue) reveal(s, now);
      return null;
    case 'next':
      if (!isHost || !r) return null;
      if (s.phase === 'guess') endGuess(s, now);
      else if (s.phase === 'reveal') deal(s, now);
      // A cue giver who has gone away can be skipped.
      else if ((s.phase === 'pick' || s.phase === 'clue2') && !isHere(s, r.cue)) reveal(s, now);
      return null;
    case 'lobby':
      if (!isHost) return null;
      s.phase = 'lobby';
      s.deadline = null;
      return null;
    case 'kick':
      if (kickSeat(s, me, a.seat)) {
        s.playing = s.playing.filter((n) => n !== a.seat);
        if (r?.cue === a.seat && (s.phase === 'pick' || s.phase === 'clue2')) reveal(s, now);
        advance(s, now);
      }
      return null;
    default:
      return 'Unknown action.';
  }
}

export interface RoomView {
  game: 'hues';
  code: string;
  phase: Phase;
  settings: Settings;
  players: SeatView[];
  you: number;
  host: boolean;
  deadline: number | null;
  playing: number[];
  count: number;
  total: number;
  round: {
    cue: number;
    /** The cue giver's four colors, while they pick. */
    offer: number[] | null;
    /** The secret color: only on the cue giver's phone until the reveal. */
    target: number | null;
    clue: string;
    clue2: string;
    /** Real life: the cue giver said the clue out loud. */
    said: boolean;
    pass: 1 | 2;
    guessers: number[];
    /** Your own guess for the clue being guessed. */
    myMark: number | null;
    /** The first guesses, once everyone has placed them. */
    marks: Record<string, number> | null;
    /** The second guesses, at the reveal. */
    marks2: Record<string, number> | null;
    gained: Record<string, number> | null;
  } | null;
  points: Record<string, number>;
}

export function viewFor(s: State, key: string): RoomView | null {
  const me = seatOf(s, key);
  if (!me) return null;
  const r = s.round;
  const shown = s.phase === 'reveal' || s.phase === 'result';
  const firstOut = shown || s.phase === 'clue2' || (s.phase === 'guess' && r?.pass === 2);
  return {
    game: 'hues',
    code: s.code,
    phase: s.phase,
    settings: s.settings,
    players: seatViews(s, me, (n) => s.phase === 'guess' && !!r && n in current(r)),
    you: me.n,
    host: me.n === s.host,
    deadline: s.deadline,
    playing: s.playing,
    count: s.count,
    total: s.total,
    round:
      r && s.phase !== 'lobby'
        ? {
            cue: r.cue,
            offer: s.phase === 'pick' && me.n === r.cue ? r.offer : null,
            target: shown || me.n === r.cue ? r.target : null,
            clue: r.clue,
            clue2: r.clue2,
            said: !!r.said,
            pass: r.pass,
            guessers: guessers(s),
            myMark: s.phase === 'guess' ? (current(r)[me.n] ?? null) : null,
            marks: firstOut ? r.marks : null,
            marks2: shown ? r.marks2 : null,
            gained: shown ? r.gained : null,
          }
        : null,
    points: s.points,
  };
}

export function summary(s: State) {
  return summaryOf(s, 'hues', MAX_PLAYERS);
}
