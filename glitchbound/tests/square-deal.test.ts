import { describe, expect, it } from 'vitest';
import { getGame } from '../src/catalog/catalog';
import { dealer, emptyBoard, fits, fitsAnywhere, linePoints, newGame, place, resultLine, SIZE, streakMultiplier, type Piece, type State } from '../src/games/square-deal/logic';

/** Greedy autopilot: the placement that clears most lines, else the one touching most filled cells. */
function bestMove(s: State): { slot: number; row: number; col: number } | null {
  let best: { slot: number; row: number; col: number; v: number } | null = null;
  s.tray.forEach((p, slot) => {
    if (!p) return;
    for (let row = 0; row <= SIZE - p.h; row++)
      for (let col = 0; col <= SIZE - p.w; col++) {
        if (!fits(s.board, p, row, col)) continue;
        const b = s.board.slice();
        for (const [y, x] of p.cells) b[(row + y) * SIZE + col + x] = 0;
        let v = 0;
        for (let i = 0; i < SIZE; i++) {
          if ([...Array(SIZE).keys()].every((j) => b[i * SIZE + j] !== -1)) v += 100;
          if ([...Array(SIZE).keys()].every((j) => b[j * SIZE + i] !== -1)) v += 100;
        }
        v -= row + col * 0.1;
        if (!best || v > best.v) best = { slot, row, col, v };
      }
  });
  return best;
}

const play = (seed: number, maxMoves = 400): State => {
  let s = newGame(seed);
  for (let i = 0; i < maxMoves && !s.over; i++) {
    const m = bestMove(s)!;
    const next = place(s, m.slot, m.row, m.col);
    expect(next.result.ok).toBe(true);
    s = next.state;
  }
  return s;
};

describe('Square Deal', () => {
  it('deals the same pieces for the same seed', () => {
    const a = dealer(42);
    const b = dealer(42);
    for (let i = 0; i < 50; i++) expect(a()).toEqual(b());
    expect(newGame(42).tray).toEqual(newGame(42).tray);
    const c = dealer(43);
    expect(Array.from({ length: 10 }, () => c().cells.length)).not.toEqual(Array.from({ length: 10 }, () => dealer(42)().cells.length));
  });

  it('clears a full row and a full column and scores them', () => {
    const s = newGame(1);
    const dot: Piece = { id: 99, cells: [[0, 0]], w: 1, h: 1, color: 2 };
    for (let c = 0; c < SIZE; c++) if (c !== 3) s.board[5 * SIZE + c] = 1;
    for (let r = 0; r < SIZE; r++) if (r !== 5) s.board[r * SIZE + 3] = 1;
    s.tray = [dot, null, null];
    const { state, result: r } = place(s, 0, 5, 3);
    expect(r.ok).toBe(true);
    expect(r.lines).toBe(2);
    expect(r.cleared).toHaveLength(15);
    expect(r.points).toBe(1 + linePoints(2));
    expect(state.board.every((v) => v === -1)).toBe(true);
    // The tray refilled with three new pieces, and the old state was left alone.
    expect(state.tray.every((p) => p !== null)).toBe(true);
    expect(s.board[5 * SIZE]).toBe(1);
  });

  it('refuses pieces that overlap or leave the board', () => {
    const s = newGame(7);
    const p = s.tray[0]!;
    expect(place(s, 0, SIZE, 0).result.ok).toBe(false);
    expect(place(s, 0, 0, SIZE - p.w + 1).result.ok).toBe(false);
    const next = place(s, 0, 0, 0);
    expect(next.result.ok).toBe(true);
    expect(place(next.state, 0, 0, 0).result.ok).toBe(false); // slot is used now
  });

  it('ends the game when no tray piece fits', () => {
    const s = newGame(3);
    s.board = emptyBoard().map((_, i) => (i % 2 === (Math.floor(i / SIZE) % 2) ? 1 : -1)); // checkerboard
    const big: Piece = { id: 1, cells: [[0, 0], [0, 1]], w: 2, h: 1, color: 0 };
    expect(fitsAnywhere(s.board, big)).toBe(false);
  });

  it('streaks multiply line points, capped at x4', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(1)).toBe(1);
    expect(streakMultiplier(2)).toBe(1.5);
    expect(streakMultiplier(50)).toBe(4);
  });

  it('plays long rounds and stays inside the score limits', () => {
    const limits = getGame('square-deal')!.limits!;
    for (const seed of [1, 2, 3, 4, 5, 99, 1234]) {
      const s = play(seed);
      expect(s.moves).toBeGreaterThan(15);
      expect(s.score).toBeGreaterThan(0);
      // A very fast player makes about two moves a second.
      expect(s.score / (s.moves / 2)).toBeLessThan(limits.scorePerSecond);
      expect(resultLine(s.score, s.lines, s.bestStreak)).toContain('lines');
    }
  });
});
