import { describe, expect, it } from 'vitest';
import { GAMES } from '../src/catalog/games';
import { streakState, sweepShare } from '../src/platform/engage';
import { ASK_EVERY_DAYS, emptyFeedback, MAX_DISMISSALS, MIN_ROUNDS, QUIET_AFTER_SENT_DAYS, shouldAsk } from '../src/platform/feedback';
import { rankBests, topLabel } from '../src/platform/profile';
import { nextTheme } from '../src/platform/theme';
import { parseBug, parseFeedback } from '../server/reports';
import { matchRoute } from '../src/router/router';

const DAY = 86400_000;

describe('feedback prompt timing', () => {
  const now = 1_800_000_000_000;
  it('waits for a few finished rounds', () => {
    expect(shouldAsk(emptyFeedback(), MIN_ROUNDS - 1, now)).toBe(false);
    expect(shouldAsk(emptyFeedback(), MIN_ROUNDS, now)).toBe(true);
  });
  it('asks at most every few days, stays quiet after an answer, and gives up after repeated "not now"', () => {
    expect(shouldAsk({ ...emptyFeedback(), lastShown: now - DAY }, 10, now)).toBe(false);
    expect(shouldAsk({ ...emptyFeedback(), lastShown: now - (ASK_EVERY_DAYS + 1) * DAY }, 10, now)).toBe(true);
    expect(shouldAsk({ ...emptyFeedback(), sentAt: now - 20 * DAY }, 10, now)).toBe(false);
    expect(shouldAsk({ ...emptyFeedback(), sentAt: now - (QUIET_AFTER_SENT_DAYS + 1) * DAY }, 10, now)).toBe(true);
    expect(shouldAsk({ ...emptyFeedback(), dismissals: MAX_DISMISSALS }, 10, now)).toBe(false);
  });
});

describe('feedback and bug report validation', () => {
  it('accepts 1-5 stars and drops unknown games and wishes', () => {
    expect(parseFeedback({ stars: 5, message: '  great  ', game: 'color-lab', wish: 'harder' })).toEqual({ stars: 5, message: 'great', game: 'color-lab', wish: 'harder' });
    expect(parseFeedback({ stars: 3, game: 'nope', wish: 'free-money' })).toEqual({ stars: 3, message: '', game: '', wish: '' });
    expect(parseFeedback({ stars: 0 })).toBeNull();
    expect(parseFeedback({ stars: 6 })).toBeNull();
    expect(parseFeedback({ stars: '5' })).toBeNull();
    expect(parseFeedback(null)).toBeNull();
    expect(parseFeedback({ stars: 4, message: 'x'.repeat(5000) })!.message.length).toBe(1000);
  });
  it('needs a title and a description, and checks the optional email', () => {
    expect(parseBug({ title: 'x', description: 'long enough text' })).toBe('title');
    expect(parseBug({ title: 'Broken tube', description: 'short' })).toBe('description');
    expect(parseBug({ title: 'Broken tube', description: 'It does not pour at all', contact: 'not-an-email' })).toBe('contact');
    expect(parseBug({ title: 'Broken tube', description: 'It does not pour at all', category: 'weird', severity: 'huge', game: 'color-lab' })).toMatchObject({
      category: 'bug',
      severity: 'annoying',
      game: 'color-lab',
      contact: '',
    });
    const withControl = parseBug({ title: 'Bad\u0000 title', description: 'Some\u0007 description here' });
    expect(withControl).toMatchObject({ title: 'Bad title', description: 'Some description here' });
  });
});

describe('profile best results', () => {
  const [a, b, c] = GAMES;
  it('puts crowns first, then the best percentile on boards that are big enough', () => {
    const ranked = rankBests(
      {
        [a!.slug]: { score: 10, stats: {}, at: 1, rank: 3, players: 400 },
        [b!.slug]: { score: 10, stats: {}, at: 2, rank: 1, players: 2 },
        [c!.slug]: { score: 10, stats: {}, at: 3, rank: 1, players: 2 },
      },
      GAMES,
    );
    expect(ranked.map((e) => e.game.slug)).toEqual([c!.slug, b!.slug, a!.slug]);
    expect(topLabel(ranked[2]!)).toBe('Top 1%');
    expect(topLabel(ranked[0]!)).toBe('#1');
  });
  it('ignores games without a best and labels tiny boards plainly', () => {
    const ranked = rankBests({ [a!.slug]: { score: 1, stats: {}, at: 1, rank: 2, players: 3 } }, GAMES);
    expect(ranked).toHaveLength(1);
    expect(topLabel(ranked[0]!)).toBeNull();
  });
});

describe('streaks and the daily share', () => {
  it('flags a streak that ends at midnight unless a daily is done today', () => {
    expect(streakState(new Set(['2026-10-16', '2026-10-17']), '2026-10-18')).toEqual({ streak: 2, doneToday: false, atRisk: true });
    expect(streakState(new Set(['2026-10-17', '2026-10-18']), '2026-10-18')).toEqual({ streak: 2, doneToday: true, atRisk: false });
    expect(streakState(new Set(), '2026-10-18')).toEqual({ streak: 0, doneToday: false, atRisk: false });
  });
  it('shares one emoji row with ✓/✗ per game, the count and the streak, and celebrates a full sweep', () => {
    const part = sweepShare({ day: '2026-10-18', games: [{ emoji: '🧠', done: true }, { emoji: '🎨', done: false }], streak: 4, url: 'https://x.test/daily' });
    expect(part.text.split('\n')).toEqual(['GlitchBound · Today’s dailies Oct 18', '🧠✓ 🎨✗', '1 of 2 done · 🔥 4 day streak', 'https://x.test/daily']);
    expect(part.cardLines).toEqual(['Today’s dailies', 'Oct 18 · 1 of 2 done', '🔥 4 day streak']);
    const all = sweepShare({ day: '2026-10-18', games: [{ emoji: '🧠', done: true }, { done: true }], streak: 0, url: 'u' });
    expect(all.text).toContain('Daily sweep! 🧹');
    expect(all.text).toContain('🧠✓ 🎮✓');
    expect(all.text).not.toContain('🔥');
  });
  it('gives every game with a daily its own emoji', () => {
    const daily = GAMES.filter((g) => g.ownDaily);
    expect(daily.every((g) => !!g.emoji)).toBe(true);
    expect(new Set(daily.map((g) => g.emoji)).size).toBe(daily.length);
  });
});

describe('site plumbing', () => {
  it('routes the bug report page', () => {
    expect(matchRoute('/me/bugs')).toEqual({ name: 'bugs' });
    expect(matchRoute('/me/bugs/')).toEqual({ name: 'bugs' });
  });
  it('cycles the theme button between automatic and the opposite of what shows', () => {
    expect(['light', 'dark']).toContain(nextTheme('auto'));
    expect(nextTheme('dark')).toBe('auto');
    expect(nextTheme('light')).toBe('auto');
  });
});
