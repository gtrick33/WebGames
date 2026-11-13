# Sigilfall trailer studio

Films the real game and cuts the three Sigilfall trailers. Node, Playwright (Chromium) and ffmpeg (Homebrew, at
`/opt/homebrew/bin`). Everything it makes goes to `.cache/` here (takes, segments) and to
`marketing/videos/sigilfall/` (the films), both outside git.

## How it works

1. **The game runs as it is**, from the dev server of this checkout (`glitchbound/`, port 7820), full screen in a
   headless Chromium with the GPU on, at 1920 x 1080.
2. **A stepped clock** (`inpage/clock.js`) holds the page's time (`performance.now`, `requestAnimationFrame`,
   timers, CSS animations). The recorder asks for exactly 1/60 s of game time, takes a screenshot, and asks again:
   every take is a true 60 frames for each second of play, however slow the machine is. Game speed is never changed.
3. **A pilot** (`inpage/pilot.js`) plays the hero: it decides where to walk, where to point and what to press, and
   sends real `keydown` / `pointermove` / `pointerdown` events to the game's own input code. It never writes to the
   world while a take is filmed. Heroes are set up before a take with the game's own functions (levels, the game's
   own rolled gear, talents, the review presets in `progress/presets.ts`).
4. **Sound is logged, not recorded**: every `sound.play(id)` the game makes is written down with its frame. The
   mixer (`audio/mix.mjs`) lays the game's own sample files down at those moments, with the gain and pitch range
   from `audio/samples.ts`.
5. **An edit is a script** (`edits/*.mjs`): clips (take, in-point, length, push-in, fades), graphics and sound hits.
   `render.mjs` cuts each clip frame-exact, joins them, renders the graphics in the browser (`gfx/stage.html`:
   this ffmpeg has no text filter), mixes the sound, levels it to -14 LUFS and writes the MP4.

## Commands

```bash
# the game, from this checkout (leave it running)
cd glitchbound && GB_API=http://127.0.0.1:9 node node_modules/vite/bin/vite.js --port 7820 --strictPort

cd marketing/_studio/sigilfall
node capture.mjs --list                 # every shot
node capture.mjs ashkar cls-mage        # film shots (never the same shot twice at once)
./sheet.sh ashkar 2 6                   # a contact sheet of a take, one tile every 2 s
node notes.mjs ashkar                   # what the take's log says happened, and when
./strips.sh look ashkar:13.7:2.1        # a close strip of a chosen moment
node render.mjs launch --draft          # a quick cut to look at
node render.mjs launch                  # the film
node render.mjs launch --upright        # its 9:16 version
node thumbs.mjs                         # thumbnails
node manifest.mjs                       # the shot manifest
./qa.sh ../../videos/sigilfall/Sigilfall-Official-Launch-Trailer.mp4
```

Music is read from `~/Downloads/sigilfall-audio/music` (the full-quality files of the pieces the game ships;
`SIGIL_MUSIC` points elsewhere).

## Things that went wrong once

- **Black rows at the bottom.** A headless window keeps 87 px for a title bar: the window is made that much taller
  than the page (`lib.mjs`), and the first frame of every take is checked for its size.
- **A take that will not play.** Two captures of the same shot at once write one file. One process per shot.
- **Capture speed** is about 16 frames a second in all, whatever the number of processes: a minute of footage is
  some ten minutes of filming.
- **A hero walking into a tree.** The map's paths do not know prop bodies; the pilot steps round after half a
  second (`decide` in `pilot.js`).
- **Waiting on a render with `pgrep -f render.mjs`** matches the waiting shell itself.

## Rules the footage keeps

- Only what a player can do: the pilot presses keys. No slow motion, no speed-up, no frame interpolation.
- "Clean" shots hide the HUD the way the game hides it for its own scenes, and use Settings › camera distance at
  its nearest. The gameplay trailer's footage keeps the HUD.
- The drawn mouse pointer appears only while menus are clicked (a headless browser shows none).
- The Gloamknight (a paid pack) is in no trailer: the films end on "Play free".
