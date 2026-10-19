import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Game from '../src/games/crosswire/Game';
import { allLetters, dailyPuzzle, key } from '../src/games/crosswire/logic';
import { dayKey } from '../src/platform/dates';

describe('Crosswire: the daily grid', () => {
  // A day whose grid has a mystery word (PLANE); only Date is faked unless a test fakes timers too.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 19, 12));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a grid filled in before a reload goes straight on to the mystery word', () => {
    const today = dayKey();
    const p = dailyPuzzle(today);
    const entries = Object.fromEntries(allLetters(p).map(([r, c, ch]) => [key(r, c), ch]));
    const tally = { seconds: 95, checks: 0, letterHints: 0, wordHints: 0, mystery: false };
    localStorage.setItem('glitchbound.crosswire', JSON.stringify({ daily: { [today]: { entries, tally, done: false, score: 0 } }, solved: 0, best: 0, muted: false }));
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: /Now the mystery word/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip the bonus' }));
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ type: 'end', daily: true, stats: { seconds: 95, clean: 1 } }));
    expect(screen.getByRole('heading', { name: 'Grid solved!' })).toBeTruthy();
  });

  it('a wrong mystery guess, then the right one: the Share button says Share', () => {
    const today = dayKey();
    const p = dailyPuzzle(today);
    const entries = Object.fromEntries(allLetters(p).map(([r, c, ch]) => [key(r, c), ch]));
    const tally = { seconds: 30, checks: 0, letterHints: 0, wordHints: 0, mystery: false };
    localStorage.setItem('glitchbound.crosswire', JSON.stringify({ daily: { [today]: { entries, tally, done: false, score: 0 } }, solved: 0, best: 0, muted: false }));
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const input = screen.getByRole('textbox', { name: 'Mystery word' });
    fireEvent.change(input, { target: { value: 'QQQQQ' } });
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByText(/Not quite/)).toBeTruthy();
    fireEvent.change(input, { target: { value: p.mystery!.word } });
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByRole('heading', { name: 'Grid and mystery word solved!' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
    expect(screen.queryByText(/Not quite/)).toBeNull();
  });

  it('keeps the clock running into the save, so a reload never winds it back', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 19, 12) });
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s grid' }));
    await vi.advanceTimersByTimeAsync(5500);
    const saved = JSON.parse(localStorage.getItem('glitchbound.crosswire')!) as { daily: Record<string, { tally: { seconds: number } }> };
    expect(saved.daily[dayKey()]!.tally.seconds).toBeGreaterThanOrEqual(4);
  });
});
