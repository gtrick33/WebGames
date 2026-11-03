import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanupSql } from '../scripts/score-cleanup';
import { memoryD1 } from './d1';

const MIGRATION = readFileSync(join(process.cwd(), 'migrations/0015_score_cleanup.sql'), 'utf8');
const T = 1_700_000_000_000;

function seeded() {
  const db = memoryD1().sqlite;
  const run = db.prepare(`INSERT INTO runs (id, user_id, game, started_at, ended_at, score, stats, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const best = db.prepare(`INSERT INTO bests (user_id, game, score, stats, at) VALUES (?, ?, ?, ?, ?)`);
  // [id, user, game, seconds, score, stats, status]
  const runs: [string, string, string, number, number, string, string][] = [
    ['ok-crosswire', 'u1', 'crosswire', 60, 1200, '{"seconds":50}', 'ok'],
    ['ok-nolimits', 'u1', 'no-such-game', 1, 99999, '{}', 'ok'],
    ['ok-wingit', 'u1', 'wing-it', 30, 13, '{"pillars":10,"feathers":1}', 'ok'],
    ['ok-wingit-unreported', 'u2', 'wing-it', 30, 13, '{}', 'ok'],
    ['bad-max', 'u2', 'crosswire', 600, 1300, '{}', 'ok'],
    ['bad-fast', 'u2', 'color-recall', 2, 100, '{}', 'ok'],
    ['bad-rate', 'u3', 'memory-grid', 10, 900, '{}', 'ok'], // 50/s × 10 s + 50 = 550
    ['bad-stat', 'u3', 'gloop', 60, 100, '{"biggest":12}', 'ok'],
    ['bad-per-second', 'u3', 'wing-it', 4, 30, '{"pillars":30,"feathers":0}', 'ok'], // 1.5/s × 4 s + 15 = 21 pillars at most
    ['bad-score-is', 'u4', 'wing-it', 30, 20, '{"pillars":10,"feathers":1}', 'ok'],
    ['bad-at-most', 'u4', 'wait-what', 60, 400, '{"correct":2}', 'ok'],
    ['bad-fraction', 'u4', 'square-deal', 60, 10.5, '{}', 'ok'],
    ['rejected', 'u5', 'crosswire', 1, 99999, '{}', 'rejected'],
    // u6's real best is removed for its time; their next run takes its place.
    ['u6-cheat', 'u6', 'memory-grid', 5, 2000, '{}', 'ok'],
    ['u6-real', 'u6', 'memory-grid', 60, 800, '{"time":40}', 'ok'],
  ];
  for (const [id, user, game, s, score, stats, status] of runs) run.run(id, user, game, T, T + s * 1000, score, stats, status);
  best.run('u1', 'crosswire', 1200, '{}', T + 60_000);
  best.run('u2', 'crosswire', 1300, '{}', T + 600_000);
  best.run('u3', 'gloop', 100, '{"biggest":12}', T + 60_000);
  best.run('u4', 'square-deal', 10.5, '{}', T + 60_000);
  best.run('u4', 'letter-pinch', 500, '{"guesses":0}', T + 60_000);
  best.run('u5', 'belot', -1, '{}', T);
  best.run('u6', 'memory-grid', 2000, '{}', T + 5_000);
  return db;
}

const ids = (db: ReturnType<typeof seeded>, sql: string): string[] => (db.prepare(sql).all() as { k: string }[]).map((r) => r.k).sort();

describe('score cleanup migration (0015)', () => {
  it('is the generator output for the current registry limits', () => {
    expect(MIGRATION).toBe(cleanupSql());
  });

  it('removes only rows a hard rule refuses, backs them up whole, and can be undone', () => {
    const db = seeded();
    const runsBefore = db.prepare('SELECT * FROM runs ORDER BY id').all();
    const bestsBefore = db.prepare('SELECT * FROM bests ORDER BY user_id, game').all();
    db.exec(MIGRATION);

    expect(ids(db, `SELECT id AS k FROM runs`)).toEqual(['ok-crosswire', 'ok-nolimits', 'ok-wingit', 'ok-wingit-unreported', 'rejected', 'u6-real']);
    expect(ids(db, `SELECT id || ':' || reason AS k FROM removed_scores WHERE source = 'runs'`)).toEqual([
      'bad-at-most:implausible_score',
      'bad-fast:too_fast',
      'bad-fraction:bad_score',
      'bad-max:above_max',
      'bad-per-second:bad_stats',
      'bad-rate:implausible_score',
      'bad-score-is:bad_stats',
      'bad-stat:bad_stats',
      'u6-cheat:implausible_score',
    ]);
    expect(ids(db, `SELECT user_id || ':' || game || ':' || reason AS k FROM removed_scores WHERE source = 'bests'`)).toEqual([
      'u2:crosswire:above_max',
      'u3:gloop:bad_stats',
      'u4:letter-pinch:bad_stats',
      'u4:square-deal:bad_score',
      'u5:belot:bad_score',
      'u6:memory-grid:run_removed',
    ]);
    // The full row is kept.
    expect(db.prepare(`SELECT score, stats, started_at, ended_at, status FROM removed_scores WHERE id = 'bad-fraction'`).get()).toEqual({
      score: 10.5,
      stats: '{}',
      started_at: T,
      ended_at: T + 60_000,
      status: 'ok',
    });
    expect(ids(db, `SELECT user_id || ':' || game || ':' || score AS k FROM bests`)).toEqual(['u1:crosswire:1200', 'u6:memory-grid:800']);

    // The restore in the migration's header puts everything back as it was.
    db.exec(`
      INSERT OR IGNORE INTO runs (id, user_id, game, started_at, ended_at, score, stats, day, new_best, status)
        SELECT id, user_id, game, started_at, ended_at, score, stats, day, new_best, status FROM removed_scores WHERE source = 'runs';
      INSERT OR REPLACE INTO bests (user_id, game, score, stats, at)
        SELECT user_id, game, score, stats, at FROM removed_scores WHERE source = 'bests';`);
    expect(db.prepare('SELECT * FROM runs ORDER BY id').all()).toEqual(runsBefore);
    expect(db.prepare('SELECT * FROM bests ORDER BY user_id, game').all()).toEqual(bestsBefore);
  });
});
