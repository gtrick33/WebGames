/** The shop's checkout opens inside the item that was pressed, not at the foot of a long page. */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_MONEY } from '../src/catalog/settings';
import { AGREE_AGE, AGREE_NOW } from '../src/catalog/shop';
import type { Me } from '../src/platform/apiTypes';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getting an item', () => {
  it('opens the checkout in that item’s own panel, with the focus on it', async () => {
    const me = { id: 'u1', nickname: 'Cal', email: 'cal@example.com', avatar: '', isAdmin: false, role: null, xp: 0, level: 1, levelFloor: 0, levelNext: 100, notify: false, favorites: [], bests: {}, rounds: 0, streak: 0, dailyDays: [], badges: [], quests: [], questDay: '2026-11-05', joinedAt: 0, savesAt: 0, owned: [] } as unknown as Me;
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
    expect(screen.getByRole('button', { name: 'Get Ad-free' })).toBeTruthy();
    fireEvent.click(within(checkout).getByRole('button', { name: 'Cancel' }));
    expect(within(panel).getByRole('button', { name: 'Get Aurora banner' })).toBeTruthy();
  });
});
