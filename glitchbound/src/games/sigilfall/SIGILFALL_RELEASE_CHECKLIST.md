# Sigilfall — Release Checklist (blueprint Prompt 16)

Status words: **VERIFIED** (an automated test or check proves it), **MANUALLY VERIFIED** (seen working in the
browser this cycle), **UNVERIFIED** (not checked, with the reason).

## Gates

| Check | Status |
| --- | --- |
| Typecheck `npx tsc --noEmit -p .` | VERIFIED (clean) |
| Lint `npx eslint src/games/sigilfall tests/sigilfall*` | VERIFIED (clean) |
| Sigilfall tests `npx vitest run --no-fsModuleCache tests/sigilfall*` | VERIFIED (42 files, 1,096 tests, all passing; the whole project: 121 files, 1,988 tests) |
| Production build `npm run build` | VERIFIED (the arcade's startup JS stays under its 121 KB budget) |
| `validate:sigilfall` | the registry, quest and collection validations run as tests (`sigilfall-ids`, `sigilfall-quests-doable`, `sigilfall-dungeons`, `sigilfall-collection`, `sigilfall-words`) — VERIFIED |

## By area

| Area | Status | Evidence |
| --- | --- | --- |
| All eight classes clear the opening dungeons on every tier (bot) | VERIFIED | `sigilfall-sim`, `sigilfall-dungeon-*` |
| Every zone's quests can be finished; no road to an unregistered region | VERIFIED | `sigilfall-quests-doable`, `sigilfall-ids` |
| The whole campaign plays from a new save by the quest arrow, all 515 quests, no dead end | VERIFIED | `sigilfall-campaign` |
| Fog of war on the maps, kept on the save; map icons | VERIFIED | `sigilfall-guidance`; seen in the browser |
| UI at 1440 × 900, 1024 × 768, phones on their side and upright, full screen: no overlap, nothing over the stage | MANUALLY VERIFIED | SIGILFALL_QA.md, hardening pass |
| Every act's story events played on the simulation, reload mid-event | VERIFIED | `sigilfall-vale`, `-road`, `-alliance`, `-gates`, `-rimeheld`, `-finale` |
| Old saves 1 → 9 migrate, keep level, talents, loadouts, items; injected data rejected | VERIFIED | `sigilfall-world`, `sigilfall-collection`, `sigilfall-progression` |
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
| Act VI (every faction's troop by what was done), Crownfall's four stages and Elyra's choice, the Epilogue, the postgame threads and Heroic/Mythic | VERIFIED | `sigilfall-finale`, `sigilfall-dungeon-duskspire`, `-vaelmoor-remembered`, `-crown-catacombs` |
| The Last March camp, the memory of Vaelmoor, Haldor's bell in rebuilt Briarhollow, Elyra by Lastlight's fire, Ysane's echo | MANUALLY VERIFIED | review presets in the dev browser; docs/review/phase-14 |
| Frame time on a real phone in the heaviest battle | UNVERIFIED | no device in this cycle; dev-browser figures in docs/review/README.md |
| Audio (volumes, mute, the recorded effects, ambience and soundtrack of 2026-11-11) | UNVERIFIED | chosen by description and loudness, never listened to; `audio/samples.ts` and `audio/tracks.ts` are where to change them |

## Known issues accepted for release

| Severity | Issue |
| --- | --- |
| P3 | The bot's warrior wins Mythic Morgrave about half the time once its potions are gone; the test gives it a second try |
| P3 | New dungeons' foes and the finale's bosses are recolors of the approved art, not bespoke drawings |
| P3 | Mounts are painted in code (a production brief for drawn art is in COLLECTION_SYSTEM_DESIGN.md) |
| P3 | Frostfang is built but unregistered: no beat of the story needs it |

No known P0 or P1 issue remains.

## Rollback

Each batch is one commit on `pre-release`; reverting a commit rolls back that batch. Saves are forward
compatible within a version: a newer save opened by an older build is left untouched ("newer" status), so a
rollback never destroys progress.
