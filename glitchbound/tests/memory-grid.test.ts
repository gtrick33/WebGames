import { describe, expect, it } from 'vitest';
import { accuracy, createRun, DUPLICATE_TAP_MS, next, playbackDone, tap, tick, type RunState } from '../src/games/memory-grid/engine';
import { dailySeed, generateSequence, levelFor, mulberry32, patternFor, PERFECT_LADDER, PERFECT_SEED, randomSeed, SPEED_SECONDS } from '../src/games/memory-grid/pattern';
import { emptyRecords, liveStreak, parseRecords, playedDailyToday, recordRun } from '../src/games/memory-grid/records';
import { patternPoints, perfectBonus, reportStats, shareText, type RunSummary } from '../src/games/memory-grid/scoring';
import { getGame } from '../src/catalog/catalog';
import { GAME_MODULES } from '../src/catalog/modules';

/** Plays the current pattern correctly, `at` ms apart. */
function solve(s: RunState, start = 1000): RunState {
  let r = playbackDone(s);
  r.sequence.forEach((t, i) => {
    r = tap(r, t, start + i * 200);
  });
  return r;
}

const wrongTile = (s: RunState): number => (s.sequence[s.step]! + 1) % (s.level.size * s.level.size);

describe('memory grid: sequence generation', () => {
  it('is deterministic for a seed and different across seeds', () => {
    const a = generateSequence(mulberry32(42), 12, 4);
    expect(generateSequence(mulberry32(42), 12, 4)).toEqual(a);
    expect(generateSequence(mulberry32(43), 12, 4)).not.toEqual(a);
  });

  it('stays on the grid, never repeats a tile back to back, avoids A-B-A bounces and spreads tiles evenly', () => {
    for (let seed = 1; seed < 400; seed++) {
      for (const size of [3, 4, 5]) {
        const len = 3 + (seed % 12);
        const seq = generateSequence(mulberry32(seed), len, size);
        expect(seq).toHaveLength(len);
        const counts = new Map<number, number>();
        seq.forEach((t, i) => {
          expect(t).toBeGreaterThanOrEqual(0);
          expect(t).toBeLessThan(size * size);
          if (i > 0) expect(t).not.toBe(seq[i - 1]);
          if (i > 1) expect(t).not.toBe(seq[i - 2]);
          counts.set(t, (counts.get(t) ?? 0) + 1);
        });
        expect(Math.max(...counts.values())).toBeLessThanOrEqual(Math.ceil(len / (size * size)) + 1);
      }
    }
  });

  it('gives each run its own random seed', () => {
    expect(randomSeed()).not.toBe(randomSeed());
  });
});

describe('memory grid: difficulty progression', () => {
  it('Classic adds one step per round and never jumps more than one step at a time', () => {
    let prev = levelFor('classic', 1);
    expect(prev).toMatchObject({ size: 3, length: 3 });
    for (let r = 2; r <= 30; r++) {
      const l = levelFor('classic', r);
      expect(l.length).toBe(prev.length + 1);
      expect(l.size - prev.size).toBeGreaterThanOrEqual(0);
      expect(l.size - prev.size).toBeLessThanOrEqual(1);
      expect(l.litMs).toBeLessThanOrEqual(prev.litMs);
      expect(prev.litMs - l.litMs).toBeLessThanOrEqual(30);
      expect(l.litMs).toBeGreaterThanOrEqual(360);
      expect(l.size).toBeLessThanOrEqual(5);
      prev = l;
    }
  });

  it('Speed Run grows with patterns cleared, not with misses', () => {
    expect(levelFor('speed', 5, 0)).toEqual(levelFor('speed', 1, 0));
    expect(levelFor('speed', 3, 2).length).toBe(4);
    expect(levelFor('speed', 20, 12).size).toBe(5);
  });

  it('Perfect Recall is a fixed, monotonic ladder of ten patterns', () => {
    expect(PERFECT_LADDER).toHaveLength(10);
    for (let i = 1; i < PERFECT_LADDER.length; i++) {
      const a = PERFECT_LADDER[i - 1]!;
      const b = PERFECT_LADDER[i]!;
      expect(b.size >= a.size && b.length >= a.length && b.litMs <= a.litMs).toBe(true);
      expect(b.length - a.length + (b.size - a.size)).toBeLessThanOrEqual(1);
    }
  });
});

describe('memory grid: daily challenge consistency', () => {
  it('gives every player the same patterns on a date, whatever they tap', () => {
    const seed = dailySeed('2026-10-18');
    const a = createRun('daily', seed);
    const b = createRun('daily', dailySeed('2026-10-18'));
    expect(a.sequence).toEqual(b.sequence);
    // Player A clears round 1 slowly, player B quickly: round 2 is still the same pattern.
    const a2 = next(solve(a, 5000));
    const b2 = next(solve(b, 10));
    expect(a2.round).toBe(2);
    expect(a2.sequence).toEqual(b2.sequence);
    for (let r = 1; r <= 15; r++) {
      expect(patternFor(seed, r, levelFor('daily', r))).toEqual(patternFor(dailySeed('2026-10-18'), r, levelFor('daily', r)));
    }
  });

  it('changes from day to day and is not the Classic random seed', () => {
    const today = patternFor(dailySeed('2026-10-18'), 5, levelFor('daily', 5));
    const tomorrow = patternFor(dailySeed('2026-10-19'), 5, levelFor('daily', 5));
    expect(today).not.toEqual(tomorrow);
    expect(levelFor('daily', 7)).toEqual(levelFor('classic', 7));
  });

  it('Perfect Recall patterns are predefined (same for everyone, every day)', () => {
    expect(createRun('perfect', PERFECT_SEED).sequence).toEqual(createRun('perfect', PERFECT_SEED).sequence);
  });
});

describe('memory grid: input validation', () => {
  it('ignores taps during playback and the feedback beats', () => {
    const s = createRun('classic', 'seed');
    expect(s.phase).toBe('showing');
    expect(tap(s, s.sequence[0]!, 1)).toBe(s);
    const cleared = solve(s);
    expect(cleared.phase).toBe('cleared');
    expect(tap(cleared, 0, 99_999)).toBe(cleared);
    const over = tap(playbackDone(next(cleared)), wrongTile(next(cleared)), 1);
    expect(over.phase).toBe('over');
    expect(tap(over, 0, 99_999)).toBe(over);
  });

  it('ignores off-grid and non-integer tiles', () => {
    const s = playbackDone(createRun('classic', 'seed'));
    expect(tap(s, -1, 1)).toBe(s);
    expect(tap(s, 9, 1)).toBe(s);
    expect(tap(s, 1.5, 1)).toBe(s);
  });

  it('swallows a ghost double-fire on the same tile but accepts quick taps on different tiles', () => {
    const s = playbackDone(createRun('classic', 'seed'));
    const first = tap(s, s.sequence[0]!, 1000);
    expect(first.step).toBe(1);
    expect(tap(first, s.sequence[0]!, 1000 + DUPLICATE_TAP_MS - 1)).toBe(first);
    const second = tap(first, s.sequence[1]!, 1010);
    expect(second.step).toBe(2);
  });

  it('only accepts transitions from the right phase', () => {
    const s = createRun('classic', 'seed');
    expect(next(s)).toBe(s);
    const input = playbackDone(s);
    expect(playbackDone(input)).toBe(input);
    expect(next(input)).toBe(input);
    expect(tick(s, 100)).toBe(s);
  });

  it('a wrong tap ends Classic, Daily and Perfect Recall', () => {
    for (const mode of ['classic', 'daily', 'perfect'] as const) {
      const s = playbackDone(createRun(mode, 'seed'));
      const over = tap(s, wrongTile(s), 1);
      expect(over).toMatchObject({ phase: 'over', end: 'mistake', mistakes: 1 });
    }
  });

  it('a wrong tap in Speed Run costs time and moves on to a new pattern', () => {
    const s = playbackDone(createRun('speed', 'seed'));
    const missed = tap(s, wrongTile(s), 1);
    expect(missed.phase).toBe('missed');
    expect(missed.timeLeftMs).toBe((SPEED_SECONDS - 5) * 1000);
    const after = next(missed);
    expect(after).toMatchObject({ phase: 'showing', round: 2, cleared: 0, step: 0 });
  });
});

describe('memory grid: clock', () => {
  it('Speed Run only counts down on the player’s turn and ends at zero', () => {
    let s = createRun('speed', 'seed');
    expect(tick(s, 5000).timeLeftMs).toBe(SPEED_SECONDS * 1000);
    s = playbackDone(s);
    s = tick(s, 1000);
    expect(s.timeLeftMs).toBe((SPEED_SECONDS - 1) * 1000);
    s = tick(s, SPEED_SECONDS * 1000);
    expect(s).toMatchObject({ phase: 'over', end: 'timeout', timeLeftMs: 0 });
  });
});

describe('memory grid: scoring', () => {
  it('scores by length and grid size', () => {
    expect(patternPoints({ size: 3, length: 4 })).toBe(40);
    expect(patternPoints({ size: 4, length: 6 })).toBe(90);
    expect(patternPoints({ size: 5, length: 10 })).toBe(200);
  });

  it('adds points, longest sequence and accuracy as a run goes', () => {
    let s = createRun('classic', 'seed');
    s = next(solve(s));
    s = solve(s);
    expect(s.score).toBe(30 + 40);
    expect(s.cleared).toBe(2);
    expect(s.longest).toBe(4);
    expect(accuracy(s)).toBe(100);
    s = next(s);
    s = playbackDone(s);
    s = tap(s, s.sequence[0]!, 1);
    s = tap(s, wrongTile(s), 500);
    expect(s.taps).toBe(9);
    expect(accuracy(s)).toBe(89);
    expect(s.score).toBe(70);
  });

  it('clearing the whole Perfect Recall ladder ends the run with a time bonus', () => {
    let s = createRun('perfect', PERFECT_SEED);
    for (let i = 0; i < PERFECT_LADDER.length; i++) {
      s = tick(playbackDone(s), 4000);
      for (const [k, t] of s.sequence.entries()) s = tap(s, t, i * 10_000 + k * 200);
      if (i < PERFECT_LADDER.length - 1) s = next(s);
    }
    const base = PERFECT_LADDER.reduce((n, l) => n + patternPoints(l), 0);
    expect(s).toMatchObject({ phase: 'over', end: 'complete', cleared: 10 });
    expect(s.score).toBe(base + perfectBonus(40_000));
    expect(perfectBonus(0)).toBe(1000);
    expect(perfectBonus(10_000_000)).toBe(500);
  });

  it('reports declared stats, with time only for a completed Perfect Recall run', () => {
    const run: RunSummary = { mode: 'perfect', score: 900, cleared: 10, longest: 10, accuracy: 100, taps: 70, inputMs: 41_400, complete: true };
    expect(reportStats(run)).toEqual({ longest: 10, patterns: 10, accuracy: 100, time: 41 });
    expect(reportStats({ ...run, complete: false })).not.toHaveProperty('time');
    expect(reportStats({ ...run, mode: 'classic' })).not.toHaveProperty('time');
    const declared = getGame('memory-grid')!.stats.map((s) => s.key);
    for (const k of Object.keys(reportStats(run))) expect(declared).toContain(k);
  });

  it('share text is spoiler-free (no tile positions) and dated for the daily', () => {
    const run: RunSummary = { mode: 'daily', score: 250, cleared: 5, longest: 7, accuracy: 88, taps: 30, inputMs: 30_000, complete: false };
    const text = shareText({ ...run, day: '2026-10-18', streak: 3 });
    expect(text).toContain('Daily 2026-10-18');
    expect(text).toContain('🟩🟩🟩🟩🟩🟥');
    expect(text).toContain('3-day streak');
    expect(text).not.toMatch(/row|column|tile \d/i);
  });
});

describe('memory grid: records and streaks', () => {
  const run = (over: Partial<RunSummary> = {}): RunSummary => ({ mode: 'classic', score: 100, cleared: 3, longest: 5, accuracy: 90, taps: 10, inputMs: 9000, complete: false, ...over });

  it('keeps bests per mode and a top-5 local leaderboard', () => {
    let r = emptyRecords();
    const first = recordRun(r, run(), '2026-10-18');
    expect(first.newBest).toEqual(['score', 'longest']);
    expect(first.place).toBe(1);
    r = first.records;
    for (const score of [50, 300, 20, 80, 10]) r = recordRun(r, run({ score, longest: 2 }), '2026-10-18').records;
    expect(r.board.classic!.map((x) => x.score)).toEqual([300, 100, 80, 50, 20]);
    expect(r.best.classic).toMatchObject({ score: 300, longest: 5, plays: 6 });
    expect(r.best.speed).toBeUndefined();
    expect(recordRun(r, run({ score: 5 }), '2026-10-18').place).toBeNull();
  });

  it('records the fastest completed Perfect Recall only', () => {
    let r = recordRun(emptyRecords(), run({ mode: 'perfect', complete: false, inputMs: 5000 }), '2026-10-18').records;
    expect(r.best.perfect?.fastest).toBeUndefined();
    r = recordRun(r, run({ mode: 'perfect', complete: true, inputMs: 50_000 }), '2026-10-18').records;
    const faster = recordRun(r, run({ mode: 'perfect', complete: true, inputMs: 40_000 }), '2026-10-18');
    expect(faster.newBest).toContain('fastest');
    expect(faster.records.best.perfect?.fastest).toBe(40);
  });

  it('counts the first daily attempt, builds a streak over consecutive days and resets after a gap', () => {
    let r = emptyRecords();
    const d1 = recordRun(r, run({ mode: 'daily' }), '2026-10-18');
    expect(d1.officialDaily).toBe(true);
    r = d1.records;
    expect(playedDailyToday(r, '2026-10-18')).toBe(true);
    const practice = recordRun(r, run({ mode: 'daily', score: 999 }), '2026-10-18');
    expect(practice.officialDaily).toBe(false);
    expect(practice.records.daily?.score).toBe(100);
    expect(practice.records.streak.count).toBe(1);
    r = recordRun(r, run({ mode: 'daily' }), '2026-10-19').records;
    r = recordRun(r, run({ mode: 'daily' }), '2026-10-20').records;
    expect(liveStreak(r, '2026-10-21')).toBe(3);
    expect(liveStreak(r, '2026-10-22')).toBe(0);
    r = recordRun(r, run({ mode: 'daily' }), '2026-10-25').records;
    expect(r.streak).toEqual({ last: '2026-10-25', count: 1, best: 3 });
  });

  it('ignores corrupt or tampered storage', () => {
    expect(parseRecords('{nope')).toEqual(emptyRecords());
    expect(parseRecords(JSON.stringify({ best: { classic: { score: 'x' } }, streak: { count: -1 } }))).toEqual(emptyRecords());
    const r = recordRun(emptyRecords(), run(), '2026-10-18').records;
    expect(parseRecords(JSON.stringify({ ...r, muted: true }))).toEqual({ ...r, muted: true });
  });
});

describe('memory grid: registry', () => {
  it('is a lazy-loaded module game with a daily template', () => {
    const g = getGame('memory-grid');
    expect(g?.runtime.kind).toBe('module');
    expect(g?.daily?.length).toBeGreaterThan(0);
    expect(typeof GAME_MODULES['memory-grid']).toBe('function');
  });
});
