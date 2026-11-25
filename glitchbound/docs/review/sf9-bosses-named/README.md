# The story's seven named foes, figures of their own (2026-11-25)

Row 2j of `src/games/sigilfall/NINE_PLAN.md`. Seven of the lands' named foes, the ones the story turns on, stop
wearing a shared creature's model: the Grey Lady (Brackenridge), Prince Thistlemourn (the Glimmerwood), the Tearborn
(the Shattered Vale), the Gatewarden (the Riftscar Wastes), the Weeping Lord (the Weeping Woods), the Lich of
Hollowmere, and Vosk the Hollowed (the Pale Reach). The other 63 named foes keep their shared models, by the owner's
choice.

They are not dungeon bosses, so they have no form in `render3d/bossKit.ts`: each is a file of its own
(`k/boss_<name>.pack`, built by `scripts/sigilfall-3d-assets.mjs`) with its paint in `render3d/kits.ts`, moving with
the shared skeleton's own walk and attack. Vosk is his own rider on the horse he already rode.

| File | What it shows |
| --- | --- |
| `line-ups.jpg` | All seven beside the hero at the size a phone shows them (844 × 390, touch), held still |
| `portraits.jpg` | The same, far closer than the game comes |
| `<foe>/01-line-up.jpg`, `01-line-up-close.jpg`, `02-portrait.jpg` | Each one's own pictures |
| `<foe>/03-motion.jpg` | Twelve frames of it let loose on the hero, 0.9 s apart |
| `<foe>/report.json` | Which clips were read while it moved and struck, and what the page reported |

The pictures were taken by a script of this pass's own (not in the repository): it puts the foe down beside a review
hero at the land's entry, so the ground in the pictures is the town's, not the place the story meets them.

## The numbers

| | Grey Lady | Thistlemourn | Tearborn | Gatewarden | Weeping Lord | Lich | Vosk (rider) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Triangles | 8,381 | 8,688 | 11,474 | 10,218 | 6,153 | 7,264 | 5,738 |
| File | 102 KB | 114 KB | 162 KB | 135 KB | 83 KB | 101 KB | 79 KB |

All under the bosses' budget of 12,852 triangles.

## What the motion check read

All seven: "It walks when it moves and has an attack of its own." No page errors.

| Foe | Moving readings in a walk or run | Clips read |
| --- | --- | --- |
| The Grey Lady | 70 of 73 | walk, cast |
| Prince Thistlemourn | 50 of 51 | walk, cast, idle |
| The Tearborn | 62 of 64 | walk, cast, idle |
| The Gatewarden | 23 of 25 | walk, smash, idle |
| The Weeping Lord | 58 of 64 | walk, chop2, idle |
| The Lich of Hollowmere | 54 of 57 | walk, cast, idle |
| Vosk the Hollowed | 33 of 46 (the horse; the rest mid-charge or struck) | walk, run, chop, hit, idle |

The Grey Lady, the Weeping Lord and the Tearborn used to float as ghosts with no walk; they walk now. The Grey Lady and
the Weeping Lord are still drawn part see-through.

## What is weak, and left

- **The Gatewarden's key** (his mace in the story's words) does not show from the game's camera; he reads as a giant in
  blackened plate with a great shield. A larger key was tried and still did not show, and made the rest of him smaller,
  so it was taken back.
- **The Grey Lady's lantern** does not show at the game's distance.
- **Vosk's rider** is dark on a dark horse.

## What was not checked

- None was seen in the place and at the moment the story meets it, or in its quest's scenes. Their echoes in the Rift
  (`echo-of-the-gatewarden` and the like) keep the old looks.
- The Vigil's champions that borrow these foes' looks were not looked at.
- Nothing here was seen on a real phone.
