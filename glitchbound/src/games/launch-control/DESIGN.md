# Launch Control: design notes

A strategic drag racer (GitHub issue #6, asked for as "Drag Kings"; that name clashes with the registered
mobile-game mark DRAG KINGZ, so the game is Launch Control). Glossy cartoon 3D seen from behind your car, five
cars per race, one input: the shift. Rendered with Three.js (the only game in the arcade with a 3D dependency;
it ships in the game's own lazy chunk, so the arcade's startup budget is untouched).

## The round

One quarter mile (402 m) against four rivals, about ten seconds of driving:

1. **The lights**: three ambers half a second apart, then green (seeded jitter). Launch control holds every car
   at its sweet-spot rpm and leaves at green; AI drivers add their own reaction time and launch error.
2. **The run**: tap (Space, or the SHIFT button) when the shift lights flash (88 % of the redline and up).
   Perfect shift = quicker change; early = lost pull; staying on the limiter for more than 0.14 s = late, lost time
   and engine wear. A tap below half the redline is taken as accidental and ignored. The needle follows the gear
   (the wheels) during the clutch launch, so it never crashes after the start.
3. **The finish**: elapsed time (ET), trap speed, perfect shifts, finishing position. First across the line
   wins the purse and the wager; places pay a share.

**Score** (the leaderboard number): `20000 − ET ms + 150 × perfect shifts`, 0 for a breakdown.

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

40 original cars with silhouettes after familiar real shapes (invented makers and names). Six separate parts, each
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
| `scene3d.ts` | Three.js: lofted cars (rounded cross-sections, flat capped nose and tail, fender arches, glass cabin with painted pillars, lamps snapped to the surface), sky reflections, worlds merged per material (~250 draw calls for a race), one shared stage, a thumbnail queue | WebGL |
| `hud.ts` | the driver portrait | DOM |
| `RaceScreen.tsx` | the race on the shared stage: shift lights that flash in the perfect zone, a gauge with the real zones, a zone cue, stray-tap guard, pixel-ratio guard, rotate nudge | React |
| `Game.tsx` / `ui.tsx` / `Game.css` | hub, rivals, setup, result, garage, dealer, daily, ladder, help | React |
| `Preview.tsx` | catalogue attract mode: five cars racing, blitted onto the tile | React |

Tests: `tests/launch-control.test.ts`. Stage aspect is `square`, so phones get a tall stage: the 3D view on top,
the panels below; landscape puts the panels beside the car (container queries).

Tests: `tests/launch-control.test.ts` (simulation, economy, save) and `tests/launch-control-ui.test.tsx` (the whole
game in jsdom with a fake clock: menus, a five-car race shifted on the lights, results, daily leave, garage, wager).
