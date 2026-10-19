import type { GamePreviewProps } from '../../platform/contract';
import { ease, fit, label, rr, usePreviewCanvas } from '../../platform/previewLoop';

const INK = '#1b1035';
const TILES = ['#ff5a6c', '#2fb5ff', '#ffc928', '#8b5cff'];
const N = 4;

/** Memory Grid's attract mode: a pattern lights up, then gets tapped back in order; the streak grows. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    let len = 3;
    let pattern: number[] = [];
    let t = 0;
    const deal = (): void => {
      const cells = Array.from({ length: N * N }, (_, i) => i).sort(() => Math.random() - 0.5);
      pattern = cells.slice(0, len);
      t = 0;
    };
    deal();
    return {
      frame(ctx, w, h, dt) {
        t += dt;
        ctx.fillStyle = '#fff4e2';
        ctx.fillRect(0, 0, w, h);
        const { k, x, y } = fit(w, h, 200, 200);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k, k);
        const watchEnd = 0.6 + len * 0.45;
        const tapStart = watchEnd + 0.5;
        const tapEnd = tapStart + len * 0.4;
        const size = 38;
        const gap = 7;
        const ox = (200 - (N * size + (N - 1) * gap)) / 2;
        const oy = 22;
        for (let i = 0; i < N * N; i++) {
          const cx = ox + (i % N) * (size + gap);
          const cy = oy + Math.floor(i / N) * (size + gap);
          const p = pattern.indexOf(i);
          let fill = '#fffaf0';
          let lift = 0;
          if (p >= 0) {
            const shownAt = 0.6 + p * 0.45;
            const tappedAt = tapStart + p * 0.4;
            if (t >= shownAt && t < shownAt + 0.4) {
              fill = TILES[p % TILES.length]!;
              lift = 2;
            } else if (t >= tappedAt && t < tapEnd + 1.2) {
              fill = '#9fdc2c';
              lift = t < tappedAt + 0.15 ? 2 : 0;
            }
          }
          ctx.fillStyle = INK;
          rr(ctx, cx, cy + 4, size, size, 9);
          ctx.fill();
          rr(ctx, cx, cy - lift, size, size, 9);
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = INK;
          ctx.stroke();
        }
        const msg = t < watchEnd ? 'Watch…' : t < tapEnd ? 'Your turn!' : `Streak ${len - 2} ✓`;
        label(ctx, msg, 100, 10, 13, t >= tapEnd ? '#2f8a12' : INK);
        // A fingertip taps the pattern back.
        const tap = Math.floor((t - tapStart) / 0.4);
        if (t > tapStart && tap < len) {
          const i = pattern[tap]!;
          const cx = ox + (i % N) * (size + gap) + size / 2;
          const cy = oy + Math.floor(i / N) * (size + gap) + size / 2;
          const s = 1 - 0.25 * ease(((t - tapStart) % 0.4) / 0.15);
          ctx.beginPath();
          ctx.arc(cx + 8, cy + 10, 9 * s, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = INK;
          ctx.stroke();
        }
        ctx.restore();
        if (t > tapEnd + 1.3) {
          len = len >= 6 ? 3 : len + 1;
          deal();
        }
      },
    };
  });
  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
