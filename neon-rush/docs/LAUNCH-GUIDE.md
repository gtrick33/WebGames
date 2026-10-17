# NEON RUSH launch guide

What is live today, and the exact steps for the parts that need your accounts, money or approval.

**Live now:** https://neon-rush-8aj.pages.dev (Cloudflare Pages, free plan), with the online leaderboard
(Pages Functions + D1 database `neon-rush-leaderboard`). Ads and real-money purchases are built in but off.

---

## 1. Automatic deploys: create the Cloudflare API token (about 5 minutes)

1. Open https://dash.cloudflare.com/profile/api-tokens and click **Create Token**.
2. Choose **Create Custom Token** and name it `neon-rush-ci`.
3. Permissions (all under **Account**):
   - `Cloudflare Pages` : `Edit`
   - `D1` : `Edit` (only needed if CI should run database migrations later)
4. Account resources: **Include** your account. Optionally set an expiry date.
5. Click **Continue to summary**, then **Create Token**, and copy the token. It is shown only once.
6. Find your **Account ID**: dash.cloudflare.com > Workers & Pages > right sidebar.
7. In GitHub, go to https://github.com/gtrick33/WebGames/settings/secrets/actions and click **New repository secret** twice:
   - `CLOUDFLARE_API_TOKEN` = the token
   - `CLOUDFLARE_ACCOUNT_ID` = the account id
8. Push any change to `pre-release`. The "NEON RUSH CI/CD" workflow tests, builds and deploys automatically.

Never paste the token into code, chat or commits.

---

## 2. Your own domain

Domain status checked on 2026-10-17 through the public registry (RDAP):

| Domain | Status |
| --- | --- |
| neon-rush.com, neonrush.com, playneonrush.com, neonrush.app | Already registered by someone else |
| **neonrushgame.com** | Unregistered at the .com registry (Verisign) |
| neonrush.gg, neonrush.io, neonrush.games | No registry record found; confirm at checkout |

Cheapest path is **Cloudflare Registrar**, which sells at cost (no markup) and is already where your site lives:

1. dash.cloudflare.com > **Domain Registration** > **Register Domains**, search e.g. `neonrushgame.com`, and buy it
   (you pay Cloudflare directly; .com is usually around US$10-11/year).
2. dash.cloudflare.com > **Workers & Pages** > `neon-rush` > **Custom domains** > **Set up a custom domain**,
   enter `neonrushgame.com`, then **Activate domain**. DNS is configured automatically because the domain is on Cloudflare.
3. Repeat for `www.neonrushgame.com` (or add a redirect rule from www to the apex).
4. HTTPS certificates are issued automatically (can take a few minutes).

If you buy elsewhere (Namecheap, Porkbun...), add the domain to Cloudflare as a site first (change nameservers),
then follow step 2. Google AdSense needs a domain you own (not `*.pages.dev`), so do this before step 3.

---

## 3. Ads: what to use and how

**Recommendation**

| Channel | Ad product | Why |
| --- | --- | --- |
| Your own website | **Google H5 Games Ads** (AdSense "Ad Placement API") | Google's only product built for HTML5 games, with rewarded and interstitial formats. Already integrated (`src/monetization/adsense.ts`). |
| Game portals | Their own SDK (for example CrazyGames or Poki) | They bring the players. A new game earns from traffic, and portals have it. Revenue is shared. |
| iOS / Android apps | **Google AdMob** (with mediation later) | The standard for native rewarded and interstitial ads. |

Ad income is driven by players x ad views, so distribution (portals, app stores) matters more than which network you pick.
I can't predict revenue numbers: rates vary a lot by country, season and format.

**Turning on Google H5 Games Ads**

1. Get your own domain live (section 2).
2. Create an AdSense account at https://adsense.google.com, add your domain as a site, and complete verification and payment details.
3. Apply for H5 Games Ads: https://developers.google.com/ad-placement/docs/signup (approval is not guaranteed).
4. In AdSense > **Privacy & messaging**, enable the consent message (required for players in the EEA/UK/Switzerland).
5. Once approved, copy your publisher id (`ca-pub-...`). It is public, not a secret.
6. Test first. Build with testing mode on:
   ```bash
   VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX VITE_ADSENSE_TEST=on npm run deploy
   ```
7. Go live: deploy without `VITE_ADSENSE_TEST` (or add `VITE_ADSENSE_CLIENT` as a GitHub Actions variable and pass it
   to the build step). The build automatically writes `ads.txt` with your publisher id.

What the game does with ads (already enforced in code and covered by tests):
- **Rewarded:** only when the player taps "Double coins" after a run. Coins are granted only on Google's `adViewed` callback, once per run.
- **Interstitial:** only between runs: not before the 4th run, at most every 4 runs, at least 4 minutes apart, max 3 per session. Never during a run.
- **Remove Ads:** a `no_ads` entitlement turns interstitials off.
- If the ad script is blocked or offline, the game simply runs without ads.

---

## 4. Real-money purchases (Apple and Google billing)

Important: **Apple In-App Purchase and Google Play Billing only work inside native apps**, not in a browser game.
So there are two separate tracks:

### A. Native apps (App Store / Google Play) - recommended route

1. Accounts: Apple Developer Program (US$99/year) and Google Play Console (US$25 one-time).
2. Wrap the game with Capacitor (steps in [MOBILE.md](MOBILE.md)).
3. In **App Store Connect** and **Play Console**, create in-app products with the same ids as the game catalog
   (`src/monetization/purchases.ts`): `coins_small`, `coins_large` (consumables), `bundle_night`, `no_ads` (non-consumables).
4. Use **RevenueCat** (free tier available) to talk to both stores and validate receipts on its servers:
   - create a RevenueCat project, add both apps and products, map entitlements (`no_ads`, `bundle_night`);
   - install its Capacitor SDK (`@revenuecat/purchases-capacitor`) following RevenueCat's official docs;
   - implement `PurchaseProvider` with it and only grant when RevenueCat reports the entitlement active (`verified: true`).
5. Test with Apple Sandbox / TestFlight and Google Play internal testing licence testers, then submit for review.

### B. Web (this website)

- Use Stripe Checkout (or Paddle / Lemon Squeezy, which also handle sales tax as merchant of record).
- Payments must be confirmed by a **server** webhook (a Cloudflare Pages Function, like the leaderboard) that writes the
  entitlement to D1. The game then reads entitlements from the server. Never trust the client and never put secret keys in the game.
- When you have a Stripe account, this can be added following the same pattern as `functions/api/score.ts`.

---

## 5. Online leaderboard: how it works and its limits

- Endpoints: `POST /api/run` (server-timestamped run token), `POST /api/score`, `GET /api/leaderboard?period=daily|all`.
- Anti-cheat: a run must start with a server token; the claimed run time cannot exceed real elapsed time; distance must fit the
  game's speed limits; coins, near misses and score must be consistent; each token works once; names are validated and filtered.
  Determined cheaters can still forge plausible scores (no client game is fully cheat-proof). Delete bad rows with:
  ```bash
  npx wrangler d1 execute neon-rush-leaderboard --remote --command "DELETE FROM scores WHERE name = 'BadName'"
  ```
- Players are anonymous: a random id plus the racer name they choose. No accounts, emails or IPs are stored.
- Free-plan limits (from Cloudflare docs, Oct 2026): D1 has 5M row reads/day, 100k row writes/day and 5 GB. Pages Functions
  share the Workers free quota of 100k requests/day. Static files are free and unlimited. A ranked run uses about 4 writes,
  so the free plan handles roughly 20k ranked runs per day. If a limit is hit, the leaderboard shows as offline
  until 00:00 UTC, and the game itself keeps working.
- Schema changes: add `migrations/0002_*.sql` and run `npx wrangler d1 migrations apply neon-rush-leaderboard --remote`.
