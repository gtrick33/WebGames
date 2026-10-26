# Sylvanreach Grove — Top-Down Enchanted Forest RPG Asset Pack v1.0

A top-down 2D RPG kit in a bright hand-painted cartoon style, set in an enchanted elven forest with giant ancient trees, glowing moss, crystal streams and moonlit shrines: a hero who walks, idles and attacks in four directions, three enemies, a boss, 8 ground textures with 7 sets of transition tiles, a repeating wall, 24 props, 4 buildings, pickups and effects.

**Every animation has 8 frames.** Down, up, left and right are all included (left is the mirrored right view). Each character keeps the same pivot (the feet point) in every frame and every animation, so switching direction or action never makes the sprite jump.

**Quick look:** open `Preview/index.html` (double-click). It plays every animation and shows the tiles, walls, props and buildings.

## What's inside

| Folder | What you get |
|---|---|
| `Characters/Lior` | Hero (a young elf ranger boy): idle, walk and attack in 4 directions, hurt, death (14 animations × 8 frames) |
| `Characters/Capshroom` | Walking red-capped mushroom creature: walk and attack in 4 directions, hurt, death (10 animations) |
| `Characters/Thornwasp` | Big golden-striped forest wasp: fly and attack in 4 directions, hurt, death (10 animations) |
| `Characters/Bramblewolf` | Wolf made of twisted thorny vines and dark green leaves: walk and attack in 4 directions, hurt, death (10 animations) |
| `Characters/Hollowstag` | Boss (giant corrupted stag spirit): idle, attack, hurt, death (front view) |
| `Tiles` | 8 ground textures × 4 interchangeable tiles + a seamless 4×4 texture each; 7 × 16 corner transition tiles |
| `Walls` | Wall segments (1 × 2 tiles, any segment fits next to any other), a seamless strip and a corner pillar |
| `Props` | ancient tree, birch tree, mushroom cluster, fern, flowering bush, mossy rock, crystal cluster, tree stump, fallen log, toadstools, blue bellflowers, hanging vines, lantern post, rune pillar, wooden bench, treasure chest, wooden barrel, wooden signpost, bow rack, stone fountain, clay pot, green banner, arbor arch, log bridge |
| `Buildings` | treehouse, elven gazebo, stone shrine, moon well |
| `Items` | Coin, gem and heart (8-frame loops) |
| `Effects` | Hit spark, chest opening, magic poof, dust puff, explosion (8 frames each) |
| `Data/catalog.json` | Every animation with frame size, pivot, timing and loop flag; tile indexes; prop sizes and pivots |
| `Preview` | Browser preview, example map and an animated GIF of every animation |

Everything comes in two sizes:

- `Game/` — 64 px tiles, the hero is about 80 px tall.
- `HD/` — the same art at 2× (128 px tiles).

Animations ship as numbered frames (`<animation>_1.png` … `_8.png`) and as one horizontal sprite sheet (`<animation>_sheet.png`, 8 cells left to right).

## Animations

All frames of one animation share one frame size; the pivot (feet point) is listed per animation in `Data/catalog.json`.

| Character | Animations | Actions — ms per frame |
|---|---|---|
| Lior | 14 | walk 95 loop · idle 130 loop · attack 65 · hurt 70 · death 110 |
| Capshroom | 10 | walk 95 loop · attack 65 · hurt 70 · death 110 |
| Thornwasp | 10 | fly 80 loop · attack 65 · hurt 70 · death 110 |
| Bramblewolf | 10 | walk 95 loop · attack 65 · hurt 70 · death 110 |
| Hollowstag | 4 | idle 130 loop · attack 65 · hurt 70 · death 110 |

Directions are named `_down`, `_up`, `_left`, `_right`. Hurt and death are front views (they read well from any direction). Actions without "loop" play once; death holds its last frame. For attacks, frames 3–5 are the strike: a good moment to enable the hit box.

## Tiles

Each ground texture folder (`Tiles/<size>/<texture>/`) has four tiles `<texture>_1` … `_4`. Every tile fits next to every other tile and next to itself, so you can scatter them at random to avoid repetition. `<texture>_seamless_4x4.png` is the same ground as one 4 × 4 tile texture.

Transition folders (`Tiles/<size>/transitions/forest_floor_to_<texture>/`) hold 16 corner (Wang) tiles that blend forest floor into another ground. The file number is a 4-bit code of the tile's corners:

`number = 8 × top-left + 4 × top-right + 2 × bottom-left + 1 × bottom-right`, where a corner is 1 when it is the other ground and 0 when it is forest floor.

So `00` is all forest floor, `15` is all the other ground, `03` has the other ground along the bottom edge, and so on. Paint your map on the tile corners and pick each tile from its four corners — this is the "corner" or "dual-grid" autotile setup supported by Godot terrains, Tiled (corner sets) and LDtk. Shorelines are drawn into the water transitions.

## Walls, props and buildings

- `Walls/<size>/wall_1` … are 1 tile wide and 2 tiles tall (front face plus top). Place them in a row; any segment fits next to any other. `wall_strip_seamless.png` is one long piece that also repeats sideways. `wall_pillar.png` caps ends and corners.
- Props and buildings are drawn at world scale with the pivot at the bottom centre: sort them by their pivot y for correct overlap with the characters.

## Engines

- **Godot 4:** `AnimatedSprite2D` with SpriteFrames from a sheet (Horizontal 8, Vertical 1); fps = 1000 / ms. Offset the sprite so the pivot sits on the node position. Use a TileSet with 64 px tiles and a corner-based terrain set for the transitions. Enable Y-sort.
- **Unity:** Sprite Mode = Multiple, Grid By Cell Size = frame size, custom pivot from the catalog (x = pivot.x / width, y = 1 − pivot.y / height). Tile Palette for the tiles; Rule Tiles for the transitions. Transparency Sort Mode = Custom Axis (0, 1, 0).
- **GameMaker, Phaser, Construct, RPG engines:** use the sheets or numbered frames with the sizes, pivots and timings in `Data/catalog.json`.
- Smooth painted art (not pixel art): use linear filtering.

## Not included

- Diagonal directions (use the side or front view), running or rolling animations
- Hurt and death from the back or side, boss walk or side views
- Cliffs and height levels, interiors, sound, UI, game code or engine projects

## License (short version)

You can use these assets in personal and commercial games and apps, and edit them as you like. You can't resell or share the assets themselves, on their own or in another asset pack, and you can't use them to train AI models. Full terms are in `LICENSE.txt`.

Made by Certainity (certainity.itch.io). Art generated with AI tools, then cleaned, aligned and packed by hand. No third-party art. If you enjoy the pack, a rating or a screenshot of your game means a lot.
