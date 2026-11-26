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

## Played by key and mouse

After the pull request was opened, a player script of this pass's own (not in the repository) played quests in a
browser by sending the game the key and mouse events a person's hands would: it walks where the quest's arrow leads,
attacks what attacks it, uses every skill, and presses the interact key at things. Talk is read through; nothing else
is skipped. Its hero is of the land's starting level plus two, with rare gear, a specialization and talents. It does
not dodge, and it fights whatever is near: it is a poor fighter.

48 quests were chosen, in fourteen lands: those with a hold, a carry, a trail or a foe taken alive, and no dungeon.

| | |
| --- | --- |
| Played | 44 of 48 (one of Hollowmere's and the Pale Reach's three were not reached: the machine was too loaded) |
| Finished | 41, most in one to two minutes of the game's time |
| Not finished | 3, all by dying over and over in a late land |

**What it found, and what was done:**

- **Work on a thing was undone by every blow.** *The Black Pool*'s last step took 105 seconds with eight
  interruptions. Work broken off now keeps up to 80% of what was done: the same step took 27 seconds.
- **A carry brought to a person never counted**, because the game keeps the hero a step off whoever stands there
  (*Swallowed Silk*). What is carried is now set down from a little further off.
- **A trail's mark could lie where it could not be walked to** from the one before. Every mark is now on ground the
  trail's start can be walked from, and things prefer ground with nothing standing beside them; the test looks at
  every one.
- **A friend's step in co-op had no foes.** The leader's game now puts them down when the friend's game asks, only
  foes that land's quests name and a few at a time.

**What it could not settle:**

- **The late lands kill this player**, on steps of the old kind as well as the new (*Ash on the Wind*'s plain "kill
  ash drakes": seven deaths). *Captain Hollowbane*, *The Drowned Mother* and *Across the Mere* did not finish for that
  reason. Whether a hold or an ambush there is too much for a person, who dodges and picks fights, it cannot say.
- The player's own faults cost two full runs before they were found (it let go of its keys when the window lost the
  focus, and its first hero had no talents). Only the last runs are counted above.

## What was not checked

- **No person has played a quest.** A script played 44 by key and mouse (above), which shows they can be walked
  to and done, not that a step is fun or well judged.
- **Where things land.** They are put on clear ground near a named place; some will stand behind a tree or a house.
  Their light shows over it, and the arrow leads to them, but each of the 147 was not looked at.
- **Difficulty.** Guards, ambushes and waves are of the land's own foes at the land's level. None was tuned by play;
  a hold of 25 to 30 seconds against three waves may be too much or too little for some classes.
- **Co-op.** Each hero's things are their own, as chests are. A friend's guards, ambushes and waves are put down by
  the leader's game; a friend's subdue still counts the kill instead. Tested with two games linked in a unit test, not
  with two real browsers.
- **A hero part-way through a quest when this lands** carries on from the step number they were on, which may now be
  a different step: the campaign cannot break by it, but a count may carry over oddly.
- Nothing was seen on a real phone.
