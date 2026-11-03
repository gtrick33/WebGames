import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StarGrid from '../src/games/star-grid/Game';
import { dailyPuzzles, seeded } from '../src/games/star-grid/prepare';
import type { Puzzle } from '../src/games/star-grid/logic';
import type { ChallengeSpec } from '../src/platform/challenge';
import { dayKey } from '../src/platform/dates';

const KEY = 'glitchbound.star-grid';
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const press = (key: string, extra: Record<string, unknown> = {}, target: Element | Window = window) =>
  act(() => {
    fireEvent.keyDown(target, { key, bubbles: true, ...extra });
  });
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? '{}');
const events = (report: ReturnType<typeof vi.fn>) => report.mock.calls.map(([e]) => e as { type: string; score?: number; daily?: boolean; challenge?: unknown; stats?: Record<string, number> });
const types = (report: ReturnType<typeof vi.fn>) => events(report).map((e) => e.type);
const spec = (over: Partial<ChallengeSpec> = {}): ChallengeSpec => ({ id: 'abc', round: 1, seed: 777, mode: 'fresh', day: '2026-10-29', ...over });
const cursorCell = () => document.querySelector('.sgd-cell.is-cursor')?.getAttribute('data-cell');
const stars = () => screen.getAllByRole('gridcell').filter((c) => c.getAttribute('aria-label')?.endsWith(': star')).length;

/** The grid on screen, read back from its region borders and solved (endless grids are random). */
function endlessShown(): Puzzle {
  const cells = screen.getAllByRole('gridcell');
  const size = Math.sqrt(cells.length);
  const regions = cells.map((c) => Number(/is-r(\d)/.exec(c.className)![1]));
  // The grid has exactly one solution: find it by the rules.
  return { size, regions, stars: solve(size, regions)! };
}
function solve(size: number, regions: number[]): number[] | null {
  const cols: number[] = [];
  const go = (row: number): boolean => {
    if (row === size) return true;
    for (let c = 0; c < size; c++) {
      if (cols.includes(c) || cols.some((k, r) => regions[r * size + k] === regions[row * size + c]) || (row > 0 && Math.abs(c - cols[row - 1]!) < 2)) continue;
      cols.push(c);
      if (go(row + 1)) return true;
      cols.pop();
    }
    return false;
  };
  return go(0) ? cols : null;
}

/** Puts the stars of rows `from` to `to - 1` of the solution down with the keyboard (the cursor starts hidden). */
function placeStars(p: Puzzle, from = 0, to = p.size): void {
  if (!cursorCell()) press('ArrowRight'); // shows the cursor on the first square
  for (let row = from; row < to; row++) {
    for (let k = 0; k < p.size; k++) {
      press('ArrowUp');
      press('ArrowLeft');
    }
    for (let k = 0; k < row; k++) press('ArrowDown');
    for (let k = 0; k < p.stars[row]!; k++) press('ArrowRight');
    press('s');
  }
}

describe('Star Grid in the page', () => {
  it('reports the start when the grid opens, not on the first mark (SR-01)', () => {
    const report = vi.fn();
    render(<StarGrid host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: '6×6' }));
    expect(types(report)).toEqual(['start']);
    press('ArrowRight');
    press('s');
    expect(types(report)).toEqual(['start']);
  });

  it('reports a friends’ challenge round’s start as it opens (SR-01)', () => {
    const report = vi.fn();
    render(<StarGrid host={{ report }} restartKey={0} challenge={spec()} />);
    expect(types(report)).toEqual(['start']);
  });

  it('pauses when the tab is hidden, and the time away is not counted (SR-02)', () => {
    render(<StarGrid host={{ report: vi.fn() }} restartKey={0} challenge={spec()} />);
    wait(3000);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    wait(10_000);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByText('Paused · tap to continue')).toBeTruthy();
    expect(screen.getByText('0:03')).toBeTruthy();
    fireEvent.click(screen.getByText('Paused · tap to continue'));
    wait(1000);
    expect(screen.getByText('0:04')).toBeTruthy();
  });

  it('tells a mouse and keyboard player to click or press P on the pause card (design: pause copy)', () => {
    const real = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...real(q), matches: q === '(hover: hover)' })) as typeof window.matchMedia;
    try {
      render(<StarGrid host={{ report: vi.fn() }} restartKey={0} challenge={spec()} />);
      press('p');
      expect(screen.getByText('Paused · click or press P to continue')).toBeTruthy();
    } finally {
      window.matchMedia = real;
    }
  });

  it('shows the cursor on the first square with the first arrow press (SR-07)', () => {
    render(<StarGrid host={{ report: vi.fn() }} restartKey={0} challenge={spec()} />);
    press('ArrowRight');
    expect(cursorCell()).toBe('0');
    press('ArrowRight');
    expect(cursorCell()).toBe('1');
  });

  it('keeps whole-second times everywhere, and Pause rests on the Solved banner (SR-06, SR-09)', () => {
    const report = vi.fn();
    const [p6, p7] = dailyPuzzles(dayKey());
    render(<StarGrid host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s grids' }));
    wait(2600);
    placeStars(p6!);
    expect(screen.getByText('Solved in 0:03!')).toBeTruthy();
    expect(stored().progress.times).toEqual([3]);
    const pause = screen.getByRole('button', { name: 'Pause' }) as HTMLButtonElement;
    expect(pause.disabled).toBe(true);
    fireEvent.click(pause);
    fireEvent.click(screen.getByText('Solved in 0:03!'));
    expect(screen.queryByText('Paused · tap to continue')).toBeNull();
    wait(2600);
    placeStars(p7!);
    fireEvent.click(screen.getByText('Solved in 0:03!'));
    wait(2600);
    placeStars(dailyPuzzles(dayKey())[2]!);
    expect(stored().daily[dayKey()].times).toEqual([3, 3, 3]);
    expect(screen.getByText(/3 grids in 0:09/)).toBeTruthy();
    const end = events(report).find((e) => e.type === 'end')!;
    expect(end).toMatchObject({ daily: true, stats: { time: 9 } });
  });

  it('picks a challenge round up where it was after a reload, and never replays a finished one (checklist a)', () => {
    const p = seeded(777, 8);
    const first = render(<StarGrid host={{ report: vi.fn() }} restartKey={0} challenge={spec()} />);
    wait(4000);
    placeStars(p, 0, 3);
    first.unmount();

    const report = vi.fn();
    const second = render(<StarGrid host={{ report }} restartKey={0} challenge={spec()} />);
    expect(screen.getByText('Paused · tap to continue')).toBeTruthy();
    expect(stars()).toBe(3);
    expect(screen.getByText('0:04')).toBeTruthy();
    fireEvent.click(screen.getByText('Paused · tap to continue'));
    placeStars(p, 3);
    expect(types(report)).toEqual(['start', 'end']);
    expect(events(report)[1]).toMatchObject({ challenge: { id: 'abc', round: 1 } });
    second.unmount();

    const third = vi.fn();
    render(<StarGrid host={{ report: third }} restartKey={0} challenge={spec()} />);
    expect(screen.getByRole('link', { name: 'See the scoreboard' })).toBeTruthy();
    expect(third).not.toHaveBeenCalled();
  });

  it('plays the real daily for a “Today’s daily” challenge, and counts a daily played before (checklist b)', () => {
    const day = dayKey();
    const report = vi.fn();
    const first = render(<StarGrid host={{ report }} restartKey={0} challenge={spec({ mode: 'daily', day, seed: 5 })} />);
    expect(screen.getByText(/1 of 3/)).toBeTruthy();
    expect(stored().daily[day]).toMatchObject({ open: true });
    for (const [i, p] of dailyPuzzles(day).entries()) {
      if (i) fireEvent.click(screen.getByText(/^Solved in/));
      placeStars(p);
    }
    const end = events(report).find((e) => e.type === 'end')!;
    expect(end).toMatchObject({ daily: true, challenge: { id: 'abc', round: 1 } });
    expect(stored().daily[day]).toEqual({ best: end.score, tries: 1, times: [0, 0, 0] });
    first.unmount();

    const again = vi.fn();
    render(<StarGrid host={{ report: again }} restartKey={0} challenge={spec({ id: 'other', mode: 'daily', day, seed: 5 })} />);
    expect(screen.getByText(/your daily result counts here/)).toBeTruthy();
    expect(events(again)).toEqual([{ type: 'end', score: end.score, stats: { time: 0 }, challenge: { id: 'other', round: 1 } }]);
  });

  it('leaves a daily finished in another tab, and a stale menu can’t start it twice (checklist c)', () => {
    render(<StarGrid host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s grids' }));
    const done = { ...stored(), daily: { [dayKey()]: { best: 1500, tries: 1, times: [20, 30, 40] } } };
    delete done.progress;
    localStorage.setItem(KEY, JSON.stringify(done));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });
    expect(screen.getByText('Today: 1500')).toBeTruthy();
    // Marks and mute write on top of what is stored, not over it.
    fireEvent.click(screen.getByRole('button', { name: 'Turn sound off' }));
    expect(stored().daily[dayKey()].best).toBe(1500);
  });

  it('leaves typing in fields, dialogs and the page around the game alone (checklist e)', () => {
    render(
      <>
        <input aria-label="name" />
        <StarGrid host={{ report: vi.fn() }} restartKey={0} challenge={spec()} />
      </>,
    );
    const field = screen.getByLabelText('name');
    press('ArrowRight', {}, field);
    press('p', {}, field);
    expect(cursorCell()).toBeUndefined();
    expect(screen.queryByText('Paused · tap to continue')).toBeNull();
    press('p', { ctrlKey: true });
    expect(screen.queryByText('Paused · tap to continue')).toBeNull();
    press('ArrowRight');
    press('s');
    press('s', { repeat: true });
    expect(stars()).toBe(1);
  });

  it('keeps a best per endless size and the daily best apart (design: per-mode bests)', () => {
    // An older save: one best from a daily, which no endless grid could ever beat.
    localStorage.setItem(KEY, JSON.stringify({ best: 2300, solved: 3, size: 6, daily: { '2026-10-20': { best: 2300, tries: 1, times: [20, 30, 40] } } }));
    const first = render(<StarGrid host={{ report: vi.fn() }} restartKey={0} />);
    expect(screen.getByText(/Best daily 2300/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '6×6' }));
    // The endless grid is random: solve it from the board's own solution.
    const p = endlessShown();
    wait(5200);
    placeStars(p);
    expect(screen.getByText(/Solved in 0:05 · New best!/)).toBeTruthy();
    expect(stored().fastest).toEqual({ 6: 5 });
    fireEvent.click(screen.getByRole('button', { name: 'Another grid' }));
    const q = endlessShown();
    wait(8000);
    placeStars(q);
    expect(screen.getByText(/Solved in 0:08 · best 6×6: 0:05/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Menu' })[1]!);
    expect(screen.getByRole('button', { name: '6×6, best 0:05' })).toBeTruthy();
    first.unmount();
  });

  it('loads a damaged challenge record without crashing (checklist i)', () => {
    localStorage.setItem(KEY, JSON.stringify({ challenges: { 'abc:1': { i: 9, marks: 'x' }, 'abc:2': null } }));
    render(<StarGrid host={{ report: vi.fn() }} restartKey={0} challenge={spec()} />);
    expect(stars()).toBe(0);
  });
});
