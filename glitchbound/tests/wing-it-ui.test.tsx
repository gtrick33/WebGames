import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Game from '../src/games/wing-it/Game';

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

    // Leaving mid-flight counts: the menu now shows today's result instead of the button.
    render(<Game host={{ report }} restartKey={1} />);
    expect(screen.queryByRole('button', { name: 'Fly today’s course' })).toBeNull();
    expect(screen.getByText(/Next daily in/)).toBeTruthy();
  });
});
