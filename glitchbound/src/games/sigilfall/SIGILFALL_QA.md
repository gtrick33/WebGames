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

## The pass to 9/10: its regression bar (2026-11-24)

`NINE_PLAN.md` has the bar and the baseline every piece is measured against. Besides the four commands above:

```
node scripts/sigilfall-tour.mjs --out docs/review/sf9-<topic>     every act's beats at three sizes, the Riftstone, the
                                                                  Vigil, the Ring and the old saves; fails on any error
node scripts/sigilfall-overlap-check.mjs                          nothing on the screen covers anything else
node scripts/sigilfall-bench.mjs --size desktop | phone           draw calls and triangles in the heaviest fights
node scripts/sigilfall-load-check.mjs --size desktop | phone      what a new player loads before the first fight (after a build)
node scripts/sigilfall-load-check.mjs --size phone --net slow4g   the same on a slow phone line (fast4g too)
node scripts/sigilfall-soak.mjs                                   nothing held on to over rounds through every land
```

They need Playwright (`npm i --no-save playwright`, or `NODE_PATH` set to a folder that has it) and are run one at a
time: two at once share the machine and spoil each other's numbers. `tests/sigilfall-save-fixtures.test.ts` loads three
saves written by the game before the pass began (`tests/sigilfall-saves/`); the files are never made again or edited.

## Coverage by area

| Area | Tests |
| --- | --- |
| Save versions 1→9, field validation, the fog-of-war backfill, migrations of every act, Wardrobe and mount backfill | `sigilfall-world`, `sigilfall-story`, `sigilfall-vale`, `sigilfall-road`, `sigilfall-alliance`, `sigilfall-collection`, `sigilfall-progression` |
| Quests can be finished (places, foes, people, bosses, prerequisites, givers who stand somewhere) | `sigilfall-quests-doable` |
| The whole campaign from a new save by the quest arrow: every quest (218 since the rewrite of 2026-11-18; 515 before), no quest the arrow can't point at, no chapter waiting in a land nothing leads to | `sigilfall-campaign` |
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
| The hero's look | `sigilfall-look` |
| Riftstone (scaling, the week's affixes, the clock, levels opening, nothing lost when late, the Riftstone's source) and Paragon (levels, points, caps, stats, saves) | `sigilfall-keystones`, `sigilfall-rift-clock` |
| Saves written before the pass to 9/10 (a hero mid-Prologue, one mid-Act III, a finished one in the Riftward in Rift gear) come back whole | `sigilfall-save-fixtures` |

## Known issues

| Severity | Issue | State |
| --- | --- | --- |
| P3 | The bot's warrior loses Mythic Morgrave about half the time once its potions are gone (the test gives it a second try, as a player would restock) | accepted; the play-through test allows 30 s for its three runs |
| — | The bot's mage is a coin flip against the late bosses (the Herald, Corvane, Vaelor): it clears on some seeds and dies over and over on others | closed by the owner (2026-10-27): the late bosses are meant to be hard; dungeon tests give every class up to three runs (`clearsWithRetry`) |
| P3 | The arcade's startup JavaScript is at 120.1 of its 121 KB budget (none of it is Sigilfall's: the game loads on its own page) | watch |
| — | Stuck joystick | not reproduced; now regression-tested (`sigilfall-touch`) |
| — | Joystick jitters and jumps (playtester, 2026-10-28) | fixed: every redraw of the controls (a toast, a cooldown) put a held stick back at rest; regression-tested (`sigilfall-touch`) |
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
  reward; the giver's next request follows in the same talk. 374 of the 514 quests are handed in (those
  whose giver is near where the work is; the story's own beats flow on by themselves). The first fight, at
  Briarhollow's gate, teaches the controls as it goes: its waves show the strike, the skill and the dodge
  they ask for. Main story marks are gold, side
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

## Co-op Riftstone runs (2026-10-27)

- Party: `net/room.ts` on the room server (private rooms only, four seats, cards with name, class, level and
  look; the leader plans and starts; a run takes nobody new; level 60 for a Riftstone run). The fight's traffic
  goes through the room's relay unstored (`relay.save: false`; messages up to 24 KB for this game).
- `tests/sigilfall-coop.test.ts` wires a host's and a guest's world together: the guest mirrors the host's
  enemies, its hit kills one on the host and both heroes are paid; what the host's enemies throw reaches the guest
  (a dodging guest isn't struck; the guest's copies never strike); enemies chase whoever is nearest; a guest's
  fall costs the clock; the boss's fall ends the run for both on the host's time and opens each hero's levels.
- Checked live with the room worker, the Pages functions and two browsers on different origins: the invite link
  joins the party after a hero is chosen; the leader's plan and start take both games into the same run; the
  rooms seal on both and the guest is drawn in; the guest's hit kills the host's enemy and both take its 170 XP;
  the host's enemies kill the guest; the clock counts both falls; the guest sees the leader with a name, health
  and a party frame; the leader going home ends the run for both, who stay in the party.
- Not verified: two real phones on mobile networks (latency, a phone locking mid-run). A leader's phone that
  locks stops the enemies for everyone until it comes back.

## Questing together (2026-10-27)

- The room picks the leader at the start: the hero with the fewest main-story quests done (the room's host on a
  tie). Only the leader's `go` moves the party; every game follows `plan.region` when `trip` changes.
- `tests/sigilfall-coop.test.ts` adds: the hero furthest behind leads and only they choose the way; a guest ahead in
  the story shows the leader's Briarhollow (its own quests untouched); a story event won on the leader's game
  completes the guest's quest for it; an open land's frame holds only the enemies near a hero.
- Checked live (two browsers, the local room worker): a level-60 hero who finished the story made a questing party
  and a new level-1 hero joined by the invite; the new hero led, the veteran's Briarhollow turned to the newcomer's
  dusk with the veteran's quests still done; the veteran's own travel was refused ("You travel with your party's
  leader"); the leader's road to the Whisperwood took both games there, with the leader's packs mirrored near the
  veteran.
- Known limits: the leader's story companions (allies in an event, people a rescue leads) show only on the
  leader's game; a veteran phased into a newer hero's world may find someone their own quest wants elsewhere.

## The opening, scenes and phones: the owner's list (2026-10-28)

- **The first minutes run on.** A new hero sees the gate at dusk (faded up from dark once the land's art is in)
  for a moment before Mara speaks; nothing is said over a dark screen. Allies no longer pop in beside the hero
  as each beat starts (`sim/story.ts` `ally`):
  - Mara steps out from where she stood at the gate when the fight starts;
  - she stays with the hero through the bell and into the lanes (the same companion, not a new one);
  - she keeps the square after the lanes, and comes running up from it for the door;
  - Elyra is found at the burning inn and stays on from the inn to the door.
  - The rescued children walk in at the chapel door instead of vanishing.
  - Anyone else an event brings runs in from just beyond the view, from the side named by the event's `enter`.
- **The chapel door is held at the chapel.** The door being defended stood two tiles out on the cobbles; it now
  bars the chapel's own door (`briar-chapel-door`, 46,17).
- **A scene is a clean picture.** The HUD, the tracker, the minimap, the bar, toasts, health bars and the
  objective arrow step aside under the letterbox. A banner or toast that comes during a scene waits for it to end.
- **Quests point to the map.** A click on the tracker, or a quest's Map button in the log, follows that quest
  and opens the map with its objective ringed, the quest's step over the map and a way back to the log.
- **Phones.** Toasts sit under the hero's frame, clear of the top row, the minimap and the quest. On a phone
  held upright, the wave count and banners sit under the quest.
- **The site.**
  - A game playing in the page on a phone goes full screen at the next touch on it. Only the player's own
    "Exit full screen" keeps it in the page.
  - On iPhone Safari (no element full screen), the page under the pinned game is emptied while it is pinned,
    so a swipe can't carry the page down to the footer.
- **Icons.** The ultimates of the ranger (Rain of Arrows), the warrior (Earthsplitter), the priest (Halo)
  and the warlock (Summon Brimstone Golem) had the same icon as one of their own skills; each has its own now.
  Piercing Arrow no longer shares the basic Arrow's icon. Other skills within a class still share icons; a
  free icon pack is to replace them all once itch.io can be reached from the build environment.
- Checked in the browser (Chromium; the phone checks by emulation):
  - the arrival before Mara's first line;
  - Mara stepping out at the gate, and still the same companion in the lanes;
  - the children going in at the door, and Mara running up from the square;
  - the bell scene with the UI gone;
  - toasts and banners at 915×412, 740×360 and 412×860;
  - the map from the tracker on desktop and phone;
  - a phone game going back to full screen after the browser left it, and staying in the page after the
    player's own exit;
  - the pinned page's scroll room on an iPhone-like setup (Safari's user agent, no element full screen).
- Not verified: a real iPhone. The emptied page under the pinned game is the fix for the footer showing; Safari's
  own rendering of a fixed stage while its bar moves was not reproduced here.

## Skill and talent icons from game-icons.net (2026-10-29)

- The owner asked for a free icon pack from itch.io. itch.io is blocked by the build environment's network
  policy, so the owner chose game-icons.net's set instead (CC BY 3.0; fetched from npm and GitHub).
- **Skills:** each of the 127 skills has its own picture (`render/art/iconPicks.ts`). None is shared, within a
  class or across classes.
- **Talents:** the 461 talents draw from a pool for what they do (time, critical hits, power, frost…). Talents
  in one tree that do the same thing take the pool's icons in turn. When a tree has used a pool up, a talent
  shows the icon of the skill it changes. No tree shows the same icon twice (`sigilfall-icons` test).
- **Look:** each silhouette is laid on a tile of the skill's color (a talent's: its tree's). It has a shadow, a
  dark outline, light from the top left and a thin frame, drawn at 128 px. Until the atlas has loaded, or if it
  fails to load, the old painted glyphs show.
- **Build:** `scripts/sigilfall-icons.mjs` turns the set (kept in `assets/sigilfall/game-icons/`, untracked) into
  `public/games/sigilfall/icons/` (305 icons, 463 KB, loaded with the game, not with the arcade). It also writes
  ICON_CREDITS.md (each icon and its artist) and the artists' names for the Settings panel's art credits.
- **Checked:**
  - `sigilfall-icons` tests: every skill has its own icon; every talent has one, unrepeated in its tree; the
    atlas holds exactly the picked icons, each credited.
  - In the browser: every class's skills in one sheet, the mage's three trees, the talents panel, the
    desktop bar, the phone's buttons, and the credits line in Settings.

## Cinematics, no teleports, and the map: the owner's list (2026-10-29)

- **The rider (A Rider in the Dark).** He no longer runs slowly, vanishes and reappears inside the town.
  - He walks up the road at a steady pace, and the camera stays on him through the gate.
  - He falls where he stops, and the one lying there is him (no swap, no jump).
  - After the talk he dies and fades out over about three seconds; then the camera goes to the inn as its
    roof catches.
- **Nobody pops in or out, anywhere in the story.**
  - The story's people fade in as they come and fade out as they go, unless they walk out of view.
  - People who walk in to a spot become the person who stands there; no swap and no jump.
  - A companion who has fallen far behind catches up out of sight, with a fade.
  - The people of a place who leave as the story moves on fade out where they stood, and so do the props the
    story takes away; townsfolk fade while a story fight is on.
  - `sigilfall-continuity` plays all 40 story events frame by frame. It checks that nobody pops in, vanishes
    without a fade, or moves more than 8 px in a frame. With the fade turned off, it catches 8 events.
- **Shots for the great moments** (`data/scenes.ts`, `opens`). Each is a few seconds under the letterbox
  before the fight. The wave musters in sight and waits, a title comes up in the lower bar, and the call to
  arms (banner, lines, sound) follows. Each plays once, and never in a co-op party. Twelve of the 40 events
  have one:
  - the Defense of Hearthstead;
  - the ram at its gate;
  - Fernstead taken back;
  - the Pale Herald stepping out of the grey, with his line;
  - the Night of Knives;
  - Fernstead's people coming in (the camera follows them);
  - the Sortie;
  - the Field Before the Hall;
  - the Fireships;
  - the Answering Water;
  - every banner marching into Dawn's Rest;
  - the Last March.
- **A boss met for the first time** is shown before it comes on (its name and title in the lower bar, a roar),
  except in a Riftstone run. Nobody notices the hero, and nothing attacks, while a shot plays. A new war-horn
  sound opens the battles.
- **The map.**
  - The wheel, a pinch or the + / − buttons zoom both maps; a drag moves them; ⤢ shows the whole map again.
  - A land picked on the world map shows its own map on the left, as far as the hero has explored it. Where
    they haven't been is black, and a land they have never set foot in is all black ("Not explored yet").
  - Another land shows its waystones and roads; "back to …" returns to the land the hero is in.
- Checked:
  - Tests: `sigilfall-continuity` (every story event); `sigilfall-scenes` (every shot holds its wave in sight,
    lets it go after, calls to arms once, never twice; a boss met for the first time is shown, once); the
    courier test in `sigilfall-story`.
  - In the browser (Chromium; the phone by emulation): the rider's walk, fall, talk and fade; the shots for
    Hearthstead, the Herald, the Field Before the Hall, the Last March, the Night of Knives, Fernstead's
    people and every banner; Warden Ossric met; the map zoomed, dragged, another land, an unexplored land and
    the world zoomed, on desktop and phone.
- Not verified: a real phone's pinch (the two-finger zoom was checked in code and by the + / − buttons, not by
  a real touch screen); the war horn by ear.

## Every act told like a film (2026-10-29, second pass)

The owner asked for all the quests in every act to have a cinematic feeling, checked for the same teleport and
vanishing bugs, and running smoothly. There are 514 quests (219 on the main story): 161 kill, 113 explore, 85
loot, 81 talk, 40 story events and 29 bosses. Writing 219 scenes by hand would wear thin, so the story is now told
in a few layers that every act shares:

- **Act titles** (`data/acts.ts`). As each act's first quest is taken, its title comes up over a darkened
  screen and the HUD steps aside: Prologue · The Night the Bells Stopped, Act I · The Villages of the Vale,
  Act II · Road to the Crown City, Act III · The Broken Alliance, Act IV · War of the Three Gates, Act V · The
  Dead Kingdom, Act VI · The Last March, The Finale · Crownfall, and Epilogue · The Bell. Each shows once.
  A hero whose current act hasn't had its title yet sees it on entering the game. A new hero sees the
  Prologue's title over the gate at dusk before Mara speaks.
- **Lands and places.** The first time the hero enters a land, its name, kind, levels and subtitle come up as
  a title (later visits keep the banner). A place found (113 explore steps, and the hidden groves) comes up as
  a "Discovered" title instead of a banner.
- **Shots for 36 of the 40 story events** (data/scenes.ts `opens`), each its own way:
  - battles: the enemy line with a title and a war horn;
  - defenses: the thing to hold first (the chapel door, the Harvest Stone, the Patience, the great lamp, Nyx at
    a lock), then what is coming for it;
  - rescues: the people to save, some with their first line (the queen's children in the snow, Elyra in her
    cell);
  - arrivals and the caravan: the camera follows the column walking in (the six camp arrivals, Nyx under the
    white rag, the sick villages' wagon, the camp going home).
  - The four left are the Prologue's first fights, which have their own staging (the gate, the bell, the rider,
    the inn).
- **Slow motion.** A boss's last blow and the last foe of a story fight fall slowed, with the camera drawn to
  them (not in a co-op party).
- **Story conversations.** Talking to anyone in the story (anyone who isn't only trading, or anyone giving or
  taking back a quest): the HUD steps aside, the top bar comes down, and the camera frames the hero and the
  speaker above the words.
- **Bugs found and fixed:**
  - An arrival could begin during a scene in the same place and lose its shot. Maren's first-dawn scene and
    the rangers walking in both fired in the square, so the rangers were already there when she said "a camp
    needs someone to go and bring the others in". Now a story event with a shot waits for a scene that is
    playing, and Maren's dawn scene starts from further out, so she speaks first and then the rangers walk in.
  - The new title cards first came up squeezed into a side panel: their class name clashed with the panels'
    `.rb-card`. They are `.rb-tcard` now.
- Checked:
  - `sigilfall-cinematics`: the acts open in story order; a boss's last blow slows time and then time runs on;
    a story fight's last foe is slowed once; never in co-op.
  - `sigilfall-scenes`: every shot holds its wave and lets it go; every event but the Prologue's four has one.
  - `sigilfall-continuity`: all 40 events with their shots, nobody popping in or out.
  - The whole Sigilfall suite.
  - In the browser: the Prologue title before Mara, the Act II title, the Whisperwood's land title, Maren
    speaking framed (phone), a place discovered (phone), the dawn scene then the rangers walking in (phone),
    the shots at the cells, in the snow and at the ram, and Warden Ossric's last blow slowed.
- Not verified: every one of the 36 shots by eye. The test plays each one and checks its people and places are
  there; nine were looked at in the browser.

## The owner's remarks after the cinematics (2026-10-29)

- **Oskar the same size walking as fallen.** Every follower walking in (Oskar, the carters, the healers, the
  refugees, Elyra freed) was drawn at 72% size, then snapped to full size as they became the person standing
  where they stopped. Only children are drawn small now.
- **The warrior's and paladin's shield on the front.** It was drawn behind the body facing us and over it
  walking away. Now:
  - facing us, it is in front of the body;
  - side on, it is carried forward on the leading side, with the weapon at rest in the trailing hand;
  - walking away, it is on his back, behind the body.
- **Fewer drops.** Gear still comes only from chests, bosses and quests, and a land's chests fill again on each
  visit. Now:
  - a chest holds one piece (rare and epic chests used to hold two);
  - an ordinary chest gives a piece about every other time, and coin otherwise;
  - a boss gives one piece fewer.
  - Gear from a land's chests is about halved: the Amberfield, for example, goes from 6 pieces a visit to about 3.
- **Light at the chapel.** Briarhollow's chapel had no lamp near it, and at night the people by it (Maren, Mara,
  Elyra, Old Haldor) were hard to see. It now has torches either side of its door, lamps at the corners of its
  yard, and the survivors' fire before it on the night after the raid.
- **The chapel door.** The door held in the Prologue is no longer drawn: the chapel's own door, in its art, is the
  door. Its health bar sits over the top of it, and the raiders strike at its foot.
- Checked:
  - the loot tests (one piece from a rare chest, an ordinary chest paying out about half the time, a boss's
    drop);
  - in the browser: Oskar walking and fallen at the same size; the warrior in all four facings; the chapel at
    night and during the door fight, close up.


## Every quest checked for the same faults (2026-10-29)

The owner: "check every other existing quest for such abnormalities and fix them". A new test
(`tests/sigilfall-quest-audit.test.ts`) goes through every quest, step by step and at its hand-in (about 880
moments). In each one:
- whoever the step needs is there;
- nobody stands in a wall, out of the hero's reach, or behind something tall that hides them.

It also starts each of the 40 story events. Everyone and everything each event puts down can be reached, every
place it uses exists, and those who walk in, or beside a wagon, get all the way. What it found, and what else
was found by looking:

- **People stuck in walls.**
  - Duskfen's caravan set its four refugees down inside the house by the causeway. They stood there while the
    wagon went on.
  - One of Fernstead's refugees coming into Briarhollow was stuck the same way.
  - The people an event places round a spot now go on open ground. If the step is blocked, they take the same
    step the other way.
- **People hidden behind things.** These 17 people could not be seen:
  - eight traders behind their own stalls, in Gloamhollow, Grimward (two), Highwall, the Pale Reach, the Sunken
    Reaches, Vinecoil and the Weeping Woods;
  - Brother Orren, half behind a stall in the Ashen Barrows;
  - the merchants behind their pavilions in Sunscorch and Sablewind;
  - Dorran and Mabry behind statues;
  - Hale behind a tent in the Amberfield;
  - Fernstead's three refugees behind their tents in Briarhollow.

  A trader now stands in front of the stall. Nobody is set down with a stall, tent, pavilion, statue or well
  just in front of them, and Fernstead's people stand round their fire.
- **People in the dark.** 20 people the story needs stood in no light at night:
  - Oskar during the raid;
  - 15 of Emberwick's people on the Night of Knives;
  - Brin and Gale in Gloamhollow.

  Everyone in a place now carries a small light at night. So do allies, the people being led, and the thing
  being held.
- **The boats.** The Patience and Isolde's fireship looked like a bench on blocks. The fireship also stood on
  the grass, a dozen tiles from the water. Now:
  - each boat has a hull, a mast and a furled sail;
  - a fireship carries kegs and flies a red pennant;
  - each boat is moored in the water by the bank, and the harbor quay is on the river.
  - Raiders find their way to the bank beside the boat. Without this they couldn't reach it, and the boat was
    safe.
- Checked:
  - the new test (3 tests); it fails on the caravan, the hidden traders and the Fernstead tents with those
    fixes taken out;
  - all of Sigilfall's tests;
  - in the browser: the caravan's refugees at the wagon and on the road, the traders, merchants and Fernstead's
    camp, people at night in Emberwick and Gloamhollow, and both boats.
- Not verified:
  - frame time with the added lights in a crowded town at night on a phone;
  - the fireship's stern still touches its bank, which runs north and south there.

## The Ember Keep, majestic and terrifying; its Great Hall glorious (2026-10-29)

The owner: "scale up the castle, make it more majestic, big and terrifying, inside also seems empty, make it
feel glorious".

- **Outside.** The Regent's keep in Emberwick is now a fortress:
  - it is drawn at twice the size of any keep in the land, about 12 tiles wide and 14 tall, and is as solid as
    it is drawn;
  - it stands between two tall round towers, with two square towers further out and set back;
  - its towers rise over the city's north wall;
  - all of it is in dark stone: the walls and roofs are darkened and cooled toward granite, the lit windows burn
    warmer and the banners stay crimson. The pack's art is recolored when it is drawn; no new art ships.
  - Its forecourt is wider. Braziers burn either side of the door, the kingdom's banners stand on poles, statues of
    the old kings stand at its corners, and torches line the avenue.
  - Its door, and the way into the Great Hall, are where they were.
- **The keep revealed.** The keep is taller than the screen. So the first time the hero comes up the avenue, the
  camera climbs it, under the title "The Ember Keep, Seat of the Regents of Aster", with a war horn. Then the
  Regent's own scene plays. A scene can now look at a building by its name.
- **Inside.** The Great Hall is bigger (31 × 26 tiles, from 22 × 18) and is now:
  - a long hall of columns, each hung with the crown's banner;
  - tall windows of colored glass on the north wall, their light lying across the floor;
  - a crimson runner from the door up three steps onto a gilt-edged dais;
  - a high gilt throne under the crown's banner, between two burning braziers;
  - statues of the old kings and queens along the walls, with knights' armor between them;
  - the court's long tables in the aisles. After the Night of Knives, the war council's map and racks of arms
    replace one table, as before.
  - The new pieces are drawn in the game's own furniture style: the runner, the dais, the throne, the columns,
    the windows, the light, the great banner, the statues and the armor.
- **Inside, second pass.** The owner: line up the different statues sideways, as a path to the throne from both
  sides; connect the carpets vertically; make the surroundings glorious as well.
  - A path of statues lines the runner on both sides, one pair on every row of columns. Nearest the throne are
    kings (crowned and cloaked, hands on their swords), then queens with scepters, then sages with staves, then
    knights behind their shields nearest the door.
  - Gilt lions sit on plinths at the foot of the dais steps.
  - The carpet is one piece from the door to the throne: the dais draws its own edge, with no line across the
    foot of its carpet where the runner meets it.
  - The floor runs wall to wall. Between the colonnades it is ivory and lilac marble with gilt studs, edged in gold
    and crimson. The aisles are dark polished slabs with gilt seams.
  - The court's tables stand on rugs, blue banners hang between the windows, and fires burn in the far corners.
  - A floor, drawn in order of its top edge, is kept in view while any of it shows (it had vanished from the
    view at the door).
- **Fixes along the way:**
  - A picture drawn bigger than its own pixels is drawn smoothly, and the view keeps any big picture while any
    of it is on screen.
  - A brazier's flame is drawn with its bowl, in depth, so the dais can't hide it.
  - A rug, runner or dais is drawn in order of its top edge: all of it lies under whoever stands on it.
- Checked:
  - a new test (`tests/sigilfall-ember-keep.test.ts`): the keep's size, its towers, its dark stone and its door;
    the reveal playing before the Regent's scene; the runner unbroken from the door to the dais, and the
    throne between its braziers; the path of statues either side of the runner (a pair on each row, at least
    four kinds), and the lions at the steps;
  - the buildings and scenes tests updated: a door painted on a bigger picture; a scene looking at a building;
  - in the browser: the reveal, the forecourt by day and on the Night of Knives, the keep's side by the
    barracks, and the hall from its throne, from its door and as the war room.
- Not verified:
  - on a phone, the keep, drawn at twice its pixels on a sharper screen, is a little softer than the art around
    it;
  - the recolor is made from the art when it is drawn, in the browser; Safari was not tried.
