# Mini Racer: design notes

Top-down toy-car time trials (GitHub issue #5). Plain Canvas 2D with no extra dependencies. The game loads as its own lazy
chunk when the player presses Play, and everything is released on unmount (rAF, listeners, observers, AudioContext).

## Files

| File | Role | Pure? |
| --- | --- | --- |
| `geometry.ts` | Catmull-Rom splines, resampling, nearest point, segment crossing | yes |
| `track.ts` | Track model, surfaces, `buildTrack`, `groundAt`, `validateTrack`, PRNG | yes |
| `tracks.ts` | The three handmade tracks (data) | yes |
| `physics.ts` | Arcade car model (yaw, slip/grip, drift, boost), circle/bounds collisions | yes |
| `laps.ts` | Lap timing and checkpoint validation | yes |
| `ghost.ts` | Ghost recording (20 Hz), playback, storage encoding | yes |
| `daily.ts` | Date-seeded daily track generator with its own gold time | yes |
| `sim.ts` | One race: car + track + laps + drift scoring + ghost, plus the autopilot | yes |
| `render.ts` | Canvas drawing (cached Path2D road, low-poly cars, skids, particles, HUD, minimap) | DOM |
| `engine.ts` | Fixed 120 Hz loop, input, adaptive resolution, auto-pause | DOM |
| `audio.ts` | Synthesized engine, tyre squeal and blips (WebAudio) | DOM |
| `storage.ts` | localStorage bests, ghosts, settings (all guarded) | DOM |
| `Game.tsx` / `Game.css` | Menu, pause, results, touch controls, arcade reporting | React |

Tests: `tests/mini-racer.test.ts`.

## Rules worth knowing

- **Checkpoints**: each track has N evenly spaced gates (gate 0 is the line). A lap counts only if every gate was crossed
  in order, in the driving direction. Gates are as wide as the road plus kerbs plus a little more, so cutting across the infield
  misses one and the lap shows as "missed". A shortcut gets its own matching gates for the checkpoints it skips, so
  taking it is legal. Crossing times are interpolated within the physics step.
- **Lap 1** is timed from GO (standing start). Race medals allow 0.9 s for that.
- **Drift**: sliding sideways at speed on the road builds a chain (a multiplier every 1.5 s, up to x4). It banks after
  0.45 s of grip; a chain longer than 0.7 s pays out a turbo. A hard bump loses the chain and marks the lap "bumped" (not clean).
- **Score** (reported to the arcade): `par / lapTime` per valid lap (about 1000 at gold pace), plus drift / 10.
- **Gold times**: handmade tracks have a hand-set `par` that the tests keep within 15% of a tidy autopilot lap. Daily tracks
  get the autopilot's flying lap minus 1.5%.
- **Ghost**: the best valid lap on each track is stored (`gb.mini-racer.ghost.<trackId>`). Hot Lap and Time Trial race against it,
  and a new best replaces it mid-session. Old daily ghosts are pruned.
- **Arcade reporting**: `start` when a race begins (including restarts); `end` when a round finishes, with `lapMs`,
  `raceMs` (valid 3-lap races only), `drift` and `cleanLaps`. Every end goes through `reportEnd(isDaily)` in `Game.tsx`, where
  `isDaily` is true for rounds on today's generated track. That is where the arcade's own-daily flag should go.

## Built in this pass

- 3 handmade tracks (Sunny Bay, Frost Peak, Canyon Run), each with a shortcut, obstacles, and different surfaces
  (asphalt, ice, dirt, mud, sand/snow off-road, boost pads)
- A daily generated track (same for everyone on a calendar day, local best and ghost per day)
- Modes: Time Trial (3 laps), Hot Lap (best of 5, race your ghost), Drift Zone (60 s of drift points)
- Local bests and medals (gold/silver/bronze) per track and mode; 6 car paints, 3 of them unlocked with medals and the daily
- Keyboard and touch controls (automatic gas on touch), instant restart (R / arcade Restart), pause on Esc, tab hide or scroll-away
- Adaptive canvas resolution to hold 60 fps on slower phones; synthesized sound with a mute toggle

## Deferred (not built yet)

- Circuit racing against AI cars (the autopilot in `sim.ts` is a starting point for AI drivers)
- Unlockable cars with different handling (today the unlocks are cosmetic paints; `CarSpec` already supports per-car stats)
- Dedicated drift-challenge tracks or scripted drift zones (today Drift Zone is a 60 s mode on any track)
- A catalogue attract preview (`Preview.tsx` + `GAME_PREVIEWS`); the in-game menu already has an autopilot attract view
- Online leaderboards per track, plus share and download for ghosts
- More handmade tracks; jumps, bridges or crossover tracks (the nearest-point lookup assumes the road never crosses itself)
- Gamepad support
