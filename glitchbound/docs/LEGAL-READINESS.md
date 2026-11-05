# Ads and payments: what's ready, and what's left before switching on

Everything for ads and payments is built and **switched off**. Off means no ad script loads, there's no Shop tab and nothing
can be bought, and the Terms and Privacy pages say there are no ads and nothing to buy. `/shop` and `/terms/sale` can be read
by their address, say the shop isn't open, and are hidden from search and linked from nowhere, because Stripe's reviewers must
see what's sold without a password. The switches are in **Admin › Ads & shop**. Turning one on changes the legal pages to match.

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
  `src/catalog/shop.ts` holds the starting list. For sale at the start: **Ad-free (€1.99)**, three **picture borders** and
  three **profile banners** (€0.50 each, the lowest price Stripe can charge in euros). The rest are "planned".
- **Borders and banners** (`src/catalog/looks.ts`, drawn by `src/components/Looks.css`): a member picks one of each they own, or
  none, under Your looks on their profile. The border goes around their picture and the banner across their player card, and
  both show on every leaderboard and in the Hall of Fame. Boards show the border around the player's initial, never their
  photo, so they still show only a nickname, a level and what the player chose to wear (`/privacy` says so). A look shows only
  while its purchase is paid: a refund takes it off everywhere.

**What may be sold** (these rules are in `src/catalog/shop.ts`): cosmetics and ad-free, plus one class, the **Gloamknight**
(€4.99), a Sigilfall class sold on its own by the owner's choice (2026-11-05). It's a different way to play, balanced with
the seven free classes, and the shop, `/terms/sale` and the admin page say plainly that it's the one item that changes how a
game plays. Real-money prices shown in full. Don't add game currency, random boxes, anything that makes a player stronger,
countdowns, "last chance" wording, or words telling children to buy. Regulators in the EU have acted on exactly those.
- **How the class is locked** (`src/games/sigilfall/progress/paidClasses.ts`): making a Gloamknight, playing one and picking
  it in the Vigil and the Ring all need the purchase; admins can always, to test. The game asks the account each time, never
  the save, so a refund locks it again and the hero waits, kept. Bots in the Ring can still be Gloamknights.

## Connecting Stripe, step by step
1. **Create the account:** [dashboard.stripe.com/register](https://dashboard.stripe.com/register). Website:
   `https://glitchboundstudio.com`. Describe only what's really for sale: right now, optional one-time digital extras for a free
   browser games site, delivered instantly: a €1.99 upgrade that removes ads, and cosmetic picture borders and profile banners.
   If the account was opened describing only ad-free, update the business description in Stripe's settings before selling the
   looks. Give a support email. These pages are what Stripe's reviewers look at: [/shop](https://glitchboundstudio.com/shop) (what's sold and the price),
   [/terms/sale](https://glitchboundstudio.com/terms/sale) (refunds and disputes), [/contact](https://glitchboundstudio.com/contact),
   [/privacy](https://glitchboundstudio.com/privacy), [/terms](https://glitchboundstudio.com/terms).
2. **Turn on Managed Payments:** [its settings page](https://dashboard.stripe.com/settings/managed-payments) ([guide](https://docs.stripe.com/payments/managed-payments/set-up)). Ask Stripe about Crass Act here.
3. **Get a test key:** [test API keys](https://dashboard.stripe.com/test/apikeys). A restricted key is safest, with write access to
   Products, Prices and Checkout Sessions, and nothing else. **Don't paste keys in chat.**
4. **Add the webhook in test mode:** [test webhooks](https://dashboard.stripe.com/test/webhooks) > **Create an event destination** >
   **Your account** > payload **Snapshot** (not Thin: the site reads the snapshot) > the events below > **Webhook endpoint**. Address:
   `https://glitchboundstudio.com/api/shop/webhook`. Events: `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.funds_withdrawn`. Copy its signing secret.
5. **Give both to the site as secrets:** Cloudflare > **Workers & Pages** > **glitchbound** > **Settings** > **Variables and
   Secrets** > **Add** > Type **Secret**, for **Production**. Names: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Or, from
   `glitchbound/`: `npx wrangler pages secret put STRIPE_SECRET_KEY --project-name=glitchbound`.
6. **Redeploy,** because secrets apply to new deployments: GitHub > Actions > **GlitchBound CI/CD** > **Run workflow** (`pre-release`).
7. **Test it, signed in as an admin:** open `/shop`, tick both statements, pay with Stripe's test card `4242 4242 4242 4242`. Ad-free
   should reach your account within a minute, and Admin › Ads & shop lists it as a test purchase. Refund it in Stripe and it should
   leave your account. Use **Take back** for anything left over.
8. **Go live:** repeat steps 3 to 6 with the [live keys](https://dashboard.stripe.com/apikeys) and [live webhooks](https://dashboard.stripe.com/webhooks).
   Test and live are kept apart, so nothing carries over. Stripe prices appear by themselves at the first checkout.

Keys only make the checkout possible: players still can't buy until the shop's switch is on.

## Connecting AdSense, step by step
1. **Add the site:** [adsense.google.com](https://adsense.google.com) > **Sites** > **Add site** > `glitchboundstudio.com`
   ([help](https://support.google.com/adsense/answer/12169212)). Your account's publisher id is already the one in `/ads.txt`.
2. **Connect it with the ads.txt method** ([help](https://support.google.com/adsense/answer/7584263)): the file is already live at
   [/ads.txt](https://glitchboundstudio.com/ads.txt), so there's nothing to add to the site.
3. **Finish your account's setup tasks** (payment details and so on), or Google won't review the site, then **Request review**.
   It usually takes days and can take 2 to 4 weeks.
4. **Create the consent message:** AdSense > **Privacy & messaging** > **European regulations** > **Create**
   ([help](https://support.google.com/adsense/answer/10960768)). Turn **Do not consent** on, and give
   `https://glitchboundstudio.com/privacy` as the privacy policy. It only shows on the site once banners are on.
5. **The two display ad units are made,** and their ids are in `.env.production`: Home banner `4798011937`, Game page banner
   `5177285880`. With those in the build, banners are still off until the switch in Admin › Ads & shop.
6. **Once Sites says Ready and the message is published:** turn banners on in Admin › Ads & shop.
7. **For optional ads:** apply at [Google's sign-up page](https://developers.google.com/ad-placement/docs/signup).

## Before turning on banner ads
You:
- [ ] Do the AdSense steps above. Google can refuse a site with too little original text, so approval isn't certain.
- [ ] Create the European regulations message in AdSense › Privacy & messaging, for the EU, UK and Switzerland.
- [x] Create two display ad units, and set `VITE_ADSENSE_SLOT_HOME`, `VITE_ADSENSE_SLOT_GAME` and `VITE_ADS_ENABLED=on` in
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
- [ ] Do the Stripe steps above. Bulgaria and video games are on Managed Payments' list, and it runs an eligibility review.
      **Ask Stripe in writing whether Crass Act and the After Dark cards are a problem** on the same site.
- [x] Make a test purchase and a refund in Stripe's test mode. Done 2026-11-05: the payment and the refund both reached the site. You don't need to
      create products in Stripe: prices are set in Admin › Ads & shop, and the site creates the matching Stripe product and price at
      the next checkout, with VAT included. An accountant should confirm the tax code in `server/shop.ts` (`txcd_10000000`).
- [ ] Decide on the currency. The shop shows euros, and Bulgaria uses the euro since 2026.
Lawyer:
- [ ] The paid Gloamknight class: a paid class is playable in the Ring, whose results reach the boards. Check that selling it
      fits EU consumer rules on in-game purchases (the Unfair Commercial Practices Directive and the CPC network's guidance on
      in-game purchases) and the wording in `/terms/sale` ("a different way to play, … not a stronger one"), and whether the Ring's
      ladder should separate or mark it.
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
- [x] Before selling cosmetics: design them, show them on profiles and boards, and let members choose what they wear. Done for
      borders and banners. Name effects are still planned.
- [ ] Before selling Sigilfall items: build them from art we may resell in a game. Check each pack's license first. The horse
      pack's store page says its $5.99 Source tier is the one that mentions modifying models, and you own the $4.99 Plus tier.

## Sources
- AdSense: [Program policies](https://support.google.com/adsense/answer/48182), [consent requirements](https://support.google.com/adsense/answer/13554116), [ads on game pages](https://support.google.com/adsense/answer/2768340), [Publisher Restrictions](https://support.google.com/adsense/answer/9335567)
- Rewarded ads: [placement types](https://developers.google.com/ad-placement/docs/placement-types), [adBreak](https://developers.google.com/ad-placement/apis/adbreak), [sign-up](https://developers.google.com/ad-placement/docs/signup)
- Stripe: [what a business website must show](https://support.stripe.com/questions/business-website-for-account-activation-faq), [Managed Payments eligibility](https://docs.stripe.com/payments/managed-payments/eligibility), [how it works](https://docs.stripe.com/payments/managed-payments/how-it-works), [set-up](https://docs.stripe.com/payments/managed-payments/set-up)
- EU: [Consumer Rights Directive art. 16](https://www.legislation.gov.uk/eudr/2011/83/article/16), [CPC principles on in-game currencies, summary](https://www.reedsmith.com/en/perspectives/2025/03/qas-on-the-eu-consumer-protection-authorities-joint-guidance-paper), [ODR closure](https://www.iubenda.com/en/help/173458-discontinuation-of-the-european-online-dispute-resolution-odr-platform), [Bulgaria's digital consent age](https://gdprlocal.com/digital-age-of-consent-under-the-gdpr/)
- Bulgaria: [Electronic Commerce Act, English translation](https://www.mtc.government.bg/sites/default/files/electronic_commerce_act-en_kym_26.02.2019.pdf), [art. 97a and AdSense, one view](https://www.innovires.com/blog/oblagane-influenseri-youtube-tiktok-instagram-dac7.html)
