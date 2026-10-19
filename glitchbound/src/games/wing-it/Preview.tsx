import type { GamePreviewProps } from '../../platform/contract';
import { usePreviewCanvas } from '../../platform/previewLoop';
import { drawFrame, newView } from './render';
import { BIRD_X, flap, gapCentre, H, HIT_R, newSim, PILLAR_W, step, STEP, type Sim } from './sim';

/** Flaps when falling near the bottom of the next gap (the same autopilot the tests fly). */
function autopilot(s: Sim): void {
  const p = s.pillars.find((x) => x.x + PILLAR_W > BIRD_X - HIT_R);
  const target = p ? gapCentre(p, s.t + 0.2) + p.gapH / 2 - HIT_R - 16 : H / 2;
  if (s.y > target && s.vy > 0) flap(s);
}

/** Wing It's attract mode: the real game on a random course, flown by the autopilot. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    let seed = (Math.random() * 2 ** 32) >>> 0;
    let s = newSim(seed);
    const view = newView();
    let acc = 0;
    let t = 0;
    let down = 0;
    return {
      frame(_ctx, w, h, dt, canvas) {
        t += dt;
        if (!s.started && t > 0.6) flap(s);
        acc += dt;
        while (acc >= STEP) {
          if (s.started && !s.dead) autopilot(s);
          step(s);
          acc -= STEP;
        }
        // After a crash (or a long flight) start a fresh course.
        if (s.dead || s.score >= 25) down += dt;
        if (down > 1.4) {
          seed = (seed + 0x9e3779b9) >>> 0;
          s = newSim(seed);
          down = 0;
          t = 0;
        }
        view.cw = w;
        view.ch = h;
        drawFrame(canvas, view, s, t, acc / STEP);
      },
    };
  });
  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
