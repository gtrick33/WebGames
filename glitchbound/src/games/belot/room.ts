/**
 * Belot live: a room on the rooms worker (rooms/worker.ts) for a match on four phones. Players take
 * places at the table (partners sit opposite); the host fills empty places with computer players and
 * starts. The room runs the match with the same rules as the single-player table (logic.ts): it
 * checks every call and card, plays for the computer seats (and for anyone who drops out, until they
 * are back), and shows each phone only its own hand. Pure: no timers of its own; the worker's alarm
 * calls tick() at `deadline`.
 *
 * Phases: lobby → deal (bidding and play) → dealEnd (the score sheet) → deal … → over → (rematch) deal.
 * Between matches (over) places change hands as in the lobby: a watcher takes a free place, a computer
 * player's or that of someone who left.
 *
 * Every phone gets the match without its seed (the seed would rebuild every hand): `match.seed` in a
 * view is 0, and `matches` tells one match from the next.
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
/** A player still at the table gets this long for a card (and a call) before the stand-in plays it. */
export const TURN_MS = 45000;
export const BID_MS = 60000;
/** Four passes: the thrown-in deal stays on the table this long, then it is dealt again. */
export const THROWN_MS = 1800;

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
  /** The turn being waited on (match, deal, move), and since when: a player still here gets TURN_MS. */
  turnKey?: string | null;
  turnSince?: number | null;
  /** When a thrown-in deal (four passes) was left on the table. */
  thrownAt?: number | null;
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
    turnKey: null,
    turnSince: null,
    thrownAt: null,
    matches: 0,
  };
}

const placeOf = (s: State, n: number): number => s.places.indexOf(n);
/** Places change hands in the lobby and between matches. */
const seating = (s: State): boolean => s.phase === 'lobby' || s.phase === 'over';
const isSeatedOnline = (s: State, n: number): boolean => placeOf(s, n) >= 0 && !!seatByN(s, n)?.online;

/**
 * The host is someone at the table: a player who is here when there is one, otherwise a player who
 * left (back, they run the table again). A watcher never runs the table for the players; between
 * matches they can take a place, and the host role with it.
 */
function seatHost(s: State): void {
  if (isSeatedOnline(s, s.host)) return;
  const seated = s.places.filter((n): n is number => n !== null && !!seatByN(s, n));
  const here = seated.find((n) => isSeatedOnline(s, n));
  if (here !== undefined) s.host = here;
  else if (placeOf(s, s.host) < 0 && seated.length) s.host = seated[0]!;
}

export function join(s: State, key: string, name: string, now: number): string | null {
  const err = joinSeat(s, key, name, now, MAX_PLAYERS, false);
  if (err) return err;
  const me = seatOf(s, key)!;
  // the first ones in sit down by themselves (you at the bottom, a friend opposite as your partner)
  if (seating(s) && placeOf(s, me.n) < 0) {
    const free = [0, 2, 1, 3].find((p) => s.places[p] === null && s.bots[p] === null);
    if (free !== undefined) s.places[free] = me.n;
  }
  seatHost(s);
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
  seatHost(s);
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

/** Which turn the table waits on: a new key means a new turn (and a fresh clock for a player). */
const turnKeyOf = (s: State): string | null => {
  const d = s.match?.deal;
  return s.phase === 'deal' && d ? `${s.matches}:${s.match!.dealNo}:${d.calls.length}:${d.tricks.length}:${d.trick.length}` : null;
};

/** Sets when the computer moves next (and the room's alarm with it). */
function schedule(s: State, now: number): void {
  s.moveAt = null;
  const a = actor(s);
  const key = a ? turnKeyOf(s) : null;
  if (key !== (s.turnKey ?? null)) {
    s.turnKey = key;
    s.turnSince = key ? now : null;
  }
  if (a && a.bot) {
    const d = s.match!.deal;
    s.moveAt = now + (d.phase === 'bidding' && d.calls.length === 0 ? DEAL_MS : d.phase === 'playing' && d.trick.length === 0 && d.tricks.length > 0 ? TRICK_MS : BOT_MS);
  }
  if (a && !a.bot && a.away) {
    s.awaySince ??= now;
    s.moveAt = s.awaySince + AWAY_MS;
  } else s.awaySince = null;
  // a player who is here but does not move: the stand-in plays for them when their time is up
  if (a && !a.bot && !a.away) s.moveAt = (s.turnSince ?? now) + (s.match!.deal.phase === 'bidding' ? BID_MS : TURN_MS);
  if (s.phase === 'deal' && s.match?.deal.phase === 'thrown') s.moveAt = (s.thrownAt ?? now) + THROWN_MS;
  s.deadline = s.phase === 'dealEnd' ? s.sheetUntil : s.moveAt;
}

function startMatch(s: State, now: number): void {
  s.match = newMatch(nextRandom(s), (nextRandom(s) % 4) as Seat);
  s.phase = 'deal';
  s.last = null;
  s.ready = [];
  s.thrownAt = null;
  s.matches++;
  s.updated = now;
}

/** After every move: book a finished deal; a thrown one stays on show a moment (tick re-deals it). */
function afterMove(s: State, now: number): void {
  const m = s.match!;
  if (m.deal.phase === 'thrown') s.thrownAt = now;
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
  if (s.phase === 'deal' && s.match?.deal.phase === 'thrown') {
    if (now >= (s.thrownAt ?? now) + THROWN_MS) {
      s.match = nextDeal(s.match);
      s.thrownAt = null;
      s.updated = now;
    }
  } else if (s.moveAt !== null && now >= s.moveAt) {
    // one computer move per tick (the alarm comes back for the next), so phones can follow along;
    // a player whose time ran out is played for like someone who left
    const a = actor(s);
    if (a) {
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

/**
 * What can go wrong, as codes (each phone shows them in its own language): join (not in the room),
 * taken (someone at that place), call, card (not allowed now), unknown (no such action).
 */
export type ActError = 'join' | 'taken' | 'call' | 'card' | 'unknown';

export function act(s: State, key: string, a: Action, now: number): ActError | null {
  const me = seatOf(s, key);
  if (!me) return 'join';
  s.updated = now;
  const place = placeOf(s, me.n);
  const host = me.n === s.host;
  const done = (): null => {
    seatHost(s);
    schedule(s, now);
    return null;
  };
  switch (a?.t) {
    case 'sit': {
      // a free place, a computer player's, or the place of someone who has left
      if (!seating(s) || !isPlace(a.place) || a.place === place) return null;
      const there = s.places[a.place];
      if (there !== null && there !== undefined && seatByN(s, there)?.online) return 'taken';
      if (place >= 0) s.places[place] = null;
      s.places[a.place] = me.n;
      s.bots[a.place] = null;
      return done();
    }
    case 'stand':
      if (seating(s) && place >= 0) s.places[place] = null;
      return done();
    case 'bot': {
      if (!host || !seating(s) || !isPlace(a.place)) return null;
      if (s.places[a.place] !== null) return 'taken';
      s.bots[a.place] = a.level !== null && LEVELS.includes(a.level) ? a.level : null;
      return done();
    }
    case 'again':
    case 'start': {
      if (!host || !seating(s)) return null;
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
      if (!call || !isLegalCall(d, call)) return 'call';
      s.match = { ...s.match!, deal: applyCall(d, call) };
      afterMove(s, now);
      return done();
    }
    case 'play': {
      const d = s.match?.deal;
      if (s.phase !== 'deal' || !d || d.phase !== 'playing' || d.turn !== place) return null;
      if (!Number.isInteger(a.card) || !legalCards(d, place as Seat).includes(a.card)) return 'card';
      s.match = { ...s.match!, deal: playCard(d, a.card, a.declare === false ? [] : undefined) };
      afterMove(s, now);
      return done();
    }
    case 'next':
      // only the players at the table move the score sheet on
      if (s.phase !== 'dealEnd' || place < 0) return null;
      if (!s.ready.includes(me.n)) s.ready.push(me.n);
      // everyone at the table who is here pressed Next
      if (s.places.every((n) => n === null || !seatByN(s, n)?.online || s.ready.includes(n))) nextFromSheet(s, now);
      return done();
    case 'kick': {
      if (!seating(s)) return null;
      if (kickSeat(s, me, a.seat)) {
        const p = placeOf(s, a.seat);
        if (p >= 0) s.places[p] = null;
      }
      return done();
    }
    default:
      return 'unknown';
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
  /**
   * The match with every other hand hidden (cards shown as -1), declarations shown only by kind until
   * the first trick is over, and no seed (0): `matches` tells the matches apart.
   */
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
    // declarations are announced by kind during the first trick (a carré by its rank); the cards are shown after it
    declared: d.declared.map((list, p) => (p === place || d.tricks.length >= 1 ? list : list.map((x) => ({ kind: x.kind, points: x.points, rank: x.kind === 'carre' ? x.rank : 0, suit: null, cards: [] })))),
  };
}

export function viewFor(s: State, key: string): RoomView | null {
  const me = seatOf(s, key);
  if (!me) return null;
  const you = placeOf(s, me.n);
  // never the seed: it would let any phone deal every hand (and the cards still to come) itself
  const match = s.match ? { ...s.match, seed: 0, deal: maskDeal(s.match.deal, you), history: s.match.history.slice(-12) } : null;
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
