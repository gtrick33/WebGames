# Sigilfall: the pass to 9/10 before player testing (2026-11-24)

The owner's brief (2026-11-24): an outside review put the game at about 7.5/10, and real players start testing when
this pass is done. Two things matter equally: the game gets visibly better, and nothing that works today breaks.

This file is how the work is picked up between sessions. It lists each piece, its branch, what it touches and what it
depends on, and keeps the baseline the later pieces are measured against. **The status table is kept current as pull
requests open.**

## What keeps the game from 9 (the review)

1. Bosses that don't look like bosses: most are a soldier's model scaled up, with horns, a halo or glowing eyes added
   (the `boss()` helper in `render3d/kits.ts`).
2. Quests below the Prologue's standard: about 91 of the 218 are only walking somewhere and talking (POLISH_PLAN.md,
   piece 19).
3. Sound: 25 stock tracks by Kevin MacLeod, and effects chosen by description and loudness, never by ear.
4. The signature system (gear that changes how a skill works) shows up late and small: the first boss's guaranteed
   epic, Static Band, adds an effect on critical hits and changes no skill.
5. An uneven finish from act to act.
6. Rough edges a new player sees: a hint card over Mara's speech in the first fight; "Both can be changed any time in
   Settings" when only one choice is shown (`ui/Title.tsx`); a small game area on desktop inside the site page.
7. Never run on a phone or a slow connection.

## Where each piece stands

| # | Piece | Branch | Pull request | State | Needs first |
| --- | --- | --- | --- | --- | --- |
| 1 | Baseline and plan | `claude/sf9-baseline` | #355 | open | nothing |
| 2a | Boss pipeline and the Coffin Matron | `claude/sf9-boss-matron` | #356 | open | 1 (#355) |
| 2b | Bosses: the Prologue (Ossric, Morgrave, Grimtusk) | `claude/sf9-bosses-prologue` | (this one) | open | 2a (#356) |
| 2c | Bosses: Act I (Gallows Keep) | `claude/sf9-bosses-act1` | | not started | 2a |
| 2d | Bosses: Act II (the Barrow of Kings, the Crown Catacombs) | `claude/sf9-bosses-act2` | | not started | 2a |
| 2e | Bosses: Act III (the Tomb of the Sun King, the Vault of Rime) | `claude/sf9-bosses-act3` | | not started | 2a |
| 2f | Bosses: Act IV (the Siege of Highwall) | `claude/sf9-bosses-act4` | | not started | 2a |
| 2g | Bosses: Act V (the Molten Throne) | `claude/sf9-bosses-act5` | | not started | 2a |
| 2h | Bosses: the finale (Duskspire) | `claude/sf9-bosses-finale` | | not started | 2a |
| 2i | Bosses: the rest (the Rift's five other dungeons, the lands' named foes) | `claude/sf9-bosses-rest` | | not started | 2a |
| 3 | The signature system in the first twenty minutes | `claude/sf9-first-epic` | | not started | 1 |
| 4 | Quests up to the Prologue's standard, one pull request per act | `claude/sf9-quests-act1` … `-act6` | | not started | 1 |
| 5 | Sound with its own character | `claude/sf9-sound-mix`, `-music`, `-voices` | | not started | 1 |
| 6 | One standard, act by act | `claude/sf9-standard-act1` … `-act6` | | not started | 2, 4 (the same act's) |
| 7 | Phone and network readiness | `claude/sf9-phone` | | not started | 1 |
| 8 | The rough edges | `claude/sf9-rough-edges` | | not started | 1 |
| 9 | Ready for players | `claude/sf9-playtest` | | not started | 1 |
| 10 | The release bar | `claude/sf9-release` | | not started | all of them, merged |

Every branch is cut from `origin/pre-release` in its own worktree. A piece that needs an earlier one that hasn't merged
yet is built on that branch instead, and its pull request says which to merge first.

## Rules for every piece

The repository's rules (`CLAUDE.md`) hold for all of it. In short, and what this pass adds:

- One branch and one pull request per piece, `claude/sf9-<topic>`, in its own worktree
  (`git worktree add <dir> -b claude/sf9-<topic> origin/pre-release`). Never a branch checked out in the shared
  checkout. Never merge, never auto-merge, never push to `pre-release`: the owner reviews and merges.
- Commit by explicit pathspec. Never `prettier --write`. Player-facing text in American English.
- Before each pull request, in `glitchbound/`: `npm run typecheck`, `npm run lint`,
  `npx vitest run --no-fsModuleCache`, `npx vite build && node scripts/build-games.mjs && node scripts/size-report.mjs`.
  Then the change is looked at in the browser, with screenshots in `docs/review/sf9-<topic>/`.
- The pull request (`gh pr create --base pre-release`, titled `GlitchBound: …`) says what changed, how it was
  checked, and what wasn't verified.
- **Saves.** Old saves keep loading. Any change to quest ids, items or save fields comes with a save migration and a
  test, and `tests/sigilfall-save-fixtures.test.ts` still passes with the fixture files untouched.
- **Shared code.** The Ring, The Vigil, the Riftstone and co-op share code with the campaign and keep working.
- **Legal.** No other game's names, art, characters, item sets or signature colors. New names go in
  `LEGAL_REVIEW.md`; every pack used goes in `CREDITS_AND_LICENSES.md` and `LEGAL_REVIEW.md`.
- **Voices.** No synthetic or AI-generated voices (the owner, 2026-11-19).
- **Stop and ask the owner when** an asset's license is unclear or doesn't allow the use, a change would cut a story
  beat, a save can't be migrated cleanly, or something would touch other games or the site's shared pages.
- **Out of scope:** splitting `engine.ts` and `sim/world.ts`; new classes, modes or systems; endgame balance beyond
  fixes; the shop and prices; anything already decided (Heroic and Mythic stay removed). A bug found outside these
  pieces gets its own small pull request, or is listed for the owner.

## The regression bar (what "intact" means)

Measured at the start (the baseline below) and again before every pull request. Nothing on it may get worse.

| What | How it is measured |
| --- | --- |
| Every check passes; no test skipped, loosened or deleted | the four commands above |
| Every class's bot clears every dungeon | `tests/sigilfall-sim.test.ts`, `tests/sigilfall-dungeon-*.test.ts` |
| A new hero finishes the whole campaign by the quest arrow | `tests/sigilfall-campaign.test.ts`, `tests/sigilfall-quests-doable.test.ts`, `tests/sigilfall-guidance.test.ts` |
| Saves load | the save-version tests, and `tests/sigilfall-save-fixtures.test.ts` (the three saves below) |
| Nothing on the screen covers anything else | `node scripts/sigilfall-overlap-check.mjs` finds nothing at its sizes and reports no error from the page |
| A browser tour shows no console errors | `node scripts/sigilfall-tour.mjs`: every act's review presets, a Riftstone run, a Vigil night, a Ring match against the computer, and the three saves played |
| Frame times are no worse | `node scripts/sigilfall-bench.mjs --size desktop` and `--size phone`, before and after |
| The size report stays within its budgets | `node scripts/size-report.mjs` |
| What a new player loads before the first fight is no more | `node scripts/sigilfall-load-check.mjs --size desktop` and `--size phone` |

The browser scripts need Playwright, which isn't one of the project's packages. On the owner's machine it is found
with `NODE_PATH=/Users/savahristov/Desktop/WebGames-1/marketing/_studio/node_modules` (Playwright 1.56.1, whose
Chromium is already downloaded); anywhere else, `npm i --no-save playwright`.

### The three saves

`tests/sigilfall-saves/`, made once by `node scripts/sigilfall-save-fixtures.mjs` on `pre-release` as it stood before
this pass (`about.json` names the commit, `7dacaa45`, and save version 15). They are never made again on a later
commit and never edited: they are the old game.

| File | Hero | Where the story stands |
| --- | --- | --- |
| `mid-prologue.json` | Ilse, a mage, level 3, in Briarhollow | holding the chapel door (`briar-hold-the-door` under way), 6 quests done |
| `mid-act-3.json` | Corin, a ranger, level 36, in the Glimmerwood | the Embers and the Sun won, the Thorn Court's prince next (`silvaines-song`), 65 quests done and 16 under way, a specialization and 27 talent points |
| `finished-riftward.json` | Bryn, a warrior, level 60, in the Riftward | the story and every side road done (215 quests), all seven sigils, twelve Riftstone runs to stone 16, seven Rift legendaries worn (item levels 73 to 82) beside three of the story's, more of them and set pieces in the bag, Paragon 21 |

How they were made, so nobody takes them for more than they are: each hero was walked through the real simulation by
the walk the campaign test uses (`tests/sigilfall-walk.ts`: by the quest arrow, taking what the givers offer, fighting
what the story sends, with the story's staged beats playing), doing on the way what a player does (wearing better
gear, picking a specialization, spending talent points, keeping the bag), and was written by the game's own save code
(`saveText`). The walk's hero can't fall and strikes hard, so play time, falls and kill counts are not a player's. They
were not played by hand in a browser; the tour loads each one in the real game and plays its hero.

## The baseline (2026-11-24, `pre-release` at `7dacaa45`)

Measured on the owner's Mac (Node 24.22). The browser numbers come from headless Chromium with a software graphics
card (SwiftShader), so frames a second and seconds are for comparing one run with the next on this machine, never a
phone's numbers. Draw calls, triangles and bytes mean the same anywhere.

### Checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | passes |
| `npm run lint` | passes |
| `npx vitest run --no-fsModuleCache` | 364 test files, 4,305 tests: 4,299 passed, 5 skipped, 1 failed |
| The five skipped | the suite's own, from before this pass: the Ring's team measurement, which runs only when asked for (`RING_SYNERGY`), and Mini Racer's shortcut check on the four tracks that have no shortcut |
| The one failure | `tests/wheres-the-ball-shots.test.ts` (Where's the Ball?, another game) timed out at 5 s while the whole suite ran; alone it passes in 3 s. Not Sigilfall's, and left as found. |
| `npx vite build && node scripts/build-games.mjs && node scripts/size-report.mjs` | passes: initial JavaScript 120.8 KB gzipped of a 121.0 KB budget (none of it Sigilfall's: the game loads on its own page); all files 62,800.5 KB gzipped |

Sigilfall's own files as shipped (`public/games/sigilfall/`, 51 MB): models 12 MB (112 files), music 35 MB (25
pieces), sounds 3.1 MB (237 files), icons 0.7 MB.

### Frame cost in the heaviest fights (`scripts/sigilfall-bench.mjs`, 8 s each)

Draw calls and triangles of a frame, as "the middle of the run / the most", and frames a second on this machine's
software graphics card.

| Fight (review preset) | Desktop 1440 × 900: calls | triangles | fps | Phone 844 × 390: calls | triangles | fps |
| --- | --- | --- | --- | --- | --- | --- |
| `prologue-raid` | 57 / 57 | 110k / 110k | 10 | 48 / 48 | 103k / 103k | 14 |
| `hearth-ram` | 72 / 72 | 159k / 159k | 2 | 61 / 67 | 129k / 139k | 3 |
| `night-of-knives` | 84 / 84 | 356k / 358k | 2 | 76 / 76 | 305k / 318k | 3 |
| `the-sortie` | 61 / 61 | 208k / 208k | 8 | 58 / 58 | 157k / 174k | 13 |
| `fireships` (retired: see below) | 55 / 61 | 208k / 209k | 10 | 58 / 58 | 157k / 157k | 13 |
| `every-banner` | 57 / 57 | 284k / 284k | 9 | 57 / 57 | 279k / 279k | 8 |
| `siege-mages` | 57 / 57 | 266k / 266k | 10 | 58 / 58 | 279k / 279k | 8 |
| `keep-the-door` | 60 / 60 | 276k / 282k | 9 | 61 / 61 | 330k / 330k | 7 |
| `last-march` | 60 / 60 | 294k / 300k | 8 | 61 / 61 | 330k / 330k | 7 |

A fight isn't the same frame twice: between two runs on the same code, the triangles of a row moved by up to a tenth
(the sortie read 187k one run and 208k the next) and the frames a second by one or two. A later piece is worse only
past that.

**The heaviest creature drawn today** (the budget for a boss, piece 2): the `orc_brute` file, 12,852 triangles, one
body on the large skeleton. Then `monstrosity` 11,848, `black_knight` 11,380, `vaelor` 10,122. The `witch` the Coffin
Matron is drawn from has 6,850.

### What a new player loads before the first fight (`scripts/sigilfall-load-check.mjs`, the production build)

A first visit with nothing cached: New hero, Begin, the tale's page, Mara's words, the raiders called. "Sent" counts
text as Brotli sends it, as the site's host does; everything else at its file size.

| Moment | Desktop: seconds | files | sent | Phone: seconds | files | sent |
| --- | --- | --- | --- | --- | --- | --- |
| The title screen is up | 10.8 | 90 | 6,920 KB | 11.6 | 90 | 6,791 KB |
| The hero stands in the world | 15.1 | 103 | 10,326 KB | 14.9 | 106 | 10,209 KB |
| **The first fight begins** | 26.9 | 183 | **11,741 KB** | 24.9 | 228 | **12,021 KB** |
| Six seconds into it | 32.9 | 237 | 12,171 KB | 30.9 | 303 | 12,553 KB |

At the first fight, on a phone: models 4,809 KB in 7 files (the wardrobe's `hero.pack` is 2,441 KB of it), music
3,716 KB in 3 pieces (the title's, the village's, the siege's), sounds 1,297 KB in 133 files, scripts 1,226 KB in 55
files, the icon sheet 668 KB, and under 300 KB of everything else. The page reported no error and no file failed to
load. The seconds include the script's own reading pace (it presses a button every quarter second), so they compare
runs; they are not how long a player waits.

So the music is not loaded all at once: three of the 25 pieces come before the first fight. The 35 MB is what ships.

### The browser tour and the screen check

- **The tour** (`scripts/sigilfall-tour.mjs`): 135 stops, 45 at each of the three sizes: the story's 38 beats, the
  Riftward and a Riftstone +1 of the crypt, a night of the Vigil, a Ring match against the computer, and each of the
  three saves played. The page reported nothing at any of them. The pictures are in `docs/review/sf9-baseline/`.
- **The screen check** (`scripts/sigilfall-overlap-check.mjs`, its usual run: the story's beats at desktop, laptop,
  tablet and phone): nothing on the screen covers anything else, and no error from the page.

The screen check plays with the first-timer's hints turned off, so it can't see what the review saw in the first
fight, a hint card over Mara's speech. Piece 8 runs it with the hints on as well.

## The pieces

### 1. Baseline and plan (`claude/sf9-baseline`)

This file; the three saves and their test; the baseline above; pictures of every act's beats at the three sizes in
`docs/review/sf9-baseline/`. It adds three scripts the later pieces use (`sigilfall-save-fixtures.mjs`,
`sigilfall-tour.mjs`, `sigilfall-load-check.mjs`) and moves the campaign test's walk into `tests/sigilfall-walk.ts`,
unchanged, so the fixtures' heroes walk the same way. No game code changes.

### 2. Bosses of their own (the biggest piece)

**What it touches:** `scripts/sigilfall-3d-assets.mjs` (new kits), `public/games/sigilfall/3d/k/` (new built files
only), `render3d/kits.ts`, `render3d/repaint.ts`, `render3d/worldCast.ts`, `render3d/moves.ts`, a new
`render3d/bossKit.ts` for what is built in code, `ui/PerfMeter.tsx` if a per-creature cost is needed,
`CREDITS_AND_LICENSES.md`, `LEGAL_REVIEW.md`, `DESIGN.md` (its line that a boss is its soldiers' model). The rules
(`data/bosses.ts`, `sim/patterns/`) don't move for looks: a boss's footprint matches its `radius`, and its attacks
land where the rules hit.

**Where the models are.** The owner's brief names `~/Desktop/sigilfall assets`. On 2026-11-24 that folder holds 2D
packs (tilesets, spell sheets) and one 3D pack, the KayKit Dungeon Pack 1.1 (CC0: rooms and props, no creatures); it
has no boss models and no music. The 3D packs the builder reads are in `~/Downloads`, as before: the Complete KayKit
Collection v8 (CC0), Kenney's kits (CC0), and Quaternius's packs, among them **Ultimate Monsters** (its `License.txt`
says CC0 1.0), which the game doesn't use yet. So the bosses are made from those: parts of several models combined,
proportions changed, pieces built in code, repainted by part. Each pack's license file is read before its first use
and recorded.

**The gate every boss passes** (VISUAL_BIBLE.md §2 and "The world's rules"): the game's own chunky low-poly style,
colors baked into the vertices, no textures; scale measured against the 36 px hero; palette through `harmonize`; light
from the upper left; a silhouette that reads at phone size; related to its soldiers by color and material but its own
shape; its look tells its story and its attacks come from where its body is; glow only where there is magic;
telegraphs and danger colors readable over and around it.

**States each boss needs,** in step with the rules' timing: idle and move; a wind-up and a strike for each attack
pattern; being hit; its phase change; its entrance; a death of its own.

**Budget.** No more draw calls or triangles than the heaviest creature drawn today, measured with the perf meter in
its arena (and on the throttled phone profile once piece 7 has it).

**Checks for each boss.** Pictures beside the hero and its soldiers at phone zoom, in each phase and in the middle of
a telegraph; every class's bot still beats it; the Riftstone run of its dungeon still works.

**The inventory** (43 bosses in 15 dungeons and the Whisperwood; `node` over `data/bosses.ts`, `data/dungeons/*`,
`render3d/kits.ts` on 2026-11-24). "Model" is the built file it is drawn from today, and what is added to it.

| Order | Boss | Where | Radius | Phases | Model today | Its own attacks |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **The Coffin Matron**, Mother of the Ossuary | the Hollow Crypt (Prologue) | 9 | 2 | `witch` ×1.2, dressed as a person | `crypt:coffins` (she hides in one of the coffins), seekers, a cage |
| 2 | Warden Ossric, Keeper of the Crypt Gate | the Hollow Crypt | 10 | 2 | `sk_guard` ×1.4, eyes, a halo | charge, slam, spear fan, `crypt:candles` |
| 3 | Morgrave, the Ash-Scholar | the Hollow Crypt | 10 | 3 | `sk_necro` ×1.35, a crown, eyes | soul volley, grave grasp, rift spiral, beams, `crypt:soul-split` |
| 4 | Grimtusk, Warlord of the Whisperwood | the Whisperwood (Prologue) | 11 | 2 | `orc_brute` ×1.5, horns, eyes | charge, stomp, gore, a roar that calls boarlets |
| 5 | The Hangman | Gallows Keep (Act I) | 10 | 2 | `barbarian`, dressed | cleave, chop, hook, `gallows:trapdoors` |
| 6 | Gnasher, the gang's war-hound | Gallows Keep | 14 | 2 | `a_wolf` ×1.3, barding | cleave, charge, `gallows:burrow` |
| 7 | Harlan Blackglove, King of the Gallows Gang | Gallows Keep | 10 | 3 | `survivalist` ×1.12, dressed | cleave, volley, charges, vanish, `gallows:hostages` |
| 8 | Gloomwing, the Lamp-Eater | the Barrow of Kings (Act II) | 13 | 2 | `fbx_trex` ×1.75, built as a drake | its dungeon's own |
| 9 | King Hrodric, the Barrow King | the Barrow of Kings | 11 | 2 | `sk_king` ×1.35, eyes | its dungeon's own |
| 10 | Sir Corvane the Fallen | the Barrow of Kings | 13 | 3 | `black_knight` ×1.3, repainted, eyes | its dungeon's own |
| 11 | Silas Vey, the Herald's Last Hand | the Crown Catacombs (Act II) | 10 | 2 | `rogue_hooded` ×1.2, dressed | its dungeon's own |
| 12 | The Royal Auditor | the Crown Catacombs | 11 | 2 | `cleric` ×1.3, dressed | its dungeon's own |
| 13 | Maelis Crane, Lord Chancellor, once | the Crown Catacombs | 11 | 2 | `cleric`, dressed as the Chancellor | its dungeon's own |
| 14 | Vizier Khepset | the Tomb of the Sun King (Act III) | 11 | 2 | `witch` ×1.35, dressed | its dungeon's own |
| 15 | The Sand Warden | the Tomb of the Sun King | 13 | 2 | `sk_golem` ×1.45, eyes | its dungeon's own |
| 16 | The Sun King | the Tomb of the Sun King | 13 | 3 | `sk_necro` ×1.4, a halo, a crown, eyes | its dungeon's own |
| 17 | Jarl Hrimfang | the Vault of Rime (Act III) | 12 | 2 | `barbarian_large` ×1.3, horns, eyes | its dungeon's own |
| 18 | Hallvor, Ingrith's Shield-Thane | the Vault of Rime | 12 | 2 | `paladin` ×1.38, dressed | its dungeon's own |
| 19 | The Rime Wyrm | the Vault of Rime | 15 | 3 | `wyrm` (built in the asset script) | its dungeon's own |
| 20 | The Siege-Breaker | the Siege of Highwall (Act IV) | 14 | 2 | `siege_ram` | its dungeon's own |
| 21 | Prior Vessant, Chaplain of the Host | the Siege of Highwall | 11 | 2 | `sk_necro` ×1.3, dressed | its dungeon's own |
| 22 | General Morvain | the Siege of Highwall | 12 | 3 | `black_knight` ×1.4, repainted, horns, eyes | its dungeon's own |
| 23 | The Magma Warden | the Molten Throne (Act V) | 14 | 2 | `golem` ×1.5, molten paint, horns, eyes | its dungeon's own |
| 24 | Ossa the Founder | the Molten Throne | 14 | 2 | `sk_golem` ×1.55, eyes, gear | its dungeon's own |
| 25 | Ashkar the Bound | the Molten Throne | 15 | 4 | `golem` ×1.65, molten paint, horns, eyes | its dungeon's own |
| 26 | Lady Cendre, the Last Mourner | Duskspire (the finale) | 11 | 2 | `witch` ×1.3, dressed | its dungeon's own |
| 27 | Captain Ser Maltheus | Duskspire | 11 | 2 | `black_knight` ×1.35, repainted, eyes | its dungeon's own |
| 28 | Vaelor, the Hallow King | Duskspire | 15 | 5 | `vaelor` ×1.6: a file of his own already, repainted part by part, the Ash Crown | `sim/patterns/hallow-king.ts` |
| 29 | The Drowned Priestess | the Smugglers' Grotto (the Rift) | 10 | 2 | `sk_mage` ×1.35, eyes | wall of water, undertow, tide, `grotto:flood` |
| 30 | Mother Clatterclaw | the Smugglers' Grotto | 18 | 2 | `crab` ×1.6, gear | `grotto:pincers`, scuttle, froth, shell, molt |
| 31 | Captain Saltbeard | the Smugglers' Grotto | 10 | 3 | `survivalist` ×1.14, dressed | cleave, volley, kegs, barrage, `grotto:black-spot` |
| 32 | Brother Pustule | the Rot-Mother's Cistern (the Rift) | 10 | 2 | `cleric`, dressed | its dungeon's own |
| 33 | Old Sluicegut | the Rot-Mother's Cistern | 14 | 2 | `frost_golem` ×1.7, gear | its dungeon's own |
| 34 | The Rot-Mother | the Rot-Mother's Cistern | 14 | 3 | `monstrosity` ×1.5, horns, eyes | its dungeon's own |
| 35 | The Runewarden | the Deepforge Halls (the Rift) | 13 | 2 | `golem` ×1.6, molten paint, eyes, gear | its dungeon's own |
| 36 | The Slag Colossus | the Deepforge Halls | 13 | 2 | `golem` ×1.6, molten paint, eyes | its dungeon's own |
| 37 | Forgemaster Grold | the Deepforge Halls | 10 | 3 | `sk_golem` ×1.45, horns, eyes | its dungeon's own |
| 38 | The Rotwood Colossus | the Blightheart (the Rift) | 15 | 2 | `treant` ×1.35, horns, eyes | its dungeon's own |
| 39 | Elowen of the Dawn | the Blightheart | 11 | 2 | `witch` ×1.3, dressed | its dungeon's own |
| 40 | The Withered Queen | the Blightheart | 12 | 4 | `vampire` ×1.35, a crown, eyes | its dungeon's own |
| 41 | The Veil Sentinel | the Spire of the Rift (the Rift) | 14 | 2 | `golem` ×1.5, molten paint, eyes, a halo | its dungeon's own |
| 42 | Ilvane the Unmoored | the Spire of the Rift | 11 | 2 | `witch` ×1.3, dressed | its dungeon's own |
| 43 | The Pale Herald (in the Spire) | the Spire of the Rift | 12 | 4 | `vampire` ×1.35, a halo, eyes | its dungeon's own |

What the table shows: 25 models play 43 bosses. The `witch` plays five, the `golem` five, and `sk_necro`, the
`cleric`, `sk_golem` and the `black_knight` three each. Each boss's story (its `intro`, STORY_BIBLE.md, WORLD.md), its
attacks (`sim/patterns/<dungeon>.ts`) and its arena are read when its turn comes and written into its pull request.

The lands' named foes (70 in `data/zones/*`, the story's own among them: the Grey Lady, Prince Thistlemourn, the
Tearborn, the Gatewarden, the Weeping Lord, the Lich of Hollowmere, Vosk) come last, the story's first. A Riftstone
run is the dungeon itself, so its bosses are the same ones. The Vigil's champions are the lands' named foes and
creatures (`vigil/kit.ts`: the Grey Lady, the Headless Lord and others), none of them a dungeon's boss, so they change
with piece 2i; the Ring shows no boss.

**Order.** 2a: the Coffin Matron, the first boss a player meets, as the showcase and to prove the pipeline. Then each
act's bosses and the finale's (2b to 2h, rows 2 to 28). Then the rest (2i, rows 29 to 43 and the named foes).

### 3. The signature system in the first twenty minutes (`claude/sf9-first-epic`)

The Coffin Matron's first-clear drop (`first` in `data/bosses.ts`) becomes, for each class, a hand-made item that
visibly changes a skill the hero has by then: the skill looks and behaves differently, and the item's gold line says
how. When it drops it is a moment: a short hint about gold lines, and the changed skill shown under the item. Its
numbers are checked against the skill by the rules of `progress/build.ts`. A test holds that every class gets one and
that it changes that class's skill. Static Band stays in the game (her later drops, the quartermaster).

**Touches:** `data/items.ts`, `data/bosses.ts`, `progress/describe.ts`, `ui/` (the reward and the hint),
`render/effects.ts` where a changed skill needs a look, `progress/tips.ts`, a new test, `LEGAL_REVIEW.md` (eight new
item names). Saves: new item ids only; nothing renamed.

### 4. Quests up to the Prologue's standard (one pull request per act)

The Prologue stays as it is, apart from fixes. For each act:

- **Walk-and-talk quests.** The act's quests whose steps are only walking or talking are listed and each one decided:
  folded into the scene or quest beside it, given something to do (a fight, a find, a choice, a staged moment), or
  kept, with the reason. The table goes in the pull request.
- **Side stories.** Each land gets one side story with a twist, in keeping with STORY_BIBLE.md and DIALOGUE_STYLE.md,
  summarized in the pull request so the owner can read it without playing.
- **The story stays whole.** Every main beat and every promise the story makes is kept. Removed or merged quests get
  save migrations (`progress/save.ts`, the quest table in `progress/saveTables.ts`, which only ever grows), and each
  one is named in the `FOLDED` list of `tests/sigilfall-save-fixtures.test.ts`: nothing else may make an old save's
  finished quests fewer. The campaign, guidance and quests-doable tests pass, and the quest arrow always has somewhere
  to point.

Where they are (counted from `data/quests.ts` on 2026-11-24: 215 quests in the data, 92 of them with no step but
walking somewhere or talking to someone; the docs say 218 and about 91):

| Act | Quests | Only walking or talking | Of those, main story |
| --- | --- | --- | --- |
| Prologue (Briarhollow, the crypt, the Whisperwood) | 14 | 5 | 4 |
| Act I (Brackenridge, Thornvale, the Amberfield) | 32 | 13 | 8 |
| Act II (the Ashen Barrows, Emberwick) | 18 | 10 | 9 |
| Act III (the Sunscorch, the Glimmerwood, Rimeheld, the Shattered Vale) | 51 | 17 | 10 |
| Act IV (Highwall, the Riftscar) | 24 | 10 | 8 |
| Act V (the Weeping Woods, Emberdeep, Hollowmere) | 33 | 12 | 9 |
| Act VI and the finale (the Pale Reach, Duskspire, Vaelmoor Remembered) | 18 | 6 | 4 |
| The quests that join the lands (`data/story.ts`, no land of their own) | 25 | 19 | 18 |

**Touches:** `data/zones/*-quests.ts`, `data/story.ts`, `data/scenes*.ts`, `progress/save.ts`,
`progress/saveTables.ts`, `QUEST_REWRITE_MAP.md`, tests. A change that would cut a story beat stops and goes to the
owner.

### 5. Sound with its own character

- **The mix** (`claude/sf9-sound-mix`): every effect and track measured (loudness, peaks) and brought into one mix;
  the music steps back under dialogue and scenes (the buses of POLISH_PLAN.md piece 24).
- **Music** (`claude/sf9-music`): a theme for each act and each boss fight, preferring pieces that aren't heard
  everywhere; a Kevin MacLeod track kept only where nothing better exists; music loaded only when it is needed. (The
  baseline shows the game already loads a land's piece when it is needed: three pieces before the first fight, not all
  25. What is left is to check every land and mode the same way.) **`sigilfall assets` has no music in it**, so new
  pieces must come from somewhere the owner approves: this piece stops and asks before anything is downloaded.
- **Voices** (`claude/sf9-voices`): vocal efforts (no words, no synthetic voices) for every class in both bodies; a
  sound of its own for each boss's entrance, phases and death.
- **For the owner:** a list of what is still stock or placeholder, for a composer and voice actors.

**Touches:** `audio/`, `scripts/sigilfall-sounds.mjs`, `public/games/sigilfall/audio/` and `music/`,
`CREDITS_AND_LICENSES.md`, `LEGAL_REVIEW.md`, the Settings credits.

### 6. One standard, act by act (one pull request per act)

Every act toured with the review presets at the three sizes, in daylight, at night and in each dungeon. Whatever
falls below the Prologue is fixed: anything covered or cut off, text that's too small, scenes too dark to read, props
that break the world's rules, effects that hide a telegraph, a dull fight. Before-and-after pictures in each pull
request. Best done after the same act's bosses and quests, so it looks at what players will see.

### 7. Phone and network readiness (`claude/sf9-phone`)

Chromium's phone emulation (a mid-range Android and an iPhone, held sideways) with a 4× CPU slowdown and a slow 4G
profile (`sigilfall-load-check.mjs --net slow4g --cpu 4`, and the bench under the same). Measured: time and bytes to
the first fight; frame times in the heaviest battles (the chapel door, the crowded dungeon rooms, each act's final
boss, a full Vigil night); memory over 30 minutes; touch play. What falls short is fixed (quality tiers chosen by the
device, lazy loading). A short checklist for the owner to run on a real phone.

### 8. The rough edges (`claude/sf9-rough-edges`)

The three from the review: the hint card over Mara's speech, and anything else the screen manager lets overlap; the
"Both can be changed" line when only one choice is shown; the small game area on desktop (a bigger stage or a clear
way to play full screen, without changing other games' pages: if it can't be done inside Sigilfall's own page, it goes
to the owner first). Then a hunt: every panel, dialog and shop at the three sizes, with keyboard and with touch.

### 9. Ready for players (`claude/sf9-playtest`)

Playtest numbers checked end to end (`progress/telemetry.ts`, `docs/ANALYTICS.md`): falls, stops, the quest and the
land, nothing personal. "Report a bug" carries the build, land, quest, level and class, never the player's name or
save. `PLAYTEST_GUIDE.md`: what testers should play and how to report, what the owner should watch for, where to read
the numbers.

### 10. The release bar (`claude/sf9-release`)

Everything in the regression bar, measured against the baseline with all the pieces merged. Brings POLISH_PLAN.md,
SIGILFALL_QA.md, DESIGN.md, CREDITS_AND_LICENSES.md and LEGAL_REVIEW.md up to date and gives a short readiness
report: what was verified, how, and what wasn't.

## Found while taking the baseline

- **The asset folder.** `~/Desktop/sigilfall assets` has no boss models and no music (see piece 2 and piece 5). The
  bosses can be made from the packs in `~/Downloads`; the music can't be made from anything on the machine.
- **The frame bench names a retired beat.** `scripts/sigilfall-bench.mjs` lists `fireships`, whose land (the Sunken
  Reaches) is retired, so the preset is gone and that row measures the fight before it again. Left as found for the
  baseline; piece 7 replaces it with the fights the brief names.
- **One timeout in another game's test** under the whole suite's load (Where's the Ball?). Not touched.
- **The screen check never sees the first-timer's hints** (it turns them off), which is where the review found its
  overlap. Piece 8 adds a run with them on.
- **The loader gives every hero the first Riftstone.** A save written with `keystone: 0` comes back with 1; the
  fixtures' test allows for it.

## What only the owner can do

A real phone (piece 7 writes the checklist); a composer and voice actors (piece 5 lists what is stock); the review and
merge of every pull request.
