import { describe, expect, it } from 'vitest';
import { EVENTS } from '../src/games/sigilfall/data/events';
import { GREAT } from '../src/games/sigilfall/data/greatworks';
import { SCENES } from '../src/games/sigilfall/data/scenes';
import { applyPreset, PRESETS } from '../src/games/sigilfall/progress/presets';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { TILE } from '../src/games/sigilfall/sim/map';
import { endScene, type SceneDef } from '../src/games/sigilfall/sim/scene';
import { holds } from '../src/games/sigilfall/sim/story';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { heroAtEvent, newWorld, readyHero } from './sigilfall-bot';

/**
 * Where a story scene's camera goes (the owner: "the camera points at nothing"): every shot plays at its moment, and
 * finds something there to see, not bare ground and not the back of a great work.
 */

const DT = 1 / 60;
/** How far from a shot's middle the thing it's for may be. */
const SEES = 6 * TILE;

function worldAt(def: SceneDef): World | null {
  if (def.when) {
    const preset = PRESETS.find((p) => {
      if (!p.label.includes('(scene)') || p.region !== def.region) return false;
      const c = readyHero('mage', 2);
      applyPreset(c, p);
      return holds(c, def.when!);
    });
    if (!preset) return null;
    const c = readyHero('mage', preset.level);
    applyPreset(c, preset);
    return newWorld(def.region, c);
  }
  return newWorld(def.region, heroAtEvent(def.opens!.event));
}

/** Plays up to the scene: a story fight's waves fall until its shot comes. */
function begin(w: World, def: SceneDef): void {
  for (const s of SCENES) if (s.id !== def.id && s.region === def.region && !w.hero.opened.includes(`scene:${s.id}`)) w.hero.opened.push(`scene:${s.id}`);
  w.enemies = [];
  if (def.when) {
    const at = def.near ? (w.places[def.near] ?? w.spots.find((x) => x.id === def.near) ?? w.npcs.find((n) => n.id === def.near)) : null;
    if (at) {
      w.player.x = at.x;
      w.player.y = at.y + 20;
    }
  } else {
    const at = w.places[EVENTS[def.opens!.event]!.at];
    if (at) {
      w.player.x = at.x;
      w.player.y = at.y + 10;
    }
  }
  for (let i = 0; i < 5400 && w.scene?.def.id !== def.id; i++) {
    w.input = emptyInput();
    w.player.hp = w.player.maxHp;
    if (w.scene) endScene(w, true);
    w.step(DT);
    if (i % 60 === 59 && !w.scene) for (const e of w.enemies) if (!e.dead && e.aggro) hitEnemy(w, e, 1e7, 'physical', { depth: 0 });
  }
}

/** Something to look at near a spot: anyone there, a building, a thing that stands. */
function somethingAt(w: World, x: number, y: number): boolean {
  const near = (a: number, b: number): boolean => Math.hypot(a - x, b - y) < SEES;
  if (w.npcs.some((n) => near(n.x, n.y)) || w.pets.some((p) => !p.dead && near(p.x, p.y)) || w.enemies.some((e) => !e.dead && near(e.x, e.y))) return true;
  if (near(w.player.x, w.player.y)) return true;
  for (const b of w.map.buildings) {
    const d = Math.hypot(Math.max(b.lot.tx * TILE - x, 0, x - (b.lot.tx + b.lot.w) * TILE), Math.max(b.lot.ty * TILE - y, 0, y - (b.lot.ty + b.lot.h) * TILE));
    if (d < SEES) return true;
  }
  return w.map.markers.some((pm) => w.isShown(pm) && near((pm.tx + 0.5) * TILE, (pm.ty + 0.5) * TILE) && ((pm.marker.kind === 'prop' && pm.marker.prop !== 'block') || pm.marker.kind === 'waystone' || pm.marker.kind === 'fire'));
}

/** Whether a great work stands between the camera and a spot: it rises up the screen from its feet. */
function behindGreatWork(w: World, x: number, y: number): string | null {
  for (const pm of w.map.markers) {
    if (pm.marker.kind !== 'prop' || !pm.marker.prop.startsWith('great:')) continue;
    const id = pm.marker.prop.slice(6);
    const def = GREAT[id];
    if (!def || def.parts.every((p) => (p.h ?? 0) < 10)) continue;
    const px = (pm.tx + 0.5) * TILE;
    const py = (pm.ty + 0.5) * TILE;
    // (only what's solid across: the great things' legs and walls, not the air beside them)
    for (const [x0, , x1, y1] of def.solid) {
      if (x < px + x0 * TILE - 13 || x > px + (x1 + 1) * TILE + 13) continue;
      const tall = Math.max(...def.parts.map((p) => p.h ?? 0)) * 0.6;
      if (y < py + (y1 + 1) * TILE && y > py - tall * TILE) return id;
    }
  }
  return null;
}

describe('Sigilfall: where the camera goes', () => {
  it('every shot of every scene finds something there to see', { timeout: 240_000 }, () => {
    const faults: string[] = [];
    for (const def of SCENES) {
      const w = worldAt(def);
      if (!w) {
        faults.push(`${def.id}: nothing puts a hero at its moment`);
        continue;
      }
      begin(w, def);
      if (w.scene?.def.id !== def.id) {
        faults.push(`${def.id}: never played`);
        continue;
      }
      let seen = -1;
      for (let t = 0; t < 70 && w.scene; t += DT) {
        w.input = emptyInput();
        w.player.hp = w.player.maxHp;
        const s = w.scene;
        const st = s.def.steps[s.step];
        if (st && 'look' in st && st.look !== 'hero' && s.begun && s.step !== seen) {
          seen = s.step;
          const f = s.focus;
          if (!f) faults.push(`${def.id}: nothing called ${st.look} is there`);
          else {
            if (!somethingAt(w, f.x, f.y)) faults.push(`${def.id}: nothing to see at ${st.look}`);
            const hides = behindGreatWork(w, f.x, f.y);
            if (hides) faults.push(`${def.id}: ${st.look} is behind ${hides}`);
          }
        }
        w.step(DT);
      }
    }
    expect(faults).toEqual([]);
  });

  it('a building a shot looks at is framed where it stands, in the world’s own units', () => {
    const def = SCENES.find((s) => s.id === 'briar-the-toll')!;
    const w = worldAt(def)!;
    begin(w, def);
    const chapel = w.map.buildings.find((b) => b.name === 'Chapel of the Bell')!;
    for (let t = 0; t < 12 && w.scene; t += DT) {
      w.step(DT);
      const s = w.scene;
      const st = s?.def.steps[s.step];
      if (st && 'look' in st && st.look === 'Chapel of the Bell' && s?.focus) {
        expect(s.focus.x).toBeGreaterThan(chapel.lot.tx * TILE);
        expect(s.focus.x).toBeLessThan((chapel.lot.tx + chapel.lot.w) * TILE);
        expect(s.focus.y).toBeGreaterThan((chapel.lot.ty - 2) * TILE);
        expect(s.focus.y).toBeLessThan((chapel.lot.ty + chapel.lot.h) * TILE);
        return;
      }
    }
    throw new Error('the scene never looked at the chapel');
  });
});
