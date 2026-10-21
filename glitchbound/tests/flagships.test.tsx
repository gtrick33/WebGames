import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chosenFlagships, FLAGSHIP_FALLBACK, flagshipGames, rankForHome, toggleFlagship } from '../src/catalog/flagships';
import { GAMES } from '../src/catalog/games';
import { FlagshipRow } from '../src/components/FlagshipRow';
import { nextStep } from '../src/platform/nextStep';
import { WEEK, type ThemeId } from '../src/platform/themes';
import { fakeGame } from './fixtures';

const bySlug = (slug: string) => GAMES.find((g) => g.slug === slug)!;
const theme = (id: ThemeId) => WEEK.find((t) => t.id === id)!;

describe('flagship games', () => {
  it('falls back to the four house picks when nothing was chosen', () => {
    expect(flagshipGames(GAMES, []).map((f) => f.game.slug)).toEqual(FLAGSHIP_FALLBACK);
  });

  it('keeps the admins’ order and fills the rest from the house picks without repeats', () => {
    expect(flagshipGames(GAMES, ['neon-rush', 'color-recall']).map((f) => f.game.slug)).toEqual(['neon-rush', 'color-recall', 'wait-what', 'launch-control']);
    expect(flagshipGames(GAMES, ['color-recall', 'neon-rush']).map((f) => f.game.slug)).toEqual(['color-recall', 'neon-rush', 'wait-what', 'launch-control']);
  });

  it('lets the day’s theme lead: Word Wednesday puts Letter Pinch first, with the sticker', () => {
    const list = flagshipGames(GAMES, [], theme('words'));
    expect(list[0]).toMatchObject({ game: { slug: 'letter-pinch' }, themed: true });
    expect(list.filter((f) => f.themed)).toHaveLength(1);
    expect(list.map((f) => f.game.slug).sort()).toEqual([...FLAGSHIP_FALLBACK].sort());
  });

  it('maps the other themed days to the owner’s flagships', () => {
    expect(flagshipGames(GAMES, [], theme('trivia'))[0]!.game.slug).toBe('wait-what');
    expect(flagshipGames(GAMES, [], theme('throttle'))[0]!.game.slug).toBe('launch-control');
    expect(flagshipGames(GAMES, [], theme('chill'))[0]!.game.slug).toBe('color-recall');
  });

  it('has no themed card on Throwdown Thursday', () => {
    const list = flagshipGames(GAMES, [], theme('throwdown'));
    expect(list.some((f) => f.themed)).toBe(false);
    expect(list.map((f) => f.game.slug)).toEqual(FLAGSHIP_FALLBACK);
  });

  it('caps at four, skips games players cannot see and keeps the row full', () => {
    expect(flagshipGames(GAMES, GAMES.map((g) => g.slug))).toHaveLength(4);
    const games = GAMES.filter((g) => g.slug !== 'wait-what');
    const row = flagshipGames(games, ['wait-what']).map((f) => f.game.slug);
    expect(row.slice(0, 3)).toEqual(['launch-control', 'color-recall', 'letter-pinch']);
    expect(row).toHaveLength(4);
  });

  it('reads the saved list, else the old per-game switch in the given order', () => {
    const cat = { settings: { 'neon-rush': { flagship: true }, 'gloop': { flagship: true } }, picks: {}, notice: null };
    expect(chosenFlagships(cat, GAMES)).toEqual(GAMES.filter((g) => g.slug === 'neon-rush' || g.slug === 'gloop').map((g) => g.slug));
    expect(chosenFlagships({ ...cat, flagships: ['whatsit'] }, GAMES)).toEqual(['whatsit']);
  });

  it('switches a game in (taking the last card) and out (a house pick fills in)', () => {
    expect(toggleFlagship(GAMES, [], 'neon-rush', true)).toEqual(['wait-what', 'launch-control', 'color-recall', 'neon-rush']);
    expect(toggleFlagship(GAMES, ['neon-rush', 'gloop', 'fussbox', 'whatsit'], 'gloop', false)).toEqual(['neon-rush', 'fussbox', 'whatsit', 'wait-what']);
    expect(toggleFlagship(GAMES, [], 'wait-what', true)).toEqual(FLAGSHIP_FALLBACK);
  });
});

describe('the Start here row', () => {
  afterEach(() => vi.useRealTimers());

  it('shows four cards and marks the one the day’s theme points at', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-21T12:00:00')); // a Wednesday: Word Wednesday
    render(<FlagshipRow />);
    const row = screen.getByRole('region', { name: 'Our best games' });
    const links = within(row).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/games/letter-pinch', '/games/wait-what', '/games/launch-control', '/games/color-recall']);
    const stickers = row.querySelectorAll('.flagship-sticker');
    expect(stickers).toHaveLength(1);
    expect(stickers[0]!.textContent).toContain('Word Wednesday');
    expect(stickers[0]!.closest('.flagship')!.querySelector('a')!.getAttribute('href')).toBe('/games/letter-pinch');
  });
});

describe('home grid order', () => {
  it('ranks the flagships, then played games, then the rest in their own order', () => {
    const games = ['a', 'b', 'c', 'd', 'e'].map((slug) => ({ slug }));
    expect(rankForHome(games, ['d'], ['e', 'b']).map((g) => g.slug)).toEqual(['d', 'e', 'b', 'a', 'c']);
  });

  it('ignores unknown and repeated slugs', () => {
    const games = ['a', 'b'].map((slug) => ({ slug }));
    expect(rankForHome(games, ['zz', 'b', 'b'], ['b']).map((g) => g.slug)).toEqual(['b', 'a']);
  });
});

describe('next step after a round', () => {
  const games = GAMES.filter((g) => !g.partyOnly);
  const flagships = FLAGSHIP_FALLBACK.map(bySlug);
  const base = { games, flagships, theme: theme('throwdown'), played: new Set<string>(), daily: null };

  it('sends you to today’s challenge when it is another game and still open', () => {
    expect(nextStep({ ...base, game: bySlug('neon-rush'), daily: { game: bySlug('memory-grid'), done: false } })).toMatchObject({ kind: 'daily', game: { slug: 'memory-grid' } });
  });

  it('offers one more try when this game is today’s challenge and the target is still open', () => {
    expect(nextStep({ ...base, game: bySlug('neon-rush'), daily: { game: bySlug('neon-rush'), done: false } })).toEqual({ kind: 'again', daily: true });
  });

  it('then an unplayed flagship, skipping the game just played', () => {
    expect(nextStep({ ...base, game: bySlug('wait-what'), played: new Set(['wait-what', 'launch-control']) })).toMatchObject({ kind: 'flagship', game: { slug: 'color-recall' } });
  });

  it('then a game from the day’s theme', () => {
    const played = new Set([...FLAGSHIP_FALLBACK, 'neon-rush']);
    expect(nextStep({ ...base, game: bySlug('neon-rush'), played, theme: theme('throttle') })).toMatchObject({ kind: 'theme', game: { slug: 'mini-racer' }, theme: { id: 'throttle' } });
  });

  it('then an unplayed game in the same mood', () => {
    const r = nextStep({ ...base, game: bySlug('neon-rush'), played: new Set(FLAGSHIP_FALLBACK) });
    expect(r.kind).toBe('mood');
    if (r.kind === 'mood') expect(r.game.moods!.some((m) => bySlug('neon-rush').moods!.includes(m))).toBe(true);
  });

  it('falls back to playing again', () => {
    const one = fakeGame({ slug: 'solo', moods: ['chill'] });
    expect(nextStep({ ...base, games: [one], flagships: [], game: one, daily: { game: one, done: true } })).toEqual({ kind: 'again', daily: false });
  });
});
