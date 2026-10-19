import { describe, expect, it } from 'vitest';
import { getGame } from '../src/catalog/catalog';
import { conflicts, countSolutions, DAILY_SIZES, makePuzzle, resultLine, solved, solvePoints, type Mark } from '../src/games/star-grid/logic';

describe('Star Grid', () => {
  it('makes the same puzzle from the same seed', () => {
    expect(makePuzzle(4, 7)).toEqual(makePuzzle(4, 7));
    expect(makePuzzle(4, 7)).not.toEqual(makePuzzle(5, 7));
  });

  it('only makes puzzles with exactly one solution, and the stored one is it', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const size of [...DAILY_SIZES, 9]) {
        const p = makePuzzle(seed * 31337, size);
        expect(countSolutions(size, p.regions, 3)).toBe(1);
        expect(new Set(p.regions).size).toBe(size);
        const marks: Mark[] = new Array(size * size).fill(0);
        p.stars.forEach((c, row) => (marks[row * size + c] = 2));
        expect(solved(p, marks)).toBe(true);
      }
    }
  });

  it('flags stars that share a row, a column, a region or touch', () => {
    const p = makePuzzle(1, 6);
    const marks: Mark[] = new Array(36).fill(0);
    marks[0] = 2;
    marks[7] = 2; // diagonal neighbour
    expect([...conflicts(p, marks)].sort()).toEqual([0, 7]);
    marks[7] = 0;
    marks[3] = 2; // same row
    expect(conflicts(p, marks).has(3)).toBe(true);
    expect(solved(p, marks)).toBe(false);
  });

  it('scores faster solves higher, with a floor', () => {
    expect(solvePoints(8, 0)).toBe(1000);
    expect(solvePoints(8, 100)).toBe(700);
    expect(solvePoints(8, 10_000)).toBe(250);
    expect(resultLine([42, 75, 130])).toBe('🟩 0:42  🟨 1:15  🟥 2:10');
  });

  it('stays inside the score limits for a lightning-fast daily', () => {
    const limits = getGame('star-grid')!.limits!;
    const seconds = DAILY_SIZES.map((s) => s * 1.5);
    const total = DAILY_SIZES.reduce((a, s, i) => a + solvePoints(s, seconds[i]!), 0);
    expect(total / seconds.reduce((a, b) => a + b, 0)).toBeLessThan(limits.scorePerSecond);
  });
});
