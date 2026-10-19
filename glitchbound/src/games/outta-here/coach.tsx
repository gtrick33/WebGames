import { CoachGrid, type CoachStep } from '../../components/Coach';

/** Outta Here's first-time walkthrough: tap, mind the blockers, find the order. */
export const COACH: CoachStep[] = [
  {
    title: 'Tap an arrow to send it off',
    body: 'Every arrow wants off the board. Tap one and it shoots out in the way it points.',
    art: <CoachGrid size={4} cells={[{}, {}, {}, {}, { cls: 'is-hot coach-pulse', text: '→' }, {}, {}, {}, {}, { text: '↓' }, {}, {}, {}, {}, {}, { text: '↑' }]} />,
  },
  {
    title: 'Blocked? It bounces back',
    body: 'If another arrow is in the way, yours bounces and you lose a heart ❤️. Run out of hearts and the level is over.',
    art: <CoachGrid size={4} cells={[{}, {}, {}, {}, { cls: 'is-bad', text: '→' }, {}, { cls: 'is-bad', text: '↑' }, {}, {}, {}, {}, {}, {}, {}, {}, {}]} />,
  },
  {
    title: 'Find the order',
    body: 'Clear the arrows that block the others first. Empty the board to win the level; a flawless one scores the most.',
    art: <CoachGrid size={4} cells={[{}, {}, {}, {}, { text: '→ 2' }, {}, { cls: 'is-hot', text: '↑ 1' }, {}, {}, {}, {}, {}, {}, { text: '← 3' }, {}, {}]} />,
  },
];
