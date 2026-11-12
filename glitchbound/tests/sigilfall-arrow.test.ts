/**
 * The arrow at the edge of the view points the way to the quest over the ground (the owner: "on the minimap the actual
 * quest is in the south, but the arrow is pointing to the other direction"). It was read off where the place came out
 * on the screen, and a place far to the south is behind the camera, where that comes out turned about.
 */
import { describe, expect, it } from 'vitest';
import { edgeArrowAngle } from '../src/games/sigilfall/render/camera';
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

describe('how big everyone is drawn', () => {
  it('is about a sixth smaller than it was, people and creatures by the same share', () => {
    expect(FIGURE).toBeGreaterThanOrEqual(0.8);
    expect(FIGURE).toBeLessThanOrEqual(0.85);
    expect(PERSON_H).toBeCloseTo(36 * FIGURE);
    expect(heightFromRadius(8)).toBeCloseTo(36 * FIGURE);
    expect(heightFromRadius(20, 1.5)).toBeCloseTo(66 * 1.5 * FIGURE);
  });
});
