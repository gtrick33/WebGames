import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Game from '../src/games/memory-grid/Game';
import { dailySeed, levelFor, patternFor } from '../src/games/memory-grid/pattern';
import { dayKey } from '../src/platform/dates';

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

  it('remembers the mute toggle', () => {
    const { unmount } = render(<Game host={{ report: vi.fn() }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mute sound' }));
    expect(screen.getByRole('button', { name: 'Unmute sound' })).toBeTruthy();
    unmount();
    render(<Game host={{ report: vi.fn() }} restartKey={1} />);
    expect(screen.getByRole('button', { name: 'Unmute sound' })).toBeTruthy();
  });
});
