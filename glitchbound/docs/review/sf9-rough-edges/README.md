# The rough edges a new player sees (2026-11-24)

Piece 8 of `src/games/sigilfall/NINE_PLAN.md`. Pictures from headless Chromium on the dev server.

| File | What it shows |
| --- | --- |
| `before-phone-01.jpg`, `before-desktop-01.jpg` | The first fight on `pre-release` with a first-timer's hints on: the hint card holds the game still while Mara's line stays written under the dimmed screen |
| `after-phone-01.jpg`, `after-desktop-01.jpg` | The same fight now: while a hint card is up nothing is spoken on the screen, and Mara's line is there when the card is put down |
| `after-desktop-title-1280.jpg` | The title on a 1280 × 720 desktop, inside the site's page: "Play full screen" beside the two title buttons, in words at any size |
| `after-desktop-full-1280.jpg` | After that button: the game fills the screen (770 × 516 before, 1280 × 720 after), and the button is gone |
| `panels/` | Every panel (Hero, Wardrobe, Skills, Talents, Quests, Map, Bag, Settings, the pause menu) and five shops (inn, weapons, armor, curios, quartermaster) at a phone's, a tablet's and a desktop's size, by `node scripts/sigilfall-panel-audit.mjs --out docs/review/sf9-rough-edges/panels`; `audit.json` has the measurements |

## What the two scripts found

- `node scripts/sigilfall-overlap-check.mjs --hints` (new): a new hero with the hints on, the first fight for 45
  seconds, each hint card left up six seconds and read on to the next. Before the fix it reports `hint×speech`; after,
  nothing at its four sizes. A hint card over the buttons and the map it dims is allowed (the game is held still under
  it); an empty skill slot is no longer counted as a button.
- `node scripts/sigilfall-panel-audit.mjs` (new): 42 stops, nothing cut off, nothing covering anything, no button
  under 28 px on a touch screen. Still listed as words a hair under 10 px (listed, not failed): the Wardrobe's
  "Equipped" and "Shop" tags at 9.6 px (the stylesheet had them at 9 and 8 px and has 10 now; the stage's own scaling
  takes the last of it) and the four key names in Skills at 9.7 px on a phone and a tablet.
