/**
 * Friends' challenges in the browser: the device's player key, and calls to /api/challenges.
 * Members are recognised by their account; guests by a random key kept on this device.
 */
import { api } from './account';
import type { ChallengeListItem, ChallengeMode, ChallengeView } from './challenge';

const KEY = 'glitchbound.playerKey';

let given: string | null = null;

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
      k = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(36).padStart(2, '0'))
        .join('')
        .slice(0, 24);
      localStorage.setItem(KEY, k);
    }
    return k;
  } catch {
    return 'nostorage-device-key-0000';
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

export const submitChallengeScore = (id: string, round: number, score: number, stats?: Record<string, number>, replay?: string): Promise<ChallengeView> =>
  api<ChallengeView>(`/api/challenges/${id}/score`, { body: { round, score, stats, replay, key: playerKey() } });

export const rematch = (id: string, round: number): Promise<ChallengeView> => api<ChallengeView>(`/api/challenges/${id}/rematch`, { body: { round, key: playerKey() } });

export const myChallenges = (): Promise<{ challenges: ChallengeListItem[] }> => api<{ challenges: ChallengeListItem[] }>(`/api/challenges?${q()}`);

export const challengeReplays = (id: string): Promise<{ round: number; replays: { name: string; replay: string }[] }> => api(`/api/challenges/${id}/replays`);
