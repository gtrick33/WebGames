# Sigilfall: design notes

A single-player, top-down pixel-art action RPG, built for phones first (landscape, two thumbs) and fully playable
with a keyboard and mouse. Seven classes, gear that changes how skills behave, three talent trees and a
specialization per class, a capital city and big open zones, dungeons with phased bosses and three difficulty
tiers. The story, the Hollow King and the plan for all 28 zones and their dungeons are in `WORLD.md`.

**Name.** The game launched as "Riftbound" on 2026-10-22 and was renamed Sigilfall the same day: Riftbound is
also Riot Games' League of Legends trading card game. In the story, the sigils that held the Rift shut have
fallen. The old slug stays in `RENAMED_SLUGS`; `/riftbound` and `/games/riftbound/…` redirect
(`functions/riftbound.ts`, `functions/games/riftbound/`), migration 0013 moves stored data (favorites, bests,
admin settings, shares, cloud saves), and a device save under the old key is picked up on first load. The CSS
class prefix `rb-` and the dev-only `window.__rb` handle are left from the first name.

## Where it lives

Sigilfall is not an arcade tile: it has its own tab next to Arcade and Party (`section` in its `GameEntry`), at
`/sigilfall` (`/games/sigilfall` opens the same page and is `noindex`). Admins turn it on and off from
Admin › Games › Sigilfall (the game's `hidden` setting): hidden, the tab disappears and the address is Not Found
for players, while admins still see both. It reports `start`/`end` to the arcade like every module game.

## Code map

| Folder | What is in it |
| --- | --- |
| `data/` | Content only, typed: a kit per class in `kits/` (its definition, skills as `SkillSpec`s, talents), pets, items, enemies, bosses, regions, quests and NPCs; a module per zone in `zones/` (its region, people, quests and enemies), dungeons in `dungeons/`, the zone generator (`zonegen.ts`), the city builder (`citygen.ts`) and every land's look (`themes.ts`) |
| `progress/` | The hero (`character.ts`), items and loot, the build resolver (`build.ts`), item and modifier text (`describe.ts`), saves |
| `sim/` | The world (`world.ts`), casting and projectiles, combat and statuses, companions (`pets.ts`), enemy AI, the boss framework, tile maps and collision |
| `render/` | Canvas 2D at a low pixel resolution: the ground (chunked, painted on a worker), the paper-doll hero, sprites, lighting, effects |
| `input/` | Keyboard and mouse, and the touch state the on-screen controls write into |
| `ui/` | React screens: title, HUD, touch controls, desktop skill bar, the hero/skills/talents/quests/map panels, settings |
| `engine.ts` | The loop, the bridge between the world and React, saving, sound and travel |

The simulation never reads input devices or the DOM: both adapters fill the same `InputFrame`, so desktop and
touch run exactly the same game.

## The loop

`requestAnimationFrame` measures real time, clamped to 0.1 s (a suspended tab never simulates a jump), and the
world steps in fixed 1/60 s slices. Heavy hits apply a short hit-stop. The world pauses when a menu, dialogue,
death or reward screen is open, when the tab is hidden, and when the arcade asks for a pause (`pauseKey`).
Sound is synthesized with Web Audio (effects and a small procedural score with a boss theme), starts on the
first tap or key, and has master, music and effects volumes and a mute switch.

## Controls

Touch: a floating joystick on the left (size, dead zone, sensitivity and a fixed mode in Settings), attack, three
skills, the ultimate (larger, gold, with its charge) and dodge on the right (mirrored for left-handed players).
The attack aims at the nearest enemy by itself (no aim line). A tapped spell goes where the hero faces, shown
by a small arrow ahead of them (spells that need a target, chain lightning and marks, still pick the nearest
enemy); a drag aims by hand and shows the spell's path, and dragging back to the button cancels. Aim assist
(off, light, strong) only nudges a dragged aim a few degrees toward an enemy near the line; an explicit aim is
never replaced by a target elsewhere. The potion sits in the thumb cluster on touch. Multitouch uses pointer
capture, and every pointer is released on cancel, blur and pause, so nothing stays held.

Keyboard and mouse: WASD or arrows, mouse aim, left button attack, Q E R skills, Space dodge, the ultimate on F
(or T, Shift or the right button), 1 potion, G interact, I K U J M for the panels, Esc pause.

## The signature system: gear and talents change skills

Every skill is a `SkillSpec` (cast kind, damage, cooldown, charges, projectiles, pierce, bounce, area, effects on
hit, impact, kill and cast, trails, bonus damage against statuses). Items and talents carry `Mod`s: a stat, a
`SkillOp` on one named skill (or `basic` / `dodge` / `ult` / `*`), or a proc. `build.ts` turns the hero into
the specs the simulation runs, the same way every time:

1. the skill's base spec;
2. talents in tree order, then items in slot order;
3. counts (projectiles, pierce, bounce, charges, extra knobs) add up;
4. percentages of one kind add up, then apply once (+30 % and +20 % area = +50 %);
5. effects merge by kind: the same status keeps the stronger duration and power, two explosions become one
   bigger one, splits keep the larger count;
6. caps: cooldowns at least half, bounces 4, projectiles 11, charges 3, chain jumps 8, traps 6, echoes 2.

A modifier names its skill, so it can only change that skill. Procs have their own chance and internal cooldown;
on-hit healing is limited to 10 % of health per second, and split or chained hits never trigger new splits, so
nothing loops. Every modifier has a sentence (`describe.ts`) shown on the item, in the comparison and under the
skill it changes ("Fireball splits into 3 smaller projectiles (40 % damage each) where it lands.").

Items: 31 hand-made ones (uncommon to legendary, most of them changing a skill) and generated gear (common to
rare: rolled stats, and rare pieces roll a small skill modifier). Epic and legendary drops are always hand-made.

## Classes

Each class is one file in `data/kits/` (`kit.ts` has the shorthands): its definition, about twenty skills and
three talent trees. `classes.ts`, `skills.ts` and `talents.ts` gather them.

| Class | Resource | What makes it itself |
| --- | --- | --- |
| Warrior | Rage | earned by landing swings and taking hits, spent by heavy skills, fades after a fight; shield |
| Mage | Mana | elemental bolts, novas and fields; Fire, Storm and Frost |
| Ranger | Focus | refills steadily (faster with haste); arrows, traps and a wolf |
| Paladin | Holy Power | 0 to 5 whole points: builders give one each, finishers spend three; heals from its own strikes |
| Priest | Mana | holy bolts and heals over time, or shadow curses, a drain and fear |
| Warlock | Mana | curses that tick, a life drain, fear, and demons that fight beside them (Life Tap trades health for mana) |
| Druid | Mana | spells in caster form; Cat Form and Bear Form swap the whole bar for claws or paws |

Damage types: physical, fire, frost, lightning, poison, arcane, shadow, holy, nature. Statuses add bleed (a
physical DoT that ignores armor), curse (a DoT of the caster's type; different types stack) and fear (the enemy
runs from the hero and attacks nothing; bosses are only slowed, elites for half as long).

- **Specializations and talents.** At level 10 a hero picks one of their class's three trees as a
  specialization: it gives that tree's ability (Bloodthirst, Flamestrike, Holy Shock, Rip in Cat Form…) and a
  passive. One talent point per level from 10 (51 at 60). A tree has seven rows, each opening after 5 more
  points in it; the other two trees stay shut until 31 points are in the specialization. Changing
  specialization resets talents (free below level 15).
- **Buffs** (`BuffDef`): timed stats, damage reduction (capped at 75 % with everything else) and healing over
  time; shown as rising motes around the hero.
- **Companions** (`data/pets.ts`, `sim/pets.ts`): the warlock's imp, voidwalker, felguard and infernal, the
  ranger's wolf, the druid's treants. Their numbers are shares of the hero's, raised by the `pet` stat. A
  companion that stays (its summon is on the bar) is called when the hero arrives and healed by casting again;
  temporary ones fade. Enemies near a taunting companion attack it instead of the hero (bosses always go for
  the hero).
- **Drains** channel on one enemy and heal by a share of the damage (`extra.drainHeal`).
- **Forms** (`ClassDef.forms`): a shape swaps the basic attack, dodge and the other skill slots (the shape's
  own skill stays, to change back), and adds stats; Bear Form adds health.

## Mana, regeneration, potions

Every class has a resource (`ClassDef.resource`): mana skills cost a share of the maximum (`SkillSpec.cost`),
the others whole points; `SkillSpec.gen` gives some back on use (on a hit, for melee). Mana comes back slowly in
a fight and the basic bolts return a little per hit (`extra.manaOnHit`). After 3 s without fighting, health and
mana come back fast (10 % and 20 % a second), so potions are for trouble inside a fight; rage and Holy Power
fade instead. Potions (40 % health) are bought at the inn, five at most; nothing refills them for free. Dodges
have real cooldowns (4.5 to 5.5 s).

## Vendors

Emberwick's vendors (`data/vendors.ts`, `progress/shop.ts`, `ui/Shop.tsx`): the inn (potions), Brannoc
(weapons and off-hands), Odo (armor), Wren (amulets, rings, relics) and the Sigil Quartermaster (hand-made
epics and legendaries at the top item level, for Sigil Marks, from level 15). Gear stock is rolled for the
hero's class and level with stable ids, changes when they level up or come back from an expedition, and
bought pieces stay sold. Bosses pay Sigil Marks (more on Heroic and Mythic). Every vendor buys bag items.

## Art

The world is laid out in world pixels (16 per tile) and drawn at twice that resolution (`DETAIL` in
`render/pixel.ts`), so newer art has finer pixels while the camera, the simulation and the old 1× effects stay
in world units.

- **Ground** (`render/groundPaint.ts`): every art pixel is a pure function of the map and its position: grass
  with single blades and flowers, worn paths with pebbles and a shadow under the grass edge, water with banks,
  foam and ripples, cobbles, plank bridges, the forest canopy seen from above (leafy edges, glints, a shadow on
  the ground) and crypt flagstones and brick. `render/ground.ts` keeps 256 × 256 chunks: the ones in view are
  painted at once if they aren't ready, the ring around them on a worker (`ground.worker.ts`, or a few
  milliseconds per frame without one), and far ones are dropped, so a large map costs only what is near.
- **Heroes and townsfolk** (`render/art/hero.ts`) are paper dolls painted at art resolution in three views
  with walking frames. Each worn piece is drawn from its style (hood, helm, cap, crown; robe, tunic,
  breastplate; trousers or greaves; gloves or gauntlets; shoes, boots or sabatons), material (cloth, leather,
  mail, plate, gold: `mat` on an item, else from its icon), color and rarity (rare: a light trim; epic: gold
  trim; legendary: gold and a glowing stone; epic and legendary armor adds a cape). Generated armor is dyed per
  piece from its material's colors (`itemTint`), so two robes rarely match. Empty slots show the class outfit
  (the mage's hat and robe). The character screen is a paper doll with the hero in the middle (tap to turn).
- **Trees, bushes, rocks** (`render/art/flora.ts`) are painted at art resolution, each land with its own trees
  (oaks and pines, palms, snowy pines, dead trees, cacti, mushrooms, crystal spires, willows, jungle trees: the
  theme's list in `data/themes.ts`), a few dozen variants of each shared across a zone. **Buildings**
  (`render/art/buildings.ts`) are painted per style (house, tavern, inn, shop, smithy, temple, keep, tower,
  hall) over their footprint. Other props, creatures and
  weapons are their text art doubled with Scale2x (smooth diagonals, a fine outline) until they are redrawn.
  Companions and the druid's cat and bear are in `render/art/companions.ts`.
- **Icons**: skills and talents use 24 × 24 glyphs (`render/art/icons.ts`, one per skill in `skillGlyphs.ts`)
  on a tile in the damage type's color. New bolts have their own looks (a spinning shield, a hammer of light, a
  lance of ice, lashing roots, stars).

Gear has a **legs** slot (trousers, breeches, legguards), sold by the armory.

## Minimap and quest markers

A round minimap in the corner shows the ground around the hero, the waystone, exits, vendors, chests, nearby
enemies and the quest marker (`sim/objective.ts`: a place, or for hunting quests the nearest fitting enemy;
on the rim, pointing, when it is far). The full map shows the same marker.

## Progression

Levels 1 to 60 (`xpToNext`). Skills unlock at levels 1, 2, 4, 6, 14 and 22 and slot themselves into empty
slots; the ultimate at level 3; the specialization's ability at 10. Talents are described under Classes; some
nodes need another first, and each tree ends in a capstone. Resetting talents is free below level 15, then
costs 25 gold per level.

## World

The story and the map of the whole world are in `WORLD.md`. Each region is a tile map with markers, from one
of three sources:

- **Hand-laid** ASCII maps with a legend (the Whisperwood, the Hollow Crypt, the dungeons in `dungeons/`): walls,
  water, doors, cracked walls (secrets), props, NPCs, chests, waystones, exits, packs, hazards and boss marks.
- **The city builder** (`citygen.ts`): Emberwick is a short script of walls and gates, avenues and squares,
  buildings with their keepers at the door (the keep with the Regent, the temple, the Drunken Wyvern tavern, the
  Ember Hearth inn, the smithy, shops, houses), the training grounds, a pond, gardens and lamps.
- **The zone generator** (`zonegen.ts`): an open zone is a `ZoneSpec` (size, seed, levels, how much forest,
  water as lakes, a river or a coast, beaches, towns with their people and houses, sights, camps, nests, ruins,
  caves with dungeon entrances, wrecks, and the packs of the open land). It lays out the land, joins every place
  with roads, levels the packs by their distance from the way in and places everything as markers; the same
  spec always makes the same zone, generated on first visit. Its `holds` (people, places, ways out) are known
  without generating it, so quest markers can route across the world (`sim/routes.ts`).

In the open zones a wiped-out pack comes back after 100 s (named enemies after 300 s), never in sight of the
hero; enemies far away and not fighting sleep, so a zone can hold hundreds. Those packs are tougher than a
dungeon's (×1.8 health, ×1.15 damage) and pay half the experience: the road to 60 is meant to be long, and
quests, sights (3 % of a level each) and dungeons are the way up. Roads to new lands warn heroes below their
level. Perks from quests: a bigger satchel, a bigger flask, a mount (×1.3 speed outside fights, not in
dungeons) and the hearthstone.

Dungeons are chains of rooms that seal while you fight their waves, with checkpoints and phased bosses: the
Hollow Crypt (Warden Ossric, Morgrave), Gallows Keep (the Hangman, Varric Blackhand) and the Smugglers' Grotto
(the Drowned Priestess, Captain Saltbeard). Beating the boss of a dungeon's last boss room opens a portal home and
a reward screen; loot still on the ground is collected for you when the fight is won or when you leave, so
nothing is lost.

Enemies are archetypes (melee, hopper, ranged, charger, armored, caster, diver, exploder) with wind-ups you
can read, and tricks on top: flanking, healing a hurt friend, leading a moving target, webs and poison shots,
raising minions (to a limit), blinking away, knitting back together, bursting when they die, floating over
water; named rares and recolored variants. Elites get affixes. They walk straight at you only when their whole body fits along the way (otherwise they follow the
flow field around pillars) and slide off corners they catch on. Bosses are phase lists of weighted, cooldown-limited attack patterns (`bosses.ts`, run by `boss.ts`):
every dangerous attack is telegraphed, phases change at health thresholds with a short immune transition. A boss
charges only along a clear lane; with a pillar in the way it walks round it.

Difficulty: Normal, Heroic (+6 enemy levels, ×1.9 health, ×1.4 damage) and Mythic (+12, ×4, ×2.1), each opened
by clearing the crypt on the tier below, with optional modifiers for more loot.

## Saves

`glitchbound.sigilfall` holds three hero slots and settings: versioned (`SAVE_VERSION`), validated field by field
on load (unknown items, skills and talents are dropped, numbers clamped, duplicate item ids renamed), with a
device-only backup copy. A damaged save falls back to the backup and keeps the damaged copy; a save from a newer
version is never overwritten. Version 2 (three trees and specializations) gave every older hero their talent
points back with no specialization chosen. The main key follows a signed-in player between devices through the arcade's
cloud saves (up to 96 KB); the backup stays on the device.

## Testing

- `tests/sigilfall.test.ts`: content checks, map reachability, build rules (Ember Staff changes only Fireball,
  merges and caps), levels, talents, equip without duplication, loot, saves, smart targeting, boss phases.
- `tests/sigilfall-sim.test.ts`: a bot (`tests/sigilfall-bot.ts`) plays every class through the Whisperwood and
  the crypt on all three tiers: no stuck spots, no broken numbers, every boss beaten.
- `tests/sigilfall-section.test.tsx`: the tab, the address, and turning the section off.
- `tests/sigilfall-ground.test.ts`: the ground painter makes no canvases (it runs on a worker), is deterministic,
  paints in row pieces exactly as in one go, and puts things on the square on stone.
- `tests/sigilfall-look.test.ts`: every armor piece changes the hero's look; dyes; the legs slot rolls, sells
  and saves; Scale2x.
- `tests/sigilfall-economy.test.ts`: mana, rage, regeneration, potions, shops, aiming and dodge cooldowns.
- `tests/sigilfall-classes.test.ts`: the version 1 migration, Holy Power, drains, heals over time, Shield
  Wall, companions (staying, healing, taunting, fading), fear and the druid's forms.
- `tests/sigilfall-world.test.ts`: the zone generator, routes across the world, respawns, sleeping enemies,
  sights, loot and kill objectives, level warnings, perks, enemy tricks, and every class fighting its way through
  Thornvale and the Saltmarsh.
- `tests/sigilfall-dungeons.test.ts`: every class clears Gallows Keep and the Smugglers' Grotto.

## Known limits

- Tested in desktop Chromium and in Chromium's phone emulation with real multitouch events, not on physical
  phones.
- Balance is tuned against the bot; real players will find Normal easier or harder depending on skill.
- Sound is synthesized; there is no recorded audio.
- The level cap is 60, but the zones so far reach level 22 (Mythic crypt aside). The rest of the world in
  `WORLD.md`, the Hollow King's story and Duskspire are the next stages.
