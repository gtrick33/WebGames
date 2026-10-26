import { describe, expect, it } from 'vitest';
import { damp } from '../src/games/sigilfall/core/math';
import { LEAD, leanTarget, placeCamera } from '../src/games/sigilfall/render/camera';

/**
 * The camera, replayed frame by frame the way the renderer runs it: the mouse goes round the hero
 * and the view must glide, never step back and forth (the jitter players felt as the mouse moved).
 */

const DETAIL = 2;
const SCALE = 3;
const VIEW_W = 400;
const VIEW_H = 236;
const MAP = 4000;

/** Device pixels the view moved on each frame (the larger axis) while the mouse circles a standing hero. */
function circle(frames: number, mouseLean: boolean): number[] {
  const hx = 2000.37;
  const hy = 1500.81;
  let lean = { x: 0, y: -8 };
  let cam = placeCamera(hx, hy, lean, VIEW_W, VIEW_H, MAP, MAP, DETAIL, SCALE);
  const moves: number[] = [];
  for (let i = 0; i < frames; i++) {
    const a = (i / 120) * Math.PI * 2;
    const ptr = { x: Math.cos(a) * 0.35, y: Math.sin(a) * 0.35 };
    // the old camera leaned on the aim, measured from where the camera already was
    const cursorX = cam.camX + (ptr.x + 0.5) * VIEW_W;
    const cursorY = cam.camY + (ptr.y + 0.5) * VIEW_H;
    const aim = Math.atan2(cursorY - hy, cursorX - hx);
    const target = leanTarget(mouseLean ? ptr : null, aim, LEAD);
    lean = { x: damp(lean.x, target.x, 4, 1 / 60), y: damp(lean.y, target.y, 4, 1 / 60) };
    const next = placeCamera(hx, hy, lean, VIEW_W, VIEW_H, MAP, MAP, DETAIL, SCALE);
    moves.push(Math.round(Math.max(Math.abs(next.camX - cam.camX), Math.abs(next.camY - cam.camY)) * DETAIL * SCALE * 100) / 100);
    cam = next;
  }
  return moves;
}

describe('Sigilfall camera', () => {
  it('moves in device pixels, a pixel or two a frame, while the mouse circles', () => {
    const moves = circle(360, true).slice(60);
    expect(Math.max(...moves)).toBeLessThanOrEqual(3);
    // the old camera, pinned to whole world pixels, jumped DETAIL × SCALE device pixels at a time
    expect(moves.every((m) => Number.isInteger(m))).toBe(true);
  });

  it('places the world on an art pixel and slides the canvas by the rest', () => {
    const c = placeCamera(1000.3, 800.6, { x: 3.17, y: -8.41 }, VIEW_W, VIEW_H, MAP, MAP, DETAIL, SCALE);
    expect((c.drawX * DETAIL) % 1).toBe(0);
    expect(c.slideX).toBeGreaterThanOrEqual(0);
    expect(c.slideX).toBeLessThan(SCALE);
    // the slide puts the screen back exactly on the camera
    expect(c.drawX + c.slideX / (DETAIL * SCALE)).toBeCloseTo(c.camX, 6);
    expect(c.drawY + c.slideY / (DETAIL * SCALE)).toBeCloseTo(c.camY, 6);
  });

  it('keeps the hero on the same screen pixel while only the hero moves', () => {
    const lean = { x: 5, y: -8 };
    for (let x = 1000; x < 1010; x += 0.37) {
      const c = placeCamera(x, 900, lean, VIEW_W, VIEW_H, MAP, MAP, DETAIL, SCALE);
      const heroArt = Math.round(x * DETAIL) / DETAIL;
      expect(Math.round((heroArt - c.camX) * DETAIL * SCALE)).toBe(Math.round((-lean.x + VIEW_W / 2) * DETAIL * SCALE));
    }
  });

  it('leans on the cursor on screen, so a camera move never changes the lean', () => {
    const a = leanTarget({ x: 0.4, y: 0 }, 0, LEAD);
    const b = leanTarget({ x: 0.4, y: 0 }, 2, LEAD);
    expect(a).toEqual(b);
    // a cursor near the middle leaves the view alone
    expect(leanTarget({ x: 0.05, y: 0.05 }, 0, LEAD)).toEqual({ x: 0, y: -8 });
  });
});
