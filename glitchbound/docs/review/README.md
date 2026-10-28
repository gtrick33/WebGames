# Sigilfall review evidence (blueprint §14.4–14.5)

Screenshots taken in the running game on the dev server (`window.__rbShot`), by phase. Every phase was
checked with `npx tsc --noEmit -p .`, `npx eslint src/games/sigilfall tests/sigilfall*`,
`npx vitest run --no-fsModuleCache tests/sigilfall*` and `npm run build` before its commit; the commit is the
rollback point.

| Folder | What it shows | Commit |
| --- | --- | --- |
| `phase-02/` | Briarhollow in each state, the Prologue, the Chapel Crypt; the village's interiors (inn, chapel, Elder's Hall) | `cfa989ce`, `c6880065` |
| `phase-04/` | The hero smoothed to the world's resolution, on foot and mounted (CHARACTER_ART_BIBLE.md) | `84892874` |
| `phase-05/` | The new skills and their effects | `a409df85` |
| `phase-06/` | Mounts: the Chestnut in its facings, the Royal Warhorse with a Wardrobe hat, the mount sheets | `1c10c246`, `ea3816c4` |
| `phase-07/` | Ruins of each land's own stones, meadows in clumps | `df50cd5f`, `de19cedc` |
| `phase-09/` | The first-dawn scene in Briarhollow | `780f6ca8` |
| `phase-12/` | The Crown City's interiors: the Ember Hearth, the Great Hall, Brannoc's Forge | `c6880065` |
| `phase-13/` | Each dungeon's own entrance | `b48c132f` |
| `phase-14/` | Act IV–V beats: Elyra by Lastlight's fire, Ysane's echo at the frozen lodge, the Muster Hall field, Hollowmere | `26ee957e`, `d2748d90` |
| `review-tour/` | Every land at 640 × 360 (the visual review; `*-fixed.png` after the ground-seam fix) | `59d5e978` |
| `one-pack/` | Before and after, side by side: the world in Royal Keep alone (Briarhollow's gate, square, chapel and inn, Thornvale, Emberwick's market, Greyfen, Rimeheld); the marked doors; the chapel with the skill bar put away. `dense-*`: the second pass (villages along streets, townsfolk, Briarhollow at its plan's size, Emberwick's streets) | the one-pack branch |
| `villages/` | Villages small, full and each its own: one of each plan from above (crossroads, market street, green, walled hold), the views a player gets of their squares, Briarhollow and Emberwick whole | the one-pack branch, third pass |
| `moods/` | The frightening lands: the Weeping Woods' lamp-lit road, village and graves, the Grimward graveyard, Duskfen's fen, the Ashen Barrows, the Blightwood | the one-pack branch, third pass |

## Heavy scene (Prompt 16)

The field before the Muster Hall (bonefields, review preset `muster-hall`): 212 enemies alive in the land,
six allies, the battle under way. In the dev browser with its pane hidden, a simulation step took under 0.2 ms
(enemies far from the hero sleep) and a 1280 × 720 frame under 1 ms to submit. A hidden pane defers its
drawing, so the draw figure is **indicative only**; frame times on a phone are **unverified**.
