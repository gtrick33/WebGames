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
    slug: 'memory-grid',
    title: 'Memory Grid',
    tagline: 'Watch the tiles light up, then tap them back in order. How long can your streak go?',
    description:
      'A bright sequence-memory game: tiles flash in order and you repeat the pattern. Sequences grow, playback speeds up ' +
      'and the grid expands from 3×3 to 5×5. Play Classic, a 60-second Speed Run, the Daily Challenge or the no-mistakes Perfect Recall ladder.',
    categories: ['puzzle', 'arcade'],
    tags: ['memory', 'sequence', 'simon', 'brain', 'grid', 'tiles', 'daily', 'pattern', 'focus'],
    released: '2026-10-18',
    accent: 'yellow',
    art: {
      tile: '/games/memory-grid/tile.webp',
      wide: '/games/memory-grid/wide.webp',
      alt: 'A 3 by 3 grid of candy-coloured tiles on cream paper, three of them glowing in sequence, with the Memory Grid logo',
      bg: '#fff4e2',
    },
    runtime: { kind: 'module' },
    aspect: 'square',
    controls: {
      keyboard: ['Arrow keys: move between tiles', 'Enter or Space: tap a tile', '1 to 9: tap a 3×3 tile (number-pad layout)', 'M: mute', 'R: retry'],
      touch: ['Tap the tiles in the order they lit up'],
    },
    stats: [
      { key: 'score', label: 'Best score' },
      { key: 'longest', label: 'Longest sequence' },
      { key: 'patterns', label: 'Most patterns in a run' },
      { key: 'accuracy', label: 'Best accuracy', unit: '%' },
      { key: 'time', label: 'Fastest Perfect Recall', unit: 's', lowerIsBetter: true },
    ],
    highlights: [
      'Four modes: Classic, Speed Run, Daily Challenge and Perfect Recall',
      'The Daily Challenge plays the same patterns for everyone on the same date',
      'Grids grow from 3×3 to 5×5 with gentle difficulty steps',
      'Spoiler-free share text, local top-5 records and daily streaks',
    ],
    ownDaily: { label: 'Today’s grid' },
    daily: [
      { metric: 'longest', targets: [6, 7, 8, 9], label: 'Repeat a {n}-step sequence' },
      { metric: 'score', targets: [150, 250, 350], label: 'Score {n} points in one run' },
      { metric: 'patterns', targets: [5, 6, 7, 8], label: 'Clear {n} patterns in one run' },
    ],
  },
  {
    slug: 'color-recall',
    title: 'Color Recall',
    tagline: 'One look at an everyday color, then mix it from memory. Five colors a day.',
    description:
      'Glance at a famous everyday color like Stop Sign Red or School Bus Yellow, then recreate it with HSB or RGB sliders. ' +
      'Every guess is scored for perceptual accuracy with tips on what to fix. Five new colors daily, the same for everyone, plus unlimited practice.',
    categories: ['puzzle', 'arcade'],
    tags: ['color', 'colour', 'memory', 'daily', 'perception', 'hue', 'rgb', 'palette', 'design', 'eye test'],
    released: '2026-10-18',
    accent: 'coral',
    art: {
      tile: '/games/color-recall/tile.webp',
      wide: '/games/color-recall/wide.webp',
      alt: 'Colorful paint swatches fanning out beside a slider with a round color knob',
      bg: '#2b1650',
    },
    runtime: { kind: 'module' },
    aspect: 'portrait',
    controls: {
      keyboard: ['Tab to a slider, then Left / Right arrows to adjust', 'Enter: lock in your color, then next color'],
      touch: ['Drag the sliders; tap − / + to fine-tune', 'Tap Lock it in'],
    },
    stats: [
      { key: 'score', label: 'Best 5-color score' },
      { key: 'accuracy', label: 'Best accuracy', unit: '%' },
      { key: 'bestColor', label: 'Best single color' },
      { key: 'perfects', label: 'Most perfect colors in a game' },
    ],
    highlights: [
      '70 hand-picked everyday colors with original illustrations',
      'Five daily colors, identical for every player, with streaks and spoiler-free sharing',
      'Perceptual CIEDE2000 scoring with plain-language tips',
      'HSB or RGB sliders with fine-tune buttons, built for phones',
    ],
    ownDaily: { label: 'Today’s 5 colors' },
    daily: [
      { metric: 'score', targets: [3000, 3300, 3600, 3900], label: 'Score {n} points in one 5-color game' },
      { metric: 'bestColor', targets: [850, 900, 950], label: 'Mix a single color worth {n} points' },
      { metric: 'accuracy', targets: [65, 70, 75], label: 'Finish a 5-color game with {n}% accuracy' },
    ],
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
    ownDaily: { label: 'Today’s word' },
    daily: [
      { metric: 'spare', targets: [1, 2, 2, 3], label: 'Solve a Letter Pinch with {n} or more guesses left' },
      { metric: 'score', targets: [450, 500, 550], label: 'Score {n} points in one Letter Pinch puzzle' },
    ],
  },
  {
    slug: 'mini-racer',
    title: 'Mini Racer',
    tagline: 'Hold left or right to steer a toy car through drifty little races. Gas is automatic.',
    description:
      'Hold the left or right side of the screen to throw a chunky toy car around six handmade tracks of tarmac, gravel, dirt, sand and ice, plus a new circuit every day. ' +
      'Slide through the bends for a turbo, race the ghost of your best lap, earn coins and collect ten cars.',
    categories: ['racing', 'arcade'],
    tags: ['car', 'driving', 'drift', 'time trial', 'top-down', 'ghost', 'daily', 'laps', 'kart', 'one-touch', 'cars'],
    released: '2026-10-18',
    accent: 'coral',
    art: {
      tile: '/games/mini-racer/tile.webp',
      wide: '/games/mini-racer/wide.webp',
      alt: 'A coral toy race car drifting around a bend on a sunny seaside track, with the Mini Racer logo',
      bg: '#f6d896',
    },
    runtime: { kind: 'module' },
    aspect: 'square',
    controls: {
      keyboard: ['Left / Right or A / D: steer (gas is automatic)', 'Hold a turn at speed to drift', 'R: restart, Esc or P: pause'],
      touch: ['Hold the left half of the screen to turn left, the right half to turn right', 'Gas is automatic; hold a turn at speed to drift'],
    },
    stats: [
      { key: 'score', label: 'Race points' },
      { key: 'raceMs', label: 'Fastest 3-lap race', unit: 'ms', lowerIsBetter: true },
      { key: 'lapMs', label: 'Fastest lap', unit: 'ms', lowerIsBetter: true },
      { key: 'drift', label: 'Most drift points in a race' },
      { key: 'cleanLaps', label: 'Most clean laps in a race' },
    ],
    highlights: [
      'One-touch steering: hold left or right, gas is automatic',
      'Six handmade tracks plus a new generated track every day',
      'Tarmac, gravel, dirt, sand, ice, mud and boost strips, each with its own grip and speed',
      'Ten collectible cars with small, balanced handling differences',
      'Ghost replay of your best lap on every track',
    ],
    ownDaily: { label: 'Today’s track' },
    daily: [
      { metric: 'score', targets: [2400, 2700, 2900], label: 'Score {n} race points in one race' },
      { metric: 'drift', targets: [1500, 2500, 3500], label: 'Rack up {n} drift points in one race' },
      { metric: 'cleanLaps', targets: [2, 3], label: 'Drive {n} clean laps in one race' },
    ],
    // Race points are ~1000 per lap at gold pace, i.e. under 130 per second of real play even far beyond gold.
    limits: { scorePerSecond: 160, minSeconds: 15 },
  },
];
