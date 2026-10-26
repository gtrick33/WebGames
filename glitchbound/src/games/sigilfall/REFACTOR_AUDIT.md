# Sigilfall — Refactor Audit & Stabilization (Blueprint V2.9, Prompts 0–1)

Baseline: `4013e1b` (Acts I–III, live on pre-release). The Act IV work in progress (Hollow King story) is frozen on the
`sigilfall-4b-wip` branch, and the Riftstone endgame on `sigilfall-phase5`: the blueprint's new story (*The Crown of
Ash and Starlight*) rewrites the quest narrative, so finishing the old Act IV text first would be wasted work. Both
keep their zones, enemies, dungeons and systems for reuse under the new story (IDs preserved for save safety).

## Assets — unblocked

The packs are in `glitchbound/assets/sigilfall/` (`82c38567`). ASSET_AUDIT.md maps every pack to its §3.4 level and
role; two listed packs are missing (CraftPix village buildings, boss creatures). The packs being in a **public**
repository is an open licensing risk (ASSET_AUDIT.md, escalations).

## Prompt 0 findings (2026-10-26, measured)

- **Code map**: `sim/` (world, cast, combat, AI, bosses, map) never reads the DOM; `render/` draws; `progress/`
  holds saves and builds; `data/` is content. Large files to split only when touched: `sim/world.ts` (1.7k lines),
  `render/renderer.ts` (1.8k).
- **Skills**: six per class, unlocking at 1, 2, 4, 6, 14, 22 — nothing new from 22 to 60 (PROGRESSION_BALANCE.md).
- **XP**: quest XP alone over-levels a completionist by ~5–6 levels by Highwall.
- **Ultimate**: the charge floor is 1.5–6 s per full bar.
- **Story**: the old Hollow King telling is replaced by *The Crown of Ash and Starlight* (STORY_BIBLE.md); all 296
  quest ids are kept and mapped (QUEST_REWRITE_MAP.md).
- **Art**: the game is drawn on a 32 px pixel grid; the approved style needs 64 px per tile (ASSET_AUDIT.md).

## Section 8 bugs — status

| Issue | Status | Evidence |
| --- | --- | --- |
| "Open Barrow" progression | **Fixed.** Root cause: a sight (or shrine) counted only the first time it was found. Reaching the Kings' Mound (the Barrow of Kings' door) before *The Kings' Mound* was given made that quest, and its chain, impossible; the same held for every explore quest. A found place now counts again whenever the hero returns while a quest asks for it. | `tests/sigilfall-quests-doable.test.ts` (regression) |
| Quests that can never finish | **Guarded.** All 296 quests are checked: sight on the map in the quest's zone, kill/loot targets living there, the person standing somewhere, the boss having a room, prerequisites existing. All pass. | same file |
| Duskspire / dungeon registry mismatch | **Guarded.** No road or door in the shipped build leads to an unregistered region; Duskspire's files are inert until Act IV registers them. | `tests/sigilfall-ids.test.ts` |
| Ultimate spam (multi-hit/DoT) | Fixed in Act III: charge normalized to the class's reference damage and rate-limited by a level-scaled token bucket (`ultFloor`, sim/world.ts); DoT ticks charge at 40 %. | economy/sim tests |
| Stuck joystick / pointer ownership | **Not reproduced; regression-tested.** The stick releases on pointerup, pointercancel, lostpointercapture, window blur, tab hide, and when the controls unmount (a menu opening); a second finger can't take the stick over. | `tests/sigilfall-touch.test.tsx` |
| Camera jitter vs shake | **Fixed** (`6943aa45`). Root cause: the camera leaned on the aim, and the mouse aim is measured from the camera, so each camera move changed the next lean; the view also stepped a whole world pixel (6 device px). Lean now follows the cursor's place on screen; the camera moves a device pixel at a time. | `tests/sigilfall-camera.test.ts` |
| Tree/roof depth sorting | Not reproduced. Needs the place and screenshot. | — |
| Loot frequency / clutter | Open (P2). To be retuned with the progression pass (Prompt 3). | — |
| Quest auto-activation | **Fixed.** The first quest of a giver's chain is offered ("!" over them) and starts when the hero talks to them; later steps of the same giver's chain and the story's own beats continue by themselves (`needsAccept`). Saves keep offers. | `tests/sigilfall-world.test.ts` |
| HUD clipping with a new spell button | The 4th button is in the thumb cluster (`0fc10e2b`); the potion moved beside the ultimate. Phone/tablet screenshots pending (Phase 2 evidence). | — |
| Save migration tests | Present for v1 to v2 (`tests/sigilfall-*`); new fields (Riftstones) validated in their branch. | — |

## Next phases

See EXECUTION_PLAN.md (the whole game, prompt by prompt) and SIGILFALL_QA.md (how a build is checked, coverage, known issues).
