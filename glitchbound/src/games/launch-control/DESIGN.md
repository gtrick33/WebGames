# Launch Control: design notes

A strategic drag-racing game (GitHub issue #6, asked for as "Drag Kings"; that name clashes with the registered
mobile-game mark DRAG KINGZ, so the game is called Launch Control). Bright low-poly 3D cars on sunny strips seen from a
chase camera behind the cars, rendered with Three.js (the only game in the arcade with a 3D dependency; it ships in the
game's own lazy chunk, so the arcade's startup budget is untouched). Cars are built procedurally from a side profile per
body style, extruded and bevelled, so every car is a real mesh and every part is real geometry.

## The round

One quarter-mile (402 m) race against one opponent, about ten seconds of driving:

1. **Staging**: the tree lights three ambers, half a second apart. Hold the pedal (Space, or the big button) to build
   revs; let go to drop them. Every car has a launch window: too many revs spin the tyres, too few bog the launch.
2. **Green**: release the pedal to launch. Releasing before green is a red light: disqualified, wager lost.
   Reaction time = release − green.
3. **The run**: tap to shift. The tacho shows the sweet spot just under the redline; shifting there is a *perfect*
   shift, early loses pull, late bounces off the limiter (time lost, engine wear).
4. **The finish**: elapsed time (ET), trap speed, reaction and perfect shifts. The winner is the car that crosses
   first (ET + reaction).

**Score** (the leaderboard number, higher is better): `20000 − ET ms − 2 × reaction ms + 150 × perfect shifts`,
0 for a red light or a breakdown. A stock starter car scores ~5 000, a tuned hypercar ~13 000.

Everything is deterministic: a race is `(player car, opponent car, seed, driver scripts)`. A driver script is
`{ launchRpm, reaction, shifts[] }`, which is how AI opponents drive, how friends' ghosts are replayed and what the
tests use.

## Modes

- **Ladder** (the campaign): 40 named opponents in five divisions (Street, Club, Pro, Elite, Legend); a win moves
  you up and pays a purse plus materials the first time. Any beaten opponent can be rematched for the base purse.
- **Wager**: before a race you see both cars' stats and a forecast ET for each. Stake part of your cash; the payout
  multiplier comes from the forecast (an underdog pays more). Coins are earned only in the game, never bought.
- **Today's Showdown** (daily, `ownDaily`): everyone gets the same loaner car and opponent from the day's seed;
  3 tries, best score counts; share line is spoiler-free.
- **Friends' challenge**: the same loaner from the challenge seed, one run; your run is sent as a replay and the
  others race your ghost.
- **Idle income**: your sponsor pays per hour while you are away (rate grows with your ladder rank, capped at 8 h).

## The garage

30+ original cars (recognisable silhouettes, invented names: no real makes or models). Each car has six separate
parts, each with 8 levels and its own condition:

| Part | What it changes | Visible on the car |
| --- | --- | --- |
| Engine | torque curve, redline | hood scoop, turbo pipes |
| Transmission | shift time, closer gears | shift-light badge |
| Suspension | weight transfer (launch grip), wheel hop | ride height, stance |
| Tyres | grip; wear every race, worn tyres slip | wheel width, slicks |
| Aerodynamics | drag | splitter, spoiler, diffuser |
| Looks | fans: a bonus on every purse | livery, underglow |

Upgrades cost cash plus **materials** (scrap, alloy, carbon, chips, rubber) earned from wins, the daily and ladder
milestones. Parts wear with use; below 30 % condition a part can fail mid-race (blown engine, stuck gearbox, tyre
blowout…), with a chance that comes from the race seed and the car's reliability. Repairs cost cash.

Cosmetics (cash only): driver helmets and suits, paint colors, liveries, wheel styles, and four environments
(desert strip, harbor mile, alpine run, lantern fair).

## Files

| File | Role | Pure? |
| --- | --- | --- |
| `util.ts` | seeded RNG, clamp, formatting | yes |
| `cars.ts` | the roster: stats, body style, tier, price | yes |
| `parts.ts` | six parts, levels, costs, wear, stat effects, failures | yes |
| `sim.ts` | the race: engine, gearing, traction, drag, tree, shifts, drivers, scripts, replays | yes |
| `economy.ts` | ladder, forecast, wager odds, purses, materials, idle income, the daily loaner | yes |
| `cosmetics.ts` | helmets, suits, paints, liveries, wheels, environments | yes |
| `storage.ts` | the local save (validated), cars owned, parts, cosmetics, daily records | DOM |
| `envs.ts` | the four strips: colors, scenery kinds | yes |
| `scene3d.ts` | Three.js world per strip, procedural cars with parts and canvas-texture liveries, chase and turntable cameras, thumbnails | DOM/WebGL |
| `hud.ts` | the 2D overlay: tacho with launch window and shift zone, progress bar, banners, popups; driver portrait | DOM |
| `sound.ts` | engine note by RPM, shifts, tree, cash, failures (WebAudio, no files) | DOM |
| `Game.tsx` / `Game.css` | hub, garage, race setup, race, result | React |
| `Preview.tsx` | catalogue attract mode: two cars racing in 3D, blitted onto the tile | React |

Tests: `tests/launch-control.test.ts`.
