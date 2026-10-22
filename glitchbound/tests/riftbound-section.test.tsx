import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { gamePath, getGame, inArcade, SECTION_GAMES, sectionGame } from '../src/catalog/catalog';
import { GAMES } from '../src/catalog/games';
import { applySettings, EMPTY_CATALOG } from '../src/catalog/settings';
import { setCatalog } from '../src/platform/liveCatalog';
import { saveStore } from '../src/platform/store';
import { loadGamePage } from '../src/pages/loadGamePage';
import { matchRoute } from '../src/router/router';

beforeAll(async () => {
  await loadGamePage();
});

afterEach(() => setCatalog(EMPTY_CATALOG));

function renderAt(path: string) {
  saveStore.reload();
  window.history.replaceState(null, '', path);
  return render(<App />);
}

const hideRiftbound = () => setCatalog({ ...EMPTY_CATALOG, settings: { riftbound: { hidden: true } } });

describe('Riftbound, a section of its own', () => {
  it('has its own address and stays out of the arcade lists', () => {
    const g = getGame('riftbound')!;
    expect(g.section).toEqual({ path: '/riftbound', label: 'Riftbound' });
    expect(SECTION_GAMES).toContain(g);
    expect(sectionGame('/riftbound')).toBe(g);
    expect(gamePath(g)).toBe('/riftbound');
    expect(inArcade(g)).toBe(false);
    expect(GAMES.filter(inArcade)).not.toContain(g);
    expect(applySettings(GAMES, EMPTY_CATALOG).map((x) => x.slug)).not.toContain('riftbound');
    expect(matchRoute('/riftbound')).toEqual({ name: 'section', slug: 'riftbound' });
    expect(matchRoute('/games/riftbound')).toEqual({ name: 'section', slug: 'riftbound' });
  });

  it('gets a tab next to Arcade and Party, but no tile in the arcade', () => {
    renderAt('/');
    const tabs = screen.getAllByRole('link', { name: 'Riftbound' }).map((a) => a.getAttribute('href'));
    expect(tabs).toContain('/riftbound');
    const arcade = screen.getByRole('region', { name: 'The arcade' });
    expect(within(arcade).queryByRole('link', { name: 'Riftbound' })).toBeNull();
  });

  it('opens its page at /riftbound', async () => {
    renderAt('/riftbound');
    expect(await screen.findByRole('heading', { level: 1, name: 'Riftbound' })).toBeTruthy();
  });

  it('turned off by an admin: no tab, and its address is not found', () => {
    hideRiftbound();
    renderAt('/');
    expect(screen.queryByRole('link', { name: 'Riftbound' })).toBeNull();
    renderAt('/riftbound');
    expect(screen.getAllByRole('heading', { level: 1 }).some((h) => /doesn’t exist/.test(h.textContent ?? ''))).toBe(true);
  });
});
