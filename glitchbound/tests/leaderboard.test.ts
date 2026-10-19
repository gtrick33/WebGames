import { describe, expect, it } from 'vitest';
import { onRequestGet as hall } from '../functions/api/hall';
import { onRequestGet as leaderboard } from '../functions/api/leaderboard';
import { onRequestPost as endRun } from '../functions/api/runs/end';
import type { Env } from '../server/http';
import { signIn } from '../server/signin';
import type { HallRow, LeaderRow, RunEndResult } from '../src/platform/apiTypes';
import { memoryD1 } from './d1';

const ORIGIN = 'http://localhost:8788';

function setup() {
  const db = memoryD1();
  const env = { DB: db, NR_DB: {} as Env['NR_DB'] } as Env;
  const add = db.sqlite.prepare(`INSERT INTO users (id, google_sub, email, nickname, created_at, last_seen) VALUES (?, ?, ?, ?, 0, 0)`);
  const best = db.sqlite.prepare(`INSERT INTO bests (user_id, game, score, at) VALUES (?, 'gut-check', ?, ?)`);
  const players = (list: [string, number, number][]): void =>
    list.forEach(([id, score, at]) => {
      add.run(id, `sub-${id}`, `${id}@example.com`, `Player ${id}`);
      best.run(id, score, at);
    });
  const board = async (): Promise<LeaderRow[]> => ((await (await leaderboard({ request: new Request(`${ORIGIN}/api/leaderboard?game=gut-check`), env, params: {} })).json()) as { rows: LeaderRow[] }).rows;
  return { db, env, players, board };
}

describe('game leaderboard', () => {
  it('gives equal scores the same rank, like the Hall of Fame and a round’s rank', async () => {
    const { players, board } = setup();
    players([
      ['a', 50, 1],
      ['b', 30, 2],
      ['c', 30, 3],
      ['d', 10, 4],
    ]);
    // Ties keep the earlier score first, but both share the rank.
    expect((await board()).map((r) => [r.nickname, r.rank])).toEqual([
      ['Player a', 1],
      ['Player b', 2],
      ['Player c', 2],
      ['Player d', 4],
    ]);
  });

  it('leaves scores of 0 off the board and out of the Hall of Fame', async () => {
    const { env, players, board } = setup();
    // A 0 best stored before zero scores stopped counting must not take a crown either.
    players([['z', 0, 1]]);
    expect(await board()).toEqual([]);
    const { rows } = (await (await hall({ request: new Request(`${ORIGIN}/api/hall`), env, params: {} })).json()) as { rows: HallRow[] };
    expect(rows).toEqual([]);
  });

  it('records a round of 0 as played but gives it no best and no rank', async () => {
    const { db, env, board } = setup();
    const { user, cookie } = await signIn(env, new Request(ORIGIN), { sub: 'dev:zero@example.com', email: 'zero@example.com', name: 'Zero', givenName: '', picture: '', provider: 'email' });
    const end = async (runId: string, score: number): Promise<RunEndResult> => {
      // Started a minute ago, so the time check passes.
      db.sqlite.prepare(`INSERT INTO runs (id, user_id, game, started_at, status) VALUES (?, ?, 'gut-check', ?, 'open')`).run(runId, user.id, Date.now() - 60_000);
      const request = new Request(`${ORIGIN}/api/runs/end`, {
        method: 'POST',
        headers: { origin: ORIGIN, cookie: cookie.split(';')[0]!, 'content-type': 'application/json' },
        body: JSON.stringify({ runId, score, stats: {} }),
      });
      return (await (await endRun({ request, env, params: {} })).json()) as RunEndResult;
    };
    const zero = await end('run-0', 0);
    expect(zero).toMatchObject({ ok: true, newBest: false, rank: null });
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM bests`).get()).toEqual({ n: 0 });
    expect(db.sqlite.prepare(`SELECT status FROM runs WHERE id = 'run-0'`).get()).toEqual({ status: 'ok' });
    expect(await board()).toEqual([]);
    // The first real score is ranked as usual.
    expect(await end('run-1', 4)).toMatchObject({ ok: true, rank: 1 });
    expect((await board()).map((r) => [r.nickname, r.score])).toEqual([['Zero', 4]]);
  });
});
