# Sigilfall — Asset Audit (Blueprint V2.9, Section 3)

Source packs live in `glitchbound/assets/sigilfall/` (never bundled or deployed). `scripts/sigilfall-art.mjs` builds
the runtime atlases into `public/games/sigilfall/art/` (lossless, only what the game draws, about 2 MB in all; a land
loads ~0.5 MB plus the shared spell effects). Every request carries `?v=<ART_VERSION>` (`render/art/artVersion.ts`,
written by the script) and the folder is cached as immutable (`public/_headers`).

Licenses were read from the files that ship with each pack (quoted terms in `CREDITS_AND_LICENSES.md`).

| Pack (local path under `assets/sigilfall/`) | Blueprint role | Grid / view / style | License (local copy) | Status in the game |
| --- | --- | --- | --- | --- |
| `royal_keep_tileset_v1/` (bubbabba) | Architecture authority | 32 px, 3/4 top-down, pixel art, light from the upper left; 514 tiles, 265 props, 18 animated props, 27 characters (48 × 64) | Commercial use, edit/recolour; no redistribution as assets, no AI training, no NFTs; credit optional | **PRODUCTION.** Promoted to the *world* authority too (see VISUAL_BIBLE §1): ground tiles, trees, buildings, props, townsfolk, humanoid foes |
| `royal_keep_seasons_v1/` (bubbabba) | Seasonal variants | Same grid and ids | Same as Royal Keep | **PRODUCTION.** Autumn and winter lands |
| `magic-spells-vfx/` (Willosuna) | Primary spell VFX | 64 px frames, pixel art, 248 animations in 10 elements; "no generative AI" | Commercial use, modify; no redistribution of the files as a pack | **PRODUCTION.** `vfx.png` |
| `magic-circles-vfx-lite/` (Willosuna) | Telegraphs, rune circles | 96 px frames, pixel art; "no generative AI" | Same as Magic Spells | **PRODUCTION.** `circles.png` |
| `Pixel_Castle_Interior_Tileset_v1/` (reodesuxz) | Interior reference / supplement | 16 px pixel art, doubled with nearest-neighbour to the 32 px grid | Commercial use, modify; no redistribution, no AI training | **PRODUCTION after doubling** for indoor floors, walls and props (`interior.png`); passes scale (32 px), edge (hard pixels like Royal Keep) and light (upper left) |
| `Greenvale_Meadows/`, `Gloomvault_Crypt/`, `Mirefen_Bog/`, `Sylvanreach_Grove/`, `Blossom_Shrine/` (Certainity, Top-Down RPG Worlds bundle) | Backup biome library (Level B) | 64 px tiles, painted cartoon with soft gradients; hero ~80 px | Commercial use, edit; no redistribution, no AI training. **Provenance: the painted style reads as AI-assisted; the pack does not state how it was made** | **LEVEL C / NOT SHIPPED.** Fails the normalization gate against the 32 px pixel world: soft painted edges and gradients beside hard-pixel Royal Keep art read as "another pack" at gameplay zoom. Kept for reference (layouts, creature ideas). |
| `craftpix-net-381103-free-simple-summer-top-down-vector-tileset/` (CraftPix) | Not in the blueprint's list (the user's local substitute for "Free Fantasy Medieval Village Buildings") | 256 px vector cartoon, thick dark outlines | CraftPix free license (`license.txt` links https://craftpix.net/file-licenses/) | **NOT SHIPPED.** Vector outline weight and flat shading clash with the pixel grid; reference only |
| `craftpix-net-734372-free-poison-swamp-...` (CraftPix) | Primary swamp candidate | 256 px vector cartoon | CraftPix free license | **NOT SHIPPED** (same reason). Swamps are derived from Royal Keep with murk water, mud and reeds (biomes.ts) |
| `craftpix-net-849532-free-fantasy-guard-magic-towers-...` (CraftPix) | Support architecture | Vector cartoon | CraftPix free license | **NOT SHIPPED** (same reason); Royal Keep towers used instead |
| CraftPix — Free Fantasy RPG Boss Creatures | Prototype bosses | — | — | **BLOCKED: not in the local folder.** Bosses keep their procedural art |
| CraftPix — Free Fantasy Medieval Village Buildings | World vocabulary | — | — | **BLOCKED: not in the local folder** (a different CraftPix pack is there; see above). Royal Keep buildings used |
| Section 6.7 mount candidates (CraftPix farm/hunt animals) | Mount bases | — | — | **Research only, not local.** The first mount is drawn in code in the hero's own paper-doll style (COLLECTION_SYSTEM_DESIGN.md) |

## Escalations for the next phase gate

1. **The source packs are committed to a public GitHub repository** (`82c38567`, pushed to `origin/pre-release`).
   Every license above forbids redistributing the files as assets; shipping them inside the finished game is
   allowed, a public copy of the raw packs is not. Recommended: remove `glitchbound/assets/sigilfall/` from the
   repository (keep it local, `.gitignore` it) and purge it from history (a force-push: the owner's call).
2. The art direction deviates from the blueprint's "CraftPix first": the local CraftPix packs are vector art and the
   game is pixel art. Royal Keep (pixel, 32 px, same grid as the renderer) leads the world instead. Evidence:
   `docs/review/phase-02/` (in-engine screenshots). Needs creative approval.
3. Snow, desert, volcanic and the Dead Kingdom are derived from Royal Keep seasons and grades (no new pack). If
   they fall short after review, the gap goes back to the owner rather than a new purchase.

## What the game draws from where

- **Ground** (`render/tileGround.ts`): Royal Keep grass, 47-piece auto-tiled dark/meadow grass, dirt, cobble, water
  (animated, 4 frames), bridges, rock ledges with cliff faces, castle wall tops and faces, decals. Sand, ash and mud
  are made from the dirt tiles at load (`biomes.ts` → `derived`).
- **Standing things** (`render/artScenery.ts`): trees, bushes, rocks, joined fences, cottages, inns, smithies,
  chapels, keeps and towers, camp and town props, animated campfires, braziers and chimney smoke.
- **People** (`render/art/folk.ts`): every townsperson by role; bandits, skeletons, goblins and dark knights.
- **Spells** (`render/art/vfx.ts`): projectiles, impacts, casts and buffs by element; rune circles for telegraphs.
- **Still procedural** (pixel art in the same palette logic): the paper-doll heroes (their gear shows on them, the
  base of the Wardrobe), beasts and monsters, bosses, waystones, shrines, dungeon mouths, the minimap.
