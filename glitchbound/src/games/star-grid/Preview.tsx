import type { GamePreviewProps } from '../../platform/contract';
import { ease, fit, label, rr, usePreviewCanvas, type C } from '../../platform/previewLoop';

const INK = '#1b1640';
const REGION = ['#ffd6e0', '#ffe9a8', '#c9f2d0', '#c8e6ff', '#e3d5ff', '#ffd9b8'];
const N = 6;

/** Stars one per row and column with no two touching, then colored regions grown around them. */
function puzzle(): { stars: number[]; region: number[] } {
  for (;;) {
    const cols: number[] = [];
    const used = new Set<number>();
    for (let r = 0; r < N; r++) {
      const options = [...Array(N).keys()].filter((c) => !used.has(c) && (r === 0 || Math.abs(c - cols[r - 1]!) > 1));
      if (!options.length) break;
      const c = options[Math.floor(Math.random() * options.length)]!;
      cols.push(c);
      used.add(c);
    }
    if (cols.length < N) continue;
    const stars = cols.map((c, r) => r * N + c);
    const region = new Array<number>(N * N).fill(-1);
    stars.forEach((s, i) => (region[s] = i));
    // Grow each region a cell at a time until the board is full.
    while (region.includes(-1)) {
      const i = Math.floor(Math.random() * N);
      const cells = region.flatMap((v, j) => (v === i ? [j] : []));
      const edge = cells.flatMap((j) => [j - N, j + N, j % N ? j - 1 : -1, (j + 1) % N ? j + 1 : -1]).filter((j) => j >= 0 && j < N * N && region[j] === -1);
      if (edge.length) region[edge[Math.floor(Math.random() * edge.length)]!] = i;
    }
    return { stars, region };
  }
}

function star(ctx: C, x: number, y: number, s: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 ? s * 0.45 : s;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffc928';
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** Star Grid's attract mode: a real valid grid, crosses ruling squares out, stars falling into place. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = usePreviewCanvas(playing, () => {
    let p = puzzle();
    let order = [...p.stars].sort(() => Math.random() - 0.5);
    let t = 0;
    return {
      frame(ctx, w, h, dt) {
        t += dt;
        ctx.fillStyle = '#2b2470';
        ctx.fillRect(0, 0, w, h);
        const { k, x, y } = fit(w, h, 200, 200);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k, k);
        const cell = 28;
        const ox = (200 - N * cell) / 2;
        const oy = (200 - N * cell) / 2 - 4;
        const per = 0.55;
        const placed = Math.max(0, Math.floor((t - 0.4) / per) + 1);
        const done = placed > N;
        // Squares a placed star rules out (its row, column, region and neighbors) get a cross.
        const shown = order.slice(0, Math.min(N, placed));
        const ruled = new Set<number>();
        for (const s of shown) {
          const r = Math.floor(s / N);
          const c = s % N;
          for (let j = 0; j < N * N; j++) {
            const rj = Math.floor(j / N);
            const cj = j % N;
            if (j !== s && (rj === r || cj === c || p.region[j] === p.region[s] || (Math.abs(rj - r) <= 1 && Math.abs(cj - c) <= 1))) ruled.add(j);
          }
        }
        for (let j = 0; j < N * N; j++) {
          const cx = ox + (j % N) * cell;
          const cy = oy + Math.floor(j / N) * cell;
          ctx.fillStyle = REGION[p.region[j]!]!;
          ctx.fillRect(cx, cy, cell, cell);
          ctx.lineWidth = 0.7;
          ctx.strokeStyle = 'rgba(27,22,64,0.25)';
          ctx.strokeRect(cx, cy, cell, cell);
          if (ruled.has(j) && !shown.includes(j)) label(ctx, '×', cx + cell / 2, cy + cell / 2, 12, 'rgba(27,22,64,0.4)');
        }
        // Thick ink between regions.
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = INK;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let j = 0; j < N * N; j++) {
          const cx = ox + (j % N) * cell;
          const cy = oy + Math.floor(j / N) * cell;
          if (j % N < N - 1 && p.region[j + 1] !== p.region[j]) {
            ctx.moveTo(cx + cell, cy);
            ctx.lineTo(cx + cell, cy + cell);
          }
          if (j < N * (N - 1) && p.region[j + N] !== p.region[j]) {
            ctx.moveTo(cx, cy + cell);
            ctx.lineTo(cx + cell, cy + cell);
          }
        }
        ctx.stroke();
        rr(ctx, ox, oy, N * cell, N * cell, 4);
        ctx.lineWidth = 3;
        ctx.stroke();
        shown.forEach((s, i) => {
          const pop = 1 + 0.35 * (1 - ease((t - 0.4 - i * per) / 0.25));
          star(ctx, ox + (s % N) * cell + cell / 2, oy + Math.floor(s / N) * cell + cell / 2, 9 * pop);
        });
        if (done) label(ctx, 'Solved!', 100, oy + N * cell + 14, 13, '#ffe08a');
        ctx.restore();
        if (t > 0.4 + N * per + 1.6) {
          p = puzzle();
          order = [...p.stars].sort(() => Math.random() - 0.5);
          t = 0;
        }
      },
    };
  });
  return <canvas ref={ref} className="game-preview-canvas" aria-hidden="true" />;
}
