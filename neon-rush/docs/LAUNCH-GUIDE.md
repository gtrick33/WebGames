# NEON RUSH launch guide

What is live today, and the exact steps for the parts that need your accounts, money or approval.

**Live now:** https://neon-rush-8aj.pages.dev (Cloudflare Pages, free plan), with the online leaderboard
(Pages Functions + D1 database `neon-rush-leaderboard`). Ads and real-money purchases are built in but off.

---

## 1. Automatic deploys: create the Cloudflare API token (about 10 minutes)

Goal: every time code is pushed to `pre-release`, GitHub builds the game and puts it online by itself.
GitHub needs two things from Cloudflare: a **token** (a password that can only deploy this site) and your **Account ID**.

### Part A: make the token on Cloudflare

1. Go to https://dash.cloudflare.com/profile/api-tokens (log in if asked).
2. Click the blue **Create Token** button.
3. Scroll down to **Custom token** ("Create Custom Token") and click **Get started**. Do NOT pick a template.
4. **Token name**: type `neon-rush-github`.
5. **Permissions**: there is one row with three dropdowns. Set it to:
   `Account` | `Cloudflare Pages` | `Edit`
6. Click **+ Add more** to get a second row, and set it to:
   `Account` | `D1` | `Edit`
   (This lets the deploy keep the leaderboard database connected.)
7. **Account Resources**: two dropdowns. Set them to `Include` | `Savawow99@gmail.com's Account`.
8. **Zone Resources**: if this section appears, leave it alone. Your permissions are account-level, so it doesn't matter.
9. **Client IP Address Filtering**: leave it **empty**. GitHub's computers change IP addresses every run;
   if you fill this in, deploys will fail.
10. **TTL**: leave it **empty**, so the token never expires. If you set an end date, deploys stop on that date until you make a new token.
11. Click **Continue to summary**. The summary must say: *Account - Cloudflare Pages: Edit, D1: Edit* for your account.
12. Click **Create Token**.
13. You now see a long secret that starts with `cfut_`. Click **Copy**. **It is shown only once.** Keep the tab open until Part B is done.
    If you lose it, delete the token and make a new one. Never paste it in chat, email or code.

### Part B: give GitHub the token and the Account ID

1. Go to https://github.com/gtrick33/WebGames/settings/secrets/actions
   (or: repo page > **Settings** tab at the top > left sidebar **Secrets and variables** > **Actions**).
2. Click the green **New repository secret** button.
3. **Name**: `CLOUDFLARE_API_TOKEN` (exactly like that, capital letters and underscores).
   **Secret**: paste the `cfut_...` token. Click **Add secret**.
4. Click **New repository secret** again.
5. **Name**: `CLOUDFLARE_ACCOUNT_ID`
   **Secret**: `fb3fbf1e569389f5a43c4c57be68d8e1` (your Account ID, from Cloudflare). Click **Add secret**.
6. You should now see both names in the list. GitHub hides the values, which is normal.

### Part C: check that it works

1. Go to https://github.com/gtrick33/WebGames/actions
2. On the left, click **NEON RUSH CI/CD**.
3. On the right, click **Run workflow**, make sure the branch says `pre-release`, then click the green **Run workflow**.
4. Wait about 2 minutes. A green check means it worked. Click the run, then the job, and the step
   **Deploy to Cloudflare Pages** should show "Deployment complete!".
   A red X means something is wrong: open the failed step, and the error message says why
   (usually a typo in a secret name, or a missing permission row).

From now on, every push to `pre-release` deploys automatically.

---

## 2. Your own domain (about 15 minutes + up to an hour of waiting)

Goal: players type `neonrushgame.com` instead of `neon-rush-8aj.pages.dev`. Google ads also need a real domain.

Domain status checked on 2026-10-17 through the public registry (RDAP):

| Domain | Status |
| --- | --- |
| neon-rush.com, neonrush.com, playneonrush.com, neonrush.app | Taken by someone else |
| **neonrushgame.com** | Free at the .com registry (Verisign). Recommended. |
| neonrush.gg, neonrush.io, neonrush.games | No record found; the search in step A3 gives the final answer |

The steps below use `neonrushgame.com`. Swap in your own name if you pick another.

### Part A: buy the domain on Cloudflare (it sells at cost, with no markup)

1. **Check your email is verified.** Cloudflare won't sell domains to unverified accounts. If the dashboard shows a yellow
   "verify your email" banner, click it and follow the link in your inbox.
2. Go to https://dash.cloudflare.com, open the left menu, click **Domain Registration**, then **Register Domains**.
3. Type `neonrushgame` in the search box and click **Search**.
4. Next to `neonrushgame.com`, click **Purchase**. (If it says unavailable, someone just bought it; pick another from the list.)
5. **Payment option** dropdown: choose **1 year**. You can extend later, and auto-renew is on by default.
6. **Contact form**: fill in your real First Name, Last Name, Email, Phone (pick the country code first, digits only),
   Address 1, City, State, Country and Postal Code. Organization, Address 2 and Ext can stay empty.
   Use plain English letters only (no accents such as ä or č). Registries require real contact details, but Cloudflare hides
   your personal data from the public WHOIS lookup wherever the registry allows it.
7. **Payment**: add a card or PayPal (or it's prefilled if you already have billing set up).
8. Read the agreements, then click **Complete purchase**. It takes about 30 seconds.
   You'll get a confirmation email, and the domain appears under **Domain Registration > Manage Domains**.

### Part B: connect the domain to the game

1. Left menu > **Workers & Pages** > click the **neon-rush** project.
2. Click the **Custom domains** tab, then **Set up a domain** (it may also say "Set up a custom domain").
3. Type `neonrushgame.com` (no `https://`, no `www`) and click **Continue**.
4. Cloudflare shows the DNS record it will create. Click the button to confirm/activate it.
   You don't type any DNS records yourself. **Don't add records by hand first**, because that causes a "522" error.
5. The status shows **Initializing**, then **Active**, usually within a few minutes (sometimes up to an hour) while the
   HTTPS certificate is issued. Then open https://neonrushgame.com and the game should load.
6. Repeat steps 2-5 with `www.neonrushgame.com`, so the `www` address works too.

### Part C (optional): send www to the main address

So that Google and players only ever see one address:

1. Left menu > **Websites** > click **neonrushgame.com** > **Rules** > **Overview**.
2. Click **Create rule** > **Redirect Rule**. If there's a template called "Redirect from WWW to root", pick it and skip to step 6.
3. **Rule name**: `www to root`.
4. **When incoming requests match**: choose **Wildcard pattern**. **Request URL**: `https://www.neonrushgame.com/*`
5. **Then**: **Target URL** `https://neonrushgame.com/${1}`, **Status code** `301`, and tick **Preserve query string**.
6. Click **Deploy**.

### If something goes wrong

- **"522" error**: you added a DNS record before step B2. Delete that record (Websites > your domain > DNS > Records), then redo Part B.
- **Stuck on "Initializing" for over an hour**: Websites > your domain > SSL/TLS > Edge Certificates and check that
  nothing is blocked. Then remove the domain from the Custom domains tab and add it again.
- **The old `*.pages.dev` address keeps working.** That's normal and harmless.

---

## 3. Ads: what to use and how (Google H5 Games Ads)

### Which ads, and why

| Where the game runs | Use | Why |
| --- | --- | --- |
| Your website | **Google H5 Games Ads** (part of AdSense) | Google's ad product made specifically for browser games: rewarded videos + between-level ads. **Already built into the game.** |
| Game portals (CrazyGames, Poki, etc.) | The portal's own SDK | They bring millions of players and share the ad money. A new game's biggest problem is getting players, not the ad network. |
| iPhone / Android apps | **Google AdMob** | The standard for app ads. Needs the app version first (section 4). |

Honest expectations: ad money is roughly *number of players x ads they watch*. It varies a lot by country and season,
so I can't promise a figure. Getting the game in front of players matters most.

### Part A: create the AdSense account (needs your own domain from section 2 live first)

You must be the one to sign up: it's tied to your identity, your bank and your taxes.

1. Go to https://adsense.google.com/adsense/signup and sign in with a Google account you'll keep long-term.
2. **Your site**: type `neonrushgame.com`.
3. Choose whether to receive AdSense emails (optional), pick your **Country or territory** (where you live, which affects
   payments and tax), tick the terms, and click **Start using AdSense**.
4. On the home page, finish the three setup cards:
   - **Enter your payment information**: your legal name and address as on your bank or ID. (Bank details come later,
     once you've earned enough. Since June 2026 Google may also ask you to **verify your identity** with an ID document.)
   - **Connect your site to AdSense**: see Part B.
   - The ad preview card is optional, so skip it.

### Part B: prove you own the site, and request review

1. In AdSense, left menu > **Sites** > **+ New site**, type `neonrushgame.com`, click **Save** (skip this if it's already listed).
2. Choose the verification method **Ads.txt snippet**. AdSense shows a line like
   `google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0`.
   The number after `pub-` is your **publisher id**. Your game uses it as `ca-pub-1234567890123456`.
3. **Send me that publisher id** (it's public, not a secret). I'll rebuild the game with it, and the build automatically
   publishes `https://neonrushgame.com/ads.txt` containing exactly that line, with ads still switched off for players.
   (Or do it yourself: `VITE_ADSENSE_CLIENT=ca-pub-YOURNUMBER npm run deploy` inside `neon-rush/`. The id alone only
   publishes ads.txt. Ads stay off until `VITE_ADS_ENABLED=on` is also set in Part E.)
4. Open https://neonrushgame.com/ads.txt in your browser and check you see that one line.
5. Back in AdSense, tick **I've placed the code**, then click **Verify**.
6. Click **Request review**. Google says this usually takes a few days, sometimes 2-4 weeks. You'll get an email.
7. If it then asks you to choose a **consent management platform (CMP)**, choose **Google's CMP** (the
   "3 choices" option if offered) and click **Submit**. That gives you the consent popup for Europe.

### Part C: apply for H5 Games Ads (the game-specific part)

Normal AdSense alone isn't enough for full-screen game ads. You need this extra approval:

1. Open https://adsense.google.com/start/h5-beta/?src=devsite
2. Fill in the form: your AdSense publisher id, the game URL (`https://neonrushgame.com`), and a short description
   (for example "NEON RUSH, an endless neon arcade racer for desktop and mobile browsers").
3. Submit. Approval isn't guaranteed and you'll hear back by email. Google requires an approved AdSense account (Part B)
   before it shows any ads.

### Part D: the Europe consent popup (required for players in the EU, UK and Switzerland)

1. In AdSense, left menu > **Privacy & messaging**.
2. Under **European regulations**, click **Create message** (or **Manage** > **Create**).
3. Select your site `neonrushgame.com`, keep the default language (add others if you like), and under user choices keep
   **Consent**, **Do not consent** and **Manage options**.
4. Optionally add your logo, then click **Publish**.
   Google's own consent message is certified, so you don't need any other consent tool. The game needs no code change,
   because Google's script shows the popup automatically.

### Part E: switch ads on

1. When the H5 Games Ads approval email arrives, tell me. I'll do a **test build** first (Google's test ads, which earn nothing):
   `VITE_ADSENSE_CLIENT=ca-pub-YOURNUMBER VITE_ADS_ENABLED=on VITE_ADSENSE_TEST=on npm run deploy`
   so we can check rewarded and between-run ads behave correctly.
2. Then the real build, the same command without `VITE_ADSENSE_TEST=on`. From then on Google serves real ads, and AdSense shows earnings within a day or two.
3. Google pays out once your balance reaches the payment threshold, after you add bank details under **Payments**.

Rules the game already follows (in code and tests): ads never appear during a race, rewarded ads only start when the
player taps "Double coins", interstitials appear at most every 4 runs and 4 minutes apart, and "Remove Ads" turns them off.

---

## 4. Real-money purchases (Apple and Google billing)

### First, the important fact

**Apple In-App Purchase and Google Play Billing only exist inside real iPhone/Android apps.** A website can't use them.
So real-money purchases need the game turned into apps first (Part C below). Doing it in order:

| Step | What | Cost | Who |
| --- | --- | --- | --- |
| A | Apple developer account | US$99 per year | You |
| B | Google Play developer account | US$25 once | You |
| C | Turn the game into apps (Capacitor) | Free | Me (needs Xcode on your Mac) |
| D | Create the products in both stores | Free | You (I can sit next to you) |
| E | RevenueCat (handles both stores and checks receipts) | Free tier | You sign up, I write the code |
| F | Test, then submit for review | Free | Both |

### Part A: Apple developer account

1. On your iPhone or Mac, make sure your Apple ID has **two-factor authentication** on (Settings > your name > Sign-In & Security).
2. Go to https://developer.apple.com/programs/enroll and click **Start Your Enrollment**.
3. Sign in with your Apple ID and choose **Individual / Sole Proprietor** (easiest). "Organization" needs a company and a D-U-N-S number.
4. Confirm your name, address and phone, accept the agreement, and pay US$99. Approval usually takes up to 48 hours.
5. When approved, open https://appstoreconnect.apple.com, click **Business** at the top, and on the **Agreements** tab
   find **Paid Apps** and click **View and Agree to Terms**, then **Agree**. (Only the Account Holder, you, can do this.)
6. Still in **Business**, fill in **Banking** (your bank account) and **Tax** (the tax forms). Apple won't sell anything until all three are done.

### Part B: Google Play developer account

1. Go to https://play.google.com/console/signup and sign in with a Google account.
2. Choose **Yourself** (personal account), fill in your details, verify your identity and phone number, and pay US$25 once.
3. In Play Console, left menu > **Setup** > **Payments profile**: create it (needed to receive money).
4. Important for new personal accounts: Google requires a **closed test with at least 12 testers for 14 days** before
   you can publish to everyone. Line up 12 friends with Android phones early. (Check the current rule in Play Console when you get there.)

### Part C: turn the game into apps (I do this; you need Xcode)

1. Install **Xcode** from the Mac App Store (free, large download), open it once, and accept the license.
2. Install **Android Studio** from https://developer.android.com/studio.
3. Tell me when both are installed. I'll add Capacitor (`@capacitor/core`, `@capacitor/ios`, `@capacitor/android`),
   create the iOS and Android projects, set the app id (for example `com.neonrush.game`), icons and splash screen, and
   build both apps for testing on your phone.

### Part D: create the products in both stores

The product IDs **must match exactly** what the game uses:

| Product ID | Type | What the player gets | Suggested price |
| --- | --- | --- | --- |
| `coins_small` | Consumable | 1,000 coins | $0.99 |
| `coins_large` | Consumable | 6,000 coins | $4.99 |
| `bundle_night` | Non-consumable | Crimson Racer, Purple Vaporwave, Midnight Black | $2.99 |
| `no_ads` | Non-consumable | No between-run ads, forever | $2.99 |

**Apple (App Store Connect):**
1. **Apps** > your app (it appears after Part C uploads a first build) > left sidebar **Monetization** > **In-App Purchases** > **+**.
2. Pick **Consumable** or **Non-Consumable** (see the table), type a **Reference Name** (e.g. "Coin Stack") and the **Product ID** from the table, then click **Create**.
3. On the product page: set the **Price**, add a **Localization** (display name and description players see), and
   upload a **Review screenshot** (a screenshot of the in-game store is fine).
4. Repeat for all four. They get submitted together with your first app version.

**Google (Play Console):**
1. Your app > **Monetize with Play** > **Products** > **In-app products** (Google is renaming these "One-time products") > **Create product**.
2. **Product ID** from the table (lowercase, can't be changed later), **Title** (25 characters or less shows best),
   **Description**, **Price**. The icon is optional: 512x512 PNG, no text.
3. Click **Save**, then **Activate**. Repeat for all four.
   (Google only allows this after an app build with billing has been uploaded, which Part C provides.)

### Part E: RevenueCat (so no purchase is granted without a verified receipt)

1. Sign up free at https://app.revenuecat.com and create a project called **NEON RUSH**.
2. Add an **App Store** app and a **Play Store** app to the project. RevenueCat asks for store credentials:
   - Apple: an **In-App Purchase key** from App Store Connect (Users and Access > Integrations > In-App Purchase > generate a key, download the `.p8` file, note the Key ID and Issuer ID).
   - Google: a **service account JSON** from Google Cloud with access granted in Play Console (RevenueCat's setup screen links a step-by-step guide).
3. Add the four products, create entitlements `no_ads` and `bundle_night`, and put the products in a **Default offering**.
4. Copy the two **public SDK keys** (one Apple, one Google). These are public, not secret. Send them to me.
5. I'll install `@revenuecat/purchases-capacitor`, plug it into the game's existing `PurchaseProvider`, and make the game
   grant items only when RevenueCat confirms the purchase.

### Part F: test and publish

1. Apple: install the test build with **TestFlight** and buy with a **Sandbox** tester account (App Store Connect > Users and Access > Sandbox). No real money is charged.
2. Google: add yourself as a **License tester** (Play Console > Settings > License testing) and use the **Internal testing** track.
3. When everything works: fill in the store listing (screenshots, description, privacy details, age rating) and submit for review.

### Option for the website: Stripe

For selling on the website as well, Stripe (or Paddle / Lemon Squeezy, which also handle sales tax for you) works.
It needs a small server part that confirms each payment before granting items, built like the leaderboard. Sign up
at https://stripe.com, and I can build that part when you're ready.

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
