# Gallows Keep's bosses of their own (2026-11-24)

Piece 2c of `src/games/sigilfall/NINE_PLAN.md`: the Hangman and Harlan Blackglove. (Gnasher, the keep's war-hound,
is not in this piece: the plan says why.) Pictures by `node scripts/sigilfall-boss-shots.mjs --boss hangman|varric`
on a phone's screen (844 × 390, touch), in each boss's own room of Gallows Keep with a level-15 warrior; the
`before-*` ones the same way on the branch this is built on.

| File | What it shows |
| --- | --- |
| `hangman-sheet.jpg`, `varric-sheet.jpg` | Every close-up of the fight on one sheet: the entrance, the line-up, each attack's wind-up and strike in every phase, each phase change, dazed, struck, the death; the last row is the boss as he was before |
| `<boss>/06-line-up.jpg`, `07-portrait.jpg` | Beside the hero and two soldiers at the size a phone shows them, and far closer than the game comes |
| `<boss>/before-06-line-up.jpg`, `before-07-portrait.jpg` | The same two pictures before this piece |
| `<boss>/NN-…-close.jpg` | The single close-ups the sheets are made of |
| `<boss>/shots.json` | What was pictured, and what the page reported (nothing, for both) |

## Who they are

**The Hangman, Headsman of the Gallows Gang.** "He hangs the people of Millbrook who can't pay the rope tax." A giant
bare to the waist under a headsman's black hood, the great axe in his hand, the second axe he takes up at half
health slung on his back, the rope coiled at his hip. Before: the pack's Barbarian, darkened, a person's size.

**Harlan Blackglove, King of the Gallows Gang.** A bandit who crowned himself: the gang's red, a black plate gauntlet
on his left arm with a hand too big for a man, a knife in each hand, and a crown of stolen gold with a shard of
rift-glass in its brow (the shard is what he drops first). Before: the pack's Survivalist with an axe.

## The numbers

| | The Hangman | Harlan Blackglove | The budget, or the rule |
| --- | --- | --- | --- |
| Triangles in the file | 11,135 | 7,690 (his crown is built in the browser on top) | 12,852 (`orc_brute`) |
| File | `k/boss_hangman.pack`, 141 KB | `k/boss_harlan.pack`, 98 KB | loaded with the keep |
| Skeleton | the large one | the medium one | one of the two shared |

`tests/sigilfall-bosses-own.test.ts` holds both to the budget, to a move for every attack the rules give them, to
their footprint against their radius, and to light on a small part of them only.


# Every boss moves (added 2026-11-25)

The owner, 2026-11-24: "check all the act 1 bosses whether theyre not just floating and have actual animations please,
animate them if they lack them and keep that in mind for any future boss."

What was wrong, on every boss that had not been through the pass: one swing for everything the rules had it do (a
throw, a roar, a call for help and a sweep were the same clip), four bosses on foot were drawn lifted off the ground,
and any boss that had once been dazed could stay in its "struck" pose for the rest of the fight.

What changed:

- **A move for every attack, on all 43 bosses.** `render3d/bossMoves.ts` reads each pattern for the kind of thing it
  is (a sweep, a blow down, a rush, a throw, a call, a roar, a vanishing, a guard, a pouring, a spell) and gives it the
  first clip of that kind the boss's own skeleton has. A boss that names its own moves keeps them. A future boss gets
  this without anyone remembering to, and `tests/sigilfall-bosses-move.test.ts` fails if one does not.
- **More clips where a skeleton had too few.** The great ones' skeleton (`rigs.pack`) gains a taunt, a kick, a stab, a
  bash, a block, a dodge and a slice from the pack's own files; the crab a tuck, a rearing, a leap and a low call; the
  wyrm a breath, a spit, a rearing and a roar; the drake a leap and a roar; the wolf a leap, a dig, a low stalk and a
  landing; the bull a kick and a lowering of the head. The 50 clips `rigs.pack` already had are byte for byte the same.
- **Gnasher** leaps into his charges, digs for his burrow and lowers himself to call the pack. His look is untouched.
- **Grimtusk** kicks for his stomp and lowers his head to roar and to call. **The Coffin Matron** stands on the floor.
- **On the ground.** The lift is gone from Vizier Khepset, Elowen of the Dawn, Lady Cendre and the Royal Auditor. Four
  bosses still drift, on purpose, and the test names them: Morgrave, the Rime Wyrm, Ilvane the Unmoored and the Herald
  in the Spire.
- **The struck pose that stuck** (`render3d/worldCast.ts`): a daze counted as still on after it had run out.
- The rules gained one field, `BossState.began`, so that the drawing knows an instant attack was made. No attack,
  number or timing moved.

## Checked in motion, in the browser

`node scripts/sigilfall-boss-shots.mjs --boss <id> --motion` puts the boss in its own room, lets it walk to the hero
with nothing else to do, then has it make each attack of each phase, reading its clip sixteen times a second and
taking six pictures a fifth of a second apart. `motion/<boss>/motion.jpg` is those strips (one row per state, the
whole phone screen in each frame); `motion/<boss>/motion.json` is what was read.

| Boss | Walking (moving readings in a walk or run) | Every attack has its own move |
| --- | --- | --- |
| The Hangman | 91 of 95 | yes |
| Harlan Blackglove | 81 of 85 | yes |
| Gnasher | 50 of 53, and 47 of 52 (two runs of the walk alone, `walk-alone.json`) | yes |
| Grimtusk | 58 of 66 | yes |
| The Coffin Matron | 91 of 93 | yes (her coffins rise while she is out of sight) |
| Morgrave | 59 of 59 | yes |
| Mother Clatterclaw | 83 of 88 | yes |
| The Rime Wyrm | 52 of 56 | yes |
| Gloomwing | 20 of 22 | yes |
| The Runewarden | 68 of 76 | yes |
| The Sun-King | 30 of 34 | yes |
| Vizier Khepset | 53 of 54 | yes |

Three things in those files that are the check's doing, not the boss's:

- Gnasher's full run (`motion/gnasher/motion.json`) says "never seen moving": in that run he stood through the walking
  part. Two runs of the walk alone both show him walking; I could not make the full run do it again and did not find
  why it happened once.
- The Rime Wyrm's file says its kit lifts it 0.6 off the ground. It is one of the four that fly; the check now knows.
- `grotto:shell`, `forge:bound` and `barrow:dark` "never began": the fight did not offer them in the time given. The
  test holds that each has a clip.

The other 31 bosses were not run in the browser. For them the test is the evidence: every attack resolves to a clip
that exists on the boss's skeleton and is not standing, walking or being struck.

## The move each attack takes

| Boss | Drawn with | Attack → clip |
| --- | --- | --- |
| `grimtusk` | `a_bull` (own moves) | `charge` → `chop`, `stomp` → `kick`, `gore` → `chop`, `roar` → `low`, `summon` → `low`, `tripleCharge` → `chop` |
| `coffin-matron` | `boss_matron` (own moves) | `crypt:coffins` → `summon`, `spell:seekers` → `cast`, `spell:cage` → `channel`, `summon` → `summon` |
| `ossric` | `boss_ossric` (own moves) | `crypt:candles` → `taunt`, `charge` → `bash`, `slam` → `chop2`, `spearFan` → `stab`, `summon` → `taunt`, `slamRings` → `chop2` |
| `morgrave` | `boss_morgrave` (own moves) | `soulVolley` → `cast`, `graveGrasp` → `channel`, `summon` → `summon`, `crypt:soul-split` → `summon`, `riftSpiral` → `channel`, `riftBeams` → `cast`, `teleport` → `dodge`, `collapse` → `channel`, `riftNova` → `summon` |
| `hangman` | `boss_hangman` (own moves) | `gallows:trapdoors` → `smash`, `cleave` → `spin`, `chop` → `chop2`, `hook` → `cast`, `roar` → `punch`, `volley` → `cast`, `gallows:hook-drop` → `cast` |
| `gnasher` | `a_wolf` (own moves) | `cleave` → `chop`, `charge` → `leap`, `gallows:burrow` → `dig`, `summon` → `low`, `tripleCharge` → `leap` |
| `varric` | `boss_harlan` (own moves) | `cleave` → `slice`, `volley` → `throw`, `tripleCharge` → `stab`, `summon` → `wave`, `gallows:hostages` → `cheer`, `vanish` → `dodge` |
| `the-drowned` | `sk_mage` | `spell:wall` → `channel`, `spell:undertow` → `channel`, `tide` → `channel`, `grotto:flood` → `channel`, `summon` → `summon` |
| `clatterclaw` | `crab` | `grotto:shell` → `tuck`, `grotto:pincers` → `chop`, `grotto:scuttle` → `leap`, `grotto:froth` → `rear`, `grotto:molt` → `rear`, `summon` → `low` |
| `saltbeard` | `survivalist` | `cleave` → `chop`, `volley` → `throw`, `kegs` → `throw`, `barrage` → `throw`, `grotto:black-spot` → `throw`, `summon` → `summon` |
| `brother-pustule` | `cleric` | `cleave` → `slice`, `rot:miasma` → `channel`, `rot:leeches` → `summon`, `hook` → `throw`, `summon` → `summon`, `spell:split` → `dodge`, `spell:sequence` → `channel` |
| `old-sluicegut` | `frost_golem` | `rot:sluices` → `cast`, `slam` → `chop2`, `chop` → `chop2`, `summon` → `cast`, `slamRings` → `chop2` |
| `the-rot-mother` | `monstrosity` | `rot:bile` → `punch`, `rot:breath` → `cast`, `rot:pour` → `cast`, `spell:bouncers` → `punch`, `summon` → `cast`, `rot:swell` → `cast`, `tide` → `cast`, `roar` → `punch`, `rot:drag` → `punch` |
| `the-runewarden` | `golem` | `forge:bound` → `cast`, `forge:runes` → `cast`, `slam` → `chop2`, `spearFan` → `punch`, `charge` → `punch`, `roar` → `punch`, `slamRings` → `chop2`, `summon` → `cast` |
| `slag-colossus` | `golem` | `chop` → `chop2`, `forge:slag` → `chop2`, `stomp` → `chop2`, `forge:shed` → `chop2`, `forge:harden` → `cast`, `slamRings` → `chop2` |
| `forgemaster-grold` | `sk_golem` | `cleave` → `smash`, `forge:quake` → `chop2`, `forge:pour` → `cast`, `forge:blades` → `smash`, `summon` → `cast`, `forge:bellows` → `punch`, `slamRings` → `chop2`, `roar` → `punch` |
| `gloomwing` | `fbx_trex` | `barrow:dark` → `roar`, `barrow:feast` → `roar`, `spell:rain` → `chop`, `charge` → `leap`, `spell:hurl` → `chop`, `tripleCharge` → `leap` |
| `king-hrodric` | `sk_king` | `cleave` → `chop`, `chop` → `chop2`, `barrow:frost-pulse` → `channel`, `summon` → `summon`, `roar` → `taunt`, `barrow:whirl` → `chop` |
| `sir-corvane` | `black_knight` | `barrow:steed-charge` → `punch`, `cleave` → `chop2`, `spell:lances` → `punch`, `spell:halves` → `chop2`, `summon` → `cast`, `barrow:dismount` → `spin`, `barrow:doom` → `smash`, `barrow:rime` → `cast`, `chop` → `smash`, `roar` → `punch`, `barrow:aura` → `cast`, `vanish` → `spin`, `tripleCharge` → `punch` |
| `vizier-khepset` | `witch` | `tomb:hourglass` → `channel`, `spell:sinkhole` → `chop2`, `summon` → `summon` |
| `the-sand-warden` | `sk_golem` | `cleave` → `chop`, `chop` → `chop2`, `tomb:quicksand` → `cast`, `tomb:sandsweep` → `chop`, `tomb:crumble` → `chop2`, `slamRings` → `chop2` |
| `the-sun-king` | `sk_necro` | `cleave` → `slice`, `tomb:sunbeam` → `channel`, `tomb:sun-disc` → `channel`, `volley` → `throw`, `tomb:scarabs` → `summon`, `roar` → `taunt`, `spell:orbit` → `channel`, `tomb:pyre` → `channel`, `spell:sunspot` → `throw` |
| `jarl-hrimfang` | `barbarian_large` | `cleave` → `chop2`, `rime:shatter` → `smash`, `rime:boulder` → `punch`, `rime:warcry` → `punch`, `tripleCharge` → `punch`, `chop` → `smash` |
| `hallvor-the-unthawed` | `paladin` | `rime:orders` → `summon`, `cleave` → `chop2`, `chop` → `spin`, `spell:pin` → `spin`, `summon` → `summon`, `tripleCharge` → `bash` |
| `the-rime-wyrm` | `wyrm` | `rime:breath` → `breath`, `cleave` → `chop`, `rime:gust` → `breath`, `rime:icicles` → `spit`, `rime:flight` → `rear`, `rime:frost` → `breath`, `summon` → `roar`, `roar` → `roar`, `rime:storm` → `breath` |
| `the-siege-breaker` | `siege_ram` | `siege:ram` → `bash`, `cleave` → `chop`, `siege:pitch` → `throw`, `volley` → `throw`, `slamRings` → `chop2`, `siege:torch` → `throw`, `summon` → `summon`, `roar` → `taunt` |
| `prior-vessant` | `sk_necro` | `siege:fallen` → `summon`, `summon` → `summon`, `spell:drain` → `throw`, `spell:mines` → `throw`, `cleave` → `slice`, `siege:dirge` → `taunt` |
| `general-morvain` | `black_knight` | `siege:banner` → `cast`, `siege:squad` → `cast`, `siege:arrows` → `punch`, `cleave` → `chop2`, `chop` → `smash`, `roar` → `punch`, `siege:deathcharge` → `punch`, `siege:guard` → `cast`, `siege:last-volley` → `punch` |
| `rotwood-colossus` | `treant` | `cleave` → `smash`, `blight:topple` → `chop2`, `blight:pods` → `cast`, `slamRings` → `chop2`, `chop` → `chop2`, `summon` → `cast`, `roar` → `punch`, `blight:taproot` → `chop2` |
| `elowen-of-the-dawn` | `witch` | `blight:twins` → `summon`, `spell:tether` → `channel`, `cleave` → `slice`, `roar` → `taunt` |
| `the-withered-queen` | `vampire` | `summon` → `summon`, `blight:briar` → `channel`, `blight:kiss` → `throw`, `volley` → `throw`, `cleave` → `slice`, `roar` → `taunt`, `blight:garden` → `summon`, `blight:spores` → `channel`, `blight:wither` → `channel`, `chop` → `chop2` |
| `magma-warden` | `golem` | `cleave` → `smash`, `throne:eruption` → `chop2`, `throne:pour` → `cast`, `slamRings` → `chop2`, `barrage` → `punch`, `roar` → `punch`, `throne:core` → `cast`, `summon` → `cast` |
| `ossa-the-founder` | `sk_golem` | `throne:likeness` → `cast`, `cleave` → `smash`, `chop` → `chop2`, `spell:pools` → `cast`, `roar` → `punch`, `summon` → `cast` |
| `ashkar-the-bound` | `golem` | `throne:shackles` → `cast`, `cleave` → `smash`, `throne:taut` → `punch`, `volley` → `punch`, `barrage` → `punch`, `throne:forge` → `cast`, `roar` → `punch`, `throne:tear` → `smash`, `throne:flail` → `smash`, `hook` → `punch`, `throne:eruption` → `chop2`, `throne:crown` → `cast`, `throne:lake` → `cast`, `throne:inferno` → `cast` |
| `veil-sentinel` | `golem` | `spire:prism` → `cast`, `cleave` → `smash`, `chop` → `chop2`, `spire:gravity` → `cast`, `charge` → `punch`, `summon` → `cast`, `roar` → `punch`, `spell:crossfire` → `cast` |
| `ilvane-the-unmoored` | `witch` | `spell:meteors` → `throw`, `spell:constellation` → `channel`, `cleave` → `slice`, `spire:unmoor` → `dodge`, `roar` → `taunt` |
| `herald-in-the-spire` | `vampire` | `volley` → `throw`, `spire:tear` → `slice`, `spell:blink` → `dodge`, `spire:echoes` → `summon`, `spire:sunder` → `slice` |
| `lady-cendre` | `witch` | `dusk:vigil` → `block`, `spell:ring` → `channel`, `spell:grief` → `channel`, `cleave` → `slice`, `roar` → `taunt` |
| `hollow-guard` | `black_knight` | `dusk:oath` → `cast`, `cleave` → `chop2`, `chop` → `smash`, `hook` → `punch`, `roar` → `punch`, `tripleCharge` → `punch` |
| `vaelor` | `vaelor` | `king:court` → `cast`, `dusk:hollowing` → `cast`, `spell:pendulum` → `chop2`, `spell:vortex` → `cast`, `king:rise` → `cast`, `king:sigil` → `cast`, `dusk:chains` → `chop2`, `dusk:harvest` → `chop2`, `roar` → `punch`, `king:call` → `cast`, `cleave` → `chop2`, `chop` → `smash`, `spell:fissure` → `smash`, `king:remembered` → `cast`, `dusk:frost-ring` → `cast`, `spell:pulse` → `cast`, `dusk:toll` → `smash`, `king:summer` → `cast`, `spell:eclipse` → `cast`, `dusk:ghouls` → `cast`, `dusk:doom` → `smash`, `tripleCharge` → `punch` |
| `silas-vey` | `rogue_hooded` | `crown:scatter` → `throw`, `spell:boomerang` → `throw`, `cleave` → `chop` |
| `the-royal-auditor` | `cleric` | `crown:ledger` → `block`, `spell:quills` → `throw`, `cleave` → `slice`, `crown:settle` → `block` |
| `maelis-crane` | `cleric` | `spell:gild` → `channel`, `summon` → `summon`, `roar` → `taunt` |
