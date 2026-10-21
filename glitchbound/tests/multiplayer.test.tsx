import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GAMES } from '../src/catalog/games';
import { multiplayerGames } from '../src/catalog/multiplayer';
import { EMPTY_CATALOG } from '../src/catalog/settings';
import { MultiplayerRow } from '../src/components/MultiplayerRow';
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

  it('the home row lists them as big cards with the live label and player count, and hides when emptied', () => {
    const { unmount } = render(<MultiplayerRow />);
    expect(screen.getByRole('heading', { name: 'Live multiplayer games' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Launch Control' })).toBeTruthy();
    expect(screen.getAllByText('Live multiplayer').length).toBe(slugs().length);
    expect(screen.getAllByText('2 players').length).toBe(GAMES.filter((g) => g.live?.players === '2').length);
    unmount();
    setCatalog({ ...EMPTY_CATALOG, multiplayer: [] });
    const { container } = render(<MultiplayerRow />);
    expect(container.innerHTML).toBe('');
  });
});
