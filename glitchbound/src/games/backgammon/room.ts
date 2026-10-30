/**
 * Backgammon live: a room on the rooms worker (rooms/worker.ts) for a match on two phones. Two
 * places; the host picks the match length and can seat a computer player instead of a friend. The
 * room rolls the dice (its seeds never leave the server), checks every step with the same rules as
 * the single-player board (logic.ts), plays for the computer (and for anyone who drops out: after a
 * grace, at most STAND_IN_TURNS turns, then the match waits for them), and settles each game. With
 * nobody at the table at all the match waits. The host can turn on a turn clock (CLOCK_MS a decision,
 * then the computer plays it). Pure: the worker's alarm calls tick() at `deadline`.
 *
 * Phases: lobby → play → gameEnd (the result) → play … → over → (rematch) play.
 */
import { joinSeat, kickSeat, leaveSeat, nextRandom, seatByN, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from '../../party/rooms/seats';
import { choosePlay, LEVELS, type Level } from './ai';
import { bookGame, endTurn, mustPass, newMatch, nextGame, nextSteps, passTurn, playAll, roll, rng, step, TARGETS, turnDone, type Match, type Side } from './logic';

export { validKey } from '../../party/rooms/seats';

/** Two at the board, a few more can watch. */
export const MAX_PLAYERS = 6;
export const BOT_MS = 1100;
/** A dropped player's grace before the computer plays for them. */
export const AWAY_MS = 30000;
/** The computer plays at most this many turns in a row for someone away; then the match waits for them. */
export const STAND_IN_TURNS = 2;
/** The turn clock (when the host turns it on): this long to roll, and again to play the roll. */
export const CLOCK_MS = 60000;
/** A roll with no legal move, or a turn with no roll at all (a checker on the bar, the board closed), shows
 *  for this long before the turn passes. */
export const STUCK_MS = 1800;
/** A played-out turn passes this long after its last step if the player's board has not passed it already
 *  (it does, once the last checker lands: this only covers a lost message). */
export const DONE_MS = 4000;
export const SHEET_MS = 20000;

export type Phase = 'lobby' | 'play' | 'gameEnd' | 'over';

export interface State extends RoomBase {
  game: 'backgammon';
  phase: Phase;
  /** Place (0 bottom / light, 1 top / dark) → the seat number there, or null. */
  places: (number | null)[];
  /** A computer player in place 1 (the host's choice), or null. */
  bot: Level | null;
  target: number;
  match: Match | null;
  ready: number[];
  sheetUntil: number | null;
  moveAt: number | null;
  awaySince: number | null;
  /** The place `awaySince` belongs to (a new one to act gets its own grace). */
  awaySide?: Side | null;
  /** Turns the computer played in a row for each place while it was away (reset when they act). */
  covered?: [number, number];
  /** The host's turn clock. */
  clock?: boolean;
  /** When the current decision's clock started, and for which decision (`side:rolls`). */
  turnSince?: number | null;
  turnKey?: string | null;
  matches: number;
}

export function newRoom(code: string, now: number, seed: number): State {
  return {
    game: 'backgammon',
    code,
    created: now,
    updated: now,
    phase: 'lobby',
    seats: [],
    nextSeat: 1,
    host: 0,
    deadline: null,
    seed,
    places: [null, null],
    bot: null,
    target: 5,
    match: null,
    ready: [],
    sheetUntil: null,
    moveAt: null,
    awaySince: null,
    awaySide: null,
    covered: [0, 0],
    clock: false,
    turnSince: null,
    turnKey: null,
    matches: 0,
  };
}

const placeOf = (s: State, n: number): number => s.places.indexOf(n);

export function join(s: State, key: string, name: string, now: number): string | null {
  const err = joinSeat(s, key, name, now, MAX_PLAYERS, false);
  if (err) return err;
  const me = seatOf(s, key)!;
  if (s.phase === 'lobby' && placeOf(s, me.n) < 0) {
    const free = [0, 1].find((p) => s.places[p] === null && !(p === 1 && s.bot));
    if (free !== undefined) s.places[free] = me.n;
  }
  schedule(s, now);
  return null;
}

export function leave(s: State, key: string, now: number): void {
  const seat = leaveSeat(s, key, now);
  if (!seat) return;
  const p = placeOf(s, seat.n);
  if (p >= 0 && s.phase === 'lobby') s.places[p] = null;
  schedule(s, now);
}

/** Who acts now on the board, and whether the computer does it (the bot, or a stand-in for someone away). */
function actor(s: State): { side: Side; bot: Level | null; away: boolean } | null {
  if (s.phase !== 'play' || !s.match) return null;
  const g = s.match.game;
  if (g.phase === 'over') return null;
  // the opening roll: whoever presses Roll first (or the computer, if it is playing)
  const side: Side = g.phase === 'opening' ? 0 : g.turn;
  const bot = side === 1 && s.bot ? s.bot : null;
  const n = s.places[side];
  const seat = n !== null && n !== undefined ? seatByN(s, n) : undefined;
  return { side, bot, away: !bot && (!seat || !seat.online) };
}

/** Someone seated at the board is online (the computer player does not count). */
function anyoneHere(s: State): boolean {
  return s.places.some((n) => n !== null && n !== undefined && !!seatByN(s, n)?.online);
}

/** The decision the turn clock times: rolling, then playing the roll. */
const clockKey = (side: Side, rolls: number): string => `${side}:${rolls}`;
/** The clock can run out: a human (present) still has to roll or to play their roll. */
const clockRuns = (g: Match['game']): boolean => (g.phase === 'opening' || g.phase === 'roll' || (g.phase === 'move' && !turnDone(g))) && !mustPass(g);

/** The computer may (still) play for the away place: a turn it began, or fewer than STAND_IN_TURNS in a row. */
const mayStandIn = (s: State, side: Side, g: Match['game']): boolean => g.phase === 'move' || (s.covered?.[side] ?? 0) < STAND_IN_TURNS;

function schedule(s: State, now: number): void {
  s.moveAt = null;
  s.covered ??= [0, 0];
  const a = actor(s);
  const g = s.match?.game;
  // nobody at the table (every seated player offline): the match waits for them, whatever its phase
  const here = anyoneHere(s);
  if (a && g && here) {
    if (a.bot) s.moveAt = now + (mustPass(g) ? STUCK_MS : BOT_MS);
    else if (a.away) {
      // each place to act gets its own grace (a fresh one, not one left over from someone else)
      if (s.awaySide !== a.side || s.awaySince === null) {
        s.awaySide = a.side;
        s.awaySince = now;
      }
      if (mayStandIn(s, a.side, g)) s.moveAt = s.awaySince + AWAY_MS;
    } else if (g.phase === 'move' && turnDone(g)) s.moveAt = now + (g.steps.length ? DONE_MS : STUCK_MS);
    else if (mustPass(g)) s.moveAt = now + STUCK_MS;
    else if (s.clock && clockRuns(g)) {
      const k = clockKey(a.side, g.rolls);
      if (s.turnKey !== k || s.turnSince === null || s.turnSince === undefined) {
        s.turnKey = k;
        s.turnSince = now;
      }
      s.moveAt = s.turnSince + CLOCK_MS;
    }
    if (!a.away) {
      s.awaySince = null;
      s.awaySide = null;
    }
  } else {
    s.awaySince = null;
    s.awaySide = null;
  }
  if (!a || a.bot || a.away || !s.clock) {
    s.turnSince = null;
    s.turnKey = null;
  }
  s.deadline = s.phase === 'gameEnd' ? (here ? s.sheetUntil : null) : s.moveAt;
}

function startMatch(s: State, now: number): void {
  s.match = newMatch(nextRandom(s), s.target);
  s.phase = 'play';
  s.ready = [];
  s.matches++;
  s.updated = now;
}

/** After every change: settle a finished game. */
function afterMove(s: State, now: number): void {
  const m = s.match!;
  if (m.game.phase !== 'over') return;
  const booked = bookGame(m);
  s.match = booked;
  s.ready = [];
  s.phase = booked.winner !== null ? 'over' : 'gameEnd';
  s.sheetUntil = s.phase === 'gameEnd' ? now + SHEET_MS : null;
  if (booked.winner !== null) {
    const n = s.places[booked.winner];
    const seat = n !== null && n !== undefined ? seatByN(s, n) : undefined;
    if (seat) seat.score++;
  }
  s.updated = now;
}

/** The computer's move: one roll, or one whole play (so phones can show each). */
function computerMove(s: State, level: Level): void {
  const m = s.match!;
  let g = m.game;
  if (mustPass(g)) g = passTurn(g);
  else if (g.phase === 'opening' || g.phase === 'roll') g = roll(g);
  else if (g.phase === 'move') {
    if (turnDone(g)) g = endTurn(g);
    else g = playAll(g, choosePlay(g.pos, g.turn, g.left, level, rng(nextRandom(s))));
  }
  s.match = { ...m, game: g };
}

function nextFromSheet(s: State, now: number): void {
  if (s.phase !== 'gameEnd' || !s.match) return;
  s.match = nextGame(s.match);
  s.phase = 'play';
  s.ready = [];
  s.sheetUntil = null;
  s.updated = now;
}

export function tick(s: State, now: number): void {
  if (s.phase === 'gameEnd' && s.sheetUntil !== null && now >= s.sheetUntil && anyoneHere(s)) nextFromSheet(s, now);
  if (s.moveAt !== null && now >= s.moveAt && s.match) {
    const a = actor(s);
    const g = s.match.game;
    if (a && (a.bot || a.away)) {
      // a stand-in turn begins with its roll (or its pass): count it for the away place
      if (a.away && (g.phase === 'opening' || g.phase === 'roll')) {
        const c: [number, number] = [...(s.covered ?? [0, 0])];
        c[a.side]++;
        s.covered = c;
      }
      computerMove(s, a.bot ?? 'hard');
      afterMove(s, now);
    } else if (a && g.phase === 'move' && turnDone(g)) {
      // a roll with nothing (left) to play: the turn passes by itself
      s.match = { ...s.match, game: endTurn(g) };
    } else if (a && mustPass(g)) {
      // shut out (a checker on the bar, the board closed): no roll, the turn passes
      s.match = { ...s.match, game: passTurn(g) };
    } else if (a && s.clock && s.turnKey === clockKey(a.side, g.rolls) && clockRuns(g)) {
      // the turn clock ran out: the computer rolls, or plays the roll, for them
      computerMove(s, 'hard');
      afterMove(s, now);
    }
  }
  schedule(s, now);
}

export type Action =
  | { t: 'sit'; place: number }
  | { t: 'stand' }
  | { t: 'bot'; level: Level | null }
  | { t: 'target'; n: number }
  | { t: 'clock'; on: boolean }
  | { t: 'start' }
  | { t: 'roll' }
  | { t: 'step'; from: number; to: number; die: number }
  | { t: 'done' }
  | { t: 'next' }
  | { t: 'again' }
  | { t: 'kick'; seat: number };

const int = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

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
  const g = s.match?.game;
  const myTurn = s.phase === 'play' && !!g && place >= 0 && (g.phase === 'opening' || g.turn === place);
  // back at the board and playing: the computer's stand-in count starts again
  if (myTurn && (a?.t === 'roll' || a?.t === 'step' || a?.t === 'done') && s.covered?.[place]) {
    const c: [number, number] = [...s.covered];
    c[place] = 0;
    s.covered = c;
  }
  switch (a?.t) {
    case 'sit':
      if (s.phase !== 'lobby' || !int(a.place, 0, 1)) return null;
      if (s.places[a.place] !== null || (a.place === 1 && s.bot)) return 'That place is taken.';
      if (place >= 0) s.places[place] = null;
      s.places[a.place] = me.n;
      return done();
    case 'stand':
      if (s.phase === 'lobby' && place >= 0) s.places[place] = null;
      return done();
    case 'bot':
      if (!host || s.phase !== 'lobby') return null;
      if (a.level !== null && s.places[1] !== null) return 'Someone sits there.';
      s.bot = a.level !== null && LEVELS.includes(a.level) ? a.level : null;
      return done();
    case 'target':
      if (!host || s.phase !== 'lobby' || !(TARGETS as readonly number[]).includes(a.n)) return null;
      s.target = a.n;
      return done();
    case 'clock':
      if (!host || s.phase !== 'lobby') return null;
      s.clock = a.on === true;
      return done();
    case 'start':
      if (!host || (s.phase !== 'lobby' && s.phase !== 'over')) return null;
      if (s.places[0] === null || (s.places[1] === null && !s.bot)) return 'Two players are needed: invite a friend or seat the computer.';
      startMatch(s, now);
      return done();
    case 'roll':
      if (!myTurn || !g || (g.phase !== 'opening' && g.phase !== 'roll')) return null;
      s.match = { ...s.match!, game: roll(g) };
      return done();
    case 'step': {
      if (!myTurn || !g || g.phase !== 'move') return null;
      if (!int(a.from, 0, 25) || !int(a.to, 0, 25) || !int(a.die, 1, 6)) return null;
      const next = step(g, { from: a.from, to: a.to, die: a.die });
      if (next === g) return 'That move isn’t allowed.';
      s.match = { ...s.match!, game: next };
      afterMove(s, now);
      return done();
    }
    case 'done':
      if (!myTurn || !g || !turnDone(g)) return null;
      s.match = { ...s.match!, game: endTurn(g) };
      return done();
    case 'next':
      if (s.phase !== 'gameEnd') return null;
      if (!s.ready.includes(me.n)) s.ready.push(me.n);
      if (s.places.every((n) => n === null || !seatByN(s, n)?.online || s.ready.includes(n))) nextFromSheet(s, now);
      return done();
    case 'again':
      if (!host || s.phase !== 'over') return null;
      startMatch(s, now);
      return done();
    case 'kick':
      if (s.phase !== 'lobby') return null;
      if (kickSeat(s, me, a.seat)) {
        const p = placeOf(s, a.seat);
        if (p >= 0) s.places[p] = null;
      }
      return done();
    default:
      return 'Unknown action.';
  }
}

// ---------------------------------------------------------------- what each phone sees

export interface RoomView {
  game: 'backgammon';
  code: string;
  phase: Phase;
  /** Your place (0 or 1; -1 watching). */
  you: number;
  host: boolean;
  players: SeatView[];
  places: { player: SeatView | null; bot: Level | null }[];
  target: number;
  /** The match, its dice seeds hidden (the room rolls). */
  match: Match | null;
  ready: number[];
  deadline: number | null;
  /** A place that is away while it is its turn: when the computer plays for it (null: the match waits for them). */
  away: { place: number; at: number | null } | null;
  /** Turns the computer played for you in a row while you were away. */
  covered: number;
  /** The host's turn clock is on; when the current decision runs out (null: not running). */
  clock: boolean;
  clockAt: number | null;
}

export function viewFor(s: State, key: string): RoomView | null {
  const me = seatOf(s, key);
  if (!me) return null;
  const views = seatViews(s, me, (n) => s.ready.includes(n));
  const match = s.match ? { ...s.match, seed: 0, game: { ...s.match.game, seed: 0 } } : null;
  return {
    game: 'backgammon',
    code: s.code,
    phase: s.phase,
    you: placeOf(s, me.n),
    host: me.n === s.host,
    players: views,
    places: [0, 1].map((p) => {
      const n = s.places[p];
      return { player: n !== null && n !== undefined ? (views.find((v) => v.n === n) ?? null) : null, bot: p === 1 ? s.bot : null };
    }),
    target: s.target,
    match,
    ready: s.ready,
    deadline: s.deadline,
    away: s.awaySide !== null && s.awaySide !== undefined ? { place: s.awaySide, at: s.moveAt } : null,
    covered: placeOf(s, me.n) >= 0 ? (s.covered?.[placeOf(s, me.n)] ?? 0) : 0,
    clock: s.clock === true,
    clockAt: s.turnSince !== null && s.turnSince !== undefined ? s.turnSince + CLOCK_MS : null,
  };
}

/** The room list and invites: players are the two places (the computer counts), full once both are taken. */
export function summary(s: State) {
  const taken = s.places.filter((n) => n !== null && n !== undefined && !!seatByN(s, n)).length + (s.bot ? 1 : 0);
  return { ...summaryOf(s, 'backgammon', MAX_PLAYERS), players: taken, full: taken >= 2 };
}

/** Steps the side to move may make (the phone shows them; the room checks them again). */
export { nextSteps };
