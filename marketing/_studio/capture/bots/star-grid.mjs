// Star Grid, endless, played like a person: studies the grid, crosses out a few squares it has ruled
// out, places stars with pauses, puts a couple in the wrong place (they turn red) and takes them
// back, until the grid is solved.
export default {
  max: 120,
  tail: 4,
  async prepare(page, { args }) {
    await page.getByRole('button', { name: /play star grid/i }).first().click();
    await page.waitForTimeout(700);
    const skip = page.getByRole('button', { name: /^skip$/i });
    if (await skip.count()) await skip.click();
    await page.getByRole('button', { name: new RegExp(`^${args.size ?? 7}×`) }).click();
    await page.waitForTimeout(800);
    const skip2 = page.getByRole('button', { name: /^skip$/i });
    if (await skip2.count()) await skip2.click();
  },
  async play(page) {
    await page.evaluate(async () => {
      const gb = window.__gb;
      const round = gb.live((v) => gb.has(v, 'puzzles', 'i', 'marks', 'phase'));
      const r0 = round();
      const p = r0.puzzles[r0.i];
      const n = p.size;
      const cell = (i) => document.querySelector(`.sg-cell[data-cell="${i}"]`);
      const tool = (name) => document.querySelector(`.sg-tool:nth-child(${name === 'star' ? 1 : 2})`);
      const regionSize = (reg) => p.regions.filter((x) => x === reg).length;
      const stars = p.stars.map((c, row) => row * n + c);
      const order = [...stars].sort((a, b) => regionSize(p.regions[a]) - regionSize(p.regions[b]) + gb.rand(-1.5, 1.5));
      const neighbours = (s) => [s + 1, s - 1, s + n, s - n, s + n + 1, s - n - 1].filter((x) => x >= 0 && x < n * n && Math.abs((x % n) - (s % n)) <= 1 && !stars.includes(x));
      await gb.think(2000, 3200);
      await gb.scan(document.querySelector('.sg-board').getBoundingClientRect(), gb.rand(1200, 2000));
      let wrongs = 0;
      for (let k = 0; k < order.length; k++) {
        const s = order[k];
        // Cross out a few squares around a star it's sure about.
        if (k === 1 || (k > 1 && gb.chance(0.3))) {
          await gb.tapH(tool('cross'));
          for (const x of gb.shuffle(neighbours(order[k - 1])).slice(0, 2 + Math.floor(Math.random() * 2))) {
            await gb.tapH(cell(x), { settle: [40, 120] });
            await gb.sleep(gb.rand(120, 300));
          }
          await gb.tapH(tool('star'));
        }
        // A wrong guess now and then, taken back once it turns red.
        if (wrongs < 2 && (k === 2 || gb.chance(0.15))) {
          const bad = gb.pick(neighbours(order[Math.max(0, k - 1)]).filter((x) => round().marks[x] === 0)) ?? null;
          if (bad !== null) {
            wrongs++;
            await gb.tapH(cell(bad));
            gb.mark('oops');
            await gb.think(1100, 1900);
            await gb.tapH(cell(bad));
            await gb.think(500, 900);
            // Crossed it out instead.
            await gb.tapH(tool('cross'));
            await gb.tapH(cell(bad));
            await gb.tapH(tool('star'));
          }
        }
        await gb.think(900, 2200);
        await gb.tapH(cell(s));
      }
      await gb.until(() => round().phase !== 'play', 4000);
      gb.mark('solved');
    });
  },
};
