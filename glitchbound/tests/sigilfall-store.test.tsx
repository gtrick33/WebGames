/**
 * Sigilfall's own shop (ui/Store.tsx): the Gloamknight Pack, the mounts and the Wardrobe looks, inside the game.
 * It is the site's shop shown where the things are used: the same items at the same prices, the same two statements
 * ticked by hand, the same checkout, which brings the buyer back to the game. And it stays out of the way: there is
 * nothing to open while the shop is closed, and it never shows a price a player didn't go looking for.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// (the class portraits and the HUD's pixel icons need a canvas, which the test page lacks)
vi.mock('../src/games/sigilfall/render/sprites', async (original) => ({ ...(await original<typeof import('../src/games/sigilfall/render/sprites')>()), heroDollUrl: () => '' }));
vi.mock('../src/games/sigilfall/ui/uiIcons', () => ({ uiIcon: () => '' }));
import { NO_MONEY } from '../src/catalog/settings';
import { AGREE_AGE, AGREE_NOW, GLOAMKNIGHT_ITEM, PRODUCTS, productIn } from '../src/catalog/shop';
import type { Me } from '../src/platform/apiTypes';
import { backOf, startCheckout } from '../server/shop';
import type { Env } from '../server/http';
import { memoryD1 } from './d1';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const member = (owned: string[] = [], isAdmin = false): Me =>
  ({ id: 'u1', nickname: 'Cal', email: 'cal@example.com', avatar: '', isAdmin, role: null, xp: 0, level: 1, levelFloor: 0, levelNext: 100, notify: false, favorites: [], bests: {}, rounds: 0, streak: 0, dailyDays: [], badges: [], quests: [], questDay: '', joinedAt: 0, owned }) as Me;

/** The site as the game finds it: the shop open or closed, someone signed in or nobody. Returns what was sent to the API. */
async function site(o: { shop: boolean; me?: Me }): Promise<{ sent: { url: string; body: unknown }[] }> {
  const sent: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.body) sent.push({ url: String(url), body: JSON.parse(String(init.body)) });
      if (String(url).includes('/api/shop/checkout')) return new Response(JSON.stringify({ url: 'https://checkout.stripe.test/s' }));
      return new Response(JSON.stringify({ user: o.me ?? null }));
    }),
  );
  const { setCatalog } = await import('../src/platform/liveCatalog');
  setCatalog({ settings: {}, picks: {}, notice: null, money: { ...NO_MONEY, shop: o.shop } });
  const { account } = await import('../src/platform/account');
  await act(async () => {
    if (o.me) await account.signedIn(o.me);
    else await account.signOut().catch(() => undefined);
  });
  return { sent };
}

const SIGIL = PRODUCTS.filter((p) => (p.sigil || p.id === GLOAMKNIGHT_ITEM) && !p.hidden);

describe('Sigilfall’s shop: what it shows', () => {
  it('lists the pack, the mounts and the looks with every price in full, and nothing else of the site’s', async () => {
    await site({ shop: true, me: member() });
    const { StorePanel } = await import('../src/games/sigilfall/ui/Store');
    render(<StorePanel onClose={() => undefined} />);
    const shop = screen.getByRole('dialog', { name: 'Sigilfall shop' });
    expect(SIGIL.length).toBe(12);
    for (const p of SIGIL) {
      expect(within(shop).getByRole('button', { name: `Get ${p.name}` }), p.id).toBeTruthy();
      expect(shop.textContent, p.id).toContain(`€${(p.cents / 100).toFixed(2)}`);
    }
    // each price says what it is: all of it, paid once
    expect(within(shop).getAllByText('VAT included, paid once').length).toBe(SIGIL.length);
    // the pack says what is in it, and its pieces are not sold again beside it
    const pack = within(shop).getByRole('heading', { name: 'Gloamknight Pack' }).closest('section')!;
    for (const part of ['The Gloamknight', 'Duskborn Helm', 'Duskborn Plate', 'Gloamwing Drake', 'Gloam border', 'Gloam banner']) expect(within(pack).getByText(part), part).toBeTruthy();
    expect(within(shop).queryByRole('button', { name: 'Get Gloamwing Drake' })).toBeNull();
    // the site's own things stay on the site's page
    for (const other of ['Ad-free', 'Aurora banner', 'Neon Halo border']) expect(within(shop).queryByText(other), other).toBeNull();
    // and it keeps the shop's manners: no countdown, no nudge, the terms a tap away
    expect(shop.textContent).not.toMatch(/last chance|hurry|limited|only today|% off|sale ends/i);
    expect(within(shop).getByRole('link', { name: 'terms of sale' }).getAttribute('href')).toBe('/terms/sale');
  });

  it('says what is already the player’s, and asks a guest to sign in before anything else', async () => {
    await site({ shop: true, me: member(['sigilfall-cinderhorn-hart', GLOAMKNIGHT_ITEM]) });
    const { StorePanel } = await import('../src/games/sigilfall/ui/Store');
    render(<StorePanel onClose={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Get Cinderhorn Hart' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Get Gloamknight Pack' })).toBeNull();
    // (what is theirs wears a seal and says where it is, and has no price on it any more)
    expect(screen.getAllByText('✓ Owned').length).toBe(2);
    const hart = screen.getByText('It’s in the stable of every hero.').closest('li')!;
    expect(hart.className).toContain('is-owned');
    expect(hart.querySelector('.rb-store-price')).toBeNull();
    const pack = screen.getByText('Make a Gloamknight from the hero screen.').closest('section')!;
    expect(pack.className).toContain('is-owned');
    expect(pack.querySelector('.rb-store-price')).toBeNull();
    // (what isn't theirs still has its price)
    expect(screen.getByRole('button', { name: 'Get Moonglass Hart' }).closest('li')!.querySelector('.rb-store-price')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Get Moonglass Hart' })).toBeTruthy();
    cleanup();
    await site({ shop: true });
    render(<StorePanel onClose={() => undefined} />);
    expect(screen.queryByRole('button', { name: /^Get / })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Sign in first' }).length).toBe(SIGIL.length);
    // (a guest still sees every price)
    expect(screen.getByRole('dialog', { name: 'Sigilfall shop' }).textContent).toContain('€4.99');
  });

  it('thanks a buyer who has just come back from the checkout', async () => {
    await site({ shop: true, me: member() });
    const { StorePanel } = await import('../src/games/sigilfall/ui/Store');
    render(<StorePanel onClose={() => undefined} bought={GLOAMKNIGHT_ITEM} />);
    expect(screen.getByRole('status').textContent).toMatch(/Thank you/);
  });
});

describe('Sigilfall’s shop: buying', () => {
  it('asks for the two statements, each ticked by hand, and sends the buyer to the site’s own checkout to come back to the game', async () => {
    const { sent } = await site({ shop: true, me: member() });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const { StorePanel } = await import('../src/games/sigilfall/ui/Store');
    render(<StorePanel onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Get Gloamknight Pack' }));
    // the price again, on the last step before paying
    const checkout = screen.getByRole('group', { name: 'Gloamknight Pack: €4.99' });
    const pay = within(checkout).getByRole('button', { name: 'Continue to payment' }) as HTMLButtonElement;
    expect(pay.disabled).toBe(true);
    fireEvent.click(within(checkout).getByLabelText(AGREE_NOW));
    expect(pay.disabled).toBe(true);
    fireEvent.click(within(checkout).getByLabelText(AGREE_AGE));
    expect(pay.disabled).toBe(false);
    // one checkout open at a time: another item keeps its own button
    expect(screen.getByRole('button', { name: 'Get Galecrest Drake' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(pay);
    });
    const order = sent.find((s) => s.url.includes('/api/shop/checkout'))!;
    expect(order.body).toEqual({ product: GLOAMKNIGHT_ITEM, agreeNow: true, agreeAge: true, lang: 'en', back: 'sigilfall' });
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.test/s');
  });

  it('comes back to the game after Stripe, and only ever to an address the server names itself', async () => {
    const calls: URLSearchParams[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const path = String(url).replace('https://api.stripe.com/v1/', '');
        if (path === 'checkout/sessions') calls.push(new URLSearchParams(String(init.body)));
        return new Response(JSON.stringify(path === 'checkout/sessions' ? { url: 'https://checkout.stripe.test/s' } : { id: `${path}_1` }), { status: 200 });
      }),
    );
    const env = { DB: memoryD1(), STRIPE_SECRET_KEY: 'sk_test' } as unknown as Env;
    const pack = productIn(PRODUCTS, GLOAMKNIGHT_ITEM)!;
    const user = { id: 'u1', email: 'qa@example.test' };
    await startCheckout(env, user, pack, 'https://site.test', 1000, 'en', 'sigilfall');
    expect(calls[0]!.get('success_url')).toBe(`https://site.test/sigilfall?play=1&bought=${GLOAMKNIGHT_ITEM}`);
    expect(calls[0]!.get('cancel_url')).toBe('https://site.test/sigilfall?play=1&shop=1');
    // bought on the shop page, as before: back to the shop page
    await startCheckout(env, { ...user, id: 'u2' }, pack, 'https://site.test', 1001);
    expect(calls[1]!.get('success_url')).toBe(`https://site.test/shop?bought=${GLOAMKNIGHT_ITEM}`);
    expect(calls[1]!.get('cancel_url')).toBe('https://site.test/shop');
    // a request picks one of the two by name; it can't give an address of its own
    expect(backOf('sigilfall')).toBe('sigilfall');
    for (const v of [undefined, null, '', 'shop', 'https://evil.test', '//evil.test', '/admin', 'constructor', 'toString', 42, {}]) expect(backOf(v), String(v)).toBe('shop');
  });
});

describe('Sigilfall’s shop: staying out of the way', () => {
  it('opens from the locked class only while there is a shop, and shows no price until it is open', async () => {
    const real = HTMLCanvasElement.prototype.getContext;
    // a canvas that draws nothing, as the other game screen tests use
    const fake: object = new Proxy({}, { get: (_t, k) => (k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h) * 4) }) : k === 'createImageData' ? (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h) * 4) }) : k === 'measureText' ? () => ({ width: 8 }) : () => fake), set: () => true });
    HTMLCanvasElement.prototype.getContext = (() => fake) as unknown as HTMLCanvasElement['getContext'];
    try {
      const { CreateScreen } = await import('../src/games/sigilfall/ui/Title');
      const engine = { ui: { createSlot: 0 }, defaultName: 'Tester', asksForTips: false, toTitle: () => undefined, createHero: () => undefined };
      // the shop open: the hero screen still shows no price; the way to the pack is a plain button under the class
      await site({ shop: true });
      render(<CreateScreen engine={engine as never} />);
      fireEvent.click(screen.getByRole('radio', { name: /Gloamknight/ }));
      expect(document.body.textContent).not.toMatch(/€/);
      expect(screen.queryByRole('dialog', { name: 'Sigilfall shop' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'See the Gloamknight Pack' }));
      const shop = screen.getByRole('dialog', { name: 'Sigilfall shop' });
      expect(shop.textContent).toContain('€4.99');
      fireEvent.click(within(shop).getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog', { name: 'Sigilfall shop' })).toBeNull();
      cleanup();
      // the shop closed (as it is until it's opened in Admin): nothing to open
      await site({ shop: false });
      render(<CreateScreen engine={engine as never} />);
      fireEvent.click(screen.getByRole('radio', { name: /Gloamknight/ }));
      expect(screen.queryByRole('button', { name: 'See the Gloamknight Pack' })).toBeNull();
      expect(screen.getByText('The Gloamknight isn’t available yet.')).toBeTruthy();
      cleanup();
      // an admin tests it while it is closed, and is told so
      await site({ shop: false, me: member([], true) });
      const { StorePanel } = await import('../src/games/sigilfall/ui/Store');
      render(<StorePanel onClose={() => undefined} />);
      expect(screen.getByRole('status').textContent).toMatch(/Admin test/);
    } finally {
      HTMLCanvasElement.prototype.getContext = real;
    }
  });

  it('reads the way back from the checkout once, and takes it off the address', async () => {
    const { storeReturn, forgetStoreReturn } = await import('../src/games/sigilfall/ui/Title');
    const at = (q: string): void => window.history.replaceState(null, '', `/sigilfall${q}`);
    at('?play=1');
    expect(storeReturn()).toEqual({ open: false, bought: null });
    at(`?play=1&bought=${GLOAMKNIGHT_ITEM}`);
    expect(storeReturn()).toEqual({ open: true, bought: GLOAMKNIGHT_ITEM });
    // turned back at Stripe: the shop opens again, with nothing to thank for
    at('?play=1&shop=1');
    expect(storeReturn()).toEqual({ open: true, bought: null });
    // (an address someone made up names no item)
    at('?bought=%3Cscript%3E');
    expect(storeReturn()).toEqual({ open: true, bought: null });
    at(`?play=1&bought=${GLOAMKNIGHT_ITEM}&room=ABCDE`);
    forgetStoreReturn();
    expect(window.location.search).toBe('?play=1&room=ABCDE');
    expect(storeReturn()).toEqual({ open: false, bought: null });
    at('');
  });
});
