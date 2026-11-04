/**
 * A private room for The Vigil: up to four friends take seats and each picks a hero, the host picks the land, and the
 * host's game runs the night. The room only keeps the seating and each player's choices; the night goes through `relay`,
 * host to everyone and everyone to host (see vigil/snapshot.ts). Pure, and free of the game's data, so the rooms worker
 * stays small.
 */
import { joinSeat, kickSeat, leaveSeat, nextRandom, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from '../../../party/rooms/seats';

export { validKey } from '../../../party/rooms/seats';

export const MAX_PLAYERS = 4;
export const maxMessage = 32_000;

export type Phase = 'lobby' | 'run';

/** One player's choices, only ever drawn or passed to the host's night, which checks them against the game's data. */
export interface Pick {
  cls: string;
  body: 'm' | 'f';
  /** Skin, hair, hairstyle and beard, as the hero creator made them. */
  face: { skin: number; hair: number; style: string; beard: boolean } | null;
}

export interface State extends RoomBase {
  game: 'sigilfall-vigil';
  phase: Phase;
  map: string;
  picks: Record<string, Pick>;
  run: number;
  runSeed: number;
}

export interface View {
  game: 'sigilfall-vigil';
  code: string;
  phase: Phase;
  you: number;
  host: number;
  map: string;
  seats: (SeatView & { pick: Pick | null })[];
  run: number;
  runSeed: number;
}

export type Action = { t: 'pick'; pick: Pick } | { t: 'land'; map: string } | { t: 'start' } | { t: 'end' } | { t: 'bye' } | { t: 'kick'; n: number } | { t: 'r'; d: unknown };

export function newRoom(code: string, now: number, seed: number): State {
  return { game: 'sigilfall-vigil', code, created: now, updated: now, phase: 'lobby', seats: [], nextSeat: 1, host: 0, deadline: null, seed, map: 'whisperwood', picks: {}, run: 0, runSeed: 0 };
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
  if (typeof p.cls !== 'string' || !ID.test(p.cls)) return null;
  const body = p.body === 'f' ? 'f' : 'm';
  const f = p.face as Record<string, unknown> | null | undefined;
  const face = f && typeof f === 'object' && Number.isInteger(f.skin) && Number.isInteger(f.hair) && typeof f.style === 'string' && ID.test(f.style) ? { skin: f.skin as number, hair: f.hair as number, style: f.style, beard: !!f.beard } : null;
  return { cls: p.cls, body, face };
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
      s.picks[me.n] = pick;
      break;
    }
    case 'land':
      if (!host || s.phase !== 'lobby') return 'not_host';
      if (typeof a.map !== 'string' || !ID.test(a.map)) return 'bad_setup';
      s.map = a.map;
      break;
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

/** The night's traffic: straight on to everyone else, never stored. */
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
    game: 'sigilfall-vigil',
    code: s.code,
    phase: s.phase,
    you: me.n,
    host: s.host,
    map: s.map,
    seats: seatViews(s, me).map((x) => ({ ...x, pick: s.picks[x.n] ?? null })),
    run: s.run,
    runSeed: s.runSeed,
  };
}

export const summary = (s: State): ReturnType<typeof summaryOf> => summaryOf(s, 'sigilfall-vigil', MAX_PLAYERS);
