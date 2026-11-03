/**
 * What every Party Mode live room shares (Never Have I Ever, Name Your Price, Dice Adventure and the rest):
 * seats keyed by a player's private key, unique names, a host who hands over when they leave, kicks,
 * and a seeded random source kept in the room state. Pure: the room server runs it (rooms/worker.ts).
 */
import { BLOCKED } from '../../platform/progression';

export const NAME_MAX = 20;

export interface Seat {
  key: string;
  n: number;
  name: string;
  /** Points across the games played in this room. */
  score: number;
  online: boolean;
  /** Joined mid-game: plays from the next game. */
  waiting: boolean;
  /** When an empty-handed lobby seat lost its connection (kept for AWAY_MS in case they come straight back). */
  awaySince?: number;
}

/** The fields every room state has; each game adds its own. */
export interface RoomBase {
  code: string;
  created: number;
  updated: number;
  phase: string;
  seats: Seat[];
  nextSeat: number;
  host: number;
  deadline: number | null;
  seed: number;
  /** Keys the host removed: they can't sit down again (the latest KICKED_MAX). Missing in older rooms. */
  kicked?: string[];
  /** The host who dropped out a moment ago: they get the role back if they return before `until`. */
  hostAway?: { n: number; until: number };
}

/** How long a dropped player keeps an empty lobby seat, and a dropped host the right to the host role. */
export const AWAY_MS = 60_000;
export const KICKED_MAX = 50;

export const validKey = (k: unknown): k is string => typeof k === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(k);

const graphemes = (v: string): string[] => (typeof Intl.Segmenter === 'function' ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(v), (x) => x.segment) : [...v]);

/** The longest start of `v` that fits in `max` UTF-16 units without splitting a character or an emoji. */
export function cutName(v: string, max: number): string {
  let out = '';
  for (const g of graphemes(v)) {
    if (out.length + g.length > max) break;
    out += g;
  }
  return out;
}

/** A name carrying a word no nickname may carry (progression.ts), looking through spaces and symbols. */
export const isBlockedName = (name: string): boolean => {
  const low = name.normalize('NFKC').toLowerCase().replace(/[^a-z]/g, '');
  return BLOCKED.some((w) => low.includes(w));
};

const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/**
 * A name as shown: no control or invisible format characters (zero-width spaces, direction marks), except
 * the joiners inside an emoji, single spaces, at most NAME_MAX long.
 */
export const cleanName = (v: unknown): string =>
  typeof v === 'string'
    ? cutName(
        graphemes(v)
          .map((g) => (g.length > 1 && EMOJI.test(g) ? g.replace(/[\p{Cc}]/gu, '') : g.replace(/[\p{Cc}\p{Cf}]/gu, '')))
          .join('')
          .replace(/\s+/g, ' ')
          .trim(),
        NAME_MAX,
      )
    : '';

/** What two names are compared by: look-alike forms folded (NFKC), case and invisible characters ignored. */
export const nameKey = (name: string): string => name.normalize('NFKC').replace(/\p{Cf}/gu, '').toLowerCase();

export const seatOf = (s: RoomBase, key: string): Seat | undefined => s.seats.find((x) => x.key === key);
export const seatByN = (s: RoomBase, n: number): Seat | undefined => s.seats.find((x) => x.n === n);
export const online = (s: RoomBase): Seat[] => s.seats.filter((x) => x.online);

function uniqueName(s: RoomBase, name: string, n: number): string {
  const taken = (v: string): boolean => s.seats.some((x) => x.n !== n && nameKey(x.name) === nameKey(v));
  let out = name;
  for (let i = 2; taken(out); i++) out = `${cutName(name, NAME_MAX - 1 - String(i).length)} ${i}`;
  return out;
}

/**
 * Lets go of lobby seats whose player dropped out more than AWAY_MS ago without scoring anything (no
 * ghost in the lobby, and their name is free again), and of a dropped host's claim to the role.
 * Returns whether anything changed. The joins and leaves run it; the room server runs it on its alarm.
 */
export function dropAway(s: RoomBase, now: number): boolean {
  const before = s.seats.length;
  s.seats = s.seats.filter((x) => x.online || x.awaySince === undefined || now - x.awaySince < AWAY_MS || s.phase !== 'lobby' || x.score !== 0);
  let changed = s.seats.length !== before;
  if (s.hostAway && (now >= s.hostAway.until || !seatByN(s, s.hostAway.n))) {
    delete s.hostAway;
    changed = true;
  }
  return changed;
}

/** When dropAway next has something to let go of (null: nothing waiting). */
export function awayDue(s: RoomBase): number | null {
  const times = s.seats.filter((x) => !x.online && x.awaySince !== undefined && s.phase === 'lobby' && x.score === 0).map((x) => x.awaySince! + AWAY_MS);
  if (s.hostAway) times.push(s.hostAway.until);
  return times.length ? Math.min(...times) : null;
}

/** Seats a player (or brings them back to their seat). Returns an error code ('full', 'kicked') or null. */
export function joinSeat(s: RoomBase, key: string, rawName: string, now: number, max: number, inGame: boolean): string | null {
  if (s.kicked?.includes(key)) return 'kicked';
  dropAway(s, now);
  const seat = seatOf(s, key);
  const typed = cleanName(rawName);
  const name = typed && !isBlockedName(typed) ? typed : 'Player';
  if (seat) {
    seat.online = true;
    delete seat.awaySince;
    if (name !== 'Player') seat.name = uniqueName(s, name, seat.n);
  } else {
    if (s.seats.length >= max) return 'full';
    const n = s.nextSeat++;
    s.seats.push({ key, n, name: uniqueName(s, name, n), score: 0, online: true, waiting: inGame });
  }
  const me = seatOf(s, key)!;
  // a host back within the grace period is the host again
  if (s.hostAway?.n === me.n) {
    s.host = me.n;
    delete s.hostAway;
  }
  if (!s.host || !s.seats.some((x) => x.n === s.host && x.online)) s.host = me.n;
  s.updated = now;
  return null;
}

/**
 * Marks a player away; the host role passes to someone still here, and comes back to them if they
 * return within AWAY_MS (a reload, a dropped phone connection). Someone who drops out of the lobby
 * before scoring anything keeps their seat for AWAY_MS too, then it goes (dropAway).
 */
export function leaveSeat(s: RoomBase, key: string, now: number): Seat | undefined {
  const seat = seatOf(s, key);
  if (!seat) return undefined;
  seat.online = false;
  if (s.host === seat.n) {
    s.host = s.seats.find((x) => x.online)?.n ?? s.host;
    s.hostAway = { n: seat.n, until: now + AWAY_MS };
  }
  if (s.phase === 'lobby' && seat.score === 0) seat.awaySince = now;
  dropAway(s, now);
  s.updated = now;
  return seat;
}

/** The host removes a seat (never their own); the removed key can't join this room again. Returns whether someone was removed. */
export function kickSeat(s: RoomBase, by: Seat, n: number): boolean {
  if (by.n !== s.host || n === by.n) return false;
  const i = s.seats.findIndex((x) => x.n === n);
  if (i < 0) return false;
  const [gone] = s.seats.splice(i, 1);
  s.kicked = [...(s.kicked ?? []).filter((k) => k !== gone!.key), gone!.key].slice(-KICKED_MAX);
  if (s.hostAway?.n === n) delete s.hostAway;
  return true;
}

/** A fresh 32-bit number from the room's own seed (so a room's games never depend on Math.random). */
export function nextRandom(s: RoomBase): number {
  s.seed = (s.seed + 0x9e3779b9) >>> 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** What every player sees about the others (never their keys). */
export interface SeatView {
  n: number;
  name: string;
  score: number;
  online: boolean;
  waiting: boolean;
  you: boolean;
  host: boolean;
  /** Has done their part in the current step (answered, voted…), when the game uses it. */
  done: boolean;
}

export function seatViews(s: RoomBase, me: Seat, done: (n: number) => boolean = () => false): SeatView[] {
  return s.seats.map((x) => ({ n: x.n, name: x.name, score: x.score, online: x.online, waiting: x.waiting, you: x.n === me.n, host: x.n === s.host, done: done(x.n) }));
}

/** How a room is listed (`max`: the seats the room really has). */
export function summaryOf(s: RoomBase, game: string, max: number): { code: string; phase: string; players: number; host: string; full: boolean; game: string; max: number } {
  return { code: s.code, phase: s.phase, players: online(s).length, host: seatByN(s, s.host)?.name ?? '', full: s.seats.length >= max, game, max };
}
