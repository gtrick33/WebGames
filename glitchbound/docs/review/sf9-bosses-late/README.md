# The later acts' bosses of their own (2026-11-25)

Pieces 2f, 2g and 2h of `src/games/sigilfall/NINE_PLAN.md`: Prior Vessant and General Morvain (the Siege of Highwall),
the Magma Warden, Ossa the Founder and Ashkar the Bound (the Molten Throne), Lady Cendre and Captain Ser Maltheus
(Duskspire). Pictures by `node scripts/sigilfall-boss-shots.mjs --boss <id>` on a phone's screen (844 × 390, touch), in
each boss's own room with a warrior of the dungeon's level; the motion strips by the same script with `--motion`.

| File | What it shows |
| --- | --- |
| `<boss>-sheet.jpg` | Every close-up of the fight on one sheet: the entrance, the line-up, each attack's wind-up and strike in every phase, each phase change, dazed, struck, the death |
| `<boss>/06-line-up.jpg`, `06-line-up-close.jpg`, `07-portrait.jpg` | Beside the hero and two soldiers at the size a phone shows them, and far closer than the game comes |
| `<boss>/shots.json` | What was pictured, and what the page reported (no errors, for all seven) |
| `motion/<boss>/motion.jpg`, `motion.json` | The walk and each attack as strips of frames, and which clip was playing at every reading |

Maltheus's folders go by his id in the rules, `hollow-guard`.

## The numbers

| | Vessant | Morvain | Magma Warden | Ossa | Ashkar | Cendre | Maltheus | The budget |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Triangles in the file | 9,157 | 9,573 | 9,566 | 7,688 | 10,434 | 5,856 | 11,278 | 12,852 (`orc_brute`) |

`tests/sigilfall-bosses-own.test.ts` holds each to the budget, to a move for every attack the rules give it, to its
footprint against its radius, and to light on a small part of it only. `tests/sigilfall-bosses-move.test.ts` names all
seven among the bosses that have been through the pass.

## What the motion check read

For all seven: "It walks when it moves and has a move for every attack."

Attacks that never began in the phase the script waited in, so the browser read no clip for them there (each has a move
in the table, which the unit test checks):

- Prior Vessant: the fallen, in phase 1.
- General Morvain: the squad and the banner, in phases 1 and 3.
- Ashkar: taut and shackles in phase 1, tear in phase 2, crown in phase 3.

The Magma Warden, Ossa, Lady Cendre and Maltheus had every attack read.

## What was not checked

- Nothing here was seen on a real phone.
- The sheets were looked over for a boss that stands, strikes and falls as itself; no picture was compared against the
  old look side by side.
