/**
 * What every Party Mode live room shares (Never Have I Ever, Name Your Price, Dice Adventure):
 * seats keyed by a player's private key, unique names, a host who hands over when they leave, kicks,
 * and a seeded random source kept in the room state. Pure: the room server runs it (rooms/worker.ts).
 */
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
}

export const validKey = (k: unknown): k is string => typeof k === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(k);

export const cleanName = (v: unknown): string =>
  typeof v === 'string'
    ? [...v]
        .filter((ch) => ch.charCodeAt(0) >= 32)
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, NAME_MAX)
    : '';

export const seatOf = (s: RoomBase, key: string): Seat | undefined => s.seats.find((x) => x.key === key);
export const seatByN = (s: RoomBase, n: number): Seat | undefined => s.seats.find((x) => x.n === n);
export const online = (s: RoomBase): Seat[] => s.seats.filter((x) => x.online);

function uniqueName(s: RoomBase, name: string, n: number): string {
  let out = name;
  for (let i = 2; s.seats.some((x) => x.n !== n && x.name.toLowerCase() === out.toLowerCase()); i++) out = `${name.slice(0, NAME_MAX - 3)} ${i}`;
  return out;
}

/** Seats a player (or brings them back to their seat). Returns an error code or null. */
export function joinSeat(s: RoomBase, key: string, rawName: string, now: number, max: number, inGame: boolean): string | null {
  const seat = seatOf(s, key);
  const name = cleanName(rawName) || 'Player';
  if (seat) {
    seat.online = true;
    if (name !== 'Player') seat.name = uniqueName(s, name, seat.n);
  } else {
    if (s.seats.length >= max) return 'full';
    const n = s.nextSeat++;
    s.seats.push({ key, n, name: uniqueName(s, name, n), score: 0, online: true, waiting: inGame });
  }
  if (!s.host || !s.seats.some((x) => x.n === s.host && x.online)) s.host = seatOf(s, key)!.n;
  s.updated = now;
  return null;
}

/** Marks a player away; the host role passes to someone still here. */
export function leaveSeat(s: RoomBase, key: string, now: number): Seat | undefined {
  const seat = seatOf(s, key);
  if (!seat) return undefined;
  seat.online = false;
  if (s.host === seat.n) s.host = s.seats.find((x) => x.online)?.n ?? s.host;
  s.updated = now;
  return seat;
}

/** The host removes a seat (never their own). Returns whether someone was removed. */
export function kickSeat(s: RoomBase, by: Seat, n: number): boolean {
  if (by.n !== s.host || n === by.n) return false;
  const i = s.seats.findIndex((x) => x.n === n);
  if (i < 0) return false;
  s.seats.splice(i, 1);
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

export function summaryOf(s: RoomBase, game: string, max: number): { code: string; phase: string; players: number; host: string; full: boolean; game: string } {
  return { code: s.code, phase: s.phase, players: online(s).length, host: seatByN(s, s.host)?.name ?? '', full: s.seats.length >= max, game };
}
