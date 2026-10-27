# Sigilfall — QA (blueprint Prompt 1, kept current every batch)

## How to check a build

```
cd glitchbound
npx tsc --noEmit -p .
npx eslint src/games/sigilfall tests/sigilfall*
npx vitest run --no-fsModuleCache tests/sigilfall*
npm run build
```

`--no-fsModuleCache`: the shared Vitest cache sees other sessions' half-written files (parallel sessions share
this checkout). Review screenshots: on the dev server, `window.__rbShot('phase-XX/name.png', [w, h])` saves
the game view to `docs/review/`; review presets (Settings, on the dev server or with `?review`) jump a hero to
a story beat.

## Coverage by area

| Area | Tests |
| --- | --- |
| Save versions 1→9, field validation, the fog-of-war backfill, migrations of every act, Wardrobe and mount backfill | `sigilfall-world`, `sigilfall-story`, `sigilfall-vale`, `sigilfall-road`, `sigilfall-alliance`, `sigilfall-collection`, `sigilfall-progression` |
| Quests can be finished (places, foes, people, bosses, prerequisites, givers who stand somewhere) | `sigilfall-quests-doable` |
| The whole campaign from a new save by the quest arrow: all 515 quests, no quest the arrow can't point at, no chapter waiting in a land nothing leads to | `sigilfall-campaign` |
| The quest arrow for story events, raiders who don't give up, bosses felled early, foes the story sends in, shut roads and two-way roads, fog of war | `sigilfall-guidance` |
| One land per place id (the arrow and what counts would go to the other) | `sigilfall-ids` |
| Region, dungeon and id integrity (no road to an unregistered region) | `sigilfall-ids`, `sigilfall-dungeons` |
| Every act's events played on the simulation | `sigilfall-vale` (Act I), `sigilfall-road` (Act II), `sigilfall-alliance` (Acts III–IV) |
| Classes, skills, talents, ultimate charge and its exploits | `sigilfall`, `sigilfall-classes`, `sigilfall-new-skills`, `sigilfall-economy`, `sigilfall-sim` |
| Bot play-throughs of dungeons on every tier | `sigilfall-sim`, `sigilfall-dungeon-*` |
| Camera (no jitter between aim and camera) | `sigilfall-camera` |
| Touch: two thumbs, finger ownership, release on cancel/lost capture/blur/unmount | `sigilfall-touch` |
| Wardrobe looks never change stats; mounts: call, refusals, dismount on hit/action/event | `sigilfall-collection` |
| Interiors: doors in and out, raid-night bars, everyone reachable, nobody rides indoors | `sigilfall-interiors` |
| Scenes and review presets: everyone named is there, skip, once only, reload-safe | `sigilfall-scenes` |
| Art integrity (every named piece exists), the ground painter, the hero's look | `sigilfall-art`, `sigilfall-ground`, `sigilfall-look` |
| Riftstone (scaling, the week's affixes, the clock, levels opening, nothing lost when late, the Riftstone's source) and Paragon (levels, points, caps, stats, saves) | `sigilfall-keystones` |

## Known issues

| Severity | Issue | State |
| --- | --- | --- |
| P3 | The bot's warrior loses Mythic Morgrave about half the time once its potions are gone (the test gives it a second try, as a player would restock) | accepted; the play-through test allows 30 s for its three runs |
| — | The bot's mage is a coin flip against the late bosses (the Herald, Corvane, Vaelor): it clears on some seeds and dies over and over on others | closed by the owner (2026-10-27): the late bosses are meant to be hard; dungeon tests give every class up to three runs (`clearsWithRetry`) |
| P3 | The arcade's startup JavaScript is at 119.9 of its 120 KB budget (none of it is Sigilfall's: the game loads on its own page) | watch |
| — | Stuck joystick | not reproduced; now regression-tested (`sigilfall-touch`) |
| — | Tree/roof depth sorting | not reproduced; needs the place and a screenshot |
| — | Loot clutter | fixed: a third fewer pickups, no plain junk (PROGRESSION_BALANCE.md Part 3) |

## Manual checks done in the browser (this batch)

- Wardrobe tab (looks, locked silhouettes and sources, apply/clear, mounts) on a narrow pane.
- Riding the Briarhollow Chestnut and the Royal Warhorse in four facings, with a Wardrobe hat on the rider.
- All six interiors entered through their doors; the camp's banners and cots show by progress.
- The first-dawn scene in Briarhollow through the review preset.
- A phone on its side (740 × 360) inside the page: the site's bars leave the game a 192 px stage; the thumb
  cluster now scales to the stage's own height (container queries in Game.css) and the tracker, minimap and
  interact button make room. A tablet (768 × 1024) shows the turn-sideways hint over a HUD that fits.
- Every land toured at 640 × 360: hairlines between ground chunks in small windows (fixed), one cave mouth for
  every dungeon (each has its own door now), the same pillar ring in every ruin (each land's own stones now),
  the fey wood's noisy paving (plain cobble now), sparse meadows (plants in clumps now).

## Hardening pass (2026-10-27)

A walk-through of the whole campaign on the simulation (`tests/sigilfall-campaign.test.ts`): a new hero goes
wherever the quest arrow points, takes every "!" quest, fights every story event, and must finish all 515
quests. It found, and these are fixed:

| Severity | What a player met | Fix |
| --- | --- | --- |
| P1 | The Ironpeak chain (a Crown Sigil) could never start: Nyx offers it, and she left Stilt Hollow the moment her own quest ended | whoever you talk to hands over what that conversation opened, in the same breath (engine `talk`) |
| P1 | After Nyx came back with the Herald's map, nothing led on: "The Lamp Road" only started once already in Gloamhollow, and the Shattered Vale had no road north to it | the hand-off starts with the map; the Vale's north causeway (and Sablewind's road to the Sunken Reaches) added; the same zone-gated hand-off fixed for the Bonefields, the Pale Crown, the Dead Lake, the Veil Torn, the Last March and Crownfall |
| P1 | Story events (39 quests: raids, rescues, sieges, escorts) had no arrow or minimap mark at all; between waves the arrow led off to another quest | the arrow points at the event, then its raiders, then the way to safety |
| P1 | Raiders gave up and walked home when the hero led the rescued away (the Burning Inn could not be finished), or stood outside a town wall beyond the enemies' pathing reach (Hearthstead) | story raiders hunt the hero and find their own way in |
| P1 | On touch, an invisible Skip button sat over the basic-attack button and took its taps | it takes no taps unless a scene plays |
| P2 | A boss or a named foe killed before its quest asked: the quest pointed at an empty den (Grimtusk), or waited five minutes (Mother Mire) | an early boss kill counts; a wanted named foe is back within 20 s and the minimap shows its den |
| P2 | Vosk (and every foe the story sends into a land the hero is in) only appeared after leaving and coming back | story packs rise when the story calls them |
| P2 | Two lands shared the place ids `old-watch` and `gallows-hill`: the arrow led to the wrong land, and the wrong one counted | renamed; ids are now tested unique |
| P2 | Routes ignored roads the story keeps shut (the arrow led to Highwall's barred north gate) | routes walk round them |
| P2 | Heroic and Mythic clears pointed into a dungeon that walking in always opens on Normal | the arrow points to a waystone, where the difficulty is chosen |
| P2 | Inside a boss's dungeon the arrow could point back out to another quest | quests are ranked by where their objective is, not their home land |
| P2 | Warden Faelan was written but never placed: three Blightwood quests could never be taken | placed in the Blightwood's village; givers are now tested to stand somewhere |
| P2 | Vaelor beat the mage bot on some seeds and the CI run (Linux) by attrition | his health 11,000 → 9,500; his rot pools are capped at seven (the oldest dries) |
| P2 | The arcade's CI had failed since the source art landed: ESLint parsed Tiled's `.tsx` tilesets as TypeScript | `assets/` ignored by lint |

The UI pass, with an in-page audit (overlapping text, text cut off or off the stage, type under 9 px, hidden
buttons that still take taps, anything of the site's over the stage) at 1440 × 900, 1024 × 768, 844 × 390,
667 × 375 and 390 × 844, and in the immersive full screen:

- The world map: names were 4.5–5.5 px and 44 of them collided. It is drawn at a readable scale (about
  10 px names) in a box that scrolls and opens on the hero's land, spread out, with each name placed where it
  clears the others; lands are marked with icons (a house, a tree, a gate, a "?").
- The land map and the corner minimap use icons (waystone, chest, person, merchant, road, door, quest, the
  hero, a boss's skull) with an icon legend, and fog of war: what the hero has not been near stays dark,
  remembered per land on the save (`progress/fog.ts`, save v9; heroes from before see the lands they knew).
- A phone on its side: the site's floating tab bar and its settings button sat over the bottom third of every
  game's stage; on a game page they step aside, and the stage height counts the game's own bar.
- Desktop: every game's stage ended under the site's settings button; it now ends above it.
- A phone held upright: the turn-sideways card was cut off; the HUD's menu wrapped onto the skill buttons.
  The card fits; the HUD keeps one row on a narrow stage (Skills and Quests are tabs of the Hero panel there).
- Beside the arcade's side column a wide window has a narrow stage: the Hero panel's bag column was squeezed
  to nothing. The game's layouts now follow the stage's size, not the page's.
- Sunscorch's emptiest sands got two places, the Dead Caravan and the Sun Steles.

## Second pass: the owner's list (2026-10-27)

- **Quests like WoW** (`progress/handin.ts`, engine `talk`, ui `QuestPage`): a quest from a person is offered
  on its own page (story, steps, reward; Accept or Not now), may have several steps (`then`), and when its
  work is done waits to be handed in (state `ready`, a "?" over the giver) for a Complete page with the
  reward; the giver's next request follows in the same talk. 375 of the 513 quests are handed in (those
  whose giver is near where the work is; the story's own beats flow on by themselves). Mara's Yard is one
  quest of three steps (five hits, two skills, a dodge) handed in to Mara. Main story marks are gold, side
  quests blue (`isMainQuest`: everything the last bell needs). The quest log tracks any quest; the arrow and
  the tracker follow it.
- **Skill slots** open at 5, 10 and 15 (Q from the start); every ultimate at 8.
- **Haste and the ultimate**: the basic attack takes at most +60% from haste; charge from ultimate-charging
  effects comes out of the same budget as charge from hits; the budget banks at most 70% of a bar (a lull no
  longer refills a whole bar in a second); the ultimate's pace is 30% slower (about one every 36–42 s).
- **Portrait**: on a phone held upright with the game full screen, the game turns itself to landscape
  (`ui/turn.ts`; the joystick and skill drags read the fingers through the turn); Android also locks the
  screen to landscape on Play.
- **Phone and desktop**: when both changed the save, the cloud merge kept this device's list of heroes
  whole, losing the other device's progress; now each hero slot keeps the copy played last. The save is
  smaller (quests packed, save v10), so three heroes stay well under the 96 KB a synced save may be.
- **Art**: chests and loot are painted (`render/art/loot.ts`); portraits and the class cards use the
  smoothed figure; a hero can be a man or a woman (`Character.body`). The hero no longer blinks while the
  game is paused (the first dialogue).
- **Lands**: Briarhollow is laid out 35% roomier (`SpreadPlan`) with farms, an orchard and two cottages in
  the new room; the Whisperwood is drawn 1.4 times larger (120 × 70) with twelve more packs.

## Endgame: Riftstone and Paragon (2026-10-27)

- **The Riftstone** (`data/keystones.ts`), climbed as Diablo's rifts are: clearing Duskspire on Mythic hands over a
  Riftstone and opens Riftstone +1. At a waystone any dungeon can be run at any level opened so far ("Riftstone +"
  next to the tiers, a − / + picker). Enemies are at level 72 with ×4·1.08ᵏ health and ×2.1·1.05ᵏ damage;
  the week's affixes join at +2, +4, +7 and +10. The clock is each dungeon's own (about 1.3 times the bot
  priest's time on +1); falls cost 10 s. Under 60/80/100% of the clock opens three, two or one more levels;
  late, the run still pays and nothing is lost. Loot is made at item level 72 + the level (most 100); the
  Rift's cache drops 2 + level/3 items in time; the arcade's score adds 1,000 a level beaten in time.
- **Paragon** (`progress/paragon.ts`): experience past 60 earns Paragon levels (30,000 XP and 1,500 more
  each); a point each, into Might (+1% damage) and Vigor (+1% health) without end, Precision and Toughness
  up to 50. In the Hero panel; every point comes back free. The HUD shows "P<n>" by the level.
- **Measured with the bot** (Mythic gear, item level 72, no Paragon, the week's affixes): +1 in time almost
  everywhere for the warrior and priest; +5 in time in the smaller dungeons and close in the rest; +10 only
  in the first three dungeons, even in item level 82 gear. Rotmother Cistern's healers and regrowing
  vat-spawn are a damage check that stalls the bot from +5. The bot never spends Paragon points or plays
  around affixes, so a person should climb further.
- Checked in the browser: the picker and the week's affixes, the clock in a run (and on a short landscape
  stage, where it moves to a line at the top middle), the results card with "Riftstone +N here", the Paragon
  box and badge, and a reload keeping the stone and Paragon (save v11).
- Also fixed: the death, pause and results screens said "Return to Emberwick"; home is Briarhollow.
