import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GAMES } from '../src/catalog/games';
import { multiplayerGames } from '../src/catalog/multiplayer';
import { EMPTY_CATALOG } from '../src/catalog/settings';
import { PlayTogether } from '../src/components/HomeBands';
import { setCatalog } from '../src/platform/liveCatalog';

const slugs = (chosen?: string[] | null): string[] => multiplayerGames(GAMES, chosen).map((g) => g.slug);

describe('live multiplayer games', () => {
  afterEach(() => setCatalog(EMPTY_CATALOG));

  it('shows every game with a live room until admins choose, then their list in its order', () => {
    expect(slugs()).toEqual(GAMES.filter((g) => g.live).map((g) => g.slug));
    expect(slugs()).toContain('launch-control');
    expect(slugs(['backgammon', 'nope', 'gloop'])).toEqual(['backgammon', 'gloop']);
    expect(slugs([])).toEqual([]);
  });

  it('Play together lists them (the best games, big cards above, left out) beside Party Mode', () => {
    const { unmount } = render(<PlayTogether />);
    expect(screen.getByRole('heading', { name: 'Better with friends' })).toBeTruthy();
    // Launch Control is one of the best games: its own card above already carries the live label
    expect(screen.queryByRole('link', { name: 'Launch Control' })).toBeNull();
    const online = slugs().filter((s) => s !== 'launch-control');
    expect(screen.getByRole('link', { name: 'Belot' }).getAttribute('href')).toBe('/games/belot?play=1');
    expect(screen.getAllByText('Live multiplayer').length).toBe(online.length);
    expect(screen.getByRole('link', { name: /Got friends over\? Pass the phone\./ }).getAttribute('href')).toBe('/party');
    unmount();
    // Emptied by the admins: Party Mode stays, the live list goes
    setCatalog({ ...EMPTY_CATALOG, multiplayer: [] });
    render(<PlayTogether />);
    expect(screen.queryByRole('heading', { name: 'Live online' })).toBeNull();
    expect(screen.getByRole('link', { name: /Got friends over\? Pass the phone\./ })).toBeTruthy();
  });
});
