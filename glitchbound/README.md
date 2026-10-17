# GlitchBound

An independent browser arcade. *One more round. Then another.*

**Live:** https://glitchboundstudio.com (also https://glitchbound-d8m.pages.dev) · **Launch steps (domain, analytics, ads):** [docs/LAUNCH-GUIDE.md](docs/LAUNCH-GUIDE.md)
· **Add a game:** [docs/ADDING-A-GAME.md](docs/ADDING-A-GAME.md)

Built with **TypeScript (strict)**, **React 19** and **Vite**, on Cloudflare Pages (free plan) with Pages Functions and
a D1 database for accounts. Guests can play everything without signing in; members (Google sign-in) get daily quests,
XP and levels, badges, synced favorites and bests, leaderboards and the Hall of Fame. The first and only game is
[NEON RUSH](../neon-rush/), embedded from https://neonrushgame.com.

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
| `/leaderboards` | Hall of Fame (crowns, podiums, records) and per-game boards (all time, last 24 h) |
| `/signin` | Sign in or sign up: Google, or any email with a 6-digit code / magic link |
| `/play/<slug>/` | In-repo games built into the site (NEON RUSH), shown inside the game page |
| `/me` | Profile: level, quests, badges, bests, favorites, email notifications, delete account |
| `/admin` | Admin dashboard (ADMIN_EMAILS only): members, plays per game, funnel, searches, crashes, email announcements |
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
games/          (src/games) per-game code: NEON RUSH's catalogue preview + its tested simulation
functions/api/  Pages Functions: auth (Google, dev), me, favorites, runs, quests, leaderboard, hall, events, errors,
                subscribe/unsubscribe, admin (stats, CSV, announce)
server/         Shared server code: D1 helpers, sessions, Google ID-token verification, quests, email (Resend)
migrations/     D1 schema
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

### Player names, music and play mode

- Players race under their account nickname (it starts as their Google name) or, as guests, a random name such as
  `BraveFox527` (`src/platform/playerName.ts`), changeable on the game page. Games receive it via the host bridge.
- Lobby music (`src/platform/music.ts`) is generated with Web Audio: original, no files. It starts on the first click,
  can be muted or turned down (bottom-left, or in the phone tab bar) and pauses while a game is loaded.
- Pressing Play enters fullscreen, or an immersive full-viewport mode where browsers do not allow element fullscreen
  (iPhone); zoom is locked while playing and the game pauses when scrolled out of view.

### Members, leaderboards and admin

See [docs/LAUNCH-GUIDE.md](docs/LAUNCH-GUIDE.md) (sections 1, 2 and 6) and [docs/ANALYTICS.md](docs/ANALYTICS.md).
No fake data anywhere: leaderboards only show real members' verified-in-time rounds, and nothing invents player counts.

## Design system

- **Palette:** night-purple surfaces (`#0d0522` to `#26145a`) with a faint arcade grid, neon **cyan** `#22e4ff`
  (primary actions, focus) and **magenta** `#ff3fd2` (members, hard shadows on buttons), plus toy-box accents (lime,
  yellow, orange, coral, teal, violet) in small doses. Each game picks one accent (`accent` in the registry).
- **Type:** Bricolage Grotesque (variable, self-hosted) for everything; Space Mono for labels and numbers.
- **Shape:** rounded panels with thin purple outlines, ink hard shadows, neon glows on focus/hover, rotated stickers,
  geometric toys in `components/Shapes.tsx` (kept away from text).
- **Motion:** arcade-cabinet entrance on every home load or reload (coin drop, PLAYER 1 READY, camera dives into the
  screen; click/key/scroll skips; reduced-motion users never see it), live canvas previews on catalogue tiles, a timed
  RGB-split glitch on the headline, View Transitions between pages and filters, quest-claim and new-best bursts.
  Everything respects `prefers-reduced-motion`; previews pause offscreen and in background tabs.

## Performance budget

`npm run build` fails if the JavaScript loaded at startup exceeds 120 KB gzip. Today: about 96 KB (React is most of
it); game previews load as separate chunks only when their tile is on screen.

## Credits

Original design and code. Fonts: Bricolage Grotesque and Space Mono (SIL Open Font License), self-hosted via
Fontsource. NEON RUSH artwork comes from the NEON RUSH project.
