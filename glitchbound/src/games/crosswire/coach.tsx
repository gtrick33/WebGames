import { CoachGrid, type CoachStep } from '../../components/Coach';

const row = (cells: { cls?: string; text?: string }[]) => cells;

/** Crosswire's first-time walkthrough: arrowwords are new to most players outside Bulgaria. */
export const COACH: CoachStep[] = [
  {
    title: 'The clues live inside the grid',
    body: 'Each yellow square is a clue. Its arrow shows where the answer goes: → to the right, ↓ downwards, ↳ ↴ round the corner.',
    art: <CoachGrid size={5} cells={row([{ cls: 'is-clue', text: 'Big cat →' }, { cls: 'is-word' }, { cls: 'is-word' }, { cls: 'is-word' }, { cls: 'is-word' }])} />,
  },
  {
    title: 'Tap a clue, then type',
    body: 'The answer fills in along the arrow. Tap the same square again to switch between across and down. On a phone, the keys are under the grid.',
    art: (
      <CoachGrid
        size={5}
        cells={row([
          { cls: 'is-clue', text: 'Big cat →' },
          { cls: 'is-word', text: 'L' },
          { cls: 'is-word', text: 'I' },
          { cls: 'is-hot coach-pulse', text: '' },
          { cls: 'is-word' },
        ])}
      />
    ),
  },
  {
    title: 'Crack the mystery word',
    body: 'Circled letters spell a bonus word. Stuck? Check your grid, or reveal a letter or a word for a few points.',
    art: (
      <CoachGrid
        size={5}
        cells={row([
          { cls: 'is-clue', text: 'Big cat →' },
          { cls: 'is-word', text: 'L' },
          { cls: 'is-word is-circle', text: 'I' },
          { cls: 'is-word', text: 'O' },
          { cls: 'is-word is-circle', text: 'N' },
        ])}
      />
    ),
  },
];
