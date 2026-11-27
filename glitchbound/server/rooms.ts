import type { Env } from './http';

/** Room codes: five letters, no look-alikes (no I, L, O). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';

export function newRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

export const validCode = (code: unknown): code is string => typeof code === 'string' && /^[A-HJKMNP-Z]{5}$/.test(code);

/** The Durable Object that holds a room. */
export function roomStub(env: Env, code: string): ReturnType<NonNullable<Env['ROOMS']>['get']> | null {
  if (!env.ROOMS) return null;
  return env.ROOMS.get(env.ROOMS.idFromName(code));
}

export const ROOM_GAMES = ['crass-act', 'impostor', 'nhie', 'auction', 'board', 'rps', 'dial', 'unique', 'hues', 'drag', 'belot', 'backgammon', 'scribble', 'sigilfall', 'sigilfall-ring', 'sigilfall-vigil', 'crater-crew', 'prism-pals'] as const;
export type RoomGame = (typeof ROOM_GAMES)[number];
export const isRoomGame = (v: unknown): v is RoomGame => (ROOM_GAMES as readonly unknown[]).includes(v);

export interface RoomSummary {
  /** Missing on Crass Act rooms. */
  game?: RoomGame;
  code: string;
  phase: string;
  players: number;
  host: string;
  full: boolean;
  /** In the public room list. */
  listed?: boolean;
}

/** A public room as the room list shows it (rooms/lobby.ts). */
export interface ListedRoom {
  code: string;
  game: RoomGame;
  phase: string;
  players: number;
  max: number;
  host: string;
  full: boolean;
  matched: boolean;
}

/** Opens a new room for a game (a fresh code; retried on the rare clash), public or private. Null when rooms are unavailable. */
export async function openRoom(env: Env, game: RoomGame = 'crass-act', listed = false): Promise<RoomSummary | null> {
  if (!env.ROOMS) return null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newRoomCode();
    const res = await roomStub(env, code)!.fetch(`https://room/init?code=${code}&game=${game}${listed ? '&listed=1' : ''}`, { method: 'POST' });
    if (res.ok) return (await res.json()) as RoomSummary;
    if (res.status !== 409) return null;
  }
  return null;
}

/** A room's summary, or null when it does not exist (or has closed). */
export async function roomSummary(env: Env, code: string): Promise<RoomSummary | null> {
  const stub = validCode(code) ? roomStub(env, code) : null;
  const res = await stub?.fetch('https://room/info');
  return res?.ok ? ((await res.json()) as RoomSummary) : null;
}

/** The object that keeps the public room list (room codes are five capitals, so it never meets one). */
const lobbyStub = (env: Env): ReturnType<typeof roomStub> => roomStub(env, 'lobby');

/** Public rooms with a free seat, for one game or all. Null when rooms are unavailable. */
export async function listRooms(env: Env, game?: RoomGame): Promise<ListedRoom[] | null> {
  const res = await lobbyStub(env)
    ?.fetch(`https://room/lobby/list${game ? `?game=${game}` : ''}`)
    .catch(() => null);
  return res?.ok ? ((await res.json()) as { rooms: ListedRoom[] }).rooms : null;
}

/** A rated search (The Ring): the searcher's rating, a name for them kept on their device, and whether an empty queue sends them to the computer at once. */
export interface RatedSearch {
  rating: number;
  who: string;
  alone?: 'bots';
}

/**
 * Quick match: a public room of this game that is about to start and has a free seat (not one of `skip`,
 * the rooms this player already found full), else a new one held for whoever searches next. `kind`: which of the
 * game's queues, for a game with more than one. `rated`: see RatedSearch; then `code` is null when nobody else is
 * around and the searcher would rather fight the computer, and `active` is how many others searched lately. `door`: a
 * ranked room's door key, to connect with (rooms/worker.ts).
 */
export async function matchRoom(env: Env, game: RoomGame, skip: readonly string[] = [], kind = '', rated?: RatedSearch): Promise<{ code: string | null; created: boolean; active?: number; door?: string } | null> {
  const codes = skip.filter(validCode).slice(0, 10).join(',');
  // (a game with several queues names the one it wants: The Ring's 1v1, 2v2 and 3v3)
  const queue = /^[a-z0-9-]{1,12}$/.test(kind) ? kind : '';
  const extra = rated && Number.isFinite(rated.rating) && /^[a-z0-9]{6,24}$/i.test(rated.who) ? `&rating=${Math.round(rated.rating)}&who=${rated.who}${rated.alone ? '&alone=bots' : ''}` : '';
  const res = await lobbyStub(env)
    ?.fetch(`https://room/lobby/match?game=${game}${codes ? `&skip=${codes}` : ''}${queue ? `&kind=${queue}` : ''}${extra}`, { method: 'POST' })
    .catch(() => null);
  return res?.ok ? ((await res.json()) as { code: string | null; created: boolean; active?: number; door?: string }) : null;
}
