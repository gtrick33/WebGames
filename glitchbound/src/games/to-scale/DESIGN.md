# To Scale

**Pitch.** Two things stand side by side on blueprint paper: one you know (a dice, a bus, a person) and one shown as
a bright silhouette at the wrong size. Drag its corner until it is the right size next to the other one, lock it
in, and watch the real thing pop up over your guess.

## The round

- A **shot** pairs a reference thing with a target thing that is 1.8 to 8 times bigger or smaller (57 things
  from an ant to the Earth, `objects.ts`; each size is one stated dimension (`dim`: long, tall, wide or across)
  from typical real-world values, and `axis` says which side of the picture shows it). The question, the labels
  and the reveal name the dimension, and a dimension line marks it; the reveal adds US units.
- The player sets the target's size as a multiple of the reference. The slider always runs from 1/12 to 12 times
  the reference, and the target starts at a random spot at least 1.7× off, so neither gives the answer away.
- **Score per shot:** `1000 × (1 − |log₂(guess / truth)| / 1.5)`, floored at 0. Half or double is equally wrong;
  2.8× off scores nothing. Within 10% scores 🎯 (900+).
- The reveal shows the real size (dashed outline and the real picture over the ghost of your guess), the
  accuracy, the true numbers and a fact.

## Modes

- **Daily #N** (since 2026-10-19): five shots from `hashString('to-scale:' + day)`, the same for everyone,
  shared as an emoji line (🎯🟩🟨🟧🟥) and a score out of 5,000.
- **Endless:** random shots, with no target repeating among the last 12. A shot under 250 points costs a life; three
  lives.
- **Friends' challenge:** the five shots from `challenge.seed`, straight away; the scoreboard is on `/c/<id>`.

## Controls

Drag the yellow corner handle (pointer, mouse or touch), the log-scale slider, −/+ buttons (5% steps), the mouse
wheel, or arrow keys (3%, Shift for 15%). Enter or Space locks in and goes to the next shot.

## What is original

Things whose device emoji can't be measured fairly (props, perspective, an upright animal) have original side-view
art drawn to real proportions (`art.ts`, Path2D on a canvas). The rest use the device's own emoji; diagonal ones
(`level`) are turned so their long axis lies along the measured side. Either way the picture is cropped to its
visible pixels and tinted into a silhouette, so it is sized exactly and needs no image files. Still to do: original
art for the remaining emoji things, whose cartoon proportions (a fat T. rex, a tall horse) and vendor differences
remain. The camera zooms to keep both things in frame and holds still
while you drag.
