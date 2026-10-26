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
- Migration (save v3): backfill from items **equipped or in the bag** at load. Nothing else is invented.

### Save rules

- Saved beside equipment, never inside it. On load: drop unknown ids, drop overrides for appearances not owned or not
  compatible with the class (only that override; the item stays).

### UI

A **Wardrobe** tab in the hero panel: slot filter, owned looks first, locked looks as silhouettes with their source
("Captain Saltbeard, the Saltmarsh"), preview on the doll, **Apply**, **Clear**, **Use equipped look**.

## 3. Mounts

### Rules

- Mounts are **cosmetic traversal**: one baseline speed bonus for every mount (the existing `MOUNT_SPEED`), no stats.
- **Mount/dismount**: a button (touch) and a key (desktop, `H`); summoning takes 0.6 s and is refused in dungeons,
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
| Mirefen Boar | Duskfen: Bogmaw's salvage |
| Glimmer Hart | Act III: the forest clans |
| Frost Elk | Act III: Jarl Sigrun |
| Ashen Nightmare | Heroic Barrow of Kings |
| Starlit Charger | Mythic: clear every Act III dungeon on Mythic |

## 4. Validation (`validate:sigilfall`)

Duplicate appearance ids, overrides pointing at unknown or incompatible appearances, weapon families with no art,
mounts without seats for every view and frame, mount sources that name a missing quest, boss or perk.
