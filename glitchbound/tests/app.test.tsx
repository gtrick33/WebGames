import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { SAVE_KEY } from '../src/platform/save';
import { saveStore } from '../src/platform/store';
import { TodaysDailies } from '../src/components/TodaysDailies';
import { fakeGame } from './fixtures';
import { loadGamePage } from '../src/pages/loadGamePage';

// The game page's code is a chunk of its own; like main.tsx on a game page, render once it is here.
beforeAll(async () => {
  await loadGamePage();
});

function renderAt(path: string) {
  saveStore.reload(); // the store is a singleton; pick up whatever this test put in localStorage
  window.history.replaceState(null, '', path);
  return render(<App />);
}

describe('homepage', () => {
  it('renders the hero, today’s pick, today’s dailies and the arcade', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: /Small games\.\s*Big obsessions\./ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Today’s pick/ }).getAttribute('href')).toMatch(/^\/games\//);
    expect(screen.getAllByRole('button', { name: /Surprise me/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 2, name: 'Today’s dailies' })).toBeTruthy();
    const arcade = screen.getByRole('region', { name: 'The arcade' });
    expect(within(arcade).getByRole('link', { name: 'Neon Rush' }).getAttribute('href')).toBe('/games/neon-rush');
  });

  it('picks games by mood, keeping the mood in the URL', () => {
    renderAt('/');
    const arcade = screen.getByRole('region', { name: 'The arcade' });
    fireEvent.click(within(arcade).getByRole('button', { name: /Quick rounds/ }));
    expect(window.location.search).toBe('?mood=quick');
    expect(within(arcade).getByRole('link', { name: 'Neon Rush' })).toBeTruthy();
    expect(within(arcade).queryByRole('link', { name: 'Letter Pinch' })).toBeNull();
    fireEvent.click(within(arcade).getByRole('button', { name: /Everything/ }));
    expect(within(arcade).getByRole('link', { name: 'Letter Pinch' })).toBeTruthy();
    // Crass Act lives in Party Mode, not the arcade.
    expect(within(arcade).queryByRole('link', { name: 'Crass Act' })).toBeNull();
  });

  it('filters by category and keeps the filter in the URL', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: /Search & sort/ }));
    const group = screen.getByRole('group', { name: 'Filter by category' });
    fireEvent.click(within(group).getByRole('button', { name: /Racing/ }));
    expect(window.location.search).toBe('?category=racing');
    expect(within(group).getByRole('button', { name: /Racing/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('shows an empty state for searches with no results, and recovers', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: /Search & sort/ }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the arcade' }), { target: { value: 'zzzz' } });
    expect(screen.getByText('Nothing here. Yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show all games' }));
    expect(screen.queryByText('Nothing here. Yet.')).toBeNull();
  });

  it('opens a category from a deep link', () => {
    renderAt('/?category=experimental#arcade');
    // "experimental" has no games yet: empty filters fall back to an empty, explained state rather than a crash.
    expect(screen.getByText('Nothing here. Yet.')).toBeTruthy();
  });
});

describe('routing', () => {
  it('labels Crass Act adults only on its page and in Party Mode', async () => {
    const page = renderAt('/games/crass-act');
    const heading = (await screen.findByRole('heading', { level: 1, name: 'Crass Act' }, { timeout: 5000 })).parentElement!;
    expect(heading.textContent).toContain('18+Adults only');
    page.unmount();
    renderAt('/party');
    const feature = (await screen.findByRole('heading', { level: 2, name: 'Crass Act' }, { timeout: 5000 })).closest('section')!;
    expect(feature.textContent).toContain('18+Adults only');
  });

  it('opens the About and Contact pages from the footer', async () => {
    renderAt('/');
    const footer = screen.getByRole('navigation', { name: 'Footer' });
    fireEvent.click(within(footer).getByRole('link', { name: 'About' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Small games. Big obsessions.' })).toBeTruthy();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Footer' })).getByRole('link', { name: 'Contact' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Get in touch' })).toBeTruthy();
    // The studio is reached through tickets only: no personal name or mailbox anywhere.
    const tickets = screen.getAllByRole('link', { name: 'Open a ticket' });
    expect(tickets.map((a) => a.getAttribute('href'))).toEqual(tickets.map(() => '/me/bugs?category=question'));
    expect(document.body.textContent).not.toMatch(/sava|hristov|@glitchboundstudio/i);
  });

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
    // The daily page loads lazily; under a busy parallel test run that can take over a second.
    expect(await screen.findByRole('heading', { level: 1, name: 'Daily Challenge' }, { timeout: 5000 })).toBeTruthy();
  });
});

describe('game page', () => {
  it('loads the game only after Play, and records rounds reported by the game', () => {
    renderAt('/games/neon-rush?beat=100');
    expect(document.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Play Neon Rush/ }));
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

  it('tucks the full-screen controls into a side tab, and Exit game unloads the game', () => {
    renderAt('/games/neon-rush');
    // jsdom has no Fullscreen API, so Play falls back to the immersive mode.
    fireEvent.click(screen.getByRole('button', { name: /Play Neon Rush/ }));
    expect(document.querySelector('iframe')).not.toBeNull();
    const tab = screen.getByRole('button', { name: 'Game menu' });
    expect(screen.queryByRole('button', { name: /Exit full screen/ })).toBeNull();
    fireEvent.click(tab);
    expect(tab.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /Exit full screen/ })).toBeTruthy();
    fireEvent.click(within(document.querySelector('.stage-menu')!).getByRole('button', { name: /Exit game/ }));
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('button', { name: /Play Neon Rush/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Game menu' })).toBeNull();
  });

  it('pauses the game when the player leaves full screen with Escape', () => {
    renderAt('/games/neon-rush');
    fireEvent.click(screen.getByRole('button', { name: /Play Neon Rush/ }));
    const frame = document.querySelector('iframe')!;
    const post = vi.spyOn(frame.contentWindow!, 'postMessage');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Game menu' })).toBeNull();
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ source: 'glitchbound-host', type: 'pause' }), window.location.origin);
  });

  it('shows how to play and the restart action once playing', () => {
    renderAt('/games/neon-rush');
    expect(screen.getByRole('heading', { name: 'How to play' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Restart/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Play Neon Rush/ }));
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
    fireEvent.click(within(arcade).getByRole('button', { name: 'Add Neon Rush to favorites' }));
    expect(within(arcade).getByRole('button', { name: 'Remove Neon Rush from favorites' }).getAttribute('aria-pressed')).toBe('true');
    expect(JSON.parse(localStorage.getItem('glitchbound.favorites')!)).toEqual(['neon-rush']);
    fireEvent.click(within(arcade).getByRole('button', { name: /Search & sort/ }));
    fireEvent.click(within(arcade).getByRole('button', { name: /Favorites/ }));
    expect(window.location.search).toBe('?fav=1');
    expect(within(arcade).getByRole('link', { name: 'Neon Rush' })).toBeTruthy();
    fireEvent.click(within(arcade).getByRole('button', { name: 'Remove Neon Rush from favorites' }));
    expect(screen.getByText('No favorites yet.')).toBeTruthy();
  });

  it('tells guests it is free with no sign-up, and opens the sign-in dialog when they want more', async () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 2, name: /100% free\.\s*No sign-up\.\s*No downloads\./ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Sign in free/ }));
    // The dialog loads on first use, then opens.
    const dialog = (await screen.findByRole('heading', { name: 'Join the arcade' }, { timeout: 3000 })).closest('dialog') as HTMLDialogElement;
    await waitFor(() => expect(dialog.open).toBe(true));
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
