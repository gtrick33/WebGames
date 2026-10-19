import type { GamePreviewProps } from '../../platform/contract';
import { ease, fit, label, rr, usePreviewCanvas, type C } from '../../platform/previewLoop';

const INK = '#14213d';
const N = 5;
const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;
const COLORS = ['#ff5d73', '#3ba7ff', '#ffc93c', '#4ed37b', '#9b6bff'];
interface Arrow {
  cell: number;
  dir: number;
  color: string;
}

/** Whether an arrow's way to the edge is clear of the others. */
function clear(a: Arrow, all: Arrow[]): boolean {
  let x = a.cell % N;
  let y = Math.floor(a.cell / N);
  const [dx, dy] = DIRS[a.dir]!;
  for (;;) {
    x += dx;
    y += dy;
    if (x < 0 || y < 0 || x >= N || y >= N) return true;
    if (all.some((b) => b.cell === y * N + x)) return false;
  }
}

/** A full board with an order that clears it (tries until one works). */
function board(): { arrows: Arrow[]; order: number[] } {
  for (;;) {
    const arrows: Arrow[] = [];
    for (let i = 0; i < N * N; i++) if (Math.random() < 0.72) arrows.push({ cell: i, dir: Math.floor(Math.random() * 4), color: COLORS[Math.floor(Math.random() * COLORS.length)]! });
    const left = arrows.slice();
    const order: number[] = [];
    while (left.length) {
      const free = left.filter((a) => clear(a, left));
      if (!free.length) break;
      const pick = free[Math.floor(Math.random() * free.length)]!;
      order.push(arrows.indexOf(pick));
      left.splice(left.indexOf(pick), 1);
    }
    if (!left.length && arrows.length >= 12) return { arrows, order };
  }
}

function arrow(ctx: C, x: number, y: number, s: number, dir: number, color: string): void {
  ctx.save();
  ctx.translate(x + s / 2, y + s / 2);
  ctx.rotate((dir * Math.PI) / 2);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.38);
  ctx.lineTo(s * 0.32, -s * 0.02);
  ctx.lineTo(s * 0.12, -s * 0.02);
  ctx.lineTo(s * 0.12, s * 0.36);
  ctx.lineTo(-s * 0.12, s * 0.36);
  ctx.lineTo(-s * 0.12, -s * 0.02);
  ctx.lineTo(-s * 0.32, -s * 0.02);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

/** Outta Here's attract mode: arrows shoot off the board, each once its way is clear. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    let b = board();
    let t = 0;
    return {
      frame(ctx, w, h, dt) {
        t += dt;
        ctx.fillStyle = '#d9f7ee';
        ctx.fillRect(0, 0, w, h);
        const { k, x, y } = fit(w, h, 200, 200);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k, k);
        const cell = 34;
        const ox = (200 - N * cell) / 2;
        const oy = (200 - N * cell) / 2 - 6;
        rr(ctx, ox - 5, oy - 5, N * cell + 10, N * cell + 10, 12);
        ctx.fillStyle = '#f4fffb';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.save();
        rr(ctx, ox - 5, oy - 5, N * cell + 10, N * cell + 10, 12);
        ctx.clip();
        const per = 0.42;
        const gone = Math.floor((t - 0.5) / per);
        b.arrows.forEach((a, i) => {
          const at = b.order.indexOf(i);
          if (at < gone) return;
          let px = ox + (a.cell % N) * cell;
          let py = oy + Math.floor(a.cell / N) * cell;
          if (at === gone && t > 0.5) {
            const fly = ease(((t - 0.5) % per) / per) * 220;
            px += DIRS[a.dir]![0] * fly;
            py += DIRS[a.dir]![1] * fly;
          }
          arrow(ctx, px, py, cell, a.dir, a.color);
        });
        ctx.restore();
        if (gone >= b.order.length) label(ctx, 'Board clear!', 100, 100, 18, INK);
        ctx.restore();
        if (t > 0.5 + b.order.length * per + 1.2) {
          b = board();
          t = 0;
        }
      },
    };
  });
  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
