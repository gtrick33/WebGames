import { describe, expect, it } from 'vitest';
import { onRequestGet as leaderboard } from '../functions/api/leaderboard';
import type { Env } from '../server/http';
import type { LeaderRow } from '../src/platform/apiTypes';
import { memoryD1 } from './d1';

describe('game leaderboard', () => {
  it('gives equal scores the same rank, like the Hall of Fame and a round’s rank', async () => {
    const db = memoryD1();
    const env = { DB: db, NR_DB: {} as Env['NR_DB'] } as Env;
    const add = db.sqlite.prepare(`INSERT INTO users (id, google_sub, email, nickname, created_at, last_seen) VALUES (?, ?, ?, ?, 0, 0)`);
    const best = db.sqlite.prepare(`INSERT INTO bests (user_id, game, score, at) VALUES (?, 'gut-check', ?, ?)`);
    [
      ['a', 50, 1],
      ['b', 30, 2],
      ['c', 30, 3],
      ['d', 10, 4],
    ].forEach(([id, score, at]) => {
      add.run(String(id), `sub-${id}`, `${id}@example.com`, `Player ${id}`);
      best.run(String(id), Number(score), Number(at));
    });
    const res = await leaderboard({ request: new Request('http://localhost/api/leaderboard?game=gut-check'), env, params: {} });
    const { rows } = (await res.json()) as { rows: LeaderRow[] };
    // Ties keep the earlier score first, but both share the rank.
    expect(rows.map((r) => [r.nickname, r.rank])).toEqual([
      ['Player a', 1],
      ['Player b', 2],
      ['Player c', 2],
      ['Player d', 4],
    ]);
  });
});
