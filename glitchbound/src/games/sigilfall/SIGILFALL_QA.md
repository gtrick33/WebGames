# Sigilfall — QA (blueprint Prompt 1, kept current every batch)

## How to check a build

```
cd glitchbound
npx tsc --noEmit -p .
npx eslint src/games/sigilfall tests/sigilfall*
npx vitest run --no-fsModuleCache tests/sigilfall*
npm run build
```

`--no-fsModuleCache`: the shared Vitest cache sees other sessions' half-written files (parallel sessions share
this checkout). Review screenshots: on the dev server, `window.__rbShot('phase-XX/name.png', [w, h])` saves
the game view to `docs/review/`; review presets (Settings, on the dev server or with `?review`) jump a hero to
a story beat.

## Coverage by area

| Area | Tests |
| --- | --- |
| Save versions 1→8, field validation, migrations of every act, Wardrobe and mount backfill | `sigilfall-world`, `sigilfall-story`, `sigilfall-vale`, `sigilfall-road`, `sigilfall-alliance`, `sigilfall-collection`, `sigilfall-progression` |
| Quests can be finished (places, foes, people, bosses, prerequisites) | `sigilfall-quests-doable` |
| Region, dungeon and id integrity (no road to an unregistered region) | `sigilfall-ids`, `sigilfall-dungeons` |
| Every act's events played on the simulation | `sigilfall-vale` (Act I), `sigilfall-road` (Act II), `sigilfall-alliance` (Acts III–IV) |
| Classes, skills, talents, ultimate charge and its exploits | `sigilfall`, `sigilfall-classes`, `sigilfall-new-skills`, `sigilfall-economy`, `sigilfall-sim` |
| Bot play-throughs of dungeons on every tier | `sigilfall-sim`, `sigilfall-dungeon-*` |
| Camera (no jitter between aim and camera) | `sigilfall-camera` |
| Touch: two thumbs, finger ownership, release on cancel/lost capture/blur/unmount | `sigilfall-touch` |
| Wardrobe looks never change stats; mounts: call, refusals, dismount on hit/action/event | `sigilfall-collection` |
| Interiors: doors in and out, raid-night bars, everyone reachable, nobody rides indoors | `sigilfall-interiors` |
| Scenes and review presets: everyone named is there, skip, once only, reload-safe | `sigilfall-scenes` |
| Art integrity (every named piece exists), the ground painter, the hero's look | `sigilfall-art`, `sigilfall-ground`, `sigilfall-look` |

## Known issues

| Severity | Issue | State |
| --- | --- | --- |
| P3 | The bot's warrior loses Mythic Morgrave about half the time once its potions are gone (the test gives it a second try, as a player would restock) | accepted; the play-through test allows 30 s for its three runs |
| P3 | The arcade's startup JavaScript is at 119.9 of its 120 KB budget (none of it is Sigilfall's: the game loads on its own page) | watch |
| — | Stuck joystick | not reproduced; now regression-tested (`sigilfall-touch`) |
| — | Tree/roof depth sorting | not reproduced; needs the place and a screenshot |
| P2 | Loot clutter | open (Prompt 11) |

## Manual checks done in the browser (this batch)

- Wardrobe tab (looks, locked silhouettes and sources, apply/clear, mounts) on a narrow pane.
- Riding the Briarhollow Chestnut and the Royal Warhorse in four facings, with a Wardrobe hat on the rider.
- All six interiors entered through their doors; the camp's banners and cots show by progress.
- The first-dawn scene in Briarhollow through the review preset.
- A phone on its side (740 × 360) inside the page: the site's bars leave the game a 192 px stage; the thumb
  cluster now scales to the stage's own height (container queries in Game.css) and the tracker, minimap and
  interact button make room. A tablet (768 × 1024) shows the turn-sideways hint over a HUD that fits.
- Every land toured at 640 × 360: hairlines between ground chunks in small windows (fixed), one cave mouth for
  every dungeon (each has its own door now), the same pillar ring in every ruin (each land's own stones now),
  the fey wood's noisy paving (plain cobble now), sparse meadows (plants in clumps now).
