import { cleanup, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as start } from '../functions/api/challenges/[id]/start';
import { onRequestPost as score } from '../functions/api/challenges/[id]/score';
import { onRequestPost as create } from '../functions/api/challenges/index';
import type { Ctx, Env } from '../server/http';
import { getGame } from '../src/catalog/catalog';
import type { ChallengeView } from '../src/platform/challenge';
import { useChallengeRun } from '../src/platform/useChallengeRun';
import { memoryD1 } from './d1';

const ORIGIN = 'http://localhost:8788';
const A = 'attempt-aaaaaaaaaaaa';
const B = 'attempt-bbbbbbbbbbbb';

vi.mock('../src/platform/challengeLive', () => ({ watchChallenge: () => () => undefined }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('a challenge round is one attempt (server)', () => {
  const setup = async () => {
    const env = { DB: memoryD1(), NR_DB: {} as Env['NR_DB'] } as Env;
    const clock = { now: Date.UTC(2026, 10, 3, 12) };
    vi.spyOn(Date, 'now').mockImplementation(() => clock.now);
    const call = async <T,>(handler: (ctx: Ctx) => Promise<Response>, path: string, body: Record<string, unknown>, id?: string): Promise<{ status: number; data: T }> => {
      const request = new Request(`${ORIGIN}${path}`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ key: 'ana-device-key-0000000000', ...body }) });
      const res = await handler({ request, env, params: id ? { id } : {} });
      return { status: res.status, data: (await res.json()) as T };
    };
    const id = (await call<ChallengeView>(create, '/api/challenges', { game: 'memory-grid', mode: 'fresh', name: 'Ana' })).data.id;
    return { env, clock, call, id };
  };

  it('refuses a Memory Grid round quit and played again, and keeps a reload in the same attempt', async () => {
    const { clock, call, id } = await setup();
    const first = await call<{ startedAt: number }>(start, `/api/challenges/${id}/start`, { round: 1, attempt: A }, id);
    expect(first.status).toBe(200);
    clock.now += 5_000;
    // A reload: the same attempt, the same clock.
    expect((await call<{ startedAt: number }>(start, `/api/challenges/${id}/start`, { round: 1, attempt: A }, id)).data.startedAt).toBe(first.data.startedAt);
    // Quit and played again from a fresh browser (another token, or none): refused.
    expect(await call(start, `/api/challenges/${id}/start`, { round: 1, attempt: B }, id)).toMatchObject({ status: 409, data: { error: 'already_started' } });
    expect((await call(start, `/api/challenges/${id}/start`, { round: 1 }, id)).status).toBe(409);
    clock.now += 60_000;
    expect(await call(score, `/api/challenges/${id}/score`, { round: 1, score: 900, attempt: B }, id)).toMatchObject({ status: 409, data: { error: 'already_started' } });
    expect((await call(score, `/api/challenges/${id}/score`, { round: 1, score: 900 }, id)).status).toBe(409);
    // The attempt itself still counts.
    const ok = await call<ChallengeView>(score, `/api/challenges/${id}/score`, { round: 1, score: 900, attempt: A }, id);
    expect(ok.status).toBe(200);
    expect(ok.data.rounds[0]!.scores.map((s) => s.score)).toEqual([900]);
  });

  it('keeps the old rules for a start recorded without a token', async () => {
    const { env, clock, call, id } = await setup();
    expect((await call(start, `/api/challenges/${id}/start`, { round: 1 }, id)).status).toBe(200);
    expect((env.DB as ReturnType<typeof memoryD1>).sqlite.prepare('SELECT attempt FROM challenge_starts').get()).toEqual({ attempt: null });
    expect((await call(start, `/api/challenges/${id}/start`, { round: 1, attempt: B }, id)).status).toBe(200);
    clock.now += 60_000;
    expect((await call(score, `/api/challenges/${id}/score`, { round: 1, score: 900, attempt: B }, id)).status).toBe(200);
  });
});

describe('a game that starts its round as it mounts (Memory Grid)', () => {
  it('still tells the server the round started, with this browser’s attempt token', async () => {
    const view = { id: 'CH1', game: 'memory-grid', mode: 'fresh', day: '2026-11-03', round: 1, seed: 7, createdAt: 0, updatedAt: 0, players: [], rounds: [], joined: true, yourTurn: true, full: false, host: true, closed: false, closesAt: 0 };
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {} });
        return new Response(JSON.stringify(url.endsWith('/start') ? { round: 1, startedAt: 1 } : view));
      }),
    );
    // Like the game page: the game mounts in the same render the round becomes ready, and reports its start at once.
    function Game({ onStart }: { onStart: () => void }) {
      useEffect(() => onStart(), [onStart]);
      return null;
    }
    function Page() {
      const run = useChallengeRun('CH1', getGame('memory-grid')!, 'Ana');
      return run.state.status === 'ready' ? <Game onStart={run.begin} /> : null;
    }
    render(<Page />);
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/start'))).toBe(true));
    const started = calls.find((c) => c.url.endsWith('/start'))!;
    expect(started.url).toBe('/api/challenges/CH1/start');
    expect(started.body).toMatchObject({ round: 1, attempt: expect.stringMatching(/^[0-9a-f]{24}$/) });
  });
});
