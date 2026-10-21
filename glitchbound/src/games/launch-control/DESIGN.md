# Launch Control: design notes

A strategic drag racer (GitHub issue #6, asked for as "Drag Kings"; that name clashes with the registered
mobile-game mark DRAG KINGZ, so the game is Launch Control). Glossy cartoon 3D seen from behind your car, five
cars per race, one input: the shift. Rendered with Three.js (the only game in the arcade with a 3D dependency;
it ships in the game's own lazy chunk, so the arcade's startup budget is untouched).

## The round

One quarter mile (402 m) against four rivals, about ten seconds of driving:

1. **The launch**: three ambers half a second apart, then green (seeded jitter). Launch control holds every car
   at its strongest grip-safe rpm; the player taps to go. A reaction under 0.28 s is a perfect launch (a short
   kick), under 0.45 s good, slower is a slow start, and no tap goes at green + 1 s. A tap during the ambers is a
   jump start: the car goes at green + 0.6 s, bogged. AI drivers have their own reaction time and launch error.
2. **The run**: each gear has its own shift window, drawn on the rev strip and the gauge: green with yellow either
   side and red above. Where the green sits (78 to 90 % of the redline) comes from the race seed, so everyone in
   a race shares the spots; how wide it is comes from the car (`shiftWindows`), so the needle takes about a quarter of a second to
   cross the green in any car's lower gears. Green = perfect (a 40 % quicker change and an 18 % kick for 0.8 s);
   yellow = ok; red, or more than 0.14 s on the limiter = late (a slower change); below yellow = early (bogs).
   Hitting the green is always the fastest line. A tap below half the redline is ignored. The needle follows the
   gear (the wheels) during the clutch launch, so it never crashes after the start.
3. **The finish**: elapsed time (ET), trap speed, perfect shifts, finishing position. First across the line
   wins the purse and the wager; places pay a share.

**Score** (the leaderboard number): `20000 − (reaction + ET) ms + 150 × perfect shifts + 150 for a perfect launch`, 0 for a breakdown.

Everything is deterministic: a race is `(cars, drivers, seed)`. A driver is live (your taps), a policy (an AI with
a skill: reaction, launch error, shift timing) or a script (`{ launchRpm, reaction, shifts[] }`, a ghost).

## Modes

- **Ladder**: 40 named rivals in five divisions. The rival plus three bots in cars tuned like yours fill the
  lanes; beat the field for the rung, a purse and materials. Beaten rivals can be rematched.
- **Wager**: odds come from running the race a dozen times in the simulator; an underdog pays more.
  Coins are earned only in the game, never bought.
- **Today's Showdown** (daily): the same loaner car and the same four rivals for everyone from the day's seed;
  three runs, best counts. A free **daily crate** (cash and materials by rank).
- **Friends' challenge**: the same loaner; friends' recorded runs race as ghosts, bots fill the rest.
- **Sponsor income** while away (rate by rank and the car's Looks, capped at 8 hours).

## Bots

`botsFor` picks cars within a tier of yours, tunes their parts so that a *perfect* run of theirs lands about a
quarter second behind a perfect run of yours (worn parts slow a car that is too quick even stock), then gives
each a driver skill that only loses time from there. Fair, varied, never a walkover.

## The garage

43 original cars (invented makers and names) on 16 CC0 low-poly bodies, each car with its own size and shape tweaks (models.ts, modelcar.ts; credits in CREDITS.md). Six separate parts, each
with eight levels and its own condition, each moving several numbers:

| Part | Each level | Visible on the car |
| --- | --- | --- |
| Engine | +9 % torque, +60 rpm, +4 kg, −2 % reliability | hood scoop, twin pipes with flames |
| Transmission | −35 ms per shift, +1 % drive efficiency, +1 % reliability | shift light |
| Suspension | +5 % launch grip, less wheel hop, −6 kg | lower stance |
| Tyres | +6 % grip; wears every race | wider wheels, slicks |
| Aerodynamics | −5.5 % drag, downforce at speed, +3 kg | splitter, wing, diffuser |
| Looks | +6 % purse from fans, +3 % sponsor pay | livery, underglow, chrome |

Upgrades cost cash plus materials (scrap, alloy, carbon, chips, rubber). Below 30 % condition a part can fail
mid-race; repairs cost cash. Cosmetics: helmets, suits, paints, liveries, wheels, four strips.

## Files

| File | Role | Pure? |
| --- | --- | --- |
| `util.ts` | seeded RNG, clamp, formatting | yes |
| `cars.ts` | the roster with stats and a shape recipe per car | yes |
| `parts.ts` | six parts, levels, costs, multi-stat effects, wear, failures | yes |
| `sim.ts` | the race for up to five cars: engine, gearing, traction, launch control, shifts, drivers, replays | yes |
| `economy.ts` | ladder, bots, purses by position, Monte-Carlo odds, materials, sponsor, crate, daily loaner | yes |
| `cosmetics.ts` / `envs.ts` | cosmetics for sale; the four strips | yes |
| `storage.ts` | the local save (validated) | DOM |
| `scene3d.ts` | Three.js: the stage (race chase camera, garage turntable with a camera focus per part, docking into pop-ups), sky reflections, worlds merged per material, a thumbnail queue; the old lofted car builder stays as a fallback when a model cannot load | WebGL |
| `models.ts` | the 16 CC0 bodies: which body and proportions each car uses, shape tweaks (chopped roof, wide hips, long hood), loading and caching | WebGL |
| `modelcar.ts` | builds a car from a body: repaint and livery mapping, spinning wheels sized by the tyre upgrade, upgrade parts snapped to the body by raycasts | WebGL |
| `mats.ts` | shared materials, mesh helpers and static-mesh merging | WebGL |
| `hud.ts` | the driver portrait | DOM |
| `RaceScreen.tsx` | the race on the shared stage: a rev strip and gauge with this gear's window, launch and shift pop-ups, a zone cue, stray-tap guard, pixel-ratio guard, rotate nudge | React |
| `Game.tsx` / `ui.tsx` / `Game.css` | hub, rivals, setup, result, garage, dealer, daily, ladder, help | React |
| `Preview.tsx` | catalogue attract mode: five cars racing, blitted onto the tile | React |

Tests: `tests/launch-control.test.ts`. Stage aspect is `square`, so phones get a tall stage: the 3D view on top,
the panels below; landscape puts the panels beside the car (container queries).

Tests: `tests/launch-control.test.ts` (simulation, economy, save) and `tests/launch-control-ui.test.tsx` (the whole
game in jsdom with a fake clock: menus, a five-car race shifted on the lights, results, daily leave, garage, wager).
