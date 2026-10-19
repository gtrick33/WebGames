import type { GamePreviewProps } from '../../platform/contract';
import { ease, fit, label, rr, usePreviewCanvas } from '../../platform/previewLoop';

const INK = '#14102a';
const hsl = (h: number, s: number, l: number): string => `hsl(${h} ${s}% ${l}%)`;

/** Color Recall's attract mode: one look at a color, then the sliders mix it back from memory. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    let target = { h: 0, s: 0, l: 0 };
    let from = { h: 0, s: 0, l: 0 };
    let guess = { h: 0, s: 0, l: 0 };
    let t = 0;
    const pick = (): void => {
      target = { h: Math.floor(Math.random() * 360), s: 55 + Math.floor(Math.random() * 35), l: 45 + Math.floor(Math.random() * 20) };
      from = { h: (target.h + 140) % 360, s: 40, l: 70 };
      guess = { h: target.h + (Math.random() - 0.5) * 16, s: target.s + (Math.random() - 0.5) * 10, l: target.l + (Math.random() - 0.5) * 8 };
      t = 0;
    };
    pick();
    return {
      frame(ctx, w, h, dt) {
        t += dt;
        ctx.fillStyle = '#f5f1e8';
        ctx.fillRect(0, 0, w, h);
        const { k, x, y } = fit(w, h, 200, 200);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k, k);
        const look = t < 1.8;
        const mix = ease((t - 2.2) / 2);
        const cur = { h: from.h + (guess.h - from.h) * mix, s: from.s + (guess.s - from.s) * mix, l: from.l + (guess.l - from.l) * mix };
        const done = t > 4.6;
        // The swatch card.
        rr(ctx, 30, 14, 140, 78, 16);
        ctx.fillStyle = look ? hsl(target.h, target.s, target.l) : hsl(cur.h, cur.s, cur.l);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = INK;
        ctx.stroke();
        if (done) {
          // The real color beside the guess.
          ctx.beginPath();
          ctx.roundRect(100, 14, 70, 78, [0, 16, 16, 0]);
          ctx.fillStyle = hsl(target.h, target.s, target.l);
          ctx.fill();
          ctx.stroke();
          rr(ctx, 74, 40, 52, 26, 13);
          ctx.fillStyle = '#fffdf8';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.stroke();
          label(ctx, `${94 + Math.floor((target.h % 5))}%`, 100, 53, 14, INK);
        } else label(ctx, look ? 'Remember it!' : 'Mix it…', 100, 53, 13, target.l > 60 ? INK : '#fff');
        // Three sliders: hue, saturation, lightness.
        const rows: [number, (v: number) => string, number][] = [
          [0, (v) => hsl(v * 360, 80, 55), cur.h / 360],
          [1, (v) => hsl(cur.h, v * 100, 55), cur.s / 100],
          [2, (v) => hsl(cur.h, 70, v * 100), cur.l / 100],
        ];
        for (const [i, color, v] of rows) {
          const sy = 112 + i * 28;
          const g = ctx.createLinearGradient(30, 0, 170, 0);
          for (let s = 0; s <= 6; s++) g.addColorStop(s / 6, color(s / 6));
          rr(ctx, 30, sy, 140, 14, 7);
          ctx.fillStyle = g;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = INK;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(30 + Math.max(0, Math.min(1, look ? [from.h / 360, from.s / 100, from.l / 100][i]! : v)) * 140, sy + 7, 9, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        ctx.restore();
        if (t > 6.2) pick();
      },
    };
  });
  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
