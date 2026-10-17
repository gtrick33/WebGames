import { useSyncExternalStore } from 'react';
import { randomName, validateNickname } from './progression';
export { randomName };
import { useAccount } from './account';

/**
 * The name a player races under. Members: their account nickname (it starts as their Google
 * name). Guests: a random Reddit-style name made once per browser, which they can change.
 * Games receive it through the host bridge, so they never ask for a name themselves.
 */

const KEY = 'glitchbound.name';
/** Max length every game accepts (NEON RUSH allows 14). */
export const NAME_MAX = 14;

const listeners = new Set<() => void>();
let cached: string | null = null;

function read(): string {
  if (cached) return cached;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && !validateNickname(stored) && stored.length <= NAME_MAX) return (cached = stored);
  } catch {
    /* storage blocked */
  }
  cached = randomName();
  try {
    localStorage.setItem(KEY, cached);
  } catch {
    /* keep it for this visit */
  }
  return cached;
}

export function guestName(): string {
  return read();
}

/** Returns an error message, or null when saved. */
export function setGuestName(raw: string): string | null {
  const name = raw.trim();
  const error = validateNickname(name) ?? (name.length > NAME_MAX ? `Use at most ${NAME_MAX} characters.` : null);
  if (error) return error;
  cached = name;
  try {
    localStorage.setItem(KEY, name);
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
  return null;
}

/** For tests. */
export function resetGuestName(): void {
  cached = null;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The current player name, plus whether it belongs to an account. */
export function usePlayerName(): { name: string; member: boolean } {
  const guest = useSyncExternalStore(subscribe, read, () => '');
  const { me } = useAccount();
  return me ? { name: me.nickname.slice(0, NAME_MAX), member: true } : { name: guest, member: false };
}
