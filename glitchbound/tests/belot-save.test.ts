import { describe, expect, it } from 'vitest';
import { challengeStart, cleanRun, daySeed, matchScore, parseSave, THROWN_MARK, type Run } from '../src/games/belot/Game';
import { newMatch } from '../src/games/belot/logic';
import { dayKey } from '../src/platform/dates';

const run = (mode: Run['mode'], extra: Partial<Run> = {}): Run => ({ mode, level: 'hard', match: newMatch(9), booked: 1, line: '🟢', started: true, sheet: null, ...extra });
const CH = { id: 'ch1', round: 2, seed: 4242, mode: 'fresh' as const, day: '2026-10-29' };

describe('belot: the save', () => {
  it('never saves `started`, so a resumed run reports start again', () => {
    const s = parseSave(JSON.stringify({ current: run('match') }));
    expect(s.current?.started).toBe(false);
  });

  it('keeps a match and the day’s set in separate slots; an older single slot moves to the right one', () => {
    const today = dayKey();
    const old = parseSave(JSON.stringify({ current: run('daily', { match: newMatch(daySeed(today)) }) }));
    expect(old.current).toBeNull();
    expect(old.dailyRun?.day).toBe(today);
    const both = parseSave(JSON.stringify({ current: run('match'), dailyRun: run('daily', { day: today }) }));
    expect(both.current?.mode).toBe('match');
    expect(both.dailyRun?.mode).toBe('daily');
  });

  it('a corrupted save never crashes and drops a run the table could not draw', () => {
    for (const raw of ['{', 'null', '[]', '"x"', JSON.stringify({ best: -5, runs: 'a', daily: { bad: 1, '2026-10-01': { score: 1e9, line: 3 } } })]) {
      const s = parseSave(raw);
      expect(s.best).toBe(0);
      expect(s.current).toBeNull();
    }
    const broken = run('match');
    expect(cleanRun({ ...broken, match: { ...broken.match, deal: { ...broken.match.deal, hands: [[99]] } } })).toBeNull();
    expect(cleanRun({ ...broken, match: { ...broken.match, scores: [1] } })).toBeNull();
    expect(cleanRun({ ...broken, level: 'godlike' })).toBeNull();
    expect(cleanRun({ ...broken, booked: -3, line: 7 })).toMatchObject({ booked: 0, line: '' });
  });

  it('a won match scores its table and the margin; a loss scores nothing', () => {
    expect(matchScore(true, 60, 'expert')).toBe(460);
    expect(matchScore(true, 400, 'easy')).toBe(250);
    expect(matchScore(true, 0, 'hard')).toBeGreaterThan(matchScore(true, 140, 'easy'));
    expect(matchScore(false, 0, 'expert')).toBe(0);
    expect(THROWN_MARK).toHaveLength(1);
  });
});

describe('belot: friends’ challenge rounds', () => {
  it('a round in progress is picked up again, a finished one is shown and never replayed', () => {
    const fresh = challengeStart(parseSave('{}'), CH, '2026-11-01');
    expect(fresh.run?.match.seed).toBe(4242);
    expect(fresh.run?.round).toBe('ch1:2');
    const saved = parseSave(JSON.stringify({ rounds: { 'ch1:2': { run: run('challenge', { round: 'ch1:2', booked: 3 }), done: false } } }));
    expect(challengeStart(saved, CH, '2026-11-01').run?.booked).toBe(3);
    const done = parseSave(JSON.stringify({ rounds: { 'ch1:2': { run: null, done: true, score: 88, ours: 88, theirs: 40, line: '🟢' } } }));
    const r = challengeStart(done, CH, '2026-11-01');
    expect(r.run).toBeNull();
    expect(r.result).toMatchObject({ score: 88, theirs: 40 });
    expect(r.counts).toBe(false);
  });

  it('"today’s daily" plays the day’s own deals; a day already played counts as it is', () => {
    const day = '2026-11-01';
    const ch = { ...CH, mode: 'daily' as const, day };
    // today: the day's set itself (the same attempt as the menu's)
    const t = challengeStart(parseSave('{}'), ch, day);
    expect(t.run?.mode).toBe('daily');
    expect(t.run?.match.seed).toBe(daySeed(day));
    const inProgress = parseSave(JSON.stringify({ dailyRun: run('daily', { day, match: newMatch(daySeed(day)), booked: 2 }) }));
    expect(challengeStart(inProgress, ch, day).run?.booked).toBe(2);
    // an earlier day: the same deals, kept as the round
    const past = challengeStart(parseSave('{}'), ch, '2026-11-03');
    expect(past.run?.mode).toBe('challenge');
    expect(past.run?.match.seed).toBe(daySeed(day));
    expect(past.run?.day).toBe(day);
    // already played that day: its result is the round's score
    const played = challengeStart(parseSave(JSON.stringify({ daily: { [day]: { score: 120, line: '🟢🟢', done: true, theirs: 60 } } })), ch, day);
    expect(played.run).toBeNull();
    expect(played.counts).toBe(true);
    expect(played.result).toMatchObject({ score: 120, ours: 120, theirs: 60, counted: true });
  });
});
