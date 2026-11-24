# Sigilfall before the pass to 9/10: the baseline's pictures (2026-11-24)

Taken by `node scripts/sigilfall-tour.mjs --out docs/review/sf9-baseline` on `pre-release` at `7dacaa45`, before any
piece of `src/games/sigilfall/NINE_PLAN.md` changed the game. Later pieces put their before-and-after pictures beside
these, in their own folders.

Three sizes, each in its own folder: `phone/` (844 × 390, touch, the game filling the screen), `tablet/` (1024 × 768,
touch, filling the screen) and `desktop/` (1440 × 900, the game inside the site's page, as a visitor sees it).

In each folder:

- `beat-NN-<preset>.jpg`: every act's beats, one per review preset of the story (`progress/presets.ts`, the 38 that
  aren't a later pass's or a retired land's), four seconds after a hero is jumped there. Many are in the middle of
  their scene (the letterbox bars are the scene's).
- `mode-01-riftward.jpg`, `mode-02-riftstone-run.jpg`: a finished hero in the Riftward, and twelve seconds into a
  Riftstone +1 of the crypt.
- `mode-03-vigil-night.jpg`: twenty-five seconds into a night of the Vigil in the Whisperwood.
- `mode-04-ring-match.jpg`: a minute after asking the Ring for a 1v1 match (nobody else is in the queue on the dev
  server, so it is against the computer; the hero is left standing, so it is usually lost by then).
- `save-NN-<name>.jpg`: each save of `tests/sigilfall-saves/` put on the device as the game's own save, and its hero
  played for four seconds.

`tour.json` lists every stop with what the page reported while it was there. At the baseline: 135 stops, and the
page reported nothing (calls to the site's API aside: the dev server has none).

The hero is the script's, a warrior named Tour, and is never struck down, so a fight goes on round them.
