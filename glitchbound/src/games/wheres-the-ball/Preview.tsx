import type { GamePreviewProps } from '../../platform/contract';
import { ease, usePreviewCanvas } from '../../platform/previewLoop';
import { paintScene } from './paint';
import { ENV_IDS, H, makeScene, W, type Scene } from './scene';

/** Where's the Ball's attract mode: a painted court, a sight that hunts around, then locks onto the ball. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    let n = Math.floor(Math.random() * 1000);
    let scene: Scene = makeScene(n * 7919 + 3, 0, ENV_IDS[n % ENV_IDS.length]);
    const pic = document.createElement('canvas');
    let drawnAt = 0;
    let t = 0;
    let wobble = Math.random() * 10;
    return {
      frame(ctx, w, h, dt) {
        t += dt;
        // Cover the box, but keep the ball in view.
        const k = Math.max(w / W, h / H);
        if (Math.abs(drawnAt - W * k) > 1) {
          paintScene(pic, scene, W * k);
          drawnAt = W * k;
        }
        const b = scene.ball;
        const ox = Math.max(w - W * k, Math.min(0, w / 2 - b.x * k));
        const oy = Math.max(h - H * k, Math.min(0, h / 2 - b.y * k));
        ctx.drawImage(pic, ox, oy, W * k, H * k);
        // The sight wanders for 2.4 s, homes in for 0.8 s, then locks on for 1.2 s.
        wobble += dt;
        const wx = w / 2 + Math.sin(wobble * 1.3) * w * 0.3;
        const wy = h / 2 + Math.cos(wobble * 1.7) * h * 0.28;
        const bx = ox + b.x * k;
        const by = oy + b.y * k;
        const home = ease((t - 2.4) / 0.8);
        const x = wx + (bx - wx) * home;
        const y = wy + (by - wy) * home;
        const locked = t > 3.2;
        const r = Math.max(14, Math.min(w, h) * 0.09) * (locked ? 1 + 0.15 * Math.sin((t - 3.2) * 12) * Math.max(0, 1 - (t - 3.2) * 2) : 1);
        ctx.lineWidth = 3;
        ctx.strokeStyle = locked ? '#7cff6b' : '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          ctx.moveTo(x + dx * r * 0.45, y + dy * r * 0.45);
          ctx.lineTo(x + dx * r * 1.35, y + dy * r * 1.35);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        if (t > 4.6) {
          n++;
          scene = makeScene(n * 7919 + 3, n % 2, ENV_IDS[n % ENV_IDS.length]);
          drawnAt = 0;
          t = 0;
        }
      },
    };
  });
  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
