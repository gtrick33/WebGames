import type { GamePreviewProps } from '../../platform/contract';
import { ease, rr, usePreviewCanvas } from '../../platform/previewLoop';
import { makePuzzle, type Puzzle } from './diffs';
import { drawScene } from './draw';
import { CLASSIC_THEMES, H, W } from './scene';

const PAD = 8;
const INK = '#14102a';

/** Spot the Glitch's attract mode: two real generated pictures, their five glitches circled one by one. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    let n = Math.floor(Math.random() * 1000);
    let puzzle: Puzzle = makePuzzle(n * 7919 + 1, 0, CLASSIC_THEMES[n % CLASSIC_THEMES.length]);
    const pics = [document.createElement('canvas'), document.createElement('canvas')];
    let drawnAt = 0;
    let t = 0;
    return {
      frame(ctx, w, h, dt) {
        t += dt;
        // Side by side in wide boxes, one above the other in tall ones.
        const side = w / h >= 1.25;
        let pw = side ? (w - 3 * PAD) / 2 : w - 2 * PAD;
        let ph = (pw * H) / W;
        const maxH = side ? h - 2 * PAD : (h - 3 * PAD) / 2;
        if (ph > maxH) {
          ph = maxH;
          pw = (ph * W) / H;
        }
        if (Math.abs(drawnAt - pw) > 1) {
          drawScene(pics[0]!, puzzle.left, pw);
          drawScene(pics[1]!, puzzle.right, pw);
          drawnAt = pw;
        }
        const spots = side ? [[(w - 2 * pw - PAD) / 2, (h - ph) / 2], [(w + PAD) / 2, (h - ph) / 2]] : [[(w - pw) / 2, (h - 2 * ph - PAD) / 2], [(w - pw) / 2, (h + PAD) / 2]];
        ctx.fillStyle = '#fff8ec';
        ctx.fillRect(0, 0, w, h);
        const k = pw / W;
        const found = Math.max(0, Math.min(puzzle.diffs.length, Math.floor((t - 0.8) / 0.9) + 1));
        spots.forEach(([x, y], i) => {
          ctx.save();
          rr(ctx, x!, y!, pw, ph, 8);
          ctx.clip();
          ctx.drawImage(pics[i]!, x!, y!, pw, ph);
          ctx.restore();
          rr(ctx, x!, y!, pw, ph, 8);
          ctx.lineWidth = 2;
          ctx.strokeStyle = INK;
          ctx.stroke();
          for (let d = 0; d < found; d++) {
            const age = t - 0.8 - d * 0.9;
            const pop = 1 + 0.4 * (1 - ease(age / 0.3));
            for (const s of puzzle.diffs[d]!.spots.slice(0, 1)) {
              const r = Math.max(9, s.r * k * 1.15) * pop;
              ctx.beginPath();
              ctx.arc(x! + s.x * k, y! + s.y * k, r, 0, Math.PI * 2);
              ctx.lineWidth = 4;
              ctx.strokeStyle = '#fff';
              ctx.stroke();
              ctx.lineWidth = 2.5;
              ctx.strokeStyle = '#ff3fa4';
              ctx.stroke();
            }
          }
        });
        // All five found: a beat, then the next pair.
        if (t > 0.8 + puzzle.diffs.length * 0.9 + 1.4) {
          n++;
          puzzle = makePuzzle(n * 7919 + 1, n % 2, CLASSIC_THEMES[n % CLASSIC_THEMES.length]);
          drawnAt = 0;
          t = 0;
        }
      },
    };
  });
  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
