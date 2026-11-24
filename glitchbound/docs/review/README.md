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
| `opening/` | The night-first Prologue: the title's new line, the arrival at the gate as the lamps are lit, Mara's "turn around", the first fight with its control hint, the lanes at night, the courier fallen in the gateway, the burning inn; the raid's night before PR #71, washed out after it, and dark again (`4-night-in-the-lanes`); the ultimate's charge on the desktop bar and the touch button. `7-`–`12-`: the second pass (the lesson on the bar, desktop and touch; the bell tolling by itself, the camera on the chapel and the east roofs as they catch; the raid coming out of the smoke at the square; the courier coming up the dark road with his light). `13-`–`20-`: the third pass (the gate seen before Mara speaks; Mara stepping out at the gate; the door held on the chapel's own door; a scene over a clean picture; news under the HUD on a phone, on its side and upright; a quest opened on the map; the new icons for the ultimates and Piercing Arrow) | the opening branch |
| `icons/` | The skill and talent icons from game-icons.net (CC BY 3.0): every class's skills before (painted glyphs, several shared) and after (a picture each), the mage's three talent trees, the talents panel, the desktop bar and the phone's buttons | the icons branch |
| `hearts/` | Every land's heart its own (a well, a fish market, a healer's cauldron, an oasis, a shrine, a bonfire, a muster, a flower ring, a harvest tree, crystals, a totem, a forge), the open ground of the bare lands, Briarhollow's gate towers and square, Emberwick's market with each stall's goods beside it | the one-pack branch, fourth pass |
| `cinematics/` | The rider walking in, falling, talking and fading (`1-`–`4-`); the shots that open the great fights, with their titles (Hearthstead, the Pale Herald, the Field Before the Hall, the Last March, the Night of Knives) and a boss met for the first time (`5-`–`10-`); the map: as it opens, a land zoomed, another land picked, an unexplored land all black, the world zoomed, and on a phone (`11-`–`16-`); the second pass: the act titles (Prologue, Act II), a land's title, a story talk framed and a place discovered on a phone, the shots of the rangers walking in, the cells, the snow and the ram, a boss's last blow slowed (`17-`–`26-`) | the cinematics branch |
| `polish/` | The owner's remarks after the cinematics: Oskar the same size walking in and fallen, the shield on the front in every facing, the chapel lit at night, the chapel's own door held (no door drawn over it) (`1-`–`4-`); every quest checked for the same faults: Duskfen's caravan with its refugees out of the house and on the road, people no longer hidden behind stalls, pavilions and statues (before and after), Fernstead's camp before its tents, people at night with their own light, the boats moored in the water (`5-`–`10-`) | the remarks branch |
| `ring-ranked/` | The Ring's fight window before (`0-`, cut by the phone's island on the left) and after, on a phone held sideways (the island's 47 px simulated on each side): ranked 3v3 with a place for each teammate and an invite in it (`1-`), a guest's practice rating with the way to ranked (`2-`), inviting a friend (`3-`), and on a desktop (`4-`) | the ranked-ladder branch |
| `keep/` | The Ember Keep before (`0-`) and after: the camera climbing it the first time up the avenue, its forecourt by day and on the Night of Knives; the Great Hall from its throne, from its door, and as the war room (with the path of statues to the throne, the lions at the steps, the marble floor) | the keep branch |

## Heavy scene (Prompt 16)

The field before the Muster Hall (bonefields, review preset `muster-hall`): 212 enemies alive in the land,
six allies, the battle under way. In the dev browser with its pane hidden, a simulation step took under 0.2 ms
(enemies far from the hero sleep) and a 1280 × 720 frame under 1 ms to submit. A hidden pane defers its
drawing, so the draw figure is **indicative only**; frame times on a phone are **unverified**.
| `sf9-baseline/` | The game before the pass to 9/10 (NINE_PLAN.md): every act's beats, the Riftward and a Riftstone run, a Vigil night, a Ring match and the three old saves played, at 844 × 390, 1024 × 768 and 1440 × 900, by `scripts/sigilfall-tour.mjs`; `tour.json` is what the page reported (nothing) | `claude/sf9-baseline` |
