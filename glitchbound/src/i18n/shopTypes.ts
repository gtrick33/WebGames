/**
 * The words of the shop, the checkout email, the terms of sale, the terms of use and privacy, one file per language:
 * src/i18n/shop/<code>.ts (the shop, its items and the email, which the server needs too) and src/i18n/legal/<code>.ts
 * (the three legal pages). English is the source; tests/shop-languages.test.tsx checks that every language has every
 * entry, with the same <tags> and {placeholders}.
 *
 * Rich text: <tag>words</tag> marks words the page turns into a link or bold text, and {name} is a value the page fills
 * in. Both must stay exactly as in English (translate only the words between the tags).
 */

export type Rich = string;

/** A count's words by plural category (Intl.PluralRules): "other" always, plus whichever the language uses. {n} is the count. */
export type Plural = { other: string } & Partial<Record<'zero' | 'one' | 'two' | 'few' | 'many', string>>;

export interface ShopText {
  shop: {
    title: string;
    meta: string;
    lead: string;
    adminTest: string;
    closed: string;
    thanks: string;
    vat: string;
    yours: string;
    /** <wear>…</wear>: the link to the profile */
    wear: Rich;
    /** <open>…</open>: the link to Sigilfall */
    inWardrobe: Rich;
    notYet: string;
    /** {name} */
    get: string;
    signInFirst: string;
    signInWhy: string;
    kinds: { border: string; banner: string; icon: string };
    sigilNote: string;
    planned: string;
    /** <terms>…</terms> */
    terms: Rich;
    inPack: string;
    packClass: string;
    packClassWhat: string;
    checkoutNote: string;
    already: string;
    failed: string;
    pay: string;
    cancel: string;
    /** The button on a Sigilfall item's picture that opens it turning on a stand ({name}). */
    inspect: string;
    /** Under it: how to turn it. */
    turnHint: string;
    close: string;
    /** The two statements ticked before paying, kept word for word with the purchase and repeated in the email. */
    agreeNow: string;
    agreeAge: string;
  };
  email: {
    /** {name} */
    subject: string;
    /** {name} {price} */
    thanks: string;
    receipt: string;
    /** {statement} */
    confirmed: string;
    /** {date} {url} */
    date: string;
    /** {url} */
    help: string;
  };
  /** The built-in items' names and descriptions (src/catalog/shop.ts PRODUCTS), by id. Sigilfall's own names stay in English. */
  items: Record<string, { name: string; blurb: string }>;
}

export interface LegalText {
  sale: {
    title: string;
    meta: string;
    /** {version} */
    eyebrow: string;
    /** <terms>…</terms> */
    lead: Rich;
    closed: string;
    whoH: string;
    /** {address} (", the address" or nothing), <ticket>…</ticket>, {mail} */
    who: Rich;
    whatH: string;
    what: string;
    /** <b>…</b> */
    gloam: Rich;
    /** <b>…</b> */
    adFree: Rich;
    /** <b>…</b> */
    looks: Rich;
    /** <b>…</b> */
    sigil: Rich;
    payingH: string;
    paying: string;
    withdrawH: string;
    withdraw: string;
    wrongH: string;
    /** <ticket>…</ticket>, {mail} */
    wrong: Rich;
    under18H: string;
    under18: string;
    cantH: string;
    cant: string;
    closesH: string;
    closes: string;
    disputesH: string;
    disputes: string;
  };
  terms: {
    title: string;
    meta: string;
    /** {date} */
    eyebrow: string;
    /** The date the terms last changed, in this language (with TERMS_UPDATED). */
    updated: string;
    lead: string;
    whoH: string;
    /** <ticket>…</ticket>, {mail}, {address} (addressLine, or nothing) */
    who: Rich;
    /** {address} */
    addressLine: string;
    playH: string;
    /** {buy} (buyShop or buyNone), <privacy>…</privacy> */
    play: Rich;
    buyShop: string;
    buyNone: string;
    account: string;
    fairH: string;
    fairIntro: string;
    fair: [string, string, string, string];
    fairAfter: string;
    partyH: string;
    party: string;
    adults: string;
    reportH: string;
    /** <ticket>…</ticket>, {mail} */
    report: Rich;
    adsH: string;
    ads: string;
    adsRewarded: string;
    /** <privacy>…</privacy> */
    adsData: Rich;
    buyH: string;
    /** <sale>…</sale> */
    buy: Rich;
    coinsH: string;
    coins: string;
    oursH: string;
    ours: string;
    ideas: string;
    changesH: string;
    changes: string;
    /** <profile>…</profile> */
    leave: Rich;
    lawH: string;
    law: string;
  };
  privacy: {
    title: string;
    meta: string;
    eyebrow: string;
    lead: string;
    deviceH: string;
    device: string;
    /** {rounds} {dailies} */
    now: string;
    rounds: Plural;
    dailies: Plural;
    noStorage: string;
    delete: string;
    yes: string;
    cancel: string;
    done: string;
    accountH: string;
    /** {end}: adsCookies, or "." */
    account: Rich;
    adsCookies: string;
    gm: string;
    /** <profile>…</profile> */
    deleteMe: Rich;
    deleteGuest: string;
    friendsH: string;
    friends: string;
    challengesH: string;
    /** <code>…</code> */
    challenges: Rich;
    roomsH: string;
    rooms: string;
    discord: string;
    emailH: string;
    email: string;
    reportsH: string;
    reports: string;
    analyticsH: string;
    analytics: string;
    umami: string;
    adsH: string;
    /** <choices>…</choices>, <google>…</google> */
    adsOn: Rich;
    adsRewarded: string;
    adsKids: string;
    adsOff: string;
    buyH: string;
    buy: string;
    gamesH: string;
    games: string;
    whoH: string;
    /** {address} (", the address" or nothing), {mail}, {ads} (whoAds or nothing), {stripe} (whoStripe or nothing) */
    who: Rich;
    whoAds: string;
    whoStripe: string;
    rightsH: string;
    rights: string;
    rights2: string;
    /** <ticket>…</ticket>, <terms>…</terms> */
    footer: Rich;
  };
}
