# Sigilfall — Progression Balance (Blueprint V2.9 §5.3, Prompt 3)

Part 1 is **measured** from the source (`data/classes.ts`, `data/enemies.ts`, `sim/world.ts`, `sim/combat.ts`,
`progress/character.ts`, the quest table). Part 2 is the **proposal**. The blueprint makes this a design gate:
production numbers change only after the proposal is approved (EXECUTION_PLAN.md, Phase 3).

## Part 1 — What the game does today

### Level, XP and talent points

- Level cap **60**. XP to next level: `floor(40 · level^1.55 + 20)`; **526,582 XP** from 1 to 60.
- Talent points: **one per level from 10** (51 at 60). The specialization is chosen at 10 and takes the first 31
  points before the other two trees open (rows cost 5 points each, 7 rows).
- Respec: free below level 20, then `level × 10` gold (at most 400; Part 2, D). Changing specialization resets
  talents (same cost).

| Level | XP to next | Cumulative | Talent points | Ultimate floor (s per full bar) |
| --- | --- | --- | --- | --- |
| 1 | 60 | 60 | 0 | 1.5 |
| 5 | 504 | 1,302 | 0 | 1.5 |
| 10 | 1,439 | 6,488 | 1 | 1.5 |
| 15 | 2,680 | 17,296 | 6 | 1.5 |
| 20 | 4,175 | 35,088 | 11 | 1.5 |
| 25 | 5,893 | 61,033 | 16 | 2.75 |
| 30 | 7,811 | 96,174 | 21 | 4 |
| 35 | 9,913 | 141,464 | 26 | 5.25 |
| 40 | 12,188 | 197,788 | 31 | 6 |
| 45 | 14,626 | 265,979 | 36 | 6 |
| 50 | 17,217 | 346,821 | 41 | 6 |
| 55 | 19,955 | 441,062 | 46 | 6 |

### XP sources

- **Kills**: `def.xp × (1 + 0.15·(level−1)) × tier × (elite 4) × (raised minion 0.25) × (rift mods) × (wild 0.5)`.
  Enemy base XP is 3–22 (most 9–14).
- **Quests**: 296 quests, **377,705 XP** in all (story quests 31,015). Per zone, in level order:

| Zone | Levels | Quests | Quest XP | XP to cross the band |
| --- | --- | --- | --- | --- |
| Whisperwood | 2–6 | 1 | 140 | 1,242 |
| Brackenridge | 5–10 | 14 | 1,850 | 4,251 |
| Thornvale | 8–14 | 17 | 5,880 | 9,406 |
| Greyfen | 11–17 | 14 | 5,980 | 13,768 |
| Saltmarsh | 14–20 | 16 | 9,850 | 18,707 |
| Amberfield | 16–22 | 16 | 9,830 | 22,294 |
| Duskfen | 18–24 | 15 | 11,260 | 26,102 |
| Ironpeak | 20–26 | 15 | 13,050 | 30,120 |
| Ashen Barrows | 23–29 | 14 | 15,750 | 36,524 |
| Stormwatch | 26–32 | 16 | 18,900 | 43,358 |
| Grimward | 29–35 | 17 | 22,100 | 50,600 |
| Sunscorch | 30–36 | 17 | 23,050 | 53,101 |
| Glimmerwood | 31–37 | 16 | 24,500 | 55,645 |
| Rimeheld | 33–39 | 16 | 26,500 | 60,859 |
| Shattered Vale | 35–41 | 18 | 28,850 | 66,237 |
| Sablewind | 37–43 | 16 | 31,000 | 71,776 |
| Vinecoil | 39–45 | 14 | 33,500 | 77,473 |
| Highwall | 40–46 | 15 | 64,700 | 80,379 |

Bands overlap, so a player crosses them in sequence, not one band per zone. A model of a completionist (every quest
in level order plus ~170 kills per zone) reaches the zone floors **ahead** of schedule: Grimward (29–35) entered at
about 31–35, Highwall (40–46) at about **47–52**. **The failure today is over-levelling for completionists**, not a
grind wall. A main-story-only player (chain quests only) has not been measured yet: the Phase 3 simulation does it.

### Skills (spells)

Every class has **six skills** (unlocking at levels 1, 2, 4, 6, 14, 22), a specialization ability at 10, the
ultimate at 3, a basic attack and a dodge. With the fourth slot (shipped in `0fc10e2b`), the bar is full at level
6 and stays a non-choice until 14. **Nothing new unlocks between level 22 and 60** — a 38-level dead stretch.

### Ultimate charge

A hit worth the class's reference damage adds 1/30 of the bar (direct hits ×1, secondary hits ×0.5, DoT ticks
×0.4, rate ×(1 + ultCharge%)). It is capped by a **budget** that refills one full bar per **ultFloor** seconds:
`clamp((level − 14) · 0.25, 1.5, 6)`. So any build that lands enough damage can cast its ultimate **every 1.5 s at
level 10 and every 6 s at level 40+**. Multi-target hits each count. This is the ultimate spam the blueprint names.

### Difficulty and gear

Heroic and Mythic are hero-wide unlocks (`heroic`, `mythic` quests on the crypt): +6 and +12 enemy levels,
×1.3/×1.6 XP, ×1.5/×2.2 loot. Gear: hand-made uncommon–legendary items, generated common–rare; epic and legendary
drops are always hand-made; the Sigil Quartermaster sells epics from level 15.

## Part 2 — Proposal (for approval)

### A. XP curve: keep the formula, rebalance the sources

Keep `xpToNext` and the cap (saves, item levels and enemy bands depend on them). Rebalance where XP comes from:

| Source | Share of a region's band XP (target) | Change |
| --- | --- | --- |
| Main-story chain quests + the region's dungeon bosses | **60–65 %** | chain quests marked `main` get a per-zone multiplier so a main-story-only player enters every next region at its floor level |
| Side quests | **20–25 %** | side-quest XP × ~0.6 (it is ~2× too generous today) |
| Kills | **10–15 %** | unchanged formula |

Targets: **main story only** — enter each required region at its floor (±1); **everything** — never more than
**+3** over a region's floor; skipping all side content never needs grinding. Verified by a campaign simulation
(new `tests/sigilfall-progression.test.ts`) that walks the main path and the full path and asserts both targets.

### B. Spell unlock cadence (the dead stretch)

Five new skills per class, chosen for **utility and control**, not only damage (blueprint §5.2 list):

| Level | Unlock | Purpose |
| --- | --- | --- |
| 1, 2, 4, 6 | existing | the core kit |
| **9** | new skill 1 | the first real choice (5 skills for 4 slots) |
| 10 | specialization ability | |
| 14 | existing | |
| **18** | new skill 2 | |
| 22 | existing | |
| **28** | new skill 3 | |
| **36** | new skill 4 | |
| **46** | new skill 5 | late build-defining skill |

By level 46 a hero knows **12 skills for 4 slots**. Proposed kits (ids new; names original, not borrowed):

| Class | 9 | 18 | 28 | 36 | 46 |
| --- | --- | --- | --- | --- | --- |
| Warrior | **Hookchain** (pull an enemy to you) | **Rallying Roar** (shield + cleanse) | **Ground Breaker** (leap: mobility strike) | **Last Word** (execute) | **Challenge** (taunt ring: enemies turn on you, allies freed) |
| Mage | **Gravity Well** (terrain zone that pulls) | **Purge** (cleanse + short ward) | **Mirror Self** (decoy that draws attacks) | **Frost Ring** (root zone) | **Starfall Lance** (piercing execute beam) |
| Ranger | **Grapple Line** (mobility to a point) | **Tar Pit** (slowing terrain) | **Snare Net** (root + pull) | **Finishing Shot** (execute) | **Hawk Call** (summon) |
| Paladin | **Oath Chain** (pull + taunt) | **Cleansing Light** (cleanse + heal) | **Bulwark** (dome shield) | **Sentence** (execute strike) | **Dawn Leap** (mobility strike) |
| Priest | **Grasp of Faith** (pull) | **Purify** (cleanse + heal) | **Chastise** (stun) | **Dusk Shade** (summon) | **Sanctuary** (terrain: heal zone) |
| Warlock | **Soul Tether** (pull + drain) | **Dark Pact** (shield from health) | **Shadow Snare** (stun zone) | **Harvest** (execute) | **Gate Step** (blink + portal back) |
| Druid | **Gale** (knockback wave) | **Thornhide** (shield + thorns) | **Vine Vortex** (pull zone) | **Bloom** (cleanse + heal zone) | **Stampede** (mobility strike) |

Every new skill gets **at least two talent mutations** in its tree (projectile count, element, radius, status,
cooldown or follow-up). Engine additions needed: `cleanse` effect (removes the hero's statuses), `taunt` effect
(enemies in range target the hero/its companions for a few seconds), `execute` (already: `bonusVs: lowHp`),
`decoy` (a summon with taunt). **Partial CC on bosses**: stun/root/fear on a boss become a 50 % slow for a third of
the duration, with a 6 s immunity after each.

### C. Talent cadence

Keep one point per level from 10 and every talent id (saves keep their points). Rationale: levels 1–9 now bring a
new skill every one or two levels (1, 2, 3 ult, 4, 6, 9) and the specialization at 10; points then arrive every
level for the rest of the campaign, and the spec tree's capstone (row 7, 30 points) lands at level 39, Act III's
climax. No dead stretch remains once B ships.

### D. Respec

Talents: **free at any inn below level 20**, then `level × 10` gold, capped at **400**. Changing specialization
keeps today's rule (resets talents) at the same price. Skills on the bar are always free to swap (they are).

### E. Ultimate frequency

- Replace the floor with a **minimum time per full bar**: **20 s** at level 3, rising to **28 s** at 30 and **32 s**
  at 50+ (the budget refills at that rate; it never stores more than one bar's worth).
- Normalize charge at the **hit layer**: per cast, the first enemy hit counts ×1, every further enemy ×0.35;
  DoT ticks ×0.25; companions' hits ×0.5; chained/split/proc hits ×0.4; hits during the ultimate itself ×0.
- Target: a normal build earns its ultimate in **30–45 s of sustained combat**; a 2–3 minute boss allows 3–5.
- Benchmark: the play-bot fights a dummy pack for 120 s with each class's default build and a multi-hit/DoT build;
  the test asserts 2–5 ultimates for every class.

### F. Gear steps

Authored rewards at chain ends and dungeon bosses stay the gear steps; world drops cap at one gear piece per pack on
Normal (loot clutter, Section 8). Act milestones get one guaranteed rare-or-better item.

### G. Endgame gates (explicit, never hidden)

- **Heroic**: finish the Prologue and reach level 12 (the `heroic` quest, Heroic Chapel Crypt).
- **Mythic**: clear the Chapel Crypt on Heroic and reach level 17 (the `mythic` quest).
- Both shown in the quest log with their requirements from the moment they exist.

## Part 2½ — What shipped

- **A (XP)**: main story = everything the act-ending chains need (`data/progression.ts`, MAIN_STORY_ENDS);
  main rewards scaled per region (MAIN_XP, fitted by a campaign model), side quests ×0.6, and quests/kills
  well below the hero pay less (−20 % per level past a grace of 1/2, floor 20 %). The model
  (`tests/sigilfall-progression.test.ts`) asserts: main-story-only enters every region at its floor ±1;
  a completionist stays inside every region's band. The proposal's "+3" was not reachable without
  starving side content; staying inside the band (≤ +6) is the shipped target.
- **D (respec)**: free below 20, then level × 10 gold up to 400; one free respec for every hero with spent
  points (save v7).
- **E (ultimate)**: 20 s per bar at 3 → 28 s at 30 → 32 s at 50+; per-step hit normalization (first enemy
  ×1, further ×0.35, chained/split ×0.4, DoT ×0.25, the ultimate's own hits ×0); per-class `ultRate`
  (priest 1.8, paladin/ranger 1.35, druid 1.3). Benchmark: every class earns 2–5 ultimates in 120 s.
- Found on the way: a specialization now takes the other specs' druid forms off the bar (a Balance
  druid had Lynx Shape slotted instead of a spell); the Chapel Crypt is levels 5–7 (the Prologue's).
- **B (the dead stretch)**: shipped as proposed, 35 skills (five per class at 9, 18, 28, 36, 46) with 70
  talent mutations (two each, in free cells of the matching tree, never in a capstone row). One rename:
  the Warlock's 18 is **Blood Pact** (the kit already had a Dark Pact). New engine pieces: `cleanse`,
  `taunt` and `yank` effects, ground that drags (`pull`) or mends the hero (`heal`), `thorns` on buffs, a
  blink that returns (`recall`), and the mirror image, hawk and shadow fiend companions.
- **Partial control on bosses**: stun, freeze, root and fear on a boss become a 50% slow for a third of the
  time, then 6 s of immunity.
- Not yet: F (gear steps) and G (gates shown in the log) stay as they are.

## Part 3 — Migration

No id changes. Levels, XP, talents and bars load as they are. Over-levelled heroes stay over-levelled (we never take
levels away). Respec is offered free once after the rebalance ships, so changed talents can be re-chosen.

## Part 3 — Loot clutter (blueprint Prompt 11)

Measured with the play-bot (a warrior in rare gear, five minutes of fighting, about 210 kills):

| Zone | Items before | Items after | Plain (common) pieces after |
| --- | --- | --- | --- |
| Thornvale (level 9) | 22 | 15 | 0 |
| Duskfen (level 20) | 19 | 11 | 0 |
| Glimmerwood (level 33) | 21 | 13 | 1 (an elite's) |

The rank and file's plain pieces, and one roll in five of their other drops, now come as a coin worth the
piece's salvage value; elites, chests, bosses and quest rewards drop as before. The random sequence of a fight
is unchanged, so every play-through stays as it was. Story and dungeon rewards (hand-made items, boss
first-kill items, mounts, Wardrobe looks) are untouched, so they stand out more against fewer random drops.

## Part 4 — Specializations side by side (2026-11-10)

Measured with the play-bot: a level-45 hero in rare gear with every talent point spent (its own tree first), 40
seconds on a target that never dies with two more beside it, two seeds, the default bar (the first three skills
learned and the specialization's own). Damage a second on the one target:

| Class | Tree 1 | Tree 2 | Tree 3 |
| --- | --- | --- | --- |
| Warrior | Berserker 9,372 | Guardian 5,211 | Weaponmaster 18,073 |
| Mage | Pyromancer 9,312 | Stormcaller 4,416 | Cryomancer 2,879 |
| Ranger | Deadeye 8,198 | Trapper 11,592 | Beastmaster 5,170 |
| Paladin | Dawnkeeper 8,401 | Shieldbearer 6,507 | Zealot 14,254 |
| Priest | Aegis 4,562 | Lumen 4,116 | Umbral 5,589 |
| Warlock | Hexer 4,486 | Binder 4,028 | Doomcaller 1,804 |
| Druid | Starseer 3,527 | Wildclaw 2,842 | Bearward 1,953 |
| Gloamknight | Bloodsworn 5,331 | Ruinblade 6,878 | Dreadbinder 5,768 |

What the table can and can't say:

- The bot plays a fighter's kit about as well as a person: instant blows, pressed as they come ready. It plays
  casters badly. It never takes a druid's shape (so Wildclaw and Bearward above are a druid casting Wrath), it
  breaks its own long casts by walking, and it re-summons a demon it already has. A caster's low number is partly
  the bot's.
- The bar matters as much as the tree. A Cryomancer on the default bar is casting Fireball; on four frost skills
  it did no better (2,207). That one is the kit's, not the bot's.
- Two fighters stood well clear of the rest of their own classes under the same play: Weaponmaster (almost twice a
  Berserker) and Zealot.

What changed with this measurement:

- Weaponmaster: Deep Wounds bleeds for 20% of the hit a second (was 30%), and Open the Wound lands what bleeding is
  left without the half again on top. 18,073 to 14,209.
- Zealot: Twin Edict 34 damage (was 40). 14,254 to 13,626: the tree, not the skill, carries it, so this is a
  first step.
- Cryomancer: Ice Javelin 28 (was 20), Ice Storm 9 a tick (was 6), Shatter +40% to Frozen and +20% to Chilled
  (was 25 and 10). 2,207 to 2,813 on the frost bar: still the lowest damage tree in the game.
- Doomcaller: Ruin Bolt casts in 1.1 s (was 1.5). 1,804 to 2,419.

Still open, and wanting the owner's say before the numbers move again: whether tank and healer trees should
close most of the gap for solo play, Cryomancer's damage, and the casters as a group against the fighters. A
bot that takes a shape and holds a cast would make the druid's and the warlock's rows mean something.

## Part 5 — Dungeons against the road (2026-11-12)

The owner's call after the first full play-through: every dungeon a little harder, the first one a little easier.

Measured first, with the play-bot at the level the story brings a hero in (the low end of each dungeon's range, in
what drops by then), four classes, three runs each. The early dungeons already cost it falls; from the Rimeheld
Vault on it walked every one without a fall, often never under half its health. So the step grows with depth
(`depth` in sim/world.ts, beside `challenge`, and like it only on Normal: Heroic, Mythic and Riftstone keep their own
measure):

| Dungeon | Level | Damage | Health |
| --- | --- | --- | --- |
| The Chapel Crypt | 4 | −5% | as it was |
| Gallows Keep, the Smugglers’ Grotto, the Rotmother’s Cistern, the Deepforge Halls | 14–26 | +3% | +2% |
| The Barrow of Kings | 29 | +4.5% | +3% |
| The Tomb of the Sun King | 35 | +7.5% | +6% |
| The Rimeheld Vault | 39 | +9.5% | +7% |
| The Siege of Highwall | 44 | +12% | +9.5% |
| Blightheart, the Molten Throne, the Spire, Duskspire, the Catacombs | 52–60 | +15% | +12% |

Everything in the dungeon carries it, packs and bosses alike. The same bot afterwards: the late bosses take 5 to 13%
longer and it falls now and then where it never did (the Siege 0.4 to 1.5 falls a run, the Spire 0 to 1.3); the early
dungeons are where they were; the Crypt costs it a little less (10.3 to 9.6 falls a run across the four classes, its
mage and paladin still the ones that cannot do it at level 4). Every class still clears every dungeon inside the six
falls the dungeon tests allow.

A first cut that started the growth at level 10 (5% and 4% at Gallows Keep) broke the bot's mage in the Deepforge
Halls and then in the Cistern: the early dungeons have no room to give, which is why they got the smallest step.

## Part 6 — A harder game (2026-11-15)

The owner, at level 34: "with my 34 mage i managed to complete the tomb of the sun king without wasting a single
potion, none of the bosses' abilities mattered if it hit me, im nuking all the smaller mobs almost with one shot". And:
"scale down the dmg for every class ... we want every boss, every mob to feel challenging and intimidating with huge
damage spike".

Measured first, with the play-bot through every dungeon (four classes, the level the test plays, the gear a player has
by then): it cleared all but one dungeon without a fall, its median lowest health in a run was 42%, and the biggest
blow it took averaged a fifth of its health (14 to 22% in the Tomb of the Sun King). A level 34 mage in blue gear
cleared a pack of three Sunscorch mummies (13,900 health) in 1.2 seconds. The owner's own mage had 1,360 health at
34, more than a full set of epics gives (1,082): gear bought with gold the road paid too much of.

What changed:

| | Before | Now |
| --- | --- | --- |
| Every hero's blows (`data/classes.ts` HERO_DAMAGE) | ×1 | ×0.5 from level 14 (×1 at level 4, growing between); every class and every kind of blow alike, so the classes and trees stand as they did. The ultimate is measured against it and fills as fast as it did. |
| A boss's health, and everything in its room (`sim/world.ts` BOSS_HEALTH) | ×1 | ×0.5: its fight lasts as long as it did. A boss's own clock (leeches that drink, adds that come, a ward to break) was set against fights of that length. |
| A boss's blows (BOSS_DAMAGE) | ×1 | ×1.5 by level 30 (×1 at level 4) |
| The least a boss's blow takes (`sim/combat.ts` BLOW_FLOOR) | none | a quarter of the hero's health for each time over the boss's damage it hits (a cleave of 1.5: 37%; the Sun King's beam of 1.2: 30%), after armor, before walls and shields; never more than 60% |
| A boss's barrages, the ground it leaves, the burns and poisons it lays | — | as they were: raised with the rest, they were what the bot died to dozens of times over, a chip at a time |
| The rank and file (MOB_DAMAGE) | ×1 | ×1.5 from level 14; those in a boss's room ×1 |
| The blows they wind up for (`sim/ai.ts` SPIKE: a caster's circle, a brute's slam, a charger's rush, a swell about to burst) | ×1 | ×1.8 on top |
| Riftstone | — | its own measure: health to match the halved blows, the old damage (its clocks, KEY_PARS, were set against the old blows) |

The same bot afterwards (14 dungeons × 8 classes, first seed): the biggest blow it took averages a third of its health
(31 to 37% in the Tomb, the warrior and the paladin as much as the mage, where they took 9 to 14% before); its median
lowest health is 28% (42%); runs that drank every potion went from 9 to 27. It clears every dungeon with every class
inside the falls the dungeon tests allow, which are twelve now (six): its mage and druid fall in the last dungeons where
a player would not (it walks out of its own long casts). Two dungeons only a Riftstone run reaches now (the Rotmother's
Cistern and the Deepforge Halls) are still tested on Normal, in green gear.

First tries that didn't hold: boss damage ×2.6 with the fight twice as long (the bot fell 44 times to the Sun King; the
early dungeons could not be cleared at all); ×2.2 with fights a fifth longer (the Rot Mother's leeches drank faster than
any hero could kill her; Duskspire's adds came without end). What a fight takes out of a hero is how hard it hits times
how long it lasts, and a boss's mechanics are timed: the fights keep their length, and the blows carry the change.

Gold (`data/vendors.ts` GOLD_FIND): the road pays a quarter of what it did: coins from foes and chests, the purse in place
of a piece of gear, quest gold, what a piece melts down or sells for, and a potion a full belt has no room for. What
things cost is unchanged (a vendor's gear is four times a piece's worth, the quartermaster, potions, a respec), so a
purchase is a choice again.
