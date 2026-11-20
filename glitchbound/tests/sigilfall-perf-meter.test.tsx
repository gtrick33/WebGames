/**
 * The frame-cost meter (POLISH_PLAN.md piece 27): asked for with ?perf, and counting each frame's draw calls and
 * triangles over both renderers and every pass (the renderers count from nothing at the start of a frame).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { perfAsked } from '../src/games/sigilfall/ui/PerfMeter';

describe('Sigilfall: the frame-cost meter', () => {
  it('is shown only when asked for', () => {
    window.history.replaceState(null, '', '/sigilfall');
    expect(perfAsked()).toBe(false);
    window.history.replaceState(null, '', '/sigilfall?play=1&perf');
    expect(perfAsked()).toBe(true);
    window.history.replaceState(null, '', '/sigilfall');
  });

  it('counts a whole frame: both renderers, every pass', () => {
    const stage = readFileSync('src/games/sigilfall/render3d/stage.ts', 'utf8');
    expect(stage).toMatch(/for \(const r of \[this\.gl, this\.groundGl\]\) \{\n\s+r\.info\.autoReset = false;\n\s+r\.info\.reset\(\);/);
    expect(stage).toContain('this.cost.calls = this.gl.info.render.calls + this.groundGl.info.render.calls;');
    const renderer = readFileSync('src/games/sigilfall/render/renderer.ts', 'utf8');
    expect(renderer).toMatch(/st\.costFrom\(\);\n\s+st\.render\(dt\);\n\s+st\.costTo\(\);/);
    const screen = readFileSync('src/games/sigilfall/ui/GameScreen.tsx', 'utf8');
    expect(screen).toContain('{perfAsked() && <PerfMeter engine={engine} />}');
  });
});
