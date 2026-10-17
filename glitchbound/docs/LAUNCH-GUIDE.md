# GlitchBound launch guide

What is live, and the exact steps for the parts that need your accounts.

**Live:** https://glitchboundstudio.com (also https://glitchbound-d8m.pages.dev), Cloudflare Pages free plan, with
Pages Functions (`/api`) and the D1 database `glitchbound`.

| Feature | Status | Needs from you |
| --- | --- | --- |
| Arcade, NEON RUSH, Daily Challenge, guest favorites and bests | Live | Nothing |
| Leaderboards, Hall of Fame, member quests, XP and badges, profile | Live, waiting for sign-in | **Section 1**: Google Client ID |
| Admin dashboard (`/admin`) | Live for `savawow99@gmail.com` once sign-in works | Section 1 |
| First-party analytics + crash reports (feed the admin dashboard) | Live | Nothing |
| "Notify me" email list | Collecting signups | **Section 2**: Resend, to send |
| Your own mailbox `sava.hristov@glitchboundstudio.com` | Google Workspace | **Section 3** if mail does not arrive |
| Ads | Built, off | Section 5 |

---

## 1. Switch on Google sign-in (about 10 minutes)

Google proves each player owns their email, so nobody can pretend to be the admin, and we never store passwords.
You need a free **OAuth Client ID**. It is public (it appears in the page), so you can send it to me in chat.

1. Go to https://console.cloud.google.com and sign in with `savawow99@gmail.com`.
2. Top bar, project picker > **New project**. Name: `GlitchBound`. Click **Create**, then make sure it is selected.
3. Left menu (or search bar): **Google Auth Platform**. Click **Get started**.
   - **App name**: `GlitchBound`. **User support email**: your address. **Next**.
   - **Audience**: **External**. **Next**.
   - **Contact information**: your address. **Next**, tick the policy box, **Create**.
4. Left menu **Branding** (optional but nicer): add the logo (`glitchbound/public/icon-512.png`), app home page
   `https://glitchboundstudio.com`, privacy policy `https://glitchboundstudio.com/privacy`, and under **Authorized
   domains** add `glitchboundstudio.com`. **Save**.
5. Left menu **Clients** > **Create client**.
   - **Application type**: **Web application**. **Name**: `GlitchBound web`.
   - **Authorized JavaScript origins**, click **Add URI** for each:
     - `https://glitchboundstudio.com`
     - `https://www.glitchboundstudio.com`
     - `https://glitchbound-d8m.pages.dev`
     - `http://localhost` and `http://localhost:8788` (local testing)
   - **Authorized redirect URIs**: leave empty (the site uses Google's popup).
   - Click **Create**. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`).
6. Left menu **Audience** > **Publish app** > **Confirm**, so anyone with a Google account can sign in (otherwise only
   listed test users can). The site only asks for name, email and picture, which needs no Google review.
7. Send me the Client ID, or set it yourself: in `glitchbound/wrangler.toml` set `GOOGLE_CLIENT_ID = "<the id>"`, commit
   and push to `pre-release` (CI deploys). The "Sign in" button then shows Google's button. No rebuild of the game needed.

Check: open the site, click **Sign in** > **Continue with Google**. Signed in as `savawow99@gmail.com`, the account
menu shows **Admin dashboard**. Other admins: add their Google emails to `ADMIN_EMAILS` (comma separated).

---

## 2. Send emails from the site with Resend (about 15 minutes)

Your Workspace mailbox is for you to read and write mail by hand. For the website to email players automatically
(confirmation emails and "a new game is out" announcements) it needs a sending service. Resend has a free tier
(check https://resend.com/pricing for current limits).

The site sends from `hello@glitchboundstudio.com`, and replies go to `sava.hristov@glitchboundstudio.com`
(`MAIL_REPLY_TO` in `wrangler.toml`). Resend's DNS records live on their own names (`send.` and `resend._domainkey`), so
they do **not** touch your Google Workspace MX record.

### Part A: verify the domain in Resend

1. Sign up at https://resend.com (your Workspace or Gmail address is fine).
2. Left menu **Domains** > **Add domain**. Domain: `glitchboundstudio.com`. Region: **EU (Ireland)** or nearest. **Add**.
3. Resend shows 3-4 DNS records (an `MX` and a `TXT` on `send`, and a `TXT` named `resend._domainkey`).
   - If Resend offers **Auto configure / Sign in to Cloudflare**, use it and approve.
   - Otherwise open Cloudflare > `glitchboundstudio.com` > **DNS** > **Records** and add each record exactly as shown.
     Set **Proxy status** to **DNS only** (grey cloud) for all of them. Do **not** change or delete your existing
     `MX smtp.google.com` record.
4. Back in Resend click **Verify DNS records**. It turns **Verified**, usually within minutes.

### Part B: give the site the API key (keep it secret)

1. Resend > **API Keys** > **Create API key**. Name `glitchbound-site`, permission **Sending access**, domain
   `glitchboundstudio.com`. **Add**. Copy the key (starts with `re_`). It is shown once. **Do not paste it in chat.**
2. Store it as an encrypted secret on Cloudflare, either way:
   - Dashboard: **Workers & Pages** > **glitchbound** > **Settings** > **Variables and Secrets** > **Add** >
     Type **Secret**, Name `RESEND_API_KEY`, Value: paste > **Save** (for **Production**).
   - Or terminal, from `glitchbound/`: `npx wrangler pages secret put RESEND_API_KEY --project-name=glitchbound` and paste
     when asked.
3. Secrets apply to new deployments: GitHub > Actions > **GlitchBound CI/CD** > **Run workflow** (`pre-release`).

### Part C: send

- `/admin` > **Announce a game**: pick the game, write a subject and a message, **Send test to me** first, then
  **Send to N subscribers**. Every email has a one-click unsubscribe link.
- People who signed up before Resend was on are "pending": click **Email N pending confirmations** once, so they get
  their confirm link. Members who switch on notifications while signed in are confirmed already (Google verified them).
- `/admin` > **Export subscribers (CSV)** downloads the list at any time.

Recommended: add a DMARC record (Cloudflare DNS > Add record): Type `TXT`, Name `_dmarc`,
Content `v=DMARC1; p=none; rua=mailto:sava.hristov@glitchboundstudio.com`. It improves deliverability for both
Google Workspace and Resend.

---

## 3. "I can't receive mail" at sava.hristov@glitchboundstudio.com

Checked on 2026-10-17 with public DNS: the domain already has the right Google Workspace records (MX
`smtp.google.com`, SPF `include:_spf.google.com`, Google DKIM, Google site verification). So DNS is not the problem.

1. Open https://admin.google.com. If the home page shows a **Set up Gmail** or **Activate Gmail** card, click it and
   then **Activate** (or **Verify**). Google only starts delivering after this step.
2. Wait. For a brand-new domain Google says it can take up to an hour or two (sometimes longer) to detect the MX.
3. In Cloudflare DNS make sure there is exactly **one** MX record for `glitchboundstudio.com` (`smtp.google.com`) and
   that **Email Routing** is not also turned on for the domain (Cloudflare > the domain > **Email** > **Email Routing**:
   it should be disabled; it would compete for incoming mail).
4. Test from a different account (for example your Gmail) and check Spam.

---

## 4. Domain (done)

`glitchboundstudio.com` and `www.glitchboundstudio.com` are attached to the Pages project, and `VITE_SITE_URL` /
`SITE_URL` point at it. Optional: redirect `www` to the bare domain (Cloudflare > the domain > **Rules** > **Redirect
Rules** > template "Redirect from WWW to root"). Optional: add the domain in Google Search Console and submit
`https://glitchboundstudio.com/sitemap.xml`.

---

## 5. Ads (later)

Unchanged: see [MONETIZATION.md](MONETIZATION.md). Add `glitchboundstudio.com` as a site in AdSense (the site already
publishes `/ads.txt`), request review, set up the EU consent message, create two display ad units, then set
`VITE_ADS_ENABLED=on` and the slot ids. Ads never appear inside or around a game.

---

## 6. How the member features work (for reference)

- **Rounds**: when a signed-in player starts a round, the server notes the time (`/api/runs/start`). When it ends
  (`/api/runs/end`), the score must be possible in the real time that passed (`limits` in the game registry) or it
  is not ranked. Each round can be submitted once. A determined cheater can still fake a plausible browser score; the
  admin can remove rows with
  `npx wrangler d1 execute glitchbound --remote --command "DELETE FROM bests WHERE user_id = '...'"`.
- **Quests**: three per member per day, picked from the date and the member id. Progress comes from the rounds the
  server recorded. Claiming gives XP once; levels follow 100, 300, 600, 1000 XP...
- **Hall of Fame**: crowns (#1 in a game), podiums (top 3), records (personal bests beaten).
- **Guests** keep bests, favorites and the daily streak in the browser; favorites move to the account on sign-in.
- **Deleting an account** (profile page) removes the user, sessions, rounds, bests, quests and favorites.
- **Free-plan limits** (Cloudflare docs, Oct 2026): D1 5M row reads and 100k row writes per day; Functions share the
  Workers free quota of 100k requests per day. A ranked round is about 5 writes; analytics are batched.
