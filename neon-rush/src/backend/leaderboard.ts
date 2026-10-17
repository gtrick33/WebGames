/** Browser client for the online leaderboard (Cloudflare Pages Functions under /api). */

export interface BoardEntry {
  rank: number;
  name: string;
  score: number;
  meters: number;
  skin: string;
  you: boolean;
}

export interface BoardResult {
  entries: BoardEntry[];
  me: { rank: number; score: number; name: string } | null;
}

export interface RankInfo {
  rank: number;
  best: number;
}

export type SubmitResult =
  | { ok: true; daily: RankInfo | null; allTime: RankInfo | null }
  | { ok: false; error: string; message?: string };

export interface SubmitPayload {
  runId: string;
  playerId: string;
  name: string;
  score: number;
  meters: number;
  coins: number;
  nearMisses: number;
  durationMs: number;
  skin: string;
}

/** Every call fails soft (returns null) so the game never depends on the network. */
export class LeaderboardClient {
  constructor(private readonly base = './api') {}

  private async call<T>(path: string, init?: RequestInit): Promise<{ status: number; data: T } | null> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(`${this.base}/${path}`, { ...init, signal: ctrl.signal, headers: { 'content-type': 'application/json' } });
      if (!(res.headers.get('content-type') ?? '').includes('application/json')) return null;
      return { status: res.status, data: (await res.json()) as T };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async startRun(playerId: string): Promise<string | null> {
    const r = await this.call<{ runId?: string }>('run', { method: 'POST', body: JSON.stringify({ playerId }) });
    return r && r.status === 200 && typeof r.data.runId === 'string' ? r.data.runId : null;
  }

  async submit(p: SubmitPayload): Promise<SubmitResult | null> {
    const r = await this.call<{ ok?: boolean; daily?: RankInfo | null; allTime?: RankInfo | null; error?: string; message?: string }>('score', {
      method: 'POST',
      body: JSON.stringify(p),
    });
    if (!r) return null;
    if (r.status === 200 && r.data.ok) return { ok: true, daily: r.data.daily ?? null, allTime: r.data.allTime ?? null };
    return { ok: false, error: r.data.error ?? `http_${r.status}`, message: r.data.message };
  }

  async board(period: 'daily' | 'all', playerId: string): Promise<BoardResult | null> {
    const r = await this.call<BoardResult>(`leaderboard?period=${period}&playerId=${encodeURIComponent(playerId)}`);
    return r && r.status === 200 && Array.isArray(r.data.entries) ? r.data : null;
  }
}
