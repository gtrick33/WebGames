/**
 * Impostor in a live room: every player on their own phone, in sync. The room server
 * (rooms/worker.ts) keeps one State per room, applies actions with `act`, runs timers with `tick`
 * and sends each player `viewFor(state, key)`: their own card only, nobody's secret key, and the
 * impostors' names only once the round is over.
 *
 * Phases: lobby → reveal (everyone peeks at their card) → talk (one word each, out loud or on a
 * call) → vote (on the phones) → guess (a caught impostor picks the word from six) → result.
 */
import { ALL_THEMES, dealImpostor, impostorRng, scoreImpostor, themeById, votedOut, type ImpostorDeal, type ImpostorOutcome } from './impostor';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const NAME_MAX = 20;
export const TALK_TIMES = [0, 120, 180, 300] as const;
const VOTE_SECONDS = 75;
const GUESS_SECONDS = 30;

export type Phase = 'lobby' | 'reveal' | 'talk' | 'vote' | 'guess' | 'result';

export interface Settings {
  /** Theme ids to deal from (empty = all). */
  themes: string[];
  /** Impostors wanted (two only with seven players or more). */
  impostors: 1 | 2;
  /** Whether impostors get a hint word (else only the theme). */
  hint: boolean;
  /** Seconds of talking before the vote (0 = until someone calls the vote). */
  talk: number;
}

export interface Seat {
  key: string;
  n: number;
  name: string;
  score: number;
  online: boolean;
  /** Joined mid-round: plays from the next round. */
  waiting: boolean;
}

export interface State {
  game: 'impostor';
  code: string;
  created: number;
  updated: number;
  phase: Phase;
  settings: Settings;
  seats: Seat[];
  nextSeat: number;
  host: number;
  round: number;
  /** The round's deal; impostors and starter are seat numbers (as strings). */
  deal: ImpostorDeal | null;
  /** Seats in this round. */
  playing: number[];
  seen: number[];
  /** voter seat → voted seat. */
  votes: Record<string, number>;
  voted: number | null;
  guess: string | null;
  outcome: ImpostorOutcome | null;
  gained: Record<string, number>;
  deadline: number | null;
  used: string[];
  seed: number;
}

export const validKey = (k: unknown): k is string => typeof k === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(k);

const cleanName = (v: unknown): string =>
  typeof v === 'string'
    ? [...v]
        .filter((ch) => ch.charCodeAt(0) >= 32)
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, NAME_MAX)
    : '';

export function newRoom(code: string, now: number, seed: number): State {
  return {
    game: 'impostor',
    code,
    created: now,
    updated: now,
    phase: 'lobby',
    settings: { themes: [], impostors: 1, hint: true, talk: 0 },
    seats: [],
    nextSeat: 1,
    host: 0,
    round: 0,
    deal: null,
    playing: [],
    seen: [],
    votes: {},
    voted: null,
    guess: null,
    outcome: null,
    gained: {},
    deadline: null,
    used: [],
    seed,
  };
}

const seatOf = (s: State, key: string): Seat | undefined => s.seats.find((x) => x.key === key);
const active = (s: State): Seat[] => s.seats.filter((x) => s.playing.includes(x.n) && x.online);

function nextRandom(s: State): number {
  s.seed = (s.seed + 0x9e3779b9) >>> 0;
  return s.seed;
}

export function join(s: State, key: string, rawName: string, now: number): string | null {
  const seat = seatOf(s, key);
  const name = cleanName(rawName) || 'Player';
  if (seat) {
    seat.online = true;
    if (name !== 'Player') seat.name = uniqueName(s, name, seat.n);
  } else {
    if (s.seats.length >= MAX_PLAYERS) return 'full';
    const n = s.nextSeat++;
    s.seats.push({ key, n, name: uniqueName(s, name, n), score: 0, online: true, waiting: s.phase !== 'lobby' && s.phase !== 'result' });
  }
  // Someone coming back to an empty room takes the host role too (else nobody could start).
  if (!s.host || !s.seats.some((x) => x.n === s.host && x.online)) s.host = seatOf(s, key)!.n;
  s.updated = now;
  return null;
}

function uniqueName(s: State, name: string, n: number): string {
  let out = name;
  for (let i = 2; s.seats.some((x) => x.n !== n && x.name.toLowerCase() === out.toLowerCase()); i++) out = `${name.slice(0, NAME_MAX - 3)} ${i}`;
  return out;
}

export function leave(s: State, key: string, now: number): void {
  const seat = seatOf(s, key);
  if (!seat) return;
  seat.online = false;
  if (s.host === seat.n) s.host = s.seats.find((x) => x.online)?.n ?? s.host;
  // Nothing to keep for someone who leaves the lobby before scoring: no ghost seat, and their name is free again.
  if (s.phase === 'lobby' && seat.score === 0) s.seats = s.seats.filter((x) => x !== seat);
  s.updated = now;
  advance(s, now);
}

/** Moves on when everyone still here has done their part. */
function advance(s: State, now: number): void {
  const here = active(s);
  if (s.phase === 'reveal' && here.length && here.every((x) => s.seen.includes(x.n))) toTalk(s, now);
  else if (s.phase === 'vote' && here.length && here.every((x) => String(x.n) in s.votes)) tally(s, now);
  else if (s.phase !== 'lobby' && s.phase !== 'result' && here.length < 2) {
    s.phase = 'lobby';
    s.deadline = null;
  }
}

function toTalk(s: State, now: number): void {
  s.phase = 'talk';
  s.deadline = s.settings.talk ? now + s.settings.talk * 1000 : null;
}

function toVote(s: State, now: number): void {
  s.phase = 'vote';
  s.votes = {};
  s.deadline = now + VOTE_SECONDS * 1000;
}

function tally(s: State, now: number): void {
  const out = votedOut(Object.fromEntries(Object.entries(s.votes).map(([k, v]) => [k, String(v)])));
  s.voted = out === null ? null : Number(out);
  if (s.voted !== null && s.deal?.impostors.includes(String(s.voted))) {
    s.phase = 'guess';
    s.deadline = now + GUESS_SECONDS * 1000;
  } else finish(s);
}

function finish(s: State): void {
  if (!s.deal) return;
  const { outcome, points } = scoreImpostor(
    s.deal,
    s.playing.map(String),
    s.voted === null ? null : String(s.voted),
    s.guess,
  );
  s.outcome = outcome;
  s.gained = points;
  for (const [n, p] of Object.entries(points)) {
    const seat = s.seats.find((x) => x.n === Number(n));
    if (seat) seat.score += p;
  }
  s.phase = 'result';
  s.deadline = null;
}

function deal(s: State, now: number): void {
  for (const x of s.seats) x.waiting = false;
  s.playing = s.seats.filter((x) => x.online).map((x) => x.n);
  const r = impostorRng(nextRandom(s));
  const d = dealImpostor(s.playing.map(String), s.settings.themes, s.used, r, s.settings.impostors);
  s.deal = d.deal;
  s.used = d.used.slice(-400);
  s.round++;
  s.seen = [];
  s.votes = {};
  s.voted = null;
  s.guess = null;
  s.outcome = null;
  s.gained = {};
  s.phase = 'reveal';
  s.deadline = null;
  s.updated = now;
}

export function tick(s: State, now: number): void {
  if (s.deadline === null || now < s.deadline) return;
  if (s.phase === 'talk') toVote(s, now);
  else if (s.phase === 'vote') tally(s, now);
  else if (s.phase === 'guess') finish(s);
  s.updated = now;
}

export type Action =
  | { t: 'settings'; settings: Partial<Settings> }
  | { t: 'start' }
  | { t: 'seen' }
  | { t: 'vote_now' }
  | { t: 'vote'; seat: number }
  | { t: 'guess'; word: string }
  | { t: 'next' }
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
      if (s.phase !== 'lobby' && s.phase !== 'result') return 'Change settings between rounds.';
      const p = a.settings ?? {};
      if (Array.isArray(p.themes)) s.settings.themes = p.themes.filter((x) => typeof x === 'string' && ALL_THEMES.includes(x)).slice(0, ALL_THEMES.length);
      if (p.impostors === 1 || p.impostors === 2) s.settings.impostors = p.impostors;
      if (typeof p.hint === 'boolean') s.settings.hint = p.hint;
      if (typeof p.talk === 'number' && (TALK_TIMES as readonly number[]).includes(p.talk)) s.settings.talk = p.talk;
      return null;
    }
    case 'start':
    case 'next':
      if (!isHost) return 'The host starts the round.';
      if (s.phase !== 'lobby' && s.phase !== 'result') return null;
      if (s.seats.filter((x) => x.online).length < MIN_PLAYERS) return `You need at least ${MIN_PLAYERS} players.`;
      deal(s, now);
      return null;
    case 'seen':
      if (s.phase === 'reveal' && s.playing.includes(me.n) && !s.seen.includes(me.n)) s.seen.push(me.n);
      advance(s, now);
      return null;
    case 'vote_now':
      if (s.phase === 'reveal' && isHost) toTalk(s, now);
      else if (s.phase === 'talk' && s.playing.includes(me.n)) toVote(s, now);
      return null;
    case 'vote': {
      if (s.phase !== 'vote' || !s.playing.includes(me.n)) return null;
      if (a.seat === me.n || !s.playing.includes(a.seat)) return 'Vote for someone else in this round.';
      s.votes[String(me.n)] = a.seat;
      advance(s, now);
      return null;
    }
    case 'guess':
      if (s.phase !== 'guess' || s.voted !== me.n || typeof a.word !== 'string') return null;
      s.guess = a.word.slice(0, 60);
      finish(s);
      return null;
    case 'lobby':
      if (!isHost) return null;
      s.phase = 'lobby';
      s.deadline = null;
      return null;
    case 'kick': {
      if (!isHost || a.seat === me.n) return null;
      const i = s.seats.findIndex((x) => x.n === a.seat);
      if (i >= 0) s.seats.splice(i, 1);
      s.playing = s.playing.filter((n) => n !== a.seat);
      // Mid-vote, their vote goes, and so do votes for them (those players vote again).
      if (s.phase === 'vote') for (const [voter, to] of Object.entries(s.votes)) if (Number(voter) === a.seat || to === a.seat) delete s.votes[voter];
      advance(s, now);
      return null;
    }
    default:
      return 'Unknown action.';
  }
}

export interface PlayerView {
  n: number;
  name: string;
  score: number;
  online: boolean;
  waiting: boolean;
  you: boolean;
  host: boolean;
  /** Reveal: has looked at their card. Vote: has voted (not for whom). */
  done: boolean;
}

export interface RoomView {
  game: 'impostor';
  code: string;
  phase: Phase;
  round: number;
  settings: Settings;
  players: PlayerView[];
  you: number;
  host: boolean;
  deadline: number | null;
  /** Your card this round (null when you sit it out). */
  card: { impostor: boolean; theme: string; word: string | null; hint: string | null } | null;
  starter: number | null;
  /** Vote: who you voted for. */
  myVote: number | null;
  /** Guess: the six options (for the caught impostor; everyone sees them to follow along). */
  options: string[] | null;
  voted: number | null;
  /** Result only. */
  result: { word: string; impostors: number[]; votes: Record<string, number>; guess: string | null; outcome: ImpostorOutcome; gained: Record<string, number> } | null;
}

export function viewFor(s: State, key: string): RoomView | null {
  const me = seatOf(s, key);
  if (!me) return null;
  const d = s.deal;
  const inRound = !!d && s.playing.includes(me.n) && s.phase !== 'lobby';
  const isImpostor = !!d && d.impostors.includes(String(me.n));
  const theme = d ? (themeById(d.theme)?.name ?? d.theme) : '';
  return {
    game: 'impostor',
    code: s.code,
    phase: s.phase,
    round: s.round,
    settings: s.settings,
    players: s.seats.map((x) => ({
      n: x.n,
      name: x.name,
      score: x.score,
      online: x.online,
      waiting: x.waiting,
      you: x.n === me.n,
      host: x.n === s.host,
      done: s.phase === 'reveal' ? s.seen.includes(x.n) : s.phase === 'vote' ? String(x.n) in s.votes : false,
    })),
    you: me.n,
    host: me.n === s.host,
    deadline: s.deadline,
    card: inRound && d ? { impostor: isImpostor, theme, word: isImpostor ? null : d.word, hint: isImpostor && s.settings.hint ? d.hint : null } : null,
    starter: d && s.phase !== 'lobby' ? Number(d.starter) : null,
    myVote: s.votes[String(me.n)] ?? null,
    options: s.phase === 'guess' && d ? d.options : null,
    voted: s.phase === 'guess' || s.phase === 'result' ? s.voted : null,
    result:
      s.phase === 'result' && d && s.outcome
        ? { word: d.word, impostors: d.impostors.map(Number), votes: s.votes, guess: s.guess, outcome: s.outcome, gained: s.gained }
        : null,
  };
}

export function summary(s: State): { code: string; phase: Phase; players: number; host: string; full: boolean; game: 'impostor' } {
  return { code: s.code, phase: s.phase, players: s.seats.filter((x) => x.online).length, host: s.seats.find((x) => x.n === s.host)?.name ?? '', full: s.seats.length >= MAX_PLAYERS, game: 'impostor' };
}
