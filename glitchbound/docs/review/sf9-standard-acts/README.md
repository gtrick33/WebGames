# Acts II to VI against the Prologue's standard (piece 6 of NINE_PLAN.md, 2026-11-25)

Every review beat of Acts II to VI, Crownfall and the Epilogue (116 presets; two of them, `muster-hall` and
`fireships`, no longer open and were skipped) was opened on a phone on its side (844 × 390, touch) by

    node scripts/sigilfall-overlap-check.mjs --size phone --preset <the ids> --shots <folder>

`sheet-act-ii.jpg` to `sheet-act-vi.jpg` are the pictures, one sheet per act in the story's order (Crownfall and the
Epilogue are on Act VI's). `light-phone.json` is how light each picture is, 0 to 255.

## What it found

**One thing on the screen covered another, and it is fixed here.** At `lantern-vigil` (Act II, the vigil at the great
lamp), with four people speaking at once, two lines were written over each other. The same beat showed it in one of
three runs at the release bar. The cause: when no place on the screen is free, a line went over its speaker's head
whatever was there, another line included. Now it first takes a place that covers only the HUD (a HUD piece under a
line already fades until the line is said), and goes over another line only if there is no such place either
(`render/speech.ts`). Nothing else covered anything at the other 113 stops.

**The light.** Against the Prologue (its lit fights read 66 to 72, its dawn camp 110, its dusk 22):

| Act | Beats | Darkest | Middle | Lightest |
| --- | --- | --- | --- | --- |
| Act II | 18 | 21 | 77 | 112 |
| Act III | 32 | 26 | 101 | 138 |
| Act IV | 24 | 16 | 74 | 119 |
| Act V | 23 | 28 | 67 | 76 |
| Act VI | 19 | 28 | 118 | 140 |

The nine darkest pictures (16 to 35) were looked at one by one. Each is a boss's name card or a story page, which
dim the scene behind them on purpose, or a dungeon's boss room. No beat out of doors by day is darker than the
Prologue's fights.

**Act V is the darkest act by a clear margin** (middle 67, nothing above 76): the Weeping Woods and Hollowmere are
grey-green under an overcast, and Emberdeep's ground is black rock between lava. It reads as the dead kingdom it is,
and the HUD, the quest text and the people stand out on it in the pictures. I left it. If it should be lifted, that is
a look decision for the owner: say so and it is one number per land.

Nothing else was changed in the game.

## What this does not show

- A picture is a beat's first seconds. It checks the screen and the light. It does not check each place's dressing,
  its quests' staging or its fights: the places were not walked.
- Only the phone's size was run for these acts. (A desktop pass was started and stopped to free the browser for the
  bosses' pictures. The release bar's full run on four sizes covered the story's 38 main beats.)
- Not looked at on a real phone.
