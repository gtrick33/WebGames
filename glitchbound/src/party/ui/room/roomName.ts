/**
 * The name a player joined each live room under, so a reload (phones drop background tabs) goes
 * straight back to the seat under the same name. Kept apart from the arcade nickname: rooms take
 * up to 20 characters in any script, the arcade only 3-14 plain ones.
 */

const KEY = 'glitchbound.roomNames';
/** The longest name a room seats (rooms/seats.ts NAME_MAX). */
export const ROOM_NAME_MAX = 20;
/** Rooms remembered at most (the newest stay). */
const KEEP = 12;

interface Store {
  last?: string;
  rooms: Record<string, { name: string; at: number }>;
}

/** The name as a room will show it: no control characters, single spaces, at most 20 characters. */
export function cleanRoomName(raw: string): string {
  return [...raw.replace(/\s+/g, ' ').trim()]
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .slice(0, ROOM_NAME_MAX)
    .join('')
    .trim();
}

function read(): Store {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown;
    if (v && typeof v === 'object' && 'rooms' in v && v.rooms && typeof v.rooms === 'object') {
      const rooms: Store['rooms'] = {};
      for (const [code, r] of Object.entries(v.rooms as Record<string, unknown>)) {
        const e = r as { name?: unknown; at?: unknown } | null;
        if (e && typeof e.name === 'string' && cleanRoomName(e.name)) rooms[code] = { name: cleanRoomName(e.name), at: typeof e.at === 'number' ? e.at : 0 };
      }
      const last = (v as { last?: unknown }).last;
      return { rooms, last: typeof last === 'string' && cleanRoomName(last) ? cleanRoomName(last) : undefined };
    }
  } catch {
    /* blocked or corrupted: start empty */
  }
  return { rooms: {} };
}

const norm = (code: string): string => code.trim().toUpperCase();

/** The name this browser joined room `code` under, or null. */
export function roomNameFor(code: string): string | null {
  return read().rooms[norm(code)]?.name ?? null;
}

/** The name last used in any room (to prefill the next join form). */
export function lastRoomName(): string | null {
  return read().last ?? null;
}

/** Remembers the name for room `code`. Returns an error message (in English, for t()) or null when saved. */
export function rememberRoomName(code: string, name: string, now = Date.now()): string | null {
  const clean = cleanRoomName(name);
  if (!clean) return 'Type a name to join.';
  const s = read();
  s.rooms[norm(code)] = { name: clean, at: now };
  s.last = clean;
  const keep = Object.entries(s.rooms)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify({ last: s.last, rooms: Object.fromEntries(keep) }));
    return null;
  } catch {
    return 'Your name couldn’t be saved on this device, so a reload will ask for it again.';
  }
}

/** Forgets room `code` (the player left it on purpose). */
export function forgetRoom(code: string): void {
  const s = read();
  if (!s.rooms[norm(code)]) return;
  delete s.rooms[norm(code)];
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* nothing to forget then */
  }
}
