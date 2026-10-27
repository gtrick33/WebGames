import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as fileBug } from '../functions/api/bugs';
import type { Env } from '../server/http';
import { memoryD1 } from './d1';

/**
 * Players report as many bugs as they find (the owner, 2026-10-28: "this should be limitless"): the old cap of
 * ten a day is gone. Only a flood is held back, one report per 15 seconds from the same player.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe('bug reports', () => {
  it('have no daily limit; only a report within 15 seconds of the last waits', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T10:00:00Z'));
    const env: Env = { DB: memoryD1(), NR_DB: {} as Env['NR_DB'] };
    const send = async (n: number) => {
      const request = new Request('http://localhost/api/bugs', {
        method: 'POST',
        headers: { origin: 'http://localhost', 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7', 'user-agent': 'test' },
        body: JSON.stringify({ title: `Bug number ${n}`, description: 'Something went wrong in the game.' }),
      });
      const res = await fileBug({ request, env, waitUntil: () => undefined } as unknown as Parameters<typeof fileBug>[0]);
      return { status: res.status, data: (await res.json()) as { error?: string; message?: string } };
    };
    for (let n = 1; n <= 14; n++) {
      expect((await send(n)).status, `report ${n}`).toBe(200);
      const fast = await send(n);
      expect(fast).toMatchObject({ status: 429, data: { error: 'too_fast', message: expect.stringContaining('few seconds') } });
      vi.advanceTimersByTime(16_000);
    }
    const rows = await env.DB.prepare('SELECT COUNT(*) AS n FROM bug_reports').first<{ n: number }>();
    expect(rows?.n).toBe(14);
  });
});
