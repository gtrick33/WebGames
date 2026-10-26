Magic Circles VFX Lite
======================

Free Lite: 3 of the 16 circles of Magic Circles VFX, every view and animation.
The full pack: https://willosuna.itch.io/magic-circles-vfx

WHAT'S INSIDE
  3 magic circles: arcane, fire, ice
  x 2 views (front, ground) x 4 animations = 24 animations per color
  24 animated sprite sheets in total
  6 static images

FOLDERS
  color/<circle>_<view>_<animation>/   sheet + single frames in the circle's own colors
  static/                               one still image of every circle (great for UI and icons)

  Views:      front  = facing the camera (UI, spell cast in front of a character)
              ground = squashed for top-down, isometric or side-view floors
  Animations: appear (draws itself), loop (seamless spin), activate (flash +
              shockwave), vanish (fades out). Chain them: appear > loop > activate > vanish.

  Every frame is 96x96 px, transparent background. manifest.json lists every
  animation with its frame count, suggested frame duration and whether it loops.

USING THEM
  Import with nearest-neighbour filtering (Unity: Filter Mode Point,
  Compression None; Godot: Texture Filter Nearest) and scale by whole numbers.
  Unity:     Sprite Mode Multiple, Slice > Grid By Cell Size 96x96.
  Godot:     AnimatedSprite2D > SpriteFrames > Add frames from sprite sheet,
             Horizontal = frame count, Vertical = 1.
  GameMaker: Import Strip Image, frame count from manifest.json.

HOW IT WAS MADE
  Every frame is computed by code written for this pack. No AI, no traced or
  third-party art.

LICENSE
  Free for commercial use, royalty free, no attribution required. Reselling or
  redistributing the files as an asset pack is not permitted. Full terms in
  LICENSE.txt
