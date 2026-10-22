import { describe, expect, it } from 'vitest';
import { onRequestGet as getMe } from '../functions/api/me';
import { onRequestPost as endRun } from '../functions/api/runs/end';
import { liveRules } from '../server/catalogSettings';
import type { Env } from '../server/http';
import { signIn } from '../server/signin';
import { GAMES } from '../src/catalog/games';
import type { Me, RunEndResult } from '../src/platform/apiTypes';
import { challengeForDay } from '../src/platform/daily';
import { addDays } from '../src/platform/dates';
import { memoryD1 } from './d1';

const ORIGIN = 'http://localhost:8788';

describe('the daily streak on the server', () => {
  it('counts the challenges the server recorded as cleared, and a day without one ends it', async () => {
    const db = memoryD1();
    const env = { DB: db, NR_DB: {} as Env['NR_DB'], ADMIN_EMAILS: '' } as Env;
    const { user, cookie } = await signIn(env, new Request(ORIGIN), { sub: 'dev:s@example.com', email: 's@example.com', name: 'S', givenName: '', picture: '', provider: 'email' });
    const jar = cookie.split(';')[0]!;
    // the server takes the player's day when it is within one of its own
    const today = new Date().toISOString().slice(0, 10);
    const me = async (day: string): Promise<Me> => ((await (await getMe({ request: new Request(`${ORIGIN}/api/me?day=${day}`, { headers: { cookie: jar } }), env, params: {} })).json()) as { user: Me }).user;
    let n = 0;
    /** One round of that day's challenge game, reaching its target or scoring nothing. */
    const play = async (day: string, clear: boolean): Promise<RunEndResult> => {
      const c = challengeForDay(day, GAMES, (await liveRules(env, day)).rules)!;
      const runId = `run-${n++}`;
      // started an hour ago, so any score passes the time check
      db.sqlite.prepare(`INSERT INTO runs (id, user_id, game, started_at, status) VALUES (?, ?, ?, ?, 'open')`).run(runId, user.id, c.game.slug, Date.now() - 3_600_000);
      const value = clear ? c.target : 0;
      const body = c.metric === 'score' ? { runId, score: value, stats: {}, day } : { runId, score: 1, stats: { [c.metric]: value }, day };
      const request = new Request(`${ORIGIN}/api/runs/end`, { method: 'POST', headers: { origin: ORIGIN, cookie: jar, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return (await (await endRun({ request, env, params: {} })).json()) as RunEndResult;
    };

    // cleared two days ago, nothing yesterday: no streak today
    db.sqlite.prepare(`INSERT INTO dailies (user_id, day, game, best, done) VALUES (?, ?, 'gut-check', 1, 1)`).run(user.id, addDays(today, -2));
    expect(await me(today)).toMatchObject({ streak: 0, dailyDays: [addDays(today, -2)] });
    // a round short of the target is no clear
    expect(await play(addDays(today, -1), false)).toMatchObject({ ok: true, dailyCompleted: false });
    expect(await me(today)).toMatchObject({ streak: 0, dailyDays: [addDays(today, -2)] });
    // yesterday cleared after all: two days, alive today until midnight
    expect(await play(addDays(today, -1), true)).toMatchObject({ ok: true, dailyCompleted: true });
    expect(await me(today)).toMatchObject({ streak: 2, dailyDays: [addDays(today, -1), addDays(today, -2)] });
    // and today: three
    expect(await play(today, true)).toMatchObject({ ok: true, dailyCompleted: true });
    expect((await me(today)).streak).toBe(3);
    expect((await me(addDays(today, 1))).streak).toBe(3);
  });
});
