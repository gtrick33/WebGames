# Analytics

GlitchBound has a small analytics seam (`src/platform/analytics.ts`). Code calls `track(event, props)`; the configured
sink decides what happens. **It is switched off in production today**, so no analytics data exists yet.

## Events

| Event | When | Props |
| --- | --- | --- |
| `game_view` | A game page is opened | `game` |
| `game_start` | The game reports a round started | `game` |
| `game_end` | The game reports a round ended | `game`, `score` |
| `replay_click` | Restart pressed in the toolbar | `game`, `where` |
| `share_click` | Any share button | `game` or `day`, `what` (`game`, `score`, `challenge`, `daily`) |
| `daily_complete` | Today's challenge cleared | `game`, `day` |
| `search` | Search settles for 0.5 to 0.8 s | `q` (lowercased, max 40 chars), `results`, `where` |
| `category_select` | A category filter is chosen | `category` |

No names, emails, IDs, cookies or IP handling in our code. Search text is the only free text; it is truncated.

In any build, the last 100 events are visible in the browser console as `__glitchbound.events`, which is handy
for checking that instrumentation fires. In `npm run dev` they are also logged with `console.info`.

## Simplest free options

1. **Cloudflare Web Analytics (page views only, no code).** Cloudflare dashboard > Workers & Pages > glitchbound >
   **Metrics** > enable Web Analytics. Cloudflare injects its cookieless beacon on the next deploy. It answers
   "which pages, from where", including `/games/neon-rush` views, but not custom events.
2. **Umami (custom events, cookieless).** Supported in code. Umami Cloud has a free tier; check
   https://umami.is/pricing for its current limits. You can also self-host it.

Both can run together.

## Switching on Umami

1. Sign up at https://cloud.umami.is, click **Add website**, name it GlitchBound, domain `glitchboundstudio.com`
   (or your custom domain).
2. Copy the **Website ID** (a UUID; it is public, it appears in the page source).
3. In `glitchbound/.env.production` set:
   ```
   VITE_ANALYTICS=umami
   VITE_UMAMI_WEBSITE_ID=<the id>
   ```
4. Commit and push to `pre-release` (CI deploys), then open the site and check that Umami's realtime view shows
   the visit. Custom events appear under **Events**.
5. `/privacy` updates its "Analytics" section automatically.

Umami's script records page views (including client-side navigation) by itself; our sink only adds
`umami.track(event, props)` for the events above.

## Adding another provider

Implement the `Sink` interface in `analytics.ts`, select it from `ANALYTICS.provider` in `env.ts`, keep it
cookieless or put it behind consent, and update the `/privacy` text.
