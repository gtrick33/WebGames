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
