# Sigilfall — Execution Plan (Blueprint V2.9 §13 order)

Planning artifacts (Prompt 0): REFACTOR_AUDIT.md, ASSET_AUDIT.md, STORY_BIBLE.md, QUEST_REWRITE_MAP.md,
VISUAL_BIBLE.md, COLLECTION_SYSTEM_DESIGN.md, PROGRESSION_BALANCE.md, this file. The owner has asked for the whole
plan to be carried out; each phase still ends with a review packet in `docs/review/phase-XX/PHASE_REVIEW.md`
(screenshots, commands, risks, rollback commit) and is reviewable with APPROVE / APPROVE + COMMENT / REVISE /
ROLL BACK.

| Phase | Blueprint | Status |
| --- | --- | --- |
| 0 | Audit and planning documents | **done** (this commit) |
| 1 | Stabilization | camera jitter **fixed** (`6943aa45`); Open Barrow **fixed** (`0995dd35`); registry/quest integrity **guarded**; ultimate spam **measured, fix in Phase 3**; quest auto-activation **in Phase 2** (needs the accept step) |
| 2 | Vertical slice: Briarhollow + Prologue chain + Chapel Crypt + the Mage, the world-event system, the art re-layering | **in progress**: art re-layering (`d0082a62`), world states + events + accept step + Briarhollow and its Prologue (this commit); next the Mage's new skills |
| 3 | Progression rebalance (PROGRESSION_BALANCE.md Part 2) | after 2 |
| 4 | Master hero (Mage) smooth re-render, then the other six | after 3 |
| 5 | Spell expansion: the 4th slot (**done**, `0fc10e2b`), 35 new skills, talent mutations, boss partial CC | after 4 |
| 6 | Wardrobe + first mount | after 5 |
| 7 | World art in region batches | after 6 |
| 8 | Quest rewrite by act (QUEST_REWRITE_MAP.md) | **Act I done** (`06cf60a7`): every Vale village changes when saved, its people walk into Briarhollow's camp, the Defense of Hearthstead. **Act II done** (this commit): the refugee escort and Nyx, the occupied pass, Lantern Hill's gloom and vigil with Orren and Cael, Stormwatch's Light, the Crown City's traitor and the Starfall Festival. Acts III–IV next |
| 9 | Companions and cinematic staging | with 8 |
| 10 | Battles and sieges (Defense of Hearthstead, Highwall) | Hearthstead **done** with Act I (raid, wall, ram); Highwall after 9 |
| 11–15 | Loot, hubs and interiors, dungeons, endgame, audio/polish | in order |
| 16 | Full regression and release gate | last |

## Phase 2 in detail (the vertical slice)

**2a — Render grid and art re-layering** (ASSET_AUDIT.md)
- Renderer at 4 art px per world px (`RES`), procedural art unchanged (drawn at world size).
- Art build: CraftPix Simple Summer and Poison Swamp ground (corner-transition sets analysed into a corner-Wang
  lookup at build time), CraftPix props and towers; Greenvale and Gloomvault Level B pieces with normalization
  grades; Royal Keep architecture smoothed ×2; VFX unchanged. A scale table per pack.
- Ground painter: corner-Wang for CraftPix and Worlds-bundle transitions (dual grid), Royal Keep 47-blob only for
  castle walls, moats and cliffs in fortified places.
- Scenery: CraftPix trees, bushes, rocks, fences and props; Greenvale cottages; Royal Keep only for keeps, walls,
  gatehouses, towers and the chapel; Gloomvault crypt dressing.
- People: townsfolk back to the paper-doll figures (Royal Keep folk are Level C); companions get their own looks.

**2b — World states and events** (STORY_BIBLE.md §4)
- `RegionState`: a region declares named states with conditions on quest progress; a state adds/removes markers
  (props, NPCs, spawns), swaps prop variants (roof → burned roof), sets ambience (smoke, embers, night tint) and
  music. Chosen when the region is entered, and re-chosen when a quest changes.
- `StoryEvent` objectives on quests: `raid` (waves into an area), `defend` (hold a point; allies on screen; a gate
  with health), `rescue` (reach people; they follow to a safe point), `escort` (a group walks a path), `ambush`,
  `arrival`. Events are driven by the existing waves/telegraph/enemy systems and resume after a reload from the
  quest's saved step.
- Companion **barks** and short in-engine **dialogue beats** (camera focus, NPC move-to, emote) with skip.
- The quest **accept step**: story and side quests are offered by their giver ("!"), accepted in dialogue, then
  tracked (fixes the auto-activation bug).

**2c — Briarhollow** (new region, a hand-authored village map in the Section 7 recipe) with dusk, raid,
aftermath and camp states; the Prologue chain (QUEST_REWRITE_MAP.md "New quests"); the Chapel Crypt (the old crypt
region, retold); new heroes start in Briarhollow, existing heroes keep Emberwick (save v3 marks the Prologue done for
anyone past `close-the-rift`).

**2d — The slice's class**: the Mage with the 4th slot and two of its new skills (Gravity Well, Purge), Magic Spells
VFX.

**2e — Evidence**: desktop, phone and tablet screenshots of Briarhollow in each state, the raid, the crypt and the
Mage's spells; tests for states, events (including reload mid-event), the accept step and the save migration.

## Act I in detail (done)

- **Zone story layer** (`ZoneSpec.story`, `PoiSpec.when`, `HubSpec.when/wall`): generated zones place people,
  props, fires, plumes and named places near a town, a sight, a house, a walled town's gate or the shore,
  each shown only while its condition holds; packs that the story sends away leave while the hero watches.
- **Event kinds**: `arrival` (people walk into the camp along the roads and become its NPCs); siege enemies
  (`siege`) that go for the gate and nothing else; companions stay to say their last lines.
- **Fernstead**: the Harvest Stones fouled with grieflight until held (`fern-stones`, defend the stone), then
  lit; the barrows quiet after the Grey Lady; rangers to the camp's watchfire (`camp-scouts`).
- **Millbrook**: the gang's blockade at the mill until broken with Sefa and the militia (`mill-the-bridge`),
  the barricade burns; Nyx reads the cipher for Pim (cameo); grain carts and Tobin's hens (`camp-grain`).
- **Reedwater**: wells reek of marsh-rot until Mire falls; the abducted led home (`reed-bring-them-home`,
  rescue across the marsh) and stand in the square after; healers to the camp (`camp-healers`).
- **Gullport**: the cove held, then abandoned; the drowned come for the Patience (`gull-the-slip`); the forge
  to the camp (`camp-smiths`).
- **Hearthstead**: a walled town; refugees camped by the road; the picket empties; the Defense
  (`hearth-the-riders-come`, `hearth-hold-the-wall`, `hearth-the-ram`), the empty shrine, Vosk's orders read
  by Gaius; Dunmore's riders to the camp (`camp-riders`).
- Save v4: a hero already past an inserted beat has played it.

## Act II in detail (done)

- **Escort** events: a wagon (a walking ward) and its people go down a road, stop while foes are near, and
  the waves find them where they are. **Gloom** state: a cold early dark (lighter than night).
- **Duskfen**: `the-sick-villages` is now the refugee wagon through the fen (the roads office closed the
  King's Road); Nyx joins at Stilt Hollow (`nyx-joins`) and gives `the-dwarves-plea`; Low Wick is green
  with plague until the cure, then burns (`low-wick-fires`) and its people come home.
- **Ironpeak**: the Deepforge is the Host's toll fortress (banners, toll-board, garrison) until Grold falls;
  Nyx opens the postern while the hero holds the garrison (`nyx-the-back-door`); Hearthstead's stone is in
  the Sigil of Stone; dwarven banners return; Tova brings dwarf-steel to the camp (`camp-dwarves`).
- **Lantern Hill**: gloom until Orren's vigil relights the great lamp (`orren-the-last-chapel`,
  `the-last-lamp`); Cael in the hostel as "Wat" (`cael-the-hostel`, before the Kings' Mound); after
  Corvane, his banner on the mound and the Ninefold flag on the hill.
- **Stormwatch**: the Light burns after Blackwake.
- **The Crown City**: the treasury, the roads office and Crane's cellar (`city-*`), the Starfall Festival,
  the Night of Knives (defend the Regent in the burning square), Crane's catacomb stair, Champion of Aster
  (`festival-*`); the city locks down after; tents and banners at war (Act IV). Act III opens from the
  Regent's champion. Save v5.

## Rules carried through every phase

Save migrations are versioned and tested; ids are never renamed; raw packs never enter the bundle; every phase runs
typecheck, lint, the Sigilfall tests and the production build before its packet; commits by pathspec, pushed to
`pre-release`.
