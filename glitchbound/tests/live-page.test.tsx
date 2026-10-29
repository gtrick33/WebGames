import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { GAMES } from '../src/catalog/games';
import { LivePage, roomPath } from '../src/pages/LivePage';
import { matchRoute } from '../src/router/router';
import { pageSpecs, renderPage, sitemap } from '../scripts/seo';

const liveGames = GAMES.filter((g) => g.live && !g.partyOnly);

/** The room list and room lookups answer from here (no rooms worker in tests). */
function stubRooms(rooms: unknown[], info: Record<string, unknown> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      const code = /\/api\/rooms\/([A-Z]{5})$/.exec(u)?.[1];
      if (code) return info[code] ? new Response(JSON.stringify(info[code])) : new Response('{}', { status: 404 });
      if (u.startsWith('/api/rooms')) return new Response(JSON.stringify({ rooms }));
      return new Response('{}', { status: 404 });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('live rooms page', () => {
  it('has its own address', () => {
    expect(matchRoute('/live')).toEqual({ name: 'live' });
    expect(matchRoute('/live/')).toEqual({ name: 'live' });
  });

  it('sends a room to its game’s page, and Party Mode rooms to Party Mode', () => {
    expect(roomPath('backgammon', 'ABCDE')).toBe('/games/backgammon?room=ABCDE');
    expect(roomPath('impostor', 'ABCDE')).toBe('/party?room=ABCDE');
    expect(roomPath(undefined, 'ABCDE')).toBe('/games/crass-act?room=ABCDE');
  });

  it('shows every live game, the public rooms open now, and joins one', async () => {
    stubRooms([{ code: 'QKGED', game: 'backgammon', phase: 'lobby', players: 1, max: 2, host: 'Mia', full: false, matched: false }]);
    window.history.replaceState(null, '', '/live');
    render(<LivePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Live rooms' })).toBeTruthy();
    const games = screen.getByRole('region', { name: 'Games with live rooms' });
    for (const g of liveGames) expect(within(games).getAllByText(g.title).length).toBeGreaterThan(0);
    // only live games are there
    const notLive = GAMES.find((g) => !g.live && !g.partyOnly && !g.section)!;
    expect(within(games).queryByText(notLive.title)).toBeNull();
    const room = await screen.findByText('Mia’s room');
    fireEvent.click(within(room.closest('li')!).getByRole('button', { name: 'Join' }));
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe('/games/backgammon?room=QKGED'));
  });

  it('says so when no room is open, and checks a room code before going there', async () => {
    stubRooms([], { BETKA: { players: 2, host: 'Leo', full: false, phase: 'lobby', game: 'belot' } });
    window.history.replaceState(null, '', '/live');
    render(<LivePage />);
    expect(await screen.findByText(/No public rooms right now. Open one in any game above/)).toBeTruthy();
    const box = screen.getByPlaceholderText('Room code');
    fireEvent.change(box, { target: { value: 'ab1' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Join' }).at(-1)!);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Room codes are five letters.');
    fireEvent.change(box, { target: { value: 'zzzzz' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Join' }).at(-1)!);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('No room has that code. It may have closed.'));
    fireEvent.change(box, { target: { value: 'betka' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Join' }).at(-1)!);
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe('/games/belot?room=BETKA'));
  });

  it('is a quiet link from the arcade and from Better with friends, and the Arcade tab stays lit there', async () => {
    stubRooms([]);
    window.history.replaceState(null, '', '/');
    render(<App />);
    const moods = screen.getByRole('group', { name: 'What do you feel like?' });
    expect(within(moods).getByRole('link', { name: /Live rooms/ }).getAttribute('href')).toBe('/live');
    const together = await screen.findByRole('region', { name: 'Better with friends' });
    expect(within(together).getByRole('link', { name: /All live games and open rooms/ }).getAttribute('href')).toBe('/live');
    fireEvent.click(within(moods).getByRole('link', { name: /Live rooms/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Live rooms' }, { timeout: 5000 })).toBeTruthy();
    expect(screen.getAllByRole('link', { current: 'page' }).map((a) => a.getAttribute('href'))).toContain('/');
  });

  it('is a prerendered page in the sitemap, readable without JavaScript', () => {
    const site = 'https://example.test';
    const page = pageSpecs(site).find((p) => p.path === '/live')!;
    expect(page.file).toBe('live.html');
    const html = renderPage(readFileSync('index.html', 'utf8'), page, site);
    expect(html).toContain('<title>Live rooms · GlitchBound</title>');
    for (const g of liveGames) expect(html).toContain(`>${g.title}</a>`);
    expect(sitemap(site)).toContain('<loc>https://example.test/live</loc>');
  });
});
