Magic Spells VFX v2.0
=====================

248 pixel art spell effect animations, 64x64 per frame, transparent background.
Made to pair with Magic Spells SFX: the 30 core effects have the same names as its sounds.

WHAT'S INSIDE
  30 core spells (root folders, same paths as v1, so your project keeps working)
   19 fire variants in elements/fire/
   18 ice variants in elements/ice/
   19 lightning variants in elements/lightning/
   16 arcane variants in elements/arcane/
   20 nature variants in elements/nature/
   20 poison variants in elements/poison/
   18 holy variants in elements/holy/
   19 shadow variants in elements/shadow/
   20 water variants in elements/water/
   19 blood variants in elements/blood/
  30 white versions of every core spell in white/ to tint to any color in your engine

ELEMENTS
  Every general effect (charge, cast, bolt, impact, fizzle, explosion, shatter,
  strike, enchant, rune, dispel, buff, debuff, shield up, shield break,
  teleport, portal, summon, spell ready, arcane blast) now comes in 10
  elements: fire, ice, lightning, arcane, nature, poison, holy, shadow, water
  and blood.

EACH EFFECT FOLDER
  <name>_sheet.png      horizontal sprite sheet, 64x64 frames, left to right
  frames/<name>_NN.png  the same frames as single PNG files

  manifest.json lists every animation with its frame count, suggested frame
  duration in milliseconds and whether it loops.

USING THEM
  Pixel art: import with nearest-neighbour filtering (Unity: Filter Mode
  Point, Compression None; Godot: Texture Filter Nearest) and scale by whole
  numbers (2x, 3x, 4x) so the pixels stay crisp.
  Tinting the white versions: Unity SpriteRenderer Color, Godot Modulate,
  GameMaker image_blend.

HOW IT WAS MADE
  Every frame is computed by code written for this pack. No AI, no traced or
  third-party art.

LICENSE
  Free for commercial use, royalty free, no attribution required. Reselling or
  redistributing the files as an asset pack is not permitted. Full terms in
  LICENSE.txt
