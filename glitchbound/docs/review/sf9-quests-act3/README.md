# Act III quests against the Prologue's standard (piece 4 of NINE_PLAN.md, 2026-11-25)

Act III is the Sunscorch, the Glimmerwood, Rimeheld and the Shattered Vale: 56 quests in these four lands' files.

## The walks and talks

21 of the 56 have no step but going somewhere or talking to someone. All were read; none was changed:

- 5 are the road into a land (`the-sun-kings-tomb`, `the-fading-lights`, `the-frozen-road`, `where-the-rift-bleeds`)
  or the story's decision after a land (`the-clans-decide`).
- 15 are a place searched, and every one of them already finds something that is shown and kept, and sets up the
  fight that follows it.
- 1, `the-tear`, is the walk to the lip of the Tear, where the Herald's ambush is sprung: the walk is the trap.

So Act III has no errand that is only an errand. No quest was removed, merged or renumbered.

## A side story with a turn in each land that lacked one

The Glimmerwood's three side stories each already turn on a find. In the other three lands one side story was a
hunt in three parts ending with the beast dead and a reward. Each now ends with something found on the beast that
changes what the hunt was: a keepsake in the Journal, a new ending, and a new line from the giver afterwards.

- **The Sunscorch, Old Kasim's scorpions** (`the-dune-tyrant`). *A Spearhead with the Well-Mark*, grown into the
  Tyrant's shell over its heart. Kasim's family says his grandfather died trying to kill it. He had all but done it:
  the Tyrant never climbed the well itself again.
- **Rimeheld, Brewer Olav's mead** (`enough-is-enough`). *A Notched Stick from the Mead-Hall*, in Grumbleback's den
  beside forty empty casks stacked like a cellar: Olav's father left a cask out at every first snow, and the yetis
  kept off the road. The raids began when Olav, not knowing, stopped. He starts again.
- **The Shattered Vale, Scholar Ennis's shardlings** (`the-glass-matron`). *A Shard That Hums a Cradle Song*: the one
  note every shardling sings is a note of the song the Vale's children are sung, and the Matron's heart has all of
  it. What Ennis filed as seeds is something the glass heard here.

## Saves

Quest ids, steps and rewards are as they were. The save table grew by three keepsakes at its end
(`progress/saveTables.ts`), as it did for Act I. An old save that had already finished one of these hunts keeps it
finished and simply has no keepsake for it.

## Checked

Type check; the story, quest, save and text tests (30 files, 530 tests) on this branch; the whole suite, lint and the
build on the top of the stack these quest branches make. **Not played in a browser.**
