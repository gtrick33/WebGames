/**
 * A private room for The Ring: friends take seats on two teams, each picks a class and a bar, and the host's game runs
 * the match (empty places go to the computer). The room only keeps the seating and each player's choices; the fight
 * goes through `relay`, host to everyone and everyone to host (see ui/RingScreen.tsx). Pure, and free of the game's
 * data, so the rooms worker stays small.
 */
import { joinSeat, kickSeat, leaveSeat, nextRandom, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from '../../../party/rooms/seats';

export { validKey } from '../../../party/rooms/seats';

export const MAX_PLAYERS = 6;
export const maxMessage = 12_000;

export type Phase = 'lobby' | 'run';

/** One player's choices, only ever drawn or passed to the host's match, which checks them against the game's data. */
export interface Pick {
  team: 0 | 1;
  cls: string;
  bar: string[];
  oath: string;
  talents: string[];
  /** What they carry beside the bar: 'dash' (the Swift Step) or 'charm' (arena/abilities.ts STEPS). */
  step?: string;
  /** Their rating in the room's format, when a search brought them (arena/queue.ts): what a win over them is worth. */
  rating?: number;
}

export interface State extends RoomBase {
  game: 'sigilfall-ring';
  phase: Phase;
  format: 1 | 2 | 3;
  map: string;
  picks: Record<string, Pick>;
  run: number;
  runSeed: number;
}

export interface View {
  game: 'sigilfall-ring';
  code: string;
  phase: Phase;
  you: number;
  host: number;
  format: 1 | 2 | 3;
  map: string;
  seats: (SeatView & { pick: Pick | null })[];
  run: number;
  runSeed: number;
}

export type Action =
  | { t: 'pick'; pick: Pick }
  | { t: 'setup'; format: number; map: string }
  | { t: 'start' }
  | { t: 'end' }
  | { t: 'bye' }
  | { t: 'kick'; n: number }
  | { t: 'r'; d: unknown };

export function newRoom(code: string, now: number, seed: number): State {
  return { game: 'sigilfall-ring', code, created: now, updated: now, phase: 'lobby', seats: [], nextSeat: 1, host: 0, deadline: null, seed, format: 2, map: 'sands', picks: {}, run: 0, runSeed: 0 };
}

export function join(s: State, key: string, name: string, now: number): string | null {
  if (s.phase === 'run' && !seatOf(s, key)) return s.seats.length >= MAX_PLAYERS ? 'full' : 'in_run';
  const host = s.host;
  const err = joinSeat(s, key, name, now, MAX_PLAYERS, false);
  if (!err && s.phase === 'run' && s.seats.some((x) => x.n === host)) s.host = host;
  return err;
}

export function leave(s: State, key: string, now: number): void {
  const host = s.host;
  const seat = leaveSeat(s, key, now);
  if (seat && !s.seats.some((x) => x.n === seat.n)) delete s.picks[seat.n];
  if (s.phase === 'run' && s.seats.some((x) => x.n === host)) s.host = host;
  if (s.phase === 'run' && !s.seats.some((x) => x.online)) s.phase = 'lobby';
}

export function tick(): void {}

const ID = /^[a-z0-9-]{1,24}$/;

/** A player's choices, checked for shape and size. */
export function cleanPick(v: unknown): Pick | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  if ((p.team !== 0 && p.team !== 1) || typeof p.cls !== 'string' || !ID.test(p.cls) || typeof p.oath !== 'string' || !ID.test(p.oath)) return null;
  if (!Array.isArray(p.bar) || p.bar.length > 6 || !p.bar.every((b) => typeof b === 'string' && ID.test(b))) return null;
  const talents = Array.isArray(p.talents) && p.talents.length <= 3 && p.talents.every((b) => typeof b === 'string' && ID.test(b)) ? (p.talents as string[]) : [];
  const rating = typeof p.rating === 'number' && Number.isFinite(p.rating) ? { rating: Math.max(0, Math.min(9999, Math.round(p.rating))) } : {};
  const step = p.step === 'dash' || p.step === 'charm' ? { step: p.step } : {};
  return { team: p.team, cls: p.cls, bar: p.bar as string[], oath: p.oath, talents, ...step, ...rating };
}

export function act(s: State, key: string, a: Action, now: number): string | null {
  const me = seatOf(s, key);
  if (!me || !a || typeof a !== 'object') return 'not_seated';
  const host = me.n === s.host;
  switch (a.t) {
    case 'pick': {
      if (s.phase !== 'lobby') return 'not_lobby';
      const pick = cleanPick(a.pick);
      if (!pick) return 'bad_pick';
      // a side can't hold more than the format seats
      const taken = s.seats.filter((x) => x.n !== me.n && s.picks[x.n]?.team === pick.team).length;
      if (taken >= s.format) return 'team_full';
      s.picks[me.n] = pick;
      break;
    }
    case 'setup': {
      if (!host || s.phase !== 'lobby') return 'not_host';
      if ((a.format !== 1 && a.format !== 2 && a.format !== 3) || typeof a.map !== 'string' || !ID.test(a.map)) return 'bad_setup';
      s.format = a.format;
      s.map = a.map;
      // when the format shrinks, whoever no longer fits on a side comes off it
      for (const team of [0, 1] as const) {
        const on = s.seats.filter((x) => s.picks[x.n]?.team === team);
        for (const x of on.slice(s.format)) delete s.picks[x.n];
      }
      break;
    }
    case 'start':
      if (!host || s.phase !== 'lobby') return 'not_host';
      if (!s.picks[me.n]) return 'no_pick';
      s.phase = 'run';
      s.run++;
      s.runSeed = nextRandom(s);
      break;
    case 'end':
      if (!host || s.phase !== 'run') return 'not_host';
      s.phase = 'lobby';
      break;
    case 'bye': {
      const gone = me.n;
      s.seats = s.seats.filter((x) => x.n !== gone);
      delete s.picks[gone];
      if (s.host === gone) s.host = s.seats.find((x) => x.online)?.n ?? s.seats[0]?.n ?? s.host;
      if (s.phase === 'run' && !s.seats.some((x) => x.online)) s.phase = 'lobby';
      break;
    }
    case 'kick': {
      if (!host) return 'not_host';
      if (!kickSeat(s, me, a.n)) return 'not_host';
      delete s.picks[a.n];
      break;
    }
    default:
      return 'bad_action';
  }
  s.updated = now;
  return null;
}

/** The fight's traffic: straight on to everyone else, never stored. */
export function relay(s: State, key: string, a: Action): { others: unknown; save: boolean } | null {
  if (a?.t !== 'r') return null;
  const me = seatOf(s, key);
  if (!me || s.phase !== 'run') return { others: undefined, save: false };
  return { others: { n: me.n, d: a.d }, save: false };
}

export function viewFor(s: State, key: string): View | null {
  const me = seatOf(s, key);
  if (!me) return null;
  return {
    game: 'sigilfall-ring',
    code: s.code,
    phase: s.phase,
    you: me.n,
    host: s.host,
    format: s.format,
    map: s.map,
    seats: seatViews(s, me).map((x) => ({ ...x, pick: s.picks[x.n] ?? null })),
    run: s.run,
    runSeed: s.runSeed,
  };
}

/** (`max`: what a search fills, both sides of its format; a room of friends still seats six) */
export const summary = (s: State): ReturnType<typeof summaryOf> => ({ ...summaryOf(s, 'sigilfall-ring', MAX_PLAYERS), max: s.format * 2 });
