/**
 * Crass Act game rules, as pure functions over a room's state. The room server (rooms/worker.ts) keeps
 * one State per room, applies players' actions with `act`, runs timers with `tick`, and sends each
 * player `viewFor(state, key)`: only their own hand, and nobody's secret key.
 *
 * A round: a judge reveals a prompt, everyone else plays one or two answer cards, the judge picks the
 * funniest (or, in vote mode, everyone votes). Cards are dealt from shuffled piles and never come
 * back until a pile runs out, so a session does not repeat cards.
 */
import { ANSWERS, pickCount, PROMPTS } from './cards';
import { ANSWERS_BG, PROMPTS_BG } from './cards-bg';

/** Which cards a room plays with (the host picks; new rooms start in the host's site language). */
export type Deck = 'en' | 'bg';
export const DECKS: Record<Deck, { prompts: readonly string[]; answers: readonly string[] }> = {
  en: { prompts: PROMPTS, answers: ANSWERS },
  bg: { prompts: PROMPTS_BG, answers: ANSWERS_BG },
};
export const isDeck = (v: unknown): v is Deck => v === 'en' || v === 'bg';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 10;
export const HAND_SIZE = 7;
export const NAME_MAX = 20;
export const TARGETS = [5, 7, 10] as const;
export const TIMERS = [45, 75, 120] as const;
const JUDGE_SECONDS = 50;
const VOTE_SECONDS = 40;
const REVEAL_SECONDS = 9;
const HISTORY = 30;

export type Phase = 'lobby' | 'picking' | 'judging' | 'reveal' | 'over';

export interface Settings {
  /** Points to win. */
  target: number;
  /** Everyone plays and votes instead of a rotating judge. */
  vote: boolean;
  /** Seconds to play a card. */
  seconds: number;
  /** The cards (rooms from before decks existed have none: English). */
  deck?: Deck;
}

export interface Seat {
  /** Secret player key (never sent to other players). */
  key: string;
  /** Public seat number. */
  n: number;
  name: string;
  score: number;
  hand: number[];
  online: boolean;
  /** Whether the one free hand swap of this game was used. */
  swapped: boolean;
  /** Joined after the round started: sits it out. */
  waiting: boolean;
}

export interface Entry {
  seat: number;
  cards: number[];
}

export interface State {
  code: string;
  created: number;
  updated: number;
  phase: Phase;
  settings: Settings;
  seats: Seat[];
  nextSeat: number;
  host: number;
  round: number;
  judge: number | null;
  prompt: number | null;
  entries: Entry[];
  /** Vote mode: voter seat → entry index. */
  votes: Record<string, number>;
  winners: number[];
  deadline: number | null;
  prompts: number[];
  answers: number[];
  seed: number;
  champion: number | null;
  history: { prompt: number; cards: number[]; seat: number; name: string }[];
}

// ------------------------------------------------------------------ helpers

function nextRandom(s: State): number {
  // mulberry32 step on the state's seed, so a room is reproducible in tests.
  s.seed = (s.seed + 0x6d2b79f5) >>> 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffleIn<T>(s: State, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(s) * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

export const cleanName = (v: unknown): string =>
  typeof v === 'string'
    ? [...v]
        .filter((ch) => ch.charCodeAt(0) >= 32)
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, NAME_MAX)
    : '';

export const validKey = (k: unknown): k is string => typeof k === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(k);

const seatOf = (s: State, key: string): Seat | undefined => s.seats.find((x) => x.key === key);
const seatN = (s: State, n: number | null): Seat | undefined => (n === null ? undefined : s.seats.find((x) => x.n === n));
const inGame = (s: State): Seat[] => s.seats.filter((x) => x.online && !x.waiting);
const deckOf = (s: State): (typeof DECKS)[Deck] => DECKS[s.settings.deck ?? 'en'];
export const promptPick = (s: State): number => (s.prompt === null ? 1 : pickCount(deckOf(s).prompts[s.prompt]!));

/** Draws an answer card; when the pile is empty, reshuffles every card not in a hand or on the table. */
function drawAnswer(s: State): number | undefined {
  if (s.answers.length === 0) {
    const out = new Set<number>([...s.seats.flatMap((x) => x.hand), ...s.entries.flatMap((e) => e.cards)]);
    s.answers = shuffleIn(
      s,
      range(deckOf(s).answers.length).filter((i) => !out.has(i)),
    );
  }
  return s.answers.pop();
}

function drawPrompt(s: State): number {
  if (s.prompts.length === 0) s.prompts = shuffleIn(s, range(deckOf(s).prompts.length));
  return s.prompts.pop()!;
}

function topUp(seat: Seat, s: State): void {
  while (seat.hand.length < HAND_SIZE) {
    const c = drawAnswer(s);
    if (c === undefined) break;
    seat.hand.push(c);
  }
}

// ------------------------------------------------------------------ room lifecycle

export function newRoom(code: string, now: number, seed: number): State {
  const s: State = {
    code,
    created: now,
    updated: now,
    phase: 'lobby',
    settings: { target: 7, vote: false, seconds: 75, deck: 'en' },
    seats: [],
    nextSeat: 1,
    host: 0,
    round: 0,
    judge: null,
    prompt: null,
    entries: [],
    votes: {},
    winners: [],
    deadline: null,
    prompts: [],
    answers: [],
    seed: seed >>> 0,
    champion: null,
    history: [],
  };
  s.prompts = shuffleIn(s, range(PROMPTS.length));
  s.answers = shuffleIn(s, range(ANSWERS.length));
  return s;
}

/** A player connects (or reconnects). Returns an error code, or null. */
export function join(s: State, key: string, rawName: string, now: number): string | null {
  const name = cleanName(rawName) || 'Player';
  const seat = seatOf(s, key);
  s.updated = now;
  if (seat) {
    seat.online = true;
    if (s.phase === 'lobby' && name !== seat.name) seat.name = uniqueName(s, name, seat.n);
    if (!s.seats.some((x) => x.n === s.host && x.online)) s.host = seat.n;
    return null;
  }
  if (s.seats.length >= MAX_PLAYERS) return 'full';
  const fresh: Seat = { key, n: s.nextSeat++, name: uniqueName(s, name), score: 0, hand: [], online: true, swapped: false, waiting: s.phase === 'picking' || s.phase === 'judging' || s.phase === 'reveal' };
  if (fresh.waiting) topUp(fresh, s);
  s.seats.push(fresh);
  if (!s.seats.some((x) => x.n === s.host && x.online)) s.host = fresh.n;
  return null;
}

function uniqueName(s: State, name: string, self?: number): string {
  const taken = new Set(s.seats.filter((x) => x.n !== self).map((x) => x.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) {
    const n = `${name.slice(0, NAME_MAX - 3)} ${i}`;
    if (!taken.has(n.toLowerCase())) return n;
  }
}

/** A player's last connection closed. */
export function leave(s: State, key: string, now: number): void {
  const seat = seatOf(s, key);
  if (!seat) return;
  seat.online = false;
  s.updated = now;
  if (s.host === seat.n) {
    const next = s.seats.find((x) => x.online);
    if (next) s.host = next.n;
  }
  if (s.phase === 'lobby') {
    // Nobody waits for someone who left the lobby.
    s.seats = s.seats.filter((x) => x !== seat);
    return;
  }
  settle(s, now);
}

function startRound(s: State, now: number): void {
  for (const x of s.seats) {
    x.waiting = false;
    topUp(x, s);
  }
  const players = inGame(s);
  if (players.length < MIN_PLAYERS) {
    // Not enough people left: back to the lobby, scores kept.
    s.phase = 'lobby';
    s.deadline = null;
    s.prompt = null;
    s.judge = null;
    s.entries = [];
    return;
  }
  s.round++;
  if (!s.settings.vote) {
    const order = s.seats.filter((x) => x.online);
    const at = order.findIndex((x) => x.n === s.judge);
    s.judge = order[(at + 1) % order.length]!.n;
  } else s.judge = null;
  s.prompt = drawPrompt(s);
  s.entries = [];
  s.votes = {};
  s.winners = [];
  s.phase = 'picking';
  s.deadline = now + (s.settings.seconds + (promptPick(s) - 1) * 20) * 1000;
}

/** Players who still have to play a card this round. */
export function stillPicking(s: State): Seat[] {
  if (s.phase !== 'picking') return [];
  return inGame(s).filter((x) => x.n !== s.judge && !s.entries.some((e) => e.seat === x.n));
}

function toJudging(s: State, now: number): void {
  if (s.entries.length === 0) return startRound(s, now);
  if (s.entries.length === 1 && !s.settings.vote) return win(s, [s.entries[0]!.seat], now);
  shuffleIn(s, s.entries);
  s.phase = 'judging';
  s.deadline = now + (s.settings.vote ? VOTE_SECONDS : JUDGE_SECONDS) * 1000;
}

function voters(s: State): Seat[] {
  return inGame(s);
}

function tally(s: State, now: number): void {
  const counts = s.entries.map(() => 0);
  for (const i of Object.values(s.votes)) if (counts[i] !== undefined) counts[i]++;
  const best = Math.max(...counts);
  const top = best > 0 ? s.entries.filter((_, i) => counts[i] === best) : [s.entries[Math.floor(nextRandom(s) * s.entries.length)]!];
  win(
    s,
    top.map((e) => e.seat),
    now,
  );
}

function win(s: State, seats: number[], now: number): void {
  s.winners = seats;
  for (const n of seats) {
    const seat = seatN(s, n);
    if (seat) seat.score++;
    const e = s.entries.find((x) => x.seat === n);
    if (e && s.prompt !== null) s.history = [{ prompt: s.prompt, cards: e.cards, seat: n, name: seat?.name ?? '' }, ...s.history].slice(0, HISTORY);
  }
  s.phase = 'reveal';
  s.deadline = now + REVEAL_SECONDS * 1000;
}

/** Two or more players share the lead at (or past) the target: play on until exactly one leads. */
export function tieBreak(s: Pick<State, 'seats' | 'settings'>): boolean {
  const [a, b] = [...s.seats].sort((x, y) => y.score - x.score);
  return !!a && !!b && a.score >= s.settings.target && a.score === b.score;
}

function afterReveal(s: State, now: number): void {
  const top = [...s.seats].sort((a, b) => b.score - a.score)[0];
  if (top && top.score >= s.settings.target && !tieBreak(s)) {
    s.phase = 'over';
    s.champion = top.n;
    s.deadline = null;
    s.entries = [];
    return;
  }
  startRound(s, now);
}

/** Moves the round on when nobody is left to wait for (after someone plays, leaves or votes). */
function settle(s: State, now: number): void {
  if (s.phase === 'picking') {
    if (inGame(s).length < MIN_PLAYERS && s.entries.length === 0) return startRound(s, now);
    if (stillPicking(s).length === 0) toJudging(s, now);
  } else if (s.phase === 'judging') {
    if (s.settings.vote) {
      const left = voters(s).filter((v) => s.votes[v.n] === undefined && s.entries.some((e) => e.seat !== v.n));
      if (left.length === 0) tally(s, now);
    }
  }
}

/** Timers: called when the deadline passes. */
export function tick(s: State, now: number): void {
  if (s.deadline === null || now < s.deadline) return;
  if (s.phase === 'picking') toJudging(s, now);
  else if (s.phase === 'judging') {
    if (s.settings.vote) tally(s, now);
    else win(s, [s.entries[Math.floor(nextRandom(s) * s.entries.length)]!.seat], now);
  } else if (s.phase === 'reveal') afterReveal(s, now);
}

// ------------------------------------------------------------------ player actions

export type Action =
  | { t: 'start' }
  | { t: 'settings'; target?: number; vote?: boolean; seconds?: number; deck?: Deck }
  | { t: 'play'; cards: number[] }
  | { t: 'pick'; entry: number }
  | { t: 'vote'; entry: number }
  | { t: 'next' }
  | { t: 'swap' }
  | { t: 'kick'; seat: number }
  | { t: 'rename'; name: string };

/** Applies a player's action. Returns an error message for the player, or null. */
export function act(s: State, key: string, a: Action, now: number): string | null {
  const me = seatOf(s, key);
  if (!me) return 'You are not in this room.';
  const isHost = me.n === s.host;
  s.updated = now;
  switch (a.t) {
    case 'start': {
      if (!isHost) return 'Only the host can start.';
      if (s.phase !== 'lobby' && s.phase !== 'over') return null;
      if (s.seats.filter((x) => x.online).length < MIN_PLAYERS) return `You need at least ${MIN_PLAYERS} players.`;
      // A new game: scores, the one free swap and the greatest hits start over. (Back from the lobby
      // after too many left, the same game goes on.)
      if (s.phase === 'over') {
        for (const x of s.seats) {
          x.score = 0;
          x.swapped = false;
        }
        s.history = [];
      }
      s.champion = null;
      s.judge = null;
      s.round = 0;
      startRound(s, now);
      return null;
    }
    case 'settings': {
      if (!isHost) return 'Only the host can change settings.';
      if (s.phase !== 'lobby' && s.phase !== 'over') return 'Settings can only change between games.';
      if (typeof a.target === 'number' && (TARGETS as readonly number[]).includes(a.target)) s.settings.target = a.target;
      if (typeof a.vote === 'boolean') s.settings.vote = a.vote;
      if (typeof a.seconds === 'number' && (TIMERS as readonly number[]).includes(a.seconds)) s.settings.seconds = a.seconds;
      if (isDeck(a.deck) && a.deck !== (s.settings.deck ?? 'en')) {
        // New cards: every hand, pile and the last game's greatest hits referred to the old ones.
        s.settings.deck = a.deck;
        for (const x of s.seats) x.hand = [];
        s.entries = [];
        s.history = [];
        s.prompts = shuffleIn(s, range(deckOf(s).prompts.length));
        s.answers = shuffleIn(s, range(deckOf(s).answers.length));
      }
      return null;
    }
    case 'play': {
      if (s.phase !== 'picking') return 'Too late for this round.';
      if (me.waiting) return 'You join in next round.';
      if (me.n === s.judge) return 'You are the judge this round.';
      if (s.entries.some((e) => e.seat === me.n)) return 'You already played.';
      const cards = Array.isArray(a.cards) ? a.cards : [];
      if (cards.length !== promptPick(s) || new Set(cards).size !== cards.length || !cards.every((c) => me.hand.includes(c))) return 'Pick the right number of cards from your hand.';
      me.hand = me.hand.filter((c) => !cards.includes(c));
      s.entries.push({ seat: me.n, cards });
      settle(s, now);
      return null;
    }
    case 'pick': {
      if (s.phase !== 'judging' || s.settings.vote) return null;
      if (me.n !== s.judge) return 'Only the judge picks.';
      const e = s.entries[a.entry];
      if (!e) return null;
      win(s, [e.seat], now);
      return null;
    }
    case 'vote': {
      if (s.phase !== 'judging' || !s.settings.vote) return null;
      if (me.waiting) return 'You join in next round.';
      const e = s.entries[a.entry];
      if (!e) return null;
      if (e.seat === me.n) return 'You cannot vote for yourself.';
      s.votes[me.n] = a.entry;
      settle(s, now);
      return null;
    }
    case 'next': {
      if (s.phase === 'reveal' && (isHost || me.n === s.judge || s.settings.vote)) afterReveal(s, now);
      return null;
    }
    case 'swap': {
      if (me.swapped) return 'You already swapped your hand this game.';
      if (s.phase !== 'picking' || s.entries.some((e) => e.seat === me.n)) return 'You can swap while choosing a card.';
      me.hand = [];
      me.swapped = true;
      topUp(me, s);
      return null;
    }
    case 'kick': {
      if (!isHost) return 'Only the host can remove players.';
      const target = seatN(s, a.seat);
      if (!target || target === me) return null;
      s.seats = s.seats.filter((x) => x !== target);
      // Votes point at entries by index: drop their card and their vote, and shift the votes after it.
      const gone = s.entries.findIndex((e) => e.seat === target.n);
      if (gone >= 0) s.entries.splice(gone, 1);
      const votes: Record<string, number> = {};
      for (const [voter, i] of Object.entries(s.votes)) if (Number(voter) !== target.n && i !== gone) votes[voter] = gone >= 0 && i > gone ? i - 1 : i;
      s.votes = votes;
      if ((s.judge === target.n || (s.phase === 'judging' && s.entries.length === 0)) && s.phase !== 'lobby' && s.phase !== 'over') startRound(s, now);
      else settle(s, now);
      return null;
    }
    case 'rename': {
      if (s.phase !== 'lobby') return 'Names can change in the lobby.';
      const name = cleanName(a.name);
      if (name) me.name = uniqueName(s, name, me.n);
      return null;
    }
  }
  return null;
}

// ------------------------------------------------------------------ what a player sees

export interface PlayerView {
  n: number;
  name: string;
  score: number;
  online: boolean;
  host: boolean;
  judge: boolean;
  /** Played a card this round (or voted, while voting). */
  done: boolean;
  waiting: boolean;
  you: boolean;
}

export interface RoomView {
  code: string;
  phase: Phase;
  round: number;
  settings: Settings;
  you: number;
  host: number;
  judge: number | null;
  players: PlayerView[];
  prompt: { id: number; text: string; pick: number } | null;
  hand: { id: number; text: string }[];
  played: boolean;
  swapped: boolean;
  waiting: boolean;
  /** Played cards: anonymous while judging; names after the reveal. */
  entries: { cards: string[]; mine: boolean; seat?: number; name?: string; votes?: number; won?: boolean }[];
  myVote: number | null;
  deadline: number | null;
  winners: number[];
  champion: number | null;
  /** Players are tied for the lead at the target: this is a tie-breaker round. */
  tiebreak: boolean;
  history: { prompt: string; cards: string[]; name: string }[];
}

export function viewFor(s: State, key: string): RoomView | null {
  const me = seatOf(s, key);
  if (!me) return null;
  const reveal = s.phase === 'reveal';
  const counts = s.entries.map((_, i) => Object.values(s.votes).filter((v) => v === i).length);
  return {
    code: s.code,
    phase: s.phase,
    round: s.round,
    settings: s.settings,
    you: me.n,
    host: s.host,
    judge: s.judge,
    players: s.seats.map((x) => ({
      n: x.n,
      name: x.name,
      score: x.score,
      online: x.online,
      host: x.n === s.host,
      judge: x.n === s.judge,
      done: s.phase === 'picking' ? s.entries.some((e) => e.seat === x.n) : s.phase === 'judging' && s.settings.vote ? s.votes[x.n] !== undefined : false,
      waiting: x.waiting,
      you: x === me,
    })),
    prompt: s.prompt === null || s.phase === 'lobby' || s.phase === 'over' ? null : { id: s.prompt, text: deckOf(s).prompts[s.prompt]!, pick: promptPick(s) },
    hand: me.hand.map((id) => ({ id, text: deckOf(s).answers[id]! })),
    played: s.entries.some((e) => e.seat === me.n),
    swapped: me.swapped,
    waiting: me.waiting,
    entries:
      s.phase === 'judging' || reveal
        ? s.entries.map((e, i) => ({
            cards: e.cards.map((c) => deckOf(s).answers[c]!),
            mine: e.seat === me.n,
            ...(reveal ? { seat: e.seat, name: seatN(s, e.seat)?.name ?? '?', votes: s.settings.vote ? counts[i] : undefined, won: s.winners.includes(e.seat) } : {}),
          }))
        : [],
    myVote: s.votes[me.n] ?? null,
    deadline: s.deadline,
    winners: s.winners,
    champion: s.champion,
    tiebreak: s.phase !== 'lobby' && s.phase !== 'over' && tieBreak(s),
    history: s.phase === 'over' ? s.history.map((h) => ({ prompt: deckOf(s).prompts[h.prompt]!, cards: h.cards.map((c) => deckOf(s).answers[c]!), name: h.name })) : [],
  };
}

/** Public summary for invite pages. */
export function summary(s: State): { code: string; phase: Phase; players: number; host: string; full: boolean } {
  return { code: s.code, phase: s.phase, players: s.seats.filter((x) => x.online).length, host: seatN(s, s.host)?.name ?? '', full: s.seats.length >= MAX_PLAYERS };
}

/** Fills a prompt's blanks with cards (for showing results). */
export function fill(prompt: string, cards: string[]): { text: string; card: boolean }[] {
  const parts = prompt.split('____');
  const out: { text: string; card: boolean }[] = [];
  parts.forEach((p, i) => {
    if (p) out.push({ text: p, card: false });
    if (i < parts.length - 1) out.push({ text: (cards[i] ?? '____').replace(/[.!?]$/, ''), card: true });
  });
  if (cards.length > parts.length - 1) out.push({ text: ` ${cards.slice(parts.length - 1).join(' ')}`, card: true });
  return out;
}
