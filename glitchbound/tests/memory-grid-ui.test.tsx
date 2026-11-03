import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Game from '../src/games/memory-grid/Game';
import { dailySeed, levelFor, patternFor } from '../src/games/memory-grid/pattern';
import { addDays, dayKey } from '../src/platform/dates';
import { loadRecords } from '../src/games/memory-grid/records';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const tiles = () => screen.getAllByRole('button', { name: /^Row \d, column \d$/ });

describe('Memory Grid UI', () => {
  it('plays a Daily round: ignores taps during playback, reports start and end', () => {
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    expect(report).toHaveBeenCalledWith({ type: 'start' });
    expect(screen.getByText('Watch closely…')).toBeTruthy();

    const seq = patternFor(dailySeed(dayKey()), 1, levelFor('daily', 1));
    // Tapping during playback does nothing (no mistake, no progress).
    fireEvent.pointerDown(tiles()[(seq[0]! + 1) % 9]!);
    expect(screen.getByText('Watch closely…')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Your turn')).toBeTruthy();
    for (const t of seq) fireEvent.pointerDown(tiles()[t]!);
    expect(screen.getByText('Nice!')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(800); // feedback beat, then round 2 playback starts
    });
    expect(screen.getByText('Watch closely…')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    const seq2 = patternFor(dailySeed(dayKey()), 2, levelFor('daily', 2));
    fireEvent.pointerDown(tiles()[(seq2[0]! + 1) % 9]!);
    expect(report).toHaveBeenLastCalledWith({ type: 'end', score: 30, stats: { longest: 3, patterns: 1, accuracy: 75 }, daily: true });

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole('heading', { name: 'New best!' })).toBeTruthy();
    expect(screen.getByText('🔥 1-day streak')).toBeTruthy();
    // The daily is one try a day: the result offers Classic instead of a replay…
    fireEvent.click(screen.getByRole('button', { name: /Play Classic/ }));
    expect(report).toHaveBeenCalledTimes(3);
    expect(report).toHaveBeenLastCalledWith({ type: 'start' });
    // …and the Daily Challenge card in the menu stays locked until tomorrow.
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    expect((screen.getByRole('button', { name: /Daily Challenge/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('R on the daily result plays Classic, also when the page around the game has focus', () => {
    const report = vi.fn();
    const page = document.createElement('main');
    page.tabIndex = -1;
    document.body.appendChild(page);
    render(<Game host={{ report }} restartKey={0} />, { container: page.appendChild(document.createElement('div')) });
    fireEvent.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    const seq = patternFor(dailySeed(dayKey()), 1, levelFor('daily', 1));
    fireEvent.pointerDown(tiles()[(seq[0]! + 1) % 9]!);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // Clicking the game's background focuses the page's <main>; keys still reach the game.
    page.focus();
    fireEvent.keyDown(page, { key: 'r' });
    expect(report).toHaveBeenLastCalledWith({ type: 'start' });
    expect(screen.getByText('Classic')).toBeTruthy();
    page.remove();
  });

  it('a Daily Challenge left halfway resumes at the pattern it reached; the try is used once', () => {
    const report = vi.fn();
    const { unmount } = render(<Game host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    for (const t of patternFor(dailySeed(dayKey()), 1, levelFor('daily', 1))) fireEvent.pointerDown(tiles()[t]!);
    // Leave during the next playback, then come back after a reload.
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    unmount();
    render(<Game host={{ report }} restartKey={1} />);
    const card = screen.getByRole('button', { name: /Daily Challenge/ });
    expect(card.textContent).toContain('resume at round 2 · 30 pts');
    fireEvent.click(card);
    expect(screen.getByText('Round').nextSibling?.textContent).toBe('2');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    const seq2 = patternFor(dailySeed(dayKey()), 2, levelFor('daily', 2));
    fireEvent.pointerDown(tiles()[(seq2[0]! + 1) % 9]!);
    expect(report).toHaveBeenLastCalledWith({ type: 'end', score: 30, stats: { longest: 3, patterns: 1, accuracy: 75 }, daily: true });
    expect(report.mock.calls.filter(([e]) => (e as { type: string }).type === 'end')).toHaveLength(1);
  });

  it('settles a Daily Challenge left before runs were saved: one end, the day still counts', () => {
    localStorage.setItem('glitchbound.memory-grid.v1', JSON.stringify({ dailyStarted: dayKey() }));
    const report = vi.fn();
    const { unmount } = render(<Game host={{ report }} restartKey={0} />);
    expect(report).toHaveBeenCalledWith({ type: 'end', score: 0, stats: { longest: 0, patterns: 0 }, daily: true });
    expect((screen.getByRole('button', { name: /Daily Challenge/ }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    render(<Game host={{ report }} restartKey={1} />);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('remembers the mute toggle', () => {
    const { unmount } = render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mute sound' }));
    expect(screen.getByRole('button', { name: 'Unmute sound' })).toBeTruthy();
    unmount();
    render(<Game host={{ report: vi.fn() }} restartKey={1} />);
    expect(screen.getByRole('button', { name: 'Unmute sound' })).toBeTruthy();
  });

  it('pauses on pauseKey and in a hidden tab: the playback stops and plays again on Continue', () => {
    const report = vi.fn();
    const { rerender } = render(<Game host={{ report }} restartKey={0} pauseKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Classic/ }));
    act(() => {
      vi.advanceTimersByTime(700);
    });
    rerender(<Game host={{ report }} restartKey={0} pauseKey={1} />);
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('Watch closely…')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Your turn')).toBeTruthy();
    // A hidden tab pauses too, also on the player's turn (the clock stops).
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeTruthy();
  });

  it('leaving a Daily Challenge after its pattern was shown ends it as a slip, also by a reload', () => {
    const report = vi.fn();
    const { unmount } = render(<Game host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    for (const t of patternFor(dailySeed(dayKey()), 1, levelFor('daily', 1))) fireEvent.pointerDown(tiles()[t]!);
    act(() => {
      vi.advanceTimersByTime(800); // the beat
    });
    act(() => {
      vi.advanceTimersByTime(700); // pattern 2 starts to play
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    expect(screen.getByRole('dialog', { name: 'Leave this run?' }).textContent).toContain('The daily ends here with 30 pts');
    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('Your turn')).toBeTruthy();
    // A reload on the player's turn: the next visit settles the run instead of showing pattern 2 again.
    unmount();
    render(<Game host={{ report }} restartKey={1} />);
    expect(report).toHaveBeenLastCalledWith({ type: 'end', score: 30, stats: { longest: 3, patterns: 1, accuracy: 100 }, daily: true });
    const card = screen.getByRole('button', { name: /Daily Challenge/ }) as HTMLButtonElement;
    expect(card.disabled).toBe(true);
    expect(card.textContent).toContain('Today: 30 pts');
  });

  it('settles a daily left unfinished yesterday under its own day, so the streak counts it', () => {
    const y = addDays(dayKey(), -1);
    const dailyRun = { day: y, round: 3, cleared: 2, longest: 4, score: 70, taps: 7, correctTaps: 7, inputMs: 4000 };
    localStorage.setItem('glitchbound.memory-grid.v1', JSON.stringify({ dailyStarted: y, dailyRun, streak: { last: addDays(y, -1), count: 2, best: 2 } }));
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} />);
    expect(report).not.toHaveBeenCalled(); // the arcade's daily is per real day
    const r = loadRecords();
    expect(r.dailyRun).toBeUndefined();
    expect(r.daily).toMatchObject({ day: y, score: 70 });
    expect(r.streak).toEqual({ last: y, count: 3, best: 3 });
    expect(screen.getByText(/Streak 3/)).toBeTruthy();
  });

  it('unlocks the next daily at midnight without a reload', () => {
    vi.setSystemTime(new Date(2026, 9, 30, 23, 59, 50));
    localStorage.setItem('glitchbound.memory-grid.v1', JSON.stringify({ daily: { day: '2026-10-30', cleared: 2, score: 70, accuracy: 90 }, dailyStarted: '2026-10-30' }));
    render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    expect((screen.getByRole('button', { name: /Daily Challenge/ }) as HTMLButtonElement).disabled).toBe(true);
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect((screen.getByRole('button', { name: /Daily Challenge/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('a challenge round is one attempt: no Back, and a reload after a pattern was shown ends it once', () => {
    const challenge = { id: 'ch1', round: 1, seed: 1234, mode: 'fresh' as const, day: dayKey() };
    const report = vi.fn();
    const { unmount } = render(<Game host={{ report }} restartKey={0} challenge={challenge} />);
    expect(report).toHaveBeenCalledWith({ type: 'start' });
    expect(screen.queryByRole('button', { name: 'Back to menu' })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(700);
    });
    unmount();
    render(<Game host={{ report }} restartKey={1} challenge={challenge} />);
    expect(screen.getByText('This round was already started.')).toBeTruthy();
    expect(report).toHaveBeenLastCalledWith({ type: 'end', score: 0, stats: { longest: 0, patterns: 0 }, challenge: { id: 'ch1', round: 1 } });
    cleanupAndRemount();
    function cleanupAndRemount(): void {
      render(<Game host={{ report }} restartKey={2} challenge={challenge} />);
      expect(screen.getAllByText('You already played this round.').length).toBe(1);
      expect(report.mock.calls.filter(([e]) => (e as { type: string }).type === 'end')).toHaveLength(1);
    }
  });

  it('a "Today\'s daily" challenge plays the real daily, and a played daily counts as its score', () => {
    const challenge = { id: 'ch2', round: 1, seed: 99, mode: 'daily' as const, day: dayKey() };
    localStorage.setItem('glitchbound.memory-grid.v1', JSON.stringify({ daily: { day: dayKey(), cleared: 4, score: 180, accuracy: 100, longest: 6 }, dailyStarted: dayKey() }));
    const report = vi.fn();
    render(<Game host={{ report }} restartKey={0} challenge={challenge} />);
    expect(screen.getByText('Your daily result counts here.')).toBeTruthy();
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenLastCalledWith({ type: 'end', score: 180, stats: { longest: 6, patterns: 4, accuracy: 100 }, challenge: { id: 'ch2', round: 1 } });
  });

  it('plays a 4x4 grid with the keyboard rows 1234 / QWER / ASDF / ZXCV and shows the keys', () => {
    const report = vi.fn();
    const day = dayKey();
    // A daily resumed at round 5, the first 4x4 pattern.
    localStorage.setItem('glitchbound.memory-grid.v1', JSON.stringify({ dailyStarted: day, dailyRun: { day, round: 5, cleared: 4, longest: 6, score: 180, taps: 18, correctTaps: 18, inputMs: 9000 } }));
    render(<Game host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Daily Challenge/ }));
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByText('Your turn')).toBeTruthy();
    const seq = patternFor(dailySeed(day), 5, levelFor('daily', 5));
    const rows = ['1234', 'qwer', 'asdf', 'zxcv'];
    for (const t of seq) fireEvent.keyDown(document.body, { key: rows[Math.floor(t / 4)]![t % 4]! });
    expect(screen.getByText('Nice!')).toBeTruthy();
    expect(screen.getByText(/1234 \/ QWER \/ ASDF \/ ZXCV/)).toBeTruthy();
  });
});
