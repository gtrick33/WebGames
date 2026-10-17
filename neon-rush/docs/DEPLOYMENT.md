# Deployment (Cloudflare Pages)

NEON RUSH is a static site. The production build in `dist/` can be hosted anywhere. The project
targets **Cloudflare Pages** on the free plan.

Live project: `neon-rush` at https://neon-rush-8aj.pages.dev (classic Pages, created once with
`--force` because new wrangler versions otherwise redirect Pages commands to Workers). It includes Pages
Functions and the D1 database `neon-rush-leaderboard` (see `wrangler.toml`).

## One-time setup (already done for this project)

1. Log in to Cloudflare from this machine (opens a browser for OAuth):
   ```bash
   npx wrangler login
   ```
2. Create the Pages project with `pre-release` as its production branch:
   ```bash
   npx wrangler pages project create neon-rush --production-branch=pre-release
   ```
   If the name `neon-rush` is taken, Cloudflare assigns a suffixed `*.pages.dev` subdomain.

## Manual deploy

```bash
npm run deploy
```
This runs the full build and then `wrangler pages deploy dist --project-name=neon-rush --branch=pre-release`.

## Automatic deploys from GitHub (CI/CD)

`.github/workflows/neon-rush.yml` (at the repository root) runs type checks, lint, tests and the build on
every push to `pre-release` that touches `neon-rush/`. It deploys only when these repository secrets exist:

| Secret | Where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard > My Profile > API Tokens > Create Token > "Edit Cloudflare Pages" template (Account > Cloudflare Pages > Edit) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard > Workers & Pages > Account ID (right sidebar) |

Add them in GitHub under Settings > Secrets and variables > Actions. Without them, CI still verifies the
build and prints a notice that deployment was skipped. Never commit tokens to the repository.

Alternative: connect the GitHub repo in the Cloudflare dashboard (Workers & Pages > Create > Pages >
Connect to Git) with root directory `neon-rush`, build command `npm run build`, output directory `dist`,
production branch `pre-release`. Use either this or the GitHub Action, not both.

## Free-tier notes (from developers.cloudflare.com/pages/platform/limits, read October 2026)

- 500 builds per month and 1 concurrent build when Cloudflare builds from Git. The GitHub Action builds on
  GitHub and only uploads, so it does not use Cloudflare builds.
- Up to 20,000 files per site and 25 MiB per file. This build is about 20 files and well under 1 MB.
- 100 custom domains per project.
- The limits page lists no bandwidth or request cap for static assets. Only Pages Functions count toward the
  Workers quota, and this site uses none.
- GitHub Actions minutes for private repositories depend on your GitHub plan. One CI run here takes about a minute.

## Caching

`public/_headers` sets long-lived immutable caching for hashed `/assets/*`, and `no-cache` for
`index.html` and `sw.js`, so new deploys are picked up immediately.
