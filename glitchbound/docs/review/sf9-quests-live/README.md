# Every quest given something to do (2026-11-26)

Piece 4b of `src/games/sigilfall/NINE_PLAN.md`. The owner, 2026-11-25: "i want every quest to be meaningful, not just
walk kill and thats it, make it sensible, interactive and fun, it should be part of the story ... something wow/diablo
would do ... go over every single main/side quest".

## What the quests were, and are

| | Before | After |
| --- | --- | --- |
| Quests | 215 | 215 (none added, removed, merged or renamed) |
| Steps | 218 | 426 |
| Quests of one step | 212 | 33 |
| Quests that are only a walk, a talk or a count | about 180 | 13 |

The 33 left at one step, on purpose:

- **The Prologue's night and the Whisperwood (14):** the owner's standard, staged beat by beat with its own hints; the
  Whisperwood also has no named places to put things at. Not touched.
- **Fights the story stages that are a whole quest (11):** the cellar, the Night of Knives, the Herald's ambush, Nyx
  under her white rag, the cells and the way out, the children in the snow, Orren on the shore, the banners, the
  breach. A chore after one would come between the fight and what the story shows next.
- **The ending (5) and the epilogue (3):** the Hallow King, Vaelmoor remembered, the choice, the Crown unmade, and what
  comes after. Told and chosen, not worked at.

## The five new kinds of step

All in `sim/tasks.ts`, with their test in `tests/sigilfall-quest-tasks.test.ts`. Nothing is on a land's map or in a
save: while a step is the hero's and its land is this one, its things are put down near the place it names, at spots
worked out from the quest's id, and how far it has got is the quest's own count.

| Kind | What the hero does | How often |
| --- | --- | --- |
| **Use** | Stands at a thing for a moment to burn, search, read, light, free or mend it. A blow taken breaks it off. Some are guarded; some spring an ambush at the middle one and the last; each can tell the hero what they found. | 147 |
| **Trail** | Follows marks one at a time from one place toward another; each says what the hero sees. | 22 |
| **Carry** | Takes something up and brings it to another place, with whoever wants it coming on the way. | 19 |
| **Hold** | Stands in a marked place for a time against waves; the clock runs only while they stand in it. | 14 |
| **Subdue** | Beats a foe low; it yields instead of dying, and the hero binds, questions, milks or releases it. | 9 |

A kill or a subdue can also name a **lair**: its quarry is put down at a place while the step is the hero's and none
stands there (so a named foe is there after a reload). A talk can carry **its own lines** for that step.

"Use" is most of it by count. What differs from one to the next is what stands round it and what it says: 40 are
guarded, 31 spring an ambush, and 99 tell the hero something at each thing.

## The pictures

Taken by a script of this pass's own (not in the repository) that sets a hero to a quest's step, in a browser at a
phone's size (844 × 390, touch).

| File | What it shows |
| --- | --- |
| `thornvale-hold-the-fold.jpg` | *Pelts for Winter*, third step: the hold's ring, its clock in the tracker, wolves coming in |
| `thornvale-search-the-farm.jpg` | *The Burnt Farm*: what the hero found, and the ambush it sprang |
| `thornvale-question-a-red-cap.jpg` | *Thieves' Cant*: a Red Cap who has yielded, and the button that questions him |
| `thornvale-steps-1.jpg` | Eight more from Thornvale: notices, the search, the trail, the carried flour |
| `lands-ten-steps.jpg` | One step from each of ten other lands: the Lady’s candles, Stormhoof yielding, the lamp oil carried, the guarded drums, the Pale Hart, the lamps across the glass, the letters read, Nan’s lodgers, the Gate’s locks, the Crown City (a scene was playing) |

## What was not checked

- **Nobody has played a quest through by hand.** The pictures are single moments set by script. The whole campaign is
  walked by the test bot (`tests/sigilfall-campaign.test.ts`), which does every step, but a bot does not say whether a
  step is fun, too long, or in a bad place.
- **Where things land.** They are put on clear ground near a named place; some will stand behind a tree or a house.
  Their light shows over it, and the arrow leads to them, but each of the 147 was not looked at.
- **Difficulty.** Guards, ambushes and waves are of the land's own foes at the land's level. None was tuned by play;
  a hold of 25 to 30 seconds against three waves may be too much or too little for some classes.
- **Co-op.** Each hero's things are their own, as chests are. The foes a step brings come only in the host's game, so
  a guest's guarded thing is unguarded, their hold has no waves, and their subdue counts the kill instead. Unit-tested
  for the host only; two real games were not run.
- **A hero part-way through a quest when this lands** carries on from the step number they were on, which may now be
  a different step: the campaign cannot break by it, but a count may carry over oddly.
- Nothing was seen on a real phone.
