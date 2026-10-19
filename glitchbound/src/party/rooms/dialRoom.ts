/**
 * Dial It In in a live room: only the reader's phone shows the secret spot on the tuner. They type
 * one clue, and everyone guessing drags the same needle on their own phone (whoever moved it last
 * decides) until their captain locks it in or the clock runs out. With two teams the other side's
 * captain then calls left or right for a steal point. Scoring as in the one-phone game (../dial.ts).
 *
 * Phases: lobby → clue → guess → (steal) → reveal → clue … → result.
 */
import { SPECTRUMS } from '../content/spectrums';
import { dialPoints, randomTarget, splitTeams, stealRight } from '../dial';
import { draw, rng } from '../engine';
import { joinSeat, kickSeat, leaveSeat, nextRandom, online, seatByN, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from './seats';

export { validKey } from './seats';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 16;
/** Two teams need at least this many players. */
export const TEAM_MIN = 4;
/** How many times everyone reads. */
export const LAPS = [1, 2, 3] as const;
/** Seconds to tune the needle. */
export const CLOCKS = [45, 90, 150] as const;
export const CLUE_SECONDS = 90;
export const STEAL_SECONDS = 30;
export const REVEAL_SECONDS = 12;
export const CLUE_MAX = 40;
const SCALES = SPECTRUMS.map(([a, b], i) => ({ id: `s${i}`, a, b }));

export type Phase = 'lobby' | 'clue' | 'guess' | 'steal' | 'reveal' | 'result';
export type Side = 'left' | 'right';

export interface Settings {
  teams: boolean;
  laps: (typeof LAPS)[number];
  clock: (typeof CLOCKS)[number];
}

export interface Round {
  reader: number;
  scale: [string, string];
  target: number;
  /** Empty when the reader ran out of time. */
  clue: string;
  needle: number;
  movedBy: number | null;
  call: Side | null;
  caller: number | null;
  points: number;
  steal: boolean;
}

export interface State extends RoomBase {
  game: 'dial';
  phase: Phase;
  settings: Settings;
  playing: number[];
  /** The two teams (both empty when everyone plays together). */
  sides: [number[], number[]];
  /** Where in `playing` to look for the next reader. */
  next: number;
  count: number;
  total: number;
  round: Round | null;
  /** Seat → points their clues earned this game. */
  points: Record<string, number>;
  team: [number, number];
  games: number;
  used: string[];
}

export function newRoom(code: string, now: number, seed: number): State {
  return {
    game: 'dial',
    code,
    created: now,
    updated: now,
    phase: 'lobby',
    seats: [],
    nextSeat: 1,
    host: 0,
    deadline: null,
    seed,
    settings: { teams: true, laps: 1, clock: 90 },
    playing: [],
    sides: [[], []],
    next: 0,
    count: 0,
    total: 0,
    round: null,
    points: {},
    team: [0, 0],
    games: 0,
    used: [],
  };
}

const inGame = (s: State): boolean => s.phase === 'clue' || s.phase === 'guess' || s.phase === 'steal' || s.phase === 'reveal';
const isHere = (s: State, n: number): boolean => s.seats.some((x) => x.n === n && x.online);
export const teamsOn = (s: Pick<State, 'sides'>): boolean => s.sides[0].length > 0;
const teamOf = (s: State, n: number): 0 | 1 => (s.sides[1].includes(n) ? 1 : 0);

/** Who turns the needle this round: the reader's team (or everyone), never the reader. */
export function guessers(s: State): number[] {
  const r = s.round?.reader;
  return (teamsOn(s) ? s.sides[teamOf(s, r ?? 0)] : s.playing).filter((n) => n !== r);
}

const rivals = (s: State): number[] => (teamsOn(s) && s.round ? s.sides[1 - teamOf(s, s.round.reader)]! : []);

/** The first player here from `list`, going round the table from the reader (so it changes every round). */
function captainOf(s: State, list: number[]): number | null {
  const i = s.round ? s.playing.indexOf(s.round.reader) : -1;
  const order = [...s.playing.slice(i + 1), ...s.playing.slice(0, i + 1)];
  return order.find((n) => list.includes(n) && isHere(s, n)) ?? null;
}

export function join(s: State, key: string, name: string, now: number): string | null {
  return joinSeat(s, key, name, now, MAX_PLAYERS, inGame(s));
}

export function leave(s: State, key: string, now: number): void {
  if (leaveSeat(s, key, now)) advance(s);
}

function deal(s: State, now: number): void {
  if (s.count >= s.total) return finish(s);
  // Players who joined mid-game come in from the next round (in teams, on the smaller side).
  for (const x of s.seats)
    if (x.waiting && x.online) {
      x.waiting = false;
      s.playing.push(x.n);
      if (teamsOn(s)) s.sides[s.sides[0].length <= s.sides[1].length ? 0 : 1].push(x.n);
    }
  const count = s.playing.length;
  let pick = s.next % count;
  for (let i = 0; i < count && !isHere(s, s.playing[(s.next + i) % count]!); i++) pick = (s.next + i + 1) % count;
  s.next = pick + 1;
  const r = rng(nextRandom(s));
  const d = draw(SCALES, s.used, r);
  s.used = d.used.slice(-200);
  const card = d.item ?? SCALES[0]!;
  s.round = { reader: s.playing[pick]!, scale: [card.a, card.b], target: randomTarget(r), clue: '', needle: 50, movedBy: null, call: null, caller: null, points: 0, steal: false };
  s.count++;
  s.phase = 'clue';
  s.deadline = now + CLUE_SECONDS * 1000;
}

/** The needle is in: the other team gets to steal, or straight to the reveal. */
function lockIn(s: State, now: number): void {
  if (teamsOn(s) && s.round?.clue && rivals(s).some((n) => isHere(s, n))) {
    s.phase = 'steal';
    s.deadline = now + STEAL_SECONDS * 1000;
  } else reveal(s, now);
}

function reveal(s: State, now: number): void {
  const round = s.round!;
  const pts = round.clue ? dialPoints(round.target, round.needle) : 0;
  round.points = pts;
  round.steal = !!round.call && stealRight(round.target, round.needle, round.call);
  s.points[round.reader] = (s.points[round.reader] ?? 0) + pts;
  const reader = seatByN(s, round.reader);
  if (reader) reader.score += pts;
  if (teamsOn(s)) {
    const t = teamOf(s, round.reader);
    s.team[t] += pts;
    if (round.steal) {
      s.team[t === 0 ? 1 : 0] += 1;
      const caller = round.caller === null ? undefined : seatByN(s, round.caller);
      if (caller) caller.score += 1;
    }
  }
  s.phase = 'reveal';
  s.deadline = now + REVEAL_SECONDS * 1000;
}

function finish(s: State): void {
  s.phase = 'result';
  s.deadline = null;
}

/** Back to the lobby when too few are left to play. */
function advance(s: State): void {
  if (!inGame(s) || s.playing.filter((n) => isHere(s, n)).length >= 2) return;
  s.phase = 'lobby';
  s.deadline = null;
}

export function tick(s: State, now: number): void {
  if (s.deadline === null || now < s.deadline) return;
  // A reader who runs out of time scores nothing this round.
  if (s.phase === 'clue') reveal(s, now);
  else if (s.phase === 'guess') lockIn(s, now);
  else if (s.phase === 'steal') reveal(s, now);
  else if (s.phase === 'reveal') deal(s, now);
  s.updated = now;
}

export type Action =
  | { t: 'settings'; settings: Partial<Settings> }
  | { t: 'start' }
  | { t: 'clue'; text: string }
  | { t: 'needle'; at: number }
  | { t: 'lock' }
  | { t: 'call'; side: Side }
  | { t: 'next' }
  | { t: 'lobby' }
  | { t: 'kick'; seat: number };

const pick = <T>(list: readonly T[], v: unknown): T | undefined => ((list as readonly unknown[]).includes(v) ? (v as T) : undefined);

export const cleanDialClue = (v: unknown): string =>
  typeof v === 'string'
    ? [...v]
        .filter((ch) => ch.charCodeAt(0) >= 32)
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, CLUE_MAX)
    : '';

export function act(s: State, key: string, a: Action, now: number): string | null {
  const me = seatOf(s, key);
  if (!me) return 'Join the room first.';
  const isHost = me.n === s.host;
  const round = s.round;
  s.updated = now;
  switch (a?.t) {
    case 'settings': {
      if (!isHost) return 'Only the host can change the settings.';
      if (inGame(s)) return 'Change settings between games.';
      const p = a.settings ?? {};
      if (typeof p.teams === 'boolean') s.settings.teams = p.teams;
      s.settings.laps = pick(LAPS, p.laps) ?? s.settings.laps;
      s.settings.clock = pick(CLOCKS, p.clock) ?? s.settings.clock;
      return null;
    }
    case 'start': {
      if (!isHost) return 'The host starts the game.';
      if (inGame(s)) return null;
      const here = online(s);
      if (here.length < MIN_PLAYERS) return `You need at least ${MIN_PLAYERS} players.`;
      for (const x of s.seats) x.waiting = false;
      s.playing = here.map((x) => x.n);
      s.sides = s.settings.teams && s.playing.length >= TEAM_MIN ? splitTeams(s.playing) : [[], []];
      s.next = 0;
      s.count = 0;
      s.total = s.playing.length * s.settings.laps;
      s.points = {};
      s.team = [0, 0];
      s.games++;
      deal(s, now);
      return null;
    }
    case 'clue': {
      if (s.phase !== 'clue' || !round || me.n !== round.reader) return null;
      const clue = cleanDialClue(a.text);
      if (!clue) return 'Type a clue.';
      round.clue = clue;
      s.phase = 'guess';
      s.deadline = now + s.settings.clock * 1000;
      return null;
    }
    case 'needle': {
      if (s.phase !== 'guess' || !round || !guessers(s).includes(me.n)) return null;
      const at = Number(a.at);
      if (!Number.isFinite(at)) return null;
      round.needle = Math.round(Math.max(0, Math.min(100, at)));
      round.movedBy = me.n;
      return null;
    }
    case 'lock':
      if (s.phase !== 'guess' || !round) return null;
      if (me.n !== captainOf(s, guessers(s))) return 'Your captain locks the needle in.';
      lockIn(s, now);
      return null;
    case 'call':
      if (s.phase !== 'steal' || !round || (a.side !== 'left' && a.side !== 'right')) return null;
      if (me.n !== captainOf(s, rivals(s))) return 'Your captain makes the call.';
      round.call = a.side;
      round.caller = me.n;
      reveal(s, now);
      return null;
    case 'next':
      if (!isHost || !round) return null;
      if (s.phase === 'reveal') deal(s, now);
      // A reader who has gone away can be skipped.
      else if (s.phase === 'clue' && !isHere(s, round.reader)) reveal(s, now);
      return null;
    case 'lobby':
      if (!isHost) return null;
      s.phase = 'lobby';
      s.deadline = null;
      return null;
    case 'kick':
      if (kickSeat(s, me, a.seat)) {
        s.playing = s.playing.filter((n) => n !== a.seat);
        s.sides = [s.sides[0].filter((n) => n !== a.seat), s.sides[1].filter((n) => n !== a.seat)];
        if (round?.reader === a.seat && s.phase === 'clue') reveal(s, now);
        advance(s);
      }
      return null;
    default:
      return 'Unknown action.';
  }
}

export interface RoomView {
  game: 'dial';
  code: string;
  phase: Phase;
  settings: Settings;
  players: SeatView[];
  you: number;
  host: boolean;
  deadline: number | null;
  playing: number[];
  /** The two teams, or null when everyone plays together. */
  sides: [number[], number[]] | null;
  count: number;
  total: number;
  round: {
    reader: number;
    scale: [string, string];
    clue: string;
    needle: number;
    movedBy: number | null;
    /** The secret spot: only on the reader's phone until the reveal. */
    target: number | null;
    guessers: number[];
    captain: number | null;
    /** The other team's captain, who calls left or right (teams only). */
    rivalCaptain: number | null;
    call: Side | null;
    /** Reveal only. */
    points: number | null;
    steal: boolean | null;
  } | null;
  points: Record<string, number>;
  team: [number, number];
}

export function viewFor(s: State, key: string): RoomView | null {
  const me = seatOf(s, key);
  if (!me) return null;
  const round = s.round;
  const shown = s.phase === 'reveal' || s.phase === 'result';
  return {
    game: 'dial',
    code: s.code,
    phase: s.phase,
    settings: s.settings,
    players: seatViews(s, me),
    you: me.n,
    host: me.n === s.host,
    deadline: s.deadline,
    playing: s.playing,
    sides: teamsOn(s) ? s.sides : null,
    count: s.count,
    total: s.total,
    round:
      round && s.phase !== 'lobby'
        ? {
            reader: round.reader,
            scale: round.scale,
            clue: round.clue,
            needle: round.needle,
            movedBy: round.movedBy,
            target: shown || me.n === round.reader ? round.target : null,
            guessers: guessers(s),
            captain: captainOf(s, guessers(s)),
            rivalCaptain: teamsOn(s) ? captainOf(s, rivals(s)) : null,
            call: round.call,
            points: shown ? round.points : null,
            steal: shown ? round.steal : null,
          }
        : null,
    points: s.points,
    team: s.team,
  };
}

export function summary(s: State) {
  return summaryOf(s, 'dial', MAX_PLAYERS);
}
