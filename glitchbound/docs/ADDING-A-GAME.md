# Adding a game

Adding a game means **one registry entry + artwork + (for in-repo games) one loader line**. No shared component,
page, route, sitemap or search code changes. The homepage, search, category filters, game page, sitemap, social
card meta, related games and daily challenge pick it up automatically.

## 1. Choose the runtime

| | `embed` | `module` |
| --- | --- | --- |
| What | The game is its own Vite project in this repo (like `neon-rush/`), built into `dist/play/<slug>/` and shown in a same-site iframe | A React component inside `glitchbound/src/games/<slug>/` |
| Good for | Bigger games with their own stack or their own API | Small and medium games built quickly with Claude Code |
| Deploys | With GlitchBound (`scripts/build-games.mjs` builds it; the GlitchBound workflow also runs on changes to its folder) | With GlitchBound |
| Loads | When the player presses Play | As its own lazy JS chunk when the player presses Play |

## 2. Report rounds (the contract)

Both runtimes send the same events (`src/platform/contract.ts`):

```ts
{ type: 'start' }                                         // a round began
{ type: 'end', score: 1234, stats: { meters: 900 } }      // a round ended
```

- `score` is required on `end` and is the main number (higher is better unless the stat says otherwise).
- `stats` keys must be declared in the registry's `stats`; undeclared keys are ignored.
- Values are clamped to whole numbers between 0 and 1,000,000,000.

**Module games** get a `host` prop:

```tsx
// src/games/my-game/Game.tsx
import type { GameModuleProps } from '../../platform/contract';

export default function Game({ host, restartKey }: GameModuleProps) {
  // Reset whenever restartKey changes. Fill the parent element (the stage sizes it).
  // ...
  host.report({ type: 'start' });
  host.report({ type: 'end', score, stats: { time } });
}
```

**Embedded games** post to their parent (see `neon-rush/src/analytics/embed.ts` for a short, tested example).
They should also send `{ type: 'ready' }` once they listen for host commands, and handle these commands from the
parent (`source: 'glitchbound-host'`, `version: 1`): `identity` (`{ name }`, the player's arcade name; use it instead of
asking for one) and `pause` (sent when the game is scrolled out of view):

```ts
if (window.parent !== window) {
  window.parent.postMessage({ source: 'glitchbound-game', version: 1, type: 'end', score, stats }, '*');
}
```

The arcade only accepts messages from the game's iframe *and* from the origins listed in the registry.

## 3. Add the registry entry

For an embedded in-repo game: give the project a relative Vite `base: './'`, add it to `GAME_BUILDS` in
`scripts/build-games.mjs`, use `runtime: { kind: 'embed', url: '/play/<slug>/', origins: ['self'] }`, and add its
folder to the `paths` of `.github/workflows/glitchbound.yml`. If it has its own API, call it with relative URLs and
add Functions under `functions/play/<slug>/api/` (see the NEON RUSH wrappers).

Append to `src/catalog/games.ts` (schema and comments in `src/catalog/types.ts`):

```ts
{
  slug: 'word-burst',                 // URL: /games/word-burst. Never change after release.
  title: 'Word Burst',
  tagline: 'One line for tiles and search (max ~90 characters).',
  description: 'Two or three sentences for the game page and meta description.',
  categories: ['word', 'puzzle'],     // first = primary. See CATEGORIES in types.ts.
  tags: ['letters', 'daily', 'anagram'],
  released: '2026-11-02',             // drives "Newest" and the NEW sticker (30 days)
  accent: 'coral',                    // blue | orange | lime | coral | yellow | teal | violet
  art: {
    tile: '/games/word-burst/tile.webp',
    wide: '/games/word-burst/wide.webp',
    alt: 'Describe the artwork',
    bg: '#2a1240',                    // shown while art loads
  },
  runtime: { kind: 'module' },        // or { kind: 'embed', url: 'https://…/', origins: ['https://…'] }
  aspect: 'square',                   // portrait | landscape | square: sizes the stage
  controls: { keyboard: ['Type letters', 'Enter: submit'], touch: ['Tap letters'] },
  stats: [
    { key: 'score', label: 'Best score' },                              // required
    { key: 'time', label: 'Fastest solve', unit: 's', lowerIsBetter: true },
  ],
  highlights: ['Factual bullet points only'],                           // optional
  daily: [{ metric: 'score', targets: [500, 800], label: 'Score {n} points in one round' }], // optional
},
```

For a module game, also add its loader to `src/catalog/modules.ts`:

```ts
export const GAME_MODULES: Record<string, GameModuleLoader> = {
  'word-burst': () => import('../games/word-burst/Game'),
};
```

Adding `daily` templates puts the game into the daily rotation from its release date onward (the daily challenge
picks one daily-capable game per day). Leave `daily` out if the game has no fair single-round target.

### Optional: a live catalogue preview

Catalogue tiles can play a tiny looping "attract mode" (NEON RUSH has one). Write a component in
`src/games/<slug>/Preview.tsx` that draws on a canvas, takes `GamePreviewProps` (`playing`), pauses when offscreen, and
draws one still frame for reduced motion; then register it in `GAME_PREVIEWS` in `src/catalog/modules.ts`. It loads only
when its tile scrolls near the screen. Keep the simulation in a separate pure file so it can be tested (see
`src/games/neon-rush/previewSim.ts` and `tests/preview.test.ts`).

### Optional: leaderboard limits

Add `limits: { scorePerSecond, minSeconds }` to the registry entry. The server rejects ranked rounds whose score is
impossible for the real time between `start` and `end`. Without limits, any score is accepted.

## 4. Add artwork

Put three files in `public/games/<slug>/`:

| File | Size | Used for |
| --- | --- | --- |
| `tile.webp` | 800 x 800, keep the subject in the middle 560 px | Tiles, search, phone layouts, game page poster |
| `wide.webp` | 1200 x 480 (5:2) | Featured tiles, latest-release spread |
| `og.jpg` | 1200 x 630 | Link previews when the game page is shared |

Keep each under ~80 KB. Use original art only (no copyrighted characters or logos). The NEON RUSH files are good
references.

## 5. Check and ship

```bash
npm run check                 # type check, lint, tests (incl. registry validation), build
npx wrangler pages dev dist   # optional: click through the real build
```

`validateCatalog` (run by the tests and the build) fails on duplicate or malformed slugs, bad dates, unknown
categories, daily metrics that are not in `stats`, embed origins that don't include the game URL, and more.

Commit and push to `pre-release`; CI deploys. The new page is live at `/games/<slug>` and listed in `sitemap.xml`.

## Checklist

- [ ] Game reports `start` and `end` with `score`
- [ ] Registry entry added; slug final
- [ ] (module) loader added to `modules.ts`
- [ ] Three artwork files, original
- [ ] Controls listed for keyboard and touch
- [ ] `npm run check` passes
- [ ] Played a round on the dev server and saw "Last round" + "Your bests" update
