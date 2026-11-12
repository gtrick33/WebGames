/**
 * A hero pressed into a corner stands still (the owner: "some walls still jitter in campaign mode, walls, gates").
 * The rule that eases out a hero wedged between two things took every corner for a wedge: stopped both ways for 0.4 s,
 * the hero was set down a few pixels back, walked into the corner again and was set back again, and the camera, which
 * is on the hero, shook the whole picture with them.
 */
import { describe, expect, it } from 'vitest';
import { circleHitsWall, TILE } from '../src/games/sigilfall/sim/map';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/** A floor tile with wall above it and to its right: the inside corner of a room. */
function corner(w: World): { x: number; y: number } {
  const m = w.map;
  for (let y = 2; y < m.h - 2; y++) {
    for (let x = 2; x < m.w - 2; x++) {
      const i = y * m.w + x;
      const open = (j: number): boolean => !m.solid[j] && !m.bodies[j] && !m.clogged[j];
      const wall = (j: number): boolean => m.solid[j] === 1 && !m.soft[j];
      if (open(i) && open(i - 1) && open(i + m.w) && open(i + m.w - 1) && wall(i - m.w) && wall(i + 1) && wall(i - m.w + 1) && wall(i - m.w - 1) && wall(i + m.w + 1)) return { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
    }
  }
  throw new Error('no corner');
}

function press(w: World, mx: number, my: number, seconds: number): { back: number; span: number } {
  let back = 0;
  let settled: { x: number; y: number } | null = null;
  let span = 0;
  for (let t = 0; t < seconds; t += 1 / 60) {
    const before = { x: w.player.x, y: w.player.y };
    w.input = { ...emptyInput(), mx, my };
    w.step(1 / 60);
    // a step against the way pressed
    const d = (w.player.x - before.x) * mx + (w.player.y - before.y) * my;
    if (d < -0.05) back++;
    if (t > 1) {
      settled ??= { x: w.player.x, y: w.player.y };
      span = Math.max(span, Math.hypot(w.player.x - settled.x, w.player.y - settled.y));
    }
  }
  return { back, span };
}

describe('a hero pressed into a corner', () => {
  for (const region of ['crypt', 'gallows-keep', 'deepforge-halls'] as const) {
    it(`stands still in it, for as long as they press (${region})`, () => {
      const w = newWorld(region, readyHero('warrior', 10));
      w.enemies = [];
      const at = corner(w);
      w.player.x = at.x;
      w.player.y = at.y;
      const { back, span } = press(w, Math.SQRT1_2, -Math.SQRT1_2, 4);
      expect(back).toBe(0);
      expect(span).toBeLessThan(0.2);
      // (and they are in the corner, not in the wall)
      expect(circleHitsWall(w.map, w.player.x, w.player.y, w.player.r)).toBe(false);
    });
  }

  it('wedged among things that stand, is eased out: once, and then left to stand', () => {
    const w = newWorld('crypt', readyHero('warrior', 10));
    w.enemies = [];
    const at = corner(w);
    w.player.x = at.x;
    w.player.y = at.y;
    press(w, Math.SQRT1_2, -Math.SQRT1_2, 1);
    const p = w.player;
    // (something standing right in the corner with them: a wedge now, not a bare corner)
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor(p.y / TILE);
    const thing = { x0: p.x - p.r - 7, y0: p.y - p.r - 1, x1: p.x - p.r - 1, y1: p.y + 2 };
    w.map.bodies[ty * w.map.w + tx] = [...(w.map.bodies[ty * w.map.w + tx] ?? []), thing];
    const from = { x: p.x, y: p.y };
    let hops = 0;
    for (let t = 0; t < 5; t += 1 / 60) {
      const before = { x: p.x, y: p.y };
      w.input = { ...emptyInput(), mx: Math.SQRT1_2, my: -Math.SQRT1_2 };
      w.step(1 / 60);
      if ((p.x - before.x) * Math.SQRT1_2 - (p.y - before.y) * Math.SQRT1_2 < -0.5) hops++;
    }
    expect(hops).toBe(1);
    expect(Math.hypot(p.x - from.x, p.y - from.y)).toBeLessThan(16);
  });
});
