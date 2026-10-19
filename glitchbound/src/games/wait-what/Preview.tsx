import type { GamePreviewProps } from '../../platform/contract';
import { fit, label, rr, usePreviewCanvas } from '../../platform/previewLoop';

const INK = '#1d1238';
const QS: { cat: string; color: string; q: [string, string]; a: string[]; right: number; pick: number }[] = [
  { cat: 'ANIMALS', color: '#ff4fc8', q: ['How many hearts', 'does an octopus have?'], a: ['1', '2', '3', '8'], right: 2, pick: 2 },
  { cat: 'SPACE', color: '#3d8bff', q: ['A day on Venus is…', ''], a: ['shorter than its year', 'longer than its year'], right: 1, pick: 0 },
  { cat: 'HISTORY', color: '#ff8a1f', q: ['Cleopatra lived closer', 'in time to…'], a: ['the pyramids', 'the Moon landing'], right: 1, pick: 1 },
];

/** Wait, What?'s attract mode: a weird question, an answer, green or red, the next one. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    let i = Math.floor(Math.random() * QS.length);
    let t = 0;
    return {
      frame(ctx, w, h, dt) {
        t += dt;
        const q = QS[i]!;
        ctx.fillStyle = '#ffd84d';
        ctx.fillRect(0, 0, w, h);
        const { k, x, y } = fit(w, h, 200, 200);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k, k);
        // The question card.
        rr(ctx, 14, 12, 172, 74, 14);
        ctx.fillStyle = '#fffaf2';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = INK;
        ctx.stroke();
        rr(ctx, 26, 20, 64, 15, 7.5);
        ctx.fillStyle = q.color;
        ctx.fill();
        label(ctx, q.cat, 58, 28, 8, '#fff');
        label(ctx, q.q[0], 100, 50, 11.5, INK, 800);
        if (q.q[1]) label(ctx, q.q[1], 100, 66, 11.5, INK, 800);
        const picked = t > 1.6;
        const shown = t > 2.1;
        const rows = q.a.length;
        const bh = rows > 2 ? 22 : 30;
        q.a.forEach((a, j) => {
          const by = 96 + j * (bh + 6);
          let fill = '#ffffff';
          if (shown && j === q.right) fill = '#7ee08a';
          else if (shown && j === q.pick) fill = '#ff8b8b';
          else if (picked && j === q.pick) fill = '#ffe7a3';
          rr(ctx, 22, by, 156, bh, 10);
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = INK;
          ctx.stroke();
          label(ctx, a, 100, by + bh / 2 + 1, 11, INK, 800);
        });
        if (shown) label(ctx, q.pick === q.right ? 'Wait, what?! +100' : 'Wait… really?!', 100, 194, 11.5, INK);
        ctx.restore();
        if (t > 4.2) {
          i = (i + 1) % QS.length;
          t = 0;
        }
      },
    };
  });
  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
