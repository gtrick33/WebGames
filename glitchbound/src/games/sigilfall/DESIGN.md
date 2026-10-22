# Sigilfall: design notes

A single-player, top-down pixel-art action RPG, built for phones first (landscape, two thumbs) and fully playable
with a keyboard and mouse. Three classes, gear that changes how skills behave, two talent trees per class,
three regions, three bosses and three difficulty tiers.

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
| `data/` | Content only, typed: classes, skills (as `SkillSpec`s), talents, items, enemies, bosses, regions (ASCII maps), quests and NPCs |
| `progress/` | The hero (`character.ts`), items and loot, the build resolver (`build.ts`), item and modifier text (`describe.ts`), saves |
| `sim/` | The world (`world.ts`), casting and projectiles, combat and statuses, enemy AI, the boss framework, tile maps and collision |
| `render/` | Canvas 2D at a low pixel resolution: text-art sprites, the pre-drawn ground, lighting, effects |
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
A tap aims at the nearest enemy when "Tap to aim" is on; a drag aims by hand and shows the shot's path, and
dragging back to the button cancels. Aim assist (off, light, strong) only nudges a dragged aim a few degrees
toward an enemy near the line; an explicit aim is never replaced by a target elsewhere. Multitouch uses pointer
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

## Progression

Levels 1 to 20 (`xpToNext`), one talent point per level. Skills unlock at levels 1 to 6 and slot themselves into
empty slots; the ultimate at level 3. Talents: two trees per class, a row opens per 3 points in its tree, some
nodes need another first, and each tree ends in a signature talent. Resetting talents is free below level 5,
then costs 25 gold per level.

## World

Regions are ASCII maps in `regions.ts` with a legend per region: walls, water, doors, cracked walls (secrets),
props, NPCs, chests, waystones, exits, packs, hazards and boss marks. Emberwick is the safe village and training
yard; the Whisperwood has packs in the open, elites, spore hazards, a hidden grove and Grimtusk's den; the Hollow
Crypt is a chain of rooms that seal while you fight their waves, with checkpoints, Warden Ossric (the miniboss)
and Morgrave in the Sanctum. Clearing the crypt opens a portal home and a reward screen; loot still on the ground
is collected for you when the fight is won or when you leave, so nothing is lost.

Enemies are archetypes (melee, hopper, ranged, charger, armored, caster) with wind-ups you can read; elites get
affixes. Bosses are phase lists of weighted, cooldown-limited attack patterns (`bosses.ts`, run by `boss.ts`):
every dangerous attack is telegraphed, phases change at health thresholds with a short immune transition.

Difficulty: Normal, Heroic (+6 enemy levels, ×1.9 health, ×1.4 damage) and Mythic (+12, ×4, ×2.1), each opened
by clearing the crypt on the tier below, with optional modifiers for more loot.

## Saves

`glitchbound.sigilfall` holds three hero slots and settings: versioned (`SAVE_VERSION`), validated field by field
on load (unknown items, skills and talents are dropped, numbers clamped, duplicate item ids renamed), with a
device-only backup copy. A damaged save falls back to the backup and keeps the damaged copy; a save from a newer
version is never overwritten. The main key follows a signed-in player between devices through the arcade's
cloud saves (up to 96 KB); the backup stays on the device.

## Testing

- `tests/sigilfall.test.ts`: content checks, map reachability, build rules (Ember Staff changes only Fireball,
  merges and caps), levels, talents, equip without duplication, loot, saves, smart targeting, boss phases.
- `tests/sigilfall-sim.test.ts`: a bot (`tests/sigilfall-bot.ts`) plays every class through the Whisperwood and
  the crypt on all three tiers: no stuck spots, no broken numbers, every boss beaten.
- `tests/sigilfall-section.test.tsx`: the tab, the address, and turning the section off.

## Known limits

- Tested in desktop Chromium and in Chromium's phone emulation with real multitouch events, not on physical
  phones.
- Balance is tuned against the bot; real players will find Normal easier or harder depending on skill.
- Sound is synthesized; there is no recorded audio.
