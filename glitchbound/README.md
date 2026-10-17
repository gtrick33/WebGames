# GlitchBound

An independent browser arcade. *One more round. Then another.*

**Live:** https://glitchbound-d8m.pages.dev · **Launch steps (domain, analytics, ads):** [docs/LAUNCH-GUIDE.md](docs/LAUNCH-GUIDE.md)
· **Add a game:** [docs/ADDING-A-GAME.md](docs/ADDING-A-GAME.md)

Built with **TypeScript (strict)**, **React 19** and **Vite**. No backend, no accounts, no database: it is a static
site on Cloudflare Pages (free plan). The first and only game is [NEON RUSH](../neon-rush/), embedded from
https://neonrushgame.com.

## Commands

All commands run from this folder (`glitchbound/`). Requires Node 20+ (developed on Node 24).

| What | Command |
| --- | --- |
| Install | `npm install` |
| Dev server (http://localhost:5173) | `npm run dev` |
| Type check (app, tests, build config) | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit + component tests | `npm test` |
| Production build + size report | `npm run build` (outputs `dist/`) |
| Serve the build exactly like Cloudflare | `npx wrangler pages dev dist` |
| Everything above | `npm run check` |
| Deploy to Cloudflare Pages | `npm run deploy` (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)) |

## What is on the site

| Route | What it is |
| --- | --- |
| `/` | Hero with a live NEON RUSH preview, the daily challenge, "Continue playing" (only after you have played), the latest release, and the arcade (search, category filters, sort; state lives in the URL, e.g. `/?category=racing`) |
| `/games/<slug>` | Game page: the game viewport first, then your bests, how to play, today's challenge, share and friend challenge links (`?beat=<score>`), related games |
| `/daily` | Today's challenge, how it works, the last 4 weeks |
| `/privacy` | What is stored and a button to delete it |
| anything else | A real 404 page (HTTP 404) |

Every route is prerendered to its own HTML file at build time (title, description, canonical URL, Open Graph,
JSON-LD and readable fallback text), so links, refreshes, crawlers and social previews work without JavaScript.

## Architecture

```
src/
  catalog/      THE GAME REGISTRY (games.ts), its schema (types.ts), search/filter/sort (catalog.ts),
                and lazy loaders for in-repo games (modules.ts)
  platform/     contract.ts (game <-> arcade events), daily.ts (deterministic daily challenge, streaks, share text),
                save.ts + store.ts (versioned local save), analytics.ts, env.ts, meta.ts, share.ts, hooks.ts
  router/       A ~100-line client router (four routes do not need a routing library)
  components/   Header, SearchDialog, Hero (+ RoadPreview canvas), DailyCard, Arcade, GameTile, GameStage,
                Sections (latest release, continue playing, marquee), Footer, AdSlot, ErrorBoundary, Burst
  pages/        Home, GamePage, DailyPage, PrivacyPage, NotFound
  styles/       Design tokens, base styles, buttons, chips, stickers, glitch text
scripts/        seo.ts (per-route HTML, sitemap.xml, robots.txt), size-report.mjs
tests/          Vitest: registry, search, daily challenge, saves, message parsing, SEO, routing, pages, game stage
public/         Favicon, app icons, social card (og.png), per-game artwork under games/<slug>/
docs/           Deployment, launch guide, monetization, analytics, adding a game
```

### How a game plugs in

The registry entry (`src/catalog/games.ts`) is the only thing the shell knows about a game. The homepage, search,
categories, sitemap, game page, daily challenge and social cards are all generated from it.

Two runtimes are supported:

- **`embed`**: the game is its own site and runs in an iframe (NEON RUSH). It reports rounds by posting
  `{ source: 'glitchbound-game', version: 1, type: 'start' | 'end', score, stats }` to `window.parent`.
  The arcade accepts messages only from that iframe *and* from the origins listed in the registry, and validates
  every value (`parseGameMessage`).
- **`module`**: the game is a React component in this repo, lazy-loaded as its own chunk when the player presses
  Play. It receives `host.report(event)` with the same events.

Games are isolated: nothing game-related loads until Play is pressed; a game that fails to load, times out or
throws shows a contained "Signal lost" panel with Retry, and the rest of the site keeps working.

### Player data

Bests, rounds played, recent games and daily history live in `localStorage` under `glitchbound.save` (versioned,
validated on read; corrupted data is backed up to `glitchbound.save.corrupt` and replaced; if storage is blocked the
site still works and says nothing will be kept). Only stats declared in the registry are kept, so a game cannot
write arbitrary data. `/privacy` deletes it.

Note: NEON RUSH keeps its own progress (coins, cars, missions) inside its iframe. Browsers partition third-party
storage, so that progress is separate from playing directly on neonrushgame.com, until both sites share a parent
domain (see [docs/LAUNCH-GUIDE.md](docs/LAUNCH-GUIDE.md#2-your-own-domain)).

### Daily challenge

`challengeForDay(day)` hashes the local date and picks a game, a template and a target from the registry's `daily`
templates, so everyone gets the same challenge on the same date and nothing changes on refresh. Any finished round
on GlitchBound counts. A streak is consecutive cleared days. The share text shows the result, a 7-day ■□ row and a
link to `/daily`, with no personal data. If no game had daily templates, the feature would hide itself instead of
showing a fake countdown.

### What is deliberately not here

No accounts, no global leaderboard, no player counts, no ratings, no fake popularity. NEON RUSH has its own online
leaderboard on its own site. A cross-game leaderboard would need a backend (for example Cloudflare D1 + Pages
Functions, like NEON RUSH's), and `platform/contract.ts` + `save.ts` are the integration points for it.

## Design system

- **Palette:** warm paper (`#fff6e8`) surfaces, ink (`#170f30`) outlines and text, and saturated accents: electric
  blue `#2c45ff` (primary), orange `#ff6a1a` (daily), acid lime `#c4f034` (success, highlights), plus coral, yellow,
  teal and violet in small doses. Each game picks one accent (`accent` in the registry).
- **Type:** Bricolage Grotesque (variable, self-hosted, 41 KB) for everything; Space Mono for labels and numbers.
- **Shape:** 2.5 px ink outlines, hard offset "sticker" shadows, rounded pills, rotated stickers, geometric toys
  (pill, dot, triangle, star, ring, cube, squiggle) in `components/Shapes.tsx`.
- **Motion:** spring easing on hover/press, pointer parallax and a CSS-3D orbit in the hero, a canvas "attract mode"
  preview, a timed RGB-split glitch on the headline, View Transitions between pages and filter states, a 0.7 s
  branded wipe once per session, confetti for bests. Everything respects `prefers-reduced-motion`; the canvas pauses
  offscreen and in background tabs. No WebGL is needed, so there is nothing to fall back from.

## Performance budget

`npm run build` fails if the JavaScript loaded at startup exceeds 120 KB gzip. Today: about 87 KB (React is most of
it), 10 KB CSS, two font files (41 KB + 16 KB), and lazy-loaded artwork.

## Credits

Original design and code. Fonts: Bricolage Grotesque and Space Mono (SIL Open Font License), self-hosted via
Fontsource. NEON RUSH artwork comes from the NEON RUSH project.
