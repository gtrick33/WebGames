/**
 * Belot live: a room on the rooms worker (rooms/worker.ts) for a match on four phones. Players take
 * places at the table (partners sit opposite); the host fills empty places with computer players and
 * starts. The room runs the match with the same rules as the single-player table (logic.ts): it
 * checks every call and card, plays for the computer seats (and for anyone who drops out, until they
 * are back), and shows each phone only its own hand. Pure: no timers of its own; the worker's alarm
 * calls tick() at `deadline`.
 *
 * Phases: lobby → deal (bidding and play) → dealEnd (the score sheet) → deal … → over → (rematch) deal.
 */
import { joinSeat, kickSeat, leaveSeat, nextRandom, seatByN, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from '../../party/rooms/seats';
import { botMove, LEVELS, type Level } from './ai';
import { applyCall, bookDeal, isLegalCall, legalCards, newMatch, nextDeal, playCard, rng, type Call, type Card, type DealScore, type Deal, type Match, type Seat, type Team } from './logic';

export { validKey } from '../../party/rooms/seats';

/** Four at the table, and a few more can watch and take a place when one is free. */
export const MAX_PLAYERS = 8;
/** A computer player's pause before its move; longer after a trick fills, so everyone sees it. */
export const BOT_MS = 900;
export const TRICK_MS = 1600;
/** The first call of a deal waits for the cards to be dealt on screen. */
export const DEAL_MS = 2200;
/** Someone who has left the room is played for after this long. */
export const AWAY_MS = 4000;
/** The score sheet stays this long unless everyone presses Next first. */
export const SHEET_MS = 25000;

export type Phase = 'lobby' | 'deal' | 'dealEnd' | 'over';

export interface State extends RoomBase {
  game: 'belot';
  phase: Phase;
  /** Table place (0 bottom, counter-clockwise) → the seat number of the player there, or null. */
  places: (number | null)[];
  /** Table place → a computer player's level when one sits there. */
  bots: (Level | null)[];
  match: Match | null;
  /** The deal just finished (the score sheet), and the hanging points it took. */
  last: { score: DealScore; taken: number } | null;
  /** Seats that pressed Next on the score sheet. */
  ready: number[];
  /** When the score sheet moves on by itself. */
  sheetUntil: number | null;
  /** When the computer (or the stand-in for an absent player) moves next. */
  moveAt: number | null;
  /** When the place to act started waiting on a player who has left. */
  awaySince: number | null;
  matches: number;
}

export function newRoom(code: string, now: number, seed: number): State {
  return {
    game: 'belot',
    code,
    created: now,
    updated: now,
    phase: 'lobby',
    seats: [],
    nextSeat: 1,
    host: 0,
    deadline: null,
    seed,
    places: [null, null, null, null],
    bots: [null, null, null, null],
    match: null,
    last: null,
    ready: [],
    sheetUntil: null,
    moveAt: null,
    awaySince: null,
    matches: 0,
  };
}

const placeOf = (s: State, n: number): number => s.places.indexOf(n);

export function join(s: State, key: string, name: string, now: number): string | null {
  const err = joinSeat(s, key, name, now, MAX_PLAYERS, false);
  if (err) return err;
  const me = seatOf(s, key)!;
  // the first ones in sit down by themselves (you at the bottom, a friend opposite as your partner)
  if (s.phase === 'lobby' && placeOf(s, me.n) < 0) {
    const free = [0, 2, 1, 3].find((p) => s.places[p] === null && s.bots[p] === null);
    if (free !== undefined) s.places[free] = me.n;
  }
  schedule(s, now);
  return null;
}

export function leave(s: State, key: string, now: number): void {
  const seat = leaveSeat(s, key, now);
  if (!seat) return;
  // in the lobby a place is freed; in a match the place waits (a stand-in plays meanwhile)
  if (s.phase === 'lobby' || !s.seats.some((x) => x.n === seat.n)) {
    const p = placeOf(s, seat.n);
    if (p >= 0 && s.phase === 'lobby') s.places[p] = null;
  }
  schedule(s, now);
}

/** Who acts now: the place to move, and whether a computer does it (a bot, or a stand-in for someone away). */
function actor(s: State): { place: Seat; bot: Level | null; away: boolean } | null {
  if (s.phase !== 'deal' || !s.match) return null;
  const d = s.match.deal;
  if (d.phase !== 'bidding' && d.phase !== 'playing') return null;
  const place = d.turn;
  const bot = s.bots[place] ?? null;
  const n = s.places[place];
  const seat = n !== null && n !== undefined ? seatByN(s, n) : undefined;
  return { place, bot, away: !bot && (!seat || !seat.online) };
}

/** Sets when the computer moves next (and the room's alarm with it). */
function schedule(s: State, now: number): void {
  s.moveAt = null;
  const a = actor(s);
  if (a && a.bot) {
    const d = s.match!.deal;
    s.moveAt = now + (d.phase === 'bidding' && d.calls.length === 0 ? DEAL_MS : d.phase === 'playing' && d.trick.length === 0 && d.tricks.length > 0 ? TRICK_MS : BOT_MS);
  }
  if (a && !a.bot && a.away) {
    s.awaySince ??= now;
    s.moveAt = s.awaySince + AWAY_MS;
  } else s.awaySince = null;
  s.deadline = s.phase === 'dealEnd' ? s.sheetUntil : s.moveAt;
}

function startMatch(s: State, now: number): void {
  s.match = newMatch(nextRandom(s), (nextRandom(s) % 4) as Seat);
  s.phase = 'deal';
  s.last = null;
  s.ready = [];
  s.matches++;
  s.updated = now;
}

/** After every move: book a finished deal, re-deal a thrown one. */
function afterMove(s: State, now: number): void {
  const m = s.match!;
  if (m.deal.phase === 'thrown') s.match = nextDeal(m);
  else if (m.deal.phase === 'done') {
    const { match, score, taken } = bookDeal(m);
    s.match = match;
    s.last = { score, taken };
    s.ready = [];
    s.phase = match.winner !== null ? 'over' : 'dealEnd';
    s.sheetUntil = s.phase === 'dealEnd' ? now + SHEET_MS : null;
    if (match.winner !== null)
      for (const p of [0, 1, 2, 3]) {
        const n = s.places[p];
        const seat = n !== null && n !== undefined ? seatByN(s, n) : undefined;
        if (seat && p % 2 === match.winner) seat.score++;
      }
  }
  s.updated = now;
}

function botPlay(s: State, level: Level): void {
  const m = s.match!;
  const r = rng(nextRandom(s));
  const move = botMove(m.deal, level, r);
  if (!move) return;
  const deal: Deal = 'call' in move ? applyCall(m.deal, move.call) : playCard(m.deal, move.card);
  s.match = { ...m, deal };
}

function nextFromSheet(s: State, now: number): void {
  if (s.phase !== 'dealEnd' || !s.match) return;
  s.match = nextDeal(s.match);
  s.phase = 'deal';
  s.last = null;
  s.ready = [];
  s.sheetUntil = null;
  s.updated = now;
}

export function tick(s: State, now: number): void {
  if (s.phase === 'dealEnd' && s.sheetUntil !== null && now >= s.sheetUntil) nextFromSheet(s, now);
  // one computer move per tick (the alarm comes back for the next), so phones can follow along
  if (s.moveAt !== null && now >= s.moveAt) {
    const a = actor(s);
    if (a && (a.bot || a.away)) {
      botPlay(s, a.bot ?? 'hard');
      afterMove(s, now);
    }
  }
  schedule(s, now);
}

export type Action =
  | { t: 'sit'; place: number }
  | { t: 'stand' }
  | { t: 'bot'; place: number; level: Level | null }
  | { t: 'start' }
  | { t: 'call'; call: Call }
  | { t: 'play'; card: number; declare: boolean }
  | { t: 'next' }
  | { t: 'again' }
  | { t: 'kick'; seat: number };

const isPlace = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 4;

function cleanCall(v: unknown): Call | null {
  if (!v || typeof v !== 'object') return null;
  const c = v as Record<string, unknown>;
  if (c.k === 'pass' || c.k === 'double' || c.k === 'redouble') return { k: c.k };
  if (c.k === 'bid' && Number.isInteger(c.c) && (c.c as number) >= 0 && (c.c as number) <= 5) return { k: 'bid', c: c.c as 0 | 1 | 2 | 3 | 4 | 5 };
  return null;
}

export function act(s: State, key: string, a: Action, now: number): string | null {
  const me = seatOf(s, key);
  if (!me) return 'Join the room first.';
  s.updated = now;
  const place = placeOf(s, me.n);
  const host = me.n === s.host;
  const done = (): null => {
    schedule(s, now);
    return null;
  };
  switch (a?.t) {
    case 'sit': {
      if (s.phase !== 'lobby' || !isPlace(a.place)) return null;
      if (s.places[a.place] !== null || s.bots[a.place] !== null) return 'That place is taken.';
      if (place >= 0) s.places[place] = null;
      s.places[a.place] = me.n;
      return done();
    }
    case 'stand':
      if (s.phase === 'lobby' && place >= 0) s.places[place] = null;
      return done();
    case 'bot': {
      if (!host || s.phase !== 'lobby' || !isPlace(a.place)) return null;
      if (s.places[a.place] !== null) return 'Someone sits there.';
      s.bots[a.place] = a.level !== null && LEVELS.includes(a.level) ? a.level : null;
      return done();
    }
    case 'start': {
      if (!host || (s.phase !== 'lobby' && s.phase !== 'over')) return null;
      // empty places take the level the host used last (or Hard)
      const fallback = s.bots.find((b): b is Level => b !== null) ?? 'hard';
      for (let p = 0; p < 4; p++) if (s.places[p] === null && s.bots[p] === null) s.bots[p] = fallback;
      startMatch(s, now);
      return done();
    }
    case 'call': {
      const d = s.match?.deal;
      if (s.phase !== 'deal' || !d || d.phase !== 'bidding' || d.turn !== place) return null;
      const call = cleanCall(a.call);
      if (!call || !isLegalCall(d, call)) return 'You can’t call that now.';
      s.match = { ...s.match!, deal: applyCall(d, call) };
      afterMove(s, now);
      return done();
    }
    case 'play': {
      const d = s.match?.deal;
      if (s.phase !== 'deal' || !d || d.phase !== 'playing' || d.turn !== place) return null;
      if (!Number.isInteger(a.card) || !legalCards(d, place as Seat).includes(a.card)) return 'You can’t play that card now.';
      s.match = { ...s.match!, deal: playCard(d, a.card, a.declare === false ? [] : undefined) };
      afterMove(s, now);
      return done();
    }
    case 'next':
      if (s.phase !== 'dealEnd') return null;
      if (!s.ready.includes(me.n)) s.ready.push(me.n);
      // everyone at the table who is here pressed Next
      if (s.places.every((n) => n === null || !seatByN(s, n)?.online || s.ready.includes(n))) nextFromSheet(s, now);
      return done();
    case 'again':
      if (!host || s.phase !== 'over') return null;
      startMatch(s, now);
      return done();
    case 'kick': {
      if (s.phase !== 'lobby') return null;
      if (kickSeat(s, me, a.seat)) {
        const p = placeOf(s, a.seat);
        if (p >= 0) s.places[p] = null;
      }
      return done();
    }
    default:
      return 'Unknown action.';
  }
}

// ---------------------------------------------------------------- what each phone sees

export interface PlaceView {
  place: number;
  /** The player there (null: a computer, or nobody yet). */
  player: SeatView | null;
  bot: Level | null;
}

export interface RoomView {
  game: 'belot';
  code: string;
  phase: Phase;
  /** Your place at the table (-1: watching). */
  you: number;
  host: boolean;
  players: SeatView[];
  places: PlaceView[];
  /** The match with every other hand hidden (cards shown as -1) and declarations shown only after the first trick. */
  match: Match | null;
  last: { score: DealScore; taken: number } | null;
  ready: number[];
  deadline: number | null;
  matches: number;
}

/** A deal as one place sees it: its own hand, the others' card counts. */
export function maskDeal(d: Deal, place: number): Deal {
  return {
    ...d,
    hands: d.hands.map((h, p) => (p === place ? h : h.map(() => -1 as Card))),
    stock: [],
    // declarations are announced by kind during the first trick; the cards are shown after it
    declared: d.declared.map((list, p) => (p === place || d.tricks.length >= 1 ? list : list.map((x) => ({ ...x, cards: [] })))),
  };
}

export function viewFor(s: State, key: string): RoomView | null {
  const me = seatOf(s, key);
  if (!me) return null;
  const you = placeOf(s, me.n);
  const match = s.match ? { ...s.match, deal: maskDeal(s.match.deal, you), history: s.match.history.slice(-12) } : null;
  return {
    game: 'belot',
    code: s.code,
    phase: s.phase,
    you,
    host: me.n === s.host,
    players: seatViews(s, me, (n) => s.ready.includes(n)),
    places: [0, 1, 2, 3].map((p) => {
      const n = s.places[p];
      const seat = n !== null && n !== undefined ? seatByN(s, n) : undefined;
      return { place: p, player: seat ? seatViews(s, me).find((v) => v.n === seat.n) ?? null : null, bot: s.bots[p] ?? null };
    }),
    match,
    last: s.last,
    ready: s.ready,
    deadline: s.deadline,
    matches: s.matches,
  };
}

export function summary(s: State) {
  return summaryOf(s, 'belot', MAX_PLAYERS);
}

/** The winning team's places, for the end screen. */
export const winnersOf = (m: Match | null): Team | null => m?.winner ?? null;
