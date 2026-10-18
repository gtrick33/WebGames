import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { SAVE_KEY } from '../src/platform/save';
import { saveStore } from '../src/platform/store';
import { TodaysDailies } from '../src/components/TodaysDailies';
import { fakeGame } from './fixtures';

function renderAt(path: string) {
  saveStore.reload(); // the store is a singleton; pick up whatever this test put in localStorage
  window.history.replaceState(null, '', path);
  return render(<App />);
}

describe('homepage', () => {
  it('renders the hero, the daily challenge and the arcade', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: /Small games\.\s*Big obsessions\./ })).toBeTruthy();
    expect(screen.getByText(/Today’s challenge · (NEON RUSH|Memory Grid|Color Recall|Letter Pinch)/)).toBeTruthy();
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
    renderAt('/?category=trivia#arcade');
    // "trivia" has no games yet: invalid filters fall back to an empty, explained state rather than a crash.
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

  it('navigates client-side through links', async () => {
    renderAt('/');
    fireEvent.click(screen.getAllByRole('link', { name: 'Daily Challenge' })[0]!);
    expect(window.location.pathname).toBe('/daily');
    expect(await screen.findByRole('heading', { level: 1, name: 'Daily Challenge' })).toBeTruthy();
  });
});

describe('game page', () => {
  it('loads the game only after Play, and records rounds reported by the game', () => {
    renderAt('/games/neon-rush?beat=100');
    expect(document.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Play NEON RUSH/ }));
    const iframe = document.querySelector('iframe')!;
    expect(iframe.getAttribute('src')).toBe('/play/neon-rush/');

    const end = { source: 'glitchbound-game', version: 1, type: 'end', score: 321, stats: { meters: 250, coins: 7, nearMisses: 1 } };
    // Wrong origin: ignored.
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: end, origin: 'https://evil.example', source: iframe.contentWindow }));
    });
    expect(screen.queryByText('Last round')).toBeNull();
    // Right origin but not from our iframe: ignored.
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: end, origin: window.location.origin, source: window }));
    });
    expect(screen.queryByText('Last round')).toBeNull();
    // The real game frame: recorded.
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: end, origin: window.location.origin, source: iframe.contentWindow }));
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
  it('deletes local data after confirmation', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, games: { 'neon-rush': { plays: 2, best: { score: 5 }, last: 1 } }, daily: {} }));
    renderAt('/privacy');
    expect(await screen.findByText(/2 rounds recorded/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete my GlitchBound data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete everything' }));
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    expect(screen.getByText(/0 rounds recorded/)).toBeTruthy();
  });
});

describe('members features as a guest (API unreachable in tests)', () => {
  it('keeps favorites on the device and filters the arcade by them', () => {
    renderAt('/');
    const arcade = screen.getByRole('region', { name: 'The arcade' });
    fireEvent.click(within(arcade).getByRole('button', { name: 'Add NEON RUSH to favorites' }));
    expect(within(arcade).getByRole('button', { name: 'Remove NEON RUSH from favorites' }).getAttribute('aria-pressed')).toBe('true');
    expect(JSON.parse(localStorage.getItem('glitchbound.favorites')!)).toEqual(['neon-rush']);
    fireEvent.click(within(arcade).getByRole('button', { name: /Favorites/ }));
    expect(window.location.search).toBe('?fav=1');
    expect(within(arcade).getByRole('link', { name: 'NEON RUSH' })).toBeTruthy();
    fireEvent.click(within(arcade).getByRole('button', { name: 'Remove NEON RUSH from favorites' }));
    expect(screen.getByText('No favorites yet.')).toBeTruthy();
  });

  it('invites guests to unlock quests and opens the sign-in dialog', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: /Unlock quests/ }));
    const dialog = document.querySelector('dialog.signin-dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(within(dialog).getByRole('heading', { name: 'Join the arcade' })).toBeTruthy();
    expect(within(dialog).getByText('Sign in to unlock daily quests.')).toBeTruthy();
  });

  it('shows a friendly offline state on the leaderboards page', async () => {
    renderAt('/leaderboards');
    expect(await screen.findByRole('heading', { level: 1, name: 'Leaderboards' })).toBeTruthy();
    expect(await screen.findByText(/offline right now/)).toBeTruthy();
  });

  it('asks guests to sign in on the profile and admin pages', async () => {
    renderAt('/me');
    expect(await screen.findByRole('heading', { level: 1, name: 'Your profile' })).toBeTruthy();
    renderAt('/admin');
    expect((await screen.findAllByRole('heading', { level: 1, name: 'Admin' })).length).toBeGreaterThan(0);
  });
});

describe('today’s dailies', () => {
  it('lists games with their own daily and hides when there are none', () => {
    const own = fakeGame({ slug: 'grid-game', title: 'Grid Game', released: '2026-01-01', ownDaily: { label: 'Today’s grid' } });
    const { unmount } = render(<TodaysDailies games={[own]} />);
    expect(screen.getByRole('heading', { name: 'Today’s dailies' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Grid Game.*Today’s grid.*Play/ }).getAttribute('href')).toBe('/games/grid-game');
    expect(screen.getByText(/0 of 1 done/)).toBeTruthy();
    unmount();
    const { container } = render(<TodaysDailies games={[fakeGame({ ownDaily: undefined })]} />);
    expect(container.innerHTML).toBe('');
  });
});
