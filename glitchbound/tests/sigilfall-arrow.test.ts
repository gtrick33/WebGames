/**
 * The arrow at the edge of the view points the way to the quest over the ground (the owner: "on the minimap the actual
 * quest is in the south, but the arrow is pointing to the other direction"). It was read off where the place came out
 * on the screen, and a place far to the south is behind the camera, where that comes out turned about.
 */
import { describe, expect, it } from 'vitest';
import { edgeArrowAngle, edgeArrowPoint, inArrowView } from '../src/games/sigilfall/render/camera';
import { FIGURE, heightFromRadius, PERSON_H } from '../src/games/sigilfall/render3d/cast';

describe('the arrow to a quest out of sight', () => {
  const hero = [1000, 1000] as const;
  // (the screen's angles: 0 to the right, a quarter turn is down)
  it('points down the screen at a place to the south, however far', () => {
    for (const far of [300, 900, 4000]) expect(edgeArrowAngle(...hero, 1000, 1000 + far)).toBeCloseTo(Math.PI / 2);
  });
  it('points to each side and up for east, west and north', () => {
    expect(edgeArrowAngle(...hero, 2000, 1000)).toBeCloseTo(0);
    expect(Math.abs(edgeArrowAngle(...hero, 0, 1000))).toBeCloseTo(Math.PI);
    expect(edgeArrowAngle(...hero, 1000, 0)).toBeCloseTo(-Math.PI / 2);
  });
  it('a place to the south-east is down and to the right, never up and to the left', () => {
    const a = edgeArrowAngle(...hero, 1800, 2400);
    expect(Math.cos(a)).toBeGreaterThan(0);
    expect(Math.sin(a)).toBeGreaterThan(0);
  });
});

describe('the arrow keeps inside what the screen shows', () => {
  // an iPhone 17 Pro on its side: 874 by 402, 62 px at each side for the island and the corners, 21 for the home bar
  const W = 874;
  const H = 402;
  const m = 30;
  const phone = { t: 0, r: 62, b: 21, l: 62 };
  it('stands where it always did on a screen with no edges of its own', () => {
    for (const a of [0, 0.4, Math.PI / 2, 2.5, Math.PI, -2, -Math.PI / 2, -0.3]) {
      const old = Math.min(Math.abs((W / 2 - m) / (Math.cos(a) || 1e-6)), Math.abs((H / 2 - m) / (Math.sin(a) || 1e-6)));
      const p = edgeArrowPoint(W, H, a, m);
      expect(p.x).toBeCloseTo(W / 2 + Math.cos(a) * old);
      expect(p.y).toBeCloseTo(H / 2 + Math.sin(a) * old);
    }
  });
  it('pointing to either side, stands in from the island and the corners, not under them', () => {
    expect(edgeArrowPoint(W, H, 0, m, phone)).toEqual({ x: W - m - 62, y: H / 2 });
    const left = edgeArrowPoint(W, H, Math.PI, m, phone);
    expect(left.x).toBeCloseTo(m + 62);
    expect(left.y).toBeCloseTo(H / 2);
    expect(edgeArrowPoint(W, H, Math.PI / 2, m, phone).y).toBeCloseTo(H - m - 21);
  });
  it('whichever way it points, it is inside the safe part of the screen', () => {
    for (let a = -Math.PI; a < Math.PI; a += 0.05) {
      const p = edgeArrowPoint(W, H, a, m, phone);
      expect(p.x).toBeGreaterThanOrEqual(m + 62 - 1e-6);
      expect(p.x).toBeLessThanOrEqual(W - m - 62 + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(m - 1e-6);
      expect(p.y).toBeLessThanOrEqual(H - m - 21 + 1e-6);
    }
  });
  it('a place under the island is not "in sight": the arrow at the edge leads to it', () => {
    expect(inArrowView(W - 50, H / 2, W, H, m, phone)).toBe(false);
    expect(inArrowView(W - 50, H / 2, W, H, m)).toBe(true);
    expect(inArrowView(W / 2, H / 2, W, H, m, phone)).toBe(true);
  });
});

describe('how big everyone is drawn', () => {
  it('is about a sixth smaller than it was, people and creatures by the same share', () => {
    expect(FIGURE).toBeGreaterThanOrEqual(0.75);
    expect(FIGURE).toBeLessThanOrEqual(0.82);
    expect(PERSON_H).toBeCloseTo(36 * FIGURE);
    expect(heightFromRadius(8)).toBeCloseTo(36 * FIGURE);
    expect(heightFromRadius(20, 1.5)).toBeCloseTo(66 * 1.5 * FIGURE);
  });
});
