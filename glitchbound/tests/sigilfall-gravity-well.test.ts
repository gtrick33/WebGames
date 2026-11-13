import { describe, expect, it } from 'vitest';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import { updateFields } from '../src/games/sigilfall/sim/cast';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

const run = (w: World, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    w.input = emptyInput();
    w.player.hp = w.player.maxHp;
    w.step(1 / 60);
  }
};

/** A well opened in open ground with foes standing at its rim, the hero well away (they would walk off to the hero). */
function well(): { w: World; x: number; y: number; foes: World['enemies'] } {
  const w = newWorld('whisperwood', readyHero('mage', 20));
  w.enemies.length = 0;
  const spec = SKILLS['gravity-well']!.base;
  const p = w.player;
  const x = p.x + 150;
  const y = p.y;
  const foes = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const e = w.addEnemy('hill-wolf', x + Math.cos(a) * (spec.area - 4), y + Math.sin(a) * (spec.area - 4), 20, { room: -1, pack: -1, post: true });
    e.x = x + Math.cos(a) * (spec.area - 4);
    e.y = y + Math.sin(a) * (spec.area - 4);
    e.hp = e.maxHp = 1e7;
    e.aggro = true;
    e.state = 'chase';
    return e;
  });
  w.spawnField({ x, y, r: spec.area, dur: spec.duration, tick: spec.tick, dmg: spec.damage, type: spec.dmgType, look: 'rift', hostile: false, depth: 0, spec, onHit: true, pull: spec.extra.pull! });
  return { w, x, y, foes };
}

describe('Sigilfall: Gravity Well', () => {
  it('says it drags enemies to its middle for 3 seconds', () => {
    const s = SKILLS['gravity-well']!;
    expect(s.blurb).toContain('drags enemies to its middle for 3 seconds');
    expect(s.base.duration).toBe(3);
    expect(s.base.extra.pull).toBeGreaterThan(0);
  });

  it('and does: foes at its rim are at its middle within a second, and are held there while it lasts', () => {
    const { w, x, y, foes } = well();
    run(w, 1);
    for (const e of foes) expect(Math.hypot(e.x - x, e.y - y), 'after 1 s').toBeLessThan(16);
    run(w, 1.7);
    for (const e of foes) expect(Math.hypot(e.x - x, e.y - y), 'after 2.7 s').toBeLessThan(16);
  });

  it('lets them go when it closes: they come for the hero again', () => {
    const { w, x, y, foes } = well();
    run(w, 5.5);
    expect(foes.some((e) => Math.hypot(e.x - x, e.y - y) > 40)).toBe(true);
  });

  it('does not drag a boss', () => {
    const w = newWorld('whisperwood', readyHero('mage', 20));
    w.enemies.length = 0;
    const spec = SKILLS['gravity-well']!.base;
    const p = w.player;
    const e = w.addEnemy('hill-wolf', p.x + 180, p.y, 20, { room: -1, pack: -1, post: true });
    e.x = p.x + 180;
    e.y = p.y;
    e.boss = {} as never;
    w.spawnField({ x: p.x + 150, y: p.y, r: spec.area, dur: 1, tick: 9, dmg: 0, type: spec.dmgType, look: 'rift', hostile: false, depth: 0, spec: null, onHit: false, pull: spec.extra.pull! });
    updateFields(w, 0.25);
    expect(e.x).toBe(p.x + 180);
    // (and the same foe, no boss, is on its way in)
    e.boss = null;
    updateFields(w, 0.1);
    expect(e.x).toBeLessThan(p.x + 180);
  });
});
