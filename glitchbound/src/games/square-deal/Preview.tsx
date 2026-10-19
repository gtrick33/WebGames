import type { GamePreviewProps } from '../../platform/contract';
import { ease, fit, label, rr, usePreviewCanvas } from '../../platform/previewLoop';

const INK = '#24123d';
const COLORS = ['#ff5d73', '#ffc93c', '#4ed37b', '#3ba7ff', '#9b6bff', '#ff8ad8', '#2fd8d0'];
const N = 8;

/** Square Deal's attract mode: a piece drops into the gap that completes a row, the row clears. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    let grid: number[] = [];
    let row = 0;
    let gap: number[] = [];
    let color = 0;
    let t = 0;
    let streak = 0;
    const deal = (): void => {
      grid = Array.from({ length: N * N }, (_, i) => (Math.random() < 0.38 + Math.floor(i / N) * 0.04 ? Math.floor(Math.random() * COLORS.length) : -1));
      row = 3 + Math.floor(Math.random() * 4);
      const start = Math.floor(Math.random() * 5);
      gap = [start, start + 1, start + 2].slice(0, 2 + Math.floor(Math.random() * 2));
      for (let c = 0; c < N; c++) grid[row * N + c] = gap.includes(c) ? -1 : Math.floor(Math.random() * COLORS.length);
      color = Math.floor(Math.random() * COLORS.length);
      t = 0;
    };
    deal();
    return {
      frame(ctx, w, h, dt) {
        t += dt;
        ctx.fillStyle = '#fff6e8';
        ctx.fillRect(0, 0, w, h);
        const { k, x, y } = fit(w, h, 200, 200);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k, k);
        const cell = 19;
        const ox = (200 - N * cell) / 2;
        const oy = 8;
        const drop = ease((t - 0.6) / 0.7);
        const cleared = t > 1.4;
        const fade = cleared ? Math.max(0, 1 - (t - 1.4) / 0.5) : 1;
        rr(ctx, ox - 4, oy - 4, N * cell + 8, N * cell + 8, 8);
        ctx.fillStyle = '#f1e2c8';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = INK;
        ctx.stroke();
        for (let i = 0; i < N * N; i++) {
          const r = Math.floor(i / N);
          const c = i % N;
          let v = grid[i]!;
          if (r === row && gap.includes(c) && cleared) v = color;
          ctx.globalAlpha = r === row && cleared ? fade : 1;
          rr(ctx, ox + c * cell + 1, oy + r * cell + 1, cell - 2, cell - 2, 4);
          if (v >= 0) {
            ctx.fillStyle = r === row && cleared ? '#ffffff' : COLORS[v]!;
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = INK;
            ctx.stroke();
          } else {
            ctx.fillStyle = 'rgba(36,18,61,0.07)';
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        // The piece glides from the tray into the gap.
        if (!cleared) {
          const tx = 100 - (gap.length * cell) / 2;
          const ty = 172;
          const gx = ox + gap[0]! * cell;
          const gy = oy + row * cell;
          gap.forEach((_, j) => {
            rr(ctx, tx + (gx - tx) * drop + j * cell + 1, ty + (gy - ty) * drop + 1, cell - 2, cell - 2, 4);
            ctx.fillStyle = COLORS[color]!;
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = INK;
            ctx.stroke();
          });
        } else label(ctx, `Clear! ×${streak + 1}`, 100, 186, 13, INK);
        ctx.restore();
        if (t > 2.5) {
          streak = (streak + 1) % 5;
          deal();
        }
      },
    };
  });
  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
