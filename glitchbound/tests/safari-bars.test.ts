import { describe, expect, it } from 'vitest';
import { shouldGoToTop } from '../src/platform/safariBars';

/**
 * iPhone Safari with a game pinned over the screen: the swipe that hides Safari's bar needs the page under the game to
 * have room to scroll. These hold the rule that keeps that room there every time.
 */
describe('room for the swipe that hides Safari’s bar', () => {
  const now = { out: true, wasOut: false, touching: false, scrollY: 120 };

  it('goes back to the top when the bar has just come out and the room is used up', () => {
    expect(shouldGoToTop(now, 'bar')).toBe(true);
  });

  it('leaves the page alone while a finger is down: the swipe under way is the one hiding the bar', () => {
    expect(shouldGoToTop({ ...now, touching: true }, 'bar')).toBe(false);
    expect(shouldGoToTop({ ...now, touching: true }, 'lift')).toBe(false);
  });

  it('does nothing when the bar is hidden, or the page is already at its top', () => {
    expect(shouldGoToTop({ ...now, out: false }, 'bar')).toBe(false);
    expect(shouldGoToTop({ ...now, out: false }, 'lift')).toBe(false);
    expect(shouldGoToTop({ ...now, scrollY: 0 }, 'bar')).toBe(false);
  });

  it('does not keep pulling the page up while the bar simply stays out', () => {
    expect(shouldGoToTop({ ...now, wasOut: true }, 'bar')).toBe(false);
  });

  it('after a swipe that left the bar out, makes room for the next one', () => {
    expect(shouldGoToTop({ ...now, wasOut: true }, 'lift')).toBe(true);
  });
});
