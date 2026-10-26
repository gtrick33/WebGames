# Sigilfall — Visual Bible

The rules every piece of art follows so the kingdom looks made by one team. Tables live in code:
`render/art/biomes.ts` (lands), `render/art/folk.ts` (people), `render/art/vfx.ts` (spells).

## 1. One family: Royal Keep pixel art

- **Grid.** World tiles are 16 world px, drawn at DETAIL 2: **32 art px per tile**, exactly Royal Keep's grid. Art is
  never resampled except by whole numbers with nearest-neighbour (the 16 px castle-interior pieces are doubled).
- **View.** 3/4 top-down: roofs and wall tops seen from above, south faces visible. Light from the **upper left**;
  shadows fall down and to the right in a cool translucent dark (the pack's own `shade_*` and baked prop shadows).
- **Edges.** Hard pixels with a dark, coloured outline (never pure black). Anti-aliased, painted or vector art is
  rejected at gameplay zoom; this is why the painted Worlds-bundle packs and the vector CraftPix packs are not
  shipped (ASSET_AUDIT.md).
- **Why Royal Keep leads the world, not only the castles.** The blueprint makes CraftPix the world authority and Royal
  Keep the architecture authority, assuming a CraftPix village pack that would fit. The CraftPix packs on disk are
  256 px vector art; the game is pixel art. Royal Keep already holds wilds, villages, a market town, a keep, camps and
  seasons on the renderer's own grid, so one family covers both roles. Recorded for creative approval.

## 2. Lands: season + grade + vegetation

A land is a Royal Keep **season** (summer, autumn, winter), a **grade** (saturation, contrast, brightness, hue, tint)
applied to its tiles and props, a **base ground** (grass, snow, sand or ash), **patches** of a second ground, its
**trees, bushes, rocks and flora**, and what its **water** is (clear, murk, toxic, deep, lava). Grades never touch
people: characters stay a readability tier above the world.

| Region family | Season | Identity in one screenshot |
| --- | --- | --- |
| Vale villages (village, farm, plains) | summer | warm green, thatch and tile roofs, orchards, hay, flowers |
| Forests (forest, jungle, fey) | summer | dark grass under dense teal canopies; fey turns hue to mint and coral blossoms |
| Coast | summer | sand patches, mint trees, reeds |
| Marsh, plague, sunken, gloam | summer/autumn | desaturated green-brown, mud patches, murk or toxic water, reeds, dead trees |
| Autumn lands, moor, barrow, rift | autumn | amber and coral trees; moors purple-grey; the Rift hue-shifted violet |
| Highlands, storm coast | summer | cool grey-blue grade, pines, rock ledges with cliff faces |
| Snow, peaks, pale, haunted, deadlake | winter | snow ground, snowy pines; haunted and deadlake darker and bluer |
| Desert, bonefield | summer/autumn | sand base, dirt flats, sandstone rocks, dead trees |
| Warfront, volcanic | autumn | ash patches, dead trees; volcanic water becomes lava |

Indoor places use the castle-interior floors and walls with their own grade (crypt violet, cave earth, cistern
green, keep warm stone, ice blue, temple gold).

## 3. Composition and density

Layer order: base ground → patches → roads and squares → water → cliff and wall tops/faces → decals → standing
things sorted by their ground line → effects → foreground fades (a tree or roof fades when the hero walks behind
it). Woods are a tree on every other tile with more along the clearing, so a forest edge reads as a forest. Flora is
small and flat, thicker along woods and water, **never solid and never in a combat lane**. A cliff's face is drawn on
the cliff's own southern rows, inside its collision, never over walkable ground. A rock spine one tile thick is
boulders, not a cliff.

## 4. Characters

- **Heroes** (seven classes): the paper-doll hero, painted at art resolution, every worn piece visible (the base of
  the Wardrobe). Scale: 34 × 60 art px canvas, feet one row above the bottom, a soft elliptical contact shadow.
  Royal Keep figures (48 × 64 cells, feet at 24, 60) stand at the same height, so doorways, props and people agree.
- **Companions and story figures** have their own figure (`STORY_FOLK`) and portrait, never a recolored villager.
- **Townsfolk** by role: guard, captain, knight, smith, innkeeper, merchant, elder, monk, wizard, ranger, farmer,
  bard, noble, king, queen; anyone else is a commoner picked by id.
- **Foes**: the pack's bandit, skeleton, goblin and dark knight where they truly match; every other foe keeps its
  procedural art. Elites glow gold; bosses are larger and have their own art.

## 5. Spells and danger

- Player effects come from Magic Spells VFX by **element colour**: fire orange, frost/ice pale blue, lightning
  violet-white, arcane magenta, nature green, poison yellow-green, holy gold, shadow purple, water blue, blood red.
- Effects are drawn **at most at their 64 px frame size** (2 tiles) for ordinary skills, larger only for ultimates.
- **Enemy danger is always red and outlined** (telegraph arcs, rings and lanes) and drawn above the ground, below
  player effects' brightest layer, so a player effect can never hide a telegraph. Rune circles from Magic Circles
  mark charging boss abilities.

## 6. Acceptance at gameplay zoom

Before a piece ships: beside Royal Keep pieces in the engine, at phone and desktop zoom, nobody can point at it and
say "that came from another pack". Screenshots go in `docs/review/phase-XX/` (the dev page's `window.__rbShot`).
