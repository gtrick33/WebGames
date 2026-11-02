import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PauseCard } from '../src/components/PauseCard';

describe('shared Paused card', () => {
  it('Resume has the focus; Escape resumes without reaching the game; Tab stays on the card', () => {
    const onResume = vi.fn();
    const gameKeys = vi.fn();
    window.addEventListener('keydown', gameKeys);
    render(
      <PauseCard onResume={onResume} line="Your clock is stopped">
        <button className="pause-card-btn">Menu</button>
      </PauseCard>,
    );
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeTruthy();
    expect(screen.getByText('Your clock is stopped')).toBeTruthy();
    const resume = screen.getByRole('button', { name: 'Resume' });
    const menu = screen.getByRole('button', { name: 'Menu' });
    expect(document.activeElement).toBe(resume);
    menu.focus();
    fireEvent.keyDown(menu, { key: 'Tab' });
    expect(document.activeElement).toBe(resume);
    fireEvent.click(resume);
    fireEvent.keyDown(resume, { key: 'Escape' });
    expect(onResume).toHaveBeenCalledTimes(2);
    expect(gameKeys).not.toHaveBeenCalled();
    window.removeEventListener('keydown', gameKeys);
  });

  it('takes the game’s own texts', () => {
    render(<PauseCard onResume={vi.fn()} title="En pause" resume="Reprendre" />);
    expect(screen.getByRole('dialog', { name: 'En pause' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reprendre' })).toBeTruthy();
  });
});
