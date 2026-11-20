/**
 * The camera in a fight (POLISH_PLAN.md piece 8): it leans toward the foes coming at the hero, draws back a little on a
 * big screen, and what stands in front of the hero thins away over a wider reach, so the foes at their feet are seen
 * as well as the hero.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { threatOf } from '../src/games/sigilfall/render/renderer';
import { TILE } from '../src/games/sigilfall/sim/map';
import { newWorld, readyHero } from './sigilfall-bot';

describe('Sigilfall: the camera finds the fight', () => {
  it('knows the foes coming at the hero, and where they are on the whole', () => {
    const w = newWorld('whisperwood', readyHero('warrior', 12));
    w.enemies = [];
    expect(threatOf(w)).toBeNull();
    const p = w.player;
    const a = w.addEnemy('skeleton', p.x + TILE * 3, p.y, 12, { room: -1, pack: -1 });
    const b = w.addEnemy('skeleton', p.x + TILE * 5, p.y + TILE * 2, 12, { room: -1, pack: -1 });
    const far = w.addEnemy('skeleton', p.x + TILE * 20, p.y, 12, { room: -1, pack: -1 });
    const idle = w.addEnemy('skeleton', p.x - TILE * 2, p.y, 12, { room: -1, pack: -1 });
    for (const e of [a, b, far]) e.state = 'chase';
    idle.state = 'idle';
    const t = threatOf(w)!;
    // (the one far off and the one standing idle are not coming at the hero)
    expect(t.n).toBe(2);
    expect(t.x).toBeCloseTo(p.x + TILE * 4);
    expect(t.y).toBeCloseTo(p.y + TILE);
    // nobody is coming at a hero who is down
    p.dead = true;
    expect(threatOf(w)).toBeNull();
  });

  it('thins what stands in front of the hero over a reach the fight widens, and leaves it as it was out of one', () => {
    const toon = readFileSync('src/games/sigilfall/render3d/toon.ts', 'utf8');
    expect(toon).toContain('float R = (1.6 + s * 0.15) * uSee.w;');
    const stage = readFileSync('src/games/sigilfall/render3d/stage.ts', 'utf8');
    expect(stage).toContain('Math.max(1, reach)');
  });
});
