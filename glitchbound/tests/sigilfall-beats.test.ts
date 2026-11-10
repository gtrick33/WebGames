/**
 * Story beats (sim/scene.ts questBeat): every step of the main story with no scene of its own gets a beat as it
 * begins, in the game (tests leave them off): its name, a sound, the camera out to where it leads and back. Once a
 * step, skippable, and never for the opening night, which is staged by hand.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { endScene, questBeat } from '../src/games/sigilfall/sim/scene';
import { emptyInput, World } from '../src/games/sigilfall/sim/world';
import { readyHero } from './sigilfall-bot';

const DT = 1 / 60;
function world(beats: boolean): World {
  const c = readyHero('warrior', 4);
  // (the Alpha: Grimtusk has no scene of its own yet; the trail into the wood has one)
  c.quests['into-the-wood'] = { state: 'done', n: 6 };
  c.quests['alpha'] = { state: 'active', n: 0 };
  c.tracked = 'alpha';
  const w = new World({ region: 'whisperwood', tier: 0, mods: [], hero: c, settings: { ...DEFAULT_SETTINGS }, seed: 1, beats });
  w.enemies = [];
  return w;
}
const run = (w: World, s: number): void => {
  for (let t = 0; t < s; t += DT) {
    w.input = emptyInput();
    w.step(DT);
  }
};

describe('sigilfall: story beats', () => {
  it('a main quest step with no scene of its own gets a beat in its land: its name, then the camera to where it leads', () => {
    const w = world(true);
    run(w, 1);
    expect(w.scene?.def.id).toBe('beat:alpha:0');
    expect(w.scene!.def.steps[0]).toMatchObject({ title: expect.any(String) });
    run(w, 10);
    expect(w.scene).toBeNull();
    expect(w.hero.opened).toContain('scene:beat:alpha:0');
    // once a step
    run(w, 4);
    expect(w.scene).toBeNull();
    expect(questBeat(w)).toBeNull();
  });

  it('skipping a beat gives the hero back at once; tests (and co-op) play none', () => {
    const w = world(true);
    run(w, 1);
    expect(w.scene).not.toBeNull();
    endScene(w, true);
    expect(w.scene).toBeNull();
    const off = world(false);
    run(off, 6);
    expect(off.scene).toBeNull();
  });

  it('the opening night has no beats: it is staged by hand', () => {
    const w = world(true);
    w.hero.quests = { 'briar-dusk': { state: 'active', n: 0 } };
    expect(questBeat(w)).toBeNull();
  });
});
