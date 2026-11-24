# Gallows Keep's bosses of their own (2026-11-24)

Piece 2c of `src/games/sigilfall/NINE_PLAN.md`: the Hangman and Harlan Blackglove. (Gnasher, the keep's war-hound,
is not in this piece: the plan says why.) Pictures by `node scripts/sigilfall-boss-shots.mjs --boss hangman|varric`
on a phone's screen (844 × 390, touch), in each boss's own room of Gallows Keep with a level-15 warrior; the
`before-*` ones the same way on the branch this is built on.

| File | What it shows |
| --- | --- |
| `hangman-sheet.jpg`, `varric-sheet.jpg` | Every close-up of the fight on one sheet: the entrance, the line-up, each attack's wind-up and strike in every phase, each phase change, dazed, struck, the death; the last row is the boss as he was before |
| `<boss>/06-line-up.jpg`, `07-portrait.jpg` | Beside the hero and two soldiers at the size a phone shows them, and far closer than the game comes |
| `<boss>/before-06-line-up.jpg`, `before-07-portrait.jpg` | The same two pictures before this piece |
| `<boss>/NN-…-close.jpg` | The single close-ups the sheets are made of |
| `<boss>/shots.json` | What was pictured, and what the page reported (nothing, for both) |

## Who they are

**The Hangman, Headsman of the Gallows Gang.** "He hangs the people of Millbrook who can't pay the rope tax." A giant
bare to the waist under a headsman's black hood, the great axe in his hand, the second axe he takes up at half
health slung on his back, the rope coiled at his hip. Before: the pack's Barbarian, darkened, a person's size.

**Harlan Blackglove, King of the Gallows Gang.** A bandit who crowned himself: the gang's red, a black plate gauntlet
on his left arm with a hand too big for a man, a knife in each hand, and a crown of stolen gold with a shard of
rift-glass in its brow (the shard is what he drops first). Before: the pack's Survivalist with an axe.

## The numbers

| | The Hangman | Harlan Blackglove | The budget, or the rule |
| --- | --- | --- | --- |
| Triangles in the file | 11,135 | 7,690 (his crown is built in the browser on top) | 12,852 (`orc_brute`) |
| File | `k/boss_hangman.pack`, 141 KB | `k/boss_harlan.pack`, 98 KB | loaded with the keep |
| Skeleton | the large one | the medium one | one of the two shared |

`tests/sigilfall-bosses-own.test.ts` holds both to the budget, to a move for every attack the rules give them, to
their footprint against their radius, and to light on a small part of them only.
