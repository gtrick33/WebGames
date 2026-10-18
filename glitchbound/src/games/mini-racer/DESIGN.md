# Mini Racer: design notes

Top-down toy-car races with one-touch steering (GitHub issue #5). Plain Canvas 2D with no extra dependencies. The game loads as its own lazy
chunk when the player presses Play, and everything is released on unmount (rAF, listeners, observers, AudioContext).

## Files

| File | Role | Pure? |
| --- | --- | --- |
| `geometry.ts` | Catmull-Rom splines, resampling, nearest point, segment crossing | yes |
| `track.ts` | Track model, surfaces, `buildTrack`, `groundAt`, `validateTrack`, PRNG | yes |
| `tracks.ts` | The seven handmade tracks (data), each with a type | yes |
| `cars.ts` | Car collection: looks, small handling trade-offs, unlocks, coin rewards | yes |
| `physics.ts` | Arcade car model (yaw, slip/grip, steering-driven slide, boost, loose-ground tyres), collisions | yes |
| `laps.ts` | Lap timing and checkpoint validation | yes |
| `sectors.ts` | Sector splits (3 per lap), deltas vs a reference lap, reference selection | yes |
| `ghost.ts` | Ghost recording (20 Hz), playback, storage encoding | yes |
| `daily.ts` | Date-seeded daily track generator with its own gold time | yes |
| `sim.ts` | One race: player + AI racers, collisions, laps, sectors, positions, drift, ghost; the driver/autopilot | yes |
| `render.ts` | Canvas drawing (cached Path2D road, textured surfaces, five car bodies, skids, particles, HUD, km/h gauge, minimap) | DOM |
| `engine.ts` | Fixed 120 Hz loop, half-screen touch + keyboard steering, adaptive resolution, auto-pause | DOM |
| `audio.ts` | Synthesized lo-fi race music loop, soft engine hum, tyre squeal and blips (WebAudio, no files) | DOM |
| `storage.ts` | localStorage bests, ghosts, settings (all guarded) | DOM |
| `Game.tsx` / `Game.css` | Menu, pause, results, touch controls, arcade reporting | React |

Tests: `tests/mini-racer.test.ts`.

## Rules worth knowing

- **Controls**: gas is always on. Hold the left or right half of the track (touch, pen or mouse) or Left/Right or A/D to
  steer; holding both halves goes straight. There is no brake or drift button. Holding a hard turn above ~42% of top speed
  builds `slide` (0..1): the tail steps out, the car rotates faster and scrubs a little speed. Straightening up regrips.
- **Surfaces** (`SURFACES` in `track.ts`): tarmac, gravel, dirt, sand, snow, grass, mud, ice and boost strips, each with its
  own speed, acceleration, grip and drag. Loose ones (dirt, gravel, sand, grass, mud, snow) are softened by a car's `loose`
  stat (`onLoose`). Each surface has its own texture and a chip in the menu.
- **Checkpoints**: each track has N evenly spaced gates (gate 0 is the line). A lap counts only if every gate was crossed
  in order, in the driving direction. Gates reach about 45 units past the kerb, which forgives running wide in a bend but still
  catches a cut across the infield (tested). A shortcut gets its own matching gates for the checkpoints it skips.
- **Start line**: `startOnStraight` moves each loop's origin a little way into its longest straight (never inside a shortcut's
  stretch), so the grid and line sit on a straight and a car with automatic gas leaves the grid on the road.
- **Rescue**: a car crawling for 1.5 s or off the road for 3 s is put back on the nearest road (or shortcut), facing forward.
  The car can also pivot slowly at low speed, so it can never be pinned nose-first against a wall.
- **Barriers**: tyre walls run WALL_GAP (40) past the kerb on both sides of every track (`buildWalls`). A wall point is dropped
  where it would sit closer to another stretch of road (hairpins) or on a shortcut, so shortcuts stay open. Cars slide along walls:
  the push-out removes the speed into the wall, a real impact scrubs 14%, resting contact costs a little each step. Checkpoint
  validation still applies to anything that gets past.
- **Solid scenery**: every prop (trees, umbrellas, rocks...) and obstacle is a circle collider (`decorRadius`). Props are placed
  outside the walls. Walls, props and obstacles are bucketed in a 160-unit grid, so each car checks one cell per step.
- **Track types** (`TRACK_TYPES` in `track.ts`) decide what drifting does. The slide scrub (speed lost per second at full slide) is
  circuit 170, oval 240, snow 55 and rally 15, and only rally pays a turbo for a banked drift chain. Rally also changes the
  handling (`Handling` in `physics.ts`): the tail steps out at 32% steering above 30% of top speed (grip types need 55% above
  42%), the slide builds twice as fast and turn-in is 15% sharper, so turning in hard at speed drifts naturally. Measured on one layout with the
  same 0.6 s weave at top speed: oval -17 km/h, circuit -10, snow 0, rally +3. Tracks: Sunny Bay and Meadow Mile are circuits,
  Frost Peak is snow (mostly ice), Canyon Run, Sugar Rush and Dune Dash are rally, Speed Bowl is the oval; daily tracks get a type
  from their theme (bay = circuit, frost = snow, canyon = rally). AI rivals never slide on circuits and ovals: they steer short of
  the slide threshold and brake into tight bends instead.
- **AI level** 0-100 (`aiStyle`): pace (0.84 at 0, 0.96 at 50, 1.01 at 90, 1.045 at 100 of the starter car), line (inside use),
  steering wobble, steering speed, braking skill (`lift`) and, at 100 only, 4% more grip all rise smoothly. Catch-up applies only
  below level 40 (up to +4% pace when far behind). Level 100's best lap lands within about 5% of the optimal autopilot lap (tested).
  Beating rivals adds level x (rivals behind you) race points, at most 300, only for a counted race.
- **Modes**: Time Trial (alone, with your ghost; sectors vs your best-ever lap) and Race (3 AI rivals on a staggered grid, you start
  at the back; sectors vs your previous lap). AI rivals use `drive()` with the style for the chosen AI level (see above). Cars bump as equal-mass circles. Position = finished first by time, then by distance driven.
- **Sectors**: 3 per lap, split at checkpoint gates (`sectorGates`). A split = lap time at the line; delta vs the reference's split
  at the same line (green faster, red slower). The best lap's splits are saved with your bests (`bests[track].splits`) as the Time
  Trial reference. Laps that missed a checkpoint get no splits.
- **Races** are always 3 laps. Lap 1 is timed from GO, and race medals allow 0.9 s for that start.
- **Drift**: sliding sideways at speed builds a chain (a multiplier every 1.5 s, up to x4). It banks after 0.45 s of grip,
  and a chain longer than 0.7 s pays out a turbo. A hard bump loses the chain and marks the lap "bumped" (not clean).
- **Leaderboard score** (`scoreFor`): race points = `1000 x gold lap / lap time` per valid lap (about 3000 for a gold-pace race).
  Higher is better, it can be compared across tracks, and a lap that missed a checkpoint scores 0. The registry
  `limits` (160 points per second, at least 15 s) reject forged scores; a test checks that even a race 25% faster than gold fits.
- **Cars**: 10 cars (coupe, buggy, formula, van and bubble bodies). Seven unlock with coins and two with gold medals on the handmade
  tracks; Pip is the starter. Coins per race: 10 + 3 per valid lap + medal (8/15/25) + new record 10 + first daily finish 30.
  Handling trade-offs are small; tests keep every car within 6% of Pip on every track and within 2.5% on average.
- **Full speed**: circuits, rally tracks and the oval have no slow surface across the racing line. Dirt and gravel are fast but
  loose (96-98% speed); sand and mud only appear as edge strips or off the road, to punish running wide. Layouts are twisty
  (esses on the old straights, 136-150 wide roads) but taken flat out by steering: an autopilot lap averages 92-100% of top speed
  (tested above 88%). Frost Peak (snow) is unchanged.
- **Gold times**: hand-set `par` per track, which tests keep within 15% of a tidy autopilot lap. Daily tracks get the autopilot's
  flying lap minus 1.5%; a generated layout the autopilot can't lap cleanly at full speed (a bend too tight with no brake) is
  rejected and the next seed is tried.
- **Ghost**: the best valid lap on each track (`gb.mini-racer.ghost.<trackId>`); old daily ghosts are pruned.
- **Arcade reporting**: `start` when a race begins (including restarts). Every `end` goes through `reportEnd(isDaily)` in `Game.tsx`
  with `score` (race points), `raceMs`, `lapMs`, `drift` and `cleanLaps`. `daily: true` is sent for races on today's generated track.

## Built so far

- One-touch controls (hold a screen half, or Left/Right / A/D), automatic gas, drift that comes from steering
- 6 handmade tracks (Sunny Bay, Frost Peak, Canyon Run, Meadow Mile, Sugar Rush, Dune Dash) plus a daily generated track;
  the first three have shortcuts
- Distinct, textured surfaces with their own grip and speed, listed per track in the menu
- km/h speedometer, lap/time/best HUD, minimap, ghost of your best lap
- 3-lap races with local bests (race and lap) and medals per track, shown on the track cards and the menu
- Car collection with coins, medal unlocks and balanced handling; garage screen
- Leaderboard-ready score with registry `limits`
- Adaptive canvas resolution; synthesized sound with a mute toggle
- Race music: an 88 BPM lo-fi loop (Fmaj7-Em7-Dm7-Cmaj7 pad, sine bass, swung pluck arpeggio, soft kick/snare/hats) scheduled on
  the audio clock; it fades in when a race starts, out on the menu, freezes on pause, follows the sound toggle and stops on unmount.
  The engine is a quiet low hum under it.

## Deferred (not built yet)

- AI overtaking intelligence (rivals dodge cars ahead but don't plan passes or defend); more than 3 rivals; AI on the daily track uses the same styles
- Drift challenges (the Hot Lap and Drift Zone modes were removed for the one-touch rework; drift points are still a stat)
- A catalogue attract preview (`Preview.tsx` + `GAME_PREVIEWS`); the in-game menu already has an autopilot attract view
- Leaderboards per track (the arcade ranks one score per game), plus share and download for ghosts
- Shortcuts on the three newer tracks
- Walls along the shortcuts themselves (the infield is closed off by the main walls, so a shortcut can't be used to cut further)
- More handmade tracks; jumps, bridges or crossover tracks (the nearest-point lookup assumes the road never crosses itself)
- Gamepad support
