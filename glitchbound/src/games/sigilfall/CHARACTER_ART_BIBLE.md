# Sigilfall — Character Art Bible (blueprint §3.7, Prompt 4)

The standard every playable hero, paper-doll person and mount follows at gameplay zoom. It is data-driven: one
painter (`render/art/hero.ts`) draws every class from a `HeroLook`, and the numbers below are what the code uses.

## The master hero: the Mage

The Mage is the reference: a violet robe (`#6b4bd6`) with a gold accent (`#ffcf5a`), a pointed wizard hat, and a
staff whose orb takes the weapon's color. Identifiable by silhouette alone: the hat's point and the staff. The
other six share the same body, scale and pipeline and differ by class colors, bare look and weapon art:

| Class | Main | Accent | Silhouette marks |
| --- | --- | --- | --- |
| Mage | `#6b4bd6` | `#ffcf5a` | wizard hat, staff orb |
| Warrior | `#c9473b` | `#d8dce6` | plate chest, shield, sword/axe/hammer |
| Ranger | `#3f8f5a` | `#c9a35a` | quiver on the back, bow |
| Priest | `#e8e0c8` | `#ffd84d` | pale robe, staff or mace |
| Paladin | `#e8b84a` | `#fff2b0` | gold plate, shield, hammer/sword |
| Warlock | `#7a3ab0` | `#8bff6a` | dark robe, green-fire staff |
| Druid | `#d07a2a` | `#7bd65a` | long hair, leaf-brown robe, gnarled staff; cat and bear forms replace the doll |

Accents are controlled: trim on rare pieces, gold on epic, gold and a glowing gem on legendary, a cape with epic
and legendary chests. Never full-body neon; class color reads from the chest and the weapon.

## Scale and anchors

| What | Value |
| --- | --- |
| World tile | 16 world px |
| Art density | 4 art px per world px (the world's `RES`), the same as the CraftPix/Royal Keep scenery |
| Hero picture | 34 × 60 px painted at 2 art px per world px, smoothed to 4 (`heroSprite`, `HERO_K = 4`): 17 × 30 world px, about 1.9 tiles tall, so a door (one tile wide, Royal Keep scale) fits a person |
| Ground point | the feet stand at the hero's y + 6.5 world px; the picture is centered on x |
| Collider | a circle of radius 5 world px at the hero's position (never changes, mounted or not) |
| Rider seat | the hero picture's row 44 (`RIDER_HIP`) sits on the mount's seat point; see COLLECTION_SYSTEM_DESIGN.md |
| Weapon socket | the hand offset by facing (`REST_POSE` in render/renderer.ts) at rest; along the aim while acting; 3 world px above the ground point |
| Cast origin | the hero's position, 3–4 world px up (projectiles, beams, the ultimate's ring) |
| Portrait | the bust (rows 9–44 of the 2× paint) for the HUD, the hero panel, dialogue |

## Edge, light and palette

- **Edge**: painted without an outline, doubled with Scale2x (EPX) so curves and diagonals come out smooth, then
  outlined with one fine pixel of `#1b1428` at the world's density, the same line the scenery props get.
- **Light**: from the top left; each surface is a five-step ramp, lit left, shaded right; metals have a brighter
  top and deeper shadow; cloth and leather have their own texture.
- **Palette**: armor dyes come from each material's list (progress/items.ts `DYES`), so generated gear sits in
  the world's palette.

## Animation states (all read the same `HeroLook`, so gear and Wardrobe looks show in every one)

| State | How |
| --- | --- |
| Idle | standing frame, a half-pixel breath |
| Locomotion | two walking frames per view (down, up, side; left is side mirrored) at 7 per second of travel |
| Primary attack | the weapon sweeps its arc (swing, heavy, spin); casts and shots point the weapon along the aim |
| Special / cast | a channel's motes, a wind-up's slowdown, the skill's effect from render/effects.ts |
| Hurt | a white silhouette flash (0.18 s) |
| Dodge | blinking while invulnerable |
| Death / knockout | the standing frame tips over and fades |
| Ultimate | the class's ultimate VFX and screen effects; the doll keeps its pose |
| Mounted | the doll cut at the hips between the mount's layers (render/renderer.ts `drawRider`) |

## VFX against the sprite

Player effects use their school's colors, drawn by the shaders in render3d/fx3d.ts; enemy telegraphs use the
danger reds and oranges (render/renderer.ts `drawTelegraph`) so they are never mistaken for the hero's. Effects
are drawn after the figures but never cover the hero for more than their impact frames.

## What is still to come

The smoothing pass gives every class the world's line weight and density from the existing painter. A full
native 4× redraw (hand-placed detail at the doubled size: faces, folds, hair strands) would need new production
art; the brief: same 17 × 30 world-px body, same anchors above, three views plus mirrored side, idle 2 + walk 4
frames, separate head / chest / legs / hands / feet / weapon layers so the Wardrobe keeps working.

Evidence: `docs/review/phase-04/` (the hero smoothed, on foot and mounted, in three facings).
