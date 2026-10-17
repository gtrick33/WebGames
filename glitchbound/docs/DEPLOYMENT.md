# Deployment (Cloudflare Pages)

GlitchBound is a static site plus a small API (Cloudflare Pages Functions in `functions/api/`, shared server code in
`server/`) and a D1 database `glitchbound` (schema in `migrations/`). It runs on **Cloudflare Pages** on the free plan,
set up the same way as NEON RUSH.

Live project: `glitchbound` at https://glitchboundstudio.com (custom domain; `www.` too) and https://glitchbound-d8m.pages.dev (classic Pages, created once with
`--force` because new wrangler versions otherwise redirect Pages commands to Workers). Production branch:
`pre-release`. `wrangler.toml` holds the D1 binding (`DB`) and the public settings (`SITE_URL`, `GOOGLE_CLIENT_ID`,
`ADMIN_EMAILS`, `MAIL_FROM`, `MAIL_REPLY_TO`). The only secret is `RESEND_API_KEY` (see LAUNCH-GUIDE.md, section 2).

## One-time setup (already done for this project)

1. Log in to Cloudflare from this machine (opens a browser for OAuth):
   ```bash
   npx wrangler login
   ```
2. Create the Pages project with `pre-release` as its production branch:
   ```bash
   npx wrangler pages project create glitchbound --production-branch=pre-release --force
   ```
   `--force` is needed only for this create step. Never pass it again.

## Local development

```bash
npm run build && npm run dev:api   # applies migrations to a local D1 and serves dist/ + /api on :8788
npm run dev                        # Vite on :5173 with hot reload; /api is proxied to :8788
```
Create `glitchbound/.dev.vars` (git-ignored) with `DEV_LOGIN=1` to get a fake "Sign in (dev)" form on localhost.
It is ignored in production (the endpoint also refuses any non-localhost request).

## Database changes

Add `migrations/0002_<name>.sql` (never edit an applied one). CI applies new migrations on every deploy
(`wrangler d1 migrations apply glitchbound --remote`); to do it by hand: `npm run db:migrate`.

## Manual deploy

```bash
npm run deploy
```
This runs the full build (type check, Vite build, size budget) and then
`wrangler pages deploy dist --project-name=glitchbound --branch=pre-release`.

## Automatic deploys from GitHub (CI/CD)

`.github/workflows/glitchbound.yml` (at the repository root) runs the type checks (app, tests, build config,
Functions), lint, tests and build on every push to `pre-release` that touches `glitchbound/`, and on pull requests
(without deploying). On `pre-release` it then applies D1 migrations and deploys. It deploys with the
**same two repository secrets as NEON RUSH**, which are already set:

| Secret | Where it came from |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | The `neon-rush-github` token. Its "Cloudflare Pages: Edit" and "D1: Edit" permissions are account-wide, so they cover `glitchbound` and its database. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard > Workers & Pages > Account ID |

Without them CI still verifies the build and prints a notice that deployment was skipped. Never commit tokens.

The two workflows are independent: a change in `neon-rush/` deploys only NEON RUSH, a change in `glitchbound/`
deploys only GlitchBound.

To redeploy without a code change: GitHub > Actions > **GlitchBound CI/CD** > Run workflow (branch `pre-release`).

## What the build produces

| File | Served at | Notes |
| --- | --- | --- |
| `index.html` | `/` | Prerendered home |
| `games/<slug>.html` | `/games/<slug>` | One per registry entry. Pages serves `x.html` at `/x`; `/x/` redirects (308) to `/x`. |
| `daily.html`, `privacy.html` | `/daily`, `/privacy` | |
| `404.html` | any unknown path | Real HTTP 404, `noindex` |
| `sitemap.xml`, `robots.txt` | | From the registry and `VITE_SITE_URL` |
| `ads.txt` | | Only when `VITE_ADSENSE_CLIENT` is set (it is, in `.env.production`) |
| `assets/*` | | Hashed, cached for a year (`public/_headers`) |

`public/_headers` also sets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN` (other sites
cannot frame GlitchBound) and a restrictive `Permissions-Policy`.

To check a build exactly as Cloudflare will serve it, before deploying:
```bash
npm run build && npx wrangler pages dev dist
```

## Environment variables

All are build-time and **public** (they end up in the browser bundle). Production values are committed in
`.env.production`; local overrides go in `.env.local` (git-ignored). See `.env.example`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_SITE_URL` | `https://glitchboundstudio.com` | Canonical URLs, Open Graph, share links, sitemap. Change when a custom domain is live. |
| `VITE_ANALYTICS` | `none` (`console` in dev) | `none`, `console` or `umami` ([ANALYTICS.md](ANALYTICS.md)) |
| `VITE_UMAMI_WEBSITE_ID`, `VITE_UMAMI_SRC` | empty, Umami Cloud script | Umami settings |
| `VITE_ADSENSE_CLIENT` | `ca-pub-9356777861178613` | Publisher id. Alone, it only writes `ads.txt`. |
| `VITE_ADS_ENABLED` | empty | `on` shows ads ([MONETIZATION.md](MONETIZATION.md)) |
| `VITE_ADSENSE_TEST` | empty | `on` uses Google test ads |
| `VITE_ADSENSE_SLOT_HOME`, `VITE_ADSENSE_SLOT_GAME` | empty | AdSense ad unit ids per placement |

## Free-tier notes

- The GitHub Action builds on GitHub and only uploads, so it does not use Cloudflare's monthly build quota.
- Static asset requests on Pages are not metered like Functions are, and this site has no Functions.
  Check https://developers.cloudflare.com/pages/platform/limits/ for current limits (files per site, file size).
- This build is about 21 files and well under 1 MB.

## Rolling back

Cloudflare dashboard > Workers & Pages > glitchbound > Deployments > pick an earlier deployment > **Rollback**.
