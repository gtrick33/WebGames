/**
 * Never Have I Ever in a live room: everyone answers in secret on their own phone ("I have" /
 * "Never"), then all answers are revealed together and fingers go down. Last one standing (or most
 * fingers when the statements run out) wins the game.
 *
 * Phases: lobby → answer → reveal → answer … → result. Answering ends when everyone still standing
 * has answered or after ANSWER_SECONDS; the reveal moves on by itself after REVEAL_SECONDS.
 */
import { NHIE } from '../content/nhie';
import { draw, rng } from '../engine';
import type { NhieCategory } from '../types';
import { joinSeat, kickSeat, leaveSeat, nextRandom, online, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from './seats';

export { validKey } from './seats';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 16;
export const ANSWER_SECONDS = 30;
export const REVEAL_SECONDS = 12;
export const FINGERS = [3, 5, 10] as const;
export const LENGTHS = [15, 30, 60] as const;
const CATEGORIES: NhieCategory[] = ['casual', 'funny', 'embarrassing', 'relationships', 'spicy', 'adults'];

export type Phase = 'lobby' | 'answer' | 'reveal' | 'result';

export interface Settings {
  categories: NhieCategory[];
  /** The host confirmed everyone is 18+ (needed for the adults category). */
  adult: boolean;
  fingers: (typeof FINGERS)[number];
  /** Most statements in one game. */
  length: (typeof LENGTHS)[number];
}

export interface State extends RoomBase {
  game: 'nhie';
  phase: Phase;
  settings: Settings;
  playing: number[];
  /** Seat → fingers left this game. */
  fingers: Record<string, number>;
  /** Seat → statements they have done this game. */
  have: Record<string, number>;
  statement: { id: string; text: string; category: NhieCategory } | null;
  count: number;
  /** Seat → their answer to the current statement (true = I have). */
  answers: Record<string, boolean>;
  winners: number[];
  /** Who was still standing before the last reveal (they share the win if it took everyone out). */
  lastIn?: number[];
  games: number;
  used: string[];
}

export function newRoom(code: string, now: number, seed: number): State {
  return {
    game: 'nhie',
    code,
    created: now,
    updated: now,
    phase: 'lobby',
    seats: [],
    nextSeat: 1,
    host: 0,
    deadline: null,
    seed,
    settings: { categories: ['casual', 'funny', 'embarrassing'], adult: false, fingers: 5, length: 30 },
    playing: [],
    fingers: {},
    have: {},
    statement: null,
    count: 0,
    answers: {},
    winners: [],
    games: 0,
    used: [],
  };
}

const inGame = (s: State): boolean => s.phase === 'answer' || s.phase === 'reveal';
/** Players still in this game with fingers up (only they need to answer). */
const standing = (s: State): number[] => s.playing.filter((n) => (s.fingers[n] ?? 0) > 0);
const standingHere = (s: State): number[] => standing(s).filter((n) => s.seats.some((x) => x.n === n && x.online));

export function join(s: State, key: string, name: string, now: number): string | null {
  return joinSeat(s, key, name, now, MAX_PLAYERS, inGame(s));
}

export function leave(s: State, key: string, now: number): void {
  if (!leaveSeat(s, key, now)) return;
  advance(s, now);
}

function deck(s: State): { id: string; text: string; category: NhieCategory }[] {
  const cats = s.settings.categories.filter((c) => c !== 'adults' || s.settings.adult);
  return NHIE.filter((x) => cats.includes(x.category));
}

function dealNext(s: State, now: number): void {
  if (s.count >= s.settings.length || standing(s).length <= 1) return finish(s);
  const d = draw(deck(s), s.used, rng(nextRandom(s)));
  if (!d.item) return finish(s);
  s.used = d.used.slice(-600);
  s.statement = { id: d.item.id, text: d.item.text, category: d.item.category };
  s.count++;
  s.answers = {};
  s.phase = 'answer';
  s.deadline = now + ANSWER_SECONDS * 1000;
}

function reveal(s: State, now: number): void {
  s.lastIn = standing(s);
  for (const n of s.lastIn) {
    if (s.answers[n] !== true) continue;
    s.fingers[n] = Math.max(0, (s.fingers[n] ?? 0) - 1);
    s.have[n] = (s.have[n] ?? 0) + 1;
  }
  s.phase = 'reveal';
  s.deadline = now + REVEAL_SECONDS * 1000;
}

function finish(s: State): void {
  const most = Math.max(0, ...s.playing.map((n) => s.fingers[n] ?? 0));
  // Nobody has a finger left: the last ones standing went out together and share the win.
  const from = most > 0 ? s.playing : (s.lastIn ?? s.playing).filter((n) => s.playing.includes(n));
  s.winners = from.filter((n) => (s.fingers[n] ?? 0) === most);
  for (const x of s.seats) if (s.winners.includes(x.n)) x.score++;
  s.phase = 'result';
  s.deadline = null;
}

function advance(s: State, now: number): void {
  if (!inGame(s)) return;
  const here = s.playing.filter((n) => s.seats.some((x) => x.n === n && x.online));
  if (here.length < 2) {
    s.phase = 'lobby';
    s.deadline = null;
    return;
  }
  if (s.phase === 'answer' && standingHere(s).every((n) => n in s.answers)) reveal(s, now);
}

export function tick(s: State, now: number): void {
  if (s.deadline === null || now < s.deadline) return;
  if (s.phase === 'answer') reveal(s, now);
  else if (s.phase === 'reveal') dealNext(s, now);
  s.updated = now;
}

export type Action =
  | { t: 'settings'; settings: Partial<Settings> }
  | { t: 'start' }
  | { t: 'answer'; have: boolean }
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
      if (inGame(s)) return 'Change settings between games.';
      const p = a.settings ?? {};
      if (typeof p.adult === 'boolean') s.settings.adult = p.adult;
      if (Array.isArray(p.categories)) {
        const cats = CATEGORIES.filter((c) => (p.categories as unknown[]).includes(c) && (c !== 'adults' || s.settings.adult));
        if (cats.length) s.settings.categories = cats;
      }
      if (!s.settings.adult) s.settings.categories = s.settings.categories.filter((c) => c !== 'adults');
      if (!s.settings.categories.length) s.settings.categories = ['casual'];
      if ((FINGERS as readonly unknown[]).includes(p.fingers)) s.settings.fingers = p.fingers as Settings['fingers'];
      if ((LENGTHS as readonly unknown[]).includes(p.length)) s.settings.length = p.length as Settings['length'];
      return null;
    }
    case 'start': {
      if (!isHost) return 'The host starts the game.';
      if (inGame(s)) return null;
      const here = online(s);
      if (here.length < MIN_PLAYERS) return `You need at least ${MIN_PLAYERS} players.`;
      for (const x of s.seats) x.waiting = false;
      s.playing = here.map((x) => x.n);
      s.fingers = Object.fromEntries(s.playing.map((n) => [n, s.settings.fingers]));
      s.have = {};
      s.count = 0;
      s.winners = [];
      s.games++;
      dealNext(s, now);
      return null;
    }
    case 'answer':
      if (s.phase !== 'answer' || !s.playing.includes(me.n) || typeof a.have !== 'boolean') return null;
      s.answers[me.n] = a.have;
      advance(s, now);
      return null;
    case 'next':
      if (s.phase === 'reveal' && isHost) dealNext(s, now);
      else if (s.phase === 'answer' && isHost) reveal(s, now);
      return null;
    case 'lobby':
      if (!isHost) return null;
      s.phase = 'lobby';
      s.deadline = null;
      return null;
    case 'kick':
      if (kickSeat(s, me, a.seat)) {
        s.playing = s.playing.filter((n) => n !== a.seat);
        advance(s, now);
      }
      return null;
    default:
      return 'Unknown action.';
  }
}

export interface RoomView {
  game: 'nhie';
  code: string;
  phase: Phase;
  settings: Settings;
  players: SeatView[];
  you: number;
  host: boolean;
  deadline: number | null;
  playing: number[];
  statement: { text: string; category: NhieCategory } | null;
  count: number;
  /** Seat → fingers left. */
  fingers: Record<string, number>;
  myAnswer: boolean | null;
  /** Reveal: you still had a finger up before this one (else your answer was just for fun). */
  wasIn: boolean;
  /** Reveal: who has done it (everyone's answers are shown together). */
  haves: number[] | null;
  /** Result: winners, and how many statements each player had done. */
  result: { winners: number[]; have: Record<string, number> } | null;
}

export function viewFor(s: State, key: string): RoomView | null {
  const me = seatOf(s, key);
  if (!me) return null;
  return {
    game: 'nhie',
    code: s.code,
    phase: s.phase,
    settings: s.settings,
    players: seatViews(s, me, (n) => s.phase === 'answer' && n in s.answers),
    you: me.n,
    host: me.n === s.host,
    deadline: s.deadline,
    playing: s.playing,
    statement: s.statement && s.phase !== 'lobby' ? { text: s.statement.text, category: s.statement.category } : null,
    count: s.count,
    fingers: s.fingers,
    myAnswer: s.phase === 'answer' || s.phase === 'reveal' ? (s.answers[me.n] ?? null) : null,
    wasIn: s.phase === 'reveal' && (s.lastIn ?? []).includes(me.n),
    haves: s.phase === 'reveal' ? s.playing.filter((n) => s.answers[n] === true) : null,
    result: s.phase === 'result' ? { winners: s.winners, have: s.have } : null,
  };
}

export function summary(s: State) {
  return summaryOf(s, 'nhie', MAX_PLAYERS);
}
