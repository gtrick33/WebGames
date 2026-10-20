// Square Deal, endless, played like a person: often a good placement but not always the best,
// drags that pause over one spot and move on to another, and the odd drop that doesn't fit (the
// piece snaps back), for `--moves` moves (default 24).
export default {
  max: 150,
  tail: 2,
  async prepare(page) {
    await page.getByRole('button', { name: /play square deal/i }).first().click();
    await page.waitForTimeout(700);
    const skip = page.getByRole('button', { name: /^skip$/i });
    if (await skip.count()) await skip.click();
    await page.getByRole('button', { name: /endless/i }).first().click();
    await page.waitForTimeout(800);
  },
  async play(page, rec, { args }) {
    await page.evaluate(async (moves) => {
      const gb = window.__gb;
      const Q = await gb.mod('/src/games/square-deal/logic.ts');
      const game = gb.live((v) => gb.has(v, 'board', 'tray', 'score', 'streak'));
      const SIZE = Q.SIZE;
      const options = (s) => {
        const out = [];
        s.tray.forEach((p, slot) => {
          if (!p) return;
          for (let row = 0; row <= SIZE - p.h; row++)
            for (let col = 0; col <= SIZE - p.w; col++) {
              if (!Q.fits(s.board, p, row, col)) continue;
              const { rows, cols } = Q.linesAfter(s.board, p, row, col);
              const bd = s.board.slice();
              for (const [y, x] of p.cells) bd[(row + y) * SIZE + col + x] = 0;
              let touch = 0;
              for (const [y, x] of p.cells) for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const yy = row + y + dy, xx = col + x + dx;
                if (yy < 0 || xx < 0 || yy >= SIZE || xx >= SIZE || bd[yy * SIZE + xx] !== -1) touch++;
              }
              out.push({ slot, row, col, p, v: (rows.length + cols.length) * 100 + touch });
            }
        });
        return out.sort((a, b) => b.v - a.v);
      };
      await gb.think(900, 1600);
      for (let k = 0; k < moves; k++) {
        const s = game();
        if (!s || s.over) break;
        const opts = options(s);
        if (!opts.length) break;
        // Usually one of the better spots, not always the best.
        const m = gb.chance(0.74) ? opts[0] : gb.pick(opts.slice(0, Math.min(opts.length, 3)));
        const btn = document.querySelectorAll('.sd-tray > *')[m.slot];
        const bb = document.querySelector('.sd-board').getBoundingClientRect();
        const cell = (bb.width - 12) / SIZE;
        const spot = (row, col, p) => [bb.left + 6 + (col + p.w / 2) * cell, bb.top + 6 + (row + p.h / 2) * cell + cell * 1.6];
        const [x0, y0] = gb.center(btn);
        const [x1, y1] = spot(m.row, m.col, m.p);
        await gb.think(500, 1400);
        const before = s.moves;
        const path = [[x0, y0]];
        if (gb.chance(0.35)) {
          // Hovers over another spot first.
          const o = gb.pick(opts.filter((x) => x.slot === m.slot)) ?? m;
          const [xo, yo] = spot(o.row, o.col, m.p);
          path.push([xo, yo, gb.rand(350, 750)]);
        }
        if (gb.chance(0.08) && k > 2) {
          // Drops it somewhere it doesn't fit: it goes back to the tray.
          path.push([bb.left + bb.width * gb.rand(0.3, 0.7), bb.top - cell * 0.4, 120]);
          await gb.dragPath(path, gb.rand(380, 560));
          gb.mark('nofit');
          await gb.think(700, 1300);
          continue;
        }
        path.push([x1, y1, 0]);
        await gb.dragPath(path, gb.rand(380, 600));
        await gb.until(() => game().moves > before, 1500);
        const after = game();
        if (after.lines > s.lines) gb.mark('clear', { lines: after.lines - s.lines, streak: after.streak });
        await gb.think(300, 800);
      }
    }, Number(args.moves ?? 24));
  },
};
