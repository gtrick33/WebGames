import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StarGrid from '../src/games/star-grid/Game';
import OuttaHere from '../src/games/outta-here/Game';
import { canLeave, makeLevel } from '../src/games/outta-here/logic';
import type { ChallengeSpec } from '../src/platform/challenge';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const challenge = (seed: number): ChallengeSpec => ({ id: 'abc', round: 1, seed, mode: 'fresh', day: '2026-10-19' });
const press = (key: string): boolean => fireEvent.keyDown(window, { key });

describe('Star Grid UI', () => {
  it('starts the clock with the grid, not with the first tap', () => {
    render(<StarGrid host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s grids' }));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('0:05')).toBeTruthy();
  });

  it('P pauses and resumes without the keyboard cursor, and keys do nothing while paused', () => {
    render(<StarGrid host={{ report: vi.fn() }} restartKey={0} challenge={challenge(7)} />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('0:03')).toBeTruthy();
    act(() => {
      press('p');
    });
    expect(screen.getByText('Paused · tap to continue')).toBeTruthy();
    act(() => {
      press('ArrowDown');
      press('s');
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('0:03')).toBeTruthy();
    expect(screen.getAllByRole('gridcell').filter((c) => c.getAttribute('aria-label')?.endsWith('star'))).toHaveLength(0);
    act(() => {
      press('Escape');
    });
    expect(screen.queryByText('Paused · tap to continue')).toBeNull();
  });
});

describe('Outta Here UI', () => {
  it('leaves Enter to the end screen’s focused button once the hearts are gone', () => {
    const report = vi.fn();
    const seed = 12345;
    render(<OuttaHere host={{ report }} restartKey={0} challenge={challenge(seed)} />);
    const level = makeLevel(seed, 1);
    const k = level.arrows.findIndex((a) => !canLeave(level, new Set(), a));
    expect(k).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < 3; i++) {
      const arrow = document.querySelectorAll('g.oh-arrow')[k]!;
      fireEvent.pointerDown(arrow.querySelector('rect')!);
    }
    expect(screen.getByText('Out of hearts')).toBeTruthy();
    expect(report).toHaveBeenLastCalledWith({ type: 'end', score: 0, stats: { levels: 0, perfect: 0 }, challenge: { id: 'abc', round: 1 } });
    // Not cancelled: the browser may click the focused button.
    expect(press('Enter')).toBe(true);
    expect(press(' ')).toBe(true);
  });
});
