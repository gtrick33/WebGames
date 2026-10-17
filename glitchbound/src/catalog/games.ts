import type { GameEntry } from './types.ts';

/**
 * THE GAME REGISTRY. Add a new game by appending an entry here (see docs/ADDING-A-GAME.md).
 * Order does not matter: the arcade sorts by release date.
 */
export const GAMES: GameEntry[] = [
  {
    slug: 'neon-rush',
    title: 'NEON RUSH',
    tagline: 'An endless neon racer. Weave through traffic, chain near misses, beat your best.',
    description:
      'Switch lanes at the last possible moment, grab coins and power-ups, and chain near misses into an x8 combo. ' +
      'Unlock 65 cosmetic cars, take on three new missions every day and climb the online leaderboard.',
    categories: ['racing', 'arcade'],
    tags: ['car', 'driving', 'endless', 'runner', 'traffic', 'neon', 'reflex', 'high score', 'leaderboard'],
    released: '2026-10-17',
    accent: 'cyan',
    art: {
      tile: '/games/neon-rush/tile.webp',
      wide: '/games/neon-rush/wide.webp',
      alt: 'A blue race car between a cyan and a magenta neon lane line, with the NEON RUSH logo',
      bg: '#1d0b3a',
    },
    // Built from ../neon-rush into dist/play/neon-rush/ (scripts/build-games.mjs) and served by GlitchBound.
    runtime: { kind: 'embed', url: '/play/neon-rush/', origins: ['self'] },
    aspect: 'portrait',
    controls: {
      keyboard: ['Left / Right arrows or A / D: switch lanes', 'P or Esc: pause', 'Enter: start a run'],
      touch: ['Tap the left or right half of the screen to switch lanes'],
    },
    stats: [
      { key: 'score', label: 'Best score' },
      { key: 'meters', label: 'Best distance', unit: 'm' },
      { key: 'coins', label: 'Most coins in a run' },
      { key: 'nearMisses', label: 'Most near misses' },
    ],
    highlights: [
      '65 collectible cosmetic cars across 10 body classes',
      'Daily and all-time online leaderboards',
      'Three new missions every day',
      'Fair traffic: every row leaves a way through',
    ],
    daily: [
      { metric: 'meters', targets: [1000, 1400, 1800, 2200, 2600], label: 'Drive {n} m in a single run' },
      { metric: 'coins', targets: [30, 40, 50, 60], label: 'Collect {n} coins in a single run' },
      { metric: 'nearMisses', targets: [5, 7, 9, 12], label: 'Pull off {n} near misses in a single run' },
      { metric: 'score', targets: [1500, 2000, 2500, 3200], label: 'Score {n} points in a single run' },
    ],
    // Top speed is about 20 m/s plus coins and near-miss combos; this is a generous ceiling.
    limits: { scorePerSecond: 250, minSeconds: 2 },
  },
];
