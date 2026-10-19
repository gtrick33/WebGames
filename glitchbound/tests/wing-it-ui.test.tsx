import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Game from '../src/games/wing-it/Game';
import { dayKey } from '../src/platform/dates';

describe('Wing It: the daily course is one flight a day', () => {
  it('backing out before the first flap keeps the flight; the first flap uses it up', () => {
    const report = vi.fn();
    const { unmount } = render(<Game host={{ report }} restartKey={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fly today’s course' }));
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    // Still there: nothing was flown.
    fireEvent.click(screen.getByRole('button', { name: 'Fly today’s course' }));
    expect(report).not.toHaveBeenCalled();

    fireEvent.pointerDown(screen.getByLabelText(/Tap or press Space to flap/), { button: 0 });
    expect(report).toHaveBeenCalledWith({ type: 'start' });
    unmount();

    // Leaving mid-flight counts: the flight ends once (the day still counts for the streak) and the
    // menu says it was left unfinished instead of offering it again.
    expect(report).toHaveBeenLastCalledWith({ type: 'end', score: 0, stats: { pillars: 0, feathers: 0 }, daily: true });
    render(<Game host={{ report }} restartKey={1} />);
    expect(screen.queryByRole('button', { name: 'Fly today’s course' })).toBeNull();
    expect(screen.getByText(/Left unfinished/)).toBeTruthy();
    expect(screen.getByText(/Next daily in/)).toBeTruthy();
    expect(report).toHaveBeenCalledTimes(2);
  });

  it('a flight left by a reload (no goodbye) is settled once when the game opens again', () => {
    localStorage.setItem('glitchbound.wing-it', JSON.stringify({ daily: { [dayKey()]: { best: 0, tries: 1, pillars: 0, feathers: 0, open: true } } }));
    const report = vi.fn();
    const { unmount } = render(<Game host={{ report }} restartKey={0} />);
    expect(report).toHaveBeenCalledWith({ type: 'end', score: 0, stats: { pillars: 0, feathers: 0 }, daily: true });
    unmount();
    render(<Game host={{ report }} restartKey={1} />);
    expect(report).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Left unfinished/)).toBeTruthy();
  });
});
