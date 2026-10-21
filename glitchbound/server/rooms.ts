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

export const ROOM_GAMES = ['crass-act', 'impostor', 'nhie', 'auction', 'board', 'rps', 'dial', 'unique', 'hues', 'drag', 'belot'] as const;
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
}

/** Opens a new room for a game (a fresh code; retried on the rare clash). Null when rooms are unavailable. */
export async function openRoom(env: Env, game: RoomGame = 'crass-act'): Promise<RoomSummary | null> {
  if (!env.ROOMS) return null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newRoomCode();
    const res = await roomStub(env, code)!.fetch(`https://room/init?code=${code}&game=${game}`, { method: 'POST' });
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
