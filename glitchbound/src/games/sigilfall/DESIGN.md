# Sigilfall: design notes

A low-poly 3D action RPG seen from above, built for phones first (landscape, two thumbs) and fully playable with a
keyboard and mouse, alone or with up to three friends. Eight classes, gear that changes how skills behave, three
talent trees and a specialization per class, a capital city and open lands, dungeons with phased bosses and three
difficulty tiers, told as a Prologue, six acts, the finale and an epilogue (`data/acts.ts`). The story and the Hollow
King are in `STORY_BIBLE.md` and `WORLD.md`; the work to bring the campaign to a small-AAA finish is in
`POLISH_PLAN.md`. Off the campaign: The Ring (arena duels, `arena/`), The Vigil (a horde to hold out against,
`vigil/`) and the Rift Trials.

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
| `render/` | `renderer.ts` hosts the 3D stage and draws the 2D layer over it: names, bars and numbers, speech, markers and the minimap's marks. `effects.ts` hands every spell, shot, flame and warning on the ground to the 3D shaders (`render3d/fx3d.ts`). Also the hero's look (`art/hero.ts`), which the 3D models dress from, and item icons (`sprites.ts`) |
| `render3d/` | The world in 3D (three.js): the land from the rules' own tile map (`land.ts`), everyone on it (`cast.ts`, `worldCast.ts`, `dress.ts`, `armorKit.ts`), what glows and burns (`fx3d.ts`), mounts, portraits, the Ring (`ring3d.ts`) and the Wardens' Sanctum (`hall.ts`) |
| `arena/`, `vigil/`, `net/` | The Ring, The Vigil, and the live rooms of co-op, the Ring and the Vigil |
| `audio/` | Sound effects (`samples.ts`), the soundtrack (`tracks.ts`), each land's air (`ambience.ts`), and a procedural score as a stand-in (`songs.ts`) |
| `input/` | Keyboard and mouse, and the touch state the on-screen controls write into |
| `ui/` | React screens: title, HUD, touch controls, desktop skill bar, the hero/skills/talents/quests/map panels, settings |
| `engine.ts` | The loop, the bridge between the world and React, saving, sound and travel |

The simulation never reads input devices or the DOM: both adapters fill the same `InputFrame`, so desktop and
touch run exactly the same game.

## The loop

`requestAnimationFrame` measures real time, clamped to 0.1 s (a suspended tab never simulates a jump), and the
world steps in fixed 1/60 s slices. Heavy hits apply a short hit-stop. The world pauses when a menu, dialogue,
death or reward screen is open, when the tab is hidden, and when the arcade asks for a pause (`pauseKey`).
Sound is recorded (audio/samples.ts for effects, audio/tracks.ts for the soundtrack, audio/ambience.ts for the air
of each land; who made them is in CREDITS_AND_LICENSES.md), played with Web Audio; a procedural score (audio/songs.ts)
stands in if a piece can't be loaded. It starts on the first tap or key, and has master, music and effects volumes
and a mute switch.

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
| Paladin | Zeal | 0 to 5 whole points: builders give one each, finishers spend three; heals from its own strikes |
| Priest | Mana | holy bolts and heals over time, or shadow curses, a drain and fear |
| Warlock | Mana | curses that tick, a life drain, fear, and demons that fight beside them (Blood Tithe trades health for mana) |
| Druid | Mana | spells in caster form; Lynx Shape and Bear Shape swap the whole bar for claws or paws |
| Gloamknight | Umbra | heavy plate and a greatsword; spends its own blood for strength and wins it back with every blow that lands (the Gloamknight Pack) |

Damage types: physical, fire, frost, lightning, poison, arcane, shadow, holy, nature. Statuses add bleed (a
physical DoT that ignores armor), curse (a DoT of the caster's type; different types stack) and fear (the enemy
runs from the hero and attacks nothing; bosses are only slowed, elites for half as long). On the hero, burning,
poison and bleeding tick, chill slows, stun stops, and a curse cuts the healing taken (Vaelor's Hollowing).

- **Specializations and talents.** At level 10 a hero picks one of their class's three trees as a
  specialization: it gives that tree's ability (Blood Hunger, Flame Pillar, Sun Spark, Rip in Lynx Shape…) and a
  passive. One talent point per level from 10 (51 at 60). A tree has seven rows, each opening after 5 more
  points in it; the other two trees stay shut until 31 points are in the specialization. Changing
  specialization resets talents (free below level 20). No talent point comes before level 10: the level-ups
  before it bring health and skills, and the level-10 one opens the specialization and the first point.
- **Buffs** (`BuffDef`): timed stats, damage reduction (capped at 75 % with everything else) and healing over
  time; shown as rising motes around the hero.
- **Companions** (`data/pets.ts`, `sim/pets.ts`): the warlock's imp, voidwalker, felguard and infernal, the
  ranger's wolf, the druid's treants. Their numbers are shares of the hero's, raised by the `pet` stat. A
  companion that stays (its summon is on the bar) is called when the hero arrives and healed by casting again;
  temporary ones fade. Enemies near a taunting companion attack it instead of the hero (bosses always go for
  the hero).
- **Drains** channel on one enemy and heal by a share of the damage (`extra.drainHeal`).
- **Forms** (`ClassDef.forms`): a shape swaps the basic attack, dodge and the other skill slots (the shape's
  own skill stays, to change back), and adds stats; Bear Shape adds health.

## Mana, regeneration, potions

Every class has a resource (`ClassDef.resource`): mana skills cost a share of the maximum (`SkillSpec.cost`),
the others whole points; `SkillSpec.gen` gives some back on use (on a hit, for melee). Mana comes back slowly in
a fight and the basic bolts return a little per hit (`extra.manaOnHit`). After 3 s without fighting, health and
mana come back fast (10 % and 20 % a second), so potions are for trouble inside a fight; rage and Zeal
fade instead. Potions (40 % health) are bought at the inn, five at most; nothing refills them for free. Dodges
have real cooldowns (4.5 to 5.5 s).

## Vendors

Emberwick's vendors (`data/vendors.ts`, `progress/shop.ts`, `ui/Shop.tsx`): the inn (potions), Brannoc
(weapons and off-hands), Odo (armor), Wren (amulets, rings, relics) and the Sigil Quartermaster (hand-made
epics and legendaries at the top item level, for Sigil Marks, from level 15). Gear stock is rolled for the
hero's class and level with stable ids, changes when they level up or come back from an expedition, and
bought pieces stay sold. Bosses pay Sigil Marks (more on Heroic and Mythic). Every vendor buys bag items.

## Art

The world is drawn in 3D over the same tile map the rules walk on (`render3d/`): low-poly models from CC0 packs
(KayKit, Kenney, Quaternius; who made what is in CREDITS_AND_LICENSES.md), built into the game's own files by
`scripts/sigilfall-3d-assets.mjs` (`public/games/sigilfall/3d/`, colors baked into the vertices, so a whole dressed
hero is one draw call and a dye is a few bytes rewritten). The packs stay out of the repository.

- **The land** (`render3d/land.ts`): the ground painted once near the camera and kept (`groundBake.ts`), solid blocks
  for walls and cliffs, and trees, houses and furniture placed tile by tile; only what is near the camera is drawn.
  Things the packs have no good one of (lamps, banners, cave mouths, the gates between lands) are built of plain
  shapes (`propsBuilt.ts`, `doorways.ts`, `gateways.ts`).
- **People and gear** (`dress.ts`, `armorKit.ts`): every worn piece picks a model by its kind, color and rarity, so two
  helmets look different and the same one always looks the same; rarity shows in the cut, dye and trim. The hero's
  look (`render/art/hero.ts`) is what they dress from; heads by hair style (`heads.ts`); skills have moves of their
  own (`moves.ts`).
- **Creatures** (`kits.ts`, `repaint.ts`, `beast.ts`): every creature name has its model.
- **Bosses** (`bossKit.ts`; NINE_PLAN.md, piece 2): a boss is being given a figure of its own, one at a time, the
  Coffin Matron first. Its file (`3d/k/boss_<id>.pack`, made by `SIGILFALL_ONLY=bosses node
  scripts/sigilfall-3d-assets.mjs`) is parts of several of the packs' characters on one skeleton, with things from the
  packs tied to its bones. In the browser it is painted part by part, what the packs have nothing for is built onto it
  in code, it carries itself its own way (a turn laid over its skeleton's clips: a stoop, a breath), and it makes a
  move of its own for each attack the rules give it, for its entrance, a phase changing, a daze and its fall. A boss
  not yet reached is still its soldiers' model repainted and fitted with what it wears (the `boss()` lines at the end
  of `kits.ts`). `node scripts/sigilfall-boss-shots.mjs --boss <id>` pictures every state of a boss's fight for
  review, and `tests/sigilfall-bosses-own.test.ts` holds each to its budget, its footprint and its moves.
- **Effects**: every spell, shot, flame and warning on the ground is drawn by the graphics card in the world
  (`render/effects.ts` says what each looks like and hands it to `fx3d.ts`), at its true depth: a wall hides what is
  behind it. Only names, bars, numbers and speech are drawn on the 2D layer over the picture.
- **Icons**: skills and talents from game-icons.net on tiles in the damage type's color
  (`scripts/sigilfall-icons.mjs`); items painted in code (`render/sprites.ts`).

Gear has a **legs** slot (trousers, breeches, legguards), sold by the armory.

## Minimap and quest markers

A round minimap in the corner shows the ground around the hero, the waystone, exits, vendors, chests, nearby
enemies and the quest marker (`sim/objective.ts`: a place, or for hunting quests the nearest fitting enemy;
on the rim, pointing, when it is far). The full map shows the same marker.

## Progression

Levels 1 to 60 (`xpToNext`). Skills unlock at levels 1, 2, 4, 6, 14 and 22 and slot themselves into empty
slots; the ultimate at level 8; the specialization's ability at 10. Talents are described under Classes; some
nodes need another first, and each tree ends in a capstone. Resetting talents is free below level 20, then
costs 10 gold per level (at most 400).

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

The world is the capital, the open lands and the dungeons that `data/regions.ts` gathers; the lands the story no
longer goes through are kept in `data/retired.ts`, off the map. Each zone module (`data/zones/<id>.ts`, `-quests.ts`, `-foes.ts`, and its art in
`render/art/zones/<id>.ts`) holds its spec, townsfolk, quests, enemies and hand-made items; a sight can stand a
landmark building (Stormwatch's lighthouse). The main story's quests that join the zones are in `data/story.ts`.

**Sigils.** The seven sigils are the main story's rewards (`perk`s): each adds 4% health and power, the hero sheet
shows them, and Duskspire's last door opens only for all seven (their order and lore are in `data/chronicle.ts`).

Dungeons are chains of rooms that seal while you fight their waves, with checkpoints and phased bosses: the
Hollow Crypt (Warden Ossric, Morgrave), Gallows Keep (the Hangman, Harlan Blackglove), the Smugglers' Grotto (the
Drowned Priestess, Captain Saltbeard), the Rotmother's Cistern (Brother Pustule, the Rot-Mother), the Deepforge
Halls (the Slag Colossus, Forgemaster Grold) and the Barrow of Kings (King Hrodric, Sir Corvane the Fallen). A
dungeon module (`data/dungeons/<id>.ts`) holds its map, bosses, enemies and items; its own boss attacks are in
`sim/patterns/<id>.ts` (ids with its prefix, like `rot:bile`), run by `boss.ts` through a small kit. Beating the
boss of a dungeon's last boss room opens a portal home and a reward screen; loot still on the ground is collected
for you when the fight is won or when you leave, so nothing is lost.

**The ultimate** fills from damage dealt, measured against a typical attack of the hero's level (a typical hit is
1/45 of the bar). From the 20s on, gear and talents make hits much bigger than that, so a full bar can't come back
faster than `ultFloor`: 40 s at level 3, 60 s at 30, 70 s from 50. Everything that charges it (hits, the trickle
while fighting, procs) draws on that budget, and a lull banks at most a third of a bar (`ULT_BANK`), so the ultimate
comes about once a minute in a long fight.

**Skills and haste.** A skill hits many times harder than the basic attack, on a cooldown of seconds (Fireball: 78
damage every 7 s, near nine Arcane Bolts' worth). Haste speeds a skill's cooldown by half of itself and never more than
50% (`skillHaste` in `sim/world.ts`); the basic attack is sped by haste up to 25% (`BASIC_HASTE`), and the dodge by
all of it, as before. The basic attack has room to breathe and the skills carry the fight (`paceBasics` in
`progress/build.ts`): every basic attack, a shape's too, comes at least 1.3× slower and never more often than every
0.75 s, so the quickest slow the most; each hit grows with that, keeping 85% of its damage a second; what a hit gives
back (rage, mana, focus; not Zeal's whole points) grows with it; and every other damaging skill hits 1.25× harder. With
the haste cap no basic attack comes more than about 1.7 times a second (a mage's Arcane Bolt came nearly four).
Every specialization has talents that make a skill ready, free, stronger or (for a spell with a cast bar) instant now
and then, so a fight has moments that aren't the same as the last.

**Enemy strength by level.** Enemy health grows a fifth a level to 15, then follows the heroes, whose damage
multiplies with specializations, talents and gear (`HP_CURVE` in `data/enemies.ts`: ×4 at 15, ×15 at 30, ×64 at
60), so fights don't melt away as heroes grow. Damage grows ×1.14 a level; burning, poison and bleeding from enemy
shots grow with it.

Enemies are archetypes (melee, hopper, ranged, charger, armored, caster, diver, exploder) with wind-ups you
can read, and tricks on top: flanking, healing a hurt friend, leading a moving target, webs and poison shots,
raising minions (to a limit, resting between calls), blinking away, knitting back together, swelling and bursting
(or bursting when killed), floating over water; named rares and recolored variants. Enemy shots look like what
they are: arrows, spears, webs, skulls, flames, lightning and cannonballs. Elites get affixes. They walk straight at you only when their whole body fits along the way (otherwise they follow the
flow field around pillars) and slide off corners they catch on. Bosses are phase lists of weighted, cooldown-limited attack patterns (`bosses.ts`, run by `boss.ts`):
every dangerous attack is telegraphed, phases change at health thresholds with a short immune transition. A boss
charges only along a clear lane; with a pillar in the way it walks round it.

Difficulty: Normal, Heroic (+6 enemy levels, ×1.9 health, ×1.4 damage) and Mythic (+12, ×4, ×2.1), each opened
by clearing the crypt on the tier below, with optional modifiers for more loot.

**The Riftstone** (the endgame past Mythic, `data/keystones.ts`), climbed as Diablo's rifts are: clearing Duskspire on
Mythic earns a Riftstone and opens Riftstone +1. Any dungeon can then be run at any level opened, against its clock
(each fall costs 10 s): enemies at level 72 with ×4·1.08ᵏ health and ×2.1·1.05ᵏ damage, without end, and the week's
affixes from +2 (Hardened or Crowned), +4 (Grieving, Festering, Cornered or Splintering), +7 (Volatile or Hasted)
and +10 (both of the first). Beaten under 100/80/60% of the clock, the next one, two or three levels open; late,
nothing is lost. Loot is made at item level 72 + the level (at most 100), so higher levels make better gear. The
clock keeps the world's time (`World.step`): a hit-stop or a boss's fall in slow motion costs it nothing; while the
hero is down it runs at full speed.

**Co-op** (`net/room.ts`, `net/coop.ts`, `net/link.ts`): a party of up to four level-60 heroes runs a Riftstone
together, each on their own device. The party lives in a live room on the arcade's room server (a code and an
invite link, `/r/<code>`); the leader picks the dungeon and the level and starts. The leader's game runs the
enemies, the rooms, the bosses and the clock, and sends a frame ten times a second (every enemy, the attacks in the
air, the rooms, the clock, and kills, a boss's fall, a hit on someone). Every game runs its own hero and sends its
place and its hits; a guest's world mirrors the leader's enemies and attacks (`World.puppet`: drawn, struck,
never striking). What strikes a guest comes from the leader's game and is taken with the guest's own armor and
dodge. Every kill pays every hero their own experience and loot; a fall costs the shared clock; a fight starting
draws in a hero still outside (sealed doors shut nobody out), and a hero comes back inside a fight their friends
are still in. The world never pauses in a party. The leader going home ends the run for everyone.

**Questing together** uses the same machinery at any level. When the party sets out, the room makes the hero furthest
behind in the main story the leader (`lead`): their game runs the land's enemies and the story's events, and the
others are phased into their world (`World.layer`: who stands where, what is built and which foes are out follow
the leader's quests; the leader's game sends its packed quests whenever they change). Everything else stays each
hero's own: their quests, talk, hand-ins, experience and loot, so a quest a hero has already finished gives them
nothing again, and a newer hero plays as they would alone. A story event the leader's game wins counts for every
hero whose quest waits on it. The party travels as one: the leader's roads and waystones take everyone (`go`), the
others can't wander off without leaving the party, and a frame in an open land holds only the enemies near a hero.
A leader who drops out is waited for twenty seconds.

**Friends** (`ui/Friends.tsx`, `src/platform/friends.ts`, the engine's friends methods): the party panel shows the
player's GlitchBound friends beside the party, the same list as the site's Friends page. Each row says whether the
friend is online and whether they are in Sigilfall, and has an Invite button; with no party yet, inviting opens a
questing party first. A friend is added by the code they gave, which adds them to that one list. An invitation arrives
as a card over the game with Join and Not now (on the hero list it waits for a hero to be chosen); the site's own
invitation bar leaves Sigilfall's invitations to the game while it is open. The game asks for invitations every 20
seconds while its tab is in front, and that ask is also what tells friends the player is here: "online" is a tab seen
in the last two and a half minutes (`server/friends.ts`), told to friends alone, and the time itself never leaves the
server.

**Paragon** (`progress/paragon.ts`): experience past 60 earns Paragon levels, each a point for Might (+1% damage),
Vigor (+1% health), Precision (crit, up to 50 points) or Toughness (armor and regeneration, up to 50), taken back
for free. With Riftstone loot it is what lets a hero climb further every week.

## Saves

`glitchbound.sigilfall` holds three hero slots and settings: versioned (`SAVE_VERSION`), validated field by field
on load (unknown items, skills and talents are dropped, numbers clamped, duplicate item ids renamed), with a
device-only backup copy. A damaged save falls back to the backup and keeps the damaged copy; a save from a newer
version is never overwritten. Version 2 (three trees and specializations) gave every older hero their talent
points back with no specialization chosen. The main key follows a signed-in player between devices through the arcade's
cloud saves (up to 96 KB); the backup stays on the device.

## The Ring's ranked ladder

The owner, 2026-11-18: "i want to do appropriate matchmaking, ranking system so that players can enjoy a competitive
environment ... make sure wintrading and exploiting is prohibited". A signed-in player's Ring rating in each format is
kept by the server (`migrations/0026_sigilfall_ring_ranked.sql`, `server/ring.ts`, `functions/api/sigilfall/ring.ts`;
the rules in `arena/ranked.ts`, the elo math in `arena/rating.ts`, shared by both ends). A guest plays for a practice
rating kept on their device, on no ranking.

- **Matches against the computer** are tickets the server writes before the gates open, with the computer's rating
  drawn there. A win sooner than 25 s isn't believed, giving up after the gates is a leaver's loss (as is a ticket
  never reported), and from 1900 only matches against people move a rating.
- **Matches against people** are made from the room's own roster as the run began: the rooms worker is told each
  seat's account and a hash of its network by the site (never by the page) and keeps them, and notes when anyone
  drops out while it goes. Every player reports; the reports have to agree, or nothing changes. The leaver is whoever
  the room saw drop out before the end, whatever anyone said.
- **Win trading**: nothing is won or lost against a friend, someone on the same network or your own other account; the same opponent counts in full twice in 20 hours, at half twice more, then not at
  all. A ranked room waiting for players takes a new seat only from those quick match sent there (a door key).
- **Parties**: friends invited from the fight's window sit on one side of a room, and its leader puts the room in the
  queue at the party's median rating, however far apart they are; strangers fill the rest. Each player's win and loss
  is worked from their own rating against the other side's (the stronger one wins little and loses a lot, the weaker
  one the other way round), and no match raises a rating more than 40 (`WIN_CAP`). A room with people on both
  sides is a custom game, and can't queue.
- The Ring's rankings come from the server's ladder only; the ladder started from 1000 for everyone when it began.

## Testing

- `tests/sigilfall.test.ts`: content checks, map reachability, build rules (Ember Staff changes only Fireball,
  merges and caps), levels, talents, equip without duplication, loot, saves, smart targeting, boss phases.
- `tests/sigilfall-sim.test.ts`: a bot (`tests/sigilfall-bot.ts`) plays every class through the Whisperwood and
  the crypt on all three tiers: no stuck spots, no broken numbers, every boss beaten.
- `tests/sigilfall-section.test.tsx`: the tab, the address, and turning the section off.
- `tests/sigilfall-look.test.ts`: every armor piece changes the hero's look; dyes; the legs slot rolls, sells
  and saves; Scale2x.
- `tests/sigilfall-economy.test.ts`: mana, rage, regeneration, potions, shops, aiming and dodge cooldowns.
- `tests/sigilfall-classes.test.ts`: the version 1 migration, Zeal, drains, heals over time, Shield
  Wall, companions (staying, healing, taunting, fading), fear and the druid's forms.
- `tests/sigilfall-world.test.ts`: the zone generator, routes across the world, respawns, sleeping enemies,
  sights, loot and kill objectives, level warnings, perks, enemy tricks, and every class fighting its way through
  Thornvale and the Saltmarsh.
- `tests/sigilfall-dungeons.test.ts`: every class clears Gallows Keep and the Smugglers' Grotto;
  `tests/sigilfall-dungeon-<id>.test.ts` the same for each newer dungeon, plus its own boss mechanics.
- `tests/sigilfall-world.test.ts` also plays every class through every open zone at its first levels, and checks
  that every sprite and townsfolk look is drawn once (zone art tables are merged).
- `tests/sigilfall-keystones.test.ts`: Riftstone (scaling, affixes, the clock with its falls, levels opening, every
  affix at work, saves) and Paragon (levels, points, caps, stats); a level-60 hero in Mythic gear beats +1.
- `tests/sigilfall-rift-clock.test.ts`: the Riftstone clock keeps the world's time: a run with hit-stops in it ends
  at the same time as the same run without them, a fall costs it in full, a boss's fall the same alone as in a party.
- `tests/sigilfall-ring-ranked.test.ts`: the ranked ladder's rules, the server keeping it (tickets, reports, leavers,
  win trading, settling once), the rooms that tell it who played, and a party's search;
  `tests/sigilfall-ring-play.test.tsx`: the fight's window.
- `tests/sigilfall-ids.test.ts`: every quest and item id is used once, and no two zones or dungeons define the same
  enemy, boss or person (their tables are merged, so a repeated id would quietly replace another).

## Known limits

- Tested in desktop Chromium and in Chromium's phone emulation with real multitouch events, not on physical
  phones.
- Balance is tuned against the bot; real players will find Normal easier or harder depending on skill.
- The sounds and music were chosen by description and measured loudness, not by ear: `audio/samples.ts` and
  `audio/tracks.ts` are the places to change what plays.
- What the campaign still lacks against a small-AAA finish, and the pieces that bring it there, are in
  `POLISH_PLAN.md`.
- Measured with the bot at level 60 in rare gear, the damage specializations deal about 20-44k a second
  (Retribution and the Beastmaster were cut back from 55-67k; each skill's curse is now its own, so Affliction's
  stack). The bot plays the default bar with the specialization's skill on it, so specs that want another bar
  (Shadow casts, Cat and Bear Shape) measure low; giving each specialization a bar of its own is still to come.
