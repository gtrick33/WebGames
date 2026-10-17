import { describe, expect, it } from 'vitest';
import { categoryCounts, getGame, isCategory, isNew, matchScore, queryGames, relatedGames, validateCatalog } from '../src/catalog/catalog';
import { GAMES } from '../src/catalog/games';
import { fakeGame } from './fixtures';

const games = [
  fakeGame({ slug: 'alpha', title: 'Alpha Words', categories: ['word'], tags: ['letters'], released: '2026-09-01' }),
  fakeGame({ slug: 'beta', title: 'Beta Racer', categories: ['racing', 'arcade'], tags: ['cars'], released: '2026-10-10' }),
  fakeGame({ slug: 'gamma', title: 'Gamma Grid', categories: ['puzzle'], tags: ['logic', 'grid'], released: '2026-10-05' }),
];

describe('the real registry', () => {
  it('is valid', () => {
    expect(validateCatalog(GAMES)).toEqual([]);
  });
  it('contains NEON RUSH as an embedded game with its own origin allowed', () => {
    const g = getGame('neon-rush');
    expect(g?.runtime.kind).toBe('embed');
    if (g?.runtime.kind === 'embed') expect(g.runtime.origins).toContain(new URL(g.runtime.url).origin);
  });
});

describe('validateCatalog', () => {
  it('reports duplicate and malformed slugs, bad dates and unknown daily metrics', () => {
    const errors = validateCatalog([
      fakeGame({ slug: 'dup' }),
      fakeGame({ slug: 'dup' }),
      fakeGame({ slug: 'Bad Slug' }),
      fakeGame({ slug: 'date', released: '17/10/2026' }),
      fakeGame({ slug: 'metric', daily: [{ metric: 'nope', targets: [1], label: '{n}' }] }),
      fakeGame({ slug: 'embed', runtime: { kind: 'embed', url: 'https://a.example/', origins: ['https://b.example'] } }),
    ]);
    expect(errors.join('\n')).toMatch(/duplicate slug/);
    expect(errors.join('\n')).toMatch(/lowercase-kebab/);
    expect(errors.join('\n')).toMatch(/YYYY-MM-DD/);
    expect(errors.join('\n')).toMatch(/daily metric "nope"/);
    expect(errors.join('\n')).toMatch(/origins must include https:\/\/a.example/);
  });
});

describe('search, filter and sort', () => {
  it('sorts newest first by default and A to Z on request', () => {
    expect(queryGames({}, games).map((g) => g.slug)).toEqual(['beta', 'gamma', 'alpha']);
    expect(queryGames({ sort: 'az' }, games).map((g) => g.slug)).toEqual(['alpha', 'beta', 'gamma']);
  });
  it('filters by any of a game’s categories', () => {
    expect(queryGames({ category: 'arcade' }, games).map((g) => g.slug)).toEqual(['beta']);
    expect(queryGames({ category: 'trivia' }, games)).toEqual([]);
  });
  it('searches title, category, tags and text; every word must match', () => {
    expect(queryGames({ q: 'racer' }, games).map((g) => g.slug)).toEqual(['beta']);
    expect(queryGames({ q: 'puzzle' }, games).map((g) => g.slug)).toEqual(['gamma']);
    expect(queryGames({ q: 'grid logic' }, games).map((g) => g.slug)).toEqual(['gamma']);
    expect(queryGames({ q: 'grid cars' }, games)).toEqual([]);
    expect(queryGames({ q: '  BETA!! ' }, games).map((g) => g.slug)).toEqual(['beta']);
  });
  it('ranks title matches above description matches', () => {
    const a = fakeGame({ slug: 'a', title: 'Orbit', description: 'nothing' });
    const b = fakeGame({ slug: 'b', title: 'Other', description: 'an orbit game' });
    expect(matchScore(a, 'orbit')).toBeGreaterThan(matchScore(b, 'orbit'));
    expect(queryGames({ q: 'orbit' }, [b, a]).map((g) => g.slug)).toEqual(['a', 'b']);
  });
  it('counts only categories that have games', () => {
    expect(categoryCounts(games)).toEqual([
      { id: 'arcade', label: 'Arcade', count: 1 },
      { id: 'racing', label: 'Racing', count: 1 },
      { id: 'puzzle', label: 'Puzzle', count: 1 },
      { id: 'word', label: 'Word', count: 1 },
    ]);
  });
});

describe('helpers', () => {
  it('isNew is true for 30 days after release', () => {
    const g = fakeGame({ released: '2026-10-01' });
    expect(isNew(g, new Date('2026-10-02T12:00:00Z'))).toBe(true);
    expect(isNew(g, new Date('2026-11-05T12:00:00Z'))).toBe(false);
  });
  it('relatedGames prefers shared categories and never includes the game itself', () => {
    const related = relatedGames(games[1]!, 4, [...games, fakeGame({ slug: 'delta', categories: ['racing'], released: '2026-01-01' })]);
    expect(related[0]?.slug).toBe('delta');
    expect(related.map((g) => g.slug)).not.toContain('beta');
  });
  it('isCategory guards URL input', () => {
    expect(isCategory('racing')).toBe(true);
    expect(isCategory('toString')).toBe(false);
    expect(isCategory(null)).toBe(false);
  });
});
