import type { Profile } from '../progression/profile';

/**
 * Optional online services. The first release is fully local (LocalOnlyBackend).
 * A future Supabase implementation can live behind this interface; see docs/BACKEND.md.
 * Rules: only the public anon key may ship in the client; purchase verification, premium
 * grants and competitive scores must be validated server-side (Edge Functions + RLS).
 */
export interface LeaderboardEntry {
  name: string;
  score: number;
}

export interface BackendService {
  readonly configured: boolean;
  signInAnonymously(): Promise<boolean>;
  pullCloudSave(): Promise<Profile | null>;
  pushCloudSave(profile: Profile): Promise<boolean>;
  /** Server must re-validate (rate limits, plausibility checks) before accepting a score. */
  submitScore(score: number, runId: string): Promise<boolean>;
  leaderboard(limit: number): Promise<LeaderboardEntry[]>;
}

export class LocalOnlyBackend implements BackendService {
  readonly configured = false;
  async signInAnonymously(): Promise<boolean> {
    return false;
  }
  async pullCloudSave(): Promise<Profile | null> {
    return null;
  }
  async pushCloudSave(): Promise<boolean> {
    return false;
  }
  async submitScore(): Promise<boolean> {
    return false;
  }
  async leaderboard(): Promise<LeaderboardEntry[]> {
    return [];
  }
}

export function createBackend(env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string }): BackendService {
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) {
    // Intentionally not implemented in v1: wire a Supabase client here when online features ship.
    console.info('[backend] Supabase env detected but the online backend is not part of this release');
  }
  return new LocalOnlyBackend();
}
