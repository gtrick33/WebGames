# Sigilfall — Asset Audit (Blueprint V2.9 §3, §3.8, §7)

Source packs: `glitchbound/assets/sigilfall/` (never bundled). Runtime derivatives: `public/games/sigilfall/art/`,
built by `scripts/sigilfall-art.mjs`, requested with `?v=<ART_VERSION>` and cached as immutable. Licenses were read
from the files shipped with each pack; terms are quoted in `CREDITS_AND_LICENSES.md`.

## Since 2026-10-28: one pack (the owner's decision)

The owner, looking at Briarhollow: Royal Keep's crates, stalls and watchtowers stood small and wrong on CraftPix
grass and Greenvale's painted cobbles (stones the size of a hero's head), "those assets look bad together"; "stick
to one type of assets, and use other packs only when necessary". This supersedes the hierarchy below (blueprint
§3.4's CraftPix lead). Royal Keep is the only pack that covers a whole world in one hand (ground and its 47-piece
sets, water, walls, cliffs, trees, plants, rocks, fences, fourteen buildings, a castle, market, camp and town props,
animated torches, banners and water) and has its own autumn and winter repaints, so it draws the whole outdoor
world now:

| Pack | Role now | Ships as |
| --- | --- | --- |
| Royal Keep + Seasons (bubbabba) | **The world's one art language**: every outdoor land, in a season with a grade (`render/art/recipes.ts`); sand, soil, ash and mud are its dirt graded at load | `rk-*` (unchanged build: EPX ×2 to the 64 px grid) |
| Gloomvault Crypt (Certainity) | Only seven story pieces Royal Keep has nothing for: skulls, scattered bones, a stone coffin, an iron cage, a skull banner, a stone altar, crystals | `props-gc` (those seven only) |
| Magic Spells VFX, Magic Circles (Willosuna) | Spell effects and wind-ups, as before | `vfx`, `circles` |
| CraftPix Simple Summer, Poison Swamp, Guard & Magic Towers; Greenvale, Mirefen, Sylvanreach, Blossom Shrine | **No longer shipped** (on disk only) | — |

What it took beyond the recipes: buildings are placed by one table the simulation and the renderer share
(`data/buildingArt.ts`: each picture's size, ground point, footprint and door, measured from the pack), so the
painted walls are the solid ones and a way in is under its painted door; generated roads run straight with
right-angle turns (the meander they used to follow made a staircase of the pack's road edges); the shipped art
went from 5.5 MB to 2.9 MB.

The sections below are the audit as it stood on 2026-10-26, kept for the record.

> **Correction (2026-10-26).** Commit `5ce1737b` made Royal Keep the art for the whole outdoor world. That breaks
> §3.4 (CraftPix is the world's visual authority; Royal Keep is architecture only). This audit replaces it. The
> code from that commit (atlas loader, tile ground, scenery builder, folk, VFX) is reused, but its art assignments
> are re-pointed as below in Phase 2 (EXECUTION_PLAN.md).

## The render-grid decision

The game draws at 2 art px per world px (32 px per tile), a pixel-art grid. The approved style is **smooth vector /
cartoon** ("colorful, smooth, dense", "less-pixelated characters"), which needs more pixels on screen. Phase 2
raises the renderer to **4 art px per world px (64 px per tile)**:

| Pack | Native grid | At 64 px per tile |
| --- | --- | --- |
| Top-Down RPG Worlds bundle (`Game/`) | 64 px tiles | **1 : 1** |
| CraftPix tilesets | 256 px tiles | downscaled ÷ 4 (Lanczos), clean vector edges |
| Royal Keep | 32 px tiles | ×2 with an edge-smoothing scaler (EPX, then a soft resample), outline kept — the vertical slice decides whether it passes §3.3 |
| Magic Spells VFX | 64 px frames | 1 : 1 (a 64 px frame covers one tile; ultimates at ×2) |
| Magic Circles | 96 px frames | 1 : 1 |
| Castle interior | 16 px tiles | ×4 nearest fails the edge check; used as **reference** for interiors (§3.2) unless a smoothed test room passes |

Procedural art (heroes, monsters, bosses) keeps working (it is drawn at world size) and looks as it does now until
Phase 4 re-renders it in the smooth style.

## Pack-by-pack

| Level | Pack (path under `assets/sigilfall/`) | Style found | License | Decision and role |
| --- | --- | --- | --- | --- |
| **A — visual authority** | `craftpix-net-381103-free-simple-summer-top-down-vector-tileset/` | Vector cartoon, flat cel shading with one highlight, a dark brown outline, top-down 3/4, saturated greens and warm sand. 56 ground tiles: a **grass ↔ sand corner-transition set** with rounded multi-tile curves; 32 props (trees, bushes, rocks, stumps, fences, well, windmill, barrel, cart, campfire, tent, banners, flag, chest, house, watch towers, round and square castle, magic stone tower, wooden bridges) | CraftPix free license (https://craftpix.net/file-licenses/) | **APPROVED — core world language.** Defines palette, outline, shading and density for ordinary villages, roads, farms, forest edges and props |
| **A — visual authority** | `craftpix-net-734372-free-poison-swamp-game-tileset-and-environment-pack/` | Same series, artist and layout as Simple Summer (identical 56-tile transition layout, same outline weight); moss greens and toxic lime | CraftPix free license | **APPROVED — swamp/corruption language.** Mirefen, plague and blight dressing: toxic ground, swamp shrubs, mangroves, tree towers, huts, boulders, rafflesia, skeletons, cave entrance, lanterns, planks |
| **A — support architecture** | `craftpix-net-849532-free-fantasy-guard-magic-towers-pack-for-defense-games/` | Vector cartoon, same outline weight, 4 tower types × 4 levels | CraftPix free license | **APPROVED — guard and magic towers** for roads, outposts, sieges (scale-matched against Royal Keep walls in the slice) |
| **A — architecture authority** | `royal_keep_tileset_v1/`, `royal_keep_seasons_v1/` (bubbabba) | 32 px pixel art, upper-left light, 514 tiles, 265 props, 18 animated props, 27 characters, autumn and winter repaints | Commercial use; no redistribution as assets; no AI training; no NFTs | **APPROVED for architecture only**: Emberwick (the Crown City), keeps, castle walls and gatehouses, moats, stone bridges, towers, military yards, market stalls, banners, siege camps; seasonal variants for late-war fortresses. Normalized ×2 smooth (above). **Not** for ordinary ground, trees or villages. Its townsfolk are **Level C** (pixel figures in a smooth world) |
| **B — gap filler** | `Greenvale_Meadows/` (Certainity) | Painted cartoon, 64 px, soft gradients, darker outlines than CraftPix | Commercial use, edit; no redistribution, no AI training. Provenance unstated; the painted rendering reads as **AI-assisted** — flagged | Fills what CraftPix lacks for **Briarhollow and the Vale** (blueprint §7 recipe): cobblestone, pond water, planks, soil rows, meadow grass; the cosy cottage, blacksmith hut and windmill (the CraftPix village-buildings pack is **missing**); lamp post, scarecrow, hay bale, signpost, lily pads, market cart. Normalized: saturation and outline toward CraftPix |
| **B — gap filler** | `Gloomvault_Crypt/` | Painted, 64 px, dark stone | Same as Greenvale; AI-assisted flag | **Primary for crypts and caves** (§7 recipe): floor tiles, flagstones, cave floor, rubble, slime pool, walls; props (coffins, cages, bones, cobwebs, crystals, torches, skull banners); dungeon doorway, stairs, throne, altar. Its boss "The Hollow King" is a **prototype base only** — never the final Hallow King (§3.7) |
| **B — gap filler** | `Mirefen_Bog/` | Painted, 64 px | Same; AI-assisted flag | With CraftPix swamp (§7): mud, swamp water, boardwalks, reeds, mangroves, stilt hut, witch hut, dock |
| **B — gap filler** | `Sylvanreach_Grove/` | Painted, 64 px, teal moss | Same; AI-assisted flag | Enchanted forest (§7): forest floor, teal moss, streams, ancient/birch trees, treehouse, gazebo, rune pillars, moon well |
| **B — gap filler** | `Blossom_Shrine/` | Painted, 64 px, East-Asian shrine vocabulary | Same; AI-assisted flag | Magical sanctuary only (§7), with Magic Circles; its pagoda/torii vocabulary does not fit Aster's villages and stays in sanctuaries |
| **A — VFX** | `magic-spells-vfx/` (Willosuna) | Pixel-origin effects, 64 px frames, 10 elements; "no generative AI" | Commercial use; no redistribution as a pack | **APPROVED** for spell VFX at 1 : 1 on the 64 px grid (pixel origin accepted by §10 if it passes readability) |
| **A — VFX** | `magic-circles-vfx-lite/` (Willosuna) | 96 px rune circles, fire/ice/arcane; "no generative AI" | Same | **APPROVED** for telegraphs and wind-ups |
| **C — reference** | `Pixel_Castle_Interior_Tileset_v1/` (reodesuxz) | 16 px pixel art | Commercial use; no redistribution; no AI training | **Reference** for interior layouts (§3.2); props recreated in the smooth style unless a test room passes |
| — | CraftPix *Free Fantasy Medieval Village Buildings* | — | — | **BLOCKED: not in the local folder.** Village buildings come from Greenvale (Level B) and the CraftPix Simple Summer house until it is supplied |
| — | CraftPix *Free Fantasy RPG Boss Creatures* | — | — | **BLOCKED: not in the local folder.** Bosses keep procedural art; Worlds-bundle bosses are prototype bases |
| — | §6.7 mount candidates (CraftPix animals) | — | — | **Research only, not local.** First mount is drawn in code to the production brief in COLLECTION_SYSTEM_DESIGN.md |

## Composition targets per scene (§3.4)

| Scene type | CraftPix | Royal Keep | Worlds bundle |
| --- | --- | --- | --- |
| Village, farm, road, forest edge | 70–85 % (ground, trees, props) | 0–10 % (a chapel, a stone bridge) | 10–20 % (cottages, cobbles, water) |
| Crown City, keep, fortress, siege | 50–70 % (dressing) | 25–40 % (walls, gates, keep, market) | ≤ 10 % |
| Swamp | 60–75 % (CraftPix swamp) | 0 % | 20–30 % (Mirefen) |
| Crypt, cave | 20–30 % (CraftPix rocks, lanterns, skeletons) | 0–10 % | 60–70 % (Gloomvault, §7 primary) |

## Escalations (next phase gate)

1. **The raw packs are in a public GitHub repository** (`82c38567`, pushed). Every license here forbids
   redistributing the files as assets. Recommended: untrack `glitchbound/assets/sigilfall/` and purge it from
   history (a force-push — the owner's decision). Until then no further raw files are committed.
2. Two listed packs are missing (village buildings, boss creatures).
3. The Worlds bundle's provenance is unstated and reads as AI-assisted; the blueprint allows it as Level B with the
   flag recorded here.
