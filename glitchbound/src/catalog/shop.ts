/**
 * What the shop sells. The rules, which keep it fair and keep it legal:
 * - one-time purchases for real money, the price shown in full: no subscriptions and no game currency;
 * - no random boxes, and nothing that helps anyone win a game or climb a board;
 * - no countdowns or "last chance", and no words telling children to buy.
 * docs/LEGAL-READINESS.md has the reasons. Items are edited in Admin › Ads & shop; this list is where they start.
 */
import { sanitizeLook, type LookKind, type LookSpec } from './looks';

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
  /** A profile look (border, banner or icon) this item gives, and how it's drawn (src/catalog/looks.ts). */
  look?: LookSpec;
}

/** What "ad-free" means is built into the site (src/platform/adFree.ts), so that item can be hidden but not removed. */
export const AD_FREE_ID = 'ad-free';

/** A built-in profile look: its id is `<kind>-<style>`, drawn in the style's own colors. */
const builtInLook = (kind: LookKind, style: string, name: string, blurb: string): Product => ({ id: `${kind}-${style}`, name, blurb, cents: 50, look: { kind, style } });

const ON_BOARDS = 'on your profile and on the boards.';
const ACROSS = 'Across your profile and behind your name on the boards.';
const IN_PLACE = 'in place of your picture on your profile, in the header and on the boards.';

/** Planned items that became real ones, each look on its own. Dropped from a saved list. */
const RETIRED = new Set(['look-borders', 'look-banners']);

export const PRODUCTS: Product[] = [
  {
    id: AD_FREE_ID,
    name: 'Ad-free',
    blurb: 'No ad banners on your account, on any device you sign in on, and your extra try at a daily needs no ad. One payment, no subscription.',
    cents: 199,
  },
  builtInLook('border', 'neon-halo', 'Neon Halo border', `A ring of cyan, violet and pink light that slowly turns around your picture, ${ON_BOARDS}`),
  builtInLook('border', 'solar-flare', 'Solar Flare border', `A blazing gold and orange ring with a flickering corona, around your picture ${ON_BOARDS}`),
  builtInLook('border', 'glitch', 'Glitch border', `A ring that splits into cyan and pink and jumps out of line now and then, around your picture ${ON_BOARDS}`),
  builtInLook('border', 'frost', 'Frost border', `A ring of ice with crystal shards and drifting sparkles, around your picture ${ON_BOARDS}`),
  builtInLook('border', 'orbit', 'Orbit border', `A fine double ring with two little moons going round your picture, ${ON_BOARDS}`),
  builtInLook('border', 'crown', 'Crown border', `A gold ring set with jewels and topped with a little crown, around your picture ${ON_BOARDS}`),
  builtInLook('banner', 'sunset-grid', 'Sunset Grid banner', `A striped sun sinking behind a glowing grid that rolls toward you. ${ACROSS}`),
  builtInLook('banner', 'aurora', 'Aurora banner', `Northern lights rippling over dark mountains under a starry sky. ${ACROSS}`),
  builtInLook('banner', 'nebula', 'Nebula banner', `Drifting violet clouds, twinkling stars, a ringed planet and the odd shooting star. ${ACROSS}`),
  builtInLook('banner', 'neon-city', 'Neon City banner', `A skyline at night, its windows lit, with lights gliding past below. ${ACROSS}`),
  builtInLook('banner', 'deep-sea', 'Deep Sea banner', `Light rays through deep water, rising bubbles and swaying weed. ${ACROSS}`),
  builtInLook('banner', 'ember-field', 'Ember Field banner', `Sparks rising off a glowing ground into the night. ${ACROSS}`),
  builtInLook('icon', 'fox', 'Fox icon', `A sly fox, ${IN_PLACE}`),
  builtInLook('icon', 'owl', 'Owl icon', `A night owl that blinks now and then, ${IN_PLACE}`),
  builtInLook('icon', 'skull', 'Skull icon', `A skull with softly glowing eyes, ${IN_PLACE}`),
  builtInLook('icon', 'rocket', 'Rocket icon', `A rocket with a flickering flame, ${IN_PLACE}`),
  builtInLook('icon', 'crown', 'Crown icon', `A jeweled crown that catches the light, ${IN_PLACE}`),
  builtInLook('icon', 'bolt', 'Bolt icon', `A crackling lightning bolt, ${IN_PLACE}`),
  { id: 'look-names', name: 'Name effects', blurb: 'A touch of color and shine on your nickname.', cents: 99, later: true },
  { id: 'sigilfall-mounts', name: 'Sigilfall mounts', blurb: 'Mounts made for the shop. They look different and ride the same as any other.', cents: 299, later: true },
  { id: 'sigilfall-looks', name: 'Sigilfall wardrobe sets', blurb: 'Looks for your Wardrobe. They change how your hero looks, never what your gear does.', cents: 199, later: true },
];

export const productIn = (items: readonly Product[], id: string): Product | undefined => items.find((p) => p.id === id);

/**
 * Items whose meaning is built into the site: ad-free and the looks above. They can be hidden, not removed, and keep
 * the look the code gives them. Looks an admin makes are ordinary items that carry a look.
 */
export const isBuiltIn = (id: string): boolean => id === AD_FREE_ID || PRODUCTS.some((p) => p.id === id && !!p.look);

export const priceText = (cents: number): string => `€${(cents / 100).toFixed(2)}`;

/** Stripe's lowest card charge in euros, and a sane top. */
export const MIN_CENTS = 50;
export const MAX_CENTS = 9999;

/** Words the rules above forbid in an item's name or text. */
const PRESSURE = /last chance|limited time|hurry|don.t miss|only today|ends soon|buy now|loot ?box|mystery box|random|pay to win|stronger|\bcoins?\b|\bgems?\b/i;

export const breaksRules = (text: string): boolean => PRESSURE.test(text);

/** What an admin sent, as items the shop can show. Anything broken is dropped, and the built-in items are always there. */
export function sanitizeProducts(v: unknown): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const raw of Array.isArray(v) ? v.slice(0, 60) : []) {
    const o = (typeof raw === 'object' && raw ? raw : {}) as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim().toLowerCase() : '';
    const name = typeof o.name === 'string' ? o.name.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    const blurb = typeof o.blurb === 'string' ? o.blurb.replace(/\s+/g, ' ').trim().slice(0, 240) : '';
    const cents = typeof o.cents === 'number' ? Math.round(o.cents) : 0;
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(id) || seen.has(id) || RETIRED.has(id) || !name || !blurb || cents < MIN_CENTS || cents > MAX_CENTS) continue;
    if (breaksRules(`${name} ${blurb}`)) continue;
    seen.add(id);
    // a built-in look is drawn as the code says; an admin's look must be one the site can draw
    const look = isBuiltIn(id) ? PRODUCTS.find((p) => p.id === id)?.look : sanitizeLook(o.look);
    out.push({ id, name, blurb, cents, ...(o.later === true ? { later: true } : {}), ...(o.hidden === true ? { hidden: true } : {}), ...(look ? { look } : {}) });
  }
  if (!seen.has(AD_FREE_ID)) out.unshift(PRODUCTS[0]!);
  // a look added to the site after the list was saved joins it, after the looks already there
  const missing = PRODUCTS.filter((p) => p.look && !seen.has(p.id));
  if (missing.length) {
    const at = out.reduce((last, p, i) => (isBuiltIn(p.id) ? i + 1 : last), 0);
    out.splice(at, 0, ...missing);
  }
  return out;
}

/** Which version of the terms of sale a buyer agreed to. Change it with the page (src/pages/SaleTermsPage.tsx). */
export const SALE_TERMS_VERSION = '2026-11-04';

/** What the buyer ticks before going to checkout. Kept word for word with the purchase and repeated in the confirmation email. */
export const AGREE_NOW = 'I want this right away, and I understand that once I have it I lose my 14-day right to withdraw.';
export const AGREE_AGE = 'I am 18 or over, or a parent or guardian has agreed to this purchase.';
