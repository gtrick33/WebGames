# Sigilfall — Visual Bible

The rules that make the kingdom look authored by one team (blueprint §3.3–3.7, §7). The pack and its roles are in
ASSET_AUDIT.md; the tables that implement this live in `render/art/` (recipes, folk) and
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
  building with a way in stands with its painted door over the step, and the step is marked by light, not by an
  arrow (since 2026-11-10): lamplight falls out of the door onto the step, and from inside daylight comes in at the
  door (`render/effects.ts` wayLights). Walking onto it goes through.
- **Indoors is peaceful**: no spells or blows in an inn or a chapel, and the skill bar is put away, so nothing
  covers a room's door.

**Close, not vast** (since 2026-10-28, the second pass). The owner held up two scenes from the pack's own maps (a
castle courtyard and a village, each about 30 × 20 tiles) against ours: "look at how they make you feel, while the
zones in our game feel separated and vast". What makes theirs: houses shoulder to shoulder along streets, a
garden or a barrel at every step, people everywhere, cliffs and walls that frame the scene. So:

- **Villages are small and full, and no two alike** (`zonegen.ts` town; the owner, holding up the pack's village
  and castle scenes: "the different cities look identical... empty as heck"). A village is about 40 by 26 tiles,
  built to one of four plans, mirrored or not, in its land's own roofs:
  - a **crossroads** (the farm villages, the haunted and grey ones): a small square where the roads cross,
    crowded with stalls, the well, a wagon and goods; three rows of houses on their streets; the inn, the smithy,
    the stable and a tall shop round the square; a chapel with its graveyard walled in iron; a fenced garden with
    its scarecrow, an orchard, a pond with a boat;
  - a **market street** (the harbors, the mining towns, the fens): a long cobbled street with a fountain and the
    well, stalls down one side, houses fronting it and back lanes behind both rows;
  - a **green** (the woods, the oasis, the fey wood): lawns where the roads cross, under old trees round a pond,
    flowerbeds and a statue, a corner of stalls; houses round it;
  - a **walled hold** (the thanes, jarls, lords and archmages): a stone wall with a tower at each corner, the
    keep, a cobbled courtyard with a fountain and stalls, the smithy, the stable, the inn, a training yard with
    dummies and butts, a row of houses by the south wall.
  Every building has its door on a street; tall roofs never stand over one. Briarhollow's square is small and full
  with more cottages on its old grass; Emberwick's market is crowded with stalls, and streets of houses fill its
  lawns. Both keep every place their story stands on.
- **Every heart its own** (`zonegen.ts` HEARTS; the owner: "the center of each zone looks very similar"): what a
  village's square is paved with and gathered round comes from its land. A farm village's well with its bucket; a
  harbor's fish market round a statue of the sea's lady; a fen's healer's cauldron with her pots; a hold's forge
  brazier with its anvil and rack; a snow hold's bonfire with benches round it; a desert town's oasis pool, with
  pavilions for stalls, on sand; the barrows' and haunted lands' shrine of candles; a war camp's banner between
  its racks, on beaten earth; the fey green's flower ring on grass; the jungle's totem stone between torches; the
  rift's crystals.
- **Nothing stands without a reason** (the owner: "randomly placed... serve no real purpose"): stalls stand in a
  row with their goods set against their side and a walkway between; each building has what belongs to it by
  its front: flowers under a house's window and its firewood or water barrel at its corner, the inn's barrels and
  a bench, the smithy's firewood and weapon rack, the stable's hay and trough, the shop's crates and sacks, the
  chapel's planters, the keep's flags; lamps go down the streets one every six tiles, benches face the well or
  the fire, the notice board stands where a road comes in, stores are stacked against a hold's wall. The people
  stand at their work: the smith at the smithy, the brewer at the inn, the trader behind a stall, the priest at
  the chapel, the lord at the keep. Props with walls (stalls, wells, towers, tents) stand centered on their tile
  (the pack's origin for them is their south-west corner).
- **People live there** (`sim/folk.ts`): villagers walk between their doors, the square and the streets, stop, and
  walk on (a third about the square); they stay in at night, while a place burns and while the story fights.
- **The lands are smaller** (`ZONE_SCALE` 0.8 a side) with denser copses, and the open land between the sights is
  dressed with small scenes of its kind, one to every 120 open tiles (a farmstead, an orchard, a woodcutter's
  clearing, a hunters' camp, a pen, a field with its scarecrow, a quarry, a lookout post, a shrine, graves, a
  cairn, a witch's circle, a broken wagon, standing stones, a pond, a ruined wall, a meadow, bones, an old
  battlefield, a war camp, a well) and stones and flowers along the roads. The open ground is never bare: tufts
  everywhere and thick meadows where they grow, and each bare land strews its own (bones in the Bonefields,
  scrub and sand rocks in the deserts, old gravestones in the barrows, crystals in the rift).
- **Bare lands stand on cliffs**: their rock is the pack's ledge and cliff face, three rows tall, with pines and
  boulders on top, instead of a field of boulders. Long walls carry torches and banners (the Regent's blue in a
  town); short ones are ruins, mossy and cracked.

**Lands that frighten** (since 2026-10-28, the third pass). The owner asked for lands that are scary, each with
its own music and feeling, as diverse as they can be: swamps, and a dark, lamp-lit haunted wood among them. The
bright lands stay bright; the fens, the haunted wood, the barrows, the dead lake, the blight and the moors are
given their own dread (`THEMES` `dread`, data/themes.ts):

- **An evening that never lifts there**: the land under a dark of its own color (blue night in the Weeping Woods,
  sick green in Duskfen, violet in the Blightwood), drawn with the crypt's light, so lamps, torches, campfires and
  the waystone light pools in it. Only these lands; the rest are drawn as they stand.
- **Lamps along the roads**, so a traveller walks from one pool of light to the next; **graveyards** walled in
  wrought iron with a lamp at the gate; **mist** lying over still water and in the hollows, pale over the dark,
  drifting (still with reduced motion).
- **Their own palettes**: the haunted wood is black pines and dead oaks on dark grass (not snow); a fen is dead
  trees and yellowed scrub over murky water; the plague fen's water is poison green; the moor is purple heather
  round peat-dark pools.
- **Their own sound** (below): a drone, a choir, a wavering flute or a music box, and owls, wolves, crows, frogs or
  dripping water out in the dark.

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
| **Swamps** (Greyfen, Duskfen, the Sunken Reaches, Gloamhollow, Blightwood) | dark grass, mud for sand, murky water, dead trees, pines and yellowed scrub, reeds, lily pads; each its own grade and dusk (olive, sick green, teal, black-green, violet); mist on the water | still water, reeds, dead trees in the mist |
| **Highlands** (Ironpeak, Stormwatch) | summer, cooled grey-blue; boulder fields for woods, pines, dirt patches, stone and slate cottages | ledges, pines, wind |
| **Frozen** (Rimeheld, the high peaks, the Pale Reach) | the pack's winter: snow ground, frosted trees and roofs; pale violet on the Reach | white, blue shadows |
| **Desert** (Sunscorch, Sablewind) | the pack's dirt graded to sand for the ground, sand rocks, dead and amber trees | sand, ruins, camps |
| **The haunted wood** (the Weeping Woods) | summer under a blue night: black pines and dead oaks on dark grass, lamps along the road, graveyards in iron, mist | a lamp-lit road through a black wood |
| **Haunted / blighted** (Ashen Barrows, Grimward, the Shattered Vale, Riftscar, Hollowmere) | autumn or winter, desaturated and tinted (grey, violet, cold blue), most under a dusk of their own; dead trees, graveyards, broken pillars; crystals in the rift | grey-violet, graves, broken stone, mist |
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
(Settings, saved).

**A song for every land** (audio/songs.ts, played by audio/score.ts): each land has its own tune, key, meter and
band. Briarhollow is a waltz on a soft flute with birds in the hedges; Emberwick a march; Brackenridge and the inns
a jig; the steppes a gallop; the deserts an oud over a drone and hand drums; the Glimmerwood a bell over a harp in
the lydian; the highlands a horn echoing off the rock; the Chapel of the Bell a hymn under a choir. The frightening
lands are slow and breathe over a drone: a music box waltzing in the Weeping Woods with owls and wolves, a wavering
flute over frogs and dripping water in the fens, a funeral drum and a knell in the barrows, a heartbeat in the
Bonefields and the Blightwood. Dungeons with a character of their own have their own too (the frozen vault, the
molten throne, the root-heart, the sun king's tomb, the dwarven forge), and a raid or a burning night plays the
siege. Songs are balanced to one loudness (measured offline), and a new land's song fades in as the last one fades
out.

The same moment always sounds the same way:

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

## The world's rules (2026-11-04, the low-poly world)

The owner's brief after the 3D rebuild: "make the whole world feel real as one, no random objects, everything has its
place". What the great RPGs do, adapted (rules only, none of their names or art):

- **One scale, measured against the hero** (World of Warcraft's oversized, readable look). A hero is 36 world pixels tall.
  `PROPS` in `render3d/land.ts` is the chart, in world pixels: a crate to the knee (16), a barrel to the hip (20), a lamp
  over the head (46), a house four heads tall, a tower over everything (158), a landmark seen from a screen away (170-250).
  Nothing is sized in tiles. A tile is rules, not looks.
- **One palette.** `harmonize` in `land.ts` brings every pack's timber to one oak and takes the shout out of anything
  candy-bright; a land's leaves and ground lean to its own color. "Stylized doesn't mean saturated everywhere."
- **Strong silhouettes tell you what a thing is:** a building is its own model at its own shape (no stretching past a
  quarter), a tower is a tower. A stone hero stands on a plinth in the squares.
- **Plan first, then dress** (the Warcraft III map-makers' rule: sketch the layout, then pathing, then doodads, and don't
  overcrowd). A town has a plan (`zonegen.ts`, `TOWN_SCALE`): roads, a square with its heart, market stalls, trades on
  their streets. Things stand beside what they belong to: an anvil by the smithy, barrels by the inn, never loose.
- **People stand where they work:** at their trade's door or stall, or their own house's door, nobody crowding the
  waymarker. Only people with a reason to be there (a quest, a shop, a scene) stand in the world.
- **Every land is known by something** (`LANDMARKS` in `zonegen.ts`): a great oak, a lighthouse, a giant's skull: places to
  walk toward, history told by ruins.
- **Dungeons are tight and each its own** (the Diablo games): rooms a little too small for what is in them, short
  passages between, every wall dressed for what the place is (`data/dungeongen.ts`: a crypt's sarcophagi, a forge's coal
  and anvils). Each has its own tileset color and its own color of fire, and its mood is in its lights, placed round
  the room. A boss's chamber keeps its size.
- **A mood never hides the game.** Night and dark are a tint and a dim edge; everything on screen can be seen.

## Towns: no two alike (2026-11-04)

The owner: "most of the towns look the same, streets, houses and misc items ... the whole vibe of towns need to change."
The buildings and goods are the same models everywhere, and they stay: what differs is everything else. `data/townforms.ts`
holds the forms: its layout, what it's paved with, what lights it, what stands at its doors, what its market sells from.

- **mill** (Thornvale): a brook through it, a mill on the bank, fenced fields to the back doors.
- **ring** (Brackenridge): a round village under one old tree.
- **harbor** (Saltmarsh, Stormwatch, Hollowmere): a stone quay and piers, houses packed down paved lanes.
- **boardwalk** (Greyfen, Gloamhollow): no ground, houses on hummocks, boardwalks; Lastlight is one long causeway.
- **crooked** (Ashen Barrows, Duskfen, Weeping Woods): a wandering lane, big graveyards, candles.
- **terraces** (Ironpeak): stepped streets, retaining walls, stairs, the hall at the top.
- **oasis** (Sunscorch): a wide pool under palms, sand for streets, pavilions.
- **glade** (Glimmerwood, Vinecoil, Blightwood, Shattered Vale): nothing in rows, the land's own wood between the houses.
- **hold** (Rimeheld, Grimward): a ring of wall, one great hall, a fire before it.
- **ranks** (Highwall, Bonefields, Pale Reach): a war camp: palisade, muster ground, tents in straight lines.
- **citadel** (Emberdeep, Riftscar): a keep behind a moat, one bridge.
- **canyon** (Sablewind): one street between walls of rock.
- **drowned** (Sunken Reaches): a city's streets gone under, plank walks along them.

Before adding a town, check it side by side with the others from above. A new town gets a new form, or a form no more than
three others use. A form never needs new art.

## Great things: few, and named by the story (2026-11-04)

`data/greatworks.ts`. The owner: "they could be present only in meaningful to the story zones, not literally everywhere, ...
not adding giants everywhere", and "we don't need to see them fully on the screen to get immersed". So:

- A great work stands only where the land's own line names it: "the great lighthouse", "a necropolis on an island", "the
  Gloam Gate", "the dead stand in ranks and Duskspire rises in the north". Most lands have none; a normal land's wonder is its
  town. Giant figures are rarer still (the Titan, the frozen giant, the Sun King, the first thanes). Nothing ordinary gets
  scaled up for effect: catapults stay catapult-sized.
- The camera doesn't pull back for them. You walk past a shin the size of a house and look up.
- Dungeons get their grandeur from architecture: naves of tall columns, walls and pillars that go up into the dark, pools of
  what the place runs with (a theme's water: filth, rot, lava, ice), a carpet to the boss, and what stands behind the boss's
  wall (`backdrop`). A boss's chamber stays walkable: its fight is measured to the room.

## Spells, shots and flames

Everything that glows, flows or burns is a quad with a shader (`render3d/fx3d.ts`), one draw call for all of them, and
`render/effects.ts` says what each thing in the rules looks like. There are no effect sheets any more. The rules:

- **It stands in the world.** Quads are depth-tested against what stands: a wall hides what's behind it, and what lies on
  the ground lies under people's feet. What faces the camera is drawn a little toward it, so a spell on someone shows in
  front of them; a thrown skull's glow is `behind`, so the skull shows in front of its glow.
- **Each stuff looks like itself.** Water wobbles, with foam and a glint; fire licks upward from its color to a white
  heart; shadow is a hole in the light with a lit rim; ice is a faceted crystal; poison is slime that won't stay together.
  A foe's shot takes its stuff from its data's color (`dyeOf`), so a new foe's color needs no new code.
- **What can be a model is a model.** Arrows, spears, skulls, stones, thrown shields and hammers are the packs' own, in flight.
- **Danger is always readable.** Every foe's shot has a red ring on the ground under it, where it really is: shots fly at
  chest height, and that ring is what you dodge. Warnings fill up as the blow comes. A hostile field has a red rim.
- **A wall of water is one wave.** The shots of a `tide` are drawn back to front with their noise carried across them.
- **Names, bars and numbers stay on the 2D canvas.** They're for reading, not for looking at.
