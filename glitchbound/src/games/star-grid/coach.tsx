import { CoachGrid, type CoachStep } from '../../components/Coach';

/** Region colours for the pictures (a 4×4 grid split into four regions). */
const REGION = ['#ffd6e0', '#cdeefd', '#fff1b8', '#d9f7c8'];
const REGIONS = [0, 0, 1, 1, 0, 2, 2, 1, 3, 2, 1, 1, 3, 3, 3, 1];
const STARS = new Set([1, 7, 8, 14]);

/** Star Grid's first-time walkthrough: the three rules, one at a time. */
export const COACH: CoachStep[] = [
  {
    title: 'One star in every row and column',
    body: 'Each row has exactly one star, and so does each column.',
    art: <CoachGrid size={4} cells={Array.from({ length: 16 }, (_, k) => ({ text: STARS.has(k) ? '★' : '' }))} />,
  },
  {
    title: 'And one in every colour',
    body: 'The grid is split into coloured regions. Each region gets exactly one star too.',
    art: <CoachGrid size={4} cells={REGIONS.map((r, k) => ({ text: STARS.has(k) ? '★' : '', style: { background: REGION[r] } }))} />,
  },
  {
    title: 'Stars never touch',
    body: 'Not even at the corners. Tap a square for a star, or switch to Cross out to mark squares you have ruled out. Mistakes light up red.',
    art: (
      <CoachGrid
        size={3}
        cells={[{ cls: 'is-bad', text: '★' }, { text: '' }, { text: '✕' }, { text: '' }, { cls: 'is-bad', text: '★' }, { text: '✕' }, { text: '✕' }, { text: '✕' }, { text: '' }]}
      />
    ),
  },
];
