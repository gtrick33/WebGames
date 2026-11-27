# Prism Pals

A side-view co-op tile platformer. Up to four round pals, each its own color: **Tango** the tangerine
hamster, **Sprig** the mint cat, **Plum** the lilac bunny and **Zest** the lemon chick. A level is cleared
when every pal stands in the prism door together; when one pal is lost, the whole team starts over.

## Rules

- **Color blocks** are solid only for the pal of their color; the others pass straight through.
- **Color goo** is deadly to every other color; its own pal wades through it (slower, with a lower jump).
- **Color plates** open every **gate** of their color while a pal of that color stands on one.
- **Gems** are picked up only by the pal of their color.
- Neutral pieces: spikes and drops (deadly), pushable crates (they drop into the first hole they reach,
  making a step or a bridge), springs (5 tiles up), lifts on tracks, and levers, which flip every lever gate
  (`|` starts shut, `!` starts open).
- Pals can stand on each other's heads. Every color also has a shape (circle, triangle, diamond, star) on
  its blocks, goo, plates, gates and gems, so colors never rely on hue alone.

## Levels

24 hand-made ASCII maps (`levels.ts`, legend in `level.ts`): 8 for two pals, 8 for three, 8 for four. Each
set ramps from one idea at a time (lanes of color blocks, plate relays, goo moats, crates as stools, springs
under color lids, lifts, levers) to mixes of them. `tests/prism-pals-levels` runs a breadth-first search over
the cells each pal can stand in, moving with the real simulation (every walk, running jump, short hop and
steered jump), and checks that every pal reaches the door and each of its gems (gates counted as openable,
lifts as a bridge along their track, crates where they start or pushed along their floor).

## Score

Per level: 1000 + 150 per gem + up to 500 for time (all of it at or under par, none at twice par) − 50 per
restart, never under 100. Stats: `levels` (different levels cleared so far) and `gems` (in that level).

## Modes

- **Play online** (2 to 4, each on their own device; quick match, public/private rooms, invite links). The
  room keeps the party: favorite pals, the host's level, who runs which pal, the run counter and the team's
  points. With fewer people than pals, some run two and switch (Tab/Q or ⇄). Every device simulates its own
  pals and sends them 20 times a second; the host's game owns crates, levers, gems, deaths and the exit and
  sends world frames 12 times a second. If the host leaves mid-level, the next host carries on from its copy
  of the world. Live levels report no arcade score (like Crater Crew's live battles).
- **Solo**: pick a set and a level (each unlocks the next), run every pal yourself and switch.
- **Daily**: one seeded level for everyone (`hashString('prism-pals:' + day)`), solo, timed; share line with
  ⏱ time, 💎 gems and 🔁 restarts.
- **Friends' challenge**: one level from the seed (a daily challenge plays that day's daily level).

## Decisions

- Gaps up to 5 tiles are jumpable (coyote time helps), 7 never are; a jump climbs 2 tiles, never 3. Levels
  rely on those limits for walls and moats.
- Platforms move as a function of the level clock, so every device draws them in the same place without
  sending them; guests follow the host's clock.
- A guest pushing a crate drives it until it settles, and the host takes its word for that crate.
- Original names, critters, art and sounds; no other game's names or colors.
