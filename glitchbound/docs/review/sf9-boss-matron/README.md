# The Coffin Matron, a boss of her own (2026-11-24)

Piece 2a of `src/games/sigilfall/NINE_PLAN.md`: the pipeline for bosses of their own, proved on the first boss a
player meets. Pictures by `node scripts/sigilfall-boss-shots.mjs --boss coffin-matron --out docs/review/sf9-boss-matron`
(and `--tag before` on `pre-release` as it was), on a phone's screen (844 × 390, touch, the game filling it), in her own
room of the Chapel Crypt with a level-6 warrior.

## Who she is

"The keeper of the crypt's coffins. She hides in one and moves them around." An old woman of the dead, Mother of the
Ossuary: pale as her charges, white-haired under a mourner's black veil, three grave candles burning the crypt's
green on her crown and the same light in her eyes; a bodice of mourning black over a skirt of grave linen; the dead's
own arms; the coffin she hides in carried upright on her back, with a sexton's spade beside it.

- **Related to her soldiers, and nobody's model scaled up.** Her arms are the Skeleton Mage's, bone like the
  skeletons she wakes; her light is the green of the coffins and wisps of her fight. Her silhouette is her own: a
  dark coffin standing a head over a pale, white-haired figure.
- **Her attacks come from her.** The three wisps that hunt the hero (`spell:seekers`) are three, as her candles are,
  and are cast with a flung hand; the coffin that shuts on the hero (`spell:cage`) is drawn closed with both hands; the
  coffins of her shell game (`crypt:coffins`) are called up with both arms raised, and she is gone into one.
- **Before:** the pack's Witch at 1.2 times a person, dressed in a hood, a robe and a staff.

## The pictures

| File | What it shows |
| --- | --- |
| `before-*.jpg` | The fight as it was (close-ups, and three of them whole): each attack's wind-up and strike in both phases, the phase change, her death |
| `NN-entrance-close.jpg` | Shown for the first time: a coffin lying on the crypt's floor heaves, and she climbs up from under it |
| `NN-line-up.jpg`, `-close.jpg` | Beside the hero and two of her skeletons, at the size a phone shows them |
| `NN-portrait.jpg` | Far closer than the game ever comes, to see how she is made |
| `NN-phase-P-<attack>-windup-close`, `-strike-close` | Each attack of each phase with its telegraph on the ground, then as it lands (`12-phase-1-spell-cage-windup.jpg` is one on the whole screen) |
| `NN-phase-2-change` | "The Matron wakes the dead!": her shriek, the rules' 1.4 seconds |
| `NN-dazed-close`, `NN-struck-close` | Found out, she sits where she fell (the rules' daze); struck |
| `NN-death-close` | Her fall, nine moments about 1.3 seconds apart: she falls back onto her own coffin and lies on it under what she dropped, and then is gone. The floor taking her (she sinks over the next second and a half) fell between two pictures: it is in the code and was not caught on a frame |
| `sheet.jpg`, `sheet-before.jpg` | Every close-up on one sheet, after and before |

## The numbers

| | The Coffin Matron | The budget, or the rule |
| --- | --- | --- |
| Triangles | 6,520 drawn (6,180 in her file, the rest built in the browser) | 12,852: the heaviest creature before the pass (`orc_brute`) |
| Draw calls | one body (and its ink line), as any creature | the same |
| File | `k/boss_matron.pack`, 71 KB | loaded with the crypt, as the witch's 79 KB was |
| Stands | 45.6 world px with her coffin; a person is 28.4 | a boss, not a soldier |
| On the ground | 18.6 × 15.6 px | her circle in the rules is 18 px across (`radius: 9`) |
| Alight | 3.1% of her (the candle flames, her eyes) | glow only where there is magic |

The rules are untouched: `data/bosses.ts`, `sim/patterns/crypt.ts` and the room are as they were.
