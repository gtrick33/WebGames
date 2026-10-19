import type { GamePreviewProps } from '../../platform/contract';
import { ease, fit, label, rr, usePreviewCanvas, type C } from '../../platform/previewLoop';

const INK = '#2b0f3a';
/** Heights in meters, in an order where the calls go both ways. */
const CHAIN: [string, number][] = [
  ['Leaning Tower of Pisa', 56],
  ['Statue of Liberty', 93],
  ['Great Pyramid', 139],
  ['Big Ben', 96],
  ['Eiffel Tower', 330],
  ['Burj Khalifa', 828],
];

function card(ctx: C, x: number, name: string, value: string, hidden: boolean): void {
  rr(ctx, x, 30, 84, 112, 14);
  ctx.fillStyle = '#fff7fb';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  const words = name.split(' ');
  const lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [name];
  lines.forEach((l, i) => label(ctx, l, x + 42, 58 + i * 13 - (lines.length - 1) * 6, 10, INK, 800));
  label(ctx, hidden ? '?' : value, x + 42, 108, hidden ? 30 : 20, hidden ? '#e93e8e' : INK);
}

/** Gut Check's attract mode: bigger or smaller? A call, the reveal, the streak grows. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    let i = 0;
    let t = 0;
    return {
      frame(ctx, w, h, dt) {
        t += dt;
        const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
        g.addColorStop(0, '#ff5fb0');
        g.addColorStop(1, '#b02a8a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        const { k, x, y } = fit(w, h, 200, 200);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k, k);
        const [a, av] = CHAIN[i % CHAIN.length]!;
        const [b, bv] = CHAIN[(i + 1) % CHAIN.length]!;
        const up = bv > av;
        const slide = ease((t - 2.6) / 0.5) * 96;
        ctx.save();
        ctx.translate(-slide, 0);
        card(ctx, 10, a, `${av} m`, false);
        const shown = t > 1.6;
        const count = Math.round(bv * Math.min(1, Math.max(0, (t - 1.6) / 0.5)));
        card(ctx, 106, b, `${count} m`, !shown);
        ctx.restore();
        label(ctx, `Streak ${i % CHAIN.length}`, 100, 16, 11, '#fff');
        // The two calls; the right one lights up.
        const calls: [string, boolean][] = [
          ['▲ Bigger', true],
          ['▼ Smaller', false],
        ];
        calls.forEach(([text, isUp], j) => {
          const bx = 24 + j * 80;
          const chosen = t > 1.1 && isUp === up;
          rr(ctx, bx, 156, 72, 26, 13);
          ctx.fillStyle = chosen ? (shown ? '#7ee08a' : '#ffe7a3') : '#fff7fb';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = INK;
          ctx.stroke();
          label(ctx, text, bx + 36, 169, 10.5, INK);
        });
        ctx.restore();
        if (t > 3.2) {
          i++;
          t = 0;
        }
      },
    };
  });
  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
