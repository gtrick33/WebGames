# Act III's bosses of their own (2026-11-25)

Piece 2e of `src/games/sigilfall/NINE_PLAN.md`: the Sun King, Vizier Khepset and the Sand Warden (the Tomb of the Sun
King), Jarl Hrimfang and Hallvor (the Rimeheld Vault). Pictures by `node scripts/sigilfall-boss-shots.mjs --boss <id>`
on a phone's screen (844 × 390, touch), in each boss's own room; the motion strips by the same script with `--motion`.

| File | What it shows |
| --- | --- |
| `<boss>-sheet.jpg` | Every close-up of the fight on one sheet: the entrance, the line-up, each attack's wind-up and strike in every phase, each phase change, dazed, struck, the death |
| `<boss>/06-line-up.jpg`, `06-line-up-close.jpg`, `07-portrait.jpg` | Beside the hero and two soldiers at the size a phone shows them, and closer |
| `<boss>/shots.json` | What was pictured, and what the page reported (no errors, for the four that have one) |
| `motion/<boss>/motion.jpg`, `motion.json` | The walk and each attack as strips of frames, and which clip was playing at every reading |

## Who they are

**The Sun King, Risen Lord of the Old Kingdom.** A king's coat in the old kingdom's white and gold on a bare skull, a
crown of gold spikes and a halo built on it, his staff of office, and behind his head the great sun-disc of his
house, gold, its face alight. Before: the Skeleton Mage, tinted.

**Vizier Khepset, Keeper of the Last Hour.** A court mage's robes in the deep blue-green of the tomb's glazed tiles
under a hood of the house's gold, his rod of office, and in his left hand the sand-glass he turns, built in code and
alight. On his first pictures he was sand-white on a sand floor and the glass was too small to see; both were changed.
He stands on the floor (he used to drift).

**The Sand Warden, Guardian of the Sun King's Tomb.** Built, not buried: the bone golem's frame cut in red sandstone,
dark in the joints, a soldier's shoulder plates, a mace of the house's gold, the sun-disc on its back. On its first
pictures it was pale stone on pale sand and the disc sat on its chest where the camera never saw it.

**Jarl Hrimfang, Jarl of the Rime Giants.** The giant whole, ice-blue under a white bear's head and pelt, a great
maul with rime on it, and at his belt the ash-gold he sold his treaty for. (The maul was first bigger than he was.)

**Hallvor, Ingrith's Shield-Thane.** The helmed Paladin's plate and cape gone the blue of old ice, crystals of it on
her helm, a halberd, and the great shield she is named for.

## The numbers

| | The Sun King | Khepset | The Sand Warden | Hrimfang | Hallvor | The budget |
| --- | --- | --- | --- | --- | --- | --- |
| Triangles (with what is built in the browser) | 6,614 in the file | 5,834 | 8,518 | 11,283 | 7,784 | 12,852 (`orc_brute`) |
| File (`k/boss_*.pack`) | 90 KB | 77 KB | 122 KB | 148 KB | 112 KB | loaded with the dungeon |
| Skeleton | medium | medium | large | large | medium | one of the two shared |

`tests/sigilfall-bosses-own.test.ts` holds each to the budget, to a move for every attack, to its footprint against
its radius, and to light on a small part of it only; `tests/sigilfall-bosses-move.test.ts` names all five.

## What the motion check read

For all five: "It walks when it moves and has a move for every attack."

| Boss | Walking | Attacks and the clips read while they ran |
| --- | --- | --- |
| The Sun King | 50 of 52 moving readings in a walk (two mid-channel) | cleave: slice; sunbeam and pyre: channel; sun-disc: summon; volley: throw; scarabs: wave; orbit: cheer; sunspot: cast; roar: taunt |
| Khepset | 50 of 51 | sinkhole: cast; hourglass: channel; summon: summon |
| The Sand Warden | 56 of 59 | cleave: slice; chop: chop2; quicksand: cast; sandsweep: spin; slamRings: smash |
| Hrimfang | 49 of 52 | cleave: slice; shatter: smash; boulder: punch; warcry: taunt; triple charge: bash; chop: chop2 |
| Hallvor | 44 of 46 | cleave: slice; chop: chop2; pin: stab; orders: wave; triple charge: bash; summon: summon |

Two attacks never began while the script waited: Khepset's hourglass in phase 1 (read in phase 2) and the Sand
Warden's crumble in phase 2. Both have a move in the table; the browser did not see the Warden's crumble play.

## What was not checked

- **The Sun King's whole fight was pictured on the fifth try**, with the script's 30-second limit on a screenshot
  raised to three minutes (his sheet and `shots.json` are from that run: 50 pictures, entrance to death, no page
  errors). Three earlier runs stopped on that limit at his sunbeam or his orbit. The cause is the test browser, which
  draws without a graphics card, on a machine doing other heavy work at the same time: frames in his room took 1.5 to
  10 seconds each then, and a screenshot needs several. His new figure is not the cause: held still in the same room,
  back to back and twice each, the old model drew a frame in 118 to 255 ms and the new one in 124 to 162 ms. His
  phase 3 is the heaviest moment (about 420 effect sprites, 190 warning shapes and 170 ground fields at once), as it
  was with the old model. How it runs on a real phone was not measured.
- Nothing here was seen on a real phone.
