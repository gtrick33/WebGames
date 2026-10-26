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
| 1 | Stabilization: joystick/multitouch, camera vs shake, depth sorting, Open Barrow, registry (incl. Duskspire), ultimate spam, quest activation, save migrations, HUD clipping, SIGILFALL_QA.md | camera, Open Barrow, registry, ultimate, activation, migrations **done**. Joystick and depth sorting **not reproduced** (REFACTOR_AUDIT.md). **Open**: SIGILFALL_QA.md, a multitouch regression test, HUD screenshots at phone/tablet sizes |
| 2 | Briarhollow + Prologue + Chapel Crypt + one class with the 4th slot; world states and events; accept step | **done**, with interiors: the Bramble & Barrel, the Chapel of the Bell and the Elder’s Hall (data/interiors.ts), barred on the raid night, furnished by the camp’s progress |
| 3 | Progression rebalance | **done** (`17208eeb`) |
| 4 | Master hero (Mage) re-render + CHARACTER_ART_BIBLE.md, then the other six; portraits | **open** |
| 5 | Spell expansion: the 4th slot, 35 new skills, talent mutations, boss partial CC | **done** (`a409df85`) |
| 6 | Wardrobe (HEAD/CHEST/WEAPON) + one production mount, then the roster | **done**: the Wardrobe, eight mounts with deterministic sources, riding rules, save v8 (COLLECTION_SYSTEM_DESIGN.md §5). Wardrobe-only story looks (not tied to an item) come with Prompt 11 |
| 7 | World art in region batches: landmark, routes, palette identity, credible entrances | **partial** (Briarhollow and Act I dressing); **open** for the other regions |
| 8 | Quest rewrite by act: setup → escalation → complication → climax → aftermath; saved people reappear; side quests contribute | Prologue, Acts I–III and Highwall **done**; audit of every chain's five beats and side-quest payoffs **open**; Acts IV (two gates), V, VI, Finale **open** (Prompt 14) |
| 9 | Companions and cinematic staging: camera focus, move-to, wait, emote, spawn/despawn, gate state, dialogue beat; skippable; debug presets | **done**: barks, arrivals, escorts, companions in events; in-engine scenes (sim/scene.ts: look, say, move, emote, wait; letterbox; skip with Space/Enter/click/tap; seen once, replayed safely after a reload) at five beats (data/scenes.ts); review presets for eleven beats (progress/presets.ts; dev server or `?review`, review heroes send no scores). More scenes come with each act |
| 10 | Siege system: one representative Three Gates siege (intact → under siege → breached/liberated), then the others and the finale | Hearthstead's defense **done**; **open**: Highwall's three states as the representative siege, then the Gloam Gate and the Muster Hall |
| 11 | Loot: less clutter, quest-item protection, rarity visuals, authored story rewards; cosmetic reward sources | **open** (sources for mounts and looks come with Prompt 6) |
| 12 | Crown City districts and interiors; war-state variants; Three Gates fortresses share the kingdom language | war states of the Crown City **done**; interiors **done**: the Ember Hearth, the Great Hall of the Ember Keep (court table → war council after the Night of Knives), Brannoc’s Forge; **open**: the muster-ground variant (with Act IV) |
| 13 | Dungeons: identity, an encounter mechanic, a multi-phase boss each; registry tests | nine shipped dungeons have phased bosses and registry tests; **open**: Blightheart, the Molten Throne, the Spire of the Rift, Duskspire (in the frozen `sigilfall-4b-wip` branch, to be retold) |
| 14 | Dead Kingdom (Act V), Last March (Act VI), Crownfall, Epilogue (rebuilt Briarhollow, the bell), postgame Heroic/Mythic, a prestige mount | **open**; the zones, foes, art and three dungeon patterns of the old Act IV are on `sigilfall-4b-wip` and are reused under the new story |
| 15 | Audio conventions, reduced motion and screen shake, volume, final art review | volume, screen shake and **reduced motion** (no shake, a third of the weather, no canopy shimmer; a first visit takes the device's setting) **done**; **open**: quest stingers, the visual review backlog |
| 16 | Full regression, validate:sigilfall, SIGILFALL_RELEASE_CHECKLIST.md | **open** (last) |

## Order of work

1. **Prompt 6 — the Wardrobe and the mounts** (COLLECTION_SYSTEM_DESIGN.md): appearance ids, unlocks and backfill,
   the Wardrobe tab, save v8; the Briarhollow Chestnut drawn in layers with the rider's own gear, summon/dismount
   (key and touch button), the rules (no dungeons, fights, events), then the roster with its sources.
2. **Prompts 10 and 14 — the rest of the story**: Highwall's siege states; the Gloam Gate (Elyra rescued, Nyx's
   redemption) and the Muster Hall (the Bone Colossus); the Dead Kingdom's frozen villages and Queen Ysane's echoes;
   the Last March where every helped faction arrives; Crownfall in four stages with Elyra's choice; the Epilogue.
   Zones and dungeons from `sigilfall-4b-wip` are retold, registered and given the story layer.
3. **Prompts 1, 2, 9, 11, 12 leftovers**: SIGILFALL_QA.md, interiors (Briarhollow, the Crown City), the
   cinematic beat primitives with skip and the debug presets, loot clutter and quest-item protection.
4. **Prompt 4 and 7 — art**: the master hero and the other six, then the remaining regions.
5. **Prompt 15 and 16**: reduced motion, audio stingers, the visual review, the release checklist.

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

## Rules carried through every phase

Save migrations are versioned and tested; ids are never renamed; raw packs never enter the bundle; every batch runs
typecheck, lint, the Sigilfall tests and the production build before it is committed by pathspec and pushed to
`pre-release`; the project's formatting is hand-kept (never run Prettier over it).
