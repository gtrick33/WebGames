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
  {
    slug: 'letter-pinch',
    title: 'Letter Pinch',
    tagline: 'A daily word puzzle where every tile points the way through the alphabet.',
    description:
      'Find the secret five-letter word in six guesses. Each tile says whether the hidden letter comes earlier or later ' +
      'in the alphabet, and the windows above the board squeeze shut as you close in. One shared daily word, unlimited practice.',
    categories: ['word', 'puzzle'],
    tags: ['words', 'letters', 'daily', 'alphabet', 'deduction', 'brain', 'streak', 'five letters'],
    released: '2026-10-18',
    accent: 'violet',
    art: {
      tile: '/games/letter-pinch/tile.webp',
      wide: '/games/letter-pinch/wide.webp',
      alt: 'Rows of blue, coral and lime letter tiles with up and down arrows closing in on the word PINCH',
      bg: '#ffe7c2',
    },
    runtime: { kind: 'module' },
    aspect: 'portrait',
    controls: {
      keyboard: ['Type letters', 'Enter: submit a guess', 'Backspace: delete', 'Esc: close a panel'],
      touch: ['Tap the on-screen keys'],
    },
    stats: [
      { key: 'score', label: 'Best score' },
      { key: 'spare', label: 'Most guesses to spare' },
      { key: 'guesses', label: 'Fewest guesses', lowerIsBetter: true },
      { key: 'seconds', label: 'Fastest solve', unit: 's', lowerIsBetter: true },
      { key: 'streak', label: 'Longest daily streak' },
    ],
    highlights: [
      'A new word every day, the same for everyone',
      'Unlimited practice puzzles',
      'Daily streaks, win rate and guess distribution',
      'Spoiler-free arrow grid to share',
    ],
    daily: [
      { metric: 'spare', targets: [1, 2, 2, 3], label: 'Solve a Letter Pinch with {n} or more guesses left' },
      { metric: 'score', targets: [450, 500, 550], label: 'Score {n} points in one Letter Pinch puzzle' },
    ],
  },
];
