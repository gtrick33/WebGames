# Sigilfall — Collection System Design: Wardrobe and Mounts (Blueprint V2.9 §6)

## 1. The equipment visual pipeline today (audited)

Gameplay and looks are already separate stages; the Wardrobe slots in between them.

1. **Items** (`progress/items.ts`, `data/items.ts`): every item has a `base` (hand-made id or a generated base), a
   rarity, an item level and stats. `itemIcon(item)`, `itemMat(item)` and `itemTint(item)` say what it looks like:
   icon (`hood`, `helm`, `crown`, `robe`, `plate`, `sword`, `axe`, `staff`…), material (cloth, leather, mail, plate,
   gold) and color.
2. **Look** (`render/sprites.ts` → `heroLook(cls, equip)`): turns what is worn into a `HeroLook` — a `Piece`
   (style, material, tint, rarity) for head, chest, legs, hands and feet, plus the quiver and an epic/legendary cape;
   empty slots fall back to the class's bare look (`BARE[cls]`).
3. **Weapon** (`heldWeapon(cls, weapon)`): the weapon art kind (staff, bow, sword, axe, hammer) and tint, by class.
4. **Paint** (`render/art/hero.ts` → `paintHero(look, view, frame)`): the paper doll at art resolution, three views
   (down, up, side) and walking frames; cached by the look (`heroSprite`).
5. **Use**: `Renderer.setHeroWeapon(cls, world)` picks up look and weapon on every gear change; the renderer draws
   them for idle, walk, swing, cast, dodge, hurt flash and death; portraits (`heroPortraitUrl`) and the hero panel
   doll (`heroDollUrl`) use the same look. Druid forms replace the doll entirely (no gear shown, by design).

Every animation reads the same `HeroLook`, so an override applied at step 2 shows everywhere at once.

## 2. The Wardrobe

User-facing name **Wardrobe** (never "transmog"). Launch slots: **HEAD, CHEST, WEAPON**.

### Data

```ts
interface Wardrobe {
  /** Appearance ids the hero owns (permanent). */
  owned: string[];
  /** Overrides by visible slot; absent = show the equipped item. */
  worn: { head?: string; chest?: string; weapon?: string };
}
```

- **Appearance id**: the item's `base` for hand-made items (`saltbeard-tricorn`), and a style key for generated gear
  (`gen:head:helm:plate:#9aa3b8`) so the look of a generated piece can be kept too. Stable: derived from data that
  never changes for an item.
- **Definition** (derived, not stored): slot, source item, class compatibility (the classes that can wear the
  source), weapon family (staff, bow, sword, axe, hammer) for weapons, rarity, source text.
- **Effective visual**: `effectiveVisual(slot) = owned and compatible override, else equipped item's visual`.
  Implemented by passing a "visual equip" (equip with overridden slots replaced by the appearance's source item) to
  `heroLook` and `heldWeapon`. **Stats always come from the real equip** — the build resolver never sees the
  Wardrobe.
- **Weapons** only cross within a weapon family the class's attack art supports (a mage's staff look on a staff).

### Unlocks

- Permanently obtaining an item (looting, buying, quest reward, crafting) adds its appearance. Previewing doesn't.
- Migration (save v8): backfill from items **equipped or in the bag** at load (every load, so nothing owned is missed). Nothing else is invented.

### Save rules

- Saved beside equipment, never inside it. On load: drop unknown ids, drop overrides for appearances not owned or not
  compatible with the class (only that override; the item stays).

### UI

A **Wardrobe** tab in the hero panel: slot filter, owned looks first, locked looks as silhouettes with their source
("Captain Saltbeard, the Saltmarsh"), preview on the doll, **Apply**, **Clear**, **Use equipped look**.

## 3. Mounts

### Rules

- Mounts are **cosmetic traversal**: one baseline speed bonus for every mount (the existing `MOUNT_SPEED`), no stats.
- **Mount/dismount**: a button (touch, the horseshoe in the thumb cluster) and a key (desktop, `Y`: `H` was already the potion); summoning takes 0.6 s and is refused in dungeons,
  interiors, boss rooms, cinematics, while in combat or where the mounted collider would overlap a wall.
- **Auto-dismount** on taking damage, casting anything but the dodge, entering a dungeon or interior, or a scripted
  event starting.
- No flying mounts. No mounted combat.

### Rendering (layered, no pre-rendered combinations)

Per direction and frame: `shadow → mountBack → rider (paper doll in a seated pose, its HeroLook — so Wardrobe and
gear show) → weapon (stowed on the back) → mountFront → tack overlay → mount VFX`.

```ts
interface MountVisualDefinition {
  id: string;
  name: string;
  /** Painted in code (paper-doll style) or from an atlas. */
  paint: 'horse' | 'boar' | 'stag' | 'elk' | 'nightmare';
  tint: { coat: string; mane: string; tack: string };
  scale: number;
  /** Rider seat per view and walk frame, in art pixels from the mount's ground point. */
  seat: Record<'down' | 'up' | 'side', [number, number][]>;
  /** Rows of the rider hidden behind the mount's front layer per view. */
  frontMask: Record<'down' | 'up' | 'side', number>;
  gait: { walkFrames: number; fps: number; bob: number };
  source: string;
}
```

The hero's logical position, collider and camera stay where they are on foot; only the picture grows.

### First mount (proof)

**Briarhollow Chestnut**, a sturdy bay horse with village tack — painted in code in the paper-doll style (no local
mount art exists: §6.7 candidates are research only). Production brief for replacement art: 3/4 top-down, 4
directions (side mirrored), idle 4 frames and walk 6 frames at 10 fps, 160 × 128 px cells at 64 px per tile, ground
point at the hooves' center, seat anchor per frame, front/back split at the saddle line, upper-left light, CraftPix
outline weight.

### Roster (after the proof is approved)

| Mount | Source |
| --- | --- |
| Briarhollow Chestnut | Act I: the camp's first horse (after the Defense of Hearthstead) |
| Gullport Strider | the old `mount` perk (Captain Saltbeard): existing owners get it |
| Royal Warhorse | Act II: the Regent's champion (after the Starfall Festival) |
| Mirefen Boar | Duskfen: Low Wick, once the plague is burned out |
| Deepforge War-Boar | Act II: the dwarves, once their forge is theirs again |
| Sun-House Courser | Act III: the sun houses (gold barding) |
| Lastlight Hart | Act IV: the night under the Gloam Gate |
| Glimmer Hart | Act III: the forest clans |
| Frost Elk | Act III: Jarl Sigrun |
| Ashen Nightmare | Heroic Barrow of Kings |
| Crownfall Destrier | Postgame: clear Duskspire and the Crown's memory (Vaelmoor Remembered) on Heroic |
| Starlit Charger | Mythic: clear every Act III dungeon on Mythic |

## 4. Validation (`validate:sigilfall`)

Duplicate appearance ids, overrides pointing at unknown or incompatible appearances, weapon families with no art,
mounts without seats for every view and frame, mount sources that name a missing quest, boss or perk.

## 5. As built (Prompt 6, save v8)

| Piece | Where |
| --- | --- |
| Look ids, names, sources, unlocks, worn-look resolution, mount grants | `progress/wardrobe.ts` |
| Save fields `looks`, `worn`, `mounts`, `mount`; validation and backfill | `progress/character.ts`, `progress/save.ts` (v8) |
| Effective visual: `heroLook(cls, equip, worn)`, `heldWeapon(cls, weapon, look)` — every animation, portrait and doll reads it | `render/sprites.ts` |
| The Wardrobe tab (Head / Chest / Weapon / Mounts; Equipped, Bare, owned looks, locked silhouettes with sources; preview, Apply, Clear) | `ui/Panels.tsx` |
| Mount roster (8: two travel, four story, two prestige) and sources | `data/mounts.ts` |
| Painted mounts in layers (horse, deer, boar bodies; three views; standing + four walking frames; rider's legs layer) | `render/art/mount.ts` |
| Drawing: shadow → back → rider (cut at the hips) and weapon → front → rider's legs → prestige motes; the call fades the mount in | `render/renderer.ts` `drawRider`, `drawMountGhost` |
| Riding rules: 0.6 s call standing still; refused in dungeons, fights, beast form; down on a hit, any action, a story event; rides on between open lands | `sim/world.ts` (`toggleMount`, `mountRefusal`, `dismount`), `sim/combat.ts`, `sim/story.ts`, `engine.ts` |
| Controls: `Y`, the desktop bar's horseshoe slot, the touch horseshoe button | `input/input.ts`, `ui/DesktopBar.tsx`, `ui/Touch.tsx` |
| Tests | `tests/sigilfall-collection.test.ts`, `tests/sigilfall-world.test.ts` (perks) |

The mounts are painted in code in the paper doll's language (no local mount art exists); the production brief in §3
stands for replacement art. Evidence: `docs/review/phase-06/` (the Chestnut in four facings, the Royal Warhorse
with a Wardrobe hat, the mount sheet).
