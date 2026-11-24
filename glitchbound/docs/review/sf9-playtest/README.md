# Ready for players (2026-11-24)

Piece 9 of `src/games/sigilfall/NINE_PLAN.md`. Pictures from headless Chromium on the built site, served locally with
its own API and database (`wrangler pages dev dist`).

| File | What it shows |
| --- | --- |
| `title.jpg` | The title a new player sees: the Ring is one of the four banners, beside "New hero" |
| `bug-form.jpg` | The site's Report a bug page, opened from a new warrior's game: under the browser and screen size it now shows "We'll attach where you were in the game: Sigilfall build 0bd9e94 · story · land briarhollow · quest first-steps · level 1 · warrior" |

## What was followed end to end

On the built site with a local database:

- a new hero begun through the game's own buttons, the page hidden: a `game_stop` row in the database, with the
  mode, land, quest, level and minutes, and no account;
- the player back, playing on, the page hidden again: a second row, with more minutes;
- Report a bug from the game: the form shows the game's line (the picture).

On the dev server, where the game can be reached from the page:

- the Ring opened: the line a bug report would carry says "the Ring"; left again: a `game_stop` with `mode: ring`;
- a hero struck down: a `game_fall` with the land, the quest and the level.

By test (`tests/sigilfall-telemetry.test.ts`): a signed-in member's falls and stops are stored without their id
while their other events keep it; the three queries in `docs/ANALYTICS.md` run against a real database and find
what was sent.
