# Sigilfall — Visual Bible

The rules that make the kingdom look authored by one team (blueprint §3.3–3.7, §7). The pack and its roles are in
ASSET_AUDIT.md; the tables that implement this live in `render/art/` (recipes, folk, vfx) and
`data/buildingArt.ts`.

## 1. The look

**A fantasy world, composed like one** (since 2026-10-28). The owner asked for the feel of the great fantasy
worlds (WoW, Elden Ring, the Lord of the Rings; their feel only, nothing of theirs) and was clear that it comes
from **where things stand**, not from light or glow laid over the screen (a screen-wide lighting pass was tried
and removed).

**One art language** (since 2026-10-28). The owner saw boxes, stalls and watchtowers from one pack standing small
and wrong on another pack's ground, painted cobbles the size of a hero's head beside vector grass, and asked for
one pack, with others only where it has nothing. **Royal Keep** (bubbabba) now draws the whole outdoor world: its
grass, meadow and dark-grass patches, dirt roads, cobbled squares, animated water, bridges, castle walls; its trees,
bushes, flowers, rocks, fences; its cottages, houses, inn, smithy, chapel, keep and towers; its carts, stalls,
tents, crates, lamps and banners. Every land is that pack in one of its seasons (summer, autumn, winter) with a
grade of its own (`render/art/recipes.ts`): a swamp is its dark grass and mud with murky water, a desert its dirt
graded to sand, a volcano its dirt graded to ash with the water to lava. Only the few story pieces it has nothing
for come from elsewhere (Gloomvault's skulls, bones, cage, coffin, skull banner, altar and crystals), and the spell
effects are Willosuna's. Nothing else enters without approval.

- **Roads run straight** with right-angle turns, as the pack's own maps lay them (a road stepping across the grid
  tile by tile reads as a staircase); squares are paved rectangles with their corners cut.
- **Buildings stand where they are drawn** (`data/buildingArt.ts`, `sim/map.ts`): the tiles the painted walls and
  roof cover are solid, nothing else on the lot is; the rest of the lot is a yard with a few things in it. A
  building with a way in stands with its painted door over the step, and the step is marked: a warm pool of
  light and two gold chevrons pointing through the door (and back out, indoors). Walking onto it goes through.
- **Indoors is peaceful**: no spells or blows in an inn or a chapel, and the skill bar is put away, so nothing
  covers a room's door.

**Close, not vast** (since 2026-10-28, the second pass). The owner held up two scenes from the pack's own maps (a
castle courtyard and a village, each about 30 × 20 tiles) against ours: "look at how they make you feel, while the
zones in our game feel separated and vast". What makes theirs: houses shoulder to shoulder along streets, a
garden or a barrel at every step, people everywhere, cliffs and walls that frame the scene. So:

- **Villages are built along streets** (`zonegen.ts` town): a square with the waystone, the well, stalls and a
  notice board; streets out of it; houses side by side fronting the main street and the lane behind (a tile of
  garden between neighbors), more beside the side streets; fenced vegetable gardens, an orchard, a pond; lamps
  and planters by the doors. Briarhollow is built at its plan's own size again (it had been spread 35% roomier)
  with more houses on its roads; Emberwick has rows of houses along its avenue and its southern streets and a
  market of stalls.
- **People live there** (`sim/folk.ts`): villagers walk between their doors, the square and the streets, stop, and
  walk on (a third about the square); they stay in at night, while a place burns and while the story fights.
- **The lands are smaller** (`ZONE_SCALE` 0.8 a side) with denser copses, and the open land between the sights is
  dressed with small scenes of its kind (a woodcutter's clearing, a camp, a pen, a field with its scarecrow, a
  shrine, graves, a broken wagon, standing stones, a pond, a ruined wall, a meadow, bones, a war camp, a well) and
  stones and flowers along the roads.
- **Bare lands stand on cliffs**: their rock is the pack's ledge and cliff face, three rows tall, with pines and
  boulders on top, instead of a field of boulders. Long walls carry torches and banners (the Regent's blue in a
  town); short ones are ruins, mossy and cracked.

- **Land grows, it isn't sprinkled**: trees stand in copses with clearings between, bushes as undergrowth along a
  copse's edge, rocks in outcrops, flowers in meadows (`zonegen.ts` scatter; `CityPlan.grove` in towns). Never
  lone trees or rocks dotted evenly over a field.
- **Plants where they would grow** (`worldScenery.ts`): mushrooms, ferns and undergrowth at the foot of woods,
  rocks and water; hay and sunflowers by fences and fields; garden flowers by houses; only grass in the open.
  Woods are drawn off the tile grid, never as a checkerboard.
- **Places that expect trouble are walled in stone**, with a watchtower either side of the gate (Briarhollow's
  north wall; every walled village of the open lands). Squares are dressed like squares: banners, stalls, a
  bench by the well.
- **People**: wanderers' colors, not costume colors: the mage in storm-grey and slate.
- **Interface**: dark iron and leather with antique gold, double gold rules on panels, serif titles (Georgia),
  deep red and blue bars in bronze frames, a gold-ringed portrait and minimap (`Game.css`, "epic chrome").
- **Grid**: 16 world px per tile, drawn at **4 art px per world px (64 px per tile)**.
- **View**: top-down 3/4. Roofs and wall tops from above, south faces visible, doors on the south face.
- **Light**: from the **upper left**. Shadows fall down-right, a soft translucent cool brown-violet
  (`rgba(40, 24, 48, 0.28)`), and every standing thing has a ground-contact shadow.
- **Outline**: the pack's own pixel outline, smoothed with it (EPX, then the canvas's soft scaling) to the 64 px grid.

## 2. Normalization gate (every piece from another pack)

Before a piece from any other pack ships it is placed in the engine beside Royal Keep pieces at gameplay zoom and
compared (screenshots in `docs/review/phase-XX/`). It must match:

| Check | Rule | Tooling |
| --- | --- | --- |
| Scale | a door is ~1.6 world tiles tall, a cottage 3–4 tiles wide, a tree canopy 2–3 tiles, the hero ~1.7 tiles | per-pack scale factors in the art build |
| Palette | greens, stone, wood, water inside the bible palette; saturation within ±10 % of Royal Keep's | per-pack grade (saturation, contrast, tint) at build time |
| Edges | smooth edges; pixel art is smoothed (EPX + soft resample) or rejected | Royal Keep smoothing pass |
| Light | upper-left; matching shadow hue and ground contact | shadow pass for pieces without one |
| Perspective | same 3/4; a piece with a different roof angle is rejected, not hidden | review |
| Readability | doors, enemies, projectiles, pickups and quest marks obvious on a phone | phone screenshot |

If a reviewer can point at a piece and say "that is from another pack", it has not passed.

## 3. Biomes (blueprint §7)

Every land is Royal Keep in a season with a grade (`render/art/recipes.ts`); what makes one land not another is
the season, the grade, the ground it lies on and what grows and stands on it.

| Region | Recipe | Identity in one screenshot |
| --- | --- | --- |
| **Briarhollow and the Vale villages** (Thornvale, Saltmarsh, Amberfield) | summer; grass with meadow patches, dirt roads, orchards (apple and orange trees), thatch and tile cottages, hay, tilled fields with rows of greens | warm grass, timber and thatch homes, fences, flowers, market stalls; **visible repair after rescue** |
| **Emberwick, the Crown City** | summer; the keep between round towers, castle walls with square towers at the gates, gable and tall houses, the inn, the smithy, the chapel, a fountain and stalls in the market, a dirt training yard with racks and butts | a town that is lived in: lamps down the avenues, clipped trees and flowerbeds at the square's corners |
| **Forests** (Whisperwood, Glimmerwood, Vinecoil) | summer, darker; dark-grass floor under big and tall trees and pines; the Glimmerwood in blossom trees, blue and violet flowers, mushrooms | dense layered canopies; the Glimmerwood soft and bright |
| **Autumn** (Brackenridge) | the pack's autumn: amber and coral trees, golden grass | a hillside in its fall colors |
| **Swamps** (Greyfen, Duskfen, the Sunken Reaches, Gloamhollow, Blightwood) | dark grass, mud for sand, murky water, dead and tall trees, reeds, lily pads, moss-roofed cottages; each its own grade (olive, sickly lime, teal, dark green, violet) | still water, reeds and lily pads, twisted trees |
| **Highlands** (Ironpeak, Stormwatch) | summer, cooled grey-blue; boulder fields for woods, pines, dirt patches, stone and slate cottages | ledges, pines, wind |
| **Frozen** (Rimeheld, the high peaks, the Pale Reach) | the pack's winter: snow ground, frosted trees and roofs; pale violet on the Reach | white, blue shadows |
| **Desert** (Sunscorch, Sablewind) | the pack's dirt graded to sand for the ground, sand rocks, dead and amber trees | sand, ruins, camps |
| **Haunted / blighted** (Ashen Barrows, Grimward, the Shattered Vale, Riftscar, the Weeping Woods, Hollowmere) | autumn or winter, desaturated and tinted (grey, violet, cold blue); dead trees, gravestones, broken pillars; crystals in the rift | grey-violet, graves, broken stone |
| **Warfront** (Highwall, the Bonefields) | autumn, smoky; dirt and ash patches, dead trees | smoke, tents, broken walls |
| **Volcanic** (Emberdeep) | autumn, scorched; the dirt graded to ash, the water to lava | black ash, lava, dead trees |
| **Crypts, caves and interiors** | drawn in code (render/ground.ts, art/furniture.ts) | cold stone, torchlight, bones; inns and halls of plank and flagstone |

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
