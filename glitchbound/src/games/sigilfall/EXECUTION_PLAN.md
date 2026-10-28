# Sigilfall — Execution Plan (Blueprint V2.9, the whole game)

The owner has asked for the whole blueprint to be carried out, not only the vertical slice it was first proving:
every point of Prompts 1–16 (and what Section 15 asks of the build before launch), the full story of STORY_BIBLE.md
through the Finale and Epilogue, and the Wardrobe and mounts. Planning artifacts (Prompt 0): REFACTOR_AUDIT.md,
ASSET_AUDIT.md, STORY_BIBLE.md, QUEST_REWRITE_MAP.md, VISUAL_BIBLE.md, COLLECTION_SYSTEM_DESIGN.md,
PROGRESSION_BALANCE.md, this file. Review evidence lives in `docs/review/phase-XX/`.

Status words: **done** (built, tested, screenshot-checked), **partial** (what is missing is listed), **open**.

## Prompt by prompt

| # | Blueprint point | Status |
| --- | --- | --- |
| 1 | Stabilization: joystick/multitouch, camera vs shake, depth sorting, Open Barrow, registry (incl. Duskspire), ultimate spam, quest activation, save migrations, HUD clipping, SIGILFALL_QA.md | camera, Open Barrow, registry, ultimate, activation, migrations **done**. joystick **regression-tested** (`sigilfall-touch`), depth sorting **not reproduced** (REFACTOR_AUDIT.md); SIGILFALL_QA.md **done**; the HUD checked on a phone on its side and a tablet, and fitted to a short stage (`0677f3d5`) |
| 2 | Briarhollow + Prologue + Chapel Crypt + one class with the 4th slot; world states and events; accept step | **done**, with interiors: the Bramble & Barrel, the Chapel of the Bell and the Elder’s Hall (data/interiors.ts), barred on the raid night, furnished by the camp’s progress |
| 3 | Progression rebalance | **done** (`17208eeb`) |
| 4 | Master hero (Mage) re-render + CHARACTER_ART_BIBLE.md, then the other six; portraits | **done as a smoothing pass**: every class (and every paper-doll person and mount) painted at 2×, smoothed to the world's 4× with a fine outline; CHARACTER_ART_BIBLE.md records scale, anchors, states and the brief for a native 4× redraw (new art, not made in code) |
| 5 | Spell expansion: the 4th slot, 35 new skills, talent mutations, boss partial CC | **done** (`a409df85`) |
| 6 | Wardrobe (HEAD/CHEST/WEAPON) + one production mount, then the roster | **done**: the Wardrobe, twelve mounts with deterministic sources (two travel, seven story, three prestige), riding rules, save v8 (COLLECTION_SYSTEM_DESIGN.md §5). Story looks come from the hand-made items the quests and bosses give |
| 7 | World art in region batches: landmark, routes, palette identity, credible entrances | **partial**: every land toured and fixed where it failed (docs/review/review-tour): each dungeon has its own entrance, ruins are built of each land's stones, meadows grow in clumps, the ground's chunk seams are gone, the finale's memory is a summer square. **Open**: bespoke landmark art per region beyond the packs (new art) |
| 8 | Quest rewrite by act: setup → escalation → complication → climax → aftermath; saved people reappear; side quests contribute | **done** for every act; the five-beat audit is in QUEST_REWRITE_MAP.md (its weakest chain, Rimeheld, now has a played rescue: `67c48a83`) |
| 9 | Companions and cinematic staging: camera focus, move-to, wait, emote, spawn/despawn, gate state, dialogue beat; skippable; debug presets | **done**: barks, arrivals, escorts, companions in events; in-engine scenes (sim/scene.ts: look, say, move, emote, wait; letterbox; skip with Space/Enter/click/tap; seen once, replayed safely after a reload) at fifteen beats from the first dawn to the bell (data/scenes.ts, `{ sfx }` steps for the bell); review presets for twenty-seven beats (progress/presets.ts; dev server or `?review`, review heroes send no scores) |
| 10 | Siege system: one representative Three Gates siege (intact → under siege → breached/liberated), then the others and the finale | **done for Act IV**: Hearthstead's defense; Highwall as the representative siege (besieged → breached → liberated, chosen from quest progress so a reload returns to the same state); the Gloam Gate (the cells held while Nyx picks the lock, Elyra and Wren led out, the Gatewarden); the field battle before the Muster Hall (seven allies, four bounded waves with bone catapults as the artillery, then the Bone Colossus). Tested in `tests/sigilfall-gates.test.ts`. Act VI's field battle at the Pale Reach and Crownfall's stages reuse it (`tests/sigilfall-finale.test.ts`) |
| 11 | Loot: less clutter, quest-item protection, rarity visuals, authored story rewards; cosmetic reward sources | clutter **done** (about a third fewer pickups, no plain junk from the rank and file: PROGRESSION_BALANCE.md Part 3); mount and look sources **done** (Prompt 6). Quest objectives count kills, not bag items, so no quest can be blocked by selling; looks survive salvage. **Open**: weapon-type special attacks |
| 12 | Crown City districts and interiors; war-state variants; Three Gates fortresses share the kingdom language | war states of the Crown City **done**; interiors **done**: the Ember Hearth, the Great Hall of the Ember Keep (court table → war council after the Night of Knives), Brannoc’s Forge; the war-time variant (banners and refugee fires between the Gates) **done** with Act IV |
| 13 | Dungeons: identity, an encounter mechanic, a multi-phase boss each; registry tests | twelve dungeons with phased bosses and registry tests: Blightheart (Rotwood Colossus, the Withered Queen; Sigil of Thorns), the Molten Throne (Magma Warden, Ashkar and his chains; the Pale Crown broken) and the Spire of the Tear (Veil Sentinel, the Pale Herald; Sigil of the Veil) registered, retold, bosses retuned to their new levels and drawn as recolors of the approved art (every class clears each with uncommon gear, `tests/sigilfall-dungeon-*.test.ts`). Duskspire, Vaelmoor Remembered and Crane's catacombs registered with Acts VI and the finale; every dungeon has its own entrance (`b48c132f`). **Open**: bespoke boss art beyond recolors (new art) |
| 14 | Dead Kingdom (Act V), Last March (Act VI), Crownfall, Epilogue (rebuilt Briarhollow, the bell), postgame Heroic/Mythic, a prestige mount | **done**. Act V (`26ee957e`). **Act VI** at the Pale Reach: every faction the hero helped sends one troop to the field (`alliesIf`: Hollis's rangers, Dunmore's riders, Kragholt's axes, the clans' archers, the Thorn Court's knights only if Silvaine sang the prince back, the jarls' huscarls, the sun houses' lancers, Vinehold's skirmishers either way); the siege mages held while the outer wall comes down, the breach, Vosk and the Herald's voice kept by the Crown; companion lines that follow finished side arcs. **Crownfall**: Duskspire registered (the Ashen Guard, the throne-room duel with Vaelor), a tear into **Vaelmoor Remembered** (the Crown's memory, a summer state), **Elyra's choice** (`crownfall` choice: Vaelor's one hour or break it now; who stays in the memory, Elyra's lines and a stone in Briarhollow follow it), the Ash Crown's final form. **Epilogue**: the camp goes home (an event), Briarhollow `rebuilt`, Haldor's bell (a scene with `{ sfx: 'bell' }` steps), aftermath lines across the Vale. **Postgame**: Heroic and Mythic Duskspire after the bell, three threads (Wren's first night, Crane in the new catacombs dungeon, the Herald's first face under the Tear), the **Crownfall Destrier** (clear Duskspire and the memory on Heroic). Tested in `tests/sigilfall-finale.test.ts` and three dungeon tests |
| 15 | Audio conventions, reduced motion and screen shake, volume, final art review | volume, screen shake and **reduced motion** (no shake, a third of the weather, no canopy shimmer; a first visit takes the device's setting) **done**; quest, scene and bell sounds and the feedback conventions (VISUAL_BIBLE.md) **done**; the visual review done (SIGILFALL_QA.md); remaining polish needs new art |
| 16 | Full regression, validate:sigilfall, SIGILFALL_RELEASE_CHECKLIST.md | **done** (SIGILFALL_RELEASE_CHECKLIST.md; what could not be verified is listed there) |

## What is left (needs new art or a real device)

- Bespoke art: a native 4× redraw of the paper doll (CHARACTER_ART_BIBLE.md brief), the finale's bosses and the
  new dungeons' foes beyond recolors, the mount roster beyond the code-painted bodies (COLLECTION_SYSTEM_DESIGN.md
  brief), landmark buildings per region.
- On a real phone: frame times in the heaviest battles, audio, the full-screen play mode.
- Not reproduced, so not fixed: tree/roof depth sorting (needs the place).
- Weapon-type special attacks (Prompt 11): left out so the classes' bot-tested balance holds.

## What already shipped, by act

- **Prologue** (`d0082a62` and after): Briarhollow's dusk, raid, crypt and camp states; Elyra and Mara.
- **Act I** (`06cf60a7`): the story layer for generated zones; Fernstead's stones, Millbrook's blockade, Reedwater's
  abducted, Gullport's slip, the Defense of Hearthstead; the camp's arrivals. Save v4.
- **Act II** (`87ec2d24`): the refugee escort and Nyx, the occupied pass, Lantern Hill's vigil, Orren and Cael,
  Stormwatch's Light, the Crown City's traitor and the Night of Knives. Save v5.
- **Acts III–IV, built zones** (`0a9e1520`): choices that close the other path, the factions' dilemmas, the Pale
  Herald at the Tear, Fernstead lost and retaken, Highwall's relief under Mara and Cael's sortie. Save v6.
- **Progression** (`17208eeb`) and **skills** (`a409df85`): XP that follows the story, a slower ultimate, cheaper
  respec, 35 new skills with talent mutations, boss partial CC. Save v7.
- **Wardrobe and mounts** (`1c10c246`): save v8. **Interiors** (`c6880065`). **Scenes and presets** (`780f6ca8`).
- **Act IV's Gates and Act V** (`26ee957e`), **Act VI, Crownfall, the Epilogue and the postgame** (`61ed6e92`).
- **Riftstone and Paragon** (2026-10-27): the old Riftstone branch (`sigilfall-phase5`) brought into the new story
  as an endless ladder past Mythic, climbed as Diablo's rifts are, with Paragon levels past 60. Save v11.
- **One art language** (2026-10-28): every outdoor land drawn in Royal Keep alone (ASSET_AUDIT.md); buildings solid
  where drawn, entered through their painted doors (marked); straight roads; indoors peaceful, the skill bar put away.

## Rules carried through every phase

Save migrations are versioned and tested; ids are never renamed; raw packs never enter the bundle; every batch runs
typecheck, lint, the Sigilfall tests and the production build before it is committed by pathspec and pushed to
`pre-release`; the project's formatting is hand-kept (never run Prettier over it).
