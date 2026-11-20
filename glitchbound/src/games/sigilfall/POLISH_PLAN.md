# Sigilfall — the campaign to small-AAA quality (2026-11-19)

The owner, after a playthrough of the opening: "currently campaign doesnt feel polished at all", then "make a plan for
refactor i want it to be as close as it gets to a small AAA game", then "implement the whole plan with a single agent
please, make sure its perfect, use whatever assets you can find and make sure it covers all the topics above".

## What "small AAA" means here

- One consistent look: the low-poly 3D world, its icons, its map and its menus in one hand.
- Hits that feel heavy: every blow is seen, heard and felt.
- Set pieces built by hand, not generated filler.
- Nothing on the screen covering anything else, at any size.
- Story moments staged like cutscenes, not a camera on a small figure with a text box.
- A real sound mix: music that follows the fight and steps back for the story.
- 60 frames a second on a mid-range phone.

The gap is less any one feature than how much the game does (six acts, 218 quests, thirty-odd lands, fifteen
dungeons, eight classes) against how little of it is finished to one standard. Each piece below raises that standard
everywhere it applies.

## Decisions

| Question | Decision |
| --- | --- |
| Branches | One `claude/sf-<topic>` branch and one pull request per piece (the owner, 2026-11-19). A piece that needs an earlier one is built on it, and its pull request says which to merge first. |
| Voice | A voice system (playback, subtitles, the music stepping back) with free CC0 vocal sounds: efforts, gasps, shouts. Spoken lines wait for recordings (the owner, 2026-11-19). No synthetic voices. |
| Assets | Free assets only, CC0 first, each recorded in CREDITS_AND_LICENSES.md and LEGAL_REVIEW.md; packs stay out of the repository and only built files ship. Kenney, OpenGameArt, Quaternius and poly.pizza are reachable from the build environment. |
| Levels | Every land hand-built (the owner, 2026-11-19: "lets move fully handbuilt maps", then "Freeze, then rework"). Each live land's generated layout is frozen to a map file in the repository, nothing generated as it loads, and then reworked by hand, one pull request per act. A dev-mode editor places set pieces and paints ground into those files. The hubs are hand-built. (The first decision kept the generated lands, with set pieces placed into them by hand.) |
| Scope | All six acts stay. Filler is merged or rewritten, not cut wholesale. |

## The pieces

Every piece is its own pull request into `pre-release`, checked before it opens (typecheck, lint, every test, the
build and its size report) and seen in the browser. Old saves must keep loading, and The Ring, The Vigil and the Rift
Trials, which share code with the campaign, must keep working.

### Groundwork

1. **This file, the act count and stale docs.** The title screen and the arcade's text said "five acts"; the story
   has a Prologue, six acts, the finale and an epilogue. DESIGN.md still described the pixel-art renderer.
2. **One owner for the screen.** Speech, pop-ups, banners, hints, the wave banner and the boss bar ask one manager for
   a place, by priority, so nothing covers anything else. A script screenshots the story beats at phone, tablet and
   desktop sizes and fails on any overlap.
3. **Dungeon checkpoints.** A cleared room is kept, so a reload doesn't replay a dungeon from its door.
4. **Split the oversized files.** `engine.ts` and `sim/world.ts` into parts by job, with no change in behavior; the dead
   2D world renderer (render/tiles.ts and what only it used) removed.

### Combat feel

5. **Hits.** A spark where a blow lands, a camera kick by the weapon's weight, a hit heard in layers (the swing, the
   blow, what it struck), damage numbers that tell a crit from a resisted hit from damage over time, knockback you see.
6. **Animation.** Every enemy attack winds up, strikes and recovers where it can be read; each family dies its own way;
   the hero's swings step into the blow, as in the Ring. (Already so when the work began, and checked: the wind-ups
   with their flash and lift, `render3d/worldCast.ts`, and the hero's lunge, `render3d/moves.ts`. What was missing was
   the deaths.)
7. **Spells in 3D.** What flies and what warns on the ground stands in the 3D world at its true depth. (Already so when
   the work began, and checked: `render/effects.ts` hands every spell, shot, flame and warning to the shaders of
   `render3d/fx3d.ts`; the old comment that said they were on the 2D layer is corrected.)
8. **The camera.** It pulls out when a pack engages and leans toward threats, fades the roofs and walls between itself
   and the hero, and gives each boss an entrance.
9. **Readability.** A rim of light on every figure, night lands brighter where it matters, elites marked.

### Presentation

10. **The HUD.** One style for frames, type and icons; speech in small bubbles over the speaker; one card for a
    finished quest that shows its reward; a level-up that is a moment.
11. **Icons and the map in 3D.** Item icons drawn from the gear's own models; the minimap drawn from the land.
12. **Cutscenes.** Portraits on scene lines; every scene staged (people kneel, fall, point; the camera moves); a dev
    previewer that scrubs a scene.
13. **Transitions.** A title card on arriving in a land, fades between places; the title and hero creation fixed.

### World

14. **Light.** Bloom on fire and magic, each land its own grade and fog, quality settings that keep phones smooth.
15. **The placement editor.** In dev mode, set pieces are placed in a land and written to its data file.
16. **Landmarks and life.** Each land a landmark seen from afar, a viewpoint, weather, and life about it.
17. **The hubs.** Briarhollow, Emberwick, Hearthstead and Highwall hand-built.
18. **Dungeons.** Rooms with one mechanic each, a secret, a shortcut, and an arena built for the boss.

### Content

19. **Quests.** One side story with a twist in each land; walking steps folded into scenes; a shorter prologue, with
    hints when they are needed.
20. **Bosses.** Bosses that were recolors get models and moves of their own, from CC0 packs.
21. **Companions.** Mara, Elyra and Nyx fight beside the hero in their acts and talk on the road.
22. **Loot.** Named story rewards shown on the quest page, a beam and a sound by rarity, fewer and better drops.
23. **Difficulty.** Story, Normal and Hard; the first boss tuned.

### Sound

24. **The mix.** Buses, the music stepping back under dialogue and scenes, music that follows the fight.
25. **Effects.** One consistent set: layered hits, footsteps by the ground underfoot, matching menu sounds.
26. **Voice.** The voice system and CC0 vocal sounds (see Decisions).

### Ship quality

27. **Speed.** Frame times in the heaviest battles, quality tiers, fixes.
28. **Playtest numbers.** Where players fall and where they stop, counted without anything personal.
29. **The release bar.** No overlaps at the three sizes, no quest that can get stuck, no crash; this file brought up
    to date.

### Added later

30. **Every land by hand** (with the owner's call on levels, above). Each live land's layout frozen to a map file,
    then reworked by hand an act at a time: who lives where by the land's story, each place dressed by its story.

## Where each piece stands (2026-11-19)

Each pull request says what it changed, how it was checked and what it left. A piece built on another says which to
merge first.

| # | Piece | Where it stands |
| --- | --- | --- |
| 1 | This file, the act count, stale docs | #291 |
| 2 | One owner for the screen | #295 |
| 3 | Dungeon checkpoints | #296 |
| 4 | Split the oversized files | The dead 2D world renderer is removed: #317 (16 files, about 5,700 lines, its atlases and scripts; it also wrote down what the 3D world doesn't draw in two interiors). Splitting `engine.ts` and `sim/world.ts` is not done: nearly every other piece edits one or both, so it is best done once they have merged. |
| 5 | Hits | #311 |
| 6 | Animation | #298. The wind-ups and the hero's lunge were already so; the deaths were added. |
| 7 | Spells in 3D | Already so; #291 corrects the comment that said otherwise. |
| 8 | The camera | #299. The bosses' entrances and the roofs fading were already so; the fight's framing was added. |
| 9 | Readability | #305. The rim of light and the marks on elites were already so. |
| 10 | The HUD | #316 (after #295) |
| 11 | Icons and the map in 3D | #314 |
| 12 | Cutscenes | #313 (after #295) |
| 13 | Transitions | #300. The land's title card was already so. |
| 14 | Light | #304 |
| 15 | The placement editor | #318 |
| 16 | Landmarks and life | Already so, as the owner directed: a great work only where the story names one; weather and life about each land were in the game. |
| 17 | The hubs | #320 (after #318). Briarhollow and Emberwick were already laid out by hand. Highwall's relief camp gets set pieces of its own. Hearthstead is left as it is: its story is laid over the town by hand, piece by piece, and rebuilding the town would move all of it. |
| 18 | Dungeons | #315. The bosses' arenas and twelve of the secrets were already so. Shortcuts were not added: the checkpoints (#296) and the way home at the last boss leave no walk back for one to save. |
| 19 | Quests | Hints when they are needed were already so: the first-timer's hints come as each thing is first met, and a boss's mechanic is explained the first time it is seen. The rest is not done. The Prologue's beats are each a story event (the dusk, the gate, the raid, the rider, the seal, the inn, the door), so a shorter Prologue means cutting story, which is the owner's call. 91 of the 218 quests are a walk and a word (only explore or talk steps), story beats among them: which to fold into the scenes around them, and a side story with a twist in each land, are writing for the story's author. |
| 20 | Bosses | Not done. The builder (`scripts/sigilfall-3d-assets.mjs`) already takes models with skeletons and moves of their own (the farm animals, the horses, the dinosaurs). What is missing is the models: the CC0 monster packs that would fit the story's bosses download from Google Drive or itch.io, which the build environment can't reach, and the one on OpenGameArt has four monsters (a bat, a dragon, a skeleton and a slime), none of them right for a boss here. With a pack in the builder's folder on the owner's machine, a boss of its own is a kit in the builder and a line in `render3d/kits.ts`. |
| 21 | Companions | #307 |
| 22 | Loot | #306 |
| 23 | Difficulty | #310 |
| 24 | The mix | #301 |
| 25 | Effects | #302 |
| 26 | Voice | #303 (after #302) |
| 27 | Speed | #309 |
| 28 | Playtest numbers | #308 |
| 29 | The release bar | This table, and the bar as it stands on the open pull requests: nothing covering anything else (the screen check, `scripts/sigilfall-overlap-check.mjs` from #295, finds nothing at its four sizes on the story's beats, and reports any error on the page as it goes: none); no quest that can get stuck (`tests/sigilfall-quests-doable.test.ts`: every quest can be finished; `tests/sigilfall-campaign.test.ts`: a new hero plays the whole story by the quest arrow); every class's bot clears every dungeon. Not checked here: the 30 test files that need Node 24 (they run in CI), real phones, and real players. |
| 30 | Every land by hand | #319 (after #318): the 14 live lands the generator made frozen to map files, the editor's Ground page, and a test that holds a land worked by hand to the generator's rules for its wandering packs. Then one pull request per act, each after #319: Act I #321, Act II #322, Act III #323, Act IV #324, Act V #325, Act VI #326. |

## What code can't do

Spoken lines (recordings or actors), a score of its own (a composer), checks on real phones and real players watched
at play. Each piece says what it left for these.
