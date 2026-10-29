# Crater Crew

Turn-based artillery for crews of critters on ground that breaks. Each player picks one of eight critters
(Frog, Fox, Penguin, Robot, Slime, Owl, Bunny, Duck), each with its own shape, face and crew color, and every
critter carries its player's name and health over its head.

## A turn

The crew whose turn it is moves one of its critters (they take turns within the crew). It may walk (climbing
small steps), jump, then fire one weapon: aim by dragging on the map (or the arrow keys), hold the fire button
for power and let go. The turn clock is 20, 30 or 45 seconds; when it runs out the turn passes without a shot.
Blasts carve craters, hurt everyone near (the closer, the more) and knock them flying; falls from high up
hurt too, and anyone knocked into the liquid (water, lava, sludge or deep space) is out. After ten rounds the
liquid rises a little every turn, so every battle ends. The last crew standing wins.

Weapons: Rocket (rides the wind), Grenade (bounces, three-second fuse), Splitter (five bomblets, 2 a battle),
Zapper (a straight beam), Bonk Mallet (big knockback, 2), Dynamite (huge, dropped at your feet with a
four-second fuse, 1) and Meteor Shower (five meteors on a spot you tap, 1). Ammo is per crew.

After dropping dynamite you get three seconds to run: walk and jump while the fuse burns (the world goes
on around you). The run is part of the turn the phone sends, one input a step like the walk, and the
room and every phone replay it through the same physics; it ends early if the turn's clock runs out.

## Look and feel

Cartoon props with ink outlines and candy colors (`render/arms.ts`): the rocket peeks out of its launcher
with eyes, grenades scowl, meteors are furious rocks with flaming tails, dynamite fizzes. Blasts are
ink-outlined fireballs that cool to soot, puffy smoke, a star-burst flash, tumbling chunks of the ground's
own colors and a comic-book word ("KA-BOOM!", "BONK!", "ZAP!"); a critter that is hit sees stars. Fuses
count down in a bubble that turns red on the last second.

The HUD says everything once and plainly: every crew's critter, health bar and number; whose turn it is with
their critter and the clock; a wind gauge that runs the way the wind blows, as far as it is strong (and the
turn banner says it in words). Your controls: walk, jump, the weapon chip (it opens a picker with every
weapon's ammo and what it does), aim, and a fire button whose ring fills with the power. The first two shots
come with three lines of tips for touch or keyboard. The HUD sizes itself by the battle's own box, so it
fits beside the leaderboard on a laptop as well as on a phone held either way.

## Ten terrains

Each terrain has its own landform generator, physics and look: Clover Hills (rolling hills and floating
ledges), Sunscorch Dunes (dunes, flat mesas, the strongest wind), Frostbite Peaks (jagged ridges), Magma Rift
(volcanoes over a high lava sea), Coconut Atoll (islands with sea between), Moonbase Dust (low gravity, no
wind, pre-made craters, deep space below), Sugar Summit (stacked cake terraces and floating cakes), Crystal
Hollow (a mountain full of tunnels), Gloomwood Graves (moonlit hills with crumbling overhangs) and Rustbelt
Yard (blocky scrap heaps and hanging girders). The same seed always builds the same map.

## Modes

- **Live rooms** (the heart of it): 2 to 6 crews, each player on their own device; the host picks the
  terrain (or random), crew size (1 to 3) and turn time, and can add computer crews (Easy, Normal, Hard). The
  room server referees: the active player's walk streams live to the others, then the phone sends the whole
  turn (every physics step's input, run-length coded, and the shot); the room replays it through the same
  physics and every phone replays it to show it. The physics only uses arithmetic that gives the same bits
  in every JavaScript engine (its own sine and cosine), so the room and every phone agree to the pixel.
- **Daily battle**: your crew of two against two Normal computer crews, on the day's terrain (they take turns
  day by day) with the same map, wind and computer play for everyone. Numbered from 2026-10-29, shared as a
  spoiler-free line (🏆 or 🏳️, a 💥 per 50 damage, a 💀 per knockout).
- **Skirmish**: any terrain, 1 to 3 computer crews, their level, crew size and turn time.
- **Friends' challenge**: the daily setup on the challenge's seed.

## Score

Damage dealt to other crews (never more than they had), 50 a knockout, and for winning 250 plus twice the
health your crew has left. Stats: damage and knockouts in the battle.

## What is original

The critters, names, terrains, weapons' names and every picture are original (drawn as vector art in
`render/`). Only the genre's rules (turns, wind, destructible ground) are shared with other artillery games.
