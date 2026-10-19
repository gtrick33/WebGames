import type { GamePreviewProps } from '../../platform/contract';
import { ease, fit, rr, usePreviewCanvas } from '../../platform/previewLoop';

const INK = '#14102a';
const COLORS = ['#ff3b5c', '#ffd21f', '#3d8bff'];
const CAP = 3;
type Tubes = number[][];

/** Pours the top run of `from` onto `to` (game rules: same color on top or empty, while it fits). */
function pour(s: Tubes, from: number, to: number): Tubes | null {
  const a = s[from]!;
  const b = s[to]!;
  if (from === to || !a.length || b.length >= CAP) return null;
  const top = a[a.length - 1]!;
  if (b.length && b[b.length - 1] !== top) return null;
  const next = s.map((x) => x.slice());
  while (next[from]!.length && next[from]![next[from]!.length - 1] === top && next[to]!.length < CAP) next[to]!.push(next[from]!.pop()!);
  return next;
}
const solved = (s: Tubes): boolean => s.every((x) => !x.length || (x.length === CAP && x.every((c) => c === x[0])));
const key = (s: Tubes): string => s.map((x) => x.join('')).join('|');

/** A shuffled puzzle and its shortest solution (breadth-first: three colors, five tubes, tiny). */
function puzzle(): { start: Tubes; moves: [number, number][] } {
  for (;;) {
    const layers = [0, 0, 0, 1, 1, 1, 2, 2, 2].sort(() => Math.random() - 0.5);
    const start: Tubes = [layers.slice(0, 3), layers.slice(3, 6), layers.slice(6, 9), [], []];
    if (solved(start)) continue;
    const seen = new Map<string, [string, [number, number]] | null>([[key(start), null]]);
    let frontier: Tubes[] = [start];
    while (frontier.length) {
      const nextFrontier: Tubes[] = [];
      for (const s of frontier) {
        for (let i = 0; i < 5; i++)
          for (let j = 0; j < 5; j++) {
            const n = pour(s, i, j);
            if (!n || seen.has(key(n))) continue;
            seen.set(key(n), [key(s), [i, j]]);
            if (solved(n)) {
              const moves: [number, number][] = [];
              let k = key(n);
              for (let step = seen.get(k); step; step = seen.get(k)) {
                moves.unshift(step[1]);
                k = step[0];
              }
              if (moves.length >= 4) return { start, moves };
            }
            nextFrontier.push(n);
          }
      }
      frontier = nextFrontier;
    }
  }
}

/** Color Lab's attract mode: a real puzzle poured to solved, tube by tube. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    let p = puzzle();
    let state = p.start;
    let move = 0;
    let t = 0;
    return {
      frame(ctx, w, h, dt) {
        t += dt;
        ctx.fillStyle = '#f3f6f4';
        ctx.fillRect(0, 0, w, h);
        const { k, x, y } = fit(w, h, 200, 200);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k, k);
        const per = 1.1;
        const m = p.moves[move];
        const phase = m ? Math.min(1, t / per) : 0;
        const tw = 26;
        const th = 96;
        const gap = 12;
        const ox = (200 - (5 * tw + 4 * gap)) / 2;
        const oy = 66;
        state.forEach((tube, i) => {
          let tx = ox + i * (tw + gap);
          let ty = oy;
          let rot = 0;
          if (m && m[0] === i) {
            // Lift, swing over the target, tip, come back.
            const lift = ease(Math.min(1, phase / 0.3)) * (1 - ease((phase - 0.75) / 0.25));
            const dest = ox + m[1] * (tw + gap);
            tx += (dest - tx + (dest > tx ? -tw * 0.6 : tw * 0.6)) * lift;
            ty -= 34 * lift;
            rot = (dest > ox + i * (tw + gap) ? 1 : -1) * 0.9 * ease((phase - 0.3) / 0.2) * (1 - ease((phase - 0.7) / 0.1));
          }
          ctx.save();
          ctx.translate(tx + tw / 2, ty);
          ctx.rotate(rot);
          ctx.translate(-tw / 2, 0);
          ctx.save();
          rr(ctx, 0, 0, tw, th, 12);
          ctx.clip();
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.fillRect(0, 0, tw, th);
          const lh = (th - 8) / CAP;
          tube.forEach((c, l) => {
            ctx.fillStyle = COLORS[c]!;
            ctx.fillRect(0, th - 4 - (l + 1) * lh, tw, lh + 0.5);
          });
          ctx.restore();
          rr(ctx, 0, 0, tw, th, 12);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = INK;
          ctx.stroke();
          ctx.restore();
        });
        ctx.restore();
        if (m && t >= per) {
          state = pour(state, m[0], m[1]) ?? state;
          move++;
          t = 0;
        } else if (!m && t > 1.6) {
          p = puzzle();
          state = p.start;
          move = 0;
          t = 0;
        }
      },
    };
  });
  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
