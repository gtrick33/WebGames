# The Prologue's other three bosses, each its own (2026-11-24)

Piece 2b of `src/games/sigilfall/NINE_PLAN.md`, made the way the Coffin Matron was (piece 2a). Pictures by
`node scripts/sigilfall-boss-shots.mjs --boss <id>` on a phone's screen, each boss in its own room: `<boss>-sheet.jpg`
has every close-up of its fight on one sheet, and `<boss>/` has the line-up and the portrait whole.

| Boss | Before | Now | Triangles (budget 12,852) |
| --- | --- | --- | --- |
| **Grimtusk**, Warlord of the Whisperwood: "a boar the size of a cart" | the pack's Orc Brute at 1.5 times its size, with horns | a great black boar, built as the boar mounts are and bare of any saddle: bristles unbroken down its spine, tusks grown long and wide, the grieflight's violet in its eyes and in the motes about it | 2,418 in its animal's file, more built on in code |
| **Warden Ossric**, Keeper of the Crypt Gate: died at this gate three hundred years ago | a skeleton guard at 1.4 times its size, with a halo | a dead warden of Aster still in his plate: the Knight's armor gone to verdigris, the Regent's blue faded on his cape, a bare skull with two grave candles burning gold (the candles of his fight), a halberd and the dead's great shield | 6,400 |
| **Morgrave**, the Ash-Scholar: thrown out of the Crown City's college, sold to the Host | the Necromancer at 1.35 times its size, with a crown | a stooped, white-haired scholar in spectacles with his pack of books still on his back, in the Host's ash and violet, an open book alight with the rift in one hand and a staff in the other, under the crown the Host gave him | 11,056 |

Each has a move for every attack the rules give it, an entrance, a phase change, a daze and a fall
(`render3d/bossKit.ts`). The rules are untouched.

What to look at with a critical eye: the game's camera looks steeply down, so Ossric and Morgrave are seen mostly as
the tops of their heads, a bare skull and white hair. They read as themselves by what stands round the head (the
candles and the halberd, the violet crown and the pack), less by their faces. Grimtusk's fight is mostly under the
Whisperwood's trees, where the game shows a foe as a pale outline through the leaves.
