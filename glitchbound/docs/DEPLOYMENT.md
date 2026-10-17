# Deployment (Cloudflare Pages)

GlitchBound is a static site. The production build in `dist/` can be hosted anywhere. It runs on
**Cloudflare Pages** on the free plan, set up the same way as NEON RUSH.

Live project: `glitchbound` at https://glitchbound-d8m.pages.dev (classic Pages, created once with
`--force` because new wrangler versions otherwise redirect Pages commands to Workers). Production branch:
`pre-release`. Unlike NEON RUSH it has **no Pages Functions and no database**, so `wrangler.toml` only names the
output folder.

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

## Manual deploy

```bash
npm run deploy
```
This runs the full build (type check, Vite build, size budget) and then
`wrangler pages deploy dist --project-name=glitchbound --branch=pre-release`.

## Automatic deploys from GitHub (CI/CD)

`.github/workflows/glitchbound.yml` (at the repository root) runs the type check, lint, tests and build on every
push to `pre-release` that touches `glitchbound/`, and on pull requests (without deploying). It deploys with the
**same two repository secrets as NEON RUSH**, which are already set:

| Secret | Where it came from |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | The `neon-rush-github` token. Its "Account > Cloudflare Pages > Edit" permission covers every Pages project in the account, including `glitchbound`. |
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
| `VITE_SITE_URL` | `https://glitchbound-d8m.pages.dev` | Canonical URLs, Open Graph, share links, sitemap. Change when a custom domain is live. |
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
