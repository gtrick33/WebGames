/**
 * What the shop sells. The rules, which keep it fair and keep it legal:
 * - one-time purchases for real money, the price shown in full: no subscriptions and no game currency;
 * - no random boxes, and nothing that helps anyone win a game or climb a board;
 * - no countdowns or "last chance", and no words telling children to buy.
 * docs/LEGAL-READINESS.md has the reasons. Items are edited in Admin › Ads & shop; this list is where they start.
 */
export interface Product {
  id: string;
  name: string;
  blurb: string;
  /** The price in euro cents, VAT included. */
  cents: number;
  /** Shown as planned, and can't be bought yet. */
  later?: boolean;
  /** Not shown at all. Whoever bought it keeps it. */
  hidden?: boolean;
}

/** What "ad-free" means is built into the site (src/platform/adFree.ts), so that item can be hidden but not removed. */
export const AD_FREE_ID = 'ad-free';

export const PRODUCTS: Product[] = [
  {
    id: AD_FREE_ID,
    name: 'Ad-free',
    blurb: 'No ad banners on your account, on any device you sign in on, and your extra try at a daily needs no ad. One payment, no subscription.',
    cents: 199,
  },
  { id: 'look-borders', name: 'Picture borders', blurb: 'A border around your picture on your profile and on the boards.', cents: 99, later: true },
  { id: 'look-names', name: 'Name effects', blurb: 'A touch of color and shine on your nickname.', cents: 99, later: true },
  { id: 'look-banners', name: 'Profile banners', blurb: 'Art across the top of your profile.', cents: 99, later: true },
  { id: 'sigilfall-mounts', name: 'Sigilfall mounts', blurb: 'Mounts made for the shop. They look different and ride the same as any other.', cents: 299, later: true },
  { id: 'sigilfall-looks', name: 'Sigilfall wardrobe sets', blurb: 'Looks for your Wardrobe. They change how your hero looks, never what your gear does.', cents: 199, later: true },
];

export const productIn = (items: readonly Product[], id: string): Product | undefined => items.find((p) => p.id === id);

export const priceText = (cents: number): string => `€${(cents / 100).toFixed(2)}`;

/** Stripe's lowest card charge in euros, and a sane top. */
export const MIN_CENTS = 50;
export const MAX_CENTS = 9999;

/** Words the rules above forbid in an item's name or text. */
const PRESSURE = /last chance|limited time|hurry|don.t miss|only today|ends soon|buy now|loot ?box|mystery box|random|pay to win|stronger|\bcoins?\b|\bgems?\b/i;

export const breaksRules = (text: string): boolean => PRESSURE.test(text);

/** What an admin sent, as items the shop can show. Anything broken is dropped, and ad-free is always there. */
export function sanitizeProducts(v: unknown): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const raw of Array.isArray(v) ? v.slice(0, 60) : []) {
    const o = (typeof raw === 'object' && raw ? raw : {}) as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim().toLowerCase() : '';
    const name = typeof o.name === 'string' ? o.name.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    const blurb = typeof o.blurb === 'string' ? o.blurb.replace(/\s+/g, ' ').trim().slice(0, 240) : '';
    const cents = typeof o.cents === 'number' ? Math.round(o.cents) : 0;
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(id) || seen.has(id) || !name || !blurb || cents < MIN_CENTS || cents > MAX_CENTS) continue;
    if (breaksRules(`${name} ${blurb}`)) continue;
    seen.add(id);
    out.push({ id, name, blurb, cents, ...(o.later === true ? { later: true } : {}), ...(o.hidden === true ? { hidden: true } : {}) });
  }
  if (!seen.has(AD_FREE_ID)) out.unshift(PRODUCTS[0]!);
  return out;
}

/** Which version of the terms of sale a buyer agreed to. Change it with the page (src/pages/SaleTermsPage.tsx). */
export const SALE_TERMS_VERSION = '2026-11-04';

/** What the buyer ticks before going to checkout. Kept word for word with the purchase and repeated in the confirmation email. */
export const AGREE_NOW = 'I want this right away, and I understand that once I have it I lose my 14-day right to withdraw.';
export const AGREE_AGE = 'I am 18 or over, or a parent or guardian has agreed to this purchase.';
