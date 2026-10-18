---
name: create-game
description: Build a complete new GlitchBound module game from a short description - design, pure seeded logic, React UI, sounds, registry entry, loader, tests, artwork, verification and ship. Use when the user runs /create-game or asks to add/make/build a new game for the GlitchBound arcade.
argument-hint: "[description of the game]"
---

# /create-game

Create a new in-repo **module** game for GlitchBound (`glitchbound/`) from this description:

> $ARGUMENTS

If the description is empty, ask the user what game they want and stop.

Every existing module game (`wing-it`, `color-lab`, `color-recall`, `crosswire`, `letter-pinch`, `memory-grid`,
`mini-racer`, `spot-the-glitch`, `wheres-the-ball`, `wait-what`, `unhinged`) follows the same anatomy. Copy it; do not
invent new platform plumbing. The arcade shell (home, search, game page, sitemap, SEO, daily challenge, friends'
challenges, leaderboards) is driven entirely by the registry entry, so **a new game never needs changes to shared
components, pages, routes, server code or migrations**. If you think it does, stop and ask the user.

Read before writing code:
- [reference/anatomy.md](reference/anatomy.md) - the file layout and code skeletons every game uses
- `glitchbound/docs/ADDING-A-GAME.md` - the official checklist
- `glitchbound/src/catalog/types.ts` - the `GameEntry` schema (comments are the spec)
- `glitchbound/src/platform/contract.ts` - `GameModuleProps` and the events a game reports
- The closest existing game to what you are building (e.g. a one-tap canvas game → `src/games/wing-it/`;
  a daily grid/word puzzle → `letter-pinch` or `crosswire`; trivia → `wait-what`; a level/puzzle game →
  `color-lab`; a racer → `mini-racer`). Match its structure and code style.

Commands run from `glitchbound/`. If `npm` is not on PATH, prefix with `PATH=/Users/savahristov/.local/node/bin:$PATH`.

## 1. Pin down the design (short)

From the description decide, and only ask the user (one AskUserQuestion, max 3 questions) when a choice really
changes the game and the description gives no hint:

- **slug** (lowercase-kebab, final forever: it is the URL), **title**, **emoji**, one-line **tagline** (≤ 90 chars)
- **categories** (first is primary) and **moods** from `CATEGORIES`/`MOODS` in `types.ts`
- **accent**: prefer one used least in `src/catalog/games.ts` (`grep -n "accent:" src/catalog/games.ts`)
- **aspect** (`portrait` for one-thumb phone games, `landscape` for wide boards/racers, `square` for grids)
- **The round**: what one round is, how it starts, how it ends, what the `score` is (higher is better unless
  a time), and 1-3 extra **stats** worth a "best"
- **Modes** - the house standard is all three:
  - **Daily**: same content for everyone on a date, seeded from `hashString('<slug>:' + dayKey())`, numbered
    `#N` from an `EPOCH` date (today), reported with `daily: true`, shareable as a spoiler-free emoji line
  - **Endless / practice**: random seed, replay as much as you like
  - **Friends' challenge**: plays one round on `challenge.seed` straight away, reports `challenge: { id, round }`,
    end screen links to `/c/<id>` with `openChallengeScores`
- **Controls** for keyboard *and* touch (every game must be fully playable on a phone)

Write this as `src/games/<slug>/DESIGN.md` (half a page: the round, scoring, modes, difficulty curve, what is
original about it). Use only original ideas, names and art - no copyrighted characters, logos or brand names.

## 2. Pure logic first

`src/games/<slug>/logic.ts` (or `sim.ts` for real-time games; split into more files if it grows past ~300 lines):
no React, no DOM, no `Math.random` inside - take a seed and use a local `rng(seed)` (mulberry32, see anatomy).
Real-time games step at a fixed `STEP` and return events (`'score' | 'crash' | …`) for sound. Content banks
(words, questions, levels) go in their own files.

## 3. Tests

`tests/<slug>.test.ts` (Vitest, imports from `../src/games/<slug>/…`). At minimum:
- same seed → same content/outcome (the daily and challenges depend on it)
- every generated round is finishable/solvable (an autopilot or solver over many seeds, like `wing-it`'s)
- scoring: bounds, edge cases, and that a strong round stays under `limits.scorePerSecond × seconds`
- any content bank is valid (no duplicates, answers in range, lengths fit the UI)

## 4. UI, sound, styles

Follow [reference/anatomy.md](reference/anatomy.md) exactly for: `Game.tsx` (keyed on `restartKey`, menu → play →
result, `pauseKey`, `challenge`, local save under `glitchbound.<slug>`, `host.report` start/end, ResultLine + Share),
`sound.ts` (Web Audio synth, no audio files, mute toggle saved) and `Game.css` (every class prefixed with a 2-3
letter game prefix, root `position: absolute; inset: 0`, `prefers-reduced-motion` respected, big tap targets).

Do not call `t()` from `src/i18n` inside games: game content stays in English.

## 5. Register it

1. Append an entry to `GAMES` in `src/catalog/games.ts` - copy the shape of the most similar entry. Include:
   `released` = today, `runtime: { kind: 'module' }`, `art` paths `/games/<slug>/tile.webp` and `wide.webp`,
   `controls`, `stats` (first is `score`), factual `highlights`, `ownDaily: { label }`, `challenge: { label }`,
   2 `daily` templates whose `metric` is a declared stat and whose `label` contains `{n}`, and
   `limits: { scorePerSecond, minSeconds }` derived from your scoring (generous: never reject a real player).
2. Add the loader to `GAME_MODULES` in `src/catalog/modules.ts`: `'<slug>': () => import('../games/<slug>/Game'),`
3. Optionally add the slug to a fitting theme day's `games` in `src/platform/themes.ts`.

## 6. Artwork

Three original files in `public/games/<slug>/`: `tile.webp` 800×800 (subject inside the middle 560 px),
`wide.webp` 1200×480, `og.jpg` 1200×630 (title on it), each ≲ 80 KB. Draw them with canvas in the same style as the
game itself (no image libraries are installed). Use the helper:

```bash
node .claude/skills/create-game/scripts/art-server.mjs <scratchpad>/art.html glitchbound/public/games/<slug>
```

(run from the repo root, in the background). Write `art.html` so it draws three canvases and saves them with
`saveArt()` (usage is in the script's header comment), open the printed URL with the built-in browser
(`preview_start` with `url`), screenshot it and **look at it**: the user judges art by polish and realism, so fix
anything blobby, off-centre or cropped before moving on. Then stop the server.

## 7. Verify

1. `npm run check` (typecheck, lint, tests incl. `validateCatalog`, build with the 120 KB startup budget). Fix
   everything; never weaken a test or the budget to pass.
2. `preview_start` `{ name: "glitchbound-dev" }`, open `/games/<slug>`, press Play and play real rounds of each
   mode with clicks/keys: check the menu, a full round, the result screen, Share text, "Last round" and "Your bests"
   updating on the game page, pause on Escape, restart, and a reload keeping the save.
3. `resize_window` to `mobile` and play a round by tapping; nothing overflows, text is readable.
4. `read_console_messages` with `onlyErrors` - must be empty. Take a screenshot of the menu and a round as proof.
5. Reset the viewport to `desktop`.

## 8. Ship

Follow the project's standing rule: once checks pass, commit only the new game's files (plus `games.ts`,
`modules.ts`, `themes.ts` if touched) - **never** sweep in unrelated working-tree changes - with a message like
`GlitchBound: <Title>, <one-line pitch>` and a short bullet body, ending with the Co-Authored-By line, then push
to `pre-release` (CI deploys). If a GitHub issue asked for this game, close it with a comment linking the commit.

Finish with a short report: what the game is, its modes, the files added, test and check results, screenshots,
and anything you could not verify.
