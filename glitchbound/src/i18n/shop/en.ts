import { AGREE_AGE, AGREE_NOW, PRODUCTS } from '../../catalog/shop';
import type { ShopText } from '../shopTypes';

/** English: the source every other language translates (src/i18n/shopTypes.ts has the rules). */
const en: ShopText = {
  shop: {
    title: 'Shop',
    meta: 'Optional one-time extras for GlitchBound. Every game stays free to play.',
    lead: 'Every game stays free to play. These are optional extras, each paid for once: no subscriptions, no game currency and no random boxes. Most only change how things look; the Gloamknight Pack unlocks a new class to play in Sigilfall.',
    adminTest: 'Admin test: the shop is closed to players, and you can test a purchase here.',
    closed: 'The shop isn’t open yet, so nothing can be bought right now.',
    thanks: 'Thank you. Your purchase reaches your account as soon as the payment is confirmed, usually within a minute.',
    vat: 'VAT included, paid once',
    yours: 'This is yours.',
    wear: '<wear>Wear it on your profile</wear>.',
    inWardrobe: 'It’s in the Wardrobe of every hero on your account: <open>open Sigilfall</open>.',
    notYet: 'Not on sale yet.',
    get: 'Get {name}',
    signInFirst: 'Sign in first',
    signInWhy: 'Sign in so a purchase stays with your account.',
    kinds: { border: 'Borders', banner: 'Banners', icon: 'Profile icons' },
    sigilNote: 'Mounts and Wardrobe looks for every hero on your account. They change how your hero looks and nothing else: every mount runs at the same pace, and your stats always come from what you equip.',
    planned: 'Planned',
    terms: 'See the <terms>terms of sale</terms> for your rights, refunds and who you are buying from.',
    inPack: 'In the pack',
    packClass: 'The Gloamknight',
    packClassWhat: 'Sigilfall’s eighth class, and two more hero slots',
    checkoutNote: 'VAT included. One payment, no subscription. Our payment provider, Stripe, takes the payment and sends your receipt.',
    already: 'This is already yours.',
    failed: 'The checkout could not open. Nothing was charged. Please try again.',
    pay: 'Continue to payment',
    cancel: 'Cancel',
    inspect: 'Look closer: {name}',
    turnHint: 'Drag to turn it',
    close: 'Close',
    agreeNow: AGREE_NOW,
    agreeAge: AGREE_AGE,
  },
  email: {
    subject: 'Your GlitchBound purchase: {name}',
    thanks: 'Thank you. {name} ({price}, VAT included) is on your GlitchBound account now.',
    receipt: 'Your receipt comes separately from our payment provider, Stripe, through Link.',
    confirmed: 'When you bought it you confirmed: "{statement}"',
    date: 'Date: {date}. Terms of sale: {url}',
    help: 'If something isn’t working, reply to this email or open a ticket at {url}.',
  },
  items: Object.fromEntries(PRODUCTS.map((p) => [p.id, { name: p.name, blurb: p.blurb }])),
};

export default en;
