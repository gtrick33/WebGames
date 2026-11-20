/**
 * The hero who stood where they were for good (the owner, with a video from an iPhone: "the character stuck in floating
 * position"): their speed had stopped being a number. Every step after was not a number either, so the hero moved
 * nowhere and nothing ever stopped them against a wall to set it back to nought; they turned to the stick, cast, but
 * never walked again. Whatever lets a speed that is not a number in, the next step lets it go.
 */
import { describe, expect, it } from 'vitest';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

const DT = 1 / 60;

/** Pushes the stick one way for a while; how far the hero went. */
function walk(w: World, mx: number, my: number, secs: number): number {
  const p = w.player;
  const x0 = p.x;
  const y0 = p.y;
  for (let t = 0; t < secs; t += DT) {
    w.input = { ...emptyInput(), mx, my };
    w.step(DT);
  }
  return Math.hypot(p.x - x0, p.y - y0);
}

/** The direction from the hero with the most open ground ahead of them (they're set down by a wall, often). */
function openWay(w: World): [number, number] {
  let best: [number, number] = [1, 0];
  let far = -1;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const p = w.player;
    const was = { x: p.x, y: p.y, vx: p.vx, vy: p.vy };
    const d = walk(w, Math.cos(a), Math.sin(a), 0.3);
    Object.assign(p, was);
    if (d > far) {
      far = d;
      best = [Math.cos(a), Math.sin(a)];
    }
  }
  return best;
}

describe('Sigilfall: a speed that is not a number', () => {
  it('lets go of it: the hero walks again on the next push of the stick', () => {
    const w = newWorld('briarhollow', readyHero('mage', 30));
    const [mx, my] = openWay(w);
    expect(walk(w, mx, my, 0.5)).toBeGreaterThan(10);
    w.player.vx = Number.NaN;
    w.player.vy = Number.NaN;
    expect(walk(w, -mx, -my, 0.5)).toBeGreaterThan(10);
    expect(Number.isFinite(w.player.vx) && Number.isFinite(w.player.vy)).toBe(true);
  });

  it('ends a dash that is not a number, rather than holding the hero in it', () => {
    const w = newWorld('briarhollow', readyHero('mage', 30));
    const [mx, my] = openWay(w);
    w.player.dash = { vx: Number.NaN, vy: Number.NaN, t: Number.NaN, spec: null, hit: new Set(), dodge: true };
    expect(walk(w, mx, my, 0.5)).toBeGreaterThan(10);
    expect(w.player.dash).toBeNull();
  });
});
