import type { GamePreviewProps } from '../../platform/contract';
import { usePreviewCanvas } from '../../platform/previewLoop';
import { CARS } from './cars';
import { DEFAULTS, ENVS, HELMETS } from './cosmetics';
import { freshCondition, type Levels } from './parts';
import { Stage3D, type CarLook, type CarState } from './scene3d';
import { DT, Race, specOf, treeOf } from './sim';

/** Launch Control's attract mode: two tuned cars race the quarter mile head to head in 3D, over and over, blitted onto the tile. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    let stage: Stage3D | null = null;
    let failed = false;
    let w0 = 0;
    let h0 = 0;
    const pick = (): { look: CarLook; levels: Levels } => {
      const def = CARS[Math.floor(Math.random() * (CARS.length - 2))]!;
      const l = Math.floor(Math.random() * 6);
      const levels: Levels = { engine: l, transmission: l, suspension: l, tyres: l, aero: l + 1, looks: l };
      const h = HELMETS[Math.floor(Math.random() * HELMETS.length)]!;
      return { look: { def, levels, paint: DEFAULTS.paint, livery: Math.random() < 0.4 ? 'l-stripes' : DEFAULTS.livery, wheels: 'w-classic', helmet: [h.colors[0]!, h.colors[1]!], suit: '#1d3557' }, levels };
    };
    let cars = Array.from({ length: 2 }, pick);
    let env = ENVS[Math.floor(Math.random() * ENVS.length)]!.id;
    const start = (): Race => new Race(cars.map((c) => specOf(c.look.def, c.levels, freshCondition(), false)), cars.map((_, i) => ({ kind: 'policy', skill: i ? 0.5 + Math.random() * 0.4 : 0.9, seed: Math.floor(Math.random() * 1e9) })), Math.floor(Math.random() * 1e9));
    let race = start();
    let acc = 0;
    let t = 0;
    let doneAt = -1;
    const place = (): void => {
      stage?.setEnv(env);
      cars.forEach((c, i) => stage?.setCar(i, c.look));
    };
    return {
      frame(ctx, w, h, dt) {
        if (failed) return;
        if (!stage) {
          try {
            stage = new Stage3D(undefined, false);
            place();
          } catch {
            failed = true;
            return;
          }
        }
        if (w !== w0 || h !== h0) {
          w0 = w;
          h0 = h;
          stage.resize(w, h, 1);
        }
        t += dt;
        acc += dt;
        while (acc >= DT) {
          race.step();
          acc -= DT;
        }
        if (race.done && doneAt < 0) doneAt = t;
        if (doneAt >= 0 && t - doneAt > 1.5) {
          cars = Array.from({ length: 2 }, pick);
          env = ENVS[Math.floor(Math.random() * ENVS.length)]!.id;
          race = start();
          doneAt = -1;
          place();
        }
        const state = (r: (typeof race.racers)[number]): CarState => ({ x: r.x, v: r.v, rpm: r.rpm, redline: r.spec.redline, spinning: r.spinLeft > 0, dead: r.dead });
        stage.renderRace(race.racers.map(state), treeOf(race), t, dt, undefined, { excite: race.green && !race.done ? 0.6 : 0.2 });
        ctx.drawImage(stage.canvas, 0, 0, w, h);
      },
    };
  });
  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
