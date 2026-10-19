import type { GamePreviewProps } from '../../platform/contract';
import { usePreviewCanvas } from '../../platform/previewLoop';
import { drawFrame, newView } from './render';
import { canDrop, drop, newSim, nextTier, RADII, setAim, step, STEP, W, type Sim } from './sim';

/** Aims at the highest blob of the size about to drop (so they squish), else somewhere sensible. */
function aimFor(s: Sim, r: () => number): number {
  const tier = nextTier(s);
  const twins = s.blobs.filter((b) => b.tier === tier).sort((a, b) => a.y - b.y);
  if (twins[0] && r() < 0.8) return twins[0].x + (r() - 0.5) * 10;
  return RADII[tier]! + 8 + r() * (W - 2 * RADII[tier]! - 16);
}

/** Gloop's attract mode: the real jar and physics, with blobs dropped by a simple autopilot. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    const r = Math.random;
    let s = newSim((r() * 2 ** 32) >>> 0);
    const view = newView();
    const flashes: { x: number; y: number; r: number; age: number }[] = [];
    let acc = 0;
    let t = 0;
    let wait = 0.3;
    let target = W / 2;
    return {
      frame(_ctx, w, h, dt, canvas) {
        t += dt;
        // Glide the dropper to the target, then let go.
        s.aim += Math.max(-260 * dt, Math.min(260 * dt, target - s.aim));
        setAim(s, s.aim);
        wait -= dt;
        if (wait <= 0 && canDrop(s) && Math.abs(target - s.aim) < 2) {
          drop(s);
          wait = 0.75;
          target = aimFor(s, r);
        }
        acc += dt;
        while (acc >= STEP) {
          for (const e of step(s)) if (e.type === 'merge') flashes.push({ x: e.x, y: e.y, r: RADII[e.tier]!, age: 0 });
          acc -= STEP;
        }
        for (const f of flashes) f.age += dt;
        while (flashes[0] && flashes[0].age > 0.5) flashes.shift();
        // A full jar (or a long run) starts over.
        if (s.over || s.blobs.length > 26) {
          s = newSim((r() * 2 ** 32) >>> 0);
          target = W / 2;
        }
        view.cw = w;
        view.ch = h;
        drawFrame(canvas, view, s, t, flashes);
      },
    };
  });
  return (
    <canvas
      ref={ref}
      className="game-preview-canvas"
      aria-hidden="true"
      style={{ background: 'radial-gradient(circle at 15% 10%, #ffe3f5 0, transparent 40%), linear-gradient(170deg, #d9b8ff, #b98cff 55%, #8f63ef)' }}
    />
  );
}
