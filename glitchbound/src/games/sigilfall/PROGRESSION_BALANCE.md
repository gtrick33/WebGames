# Sigilfall — Progression Balance (Blueprint V2.9 §5.3, Prompt 3)

Part 1 is **measured** from the source (`data/classes.ts`, `data/enemies.ts`, `sim/world.ts`, `sim/combat.ts`,
`progress/character.ts`, the quest table). Part 2 is the **proposal**. The blueprint makes this a design gate:
production numbers change only after the proposal is approved (EXECUTION_PLAN.md, Phase 3).

## Part 1 — What the game does today

### Level, XP and talent points

- Level cap **60**. XP to next level: `floor(40 · level^1.55 + 20)`; **526,582 XP** from 1 to 60.
- Talent points: **one per level from 10** (51 at 60). The specialization is chosen at 10 and takes the first 31
  points before the other two trees open (rows cost 5 points each, 7 rows).
- Respec: free below level 15, then `level × 25` gold. Changing specialization resets talents (same cost).

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
| Priest | **Grasp of Faith** (pull) | **Purify** (cleanse + heal) | **Chastise** (stun) | **Shadow Fiend** (summon) | **Sanctuary** (terrain: heal zone) |
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

## Part 3 — Migration

No id changes. Levels, XP, talents and bars load as they are. Over-levelled heroes stay over-levelled (we never take
levels away). Respec is offered free once after the rebalance ships, so changed talents can be re-chosen.
