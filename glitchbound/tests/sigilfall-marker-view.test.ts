/**
 * A blow's mark on the ground is drawn whenever any of it can be seen (the owner: "some of the red projected spells of
 * the boss get cut off on the side"). What was asked was only whether its middle was near the view: a boss's great
 * circle or cone centered just past the picture's edge wasn't drawn at all, though half of it lay across the room.
 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { inView } from '../src/games/sigilfall/render/effects';

describe('what is drawn of a mark on the ground', () => {
  // (a desk's view: about 340 by 270 world pixels round the hero)
  const view = [1000, 1000, 340, 270] as const;

  it('a mark whose middle is past the edge is drawn if it reaches into the view', () => {
    // 330 to the side: its middle is past the edge (0.7 of the width is 238)
    expect(inView(...view, 1330, 1000)).toBe(false);
    expect(inView(...view, 1330, 1000, 150)).toBe(true);
    expect(inView(...view, 670, 1000, 150)).toBe(true);
    // up and down the picture too
    expect(inView(...view, 1000, 1340)).toBe(false);
    expect(inView(...view, 1000, 1340, 120)).toBe(true);
  });

  it('one that reaches nowhere near is still left out', () => {
    expect(inView(...view, 1700, 1000, 150)).toBe(false);
    expect(inView(...view, 1000, 400, 150)).toBe(false);
  });

  it('a spot with no reach is judged as it always was', () => {
    expect(inView(...view, 1200, 1000)).toBe(true);
    expect(inView(...view, 1239, 1000)).toBe(false);
  });

  it('there are bosses to fight (the rule is one for all of them, in every place)', () => {
    expect(Object.keys(BOSSES).length).toBeGreaterThan(20);
  });
});
