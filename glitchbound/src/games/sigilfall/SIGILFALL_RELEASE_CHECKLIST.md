# Sigilfall — Release Checklist (blueprint Prompt 16)

Status words: **VERIFIED** (an automated test or check proves it), **MANUALLY VERIFIED** (seen working in the
browser this cycle), **UNVERIFIED** (not checked, with the reason).

## Gates

| Check | Status |
| --- | --- |
| Typecheck `npx tsc --noEmit -p .` | VERIFIED (clean) |
| Lint `npx eslint src/games/sigilfall tests/sigilfall*` | VERIFIED (clean) |
| Sigilfall tests `npx vitest run --no-fsModuleCache tests/sigilfall*` | VERIFIED (counts in the last commit message of the release batch) |
| Production build `npm run build` | VERIFIED (the arcade's startup JS stays under its 120 KB budget) |
| `validate:sigilfall` | the registry, quest, art and collection validations run as tests (`sigilfall-ids`, `sigilfall-quests-doable`, `sigilfall-dungeons`, `sigilfall-art`, `sigilfall-collection`, `sigilfall-words`) — VERIFIED |

## By area

| Area | Status | Evidence |
| --- | --- | --- |
| All seven classes clear the opening dungeons on every tier (bot) | VERIFIED | `sigilfall-sim`, `sigilfall-dungeon-*` |
| Every zone's quests can be finished; no road to an unregistered region | VERIFIED | `sigilfall-quests-doable`, `sigilfall-ids` |
| Every act's story events played on the simulation, reload mid-event | VERIFIED | `sigilfall-vale`, `-road`, `-alliance`, `-gates` |
| Old saves 1 → 8 migrate, keep level, talents, loadouts, items; injected data rejected | VERIFIED | `sigilfall-world`, `sigilfall-collection`, `sigilfall-progression` |
| Touch: two thumbs, ownership, release on cancel/blur/unmount | VERIFIED | `sigilfall-touch` |
| Touch HUD on a phone on its side (inside the page) and a tablet | MANUALLY VERIFIED | SIGILFALL_QA.md |
| Desktop keys: `Y` calls the mount, `Q` gets the hero down and casts in one press | MANUALLY VERIFIED | real key presses in the dev browser, the engine stepped frame by frame |
| Camera without jitter | VERIFIED | `sigilfall-camera` |
| Depth sorting of trees and roofs | UNVERIFIED | never reproduced (REFACTOR_AUDIT.md) |
| Loot: fewer, better drops; looks kept after salvage | VERIFIED | PROGRESSION_BALANCE.md Part 3, `sigilfall-collection` |
| Leveling curve, XP by act, talent cadence, spell unlocks, ultimate frequency | VERIFIED | `sigilfall-progression`, `sigilfall` |
| Boss progression and partial CC | VERIFIED | `sigilfall-new-skills`, dungeon tests |
| World states and sieges (Hearthstead, Highwall, the Gates) | VERIFIED | `sigilfall-vale`, `sigilfall-alliance`, `sigilfall-gates` |
| Wardrobe overrides change looks only, survive save/load | VERIFIED | `sigilfall-collection` |
| Mounts: call, refusals, dismount on hit/action/event, saved | VERIFIED | `sigilfall-collection` |
| Interiors: doors in and out, barred on the raid night | VERIFIED | `sigilfall-interiors` |
| Scenes: skip, once only, reload-safe, an attack stops one | VERIFIED | `sigilfall-scenes` |
| American spelling, no old-story words in player text | VERIFIED | `sigilfall-words` |
| Act VI, Crownfall, the Epilogue, postgame | PENDING | in progress |
| Frame time on a real phone in the heaviest battle | UNVERIFIED | no device in this cycle; dev-browser figures in docs/review/README.md |
| Audio (volumes, mute, the new stingers and the bell) | UNVERIFIED | synthesized; not listened to in this cycle |

## Rollback

Each batch is one commit on `pre-release`; reverting a commit rolls back that batch. Saves are forward
compatible within a version: a newer save opened by an older build is left untouched ("newer" status), so a
rollback never destroys progress.
