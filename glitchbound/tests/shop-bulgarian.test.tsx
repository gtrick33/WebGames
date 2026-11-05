/**
 * The shop, its terms of sale, the terms and privacy in Bulgarian: every built-in item has its words, the pages read in
 * Bulgarian with the same sections as in English, and a buyer who ticks the statements in Bulgarian gets them back, in
 * Bulgarian, in the confirmation email.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_MONEY } from '../src/catalog/settings';
import { AGREE_AGE_BG, AGREE_NOW_BG, PRODUCTS, priceTextBg, productIn, SALE_TERMS_VERSION } from '../src/catalog/shop';
import { ITEMS_BG, itemBg } from '../src/catalog/shopBg';
import { setLang } from '../src/i18n';
import type { Me } from '../src/platform/apiTypes';
import { applyStripeEvent, startCheckout } from '../server/shop';
import type { Env } from '../server/http';
import { memoryD1 } from './d1';

const OPEN = { ...NO_MONEY, shop: true, address: '1 Test St, Sofia' };

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await setLang('en');
  const { setCatalog } = await import('../src/platform/liveCatalog');
  setCatalog({ settings: {}, picks: {}, notice: null });
});

async function inBulgarian(money = OPEN): Promise<void> {
  await setLang('bg');
  const { setCatalog } = await import('../src/platform/liveCatalog');
  setCatalog({ settings: {}, picks: {}, notice: null, money });
}

/** The h2 headings a page shows, in order. */
const headings = (): string[] => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '');

describe('the items in Bulgarian', () => {
  it('has a name and a description for every built-in item, and nothing else', () => {
    expect(Object.keys(ITEMS_BG).sort()).toEqual(PRODUCTS.map((p) => p.id).sort());
    for (const p of PRODUCTS) expect(ITEMS_BG[p.id]!.blurb, p.id).not.toBe(p.blurb);
  });

  it('keeps what an admin wrote: an item they made, or whose English they changed, reads as they wrote it', () => {
    const aurora = productIn(PRODUCTS, 'banner-aurora')!;
    expect(itemBg(aurora)).toEqual(ITEMS_BG['banner-aurora']);
    expect(itemBg({ ...aurora, name: 'Aurora (spring sale)' }).name).toBe('Aurora (spring sale)');
    expect(itemBg({ ...aurora, name: 'Aurora (spring sale)' }).blurb).toBe(ITEMS_BG['banner-aurora']!.blurb);
    expect(itemBg({ id: 'look-new', name: 'New', blurb: 'Made by an admin.' })).toEqual({ name: 'New', blurb: 'Made by an admin.' });
  });

  it('writes prices the Bulgarian way', () => {
    expect(priceTextBg(50)).toBe('0,50 €');
    expect(priceTextBg(999)).toBe('9,99 €');
  });
});

describe('the pages in Bulgarian', () => {
  it('the shop: its words, its items, their prices, and a guest asked to sign in', async () => {
    await inBulgarian();
    const { ShopPage } = await import('../src/pages/ShopPage');
    render(<ShopPage />);
    expect(screen.getByRole('heading', { name: 'Магазин', level: 1 })).toBeTruthy();
    for (const name of ['Рамки', 'Банери', 'Икони за профила']) expect(screen.getByRole('heading', { name, level: 2 })).toBeTruthy();
    const aurora = screen.getByRole('heading', { name: 'Банер „Северно сияние“' }).closest('section')!;
    expect(within(aurora).getByText(ITEMS_BG['banner-aurora']!.blurb)).toBeTruthy();
    expect(within(aurora).getByText('0,50 €')).toBeTruthy();
    expect(within(aurora).getByRole('button', { name: 'Първо влез' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'условията за продажба' }).getAttribute('href')).toBe('/terms/sale');
    // Sigilfall's own names stay as the game has them
    expect(screen.getByRole('heading', { name: 'Galecrest Drake' })).toBeTruthy();
    expect(screen.queryByText('Get Aurora banner')).toBeNull();
  });

  it('the checkout: the two statements in Bulgarian, and the language goes with the purchase', async () => {
    await inBulgarian();
    const me = { id: 'u1', nickname: 'Cal', email: 'cal@example.com', avatar: '', isAdmin: false, role: null, owned: [], favorites: [], bests: {}, badges: [], quests: [], dailyDays: [] } as unknown as Me;
    const sent: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).includes('/api/shop/checkout')) sent.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify(String(url).includes('/api/shop/checkout') ? { url: 'about:blank' } : { user: me }));
      }),
    );
    const { account } = await import('../src/platform/account');
    await act(async () => {
      await account.signedIn(me);
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign, search: '' });
    const { ShopPage } = await import('../src/pages/ShopPage');
    render(<ShopPage />);
    const panel = screen.getByRole('heading', { name: 'Банер „Северно сияние“' }).closest('section')!;
    fireEvent.click(within(panel).getByRole('button', { name: 'Вземи Банер „Северно сияние“' }));
    const checkout = within(panel).getByRole('group', { name: 'Банер „Северно сияние“: 0,50 €' });
    fireEvent.click(within(checkout).getByLabelText(AGREE_NOW_BG));
    fireEvent.click(within(checkout).getByLabelText(AGREE_AGE_BG));
    await act(async () => {
      fireEvent.click(within(checkout).getByRole('button', { name: 'Към плащането' }));
    });
    expect(sent).toEqual([{ product: 'banner-aurora', agreeNow: true, agreeAge: true, lang: 'bg' }]);
  });

  it('the terms of sale, the terms and privacy: in Bulgarian, with the same sections as in English', async () => {
    const pages = [
      { load: async () => (await import('../src/pages/SaleTermsPage')).SaleTermsPage, title: 'Условия за продажба', has: 'Правото ви на отказ' },
      { load: async () => (await import('../src/pages/TermsPage')).TermsPage, title: 'Условия за ползване', has: 'Покупки' },
      { load: async () => (await import('../src/pages/PrivacyPage')).PrivacyPage, title: 'Поверителност и вашите данни', has: 'Кой отговаря и кой помага' },
    ];
    for (const page of pages) {
      const Page = await page.load();
      const { setCatalog } = await import('../src/platform/liveCatalog');
      await setLang('en');
      setCatalog({ settings: {}, picks: {}, notice: null, money: OPEN });
      render(<Page />);
      const english = headings();
      cleanup();
      await inBulgarian();
      render(<Page />);
      expect(screen.getByRole('heading', { name: page.title, level: 1 })).toBeTruthy();
      expect(headings(), page.title).toHaveLength(english.length);
      expect(headings()).toContain(page.has);
      // nothing left in English but the names (GlitchBound, Stripe, Sigilfall and its classes, the address)
      expect(headings().filter((h) => english.includes(h)), page.title).toEqual([]);
      expect(screen.getByText(/Сава Христов/)).toBeTruthy();
      cleanup();
    }
  });
});

describe('a purchase in Bulgarian', () => {
  it('records the terms read in Bulgarian, opens Stripe in Bulgarian and confirms by email in Bulgarian', async () => {
    const DB = memoryD1();
    DB.sqlite.prepare('INSERT INTO users (id, google_sub, email, nickname, created_at, last_seen) VALUES (?, ?, ?, ?, 0, 0)').run('u1', 'u1', 'qa@example.test', 'Cal');
    const e = { DB, STRIPE_SECRET_KEY: 'sk_test', RESEND_API_KEY: 're_test', MAIL_FROM: 'GlitchBound <hi@glitchboundstudio.com>' } as unknown as Env;
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, body: String(init.body) });
        const path = url.replace('https://api.stripe.com/v1/', '');
        return new Response(JSON.stringify(path === 'checkout/sessions' ? { url: 'https://checkout.stripe.test/s' } : { id: `${path.slice(0, 5)}_${calls.length}` }), { status: 200 });
      }),
    );
    await startCheckout(e, { id: 'u1', email: 'qa@example.test' }, productIn(PRODUCTS, 'banner-aurora')!, 'https://site.test', 1000, 'bg');
    const session = new URLSearchParams(calls.find((c) => c.url.endsWith('checkout/sessions'))!.body);
    expect(session.get('locale')).toBe('bg');
    const id = session.get('client_reference_id')!;
    expect(DB.sqlite.prepare('SELECT terms FROM purchases WHERE id = ?').get(id)).toEqual({ terms: `${SALE_TERMS_VERSION} bg` });
    await applyStripeEvent(e, { type: 'checkout.session.completed', data: { object: { id: 'cs_1', client_reference_id: id, payment_status: 'paid', payment_intent: 'pi_1', amount_total: 50, currency: 'eur' } } }, 2000);
    const mail = JSON.parse(calls.find((c) => c.url.includes('resend.com'))!.body)[0] as { subject: string; text: string };
    expect(mail.subject).toBe('Твоята покупка в GlitchBound: Банер „Северно сияние“');
    expect(mail.text).toContain('0,50 €, с ДДС');
    expect(mail.text).toContain(`„${AGREE_NOW_BG}“`);
  });

  it('an English buyer gets English, as before', async () => {
    const DB = memoryD1();
    DB.sqlite.prepare('INSERT INTO users (id, google_sub, email, nickname, created_at, last_seen) VALUES (?, ?, ?, ?, 0, 0)').run('u1', 'u1', 'qa@example.test', 'Cal');
    const e = { DB, STRIPE_SECRET_KEY: 'sk_test', RESEND_API_KEY: 're_test', MAIL_FROM: 'GlitchBound <hi@glitchboundstudio.com>' } as unknown as Env;
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, body: String(init.body) });
        const path = url.replace('https://api.stripe.com/v1/', '');
        return new Response(JSON.stringify(path === 'checkout/sessions' ? { url: 'https://checkout.stripe.test/s' } : { id: `${path.slice(0, 5)}_${calls.length}` }), { status: 200 });
      }),
    );
    await startCheckout(e, { id: 'u1', email: 'qa@example.test' }, productIn(PRODUCTS, 'banner-aurora')!, 'https://site.test', 1000);
    const id = new URLSearchParams(calls.find((c) => c.url.endsWith('checkout/sessions'))!.body).get('client_reference_id')!;
    expect(DB.sqlite.prepare('SELECT terms FROM purchases WHERE id = ?').get(id)).toEqual({ terms: SALE_TERMS_VERSION });
    await applyStripeEvent(e, { type: 'checkout.session.completed', data: { object: { id: 'cs_1', client_reference_id: id, payment_status: 'paid', payment_intent: 'pi_1', amount_total: 50, currency: 'eur' } } }, 2000);
    const mail = JSON.parse(calls.find((c) => c.url.includes('resend.com'))!.body)[0] as { subject: string };
    expect(mail.subject).toBe('Your GlitchBound purchase: Aurora banner');
  });
});
