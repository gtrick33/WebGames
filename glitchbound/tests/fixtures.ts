import type { GameEntry } from '../src/catalog/types';

/** A valid registry entry to derive test games from. */
export function fakeGame(over: Partial<GameEntry> = {}): GameEntry {
  return {
    slug: 'test-game',
    title: 'Test Game',
    tagline: 'A game for tests.',
    description: 'Used only by unit tests.',
    categories: ['puzzle'],
    tags: ['logic'],
    released: '2026-10-01',
    accent: 'lime',
    art: { tile: '/t.webp', wide: '/w.webp', alt: 'art', bg: '#000' },
    runtime: { kind: 'module' },
    aspect: 'square',
    controls: { keyboard: ['Arrows'] },
    stats: [
      { key: 'score', label: 'Best score' },
      { key: 'time', label: 'Fastest', unit: 's', lowerIsBetter: true },
    ],
    daily: [{ metric: 'score', targets: [100], label: 'Score {n} points' }],
    ...over,
  };
}
