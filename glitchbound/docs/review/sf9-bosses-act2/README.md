# Act II's bosses of their own (2026-11-25)

Piece 2d of `src/games/sigilfall/NINE_PLAN.md`: King Hrodric and Sir Corvane (the Barrow of Kings), Silas Vey and the
Royal Auditor (the Crown Catacombs). Pictures by `node scripts/sigilfall-boss-shots.mjs --boss <id>` on a phone's
screen (844 × 390, touch), in each boss's own room with a warrior of the dungeon's level; the motion strips by the same
script with `--motion`.

| File | What it shows |
| --- | --- |
| `<boss>-sheet.jpg` | Every close-up of the fight on one sheet: the entrance, the line-up, each attack's wind-up and strike in every phase, each phase change, dazed, struck, the death |
| `<boss>/06-line-up.jpg`, `06-line-up-close.jpg`, `07-portrait.jpg` | Beside the hero and two soldiers at the size a phone shows them, and far closer than the game comes |
| `<boss>/shots.json` | What was pictured, and what the page reported (no errors, for all four) |
| `motion/<boss>/motion.jpg`, `motion.json` | The walk and each attack as strips of frames, and which clip was playing at every reading |

## Who they are

**King Hrodric, the Barrow King.** A dead king of the old line, woken under his own mound. The giant's body in pale
grave-steel, a bare skull grown large, a crown of gold spikes built on it, the two-handed sword alight with
grave-frost, his round shield on his back. Before: the pack's large Barbarian, tinted.

**Sir Corvane the Fallen, First Grave Knight of the Hallow King.** He held the downs nine days for a relief that was
called off. The Black Knight's plate and cape, broad in the chest, great sword and shield, and on his back the banner
of the Ninefold Watch he would not put down, leaned so the game's steep camera sees its cloth. Mounted and on foot he
is the same figure. Before: the Black Knight as the pack ships it.

**Silas Vey, the Herald's Last Hand.** The spymaster who paid every traitor in Aster. The hooded Rogue, masked, the
Hoarder's purses at his belt, a long knife, and a stack of ash-gold alight in his off hand: what he throws about the
ossuary. Before: the Rogue, tinted.

**The Royal Auditor, Keeper of the Old Kings' Accounts.** "He kept the old kings' accounts for forty years and died at
his desk." The Cleric's robes on a bare skull with the Lorekeeper's spectacles, the ledger open in one hand, the pen in
the other, a candle at his shoulder. He stands on the floor (he used to drift). Before: the Skeleton Mage, tinted.

Left as they are, on purpose: **Gloomwing** is already a one-off build, and **Maelis Crane** keeps the look he has as a
person of the city, since the player has known him by it for an act.

## The numbers

| | Hrodric | Corvane | Silas Vey | The Auditor | The budget |
| --- | --- | --- | --- | --- | --- |
| Triangles in the file | 10,034 | 11,467 | 11,179 | 7,985 | 12,852 (`orc_brute`) |
| File (`k/boss_*.pack`) | 136 KB | 160 KB | 139 KB | 110 KB | loaded with the dungeon |
| Skeleton | large | large | medium | medium | one of the two shared |

`tests/sigilfall-bosses-own.test.ts` holds each to the budget, to a move for every attack the rules give it, to its
footprint against its radius, and to light on a small part of it only. `tests/sigilfall-bosses-move.test.ts` names all
four among the bosses that have been through the pass.

## What the motion check read

For all four: "It walks when it moves and has a move for every attack."

| Boss | Walking | Attacks and the clips read while they ran |
| --- | --- | --- |
| Hrodric | 59 of 61 moving readings in a walk or run (the other two mid-swing) | cleave: slice; chop: chop2; frost pulse: smash; summon: cast; whirl: spin; roar: taunt |
| Corvane | walk or run in every phase | steed-charge and triple charge: bash; cleave: slice; lances: stab; halves: smash; doom: chop; rime: cast; chop: chop2; summon and roar: taunt; dismount and vanish: dodge |
| Silas Vey | 41 of 41 | boomerang: throw; cleave: slice; scatter: cheer |
| The Auditor | 55 of 57 (the other two mid-throw) | quills: throw; cleave: slice; settle: summon |

Three attacks never began in the phase the script waited in, so no clip was read for them there: Silas's scatter in
phase 1 (read in phase 2), the Auditor's ledger in phase 1, and Corvane's aura in phase 3. Each has a move in the
table (the unit test checks that); the browser did not see the last two play.

## What was not checked

- Corvane's banner was repainted darker (a faded navy rather than bright blue) after these pictures; the sheet shows
  it as it was before, and the darker one has not been pictured.
- Nothing here was seen on a real phone.
