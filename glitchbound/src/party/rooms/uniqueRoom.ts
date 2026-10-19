/**
 * One of a Kind in a live room: the same co-op rules as the one-phone game (../unique.ts), with every
 * clue giver typing their clue on their own phone at the same time. The guesser's phone only ever
 * shows the clues that survived; everyone else sees which ones cancelled out. 13 cards, right +1,
 * pass loses the card, wrong loses that card and the next.
 *
 * Phases: lobby → write → guess → verdict → write … → result. Writing ends when every clue giver has
 * a clue in (or the clock runs out); no guess before the clock runs out counts as a pass.
 */
import { MYSTERY_WORDS } from '../content/mystery';
import { draw, rng } from '../engine';
import { checkClues, cleanClue, DECK, guessIsRight, type ClueCheck } from '../unique';
import { joinSeat, kickSeat, leaveSeat, nextRandom, online, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from './seats';

export { validKey } from './seats';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 10;
/** Seconds to write a clue. */
export const CLOCKS = [45, 90, 150] as const;
export const GUESS_SECONDS = 90;
export const VERDICT_SECONDS = 20;
const GUESS_MAX = 30;
const WORDS = MYSTERY_WORDS.map((id) => ({ id }));

export type Phase = 'lobby' | 'write' | 'guess' | 'verdict' | 'result';
export type Outcome = 'right' | 'wrong' | 'pass';

export interface Settings {
  clock: (typeof CLOCKS)[number];
}

export interface Clue {
  n: number;
  clue: string;
  out: ClueCheck['out'];
}

export interface State extends RoomBase {
  game: 'unique';
  phase: Phase;
  settings: Settings;
  playing: number[];
  /** Cards dealt this game (the guesser goes round the table). */
  card: number;
  /** Where in `playing` to look for the next guesser. */
  next: number;
  guesser: number;
  word: string;
  /** Seat → their clue while writing (secret until writing ends). */
  clues: Record<string, string>;
  checked: Clue[];
  outcome: Outcome | null;
  guess: string;
  cardsLeft: number;
  score: number;
  history: { word: string; outcome: Outcome; guesser: number }[];
  games: number;
  used: string[];
}

export function newRoom(code: string, now: number, seed: number): State {
  return {
    game: 'unique',
    code,
    created: now,
    updated: now,
    phase: 'lobby',
    seats: [],
    nextSeat: 1,
    host: 0,
    deadline: null,
    seed,
    settings: { clock: 90 },
    playing: [],
    card: 0,
    next: 0,
    guesser: 0,
    word: '',
    clues: {},
    checked: [],
    outcome: null,
    guess: '',
    cardsLeft: DECK,
    score: 0,
    history: [],
    games: 0,
    used: [],
  };
}

const inGame = (s: State): boolean => s.phase === 'write' || s.phase === 'guess' || s.phase === 'verdict';
const isHere = (s: State, n: number): boolean => s.seats.some((x) => x.n === n && x.online);
const givers = (s: State): number[] => s.playing.filter((n) => n !== s.guesser);

export function join(s: State, key: string, name: string, now: number): string | null {
  return joinSeat(s, key, name, now, MAX_PLAYERS, inGame(s));
}

export function leave(s: State, key: string, now: number): void {
  if (!leaveSeat(s, key, now)) return;
  advance(s, now);
}

function deal(s: State, now: number): void {
  if (s.cardsLeft <= 0) return finish(s);
  // Players who joined mid-game write clues from the next card on.
  for (const x of s.seats)
    if (x.waiting && x.online) {
      x.waiting = false;
      s.playing.push(x.n);
    }
  const count = s.playing.length;
  let pick = s.next % count;
  for (let i = 0; i < count && !isHere(s, s.playing[(s.next + i) % count]!); i++) pick = (s.next + i + 1) % count;
  s.guesser = s.playing[pick]!;
  s.next = pick + 1;
  newWord(s);
  s.card++;
  s.clues = {};
  s.checked = [];
  s.outcome = null;
  s.guess = '';
  s.phase = 'write';
  s.deadline = now + s.settings.clock * 1000;
}

function newWord(s: State): void {
  const d = draw(WORDS, s.used, rng(nextRandom(s)));
  s.used = d.used.slice(-300);
  s.word = d.item?.id ?? MYSTERY_WORDS[0]!;
}

/** Writing is over: the clues are checked against each other and the guesser gets the survivors. */
function check(s: State, now: number): void {
  const from = givers(s).filter((n) => n in s.clues || isHere(s, n));
  const marked = checkClues(
    s.word,
    from.map((n) => s.clues[n] ?? ''),
  );
  s.checked = from.map((n, i) => ({ n, clue: marked[i]!.clue, out: marked[i]!.out }));
  s.phase = 'guess';
  s.deadline = now + GUESS_SECONDS * 1000;
}

function judge(s: State, outcome: Outcome, guess: string, now: number): void {
  s.outcome = outcome;
  s.guess = guess;
  if (outcome === 'right') s.score++;
  s.cardsLeft = Math.max(0, s.cardsLeft - (outcome === 'wrong' ? 2 : 1));
  s.history.push({ word: s.word, outcome, guesser: s.guesser });
  s.phase = 'verdict';
  s.deadline = now + VERDICT_SECONDS * 1000;
}

/** Played together: everyone who played adds the table's score to their room score. */
function finish(s: State): void {
  for (const x of s.seats) if (s.playing.includes(x.n)) x.score += s.score;
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
  if (s.phase === 'write' && givers(s).every((n) => !isHere(s, n) || n in s.clues)) check(s, now);
}

export function tick(s: State, now: number): void {
  if (s.deadline === null || now < s.deadline) return;
  if (s.phase === 'write') check(s, now);
  else if (s.phase === 'guess') judge(s, 'pass', '', now);
  else if (s.phase === 'verdict') deal(s, now);
  s.updated = now;
}

export type Action =
  | { t: 'settings'; settings: Partial<Settings> }
  | { t: 'start' }
  | { t: 'clue'; text: string }
  | { t: 'swap' }
  | { t: 'guess'; text: string }
  | { t: 'pass' }
  | { t: 'next' }
  | { t: 'lobby' }
  | { t: 'kick'; seat: number };

export function act(s: State, key: string, a: Action, now: number): string | null {
  const me = seatOf(s, key);
  if (!me) return 'Join the room first.';
  const isHost = me.n === s.host;
  const giving = s.playing.includes(me.n) && me.n !== s.guesser;
  s.updated = now;
  switch (a?.t) {
    case 'settings': {
      if (!isHost) return 'Only the host can change the settings.';
      if (inGame(s)) return 'Change settings between games.';
      const clock = a.settings?.clock;
      if ((CLOCKS as readonly unknown[]).includes(clock)) s.settings.clock = clock as Settings['clock'];
      return null;
    }
    case 'start': {
      if (!isHost) return 'The host starts the game.';
      if (inGame(s)) return null;
      const here = online(s);
      if (here.length < MIN_PLAYERS) return `You need at least ${MIN_PLAYERS} players.`;
      for (const x of s.seats) x.waiting = false;
      s.playing = here.map((x) => x.n);
      s.card = 0;
      s.next = 0;
      s.cardsLeft = DECK;
      s.score = 0;
      s.history = [];
      s.games++;
      deal(s, now);
      return null;
    }
    case 'clue': {
      if (s.phase !== 'write' || !giving) return null;
      const clue = cleanClue(String(a.text ?? ''));
      if (!clue) return 'Type a one-word clue.';
      s.clues[me.n] = clue;
      advance(s, now);
      return null;
    }
    case 'swap':
      // Nobody knows the word? Another one, but only before the first clue is in.
      if (s.phase !== 'write' || !giving) return null;
      if (Object.keys(s.clues).length) return 'Too late: clues are already in for this word.';
      newWord(s);
      return null;
    case 'guess': {
      if (s.phase !== 'guess' || me.n !== s.guesser) return null;
      const guess = String(a.text ?? '')
        .trim()
        .slice(0, GUESS_MAX);
      if (!guess) return 'Type your guess.';
      judge(s, guessIsRight(s.word, guess) ? 'right' : 'wrong', guess, now);
      return null;
    }
    case 'pass':
      if (s.phase === 'guess' && me.n === s.guesser) judge(s, 'pass', '', now);
      return null;
    case 'next':
      if (!isHost) return null;
      if (s.phase === 'write') check(s, now);
      // A guesser who has gone away can be skipped (it counts as a pass).
      else if (s.phase === 'guess' && !isHere(s, s.guesser)) judge(s, 'pass', '', now);
      else if (s.phase === 'verdict') deal(s, now);
      return null;
    case 'lobby':
      if (!isHost) return null;
      s.phase = 'lobby';
      s.deadline = null;
      return null;
    case 'kick':
      if (kickSeat(s, me, a.seat)) {
        s.playing = s.playing.filter((n) => n !== a.seat);
        if (s.phase === 'guess' && a.seat === s.guesser) judge(s, 'pass', '', now);
        advance(s, now);
      }
      return null;
    default:
      return 'Unknown action.';
  }
}

export interface RoomView {
  game: 'unique';
  code: string;
  phase: Phase;
  settings: Settings;
  players: SeatView[];
  you: number;
  host: boolean;
  deadline: number | null;
  playing: number[];
  card: number;
  guesser: number | null;
  /** The secret word: never on the guesser's phone until the card is over. */
  word: string | null;
  myClue: string | null;
  /** May you swap the word for another (no clues in yet)? */
  canSwap: boolean;
  /**
   * The checked clues. The guesser only gets the ones that survived; everyone else sees every clue
   * and why the cancelled ones were removed.
   */
  clues: Clue[] | null;
  /** Guess and verdict: how many clues cancelled each other out, and how many were removed for other reasons (empty, or too close to the word). */
  cancelled: { twins: number; other: number } | null;
  outcome: Outcome | null;
  guess: string;
  cardsLeft: number;
  score: number;
  deck: number;
  history: State['history'];
}

export function viewFor(s: State, key: string): RoomView | null {
  const me = seatOf(s, key);
  if (!me) return null;
  const guessing = inGame(s) && me.n === s.guesser;
  const over = s.phase === 'verdict';
  const clues = s.phase === 'guess' || over ? (guessing && !over ? s.checked.filter((c) => !c.out) : s.checked) : null;
  return {
    game: 'unique',
    code: s.code,
    phase: s.phase,
    settings: s.settings,
    players: seatViews(s, me, (n) => s.phase === 'write' && n in s.clues),
    you: me.n,
    host: me.n === s.host,
    deadline: s.deadline,
    playing: s.playing,
    card: s.card,
    guesser: inGame(s) ? s.guesser : null,
    word: inGame(s) && (!guessing || over) ? s.word : null,
    myClue: s.phase === 'write' ? (s.clues[me.n] ?? null) : null,
    canSwap: s.phase === 'write' && !guessing && s.playing.includes(me.n) && !Object.keys(s.clues).length,
    clues,
    cancelled: clues ? { twins: s.checked.filter((c) => c.out === 'twin').length, other: s.checked.filter((c) => c.out && c.out !== 'twin').length } : null,
    outcome: over ? s.outcome : null,
    guess: over ? s.guess : '',
    cardsLeft: s.cardsLeft,
    score: s.score,
    deck: DECK,
    history: s.phase === 'result' || over ? s.history : [],
  };
}

export function summary(s: State) {
  return summaryOf(s, 'unique', MAX_PLAYERS);
}
