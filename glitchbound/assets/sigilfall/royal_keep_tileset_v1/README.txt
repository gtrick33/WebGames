ROYAL KEEP - 32x32 TOP-DOWN RPG PIXEL ART TILESET  v1.1
by bubbabba  -  https://bubbabba.itch.io

A castle and everything round it for a top-down RPG, drawn in 3/4 view on a
32 px grid: a walled keep, a market town, a moat and the wild country beyond.

  514 tiles   265 props   18 animated props   27 characters   4 example maps


WHAT IS INSIDE
--------------
tileset/
  royal_keep_tiles.png         the whole tile atlas, 512 x 1696 px, 16 tiles wide.
                               Ground edges are see-through so they lay over any ground.
  royal_keep_tiles_baked.png   the same layout with the ground edges already painted
                               over grass, for engines with one tile layer.
  tiles.txt                    id, column, row and name of every tile in the atlas.
  tiles/                       every tile as its own named PNG.
  terrains/                    each 47-piece ground set as its own 8 x 6 sheet.
  terrains_baked/              the same sheets painted over grass.
props/
  <group>/<name>.png           every prop as its own trimmed PNG.
  props.json                   size, ground origin, footprint and chimney points.
  sheets/<group>.png           each group packed on one sheet (+ sheets.json rects).
animated/
  <name>_strip.png             every animated prop as a left-to-right strip.
  frames/<name>_<n>.png        the same, one file per frame.
  gif/                         previews at 2x.
  frames.txt                   frame counts, sizes and suggested speeds.
characters/
  <who>/<who>_<anim>_<dir>.png one strip per animation and direction (48 x 64 cells).
  sheets/<who>.png             all twelve strips of one character on one sheet.
  royal_keep_characters.png    everyone on one sheet, one character per row.
  characters.txt               the layout of those sheets and suggested speeds.
tiled/
  royal_keep_tiles.tsx         the atlas with a terrain set for every ground, and
                               the water already animated.
  royal_keep_tiles_baked.tsx   the same for the baked atlas.
  royal_keep_props.tsx         every prop and animation as an image collection.
  royal_keep_characters.tsx    the character sheet with idle, walk and attack animations.
  yard.tmx  town.tmx  moat.tmx  wilds.tmx     the four example maps.
godot/
  royal_keep_tiles.tres        a Godot 4 TileSet on the atlas: a terrain for every
                               ground, animated water, the tile name as custom data.
  royal_keep_tiles_baked.tres  the same on the baked atlas.
  royal_keep_animations.tres   SpriteFrames with every animated prop.
  characters/<who>.tres        SpriteFrames for each character (idle_down, walk_left,
                               attack_right ...).
scenes/                        the four example maps as pictures.

Autumn and winter repaints of the tileset and props are a separate download on
the same page (royal_keep_seasons) - same file names, so they drop straight in.


THE GROUND
----------
Plain grass is grass_0 .. grass_15 - scatter them at random.

Eight grounds auto-tile, 47 pieces each:

    dgrass   Dark grass
    lgrass   Meadow grass
    dirt     Dirt path
    cobble   Cobbled yard
    water    Pond water
    moat     Moat water
    ledge    Rock ledge
    wall     Castle wall

A piece is named <ground>_<mask>. The mask says which neighbours are the same
ground, in the order n e s w ne se sw nw (1 = same). <ground>_11111111 is the
middle; dirt_c1..3 and cobble_c1..3 are extra middles to break up big areas.
In Tiled, open the Terrain Sets panel and paint - the masks are already set up.
In Godot 4, use the TileMap's Terrains tab with godot/royal_keep_tiles.tres.

Water and moat tiles have four frames: <tile>, <tile>_f1, <tile>_f2, <tile>_f3,
laid out as four identical blocks in the atlas. 120 ms a frame looks right.

Grounds can overlap: lay dirt, then cobbles, then water on separate layers and
the see-through edges blend each one into whatever is underneath.


WALLS AND CLIFFS, 1 TO 3 TILES TALL
-----------------------------------
A castle wall or a rock ledge is two things:

  the TOP   "wall" or "ledge" from the list above - auto-tiles like any ground.
  the FACE  the tiles that hang below the top's southern edge:
              wall_<row>_<col>   and   cliff_<row>_<col>

  row   t  top row of the face          col   l   left end of a run
        m  middle row (repeat it)             m   middle (also m_2, m_3 variants)
        b  bottom row, meets the ground       r   right end
        tb a face only one tile tall          lr  a run one tile wide

  1 tall:  tb          2 tall:  t           3 tall:  t
                                b                    m
                                                     b

Extras that swap in for a middle tile: wall_m_m_slit, wall_m_m_window,
wall_m_m_crack, wall_m_m_moss, wall_b_m_moss, wall_t_m_crack, cliff_m_m_moss,
and ivy_0..2 to lay on top of any face.

  gate_tl gate_tr gate_bl gate_br   a 2 x 2 arched gateway for the two lowest
                                    rows of a wall face.
  stairs_t / _m / _b                steps up a castle wall face (repeat _m).
  rockstairs_t / _m / _b            steps up a cliff.
  shade_*                           the soft shadow a wall throws on the ground
                                    to its east and south.

The example maps show every case - open them in Tiled and look at the layers.


BRIDGES AND DECALS
------------------
bridge_h_l / _m / _r      a wooden bridge running west-east; put the end pieces
                          on the first and last water tiles.
bridge_v_t / _m / _b      the same running north-south. Two side by side make
                          a wide bridge.
sbridge_*                 the stone version.
decal_*                   pebbles, tufts, cracks, leaves, flowers, moss, straw,
                          worn patches, clover and a puddle - see-through, to
                          scatter over any ground.


FENCES
------
fence_<n> and fence_iron_<n> are 32 x 32 and join themselves. n is the sum of
the sides that connect: 1 north, 2 east, 4 south, 8 west. A straight west-east
piece is 10, a north-south piece is 5, a lone post is 0. fence_gate drops into
a west-east run.


PROPS AND DEPTH
---------------
Sort props, buildings and characters by the ground line of their sprite and
draw from the top of the screen down, so a knight can walk behind a tree.

For most props the ground line is the bottom row of the sprite. Buildings,
towers, tents and stalls carry a drop shadow below their walls, so props.json
gives each one an "origin" - the pixel that sits on the ground at the
south-west corner of its footprint - and a "footprint" (width and depth in
pixels) to block. Houses with a chimney list a "smoke" point for the smoke
animation.

265 props, by group:

    trees        31
    plants       34
    rocks         9
    buildings    14
    castle       27
    market        8
    camp          8
    town         29
    containers   26
    yard          8
    garden       17
    walls        12
    fences       33
    pickups       9


ANIMATED PROPS
--------------
portcullis, fountain, flag_red, flag_blue, banner_red, banner_blue, wall_torch, torch_post, brazier, campfire, candelabra, chest_open, spike_trap, smoke, coin, gem_red, gem_blue, gem_green

Strips run left to right. frames.txt lists the frame count, the frame size
and a suggested speed for each. chest_open and portcullis play once; the rest
loop. Torches, braziers, the campfire and the candelabra are the light
sources in the example pictures - the glow itself is not part of the art, so
add your engine's own light.


CHARACTERS
----------
knight, guard, archer, king, queen, squire, peasant_m, peasant_f, merchant, blacksmith, monk, jester, wizard, captain, ranger, mage, innkeeper, farmer, noble, elder, child, girl, bard, bandit, dark_knight, skeleton, goblin

Every character has idle (4 frames), walk (6 frames) and attack (4 frames) in
four directions: down, up, right and left. Cells are 48 wide and 64 tall with
the feet in the middle, 4 px above the bottom, so one anchor point works for
everyone. The cast is drawn tall and slim, with four skin tones, a range of
ages and builds, and two children.
Suggested speeds: idle 220 ms a frame, walk 110 ms, attack 90 ms (play once).
The attack is a swing of whatever the character holds - sword, axe, staff,
bow, pitchfork or bare hand.


GODOT 4
-------
Copy the whole pack folder into your project and keep the folders together:
the .tres files in godot/ point at the pictures beside them (../tileset,
../animated, ../characters). Set the texture filter to Nearest.

  TileMapLayer    assign godot/royal_keep_tiles.tres (or the baked one) as the
                  Tile Set. Terrains are ready to paint and water animates.
  AnimatedSprite2D  assign godot/characters/<who>.tres and play "walk_down",
                  "attack_right" and so on; attacks do not loop.


HOW IT WAS MADE
---------------
Every tile, prop and character is drawn procedurally by custom Python code on
a strict 32 px grid - no image-generation models. The tooling was built with
help from an AI coding assistant.


LICENSE - see LICENSE.txt


CHANGES
-------
v1.1   taller, more detailed characters and ten new ones (27 in all) with a
       more varied cast; an attack animation for everyone; Godot 4 TileSet and
       SpriteFrames; autumn and winter repaints; richer ground, stone, roofs
       and trees; wall towers that join the walls; softer shadows.
       Character cells are now 48 x 64 (were 48 x 48).
v1.0   first release
