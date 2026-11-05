/** The shop's checkout opens inside the item that was pressed, not at the foot of a long page. */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_MONEY } from '../src/catalog/settings';
import { AGREE_AGE, AGREE_NOW } from '../src/catalog/shop';
import type { Me } from '../src/platform/apiTypes';

afterEach(() => {
  vi.unstubAllGlobals();
});

const member = (isAdmin = false): Me =>
  ({ id: 'u1', nickname: 'Cal', email: 'cal@example.com', avatar: '', isAdmin, role: null, xp: 0, level: 1, levelFloor: 0, levelNext: 100, notify: false, favorites: [], bests: {}, rounds: 0, streak: 0, dailyDays: [], badges: [], quests: [], questDay: '2026-11-05', joinedAt: 0, savesAt: 0, owned: [] }) as unknown as Me;

describe('getting an item', () => {
  it('opens the checkout in that item’s own panel, with the focus on it', async () => {
    const me = member();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user: me }))));
    const { setCatalog } = await import('../src/platform/liveCatalog');
    setCatalog({ settings: {}, picks: {}, notice: null, money: { ...NO_MONEY, shop: true, address: '1 Test St, Sofia' } });
    const { account } = await import('../src/platform/account');
    await act(async () => {
      await account.signedIn(me);
    });
    const { ShopPage } = await import('../src/pages/ShopPage');
    render(<ShopPage />);
    const panel = screen.getByRole('heading', { name: 'Aurora banner' }).closest('section')!;
    fireEvent.click(within(panel).getByRole('button', { name: 'Get Aurora banner' }));
    const checkout = within(panel).getByRole('group', { name: 'Aurora banner: €0.50' });
    expect(within(checkout).getByLabelText(AGREE_NOW)).toBeTruthy();
    expect(within(checkout).getByLabelText(AGREE_AGE)).toBeTruthy();
    expect(document.activeElement).toBe(within(checkout).getByRole('heading'));
    // the other items keep their own button, and Cancel brings this one's back
    expect(screen.getByRole('button', { name: 'Get Neon Halo border' })).toBeTruthy();
    fireEvent.click(within(checkout).getByRole('button', { name: 'Cancel' }));
    expect(within(panel).getByRole('button', { name: 'Get Aurora banner' })).toBeTruthy();
  });
});

describe('the Shop tab', () => {
  it('shows for an admin while the shop is closed, so they can test it, and not for a player', async () => {
    const { setCatalog } = await import('../src/platform/liveCatalog');
    setCatalog({ settings: {}, picks: {}, notice: null, money: { ...NO_MONEY } });
    const { account } = await import('../src/platform/account');
    const { Header } = await import('../src/components/Header');
    for (const isAdmin of [false, true]) {
      const me = member(isAdmin);
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user: me }))));
      await act(async () => {
        await account.signedIn(me);
      });
      const { unmount } = render(<Header />);
      expect(screen.queryAllByRole('link', { name: 'Shop' }).length > 0, isAdmin ? 'admin' : 'player').toBe(isAdmin);
      unmount();
    }
  });
});
