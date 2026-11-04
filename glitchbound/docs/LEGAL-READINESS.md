# Ads and payments: what's ready, and what's left before switching on

Everything for ads and payments is built and **switched off**. Off means no ad script loads, there's no Shop tab, `/shop`
and `/terms/sale` are "not found" for players, and the Terms and Privacy pages say there are no ads and nothing to buy.
The switches are in **Admin › Ads & shop**. Turning one on also changes the legal pages to match.

This is a working checklist, **not legal advice**. Sources are at the end. Have a lawyer and an accountant look at the
items marked for them before taking money.

## How it works

**Ads**
- **Banners:** `AdSlot`, on the home page and at the bottom of a game's page. Labeled, at least 150 px from any game, never
  on an 18+ page, none for a member with the ad-free purchase. Space is reserved so the page doesn't shift. Google's script
  loads only when a slot is about to be seen.
- **Optional ads for one more try:** after a game's own daily, a button offers a short ad for one extra try. It uses Google's
  Ad Placement API, which is the only allowed way to reward an ad: the player opts in with the button, the reward comes only
  after the ad was watched, and the reward has no value outside the site. The try is unranked, so nobody climbs a board by
  watching ads. It's one per game per day. Ad-free members get the try without the ad.
- **Consent:** Google's own certified consent message (a setting in AdSense, no code). The footer gets "Ad choices" and the
  Privacy page gets a link, so a visitor can change their answer.

**Payments**
- One-time purchases only, through **Stripe Managed Payments**: Stripe, through Link, is the merchant of record. It sells to
  the player, handles VAT, sends the receipt and handles payment support.
- Before checkout, a buyer ticks two statements: they want the item right away and lose the 14-day right to withdraw, and
  they're 18 or have a parent's agreement. The agreement and the terms version are stored with the purchase, and the
  confirmation email repeats it.
- A purchase counts only when Stripe's signed webhook says it was paid (`server/shop.ts`). Saves can't grant anything. A
  refund takes it back. Deleting an account keeps the record for the accounts, no longer linked to the person.
- Items and prices are edited in **Admin › Ads & shop**: add, remove, hide, mark as planned, change a price, and the shop can be
  closed with one switch. The same page shows sales and can give an item to a player or take one back, all in the change log.
  `src/catalog/shop.ts` holds the starting list. Only **Ad-free (€1.99)** is for sale at the start; the rest are "planned".

**What may be sold** (these rules are in `src/catalog/shop.ts`): cosmetics and ad-free only. Real-money prices shown in full.
Don't add game currency, random boxes, anything that helps win, countdowns, "last chance" wording, or words telling children
to buy. Regulators in the EU have acted on exactly those.

## Before turning on banner ads
You:
- [ ] Add `glitchboundstudio.com` as a site in AdSense and wait for approval (`/ads.txt` is already live). Google can refuse a
      site with too little original text, so this isn't certain.
- [ ] Create the European regulations message in AdSense › Privacy & messaging, for the EU, UK and Switzerland.
- [ ] Create two display ad units, then set `VITE_ADSENSE_SLOT_HOME`, `VITE_ADSENSE_SLOT_GAME` and `VITE_ADS_ENABLED=on` in
      `.env.production`.
- [ ] Fill in AdSense's payment profile and tax forms. Google verifies your address by post.
- [ ] Enter your postal address in Admin › Ads & shop.
Accountant:
- [ ] How to declare ad income, and whether you must register for VAT under art. 97a of the Bulgarian VAT Act **before the
      first payment** from Google Ireland. The sources I found disagree, so ask this directly.

## Before turning on optional ads
- [ ] Everything above.
- [ ] Apply for Google's H5 Games Ads with the form on the Ad Placement API's sign-up page. Rewarded ads aren't allowed without
      this approval.

## Before opening the shop
You:
- [ ] Open a Stripe account and apply for Managed Payments (Bulgaria and video games are on its list, and it runs an
      eligibility review). **Ask Stripe in writing whether Crass Act and the After Dark cards are a problem** on the same site.
- [ ] Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Cloudflare secrets. You don't need to create products in Stripe:
      prices are set in Admin › Ads & shop, and the site creates the matching Stripe product and price at the next checkout,
      with VAT included. An accountant should confirm the tax code in `server/shop.ts` (`txcd_10000000`).
- [ ] Point a Stripe webhook at `/api/shop/webhook` for `checkout.session.completed`,
      `checkout.session.async_payment_succeeded`, `charge.refunded` and `charge.dispute.funds_withdrawn`.
- [ ] Make a test purchase and a refund in Stripe's test mode. **This has not been run against real Stripe yet.**
- [ ] Decide on the currency. The shop shows euros, and Bulgaria uses the euro since 2026.
Lawyer:
- [ ] Read `/terms/sale`, `/terms` and `/privacy` as written for the shop-open state (staff can see them while it's closed),
      especially the merchant-of-record wording against Stripe's actual contract, the 14-day waiver flow, and "lasts as long as
      GlitchBound runs" for ad-free.
- [ ] Check what you must show about yourself as a seller and on your own site (Bulgarian Electronic Commerce Act art. 4 asks
      for a name, address and contact details, including a phone number in the translation I read).
- [ ] Check what you must say about dispute resolution in Bulgaria. I couldn't verify the Commission for Consumer Protection's
      wording in `/terms/sale`. The old EU ODR link is deliberately absent, since that platform closed in July 2025.
- [ ] Whether a site with 18+ party cards and 13+ accounts is fine for these ads and sales, and whether the anonymous visit
      count needs consent (EU guidance on "cookieless" analytics leaves this open).
Accountant:
- [ ] Sole trader, company or freelance income for what Stripe pays you, and the same art. 97a question.

Me, when you say so:
- [ ] Translate the Shop, `/terms/sale`, Terms and Privacy, at least into Bulgarian. They're English only, and selling to
      people in a language they read is part of the rules. A lawyer should read the Bulgarian.
- [ ] Before selling cosmetics: design them, show them on profiles and boards, and let members choose what they wear.
- [ ] Before selling Sigilfall items: build them from art we may resell in a game. Check each pack's license first. The horse
      pack's store page says its $5.99 Source tier is the one that mentions modifying models, and you own the $4.99 Plus tier.

## Sources
- AdSense: [Program policies](https://support.google.com/adsense/answer/48182), [consent requirements](https://support.google.com/adsense/answer/13554116), [ads on game pages](https://support.google.com/adsense/answer/2768340), [Publisher Restrictions](https://support.google.com/adsense/answer/9335567)
- Rewarded ads: [placement types](https://developers.google.com/ad-placement/docs/placement-types), [adBreak](https://developers.google.com/ad-placement/apis/adbreak), [sign-up](https://developers.google.com/ad-placement/docs/signup)
- Stripe: [Managed Payments eligibility](https://docs.stripe.com/payments/managed-payments/eligibility), [how it works](https://docs.stripe.com/payments/managed-payments/how-it-works), [set-up](https://docs.stripe.com/payments/managed-payments/set-up)
- EU: [Consumer Rights Directive art. 16](https://www.legislation.gov.uk/eudr/2011/83/article/16), [CPC principles on in-game currencies, summary](https://www.reedsmith.com/en/perspectives/2025/03/qas-on-the-eu-consumer-protection-authorities-joint-guidance-paper), [ODR closure](https://www.iubenda.com/en/help/173458-discontinuation-of-the-european-online-dispute-resolution-odr-platform), [Bulgaria's digital consent age](https://gdprlocal.com/digital-age-of-consent-under-the-gdpr/)
- Bulgaria: [Electronic Commerce Act, English translation](https://www.mtc.government.bg/sites/default/files/electronic_commerce_act-en_kym_26.02.2019.pdf), [art. 97a and AdSense, one view](https://www.innovires.com/blog/oblagane-influenseri-youtube-tiktok-instagram-dac7.html)
