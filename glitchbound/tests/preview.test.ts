import { describe, expect, it } from 'vitest';
import { layout, PreviewSim } from '../src/games/neon-rush/previewSim';

describe('NEON RUSH attract-mode bot', () => {
  // Canvas shapes the preview is shown at: hero card, catalogue tiles (wide, square, tall), phones.
  const sizes: [number, number][] = [
    [300, 375],
    [800, 320],
    [400, 400],
    [300, 400],
    [340, 270],
    [1200, 480],
  ];

  for (const [w, h] of sizes) {
    it(`never drives through traffic at ${w}x${h}`, () => {
      for (const seed of [3, 11, 99, 1234, 777]) {
        const sim = new PreviewSim(layout(w, h).ch / h, seed);
        for (let i = 0; i < 60 * 120; i++) {
          sim.step(1 / 60);
          expect(sim.colliding(), `collision at frame ${i}, seed ${seed}`).toBe(false);
        }
      }
    });
  }

  it('actually changes lanes and collects coins', () => {
    const sim = new PreviewSim(layout(300, 375).ch / 375, 5);
    const lanes = new Set<number>();
    let collected = 0;
    for (let i = 0; i < 60 * 60; i++) {
      sim.step(1 / 60);
      lanes.add(sim.playerLane);
      collected += sim.rows.filter((r) => r.collected).length > 0 ? 1 : 0;
    }
    expect(lanes.size).toBe(3);
    expect(collected).toBeGreaterThan(0);
  });
});
