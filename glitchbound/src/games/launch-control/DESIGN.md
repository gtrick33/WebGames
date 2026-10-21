# Launch Control: design notes

A strategic drag racer (GitHub issue #6, asked for as "Drag Kings"; that name clashes with the registered
mobile-game mark DRAG KINGZ, so the game is Launch Control). Glossy cartoon 3D seen from behind your car, two
cars per race (you and one rival, head to head), one input: the shift. Rendered with Three.js (the only game in the arcade with a 3D dependency;
it ships in the game's own lazy chunk, so the arcade's startup budget is untouched).

## The round

One quarter mile (402 m) against one rival, about ten seconds of driving, after a show: an intro orbit with the
match-up, burnouts and staging, then the start lights.

1. **The launch**: Formula 1 lights on a gantry over the grid (and in the HUD): five reds come on one a second,
   and with all five lit they go out after a seeded random wait of 0 to 3 s. No rhythm to anticipate. Launch control holds every car
   at its strongest grip-safe rpm; the player taps at lights out. A reaction under 0.3 s is a perfect launch (a
   short kick), under 0.5 s good, slower is a slow start, and no tap goes 1 s after lights out. A tap while the
   lights are on is a jump start: the car goes 0.6 s after lights out, bogged. AI drivers have their own reaction time and launch error.
2. **The run**: each gear has its own shift window, drawn on the tach's ring (the shift button never changes colour): green with yellow either
   side and red above. Everything about a window is drawn from the race seed per gear, so everyone in a race
   shares it and every gear differs: where the green sits (70 to 92 % of the redline), how long the needle takes
   to cross it (0.2 to 0.32 s) and each yellow band (0.12 to 0.26 s, drawn separately below and above). Times
   become revs per car (`shiftWindows`), so a window is equally hard in any car. Green = perfect (a 40 % quicker change and a 32 % kick that
   swells in and fades over a second); yellow = ok; red, or more than 0.14 s on the limiter = late (a slower change); below yellow = early (bogs).
   After every change the clutch bites over 0.14 s, so the push comes back smoothly (the camera's punch eases the same way): no jump forward.
   Hitting the green is always the fastest line. A tap below half the redline is ignored. The needle follows the
   gear (the wheels) during the clutch launch, so it never crashes after the start.
3. **The finish**: elapsed time (ET), trap speed, perfect shifts, finishing position. First across the line
   wins the purse and the wager; second gets a small consolation.

**Score** (the leaderboard number): `20000 − (reaction + ET) ms + 150 × perfect shifts + 150 for a perfect launch`, 0 for a breakdown.

Everything is deterministic: a race is `(cars, drivers, seed)`. A driver is live (your taps), a policy (an AI with
a skill: reaction, launch error, shift timing) or a script (`{ launchRpm, reaction, shifts[], nitro? }`, a ghost; encoded `lc3`,
older `lc1`/`lc2` replays still load).

**Traits** (`TRAIT_INFO` in cars.ts, read by `specOf` and the race): every car has one.

| Trait | What it does |
| --- | --- |
| Featherweight | 4 % lighter; a perfect shift takes half the usual time (other shifts are normal, so it rewards the green) |
| Turbo | soft below 45 % of the revs, then the torque climbs to 118 %: it hits late in every gear |
| Big torque | pulls hardest low and fades at the top; 10 % less launch grip, and the nose lifts (a wheelie on screen) |
| Rev monster | +700 rpm, greens 20 % tighter, a 40 % kick from a perfect shift |
| Electric overdrive | one gear: a charge meter fills over 1.25 s, five times a run; tap in its green for a surge with no clutch gap. A full charge left alone vents (a late tap). The inverter (its transmission upgrade) adds torque |
| Pursuit special | the most forgiving launch: perfect up to 0.36 s, good to 0.56 s; a siren whoop and flashing beacons |
| All-wheel grip | never spins at the launch or after a shift; a launch 0.03 s more forgiving |
| Nitrous | one shot a run: from second gear on, hold the button 0.45 s and it pushes up to 40 % harder for 2.2 s (swelling in and fading). Policy drivers fire it early in third. Not in live rooms (holds aren't synced) or the daily loaner |

The race screen also has speed lines, nitrous flames, a slow-motion photo finish when the two cars cross within
0.15 s (not live), and a coast-down past the line (the quickest cars on a parachute).

## Modes

- **Ladder**: 40 named rivals in five divisions, one at a time; beat them for the rung, a purse and materials.
  Beaten rivals can be rematched. A rival whose car is the one you're driving brings the car nearest it in price
  from their division instead. Each **division final** is a pink slip: the boss drives a car from the next tier
  (tuned down by `BOSS_LEVEL` to stay just quicker than you), and the first win over them puts it in your
  garage, tuning and all (owned already: a fifth of its price in cash). The new car gets a reveal: the garage door
  rolls up on it, then its trait and numbers.
- **Test drive**: one a day, in any car you don't own, stock, against a car like it; no prize, wear or score.
- **King's Gauntlet** (after the Street final): back-to-back races against ever quicker opponents; one loss ends
  the run, and the streak (with the sum of the won races' scores) is one run on the leaderboard.
- **Race a friend** (live): a room on the rooms worker (`room.ts`) seats two phones; each picks a car from its own
  garage and says ready, the room sets a start a few seconds ahead and a seed, and both phones run the same race.
  A tap travels as the sim step it was applied at; the other phone replays the race with it (a late tap replays
  from the start, which takes a millisecond). With both tap lists in, the room replays the race itself and
  settles the winner, so the phones always agree. Friendly: no wear, no failures, no money; a dead heat inside a
  thousandth has no winner.
- **Wager**: odds come from running the race a dozen times in the simulator; an underdog pays more.
  Coins are earned only in the game, never bought.
- **Today's Showdown** (daily): the same loaner car and the same opponent for everyone from the day's seed;
  three runs, best counts. A free **daily crate** (cash and materials by rank).
- **Friends' challenge**: the same loaner against the fastest friend's recorded run, as a ghost.
- **Sponsor income** while away (rate by rank and the car's Looks, capped at 8 hours).

## Bots

`botsFor` picks cars within a tier of yours (never your own car, never the last one on the roster), tunes their
parts so that a *perfect* run of theirs lands about a quarter second behind a perfect run of yours (worn parts slow
a car that is too quick even stock), then gives each a driver skill that only loses time from there. Fair, varied,
never a walkover.

## The garage

28 original cars (invented makers and names), each on a body of its own: RG Poly's low-poly city cars, taxi, tow
truck and police car (most in their factory paint), Cosmo's off-roader, van, police sedan, luxury SUV, rally hatch
and fifties cruiser in the middle, and its muscle car, electric coupe, supercars and hypercar at the top (models.ts,
modelcar.ts; credits in CREDITS.md). Stock pace is tuned so a dearer car is always quicker within its tier and every
tier is clearly quicker than the last (a test checks both). The hub shows the next car to aim for and how far the
cash has to go; the dealer has a collection view (yours in colour, the rest dimmed with their price or the boss to
beat). The drivers sit in closed cars, so their helmet and suit show on a portrait next to their name. Six separate
parts with eight levels each, each moving several numbers:

| Part | Each level | Visible on the car |
| --- | --- | --- |
| Engine | +9 % torque, +60 rpm, +4 kg, −2 % reliability | nothing outside |
| Transmission | −35 ms per shift, +1 % drive efficiency, +1 % reliability | nothing outside |
| Suspension | +5 % launch grip, less wheel hop, −6 kg | lower every level, tyres tucked into the arches |
| Tyres | +6 % grip; wears every race | a coloured sidewall band and lettering per level (STREET to DRAG KING) |
| Aerodynamics | −5.5 % drag, downforce at speed, +3 kg | something new every level: roof spoiler, ducktail and splitter, pedestal wing, diffuser and skirts, carbon wing, canards, swan-neck GT wing, time-attack wing (aero.ts) |
| Looks | +6 % purse from fans, +3 % sponsor pay | livery, underglow, chrome |

Upgrades cost cash plus materials: parts (every level) and rubber (tyres). Only the tyres wear; new ones cost cash,
and below 30 % they can blow mid-race. Cosmetics: helmets, suits, paints, liveries, wheels, four strips.

## Files

| File | Role | Pure? |
| --- | --- | --- |
| `util.ts` | seeded RNG, clamp, formatting | yes |
| `cars.ts` | the roster with stats and a shape recipe per car | yes |
| `parts.ts` | six parts, levels, costs, multi-stat effects, wear, failures | yes |
| `sim.ts` | the race (two cars in play): engine, gearing, traction, launch control, the tree, shifts, drivers, replays | yes |
| `room.ts` | the live room for racing a friend: seats, cars, ready, start time, tap relay, replay and settling | yes |
| `economy.ts` | ladder, bots, purses by position, Monte-Carlo odds, materials, sponsor, crate, daily loaner | yes |
| `cosmetics.ts` / `envs.ts` | cosmetics for sale; the four strips | yes |
| `storage.ts` | the local save (validated) | DOM |
| `scene3d.ts` | Three.js: the stage (race chase camera, garage turntable with a camera focus per part, docking into pop-ups), sky reflections, worlds merged per material, a thumbnail queue; the old lofted car builder stays as a fallback when a model cannot load | WebGL |
| `models.ts` | the 28 CC0 bodies (RG Poly and Cosmo): which body each car uses, the packs' palettes, paint cells and factory wings, loading and caching | WebGL |
| `modelcar.ts` | builds a car from a body: repaint and livery mapping, spinning wheels sized by the tyre upgrade, upgrade parts snapped to the body by raycasts | WebGL |
| `mats.ts` | shared materials, mesh helpers and static-mesh merging | WebGL |
| `hud.ts` | the driver portrait | DOM |
| `alive.ts` | the living track: an instanced crowd that jumps with the race, flags, camera flashes, a blimp, balloons, birds, marshals, confetti cannons | WebGL |
| `RaceScreen.tsx` | the race on the shared stage: the show (intro, burnout, staging), plates, clock, a tach ring with this gear's window, pop-ups, cars drawn between sim steps (no judder), the live mode | React |
| `live.tsx` | race a friend: invite, both cars, ready, the live race, result and running score | React |
| `icons.tsx` | the line icon set (no emoji in the UI) | React |
| `Game.tsx` / `ui.tsx` / `Game.css` | hub (car first), rivals, setup, result, garage, dealer, daily, ladder, help; frosted glass, a condensed slanted display face. Pop-ups with a 3D view can be turned (drag, pinch, scroll, zoom buttons); the parts shop and the garage's repairs inspect a part: the view takes the pop-up, the camera goes to the part, a marker pulses on its spot (anchors from `modelcar.ts`), and the upgrade or repair is right there | React |
| `Preview.tsx` | catalogue attract mode: two cars racing, blitted onto the tile | React |

Stage aspect is `square`, so phones get a tall stage: the car in the upper part, the buttons and panels below;
landscape puts the panels beside the car (container queries).

Tests: `tests/launch-control.test.ts` (simulation, economy, save) and `tests/launch-control-ui.test.tsx` (the whole
game in jsdom with a fake clock: menus, a head-to-head race shifted on the lights, results, daily leave, garage,
wager, the gauntlet) and `tests/launch-control-room.test.ts` (the live room, and both phones agreeing).
