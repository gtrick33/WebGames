# GlitchBound launch guide

What is live today, and the exact steps for the parts that need your accounts, money or approval.

**Live now:** https://glitchboundstudio.com (custom domain, bought 2026-10-17) and https://glitchbound-d8m.pages.dev (Cloudflare Pages, free plan). Ads and analytics are built in but off.
NEON RUSH is embedded from https://neonrushgame.com and reports scores back to GlitchBound.

---

## 1. Automatic deploys (already working, nothing to do)

GlitchBound reuses NEON RUSH's GitHub secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`). The token's
"Cloudflare Pages: Edit" permission is account-wide, so it can deploy the `glitchbound` project too.

To check it:

1. Go to https://github.com/gtrick33/WebGames/actions
2. On the left, click **GlitchBound CI/CD**.
3. The latest run should have a green check, and its **Deploy to Cloudflare Pages** step says "Deployment complete!".
4. To redeploy by hand: **Run workflow** > branch `pre-release` > **Run workflow**.

If the deploy step ever fails with an authentication error, the token was deleted or expired: follow
`neon-rush/docs/LAUNCH-GUIDE.md`, section 1, to make a new one; both games use it.

---

## 2. Your own domain

**Done:** `glitchboundstudio.com` was bought on Cloudflare and attached to the `glitchbound` Pages project
(apex + `www`), and `VITE_SITE_URL` points at it. The options below are kept for reference. For ads, follow
section 4 with "Option B".

GlitchBound works on `glitchbound-d8m.pages.dev` forever for free. A real domain matters for three things:
a name people remember, **AdSense** (Google does not accept `*.pages.dev` addresses you don't own as an ad site), and
**sharing NEON RUSH progress** (see "Option A").

### Pick one

| Option | Cost | Pros | Cons |
| --- | --- | --- | --- |
| **A. A subdomain of the domain you already own**, e.g. `arcade.neonrushgame.com` | Free | Instant. Same site as NEON RUSH, so browsers don't partition NEON RUSH's storage inside the arcade: coins and cars match playing directly. Covered by the `neonrushgame.com` AdSense site. | The address says "neonrush", not "GlitchBound". |
| **B. A GlitchBound domain** | About the .com price per year at Cloudflare Registrar (sold at cost) | The brand in the address bar. | Costs money; NEON RUSH progress inside the arcade stays separate from neonrushgame.com; needs its own AdSense site review. |

Domain status checked on 2026-10-17 through the public registries (RDAP):

| Domain | Status |
| --- | --- |
| glitchbound.com | Taken by someone else |
| **glitchboundgames.com**, **playglitchbound.com**, glitchbound.net | Free at the registry (Verisign) |
| glitchbound.gg, glitchbound.io, glitchbound.games | No record found; the search in step B2 gives the final answer |

### Option A: connect `arcade.neonrushgame.com` (about 5 minutes)

1. https://dash.cloudflare.com > left menu **Workers & Pages** > click **glitchbound**.
2. **Custom domains** tab > **Set up a domain**.
3. Type `arcade.neonrushgame.com` and click **Continue**, then confirm. Cloudflare creates the DNS record itself,
   because the domain is already on your account. **Don't add DNS records by hand first** (that causes a 522 error).
4. Wait for **Active** (usually minutes, up to an hour while the HTTPS certificate is issued).
5. Tell me, and I'll set `VITE_SITE_URL=https://arcade.neonrushgame.com` so canonical URLs, share links and the sitemap
   use the new address, and redeploy. (Or: edit `glitchbound/.env.production` and push to `pre-release`.)

### Option B: buy a GlitchBound domain (about 15 minutes + waiting)

1. Check your Cloudflare email is verified (no yellow banner in the dashboard).
2. Left menu > **Domain Registration** > **Register Domains**, search `glitchboundgames` (or your pick), click **Purchase**.
3. Choose 1 year, fill in your real contact details (plain English letters), add payment, click **Complete purchase**.
4. Then follow Option A steps 1-5 with your new domain, and repeat step 3 for the `www.` version.
5. Optional: redirect `www` to the bare domain (Websites > your domain > Rules > Redirect Rule
   "Redirect from WWW to root"), exactly as in NEON RUSH's guide.

Buying a domain charges your card, so I won't do this step for you.

### After either option

- In Google Search Console (https://search.google.com/search-console), add the domain, verify it (Cloudflare can do
  the DNS verification automatically), and submit `https://<your domain>/sitemap.xml`. This helps Google find the
  pages. It does not guarantee rankings.

---

## 3. Analytics (about 10 minutes, free)

See [ANALYTICS.md](ANALYTICS.md). Short version:

1. **Page views, no code:** Cloudflare > Workers & Pages > glitchbound > **Metrics** > enable **Web Analytics**.
2. **Which games people start, finish, replay and share:** create a free Umami Cloud website, send me the Website ID
   (it's public), and I'll switch `VITE_ANALYTICS=umami` on.

---

## 4. Ads on GlitchBound pages

Do this only after a real domain is live (section 2). Ads stay off until you explicitly switch them on.

### Part A: add the site to AdSense

You already have an AdSense account for NEON RUSH (publisher id `ca-pub-9356777861178613`).

- **With Option A (`arcade.neonrushgame.com`):** nothing to add. AdSense sites are root domains, and subdomains are
  covered by `neonrushgame.com` once that site is approved. The GlitchBound build already publishes
  `/ads.txt` with your publisher line.
- **With Option B (your own domain):** AdSense > **Sites** > **+ New site** > your domain > verification method
  **Ads.txt snippet**. Every GlitchBound build already publishes `https://<domain>/ads.txt` with the right line. Open it
  to check, tick **I've placed the code**, **Verify**, then **Request review**. Google says reviews take days to a few
  weeks.

### Part B: consent message for Europe

AdSense > **Privacy & messaging** > **European regulations** > **Create message** > select the site > keep
**Consent**, **Do not consent**, **Manage options** > **Publish**. No code change needed.

### Part C: create two ad units

1. AdSense > **Ads** > **By ad unit** > **Display ads**.
2. Name it `glitchbound-home`, keep **Responsive**, click **Create**. In the code it shows, copy only the number in
   `data-ad-slot="1234567890"`.
3. Repeat with `glitchbound-game`.
4. Send me both numbers (they are public).

### Part D: switch on

1. I'll do a **test build** first with Google's test ads (no earnings):
   `VITE_ADS_ENABLED=on VITE_ADSENSE_TEST=on VITE_ADSENSE_SLOT_HOME=... VITE_ADSENSE_SLOT_GAME=... npm run deploy`
2. Then the real build, with the same values in `.env.production` and without `VITE_ADSENSE_TEST`.

Where ads appear: one unit between the homepage marquee and the arcade, one at the bottom of the game page side
column. Never on or around the game itself. See [MONETIZATION.md](MONETIZATION.md).

Honest expectations: display ad income depends on visitors, countries and season. Getting players matters most.

### Ads inside NEON RUSH

Those are NEON RUSH's H5 Games Ads and follow `neon-rush/docs/LAUNCH-GUIDE.md`, section 3. Note that Google's
H5 Games Ads approval is for the game's own URL; when NEON RUSH is played inside GlitchBound's iframe, check with
Google's current H5 policy before relying on in-game ads there.

---

## 5. Things that would need a backend (not built)

- A cross-game leaderboard or accounts that sync between devices. NEON RUSH's own online leaderboard keeps working
  inside the iframe. A GlitchBound-wide one could reuse the same pattern (Pages Functions + D1), with the arcade
  submitting from `GamePage`'s `onEvent`.
- Real player counts or "popular" sorting. Today "Newest" and "A to Z" are the only sorts because there is no
  honest popularity data yet. Once analytics run, popular games can be reflected in the registry by hand.
