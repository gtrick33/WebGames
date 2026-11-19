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
| Levels | The generated lands stay, with hand-built set pieces placed into them by a dev-mode editor that writes data files; the hubs are hand-built. |
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
   the hero's swings step into the blow, as in the Ring.
7. **Spells in 3D.** What flies and what warns on the ground stands in the 3D world at its true depth.
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

## What code can't do

Spoken lines (recordings or actors), a score of its own (a composer), checks on real phones and real players watched
at play. Each piece says what it left for these.
