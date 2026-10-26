# Sigilfall — Refactor Audit & Stabilization (Blueprint V2.9, Prompts 0–1)

Baseline: `4013e1b` (Acts I–III, live on pre-release). The Act IV work in progress (Hollow King story) is frozen on the
`sigilfall-4b-wip` branch, and the Riftstone endgame on `sigilfall-phase5`: the blueprint's new story (*The Crown of
Ash and Starlight*) rewrites the quest narrative, so finishing the old Act IV text first would be wasted work. Both
keep their zones, enemies, dungeons and systems for reuse under the new story (IDs preserved for save safety).

## Assets — BLOCKED

The approved stack (Section 3: Royal Keep, Willosuna Magic Spells VFX, the Top-Down RPG Worlds bundle, the CraftPix
village/swamp/towers/bosses packs, Magic Circles Lite, reodesuxz castle interior) is on the developer's desktop
("Sigilfall Assets"), which this cloud build environment cannot read. Every art phase (Prompts 2, 4, 6, 7, 12–15)
waits on it. To unblock: commit the folder to the repository (outside the runtime bundle, e.g.
`glitchbound/assets-src/sigilfall/`, Git LFS if large) or attach the packs to the session. ASSET_AUDIT.md and
CREDITS_AND_LICENSES.md are written at import, from the licence files that ship with each pack.

## Section 8 bugs — status

| Issue | Status | Evidence |
| --- | --- | --- |
| "Open Barrow" progression | **Fixed.** Root cause: a sight (or shrine) counted only the first time it was found. Reaching the Kings' Mound (the Barrow of Kings' door) before *The Kings' Mound* was given made that quest, and its chain, impossible; the same held for every explore quest. A found place now counts again whenever the hero returns while a quest asks for it. | `tests/sigilfall-quests-doable.test.ts` (regression) |
| Quests that can never finish | **Guarded.** All 296 quests are checked: sight on the map in the quest's zone, kill/loot targets living there, the person standing somewhere, the boss having a room, prerequisites existing. All pass. | same file |
| Duskspire / dungeon registry mismatch | **Guarded.** No road or door in the shipped build leads to an unregistered region; Duskspire's files are inert until Act IV registers them. | `tests/sigilfall-ids.test.ts` |
| Ultimate spam (multi-hit/DoT) | Fixed in Act III: charge normalized to the class's reference damage and rate-limited by a level-scaled token bucket (`ultFloor`, sim/world.ts); DoT ticks charge at 40 %. | economy/sim tests |
| Stuck joystick / pointer ownership | **Not reproduced.** The stick releases on pointerup, pointercancel, lostpointercapture, window blur, tab hide, and when the controls unmount (a menu opening). Needs the device, browser and steps that reproduce it. | ui/Touch.tsx |
| Camera jitter vs shake | Not reproduced at baseline (camera pinned to the hero's pixel since Phase 1). Needs a repro. | — |
| Tree/roof depth sorting | Not reproduced. Needs the place and screenshot. | — |
| Loot frequency / clutter | Open (P2). To be retuned with the progression pass (Prompt 3). | — |
| Quest auto-activation | **Open (P1, design).** A quest starts as soon as its prerequisites are done and the hero has been to its zone, without talking to its giver. Fixing it means an accept step at the giver, which changes the quest log and the test bot; scheduled with the quest rewrite (Prompt 8). | progress/character.ts `startQuests` |
| HUD clipping with a new spell button | Waits for Prompt 5 (the extra button). | — |
| Save migration tests | Present for v1 to v2 (`tests/sigilfall-*`); new fields (Riftstones) validated in their branch. | — |

## Next phases (blueprint order)

1. Asset import + ASSET_AUDIT (needs the packs) → Prompt 2 vertical slice (Briarhollow + one dungeon + one hero).
2. Prompt 3 progression design table (no assets needed): can run now if approved.
3. Prompt 5 extra spell button (no assets needed for the system; VFX later).
