import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GutCheck from '../src/games/gut-check/Game';
import ToScale from '../src/games/to-scale/Game';
import { answerIsMore, chain } from '../src/games/gut-check/logic';
import { dayKey, hashString } from '../src/platform/dates';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('a daily result is kept the moment the game is decided', () => {
  it('Gut Check: a miss ends the run at once, even if the player leaves during the reveal', () => {
    const report = vi.fn();
    render(<GutCheck host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s cards' }));
    const pairs = chain(hashString(`gut-check:${dayKey()}`), 3);
    // Two right calls, then a wrong one.
    for (const [i, right] of [true, true, false].entries()) {
      const more = answerIsMore(pairs[i]!) === right;
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${more ? '▲' : '▼'}`) }));
      if (right)
        act(() => {
          vi.advanceTimersByTime(1200);
        });
    }
    expect(report).toHaveBeenLastCalledWith({ type: 'end', score: 2, stats: {}, daily: true });
    // Leave before the end screen shows: the day's result is already saved.
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByText('Today: 2 in a row')).toBeTruthy();
    expect(report).toHaveBeenCalledTimes(2);
  });

  it('To Scale: the fifth shot is kept when it is locked in, not when the score screen opens', () => {
    const report = vi.fn();
    const { unmount } = render(<ToScale host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play today’s 5' }));
    for (let shot = 0; shot < 5; shot++) {
      fireEvent.keyDown(window, { key: 'Enter' }); // lock it in
      if (shot < 4) fireEvent.keyDown(window, { key: 'Enter' }); // next shot
    }
    expect(screen.getByRole('button', { name: 'See your score' })).toBeTruthy();
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'end', daily: true }));
    const saved = JSON.parse(localStorage.getItem('glitchbound.to-scale')!) as { daily: Record<string, { line: string }> };
    expect([...saved.daily[dayKey()]!.line]).toHaveLength(5);
    // Pressing on only shows the score; nothing is reported twice.
    fireEvent.click(screen.getByRole('button', { name: 'See your score' }));
    expect(report.mock.calls.filter(([e]) => (e as { type: string }).type === 'end')).toHaveLength(1);
    unmount();
    cleanup();
  });
});
