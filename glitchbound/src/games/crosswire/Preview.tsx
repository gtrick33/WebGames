import type { GamePreviewProps } from '../../platform/contract';
import { fit, label, rr, usePreviewCanvas } from '../../platform/previewLoop';

const INK = '#1d1238';
/** A tiny arrowword: each row starts with its clue square, the answer runs to the right. */
const ROWS: [string, string][] = [
  ['Big cat', 'LION'],
  ['Gem', 'OPAL'],
  ['Treat', 'CAKE'],
  ['Village', 'TOWN'],
];
/** Circled squares spell the mystery word (column per row). */
const CIRCLED = [0, 1, 2, 3];

/** Crosswire's attract mode: clues inside the grid, answers typing in along the arrows. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    let t = 0;
    return {
      frame(ctx, w, h, dt) {
        t += dt;
        ctx.fillStyle = '#fbf6ec';
        ctx.fillRect(0, 0, w, h);
        const { k, x, y } = fit(w, h, 200, 200);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k, k);
        const size = 34;
        const ox = (200 - 5 * size) / 2;
        const oy = 18;
        const per = 1.3;
        const cur = Math.floor(t / per);
        ROWS.forEach(([clue, word], r) => {
          const cy = oy + r * size;
          // The clue square.
          rr(ctx, ox, cy, size, size, 3);
          ctx.fillStyle = '#ffe08a';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = INK;
          ctx.stroke();
          label(ctx, clue, ox + size / 2, cy + size / 2 - 3, clue.length > 5 ? 6.5 : 8, INK, 800);
          label(ctx, '→', ox + size / 2, cy + size - 7, 9, INK);
          const typed = r < cur ? 4 : r === cur ? Math.min(4, Math.floor(((t % per) - 0.15) / 0.16)) : 0;
          for (let c = 0; c < 4; c++) {
            const cx = ox + (c + 1) * size;
            rr(ctx, cx, cy, size, size, 3);
            ctx.fillStyle = r === cur && c >= typed ? '#7fd6ff' : r === cur ? '#d9f0ff' : '#ffffff';
            ctx.fill();
            ctx.stroke();
            if (CIRCLED[r] === c) {
              ctx.beginPath();
              ctx.arc(cx + size / 2, cy + size / 2, size * 0.36, 0, Math.PI * 2);
              ctx.lineWidth = 1.5;
              ctx.strokeStyle = '#ff4f9a';
              ctx.stroke();
              ctx.lineWidth = 2;
              ctx.strokeStyle = INK;
            }
            if (c < typed) label(ctx, word[c]!, cx + size / 2, cy + size / 2 + 1, 17, INK);
          }
        });
        // The mystery word from the circled squares.
        const mystery = ROWS.map(([, word], r) => (r < cur ? word[CIRCLED[r]!]! : '_')).join(' ');
        label(ctx, `Mystery: ${mystery}`, 100, oy + 4 * size + 18, 12, cur >= ROWS.length ? '#c2185b' : INK);
        ctx.restore();
        if (t > ROWS.length * per + 1.8) t = 0;
      },
    };
  });
  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
