import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Coach } from '../src/components/Coach';
import StarGrid from '../src/games/star-grid/Game';

describe('first-time walkthrough', () => {
  it('opens on the first visit, walks through the steps, stays closed after, and comes back on ?', () => {
    localStorage.removeItem('glitchbound.coach.star-grid');
    const { unmount } = render(<StarGrid host={{ report: vi.fn() }} restartKey={0} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('One star in every row and column')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('And one in every color')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Let’s play' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();

    render(<StarGrid host={{ report: vi.fn() }} restartKey={1} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('Escape closes it without reaching the game, and Tab stays inside (CW-18)', () => {
    const onClose = vi.fn();
    const gameKeys = vi.fn();
    window.addEventListener('keydown', gameKeys);
    const steps = [{ title: 'One', body: 'First', art: null }, { title: 'Two', body: 'Second', art: null }];
    render(<Coach steps={steps} onClose={onClose} />);
    const skip = screen.getByRole('button', { name: 'Skip' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(document.activeElement).toBe(next);
    fireEvent.keyDown(next, { key: 'Tab' });
    expect(document.activeElement).toBe(skip);
    fireEvent.keyDown(skip, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(next);
    fireEvent.keyDown(next, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(gameKeys).not.toHaveBeenCalled();
    window.removeEventListener('keydown', gameKeys);
  });
});

