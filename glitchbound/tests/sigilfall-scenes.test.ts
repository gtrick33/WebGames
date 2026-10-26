import { describe, expect, it } from 'vitest';
import { SCENES } from '../src/games/sigilfall/data/scenes';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { applyPreset, PRESETS } from '../src/games/sigilfall/progress/presets';
import { migrate, SAVE_VERSION } from '../src/games/sigilfall/progress/save';
import { endScene } from '../src/games/sigilfall/sim/scene';
import { holds } from '../src/games/sigilfall/sim/story';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * Scenes and review presets (blueprint Prompt 9): every scene names people and places that are there at its
 * moment, plays through, can be skipped, never plays twice, and is safe across a reload; every preset puts a
 * hero at its beat.
 */

const DT = 1 / 60;
const run = (w: World, s: number): void => {
  for (let t = 0; t < s; t += DT) {
    w.input = emptyInput();
    w.step(DT);
  }
};
/** A hero at the preset whose beat shows this scene. */
function atScene(id: string) {
  const preset = PRESETS.find((p) => p.label.includes('(scene)') && SCENES.find((s) => s.id === id)!.region === p.region && holdsFor(p, id));
  expect(preset, `a preset for ${id}`).toBeDefined();
  const c = readyHero('mage', preset!.level);
  applyPreset(c, preset!);
  return c;
}
function holdsFor(p: (typeof PRESETS)[number], id: string): boolean {
  const c = readyHero('mage', 2);
  applyPreset(c, p);
  return holds(c, SCENES.find((s) => s.id === id)!.when);
}
/** Puts the hero where the scene is set and lets it begin. */
function startAt(w: World, id: string): void {
  const def = SCENES.find((s) => s.id === id)!;
  w.enemies = [];
  const at = def.near ? (w.places[def.near] ?? w.npcs.find((n) => n.id === def.near)) : null;
  if (at) {
    w.player.x = at.x;
    w.player.y = at.y + 20;
  }
  run(w, 0.6);
}

describe('Sigilfall: scenes', () => {
  it('every preset puts a hero at its beat, and the beat’s quest exists', () => {
    for (const p of PRESETS) {
      if (p.active) expect(QUEST_DEFS[p.active], p.id).toBeDefined();
      for (const d of p.done ?? []) expect(QUEST_DEFS[d], p.id).toBeDefined();
      const c = readyHero('warrior', 2);
      applyPreset(c, p);
      expect(c.level).toBeGreaterThanOrEqual(p.level);
      expect(c.review).toBe(true);
      if (p.active) expect(c.quests[p.active]?.state).toBe('active');
      expect(() => newWorld(p.region, c)).not.toThrow();
    }
  });

  it('every scene plays at its moment, with everyone it names there, and ends', () => {
    for (const def of SCENES) {
      const w = newWorld(def.region, atScene(def.id));
      startAt(w, def.id);
      expect(w.scene?.def.id, def.id).toBe(def.id);
      const named = new Set(def.steps.flatMap((s) => ('say' in s ? [s.say] : 'move' in s ? [s.move] : 'emote' in s ? [s.emote] : [])));
      for (const who of named) expect(w.npcs.some((n) => n.id === who) || who === 'hero', `${def.id}: ${who}`).toBe(true);
      for (const s of def.steps) if ('look' in s && s.look !== 'hero') expect(!!w.places[s.look] || w.npcs.some((n) => n.id === s.look), `${def.id}: ${s.look}`).toBe(true);
      run(w, 60);
      expect(w.scene, def.id).toBeNull();
      expect(w.hero.opened).toContain(`scene:${def.id}`);
    }
  });

  it('the hero stands still while a scene plays; skipping ends it and it never plays again', () => {
    const def = SCENES[0]!;
    const c = atScene(def.id);
    const w = newWorld(def.region, c);
    startAt(w, def.id);
    expect(w.scene).not.toBeNull();
    const x0 = w.player.x;
    for (let i = 0; i < 30; i++) {
      w.input = { ...emptyInput(), mx: 1 };
      w.step(DT);
    }
    expect(w.player.x).toBe(x0);
    endScene(w, true);
    expect(w.scene).toBeNull();
    const speakers = def.steps.flatMap((s) => ('say' in s ? [s.say] : []));
    expect(w.story.speech.filter((s) => speakers.includes(s.who))).toEqual([]);
    const again = newWorld(def.region, c);
    startAt(again, def.id);
    expect(again.scene).toBeNull();
  });

  it('a reload in the middle plays the scene again from the start (nothing was kept of it)', () => {
    const def = SCENES[0]!;
    const c = atScene(def.id);
    const w = newWorld(def.region, c);
    startAt(w, def.id);
    run(w, 2);
    expect(w.scene).not.toBeNull();
    const saved = migrate(JSON.parse(JSON.stringify({ v: SAVE_VERSION, heroes: [c], last: 0, settings: {}, saved: 0 })))!.heroes[0]!;
    expect(saved.opened).not.toContain(`scene:${def.id}`);
    expect(saved.review).toBe(true);
    const back = newWorld(def.region, saved);
    startAt(back, def.id);
    expect(back.scene?.step).toBe(0);
  });

  it('an attack stops a scene, which then plays another time', () => {
    const def = SCENES[0]!;
    const c = atScene(def.id);
    const w = newWorld(def.region, c);
    startAt(w, def.id);
    expect(w.scene).not.toBeNull();
    const foe = w.addEnemy('skeleton', w.player.x + 140, w.player.y, 5, { room: -1, pack: 0 });
    foe.aggro = true;
    run(w, 0.1);
    expect(w.scene).toBeNull();
    expect(c.opened).not.toContain(`scene:${def.id}`);
  });
});
