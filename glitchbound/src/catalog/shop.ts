/**
 * What the shop sells. The rules, which keep it fair and keep it legal:
 * - one-time purchases for real money, the price shown in full: no subscriptions and no game currency;
 * - no random boxes, and nothing that makes a player stronger than another who plays the same way. The one item that
 *   changes how a game plays is the Gloamknight, a Sigilfall class sold on its own (the owner's choice, 2026-11-05):
 *   it adds a way to play and is balanced with the free classes;
 * - no countdowns or "last chance", and no words telling children to buy.
 * docs/LEGAL-READINESS.md has the reasons. Items are edited in Admin › Ads & shop; this list is where they start.
 */
import { sanitizeLook, type LookKind, type LookSpec } from './looks';
import { sanitizeSigil, sigilSetOf, type SigilBody, type SigilGlow, type SigilSet, type SigilSlot, type SigilSpec } from './sigilItems';

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
  /** A Sigilfall mount or Wardrobe look this item gives, and how the game draws it (src/catalog/sigilItems.ts). */
  sigil?: SigilSpec;
  /** Items this one gives too: a pack (the Gloamknight Pack). Built-in packs only. */
  includes?: string[];
}

/** What "ad-free" means is built into the site (src/platform/adFree.ts), so that item can be hidden but not removed. */
export const AD_FREE_ID = 'ad-free';

/** A built-in profile look: its id is `<kind>-<style>`, drawn in the style's own colors. */
const builtInLook = (kind: LookKind, style: string, name: string, blurb: string): Product => ({ id: `${kind}-${style}`, name, blurb, cents: 50, look: { kind, style } });

/** The Gloamknight, Sigilfall's eighth class: playing it needs this item (src/games/sigilfall/progress/paidClasses.ts). */
export const GLOAMKNIGHT_ITEM = 'sigilfall-gloamknight';

const ON_BOARDS = 'on your profile and on the boards.';
const ACROSS = 'Across your profile and behind your name on the boards.';
const IN_PLACE = 'in place of your picture on your profile, in the header and on the boards.';

const RIDES = 'For every hero on your account. Only a look: it rides at the pace every mount does.';
const WEARS = 'Any class wears it, over any gear, from the Wardrobe. Only a look: your stats come from what you equip.';

/** A built-in Sigilfall mount (src/games/sigilfall/progress/shopGoods.ts gives it its lore in the game). */
const sigilMount = (id: string, name: string, cents: number, blurb: string, body: SigilBody, colors: { coat: string; mane: string; tack: string; plate: string }, extras: string[], glow: [SigilGlow, string]): Product => ({
  id: `sigilfall-${id}`,
  name,
  blurb: `${blurb} ${RIDES}`,
  cents,
  sigil: { kind: 'mount', body, ...colors, extras, glow: { kind: glow[0], color: glow[1] } },
});

/** A built-in Sigilfall look: one piece of one of the shop's armor sets, in the set's own colors. */
const sigilLook = (id: string, name: string, cents: number, blurb: string, set: SigilSet, slot: SigilSlot): Product => ({
  id: `sigilfall-${id}`,
  name,
  blurb: `${blurb} ${WEARS}`,
  cents,
  sigil: { kind: 'look', slot, set, colors: [...sigilSetOf(set)!.colors] },
});

/** Planned items that became real ones, each on its own. Dropped from a saved list. */
const RETIRED = new Set(['look-borders', 'look-banners', 'sigilfall-mounts', 'sigilfall-looks']);

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
  // Sigilfall: the drake is the one piece of the shop with the most built for it, and costs the most
  sigilMount(
    'crownforged-wyrm',
    'Crownforged Wyrm',
    299,
    'A Sigilfall drake in black plate edged with gold, under a crown of horns, its wings veined with molten light, its tail ablaze.',
    'drake',
    { coat: '#2a2632', mane: '#5a1a30', tack: '#1a1620', plate: '#5c5870' },
    ['plates', 'crown', 'veins', 'runes', 'flametail'],
    ['embers', '#ffb43a'],
  ),
  sigilMount(
    'galecrest-drake',
    'Galecrest Drake',
    199,
    'A storm-blue Sigilfall drake with a crest of horns, crystal spines down its back and lightning in its wings.',
    'drake',
    { coat: '#1f3c66', mane: '#a8dcff', tack: '#121c34', plate: '#cfe8ff' },
    ['crown', 'crystals', 'veins'],
    ['sparks', '#7af0ff'],
  ),
  sigilMount(
    'runetusk-boar',
    'Runetusk War-Boar',
    199,
    'A Sigilfall war-boar in spiked plate and a horned helm, its tusks banded with runes that glow.',
    'boar',
    { coat: '#3a3036', mane: '#161214', tack: '#1c3638', plate: '#5c6474' },
    ['plates', 'helm', 'rune-tusks', 'runes'],
    ['motes', '#5affd8'],
  ),
  sigilMount(
    'cinderhorn-hart',
    'Cinderhorn Hart',
    149,
    'A charcoal Sigilfall hart whose antlers are living flame, with ember runes along its flanks.',
    'deer',
    { coat: '#262124', mane: '#3a2c28', tack: '#6a1c14', plate: '#3a3034' },
    ['flame-antlers', 'runes'],
    ['flames', '#ff8a2a'],
  ),
  sigilMount(
    'moonglass-hart',
    'Moonglass Hart',
    149,
    'A white Sigilfall hart with antlers of glowing crystal, plate edged with light and pale runes, starlight round its hooves.',
    'deer',
    { coat: '#e6ecf6', mane: '#b4c4e4', tack: '#28386e', plate: '#5a6ea4' },
    ['crystal-antlers', 'plates', 'runes'],
    ['stars', '#bfe4ff'],
  ),
  sigilLook('crownforged-helm', 'Crownforged Helm', 99, 'A Sigilfall helm of black steel under a crown of gold, with dragon horns and a burning visor.', 'crownforged', 'head'),
  sigilLook('crownforged-plate', 'Crownforged Plate', 149, 'Sigilfall armor of black plate seamed with molten gold, with drake-wing pauldrons and a crimson cape.', 'crownforged', 'chest'),
  sigilLook('celestine-crown', 'Celestine Crown', 99, 'A silver Sigilfall circlet with a crescent moon, under a ring of stars that turns.', 'celestine', 'head'),
  sigilLook('celestine-mantle', 'Celestine Mantle', 149, 'A white and silver Sigilfall robe with crescent pauldrons and a cape of night full of stars.', 'celestine', 'chest'),
  sigilLook('gloamquill-cowl', 'Gloamquill Cowl', 99, 'A dark Sigilfall hood with a beaked mask, a crest of feathers and two eyes that glow.', 'gloamquill', 'head'),
  sigilLook('gloamquill-mantle', 'Gloamquill Mantle', 149, 'Sigilfall leathers under a mantle of black feathers, with a long cape of feathers behind.', 'gloamquill', 'chest'),
  { id: 'look-names', name: 'Name effects', blurb: 'A touch of color and shine on your nickname.', cents: 99, later: true },
  // the Gloamknight Pack: the class, and things made for it that come only with it (hidden: not sold on their own)
  {
    id: GLOAMKNIGHT_ITEM,
    name: 'Gloamknight Pack',
    blurb: 'Sigilfall’s eighth class, the Gloamknight, for your account, with the Duskborn helm and armor, the Gloamwing Drake, the Gloam border and banner, and two more hero slots.',
    cents: 499,
    includes: ['sigilfall-duskborn-helm', 'sigilfall-duskborn-plate', 'sigilfall-gloamwing-drake', 'border-gloam', 'banner-gloam'],
  },
  {
    ...sigilLook('duskborn-helm', 'Duskborn Helm', 99, 'A Sigilfall helm of black steel under a crown of dusk, with horns and a visor that burns violet.', 'crownforged', 'head'),
    sigil: { kind: 'look', slot: 'head', set: 'crownforged', colors: ['#1c1826', '#8a5cc8', '#3a1450', '#c86aff'] },
    hidden: true,
  },
  {
    ...sigilLook('duskborn-plate', 'Duskborn Plate', 149, 'Sigilfall armor of black plate seamed with violet light, with drake-wing pauldrons and a cape the color of dusk.', 'crownforged', 'chest'),
    sigil: { kind: 'look', slot: 'chest', set: 'crownforged', colors: ['#1c1826', '#8a5cc8', '#3a1450', '#c86aff'] },
    hidden: true,
  },
  {
    ...sigilMount(
      'gloamwing-drake',
      'Gloamwing Drake',
      299,
      'A Sigilfall drake the color of the last light, in dusk-violet plate under a crown of horns, its wings veined with pale violet fire.',
      'drake',
      { coat: '#1c1426', mane: '#3a1450', tack: '#2a1a36', plate: '#4a3a5e' },
      ['plates', 'crown', 'veins', 'runes'],
      ['motes', '#c86aff'],
    ),
    hidden: true,
  },
  {
    id: 'border-gloam',
    name: 'Gloam border',
    blurb: `A corona of dusk violet that flickers round your picture, ${ON_BOARDS}`,
    cents: 50,
    hidden: true,
    look: { kind: 'border', style: 'solar-flare', colors: ['#2a0a3a', '#6b2a8a', '#c86aff', '#ffd6f5'] },
  },
  {
    id: 'banner-gloam',
    name: 'Gloam banner',
    blurb: `Rose and violet light rippling over dark hills at dusk. ${ACROSS}`,
    cents: 50,
    hidden: true,
    look: { kind: 'banner', style: 'aurora', colors: ['#ff6aa8', '#8b5cff', '#1a0b2e', '#2a1446'] },
  },
];

/** What a member's purchases give them: each item, and what a pack they bought includes. */
export function withIncluded(ids: readonly string[], items: readonly Product[] = PRODUCTS): string[] {
  const out = new Set(ids);
  for (const id of ids) for (const x of items.find((p) => p.id === id)?.includes ?? []) out.add(x);
  return [...out];
}

export const productIn = (items: readonly Product[], id: string): Product | undefined => items.find((p) => p.id === id);

/**
 * Items whose meaning is built into the site: ad-free, the looks and the Sigilfall items above. They can be hidden, not
 * removed, and keep the look the code gives them. Looks and Sigilfall items an admin makes are ordinary items that
 * carry one.
 */
export const isBuiltIn = (id: string): boolean => id === AD_FREE_ID || id === GLOAMKNIGHT_ITEM || PRODUCTS.some((p) => p.id === id && (!!p.look || !!p.sigil));

/**
 * Whether the shop shows an item: not hidden, and ad-free only while banner ads are switched on (Admin › Ads & shop):
 * with no ads to remove there is nothing to sell. Whoever bought it keeps it either way.
 */
export const offered = (p: Product, money: { ads: boolean }): boolean => !p.hidden && (p.id !== AD_FREE_ID || money.ads);

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
    // a built-in look is drawn as the code says; an admin's look (or Sigilfall item) must be one the site can draw
    const builtIn = isBuiltIn(id) ? PRODUCTS.find((p) => p.id === id) : undefined;
    const look = builtIn ? builtIn.look : sanitizeLook(o.look);
    const sigil = builtIn ? builtIn.sigil : look ? null : sanitizeSigil(o.sigil);
    out.push({ id, name, blurb, cents, ...(o.later === true ? { later: true } : {}), ...(o.hidden === true ? { hidden: true } : {}), ...(look ? { look } : {}), ...(sigil ? { sigil } : {}), ...(builtIn?.includes ? { includes: builtIn.includes } : {}) });
  }
  if (!seen.has(AD_FREE_ID)) out.unshift(PRODUCTS[0]!);
  // a look added to the site after the list was saved joins it, after the looks already there
  const missing = PRODUCTS.filter((p) => p.id !== AD_FREE_ID && isBuiltIn(p.id) && !seen.has(p.id));
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
