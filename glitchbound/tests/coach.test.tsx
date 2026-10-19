import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StarGrid from '../src/games/star-grid/Game';

describe('first-time walkthrough', () => {
  it('opens on the first visit, walks through the steps, stays closed after, and comes back on ?', () => {
    localStorage.removeItem('glitchbound.coach.star-grid');
    const { unmount } = render(<StarGrid host={{ report: vi.fn() }} restartKey={0} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('One star in every row and column')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('And one in every colour')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Let’s play' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();

    render(<StarGrid host={{ report: vi.fn() }} restartKey={1} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
