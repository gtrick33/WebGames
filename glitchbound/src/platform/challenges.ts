/**
 * Friends' challenges in the browser: the device's player key, and calls to /api/challenges.
 * Members are recognized by their account; guests by a random key kept on this device.
 */
import { api } from './account';
import type { ChallengeHistoryItem, ChallengeListItem, ChallengeMode, ChallengeView } from './challenge';

const KEY = 'glitchbound.playerKey';

let given: string | null = null;
/** This visit's key when the device can't keep one: random, so storage-blocked guests never share one. */
let fallback: string | null = null;

const randomKey = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 24);

/**
 * Uses a key handed out by the server for this visit (the Discord Activity: one per Discord account,
 * see server/discord.ts) for challenges and rooms. Also kept as this frame's device key.
 */
export function setPlayerKey(key: string): void {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) return;
  given = key;
  try {
    localStorage.setItem(KEY, key);
  } catch {
    /* kept for this visit */
  }
}

/** A stable random id for this device (guests' identity in challenges). */
export function playerKey(): string {
  if (given) return given;
  try {
    let k = localStorage.getItem(KEY);
    if (!k || !/^[A-Za-z0-9_-]{16,64}$/.test(k)) {
      k = randomKey();
      localStorage.setItem(KEY, k);
    }
    return k;
  } catch {
    return visitKey();
  }
}

/** The device can't keep a key: one for this tab, kept in sessionStorage when that works (survives a reload). */
function visitKey(): string {
  if (fallback) return fallback;
  try {
    const k = sessionStorage.getItem(KEY);
    if (k && /^[A-Za-z0-9_-]{16,64}$/.test(k)) return (fallback = k);
  } catch {
    /* blocked too */
  }
  fallback = randomKey();
  try {
    sessionStorage.setItem(KEY, fallback);
  } catch {
    /* kept in memory for this visit */
  }
  return fallback;
}

/**
 * The server keeps the guest key (an httpOnly cookie, server/guest.ts); this browser's storage is only a
 * cache of it. Run once at boot: the first time it backs up the key kept here; after that the server's
 * copy wins, so a guest whose storage was cleared, is full or is blocked keeps their seats across visits.
 */
export async function syncGuestKey(): Promise<void> {
  if (given) return;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch {
    /* blocked */
  }
  if (stored && !/^[A-Za-z0-9_-]{16,64}$/.test(stored)) stored = null;
  const { key } = await api<{ key: string }>('/api/guest', { body: { key: stored ?? undefined, hint: fallback ?? undefined } });
  if (given || key === (stored ?? fallback) || !/^[A-Za-z0-9_-]{16,64}$/.test(key)) return;
  try {
    localStorage.setItem(KEY, key);
    return; // the cache holds the server's key again
  } catch {
    /* still can't keep it: this visit uses the server's key */
  }
  fallback = key;
  try {
    sessionStorage.setItem(KEY, key);
  } catch {
    /* kept in memory */
  }
}

const q = (): string => `key=${encodeURIComponent(playerKey())}`;

export const createChallenge = (game: string, mode: ChallengeMode, name: string, day: string): Promise<ChallengeView> =>
  api<ChallengeView>('/api/challenges', { body: { game, mode, name, day, key: playerKey() } });

export const getChallenge = (id: string): Promise<ChallengeView> => api<ChallengeView>(`/api/challenges/${id}?${q()}`);

/** The challenge if it changed since `since` (its updatedAt), else null (the server answers 204). */
export const pollChallenge = (id: string, since: number): Promise<ChallengeView | null> => api<ChallengeView | null>(`/api/challenges/${id}?${q()}&since=${since}`);

/** The host ends the challenge for everyone; anyone else leaves it. `gone`: it was deleted. */
export const closeChallenge = (id: string): Promise<ChallengeView | { gone: true }> => api(`/api/challenges/${id}/close`, { body: { key: playerKey() } });

export const joinChallenge = (id: string, name: string): Promise<ChallengeView> => api<ChallengeView>(`/api/challenges/${id}/join`, { body: { name, key: playerKey() } });

export const submitChallengeScore = (id: string, round: number, score: number, stats?: Record<string, number>, replay?: string, attempt?: string): Promise<ChallengeView> =>
  api<ChallengeView>(`/api/challenges/${id}/score`, { body: { round, score, stats, replay, attempt, key: playerKey() } });

export const rematch = (id: string, round: number): Promise<ChallengeView> => api<ChallengeView>(`/api/challenges/${id}/rematch`, { body: { round, key: playerKey() } });

export const myChallenges = (): Promise<{ challenges: ChallengeListItem[] }> => api<{ challenges: ChallengeListItem[] }>(`/api/challenges?${q()}`);

/** Every challenge this player (account, or this device as a guest) had a seat in, newest first, with results. */
export const challengeHistory = (): Promise<{ history: ChallengeHistoryItem[] }> => api<{ history: ChallengeHistoryItem[] }>(`/api/challenges?history&${q()}`);

export const challengeReplays = (id: string): Promise<{ round: number; replays: { name: string; replay: string }[] }> => api(`/api/challenges/${id}/replays`);
