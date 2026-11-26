# The Rift's bosses of their own (2026-11-25)

Piece 2i of `src/games/sigilfall/NINE_PLAN.md`, the dungeons' part of it: the fourteen bosses of the Smugglers' Grotto,
the Rotmother's Cistern, the Deepforge Halls, the Blightheart and the Spire of the Rift. The lands' named foes are not
part of this.

Pictures by `node scripts/sigilfall-boss-shots.mjs --boss <id> --only-look` on a phone's screen (844 × 390, touch), in
each boss's own room with a warrior of the dungeon's level; the motion strips by the same script with `--motion`.

| File | What it shows |
| --- | --- |
| `line-ups.jpg` | All fourteen beside the hero and two soldiers, at the size a phone shows them, in the order below |
| `<boss>/06-line-up.jpg`, `06-line-up-close.jpg`, `07-portrait.jpg` | The same, whole screen and close, and far closer than the game comes |
| `<boss>/shots.json` | What was pictured, and what the page reported (no errors, for all fourteen) |
| `motion/<boss>/motion.jpg`, `motion.json` | The walk and each attack as strips of frames, and which clip was playing at every reading |

The order on the sheet: the Drowned, Saltbeard, Brother Pustule, Old Sluicegut, the Rot-Mother, the Runewarden, Slag
Colossus; Forgemaster Grold, Rotwood Colossus, Elowen of the Dawn, the Withered Queen, Veil Sentinel, Ilvane the
Unmoored, the Herald in the Spire.

## What the motion check read

Thirteen of fourteen: "It walks when it moves and has a move for every attack."

**The Rot-Mother** is reported wrong by the script ("it was never seen moving") and is as the rules make her: phases 1
and 2 give her a speed of 0 (`data/dungeons/rotmother-cistern.ts`: "sunk to the waist in her brew: she does not move"),
and the script's walk test runs in phase 1. In phase 3, where she does move, the readings during her attacks include
walk and run. Every one of her attacks was read with a move of its own. Nothing was changed for her.

Attacks that never began in the phase the script waited in, so the browser read no clip for them there (each has a move
in the table, which the unit test checks): Saltbeard's black spot (phase 3), the Runewarden's bound (phase 1), Slag
Colossus's shed (phases 1 and 2), Elowen's twins (phase 1), Ilvane's unmoor (phase 2).

Ilvane and the Herald are among the four bosses the test allows to float (`DRIFTS` in
`tests/sigilfall-bosses-move.test.ts`); both walked in 33 of 34 and 48 of 50 moving readings.

## What was not checked

- **No whole fight was pictured** for these fourteen, as was done for the acts' bosses: the entrance, each attack's
  wind-up and strike, the phase changes and the death were not looked at as pictures. The motion check read the clips;
  the strips show them.
- Nothing here was seen on a real phone.
