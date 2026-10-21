/**
 * Launch Control live: a drag race against a friend in a live room (rooms/worker.ts runs it). Two
 * seats. Each player picks a car from their own garage and says ready; when both are, the room
 * sets a start time a few seconds ahead and a race seed, and both phones run the same race.
 *
 * The race itself runs on each phone (it is deterministic): a tap is sent as the sim step it was
 * applied at, the room relays it, and the other phone replays the race with it. When a racer
 * finishes, their phone sends its whole list of taps; with both lists in (or when time runs out)
 * the room replays the race itself and settles the winner, so both phones always agree.
 * Friendly: no wear, no failures, no money. Phases: lobby → race → result → (both ready) race …
 */
import { getCar } from './cars';
import { PARTS, type Levels } from './parts';
import { DT, MAX_TIME, Race, specOf, type Driver } from './sim';
import { joinSeat, kickSeat, leaveSeat, nextRandom, seatByN, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from '../../party/rooms/seats';

export { validKey } from '../../party/rooms/seats';

export const MAX_PLAYERS = 2;
/** From both ready to the green light's countdown: time for the intro and the burnout on both phones. */
export const LEAD_MS = 6000;
/** The race step the clock can't pass (MAX_TIME of race time). */
export const MAX_STEP = Math.ceil(MAX_TIME / DT);
/** A tap list never needs more (a launch and a handful of shifts, plus a few stray taps). */
export const MAX_TAPS = 40;

export type Phase = 'lobby' | 'race' | 'result';

/** A player's car for the race: one of the game's cars with their own part levels and looks. */
export interface LiveCar {
  id: string;
  levels: number[];
  paint: string;
  livery: string;
  wheels: string;
  helmet: [string, string];
  suit: string;
}

export interface Player {
  car: LiveCar | null;
  ready: boolean;
  taps: number[];
  finished: boolean;
}

export interface Outcome {
  /** Seat that won (null: nobody finished, or a dead heat). */
  winner: number | null;
  /** Seat → elapsed time and time across the line (reaction included), null when not finished. */
  times: Record<
    string,
    {
      et: number | null;
      crossed: number | null;
      perfect: number;
      shifts: number;
      trap: number;
    }
  >;
  margin: number;
}

export interface State extends RoomBase {
  game: 'drag';
  phase: Phase;
  players: Record<string, Player>;
  /** The two seats in this race, lane order (empty in the lobby). */
  lanes: number[];
  startAt: number | null;
  raceSeed: number;
  round: number;
  last: Outcome | null;
}

export function newRoom(code: string, now: number, seed: number): State {
  return {
    game: 'drag',
    code,
    created: now,
    updated: now,
    phase: 'lobby',
    seats: [],
    nextSeat: 1,
    host: 0,
    deadline: null,
    seed,
    players: {},
    lanes: [],
    startAt: null,
    raceSeed: 0,
    round: 0,
    last: null,
  };
}

const playerOf = (s: State, n: number): Player => (s.players[n] ??= { car: null, ready: false, taps: [], finished: false });

export function join(s: State, key: string, name: string, now: number): string | null {
  const err = joinSeat(s, key, name, now, MAX_PLAYERS, s.phase === 'race');
  const seat = seatOf(s, key);
  if (seat) playerOf(s, seat.n);
  return err;
}

export function leave(s: State, key: string, now: number): void {
  const seat = leaveSeat(s, key, now);
  if (!seat) return;
  // nobody waits on a friend who left: their ready is gone (the race itself runs out its clock)
  const p = s.players[seat.n];
  if (p) p.ready = false;
  if (!s.seats.some((x) => x.n === seat.n)) delete s.players[seat.n];
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const ID = /^[a-z0-9-]{1,40}$/;

/** A car sent by a phone, checked (unknown cars, odd levels or looks are refused). */
export function cleanCar(v: unknown): LiveCar | null {
  if (!v || typeof v !== 'object') return null;
  const c = v as Record<string, unknown>;
  if (typeof c.id !== 'string' || !ID.test(c.id) || !getCar(c.id) || getCar(c.id).id !== c.id) return null;
  const lv = c.levels;
  if (!Array.isArray(lv) || lv.length !== PARTS.length || !lv.every((n) => Number.isInteger(n) && n >= 0 && n <= 8)) return null;
  const str = (x: unknown): string | null => (typeof x === 'string' && ID.test(x) ? x : null);
  const helmet = c.helmet;
  if (!Array.isArray(helmet) || helmet.length !== 2 || !helmet.every((h) => typeof h === 'string' && HEX.test(h))) return null;
  if (typeof c.suit !== 'string' || !HEX.test(c.suit)) return null;
  const paint = str(c.paint);
  const livery = str(c.livery);
  const wheels = str(c.wheels);
  if (!paint || !livery || !wheels) return null;
  return {
    id: c.id,
    levels: lv as number[],
    paint,
    livery,
    wheels,
    helmet: [helmet[0] as string, helmet[1] as string],
    suit: c.suit,
  };
}

export const levelsOf = (car: LiveCar): Levels => Object.fromEntries(PARTS.map((p, i) => [p, car.levels[i] ?? 0])) as Levels;
const FULL = Object.fromEntries(PARTS.map((p) => [p, 100])) as Levels;

/** The race both phones run: the two cars at full condition (no failures) and two live drivers. */
export function liveRace(cars: LiveCar[], seed: number): Race {
  const specs = cars.map((c) => specOf(getCar(c.id), levelsOf(c), FULL, false));
  const drivers: Driver[] = cars.map(() => ({ kind: 'live' }));
  return new Race(specs, drivers, seed);
}

/**
 * Replays a race from both tap lists up to `upTo` steps (or to the end). A tap recorded at step k is
 * applied after k steps, before the next one: exactly when it happened on the phone.
 */
export function replay(race: Race, taps: readonly (readonly number[])[], upTo = MAX_STEP): Race {
  const next = taps.map(() => 0);
  for (let k = 0; k < upTo && !race.done; k++) {
    for (let i = 0; i < taps.length; i++) {
      const list = taps[i]!;
      while (next[i]! < list.length && list[next[i]!]! <= k) {
        race.tap(i);
        next[i]!++;
      }
    }
    race.step();
  }
  return race;
}

/** The winner from both lists of taps. */
export function settleRace(cars: LiveCar[], taps: number[][], seed: number, lanes: number[]): Outcome {
  const res = replay(liveRace(cars, seed), taps).result();
  const times: Outcome['times'] = {};
  lanes.forEach((n, i) => {
    const r = res.racers[i]!;
    times[n] = {
      et: r.et,
      crossed: r.crossed,
      perfect: r.perfect,
      shifts: r.shifts,
      trap: Math.round(r.trap),
    };
  });
  // inside a thousandth (what the screens show) it's a dead heat: nobody wins
  const deadHeat = res.margin < 0.0005 && res.racers.every((r) => r.crossed !== null);
  return {
    winner: res.winner === null || deadHeat ? null : lanes[res.winner]!,
    times,
    margin: deadHeat ? 0 : Math.round(res.margin * 1000) / 1000,
  };
}

function startRace(s: State, now: number): void {
  s.lanes = s.seats
    .filter((x) => x.online && s.players[x.n]?.car)
    .map((x) => x.n)
    .slice(0, 2);
  for (const n of s.lanes) Object.assign(playerOf(s, n), { ready: false, taps: [], finished: false });
  s.raceSeed = nextRandom(s);
  s.round++;
  s.startAt = now + LEAD_MS;
  s.phase = 'race';
  s.last = null;
  // the clock runs out a little after the longest possible race
  s.deadline = s.startAt + MAX_TIME * 1000 + 5000;
}

function finish(s: State): void {
  const cars = s.lanes.map((n) => s.players[n]?.car);
  if (cars.every((c): c is LiveCar => !!c)) {
    s.last = settleRace(
      cars,
      s.lanes.map((n) => s.players[n]!.taps),
      s.raceSeed,
      s.lanes,
    );
    const w = s.last.winner !== null ? seatByN(s, s.last.winner) : undefined;
    if (w) w.score++;
  }
  s.phase = 'result';
  s.deadline = null;
}

/** Both seats here, each with a car and ready: go. */
function maybeStart(s: State, now: number): void {
  const here = s.seats.filter((x) => x.online);
  if (here.length === MAX_PLAYERS && here.every((x) => s.players[x.n]?.car && s.players[x.n]?.ready)) startRace(s, now);
}

export function tick(s: State, now: number): void {
  if (s.phase === 'race' && s.deadline !== null && now >= s.deadline) {
    finish(s);
    s.updated = now;
  }
}

export type Action = { t: 'car'; car: LiveCar } | { t: 'ready'; ready: boolean } | { t: 'tap'; step: number } | { t: 'finish'; taps: number[] } | { t: 'kick'; seat: number };

const cleanTaps = (v: unknown): number[] | null => (Array.isArray(v) && v.length <= MAX_TAPS && v.every((n, i) => Number.isInteger(n) && n >= 0 && n <= MAX_STEP && (i === 0 || n >= (v[i - 1] as number))) ? (v as number[]) : null);

export function act(s: State, key: string, a: Action, now: number): string | null {
  const me = seatOf(s, key);
  if (!me) return 'Join the room first.';
  const p = playerOf(s, me.n);
  s.updated = now;
  switch (a?.t) {
    case 'car': {
      if (s.phase === 'race') return null;
      const car = cleanCar(a.car);
      if (!car) return 'That car can’t race here.';
      p.car = car;
      return null;
    }
    case 'ready':
      if (s.phase === 'race') return null;
      if (!p.car) return 'Pick your car first.';
      p.ready = a.ready === true;
      maybeStart(s, now);
      return null;
    case 'tap': {
      if (s.phase !== 'race' || !s.lanes.includes(me.n) || p.finished) return null;
      const step = a.step;
      if (!Number.isInteger(step) || step < 0 || step > MAX_STEP || p.taps.length >= MAX_TAPS || step < (p.taps[p.taps.length - 1] ?? 0)) return null;
      p.taps.push(step);
      return null;
    }
    case 'finish': {
      if (s.phase !== 'race' || !s.lanes.includes(me.n) || p.finished) return null;
      const taps = cleanTaps(a.taps);
      if (!taps) return null;
      p.taps = taps;
      p.finished = true;
      if (s.lanes.every((n) => s.players[n]?.finished)) finish(s);
      return null;
    }
    case 'kick':
      if (s.phase === 'race') return null;
      if (kickSeat(s, me, a.seat)) delete s.players[a.seat];
      return null;
    default:
      return 'Unknown action.';
  }
}

export interface PlayerView extends SeatView {
  car: LiveCar | null;
  ready: boolean;
  finished: boolean;
}

export interface RoomView {
  game: 'drag';
  code: string;
  phase: Phase;
  you: number;
  host: boolean;
  players: PlayerView[];
  lanes: number[];
  startAt: number | null;
  raceSeed: number;
  round: number;
  /** Seat → that racer's taps so far (each phone replays the other's). */
  taps: Record<string, number[]>;
  last: Outcome | null;
}

export function viewFor(s: State, key: string): RoomView | null {
  const me = seatOf(s, key);
  if (!me) return null;
  const taps: Record<string, number[]> = {};
  if (s.phase !== 'lobby') for (const n of s.lanes) taps[n] = s.players[n]?.taps ?? [];
  return {
    game: 'drag',
    code: s.code,
    phase: s.phase,
    you: me.n,
    host: me.n === s.host,
    players: seatViews(s, me, (n) => !!s.players[n]?.ready).map((v) => ({
      ...v,
      car: s.players[v.n]?.car ?? null,
      ready: !!s.players[v.n]?.ready,
      finished: !!s.players[v.n]?.finished,
    })),
    lanes: s.lanes,
    startAt: s.startAt,
    raceSeed: s.raceSeed,
    round: s.round,
    taps,
    last: s.last,
  };
}

export function summary(s: State) {
  return summaryOf(s, 'drag', MAX_PLAYERS);
}
