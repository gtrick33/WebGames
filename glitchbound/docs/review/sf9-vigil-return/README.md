# The Vigil's return, looked at in a browser (2026-11-25)

Taken by `node scripts/sigilfall-vigil-shots.mjs --out docs/review/sf9-vigil-return` on the dev server, in headless
Chromium at a phone's size on its side (844×390, touch). `shots.json` lists every picture with what it should show and
whatever the page reported: no picture had a console error.

How to read them: each scene was set through the dev server's handle on the night (the clock moved to just before a
rule turns, an event drawn from the bag, a champion set down beside the hero) and then left to play until the thing
showed. The hero was given health to spare so the scene stayed up, and cards were taken as they came. So these show
what each thing looks like; they are not a played night, and nothing here says how it feels to play.

| Pictures | What they show |
| --- | --- |
| `old-01`, `old-02` | A device that only has what the Vigil kept before (its longest nights): the lobby opens at no motes, the old best is shown, and a night begins. Nothing is written for it until a night ends. |
| `lobby-01` to `lobby-03` | The lands with each rule named on its card; the land chosen says what its rule does; the week's watch with its omen and bounty. |
| `lobby-04` to `lobby-07` | The Watchfire with 120 motes; after two ranks of Hearthblood, one of Second Thoughts and Call Wolf learned; the same after the page was closed and opened again (what was bought is still there). |
| `land-NN-…-a-begins` | Each of the twelve lands as its night begins: the rule under the clock, and said in a line. |
| `land-NN-…-b-rule` | Each land's rule at work: the glade, the bramble, the rockfall marks, the bog pools, the tide in, the gale with its arrow, the graves, the sandstorm, the cold, the venom, the vents, the sparks left lying. |
| `event-1` to `event-7` | Each event with its card: the Ashsworn pack, the Wild Run marked and then run, the Dawn Lantern found and then held, the Spark Thief, the Ember Hour, the Closing Ring, the Night Swarm. |
| `foes-1`, `foes-2` | The four kinds side by side, then a Twinhusk broken in two and a Cinderbloat's mark. |
| `champion-1` to `champion-5` | Each kind of champion's attack as it is shown before it lands: rake, charge, call, volley, ring. |
| `end-1`, `end-2` | The week's watch beginning with both rules under the clock, and a night's end with its motes and the week's bounty. |

What I saw that is weaker than the rest, left as it is:

- The sandstorm's haze (`land-08-…-b-rule`) is hard to see against Sunscorch's sand. It reads on other lands as an omen.
- At this size the four new kinds are small (`foes-1`): a Wallbearer is told by its dark blue wash more than by the
  arc before it, a Hostcaller by the ring around it, a Cinderbloat by its glow. The first of each kind is also named in
  the line at the foot of the screen.
- The line at the foot stays up six seconds; in several pictures it is still the land's rule because the scene was set
  seconds after the night began.

Found and fixed while looking: the land cards on a phone kept the height of two lines and the rule's name ran over
the next card (the grid's own row sizing; the rows are now sized to what they hold), and the Watchfire's backdrop let
the lobby show through.

Not looked at in a browser: a party's night (two games at once), the lobby on an upright phone or a desktop, and a
real phone.
