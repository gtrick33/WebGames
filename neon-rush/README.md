# NEON RUSH

An original, lightweight 2D endless arcade racer for the browser. Weave through neon traffic,
grab coins and power-ups, chain near misses, and unlock cosmetic cars.

Built with **TypeScript (strict)**, **PixiJS 8** and **Vite**. Menus are plain HTML and CSS.
All art and music are generated in code: there are no image or audio downloads.

## Commands

All commands run from this folder (`neon-rush/`). Requires Node 20+ (developed on Node 24).

| What | Command |
| --- | --- |
| Install | `npm install` |
| Dev server (http://localhost:5173) | `npm run dev` |
| Type check (browser + config) | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit tests | `npm test` |
| Production build + size report | `npm run build` (outputs `dist/`) |
| Serve the production build | `npm run preview` |
| Everything above | `npm run check` |
| Deploy to Cloudflare Pages | `npm run deploy` (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)) |

## How to play

- **Keyboard:** Left/Right arrows or A/D to switch lanes. P or Esc pauses. Enter starts a run.
- **Touch / mouse:** tap or click the left or right half of the screen.
- Coins are worth 10 points each, and every metre is worth 1 point. A near miss is when you dodge a car
  at the last moment; chaining them builds a combo (up to x8).
- Power-ups: **Shield** (absorbs one crash), **Magnet** (pulls in coins), **2x Coins**.
- The game pauses automatically when the tab is hidden or the window loses focus.

## Project layout

```
src/
  game/          Pure simulation (no rendering): world, spawner, difficulty, autopilot
  render/        PixiJS renderer, procedural art, pooled particles
  input/         Keyboard + pointer controls
  progression/   Versioned save schema, storage, levels, achievements, daily rewards, challenges, run results
  cosmetics/     Skin catalogue and shop logic (cosmetic only)
  monetization/  AdProvider / PurchaseProvider interfaces, frequency caps, dev mocks
  backend/       Optional online-services interface (local-only in v1)
  analytics/     In-memory analytics seam (sends nothing)
  audio/         Web Audio synthesized SFX + music (lazy-loaded)
  ui/            Screen controller, views, styles
tests/           Vitest unit tests (simulation, fairness, progression, economy, shop, ads, purchases, saves)
scripts/         Size report, service worker template
docs/            Deployment, monetization, backend and mobile notes
```

### Design notes

- **Fair by construction.** All traffic moves in one shared frame, so hazard rows never drift into each
  other. The spawner tracks every lane the player could possibly be in and only creates a row if each of
  those lanes still has a reachable escape, allowing for lane-change and reaction time. Tests drive a
  bot with a 100 ms reaction delay through 120 s of play on many seeds without a single unavoidable crash.
- **Fixed timestep** (120 Hz) simulation, decoupled from rendering. Deterministic per seed.
- **No per-frame allocations** in the hot loop: entity, sprite and particle pools are reused.
- **Persistence**: `localStorage`, versioned schema with migrations. Corrupted saves are backed up and
  replaced with a fresh profile, and tampered values are clamped. Run results, ad rewards and purchases
  use idempotency keys, so duplicate callbacks never pay twice.
- **Offline**: a generated service worker precaches every build file on the first visit.

## Economy

| Source | Coins |
| --- | --- |
| Coins collected in a run | 1 each (2 with the 2x power-up) |
| Distance bonus | 1 per 100 m |
| Level up | 40 x new level |
| Achievements | 50 to 300 each (12 achievements) |
| Daily challenges | 3 per day, about 60 to 150 each |
| Daily login streak | 50, 75, 100, 125, 150, 200, 300 (repeats) |

New players start with 100 coins. There are 10 cars: one starter, six bought with earned coins
(300 to 2,500), and **four unlocked only through play**: Lime Circuit (level 3), Aurora Gradient (level 8),
Retro Arcade (3,000 m in one run) and Phantom Chrome (100 lifetime near misses). Cars are purely cosmetic.

## Status of monetization and online features

Ads and real-money purchases are **disabled in production**. The code has provider interfaces, frequency
caps and clearly labelled development mocks (only in `npm run dev`). See [docs/MONETIZATION.md](docs/MONETIZATION.md),
[docs/BACKEND.md](docs/BACKEND.md) and [docs/MOBILE.md](docs/MOBILE.md).

## Credits

Original game design, code, vector art and synthesized music. Font: Orbitron (SIL Open Font License),
bundled via `@fontsource/orbitron`.
