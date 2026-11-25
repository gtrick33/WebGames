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
| 1 | Baseline and plan | `claude/sf9-baseline` | #355 | merged 2026-11-25 | nothing |
| 2a | Boss pipeline and the Coffin Matron | `claude/sf9-boss-matron` | #356 | merged 2026-11-25 | 1 (#355) |
| 2b | Bosses: the Prologue (Ossric, Morgrave, Grimtusk) | `claude/sf9-bosses-prologue` | #357 | merged 2026-11-25 | 2a (#356) |
| 2c | Bosses: Act I (Gallows Keep): the Hangman and Harlan Blackglove; Gnasher's moves; a move for every attack of all 43 bosses | `claude/sf9-bosses-act1` | #363 | merged 2026-11-25 | 2b (#357) |
| 2d | Bosses: Act II (the Barrow of Kings, the Crown Catacombs): Hrodric, Corvane, Silas Vey, the Royal Auditor | `claude/sf9-bosses-act2` | #371 | open | 2c (#363, merged) |
| 2e | Bosses: Act III (the Tomb of the Sun King, the Vault of Rime): the Sun King, Khepset, the Sand Warden, Hrimfang, Hallvor | `claude/sf9-bosses-act3` | #372 | open | 2d (#371) |
| 2f | Bosses: Act IV (the Siege of Highwall): Prior Vessant, General Morvain | `claude/sf9-bosses-late` | #373 | open | 2e (#372) |
| 2g | Bosses: Act V (the Molten Throne): the Magma Warden, Ossa, Ashkar | `claude/sf9-bosses-late` | #373 | open | 2e (#372) |
| 2h | Bosses: the finale (Duskspire): Lady Cendre, Ser Maltheus | `claude/sf9-bosses-late` | #373 | open | 2e (#372) |
| 2i | Bosses: the Rift's fourteen (the Drowned, Saltbeard, Brother Pustule, Old Sluicegut, the Rot-Mother, the Runewarden, Slag Colossus, Forgemaster Grold, Rotwood Colossus, Elowen, the Withered Queen, Veil Sentinel, Ilvane, the Herald). The lands' named foes are not part of it | `claude/sf9-bosses-rift` | #374 | open | 2h (#373) |
| 2j | The story's seven named foes of the lands: the Grey Lady, Prince Thistlemourn, the Tearborn, the Gatewarden, the Weeping Lord, the Lich of Hollowmere, Vosk the Hollowed. The other 63 named foes keep shared models (the owner, 2026-11-25) | `claude/sf9-bosses-named` | #376 | open | 2i (#374) |
| 3 | The signature system in the first twenty minutes | `claude/sf9-first-epic` | #358 | merged 2026-11-25 | 1 (#355) |
| 4 | Quests up to the Prologue's standard, one pull request per act | `claude/sf9-quests-act1` (Act I); `-act2` … `-act6` not started | #364 | Act I merged 2026-11-25; Act II read and left as it is; Acts III to VI not started | 1 |
| 5 | Sound with its own character | `claude/sf9-sound-mix`; `-music`, `-voices` wait for the owner | #365 | the mix merged 2026-11-25; music and voices not started (no source approved) | 1 |
| 6 | One standard, act by act | `claude/sf9-standard-act1`; `-act2` … `-act6` not started | #366 | Act I merged 2026-11-25 (screen and light only: nothing needed changing); Acts II to VI not started | 2, 4 (the same act's) |
| 7 | Phone and network readiness | `claude/sf9-phone` | #361 | merged 2026-11-25 | 1 |
| 8 | The rough edges | `claude/sf9-rough-edges` | #359 | merged 2026-11-25 | 1 |
| 9 | Ready for players | `claude/sf9-playtest` | #360 | merged 2026-11-25 | 1 |
| 9b | The page no longer reloads itself when an API call fails during loading (found in piece 7; the site's, not only Sigilfall's) | `claude/sf9-reload-fix` | #362 | merged 2026-11-25 | nothing |
| 10 | The release bar | `claude/sf9-release` | this one | measured 2026-11-25 on everything merged: see "The release bar, measured" | all of them, merged |
| 11 | What would make it more fun (added by the owner: see its own section) | 11a and 11e in pieces 8 and 9; `claude/sf9-open-world`, `-vigil-return`, `-fewer-legends` | | not started | the playtest (11b); the owner's go-ahead (11c, 11d) |

## Where the pass stands now (2026-11-25, evening)

The table above is per piece. This is the whole picture in one place, for the owner to read while the last checks run.

**Open, waiting for the owner to review and merge (none merged). Merge in this order:**

| Order | Pull request | What it is |
| --- | --- | --- |
| 1 | #368 | Quests of Act III |
| 2 | #369 | Quests of Acts IV to VI (built on #368) |
| 3 | #370 | Acts II to VI against the Prologue's standard, and the speech-overlap fix (on its own) |
| 4 | #371 | Bosses of Act II: Hrodric, Corvane, Silas Vey, the Royal Auditor |
| 5 | #372 | Bosses of Act III: the Sun King, Khepset, the Sand Warden, Hrimfang, Hallvor (built on #371) |
| 6 | #373 | Bosses of Acts IV and V and the finale: Vessant, Morvain, the Magma Warden, Ossa, Ashkar, Cendre, Maltheus (built on #372) |
| 7 | #374 | The Rift's fourteen bosses (built on #373) |
| 8 | #376 | The story's seven named foes (built on #374) |
| any | #375 | The Vigil: events, new foes, a rule per land, champion attacks, motes and a weekly watch (on its own) |

**Still running:** a second Vigil pass in its own session (more spells for each class, polish, whole nights played),
to be a pull request on top of #375.

**Left after that:**

- **The lands' named foes:** the story's seven have figures of their own (2j). The other 63 keep shared models, by the
  owner's choice (2026-11-25).
- **Gloomwing, the Rime Wyrm, the Siege-Breaker, Maelis Crane:** left as they are on purpose. The first three are
  already one-off builds; Crane keeps the look the player has known him by as a person of the city.
- **Music and voices** (5): skipped for now by the owner (2026-11-25). No source is approved, and nothing was
  downloaded.
- **Piece 11:** 11c (the Vigil) is #375. 11d (fewer legendaries): the owner chose to keep all 419, so nothing is to be
  done. 11b (the open-world penalty) waits for the playtest.
- **A second quest pass** with a harder bar, to be gone through with the owner.

**Only the owner can do:** review and merge the seven pull requests; play on a real phone; judge the sound by ear;
approve a source for music and voices; decide piece 11's larger items.

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

**2c, Gallows Keep (#363, 2026-11-24).** Two of its three:

- **The Hangman**: a giant bare to the waist under a headsman's black hood, a great axe in his hand and the second
  he takes up at half health slung on his back, the rope coiled at his hip. On the large skeleton, 11,135 triangles.
  His wide cut is a full turn of his body, his chop comes down two-handed, the gallows floor drops when he smashes
  down on it, the noose and the thrown axes go out with a flung arm.
- **Harlan Blackglove**: a bandit who crowned himself. The gang's red, a black plate gauntlet on his left arm with a
  hand too big for a man, a knife in each hand, the cage keys at his belt, and a crown of stolen gold with a shard of
  rift-glass in its brow (his first drop is that shard). 7,690 triangles and what the crown adds. Two cuts, a
  flick for the thrown knives, a thrust for each dash, a sidestep into his smoke, a wave of the glove for his
  cutthroats.
- **Gnasher** keeps his look and the shared wolf's file (the owner, 2026-11-24: "gnasher is fine"), and now leaps
  into his charges, digs for his burrow and lowers himself to call the pack: the wolf's file gained those clips.
- **Every boss moves** (the owner, same day: check that none floats and each has real animations, "and keep that in
  mind for any future boss"). `render3d/bossMoves.ts` gives every attack of every boss a clip of its kind from the
  boss's own skeleton, so no boss makes one swing for everything; four bosses on foot were lifted off the ground and
  are not now (four that fly still drift); a struck pose that stuck after a daze is fixed.
  `tests/sigilfall-bosses-move.test.ts` holds all 43 to it, and a new boss fails it until it moves. Twelve were run
  in motion in the browser: `docs/review/sf9-bosses-act1/README.md`.
- Learned: a part made for the large skeleton does not come across to the medium one at its own size (the Black
  Knight's arm arrived as tall as the man). Parts go from medium to large, or between figures of the same skeleton.


### 3. The signature system in the first twenty minutes (`claude/sf9-first-epic`)

The Coffin Matron's first-clear drop (`first` in `data/bosses.ts`) becomes a hand-made piece that visibly changes a
skill, with a moment made of it when it drops: a page with the piece, its gold line and the skill it changes.

**One piece for every class, on the basic attack** (the owner, 2026-11-24). The brief asked for a piece per class on a
skill the hero has by then, and eight were built that way, each on its class's first skill. The owner's objection: a
mage who becomes a Cryomancer at level 10 no longer casts Fireball (only the Pyromancer keeps it on its bar), so the
first thing the game taught about gold lines would stop applying; a piece per specialization would be 24. The basic
attack is the one skill no specialization drops. So: the Sexton's Handbell, for anyone, whose gold line makes the
basic attack leap to a second enemy on every blow (Static Band does it only on a critical hit). Static Band stays
in the game, among what she may drop every time.

**Touches:** `data/items.ts`, `data/bosses.ts`, `engine.ts` (a `gear` story page, shown once), `ui/StoryPages.tsx`,
`Game.css`, a new test, `LEGAL_REVIEW.md` (one new item name). Saves: one new item id; nothing renamed.

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

**Done in #361 (2026-11-24).** Measured with Chromium as a phone on its side (844 × 390, touch), the production
build, a first visit with nothing cached:

| Line | The title is up | The first fight begins | Sent by then |
| --- | --- | --- | --- |
| No limit | 10.1 s | 23.4 s | 6.8 MB at the title, 12.0 MB at the fight |
| Fast 4G (9 Mbit/s, 60 ms) | 12.6 s | 26.1 s | 6.7 MB, 11.8 MB |
| Slow 4G (1.6 Mbit/s, 150 ms) | 41.1 s | 54.5 s | 6.7 MB, 7.8 MB (the music is still coming) |
| Slow 4G, and the processor slowed four times | 40.4 s | 55.5 s | 6.7 MB, 7.7 MB |

(The seconds include the script's own reading pace and this machine's software graphics card; the difference between
the rows is the line.)

- **Where a slow line's 41 seconds go.** Scripts by 10 s; then the title's models (4.6 MB: the wardrobe's
  `hero.pack` alone is 2.4 MB) and the icon sheet (0.7 MB) until about 36 s. The line is full the whole time, so
  nothing is gained by asking earlier: only sending less before the title would shorten it. The model files are
  already quantized and gzipped (Brotli gains nothing on them).
- **What that wait looked like: an empty black box**, for half a minute. Fixed: the wait before the title is the
  intro's own veil with a bar that fills as the files come (`ui/Warming.tsx`, `packLoad` in `render3d/pack.ts`);
  the title's veil carries the bar on from there. Where the server says how big the files are, the bar goes by
  bytes and the line says how many MB have come; the test's server doesn't, so only the bar by files was seen, and
  whether the live host says was not checked.
- The icon sheet is asked for at low priority, so a browser that orders downloads sends the models first. The test's
  throttle doesn't order them, so this is not measured.
- **Not done, and the owner's call:** splitting the wardrobe so the title waits only for what it shows (a new
  player's title shows no hero at all) would take about 2.4 MB, a third, off a slow line's wait. It changes the
  model builder and every menu that draws a hero; it is a piece of its own, after real phones have said how long
  the wait is.
- **Found, in shared code, fixed in a pull request of its own:** `src/main.tsx` reloads the page on any `vite:preloadError`, taking it for a
  deploy. One of the site's first calls to its API failing (the call follows a lazily loaded part, so its failure
  arrives as that event) reloads the page once, in the middle of the game's files on a slow line, and the reload
  drops `?play=1`. Seen here because the test serves the site without its API; a real player meets it when that
  call fails on a bad line. The fix is one line (reload only when the error is a missing file:
  `isStaleBuildError`), in the site's own start-up. The owner said yes (2026-11-24): it is #362, built on
  `pre-release` alone.
- **Frames.** The picture already steps down by itself on a machine that can't keep up (`render3d/pace.ts`), with a
  Light setting and a battery saver, so no new quality tier was added. Frames a second can't be measured here (a
  software graphics card under a slowed processor says nothing about a phone); draw calls and triangles are the
  baseline's, unchanged by this piece. The real numbers are the first thing `PHONE_CHECKLIST.md` asks for.
- **Memory over a long sitting** (`scripts/sigilfall-soak.mjs`, new): a hero jumped through a beat of each of the
  26 lands, three rounds, garbage collected at every stop. Round 2 to round 3: geometries 4,401 to 4,359, textures
  520 to 520, heap 56 MB a stop both rounds (58 MB at most). Nothing is held on to. This is the game's own
  bookkeeping, not a phone's memory limit, and it is not 30 minutes of play.
- `PHONE_CHECKLIST.md`: twenty minutes on a real phone, with blanks for the numbers only it can give.

### 8. The rough edges (`claude/sf9-rough-edges`)

The three from the review: the hint card over Mara's speech, and anything else the screen manager lets overlap; the
"Both can be changed" line when only one choice is shown; the small game area on desktop (a bigger stage or a clear
way to play full screen, without changing other games' pages: if it can't be done inside Sigilfall's own page, it goes
to the owner first). Then a hunt: every panel, dialog and shop at the three sizes, with keyboard and with touch.

**Done in #359 (2026-11-24):**

- While a first-timer's hint card is up, nothing is spoken on the screen (`renderer.hushed`); the line is there when
  the card is put down. `node scripts/sigilfall-overlap-check.mjs --hints` is the run the baseline lacked: a new hero
  with the hints on through the first fight. It reports `hint×speech` without the fix and nothing with it.
- The title says "You can change it any time in Settings." when it asks one thing, "Both…" when it asks two.
- **Full screen: the owner chose a button (2026-11-24), and it touches the shared game contract.** A game's page can
  now hand its game a way to fill the screen (`enterFullscreen` on `GameModuleProps`, passed by `GameStage` and
  `GamePage`, absent while the game already fills it). It is optional and only Sigilfall reads it: its title shows
  "Play full screen" on a desktop. No other game's page looks or behaves differently.
- The hunt: `node scripts/sigilfall-panel-audit.mjs` opens every panel and five shops at three sizes and measures
  what is cut off, covered, too small to read or too small to tap. Found and fixed: the Wardrobe's tags at 8 and 9 px
  (now 10). Also on the way: Settings still spoke of Heroic and Mythic, which are removed; and the basic-attack hint
  told a player their strikes "do most of the work", which the skills do.
- Found by the screen check's own run on this branch, and there on the baseline too (it comes and goes with the
  machine's speed, which is how the baseline's run missed it): on a phone, a wide banner ("Raid!", "The Vigil")
  placed while the camera was still coming to the hero slid down past the quest to where the hero then stood. An
  announcement now stays above the hero's resting place (`HERO_TOP` in `ui/layout.ts`); where it can't get clear
  there, the quest steps aside for it, as it already did.
- Not done: the panels were opened by script and looked at as pictures, at a hero in mid-game; the hunt did not play
  them with a keyboard key by key, and not on a real touch screen.

### 9. Ready for players (`claude/sf9-playtest`)

Playtest numbers checked end to end (`progress/telemetry.ts`, `docs/ANALYTICS.md`): falls, stops, the quest and the
land, nothing personal. "Report a bug" carries the build, land, quest, level and class, never the player's name or
save. `PLAYTEST_GUIDE.md`: what testers should play and how to report, what the owner should watch for, where to read
the numbers.

**Done in #360 (2026-11-24).** What following the numbers end to end found, and what was done about each:

- **A phone's player was not counted as a stop.** A stop was sent when the page was left; a phone's browser is swiped
  away and its page only hidden. And an event sent as the page hid waited four seconds in the arcade's queue, which
  a hidden page may never get. Now a stop is sent when the page hides (and again if they come back and leave again:
  the queries read each player's last of the day), and the sender delivers at once when the page is already hidden.
- **A member's account id was stored on falls and stops**, against "nothing that says who". The endpoint leaves it
  off these two events; the daily visitor key still counts players.
- **Nothing said which mode.** Falls and stops now carry `mode` (`story`, `rift` and its stone), and the Ring and the
  Vigil, which draw themselves and sent nothing, send a stop with the minutes spent in them (11e: whether testers
  find the Ring can now be read).
- **A bug report said only which game.** The game leaves one line (build, mode, land, quest, level, class) and the
  site's Report a bug page shows it to the player and sends it. Never the hero's name or the save.
- These touch shared code with the owner's go-ahead (2026-11-24): `functions/api/events.ts`,
  `src/platform/analytics.ts`, `src/pages/BugReportPage.tsx`, the new `src/platform/bugContext.ts`, and one new
  translated line in the twelve languages.
- `PLAYTEST_GUIDE.md` has the testers' half (what to play: the Prologue, then the Ring, then on; how to report; eight
  questions, the first of them 11a's on how fighting feels) and the owner's half (what to watch, the two numbers of
  the basic attack's pace, where to read everything, what the numbers can't say).
- 11e, the title: "The Ring" is one of the four banners on the title screen, beside "New hero". Left as it is.

### 10. The release bar (`claude/sf9-release`)

Everything in the regression bar, measured against the baseline with all the pieces merged. Brings POLISH_PLAN.md,
SIGILFALL_QA.md, DESIGN.md, CREDITS_AND_LICENSES.md and LEGAL_REVIEW.md up to date and gives a short readiness
report: what was verified, how, and what wasn't.

## The release bar, measured (2026-11-25, `pre-release` at `2d8cba33`, every pull request of the pass merged)

Twelve pull requests merged into `pre-release` on the night of 2026-11-25 on the owner's word ("merge all prs to
pre-release and deploy the ci"), in this order: #355, #356, #357, #363, #358, #360, #361, #359, #362, #364, #365,
#366. Three needed `pre-release` merged into them first for conflicts in this file, LEGAL_REVIEW.md and one place in
Game.css where two pieces had each added rules at the end: both sides were kept each time. The deploy run on
`2d8cba33` passed its type check, lint, tests and build on GitHub and deployed.

| The bar | Result | Against the baseline |
| --- | --- | --- |
| The four checks | type check and lint pass; 368 test files, 4,457 tests: 4,451 passed, 5 skipped, 1 failed locally (the same Where's the Ball? timeout under load; GitHub's run passed all); build passes, initial JavaScript 120.8 of 121.0 KB | 152 more tests, none skipped, loosened or deleted; the same 120.8 KB |
| Every class's bot clears every dungeon; a new hero finishes the campaign by the arrow; saves load | pass (in the test run above, the three old saves among them) | the same |
| The browser tour | 135 stops, the page reported nothing | the same |
| The screen check (its usual run, four sizes) | **one run found two overlaps at `lantern-vigil`** (Act II): with the check's three test lines and the scene's own line all up at once, a speaker standing off the top-left corner had his bubble held under the hero's plate (laptop), and two bubbles touched (phone). Two more runs of that beat at all four sizes found nothing. Picture: `docs/review/sf9-release/`. **Not fixed**: it needs four speakers at once with one in that corner, and I could not make it happen again to test a fix | the baseline's run found nothing |
| Frame cost in the nine heaviest fights | draw calls the same, fewer, or one more in every row; triangles within the tenth that one run differs from the next, or fewer (`night-of-knives` on a desktop 279k against 356k); frames a second the same or better on this machine | no worse |
| What a new player loads before the first fight | desktop 11,862 KB sent in 190 files (baseline 11,741); phone 11,886 KB in 217 files (baseline 12,021) | **desktop 121 KB more (1%)**, the phone 135 KB less. Models went from 4,809 to 4,847 KB (the great skeleton's seven new clips); the rest of the difference is which sounds had arrived by that moment, which moves from run to run |
| Size budgets | within | the same |

All files shipped: 63,441 KB gzipped against 62,801 at the baseline: the bosses' own files and the new clips.

### What the pass did, and what it did not

Done and merged: the baseline and this plan (1); bosses of their own for the Prologue's four and Gallows Keep's two,
and a move for every attack of all 43 bosses, none floating that should stand (2a to 2c); the first epic in the
first twenty minutes (3); Act I's quests (4, Act I); the sound mix (5, the mix); Act I against the Prologue on four
screens (6, Act I); phone and network readiness and the reload fix (7); the rough edges (8); ready for players (9).

Not done:

- **Bosses 8 to 43 still wear shared creatures' models** (2d to 2i). They move properly now; they do not yet look
  like nobody else.
- **Quests of Acts III to VI** were not gone through. Act II was read and left as it is.
- **Music and voices** (5): the music is still stock, and no voices were added. Nothing was downloaded, because no
  source has the owner's approval. `docs/review/sf9-sound-mix/README.md` lists what is stock for a composer.
- **Acts II to VI against the Prologue** (6). Act I's pass checked the screen and the light, not each place walked.
- **Piece 11's larger items** (the open world, the Vigil's return, fewer legendaries) wait for the playtest and the
  owner's go-ahead.

Never verified by anyone: the game on a real phone; the sound mix by ear; whether each boss's new moves read well in
play (which clip plays was checked, in the browser for twelve bosses and by test for all 43); a Riftstone run or
co-op with the new bosses beyond what the tour and the tests cover.

## Added by the owner: what would make it more fun (2026-11-24)

A second review, of the gameplay alone, rated it about 7/10 "built on the right ideas" (the Ring 8, boss mechanics 8,
campaign combat 7, the build system 8 on paper, the Vigil 6, the Riftstone 6 to 7 and unproven) and ended on five
points. The owner added them to this pass. The review judged the design and the numbers, not how the game feels in the
hand, and said so; it asked that the two changes of feel wait for what testers say.

| # | The point | Where it goes | Before it is done |
| --- | --- | --- | --- |
| 11a | **Measure feel in the playtest.** Ask testers directly whether combat feels good, and be ready to speed up the basic attack. The basic attack is slowed on purpose (`paceBasics` in `progress/build.ts`: at most about 1.7 a second, "the skills carry the fight"), while the first-timer's hint says the opposite ("Your strikes do most of the work, so keep them coming", `progress/tips.ts`). | Piece 9: the question goes in `PLAYTEST_GUIDE.md`, and the pace becomes one number that can be turned without touching anything else. Piece 8: the hint is made to say what the game does. | The pace itself changes only after testers have answered. |
| 11b | **Drop one of the open-world penalties.** A pack in the open lands has 1.8 times a dungeon's health and pays half the experience, so killing what is in front of you is both slower and worth less. | A small piece of its own after the playtest, `claude/sf9-open-world`. | **The owner chooses which one goes** (the health or the experience), after testers have played. Either changes how fast a hero levels: the campaign and bot tests are run again, and PROGRESSION_BALANCE.md brought up to date. |
| 11c | **Give the Vigil a reason to come back:** spells from other classes in a run (or unlocked over time), something earned that lasts between runs, and a weekly challenge run. | Its own piece, `claude/sf9-vigil-return`, after piece 10. | **The owner's go-ahead on scope.** The brief put new modes and systems out of scope, and these are three new systems (a shared spell pool, lasting progress with its save fields, a weekly run with its seed and ranking). Each needs a short design first. |
| 11d | **Fewer, more distinct legendaries in the endgame.** About 500 with the Rift's 419: no player can learn them all, and a chase works when each piece is memorable. | Its own piece, `claude/sf9-fewer-legends`, after piece 10. | **The owner's go-ahead, and a number.** The 419 were asked for on 2026-11-24 ("a legendary for each spec and 3 legendaries common for the class" on every slot). Taking pieces away needs a save migration for heroes who hold them (the finished hero of the save fixtures wears seven) and the brief's rule on endgame balance lifted. |
| 11e | **Feature the Ring for playtesters.** It is the strongest mode and the quickest to enjoy. | Piece 9: `PLAYTEST_GUIDE.md` sends testers to the Ring first or second, and the title screen is looked at for whether a new player finds it. | Nothing. |

So 11a and 11e are done inside pieces 8 and 9. 11b waits for the playtest and one choice. 11c and 11d are new work past
what the brief allowed, and wait for the owner to say how far to go.

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
