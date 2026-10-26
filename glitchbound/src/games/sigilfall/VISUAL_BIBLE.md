# Sigilfall — Visual Bible

The rules that make the kingdom look authored by one team (blueprint §3.3–3.7, §7). The hierarchy and the pack
roles are in ASSET_AUDIT.md; the tables that implement this live in `render/art/` (biomes, folk, vfx).

## 1. The look

**Colorful, smooth, dense fantasy** led by the approved CraftPix packs: flat cel-shaded vector shapes with one soft
highlight, a warm dark-brown outline (never pure black), saturated but not neon greens, warm sand and wood, slate
and stone a little desaturated so people and danger read on top. Royal Keep supplies the kingdom's **architecture**;
the Worlds bundle fills gaps after normalization; nothing else enters without approval.

- **Grid**: 16 world px per tile, drawn at **4 art px per world px (64 px per tile)**.
- **View**: top-down 3/4. Roofs and wall tops from above, south faces visible, doors on the south face.
- **Light**: from the **upper left**. Shadows fall down-right, a soft translucent cool brown-violet
  (`rgba(40, 24, 48, 0.28)`), and every standing thing has a ground-contact shadow.
- **Outline**: CraftPix weight (about 2 px at 64 px per tile) in a dark tone of the object's own color.

## 2. Normalization gate (every non-CraftPix piece)

Before a Level B or Royal Keep piece ships it is placed in the engine beside CraftPix pieces at gameplay zoom and
compared (screenshots in `docs/review/phase-XX/`). It must match:

| Check | Rule | Tooling |
| --- | --- | --- |
| Scale | a door is ~1.6 world tiles tall, a cottage 3–4 tiles wide, a tree canopy 2–3 tiles, the hero ~1.7 tiles | per-pack scale factors in the art build |
| Palette | greens, stone, wood, water inside the bible palette; saturation within ±10 % of CraftPix | per-pack grade (saturation, contrast, tint) at build time |
| Edges | smooth edges; pixel art is smoothed (EPX + soft resample) or rejected | Royal Keep smoothing pass |
| Light | upper-left; matching shadow hue and ground contact | shadow pass for pieces without one |
| Perspective | same 3/4; a piece with a different roof angle is rejected, not hidden | review |
| Readability | doors, enemies, projectiles, pickups and quest marks obvious on a phone | phone screenshot |

If a reviewer can point at a piece and say "that is from another pack", it has not passed.

## 3. Biomes (blueprint §7)

| Region | Recipe | Identity in one screenshot |
| --- | --- | --- |
| **Briarhollow and the Vale villages** (Brackenridge, Thornvale, Greyfen edges, Saltmarsh, Amberfield) | CraftPix Simple Summer ground and props + Greenvale cottages, cobbles, water, farm props | warm grass, timber and thatch homes, orchards, fences, flowers, market stalls; **visible repair after rescue** |
| **Emberwick, the Crown City, and allied keeps** | Royal Keep walls, gatehouse, keep, towers, moat, market + CraftPix dressing | concentric layers: refugee approach → market town → moat and gatehouse → districts → inner wall → keep; banners in the Regent's blue and gold |
| **Forests** (Whisperwood, Glimmerwood = Sylvanreach recipe) | CraftPix trees and bushes; Sylvanreach floor, moss, ancient trees for the enchanted wood | dense layered canopies; the Glimmerwood teal, glowing, misty |
| **Swamps** (Greyfen, Duskfen, Mirefen recipe) | CraftPix Poison Swamp ground and dressing + Mirefen water, boardwalks, stilt huts | lime-toxic water, twisted trees, mushrooms, reeds, fog; Duskfen sickly yellow-green |
| **Crypts and caves** (Chapel Crypt, Barrow of Kings, Gallows Keep, Smugglers' Grotto) | Gloomvault floors, walls, props (primary) + CraftPix rocks, lanterns, skeletons | cold stone, torchlight pools, bones, cobwebs; the Barrow gold-and-grey, the grotto wet and blue |
| **Highlands** (Ironpeak, Stormwatch) | CraftPix rocks and pines, Royal Keep cliff faces smoothed, grey-blue grade | ledges, pines, wind |
| **Frozen** (Rimeheld) | CraftPix summer derived: snow grade on ground, frosted trees, ice decals, Royal Keep winter fortress pieces | white, blue shadows, snow particles |
| **Desert** (Sunscorch, Sablewind) | CraftPix sand ground as the base, sandstone grade on rocks, dry vegetation | sand dunes, ruins, camps, dust |
| **Haunted / blighted** (Ashen Barrows, Grimward, the Shattered Vale) | primary language with grieflight overlays (violet), dead trees, mist | grey-violet, lanterns, gibbets, crystals |
| **Warfront** (Highwall) | Royal Keep fortress in damaged/besieged states + CraftPix camp props, ash patches | smoke, tents, siege engines, broken walls |
| **Sanctuary** (future) | Blossom Shrine + Magic Circles | bright, petals, rune circles |
| **Dead Kingdom** (future) | Royal Keep skeleton, recolored black and ash; Gloomvault; CraftPix dark props; bespoke Hallow King art | monumental, ashen, frozen moments |

Snow, desert and volcanic lands are **derived from the primary language** (grades, decals, particles) before any
backup piece is used.

## 4. World states

Places change with the story (STORY_BIBLE.md §4): a state swaps props (burned roof / scaffolding / repaired roof),
adds or removes people and decals (rubble, banners, blood-free scorch marks), and changes ambient effects (smoke,
embers, fireflies). Occupation always reads at a glance: enemy banners, barricades, braziers, patrols.

## 5. Characters (§3.7)

| Tier | Treatment |
| --- | --- |
| **Playable heroes** (7) | Our paper-doll designs kept (every worn piece shows), re-rendered smooth at 64 px per tile: stronger silhouette, class accents on trim/cloak/weapon, soft elliptical contact shadow. Height ~1.7 tiles. **Master hero first: the Mage** (the most iconic silhouette: hat, staff, robe), approved before the other six |
| **Hallow King, lieutenants** | Bespoke, larger, own ambient VFX |
| **Companions** (Mara, Elyra, Cael, Nyx, Orren) | Own figures and portraits; never shared with townsfolk |
| **Townsfolk** | Modular paper-doll variants in the same smooth treatment (clothing, hair, props by role) |
| **Foes** | Families with readable silhouettes; Worlds-bundle creatures as Level B bases where they match (slimes, boars, goblins, skeletons, bats, spiders, wasps, frogs, wolves), procedural art meanwhile |

No hero, companion or Hallow King is an untouched store sprite.

## 6. Spells and danger

- Player effects by element color: fire orange, frost pale blue, lightning violet-white, arcane magenta, nature
  green, poison lime, holy gold, shadow purple.
- Enemy danger is **always red-rimmed** (arcs, rings, lanes) and drawn so player effects never cover it.
- Ordinary skills at one 64 px frame (one tile); ultimates and boss mechanics at ×2; rune circles for wind-ups.

## 7. Review

Every visual phase saves desktop, phone and tablet screenshots in `docs/review/phase-XX/` (the dev page's
`window.__rbShot`), plus a before/after where a baseline exists.

## Feedback conventions: sound and effects (blueprint Prompt 15)

Every sound is synthesized (audio/sound.ts), on one bus per kind, under the master, music and effects volumes
(Settings, saved). The same moment always sounds the same way:

| Moment | Sound | Effect on screen |
| --- | --- | --- |
| A hero's hit, crit | `hit`, `crit` (a sharper top) | white numbers (gold for crits), hit-stop on heavy blows |
| A hero's spell | its school's voice (`bolt`, `fireball`, `freeze`, `zap`, `holy`, `shadow`, `nature`) | the class's colors, Magic Spells VFX |
| An enemy winding up | `enemyWindup` | a red/orange telegraph on the ground, always the danger colors |
| A boss's big attack | `roar`, `slam`, `beamCharge` | a larger telegraph, a screen shake (off with reduced motion) |
| Loot | `pickup`; `epic`, `legendary` for those rarities | a beam in the rarity's color |
| A quest offered / finished | `quest` / `questDone` | a toast; the "!" over the giver |
| A story fight begins | `roar` (an arrival: `quest`) | a banner with the quest's name |
| A scene begins | `scene` | letterbox bars |
| Level up, talent | `levelup`, `talent` | the level-up card |
| A bell (the Epilogue) | `bell` | — |
| Riding | `whistle` (calling), `mount`, `dismount` | the mount fading in; dust where the hero gets down |

Reduced motion (Settings) turns off screen shake and canopy shimmer and thins the weather to a third.
