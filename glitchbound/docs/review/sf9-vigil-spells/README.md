# The Vigil's spells, deeds and played nights (2026-11-25)

What is here, and how each part was made. Everything was run on the dev server in headless Chromium at a phone's size
on its side (844×390, touch).

| Folder or file | What it is | Made by |
| --- | --- | --- |
| `play/` | Four whole nights played by touch input: a log of each (`<name>.json`) and a picture every twenty seconds, at each event, at the first three level-ups and at the end | `node scripts/sigilfall-vigil-play.mjs --out … --class … --land … --gpu` |
| `party/` | A party's night with two real games through the rooms worker run on this machine: its log and pictures of both phones | `node scripts/sigilfall-vigil-party.mjs --out … --gpu` |
| `builds.md` | Which spells a bot ended 30 nights with, for each class, and how often those nights reached 5:00 | `VIGIL_BUILDS=<file> npx vitest run --no-fsModuleCache tests/sigilfall-vigil-builds` |
| `lobby-*.jpg` | The lobby with ten spells a class, the Watchfire, its deeds and its codex | `node scripts/sigilfall-vigil-shots.mjs --out … --only lobby` |
| `foes-*.jpg`, `land-08-*.jpg` | The two things the first pass's README called weak, after the fix: the kinds of foe, and the sandstorm on sand | the same script, `--only foes` and `--only lands --land sunscorch` |

## The played nights, honestly

**What "played" means here.** The input is real: a thumb held on the stick and moved, taps on the dash button and on
the cards, all as touch events on the page's own controls, and nothing in the night is set by the script. But the
thumb is a rule, not a person: it runs from what is near, steps out of what is marked, goes for sparks, chests, a
lantern and (when hurt) a glade, dashes when hemmed in, and takes cards half at random. It plays like someone on their
first evening. I watched through its pictures and logs; I did not hold the stick.

Ten nights were played in three rounds (the first two rounds' logs are not kept here; their numbers are in the pull
request). The four kept, played after the last change:

| Night | Held | Level | Felled | Events (won) | What hurt most |
| --- | --- | --- | --- | --- | --- |
| Mage, Thornvale | 2:07 | 14 | 697 | Spark Thief, Ashsworn Pack (none) | plain walkers and rushers; shots |
| Warrior, Rimeheld | 1:47 | 12 | 527 | Dawn Lantern (not lit) | rushers, a marked foe, walkers |
| Druid, the week's watch (Whisperwood under Biting Cold) | 1:27 | 9 | 341 | Spark Thief (got away) | walkers; the cold a little |
| Priest, Greyfen Marsh | 3:52 | 24 | 2,334 | Ember Hour, Spark Thief, Closing Ring, Ashsworn Pack (two won) and Mother Mire felled | shots, a marked foe, the champion's blows |

What I took from watching them:

- **It works end to end by touch.** The stick, the dash, the cards, every event's card and banner, the night's end
  with its motes and deeds, and "Hold again" all worked in every night, and no page reported an error.
- **Unfair, fixed:** an Ashsworn pack or a Closing Ring as the first event, at 0:55, took a third to a half of a new
  hero's health in the first round (the mage went from 91% to 44% during its pack). The night's first event is now
  never one of those two.
- **Dull, fixed:** in the first round a druid on the week's watch held ten minutes at full health with 320 of the Host
  on screen, and was never in danger after 2:00. The Vampire Fang relic healed on every kill with no limit (about 50
  health a second at 20 kills a second), a ward came back every six seconds, and a level with nothing left to take
  healed 30%. The Fang now shares the limit other life-drain has, wards hold less and come back in nine seconds at
  best, and that heal is 15%. This is the biggest change to how a long night plays, and it rests on one night's
  evidence plus the arithmetic.
- **Unclear, fixed:** late in that ten-minute night the hero could not be found in the crowd, and big dark boars
  (Wallbearers, which hardly died) filled the screen. The player's own hero now stands in a ring of light, and a
  Wallbearer turns 60% of a blow from the front where it turned 75%.
- **Covered, fixed:** the screen check built into the play script found the row of spells and relics running under the
  dash button once a hero held many (73 points wide, on every look), and a banner under the event's card while a
  champion was about. Both are fixed, and the last four nights found nothing covering anything.
- **Still short for this thumb:** its nights last one and a half to four minutes, and plain walkers do most of the
  harm. That is the thumb walking into the crowd for sparks more than the game being unfair, but it means **nothing
  here shows what minutes five to ten feel like after the tuning**, or whether a person finds the events fun. The Spark
  Thief got away from it three times in four; a person would chase harder.
- **Not tuned:** mote income, boon and wild-spell prices and how often events come are as they were. The nights gave
  no reason to move them: a two-minute night pays 6 to 8 motes before deeds, the first boon rank costs 8, and events
  came on time (ten in a ten-minute night, all seven kinds before any repeated).

## A party's night

Two phones, each its own device with its own records: the host a Ranger carrying two ranks of Hearthblood and Chain
Lightning as a wild spell, the friend a Priest with three ranks of Hearthblood and one of Second Thoughts. The host
opened a party, the friend joined by typing its code, the host began the night, and both were played by touch for
eighty seconds. Looked at seven times: the clocks agreed, the Host on the friend's game was within two of the host's
(66 and 64 at the end), the levels and events matched, and each game showed what the other hero carried. No page
reported an error. It was one short night on one machine.

## Frame cost

`node scripts/sigilfall-vigil-bench.mjs --gpu` against this branch and against `pre-release` (`--root`), headless
Chromium with this Mac's GPU, 844×390. The numbers are for a before and after on this machine, not for a phone.

| Run | `pre-release` | This branch |
| --- | --- | --- |
| Nine minutes in, five spells at their top, as first built | 60.0 frames a second, 16.7 ms mean, 16.7 ms at the 95th percentile, 312 of the Host | **42.3 frames a second**, 23.6 ms mean, 33.4 ms at the 95th percentile, 295 of the Host |
| The same, after one mark a foe instead of up to three and no wide ring under every Hostcaller | not run again | 58.7 frames a second, 17.1 ms mean, 16.8 ms at the 95th percentile, but only 127 of the Host on the field in that run |
| Nine minutes in, two weak spells, the field left to fill | 60.0 frames a second, 16.7 ms mean, 320 of the Host; 0.6 ms of script a frame to draw | 60.0 frames a second, 16.7 ms mean, 234 of the Host; 1.6 ms of script a frame to draw |

So the first build of the marks cost a third of the frame rate in a crowded night, which was found here and cut. After
the cut both hold the screen's 60, but the two after-runs had fewer of the Host on the field than the before-run (the
Cinderbloats and the land thin the crowd), so **a like-for-like after-number at 300 or more of the Host was not
measured.** The script's own share of a frame is up by about a millisecond.

## Builds

`builds.md`: for each class, 30 nights by a bot that takes a card at random. How many of the 30 ended with a different
set of five spells, how often each spell was in the five, and how often the nights with it and without it reached
5:00. Read it for spread, not for balance: with 30 nights and a spell in a third of them, each "with it" figure rests
on about ten nights.
