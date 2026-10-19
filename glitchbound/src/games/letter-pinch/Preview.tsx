import type { GamePreviewProps } from '../../platform/contract';
import { fit, label, rr, usePreviewCanvas } from '../../platform/previewLoop';

const INK = '#1d1036';
const ROUNDS = [
  ['CRANE', 'MOUSE', 'PLUMB', 'PINCH'],
  ['STORM', 'GLAND', 'FLICK', 'FLASK'],
  ['HOUSE', 'MAPLE', 'LEMON', 'LEAFY'],
];

/** Letter Pinch's attract mode: guesses type in, every tile points up or down the alphabet, then all green. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    let round = Math.floor(Math.random() * ROUNDS.length);
    let t = 0;
    return {
      frame(ctx, w, h, dt) {
        t += dt;
        ctx.fillStyle = '#fff4df';
        ctx.fillRect(0, 0, w, h);
        const { k, x, y } = fit(w, h, 200, 200);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k, k);
        const words = ROUNDS[round]!;
        const secret = words[words.length - 1]!;
        const size = 30;
        const gap = 5;
        const ox = (200 - (5 * size + 4 * gap)) / 2;
        // Alphabet windows above each column, squeezing as clues arrive.
        const per = 1.6;
        const doneRows = Math.min(words.length, Math.floor(t / per));
        for (let c = 0; c < 5; c++) {
          let lo = 'A';
          let hi = 'Z';
          for (let r = 0; r < doneRows; r++) {
            const g = words[r]![c]!;
            if (g === secret[c]) lo = hi = g;
            else if (secret[c]! > g) lo = String.fromCharCode(Math.max(lo.charCodeAt(0), g.charCodeAt(0) + 1));
            else hi = String.fromCharCode(Math.min(hi.charCodeAt(0), g.charCodeAt(0) - 1));
          }
          label(ctx, lo === hi ? lo : `${lo}–${hi}`, ox + c * (size + gap) + size / 2, 12, 9.5, '#5a4a78', 800);
        }
        for (let r = 0; r < 5; r++) {
          const word = words[r];
          const typed = word ? Math.max(0, Math.min(5, Math.floor((t - r * per) / 0.12))) : 0;
          const scored = word && t > r * per + 0.8;
          for (let c = 0; c < 5; c++) {
            const cx = ox + c * (size + gap);
            const cy = 24 + r * (size + gap);
            const g = word?.[c];
            let fill = '#fffaf0';
            let mark = '';
            if (scored && g) {
              if (g === secret[c]) {
                fill = '#b6ea2a';
                mark = '●';
              } else if (secret[c]! > g) {
                fill = '#3d5bff';
                mark = '▲';
              } else {
                fill = '#ff5a6c';
                mark = '▼';
              }
            }
            rr(ctx, cx, cy, size, size, 6);
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = INK;
            ctx.stroke();
            if (g && c < typed) {
              const light = scored && fill !== '#b6ea2a';
              label(ctx, g, cx + size / 2, cy + size / 2 + 1, 15, light ? '#fff' : INK);
              if (mark && mark !== '●') label(ctx, mark, cx + size - 6, cy + 7, 7, '#fff');
            }
          }
        }
        ctx.restore();
        if (t > words.length * per + 1.8) {
          round = (round + 1) % ROUNDS.length;
          t = 0;
        }
      },
    };
  });
  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
