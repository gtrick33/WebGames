import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { SAVE_KEY } from '../src/platform/save';
import { saveStore } from '../src/platform/store';

function renderAt(path: string) {
  saveStore.reload(); // the store is a singleton; pick up whatever this test put in localStorage
  window.history.replaceState(null, '', path);
  return render(<App />);
}

describe('homepage', () => {
  it('renders the hero, the daily challenge and the arcade', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: /One more round\.\s*Then another\./ })).toBeTruthy();
    expect(screen.getByText(/Today’s challenge · NEON RUSH/)).toBeTruthy();
    const arcade = screen.getByRole('region', { name: 'The arcade' });
    expect(within(arcade).getByRole('link', { name: 'NEON RUSH' }).getAttribute('href')).toBe('/games/neon-rush');
  });

  it('filters by category and keeps the filter in the URL', () => {
    renderAt('/');
    const group = screen.getByRole('group', { name: 'Filter by category' });
    fireEvent.click(within(group).getByRole('button', { name: /Racing/ }));
    expect(window.location.search).toBe('?category=racing');
    expect(within(group).getByRole('button', { name: /Racing/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('shows an empty state for searches with no results, and recovers', () => {
    renderAt('/');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the arcade' }), { target: { value: 'zzzz' } });
    expect(screen.getByText('Nothing here. Yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show all games' }));
    expect(screen.queryByText('Nothing here. Yet.')).toBeNull();
  });

  it('opens a category from a deep link', () => {
    renderAt('/?category=word#arcade');
    // "word" has no games yet: invalid filters fall back to an empty, explained state rather than a crash.
    expect(screen.getByText('Nothing here. Yet.')).toBeTruthy();
  });
});

describe('routing', () => {
  it('shows the 404 page for unknown paths and unknown games', () => {
    renderAt('/nowhere');
    expect(screen.getByRole('heading', { level: 1, name: /This level doesn.t exist/ })).toBeTruthy();
    renderAt('/games/not-a-game');
    expect(screen.getAllByRole('heading', { level: 1, name: /This level doesn.t exist/ }).length).toBeGreaterThan(0);
  });

  it('navigates client-side through links', () => {
    renderAt('/');
    fireEvent.click(screen.getAllByRole('link', { name: 'Daily Challenge' })[0]!);
    expect(window.location.pathname).toBe('/daily');
    expect(screen.getByRole('heading', { level: 1, name: 'Daily Challenge' })).toBeTruthy();
  });
});

describe('game page', () => {
  it('loads the game only after Play, and records rounds reported by the game', () => {
    renderAt('/games/neon-rush?beat=100');
    expect(document.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Play NEON RUSH/ }));
    const iframe = document.querySelector('iframe')!;
    expect(iframe.getAttribute('src')).toBe('https://neonrushgame.com/');

    const end = { source: 'glitchbound-game', version: 1, type: 'end', score: 321, stats: { meters: 250, coins: 7, nearMisses: 1 } };
    // Wrong origin: ignored.
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: end, origin: 'https://evil.example', source: iframe.contentWindow }));
    });
    expect(screen.queryByText('Last round')).toBeNull();
    // Right origin but not from our iframe: ignored.
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: end, origin: 'https://neonrushgame.com', source: window }));
    });
    expect(screen.queryByText('Last round')).toBeNull();
    // The real game frame: recorded.
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: end, origin: 'https://neonrushgame.com', source: iframe.contentWindow }));
    });
    expect(screen.getByText('Last round')).toBeTruthy();
    expect(screen.getByText(/You beat/)).toBeTruthy();
    const save = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    expect(save.games['neon-rush']).toMatchObject({ plays: 1, best: { score: 321, meters: 250, coins: 7, nearMisses: 1 } });
  });

  it('shows how to play and the restart action once playing', () => {
    renderAt('/games/neon-rush');
    expect(screen.getByRole('heading', { name: 'How to play' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Restart/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Play NEON RUSH/ }));
    fireEvent.load(document.querySelector('iframe')!);
    fireEvent.click(screen.getByRole('button', { name: /Restart/ }));
    expect(document.querySelector('iframe')).not.toBeNull();
  });
});

describe('privacy page', () => {
  it('deletes local data after confirmation', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, games: { 'neon-rush': { plays: 2, best: { score: 5 }, last: 1 } }, daily: {} }));
    renderAt('/privacy');
    expect(screen.getByText(/2 rounds recorded/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete my GlitchBound data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete everything' }));
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    expect(screen.getByText(/0 rounds recorded/)).toBeTruthy();
  });
});
