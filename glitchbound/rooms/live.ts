/**
 * The room server's own rules that need no Durable Object (rooms/worker.ts runs them; tests check them):
 * what a turned-away player is told, when a room wakes, and what counts as activity.
 */
import type { RoomState as State } from './engines';
import { awayDue, type RoomBase } from '../src/party/rooms/seats';

export const IDLE_MS = 3 * 60 * 60 * 1000;
/** The idle-close alarm is rounded up to this, so it only needs rewriting every few minutes (each write is billed). */
export const IDLE_STEP = 10 * 60 * 1000;

/** What a player is told when the room turns them away at the door (`code`: what the page can offer next). */
export function refusal(err: string | null): { t: 'gone'; reason: string; code: string } {
  if (err === 'full') return { t: 'gone', reason: 'This room is full.', code: 'full' };
  if (err === 'kicked') return { t: 'gone', reason: 'You were removed from this room.', code: 'kicked' };
  return { t: 'gone', reason: 'This room has closed.', code: 'closed' };
}

/**
 * The one player key every browser without storage used to share: whoever held it would sit in each
 * other's seat, so rooms refuse it (the page makes a key of its own now).
 */
export const SHARED_KEY = 'nostorage-device-key-0000';

/** A second tab (or device) of the same player took the seat over. */
export const REPLACED = { t: 'gone', reason: 'This room is open in another tab.', code: 'replaced' } as const;

/** When the room next needs waking: a game deadline, a quick-match start, a dropped seat's grace, or the idle close. */
export function alarmTime(s: State, startAt: number | null): number {
  const away = s.seats ? awayDue(s as unknown as RoomBase) : null;
  return Math.min(s.deadline ?? Infinity, startAt ?? Infinity, away ?? Infinity, Math.ceil((s.updated + IDLE_MS) / IDLE_STEP) * IDLE_STEP);
}

/**
 * Streamed actions (Sigilfall's fight) count as activity too, so a room in use is never closed as idle:
 * moves `updated` on at most once per IDLE_STEP (each move is one storage write). Returns whether it moved.
 */
export function relayKeepAlive(s: State, now: number): boolean {
  if (now - s.updated < IDLE_STEP) return false;
  s.updated = now;
  return true;
}

