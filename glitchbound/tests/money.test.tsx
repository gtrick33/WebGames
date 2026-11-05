/**
 * Ads and the shop: all off by default and leaving no trace; the rules once on; an extra try at a daily; and purchases,
 * which only Stripe's signed word can grant.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AGREE_NOW, breaksRules, isBuiltIn, priceText, PRODUCTS, productIn, sanitizeProducts } from '../src/catalog/shop';

/** The built-in borders, banners and icons. */
const LOOKS = PRODUCTS.filter((p) => p.look);
const isLook = (id: string): boolean => LOOKS.some((p) => p.id === id);
import { NO_MONEY, sanitizeMoney } from '../src/catalog/settings';
import { canRetryDaily, retryDaily } from '../src/platform/dailyRetry';
import { applyStripeEvent, canSell, giftItem, loadItems, ownedBy, shopReport, startCheckout, takeBack, verifyStripeSignature } from '../server/shop';
import type { Env } from '../server/http';
import { memoryD1 } from './d1';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the switches', () => {
  it('are all off unless set, and keep only what they should', () => {
    expect(sanitizeMoney(null)).toEqual(NO_MONEY);
    expect(sanitizeMoney({ ads: 'yes', shop: 1, rewarded: {} })).toEqual(NO_MONEY);
    expect(sanitizeMoney({ ads: true, address: '  1  Main  St ', other: 1 })).toEqual({ ...NO_MONEY, ads: true, address: '1 Main St' });
    expect(sanitizeMoney({ adsGame: false })).toEqual({ ...NO_MONEY, adsGame: false });
    expect(sanitizeMoney({ address: 'x'.repeat(400) }).address).toHaveLength(160);
  });
});

describe('with everything off', () => {
  it('shows no ad, loads no ad script, and the pages say so', async () => {
    const { AdSlot } = await import('../src/components/AdSlot');
    const { container } = render(<AdSlot placement="home" />);
    expect(container.innerHTML).toBe('');
    expect(document.querySelector('script[src*="googlesyndication"]')).toBeNull();
    cleanup();
    const { TermsPage } = await import('../src/pages/TermsPage');
    render(<TermsPage />);
    expect(screen.getByText(/There is nothing to buy/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Purchases' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Ads' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Reporting something illegal' })).toBeTruthy();
    cleanup();
    const { PrivacyPage } = await import('../src/pages/PrivacyPage');
    render(<PrivacyPage />);
    expect(screen.getByText(/There are no ads on GlitchBound right now/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Purchases' })).toBeNull();
  });

  it('the shop and its terms can be read by their address, and nothing can be bought', async () => {
    const { ShopPage } = await import('../src/pages/ShopPage');
    render(<ShopPage />);
    expect(screen.getByText('The shop isn’t open yet, so nothing can be bought right now.')).toBeTruthy();
    expect(screen.getByText('€1.99')).toBeTruthy();
    expect(screen.getAllByText('Not on sale yet.')).toHaveLength(PRODUCTS.filter((p) => !p.later && !p.hidden).length);
    expect(screen.queryByRole('button', { name: /Get |Sign in first/ })).toBeNull();
    cleanup();
    const { SaleTermsPage } = await import('../src/pages/SaleTermsPage');
    render(<SaleTermsPage />);
    expect(screen.getByRole('heading', { name: 'Terms of sale' })).toBeTruthy();
    expect(screen.getByText(/These terms apply once it opens/)).toBeTruthy();
    // what Stripe asks a site to say
    for (const name of ['Who you buy from', 'What you get', 'Paying safely', 'Your right to withdraw', 'If something is wrong, and refunds']) expect(screen.getByRole('heading', { name })).toBeTruthy();
  });
});

describe('with the shop open', () => {
  beforeEach(async () => {
    const { setCatalog } = await import('../src/platform/liveCatalog');
    setCatalog({ settings: {}, picks: {}, notice: null, money: { ...NO_MONEY, shop: true, address: '1 Test St, Sofia' } });
  });
  afterEach(async () => {
    const { setCatalog } = await import('../src/platform/liveCatalog');
    setCatalog({ settings: {}, picks: {}, notice: null });
  });

  it('the legal pages change with it', async () => {
    const { TermsPage } = await import('../src/pages/TermsPage');
    render(<TermsPage />);
    expect(screen.getByRole('heading', { name: 'Purchases' })).toBeTruthy();
    expect(screen.queryByText(/There is nothing to buy/)).toBeNull();
    expect(screen.getByText(/1 Test St, Sofia/)).toBeTruthy();
    cleanup();
    const { SaleTermsPage } = await import('../src/pages/SaleTermsPage');
    render(<SaleTermsPage />);
    expect(screen.getByRole('heading', { name: 'Your right to withdraw' })).toBeTruthy();
    cleanup();
    const { PrivacyPage } = await import('../src/pages/PrivacyPage');
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { name: 'Purchases' })).toBeTruthy();
  });

  it('the shop shows the full price and asks a guest to sign in', async () => {
    const { ShopPage } = await import('../src/pages/ShopPage');
    render(<ShopPage />);
    expect(screen.getByRole('heading', { name: 'Ad-free' })).toBeTruthy();
    expect(screen.getByText('€1.99')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Sign in first' })).toHaveLength(PRODUCTS.filter((p) => !p.later && !p.hidden).length);
  });

  it('shows each border, banner and icon as it looks, before buying it, grouped by kind', async () => {
    const { ShopPage } = await import('../src/pages/ShopPage');
    const { container } = render(<ShopPage />);
    for (const p of LOOKS) {
      const panel = screen.getByRole('heading', { name: p.name }).closest('section')!;
      const drawn = { border: `.avatar-frame.look-${p.id}`, banner: `.look-banner.look-${p.id}`, icon: `.avatar-icon.look-${p.id} svg` }[p.look!.kind];
      expect(panel.querySelector(drawn), p.id).toBeTruthy();
    }
    expect(container.querySelectorAll('.shop-look')).toHaveLength(LOOKS.length);
    for (const name of ['Borders', 'Banners', 'Profile icons']) expect(screen.getByRole('heading', { name, level: 2 })).toBeTruthy();
  });
});

describe('an extra try at a daily', () => {
  const DAY = '2026-11-04';
  it('forgets today only, once per game per day', () => {
    localStorage.setItem('glitchbound.crosswire', JSON.stringify({ daily: { [DAY]: { done: true }, '2026-11-03': { done: true } }, solved: 2 }));
    expect(canRetryDaily('crosswire', DAY)).toBe(true);
    expect(retryDaily('crosswire', DAY)).toBe(true);
    const save = JSON.parse(localStorage.getItem('glitchbound.crosswire')!);
    expect(save.daily[DAY]).toBeUndefined();
    expect(save.daily['2026-11-03']).toBeTruthy();
    expect(save.solved).toBe(2);
    expect(canRetryDaily('crosswire', DAY)).toBe(false);
    expect(retryDaily('crosswire', DAY)).toBe(false);
    expect(canRetryDaily('crosswire', '2026-11-05')).toBe(true);
  });

  it('handles the games that keep it differently, and does nothing without a round', () => {
    localStorage.setItem('glitchbound.letter-pinch', JSON.stringify({ days: { [DAY]: { guesses: [] } } }));
    expect(retryDaily('letter-pinch', DAY)).toBe(true);
    expect(JSON.parse(localStorage.getItem('glitchbound.letter-pinch')!).days[DAY]).toBeUndefined();
    localStorage.setItem('glitchbound.to-scale', JSON.stringify({ daily: { [DAY]: { best: 1 } }, progress: { day: DAY } }));
    expect(retryDaily('to-scale', DAY)).toBe(true);
    expect(JSON.parse(localStorage.getItem('glitchbound.to-scale')!).progress).toBeUndefined();
    expect(retryDaily('wing-it', DAY)).toBe(false);
    expect(canRetryDaily('sigilfall', DAY)).toBe(false);
  });
});

describe('what the shop sells', () => {
  it('keeps only items that follow the rules, and ad-free is always there', () => {
    const good = { id: 'look-one', name: 'A look', blurb: 'A nice look.', cents: 150 };
    // (the borders and banners are always there too: the next test)
    const ids = (v: unknown): string[] => sanitizeProducts(v).map((p) => p.id).filter((id) => !isLook(id));
    expect(ids([good])).toEqual(['ad-free', 'look-one']);
    expect(sanitizeProducts([good, good]).filter((p) => p.id === 'look-one')).toHaveLength(1);
    expect(ids([{ ...good, cents: 10 }])).toEqual(['ad-free']);
    expect(ids([{ ...good, cents: 100000 }])).toEqual(['ad-free']);
    expect(ids([{ ...good, name: '' }])).toEqual(['ad-free']);
    expect(ids([{ ...good, id: 'Bad Id!' }])).toEqual(['ad-free']);
    expect(ids([{ ...good, blurb: 'Last chance: a loot box!' }])).toEqual(['ad-free']);
    expect(productIn(sanitizeProducts([{ ...good, hidden: true }]), 'look-one')!.hidden).toBe(true);
    expect(breaksRules('100 gems')).toBe(true);
    expect(breaksRules('A gold border')).toBe(false);
  });

  it('starts with ad-free at €1.99 and the borders and banners, and everything else is only planned', () => {
    const open = PRODUCTS.filter((p) => !p.later);
    expect(open.map((p) => p.id)).toEqual(['ad-free', ...LOOKS.map((l) => l.id)]);
    expect(priceText(productIn(PRODUCTS, 'ad-free')!.cents)).toBe('€1.99');
    // the lowest price Stripe can charge in euros
    for (const l of LOOKS) expect(priceText(productIn(PRODUCTS, l.id)!.cents)).toBe('€0.50');
  });

  it('keeps every border and banner in a saved list, as the admins set it, and drops the old placeholders', () => {
    const saved = sanitizeProducts([
      { id: 'look-borders', name: 'Picture borders', blurb: 'A border.', cents: 99, later: true },
      { id: 'border-aurora', name: 'Not a look', blurb: 'An admin item that only shares a prefix.', cents: 99 },
      { id: 'border-neon-halo', name: 'Halo', blurb: 'Cheaper now.', cents: 79, hidden: true },
      { id: 'sigilfall-mounts', name: 'Mounts', blurb: 'Planned.', cents: 299, later: true },
    ]);
    expect(saved.map((p) => p.id)).toEqual(['ad-free', 'border-aurora', 'border-neon-halo', ...LOOKS.slice(1).map((l) => l.id), 'sigilfall-mounts']);
    // the admins' name, text, price and state, and the look the code gives it
    expect(productIn(saved, 'border-neon-halo')).toEqual({ id: 'border-neon-halo', name: 'Halo', blurb: 'Cheaper now.', cents: 79, hidden: true, look: { kind: 'border', style: 'neon-halo' } });
    expect(productIn(saved, 'border-aurora')!.look).toBeUndefined();
    expect(isBuiltIn('ad-free') && LOOKS.every((l) => isBuiltIn(l.id))).toBe(true);
    expect(isBuiltIn('border-aurora') || isBuiltIn('sigilfall-mounts')).toBe(false);
  });

  it('has no pressure, currency or chance in its words', () => {
    for (const p of PRODUCTS) expect(`${p.name} ${p.blurb}`).not.toMatch(/last chance|limited time|hurry|buy now|coins|gems|crates?|loot ?box|random|stronger/i);
  });
});

describe('purchases', () => {
  const SECRET = 'whsec_test';
  const USER = { id: 'u1', email: 'qa@example.test' };

  function env(): Env {
    const DB = memoryD1();
    return { DB, STRIPE_SECRET_KEY: 'sk_test', STRIPE_WEBHOOK_SECRET: SECRET } as unknown as Env;
  }

  async function sign(body: string, t: number, secret = SECRET): Promise<string> {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`));
    return `t=${t},v1=${[...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  }

  it('only believes a fresh message signed with our secret', async () => {
    const now = 1_800_000_000;
    const body = '{"a":1}';
    expect(await verifyStripeSignature(body, await sign(body, now), SECRET, now)).toBe(true);
    expect(await verifyStripeSignature('{"a":2}', await sign(body, now), SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(body, await sign(body, now, 'other'), SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(body, await sign(body, now - 3600), SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(body, null, SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(body, await sign(body, now), undefined, now)).toBe(false);
  });

  it('sells only what is open', () => {
    const e = env();
    expect(canSell(e, productIn(PRODUCTS, 'ad-free'))).toBe(true);
    expect(canSell(e, productIn(PRODUCTS, 'sigilfall-mounts'))).toBe(false);
    expect(canSell({ ...e, STRIPE_SECRET_KEY: undefined } as Env, productIn(PRODUCTS, 'ad-free'))).toBe(false);
    expect(canSell(e, undefined)).toBe(false);
  });

  /** Stripe, answering for products, prices and checkouts. */
  function fakeStripe() {
    const calls: { path: string; form: URLSearchParams }[] = [];
    let n = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const path = url.replace('https://api.stripe.com/v1/', '');
        calls.push({ path, form: new URLSearchParams(String(init.body)) });
        n++;
        return new Response(JSON.stringify(path === 'checkout/sessions' ? { url: 'https://checkout.stripe.test/s' } : { id: `${path.slice(0, 5)}_${n}` }), { status: 200 });
      }),
    );
    return calls;
  }

  it('goes from checkout to paid to refunded, and owns the item only while paid', async () => {
    const e = env();
    const calls = fakeStripe();
    const url = await startCheckout(e, USER, productIn(PRODUCTS, 'ad-free')!, 'https://site.test', 1000);
    expect(url).toBe('https://checkout.stripe.test/s');
    const session = calls.find((c) => c.path === 'checkout/sessions')!.form;
    expect(session.get('mode')).toBe('payment');
    expect(session.get('managed_payments[enabled]')).toBe('true');
    const price = calls.find((c) => c.path === 'prices')!.form;
    expect(price.get('unit_amount')).toBe('199');
    expect(price.get('currency')).toBe('eur');
    expect(price.get('tax_behavior')).toBe('inclusive');
    // going to checkout gives nothing
    expect(await ownedBy(e, USER.id)).toEqual([]);
    const id = session.get('client_reference_id')!;
    const paid = { type: 'checkout.session.completed', data: { object: { id: 'cs_1', client_reference_id: id, payment_status: 'paid', payment_intent: 'pi_1', amount_total: 199, currency: 'eur' } } };
    await applyStripeEvent(e, paid, 2000);
    expect(await ownedBy(e, USER.id)).toEqual(['ad-free']);
    // the same message again changes nothing
    await applyStripeEvent(e, paid, 3000);
    expect(await ownedBy(e, USER.id)).toEqual(['ad-free']);
    await applyStripeEvent(e, { type: 'charge.refunded', data: { object: { payment_intent: 'pi_1' } } }, 4000);
    expect(await ownedBy(e, USER.id)).toEqual([]);
  });

  it('charges what the admin set: a changed price makes a new Stripe price, an unchanged one doesn’t', async () => {
    const e = env();
    const calls = fakeStripe();
    const item = productIn(PRODUCTS, 'ad-free')!;
    await startCheckout(e, USER, item, 'https://site.test', 1000);
    await startCheckout(e, { ...USER, id: 'u2' }, item, 'https://site.test', 1001);
    expect(calls.filter((c) => c.path === 'products')).toHaveLength(1);
    expect(calls.filter((c) => c.path === 'prices')).toHaveLength(1);
    await startCheckout(e, { ...USER, id: 'u3' }, { ...item, cents: 299 }, 'https://site.test', 1002);
    expect(calls.filter((c) => c.path === 'products')).toHaveLength(1);
    const prices = calls.filter((c) => c.path === 'prices');
    expect(prices).toHaveLength(2);
    expect(prices[1]!.form.get('unit_amount')).toBe('299');
    const last = calls.filter((c) => c.path === 'checkout/sessions').at(-1)!.form;
    expect(last.get('line_items[0][price]')).toMatch(/^price/);
    expect(last.get('line_items[0][price]')).not.toBe(calls.filter((c) => c.path === 'checkout/sessions')[0]!.form.get('line_items[0][price]'));
  });

  it('gifts and takes back by hand, and a gift never counts as money', async () => {
    const e = env();
    await giftItem(e, USER.id, 'ad-free', 1000);
    expect(await ownedBy(e, USER.id)).toEqual(['ad-free']);
    const report = await shopReport(e);
    expect(report.items[0]).toMatchObject({ product: 'ad-free', paid: 0, gifted: 1, cents: 0 });
    expect(report.recent[0]).toMatchObject({ gift: true, status: 'paid', nickname: null });
    expect(await takeBack(e, report.recent[0]!.id)).toBe(true);
    expect(await ownedBy(e, USER.id)).toEqual([]);
    expect(await takeBack(e, report.recent[0]!.id)).toBe(false);
  });

  it('reads the admins’ list, or starts from the built-in one', async () => {
    const e = env();
    expect(await loadItems(e)).toEqual(PRODUCTS);
    await e.DB.prepare("INSERT INTO site_settings (key, value, updated_at, updated_by) VALUES ('shop_items', ?, 1, 'qa')").bind(JSON.stringify([{ id: 'look-one', name: 'A look', blurb: 'A nice look.', cents: 150 }])).run();
    expect((await loadItems(e)).map((p) => p.id)).toEqual(['ad-free', ...LOOKS.map((l) => l.id), 'look-one']);
  });

  it('keeps Stripe’s test and live modes apart', async () => {
    const e = env();
    const calls = fakeStripe();
    const item = productIn(PRODUCTS, 'ad-free')!;
    await startCheckout({ ...e, STRIPE_SECRET_KEY: 'rk_test_1' } as Env, USER, item, 'https://site.test', 1000);
    await startCheckout({ ...e, STRIPE_SECRET_KEY: 'rk_test_1' } as Env, { ...USER, id: 'u2' }, item, 'https://site.test', 1001);
    expect(calls.filter((c) => c.path === 'products')).toHaveLength(1);
    await startCheckout({ ...e, STRIPE_SECRET_KEY: 'rk_live_1' } as Env, { ...USER, id: 'u3' }, item, 'https://site.test', 1002);
    expect(calls.filter((c) => c.path === 'products')).toHaveLength(2);
    expect(calls.filter((c) => c.path === 'prices')).toHaveLength(2);
  });

  it('a test-mode payment gives the item, so a test works, and never counts as money', async () => {
    const e = env();
    const calls = fakeStripe();
    await startCheckout(e, USER, productIn(PRODUCTS, 'ad-free')!, 'https://site.test', 1000);
    const id = calls.find((c) => c.path === 'checkout/sessions')!.form.get('client_reference_id')!;
    await applyStripeEvent(e, { type: 'checkout.session.completed', livemode: false, data: { object: { id: 'cs_t', client_reference_id: id, payment_status: 'paid', payment_intent: 'pi_t', amount_total: 199, currency: 'eur' } } }, 2000);
    expect(await ownedBy(e, USER.id)).toEqual(['ad-free']);
    const report = await shopReport(e);
    expect(report.items[0]).toMatchObject({ paid: 0, cents: 0 });
    expect(report.recent[0]).toMatchObject({ currency: 'test', status: 'paid' });
  });

  it('gives nothing for an unpaid checkout, or a payment it doesn’t know', async () => {
    const e = env();
    fakeStripe();
    await startCheckout(e, USER, productIn(PRODUCTS, 'ad-free')!, 'https://site.test', 1000);
    await applyStripeEvent(e, { type: 'checkout.session.completed', data: { object: { id: 'cs_2', client_reference_id: 'nope', payment_status: 'paid', payment_intent: 'pi_2' } } });
    expect(await ownedBy(e, USER.id)).toEqual([]);
  });

  it('the agreement text says what the law asks', () => {
    expect(AGREE_NOW).toMatch(/right away/);
    expect(AGREE_NOW).toMatch(/14-day right to withdraw/);
  });
});
