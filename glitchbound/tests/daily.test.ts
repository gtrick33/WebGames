import { describe, expect, it } from 'vitest';
import { GAMES } from '../src/catalog/games';
import { challengeForDay, currentStreak, dailyShareText, DAILY_EPOCH, metricValue } from '../src/platform/daily';
import { addDays, dayKey, daysBetween, formatCountdown, msUntilMidnight } from '../src/platform/dates';
import { fakeGame } from './fixtures';

describe('daily challenge', () => {
  it('is deterministic for a given day', () => {
    const a = challengeForDay('2026-11-03', GAMES);
    const b = challengeForDay('2026-11-03', GAMES);
    expect(a).not.toBeNull();
    expect(a?.label).toBe(b?.label);
    expect(a?.target).toBe(b?.target);
  });

  it('varies across days and always uses a target from the registry', () => {
    const labels = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const c = challengeForDay(addDays(DAILY_EPOCH, i), GAMES)!;
      labels.add(c.label);
      const tpl = c.game.daily!.find((t) => t.metric === c.metric)!;
      expect(tpl.targets).toContain(c.target);
      expect(c.label).not.toContain('{n}');
    }
    expect(labels.size).toBeGreaterThan(3);
  });

  it('numbers days from the epoch', () => {
    expect(challengeForDay(DAILY_EPOCH, GAMES)?.number).toBe(1);
    expect(challengeForDay(addDays(DAILY_EPOCH, 9), GAMES)?.number).toBe(10);
  });

  it('returns null when no game supports dailies, or before a game is released', () => {
    expect(challengeForDay('2026-12-01', [fakeGame({ daily: undefined })])).toBeNull();
    expect(challengeForDay('2026-09-01', [fakeGame({ released: '2026-10-01' })])).toBeNull();
  });

  it('reads the metric from score or stats', () => {
    expect(metricValue('score', { type: 'end', score: 50, stats: { coins: 3 } })).toBe(50);
    expect(metricValue('coins', { type: 'end', score: 50, stats: { coins: 3 } })).toBe(3);
    expect(metricValue('missing', { type: 'end', score: 50 })).toBe(0);
  });
});

describe('streaks', () => {
  const done = new Set(['2026-10-14', '2026-10-15', '2026-10-16']);
  it('counts consecutive days ending yesterday while today is still open', () => {
    expect(currentStreak(done, '2026-10-17')).toBe(3);
  });
  it('includes today once cleared', () => {
    expect(currentStreak(new Set([...done, '2026-10-17']), '2026-10-17')).toBe(4);
  });
  it('breaks after a missed day', () => {
    expect(currentStreak(done, '2026-10-18')).toBe(0);
  });
});

describe('share text', () => {
  it('shows the result, streak and a clean link, with no personal data', () => {
    const c = challengeForDay('2026-10-20', GAMES)!;
    const text = dailyShareText(c, c.target + 5, 4, [false, true, true, false, true, true, true], 'https://example.test/daily');
    expect(text).toContain(`GlitchBound Daily #${c.number}`);
    expect(text).toContain('□■■□■■■');
    expect(text).toContain('streak 4');
    expect(text.trim().endsWith('https://example.test/daily')).toBe(true);
  });
});

describe('dates', () => {
  it('formats local days and differences across month ends', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(daysBetween('2026-10-17', '2026-11-16')).toBe(30);
  });
  it('counts down to local midnight', () => {
    expect(msUntilMidnight(new Date(2026, 9, 17, 23, 59, 0))).toBe(60_000);
    expect(formatCountdown(3_723_000)).toBe('01:02:03');
  });
});
