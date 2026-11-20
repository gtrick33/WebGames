/**
 * Footsteps (POLISH_PLAN.md piece 25): the hero's feet heard on what they walk on, a step a stride, on grass, stone,
 * planks, snow or sand; never riding, dodging, in a scene or across a cut.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SAMPLES } from '../src/games/sigilfall/audio/samples';
import { groundAt, STEP_SOUND, Steps, STRIDE } from '../src/games/sigilfall/audio/steps';
import { K, TILE } from '../src/games/sigilfall/sim/map';
import { newWorld, readyHero } from './sigilfall-bot';

describe('Sigilfall: footsteps', () => {
  it('every ground has a step, and every step is a recording that ships', () => {
    for (const id of Object.values(STEP_SOUND)) {
      expect(SAMPLES[id], id).toBeDefined();
      for (const f of SAMPLES[id]!.files) expect(existsSync(`public/games/sigilfall/audio/${f}.mp3`), f).toBe(true);
    }
  });

  it('hears the ground under the hero: a road’s cobbles, a bridge’s planks, a crypt’s flags, the meadow', () => {
    const w = newWorld('whisperwood', readyHero('warrior', 6));
    const at = (k: number): { x: number; y: number } | null => {
      const i = w.map.kind.findIndex((v, n) => v === k && !w.map.solid[n]);
      return i < 0 ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
    };
    const floor = at(K.Floor)!;
    expect(groundAt(w, floor.x, floor.y)).toBe('grass');
    const bridge = at(K.Bridge);
    if (bridge) expect(groundAt(w, bridge.x, bridge.y)).toBe('wood');
    const cobble = at(K.Cobble);
    if (cobble) expect(groundAt(w, cobble.x, cobble.y)).toBe('stone');
    const crypt = newWorld('crypt', readyHero('warrior', 6));
    expect(groundAt(crypt, crypt.player.x, crypt.player.y)).toBe('stone');
    expect(groundAt(w, -50, -50)).toBeNull();
  });

  it('a step a stride as the hero walks, none while riding, dodging, or across a jump', () => {
    const w = newWorld('whisperwood', readyHero('warrior', 6));
    const steps = new Steps();
    const p = w.player;
    expect(steps.step(w)).toBeNull();
    let heard = 0;
    for (let i = 0; i < 40; i++) {
      p.x += STRIDE / 4;
      if (steps.step(w)) heard++;
    }
    expect(heard).toBe(10);
    p.riding = 'briarhollow-chestnut';
    for (let i = 0; i < 20; i++) {
      p.x += STRIDE / 2;
      expect(steps.step(w)).toBeNull();
    }
    p.riding = null;
    // (a door or a cut moves the hero far at once: not a step)
    p.x += TILE * 10;
    expect(steps.step(w)).toBeNull();
  });
});
