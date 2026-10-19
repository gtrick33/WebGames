import { describe, expect, it } from 'vitest';
import { getGame } from '../src/catalog/catalog';
import { arrowAt, canLeave, DAILY_LEVELS, levelPoints, makeLevel, pathAhead, resultLine, sizeFor, type Level } from '../src/games/outta-here/logic';

/** Clears a level by always sending off the first arrow that can leave. Returns the order, or null if stuck. */
function solve(level: Level): number[] | null {
  const gone = new Set<number>();
  const order: number[] = [];
  while (gone.size < level.arrows.length) {
    const next = level.arrows.find((a) => !gone.has(a.id) && canLeave(level, gone, a));
    if (!next) return null;
    gone.add(next.id);
    order.push(next.id);
  }
  return order;
}

describe('Outta Here', () => {
  it('builds the same level from the same seed', () => {
    expect(makeLevel(5, 3)).toEqual(makeLevel(5, 3));
    expect(makeLevel(5, 3)).not.toEqual(makeLevel(6, 3));
  });

  it('grows the board from 5x5 to 8x8', () => {
    expect(sizeFor(1)).toBe(5);
    expect(sizeFor(3)).toBe(6);
    expect(sizeFor(7)).toBe(8);
    expect(sizeFor(40)).toBe(8);
  });

  it('makes every level solvable, well filled and with arrows that start blocked', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const n of [1, 2, 4, 7, 12]) {
        const level = makeLevel(seed * 7919, n);
        expect(solve(level), `seed ${seed} level ${n}`).not.toBeNull();
        const cells = level.arrows.reduce((a, x) => a + x.cells.length, 0);
        expect(cells).toBeGreaterThan(level.size * level.size * 0.6);
        // Arrows never overlap.
        expect(new Set(level.arrows.flatMap((a) => a.cells)).size).toBe(cells);
        if (n >= 2) expect(level.arrows.some((a) => !canLeave(level, new Set(), a))).toBe(true);
      }
    }
  });

  it('finds arrows by cell and checks the way out', () => {
    const level = makeLevel(11, 1);
    const a = level.arrows[0]!;
    expect(arrowAt(level, new Set(), a.cells[0]!)?.id).toBe(a.id);
    expect(arrowAt(level, new Set([a.id]), a.cells[0]!)).toBeNull();
    expect(pathAhead(5, 12, 1)).toEqual([13, 14]);
    expect(pathAhead(5, 12, 0)).toEqual([7, 2]);
  });

  it('scores within the limits even for a very fast perfect run', () => {
    const limits = getGame('outta-here')!.limits!;
    let total = 0;
    let seconds = 0;
    const levels: { mistakes: number; cleared: boolean }[] = [];
    for (let n = 1; n <= DAILY_LEVELS; n++) {
      const level = makeLevel(99, n);
      // Three taps a second, no thinking time.
      const secs = level.arrows.length / 3;
      seconds += secs;
      total += levelPoints(level, n, 0, secs);
      levels.push({ mistakes: 0, cleared: true });
    }
    expect(total / seconds).toBeLessThan(limits.scorePerSecond);
    expect(resultLine(levels)).toBe('💨💨💨💨💨');
    expect(resultLine([{ mistakes: 1, cleared: true }, { mistakes: 3, cleared: false }])).toBe('🟡💥');
  });
});
