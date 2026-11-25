# Act I against the Prologue's standard (piece 6 of NINE_PLAN.md, 2026-11-25)

Act I is Brackenridge (Fernstead), Thornvale (Millbrook) and the Amberfield (Hearthstead). Every Act I beat the review
presets have, twenty of them, was opened at four screen sizes (a desktop, a laptop, a tablet and a phone on its side,
the last two by touch) next to four of the Prologue's, by

    node scripts/sigilfall-overlap-check.mjs --preset <the 24 ids> --shots docs/review/sf9-standard-act1

which is the screen check with two things added for this piece: `--preset` takes a list, and `--shots <folder>` saves
a picture of each beat as it opens at each size and how light that picture is (0 to 255, `light.json`).

## What it found

- **Nothing on the screen covers anything else**, in any of the 24 beats at any of the four sizes (96 stops).
- **The light is the Prologue's.** Act I's beats by day read 80 to 93 on a desktop and 98 to 134 on a phone or tablet;
  the Prologue's dawn camp reads 80 and 110, its lit fights 66 to 72. The only dark stop is the Prologue's own dusk at
  the gate (19 to 46), which is meant to be. No Act I beat is darker than the Prologue's fights.
- **Nothing was changed in the game.** In the pictures I found nothing in Act I that falls below the Prologue: the
  towns have their names shown on arrival, the speech cards carry names and portraits, the HUD is the same.

| Beat | Desktop | Laptop | Tablet | Phone |
| --- | --- | --- | --- | --- |
| `prologue-dusk` | 40 | 46 | 19 | 22 |
| `prologue-raid` | 66 | 68 | 72 | 72 |
| `camp-dawn` | 80 | 81 | 109 | 110 |
| `chapel-door` | 70 | 70 | 96 | 87 |
| `hearthstead` | 64 | 67 | 69 | 71 |
| `hearth-ram` | 74 | 73 | 90 | 92 |
| `hearth-morning` | 82 | 81 | 107 | 105 |
| `camp-riders` | 70 | 69 | 96 | 87 |
| `v3-fern-candles` | 87 | 86 | 113 | 117 |
| `v3-fern-barrows` | 93 | 89 | 134 | 126 |
| `v3-fern-lady` | 90 | 86 | 134 | 125 |
| `v3-fern-stones` | 91 | 86 | 134 | 125 |
| `v3-fern-scouts` | 91 | 86 | 134 | 125 |
| `v3-mill` | 80 | 82 | 100 | 115 |
| `v3-mill-kettle` | 87 | 83 | 119 | 116 |
| `v3-mill-nyx` | 82 | 81 | 107 | 102 |
| `v3-mill-bridge` | 82 | 81 | 107 | 103 |
| `v3-mill-wheel` | 82 | 81 | 107 | 103 |
| `v3-hearth` | 81 | 80 | 103 | 98 |
| `v3-hearth-caravan` | 81 | 80 | 102 | 99 |
| `v3-hearth-captain` | 81 | 80 | 103 | 99 |
| `v3-hearth-stones` | 81 | 80 | 103 | 99 |
| `v3-hearth-sigil` | 82 | 81 | 107 | 105 |
| `v3-hearth-orders` | 82 | 81 | 107 | 105 |

## The pictures

`phone-<beat>.jpg` and `desktop-<beat>.jpg`, one of each beat as it opens; `sheet-phone.jpg` is all the phone ones
on one sheet. (The laptop's and tablet's were looked at and not kept: they show the same.)

## What this does not show

- **A picture is the first two seconds of a beat.** Several beats of one town open on the same arrival scene, so their
  pictures are nearly the same (the Hearthstead and Millbrook rows), and the place the beat is really about is not in
  them. `camp-riders` follows `chapel-door` in the same land and its picture is still the chapel door: the picture was
  taken before the jump had finished.
- So this is a check of the screen and the light, not of each place's dressing, its quests' staging or its fights.
  Those were not walked. The plan's tour (`sigilfall-tour.mjs`) was not rerun for this piece.
- Acts II to VI were not looked at.
- Not looked at on a real phone.
