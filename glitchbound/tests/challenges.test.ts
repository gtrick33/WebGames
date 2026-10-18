import { describe, expect, it } from 'vitest';
import { GAMES } from '../src/catalog/games';
import { cleanName, dailySeed, NAME_MAX, roundSeed, roundWinners } from '../src/platform/challenge';
import { challengeSpecOf } from '../src/platform/useChallengeRun';

describe('friends challenges', () => {
  it('gives every round its own seed, the same for every player', () => {
    expect(roundSeed(1234, 1)).toBe(1234);
    expect(roundSeed(1234, 2)).toBe(roundSeed(1234, 2));
    const seeds = new Set(Array.from({ length: 25 }, (_, i) => roundSeed(1234, i + 1)));
    expect(seeds.size).toBe(25);
    expect(roundSeed(1234, 2)).not.toBe(roundSeed(4321, 2));
  });

  it('uses one daily seed per game and day', () => {
    expect(dailySeed('wing-it', '2026-10-18')).toBe(dailySeed('wing-it', '2026-10-18'));
    expect(dailySeed('wing-it', '2026-10-18')).not.toBe(dailySeed('wing-it', '2026-10-19'));
    expect(dailySeed('wing-it', '2026-10-18')).not.toBe(dailySeed('crosswire', '2026-10-18'));
  });

  it('picks round winners (ties share it; nobody wins alone)', () => {
    expect(roundWinners([{ name: 'A', score: 9 }])).toEqual([]);
    expect(roundWinners([{ name: 'A', score: 9 }, { name: 'B', score: 12 }])).toEqual(['B']);
    expect(roundWinners([{ name: 'A', score: 12 }, { name: 'B', score: 12 }, { name: 'C', score: 3 }])).toEqual(['A', 'B']);
    expect(roundWinners([{ name: 'A', score: 9.5 }, { name: 'B', score: 12 }], true)).toEqual(['A']);
  });

  it('cleans player names', () => {
    expect(cleanName('  Ana\u0000 \n  B  ')).toBe('Ana B');
    expect(cleanName('x'.repeat(50))).toHaveLength(NAME_MAX);
    expect(cleanName(42)).toBe('');
  });

  it('keeps the round in the game after the score is sent', () => {
    const spec = { id: 'abc12', round: 2, seed: 7, mode: 'fresh' as const, day: '2026-10-18' };
    expect(challengeSpecOf({ status: 'loading' })).toBeUndefined();
    expect(challengeSpecOf({ status: 'sent', view: {} as never, score: 3, spec })).toBe(spec);
    expect(challengeSpecOf({ status: 'error', message: 'x' })).toBeUndefined();
  });

  it('only offers challenges in games that support them, never NEON RUSH', () => {
    expect(GAMES.find((g) => g.slug === 'neon-rush')?.challenge).toBeUndefined();
    for (const g of GAMES.filter((x) => x.challenge)) expect(g.challenge!.label.length).toBeGreaterThan(10);
  });
});
