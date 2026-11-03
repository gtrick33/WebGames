import { describe, expect, it } from 'vitest';
import { EVENTS } from '../src/games/sigilfall/data/events';
import { placePet } from '../src/games/sigilfall/sim/pets';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/** Nobody stands in anybody else: the models are about 20 world pixels wide, and groups read as people, not a heap. */
const CLOSEST = 16;

const DT = 1 / 60;

function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) w.step(DT);
}

function closest(w: World): number {
  const list = w.pets.filter((p) => !p.dead && p.def.role !== 'ward');
  let best = Infinity;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) best = Math.min(best, Math.hypot(list[i]!.x - list[j]!.x, list[i]!.y - list[j]!.y));
  }
  return best;
}

describe('sigilfall: people keep their distance', () => {
  it('companions at heel stand apart, and out of the hero', () => {
    const w = newWorld('briarhollow', readyHero('warrior', 20));
    for (let i = 0; i < 5; i++) placePet(w, 'fern-ranger', w.player.x, w.player.y);
    run(w, 6);
    expect(closest(w)).toBeGreaterThan(CLOSEST);
    for (const p of w.pets) expect(Math.hypot(p.x - w.player.x, p.y - w.player.y)).toBeGreaterThan(CLOSEST);
  });

  it('companions stay apart while the hero walks', () => {
    const w = newWorld('briarhollow', readyHero('warrior', 20));
    for (let i = 0; i < 4; i++) placePet(w, 'hearth-rider', w.player.x + i, w.player.y);
    run(w, 2);
    for (let t = 0; t < 3; t += DT) {
      w.input.mx = 0;
      w.input.my = 1;
      w.step(DT);
    }
    w.input.my = 0;
    run(w, 2);
    expect(closest(w)).toBeGreaterThan(CLOSEST);
  });

  // every group the story walks in, leads out or stands round a spot, in every quest
  const groups = Object.values(EVENTS).filter((d) => (d.arrive?.pets.length ?? 0) > 1 || (d.rescue?.pets.length ?? 0) > 1 || (d.escort?.walkers?.length ?? 0) > 1);
  it('there are such groups to check', () => {
    expect(groups.length).toBeGreaterThan(10);
  });
  for (const def of groups) {
    it(`${def.id}: nobody is in a heap`, () => {
      const w = newWorld(def.region, readyHero('warrior', 30));
      const at = w.places[def.at ?? ''] ?? w.player;
      w.player.x = at.x;
      w.player.y = at.y;
      (w.story as unknown as { start(d: typeof def): void }).start(def);
      w.scene = null;
      // (the shot that opens it is not the point here, nor are its waves)
      run(w, 12);
      expect(closest(w)).toBeGreaterThan(CLOSEST);
    });
  }
});
