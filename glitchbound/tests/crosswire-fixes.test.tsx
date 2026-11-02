import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Game from '../src/games/crosswire/Game';
import { makePuzzle, wordCells } from '../src/games/crosswire/grid';
import { allLetters, dailyPuzzle, key } from '../src/games/crosswire/logic';
import { dayKey } from '../src/platform/dates';

const STORE = 'glitchbound.crosswire';
const challenge = (over = {}) => ({ id: 'abc', round: 1, seed: 4242, mode: 'fresh' as const, day: '2026-10-19', ...over });
const saved = () => JSON.parse(localStorage.getItem(STORE)!) as { daily: Record<string, { done: boolean; tally: { seconds: number; wordHints: number } }>; rounds: Record<string, { done: boolean; score: number; tally: { wordHints: number } }> };
const cells = () => screen.getAllByRole('gridcell').filter((c) => c.className.startsWith('xw-cell'));

describe('Crosswire fixes', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('glitchbound.coach.crosswire', '1');
    vi.useFakeTimers({ now: new Date(2026, 9, 19, 12) });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('CW-03: the clock stops while the arcade pauses the game, and the grid is hidden', async () => {
    const { rerender } = render(<Game host={{ report: vi.fn() }} restartKey={0} pauseKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s grid' }));
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByText('0:03')).toBeTruthy();
    rerender(<Game host={{ report: vi.fn() }} restartKey={0} pauseKey={1} />);
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(screen.getByText('0:03')).toBeTruthy();
    expect(screen.queryByRole('grid')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByText('0:04')).toBeTruthy();
  });

  it('CW-04: a challenge round has no way back, and Restart resumes it with its hints', async () => {
    const report = vi.fn();
    const { unmount } = render(<Game host={{ report }} restartKey={0} challenge={challenge()} />);
    expect(screen.queryByRole('button', { name: 'Back to menu' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Reveal the word/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sure\? Reveal the word/ }));
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(saved().rounds['abc:1']!.tally.wordHints).toBe(1);
    unmount();
    render(<Game host={{ report }} restartKey={1} challenge={challenge()} />);
    // the revealed word is still filled in and still counted
    const p = makePuzzle(4242, 'medium', 1);
    const first = wordCells(p.words[0]!)[0]!;
    expect(cells().find((c) => c.getAttribute('aria-label')!.startsWith(`Row ${first[0] + 1}, column ${first[1] + 1}.`))!.textContent).toBe(p.words[0]!.word[0]);
    expect(report).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'end' }));
  });

  it('CW-04: a finished challenge round shows its result and is never replayed or reported again', () => {
    const p = makePuzzle(4242, 'medium', 1);
    const entries = Object.fromEntries(allLetters(p).map(([r, c, ch]) => [key(r, c), ch]));
    const tally = { seconds: 80, checks: 0, letterHints: 0, wordHints: 0, mystery: false };
    localStorage.setItem(STORE, JSON.stringify({ daily: {}, rounds: { 'abc:1': { entries, tally, done: true, score: 777 } }, solved: 1, best: 777 }));
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} challenge={challenge()} />);
    expect(screen.getByText('777')).toBeTruthy();
    expect(report).not.toHaveBeenCalled();
  });

  it("CW-05: Today's daily challenge plays the day's real daily, and a finished daily counts at once", () => {
    const today = dayKey();
    const p = dailyPuzzle(today);
    const entries = Object.fromEntries(allLetters(p).map(([r, c, ch]) => [key(r, c), ch]));
    const tally = { seconds: 90, checks: 0, letterHints: 0, wordHints: 0, mystery: false };
    localStorage.setItem(STORE, JSON.stringify({ daily: { [today]: { entries, tally, done: true, score: 990 } }, solved: 1, best: 990 }));
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} challenge={challenge({ mode: 'daily', day: today, seed: 1 })} />);
    expect(screen.getByText('Your daily result counts here.')).toBeTruthy();
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ type: 'end', score: 990, challenge: { id: 'abc', round: 1 } }));
    expect(saved().rounds['abc:1']!.done).toBe(true);
  });

  it('CW-07 / CW-08: a corrected letter loses its red mark, and a solved word cannot be charged a hint', () => {
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s grid' }));
    const p = dailyPuzzle(dayKey());
    const w = p.words[0]!;
    const clueSquare = () => screen.getAllByRole('gridcell').find((c) => c.className.startsWith('xw-clue') && c.getAttribute('aria-label')!.includes(`Clue ${w.n} `))!;
    const firstCell = () => cells().find((c) => c.getAttribute('aria-label')!.startsWith(`Row ${w.row + 1}, column ${w.col + 1}.`))!;
    fireEvent.keyDown(document.body, { key: w.word[0] === 'Q' ? 'Z' : 'Q' });
    for (const ch of w.word.slice(1)) fireEvent.keyDown(document.body, { key: ch });
    fireEvent.click(screen.getByRole('button', { name: /Check the grid/ }));
    expect(firstCell().className).toContain('is-wrong');
    fireEvent.click(clueSquare());
    fireEvent.keyDown(document.body, { key: w.word[0]! });
    expect(firstCell().className).not.toContain('is-wrong');
    // the cursor is still in word 1, which is right now
    expect((screen.getByRole('button', { name: /Reveal the word/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Reveal a letter/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/Almost!/)).toBeNull();
  });

  it('CW-09: a full grid with a wrong letter says Almost', () => {
    const today = dayKey();
    const p = dailyPuzzle(today);
    const letters = allLetters(p);
    const entries = Object.fromEntries(letters.map(([r, c, ch], i) => [key(r, c), i === 0 ? (ch === 'Q' ? 'Z' : 'Q') : ch]));
    const tally = { seconds: 5, checks: 0, letterHints: 0, wordHints: 0, mystery: false };
    localStorage.setItem(STORE, JSON.stringify({ daily: { [today]: { entries, tally, done: false, score: 0 } }, solved: 0, best: 0 }));
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/Almost! Every square is filled/)).toBeTruthy();
  });

  it('CW-10: Tab from outside the grid is not captured; arrow keys move the cursor', () => {
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s grid' }));
    const check = screen.getByRole('button', { name: /Check the grid/ });
    check.focus();
    expect(fireEvent.keyDown(check, { key: 'Tab' })).toBe(true); // not prevented
    expect(fireEvent.keyDown(check, { key: ' ' })).toBe(true); // a focused button keeps Space
    const cur = () => cells().find((c) => c.getAttribute('aria-selected') === 'true')!.getAttribute('aria-label')!.split('.')[0];
    const before = cur();
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(cur()).not.toBe(before);
  });

  it('CW-14: damaged saves never crash and are cleaned up', () => {
    const today = dayKey();
    for (const bad of [{ daily: { [today]: {} } }, { daily: { [today]: { entries: {}, tally: {} } }, solved: 'many', best: 'lots' }, { daily: { [today]: { entries: { '0,1': 'A' }, tally: { seconds: 5 }, done: true } } }, 'garbage', null]) {
      localStorage.setItem(STORE, typeof bad === 'string' ? bad : JSON.stringify(bad));
      const { unmount } = render(<Game host={{ report: vi.fn() }} restartKey={0} />);
      expect(screen.queryByText(/NaN|undefined|many/)).toBeNull();
      fireEvent.click(screen.getAllByRole('button', { name: /today’s grid|Continue/ })[0]!);
      expect(screen.queryByText(/NaN|undefined/)).toBeNull();
      unmount();
    }
  });
});
