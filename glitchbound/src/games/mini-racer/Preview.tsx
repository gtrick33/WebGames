import type { GamePreviewProps } from '../../platform/contract';
import { rr, usePreviewCanvas, type C } from '../../platform/previewLoop';
import { autopilot, COUNTDOWN, DT, RaceSim } from './sim';
import { buildTrack, KERB, type ThemeId, type Track } from './track';
import { TRACKS } from './tracks';

/** Track colors per theme (a few from render.ts, so the preview stays small). */
const LOOK: Record<ThemeId, { ground: string; road: string; edge: string; kerbA: string; kerbB: string }> = {
  bay: { ground: '#f6d896', road: '#5b5a8f', edge: '#3c3a6b', kerbA: '#ff5a6c', kerbB: '#fff6e6' },
  frost: { ground: '#eef6ff', road: '#6f78b3', edge: '#4a518a', kerbA: '#ff4f9a', kerbB: '#ffffff' },
  canyon: { ground: '#f4ad6c', road: '#6a5878', edge: '#4a3b58', kerbA: '#ffd12e', kerbB: '#3d2a4a' },
  park: { ground: '#8fd46b', road: '#5d5f88', edge: '#3d3f66', kerbA: '#ff5a6c', kerbB: '#ffffff' },
  candy: { ground: '#c9f2e3', road: '#7a63b8', edge: '#563f94', kerbA: '#ff5fa2', kerbB: '#ffffff' },
};

function road(ctx: C, track: Track): void {
  const look = LOOK[track.def.theme];
  const pts = track.path.pts;
  const trace = (): void => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    if (track.path.closed) ctx.closePath();
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  trace();
  ctx.lineWidth = 2 * (track.half + KERB);
  ctx.strokeStyle = look.kerbA;
  ctx.stroke();
  ctx.setLineDash([18, 18]);
  ctx.strokeStyle = look.kerbB;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 2 * track.half + 4;
  ctx.strokeStyle = look.edge;
  ctx.stroke();
  ctx.lineWidth = 2 * track.half;
  ctx.strokeStyle = look.road;
  ctx.stroke();
  ctx.setLineDash([22, 26]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
  ctx.setLineDash([]);
}

function car(ctx: C, x: number, y: number, a: number, body: string, accent: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = 'rgba(20,10,40,0.25)';
  rr(ctx, -15, -7, 34, 20, 7);
  ctx.fill();
  rr(ctx, -17, -10, 34, 20, 7);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#1b1035';
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.fillRect(-14, -2.5, 28, 5);
  ctx.fillStyle = '#1b1035';
  rr(ctx, 1, -7, 8, 14, 3);
  ctx.fill();
  ctx.restore();
}

/** Mini Racer's attract mode: a real race on a real track, the autopilot against three AI rivals. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    let n = Math.floor(Math.random() * TRACKS.length);
    const start = (): RaceSim => {
      const sim = new RaceSim(buildTrack(TRACKS[n % TRACKS.length]!), null, undefined, { mode: 'race', rivals: 3, aiLevel: 70 });
      // Skip the countdown: the preview starts mid-race.
      for (let i = 0; i < (COUNTDOWN + 1.5) / DT; i++) sim.step(autopilot(sim));
      return sim;
    };
    let sim = start();
    let acc = 0;
    let t = 0;
    let cam = { x: sim.player.car.x, y: sim.player.car.y };
    return {
      frame(ctx, w, h, dt) {
        t += dt;
        acc += dt;
        while (acc >= DT) {
          sim.step(autopilot(sim));
          acc -= DT;
        }
        // A fresh track every 25 seconds.
        if (t > 25 || sim.finished) {
          n++;
          sim = start();
          t = 0;
          cam = { x: sim.player.car.x, y: sim.player.car.y };
        }
        const me = sim.player.car;
        cam.x += (me.x - cam.x) * Math.min(1, dt * 6);
        cam.y += (me.y - cam.y) * Math.min(1, dt * 6);
        const k = Math.min(w, h) / 330;
        ctx.fillStyle = LOOK[sim.track.def.theme].ground;
        ctx.fillRect(0, 0, w, h);
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(k, k);
        ctx.translate(-cam.x, -cam.y);
        road(ctx, sim.track);
        for (const r of [...sim.racers].reverse()) car(ctx, r.car.x, r.car.y, r.car.a, r.look.body, r.look.accent);
        ctx.restore();
      },
    };
  });
  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
