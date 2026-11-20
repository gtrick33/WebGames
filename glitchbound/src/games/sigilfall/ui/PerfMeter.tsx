import { useRef } from 'react';
import type { SigilEngine } from '../engine';
import type { World } from '../sim/world';
import { useFrame } from './GameScreen';

/** Whether the frame-cost meter is asked for: `?perf` in the address. */
export const perfAsked = (): boolean => typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf');

/**
 * The frame-cost meter (POLISH_PLAN.md piece 27), with `?perf` in the address: frames a second and the slowest frame
 * of the last second, what the last frame cost the graphics card (draw calls, thousands of triangles), the share of
 * the full picture drawn, and how much is going on (foes, effects). Written straight into its text a few times a
 * second, never through React: it must not cost what it measures. scripts/sigilfall-bench.mjs reads the same numbers.
 */
export function PerfMeter({ engine }: { engine: SigilEngine }) {
  const el = useRef<HTMLPreElement>(null);
  // (the span begins at the first frame it sees: 0 until then)
  const span = useRef({ from: 0, frames: 0, worst: 0, last: 0 });
  useFrame(engine, (w: World) => {
    const s = span.current;
    const now = performance.now();
    if (!s.from) {
      s.from = now;
      s.last = now;
      return;
    }
    s.worst = Math.max(s.worst, now - s.last);
    s.last = now;
    s.frames++;
    if (now - s.from < 1000) return;
    const fps = (s.frames * 1000) / (now - s.from);
    const cost = (engine.renderer as SigilEngine['renderer'] | undefined)?.frameCost();
    const text = [
      `${fps.toFixed(0)} fps  worst ${s.worst.toFixed(0)} ms`,
      cost ? `${cost.calls} calls  ${(cost.tris / 1000).toFixed(0)}k tris  ${(cost.quality * 100).toFixed(0)}% px` : 'no 3D picture',
      `${w.enemies.filter((e) => !e.dead).length} foes  ${w.fx.length} fx  ${w.projectiles.length} shots`,
    ].join('\n');
    if (el.current) el.current.textContent = text;
    (globalThis as { __sfPerf?: unknown }).__sfPerf = { fps, worst: s.worst, calls: cost?.calls ?? 0, tris: cost?.tris ?? 0, quality: cost?.quality ?? 1, foes: w.enemies.filter((e) => !e.dead).length, fx: w.fx.length };
    s.from = now;
    s.frames = 0;
    s.worst = 0;
  });
  return <pre ref={el} className="rb-perf" aria-hidden="true" />;
}
