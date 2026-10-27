import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GAMES } from '../src/catalog/games';
import { HowTo, howToSeen, howToSteps, markHowToSeen } from '../src/components/HowTo';
import { fakeGame } from './fixtures';

const bySlug = (slug: string) => GAMES.find((g) => g.slug === slug)!;

describe('How to play: the steps, from the registry (#27)', () => {
  it('what the game is, the controls for this device, then what is good to know', () => {
    const g = bySlug('memory-grid');
    const keys = howToSteps(g, false);
    expect(keys.map((s) => s.title)).toEqual(['Memory Grid', 'Keyboard', 'Keyboard', 'Good to know']);
    expect(keys[0]).toMatchObject({ emoji: g.emoji ?? '🎮', lines: [g.tagline] });
    // five keyboard lines: two steps, never more than three lines each
    expect(keys.slice(1, 3).flatMap((s) => s.lines)).toEqual(g.controls.keyboard);
    expect(keys.every((s) => s.lines.length <= 3)).toBe(true);
    expect(keys[3]!.lines).toEqual(g.highlights!.slice(0, 3));
    // a touch screen gets the touch controls
    expect(howToSteps(g, true).map((s) => s.title)).toEqual(['Memory Grid', 'Touch', 'Good to know']);
    expect(howToSteps(g, true)[1]!.lines).toEqual(g.controls.touch);
  });

  it('works for every game: two to four short steps', () => {
    for (const g of GAMES)
      for (const touch of [false, true]) {
        const steps = howToSteps(g, touch);
        expect(steps.length, g.slug).toBeGreaterThanOrEqual(2);
        expect(steps.length, g.slug).toBeLessThanOrEqual(4);
        expect(steps.every((s) => s.lines.length >= 1 && s.lines.length <= 3 && s.emoji)).toBe(true);
      }
  });

  it('a game with only one set of controls shows that one; with neither, the gist of its description', () => {
    const touchOnly = fakeGame({ controls: { touch: ['Tap to jump'] }, highlights: undefined });
    expect(howToSteps(touchOnly, false).map((s) => s.title)).toEqual([touchOnly.title, 'Touch']);
    const bare = fakeGame({ controls: {}, highlights: undefined, description: 'Stack the blocks. Then stack more.' });
    expect(howToSteps(bare, true).map((s) => s.lines)).toEqual([[bare.tagline], ['Stack the blocks.']]);
  });

  it('remembers the games whose wizard this device has seen', () => {
    expect(howToSeen('gloop')).toBe(false);
    markHowToSeen('gloop');
    markHowToSeen('gloop');
    markHowToSeen('fussbox');
    expect(howToSeen('gloop')).toBe(true);
    expect(JSON.parse(localStorage.getItem('glitchbound.howto')!)).toEqual(['gloop', 'fussbox']);
    localStorage.setItem('glitchbound.howto', '{broken');
    expect(howToSeen('gloop')).toBe(false);
    markHowToSeen('gloop');
    expect(howToSeen('gloop')).toBe(true);
  });
});

describe('How to play: the wizard', () => {
  it('Next, Back and Let’s play by click; arrow keys and swipes step; the game hears no keys', () => {
    const g = bySlug('memory-grid');
    const onClose = vi.fn();
    const onPlay = vi.fn();
    const gameKeys = vi.fn();
    window.addEventListener('keydown', gameKeys);
    render(<HowTo game={g} onClose={onClose} onPlay={onPlay} />);
    const title = (): string => screen.getByRole('heading').textContent!;
    expect(screen.getByRole('dialog', { name: 'Memory Grid' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Step 1 of 4' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(title()).toBe('Keyboard');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(title()).toBe('Memory Grid');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('img', { name: 'Step 3 of 4' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('img', { name: 'Step 2 of 4' })).toBeTruthy();
    expect(gameKeys).not.toHaveBeenCalled();
    // a swipe to the left goes on
    const dialog = screen.getByRole('dialog');
    fireEvent.pointerDown(dialog, { clientX: 300 });
    fireEvent.pointerUp(dialog, { clientX: 200 });
    expect(screen.getByRole('img', { name: 'Step 3 of 4' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    // the last step: no Skip, Let's play
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Let’s play!' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPlay).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', gameKeys);
  });

  it('Skip and Escape close it', () => {
    const onClose = vi.fn();
    render(<HowTo game={bySlug('gloop')} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
