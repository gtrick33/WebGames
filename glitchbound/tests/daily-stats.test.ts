import { describe, expect, it } from 'vitest';
import { onRequestGet as dailyStats } from '../functions/api/daily-stats';
import type { Env } from '../server/http';
import { beatShare } from '../src/components/DailyCompare';
import { memoryD1 } from './d1';

describe('daily stats: how a daily score compares with today’s players', () => {
  it('counts each visitor once (their best daily score of that day), guests included', async () => {
    const db = memoryD1();
    const env = { DB: db } as unknown as Env;
    const add = (visitor: string, score: number, dday: string, utc: string, daily = true): void => {
      db.sqlite
        .prepare('INSERT INTO events (ts, day, name, game, visitor, user_id, props) VALUES (1, ?, ?, ?, ?, NULL, ?)')
        .run(utc, 'game_end', 'wing-it', visitor, JSON.stringify(daily ? { game: 'wing-it', score, daily: true, dday } : { game: 'wing-it', score }));
    };
    add('a', 10, '2026-10-20', '2026-10-19'); // late evening UTC, already the 20th locally
    add('a', 30, '2026-10-20', '2026-10-20'); // the same player's better flight
    add('b', 20, '2026-10-20', '2026-10-20');
    add('c', 50, '2026-10-20', '2026-10-20');
    add('d', 99, '2026-10-20', '2026-10-20', false); // an endless round: not the daily
    add('e', 70, '2026-10-19', '2026-10-19'); // yesterday's daily
    const get = async (q: string) => (await dailyStats({ request: new Request(`http://x/api/daily-stats?${q}`), env, params: {} })).json() as Promise<Record<string, unknown>>;
    expect(await get('game=wing-it&day=2026-10-20&score=30')).toMatchObject({ players: 3, below: 1, equal: 1 });
    expect(await get('game=nope&day=2026-10-20&score=1')).toMatchObject({ error: 'unknown_game' });
    expect(await get('game=wing-it&day=20-10-2026&score=1')).toMatchObject({ error: 'bad_day' });
  });

  it('turns counts into the share of other players beaten', () => {
    expect(beatShare(21, 20)).toBe(100);
    expect(beatShare(21, 0)).toBe(0);
    expect(beatShare(101, 50)).toBe(50);
  });
});
